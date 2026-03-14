// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/index.ts

/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT ENGINE PUBLIC BARREL
 * FILE: pzo-web/src/engines/chat/index.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * This file is the sovereign public import surface for the frontend chat engine.
 *
 * It does five jobs at once:
 *
 * 1) exports the stable contract surface from ./types,
 * 2) exports the current runtime modules that already exist in the repo,
 * 3) preserves compatibility with the repo's current root ml/ and dl/ lanes,
 * 4) exposes deep public metadata so mounts, tests, tools, and dev panels can
 *    interrogate the chat lane without importing internal implementation files,
 * 5) keeps future canonicalization visible without pretending that the frontend
 *    is the final authority for transcript truth, moderation, replay, or
 *    persistent learning profile ownership.
 *
 * Architecture doctrine
 * ---------------------
 * - frontend engine lane  : pzo-web/src/engines/chat
 * - frontend render shell : pzo-web/src/components/chat
 * - backend authority     : backend/src/game/engine/chat
 * - server transport      : pzo-server/src/chat
 * - shared contracts      : shared/contracts/chat
 * - shared learning       : shared/contracts/chat/learning
 *
 * This barrel intentionally does NOT collapse those responsibilities together.
 * The frontend lane owns responsiveness, mounting, local orchestration,
 * optimistic experience, and compile-safe public access. It does NOT claim
 * final authority over transcript truth, enforcement, replay, or permanent
 * learning memory.
 *
 * Repo-specific compatibility note
 * --------------------------------
 * The current repo shape already includes:
 * - runtime modules in /pzo-web/src/engines/chat
 * - legacy-adjacent root ml/ and dl/ lanes under the same folder
 * - a canonical intelligence/ lane for shared learning profile surfaces
 *
 * Because of that, this barrel exports BOTH:
 * - canonical intelligence/*
 * - compatibility root ml/ and dl/
 *
 * That keeps the lane compile-safe while migration continues.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import {
  CHAT_ALL_CHANNELS,
  CHAT_ENGINE_AUTHORITIES,
  CHAT_ENGINE_CONSTANTS,
  CHAT_ENGINE_EVENT_NAMES,
  CHAT_ENGINE_PUBLIC_API_VERSION,
  CHAT_ENGINE_VERSION,
  CHAT_MESSAGE_KINDS,
  CHAT_MOUNT_PRESETS,
  CHAT_MOUNT_TARGETS,
  CHAT_SHADOW_CHANNELS,
  CHAT_TYPES_NAMESPACE,
  CHAT_VISIBLE_CHANNELS,
  channelFamilyOf,
  isAnyChatChannel,
  isLegendCandidateMessage,
  isReplayEligibleMessage,
  isShadowChatChannel,
  isVisibleChatChannel,
  supportsComposerForChannel,
} from './types';

import * as ChatTypes from './types';

import * as ChatEngineModule from './ChatEngine';
import * as ChatStateModule from './ChatState';
import * as ChatReducerModule from './ChatReducer';
import * as ChatSelectorsModule from './ChatSelectors';
import * as ChatMountRegistryModule from './ChatMountRegistry';
import * as ChatEventBridgeModule from './ChatEventBridge';
import * as ChatSocketClientModule from './ChatSocketClient';
import * as ChatPresenceControllerModule from './ChatPresenceController';
import * as ChatTypingControllerModule from './ChatTypingController';
import * as ChatNotificationControllerModule from './ChatNotificationController';
import * as ChatTranscriptBufferModule from './ChatTranscriptBuffer';
import * as ChatPrivacyPolicyModule from './ChatPrivacyPolicy';
import * as ChatChannelPolicyModule from './ChatChannelPolicy';
import * as ChatInvasionDirectorModule from './ChatInvasionDirector';
import * as ChatNpcDirectorModule from './ChatNpcDirector';
import * as ChatRuntimeConfigModule from './ChatRuntimeConfig';
import * as UnifiedChatDockModule from './UnifiedChatDock';

import * as ChatAdaptersModule from './adapters';
import * as ChatChannelsModule from './channels';
import * as ChatNpcModule from './npc';
import * as ChatReplayModule from './replay';
import * as ChatTelemetryModule from './telemetry';
import * as ChatIntelligenceModule from './intelligence';
import * as ChatMlCompatibilityModule from './ml/ml_index';
import * as ChatDlCompatibilityModule from './dl/dl_index';

export * from './types';

export * from './ChatEngine';
export * from './ChatState';
export * from './ChatReducer';
export * from './ChatSelectors';
export * from './ChatMountRegistry';
export * from './ChatEventBridge';
export * from './ChatSocketClient';
export * from './ChatPresenceController';
export * from './ChatTypingController';
export * from './ChatNotificationController';
export * from './ChatTranscriptBuffer';
export * from './ChatPrivacyPolicy';
export * from './ChatChannelPolicy';
export * from './ChatInvasionDirector';
export * from './ChatNpcDirector';
export * from './ChatRuntimeConfig';
export * from './UnifiedChatDock';

export * from './adapters';
export * from './channels';
export * from './npc';
export * from './replay';
export * from './telemetry';
export * from './intelligence';
export * from './ml/ml_index';
export * from './dl/dl_index';

export { ChatTypes };
export { ChatEngineModule };
export { ChatStateModule };
export { ChatReducerModule };
export { ChatSelectorsModule };
export { ChatMountRegistryModule };
export { ChatEventBridgeModule };
export { ChatSocketClientModule };
export { ChatPresenceControllerModule };
export { ChatTypingControllerModule };
export { ChatNotificationControllerModule };
export { ChatTranscriptBufferModule };
export { ChatPrivacyPolicyModule };
export { ChatChannelPolicyModule };
export { ChatInvasionDirectorModule };
export { ChatNpcDirectorModule };
export { ChatRuntimeConfigModule };
export { UnifiedChatDockModule };

export { ChatAdaptersModule };
export { ChatChannelsModule };
export { ChatNpcModule };
export { ChatReplayModule };
export { ChatTelemetryModule };
export { ChatIntelligenceModule };
export { ChatMlCompatibilityModule };
export { ChatDlCompatibilityModule };

/* ============================================================================
 * MODULE IDENTITY
 * ========================================================================== */

export const CHAT_ENGINE_MODULE_NAME = 'PZO_UNIFIED_CHAT_ENGINE' as const;
export const CHAT_ENGINE_PACKAGE_KIND = 'frontend-engine-barrel' as const;
export const CHAT_ENGINE_RUNTIME_TIER = 'frontend-responsive-non-authoritative' as const;
export const CHAT_ENGINE_BARREL_VERSION = '2.0.0' as const;

/* ============================================================================
 * CANONICAL ROOTS
 * ========================================================================== */

export const CHAT_ENGINE_ROOTS = Object.freeze({
  frontendEngine: CHAT_ENGINE_AUTHORITIES.frontendEngineRoot,
  frontendUi: CHAT_ENGINE_AUTHORITIES.frontendUiRoot,
  backendEngine: CHAT_ENGINE_AUTHORITIES.backendEngineRoot,
  serverTransport: CHAT_ENGINE_AUTHORITIES.serverTransportRoot,
  sharedContracts: CHAT_ENGINE_AUTHORITIES.sharedContractsRoot,
  sharedLearning: CHAT_ENGINE_AUTHORITIES.sharedLearningRoot,
  frontendLearning: CHAT_ENGINE_AUTHORITIES.frontendLearningRoot,
  backendLearning: CHAT_ENGINE_AUTHORITIES.backendLearningRoot,
} as const);

export const CHAT_ENGINE_FRONTEND_ROOT = CHAT_ENGINE_ROOTS.frontendEngine;
export const CHAT_ENGINE_UI_ROOT = CHAT_ENGINE_ROOTS.frontendUi;
export const CHAT_ENGINE_BACKEND_ROOT = CHAT_ENGINE_ROOTS.backendEngine;
export const CHAT_ENGINE_SERVER_ROOT = CHAT_ENGINE_ROOTS.serverTransport;
export const CHAT_ENGINE_SHARED_ROOT = CHAT_ENGINE_ROOTS.sharedContracts;
export const CHAT_ENGINE_SHARED_LEARNING_ROOT = CHAT_ENGINE_ROOTS.sharedLearning;

/* ============================================================================
 * REPO-SHAPE REGISTRY
 * ========================================================================== */

export const CHAT_ENGINE_PRESENT_RUNTIME_FILES = Object.freeze([
  'ChatChannelPolicy.ts',
  'ChatEngine.ts',
  'ChatEventBridge.ts',
  'ChatInvasionDirector.ts',
  'ChatMountRegistry.ts',
  'ChatNotificationController.ts',
  'ChatNpcDirector.ts',
  'ChatPresenceController.ts',
  'ChatPrivacyPolicy.ts',
  'ChatReducer.ts',
  'ChatRuntimeConfig.ts',
  'ChatSelectors.ts',
  'ChatSocketClient.ts',
  'ChatState.ts',
  'ChatTranscriptBuffer.ts',
  'ChatTypingController.ts',
  'UnifiedChatDock.tsx',
  'index.ts',
  'types.ts',
] as const);

export const CHAT_ENGINE_PRESENT_SUBTREES = Object.freeze([
  'adapters',
  'channels',
  'dl',
  'intelligence',
  'ml',
  'npc',
  'replay',
  'telemetry',
] as const);

export const CHAT_ENGINE_PRESENT_INTELLIGENCE_FILES = Object.freeze([
  'intelligence/ChatColdStartProfile.ts',
  'intelligence/ChatLearningBridge.ts',
  'intelligence/ChatLearningProfile.ts',
  'intelligence/index.ts',
  'ml/ChannelRecommendationPolicy.ts',
  'ml/ColdStartPolicy.ts',
  'ml/DropOffRiskScorer.ts',
  'ml/EngagementScorer.ts',
  'ml/FeatureExtractor.ts',
  'ml/HaterPersonaPolicy.ts',
  'ml/HelperInterventionPolicy.ts',
  'ml/ToxicityRiskScorer.ts',
  'ml/ml_index.ts',
  'dl/ConversationStateEncoder.ts',
  'dl/DialogueIntentEncoder.ts',
  'dl/MessageEmbeddingClient.ts',
  'dl/ResponseRankerClient.ts',
  'dl/SequenceMemoryClient.ts',
  'dl/dl_index.ts',
] as const);

export const CHAT_ENGINE_CANONICAL_FRONTEND_TARGET_TREE = Object.freeze([
  'index.ts',
  'types.ts',
  'ChatEngine.ts',
  'ChatState.ts',
  'ChatReducer.ts',
  'ChatSelectors.ts',
  'ChatMountRegistry.ts',
  'ChatEventBridge.ts',
  'ChatSocketClient.ts',
  'ChatPresenceController.ts',
  'ChatTypingController.ts',
  'ChatNotificationController.ts',
  'ChatTranscriptBuffer.ts',
  'ChatPrivacyPolicy.ts',
  'ChatChannelPolicy.ts',
  'ChatInvasionDirector.ts',
  'ChatNpcDirector.ts',
  'ChatRuntimeConfig.ts',
  'adapters/index.ts',
  'adapters/BattleEngineAdapter.ts',
  'adapters/RunStoreAdapter.ts',
  'adapters/MechanicsBridgeAdapter.ts',
  'adapters/ModeAdapter.ts',
  'channels/index.ts',
  'channels/GlobalChannelPolicy.ts',
  'channels/SyndicateChannelPolicy.ts',
  'channels/DealRoomChannelPolicy.ts',
  'channels/LobbyChannelPolicy.ts',
  'npc/index.ts',
  'npc/HaterDialogueRegistry.ts',
  'npc/HelperDialogueRegistry.ts',
  'npc/AmbientNpcRegistry.ts',
  'npc/HaterResponsePlanner.ts',
  'npc/HelperResponsePlanner.ts',
  'npc/NpcCadencePolicy.ts',
  'replay/index.ts',
  'replay/ChatReplayBuffer.ts',
  'replay/ChatReplaySerializer.ts',
  'telemetry/index.ts',
  'telemetry/ChatTelemetryEmitter.ts',
  'telemetry/ChatTelemetrySchema.ts',
  'telemetry/ChatTelemetryQueue.ts',
  'intelligence/index.ts',
  'intelligence/ChatLearningBridge.ts',
  'intelligence/ChatLearningProfile.ts',
  'intelligence/ChatColdStartProfile.ts',
  'intelligence/ml/index.ts',
  'intelligence/ml/FeatureExtractor.ts',
  'intelligence/ml/EngagementScorer.ts',
  'intelligence/ml/ColdStartPolicy.ts',
  'intelligence/ml/HaterPersonaPolicy.ts',
  'intelligence/ml/HelperInterventionPolicy.ts',
  'intelligence/ml/ChannelRecommendationPolicy.ts',
  'intelligence/ml/ToxicityRiskScorer.ts',
  'intelligence/ml/DropOffRiskScorer.ts',
  'intelligence/dl/index.ts',
  'intelligence/dl/MessageEmbeddingClient.ts',
  'intelligence/dl/DialogueIntentEncoder.ts',
  'intelligence/dl/ConversationStateEncoder.ts',
  'intelligence/dl/ResponseRankerClient.ts',
  'intelligence/dl/SequenceMemoryClient.ts',
] as const);

export const CHAT_ENGINE_CANONICAL_FUTURE_FRONTEND_EXPANSIONS = Object.freeze([
  'experience/ChatDramaDirector.ts',
  'experience/ChatMomentOrchestrator.ts',
  'experience/ChatSilenceEngine.ts',
  'experience/ChatInterruptPriority.ts',
  'experience/ChatRevealScheduler.ts',
  'memory/RelationshipState.ts',
  'memory/RelationshipTracker.ts',
  'memory/TrustGraph.ts',
  'memory/CallbackMemory.ts',
  'memory/QuoteRecallIndex.ts',
  'memory/ChatMemoryPreview.ts',
  'social/AudienceHeatEngine.ts',
  'social/ReputationAura.ts',
  'social/ChannelMoodModel.ts',
  'social/CrowdVelocityTracker.ts',
  'persona/PersonaVoiceprint.ts',
  'persona/PersonaDelayProfile.ts',
  'persona/SignatureComposer.ts',
  'combat/ChatBossFightController.ts',
  'combat/ChatCounterplayBridge.ts',
  'combat/ChatAttackTelegraph.ts',
  'rescue/RageQuitInterceptor.ts',
  'rescue/RecoveryPromptPolicy.ts',
  'rescue/RescueBannerBridge.ts',
  'dealroom/NegotiationIntentTracker.ts',
  'dealroom/OfferPressureScorer.ts',
  'dealroom/BluffSignalTracker.ts',
  'shadow/ShadowStateMirror.ts',
  'shadow/RevealQueue.ts',
  'rewards/ChatLegendMomentDetector.ts',
  'rewards/ChatRewardHooks.ts',
  'rewards/LegendPresentationPolicy.ts',
  'liveops/SeasonalChatEventDirector.ts',
  'liveops/WorldEventOverlayPolicy.ts',
  'liveops/ChatEventBannerPolicy.ts',
  'presence/NpcPresenceStyle.ts',
  'presence/TypingTheater.ts',
  'presence/ReadDelayPolicy.ts',
  'continuity/CrossModeContinuity.ts',
  'continuity/CarryoverSceneState.ts',
  'continuity/CompanionContinuity.ts',
  'postrun/PostRunSceneBuilder.ts',
  'postrun/PostRunSummaryPolicy.ts',
] as const);

/* ============================================================================
 * LEGACY / COMPATIBILITY LANES
 * ========================================================================== */

export const CHAT_ENGINE_COMPATIBILITY_LANES = Object.freeze({
  canonicalLearningRoot: 'intelligence',
  repoMlCompatibilityRoot: 'ml',
  repoDlCompatibilityRoot: 'dl',
  repoMlCompatibilityIndex: 'ml/ml_index.ts',
  repoDlCompatibilityIndex: 'dl/dl_index.ts',
  migrationIntent: 'preserve repo-specific ml/dl compatibility while canonical intelligence lane matures',
} as const);

export const CHAT_ENGINE_MIGRATION_DONOR_ZONES = Object.freeze({
  keepActiveAsConsumers: Object.freeze([
    'pzo-web/src/components/chat/ChatPanel.tsx',
    'pzo-web/src/components/chat/useChatEngine.ts',
    'pzo-web/src/components/chat/chatTypes.ts',
    'pzo-web/src/store/engineStore.card-slice.ts',
    'pzo-web/src/store/engineStore.mechanics-slice.ts',
    'pzo-web/src/store/engineStore.patch.ts',
    'pzo-web/src/store/engineStore.ts',
    'pzo-web/src/store/mechanicsRuntimeStore.ts',
    'pzo-web/src/store/runStore.ts',
    'pzo-web/src/store/bridges/',
    'pzo-web/src/store/handlers/',
    'pzo-web/src/store/selectors/',
    'pzo-web/src/store/slices/',
    'pzo-web/src/context/MechanicsBridgeContext.tsx',
  ] as const),
  freezeImmediatelyAsDonors: Object.freeze([
    'frontend/apps/web/components/chat/AdaptiveDialogueEngine.ts',
    'frontend/apps/web/components/chat/ChatChannelRouter.ts',
    'frontend/apps/web/components/chat/ChatPanel.tsx',
    'frontend/apps/web/components/chat/ChatPrivacyGuard.ts',
    'frontend/apps/web/components/chat/GameEventChatBridge.ts',
    'frontend/apps/web/components/chat/HaterDialogueTrees.ts',
    'frontend/apps/web/components/chat/HelperCharacters.ts',
    'frontend/apps/web/components/chat/LobbyChatWidget.tsx',
    'frontend/apps/web/components/chat/PlayerResponseClassifier.ts',
    'frontend/apps/web/components/chat/SovereignChatKernel.ts',
    'frontend/apps/web/components/chat/chatTypes.ts',
    'frontend/apps/web/components/chat/useChatEngine.ts',
  ] as const),
  legacyReferenceOnly: Object.freeze([
    'pzo_client/src/components/chat/AlliancePanel.tsx',
    'pzo_client/src/components/chat/RoomManager.tsx',
    'pzo_client/src/components/chat/SovereignChat.tsx',
    'pzo_client/src/components/chat/WarRoomPanel.tsx',
  ] as const),
  freezeAndExtractFromBattle: Object.freeze([
    'backend/src/game/engine/battle/AttackInjector.ts',
    'backend/src/game/engine/battle/BattleBudgetManager.ts',
    'backend/src/game/engine/battle/BattleEngine.ts',
    'backend/src/game/engine/battle/BotProfileRegistry.ts',
    'backend/src/game/engine/battle/HaterBotController.ts',
    'backend/src/game/engine/battle/types.ts',
    'pzo-web/src/engines/battle/AttackInjector.ts',
    'pzo-web/src/engines/battle/BattleBudgetManager.ts',
    'pzo-web/src/engines/battle/BattleEngine.test.ts',
    'pzo-web/src/engines/battle/BattleEngine.ts',
    'pzo-web/src/engines/battle/BattleUXBridge.ts',
    'pzo-web/src/engines/battle/BotProfileRegistry.ts',
    'pzo-web/src/engines/battle/CounterIntelPanel.ts',
    'pzo-web/src/engines/battle/HaterBotController.ts',
    'pzo-web/src/engines/battle/SyndicateWarEngine.ts',
    'pzo-web/src/engines/battle/types.ts',
    'pzo-web/src/ml/HaterBotController.ts',
  ] as const),
} as const);

export const CHAT_ENGINE_MIGRATION_EXTRACT_MAP = Object.freeze({
  'pzo-web/src/components/chat/ChatPanel.tsx': Object.freeze([
    'UnifiedChatDock.tsx',
    'ChatMessageFeed.tsx',
    'ChatComposer.tsx',
    'ChatChannelTabs.tsx',
    'ChatPresenceStrip.tsx',
    'ChatInvasionBanner.tsx',
    'ChatTranscriptDrawer.tsx',
  ] as const),
  'pzo-web/src/components/chat/useChatEngine.ts': Object.freeze([
    'ChatEngine.ts',
    'ChatSocketClient.ts',
    'ChatEventBridge.ts',
    'ChatNpcDirector.ts',
    'ChatNotificationController.ts',
    'ChatPresenceController.ts',
    'ChatTypingController.ts',
  ] as const),
  'pzo-web/src/components/chat/chatTypes.ts': Object.freeze([
    'shared/contracts/chat/*',
    'pzo-web/src/components/chat/uiTypes.ts',
  ] as const),
  'frontend/apps/web/components/chat/SovereignChatKernel.ts': Object.freeze([
    'ChatEngine.ts',
    'intelligence/ChatLearningProfile.ts',
    'intelligence/ChatColdStartProfile.ts',
    'intelligence/ChatLearningBridge.ts',
  ] as const),
  'frontend/apps/web/components/chat/GameEventChatBridge.ts': Object.freeze([
    'ChatEventBridge.ts',
    'backend/src/game/engine/chat/ChatEventBridge.ts',
  ] as const),
  'frontend/apps/web/components/chat/AdaptiveDialogueEngine.ts': Object.freeze([
    'backend/src/game/engine/chat/intelligence/dl/ResponseRankingModel.ts',
    'pzo-web/src/engines/chat/dl/ResponseRankerClient.ts',
  ] as const),
  'frontend/apps/web/components/chat/PlayerResponseClassifier.ts': Object.freeze([
    'backend/src/game/engine/chat/intelligence/ml/EngagementModel.ts',
    'pzo-web/src/engines/chat/ml/EngagementScorer.ts',
  ] as const),
  'frontend/apps/web/components/chat/HaterDialogueTrees.ts': Object.freeze([
    'npc/HaterDialogueRegistry.ts',
  ] as const),
  'frontend/apps/web/components/chat/HelperCharacters.ts': Object.freeze([
    'npc/HelperDialogueRegistry.ts',
    'npc/HelperResponsePlanner.ts',
  ] as const),
  'frontend/apps/web/components/chat/ChatChannelRouter.ts': Object.freeze([
    'channels/GlobalChannelPolicy.ts',
    'channels/SyndicateChannelPolicy.ts',
    'channels/DealRoomChannelPolicy.ts',
    'channels/LobbyChannelPolicy.ts',
  ] as const),
  'frontend/apps/web/components/chat/ChatPrivacyGuard.ts': Object.freeze([
    'ChatPrivacyPolicy.ts',
    'backend/src/game/engine/chat/ChatModerationPolicy.ts',
  ] as const),
} as const);

/* ============================================================================
 * RUNTIME LAWS
 * ========================================================================== */

export const CHAT_ENGINE_RUNTIME_LAWS = Object.freeze([
  'Frontend render stays thin.',
  'Frontend engine owns responsiveness, not transcript truth.',
  'Backend owns transcript integrity, policy, replay, and learning profile updates.',
  'Server transport routes socket intent; it does not author scenes.',
  'Shadow channels are valid first-class state lanes.',
  'Silence is a mechanic.',
  'Every major collapse needs a witness.',
  'Every major comeback needs a witness.',
  'Global should feel theatrical.',
  'Syndicate should feel intimate.',
  'Deal room should feel predatory.',
  'A helper should feel timely, not spammy.',
  'A rival should feel personal, not random.',
  'Client learning is optimistic and reversible; backend memory is authoritative.',
  'Chat mounts everywhere through registry, not through per-screen custom brains.',
] as const);

export const CHAT_ENGINE_EXPERIENCE_LAWS = Object.freeze([
  'The first meaningful chat reaction should happen fast.',
  'The second reaction should prove the world noticed something specific.',
  'Not every event gets text; some deserve silence.',
  'Major collapse scenes can escalate through witness, intrusion, crowd, and helper.',
  'Major comeback scenes can escalate through witness, reversal, heat, and prestige.',
  'Core NPCs must feel distinct before they feel smart.',
  'Typing, reading, lurking, and silence are valid theater tools.',
  'Relationship memory must survive enough context to feel authored.',
  'Channel mood is not identical across global, syndicate, and deal room.',
  'Legend moments deserve replay-grade treatment.',
  'Post-run chat should interpret, not merely summarize.',
] as const);

export const CHAT_ENGINE_TRUST_BOUNDARIES = Object.freeze({
  frontendOwns: Object.freeze([
    'mount responsiveness',
    'optimistic local orchestration',
    'local transcript buffering',
    'typing and presence theater',
    'ui-time intervention timing',
    'cold-start feature collection',
    'local personalization cache',
  ] as const),
  backendOwns: Object.freeze([
    'transcript truth',
    'policy enforcement',
    'replay truth',
    'persistent profile updates',
    'authoritative telemetry ingestion',
    'response ranking authority',
    'npc timing authority',
    'drift monitoring',
    'training data assembly',
  ] as const),
  serverOwns: Object.freeze([
    'connection auth',
    'room/session attachment',
    'fanout',
    'presence transport',
    'typing transport',
    'cursor transport',
    'replay transport',
  ] as const),
} as const);

/* ============================================================================
 * PUBLIC MANIFEST
 * ========================================================================== */

export const CHAT_ENGINE_PUBLIC_MANIFEST = Object.freeze({
  moduleName: CHAT_ENGINE_MODULE_NAME,
  packageKind: CHAT_ENGINE_PACKAGE_KIND,
  runtimeTier: CHAT_ENGINE_RUNTIME_TIER,
  barrelVersion: CHAT_ENGINE_BARREL_VERSION,
  version: CHAT_ENGINE_VERSION,
  publicApiVersion: CHAT_ENGINE_PUBLIC_API_VERSION,
  authorities: CHAT_ENGINE_AUTHORITIES,
  roots: CHAT_ENGINE_ROOTS,
  channels: Object.freeze({
    visible: CHAT_VISIBLE_CHANNELS,
    shadow: CHAT_SHADOW_CHANNELS,
    all: CHAT_ALL_CHANNELS,
  }),
  messageKinds: CHAT_MESSAGE_KINDS,
  eventNames: CHAT_ENGINE_EVENT_NAMES,
  mountTargets: CHAT_MOUNT_TARGETS,
  mountPresets: CHAT_MOUNT_PRESETS,
  constants: CHAT_ENGINE_CONSTANTS,
  repoShape: Object.freeze({
    runtimeFiles: CHAT_ENGINE_PRESENT_RUNTIME_FILES,
    subtrees: CHAT_ENGINE_PRESENT_SUBTREES,
    intelligenceFiles: CHAT_ENGINE_PRESENT_INTELLIGENCE_FILES,
  }),
  compatibility: CHAT_ENGINE_COMPATIBILITY_LANES,
  trustBoundaries: CHAT_ENGINE_TRUST_BOUNDARIES,
} as const);

/* ============================================================================
 * BARREL EXPORT PHASES
 * ========================================================================== */

export const CHAT_ENGINE_EXPORT_PHASES = Object.freeze({
  phaseZero: Object.freeze({
    description: 'types and manifest only',
    files: Object.freeze(['index.ts', 'types.ts'] as const),
  }),
  phaseOne: Object.freeze({
    description: 'current repo runtime surface',
    files: CHAT_ENGINE_PRESENT_RUNTIME_FILES,
  }),
  phaseTwo: Object.freeze({
    description: 'canonical intelligence and subtree exports',
    files: Object.freeze([
      ...CHAT_ENGINE_PRESENT_SUBTREES,
      ...CHAT_ENGINE_PRESENT_INTELLIGENCE_FILES,
    ] as const),
  }),
  phaseThree: Object.freeze({
    description: 'future dramaturgy, memory, social, rescue, prestige, and continuity surfaces',
    files: CHAT_ENGINE_CANONICAL_FUTURE_FRONTEND_EXPANSIONS,
  }),
} as const);

export const CHAT_ENGINE_PUBLIC_EXPORTS = Object.freeze({
  files: Object.freeze([
    './types',
    './ChatEngine',
    './ChatState',
    './ChatReducer',
    './ChatSelectors',
    './ChatMountRegistry',
    './ChatEventBridge',
    './ChatSocketClient',
    './ChatPresenceController',
    './ChatTypingController',
    './ChatNotificationController',
    './ChatTranscriptBuffer',
    './ChatPrivacyPolicy',
    './ChatChannelPolicy',
    './ChatInvasionDirector',
    './ChatNpcDirector',
    './ChatRuntimeConfig',
    './UnifiedChatDock',
  ] as const),
  trees: Object.freeze([
    './adapters',
    './channels',
    './npc',
    './replay',
    './telemetry',
    './intelligence',
    './ml/ml_index',
    './dl/dl_index',
  ] as const),
  namespaces: Object.freeze([
    'ChatTypes',
    'ChatEngineModule',
    'ChatStateModule',
    'ChatReducerModule',
    'ChatSelectorsModule',
    'ChatMountRegistryModule',
    'ChatEventBridgeModule',
    'ChatSocketClientModule',
    'ChatPresenceControllerModule',
    'ChatTypingControllerModule',
    'ChatNotificationControllerModule',
    'ChatTranscriptBufferModule',
    'ChatPrivacyPolicyModule',
    'ChatChannelPolicyModule',
    'ChatInvasionDirectorModule',
    'ChatNpcDirectorModule',
    'ChatRuntimeConfigModule',
    'UnifiedChatDockModule',
    'ChatAdaptersModule',
    'ChatChannelsModule',
    'ChatNpcModule',
    'ChatReplayModule',
    'ChatTelemetryModule',
    'ChatIntelligenceModule',
    'ChatMlCompatibilityModule',
    'ChatDlCompatibilityModule',
  ] as const),
} as const);

/* ============================================================================
 * STATIC NAMESPACE SURFACES
 * ========================================================================== */

export const CHAT_ENGINE_RUNTIME_MODULES = Object.freeze({
  types: ChatTypes,
  ChatEngine: ChatEngineModule,
  ChatState: ChatStateModule,
  ChatReducer: ChatReducerModule,
  ChatSelectors: ChatSelectorsModule,
  ChatMountRegistry: ChatMountRegistryModule,
  ChatEventBridge: ChatEventBridgeModule,
  ChatSocketClient: ChatSocketClientModule,
  ChatPresenceController: ChatPresenceControllerModule,
  ChatTypingController: ChatTypingControllerModule,
  ChatNotificationController: ChatNotificationControllerModule,
  ChatTranscriptBuffer: ChatTranscriptBufferModule,
  ChatPrivacyPolicy: ChatPrivacyPolicyModule,
  ChatChannelPolicy: ChatChannelPolicyModule,
  ChatInvasionDirector: ChatInvasionDirectorModule,
  ChatNpcDirector: ChatNpcDirectorModule,
  ChatRuntimeConfig: ChatRuntimeConfigModule,
  UnifiedChatDock: UnifiedChatDockModule,
} as const);

export const CHAT_ENGINE_SUBTREE_MODULES = Object.freeze({
  adapters: ChatAdaptersModule,
  channels: ChatChannelsModule,
  npc: ChatNpcModule,
  replay: ChatReplayModule,
  telemetry: ChatTelemetryModule,
  intelligence: ChatIntelligenceModule,
  mlCompatibility: ChatMlCompatibilityModule,
  dlCompatibility: ChatDlCompatibilityModule,
} as const);

export const CHAT_ENGINE_NAMESPACE = Object.freeze({
  manifest: CHAT_ENGINE_PUBLIC_MANIFEST,
  exportPhases: CHAT_ENGINE_EXPORT_PHASES,
  publicExports: CHAT_ENGINE_PUBLIC_EXPORTS,
  runtimeModules: CHAT_ENGINE_RUNTIME_MODULES,
  subtreeModules: CHAT_ENGINE_SUBTREE_MODULES,
  intelligence: Object.freeze({
    canonical: ChatIntelligenceModule,
    compatibilityMl: ChatMlCompatibilityModule,
    compatibilityDl: ChatDlCompatibilityModule,
  } as const),
  types: CHAT_TYPES_NAMESPACE,
} as const);

/* ============================================================================
 * LAZY LOADER CONTRACTS
 * ========================================================================== */

export const CHAT_ENGINE_LAZY_LOADERS = Object.freeze({
  types: () => import('./types'),
  ChatEngine: () => import('./ChatEngine'),
  ChatState: () => import('./ChatState'),
  ChatReducer: () => import('./ChatReducer'),
  ChatSelectors: () => import('./ChatSelectors'),
  ChatMountRegistry: () => import('./ChatMountRegistry'),
  ChatEventBridge: () => import('./ChatEventBridge'),
  ChatSocketClient: () => import('./ChatSocketClient'),
  ChatPresenceController: () => import('./ChatPresenceController'),
  ChatTypingController: () => import('./ChatTypingController'),
  ChatNotificationController: () => import('./ChatNotificationController'),
  ChatTranscriptBuffer: () => import('./ChatTranscriptBuffer'),
  ChatPrivacyPolicy: () => import('./ChatPrivacyPolicy'),
  ChatChannelPolicy: () => import('./ChatChannelPolicy'),
  ChatInvasionDirector: () => import('./ChatInvasionDirector'),
  ChatNpcDirector: () => import('./ChatNpcDirector'),
  ChatRuntimeConfig: () => import('./ChatRuntimeConfig'),
  UnifiedChatDock: () => import('./UnifiedChatDock'),
  adapters: () => import('./adapters'),
  channels: () => import('./channels'),
  npc: () => import('./npc'),
  replay: () => import('./replay'),
  telemetry: () => import('./telemetry'),
  intelligence: () => import('./intelligence'),
  mlCompatibility: () => import('./ml/ml_index'),
  dlCompatibility: () => import('./dl/dl_index'),
} as const);

export type ChatEngineLazyLoaderKey = keyof typeof CHAT_ENGINE_LAZY_LOADERS;

/* ============================================================================
 * MOUNT AND CHANNEL SURFACES
 * ========================================================================== */

export const ChatChannelGuards = Object.freeze({
  isVisible: isVisibleChatChannel,
  isShadow: isShadowChatChannel,
  isAny: isAnyChatChannel,
  familyOf: channelFamilyOf,
  supportsComposer: supportsComposerForChannel,
} as const);

export const ChatMessageGuards = Object.freeze({
  isReplayEligible: isReplayEligibleMessage,
  isLegendCandidate: isLegendCandidateMessage,
} as const);

export const ChatMounts = Object.freeze({
  targets: CHAT_MOUNT_TARGETS,
  presets: CHAT_MOUNT_PRESETS,
} as const);

export const CHAT_ENGINE_CHANNEL_CAPABILITIES = Object.freeze(
  Object.fromEntries(
    CHAT_ALL_CHANNELS.map((channel) => [
      channel,
      Object.freeze({
        channel,
        family: channelFamilyOf(channel),
        isVisible: isVisibleChatChannel(channel),
        isShadow: isShadowChatChannel(channel),
        supportsComposer: supportsComposerForChannel(channel),
      }),
    ]),
  ) as Record<
    (typeof CHAT_ALL_CHANNELS)[number],
    Readonly<{
      channel: (typeof CHAT_ALL_CHANNELS)[number];
      family: ReturnType<typeof channelFamilyOf>;
      isVisible: boolean;
      isShadow: boolean;
      supportsComposer: boolean;
    }>
  >,
);

export const CHAT_ENGINE_MOUNT_SURFACE = Object.freeze({
  registry: 'ChatMountRegistry.ts',
  doctrine: Object.freeze({
    oneDock: true,
    multipleMountPresets: true,
    perModeChannelPermissions: true,
    zeroPerScreenChatBrains: true,
  } as const),
  currentTargets: CHAT_MOUNT_TARGETS,
  currentPresets: CHAT_MOUNT_PRESETS,
  expectedModeConsumers: Object.freeze([
    'BattleHUD.tsx',
    'ClubUI.tsx',
    'EmpireGameScreen.tsx',
    'GameBoard.tsx',
    'LeagueUI.tsx',
    'LobbyScreen.tsx',
    'PhantomGameScreen.tsx',
    'PredatorGameScreen.tsx',
    'SyndicateGameScreen.tsx',
  ] as const),
  adjacentEffectSurfaces: Object.freeze([
    'CounterplayModal.tsx',
    'EmpireBleedBanner.tsx',
    'MomentFlash.tsx',
    'ProofCard.tsx',
    'ProofCardV2.tsx',
    'RescueWindowBanner.tsx',
    'SabotageImpactPanel.tsx',
    'ThreatRadarPanel.tsx',
  ] as const),
} as const);

/* ============================================================================
 * INTELLIGENCE SURFACES
 * ========================================================================== */

export const CHAT_ENGINE_INTELLIGENCE_SURFACES = Object.freeze({
  frontendCanonical: CHAT_ENGINE_AUTHORITIES.frontendLearningRoot,
  backendCanonical: CHAT_ENGINE_AUTHORITIES.backendLearningRoot,
  sharedCanonical: CHAT_ENGINE_AUTHORITIES.sharedLearningRoot,
  compatibilityMl: `${CHAT_ENGINE_AUTHORITIES.frontendEngineRoot}/ml`,
  compatibilityDl: `${CHAT_ENGINE_AUTHORITIES.frontendEngineRoot}/dl`,
} as const);

export const CHAT_ENGINE_LEARNING_EVENT_FLOW = Object.freeze([
  'player opens chat',
  'frontend ChatTelemetryEmitter records chat_opened',
  'frontend FeatureExtractor builds first feature snapshot',
  'server ChatGateway forwards telemetry to backend sink',
  'backend LearningProfileStore creates cold-start profile',
  'backend ColdStartPopulationModel seeds defaults',
  'frontend receives inference snapshot',
  'frontend Hater/Helper/NPC policies begin with cold-start weights',
  'every message/event updates transcript, telemetry, and learning profile',
] as const);

export const CHAT_ENGINE_FRONTEND_INTELLIGENCE_DUTIES = Object.freeze([
  'instant feature collection',
  'cold-start scoring',
  'local personalization cache',
  'ranking request preparation',
  'ui-side intervention timing',
  'offline tolerance',
  'optimistic NPC pacing',
] as const);

export const CHAT_ENGINE_BACKEND_INTELLIGENCE_DUTIES = Object.freeze([
  'authoritative event ingestion',
  'transcript-linked learning profile updates',
  'online feature store writes',
  'response ranking',
  'helper timing decisions',
  'hater targeting',
  'cold-start population priors',
  'drift monitoring',
  'feedback labeling',
  'replay-backed training data assembly',
] as const);

export const CHAT_ENGINE_INTELLIGENCE_MODELS = Object.freeze({
  frontendMl: Object.freeze([
    'FeatureExtractor.ts',
    'EngagementScorer.ts',
    'ColdStartPolicy.ts',
    'HaterPersonaPolicy.ts',
    'HelperInterventionPolicy.ts',
    'ChannelRecommendationPolicy.ts',
    'ToxicityRiskScorer.ts',
    'DropOffRiskScorer.ts',
  ] as const),
  frontendDl: Object.freeze([
    'MessageEmbeddingClient.ts',
    'DialogueIntentEncoder.ts',
    'ConversationStateEncoder.ts',
    'ResponseRankerClient.ts',
    'SequenceMemoryClient.ts',
  ] as const),
  futureEmotionalLayer: Object.freeze([
    'EmotionScorer.ts',
    'SocialEmbarrassmentScorer.ts',
    'ConfidenceSwingTracker.ts',
  ] as const),
  futureRetrievalLayer: Object.freeze([
    'MemoryRetrievalClient.ts',
    'SaliencePreview.ts',
  ] as const),
} as const);

/* ============================================================================
 * DRAMATURGY / WOW SYSTEM INTENT
 * ========================================================================== */

export const CHAT_ENGINE_EXPERIENCE_EXPANSION_MAP = Object.freeze({
  drama: Object.freeze([
    'ChatMoment.ts',
    'ChatScene.ts',
    'ChatInterruption.ts',
    'experience/ChatDramaDirector.ts',
    'experience/ChatMomentOrchestrator.ts',
    'experience/ChatSilenceEngine.ts',
    'experience/ChatInterruptPriority.ts',
    'experience/ChatRevealScheduler.ts',
  ] as const),
  relationshipMemory: Object.freeze([
    'ChatRelationship.ts',
    'ChatAffinity.ts',
    'memory/RelationshipState.ts',
    'memory/RelationshipTracker.ts',
    'memory/TrustGraph.ts',
  ] as const),
  callbackMemory: Object.freeze([
    'ChatCallback.ts',
    'ChatQuote.ts',
    'memory/CallbackMemory.ts',
    'memory/QuoteRecallIndex.ts',
    'memory/ChatMemoryPreview.ts',
  ] as const),
  audienceHeat: Object.freeze([
    'ChatAudienceHeat.ts',
    'ChatReputation.ts',
    'social/AudienceHeatEngine.ts',
    'social/ReputationAura.ts',
    'social/ChannelMoodModel.ts',
    'social/CrowdVelocityTracker.ts',
  ] as const),
  persona: Object.freeze([
    'ChatPersona.ts',
    'ChatVoiceprint.ts',
    'persona/PersonaVoiceprint.ts',
    'persona/PersonaDelayProfile.ts',
    'persona/SignatureComposer.ts',
  ] as const),
  combat: Object.freeze([
    'ChatBossFight.ts',
    'ChatCounterplay.ts',
    'combat/ChatBossFightController.ts',
    'combat/ChatCounterplayBridge.ts',
    'combat/ChatAttackTelegraph.ts',
  ] as const),
  rescue: Object.freeze([
    'ChatRescue.ts',
    'ChatRecovery.ts',
    'rescue/RageQuitInterceptor.ts',
    'rescue/RecoveryPromptPolicy.ts',
    'rescue/RescueBannerBridge.ts',
  ] as const),
  negotiation: Object.freeze([
    'ChatNegotiation.ts',
    'ChatOffer.ts',
    'dealroom/NegotiationIntentTracker.ts',
    'dealroom/OfferPressureScorer.ts',
    'dealroom/BluffSignalTracker.ts',
  ] as const),
  shadow: Object.freeze([
    'ChatShadowState.ts',
    'shadow/ShadowStateMirror.ts',
    'shadow/RevealQueue.ts',
  ] as const),
  prestige: Object.freeze([
    'ChatLegend.ts',
    'ChatReward.ts',
    'rewards/ChatLegendMomentDetector.ts',
    'rewards/ChatRewardHooks.ts',
    'rewards/LegendPresentationPolicy.ts',
  ] as const),
  liveops: Object.freeze([
    'ChatLiveOps.ts',
    'ChatWorldEvent.ts',
    'liveops/SeasonalChatEventDirector.ts',
    'liveops/WorldEventOverlayPolicy.ts',
    'liveops/ChatEventBannerPolicy.ts',
  ] as const),
  presenceTheater: Object.freeze([
    'ChatPresenceStyle.ts',
    'presence/NpcPresenceStyle.ts',
    'presence/TypingTheater.ts',
    'presence/ReadDelayPolicy.ts',
  ] as const),
  continuity: Object.freeze([
    'continuity/CrossModeContinuity.ts',
    'continuity/CarryoverSceneState.ts',
    'continuity/CompanionContinuity.ts',
  ] as const),
  postRun: Object.freeze([
    'ChatPostRun.ts',
    'postrun/PostRunSceneBuilder.ts',
    'postrun/PostRunSummaryPolicy.ts',
  ] as const),
} as const);

/* ============================================================================
 * HELPER FUNCTIONS
 * ========================================================================== */

export function getChatEngineManifest(): ChatEngineManifest {
  return CHAT_ENGINE_PUBLIC_MANIFEST;
}

export function getChatEngineNamespace(): ChatEngineNamespace {
  return CHAT_ENGINE_NAMESPACE;
}

export function getChatEngineRoots() {
  return CHAT_ENGINE_ROOTS;
}

export function getChatEngineRuntimeModules() {
  return CHAT_ENGINE_RUNTIME_MODULES;
}

export function getChatEngineSubtreeModules() {
  return CHAT_ENGINE_SUBTREE_MODULES;
}

export function listChatEngineRuntimeFiles() {
  return [...CHAT_ENGINE_PRESENT_RUNTIME_FILES];
}

export function listChatEnginePresentSubtrees() {
  return [...CHAT_ENGINE_PRESENT_SUBTREES];
}

export function listChatEnginePresentIntelligenceFiles() {
  return [...CHAT_ENGINE_PRESENT_INTELLIGENCE_FILES];
}

export function listChatEngineCanonicalFrontendTargets() {
  return [...CHAT_ENGINE_CANONICAL_FRONTEND_TARGET_TREE];
}

export function listChatEngineFutureFrontendExpansions() {
  return [...CHAT_ENGINE_CANONICAL_FUTURE_FRONTEND_EXPANSIONS];
}

export function listChatEngineRuntimeLaws() {
  return [...CHAT_ENGINE_RUNTIME_LAWS];
}

export function listChatEngineExperienceLaws() {
  return [...CHAT_ENGINE_EXPERIENCE_LAWS];
}

export function listChatEngineLearningFlow() {
  return [...CHAT_ENGINE_LEARNING_EVENT_FLOW];
}

export function listChatEngineFrontendIntelligenceDuties() {
  return [...CHAT_ENGINE_FRONTEND_INTELLIGENCE_DUTIES];
}

export function listChatEngineBackendIntelligenceDuties() {
  return [...CHAT_ENGINE_BACKEND_INTELLIGENCE_DUTIES];
}

export function isChatEngineRuntimeFile(path: string): path is (typeof CHAT_ENGINE_PRESENT_RUNTIME_FILES)[number] {
  return (CHAT_ENGINE_PRESENT_RUNTIME_FILES as readonly string[]).includes(path);
}

export function isChatEnginePresentSubtree(path: string): path is (typeof CHAT_ENGINE_PRESENT_SUBTREES)[number] {
  return (CHAT_ENGINE_PRESENT_SUBTREES as readonly string[]).includes(path);
}

export function isChatEnginePresentIntelligenceFile(path: string): path is (typeof CHAT_ENGINE_PRESENT_INTELLIGENCE_FILES)[number] {
  return (CHAT_ENGINE_PRESENT_INTELLIGENCE_FILES as readonly string[]).includes(path);
}

export function isChatEngineCanonicalFrontendTarget(path: string): path is (typeof CHAT_ENGINE_CANONICAL_FRONTEND_TARGET_TREE)[number] {
  return (CHAT_ENGINE_CANONICAL_FRONTEND_TARGET_TREE as readonly string[]).includes(path);
}

export function isChatEngineFutureFrontendExpansion(path: string): path is (typeof CHAT_ENGINE_CANONICAL_FUTURE_FRONTEND_EXPANSIONS)[number] {
  return (CHAT_ENGINE_CANONICAL_FUTURE_FRONTEND_EXPANSIONS as readonly string[]).includes(path);
}

export function isChatEngineLazyLoaderKey(value: string): value is ChatEngineLazyLoaderKey {
  return Object.prototype.hasOwnProperty.call(CHAT_ENGINE_LAZY_LOADERS, value);
}

export function getChatEngineLazyLoader<K extends ChatEngineLazyLoaderKey>(key: K) {
  return CHAT_ENGINE_LAZY_LOADERS[key];
}

export async function loadChatEngineModule<K extends ChatEngineLazyLoaderKey>(key: K) {
  return CHAT_ENGINE_LAZY_LOADERS[key]();
}

export function getChatChannelCapability(channel: (typeof CHAT_ALL_CHANNELS)[number]) {
  return CHAT_ENGINE_CHANNEL_CAPABILITIES[channel];
}

export function listChatChannelCapabilities() {
  return CHAT_ALL_CHANNELS.map((channel) => CHAT_ENGINE_CHANNEL_CAPABILITIES[channel]);
}

export function isChatEngineVisibleChannel(channel: unknown): boolean {
  return typeof channel === 'string' && isVisibleChatChannel(channel);
}

export function isChatEngineShadowChannel(channel: unknown): boolean {
  return typeof channel === 'string' && isShadowChatChannel(channel);
}

export function isChatEngineAnyChannel(channel: unknown): boolean {
  return typeof channel === 'string' && isAnyChatChannel(channel);
}

export function doesChatEngineSupportComposer(channel: unknown): boolean {
  return typeof channel === 'string' && supportsComposerForChannel(channel);
}

export function getChatChannelFamily(channel: (typeof CHAT_ALL_CHANNELS)[number]) {
  return channelFamilyOf(channel);
}

export function isReplayEligibleChatMessage(message: unknown): boolean {
  return isReplayEligibleMessage(message);
}

export function isLegendCandidateChatMessage(message: unknown): boolean {
  return isLegendCandidateMessage(message);
}

export function listChatMountTargets() {
  return [...CHAT_MOUNT_TARGETS];
}

export function listChatMountPresets() {
  return [...CHAT_MOUNT_PRESETS];
}

export function getChatMountSurface() {
  return CHAT_ENGINE_MOUNT_SURFACE;
}

export function getChatEngineTrustBoundaries() {
  return CHAT_ENGINE_TRUST_BOUNDARIES;
}

export function getChatEngineCompatibilityLanes() {
  return CHAT_ENGINE_COMPATIBILITY_LANES;
}

export function getChatEngineMigrationDonorZones() {
  return CHAT_ENGINE_MIGRATION_DONOR_ZONES;
}

export function getChatEngineMigrationExtractMap() {
  return CHAT_ENGINE_MIGRATION_EXTRACT_MAP;
}

export function getChatEngineExperienceExpansionMap() {
  return CHAT_ENGINE_EXPERIENCE_EXPANSION_MAP;
}

export function getChatEngineIntelligenceSurfaces() {
  return CHAT_ENGINE_INTELLIGENCE_SURFACES;
}

export function getChatEngineExportPhases() {
  return CHAT_ENGINE_EXPORT_PHASES;
}

export function getChatEnginePublicExports() {
  return CHAT_ENGINE_PUBLIC_EXPORTS;
}

export function getChatEngineModuleNamespaceKeyList() {
  return [...CHAT_ENGINE_PUBLIC_EXPORTS.namespaces];
}

export function getChatEngineModuleFileList() {
  return [...CHAT_ENGINE_PUBLIC_EXPORTS.files];
}

export function getChatEngineModuleTreeList() {
  return [...CHAT_ENGINE_PUBLIC_EXPORTS.trees];
}

export function getChatEngineRuntimeSummary() {
  return Object.freeze({
    module: CHAT_ENGINE_MODULE_NAME,
    version: CHAT_ENGINE_VERSION,
    publicApiVersion: CHAT_ENGINE_PUBLIC_API_VERSION,
    roots: CHAT_ENGINE_ROOTS,
    runtimeFiles: CHAT_ENGINE_PRESENT_RUNTIME_FILES,
    subtrees: CHAT_ENGINE_PRESENT_SUBTREES,
    intelligenceFiles: CHAT_ENGINE_PRESENT_INTELLIGENCE_FILES,
    trustBoundaries: CHAT_ENGINE_TRUST_BOUNDARIES,
  } as const);
}

export function describeChatEnginePath(path: string) {
  if (isChatEngineRuntimeFile(path)) {
    return Object.freeze({
      path,
      kind: 'runtime-file',
      root: CHAT_ENGINE_FRONTEND_ROOT,
      phase: 'phase-one',
    } as const);
  }

  if (isChatEnginePresentSubtree(path)) {
    return Object.freeze({
      path,
      kind: 'present-subtree',
      root: CHAT_ENGINE_FRONTEND_ROOT,
      phase: 'phase-two',
    } as const);
  }

  if (isChatEnginePresentIntelligenceFile(path)) {
    return Object.freeze({
      path,
      kind: 'present-intelligence-file',
      root: CHAT_ENGINE_FRONTEND_ROOT,
      phase: 'phase-two',
    } as const);
  }

  if (isChatEngineCanonicalFrontendTarget(path)) {
    return Object.freeze({
      path,
      kind: 'canonical-frontend-target',
      root: CHAT_ENGINE_FRONTEND_ROOT,
      phase: 'phase-three-canonical',
    } as const);
  }

  if (isChatEngineFutureFrontendExpansion(path)) {
    return Object.freeze({
      path,
      kind: 'future-frontend-expansion',
      root: CHAT_ENGINE_FRONTEND_ROOT,
      phase: 'wow-layer',
    } as const);
  }

  return Object.freeze({
    path,
    kind: 'unknown-to-barrel',
    root: CHAT_ENGINE_FRONTEND_ROOT,
    phase: 'untracked',
  } as const);
}

export function resolveChatEngineSubtreeNamespace(path: (typeof CHAT_ENGINE_PRESENT_SUBTREES)[number]) {
  switch (path) {
    case 'adapters':
      return ChatAdaptersModule;
    case 'channels':
      return ChatChannelsModule;
    case 'dl':
      return ChatDlCompatibilityModule;
    case 'intelligence':
      return ChatIntelligenceModule;
    case 'ml':
      return ChatMlCompatibilityModule;
    case 'npc':
      return ChatNpcModule;
    case 'replay':
      return ChatReplayModule;
    case 'telemetry':
      return ChatTelemetryModule;
  }
}

export async function loadChatEngineSubtreeNamespace(path: (typeof CHAT_ENGINE_PRESENT_SUBTREES)[number]) {
  switch (path) {
    case 'adapters':
      return import('./adapters');
    case 'channels':
      return import('./channels');
    case 'dl':
      return import('./dl/dl_index');
    case 'intelligence':
      return import('./intelligence');
    case 'ml':
      return import('./ml/ml_index');
    case 'npc':
      return import('./npc');
    case 'replay':
      return import('./replay');
    case 'telemetry':
      return import('./telemetry');
  }
}

/* ============================================================================
 * PUBLIC TEST / TOOL SURFACES
 * ========================================================================== */

export const CHAT_ENGINE_TOOLING_SURFACE = Object.freeze({
  manifest: CHAT_ENGINE_PUBLIC_MANIFEST,
  namespace: CHAT_ENGINE_NAMESPACE,
  runtimeSummary: getChatEngineRuntimeSummary(),
  laws: CHAT_ENGINE_RUNTIME_LAWS,
  experienceLaws: CHAT_ENGINE_EXPERIENCE_LAWS,
  migration: Object.freeze({
    donorZones: CHAT_ENGINE_MIGRATION_DONOR_ZONES,
    extractMap: CHAT_ENGINE_MIGRATION_EXTRACT_MAP,
  } as const),
  compatibility: CHAT_ENGINE_COMPATIBILITY_LANES,
  learning: Object.freeze({
    surfaces: CHAT_ENGINE_INTELLIGENCE_SURFACES,
    flow: CHAT_ENGINE_LEARNING_EVENT_FLOW,
    frontendDuties: CHAT_ENGINE_FRONTEND_INTELLIGENCE_DUTIES,
    backendDuties: CHAT_ENGINE_BACKEND_INTELLIGENCE_DUTIES,
    models: CHAT_ENGINE_INTELLIGENCE_MODELS,
  } as const),
  mountSurface: CHAT_ENGINE_MOUNT_SURFACE,
  lazyLoaders: CHAT_ENGINE_LAZY_LOADERS,
} as const);

/* ============================================================================
 * TYPE EXPORTS
 * ========================================================================== */

export type ChatEngineNamespace = typeof CHAT_ENGINE_NAMESPACE;
export type ChatEngineManifest = typeof CHAT_ENGINE_PUBLIC_MANIFEST;
export type ChatEngineExportPhases = typeof CHAT_ENGINE_EXPORT_PHASES;
export type ChatEnginePublicExports = typeof CHAT_ENGINE_PUBLIC_EXPORTS;
export type ChatEngineRoots = typeof CHAT_ENGINE_ROOTS;
export type ChatEnginePresentRuntimeFile = (typeof CHAT_ENGINE_PRESENT_RUNTIME_FILES)[number];
export type ChatEnginePresentSubtree = (typeof CHAT_ENGINE_PRESENT_SUBTREES)[number];
export type ChatEnginePresentIntelligenceFile = (typeof CHAT_ENGINE_PRESENT_INTELLIGENCE_FILES)[number];
export type ChatEngineCanonicalFrontendTarget = (typeof CHAT_ENGINE_CANONICAL_FRONTEND_TARGET_TREE)[number];
export type ChatEngineFutureFrontendExpansion = (typeof CHAT_ENGINE_CANONICAL_FUTURE_FRONTEND_EXPANSIONS)[number];
export type ChatEngineRuntimeLaw = (typeof CHAT_ENGINE_RUNTIME_LAWS)[number];
export type ChatEngineExperienceLaw = (typeof CHAT_ENGINE_EXPERIENCE_LAWS)[number];
export type ChatEngineLearningFlowStep = (typeof CHAT_ENGINE_LEARNING_EVENT_FLOW)[number];
export type ChatEngineFrontendIntelligenceDuty = (typeof CHAT_ENGINE_FRONTEND_INTELLIGENCE_DUTIES)[number];
export type ChatEngineBackendIntelligenceDuty = (typeof CHAT_ENGINE_BACKEND_INTELLIGENCE_DUTIES)[number];
export type ChatEngineModuleFile = (typeof CHAT_ENGINE_PUBLIC_EXPORTS.files)[number];
export type ChatEngineModuleTree = (typeof CHAT_ENGINE_PUBLIC_EXPORTS.trees)[number];
export type ChatEngineNamespaceKey = (typeof CHAT_ENGINE_PUBLIC_EXPORTS.namespaces)[number];
export type ChatEngineChannelCapability =
  (typeof CHAT_ENGINE_CHANNEL_CAPABILITIES)[(typeof CHAT_ALL_CHANNELS)[number]];
export type ChatEngineToolingSurface = typeof CHAT_ENGINE_TOOLING_SURFACE;

/* ============================================================================
 * FINAL PUBLIC DEFAULT-LIKE SURFACE
 * ========================================================================== */

export const PZOChat = Object.freeze({
  moduleName: CHAT_ENGINE_MODULE_NAME,
  version: CHAT_ENGINE_VERSION,
  manifest: CHAT_ENGINE_PUBLIC_MANIFEST,
  namespace: CHAT_ENGINE_NAMESPACE,
  runtimeModules: CHAT_ENGINE_RUNTIME_MODULES,
  subtreeModules: CHAT_ENGINE_SUBTREE_MODULES,
  mounts: ChatMounts,
  channelGuards: ChatChannelGuards,
  messageGuards: ChatMessageGuards,
  tooling: CHAT_ENGINE_TOOLING_SURFACE,
  lazyLoaders: CHAT_ENGINE_LAZY_LOADERS,
  helpers: Object.freeze({
    getManifest: getChatEngineManifest,
    getNamespace: getChatEngineNamespace,
    getRoots: getChatEngineRoots,
    listRuntimeFiles: listChatEngineRuntimeFiles,
    listPresentSubtrees: listChatEnginePresentSubtrees,
    listPresentIntelligenceFiles: listChatEnginePresentIntelligenceFiles,
    listCanonicalTargets: listChatEngineCanonicalFrontendTargets,
    listFutureExpansions: listChatEngineFutureFrontendExpansions,
    listRuntimeLaws: listChatEngineRuntimeLaws,
    listExperienceLaws: listChatEngineExperienceLaws,
    listLearningFlow: listChatEngineLearningFlow,
    listFrontendIntelligenceDuties: listChatEngineFrontendIntelligenceDuties,
    listBackendIntelligenceDuties: listChatEngineBackendIntelligenceDuties,
    isRuntimeFile: isChatEngineRuntimeFile,
    isPresentSubtree: isChatEnginePresentSubtree,
    isPresentIntelligenceFile: isChatEnginePresentIntelligenceFile,
    isCanonicalFrontendTarget: isChatEngineCanonicalFrontendTarget,
    isFutureFrontendExpansion: isChatEngineFutureFrontendExpansion,
    isLazyLoaderKey: isChatEngineLazyLoaderKey,
    getLazyLoader: getChatEngineLazyLoader,
    loadModule: loadChatEngineModule,
    getChannelCapability: getChatChannelCapability,
    listChannelCapabilities: listChatChannelCapabilities,
    isVisibleChannel: isChatEngineVisibleChannel,
    isShadowChannel: isChatEngineShadowChannel,
    isAnyChannel: isChatEngineAnyChannel,
    supportsComposer: doesChatEngineSupportComposer,
    getChannelFamily: getChatChannelFamily,
    isReplayEligibleMessage: isReplayEligibleChatMessage,
    isLegendCandidateMessage: isLegendCandidateChatMessage,
    listMountTargets: listChatMountTargets,
    listMountPresets: listChatMountPresets,
    getMountSurface: getChatMountSurface,
    getTrustBoundaries: getChatEngineTrustBoundaries,
    getCompatibilityLanes: getChatEngineCompatibilityLanes,
    getMigrationDonorZones: getChatEngineMigrationDonorZones,
    getMigrationExtractMap: getChatEngineMigrationExtractMap,
    getExperienceExpansionMap: getChatEngineExperienceExpansionMap,
    getIntelligenceSurfaces: getChatEngineIntelligenceSurfaces,
    getExportPhases: getChatEngineExportPhases,
    getPublicExports: getChatEnginePublicExports,
    getNamespaceKeyList: getChatEngineModuleNamespaceKeyList,
    getModuleFileList: getChatEngineModuleFileList,
    getModuleTreeList: getChatEngineModuleTreeList,
    getRuntimeSummary: getChatEngineRuntimeSummary,
    describePath: describeChatEnginePath,
    resolveSubtreeNamespace: resolveChatEngineSubtreeNamespace,
    loadSubtreeNamespace: loadChatEngineSubtreeNamespace,
  } as const),
} as const);
