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
