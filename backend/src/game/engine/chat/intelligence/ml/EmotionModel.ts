/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT EMOTION MODEL
 * FILE: backend/src/game/engine/chat/intelligence/ml/EmotionModel.ts
 * VERSION: 2026.03.21-backend-emotion-model.v3
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative backend emotional operating model for the Point Zero One chat
 * lane.
 *
 * This module composes pressure, relationship continuity, audience pressure,
 * rescue timing, room/channel exposure, and learning-profile state into the
 * canonical shared emotional contract.
 *
 * What this file is responsible for
 * ---------------------------------
 * 1. Building a backend ChatEmotionSnapshot from authoritative state.
 * 2. Producing shared learning emotion signals for ranking, memory, and
 *    training surfaces.
 * 3. Selecting helper/hater/crowd/silence recommendations from the emotion
 *    vector rather than from a generic sentiment layer.
 * 4. Returning explainable driver evidence for replay, debugging, and future
 *    retrieval-backed continuity.
 * 5. Remaining compatible with the frontend emotional lane without duplicating
 *    ownership or flattening repo-specific logic.
 *
 * Design doctrine
 * ---------------
 * - Backend emotion is durable, authoritative, and replayable.
 * - Frontend emotion may adapt faster, but backend emotion decides truth.
 * - Emotion is a pressure engine, not a vibes engine.
 * - Silence is allowed to win when authored pressure should linger.
 * - Crowd theater, rescue windows, helper affinity, and hater opportunity all
 *   share one vector so downstream systems can coordinate without drift.
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
  ChatEmotionContextFrame,
  ChatEmotionDelta,
  ChatEmotionDriverEvidence,
  ChatEmotionDriverKind,
  ChatEmotionEnvelope,
  ChatEmotionSnapshot,
  ChatEmotionSourceKind,
  ChatEmotionSummary,
  ChatEmotionVector,
} from '../../../../../../../shared/contracts/chat/ChatEmotion';

import type { ChatAuthority } from '../../../../../../../shared/contracts/chat/ChatEvents';

import {
  CHAT_EMOTION_CONTRACT_MANIFEST,
  buildEmotionDebugNotes,
  clampEmotionScalar,
  computeEmotionConfidenceBand,
  createChatEmotionDeltaId,
  createChatEmotionDriverId,
  createChatEmotionTraceId,
  createEmotionDelta,
  createEmotionEnvelope,
  createEmotionSnapshot,
  describeEmotionVector,
  emotionScore01To100,
  getDominantEmotionAxis,
  getSecondaryEmotionAxis,
  projectEmotionToAudienceMood,
  projectEmotionToAudienceSeverity,
  summarizeEmotionSnapshot,
} from '../../../../../../../shared/contracts/chat/ChatEmotion';

import type {
  EmotionFeatureBag,
  EmotionRankingHint,
  EmotionSignalPreview,
  EmotionSignalReceipt,
  EmotionTrainingLabel,
} from '../../../../../../../shared/contracts/chat/learning/EmotionSignals';

import {
  EMOTION_SIGNAL_CONTRACT_MANIFEST,
  buildAllEmotionSignals,
} from '../../../../../../../shared/contracts/chat/learning/EmotionSignals';

import type {
  PressureAffectModelApi,
  PressureAffectModelInput,
  PressureAffectResult,
} from './PressureAffectModel';

import {
  CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS,
  CHAT_PRESSURE_AFFECT_MODEL_MODULE_NAME,
  CHAT_PRESSURE_AFFECT_MODEL_VERSION,
  createPressureAffectModel,
} from './PressureAffectModel';

import type {
  AttachmentAssessment,
  AttachmentModelApi,
  AttachmentModelInput,
} from './AttachmentModel';

import {
  CHAT_ATTACHMENT_MODEL_DEFAULTS,
  CHAT_ATTACHMENT_MODEL_MODULE_NAME,
  CHAT_ATTACHMENT_MODEL_VERSION,
  createAttachmentModel,
} from './AttachmentModel';

/* ========================================================================== *
 * MARK: Module identity
 * ========================================================================== */

export const CHAT_EMOTION_MODEL_MODULE_NAME =
  'PZO_BACKEND_CHAT_EMOTION_MODEL' as const;

export const CHAT_EMOTION_MODEL_VERSION =
  '2026.03.21-backend-emotion-model.v3' as const;

export const CHAT_EMOTION_MODEL_RUNTIME_LAWS = Object.freeze([
  'Emotion is backend runtime truth, not only UI adaptation metadata.',
  'Pressure, trust, crowd exposure, rescue urgency, and helper continuity must share one vector.',
  'Confidence should repair more slowly than humiliation spikes unless stabilizers are real.',
  'Deal-room predation should shape intimidation and silence recommendations.',
  'Crowd pile-on risk should influence helper timing and celebration restraint.',
  'Every axis must remain explainable through driver evidence and deltas.',
  'The model must emit shared learning signals without leaking UI ownership into backend authority.',
] as const);

export const CHAT_EMOTION_MODEL_DEFAULTS = Object.freeze({
  intimidationPressureBlend: 0.48,
  intimidationAttachmentPenaltyBlend: 0.14,
  confidenceRepairBlend: 0.31,
  frustrationPressureBlend: 0.41,
  curiosityWindowBlend: 0.26,
  curiosityExposureBlend: 0.11,
  attachmentBlend: 0.52,
  embarrassmentPublicBlend: 0.36,
  embarrassmentRivalryBlend: 0.15,
  reliefPressureBlend: 0.27,
  dominanceConfidenceBlend: 0.29,
  dominanceEmbarrassmentInverseBlend: 0.18,
  desperationPressureBlend: 0.33,
  desperationRescueBlend: 0.24,
  trustAttachmentBlend: 0.46,
  trustReliefBlend: 0.14,
  dealRoomPredationBias: 0.08,
  globalStageEmbarrassmentBias: 0.1,
  helperRestraintThreshold: 0.47,
  haterEscalationThreshold: 0.58,
  crowdSwarmThreshold: 0.56,
  silencePreferenceThreshold: 0.61,
  comebackThreshold: 0.55,
  celebrationRestraintThreshold: 0.49,
} as const);

/* ========================================================================== *
 * MARK: Internal contracts
 * ========================================================================== */

type EmotionAxisValueMap = Readonly<{
  confidence01: Score01;
  intimidation01: Score01;
  frustration01: Score01;
  curiosity01: Score01;
  attachment01: Score01;
  socialEmbarrassment01: Score01;
  relief01: Score01;
  dominance01: Score01;
  desperation01: Score01;
  trust01: Score01;
}>;

interface EmotionDriverInput {
  readonly axis: ChatEmotionAxis;
  readonly driver: ChatEmotionDriverKind;
  readonly sourceKind: ChatEmotionSourceKind;
  readonly signedImpact01: Score01;
  readonly label: string;
  readonly evidence: string;
  readonly roomId: ChatRoomId;
  readonly channel: ChatVisibleChannel;
  readonly sceneId?: string;
  readonly messageId?: string;
  readonly metadata: JsonObject;
}

interface EmotionDeltaInput {
  readonly previousVector: ChatEmotionVector;
  readonly nextVector: ChatEmotionVector;
  readonly authority: ChatAuthority;
  readonly evaluatedAt: UnixMs;
  readonly traceId: ChatEmotionSnapshot['traceId'];
}

/* ========================================================================== *
 * MARK: Public contracts
 * ========================================================================== */

export interface EmotionModelInput {
  readonly userId: ChatUserId;
  readonly roomId: ChatRoomId;
  readonly channel: ChatVisibleChannel;
  readonly sessionId?: string;
  readonly sceneId?: string;
  readonly messageId?: string;
  readonly evaluatedAt?: UnixMs;
  readonly authority?: ChatAuthority;
  readonly featureSnapshot?: ChatFeatureSnapshot;
  readonly learningProfile?: ChatLearningProfile;
  readonly audienceHeat?: ChatAudienceHeat;
  readonly rescueDecision?: ChatRescueDecision;
  readonly silenceDecision?: ChatSilenceDecision;
  readonly inferenceSnapshot?: ChatInferenceSnapshot;
  readonly relationships?: readonly ChatRelationshipState[];
  readonly helperPersonaIds?: readonly string[];
  readonly haterPersonaIds?: readonly string[];
  readonly previousSnapshot?: ChatEmotionSnapshot;
  readonly eventTags?: readonly string[];
  readonly metadata?: JsonObject;
}

export interface EmotionModelRecommendation {
  readonly helperDirective: ChatEmotionSnapshot['helperDirective'];
  readonly haterDirective: ChatEmotionSnapshot['haterDirective'];
  readonly crowdDirective: ChatEmotionSnapshot['crowdDirective'];
  readonly silenceDirective: ChatEmotionSnapshot['silenceDirective'];
  readonly shouldFireComebackSpeech: boolean;
  readonly shouldHoldCelebration: boolean;
  readonly shouldEscalateHelper: boolean;
  readonly shouldEscalateHater: boolean;
  readonly shouldWarnCrowdPileOn: boolean;
}

export interface EmotionModelResult {
  readonly model: typeof CHAT_EMOTION_MODEL_MODULE_NAME;
  readonly version: typeof CHAT_EMOTION_MODEL_VERSION;
  readonly snapshot: ChatEmotionSnapshot;
  readonly envelope: ChatEmotionEnvelope;
  readonly summary: ChatEmotionSummary;
  readonly pressureAffect: PressureAffectResult;
  readonly attachment: AttachmentAssessment;
  readonly scalarSignals: ReturnType<typeof buildAllEmotionSignals>['scalarSignals'];
  readonly deltaSignals: ReturnType<typeof buildAllEmotionSignals>['deltaSignals'];
  readonly trendSignal: ReturnType<typeof buildAllEmotionSignals>['trendSignal'];
  readonly featureBag: EmotionFeatureBag;
  readonly labels: readonly EmotionTrainingLabel[];
  readonly rankingHint: EmotionRankingHint;
  readonly preview: EmotionSignalPreview;
  readonly receipt: EmotionSignalReceipt;
  readonly recommendation: EmotionModelRecommendation;
  readonly notes: readonly string[];
}

export interface EmotionModelOptions {
  readonly defaults?: Partial<typeof CHAT_EMOTION_MODEL_DEFAULTS>;
  readonly authority?: ChatAuthority;
  readonly now?: () => UnixMs;
  readonly pressureAffectModel?: PressureAffectModelApi;
  readonly attachmentModel?: AttachmentModelApi;
}

export interface EmotionModelApi {
  readonly moduleName: typeof CHAT_EMOTION_MODEL_MODULE_NAME;
  readonly version: typeof CHAT_EMOTION_MODEL_VERSION;
  readonly defaults: typeof CHAT_EMOTION_MODEL_DEFAULTS;
  readonly pressureAffectModel: PressureAffectModelApi;
  readonly attachmentModel: AttachmentModelApi;
  evaluate(input: EmotionModelInput): EmotionModelResult;
  summarize(result: EmotionModelResult): readonly string[];
}

/* ========================================================================== *
 * MARK: Static mapping registries
 * ========================================================================== */

const AXIS_KEY_TO_CONTRACT_AXIS = Object.freeze({
  confidence: 'CONFIDENCE',
  intimidation: 'INTIMIDATION',
  frustration: 'FRUSTRATION',
  curiosity: 'CURIOSITY',
  attachment: 'ATTACHMENT',
  socialEmbarrassment: 'SOCIAL_EMBARRASSMENT',
  relief: 'RELIEF',
  dominance: 'DOMINANCE',
  desperation: 'DESPERATION',
  trust: 'TRUST',
} satisfies Record<keyof ChatEmotionVector, ChatEmotionAxis>);

const CONTRACT_AXIS_TO_VECTOR_KEY = Object.freeze({
  CONFIDENCE: 'confidence',
  INTIMIDATION: 'intimidation',
  FRUSTRATION: 'frustration',
  CURIOSITY: 'curiosity',
  ATTACHMENT: 'attachment',
  SOCIAL_EMBARRASSMENT: 'socialEmbarrassment',
  RELIEF: 'relief',
  DOMINANCE: 'dominance',
  DESPERATION: 'desperation',
  TRUST: 'trust',
} satisfies Record<ChatEmotionAxis, keyof ChatEmotionVector>);

const AXIS_TO_DELTA_DRIVER = Object.freeze({
  CONFIDENCE: 'COMEBACK_WINDOW',
  INTIMIDATION: 'PRESSURE_SPIKE',
  FRUSTRATION: 'PRESSURE_SPIKE',
  CURIOSITY: 'MEMORY_CALLBACK',
  ATTACHMENT: 'MEMORY_CALLBACK',
  SOCIAL_EMBARRASSMENT: 'CROWD_SWARM',
  RELIEF: 'RESCUE_INTERVENTION',
  DOMINANCE: 'COMEBACK_WINDOW',
  DESPERATION: 'BANKRUPTCY_THREAT',
  TRUST: 'HELPER_PRESENCE',
} satisfies Record<ChatEmotionAxis, ChatEmotionDriverKind>);

const AXIS_TO_DELTA_SOURCE_KIND = Object.freeze({
  CONFIDENCE: 'SYSTEM',
  INTIMIDATION: 'MOMENT',
  FRUSTRATION: 'MOMENT',
  CURIOSITY: 'SCENE',
  ATTACHMENT: 'LEARNING',
  SOCIAL_EMBARRASSMENT: 'CROWD_REACTION',
  RELIEF: 'RESCUE',
  DOMINANCE: 'MOMENT',
  DESPERATION: 'RESCUE',
  TRUST: 'HELPER_MESSAGE',
} satisfies Record<ChatEmotionAxis, ChatEmotionSourceKind>);

const DRIVER_LABELS = Object.freeze({
  curiosity: 'Curiosity window pressure',
  embarrassment: 'Crowd embarrassment pressure',
  dominance: 'Comeback authority pressure',
  trust: 'Helper trust carryover',
} as const);

/* ========================================================================== *
 * MARK: Implementation
 * ========================================================================== */

export class EmotionModel implements EmotionModelApi {
  public readonly moduleName = CHAT_EMOTION_MODEL_MODULE_NAME;
  public readonly version = CHAT_EMOTION_MODEL_VERSION;
  public readonly defaults: typeof CHAT_EMOTION_MODEL_DEFAULTS;
  public readonly pressureAffectModel: PressureAffectModelApi;
  public readonly attachmentModel: AttachmentModelApi;

  private readonly authority: ChatAuthority;
  private readonly now: () => UnixMs;

  public constructor(options: EmotionModelOptions = {}) {
    this.defaults = Object.freeze({
      ...CHAT_EMOTION_MODEL_DEFAULTS,
      ...(options.defaults ?? {}),
    });
    this.authority = (options.authority ?? 'BACKEND_ENGINE') as ChatAuthority;
    this.now = options.now ?? (() => Date.now() as UnixMs);
    this.pressureAffectModel =
      options.pressureAffectModel ??
      createPressureAffectModel({
        authority: this.authority,
        now: this.now,
      });
    this.attachmentModel =
      options.attachmentModel ??
      createAttachmentModel({
        authority: this.authority,
        now: this.now,
      });
  }

  public evaluate(input: EmotionModelInput): EmotionModelResult {
    const evaluatedAt = input.evaluatedAt ?? this.now();
    const authority = input.authority ?? this.authority;

    const pressureInput: PressureAffectModelInput = {
      userId: input.userId,
      roomId: input.roomId,
      channel: input.channel,
      evaluatedAt,
      authority,
      featureSnapshot: input.featureSnapshot,
      learningProfile: input.learningProfile,
      audienceHeat: input.audienceHeat,
      rescueDecision: input.rescueDecision,
      silenceDecision: input.silenceDecision,
      inferenceSnapshot: input.inferenceSnapshot,
      relationships: input.relationships,
      eventTags: input.eventTags,
      metadata: input.metadata,
    };

    const attachmentInput: AttachmentModelInput = {
      userId: input.userId,
      roomId: input.roomId,
      channel: input.channel,
      evaluatedAt,
      authority,
      relationships: input.relationships ?? [],
      learningProfile: input.learningProfile,
      featureSnapshot: input.featureSnapshot,
      helperPersonaIds: input.helperPersonaIds,
      haterPersonaIds: input.haterPersonaIds,
      metadata: input.metadata,
    };

    const pressureAffect = this.pressureAffectModel.evaluate(pressureInput);
    const attachment = this.attachmentModel.assess(attachmentInput);

    const profile = input.learningProfile;
    const feature = input.featureSnapshot;
    const previousVector = input.previousSnapshot?.vector;

    const confidence01 = clampEmotionScalar(
      Number(pressureAffect.breakdown.confidenceRepair01) *
        this.defaults.confidenceRepairBlend +
        safe01(profile?.affect.confidence01) * 0.21 +
        invert01(pressureAffect.breakdown.desperation01) * 0.12 +
        safe01(input.inferenceSnapshot?.engagement01) * 0.1,
    );

    const intimidation01 = clampEmotionScalar(
      Number(pressureAffect.breakdown.intimidation01) *
        this.defaults.intimidationPressureBlend +
        Number(attachment.rivalryContamination01) *
          this.defaults.intimidationAttachmentPenaltyBlend +
        channelPredationBias(input.channel, this.defaults.dealRoomPredationBias),
    );

    const frustration01 = clampEmotionScalar(
      Number(pressureAffect.breakdown.frustration01) *
        this.defaults.frustrationPressureBlend +
        safe01(profile?.affect.frustration01) * 0.18 +
        inferSilenceFriction(input.silenceDecision) * 0.08,
    );

    const curiosity01 = clampEmotionScalar(
      inferCuriosity(feature, profile, input.inferenceSnapshot) *
        this.defaults.curiosityWindowBlend +
        safe01(profile?.affect.curiosity01) * 0.2 +
        Number(pressureAffect.publicExposure01) *
          this.defaults.curiosityExposureBlend,
    );

    const attachment01 = clampEmotionScalar(
      Number(attachment.attachment01) * this.defaults.attachmentBlend +
        safe01(profile?.affect.attachment01) * 0.18,
    );

    const socialEmbarrassment01 = clampEmotionScalar(
      inferEmbarrassment(
        input.channel,
        pressureAffect,
        attachment,
        profile,
        this.defaults.globalStageEmbarrassmentBias,
      ) * this.defaults.embarrassmentPublicBlend +
        Number(attachment.rivalryContamination01) *
          this.defaults.embarrassmentRivalryBlend +
        safe01(profile?.affect.embarrassment01) * 0.19,
    );

    const relief01 = clampEmotionScalar(
      Number(pressureAffect.breakdown.relief01) * this.defaults.reliefPressureBlend +
        Number(attachment.trust01) * 0.11 +
        safe01(profile?.affect.relief01) * 0.16,
    );

    const dominance01 = clampEmotionScalar(
      confidence01 * this.defaults.dominanceConfidenceBlend +
        invert01(socialEmbarrassment01) *
          this.defaults.dominanceEmbarrassmentInverseBlend +
        inferDominance(input.inferenceSnapshot, feature) * 0.15,
    );

    const desperation01 = clampEmotionScalar(
      Number(pressureAffect.breakdown.desperation01) *
        this.defaults.desperationPressureBlend +
        normalizeRescue(input.rescueDecision) *
          this.defaults.desperationRescueBlend +
        safe01(profile?.churnRisk01) * 0.17,
    );

    const trust01 = clampEmotionScalar(
      Number(attachment.trust01) * this.defaults.trustAttachmentBlend +
        relief01 * this.defaults.trustReliefBlend +
        safe01(profile?.helperReceptivity01) * 0.13 -
        Number(attachment.rivalryContamination01) * 0.08,
    );

    const rawAxisValues = Object.freeze({
      confidence01,
      intimidation01,
      frustration01,
      curiosity01,
      attachment01,
      socialEmbarrassment01,
      relief01,
      dominance01,
      desperation01,
      trust01,
    } satisfies EmotionAxisValueMap);

    const vector = createBackendEmotionVector(rawAxisValues);
    const traceId = createChatEmotionTraceId();

    const drivers = Object.freeze(
      this.buildDrivers({
        input,
        pressureAffect,
        attachment,
        vector,
      }),
    );

    const deltas = Object.freeze(
      this.buildDeltas({
        previousVector,
        nextVector: vector,
        authority,
        evaluatedAt,
        traceId,
      }),
    );

    const snapshot = createEmotionSnapshot({
      context: this.createContext(input, pressureAffect, vector, evaluatedAt),
      vector,
      previousVector,
      drivers,
      deltas,
      notes: this.buildSnapshotNotes(input, pressureAffect, attachment, vector),
      metadata: this.buildMetadata(input, pressureAffect, attachment, vector),
      observedAtUnixMs: evaluatedAt,
      authority,
      traceId,
    });

    const envelope = createEmotionEnvelope(snapshot);
    const summary = summarizeEmotionSnapshot(snapshot);
    const signalPack = buildAllEmotionSignals(snapshot);

    const recommendation = Object.freeze({
      helperDirective: snapshot.helperDirective,
      haterDirective: snapshot.haterDirective,
      crowdDirective: snapshot.crowdDirective,
      silenceDirective: snapshot.silenceDirective,
      shouldFireComebackSpeech:
        snapshot.derived.comebackReadiness >= this.defaults.comebackThreshold &&
        snapshot.derived.operatingState !== 'WOUNDED',
      shouldHoldCelebration:
        snapshot.derived.celebrationTolerance <=
          this.defaults.celebrationRestraintThreshold ||
        snapshot.derived.silenceSuitability >=
          this.defaults.silencePreferenceThreshold,
      shouldEscalateHelper:
        snapshot.derived.helperUrgency >= this.defaults.helperRestraintThreshold ||
        pressureAffect.recommendation.policyFlags.shouldEscalateRescue,
      shouldEscalateHater:
        snapshot.derived.haterOpportunity >= this.defaults.haterEscalationThreshold,
      shouldWarnCrowdPileOn:
        snapshot.derived.crowdPileOnRisk >= this.defaults.crowdSwarmThreshold ||
        pressureAffect.recommendation.policyFlags.shouldWarnCrowdPileOn,
    } satisfies EmotionModelRecommendation);

    const notes = Object.freeze([
      `model=${CHAT_EMOTION_MODEL_MODULE_NAME}`,
      `traceId=${snapshot.traceId}`,
      `dominant=${snapshot.derived.dominantAxis}`,
      snapshot.derived.secondaryAxis
        ? `secondary=${snapshot.derived.secondaryAxis}`
        : 'secondary=NONE',
      `state=${snapshot.derived.operatingState}`,
      `helperUrgency=${emotionScore01To100(snapshot.derived.helperUrgency)}`,
      `haterOpportunity=${emotionScore01To100(snapshot.derived.haterOpportunity)}`,
      `crowdPileOnRisk=${emotionScore01To100(snapshot.derived.crowdPileOnRisk)}`,
      `silenceSuitability=${emotionScore01To100(snapshot.derived.silenceSuitability)}`,
      `celebrationTolerance=${emotionScore01To100(snapshot.derived.celebrationTolerance)}`,
      ...buildEmotionDebugNotes(snapshot),
      ...pressureAffect.notes,
      ...attachment.notes,
    ]);

    return Object.freeze({
      model: CHAT_EMOTION_MODEL_MODULE_NAME,
      version: CHAT_EMOTION_MODEL_VERSION,
      snapshot,
      envelope,
      summary,
      pressureAffect,
      attachment,
      scalarSignals: signalPack.scalarSignals,
      deltaSignals: signalPack.deltaSignals,
      trendSignal: signalPack.trendSignal,
      featureBag: signalPack.featureBag,
      labels: signalPack.labels,
      rankingHint: signalPack.rankingHint,
      preview: signalPack.preview,
      receipt: signalPack.receipt,
      recommendation,
      notes,
    });
  }

  public summarize(result: EmotionModelResult): readonly string[] {
    return Object.freeze([
      `dominant=${result.snapshot.derived.dominantAxis}`,
      result.snapshot.derived.secondaryAxis
        ? `secondary=${result.snapshot.derived.secondaryAxis}`
        : 'secondary=NONE',
      `state=${result.snapshot.derived.operatingState}`,
      `vector=${describeEmotionVector(result.snapshot.vector)}`,
      `helperUrgency=${emotionScore01To100(result.snapshot.derived.helperUrgency)}`,
      `haterOpportunity=${emotionScore01To100(result.snapshot.derived.haterOpportunity)}`,
      `crowdPileOnRisk=${emotionScore01To100(result.snapshot.derived.crowdPileOnRisk)}`,
      `silenceSuitability=${emotionScore01To100(result.snapshot.derived.silenceSuitability)}`,
      `celebrationTolerance=${emotionScore01To100(result.snapshot.derived.celebrationTolerance)}`,
      `summary=${result.summary.narrative}`,
    ]);
  }

  private createContext(
    input: EmotionModelInput,
    pressureAffect: PressureAffectResult,
    vector: ChatEmotionVector,
    evaluatedAt: UnixMs,
  ): ChatEmotionContextFrame {
    return {
      roomId: input.roomId as unknown as ChatEmotionContextFrame['roomId'],
      channelId: input.channel as unknown as ChatEmotionContextFrame['channelId'],
      modeScope: 'RUN' as ChatEmotionContextFrame['modeScope'],
      mountTarget: 'CHAT_PANEL' as ChatEmotionContextFrame['mountTarget'],
      sourceAuthority: (input.authority ?? this.authority) as ChatEmotionContextFrame['sourceAuthority'],
      playerUserId:
        input.userId as unknown as ChatEmotionContextFrame['playerUserId'],
      sessionId:
        input.sessionId as unknown as ChatEmotionContextFrame['sessionId'],
      sceneId: input.sceneId as unknown as ChatEmotionContextFrame['sceneId'],
      activeMessageId:
        input.messageId as unknown as ChatEmotionContextFrame['activeMessageId'],
      audienceMood:
        projectEmotionToAudienceMood(vector) as ChatEmotionContextFrame['audienceMood'],
      audienceSeverity:
        projectEmotionToAudienceSeverity(
          vector,
        ) as ChatEmotionContextFrame['audienceSeverity'],
      audienceSwarmRisk:
        deriveAudienceSwarmRisk(
          input.audienceHeat,
          vector,
        ) as ChatEmotionContextFrame['audienceSwarmRisk'],
      witnessDensity:
        deriveWitnessDensity(
          input.audienceHeat,
          input.featureSnapshot,
        ) as ChatEmotionContextFrame['witnessDensity'],
      metadata: Object.freeze({
        evaluatedAt,
        eventTags: Object.freeze([...(input.eventTags ?? [])]),
        publicExposure01: pressureAffect.publicExposure01,
        pressureSeverity01: pressureAffect.pressureSeverity01,
        audienceHeat01: input.audienceHeat?.heat01 ?? null,
        swarmDirection: input.audienceHeat?.swarmDirection ?? null,
        messageId: input.messageId ?? null,
      }),
    };
  }

  private buildDrivers(input: {
    readonly input: EmotionModelInput;
    readonly pressureAffect: PressureAffectResult;
    readonly attachment: AttachmentAssessment;
    readonly vector: ChatEmotionVector;
  }): readonly ChatEmotionDriverEvidence[] {
    const vector = input.vector;

    const drivers: ChatEmotionDriverEvidence[] = [
      ...input.pressureAffect.drivers,
      ...input.attachment.drivers,
      this.driver({
        axis: 'CURIOSITY',
        driver: 'MEMORY_CALLBACK',
        sourceKind: 'SCENE',
        signedImpact01: safe01(vector.curiosity),
        label: DRIVER_LABELS.curiosity,
        evidence: 'Scene-window uncertainty and room exposure increased curiosity.',
        roomId: input.input.roomId,
        channel: input.input.channel,
        sceneId: input.input.sceneId,
        messageId: input.input.messageId,
        metadata: Object.freeze({
          pressureSeverity01: input.pressureAffect.pressureSeverity01,
          publicExposure01: input.pressureAffect.publicExposure01,
          eventTags: Object.freeze([...(input.input.eventTags ?? [])]),
        }),
      }),
      this.driver({
        axis: 'SOCIAL_EMBARRASSMENT',
        driver: 'CROWD_SWARM',
        sourceKind: 'CROWD_REACTION',
        signedImpact01: safe01(vector.socialEmbarrassment),
        label: DRIVER_LABELS.embarrassment,
        evidence:
          'Public exposure and rivalry contamination pushed embarrassment into the crowd lane.',
        roomId: input.input.roomId,
        channel: input.input.channel,
        sceneId: input.input.sceneId,
        messageId: input.input.messageId,
        metadata: Object.freeze({
          publicExposure01: input.pressureAffect.publicExposure01,
          crowdThreat01: input.pressureAffect.crowdThreat01,
          rivalryContamination01: input.attachment.rivalryContamination01,
        }),
      }),
      this.driver({
        axis: 'DOMINANCE',
        driver: 'COMEBACK_WINDOW',
        sourceKind: 'MOMENT',
        signedImpact01: safe01(vector.dominance),
        label: DRIVER_LABELS.dominance,
        evidence:
          'Confidence repair plus reduced embarrassment created a comeback-authority window.',
        roomId: input.input.roomId,
        channel: input.input.channel,
        sceneId: input.input.sceneId,
        messageId: input.input.messageId,
        metadata: Object.freeze({
          confidenceRepair01: input.pressureAffect.breakdown.confidenceRepair01,
          shouldPrimeComebackSpeech:
            input.pressureAffect.recommendation.policyFlags.shouldPrimeComebackSpeech,
        }),
      }),
      this.driver({
        axis: 'TRUST',
        driver: 'HELPER_PRESENCE',
        sourceKind: 'HELPER_MESSAGE',
        signedImpact01: safe01(vector.trust),
        label: DRIVER_LABELS.trust,
        evidence:
          'Helper affinity and attachment continuity produced trust carryover.',
        roomId: input.input.roomId,
        channel: input.input.channel,
        sceneId: input.input.sceneId,
        messageId: input.input.messageId,
        metadata: Object.freeze({
          helperAffinity01: input.attachment.helperAffinity01,
          attachment01: input.attachment.attachment01,
          followPersonaId: input.attachment.followPersonaId ?? null,
        }),
      }),
    ];

    return drivers;
  }

  private buildDeltas(input: EmotionDeltaInput): readonly ChatEmotionDelta[] {
    if (!input.previousVector) {
      return [];
    }

    const deltas: ChatEmotionDelta[] = [];

    for (const axisKey of Object.keys(input.nextVector) as (keyof ChatEmotionVector)[]) {
      const nextValue = Number(input.nextVector[axisKey] ?? 0);
      const prevValue = Number(input.previousVector[axisKey] ?? 0);
      const signedDelta = nextValue - prevValue;
      const magnitude = Math.abs(signedDelta);

      if (magnitude < 0.015) {
        continue;
      }

      const axis = normalizeAxis(axisKey);
      const deltaVector = createSingleAxisDeltaVector(axis, signedDelta);
      const directionLabel = signedDelta > 0 ? 'rise' : 'fall';
      const label = `${axis.toLowerCase().replace(/_/g, ' ')} ${directionLabel}`;
      const reason = `${axis.toLowerCase().replace(/_/g, '_')}_${directionLabel}`;

      deltas.push(
        createEmotionDelta({
          deltaId: createChatEmotionDeltaId(),
          traceId: input.traceId,
          emittedAt: new Date(input.evaluatedAt).toISOString(),
          sourceKind: AXIS_TO_DELTA_SOURCE_KIND[axis],
          driver: AXIS_TO_DELTA_DRIVER[axis],
          authority: input.authority,
          label,
          reason,
          vectorDelta: deltaVector,
          before: input.previousVector,
          after: input.nextVector,
          confidence: clampEmotionScalar(0.4 + magnitude * 0.5),
          urgency: clampEmotionScalar(magnitude),
          sticky: magnitude >= 0.18,
          hidden: false,
          metadata: Object.freeze({
            emotionAxis: axis,
            previous01: clampEmotionScalar(prevValue),
            current01: clampEmotionScalar(nextValue),
            signedDelta,
            magnitude01: clampEmotionScalar(magnitude),
          }),
        }),
      );
    }

    return deltas;
  }

  private buildSnapshotNotes(
    input: EmotionModelInput,
    pressureAffect: PressureAffectResult,
    attachment: AttachmentAssessment,
    vector: ChatEmotionVector,
  ): readonly string[] {
    const dominant = getDominantEmotionAxis(vector);
    const secondary = getSecondaryEmotionAxis(vector);

    return Object.freeze([
      `room=${input.roomId}`,
      `channel=${input.channel}`,
      `pressureModel=${pressureAffect.model}@${pressureAffect.version}`,
      `attachmentModel=${attachment.model}@${attachment.version}`,
      `dominant=${dominant}`,
      secondary ? `secondary=${secondary}` : 'secondary=NONE',
      `vector=${describeEmotionVector(vector)}`,
      `followPersonaId=${attachment.followPersonaId ?? 'none'}`,
      ...(input.eventTags?.map((value) => `tag=${value}`) ?? []),
    ]);
  }

  private buildMetadata(
    input: EmotionModelInput,
    pressureAffect: PressureAffectResult,
    attachment: AttachmentAssessment,
    vector: ChatEmotionVector,
  ): JsonObject {
    const dominant = getDominantEmotionAxis(vector);
    const secondary = getSecondaryEmotionAxis(vector);

    return Object.freeze({
      contracts: Object.freeze({
        emotion: Object.freeze({
          path: CHAT_EMOTION_CONTRACT_MANIFEST.path,
          version: CHAT_EMOTION_CONTRACT_MANIFEST.version,
        }),
        emotionSignals: Object.freeze({
          path: EMOTION_SIGNAL_CONTRACT_MANIFEST.path,
          version: EMOTION_SIGNAL_CONTRACT_MANIFEST.version,
        }),
      }),
      backendModels: Object.freeze({
        pressureAffect: Object.freeze({
          module: CHAT_PRESSURE_AFFECT_MODEL_MODULE_NAME,
          version: CHAT_PRESSURE_AFFECT_MODEL_VERSION,
        }),
        attachment: Object.freeze({
          module: CHAT_ATTACHMENT_MODEL_MODULE_NAME,
          version: CHAT_ATTACHMENT_MODEL_VERSION,
        }),
      }),
      upstreamDefaults: Object.freeze({
        pressureAffectDefaultKeys: Object.freeze(
          Object.keys(CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS),
        ),
        attachmentDefaultKeys: Object.freeze(
          Object.keys(CHAT_ATTACHMENT_MODEL_DEFAULTS),
        ),
      }),
      dominantAxis: dominant,
      secondaryAxis: secondary ?? null,
      channel: input.channel,
      publicExposure01: pressureAffect.publicExposure01,
      crowdThreat01: pressureAffect.crowdThreat01,
      pressureSeverity01: pressureAffect.pressureSeverity01,
      helperAffinity01: attachment.helperAffinity01,
      followPersonaId: attachment.followPersonaId ?? null,
      eventTags: Object.freeze([...(input.eventTags ?? [])]),
    });
  }

  private driver(input: EmotionDriverInput): ChatEmotionDriverEvidence {
    const salience = clampEmotionScalar(Math.max(Number(input.signedImpact01), 0.14));
    const confidence = clampEmotionScalar(
      salience * 0.72 +
        (input.driver === 'HELPER_PRESENCE' || input.driver === 'MEMORY_CALLBACK'
          ? 0.16
          : 0.1),
    );

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
      channelId: input.channel,
      sceneId: input.sceneId as unknown as ChatEmotionDriverEvidence['sceneId'],
      messageId:
        input.messageId as unknown as ChatEmotionDriverEvidence['messageId'],
      happenedAt: new Date(this.now()).toISOString(),
      metadata: Object.freeze({
        emotionAxis: input.axis,
        signedImpact01: Number(input.signedImpact01),
        ...input.metadata,
      }),
    });
  }
}

/* ========================================================================== *
 * MARK: Public helpers
 * ========================================================================== */

export function createEmotionModel(
  options: EmotionModelOptions = {},
): EmotionModel {
  return new EmotionModel(options);
}

export function evaluateEmotionModel(
  input: EmotionModelInput,
  options: EmotionModelOptions = {},
): EmotionModelResult {
  return createEmotionModel(options).evaluate(input);
}

export function summarizeEmotionModel(
  result: EmotionModelResult,
): readonly string[] {
  return createEmotionModel().summarize(result);
}

/* ========================================================================== *
 * MARK: Internal helpers
 * ========================================================================== */

function createBackendEmotionVector(axisValues: EmotionAxisValueMap): ChatEmotionVector {
  return Object.freeze({
    confidence: axisValues.confidence01,
    intimidation: axisValues.intimidation01,
    frustration: axisValues.frustration01,
    curiosity: axisValues.curiosity01,
    attachment: axisValues.attachment01,
    socialEmbarrassment: axisValues.socialEmbarrassment01,
    relief: axisValues.relief01,
    dominance: axisValues.dominance01,
    desperation: axisValues.desperation01,
    trust: axisValues.trust01,
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

function invert01(value: Score01 | number | undefined | null): Score01 {
  return clampEmotionScalar(1 - Number(value ?? 0));
}

function normalizeRescue(value: ChatRescueDecision | undefined): Score01 {
  if (!value?.triggered) {
    return clampEmotionScalar(0);
  }

  switch (value.urgency) {
    case 'CRITICAL':
      return clampEmotionScalar(1);
    case 'HARD':
      return clampEmotionScalar(0.82);
    case 'MEDIUM':
      return clampEmotionScalar(0.58);
    case 'SOFT':
      return clampEmotionScalar(0.34);
    default:
      return clampEmotionScalar(0.12);
  }
}

function channelPredationBias(
  channel: ChatVisibleChannel,
  dealRoomPredationBias: number,
): Score01 {
  if (channel === 'DEAL_ROOM') {
    return clampEmotionScalar(dealRoomPredationBias);
  }
  return clampEmotionScalar(0);
}

function inferCuriosity(
  feature: ChatFeatureSnapshot | undefined,
  profile: ChatLearningProfile | undefined,
  inference: ChatInferenceSnapshot | undefined,
): Score01 {
  const sceneMovement01 = average(
    [
      normalizeCount(feature?.inboundNpcCountWindow, 0.14),
      safe01(inference?.engagement01),
      invert01(feature?.churnRisk01),
    ],
    0,
  );

  const noveltyProxy01 = average(
    [
      normalizeCount(feature?.messageCountWindow, 0.04),
      normalizeCount(feature?.outboundPlayerCountWindow, 0.07),
      safe01(feature?.roomHeat01),
    ],
    0,
  );

  return clampEmotionScalar(
    safe01(profile?.affect.curiosity01) * 0.32 +
      sceneMovement01 * 0.38 +
      noveltyProxy01 * 0.14 +
      safe01(inference?.engagement01) * 0.06,
  );
}

function inferEmbarrassment(
  channel: ChatVisibleChannel,
  pressureAffect: PressureAffectResult,
  attachment: AttachmentAssessment,
  profile: ChatLearningProfile | undefined,
  globalStageEmbarrassmentBias: number,
): Score01 {
  const stageBias =
    channel === 'GLOBAL'
      ? globalStageEmbarrassmentBias
      : channel === 'DEAL_ROOM'
        ? 0.09
        : 0.04;

  return clampEmotionScalar(
    Number(pressureAffect.publicExposure01) * 0.34 +
      Number(pressureAffect.crowdThreat01) * 0.22 +
      Number(attachment.rivalryContamination01) * 0.16 +
      safe01(profile?.affect.embarrassment01) * 0.18 +
      stageBias,
  );
}

function inferDominance(
  inference: ChatInferenceSnapshot | undefined,
  feature: ChatFeatureSnapshot | undefined,
): Score01 {
  const control01 = average(
    [
      safe01(inference?.engagement01),
      safe01(inference?.helperTiming01),
      invert01(feature?.hostileMomentum01),
      invert01(feature?.churnRisk01),
    ],
    0,
  );

  return clampEmotionScalar(control01 * 0.59);
}

function inferSilenceFriction(decision: ChatSilenceDecision | undefined): Score01 {
  return clampEmotionScalar(decision?.active ? 0.28 : 0);
}

function normalizeCount(value: number | undefined, weight = 0.12): Score01 {
  return clampEmotionScalar(Math.min(1, Number(value ?? 0) * weight));
}

function normalizeAxis(key: keyof ChatEmotionVector): ChatEmotionAxis {
  return AXIS_KEY_TO_CONTRACT_AXIS[key];
}

function deriveAudienceSwarmRisk(
  audienceHeat: ChatAudienceHeat | undefined,
  vector: ChatEmotionVector,
): ChatEmotionContextFrame['audienceSwarmRisk'] {
  const base = average(
    [
      safe01(audienceHeat?.heat01),
      safe01(vector.socialEmbarrassment),
      safe01(vector.frustration),
      safe01(vector.intimidation),
    ],
    0,
  );

  if (base >= 0.9) {
    return 'OVERWHELMING';
  }
  if (base >= 0.74) {
    return 'SEVERE';
  }
  if (base >= 0.56) {
    return 'HIGH';
  }
  if (base >= 0.34) {
    return 'ELEVATED';
  }
  if (base >= 0.14) {
    return 'LOW';
  }
  return audienceHeat?.swarmDirection === 'NEGATIVE' ? 'LOW' : 'NONE';
}

function deriveWitnessDensity(
  audienceHeat: ChatAudienceHeat | undefined,
  feature: ChatFeatureSnapshot | undefined,
): ChatEmotionContextFrame['witnessDensity'] {
  const witnessProxy01 = average(
    [
      safe01(audienceHeat?.heat01),
      normalizeCount(feature?.messageCountWindow, 0.03),
      normalizeCount(feature?.inboundNpcCountWindow, 0.08),
      normalizeCount(feature?.outboundPlayerCountWindow, 0.08),
    ],
    0,
  );

  if (witnessProxy01 >= 0.86) {
    return 'SATURATED';
  }
  if (witnessProxy01 >= 0.66) {
    return 'HEAVY';
  }
  if (witnessProxy01 >= 0.42) {
    return 'MODERATE';
  }
  if (witnessProxy01 >= 0.2) {
    return 'LIGHT';
  }
  if (witnessProxy01 > 0) {
    return 'TRACE';
  }
  return 'NONE';
}

function createSingleAxisDeltaVector(
  axis: ChatEmotionAxis,
  signedDelta: number,
): Partial<ChatEmotionVector> {
  const value = clampEmotionScalar(Math.abs(signedDelta));
  const scalar = signedDelta >= 0 ? value : (0 - Number(value)) as number;
  const key = CONTRACT_AXIS_TO_VECTOR_KEY[axis];

  return Object.freeze({
    [key]: scalar,
  }) as Partial<ChatEmotionVector>;
}