/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT COLD-START DEFAULT CONTRACTS
 * FILE: shared/contracts/chat/learning/ColdStartDefaults.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical cold-start prior, cohort seeding, boot packet, and default policy
 * contracts for the unified chat intelligence lane.
 *
 * Cold-start doctrine
 * -------------------
 * 1. Cold-start must be explicit.
 * 2. Frontend optimism may mirror cold-start packets, but backend authority
 *    chooses packet family, basis, and effective priors.
 * 3. Cold-start must preserve mode, channel, room, invasion, negotiation,
 *    helper, hater, memory, and emotional pacing distinctions.
 * 4. Defaults must remain replay-linkable, policy-auditable, and transport-safe.
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
  type ChatProofHash,
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

import {
  type ChatMessageToneBand,
  type ChatMessageVisibilityClass,
  type ChatThreadId,
} from '../ChatMessage';

import {
  type ChatModerationDecision,
  type ChatModerationSeverityBand,
} from '../ChatModeration';

import {
  type ChatInvasionClass,
  type ChatInvasionId,
  type ChatInvasionKind,
} from '../ChatInvasion';

import {
  type LearningColdStartBasis,
  type LearningDataSplit,
  type LearningDriftStatus,
  type LearningEvaluationVerdict,
  type LearningFeatureBag,
  type LearningFeatureName,
  type LearningFeatureVectorId,
  type LearningLabelKind,
  type LearningMemoryAnchorKind,
  type LearningModelFamily,
  type LearningObservationWindow,
  type LearningPrivacyEnvelope,
  type LearningProfileId,
  type LearningRankingSource,
  type LearningRetentionClass,
  LEARNING_COLD_START_BASES,
  LEARNING_DATA_SPLITS,
  LEARNING_DEFAULT_PRIVACY_ENVELOPE,
  LEARNING_DRIFT_STATUSES,
  LEARNING_EMPTY_OBSERVATION_WINDOW,
  LEARNING_EVALUATION_VERDICTS,
  LEARNING_LABEL_KINDS,
  LEARNING_MEMORY_ANCHOR_KINDS,
  LEARNING_MODEL_FAMILIES,
  LEARNING_RANKING_SOURCES,
  LEARNING_RETENTION_CLASSES,
} from './LearningEvents';

import {
  type LearningCanonicalFeatureGroup,
  type LearningFeatureManifest,
  type LearningFeatureSetRecord,
  type LearningFeatureSnapshot,
  type LearningFeatureVectorSegment,
  LEARNING_CANONICAL_FEATURE_GROUPS,
  LEARNING_CANONICAL_FEATURE_NAMES,
  LEARNING_FEATURE_VECTOR_SEGMENTS,
} from './LearningFeatures';

import {
  type LearningBandWithScore,
  type LearningEmotionProfile,
  type LearningEmotionTag,
  type LearningEngagementTier,
  type LearningHaterSusceptibilityProfile,
  type LearningHelperReceptivityProfile,
  type LearningMemoryProfile,
  type LearningNegotiationProfile,
  type LearningProfileAuthority,
  type LearningProfileHeader,
  type LearningProfileVisibilityMode,
  type LearningRescueHistory,
  type LearningRoomSignature,
  LEARNING_DEFAULT_EMOTION_PROFILE,
  LEARNING_DEFAULT_ENGAGEMENT,
  LEARNING_DEFAULT_HATER_SUSCEPTIBILITY,
  LEARNING_DEFAULT_HELPER_RECEPTIVITY,
  LEARNING_DEFAULT_MEMORY_PROFILE,
  LEARNING_DEFAULT_NEGOTIATION_PROFILE,
  LEARNING_DEFAULT_RESCUE_HISTORY,
  LEARNING_PROFILE_AUTHORITIES,
  LEARNING_PROFILE_VISIBILITY_MODES,
} from './LearningProfile';

import {
  type LearningDatasetTarget,
  type LearningLabelSchema,
  type LearningTruthSet,
} from './LearningLabels';

// ============================================================================
// MARK: Local identifiers
// ============================================================================
export type LearningColdStartPolicyId = Brand<string, 'LearningColdStartPolicyId'>;
export type LearningColdStartPacketId = Brand<string, 'LearningColdStartPacketId'>;
export type LearningColdStartRequestId = Brand<string, 'LearningColdStartRequestId'>;
export type LearningColdStartResultId = Brand<string, 'LearningColdStartResultId'>;
export type LearningColdStartCohortId = Brand<string, 'LearningColdStartCohortId'>;
export type LearningColdStartPriorId = Brand<string, 'LearningColdStartPriorId'>;
export type LearningColdStartPriorSetId = Brand<string, 'LearningColdStartPriorSetId'>;
export type LearningColdStartDecisionId = Brand<string, 'LearningColdStartDecisionId'>;
export type LearningColdStartSignatureId = Brand<string, 'LearningColdStartSignatureId'>;
export type LearningColdStartFamilyId = Brand<string, 'LearningColdStartFamilyId'>;
export type LearningColdStartReceiptId = Brand<string, 'LearningColdStartReceiptId'>;
export type LearningColdStartPopulationId = Brand<string, 'LearningColdStartPopulationId'>;
export type LearningColdStartTransitionId = Brand<string, 'LearningColdStartTransitionId'>;
export type LearningColdStartOverrideId = Brand<string, 'LearningColdStartOverrideId'>;
export type LearningColdStartVectorPresetId = Brand<string, 'LearningColdStartVectorPresetId'>;

// ============================================================================
// MARK: Core vocabularies
// ============================================================================
export const LEARNING_COLD_START_POLICY_KINDS = [
  'GLOBAL_BASELINE',
  'MODE_BASELINE',
  'CHANNEL_BASELINE',
  'ROOM_CLUSTER_BASELINE',
  'NPC_TENSION_BASELINE',
  'NEGOTIATION_BASELINE',
  'RESCUE_SAFETY_BASELINE',
  'LIVEOPS_OVERRIDE',
] as const;
export const LEARNING_COLD_START_PACKET_TARGETS = [
  'BACKEND_AUTHORITATIVE_PROFILE',
  'BACKEND_INFERENCE_BOOT',
  'FRONTEND_MIRROR',
  'SERVER_FANOUT_HINT',
  'RANKING_PRIOR_BOOT',
  'TRAINING_EXCLUSION_FILTER',
] as const;
export const LEARNING_COLD_START_COHORT_AXES = [
  'GLOBAL',
  'MODE',
  'CHANNEL',
  'MOUNT',
  'ROOM_CLASS',
  'INVASION_CLASS',
  'NEGOTIATION_CONTEXT',
  'PRIVACY_MODE',
] as const;
export const LEARNING_COLD_START_CONFIDENCE_BANDS = [
  'UNSPECIFIED',
  'LOW',
  'MEDIUM',
  'HIGH',
  'LOCKED',
] as const;
export const LEARNING_COLD_START_TRANSITION_KINDS = [
  'NONE',
  'EVENT_THRESHOLD',
  'MESSAGE_THRESHOLD',
  'FEATURE_THRESHOLD',
  'LABEL_THRESHOLD',
  'CONFIDENCE_THRESHOLD',
  'TIME_DECAY_REVIEW',
  'MANUAL_OVERRIDE',
] as const;
export const LEARNING_COLD_START_OVERRIDE_KINDS = [
  'NONE',
  'CHANNEL_RULE',
  'MODE_RULE',
  'LIVEOPS_RULE',
  'SAFEGUARD_RULE',
  'TRUSTED_SEED_RULE',
  'OPERATOR_RULE',
] as const;
export const LEARNING_COLD_START_VECTOR_PRESETS = [
  'NEUTRAL',
  'HELPER_FORWARD',
  'HATER_FORWARD',
  'NEGOTIATION_FORWARD',
  'RESCUE_FORWARD',
  'QUIET_OBSERVER',
] as const;
export type LearningColdStartPolicyKind = (typeof LEARNING_COLD_START_POLICY_KINDS)[number];
export type LearningColdStartPacketTarget = (typeof LEARNING_COLD_START_PACKET_TARGETS)[number];
export type LearningColdStartCohortAxis = (typeof LEARNING_COLD_START_COHORT_AXES)[number];
export type LearningColdStartConfidenceBand = (typeof LEARNING_COLD_START_CONFIDENCE_BANDS)[number];
export type LearningColdStartTransitionKind = (typeof LEARNING_COLD_START_TRANSITION_KINDS)[number];
export type LearningColdStartOverrideKind = (typeof LEARNING_COLD_START_OVERRIDE_KINDS)[number];
export type LearningColdStartVectorPreset = (typeof LEARNING_COLD_START_VECTOR_PRESETS)[number];

// ============================================================================
// MARK: Interfaces
// ============================================================================
export interface LearningColdStartCohortSignature {
  readonly signatureId: LearningColdStartSignatureId;
  readonly axes: readonly LearningColdStartCohortAxis[];
  readonly mode: ChatModeScope;
  readonly channelId: ChatChannelId;
  readonly mountTarget: ChatMountTarget;
  readonly roomId?: ChatRoomId;
  readonly invasionClass?: ChatInvasionClass;
  readonly invasionKind?: ChatInvasionKind;
  readonly npcIds: readonly ChatNpcId[];
  readonly rankingSources: readonly LearningRankingSource[];
  readonly labelKinds: readonly LearningLabelKind[];
  readonly retentionClass: LearningRetentionClass;
  readonly privacy: LearningPrivacyEnvelope;
}
export interface LearningColdStartPopulationStats {
  readonly populationId: LearningColdStartPopulationId;
  readonly sampleCount: number;
  readonly replayLinkedSampleCount: number;
  readonly messageCount: number;
  readonly interventionCount: number;
  readonly sceneCount: number;
  readonly offerCount: number;
  readonly driftStatus: LearningDriftStatus;
  readonly evaluationVerdict: LearningEvaluationVerdict;
  readonly lastRefreshedAt: UnixMs;
  readonly dataSplit: LearningDataSplit;
}
export interface LearningColdStartScalarPrior {
  readonly priorId: LearningColdStartPriorId;
  readonly featureName: LearningFeatureName;
  readonly value: number;
  readonly minValue?: number;
  readonly maxValue?: number;
  readonly confidenceBand: LearningColdStartConfidenceBand;
  readonly confidenceScore: Score01;
  readonly basis: LearningColdStartBasis;
}
export interface LearningColdStartRankingSeed {
  readonly source: LearningRankingSource;
  readonly baseWeight: number;
  readonly noveltyFloor: Score01;
  readonly diversityFloor: Score01;
  readonly safetyFloor: Score01;
  readonly continuityBias: Score01;
}
export interface LearningColdStartEmotionSeed {
  readonly primaryTag: LearningEmotionTag;
  readonly intimidation: Score01;
  readonly confidence: Score01;
  readonly frustration: Score01;
  readonly curiosity: Score01;
  readonly trust: Score01;
  readonly socialEmbarrassment: Score01;
  readonly relief: Score01;
  readonly desperation: Score01;
}
export interface LearningColdStartHelperSeed {
  readonly receptivityScore: Score01;
  readonly interventionTolerance: Score01;
  readonly preferredLatencyMs: number;
  readonly prefersDirectness: Score01;
  readonly rescueBias: Score01;
  readonly mentorshipBias: Score01;
}
export interface LearningColdStartHaterSeed {
  readonly susceptibilityScore: Score01;
  readonly tauntTolerance: Score01;
  readonly escalationThreshold: Score01;
  readonly humiliationSensitivity: Score01;
  readonly counterplayReadiness: Score01;
}
export interface LearningColdStartNegotiationSeed {
  readonly bluffLikelihood: Score01;
  readonly urgencySensitivity: Score01;
  readonly aggressionPreference: Score01;
  readonly overpayRisk: Score01;
  readonly panicSellRisk: Score01;
}
export interface LearningColdStartMemorySeed {
  readonly anchorKinds: readonly LearningMemoryAnchorKind[];
  readonly salienceFloor: Score01;
  readonly recallWindowMs: number;
  readonly quoteSensitivity: Score01;
}
export interface LearningColdStartAudienceSeed {
  readonly crowdHeat: Score01;
  readonly swarmBias: Score01;
  readonly ridiculeBias: Score01;
  readonly hypeBias: Score01;
  readonly intimacyBias: Score01;
}
export interface LearningColdStartSceneSeed {
  readonly silenceBias: Score01;
  readonly interruptionBias: Score01;
  readonly helperLeadBias: Score01;
  readonly haterLeadBias: Score01;
  readonly ambientLeadBias: Score01;
  readonly sceneLengthBias: Score01;
}
export interface LearningColdStartPacket {
  readonly packetId: LearningColdStartPacketId;
  readonly target: LearningColdStartPacketTarget;
  readonly authority: LearningProfileAuthority;
  readonly profileId: LearningProfileId;
  readonly requestId: LearningColdStartRequestId;
  readonly resultId: LearningColdStartResultId;
  readonly signature: LearningColdStartCohortSignature;
  readonly featureSnapshot: LearningFeatureSnapshot;
  readonly featureSet: LearningFeatureSetRecord;
  readonly engagement: LearningBandWithScore<LearningEngagementTier>;
  readonly helper: LearningColdStartHelperSeed;
  readonly hater: LearningColdStartHaterSeed;
  readonly negotiation: LearningColdStartNegotiationSeed;
  readonly rescueHistory: LearningRescueHistory;
  readonly emotion: LearningColdStartEmotionSeed;
  readonly memory: LearningColdStartMemorySeed;
  readonly audience: LearningColdStartAudienceSeed;
  readonly scene: LearningColdStartSceneSeed;
  readonly rankingSeeds: readonly LearningColdStartRankingSeed[];
  readonly moderationDecision: ChatModerationDecision;
  readonly moderationSeverity: ChatModerationSeverityBand;
  readonly basis: LearningColdStartBasis;
  readonly vectorPreset: LearningColdStartVectorPreset;
  readonly privacy: LearningPrivacyEnvelope;
  readonly createdAt: UnixMs;
}
export interface LearningColdStartSelectionRequest {
  readonly requestId: LearningColdStartRequestId;
  readonly profileId: LearningProfileId;
  readonly userId: ChatUserId;
  readonly sessionId: ChatSessionId;
  readonly mode: ChatModeScope;
  readonly channelId: ChatChannelId;
  readonly mountTarget: ChatMountTarget;
  readonly roomId?: ChatRoomId;
  readonly roomSignature?: LearningRoomSignature;
  readonly invasionId?: ChatInvasionId;
  readonly invasionClass?: ChatInvasionClass;
  readonly invasionKind?: ChatInvasionKind;
  readonly threadId?: ChatThreadId;
  readonly messageId?: ChatMessageId;
  readonly replayId?: ChatReplayId;
  readonly sceneId?: ChatSceneId;
  readonly offerId?: ChatOfferId;
  readonly worldEventId?: ChatWorldEventId;
  readonly legendId?: ChatLegendId;
  readonly memoryAnchorId?: ChatMemoryAnchorId;
  readonly npcIds: readonly ChatNpcId[];
  readonly rankingSources: readonly LearningRankingSource[];
  readonly privacy: LearningPrivacyEnvelope;
  readonly createdAt: UnixMs;
}
export interface LearningColdStartTransitionRule {
  readonly transitionId: LearningColdStartTransitionId;
  readonly kind: LearningColdStartTransitionKind;
  readonly minimumMessages?: number;
  readonly minimumEvents?: number;
  readonly minimumFeatureFreshnessScore?: Score01;
  readonly minimumLabelCount?: number;
  readonly minimumConfidenceScore?: Score01;
  readonly timeWindowMs?: number;
  readonly retirePacketTargets: readonly LearningColdStartPacketTarget[];
}
export interface LearningColdStartPolicy {
  readonly policyId: LearningColdStartPolicyId;
  readonly kind: LearningColdStartPolicyKind;
  readonly description: string;
  readonly packetTargets: readonly LearningColdStartPacketTarget[];
  readonly supportedModes: readonly ChatModeScope[];
  readonly supportedChannels: readonly ChatChannelId[];
  readonly supportedMounts: readonly ChatMountTarget[];
  readonly rankingSources: readonly LearningRankingSource[];
  readonly labelKinds: readonly LearningLabelKind[];
  readonly canonicalFeatureGroups: readonly LearningCanonicalFeatureGroup[];
  readonly featureVectorSegments: readonly LearningFeatureVectorSegment[];
  readonly defaultPrivacy: LearningPrivacyEnvelope;
  readonly transitionRules: readonly LearningColdStartTransitionRule[];
  readonly enabled: boolean;
}

// ============================================================================
// MARK: Defaults
// ============================================================================
export const LEARNING_DEFAULT_COLD_START_FEATURE_BAG: LearningFeatureBag = {
  'engagement.current': 0.5,
  'engagement.decay.adjusted': 0.5,
  'helper.receptivity': 0.58,
  'helper.intervention.latency.preference': 0.62,
  'hater.susceptibility': 0.42,
  'hater.taunt.tolerance': 0.55,
  'emotion.confidence': 0.5,
  'emotion.frustration': 0.22,
  'emotion.social_embarrassment': 0.14,
  'audience.heat': 0.37,
  'negotiation.bluff_likelihood': 0.41,
  'negotiation.urgency_sensitivity': 0.48,
  'scene.silence_bias': 0.33,
  'scene.interruption_bias': 0.27,
  'memory.quote_sensitivity': 0.52,
  'memory.salience_floor': 0.45,
};
export const LEARNING_DEFAULT_COLD_START_EMOTION: LearningColdStartEmotionSeed = {
  primaryTag: 'CURIOUS',
  intimidation: 0.18 as Score01,
  confidence: 0.50 as Score01,
  frustration: 0.20 as Score01,
  curiosity: 0.63 as Score01,
  trust: 0.46 as Score01,
  socialEmbarrassment: 0.12 as Score01,
  relief: 0.28 as Score01,
  desperation: 0.08 as Score01,
};
export const LEARNING_DEFAULT_COLD_START_HELPER: LearningColdStartHelperSeed = {
  receptivityScore: 0.58 as Score01,
  interventionTolerance: 0.61 as Score01,
  preferredLatencyMs: 1750,
  prefersDirectness: 0.54 as Score01,
  rescueBias: 0.62 as Score01,
  mentorshipBias: 0.57 as Score01,
};
export const LEARNING_DEFAULT_COLD_START_HATER: LearningColdStartHaterSeed = {
  susceptibilityScore: 0.42 as Score01,
  tauntTolerance: 0.55 as Score01,
  escalationThreshold: 0.63 as Score01,
  humiliationSensitivity: 0.31 as Score01,
  counterplayReadiness: 0.49 as Score01,
};
export const LEARNING_DEFAULT_COLD_START_NEGOTIATION: LearningColdStartNegotiationSeed = {
  bluffLikelihood: 0.41 as Score01,
  urgencySensitivity: 0.48 as Score01,
  aggressionPreference: 0.44 as Score01,
  overpayRisk: 0.21 as Score01,
  panicSellRisk: 0.13 as Score01,
};
export const LEARNING_DEFAULT_COLD_START_MEMORY: LearningColdStartMemorySeed = {
  anchorKinds: ['QUOTE', 'FAILURE', 'COMEBACK'],
  salienceFloor: 0.45 as Score01,
  recallWindowMs: 1000 * 60 * 20,
  quoteSensitivity: 0.52 as Score01,
};
export const LEARNING_DEFAULT_COLD_START_AUDIENCE: LearningColdStartAudienceSeed = {
  crowdHeat: 0.37 as Score01,
  swarmBias: 0.22 as Score01,
  ridiculeBias: 0.16 as Score01,
  hypeBias: 0.31 as Score01,
  intimacyBias: 0.44 as Score01,
};
export const LEARNING_DEFAULT_COLD_START_SCENE: LearningColdStartSceneSeed = {
  silenceBias: 0.33 as Score01,
  interruptionBias: 0.27 as Score01,
  helperLeadBias: 0.42 as Score01,
  haterLeadBias: 0.25 as Score01,
  ambientLeadBias: 0.18 as Score01,
  sceneLengthBias: 0.39 as Score01,
};
export const LEARNING_DEFAULT_COLD_START_RANKING_SEEDS: readonly LearningColdStartRankingSeed[] = [
  {
    source: 'HELPER_RESPONSE',
    baseWeight: 1.08,
    noveltyFloor: 0.24 as Score01,
    diversityFloor: 0.36 as Score01,
    safetyFloor: 0.78 as Score01,
    continuityBias: 0.61 as Score01,
  },
  {
    source: 'HATER_RESPONSE',
    baseWeight: 0.92,
    noveltyFloor: 0.31 as Score01,
    diversityFloor: 0.42 as Score01,
    safetyFloor: 0.63 as Score01,
    continuityBias: 0.48 as Score01,
  },
  {
    source: 'NPC_AMBIENT',
    baseWeight: 0.71,
    noveltyFloor: 0.4 as Score01,
    diversityFloor: 0.46 as Score01,
    safetyFloor: 0.84 as Score01,
    continuityBias: 0.39 as Score01,
  },
  {
    source: 'CHANNEL_RECOMMENDATION',
    baseWeight: 0.84,
    noveltyFloor: 0.19 as Score01,
    diversityFloor: 0.28 as Score01,
    safetyFloor: 0.88 as Score01,
    continuityBias: 0.53 as Score01,
  },
  {
    source: 'DEALROOM_COUNTER',
    baseWeight: 1.02,
    noveltyFloor: 0.26 as Score01,
    diversityFloor: 0.34 as Score01,
    safetyFloor: 0.76 as Score01,
    continuityBias: 0.67 as Score01,
  },
  {
    source: 'RESCUE_PROMPT',
    baseWeight: 1.14,
    noveltyFloor: 0.22 as Score01,
    diversityFloor: 0.29 as Score01,
    safetyFloor: 0.91 as Score01,
    continuityBias: 0.64 as Score01,
  },
  {
    source: 'POST_RUN_SUMMARY',
    baseWeight: 0.88,
    noveltyFloor: 0.36 as Score01,
    diversityFloor: 0.38 as Score01,
    safetyFloor: 0.93 as Score01,
    continuityBias: 0.73 as Score01,
  },
];

// ============================================================================
// MARK: Mode/channel packet presets
// ============================================================================
export const LEARNING_MODE_CHANNEL_COLD_START_PRESETS = {
  LOBBY_GLOBAL: {
    mode: 'LOBBY' as ChatModeScope,
    channelId: 'GLOBAL' as ChatChannelId,
    mountTarget: 'LOBBY_DOCK' as ChatMountTarget,
    vectorPreset: 'HELPER_FORWARD' as LearningColdStartVectorPreset,
    policyKind: 'RESCUE_SAFETY_BASELINE' as LearningColdStartPolicyKind,
    helperBias: 0.45 as Score01,
    haterBias: 0.18 as Score01,
    negotiationBias: 0.12 as Score01,
    audienceHeatBias: 0.2 as Score01,
    silenceBias: 0.18 as Score01,
  },
  BATTLE_GLOBAL: {
    mode: 'BATTLE' as ChatModeScope,
    channelId: 'GLOBAL' as ChatChannelId,
    mountTarget: 'BATTLE_HUD' as ChatMountTarget,
    vectorPreset: 'HATER_FORWARD' as LearningColdStartVectorPreset,
    policyKind: 'NPC_TENSION_BASELINE' as LearningColdStartPolicyKind,
    helperBias: 0.48 as Score01,
    haterBias: 0.2 as Score01,
    negotiationBias: 0.14 as Score01,
    audienceHeatBias: 0.24 as Score01,
    silenceBias: 0.2 as Score01,
  },
  RUN_SYNDICATE: {
    mode: 'RUN' as ChatModeScope,
    channelId: 'SYNDICATE' as ChatChannelId,
    mountTarget: 'RUN_HUD' as ChatMountTarget,
    vectorPreset: 'HELPER_FORWARD' as LearningColdStartVectorPreset,
    policyKind: 'MODE_BASELINE' as LearningColdStartPolicyKind,
    helperBias: 0.51 as Score01,
    haterBias: 0.22 as Score01,
    negotiationBias: 0.17 as Score01,
    audienceHeatBias: 0.28 as Score01,
    silenceBias: 0.21 as Score01,
  },
  DEALROOM_DEAL_ROOM: {
    mode: 'DEALROOM' as ChatModeScope,
    channelId: 'DEAL_ROOM' as ChatChannelId,
    mountTarget: 'DEALROOM_PANEL' as ChatMountTarget,
    vectorPreset: 'NEGOTIATION_FORWARD' as LearningColdStartVectorPreset,
    policyKind: 'NEGOTIATION_BASELINE' as LearningColdStartPolicyKind,
    helperBias: 0.54 as Score01,
    haterBias: 0.24 as Score01,
    negotiationBias: 0.2 as Score01,
    audienceHeatBias: 0.32 as Score01,
    silenceBias: 0.22 as Score01,
  },
  GLOBAL_GLOBAL: {
    mode: 'GLOBAL' as ChatModeScope,
    channelId: 'GLOBAL' as ChatChannelId,
    mountTarget: 'GLOBAL_DOCK' as ChatMountTarget,
    vectorPreset: 'NEUTRAL' as LearningColdStartVectorPreset,
    policyKind: 'GLOBAL_BASELINE' as LearningColdStartPolicyKind,
    helperBias: 0.57 as Score01,
    haterBias: 0.26 as Score01,
    negotiationBias: 0.22 as Score01,
    audienceHeatBias: 0.36 as Score01,
    silenceBias: 0.24 as Score01,
  },
  ONBOARDING_LOBBY: {
    mode: 'ONBOARDING' as ChatModeScope,
    channelId: 'LOBBY' as ChatChannelId,
    mountTarget: 'GUIDE_DOCK' as ChatMountTarget,
    vectorPreset: 'HELPER_FORWARD' as LearningColdStartVectorPreset,
    policyKind: 'RESCUE_SAFETY_BASELINE' as LearningColdStartPolicyKind,
    helperBias: 0.6 as Score01,
    haterBias: 0.28 as Score01,
    negotiationBias: 0.24 as Score01,
    audienceHeatBias: 0.4 as Score01,
    silenceBias: 0.26 as Score01,
  },
  PVP_SYNDICATE: {
    mode: 'PVP' as ChatModeScope,
    channelId: 'SYNDICATE' as ChatChannelId,
    mountTarget: 'BATTLE_HUD' as ChatMountTarget,
    vectorPreset: 'HATER_FORWARD' as LearningColdStartVectorPreset,
    policyKind: 'NPC_TENSION_BASELINE' as LearningColdStartPolicyKind,
    helperBias: 0.63 as Score01,
    haterBias: 0.3 as Score01,
    negotiationBias: 0.27 as Score01,
    audienceHeatBias: 0.44 as Score01,
    silenceBias: 0.27 as Score01,
  },
  MARKET_DEAL_ROOM: {
    mode: 'MARKET' as ChatModeScope,
    channelId: 'DEAL_ROOM' as ChatChannelId,
    mountTarget: 'DEALROOM_PANEL' as ChatMountTarget,
    vectorPreset: 'NEGOTIATION_FORWARD' as LearningColdStartVectorPreset,
    policyKind: 'NEGOTIATION_BASELINE' as LearningColdStartPolicyKind,
    helperBias: 0.66 as Score01,
    haterBias: 0.32 as Score01,
    negotiationBias: 0.3 as Score01,
    audienceHeatBias: 0.48 as Score01,
    silenceBias: 0.28 as Score01,
  },
} as const;
export type LearningModeChannelColdStartPresetKey = keyof typeof LEARNING_MODE_CHANNEL_COLD_START_PRESETS;

// ============================================================================
// MARK: Default feature prior registry
// ============================================================================
export const LEARNING_DEFAULT_COLD_START_FEATURE_PRIOR_REGISTRY = {
  'engagement.current': {
    priorId: 'coldstart-prior::registry::engagement.current' as LearningColdStartPriorId,
    featureName: 'engagement.current' as LearningFeatureName,
    value: 0.2,
    minValue: 0,
    maxValue: 1,
    confidenceBand: 'HIGH' as LearningColdStartConfidenceBand,
    confidenceScore: 0.82 as Score01,
    basis: 'GLOBAL_POPULATION' as LearningColdStartBasis,
  },
  'engagement.decay.adjusted': {
    priorId: 'coldstart-prior::registry::engagement.decay.adjusted' as LearningColdStartPriorId,
    featureName: 'engagement.decay.adjusted' as LearningFeatureName,
    value: 0.237,
    minValue: 0,
    maxValue: 1,
    confidenceBand: 'HIGH' as LearningColdStartConfidenceBand,
    confidenceScore: 0.81 as Score01,
    basis: 'MODE_POPULATION' as LearningColdStartBasis,
  },
  'helper.receptivity': {
    priorId: 'coldstart-prior::registry::helper.receptivity' as LearningColdStartPriorId,
    featureName: 'helper.receptivity' as LearningFeatureName,
    value: 0.274,
    minValue: 0,
    maxValue: 1,
    confidenceBand: 'HIGH' as LearningColdStartConfidenceBand,
    confidenceScore: 0.8 as Score01,
    basis: 'CHANNEL_POPULATION' as LearningColdStartBasis,
  },
  'helper.intervention.latency.preference': {
    priorId: 'coldstart-prior::registry::helper.intervention.latency.preference' as LearningColdStartPriorId,
    featureName: 'helper.intervention.latency.preference' as LearningFeatureName,
    value: 0.311,
    minValue: 0,
    maxValue: 1,
    confidenceBand: 'HIGH' as LearningColdStartConfidenceBand,
    confidenceScore: 0.79 as Score01,
    basis: 'GLOBAL_POPULATION' as LearningColdStartBasis,
  },
  'helper.directness.preference': {
    priorId: 'coldstart-prior::registry::helper.directness.preference' as LearningColdStartPriorId,
    featureName: 'helper.directness.preference' as LearningFeatureName,
    value: 0.348,
    minValue: 0,
    maxValue: 1,
    confidenceBand: 'HIGH' as LearningColdStartConfidenceBand,
    confidenceScore: 0.78 as Score01,
    basis: 'MODE_POPULATION' as LearningColdStartBasis,
  },
  'hater.susceptibility': {
    priorId: 'coldstart-prior::registry::hater.susceptibility' as LearningColdStartPriorId,
    featureName: 'hater.susceptibility' as LearningFeatureName,
    value: 0.385,
    minValue: 0,
    maxValue: 1,
    confidenceBand: 'HIGH' as LearningColdStartConfidenceBand,
    confidenceScore: 0.77 as Score01,
    basis: 'CHANNEL_POPULATION' as LearningColdStartBasis,
  },
  'hater.taunt.tolerance': {
    priorId: 'coldstart-prior::registry::hater.taunt.tolerance' as LearningColdStartPriorId,
    featureName: 'hater.taunt.tolerance' as LearningFeatureName,
    value: 0.422,
    minValue: 0,
    maxValue: 1,
    confidenceBand: 'HIGH' as LearningColdStartConfidenceBand,
    confidenceScore: 0.76 as Score01,
    basis: 'GLOBAL_POPULATION' as LearningColdStartBasis,
  },
  'hater.escalation.threshold': {
    priorId: 'coldstart-prior::registry::hater.escalation.threshold' as LearningColdStartPriorId,
    featureName: 'hater.escalation.threshold' as LearningFeatureName,
    value: 0.459,
    minValue: 0,
    maxValue: 1,
    confidenceBand: 'HIGH' as LearningColdStartConfidenceBand,
    confidenceScore: 0.75 as Score01,
    basis: 'MODE_POPULATION' as LearningColdStartBasis,
  },
  'emotion.confidence': {
    priorId: 'coldstart-prior::registry::emotion.confidence' as LearningColdStartPriorId,
    featureName: 'emotion.confidence' as LearningFeatureName,
    value: 0.496,
    minValue: 0,
    maxValue: 1,
    confidenceBand: 'HIGH' as LearningColdStartConfidenceBand,
    confidenceScore: 0.74 as Score01,
    basis: 'CHANNEL_POPULATION' as LearningColdStartBasis,
  },
  'emotion.frustration': {
    priorId: 'coldstart-prior::registry::emotion.frustration' as LearningColdStartPriorId,
    featureName: 'emotion.frustration' as LearningFeatureName,
    value: 0.533,
    minValue: 0,
    maxValue: 1,
    confidenceBand: 'HIGH' as LearningColdStartConfidenceBand,
    confidenceScore: 0.73 as Score01,
    basis: 'GLOBAL_POPULATION' as LearningColdStartBasis,
  },
  'emotion.curiosity': {
    priorId: 'coldstart-prior::registry::emotion.curiosity' as LearningColdStartPriorId,
    featureName: 'emotion.curiosity' as LearningFeatureName,
    value: 0.57,
    minValue: 0,
    maxValue: 1,
    confidenceBand: 'HIGH' as LearningColdStartConfidenceBand,
    confidenceScore: 0.72 as Score01,
    basis: 'MODE_POPULATION' as LearningColdStartBasis,
  },
  'emotion.trust': {
    priorId: 'coldstart-prior::registry::emotion.trust' as LearningColdStartPriorId,
    featureName: 'emotion.trust' as LearningFeatureName,
    value: 0.607,
    minValue: 0,
    maxValue: 1,
    confidenceBand: 'HIGH' as LearningColdStartConfidenceBand,
    confidenceScore: 0.71 as Score01,
    basis: 'CHANNEL_POPULATION' as LearningColdStartBasis,
  },
  'emotion.social_embarrassment': {
    priorId: 'coldstart-prior::registry::emotion.social_embarrassment' as LearningColdStartPriorId,
    featureName: 'emotion.social_embarrassment' as LearningFeatureName,
    value: 0.644,
    minValue: 0,
    maxValue: 1,
    confidenceBand: 'MEDIUM' as LearningColdStartConfidenceBand,
    confidenceScore: 0.69 as Score01,
    basis: 'GLOBAL_POPULATION' as LearningColdStartBasis,
  },
  'audience.heat': {
    priorId: 'coldstart-prior::registry::audience.heat' as LearningColdStartPriorId,
    featureName: 'audience.heat' as LearningFeatureName,
    value: 0.681,
    minValue: 0,
    maxValue: 1,
    confidenceBand: 'MEDIUM' as LearningColdStartConfidenceBand,
    confidenceScore: 0.685 as Score01,
    basis: 'MODE_POPULATION' as LearningColdStartBasis,
  },
  'audience.swarm_bias': {
    priorId: 'coldstart-prior::registry::audience.swarm_bias' as LearningColdStartPriorId,
    featureName: 'audience.swarm_bias' as LearningFeatureName,
    value: 0.718,
    minValue: 0,
    maxValue: 1,
    confidenceBand: 'MEDIUM' as LearningColdStartConfidenceBand,
    confidenceScore: 0.68 as Score01,
    basis: 'CHANNEL_POPULATION' as LearningColdStartBasis,
  },
  'audience.hype_bias': {
    priorId: 'coldstart-prior::registry::audience.hype_bias' as LearningColdStartPriorId,
    featureName: 'audience.hype_bias' as LearningFeatureName,
    value: 0.755,
    minValue: 0,
    maxValue: 1,
    confidenceBand: 'MEDIUM' as LearningColdStartConfidenceBand,
    confidenceScore: 0.675 as Score01,
    basis: 'GLOBAL_POPULATION' as LearningColdStartBasis,
  },
  'negotiation.bluff_likelihood': {
    priorId: 'coldstart-prior::registry::negotiation.bluff_likelihood' as LearningColdStartPriorId,
    featureName: 'negotiation.bluff_likelihood' as LearningFeatureName,
    value: 0.792,
    minValue: 0,
    maxValue: 1,
    confidenceBand: 'MEDIUM' as LearningColdStartConfidenceBand,
    confidenceScore: 0.67 as Score01,
    basis: 'MODE_POPULATION' as LearningColdStartBasis,
  },
  'negotiation.urgency_sensitivity': {
    priorId: 'coldstart-prior::registry::negotiation.urgency_sensitivity' as LearningColdStartPriorId,
    featureName: 'negotiation.urgency_sensitivity' as LearningFeatureName,
    value: 0.229,
    minValue: 0,
    maxValue: 1,
    confidenceBand: 'MEDIUM' as LearningColdStartConfidenceBand,
    confidenceScore: 0.665 as Score01,
    basis: 'CHANNEL_POPULATION' as LearningColdStartBasis,
  },
  'negotiation.aggression_preference': {
    priorId: 'coldstart-prior::registry::negotiation.aggression_preference' as LearningColdStartPriorId,
    featureName: 'negotiation.aggression_preference' as LearningFeatureName,
    value: 0.266,
    minValue: 0,
    maxValue: 1,
    confidenceBand: 'MEDIUM' as LearningColdStartConfidenceBand,
    confidenceScore: 0.66 as Score01,
    basis: 'GLOBAL_POPULATION' as LearningColdStartBasis,
  },
  'scene.silence_bias': {
    priorId: 'coldstart-prior::registry::scene.silence_bias' as LearningColdStartPriorId,
    featureName: 'scene.silence_bias' as LearningFeatureName,
    value: 0.303,
    minValue: 0,
    maxValue: 1,
    confidenceBand: 'MEDIUM' as LearningColdStartConfidenceBand,
    confidenceScore: 0.655 as Score01,
    basis: 'MODE_POPULATION' as LearningColdStartBasis,
  },
  'scene.interruption_bias': {
    priorId: 'coldstart-prior::registry::scene.interruption_bias' as LearningColdStartPriorId,
    featureName: 'scene.interruption_bias' as LearningFeatureName,
    value: 0.34,
    minValue: 0,
    maxValue: 1,
    confidenceBand: 'MEDIUM' as LearningColdStartConfidenceBand,
    confidenceScore: 0.65 as Score01,
    basis: 'CHANNEL_POPULATION' as LearningColdStartBasis,
  },
  'scene.helper_lead_bias': {
    priorId: 'coldstart-prior::registry::scene.helper_lead_bias' as LearningColdStartPriorId,
    featureName: 'scene.helper_lead_bias' as LearningFeatureName,
    value: 0.377,
    minValue: 0,
    maxValue: 1,
    confidenceBand: 'MEDIUM' as LearningColdStartConfidenceBand,
    confidenceScore: 0.645 as Score01,
    basis: 'GLOBAL_POPULATION' as LearningColdStartBasis,
  },
  'memory.quote_sensitivity': {
    priorId: 'coldstart-prior::registry::memory.quote_sensitivity' as LearningColdStartPriorId,
    featureName: 'memory.quote_sensitivity' as LearningFeatureName,
    value: 0.414,
    minValue: 0,
    maxValue: 1,
    confidenceBand: 'MEDIUM' as LearningColdStartConfidenceBand,
    confidenceScore: 0.64 as Score01,
    basis: 'MODE_POPULATION' as LearningColdStartBasis,
  },
  'memory.salience_floor': {
    priorId: 'coldstart-prior::registry::memory.salience_floor' as LearningColdStartPriorId,
    featureName: 'memory.salience_floor' as LearningFeatureName,
    value: 0.451,
    minValue: 0,
    maxValue: 1,
    confidenceBand: 'MEDIUM' as LearningColdStartConfidenceBand,
    confidenceScore: 0.635 as Score01,
    basis: 'CHANNEL_POPULATION' as LearningColdStartBasis,
  },
} as const;

// ============================================================================
// MARK: Transition rules and policies
// ============================================================================
export const LEARNING_COLD_START_TRANSITION_RULES: readonly LearningColdStartTransitionRule[] = [
  {
    transitionId: 'coldstart-transition::messages-8' as LearningColdStartTransitionId,
    kind: 'MESSAGE_THRESHOLD',
    minimumMessages: 8,
    retirePacketTargets: ['FRONTEND_MIRROR'],
  },
  {
    transitionId: 'coldstart-transition::events-24' as LearningColdStartTransitionId,
    kind: 'EVENT_THRESHOLD',
    minimumEvents: 24,
    retirePacketTargets: ['SERVER_FANOUT_HINT'],
  },
  {
    transitionId: 'coldstart-transition::features-0_72' as LearningColdStartTransitionId,
    kind: 'FEATURE_THRESHOLD',
    minimumFeatureFreshnessScore: 0.72 as Score01,
    retirePacketTargets: ['RANKING_PRIOR_BOOT'],
  },
  {
    transitionId: 'coldstart-transition::labels-6' as LearningColdStartTransitionId,
    kind: 'LABEL_THRESHOLD',
    minimumLabelCount: 6,
    retirePacketTargets: ['TRAINING_EXCLUSION_FILTER'],
  },
  {
    transitionId: 'coldstart-transition::confidence-0_81' as LearningColdStartTransitionId,
    kind: 'CONFIDENCE_THRESHOLD',
    minimumConfidenceScore: 0.81 as Score01,
    retirePacketTargets: ['BACKEND_INFERENCE_BOOT'],
  },
];
export const LEARNING_COLD_START_POLICIES: readonly LearningColdStartPolicy[] = [
  {
    policyId: 'coldstart-policy::global-baseline' as LearningColdStartPolicyId,
    kind: 'GLOBAL_BASELINE',
    description: 'Global baseline for neutral boot when no stronger axis match exists.',
    packetTargets: ['BACKEND_AUTHORITATIVE_PROFILE', 'BACKEND_INFERENCE_BOOT', 'FRONTEND_MIRROR', 'RANKING_PRIOR_BOOT'],
    supportedModes: ['GLOBAL' as ChatModeScope],
    supportedChannels: ['GLOBAL' as ChatChannelId, 'LOBBY' as ChatChannelId],
    supportedMounts: ['GLOBAL_DOCK' as ChatMountTarget, 'LOBBY_DOCK' as ChatMountTarget],
    rankingSources: ['HELPER_RESPONSE', 'NPC_AMBIENT', 'CHANNEL_RECOMMENDATION'],
    labelKinds: LEARNING_LABEL_KINDS,
    canonicalFeatureGroups: LEARNING_CANONICAL_FEATURE_GROUPS,
    featureVectorSegments: LEARNING_FEATURE_VECTOR_SEGMENTS,
    defaultPrivacy: LEARNING_DEFAULT_PRIVACY_ENVELOPE,
    transitionRules: LEARNING_COLD_START_TRANSITION_RULES,
    enabled: true,
  },
  {
    policyId: 'coldstart-policy::npc-tension' as LearningColdStartPolicyId,
    kind: 'NPC_TENSION_BASELINE',
    description: 'Higher-pressure baseline for battle, invasion, spectacle, and rivalry-heavy moments.',
    packetTargets: ['BACKEND_AUTHORITATIVE_PROFILE', 'BACKEND_INFERENCE_BOOT', 'FRONTEND_MIRROR', 'RANKING_PRIOR_BOOT'],
    supportedModes: ['BATTLE' as ChatModeScope, 'PVP' as ChatModeScope, 'RUN' as ChatModeScope],
    supportedChannels: ['GLOBAL' as ChatChannelId, 'SYNDICATE' as ChatChannelId],
    supportedMounts: ['BATTLE_HUD' as ChatMountTarget, 'RUN_HUD' as ChatMountTarget],
    rankingSources: ['HATER_RESPONSE', 'NPC_AMBIENT', 'CHANNEL_RECOMMENDATION'],
    labelKinds: LEARNING_LABEL_KINDS,
    canonicalFeatureGroups: LEARNING_CANONICAL_FEATURE_GROUPS,
    featureVectorSegments: LEARNING_FEATURE_VECTOR_SEGMENTS,
    defaultPrivacy: LEARNING_DEFAULT_PRIVACY_ENVELOPE,
    transitionRules: LEARNING_COLD_START_TRANSITION_RULES,
    enabled: true,
  },
  {
    policyId: 'coldstart-policy::negotiation' as LearningColdStartPolicyId,
    kind: 'NEGOTIATION_BASELINE',
    description: 'Deal-room baseline emphasizing bluff sensitivity, urgency, counteroffers, and quieter pacing.',
    packetTargets: ['BACKEND_AUTHORITATIVE_PROFILE', 'BACKEND_INFERENCE_BOOT', 'FRONTEND_MIRROR', 'RANKING_PRIOR_BOOT'],
    supportedModes: ['DEALROOM' as ChatModeScope, 'MARKET' as ChatModeScope],
    supportedChannels: ['DEAL_ROOM' as ChatChannelId],
    supportedMounts: ['DEALROOM_PANEL' as ChatMountTarget],
    rankingSources: ['DEALROOM_COUNTER', 'CHANNEL_RECOMMENDATION', 'HELPER_RESPONSE'],
    labelKinds: LEARNING_LABEL_KINDS,
    canonicalFeatureGroups: LEARNING_CANONICAL_FEATURE_GROUPS,
    featureVectorSegments: LEARNING_FEATURE_VECTOR_SEGMENTS,
    defaultPrivacy: LEARNING_DEFAULT_PRIVACY_ENVELOPE,
    transitionRules: LEARNING_COLD_START_TRANSITION_RULES,
    enabled: true,
  },
  {
    policyId: 'coldstart-policy::rescue-safety' as LearningColdStartPolicyId,
    kind: 'RESCUE_SAFETY_BASELINE',
    description: 'Safer baseline for ambiguous, onboarding, low-history, or churn-risk-adjacent contexts.',
    packetTargets: ['BACKEND_AUTHORITATIVE_PROFILE', 'BACKEND_INFERENCE_BOOT', 'FRONTEND_MIRROR', 'RANKING_PRIOR_BOOT'],
    supportedModes: ['LOBBY' as ChatModeScope, 'ONBOARDING' as ChatModeScope, 'GLOBAL' as ChatModeScope],
    supportedChannels: ['GLOBAL' as ChatChannelId, 'LOBBY' as ChatChannelId, 'SYNDICATE' as ChatChannelId],
    supportedMounts: ['GLOBAL_DOCK' as ChatMountTarget, 'LOBBY_DOCK' as ChatMountTarget, 'GUIDE_DOCK' as ChatMountTarget],
    rankingSources: ['HELPER_RESPONSE', 'RESCUE_PROMPT', 'CHANNEL_RECOMMENDATION'],
    labelKinds: LEARNING_LABEL_KINDS,
    canonicalFeatureGroups: LEARNING_CANONICAL_FEATURE_GROUPS,
    featureVectorSegments: LEARNING_FEATURE_VECTOR_SEGMENTS,
    defaultPrivacy: LEARNING_DEFAULT_PRIVACY_ENVELOPE,
    transitionRules: LEARNING_COLD_START_TRANSITION_RULES,
    enabled: true,
  },
];

// ============================================================================
// MARK: Helpers
// ============================================================================
export function createLearningColdStartPolicyId(seed: string): LearningColdStartPolicyId {
  return `coldstart-policy::${seed}` as LearningColdStartPolicyId;
}
export function createLearningColdStartPacketId(seed: string): LearningColdStartPacketId {
  return `coldstart-packet::${seed}` as LearningColdStartPacketId;
}
export function createLearningColdStartRequestId(seed: string): LearningColdStartRequestId {
  return `coldstart-request::${seed}` as LearningColdStartRequestId;
}
export function createLearningColdStartResultId(seed: string): LearningColdStartResultId {
  return `coldstart-result::${seed}` as LearningColdStartResultId;
}
export function createLearningColdStartReceiptId(seed: string): LearningColdStartReceiptId {
  return `coldstart-receipt::${seed}` as LearningColdStartReceiptId;
}
export interface CreateLearningColdStartPacketParams {
  readonly packetId: LearningColdStartPacketId;
  readonly target: LearningColdStartPacketTarget;
  readonly authority: LearningProfileAuthority;
  readonly profileId: LearningProfileId;
  readonly requestId: LearningColdStartRequestId;
  readonly resultId: LearningColdStartResultId;
  readonly signature?: LearningColdStartCohortSignature;
  readonly rankingSeeds?: readonly LearningColdStartRankingSeed[];
  readonly privacy?: LearningPrivacyEnvelope;
  readonly createdAt?: UnixMs;
}
export function createLearningColdStartPacket(params: CreateLearningColdStartPacketParams): LearningColdStartPacket {
  return {
    packetId: params.packetId,
    target: params.target,
    authority: params.authority,
    profileId: params.profileId,
    requestId: params.requestId,
    resultId: params.resultId,
    signature: params.signature ?? {
      signatureId: 'coldstart-signature::neutral' as LearningColdStartSignatureId,
      axes: ['GLOBAL', 'MODE', 'CHANNEL', 'MOUNT', 'PRIVACY_MODE'],
      mode: 'GLOBAL' as ChatModeScope,
      channelId: 'GLOBAL' as ChatChannelId,
      mountTarget: 'GLOBAL_DOCK' as ChatMountTarget,
      npcIds: [],
      rankingSources: LEARNING_RANKING_SOURCES,
      labelKinds: LEARNING_LABEL_KINDS,
      retentionClass: 'STANDARD',
      privacy: params.privacy ?? LEARNING_DEFAULT_PRIVACY_ENVELOPE,
    },
    featureSnapshot: {
      snapshotId: 'feature-snapshot::coldstart::default',
      profileId: params.profileId,
      setId: 'feature-set::coldstart::default',
      createdAt: params.createdAt ?? (0 as UnixMs),
      featureBag: LEARNING_DEFAULT_COLD_START_FEATURE_BAG,
      privacy: params.privacy ?? LEARNING_DEFAULT_PRIVACY_ENVELOPE,
      manifestVersion: CHAT_CONTRACT_VERSION,
    } as unknown as LearningFeatureSnapshot,
    featureSet: {
      setId: 'feature-set::coldstart::default',
      profileId: params.profileId,
      manifestId: 'feature-manifest::coldstart::default',
      currentBag: LEARNING_DEFAULT_COLD_START_FEATURE_BAG,
      currentWindow: LEARNING_EMPTY_OBSERVATION_WINDOW,
      privacy: params.privacy ?? LEARNING_DEFAULT_PRIVACY_ENVELOPE,
      updatedAt: params.createdAt ?? (0 as UnixMs),
    } as unknown as LearningFeatureSetRecord,
    engagement: LEARNING_DEFAULT_ENGAGEMENT,
    helper: LEARNING_DEFAULT_COLD_START_HELPER,
    hater: LEARNING_DEFAULT_COLD_START_HATER,
    negotiation: LEARNING_DEFAULT_COLD_START_NEGOTIATION,
    rescueHistory: LEARNING_DEFAULT_RESCUE_HISTORY,
    emotion: LEARNING_DEFAULT_COLD_START_EMOTION,
    memory: LEARNING_DEFAULT_COLD_START_MEMORY,
    audience: LEARNING_DEFAULT_COLD_START_AUDIENCE,
    scene: LEARNING_DEFAULT_COLD_START_SCENE,
    rankingSeeds: params.rankingSeeds ?? LEARNING_DEFAULT_COLD_START_RANKING_SEEDS,
    moderationDecision: 'ALLOW',
    moderationSeverity: 'NONE',
    basis: 'GLOBAL_POPULATION',
    vectorPreset: 'NEUTRAL',
    privacy: params.privacy ?? LEARNING_DEFAULT_PRIVACY_ENVELOPE,
    createdAt: params.createdAt ?? (0 as UnixMs),
  };
}

// ============================================================================
// MARK: Cohort feature group defaults
// ============================================================================
export const LEARNING_COHORT_FEATURE_GROUP_DEFAULTS = {
  HELPER_FORWARD: {
    ENGAGEMENT: 0.302,
    RELATIONSHIP: 0.343,
    SCENE: 0.384,
    NEGOTIATION: 0.425,
    AUDIENCE: 0.466,
    EMOTION: 0.507,
    MEMORY: 0.548,
    SAFETY: 0.589,
  },
  HATER_FORWARD: {
    ENGAGEMENT: 0.384,
    RELATIONSHIP: 0.466,
    SCENE: 0.548,
    NEGOTIATION: 0.63,
    AUDIENCE: 0.712,
    EMOTION: 0.794,
    MEMORY: 0.876,
    SAFETY: 0.248,
  },
  NEGOTIATION_FORWARD: {
    ENGAGEMENT: 0.466,
    RELATIONSHIP: 0.589,
    SCENE: 0.712,
    NEGOTIATION: 0.835,
    AUDIENCE: 0.248,
    EMOTION: 0.371,
    MEMORY: 0.494,
    SAFETY: 0.617,
  },
  RESCUE_FORWARD: {
    ENGAGEMENT: 0.548,
    RELATIONSHIP: 0.712,
    SCENE: 0.876,
    NEGOTIATION: 0.33,
    AUDIENCE: 0.494,
    EMOTION: 0.658,
    MEMORY: 0.822,
    SAFETY: 0.276,
  },
  QUIET_OBSERVER: {
    ENGAGEMENT: 0.63,
    RELATIONSHIP: 0.835,
    SCENE: 0.33,
    NEGOTIATION: 0.535,
    AUDIENCE: 0.74,
    EMOTION: 0.235,
    MEMORY: 0.44,
    SAFETY: 0.645,
  },
  NEUTRAL: {
    ENGAGEMENT: 0.712,
    RELATIONSHIP: 0.248,
    SCENE: 0.494,
    NEGOTIATION: 0.74,
    AUDIENCE: 0.276,
    EMOTION: 0.522,
    MEMORY: 0.768,
    SAFETY: 0.304,
  },
} as const;

// ============================================================================
// MARK: Manifest
// ============================================================================
export const LEARNING_COLD_START_CONTRACT_MANIFEST = {
  file: 'shared/contracts/chat/learning/ColdStartDefaults.ts',
  version: CHAT_CONTRACT_VERSION,
  authorities: CHAT_CONTRACT_AUTHORITIES,
  chatAuthorities: CHAT_AUTHORITIES,
  profileAuthorities: LEARNING_PROFILE_AUTHORITIES,
  profileVisibilityModes: LEARNING_PROFILE_VISIBILITY_MODES,
  policyKinds: LEARNING_COLD_START_POLICY_KINDS,
  packetTargets: LEARNING_COLD_START_PACKET_TARGETS,
  cohortAxes: LEARNING_COLD_START_COHORT_AXES,
  confidenceBands: LEARNING_COLD_START_CONFIDENCE_BANDS,
  transitionKinds: LEARNING_COLD_START_TRANSITION_KINDS,
  overrideKinds: LEARNING_COLD_START_OVERRIDE_KINDS,
  vectorPresets: LEARNING_COLD_START_VECTOR_PRESETS,
  bases: LEARNING_COLD_START_BASES,
  rankingSources: LEARNING_RANKING_SOURCES,
  labelKinds: LEARNING_LABEL_KINDS,
  memoryAnchorKinds: LEARNING_MEMORY_ANCHOR_KINDS,
  modelFamilies: LEARNING_MODEL_FAMILIES,
  retentionClasses: LEARNING_RETENTION_CLASSES,
  dataSplits: LEARNING_DATA_SPLITS,
  driftStatuses: LEARNING_DRIFT_STATUSES,
  evaluationVerdicts: LEARNING_EVALUATION_VERDICTS,
  defaultFeatureBag: LEARNING_DEFAULT_COLD_START_FEATURE_BAG,
  defaultEmotion: LEARNING_DEFAULT_COLD_START_EMOTION,
  defaultHelper: LEARNING_DEFAULT_COLD_START_HELPER,
  defaultHater: LEARNING_DEFAULT_COLD_START_HATER,
  defaultNegotiation: LEARNING_DEFAULT_COLD_START_NEGOTIATION,
  defaultMemory: LEARNING_DEFAULT_COLD_START_MEMORY,
  defaultAudience: LEARNING_DEFAULT_COLD_START_AUDIENCE,
  defaultScene: LEARNING_DEFAULT_COLD_START_SCENE,
  defaultRankingSeeds: LEARNING_DEFAULT_COLD_START_RANKING_SEEDS,
  modeChannelPresets: LEARNING_MODE_CHANNEL_COLD_START_PRESETS,
  featurePriorRegistry: LEARNING_DEFAULT_COLD_START_FEATURE_PRIOR_REGISTRY,
  transitionRules: LEARNING_COLD_START_TRANSITION_RULES,
  policies: LEARNING_COLD_START_POLICIES,
} as const;
export type LearningColdStartContractManifest = typeof LEARNING_COLD_START_CONTRACT_MANIFEST;
