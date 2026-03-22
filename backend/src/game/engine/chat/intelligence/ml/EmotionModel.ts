/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT EMOTION MODEL
 * FILE: backend/src/game/engine/chat/intelligence/ml/EmotionModel.ts
 * VERSION: 2026.03.22-backend-emotion-model.v4
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
  ChatEmotionAxisTrend,
  ChatEmotionContextFrame,
  ChatEmotionDelta,
  ChatEmotionDriverEvidence,
  ChatEmotionDriverKind,
  ChatEmotionEnvelope,
  ChatEmotionOperatingState,
  ChatEmotionSnapshot,
  ChatEmotionSourceKind,
  ChatEmotionSummary,
  ChatEmotionVector,
} from '../../../../../../../shared/contracts/chat/ChatEmotion';

import type { ChatAuthority } from '../../../../../../../shared/contracts/chat/ChatEvents';

import {
  CHAT_EMOTION_CONTRACT_MANIFEST,
  buildEmotionAxisTrend,
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
  getEmotionAxisValue,
  getSecondaryEmotionAxis,
  listEmotionAxisEntries,
  normalizeEmotionVector,
  projectEmotionToAudienceMood,
  projectEmotionToAudienceSeverity,
  summarizeEmotionSnapshot,
} from '../../../../../../../shared/contracts/chat/ChatEmotion';

import type {
  EmotionFeatureBag,
  EmotionMemoryAnchorSignal,
  EmotionRankingHint,
  EmotionSequenceSignal,
  EmotionSignalContext,
  EmotionSignalPreview,
  EmotionSignalReceipt,
  EmotionSignalSubjectRef,
  EmotionTrainingLabel,
} from '../../../../../../../shared/contracts/chat/learning/EmotionSignals';

import {
  EMOTION_SIGNAL_CONTRACT_MANIFEST,
  buildAllEmotionSignals,
  buildEmotionMemoryAnchorSignal,
  buildEmotionSequenceSignal,
  createEmotionSignalContext,
  createEmotionSignalSubjectRef,
  inferEmotionSignalSubject,
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
  '2026.03.22-backend-emotion-model.v4' as const;

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
  sequenceRecoveryBlend: 0.35,
  escalationAlertThreshold: 0.62,
  anomalyDeltaThreshold: 0.24,
  lobbySilenceClamp: 0.12,
  modeCrowdTheaterBoost: 0.08,
  trustRepairFloor: 0.06,
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
  readonly focalNpcId?: ChatEmotionContextFrame['focalNpcId'];
  readonly modeScope?: ChatEmotionContextFrame['modeScope'];
  readonly mountTarget?: ChatEmotionContextFrame['mountTarget'];
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

export interface EmotionAxisDiagnostic {
  readonly axis: ChatEmotionAxis;
  readonly value: Score01;
  readonly value100: number;
  readonly previousValue?: Score01;
  readonly delta01: number;
  readonly momentum01: Score01;
  readonly volatility01: Score01;
  readonly direction: ChatEmotionAxisTrend['direction'];
  readonly confidenceBand: ReturnType<typeof computeEmotionConfidenceBand>;
  readonly driverLabels: readonly string[];
  readonly sourceKinds: readonly ChatEmotionSourceKind[];
  readonly narrative: string;
}

export interface EmotionTrajectoryAssessment {
  readonly sequence: EmotionSequenceSignal;
  readonly netShift01: Score01;
  readonly volatility01: Score01;
  readonly stability01: Score01;
  readonly recoveryVector01: Score01;
  readonly escalationVector01: Score01;
  readonly coherence01: Score01;
  readonly anomalyFlags: readonly string[];
  readonly notes: readonly string[];
}

export interface EmotionResponseEnvelope {
  readonly primaryPolicy:
    | 'RECOVERY'
    | 'ESCALATION'
    | 'SILENCE'
    | 'CEREMONY'
    | 'STABILIZE';
  readonly allowHelper: boolean;
  readonly allowHater: boolean;
  readonly preferSilence: boolean;
  readonly allowComeback: boolean;
  readonly allowCelebration: boolean;
  readonly reason: string;
  readonly tags: readonly string[];
}

export interface EmotionOperatorPayload {
  readonly traceId: ChatEmotionSnapshot['traceId'];
  readonly roomId: ChatRoomId;
  readonly channel: ChatVisibleChannel;
  readonly modeScope?: ChatEmotionContextFrame['modeScope'];
  readonly mountTarget?: ChatEmotionContextFrame['mountTarget'];
  readonly dominantAxis: ChatEmotionAxis;
  readonly secondaryAxis?: ChatEmotionAxis;
  readonly operatingState: ChatEmotionOperatingState;
  readonly subject: EmotionSignalSubjectRef;
  readonly response: EmotionResponseEnvelope;
  readonly topDrivers: readonly string[];
  readonly topRisks: readonly string[];
  readonly axisDiagnostics: readonly EmotionAxisDiagnostic[];
  readonly notes: readonly string[];
}

export interface EmotionModelDiagnosticReport {
  readonly generatedAt: string;
  readonly model: typeof CHAT_EMOTION_MODEL_MODULE_NAME;
  readonly version: typeof CHAT_EMOTION_MODEL_VERSION;
  readonly subject: EmotionSignalSubjectRef;
  readonly context: EmotionSignalContext;
  readonly anchor: EmotionMemoryAnchorSignal;
  readonly trajectory: EmotionTrajectoryAssessment;
  readonly operatorPayload: EmotionOperatorPayload;
  readonly narrative: readonly string[];
  readonly noteDigest: readonly string[];
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
  readonly anchor: EmotionMemoryAnchorSignal;
  readonly rankingHint: EmotionRankingHint;
  readonly preview: EmotionSignalPreview;
  readonly receipt: EmotionSignalReceipt;
  readonly subject: EmotionSignalSubjectRef;
  readonly signalContext: EmotionSignalContext;
  readonly sequence: EmotionSequenceSignal;
  readonly trajectory: EmotionTrajectoryAssessment;
  readonly response: EmotionResponseEnvelope;
  readonly operatorPayload: EmotionOperatorPayload;
  readonly diagnostic: EmotionModelDiagnosticReport;
  readonly recommendation: EmotionModelRecommendation;
  readonly notes: readonly string[];
}

export interface EmotionBatchInput {
  readonly inputs: readonly EmotionModelInput[];
  readonly sequenceWindowKind?: 'INSTANT' | 'SHORT' | 'MEDIUM' | 'LONG';
}

export interface EmotionBatchAggregate {
  readonly dominantAxis: ChatEmotionAxis;
  readonly secondaryAxis?: ChatEmotionAxis;
  readonly meanVector: ChatEmotionVector;
  readonly maxVector: ChatEmotionVector;
  readonly minVector: ChatEmotionVector;
  readonly riskFlags: readonly string[];
}

export interface EmotionBatchResult {
  readonly results: readonly EmotionModelResult[];
  readonly sequence: EmotionSequenceSignal;
  readonly aggregate: EmotionBatchAggregate;
  readonly diagnostics: readonly EmotionModelDiagnosticReport[];
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
  buildOperatorPayload(result: EmotionModelResult): EmotionOperatorPayload;
  buildDiagnosticReport(result: EmotionModelResult): EmotionModelDiagnosticReport;
  evaluateBatch(input: EmotionBatchInput): EmotionBatchResult;
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
    this.authority = (options.authority ?? 'BACKEND_AUTHORITATIVE') as ChatAuthority;
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
    const subject = createEmotionSignalSubjectRef(
      createEmotionSubjectRefFromInput(input, snapshot),
    );
    const signalContext = createEmotionSignalContext(snapshot);
    const anchor = signalPack.anchor ?? buildEmotionMemoryAnchorSignal(snapshot, subject);
    const sequence = buildEmotionSequenceSignal(
      input.previousSnapshot ? [input.previousSnapshot, snapshot] : [snapshot],
      {
        subject,
        windowKind: deriveEmotionSequenceWindowKind(input.previousSnapshot, snapshot),
      },
    );

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

    const response = buildEmotionResponseEnvelope({
      snapshot,
      recommendation,
      pressureAffect,
      attachment,
      defaults: this.defaults,
    });

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
      `sequenceWindow=${sequence.windowKind}`,
      `response=${response.primaryPolicy}`,
      ...anchor.anchorTags.map((item) => `anchorTag=${item}`),
      ...buildEmotionDebugNotes(snapshot),
      ...pressureAffect.notes,
      ...attachment.notes,
    ]);

    const trajectory = buildEmotionTrajectoryAssessment({
      snapshot,
      sequence,
      defaults: this.defaults,
    });

    const operatorPayload = buildEmotionOperatorPayloadFromState({
      input,
      snapshot,
      subject,
      response,
      trajectory,
      drivers,
      notes,
    });

    const diagnostic = buildEmotionDiagnosticReportFromState({
      snapshot,
      subject,
      signalContext,
      anchor,
      trajectory,
      operatorPayload,
      pressureAffect,
      attachment,
      response,
      recommendation,
      notes,
    });

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
      anchor,
      rankingHint: signalPack.rankingHint,
      preview: signalPack.preview,
      receipt: signalPack.receipt,
      subject,
      signalContext,
      sequence,
      trajectory,
      response,
      operatorPayload,
      diagnostic,
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
      `policy=${result.response.primaryPolicy}`,
      `trajectoryVolatility=${emotionScore01To100(result.trajectory.volatility01)}`,
      `trajectoryStability=${emotionScore01To100(result.trajectory.stability01)}`,
      `anchor=${result.anchor.retrievalHeadline}`,
      `summary=${result.summary.narrative}`,
    ]);
  }

  public buildOperatorPayload(
    result: EmotionModelResult,
  ): EmotionOperatorPayload {
    return result.operatorPayload;
  }

  public buildDiagnosticReport(
    result: EmotionModelResult,
  ): EmotionModelDiagnosticReport {
    return result.diagnostic;
  }

  public evaluateBatch(
    input: EmotionBatchInput,
  ): EmotionBatchResult {
    return buildEmotionBatchResult(input, this);
  }

  private createContext(
    input: EmotionModelInput,
    pressureAffect: PressureAffectResult,
    vector: ChatEmotionVector,
    evaluatedAt: UnixMs,
  ): ChatEmotionContextFrame {
    const modeScope =
      input.modeScope ?? deriveEmotionContextModeScope(input.channel, input.eventTags);
    const mountTarget =
      input.mountTarget ?? deriveEmotionContextMountTarget(input.channel, modeScope);

    return {
      roomId: input.roomId as unknown as ChatEmotionContextFrame['roomId'],
      channelId: input.channel as unknown as ChatEmotionContextFrame['channelId'],
      modeScope,
      mountTarget,
      sourceAuthority: (input.authority ?? this.authority) as ChatEmotionContextFrame['sourceAuthority'],
      playerUserId:
        input.userId as unknown as ChatEmotionContextFrame['playerUserId'],
      focalNpcId:
        input.focalNpcId as unknown as ChatEmotionContextFrame['focalNpcId'],
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
        stageMood: deriveEmotionStageMood(input.channel, modeScope),
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
      ...buildEmotionSynthesisDrivers({
        model: this,
        input: input.input,
        pressureAffect: input.pressureAffect,
        attachment: input.attachment,
        vector: input.vector,
      }),
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

  public driver(input: EmotionDriverInput): ChatEmotionDriverEvidence {
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

/* ========================================================================== *
 * MARK: Extended diagnostics, sequence, and operator helpers
 * ========================================================================== */

const EMOTION_CHANNEL_STAGE_MOODS = Object.freeze({
  GLOBAL: 'HOSTILE',
  SYNDICATE: 'CEREMONIAL',
  DEAL_ROOM: 'PREDATORY',
  LOBBY: 'CALM',
} as const satisfies Record<ChatVisibleChannel, string>);

const EMOTION_CHANNEL_DEFAULT_MODE_SCOPE = Object.freeze({
  GLOBAL: 'RUN',
  SYNDICATE: 'SYNDICATE',
  DEAL_ROOM: 'PREDATOR',
  LOBBY: 'LOBBY',
} as const satisfies Record<ChatVisibleChannel, NonNullable<ChatEmotionContextFrame['modeScope']>>);

const EMOTION_MODE_DEFAULT_MOUNT_TARGET = Object.freeze({
  LOBBY: 'LOBBY_SCREEN',
  RUN: 'GAME_BOARD',
  BATTLE: 'BATTLE_HUD',
  EMPIRE: 'EMPIRE_GAME_SCREEN',
  CLUB: 'CLUB_UI',
  LEAGUE: 'LEAGUE_UI',
  SYNDICATE: 'SYNDICATE_GAME_SCREEN',
  PREDATOR: 'PREDATOR_GAME_SCREEN',
  PHANTOM: 'PHANTOM_GAME_SCREEN',
  POST_RUN: 'POST_RUN_SUMMARY',
} as const satisfies Record<
  NonNullable<ChatEmotionContextFrame['modeScope']>,
  NonNullable<ChatEmotionContextFrame['mountTarget']>
>);

const EMOTION_AXIS_REASON_LIBRARY = Object.freeze({
  CONFIDENCE: Object.freeze([
    'confidence held despite pressure',
    'confidence repaired under scrutiny',
    'confidence drifted lower than safe baseline',
    'confidence rose because helper timing landed cleanly',
    'confidence was preserved by reduced embarrassment exposure',
  ]),
  INTIMIDATION: Object.freeze([
    'room pressure created intimidation drag',
    'deal-room posture amplified intimidation',
    'witness density made intimidation more public',
    'predatory quiet reinforced intimidation',
    'intimidation remained bounded by trust continuity',
  ]),
  FRUSTRATION: Object.freeze([
    'pressure accumulation raised frustration',
    'silence friction extended frustration',
    'engagement uncertainty converted into frustration',
    'frustration eased as relief increased',
    'frustration stayed volatile across the current window',
  ]),
  CURIOSITY: Object.freeze([
    'scene movement sustained curiosity',
    'novelty signals reopened curiosity',
    'room heat made curiosity socially legible',
    'curiosity dipped as certainty hardened',
    'memory callback potential elevated curiosity',
  ]),
  ATTACHMENT: Object.freeze([
    'continuity and familiarity reinforced attachment',
    'helper affinity sustained attachment carryover',
    'rivalry contamination coexisted with attachment',
    'attachment softened due to low continuity evidence',
    'attachment remained durable across room transitions',
  ]),
  SOCIAL_EMBARRASSMENT: Object.freeze([
    'public exposure elevated embarrassment',
    'crowd threat pushed embarrassment higher',
    'rivalry contamination sharpened embarrassment',
    'reduced witness density lowered embarrassment pressure',
    'embarrassment remained the crowd-facing risk axis',
  ]),
  RELIEF: Object.freeze([
    'relief rose through rescue or stabilization',
    'trust continuity supported relief recovery',
    'relief lagged behind pressure repair',
    'relief stayed modest because risk remained active',
    'relief provided emotional floor repair',
  ]),
  DOMINANCE: Object.freeze([
    'dominance rose as embarrassment fell',
    'comeback posture strengthened dominance',
    'control cues reinforced dominance',
    'dominance was capped by ongoing risk',
    'dominance remained narratively available but not free',
  ]),
  DESPERATION: Object.freeze([
    'rescue urgency elevated desperation',
    'churn risk reinforced desperation',
    'desperation fell as relief recovered',
    'desperation stayed active under public threat',
    'desperation signaled spiral danger',
  ]),
  TRUST: Object.freeze([
    'attachment continuity repaired trust',
    'helper receptivity lifted trust',
    'rivalry contamination taxed trust',
    'trust recovered slower than relief',
    'trust supported helper-safe intervention windows',
  ]),
} as const satisfies Record<ChatEmotionAxis, readonly string[]>);

const EMOTION_POLICY_REASON_LIBRARY = Object.freeze({
  RECOVERY: Object.freeze([
    'Helper leverage currently exceeds hostile leverage.',
    'Stabilization is safer than escalation.',
    'Recovery preserves continuity while risk is still active.',
  ]),
  ESCALATION: Object.freeze([
    'Hostile escalation has the strongest authored leverage.',
    'Predatory pressure best matches the current room state.',
    'The current state can support a sharper pressure turn.',
  ]),
  SILENCE: Object.freeze([
    'Silence holds the scene better than immediate speech.',
    'A quiet beat retains the weight of the moment.',
    'The system should preserve authored pressure through restraint.',
  ]),
  CEREMONY: Object.freeze([
    'Witness and comeback energy justify ceremonial response.',
    'The room can now validate the swing publicly.',
    'Celebratory witness is emotionally safe enough to surface.',
  ]),
  STABILIZE: Object.freeze([
    'Mixed affect calls for controlled stabilization.',
    'Neither escalation nor silence fully dominates this state.',
    'The room needs balance more than raw momentum.',
  ]),
} as const);

interface EmotionSynthesisDriverInput {
  readonly model: EmotionModel;
  readonly input: EmotionModelInput;
  readonly pressureAffect: PressureAffectResult;
  readonly attachment: AttachmentAssessment;
  readonly vector: ChatEmotionVector;
}

interface EmotionTrajectoryAssessmentInput {
  readonly snapshot: ChatEmotionSnapshot;
  readonly sequence: EmotionSequenceSignal;
  readonly defaults: typeof CHAT_EMOTION_MODEL_DEFAULTS;
}

interface EmotionResponseEnvelopeInput {
  readonly snapshot: ChatEmotionSnapshot;
  readonly recommendation: EmotionModelRecommendation;
  readonly pressureAffect: PressureAffectResult;
  readonly attachment: AttachmentAssessment;
  readonly defaults: typeof CHAT_EMOTION_MODEL_DEFAULTS;
}

interface EmotionOperatorPayloadInput {
  readonly input: EmotionModelInput;
  readonly snapshot: ChatEmotionSnapshot;
  readonly subject: EmotionSignalSubjectRef;
  readonly response: EmotionResponseEnvelope;
  readonly trajectory: EmotionTrajectoryAssessment;
  readonly drivers: readonly ChatEmotionDriverEvidence[];
  readonly notes: readonly string[];
}

interface EmotionDiagnosticReportInput {
  readonly snapshot: ChatEmotionSnapshot;
  readonly subject: EmotionSignalSubjectRef;
  readonly signalContext: EmotionSignalContext;
  readonly anchor: EmotionMemoryAnchorSignal;
  readonly trajectory: EmotionTrajectoryAssessment;
  readonly operatorPayload: EmotionOperatorPayload;
  readonly pressureAffect: PressureAffectResult;
  readonly attachment: AttachmentAssessment;
  readonly response: EmotionResponseEnvelope;
  readonly recommendation: EmotionModelRecommendation;
  readonly notes: readonly string[];
}

function deriveEmotionContextModeScope(
  channel: ChatVisibleChannel,
  eventTags?: readonly string[],
): NonNullable<ChatEmotionContextFrame['modeScope']> {
  const tags = new Set((eventTags ?? []).map((item) => item.toUpperCase()));
  if (tags.has('BATTLE')) {
    return 'BATTLE';
  }
  if (tags.has('EMPIRE')) {
    return 'EMPIRE';
  }
  if (tags.has('PHANTOM')) {
    return 'PHANTOM';
  }
  if (tags.has('POST_RUN')) {
    return 'POST_RUN';
  }
  return EMOTION_CHANNEL_DEFAULT_MODE_SCOPE[channel];
}

function deriveEmotionContextMountTarget(
  channel: ChatVisibleChannel,
  modeScope: NonNullable<ChatEmotionContextFrame['modeScope']>,
): NonNullable<ChatEmotionContextFrame['mountTarget']> {
  if (channel === 'DEAL_ROOM') {
    return 'PREDATOR_GAME_SCREEN';
  }
  if (channel === 'SYNDICATE') {
    return 'SYNDICATE_GAME_SCREEN';
  }
  if (channel === 'LOBBY') {
    return 'LOBBY_SCREEN';
  }
  return EMOTION_MODE_DEFAULT_MOUNT_TARGET[modeScope];
}

function deriveEmotionStageMood(
  channel: ChatVisibleChannel,
  modeScope: NonNullable<ChatEmotionContextFrame['modeScope']>,
): string {
  if (modeScope === 'BATTLE') {
    return 'HOSTILE';
  }
  if (modeScope === 'PHANTOM') {
    return 'MOURNFUL';
  }
  return EMOTION_CHANNEL_STAGE_MOODS[channel];
}

function deriveEmotionSequenceWindowKind(
  previousSnapshot: ChatEmotionSnapshot | undefined,
  snapshot: ChatEmotionSnapshot,
): 'INSTANT' | 'SHORT' | 'MEDIUM' | 'LONG' {
  if (!previousSnapshot) {
    return 'INSTANT';
  }
  const age = Math.abs(snapshot.observedAtUnixMs - previousSnapshot.observedAtUnixMs);
  if (age <= 15_000) {
    return 'SHORT';
  }
  if (age <= 120_000) {
    return 'MEDIUM';
  }
  return 'LONG';
}

function createEmotionSubjectRefFromInput(
  input: EmotionModelInput,
  snapshot: ChatEmotionSnapshot,
): EmotionSignalSubjectRef {
  if (input.focalNpcId) {
    return {
      subjectKind: 'NPC',
      npcId: input.focalNpcId as EmotionSignalSubjectRef['npcId'],
      playerUserId: input.userId as EmotionSignalSubjectRef['playerUserId'],
      roomId: input.roomId as EmotionSignalSubjectRef['roomId'],
      channelId: input.channel as EmotionSignalSubjectRef['channelId'],
      sceneId: input.sceneId as EmotionSignalSubjectRef['sceneId'],
      sessionId: input.sessionId as EmotionSignalSubjectRef['sessionId'],
      label: input.focalNpcId,
    };
  }
  return inferEmotionSignalSubject(snapshot);
}

function buildEmotionSynthesisDrivers(
  input: EmotionSynthesisDriverInput,
): readonly ChatEmotionDriverEvidence[] {
  const synthetic: ChatEmotionDriverEvidence[] = [];
  const pairs: readonly [
    ChatEmotionAxis,
    ChatEmotionDriverKind,
    ChatEmotionSourceKind,
    Score01,
    string,
    string,
    JsonObject,
  ][] = [
    [
      'CONFIDENCE',
      'COMEBACK_WINDOW',
      'SYSTEM',
      safe01(input.vector.confidence),
      'Confidence repair composite',
      'Pressure repair, helper timing, and reduced spiral risk supported backend confidence.',
      Object.freeze({
        confidenceRepair01: input.pressureAffect.breakdown.confidenceRepair01,
        engagement01: input.input.inferenceSnapshot?.engagement01 ?? null,
      }),
    ],
    [
      'INTIMIDATION',
      'PRESSURE_SPIKE',
      'MOMENT',
      safe01(input.vector.intimidation),
      'Intimidation pressure composite',
      'Pressure severity, channel posture, and rivalry contamination amplified intimidation.',
      Object.freeze({
        pressureSeverity01: input.pressureAffect.pressureSeverity01,
        channel: input.input.channel,
        rivalryContamination01: input.attachment.rivalryContamination01,
      }),
    ],
    [
      'FRUSTRATION',
      'PRESSURE_SPIKE',
      'MOMENT',
      safe01(input.vector.frustration),
      'Frustration carryover composite',
      'Ongoing pressure and silence friction sustained frustration.',
      Object.freeze({
        frustration01: input.pressureAffect.breakdown.frustration01,
        silenceActive: input.input.silenceDecision?.active ?? false,
      }),
    ],
    [
      'ATTACHMENT',
      'MEMORY_CALLBACK',
      'LEARNING',
      safe01(input.vector.attachment),
      'Attachment continuity composite',
      'Backend continuity, helper affinity, and persona following reinforced attachment.',
      Object.freeze({
        attachment01: input.attachment.attachment01,
        helperAffinity01: input.attachment.helperAffinity01,
        followPersonaId: input.attachment.followPersonaId ?? null,
      }),
    ],
    [
      'RELIEF',
      'RESCUE_INTERVENTION',
      'RESCUE',
      safe01(input.vector.relief),
      'Relief recovery composite',
      'Rescue logic and trust continuity lifted relief without erasing the scene.',
      Object.freeze({
        relief01: input.pressureAffect.breakdown.relief01,
        trust01: input.attachment.trust01,
      }),
    ],
    [
      'DESPERATION',
      'BANKRUPTCY_THREAT',
      'RESCUE',
      safe01(input.vector.desperation),
      'Desperation spiral composite',
      'Desperation reflects rescue urgency, churn exposure, and unresolved pressure.',
      Object.freeze({
        desperation01: input.pressureAffect.breakdown.desperation01,
        rescueTriggered: input.input.rescueDecision?.triggered ?? false,
      }),
    ],
  ];

  for (const [axis, driver, sourceKind, signedImpact01, label, evidence, metadata] of pairs) {
    synthetic.push(
      input.model.driver({
        axis,
        driver,
        sourceKind,
        signedImpact01,
        label,
        evidence,
        roomId: input.input.roomId,
        channel: input.input.channel,
        sceneId: input.input.sceneId,
        messageId: input.input.messageId,
        metadata,
      }),
    );
  }

  return Object.freeze(synthetic);
}

function buildEmotionAxisDiagnostic(
  snapshot: ChatEmotionSnapshot,
  axis: ChatEmotionAxis,
): EmotionAxisDiagnostic {
  const trend = buildEmotionAxisTrend(axis, snapshot.vector, snapshot.previousVector);
  const driverLabels = snapshot.drivers
    .filter((driver) => driver.metadata?.emotionAxis === axis)
    .map((driver) => driver.label);
  const sourceKinds = snapshot.drivers
    .filter((driver) => driver.metadata?.emotionAxis === axis)
    .map((driver) => driver.sourceKind);
  const reasonSet = EMOTION_AXIS_REASON_LIBRARY[axis];
  const reasonIndex = Math.min(reasonSet.length - 1, Math.max(0, Math.round(trend.momentum * 4)));

  return Object.freeze({
    axis,
    value: trend.current,
    value100: emotionScore01To100(trend.current),
    previousValue: trend.previous,
    delta01: Number(trend.change),
    momentum01: trend.momentum,
    volatility01: trend.volatility,
    direction: trend.direction,
    confidenceBand: computeEmotionConfidenceBand(
      clampEmotionScalar(0.34 + trend.momentum * 0.44 + trend.current * 0.18),
    ),
    driverLabels: Object.freeze(driverLabels),
    sourceKinds: Object.freeze(Array.from(new Set(sourceKinds))),
    narrative: reasonSet[reasonIndex],
  });
}

function buildEmotionAxisDiagnostics(
  snapshot: ChatEmotionSnapshot,
): readonly EmotionAxisDiagnostic[] {
  return Object.freeze(
    listEmotionAxisEntries(snapshot.vector)
      .map((entry) => buildEmotionAxisDiagnostic(snapshot, entry.axis))
      .sort((a, b) => b.value - a.value),
  );
}

function computeEmotionNetShift01(sequence: EmotionSequenceSignal): Score01 {
  if (sequence.snapshots.length < 2) {
    return clampEmotionScalar(0);
  }
  const first = sequence.snapshots[0];
  const last = sequence.snapshots[sequence.snapshots.length - 1];
  const deltas = listEmotionAxisEntries(last.vector).map((entry) =>
    Math.abs(Number(entry.value) - Number(getEmotionAxisValue(first.vector, entry.axis))),
  );
  return clampEmotionScalar(deltas.reduce((sum, item) => sum + item, 0) / deltas.length);
}

function computeEmotionVolatility01(sequence: EmotionSequenceSignal): Score01 {
  if (sequence.snapshots.length < 2) {
    return clampEmotionScalar(0);
  }
  const deltas: number[] = [];
  for (let i = 1; i < sequence.snapshots.length; i += 1) {
    const prev = sequence.snapshots[i - 1].vector;
    const next = sequence.snapshots[i].vector;
    const segment = listEmotionAxisEntries(next).map((entry) =>
      Math.abs(Number(entry.value) - Number(getEmotionAxisValue(prev, entry.axis))),
    );
    deltas.push(segment.reduce((sum, item) => sum + item, 0) / segment.length);
  }
  return clampEmotionScalar(deltas.reduce((sum, item) => sum + item, 0) / deltas.length);
}

function computeEmotionStability01(sequence: EmotionSequenceSignal): Score01 {
  return clampEmotionScalar(1 - Number(computeEmotionVolatility01(sequence)));
}

function computeEmotionRecoveryVector01(snapshot: ChatEmotionSnapshot): Score01 {
  return clampEmotionScalar(
    snapshot.derived.helperUrgency * 0.22 +
      snapshot.derived.rescueNeed * 0.2 +
      snapshot.vector.relief * 0.24 +
      snapshot.vector.trust * 0.18 +
      snapshot.vector.confidence * 0.16,
  );
}

function computeEmotionEscalationVector01(snapshot: ChatEmotionSnapshot): Score01 {
  return clampEmotionScalar(
    snapshot.derived.haterOpportunity * 0.24 +
      snapshot.vector.intimidation * 0.18 +
      snapshot.vector.frustration * 0.16 +
      snapshot.vector.socialEmbarrassment * 0.18 +
      snapshot.vector.dominance * 0.12 +
      snapshot.derived.crowdPileOnRisk * 0.12,
  );
}

function computeEmotionCoherence01(snapshot: ChatEmotionSnapshot): Score01 {
  const normalized = normalizeEmotionVector(snapshot.vector);
  const values = listEmotionAxisEntries(normalized).map((entry) => Number(entry.value));
  const mean = values.reduce((sum, item) => sum + item, 0) / values.length;
  const deviation = values.reduce((sum, item) => sum + Math.abs(item - mean), 0) / values.length;
  return clampEmotionScalar(1 - deviation);
}

function detectEmotionAnomalyFlags(
  snapshot: ChatEmotionSnapshot,
  defaults: typeof CHAT_EMOTION_MODEL_DEFAULTS,
): readonly string[] {
  const flags = new Set<string>();
  if (snapshot.previousVector) {
    for (const entry of listEmotionAxisEntries(snapshot.vector)) {
      const previous = getEmotionAxisValue(snapshot.previousVector, entry.axis);
      const delta = Math.abs(Number(entry.value) - Number(previous));
      if (delta >= defaults.anomalyDeltaThreshold) {
        flags.add(`${entry.axis.toLowerCase()}-delta-spike`);
      }
    }
  }
  if (snapshot.derived.crowdPileOnRisk >= defaults.escalationAlertThreshold) {
    flags.add('crowd-pileon-alert');
  }
  if (snapshot.derived.haterOpportunity >= defaults.escalationAlertThreshold) {
    flags.add('hater-escalation-alert');
  }
  if (snapshot.derived.silenceSuitability >= defaults.silencePreferenceThreshold) {
    flags.add('silence-dominant');
  }
  if (snapshot.derived.riskOfSpiral >= 0.64) {
    flags.add('spiral-risk');
  }
  return Object.freeze([...flags]);
}

function buildEmotionTrajectoryAssessment(
  input: EmotionTrajectoryAssessmentInput,
): EmotionTrajectoryAssessment {
  const netShift01 = computeEmotionNetShift01(input.sequence);
  const volatility01 = computeEmotionVolatility01(input.sequence);
  const stability01 = computeEmotionStability01(input.sequence);
  const recoveryVector01 = clampEmotionScalar(
    computeEmotionRecoveryVector01(input.snapshot) * input.defaults.sequenceRecoveryBlend +
      stability01 * (1 - input.defaults.sequenceRecoveryBlend),
  );
  const escalationVector01 = computeEmotionEscalationVector01(input.snapshot);
  const coherence01 = computeEmotionCoherence01(input.snapshot);
  const anomalyFlags = detectEmotionAnomalyFlags(input.snapshot, input.defaults);
  const notes = Object.freeze([
    `window=${input.sequence.windowKind}`,
    `netShift=${emotionScore01To100(netShift01)}`,
    `volatility=${emotionScore01To100(volatility01)}`,
    `stability=${emotionScore01To100(stability01)}`,
    `recovery=${emotionScore01To100(recoveryVector01)}`,
    `escalation=${emotionScore01To100(escalationVector01)}`,
    `coherence=${emotionScore01To100(coherence01)}`,
    ...anomalyFlags.map((item) => `flag=${item}`),
  ]);

  return Object.freeze({
    sequence: input.sequence,
    netShift01,
    volatility01,
    stability01,
    recoveryVector01,
    escalationVector01,
    coherence01,
    anomalyFlags,
    notes,
  });
}

function buildEmotionResponseEnvelope(
  input: EmotionResponseEnvelopeInput,
): EmotionResponseEnvelope {
  const { snapshot, recommendation, pressureAffect, attachment } = input;
  let primaryPolicy: EmotionResponseEnvelope['primaryPolicy'] = 'STABILIZE';
  if (recommendation.shouldEscalateHelper && snapshot.derived.helperUrgency >= snapshot.derived.haterOpportunity) {
    primaryPolicy = 'RECOVERY';
  } else if (recommendation.shouldEscalateHater) {
    primaryPolicy = 'ESCALATION';
  } else if (snapshot.derived.silenceSuitability >= input.defaults.silencePreferenceThreshold) {
    primaryPolicy = 'SILENCE';
  } else if (recommendation.shouldFireComebackSpeech || !recommendation.shouldHoldCelebration) {
    primaryPolicy = 'CEREMONY';
  }

  const reasonLibrary = EMOTION_POLICY_REASON_LIBRARY[primaryPolicy];
  const reasonIndex = Math.min(
    reasonLibrary.length - 1,
    Math.max(0, Math.round(snapshot.derived.crowdPileOnRisk * (reasonLibrary.length - 1))),
  );

  const tags = new Set<string>([
    `state:${snapshot.derived.operatingState.toLowerCase()}`,
    `dominant:${snapshot.derived.dominantAxis.toLowerCase()}`,
    `channel:${snapshot.context.channelId.toLowerCase()}`,
  ]);

  if (pressureAffect.recommendation.policyFlags.shouldPrimeComebackSpeech) {
    tags.add('comeback-primed');
  }
  if (attachment.followPersonaId) {
    tags.add(`follow:${attachment.followPersonaId.toLowerCase()}`);
  }
  if (snapshot.derived.crowdPileOnRisk >= input.defaults.crowdSwarmThreshold) {
    tags.add('crowd-risk');
  }
  if (snapshot.context.channelId === 'LOBBY' && snapshot.derived.silenceSuitability >= input.defaults.lobbySilenceClamp) {
    tags.add('lobby-restraint');
  }

  return Object.freeze({
    primaryPolicy,
    allowHelper: recommendation.shouldEscalateHelper,
    allowHater: recommendation.shouldEscalateHater,
    preferSilence: recommendation.silenceDirective.preferSilence,
    allowComeback: recommendation.shouldFireComebackSpeech,
    allowCelebration: !recommendation.shouldHoldCelebration,
    reason: reasonLibrary[reasonIndex],
    tags: Object.freeze([...tags]),
  });
}

function deriveEmotionTopDrivers(
  drivers: readonly ChatEmotionDriverEvidence[],
): readonly string[] {
  return Object.freeze(
    [...drivers]
      .sort((a, b) => b.salience - a.salience)
      .slice(0, 8)
      .map((item) => `${item.driver}:${item.label}`),
  );
}

function deriveEmotionTopRisks(
  snapshot: ChatEmotionSnapshot,
  trajectory: EmotionTrajectoryAssessment,
  response: EmotionResponseEnvelope,
): readonly string[] {
  const risks: string[] = [];
  if (snapshot.derived.crowdPileOnRisk >= 0.56) {
    risks.push('crowd-pileon-risk');
  }
  if (snapshot.derived.haterOpportunity >= 0.58) {
    risks.push('hater-opening');
  }
  if (snapshot.derived.riskOfSpiral >= 0.6) {
    risks.push('spiral-risk');
  }
  if (trajectory.volatility01 >= 0.42) {
    risks.push('trajectory-volatility');
  }
  if (response.preferSilence) {
    risks.push('silence-sensitive');
  }
  return Object.freeze(risks);
}

function buildEmotionOperatorPayloadFromState(
  input: EmotionOperatorPayloadInput,
): EmotionOperatorPayload {
  const axisDiagnostics = buildEmotionAxisDiagnostics(input.snapshot);
  const topDrivers = deriveEmotionTopDrivers(input.drivers);
  const topRisks = deriveEmotionTopRisks(input.snapshot, input.trajectory, input.response);

  return Object.freeze({
    traceId: input.snapshot.traceId,
    roomId: input.input.roomId,
    channel: input.input.channel,
    modeScope: input.snapshot.context.modeScope,
    mountTarget: input.snapshot.context.mountTarget,
    dominantAxis: input.snapshot.derived.dominantAxis,
    secondaryAxis: input.snapshot.derived.secondaryAxis,
    operatingState: input.snapshot.derived.operatingState,
    subject: input.subject,
    response: input.response,
    topDrivers,
    topRisks,
    axisDiagnostics,
    notes: Object.freeze([
      ...input.notes.slice(0, 24),
      `response=${input.response.primaryPolicy}`,
      `anomalies=${input.trajectory.anomalyFlags.join(',') || 'none'}`,
    ]),
  });
}

function buildEmotionDiagnosticNarrative(
  input: EmotionDiagnosticReportInput,
): readonly string[] {
  const narrative: string[] = [
    `dominant=${input.snapshot.derived.dominantAxis}`,
    input.snapshot.derived.secondaryAxis
      ? `secondary=${input.snapshot.derived.secondaryAxis}`
      : 'secondary=NONE',
    `state=${input.snapshot.derived.operatingState}`,
    `policy=${input.response.primaryPolicy}`,
    `anchor=${input.anchor.retrievalHeadline}`,
    `trajectoryVolatility=${emotionScore01To100(input.trajectory.volatility01)}`,
    `trajectoryStability=${emotionScore01To100(input.trajectory.stability01)}`,
    `pressureSeverity=${emotionScore01To100(input.pressureAffect.pressureSeverity01)}`,
    `attachment=${emotionScore01To100(input.attachment.attachment01)}`,
    `helper=${input.recommendation.shouldEscalateHelper}`,
    `hater=${input.recommendation.shouldEscalateHater}`,
    `silence=${input.recommendation.silenceDirective.preferSilence}`,
  ];

  for (const risk of input.operatorPayload.topRisks) {
    narrative.push(`risk=${risk}`);
  }
  for (const flag of input.trajectory.anomalyFlags) {
    narrative.push(`flag=${flag}`);
  }

  return Object.freeze(narrative);
}

function buildEmotionDiagnosticReportFromState(
  input: EmotionDiagnosticReportInput,
): EmotionModelDiagnosticReport {
  return Object.freeze({
    generatedAt: input.snapshot.updatedAt,
    model: CHAT_EMOTION_MODEL_MODULE_NAME,
    version: CHAT_EMOTION_MODEL_VERSION,
    subject: input.subject,
    context: input.signalContext,
    anchor: input.anchor,
    trajectory: input.trajectory,
    operatorPayload: input.operatorPayload,
    narrative: buildEmotionDiagnosticNarrative(input),
    noteDigest: Object.freeze(input.notes.slice(0, 40)),
  });
}

function blendEmotionVectorsForAggregate(
  vectors: readonly ChatEmotionVector[],
): ChatEmotionVector {
  if (!vectors.length) {
    return normalizeEmotionVector({
      confidence: 0 as Score01,
      intimidation: 0 as Score01,
      frustration: 0 as Score01,
      curiosity: 0 as Score01,
      attachment: 0 as Score01,
      socialEmbarrassment: 0 as Score01,
      relief: 0 as Score01,
      dominance: 0 as Score01,
      desperation: 0 as Score01,
      trust: 0 as Score01,
    });
  }

  const totals = {
    confidence: 0,
    intimidation: 0,
    frustration: 0,
    curiosity: 0,
    attachment: 0,
    socialEmbarrassment: 0,
    relief: 0,
    dominance: 0,
    desperation: 0,
    trust: 0,
  };

  for (const vector of vectors) {
    totals.confidence += Number(vector.confidence);
    totals.intimidation += Number(vector.intimidation);
    totals.frustration += Number(vector.frustration);
    totals.curiosity += Number(vector.curiosity);
    totals.attachment += Number(vector.attachment);
    totals.socialEmbarrassment += Number(vector.socialEmbarrassment);
    totals.relief += Number(vector.relief);
    totals.dominance += Number(vector.dominance);
    totals.desperation += Number(vector.desperation);
    totals.trust += Number(vector.trust);
  }

  const count = vectors.length;
  return normalizeEmotionVector({
    confidence: clampEmotionScalar(totals.confidence / count),
    intimidation: clampEmotionScalar(totals.intimidation / count),
    frustration: clampEmotionScalar(totals.frustration / count),
    curiosity: clampEmotionScalar(totals.curiosity / count),
    attachment: clampEmotionScalar(totals.attachment / count),
    socialEmbarrassment: clampEmotionScalar(totals.socialEmbarrassment / count),
    relief: clampEmotionScalar(totals.relief / count),
    dominance: clampEmotionScalar(totals.dominance / count),
    desperation: clampEmotionScalar(totals.desperation / count),
    trust: clampEmotionScalar(totals.trust / count),
  });
}

function computeEmotionAggregateExtreme(
  vectors: readonly ChatEmotionVector[],
  mode: 'max' | 'min',
): ChatEmotionVector {
  const initial = mode === 'max' ? 0 : 1;
  const bucket = {
    confidence: initial,
    intimidation: initial,
    frustration: initial,
    curiosity: initial,
    attachment: initial,
    socialEmbarrassment: initial,
    relief: initial,
    dominance: initial,
    desperation: initial,
    trust: initial,
  };
  for (const vector of vectors) {
    bucket.confidence = mode === 'max' ? Math.max(bucket.confidence, Number(vector.confidence)) : Math.min(bucket.confidence, Number(vector.confidence));
    bucket.intimidation = mode === 'max' ? Math.max(bucket.intimidation, Number(vector.intimidation)) : Math.min(bucket.intimidation, Number(vector.intimidation));
    bucket.frustration = mode === 'max' ? Math.max(bucket.frustration, Number(vector.frustration)) : Math.min(bucket.frustration, Number(vector.frustration));
    bucket.curiosity = mode === 'max' ? Math.max(bucket.curiosity, Number(vector.curiosity)) : Math.min(bucket.curiosity, Number(vector.curiosity));
    bucket.attachment = mode === 'max' ? Math.max(bucket.attachment, Number(vector.attachment)) : Math.min(bucket.attachment, Number(vector.attachment));
    bucket.socialEmbarrassment = mode === 'max' ? Math.max(bucket.socialEmbarrassment, Number(vector.socialEmbarrassment)) : Math.min(bucket.socialEmbarrassment, Number(vector.socialEmbarrassment));
    bucket.relief = mode === 'max' ? Math.max(bucket.relief, Number(vector.relief)) : Math.min(bucket.relief, Number(vector.relief));
    bucket.dominance = mode === 'max' ? Math.max(bucket.dominance, Number(vector.dominance)) : Math.min(bucket.dominance, Number(vector.dominance));
    bucket.desperation = mode === 'max' ? Math.max(bucket.desperation, Number(vector.desperation)) : Math.min(bucket.desperation, Number(vector.desperation));
    bucket.trust = mode === 'max' ? Math.max(bucket.trust, Number(vector.trust)) : Math.min(bucket.trust, Number(vector.trust));
  }
  return normalizeEmotionVector({
    confidence: clampEmotionScalar(bucket.confidence),
    intimidation: clampEmotionScalar(bucket.intimidation),
    frustration: clampEmotionScalar(bucket.frustration),
    curiosity: clampEmotionScalar(bucket.curiosity),
    attachment: clampEmotionScalar(bucket.attachment),
    socialEmbarrassment: clampEmotionScalar(bucket.socialEmbarrassment),
    relief: clampEmotionScalar(bucket.relief),
    dominance: clampEmotionScalar(bucket.dominance),
    desperation: clampEmotionScalar(bucket.desperation),
    trust: clampEmotionScalar(bucket.trust),
  });
}

function buildEmotionBatchAggregate(
  results: readonly EmotionModelResult[],
): EmotionBatchAggregate {
  const vectors = results.map((item) => item.snapshot.vector);
  const meanVector = blendEmotionVectorsForAggregate(vectors);
  const dominantAxis = getDominantEmotionAxis(meanVector);
  const secondaryAxis = getSecondaryEmotionAxis(meanVector);
  const maxVector = computeEmotionAggregateExtreme(vectors, 'max');
  const minVector = computeEmotionAggregateExtreme(vectors, 'min');
  const riskFlags = Object.freeze(
    Array.from(
      new Set(results.flatMap((item) => [...item.trajectory.anomalyFlags, ...item.operatorPayload.topRisks])),
    ),
  );
  return Object.freeze({
    dominantAxis,
    secondaryAxis,
    meanVector,
    maxVector,
    minVector,
    riskFlags,
  });
}

function buildEmotionBatchResult(
  input: EmotionBatchInput,
  model: EmotionModelApi,
): EmotionBatchResult {
  const results = Object.freeze(input.inputs.map((item) => model.evaluate(item)));
  const sequence = buildEmotionSequenceSignal(
    results.map((item) => item.snapshot),
    { windowKind: input.sequenceWindowKind ?? (results.length > 4 ? 'MEDIUM' : 'SHORT') },
  );
  const aggregate = buildEmotionBatchAggregate(results);
  const diagnostics = Object.freeze(results.map((item) => model.buildDiagnosticReport(item)));
  const notes = Object.freeze([
    `count=${results.length}`,
    `window=${sequence.windowKind}`,
    `dominant=${aggregate.dominantAxis}`,
    aggregate.secondaryAxis ? `secondary=${aggregate.secondaryAxis}` : 'secondary=NONE',
    ...aggregate.riskFlags.map((item) => `risk=${item}`),
  ]);
  return Object.freeze({
    results,
    sequence,
    aggregate,
    diagnostics,
    notes,
  });
}

export function buildEmotionOperatorPayload(
  result: EmotionModelResult,
): EmotionOperatorPayload {
  return result.operatorPayload;
}

export function buildEmotionDiagnosticReport(
  result: EmotionModelResult,
): EmotionModelDiagnosticReport {
  return result.diagnostic;
}

export function evaluateEmotionBatch(
  input: EmotionBatchInput,
  options: EmotionModelOptions = {},
): EmotionBatchResult {
  return createEmotionModel(options).evaluateBatch(input);
}

export function summarizeEmotionOperatorView(
  result: EmotionModelResult,
): readonly string[] {
  return Object.freeze([
    `traceId=${result.snapshot.traceId}`,
    `room=${result.operatorPayload.roomId}`,
    `channel=${result.operatorPayload.channel}`,
    `dominant=${result.operatorPayload.dominantAxis}`,
    result.operatorPayload.secondaryAxis
      ? `secondary=${result.operatorPayload.secondaryAxis}`
      : 'secondary=NONE',
    `state=${result.operatorPayload.operatingState}`,
    `policy=${result.response.primaryPolicy}`,
    ...result.operatorPayload.topRisks.map((item) => `risk=${item}`),
    ...result.operatorPayload.topDrivers.slice(0, 5).map((item) => `driver=${item}`),
  ]);
}

export function compareEmotionModelResults(
  previous: EmotionModelResult,
  next: EmotionModelResult,
): readonly string[] {
  const lines: string[] = [];
  for (const entry of listEmotionAxisEntries(next.snapshot.vector)) {
    const previousValue = getEmotionAxisValue(previous.snapshot.vector, entry.axis);
    const delta = Number(entry.value) - Number(previousValue);
    if (Math.abs(delta) < 0.01) {
      continue;
    }
    lines.push(`${entry.axis.toLowerCase()}=${delta >= 0 ? '+' : ''}${delta.toFixed(3)}`);
  }
  lines.push(`policy=${previous.response.primaryPolicy}->${next.response.primaryPolicy}`);
  lines.push(`state=${previous.snapshot.derived.operatingState}->${next.snapshot.derived.operatingState}`);
  return Object.freeze(lines);
}

export function summarizeEmotionBatchResult(
  result: EmotionBatchResult,
): readonly string[] {
  return Object.freeze([
    `count=${result.results.length}`,
    `window=${result.sequence.windowKind}`,
    `dominant=${result.aggregate.dominantAxis}`,
    result.aggregate.secondaryAxis
      ? `secondary=${result.aggregate.secondaryAxis}`
      : 'secondary=NONE',
    `mean=${describeEmotionVector(result.aggregate.meanVector)}`,
    ...result.aggregate.riskFlags.map((item) => `risk=${item}`),
  ]);
}
