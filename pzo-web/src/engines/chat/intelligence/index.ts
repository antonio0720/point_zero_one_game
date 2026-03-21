// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/intelligence/index.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT INTELLIGENCE BARREL
 * FILE: pzo-web/src/engines/chat/intelligence/index.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Sovereign public surface for the frontend chat intelligence lane.
 *
 * This barrel owns three responsibilities:
 *
 * 1. Canonical learning bridge, profile, and cold-start surface — the three
 *    files that are fully present in the current repo and stable for import.
 *
 * 2. Runtime ML scorers and DL clients — feature extraction, engagement,
 *    cold-start, hater persona, helper intervention, channel recommendation,
 *    toxicity risk, drop-off risk, message embedding, dialogue intent,
 *    conversation state, response ranking, sequence memory, and the emotional
 *    operating layer (EmotionScorer, SocialEmbarrassmentScorer,
 *    ConfidenceSwingTracker).
 *
 * 3. Retrieval lane (v4) — MemoryRetrievalClient and SaliencePreview,
 *    connecting the intelligence barrel to the shared learning retrieval
 *    contracts (ConversationEmbeddings + MemoryAnchors).
 *
 * Architecture doctrine
 * ---------------------
 * - This barrel is frontend-responsive and non-authoritative.
 * - Backend owns transcript truth, authoritative profile writes, and
 *   training data assembly. This lane owns optimistic, local, ui-time
 *   intelligence operations.
 * - The retrieval lane is read-only from the frontend perspective. Writes
 *   flow through the backend learning profile authority.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

// ── Core learning surface ────────────────────────────────────────────────────
import * as ChatLearningBridgeRuntime from './ChatLearningBridge';
import * as ChatLearningProfileRuntime from './ChatLearningProfile';
import * as ChatColdStartProfileRuntime from './ChatColdStartProfile';
import * as ChatNoveltyLedgerRuntime from './ChatNoveltyLedger';

// ── ML lane ──────────────────────────────────────────────────────────────────
import * as ChatFeatureExtractorRuntime from './ml/FeatureExtractor';
import * as ChatEngagementScorerRuntime from './ml/EngagementScorer';
import * as ChatColdStartPolicyRuntime from './ml/ColdStartPolicy';
import * as ChatHaterPersonaPolicyRuntime from './ml/HaterPersonaPolicy';
import * as ChatHelperInterventionPolicyRuntime from './ml/HelperInterventionPolicy';
import * as ChatChannelRecommendationPolicyRuntime from './ml/ChannelRecommendationPolicy';
import * as ChatToxicityRiskScorerRuntime from './ml/ToxicityRiskScorer';
import * as ChatDropOffRiskScorerRuntime from './ml/DropOffRiskScorer';

// ── DL lane ──────────────────────────────────────────────────────────────────
import * as ChatMessageEmbeddingClientRuntime from './dl/MessageEmbeddingClient';
import * as ChatDialogueIntentEncoderRuntime from './dl/DialogueIntentEncoder';
import * as ChatConversationStateEncoderRuntime from './dl/ConversationStateEncoder';
import * as ChatResponseRankerClientRuntime from './dl/ResponseRankerClient';
import * as ChatSequenceMemoryClientRuntime from './dl/SequenceMemoryClient';

// ── Emotion lane (v3) ────────────────────────────────────────────────────────
import * as ChatEmotionScorerRuntime from './ml/EmotionScorer';
import * as ChatSocialEmbarrassmentScorerRuntime from './ml/SocialEmbarrassmentScorer';
import * as ChatConfidenceSwingTrackerRuntime from './ml/ConfidenceSwingTracker';

// ── Retrieval lane (v4) ──────────────────────────────────────────────────────
import * as ChatMemoryRetrievalClientRuntime from './dl/MemoryRetrievalClient';
import * as ChatSaliencePreviewRuntime from './dl/SaliencePreview';

export * from './ChatLearningBridge';
export * from './ChatLearningProfile';
export * from './ChatColdStartProfile';
export * from './ChatNoveltyLedger';
export * from './ml/EmotionScorer';
export * from './ml/SocialEmbarrassmentScorer';
export * from './ml/ConfidenceSwingTracker';
export * from './dl/MemoryRetrievalClient';
export * from './dl/SaliencePreview';

/* ========================================================================== */
/* MARK: Barrel identity                                                      */
/* ========================================================================== */

export const CHAT_INTELLIGENCE_MODULE_NAME =
  'PZO_FRONTEND_CHAT_INTELLIGENCE' as const;

export const CHAT_INTELLIGENCE_VERSION =
  '2026.03.20-intelligence-barrel.v4-retrieval-lane' as const;

export const CHAT_INTELLIGENCE_BARREL_LAWS = Object.freeze([
  'Export what is real now, not what is merely planned.',
  'Frontend intelligence is optimistic and reversible.',
  'Backend intelligence is authoritative and durable.',
  'Cold-start is a first-class citizen, not an afterthought.',
  'Emotion state is a signal surface, not a display flag.',
  'Retrieval is read-only from the frontend; writes flow through backend authority.',
  'Salience previews are ephemeral rendering hints, not ground truth.',
  'Novelty ledgers should be imported from this barrel when local anti-repeat scoring is needed.',
  'Every memory retrieval result must carry a confidence bound.',
  'Do not collapse retrieval results into UI decisions without a policy gate.',
] as const);

/* ========================================================================== */
/* MARK: Phase exports                                                        */
/* ========================================================================== */

export const CHAT_INTELLIGENCE_PHASE_EXPORTS = Object.freeze({
  present: Object.freeze([
    'ChatLearningBridge.ts',
    'ChatLearningProfile.ts',
    'ChatColdStartProfile.ts',
    'ChatNoveltyLedger.ts',
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
    'ml/EmotionScorer.ts',
    'ml/SocialEmbarrassmentScorer.ts',
    'ml/ConfidenceSwingTracker.ts',
    'dl/MemoryRetrievalClient.ts',
    'dl/SaliencePreview.ts',
  ] as const),
  expectedNext: Object.freeze([
    'ml/index.ts',
    'dl/index.ts',
    'memory/RelationshipState.ts',
    'memory/TrustGraph.ts',
    'memory/CallbackMemory.ts',
    'memory/QuoteRecallIndex.ts',
    'memory/ChatMemoryPreview.ts',
  ] as const),
} as const);

/* ========================================================================== */
/* MARK: Compile-safe surface                                                 */
/* ========================================================================== */

export const CHAT_INTELLIGENCE_COMPILE_SAFE_SURFACE = Object.freeze({
  // Core
  hasBridgeRuntime: true,
  hasColdStartProfileRuntime: true,
  hasLearningProfileRuntime: true,
  hasNoveltyLedgerRuntime: true,
  // ML lane
  hasFeatureExtractorRuntime: true,
  hasEngagementScorerRuntime: true,
  hasColdStartPolicyRuntime: true,
  hasHaterPersonaPolicyRuntime: true,
  hasHelperInterventionPolicyRuntime: true,
  hasChannelRecommendationPolicyRuntime: true,
  hasToxicityRiskScorerRuntime: true,
  hasDropOffRiskScorerRuntime: true,
  // DL lane
  hasMessageEmbeddingClientRuntime: true,
  hasDialogueIntentEncoderRuntime: true,
  hasConversationStateEncoderRuntime: true,
  hasResponseRankerClientRuntime: true,
  hasSequenceMemoryClientRuntime: true,
  // Emotion lane
  hasEmotionScorerRuntime: true,
  hasSocialEmbarrassmentScorerRuntime: true,
  hasConfidenceSwingTrackerRuntime: true,
  // Retrieval lane (v4)
  hasMemoryRetrievalClientRuntime: true,
  hasSaliencePreviewRuntime: true,
  // Capabilities
  canInstantiateBridge: true,
  canHydrateColdStartProfile: true,
  canHydrateLearningProfile: true,
  canInstantiateNoveltyLedger: true,
  canExtractFeatures: true,
  canScoreEngagement: true,
  canApplyColdStartPolicy: true,
  canApplyHaterPersonaPolicy: true,
  canApplyHelperInterventionPolicy: true,
  canRecommendChannel: true,
  canScoreToxicityRisk: true,
  canScoreDropOffRisk: true,
  canEmbedMessage: true,
  canEncodeDialogueIntent: true,
  canEncodeConversationState: true,
  canRankResponses: true,
  canRunSequenceMemory: true,
  canScoreEmotion: true,
  canScoreSocialEmbarrassment: true,
  canTrackConfidenceSwing: true,
  canRefineEmotionProfileState: true,
  canRefineEmbarrassmentProfileState: true,
  canRefineConfidenceSwingProfileState: true,
  canRetrieveMemoryContinuity: true,
  canBuildSaliencePreview: true,
  canIngestLocalMemoryArtifacts: true,
  awaitsFutureMlModules: true,
  awaitsFutureDlModules: true,
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
    laws: ChatColdStartProfileRuntime.CHAT_COLD_START_PROFILE_RUNTIME_LAWS,
    defaults: ChatColdStartProfileRuntime.CHAT_COLD_START_PROFILE_DEFAULTS,
  }),
  learningProfile: Object.freeze({
    moduleName: ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_MODULE_NAME,
    version: ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_VERSION,
    laws: ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_RUNTIME_LAWS,
    defaults: ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_DEFAULTS,
  }),
  noveltyLedger: Object.freeze({
    moduleName: ChatNoveltyLedgerRuntime.CHAT_NOVELTY_LEDGER_MODULE_NAME,
    version: ChatNoveltyLedgerRuntime.CHAT_NOVELTY_LEDGER_VERSION,
    laws: ChatNoveltyLedgerRuntime.CHAT_NOVELTY_LEDGER_RUNTIME_LAWS,
    defaults: ChatNoveltyLedgerRuntime.CHAT_NOVELTY_LEDGER_DEFAULTS,
  }),
  featureExtractor: Object.freeze({
    moduleName: ChatFeatureExtractorRuntime.CHAT_FEATURE_EXTRACTOR_MODULE_NAME,
    version: ChatFeatureExtractorRuntime.CHAT_FEATURE_EXTRACTOR_VERSION,
    laws: ChatFeatureExtractorRuntime.CHAT_FEATURE_EXTRACTOR_RUNTIME_LAWS,
    defaults: ChatFeatureExtractorRuntime.CHAT_FEATURE_EXTRACTOR_DEFAULTS,
  }),
  engagementScorer: Object.freeze({
    moduleName: ChatEngagementScorerRuntime.CHAT_ENGAGEMENT_SCORER_MODULE_NAME,
    version: ChatEngagementScorerRuntime.CHAT_ENGAGEMENT_SCORER_VERSION,
    laws: ChatEngagementScorerRuntime.CHAT_ENGAGEMENT_SCORER_RUNTIME_LAWS,
    defaults: ChatEngagementScorerRuntime.CHAT_ENGAGEMENT_SCORER_DEFAULTS,
  }),
  coldStartPolicy: Object.freeze({
    moduleName: ChatColdStartPolicyRuntime.CHAT_COLD_START_POLICY_MODULE_NAME,
    version: ChatColdStartPolicyRuntime.CHAT_COLD_START_POLICY_VERSION,
    laws: ChatColdStartPolicyRuntime.CHAT_COLD_START_POLICY_RUNTIME_LAWS,
    defaults: ChatColdStartPolicyRuntime.CHAT_COLD_START_POLICY_DEFAULTS,
  }),
  haterPersonaPolicy: Object.freeze({
    moduleName: ChatHaterPersonaPolicyRuntime.CHAT_HATER_PERSONA_POLICY_MODULE_NAME,
    version: ChatHaterPersonaPolicyRuntime.CHAT_HATER_PERSONA_POLICY_VERSION,
    laws: ChatHaterPersonaPolicyRuntime.CHAT_HATER_PERSONA_POLICY_RUNTIME_LAWS,
    defaults: ChatHaterPersonaPolicyRuntime.CHAT_HATER_PERSONA_POLICY_DEFAULTS,
  }),
  helperInterventionPolicy: Object.freeze({
    moduleName: ChatHelperInterventionPolicyRuntime.CHAT_HELPER_INTERVENTION_POLICY_MODULE_NAME,
    version: ChatHelperInterventionPolicyRuntime.CHAT_HELPER_INTERVENTION_POLICY_VERSION,
    laws: ChatHelperInterventionPolicyRuntime.CHAT_HELPER_INTERVENTION_POLICY_RUNTIME_LAWS,
    defaults: ChatHelperInterventionPolicyRuntime.CHAT_HELPER_INTERVENTION_POLICY_DEFAULTS,
  }),
  channelRecommendationPolicy: Object.freeze({
    moduleName: ChatChannelRecommendationPolicyRuntime.CHAT_CHANNEL_RECOMMENDATION_POLICY_MODULE_NAME,
    version: ChatChannelRecommendationPolicyRuntime.CHAT_CHANNEL_RECOMMENDATION_POLICY_VERSION,
    laws: ChatChannelRecommendationPolicyRuntime.CHAT_CHANNEL_RECOMMENDATION_POLICY_RUNTIME_LAWS,
    defaults: ChatChannelRecommendationPolicyRuntime.CHAT_CHANNEL_RECOMMENDATION_POLICY_DEFAULTS,
  }),
  toxicityRiskScorer: Object.freeze({
    moduleName: ChatToxicityRiskScorerRuntime.CHAT_TOXICITY_RISK_SCORER_MODULE_NAME,
    version: ChatToxicityRiskScorerRuntime.CHAT_TOXICITY_RISK_SCORER_VERSION,
    laws: ChatToxicityRiskScorerRuntime.CHAT_TOXICITY_RISK_SCORER_RUNTIME_LAWS,
    defaults: ChatToxicityRiskScorerRuntime.CHAT_TOXICITY_RISK_SCORER_DEFAULTS,
  }),
  dropOffRiskScorer: Object.freeze({
    moduleName: ChatDropOffRiskScorerRuntime.CHAT_DROP_OFF_RISK_SCORER_MODULE_NAME,
    version: ChatDropOffRiskScorerRuntime.CHAT_DROP_OFF_RISK_SCORER_VERSION,
    laws: ChatDropOffRiskScorerRuntime.CHAT_DROP_OFF_RISK_SCORER_RUNTIME_LAWS,
    defaults: ChatDropOffRiskScorerRuntime.CHAT_DROP_OFF_RISK_SCORER_DEFAULTS,
  }),
  messageEmbeddingClient: Object.freeze({
    moduleName: ChatMessageEmbeddingClientRuntime.CHAT_MESSAGE_EMBEDDING_CLIENT_MODULE_NAME,
    version: ChatMessageEmbeddingClientRuntime.CHAT_MESSAGE_EMBEDDING_CLIENT_VERSION,
    laws: ChatMessageEmbeddingClientRuntime.CHAT_MESSAGE_EMBEDDING_CLIENT_RUNTIME_LAWS,
    defaults: ChatMessageEmbeddingClientRuntime.CHAT_MESSAGE_EMBEDDING_CLIENT_DEFAULTS,
  }),
  dialogueIntentEncoder: Object.freeze({
    moduleName: ChatDialogueIntentEncoderRuntime.CHAT_DIALOGUE_INTENT_ENCODER_MODULE_NAME,
    version: ChatDialogueIntentEncoderRuntime.CHAT_DIALOGUE_INTENT_ENCODER_VERSION,
    laws: ChatDialogueIntentEncoderRuntime.CHAT_DIALOGUE_INTENT_ENCODER_RUNTIME_LAWS,
    defaults: ChatDialogueIntentEncoderRuntime.CHAT_DIALOGUE_INTENT_ENCODER_DEFAULTS,
  }),
  conversationStateEncoder: Object.freeze({
    moduleName: ChatConversationStateEncoderRuntime.CHAT_CONVERSATION_STATE_ENCODER_MODULE_NAME,
    version: ChatConversationStateEncoderRuntime.CHAT_CONVERSATION_STATE_ENCODER_VERSION,
    laws: ChatConversationStateEncoderRuntime.CHAT_CONVERSATION_STATE_ENCODER_RUNTIME_LAWS,
    defaults: ChatConversationStateEncoderRuntime.CHAT_CONVERSATION_STATE_ENCODER_DEFAULTS,
  }),
  responseRankerClient: Object.freeze({
    moduleName: ChatResponseRankerClientRuntime.CHAT_RESPONSE_RANKER_CLIENT_MODULE_NAME,
    version: ChatResponseRankerClientRuntime.CHAT_RESPONSE_RANKER_CLIENT_VERSION,
    laws: ChatResponseRankerClientRuntime.CHAT_RESPONSE_RANKER_CLIENT_RUNTIME_LAWS,
    defaults: ChatResponseRankerClientRuntime.CHAT_RESPONSE_RANKER_CLIENT_DEFAULTS,
  }),
  sequenceMemoryClient: Object.freeze({
    moduleName: ChatSequenceMemoryClientRuntime.CHAT_SEQUENCE_MEMORY_CLIENT_MODULE_NAME,
    version: ChatSequenceMemoryClientRuntime.CHAT_SEQUENCE_MEMORY_CLIENT_VERSION,
    laws: ChatSequenceMemoryClientRuntime.CHAT_SEQUENCE_MEMORY_CLIENT_RUNTIME_LAWS,
    defaults: ChatSequenceMemoryClientRuntime.CHAT_SEQUENCE_MEMORY_CLIENT_DEFAULTS,
  }),
  emotionScorer: Object.freeze({
    moduleName: ChatEmotionScorerRuntime.CHAT_EMOTION_SCORER_MODULE_NAME,
    version: ChatEmotionScorerRuntime.CHAT_EMOTION_SCORER_VERSION,
    laws: ChatEmotionScorerRuntime.CHAT_EMOTION_SCORER_RUNTIME_LAWS,
    defaults: ChatEmotionScorerRuntime.CHAT_EMOTION_SCORER_DEFAULTS,
  }),
  socialEmbarrassment: Object.freeze({
    moduleName: ChatSocialEmbarrassmentScorerRuntime.CHAT_SOCIAL_EMBARRASSMENT_SCORER_MODULE_NAME,
    version: ChatSocialEmbarrassmentScorerRuntime.CHAT_SOCIAL_EMBARRASSMENT_SCORER_VERSION,
    laws: ChatSocialEmbarrassmentScorerRuntime.CHAT_SOCIAL_EMBARRASSMENT_SCORER_RUNTIME_LAWS,
    defaults: ChatSocialEmbarrassmentScorerRuntime.CHAT_SOCIAL_EMBARRASSMENT_SCORER_DEFAULTS,
  }),
  confidenceSwing: Object.freeze({
    moduleName: ChatConfidenceSwingTrackerRuntime.CHAT_CONFIDENCE_SWING_TRACKER_MODULE_NAME,
    version: ChatConfidenceSwingTrackerRuntime.CHAT_CONFIDENCE_SWING_TRACKER_VERSION,
    laws: ChatConfidenceSwingTrackerRuntime.CHAT_CONFIDENCE_SWING_TRACKER_RUNTIME_LAWS,
    defaults:
      ChatConfidenceSwingTrackerRuntime.CHAT_CONFIDENCE_SWING_TRACKER_DEFAULTS,
  }),
  memoryRetrieval: Object.freeze({
    moduleName:
      ChatMemoryRetrievalClientRuntime.CHAT_MEMORY_RETRIEVAL_CLIENT_MODULE_NAME,
    version:
      ChatMemoryRetrievalClientRuntime.CHAT_MEMORY_RETRIEVAL_CLIENT_VERSION,
    laws:
      ChatMemoryRetrievalClientRuntime.CHAT_MEMORY_RETRIEVAL_CLIENT_RUNTIME_LAWS,
    defaults:
      ChatMemoryRetrievalClientRuntime.CHAT_MEMORY_RETRIEVAL_CLIENT_DEFAULTS,
  }),
  saliencePreview: Object.freeze({
    moduleName: ChatSaliencePreviewRuntime.CHAT_SALIENCE_PREVIEW_MODULE_NAME,
    version: ChatSaliencePreviewRuntime.CHAT_SALIENCE_PREVIEW_VERSION,
    laws: ChatSaliencePreviewRuntime.CHAT_SALIENCE_PREVIEW_RUNTIME_LAWS,
    defaults: ChatSaliencePreviewRuntime.CHAT_SALIENCE_PREVIEW_DEFAULTS,
  }),
} as const);

/* ========================================================================== */
/* MARK: Frontend laws (aggregated)                                           */
/* ========================================================================== */

export const CHAT_INTELLIGENCE_FRONTEND_LAWS = Object.freeze(
  [
    ...ChatLearningBridgeRuntime.CHAT_LEARNING_BRIDGE_RUNTIME_LAWS,
    ...ChatColdStartProfileRuntime.CHAT_COLD_START_PROFILE_RUNTIME_LAWS,
    ...ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_RUNTIME_LAWS,
    ...ChatNoveltyLedgerRuntime.CHAT_NOVELTY_LEDGER_RUNTIME_LAWS,
    ...ChatFeatureExtractorRuntime.CHAT_FEATURE_EXTRACTOR_RUNTIME_LAWS,
    ...ChatEngagementScorerRuntime.CHAT_ENGAGEMENT_SCORER_RUNTIME_LAWS,
    ...ChatColdStartPolicyRuntime.CHAT_COLD_START_POLICY_RUNTIME_LAWS,
    ...ChatHaterPersonaPolicyRuntime.CHAT_HATER_PERSONA_POLICY_RUNTIME_LAWS,
    ...ChatHelperInterventionPolicyRuntime.CHAT_HELPER_INTERVENTION_POLICY_RUNTIME_LAWS,
    ...ChatChannelRecommendationPolicyRuntime.CHAT_CHANNEL_RECOMMENDATION_POLICY_RUNTIME_LAWS,
    ...ChatToxicityRiskScorerRuntime.CHAT_TOXICITY_RISK_SCORER_RUNTIME_LAWS,
    ...ChatDropOffRiskScorerRuntime.CHAT_DROP_OFF_RISK_SCORER_RUNTIME_LAWS,
    ...ChatMessageEmbeddingClientRuntime.CHAT_MESSAGE_EMBEDDING_CLIENT_RUNTIME_LAWS,
    ...ChatDialogueIntentEncoderRuntime.CHAT_DIALOGUE_INTENT_ENCODER_RUNTIME_LAWS,
    ...ChatConversationStateEncoderRuntime.CHAT_CONVERSATION_STATE_ENCODER_RUNTIME_LAWS,
    ...ChatResponseRankerClientRuntime.CHAT_RESPONSE_RANKER_CLIENT_RUNTIME_LAWS,
    ...ChatSequenceMemoryClientRuntime.CHAT_SEQUENCE_MEMORY_CLIENT_RUNTIME_LAWS,
    ...ChatEmotionScorerRuntime.CHAT_EMOTION_SCORER_RUNTIME_LAWS,
    ...ChatSocialEmbarrassmentScorerRuntime.CHAT_SOCIAL_EMBARRASSMENT_SCORER_RUNTIME_LAWS,
    ...ChatConfidenceSwingTrackerRuntime.CHAT_CONFIDENCE_SWING_TRACKER_RUNTIME_LAWS,
    ...ChatMemoryRetrievalClientRuntime.CHAT_MEMORY_RETRIEVAL_CLIENT_RUNTIME_LAWS,
    ...ChatSaliencePreviewRuntime.CHAT_SALIENCE_PREVIEW_RUNTIME_LAWS,
  ],
);

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
} as const);

/* ========================================================================== */
/* MARK: Per-module namespace objects                                         */
/* ========================================================================== */

export const CHAT_INTELLIGENCE_BRIDGE_NAMESPACE = Object.freeze({
  moduleName: ChatLearningBridgeRuntime.CHAT_LEARNING_BRIDGE_MODULE_NAME,
  version: ChatLearningBridgeRuntime.CHAT_LEARNING_BRIDGE_VERSION,
  defaults: ChatLearningBridgeRuntime.CHAT_LEARNING_BRIDGE_DEFAULTS,
  laws: ChatLearningBridgeRuntime.CHAT_LEARNING_BRIDGE_RUNTIME_LAWS,
  ChatLearningBridge: ChatLearningBridgeRuntime.ChatLearningBridge,
  createChatLearningBridge: ChatLearningBridgeRuntime.createChatLearningBridge,
  syncLearningBridge: ChatLearningBridgeRuntime.syncLearningBridge,
  flushLearningBridge: ChatLearningBridgeRuntime.flushLearningBridge,
} as const);

export const CHAT_INTELLIGENCE_COLD_START_NAMESPACE = Object.freeze({
  moduleName: ChatColdStartProfileRuntime.CHAT_COLD_START_PROFILE_MODULE_NAME,
  version: ChatColdStartProfileRuntime.CHAT_COLD_START_PROFILE_VERSION,
  defaults: ChatColdStartProfileRuntime.CHAT_COLD_START_PROFILE_DEFAULTS,
  laws: ChatColdStartProfileRuntime.CHAT_COLD_START_PROFILE_RUNTIME_LAWS,
  ChatColdStartProfile: ChatColdStartProfileRuntime.ChatColdStartProfile,
  createChatColdStartProfile: ChatColdStartProfileRuntime.createChatColdStartProfile,
  hydrateColdStartProfile: ChatColdStartProfileRuntime.hydrateColdStartProfile,
} as const);

export const CHAT_INTELLIGENCE_LEARNING_PROFILE_NAMESPACE = Object.freeze({
  moduleName: ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_MODULE_NAME,
  version: ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_VERSION,
  defaults: ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_DEFAULTS,
  laws: ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_RUNTIME_LAWS,
  ChatLearningProfile: ChatLearningProfileRuntime.ChatLearningProfile,
  createChatLearningProfile: ChatLearningProfileRuntime.createChatLearningProfile,
  hydrateLearningProfile: ChatLearningProfileRuntime.hydrateLearningProfile,
  mergeLearningProfileDelta: ChatLearningProfileRuntime.mergeLearningProfileDelta,
} as const);

export const CHAT_INTELLIGENCE_NOVELTY_LEDGER_NAMESPACE = Object.freeze({
  moduleName: ChatNoveltyLedgerRuntime.CHAT_NOVELTY_LEDGER_MODULE_NAME,
  version: ChatNoveltyLedgerRuntime.CHAT_NOVELTY_LEDGER_VERSION,
  defaults: ChatNoveltyLedgerRuntime.CHAT_NOVELTY_LEDGER_DEFAULTS,
  laws: ChatNoveltyLedgerRuntime.CHAT_NOVELTY_LEDGER_RUNTIME_LAWS,
  ChatNoveltyLedger: ChatNoveltyLedgerRuntime.ChatNoveltyLedger,
  createChatNoveltyLedger: ChatNoveltyLedgerRuntime.createChatNoveltyLedger,
  restoreChatNoveltyLedger: ChatNoveltyLedgerRuntime.restoreChatNoveltyLedger,
  describeChatNoveltyScore: ChatNoveltyLedgerRuntime.describeChatNoveltyScore,
} as const);

export const CHAT_INTELLIGENCE_EMOTION_SCORER_NAMESPACE = Object.freeze({
  moduleName: ChatEmotionScorerRuntime.CHAT_EMOTION_SCORER_MODULE_NAME,
  version: ChatEmotionScorerRuntime.CHAT_EMOTION_SCORER_VERSION,
  defaults: ChatEmotionScorerRuntime.CHAT_EMOTION_SCORER_DEFAULTS,
  laws: ChatEmotionScorerRuntime.CHAT_EMOTION_SCORER_RUNTIME_LAWS,
  EmotionScorer: ChatEmotionScorerRuntime.EmotionScorer,
  createEmotionScorer: ChatEmotionScorerRuntime.createEmotionScorer,
  scoreChatEmotion: ChatEmotionScorerRuntime.scoreChatEmotion,
  refineEmotionProfileState: ChatEmotionScorerRuntime.refineEmotionProfileState,
} as const);

export const CHAT_INTELLIGENCE_SOCIAL_EMBARRASSMENT_NAMESPACE = Object.freeze({
  moduleName: ChatSocialEmbarrassmentScorerRuntime.CHAT_SOCIAL_EMBARRASSMENT_SCORER_MODULE_NAME,
  version: ChatSocialEmbarrassmentScorerRuntime.CHAT_SOCIAL_EMBARRASSMENT_SCORER_VERSION,
  defaults: ChatSocialEmbarrassmentScorerRuntime.CHAT_SOCIAL_EMBARRASSMENT_SCORER_DEFAULTS,
  laws: ChatSocialEmbarrassmentScorerRuntime.CHAT_SOCIAL_EMBARRASSMENT_SCORER_RUNTIME_LAWS,
  SocialEmbarrassmentScorer: ChatSocialEmbarrassmentScorerRuntime.SocialEmbarrassmentScorer,
  createSocialEmbarrassmentScorer: ChatSocialEmbarrassmentScorerRuntime.createSocialEmbarrassmentScorer,
  scoreChatSocialEmbarrassment: ChatSocialEmbarrassmentScorerRuntime.scoreChatSocialEmbarrassment,
  refineEmbarrassmentProfileState:
    ChatSocialEmbarrassmentScorerRuntime.refineEmbarrassmentProfileState,
} as const);

export const CHAT_INTELLIGENCE_CONFIDENCE_SWING_NAMESPACE = Object.freeze({
  moduleName: ChatConfidenceSwingTrackerRuntime.CHAT_CONFIDENCE_SWING_TRACKER_MODULE_NAME,
  version: ChatConfidenceSwingTrackerRuntime.CHAT_CONFIDENCE_SWING_TRACKER_VERSION,
  defaults: ChatConfidenceSwingTrackerRuntime.CHAT_CONFIDENCE_SWING_TRACKER_DEFAULTS,
  laws: ChatConfidenceSwingTrackerRuntime.CHAT_CONFIDENCE_SWING_TRACKER_RUNTIME_LAWS,
  ConfidenceSwingTracker: ChatConfidenceSwingTrackerRuntime.ConfidenceSwingTracker,
  createConfidenceSwingTracker: ChatConfidenceSwingTrackerRuntime.createConfidenceSwingTracker,
  trackChatConfidenceSwing: ChatConfidenceSwingTrackerRuntime.trackChatConfidenceSwing,
  recommendConfidenceSwingAction:
    ChatConfidenceSwingTrackerRuntime.recommendConfidenceSwingAction,
  refineConfidenceSwingProfileState:
    ChatConfidenceSwingTrackerRuntime.refineConfidenceSwingProfileState,
} as const);

export const CHAT_INTELLIGENCE_MEMORY_RETRIEVAL_NAMESPACE = Object.freeze({
  moduleName:
    ChatMemoryRetrievalClientRuntime.CHAT_MEMORY_RETRIEVAL_CLIENT_MODULE_NAME,
  version:
    ChatMemoryRetrievalClientRuntime.CHAT_MEMORY_RETRIEVAL_CLIENT_VERSION,
  defaults:
    ChatMemoryRetrievalClientRuntime.CHAT_MEMORY_RETRIEVAL_CLIENT_DEFAULTS,
  laws:
    ChatMemoryRetrievalClientRuntime.CHAT_MEMORY_RETRIEVAL_CLIENT_RUNTIME_LAWS,
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
  bridge: CHAT_INTELLIGENCE_BRIDGE_NAMESPACE,
  coldStart: CHAT_INTELLIGENCE_COLD_START_NAMESPACE,
  learningProfile: CHAT_INTELLIGENCE_LEARNING_PROFILE_NAMESPACE,
  noveltyLedger: CHAT_INTELLIGENCE_NOVELTY_LEDGER_NAMESPACE,
  emotionScorer: CHAT_INTELLIGENCE_EMOTION_SCORER_NAMESPACE,
  socialEmbarrassment: CHAT_INTELLIGENCE_SOCIAL_EMBARRASSMENT_NAMESPACE,
  confidenceSwing: CHAT_INTELLIGENCE_CONFIDENCE_SWING_NAMESPACE,
  memoryRetrieval: CHAT_INTELLIGENCE_MEMORY_RETRIEVAL_NAMESPACE,
  saliencePreview: CHAT_INTELLIGENCE_SALIENCE_PREVIEW_NAMESPACE,
  compileSafeSurface: CHAT_INTELLIGENCE_COMPILE_SAFE_SURFACE,
} as const);

/* ========================================================================== */
/* MARK: Full surface (flat + namespaced)                                     */
/* ========================================================================== */

export const CHAT_INTELLIGENCE_FULL_SURFACE = Object.freeze({
  manifest: CHAT_INTELLIGENCE_PUBLIC_MANIFEST,
  barrelLaws: CHAT_INTELLIGENCE_BARREL_LAWS,
  compileSafeSurface: CHAT_INTELLIGENCE_COMPILE_SAFE_SURFACE,

  bridge: CHAT_INTELLIGENCE_BRIDGE_NAMESPACE,
  coldStart: CHAT_INTELLIGENCE_COLD_START_NAMESPACE,
  learningProfile: CHAT_INTELLIGENCE_LEARNING_PROFILE_NAMESPACE,
  noveltyLedger: CHAT_INTELLIGENCE_NOVELTY_LEDGER_NAMESPACE,
  emotionScorer: CHAT_INTELLIGENCE_EMOTION_SCORER_NAMESPACE,
  socialEmbarrassment: CHAT_INTELLIGENCE_SOCIAL_EMBARRASSMENT_NAMESPACE,
  confidenceSwing: CHAT_INTELLIGENCE_CONFIDENCE_SWING_NAMESPACE,
  memoryRetrieval: CHAT_INTELLIGENCE_MEMORY_RETRIEVAL_NAMESPACE,
  saliencePreview: CHAT_INTELLIGENCE_SALIENCE_PREVIEW_NAMESPACE,

  // flat runtime refs
  ChatLearningBridge: ChatLearningBridgeRuntime.ChatLearningBridge,
  createChatLearningBridge: ChatLearningBridgeRuntime.createChatLearningBridge,
  syncLearningBridge: ChatLearningBridgeRuntime.syncLearningBridge,
  flushLearningBridge: ChatLearningBridgeRuntime.flushLearningBridge,

  ChatColdStartProfile: ChatColdStartProfileRuntime.ChatColdStartProfile,
  createChatColdStartProfile: ChatColdStartProfileRuntime.createChatColdStartProfile,
  hydrateColdStartProfile: ChatColdStartProfileRuntime.hydrateColdStartProfile,

  ChatLearningProfile: ChatLearningProfileRuntime.ChatLearningProfile,
  createChatLearningProfile: ChatLearningProfileRuntime.createChatLearningProfile,
  hydrateLearningProfile: ChatLearningProfileRuntime.hydrateLearningProfile,
  mergeLearningProfileDelta: ChatLearningProfileRuntime.mergeLearningProfileDelta,

  ChatNoveltyLedger: ChatNoveltyLedgerRuntime.ChatNoveltyLedger,
  createChatNoveltyLedger: ChatNoveltyLedgerRuntime.createChatNoveltyLedger,
  restoreChatNoveltyLedger: ChatNoveltyLedgerRuntime.restoreChatNoveltyLedger,
  describeChatNoveltyScore: ChatNoveltyLedgerRuntime.describeChatNoveltyScore,

  EmotionScorer: ChatEmotionScorerRuntime.EmotionScorer,
  createEmotionScorer: ChatEmotionScorerRuntime.createEmotionScorer,
  scoreChatEmotion: ChatEmotionScorerRuntime.scoreChatEmotion,
  refineEmotionProfileState: ChatEmotionScorerRuntime.refineEmotionProfileState,

  SocialEmbarrassmentScorer: ChatSocialEmbarrassmentScorerRuntime.SocialEmbarrassmentScorer,
  createSocialEmbarrassmentScorer: ChatSocialEmbarrassmentScorerRuntime.createSocialEmbarrassmentScorer,
  scoreChatSocialEmbarrassment: ChatSocialEmbarrassmentScorerRuntime.scoreChatSocialEmbarrassment,
  refineEmbarrassmentProfileState:
    ChatSocialEmbarrassmentScorerRuntime.refineEmbarrassmentProfileState,

  ConfidenceSwingTracker: ChatConfidenceSwingTrackerRuntime.ConfidenceSwingTracker,
  createConfidenceSwingTracker: ChatConfidenceSwingTrackerRuntime.createConfidenceSwingTracker,
  trackChatConfidenceSwing: ChatConfidenceSwingTrackerRuntime.trackChatConfidenceSwing,
  recommendConfidenceSwingAction:
    ChatConfidenceSwingTrackerRuntime.recommendConfidenceSwingAction,
  refineConfidenceSwingProfileState:
    ChatConfidenceSwingTrackerRuntime.refineConfidenceSwingProfileState,

  MemoryRetrievalClient:
    ChatMemoryRetrievalClientRuntime.MemoryRetrievalClient,
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
    featureExtractor: '/pzo-web/src/engines/chat/intelligence/ml/FeatureExtractor',
    engagementScorer: '/pzo-web/src/engines/chat/intelligence/ml/EngagementScorer',
    coldStartPolicy: '/pzo-web/src/engines/chat/intelligence/ml/ColdStartPolicy',
    haterPersonaPolicy: '/pzo-web/src/engines/chat/intelligence/ml/HaterPersonaPolicy',
    helperInterventionPolicy: '/pzo-web/src/engines/chat/intelligence/ml/HelperInterventionPolicy',
    channelRecommendationPolicy: '/pzo-web/src/engines/chat/intelligence/ml/ChannelRecommendationPolicy',
    toxicityRiskScorer: '/pzo-web/src/engines/chat/intelligence/ml/ToxicityRiskScorer',
    dropOffRiskScorer: '/pzo-web/src/engines/chat/intelligence/ml/DropOffRiskScorer',
    messageEmbeddingClient: '/pzo-web/src/engines/chat/intelligence/dl/MessageEmbeddingClient',
    dialogueIntentEncoder: '/pzo-web/src/engines/chat/intelligence/dl/DialogueIntentEncoder',
    conversationStateEncoder: '/pzo-web/src/engines/chat/intelligence/dl/ConversationStateEncoder',
    responseRankerClient: '/pzo-web/src/engines/chat/intelligence/dl/ResponseRankerClient',
    sequenceMemoryClient: '/pzo-web/src/engines/chat/intelligence/dl/SequenceMemoryClient',
    emotionScorer:
      '/pzo-web/src/engines/chat/intelligence/ml/EmotionScorer',
    socialEmbarrassment:
      '/pzo-web/src/engines/chat/intelligence/ml/SocialEmbarrassmentScorer',
    confidenceSwing:
      '/pzo-web/src/engines/chat/intelligence/ml/ConfidenceSwingTracker',
    memoryRetrieval:
      '/pzo-web/src/engines/chat/intelligence/dl/MemoryRetrievalClient',
    saliencePreview:
      '/pzo-web/src/engines/chat/intelligence/dl/SaliencePreview',
  }),
  recommendedConsumers: Object.freeze([
    'pzo-web/src/engines/chat/ChatEngine.ts',
    'pzo-web/src/engines/chat/ChatNpcDirector.ts',
    'pzo-web/src/engines/chat/ChatInvasionDirector.ts',
    'pzo-web/src/engines/chat/npc/HaterResponsePlanner.ts',
    'pzo-web/src/engines/chat/npc/HelperResponsePlanner.ts',
    'pzo-web/src/engines/chat/experience/ChatDramaDirector.ts',
  ] as const),
  capabilities: Object.freeze([
    'feature extraction',
    'engagement scoring',
    'cold-start policy application',
    'hater persona policy application',
    'helper intervention policy application',
    'channel recommendation',
    'toxicity risk scoring',
    'drop-off risk scoring',
    'message embedding',
    'dialogue intent encoding',
    'conversation state encoding',
    'response ranking',
    'sequence memory',
    'emotion scoring',
    'social embarrassment evaluation',
    'confidence swing tracking',
    'emotion-driven intervention recommendation',
    'memory retrieval continuity lookup',
    'salience preview building',
  ] as const),
  stagedNext: CHAT_INTELLIGENCE_PHASE_EXPORTS.expectedNext,
} as const);

/* ========================================================================== */
/* MARK: Type exports                                                         */
/* ========================================================================== */

export type ChatIntelligenceNamespace = typeof CHAT_INTELLIGENCE_NAMESPACE;
export type ChatIntelligenceFullSurface = typeof CHAT_INTELLIGENCE_FULL_SURFACE;
export type ChatIntelligenceDevSurface = typeof CHAT_INTELLIGENCE_DEV_SURFACE;
export type ChatIntelligencePublicManifest = typeof CHAT_INTELLIGENCE_PUBLIC_MANIFEST;
export type ChatIntelligenceCompileSafeSurface = typeof CHAT_INTELLIGENCE_COMPILE_SAFE_SURFACE;
export type ChatIntelligenceBridgeNamespace = typeof CHAT_INTELLIGENCE_BRIDGE_NAMESPACE;
export type ChatIntelligenceColdStartNamespace = typeof CHAT_INTELLIGENCE_COLD_START_NAMESPACE;
export type ChatIntelligenceLearningProfileNamespace = typeof CHAT_INTELLIGENCE_LEARNING_PROFILE_NAMESPACE;
export type ChatIntelligenceNoveltyLedgerNamespace = typeof CHAT_INTELLIGENCE_NOVELTY_LEDGER_NAMESPACE;
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
  ChatLearningBridgeConfig,
  ChatLearningBridgeSyncResult,
} from './ChatLearningBridge';

export type {
  ChatLearningProfileSnapshot,
  ChatLearningProfileDelta,
  ChatLearningProfileHydrationSource,
} from './ChatLearningProfile';

export type {
  ChatColdStartProfileSnapshot,
  ChatColdStartPopulationPrior,
  ChatColdStartHydrationSource,
} from './ChatColdStartProfile';