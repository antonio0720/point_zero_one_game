// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/intelligence/index.ts
/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT INTELLIGENCE BARREL
 * FILE: pzo-web/src/engines/chat/intelligence/index.ts
 * VERSION: 2026.03.21-intelligence-barrel.v5-compile-safe
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Sovereign public surface for the frontend chat intelligence lane.
 *
 * This barrel owns four responsibilities:
 *
 * 1. Re-export every frontend intelligence module that exists right now.
 * 2. Provide compatibility aliases for older consumer names.
 * 3. Publish planned-module metadata without hard-importing files that do not
 *    exist yet.
 * 4. Offer a stable namespace + manifest surface so callers do not need deep
 *    path imports to discover module capabilities.
 *
 * Compile-safe doctrine
 * ---------------------
 * - Export what exists now.
 * - Alias what can be safely preserved.
 * - Mark planned modules as planned metadata only.
 * - Do not claim runtime reachability for files that are not present.
 * - Keep frontend intelligence optimistic, local, and reversible.
 * ============================================================================
 */

// ── Core learning surface ────────────────────────────────────────────────────
import * as ChatLearningBridgeRuntime from './ChatLearningBridge';
import * as ChatLearningProfileRuntime from './ChatLearningProfile';
import * as ChatColdStartProfileRuntime from './ChatColdStartProfile';

// ── Emotion / affect lane ────────────────────────────────────────────────────
import * as ChatEmotionScorerRuntime from './ml/EmotionScorer';
import * as ChatSocialEmbarrassmentScorerRuntime from './ml/SocialEmbarrassmentScorer';
import * as ChatConfidenceSwingTrackerRuntime from './ml/ConfidenceSwingTracker';

// ── Retrieval lane ───────────────────────────────────────────────────────────
import * as ChatMemoryRetrievalClientRuntime from './dl/MemoryRetrievalClient';
import * as ChatSaliencePreviewRuntime from './dl/SaliencePreview';

import type {
  ChatLearningBridgeObserver,
  ChatLearningBridgeOptions,
  ChatLearningBridgePreparedBatch,
  ChatLearningBridgePublicSnapshot,
} from './ChatLearningBridge';

import type {
  ChatLearningProfile,
  ChatLearningProfileCreateContext,
  ChatLearningProfileHydrationResult,
  ChatLearningProfileMutationMeta,
  ChatLearningProfileRecommendation,
} from './ChatLearningProfile';

import type {
  ChatColdStartBiasVector,
  ChatColdStartProfile,
  ChatColdStartProfileHydrationResult,
  ChatColdStartRecommendation,
  ChatColdStartSeedContext,
} from './ChatColdStartProfile';

// ── Live module re-exports ───────────────────────────────────────────────────
export * from './ChatLearningBridge';
export * from './ChatLearningProfile';
export * from './ChatColdStartProfile';
export * from './ml/EmotionScorer';
export * from './ml/SocialEmbarrassmentScorer';
export * from './ml/ConfidenceSwingTracker';
export * from './dl/MemoryRetrievalClient';
export * from './dl/SaliencePreview';

/* ========================================================================== */
/* MARK: Compatibility aliases                                                */
/* ========================================================================== */

export const hydrateColdStartProfile =
  ChatColdStartProfileRuntime.hydrateChatColdStartProfile;

export const hydrateLearningProfile =
  ChatLearningProfileRuntime.hydrateChatLearningProfile;

export const mergeLearningProfileDelta =
  ChatLearningProfileRuntime.mergeAuthoritativeChatLearningProfile;

export const EmotionScorer = ChatEmotionScorerRuntime.ChatEmotionScorer;
export const createEmotionScorer =
  ChatEmotionScorerRuntime.createChatEmotionScorer;
export const refineEmotionProfileState =
  ChatEmotionScorerRuntime.refineChatEmotionProfileState;

export const SocialEmbarrassmentScorer =
  ChatSocialEmbarrassmentScorerRuntime.ChatSocialEmbarrassmentScorer;
export const createSocialEmbarrassmentScorer =
  ChatSocialEmbarrassmentScorerRuntime.createChatSocialEmbarrassmentScorer;
export const scoreChatSocialEmbarrassment =
  ChatSocialEmbarrassmentScorerRuntime.evaluateChatSocialEmbarrassment;

export const ConfidenceSwingTracker =
  ChatConfidenceSwingTrackerRuntime.ChatConfidenceSwingTracker;
export const createConfidenceSwingTracker =
  ChatConfidenceSwingTrackerRuntime.createChatConfidenceSwingTracker;

export function syncLearningBridge(
  bridge: InstanceType<typeof ChatLearningBridgeRuntime.ChatLearningBridge>,
  profile: Parameters<
    InstanceType<
      typeof ChatLearningBridgeRuntime.ChatLearningBridge
    >['applyServerLearningProfile']
  >[0],
  reason?: Parameters<
    InstanceType<
      typeof ChatLearningBridgeRuntime.ChatLearningBridge
    >['applyServerLearningProfile']
  >[1],
): void {
  bridge.applyServerLearningProfile(profile, reason);
}

export function flushLearningBridge(
  bridge: InstanceType<typeof ChatLearningBridgeRuntime.ChatLearningBridge>,
  reason?: Parameters<
    InstanceType<typeof ChatLearningBridgeRuntime.ChatLearningBridge>['flush']
  >[0],
): ReturnType<
  InstanceType<typeof ChatLearningBridgeRuntime.ChatLearningBridge>['flush']
> {
  return bridge.flush(reason);
}

/* ========================================================================== */
/* MARK: Compatibility type aliases                                           */
/* ========================================================================== */

export type ChatLearningBridgeConfig = ChatLearningBridgeOptions;
export type ChatLearningBridgeSyncResult = ChatLearningBridgePreparedBatch;

export type ChatLearningProfileSnapshot = ChatLearningProfile;
export type ChatLearningProfileDelta = Readonly<Partial<ChatLearningProfile>>;
export type ChatLearningProfileHydrationSource =
  | string
  | Readonly<Record<string, unknown>>
  | ChatLearningProfile;

export type ChatColdStartProfileSnapshot = ChatColdStartProfile;
export type ChatColdStartPopulationPrior = ChatColdStartBiasVector;
export type ChatColdStartHydrationSource =
  | string
  | Readonly<Record<string, unknown>>
  | ChatColdStartProfile;

/* ========================================================================== */
/* MARK: Barrel identity                                                      */
/* ========================================================================== */

export const CHAT_INTELLIGENCE_MODULE_NAME =
  'PZO_FRONTEND_CHAT_INTELLIGENCE' as const;

export const CHAT_INTELLIGENCE_VERSION =
  '2026.03.21-intelligence-barrel.v5-compile-safe' as const;

export const CHAT_INTELLIGENCE_BARREL_LAWS = Object.freeze([
  'Export what is real now, not what is merely planned.',
  'Frontend intelligence is optimistic and reversible.',
  'Backend intelligence is authoritative and durable.',
  'Cold-start is a first-class citizen, not an afterthought.',
  'Emotion state is a signal surface, not a display flag.',
  'Retrieval is read-only from the frontend; writes flow through backend authority.',
  'Salience previews are ephemeral rendering hints, not ground truth.',
  'Every memory retrieval result must carry a confidence bound.',
  'Do not collapse retrieval results into UI decisions without a policy gate.',
  'Planned modules may be described, but never hard-imported before they exist.',
] as const);

/* ========================================================================== */
/* MARK: Module availability                                                  */
/* ========================================================================== */

export const CHAT_INTELLIGENCE_PHASE_EXPORTS = Object.freeze({
  present: Object.freeze([
    'ChatLearningBridge.ts',
    'ChatLearningProfile.ts',
    'ChatColdStartProfile.ts',
    'ml/EmotionScorer.ts',
    'ml/SocialEmbarrassmentScorer.ts',
    'ml/ConfidenceSwingTracker.ts',
    'dl/MemoryRetrievalClient.ts',
    'dl/SaliencePreview.ts',
  ] as const),
  planned: Object.freeze([
    'ml/FeatureExtractor.ts',
    'ml/EngagementScorer.ts',
    'ml/ColdStartPolicy.ts',
    'ml/HaterPersonaPolicy.ts',
    'ml/HelperInterventionPolicy.ts',
    'ml/ChannelRecommendationPolicy.ts',
    'ml/ToxicityRiskScorer.ts',
    'ml/DropOffRiskScorer.ts',
    'dl/MessageEmbeddingClient.ts',
    'dl/DialogueIntentEncoder.ts',
    'dl/ConversationStateEncoder.ts',
    'dl/ResponseRankerClient.ts',
    'dl/SequenceMemoryClient.ts',
    'ml/index.ts',
    'dl/index.ts',
    'memory/RelationshipState.ts',
    'memory/TrustGraph.ts',
    'memory/CallbackMemory.ts',
    'memory/QuoteRecallIndex.ts',
    'memory/ChatMemoryPreview.ts',
  ] as const),
} as const);

export const CHAT_INTELLIGENCE_COMPILE_SAFE_SURFACE = Object.freeze({
  // Core
  hasBridgeRuntime: true,
  hasColdStartProfileRuntime: true,
  hasLearningProfileRuntime: true,
  // Planned ML lane
  hasFeatureExtractorRuntime: false,
  hasEngagementScorerRuntime: false,
  hasColdStartPolicyRuntime: false,
  hasHaterPersonaPolicyRuntime: false,
  hasHelperInterventionPolicyRuntime: false,
  hasChannelRecommendationPolicyRuntime: false,
  hasToxicityRiskScorerRuntime: false,
  hasDropOffRiskScorerRuntime: false,
  // Planned DL lane
  hasMessageEmbeddingClientRuntime: false,
  hasDialogueIntentEncoderRuntime: false,
  hasConversationStateEncoderRuntime: false,
  hasResponseRankerClientRuntime: false,
  hasSequenceMemoryClientRuntime: false,
  // Live emotion lane
  hasEmotionScorerRuntime: true,
  hasSocialEmbarrassmentScorerRuntime: true,
  hasConfidenceSwingTrackerRuntime: true,
  // Live retrieval lane
  hasMemoryRetrievalClientRuntime: true,
  hasSaliencePreviewRuntime: true,
  // Capabilities
  canInstantiateBridge: true,
  canHydrateColdStartProfile: true,
  canHydrateLearningProfile: true,
  canExtractFeatures: false,
  canScoreEngagement: false,
  canApplyColdStartPolicy: false,
  canApplyHaterPersonaPolicy: false,
  canApplyHelperInterventionPolicy: false,
  canRecommendChannel: false,
  canScoreToxicityRisk: false,
  canScoreDropOffRisk: false,
  canEmbedMessage: false,
  canEncodeDialogueIntent: false,
  canEncodeConversationState: false,
  canRankResponses: false,
  canRunSequenceMemory: false,
  canScoreEmotion: true,
  canScoreSocialEmbarrassment: true,
  canTrackConfidenceSwing: true,
  canRefineEmotionProfileState: true,
  canRefineEmbarrassmentProfileState: true,
  canRefineConfidenceSwingProfileState: true,
  canRetrieveMemoryContinuity: true,
  canBuildSaliencePreview: true,
  awaitsFutureMlModules: true,
  awaitsFutureDlModules: true,
} as const);

export const CHAT_INTELLIGENCE_PLANNED_MODULES = Object.freeze({
  featureExtractor: Object.freeze({
    modulePath: './ml/FeatureExtractor',
    status: 'PLANNED',
    reason: 'Not present in current repo surface.',
  }),
  engagementScorer: Object.freeze({
    modulePath: './ml/EngagementScorer',
    status: 'PLANNED',
    reason: 'Not present in current repo surface.',
  }),
  coldStartPolicy: Object.freeze({
    modulePath: './ml/ColdStartPolicy',
    status: 'PLANNED',
    reason: 'Not present in current repo surface.',
  }),
  haterPersonaPolicy: Object.freeze({
    modulePath: './ml/HaterPersonaPolicy',
    status: 'PLANNED',
    reason: 'Not present in current repo surface.',
  }),
  helperInterventionPolicy: Object.freeze({
    modulePath: './ml/HelperInterventionPolicy',
    status: 'PLANNED',
    reason: 'Not present in current repo surface.',
  }),
  channelRecommendationPolicy: Object.freeze({
    modulePath: './ml/ChannelRecommendationPolicy',
    status: 'PLANNED',
    reason: 'Not present in current repo surface.',
  }),
  toxicityRiskScorer: Object.freeze({
    modulePath: './ml/ToxicityRiskScorer',
    status: 'PLANNED',
    reason: 'Not present in current repo surface.',
  }),
  dropOffRiskScorer: Object.freeze({
    modulePath: './ml/DropOffRiskScorer',
    status: 'PLANNED',
    reason: 'Not present in current repo surface.',
  }),
  messageEmbeddingClient: Object.freeze({
    modulePath: './dl/MessageEmbeddingClient',
    status: 'PLANNED',
    reason: 'Not present in current repo surface.',
  }),
  dialogueIntentEncoder: Object.freeze({
    modulePath: './dl/DialogueIntentEncoder',
    status: 'PLANNED',
    reason: 'Not present in current repo surface.',
  }),
  conversationStateEncoder: Object.freeze({
    modulePath: './dl/ConversationStateEncoder',
    status: 'PLANNED',
    reason: 'Not present in current repo surface.',
  }),
  responseRankerClient: Object.freeze({
    modulePath: './dl/ResponseRankerClient',
    status: 'PLANNED',
    reason: 'Not present in current repo surface.',
  }),
  sequenceMemoryClient: Object.freeze({
    modulePath: './dl/SequenceMemoryClient',
    status: 'PLANNED',
    reason: 'Not present in current repo surface.',
  }),
} as const);

/* ========================================================================== */
/* MARK: Module manifests                                                     */
/* ========================================================================== */

export const CHAT_INTELLIGENCE_MODULE_MANIFESTS = Object.freeze({
  bridge: Object.freeze({
    moduleName: ChatLearningBridgeRuntime.CHAT_LEARNING_BRIDGE_MODULE_NAME,
    version: ChatLearningBridgeRuntime.CHAT_LEARNING_BRIDGE_VERSION,
    laws: ChatLearningBridgeRuntime.CHAT_LEARNING_BRIDGE_RUNTIME_LAWS,
    defaults: ChatLearningBridgeRuntime.CHAT_LEARNING_BRIDGE_DEFAULTS,
  }),
  coldStartProfile: Object.freeze({
    moduleName: ChatColdStartProfileRuntime.CHAT_COLD_START_PROFILE_MODULE_NAME,
    version: ChatColdStartProfileRuntime.CHAT_COLD_START_PROFILE_VERSION,
    laws: ChatColdStartProfileRuntime.CHAT_COLD_START_RUNTIME_LAWS,
    defaults: ChatColdStartProfileRuntime.CHAT_COLD_START_DEFAULTS,
  }),
  learningProfile: Object.freeze({
    moduleName: ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_MODULE_NAME,
    version: ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_VERSION,
    laws: ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_RUNTIME_LAWS,
    defaults: ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_DEFAULTS,
  }),
  emotionScorer: Object.freeze({
    moduleName: ChatEmotionScorerRuntime.CHAT_EMOTION_SCORER_MODULE_NAME,
    version: ChatEmotionScorerRuntime.CHAT_EMOTION_SCORER_VERSION,
    laws: ChatEmotionScorerRuntime.CHAT_EMOTION_SCORER_RUNTIME_LAWS,
    defaults: ChatEmotionScorerRuntime.CHAT_EMOTION_SCORER_DEFAULTS,
  }),
  socialEmbarrassment: Object.freeze({
    moduleName:
      ChatSocialEmbarrassmentScorerRuntime.CHAT_SOCIAL_EMBARRASSMENT_SCORER_MODULE_NAME,
    version:
      ChatSocialEmbarrassmentScorerRuntime.CHAT_SOCIAL_EMBARRASSMENT_SCORER_VERSION,
    laws:
      ChatSocialEmbarrassmentScorerRuntime.CHAT_SOCIAL_EMBARRASSMENT_SCORER_RUNTIME_LAWS,
    defaults:
      ChatSocialEmbarrassmentScorerRuntime.CHAT_SOCIAL_EMBARRASSMENT_SCORER_DEFAULTS,
  }),
  confidenceSwing: Object.freeze({
    moduleName:
      ChatConfidenceSwingTrackerRuntime.CHAT_CONFIDENCE_SWING_TRACKER_MODULE_NAME,
    version: ChatConfidenceSwingTrackerRuntime.CHAT_CONFIDENCE_SWING_TRACKER_VERSION,
    laws: ChatConfidenceSwingTrackerRuntime.CHAT_CONFIDENCE_SWING_TRACKER_RUNTIME_LAWS,
    defaults: ChatConfidenceSwingTrackerRuntime.CHAT_CONFIDENCE_SWING_TRACKER_DEFAULTS,
  }),
  memoryRetrieval: Object.freeze({
    moduleName:
      ChatMemoryRetrievalClientRuntime.CHAT_MEMORY_RETRIEVAL_CLIENT_MODULE_NAME,
    version: ChatMemoryRetrievalClientRuntime.CHAT_MEMORY_RETRIEVAL_CLIENT_VERSION,
    laws: ChatMemoryRetrievalClientRuntime.CHAT_MEMORY_RETRIEVAL_CLIENT_RUNTIME_LAWS,
    defaults: ChatMemoryRetrievalClientRuntime.CHAT_MEMORY_RETRIEVAL_CLIENT_DEFAULTS,
  }),
  saliencePreview: Object.freeze({
    moduleName: ChatSaliencePreviewRuntime.CHAT_SALIENCE_PREVIEW_MODULE_NAME,
    version: ChatSaliencePreviewRuntime.CHAT_SALIENCE_PREVIEW_VERSION,
    laws: ChatSaliencePreviewRuntime.CHAT_SALIENCE_PREVIEW_RUNTIME_LAWS,
    defaults: ChatSaliencePreviewRuntime.CHAT_SALIENCE_PREVIEW_DEFAULTS,
  }),
  planned: CHAT_INTELLIGENCE_PLANNED_MODULES,
} as const);

/* ========================================================================== */
/* MARK: Frontend laws (aggregated)                                           */
/* ========================================================================== */

export const CHAT_INTELLIGENCE_FRONTEND_LAWS = Object.freeze([
  ...ChatLearningBridgeRuntime.CHAT_LEARNING_BRIDGE_RUNTIME_LAWS,
  ...ChatColdStartProfileRuntime.CHAT_COLD_START_RUNTIME_LAWS,
  ...ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_RUNTIME_LAWS,
  ...ChatEmotionScorerRuntime.CHAT_EMOTION_SCORER_RUNTIME_LAWS,
  ...ChatSocialEmbarrassmentScorerRuntime.CHAT_SOCIAL_EMBARRASSMENT_SCORER_RUNTIME_LAWS,
  ...ChatConfidenceSwingTrackerRuntime.CHAT_CONFIDENCE_SWING_TRACKER_RUNTIME_LAWS,
  ...ChatMemoryRetrievalClientRuntime.CHAT_MEMORY_RETRIEVAL_CLIENT_RUNTIME_LAWS,
  ...ChatSaliencePreviewRuntime.CHAT_SALIENCE_PREVIEW_RUNTIME_LAWS,
] as const);

/* ========================================================================== */
/* MARK: Public manifest                                                      */
/* ========================================================================== */

export const CHAT_INTELLIGENCE_PUBLIC_MANIFEST = Object.freeze({
  moduleName: CHAT_INTELLIGENCE_MODULE_NAME,
  version: CHAT_INTELLIGENCE_VERSION,
  barrelLaws: CHAT_INTELLIGENCE_BARREL_LAWS,
  phaseExports: CHAT_INTELLIGENCE_PHASE_EXPORTS,
  compileSafeSurface: CHAT_INTELLIGENCE_COMPILE_SAFE_SURFACE,
  moduleManifests: CHAT_INTELLIGENCE_MODULE_MANIFESTS,
  plannedModules: CHAT_INTELLIGENCE_PLANNED_MODULES,
} as const);

/* ========================================================================== */
/* MARK: Per-module namespace objects                                         */
/* ========================================================================== */

export const CHAT_INTELLIGENCE_BRIDGE_NAMESPACE = Object.freeze({
  moduleName: ChatLearningBridgeRuntime.CHAT_LEARNING_BRIDGE_MODULE_NAME,
  version: ChatLearningBridgeRuntime.CHAT_LEARNING_BRIDGE_VERSION,
  defaults: ChatLearningBridgeRuntime.CHAT_LEARNING_BRIDGE_DEFAULTS,
  laws: ChatLearningBridgeRuntime.CHAT_LEARNING_BRIDGE_RUNTIME_LAWS,
  runtime: ChatLearningBridgeRuntime,
  ChatLearningBridge: ChatLearningBridgeRuntime.ChatLearningBridge,
  createChatLearningBridge: ChatLearningBridgeRuntime.createChatLearningBridge,
  syncLearningBridge,
  flushLearningBridge,
} as const);

export const CHAT_INTELLIGENCE_COLD_START_NAMESPACE = Object.freeze({
  moduleName: ChatColdStartProfileRuntime.CHAT_COLD_START_PROFILE_MODULE_NAME,
  version: ChatColdStartProfileRuntime.CHAT_COLD_START_PROFILE_VERSION,
  defaults: ChatColdStartProfileRuntime.CHAT_COLD_START_DEFAULTS,
  laws: ChatColdStartProfileRuntime.CHAT_COLD_START_RUNTIME_LAWS,
  runtime: ChatColdStartProfileRuntime,
  isChatColdStartProfile: ChatColdStartProfileRuntime.isChatColdStartProfile,
  cloneChatColdStartProfile: ChatColdStartProfileRuntime.cloneChatColdStartProfile,
  serializeChatColdStartProfile:
    ChatColdStartProfileRuntime.serializeChatColdStartProfile,
  createChatColdStartProfile:
    ChatColdStartProfileRuntime.createChatColdStartProfile,
  hydrateColdStartProfile,
  mergeChatColdStartProfiles:
    ChatColdStartProfileRuntime.mergeChatColdStartProfiles,
  createChatColdStartRecommendation:
    ChatColdStartProfileRuntime.createChatColdStartRecommendation,
  createChatColdStartProfileFromLegacyCompat:
    ChatColdStartProfileRuntime.createChatColdStartProfileFromLegacyCompat,
} as const);

export const CHAT_INTELLIGENCE_LEARNING_PROFILE_NAMESPACE = Object.freeze({
  moduleName: ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_MODULE_NAME,
  version: ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_VERSION,
  defaults: ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_DEFAULTS,
  laws: ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_RUNTIME_LAWS,
  runtime: ChatLearningProfileRuntime,
  isChatLearningProfile: ChatLearningProfileRuntime.isChatLearningProfile,
  cloneChatLearningProfile: ChatLearningProfileRuntime.cloneChatLearningProfile,
  serializeChatLearningProfile:
    ChatLearningProfileRuntime.serializeChatLearningProfile,
  createChatLearningProfile:
    ChatLearningProfileRuntime.createChatLearningProfile,
  hydrateLearningProfile,
  mergeLearningProfileDelta,
  applyFeatureSnapshotToChatLearningProfile:
    ChatLearningProfileRuntime.applyFeatureSnapshotToChatLearningProfile,
  applyAffectSnapshotToChatLearningProfile:
    ChatLearningProfileRuntime.applyAffectSnapshotToChatLearningProfile,
  applyFeatureDropOffSignalsToChatLearningProfile:
    ChatLearningProfileRuntime.applyFeatureDropOffSignalsToChatLearningProfile,
  applyTelemetryEnvelopeToChatLearningProfile:
    ChatLearningProfileRuntime.applyTelemetryEnvelopeToChatLearningProfile,
  mergeAuthoritativeChatLearningProfile:
    ChatLearningProfileRuntime.mergeAuthoritativeChatLearningProfile,
  createChatLearningProfileRecommendation:
    ChatLearningProfileRuntime.createChatLearningProfileRecommendation,
  createChatLearningProfileFromLegacyCompat:
    ChatLearningProfileRuntime.createChatLearningProfileFromLegacyCompat,
} as const);

export const CHAT_INTELLIGENCE_EMOTION_SCORER_NAMESPACE = Object.freeze({
  moduleName: ChatEmotionScorerRuntime.CHAT_EMOTION_SCORER_MODULE_NAME,
  version: ChatEmotionScorerRuntime.CHAT_EMOTION_SCORER_VERSION,
  defaults: ChatEmotionScorerRuntime.CHAT_EMOTION_SCORER_DEFAULTS,
  laws: ChatEmotionScorerRuntime.CHAT_EMOTION_SCORER_RUNTIME_LAWS,
  runtime: ChatEmotionScorerRuntime,
  EmotionScorer,
  createEmotionScorer,
  scoreChatEmotion: ChatEmotionScorerRuntime.scoreChatEmotion,
  summarizeChatEmotion: ChatEmotionScorerRuntime.summarizeChatEmotion,
  recommendChatEmotionIntervention:
    ChatEmotionScorerRuntime.recommendChatEmotionIntervention,
  refineEmotionProfileState,
} as const);

export const CHAT_INTELLIGENCE_SOCIAL_EMBARRASSMENT_NAMESPACE = Object.freeze({
  moduleName:
    ChatSocialEmbarrassmentScorerRuntime.CHAT_SOCIAL_EMBARRASSMENT_SCORER_MODULE_NAME,
  version:
    ChatSocialEmbarrassmentScorerRuntime.CHAT_SOCIAL_EMBARRASSMENT_SCORER_VERSION,
  defaults:
    ChatSocialEmbarrassmentScorerRuntime.CHAT_SOCIAL_EMBARRASSMENT_SCORER_DEFAULTS,
  laws:
    ChatSocialEmbarrassmentScorerRuntime.CHAT_SOCIAL_EMBARRASSMENT_SCORER_RUNTIME_LAWS,
  runtime: ChatSocialEmbarrassmentScorerRuntime,
  SocialEmbarrassmentScorer,
  createSocialEmbarrassmentScorer,
  scoreChatSocialEmbarrassment,
  recommendEmbarrassmentContainment:
    ChatSocialEmbarrassmentScorerRuntime.recommendEmbarrassmentContainment,
  refineEmbarrassmentProfileState:
    ChatSocialEmbarrassmentScorerRuntime.refineEmbarrassmentProfileState,
} as const);

export const CHAT_INTELLIGENCE_CONFIDENCE_SWING_NAMESPACE = Object.freeze({
  moduleName:
    ChatConfidenceSwingTrackerRuntime.CHAT_CONFIDENCE_SWING_TRACKER_MODULE_NAME,
  version: ChatConfidenceSwingTrackerRuntime.CHAT_CONFIDENCE_SWING_TRACKER_VERSION,
  defaults: ChatConfidenceSwingTrackerRuntime.CHAT_CONFIDENCE_SWING_TRACKER_DEFAULTS,
  laws: ChatConfidenceSwingTrackerRuntime.CHAT_CONFIDENCE_SWING_TRACKER_RUNTIME_LAWS,
  runtime: ChatConfidenceSwingTrackerRuntime,
  ConfidenceSwingTracker,
  createConfidenceSwingTracker,
  trackChatConfidenceSwing:
    ChatConfidenceSwingTrackerRuntime.trackChatConfidenceSwing,
  recommendConfidenceSwingAction:
    ChatConfidenceSwingTrackerRuntime.recommendConfidenceSwingAction,
  refineConfidenceSwingProfileState:
    ChatConfidenceSwingTrackerRuntime.refineConfidenceSwingProfileState,
} as const);

export const CHAT_INTELLIGENCE_MEMORY_RETRIEVAL_NAMESPACE = Object.freeze({
  moduleName:
    ChatMemoryRetrievalClientRuntime.CHAT_MEMORY_RETRIEVAL_CLIENT_MODULE_NAME,
  version: ChatMemoryRetrievalClientRuntime.CHAT_MEMORY_RETRIEVAL_CLIENT_VERSION,
  defaults:
    ChatMemoryRetrievalClientRuntime.CHAT_MEMORY_RETRIEVAL_CLIENT_DEFAULTS,
  laws: ChatMemoryRetrievalClientRuntime.CHAT_MEMORY_RETRIEVAL_CLIENT_RUNTIME_LAWS,
  runtime: ChatMemoryRetrievalClientRuntime,
  MemoryRetrievalClient: ChatMemoryRetrievalClientRuntime.MemoryRetrievalClient,
  createMemoryRetrievalClient:
    ChatMemoryRetrievalClientRuntime.createMemoryRetrievalClient,
  retrieveChatMemory: ChatMemoryRetrievalClientRuntime.retrieveChatMemory,
  previewChatMemory: ChatMemoryRetrievalClientRuntime.previewChatMemory,
} as const);

export const CHAT_INTELLIGENCE_SALIENCE_PREVIEW_NAMESPACE = Object.freeze({
  moduleName: ChatSaliencePreviewRuntime.CHAT_SALIENCE_PREVIEW_MODULE_NAME,
  version: ChatSaliencePreviewRuntime.CHAT_SALIENCE_PREVIEW_VERSION,
  defaults: ChatSaliencePreviewRuntime.CHAT_SALIENCE_PREVIEW_DEFAULTS,
  laws: ChatSaliencePreviewRuntime.CHAT_SALIENCE_PREVIEW_RUNTIME_LAWS,
  runtime: ChatSaliencePreviewRuntime,
  SaliencePreview: ChatSaliencePreviewRuntime.SaliencePreview,
  createSaliencePreview: ChatSaliencePreviewRuntime.createSaliencePreview,
  buildChatSaliencePreview:
    ChatSaliencePreviewRuntime.buildChatSaliencePreview,
  summarizeChatSaliencePreview:
    ChatSaliencePreviewRuntime.summarizeChatSaliencePreview,
} as const);

/* ========================================================================== */
/* MARK: Unified namespace                                                    */
/* ========================================================================== */

export const CHAT_INTELLIGENCE_NAMESPACE = Object.freeze({
  manifest: CHAT_INTELLIGENCE_PUBLIC_MANIFEST,
  barrelLaws: CHAT_INTELLIGENCE_BARREL_LAWS,
  compileSafeSurface: CHAT_INTELLIGENCE_COMPILE_SAFE_SURFACE,
  plannedModules: CHAT_INTELLIGENCE_PLANNED_MODULES,
  bridge: CHAT_INTELLIGENCE_BRIDGE_NAMESPACE,
  coldStart: CHAT_INTELLIGENCE_COLD_START_NAMESPACE,
  learningProfile: CHAT_INTELLIGENCE_LEARNING_PROFILE_NAMESPACE,
  emotionScorer: CHAT_INTELLIGENCE_EMOTION_SCORER_NAMESPACE,
  socialEmbarrassment: CHAT_INTELLIGENCE_SOCIAL_EMBARRASSMENT_NAMESPACE,
  confidenceSwing: CHAT_INTELLIGENCE_CONFIDENCE_SWING_NAMESPACE,
  memoryRetrieval: CHAT_INTELLIGENCE_MEMORY_RETRIEVAL_NAMESPACE,
  saliencePreview: CHAT_INTELLIGENCE_SALIENCE_PREVIEW_NAMESPACE,
} as const);

/* ========================================================================== */
/* MARK: Full surface (flat + namespaced)                                     */
/* ========================================================================== */

export const CHAT_INTELLIGENCE_FULL_SURFACE = Object.freeze({
  manifest: CHAT_INTELLIGENCE_PUBLIC_MANIFEST,
  barrelLaws: CHAT_INTELLIGENCE_BARREL_LAWS,
  compileSafeSurface: CHAT_INTELLIGENCE_COMPILE_SAFE_SURFACE,
  plannedModules: CHAT_INTELLIGENCE_PLANNED_MODULES,
  bridge: CHAT_INTELLIGENCE_BRIDGE_NAMESPACE,
  coldStart: CHAT_INTELLIGENCE_COLD_START_NAMESPACE,
  learningProfile: CHAT_INTELLIGENCE_LEARNING_PROFILE_NAMESPACE,
  emotionScorer: CHAT_INTELLIGENCE_EMOTION_SCORER_NAMESPACE,
  socialEmbarrassment: CHAT_INTELLIGENCE_SOCIAL_EMBARRASSMENT_NAMESPACE,
  confidenceSwing: CHAT_INTELLIGENCE_CONFIDENCE_SWING_NAMESPACE,
  memoryRetrieval: CHAT_INTELLIGENCE_MEMORY_RETRIEVAL_NAMESPACE,
  saliencePreview: CHAT_INTELLIGENCE_SALIENCE_PREVIEW_NAMESPACE,
  ChatLearningBridge: ChatLearningBridgeRuntime.ChatLearningBridge,
  bridgeRuntime: ChatLearningBridgeRuntime,
  createChatLearningBridge: ChatLearningBridgeRuntime.createChatLearningBridge,
  syncLearningBridge,
  flushLearningBridge,
  coldStartRuntime: ChatColdStartProfileRuntime,
  isChatColdStartProfile: ChatColdStartProfileRuntime.isChatColdStartProfile,
  cloneChatColdStartProfile: ChatColdStartProfileRuntime.cloneChatColdStartProfile,
  serializeChatColdStartProfile:
    ChatColdStartProfileRuntime.serializeChatColdStartProfile,
  createChatColdStartProfile:
    ChatColdStartProfileRuntime.createChatColdStartProfile,
  hydrateColdStartProfile,
  mergeChatColdStartProfiles:
    ChatColdStartProfileRuntime.mergeChatColdStartProfiles,
  createChatColdStartRecommendation:
    ChatColdStartProfileRuntime.createChatColdStartRecommendation,
  createChatColdStartProfileFromLegacyCompat:
    ChatColdStartProfileRuntime.createChatColdStartProfileFromLegacyCompat,
  learningProfileRuntime: ChatLearningProfileRuntime,
  isChatLearningProfile: ChatLearningProfileRuntime.isChatLearningProfile,
  cloneChatLearningProfile: ChatLearningProfileRuntime.cloneChatLearningProfile,
  serializeChatLearningProfile:
    ChatLearningProfileRuntime.serializeChatLearningProfile,
  createChatLearningProfile:
    ChatLearningProfileRuntime.createChatLearningProfile,
  hydrateLearningProfile,
  mergeLearningProfileDelta,
  applyFeatureSnapshotToChatLearningProfile:
    ChatLearningProfileRuntime.applyFeatureSnapshotToChatLearningProfile,
  applyAffectSnapshotToChatLearningProfile:
    ChatLearningProfileRuntime.applyAffectSnapshotToChatLearningProfile,
  applyFeatureDropOffSignalsToChatLearningProfile:
    ChatLearningProfileRuntime.applyFeatureDropOffSignalsToChatLearningProfile,
  applyTelemetryEnvelopeToChatLearningProfile:
    ChatLearningProfileRuntime.applyTelemetryEnvelopeToChatLearningProfile,
  mergeAuthoritativeChatLearningProfile:
    ChatLearningProfileRuntime.mergeAuthoritativeChatLearningProfile,
  createChatLearningProfileRecommendation:
    ChatLearningProfileRuntime.createChatLearningProfileRecommendation,
  createChatLearningProfileFromLegacyCompat:
    ChatLearningProfileRuntime.createChatLearningProfileFromLegacyCompat,
  EmotionScorer,
  createEmotionScorer,
  scoreChatEmotion: ChatEmotionScorerRuntime.scoreChatEmotion,
  summarizeChatEmotion: ChatEmotionScorerRuntime.summarizeChatEmotion,
  recommendChatEmotionIntervention:
    ChatEmotionScorerRuntime.recommendChatEmotionIntervention,
  refineEmotionProfileState,
  SocialEmbarrassmentScorer,
  createSocialEmbarrassmentScorer,
  scoreChatSocialEmbarrassment,
  recommendEmbarrassmentContainment:
    ChatSocialEmbarrassmentScorerRuntime.recommendEmbarrassmentContainment,
  refineEmbarrassmentProfileState:
    ChatSocialEmbarrassmentScorerRuntime.refineEmbarrassmentProfileState,
  ConfidenceSwingTracker,
  createConfidenceSwingTracker,
  trackChatConfidenceSwing:
    ChatConfidenceSwingTrackerRuntime.trackChatConfidenceSwing,
  recommendConfidenceSwingAction:
    ChatConfidenceSwingTrackerRuntime.recommendConfidenceSwingAction,
  refineConfidenceSwingProfileState:
    ChatConfidenceSwingTrackerRuntime.refineConfidenceSwingProfileState,
  MemoryRetrievalClient: ChatMemoryRetrievalClientRuntime.MemoryRetrievalClient,
  createMemoryRetrievalClient:
    ChatMemoryRetrievalClientRuntime.createMemoryRetrievalClient,
  retrieveChatMemory: ChatMemoryRetrievalClientRuntime.retrieveChatMemory,
  previewChatMemory: ChatMemoryRetrievalClientRuntime.previewChatMemory,
  SaliencePreview: ChatSaliencePreviewRuntime.SaliencePreview,
  createSaliencePreview: ChatSaliencePreviewRuntime.createSaliencePreview,
  buildChatSaliencePreview:
    ChatSaliencePreviewRuntime.buildChatSaliencePreview,
  summarizeChatSaliencePreview:
    ChatSaliencePreviewRuntime.summarizeChatSaliencePreview,
} as const);

/* ========================================================================== */
/* MARK: Dev / tooling surface                                                */
/* ========================================================================== */

export const CHAT_INTELLIGENCE_DEV_SURFACE = Object.freeze({
  version: CHAT_INTELLIGENCE_VERSION,
  moduleName: CHAT_INTELLIGENCE_MODULE_NAME,
  compileSafeSurface: CHAT_INTELLIGENCE_COMPILE_SAFE_SURFACE,
  phaseExports: CHAT_INTELLIGENCE_PHASE_EXPORTS,
  moduleManifests: CHAT_INTELLIGENCE_MODULE_MANIFESTS,
  frontendLaws: CHAT_INTELLIGENCE_FRONTEND_LAWS,
  modulePaths: Object.freeze({
    bridge: '/pzo-web/src/engines/chat/intelligence/ChatLearningBridge',
    coldStart: '/pzo-web/src/engines/chat/intelligence/ChatColdStartProfile',
    learningProfile: '/pzo-web/src/engines/chat/intelligence/ChatLearningProfile',
    emotionScorer: '/pzo-web/src/engines/chat/intelligence/ml/EmotionScorer',
    socialEmbarrassment:
      '/pzo-web/src/engines/chat/intelligence/ml/SocialEmbarrassmentScorer',
    confidenceSwing:
      '/pzo-web/src/engines/chat/intelligence/ml/ConfidenceSwingTracker',
    memoryRetrieval:
      '/pzo-web/src/engines/chat/intelligence/dl/MemoryRetrievalClient',
    saliencePreview:
      '/pzo-web/src/engines/chat/intelligence/dl/SaliencePreview',
  }),
  plannedModulePaths: CHAT_INTELLIGENCE_PLANNED_MODULES,
  recommendedConsumers: Object.freeze([
    'pzo-web/src/engines/chat/ChatEngine.ts',
    'pzo-web/src/engines/chat/ChatNpcDirector.ts',
    'pzo-web/src/engines/chat/ChatInvasionDirector.ts',
    'pzo-web/src/engines/chat/npc/HaterResponsePlanner.ts',
    'pzo-web/src/engines/chat/npc/HelperResponsePlanner.ts',
    'pzo-web/src/engines/chat/experience/ChatDramaDirector.ts',
  ] as const),
  capabilities: Object.freeze([
    'bridge synchronization',
    'cold-start profile hydration',
    'learning profile hydration',
    'emotion scoring',
    'social embarrassment evaluation',
    'confidence swing tracking',
    'memory retrieval continuity lookup',
    'salience preview building',
  ] as const),
} as const);

/* ========================================================================== */
/* MARK: Type exports                                                         */
/* ========================================================================== */

export type ChatIntelligenceNamespace = typeof CHAT_INTELLIGENCE_NAMESPACE;
export type ChatIntelligenceFullSurface = typeof CHAT_INTELLIGENCE_FULL_SURFACE;
export type ChatIntelligenceDevSurface = typeof CHAT_INTELLIGENCE_DEV_SURFACE;
export type ChatIntelligencePublicManifest =
  typeof CHAT_INTELLIGENCE_PUBLIC_MANIFEST;
export type ChatIntelligenceCompileSafeSurface =
  typeof CHAT_INTELLIGENCE_COMPILE_SAFE_SURFACE;
export type ChatIntelligenceBridgeNamespace =
  typeof CHAT_INTELLIGENCE_BRIDGE_NAMESPACE;
export type ChatIntelligenceColdStartNamespace =
  typeof CHAT_INTELLIGENCE_COLD_START_NAMESPACE;
export type ChatIntelligenceLearningProfileNamespace =
  typeof CHAT_INTELLIGENCE_LEARNING_PROFILE_NAMESPACE;
export type ChatIntelligenceEmotionScorerNamespace =
  typeof CHAT_INTELLIGENCE_EMOTION_SCORER_NAMESPACE;
export type ChatIntelligenceSocialEmbarrassmentNamespace =
  typeof CHAT_INTELLIGENCE_SOCIAL_EMBARRASSMENT_NAMESPACE;
export type ChatIntelligenceConfidenceSwingNamespace =
  typeof CHAT_INTELLIGENCE_CONFIDENCE_SWING_NAMESPACE;
export type ChatIntelligenceMemoryRetrievalNamespace =
  typeof CHAT_INTELLIGENCE_MEMORY_RETRIEVAL_NAMESPACE;
export type ChatIntelligenceSaliencePreviewNamespace =
  typeof CHAT_INTELLIGENCE_SALIENCE_PREVIEW_NAMESPACE;

export type {
  ChatLearningBridgeObserver,
  ChatLearningBridgePublicSnapshot,
  ChatLearningBridgePreparedBatch,
  ChatLearningBridgeOptions,
  ChatLearningProfileCreateContext,
  ChatLearningProfileHydrationResult,
  ChatLearningProfileMutationMeta,
  ChatLearningProfileRecommendation,
  ChatColdStartSeedContext,
  ChatColdStartProfileHydrationResult,
  ChatColdStartRecommendation,
};
