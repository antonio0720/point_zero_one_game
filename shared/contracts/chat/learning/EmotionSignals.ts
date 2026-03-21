/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT LEARNING EMOTION SIGNALS
 * FILE: shared/contracts/chat/learning/EmotionSignals.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical learning-layer contract for emotional observations, transitions,
 * windows, features, ranking hints, and memory anchors derived from
 * shared/contracts/chat/ChatEmotion.ts.
 *
 * This file exists so the emotional operating model can become durable learning
 * material without flattening your game-specific structure. The contract is
 * designed to support:
 *
 * - frontend mirrors for low-latency response ranking previews,
 * - backend online feature stores,
 * - rescue timing classifiers,
 * - hater escalation policies,
 * - crowd swarm models,
 * - silence vs intervention decisions,
 * - comeback / celebration timing,
 * - replay-linked evaluation and memory retrieval.
 *
 * Design laws
 * -----------
 * 1. Emotion signals must preserve lineage back to the authoritative emotion
 *    snapshot, trace, room, channel, scene, and actor context.
 * 2. Signals are not raw "sentiment." They are gameplay-affect telemetry.
 * 3. Feature shapes should remain serializable and stable for offline / online
 *    parity.
 * 4. Emotional learning must respect privacy and visibility boundaries already
 *    present in the broader learning lane.
 * 5. Signal contracts must be additive to the existing learning barrel rather
 *    than replacing it.
 * ============================================================================
 */

import {
  type Brand,
  type ChatChannelId,
  type ChatModeScope,
  type ChatMountTarget,
  type ChatRoomId,
  type JsonObject,
  type Optional,
  type Score01,
  type Score100,
  type UnixMs,
  CHAT_CONTRACT_AUTHORITIES,
  CHAT_CONTRACT_VERSION,
} from '../ChatChannels';

import {
  type ChatMessageId,
  type ChatNpcId,
  type ChatSceneId,
  type ChatSessionId,
  type ChatUserId,
  type ChatWorldEventId,
} from '../ChatChannels';

import {
  type ChatAuthority,
  CHAT_AUTHORITIES,
} from '../ChatEvents';

import {
  type ChatEmotionAxis,
  type ChatEmotionConfidenceBand,
  type ChatEmotionContextFrame,
  type ChatEmotionDelta,
  type ChatEmotionDerivedState,
  type ChatEmotionDirection,
  type ChatEmotionDriverEvidence,
  type ChatEmotionDriverKind,
  type ChatEmotionEnvelope,
  type ChatEmotionId,
  type ChatEmotionOperatingState,
  type ChatEmotionSnapshot,
  type ChatEmotionSummary,
  type ChatEmotionTraceId,
  type ChatEmotionVector,
  type ChatEmotionWindowId,
  CHAT_EMOTION_AXES,
  CHAT_EMOTION_CONTRACT_MANIFEST,
  CHAT_EMOTION_VERSION,
  buildEmotionDebugNotes,
  clampEmotionScalar,
  computeEmotionConfidenceBand,
  computeEmotionDerivedState,
  createChatEmotionWindowId,
  describeEmotionVector,
  emotionScore01To100,
  getDominantEmotionAxis,
  getEmotionAxisValue,
  getSecondaryEmotionAxis,
  projectEmotionToAudienceMood,
  projectEmotionToAudienceSeverity,
  summarizeEmotionSnapshot,
} from '../ChatEmotion';

import {
  type LearningAnchorId,
  type LearningEventId,
  type LearningFeatureId,
  type LearningFeatureName,
  type LearningFeatureValueKind,
  type LearningFeatureVectorId,
  type LearningFeatureWindowId,
  type LearningLabelId,
  type LearningLabelKind,
  type LearningLabelRecord,
  type LearningModelFamily,
  type LearningObservationId,
  type LearningPrivacyEnvelope,
  type LearningRankingObservationId,
  LEARNING_DEFAULT_PRIVACY_ENVELOPE,
  LEARNING_FEATURE_VALUE_KINDS,
  LEARNING_LABEL_KINDS,
} from './LearningEvents';

import type {
  LearningFeatureRecord,
  LearningFeatureBag,
} from './LearningFeatures';

import type {
  LearningRankingCandidateScore,
  LearningRankingPolicyReason,
} from './ResponseRanking';

/**
 * Versioning.
 */
export type EmotionSignalVersion = 1;
export const EMOTION_SIGNAL_VERSION: EmotionSignalVersion = 1;

/**
 * Stable signal kinds.
 */
export const EMOTION_SIGNAL_KINDS = [
  'SCALAR',
  'DELTA',
  'TREND',
  'WINDOW_SUMMARY',
  'SEQUENCE',
  'FEATURE_BAG',
  'LABEL',
  'RANKING_HINT',
  'ANCHOR',
  'PREVIEW',
] as const;

export type EmotionSignalKind = (typeof EMOTION_SIGNAL_KINDS)[number];

/**
 * Temporal windows.
 */
export const EMOTION_SIGNAL_WINDOW_KINDS = [
  'INSTANT',
  'SHORT',
  'MEDIUM',
  'LONG',
  'RUN',
  'SCENE',
  'POST_RUN',
] as const;

export type EmotionSignalWindowKind =
  (typeof EMOTION_SIGNAL_WINDOW_KINDS)[number];

/**
 * Transition tags that make emotional turns queryable.
 */
export const EMOTION_SIGNAL_TRANSITION_TAGS = [
  'PRESSURE_CLIMB',
  'PRESSURE_RELIEF',
  'EMBARRASSMENT_SPIKE',
  'CONFIDENCE_BREAK',
  'COMEBACK_BUILD',
  'RESCUE_STABILIZED',
  'HATER_OPENING',
  'CROWD_PILEON',
  'SILENCE_RECOMMENDED',
  'CELEBRATION_WITHHELD',
  'TRUST_RECOVERY',
  'PREDATORY_SWING',
] as const;

export type EmotionSignalTransitionTag =
  (typeof EMOTION_SIGNAL_TRANSITION_TAGS)[number];

/**
 * Signal subjects and scopes.
 */
export const EMOTION_SIGNAL_SUBJECT_KINDS = [
  'PLAYER',
  'NPC',
  'ROOM',
  'CHANNEL',
  'SCENE',
  'SESSION',
  'RUN',
  'WORLD_EVENT',
] as const;

export type EmotionSignalSubjectKind =
  (typeof EMOTION_SIGNAL_SUBJECT_KINDS)[number];

/**
 * Ranking-hint posture used by response models.
 */
export const EMOTION_RANKING_HINT_KINDS = [
  'PREFER_HELPER',
  'PREFER_HATER',
  'PREFER_SILENCE',
  'PREFER_CROWD',
  'PREFER_CEREMONY',
  'PREFER_NEGOTIATION_PRESSURE',
  'PREFER_RECOVERY',
] as const;

export type EmotionRankingHintKind =
  (typeof EMOTION_RANKING_HINT_KINDS)[number];

/**
 * Stable branded identifiers.
 */
export type EmotionSignalId = Brand<string, 'EmotionSignalId'>;
export type EmotionSignalSequenceId = Brand<string, 'EmotionSignalSequenceId'>;
export type EmotionSignalWindowRecordId = Brand<string, 'EmotionSignalWindowRecordId'>;
export type EmotionSignalPreviewId = Brand<string, 'EmotionSignalPreviewId'>;
export type EmotionSignalReceiptId = Brand<string, 'EmotionSignalReceiptId'>;

/**
 * Shared subject reference.
 */
export interface EmotionSignalSubjectRef {
  readonly subjectKind: EmotionSignalSubjectKind;
  readonly playerUserId?: ChatUserId;
  readonly npcId?: ChatNpcId;
  readonly roomId?: ChatRoomId;
  readonly channelId?: ChatChannelId;
  readonly sceneId?: ChatSceneId;
  readonly sessionId?: ChatSessionId;
  readonly worldEventId?: ChatWorldEventId;
  readonly label: string;
}

/**
 * Canonical source context.
 */
export interface EmotionSignalContext {
  readonly authority: ChatAuthority;
  readonly emotionVersion: typeof CHAT_EMOTION_VERSION;
  readonly context: ChatEmotionContextFrame;
  readonly dominantAxis: ChatEmotionAxis;
  readonly secondaryAxis?: ChatEmotionAxis;
  readonly operatingState: ChatEmotionOperatingState;
  readonly audienceMood: ReturnType<typeof projectEmotionToAudienceMood>;
  readonly audienceSeverity: ReturnType<typeof projectEmotionToAudienceSeverity>;
  readonly generatedAt: string;
  readonly metadata?: JsonObject;
}

/**
 * Scalar observation per axis.
 */
export interface EmotionScalarSignal {
  readonly signalId: EmotionSignalId;
  readonly kind: 'SCALAR';
  readonly snapshotId: string;
  readonly traceId: ChatEmotionTraceId;
  readonly emotionId: ChatEmotionId;
  readonly axis: ChatEmotionAxis;
  readonly value: Score01;
  readonly value100: Score100;
  readonly confidenceBand: ChatEmotionConfidenceBand;
  readonly direction: ChatEmotionDirection;
  readonly sourceDriver?: ChatEmotionDriverKind;
  readonly sourceEventId?: LearningEventId;
  readonly subject: EmotionSignalSubjectRef;
  readonly context: EmotionSignalContext;
  readonly observedAtUnixMs: UnixMs;
}

/**
 * Delta signal mirrors a folded emotional change.
 */
export interface EmotionDeltaSignal {
  readonly signalId: EmotionSignalId;
  readonly kind: 'DELTA';
  readonly traceId: ChatEmotionTraceId;
  readonly emotionId: ChatEmotionId;
  readonly delta: ChatEmotionDelta;
  readonly subject: EmotionSignalSubjectRef;
  readonly context: EmotionSignalContext;
  readonly magnitude: Score01;
  readonly magnitude100: Score100;
  readonly tags: readonly EmotionSignalTransitionTag[];
}

/**
 * Trend summary across a window.
 */
export interface EmotionTrendSignal {
  readonly signalId: EmotionSignalId;
  readonly kind: 'TREND';
  readonly traceId: ChatEmotionTraceId;
  readonly windowId: ChatEmotionWindowId;
  readonly dominantAxis: ChatEmotionAxis;
  readonly secondaryAxis?: ChatEmotionAxis;
  readonly netDirection: ChatEmotionDirection;
  readonly volatility: Score01;
  readonly stability: Score01;
  readonly rescueNeed: Score01;
  readonly haterOpportunity: Score01;
  readonly crowdPileOnRisk: Score01;
  readonly silenceSuitability: Score01;
  readonly celebrationTolerance: Score01;
  readonly subject: EmotionSignalSubjectRef;
  readonly context: EmotionSignalContext;
}

/**
 * Window summary record used for storage and training.
 */
export interface EmotionSignalWindowSummary {
  readonly recordId: EmotionSignalWindowRecordId;
  readonly signalId: EmotionSignalId;
  readonly kind: 'WINDOW_SUMMARY';
  readonly windowId: ChatEmotionWindowId;
  readonly windowKind: EmotionSignalWindowKind;
  readonly traceId: ChatEmotionTraceId;
  readonly emotionIds: readonly ChatEmotionId[];
  readonly startAtUnixMs: UnixMs;
  readonly endAtUnixMs: UnixMs;
  readonly count: number;
  readonly mean: ChatEmotionVector;
  readonly max: ChatEmotionVector;
  readonly min: ChatEmotionVector;
  readonly last: ChatEmotionVector;
  readonly derived: ChatEmotionDerivedState;
  readonly dominantAxis: ChatEmotionAxis;
  readonly secondaryAxis?: ChatEmotionAxis;
  readonly transitions: readonly EmotionSignalTransitionTag[];
  readonly drivers: readonly ChatEmotionDriverKind[];
  readonly subject: EmotionSignalSubjectRef;
  readonly context: EmotionSignalContext;
  readonly notes?: readonly string[];
}

/**
 * Sequence signal for temporal models.
 */
export interface EmotionSequenceSignal {
  readonly signalId: EmotionSignalId;
  readonly sequenceId: EmotionSignalSequenceId;
  readonly kind: 'SEQUENCE';
  readonly windowId: ChatEmotionWindowId;
  readonly windowKind: EmotionSignalWindowKind;
  readonly subject: EmotionSignalSubjectRef;
  readonly context: EmotionSignalContext;
  readonly snapshots: readonly ChatEmotionSnapshot[];
  readonly summaries: readonly ChatEmotionSummary[];
  readonly transitions: readonly EmotionSignalTransitionTag[];
}

/**
 * Structured feature record.
 */
export interface EmotionFeatureRecord extends Omit<LearningFeatureRecord, 'valueKind'> {
  readonly family: 'emotion';
  readonly axis?: ChatEmotionAxis;
  readonly valueKind: Extract<LearningFeatureValueKind, 'FLOAT' | 'BOOL' | 'CATEGORY' | 'COUNT'>;
  readonly emotionVersion: typeof CHAT_EMOTION_VERSION;
  readonly signalVersion: EmotionSignalVersion;
  readonly subject: EmotionSignalSubjectRef;
}

/**
 * Emotion feature bag grouped for ranking / storage.
 */
export interface EmotionFeatureBag {
  readonly featureVectorId: LearningFeatureVectorId;
  readonly featureWindowId: LearningFeatureWindowId;
  readonly generatedAt: string;
  readonly sourceWindowKind: EmotionSignalWindowKind;
  readonly dominantAxis: ChatEmotionAxis;
  readonly secondaryAxis?: ChatEmotionAxis;
  readonly features: readonly EmotionFeatureRecord[];
  readonly notes?: readonly string[];
}

/**
 * Label candidate built from emotion state.
 */
export interface EmotionTrainingLabel {
  readonly labelId: LearningLabelId;
  readonly signalId: EmotionSignalId;
  readonly labelKind: LearningLabelKind | 'emotion-outcome';
  readonly labelName:
    | 'requires-helper'
    | 'invite-hater'
    | 'prefer-silence'
    | 'allow-comeback'
    | 'withhold-celebration'
    | 'crowd-pileon-risk'
    | 'trust-recovering';
  readonly confidence: Score01;
  readonly confidenceBand: ChatEmotionConfidenceBand;
  readonly subject: EmotionSignalSubjectRef;
  readonly context: EmotionSignalContext;
}

/**
 * Memory anchor projection for retrieval systems.
 */
export interface EmotionMemoryAnchorSignal {
  readonly signalId: EmotionSignalId;
  readonly kind: 'ANCHOR';
  readonly anchorId: LearningAnchorId;
  readonly traceId: ChatEmotionTraceId;
  readonly emotionId: ChatEmotionId;
  readonly dominantAxis: ChatEmotionAxis;
  readonly secondaryAxis?: ChatEmotionAxis;
  readonly salience: Score01;
  readonly retrievalHeadline: string;
  readonly retrievalSummary: string;
  readonly anchorTags: readonly string[];
  readonly subject: EmotionSignalSubjectRef;
  readonly context: EmotionSignalContext;
}

/**
 * Ranking hint for response model surfaces.
 */
export interface EmotionRankingHint {
  readonly signalId: EmotionSignalId;
  readonly kind: 'RANKING_HINT';
  readonly rankingObservationId: LearningRankingObservationId;
  readonly hintKind: EmotionRankingHintKind;
  readonly weight: Score01;
  readonly candidatePolicy:
    | 'helper'
    | 'hater'
    | 'silence'
    | 'crowd'
    | 'comeback'
    | 'celebration'
    | 'recovery';
  readonly reason: string;
  readonly dominantAxis: ChatEmotionAxis;
  readonly subject: EmotionSignalSubjectRef;
  readonly context: EmotionSignalContext;
}

/**
 * UI / tooling preview object.
 */
export interface EmotionSignalPreview {
  readonly previewId: EmotionSignalPreviewId;
  readonly signalId: EmotionSignalId;
  readonly headline: string;
  readonly body: string;
  readonly dominantAxis: ChatEmotionAxis;
  readonly secondaryAxis?: ChatEmotionAxis;
  readonly operatingState: ChatEmotionOperatingState;
  readonly tags: readonly string[];
  readonly notes?: readonly string[];
}

/**
 * Receipt for extractors / stores.
 */
export interface EmotionSignalReceipt {
  readonly receiptId: EmotionSignalReceiptId;
  readonly signalVersion: EmotionSignalVersion;
  readonly traceId: ChatEmotionTraceId;
  readonly emotionId: ChatEmotionId;
  readonly generatedAt: string;
  readonly emittedBy: ChatAuthority;
  readonly signalKinds: readonly EmotionSignalKind[];
  readonly featureCount: number;
  readonly labelCount: number;
  readonly anchorCount: number;
  readonly previewCount: number;
  readonly notes?: readonly string[];
}

/**
 * Union surface.
 */
export type EmotionSignal =
  | EmotionScalarSignal
  | EmotionDeltaSignal
  | EmotionTrendSignal
  | EmotionSignalWindowSummary
  | EmotionSequenceSignal
  | EmotionMemoryAnchorSignal
  | EmotionRankingHint;

/**
 * Feature-name registry. These are intentionally human-readable and stable.
 */
export const EMOTION_SIGNAL_FEATURE_NAMES = Object.freeze({
  dominantAxis: 'emotion.dominant_axis',
  secondaryAxis: 'emotion.secondary_axis',
  operatingState: 'emotion.operating_state',
  audienceMood: 'emotion.audience_mood',
  audienceSeverity: 'emotion.audience_severity',
  intimidation: 'emotion.intimidation',
  confidence: 'emotion.confidence',
  frustration: 'emotion.frustration',
  curiosity: 'emotion.curiosity',
  attachment: 'emotion.attachment',
  socialEmbarrassment: 'emotion.social_embarrassment',
  relief: 'emotion.relief',
  dominance: 'emotion.dominance',
  desperation: 'emotion.desperation',
  trust: 'emotion.trust',
  rescueNeed: 'emotion.rescue_need',
  haterOpportunity: 'emotion.hater_opportunity',
  crowdPileOnRisk: 'emotion.crowd_pileon_risk',
  silenceSuitability: 'emotion.silence_suitability',
  comebackReadiness: 'emotion.comeback_readiness',
  celebrationTolerance: 'emotion.celebration_tolerance',
  helperUrgency: 'emotion.helper_urgency',
  volatility: 'emotion.volatility',
  stability: 'emotion.stability',
  riskOfSpiral: 'emotion.risk_of_spiral',
  preferredHelperClass: 'emotion.preferred_helper_class',
  haterEscalation: 'emotion.hater_escalation',
  preferSilence: 'emotion.prefer_silence',
  allowComebackSpeech: 'emotion.allow_comeback_speech',
  allowCelebration: 'emotion.allow_celebration',
  allowBreathingRoom: 'emotion.allow_breathing_room',
} as const);

export type EmotionSignalFeatureName =
  (typeof EMOTION_SIGNAL_FEATURE_NAMES)[keyof typeof EMOTION_SIGNAL_FEATURE_NAMES];

/**
 * Contract manifest.
 */
export interface EmotionSignalContractManifest {
  readonly version: EmotionSignalVersion;
  readonly path: 'shared/contracts/chat/learning/EmotionSignals.ts';
  readonly authorities: typeof CHAT_CONTRACT_AUTHORITIES;
  readonly emotionContractVersion: typeof CHAT_EMOTION_VERSION;
  readonly signalKinds: readonly EmotionSignalKind[];
  readonly windowKinds: readonly EmotionSignalWindowKind[];
  readonly transitionTags: readonly EmotionSignalTransitionTag[];
  readonly rankingHintKinds: readonly EmotionRankingHintKind[];
  readonly featureNames: readonly EmotionSignalFeatureName[];
  readonly description: string;
}

export const EMOTION_SIGNAL_CONTRACT_MANIFEST: EmotionSignalContractManifest =
  Object.freeze({
    version: EMOTION_SIGNAL_VERSION,
    path: 'shared/contracts/chat/learning/EmotionSignals.ts',
    authorities: CHAT_CONTRACT_AUTHORITIES,
    emotionContractVersion: CHAT_EMOTION_VERSION,
    signalKinds: EMOTION_SIGNAL_KINDS,
    windowKinds: EMOTION_SIGNAL_WINDOW_KINDS,
    transitionTags: EMOTION_SIGNAL_TRANSITION_TAGS,
    rankingHintKinds: EMOTION_RANKING_HINT_KINDS,
    featureNames: Object.freeze(
      Object.values(EMOTION_SIGNAL_FEATURE_NAMES),
    ) as readonly EmotionSignalFeatureName[],
    description:
      'Canonical emotional-learning surface for features, labels, anchors, and ranking hints derived from chat emotional state.',
  });

/**
 * Helpers.
 */
function createBrandedSignalId<T extends string>(prefix: string): Brand<string, T> {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${time}_${rand}` as Brand<string, T>;
}

export function createEmotionSignalId(): EmotionSignalId {
  return createBrandedSignalId<'EmotionSignalId'>('emotion_signal');
}

export function createEmotionSignalSequenceId(): EmotionSignalSequenceId {
  return createBrandedSignalId<'EmotionSignalSequenceId'>('emotion_signal_sequence');
}

export function createEmotionSignalWindowRecordId(): EmotionSignalWindowRecordId {
  return createBrandedSignalId<'EmotionSignalWindowRecordId'>('emotion_signal_window');
}

export function createEmotionSignalPreviewId(): EmotionSignalPreviewId {
  return createBrandedSignalId<'EmotionSignalPreviewId'>('emotion_signal_preview');
}

export function createEmotionSignalReceiptId(): EmotionSignalReceiptId {
  return createBrandedSignalId<'EmotionSignalReceiptId'>('emotion_signal_receipt');
}

export function createEmotionSignalSubjectRef(
  input: EmotionSignalSubjectRef,
): EmotionSignalSubjectRef {
  return { ...input };
}

export function createEmotionSignalContext(
  snapshot: ChatEmotionSnapshot,
): EmotionSignalContext {
  return {
    authority: snapshot.authority,
    emotionVersion: CHAT_EMOTION_VERSION,
    context: snapshot.context,
    dominantAxis: snapshot.derived.dominantAxis,
    secondaryAxis: snapshot.derived.secondaryAxis,
    operatingState: snapshot.derived.operatingState,
    audienceMood: projectEmotionToAudienceMood(snapshot.vector),
    audienceSeverity: projectEmotionToAudienceSeverity(snapshot.vector),
    generatedAt: snapshot.updatedAt,
    metadata: snapshot.metadata,
  };
}

export function inferEmotionSignalSubject(
  snapshot: ChatEmotionSnapshot,
): EmotionSignalSubjectRef {
  if (snapshot.context.playerUserId) {
    return {
      subjectKind: 'PLAYER',
      playerUserId: snapshot.context.playerUserId,
      roomId: snapshot.context.roomId,
      channelId: snapshot.context.channelId,
      sceneId: snapshot.context.sceneId,
      sessionId: snapshot.context.sessionId,
      label: snapshot.context.playerUserId,
    };
  }
  if (snapshot.context.focalNpcId) {
    return {
      subjectKind: 'NPC',
      npcId: snapshot.context.focalNpcId,
      roomId: snapshot.context.roomId,
      channelId: snapshot.context.channelId,
      sceneId: snapshot.context.sceneId,
      sessionId: snapshot.context.sessionId,
      label: snapshot.context.focalNpcId,
    };
  }
  return {
    subjectKind: 'ROOM',
    roomId: snapshot.context.roomId,
    channelId: snapshot.context.channelId,
    sceneId: snapshot.context.sceneId,
    sessionId: snapshot.context.sessionId,
    label: `${snapshot.context.roomId}:${snapshot.context.channelId}`,
  };
}

export function detectEmotionTransitionTags(
  snapshot: ChatEmotionSnapshot,
): readonly EmotionSignalTransitionTag[] {
  const tags = new Set<EmotionSignalTransitionTag>();
  const vector = snapshot.vector;
  const prev = snapshot.previousVector;

  if (prev) {
    if (vector.frustration - prev.frustration >= 0.2) {
      tags.add('PRESSURE_CLIMB');
    }
    if (prev.frustration - vector.frustration >= 0.18 || vector.relief - prev.relief >= 0.18) {
      tags.add('PRESSURE_RELIEF');
    }
    if (vector.socialEmbarrassment - prev.socialEmbarrassment >= 0.18) {
      tags.add('EMBARRASSMENT_SPIKE');
    }
    if (prev.confidence - vector.confidence >= 0.18) {
      tags.add('CONFIDENCE_BREAK');
    }
    if (vector.confidence - prev.confidence >= 0.16 && vector.trust - prev.trust >= 0.1) {
      tags.add('COMEBACK_BUILD');
    }
    if (vector.trust - prev.trust >= 0.14 && vector.relief - prev.relief >= 0.14) {
      tags.add('TRUST_RECOVERY');
    }
    if (vector.dominance - prev.dominance >= 0.18) {
      tags.add('PREDATORY_SWING');
    }
  }

  if (snapshot.derived.rescueNeed <= 0.28 && vector.relief >= 0.55) {
    tags.add('RESCUE_STABILIZED');
  }
  if (snapshot.derived.haterOpportunity >= 0.55) {
    tags.add('HATER_OPENING');
  }
  if (snapshot.derived.crowdPileOnRisk >= 0.56) {
    tags.add('CROWD_PILEON');
  }
  if (snapshot.derived.silenceSuitability >= 0.58) {
    tags.add('SILENCE_RECOMMENDED');
  }
  if (!snapshot.silenceDirective.allowCelebration && vector.relief >= 0.48) {
    tags.add('CELEBRATION_WITHHELD');
  }

  return Object.freeze([...tags]);
}

export function buildEmotionScalarSignals(
  snapshot: ChatEmotionSnapshot,
  subject: EmotionSignalSubjectRef = inferEmotionSignalSubject(snapshot),
): readonly EmotionScalarSignal[] {
  const trendByAxis = new Map(snapshot.trend.map((item) => [item.axis, item]));
  return Object.freeze(
    CHAT_EMOTION_AXES.map((axis) => {
      const value = getEmotionAxisValue(snapshot.vector, axis);
      const trend = trendByAxis.get(axis);
      return {
        signalId: createEmotionSignalId(),
        kind: 'SCALAR' as const,
        snapshotId: snapshot.snapshotId,
        traceId: snapshot.traceId,
        emotionId: snapshot.emotionId,
        axis,
        value,
        value100: emotionScore01To100(value),
        confidenceBand: snapshot.derived.confidenceBand,
        direction: trend?.direction ?? 'FLAT',
        sourceDriver: snapshot.drivers[0]?.driver,
        subject,
        context: createEmotionSignalContext(snapshot),
        observedAtUnixMs: snapshot.observedAtUnixMs,
      };
    }),
  );
}

export function buildEmotionDeltaSignals(
  snapshot: ChatEmotionSnapshot,
  subject: EmotionSignalSubjectRef = inferEmotionSignalSubject(snapshot),
): readonly EmotionDeltaSignal[] {
  return Object.freeze(
    snapshot.deltas.map((delta) => ({
      signalId: createEmotionSignalId(),
      kind: 'DELTA' as const,
      traceId: snapshot.traceId,
      emotionId: snapshot.emotionId,
      delta,
      subject,
      context: createEmotionSignalContext(snapshot),
      magnitude: clampEmotionScalar(
        Object.values(delta.vectorDelta).reduce(
          (sum, value) => sum + Math.abs(Number(value ?? 0)),
          0,
        ) / CHAT_EMOTION_AXES.length,
      ),
      magnitude100: emotionScore01To100(
        clampEmotionScalar(
          Object.values(delta.vectorDelta).reduce(
            (sum, value) => sum + Math.abs(Number(value ?? 0)),
            0,
          ) / CHAT_EMOTION_AXES.length,
        ),
      ),
      tags: detectEmotionTransitionTags(snapshot),
    })),
  );
}

export function buildEmotionTrendSignal(
  snapshot: ChatEmotionSnapshot,
  subject: EmotionSignalSubjectRef = inferEmotionSignalSubject(snapshot),
  windowId: ChatEmotionWindowId = createChatEmotionWindowId(),
): EmotionTrendSignal {
  return {
    signalId: createEmotionSignalId(),
    kind: 'TREND',
    traceId: snapshot.traceId,
    windowId,
    dominantAxis: snapshot.derived.dominantAxis,
    secondaryAxis: snapshot.derived.secondaryAxis,
    netDirection:
      snapshot.trend.find((item) => item.axis === snapshot.derived.dominantAxis)?.direction ??
      'FLAT',
    volatility: snapshot.derived.volatility,
    stability: snapshot.derived.stability,
    rescueNeed: snapshot.derived.rescueNeed,
    haterOpportunity: snapshot.derived.haterOpportunity,
    crowdPileOnRisk: snapshot.derived.crowdPileOnRisk,
    silenceSuitability: snapshot.derived.silenceSuitability,
    celebrationTolerance: snapshot.derived.celebrationTolerance,
    subject,
    context: createEmotionSignalContext(snapshot),
  };
}

function meanAxis(
  snapshots: readonly ChatEmotionSnapshot[],
  axis: ChatEmotionAxis,
): Score01 {
  if (!snapshots.length) {
    return 0 as Score01;
  }
  return clampEmotionScalar(
    snapshots.reduce((sum, item) => sum + getEmotionAxisValue(item.vector, axis), 0) /
      snapshots.length,
  );
}

function maxAxis(
  snapshots: readonly ChatEmotionSnapshot[],
  axis: ChatEmotionAxis,
): Score01 {
  return clampEmotionScalar(
    Math.max(0, ...snapshots.map((item) => getEmotionAxisValue(item.vector, axis))),
  );
}

function minAxis(
  snapshots: readonly ChatEmotionSnapshot[],
  axis: ChatEmotionAxis,
): Score01 {
  if (!snapshots.length) {
    return 0 as Score01;
  }
  return clampEmotionScalar(
    Math.min(...snapshots.map((item) => getEmotionAxisValue(item.vector, axis))),
  );
}

function buildVectorFromReducer(
  snapshots: readonly ChatEmotionSnapshot[],
  reducer: (snapshots: readonly ChatEmotionSnapshot[], axis: ChatEmotionAxis) => Score01,
): ChatEmotionVector {
  return {
    intimidation: reducer(snapshots, 'INTIMIDATION'),
    confidence: reducer(snapshots, 'CONFIDENCE'),
    frustration: reducer(snapshots, 'FRUSTRATION'),
    curiosity: reducer(snapshots, 'CURIOSITY'),
    attachment: reducer(snapshots, 'ATTACHMENT'),
    socialEmbarrassment: reducer(snapshots, 'SOCIAL_EMBARRASSMENT'),
    relief: reducer(snapshots, 'RELIEF'),
    dominance: reducer(snapshots, 'DOMINANCE'),
    desperation: reducer(snapshots, 'DESPERATION'),
    trust: reducer(snapshots, 'TRUST'),
  };
}

export function summarizeEmotionWindow(
  snapshots: readonly ChatEmotionSnapshot[],
  input?: {
    readonly windowId?: ChatEmotionWindowId;
    readonly windowKind?: EmotionSignalWindowKind;
    readonly subject?: EmotionSignalSubjectRef;
    readonly notes?: readonly string[];
  },
): EmotionSignalWindowSummary {
  const ordered = [...snapshots].sort((a, b) => a.observedAtUnixMs - b.observedAtUnixMs);
  const first = ordered[0];
  const last = ordered[ordered.length - 1];

  const mean = buildVectorFromReducer(ordered, meanAxis);
  const max = buildVectorFromReducer(ordered, maxAxis);
  const min = buildVectorFromReducer(ordered, minAxis);
  const lastVector = last?.vector ?? mean;
  const derived = computeEmotionDerivedState(lastVector, first?.vector);
  const summarySnapshot =
    last ??
    {
      ...createFallbackSnapshot(mean),
      vector: mean,
    };

  return {
    recordId: createEmotionSignalWindowRecordId(),
    signalId: createEmotionSignalId(),
    kind: 'WINDOW_SUMMARY',
    windowId: input?.windowId ?? createChatEmotionWindowId(),
    windowKind: input?.windowKind ?? 'SHORT',
    traceId: last?.traceId ?? createFallbackSnapshot(mean).traceId,
    emotionIds: Object.freeze(ordered.map((item) => item.emotionId)),
    startAtUnixMs: first?.observedAtUnixMs ?? (Date.now() as UnixMs),
    endAtUnixMs: last?.observedAtUnixMs ?? (Date.now() as UnixMs),
    count: ordered.length,
    mean,
    max,
    min,
    last: lastVector,
    derived,
    dominantAxis: getDominantEmotionAxis(lastVector),
    secondaryAxis: getSecondaryEmotionAxis(lastVector),
    transitions: detectEmotionTransitionTags(summarySnapshot),
    drivers: Object.freeze(
      Array.from(new Set(ordered.flatMap((item) => item.drivers.map((driver) => driver.driver)))),
    ),
    subject:
      input?.subject ??
      (last ? inferEmotionSignalSubject(last) : createFallbackSubject()),
    context:
      last ? createEmotionSignalContext(last) : createEmotionSignalContext(createFallbackSnapshot(mean)),
    notes: input?.notes ? Object.freeze([...input.notes]) : undefined,
  };
}

function createFallbackSubject(): EmotionSignalSubjectRef {
  return {
    subjectKind: 'ROOM',
    roomId: 'unknown-room' as ChatRoomId,
    channelId: 'GLOBAL' as ChatChannelId,
    label: 'unknown-room',
  };
}

function createFallbackSnapshot(vector: ChatEmotionVector): ChatEmotionSnapshot {
  return {
    version: CHAT_EMOTION_VERSION,
    emotionId: 'fallback-emotion' as ChatEmotionId,
    snapshotId: 'fallback-snapshot',
    traceId: 'fallback-trace' as ChatEmotionTraceId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    observedAtUnixMs: Date.now() as UnixMs,
    authority: CHAT_AUTHORITIES.shared,
    context: {
      roomId: 'unknown-room' as ChatRoomId,
      channelId: 'GLOBAL' as ChatChannelId,
      sourceAuthority: CHAT_AUTHORITIES.shared,
    },
    vector,
    trend: [],
    drivers: [],
    deltas: [],
    derived: computeEmotionDerivedState(vector),
    helperDirective: {
      helperClass: 'NONE',
      urgency: 0 as Score01,
      shouldWaitBeforeIntervening: true,
      shouldOfferEscapeValve: false,
      shouldLowerSocialPressure: false,
      preferredTone: 'STEADY',
      reason: 'fallback',
    },
    haterDirective: {
      escalation: 'NONE',
      shouldWeaponizeDelay: false,
      shouldExploitEmbarrassment: false,
      shouldPivotToRespect: false,
      shouldEscalatePublicly: false,
      reason: 'fallback',
    },
    crowdDirective: {
      heatBoost: 0 as Score01,
      ridiculeBoost: 0 as Score01,
      aweBoost: 0 as Score01,
      pityBoost: 0 as Score01,
      predationBoost: 0 as Score01,
      witnessPressureBoost: 0 as Score01,
      shouldSwarm: false,
      shouldStayQuiet: true,
      reason: 'fallback',
    },
    silenceDirective: {
      preferSilence: false,
      silenceWeight: 0 as Score01,
      allowComebackSpeech: false,
      allowCelebration: false,
      allowBreathingRoom: true,
      reason: 'fallback',
    },
    directives: [],
  };
}

export function buildEmotionSequenceSignal(
  snapshots: readonly ChatEmotionSnapshot[],
  input?: {
    readonly subject?: EmotionSignalSubjectRef;
    readonly windowKind?: EmotionSignalWindowKind;
  },
): EmotionSequenceSignal {
  const ordered = [...snapshots].sort((a, b) => a.observedAtUnixMs - b.observedAtUnixMs);
  const last = ordered[ordered.length - 1] ?? createFallbackSnapshot({
    intimidation: 0 as Score01,
    confidence: 0 as Score01,
    frustration: 0 as Score01,
    curiosity: 0 as Score01,
    attachment: 0 as Score01,
    socialEmbarrassment: 0 as Score01,
    relief: 0 as Score01,
    dominance: 0 as Score01,
    desperation: 0 as Score01,
    trust: 0 as Score01,
  });

  return {
    signalId: createEmotionSignalId(),
    sequenceId: createEmotionSignalSequenceId(),
    kind: 'SEQUENCE',
    windowId: createChatEmotionWindowId(),
    windowKind: input?.windowKind ?? 'MEDIUM',
    subject: input?.subject ?? inferEmotionSignalSubject(last),
    context: createEmotionSignalContext(last),
    snapshots: Object.freeze(ordered),
    summaries: Object.freeze(ordered.map((item) => summarizeEmotionSnapshot(item))),
    transitions: Object.freeze(
      Array.from(new Set(ordered.flatMap((item) => detectEmotionTransitionTags(item)))),
    ),
  };
}

function createEmotionFeatureRecord(
  name: EmotionSignalFeatureName,
  valueKind: EmotionFeatureRecord['valueKind'],
  value: string | number | boolean,
  snapshot: ChatEmotionSnapshot,
  subject: EmotionSignalSubjectRef,
  axis?: ChatEmotionAxis,
): EmotionFeatureRecord {
  return {
    featureId: createBrandedSignalId<'LearningFeatureId'>('emotion_feature') as LearningFeatureId,
    family: 'emotion',
    name: name as LearningFeatureName,
    valueKind,
    value,
    freshnessMs: 0,
    sourceEventIds: [],
    sourceAuthorities: [snapshot.authority],
    confidence: snapshot.derived.helperUrgency,
    privacy: LEARNING_DEFAULT_PRIVACY_ENVELOPE as LearningPrivacyEnvelope,
    axis,
    emotionVersion: CHAT_EMOTION_VERSION,
    signalVersion: EMOTION_SIGNAL_VERSION,
    subject,
  };
}

export function buildEmotionFeatureBag(
  snapshot: ChatEmotionSnapshot,
  subject: EmotionSignalSubjectRef = inferEmotionSignalSubject(snapshot),
  windowKind: EmotionSignalWindowKind = 'INSTANT',
): EmotionFeatureBag {
  const features: EmotionFeatureRecord[] = [
    createEmotionFeatureRecord(
      EMOTION_SIGNAL_FEATURE_NAMES.dominantAxis,
      'CATEGORY',
      snapshot.derived.dominantAxis,
      snapshot,
      subject,
      snapshot.derived.dominantAxis,
    ),
    createEmotionFeatureRecord(
      EMOTION_SIGNAL_FEATURE_NAMES.secondaryAxis,
      'CATEGORY',
      snapshot.derived.secondaryAxis ?? 'NONE',
      snapshot,
      subject,
      snapshot.derived.secondaryAxis,
    ),
    createEmotionFeatureRecord(
      EMOTION_SIGNAL_FEATURE_NAMES.operatingState,
      'CATEGORY',
      snapshot.derived.operatingState,
      snapshot,
      subject,
    ),
    createEmotionFeatureRecord(
      EMOTION_SIGNAL_FEATURE_NAMES.audienceMood,
      'CATEGORY',
      projectEmotionToAudienceMood(snapshot.vector),
      snapshot,
      subject,
    ),
    createEmotionFeatureRecord(
      EMOTION_SIGNAL_FEATURE_NAMES.audienceSeverity,
      'CATEGORY',
      projectEmotionToAudienceSeverity(snapshot.vector),
      snapshot,
      subject,
    ),
  ];

  for (const axis of CHAT_EMOTION_AXES) {
    const featureName = EMOTION_SIGNAL_FEATURE_NAMES[
      axis.toLowerCase().replace('social_embarrassment', 'socialEmbarrassment') as keyof typeof EMOTION_SIGNAL_FEATURE_NAMES
    ];
    if (featureName) {
      features.push(
        createEmotionFeatureRecord(
          featureName as EmotionSignalFeatureName,
          'FLOAT',
          getEmotionAxisValue(snapshot.vector, axis),
          snapshot,
          subject,
          axis,
        ),
      );
    }
  }

  features.push(
    createEmotionFeatureRecord(
      EMOTION_SIGNAL_FEATURE_NAMES.rescueNeed,
      'FLOAT',
      snapshot.derived.rescueNeed,
      snapshot,
      subject,
    ),
    createEmotionFeatureRecord(
      EMOTION_SIGNAL_FEATURE_NAMES.haterOpportunity,
      'FLOAT',
      snapshot.derived.haterOpportunity,
      snapshot,
      subject,
    ),
    createEmotionFeatureRecord(
      EMOTION_SIGNAL_FEATURE_NAMES.crowdPileOnRisk,
      'FLOAT',
      snapshot.derived.crowdPileOnRisk,
      snapshot,
      subject,
    ),
    createEmotionFeatureRecord(
      EMOTION_SIGNAL_FEATURE_NAMES.silenceSuitability,
      'FLOAT',
      snapshot.derived.silenceSuitability,
      snapshot,
      subject,
    ),
    createEmotionFeatureRecord(
      EMOTION_SIGNAL_FEATURE_NAMES.comebackReadiness,
      'FLOAT',
      snapshot.derived.comebackReadiness,
      snapshot,
      subject,
    ),
    createEmotionFeatureRecord(
      EMOTION_SIGNAL_FEATURE_NAMES.celebrationTolerance,
      'FLOAT',
      snapshot.derived.celebrationTolerance,
      snapshot,
      subject,
    ),
    createEmotionFeatureRecord(
      EMOTION_SIGNAL_FEATURE_NAMES.helperUrgency,
      'FLOAT',
      snapshot.derived.helperUrgency,
      snapshot,
      subject,
    ),
    createEmotionFeatureRecord(
      EMOTION_SIGNAL_FEATURE_NAMES.volatility,
      'FLOAT',
      snapshot.derived.volatility,
      snapshot,
      subject,
    ),
    createEmotionFeatureRecord(
      EMOTION_SIGNAL_FEATURE_NAMES.stability,
      'FLOAT',
      snapshot.derived.stability,
      snapshot,
      subject,
    ),
    createEmotionFeatureRecord(
      EMOTION_SIGNAL_FEATURE_NAMES.riskOfSpiral,
      'FLOAT',
      snapshot.derived.riskOfSpiral,
      snapshot,
      subject,
    ),
    createEmotionFeatureRecord(
      EMOTION_SIGNAL_FEATURE_NAMES.preferredHelperClass,
      'CATEGORY',
      snapshot.helperDirective.helperClass,
      snapshot,
      subject,
    ),
    createEmotionFeatureRecord(
      EMOTION_SIGNAL_FEATURE_NAMES.haterEscalation,
      'CATEGORY',
      snapshot.haterDirective.escalation,
      snapshot,
      subject,
    ),
    createEmotionFeatureRecord(
      EMOTION_SIGNAL_FEATURE_NAMES.preferSilence,
      'BOOL',
      snapshot.silenceDirective.preferSilence,
      snapshot,
      subject,
    ),
    createEmotionFeatureRecord(
      EMOTION_SIGNAL_FEATURE_NAMES.allowComebackSpeech,
      'BOOL',
      snapshot.silenceDirective.allowComebackSpeech,
      snapshot,
      subject,
    ),
    createEmotionFeatureRecord(
      EMOTION_SIGNAL_FEATURE_NAMES.allowCelebration,
      'BOOL',
      snapshot.silenceDirective.allowCelebration,
      snapshot,
      subject,
    ),
    createEmotionFeatureRecord(
      EMOTION_SIGNAL_FEATURE_NAMES.allowBreathingRoom,
      'BOOL',
      snapshot.silenceDirective.allowBreathingRoom,
      snapshot,
      subject,
    ),
  );

  return {
    featureVectorId: createBrandedSignalId<'LearningFeatureVectorId'>('emotion_feature_vector') as LearningFeatureVectorId,
    featureWindowId: createBrandedSignalId<'LearningFeatureWindowId'>('emotion_feature_window') as LearningFeatureWindowId,
    generatedAt: snapshot.updatedAt,
    sourceWindowKind: windowKind,
    dominantAxis: snapshot.derived.dominantAxis,
    secondaryAxis: snapshot.derived.secondaryAxis,
    features: Object.freeze(features),
    notes: Object.freeze(buildEmotionDebugNotes(snapshot)),
  };
}

export function deriveEmotionTrainingLabels(
  snapshot: ChatEmotionSnapshot,
  subject: EmotionSignalSubjectRef = inferEmotionSignalSubject(snapshot),
): readonly EmotionTrainingLabel[] {
  const labels: EmotionTrainingLabel[] = [];

  const push = (
    labelName: EmotionTrainingLabel['labelName'],
    confidence: number,
  ) => {
    labels.push({
      labelId: createBrandedSignalId<'LearningLabelId'>('emotion_label') as LearningLabelId,
      signalId: createEmotionSignalId(),
      labelKind: 'emotion-outcome',
      labelName,
      confidence: clampEmotionScalar(confidence),
      confidenceBand: computeEmotionConfidenceBand(confidence),
      subject,
      context: createEmotionSignalContext(snapshot),
    });
  };

  if (snapshot.derived.helperUrgency >= 0.52) {
    push('requires-helper', snapshot.derived.helperUrgency);
  }
  if (snapshot.derived.haterOpportunity >= 0.52) {
    push('invite-hater', snapshot.derived.haterOpportunity);
  }
  if (snapshot.silenceDirective.preferSilence) {
    push('prefer-silence', snapshot.derived.silenceSuitability);
  }
  if (snapshot.silenceDirective.allowComebackSpeech) {
    push('allow-comeback', snapshot.derived.comebackReadiness);
  }
  if (!snapshot.silenceDirective.allowCelebration && snapshot.vector.relief >= 0.42) {
    push('withhold-celebration', 1 - snapshot.derived.celebrationTolerance);
  }
  if (snapshot.derived.crowdPileOnRisk >= 0.52) {
    push('crowd-pileon-risk', snapshot.derived.crowdPileOnRisk);
  }
  if (snapshot.vector.trust >= 0.54 && snapshot.vector.relief >= 0.42) {
    push('trust-recovering', clampEmotionScalar((snapshot.vector.trust + snapshot.vector.relief) / 2));
  }

  return Object.freeze(labels);
}

export function buildEmotionMemoryAnchorSignal(
  snapshot: ChatEmotionSnapshot,
  subject: EmotionSignalSubjectRef = inferEmotionSignalSubject(snapshot),
): EmotionMemoryAnchorSignal {
  const dominantAxis = snapshot.derived.dominantAxis;
  const secondaryAxis = snapshot.derived.secondaryAxis;
  const salience = clampEmotionScalar(
    snapshot.derived.haterOpportunity * 0.22 +
      snapshot.derived.helperUrgency * 0.2 +
      snapshot.derived.crowdPileOnRisk * 0.2 +
      snapshot.derived.silenceSuitability * 0.12 +
      snapshot.derived.comebackReadiness * 0.12 +
      snapshot.derived.riskOfSpiral * 0.14,
  );
  const headline = `${dominantAxis.toLowerCase().replace(/_/g, ' ')} led in ${snapshot.context.channelId}`;
  const summary = [
    `state=${snapshot.derived.operatingState}`,
    `helper=${emotionScore01To100(snapshot.derived.helperUrgency)}`,
    `hater=${emotionScore01To100(snapshot.derived.haterOpportunity)}`,
    `crowd=${emotionScore01To100(snapshot.derived.crowdPileOnRisk)}`,
  ].join(' | ');

  return {
    signalId: createEmotionSignalId(),
    kind: 'ANCHOR',
    anchorId: createBrandedSignalId<'LearningAnchorId'>('emotion_anchor') as LearningAnchorId,
    traceId: snapshot.traceId,
    emotionId: snapshot.emotionId,
    dominantAxis,
    secondaryAxis,
    salience,
    retrievalHeadline: headline,
    retrievalSummary: summary,
    anchorTags: Object.freeze([
      dominantAxis.toLowerCase(),
      secondaryAxis?.toLowerCase() ?? 'none',
      snapshot.derived.operatingState.toLowerCase(),
      snapshot.context.channelId.toLowerCase(),
    ]),
    subject,
    context: createEmotionSignalContext(snapshot),
  };
}

export function buildEmotionRankingHint(
  snapshot: ChatEmotionSnapshot,
  subject: EmotionSignalSubjectRef = inferEmotionSignalSubject(snapshot),
): EmotionRankingHint {
  const helper = snapshot.derived.helperUrgency;
  const hater = snapshot.derived.haterOpportunity;
  const silence = snapshot.derived.silenceSuitability;
  const comeback = snapshot.derived.comebackReadiness;
  const celebration = snapshot.derived.celebrationTolerance;

  let hintKind: EmotionRankingHintKind = 'PREFER_RECOVERY';
  let weight = helper;
  let candidatePolicy: EmotionRankingHint['candidatePolicy'] = 'recovery';
  let reason = 'Recovery remains safest default under mixed affect.';

  if (silence >= helper && silence >= hater && silence >= comeback) {
    hintKind = 'PREFER_SILENCE';
    weight = silence;
    candidatePolicy = 'silence';
    reason = 'Silence preserves the moment better than immediate response.';
  } else if (helper >= hater && helper >= comeback) {
    hintKind = 'PREFER_HELPER';
    weight = helper;
    candidatePolicy = 'helper';
    reason = 'Helper timing has the highest emotional leverage.';
  } else if (hater >= helper && hater >= comeback) {
    hintKind = 'PREFER_HATER';
    weight = hater;
    candidatePolicy = 'hater';
    reason = 'Hostile pressure offers the strongest authored escalation.';
  } else if (comeback >= celebration) {
    hintKind = 'PREFER_CEREMONY';
    weight = comeback;
    candidatePolicy = 'comeback';
    reason = 'Comeback rhetoric best fits the current emotional swing.';
  } else {
    hintKind = 'PREFER_CEREMONY';
    weight = celebration;
    candidatePolicy = 'celebration';
    reason = 'Celebratory witness response is now emotionally safe.';
  }

  return {
    signalId: createEmotionSignalId(),
    kind: 'RANKING_HINT',
    rankingObservationId: createBrandedSignalId<'LearningRankingObservationId'>('emotion_ranking') as LearningRankingObservationId,
    hintKind,
    weight,
    candidatePolicy,
    reason,
    dominantAxis: snapshot.derived.dominantAxis,
    subject,
    context: createEmotionSignalContext(snapshot),
  };
}

export function buildEmotionSignalPreview(
  snapshot: ChatEmotionSnapshot,
): EmotionSignalPreview {
  const summary = summarizeEmotionSnapshot(snapshot);
  return {
    previewId: createEmotionSignalPreviewId(),
    signalId: createEmotionSignalId(),
    headline: summary.label,
    body: summary.narrative,
    dominantAxis: summary.dominantAxis,
    secondaryAxis: summary.secondaryAxis,
    operatingState: summary.operatingState,
    tags: Object.freeze(detectEmotionTransitionTags(snapshot).map((item) => item.toLowerCase())),
    notes: Object.freeze(buildEmotionDebugNotes(snapshot)),
  };
}

export function buildEmotionSignalReceipt(
  snapshot: ChatEmotionSnapshot,
): EmotionSignalReceipt {
  const featureBag = buildEmotionFeatureBag(snapshot);
  const labels = deriveEmotionTrainingLabels(snapshot);
  return {
    receiptId: createEmotionSignalReceiptId(),
    signalVersion: EMOTION_SIGNAL_VERSION,
    traceId: snapshot.traceId,
    emotionId: snapshot.emotionId,
    generatedAt: snapshot.updatedAt,
    emittedBy: snapshot.authority,
    signalKinds: Object.freeze([
      'SCALAR',
      'TREND',
      'FEATURE_BAG',
      'LABEL',
      'ANCHOR',
      'RANKING_HINT',
      'PREVIEW',
    ]),
    featureCount: featureBag.features.length,
    labelCount: labels.length,
    anchorCount: 1,
    previewCount: 1,
    notes: Object.freeze([
      `dominant=${snapshot.derived.dominantAxis}`,
      `vector=${describeEmotionVector(snapshot.vector)}`,
    ]),
  };
}

export function buildAllEmotionSignals(
  snapshot: ChatEmotionSnapshot,
): {
  readonly scalarSignals: readonly EmotionScalarSignal[];
  readonly deltaSignals: readonly EmotionDeltaSignal[];
  readonly trendSignal: EmotionTrendSignal;
  readonly featureBag: EmotionFeatureBag;
  readonly labels: readonly EmotionTrainingLabel[];
  readonly anchor: EmotionMemoryAnchorSignal;
  readonly rankingHint: EmotionRankingHint;
  readonly preview: EmotionSignalPreview;
  readonly receipt: EmotionSignalReceipt;
} {
  const scalarSignals = buildEmotionScalarSignals(snapshot);
  const deltaSignals = buildEmotionDeltaSignals(snapshot);
  const trendSignal = buildEmotionTrendSignal(snapshot);
  const featureBag = buildEmotionFeatureBag(snapshot);
  const labels = deriveEmotionTrainingLabels(snapshot);
  const anchor = buildEmotionMemoryAnchorSignal(snapshot);
  const rankingHint = buildEmotionRankingHint(snapshot);
  const preview = buildEmotionSignalPreview(snapshot);
  const receipt = buildEmotionSignalReceipt(snapshot);

  return {
    scalarSignals,
    deltaSignals,
    trendSignal,
    featureBag,
    labels,
    anchor,
    rankingHint,
    preview,
    receipt,
  };
}

export const EMOTION_SIGNAL_EXPORT_NAMES = Object.freeze([
  'EMOTION_SIGNAL_VERSION',
  'EMOTION_SIGNAL_KINDS',
  'EMOTION_SIGNAL_WINDOW_KINDS',
  'EMOTION_SIGNAL_TRANSITION_TAGS',
  'EMOTION_SIGNAL_SUBJECT_KINDS',
  'EMOTION_RANKING_HINT_KINDS',
  'EMOTION_SIGNAL_FEATURE_NAMES',
  'EMOTION_SIGNAL_CONTRACT_MANIFEST',
  'createEmotionSignalId',
  'createEmotionSignalSequenceId',
  'createEmotionSignalWindowRecordId',
  'createEmotionSignalPreviewId',
  'createEmotionSignalReceiptId',
  'createEmotionSignalSubjectRef',
  'createEmotionSignalContext',
  'inferEmotionSignalSubject',
  'detectEmotionTransitionTags',
  'buildEmotionScalarSignals',
  'buildEmotionDeltaSignals',
  'buildEmotionTrendSignal',
  'summarizeEmotionWindow',
  'buildEmotionSequenceSignal',
  'buildEmotionFeatureBag',
  'deriveEmotionTrainingLabels',
  'buildEmotionMemoryAnchorSignal',
  'buildEmotionRankingHint',
  'buildEmotionSignalPreview',
  'buildEmotionSignalReceipt',
  'buildAllEmotionSignals',
] as const);

export const EMOTION_SIGNAL_CONTRACT_DESCRIPTOR = Object.freeze({
  version: EMOTION_SIGNAL_VERSION,
  fileName: 'EmotionSignals.ts',
  path: 'shared/contracts/chat/learning/EmotionSignals.ts',
  authorities: CHAT_CONTRACT_AUTHORITIES,
  dependsOn: [
    'shared/contracts/chat/ChatEmotion.ts',
    'shared/contracts/chat/learning/LearningEvents.ts',
    'shared/contracts/chat/learning/LearningFeatures.ts',
    'shared/contracts/chat/learning/ResponseRanking.ts',
  ] as const,
  exportNames: EMOTION_SIGNAL_EXPORT_NAMES,
  usesAuthorities: [
    CHAT_AUTHORITIES.shared,
    CHAT_AUTHORITIES.frontend,
    CHAT_AUTHORITIES.backend,
    CHAT_AUTHORITIES.server,
  ] as const,
  description:
    'Learning-layer emotional signals, feature bags, labels, anchors, ranking hints, previews, and receipts.',
});
