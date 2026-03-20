/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT EMOTION MODEL
 * FILE: backend/src/game/engine/chat/intelligence/ml/EmotionModel.ts
 * VERSION: 2026.03.20-backend-emotion-model.v1
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
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
  ChatAuthority,
  ChatEmotionContextFrame,
  ChatEmotionDelta,
  ChatEmotionDriverEvidence,
  ChatEmotionEnvelope,
  ChatEmotionSnapshot,
  ChatEmotionSummary,
  ChatEmotionVector,
} from '../../../../../../../shared/contracts/chat/ChatEmotion';

import {
  CHAT_EMOTION_CONTRACT_MANIFEST,
  clampEmotionScalar,
  createChatEmotionDeltaId,
  createEmotionSnapshot,
  createEmotionEnvelope,
  describeEmotionVector,
  emotionScore01To100,
  getDominantEmotionAxis,
  getSecondaryEmotionAxis,
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
  '2026.03.20-backend-emotion-model.v1' as const;

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

    const pressureAffect = this.pressureAffectModel.evaluate({
      userId: input.userId,
      roomId: input.roomId,
      channel: input.channel,
      evaluatedAt,
      authority: input.authority ?? this.authority,
      featureSnapshot: input.featureSnapshot,
      learningProfile: input.learningProfile,
      audienceHeat: input.audienceHeat,
      rescueDecision: input.rescueDecision,
      silenceDecision: input.silenceDecision,
      inferenceSnapshot: input.inferenceSnapshot,
      relationships: input.relationships,
      eventTags: input.eventTags,
      metadata: input.metadata,
    });

    const attachment = this.attachmentModel.assess({
      userId: input.userId,
      roomId: input.roomId,
      channel: input.channel,
      evaluatedAt,
      authority: input.authority ?? this.authority,
      relationships: input.relationships ?? [],
      learningProfile: input.learningProfile,
      featureSnapshot: input.featureSnapshot,
      helperPersonaIds: input.helperPersonaIds,
      haterPersonaIds: input.haterPersonaIds,
      metadata: input.metadata,
    });

    const profile = input.learningProfile;
    const feature = input.featureSnapshot;
    const previousVector = input.previousSnapshot?.vector;

    const confidence01 = clampEmotionScalar(
      Number(pressureAffect.breakdown.confidenceRepair01) * this.defaults.confidenceRepairBlend +
        safe01(profile?.affect.confidence01) * 0.21 +
        invert01(pressureAffect.breakdown.desperation01) * 0.12 +
        safe01(input.inferenceSnapshot?.engagement01) * 0.1,
    );

    const intimidation01 = clampEmotionScalar(
      Number(pressureAffect.breakdown.intimidation01) * this.defaults.intimidationPressureBlend +
        Number(attachment.rivalryContamination01) * 0.12 +
        channelPredationBias(input.channel, this.defaults.dealRoomPredationBias),
    );

    const frustration01 = clampEmotionScalar(
      Number(pressureAffect.breakdown.frustration01) * this.defaults.frustrationPressureBlend +
        safe01(profile?.affect.frustration01) * 0.18 +
        inferSilenceFriction(input.silenceDecision) * 0.08,
    );

    const curiosity01 = clampEmotionScalar(
      inferCuriosity(feature, profile, input.inferenceSnapshot) * this.defaults.curiosityWindowBlend +
        safe01(profile?.affect.curiosity01) * 0.2 +
        Number(pressureAffect.publicExposure01) * this.defaults.curiosityExposureBlend,
    );

    const attachment01 = clampEmotionScalar(
      Number(attachment.attachment01) * this.defaults.attachmentBlend +
        safe01(profile?.affect.attachment01) * 0.18,
    );

    const socialEmbarrassment01 = clampEmotionScalar(
      inferEmbarrassment(input.channel, pressureAffect, attachment, profile) * this.defaults.embarrassmentPublicBlend +
        Number(attachment.rivalryContamination01) * this.defaults.embarrassmentRivalryBlend +
        safe01(profile?.affect.embarrassment01) * 0.19,
    );

    const relief01 = clampEmotionScalar(
      Number(pressureAffect.breakdown.relief01) * this.defaults.reliefPressureBlend +
        Number(attachment.trust01) * 0.11 +
        safe01(profile?.affect.relief01) * 0.16,
    );

    const dominance01 = clampEmotionScalar(
      confidence01 * this.defaults.dominanceConfidenceBlend +
        invert01(socialEmbarrassment01) * this.defaults.dominanceEmbarrassmentInverseBlend +
        inferDominance(input.inferenceSnapshot, feature) * 0.15,
    );

    const desperation01 = clampEmotionScalar(
      Number(pressureAffect.breakdown.desperation01) * this.defaults.desperationPressureBlend +
        normalizeRescue(input.rescueDecision) * this.defaults.desperationRescueBlend +
        safe01(profile?.churnRisk01) * 0.17,
    );

    const trust01 = clampEmotionScalar(
      Number(attachment.trust01) * this.defaults.trustAttachmentBlend +
        relief01 * this.defaults.trustReliefBlend +
        safe01(profile?.helperReceptivity01) * 0.13 -
        Number(attachment.rivalryContamination01) * 0.08,
    );

    const vector: Partial<ChatEmotionVector> = Object.freeze({
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
    });

    const drivers = Object.freeze(
      this.buildDrivers({
        input,
        pressureAffect,
        attachment,
        vector,
      }),
    );

    const deltas = Object.freeze(
      this.buildDeltas(previousVector, vector, input.authority ?? this.authority, evaluatedAt),
    );

    const snapshot = createEmotionSnapshot({
      context: this.createContext(input, evaluatedAt),
      vector,
      previousVector,
      drivers,
      deltas,
      notes: this.buildSnapshotNotes(input, pressureAffect, attachment, vector),
      metadata: this.buildMetadata(input, pressureAffect, attachment),
      observedAtUnixMs: evaluatedAt,
      authority: input.authority ?? this.authority,
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
        snapshot.derived.reliefNeed >= this.defaults.celebrationRestraintThreshold ||
        snapshot.derived.silenceSuitability >= 0.55,
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
      `dominant=${snapshot.derived.dominantAxis}`,
      snapshot.derived.secondaryAxis ? `secondary=${snapshot.derived.secondaryAxis}` : 'secondary=NONE',
      `state=${snapshot.derived.operatingState}`,
      `helperUrgency=${emotionScore01To100(snapshot.derived.helperUrgency)}`,
      `haterOpportunity=${emotionScore01To100(snapshot.derived.haterOpportunity)}`,
      `crowdPileOnRisk=${emotionScore01To100(snapshot.derived.crowdPileOnRisk)}`,
      `silenceSuitability=${emotionScore01To100(snapshot.derived.silenceSuitability)}`,
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
    ]);
  }

  private createContext(
    input: EmotionModelInput,
    evaluatedAt: UnixMs,
  ): ChatEmotionContextFrame {
    return {
      roomId: input.roomId as unknown as ChatEmotionContextFrame['roomId'],
      channelId: input.channel as unknown as ChatEmotionContextFrame['channelId'],
      modeScope: 'RUN' as ChatEmotionContextFrame['modeScope'],
      mountTarget: 'CHAT_PANEL' as ChatEmotionContextFrame['mountTarget'],
      sourceAuthority: (input.authority ?? this.authority) as ChatEmotionContextFrame['sourceAuthority'],
      userId: input.userId as unknown as ChatEmotionContextFrame['userId'],
      sessionId: input.sessionId as unknown as ChatEmotionContextFrame['sessionId'],
      sceneId: input.sceneId as unknown as ChatEmotionContextFrame['sceneId'],
      messageId: input.messageId as unknown as ChatEmotionContextFrame['messageId'],
      observedAtUnixMs: evaluatedAt,
      tags: Object.freeze([...(input.eventTags ?? [])]),
    };
  }

  private buildDrivers(input: {
    readonly input: EmotionModelInput;
    readonly pressureAffect: PressureAffectResult;
    readonly attachment: AttachmentAssessment;
    readonly vector: Partial<ChatEmotionVector>;
  }): readonly ChatEmotionDriverEvidence[] {
    const vector = input.vector;
    const drivers: ChatEmotionDriverEvidence[] = [
      ...input.pressureAffect.drivers,
      ...input.attachment.drivers,
      this.driver('CURIOSITY', safe01(vector.curiosity01), 'SCENE_WINDOW', {
        channel: input.input.channel,
        pressureSeverity01: input.pressureAffect.pressureSeverity01,
        eventTags: input.input.eventTags ?? [],
      }),
      this.driver('SOCIAL_EMBARRASSMENT', safe01(vector.socialEmbarrassment01), 'CROWD_HEAT', {
        publicExposure01: input.pressureAffect.publicExposure01,
        rivalryContamination01: input.attachment.rivalryContamination01,
      }),
      this.driver('DOMINANCE', safe01(vector.dominance01), 'COMEBACK_WINDOW', {
        confidenceRepair01: input.pressureAffect.breakdown.confidenceRepair01,
      }),
      this.driver('TRUST', safe01(vector.trust01), 'HELPER_TRUST', {
        helperAffinity01: input.attachment.helperAffinity01,
        followPersonaId: input.attachment.followPersonaId ?? null,
      }),
    ];
    return drivers;
  }

  private buildDeltas(
    previousVector: Partial<ChatEmotionVector> | undefined,
    nextVector: Partial<ChatEmotionVector>,
    authority: ChatAuthority,
    evaluatedAt: UnixMs,
  ): readonly ChatEmotionDelta[] {
    if (!previousVector) return [];
    const deltas: ChatEmotionDelta[] = [];
    for (const axis of Object.keys(nextVector) as (keyof ChatEmotionVector)[]) {
      const nextValue = Number(nextVector[axis] ?? 0);
      const prevValue = Number(previousVector[axis] ?? 0);
      if (Math.abs(nextValue - prevValue) < 0.015) continue;
      const normalizedAxis = normalizeAxis(axis);
      deltas.push(
        Object.freeze({
          deltaId: createChatEmotionDeltaId(),
          axis: normalizedAxis,
          previous01: clampEmotionScalar(prevValue),
          current01: clampEmotionScalar(nextValue),
          change01: clampEmotionScalar(Math.abs(nextValue - prevValue)),
          direction:
            nextValue > prevValue ? 'UP' : nextValue < prevValue ? 'DOWN' : 'FLAT',
          authority,
          observedAtUnixMs: evaluatedAt,
          reason:
            nextValue > prevValue
              ? `${normalizedAxis}_rise`
              : `${normalizedAxis}_fall`,
        }),
      );
    }
    return deltas;
  }

  private buildSnapshotNotes(
    input: EmotionModelInput,
    pressureAffect: PressureAffectResult,
    attachment: AttachmentAssessment,
    vector: Partial<ChatEmotionVector>,
  ): readonly string[] {
    return Object.freeze([
      `room=${input.roomId}`,
      `channel=${input.channel}`,
      `pressureModel=${pressureAffect.model}@${pressureAffect.version}`,
      `attachmentModel=${attachment.model}@${attachment.version}`,
      `vector=${describeEmotionVector(vector as ChatEmotionVector)}`,
      `followPersonaId=${attachment.followPersonaId ?? 'none'}`,
      ...(input.eventTags?.map((value) => `tag=${value}`) ?? []),
    ]);
  }

  private buildMetadata(
    input: EmotionModelInput,
    pressureAffect: PressureAffectResult,
    attachment: AttachmentAssessment,
  ): JsonObject {
    return Object.freeze({
      contracts: Object.freeze({
        emotion: CHAT_EMOTION_CONTRACT_MANIFEST.contractId,
        emotionSignals: EMOTION_SIGNAL_CONTRACT_MANIFEST.contractId,
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
      channel: input.channel,
      publicExposure01: pressureAffect.publicExposure01,
      pressureSeverity01: pressureAffect.pressureSeverity01,
      helperAffinity01: attachment.helperAffinity01,
      followPersonaId: attachment.followPersonaId ?? null,
      eventTags: Object.freeze([...(input.eventTags ?? [])]),
    });
  }

  private driver(
    axis: ChatEmotionDriverEvidence['axis'],
    signedImpact01: Score01,
    evidence: string,
    metadata: JsonObject,
  ): ChatEmotionDriverEvidence {
    const kindMap: Partial<Record<ChatEmotionDriverEvidence['axis'], ChatEmotionDriverEvidence['kind']>> = {
      CURIOSITY: 'SCENE_CONTEXT',
      SOCIAL_EMBARRASSMENT: 'CROWD_HEAT',
      DOMINANCE: 'COMEBACK_WINDOW',
      TRUST: 'HELPER_TRUST',
    };
    return Object.freeze({
      driverId: createChatEmotionDriverId(),
      kind: kindMap[axis] ?? 'SCENE_CONTEXT',
      axis,
      sourceAuthority: this.authority,
      source: 'SYSTEM_INFERENCE',
      weight01: clampEmotionScalar(signedImpact01),
      signedImpact01,
      evidence,
      observedAtUnixMs: this.now(),
      metadata,
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

function safe01(value: Score01 | number | undefined | null): Score01 {
  return clampEmotionScalar(Number(value ?? 0));
}

function average(values: readonly (number | undefined)[], fallback = 0): Score01 {
  const filtered = values.filter((value): value is number => Number.isFinite(value as number));
  if (!filtered.length) return clampEmotionScalar(fallback);
  return clampEmotionScalar(filtered.reduce((sum, value) => sum + value, 0) / filtered.length);
}

function invert01(value: Score01 | number | undefined): Score01 {
  return clampEmotionScalar(1 - Number(value ?? 0));
}

function normalizeRescue(value: ChatRescueDecision | undefined): Score01 {
  if (!value?.triggered) return clampEmotionScalar(0);
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
  if (channel === 'DEAL_ROOM') return clampEmotionScalar(dealRoomPredationBias);
  return clampEmotionScalar(0);
}

function inferCuriosity(
  feature: ChatFeatureSnapshot | undefined,
  profile: ChatLearningProfile | undefined,
  inference: ChatInferenceSnapshot | undefined,
): Score01 {
  return clampEmotionScalar(
    safe01(profile?.affect.curiosity01) * 0.32 +
      normalizeCount(feature?.inboundNpcCountWindow, 0.14) * 0.22 +
      safe01(inference?.engagement01) * 0.16 +
      invert01(feature?.churnRisk01) * 0.1,
  );
}

function inferEmbarrassment(
  channel: ChatVisibleChannel,
  pressureAffect: PressureAffectResult,
  attachment: AttachmentAssessment,
  profile: ChatLearningProfile | undefined,
): Score01 {
  const stageBias = channel === 'GLOBAL' ? 0.16 : channel === 'DEAL_ROOM' ? 0.09 : 0.04;
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
  return clampEmotionScalar(
    safe01(inference?.engagement01) * 0.22 +
      safe01(inference?.helperTiming01) * 0.08 +
      invert01(feature?.hostileMomentum01) * 0.17 +
      invert01(feature?.churnRisk01) * 0.12,
  );
}

function inferSilenceFriction(decision: ChatSilenceDecision | undefined): Score01 {
  return clampEmotionScalar(decision?.active ? 0.28 : 0);
}

function normalizeCount(value: number | undefined, weight = 0.12): Score01 {
  return clampEmotionScalar(Math.min(1, Number(value ?? 0) * weight));
}

function normalizeAxis(key: keyof ChatEmotionVector): ChatEmotionDelta['axis'] {
  const map: Record<keyof ChatEmotionVector, ChatEmotionDelta['axis']> = {
    confidence01: 'CONFIDENCE',
    intimidation01: 'INTIMIDATION',
    frustration01: 'FRUSTRATION',
    curiosity01: 'CURIOSITY',
    attachment01: 'ATTACHMENT',
    socialEmbarrassment01: 'SOCIAL_EMBARRASSMENT',
    relief01: 'RELIEF',
    dominance01: 'DOMINANCE',
    desperation01: 'DESPERATION',
    trust01: 'TRUST',
  };
  return map[key];
}
