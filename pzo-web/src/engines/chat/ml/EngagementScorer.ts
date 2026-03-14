
// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/intelligence/ml/EngagementScorer.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ML ENGAGEMENT SCORER
 * FILE: pzo-web/src/engines/chat/intelligence/ml/EngagementScorer.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Production-grade scoring, recommendation, and bridge-inference surface for
 * the frontend chat intelligence lane.
 *
 * This module is not a toy "engagement score" helper.
 * It turns the feature lane into actionable inference that can:
 *
 * - refine local bridge profile state,
 * - recommend the next best visible channel,
 * - surface helper urgency,
 * - preserve controlled hater escalation,
 * - detect rescue need early,
 * - weight crowd/social pressure without flattening mode semantics,
 * - stay merge-safe until backend authority returns.
 *
 * The scorer follows the doctrine already present in the bridge and learning
 * profile modules:
 *
 * - frontend scores first,
 * - backend rules last,
 * - local scoring must be explainable,
 * - cold-start priors matter but must not lock the player forever,
 * - confidence, shame, rescue, and pressure must co-exist in the model.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import type {
  ChatLearningBridgeInferencePort,
  ChatLearningBridgeProfileState,
  ChatLearningBridgePublicSnapshot,
  ChatLearningBridgeRecommendation,
} from '../ChatLearningBridge';

import {
  CHAT_LEARNING_BRIDGE_DEFAULTS,
  CHAT_LEARNING_BRIDGE_MODULE_NAME,
  CHAT_LEARNING_BRIDGE_VERSION,
  CHAT_LEARNING_BRIDGE_CHANNEL_KEYS,
} from '../ChatLearningBridge';

import {
  createChatColdStartProfile,
  createChatColdStartRecommendation,
} from '../ChatColdStartProfile';

import type {
  ChatFeatureSnapshot,
  ChatVisibleChannel,
  Score01,
} from '../types';

import {
  type ChatPressureTier,
  type ChatTickTier,
} from './FeatureExtractor';

/* ========================================================================== */
/* MARK: Public module constants                                              */
/* ========================================================================== */

export const CHAT_ENGAGEMENT_SCORER_MODULE_NAME =
  'PZO_CHAT_ENGAGEMENT_SCORER' as const;

export const CHAT_ENGAGEMENT_SCORER_VERSION =
  '2026.03.13-engagement-scorer.v1' as const;

export const CHAT_ENGAGEMENT_SCORER_RUNTIME_LAWS = Object.freeze([
  'Scoring is advisory and merge-safe.',
  'No recommendation may erase visible-channel freedom.',
  'High pressure may justify rescue urgency, but not automatic panic.',
  'Hater aggression should escalate with tolerance, not merely with exposure.',
  'Drop-off risk must react quickly to failure and silence.',
  'Confidence should recover slower than it collapses.',
  'Cold-start priors are valid inputs, never permanent verdicts.',
  'Every recommendation should be explainable from current state.',
] as const);

export const CHAT_ENGAGEMENT_SCORER_DEFAULTS = Object.freeze({
  helperUrgencyHardThreshold: 0.68,
  helperUrgencySoftThreshold: 0.54,
  rescueThreshold: 0.66,
  haterAggressionFloor: 0.18,
  haterAggressionCeiling: 0.86,
  confidenceRepairAlpha: 0.08,
  dropRiskEscalationAlpha: 0.12,
  channelBiasAlpha: 0.14,
  scoreSmoothingAlpha: 0.18,
  lobbySafetyBias: 0.10,
  dealRoomGuardBias: 0.08,
  globalHeatPenalty: 0.10,
  helperPresenceDampener: 0.18,
  legendRecoveryBonus: 0.10,
  recentReplayReflectionBonus: 0.04,
} as const);

/* ========================================================================== */
/* MARK: Public contracts                                                     */
/* ========================================================================== */

export interface ChatEngagementScorerOptions {
  readonly defaults?: Partial<typeof CHAT_ENGAGEMENT_SCORER_DEFAULTS>;
  readonly allowLowPressureLobbyBias?: boolean;
  readonly allowAggressiveGlobalEscalation?: boolean;
  readonly allowDealRoomGuard?: boolean;
  readonly includeExplanationBreakdown?: boolean;
}

export interface ChatScoreVector {
  readonly engagement01: Score01;
  readonly dropOffRisk01: Score01;
  readonly helperUrgency01: Score01;
  readonly rescueNeed01: Score01;
  readonly haterAggression01: Score01;
  readonly confidence01: Score01;
  readonly shameSensitivity01: Score01;
  readonly socialPressure01: Score01;
  readonly negotiationGuard01: Score01;
  readonly recoveryOpportunity01: Score01;
  readonly legendMomentum01: Score01;
}

export interface ChatChannelRecommendationScores {
  readonly GLOBAL: Score01;
  readonly SYNDICATE: Score01;
  readonly DEAL_ROOM: Score01;
  readonly LOBBY: Score01;
}

export interface ChatEngagementScoreBreakdown {
  readonly moduleName: typeof CHAT_ENGAGEMENT_SCORER_MODULE_NAME;
  readonly moduleVersion: typeof CHAT_ENGAGEMENT_SCORER_VERSION;
  readonly bridgeModuleName: typeof CHAT_LEARNING_BRIDGE_MODULE_NAME;
  readonly bridgeModuleVersion: typeof CHAT_LEARNING_BRIDGE_VERSION;
  readonly channelScores: ChatChannelRecommendationScores;
  readonly vector: ChatScoreVector;
  readonly pressureTier: ChatPressureTier | 'UNKNOWN';
  readonly tickTier: ChatTickTier | 'UNKNOWN';
  readonly explanation: string;
}

export interface ChatEngagementScoreResult {
  readonly recommendedChannel: ChatVisibleChannel;
  readonly vector: ChatScoreVector;
  readonly channelScores: ChatChannelRecommendationScores;
  readonly explanation: string;
  readonly breakdown: ChatEngagementScoreBreakdown;
}

/* ========================================================================== */
/* MARK: Utility helpers                                                      */
/* ========================================================================== */

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function asScore01(value: number): Score01 {
  return clamp01(value) as Score01;
}

function lerp01(current: number, next: number, alpha: number): number {
  return clamp01(current + (next - current) * clamp01(alpha));
}

function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return value;
}

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeVisibleChannel(
  value: unknown,
  fallback: ChatVisibleChannel = 'GLOBAL',
): ChatVisibleChannel {
  if (
    value === 'GLOBAL' ||
    value === 'SYNDICATE' ||
    value === 'DEAL_ROOM' ||
    value === 'LOBBY'
  ) {
    return value;
  }

  return fallback;
}

function ensureChannelScores(
  seed = 0,
): ChatChannelRecommendationScores {
  return {
    GLOBAL: asScore01(seed),
    SYNDICATE: asScore01(seed),
    DEAL_ROOM: asScore01(seed),
    LOBBY: asScore01(seed),
  };
}

function extractFeatureSnapshot(
  snapshot: ChatLearningBridgePublicSnapshot,
): ChatFeatureSnapshot | null {
  return snapshot.latestFeatureSnapshot ?? null;
}

function getScalarFeature(
  featureSnapshot: ChatFeatureSnapshot | null,
  key: string,
  fallback = 0,
): number {
  if (!featureSnapshot) return fallback;
  const raw = featureSnapshot as unknown as Record<string, unknown>;
  const direct = safeNumber(raw[key], Number.NaN);

  if (Number.isFinite(direct)) return direct;

  const scalarFeatures = isRecord(raw.scalarFeatures) ? raw.scalarFeatures : {};
  return safeNumber(scalarFeatures[key], fallback);
}

function getChannelFeature(
  featureSnapshot: ChatFeatureSnapshot | null,
  bucket: string,
  channel: ChatVisibleChannel,
  fallback = 0,
): number {
  if (!featureSnapshot) return fallback;
  const raw = featureSnapshot as unknown as Record<string, unknown>;
  const channelFeatures = isRecord(raw.channelFeatures) ? raw.channelFeatures : {};
  const target = isRecord(channelFeatures[bucket]) ? channelFeatures[bucket] : {};
  return safeNumber(target[channel], fallback);
}

function getSocialFeature(
  featureSnapshot: ChatFeatureSnapshot | null,
  key: string,
  fallback = 0,
): number {
  if (!featureSnapshot) return fallback;
  const raw = featureSnapshot as unknown as Record<string, unknown>;
  const socialFeatures = isRecord(raw.socialFeatures) ? raw.socialFeatures : {};
  return safeNumber(socialFeatures[key], fallback);
}

function getMessageFeature(
  featureSnapshot: ChatFeatureSnapshot | null,
  key: string,
  fallback = 0,
): number {
  if (!featureSnapshot) return fallback;
  const raw = featureSnapshot as unknown as Record<string, unknown>;
  const messageFeatures = isRecord(raw.messageFeatures) ? raw.messageFeatures : {};
  return safeNumber(messageFeatures[key], fallback);
}

function getDiagnosticsString(
  featureSnapshot: ChatFeatureSnapshot | null,
  key: string,
  fallback = '',
): string {
  if (!featureSnapshot) return fallback;
  const raw = featureSnapshot as unknown as Record<string, unknown>;
  const diagnostics = isRecord(raw.diagnostics) ? raw.diagnostics : {};
  return safeString(diagnostics[key], fallback);
}

function scoreByTier(
  tier: string,
  mapping: Partial<Record<string, number>>,
  fallback = 0,
): number {
  return clamp01(mapping[tier] ?? fallback);
}

function pickBestChannel(
  scores: ChatChannelRecommendationScores,
): ChatVisibleChannel {
  let best: ChatVisibleChannel = 'GLOBAL';
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const channel of CHAT_LEARNING_BRIDGE_CHANNEL_KEYS) {
    const candidate = scores[channel];
    if (candidate > bestScore) {
      bestScore = candidate;
      best = channel;
    }
  }

  return best;
}

function deriveColdStartInputs(
  snapshot: ChatLearningBridgePublicSnapshot,
  featureSnapshot: ChatFeatureSnapshot | null,
): {
  coldStartExplanation: string;
  recommendationExplanation: string;
  openingChannel: ChatVisibleChannel;
  helperCadence01: number;
  haterCadence01: number;
  negotiationGuard01: number;
} {
  const dropOffSignals =
    featureSnapshot &&
    isRecord((featureSnapshot as unknown as Record<string, unknown>).dropOffSignals)
      ? ((featureSnapshot as unknown as Record<string, unknown>).dropOffSignals as Record<string, unknown>)
      : {};

  const affect =
    featureSnapshot &&
    isRecord((featureSnapshot as unknown as Record<string, unknown>).affect)
      ? ((featureSnapshot as unknown as Record<string, unknown>).affect as Record<string, unknown>)
      : {};

  const coldStartProfile = createChatColdStartProfile({
    playerId: safeString((snapshot.profile as Record<string, unknown>).userId, 'anonymous'),
    activeChannel: snapshot.activeChannel,
    featureSnapshot: featureSnapshot ?? undefined,
    affectSnapshot: affect as any,
    dropOffSignals: dropOffSignals as any,
  });

  const recommendation = createChatColdStartRecommendation(coldStartProfile, {
    activeChannel: snapshot.activeChannel,
    featureSnapshot: featureSnapshot ?? undefined,
    affectSnapshot: affect as any,
    dropOffSignals: dropOffSignals as any,
  });

  return {
    coldStartExplanation: [
      `helper:${coldStartProfile.helperFrequencyBias.toFixed(2)}`,
      `hater:${coldStartProfile.haterAggressionBias.toFixed(2)}`,
      `guard:${coldStartProfile.negotiationRiskBias.toFixed(2)}`,
      `crowd:${coldStartProfile.crowdHeatTolerance.toFixed(2)}`,
      coldStartProfile.prefersLowerPressureOpenings ? 'opening:lower-pressure' : 'opening:adaptive',
    ].join(' | '),
    recommendationExplanation: recommendation.explanation,
    openingChannel: recommendation.openingChannel,
    helperCadence01: recommendation.helperCadence01,
    haterCadence01: recommendation.haterCadence01,
    negotiationGuard01: recommendation.negotiationGuard01,
  };
}

function buildExplanation(
  recommendedChannel: ChatVisibleChannel,
  vector: ChatScoreVector,
  breakdown: {
    pressureTier: string;
    tickTier: string;
    openingChannel: ChatVisibleChannel;
    coldStartExplanation: string;
    recommendationExplanation: string;
  },
): string {
  return [
    `channel:${recommendedChannel}`,
    `engagement:${vector.engagement01.toFixed(2)}`,
    `drop:${vector.dropOffRisk01.toFixed(2)}`,
    `helper:${vector.helperUrgency01.toFixed(2)}`,
    `rescue:${vector.rescueNeed01.toFixed(2)}`,
    `hater:${vector.haterAggression01.toFixed(2)}`,
    `pressure:${breakdown.pressureTier}`,
    `tick:${breakdown.tickTier}`,
    `cold:${breakdown.openingChannel}`,
    breakdown.coldStartExplanation,
    breakdown.recommendationExplanation,
  ].join(' | ');
}

/* ========================================================================== */
/* MARK: Engagement scorer implementation                                     */
/* ========================================================================== */

export class ChatEngagementScorer
  implements ChatLearningBridgeInferencePort
{
  private readonly defaults: typeof CHAT_ENGAGEMENT_SCORER_DEFAULTS;
  private readonly options: Required<
    Pick<
      ChatEngagementScorerOptions,
      | 'allowLowPressureLobbyBias'
      | 'allowAggressiveGlobalEscalation'
      | 'allowDealRoomGuard'
      | 'includeExplanationBreakdown'
    >
  > &
    Omit<
      ChatEngagementScorerOptions,
      | 'allowLowPressureLobbyBias'
      | 'allowAggressiveGlobalEscalation'
      | 'allowDealRoomGuard'
      | 'includeExplanationBreakdown'
    >;

  constructor(options: ChatEngagementScorerOptions = {}) {
    this.defaults = {
      ...CHAT_ENGAGEMENT_SCORER_DEFAULTS,
      ...(options.defaults ?? {}),
    };

    this.options = {
      ...options,
      allowLowPressureLobbyBias: options.allowLowPressureLobbyBias ?? true,
      allowAggressiveGlobalEscalation: options.allowAggressiveGlobalEscalation ?? true,
      allowDealRoomGuard: options.allowDealRoomGuard ?? true,
      includeExplanationBreakdown: options.includeExplanationBreakdown ?? true,
    };
  }

  public score(
    snapshot: ChatLearningBridgePublicSnapshot,
  ): ChatEngagementScoreResult {
    const featureSnapshot = extractFeatureSnapshot(snapshot);
    const profile = snapshot.profile as unknown as Record<string, unknown>;

    const pressureTier =
      (getDiagnosticsString(featureSnapshot, 'pressureTier', 'UNKNOWN')
        .toUpperCase() || 'UNKNOWN') as ChatPressureTier | 'UNKNOWN';
    const tickTier =
      (getDiagnosticsString(featureSnapshot, 'tickTier', 'UNKNOWN')
        .toUpperCase() || 'UNKNOWN') as ChatTickTier | 'UNKNOWN';

    const baseEngagement = clamp01(safeNumber(profile.engagement01, 0.18));
    const baseDrop = clamp01(safeNumber(profile.dropOffRisk01, 0.30));
    const baseHelper = clamp01(safeNumber(profile.helperNeed01, 0.22));
    const baseTolerance = clamp01(safeNumber(profile.haterTolerance01, 0.40));
    const baseShame = clamp01(safeNumber(profile.shameSensitivity01, 0.45));
    const baseConfidence = clamp01(safeNumber(profile.confidence01, 0.48));
    const baseRescue = clamp01(safeNumber(profile.rescueNeed01, 0.24));

    const messageVelocity01 = getScalarFeature(featureSnapshot, 'messageVelocity01', baseEngagement);
    const engagement01 = asScore01(
      clamp01(
        baseEngagement * 0.42 +
          messageVelocity01 * 0.14 +
          getScalarFeature(featureSnapshot, 'composerCommitment01', 0.20) * 0.12 +
          getScalarFeature(featureSnapshot, 'legendMomentum01', 0) * 0.08 +
          getSocialFeature(featureSnapshot, 'intimacy01', 0.20) * 0.06 +
          clamp01(1 - getScalarFeature(featureSnapshot, 'dropOffRisk01', baseDrop)) * 0.18,
      ),
    );

    const dropOffRisk01 = asScore01(
      clamp01(
        baseDrop * 0.40 +
          getScalarFeature(featureSnapshot, 'dropOffRisk01', baseDrop) * 0.24 +
          getScalarFeature(featureSnapshot, 'failurePressure01', 0) * 0.10 +
          getScalarFeature(featureSnapshot, 'quietness01', 0) * 0.08 +
          getSocialFeature(featureSnapshot, 'crowdStress01', 0) * 0.08 +
          scoreByTier(
            pressureTier,
            {
              CALM: 0.06,
              BUILDING: 0.16,
              ELEVATED: 0.34,
              HIGH: 0.56,
              CRITICAL: 0.78,
            },
            0.20,
          ) *
            0.10,
      ),
    );

    const helperUrgency01 = asScore01(
      clamp01(
        baseHelper * 0.30 +
          getScalarFeature(featureSnapshot, 'helperNeed01', baseHelper) * 0.24 +
          dropOffRisk01 * 0.14 +
          getScalarFeature(featureSnapshot, 'recoveryPressure01', 0) * 0.12 +
          getScalarFeature(featureSnapshot, 'failurePressure01', 0) * 0.10 +
          getSocialFeature(featureSnapshot, 'socialRecoveryNeed01', 0) * 0.10,
      ),
    );

    const rescueNeed01 = asScore01(
      clamp01(
        baseRescue * 0.30 +
          getScalarFeature(featureSnapshot, 'rescueNeed01', baseRescue) * 0.24 +
          helperUrgency01 * 0.18 +
          dropOffRisk01 * 0.14 +
          scoreByTier(
            tickTier,
            {
              SOVEREIGN: 0.04,
              STABLE: 0.12,
              COMPRESSED: 0.36,
              CRISIS: 0.62,
              COLLAPSE_IMMINENT: 0.84,
            },
            0.18,
          ) *
            0.14,
      ),
    );

    const confidence01 = asScore01(
      clamp01(
        baseConfidence * 0.42 +
          getScalarFeature(featureSnapshot, 'confidence01', baseConfidence) * 0.18 +
          engagement01 * 0.10 +
          getScalarFeature(featureSnapshot, 'legendMomentum01', 0) * 0.10 +
          getScalarFeature(featureSnapshot, 'replayInterest01', 0) * 0.04 +
          clamp01(1 - dropOffRisk01) * 0.16 +
          clamp01(1 - getSocialFeature(featureSnapshot, 'embarrassmentRisk01', 0)) * 0.10,
      ),
    );

    const shameSensitivity01 = asScore01(
      clamp01(
        baseShame * 0.44 +
          getScalarFeature(featureSnapshot, 'shameSensitivity01', baseShame) * 0.18 +
          getSocialFeature(featureSnapshot, 'crowdStress01', 0) * 0.12 +
          getSocialFeature(featureSnapshot, 'embarrassmentRisk01', 0) * 0.16 +
          clamp01(1 - confidence01) * 0.10,
      ),
    );

    const socialPressure01 = asScore01(
      clamp01(
        getSocialFeature(featureSnapshot, 'audienceHeat01', 0) * 0.26 +
          getSocialFeature(featureSnapshot, 'publicStagePressure01', 0) * 0.20 +
          shameSensitivity01 * 0.18 +
          getScalarFeature(featureSnapshot, 'haterPresence01', 0) * 0.18 +
          scoreByTier(
            pressureTier,
            {
              CALM: 0.02,
              BUILDING: 0.10,
              ELEVATED: 0.22,
              HIGH: 0.40,
              CRITICAL: 0.62,
            },
            0.14,
          ) *
            0.18,
      ),
    );

    const coldStart = deriveColdStartInputs(snapshot, featureSnapshot);

    const negotiationGuard01 = asScore01(
      clamp01(
        coldStart.negotiationGuard01 * 0.28 +
          getScalarFeature(featureSnapshot, 'negotiationGuard01', 0) * 0.22 +
          getSocialFeature(featureSnapshot, 'negotiationExposure01', 0) * 0.16 +
          dropOffRisk01 * 0.10 +
          shameSensitivity01 * 0.06 +
          rescueNeed01 * 0.06 +
          scoreByTier(
            tickTier,
            {
              SOVEREIGN: 0.02,
              STABLE: 0.08,
              COMPRESSED: 0.20,
              CRISIS: 0.36,
              COLLAPSE_IMMINENT: 0.48,
            },
            0.10,
          ) *
            0.12,
      ),
    );

    const recoveryOpportunity01 = asScore01(
      clamp01(
        helperUrgency01 * 0.30 +
          clamp01(1 - dropOffRisk01) * 0.20 +
          getScalarFeature(featureSnapshot, 'legendMomentum01', 0) * 0.12 +
          getScalarFeature(featureSnapshot, 'replayInterest01', 0) * 0.08 +
          getScalarFeature(featureSnapshot, 'helperPresence01', 0) * 0.18 +
          clamp01(1 - socialPressure01) * 0.12,
      ),
    );

    const haterAggression01 = asScore01(
      clamp01(
        this.defaults.haterAggressionFloor +
          baseTolerance * 0.18 +
          getScalarFeature(featureSnapshot, 'haterTolerance01', baseTolerance) * 0.18 +
          getScalarFeature(featureSnapshot, 'haterPresence01', 0) * 0.16 +
          socialPressure01 * 0.12 +
          clamp01(1 - helperUrgency01) * 0.08 +
          clamp01(1 - recoveryOpportunity01) * 0.06 +
          coldStart.haterCadence01 * 0.08,
      ),
    );

    const legendMomentum01 = asScore01(
      clamp01(
        getScalarFeature(featureSnapshot, 'legendMomentum01', 0) * 0.56 +
          confidence01 * 0.14 +
          engagement01 * 0.16 +
          clamp01(1 - dropOffRisk01) * 0.14,
      ),
    );

    const vector: ChatScoreVector = Object.freeze({
      engagement01,
      dropOffRisk01,
      helperUrgency01,
      rescueNeed01,
      haterAggression01,
      confidence01,
      shameSensitivity01,
      socialPressure01,
      negotiationGuard01,
      recoveryOpportunity01,
      legendMomentum01,
    });

    const channelScores = this.computeChannelScores(
      snapshot,
      featureSnapshot,
      vector,
      coldStart.openingChannel,
    );

    const recommendedChannel = pickBestChannel(channelScores);
    const explanation = buildExplanation(
      recommendedChannel,
      vector,
      {
        pressureTier,
        tickTier,
        openingChannel: coldStart.openingChannel,
        coldStartExplanation: coldStart.coldStartExplanation,
        recommendationExplanation: coldStart.recommendationExplanation,
      },
    );

    const breakdown: ChatEngagementScoreBreakdown = Object.freeze({
      moduleName: CHAT_ENGAGEMENT_SCORER_MODULE_NAME,
      moduleVersion: CHAT_ENGAGEMENT_SCORER_VERSION,
      bridgeModuleName: CHAT_LEARNING_BRIDGE_MODULE_NAME,
      bridgeModuleVersion: CHAT_LEARNING_BRIDGE_VERSION,
      channelScores,
      vector,
      pressureTier,
      tickTier,
      explanation,
    });

    return Object.freeze({
      recommendedChannel,
      vector,
      channelScores,
      explanation,
      breakdown,
    });
  }

  public refineProfile(
    snapshot: ChatLearningBridgePublicSnapshot,
  ): Partial<ChatLearningBridgeProfileState> {
    const result = this.score(snapshot);
    const current = snapshot.profile;

    const next: Partial<ChatLearningBridgeProfileState> = {
      preferredChannel: result.recommendedChannel,
      engagement01: asScore01(
        lerp01(
          current.engagement01,
          result.vector.engagement01,
          this.defaults.scoreSmoothingAlpha,
        ),
      ),
      dropOffRisk01: asScore01(
        lerp01(
          current.dropOffRisk01,
          result.vector.dropOffRisk01,
          this.defaults.dropRiskEscalationAlpha,
        ),
      ),
      helperNeed01: asScore01(
        lerp01(
          current.helperNeed01,
          result.vector.helperUrgency01,
          this.defaults.scoreSmoothingAlpha,
        ),
      ),
      haterTolerance01: asScore01(
        lerp01(
          current.haterTolerance01,
          clamp01(
            result.vector.haterAggression01 * 0.56 +
              clamp01(1 - result.vector.shameSensitivity01) * 0.44,
          ),
          this.defaults.scoreSmoothingAlpha,
        ),
      ),
      shameSensitivity01: asScore01(
        lerp01(
          current.shameSensitivity01,
          result.vector.shameSensitivity01,
          this.defaults.scoreSmoothingAlpha,
        ),
      ),
      confidence01: asScore01(
        lerp01(
          current.confidence01,
          result.vector.confidence01,
          this.defaults.confidenceRepairAlpha,
        ),
      ),
      typingCommitment01: asScore01(
        lerp01(
          current.typingCommitment01,
          clamp01(
            getScalarFeature(snapshot.latestFeatureSnapshot, 'composerCommitment01', current.typingCommitment01),
          ),
          this.defaults.scoreSmoothingAlpha,
        ),
      ),
      rescueNeed01: asScore01(
        lerp01(
          current.rescueNeed01,
          result.vector.rescueNeed01,
          this.defaults.scoreSmoothingAlpha,
        ),
      ),
      globalAffinity01: asScore01(
        lerp01(
          current.globalAffinity01,
          result.channelScores.GLOBAL,
          this.defaults.channelBiasAlpha,
        ),
      ),
      syndicateAffinity01: asScore01(
        lerp01(
          current.syndicateAffinity01,
          result.channelScores.SYNDICATE,
          this.defaults.channelBiasAlpha,
        ),
      ),
      dealRoomAffinity01: asScore01(
        lerp01(
          current.dealRoomAffinity01,
          result.channelScores.DEAL_ROOM,
          this.defaults.channelBiasAlpha,
        ),
      ),
    };

    return next;
  }

  public recommend(
    snapshot: ChatLearningBridgePublicSnapshot,
  ): ChatLearningBridgeRecommendation {
    const result = this.score(snapshot);

    return Object.freeze({
      recommendedChannel: result.recommendedChannel,
      helperUrgency01: result.vector.helperUrgency01,
      rescueNeeded: result.vector.rescueNeed01 >= this.defaults.rescueThreshold,
      haterAggression01: clamp01(
        Math.max(
          this.defaults.haterAggressionFloor,
          Math.min(
            this.defaults.haterAggressionCeiling,
            result.vector.haterAggression01,
          ),
        ),
      ),
      dropOffRisk01: result.vector.dropOffRisk01,
      explanation: result.explanation,
    });
  }

  private computeChannelScores(
    snapshot: ChatLearningBridgePublicSnapshot,
    featureSnapshot: ChatFeatureSnapshot | null,
    vector: ChatScoreVector,
    coldStartOpeningChannel: ChatVisibleChannel,
  ): ChatChannelRecommendationScores {
    const current = snapshot.profile;
    const activeChannel = snapshot.activeChannel;

    const pressureTier = getDiagnosticsString(featureSnapshot, 'pressureTier', 'UNKNOWN');
    const tickTier = getDiagnosticsString(featureSnapshot, 'tickTier', 'UNKNOWN');

    const scores = ensureChannelScores(0);

    const globalBase = clamp01(
      current.globalAffinity01 * 0.30 +
        getChannelFeature(featureSnapshot, 'channelViewShare01', 'GLOBAL', 0) * 0.10 +
        getChannelFeature(featureSnapshot, 'channelOutboundShare01', 'GLOBAL', 0) * 0.12 +
        getChannelFeature(featureSnapshot, 'channelInboundShare01', 'GLOBAL', 0) * 0.06 +
        vector.engagement01 * 0.10 +
        vector.haterAggression01 * 0.10 +
        vector.legendMomentum01 * 0.08 +
        vector.socialPressure01 * 0.10 +
        scoreByTier(
          pressureTier,
          {
            CALM: 0.04,
            BUILDING: 0.08,
            ELEVATED: 0.12,
            HIGH: 0.18,
            CRITICAL: 0.18,
          },
          0.06,
        ) *
          0.04,
    );

    const syndicateBase = clamp01(
      current.syndicateAffinity01 * 0.28 +
        getChannelFeature(featureSnapshot, 'channelViewShare01', 'SYNDICATE', 0) * 0.10 +
        getChannelFeature(featureSnapshot, 'channelOutboundShare01', 'SYNDICATE', 0) * 0.12 +
        getChannelFeature(featureSnapshot, 'channelInboundShare01', 'SYNDICATE', 0) * 0.08 +
        vector.helperUrgency01 * 0.08 +
        vector.engagement01 * 0.08 +
        vector.confidence01 * 0.08 +
        getSocialFeature(featureSnapshot, 'intimacy01', 0) * 0.10 +
        clamp01(1 - vector.socialPressure01) * 0.08,
    );

    const dealRoomBase = clamp01(
      current.dealRoomAffinity01 * 0.30 +
        getChannelFeature(featureSnapshot, 'channelViewShare01', 'DEAL_ROOM', 0) * 0.08 +
        getChannelFeature(featureSnapshot, 'channelOutboundShare01', 'DEAL_ROOM', 0) * 0.12 +
        getChannelFeature(featureSnapshot, 'channelInboundShare01', 'DEAL_ROOM', 0) * 0.08 +
        getSocialFeature(featureSnapshot, 'negotiationExposure01', 0) * 0.14 +
        vector.negotiationGuard01 * 0.12 +
        vector.confidence01 * 0.06 +
        clamp01(1 - vector.socialPressure01) * 0.10,
    );

    const lobbyBase = clamp01(
      0.12 +
        getChannelFeature(featureSnapshot, 'channelViewShare01', 'LOBBY', 0) * 0.16 +
        getChannelFeature(featureSnapshot, 'channelOutboundShare01', 'LOBBY', 0) * 0.10 +
        vector.helperUrgency01 * 0.14 +
        vector.rescueNeed01 * 0.18 +
        clamp01(1 - vector.socialPressure01) * 0.12 +
        clamp01(1 - vector.dropOffRisk01) * 0.08 +
        scoreByTier(
          tickTier,
          {
            SOVEREIGN: 0.00,
            STABLE: 0.04,
            COMPRESSED: 0.10,
            CRISIS: 0.18,
            COLLAPSE_IMMINENT: 0.22,
          },
          0.04,
        ) *
          0.10,
    );

    scores.GLOBAL = asScore01(
      clamp01(
        globalBase +
          (coldStartOpeningChannel === 'GLOBAL' ? 0.04 : 0) +
          (activeChannel === 'GLOBAL' ? 0.04 : 0) -
          (vector.rescueNeed01 >= this.defaults.rescueThreshold
            ? this.defaults.globalHeatPenalty
            : 0),
      ),
    );

    scores.SYNDICATE = asScore01(
      clamp01(
        syndicateBase +
          (coldStartOpeningChannel === 'SYNDICATE' ? 0.05 : 0) +
          (activeChannel === 'SYNDICATE' ? 0.04 : 0) +
          (vector.helperUrgency01 >= this.defaults.helperUrgencySoftThreshold ? 0.04 : 0),
      ),
    );

    scores.DEAL_ROOM = asScore01(
      clamp01(
        dealRoomBase +
          (coldStartOpeningChannel === 'DEAL_ROOM' ? 0.05 : 0) +
          (activeChannel === 'DEAL_ROOM' ? 0.04 : 0) +
          (this.options.allowDealRoomGuard
            ? vector.negotiationGuard01 * this.defaults.dealRoomGuardBias
            : 0),
      ),
    );

    scores.LOBBY = asScore01(
      clamp01(
        lobbyBase +
          (coldStartOpeningChannel === 'LOBBY' ? 0.06 : 0) +
          (activeChannel === 'LOBBY' ? 0.04 : 0) +
          (this.options.allowLowPressureLobbyBias
            ? Math.max(
                0,
                vector.rescueNeed01 - CHAT_LEARNING_BRIDGE_DEFAULTS.rescueNeedThreshold,
              ) * this.defaults.lobbySafetyBias
            : 0),
      ),
    );

    if (
      this.options.allowAggressiveGlobalEscalation &&
      vector.haterAggression01 >= CHAT_LEARNING_BRIDGE_DEFAULTS.haterAggressionEscalationThreshold &&
      vector.confidence01 >= 0.52 &&
      vector.helperUrgency01 < this.defaults.helperUrgencySoftThreshold
    ) {
      scores.GLOBAL = asScore01(clamp01(scores.GLOBAL + 0.06));
    }

    if (
      vector.helperUrgency01 >= this.defaults.helperUrgencyHardThreshold ||
      vector.rescueNeed01 >= this.defaults.rescueThreshold
    ) {
      scores.GLOBAL = asScore01(clamp01(scores.GLOBAL - 0.08));
      scores.LOBBY = asScore01(clamp01(scores.LOBBY + 0.06));
      scores.SYNDICATE = asScore01(clamp01(scores.SYNDICATE + 0.04));
    }

    if (vector.negotiationGuard01 >= 0.60 && vector.dropOffRisk01 >= 0.52) {
      scores.DEAL_ROOM = asScore01(clamp01(scores.DEAL_ROOM - 0.06));
      scores.SYNDICATE = asScore01(clamp01(scores.SYNDICATE + 0.04));
      scores.LOBBY = asScore01(clamp01(scores.LOBBY + 0.02));
    }

    return scores;
  }
}

/* ========================================================================== */
/* MARK: Public helpers                                                       */
/* ========================================================================== */

export function createChatEngagementScorer(
  options: ChatEngagementScorerOptions = {},
): ChatEngagementScorer {
  return new ChatEngagementScorer(options);
}

export function scoreChatEngagement(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatEngagementScorerOptions = {},
): ChatEngagementScoreResult {
  return createChatEngagementScorer(options).score(snapshot);
}

export function recommendChatLearningAction(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatEngagementScorerOptions = {},
): ChatLearningBridgeRecommendation {
  return createChatEngagementScorer(options).recommend(snapshot);
}

export function refineChatLearningProfileState(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatEngagementScorerOptions = {},
): Partial<ChatLearningBridgeProfileState> {
  return createChatEngagementScorer(options).refineProfile(snapshot);
}

export const CHAT_ENGAGEMENT_SCORER_NAMESPACE = Object.freeze({
  moduleName: CHAT_ENGAGEMENT_SCORER_MODULE_NAME,
  version: CHAT_ENGAGEMENT_SCORER_VERSION,
  runtimeLaws: CHAT_ENGAGEMENT_SCORER_RUNTIME_LAWS,
  defaults: CHAT_ENGAGEMENT_SCORER_DEFAULTS,
  create: createChatEngagementScorer,
  score: scoreChatEngagement,
  recommend: recommendChatLearningAction,
  refineProfile: refineChatLearningProfileState,
} as const);

export default ChatEngagementScorer;
