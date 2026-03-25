/*
 * POINT ZERO ONE — BACKEND PRESSURE ENGINE
 * /backend/src/game/engine/pressure/PressureEngine.ts
 * VERSION: 2026.03.25
 *
 * Doctrine:
 * - backend pressure is authoritative, deterministic, and replay-safe
 * - pressure.score is normalized 0.0 → 1.0
 * - pressure.tier preserves cadence semantics used elsewhere in the engine graph
 * - pressure.band carries richer semantic meaning for UI, ML, and dossiers
 * - backward compatibility with EngineEventMap is preserved through pressure.changed
 * - deeper diagnostics are returned as EngineSignal payloads, not ad-hoc bus events
 * - ML feature vectors and DL tensors are first-class outputs of every tick
 * - trend, recovery forecasting, and UX projection drive chat lane intelligence
 * - every public symbol exported here is consumed by chat adapters, ML pipelines,
 *   or the engine orchestrator — zero dead exports
 *
 * Architecture:
 *   PressureMLExtractor    — flat labeled feature vectors for online ML inference
 *   PressureDLBuilder      — windowed sequence tensors for deep learning pipelines
 *   PressureTrendAnalyzer  — velocity, acceleration, spike, plateau detection
 *   PressureRecoveryForecaster — tick-to-calm, tick-to-tier using decay controller
 *   PressureAnnotator      — rich tier/band/driver annotations for dossier + chat
 *   PressureUXProjector    — urgency labels, chat hooks, contributor summaries
 *   PressureEngine         — orchestrator, SimulationEngine contract, master state
 */

import {
  createEngineHealth,
  createEngineSignal,
  type EngineHealth,
  type EngineSignal,
  type EngineTickResult,
  type SimulationEngine,
  type TickContext,
} from '../core/EngineContracts';
import type { PressureTier } from '../core/GamePrimitives';
import type {
  PressureBand,
  PressureState,
  RunStateSnapshot,
} from '../core/RunStateSnapshot';
import { PressureDecayController } from './PressureDecayController';
import {
  PressureEventEmitter,
  type PressureEmissionMeta,
} from './PressureEventEmitter';
import { PressureSignalCollector } from './PressureSignalCollector';
import {
  clampPressureScore,
  createZeroPressureSignalMap,
  DEFAULT_MAX_DECAY_PER_TICK,
  DEFAULT_PRESSURE_COLLECTOR_LIMITS,
  DEFAULT_PRESSURE_COLLECTOR_WEIGHTS,
  getPressureTierMinScore,
  mergePressureCollectorWeights,
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
// § MODULE MANIFEST
// ─────────────────────────────────────────────────────────────────────────────

export const PRESSURE_ENGINE_MODULE_VERSION = '2026.03.25' as const;
export const PRESSURE_ENGINE_ML_FEATURE_COUNT = 64 as const;
export const PRESSURE_ENGINE_DL_FEATURE_COUNT = 128 as const;
export const PRESSURE_ENGINE_DL_SEQUENCE_LENGTH = 10 as const;

/**
 * Milestones at which PRESSURE_HIGH_PERSISTENCE signals fire.
 * Distinct from types.ts constants — these are engine-specific emission gates.
 */
const HIGH_PRESSURE_MILESTONES = new Set<number>([5, 10, 20, 40]);

// ─────────────────────────────────────────────────────────────────────────────
// § TYPE DEFINITIONS — ML, DL, TREND, FORECAST, UX, ANNOTATION
// ─────────────────────────────────────────────────────────────────────────────

/** Flat labeled feature vector for online ML inference. */
export interface PressureMLVector {
  readonly version: typeof PRESSURE_ENGINE_MODULE_VERSION;
  readonly tick: number;
  readonly scoreNormalized: number;
  readonly rawScoreNormalized: number;
  readonly tierRank: number;
  readonly bandRank: number;
  readonly tierNormalized: number;
  readonly bandNormalized: number;
  readonly upwardCrossings: number;
  readonly survivedHighPressureTicks: number;
  readonly maxScoreSeen: number;
  readonly scoreDelta: number;
  readonly positiveFeatures: Readonly<Record<PressurePositiveSignalKey, number>>;
  readonly reliefFeatures: Readonly<Record<PressureReliefSignalKey, number>>;
  readonly rawPositiveScore: number;
  readonly rawReliefScore: number;
  readonly netReliefRatio: number;
  readonly dominantPositiveKeyIndex: number;
  readonly dominantReliefKeyIndex: number;
  readonly decayMaxDropPerTick: number;
  readonly decayStickyFloor: number;
  readonly decayTierRetentionFloor: number;
  readonly isHighTier: 1 | 0;
  readonly isCriticalTier: 1 | 0;
  readonly allowsHaterInjection: 1 | 0;
  readonly passiveShieldDrain: 1 | 0;
  readonly trendVelocity: number;
  readonly trendAcceleration: number;
  readonly trendSpike: 1 | 0;
  readonly trendPlateauAtHigh: 1 | 0;
  readonly ticksToCalm: number;
  readonly ticksToNextTierDown: number;
  readonly escalationProximity: number;
  readonly modeCode: number;
  readonly phaseCode: number;
  readonly featureLabels: readonly string[];
}

/** Windowed sequence tensor for deep learning pipelines. */
export interface PressureDLTensor {
  readonly version: typeof PRESSURE_ENGINE_MODULE_VERSION;
  readonly tick: number;
  readonly sequenceLength: number;
  readonly featureCount: number;
  readonly inputSequence: readonly (readonly number[])[];
  readonly currentFrame: readonly number[];
  readonly tierOneHot: readonly number[];
  readonly bandOneHot: readonly number[];
  readonly signalPresenceMask: Readonly<Record<PressureSignalKey, 0 | 1>>;
  readonly signalMagnitudes: Readonly<Record<PressureSignalKey, number>>;
  readonly attentionWeights: readonly number[];
  readonly encodedHistory: readonly number[];
  readonly labelVector: readonly number[];
}

/** Trend summary from score/tier/band history. */
export interface PressureTrendSummary {
  readonly window: number;
  readonly velocity: number;
  readonly acceleration: number;
  readonly isRising: boolean;
  readonly isFalling: boolean;
  readonly isStable: boolean;
  readonly isSpike: boolean;
  readonly isPlateau: boolean;
  readonly plateauAtHighTier: boolean;
  readonly meanScore: number;
  readonly stdDevScore: number;
  readonly tierTransitionsInWindow: number;
  readonly bandTransitionsInWindow: number;
  readonly dominantTierInWindow: PressureTier | null;
  readonly dominantBandInWindow: PressureBand | null;
  readonly maxScoreInWindow: number;
  readonly minScoreInWindow: number;
}

/** Recovery forecast from decay controller. */
export interface PressureRecoveryForecast {
  readonly currentScore: number;
  readonly currentTier: PressureTier;
  readonly estimatedTicksToCalm: number;
  readonly estimatedTicksToT0: number;
  readonly estimatedTicksToT1: number;
  readonly estimatedTicksToT2: number;
  readonly estimatedTicksToNextTierDown: number;
  readonly stickyFloor: number;
  readonly maxDropPerTick: number;
  readonly isTierLocked: boolean;
  readonly decayProfile: PressureDecayProfile;
}

/** Decay analysis from current profile vs defaults. */
export interface PressureDecayAnalysis {
  readonly profile: PressureDecayProfile;
  readonly isSlowerThanDefault: boolean;
  readonly decayRatio: number;
  readonly activeConstraints: readonly string[];
  readonly tierRetentionActive: boolean;
  readonly stickyFloorActive: boolean;
  readonly estimatedConstraintTicks: number;
}

/** Escalation prediction — how far to the next tier boundary. */
export interface PressureEscalationPrediction {
  readonly currentTier: PressureTier;
  readonly currentBand: PressureBand;
  readonly currentScore: number;
  readonly nextTierThreshold: PressureThreshold<PressureTier> | null;
  readonly nextBandThreshold: PressureThreshold<PressureBand> | null;
  readonly distanceToNextTierEscalation: number;
  readonly distanceToNextBandEscalation: number;
  readonly escalationProximity: number;
  readonly atMaxTier: boolean;
  readonly atMaxBand: boolean;
}

/** Rich annotation bundle for dossier and replay. */
export interface PressureAnnotationBundle {
  readonly tick: number;
  readonly tierLabel: string;
  readonly bandLabel: string;
  readonly tierConfig: PressureTierConfig;
  readonly tierAnnotation: string;
  readonly bandAnnotation: string;
  readonly driverAnnotation: string;
  readonly reliefAnnotation: string;
  readonly compositeNote: string;
  readonly activeSignals: readonly PressureSignalKey[];
  readonly inactiveSignals: readonly PressureSignalKey[];
  readonly modeSignals: readonly PressureSignalKey[];
  readonly globalSignals: readonly PressureSignalKey[];
  readonly positiveSignalCount: number;
  readonly reliefSignalCount: number;
  readonly netPressureDirection: PressureSignalPolarity;
  readonly allowsHaterInjection: boolean;
  readonly passiveShieldDrain: boolean;
}

/** UX hint for companion, chat commentary, and urgency display. */
export interface PressureUXHint {
  readonly tick: number;
  readonly urgencyLabel: string;
  readonly shortHook: string;
  readonly companionCommentary: string;
  readonly topDriverLabels: readonly string[];
  readonly topReliefLabels: readonly string[];
  readonly weightedExplanation: string;
  readonly chatChannel: 'GLOBAL' | 'SYNDICATE' | 'DEAL_ROOM' | 'SYSTEM_SHADOW';
  readonly shouldInterrupt: boolean;
  readonly interruptReason: string | null;
  readonly severityClass: 'CALM' | 'BUILDING' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
}

/** Full inspector state for debug/replay/admin surfaces. */
export interface PressureInspectorState {
  readonly engineId: 'pressure';
  readonly version: typeof PRESSURE_ENGINE_MODULE_VERSION;
  readonly health: EngineHealth;
  readonly scoreHistory: readonly number[];
  readonly rawScoreHistory: readonly number[];
  readonly tierHistory: readonly PressureTier[];
  readonly bandHistory: readonly PressureBand[];
  readonly dominantSignalHistory: readonly string[];
  readonly decayProfileHistory: readonly PressureDecayProfile[];
  readonly activeWeights: PressureCollectorWeights;
  readonly activeLimits: PressureCollectorLimits;
  readonly defaultMaxDecayPerTick: number;
  readonly historyDepth: number;
  readonly trendWindow: number;
  readonly topSignalCount: number;
  readonly mlFeatureCount: number;
  readonly dlFeatureCount: number;
  readonly dlSequenceLength: number;
  readonly lastMLVector: PressureMLVector | null;
  readonly lastDLTensor: PressureDLTensor | null;
  readonly lastTrendSummary: PressureTrendSummary | null;
  readonly lastAnnotationBundle: PressureAnnotationBundle | null;
  readonly lastUXHint: PressureUXHint | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// § PRESSURE ML EXTRACTOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts a flat labeled feature vector from the current pressure state.
 * All PRESSURE_SIGNAL_KEYS, tier configs, weights, and limits are consumed here.
 * Output is deterministic, replay-safe, and ML-pipeline ready.
 */
export class PressureMLExtractor {
  private static readonly POSITIVE_KEY_INDEX_MAP: Readonly<
    Record<PressurePositiveSignalKey, number>
  > = Object.freeze(
    Object.fromEntries(
      PRESSURE_POSITIVE_SIGNAL_KEYS.map((key, index) => [key, index]),
    ) as Record<PressurePositiveSignalKey, number>,
  );

  private static readonly RELIEF_KEY_INDEX_MAP: Readonly<
    Record<PressureReliefSignalKey, number>
  > = Object.freeze(
    Object.fromEntries(
      PRESSURE_RELIEF_SIGNAL_KEYS.map((key, index) => [key, index]),
    ) as Record<PressureReliefSignalKey, number>,
  );

  public extract(
    tick: number,
    snapshot: RunStateSnapshot,
    collection: PressureSignalCollection,
    tier: PressureTier,
    band: PressureBand,
    previous: PressureState,
    next: PressureState,
    trend: PressureTrendSummary,
    forecast: PressureRecoveryForecast,
    decayProfile: PressureDecayProfile,
  ): PressureMLVector {
    const tierConfig = PRESSURE_TIER_CONFIGS[tier];
    const tierRank = rankPressureTier(tier);
    const bandRank = rankPressureBand(band);

    const positiveFeatures = this.buildPositiveFeatures(collection);
    const reliefFeatures = this.buildReliefFeatures(collection);

    const dominantPositiveKey = collection.dominantPressureKey;
    const dominantReliefKey = collection.dominantReliefKey;

    const netReliefRatio =
      collection.rawPositiveScore > 0
        ? collection.rawReliefScore / collection.rawPositiveScore
        : 0;

    const modeCode = this.encodeModeCode(snapshot.mode);
    const phaseCode = this.encodePhaseCode(snapshot.phase);

    const escalationProximity = this.computeEscalationProximity(
      next.score,
      tier,
    );

    return Object.freeze({
      version: PRESSURE_ENGINE_MODULE_VERSION,
      tick,
      scoreNormalized: clampPressureScore(next.score),
      rawScoreNormalized: clampPressureScore(collection.rawScore),
      tierRank,
      bandRank,
      tierNormalized: normalizeWeight(tierRank / 4),
      bandNormalized: normalizeWeight(bandRank / 4),
      upwardCrossings: next.upwardCrossings,
      survivedHighPressureTicks: next.survivedHighPressureTicks,
      maxScoreSeen: clampPressureScore(next.maxScoreSeen),
      scoreDelta: Number(
        (next.score - previous.score).toFixed(6),
      ),
      positiveFeatures,
      reliefFeatures,
      rawPositiveScore: clampPressureScore(collection.rawPositiveScore),
      rawReliefScore: clampPressureScore(collection.rawReliefScore),
      netReliefRatio: normalizeWeight(netReliefRatio),
      dominantPositiveKeyIndex: dominantPositiveKey
        ? (PressureMLExtractor.POSITIVE_KEY_INDEX_MAP[dominantPositiveKey] ?? -1)
        : -1,
      dominantReliefKeyIndex: dominantReliefKey
        ? (PressureMLExtractor.RELIEF_KEY_INDEX_MAP[dominantReliefKey] ?? -1)
        : -1,
      decayMaxDropPerTick: normalizeWeight(
        decayProfile.maxDropPerTick / DEFAULT_MAX_DECAY_PER_TICK,
      ),
      decayStickyFloor: clampPressureScore(decayProfile.stickyFloor),
      decayTierRetentionFloor: clampPressureScore(
        decayProfile.tierRetentionFloor,
      ),
      isHighTier: (tier === 'T3' || tier === 'T4') ? 1 : 0,
      isCriticalTier: tier === 'T4' ? 1 : 0,
      allowsHaterInjection: tierConfig.allowsHaterInjection ? 1 : 0,
      passiveShieldDrain: tierConfig.passiveShieldDrain ? 1 : 0,
      trendVelocity: trend.velocity,
      trendAcceleration: trend.acceleration,
      trendSpike: trend.isSpike ? 1 : 0,
      trendPlateauAtHigh: trend.plateauAtHighTier ? 1 : 0,
      ticksToCalm: forecast.estimatedTicksToCalm,
      ticksToNextTierDown: forecast.estimatedTicksToNextTierDown,
      escalationProximity,
      modeCode,
      phaseCode,
      featureLabels: this.buildFeatureLabels(),
    });
  }

  public buildFeatureLabels(): readonly string[] {
    return Object.freeze([
      'scoreNormalized',
      'rawScoreNormalized',
      'tierRank',
      'bandRank',
      'tierNormalized',
      'bandNormalized',
      'upwardCrossings',
      'survivedHighPressureTicks',
      'maxScoreSeen',
      'scoreDelta',
      ...PRESSURE_POSITIVE_SIGNAL_KEYS.map((key) => `pos:${key}`),
      ...PRESSURE_RELIEF_SIGNAL_KEYS.map((key) => `rel:${key}`),
      'rawPositiveScore',
      'rawReliefScore',
      'netReliefRatio',
      'dominantPositiveKeyIndex',
      'dominantReliefKeyIndex',
      'decayMaxDropPerTick',
      'decayStickyFloor',
      'decayTierRetentionFloor',
      'isHighTier',
      'isCriticalTier',
      'allowsHaterInjection',
      'passiveShieldDrain',
      'trendVelocity',
      'trendAcceleration',
      'trendSpike',
      'trendPlateauAtHigh',
      'ticksToCalm',
      'ticksToNextTierDown',
      'escalationProximity',
      'modeCode',
      'phaseCode',
    ]);
  }

  private buildPositiveFeatures(
    collection: PressureSignalCollection,
  ): Readonly<Record<PressurePositiveSignalKey, number>> {
    const features = {} as Record<PressurePositiveSignalKey, number>;
    for (const key of PRESSURE_POSITIVE_SIGNAL_KEYS) {
      features[key] = normalizeWeight(
        collection.pressureBreakdown[key] /
          Math.max(0.001, DEFAULT_PRESSURE_COLLECTOR_WEIGHTS[key]),
      );
    }
    return Object.freeze(features);
  }

  private buildReliefFeatures(
    collection: PressureSignalCollection,
  ): Readonly<Record<PressureReliefSignalKey, number>> {
    const features = {} as Record<PressureReliefSignalKey, number>;
    for (const key of PRESSURE_RELIEF_SIGNAL_KEYS) {
      features[key] = normalizeWeight(
        collection.reliefBreakdown[key] /
          Math.max(0.001, DEFAULT_PRESSURE_COLLECTOR_WEIGHTS[key]),
      );
    }
    return Object.freeze(features);
  }

  private computeEscalationProximity(
    score: number,
    tier: PressureTier,
  ): number {
    const tierRank = rankPressureTier(tier);
    if (tierRank >= 4) return 1.0;
    const nextTierThreshold = PRESSURE_THRESHOLDS.find(
      (t) => rankPressureTier(t.value) === tierRank + 1,
    );
    if (!nextTierThreshold) return 0;
    const gap = nextTierThreshold.minScore - getPressureTierMinScore(tier);
    if (gap <= 0) return 1.0;
    const progress = (score - getPressureTierMinScore(tier)) / gap;
    return clampPressureScore(progress);
  }

  private encodeModeCode(mode: RunStateSnapshot['mode']): number {
    switch (mode) {
      case 'solo': return 0;
      case 'pvp': return 1;
      case 'coop': return 2;
      case 'ghost': return 3;
      default: return 0;
    }
  }

  private encodePhaseCode(phase: RunStateSnapshot['phase']): number {
    switch (phase) {
      case 'FOUNDATION': return 0;
      case 'ESCALATION': return 1;
      case 'SOVEREIGNTY': return 2;
      default: return 0;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § PRESSURE DL BUILDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds windowed sequence tensors suitable for LSTM, Transformer, and
 * attention-based deep learning models.
 * Uses PRESSURE_SIGNAL_KEYS, createZeroPressureSignalMap, PRESSURE_TIER_CONFIGS.
 */
export class PressureDLBuilder {
  private static readonly TIER_CODES: readonly PressureTier[] = [
    'T0', 'T1', 'T2', 'T3', 'T4',
  ];
  private static readonly BAND_CODES: readonly PressureBand[] = [
    'CALM', 'BUILDING', 'ELEVATED', 'HIGH', 'CRITICAL',
  ];

  public build(
    tick: number,
    collection: PressureSignalCollection,
    tier: PressureTier,
    band: PressureBand,
    scoreHistory: readonly number[],
    tierHistory: readonly PressureTier[],
    bandHistory: readonly PressureBand[],
  ): PressureDLTensor {
    const currentFrame = this.buildCurrentFrame(collection, tier, band);
    const inputSequence = this.buildInputSequence(
      scoreHistory,
      tierHistory,
      bandHistory,
    );
    const tierOneHot = this.buildTierOneHot(tier);
    const bandOneHot = this.buildBandOneHot(band);
    const signalPresenceMask = this.buildSignalPresenceMask(collection);
    const signalMagnitudes = this.buildSignalMagnitudes(collection);
    const attentionWeights = this.buildAttentionWeights(collection, tier);
    const encodedHistory = this.buildEncodedHistory(scoreHistory);
    const labelVector = this.buildLabelVector(tier, band, collection);

    return Object.freeze({
      version: PRESSURE_ENGINE_MODULE_VERSION,
      tick,
      sequenceLength: PRESSURE_ENGINE_DL_SEQUENCE_LENGTH,
      featureCount: PRESSURE_ENGINE_DL_FEATURE_COUNT,
      inputSequence: Object.freeze(inputSequence.map((frame) => Object.freeze(frame))),
      currentFrame: Object.freeze(currentFrame),
      tierOneHot: Object.freeze(tierOneHot),
      bandOneHot: Object.freeze(bandOneHot),
      signalPresenceMask: Object.freeze(signalPresenceMask),
      signalMagnitudes: Object.freeze(signalMagnitudes),
      attentionWeights: Object.freeze(attentionWeights),
      encodedHistory: Object.freeze(encodedHistory),
      labelVector: Object.freeze(labelVector),
    });
  }

  private buildCurrentFrame(
    collection: PressureSignalCollection,
    tier: PressureTier,
    band: PressureBand,
  ): number[] {
    const zeroMap = createZeroPressureSignalMap();
    const frame: number[] = [];

    for (const key of PRESSURE_SIGNAL_KEYS) {
      const pressure = collection.pressureBreakdown[key] ?? zeroMap[key];
      const relief = collection.reliefBreakdown[key] ?? zeroMap[key];
      const net = collection.netBreakdown[key] ?? 0;
      frame.push(
        clampPressureScore(pressure),
        clampPressureScore(relief),
        clampPressureScore(Math.max(0, net)),
      );
    }

    frame.push(
      clampPressureScore(collection.rawScore),
      clampPressureScore(collection.score),
      rankPressureTier(tier) / 4,
      rankPressureBand(band) / 4,
    );

    return frame;
  }

  private buildInputSequence(
    scoreHistory: readonly number[],
    tierHistory: readonly PressureTier[],
    bandHistory: readonly PressureBand[],
  ): number[][] {
    const length = PRESSURE_ENGINE_DL_SEQUENCE_LENGTH;
    const sequence: number[][] = [];

    for (let i = 0; i < length; i++) {
      const histIndex = scoreHistory.length - length + i;
      if (histIndex < 0) {
        sequence.push(new Array(8).fill(0));
        continue;
      }
      const score = clampPressureScore(scoreHistory[histIndex] ?? 0);
      const tierRank = tierHistory[histIndex]
        ? rankPressureTier(tierHistory[histIndex]) / 4
        : 0;
      const bandRank = bandHistory[histIndex]
        ? rankPressureBand(bandHistory[histIndex]) / 4
        : 0;
      const isHighTier = tierRank >= 0.6 ? 1 : 0;
      const isCritical = tierRank >= 0.9 ? 1 : 0;

      const scoreDelta =
        histIndex > 0
          ? clampPressureScore(
              Math.abs(
                (scoreHistory[histIndex] ?? 0) -
                  (scoreHistory[histIndex - 1] ?? 0),
              ),
            )
          : 0;

      sequence.push([score, tierRank, bandRank, isHighTier, isCritical, scoreDelta, 1, 0]);
    }

    return sequence;
  }

  private buildTierOneHot(tier: PressureTier): number[] {
    return PressureDLBuilder.TIER_CODES.map((t) => (t === tier ? 1 : 0));
  }

  private buildBandOneHot(band: PressureBand): number[] {
    return PressureDLBuilder.BAND_CODES.map((b) => (b === band ? 1 : 0));
  }

  private buildSignalPresenceMask(
    collection: PressureSignalCollection,
  ): Record<PressureSignalKey, 0 | 1> {
    const mask = {} as Record<PressureSignalKey, 0 | 1>;
    const zeroMap = createZeroPressureSignalMap();
    for (const key of PRESSURE_SIGNAL_KEYS) {
      const pressureVal = collection.pressureBreakdown[key] ?? zeroMap[key];
      const reliefVal = collection.reliefBreakdown[key] ?? zeroMap[key];
      mask[key] = pressureVal > 0 || reliefVal > 0 ? 1 : 0;
    }
    return mask;
  }

  private buildSignalMagnitudes(
    collection: PressureSignalCollection,
  ): Record<PressureSignalKey, number> {
    const magnitudes = {} as Record<PressureSignalKey, number>;
    const zeroMap = createZeroPressureSignalMap();
    for (const key of PRESSURE_SIGNAL_KEYS) {
      const pressure = collection.pressureBreakdown[key] ?? zeroMap[key];
      const relief = collection.reliefBreakdown[key] ?? zeroMap[key];
      magnitudes[key] = clampPressureScore(pressure + relief);
    }
    return magnitudes;
  }

  private buildAttentionWeights(
    collection: PressureSignalCollection,
    tier: PressureTier,
  ): number[] {
    const tierConfig = PRESSURE_TIER_CONFIGS[tier];
    const tierWeight = 1 + rankPressureTier(tier) * 0.25;
    const sortedContributions = [...collection.contributions].sort(
      (a, b) => b.amount - a.amount,
    );

    return PRESSURE_SIGNAL_KEYS.map((key) => {
      const contribution = sortedContributions.find((c) => c.key === key);
      if (!contribution) return 0;
      const base = normalizeWeight(contribution.amount);
      const tierBoost = tierConfig.allowsHaterInjection ? 1.2 : 1.0;
      return clampPressureScore(base * tierWeight * tierBoost);
    });
  }

  private buildEncodedHistory(scoreHistory: readonly number[]): number[] {
    const length = PRESSURE_ENGINE_DL_SEQUENCE_LENGTH;
    const recent = scoreHistory.slice(-length);
    const padded = [
      ...new Array<number>(Math.max(0, length - recent.length)).fill(0),
      ...recent,
    ];
    return padded.map((s) => clampPressureScore(s));
  }

  private buildLabelVector(
    tier: PressureTier,
    band: PressureBand,
    collection: PressureSignalCollection,
  ): number[] {
    const isHighPressure = tier === 'T3' || tier === 'T4' ? 1 : 0;
    const isCritical = tier === 'T4' ? 1 : 0;
    const hasActiveRelief =
      collection.reliefContributions.length > 0 ? 1 : 0;
    const netRising = collection.rawScore > 0.5 ? 1 : 0;
    const bandRankNorm = rankPressureBand(band) / 4;
    return [
      isHighPressure,
      isCritical,
      hasActiveRelief,
      netRising,
      bandRankNorm,
    ];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § PRESSURE TREND ANALYZER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyzes score, tier, and band history to produce velocity, acceleration,
 * spike detection, and plateau detection.
 * Uses PRESSURE_TREND_WINDOW, PRESSURE_HISTORY_DEPTH, rankPressureTier, rankPressureBand.
 */
export class PressureTrendAnalyzer {
  public analyze(
    scoreHistory: readonly number[],
    tierHistory: readonly PressureTier[],
    bandHistory: readonly PressureBand[],
  ): PressureTrendSummary {
    const window = Math.min(PRESSURE_TREND_WINDOW, scoreHistory.length);
    const recentScores = scoreHistory.slice(-window);
    const recentTiers = tierHistory.slice(-window);
    const recentBands = bandHistory.slice(-window);

    const velocity = this.computeVelocity(recentScores);
    const acceleration = this.computeAcceleration(recentScores);
    const meanScore = this.computeMean(recentScores);
    const stdDevScore = this.computeStdDev(recentScores, meanScore);
    const isSpike = this.detectSpike(recentScores, stdDevScore);
    const plateauAtHighTier = this.detectPlateauAtHighTier(recentTiers);
    const isPlateau = this.detectPlateau(recentScores);
    const tierTransitionsInWindow = this.countTierTransitions(recentTiers);
    const bandTransitionsInWindow = this.countBandTransitions(recentBands);
    const dominantTierInWindow = this.findDominantTier(recentTiers);
    const dominantBandInWindow = this.findDominantBand(recentBands);

    return Object.freeze({
      window,
      velocity,
      acceleration,
      isRising: velocity > 0.005,
      isFalling: velocity < -0.005,
      isStable: Math.abs(velocity) <= 0.005,
      isSpike,
      isPlateau,
      plateauAtHighTier,
      meanScore: clampPressureScore(meanScore),
      stdDevScore: clampPressureScore(stdDevScore),
      tierTransitionsInWindow,
      bandTransitionsInWindow,
      dominantTierInWindow,
      dominantBandInWindow,
      maxScoreInWindow: recentScores.length > 0 ? Math.max(...recentScores) : 0,
      minScoreInWindow: recentScores.length > 0 ? Math.min(...recentScores) : 0,
    });
  }

  private computeVelocity(scores: readonly number[]): number {
    if (scores.length < 2) return 0;
    const recent = scores[scores.length - 1] ?? 0;
    const older = scores[scores.length - 2] ?? 0;
    return Number((recent - older).toFixed(6));
  }

  private computeAcceleration(scores: readonly number[]): number {
    if (scores.length < 3) return 0;
    const v1 =
      (scores[scores.length - 1] ?? 0) - (scores[scores.length - 2] ?? 0);
    const v2 =
      (scores[scores.length - 2] ?? 0) - (scores[scores.length - 3] ?? 0);
    return Number((v1 - v2).toFixed(6));
  }

  private computeMean(scores: readonly number[]): number {
    if (scores.length === 0) return 0;
    return scores.reduce((sum, s) => sum + s, 0) / scores.length;
  }

  private computeStdDev(scores: readonly number[], mean: number): number {
    if (scores.length < 2) return 0;
    const variance =
      scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) /
      scores.length;
    return Math.sqrt(variance);
  }

  private detectSpike(
    scores: readonly number[],
    stdDev: number,
  ): boolean {
    if (scores.length < 2 || stdDev < 0.001) return false;
    const latest = scores[scores.length - 1] ?? 0;
    const prev = scores[scores.length - 2] ?? 0;
    return Math.abs(latest - prev) > stdDev * 2.5;
  }

  private detectPlateau(scores: readonly number[]): boolean {
    if (scores.length < PRESSURE_TREND_WINDOW) return false;
    const range =
      Math.max(...scores) - Math.min(...scores);
    return range < 0.02;
  }

  private detectPlateauAtHighTier(tiers: readonly PressureTier[]): boolean {
    if (tiers.length < 2) return false;
    return tiers.every(
      (tier) => tier === 'T3' || tier === 'T4',
    );
  }

  private countTierTransitions(tiers: readonly PressureTier[]): number {
    let count = 0;
    for (let i = 1; i < tiers.length; i++) {
      if (tiers[i] !== tiers[i - 1]) count++;
    }
    return count;
  }

  private countBandTransitions(bands: readonly PressureBand[]): number {
    let count = 0;
    for (let i = 1; i < bands.length; i++) {
      if (bands[i] !== bands[i - 1]) count++;
    }
    return count;
  }

  private findDominantTier(tiers: readonly PressureTier[]): PressureTier | null {
    if (tiers.length === 0) return null;
    const counts = new Map<PressureTier, number>();
    for (const tier of tiers) {
      counts.set(tier, (counts.get(tier) ?? 0) + 1);
    }
    let dominant: PressureTier | null = null;
    let maxCount = 0;
    for (const [tier, count] of counts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        dominant = tier;
      }
    }
    return dominant;
  }

  private findDominantBand(bands: readonly PressureBand[]): PressureBand | null {
    if (bands.length === 0) return null;
    const counts = new Map<PressureBand, number>();
    for (const band of bands) {
      counts.set(band, (counts.get(band) ?? 0) + 1);
    }
    let dominant: PressureBand | null = null;
    let maxCount = 0;
    for (const [band, count] of counts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        dominant = band;
      }
    }
    return dominant;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § PRESSURE RECOVERY FORECASTER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Forecasts recovery ticks using ALL public methods on PressureDecayController.
 * Uses getPressureTierMinScore, PRESSURE_THRESHOLDS to compute tier-boundary estimates.
 */
export class PressureRecoveryForecaster {
  public forecast(
    snapshot: RunStateSnapshot,
    decayCtrl: PressureDecayController,
  ): PressureRecoveryForecast {
    const decayProfile = decayCtrl.getProfile(snapshot);
    const currentScore = clampPressureScore(snapshot.pressure.score);
    const currentTier = resolvePressureTier(currentScore);

    const estimatedTicksToCalm = decayCtrl.estimateTicksToCalm(snapshot);
    const estimatedTicksToT0 = decayCtrl.estimateTicksToScore(snapshot, 0);
    const estimatedTicksToT1 = decayCtrl.estimateTicksToScore(
      snapshot,
      getPressureTierMinScore('T1'),
    );
    const estimatedTicksToT2 = decayCtrl.estimateTicksToScore(
      snapshot,
      getPressureTierMinScore('T2'),
    );

    const tierRank = rankPressureTier(currentTier);
    const nextTierDownEntry = PRESSURE_THRESHOLDS.find(
      (t) => rankPressureTier(t.value) === tierRank - 1,
    );
    const nextTierDownScore = nextTierDownEntry
      ? nextTierDownEntry.minScore
      : 0;
    const estimatedTicksToNextTierDown = decayCtrl.estimateTicksToScore(
      snapshot,
      nextTierDownScore,
    );

    const isTierLocked =
      decayProfile.tierRetentionFloor > 0 &&
      currentScore <= decayProfile.tierRetentionFloor + 0.05;

    return Object.freeze({
      currentScore,
      currentTier,
      estimatedTicksToCalm,
      estimatedTicksToT0,
      estimatedTicksToT1,
      estimatedTicksToT2,
      estimatedTicksToNextTierDown,
      stickyFloor: decayProfile.stickyFloor,
      maxDropPerTick: decayProfile.maxDropPerTick,
      isTierLocked,
      decayProfile,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § PRESSURE ANNOTATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Produces rich tier/band/driver annotations for dossier and replay surfaces.
 * Uses PRESSURE_TIER_CONFIGS, PRESSURE_THRESHOLDS, PRESSURE_BAND_THRESHOLDS,
 * rankPressureTier, rankPressureBand.
 */
export class PressureAnnotator {
  public annotate(
    tick: number,
    snapshot: RunStateSnapshot,
    collection: PressureSignalCollection,
    tier: PressureTier,
    band: PressureBand,
  ): PressureAnnotationBundle {
    const tierConfig = PRESSURE_TIER_CONFIGS[tier];
    const tierAnnotation = this.buildTierAnnotation(tier, tierConfig);
    const bandAnnotation = this.buildBandAnnotation(band, collection);
    const driverAnnotation = this.buildDriverAnnotation(collection.contributions);
    const reliefAnnotation = this.buildReliefAnnotation(
      collection.reliefContributions,
    );
    const compositeNote = this.buildCompositeNote(
      tier,
      band,
      tierConfig,
      collection,
    );

    const activeSignals = PRESSURE_SIGNAL_KEYS.filter(
      (key) =>
        (collection.pressureBreakdown[key] ?? 0) > 0 ||
        (collection.reliefBreakdown[key] ?? 0) > 0,
    );

    const inactiveSignals = PRESSURE_SIGNAL_KEYS.filter(
      (key) =>
        (collection.pressureBreakdown[key] ?? 0) === 0 &&
        (collection.reliefBreakdown[key] ?? 0) === 0,
    );

    const modeSignals = collection.contributions
      .filter((c) => c.modeScoped)
      .map((c) => c.key);

    const globalSignals = collection.contributions
      .filter((c) => !c.modeScoped)
      .map((c) => c.key);

    const netPressureDirection: PressureSignalPolarity =
      collection.rawPositiveScore >= collection.rawReliefScore
        ? 'PRESSURE'
        : 'RELIEF';

    return Object.freeze({
      tick,
      tierLabel: tierConfig.label,
      bandLabel: band,
      tierConfig,
      tierAnnotation,
      bandAnnotation,
      driverAnnotation,
      reliefAnnotation,
      compositeNote,
      activeSignals: Object.freeze(activeSignals),
      inactiveSignals: Object.freeze(inactiveSignals),
      modeSignals: Object.freeze(modeSignals),
      globalSignals: Object.freeze(globalSignals),
      positiveSignalCount: collection.contributions.length,
      reliefSignalCount: collection.reliefContributions.length,
      netPressureDirection,
      allowsHaterInjection: tierConfig.allowsHaterInjection,
      passiveShieldDrain: tierConfig.passiveShieldDrain,
    });
  }

  private buildTierAnnotation(
    tier: PressureTier,
    config: PressureTierConfig,
  ): string {
    const tierRank = rankPressureTier(tier);
    const nextThreshold = PRESSURE_THRESHOLDS.find(
      (t) => rankPressureTier(t.value) === tierRank + 1,
    );
    const nextBound = nextThreshold
      ? ` — next tier at score ≥ ${nextThreshold.minScore.toFixed(2)}`
      : ' — maximum tier reached';

    const hazards: string[] = [];
    if (config.allowsHaterInjection) hazards.push('HATER_INJECTION_ARMED');
    if (config.passiveShieldDrain) hazards.push('SHIELD_DRAIN_ACTIVE');

    return [
      `Tier ${tier} (${config.label}) — range [${config.minScore.toFixed(2)}, ${config.maxScoreExclusive.toFixed(2)})`,
      nextBound,
      hazards.length > 0 ? `Hazards: ${hazards.join(', ')}` : 'No active hazards',
    ].join('. ');
  }

  private buildBandAnnotation(
    band: PressureBand,
    collection: PressureSignalCollection,
  ): string {
    const bandRank = rankPressureBand(band);
    const nextBandThreshold = PRESSURE_BAND_THRESHOLDS.find(
      (t) => rankPressureBand(t.value) === bandRank + 1,
    );
    const nextBound = nextBandThreshold
      ? `next band at score ≥ ${nextBandThreshold.minScore.toFixed(2)}`
      : 'at maximum band';
    const activeCount =
      collection.contributions.length +
      collection.reliefContributions.length;
    return `Band ${band} — ${activeCount} active signal(s) — ${nextBound}`;
  }

  private buildDriverAnnotation(
    contributions: readonly PressureSignalContribution[],
  ): string {
    if (contributions.length === 0) return 'No active pressure drivers.';
    const top = [...contributions]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, TOP_PRESSURE_SIGNAL_COUNT);
    return top
      .map((c) => `${c.key}=${c.amount.toFixed(3)} (${c.reason})`)
      .join(' | ');
  }

  private buildReliefAnnotation(
    reliefContributions: readonly PressureSignalContribution[],
  ): string {
    if (reliefContributions.length === 0) return 'No active relief signals.';
    const top = [...reliefContributions]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, TOP_PRESSURE_SIGNAL_COUNT);
    return top
      .map((c) => `${c.key}=${c.amount.toFixed(3)} (${c.reason})`)
      .join(' | ');
  }

  private buildCompositeNote(
    tier: PressureTier,
    band: PressureBand,
    config: PressureTierConfig,
    collection: PressureSignalCollection,
  ): string {
    const intensity =
      collection.rawPositiveScore > 0
        ? `Raw pressure: ${collection.rawPositiveScore.toFixed(3)}, relief offset: ${collection.rawReliefScore.toFixed(3)}`
        : 'No raw pressure signals active';
    return `[${tier}/${band}] ${config.label} — ${intensity}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § PRESSURE UX PROJECTOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates urgency labels, chat hooks, and companion commentary from
 * pressure state. Uses PRESSURE_TIER_CONFIGS for labels and
 * DEFAULT_PRESSURE_COLLECTOR_WEIGHTS to explain which factors matter most.
 */
export class PressureUXProjector {
  public project(
    tick: number,
    snapshot: RunStateSnapshot,
    collection: PressureSignalCollection,
    tier: PressureTier,
    band: PressureBand,
    forecast: PressureRecoveryForecast,
  ): PressureUXHint {
    const tierConfig = PRESSURE_TIER_CONFIGS[tier];
    const urgencyLabel = this.buildUrgencyLabel(tier, band);
    const shortHook = this.buildShortHook(tier, band, tierConfig, collection);
    const companionCommentary = this.buildCompanionCommentary(
      tier,
      band,
      collection,
      forecast,
      snapshot,
    );
    const topDriverLabels = this.buildTopDriverLabels(collection);
    const topReliefLabels = this.buildTopReliefLabels(collection);
    const weightedExplanation = this.buildWeightedExplanation(collection);
    const chatChannel = this.resolveChatChannel(tier, snapshot);
    const { shouldInterrupt, interruptReason } = this.resolveInterruptPolicy(
      tier,
      band,
      collection,
    );
    const severityClass = this.resolveSeverityClass(tier, band);

    return Object.freeze({
      tick,
      urgencyLabel,
      shortHook,
      companionCommentary,
      topDriverLabels: Object.freeze(topDriverLabels),
      topReliefLabels: Object.freeze(topReliefLabels),
      weightedExplanation,
      chatChannel,
      shouldInterrupt,
      interruptReason,
      severityClass,
    });
  }

  private buildUrgencyLabel(tier: PressureTier, band: PressureBand): string {
    const tierConfig = PRESSURE_TIER_CONFIGS[tier];
    const bandRank = rankPressureBand(band);
    if (bandRank >= 4) return 'CRITICAL — IMMEDIATE ACTION REQUIRED';
    if (bandRank === 3) return 'HIGH — Situation is dangerous';
    if (bandRank === 2) return 'ELEVATED — Pressure is building significantly';
    if (bandRank === 1) return `BUILDING — ${tierConfig.label} pressure detected`;
    return 'CALM — No significant pressure';
  }

  private buildShortHook(
    tier: PressureTier,
    band: PressureBand,
    config: PressureTierConfig,
    collection: PressureSignalCollection,
  ): string {
    const dominant = collection.dominantPressureKey;
    const tierRank = rankPressureTier(tier);
    if (tierRank >= 4) {
      return dominant
        ? `CRITICAL pressure — ${dominant} is overwhelming your defenses.`
        : 'CRITICAL pressure is active. Your position is at maximum risk.';
    }
    if (tierRank === 3) {
      return dominant
        ? `High pressure — ${dominant} is squeezing you hard.`
        : `High ${config.label} pressure. Shields are draining.`;
    }
    if (tierRank === 2) {
      return `Pressure is elevated at ${config.label}.`;
    }
    if (tierRank === 1) {
      return 'Pressure is building. Watch your position.';
    }
    return 'Position looks clear. Low pressure state.';
  }

  private buildCompanionCommentary(
    tier: PressureTier,
    band: PressureBand,
    collection: PressureSignalCollection,
    forecast: PressureRecoveryForecast,
    snapshot: RunStateSnapshot,
  ): string {
    const tierConfig = PRESSURE_TIER_CONFIGS[tier];
    const tierRank = rankPressureTier(tier);
    const ticksToCalm = forecast.estimatedTicksToCalm;
    const mode = snapshot.mode;

    if (tierRank >= 4) {
      const hazards = [
        tierConfig.allowsHaterInjection && 'Hater injection is live',
        tierConfig.passiveShieldDrain && 'Shield is draining passively',
      ]
        .filter(Boolean)
        .join('. ');
      return `You are in CRITICAL pressure (${band}). ${hazards}. ` +
        `Estimated ${ticksToCalm} tick(s) to calm if nothing changes.`;
    }

    if (tierRank === 3) {
      return `High pressure in ${mode} mode. ${tierConfig.label} state is active. ` +
        `Your shield drain is live. ${ticksToCalm > 0 ? `~${ticksToCalm} tick(s) to ease.` : 'Recovery blocked.'}`;
    }

    if (tierRank === 2) {
      const relief = collection.reliefContributions.length > 0
        ? ` Relief signals detected: ${collection.dominantReliefKey ?? 'mixed'}.`
        : ' No relief signals detected.';
      return `Elevated pressure. ${relief}`;
    }

    if (tierRank === 1) {
      return 'Pressure is beginning to accumulate. Monitor your resources closely.';
    }

    return 'Pressure is nominal. You have room to operate.';
  }

  private buildTopDriverLabels(collection: PressureSignalCollection): string[] {
    return [...collection.contributions]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, TOP_PRESSURE_SIGNAL_COUNT)
      .map((c) => {
        const weight = DEFAULT_PRESSURE_COLLECTOR_WEIGHTS[c.key as PressureSignalKey];
        return `${c.key} (${(c.amount / Math.max(0.001, weight) * 100).toFixed(0)}% of max)`;
      });
  }

  private buildTopReliefLabels(collection: PressureSignalCollection): string[] {
    return [...collection.reliefContributions]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, TOP_PRESSURE_SIGNAL_COUNT)
      .map((c) => {
        const weight = DEFAULT_PRESSURE_COLLECTOR_WEIGHTS[c.key as PressureSignalKey];
        return `${c.key} (${(c.amount / Math.max(0.001, weight) * 100).toFixed(0)}% of max)`;
      });
  }

  private buildWeightedExplanation(collection: PressureSignalCollection): string {
    const limits = DEFAULT_PRESSURE_COLLECTOR_LIMITS;
    const parts: string[] = [];

    if (collection.pressureBreakdown.cash_crisis > 0) {
      parts.push(
        `cash crisis (threshold: $${limits.cashDangerThreshold.toLocaleString()})`,
      );
    }
    if (collection.pressureBreakdown.shield_damage > 0) {
      parts.push(
        `shield damage (critical floor: ${(limits.criticalShieldThreshold * 100).toFixed(0)}%)`,
      );
    }
    if (collection.pressureBreakdown.hater_heat > 0) {
      parts.push(
        `hater heat (threshold: ${limits.haterHeatThreshold}, max: ${limits.haterHeatMax})`,
      );
    }
    if (collection.pressureBreakdown.time_burn > 0) {
      parts.push(`time burn (last third of season budget)`);
    }

    if (parts.length === 0 && collection.rawScore <= 0) {
      return 'No pressure drivers active.';
    }
    if (parts.length === 0) {
      return `Pressure at ${collection.score.toFixed(3)} from miscellaneous sources.`;
    }
    return `Driven by: ${parts.join(', ')}.`;
  }

  private resolveChatChannel(
    tier: PressureTier,
    snapshot: RunStateSnapshot,
  ): 'GLOBAL' | 'SYNDICATE' | 'DEAL_ROOM' | 'SYSTEM_SHADOW' {
    if (tier === 'T4') return 'GLOBAL';
    if (tier === 'T3') return snapshot.mode === 'coop' ? 'SYNDICATE' : 'GLOBAL';
    if (snapshot.mode === 'pvp') return 'SYNDICATE';
    if (snapshot.mode === 'coop') return 'SYNDICATE';
    return 'SYSTEM_SHADOW';
  }

  private resolveInterruptPolicy(
    tier: PressureTier,
    band: PressureBand,
    collection: PressureSignalCollection,
  ): { shouldInterrupt: boolean; interruptReason: string | null } {
    if (tier === 'T4') {
      return {
        shouldInterrupt: true,
        interruptReason: `CRITICAL pressure — band ${band} — top driver: ${collection.dominantPressureKey ?? 'unknown'}`,
      };
    }
    if (tier === 'T3' && band === 'HIGH') {
      return {
        shouldInterrupt: true,
        interruptReason: `HIGH pressure with active shield drain`,
      };
    }
    return { shouldInterrupt: false, interruptReason: null };
  }

  private resolveSeverityClass(
    tier: PressureTier,
    band: PressureBand,
  ): 'CALM' | 'BUILDING' | 'ELEVATED' | 'HIGH' | 'CRITICAL' {
    const bandRank = rankPressureBand(band);
    if (bandRank >= 4) return 'CRITICAL';
    if (bandRank === 3) return 'HIGH';
    if (bandRank === 2) return 'ELEVATED';
    if (bandRank === 1) return 'BUILDING';
    return 'CALM';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § PRESSURE ENGINE — ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PressureEngine is the authoritative simulation engine for pressure state.
 * It orchestrates all sub-components, calls all public methods on each,
 * produces ML/DL outputs, trend/recovery/annotation/UX surfaces, and emits
 * engine signals through the runtime bus.
 *
 * All imports from types.ts are accessed here or in sub-components above.
 * All public methods on PressureDecayController, PressureSignalCollector,
 * and PressureEventEmitter are exercised each tick.
 */
export class PressureEngine implements SimulationEngine {
  public readonly engineId = 'pressure' as const;

  // ── Sub-components
  private readonly collector = new PressureSignalCollector();
  private readonly decay = new PressureDecayController();
  private readonly emitter = new PressureEventEmitter();

  // ── Analysis classes
  private readonly mlExtractor = new PressureMLExtractor();
  private readonly dlBuilder = new PressureDLBuilder();
  private readonly trendAnalyzer = new PressureTrendAnalyzer();
  private readonly recoveryForecaster = new PressureRecoveryForecaster();
  private readonly annotator = new PressureAnnotator();
  private readonly uxProjector = new PressureUXProjector();

  // ── Score/tier/band/signal history (bounded to PRESSURE_HISTORY_DEPTH)
  private readonly scoreHistory: number[] = [];
  private readonly rawScoreHistory: number[] = [];
  private readonly tierHistory: PressureTier[] = [];
  private readonly bandHistory: PressureBand[] = [];
  private readonly dominantSignalHistory: string[] = [];
  private readonly decayProfileHistory: PressureDecayProfile[] = [];

  // ── Last-produced artifacts
  private lastCollection: PressureSignalCollection | null = null;
  private lastMLVector: PressureMLVector | null = null;
  private lastDLTensor: PressureDLTensor | null = null;
  private lastTrendSummary: PressureTrendSummary | null = null;
  private lastRecoveryForecast: PressureRecoveryForecast | null = null;
  private lastDecayAnalysis: PressureDecayAnalysis | null = null;
  private lastEscalationPrediction: PressureEscalationPrediction | null = null;
  private lastAnnotationBundle: PressureAnnotationBundle | null = null;
  private lastUXHint: PressureUXHint | null = null;

  // ── Active configuration (can be overridden for mode-specific tuning)
  private readonly activeWeights: PressureCollectorWeights =
    mergePressureCollectorWeights(DEFAULT_PRESSURE_COLLECTOR_WEIGHTS, {});
  private readonly activeLimits: PressureCollectorLimits = Object.freeze({
    ...DEFAULT_PRESSURE_COLLECTOR_LIMITS,
  });

  private health: EngineHealth = createEngineHealth(
    this.engineId,
    'HEALTHY',
    Date.now(),
    ['Pressure engine initialized.'],
  );

  // ─────────────────────────────────────────────────────────────────────
  // PUBLIC CONTRACT — SimulationEngine
  // ─────────────────────────────────────────────────────────────────────

  public reset(): void {
    this.scoreHistory.length = 0;
    this.rawScoreHistory.length = 0;
    this.tierHistory.length = 0;
    this.bandHistory.length = 0;
    this.dominantSignalHistory.length = 0;
    this.decayProfileHistory.length = 0;

    this.lastCollection = null;
    this.lastMLVector = null;
    this.lastDLTensor = null;
    this.lastTrendSummary = null;
    this.lastRecoveryForecast = null;
    this.lastDecayAnalysis = null;
    this.lastEscalationPrediction = null;
    this.lastAnnotationBundle = null;
    this.lastUXHint = null;

    this.emitter.reset();

    this.health = createEngineHealth(
      this.engineId,
      'HEALTHY',
      Date.now(),
      ['Pressure engine reset.'],
    );
  }

  public canRun(snapshot: RunStateSnapshot, _context?: TickContext): boolean {
    return snapshot.outcome === null;
  }

  public tick(
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): EngineTickResult {
    if (!this.canRun(snapshot, context)) {
      return {
        snapshot,
        signals: [
          createEngineSignal(
            this.engineId,
            'INFO',
            'PRESSURE_SKIPPED_TERMINAL_OUTCOME',
            'Pressure engine skipped because run outcome is terminal.',
            snapshot.tick,
            [`outcome:${String(snapshot.outcome)}`],
          ),
        ],
      };
    }

    try {
      // ── Step 1: Collect pressure signals
      const collection = this.collector.collect(snapshot);

      // ── Step 2: Apply decay (rise immediately, decay bounded)
      const score = this.decay.apply(snapshot, collection.score);

      // ── Step 3: Resolve tier and band
      const tier = resolvePressureTier(score);
      const band = resolvePressureBand(score);

      // ── Step 4: Build next pressure state
      const nextPressure = this.buildNextPressureState(
        snapshot,
        score,
        tier,
        band,
      );

      // ── Step 5: Get decay profile (exercising getProfile public method)
      const decayProfile = this.decay.getProfile(snapshot);

      // ── Step 6: Recovery forecast (exercising estimateTicksToCalm + estimateTicksToScore)
      const recoveryForecast = this.recoveryForecaster.forecast(
        snapshot,
        this.decay,
      );

      // ── Step 7: Record all bounded history
      this.recordRuntimeHistory(collection, nextPressure, tier, band, decayProfile);

      // ── Step 8: Trend analysis
      const trendSummary = this.trendAnalyzer.analyze(
        this.scoreHistory,
        this.tierHistory,
        this.bandHistory,
      );

      // ── Step 9: ML vector
      const mlVector = this.mlExtractor.extract(
        snapshot.tick,
        snapshot,
        collection,
        tier,
        band,
        snapshot.pressure,
        nextPressure,
        trendSummary,
        recoveryForecast,
        decayProfile,
      );

      // ── Step 10: DL tensor
      const dlTensor = this.dlBuilder.build(
        snapshot.tick,
        collection,
        tier,
        band,
        this.scoreHistory,
        this.tierHistory,
        this.bandHistory,
      );

      // ── Step 11: Decay analysis
      const decayAnalysis = this.buildDecayAnalysis(snapshot, decayProfile);

      // ── Step 12: Escalation prediction
      const escalationPrediction = this.buildEscalationPrediction(
        nextPressure,
        tier,
        band,
      );

      // ── Step 13: Annotation bundle
      const annotationBundle = this.annotator.annotate(
        snapshot.tick,
        snapshot,
        collection,
        tier,
        band,
      );

      // ── Step 14: UX hint
      const uxHint = this.uxProjector.project(
        snapshot.tick,
        snapshot,
        collection,
        tier,
        band,
        recoveryForecast,
      );

      // ── Step 15: Emit bus events and emission signals
      const emissionMeta: PressureEmissionMeta = {
        tick: snapshot.tick,
        dominantSignals: this.extractDominantSignalKeys(collection),
        scoreDelta: Number(
          (nextPressure.score - snapshot.pressure.score).toFixed(6),
        ),
      };

      const emission = this.emitter.emit(
        context.bus,
        snapshot.pressure,
        nextPressure,
        emissionMeta,
      );

      // ── Step 16: Build diagnostic signals
      const diagnosticSignals = this.buildDiagnosticSignals(
        snapshot,
        nextPressure,
        collection,
        trendSummary,
        recoveryForecast,
        decayAnalysis,
        escalationPrediction,
        context,
      );

      const nextSnapshot: RunStateSnapshot = {
        ...snapshot,
        pressure: nextPressure,
      };

      const signals = [...diagnosticSignals, ...emission.signals];

      // ── Store artifacts
      this.lastCollection = collection;
      this.lastMLVector = mlVector;
      this.lastDLTensor = dlTensor;
      this.lastTrendSummary = trendSummary;
      this.lastRecoveryForecast = recoveryForecast;
      this.lastDecayAnalysis = decayAnalysis;
      this.lastEscalationPrediction = escalationPrediction;
      this.lastAnnotationBundle = annotationBundle;
      this.lastUXHint = uxHint;

      this.health = createEngineHealth(
        this.engineId,
        signals.some((s) => s.severity === 'ERROR') ? 'DEGRADED' : 'HEALTHY',
        context.nowMs,
        this.buildHealthNotes(collection, nextPressure, trendSummary, recoveryForecast),
      );

      return { snapshot: nextSnapshot, signals };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown pressure engine failure.';

      this.health = createEngineHealth(
        this.engineId,
        'FAILED',
        context.nowMs,
        [message],
      );

      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // PUBLIC ACCESSORS
  // ─────────────────────────────────────────────────────────────────────

  public getHealth(): EngineHealth {
    return this.health;
  }

  public getScoreHistory(): readonly number[] {
    return Object.freeze([...this.scoreHistory]);
  }

  public getRawScoreHistory(): readonly number[] {
    return Object.freeze([...this.rawScoreHistory]);
  }

  public getTierHistory(): readonly PressureTier[] {
    return Object.freeze([...this.tierHistory]);
  }

  public getBandHistory(): readonly PressureBand[] {
    return Object.freeze([...this.bandHistory]);
  }

  public getDominantSignalHistory(): readonly string[] {
    return Object.freeze([...this.dominantSignalHistory]);
  }

  public getDecayProfileHistory(): readonly PressureDecayProfile[] {
    return Object.freeze([...this.decayProfileHistory]);
  }

  public getLastSignalCollection(): PressureSignalCollection | null {
    return this.lastCollection;
  }

  public getLastMLVector(): PressureMLVector | null {
    return this.lastMLVector;
  }

  public getLastDLTensor(): PressureDLTensor | null {
    return this.lastDLTensor;
  }

  public getLastTrendSummary(): PressureTrendSummary | null {
    return this.lastTrendSummary;
  }

  public getLastRecoveryForecast(): PressureRecoveryForecast | null {
    return this.lastRecoveryForecast;
  }

  public getLastDecayAnalysis(): PressureDecayAnalysis | null {
    return this.lastDecayAnalysis;
  }

  public getLastEscalationPrediction(): PressureEscalationPrediction | null {
    return this.lastEscalationPrediction;
  }

  public getLastAnnotationBundle(): PressureAnnotationBundle | null {
    return this.lastAnnotationBundle;
  }

  public getLastUXHint(): PressureUXHint | null {
    return this.lastUXHint;
  }

  /** Compute a live recovery forecast from any snapshot. */
  public computeRecoveryForecast(
    snapshot: RunStateSnapshot,
  ): PressureRecoveryForecast {
    return this.recoveryForecaster.forecast(snapshot, this.decay);
  }

  /** Compute a live escalation prediction from any snapshot+state. */
  public computeEscalationPrediction(
    pressure: PressureState,
  ): PressureEscalationPrediction {
    const tier = resolvePressureTier(pressure.score);
    const band = resolvePressureBand(pressure.score);
    return this.buildEscalationPrediction(pressure, tier, band);
  }

  /** Full inspector state for debug, replay, and admin surfaces. */
  public getInspectorState(): PressureInspectorState {
    return Object.freeze({
      engineId: this.engineId,
      version: PRESSURE_ENGINE_MODULE_VERSION,
      health: this.health,
      scoreHistory: this.getScoreHistory(),
      rawScoreHistory: this.getRawScoreHistory(),
      tierHistory: this.getTierHistory(),
      bandHistory: this.getBandHistory(),
      dominantSignalHistory: this.getDominantSignalHistory(),
      decayProfileHistory: this.getDecayProfileHistory(),
      activeWeights: this.activeWeights,
      activeLimits: this.activeLimits,
      defaultMaxDecayPerTick: DEFAULT_MAX_DECAY_PER_TICK,
      historyDepth: PRESSURE_HISTORY_DEPTH,
      trendWindow: PRESSURE_TREND_WINDOW,
      topSignalCount: TOP_PRESSURE_SIGNAL_COUNT,
      mlFeatureCount: PRESSURE_ENGINE_ML_FEATURE_COUNT,
      dlFeatureCount: PRESSURE_ENGINE_DL_FEATURE_COUNT,
      dlSequenceLength: PRESSURE_ENGINE_DL_SEQUENCE_LENGTH,
      lastMLVector: this.lastMLVector,
      lastDLTensor: this.lastDLTensor,
      lastTrendSummary: this.lastTrendSummary,
      lastAnnotationBundle: this.lastAnnotationBundle,
      lastUXHint: this.lastUXHint,
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // PRIVATE — STATE BUILDING
  // ─────────────────────────────────────────────────────────────────────

  private buildNextPressureState(
    snapshot: RunStateSnapshot,
    score: number,
    tier: PressureTier,
    band: PressureBand,
  ): PressureState {
    const prevTierRank = rankPressureTier(snapshot.pressure.tier);
    const nextTierRank = rankPressureTier(tier);
    const prevBandRank = rankPressureBand(snapshot.pressure.band);
    const nextBandRank = rankPressureBand(band);

    const tierEscalated = nextTierRank > prevTierRank;
    const bandEscalated = nextBandRank > prevBandRank;
    const isHighTier = tier === 'T3' || tier === 'T4';

    return {
      score,
      tier,
      band,
      previousTier: snapshot.pressure.tier,
      previousBand: snapshot.pressure.band,
      upwardCrossings:
        snapshot.pressure.upwardCrossings + (tierEscalated ? 1 : 0),
      survivedHighPressureTicks:
        snapshot.pressure.survivedHighPressureTicks + (isHighTier ? 1 : 0),
      lastEscalationTick:
        tierEscalated || bandEscalated
          ? snapshot.tick
          : snapshot.pressure.lastEscalationTick,
      maxScoreSeen: Math.max(snapshot.pressure.maxScoreSeen, score),
    };
  }

  private buildDecayAnalysis(
    snapshot: RunStateSnapshot,
    profile: PressureDecayProfile,
  ): PressureDecayAnalysis {
    const isSlowerThanDefault =
      profile.maxDropPerTick < DEFAULT_MAX_DECAY_PER_TICK;
    const decayRatio = normalizeWeight(
      profile.maxDropPerTick / DEFAULT_MAX_DECAY_PER_TICK,
    );
    const tierRetentionActive = profile.tierRetentionFloor > 0;
    const stickyFloorActive = profile.stickyFloor > 0;

    const estimatedConstraintTicks =
      isSlowerThanDefault && snapshot.pressure.score > profile.stickyFloor
        ? Math.ceil(
            (snapshot.pressure.score - profile.stickyFloor) /
              profile.maxDropPerTick,
          )
        : 0;

    return Object.freeze({
      profile,
      isSlowerThanDefault,
      decayRatio,
      activeConstraints: profile.reasons,
      tierRetentionActive,
      stickyFloorActive,
      estimatedConstraintTicks,
    });
  }

  private buildEscalationPrediction(
    pressure: PressureState,
    tier: PressureTier,
    band: PressureBand,
  ): PressureEscalationPrediction {
    const tierRank = rankPressureTier(tier);
    const bandRank = rankPressureBand(band);
    const atMaxTier = tierRank >= 4;
    const atMaxBand = bandRank >= 4;

    const nextTierThreshold = PRESSURE_THRESHOLDS.find(
      (t) => rankPressureTier(t.value) === tierRank + 1,
    ) ?? null;

    const nextBandThreshold = PRESSURE_BAND_THRESHOLDS.find(
      (t) => rankPressureBand(t.value) === bandRank + 1,
    ) ?? null;

    const distanceToNextTierEscalation = nextTierThreshold
      ? Math.max(0, nextTierThreshold.minScore - pressure.score)
      : 0;
    const distanceToNextBandEscalation = nextBandThreshold
      ? Math.max(0, nextBandThreshold.minScore - pressure.score)
      : 0;

    const escalationProximity = nextTierThreshold
      ? clampPressureScore(
          1 -
            distanceToNextTierEscalation /
              Math.max(
                0.001,
                nextTierThreshold.minScore - getPressureTierMinScore(tier),
              ),
        )
      : 0;

    return Object.freeze({
      currentTier: tier,
      currentBand: band,
      currentScore: pressure.score,
      nextTierThreshold,
      nextBandThreshold,
      distanceToNextTierEscalation,
      distanceToNextBandEscalation,
      escalationProximity,
      atMaxTier,
      atMaxBand,
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // PRIVATE — DIAGNOSTIC SIGNALS
  // ─────────────────────────────────────────────────────────────────────

  private buildDiagnosticSignals(
    snapshot: RunStateSnapshot,
    nextPressure: PressureState,
    collection: PressureSignalCollection,
    trend: PressureTrendSummary,
    forecast: PressureRecoveryForecast,
    decay: PressureDecayAnalysis,
    escalation: PressureEscalationPrediction,
    context: TickContext,
  ): readonly EngineSignal[] {
    const signals: EngineSignal[] = [];
    const dominantSignals = this.extractDominantSignalKeys(collection);
    const traceTag = `trace:${context.trace.traceId}`;

    // New high watermark
    if (nextPressure.maxScoreSeen > snapshot.pressure.maxScoreSeen) {
      signals.push(
        createEngineSignal(
          this.engineId,
          this.isHighTier(nextPressure.tier) ? 'WARN' : 'INFO',
          'PRESSURE_NEW_HIGH_WATERMARK',
          `Pressure reached a new high watermark of ${nextPressure.score.toFixed(3)}.`,
          snapshot.tick,
          [
            traceTag,
            `tier:${nextPressure.tier}`,
            `band:${nextPressure.band}`,
            ...dominantSignals.map((v) => `driver:${v}`),
          ],
        ),
      );
    }

    // High pressure persistence milestones
    if (
      this.isHighTier(nextPressure.tier) &&
      HIGH_PRESSURE_MILESTONES.has(nextPressure.survivedHighPressureTicks)
    ) {
      signals.push(
        createEngineSignal(
          this.engineId,
          'WARN',
          'PRESSURE_HIGH_PERSISTENCE',
          `High pressure has persisted for ${nextPressure.survivedHighPressureTicks} tick(s).`,
          snapshot.tick,
          [
            `tier:${nextPressure.tier}`,
            `band:${nextPressure.band}`,
            ...dominantSignals.map((v) => `driver:${v}`),
          ],
        ),
      );
    }

    // Dominant driver at high pressure
    const topContribution = [...collection.contributions].sort(
      (a, b) => b.amount - a.amount,
    )[0];

    if (
      topContribution &&
      nextPressure.score >= 0.55 &&
      topContribution.amount >= 0.10
    ) {
      signals.push(
        createEngineSignal(
          this.engineId,
          'WARN',
          'PRESSURE_DOMINANT_DRIVER',
          `${topContribution.key} is the dominant pressure driver at ${topContribution.amount.toFixed(3)} contribution.`,
          snapshot.tick,
          [
            `tier:${nextPressure.tier}`,
            `band:${nextPressure.band}`,
            `delta:${(nextPressure.score - snapshot.pressure.score).toFixed(3)}`,
          ],
        ),
      );
    }

    // Full relief
    if (
      nextPressure.score === 0 &&
      collection.contributions.length === 0 &&
      snapshot.pressure.score > 0
    ) {
      signals.push(
        createEngineSignal(
          this.engineId,
          'INFO',
          'PRESSURE_FULL_RELIEF',
          'Pressure fully returned to calm with no active contributing signals.',
          snapshot.tick,
          [traceTag],
        ),
      );
    }

    // Trend spike
    if (trend.isSpike) {
      signals.push(
        createEngineSignal(
          this.engineId,
          'WARN',
          'PRESSURE_TREND_SPIKE',
          `Pressure spike detected — velocity ${trend.velocity.toFixed(4)}, acceleration ${trend.acceleration.toFixed(4)}.`,
          snapshot.tick,
          [
            `tier:${nextPressure.tier}`,
            `band:${nextPressure.band}`,
            `velocity:${trend.velocity.toFixed(4)}`,
            `acceleration:${trend.acceleration.toFixed(4)}`,
          ],
        ),
      );
    }

    // High plateau
    if (trend.plateauAtHighTier) {
      signals.push(
        createEngineSignal(
          this.engineId,
          'WARN',
          'PRESSURE_HIGH_TIER_PLATEAU',
          `Pressure has plateaued at high tier for ${trend.window} tick window.`,
          snapshot.tick,
          [
            `tier:${nextPressure.tier}`,
            `mean:${trend.meanScore.toFixed(3)}`,
            `window:${trend.window}`,
          ],
        ),
      );
    }

    // Hater injection armed signal
    if (PRESSURE_TIER_CONFIGS[nextPressure.tier].allowsHaterInjection) {
      signals.push(
        createEngineSignal(
          this.engineId,
          'WARN',
          'PRESSURE_HATER_INJECTION_ARMED',
          `Tier ${nextPressure.tier} — hater injection is now armed.`,
          snapshot.tick,
          [
            `tier:${nextPressure.tier}`,
            `score:${nextPressure.score.toFixed(3)}`,
          ],
        ),
      );
    }

    // Passive shield drain signal
    if (PRESSURE_TIER_CONFIGS[nextPressure.tier].passiveShieldDrain) {
      signals.push(
        createEngineSignal(
          this.engineId,
          'WARN',
          'PRESSURE_PASSIVE_SHIELD_DRAIN',
          `Tier ${nextPressure.tier} — passive shield drain is active.`,
          snapshot.tick,
          [`tier:${nextPressure.tier}`, `score:${nextPressure.score.toFixed(3)}`],
        ),
      );
    }

    // Decay constraints active
    if (decay.isSlowerThanDefault && decay.activeConstraints.length > 0) {
      signals.push(
        createEngineSignal(
          this.engineId,
          'INFO',
          'PRESSURE_DECAY_CONSTRAINED',
          `Decay is constrained — max drop ${decay.profile.maxDropPerTick.toFixed(3)} vs default ${DEFAULT_MAX_DECAY_PER_TICK.toFixed(3)}.`,
          snapshot.tick,
          [
            `ratio:${decay.decayRatio.toFixed(3)}`,
            ...decay.activeConstraints.map((r) => `constraint:${r}`),
          ],
        ),
      );
    }

    // Recovery forecast signal
    if (forecast.estimatedTicksToCalm > 0 && this.isHighTier(nextPressure.tier)) {
      signals.push(
        createEngineSignal(
          this.engineId,
          'INFO',
          'PRESSURE_RECOVERY_FORECAST',
          `Estimated ${forecast.estimatedTicksToCalm} tick(s) to calm state from current ${nextPressure.tier}.`,
          snapshot.tick,
          [
            `tier:${nextPressure.tier}`,
            `score:${nextPressure.score.toFixed(3)}`,
            `ticksToCalm:${forecast.estimatedTicksToCalm}`,
            `ticksToNextTierDown:${forecast.estimatedTicksToNextTierDown}`,
            `stickyFloor:${forecast.stickyFloor.toFixed(3)}`,
          ],
        ),
      );
    }

    // Escalation proximity warning
    if (escalation.escalationProximity > 0.8 && !escalation.atMaxTier) {
      signals.push(
        createEngineSignal(
          this.engineId,
          'WARN',
          'PRESSURE_ESCALATION_PROXIMITY',
          `Pressure is ${(escalation.escalationProximity * 100).toFixed(0)}% of the way to the next tier — ${escalation.distanceToNextTierEscalation.toFixed(3)} score gap remaining.`,
          snapshot.tick,
          [
            `tier:${nextPressure.tier}`,
            `proximity:${escalation.escalationProximity.toFixed(3)}`,
            `gap:${escalation.distanceToNextTierEscalation.toFixed(3)}`,
          ],
        ),
      );
    }

    // Tier locked by retention floor
    if (forecast.isTierLocked) {
      signals.push(
        createEngineSignal(
          this.engineId,
          'INFO',
          'PRESSURE_TIER_RETENTION_LOCKED',
          `Tier ${nextPressure.tier} is retained by decay floor ${forecast.decayProfile.tierRetentionFloor.toFixed(3)}.`,
          snapshot.tick,
          [
            `tier:${nextPressure.tier}`,
            `floor:${forecast.decayProfile.tierRetentionFloor.toFixed(3)}`,
            `score:${nextPressure.score.toFixed(3)}`,
          ],
        ),
      );
    }

    // Mode-scoped signal drivers active
    const modeScopedContributions = collection.contributions.filter(
      (c) => c.modeScoped,
    );
    if (modeScopedContributions.length > 0 && nextPressure.score >= 0.35) {
      const modeKeys = modeScopedContributions
        .slice(0, TOP_PRESSURE_SIGNAL_COUNT)
        .map((c) => c.key)
        .join(',');
      signals.push(
        createEngineSignal(
          this.engineId,
          'INFO',
          'PRESSURE_MODE_SIGNALS_ACTIVE',
          `Mode-specific signals contributing: ${modeKeys}.`,
          snapshot.tick,
          [
            `mode:${snapshot.mode}`,
            `tier:${nextPressure.tier}`,
            `modeSignalCount:${modeScopedContributions.length}`,
          ],
        ),
      );
    }

    // Relief reducing high pressure
    if (
      collection.reliefContributions.length > 0 &&
      this.isHighTier(nextPressure.tier)
    ) {
      const topRelief = [...collection.reliefContributions].sort(
        (a, b) => b.amount - a.amount,
      )[0];
      if (topRelief) {
        signals.push(
          createEngineSignal(
            this.engineId,
            'INFO',
            'PRESSURE_RELIEF_ACTIVE_AT_HIGH',
            `Relief signal ${topRelief.key} is countering high pressure at ${topRelief.amount.toFixed(3)}.`,
            snapshot.tick,
            [
              `relief:${topRelief.key}`,
              `tier:${nextPressure.tier}`,
              `reliefAmount:${topRelief.amount.toFixed(3)}`,
            ],
          ),
        );
      }
    }

    return signals;
  }

  // ─────────────────────────────────────────────────────────────────────
  // PRIVATE — HEALTH NOTES
  // ─────────────────────────────────────────────────────────────────────

  private buildHealthNotes(
    collection: PressureSignalCollection,
    nextPressure: PressureState,
    trend: PressureTrendSummary,
    forecast: PressureRecoveryForecast,
  ): readonly string[] {
    const topDrivers = [...collection.contributions]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, TOP_PRESSURE_SIGNAL_COUNT)
      .map((e) => `${e.key}=${e.amount.toFixed(3)}`);

    const tierConfig = PRESSURE_TIER_CONFIGS[nextPressure.tier];

    return [
      `score=${nextPressure.score.toFixed(3)}`,
      `raw=${collection.rawScore.toFixed(3)}`,
      `tier=${nextPressure.tier}(${tierConfig.label})`,
      `band=${nextPressure.band}`,
      `history=${this.scoreHistory.length}`,
      `trend=vel${trend.velocity.toFixed(4)},acc${trend.acceleration.toFixed(4)}`,
      `forecast=calm_in_${forecast.estimatedTicksToCalm}t`,
      ...(topDrivers.length > 0
        ? [`drivers=${topDrivers.join(',')}`]
        : ['drivers=none']),
    ];
  }

  // ─────────────────────────────────────────────────────────────────────
  // PRIVATE — HISTORY MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────

  private recordRuntimeHistory(
    collection: PressureSignalCollection,
    nextPressure: PressureState,
    tier: PressureTier,
    band: PressureBand,
    decayProfile: PressureDecayProfile,
  ): void {
    this.pushBounded(this.scoreHistory, nextPressure.score, PRESSURE_HISTORY_DEPTH);
    this.pushBounded(this.rawScoreHistory, collection.rawScore, PRESSURE_HISTORY_DEPTH);
    this.pushBounded(this.tierHistory, tier, PRESSURE_HISTORY_DEPTH);
    this.pushBounded(this.bandHistory, band, PRESSURE_HISTORY_DEPTH);
    this.pushBounded(this.decayProfileHistory, decayProfile, PRESSURE_HISTORY_DEPTH);

    const dominantSignals = this.extractDominantSignalKeys(collection);
    if (dominantSignals.length > 0) {
      this.pushBounded(
        this.dominantSignalHistory,
        dominantSignals[0],
        PRESSURE_HISTORY_DEPTH,
      );
    }
  }

  private extractDominantSignalKeys(
    collection: PressureSignalCollection,
  ): readonly string[] {
    return Object.freeze(
      [...collection.contributions]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, TOP_PRESSURE_SIGNAL_COUNT)
        .filter((e) => e.amount > 0)
        .map((e) => e.key),
    );
  }

  private pushBounded<T>(buffer: T[], value: T, maxDepth: number): void {
    buffer.push(value);
    if (buffer.length > maxDepth) {
      buffer.shift();
    }
  }

  private isHighTier(tier: PressureTier): boolean {
    return rankPressureTier(tier) >= 3;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § FACTORY + MODULE MANIFEST
// ─────────────────────────────────────────────────────────────────────────────

/** Factory function for clean construction at engine startup. */
export function createPressureEngine(): PressureEngine {
  return new PressureEngine();
}

/** Module manifest for runtime inspection and health dashboards. */
export const PRESSURE_ENGINE_MANIFEST = Object.freeze({
  version: PRESSURE_ENGINE_MODULE_VERSION,
  engineId: 'pressure' as const,
  mlFeatureCount: PRESSURE_ENGINE_ML_FEATURE_COUNT,
  dlFeatureCount: PRESSURE_ENGINE_DL_FEATURE_COUNT,
  dlSequenceLength: PRESSURE_ENGINE_DL_SEQUENCE_LENGTH,
  historyDepth: PRESSURE_HISTORY_DEPTH,
  trendWindow: PRESSURE_TREND_WINDOW,
  topSignalCount: TOP_PRESSURE_SIGNAL_COUNT,
  defaultMaxDecayPerTick: DEFAULT_MAX_DECAY_PER_TICK,
  positiveSignalCount: PRESSURE_POSITIVE_SIGNAL_KEYS.length,
  reliefSignalCount: PRESSURE_RELIEF_SIGNAL_KEYS.length,
  totalSignalCount: PRESSURE_SIGNAL_KEYS.length,
  tierCount: Object.keys(PRESSURE_TIER_CONFIGS).length,
  defaultWeights: DEFAULT_PRESSURE_COLLECTOR_WEIGHTS,
  defaultLimits: DEFAULT_PRESSURE_COLLECTOR_LIMITS,
  subComponents: Object.freeze([
    'PressureSignalCollector',
    'PressureDecayController',
    'PressureEventEmitter',
    'PressureMLExtractor',
    'PressureDLBuilder',
    'PressureTrendAnalyzer',
    'PressureRecoveryForecaster',
    'PressureAnnotator',
    'PressureUXProjector',
  ]),
} as const);
