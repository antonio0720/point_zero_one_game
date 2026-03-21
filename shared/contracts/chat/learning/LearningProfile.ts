/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT LEARNING PROFILE CONTRACTS
 * FILE: shared/contracts/chat/learning/LearningProfile.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared profile and durable-learning state contracts for the unified
 * chat intelligence lane.
 *
 * This file becomes the single shared profile vocabulary consumed by:
 *   - /shared/contracts/chat/learning
 *   - /pzo-web/src/engines/chat/intelligence
 *   - /backend/src/game/engine/chat/intelligence
 *   - /pzo-server/src/chat
 *
 * Design laws
 * -----------
 * 1. The frontend may mirror, cache, and hint, but durable profile truth lives
 *    with backend-authoritative learning state.
 * 2. Profiles must capture more than engagement. They must represent helper
 *    receptivity, hater susceptibility, negotiation style, channel affinity,
 *    emotional swing, rescue history, and memory salience.
 * 3. Profile contracts must remain transport-safe and import-safe so they can
 *    move through server fanout and frontend mirrors without pulling runtime
 *    engine implementations into the shared lane.
 * 4. Cold-start priors, online updates, decays, overrides, and evaluation
 *    metadata must all be explicit. Hidden mutation semantics create drift.
 * 5. Profiles must preserve the repo doctrine that chat is an emotional game
 *    director, not a detached messaging widget.
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
  type ChatInterventionId,
  type ChatLegendId,
  type ChatMemoryAnchorId,
  type ChatMessageId,
  type ChatNpcId,
  type ChatOfferId,
  type ChatQuoteId,
  type ChatReplayId,
  type ChatSceneId,
  type ChatSessionId,
  type ChatUserId,
  type ChatWorldEventId,
} from '../ChatChannels';

import {
  type ChatAuthority,
  CHAT_AUTHORITIES,
} from '../ChatEvents';

import { type ChatRoomAura } from '../ChatPresence';

import {
  type ChatMessageToneBand,
  type ChatMessageVisibilityClass,
  type ChatThreadId,
} from '../ChatMessage';

import {
  type ChatInvasionClass,
  type ChatInvasionId,
  type ChatInvasionKind,
} from '../ChatInvasion';

import {
  type LearningAnchorBundle,
  type LearningAnchorDescriptor,
  type LearningAnchorId,
  type LearningBatchId,
  type LearningColdStartBasis,
  type LearningConsentState,
  type LearningDataSplit,
  type LearningDriftRunId,
  type LearningDriftStatus,
  type LearningEmbeddingId,
  type LearningEmbeddingRecord,
  type LearningEmbeddingSpaceId,
  type LearningEvaluationRunId,
  type LearningEvaluationVerdict,
  type LearningEventId,
  type LearningEventKind,
  type LearningEventRecord,
  type LearningEventSource,
  type LearningExportId,
  type LearningFeatureBag,
  type LearningFeatureName,
  type LearningFeatureWindowId,
  type LearningInterventionDecisionId,
  type LearningInterventionDecisionRecord,
  type LearningInterventionOutcome,
  type LearningLabel,
  type LearningLabelConfidenceBand,
  type LearningLabelKind,
  type LearningLabelSetId,
  type LearningMemoryAnchorKind,
  type LearningModelFamily,
  type LearningModelRef,
  type LearningModelSnapshotId,
  type LearningObservationWindow,
  type LearningPrivacyEnvelope,
  type LearningPrivacyMode,
  type LearningProfileId,
  type LearningQueryId,
  type LearningRankingObservation,
  type LearningRankingObservationId,
  type LearningRankingSource,
  type LearningRetentionClass,
  type LearningRetentionKey,
  type LearningRoomProfileId,
  type LearningSourceRef,
  type LearningSubjectKind,
  type LearningSubjectRef,
  type LearningTrainingExample,
  type LearningTrainingExampleId,
  type LearningUpdateMode,
  LEARNING_DEFAULT_PRIVACY_ENVELOPE,
} from './LearningEvents';

// ============================================================================
// MARK: Branded identifiers local to profiles
// ============================================================================

export type LearningProfileVersionId = Brand<string, 'LearningProfileVersionId'>;
export type LearningProfileSnapshotId = Brand<string, 'LearningProfileSnapshotId'>;
export type LearningProfileMutationId = Brand<string, 'LearningProfileMutationId'>;
export type LearningProfileWindowId = Brand<string, 'LearningProfileWindowId'>;
export type LearningProfileDecayId = Brand<string, 'LearningProfileDecayId'>;
export type LearningProfileClusterId = Brand<string, 'LearningProfileClusterId'>;
export type LearningProfileTag = Brand<string, 'LearningProfileTag'>;
export type LearningProfileNoteId = Brand<string, 'LearningProfileNoteId'>;
export type LearningReceptivityWindowId = Brand<string, 'LearningReceptivityWindowId'>;
export type LearningSusceptibilityWindowId = Brand<string, 'LearningSusceptibilityWindowId'>;
export type LearningNegotiationHistoryId = Brand<string, 'LearningNegotiationHistoryId'>;
export type LearningChannelAffinityId = Brand<string, 'LearningChannelAffinityId'>;
export type LearningEmotionBandId = Brand<string, 'LearningEmotionBandId'>;
export type LearningRelationshipProfileId = Brand<string, 'LearningRelationshipProfileId'>;
export type LearningRoomSignatureId = Brand<string, 'LearningRoomSignatureId'>;
export type LearningTrustWindowId = Brand<string, 'LearningTrustWindowId'>;
export type LearningMemorySummaryId = Brand<string, 'LearningMemorySummaryId'>;
export type LearningRescueHistoryId = Brand<string, 'LearningRescueHistoryId'>;
export type LearningPreferenceId = Brand<string, 'LearningPreferenceId'>;

// ============================================================================
// MARK: Core vocabularies
// ============================================================================

export const LEARNING_PROFILE_AUTHORITIES = [
  'CLIENT_MIRROR',
  'SERVER_CACHE',
  'BACKEND_AUTHORITATIVE',
  'BACKEND_OVERRIDE',
] as const;

export type LearningProfileAuthority =
  (typeof LEARNING_PROFILE_AUTHORITIES)[number];

export const LEARNING_COLD_START_STATES = [
  'UNSEEDED',
  'SEEDED',
  'OBSERVING',
  'WARMING',
  'STABLE',
] as const;

export type LearningColdStartState =
  (typeof LEARNING_COLD_START_STATES)[number];

export const LEARNING_ENGAGEMENT_TIERS = [
  'UNKNOWN',
  'LOW',
  'TENTATIVE',
  'ENGAGED',
  'HIGH',
  'LOCKED_IN',
] as const;

export type LearningEngagementTier =
  (typeof LEARNING_ENGAGEMENT_TIERS)[number];

export const LEARNING_HELPER_RECEPTIVITY_BANDS = [
  'AVOIDANT',
  'SKEPTICAL',
  'MIXED',
  'OPEN',
  'DEPENDENT',
] as const;

export type LearningHelperReceptivityBand =
  (typeof LEARNING_HELPER_RECEPTIVITY_BANDS)[number];

export const LEARNING_HATER_SUSCEPTIBILITY_BANDS = [
  'ARMORED',
  'RESISTANT',
  'NEUTRAL',
  'REACTIVE',
  'HIGHLY_REACTIVE',
] as const;

export type LearningHaterSusceptibilityBand =
  (typeof LEARNING_HATER_SUSCEPTIBILITY_BANDS)[number];

export const LEARNING_CHANNEL_AFFINITY_BANDS = [
  'REJECTS',
  'LOW',
  'NEUTRAL',
  'PREFERS',
  'PRIMARY',
] as const;

export type LearningChannelAffinityBand =
  (typeof LEARNING_CHANNEL_AFFINITY_BANDS)[number];

export const LEARNING_NEGOTIATION_STYLES = [
  'CAUTIOUS',
  'BALANCED',
  'PREDATORY',
  'BLUFFER',
  'PANIC_SELLER',
  'STALLER',
  'SILENT_KNIFE',
] as const;

export type LearningNegotiationStyle =
  (typeof LEARNING_NEGOTIATION_STYLES)[number];

export const LEARNING_RISK_BANDS = [
  'NONE',
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
] as const;

export type LearningRiskBand = (typeof LEARNING_RISK_BANDS)[number];

export const LEARNING_MEMORY_SALIENCE_BANDS = [
  'EPHEMERAL',
  'LOW',
  'MEDIUM',
  'HIGH',
  'LEGENDARY',
] as const;

export type LearningMemorySalienceBand =
  (typeof LEARNING_MEMORY_SALIENCE_BANDS)[number];

export const LEARNING_TRUST_BANDS = [
  'HOSTILE',
  'WARY',
  'NEUTRAL',
  'OPEN',
  'LOYAL',
] as const;

export type LearningTrustBand = (typeof LEARNING_TRUST_BANDS)[number];

export const LEARNING_CADENCE_MODES = [
  'NONE',
  'LIGHT',
  'STANDARD',
  'INTENSIVE',
  'EMERGENCY',
] as const;

export type LearningCadenceMode = (typeof LEARNING_CADENCE_MODES)[number];

export const LEARNING_EMOTION_AXES = [
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

export type LearningEmotionAxis = (typeof LEARNING_EMOTION_AXES)[number];

export const LEARNING_ROOM_SIGNATURE_KINDS = [
  'LOBBY',
  'GLOBAL_STAGE',
  'SYNDICATE_DEN',
  'DEAL_ROOM',
  'BATTLE_PRESSURE',
  'POST_RUN_RITUAL',
] as const;

export type LearningRoomSignatureKind =
  (typeof LEARNING_ROOM_SIGNATURE_KINDS)[number];

export const LEARNING_DECAY_STRATEGIES = [
  'NONE',
  'LINEAR',
  'EXPONENTIAL',
  'EVENT_WEIGHTED',
  'ANCHOR_LOCKED',
] as const;

export type LearningDecayStrategy =
  (typeof LEARNING_DECAY_STRATEGIES)[number];

export const LEARNING_PROFILE_VISIBILITY_MODES = [
  'BACKEND_ONLY',
  'CLIENT_MIRROR_SAFE',
  'CLIENT_HINT_SAFE',
  'PUBLIC_SUMMARY_SAFE',
] as const;

export type LearningProfileVisibilityMode =
  (typeof LEARNING_PROFILE_VISIBILITY_MODES)[number];

// ============================================================================
// MARK: Shared support structures
// ============================================================================

export interface LearningProfileHeader {
  readonly profileId: LearningProfileId;
  readonly versionId: LearningProfileVersionId;
  readonly authority: LearningProfileAuthority;
  readonly createdAtMs: UnixMs;
  readonly updatedAtMs: UnixMs;
  readonly privacy: LearningPrivacyEnvelope;
  readonly coldStartState: LearningColdStartState;
  readonly coldStartBasis: LearningColdStartBasis;
  readonly visibleToClient: LearningProfileVisibilityMode;
}

export interface LearningScoreWithHistory {
  readonly currentScore01: Score01;
  readonly previousScore01?: Score01;
  readonly peakScore01?: Score01;
  readonly troughScore01?: Score01;
  readonly updatedAtMs: UnixMs;
}

export interface LearningBandWithScore<TBand extends string> {
  readonly band: TBand;
  readonly score01: Score01;
  readonly updatedAtMs: UnixMs;
}

export interface LearningFeatureWindowSummary {
  readonly featureWindowId?: LearningFeatureWindowId;
  readonly lastWindow?: LearningObservationWindow;
  readonly lastEventId?: LearningEventId;
  readonly eventCount: number;
}

export interface LearningChannelAffinityEntry {
  readonly affinityId: LearningChannelAffinityId;
  readonly channelId: ChatChannelId;
  readonly band: LearningChannelAffinityBand;
  readonly preferenceScore01: Score01;
  readonly switchInRate01?: Score01;
  readonly switchOutRate01?: Score01;
  readonly rescueSuccessScore01?: Score01;
  readonly updatedAtMs: UnixMs;
}

export interface LearningChannelAffinityMatrix {
  readonly primaryChannelId?: ChatChannelId;
  readonly entries: readonly LearningChannelAffinityEntry[];
  readonly updatedAtMs: UnixMs;
}

export interface LearningHelperReceptivityProfile {
  readonly windowId: LearningReceptivityWindowId;
  readonly band: LearningHelperReceptivityBand;
  readonly receptivityScore01: Score01;
  readonly adviceIgnoredRate01?: Score01;
  readonly adviceAcceptedRate01?: Score01;
  readonly rescueRecoveryScore01?: Score01;
  readonly preferredCadence: LearningCadenceMode;
  readonly updatedAtMs: UnixMs;
}

export interface LearningHaterSusceptibilityProfile {
  readonly windowId: LearningSusceptibilityWindowId;
  readonly band: LearningHaterSusceptibilityBand;
  readonly susceptibilityScore01: Score01;
  readonly shameSpikeScore01?: Score01;
  readonly tauntResponseRate01?: Score01;
  readonly revengeMemoryScore01?: Score01;
  readonly updatedAtMs: UnixMs;
}

export interface LearningNegotiationProfile {
  readonly historyId: LearningNegotiationHistoryId;
  readonly style: LearningNegotiationStyle;
  readonly bluffScore01: Score01;
  readonly urgencyLeakScore01: Score01;
  readonly overpayRiskBand: LearningRiskBand;
  readonly panicRiskBand: LearningRiskBand;
  readonly acceptanceDelayMsMedian?: number;
  readonly updatedAtMs: UnixMs;
}

export interface LearningRescueHistory {
  readonly historyId: LearningRescueHistoryId;
  readonly lastInterventionId?: ChatInterventionId;
  readonly lastOutcome?: LearningInterventionOutcome;
  readonly totalRescues: number;
  readonly successfulRescues: number;
  readonly failedRescues: number;
  readonly noResponseRescues: number;
  readonly updatedAtMs: UnixMs;
}

export interface LearningEmotionEntry {
  readonly axis: LearningEmotionAxis;
  readonly score01: Score01;
  readonly momentum?: number;
  readonly updatedAtMs: UnixMs;
}

export interface LearningEmotionProfile {
  readonly entries: readonly LearningEmotionEntry[];
  readonly dominantAxis?: LearningEmotionAxis;
  readonly volatilityScore01?: Score01;
  readonly updatedAtMs: UnixMs;
}

export interface LearningMemoryProfile {
  readonly summaryId: LearningMemorySummaryId;
  readonly totalAnchors: number;
  readonly highSalienceAnchorCount: number;
  readonly legendaryAnchorCount: number;
  readonly lastAnchorId?: LearningAnchorId;
  readonly lastAnchorTouchedAtMs?: UnixMs;
  readonly lastLegendId?: ChatLegendId;
  readonly lastReplayId?: ChatReplayId;
  readonly updatedAtMs: UnixMs;
}

export interface LearningRelationshipProfile {
  readonly relationshipProfileId: LearningRelationshipProfileId;
  readonly npcId: ChatNpcId;
  readonly trustBand: LearningTrustBand;
  readonly trustScore01: Score01;
  readonly respectScore01?: Score01;
  readonly contemptScore01?: Score01;
  readonly fascinationScore01?: Score01;
  readonly rivalryIntensityScore01?: Score01;
  readonly rescueDebtScore01?: Score01;
  readonly lastInteractionAtMs?: UnixMs;
  readonly updatedAtMs: UnixMs;
}

export interface LearningRoomSignature {
  readonly roomSignatureId: LearningRoomSignatureId;
  readonly roomId?: ChatRoomId;
  readonly mountTarget?: ChatMountTarget;
  readonly modeScope?: ChatModeScope;
  readonly signatureKind: LearningRoomSignatureKind;
  readonly aura?: ChatRoomAura;
  readonly comfortScore01?: Score01;
  readonly hostilityScore01?: Score01;
  readonly pressureScore01?: Score01;
  readonly updatedAtMs: UnixMs;
}

export interface LearningColdStartDescriptor {
  readonly coldStartBasis: LearningColdStartBasis;
  readonly seededAtMs?: UnixMs;
  readonly priorClusterId?: LearningProfileClusterId;
  readonly priorScore01?: Score01;
  readonly note?: string;
}

export interface LearningDriftState {
  readonly driftRunId?: LearningDriftRunId;
  readonly status: LearningDriftStatus;
  readonly lastCheckedAtMs?: UnixMs;
  readonly highestBand: LearningRiskBand;
  readonly note?: string;
}

export interface LearningEvaluationState {
  readonly evaluationRunId?: LearningEvaluationRunId;
  readonly verdict: LearningEvaluationVerdict;
  readonly lastEvaluatedAtMs?: UnixMs;
  readonly note?: string;
}

export interface LearningModelState {
  readonly activeModels: readonly LearningModelRef[];
  readonly lastSnapshotId?: LearningModelSnapshotId;
  readonly updatedAtMs: UnixMs;
}

export interface LearningProfileNote {
  readonly noteId: LearningProfileNoteId;
  readonly createdAtMs: UnixMs;
  readonly createdBy: LearningEventSource | 'OPERATOR';
  readonly text: string;
}

export interface LearningPreferenceHint {
  readonly preferenceId: LearningPreferenceId;
  readonly key: string;
  readonly value: string;
  readonly confidenceBand: LearningLabelConfidenceBand;
  readonly updatedAtMs: UnixMs;
}

// ============================================================================
// MARK: Player profile, room profile, and mirror-safe views
// ============================================================================

export interface LearningPlayerProfile {
  readonly header: LearningProfileHeader;
  readonly playerId: ChatUserId;
  readonly sessionId?: ChatSessionId;
  readonly engagement: LearningBandWithScore<LearningEngagementTier>;
  readonly helperReceptivity: LearningHelperReceptivityProfile;
  readonly haterSusceptibility: LearningHaterSusceptibilityProfile;
  readonly channelAffinity: LearningChannelAffinityMatrix;
  readonly negotiation: LearningNegotiationProfile;
  readonly rescueHistory: LearningRescueHistory;
  readonly emotions: LearningEmotionProfile;
  readonly memory: LearningMemoryProfile;
  readonly relationships: readonly LearningRelationshipProfile[];
  readonly roomSignatures: readonly LearningRoomSignature[];
  readonly coldStart: LearningColdStartDescriptor;
  readonly drift: LearningDriftState;
  readonly evaluation: LearningEvaluationState;
  readonly models: LearningModelState;
  readonly featureWindowSummary: LearningFeatureWindowSummary;
  readonly notes?: readonly LearningProfileNote[];
  readonly preferences?: readonly LearningPreferenceHint[];
  readonly tags?: readonly LearningProfileTag[];
}

export interface LearningRoomProfile {
  readonly header: LearningProfileHeader;
  readonly roomProfileId: LearningRoomProfileId;
  readonly roomId?: ChatRoomId;
  readonly modeScope?: ChatModeScope;
  readonly mountTarget?: ChatMountTarget;
  readonly primaryChannelId?: ChatChannelId;
  readonly audienceHeatScore01?: Score01;
  readonly hostilityScore01?: Score01;
  readonly helperSuccessScore01?: Score01;
  readonly haterSuccessScore01?: Score01;
  readonly negotiationPressureScore01?: Score01;
  readonly signature: LearningRoomSignature;
  readonly featureWindowSummary: LearningFeatureWindowSummary;
  readonly drift: LearningDriftState;
  readonly evaluation: LearningEvaluationState;
  readonly models: LearningModelState;
  readonly tags?: readonly LearningProfileTag[];
}

export interface LearningPlayerProfileMirror {
  readonly profileId: LearningProfileId;
  readonly versionId: LearningProfileVersionId;
  readonly coldStartState: LearningColdStartState;
  readonly engagementTier: LearningEngagementTier;
  readonly helperBand: LearningHelperReceptivityBand;
  readonly haterBand: LearningHaterSusceptibilityBand;
  readonly primaryChannelId?: ChatChannelId;
  readonly dominantEmotionAxis?: LearningEmotionAxis;
  readonly visibleAnchorCount: number;
  readonly updatedAtMs: UnixMs;
}

export interface LearningRoomProfileMirror {
  readonly roomProfileId: LearningRoomProfileId;
  readonly versionId: LearningProfileVersionId;
  readonly roomId?: ChatRoomId;
  readonly modeScope?: ChatModeScope;
  readonly mountTarget?: ChatMountTarget;
  readonly primaryChannelId?: ChatChannelId;
  readonly audienceHeatScore01?: Score01;
  readonly hostilityScore01?: Score01;
  readonly updatedAtMs: UnixMs;
}

// ============================================================================
// MARK: Mutation and snapshot contracts
// ============================================================================

export interface LearningProfileMutationPatch {
  readonly mutationId: LearningProfileMutationId;
  readonly profileId?: LearningProfileId;
  readonly roomProfileId?: LearningRoomProfileId;
  readonly sourceEventIds: readonly LearningEventId[];
  readonly updateMode: LearningUpdateMode;
  readonly changedFields: readonly string[];
  readonly appliedAtMs: UnixMs;
  readonly note?: string;
}

export interface LearningPlayerProfileSnapshot {
  readonly snapshotId: LearningProfileSnapshotId;
  readonly takenAtMs: UnixMs;
  readonly profile: LearningPlayerProfile;
  readonly anchorBundle?: LearningAnchorBundle;
  readonly pendingIntervention?: LearningInterventionDecisionRecord;
}

export interface LearningRoomProfileSnapshot {
  readonly snapshotId: LearningProfileSnapshotId;
  readonly takenAtMs: UnixMs;
  readonly profile: LearningRoomProfile;
}

export interface LearningProfileEnvelope {
  readonly playerProfile?: LearningPlayerProfile;
  readonly roomProfiles?: readonly LearningRoomProfile[];
  readonly playerMirror?: LearningPlayerProfileMirror;
  readonly roomMirrors?: readonly LearningRoomProfileMirror[];
  readonly generatedAtMs: UnixMs;
}

// ============================================================================
// MARK: Queries, writes, and synchronization
// ============================================================================

export interface LearningProfileQuery {
  readonly queryId: LearningQueryId;
  readonly playerId?: ChatUserId;
  readonly roomId?: ChatRoomId;
  readonly modeScope?: ChatModeScope;
  readonly mountTarget?: ChatMountTarget;
  readonly includeMirrors?: boolean;
  readonly includeRelationships?: boolean;
  readonly includeAnchors?: boolean;
  readonly includeNotes?: boolean;
}

export interface LearningProfileUpdateRequest {
  readonly profileId?: LearningProfileId;
  readonly roomProfileId?: LearningRoomProfileId;
  readonly sourceEventIds: readonly LearningEventId[];
  readonly updateMode: LearningUpdateMode;
  readonly patch: JsonObject;
  readonly requestedAtMs: UnixMs;
}

export interface LearningProfileUpdateResult {
  readonly mutationPatch: LearningProfileMutationPatch;
  readonly playerSnapshot?: LearningPlayerProfileSnapshot;
  readonly roomSnapshot?: LearningRoomProfileSnapshot;
}

export interface LearningMirrorSyncPacket {
  readonly generatedAtMs: UnixMs;
  readonly profileEnvelope: LearningProfileEnvelope;
  readonly reason:
    | 'COLD_START'
    | 'ONLINE_UPDATE'
    | 'ROOM_TRANSITION'
    | 'RESCUE_HINT'
    | 'RANKING_HINT'
    | 'POST_RUN';
}

// ============================================================================
// MARK: Builders and helper functions
// ============================================================================

export const LEARNING_DEFAULT_ENGAGEMENT: LearningBandWithScore<LearningEngagementTier> = {
  band: 'UNKNOWN',
  score01: 0 as Score01,
  updatedAtMs: 0 as UnixMs,
};

export const LEARNING_DEFAULT_HELPER_RECEPTIVITY: LearningHelperReceptivityProfile = {
  windowId: 'learning-helper-receptivity::default' as LearningReceptivityWindowId,
  band: 'MIXED',
  receptivityScore01: 0.5 as Score01,
  preferredCadence: 'STANDARD',
  updatedAtMs: 0 as UnixMs,
};

export const LEARNING_DEFAULT_HATER_SUSCEPTIBILITY: LearningHaterSusceptibilityProfile = {
  windowId: 'learning-hater-susceptibility::default' as LearningSusceptibilityWindowId,
  band: 'NEUTRAL',
  susceptibilityScore01: 0.5 as Score01,
  updatedAtMs: 0 as UnixMs,
};

export const LEARNING_DEFAULT_NEGOTIATION_PROFILE: LearningNegotiationProfile = {
  historyId: 'learning-negotiation-history::default' as LearningNegotiationHistoryId,
  style: 'BALANCED',
  bluffScore01: 0.5 as Score01,
  urgencyLeakScore01: 0.5 as Score01,
  overpayRiskBand: 'MEDIUM',
  panicRiskBand: 'MEDIUM',
  updatedAtMs: 0 as UnixMs,
};

export const LEARNING_DEFAULT_RESCUE_HISTORY: LearningRescueHistory = {
  historyId: 'learning-rescue-history::default' as LearningRescueHistoryId,
  totalRescues: 0,
  successfulRescues: 0,
  failedRescues: 0,
  noResponseRescues: 0,
  updatedAtMs: 0 as UnixMs,
};

export const LEARNING_DEFAULT_EMOTION_PROFILE: LearningEmotionProfile = {
  entries: LEARNING_EMOTION_AXES.map((axis) => ({
    axis,
    score01: 0.5 as Score01,
    updatedAtMs: 0 as UnixMs,
  })),
  updatedAtMs: 0 as UnixMs,
};

export const LEARNING_DEFAULT_MEMORY_PROFILE: LearningMemoryProfile = {
  summaryId: 'learning-memory-summary::default' as LearningMemorySummaryId,
  totalAnchors: 0,
  highSalienceAnchorCount: 0,
  legendaryAnchorCount: 0,
  updatedAtMs: 0 as UnixMs,
};

export const LEARNING_DEFAULT_DRIFT_STATE: LearningDriftState = {
  status: 'NONE',
  highestBand: 'NONE',
};

export const LEARNING_DEFAULT_EVALUATION_STATE: LearningEvaluationState = {
  verdict: 'UNKNOWN',
};

export const LEARNING_DEFAULT_MODEL_STATE: LearningModelState = {
  activeModels: [],
  updatedAtMs: 0 as UnixMs,
};

export const LEARNING_DEFAULT_FEATURE_WINDOW_SUMMARY: LearningFeatureWindowSummary = {
  eventCount: 0,
};

export function createLearningProfileVersionId(seed: string): LearningProfileVersionId {
  return `learning-profile-version::${seed}` as LearningProfileVersionId;
}

export function createLearningProfileSnapshotId(seed: string): LearningProfileSnapshotId {
  return `learning-profile-snapshot::${seed}` as LearningProfileSnapshotId;
}

export function createLearningRoomProfileId(seed: string): LearningRoomProfileId {
  return `learning-room-profile::${seed}` as LearningRoomProfileId;
}

export function createLearningRoomSignatureId(seed: string): LearningRoomSignatureId {
  return `learning-room-signature::${seed}` as LearningRoomSignatureId;
}

export function createLearningRelationshipProfileId(
  seed: string,
): LearningRelationshipProfileId {
  return `learning-relationship-profile::${seed}` as LearningRelationshipProfileId;
}

export function createLearningProfileHeader(params: {
  readonly profileId: LearningProfileId;
  readonly authority?: LearningProfileAuthority;
  readonly createdAtMs: UnixMs;
  readonly privacy?: LearningPrivacyEnvelope;
  readonly coldStartState?: LearningColdStartState;
  readonly coldStartBasis?: LearningColdStartBasis;
  readonly visibleToClient?: LearningProfileVisibilityMode;
  readonly versionSeed: string;
}): LearningProfileHeader {
  return {
    profileId: params.profileId,
    versionId: createLearningProfileVersionId(params.versionSeed),
    authority: params.authority ?? 'BACKEND_AUTHORITATIVE',
    createdAtMs: params.createdAtMs,
    updatedAtMs: params.createdAtMs,
    privacy: params.privacy ?? LEARNING_DEFAULT_PRIVACY_ENVELOPE,
    coldStartState: params.coldStartState ?? 'UNSEEDED',
    coldStartBasis: params.coldStartBasis ?? 'NONE',
    visibleToClient: params.visibleToClient ?? 'CLIENT_MIRROR_SAFE',
  };
}

export function createDefaultLearningPlayerProfile(params: {
  readonly profileId: LearningProfileId;
  readonly playerId: ChatUserId;
  readonly createdAtMs: UnixMs;
  readonly versionSeed: string;
  readonly privacy?: LearningPrivacyEnvelope;
  readonly coldStartBasis?: LearningColdStartBasis;
}): LearningPlayerProfile {
  return {
    header: createLearningProfileHeader({
      profileId: params.profileId,
      createdAtMs: params.createdAtMs,
      versionSeed: params.versionSeed,
      privacy: params.privacy,
      coldStartBasis: params.coldStartBasis,
      coldStartState: 'SEEDED',
    }),
    playerId: params.playerId,
    engagement: {
      ...LEARNING_DEFAULT_ENGAGEMENT,
      updatedAtMs: params.createdAtMs,
    },
    helperReceptivity: {
      ...LEARNING_DEFAULT_HELPER_RECEPTIVITY,
      updatedAtMs: params.createdAtMs,
    },
    haterSusceptibility: {
      ...LEARNING_DEFAULT_HATER_SUSCEPTIBILITY,
      updatedAtMs: params.createdAtMs,
    },
    channelAffinity: {
      entries: [],
      updatedAtMs: params.createdAtMs,
    },
    negotiation: {
      ...LEARNING_DEFAULT_NEGOTIATION_PROFILE,
      updatedAtMs: params.createdAtMs,
    },
    rescueHistory: {
      ...LEARNING_DEFAULT_RESCUE_HISTORY,
      updatedAtMs: params.createdAtMs,
    },
    emotions: {
      entries: LEARNING_DEFAULT_EMOTION_PROFILE.entries.map((entry) => ({
        ...entry,
        updatedAtMs: params.createdAtMs,
      })),
      updatedAtMs: params.createdAtMs,
    },
    memory: {
      ...LEARNING_DEFAULT_MEMORY_PROFILE,
      updatedAtMs: params.createdAtMs,
    },
    relationships: [],
    roomSignatures: [],
    coldStart: {
      coldStartBasis: params.coldStartBasis ?? 'NONE',
      seededAtMs: params.createdAtMs,
    },
    drift: LEARNING_DEFAULT_DRIFT_STATE,
    evaluation: LEARNING_DEFAULT_EVALUATION_STATE,
    models: {
      ...LEARNING_DEFAULT_MODEL_STATE,
      updatedAtMs: params.createdAtMs,
    },
    featureWindowSummary: LEARNING_DEFAULT_FEATURE_WINDOW_SUMMARY,
  };
}

export function createDefaultLearningRoomProfile(params: {
  readonly roomProfileId: LearningRoomProfileId;
  readonly createdAtMs: UnixMs;
  readonly versionSeed: string;
  readonly roomId?: ChatRoomId;
  readonly modeScope?: ChatModeScope;
  readonly mountTarget?: ChatMountTarget;
  readonly signatureKind: LearningRoomSignatureKind;
  readonly privacy?: LearningPrivacyEnvelope;
}): LearningRoomProfile {
  const header = createLearningProfileHeader({
    profileId: params.roomProfileId as unknown as LearningProfileId,
    createdAtMs: params.createdAtMs,
    versionSeed: params.versionSeed,
    privacy: params.privacy,
    coldStartBasis: 'GLOBAL_POPULATION',
    coldStartState: 'SEEDED',
  });

  return {
    header,
    roomProfileId: params.roomProfileId,
    roomId: params.roomId,
    modeScope: params.modeScope,
    mountTarget: params.mountTarget,
    signature: {
      roomSignatureId: createLearningRoomSignatureId(params.versionSeed),
      roomId: params.roomId,
      modeScope: params.modeScope,
      mountTarget: params.mountTarget,
      signatureKind: params.signatureKind,
      updatedAtMs: params.createdAtMs,
    },
    featureWindowSummary: LEARNING_DEFAULT_FEATURE_WINDOW_SUMMARY,
    drift: LEARNING_DEFAULT_DRIFT_STATE,
    evaluation: LEARNING_DEFAULT_EVALUATION_STATE,
    models: {
      ...LEARNING_DEFAULT_MODEL_STATE,
      updatedAtMs: params.createdAtMs,
    },
  };
}

export function toLearningPlayerProfileMirror(
  profile: LearningPlayerProfile,
): LearningPlayerProfileMirror {
  return {
    profileId: profile.header.profileId,
    versionId: profile.header.versionId,
    coldStartState: profile.header.coldStartState,
    engagementTier: profile.engagement.band,
    helperBand: profile.helperReceptivity.band,
    haterBand: profile.haterSusceptibility.band,
    primaryChannelId: profile.channelAffinity.primaryChannelId,
    dominantEmotionAxis: profile.emotions.dominantAxis,
    visibleAnchorCount: profile.memory.totalAnchors,
    updatedAtMs: profile.header.updatedAtMs,
  };
}

export function toLearningRoomProfileMirror(
  profile: LearningRoomProfile,
): LearningRoomProfileMirror {
  return {
    roomProfileId: profile.roomProfileId,
    versionId: profile.header.versionId,
    roomId: profile.roomId,
    modeScope: profile.modeScope,
    mountTarget: profile.mountTarget,
    primaryChannelId: profile.primaryChannelId,
    audienceHeatScore01: profile.audienceHeatScore01,
    hostilityScore01: profile.hostilityScore01,
    updatedAtMs: profile.header.updatedAtMs,
  };
}

export function getLearningChannelAffinity(
  profile: LearningPlayerProfile,
  channelId: ChatChannelId,
): LearningChannelAffinityEntry | undefined {
  return profile.channelAffinity.entries.find((entry) => entry.channelId === channelId);
}

export function getLearningRelationshipProfile(
  profile: LearningPlayerProfile,
  npcId: ChatNpcId,
): LearningRelationshipProfile | undefined {
  return profile.relationships.find((entry) => entry.npcId === npcId);
}

export function getLearningEmotionScore(
  profile: LearningPlayerProfile,
  axis: LearningEmotionAxis,
): Score01 | undefined {
  return profile.emotions.entries.find((entry) => entry.axis === axis)?.score01;
}

export function getLearningMemorySalienceBand(anchor: LearningAnchorDescriptor): LearningMemorySalienceBand {
  if ((anchor.salienceScore as unknown as number) >= 0.95) return 'LEGENDARY';
  if ((anchor.salienceScore as unknown as number) >= 0.75) return 'HIGH';
  if ((anchor.salienceScore as unknown as number) >= 0.45) return 'MEDIUM';
  if ((anchor.salienceScore as unknown as number) > 0.05) return 'LOW';
  return 'EPHEMERAL';
}

// ============================================================================
// MARK: Manifests
// ============================================================================

export const LEARNING_PROFILE_CONTRACT_MANIFEST = {
  contractVersion: CHAT_CONTRACT_VERSION,
  authorities: CHAT_CONTRACT_AUTHORITIES,
  profileAuthorities: LEARNING_PROFILE_AUTHORITIES,
  coldStartStates: LEARNING_COLD_START_STATES,
  engagementTiers: LEARNING_ENGAGEMENT_TIERS,
  helperReceptivityBands: LEARNING_HELPER_RECEPTIVITY_BANDS,
  haterSusceptibilityBands: LEARNING_HATER_SUSCEPTIBILITY_BANDS,
  channelAffinityBands: LEARNING_CHANNEL_AFFINITY_BANDS,
  negotiationStyles: LEARNING_NEGOTIATION_STYLES,
  riskBands: LEARNING_RISK_BANDS,
  memorySalienceBands: LEARNING_MEMORY_SALIENCE_BANDS,
  trustBands: LEARNING_TRUST_BANDS,
  cadenceModes: LEARNING_CADENCE_MODES,
  emotionAxes: LEARNING_EMOTION_AXES,
  roomSignatureKinds: LEARNING_ROOM_SIGNATURE_KINDS,
  decayStrategies: LEARNING_DECAY_STRATEGIES,
  visibilityModes: LEARNING_PROFILE_VISIBILITY_MODES,
} as const;

export type LearningProfileContractManifest =
  typeof LEARNING_PROFILE_CONTRACT_MANIFEST;
