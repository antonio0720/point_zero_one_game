/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT LEARNING EVENT CONTRACTS
 * FILE: shared/contracts/chat/learning/LearningEvents.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared learning-event vocabulary for the unified chat intelligence
 * lane. This file exists to stop frontend donor logic, backend learning state,
 * and server transport side-effects from inventing parallel schemas.
 *
 * This contract is the shared event authority used by:
 *   - /shared/contracts/chat/learning
 *   - /pzo-web/src/engines/chat/intelligence
 *   - /backend/src/game/engine/chat/intelligence
 *   - /pzo-server/src/chat
 *
 * Design laws
 * -----------
 * 1. Learning events must be derived from authoritative chat truth, not from
 *    UI assumptions that were never accepted by backend policy.
 * 2. The frontend may stage hints, optimism, and provisional feature snapshots,
 *    but the backend decides which learning facts survive.
 * 3. Every learning event must carry enough causality to join transcript,
 *    proof, telemetry, moderation, invasion, replay, and ranking artifacts.
 * 4. Learning events must remain transport-safe and import-safe so they can be
 *    consumed by client, backend, server, analytics, and training tooling.
 * 5. The event vocabulary must preserve the repo’s chat doctrine: chat is not
 *    just messaging. It is social pressure, rescue timing, memory, proof, and
 *    psychological combat.
 *
 * Operating doctrine
 * ------------------
 * These contracts deliberately split raw observations from durable profile
 * updates. A `LearningEventRecord` is the atomic fact. Downstream systems may
 * turn those facts into feature windows, labels, ranking observations,
 * embeddings, anchors, profile mutations, drift checks, and replay-linked
 * evaluations, but they should not invent their own event identity.
 * ============================================================================
 */

import {
  type Brand,
  type ChatChannelId,
  type ChatModeScope,
  type ChatMountTarget,
  type ChatRoomId,
  type JsonObject,
  type JsonValue,
  type Optional,
  type Score01,
  type Score100,
  type UnixMs,
  CHAT_CONTRACT_AUTHORITIES,
  CHAT_CONTRACT_VERSION,
} from '../ChatChannels';

import {
  type ChatActorKind,
  type ChatInterventionId,
  type ChatLegendId,
  type ChatMemoryAnchorId,
  type ChatMessageId,
  type ChatMomentId,
  type ChatNpcId,
  type ChatOfferId,
  type ChatProofHash,
  type ChatQuoteId,
  type ChatRange,
  type ChatReplayId,
  type ChatRequestId,
  type ChatSceneId,
  type ChatSequenceNumber,
  type ChatSessionId,
  type ChatTelemetryId,
  type ChatUserId,
  type ChatWorldEventId,
  CHAT_ACTOR_KINDS,
} from '../ChatChannels';

import {
  type ChatAuthority,
  type ChatMessageKind,
  type ChatSenderIdentity,
  CHAT_AUTHORITIES,
  CHAT_MESSAGE_KINDS,
} from '../ChatEvents';

import {
  type ChatMessageAckPolicy,
  type ChatMessageBodyFormat,
  type ChatMessageOriginSurface,
  type ChatMessageProofState,
  type ChatMessageRecord,
  type ChatMessageToneBand,
  type ChatMessageVisibilityClass,
  type ChatThreadId,
} from '../ChatMessage';

import {
  type ChatModerationDecision,
  type ChatModerationRecord,
  type ChatModerationSeverityBand,
  type ChatModerationState,
} from '../ChatModeration';

import {
  type ChatInvasionClass,
  type ChatInvasionId,
  type ChatInvasionKind,
  type ChatInvasionOutcomeRecord,
  type ChatInvasionStage,
  type ChatInvasionTriggerKind,
} from '../ChatInvasion';

import {
  type ChatProofBundle,
  type ChatProofConflictRecord,
  type ChatProofEdgeId,
  type ChatProofEdgeKind,
  type ChatProofHashEnvelope,
  type ChatProofNodeId,
  type ChatProofSubjectKind,
  type ChatProofVerificationRecord,
} from '../ChatProof';

import {
  type ChatTelemetryDimensionValue,
  type ChatTelemetryExportReceipt,
  type ChatTelemetryFactRecord,
  type ChatTelemetryMetricValue,
  type ChatTelemetryRecord,
} from '../ChatTelemetry';

import {
  type ChatTranscriptAnchorId,
  type ChatTranscriptDiffId,
  type ChatTranscriptExcerptId,
  type ChatTranscriptPointer,
  type ChatTranscriptSlice,
  type ChatTranscriptSnapshot,
} from '../ChatTranscript';

// ============================================================================
// MARK: Branded identifiers local to learning events
// ============================================================================

export type LearningEventId = Brand<string, 'LearningEventId'>;
export type LearningBatchId = Brand<string, 'LearningBatchId'>;
export type LearningEventCursor = Brand<string, 'LearningEventCursor'>;
export type LearningFeatureId = Brand<string, 'LearningFeatureId'>;
export type LearningFeatureWindowId = Brand<string, 'LearningFeatureWindowId'>;
export type LearningFeatureVectorId = Brand<string, 'LearningFeatureVectorId'>;
export type LearningObservationId = Brand<string, 'LearningObservationId'>;
export type LearningLabelId = Brand<string, 'LearningLabelId'>;
export type LearningLabelSetId = Brand<string, 'LearningLabelSetId'>;
export type LearningOutcomeId = Brand<string, 'LearningOutcomeId'>;
export type LearningPolicyId = Brand<string, 'LearningPolicyId'>;
export type LearningPolicyRunId = Brand<string, 'LearningPolicyRunId'>;
export type LearningProfileId = Brand<string, 'LearningProfileId'>;
export type LearningRoomProfileId = Brand<string, 'LearningRoomProfileId'>;
export type LearningAnchorId = Brand<string, 'LearningAnchorId'>;
export type LearningAnchorBundleId = Brand<string, 'LearningAnchorBundleId'>;
export type LearningEmbeddingId = Brand<string, 'LearningEmbeddingId'>;
export type LearningEmbeddingSpaceId = Brand<string, 'LearningEmbeddingSpaceId'>;
export type LearningMemorySpanId = Brand<string, 'LearningMemorySpanId'>;
export type LearningDriftRunId = Brand<string, 'LearningDriftRunId'>;
export type LearningEvaluationRunId = Brand<string, 'LearningEvaluationRunId'>;
export type LearningRankingObservationId = Brand<string, 'LearningRankingObservationId'>;
export type LearningInterventionDecisionId = Brand<string, 'LearningInterventionDecisionId'>;
export type LearningTrainingExampleId = Brand<string, 'LearningTrainingExampleId'>;
export type LearningExportId = Brand<string, 'LearningExportId'>;
export type LearningQueryId = Brand<string, 'LearningQueryId'>;
export type LearningConsentId = Brand<string, 'LearningConsentId'>;
export type LearningRetentionKey = Brand<string, 'LearningRetentionKey'>;
export type LearningColdStartId = Brand<string, 'LearningColdStartId'>;
export type LearningModelSnapshotId = Brand<string, 'LearningModelSnapshotId'>;
export type LearningFeatureName = Brand<string, 'LearningFeatureName'>;
export type LearningDenseIndex = Brand<number, 'LearningDenseIndex'>;

// ============================================================================
// MARK: Core vocabularies
// ============================================================================

export const LEARNING_EVENT_KINDS = [
  'CHAT_OPENED',
  'CHAT_CLOSED',
  'MESSAGE_DRAFTED',
  'MESSAGE_SUBMITTED',
  'MESSAGE_ACCEPTED',
  'MESSAGE_REJECTED',
  'MESSAGE_REDRAFTED',
  'MESSAGE_READ',
  'MESSAGE_REACTED',
  'MESSAGE_QUOTED',
  'MESSAGE_RECALLED',
  'CHANNEL_SWITCHED',
  'PRESENCE_CHANGED',
  'TYPING_STARTED',
  'TYPING_STOPPED',
  'NPC_MESSAGE_EMITTED',
  'HELPER_INTERVENTION',
  'HATER_ESCALATION',
  'INVASION_TRIGGERED',
  'INVASION_ESCALATED',
  'INVASION_RESOLVED',
  'NEGOTIATION_OFFER_SUBMITTED',
  'NEGOTIATION_COUNTER_RECEIVED',
  'NEGOTIATION_COLLAPSED',
  'PROOF_ATTACHED',
  'PROOF_CONFLICTED',
  'MODERATION_APPLIED',
  'RESCUE_TRIGGERED',
  'RESCUE_RESOLVED',
  'CHURN_WARNING',
  'RANKING_DECISION_LOGGED',
  'MEMORY_ANCHOR_WRITTEN',
  'MEMORY_ANCHOR_RETRIEVED',
  'REPLAY_REVIEWED',
  'WORLD_EVENT_LINKED',
  'LEGEND_MOMENT_CAPTURED',
  'PROFILE_MUTATION_APPLIED',
  'DRIFT_FLAGGED',
  'EVALUATION_RECORDED',
] as const;

export type LearningEventKind = (typeof LEARNING_EVENT_KINDS)[number];

export const LEARNING_EVENT_SOURCES = [
  'CLIENT_CHAT_ENGINE',
  'CLIENT_INTELLIGENCE',
  'SERVER_GATEWAY',
  'SERVER_FANOUT',
  'BACKEND_CHAT_ENGINE',
  'BACKEND_ORCHESTRATOR',
  'BACKEND_MODERATION',
  'BACKEND_REPLAY',
  'BACKEND_TELEMETRY',
  'BACKEND_LEARNING',
  'OFFLINE_TRAINING',
  'OFFLINE_EVALUATION',
] as const;

export type LearningEventSource = (typeof LEARNING_EVENT_SOURCES)[number];

export const LEARNING_SUBJECT_KINDS = [
  'PLAYER',
  'ROOM',
  'NPC',
  'CHANNEL',
  'MESSAGE',
  'THREAD',
  'SCENE',
  'INVASION',
  'NEGOTIATION',
  'GLOBAL',
] as const;

export type LearningSubjectKind = (typeof LEARNING_SUBJECT_KINDS)[number];

export const LEARNING_FACT_STATUSES = [
  'STAGED',
  'OBSERVED',
  'ACCEPTED',
  'AUTHORITATIVE',
  'MUTATED',
  'REDACTED',
  'DROPPED',
] as const;

export type LearningFactStatus = (typeof LEARNING_FACT_STATUSES)[number];

export const LEARNING_FEATURE_VALUE_KINDS = [
  'BOOLEAN',
  'COUNT',
  'DURATION_MS',
  'FLOAT',
  'PERCENTILE',
  'CATEGORY',
  'VECTOR',
  'TEXT',
  'ENUM',
] as const;

export type LearningFeatureValueKind =
  (typeof LEARNING_FEATURE_VALUE_KINDS)[number];

export const LEARNING_LABEL_KINDS = [
  'ENGAGEMENT_OUTCOME',
  'CHURN_OUTCOME',
  'HELPER_EFFECTIVENESS',
  'HATER_EFFECTIVENESS',
  'NEGOTIATION_OUTCOME',
  'MODERATION_OUTCOME',
  'CHANNEL_AFFINITY',
  'MEMORY_SALIENCE',
  'EMOTION_SHIFT',
  'RANKING_WINNER',
  'DRIFT_DECISION',
] as const;

export type LearningLabelKind = (typeof LEARNING_LABEL_KINDS)[number];

export const LEARNING_LABEL_CONFIDENCE_BANDS = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'AUTHORITATIVE',
] as const;

export type LearningLabelConfidenceBand =
  (typeof LEARNING_LABEL_CONFIDENCE_BANDS)[number];

export const LEARNING_DATA_SPLITS = [
  'ONLINE',
  'TRAIN',
  'VALIDATION',
  'TEST',
  'REPLAY',
  'CALIBRATION',
] as const;

export type LearningDataSplit = (typeof LEARNING_DATA_SPLITS)[number];

export const LEARNING_INTERVENTION_OUTCOMES = [
  'UNKNOWN',
  'HELPED',
  'IGNORED',
  'REJECTED',
  'ESCALATED',
  'DE_ESCALATED',
  'CHURN_PREVENTED',
  'CHURN_NOT_PREVENTED',
] as const;

export type LearningInterventionOutcome =
  (typeof LEARNING_INTERVENTION_OUTCOMES)[number];

export const LEARNING_COLD_START_BASES = [
  'NONE',
  'GLOBAL_POPULATION',
  'MODE_POPULATION',
  'CHANNEL_POPULATION',
  'ROOM_CLUSTER',
  'SIMILAR_PLAYER',
  'TRUSTED_SEED',
] as const;

export type LearningColdStartBasis =
  (typeof LEARNING_COLD_START_BASES)[number];

export const LEARNING_MODEL_FAMILIES = [
  'RULES',
  'HEURISTIC_ML',
  'ONLINE_ML',
  'SEQUENCE_DL',
  'EMBEDDING',
  'RETRIEVAL',
  'RANKING',
  'CALIBRATION',
] as const;

export type LearningModelFamily = (typeof LEARNING_MODEL_FAMILIES)[number];

export const LEARNING_PRIVACY_MODES = [
  'FULL',
  'HASHED_TEXT',
  'EMBEDDINGS_ONLY',
  'LABELS_ONLY',
  'AGGREGATES_ONLY',
  'DISABLED',
] as const;

export type LearningPrivacyMode = (typeof LEARNING_PRIVACY_MODES)[number];

export const LEARNING_RETENTION_CLASSES = [
  'EPHEMERAL',
  'SESSION',
  'SHORT_TERM',
  'STANDARD',
  'LONG_TERM',
  'IMMUTABLE_AUDIT',
] as const;

export type LearningRetentionClass =
  (typeof LEARNING_RETENTION_CLASSES)[number];

export const LEARNING_UPDATE_MODES = [
  'NONE',
  'APPEND_ONLY',
  'UPSERT',
  'DECAY_AND_UPSERT',
  'SNAPSHOT_REPLACE',
] as const;

export type LearningUpdateMode = (typeof LEARNING_UPDATE_MODES)[number];

export const LEARNING_DRIFT_STATUSES = [
  'NONE',
  'WATCH',
  'WARNING',
  'CRITICAL',
  'ROLLED_BACK',
] as const;

export type LearningDriftStatus = (typeof LEARNING_DRIFT_STATUSES)[number];

export const LEARNING_EVALUATION_VERDICTS = [
  'UNKNOWN',
  'PASS',
  'SOFT_FAIL',
  'FAIL',
  'ROLLBACK_RECOMMENDED',
] as const;

export type LearningEvaluationVerdict =
  (typeof LEARNING_EVALUATION_VERDICTS)[number];

export const LEARNING_RANKING_SOURCES = [
  'HELPER_RESPONSE',
  'HATER_RESPONSE',
  'NPC_AMBIENT',
  'CHANNEL_RECOMMENDATION',
  'DEALROOM_COUNTER',
  'RESCUE_PROMPT',
  'POST_RUN_SUMMARY',
] as const;

export type LearningRankingSource = (typeof LEARNING_RANKING_SOURCES)[number];

export const LEARNING_MEMORY_ANCHOR_KINDS = [
  'QUOTE',
  'BOAST',
  'FAILURE',
  'COMEBACK',
  'HELPER_SAVE',
  'NEGOTIATION_BLUFF',
  'LEGEND_MOMENT',
  'INVASION_WOUND',
  'SOCIAL_SHAME',
  'TRUST_SHIFT',
] as const;

export type LearningMemoryAnchorKind =
  (typeof LEARNING_MEMORY_ANCHOR_KINDS)[number];

export const LEARNING_CONSENT_STATES = [
  'UNKNOWN',
  'GRANTED',
  'LIMITED',
  'REVOKED',
] as const;

export type LearningConsentState = (typeof LEARNING_CONSENT_STATES)[number];

export const LEARNING_EMBEDDING_SOURCE_KINDS = [
  'MESSAGE_BODY',
  'MESSAGE_THREAD',
  'TRANSCRIPT_SLICE',
  'SCENE_CONTEXT',
  'NEGOTIATION_CONTEXT',
  'POST_RUN_CONTEXT',
  'PROFILE_SUMMARY',
] as const;

export type LearningEmbeddingSourceKind =
  (typeof LEARNING_EMBEDDING_SOURCE_KINDS)[number];

// ============================================================================
// MARK: Shared supporting shapes
// ============================================================================

export interface LearningObservationWindow {
  readonly startedAtMs: UnixMs;
  readonly endedAtMs: UnixMs;
  readonly durationMs: number;
  readonly sequenceStart?: ChatSequenceNumber;
  readonly sequenceEnd?: ChatSequenceNumber;
  readonly transcriptRange?: ChatRange;
}

export interface LearningEventCausality {
  readonly requestId?: ChatRequestId;
  readonly parentEventId?: LearningEventId;
  readonly causalMessageId?: ChatMessageId;
  readonly causalThreadId?: ChatThreadId;
  readonly causalSceneId?: ChatSceneId;
  readonly causalMomentId?: ChatMomentId;
  readonly causalQuoteId?: ChatQuoteId;
  readonly causalAnchorId?: ChatMemoryAnchorId | LearningAnchorId;
  readonly proofHash?: ChatProofHash;
  readonly proofEdgeId?: ChatProofEdgeId;
  readonly telemetryId?: ChatTelemetryId;
  readonly replayId?: ChatReplayId;
  readonly transcriptAnchorId?: ChatTranscriptAnchorId;
  readonly moderationDecisionId?: string;
}

export interface LearningSubjectRef {
  readonly subjectKind: LearningSubjectKind;
  readonly playerId?: ChatUserId;
  readonly roomId?: ChatRoomId;
  readonly npcId?: ChatNpcId;
  readonly channelId?: ChatChannelId;
  readonly messageId?: ChatMessageId;
  readonly threadId?: ChatThreadId;
  readonly sceneId?: ChatSceneId;
  readonly invasionId?: ChatInvasionId;
  readonly offerId?: ChatOfferId;
}

export interface LearningSourceRef {
  readonly eventSource: LearningEventSource;
  readonly authority: ChatAuthority;
  readonly mountTarget?: ChatMountTarget;
  readonly modeScope?: ChatModeScope;
  readonly roomId?: ChatRoomId;
  readonly channelId?: ChatChannelId;
  readonly actorKind?: ChatActorKind;
  readonly actorId?: string;
  readonly senderIdentity?: ChatSenderIdentity;
}

export interface LearningModelRef {
  readonly modelFamily: LearningModelFamily;
  readonly modelName: string;
  readonly modelVersion: string;
  readonly policyId?: LearningPolicyId;
  readonly snapshotId?: LearningModelSnapshotId;
  readonly calibrationVersion?: string;
}

export interface LearningPrivacyEnvelope {
  readonly consentState: LearningConsentState;
  readonly privacyMode: LearningPrivacyMode;
  readonly retentionClass: LearningRetentionClass;
  readonly retentionKey?: LearningRetentionKey;
  readonly textHashed: boolean;
  readonly embeddingsAllowed: boolean;
  readonly labelsAllowed: boolean;
}

export interface LearningFeatureValue {
  readonly kind: LearningFeatureValueKind;
  readonly booleanValue?: boolean;
  readonly countValue?: number;
  readonly durationMsValue?: number;
  readonly floatValue?: number;
  readonly percentileValue?: Score01;
  readonly categoryValue?: string;
  readonly vectorValue?: readonly number[];
  readonly textValue?: string;
  readonly enumValue?: string;
}

export interface LearningDenseFeature {
  readonly index: LearningDenseIndex;
  readonly name: LearningFeatureName;
  readonly value: number;
}

export interface LearningSparseFeature {
  readonly name: LearningFeatureName;
  readonly value: LearningFeatureValue;
}

export interface LearningFeatureBag {
  readonly featureVectorId: LearningFeatureVectorId;
  readonly window: LearningObservationWindow;
  readonly split: LearningDataSplit;
  readonly dense: readonly LearningDenseFeature[];
  readonly sparse: readonly LearningSparseFeature[];
  readonly dimensions?: Readonly<Record<string, ChatTelemetryDimensionValue>>;
  readonly metrics?: Readonly<Record<string, ChatTelemetryMetricValue>>;
}

export interface LearningLabel {
  readonly labelId: LearningLabelId;
  readonly labelKind: LearningLabelKind;
  readonly value: string;
  readonly score01?: Score01;
  readonly score100?: Score100;
  readonly confidenceBand: LearningLabelConfidenceBand;
  readonly authority: ChatAuthority;
  readonly assignedAtMs: UnixMs;
  readonly note?: string;
}

export interface LearningAnchorDescriptor {
  readonly anchorId: LearningAnchorId;
  readonly anchorKind: LearningMemoryAnchorKind;
  readonly title: string;
  readonly salienceScore: Score01;
  readonly createdAtMs: UnixMs;
  readonly lastTouchedAtMs: UnixMs;
  readonly sourceMessageId?: ChatMessageId;
  readonly quoteId?: ChatQuoteId;
  readonly transcriptExcerptId?: ChatTranscriptExcerptId;
  readonly replayId?: ChatReplayId;
  readonly invasionId?: ChatInvasionId;
  readonly legendId?: ChatLegendId;
}

export interface LearningEmbeddingRecord {
  readonly embeddingId: LearningEmbeddingId;
  readonly spaceId: LearningEmbeddingSpaceId;
  readonly sourceKind: LearningEmbeddingSourceKind;
  readonly sourceId: string;
  readonly dimensions: number;
  readonly createdAtMs: UnixMs;
  readonly privacyMode: LearningPrivacyMode;
  readonly vector?: readonly number[];
}

export interface LearningRankingCandidate {
  readonly candidateId: string;
  readonly source: LearningRankingSource;
  readonly messageKind?: ChatMessageKind;
  readonly toneBand?: ChatMessageToneBand;
  readonly proofState?: ChatMessageProofState;
  readonly originSurface?: ChatMessageOriginSurface;
  readonly score01: Score01;
  readonly accepted: boolean;
  readonly explanation?: string;
}

export interface LearningRankingObservation {
  readonly rankingObservationId: LearningRankingObservationId;
  readonly source: LearningRankingSource;
  readonly decidedAtMs: UnixMs;
  readonly chosenCandidateId: string;
  readonly candidates: readonly LearningRankingCandidate[];
  readonly model?: LearningModelRef;
  readonly contextAnchorIds?: readonly LearningAnchorId[];
}

// ============================================================================
// MARK: Event payload map
// ============================================================================

export interface LearningChatOpenedPayload {
  readonly openReason: 'AUTO_MOUNT' | 'USER_OPEN' | 'SYSTEM_OPEN' | 'RESCUE_OPEN';
  readonly coldStartBasis: LearningColdStartBasis;
  readonly roomId?: ChatRoomId;
  readonly channelId?: ChatChannelId;
  readonly mountTarget?: ChatMountTarget;
  readonly modeScope?: ChatModeScope;
  readonly roomOccupancyEstimate?: number;
}

export interface LearningChatClosedPayload {
  readonly closeReason: 'USER_CLOSE' | 'AUTO_COLLAPSE' | 'MODE_TRANSITION' | 'DISCONNECT';
  readonly openDurationMs: number;
  readonly unreadCount?: number;
  readonly draftedButUnsentCount?: number;
}

export interface LearningMessageDraftedPayload {
  readonly draftId: string;
  readonly bodyFormat: ChatMessageBodyFormat;
  readonly visibilityClass: ChatMessageVisibilityClass;
  readonly ackPolicy: ChatMessageAckPolicy;
  readonly characterCount: number;
  readonly wordCount: number;
  readonly containsCommand: boolean;
  readonly containsQuote: boolean;
  readonly containsAttachment: boolean;
}

export interface LearningMessageSubmittedPayload {
  readonly messageId?: ChatMessageId;
  readonly threadId?: ChatThreadId;
  readonly draftId?: string;
  readonly messageKind: ChatMessageKind;
  readonly bodyFormat: ChatMessageBodyFormat;
  readonly originSurface: ChatMessageOriginSurface;
  readonly visibilityClass: ChatMessageVisibilityClass;
  readonly toneBand?: ChatMessageToneBand;
  readonly characterCount: number;
  readonly wordCount: number;
  readonly channelId: ChatChannelId;
  readonly roomId?: ChatRoomId;
}

export interface LearningMessageAcceptedPayload {
  readonly messageRecord: Pick<
    ChatMessageRecord,
    | 'messageId'
    | 'threadId'
    | 'sequenceNumber'
    | 'kind'
    | 'visibilityClass'
    | 'bodyFormat'
    | 'deliveryState'
    | 'proofState'
    | 'channelId'
    | 'roomId'
    | 'createdAtMs'
  >;
  readonly transcriptSlice?: Pick<ChatTranscriptSlice, 'sliceId' | 'messageIds' | 'sequenceRange'>;
}

export interface LearningMessageRejectedPayload {
  readonly attemptedMessageId?: ChatMessageId;
  readonly rejectionReason:
    | 'RATE_LIMIT'
    | 'MODERATION'
    | 'CHANNEL_DENIED'
    | 'ROOM_LOCK'
    | 'OFFLINE'
    | 'UNKNOWN';
  readonly moderationState?: ChatModerationState;
  readonly moderationDecision?: ChatModerationDecision;
  readonly retryable: boolean;
}

export interface LearningMessageReadPayload {
  readonly messageId: ChatMessageId;
  readonly readLatencyMs?: number;
  readonly readerCountDelta?: number;
  readonly actorReadRole: 'AUTHOR' | 'PEER' | 'HELPER' | 'HATER' | 'SYSTEM';
}

export interface LearningMessageReactedPayload {
  readonly messageId: ChatMessageId;
  readonly reactionKey: string;
  readonly added: boolean;
  readonly totalCountAfter?: number;
}

export interface LearningMessageQuotedPayload {
  readonly messageId: ChatMessageId;
  readonly quoteId: ChatQuoteId;
  readonly quotedMessageId: ChatMessageId;
  readonly callbackAnchorId?: LearningAnchorId;
}

export interface LearningMessageRecalledPayload {
  readonly messageId: ChatMessageId;
  readonly recalledMessageId: ChatMessageId;
  readonly callbackAnchorId?: LearningAnchorId;
  readonly sourceAnchorId?: LearningAnchorId;
}

export interface LearningChannelSwitchedPayload {
  readonly fromChannelId?: ChatChannelId;
  readonly toChannelId: ChatChannelId;
  readonly reason:
    | 'USER_TAB'
    | 'MODE_POLICY'
    | 'RESCUE_ROUTING'
    | 'INVASION_ROUTING'
    | 'NEGOTIATION_ROUTING'
    | 'HELPER_ROUTING';
  readonly latencySincePreviousMs?: number;
}

export interface LearningPresenceChangedPayload {
  readonly previousState?: string;
  readonly nextState: string;
  readonly actorKind: ChatActorKind;
  readonly roomId?: ChatRoomId;
  readonly channelId?: ChatChannelId;
  readonly visible: boolean;
}

export interface LearningTypingStatePayload {
  readonly typingState: 'STARTED' | 'STOPPED';
  readonly theaterKind?: string;
  readonly estimatedDurationMs?: number;
  readonly actorKind: ChatActorKind;
}

export interface LearningNpcMessagePayload {
  readonly npcId: ChatNpcId;
  readonly messageId?: ChatMessageId;
  readonly messageKind: ChatMessageKind;
  readonly toneBand?: ChatMessageToneBand;
  readonly channelId: ChatChannelId;
  readonly helperLike: boolean;
  readonly haterLike: boolean;
}

export interface LearningHelperInterventionPayload {
  readonly interventionId: ChatInterventionId;
  readonly helperNpcId?: ChatNpcId;
  readonly reason:
    | 'CONFIDENCE_DROP'
    | 'FRUSTRATION_SPIKE'
    | 'CHURN_WARNING'
    | 'ROOM_PRESSURE'
    | 'NEGOTIATION_RISK'
    | 'POST_RUN_DEBRIEF';
  readonly outcome?: LearningInterventionOutcome;
  readonly messageId?: ChatMessageId;
}

export interface LearningHaterEscalationPayload {
  readonly escalationReason:
    | 'PLAYER_BOAST'
    | 'PLAYER_WEAKNESS'
    | 'SHIELD_BREAK'
    | 'TIME_PRESSURE'
    | 'SOCIAL_SWARM'
    | 'NEGOTIATION_BLOOD';
  readonly haterNpcId?: ChatNpcId;
  readonly stage?: ChatInvasionStage;
  readonly messageId?: ChatMessageId;
}

export interface LearningInvasionPayload {
  readonly invasionId: ChatInvasionId;
  readonly invasionKind: ChatInvasionKind;
  readonly invasionClass: ChatInvasionClass;
  readonly triggerKind?: ChatInvasionTriggerKind;
  readonly stage?: ChatInvasionStage;
  readonly roomId?: ChatRoomId;
  readonly channelId?: ChatChannelId;
}

export interface LearningNegotiationPayload {
  readonly offerId: ChatOfferId;
  readonly side: 'PLAYER' | 'COUNTERPART';
  readonly action: 'SUBMIT' | 'COUNTER' | 'ACCEPT' | 'DECLINE' | 'STALL';
  readonly aggressive: boolean;
  readonly urgent: boolean;
  readonly bluffScore01?: Score01;
}

export interface LearningProofPayload {
  readonly proofHash?: ChatProofHash;
  readonly proofBundle?: Pick<ChatProofBundle, 'bundleId' | 'subjectKind' | 'createdAtMs'>;
  readonly verification?: Pick<ChatProofVerificationRecord, 'verificationId' | 'status' | 'verifiedAtMs'>;
  readonly conflict?: Pick<ChatProofConflictRecord, 'conflictId' | 'severityBand' | 'status'>;
}

export interface LearningModerationPayload {
  readonly moderationState: ChatModerationState;
  readonly severityBand?: ChatModerationSeverityBand;
  readonly decision: ChatModerationDecision;
  readonly record?: Pick<ChatModerationRecord, 'moderationId' | 'messageId' | 'state' | 'decision'>;
}

export interface LearningRescuePayload {
  readonly interventionId?: ChatInterventionId;
  readonly rescueReason:
    | 'SILENCE_AFTER_COLLAPSE'
    | 'RAPID_FAILURES'
    | 'PANEL_CHURN'
    | 'NEGATIVE_SIGNAL_CLUSTER'
    | 'NEGOTIATION_SHOCK';
  readonly outcome?: LearningInterventionOutcome;
}

export interface LearningChurnWarningPayload {
  readonly churnRiskScore01: Score01;
  readonly confidenceBand: LearningLabelConfidenceBand;
  readonly triggeredRescue: boolean;
}

export interface LearningRankingDecisionPayload {
  readonly observation: LearningRankingObservation;
}

export interface LearningMemoryAnchorPayload {
  readonly anchor: LearningAnchorDescriptor;
  readonly action: 'WRITE' | 'TOUCH' | 'RETRIEVE' | 'DECAY' | 'ARCHIVE';
}

export interface LearningReplayReviewedPayload {
  readonly replayId: ChatReplayId;
  readonly reviewReason: 'POST_RUN' | 'QA' | 'TRAINING' | 'PLAYER_REVIEW';
  readonly transcriptPointers?: readonly Pick<ChatTranscriptPointer, 'pointerId' | 'messageId'>[];
}

export interface LearningWorldEventLinkedPayload {
  readonly worldEventId: ChatWorldEventId;
  readonly messageId?: ChatMessageId;
  readonly anchorId?: LearningAnchorId;
}

export interface LearningLegendMomentPayload {
  readonly legendId: ChatLegendId;
  readonly title: string;
  readonly replayId?: ChatReplayId;
  readonly anchorId?: LearningAnchorId;
}

export interface LearningProfileMutationPayload {
  readonly profileId?: LearningProfileId;
  readonly roomProfileId?: LearningRoomProfileId;
  readonly updateMode: LearningUpdateMode;
  readonly fields: readonly string[];
}

export interface LearningDriftPayload {
  readonly driftRunId: LearningDriftRunId;
  readonly status: LearningDriftStatus;
  readonly metricName: string;
  readonly observedValue: number;
  readonly expectedValue: number;
}

export interface LearningEvaluationPayload {
  readonly evaluationRunId: LearningEvaluationRunId;
  readonly verdict: LearningEvaluationVerdict;
  readonly metricName: string;
  readonly metricValue: number;
  readonly threshold?: number;
}

export interface LearningEventPayloadMap {
  readonly CHAT_OPENED: LearningChatOpenedPayload;
  readonly CHAT_CLOSED: LearningChatClosedPayload;
  readonly MESSAGE_DRAFTED: LearningMessageDraftedPayload;
  readonly MESSAGE_SUBMITTED: LearningMessageSubmittedPayload;
  readonly MESSAGE_ACCEPTED: LearningMessageAcceptedPayload;
  readonly MESSAGE_REJECTED: LearningMessageRejectedPayload;
  readonly MESSAGE_REDRAFTED: LearningMessageDraftedPayload;
  readonly MESSAGE_READ: LearningMessageReadPayload;
  readonly MESSAGE_REACTED: LearningMessageReactedPayload;
  readonly MESSAGE_QUOTED: LearningMessageQuotedPayload;
  readonly MESSAGE_RECALLED: LearningMessageRecalledPayload;
  readonly CHANNEL_SWITCHED: LearningChannelSwitchedPayload;
  readonly PRESENCE_CHANGED: LearningPresenceChangedPayload;
  readonly TYPING_STARTED: LearningTypingStatePayload;
  readonly TYPING_STOPPED: LearningTypingStatePayload;
  readonly NPC_MESSAGE_EMITTED: LearningNpcMessagePayload;
  readonly HELPER_INTERVENTION: LearningHelperInterventionPayload;
  readonly HATER_ESCALATION: LearningHaterEscalationPayload;
  readonly INVASION_TRIGGERED: LearningInvasionPayload;
  readonly INVASION_ESCALATED: LearningInvasionPayload;
  readonly INVASION_RESOLVED: LearningInvasionPayload;
  readonly NEGOTIATION_OFFER_SUBMITTED: LearningNegotiationPayload;
  readonly NEGOTIATION_COUNTER_RECEIVED: LearningNegotiationPayload;
  readonly NEGOTIATION_COLLAPSED: LearningNegotiationPayload;
  readonly PROOF_ATTACHED: LearningProofPayload;
  readonly PROOF_CONFLICTED: LearningProofPayload;
  readonly MODERATION_APPLIED: LearningModerationPayload;
  readonly RESCUE_TRIGGERED: LearningRescuePayload;
  readonly RESCUE_RESOLVED: LearningRescuePayload;
  readonly CHURN_WARNING: LearningChurnWarningPayload;
  readonly RANKING_DECISION_LOGGED: LearningRankingDecisionPayload;
  readonly MEMORY_ANCHOR_WRITTEN: LearningMemoryAnchorPayload;
  readonly MEMORY_ANCHOR_RETRIEVED: LearningMemoryAnchorPayload;
  readonly REPLAY_REVIEWED: LearningReplayReviewedPayload;
  readonly WORLD_EVENT_LINKED: LearningWorldEventLinkedPayload;
  readonly LEGEND_MOMENT_CAPTURED: LearningLegendMomentPayload;
  readonly PROFILE_MUTATION_APPLIED: LearningProfileMutationPayload;
  readonly DRIFT_FLAGGED: LearningDriftPayload;
  readonly EVALUATION_RECORDED: LearningEvaluationPayload;
}

export type LearningEventPayload<
  TKind extends LearningEventKind = LearningEventKind,
> = LearningEventPayloadMap[TKind];

// ============================================================================
// MARK: Atomic event record
// ============================================================================

export interface LearningEventRecord<
  TKind extends LearningEventKind = LearningEventKind,
> {
  readonly eventId: LearningEventId;
  readonly kind: TKind;
  readonly source: LearningSourceRef;
  readonly subject: LearningSubjectRef;
  readonly causedBy?: LearningEventCausality;
  readonly status: LearningFactStatus;
  readonly observedAtMs: UnixMs;
  readonly acceptedAtMs?: UnixMs;
  readonly authoritativeAtMs?: UnixMs;
  readonly privacy: LearningPrivacyEnvelope;
  readonly payload: LearningEventPayloadMap[TKind];
  readonly featureBag?: LearningFeatureBag;
  readonly labels?: readonly LearningLabel[];
  readonly modelRef?: LearningModelRef;
  readonly note?: string;
  readonly tags?: readonly string[];
  readonly metadata?: JsonObject;
}

export type AnyLearningEventRecord = LearningEventRecord<LearningEventKind>;

// ============================================================================
// MARK: Higher-level durable artifacts
// ============================================================================

export interface LearningFeatureWindowRecord {
  readonly featureWindowId: LearningFeatureWindowId;
  readonly subject: LearningSubjectRef;
  readonly split: LearningDataSplit;
  readonly window: LearningObservationWindow;
  readonly featureBag: LearningFeatureBag;
  readonly sourceEventIds: readonly LearningEventId[];
  readonly createdAtMs: UnixMs;
}

export interface LearningLabelAssignmentRecord {
  readonly labelSetId: LearningLabelSetId;
  readonly subject: LearningSubjectRef;
  readonly labels: readonly LearningLabel[];
  readonly sourceEventIds: readonly LearningEventId[];
  readonly createdAtMs: UnixMs;
}

export interface LearningAnchorBundle {
  readonly bundleId: LearningAnchorBundleId;
  readonly subject: LearningSubjectRef;
  readonly anchors: readonly LearningAnchorDescriptor[];
  readonly generatedAtMs: UnixMs;
  readonly sourceEventIds: readonly LearningEventId[];
}

export interface LearningInterventionDecisionRecord {
  readonly decisionId: LearningInterventionDecisionId;
  readonly subject: LearningSubjectRef;
  readonly decidedAtMs: UnixMs;
  readonly recommendedAction:
    | 'NONE'
    | 'HELPER_SOFT'
    | 'HELPER_DIRECT'
    | 'RESCUE_FAST_EXIT'
    | 'CHANNEL_SHIFT'
    | 'SILENCE'
    | 'HATER_SUPPRESS';
  readonly reason: string;
  readonly score01: Score01;
  readonly model?: LearningModelRef;
  readonly sourceEventIds: readonly LearningEventId[];
  readonly applied: boolean;
}

export interface LearningTrainingExample {
  readonly trainingExampleId: LearningTrainingExampleId;
  readonly subject: LearningSubjectRef;
  readonly featureWindowId: LearningFeatureWindowId;
  readonly labelSetId?: LearningLabelSetId;
  readonly rankingObservationId?: LearningRankingObservationId;
  readonly split: LearningDataSplit;
  readonly createdAtMs: UnixMs;
}

export interface LearningTelemetryJoin {
  readonly telemetryRecord?: Pick<ChatTelemetryRecord, 'recordId' | 'streamId' | 'occurredAtMs'>;
  readonly telemetryFact?: Pick<ChatTelemetryFactRecord, 'factId' | 'factName' | 'occurredAtMs'>;
  readonly exportReceipt?: Pick<ChatTelemetryExportReceipt, 'exportId' | 'exportedAtMs' | 'status'>;
}

export interface LearningTranscriptJoin {
  readonly snapshot?: Pick<ChatTranscriptSnapshot, 'snapshotId' | 'sequenceRange' | 'capturedAtMs'>;
  readonly slice?: Pick<ChatTranscriptSlice, 'sliceId' | 'messageIds' | 'sequenceRange'>;
  readonly pointer?: Pick<ChatTranscriptPointer, 'pointerId' | 'messageId' | 'sequenceNumber'>;
  readonly diffId?: ChatTranscriptDiffId;
}

export interface LearningProofJoin {
  readonly proofHashEnvelope?: Pick<ChatProofHashEnvelope, 'proofHash' | 'algorithm' | 'createdAtMs'>;
  readonly proofBundle?: Pick<ChatProofBundle, 'bundleId' | 'subjectKind' | 'createdAtMs'>;
  readonly verification?: Pick<ChatProofVerificationRecord, 'verificationId' | 'status' | 'verifiedAtMs'>;
  readonly edgeId?: ChatProofEdgeId;
  readonly edgeKind?: ChatProofEdgeKind;
  readonly nodeId?: ChatProofNodeId;
  readonly subjectKind?: ChatProofSubjectKind;
}

export interface LearningInvasionJoin {
  readonly invasionOutcome?: Pick<ChatInvasionOutcomeRecord, 'outcomeId' | 'outcomeKind' | 'resolvedAtMs'>;
  readonly invasionId?: ChatInvasionId;
  readonly invasionKind?: ChatInvasionKind;
  readonly invasionClass?: ChatInvasionClass;
}

export interface LearningJoinedFact {
  readonly event: AnyLearningEventRecord;
  readonly telemetry?: LearningTelemetryJoin;
  readonly transcript?: LearningTranscriptJoin;
  readonly proof?: LearningProofJoin;
  readonly invasion?: LearningInvasionJoin;
}

// ============================================================================
// MARK: Batches, queries, and export contracts
// ============================================================================

export interface LearningEventBatch {
  readonly batchId: LearningBatchId;
  readonly createdAtMs: UnixMs;
  readonly source: LearningEventSource;
  readonly status: 'OPEN' | 'SEALED' | 'EXPORTED';
  readonly events: readonly AnyLearningEventRecord[];
}

export interface LearningEventAppendRequest {
  readonly batchId?: LearningBatchId;
  readonly events: readonly AnyLearningEventRecord[];
  readonly idempotencyKey?: string;
}

export interface LearningEventAppendResult {
  readonly acceptedEventIds: readonly LearningEventId[];
  readonly rejectedEventIds: readonly LearningEventId[];
  readonly batchId: LearningBatchId;
}

export interface LearningEventQuery {
  readonly queryId: LearningQueryId;
  readonly subject?: Partial<LearningSubjectRef>;
  readonly kinds?: readonly LearningEventKind[];
  readonly fromMs?: UnixMs;
  readonly toMs?: UnixMs;
  readonly statuses?: readonly LearningFactStatus[];
  readonly limit?: number;
  readonly cursor?: LearningEventCursor;
}

export interface LearningEventQueryResult {
  readonly queryId: LearningQueryId;
  readonly events: readonly AnyLearningEventRecord[];
  readonly nextCursor?: LearningEventCursor;
  readonly totalApproximate?: number;
}

export interface LearningExportReceipt {
  readonly exportId: LearningExportId;
  readonly createdAtMs: UnixMs;
  readonly split: LearningDataSplit;
  readonly exampleCount: number;
  readonly labelKinds: readonly LearningLabelKind[];
  readonly retentionClass: LearningRetentionClass;
  readonly privacyMode: LearningPrivacyMode;
}

// ============================================================================
// MARK: Defaults and helper registries
// ============================================================================

export const LEARNING_DEFAULT_PRIVACY_ENVELOPE: LearningPrivacyEnvelope = {
  consentState: 'UNKNOWN',
  privacyMode: 'HASHED_TEXT',
  retentionClass: 'STANDARD',
  textHashed: true,
  embeddingsAllowed: true,
  labelsAllowed: true,
};

export const LEARNING_EMPTY_OBSERVATION_WINDOW: LearningObservationWindow = {
  startedAtMs: 0 as UnixMs,
  endedAtMs: 0 as UnixMs,
  durationMs: 0,
};

export const LEARNING_EMPTY_FEATURE_BAG: LearningFeatureBag = {
  featureVectorId: 'learning-feature-vector::empty' as LearningFeatureVectorId,
  window: LEARNING_EMPTY_OBSERVATION_WINDOW,
  split: 'ONLINE',
  dense: [],
  sparse: [],
};

export const LEARNING_EVENT_KIND_SET: ReadonlySet<LearningEventKind> = new Set(
  LEARNING_EVENT_KINDS,
);

export const LEARNING_EVENT_SOURCE_SET: ReadonlySet<LearningEventSource> = new Set(
  LEARNING_EVENT_SOURCES,
);

export const LEARNING_LABEL_KIND_SET: ReadonlySet<LearningLabelKind> = new Set(
  LEARNING_LABEL_KINDS,
);

export const LEARNING_MODEL_FAMILY_SET: ReadonlySet<LearningModelFamily> = new Set(
  LEARNING_MODEL_FAMILIES,
);

export const LEARNING_MEMORY_ANCHOR_KIND_SET: ReadonlySet<LearningMemoryAnchorKind> = new Set(
  LEARNING_MEMORY_ANCHOR_KINDS,
);

export const LEARNING_EVENT_DESCRIPTION_REGISTRY: Readonly<Record<
  LearningEventKind,
  string
>> = {
  CHAT_OPENED: 'Chat surface opened and cold-start inference window began.',
  CHAT_CLOSED: 'Chat surface closed or collapsed.',
  MESSAGE_DRAFTED: 'Draft text became a learning-relevant observation.',
  MESSAGE_SUBMITTED: 'User or NPC attempted to emit a chat message.',
  MESSAGE_ACCEPTED: 'Backend accepted a message into authoritative truth.',
  MESSAGE_REJECTED: 'A message was rejected before transcript mutation.',
  MESSAGE_REDRAFTED: 'Draft content was revised after first observation.',
  MESSAGE_READ: 'A message read signal was observed.',
  MESSAGE_REACTED: 'A reaction signal changed.',
  MESSAGE_QUOTED: 'A prior message was quoted explicitly.',
  MESSAGE_RECALLED: 'A prior message was recalled through callback memory.',
  CHANNEL_SWITCHED: 'The user or system switched active channel context.',
  PRESENCE_CHANGED: 'Presence truth changed for an actor.',
  TYPING_STARTED: 'Typing theater began.',
  TYPING_STOPPED: 'Typing theater ended.',
  NPC_MESSAGE_EMITTED: 'An NPC emitted a message into the chat space.',
  HELPER_INTERVENTION: 'A helper-style intervention was attempted or applied.',
  HATER_ESCALATION: 'A hater-style escalation signal occurred.',
  INVASION_TRIGGERED: 'An invasion sequence started.',
  INVASION_ESCALATED: 'An invasion sequence intensified.',
  INVASION_RESOLVED: 'An invasion sequence resolved.',
  NEGOTIATION_OFFER_SUBMITTED: 'A negotiation offer was emitted.',
  NEGOTIATION_COUNTER_RECEIVED: 'A counter-offer or counter-move arrived.',
  NEGOTIATION_COLLAPSED: 'A negotiation sequence collapsed.',
  PROOF_ATTACHED: 'Proof metadata attached to a learning-relevant subject.',
  PROOF_CONFLICTED: 'Proof conflict entered the learning graph.',
  MODERATION_APPLIED: 'Moderation mutated or rejected content.',
  RESCUE_TRIGGERED: 'Rescue logic opened an intervention lane.',
  RESCUE_RESOLVED: 'Rescue logic concluded.',
  CHURN_WARNING: 'The system estimated elevated churn risk.',
  RANKING_DECISION_LOGGED: 'A response ranking decision was recorded.',
  MEMORY_ANCHOR_WRITTEN: 'A durable memory anchor was written.',
  MEMORY_ANCHOR_RETRIEVED: 'A durable memory anchor was retrieved.',
  REPLAY_REVIEWED: 'Replay data was reviewed for learning.',
  WORLD_EVENT_LINKED: 'A world event was linked to learning state.',
  LEGEND_MOMENT_CAPTURED: 'A prestige or legend moment was captured.',
  PROFILE_MUTATION_APPLIED: 'A learning profile mutation completed.',
  DRIFT_FLAGGED: 'A drift run flagged a distribution mismatch.',
  EVALUATION_RECORDED: 'An evaluation result was stored.',
};

// ============================================================================
// MARK: Builders and type guards
// ============================================================================

export function isLearningEventKind(value: string): value is LearningEventKind {
  return LEARNING_EVENT_KIND_SET.has(value as LearningEventKind);
}

export function isLearningEventSource(value: string): value is LearningEventSource {
  return LEARNING_EVENT_SOURCE_SET.has(value as LearningEventSource);
}

export function isLearningLabelKind(value: string): value is LearningLabelKind {
  return LEARNING_LABEL_KIND_SET.has(value as LearningLabelKind);
}

export function isLearningModelFamily(value: string): value is LearningModelFamily {
  return LEARNING_MODEL_FAMILY_SET.has(value as LearningModelFamily);
}

export function isLearningMemoryAnchorKind(
  value: string,
): value is LearningMemoryAnchorKind {
  return LEARNING_MEMORY_ANCHOR_KIND_SET.has(value as LearningMemoryAnchorKind);
}

export function createLearningEventId(seed: string): LearningEventId {
  return `learning-event::${seed}` as LearningEventId;
}

export function createLearningBatchId(seed: string): LearningBatchId {
  return `learning-batch::${seed}` as LearningBatchId;
}

export function createLearningLabelId(seed: string): LearningLabelId {
  return `learning-label::${seed}` as LearningLabelId;
}

export function createLearningProfileId(seed: string): LearningProfileId {
  return `learning-profile::${seed}` as LearningProfileId;
}

export function createLearningAnchorId(seed: string): LearningAnchorId {
  return `learning-anchor::${seed}` as LearningAnchorId;
}

export function createLearningFeatureName(seed: string): LearningFeatureName {
  return seed as LearningFeatureName;
}

export function createLearningEventRecord<
  TKind extends LearningEventKind,
>(params: {
  readonly eventId: LearningEventId;
  readonly kind: TKind;
  readonly source: LearningSourceRef;
  readonly subject: LearningSubjectRef;
  readonly payload: LearningEventPayloadMap[TKind];
  readonly observedAtMs: UnixMs;
  readonly privacy?: LearningPrivacyEnvelope;
  readonly status?: LearningFactStatus;
  readonly causedBy?: LearningEventCausality;
  readonly featureBag?: LearningFeatureBag;
  readonly labels?: readonly LearningLabel[];
  readonly modelRef?: LearningModelRef;
  readonly note?: string;
  readonly tags?: readonly string[];
  readonly metadata?: JsonObject;
}): LearningEventRecord<TKind> {
  return {
    eventId: params.eventId,
    kind: params.kind,
    source: params.source,
    subject: params.subject,
    payload: params.payload,
    observedAtMs: params.observedAtMs,
    privacy: params.privacy ?? LEARNING_DEFAULT_PRIVACY_ENVELOPE,
    status: params.status ?? 'OBSERVED',
    causedBy: params.causedBy,
    featureBag: params.featureBag,
    labels: params.labels,
    modelRef: params.modelRef,
    note: params.note,
    tags: params.tags,
    metadata: params.metadata,
  };
}

export function createLearningAnchorDescriptor(params: {
  readonly anchorId: LearningAnchorId;
  readonly anchorKind: LearningMemoryAnchorKind;
  readonly title: string;
  readonly salienceScore: Score01;
  readonly createdAtMs: UnixMs;
  readonly sourceMessageId?: ChatMessageId;
  readonly quoteId?: ChatQuoteId;
  readonly transcriptExcerptId?: ChatTranscriptExcerptId;
  readonly replayId?: ChatReplayId;
  readonly invasionId?: ChatInvasionId;
  readonly legendId?: ChatLegendId;
}): LearningAnchorDescriptor {
  return {
    anchorId: params.anchorId,
    anchorKind: params.anchorKind,
    title: params.title,
    salienceScore: params.salienceScore,
    createdAtMs: params.createdAtMs,
    lastTouchedAtMs: params.createdAtMs,
    sourceMessageId: params.sourceMessageId,
    quoteId: params.quoteId,
    transcriptExcerptId: params.transcriptExcerptId,
    replayId: params.replayId,
    invasionId: params.invasionId,
    legendId: params.legendId,
  };
}

export function createLearningLabel(params: {
  readonly labelId: LearningLabelId;
  readonly labelKind: LearningLabelKind;
  readonly value: string;
  readonly confidenceBand: LearningLabelConfidenceBand;
  readonly authority: ChatAuthority;
  readonly assignedAtMs: UnixMs;
  readonly score01?: Score01;
  readonly score100?: Score100;
  readonly note?: string;
}): LearningLabel {
  return {
    labelId: params.labelId,
    labelKind: params.labelKind,
    value: params.value,
    confidenceBand: params.confidenceBand,
    authority: params.authority,
    assignedAtMs: params.assignedAtMs,
    score01: params.score01,
    score100: params.score100,
    note: params.note,
  };
}

export function summarizeLearningFeatureBag(
  featureBag: LearningFeatureBag,
): Readonly<Record<string, JsonValue>> {
  return {
    featureVectorId: featureBag.featureVectorId,
    denseCount: featureBag.dense.length,
    sparseCount: featureBag.sparse.length,
    split: featureBag.split,
    durationMs: featureBag.window.durationMs,
  };
}

export function getLearningEventDescription(kind: LearningEventKind): string {
  return LEARNING_EVENT_DESCRIPTION_REGISTRY[kind];
}

// ============================================================================
// MARK: Manifests
// ============================================================================

export const LEARNING_EVENT_CONTRACT_MANIFEST = {
  contractVersion: CHAT_CONTRACT_VERSION,
  authorities: CHAT_CONTRACT_AUTHORITIES,
  eventKinds: LEARNING_EVENT_KINDS,
  eventSources: LEARNING_EVENT_SOURCES,
  subjectKinds: LEARNING_SUBJECT_KINDS,
  factStatuses: LEARNING_FACT_STATUSES,
  featureValueKinds: LEARNING_FEATURE_VALUE_KINDS,
  labelKinds: LEARNING_LABEL_KINDS,
  labelConfidenceBands: LEARNING_LABEL_CONFIDENCE_BANDS,
  dataSplits: LEARNING_DATA_SPLITS,
  interventionOutcomes: LEARNING_INTERVENTION_OUTCOMES,
  coldStartBases: LEARNING_COLD_START_BASES,
  modelFamilies: LEARNING_MODEL_FAMILIES,
  privacyModes: LEARNING_PRIVACY_MODES,
  retentionClasses: LEARNING_RETENTION_CLASSES,
  updateModes: LEARNING_UPDATE_MODES,
  driftStatuses: LEARNING_DRIFT_STATUSES,
  evaluationVerdicts: LEARNING_EVALUATION_VERDICTS,
  rankingSources: LEARNING_RANKING_SOURCES,
  memoryAnchorKinds: LEARNING_MEMORY_ANCHOR_KINDS,
  consentStates: LEARNING_CONSENT_STATES,
  embeddingSourceKinds: LEARNING_EMBEDDING_SOURCE_KINDS,
} as const;

export type LearningEventContractManifest =
  typeof LEARNING_EVENT_CONTRACT_MANIFEST;
