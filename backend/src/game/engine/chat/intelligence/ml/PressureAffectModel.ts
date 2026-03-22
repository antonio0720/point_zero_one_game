/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT PRESSURE AFFECT MODEL
 * FILE: backend/src/game/engine/chat/intelligence/ml/PressureAffectModel.ts
 * VERSION: 2026.03.21-backend-pressure-affect.v2
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative backend pressure / affect scoring for the chat lane.
 *
 * This model isolates the emotional dimensions that should be governed by
 * runtime battlefield condition rather than broad social sentiment alone:
 *
 * - intimidation
 * - frustration
 * - relief
 * - desperation
 * - confidence repair under pressure
 *
 * Design doctrine
 * ---------------
 * - Pressure is authoritative runtime state, not flavor text.
 * - Global humiliation must score harder than intimate-channel pressure.
 * - Deal-room quiet may be predatory rather than calm.
 * - Rescue urgency and comeback readiness may coexist.
 * - Relief should repair slower than intimidation spikes unless a real
 *   stabilizer exists.
 * - Driver evidence must be explainable, replay-safe, and contract-aligned.
 * - This file feeds the durable backend emotion lane without flattening mode,
 *   relationship, rescue, or audience context.
 * ============================================================================
 */

import type {
  ChatAudienceHeat,
  ChatFeatureSnapshot,
  ChatInferenceSnapshot,
  ChatLearningProfile,
  ChatRelationshipState,
  ChatRescueDecision,
  ChatRoomId,
  ChatSilenceDecision,
  ChatUserId,
  ChatVisibleChannel,
  JsonObject,
  Score01,
  UnixMs,
} from '../../types';

import type {
  ChatEmotionAxis,
  ChatEmotionConfidenceBand,
  ChatEmotionDriverEvidence,
  ChatEmotionDriverKind,
  ChatEmotionOperatingState,
  ChatEmotionSourceKind,
  ChatEmotionVector,
} from '../../../../../../../shared/contracts/chat/ChatEmotion';

import type { ChatAuthority } from '../../../../../../../shared/contracts/chat/ChatEvents';

import {
  CHAT_EMOTION_AXES,
  CHAT_EMOTION_OPERATING_STATES,
  clampEmotionScalar,
  computeEmotionConfidenceBand,
  createChatEmotionDriverId,
  describeEmotionVector,
} from '../../../../../../../shared/contracts/chat/ChatEmotion';

/* ========================================================================== *
 * MARK: Module identity
 * ========================================================================== */

export const CHAT_PRESSURE_AFFECT_MODEL_MODULE_NAME =
  'PZO_BACKEND_CHAT_PRESSURE_AFFECT_MODEL' as const;

export const CHAT_PRESSURE_AFFECT_MODEL_VERSION =
  '2026.03.21-backend-pressure-affect.v2' as const;

export const CHAT_PRESSURE_AFFECT_MODEL_RUNTIME_LAWS = Object.freeze([
  'Pressure is authoritative runtime state, not flavor text.',
  'Global stage pressure must score higher than intimate-channel pressure.',
  'Relief should repair slower than intimidation spikes unless a stabilizing event is present.',
  'Predatory quiet in deal room must not be mistaken for safety.',
  'Silence can be correct when authored pressure should linger.',
  'Rescue urgency and comeback readiness can exist at the same time.',
  'Driver evidence must remain explainable for replay, tuning, and training.',
  'The pressure model must expose deterministic recommendations for the durable emotion lane.',
] as const);

export const CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS = Object.freeze({
  pressureTierWeights: Object.freeze({
    NONE: 0.05,
    BUILDING: 0.24,
    ELEVATED: 0.46,
    HIGH: 0.72,
    CRITICAL: 0.94,
  }),
  channelExposureBias: Object.freeze({
    GLOBAL: 0.17,
    SYNDICATE: 0.08,
    DEAL_ROOM: 0.11,
    LOBBY: 0.04,
  }),
  swarmDirectionBias: Object.freeze({
    POSITIVE: -0.08,
    NEGATIVE: 0.18,
    NEUTRAL: 0.03,
  }),
  pressureIntimidationWeight: 0.28,
  hostileMomentumWeight: 0.26,
  roomHeatWeight: 0.17,
  churnPressureWeight: 0.13,
  embarrassmentCarryWeight: 0.11,
  frustrationPressureWeight: 0.24,
  ignoredHelperWeight: 0.18,
  outboundFailureWeight: 0.13,
  desperationChurnWeight: 0.26,
  desperationRescueWeight: 0.19,
  desperationSilenceWeight: 0.12,
  confidenceStabilityWeight: 0.19,
  confidenceRecoveryWeight: 0.15,
  confidenceFearInverseWeight: 0.11,
  reliefStabilizerWeight: 0.22,
  reliefHelperWeight: 0.15,
  reliefPressureInverseWeight: 0.13,
  comebackConfidenceThreshold: 0.54,
  rescueEscalationThreshold: 0.57,
  silenceSuitabilityThreshold: 0.59,
  publicHumiliationEscalationThreshold: 0.62,
  confidenceRepairDampening: 0.61,
  reliefRepairDampening: 0.58,
  crowdPileOnThreshold: 0.58,
  predatoryStateThreshold: 0.64,
  woundedStateThreshold: 0.68,
  rescuedStateThreshold: 0.62,
  ceremonialStateThreshold: 0.76,
  volatilityThreshold: 0.67,
  calmThreshold: 0.24,
} as const);

/* ========================================================================== *
 * MARK: Public contracts
 * ========================================================================== */

export type PressureNarrativeState =
  | 'STEADY'
  | 'WATCHED'
  | 'EXPOSED'
  | 'HUNTED'
  | 'WOUNDED'
  | 'CORNERED'
  | 'BREATHING_ROOM'
  | 'COMEBACK_READY';

export interface PressureAffectModelInput {
  readonly userId: ChatUserId;
  readonly roomId: ChatRoomId;
  readonly channel: ChatVisibleChannel;
  readonly evaluatedAt?: UnixMs;
  readonly authority?: ChatAuthority;
  readonly featureSnapshot?: ChatFeatureSnapshot;
  readonly learningProfile?: ChatLearningProfile;
  readonly audienceHeat?: ChatAudienceHeat;
  readonly rescueDecision?: ChatRescueDecision;
  readonly silenceDecision?: ChatSilenceDecision;
  readonly inferenceSnapshot?: ChatInferenceSnapshot;
  readonly relationships?: readonly ChatRelationshipState[];
  readonly eventTags?: readonly string[];
  readonly metadata?: JsonObject;
}

export interface PressureAxisBreakdown {
  readonly intimidation01: Score01;
  readonly frustration01: Score01;
  readonly relief01: Score01;
  readonly desperation01: Score01;
  readonly confidenceRepair01: Score01;
}

export interface PressureAffectPolicyFlags {
  readonly shouldPreferSilence: boolean;
  readonly shouldEscalateRescue: boolean;
  readonly shouldPrimeComebackSpeech: boolean;
  readonly shouldRestrainCelebration: boolean;
  readonly shouldWarnCrowdPileOn: boolean;
}

export interface PressureAffectRecommendation {
  readonly state: PressureNarrativeState;
  readonly operatingState: ChatEmotionOperatingState;
  readonly confidenceBand: ChatEmotionConfidenceBand;
  readonly policyFlags: PressureAffectPolicyFlags;
  readonly comebackReadiness01: Score01;
  readonly celebrationTolerance01: Score01;
  readonly silenceSuitability01: Score01;
  readonly rescueUrgency01: Score01;
  readonly crowdPileOnRisk01: Score01;
  readonly driverSummary: readonly string[];
}

export interface PressureAffectResult {
  readonly model: typeof CHAT_PRESSURE_AFFECT_MODEL_MODULE_NAME;
  readonly version: typeof CHAT_PRESSURE_AFFECT_MODEL_VERSION;
  readonly evaluatedAt: UnixMs;
  readonly authority: ChatAuthority;
  readonly userId: ChatUserId;
  readonly roomId: ChatRoomId;
  readonly channel: ChatVisibleChannel;
  readonly breakdown: PressureAxisBreakdown;
  readonly pressureSeverity01: Score01;
  readonly publicExposure01: Score01;
  readonly stabilizer01: Score01;
  readonly crowdThreat01: Score01;
  readonly confidenceBand: ChatEmotionConfidenceBand;
  readonly narrativeState: PressureNarrativeState;
  readonly operatingState: ChatEmotionOperatingState;
  readonly pressureVector: Readonly<Pick<ChatEmotionVector, 'intimidation' | 'frustration' | 'relief' | 'desperation' | 'confidence'>>;
  readonly pressureVectorSummary: string;
  readonly drivers: readonly ChatEmotionDriverEvidence[];
  readonly recommendation: PressureAffectRecommendation;
  readonly notes: readonly string[];
  readonly metadata?: JsonObject;
}

export interface PressureAffectModelOptions {
  readonly defaults?: Partial<typeof CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS>;
  readonly authority?: ChatAuthority;
  readonly now?: () => UnixMs;
}

export interface PressureAffectModelApi {
  readonly moduleName: typeof CHAT_PRESSURE_AFFECT_MODEL_MODULE_NAME;
  readonly version: typeof CHAT_PRESSURE_AFFECT_MODEL_VERSION;
  readonly defaults: typeof CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS;
  evaluate(input: PressureAffectModelInput): PressureAffectResult;
  summarize(result: PressureAffectResult): readonly string[];
}

/* ========================================================================== *
 * MARK: Internal contracts
 * ========================================================================== */

interface DriverInput {
  readonly axis: ChatEmotionAxis;
  readonly driver: ChatEmotionDriverKind;
  readonly sourceKind: ChatEmotionSourceKind;
  readonly signedImpact01: Score01;
  readonly evidence: string;
  readonly label: string;
  readonly roomId: ChatRoomId;
  readonly channel: ChatVisibleChannel;
  readonly metadata: JsonObject;
}

interface NarrativeResolutionInput {
  readonly pressureSeverity: Score01;
  readonly intimidation01: Score01;
  readonly frustration01: Score01;
  readonly relief01: Score01;
  readonly desperation01: Score01;
  readonly confidenceRepair01: Score01;
  readonly publicExposure: Score01;
  readonly crowdThreat: Score01;
}

/* ========================================================================== *
 * MARK: Model implementation
 * ========================================================================== */

export class PressureAffectModel implements PressureAffectModelApi {
  public readonly moduleName = CHAT_PRESSURE_AFFECT_MODEL_MODULE_NAME;
  public readonly version = CHAT_PRESSURE_AFFECT_MODEL_VERSION;
  public readonly defaults: typeof CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS;

  private readonly authority: ChatAuthority;
  private readonly now: () => UnixMs;

  public constructor(options: PressureAffectModelOptions = {}) {
    this.defaults = mergeDefaults(options.defaults);
    this.authority = (options.authority ?? 'BACKEND_AUTHORITATIVE') as ChatAuthority;
    this.now = options.now ?? (() => Date.now() as UnixMs);
  }

  public evaluate(input: PressureAffectModelInput): PressureAffectResult {
    const evaluatedAt = input.evaluatedAt ?? this.now();
    const authority = (input.authority ?? this.authority) as ChatAuthority;
    const feature = input.featureSnapshot;
    const profile = input.learningProfile;
    const audienceHeat = input.audienceHeat;
    const rescue = input.rescueDecision;
    const silence = input.silenceDecision;
    const inference = input.inferenceSnapshot;
    const relationships = input.relationships ?? [];

    const pressureSeverity = this.computePressureSeverity(
      input.channel,
      feature,
      audienceHeat,
    );
    const publicExposure = this.computePublicExposure(
      input.channel,
      feature,
      audienceHeat,
      relationships,
    );
    const stabilizer = this.computeStabilizer(profile, rescue, relationships);
    const crowdThreat = this.computeCrowdThreat(
      input.channel,
      feature,
      audienceHeat,
      inference,
    );

    const intimidation01 = clampEmotionScalar(
      pressureSeverity * this.defaults.pressureIntimidationWeight +
        safe01(feature?.hostileMomentum01) * this.defaults.hostileMomentumWeight +
        crowdThreat * this.defaults.roomHeatWeight +
        safe01(profile?.affect.embarrassment01) * this.defaults.embarrassmentCarryWeight +
        publicExposure * 0.11 +
        inferNegativeAudienceBias(audienceHeat) * 0.06,
    );

    const frustration01 = clampEmotionScalar(
      pressureSeverity * this.defaults.frustrationPressureWeight +
        normalizeIgnoredHelperCount(feature?.ignoredHelperCountWindow) *
          this.defaults.ignoredHelperWeight +
        inferOutboundFailure(feature) * this.defaults.outboundFailureWeight +
        safe01(profile?.affect.frustration01) * 0.18 +
        crowdThreat * 0.11 +
        inferSilenceTax(silence) * 0.09,
    );

    const desperation01 = clampEmotionScalar(
      safe01(profile?.churnRisk01) * this.defaults.desperationChurnWeight +
        normalizeRescueUrgency(rescue) * this.defaults.desperationRescueWeight +
        pressureSeverity * 0.16 +
        inferSilenceTax(silence) * this.defaults.desperationSilenceWeight +
        inferTimePressure(feature) * 0.12,
    );

    const confidenceRepairBase = clampEmotionScalar(
      safe01(profile?.affect.confidence01) * this.defaults.confidenceStabilityWeight +
        stabilizer * this.defaults.confidenceRecoveryWeight +
        invert01(intimidation01) * this.defaults.confidenceFearInverseWeight +
        invert01(frustration01) * 0.1 +
        inferComebackSeed(inference, feature) * 0.11 +
        helperPresenceFromRelationships(relationships) * 0.07,
    );

    const confidenceRepair01 = clampEmotionScalar(
      confidenceRepairBase *
        (pressureSeverity >= 0.72 ? this.defaults.confidenceRepairDampening : 1),
    );

    const reliefBase = clampEmotionScalar(
      stabilizer * this.defaults.reliefStabilizerWeight +
        helperPresenceFromRelationships(relationships) *
          this.defaults.reliefHelperWeight +
        invert01(pressureSeverity) * this.defaults.reliefPressureInverseWeight +
        inferRecentSurvival(inference) * 0.11 +
        invert01(crowdThreat) * 0.06,
    );

    const relief01 = clampEmotionScalar(
      reliefBase *
        (pressureSeverity >= 0.46 ? this.defaults.reliefRepairDampening : 1),
    );

    const pressureVector = Object.freeze({
      intimidation: intimidation01,
      confidence: confidenceRepair01,
      frustration: frustration01,
      relief: relief01,
      desperation: desperation01,
    } satisfies Pick<
      ChatEmotionVector,
      'intimidation' | 'confidence' | 'frustration' | 'relief' | 'desperation'
    >);

    const confidenceBand = computeEmotionConfidenceBand(
      average([
        invert01(pressureSeverity),
        confidenceRepair01,
        relief01,
        invert01(desperation01),
      ]),
    );

    const narrativeState = this.resolveNarrativeState({
      pressureSeverity,
      intimidation01,
      frustration01,
      relief01,
      desperation01,
      confidenceRepair01,
      publicExposure,
      crowdThreat,
    });

    const operatingState = this.resolveOperatingState({
      pressureSeverity,
      intimidation01,
      frustration01,
      relief01,
      desperation01,
      confidenceRepair01,
      publicExposure,
      crowdThreat,
    });

    const comebackReadiness01 = clampEmotionScalar(
      confidenceRepair01 * 0.54 +
        invert01(intimidation01) * 0.18 +
        invert01(desperation01) * 0.16 +
        inferComebackSeed(inference, feature) * 0.12,
    );

    const celebrationTolerance01 = clampEmotionScalar(
      relief01 * 0.34 +
        confidenceRepair01 * 0.18 +
        invert01(publicExposure) * 0.24 +
        invert01(crowdThreat) * 0.14 +
        invert01(pressureSeverity) * 0.1,
    );

    const silenceSuitability01 = clampEmotionScalar(
      pressureSeverity * 0.39 +
        intimidation01 * 0.18 +
        desperation01 * 0.12 +
        invert01(relief01) * 0.18 +
        invert01(stabilizer) * 0.13,
    );

    const rescueUrgency01 = clampEmotionScalar(
      desperation01 * 0.42 +
        frustration01 * 0.14 +
        pressureSeverity * 0.18 +
        normalizeRescueUrgency(rescue) * 0.16 +
        inferSilenceTax(silence) * 0.1,
    );

    const crowdPileOnRisk01 = clampEmotionScalar(
      publicExposure * 0.33 +
        crowdThreat * 0.27 +
        intimidation01 * 0.11 +
        frustration01 * 0.11 +
        inferNegativeAudienceBias(audienceHeat) * 0.18,
    );

    const drivers = Object.freeze([
      this.driver({
        axis: 'INTIMIDATION',
        driver: 'PRESSURE_SPIKE',
        sourceKind: 'MOMENT',
        signedImpact01: intimidation01,
        label: 'Pressure spike intimidation',
        evidence:
          'Authoritative pressure tier, hostile momentum, crowd threat, and public exposure increased intimidation.',
        roomId: input.roomId,
        channel: input.channel,
        metadata: Object.freeze({
          pressureSeverity01: pressureSeverity,
          hostileMomentum01: safe01(feature?.hostileMomentum01),
          crowdThreat01: crowdThreat,
          publicExposure01: publicExposure,
          eventTags: Object.freeze([...(input.eventTags ?? [])]),
        }),
      }),
      this.driver({
        axis: 'FRUSTRATION',
        driver: 'COUNTERPLAY_FAILURE',
        sourceKind: 'COUNTERPLAY',
        signedImpact01: frustration01,
        label: 'Counterplay failure frustration',
        evidence:
          'Ignored helper windows, outbound failure, silence friction, and room pressure increased frustration.',
        roomId: input.roomId,
        channel: input.channel,
        metadata: Object.freeze({
          ignoredHelperCountWindow: feature?.ignoredHelperCountWindow ?? 0,
          outboundFailure01: inferOutboundFailure(feature),
          silenceTax01: inferSilenceTax(silence),
          messageCountWindow: feature?.messageCountWindow ?? 0,
        }),
      }),
      this.driver({
        axis: 'DESPERATION',
        driver: 'BANKRUPTCY_THREAT',
        sourceKind: 'RESCUE',
        signedImpact01: desperation01,
        label: 'Rescue urgency desperation',
        evidence:
          'Churn risk, rescue urgency, time pressure, and unresolved silence increased desperation.',
        roomId: input.roomId,
        channel: input.channel,
        metadata: Object.freeze({
          churnRisk01: safe01(profile?.churnRisk01),
          rescueUrgency01: normalizeRescueUrgency(rescue),
          timePressure01: inferTimePressure(feature),
          silenceActive: Boolean(silence?.active),
        }),
      }),
      this.driver({
        axis: 'RELIEF',
        driver: 'RESCUE_INTERVENTION',
        sourceKind: rescue?.triggered ? 'RESCUE' : 'HELPER_MESSAGE',
        signedImpact01: relief01,
        label: 'Stabilizer relief',
        evidence:
          'Helper presence, rescue posture, survival signals, and lower crowd threat improved relief.',
        roomId: input.roomId,
        channel: input.channel,
        metadata: Object.freeze({
          helperPresence01: helperPresenceFromRelationships(relationships),
          stabilizer01: stabilizer,
          rescueTriggered: Boolean(rescue?.triggered),
          recentSurvival01: inferRecentSurvival(inference),
        }),
      }),
      this.driver({
        axis: 'CONFIDENCE',
        driver: 'COMEBACK_WINDOW',
        sourceKind: 'SYSTEM',
        signedImpact01: confidenceRepair01,
        label: 'Confidence repair window',
        evidence:
          'Stabilizer carryover, helper presence, and reduced fear created a comeback repair window.',
        roomId: input.roomId,
        channel: input.channel,
        metadata: Object.freeze({
          confidenceBaseline01: safe01(profile?.affect.confidence01),
          stabilizer01: stabilizer,
          comebackSeed01: inferComebackSeed(inference, feature),
          dampenedUnderPressure: pressureSeverity >= 0.72,
        }),
      }),
    ] satisfies readonly ChatEmotionDriverEvidence[]);

    const policyFlags = Object.freeze({
      shouldPreferSilence:
        silenceSuitability01 >= this.defaults.silenceSuitabilityThreshold &&
        relief01 < 0.43 &&
        stabilizer < 0.44,
      shouldEscalateRescue:
        rescueUrgency01 >= this.defaults.rescueEscalationThreshold ||
        (frustration01 >= 0.66 && pressureSeverity >= 0.72),
      shouldPrimeComebackSpeech:
        comebackReadiness01 >= this.defaults.comebackConfidenceThreshold &&
        intimidation01 <= 0.66,
      shouldRestrainCelebration:
        pressureSeverity >= 0.5 || celebrationTolerance01 < 0.41,
      shouldWarnCrowdPileOn:
        publicExposure >= this.defaults.publicHumiliationEscalationThreshold &&
        crowdPileOnRisk01 >= this.defaults.crowdPileOnThreshold,
    } satisfies PressureAffectPolicyFlags);

    const recommendation = Object.freeze({
      state: narrativeState,
      operatingState,
      confidenceBand,
      policyFlags,
      comebackReadiness01,
      celebrationTolerance01,
      silenceSuitability01,
      rescueUrgency01,
      crowdPileOnRisk01,
      driverSummary: Object.freeze(this.summarizeDrivers(drivers)),
    } satisfies PressureAffectRecommendation);

    const pressureVectorSummary = describeEmotionVector(
      buildDescriptiveVectorFromPressure(pressureVector),
    );

    const notes = Object.freeze(
      this.buildNotes({
        input,
        pressureSeverity,
        publicExposure,
        stabilizer,
        crowdThreat,
        intimidation01,
        frustration01,
        relief01,
        desperation01,
        confidenceRepair01,
        operatingState,
        recommendation,
        pressureVectorSummary,
      }),
    );

    return Object.freeze({
      model: CHAT_PRESSURE_AFFECT_MODEL_MODULE_NAME,
      version: CHAT_PRESSURE_AFFECT_MODEL_VERSION,
      evaluatedAt,
      authority,
      userId: input.userId,
      roomId: input.roomId,
      channel: input.channel,
      breakdown: Object.freeze({
        intimidation01,
        frustration01,
        relief01,
        desperation01,
        confidenceRepair01,
      }),
      pressureSeverity01: pressureSeverity,
      publicExposure01: publicExposure,
      stabilizer01: stabilizer,
      crowdThreat01: crowdThreat,
      confidenceBand,
      narrativeState,
      operatingState,
      pressureVector,
      pressureVectorSummary,
      drivers,
      recommendation,
      notes,
      metadata: buildResultMetadata({
        authority,
        input,
        pressureSeverity,
        publicExposure,
        stabilizer,
        crowdThreat,
        operatingState,
        pressureVector,
      }),
    });
  }

  public summarize(result: PressureAffectResult): readonly string[] {
    return Object.freeze([
      `state=${result.narrativeState}`,
      `operatingState=${result.operatingState}`,
      `pressure=${toPct(result.pressureSeverity01)}`,
      `exposure=${toPct(result.publicExposure01)}`,
      `intimidation=${toPct(result.breakdown.intimidation01)}`,
      `frustration=${toPct(result.breakdown.frustration01)}`,
      `desperation=${toPct(result.breakdown.desperation01)}`,
      `relief=${toPct(result.breakdown.relief01)}`,
      `confidenceRepair=${toPct(result.breakdown.confidenceRepair01)}`,
      `vector=${result.pressureVectorSummary}`,
      ...result.recommendation.driverSummary,
    ]);
  }

  private computePressureSeverity(
    channel: ChatVisibleChannel,
    feature?: ChatFeatureSnapshot,
    audienceHeat?: ChatAudienceHeat,
  ): Score01 {
    const tierWeight =
      this.defaults.pressureTierWeights[feature?.pressureTier ?? 'NONE'];
    const hostileMomentum = safe01(feature?.hostileMomentum01);
    const heat = safe01(feature?.roomHeat01);
    const crowd = safe01(audienceHeat?.heat01);
    const channelBias = this.defaults.channelExposureBias[channel] ?? 0;

    return clampEmotionScalar(
      tierWeight * 0.46 +
        hostileMomentum * 0.22 +
        heat * 0.17 +
        crowd * 0.1 +
        channelBias,
    );
  }

  private computePublicExposure(
    channel: ChatVisibleChannel,
    feature?: ChatFeatureSnapshot,
    audienceHeat?: ChatAudienceHeat,
    relationships: readonly ChatRelationshipState[] = [],
  ): Score01 {
    const channelBias = this.defaults.channelExposureBias[channel] ?? 0;
    const witnessFactor = normalizeCount(feature?.inboundNpcCountWindow, 0.24);
    const crowd = safe01(audienceHeat?.heat01);
    const rivalryThreat = average(
      relationships.map(
        (value) =>
          safe01(value.rivalry01) * 0.5 + safe01(value.contempt01) * 0.5,
      ),
      0,
    );

    return clampEmotionScalar(
      channelBias + witnessFactor + crowd * 0.26 + rivalryThreat * 0.19,
    );
  }

  private computeStabilizer(
    profile?: ChatLearningProfile,
    rescue?: ChatRescueDecision,
    relationships: readonly ChatRelationshipState[] = [],
  ): Score01 {
    const helperTrust = average(
      relationships.map(
        (value) =>
          safe01(value.trust01) * 0.58 + safe01(value.rescueDebt01) * 0.42,
      ),
      0,
    );
    const attachment = safe01(profile?.affect.attachment01);
    const relief = safe01(profile?.affect.relief01);
    const rescueBoost = normalizeRescueUrgencyInverse(rescue);

    return clampEmotionScalar(
      helperTrust * 0.34 +
        attachment * 0.22 +
        relief * 0.16 +
        rescueBoost * 0.14,
    );
  }

  private computeCrowdThreat(
    channel: ChatVisibleChannel,
    feature?: ChatFeatureSnapshot,
    audienceHeat?: ChatAudienceHeat,
    inference?: ChatInferenceSnapshot,
  ): Score01 {
    const heat = safe01(audienceHeat?.heat01 ?? feature?.roomHeat01);
    const swarmBias = audienceHeat
      ? this.defaults.swarmDirectionBias[audienceHeat.swarmDirection] ?? 0
      : 0;
    const hostility = safe01(feature?.hostileMomentum01);
    const haterTargeting = safe01(inference?.haterTargeting01);
    const channelBias =
      channel === 'GLOBAL' ? 0.12 : channel === 'DEAL_ROOM' ? 0.07 : 0.03;

    return clampEmotionScalar(
      heat * 0.31 + hostility * 0.27 + haterTargeting * 0.16 + swarmBias + channelBias,
    );
  }

  private resolveNarrativeState(
    input: NarrativeResolutionInput,
  ): PressureNarrativeState {
    if (input.relief01 >= 0.61 && input.pressureSeverity <= 0.42) {
      return 'BREATHING_ROOM';
    }
    if (
      input.confidenceRepair01 >= this.defaults.comebackConfidenceThreshold &&
      input.intimidation01 <= 0.59 &&
      input.desperation01 <= 0.53
    ) {
      return 'COMEBACK_READY';
    }
    if (
      input.desperation01 >= 0.76 ||
      (input.pressureSeverity >= 0.84 && input.frustration01 >= 0.66)
    ) {
      return 'CORNERED';
    }
    if (input.intimidation01 >= 0.7 && input.publicExposure >= 0.6) {
      return 'HUNTED';
    }
    if (input.frustration01 >= this.defaults.woundedStateThreshold) {
      return 'WOUNDED';
    }
    if (input.publicExposure >= 0.52) {
      return 'EXPOSED';
    }
    if (input.pressureSeverity >= 0.46) {
      return 'WATCHED';
    }
    return 'STEADY';
  }

  private resolveOperatingState(
    input: NarrativeResolutionInput,
  ): ChatEmotionOperatingState {
    if (
      input.relief01 >= this.defaults.rescuedStateThreshold &&
      input.pressureSeverity <= 0.34
    ) {
      return ensureOperatingState('RESCUED');
    }

    if (
      input.publicExposure >= this.defaults.publicHumiliationEscalationThreshold &&
      input.crowdThreat >= this.defaults.predatoryStateThreshold
    ) {
      return ensureOperatingState('PREDATORY');
    }

    if (
      input.intimidation01 >= this.defaults.volatilityThreshold &&
      input.frustration01 >= this.defaults.volatilityThreshold
    ) {
      return ensureOperatingState('VOLATILE');
    }

    if (
      input.frustration01 >= this.defaults.woundedStateThreshold ||
      input.desperation01 >= this.defaults.woundedStateThreshold
    ) {
      return ensureOperatingState('WOUNDED');
    }

    if (
      input.confidenceRepair01 >= this.defaults.comebackConfidenceThreshold &&
      input.relief01 >= 0.44 &&
      input.publicExposure <= 0.36 &&
      input.crowdThreat <= 0.3
    ) {
      return ensureOperatingState('CEREMONIAL');
    }

    if (input.pressureSeverity >= this.defaults.volatilityThreshold) {
      return ensureOperatingState('SPIKED');
    }

    if (input.pressureSeverity >= 0.42 || input.publicExposure >= 0.42) {
      return ensureOperatingState('RISING');
    }

    if (input.pressureSeverity <= this.defaults.calmThreshold) {
      return ensureOperatingState('STABLE');
    }

    return ensureOperatingState('COLD_START');
  }

  private driver(input: DriverInput): ChatEmotionDriverEvidence {
    const salience = clampEmotionScalar(Math.max(Number(input.signedImpact01), 0.14));
    const confidence = clampEmotionScalar(salience * 0.72 + 0.12);

    return Object.freeze({
      driverId: createChatEmotionDriverId(),
      driver: input.driver,
      sourceKind: input.sourceKind,
      sourceAuthority: this.authority,
      sourceWeight: Number(clampEmotionScalar(Number(input.signedImpact01))),
      salience,
      confidence,
      confidenceBand: computeEmotionConfidenceBand(confidence),
      label: input.label,
      reason: input.evidence,
      roomId: input.roomId,
      channelId: input.channel as unknown as ChatEmotionDriverEvidence['channelId'],
      happenedAt: new Date(this.now()).toISOString(),
      metadata: Object.freeze({
        emotionAxis: input.axis,
        signedImpact01: Number(input.signedImpact01),
        ...input.metadata,
      }),
    });
  }

  private summarizeDrivers(
    drivers: readonly ChatEmotionDriverEvidence[],
  ): readonly string[] {
    return Object.freeze(
      drivers.map((driver) => {
        const axis = String(driver.metadata?.emotionAxis ?? 'UNKNOWN').toLowerCase();
        return `${axis}<=${driver.driver}:${toPct(driver.sourceWeight)}`;
      }),
    );
  }

  private buildNotes(input: {
    readonly input: PressureAffectModelInput;
    readonly pressureSeverity: Score01;
    readonly publicExposure: Score01;
    readonly stabilizer: Score01;
    readonly crowdThreat: Score01;
    readonly intimidation01: Score01;
    readonly frustration01: Score01;
    readonly relief01: Score01;
    readonly desperation01: Score01;
    readonly confidenceRepair01: Score01;
    readonly operatingState: ChatEmotionOperatingState;
    readonly recommendation: PressureAffectRecommendation;
    readonly pressureVectorSummary: string;
  }): readonly string[] {
    const notes: string[] = [];

    notes.push(`channel=${input.input.channel}`);
    notes.push(`pressureSeverity=${toPct(input.pressureSeverity)}`);
    notes.push(`publicExposure=${toPct(input.publicExposure)}`);
    notes.push(`stabilizer=${toPct(input.stabilizer)}`);
    notes.push(`crowdThreat=${toPct(input.crowdThreat)}`);
    notes.push(`intimidation=${toPct(input.intimidation01)}`);
    notes.push(`frustration=${toPct(input.frustration01)}`);
    notes.push(`relief=${toPct(input.relief01)}`);
    notes.push(`desperation=${toPct(input.desperation01)}`);
    notes.push(`confidenceRepair=${toPct(input.confidenceRepair01)}`);
    notes.push(`narrativeState=${input.recommendation.state}`);
    notes.push(`operatingState=${input.operatingState}`);
    notes.push(`vector=${input.pressureVectorSummary}`);
    notes.push(`confidenceBand=${input.recommendation.confidenceBand}`);
    notes.push(
      `comebackReadiness=${toPct(input.recommendation.comebackReadiness01)}`,
    );
    notes.push(
      `celebrationTolerance=${toPct(input.recommendation.celebrationTolerance01)}`,
    );
    notes.push(
      `silenceSuitability=${toPct(input.recommendation.silenceSuitability01)}`,
    );
    notes.push(`rescueUrgency=${toPct(input.recommendation.rescueUrgency01)}`);
    notes.push(
      `crowdPileOnRisk=${toPct(input.recommendation.crowdPileOnRisk01)}`,
    );

    if (input.recommendation.policyFlags.shouldPreferSilence) {
      notes.push('policy=silence_linger');
    }
    if (input.recommendation.policyFlags.shouldEscalateRescue) {
      notes.push('policy=rescue_escalate');
    }
    if (input.recommendation.policyFlags.shouldPrimeComebackSpeech) {
      notes.push('policy=comeback_prime');
    }
    if (input.recommendation.policyFlags.shouldRestrainCelebration) {
      notes.push('policy=celebration_hold');
    }
    if (input.recommendation.policyFlags.shouldWarnCrowdPileOn) {
      notes.push('policy=crowd_pile_on_warn');
    }
    if (input.input.eventTags?.length) {
      notes.push(`eventTags=${input.input.eventTags.join('|')}`);
    }

    return notes;
  }
}

/* ========================================================================== *
 * MARK: Public helpers
 * ========================================================================== */

export function createPressureAffectModel(
  options: PressureAffectModelOptions = {},
): PressureAffectModel {
  return new PressureAffectModel(options);
}

export function evaluatePressureAffect(
  input: PressureAffectModelInput,
  options: PressureAffectModelOptions = {},
): PressureAffectResult {
  return createPressureAffectModel(options).evaluate(input);
}

export function summarizePressureAffect(
  result: PressureAffectResult,
): readonly string[] {
  return createPressureAffectModel().summarize(result);
}

/* ========================================================================== *
 * MARK: Internal helpers
 * ========================================================================== */

function mergeDefaults(
  overrides?: Partial<typeof CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS>,
): typeof CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS {
  return Object.freeze({
    ...CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS,
    ...(overrides ?? {}),
    pressureTierWeights: Object.freeze({
      ...CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS.pressureTierWeights,
      ...(overrides?.pressureTierWeights ?? {}),
    }),
    channelExposureBias: Object.freeze({
      ...CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS.channelExposureBias,
      ...(overrides?.channelExposureBias ?? {}),
    }),
    swarmDirectionBias: Object.freeze({
      ...CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS.swarmDirectionBias,
      ...(overrides?.swarmDirectionBias ?? {}),
    }),
  });
}

function safe01(value: Score01 | number | undefined | null): Score01 {
  return clampEmotionScalar(Number(value ?? 0));
}

function average(values: readonly (number | undefined)[], fallback = 0): Score01 {
  const filtered = values.filter(
    (value): value is number => Number.isFinite(value as number),
  );
  if (!filtered.length) {
    return clampEmotionScalar(fallback);
  }
  return clampEmotionScalar(
    filtered.reduce((sum, value) => sum + value, 0) / filtered.length,
  );
}

function invert01(value: Score01 | number | undefined): Score01 {
  return clampEmotionScalar(1 - Number(value ?? 0));
}

function normalizeCount(value: number | undefined, weight = 0.12): Score01 {
  return clampEmotionScalar(Math.min(1, Number(value ?? 0) * weight));
}

function normalizeIgnoredHelperCount(value: number | undefined): Score01 {
  return clampEmotionScalar(Math.min(1, Number(value ?? 0) * 0.19));
}

function normalizeRescueUrgency(value: ChatRescueDecision | undefined): Score01 {
  if (!value?.triggered) {
    return clampEmotionScalar(0);
  }
  switch (value.urgency) {
    case 'CRITICAL':
      return clampEmotionScalar(1);
    case 'HARD':
      return clampEmotionScalar(0.8);
    case 'MEDIUM':
      return clampEmotionScalar(0.56);
    case 'SOFT':
      return clampEmotionScalar(0.34);
    default:
      return clampEmotionScalar(0.14);
  }
}

function normalizeRescueUrgencyInverse(
  value: ChatRescueDecision | undefined,
): Score01 {
  return invert01(normalizeRescueUrgency(value));
}

function inferOutboundFailure(feature?: ChatFeatureSnapshot): Score01 {
  if (!feature) {
    return clampEmotionScalar(0);
  }
  const outbound = Math.max(1, feature.outboundPlayerCountWindow);
  const ignored = feature.ignoredHelperCountWindow;
  const silenceTax = feature.messageCountWindow === 0 ? 0.08 : 0;
  return clampEmotionScalar(Math.min(1, ignored / outbound + silenceTax));
}

function inferTimePressure(feature?: ChatFeatureSnapshot): Score01 {
  const map: Record<string, number> = {
    NONE: 0,
    BUILDING: 0.22,
    ELEVATED: 0.46,
    HIGH: 0.71,
    CRITICAL: 0.93,
  };
  return clampEmotionScalar(map[feature?.pressureTier ?? 'NONE'] ?? 0);
}

function inferComebackSeed(
  inference?: ChatInferenceSnapshot,
  feature?: ChatFeatureSnapshot,
): Score01 {
  return clampEmotionScalar(
    safe01(inference?.engagement01) * 0.34 +
      invert01(feature?.churnRisk01) * 0.22 +
      invert01(feature?.hostileMomentum01) * 0.12 +
      safe01(inference?.helperTiming01) * 0.1,
  );
}

function inferRecentSurvival(inference?: ChatInferenceSnapshot): Score01 {
  return clampEmotionScalar(
    safe01(inference?.helperTiming01) * 0.23 +
      invert01(inference?.toxicityRisk01) * 0.11 +
      invert01(inference?.churnRisk01) * 0.08,
  );
}

function helperPresenceFromRelationships(
  relationships: readonly ChatRelationshipState[],
): Score01 {
  return average(
    relationships.map(
      (value) =>
        safe01(value.trust01) * 0.52 + safe01(value.rescueDebt01) * 0.48,
    ),
    0,
  );
}

function inferNegativeAudienceBias(
  audienceHeat: ChatAudienceHeat | undefined,
): Score01 {
  if (!audienceHeat) {
    return clampEmotionScalar(0);
  }
  return clampEmotionScalar(
    audienceHeat.swarmDirection === 'NEGATIVE'
      ? 1
      : audienceHeat.swarmDirection === 'NEUTRAL'
        ? 0.2
        : 0,
  );
}

function inferSilenceTax(decision: ChatSilenceDecision | undefined): Score01 {
  return clampEmotionScalar(decision?.active ? 0.28 : 0);
}

function buildDescriptiveVectorFromPressure(
  vector: Readonly<
    Pick<
      ChatEmotionVector,
      'intimidation' | 'confidence' | 'frustration' | 'relief' | 'desperation'
    >
  >,
): ChatEmotionVector {
  return Object.freeze({
    intimidation: vector.intimidation,
    confidence: vector.confidence,
    frustration: vector.frustration,
    curiosity: clampEmotionScalar(0),
    attachment: clampEmotionScalar(0),
    socialEmbarrassment: clampEmotionScalar(0),
    relief: vector.relief,
    dominance: clampEmotionScalar(0),
    desperation: vector.desperation,
    trust: clampEmotionScalar(0),
  });
}

function ensureOperatingState(
  value: ChatEmotionOperatingState,
): ChatEmotionOperatingState {
  return CHAT_EMOTION_OPERATING_STATES.includes(value) ? value : 'UNSET';
}

function buildResultMetadata(input: {
  readonly authority: ChatAuthority;
  readonly input: PressureAffectModelInput;
  readonly pressureSeverity: Score01;
  readonly publicExposure: Score01;
  readonly stabilizer: Score01;
  readonly crowdThreat: Score01;
  readonly operatingState: ChatEmotionOperatingState;
  readonly pressureVector: Readonly<
    Pick<
      ChatEmotionVector,
      'intimidation' | 'confidence' | 'frustration' | 'relief' | 'desperation'
    >
  >;
}): JsonObject {
  return Object.freeze({
    authority: input.authority,
    eventTags: Object.freeze([...(input.input.eventTags ?? [])]),
    operatingState: input.operatingState,
    axesUsed: Object.freeze([...CHAT_EMOTION_AXES]),
    pressureVector: Object.freeze({
      intimidation: input.pressureVector.intimidation,
      confidence: input.pressureVector.confidence,
      frustration: input.pressureVector.frustration,
      relief: input.pressureVector.relief,
      desperation: input.pressureVector.desperation,
    }),
    roomId: input.input.roomId,
    channel: input.input.channel,
    userId: input.input.userId,
    pressureSeverity01: input.pressureSeverity,
    publicExposure01: input.publicExposure,
    stabilizer01: input.stabilizer,
    crowdThreat01: input.crowdThreat,
  });
}

function toPct(value: Score01 | number): string {
  return `${Math.round(Number(value) * 100)}`;
}


/* ========================================================================== *
 * MARK: Extended public analysis surfaces
 * ========================================================================== */

export type PressureAffectModeId =
  | 'EMPIRE'
  | 'PREDATOR'
  | 'SYNDICATE'
  | 'PHANTOM'
  | 'UNKNOWN';

export type PressureExposureClass =
  | 'PRIVATE_LOW'
  | 'PRIVATE_HEATED'
  | 'SEMI_PUBLIC'
  | 'PUBLIC_WATCH'
  | 'PUBLIC_HUMILIATION';

export type PressureStabilizerClass =
  | 'NONE'
  | 'FRAGILE'
  | 'RECOVERING'
  | 'SUPPORTED'
  | 'FORTIFIED';

export type PressureCrowdClass =
  | 'QUIET'
  | 'OBSERVING'
  | 'HEATED'
  | 'PREDATORY'
  | 'SWARMING';

export type PressureDominantAxis =
  | 'INTIMIDATION'
  | 'FRUSTRATION'
  | 'RELIEF'
  | 'DESPERATION'
  | 'CONFIDENCE'
  | 'BALANCED';

export type PressureAffectScenario =
  | 'CEREMONIAL_RECOVERY'
  | 'COMEBACK_WINDOW'
  | 'CROWD_HUMILIATION'
  | 'CROWD_PILE_ON'
  | 'DEALROOM_PREDATION'
  | 'HELPER_STABILIZATION'
  | 'HUNTED_PUBLICLY'
  | 'LOW_GRADE_TENSION'
  | 'PREDATORY_QUIET'
  | 'RESCUE_PRESSURE'
  | 'SPIKE_WITHOUT_RECOVERY'
  | 'STEADY_SURVEILLANCE'
  | 'VOLATILE_COLLAPSE';

export interface PressureAffectModeProfile {
  readonly modeId: PressureAffectModeId;
  readonly displayName: string;
  readonly description: string;
  readonly channelBias: Readonly<Record<ChatVisibleChannel, Score01>>;
  readonly intimidationBias01: Score01;
  readonly frustrationBias01: Score01;
  readonly reliefBias01: Score01;
  readonly desperationBias01: Score01;
  readonly confidenceBias01: Score01;
  readonly exposureBias01: Score01;
  readonly crowdBias01: Score01;
  readonly rescueBias01: Score01;
  readonly silenceBias01: Score01;
  readonly stabilizerBias01: Score01;
  readonly notes: readonly string[];
}

export interface PressureAxisSnapshot {
  readonly axis: ChatEmotionAxis;
  readonly score01: Score01;
  readonly rank: number;
  readonly percentileLabel: string;
  readonly confidenceBand: ChatEmotionConfidenceBand;
  readonly operatingState: ChatEmotionOperatingState;
  readonly descriptiveSummary: string;
}

export interface PressureAffectSignalDigest {
  readonly modeId: PressureAffectModeId;
  readonly exposureClass: PressureExposureClass;
  readonly stabilizerClass: PressureStabilizerClass;
  readonly crowdClass: PressureCrowdClass;
  readonly dominantAxis: PressureDominantAxis;
  readonly scenario: PressureAffectScenario;
  readonly publicIntensity01: Score01;
  readonly recoveryHeadroom01: Score01;
  readonly collapseRisk01: Score01;
  readonly silenceRisk01: Score01;
  readonly negotiationRisk01: Score01;
  readonly comebackStrength01: Score01;
  readonly axisSnapshots: readonly PressureAxisSnapshot[];
  readonly labels: readonly string[];
}

export interface PressureAffectRiskEnvelope {
  readonly collapseRisk01: Score01;
  readonly rescueRisk01: Score01;
  readonly humiliationRisk01: Score01;
  readonly silenceRisk01: Score01;
  readonly negotiationRisk01: Score01;
  readonly crowdEscalationRisk01: Score01;
  readonly recoveryOpportunity01: Score01;
  readonly overallRisk01: Score01;
  readonly labels: readonly string[];
}

export interface PressureAffectPolicyTrace {
  readonly shouldPreferSilence: boolean;
  readonly shouldEscalateRescue: boolean;
  readonly shouldPrimeComebackSpeech: boolean;
  readonly shouldRestrainCelebration: boolean;
  readonly shouldWarnCrowdPileOn: boolean;
  readonly silenceReason: string;
  readonly rescueReason: string;
  readonly comebackReason: string;
  readonly celebrationReason: string;
  readonly crowdReason: string;
}

export interface PressureAffectDiagnosticReport {
  readonly header: string;
  readonly modeId: PressureAffectModeId;
  readonly scenario: PressureAffectScenario;
  readonly dominantAxis: PressureDominantAxis;
  readonly stateLine: string;
  readonly riskLine: string;
  readonly policyLine: string;
  readonly vectorLine: string;
  readonly driverLines: readonly string[];
  readonly labelLines: readonly string[];
  readonly axisLines: readonly string[];
  readonly notes: readonly string[];
}

export interface PressureAffectOperatorPacket {
  readonly moduleName: typeof CHAT_PRESSURE_AFFECT_MODEL_MODULE_NAME;
  readonly version: typeof CHAT_PRESSURE_AFFECT_MODEL_VERSION;
  readonly modeId: PressureAffectModeId;
  readonly scenario: PressureAffectScenario;
  readonly dominantAxis: PressureDominantAxis;
  readonly state: PressureNarrativeState;
  readonly operatingState: ChatEmotionOperatingState;
  readonly confidenceBand: ChatEmotionConfidenceBand;
  readonly pressureSeverity01: Score01;
  readonly publicExposure01: Score01;
  readonly crowdThreat01: Score01;
  readonly stabilizer01: Score01;
  readonly collapseRisk01: Score01;
  readonly recoveryOpportunity01: Score01;
  readonly recommendation: PressureAffectRecommendation;
  readonly policyTrace: PressureAffectPolicyTrace;
  readonly labels: readonly string[];
  readonly metadata: JsonObject;
}

export interface PressureAffectDetailedResult {
  readonly result: PressureAffectResult;
  readonly modeProfile: PressureAffectModeProfile;
  readonly digest: PressureAffectSignalDigest;
  readonly riskEnvelope: PressureAffectRiskEnvelope;
  readonly policyTrace: PressureAffectPolicyTrace;
  readonly diagnosticReport: PressureAffectDiagnosticReport;
  readonly operatorPacket: PressureAffectOperatorPacket;
}

export interface PressureAffectBatchInput {
  readonly inputs: readonly PressureAffectModelInput[];
  readonly options?: PressureAffectModelOptions;
  readonly modeHint?: PressureAffectModeId;
  readonly batchLabel?: string;
}

export interface PressureAffectBatchAggregate {
  readonly batchLabel: string;
  readonly modeId: PressureAffectModeId;
  readonly sampleCount: number;
  readonly averagePressureSeverity01: Score01;
  readonly averagePublicExposure01: Score01;
  readonly averageCrowdThreat01: Score01;
  readonly averageStabilizer01: Score01;
  readonly averageCollapseRisk01: Score01;
  readonly peakCollapseRisk01: Score01;
  readonly peakCrowdEscalationRisk01: Score01;
  readonly dominantScenario: PressureAffectScenario;
  readonly dominantAxis: PressureDominantAxis;
  readonly scenarioCounts: Readonly<Record<PressureAffectScenario, number>>;
  readonly dominantState: PressureNarrativeState;
  readonly dominantOperatingState: ChatEmotionOperatingState;
  readonly labels: readonly string[];
}

export interface PressureAffectBatchResult {
  readonly entries: readonly PressureAffectDetailedResult[];
  readonly aggregate: PressureAffectBatchAggregate;
  readonly reports: readonly PressureAffectDiagnosticReport[];
}

export interface PressureAffectComparison {
  readonly previousState: PressureNarrativeState;
  readonly nextState: PressureNarrativeState;
  readonly previousOperatingState: ChatEmotionOperatingState;
  readonly nextOperatingState: ChatEmotionOperatingState;
  readonly pressureDelta01: number;
  readonly exposureDelta01: number;
  readonly crowdDelta01: number;
  readonly stabilizerDelta01: number;
  readonly intimidationDelta01: number;
  readonly frustrationDelta01: number;
  readonly reliefDelta01: number;
  readonly desperationDelta01: number;
  readonly confidenceRepairDelta01: number;
  readonly summary: readonly string[];
}

export interface PressureAffectTrajectoryPoint {
  readonly sequence: number;
  readonly input: PressureAffectModelInput;
  readonly detailed: PressureAffectDetailedResult;
  readonly comparisonFromPrevious?: PressureAffectComparison;
}

export interface PressureAffectTrajectoryResult {
  readonly points: readonly PressureAffectTrajectoryPoint[];
  readonly aggregate: PressureAffectBatchAggregate;
  readonly summary: readonly string[];
}

export interface PressureAffectReplayFrame {
  readonly sequence: number;
  readonly state: PressureNarrativeState;
  readonly operatingState: ChatEmotionOperatingState;
  readonly dominantAxis: PressureDominantAxis;
  readonly scenario: PressureAffectScenario;
  readonly pressureSeverity01: Score01;
  readonly crowdThreat01: Score01;
  readonly publicExposure01: Score01;
  readonly stabilizer01: Score01;
  readonly collapseRisk01: Score01;
  readonly recommendation: PressureAffectRecommendation;
  readonly label: string;
}

export interface PressureAffectSurfaceManifestEntry {
  readonly name: string;
  readonly kind:
    | 'CONSTANT'
    | 'TYPE'
    | 'CLASS'
    | 'HELPER'
    | 'FACTORY'
    | 'BATCH'
    | 'DIAGNOSTIC';
  readonly description: string;
}

/* ========================================================================== *
 * MARK: Mode profiles and thresholds
 * ========================================================================== */

type PressureAffectModeProfileSeed = Readonly<{
  modeId: PressureAffectModeId;
  displayName: string;
  description: string;
  channelBias: Readonly<Record<ChatVisibleChannel, number>>;
  intimidationBias01: number;
  frustrationBias01: number;
  reliefBias01: number;
  desperationBias01: number;
  confidenceBias01: number;
  exposureBias01: number;
  crowdBias01: number;
  rescueBias01: number;
  silenceBias01: number;
  stabilizerBias01: number;
  notes: readonly string[];
}>;

function score01Literal(value: number): Score01 {
  return safe01(value);
}

function createPressureAffectChannelBias(
  input: Readonly<Record<ChatVisibleChannel, number>>,
): Readonly<Record<ChatVisibleChannel, Score01>> {
  return Object.freeze({
    GLOBAL: score01Literal(input.GLOBAL),
    SYNDICATE: score01Literal(input.SYNDICATE),
    DEAL_ROOM: score01Literal(input.DEAL_ROOM),
    LOBBY: score01Literal(input.LOBBY),
  });
}

function createPressureAffectModeProfile(
  seed: PressureAffectModeProfileSeed,
): PressureAffectModeProfile {
  return Object.freeze({
    modeId: seed.modeId,
    displayName: seed.displayName,
    description: seed.description,
    channelBias: createPressureAffectChannelBias(seed.channelBias),
    intimidationBias01: score01Literal(seed.intimidationBias01),
    frustrationBias01: score01Literal(seed.frustrationBias01),
    reliefBias01: score01Literal(seed.reliefBias01),
    desperationBias01: score01Literal(seed.desperationBias01),
    confidenceBias01: score01Literal(seed.confidenceBias01),
    exposureBias01: score01Literal(seed.exposureBias01),
    crowdBias01: score01Literal(seed.crowdBias01),
    rescueBias01: score01Literal(seed.rescueBias01),
    silenceBias01: score01Literal(seed.silenceBias01),
    stabilizerBias01: score01Literal(seed.stabilizerBias01),
    notes: Object.freeze([...seed.notes]),
  });
}

export const CHAT_PRESSURE_AFFECT_MODE_PROFILES = Object.freeze({
  EMPIRE: createPressureAffectModeProfile({
    modeId: 'EMPIRE',
    displayName: 'Empire',
    description:
      'Empire treats public witness as sovereignty pressure. Exposure and posture matter more than private turbulence.',
    channelBias: Object.freeze({
      GLOBAL: 0.9,
      SYNDICATE: 0.52,
      DEAL_ROOM: 0.58,
      LOBBY: 0.44,
    }),
    intimidationBias01: 0.09,
    frustrationBias01: 0.05,
    reliefBias01: 0.02,
    desperationBias01: 0.06,
    confidenceBias01: 0.04,
    exposureBias01: 0.11,
    crowdBias01: 0.09,
    rescueBias01: 0.03,
    silenceBias01: 0.07,
    stabilizerBias01: 0.02,
    notes: Object.freeze([
      'Public witness matters more in Empire.',
      'Status loss compounds intimidation quickly.',
      'Relief should not over-repair without visible validation.',
    ]),
  }),
  PREDATOR: createPressureAffectModeProfile({
    modeId: 'PREDATOR',
    displayName: 'Predator',
    description:
      'Predator treats delay, leverage, and predatory quiet as pressure multipliers. Deal-room pressure is strategic rather than noisy.',
    channelBias: Object.freeze({
      GLOBAL: 0.48,
      SYNDICATE: 0.42,
      DEAL_ROOM: 0.93,
      LOBBY: 0.31,
    }),
    intimidationBias01: 0.07,
    frustrationBias01: 0.04,
    reliefBias01: 0.01,
    desperationBias01: 0.08,
    confidenceBias01: 0.02,
    exposureBias01: 0.06,
    crowdBias01: 0.05,
    rescueBias01: 0.02,
    silenceBias01: 0.12,
    stabilizerBias01: 0.01,
    notes: Object.freeze([
      'Deal-room silence can be predatory, not calm.',
      'Negotiation risk should be elevated.',
      'Confidence repair is slower unless leverage materially improves.',
    ]),
  }),
  SYNDICATE: createPressureAffectModeProfile({
    modeId: 'SYNDICATE',
    displayName: 'Syndicate',
    description:
      'Syndicate amplifies trust, rescue debt, and helper timing. Breakdown under peer witness is especially consequential.',
    channelBias: Object.freeze({
      GLOBAL: 0.45,
      SYNDICATE: 0.94,
      DEAL_ROOM: 0.51,
      LOBBY: 0.33,
    }),
    intimidationBias01: 0.04,
    frustrationBias01: 0.06,
    reliefBias01: 0.07,
    desperationBias01: 0.05,
    confidenceBias01: 0.06,
    exposureBias01: 0.05,
    crowdBias01: 0.04,
    rescueBias01: 0.09,
    silenceBias01: 0.04,
    stabilizerBias01: 0.08,
    notes: Object.freeze([
      'Helper intervention matters more in Syndicate.',
      'Trust repair is a concrete stabilizer.',
      'Crowd danger is lower than betrayal danger.',
    ]),
  }),
  PHANTOM: createPressureAffectModeProfile({
    modeId: 'PHANTOM',
    displayName: 'Phantom',
    description:
      'Phantom privileges dread, delayed witness, and haunted continuity. Quiet pressure and spectral observation matter.',
    channelBias: Object.freeze({
      GLOBAL: 0.56,
      SYNDICATE: 0.47,
      DEAL_ROOM: 0.63,
      LOBBY: 0.39,
    }),
    intimidationBias01: 0.08,
    frustrationBias01: 0.03,
    reliefBias01: 0.01,
    desperationBias01: 0.07,
    confidenceBias01: 0.03,
    exposureBias01: 0.07,
    crowdBias01: 0.07,
    rescueBias01: 0.02,
    silenceBias01: 0.1,
    stabilizerBias01: 0.03,
    notes: Object.freeze([
      'Quiet observation is pressure, not emptiness.',
      'Recovery should feel earned, not automatic.',
      'Phantom favors mood carryover and delayed repair.',
    ]),
  }),
  UNKNOWN: createPressureAffectModeProfile({
    modeId: 'UNKNOWN',
    displayName: 'Unknown',
    description:
      'Fallback profile when no strong mode hint exists.',
    channelBias: Object.freeze({
      GLOBAL: 0.5,
      SYNDICATE: 0.5,
      DEAL_ROOM: 0.5,
      LOBBY: 0.5,
    }),
    intimidationBias01: 0.03,
    frustrationBias01: 0.03,
    reliefBias01: 0.03,
    desperationBias01: 0.03,
    confidenceBias01: 0.03,
    exposureBias01: 0.03,
    crowdBias01: 0.03,
    rescueBias01: 0.03,
    silenceBias01: 0.03,
    stabilizerBias01: 0.03,
    notes: Object.freeze([
      'Fallback only.',
      'Use channel + tags + metadata to resolve a stronger mode when possible.',
    ]),
  }),
} satisfies Readonly<Record<PressureAffectModeId, PressureAffectModeProfile>>);

export const CHAT_PRESSURE_AFFECT_SURFACE_MANIFEST = Object.freeze([
  Object.freeze({
    name: 'CHAT_PRESSURE_AFFECT_MODEL_MODULE_NAME',
    kind: 'CONSTANT',
    description: 'Stable module identifier for audit and import discipline.',
  }),
  Object.freeze({
    name: 'CHAT_PRESSURE_AFFECT_MODEL_VERSION',
    kind: 'CONSTANT',
    description: 'Stable version identifier for replay and cache discipline.',
  }),
  Object.freeze({
    name: 'CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS',
    kind: 'CONSTANT',
    description: 'Canonical thresholds and weights for the backend pressure model.',
  }),
  Object.freeze({
    name: 'CHAT_PRESSURE_AFFECT_MODE_PROFILES',
    kind: 'CONSTANT',
    description: 'Mode-stratified bias profiles for Empire, Predator, Syndicate, and Phantom.',
  }),
  Object.freeze({
    name: 'PressureAffectModel',
    kind: 'CLASS',
    description: 'Primary evaluator class for authoritative pressure and affect scoring.',
  }),
  Object.freeze({
    name: 'createPressureAffectModel',
    kind: 'FACTORY',
    description: 'Creates the canonical runtime model instance.',
  }),
  Object.freeze({
    name: 'evaluatePressureAffect',
    kind: 'HELPER',
    description: 'Standalone evaluation helper for one input.',
  }),
  Object.freeze({
    name: 'summarizePressureAffect',
    kind: 'HELPER',
    description: 'Compact summary helper for one result.',
  }),
  Object.freeze({
    name: 'evaluatePressureAffectDetailed',
    kind: 'DIAGNOSTIC',
    description: 'Evaluates one input and emits digest, risk, policy, and operator packet surfaces.',
  }),
  Object.freeze({
    name: 'evaluatePressureAffectBatch',
    kind: 'BATCH',
    description: 'Evaluates many inputs and returns aggregate pressure analytics.',
  }),
  Object.freeze({
    name: 'evaluatePressureAffectTrajectory',
    kind: 'BATCH',
    description: 'Evaluates a sequence of inputs and computes point-to-point drift.',
  }),
  Object.freeze({
    name: 'buildPressureAffectDiagnosticReport',
    kind: 'DIAGNOSTIC',
    description: 'Builds a detailed audit report from one result.',
  }),
  Object.freeze({
    name: 'buildPressureAffectOperatorPacket',
    kind: 'DIAGNOSTIC',
    description: 'Builds a compact operator-facing packet for downstream orchestration.',
  }),
  Object.freeze({
    name: 'comparePressureAffectResults',
    kind: 'HELPER',
    description: 'Computes drift between two pressure results.',
  }),
  Object.freeze({
    name: 'buildPressureAffectReplayFrames',
    kind: 'HELPER',
    description: 'Creates replay-friendly pressure frames from a trajectory.',
  }),
] satisfies readonly PressureAffectSurfaceManifestEntry[]);

/* ========================================================================== *
 * MARK: Extended public factories and reports
 * ========================================================================== */

export function resolvePressureAffectModeProfile(
  input: Pick<PressureAffectModelInput, 'channel' | 'eventTags' | 'metadata'>,
  explicitModeId?: PressureAffectModeId,
): PressureAffectModeProfile {
  if (explicitModeId) {
    return CHAT_PRESSURE_AFFECT_MODE_PROFILES[explicitModeId];
  }

  const tags = new Set((input.eventTags ?? []).map((value) => value.toUpperCase()));
  const metadataMode = readMetadataString(input.metadata, [
    'modeId',
    'mode',
    'gameMode',
    'screenMode',
  ]);
  const normalizedMetadataMode = normalizeModeId(metadataMode);

  if (normalizedMetadataMode) {
    return CHAT_PRESSURE_AFFECT_MODE_PROFILES[normalizedMetadataMode];
  }

  if (tags.has('EMPIRE')) {
    return CHAT_PRESSURE_AFFECT_MODE_PROFILES.EMPIRE;
  }
  if (tags.has('PREDATOR') || input.channel === 'DEAL_ROOM') {
    return CHAT_PRESSURE_AFFECT_MODE_PROFILES.PREDATOR;
  }
  if (tags.has('SYNDICATE') || input.channel === 'SYNDICATE') {
    return CHAT_PRESSURE_AFFECT_MODE_PROFILES.SYNDICATE;
  }
  if (tags.has('PHANTOM')) {
    return CHAT_PRESSURE_AFFECT_MODE_PROFILES.PHANTOM;
  }
  if (input.channel === 'GLOBAL') {
    return CHAT_PRESSURE_AFFECT_MODE_PROFILES.EMPIRE;
  }
  if (input.channel === 'LOBBY') {
    return CHAT_PRESSURE_AFFECT_MODE_PROFILES.UNKNOWN;
  }
  return CHAT_PRESSURE_AFFECT_MODE_PROFILES.UNKNOWN;
}

export function buildPressureAffectSignalDigest(
  input: PressureAffectModelInput,
  result: PressureAffectResult,
  modeHint?: PressureAffectModeId,
): PressureAffectSignalDigest {
  const modeProfile = resolvePressureAffectModeProfile(input, modeHint);
  const exposureClass = classifyPressureExposure(result.publicExposure01, result.channel);
  const stabilizerClass = classifyPressureStabilizer(result.stabilizer01);
  const crowdClass = classifyPressureCrowd(result.crowdThreat01, result.channel);
  const dominantAxis = resolvePressureDominantAxis(result.breakdown);
  const scenario = resolvePressureAffectScenario(result, modeProfile.modeId);
  const collapseRisk01 = clampEmotionScalar(
    result.breakdown.desperation01 * 0.37 +
      result.breakdown.intimidation01 * 0.16 +
      result.pressureSeverity01 * 0.18 +
      result.publicExposure01 * 0.1 +
      result.crowdThreat01 * 0.11 +
      invert01(result.breakdown.confidenceRepair01) * 0.08,
  );
  const recoveryHeadroom01 = clampEmotionScalar(
    result.breakdown.relief01 * 0.22 +
      result.breakdown.confidenceRepair01 * 0.34 +
      result.stabilizer01 * 0.18 +
      invert01(result.breakdown.desperation01) * 0.14 +
      invert01(result.crowdThreat01) * 0.12,
  );
  const silenceRisk01 = clampEmotionScalar(
    result.recommendation.silenceSuitability01 * 0.41 +
      result.crowdThreat01 * 0.14 +
      result.publicExposure01 * 0.12 +
      invert01(result.breakdown.relief01) * 0.17 +
      invert01(result.stabilizer01) * 0.16,
  );
  const negotiationRisk01 = clampEmotionScalar(
    modeProfile.modeId === 'PREDATOR'
      ? result.breakdown.desperation01 * 0.28 +
          result.breakdown.intimidation01 * 0.19 +
          result.pressureSeverity01 * 0.2 +
          result.publicExposure01 * 0.09 +
          result.crowdThreat01 * 0.08 +
          modeProfile.silenceBias01 * 0.16
      : result.breakdown.desperation01 * 0.18 +
          result.breakdown.frustration01 * 0.14 +
          result.pressureSeverity01 * 0.18 +
          result.crowdThreat01 * 0.08 +
          modeProfile.silenceBias01 * 0.08,
  );
  const comebackStrength01 = clampEmotionScalar(
    result.recommendation.comebackReadiness01 * 0.5 +
      result.breakdown.confidenceRepair01 * 0.2 +
      result.breakdown.relief01 * 0.13 +
      invert01(result.breakdown.intimidation01) * 0.09 +
      invert01(result.breakdown.desperation01) * 0.08,
  );
  const publicIntensity01 = clampEmotionScalar(
    result.publicExposure01 * 0.46 +
      result.crowdThreat01 * 0.26 +
      result.pressureSeverity01 * 0.18 +
      modeProfile.exposureBias01 * 0.1,
  );
  const axisSnapshots = Object.freeze(buildPressureAxisSnapshots(result));
  const labels = Object.freeze(buildPressureDigestLabels({
    modeProfile,
    result,
    exposureClass,
    stabilizerClass,
    crowdClass,
    dominantAxis,
    scenario,
    collapseRisk01,
    recoveryHeadroom01,
    silenceRisk01,
    negotiationRisk01,
    comebackStrength01,
    publicIntensity01,
  }));

  return Object.freeze({
    modeId: modeProfile.modeId,
    exposureClass,
    stabilizerClass,
    crowdClass,
    dominantAxis,
    scenario,
    publicIntensity01,
    recoveryHeadroom01,
    collapseRisk01,
    silenceRisk01,
    negotiationRisk01,
    comebackStrength01,
    axisSnapshots,
    labels,
  });
}

export function buildPressureAffectRiskEnvelope(
  result: PressureAffectResult,
  digest: PressureAffectSignalDigest,
): PressureAffectRiskEnvelope {
  const collapseRisk01 = digest.collapseRisk01;
  const rescueRisk01 = clampEmotionScalar(
    result.recommendation.rescueUrgency01 * 0.48 +
      result.breakdown.desperation01 * 0.17 +
      result.breakdown.frustration01 * 0.11 +
      result.pressureSeverity01 * 0.11 +
      invert01(result.stabilizer01) * 0.13,
  );
  const humiliationRisk01 = clampEmotionScalar(
    result.publicExposure01 * 0.41 +
      result.crowdThreat01 * 0.24 +
      result.breakdown.intimidation01 * 0.15 +
      result.pressureSeverity01 * 0.1 +
      result.recommendation.crowdPileOnRisk01 * 0.1,
  );
  const silenceRisk01 = digest.silenceRisk01;
  const negotiationRisk01 = digest.negotiationRisk01;
  const crowdEscalationRisk01 = clampEmotionScalar(
    result.recommendation.crowdPileOnRisk01 * 0.49 +
      result.crowdThreat01 * 0.19 +
      result.publicExposure01 * 0.14 +
      result.breakdown.frustration01 * 0.09 +
      result.breakdown.intimidation01 * 0.09,
  );
  const recoveryOpportunity01 = clampEmotionScalar(
    digest.recoveryHeadroom01 * 0.43 +
      result.breakdown.confidenceRepair01 * 0.18 +
      result.breakdown.relief01 * 0.15 +
      result.stabilizer01 * 0.13 +
      result.recommendation.comebackReadiness01 * 0.11,
  );
  const overallRisk01 = clampEmotionScalar(
    collapseRisk01 * 0.22 +
      rescueRisk01 * 0.14 +
      humiliationRisk01 * 0.16 +
      silenceRisk01 * 0.12 +
      negotiationRisk01 * 0.12 +
      crowdEscalationRisk01 * 0.14 +
      invert01(recoveryOpportunity01) * 0.1,
  );

  return Object.freeze({
    collapseRisk01,
    rescueRisk01,
    humiliationRisk01,
    silenceRisk01,
    negotiationRisk01,
    crowdEscalationRisk01,
    recoveryOpportunity01,
    overallRisk01,
    labels: Object.freeze(buildRiskEnvelopeLabels({
      digest,
      collapseRisk01,
      rescueRisk01,
      humiliationRisk01,
      silenceRisk01,
      negotiationRisk01,
      crowdEscalationRisk01,
      recoveryOpportunity01,
      overallRisk01,
    })),
  });
}

export function buildPressureAffectPolicyTrace(
  result: PressureAffectResult,
  digest: PressureAffectSignalDigest,
  riskEnvelope: PressureAffectRiskEnvelope,
): PressureAffectPolicyTrace {
  return Object.freeze({
    shouldPreferSilence: result.recommendation.policyFlags.shouldPreferSilence,
    shouldEscalateRescue: result.recommendation.policyFlags.shouldEscalateRescue,
    shouldPrimeComebackSpeech:
      result.recommendation.policyFlags.shouldPrimeComebackSpeech,
    shouldRestrainCelebration:
      result.recommendation.policyFlags.shouldRestrainCelebration,
    shouldWarnCrowdPileOn: result.recommendation.policyFlags.shouldWarnCrowdPileOn,
    silenceReason: resolveSilenceReason(result, digest, riskEnvelope),
    rescueReason: resolveRescueReason(result, digest, riskEnvelope),
    comebackReason: resolveComebackReason(result, digest, riskEnvelope),
    celebrationReason: resolveCelebrationReason(result, digest),
    crowdReason: resolveCrowdReason(result, digest, riskEnvelope),
  });
}

export function buildPressureAffectDiagnosticReport(
  result: PressureAffectResult,
  input?: PressureAffectModelInput,
  modeHint?: PressureAffectModeId,
): PressureAffectDiagnosticReport {
  const digest = buildPressureAffectSignalDigest(
    input ?? {
      userId: result.userId,
      roomId: result.roomId,
      channel: result.channel,
      evaluatedAt: result.evaluatedAt,
    },
    result,
    modeHint,
  );
  const riskEnvelope = buildPressureAffectRiskEnvelope(result, digest);
  const policyTrace = buildPressureAffectPolicyTrace(result, digest, riskEnvelope);
  const axisLines = Object.freeze(
    digest.axisSnapshots.map(
      (snapshot) =>
        `${snapshot.rank}. ${snapshot.axis.toLowerCase()}=${toPct(snapshot.score01)} band=${snapshot.confidenceBand} ${snapshot.descriptiveSummary}`,
    ),
  );
  const driverLines = Object.freeze(
    result.drivers.map(
      (driver) =>
        `${driver.label} :: ${driver.driver} :: ${toPct(driver.sourceWeight)} :: ${String(driver.reason)}`,
    ),
  );
  const labelLines = Object.freeze([
    ...digest.labels,
    ...riskEnvelope.labels,
  ]);

  return Object.freeze({
    header: `${CHAT_PRESSURE_AFFECT_MODEL_MODULE_NAME}@${CHAT_PRESSURE_AFFECT_MODEL_VERSION}`,
    modeId: digest.modeId,
    scenario: digest.scenario,
    dominantAxis: digest.dominantAxis,
    stateLine: `state=${result.narrativeState} operating=${result.operatingState} band=${result.confidenceBand}`,
    riskLine:
      `collapse=${toPct(riskEnvelope.collapseRisk01)} rescue=${toPct(riskEnvelope.rescueRisk01)} ` +
      `humiliation=${toPct(riskEnvelope.humiliationRisk01)} crowd=${toPct(riskEnvelope.crowdEscalationRisk01)} ` +
      `overall=${toPct(riskEnvelope.overallRisk01)} recovery=${toPct(riskEnvelope.recoveryOpportunity01)}`,
    policyLine:
      `silence=${policyTrace.silenceReason} rescue=${policyTrace.rescueReason} ` +
      `comeback=${policyTrace.comebackReason} celebration=${policyTrace.celebrationReason} ` +
      `crowd=${policyTrace.crowdReason}`,
    vectorLine: `vector=${result.pressureVectorSummary}`,
    driverLines,
    labelLines,
    axisLines,
    notes: Object.freeze([
      ...(result.notes ?? []),
      ...modeProfileNotes(resolvePressureAffectModeProfile(
        input ?? {
          userId: result.userId,
          roomId: result.roomId,
          channel: result.channel,
          evaluatedAt: result.evaluatedAt,
        },
        modeHint,
      )),
    ]),
  });
}

export function buildPressureAffectOperatorPacket(
  result: PressureAffectResult,
  input?: PressureAffectModelInput,
  modeHint?: PressureAffectModeId,
): PressureAffectOperatorPacket {
  const digest = buildPressureAffectSignalDigest(
    input ?? {
      userId: result.userId,
      roomId: result.roomId,
      channel: result.channel,
      evaluatedAt: result.evaluatedAt,
    },
    result,
    modeHint,
  );
  const riskEnvelope = buildPressureAffectRiskEnvelope(result, digest);
  const policyTrace = buildPressureAffectPolicyTrace(result, digest, riskEnvelope);

  return Object.freeze({
    moduleName: CHAT_PRESSURE_AFFECT_MODEL_MODULE_NAME,
    version: CHAT_PRESSURE_AFFECT_MODEL_VERSION,
    modeId: digest.modeId,
    scenario: digest.scenario,
    dominantAxis: digest.dominantAxis,
    state: result.narrativeState,
    operatingState: result.operatingState,
    confidenceBand: result.confidenceBand,
    pressureSeverity01: result.pressureSeverity01,
    publicExposure01: result.publicExposure01,
    crowdThreat01: result.crowdThreat01,
    stabilizer01: result.stabilizer01,
    collapseRisk01: riskEnvelope.collapseRisk01,
    recoveryOpportunity01: riskEnvelope.recoveryOpportunity01,
    recommendation: result.recommendation,
    policyTrace,
    labels: Object.freeze([...digest.labels, ...riskEnvelope.labels]),
    metadata: Object.freeze({
      roomId: result.roomId,
      userId: result.userId,
      channel: result.channel,
      evaluatedAt: result.evaluatedAt,
      narrativeState: result.narrativeState,
      operatingState: result.operatingState,
      dominantAxis: digest.dominantAxis,
      scenario: digest.scenario,
      exposureClass: digest.exposureClass,
      crowdClass: digest.crowdClass,
      stabilizerClass: digest.stabilizerClass,
    }),
  });
}

export function evaluatePressureAffectDetailed(
  input: PressureAffectModelInput,
  options: PressureAffectModelOptions = {},
  modeHint?: PressureAffectModeId,
): PressureAffectDetailedResult {
  const result = evaluatePressureAffect(input, options);
  const modeProfile = resolvePressureAffectModeProfile(input, modeHint);
  const digest = buildPressureAffectSignalDigest(input, result, modeProfile.modeId);
  const riskEnvelope = buildPressureAffectRiskEnvelope(result, digest);
  const policyTrace = buildPressureAffectPolicyTrace(result, digest, riskEnvelope);
  const diagnosticReport = buildPressureAffectDiagnosticReport(
    result,
    input,
    modeProfile.modeId,
  );
  const operatorPacket = buildPressureAffectOperatorPacket(
    result,
    input,
    modeProfile.modeId,
  );
  return Object.freeze({
    result,
    modeProfile,
    digest,
    riskEnvelope,
    policyTrace,
    diagnosticReport,
    operatorPacket,
  });
}

export function evaluatePressureAffectBatch(
  input: PressureAffectBatchInput,
): PressureAffectBatchResult {
  const entries = Object.freeze(
    input.inputs.map((value) =>
      evaluatePressureAffectDetailed(value, input.options ?? {}, input.modeHint),
    ),
  );
  const aggregate = buildPressureBatchAggregate(
    entries,
    input.batchLabel ?? 'PRESSURE_BATCH',
    input.modeHint,
  );
  const reports = Object.freeze(entries.map((entry) => entry.diagnosticReport));
  return Object.freeze({
    entries,
    aggregate,
    reports,
  });
}

export function comparePressureAffectResults(
  previous: PressureAffectResult,
  next: PressureAffectResult,
): PressureAffectComparison {
  const comparison = Object.freeze({
    previousState: previous.narrativeState,
    nextState: next.narrativeState,
    previousOperatingState: previous.operatingState,
    nextOperatingState: next.operatingState,
    pressureDelta01: delta01(previous.pressureSeverity01, next.pressureSeverity01),
    exposureDelta01: delta01(previous.publicExposure01, next.publicExposure01),
    crowdDelta01: delta01(previous.crowdThreat01, next.crowdThreat01),
    stabilizerDelta01: delta01(previous.stabilizer01, next.stabilizer01),
    intimidationDelta01: delta01(
      previous.breakdown.intimidation01,
      next.breakdown.intimidation01,
    ),
    frustrationDelta01: delta01(
      previous.breakdown.frustration01,
      next.breakdown.frustration01,
    ),
    reliefDelta01: delta01(previous.breakdown.relief01, next.breakdown.relief01),
    desperationDelta01: delta01(
      previous.breakdown.desperation01,
      next.breakdown.desperation01,
    ),
    confidenceRepairDelta01: delta01(
      previous.breakdown.confidenceRepair01,
      next.breakdown.confidenceRepair01,
    ),
    summary: Object.freeze([
      `state:${previous.narrativeState}->${next.narrativeState}`,
      `operating:${previous.operatingState}->${next.operatingState}`,
      `pressureDelta=${formatSignedPct(delta01(previous.pressureSeverity01, next.pressureSeverity01))}`,
      `exposureDelta=${formatSignedPct(delta01(previous.publicExposure01, next.publicExposure01))}`,
      `crowdDelta=${formatSignedPct(delta01(previous.crowdThreat01, next.crowdThreat01))}`,
      `stabilizerDelta=${formatSignedPct(delta01(previous.stabilizer01, next.stabilizer01))}`,
      `intimidationDelta=${formatSignedPct(delta01(previous.breakdown.intimidation01, next.breakdown.intimidation01))}`,
      `frustrationDelta=${formatSignedPct(delta01(previous.breakdown.frustration01, next.breakdown.frustration01))}`,
      `reliefDelta=${formatSignedPct(delta01(previous.breakdown.relief01, next.breakdown.relief01))}`,
      `desperationDelta=${formatSignedPct(delta01(previous.breakdown.desperation01, next.breakdown.desperation01))}`,
      `confidenceRepairDelta=${formatSignedPct(delta01(previous.breakdown.confidenceRepair01, next.breakdown.confidenceRepair01))}`,
    ]),
  });

  return comparison;
}

export function evaluatePressureAffectTrajectory(
  inputs: readonly PressureAffectModelInput[],
  options: PressureAffectModelOptions = {},
  modeHint?: PressureAffectModeId,
): PressureAffectTrajectoryResult {
  const points: PressureAffectTrajectoryPoint[] = [];

  for (let index = 0; index < inputs.length; index += 1) {
    const detailed = evaluatePressureAffectDetailed(inputs[index], options, modeHint);
    const previous = points[index - 1];
    points.push(
      Object.freeze({
        sequence: index,
        input: inputs[index],
        detailed,
        comparisonFromPrevious: previous
          ? comparePressureAffectResults(previous.detailed.result, detailed.result)
          : undefined,
      }),
    );
  }

  const aggregate = buildPressureBatchAggregate(
    Object.freeze(points.map((point) => point.detailed)),
    'PRESSURE_TRAJECTORY',
    modeHint,
  );

  return Object.freeze({
    points: Object.freeze(points),
    aggregate,
    summary: Object.freeze(buildTrajectorySummary(points, aggregate)),
  });
}

export function buildPressureAffectReplayFrames(
  trajectory: PressureAffectTrajectoryResult,
): readonly PressureAffectReplayFrame[] {
  return Object.freeze(
    trajectory.points.map((point) =>
      Object.freeze({
        sequence: point.sequence,
        state: point.detailed.result.narrativeState,
        operatingState: point.detailed.result.operatingState,
        dominantAxis: point.detailed.digest.dominantAxis,
        scenario: point.detailed.digest.scenario,
        pressureSeverity01: point.detailed.result.pressureSeverity01,
        crowdThreat01: point.detailed.result.crowdThreat01,
        publicExposure01: point.detailed.result.publicExposure01,
        stabilizer01: point.detailed.result.stabilizer01,
        collapseRisk01: point.detailed.riskEnvelope.collapseRisk01,
        recommendation: point.detailed.result.recommendation,
        label:
          `#${point.sequence} ${point.detailed.digest.scenario} ` +
          `${point.detailed.result.narrativeState} ` +
          `pressure=${toPct(point.detailed.result.pressureSeverity01)}`,
      }),
    ),
  );
}

export function listPressureAffectSurfaceManifest(): readonly PressureAffectSurfaceManifestEntry[] {
  return CHAT_PRESSURE_AFFECT_SURFACE_MANIFEST;
}

/* ========================================================================== *
 * MARK: Extended internal helpers
 * ========================================================================== */

function normalizeModeId(value: string | undefined): PressureAffectModeId | undefined {
  switch (String(value ?? '').trim().toUpperCase()) {
    case 'EMPIRE':
      return 'EMPIRE';
    case 'PREDATOR':
      return 'PREDATOR';
    case 'SYNDICATE':
      return 'SYNDICATE';
    case 'PHANTOM':
      return 'PHANTOM';
    case 'UNKNOWN':
      return 'UNKNOWN';
    default:
      return undefined;
  }
}

function readMetadataString(
  metadata: JsonObject | undefined,
  keys: readonly string[],
): string | undefined {
  const record = metadata as Record<string, unknown> | undefined;
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return undefined;
}

function classifyPressureExposure(
  exposure01: Score01,
  channel: ChatVisibleChannel,
): PressureExposureClass {
  if (channel === 'GLOBAL' && exposure01 >= 0.72) {
    return 'PUBLIC_HUMILIATION';
  }
  if (exposure01 >= 0.58) {
    return 'PUBLIC_WATCH';
  }
  if (exposure01 >= 0.4) {
    return 'SEMI_PUBLIC';
  }
  if (channel === 'DEAL_ROOM' && exposure01 >= 0.24) {
    return 'PRIVATE_HEATED';
  }
  return 'PRIVATE_LOW';
}

function classifyPressureStabilizer(stabilizer01: Score01): PressureStabilizerClass {
  if (stabilizer01 >= 0.76) {
    return 'FORTIFIED';
  }
  if (stabilizer01 >= 0.56) {
    return 'SUPPORTED';
  }
  if (stabilizer01 >= 0.38) {
    return 'RECOVERING';
  }
  if (stabilizer01 >= 0.18) {
    return 'FRAGILE';
  }
  return 'NONE';
}

function classifyPressureCrowd(
  crowdThreat01: Score01,
  channel: ChatVisibleChannel,
): PressureCrowdClass {
  if (crowdThreat01 >= 0.78) {
    return 'SWARMING';
  }
  if (channel === 'DEAL_ROOM' && crowdThreat01 >= 0.58) {
    return 'PREDATORY';
  }
  if (crowdThreat01 >= 0.56) {
    return 'HEATED';
  }
  if (crowdThreat01 >= 0.28) {
    return 'OBSERVING';
  }
  return 'QUIET';
}

function resolvePressureDominantAxis(
  breakdown: PressureAxisBreakdown,
): PressureDominantAxis {
  const entries = [
    ['INTIMIDATION', breakdown.intimidation01],
    ['FRUSTRATION', breakdown.frustration01],
    ['RELIEF', breakdown.relief01],
    ['DESPERATION', breakdown.desperation01],
    ['CONFIDENCE', breakdown.confidenceRepair01],
  ] as const;

  const sorted = [...entries].sort((a, b) => Number(b[1]) - Number(a[1]));
  const [top, second] = sorted;
  if (Math.abs(Number(top[1]) - Number(second[1])) <= 0.03) {
    return 'BALANCED';
  }
  return top[0];
}

function resolvePressureAffectScenario(
  result: PressureAffectResult,
  modeId: PressureAffectModeId,
): PressureAffectScenario {
  if (
    result.breakdown.relief01 >= 0.62 &&
    result.breakdown.confidenceRepair01 >= 0.6 &&
    result.pressureSeverity01 <= 0.36
  ) {
    return 'CEREMONIAL_RECOVERY';
  }
  if (
    result.recommendation.comebackReadiness01 >= 0.64 &&
    result.breakdown.confidenceRepair01 >= 0.58
  ) {
    return 'COMEBACK_WINDOW';
  }
  if (
    result.publicExposure01 >= 0.68 &&
    result.crowdThreat01 >= 0.62 &&
    result.breakdown.intimidation01 >= 0.64
  ) {
    return 'CROWD_HUMILIATION';
  }
  if (
    result.recommendation.crowdPileOnRisk01 >= 0.69 &&
    result.breakdown.frustration01 >= 0.58
  ) {
    return 'CROWD_PILE_ON';
  }
  if (
    modeId === 'PREDATOR' &&
    result.channel === 'DEAL_ROOM' &&
    result.breakdown.desperation01 >= 0.56
  ) {
    return 'DEALROOM_PREDATION';
  }
  if (
    result.stabilizer01 >= 0.56 &&
    result.breakdown.relief01 >= 0.48 &&
    result.recommendation.policyFlags.shouldEscalateRescue
  ) {
    return 'HELPER_STABILIZATION';
  }
  if (
    result.publicExposure01 >= 0.58 &&
    result.breakdown.intimidation01 >= 0.66 &&
    result.crowdThreat01 >= 0.48
  ) {
    return 'HUNTED_PUBLICLY';
  }
  if (
    result.pressureSeverity01 <= 0.34 &&
    result.crowdThreat01 <= 0.3 &&
    result.breakdown.desperation01 <= 0.3
  ) {
    return 'LOW_GRADE_TENSION';
  }
  if (
    modeId === 'PREDATOR' &&
    result.channel === 'DEAL_ROOM' &&
    result.recommendation.policyFlags.shouldPreferSilence
  ) {
    return 'PREDATORY_QUIET';
  }
  if (
    result.recommendation.rescueUrgency01 >= 0.6 &&
    result.breakdown.desperation01 >= 0.58
  ) {
    return 'RESCUE_PRESSURE';
  }
  if (
    result.pressureSeverity01 >= 0.72 &&
    result.breakdown.relief01 <= 0.26 &&
    result.breakdown.confidenceRepair01 <= 0.34
  ) {
    return 'SPIKE_WITHOUT_RECOVERY';
  }
  if (
    result.operatingState === 'VOLATILE' ||
    (result.breakdown.intimidation01 >= 0.68 && result.breakdown.frustration01 >= 0.68)
  ) {
    return 'VOLATILE_COLLAPSE';
  }
  return 'STEADY_SURVEILLANCE';
}

function buildPressureAxisSnapshots(
  result: PressureAffectResult,
): readonly PressureAxisSnapshot[] {
  const entries: readonly [ChatEmotionAxis, Score01][] = Object.freeze([
    ['INTIMIDATION', result.breakdown.intimidation01],
    ['FRUSTRATION', result.breakdown.frustration01],
    ['RELIEF', result.breakdown.relief01],
    ['DESPERATION', result.breakdown.desperation01],
    ['CONFIDENCE', result.breakdown.confidenceRepair01],
  ]);

  const ordered = [...entries].sort((a, b) => Number(b[1]) - Number(a[1]));

  return Object.freeze(
    ordered.map(([axis, score01], index) =>
      Object.freeze({
        axis,
        score01,
        rank: index + 1,
        percentileLabel: resolvePercentileLabel(score01),
        confidenceBand: computeEmotionConfidenceBand(score01),
        operatingState: resolveAxisOperatingState(axis, score01),
        descriptiveSummary: buildAxisSummary(axis, score01),
      }),
    ),
  );
}

function buildPressureDigestLabels(input: {
  readonly modeProfile: PressureAffectModeProfile;
  readonly result: PressureAffectResult;
  readonly exposureClass: PressureExposureClass;
  readonly stabilizerClass: PressureStabilizerClass;
  readonly crowdClass: PressureCrowdClass;
  readonly dominantAxis: PressureDominantAxis;
  readonly scenario: PressureAffectScenario;
  readonly collapseRisk01: Score01;
  readonly recoveryHeadroom01: Score01;
  readonly silenceRisk01: Score01;
  readonly negotiationRisk01: Score01;
  readonly comebackStrength01: Score01;
  readonly publicIntensity01: Score01;
}): readonly string[] {
  const labels: string[] = [];
  labels.push(`mode:${input.modeProfile.modeId.toLowerCase()}`);
  labels.push(`scenario:${input.scenario.toLowerCase()}`);
  labels.push(`dominantAxis:${input.dominantAxis.toLowerCase()}`);
  labels.push(`exposure:${input.exposureClass.toLowerCase()}`);
  labels.push(`stabilizer:${input.stabilizerClass.toLowerCase()}`);
  labels.push(`crowd:${input.crowdClass.toLowerCase()}`);
  labels.push(`state:${input.result.narrativeState.toLowerCase()}`);
  labels.push(`operating:${input.result.operatingState.toLowerCase()}`);

  if (input.collapseRisk01 >= 0.66) {
    labels.push('risk:collapse_high');
  }
  if (input.recoveryHeadroom01 >= 0.58) {
    labels.push('recovery:headroom_live');
  }
  if (input.silenceRisk01 >= 0.62) {
    labels.push('policy:silence_sensitive');
  }
  if (input.negotiationRisk01 >= 0.6) {
    labels.push('risk:negotiation_elevated');
  }
  if (input.comebackStrength01 >= 0.6) {
    labels.push('opportunity:comeback_live');
  }
  if (input.publicIntensity01 >= 0.62) {
    labels.push('stage:public_intense');
  }
  if (input.result.recommendation.policyFlags.shouldEscalateRescue) {
    labels.push('policy:rescue_escalate');
  }
  if (input.result.recommendation.policyFlags.shouldWarnCrowdPileOn) {
    labels.push('policy:crowd_warning');
  }
  return labels;
}

function buildRiskEnvelopeLabels(input: {
  readonly digest: PressureAffectSignalDigest;
  readonly collapseRisk01: Score01;
  readonly rescueRisk01: Score01;
  readonly humiliationRisk01: Score01;
  readonly silenceRisk01: Score01;
  readonly negotiationRisk01: Score01;
  readonly crowdEscalationRisk01: Score01;
  readonly recoveryOpportunity01: Score01;
  readonly overallRisk01: Score01;
}): readonly string[] {
  const labels: string[] = [];
  if (input.collapseRisk01 >= 0.72) {
    labels.push('collapse:critical');
  }
  if (input.rescueRisk01 >= 0.64) {
    labels.push('rescue:needed');
  }
  if (input.humiliationRisk01 >= 0.66) {
    labels.push('humiliation:elevated');
  }
  if (input.silenceRisk01 >= 0.62) {
    labels.push('silence:dangerous');
  }
  if (input.negotiationRisk01 >= 0.62) {
    labels.push('negotiation:fragile');
  }
  if (input.crowdEscalationRisk01 >= 0.66) {
    labels.push('crowd:escalation');
  }
  if (input.recoveryOpportunity01 >= 0.58) {
    labels.push('recovery:available');
  }
  if (input.overallRisk01 >= 0.68) {
    labels.push('overall:high_risk');
  }
  labels.push(`digest:${input.digest.scenario.toLowerCase()}`);
  return labels;
}

function resolveSilenceReason(
  result: PressureAffectResult,
  digest: PressureAffectSignalDigest,
  riskEnvelope: PressureAffectRiskEnvelope,
): string {
  if (!result.recommendation.policyFlags.shouldPreferSilence) {
    return 'silence_not_preferred';
  }
  if (digest.modeId === 'PREDATOR' && result.channel === 'DEAL_ROOM') {
    return 'predatory_quiet_preserved';
  }
  if (riskEnvelope.silenceRisk01 >= 0.7) {
    return 'silence_lingers_but_is_dangerous';
  }
  return 'silence_used_to_hold_pressure';
}

function resolveRescueReason(
  result: PressureAffectResult,
  digest: PressureAffectSignalDigest,
  riskEnvelope: PressureAffectRiskEnvelope,
): string {
  if (!result.recommendation.policyFlags.shouldEscalateRescue) {
    return 'rescue_not_escalated';
  }
  if (riskEnvelope.rescueRisk01 >= 0.74) {
    return 'rescue_critical';
  }
  if (digest.modeId === 'SYNDICATE') {
    return 'syndicate_support_window';
  }
  return 'rescue_elevated';
}

function resolveComebackReason(
  result: PressureAffectResult,
  digest: PressureAffectSignalDigest,
  riskEnvelope: PressureAffectRiskEnvelope,
): string {
  if (!result.recommendation.policyFlags.shouldPrimeComebackSpeech) {
    return 'comeback_not_ready';
  }
  if (riskEnvelope.recoveryOpportunity01 >= 0.7) {
    return 'comeback_window_live';
  }
  if (digest.dominantAxis === 'CONFIDENCE' || digest.dominantAxis === 'RELIEF') {
    return 'confidence_repair_supports_reentry';
  }
  return 'comeback_possible_but_fragile';
}

function resolveCelebrationReason(
  result: PressureAffectResult,
  digest: PressureAffectSignalDigest,
): string {
  if (!result.recommendation.policyFlags.shouldRestrainCelebration) {
    return 'celebration_allowed';
  }
  if (digest.modeId === 'EMPIRE' && result.publicExposure01 >= 0.54) {
    return 'public_stage_still_hot';
  }
  if (result.pressureSeverity01 >= 0.5) {
    return 'pressure_still_active';
  }
  return 'celebration_tolerance_insufficient';
}

function resolveCrowdReason(
  result: PressureAffectResult,
  digest: PressureAffectSignalDigest,
  riskEnvelope: PressureAffectRiskEnvelope,
): string {
  if (!result.recommendation.policyFlags.shouldWarnCrowdPileOn) {
    return 'crowd_warning_not_needed';
  }
  if (riskEnvelope.crowdEscalationRisk01 >= 0.74) {
    return 'crowd_pile_on_imminent';
  }
  if (digest.crowdClass === 'PREDATORY' || digest.crowdClass === 'SWARMING') {
    return 'crowd_behavior_predatory';
  }
  return 'crowd_heat_elevated';
}

function modeProfileNotes(profile: PressureAffectModeProfile): readonly string[] {
  return profile.notes;
}

function buildPressureBatchAggregate(
  entries: readonly PressureAffectDetailedResult[],
  batchLabel: string,
  modeHint?: PressureAffectModeId,
): PressureAffectBatchAggregate {
  const safeEntries = entries.length ? entries : [];
  const modeId = modeHint ?? resolveDominantModeId(safeEntries);
  const scenarioCounts = buildScenarioCounts(safeEntries);
  const averagePressureSeverity01 = average(
    safeEntries.map((entry) => entry.result.pressureSeverity01),
    0,
  );
  const averagePublicExposure01 = average(
    safeEntries.map((entry) => entry.result.publicExposure01),
    0,
  );
  const averageCrowdThreat01 = average(
    safeEntries.map((entry) => entry.result.crowdThreat01),
    0,
  );
  const averageStabilizer01 = average(
    safeEntries.map((entry) => entry.result.stabilizer01),
    0,
  );
  const averageCollapseRisk01 = average(
    safeEntries.map((entry) => entry.riskEnvelope.collapseRisk01),
    0,
  );
  const peakCollapseRisk01 = clampEmotionScalar(
    Math.max(0, ...safeEntries.map((entry) => Number(entry.riskEnvelope.collapseRisk01))),
  );
  const peakCrowdEscalationRisk01 = clampEmotionScalar(
    Math.max(
      0,
      ...safeEntries.map((entry) => Number(entry.riskEnvelope.crowdEscalationRisk01)),
    ),
  );
  const dominantScenario = resolveDominantScenarioFromCounts(scenarioCounts);
  const dominantAxis = resolveDominantAxisFromEntries(safeEntries);
  const dominantState = resolveDominantNarrativeState(safeEntries);
  const dominantOperatingState = resolveDominantOperatingState(safeEntries);

  return Object.freeze({
    batchLabel,
    modeId,
    sampleCount: safeEntries.length,
    averagePressureSeverity01,
    averagePublicExposure01,
    averageCrowdThreat01,
    averageStabilizer01,
    averageCollapseRisk01,
    peakCollapseRisk01,
    peakCrowdEscalationRisk01,
    dominantScenario,
    dominantAxis,
    scenarioCounts,
    dominantState,
    dominantOperatingState,
    labels: Object.freeze([
      `mode:${modeId.toLowerCase()}`,
      `samples:${safeEntries.length}`,
      `dominantScenario:${dominantScenario.toLowerCase()}`,
      `dominantAxis:${dominantAxis.toLowerCase()}`,
      `dominantState:${dominantState.toLowerCase()}`,
      `dominantOperating:${dominantOperatingState.toLowerCase()}`,
      `avgPressure:${toPct(averagePressureSeverity01)}`,
      `avgExposure:${toPct(averagePublicExposure01)}`,
      `avgCrowd:${toPct(averageCrowdThreat01)}`,
      `avgStabilizer:${toPct(averageStabilizer01)}`,
      `avgCollapse:${toPct(averageCollapseRisk01)}`,
      `peakCollapse:${toPct(peakCollapseRisk01)}`,
      `peakCrowd:${toPct(peakCrowdEscalationRisk01)}`,
    ]),
  });
}

function resolveDominantModeId(
  entries: readonly PressureAffectDetailedResult[],
): PressureAffectModeId {
  const counts = new Map<PressureAffectModeId, number>();
  for (const entry of entries) {
    counts.set(entry.modeProfile.modeId, (counts.get(entry.modeProfile.modeId) ?? 0) + 1);
  }
  return resolveMapWinner(counts, 'UNKNOWN');
}

function buildScenarioCounts(
  entries: readonly PressureAffectDetailedResult[],
): Readonly<Record<PressureAffectScenario, number>> {
  const counts: Record<PressureAffectScenario, number> = {
    CEREMONIAL_RECOVERY: 0,
    COMEBACK_WINDOW: 0,
    CROWD_HUMILIATION: 0,
    CROWD_PILE_ON: 0,
    DEALROOM_PREDATION: 0,
    HELPER_STABILIZATION: 0,
    HUNTED_PUBLICLY: 0,
    LOW_GRADE_TENSION: 0,
    PREDATORY_QUIET: 0,
    RESCUE_PRESSURE: 0,
    SPIKE_WITHOUT_RECOVERY: 0,
    STEADY_SURVEILLANCE: 0,
    VOLATILE_COLLAPSE: 0,
  };

  for (const entry of entries) {
    counts[entry.digest.scenario] += 1;
  }

  return Object.freeze(counts);
}

function resolveDominantScenarioFromCounts(
  counts: Readonly<Record<PressureAffectScenario, number>>,
): PressureAffectScenario {
  let winner: PressureAffectScenario = 'STEADY_SURVEILLANCE';
  let winnerCount = -1;
  for (const key of Object.keys(counts) as PressureAffectScenario[]) {
    if (counts[key] > winnerCount) {
      winner = key;
      winnerCount = counts[key];
    }
  }
  return winner;
}

function resolveDominantAxisFromEntries(
  entries: readonly PressureAffectDetailedResult[],
): PressureDominantAxis {
  const counts = new Map<PressureDominantAxis, number>();
  for (const entry of entries) {
    counts.set(entry.digest.dominantAxis, (counts.get(entry.digest.dominantAxis) ?? 0) + 1);
  }
  return resolveMapWinner(counts, 'BALANCED');
}

function resolveDominantNarrativeState(
  entries: readonly PressureAffectDetailedResult[],
): PressureNarrativeState {
  const counts = new Map<PressureNarrativeState, number>();
  for (const entry of entries) {
    counts.set(
      entry.result.narrativeState,
      (counts.get(entry.result.narrativeState) ?? 0) + 1,
    );
  }
  return resolveMapWinner(counts, 'STEADY');
}

function resolveDominantOperatingState(
  entries: readonly PressureAffectDetailedResult[],
): ChatEmotionOperatingState {
  const counts = new Map<ChatEmotionOperatingState, number>();
  for (const entry of entries) {
    counts.set(
      entry.result.operatingState,
      (counts.get(entry.result.operatingState) ?? 0) + 1,
    );
  }
  return resolveMapWinner(counts, 'UNSET');
}

function resolveMapWinner<T>(map: Map<T, number>, fallback: T): T {
  let winner = fallback;
  let winnerCount = -1;
  for (const [key, count] of map.entries()) {
    if (count > winnerCount) {
      winner = key;
      winnerCount = count;
    }
  }
  return winner;
}

function buildTrajectorySummary(
  points: readonly PressureAffectTrajectoryPoint[],
  aggregate: PressureAffectBatchAggregate,
): readonly string[] {
  const lines: string[] = [];
  lines.push(`samples=${points.length}`);
  lines.push(`mode=${aggregate.modeId}`);
  lines.push(`dominantScenario=${aggregate.dominantScenario}`);
  lines.push(`dominantAxis=${aggregate.dominantAxis}`);
  lines.push(`avgPressure=${toPct(aggregate.averagePressureSeverity01)}`);
  lines.push(`avgExposure=${toPct(aggregate.averagePublicExposure01)}`);
  lines.push(`avgCrowd=${toPct(aggregate.averageCrowdThreat01)}`);
  lines.push(`avgCollapse=${toPct(aggregate.averageCollapseRisk01)}`);
  lines.push(`peakCollapse=${toPct(aggregate.peakCollapseRisk01)}`);
  lines.push(`peakCrowd=${toPct(aggregate.peakCrowdEscalationRisk01)}`);

  for (const point of points) {
    const previous = point.comparisonFromPrevious;
    lines.push(
      `#${point.sequence} ${point.detailed.digest.scenario} ${point.detailed.result.narrativeState}` +
        ` pressure=${toPct(point.detailed.result.pressureSeverity01)}` +
        ` crowd=${toPct(point.detailed.result.crowdThreat01)}`,
    );
    if (previous) {
      lines.push(
        `#${point.sequence} drift pressure=${formatSignedPct(previous.pressureDelta01)}` +
          ` exposure=${formatSignedPct(previous.exposureDelta01)}` +
          ` crowd=${formatSignedPct(previous.crowdDelta01)}` +
          ` stabilizer=${formatSignedPct(previous.stabilizerDelta01)}`,
      );
    }
  }

  return Object.freeze(lines);
}

function resolvePercentileLabel(score01: Score01): string {
  const numeric = Number(score01);
  if (numeric >= 0.9) {
    return 'EXTREME';
  }
  if (numeric >= 0.75) {
    return 'VERY_HIGH';
  }
  if (numeric >= 0.6) {
    return 'HIGH';
  }
  if (numeric >= 0.4) {
    return 'ELEVATED';
  }
  if (numeric >= 0.2) {
    return 'LOW';
  }
  return 'QUIET';
}

function resolveAxisOperatingState(
  axis: ChatEmotionAxis,
  score01: Score01,
): ChatEmotionOperatingState {
  const numeric = Number(score01);
  if (numeric >= 0.84) {
    return ensureOperatingState('VOLATILE');
  }
  if (numeric >= 0.68) {
    return ensureOperatingState(axis === 'RELIEF' ? 'CEREMONIAL' : 'SPIKED');
  }
  if (numeric >= 0.48) {
    return ensureOperatingState('RISING');
  }
  if (numeric <= 0.18) {
    return ensureOperatingState('STABLE');
  }
  return ensureOperatingState('COLD_START');
}

function buildAxisSummary(axis: ChatEmotionAxis, score01: Score01): string {
  switch (axis) {
    case 'INTIMIDATION':
      return score01 >= 0.66
        ? 'The room is exerting fear and stage pressure.'
        : 'Fear pressure exists but has not fully captured the run.';
    case 'FRUSTRATION':
      return score01 >= 0.66
        ? 'Counterplay failure is emotionally sticky.'
        : 'Frustration exists but has not hardened into collapse.';
    case 'RELIEF':
      return score01 >= 0.58
        ? 'Meaningful stabilization is present.'
        : 'Relief is partial or still contested.';
    case 'DESPERATION':
      return score01 >= 0.66
        ? 'The run is nearing rescue-or-collapse territory.'
        : 'Desperation pressure is active but not yet terminal.';
    case 'CONFIDENCE':
      return score01 >= 0.58
        ? 'Confidence repair is materially available.'
        : 'Confidence repair remains fragile.';
    default:
      return 'Axis summary unavailable.';
  }
}

function delta01(previous: Score01 | number, next: Score01 | number): number {
  return Number(next) - Number(previous);
}

function formatSignedPct(value: number): string {
  const percent = Math.round(value * 100);
  return `${percent >= 0 ? '+' : ''}${percent}`;
}

