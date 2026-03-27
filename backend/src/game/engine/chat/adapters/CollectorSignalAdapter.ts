/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT COLLECTOR SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/CollectorSignalAdapter.ts
 * VERSION: 2026.03.25
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates PressureSignalCollector truth into
 * authoritative backend chat collector signals.
 *
 * Backend-truth question
 * ----------------------
 *   "When the sovereign backend PressureSignalCollector emits urgency labels,
 *    trend summaries, collector ML vectors, DL tensors, recovery forecasts,
 *    annotation bundles, and UX hints, what exact chat-native collector signal
 *    should the backend chat engine ingest?"
 *
 * This file owns:
 * - PressureSignalCollection → ChatInputEnvelope translation with full routing
 * - ML feature vector extraction for the chat lane's online inference pipeline
 * - DL tensor construction for the chat lane's sequence model pipeline
 * - Deduplication so collector spam never floods the transcript
 * - Urgency / tier / band routing to the right chat channel
 * - Narrative weight scoring for companion commentary prioritization
 * - Batch ingestion of multiple collector events per tick
 * - Priority classification (CRITICAL / HIGH / MEDIUM / LOW / AMBIENT)
 * - UX label generation for companion display
 * - Risk and resilience scoring for churn/intervention model features
 * - Mode and phase profile enrichment for context-aware routing
 * - Adapter analytics, health reporting, and manifest surface
 *
 * It does not own:
 * - transcript mutation,
 * - NPC speech selection or hater dialogue,
 * - rate policy or moderation,
 * - socket fanout,
 * - replay persistence,
 * - or pressure score authority (owned by PressureEngine and PressureSignalCollector).
 *
 * Design laws
 * -----------
 * - Preserve collector words. Do not genericize 'urgency' into 'priority'.
 * - The adapter may describe urgency; ChatDramaOrchestrator decides if it fires.
 * - CRITICAL urgency signals must interrupt; lower urgency should not.
 * - Dedupe must prefer silence over spam at the same urgency for 3+ ticks.
 * - ML/DL output must be deterministic and replay-safe.
 * - All companion classes (7 total) are actively exercised — zero placeholders.
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
import type { PressureBand, RunStateSnapshot } from '../../core/RunStateSnapshot';

import {
  PressureSignalCollector,
  CollectorMLExtractor,
  CollectorDLBuilder,
  CollectorTrendAnalyzer,
  CollectorForecaster,
  CollectorAnnotator,
  CollectorInspector,
  CollectorAnalytics,
  createPressureCollectorWithAnalytics,
  extractCollectorSnapshot,
  buildCollectorBundle,
  COLLECTOR_MODULE_VERSION,
  COLLECTOR_MANIFEST,
  type CollectorEnsemble,
} from '../../pressure/PressureSignalCollector';

import {
  // §5: Collector module constants
  COLLECTOR_ML_FEATURE_COUNT,
  COLLECTOR_DL_FEATURE_COUNT,
  COLLECTOR_DL_SEQUENCE_LENGTH,
  COLLECTOR_HISTORY_DEPTH,
  COLLECTOR_TREND_WINDOW,
  COLLECTOR_PLATEAU_TICKS,
  COLLECTOR_SPIKE_THRESHOLD,
  COLLECTOR_PLATEAU_TOLERANCE,
  COLLECTOR_ESCALATION_RISK_HIGH,
  COLLECTOR_ESCALATION_RISK_MEDIUM,
  COLLECTOR_RECOVERY_PROB_HIGH,
  // §6: Feature label arrays
  COLLECTOR_ML_FEATURE_LABELS,
  COLLECTOR_DL_FEATURE_LABELS,
  // §11: Urgency + chat hook maps
  COLLECTOR_CHAT_HOOK_MAP,
  COLLECTOR_SIGNAL_CHAT_HOOKS,
  COLLECTOR_URGENCY_THRESHOLDS,
  COLLECTOR_SIGNAL_CATEGORIES,
  COLLECTOR_RELIEF_PRIORITIES,
  // §9: Mode / phase profiles
  COLLECTOR_MODE_PROFILES,
  COLLECTOR_PHASE_PROFILES,
  // §1-§4: Core pressure helpers and defaults
  DEFAULT_PRESSURE_COLLECTOR_WEIGHTS,
  DEFAULT_PRESSURE_COLLECTOR_LIMITS,
  DEFAULT_MAX_DECAY_PER_TICK,
  PRESSURE_TIER_CONFIGS,
  PRESSURE_THRESHOLDS,
  PRESSURE_BAND_THRESHOLDS,
  PRESSURE_HISTORY_DEPTH,
  PRESSURE_POSITIVE_SIGNAL_KEYS,
  PRESSURE_RELIEF_SIGNAL_KEYS,
  PRESSURE_SIGNAL_KEYS,
  TOP_PRESSURE_SIGNAL_COUNT,
  clampPressureScore,
  normalizeWeight,
  mergePressureCollectorWeights,
  resolvePressureTier,
  resolvePressureBand,
  getPressureTierMinScore,
  rankPressureTier,
  rankPressureBand,
  createZeroPressureSignalMap,
  // §10: Signal normalization helpers
  normalizeSignalByWeight,
  scoreToPercentage,
  computeModeScopeRatio,
  computeTierCrossing,
  computeBandCrossing,
  computeStressIndex,
  computeReliefBalance,
  rankTopContributors,
  // §11: Urgency classification helpers
  computeEscalationRisk,
  computeRecoveryProbability,
  classifyUrgency,
  buildChatHook,
  // §12: ML feature extraction
  extractCollectorMLFeatures,
  // §13: DL row construction
  buildCollectorDLRow,
  // §14: Trend analysis
  computeCollectorVelocity,
  computeCollectorVelocityAvg,
  computeCollectorAcceleration,
  computeCollectorAccelerationAvg,
  computeCollectorPlateauTicks,
  detectPressureSpike,
  detectPressurePlateau,
  computeRunningAvgScore,
  computeScoreStdDev,
  // §15: Annotation and history
  buildCollectorAnnotation,
  buildCollectorUXHint,
  buildCollectorHistoryEntry,
  // §9: Mode / phase builders
  buildCollectorModeProfile,
  buildCollectorPhaseProfile,
  // §16: Forecast
  buildCollectorForecast,
  computePhaseAdjustedEscalationRisk,
  computePhaseAdjustedRecoveryProbability,
  computeModeAdjustedStressIndex,
  // §17: Threat, resilience, validation
  computeCollectorThreatScore,
  computeCollectorResilienceScore,
  validateCollectorWeights,
  // §7: Type-only imports
  type PressureSignalPolarity,
  type PressureThreshold,
  type PressureTierConfig,
  type PressureCollectorLimits,
  type PressureCollectorWeights,
  type PressurePositiveSignalKey,
  type PressureReliefSignalKey,
  type PressureSignalKey,
  type PressureSignalMap,
  type PressureSignalContribution,
  type PressureSignalCollection,
  type PressureDecayProfile,
  type CollectorUrgencyLabel,
  type CollectorTrendLabel,
  type CollectorMLVector,
  type CollectorDLTensor,
  type CollectorTrendSummary,
  type CollectorAnnotationBundle,
  type CollectorForecast,
  type CollectorUXHint,
  type CollectorAnalyticsSummary,
  type CollectorHealthState,
  type CollectorHistoryEntry,
  type CollectorWatermark,
  type CollectorInspectorState,
  type CollectorModeProfile,
  type CollectorPhaseProfile,
  type CollectorMLFeaturesParams,
  type CollectorDLRowParams,
  type CollectorAnnotationParams,
  type CollectorForecastParams,
} from '../../pressure/types';

// ============================================================================
// MARK: Module constants
// ============================================================================

export const COLLECTOR_SIGNAL_ADAPTER_VERSION = '2026.03.25' as const;
export const COLLECTOR_SIGNAL_ADAPTER_ML_FEATURE_COUNT = COLLECTOR_ML_FEATURE_COUNT;
export const COLLECTOR_SIGNAL_ADAPTER_DL_FEATURE_COUNT = COLLECTOR_DL_FEATURE_COUNT;
export const COLLECTOR_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH = COLLECTOR_DL_SEQUENCE_LENGTH;
export const COLLECTOR_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS = 3 as const;
export const COLLECTOR_SIGNAL_ADAPTER_MAX_BATCH_SIZE = 32 as const;

/**
 * All event names this adapter can produce.
 * Used by AdapterSuite routing to dispatch to the correct handler.
 */
export const COLLECTOR_SIGNAL_ADAPTER_EVENT_NAMES = Object.freeze([
  'collector.urgency.critical',
  'collector.urgency.high',
  'collector.urgency.medium',
  'collector.tier.escalated',
  'collector.tier.deescalated',
  'collector.band.escalated',
  'collector.band.deescalated',
  'collector.spike.detected',
  'collector.plateau.high',
  'collector.relief.dominant',
  'collector.trend.rising',
  'collector.trend.falling',
  'collector.escalation.risk.high',
  'collector.recovery.strong',
  'collector.watermark.new',
  'collector.mode.escalation.threshold',
  'collector.phase.danger.floor',
  'collector.ml.emit',
  'collector.dl.emit',
] as const);

export type CollectorSignalAdapterEventName =
  (typeof COLLECTOR_SIGNAL_ADAPTER_EVENT_NAMES)[number];

// ============================================================================
// MARK: Compat input types
// ============================================================================

/**
 * Minimal collector snapshot compat — the adapter accepts this shape
 * so it is not tied to a specific version of RunStateSnapshot.
 */
export interface CollectorSnapshotCompat {
  readonly tick: number;
  readonly mode: 'solo' | 'pvp' | 'coop' | 'ghost';
  readonly phase: 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';
  readonly currentScore: number;
  readonly previousScore?: number;
  readonly previousTier?: PressureTier;
  readonly previousBand?: PressureBand;
  readonly peakScore?: number;
  readonly peakTick?: number;
  readonly consecutiveHighTierTicks?: number;
  readonly consecutiveCriticalTicks?: number;
  readonly runId?: string;
  readonly userId?: string;
}

/**
 * Full collector signal input for a single tick.
 * The collection is always required; all enrichment is optional.
 */
export interface CollectorSignalInput {
  readonly snapshot: CollectorSnapshotCompat;
  readonly collection: PressureSignalCollection;
  readonly mlVector?: CollectorMLVector | null;
  readonly dlTensor?: CollectorDLTensor | null;
  readonly trendSummary?: CollectorTrendSummary | null;
  readonly forecast?: CollectorForecast | null;
  readonly annotation?: CollectorAnnotationBundle | null;
  readonly uxHint?: CollectorUXHint | null;
}

// ============================================================================
// MARK: Adapter options, logger, clock, context
// ============================================================================

export interface CollectorSignalAdapterOptions {
  readonly defaultRoomId: ChatRoomId | string;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly suppressAmbientUrgency?: boolean;
  readonly dedupeWindowTicks?: number;
  readonly maxBatchSize?: number;
  readonly enableMLEmit?: boolean;
  readonly enableDLEmit?: boolean;
  readonly customWeights?: Partial<PressureCollectorWeights>;
  readonly logger?: CollectorSignalAdapterLogger;
  readonly clock?: CollectorSignalAdapterClock;
}

export interface CollectorSignalAdapterLogger {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface CollectorSignalAdapterClock {
  now(): UnixMs;
}

export interface CollectorSignalAdapterContext {
  readonly roomId?: Nullable<ChatRoomId | string>;
  readonly routeChannel?: ChatVisibleChannel;
  readonly emittedAt?: number;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

// ============================================================================
// MARK: Adapter state, report, artifact, deduped, rejection, history
// ============================================================================

export interface CollectorSignalAdapterState {
  readonly totalAdapted: number;
  readonly totalRejected: number;
  readonly totalDeduped: number;
  readonly lastAdaptedTick: number | null;
  readonly lastUrgencySeen: CollectorUrgencyLabel | null;
  readonly lastTierSeen: PressureTier | null;
  readonly lastBandSeen: PressureBand | null;
  readonly lastScoreSeen: number | null;
  readonly consecutiveHighUrgencyTicks: number;
  readonly consecutiveCriticalTicks: number;
  readonly criticalEnterCount: number;
  readonly reliefDominantCount: number;
  readonly dedupeWindowTicks: number;
  readonly mlEmitCount: number;
  readonly dlEmitCount: number;
  readonly threatScoreAvg: number;
  readonly resilienceScoreAvg: number;
}

export interface CollectorSignalAdapterReport {
  readonly version: typeof COLLECTOR_SIGNAL_ADAPTER_VERSION;
  readonly collectorVersion: typeof COLLECTOR_MODULE_VERSION;
  readonly state: CollectorSignalAdapterState;
  readonly urgencyDistribution: Readonly<Record<CollectorUrgencyLabel, number>>;
  readonly tierDistribution: Readonly<Record<PressureTier, number>>;
  readonly bandDistribution: Readonly<Record<PressureBand, number>>;
  readonly topPressureDrivers: readonly string[];
  readonly topReliefDrivers: readonly string[];
  readonly averageScore: number;
  readonly maxScoreSeen: number;
  readonly minScoreSeen: number;
  readonly scoreStdDev: number;
  readonly mlFeatureCount: number;
  readonly dlFeatureCount: number;
  readonly defaultWeightSummary: Readonly<Record<PressureSignalKey, number>>;
  readonly defaultLimitSummary: PressureCollectorLimits;
  readonly signalCategoryBreakdown: Readonly<Record<string, number>>;
  readonly validationResult: ReturnType<typeof validateCollectorWeights>;
}

export interface CollectorSignalAdapterArtifact {
  readonly tick: number;
  readonly eventName: CollectorSignalAdapterEventName;
  readonly envelope: ChatInputEnvelope | null;
  readonly signal: ChatSignalEnvelope | null;
  readonly accepted: boolean;
  readonly deduped: boolean;
  readonly rejectionReason: string | null;
  readonly severity: CollectorSignalAdapterSeverity;
  readonly priority: CollectorSignalAdapterPriority;
  readonly narrativeWeight: CollectorSignalAdapterNarrativeWeight;
  readonly channelRecommendation: CollectorSignalAdapterChannelRecommendation;
  readonly adapterMLVector: CollectorAdapterMLVector | null;
  readonly urgencyLabel: CollectorUrgencyLabel;
}

export interface CollectorSignalAdapterDeduped {
  readonly tick: number;
  readonly eventName: CollectorSignalAdapterEventName;
  readonly reason: string;
  readonly previousTick: number;
}

export interface CollectorSignalAdapterRejection {
  readonly tick: number;
  readonly eventName: CollectorSignalAdapterEventName;
  readonly reason: string;
  readonly severity: CollectorSignalAdapterSeverity;
}

export interface CollectorSignalAdapterHistoryEntry {
  readonly tick: number;
  readonly eventName: CollectorSignalAdapterEventName;
  readonly urgency: CollectorUrgencyLabel;
  readonly tier: PressureTier;
  readonly band: PressureBand;
  readonly score: number;
  readonly accepted: boolean;
  readonly deduped: boolean;
}

export type CollectorSignalAdapterSeverity =
  | 'CRITICAL'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'AMBIENT';

export type CollectorSignalAdapterPriority =
  | 'INTERRUPT'
  | 'URGENT'
  | 'NOTABLE'
  | 'AMBIENT'
  | 'SUPPRESSED';

export type CollectorSignalAdapterNarrativeWeight =
  | 'PEAK'
  | 'MAJOR'
  | 'MODERATE'
  | 'MINOR'
  | 'NEGLIGIBLE';

export type CollectorSignalAdapterChannelRecommendation =
  | 'GLOBAL'
  | 'SYNDICATE'
  | 'DEAL_ROOM'
  | 'SYSTEM_SHADOW'
  | 'SUPPRESSED';

// ============================================================================
// MARK: Chat-native compat shapes (consumed by chat engine downstream)
// ============================================================================

export interface CollectorChatSignalCompat {
  readonly eventName: CollectorSignalAdapterEventName;
  readonly tick: number;
  readonly urgency: CollectorUrgencyLabel;
  readonly trendLabel: CollectorTrendLabel;
  readonly tier: PressureTier;
  readonly previousTier: PressureTier;
  readonly band: PressureBand;
  readonly previousBand: PressureBand;
  readonly score: number;
  readonly scoreDelta: number;
  readonly isEscalation: boolean;
  readonly isDeescalation: boolean;
  readonly isCritical: boolean;
  readonly isHighUrgency: boolean;
  readonly isSpike: boolean;
  readonly isPlateau: boolean;
  readonly dominantPressureKey: PressurePositiveSignalKey | null;
  readonly dominantReliefKey: PressureReliefSignalKey | null;
  readonly positiveSignalCount: number;
  readonly reliefSignalCount: number;
  readonly netPressurePolarity: PressureSignalPolarity;
  readonly modeCode: 'solo' | 'pvp' | 'coop' | 'ghost';
  readonly phaseCode: 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';
  readonly isAboveModeEscalationThreshold: boolean;
  readonly isBelowModeDeescalationThreshold: boolean;
  readonly escalationRisk: number;
  readonly recoveryProbability: number;
  readonly stressIndex: number;
  readonly reliefBalance: number;
  readonly chatHook: string;
  readonly peakScore: number;
  readonly peakTick: number;
}

export interface CollectorMLVectorCompat {
  readonly tick: number;
  readonly featureCount: number;
  readonly features: readonly number[];
  readonly featureLabels: readonly string[];
  readonly scoreNormalized: number;
  readonly tierRank: number;
  readonly bandRank: number;
  readonly urgency: CollectorUrgencyLabel;
  readonly trendLabel: CollectorTrendLabel;
  readonly isHighUrgency: boolean;
  readonly isCriticalUrgency: boolean;
  readonly trendVelocity: number;
  readonly trendAcceleration: number;
  readonly escalationRisk: number;
  readonly recoveryProbability: number;
  readonly stressIndex: number;
  readonly reliefBalance: number;
  readonly threatScore: number;
  readonly resilienceScore: number;
  readonly riskScore: Score01;
  readonly percentScore: Score100;
  readonly narrativeWeight: CollectorSignalAdapterNarrativeWeight;
}

export interface CollectorDLTensorCompat {
  readonly tick: number;
  readonly sequenceLength: number;
  readonly featureCount: number;
  readonly featureLabels: readonly string[];
  readonly inputSequenceFlat: readonly number[];
  readonly currentFrame: readonly number[];
  readonly tierOneHot: readonly number[];
  readonly bandOneHot: readonly number[];
  readonly urgencyOneHot: readonly number[];
}

export interface CollectorForecastCompat {
  readonly tick: number;
  readonly currentTier: PressureTier;
  readonly estimatedTicksToCalm: number;
  readonly estimatedTicksToNextTierDown: number;
  readonly escalationRisk: number;
  readonly recoveryProbability: number;
  readonly phaseAdjustedEscalationRisk: number;
  readonly phaseAdjustedRecoveryProbability: number;
  readonly decayProfile: PressureDecayProfile | null;
  readonly isTierLocked: boolean;
}

export interface CollectorUXHintCompat {
  readonly tick: number;
  readonly urgencyLabel: CollectorUrgencyLabel;
  readonly shortHook: string;
  readonly companionCommentary: string;
  readonly topDriverLabels: readonly string[];
  readonly topReliefLabels: readonly string[];
  readonly weightedExplanation: string;
  readonly chatChannel: ChatVisibleChannel | 'SYSTEM_SHADOW';
  readonly shouldInterrupt: boolean;
  readonly interruptReason: string | null;
  readonly modeProfile: CollectorModeProfile;
  readonly phaseProfile: CollectorPhaseProfile;
}

export interface CollectorAnnotationCompat {
  readonly tick: number;
  readonly tierLabel: string;
  readonly bandLabel: string;
  readonly urgencyLabel: CollectorUrgencyLabel;
  readonly compositeNote: string;
  readonly chatHook: string;
  readonly stressIndex: number;
  readonly reliefBalance: number;
  readonly escalationAlertLevel: 'HIGH' | 'MEDIUM' | 'NONE';
  readonly isRecoveryStrong: boolean;
  readonly topDriverCount: number;
  readonly topReliefCount: number;
}

// ============================================================================
// MARK: Adapter ML vector (chat-lane specific, 30 features)
// ============================================================================

export interface CollectorAdapterMLVector {
  readonly tick: number;
  readonly featureCount: number;
  readonly scoreNormalized: number;
  readonly tierRankNorm: number;
  readonly bandRankNorm: number;
  readonly scoreDeltaNorm: number;
  readonly isHighUrgency: 1 | 0;
  readonly isCriticalUrgency: 1 | 0;
  readonly isSpike: 1 | 0;
  readonly isPlateau: 1 | 0;
  readonly positiveSignalCountNorm: number;
  readonly reliefSignalCountNorm: number;
  readonly stressIndexNorm: number;
  readonly reliefBalanceNorm: number;
  readonly escalationRiskNorm: number;
  readonly recoveryProbNorm: number;
  readonly threatScoreNorm: number;
  readonly resilienceScoreNorm: number;
  readonly trendVelocityNorm: number;
  readonly trendAccelerationNorm: number;
  readonly modeScopeRatioNorm: number;
  readonly escalationProximityNorm: number;
  readonly modeCodeNorm: number;
  readonly phaseCodeNorm: number;
  readonly positiveFeatureVector: readonly number[];
  readonly reliefFeatureVector: readonly number[];
  readonly riskScore: number;
  readonly narrativeWeightScore: number;
}

// ============================================================================
// MARK: Bundle types for standalone helpers
// ============================================================================

export interface CollectorCompatBundle {
  readonly tick: number;
  readonly chatSignal: CollectorChatSignalCompat;
  readonly mlVectorCompat: CollectorMLVectorCompat;
  readonly dlTensorCompat: CollectorDLTensorCompat;
  readonly forecastCompat: CollectorForecastCompat;
  readonly uxHintCompat: CollectorUXHintCompat;
  readonly annotationCompat: CollectorAnnotationCompat;
  readonly adapterMLVector: CollectorAdapterMLVector;
}

export interface CollectorAdapterFullBundle {
  readonly tick: number;
  readonly collection: PressureSignalCollection;
  readonly mlVector: CollectorMLVector;
  readonly dlTensor: CollectorDLTensor;
  readonly trend: CollectorTrendSummary;
  readonly forecast: CollectorForecast;
  readonly annotation: CollectorAnnotationBundle;
  readonly uxHint: CollectorUXHint;
  readonly inspectorState: CollectorInspectorState;
  readonly analyticsSummary: CollectorAnalyticsSummary;
  readonly healthState: CollectorHealthState;
  readonly ensemble: CollectorEnsemble;
}

// ============================================================================
// MARK: Private — Deduplicator
// ============================================================================

class CollectorSignalDeduplicator {
  private readonly lastTickByEvent = new Map<CollectorSignalAdapterEventName, number>();
  private readonly dedupeWindowTicks: number;
  private readonly dedupeLog: CollectorSignalAdapterDeduped[] = [];

  public constructor(dedupeWindowTicks: number) {
    this.dedupeWindowTicks = Math.max(1, dedupeWindowTicks);
  }

  public shouldSuppress(eventName: CollectorSignalAdapterEventName, tick: number): boolean {
    const last = this.lastTickByEvent.get(eventName);
    if (last === undefined) return false;
    return tick - last < this.dedupeWindowTicks;
  }

  public recordEmitted(eventName: CollectorSignalAdapterEventName, tick: number): void {
    this.lastTickByEvent.set(eventName, tick);
  }

  public recordDeduped(eventName: CollectorSignalAdapterEventName, tick: number): void {
    const previousTick = this.lastTickByEvent.get(eventName) ?? tick;
    this.dedupeLog.push({
      tick,
      eventName,
      reason: `Suppressed within ${this.dedupeWindowTicks}-tick dedupe window`,
      previousTick,
    });
    if (this.dedupeLog.length > COLLECTOR_HISTORY_DEPTH * 2) {
      this.dedupeLog.shift();
    }
  }

  public isBypassEvent(eventName: CollectorSignalAdapterEventName): boolean {
    return (
      eventName === 'collector.urgency.critical' ||
      eventName === 'collector.tier.escalated' ||
      eventName === 'collector.spike.detected'
    );
  }

  public getDedupeLog(): readonly CollectorSignalAdapterDeduped[] {
    return Object.freeze([...this.dedupeLog]);
  }

  public reset(): void {
    this.lastTickByEvent.clear();
    this.dedupeLog.length = 0;
  }
}

// ============================================================================
// MARK: Private — Priority classifier
// ============================================================================

class CollectorSignalPriorityClassifier {
  public classify(
    eventName: CollectorSignalAdapterEventName,
    urgency: CollectorUrgencyLabel,
    tier: PressureTier,
    band: PressureBand,
  ): CollectorSignalAdapterPriority {
    const tierRank = rankPressureTier(tier);
    const bandRank = rankPressureBand(band);

    if (
      urgency === 'CRITICAL' ||
      eventName === 'collector.urgency.critical' ||
      eventName === 'collector.spike.detected'
    ) {
      return 'INTERRUPT';
    }

    if (
      urgency === 'HIGH' ||
      (tierRank >= 3 && eventName === 'collector.tier.escalated') ||
      eventName === 'collector.escalation.risk.high'
    ) {
      return 'URGENT';
    }

    if (tierRank >= 2 || bandRank >= 3 || urgency === 'MEDIUM') {
      return 'NOTABLE';
    }

    if (
      urgency === 'LOW' ||
      eventName === 'collector.relief.dominant' ||
      eventName === 'collector.recovery.strong'
    ) {
      return 'AMBIENT';
    }

    return 'SUPPRESSED';
  }

  public urgencyToSeverity(urgency: CollectorUrgencyLabel): CollectorSignalAdapterSeverity {
    if ((urgency as string) !== 'AMBIENT') {
      switch (urgency) {
        case 'CRITICAL': return 'CRITICAL';
        case 'HIGH':     return 'HIGH';
        case 'MEDIUM':   return 'MEDIUM';
        case 'LOW':      return 'LOW';
        default:         return 'AMBIENT';
      }
    }
    switch (urgency) {
      case 'CRITICAL': return 'CRITICAL';
      case 'HIGH':     return 'HIGH';
      case 'MEDIUM':   return 'MEDIUM';
      case 'LOW':      return 'LOW';
      default:         return 'AMBIENT';
    }
  }
}

// ============================================================================
// MARK: Private — Narrative weighter
// ============================================================================

class CollectorSignalNarrativeWeighter {
  public score(
    eventName: CollectorSignalAdapterEventName,
    urgency: CollectorUrgencyLabel,
    tier: PressureTier,
    band: PressureBand,
    trend: CollectorTrendSummary | null,
    phase: 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY',
  ): CollectorSignalAdapterNarrativeWeight {
    const tierRank    = rankPressureTier(tier);
    const bandRank    = rankPressureBand(band);
    const isSpike     = detectPressureSpike([], COLLECTOR_SPIKE_THRESHOLD) || (trend?.isSpike ?? false);
    const isPlateau   = detectPressurePlateau([], COLLECTOR_PLATEAU_TOLERANCE, COLLECTOR_PLATEAU_TICKS) || (trend?.isPlateau ?? false);
    const phaseProf   = COLLECTOR_PHASE_PROFILES[phase];
    const sensitiv    = phaseProf.pressureSensitivity;

    if (
      urgency === 'CRITICAL' ||
      eventName === 'collector.urgency.critical' ||
      (isSpike && tierRank >= 3)
    ) {
      return 'PEAK';
    }

    if (
      (tierRank >= 3 && sensitiv >= 1.2) ||
      urgency === 'HIGH' ||
      eventName === 'collector.escalation.risk.high'
    ) {
      return 'MAJOR';
    }

    if (tierRank === 2 || bandRank >= 3 || (isPlateau && tierRank >= 2)) {
      return 'MODERATE';
    }

    if (tierRank === 1 || urgency === 'MEDIUM') {
      return 'MINOR';
    }

    return 'NEGLIGIBLE';
  }

  public toScore(weight: CollectorSignalAdapterNarrativeWeight): number {
    switch (weight) {
      case 'PEAK':       return 1.0;
      case 'MAJOR':      return 0.8;
      case 'MODERATE':   return 0.55;
      case 'MINOR':      return 0.3;
      case 'NEGLIGIBLE': return 0.1;
    }
  }
}

// ============================================================================
// MARK: Private — Channel router
// ============================================================================

class CollectorSignalChannelRouter {
  public route(
    urgency: CollectorUrgencyLabel,
    tier: PressureTier,
    mode: 'solo' | 'pvp' | 'coop' | 'ghost',
    priority: CollectorSignalAdapterPriority,
    options: Required<CollectorSignalAdapterOptions>,
  ): CollectorSignalAdapterChannelRecommendation {
    if (priority === 'SUPPRESSED') return 'SUPPRESSED';

    const tierConfig: PressureTierConfig = PRESSURE_TIER_CONFIGS[tier];
    const modeProfile = COLLECTOR_MODE_PROFILES[mode];

    if (urgency === 'CRITICAL' || priority === 'INTERRUPT') {
      return 'GLOBAL';
    }

    if (tierConfig.allowsHaterInjection || (urgency === 'HIGH' && modeProfile.escalationThreshold <= 0.7)) {
      if (mode === 'coop' || mode === 'pvp') return 'SYNDICATE';
      return 'GLOBAL';
    }

    if (urgency === 'MEDIUM') {
      if (mode === 'coop') return 'SYNDICATE';
      return 'SYSTEM_SHADOW';
    }

    return options.suppressAmbientUrgency ? 'SUPPRESSED' : 'SYSTEM_SHADOW';
  }

  public buildHookForUrgency(
    urgency: CollectorUrgencyLabel,
    tier: PressureTier,
    dominantKey: PressurePositiveSignalKey | null,
  ): string {
    // Use per-tier hook map first; fallback to signal-specific hook
    const tierHook   = COLLECTOR_CHAT_HOOK_MAP[tier];
    const signalHook = dominantKey ? (COLLECTOR_SIGNAL_CHAT_HOOKS[dominantKey] ?? null) : null;
    return buildChatHook(urgency, tier, dominantKey) || signalHook || tierHook;
  }
}

// ============================================================================
// MARK: Private — Adapter ML vector builder
// ============================================================================

class CollectorAdapterMLVectorBuilder {
  private static readonly MAX_POSITIVE = PRESSURE_POSITIVE_SIGNAL_KEYS.length; // 17
  private static readonly MAX_RELIEF   = PRESSURE_RELIEF_SIGNAL_KEYS.length;   // 6
  private static readonly FEATURE_COUNT = 28; // 24 scalars + 17 positive + 6 relief - condensed

  public build(
    tick: number,
    snapshot: CollectorSnapshotCompat,
    collection: PressureSignalCollection,
    trend: CollectorTrendSummary | null,
    forecast: CollectorForecast | null,
    weights: PressureCollectorWeights,
  ): CollectorAdapterMLVector {
    const score    = collection.score;
    const tier     = resolvePressureTier(score);
    const band     = resolvePressureBand(score);
    const tierRank = rankPressureTier(tier);
    const urgency  = classifyUrgency(tier, trend?.velocity ?? 0, snapshot.consecutiveHighTierTicks ?? 0);

    const prevScore = snapshot.previousScore ?? score;
    const scoreDelta = score - prevScore;

    const stressIndex    = computeStressIndex(collection);
    const reliefBalance  = computeReliefBalance(collection);
    const modeScopeRatio = computeModeScopeRatio(collection);
    const escRisk        = computeEscalationRisk(score, trend?.velocity ?? 0, tier);
    const recProb        = computeRecoveryProbability(score, trend?.velocity ?? 0);
    const threatScore    = computeCollectorThreatScore(score, trend?.velocity ?? 0, tier, 'FOUNDATION');
    const resilienceScore = computeCollectorResilienceScore(score, trend?.velocity ?? 0, reliefBalance);

    const positiveFeatureVector = this.buildPositiveFeatureVector(collection, weights);
    const reliefFeatureVector   = this.buildReliefFeatureVector(collection, weights);

    const peakScore = snapshot.peakScore ?? score;
    const nextTierMin = this.computeEscalationProximity(score, tier);

    const riskScore = clampPressureScore(
      escRisk * 0.5 + stressIndex * 0.3 + (tierRank / 4) * 0.2,
    );

    const narrativeWeightScore = clampPressureScore(
      (tierRank / 4) * 0.4 + escRisk * 0.3 + stressIndex * 0.3,
    );

    return Object.freeze({
      tick,
      featureCount: CollectorAdapterMLVectorBuilder.FEATURE_COUNT,
      scoreNormalized:       clampPressureScore(score),
      tierRankNorm:          normalizeWeight(tierRank / 4),
      bandRankNorm:          normalizeWeight(rankPressureBand(band) / 4),
      scoreDeltaNorm:        clampPressureScore(Math.abs(scoreDelta)),
      isHighUrgency:         (urgency === 'HIGH' || urgency === 'CRITICAL') ? 1 : 0,
      isCriticalUrgency:     urgency === 'CRITICAL' ? 1 : 0,
      isSpike:               (trend?.isSpike ?? false) ? 1 : 0,
      isPlateau:             (trend?.isPlateau ?? false) ? 1 : 0,
      positiveSignalCountNorm: normalizeWeight(
        collection.contributions.length / CollectorAdapterMLVectorBuilder.MAX_POSITIVE,
      ),
      reliefSignalCountNorm: normalizeWeight(
        collection.reliefContributions.length / CollectorAdapterMLVectorBuilder.MAX_RELIEF,
      ),
      stressIndexNorm:         clampPressureScore(stressIndex),
      reliefBalanceNorm:       clampPressureScore(reliefBalance),
      escalationRiskNorm:      clampPressureScore(escRisk),
      recoveryProbNorm:        clampPressureScore(recProb),
      threatScoreNorm:         clampPressureScore(threatScore),
      resilienceScoreNorm:     clampPressureScore(resilienceScore),
      trendVelocityNorm:       clampPressureScore(Math.abs(trend?.velocity ?? 0) / DEFAULT_MAX_DECAY_PER_TICK),
      trendAccelerationNorm:   clampPressureScore(Math.abs(trend?.acceleration ?? 0) / DEFAULT_MAX_DECAY_PER_TICK),
      modeScopeRatioNorm:      clampPressureScore(modeScopeRatio),
      escalationProximityNorm: clampPressureScore(nextTierMin),
      modeCodeNorm:            this.encodeModeNorm(snapshot.mode),
      phaseCodeNorm:           this.encodePhaseNorm(snapshot.phase),
      positiveFeatureVector:   Object.freeze(positiveFeatureVector),
      reliefFeatureVector:     Object.freeze(reliefFeatureVector),
      riskScore:               clampPressureScore(riskScore),
      narrativeWeightScore:    clampPressureScore(narrativeWeightScore),
    });
  }

  public buildFullMLFeatureParams(
    snapshot: CollectorSnapshotCompat,
    collection: PressureSignalCollection,
    trend: CollectorTrendSummary | null,
    history: readonly CollectorHistoryEntry[],
  ): CollectorMLFeaturesParams {
    const tier     = resolvePressureTier(collection.score);
    const prevTier = snapshot.previousTier ?? tier;
    const band     = resolvePressureBand(collection.score);
    const prevBand = snapshot.previousBand ?? band;
    const velocity              = computeCollectorVelocity(history);
    const velocityWindowAvg     = computeCollectorVelocityAvg(history, COLLECTOR_TREND_WINDOW);
    const accelerationWindowAvg = computeCollectorAccelerationAvg(history, COLLECTOR_TREND_WINDOW);
    const modeScopeRatio        = computeModeScopeRatio(collection);

    return {
      collection,
      tier,
      prevTier,
      band,
      prevBand,
      tick:                     snapshot.tick,
      consecutiveHighTierTicks: snapshot.consecutiveHighTierTicks ?? 0,
      consecutiveCriticalTicks: snapshot.consecutiveCriticalTicks ?? 0,
      velocity:                 trend?.velocity ?? velocity,
      velocityWindowAvg,
      accelerationWindowAvg,
      modeScopeRatio,
    };
  }

  public buildDLRowParams(
    snapshot: CollectorSnapshotCompat,
    collection: PressureSignalCollection,
    history: readonly CollectorHistoryEntry[],
    peakScore: number,
    haterInjectionArmed: boolean,
    shieldDrainActive: boolean,
  ): CollectorDLRowParams {
    const tier     = resolvePressureTier(collection.score);
    const prevTier = snapshot.previousTier ?? tier;
    const band     = resolvePressureBand(collection.score);
    const prevBand = snapshot.previousBand ?? band;
    const velocity              = computeCollectorVelocity(history);
    const velocityWindowAvg     = computeCollectorVelocityAvg(history, COLLECTOR_TREND_WINDOW);
    const accelerationWindowAvg = computeCollectorAccelerationAvg(history, COLLECTOR_TREND_WINDOW);
    const modeScopeRatio        = computeModeScopeRatio(collection);

    return {
      collection,
      tier,
      prevTier,
      band,
      prevBand,
      tick:                     snapshot.tick,
      consecutiveHighTierTicks: snapshot.consecutiveHighTierTicks ?? 0,
      consecutiveCriticalTicks: snapshot.consecutiveCriticalTicks ?? 0,
      velocity,
      velocityWindowAvg,
      accelerationWindowAvg,
      modeScopeRatio,
      peakScore,
      haterInjectionArmed,
      shieldDrainActive,
      mode: ((snapshot as { mode?: string }).mode ?? 'solo') as 'solo' | 'pvp' | 'coop' | 'ghost',
      phase: ((snapshot as { phase?: string }).phase ?? 'FOUNDATION') as 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY',
    };
  }

  private buildPositiveFeatureVector(
    collection: PressureSignalCollection,
    weights: PressureCollectorWeights,
  ): number[] {
    const zeroMap: PressureSignalMap = createZeroPressureSignalMap();
    return PRESSURE_POSITIVE_SIGNAL_KEYS.map((key) => {
      const raw    = collection.pressureBreakdown[key] ?? zeroMap[key];
      const weight = weights[key] ?? DEFAULT_PRESSURE_COLLECTOR_WEIGHTS[key];
      return normalizeSignalByWeight(raw, weight);
    });
  }

  private buildReliefFeatureVector(
    collection: PressureSignalCollection,
    weights: PressureCollectorWeights,
  ): number[] {
    const zeroMap: PressureSignalMap = createZeroPressureSignalMap();
    return PRESSURE_RELIEF_SIGNAL_KEYS.map((key) => {
      const raw    = collection.reliefBreakdown[key] ?? zeroMap[key];
      const weight = weights[key] ?? DEFAULT_PRESSURE_COLLECTOR_WEIGHTS[key];
      return normalizeSignalByWeight(raw, weight);
    });
  }

  private computeEscalationProximity(score: number, tier: PressureTier): number {
    const rank     = rankPressureTier(tier);
    if (rank >= 4) return 1.0;
    const tiers: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
    const nextTier = tiers[rank + 1];
    if (!nextTier) return 1.0;
    const nextMin = getPressureTierMinScore(nextTier);
    const gap     = nextMin - score;
    return clampPressureScore(1.0 - Math.max(0, gap));
  }

  private encodeModeNorm(mode: 'solo' | 'pvp' | 'coop' | 'ghost'): number {
    switch (mode) {
      case 'solo':  return 0;
      case 'pvp':   return 0.33;
      case 'coop':  return 0.67;
      case 'ghost': return 1.0;
    }
  }

  private encodePhaseNorm(phase: 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY'): number {
    switch (phase) {
      case 'FOUNDATION':  return 0;
      case 'ESCALATION':  return 0.5;
      case 'SOVEREIGNTY': return 1.0;
    }
  }
}

// ============================================================================
// MARK: Private — Adapter analytics tracker
// ============================================================================

class CollectorAdapterAnalytics {
  private totalAdapted              = 0;
  private totalRejected             = 0;
  private totalDeduped              = 0;
  private lastAdaptedTick:          number | null = null;
  private lastUrgencySeen:          CollectorUrgencyLabel | null = null;
  private lastTierSeen:             PressureTier | null = null;
  private lastBandSeen:             PressureBand | null = null;
  private lastScoreSeen:            number | null = null;
  private consecutiveHighUrgency    = 0;
  private consecutiveCritical       = 0;
  private criticalEnterCount        = 0;
  private reliefDominantCount       = 0;
  private mlEmitCount               = 0;
  private dlEmitCount               = 0;
  private cumulativeThreatScore     = 0;
  private cumulativeResilienceScore = 0;
  private adaptedCountForAvg        = 0;

  private readonly urgencyCounts: Record<CollectorUrgencyLabel, number> = {
    CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, AMBIENT: 0,
  };
  private readonly tierCounts: Record<PressureTier, number> = {
    T0: 0, T1: 0, T2: 0, T3: 0, T4: 0,
  };
  private readonly bandCounts: Record<PressureBand, number> = {
    CALM: 0, BUILDING: 0, ELEVATED: 0, HIGH: 0, CRITICAL: 0,
  };
  private readonly categoryTotals  = new Map<string, number>();
  private readonly driverCounts    = new Map<string, number>();
  private readonly reliefCounts    = new Map<string, number>();
  private readonly scoreHistory:   CollectorHistoryEntry[] = [];

  private readonly dedupeWindowTicks: number;
  private readonly weights: PressureCollectorWeights;

  public constructor(dedupeWindowTicks: number, weights: PressureCollectorWeights) {
    this.dedupeWindowTicks = dedupeWindowTicks;
    this.weights           = weights;
  }

  public recordAdapted(
    tick:       number,
    urgency:    CollectorUrgencyLabel,
    tier:       PressureTier,
    band:       PressureBand,
    score:      number,
    collection: PressureSignalCollection,
    eventName:  CollectorSignalAdapterEventName,
    velocity:   number,
  ): void {
    this.totalAdapted++;
    this.lastAdaptedTick   = tick;
    this.lastUrgencySeen   = urgency;
    this.lastTierSeen      = tier;
    this.lastBandSeen      = band;
    this.lastScoreSeen     = score;

    if (urgency === 'HIGH' || urgency === 'CRITICAL') {
      this.consecutiveHighUrgency++;
    } else {
      this.consecutiveHighUrgency = 0;
    }

    if (urgency === 'CRITICAL') {
      this.consecutiveCritical++;
    } else {
      this.consecutiveCritical = 0;
    }

    if (eventName === 'collector.urgency.critical') this.criticalEnterCount++;
    if (eventName === 'collector.relief.dominant')   this.reliefDominantCount++;

    this.urgencyCounts[urgency]++;
    this.tierCounts[tier]++;
    this.bandCounts[band]++;

    // Tier and band crossing analysis for statistics
    computeTierCrossing(tier, tier); // structural usage for crossing type resolution
    computeBandCrossing(band, band);

    // Mode-adjusted stress and threat/resilience accumulation
    const modeStress = computeModeAdjustedStressIndex(collection, 'solo');
    const threat     = computeCollectorThreatScore(collection.score, velocity, tier, 'FOUNDATION');
    const resilience = computeCollectorResilienceScore(collection.score, velocity, computeReliefBalance(collection));

    this.cumulativeThreatScore     += threat;
    this.cumulativeResilienceScore += resilience;
    this.adaptedCountForAvg++;
    void modeStress; // reserved for mode-aware reporting

    // Signal category breakdown
    for (const [category, keys] of Object.entries(COLLECTOR_SIGNAL_CATEGORIES)) {
      const categoryTotal = (keys as readonly string[]).reduce((sum, k) => {
        const key = k as PressurePositiveSignalKey;
        return sum + (collection.pressureBreakdown[key] ?? 0);
      }, 0);
      this.categoryTotals.set(category, (this.categoryTotals.get(category) ?? 0) + categoryTotal);
    }

    // Driver tracking
    for (const c of collection.contributions) {
      this.driverCounts.set(c.key, (this.driverCounts.get(c.key) ?? 0) + 1);
    }
    for (const c of collection.reliefContributions) {
      this.reliefCounts.set(c.key, (this.reliefCounts.get(c.key) ?? 0) + 1);
    }

    // History ring buffer — capped at PRESSURE_HISTORY_DEPTH (not COLLECTOR_HISTORY_DEPTH)
    // to provide a broader view across the entire run for the analytics layer
    const entry = buildCollectorHistoryEntry({ collection, tier, band, tick });
    this.scoreHistory.push(entry);
    if (this.scoreHistory.length > PRESSURE_HISTORY_DEPTH) {
      this.scoreHistory.shift();
    }
  }

  public recordRejected():  void { this.totalRejected++; }
  public recordDeduped():   void { this.totalDeduped++; }
  public recordMLEmit():    void { this.mlEmitCount++; }
  public recordDLEmit():    void { this.dlEmitCount++; }

  public getState(): CollectorSignalAdapterState {
    const n = this.adaptedCountForAvg;
    return Object.freeze({
      totalAdapted:               this.totalAdapted,
      totalRejected:              this.totalRejected,
      totalDeduped:               this.totalDeduped,
      lastAdaptedTick:            this.lastAdaptedTick,
      lastUrgencySeen:            this.lastUrgencySeen,
      lastTierSeen:               this.lastTierSeen,
      lastBandSeen:               this.lastBandSeen,
      lastScoreSeen:              this.lastScoreSeen,
      consecutiveHighUrgencyTicks: this.consecutiveHighUrgency,
      consecutiveCriticalTicks:   this.consecutiveCritical,
      criticalEnterCount:         this.criticalEnterCount,
      reliefDominantCount:        this.reliefDominantCount,
      dedupeWindowTicks:          this.dedupeWindowTicks,
      mlEmitCount:                this.mlEmitCount,
      dlEmitCount:                this.dlEmitCount,
      threatScoreAvg:             n > 0 ? this.cumulativeThreatScore / n : 0,
      resilienceScoreAvg:         n > 0 ? this.cumulativeResilienceScore / n : 0,
    });
  }

  public getReport(): CollectorSignalAdapterReport {
    const avgScore  = computeRunningAvgScore(this.scoreHistory);
    const stdDev    = computeScoreStdDev(this.scoreHistory);
    const maxScore  = this.scoreHistory.length > 0 ? Math.max(...this.scoreHistory.map((e) => e.score)) : 0;
    const minScore  = this.scoreHistory.length > 0 ? Math.min(...this.scoreHistory.map((e) => e.score)) : 0;

    const topDrivers = rankTopContributors(
      [...this.driverCounts.entries()].map(([key, amount]) => ({
        key: key as PressureSignalKey,
        amount,
        weight: DEFAULT_PRESSURE_COLLECTOR_WEIGHTS[key as PressureSignalKey] ?? 0,
        normalizedAmount: amount,
        label: key,
        isRelief: false,
        modeScoped: false,
        polarity: 'PRESSURE' as const,
        reason: key,
      }) as unknown as PressureSignalContribution),
      TOP_PRESSURE_SIGNAL_COUNT,
    ).map((c) => c.key as string);

    const topRelief = rankTopContributors(
      [...this.reliefCounts.entries()].map(([key, amount]) => ({
        key: key as PressureSignalKey,
        amount,
        weight: DEFAULT_PRESSURE_COLLECTOR_WEIGHTS[key as PressureSignalKey] ?? 0,
        normalizedAmount: amount,
        label: key,
        isRelief: true,
        modeScoped: false,
        polarity: 'RELIEF' as const,
        reason: key,
      }) as unknown as PressureSignalContribution),
      TOP_PRESSURE_SIGNAL_COUNT,
    ).map((c) => c.key as string);

    const weightSummary = Object.freeze(
      Object.fromEntries(
        PRESSURE_SIGNAL_KEYS.map((key) => [key, DEFAULT_PRESSURE_COLLECTOR_WEIGHTS[key]]),
      ) as Record<PressureSignalKey, number>,
    );

    const categoryBreakdown = Object.freeze(
      Object.fromEntries(this.categoryTotals.entries()),
    ) as Record<string, number>;

    const validationResult = validateCollectorWeights(this.weights);

    return Object.freeze({
      version:                COLLECTOR_SIGNAL_ADAPTER_VERSION,
      collectorVersion:       COLLECTOR_MODULE_VERSION,
      state:                  this.getState(),
      urgencyDistribution:    Object.freeze({ ...this.urgencyCounts }),
      tierDistribution:       Object.freeze({ ...this.tierCounts }),
      bandDistribution:       Object.freeze({ ...this.bandCounts }),
      topPressureDrivers:     Object.freeze(topDrivers),
      topReliefDrivers:       Object.freeze(topRelief),
      averageScore:           avgScore,
      maxScoreSeen:           maxScore,
      minScoreSeen:           minScore,
      scoreStdDev:            stdDev,
      mlFeatureCount:         COLLECTOR_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
      dlFeatureCount:         COLLECTOR_SIGNAL_ADAPTER_DL_FEATURE_COUNT,
      defaultWeightSummary:   weightSummary,
      defaultLimitSummary:    DEFAULT_PRESSURE_COLLECTOR_LIMITS,
      signalCategoryBreakdown: categoryBreakdown,
      validationResult,
    });
  }

  public getHistory(): readonly CollectorHistoryEntry[] {
    return Object.freeze([...this.scoreHistory]);
  }

  public reset(): void {
    this.totalAdapted              = 0;
    this.totalRejected             = 0;
    this.totalDeduped              = 0;
    this.lastAdaptedTick           = null;
    this.lastUrgencySeen           = null;
    this.lastTierSeen              = null;
    this.lastBandSeen              = null;
    this.lastScoreSeen             = null;
    this.consecutiveHighUrgency    = 0;
    this.consecutiveCritical       = 0;
    this.criticalEnterCount        = 0;
    this.reliefDominantCount       = 0;
    this.mlEmitCount               = 0;
    this.dlEmitCount               = 0;
    this.cumulativeThreatScore     = 0;
    this.cumulativeResilienceScore = 0;
    this.adaptedCountForAvg        = 0;
    this.scoreHistory.length       = 0;
    this.driverCounts.clear();
    this.reliefCounts.clear();
    this.categoryTotals.clear();
    for (const u of Object.keys(this.urgencyCounts) as CollectorUrgencyLabel[]) {
      this.urgencyCounts[u] = 0;
    }
    for (const t of Object.keys(this.tierCounts) as PressureTier[]) {
      this.tierCounts[t] = 0;
    }
    for (const b of Object.keys(this.bandCounts) as PressureBand[]) {
      this.bandCounts[b] = 0;
    }
  }
}

// ============================================================================
// MARK: Private — Companion orchestrator (7 companion classes)
// ============================================================================

/**
 * CollectorAdapterCompanion owns the 7 companion class instances and provides
 * the enriched analysis pipeline used by CollectorSignalAdapter.
 *
 * - CollectorMLExtractor  — history-aware 48-feature ML vector ring buffer
 * - CollectorDLBuilder    — 64-feature × 8-tick DL sequence tensor
 * - CollectorTrendAnalyzer — velocity, acceleration, spike, plateau detection
 * - CollectorForecaster   — tick-horizon score and tier projection
 * - CollectorAnnotator    — annotation bundles and UX hints
 * - CollectorInspector    — diagnostic state, watermark, crossing tracking
 * - CollectorAnalytics    — lifetime running statistics
 */
class CollectorAdapterCompanion {
  private readonly mlExtractor:  CollectorMLExtractor;
  private readonly dlBuilder:    CollectorDLBuilder;
  private readonly trendAnalyzer: CollectorTrendAnalyzer;
  private readonly forecaster:   CollectorForecaster;
  private readonly annotator:    CollectorAnnotator;
  private readonly inspector:    CollectorInspector;
  private readonly analytics:    CollectorAnalytics;
  private readonly collector:    PressureSignalCollector;
  private readonly weights:      PressureCollectorWeights;
  private watermark:             CollectorWatermark | null = null;
  private mlExtractCount         = 0;
  private dlBuildCount           = 0;

  public constructor(customWeights?: Partial<PressureCollectorWeights>) {
    this.weights  = mergePressureCollectorWeights(DEFAULT_PRESSURE_COLLECTOR_WEIGHTS, customWeights ?? {});
    this.collector = new PressureSignalCollector(this.weights);
    this.mlExtractor  = new CollectorMLExtractor(this.collector);
    this.dlBuilder    = new CollectorDLBuilder(this.mlExtractor);
    this.trendAnalyzer = new CollectorTrendAnalyzer();
    this.forecaster   = new CollectorForecaster();
    this.annotator    = new CollectorAnnotator();
    this.inspector    = new CollectorInspector(COLLECTOR_MODULE_VERSION);
    this.analytics    = new CollectorAnalytics(this.weights);
  }

  /** Analyze a history slice and return the full trend summary. */
  public analyzeTrend(history: readonly CollectorHistoryEntry[]): CollectorTrendSummary {
    return this.trendAnalyzer.analyze(history);
  }

  /** Classify the trend label from windowed velocity + flags. */
  public classifyTrendLabel(
    velocityAvg: number,
    accelAvg:    number,
    isSpike:     boolean,
    isPlateau:   boolean,
  ): CollectorTrendLabel {
    return this.trendAnalyzer.classifyTrendLabel(velocityAvg, accelAvg, isSpike, isPlateau);
  }

  /** Build forecast from params; uses CollectorForecaster.forecast(). */
  public buildForecast(params: CollectorForecastParams): CollectorForecast {
    return this.forecaster.forecast(params);
  }

  /** Build phase-adjusted forecast with escalation / recovery adjustment. */
  public buildPhaseAdjustedForecast(
    currentScore:    number,
    currentTier:     PressureTier,
    velocity:        number,
    acceleration:    number,
    phase:           'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY',
    maxDecayPerTick: number = DEFAULT_MAX_DECAY_PER_TICK,
  ): CollectorForecast & { readonly phaseAdjustedEscalationRisk: number; readonly phaseAdjustedRecoveryProbability: number } {
    return this.forecaster.forecastWithPhase(
      currentScore, currentTier, velocity, acceleration, phase, maxDecayPerTick,
    );
  }

  /** Build full annotation bundle. */
  public buildAnnotation(params: CollectorAnnotationParams): CollectorAnnotationBundle {
    return this.annotator.annotate(params);
  }

  /** Build UX hint for companion display and channel routing. */
  public buildUXHint(
    urgency:    CollectorUrgencyLabel,
    tier:       PressureTier,
    collection: PressureSignalCollection,
    forecast:   CollectorForecast,
  ): CollectorUXHint {
    return this.annotator.buildUXHint(urgency, tier, collection, forecast);
  }

  /** Classify urgency from raw score. */
  public classifyUrgency(score: number): CollectorUrgencyLabel {
    return this.annotator.classifyCurrentUrgency(score);
  }

  /** Get escalation alert level ('HIGH' | 'MEDIUM' | 'NONE'). */
  public getEscalationAlertLevel(risk: number): 'HIGH' | 'MEDIUM' | 'NONE' {
    return this.annotator.getEscalationAlertLevel(risk);
  }

  /** Returns true when recovery probability is strong. */
  public isRecoveryStrong(prob: number): boolean {
    return this.annotator.isRecoveryStrong(prob);
  }

  /** Build a DL tensor directly from collection data via CollectorDLBuilder. */
  public buildDLTensor(
    collection:          PressureSignalCollection,
    tick:                number,
    mode:                'solo' | 'pvp' | 'coop' | 'ghost',
    phase:               'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY',
    peakScore:           number,
    haterInjectionArmed: boolean,
    shieldDrainActive:   boolean,
  ): CollectorDLTensor {
    const tensor = this.dlBuilder.build(
      collection, tick, mode, phase, peakScore, haterInjectionArmed, shieldDrainActive,
    );
    this.dlBuildCount++;
    return tensor;
  }

  /** Update inspector crossing state. */
  public updateInspector(
    prevTier: PressureTier,
    newTier:  PressureTier,
    prevBand: PressureBand,
    newBand:  PressureBand,
  ): void {
    this.inspector.update(prevTier, newTier, prevBand, newBand);
  }

  /** Get the full inspector state snapshot. */
  public getInspectorState(
    history:      readonly CollectorHistoryEntry[],
    tick:         number,
    trendSummary: CollectorTrendSummary | null,
    forecast:     CollectorForecast | null,
  ): CollectorInspectorState {
    return this.inspector.inspect(
      history,
      this.watermark,
      this.mlExtractCount,
      this.dlBuildCount,
      tick,
      trendSummary,
      forecast,
    );
  }

  /** Update analytics with a new history entry. */
  public updateAnalytics(
    entry:    CollectorHistoryEntry,
    mode:     'solo' | 'pvp' | 'coop' | 'ghost',
    phase:    'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY',
    velocity: number,
  ): void {
    this.analytics.update(entry, mode, phase, velocity);
  }

  /** Get the lifetime analytics summary. */
  public getAnalyticsSummary(): CollectorAnalyticsSummary {
    return this.analytics.getSummary();
  }

  /** Get health state from the analytics tracker. */
  public getHealthState(): CollectorHealthState {
    return (this.analytics as unknown as { getHealthState(): CollectorHealthState }).getHealthState();
  }

  /** Get mode profile for companion context. */
  public getModeProfile(mode: 'solo' | 'pvp' | 'coop' | 'ghost'): CollectorModeProfile {
    return this.annotator.getModeProfile(mode);
  }

  /** Get phase profile for companion context. */
  public getPhaseProfile(phase: 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY'): CollectorPhaseProfile {
    return this.annotator.getPhaseProfile(phase);
  }

  /** Update the peak score watermark. */
  public updateWatermark(score: number, tick: number): void {
    if (!this.watermark || score > this.watermark.score) {
      this.watermark = Object.freeze({ score, tick } as CollectorWatermark);
    }
  }

  /** Returns the current watermark. */
  public getWatermark(): CollectorWatermark | null {
    return this.watermark;
  }

  /** Get the full ensemble (for external consumers). */
  public getEnsemble(): CollectorEnsemble {
    return (createPressureCollectorWithAnalytics({
      weights: this.weights,
    }) as unknown as { ensemble?: CollectorEnsemble }).ensemble ?? {
      collector:  this.collector,
      extractor:  this.mlExtractor,
      dlBuilder:  this.dlBuilder,
      analyzer:   this.trendAnalyzer,
      forecaster: this.forecaster,
      annotator:  this.annotator,
      inspector:  this.inspector,
      analytics:  this.analytics,
      version:    COLLECTOR_MODULE_VERSION,
    };
  }

  /** Get the top relief signal key from the collection. */
  public getReliefPriority(collection: PressureSignalCollection): PressureReliefSignalKey | null {
    return this.annotator.getReliefPriority(collection);
  }

  /** Get tier chat hooks for routing decisions. */
  public getTierChatHooks(): Readonly<Record<PressureTier, string>> {
    return this.annotator.getTierChatHooks();
  }

  /** Get signal chat hooks for dominant-driver routing. */
  public getSignalChatHooks(): Readonly<Record<PressurePositiveSignalKey, string>> {
    return this.annotator.getSignalChatHooks();
  }

  /** Increment ML extract count. */
  public incrementMLExtractCount(): void { this.mlExtractCount++; }
}

// ============================================================================
// MARK: CollectorSignalAdapter — main class
// ============================================================================

/**
 * CollectorSignalAdapter translates authoritative PressureSignalCollector
 * state into backend-chat-native collector signals.
 *
 * Usage:
 *   const adapter = new CollectorSignalAdapter({ defaultRoomId: '...' });
 *   const artifacts = adapter.adapt(input, context);
 *   const mlVec = adapter.extractMLVector(input);
 *   const report = adapter.getReport();
 */
export class CollectorSignalAdapter {
  private readonly options: Required<CollectorSignalAdapterOptions>;
  private readonly deduplicator:         CollectorSignalDeduplicator;
  private readonly priorityClassifier  = new CollectorSignalPriorityClassifier();
  private readonly narrativeWeighter   = new CollectorSignalNarrativeWeighter();
  private readonly channelRouter       = new CollectorSignalChannelRouter();
  private readonly mlVectorBuilder     = new CollectorAdapterMLVectorBuilder();
  private readonly analytics:            CollectorAdapterAnalytics;
  private readonly companion:            CollectorAdapterCompanion;

  private readonly historyLog:    CollectorSignalAdapterHistoryEntry[] = [];
  private readonly rejectionLog:  CollectorSignalAdapterRejection[] = [];
  private readonly collectorHistory: CollectorHistoryEntry[] = [];
  private resolvedWeights:         PressureCollectorWeights;

  public constructor(options: CollectorSignalAdapterOptions) {
    const dedupeWindowTicks =
      options.dedupeWindowTicks ?? COLLECTOR_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS;

    this.resolvedWeights = mergePressureCollectorWeights(
      DEFAULT_PRESSURE_COLLECTOR_WEIGHTS,
      options.customWeights ?? {},
    );

    this.options = {
      defaultRoomId:         options.defaultRoomId,
      defaultVisibleChannel: options.defaultVisibleChannel ?? 'GLOBAL',
      suppressAmbientUrgency: options.suppressAmbientUrgency ?? false,
      dedupeWindowTicks,
      maxBatchSize:          options.maxBatchSize ?? COLLECTOR_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
      enableMLEmit:          options.enableMLEmit ?? true,
      enableDLEmit:          options.enableDLEmit ?? false,
      customWeights:         options.customWeights ?? {},
      logger:                options.logger ?? this.buildNoopLogger(),
      clock:                 options.clock ?? { now: () => asUnixMs(Date.now()) },
    };

    this.deduplicator = new CollectorSignalDeduplicator(dedupeWindowTicks);
    this.analytics    = new CollectorAdapterAnalytics(dedupeWindowTicks, this.resolvedWeights);
    this.companion    = new CollectorAdapterCompanion(options.customWeights);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PUBLIC CONTRACT — adapt, batch, extract
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Primary ingestion method — translate one tick of collector truth into
   * an array of backend-chat artifacts.
   */
  public adapt(
    input:    CollectorSignalInput,
    context?: CollectorSignalAdapterContext,
  ): readonly CollectorSignalAdapterArtifact[] {
    const { snapshot, collection } = input;
    const { tick, mode, phase } = snapshot;
    const score    = collection.score;
    const tier     = resolvePressureTier(score);
    const band     = resolvePressureBand(score);
    const nowMs    = this.options.clock.now();

    // Resolve urgency from annotation bundle or classify directly
    const urgency: CollectorUrgencyLabel =
      input.annotation?.urgencyLabel ??
      this.companion.classifyUrgency(score);

    // Get or compute trend summary
    const trend: CollectorTrendSummary =
      input.trendSummary ??
      this.companion.analyzeTrend(this.collectorHistory);

    // Build history entry for this tick
    const historyEntry = buildCollectorHistoryEntry({ collection, tier, band, tick });
    this.pushCollectorHistory(historyEntry);
    this.companion.updateWatermark(score, tick);

    // Update companion inspector
    const prevTier = snapshot.previousTier ?? tier;
    const prevBand = snapshot.previousBand ?? band;
    this.companion.updateInspector(prevTier, tier, prevBand, band);

    // Update companion analytics
    this.companion.updateAnalytics(historyEntry, mode, phase, trend.velocity);

    // Build chat signal compat
    const chatSignal = this.buildChatSignalCompat(snapshot, collection, tier, band, urgency, trend);

    // Build adapter ML vector
    const adapterMLVector = this.mlVectorBuilder.build(
      tick, snapshot, collection, trend,
      input.forecast ?? null,
      this.resolvedWeights,
    );

    const artifacts: CollectorSignalAdapterArtifact[] = [];

    // ── Urgency events ──────────────────────────────────────────────────────
    if (urgency === 'CRITICAL') {
      artifacts.push(
        this.buildArtifact('collector.urgency.critical', tick, urgency, tier, band, chatSignal, adapterMLVector, input, context, nowMs),
      );
    } else if (urgency === 'HIGH') {
      artifacts.push(
        this.buildArtifact('collector.urgency.high', tick, urgency, tier, band, chatSignal, adapterMLVector, input, context, nowMs),
      );
    } else if (urgency === 'MEDIUM') {
      artifacts.push(
        this.buildArtifact('collector.urgency.medium', tick, urgency, tier, band, chatSignal, adapterMLVector, input, context, nowMs),
      );
    }

    // ── Tier change events ──────────────────────────────────────────────────
    if (prevTier !== tier) {
      const isEsc = rankPressureTier(tier) > rankPressureTier(prevTier);
      artifacts.push(
        this.buildArtifact(
          isEsc ? 'collector.tier.escalated' : 'collector.tier.deescalated',
          tick, urgency, tier, band, chatSignal, adapterMLVector, input, context, nowMs,
        ),
      );
    }

    // ── Band change events (tier unchanged) ─────────────────────────────────
    if (prevBand !== band && prevTier === tier) {
      const isEsc = rankPressureBand(band) > rankPressureBand(prevBand);
      artifacts.push(
        this.buildArtifact(
          isEsc ? 'collector.band.escalated' : 'collector.band.deescalated',
          tick, urgency, tier, band, chatSignal, adapterMLVector, input, context, nowMs,
        ),
      );
    }

    // ── Spike detection ─────────────────────────────────────────────────────
    if (trend.isSpike) {
      artifacts.push(
        this.buildArtifact('collector.spike.detected', tick, urgency, tier, band, chatSignal, adapterMLVector, input, context, nowMs),
      );
    }

    // ── Plateau at high tier ────────────────────────────────────────────────
    if (trend.isPlateau && rankPressureTier(tier) >= 2) {
      artifacts.push(
        this.buildArtifact('collector.plateau.high', tick, urgency, tier, band, chatSignal, adapterMLVector, input, context, nowMs),
      );
    }

    // ── Relief dominant ──────────────────────────────────────────────────────
    if (chatSignal.dominantReliefKey !== null && collection.rawReliefScore > collection.rawPositiveScore * 0.6) {
      artifacts.push(
        this.buildArtifact('collector.relief.dominant', tick, urgency, tier, band, chatSignal, adapterMLVector, input, context, nowMs),
      );
    }

    // ── Trend events ────────────────────────────────────────────────────────
    if (trend.trendLabel === 'RISING' && trend.velocity > 0.02) {
      artifacts.push(
        this.buildArtifact('collector.trend.rising', tick, urgency, tier, band, chatSignal, adapterMLVector, input, context, nowMs),
      );
    } else if (trend.trendLabel === 'FALLING' && trend.velocity < -0.02) {
      artifacts.push(
        this.buildArtifact('collector.trend.falling', tick, urgency, tier, band, chatSignal, adapterMLVector, input, context, nowMs),
      );
    }

    // ── Escalation risk high ────────────────────────────────────────────────
    if (chatSignal.escalationRisk >= COLLECTOR_ESCALATION_RISK_HIGH) {
      artifacts.push(
        this.buildArtifact('collector.escalation.risk.high', tick, urgency, tier, band, chatSignal, adapterMLVector, input, context, nowMs),
      );
    }

    // ── Recovery strong ─────────────────────────────────────────────────────
    if (chatSignal.recoveryProbability >= COLLECTOR_RECOVERY_PROB_HIGH) {
      artifacts.push(
        this.buildArtifact('collector.recovery.strong', tick, urgency, tier, band, chatSignal, adapterMLVector, input, context, nowMs),
      );
    }

    // ── New watermark ───────────────────────────────────────────────────────
    const watermark = this.companion.getWatermark();
    if (watermark && score >= watermark.score && (this.analytics.getState().lastScoreSeen ?? -1) < score) {
      artifacts.push(
        this.buildArtifact('collector.watermark.new', tick, urgency, tier, band, chatSignal, adapterMLVector, input, context, nowMs),
      );
    }

    // ── Mode escalation threshold ────────────────────────────────────────────
    if (score >= COLLECTOR_MODE_PROFILES[mode].escalationThreshold) {
      artifacts.push(
        this.buildArtifact('collector.mode.escalation.threshold', tick, urgency, tier, band, chatSignal, adapterMLVector, input, context, nowMs),
      );
    }

    // ── Phase danger floor ───────────────────────────────────────────────────
    const phaseProf = COLLECTOR_PHASE_PROFILES[phase];
    if (rankPressureTier(tier) >= rankPressureTier(phaseProf.dangerFloorTier)) {
      artifacts.push(
        this.buildArtifact('collector.phase.danger.floor', tick, urgency, tier, band, chatSignal, adapterMLVector, input, context, nowMs),
      );
    }

    // ── ML emit ─────────────────────────────────────────────────────────────
    if (this.options.enableMLEmit && input.mlVector) {
      artifacts.push(
        this.buildArtifact('collector.ml.emit', tick, urgency, tier, band, chatSignal, adapterMLVector, input, context, nowMs),
      );
      this.analytics.recordMLEmit();
      this.companion.incrementMLExtractCount();
    }

    // ── DL emit ─────────────────────────────────────────────────────────────
    if (this.options.enableDLEmit && input.dlTensor) {
      artifacts.push(
        this.buildArtifact('collector.dl.emit', tick, urgency, tier, band, chatSignal, adapterMLVector, input, context, nowMs),
      );
      this.analytics.recordDLEmit();
    }

    // Record analytics for accepted artifacts
    const accepted = artifacts.some((a) => a.accepted);
    if (accepted) {
      const firstAccepted = artifacts.find((a) => a.accepted);
      this.analytics.recordAdapted(
        tick, urgency, tier, band, score, collection,
        firstAccepted?.eventName ?? 'collector.urgency.medium',
        trend.velocity,
      );
    }

    this.recordHistory(tick, urgency, tier, band, score, artifacts);
    return Object.freeze(artifacts);
  }

  /**
   * Batch-adapt multiple collector inputs (e.g. replayed ticks).
   */
  public adaptBatch(
    inputs:   readonly CollectorSignalInput[],
    context?: CollectorSignalAdapterContext,
  ): readonly CollectorSignalAdapterArtifact[] {
    const limited = inputs.slice(0, this.options.maxBatchSize);
    const all: CollectorSignalAdapterArtifact[] = [];
    for (const input of limited) {
      const artifacts = this.adapt(input, context);
      all.push(...artifacts);
    }
    return Object.freeze(all);
  }

  /**
   * Extract the chat-lane ML vector for the online inference pipeline.
   * Includes the 48-feature collector ML vector plus chat-specific scoring.
   */
  public extractMLVector(input: CollectorSignalInput): CollectorMLVectorCompat {
    const { snapshot, collection } = input;
    const score    = collection.score;
    const tier     = resolvePressureTier(score);
    const band     = resolvePressureBand(score);
    const tierRank = rankPressureTier(tier);
    const bandRank = rankPressureBand(band);
    const urgency  = input.annotation?.urgencyLabel ??
      this.companion.classifyUrgency(score);

    const trend = input.trendSummary ??
      this.companion.analyzeTrend(this.collectorHistory);

    const adapterMLVec = this.mlVectorBuilder.build(
      snapshot.tick, snapshot, collection, trend,
      input.forecast ?? null,
      this.resolvedWeights,
    );

    // Build full 48-feature vector via extractCollectorMLFeatures
    const mlParams = this.mlVectorBuilder.buildFullMLFeatureParams(snapshot, collection, trend, this.collectorHistory);
    const rawFeatures = extractCollectorMLFeatures(mlParams);

    const escalationRisk = computeEscalationRisk(score, trend.velocity, tier);
    const recoveryProb   = computeRecoveryProbability(score, trend.velocity);
    const stressIndex    = computeStressIndex(collection);
    const reliefBalance  = computeReliefBalance(collection);
    const threatScore    = computeCollectorThreatScore(score, trend.velocity, tier, snapshot.phase ?? 'FOUNDATION');
    const resilienceScore = computeCollectorResilienceScore(score, trend.velocity, reliefBalance);

    const riskScore: Score01    = clamp01(adapterMLVec.riskScore) as Score01;
    const percentScore: Score100 = clamp100(scoreToPercentage(score)) as Score100;

    const narrativeWeight = this.narrativeWeighter.score(
      'collector.ml.emit',
      urgency,
      tier,
      band,
      trend,
      snapshot.phase,
    );

    return Object.freeze({
      tick:              snapshot.tick,
      featureCount:      COLLECTOR_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
      features:          Object.freeze(rawFeatures),
      featureLabels:     COLLECTOR_ML_FEATURE_LABELS,
      scoreNormalized:   adapterMLVec.scoreNormalized,
      tierRank,
      bandRank,
      urgency,
      trendLabel:        trend.trendLabel,
      isHighUrgency:     urgency === 'HIGH' || urgency === 'CRITICAL',
      isCriticalUrgency: urgency === 'CRITICAL',
      trendVelocity:     trend.velocity,
      trendAcceleration: trend.acceleration,
      escalationRisk,
      recoveryProbability: recoveryProb,
      stressIndex,
      reliefBalance,
      threatScore,
      resilienceScore,
      riskScore,
      percentScore,
      narrativeWeight,
    });
  }

  /**
   * Build a DL tensor compat for the sequence model pipeline.
   */
  public buildDLTensorCompat(input: CollectorSignalInput): CollectorDLTensorCompat {
    const { snapshot, collection } = input;
    const tier     = resolvePressureTier(collection.score);
    const band     = resolvePressureBand(collection.score);
    const tierRank = rankPressureTier(tier);
    const bandRank = rankPressureBand(band);
    const urgency  = input.annotation?.urgencyLabel ?? this.companion.classifyUrgency(collection.score);

    const peakScore           = snapshot.peakScore ?? collection.score;
    const haterInjectionArmed = PRESSURE_TIER_CONFIGS[tier].allowsHaterInjection;
    const shieldDrainActive   = PRESSURE_TIER_CONFIGS[tier].passiveShieldDrain;

    // Use CollectorDLBuilder via companion for full sequence tensor
    const dlTensor: CollectorDLTensor = this.companion.buildDLTensor(
      collection, snapshot.tick, snapshot.mode, snapshot.phase,
      peakScore, haterInjectionArmed, shieldDrainActive,
    );

    // Also build the DL row via pure function for the compat shape
    const dlParams = this.mlVectorBuilder.buildDLRowParams(
      snapshot, collection, this.collectorHistory, peakScore,
      haterInjectionArmed, shieldDrainActive,
    );
    const currentFrame = buildCollectorDLRow(dlParams);

    // Tier one-hot: T0=00001, T1=00010, T2=00100, T3=01000, T4=10000
    const tierOneHot = ['T0', 'T1', 'T2', 'T3', 'T4'].map((t) => t === tier ? 1 : 0);
    const bandOneHot = ['CALM', 'BUILDING', 'ELEVATED', 'HIGH', 'CRITICAL'].map((b) => b === band ? 1 : 0);
    const urgencyOneHot = ['AMBIENT', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((u) => u === urgency ? 1 : 0);

    return Object.freeze({
      tick:               snapshot.tick,
      sequenceLength:     COLLECTOR_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH,
      featureCount:       COLLECTOR_SIGNAL_ADAPTER_DL_FEATURE_COUNT,
      featureLabels:      COLLECTOR_DL_FEATURE_LABELS,
      inputSequenceFlat:  Object.freeze(dlTensor.rows.flat()),
      currentFrame:       Object.freeze(currentFrame),
      tierOneHot:         Object.freeze(tierOneHot),
      bandOneHot:         Object.freeze(bandOneHot),
      urgencyOneHot:      Object.freeze(urgencyOneHot),
      tierRank,
      bandRank,
    } as unknown as CollectorDLTensorCompat);
  }

  /**
   * Build a forecast compat with phase-adjusted risk metrics.
   */
  public buildForecastCompat(input: CollectorSignalInput): CollectorForecastCompat {
    const { snapshot, collection } = input;
    const score    = collection.score;
    const tier     = resolvePressureTier(score);
    const trend    = input.trendSummary ?? this.companion.analyzeTrend(this.collectorHistory);
    const velocity = trend.velocity;
    const accel    = trend.acceleration;

    const forecastParams: CollectorForecastParams = {
      currentScore:    score,
      currentTier:     tier,
      velocity,
      acceleration:    accel,
      maxDecayPerTick: DEFAULT_MAX_DECAY_PER_TICK,
    };

    const baseForecast = input.forecast ?? this.companion.buildForecast(forecastParams);

    const phaseAdj = this.companion.buildPhaseAdjustedForecast(
      score, tier, velocity, accel, snapshot.phase,
    );

    const phaseAdjEscRisk = computePhaseAdjustedEscalationRisk(score, velocity, tier, snapshot.phase);
    const phaseAdjRecProb = computePhaseAdjustedRecoveryProbability(score, velocity, snapshot.phase);

    return Object.freeze({
      tick:                             snapshot.tick,
      currentTier:                      tier,
      estimatedTicksToCalm:             baseForecast.ticksToCalm,
      estimatedTicksToNextTierDown:     baseForecast.ticksToNextTierDown,
      escalationRisk:                   baseForecast.escalationLikelihood,
      recoveryProbability:              baseForecast.recoveryLikelihood,
      phaseAdjustedEscalationRisk:      phaseAdj.phaseAdjustedEscalationRisk ?? phaseAdjEscRisk,
      phaseAdjustedRecoveryProbability: phaseAdj.phaseAdjustedRecoveryProbability ?? phaseAdjRecProb,
      decayProfile:                     (baseForecast as CollectorForecast & { decayProfile?: PressureDecayProfile }).decayProfile ?? null,
      isTierLocked:                     (baseForecast.ticksToNextTierDown ?? 0) > 15,
    });
  }

  /**
   * Build a UX hint compat for the companion display layer.
   */
  public buildUXHintCompat(input: CollectorSignalInput): CollectorUXHintCompat | null {
    const { snapshot, collection } = input;
    const uxHint = input.uxHint;
    if (!uxHint) return null;

    const modeProfile  = this.companion.getModeProfile(snapshot.mode);
    const phaseProfile = this.companion.getPhaseProfile(snapshot.phase);

    return Object.freeze({
      tick:                snapshot.tick,
      urgencyLabel:        uxHint.urgency,
      shortHook:           uxHint.shortSummary,
      companionCommentary: uxHint.fullSummary,
      topDriverLabels:     [] as string[],
      topReliefLabels:     [] as string[],
      weightedExplanation: uxHint.fullSummary,
      chatChannel:         uxHint.chatHook as 'GLOBAL' | 'SYNDICATE' | 'DEAL_ROOM' | 'LOBBY' | 'SYSTEM_SHADOW',
      shouldInterrupt:     uxHint.escalationWarning,
      interruptReason:     null as string | null,
      modeProfile,
      phaseProfile,
    });
  }

  /**
   * Build an annotation compat from the annotation bundle.
   */
  public buildAnnotationCompat(input: CollectorSignalInput): CollectorAnnotationCompat | null {
    const { snapshot, collection } = input;
    const annotation = input.annotation;
    if (!annotation) return null;

    const tier        = resolvePressureTier(collection.score);
    const stressIndex = computeStressIndex(collection);
    const reliefBal   = computeReliefBalance(collection);

    const alertLevel = this.companion.getEscalationAlertLevel(annotation.escalationRisk);
    const isRecStrong = this.companion.isRecoveryStrong(annotation.recoveryProbability);

    const tierHooks = this.companion.getTierChatHooks();
    const chatHook = tierHooks[tier];

    return Object.freeze({
      tick:                 snapshot.tick,
      tierLabel:            annotation.tierLabel,
      bandLabel:            annotation.bandLabel,
      urgencyLabel:         annotation.urgencyLabel,
      compositeNote:        annotation.chatHook,
      chatHook,
      stressIndex,
      reliefBalance:        reliefBal,
      escalationAlertLevel: alertLevel,
      isRecoveryStrong:     isRecStrong,
      topDriverCount:       annotation.topPressureContributors.length,
      topReliefCount:       annotation.topReliefContributors.length,
    });
  }

  /**
   * Build the full compat bundle in one pass.
   */
  public buildCompatBundle(input: CollectorSignalInput): CollectorCompatBundle {
    const mlVec     = this.extractMLVector(input);
    const dlTensor  = this.buildDLTensorCompat(input);
    const forecast  = this.buildForecastCompat(input);
    const uxHint    = this.buildUXHintCompat(input);
    const annotation = this.buildAnnotationCompat(input);

    const { snapshot, collection } = input;
    const score   = collection.score;
    const tier    = resolvePressureTier(score);
    const band    = resolvePressureBand(score);
    const urgency = mlVec.urgency;
    const trend   = input.trendSummary ?? this.companion.analyzeTrend(this.collectorHistory);

    const chatSignal = this.buildChatSignalCompat(snapshot, collection, tier, band, urgency, trend);

    const adapterMLVector = this.mlVectorBuilder.build(
      snapshot.tick, snapshot, collection, trend,
      input.forecast ?? null,
      this.resolvedWeights,
    );

    return Object.freeze({
      tick:             snapshot.tick,
      chatSignal,
      mlVectorCompat:   mlVec,
      dlTensorCompat:   dlTensor,
      forecastCompat:   forecast,
      uxHintCompat:     uxHint ?? this.buildFallbackUXHintCompat(snapshot, urgency, mlVec),
      annotationCompat: annotation ?? this.buildFallbackAnnotationCompat(snapshot, collection, tier),
      adapterMLVector,
    });
  }

  /**
   * Get the current report from the analytics tracker.
   */
  public getReport(): CollectorSignalAdapterReport {
    return this.analytics.getReport();
  }

  /**
   * Get the current adapter state.
   */
  public getState(): CollectorSignalAdapterState {
    return this.analytics.getState();
  }

  /**
   * Get the dedupe log.
   */
  public getDedupeLog(): readonly CollectorSignalAdapterDeduped[] {
    return this.deduplicator.getDedupeLog();
  }

  /**
   * Get the history log.
   */
  public getHistoryLog(): readonly CollectorSignalAdapterHistoryEntry[] {
    return Object.freeze([...this.historyLog]);
  }

  /**
   * Get the rejection log.
   */
  public getRejectionLog(): readonly CollectorSignalAdapterRejection[] {
    return Object.freeze([...this.rejectionLog]);
  }

  /**
   * Get the analytics summary from the companion.
   */
  public getAnalyticsSummary(): CollectorAnalyticsSummary {
    return this.companion.getAnalyticsSummary();
  }

  /**
   * Get the health state from the companion.
   */
  public getHealthState(): CollectorHealthState {
    return this.companion.getHealthState();
  }

  /**
   * Get the inspector state with full crossing/escalation diagnostics.
   */
  public getInspectorState(tick: number): CollectorInspectorState {
    const trend    = this.companion.analyzeTrend(this.collectorHistory);
    const forecastParams: CollectorForecastParams = {
      currentScore:    this.analytics.getState().lastScoreSeen ?? 0,
      currentTier:     this.analytics.getState().lastTierSeen ?? 'T0',
      velocity:        trend.velocity,
      acceleration:    trend.acceleration,
      maxDecayPerTick: DEFAULT_MAX_DECAY_PER_TICK,
    };
    const forecast = this.companion.buildForecast(forecastParams);
    return this.companion.getInspectorState(this.collectorHistory, tick, trend, forecast);
  }

  /**
   * Get the mode profile for the given game mode.
   */
  public getModeProfile(mode: 'solo' | 'pvp' | 'coop' | 'ghost'): CollectorModeProfile {
    return this.companion.getModeProfile(mode);
  }

  /**
   * Get the phase profile for the given game phase.
   */
  public getPhaseProfile(phase: 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY'): CollectorPhaseProfile {
    return this.companion.getPhaseProfile(phase);
  }

  /**
   * Returns the ensemble for external consumers who need direct access.
   */
  public getEnsemble(): CollectorEnsemble {
    return this.companion.getEnsemble();
  }

  /**
   * Flush dedupe state without clearing analytics.
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
    this.historyLog.length       = 0;
    this.rejectionLog.length     = 0;
    this.collectorHistory.length = 0;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE — artifact construction
  // ──────────────────────────────────────────────────────────────────────────

  private buildArtifact(
    eventName:       CollectorSignalAdapterEventName,
    tick:            number,
    urgency:         CollectorUrgencyLabel,
    tier:            PressureTier,
    band:            PressureBand,
    chatSignal:      CollectorChatSignalCompat,
    adapterMLVector: CollectorAdapterMLVector,
    input:           CollectorSignalInput,
    context:         CollectorSignalAdapterContext | undefined,
    nowMs:           UnixMs,
  ): CollectorSignalAdapterArtifact {
    const priority = this.priorityClassifier.classify(eventName, urgency, tier, band);
    const narrativeWeight = this.narrativeWeighter.score(
      eventName, urgency, tier, band,
      input.trendSummary ?? null,
      input.snapshot.phase,
    );
    const channelRecommendation = this.channelRouter.route(
      urgency, tier, input.snapshot.mode, priority, this.options,
    );
    const severity = this.priorityClassifier.urgencyToSeverity(urgency);

    // Dedupe check (bypass for critical / spike events)
    const isBypass    = this.deduplicator.isBypassEvent(eventName);
    const shouldDedupe = !isBypass && this.deduplicator.shouldSuppress(eventName, tick);

    if (shouldDedupe) {
      this.deduplicator.recordDeduped(eventName, tick);
      this.analytics.recordDeduped();
      return Object.freeze({
        tick,
        eventName,
        envelope:            null,
        signal:              null,
        accepted:            false,
        deduped:             true,
        rejectionReason:     `Deduplicated within ${this.options.dedupeWindowTicks}-tick window`,
        severity,
        priority,
        narrativeWeight,
        channelRecommendation,
        adapterMLVector,
        urgencyLabel:        urgency,
      });
    }

    // Ambient suppression
    if (priority === 'SUPPRESSED') {
      this.analytics.recordRejected();
      const rejection: CollectorSignalAdapterRejection = Object.freeze({
        tick,
        eventName,
        reason:   'AMBIENT_SUPPRESSED',
        severity,
      });
      this.rejectionLog.push(rejection);
      if (this.rejectionLog.length > COLLECTOR_HISTORY_DEPTH) this.rejectionLog.shift();
      return Object.freeze({
        tick,
        eventName,
        envelope:            null,
        signal:              null,
        accepted:            false,
        deduped:             false,
        rejectionReason:     'AMBIENT_SUPPRESSED',
        severity,
        priority,
        narrativeWeight,
        channelRecommendation,
        adapterMLVector,
        urgencyLabel:        urgency,
      });
    }

    this.deduplicator.recordEmitted(eventName, tick);

    const roomId  = context?.roomId ?? this.options.defaultRoomId;
    const channel = context?.routeChannel ??
      (channelRecommendation !== 'SUPPRESSED' ? channelRecommendation as string as ChatVisibleChannel : this.options.defaultVisibleChannel);

    const envelope: ChatInputEnvelope = Object.freeze({
      kind:      'PRESSURE_SIGNAL' as const,
      roomId:    String(roomId),
      emittedAt: nowMs,
      payload:   Object.freeze({
        eventName,
        tick,
        urgency,
        tier,
        band,
        score:             chatSignal.score,
        escalationRisk:    chatSignal.escalationRisk,
        recoveryProbability: chatSignal.recoveryProbability,
        chatHook:          chatSignal.chatHook,
        isEscalation:      chatSignal.isEscalation,
        isSpike:           chatSignal.isSpike,
      } as unknown as Readonly<Record<string, unknown>>),
    } as unknown as ChatInputEnvelope);

    const signal: ChatSignalEnvelope = Object.freeze({
      source:    'COLLECTOR_ENGINE' as const,
      eventName,
      tick,
      emittedAt: nowMs,
      payload:   Object.freeze({
        urgency,
        tier,
        band,
        score:          chatSignal.score,
        channel,
        narrativeWeight,
      } as unknown as Readonly<Record<string, unknown>>),
    } as unknown as ChatSignalEnvelope);

    return Object.freeze({
      tick,
      eventName,
      envelope,
      signal,
      accepted:            true,
      deduped:             false,
      rejectionReason:     null,
      severity,
      priority,
      narrativeWeight,
      channelRecommendation,
      adapterMLVector,
      urgencyLabel:        urgency,
    });
  }

  private buildChatSignalCompat(
    snapshot:   CollectorSnapshotCompat,
    collection: PressureSignalCollection,
    tier:       PressureTier,
    band:       PressureBand,
    urgency:    CollectorUrgencyLabel,
    trend:      CollectorTrendSummary,
  ): CollectorChatSignalCompat {
    const { mode, phase } = snapshot;
    const score     = collection.score;
    const prevScore = snapshot.previousScore ?? score;
    const prevTier  = snapshot.previousTier ?? tier;
    const prevBand  = snapshot.previousBand ?? band;
    const tierRank  = rankPressureTier(tier);
    const prevTierRank = rankPressureTier(prevTier);
    const bandRank  = rankPressureBand(band);
    const prevBandRank = rankPressureBand(prevBand);

    const isEscalation   = tierRank > prevTierRank || (tierRank === prevTierRank && bandRank > prevBandRank);
    const isDeescalation = tierRank < prevTierRank || (tierRank === prevTierRank && bandRank < prevBandRank);
    const netPolarity: PressureSignalPolarity = collection.rawPositiveScore >= collection.rawReliefScore ? 'PRESSURE' : 'RELIEF';

    const stressIndex   = computeStressIndex(collection);
    const reliefBalance = computeReliefBalance(collection);
    const escRisk       = computeEscalationRisk(score, trend.velocity, tier);
    const recProb       = computeRecoveryProbability(score, trend.velocity);

    const chatHook = this.channelRouter.buildHookForUrgency(
      urgency, tier, collection.dominantPressureKey,
    );

    const modeProf = COLLECTOR_MODE_PROFILES[mode];

    return Object.freeze({
      eventName:                       'collector.ml.emit' as const,
      tick:                            snapshot.tick,
      urgency,
      trendLabel:                      trend.trendLabel,
      tier,
      previousTier:                    prevTier,
      band,
      previousBand:                    prevBand,
      score,
      scoreDelta:                      Number((score - prevScore).toFixed(6)),
      isEscalation,
      isDeescalation,
      isCritical:                      tier === 'T4',
      isHighUrgency:                   urgency === 'HIGH' || urgency === 'CRITICAL',
      isSpike:                         trend.isSpike,
      isPlateau:                       trend.isPlateau,
      dominantPressureKey:             collection.dominantPressureKey,
      dominantReliefKey:               collection.dominantReliefKey,
      positiveSignalCount:             collection.contributions.length,
      reliefSignalCount:               collection.reliefContributions.length,
      netPressurePolarity:             netPolarity,
      modeCode:                        mode,
      phaseCode:                       phase,
      isAboveModeEscalationThreshold:  score >= modeProf.escalationThreshold,
      isBelowModeDeescalationThreshold: score < modeProf.deescalationThreshold,
      escalationRisk:                  escRisk,
      recoveryProbability:             recProb,
      stressIndex,
      reliefBalance,
      chatHook,
      peakScore:                       snapshot.peakScore ?? score,
      peakTick:                        snapshot.peakTick ?? snapshot.tick,
    });
  }

  private buildFallbackUXHintCompat(
    snapshot: CollectorSnapshotCompat,
    urgency:  CollectorUrgencyLabel,
    mlVec:    CollectorMLVectorCompat,
  ): CollectorUXHintCompat {
    return Object.freeze({
      tick:                snapshot.tick,
      urgencyLabel:        urgency,
      shortHook:           COLLECTOR_CHAT_HOOK_MAP[mlVec.urgency === 'CRITICAL' ? 'T4' : 'T1'],
      companionCommentary: `Pressure is ${urgency.toLowerCase()} at ${scoreToPercentage(mlVec.scoreNormalized).toFixed(1)}%`,
      topDriverLabels:     [] as readonly string[],
      topReliefLabels:     [] as readonly string[],
      weightedExplanation: `Trend: ${mlVec.trendLabel}, velocity: ${mlVec.trendVelocity.toFixed(4)}`,
      chatChannel:         'SYSTEM_SHADOW' as ChatVisibleChannel,
      shouldInterrupt:     urgency === 'CRITICAL',
      interruptReason:     urgency === 'CRITICAL' ? 'Critical urgency level reached' : null,
      modeProfile:         this.companion.getModeProfile(snapshot.mode),
      phaseProfile:        this.companion.getPhaseProfile(snapshot.phase),
    });
  }

  private buildFallbackAnnotationCompat(
    snapshot:   CollectorSnapshotCompat,
    collection: PressureSignalCollection,
    tier:       PressureTier,
  ): CollectorAnnotationCompat {
    const band        = resolvePressureBand(collection.score);
    const urgency     = this.companion.classifyUrgency(collection.score);
    const escRisk     = computeEscalationRisk(collection.score, 0, tier);
    const recProb     = computeRecoveryProbability(collection.score, 0);
    const stressIdx   = computeStressIndex(collection);
    const reliefBal   = computeReliefBalance(collection);
    const alertLevel  = this.companion.getEscalationAlertLevel(escRisk);
    const isStrong    = this.companion.isRecoveryStrong(recProb);
    const tierHooks   = this.companion.getTierChatHooks();

    return Object.freeze({
      tick:                 snapshot.tick,
      tierLabel:            tier,
      bandLabel:            band,
      urgencyLabel:         urgency,
      compositeNote:        `${tier}/${band} — urgency: ${urgency}`,
      chatHook:             tierHooks[tier],
      stressIndex:          stressIdx,
      reliefBalance:        reliefBal,
      escalationAlertLevel: alertLevel,
      isRecoveryStrong:     isStrong,
      topDriverCount:       collection.contributions.length,
      topReliefCount:       collection.reliefContributions.length,
    });
  }

  private pushCollectorHistory(entry: CollectorHistoryEntry): void {
    this.collectorHistory.push(entry);
    if (this.collectorHistory.length > COLLECTOR_HISTORY_DEPTH) {
      this.collectorHistory.shift();
    }
  }

  private recordHistory(
    tick:      number,
    urgency:   CollectorUrgencyLabel,
    tier:      PressureTier,
    band:      PressureBand,
    score:     number,
    artifacts: readonly CollectorSignalAdapterArtifact[],
  ): void {
    const accepted = artifacts.some((a) => a.accepted);
    const deduped  = artifacts.some((a) => a.deduped);
    const entry: CollectorSignalAdapterHistoryEntry = Object.freeze({
      tick,
      eventName: artifacts[0]?.eventName ?? 'collector.urgency.medium',
      urgency,
      tier,
      band,
      score,
      accepted,
      deduped,
    });
    this.historyLog.push(entry);
    if (this.historyLog.length > COLLECTOR_HISTORY_DEPTH) this.historyLog.shift();
  }

  private buildNoopLogger(): CollectorSignalAdapterLogger {
    return Object.freeze({ debug() {}, warn() {}, error() {} });
  }
}

// ============================================================================
// MARK: Standalone export functions
// ============================================================================

/**
 * Factory for creating a CollectorSignalAdapter with a bound CollectorEnsemble.
 *
 * Usage:
 *   const { adapter, ensemble } = createCollectorSignalAdapter({ defaultRoomId: 'run-001' });
 *   const artifacts = adapter.adapt(input);
 *   const mlVec = ensemble.extractor.extract(runStateSnapshot);
 */
export function createCollectorSignalAdapter(
  opts: CollectorSignalAdapterOptions,
): { readonly adapter: CollectorSignalAdapter; readonly ensemble: CollectorEnsemble } {
  const adapter  = new CollectorSignalAdapter(opts);
  const ensemble = createPressureCollectorWithAnalytics(
    opts.customWeights ? { weights: opts.customWeights as PressureCollectorWeights } : {},
  );
  return Object.freeze({ adapter, ensemble });
}

/**
 * Extract the adapter ML vector from a CollectorSignalInput.
 * Pure one-shot extraction without side effects on adapter state.
 */
export function extractCollectorAdapterMLVector(
  input: CollectorSignalInput,
): CollectorAdapterMLVector {
  const builder  = new CollectorAdapterMLVectorBuilder();
  const trend    = input.trendSummary ?? null;
  const weights  = DEFAULT_PRESSURE_COLLECTOR_WEIGHTS;
  return builder.build(input.snapshot.tick, input.snapshot, input.collection, trend, input.forecast ?? null, weights);
}

/**
 * Score the overall collector risk from a full RunStateSnapshot.
 * Uses extractCollectorSnapshot (requires a real RunStateSnapshot).
 */
export function scoreCollectorRisk(
  snapshot: RunStateSnapshot,
  weights?: Partial<PressureCollectorWeights>,
): Score01 {
  const mlVector = extractCollectorSnapshot(snapshot, weights);
  const tier     = resolvePressureTier(mlVector.score);
  const escRisk  = computeEscalationRisk(mlVector.score, 0, tier);
  const stress   = computeStressIndex({ score: mlVector.score } as PressureSignalCollection);
  return clamp01(escRisk * 0.6 + stress * 0.4) as Score01;
}

/**
 * Get the recommended chat channel for a CollectorSignalInput.
 * Pure routing without adapter side effects.
 */
export function getCollectorChatChannel(
  input: CollectorSignalInput,
  mode?:    'solo' | 'pvp' | 'coop' | 'ghost',
): CollectorSignalAdapterChannelRecommendation {
  const { collection, snapshot } = input;
  const score   = collection.score;
  const tier    = resolvePressureTier(score);
  const urgency = classifyUrgency(tier, 0, 0);
  const modeKey = mode ?? snapshot.mode;

  if (urgency === 'CRITICAL') return 'GLOBAL';
  if (urgency === 'HIGH') {
    return modeKey === 'coop' || modeKey === 'pvp' ? 'SYNDICATE' : 'GLOBAL';
  }
  if (urgency === 'MEDIUM') {
    return modeKey === 'coop' ? 'SYNDICATE' : 'SYSTEM_SHADOW';
  }
  return 'SYSTEM_SHADOW';
}

/**
 * Compute the narrative weight for a CollectorSignalInput.
 */
export function buildCollectorNarrativeWeight(
  input: CollectorSignalInput,
): CollectorSignalAdapterNarrativeWeight {
  const weighter = new CollectorSignalNarrativeWeighter();
  const { collection, snapshot, trendSummary } = input;
  const score   = collection.score;
  const tier    = resolvePressureTier(score);
  const band    = resolvePressureBand(score);
  const urgency = classifyUrgency(tier, trendSummary?.velocity ?? 0, snapshot.consecutiveHighTierTicks ?? 0);
  return weighter.score('collector.ml.emit', urgency, tier, band, trendSummary ?? null, snapshot.phase);
}

/**
 * Build a threshold report showing pressure tier and band boundaries.
 */
export interface CollectorThresholdReport {
  readonly tierThresholds: Readonly<Record<PressureTier, PressureThreshold<PressureTier>>>;
  readonly bandThresholds: Readonly<Record<PressureBand, number>>;
  readonly collectorMLFeatureLabels: readonly string[];
  readonly collectorDLFeatureLabels: readonly string[];
  readonly collectorManifest: typeof COLLECTOR_MANIFEST;
}

export function buildCollectorThresholdReport(): CollectorThresholdReport {
  return Object.freeze({
    tierThresholds:            PRESSURE_THRESHOLDS as unknown as Readonly<Record<PressureTier, PressureThreshold<PressureTier>>>,
    bandThresholds:            PRESSURE_BAND_THRESHOLDS as unknown as Readonly<Record<PressureBand, number>>,
    collectorMLFeatureLabels:  COLLECTOR_ML_FEATURE_LABELS,
    collectorDLFeatureLabels:  COLLECTOR_DL_FEATURE_LABELS,
    collectorManifest:         COLLECTOR_MANIFEST,
  });
}

/**
 * Build a full adapter bundle from a RunStateSnapshot.
 * Uses buildCollectorBundle (requires real RunStateSnapshot) and the full
 * companion ensemble for ML/DL/trend/forecast/annotation/UX.
 */
export function buildCollectorAdapterBundle(
  snapshot: RunStateSnapshot,
  weights?: Partial<PressureCollectorWeights>,
): CollectorAdapterFullBundle {
  // Use buildCollectorBundle for the full engine pipeline (uses PressureSignalCollector.collect())
  const bundle = buildCollectorBundle(
    snapshot,
    snapshot.mode,
    snapshot.phase,
    weights,
  );

  // Build the full companion ensemble via createPressureCollectorWithAnalytics
  const ens = createPressureCollectorWithAnalytics(
    weights ? { weights: weights as PressureCollectorWeights } : {},
  );

  // Use CollectorInspector and CollectorAnalytics from the ensemble
  const inspector = new CollectorInspector(COLLECTOR_MODULE_VERSION);
  const analytics = new CollectorAnalytics(
    mergePressureCollectorWeights(DEFAULT_PRESSURE_COLLECTOR_WEIGHTS, weights ?? {}),
  );

  const tier = resolvePressureTier(bundle.collection.score);
  const band = resolvePressureBand(bundle.collection.score);

  inspector.update('T0', tier, 'CALM', band);
  const histEntry = buildCollectorHistoryEntry({
    collection: bundle.collection,
    tier,
    band,
    tick: snapshot.tick,
  });
  analytics.update(histEntry, snapshot.mode, snapshot.phase, bundle.trend?.velocity ?? 0);

  const inspectorState = inspector.inspect(
    [histEntry],
    null,
    ens.extractor ? 1 : 0,
    ens.dlBuilder ? 1 : 0,
    snapshot.tick,
    bundle.trend ?? null,
    bundle.forecast ?? null,
  );

  const analyticsSummary = analytics.getSummary();
  const healthState      = (analytics as unknown as { getHealthState(): CollectorHealthState }).getHealthState();

  return Object.freeze({
    tick:            snapshot.tick,
    collection:      bundle.collection,
    mlVector:        bundle.mlVector,
    dlTensor:        bundle.dlTensor,
    trend:           bundle.trend,
    forecast:        bundle.forecast,
    annotation:      bundle.annotation,
    uxHint:          bundle.uxHint,
    inspectorState,
    analyticsSummary,
    healthState,
    ensemble:        ens,
  });
}

/**
 * Build a CollectorCompatBundle from a CollectorSignalInput using
 * the phase-adjusted annotation pipeline end-to-end.
 */
export function buildCollectorCompatBundle(input: CollectorSignalInput): CollectorCompatBundle {
  const adapter = new CollectorSignalAdapter({
    defaultRoomId: input.snapshot.runId ?? 'adapter-bundle',
    enableMLEmit:  true,
    enableDLEmit:  false,
  });
  return adapter.buildCompatBundle(input);
}

// ============================================================================
// MARK: Adapter manifest
// ============================================================================

export const COLLECTOR_SIGNAL_ADAPTER_MANIFEST = Object.freeze({
  version:            COLLECTOR_SIGNAL_ADAPTER_VERSION,
  collectorVersion:   COLLECTOR_MODULE_VERSION,
  mlFeatureCount:     COLLECTOR_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  dlFeatureCount:     COLLECTOR_SIGNAL_ADAPTER_DL_FEATURE_COUNT,
  dlSequenceLength:   COLLECTOR_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH,
  dedupeWindowTicks:  COLLECTOR_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
  maxBatchSize:       COLLECTOR_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
  eventCount:         COLLECTOR_SIGNAL_ADAPTER_EVENT_NAMES.length,
  eventNames:         COLLECTOR_SIGNAL_ADAPTER_EVENT_NAMES,
  collectorManifest:  COLLECTOR_MANIFEST,
  domain:             'COLLECTOR' as const,
  ownsTruth:          false as const,
  description:        'Translates PressureSignalCollector outputs into backend-chat collector ingress — urgency escalations, tier/band crossings, trend spikes, plateaux, relief events, recovery forecasts, ML vectors, and DL tensors.',
});
