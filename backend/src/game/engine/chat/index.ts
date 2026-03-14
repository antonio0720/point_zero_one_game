
/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT ROOT BARREL + LANE MANIFEST
 * FILE: backend/src/game/engine/chat/index.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Public backend entry surface for the authoritative chat lane.
 *
 * Why this file is not a thin export list
 * --------------------------------------
 * The backend chat lane is being built as a sovereign simulation lane beside
 * battle, time, pressure, shield, tension, sovereignty, and zero. That means
 * the root index cannot merely export symbols. It also needs to encode:
 *
 * 1. the canonical backend chat tree you locked,
 * 2. the generated-vs-pending readiness of that tree,
 * 3. the explicit backend/public module boundaries,
 * 4. the authority bundle for the files already landed,
 * 5. the barrel exports that downstream backend lanes and the pzo-server chat
 *    transport layer can consume without importing donor zones directly.
 *
 * Design doctrine
 * ---------------
 * - No UI ownership.
 * - No socket ownership.
 * - No frontend-only types.
 * - No hidden donor-zone dependency registry.
 * - This file represents the backend chat lane exactly as the canonical tree
 *   says it should exist, while staying honest about what is generated now and
 *   what remains pending.
 * ============================================================================
 */

// ============================================================================
// MARK: Namespace imports for authority bundle construction
// ============================================================================

import * as Types from './types';
import * as Runtime from './ChatRuntimeConfig';
import * as State from './ChatState';
import * as Reducer from './ChatReducer';
import * as MessageFactory from './ChatMessageFactory';
import * as TranscriptLedger from './ChatTranscriptLedger';
import * as ProofChain from './ChatProofChain';
import * as RatePolicy from './ChatRatePolicy';
import * as ModerationPolicy from './ChatModerationPolicy';
import * as ChannelPolicy from './ChatChannelPolicy';
import * as CommandParser from './ChatCommandParser';
import * as EventBridge from './ChatEventBridge';
import * as PresenceState from './ChatPresenceState';
import * as SessionState from './ChatSessionState';
import * as Invasion from './ChatInvasionOrchestrator';
import * as Hater from './HaterResponseOrchestrator';
import * as Helper from './HelperResponseOrchestrator';
import * as Npc from './ChatNpcOrchestrator';
import * as Engine from './ChatEngine';

export { Types as ChatTypesModule, Runtime as ChatRuntimeModule, State as ChatStateModule, Reducer as ChatReducerModule, MessageFactory as ChatMessageFactoryModule, TranscriptLedger as ChatTranscriptLedgerModule, ProofChain as ChatProofChainModule, RatePolicy as ChatRatePolicyModule, ModerationPolicy as ChatModerationPolicyModule, ChannelPolicy as ChatChannelPolicyModule, CommandParser as ChatCommandParserModule, EventBridge as ChatEventBridgeModule, PresenceState as ChatPresenceStateModule, SessionState as ChatSessionStateModule, Invasion as ChatInvasionOrchestratorModule, Hater as HaterResponseOrchestratorModule, Helper as HelperResponseOrchestratorModule, Npc as ChatNpcOrchestratorModule, Engine as ChatEngineModule };

export const ChatEngineClass = Engine.ChatEngine;
export const HelperResponseAuthorityClass = Helper.HelperResponseAuthority;
export const HaterResponseAuthorityClass = Hater.HaterResponseAuthority;
export const ChatNpcAuthorityClass = Npc.ChatNpcAuthority;
export const ChatSessionAuthorityClass = SessionState.ChatSessionAuthority;
export const ChatPresenceAuthorityClass = PresenceState.ChatPresenceAuthority;
export const ChatCommandParserClass = CommandParser.ChatCommandParser;

import {
  BACKEND_CHAT_ENGINE_PUBLIC_API_VERSION,
  BACKEND_CHAT_ENGINE_VERSION,
  CHAT_AUTHORITY_ROOTS,
  type JsonValue,
} from './types';

// ============================================================================
// MARK: Canonical tree manifest contracts
// ============================================================================

export type BackendChatCanonicalModuleCategory =
  | 'ROOT'
  | 'ADAPTERS'
  | 'CHANNELS'
  | 'NPC'
  | 'REPLAY'
  | 'TELEMETRY'
  | 'INTELLIGENCE'
  | 'INTELLIGENCE_ML'
  | 'INTELLIGENCE_DL'
  | 'INTELLIGENCE_TRAINING';

export type BackendChatCanonicalModuleReadiness =
  | 'GENERATED'
  | 'PENDING'
  | 'PLANNED'
  | 'DEFERRED';

export interface BackendChatCanonicalModuleDescriptor {
  readonly id: string;
  readonly relativePath: string;
  readonly category: BackendChatCanonicalModuleCategory;
  readonly readiness: BackendChatCanonicalModuleReadiness;
  readonly ownsTruth: boolean;
  readonly description: string;
}

export interface BackendChatCanonicalModuleGroup {
  readonly category: BackendChatCanonicalModuleCategory;
  readonly modules: readonly BackendChatCanonicalModuleDescriptor[];
}

export interface BackendChatLaneReadinessReport {
  readonly generatedCount: number;
  readonly pendingCount: number;
  readonly plannedCount: number;
  readonly deferredCount: number;
  readonly byCategory: readonly BackendChatCanonicalModuleGroup[];
  readonly generatedPaths: readonly string[];
  readonly pendingPaths: readonly string[];
}

export interface BackendChatAuthorityBundle {
  readonly version: string;
  readonly publicApiVersion: string;
  readonly authorityRoots: typeof CHAT_AUTHORITY_ROOTS;
  readonly modules: {
    readonly types: typeof Types;
    readonly runtime: typeof Runtime;
    readonly state: typeof State;
    readonly reducer: typeof Reducer;
    readonly messageFactory: typeof MessageFactory;
    readonly transcriptLedger: typeof TranscriptLedger;
    readonly proofChain: typeof ProofChain;
    readonly ratePolicy: typeof RatePolicy;
    readonly moderationPolicy: typeof ModerationPolicy;
    readonly channelPolicy: typeof ChannelPolicy;
    readonly commandParser: typeof CommandParser;
    readonly eventBridge: typeof EventBridge;
    readonly presenceState: typeof PresenceState;
    readonly sessionState: typeof SessionState;
    readonly invasion: typeof Invasion;
    readonly hater: typeof Hater;
    readonly helper: typeof Helper;
    readonly npc: typeof Npc;
    readonly engine: typeof Engine;
  };
  readonly readiness: BackendChatLaneReadinessReport;
}

// ============================================================================
// MARK: Canonical backend chat tree
// ============================================================================

export const BACKEND_CHAT_CANONICAL_MODULES = Object.freeze([
  // Root
  descriptor('types', 'types.ts', 'ROOT', 'GENERATED', true, 'Backend-only type surface and authority contracts.'),
  descriptor('index', 'index.ts', 'ROOT', 'GENERATED', false, 'Backend public barrel and lane manifest.'),
  descriptor('ChatEngine', 'ChatEngine.ts', 'ROOT', 'GENERATED', true, 'Top-level authoritative backend chat engine façade.'),
  descriptor('ChatState', 'ChatState.ts', 'ROOT', 'GENERATED', true, 'Authoritative state shape and lawful state helpers.'),
  descriptor('ChatReducer', 'ChatReducer.ts', 'ROOT', 'GENERATED', true, 'Deterministic backend mutation layer.'),
  descriptor('ChatMessageFactory', 'ChatMessageFactory.ts', 'ROOT', 'GENERATED', true, 'Canonical message construction and revision authority.'),
  descriptor('ChatTranscriptLedger', 'ChatTranscriptLedger.ts', 'ROOT', 'GENERATED', true, 'Transcript append/index/redact/delete authority.'),
  descriptor('ChatProofChain', 'ChatProofChain.ts', 'ROOT', 'GENERATED', true, 'Proof-edge creation and verification authority.'),
  descriptor('ChatRatePolicy', 'ChatRatePolicy.ts', 'ROOT', 'GENERATED', true, 'Rate law before mutation.'),
  descriptor('ChatModerationPolicy', 'ChatModerationPolicy.ts', 'ROOT', 'GENERATED', true, 'Moderation law before mutation.'),
  descriptor('ChatChannelPolicy', 'ChatChannelPolicy.ts', 'ROOT', 'GENERATED', true, 'Visible/shadow channel permission authority.'),
  descriptor('ChatCommandParser', 'ChatCommandParser.ts', 'ROOT', 'GENERATED', true, 'Backend command parsing and execution planning.'),
  descriptor('ChatRuntimeConfig', 'ChatRuntimeConfig.ts', 'ROOT', 'GENERATED', true, 'Authoritative runtime config normalization.'),
  descriptor('ChatEventBridge', 'ChatEventBridge.ts', 'ROOT', 'GENERATED', true, 'Canonical normalization boundary from upstream domains.'),
  descriptor('ChatPresenceState', 'ChatPresenceState.ts', 'ROOT', 'GENERATED', true, 'Presence truth and reconciliation authority.'),
  descriptor('ChatSessionState', 'ChatSessionState.ts', 'ROOT', 'GENERATED', true, 'Session admission and room membership authority.'),
  descriptor('ChatInvasionOrchestrator', 'ChatInvasionOrchestrator.ts', 'ROOT', 'GENERATED', true, 'Invasion planning and maintenance authority.'),
  descriptor('ChatNpcOrchestrator', 'ChatNpcOrchestrator.ts', 'ROOT', 'GENERATED', true, 'Top-level NPC scheduling authority across helper/hater/ambient.'),
  descriptor('HaterResponseOrchestrator', 'HaterResponseOrchestrator.ts', 'ROOT', 'GENERATED', true, 'Chat-native hostile response authority.'),
  descriptor('HelperResponseOrchestrator', 'HelperResponseOrchestrator.ts', 'ROOT', 'GENERATED', true, 'Chat-native helper intervention authority.'),

  // Adapters
  descriptor('adapters.index', 'adapters/index.ts', 'ADAPTERS', 'PENDING', false, 'Backend adapter barrel.'),
  descriptor('BattleSignalAdapter', 'adapters/BattleSignalAdapter.ts', 'ADAPTERS', 'PENDING', false, 'Battle-to-chat authoritative signal translation.'),
  descriptor('RunSignalAdapter', 'adapters/RunSignalAdapter.ts', 'ADAPTERS', 'PENDING', false, 'Run-to-chat authoritative signal translation.'),
  descriptor('MultiplayerSignalAdapter', 'adapters/MultiplayerSignalAdapter.ts', 'ADAPTERS', 'PENDING', false, 'Multiplayer-to-chat room/member translation.'),
  descriptor('EconomySignalAdapter', 'adapters/EconomySignalAdapter.ts', 'ADAPTERS', 'PENDING', false, 'Economy/deal-room signal translation.'),

  // Channels
  descriptor('channels.index', 'channels/index.ts', 'CHANNELS', 'PENDING', false, 'Channel policy barrel.'),
  descriptor('GlobalChannelPolicy', 'channels/GlobalChannelPolicy.ts', 'CHANNELS', 'PENDING', true, 'Global theatrical channel law.'),
  descriptor('SyndicateChannelPolicy', 'channels/SyndicateChannelPolicy.ts', 'CHANNELS', 'PENDING', true, 'Syndicate trust/reputation channel law.'),
  descriptor('DealRoomChannelPolicy', 'channels/DealRoomChannelPolicy.ts', 'CHANNELS', 'PENDING', true, 'Deal-room negotiation channel law.'),
  descriptor('LobbyChannelPolicy', 'channels/LobbyChannelPolicy.ts', 'CHANNELS', 'PENDING', true, 'Lobby pre-run channel law.'),

  // NPC registries
  descriptor('npc.index', 'npc/index.ts', 'NPC', 'PENDING', false, 'NPC registry barrel.'),
  descriptor('HaterDialogueRegistry', 'npc/HaterDialogueRegistry.ts', 'NPC', 'PENDING', true, 'Canonical backend hater authored line registry.'),
  descriptor('HelperDialogueRegistry', 'npc/HelperDialogueRegistry.ts', 'NPC', 'PENDING', true, 'Canonical backend helper authored line registry.'),
  descriptor('AmbientNpcRegistry', 'npc/AmbientNpcRegistry.ts', 'NPC', 'PENDING', true, 'Canonical backend ambient authored line registry.'),
  descriptor('NpcCadencePolicy', 'npc/NpcCadencePolicy.ts', 'NPC', 'PENDING', true, 'NPC timing law.'),
  descriptor('NpcSuppressionPolicy', 'npc/NpcSuppressionPolicy.ts', 'NPC', 'PENDING', true, 'NPC suppression law.'),

  // Replay
  descriptor('replay.index', 'replay/index.ts', 'REPLAY', 'PENDING', false, 'Replay barrel.'),
  descriptor('ChatReplayAssembler', 'replay/ChatReplayAssembler.ts', 'REPLAY', 'PENDING', true, 'Replay assembly from authoritative chat state and events.'),
  descriptor('ChatReplayIndex', 'replay/ChatReplayIndex.ts', 'REPLAY', 'PENDING', true, 'Replay lookup and transcript correlation.'),

  // Telemetry
  descriptor('telemetry.index', 'telemetry/index.ts', 'TELEMETRY', 'PENDING', false, 'Telemetry barrel.'),
  descriptor('ChatTelemetrySink', 'telemetry/ChatTelemetrySink.ts', 'TELEMETRY', 'PENDING', true, 'Authoritative telemetry sink.'),
  descriptor('ChatEventStreamWriter', 'telemetry/ChatEventStreamWriter.ts', 'TELEMETRY', 'PENDING', true, 'Event-stream writer for analytics/ML/replay.'),

  // Intelligence root
  descriptor('intelligence.index', 'intelligence/index.ts', 'INTELLIGENCE', 'PENDING', false, 'Intelligence barrel.'),
  descriptor('LearningProfileStore', 'intelligence/LearningProfileStore.ts', 'INTELLIGENCE', 'PENDING', true, 'Persistent learning profile truth.'),
  descriptor('ColdStartPopulationModel', 'intelligence/ColdStartPopulationModel.ts', 'INTELLIGENCE', 'PENDING', true, 'Cold-start prior seeding.'),
  descriptor('ChatLearningCoordinator', 'intelligence/ChatLearningCoordinator.ts', 'INTELLIGENCE', 'PENDING', true, 'Coordinator between live events and learning updates.'),

  // Intelligence ML
  descriptor('intelligence.ml.index', 'intelligence/ml/index.ts', 'INTELLIGENCE_ML', 'PENDING', false, 'ML barrel.'),
  descriptor('FeatureIngestor', 'intelligence/ml/FeatureIngestor.ts', 'INTELLIGENCE_ML', 'PENDING', false, 'Online feature ingestion from authoritative events.'),
  descriptor('OnlineFeatureStore', 'intelligence/ml/OnlineFeatureStore.ts', 'INTELLIGENCE_ML', 'PENDING', true, 'Online feature state for inference.'),
  descriptor('EngagementModel', 'intelligence/ml/EngagementModel.ts', 'INTELLIGENCE_ML', 'PENDING', false, 'Engagement scoring.'),
  descriptor('HaterTargetingModel', 'intelligence/ml/HaterTargetingModel.ts', 'INTELLIGENCE_ML', 'PENDING', false, 'Hater targeting recommendation model.'),
  descriptor('HelperTimingModel', 'intelligence/ml/HelperTimingModel.ts', 'INTELLIGENCE_ML', 'PENDING', false, 'Helper timing recommendation model.'),
  descriptor('ChannelAffinityModel', 'intelligence/ml/ChannelAffinityModel.ts', 'INTELLIGENCE_ML', 'PENDING', false, 'Channel affinity recommendation model.'),
  descriptor('ToxicityRiskModel', 'intelligence/ml/ToxicityRiskModel.ts', 'INTELLIGENCE_ML', 'PENDING', false, 'Toxicity risk recommendation model.'),
  descriptor('ChurnRiskModel', 'intelligence/ml/ChurnRiskModel.ts', 'INTELLIGENCE_ML', 'PENDING', false, 'Churn risk model.'),
  descriptor('InterventionPolicyModel', 'intelligence/ml/InterventionPolicyModel.ts', 'INTELLIGENCE_ML', 'PENDING', false, 'Model that fuses recommendation outputs.'),

  // Intelligence DL
  descriptor('intelligence.dl.index', 'intelligence/dl/index.ts', 'INTELLIGENCE_DL', 'PENDING', false, 'DL barrel.'),
  descriptor('DialogueEmbeddingService', 'intelligence/dl/DialogueEmbeddingService.ts', 'INTELLIGENCE_DL', 'PENDING', false, 'Embedding service over chat turns/scenes.'),
  descriptor('IntentSequenceModel', 'intelligence/dl/IntentSequenceModel.ts', 'INTELLIGENCE_DL', 'PENDING', false, 'Sequence-level intent inference.'),
  descriptor('ResponseRankingModel', 'intelligence/dl/ResponseRankingModel.ts', 'INTELLIGENCE_DL', 'PENDING', false, 'Final response ranking.'),
  descriptor('ConversationMemoryModel', 'intelligence/dl/ConversationMemoryModel.ts', 'INTELLIGENCE_DL', 'PENDING', false, 'Long-window conversation memory.'),
  descriptor('RetrievalContextBuilder', 'intelligence/dl/RetrievalContextBuilder.ts', 'INTELLIGENCE_DL', 'PENDING', false, 'Historical retrieval context builder.'),

  // Intelligence training
  descriptor('intelligence.training.index', 'intelligence/training/index.ts', 'INTELLIGENCE_TRAINING', 'PENDING', false, 'Training barrel.'),
  descriptor('DatasetBuilder', 'intelligence/training/DatasetBuilder.ts', 'INTELLIGENCE_TRAINING', 'PENDING', false, 'Offline dataset assembly.'),
  descriptor('LabelAssembler', 'intelligence/training/LabelAssembler.ts', 'INTELLIGENCE_TRAINING', 'PENDING', false, 'Offline label assembly.'),
  descriptor('PolicyTrainer', 'intelligence/training/PolicyTrainer.ts', 'INTELLIGENCE_TRAINING', 'PENDING', false, 'Offline trainer/export surface.'),
  descriptor('DriftMonitor', 'intelligence/training/DriftMonitor.ts', 'INTELLIGENCE_TRAINING', 'PENDING', false, 'Behavior/model drift detection.'),
  descriptor('EvaluationHarness', 'intelligence/training/EvaluationHarness.ts', 'INTELLIGENCE_TRAINING', 'PENDING', false, 'Offline evaluation harness.'),
] as const satisfies readonly BackendChatCanonicalModuleDescriptor[]);

// ============================================================================
// MARK: Bundle construction
// ============================================================================

export function createBackendChatAuthorityBundle(): BackendChatAuthorityBundle {
  return Object.freeze({
    version: BACKEND_CHAT_ENGINE_VERSION,
    publicApiVersion: BACKEND_CHAT_ENGINE_PUBLIC_API_VERSION,
    authorityRoots: CHAT_AUTHORITY_ROOTS,
    modules: Object.freeze({
      types: Types,
      runtime: Runtime,
      state: State,
      reducer: Reducer,
      messageFactory: MessageFactory,
      transcriptLedger: TranscriptLedger,
      proofChain: ProofChain,
      ratePolicy: RatePolicy,
      moderationPolicy: ModerationPolicy,
      channelPolicy: ChannelPolicy,
      commandParser: CommandParser,
      eventBridge: EventBridge,
      presenceState: PresenceState,
      sessionState: SessionState,
      invasion: Invasion,
      hater: Hater,
      helper: Helper,
      npc: Npc,
      engine: Engine,
    }),
    readiness: buildBackendChatLaneReadinessReport(),
  });
}

export const BACKEND_CHAT_AUTHORITY_BUNDLE = createBackendChatAuthorityBundle();

// ============================================================================
// MARK: Readiness and manifest queries
// ============================================================================

export function buildBackendChatLaneReadinessReport(): BackendChatLaneReadinessReport {
  const generated = BACKEND_CHAT_CANONICAL_MODULES.filter((value) => value.readiness === 'GENERATED');
  const pending = BACKEND_CHAT_CANONICAL_MODULES.filter((value) => value.readiness === 'PENDING');
  const planned = BACKEND_CHAT_CANONICAL_MODULES.filter((value) => value.readiness === 'PLANNED');
  const deferred = BACKEND_CHAT_CANONICAL_MODULES.filter((value) => value.readiness === 'DEFERRED');

  return Object.freeze({
    generatedCount: generated.length,
    pendingCount: pending.length,
    plannedCount: planned.length,
    deferredCount: deferred.length,
    byCategory: groupCanonicalModulesByCategory(BACKEND_CHAT_CANONICAL_MODULES),
    generatedPaths: Object.freeze(generated.map((value) => value.relativePath)),
    pendingPaths: Object.freeze(pending.map((value) => value.relativePath)),
  });
}

export function groupCanonicalModulesByCategory(
  modules: readonly BackendChatCanonicalModuleDescriptor[],
): readonly BackendChatCanonicalModuleGroup[] {
  const categories: BackendChatCanonicalModuleCategory[] = [
    'ROOT',
    'ADAPTERS',
    'CHANNELS',
    'NPC',
    'REPLAY',
    'TELEMETRY',
    'INTELLIGENCE',
    'INTELLIGENCE_ML',
    'INTELLIGENCE_DL',
    'INTELLIGENCE_TRAINING',
  ];

  return Object.freeze(
    categories.map((category) => ({
      category,
      modules: Object.freeze(modules.filter((value) => value.category === category)),
    })),
  );
}

export function listBackendChatCanonicalModules(): readonly BackendChatCanonicalModuleDescriptor[] {
  return BACKEND_CHAT_CANONICAL_MODULES;
}

export function listGeneratedBackendChatModules(): readonly BackendChatCanonicalModuleDescriptor[] {
  return Object.freeze(BACKEND_CHAT_CANONICAL_MODULES.filter((value) => value.readiness === 'GENERATED'));
}

export function listPendingBackendChatModules(): readonly BackendChatCanonicalModuleDescriptor[] {
  return Object.freeze(BACKEND_CHAT_CANONICAL_MODULES.filter((value) => value.readiness === 'PENDING'));
}

export function getBackendChatModuleDescriptor(
  id: string,
): BackendChatCanonicalModuleDescriptor | null {
  return BACKEND_CHAT_CANONICAL_MODULES.find((value) => value.id === id) ?? null;
}

export function backendChatModuleIsGenerated(id: string): boolean {
  return getBackendChatModuleDescriptor(id)?.readiness === 'GENERATED';
}

export function backendChatModuleOwnsTruth(id: string): boolean {
  return getBackendChatModuleDescriptor(id)?.ownsTruth ?? false;
}

export function summarizeBackendChatLaneReadiness(): string {
  const report = buildBackendChatLaneReadinessReport();
  return [
    `generated=${report.generatedCount}`,
    `pending=${report.pendingCount}`,
    `planned=${report.plannedCount}`,
    `deferred=${report.deferredCount}`,
  ].join(' | ');
}

export function summarizeBackendChatCategory(
  category: BackendChatCanonicalModuleCategory,
): string {
  const group = groupCanonicalModulesByCategory(BACKEND_CHAT_CANONICAL_MODULES)
    .find((value) => value.category === category);

  if (!group) {
    return `${category}: none`;
  }

  const generated = group.modules.filter((value) => value.readiness === 'GENERATED').length;
  const pending = group.modules.filter((value) => value.readiness === 'PENDING').length;
  return `${category}: generated=${generated} pending=${pending}`;
}

// ============================================================================
// MARK: Current generated authority surface
// ============================================================================

export const BACKEND_CHAT_GENERATED_ROOT_MODULE_IDS = Object.freeze([
  'types',
  'index',
  'ChatEngine',
  'ChatState',
  'ChatReducer',
  'ChatMessageFactory',
  'ChatTranscriptLedger',
  'ChatProofChain',
  'ChatRatePolicy',
  'ChatModerationPolicy',
  'ChatChannelPolicy',
  'ChatCommandParser',
  'ChatRuntimeConfig',
  'ChatEventBridge',
  'ChatPresenceState',
  'ChatSessionState',
  'ChatInvasionOrchestrator',
  'ChatNpcOrchestrator',
  'HaterResponseOrchestrator',
  'HelperResponseOrchestrator',
] as const);

export type BackendChatGeneratedRootModuleId = (typeof BACKEND_CHAT_GENERATED_ROOT_MODULE_IDS)[number];

export interface BackendChatGeneratedSurfaceDescriptor {
  readonly id: BackendChatGeneratedRootModuleId;
  readonly namespaceKey: keyof BackendChatAuthorityBundle['modules'];
  readonly exported: boolean;
  readonly description: string;
}

export const BACKEND_CHAT_GENERATED_SURFACE = Object.freeze([
  generatedSurface('types', 'types', 'Canonical backend type surface and helper predicates.'),
  generatedSurface('ChatRuntimeConfig', 'runtime', 'Runtime config normalization and authoritative defaults.'),
  generatedSurface('ChatState', 'state', 'Authoritative state creation, selectors, and lawful mutation helpers.'),
  generatedSurface('ChatReducer', 'reducer', 'Deterministic reducer operations.'),
  generatedSurface('ChatMessageFactory', 'messageFactory', 'Canonical message construction and revision authority.'),
  generatedSurface('ChatTranscriptLedger', 'transcriptLedger', 'Transcript append/index/redact/delete operations.'),
  generatedSurface('ChatProofChain', 'proofChain', 'Proof-edge creation and verification helpers.'),
  generatedSurface('ChatRatePolicy', 'ratePolicy', 'Rate-law helpers.'),
  generatedSurface('ChatModerationPolicy', 'moderationPolicy', 'Moderation-law helpers.'),
  generatedSurface('ChatChannelPolicy', 'channelPolicy', 'Channel-law helpers.'),
  generatedSurface('ChatCommandParser', 'commandParser', 'Command parsing authority.'),
  generatedSurface('ChatEventBridge', 'eventBridge', 'Upstream normalization authority.'),
  generatedSurface('ChatPresenceState', 'presenceState', 'Presence truth.'),
  generatedSurface('ChatSessionState', 'sessionState', 'Session truth.'),
  generatedSurface('ChatInvasionOrchestrator', 'invasion', 'Invasion planning authority.'),
  generatedSurface('HaterResponseOrchestrator', 'hater', 'Hater response planning authority.'),
  generatedSurface('HelperResponseOrchestrator', 'helper', 'Helper response planning authority.'),
  generatedSurface('ChatNpcOrchestrator', 'npc', 'Top-level NPC scheduling authority.'),
  generatedSurface('ChatEngine', 'engine', 'Top-level backend chat engine façade.'),
] as const satisfies readonly BackendChatGeneratedSurfaceDescriptor[]);

export function listGeneratedBackendChatSurface(): readonly BackendChatGeneratedSurfaceDescriptor[] {
  return BACKEND_CHAT_GENERATED_SURFACE;
}

export function getGeneratedBackendChatSurfaceDescriptor(
  id: BackendChatGeneratedRootModuleId,
): BackendChatGeneratedSurfaceDescriptor | null {
  return BACKEND_CHAT_GENERATED_SURFACE.find((value) => value.id === id) ?? null;
}

// ============================================================================
// MARK: Pending tree query helpers by category
// ============================================================================

export function listPendingAdapterModules(): readonly BackendChatCanonicalModuleDescriptor[] {
  return Object.freeze(BACKEND_CHAT_CANONICAL_MODULES.filter((value) => value.category === 'ADAPTERS' && value.readiness === 'PENDING'));
}

export function listPendingChannelModules(): readonly BackendChatCanonicalModuleDescriptor[] {
  return Object.freeze(BACKEND_CHAT_CANONICAL_MODULES.filter((value) => value.category === 'CHANNELS' && value.readiness === 'PENDING'));
}

export function listPendingNpcRegistryModules(): readonly BackendChatCanonicalModuleDescriptor[] {
  return Object.freeze(BACKEND_CHAT_CANONICAL_MODULES.filter((value) => value.category === 'NPC' && value.readiness === 'PENDING'));
}

export function listPendingReplayModules(): readonly BackendChatCanonicalModuleDescriptor[] {
  return Object.freeze(BACKEND_CHAT_CANONICAL_MODULES.filter((value) => value.category === 'REPLAY' && value.readiness === 'PENDING'));
}

export function listPendingTelemetryModules(): readonly BackendChatCanonicalModuleDescriptor[] {
  return Object.freeze(BACKEND_CHAT_CANONICAL_MODULES.filter((value) => value.category === 'TELEMETRY' && value.readiness === 'PENDING'));
}

export function listPendingIntelligenceModules(): readonly BackendChatCanonicalModuleDescriptor[] {
  return Object.freeze(BACKEND_CHAT_CANONICAL_MODULES.filter((value) => value.category === 'INTELLIGENCE' && value.readiness === 'PENDING'));
}

export function listPendingMlModules(): readonly BackendChatCanonicalModuleDescriptor[] {
  return Object.freeze(BACKEND_CHAT_CANONICAL_MODULES.filter((value) => value.category === 'INTELLIGENCE_ML' && value.readiness === 'PENDING'));
}

export function listPendingDlModules(): readonly BackendChatCanonicalModuleDescriptor[] {
  return Object.freeze(BACKEND_CHAT_CANONICAL_MODULES.filter((value) => value.category === 'INTELLIGENCE_DL' && value.readiness === 'PENDING'));
}

export function listPendingTrainingModules(): readonly BackendChatCanonicalModuleDescriptor[] {
  return Object.freeze(BACKEND_CHAT_CANONICAL_MODULES.filter((value) => value.category === 'INTELLIGENCE_TRAINING' && value.readiness === 'PENDING'));
}

// ============================================================================
// MARK: Barrels for downstream integration points
// ============================================================================

export interface BackendChatDownstreamIntegrationSurface {
  readonly forBackendLanes: readonly string[];
  readonly forServerTransport: readonly string[];
  readonly forbiddenImports: readonly string[];
}

export const BACKEND_CHAT_DOWNSTREAM_INTEGRATION_SURFACE: BackendChatDownstreamIntegrationSurface = Object.freeze({
  forBackendLanes: Object.freeze([
    './types',
    './ChatRuntimeConfig',
    './ChatState',
    './ChatReducer',
    './ChatEventBridge',
    './ChatRatePolicy',
    './ChatModerationPolicy',
    './ChatChannelPolicy',
    './ChatCommandParser',
    './ChatPresenceState',
    './ChatSessionState',
    './ChatInvasionOrchestrator',
    './ChatNpcOrchestrator',
    './HaterResponseOrchestrator',
    './HelperResponseOrchestrator',
    './ChatEngine',
  ]),
  forServerTransport: Object.freeze([
    './types',
    './ChatEventBridge',
    './ChatSessionState',
    './ChatPresenceState',
    './ChatEngine',
  ]),
  forbiddenImports: Object.freeze([
    '/pzo-web/src/components/chat',
    '/pzo-web/src/engines/chat',
    '/frontend/apps/web/components/chat',
    '/pzo_client/src/components/chat',
  ]),
});

export function listBackendLaneIntegrationExports(): readonly string[] {
  return BACKEND_CHAT_DOWNSTREAM_INTEGRATION_SURFACE.forBackendLanes;
}

export function listServerTransportIntegrationExports(): readonly string[] {
  return BACKEND_CHAT_DOWNSTREAM_INTEGRATION_SURFACE.forServerTransport;
}

export function listForbiddenBackendChatImports(): readonly string[] {
  return BACKEND_CHAT_DOWNSTREAM_INTEGRATION_SURFACE.forbiddenImports;
}

// ============================================================================
// MARK: Integrity, assertions, and diagnostic helpers
// ============================================================================

export function assertBackendChatManifestIntegrity(): readonly string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  const paths = new Set<string>();

  for (const module of BACKEND_CHAT_CANONICAL_MODULES) {
    if (ids.has(module.id)) {
      issues.push(`duplicate module id: ${module.id}`);
    }
    if (paths.has(module.relativePath)) {
      issues.push(`duplicate module path: ${module.relativePath}`);
    }
    ids.add(module.id);
    paths.add(module.relativePath);
  }

  if (!backendChatModuleIsGenerated('types')) {
    issues.push('types.ts must always be generated for the backend chat lane to compile.');
  }
  if (!backendChatModuleIsGenerated('ChatState')) {
    issues.push('ChatState.ts must be generated before authoritative orchestration is considered valid.');
  }
  if (!backendChatModuleIsGenerated('ChatEngine')) {
    issues.push('ChatEngine.ts must be generated before the lane can expose a top-level façade.');
  }

  return Object.freeze(issues);
}

export function backendChatManifestIsHealthy(): boolean {
  return assertBackendChatManifestIntegrity().length === 0;
}

export function buildBackendChatManifestDigest(): Readonly<Record<string, JsonValue>> {
  const readiness = buildBackendChatLaneReadinessReport();
  return Object.freeze({
    version: BACKEND_CHAT_ENGINE_VERSION,
    publicApiVersion: BACKEND_CHAT_ENGINE_PUBLIC_API_VERSION,
    generatedCount: readiness.generatedCount,
    pendingCount: readiness.pendingCount,
    categories: groupCanonicalModulesByCategory(BACKEND_CHAT_CANONICAL_MODULES).map((group) => ({
      category: group.category,
      count: group.modules.length,
      generatedCount: group.modules.filter((value) => value.readiness === 'GENERATED').length,
      pendingCount: group.modules.filter((value) => value.readiness === 'PENDING').length,
    })),
  });
}

export function explainWhyBackendChatIndexExists(): readonly string[] {
  return Object.freeze([
    'Exports the currently generated backend chat authority surface.',
    'Encodes the canonical backend chat simulation tree you locked.',
    'Makes generated-vs-pending readiness explicit instead of implicit.',
    'Provides a downstream-safe bundle for backend lanes and pzo-server chat transport.',
    'Prevents donor-zone imports from becoming hidden architecture.',
  ]);
}

// ============================================================================
// MARK: Internal helpers
// ============================================================================

function descriptor(
  id: string,
  relativePath: string,
  category: BackendChatCanonicalModuleCategory,
  readiness: BackendChatCanonicalModuleReadiness,
  ownsTruth: boolean,
  description: string,
): BackendChatCanonicalModuleDescriptor {
  return Object.freeze({
    id,
    relativePath,
    category,
    readiness,
    ownsTruth,
    description,
  });
}

function generatedSurface(
  id: BackendChatGeneratedRootModuleId,
  namespaceKey: keyof BackendChatAuthorityBundle['modules'],
  description: string,
): BackendChatGeneratedSurfaceDescriptor {
  return Object.freeze({
    id,
    namespaceKey,
    exported: true,
    description,
  });
}

// ============================================================================
// MARK: Movement manifest — authoritative backend execution order
// ============================================================================

export type BackendChatMovementId =
  | 'MOVEMENT_0_BOOT_AND_DOCTRINE'
  | 'MOVEMENT_1_SESSION_ADMISSION_AND_PRESENCE'
  | 'MOVEMENT_2_EVENT_INGESTION_AND_TRANSLATION'
  | 'MOVEMENT_3_INPUT_GATING_AND_ENFORCEMENT'
  | 'MOVEMENT_4_AUTHORITATIVE_STATE_MUTATION'
  | 'MOVEMENT_5_MESSAGE_CREATION_AND_TRANSCRIPT_TRUTH'
  | 'MOVEMENT_6_NPC_HELPER_HATER_INVASION_ORCHESTRATION'
  | 'MOVEMENT_7_REPLAY_AND_AFTER_ACTION_TRUTH'
  | 'MOVEMENT_8_TELEMETRY_AND_EVENT_STREAMING'
  | 'MOVEMENT_9_LEARNING_COORDINATION'
  | 'MOVEMENT_10_ML_ONLINE_INFERENCE'
  | 'MOVEMENT_11_DL_SEQUENCE_RANKING_AND_MEMORY'
  | 'MOVEMENT_12_OFFLINE_TRAINING_AND_EVALUATION';

export interface BackendChatMovementDescriptor {
  readonly id: BackendChatMovementId;
  readonly label: string;
  readonly description: string;
  readonly primaryModuleIds: readonly string[];
  readonly secondaryModuleIds: readonly string[];
}

export const BACKEND_CHAT_MOVEMENTS = Object.freeze([
  movement(
    'MOVEMENT_0_BOOT_AND_DOCTRINE',
    'Boot and doctrine',
    'Defines runtime law, authority roots, and backend-only type surface.',
    ['ChatRuntimeConfig', 'types', 'index'],
    ['ChatEngine'],
  ),
  movement(
    'MOVEMENT_1_SESSION_ADMISSION_AND_PRESENCE',
    'Session admission and presence truth',
    'Owns authenticated session truth, room attachment truth, and live presence projections.',
    ['ChatSessionState', 'ChatPresenceState'],
    ['ChatState', 'ChatEngine'],
  ),
  movement(
    'MOVEMENT_2_EVENT_INGESTION_AND_TRANSLATION',
    'Event ingestion and translation',
    'Normalizes transport, battle, run, multiplayer, economy, and liveops facts into backend chat-native input.',
    ['ChatEventBridge'],
    ['adapters.index', 'BattleSignalAdapter', 'RunSignalAdapter', 'MultiplayerSignalAdapter', 'EconomySignalAdapter'],
  ),
  movement(
    'MOVEMENT_3_INPUT_GATING_AND_ENFORCEMENT',
    'Input gating and enforcement',
    'Applies rate, moderation, channel, and command law before transcript truth changes.',
    ['ChatRatePolicy', 'ChatModerationPolicy', 'ChatChannelPolicy', 'ChatCommandParser'],
    ['GlobalChannelPolicy', 'SyndicateChannelPolicy', 'DealRoomChannelPolicy', 'LobbyChannelPolicy'],
  ),
  movement(
    'MOVEMENT_4_AUTHORITATIVE_STATE_MUTATION',
    'Authoritative state mutation',
    'Mutates authoritative backend chat state via deterministic reducer and engine orchestration.',
    ['ChatState', 'ChatReducer', 'ChatEngine'],
    ['ChatSessionState', 'ChatPresenceState'],
  ),
  movement(
    'MOVEMENT_5_MESSAGE_CREATION_AND_TRANSCRIPT_TRUTH',
    'Message creation and transcript truth',
    'Constructs canonical messages, transcript entries, and proof edges.',
    ['ChatMessageFactory', 'ChatTranscriptLedger', 'ChatProofChain'],
    ['ChatState'],
  ),
  movement(
    'MOVEMENT_6_NPC_HELPER_HATER_INVASION_ORCHESTRATION',
    'NPC, helper, hater, and invasion orchestration',
    'Plans backend-authored helper, hater, ambient, and invasion scenes.',
    ['ChatInvasionOrchestrator', 'HaterResponseOrchestrator', 'HelperResponseOrchestrator', 'ChatNpcOrchestrator'],
    ['HaterDialogueRegistry', 'HelperDialogueRegistry', 'AmbientNpcRegistry', 'NpcCadencePolicy', 'NpcSuppressionPolicy'],
  ),
  movement(
    'MOVEMENT_7_REPLAY_AND_AFTER_ACTION_TRUTH',
    'Replay and after-action truth',
    'Assembles and indexes replay-ready chat artifacts.',
    ['ChatReplayAssembler', 'ChatReplayIndex'],
    ['ChatTranscriptLedger', 'ChatProofChain'],
  ),
  movement(
    'MOVEMENT_8_TELEMETRY_AND_EVENT_STREAMING',
    'Telemetry and event streaming',
    'Writes authoritative backend telemetry and event-stream records.',
    ['ChatTelemetrySink', 'ChatEventStreamWriter'],
    ['ChatEngine'],
  ),
  movement(
    'MOVEMENT_9_LEARNING_COORDINATION',
    'Learning coordination',
    'Turns transcript truth into durable profile and feature updates.',
    ['LearningProfileStore', 'ColdStartPopulationModel', 'ChatLearningCoordinator'],
    ['FeatureIngestor', 'OnlineFeatureStore'],
  ),
  movement(
    'MOVEMENT_10_ML_ONLINE_INFERENCE',
    'ML online inference',
    'Scores live engagement, helper timing, hater targeting, channel affinity, toxicity, and churn.',
    ['FeatureIngestor', 'OnlineFeatureStore', 'EngagementModel', 'HaterTargetingModel', 'HelperTimingModel', 'ChannelAffinityModel', 'ToxicityRiskModel', 'ChurnRiskModel', 'InterventionPolicyModel'],
    ['ChatLearningCoordinator'],
  ),
  movement(
    'MOVEMENT_11_DL_SEQUENCE_RANKING_AND_MEMORY',
    'DL sequence, ranking, and memory',
    'Embeds, retrieves, ranks, and remembers sequence-level conversation context.',
    ['DialogueEmbeddingService', 'IntentSequenceModel', 'ResponseRankingModel', 'ConversationMemoryModel', 'RetrievalContextBuilder'],
    ['ChatLearningCoordinator'],
  ),
  movement(
    'MOVEMENT_12_OFFLINE_TRAINING_AND_EVALUATION',
    'Offline training and evaluation',
    'Builds datasets, labels, drift checks, training runs, and evaluation harnesses.',
    ['DatasetBuilder', 'LabelAssembler', 'PolicyTrainer', 'DriftMonitor', 'EvaluationHarness'],
    ['ChatEventStreamWriter', 'ChatReplayIndex'],
  ),
] as const satisfies readonly BackendChatMovementDescriptor[]);

export function listBackendChatMovements(): readonly BackendChatMovementDescriptor[] {
  return BACKEND_CHAT_MOVEMENTS;
}

export function getBackendChatMovement(
  id: BackendChatMovementId,
): BackendChatMovementDescriptor | null {
  return BACKEND_CHAT_MOVEMENTS.find((value) => value.id === id) ?? null;
}

export function listModulesForMovement(
  id: BackendChatMovementId,
): readonly BackendChatCanonicalModuleDescriptor[] {
  const movement = getBackendChatMovement(id);
  if (!movement) {
    return Object.freeze([]);
  }
  const ids = new Set([...movement.primaryModuleIds, ...movement.secondaryModuleIds]);
  return Object.freeze(BACKEND_CHAT_CANONICAL_MODULES.filter((value) => ids.has(value.id)));
}

// ============================================================================
// MARK: Ownership matrices and integration policy helpers
// ============================================================================

export interface BackendChatOwnershipMatrixRow {
  readonly concern: string;
  readonly backendOwner: readonly string[];
  readonly forbiddenOwners: readonly string[];
}

export const BACKEND_CHAT_OWNERSHIP_MATRIX = Object.freeze([
  ownershipRow('Session truth', ['ChatSessionState', 'ChatState'], ['pzo-server transport', 'frontend chat engine']),
  ownershipRow('Presence truth', ['ChatPresenceState', 'ChatState'], ['frontend chat presence controller', 'transport fanout']),
  ownershipRow('Input normalization', ['ChatEventBridge'], ['transport handlers', 'frontend event bridge as authority']),
  ownershipRow('Rate law', ['ChatRatePolicy'], ['client-side throttles as final truth']),
  ownershipRow('Moderation law', ['ChatModerationPolicy'], ['frontend privacy guard as final truth']),
  ownershipRow('Channel law', ['ChatChannelPolicy'], ['tab UI', 'frontend router as final truth']),
  ownershipRow('Command semantics', ['ChatCommandParser'], ['socket handlers', 'composer UI']),
  ownershipRow('Transcript truth', ['ChatMessageFactory', 'ChatTranscriptLedger', 'ChatState'], ['client transcript buffer']),
  ownershipRow('Proof edges', ['ChatProofChain'], ['frontend-only proof badges']),
  ownershipRow('Helper judgment', ['HelperResponseOrchestrator'], ['frontend helper planners']),
  ownershipRow('Hater judgment', ['HaterResponseOrchestrator'], ['battle donor files', 'server hater donor engine']),
  ownershipRow('Top-level NPC scheduling', ['ChatNpcOrchestrator'], ['UI timing controllers']),
  ownershipRow('Invasion authority', ['ChatInvasionOrchestrator'], ['visual banners']),
  ownershipRow('Replay truth', ['ChatReplayAssembler', 'ChatReplayIndex'], ['frontend replay buffers']),
  ownershipRow('Telemetry truth', ['ChatTelemetrySink', 'ChatEventStreamWriter'], ['frontend telemetry emitter as final truth']),
  ownershipRow('Learning truth', ['LearningProfileStore', 'ChatLearningCoordinator'], ['localStorage learning mirrors']),
] as const satisfies readonly BackendChatOwnershipMatrixRow[]);

export function listBackendChatOwnershipMatrix(): readonly BackendChatOwnershipMatrixRow[] {
  return BACKEND_CHAT_OWNERSHIP_MATRIX;
}

export function getOwnershipRowForConcern(
  concern: string,
): BackendChatOwnershipMatrixRow | null {
  return BACKEND_CHAT_OWNERSHIP_MATRIX.find((value) => value.concern === concern) ?? null;
}

export function explainBackendChatOwnershipBoundaries(): readonly string[] {
  return Object.freeze(
    BACKEND_CHAT_OWNERSHIP_MATRIX.map(
      (row) => `${row.concern} :: owner=${row.backendOwner.join(', ')} :: forbidden=${row.forbiddenOwners.join(', ')}`,
    ),
  );
}

function movement(
  id: BackendChatMovementId,
  label: string,
  description: string,
  primaryModuleIds: readonly string[],
  secondaryModuleIds: readonly string[],
): BackendChatMovementDescriptor {
  return Object.freeze({
    id,
    label,
    description,
    primaryModuleIds: Object.freeze([...primaryModuleIds]),
    secondaryModuleIds: Object.freeze([...secondaryModuleIds]),
  });
}

function ownershipRow(
  concern: string,
  backendOwner: readonly string[],
  forbiddenOwners: readonly string[],
): BackendChatOwnershipMatrixRow {
  return Object.freeze({
    concern,
    backendOwner: Object.freeze([...backendOwner]),
    forbiddenOwners: Object.freeze([...forbiddenOwners]),
  });
}
