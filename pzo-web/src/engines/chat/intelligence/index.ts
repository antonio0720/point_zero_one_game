// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/intelligence/index.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT INTELLIGENCE PUBLIC BARREL
 * FILE: pzo-web/src/engines/chat/intelligence/index.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Stable, compile-safe import surface for the frontend chat intelligence lane.
 *
 * This barrel follows the same doctrine as the root chat barrel:
 * - export what is real now,
 * - do not pretend future ML/DL modules already exist,
 * - keep the lane import-stable,
 * - make the bridge usable immediately by ChatEngine, UI shells, and future
 *   telemetry/feature modules without forcing a deeper migration all at once.
 *
 * Permanent doctrine
 * ------------------
 * - Frontend intelligence owns immediacy, local personalization, cold-start
 *   adaptation, optimistic pacing, and emission preparation.
 * - Backend intelligence owns transcript truth, durable learning profile,
 *   training labels, authoritative ranking, and drift monitoring.
 * - This barrel should remain safe to import even while sub-lanes land in
 *   phases.
 *
 * Root-barrel law
 * ---------------
 * This file does NOT require the root /pzo-web/src/engines/chat/index.ts barrel
 * to change immediately. The intelligence lane can be imported directly from:
 *   /pzo-web/src/engines/chat/intelligence
 *
 * Once you want root-level re-exports, wire the root barrel deliberately.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import {
  CHAT_ENGINE_AUTHORITIES,
  CHAT_ENGINE_PUBLIC_API_VERSION,
  CHAT_ENGINE_VERSION,
  CHAT_VISIBLE_CHANNELS,
  CHAT_SHADOW_CHANNELS,
  type ChatChannelId,
  type ChatVisibleChannel,
  type ChatLearningProfile,
  type ChatFeatureSnapshot,
  type ChatTelemetryEnvelope,
} from '../types';

import {
  CHAT_LEARNING_BRIDGE_MODULE_NAME,
  CHAT_LEARNING_BRIDGE_VERSION,
  CHAT_LEARNING_BRIDGE_RUNTIME_LAWS,
  CHAT_LEARNING_BRIDGE_DEFAULTS,
  CHAT_LEARNING_BRIDGE_EVENT_NAMES,
  CHAT_LEARNING_BRIDGE_CHANNEL_KEYS,
  ChatLearningBridge,
  createChatLearningBridge,
  isFrontendLearningTelemetryEventName,
  type ChatLearningBridgeObserver,
  type ChatLearningBridgeEventObserver,
  type ChatLearningBridgeClockPort,
  type ChatLearningBridgePersistencePort,
  type ChatLearningBridgeTelemetryPort,
  type ChatLearningBridgeFeatureExtractorPort,
  type ChatLearningBridgeQueueEmitterPort,
  type ChatLearningBridgeInferencePort,
  type ChatLearningBridgeOptions,
  type ChatLearningBridgePublicSnapshot,
  type ChatLearningBridgeQueueItem,
  type ChatLearningBridgeHeuristicSignals,
  type ChatLearningBridgeServerSyncReason,
  type ChatLearningBridgeRecommendation,
  type ChatLearningBridgePreparedEnvelope,
  type ChatLearningBridgePreparedBatch,
} from './ChatLearningBridge';

export * from './ChatLearningBridge';

export const CHAT_INTELLIGENCE_MODULE_NAME =
  'PZO_FRONTEND_CHAT_INTELLIGENCE' as const;

export const CHAT_INTELLIGENCE_PUBLIC_MANIFEST = Object.freeze({
  moduleName: CHAT_INTELLIGENCE_MODULE_NAME,
  bridgeModuleName: CHAT_LEARNING_BRIDGE_MODULE_NAME,
  version: CHAT_LEARNING_BRIDGE_VERSION,
  engineVersion: CHAT_ENGINE_VERSION,
  publicApiVersion: CHAT_ENGINE_PUBLIC_API_VERSION,
  authorities: Object.freeze({
    frontendEngine: CHAT_ENGINE_AUTHORITIES.frontendEngineRoot,
    frontendLearning: CHAT_ENGINE_AUTHORITIES.frontendLearningRoot,
    backendLearning: CHAT_ENGINE_AUTHORITIES.backendLearningRoot,
    sharedContracts: CHAT_ENGINE_AUTHORITIES.sharedContractsRoot,
    sharedLearning: CHAT_ENGINE_AUTHORITIES.sharedLearningRoot,
  }),
  channels: Object.freeze({
    visible: CHAT_VISIBLE_CHANNELS,
    shadow: CHAT_SHADOW_CHANNELS,
    all: [...CHAT_VISIBLE_CHANNELS, ...CHAT_SHADOW_CHANNELS] as readonly ChatChannelId[],
  }),
  bridgeDefaults: CHAT_LEARNING_BRIDGE_DEFAULTS,
  bridgeEventNames: CHAT_LEARNING_BRIDGE_EVENT_NAMES,
  bridgeRuntimeLaws: CHAT_LEARNING_BRIDGE_RUNTIME_LAWS,
} as const);

export const CHAT_INTELLIGENCE_PHASE_EXPORTS = Object.freeze({
  providedNow: Object.freeze([
    'index.ts',
    'ChatLearningBridge.ts',
  ] as const),
  expectedNext: Object.freeze([
    'ChatLearningProfile.ts',
    'ChatColdStartProfile.ts',
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
  ] as const),
} as const);

export const CHAT_INTELLIGENCE_FRONTEND_LAWS = Object.freeze([
  'Frontend learning is advisory, not authoritative.',
  'Telemetry emission must survive transport absence.',
  'Cold-start defaults are valid first-class runtime state.',
  'Queue-first emission is mandatory for burst resilience.',
  'Local personalization cannot overwrite server truth.',
  'Bridge logic must remain import-safe before ML/DL modules land.',
  'Learning should react to channels, pressure, audience heat, and rescue context.',
  'The bridge can score; it cannot invent transcript truth.',
] as const);

export const CHAT_INTELLIGENCE_NAMESPACE = Object.freeze({
  manifest: CHAT_INTELLIGENCE_PUBLIC_MANIFEST,
  phaseExports: CHAT_INTELLIGENCE_PHASE_EXPORTS,
  frontendLaws: CHAT_INTELLIGENCE_FRONTEND_LAWS,
  channelKeys: CHAT_LEARNING_BRIDGE_CHANNEL_KEYS,
} as const);

export const ChatIntelligence = Object.freeze({
  ChatLearningBridge,
  createChatLearningBridge,
  isFrontendLearningTelemetryEventName,
  manifest: CHAT_INTELLIGENCE_PUBLIC_MANIFEST,
  namespace: CHAT_INTELLIGENCE_NAMESPACE,
} as const);

export const CHAT_INTELLIGENCE_COMPILE_SAFE_SURFACE = Object.freeze({
  canInstantiateBridge: true,
  canPrepareTelemetry: true,
  canHydrateProfile: true,
  canQueueOfflineEmission: true,
  canAcceptServerRevisions: true,
  canEmitFeatureSnapshots: true,
  awaitsFutureMlModules: true,
  awaitsFutureDlModules: true,
} as const);

export const CHAT_INTELLIGENCE_README = Object.freeze({
  importPaths: Object.freeze({
    intelligenceBarrel: '/pzo-web/src/engines/chat/intelligence',
    bridge: '/pzo-web/src/engines/chat/intelligence/ChatLearningBridge',
  }),
  recommendedConsumers: Object.freeze([
    'pzo-web/src/engines/chat/ChatEngine.ts',
    'pzo-web/src/engines/chat/telemetry/ChatTelemetryEmitter.ts',
    'future ml/* modules',
    'future dl/* modules',
  ] as const),
  compileSafeNow: Object.freeze([
    'bridge instantiation',
    'queue-based telemetry preparation',
    'local cold-start profile hydration',
    'feature snapshot derivation',
    'server profile merge',
    'channel recommendation hints',
  ] as const),
} as const);

export type ChatIntelligenceManifest = typeof CHAT_INTELLIGENCE_PUBLIC_MANIFEST;
export type ChatIntelligenceNamespace = typeof CHAT_INTELLIGENCE_NAMESPACE;
export type ChatIntelligencePhaseExports = typeof CHAT_INTELLIGENCE_PHASE_EXPORTS;
export type ChatIntelligenceReadme = typeof CHAT_INTELLIGENCE_README;

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
};

export type ChatIntelligenceKnownContracts = Readonly<{
  learningProfile: ChatLearningProfile | null;
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