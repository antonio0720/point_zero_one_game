/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT EMOTION CONTRACTS
 * FILE: shared/contracts/chat/ChatEmotion.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical emotional operating model for the unified chat lane.
 *
 * This contract promotes emotion from "nice to have personalization metadata"
 * into first-class gameplay law that can be shared across:
 *
 * - /shared/contracts/chat
 * - /pzo-web/src/engines/chat
 * - /pzo-web/src/components/chat
 * - /backend/src/game/engine/chat
 * - /pzo-server/src/chat
 *
 * Emotional law
 * -------------
 * 1. Emotion is not sentiment garnish. It is runtime pressure.
 * 2. Emotion must remain explainable, serializable, and replayable.
 * 3. Emotional state must preserve context: room, channel, mount, mode, actor,
 *    moment, scene, message lineage, and driver evidence.
 * 4. Emotional state may guide helper timing, hater escalation, crowd swarm
 *    intensity, silence windows, comeback ceremonies, and celebration restraint,
 *    but this shared contract must not perform runtime side effects.
 * 5. Confidence, intimidation, frustration, curiosity, attachment, social
 *    embarrassment, relief, dominance, desperation, and trust are the canonical
 *    first-wave axes because they directly map to your chat doctrine:
 *      - psychological combat
 *      - rescue timing
 *      - memory callbacks
 *      - crowd pressure
 *      - helper intervention
 *      - hater theater
 *      - post-run interpretation
 * 6. "Emotion" here means perceived gameplay-affect state, not medical or
 *    clinical truth. The model is strictly an in-game authored operating layer.
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
} from './ChatChannels';

import {
  type ChatAuthority,
  type ChatInterventionId,
  type ChatMessageId,
  type ChatNpcId,
  type ChatSceneId,
  type ChatSessionId,
  type ChatUserId,
  type ChatWorldEventId,
  CHAT_AUTHORITIES,
} from './ChatEvents';

import type {
  ChatAudienceHeatDriver,
  ChatAudienceHeatSeverity,
  ChatAudienceMood,
  ChatAudienceSwarmRisk,
  ChatAudienceWitnessDensityBand,
} from './ChatAudienceHeat';

import type {
  ChatPresenceIntent,
  ChatPresenceIntensityBand,
  ChatPresenceLatencyBand,
} from './ChatPresenceStyle';

/**
 * Canonical versioning.
 */
export type ChatEmotionVersion = 1;
export const CHAT_EMOTION_VERSION: ChatEmotionVersion = 1;

/**
 * Stable emotional axes.
 * These are intentionally fixed unions so downstream feature stores and
 * orchestration rules remain durable.
 */
export const CHAT_EMOTION_AXES = [
  'INTIMIDATION',
  'CONFIDENCE',
  'FRUSTRATION',
  'CURIOSITY',
  'ATTACHMENT',
  'SOCIAL_EMBARRASSMENT',
  'RELIEF',
  'DOMINANCE',
  'DESPERATION',
  'TRUST',
] as const;

export type ChatEmotionAxis = (typeof CHAT_EMOTION_AXES)[number];

/**
 * High-level operating states that help orchestrators reason about the room.
 */
export const CHAT_EMOTION_OPERATING_STATES = [
  'UNSET',
  'COLD_START',
  'STABLE',
  'RISING',
  'SPIKED',
  'VOLATILE',
  'WOUNDED',
  'RESCUED',
  'PREDATORY',
  'CEREMONIAL',
  'AFTERMATH',
] as const;

export type ChatEmotionOperatingState =
  (typeof CHAT_EMOTION_OPERATING_STATES)[number];

/**
 * The directional movement of an emotional axis over time.
 */
export const CHAT_EMOTION_DIRECTIONS = [
  'FALLING_FAST',
  'FALLING',
  'FLAT',
  'RISING',
  'RISING_FAST',
] as const;

export type ChatEmotionDirection = (typeof CHAT_EMOTION_DIRECTIONS)[number];

/**
 * Confidence in the emotional reading itself.
 */
export const CHAT_EMOTION_CONFIDENCE_BANDS = [
  'TRACE',
  'LOW',
  'MODERATE',
  'HIGH',
  'AUTHORITATIVE',
] as const;

export type ChatEmotionConfidenceBand =
  (typeof CHAT_EMOTION_CONFIDENCE_BANDS)[number];

/**
 * Broad origin of the current emotional reading.
 */
export const CHAT_EMOTION_SOURCE_KINDS = [
  'SYSTEM',
  'PLAYER_INPUT',
  'PLAYER_ACTION',
  'NPC_MESSAGE',
  'HATER_MESSAGE',
  'HELPER_MESSAGE',
  'CROWD_REACTION',
  'DEAL_ROOM',
  'MOMENT',
  'SCENE',
  'INTERRUPTION',
  'COUNTERPLAY',
  'RESCUE',
  'LEGEND',
  'LIVEOPS',
  'WORLD_EVENT',
  'SHADOW',
  'REPLAY',
  'LEARNING',
] as const;

export type ChatEmotionSourceKind =
  (typeof CHAT_EMOTION_SOURCE_KINDS)[number];

/**
 * What primarily explains why the reading changed.
 */
export const CHAT_EMOTION_DRIVER_KINDS = [
  'NONE',
  'PERFORMANCE_SWING',
  'PRESSURE_SPIKE',
  'SHIELD_BREAK',
  'BANKRUPTCY_THREAT',
  'COMEBACK_WINDOW',
  'RESCUE_INTERVENTION',
  'RIVALRY_TAUNT',
  'HATER_STALK',
  'HELPER_PRESENCE',
  'CROWD_SWARM',
  'NEGOTIATION_STALL',
  'BLUFF_EXPOSURE',
  'COUNTERPLAY_SUCCESS',
  'COUNTERPLAY_FAILURE',
  'LEGEND_MOMENT',
  'WORLD_EVENT',
  'MODE_TRANSITION',
  'POST_RUN_RECKONING',
  'MEMORY_CALLBACK',
  'PROOF_EXPOSURE',
  'SILENCE_WINDOW',
] as const;

export type ChatEmotionDriverKind =
  (typeof CHAT_EMOTION_DRIVER_KINDS)[number];

/**
 * The gameplay decision families emotion can influence.
 */
export const CHAT_EMOTION_DECISION_KINDS = [
  'HELPER_SELECTION',
  'HELPER_TIMING',
  'HATER_ESCALATION',
  'CROWD_SWARM',
  'SILENCE_POLICY',
  'COMEBACK_SPEECH',
  'CELEBRATION_POLICY',
  'NEGOTIATION_PRESSURE',
  'RESCUE_PRIORITY',
  'POST_RUN_TONE',
  'VOICEPRINT_INTENSITY',
  'PRESENCE_THEATER',
] as const;

export type ChatEmotionDecisionKind =
  (typeof CHAT_EMOTION_DECISION_KINDS)[number];

/**
 * Stable branded identifiers.
 */
export type ChatEmotionId = Brand<string, 'ChatEmotionId'>;
export type ChatEmotionTraceId = Brand<string, 'ChatEmotionTraceId'>;
export type ChatEmotionSnapshotId = Brand<string, 'ChatEmotionSnapshotId'>;
export type ChatEmotionWindowId = Brand<string, 'ChatEmotionWindowId'>;
export type ChatEmotionDeltaId = Brand<string, 'ChatEmotionDeltaId'>;
export type ChatEmotionDriverId = Brand<string, 'ChatEmotionDriverId'>;
export type ChatEmotionDirectiveId = Brand<string, 'ChatEmotionDirectiveId'>;
export type ChatEmotionSummaryId = Brand<string, 'ChatEmotionSummaryId'>;

/**
 * Canonical scalar vector. All scores are normalized to [0, 1] in shared
 * contracts, while helpers below expose optional Score100 projections.
 */
export interface ChatEmotionVector {
  readonly intimidation: Score01;
  readonly confidence: Score01;
  readonly frustration: Score01;
  readonly curiosity: Score01;
  readonly attachment: Score01;
  readonly socialEmbarrassment: Score01;
  readonly relief: Score01;
  readonly dominance: Score01;
  readonly desperation: Score01;
  readonly trust: Score01;
}

/**
 * Axis weights for reducers, salience policies, or derived projections.
 */
export interface ChatEmotionAxisWeights {
  readonly intimidation: number;
  readonly confidence: number;
  readonly frustration: number;
  readonly curiosity: number;
  readonly attachment: number;
  readonly socialEmbarrassment: number;
  readonly relief: number;
  readonly dominance: number;
  readonly desperation: number;
  readonly trust: number;
}

/**
 * Low-level evidence explaining why the emotional state shifted.
 */
export interface ChatEmotionDriverEvidence {
  readonly driverId: ChatEmotionDriverId;
  readonly driver: ChatEmotionDriverKind;
  readonly sourceKind: ChatEmotionSourceKind;
  readonly sourceAuthority: ChatAuthority;
  readonly sourceWeight: number;
  readonly salience: Score01;
  readonly confidence: Score01;
  readonly confidenceBand: ChatEmotionConfidenceBand;
  readonly label: string;
  readonly reason: string;
  readonly channelId?: ChatChannelId;
  readonly roomId?: ChatRoomId;
  readonly mountTarget?: ChatMountTarget;
  readonly modeScope?: ChatModeScope;
  readonly actorUserId?: ChatUserId;
  readonly actorNpcId?: ChatNpcId;
  readonly sceneId?: ChatSceneId;
  readonly messageId?: ChatMessageId;
  readonly interventionId?: ChatInterventionId;
  readonly worldEventId?: ChatWorldEventId;
  readonly happenedAt: string;
  readonly metadata?: JsonObject;
}

/**
 * Emotional deltas remain explicit instead of hiding changes inside a folded
 * snapshot. This is essential for debugging and replay-linked explainability.
 */
export interface ChatEmotionDelta {
  readonly deltaId: ChatEmotionDeltaId;
  readonly traceId: ChatEmotionTraceId;
  readonly emittedAt: string;
  readonly sourceKind: ChatEmotionSourceKind;
  readonly driver: ChatEmotionDriverKind;
  readonly authority: ChatAuthority;
  readonly label: string;
  readonly reason: string;
  readonly vectorDelta: Partial<ChatEmotionVector>;
  readonly before?: ChatEmotionVector;
  readonly after?: ChatEmotionVector;
  readonly confidence: Score01;
  readonly urgency: Score01;
  readonly sticky: boolean;
  readonly hidden: boolean;
  readonly metadata?: JsonObject;
}

/**
 * Context frame for the emotional snapshot.
 */
export interface ChatEmotionContextFrame {
  readonly sessionId?: ChatSessionId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly modeScope?: ChatModeScope;
  readonly mountTarget?: ChatMountTarget;
  readonly sceneId?: ChatSceneId;
  readonly activeMessageId?: ChatMessageId;
  readonly playerUserId?: ChatUserId;
  readonly focalNpcId?: ChatNpcId;
  readonly sourceAuthority: ChatAuthority;
  readonly liveopsWorldEventId?: ChatWorldEventId;
  readonly audienceMood?: ChatAudienceMood;
  readonly audienceSeverity?: ChatAudienceHeatSeverity;
  readonly audienceSwarmRisk?: ChatAudienceSwarmRisk;
  readonly witnessDensity?: ChatAudienceWitnessDensityBand;
  readonly presenceIntent?: ChatPresenceIntent;
  readonly presenceIntensity?: ChatPresenceIntensityBand;
  readonly presenceLatency?: ChatPresenceLatencyBand;
  readonly metadata?: JsonObject;
}

/**
 * Per-axis trend information.
 */
export interface ChatEmotionAxisTrend {
  readonly axis: ChatEmotionAxis;
  readonly current: Score01;
  readonly previous?: Score01;
  readonly movingAverage: Score01;
  readonly peak: Score01;
  readonly floor: Score01;
  readonly change: number;
  readonly slope: number;
  readonly momentum: Score01;
  readonly volatility: Score01;
  readonly direction: ChatEmotionDirection;
}

/**
 * Derived projections that downstream runtimes can consume without recomputing.
 */
export interface ChatEmotionDerivedState {
  readonly dominantAxis: ChatEmotionAxis;
  readonly secondaryAxis?: ChatEmotionAxis;
  readonly confidenceBand: ChatEmotionConfidenceBand;
  readonly operatingState: ChatEmotionOperatingState;
  readonly stability: Score01;
  readonly volatility: Score01;
  readonly riskOfSpiral: Score01;
  readonly rescueNeed: Score01;
  readonly haterOpportunity: Score01;
  readonly crowdPileOnRisk: Score01;
  readonly comebackReadiness: Score01;
  readonly celebrationTolerance: Score01;
  readonly silenceSuitability: Score01;
  readonly helperUrgency: Score01;
  readonly intimidationOverConfidence: number;
  readonly frustrationOverRelief: number;
  readonly desperationOverTrust: number;
}

/**
 * Decision hints for runtime layers.
 */
export interface ChatEmotionDecisionDirective {
  readonly directiveId: ChatEmotionDirectiveId;
  readonly kind: ChatEmotionDecisionKind;
  readonly weight: Score01;
  readonly priority: Score100;
  readonly allowed: boolean;
  readonly rationale: string;
  readonly emotionAxis?: ChatEmotionAxis;
  readonly targetNpcId?: ChatNpcId;
  readonly targetUserId?: ChatUserId;
  readonly tags?: readonly string[];
  readonly metadata?: JsonObject;
}

/**
 * Focused helper projection.
 */
export interface ChatEmotionHelperDirective {
  readonly helperClass:
    | 'NONE'
    | 'CALM'
    | 'ASSERTIVE'
    | 'TACTICAL'
    | 'GENTLE'
    | 'NO-NONSENSE'
    | 'TRIAGE'
    | 'CHEER'
    | 'WITNESS';
  readonly urgency: Score01;
  readonly shouldWaitBeforeIntervening: boolean;
  readonly shouldOfferEscapeValve: boolean;
  readonly shouldLowerSocialPressure: boolean;
  readonly preferredTone:
    | 'SOFT'
    | 'STEADY'
    | 'BLUNT'
    | 'TACTICAL'
    | 'CEREMONIAL';
  readonly reason: string;
}

/**
 * Focused hater projection.
 */
export interface ChatEmotionHaterDirective {
  readonly escalation:
    | 'NONE'
    | 'PROBE'
    | 'TAUNT'
    | 'PRESS'
    | 'SWARM'
    | 'STALK'
    | 'FINISHING_MOVE';
  readonly shouldWeaponizeDelay: boolean;
  readonly shouldExploitEmbarrassment: boolean;
  readonly shouldPivotToRespect: boolean;
  readonly shouldEscalatePublicly: boolean;
  readonly reason: string;
}

/**
 * Focused crowd projection.
 */
export interface ChatEmotionCrowdDirective {
  readonly heatBoost: Score01;
  readonly ridiculeBoost: Score01;
  readonly aweBoost: Score01;
  readonly pityBoost: Score01;
  readonly predationBoost: Score01;
  readonly witnessPressureBoost: Score01;
  readonly shouldSwarm: boolean;
  readonly shouldStayQuiet: boolean;
  readonly reason: string;
}

/**
 * Focused silence / ceremony projection.
 */
export interface ChatEmotionSilenceDirective {
  readonly preferSilence: boolean;
  readonly silenceWeight: Score01;
  readonly allowComebackSpeech: boolean;
  readonly allowCelebration: boolean;
  readonly allowBreathingRoom: boolean;
  readonly reason: string;
}

/**
 * Full canonical snapshot.
 */
export interface ChatEmotionSnapshot {
  readonly version: ChatEmotionVersion;
  readonly emotionId: ChatEmotionId;
  readonly snapshotId: ChatEmotionSnapshotId;
  readonly traceId: ChatEmotionTraceId;
  readonly windowId?: ChatEmotionWindowId;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly observedAtUnixMs: UnixMs;
  readonly authority: ChatAuthority;
  readonly context: ChatEmotionContextFrame;
  readonly vector: ChatEmotionVector;
  readonly previousVector?: ChatEmotionVector;
  readonly trend: readonly ChatEmotionAxisTrend[];
  readonly drivers: readonly ChatEmotionDriverEvidence[];
  readonly deltas: readonly ChatEmotionDelta[];
  readonly derived: ChatEmotionDerivedState;
  readonly helperDirective: ChatEmotionHelperDirective;
  readonly haterDirective: ChatEmotionHaterDirective;
  readonly crowdDirective: ChatEmotionCrowdDirective;
  readonly silenceDirective: ChatEmotionSilenceDirective;
  readonly directives: readonly ChatEmotionDecisionDirective[];
  readonly notes?: readonly string[];
  readonly metadata?: JsonObject;
}

/**
 * Fold-friendly envelope for transport or replay.
 */
export interface ChatEmotionEnvelope {
  readonly snapshot: ChatEmotionSnapshot;
  readonly historyDepth: number;
  readonly retainedDriverCount: number;
  readonly retainedDeltaCount: number;
  readonly generatedBy: ChatAuthority;
  readonly emittedAt: string;
}

/**
 * UI / tooling summary.
 */
export interface ChatEmotionSummary {
  readonly summaryId: ChatEmotionSummaryId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly dominantAxis: ChatEmotionAxis;
  readonly secondaryAxis?: ChatEmotionAxis;
  readonly operatingState: ChatEmotionOperatingState;
  readonly label: string;
  readonly narrative: string;
  readonly intensityBand: ChatPresenceIntensityBand;
  readonly confidenceBand: ChatEmotionConfidenceBand;
  readonly helperUrgency: Score01;
  readonly haterOpportunity: Score01;
  readonly crowdPileOnRisk: Score01;
  readonly silenceSuitability: Score01;
  readonly celebrationTolerance: Score01;
}

/**
 * Contract manifest.
 */
export interface ChatEmotionContractManifest {
  readonly version: ChatEmotionVersion;
  readonly path: 'shared/contracts/chat/ChatEmotion.ts';
  readonly authorities: typeof CHAT_CONTRACT_AUTHORITIES;
  readonly axes: readonly ChatEmotionAxis[];
  readonly operatingStates: readonly ChatEmotionOperatingState[];
  readonly directions: readonly ChatEmotionDirection[];
  readonly confidenceBands: readonly ChatEmotionConfidenceBand[];
  readonly sourceKinds: readonly ChatEmotionSourceKind[];
  readonly driverKinds: readonly ChatEmotionDriverKind[];
  readonly decisionKinds: readonly ChatEmotionDecisionKind[];
  readonly description: string;
}

/**
 * Empty vector helpers.
 */
export const CHAT_EMPTY_EMOTION_VECTOR: ChatEmotionVector = Object.freeze({
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

export const CHAT_NEUTRAL_EMOTION_WEIGHTS: ChatEmotionAxisWeights = Object.freeze({
  intimidation: 1,
  confidence: 1,
  frustration: 1,
  curiosity: 1,
  attachment: 1,
  socialEmbarrassment: 1,
  relief: 1,
  dominance: 1,
  desperation: 1,
  trust: 1,
});

export const CHAT_EMOTION_CONTRACT_MANIFEST: ChatEmotionContractManifest =
  Object.freeze({
    version: CHAT_EMOTION_VERSION,
    path: 'shared/contracts/chat/ChatEmotion.ts',
    authorities: CHAT_CONTRACT_AUTHORITIES,
    axes: CHAT_EMOTION_AXES,
    operatingStates: CHAT_EMOTION_OPERATING_STATES,
    directions: CHAT_EMOTION_DIRECTIONS,
    confidenceBands: CHAT_EMOTION_CONFIDENCE_BANDS,
    sourceKinds: CHAT_EMOTION_SOURCE_KINDS,
    driverKinds: CHAT_EMOTION_DRIVER_KINDS,
    decisionKinds: CHAT_EMOTION_DECISION_KINDS,
    description:
      'Canonical emotional operating model for helper timing, hater escalation, crowd swarm, silence policy, comeback speeches, and celebration restraint.',
  });

/**
 * Local scalar helpers.
 */
export function clampEmotionScalar(value: number): Score01 {
  if (!Number.isFinite(value)) {
    return 0 as Score01;
  }
  if (value <= 0) {
    return 0 as Score01;
  }
  if (value >= 1) {
    return 1 as Score01;
  }
  return value as Score01;
}

export function emotionScore01To100(value: Score01): Score100 {
  return Math.round(clampEmotionScalar(value) * 100) as Score100;
}

export function score100ToEmotion01(value: number): Score01 {
  return clampEmotionScalar(value / 100);
}

/**
 * Branded id creators.
 */
function createBrandedEmotionId<T extends string>(
  prefix: string,
): Brand<string, T> {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${time}_${rand}` as Brand<string, T>;
}

export function createChatEmotionId(): ChatEmotionId {
  return createBrandedEmotionId<'ChatEmotionId'>('chat_emotion');
}

export function createChatEmotionTraceId(): ChatEmotionTraceId {
  return createBrandedEmotionId<'ChatEmotionTraceId'>('chat_emotion_trace');
}

export function createChatEmotionSnapshotId(): ChatEmotionSnapshotId {
  return createBrandedEmotionId<'ChatEmotionSnapshotId'>('chat_emotion_snapshot');
}

export function createChatEmotionWindowId(): ChatEmotionWindowId {
  return createBrandedEmotionId<'ChatEmotionWindowId'>('chat_emotion_window');
}

export function createChatEmotionDeltaId(): ChatEmotionDeltaId {
  return createBrandedEmotionId<'ChatEmotionDeltaId'>('chat_emotion_delta');
}

export function createChatEmotionDriverId(): ChatEmotionDriverId {
  return createBrandedEmotionId<'ChatEmotionDriverId'>('chat_emotion_driver');
}

export function createChatEmotionDirectiveId(): ChatEmotionDirectiveId {
  return createBrandedEmotionId<'ChatEmotionDirectiveId'>('chat_emotion_directive');
}

export function createChatEmotionSummaryId(): ChatEmotionSummaryId {
  return createBrandedEmotionId<'ChatEmotionSummaryId'>('chat_emotion_summary');
}

/**
 * Vector constructors.
 */
export function createEmptyEmotionVector(): ChatEmotionVector {
  return { ...CHAT_EMPTY_EMOTION_VECTOR };
}

export function normalizeEmotionVector(
  vector: Partial<ChatEmotionVector>,
): ChatEmotionVector {
  return {
    intimidation: clampEmotionScalar(vector.intimidation ?? 0),
    confidence: clampEmotionScalar(vector.confidence ?? 0),
    frustration: clampEmotionScalar(vector.frustration ?? 0),
    curiosity: clampEmotionScalar(vector.curiosity ?? 0),
    attachment: clampEmotionScalar(vector.attachment ?? 0),
    socialEmbarrassment: clampEmotionScalar(vector.socialEmbarrassment ?? 0),
    relief: clampEmotionScalar(vector.relief ?? 0),
    dominance: clampEmotionScalar(vector.dominance ?? 0),
    desperation: clampEmotionScalar(vector.desperation ?? 0),
    trust: clampEmotionScalar(vector.trust ?? 0),
  };
}

export function addEmotionVectors(
  left: ChatEmotionVector,
  right: Partial<ChatEmotionVector>,
): ChatEmotionVector {
  return normalizeEmotionVector({
    intimidation: left.intimidation + (right.intimidation ?? 0),
    confidence: left.confidence + (right.confidence ?? 0),
    frustration: left.frustration + (right.frustration ?? 0),
    curiosity: left.curiosity + (right.curiosity ?? 0),
    attachment: left.attachment + (right.attachment ?? 0),
    socialEmbarrassment:
      left.socialEmbarrassment + (right.socialEmbarrassment ?? 0),
    relief: left.relief + (right.relief ?? 0),
    dominance: left.dominance + (right.dominance ?? 0),
    desperation: left.desperation + (right.desperation ?? 0),
    trust: left.trust + (right.trust ?? 0),
  });
}

export function subtractEmotionVectors(
  left: ChatEmotionVector,
  right: Partial<ChatEmotionVector>,
): ChatEmotionVector {
  return normalizeEmotionVector({
    intimidation: left.intimidation - (right.intimidation ?? 0),
    confidence: left.confidence - (right.confidence ?? 0),
    frustration: left.frustration - (right.frustration ?? 0),
    curiosity: left.curiosity - (right.curiosity ?? 0),
    attachment: left.attachment - (right.attachment ?? 0),
    socialEmbarrassment:
      left.socialEmbarrassment - (right.socialEmbarrassment ?? 0),
    relief: left.relief - (right.relief ?? 0),
    dominance: left.dominance - (right.dominance ?? 0),
    desperation: left.desperation - (right.desperation ?? 0),
    trust: left.trust - (right.trust ?? 0),
  });
}

export function scaleEmotionVector(
  vector: ChatEmotionVector,
  scale: number,
): ChatEmotionVector {
  return normalizeEmotionVector({
    intimidation: vector.intimidation * scale,
    confidence: vector.confidence * scale,
    frustration: vector.frustration * scale,
    curiosity: vector.curiosity * scale,
    attachment: vector.attachment * scale,
    socialEmbarrassment: vector.socialEmbarrassment * scale,
    relief: vector.relief * scale,
    dominance: vector.dominance * scale,
    desperation: vector.desperation * scale,
    trust: vector.trust * scale,
  });
}

export function blendEmotionVectors(
  base: ChatEmotionVector,
  overlay: ChatEmotionVector,
  mix: number,
): ChatEmotionVector {
  const clampedMix = clampEmotionScalar(mix);
  const inverse = 1 - clampedMix;
  return normalizeEmotionVector({
    intimidation: base.intimidation * inverse + overlay.intimidation * clampedMix,
    confidence: base.confidence * inverse + overlay.confidence * clampedMix,
    frustration: base.frustration * inverse + overlay.frustration * clampedMix,
    curiosity: base.curiosity * inverse + overlay.curiosity * clampedMix,
    attachment: base.attachment * inverse + overlay.attachment * clampedMix,
    socialEmbarrassment:
      base.socialEmbarrassment * inverse +
      overlay.socialEmbarrassment * clampedMix,
    relief: base.relief * inverse + overlay.relief * clampedMix,
    dominance: base.dominance * inverse + overlay.dominance * clampedMix,
    desperation: base.desperation * inverse + overlay.desperation * clampedMix,
    trust: base.trust * inverse + overlay.trust * clampedMix,
  });
}

/**
 * Axis addressing helpers.
 */
export function getEmotionAxisValue(
  vector: ChatEmotionVector,
  axis: ChatEmotionAxis,
): Score01 {
  switch (axis) {
    case 'INTIMIDATION':
      return vector.intimidation;
    case 'CONFIDENCE':
      return vector.confidence;
    case 'FRUSTRATION':
      return vector.frustration;
    case 'CURIOSITY':
      return vector.curiosity;
    case 'ATTACHMENT':
      return vector.attachment;
    case 'SOCIAL_EMBARRASSMENT':
      return vector.socialEmbarrassment;
    case 'RELIEF':
      return vector.relief;
    case 'DOMINANCE':
      return vector.dominance;
    case 'DESPERATION':
      return vector.desperation;
    case 'TRUST':
      return vector.trust;
  }
}

export function setEmotionAxisValue(
  vector: ChatEmotionVector,
  axis: ChatEmotionAxis,
  value: number,
): ChatEmotionVector {
  const nextValue = clampEmotionScalar(value);
  switch (axis) {
    case 'INTIMIDATION':
      return { ...vector, intimidation: nextValue };
    case 'CONFIDENCE':
      return { ...vector, confidence: nextValue };
    case 'FRUSTRATION':
      return { ...vector, frustration: nextValue };
    case 'CURIOSITY':
      return { ...vector, curiosity: nextValue };
    case 'ATTACHMENT':
      return { ...vector, attachment: nextValue };
    case 'SOCIAL_EMBARRASSMENT':
      return { ...vector, socialEmbarrassment: nextValue };
    case 'RELIEF':
      return { ...vector, relief: nextValue };
    case 'DOMINANCE':
      return { ...vector, dominance: nextValue };
    case 'DESPERATION':
      return { ...vector, desperation: nextValue };
    case 'TRUST':
      return { ...vector, trust: nextValue };
  }
}

export function listEmotionAxisEntries(
  vector: ChatEmotionVector,
): readonly Readonly<{ axis: ChatEmotionAxis; value: Score01 }>[] {
  return CHAT_EMOTION_AXES.map((axis) => ({
    axis,
    value: getEmotionAxisValue(vector, axis),
  }));
}

export function sortEmotionAxesByIntensity(
  vector: ChatEmotionVector,
): readonly Readonly<{ axis: ChatEmotionAxis; value: Score01 }>[] {
  return [...listEmotionAxisEntries(vector)].sort((a, b) => b.value - a.value);
}

export function getDominantEmotionAxis(
  vector: ChatEmotionVector,
): ChatEmotionAxis {
  return sortEmotionAxesByIntensity(vector)[0]?.axis ?? 'CONFIDENCE';
}

export function getSecondaryEmotionAxis(
  vector: ChatEmotionVector,
): Optional<ChatEmotionAxis> {
  return sortEmotionAxesByIntensity(vector)[1]?.axis as Optional<ChatEmotionAxis>;
}

export function sumEmotionIntensity(vector: ChatEmotionVector): Score01 {
  const total =
    vector.intimidation +
    vector.confidence +
    vector.frustration +
    vector.curiosity +
    vector.attachment +
    vector.socialEmbarrassment +
    vector.relief +
    vector.dominance +
    vector.desperation +
    vector.trust;
  return clampEmotionScalar(total / CHAT_EMOTION_AXES.length);
}

export function computeEmotionVolatility(
  current: ChatEmotionVector,
  previous?: ChatEmotionVector,
): Score01 {
  if (!previous) {
    return 0 as Score01;
  }
  const diffs = CHAT_EMOTION_AXES.map((axis) =>
    Math.abs(getEmotionAxisValue(current, axis) - getEmotionAxisValue(previous, axis)),
  );
  const average = diffs.reduce((sum, item) => sum + item, 0) / diffs.length;
  return clampEmotionScalar(average);
}

export function computeEmotionStability(
  current: ChatEmotionVector,
  previous?: ChatEmotionVector,
): Score01 {
  return clampEmotionScalar(1 - computeEmotionVolatility(current, previous));
}

export function computeEmotionDirection(
  previousValue: number | undefined,
  currentValue: number,
): ChatEmotionDirection {
  const previous = previousValue ?? currentValue;
  const diff = currentValue - previous;
  if (diff >= 0.18) {
    return 'RISING_FAST';
  }
  if (diff >= 0.05) {
    return 'RISING';
  }
  if (diff <= -0.18) {
    return 'FALLING_FAST';
  }
  if (diff <= -0.05) {
    return 'FALLING';
  }
  return 'FLAT';
}

export function computeEmotionConfidenceBand(value: number): ChatEmotionConfidenceBand {
  if (value >= 0.9) {
    return 'AUTHORITATIVE';
  }
  if (value >= 0.7) {
    return 'HIGH';
  }
  if (value >= 0.45) {
    return 'MODERATE';
  }
  if (value >= 0.2) {
    return 'LOW';
  }
  return 'TRACE';
}

export function computeEmotionPresenceIntensityBand(
  vector: ChatEmotionVector,
): ChatPresenceIntensityBand {
  const value = sumEmotionIntensity(vector);
  if (value >= 0.9) {
    return 'OVERWHELMING';
  }
  if (value >= 0.72) {
    return 'SEVERE';
  }
  if (value >= 0.52) {
    return 'HIGH';
  }
  if (value >= 0.3) {
    return 'MEDIUM';
  }
  if (value >= 0.12) {
    return 'LOW';
  }
  return 'MUTED';
}

export function computeEmotionOperatingState(
  vector: ChatEmotionVector,
  previous?: ChatEmotionVector,
): ChatEmotionOperatingState {
  const dominant = getDominantEmotionAxis(vector);
  const volatility = computeEmotionVolatility(vector, previous);
  const intensity = sumEmotionIntensity(vector);

  if (intensity <= 0.02) {
    return 'UNSET';
  }
  if (!previous) {
    return 'COLD_START';
  }
  if (vector.relief >= 0.72 && vector.frustration <= 0.25) {
    return 'RESCUED';
  }
  if (
    vector.intimidation >= 0.72 ||
    vector.desperation >= 0.72 ||
    vector.socialEmbarrassment >= 0.72
  ) {
    return 'WOUNDED';
  }
  if (vector.dominance >= 0.72 && vector.confidence >= 0.62) {
    return 'PREDATORY';
  }
  if (dominant === 'RELIEF' && intensity >= 0.55) {
    return 'CEREMONIAL';
  }
  if (volatility >= 0.55) {
    return 'VOLATILE';
  }
  if (volatility >= 0.3) {
    return 'SPIKED';
  }
  if (computeEmotionDirection(sumEmotionIntensity(previous), intensity) === 'RISING') {
    return 'RISING';
  }
  return 'STABLE';
}

export function buildEmotionAxisTrend(
  axis: ChatEmotionAxis,
  current: ChatEmotionVector,
  previous?: ChatEmotionVector,
): ChatEmotionAxisTrend {
  const currentValue = getEmotionAxisValue(current, axis);
  const previousValue = previous ? getEmotionAxisValue(previous, axis) : undefined;
  const movingAverage = clampEmotionScalar(
    previousValue == null ? currentValue : (currentValue + previousValue) / 2,
  );
  const peak = clampEmotionScalar(Math.max(currentValue, previousValue ?? 0));
  const floor = clampEmotionScalar(Math.min(currentValue, previousValue ?? currentValue));
  const change = currentValue - (previousValue ?? currentValue);
  const slope = change;
  return {
    axis,
    current: currentValue,
    previous: previousValue,
    movingAverage,
    peak,
    floor,
    change,
    slope,
    momentum: clampEmotionScalar(Math.abs(change)),
    volatility: clampEmotionScalar(Math.abs(change)),
    direction: computeEmotionDirection(previousValue, currentValue),
  };
}

export function buildEmotionTrendSet(
  current: ChatEmotionVector,
  previous?: ChatEmotionVector,
): readonly ChatEmotionAxisTrend[] {
  return CHAT_EMOTION_AXES.map((axis) =>
    buildEmotionAxisTrend(axis, current, previous),
  );
}

/**
 * Derived heuristics.
 */
export function computeEmotionRescueNeed(vector: ChatEmotionVector): Score01 {
  return clampEmotionScalar(
    vector.frustration * 0.28 +
      vector.desperation * 0.3 +
      vector.socialEmbarrassment * 0.22 +
      vector.intimidation * 0.14 -
      vector.relief * 0.12 -
      vector.trust * 0.1,
  );
}

export function computeEmotionHaterOpportunity(vector: ChatEmotionVector): Score01 {
  return clampEmotionScalar(
    vector.intimidation * 0.18 +
      vector.frustration * 0.22 +
      vector.socialEmbarrassment * 0.24 +
      vector.desperation * 0.18 -
      vector.relief * 0.08 -
      vector.trust * 0.08 +
      vector.curiosity * 0.04,
  );
}

export function computeEmotionCrowdPileOnRisk(vector: ChatEmotionVector): Score01 {
  return clampEmotionScalar(
    vector.socialEmbarrassment * 0.32 +
      vector.frustration * 0.2 +
      vector.desperation * 0.14 +
      vector.intimidation * 0.1 +
      vector.dominance * 0.08 -
      vector.relief * 0.06 -
      vector.trust * 0.08,
  );
}

export function computeEmotionComebackReadiness(vector: ChatEmotionVector): Score01 {
  return clampEmotionScalar(
    vector.confidence * 0.34 +
      vector.curiosity * 0.16 +
      vector.trust * 0.14 +
      vector.relief * 0.08 +
      vector.dominance * 0.18 -
      vector.desperation * 0.08 -
      vector.socialEmbarrassment * 0.08,
  );
}

export function computeEmotionCelebrationTolerance(vector: ChatEmotionVector): Score01 {
  return clampEmotionScalar(
    vector.relief * 0.25 +
      vector.confidence * 0.22 +
      vector.trust * 0.14 +
      vector.dominance * 0.08 -
      vector.frustration * 0.12 -
      vector.desperation * 0.08 -
      vector.socialEmbarrassment * 0.12,
  );
}

export function computeEmotionSilenceSuitability(vector: ChatEmotionVector): Score01 {
  return clampEmotionScalar(
    vector.socialEmbarrassment * 0.22 +
      vector.intimidation * 0.16 +
      vector.desperation * 0.15 +
      vector.attachment * 0.07 -
      vector.curiosity * 0.1 -
      vector.confidence * 0.08 -
      vector.relief * 0.08 +
      vector.frustration * 0.06,
  );
}

export function computeEmotionHelperUrgency(vector: ChatEmotionVector): Score01 {
  return clampEmotionScalar(
    computeEmotionRescueNeed(vector) * 0.55 +
      vector.trust * 0.08 +
      vector.attachment * 0.09 +
      vector.frustration * 0.14 +
      vector.desperation * 0.14,
  );
}

export function computeEmotionDerivedState(
  vector: ChatEmotionVector,
  previous?: ChatEmotionVector,
): ChatEmotionDerivedState {
  const dominantAxis = getDominantEmotionAxis(vector);
  const secondaryAxis = getSecondaryEmotionAxis(vector);
  const stability = computeEmotionStability(vector, previous);
  const volatility = computeEmotionVolatility(vector, previous);
  return {
    dominantAxis,
    secondaryAxis,
    confidenceBand: computeEmotionConfidenceBand(sumEmotionIntensity(vector)),
    operatingState: computeEmotionOperatingState(vector, previous),
    stability,
    volatility,
    riskOfSpiral: clampEmotionScalar(
      vector.frustration * 0.22 +
        vector.socialEmbarrassment * 0.26 +
        vector.desperation * 0.26 +
        vector.intimidation * 0.14 -
        vector.relief * 0.08 -
        vector.trust * 0.08,
    ),
    rescueNeed: computeEmotionRescueNeed(vector),
    haterOpportunity: computeEmotionHaterOpportunity(vector),
    crowdPileOnRisk: computeEmotionCrowdPileOnRisk(vector),
    comebackReadiness: computeEmotionComebackReadiness(vector),
    celebrationTolerance: computeEmotionCelebrationTolerance(vector),
    silenceSuitability: computeEmotionSilenceSuitability(vector),
    helperUrgency: computeEmotionHelperUrgency(vector),
    intimidationOverConfidence:
      vector.intimidation - vector.confidence,
    frustrationOverRelief:
      vector.frustration - vector.relief,
    desperationOverTrust:
      vector.desperation - vector.trust,
  };
}

/**
 * Directive projection helpers.
 */
export function projectEmotionHelperDirective(
  vector: ChatEmotionVector,
): ChatEmotionHelperDirective {
  const urgency = computeEmotionHelperUrgency(vector);
  if (urgency < 0.12) {
    return {
      helperClass: 'NONE',
      urgency,
      shouldWaitBeforeIntervening: true,
      shouldOfferEscapeValve: false,
      shouldLowerSocialPressure: false,
      preferredTone: 'STEADY',
      reason: 'Emotion stack does not currently justify helper intrusion.',
    };
  }
  if (vector.socialEmbarrassment >= 0.62) {
    return {
      helperClass: 'GENTLE',
      urgency,
      shouldWaitBeforeIntervening: true,
      shouldOfferEscapeValve: true,
      shouldLowerSocialPressure: true,
      preferredTone: 'SOFT',
      reason: 'High embarrassment calls for privacy-protective, non-public rescue.',
    };
  }
  if (vector.desperation >= 0.68 || vector.frustration >= 0.7) {
    return {
      helperClass: 'TRIAGE',
      urgency,
      shouldWaitBeforeIntervening: false,
      shouldOfferEscapeValve: true,
      shouldLowerSocialPressure: true,
      preferredTone: 'TACTICAL',
      reason: 'Collapse pressure is high enough to justify fast rescue triage.',
    };
  }
  if (vector.intimidation >= 0.64 && vector.confidence <= 0.4) {
    return {
      helperClass: 'ASSERTIVE',
      urgency,
      shouldWaitBeforeIntervening: false,
      shouldOfferEscapeValve: false,
      shouldLowerSocialPressure: false,
      preferredTone: 'BLUNT',
      reason: 'Player needs structure more than softness under intimidation load.',
    };
  }
  if (vector.relief >= 0.65 || vector.confidence >= 0.65) {
    return {
      helperClass: 'CHEER',
      urgency,
      shouldWaitBeforeIntervening: true,
      shouldOfferEscapeValve: false,
      shouldLowerSocialPressure: false,
      preferredTone: 'CEREMONIAL',
      reason: 'Positive swing supports witness-oriented helper reinforcement.',
    };
  }
  return {
    helperClass: 'TACTICAL',
    urgency,
    shouldWaitBeforeIntervening: false,
    shouldOfferEscapeValve: false,
    shouldLowerSocialPressure: false,
    preferredTone: 'TACTICAL',
    reason: 'Default tactical helper posture for mixed-pressure emotional state.',
  };
}

export function projectEmotionHaterDirective(
  vector: ChatEmotionVector,
): ChatEmotionHaterDirective {
  const opportunity = computeEmotionHaterOpportunity(vector);
  if (opportunity < 0.12) {
    return {
      escalation: 'NONE',
      shouldWeaponizeDelay: false,
      shouldExploitEmbarrassment: false,
      shouldPivotToRespect: vector.confidence >= 0.72,
      shouldEscalatePublicly: false,
      reason: 'Current state does not reward escalation.',
    };
  }
  if (vector.socialEmbarrassment >= 0.72) {
    return {
      escalation: 'PRESS',
      shouldWeaponizeDelay: true,
      shouldExploitEmbarrassment: true,
      shouldPivotToRespect: false,
      shouldEscalatePublicly: true,
      reason: 'Embarrassment spike invites public pressure tactics.',
    };
  }
  if (vector.desperation >= 0.74 || vector.frustration >= 0.78) {
    return {
      escalation: 'FINISHING_MOVE',
      shouldWeaponizeDelay: false,
      shouldExploitEmbarrassment: true,
      shouldPivotToRespect: false,
      shouldEscalatePublicly: true,
      reason: 'Desperation / frustration stack indicates collapse window.',
    };
  }
  if (vector.confidence >= 0.7 && vector.dominance >= 0.66) {
    return {
      escalation: 'PROBE',
      shouldWeaponizeDelay: true,
      shouldExploitEmbarrassment: false,
      shouldPivotToRespect: true,
      shouldEscalatePublicly: false,
      reason: 'Strong player state calls for stalking or respect-testing, not blind swarming.',
    };
  }
  return {
    escalation: 'TAUNT',
    shouldWeaponizeDelay: vector.intimidation >= 0.52,
    shouldExploitEmbarrassment: vector.socialEmbarrassment >= 0.48,
    shouldPivotToRespect: false,
    shouldEscalatePublicly: vector.frustration >= 0.5,
    reason: 'Mixed hostile opportunity favors taunt-stage escalation.',
  };
}

export function projectEmotionCrowdDirective(
  vector: ChatEmotionVector,
): ChatEmotionCrowdDirective {
  const pileOn = computeEmotionCrowdPileOnRisk(vector);
  const awe = clampEmotionScalar(
    vector.confidence * 0.26 + vector.dominance * 0.24 + vector.relief * 0.12,
  );
  const pity = clampEmotionScalar(
    vector.desperation * 0.18 + vector.frustration * 0.14 + vector.attachment * 0.16,
  );
  return {
    heatBoost: pileOn,
    ridiculeBoost: clampEmotionScalar(
      vector.socialEmbarrassment * 0.45 + vector.frustration * 0.18,
    ),
    aweBoost: awe,
    pityBoost: pity,
    predationBoost: clampEmotionScalar(
      vector.desperation * 0.26 + vector.intimidation * 0.12 + vector.socialEmbarrassment * 0.22,
    ),
    witnessPressureBoost: clampEmotionScalar(
      pileOn * 0.5 + awe * 0.3 + pity * 0.2,
    ),
    shouldSwarm: pileOn >= 0.52,
    shouldStayQuiet: computeEmotionSilenceSuitability(vector) >= 0.62,
    reason:
      pileOn >= 0.52
        ? 'Crowd has enough emotional leverage to pile on.'
        : 'Crowd pressure should remain low or ambient.',
  };
}

export function projectEmotionSilenceDirective(
  vector: ChatEmotionVector,
): ChatEmotionSilenceDirective {
  const silenceWeight = computeEmotionSilenceSuitability(vector);
  return {
    preferSilence: silenceWeight >= 0.56,
    silenceWeight,
    allowComebackSpeech: computeEmotionComebackReadiness(vector) >= 0.58,
    allowCelebration: computeEmotionCelebrationTolerance(vector) >= 0.62,
    allowBreathingRoom:
      silenceWeight >= 0.48 ||
      vector.socialEmbarrassment >= 0.58 ||
      vector.desperation >= 0.64,
    reason:
      silenceWeight >= 0.56
        ? 'Silence protects the emotional moment better than immediate commentary.'
        : 'Current emotional state can tolerate directed commentary.',
  };
}

export function buildEmotionDecisionDirectives(
  vector: ChatEmotionVector,
): readonly ChatEmotionDecisionDirective[] {
  const helper = projectEmotionHelperDirective(vector);
  const hater = projectEmotionHaterDirective(vector);
  const crowd = projectEmotionCrowdDirective(vector);
  const silence = projectEmotionSilenceDirective(vector);

  return Object.freeze<readonly ChatEmotionDecisionDirective[]>([
    {
      directiveId: createChatEmotionDirectiveId(),
      kind: 'HELPER_SELECTION',
      weight: helper.urgency,
      priority: emotionScore01To100(helper.urgency),
      allowed: helper.helperClass !== 'NONE',
      rationale: helper.reason,
      emotionAxis: getDominantEmotionAxis(vector),
      tags: Object.freeze(['helper', helper.helperClass.toLowerCase()]),
    },
    {
      directiveId: createChatEmotionDirectiveId(),
      kind: 'HATER_ESCALATION',
      weight: computeEmotionHaterOpportunity(vector),
      priority: emotionScore01To100(computeEmotionHaterOpportunity(vector)),
      allowed: hater.escalation !== 'NONE',
      rationale: hater.reason,
      emotionAxis:
        vector.socialEmbarrassment >= vector.frustration
          ? 'SOCIAL_EMBARRASSMENT'
          : 'FRUSTRATION',
      tags: Object.freeze(['hater', hater.escalation.toLowerCase()]),
    },
    {
      directiveId: createChatEmotionDirectiveId(),
      kind: 'CROWD_SWARM',
      weight: crowd.heatBoost,
      priority: emotionScore01To100(crowd.heatBoost),
      allowed: crowd.shouldSwarm,
      rationale: crowd.reason,
      emotionAxis: 'SOCIAL_EMBARRASSMENT',
      tags: Object.freeze(['crowd']),
    },
    {
      directiveId: createChatEmotionDirectiveId(),
      kind: 'SILENCE_POLICY',
      weight: silence.silenceWeight,
      priority: emotionScore01To100(silence.silenceWeight),
      allowed: silence.preferSilence,
      rationale: silence.reason,
      emotionAxis:
        vector.socialEmbarrassment >= vector.desperation
          ? 'SOCIAL_EMBARRASSMENT'
          : 'DESPERATION',
      tags: Object.freeze(['silence']),
    },
    {
      directiveId: createChatEmotionDirectiveId(),
      kind: 'COME BACK_SPEECH'.replace(' ', '') as ChatEmotionDecisionKind,
      weight: computeEmotionComebackReadiness(vector),
      priority: emotionScore01To100(computeEmotionComebackReadiness(vector)),
      allowed: silence.allowComebackSpeech,
      rationale:
        silence.allowComebackSpeech
          ? 'Confidence / trust stack supports authored comeback rhetoric.'
          : 'Current emotion profile does not justify comeback ceremony yet.',
      emotionAxis: 'CONFIDENCE',
      tags: Object.freeze(['comeback']),
    },
    {
      directiveId: createChatEmotionDirectiveId(),
      kind: 'CELEBRATION_POLICY',
      weight: computeEmotionCelebrationTolerance(vector),
      priority: emotionScore01To100(computeEmotionCelebrationTolerance(vector)),
      allowed: silence.allowCelebration,
      rationale:
        silence.allowCelebration
          ? 'Relief and confidence permit celebration.'
          : 'Player should breathe before the system celebrates.',
      emotionAxis: 'RELIEF',
      tags: Object.freeze(['celebration']),
    },
  ]);
}

export function createEmotionDelta(
  input: Omit<ChatEmotionDelta, 'deltaId'> & Partial<Pick<ChatEmotionDelta, 'deltaId'>>,
): ChatEmotionDelta {
  return {
    deltaId: input.deltaId ?? createChatEmotionDeltaId(),
    traceId: input.traceId,
    emittedAt: input.emittedAt,
    sourceKind: input.sourceKind,
    driver: input.driver,
    authority: input.authority,
    label: input.label,
    reason: input.reason,
    vectorDelta: normalizeEmotionVector(input.vectorDelta),
    before: input.before ? normalizeEmotionVector(input.before) : undefined,
    after: input.after ? normalizeEmotionVector(input.after) : undefined,
    confidence: clampEmotionScalar(input.confidence),
    urgency: clampEmotionScalar(input.urgency),
    sticky: Boolean(input.sticky),
    hidden: Boolean(input.hidden),
    metadata: input.metadata,
  };
}

export function foldEmotionDelta(
  vector: ChatEmotionVector,
  delta: ChatEmotionDelta,
): ChatEmotionVector {
  return addEmotionVectors(vector, delta.vectorDelta);
}

export function foldEmotionDeltas(
  seed: ChatEmotionVector,
  deltas: readonly ChatEmotionDelta[],
): ChatEmotionVector {
  return deltas.reduce((acc, delta) => foldEmotionDelta(acc, delta), seed);
}

export function createEmotionContextFrame(
  input: ChatEmotionContextFrame,
): ChatEmotionContextFrame {
  return {
    ...input,
    sourceAuthority: input.sourceAuthority,
  };
}

export function createEmotionSnapshot(
  input: {
    readonly context: ChatEmotionContextFrame;
    readonly vector: Partial<ChatEmotionVector>;
    readonly previousVector?: Partial<ChatEmotionVector>;
    readonly drivers?: readonly ChatEmotionDriverEvidence[];
    readonly deltas?: readonly ChatEmotionDelta[];
    readonly notes?: readonly string[];
    readonly metadata?: JsonObject;
    readonly observedAtUnixMs?: UnixMs;
    readonly createdAt?: string;
    readonly updatedAt?: string;
    readonly authority?: ChatAuthority;
    readonly emotionId?: ChatEmotionId;
    readonly snapshotId?: ChatEmotionSnapshotId;
    readonly traceId?: ChatEmotionTraceId;
    readonly windowId?: ChatEmotionWindowId;
  },
): ChatEmotionSnapshot {
  const nowIso = input.updatedAt ?? new Date().toISOString();
  const createdAt = input.createdAt ?? nowIso;
  const vector = normalizeEmotionVector(input.vector);
  const previousVector = input.previousVector
    ? normalizeEmotionVector(input.previousVector)
    : undefined;
  const derived = computeEmotionDerivedState(vector, previousVector);
  return {
    version: CHAT_EMOTION_VERSION,
    emotionId: input.emotionId ?? createChatEmotionId(),
    snapshotId: input.snapshotId ?? createChatEmotionSnapshotId(),
    traceId: input.traceId ?? createChatEmotionTraceId(),
    windowId: input.windowId,
    createdAt,
    updatedAt: nowIso,
    observedAtUnixMs:
      input.observedAtUnixMs ?? (Date.now() as UnixMs),
    authority: input.authority ?? input.context.sourceAuthority,
    context: createEmotionContextFrame(input.context),
    vector,
    previousVector,
    trend: buildEmotionTrendSet(vector, previousVector),
    drivers: Object.freeze([...(input.drivers ?? [])]),
    deltas: Object.freeze([...(input.deltas ?? [])]),
    derived,
    helperDirective: projectEmotionHelperDirective(vector),
    haterDirective: projectEmotionHaterDirective(vector),
    crowdDirective: projectEmotionCrowdDirective(vector),
    silenceDirective: projectEmotionSilenceDirective(vector),
    directives: buildEmotionDecisionDirectives(vector),
    notes: input.notes ? Object.freeze([...input.notes]) : undefined,
    metadata: input.metadata,
  };
}

export function createEmotionEnvelope(
  snapshot: ChatEmotionSnapshot,
): ChatEmotionEnvelope {
  return {
    snapshot,
    historyDepth: snapshot.trend.length,
    retainedDriverCount: snapshot.drivers.length,
    retainedDeltaCount: snapshot.deltas.length,
    generatedBy: snapshot.authority,
    emittedAt: snapshot.updatedAt,
  };
}

export function summarizeEmotionSnapshot(
  snapshot: ChatEmotionSnapshot,
): ChatEmotionSummary {
  const intensityBand = computeEmotionPresenceIntensityBand(snapshot.vector);
  const label =
    snapshot.derived.operatingState === 'RESCUED'
      ? 'Rescue window stabilized'
      : snapshot.derived.operatingState === 'WOUNDED'
      ? 'Pressure wound remains open'
      : snapshot.derived.operatingState === 'PREDATORY'
      ? 'Predatory momentum detected'
      : `${snapshot.derived.dominantAxis.toLowerCase().replace(/_/g, ' ')} leads`;
  const narrative = [
    `dominant=${snapshot.derived.dominantAxis}`,
    snapshot.derived.secondaryAxis
      ? `secondary=${snapshot.derived.secondaryAxis}`
      : null,
    `state=${snapshot.derived.operatingState}`,
    `helperUrgency=${emotionScore01To100(snapshot.derived.helperUrgency)}`,
    `haterOpportunity=${emotionScore01To100(snapshot.derived.haterOpportunity)}`,
    `silence=${emotionScore01To100(snapshot.derived.silenceSuitability)}`,
  ]
    .filter(Boolean)
    .join(' | ');

  return {
    summaryId: createChatEmotionSummaryId(),
    roomId: snapshot.context.roomId,
    channelId: snapshot.context.channelId,
    dominantAxis: snapshot.derived.dominantAxis,
    secondaryAxis: snapshot.derived.secondaryAxis,
    operatingState: snapshot.derived.operatingState,
    label,
    narrative,
    intensityBand,
    confidenceBand: snapshot.derived.confidenceBand,
    helperUrgency: snapshot.derived.helperUrgency,
    haterOpportunity: snapshot.derived.haterOpportunity,
    crowdPileOnRisk: snapshot.derived.crowdPileOnRisk,
    silenceSuitability: snapshot.derived.silenceSuitability,
    celebrationTolerance: snapshot.derived.celebrationTolerance,
  };
}

/**
 * Readable projections used by multiple runtimes.
 */
export function shouldPreferSilenceForEmotion(
  vector: ChatEmotionVector,
): boolean {
  return projectEmotionSilenceDirective(vector).preferSilence;
}

export function shouldFireComebackSpeechForEmotion(
  vector: ChatEmotionVector,
): boolean {
  return projectEmotionSilenceDirective(vector).allowComebackSpeech;
}

export function shouldCelebrateEmotionState(
  vector: ChatEmotionVector,
): boolean {
  return projectEmotionSilenceDirective(vector).allowCelebration;
}

export function shouldLetPlayerBreathe(
  vector: ChatEmotionVector,
): boolean {
  return projectEmotionSilenceDirective(vector).allowBreathingRoom;
}

export function mapEmotionAxisToAudienceDriver(
  axis: ChatEmotionAxis,
): ChatAudienceHeatDriver {
  switch (axis) {
    case 'INTIMIDATION':
      return 'THREAT';
    case 'CONFIDENCE':
      return 'PERFORMANCE';
    case 'FRUSTRATION':
      return 'COLLAPSE';
    case 'CURIOSITY':
      return 'WITNESSING';
    case 'ATTACHMENT':
      return 'RESCUE';
    case 'SOCIAL_EMBARRASSMENT':
      return 'SHAME';
    case 'RELIEF':
      return 'RESCUE';
    case 'DOMINANCE':
      return 'DOMINANCE';
    case 'DESPERATION':
      return 'THREAT';
    case 'TRUST':
      return 'RESCUE';
  }
}

export function projectEmotionToAudienceSeverity(
  vector: ChatEmotionVector,
): ChatAudienceHeatSeverity {
  const heat = clampEmotionScalar(
    vector.socialEmbarrassment * 0.22 +
      vector.frustration * 0.18 +
      vector.desperation * 0.14 +
      vector.intimidation * 0.14 +
      vector.dominance * 0.1 +
      vector.confidence * 0.08 +
      vector.relief * 0.06 +
      vector.attachment * 0.04 +
      vector.curiosity * 0.02 +
      vector.trust * 0.02,
  );
  if (heat >= 0.88) {
    return 'EXTREME';
  }
  if (heat >= 0.68) {
    return 'SEVERE';
  }
  if (heat >= 0.45) {
    return 'HOT';
  }
  if (heat >= 0.22) {
    return 'WARM';
  }
  return 'COLD';
}

export function projectEmotionToAudienceMood(
  vector: ChatEmotionVector,
): ChatAudienceMood {
  if (vector.socialEmbarrassment >= 0.72 || vector.frustration >= 0.72) {
    return 'MOCKING';
  }
  if (vector.desperation >= 0.74 || vector.intimidation >= 0.74) {
    return 'PANICKED';
  }
  if (vector.dominance >= 0.72 && vector.confidence >= 0.62) {
    return 'MERCILESS';
  }
  if (vector.relief >= 0.72 && vector.confidence >= 0.58) {
    return 'CELEBRATORY';
  }
  if (vector.curiosity >= 0.58) {
    return 'CURIOUS';
  }
  if (vector.trust >= 0.6 || vector.attachment >= 0.58) {
    return 'WATCHFUL';
  }
  if (sumEmotionIntensity(vector) <= 0.12) {
    return 'QUIET';
  }
  return 'TENSE';
}

/**
 * Audit-oriented debug helpers.
 */
export function describeEmotionVector(
  vector: ChatEmotionVector,
): string {
  return sortEmotionAxesByIntensity(vector)
    .map(({ axis, value }) => `${axis}:${emotionScore01To100(value)}`)
    .join(', ');
}

export function buildEmotionDebugNotes(
  snapshot: ChatEmotionSnapshot,
): readonly string[] {
  return Object.freeze([
    `dominant=${snapshot.derived.dominantAxis}`,
    `secondary=${snapshot.derived.secondaryAxis ?? 'NONE'}`,
    `state=${snapshot.derived.operatingState}`,
    `helper=${snapshot.helperDirective.helperClass}`,
    `hater=${snapshot.haterDirective.escalation}`,
    `crowdSwarm=${snapshot.crowdDirective.shouldSwarm ? 'YES' : 'NO'}`,
    `preferSilence=${snapshot.silenceDirective.preferSilence ? 'YES' : 'NO'}`,
    `vector=${describeEmotionVector(snapshot.vector)}`,
  ]);
}

export const CHAT_EMOTION_EXPORT_NAMES = Object.freeze([
  'CHAT_EMOTION_VERSION',
  'CHAT_EMOTION_AXES',
  'CHAT_EMOTION_OPERATING_STATES',
  'CHAT_EMOTION_DIRECTIONS',
  'CHAT_EMOTION_CONFIDENCE_BANDS',
  'CHAT_EMOTION_SOURCE_KINDS',
  'CHAT_EMOTION_DRIVER_KINDS',
  'CHAT_EMOTION_DECISION_KINDS',
  'CHAT_EMPTY_EMOTION_VECTOR',
  'CHAT_NEUTRAL_EMOTION_WEIGHTS',
  'CHAT_EMOTION_CONTRACT_MANIFEST',
  'clampEmotionScalar',
  'emotionScore01To100',
  'score100ToEmotion01',
  'createChatEmotionId',
  'createChatEmotionTraceId',
  'createChatEmotionSnapshotId',
  'createChatEmotionWindowId',
  'createChatEmotionDeltaId',
  'createChatEmotionDriverId',
  'createChatEmotionDirectiveId',
  'createChatEmotionSummaryId',
  'createEmptyEmotionVector',
  'normalizeEmotionVector',
  'addEmotionVectors',
  'subtractEmotionVectors',
  'scaleEmotionVector',
  'blendEmotionVectors',
  'getEmotionAxisValue',
  'setEmotionAxisValue',
  'listEmotionAxisEntries',
  'sortEmotionAxesByIntensity',
  'getDominantEmotionAxis',
  'getSecondaryEmotionAxis',
  'sumEmotionIntensity',
  'computeEmotionVolatility',
  'computeEmotionStability',
  'computeEmotionDirection',
  'computeEmotionConfidenceBand',
  'computeEmotionPresenceIntensityBand',
  'computeEmotionOperatingState',
  'buildEmotionAxisTrend',
  'buildEmotionTrendSet',
  'computeEmotionRescueNeed',
  'computeEmotionHaterOpportunity',
  'computeEmotionCrowdPileOnRisk',
  'computeEmotionComebackReadiness',
  'computeEmotionCelebrationTolerance',
  'computeEmotionSilenceSuitability',
  'computeEmotionHelperUrgency',
  'computeEmotionDerivedState',
  'projectEmotionHelperDirective',
  'projectEmotionHaterDirective',
  'projectEmotionCrowdDirective',
  'projectEmotionSilenceDirective',
  'buildEmotionDecisionDirectives',
  'createEmotionDelta',
  'foldEmotionDelta',
  'foldEmotionDeltas',
  'createEmotionContextFrame',
  'createEmotionSnapshot',
  'createEmotionEnvelope',
  'summarizeEmotionSnapshot',
  'shouldPreferSilenceForEmotion',
  'shouldFireComebackSpeechForEmotion',
  'shouldCelebrateEmotionState',
  'shouldLetPlayerBreathe',
  'mapEmotionAxisToAudienceDriver',
  'projectEmotionToAudienceSeverity',
  'projectEmotionToAudienceMood',
  'describeEmotionVector',
  'buildEmotionDebugNotes',
] as const);

/**
 * Module-level descriptor aligned with the existing shared contract barrel style.
 */
export const CHAT_EMOTION_CONTRACT_DESCRIPTOR = Object.freeze({
  version: CHAT_EMOTION_VERSION,
  fileName: 'ChatEmotion.ts',
  path: 'shared/contracts/chat/ChatEmotion.ts',
  authorities: CHAT_CONTRACT_AUTHORITIES,
  exportNames: CHAT_EMOTION_EXPORT_NAMES,
  usesAuthorities: [
    CHAT_AUTHORITIES.shared,
    CHAT_AUTHORITIES.frontend,
    CHAT_AUTHORITIES.backend,
    CHAT_AUTHORITIES.server,
  ] as const,
  description:
    'Emotion scoring law for intimidation, confidence, frustration, curiosity, attachment, embarrassment, relief, dominance, desperation, and trust.',
});
