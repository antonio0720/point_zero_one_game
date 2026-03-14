// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/intelligence/index.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT INTELLIGENCE PUBLIC BARREL
 * FILE: pzo-web/src/engines/chat/intelligence/index.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Stable, compile-safe, feature-complete public surface for the frontend chat
 * intelligence lane.
 *
 * This upgraded barrel does five jobs deliberately:
 * 1. re-exports every real runtime that already exists now,
 * 2. centralizes the lane manifest for ChatEngine, UI, telemetry, and future
 *    ML/DL adapters,
 * 3. gives consumers one import-stable authority for versions, laws,
 *    capabilities, defaults, and phase state,
 * 4. exposes precomposed namespace objects so downstream code can consume the
 *    lane ergonomically without deep import drift,
 * 5. remains honest about what is present now versus what is staged next.
 *
 * Permanent doctrine
 * ------------------
 * - Export what is real now.
 * - Do not fake future ML/DL runtime presence.
 * - Keep cold-start, learning-profile, and bridge lanes import-stable.
 * - Preserve compile safety while widening the public surface.
 * - Frontend intelligence is immediate and advisory; backend intelligence is
 *   durable and authoritative.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import {
  CHAT_ENGINE_AUTHORITIES,
  CHAT_ENGINE_PUBLIC_API_VERSION,
  CHAT_ENGINE_VERSION,
  CHAT_SHADOW_CHANNELS,
  CHAT_VISIBLE_CHANNELS,
  type ChatChannelId,
  type ChatFeatureSnapshot,
  type ChatLearningProfile as ChatLearningProfileContract,
  type ChatTelemetryEnvelope,
  type ChatVisibleChannel,
} from '../types';

import * as ChatLearningBridgeRuntime from './ChatLearningBridge';
import * as ChatLearningProfileRuntime from './ChatLearningProfile';
import * as ChatColdStartProfileRuntime from './ChatColdStartProfile';

export * from './ChatLearningBridge';
export * from './ChatLearningProfile';
export * from './ChatColdStartProfile';

/* ========================================================================== */
/* MARK: Barrel identity                                                      */
/* ========================================================================== */

export const CHAT_INTELLIGENCE_MODULE_NAME =
  'PZO_FRONTEND_CHAT_INTELLIGENCE' as const;

export const CHAT_INTELLIGENCE_VERSION =
  '2026.03.13-intelligence-barrel.v2' as const;

export const CHAT_INTELLIGENCE_BARREL_LAWS = Object.freeze([
  'Export what is real now, not what is merely planned.',
  'Cold-start, learning-profile, and bridge runtimes are first-class lane citizens.',
  'Frontend intelligence remains advisory even when locally sophisticated.',
  'Import stability matters as much as behavioral depth.',
  'Namespace objects should reduce consumer drift, not create new coupling.',
  'Phase planning can be visible without pretending future modules already execute.',
] as const);

/* ========================================================================== */
/* MARK: Utility helpers                                                      */
/* ========================================================================== */

function uniqueStrings(values: readonly string[]): readonly string[] {
  return Object.freeze(Array.from(new Set(values.filter(Boolean))));
}

function freezeVisibleChannels(
  values: readonly ChatVisibleChannel[],
): readonly ChatVisibleChannel[] {
  return Object.freeze([...values]);
}

function freezeChannelIds(values: readonly ChatChannelId[]): readonly ChatChannelId[] {
  return Object.freeze([...values]);
}

/* ========================================================================== */
/* MARK: Public phase map                                                     */
/* ========================================================================== */

export const CHAT_INTELLIGENCE_PHASE_EXPORTS = Object.freeze({
  providedNow: Object.freeze([
    'index.ts',
    'ChatLearningBridge.ts',
    'ChatLearningProfile.ts',
    'ChatColdStartProfile.ts',
  ] as const),
  expectedNext: Object.freeze([
    'ml/index.ts',
    'ml/FeatureExtractor.ts',
    'ml/EngagementScorer.ts',
    'ml/ColdStartPolicy.ts',
    'ml/HaterPersonaPolicy.ts',
    'ml/HelperInterventionPolicy.ts',
    'ml/ChannelRecommendationPolicy.ts',
    'ml/ToxicityRiskScorer.ts',
    'ml/DropOffRiskScorer.ts',
    'dl/index.ts',
    'dl/MessageEmbeddingClient.ts',
    'dl/DialogueIntentEncoder.ts',
    'dl/ConversationStateEncoder.ts',
    'dl/ResponseRankerClient.ts',
    'dl/SequenceMemoryClient.ts',
    'telemetry/ChatTelemetryEmitter.ts',
    'telemetry/ChatTelemetryQueue.ts',
  ] as const),
} as const);

/* ========================================================================== */
/* MARK: Runtime capability surface                                           */
/* ========================================================================== */

export const CHAT_INTELLIGENCE_COMPILE_SAFE_SURFACE = Object.freeze({
  hasColdStartRuntime: true,
  hasLearningProfileRuntime: true,
  hasBridgeRuntime: true,
  canInstantiateBridge: true,
  canHydrateColdStartProfile: true,
  canHydrateLearningProfile: true,
  canCreateColdStartRecommendations: true,
  canCreateLearningRecommendations: true,
  canApplyFeatureSnapshotsToLearningProfile: true,
  canPrepareTelemetry: true,
  canQueueOfflineEmission: true,
  canAcceptServerRevisions: true,
  canEmitFeatureSnapshots: true,
  awaitsFutureMlModules: true,
  awaitsFutureDlModules: true,
} as const);

export const CHAT_INTELLIGENCE_RUNTIME_MODULES = Object.freeze({
  barrel: Object.freeze({
    moduleName: CHAT_INTELLIGENCE_MODULE_NAME,
    version: CHAT_INTELLIGENCE_VERSION,
    laws: CHAT_INTELLIGENCE_BARREL_LAWS,
  }),
  bridge: Object.freeze({
    moduleName: ChatLearningBridgeRuntime.CHAT_LEARNING_BRIDGE_MODULE_NAME,
    version: ChatLearningBridgeRuntime.CHAT_LEARNING_BRIDGE_VERSION,
    laws: ChatLearningBridgeRuntime.CHAT_LEARNING_BRIDGE_RUNTIME_LAWS,
    defaults: ChatLearningBridgeRuntime.CHAT_LEARNING_BRIDGE_DEFAULTS,
    eventNames: ChatLearningBridgeRuntime.CHAT_LEARNING_BRIDGE_EVENT_NAMES,
    channelKeys: ChatLearningBridgeRuntime.CHAT_LEARNING_BRIDGE_CHANNEL_KEYS,
  }),
  learningProfile: Object.freeze({
    moduleName: ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_MODULE_NAME,
    version: ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_VERSION,
    laws: ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_RUNTIME_LAWS,
    defaults: ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_DEFAULTS,
    helperSeedIds: ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_HELPER_SEED_IDS,
    haterSeedIds: ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_HATER_SEED_IDS,
  }),
  coldStart: Object.freeze({
    moduleName: ChatColdStartProfileRuntime.CHAT_COLD_START_PROFILE_MODULE_NAME,
    version: ChatColdStartProfileRuntime.CHAT_COLD_START_PROFILE_VERSION,
    laws: ChatColdStartProfileRuntime.CHAT_COLD_START_RUNTIME_LAWS,
    defaults: ChatColdStartProfileRuntime.CHAT_COLD_START_DEFAULTS,
    minimums: ChatColdStartProfileRuntime.CHAT_COLD_START_MINIMUMS,
    maximums: ChatColdStartProfileRuntime.CHAT_COLD_START_MAXIMUMS,
  }),
} as const);

export const CHAT_INTELLIGENCE_FRONTEND_LAWS = Object.freeze(
  uniqueStrings([
    ...CHAT_INTELLIGENCE_BARREL_LAWS,
    ...ChatLearningBridgeRuntime.CHAT_LEARNING_BRIDGE_RUNTIME_LAWS,
    ...ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_RUNTIME_LAWS,
    ...ChatColdStartProfileRuntime.CHAT_COLD_START_RUNTIME_LAWS,
  ]),
);

/* ========================================================================== */
/* MARK: Channel + authority manifest                                         */
/* ========================================================================== */

export const CHAT_INTELLIGENCE_CHANNELS = Object.freeze({
  visible: freezeVisibleChannels(CHAT_VISIBLE_CHANNELS),
  shadow: freezeChannelIds(CHAT_SHADOW_CHANNELS),
  bridgeKeys: freezeVisibleChannels(
    ChatLearningBridgeRuntime.CHAT_LEARNING_BRIDGE_CHANNEL_KEYS,
  ),
  all: freezeChannelIds([
    ...CHAT_VISIBLE_CHANNELS,
    ...CHAT_SHADOW_CHANNELS,
  ] as readonly ChatChannelId[]),
} as const);

export const CHAT_INTELLIGENCE_AUTHORITIES = Object.freeze({
  frontendEngine: CHAT_ENGINE_AUTHORITIES.frontendEngineRoot,
  frontendLearning: CHAT_ENGINE_AUTHORITIES.frontendLearningRoot,
  backendLearning: CHAT_ENGINE_AUTHORITIES.backendLearningRoot,
  sharedContracts: CHAT_ENGINE_AUTHORITIES.sharedContractsRoot,
  sharedLearning: CHAT_ENGINE_AUTHORITIES.sharedLearningRoot,
} as const);

export const CHAT_INTELLIGENCE_PUBLIC_MANIFEST = Object.freeze({
  moduleName: CHAT_INTELLIGENCE_MODULE_NAME,
  version: CHAT_INTELLIGENCE_VERSION,
  engineVersion: CHAT_ENGINE_VERSION,
  publicApiVersion: CHAT_ENGINE_PUBLIC_API_VERSION,
  authorities: CHAT_INTELLIGENCE_AUTHORITIES,
  channels: CHAT_INTELLIGENCE_CHANNELS,
  runtimes: CHAT_INTELLIGENCE_RUNTIME_MODULES,
  compileSafeSurface: CHAT_INTELLIGENCE_COMPILE_SAFE_SURFACE,
  phaseExports: CHAT_INTELLIGENCE_PHASE_EXPORTS,
} as const);

/* ========================================================================== */
/* MARK: Public namespaces                                                    */
/* ========================================================================== */

export const CHAT_INTELLIGENCE_BRIDGE_NAMESPACE = Object.freeze({
  moduleName: ChatLearningBridgeRuntime.CHAT_LEARNING_BRIDGE_MODULE_NAME,
  version: ChatLearningBridgeRuntime.CHAT_LEARNING_BRIDGE_VERSION,
  defaults: ChatLearningBridgeRuntime.CHAT_LEARNING_BRIDGE_DEFAULTS,
  laws: ChatLearningBridgeRuntime.CHAT_LEARNING_BRIDGE_RUNTIME_LAWS,
  eventNames: ChatLearningBridgeRuntime.CHAT_LEARNING_BRIDGE_EVENT_NAMES,
  channelKeys: ChatLearningBridgeRuntime.CHAT_LEARNING_BRIDGE_CHANNEL_KEYS,
  ChatLearningBridge: ChatLearningBridgeRuntime.ChatLearningBridge,
  createChatLearningBridge: ChatLearningBridgeRuntime.createChatLearningBridge,
  isFrontendLearningTelemetryEventName:
    ChatLearningBridgeRuntime.isFrontendLearningTelemetryEventName,
} as const);

export const CHAT_INTELLIGENCE_LEARNING_PROFILE_NAMESPACE = Object.freeze({
  moduleName: ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_MODULE_NAME,
  version: ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_VERSION,
  defaults: ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_DEFAULTS,
  laws: ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_RUNTIME_LAWS,
  helperSeedIds: ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_HELPER_SEED_IDS,
  haterSeedIds: ChatLearningProfileRuntime.CHAT_LEARNING_PROFILE_HATER_SEED_IDS,
  createChatLearningProfile:
    ChatLearningProfileRuntime.createChatLearningProfile,
  cloneChatLearningProfile: ChatLearningProfileRuntime.cloneChatLearningProfile,
  serializeChatLearningProfile:
    ChatLearningProfileRuntime.serializeChatLearningProfile,
  hydrateChatLearningProfile:
    ChatLearningProfileRuntime.hydrateChatLearningProfile,
  isChatLearningProfile: ChatLearningProfileRuntime.isChatLearningProfile,
  withTouchedChatLearningProfile:
    ChatLearningProfileRuntime.withTouchedChatLearningProfile,
  withChatLearningProfileMemoryAnchors:
    ChatLearningProfileRuntime.withChatLearningProfileMemoryAnchors,
  withChatLearningProfileEmotionBaseline:
    ChatLearningProfileRuntime.withChatLearningProfileEmotionBaseline,
  withChatLearningProfileHelperTrust:
    ChatLearningProfileRuntime.withChatLearningProfileHelperTrust,
  withChatLearningProfileHaterTargeting:
    ChatLearningProfileRuntime.withChatLearningProfileHaterTargeting,
  withChatLearningProfileChannelAffinity:
    ChatLearningProfileRuntime.withChatLearningProfileChannelAffinity,
  applyFeatureSnapshotToChatLearningProfile:
    ChatLearningProfileRuntime.applyFeatureSnapshotToChatLearningProfile,
  applyAffectSnapshotToChatLearningProfile:
    ChatLearningProfileRuntime.applyAffectSnapshotToChatLearningProfile,
  applyFeatureDropOffSignalsToChatLearningProfile:
    ChatLearningProfileRuntime.applyFeatureDropOffSignalsToChatLearningProfile,
  applyTelemetryEnvelopeToChatLearningProfile:
    ChatLearningProfileRuntime.applyTelemetryEnvelopeToChatLearningProfile,
  createChatLearningProfileFromLegacyCompat:
    ChatLearningProfileRuntime.createChatLearningProfileFromLegacyCompat,
  mergeAuthoritativeChatLearningProfile:
    ChatLearningProfileRuntime.mergeAuthoritativeChatLearningProfile,
  createChatLearningProfileRecommendation:
    ChatLearningProfileRuntime.createChatLearningProfileRecommendation,
} as const);

export const CHAT_INTELLIGENCE_COLD_START_NAMESPACE = Object.freeze({
  moduleName: ChatColdStartProfileRuntime.CHAT_COLD_START_PROFILE_MODULE_NAME,
  version: ChatColdStartProfileRuntime.CHAT_COLD_START_PROFILE_VERSION,
  defaults: ChatColdStartProfileRuntime.CHAT_COLD_START_DEFAULTS,
  minimums: ChatColdStartProfileRuntime.CHAT_COLD_START_MINIMUMS,
  maximums: ChatColdStartProfileRuntime.CHAT_COLD_START_MAXIMUMS,
  laws: ChatColdStartProfileRuntime.CHAT_COLD_START_RUNTIME_LAWS,
  compatReadme: ChatColdStartProfileRuntime.CHAT_COLD_START_COMPAT_README,
  createDefaultChatColdStartBiases:
    ChatColdStartProfileRuntime.createDefaultChatColdStartBiases,
  computeChatColdStartHeuristics:
    ChatColdStartProfileRuntime.computeChatColdStartHeuristics,
  deriveChatColdStartBiasesFromLegacyProfile:
    ChatColdStartProfileRuntime.deriveChatColdStartBiasesFromLegacyProfile,
  deriveChatColdStartBiasesFromFeatureSnapshot:
    ChatColdStartProfileRuntime.deriveChatColdStartBiasesFromFeatureSnapshot,
  mergeChatColdStartBiasVectors:
    ChatColdStartProfileRuntime.mergeChatColdStartBiasVectors,
  createChatColdStartProfile:
    ChatColdStartProfileRuntime.createChatColdStartProfile,
  createChatColdStartProfileFromLegacyCompat:
    ChatColdStartProfileRuntime.createChatColdStartProfileFromLegacyCompat,
  cloneChatColdStartProfile:
    ChatColdStartProfileRuntime.cloneChatColdStartProfile,
  serializeChatColdStartProfile:
    ChatColdStartProfileRuntime.serializeChatColdStartProfile,
  hydrateChatColdStartProfile:
    ChatColdStartProfileRuntime.hydrateChatColdStartProfile,
  isChatColdStartProfile: ChatColdStartProfileRuntime.isChatColdStartProfile,
  upgradeChatColdStartProfileVersion:
    ChatColdStartProfileRuntime.upgradeChatColdStartProfileVersion,
  mergeChatColdStartProfiles:
    ChatColdStartProfileRuntime.mergeChatColdStartProfiles,
  scoreInitialHelperCadence01:
    ChatColdStartProfileRuntime.scoreInitialHelperCadence01,
  scoreInitialHaterCadence01:
    ChatColdStartProfileRuntime.scoreInitialHaterCadence01,
  scoreInitialNegotiationGuard01:
    ChatColdStartProfileRuntime.scoreInitialNegotiationGuard01,
  recommendColdStartOpeningChannel:
    ChatColdStartProfileRuntime.recommendColdStartOpeningChannel,
  createChatColdStartRecommendation:
    ChatColdStartProfileRuntime.createChatColdStartRecommendation,
} as const);

export const CHAT_INTELLIGENCE_NAMESPACE = Object.freeze({
  manifest: CHAT_INTELLIGENCE_PUBLIC_MANIFEST,
  barrelLaws: CHAT_INTELLIGENCE_BARREL_LAWS,
  frontendLaws: CHAT_INTELLIGENCE_FRONTEND_LAWS,
  authorities: CHAT_INTELLIGENCE_AUTHORITIES,
  channels: CHAT_INTELLIGENCE_CHANNELS,
  phaseExports: CHAT_INTELLIGENCE_PHASE_EXPORTS,
  bridge: CHAT_INTELLIGENCE_BRIDGE_NAMESPACE,
  learningProfile: CHAT_INTELLIGENCE_LEARNING_PROFILE_NAMESPACE,
  coldStart: CHAT_INTELLIGENCE_COLD_START_NAMESPACE,
  compileSafeSurface: CHAT_INTELLIGENCE_COMPILE_SAFE_SURFACE,
} as const);

/* ========================================================================== */
/* MARK: Composite facade                                                     */
/* ========================================================================== */

export const ChatIntelligence = Object.freeze({
  manifest: CHAT_INTELLIGENCE_PUBLIC_MANIFEST,
  namespace: CHAT_INTELLIGENCE_NAMESPACE,
  capabilities: CHAT_INTELLIGENCE_COMPILE_SAFE_SURFACE,
  bridge: CHAT_INTELLIGENCE_BRIDGE_NAMESPACE,
  learningProfile: CHAT_INTELLIGENCE_LEARNING_PROFILE_NAMESPACE,
  coldStart: CHAT_INTELLIGENCE_COLD_START_NAMESPACE,

  ChatLearningBridge: ChatLearningBridgeRuntime.ChatLearningBridge,
  createChatLearningBridge: ChatLearningBridgeRuntime.createChatLearningBridge,
  createChatLearningProfile:
    ChatLearningProfileRuntime.createChatLearningProfile,
  createChatLearningProfileRecommendation:
    ChatLearningProfileRuntime.createChatLearningProfileRecommendation,
  createChatColdStartProfile:
    ChatColdStartProfileRuntime.createChatColdStartProfile,
  createChatColdStartRecommendation:
    ChatColdStartProfileRuntime.createChatColdStartRecommendation,
} as const);

/* ========================================================================== */
/* MARK: Readme + known contract placeholders                                 */
/* ========================================================================== */

export const CHAT_INTELLIGENCE_README = Object.freeze({
  importPaths: Object.freeze({
    intelligenceBarrel: '/pzo-web/src/engines/chat/intelligence',
    bridge: '/pzo-web/src/engines/chat/intelligence/ChatLearningBridge',
    learningProfile:
      '/pzo-web/src/engines/chat/intelligence/ChatLearningProfile',
    coldStart: '/pzo-web/src/engines/chat/intelligence/ChatColdStartProfile',
  }),
  recommendedConsumers: Object.freeze([
    'pzo-web/src/engines/chat/ChatEngine.ts',
    'pzo-web/src/components/chat/*',
    'pzo-web/src/engines/chat/telemetry/*',
    'future ml/* modules',
    'future dl/* modules',
  ] as const),
  compileSafeNow: Object.freeze([
    'bridge instantiation',
    'queue-based telemetry preparation',
    'cold-start profile creation + hydration',
    'learning profile creation + hydration',
    'feature snapshot application',
    'telemetry-driven profile mutation',
    'server profile merge',
    'channel recommendation hints',
  ] as const),
  stagedNext: CHAT_INTELLIGENCE_PHASE_EXPORTS.expectedNext,
} as const);

export type ChatIntelligenceManifest = typeof CHAT_INTELLIGENCE_PUBLIC_MANIFEST;
export type ChatIntelligenceNamespace = typeof CHAT_INTELLIGENCE_NAMESPACE;
export type ChatIntelligenceReadme = typeof CHAT_INTELLIGENCE_README;
export type ChatIntelligenceCapabilities =
  typeof CHAT_INTELLIGENCE_COMPILE_SAFE_SURFACE;
export type ChatIntelligenceChannels = typeof CHAT_INTELLIGENCE_CHANNELS;
export type ChatIntelligenceAuthorities =
  typeof CHAT_INTELLIGENCE_AUTHORITIES;
export type ChatIntelligencePhaseExports =
  typeof CHAT_INTELLIGENCE_PHASE_EXPORTS;
export type ChatIntelligenceRuntimeModules =
  typeof CHAT_INTELLIGENCE_RUNTIME_MODULES;
export type ChatIntelligenceBridgeNamespace =
  typeof CHAT_INTELLIGENCE_BRIDGE_NAMESPACE;
export type ChatIntelligenceLearningProfileNamespace =
  typeof CHAT_INTELLIGENCE_LEARNING_PROFILE_NAMESPACE;
export type ChatIntelligenceColdStartNamespace =
  typeof CHAT_INTELLIGENCE_COLD_START_NAMESPACE;

export type {
  ChatLearningBridgeObserver,
  ChatLearningBridgeEventObserver,
  ChatLearningBridgeClockPort,
  ChatLearningBridgePersistencePort,
  ChatLearningBridgeTelemetryPort,
  ChatLearningBridgeFeatureExtractorPort,
  ChatLearningBridgeQueueEmitterPort,
  ChatLearningBridgeInferencePort,
  ChatLearningBridgeOptions,
  ChatLearningBridgePublicSnapshot,
  ChatLearningBridgeQueueItem,
  ChatLearningBridgeHeuristicSignals,
  ChatLearningBridgeServerSyncReason,
  ChatLearningBridgeRecommendation,
  ChatLearningBridgePreparedEnvelope,
  ChatLearningBridgePreparedBatch,
  ChatLearningBridgeProfileState,
  ChatLearningBridgeFeatureExtractionInput,
  FrontendLearningTelemetryEventName,
} from './ChatLearningBridge';

export type ChatIntelligenceKnownContracts = Readonly<{
  learningProfile: ChatLearningProfileContract | null;
  featureSnapshot: ChatFeatureSnapshot | null;
  telemetryEnvelope: ChatTelemetryEnvelope | null;
  activeVisibleChannels: readonly ChatVisibleChannel[];
}>;

export const CHAT_INTELLIGENCE_KNOWN_CONTRACTS: ChatIntelligenceKnownContracts =
  Object.freeze({
    learningProfile: null,
    featureSnapshot: null,
    telemetryEnvelope: null,
    activeVisibleChannels: CHAT_VISIBLE_CHANNELS,
  });
