/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT ROOT BARREL + LANE MANIFEST
 * FILE: backend/src/game/engine/chat/index.ts
 * VERSION: 2026.03.20-backend-root-emotion.v1
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Public backend entry surface for the authoritative chat lane.
 *
 * Why this file is not a thin export list
 * --------------------------------------
 * The backend chat lane is a first-class simulation lane beside battle, time,
 * pressure, shield, tension, sovereignty, multiplayer, and zero. The barrel is
 * therefore responsible for more than symbol forwarding. It must also encode:
 *
 * 1. the canonical backend chat tree,
 * 2. the generated-vs-pending readiness of that tree,
 * 3. the downstream import surface the rest of the backend is allowed to touch,
 * 4. the experience-phase additions that make chat cinematic rather than merely
 *    reactive, and
 * 5. the ownership matrix that keeps frontend, transport, and backend authority
 *    boundaries intact.
 *
 * Design doctrine
 * ---------------
 * - No UI ownership.
 * - No socket ownership.
 * - No frontend-only type ownership.
 * - No donor-zone imports from pzo-web.
 * - No hidden authority shifts.
 * - Root barrel truth must stay honest about what is generated vs pending.
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

import * as Phase4 from './phase4_index';

import * as DramaOrchestrator from './experience/ChatDramaOrchestrator';
import * as ScenePlanner from './experience/ChatScenePlanner';
import * as MomentLedger from './experience/ChatMomentLedger';
import * as SilencePolicy from './experience/ChatSilencePolicy';

import * as BossFightEngine from './combat/ChatBossFightEngine';
import * as CounterResolver from './combat/ChatCounterResolver';
import * as TelegraphPolicy from './combat/ChatTelegraphPolicy';
import * as AttackWindowPolicy from './combat/ChatAttackWindowPolicy';
import * as RescueInterventionPlanner from './rescue/RescueInterventionPlanner';
import * as ChurnRescuePolicy from './rescue/ChurnRescuePolicy';
import * as RecoveryOutcomeTracker from './rescue/RecoveryOutcomeTracker';
import * as Rescue from './rescue';
import * as LegendMomentLedger from './rewards/LegendMomentLedger';
import * as RewardGrantResolver from './rewards/RewardGrantResolver';
import * as ReplayMomentIndexer from './rewards/ReplayMomentIndexer';
import * as PresenceStyleResolver from './presence/PresenceStyleResolver';
import * as TypingSimulationEngine from './presence/TypingSimulationEngine';
import * as ReadReceiptPolicy from './presence/ReadReceiptPolicy';
import * as Presence from './presence';
import * as Replay from './replay';
import * as CrossModeContinuityLedger from './continuity/CrossModeContinuityLedger';
import * as CarryoverResolver from './continuity/CarryoverResolver';
import * as PostRunNarrativeEngineRuntime from './postrun/PostRunNarrativeEngine';
import * as TurningPointResolverRuntime from './postrun/TurningPointResolver';
import * as ForeshadowPlannerRuntime from './postrun/ForeshadowPlanner';
import * as PostRun from './postrun';
import * as Phase1 from './phase1';
import * as Phase2 from './phase2';
import * as Intelligence from './intelligence';
import * as EmotionModelRuntime from './intelligence/ml/EmotionModel';
import * as PressureAffectModelRuntime from './intelligence/ml/PressureAffectModel';
import * as AttachmentModelRuntime from './intelligence/ml/AttachmentModel';
import { ChatNegotiationEngineModule } from './dealroom/NegotiationEngine';
import { ChatOfferCounterEngineModule } from './dealroom/OfferCounterEngine';

import {
  BACKEND_CHAT_ENGINE_PUBLIC_API_VERSION,
  BACKEND_CHAT_ENGINE_VERSION,
  CHAT_AUTHORITY_ROOTS,
  type JsonValue,
} from './types';

// ============================================================================
// MARK: Root barrel export surface
// ============================================================================

export * from './types';
export * from './ChatRuntimeConfig';
export * from './ChatState';
export * from './ChatReducer';
export * from './ChatMessageFactory';
export * from './ChatTranscriptLedger';
export * from './ChatProofChain';
export * from './ChatRatePolicy';
export * from './ChatModerationPolicy';
export * from './ChatChannelPolicy';
export * from './ChatCommandParser';
export * from './ChatEventBridge';
export * from './ChatPresenceState';
export * from './ChatSessionState';
export * from './ChatInvasionOrchestrator';
export * from './HaterResponseOrchestrator';
export * from './HelperResponseOrchestrator';
export * from './ChatNpcOrchestrator';
export * from './ChatEngine';
export * from './phase4_index';
export * from './experience/ChatDramaOrchestrator';
export * from './experience/ChatScenePlanner';
export * from './experience/ChatMomentLedger';
export * from './experience/ChatSilencePolicy';
export * from './combat/ChatBossFightEngine';
export * from './combat/ChatCounterResolver';
export * from './combat/ChatTelegraphPolicy';
export * from './combat/ChatAttackWindowPolicy';
export * from './rescue';
export * from './rewards/LegendMomentLedger';
export * from './rewards/RewardGrantResolver';
export * from './rewards/ReplayMomentIndexer';
export * from './presence';
export * from './replay';
export * from './continuity/CrossModeContinuityLedger';
export * from './continuity/CarryoverResolver';
export * from './postrun';
export * from './phase1';
export * from './phase2';
export * from './intelligence';
export * from './intelligence/ml/EmotionModel';
export * from './intelligence/ml/PressureAffectModel';
export * from './intelligence/ml/AttachmentModel';

// ── LiveOps world-event authority lane ─────────────────────────────────────
export {
  GlobalEventScheduler,
  createGlobalEventScheduler,
} from './liveops/GlobalEventScheduler';
export type {
  ForceActivationInput,
  GlobalEventActivation,
  GlobalEventDefinition,
  GlobalEventFamily,
  GlobalEventProjection,
  GlobalEventRepeatGranularity,
  GlobalEventScheduleKind,
  GlobalEventSchedulerEvaluationContext,
  GlobalEventSchedulerOptions,
  GlobalEventSchedulerRoomContext,
  GlobalEventSchedulerSnapshot,
  GlobalEventSchedulerState,
  GlobalEventVisibility,
} from './liveops/GlobalEventScheduler';

export {
  FactionSurgePlanner,
  createFactionSurgePlanner,
} from './liveops/FactionSurgePlanner';
export type {
  FactionAlignment,
  FactionDescriptor,
  FactionSurgeChannelDirective,
  FactionSurgePlan,
  FactionSurgePlannerOptions,
  FactionVoiceDirective,
  FactionVoiceKind,
} from './liveops/FactionSurgePlanner';

export {
  WorldEventDirector,
  createWorldEventDirector,
} from './liveops/WorldEventDirector';
export type {
  WorldEventAnnouncementDirective,
  WorldEventAnnouncementStyle,
  WorldEventDirectorOptions,
  WorldEventDirectorTickResult,
  WorldEventOverlayDirective,
  WorldEventRoomPlan,
  WorldEventShadowDirective,
} from './liveops/WorldEventDirector';

// ── Deal Room / Negotiation Runtime ─────────────────────────────────────────
export { NegotiationEngine, createNegotiationEngine, ChatNegotiationEngineModule } from './dealroom/NegotiationEngine';
export { OfferCounterEngine, createOfferCounterEngine, ChatOfferCounterEngineModule } from './dealroom/OfferCounterEngine';
export { BluffResolver, createBluffResolver, ChatBluffResolverModule } from './dealroom/BluffResolver';
export { NegotiationReputationPolicy, createNegotiationReputationPolicy, ChatNegotiationReputationPolicyModule } from './dealroom/NegotiationReputationPolicy';

export {
  Types as ChatTypesModule,
  Runtime as ChatRuntimeModule,
  State as ChatStateModule,
  Reducer as ChatReducerModule,
  MessageFactory as ChatMessageFactoryModule,
  TranscriptLedger as ChatTranscriptLedgerModule,
  ProofChain as ChatProofChainModule,
  RatePolicy as ChatRatePolicyModule,
  ModerationPolicy as ChatModerationPolicyModule,
  ChannelPolicy as ChatChannelPolicyModule,
  CommandParser as ChatCommandParserModule,
  EventBridge as ChatEventBridgeModule,
  PresenceState as ChatPresenceStateModule,
  SessionState as ChatSessionStateModule,
  Invasion as ChatInvasionOrchestratorModule,
  Hater as HaterResponseOrchestratorModule,
  Helper as HelperResponseOrchestratorModule,
  Npc as ChatNpcOrchestratorModule,
  Engine as ChatEngineModule,
  Phase4 as ChatPhase4Module,
  DramaOrchestrator as ChatDramaOrchestratorModule,
  ScenePlanner as ChatScenePlannerModule,
  MomentLedger as ChatMomentLedgerModule,
  SilencePolicy as ChatSilencePolicyModule,
  BossFightEngine as ChatBossFightEngineModule,
  CounterResolver as ChatCounterResolverModule,
  TelegraphPolicy as ChatTelegraphPolicyModule,
  AttackWindowPolicy as ChatAttackWindowPolicyModule,
  RescueInterventionPlanner as ChatRescueInterventionPlannerModule,
  ChurnRescuePolicy as ChatChurnRescuePolicyModule,
  RecoveryOutcomeTracker as ChatRecoveryOutcomeTrackerModule,
  Rescue as ChatRescueBarrelModule,
  LegendMomentLedger as ChatLegendMomentLedgerModule,
  RewardGrantResolver as ChatRewardGrantResolverModule,
  ReplayMomentIndexer as ChatReplayMomentIndexerModule,
  PresenceStyleResolver as ChatPresenceStyleResolverModule,
  TypingSimulationEngine as ChatTypingSimulationEngineModule,
  ReadReceiptPolicy as ChatReadReceiptPolicyModule,
  Presence as ChatPresenceBarrelModule,
  Replay as ChatReplayBarrelModule,
  CrossModeContinuityLedger as ChatCrossModeContinuityLedgerModule,
  CarryoverResolver as ChatCarryoverResolverModule,
  PostRunNarrativeEngineRuntime as ChatPostRunNarrativeEngineModule,
  TurningPointResolverRuntime as ChatTurningPointResolverModule,
  ForeshadowPlannerRuntime as ChatForeshadowPlannerModule,
  PostRun as ChatPostRunBarrelModule,
  Phase1 as ChatPhase1Module,
  Phase2 as ChatPhase2Module,
  Intelligence as ChatIntelligenceModule,
  EmotionModelRuntime as ChatEmotionModelModule,
  PressureAffectModelRuntime as ChatPressureAffectModelModule,
  AttachmentModelRuntime as ChatAttachmentModelModule,
};

export const ChatEngineClass = Engine.ChatEngine;
export const HelperResponseAuthorityClass = Helper.HelperResponseAuthority;
export const HaterResponseAuthorityClass = Hater.HaterResponseAuthority;
export const ChatNpcAuthorityClass = Npc.ChatNpcAuthority;
export const ChatSessionAuthorityClass = SessionState.ChatSessionAuthority;
export const ChatPresenceAuthorityClass = PresenceState.ChatPresenceAuthority;
export const ChatCommandParserClass = CommandParser.ChatCommandParser;

export const ChatDramaOrchestratorClass = DramaOrchestrator.ChatDramaOrchestrator;
export const ChatScenePlannerClass = ScenePlanner.ChatScenePlanner;
export const ChatMomentLedgerClass = MomentLedger.ChatMomentLedger;
export const ChatSilencePolicyClass = SilencePolicy.ChatSilencePolicy;
export const ChatBossFightEngineClass = BossFightEngine.ChatBossFightEngine;
export const ChatCounterResolverClass = CounterResolver.ChatCounterResolver;
export const ChatTelegraphPolicyClass = TelegraphPolicy.ChatTelegraphPolicy;
export const ChatAttackWindowPolicyClass = AttackWindowPolicy.ChatAttackWindowPolicy;
export const RescueInterventionPlannerClass = RescueInterventionPlanner.RescueInterventionPlanner;
export const ChurnRescuePolicyClass = ChurnRescuePolicy.ChurnRescuePolicy;
export const RecoveryOutcomeTrackerClass = RecoveryOutcomeTracker.RecoveryOutcomeTracker;
export const ChatLegendMomentLedgerClass = LegendMomentLedger.LegendMomentLedger;
export const ChatRewardGrantResolverClass = RewardGrantResolver.RewardGrantResolver;
export const ChatReplayMomentIndexerClass = ReplayMomentIndexer.ReplayMomentIndexer;
export const PresenceStyleResolverClass = PresenceStyleResolver.PresenceStyleResolver;
export const TypingSimulationEngineClass = TypingSimulationEngine.TypingSimulationEngine;
export const ReadReceiptPolicyClass = ReadReceiptPolicy.ReadReceiptPolicy;
export const CrossModeContinuityLedgerClass = CrossModeContinuityLedger.CrossModeContinuityLedger;
export const CarryoverResolverClass = CarryoverResolver.CarryoverResolver;
export const PostRunNarrativeEngineClass = PostRunNarrativeEngineRuntime.PostRunNarrativeEngine;
export const TurningPointResolverClass = TurningPointResolverRuntime.TurningPointResolver;
export const ForeshadowPlannerClass = ForeshadowPlannerRuntime.ForeshadowPlanner;
export const ChatEmotionModelClass = EmotionModelRuntime.EmotionModel;
export const ChatPressureAffectModelClass = PressureAffectModelRuntime.PressureAffectModel;
export const ChatAttachmentModelClass = AttachmentModelRuntime.AttachmentModel;

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
  | 'EXPERIENCE'
  | 'MEMORY'
  | 'SOCIAL'
  | 'PERSONA'
  | 'RESCUE'
  | 'DEALROOM'
  | 'SHADOW'
  | 'REWARDS'
  | 'LIVEOPS'
  | 'PRESENCE'
  | 'CONTINUITY'
  | 'COMBAT'
  | 'POSTRUN'
  | 'PHASE1'
  | 'PHASE2'
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
  readonly plannedPaths: readonly string[];
  readonly deferredPaths: readonly string[];
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
    readonly phase4: typeof Phase4;
    readonly phase1: typeof Phase1;
    readonly phase2: typeof Phase2;
    readonly experience: {
      readonly dramaOrchestrator: typeof DramaOrchestrator;
      readonly scenePlanner: typeof ScenePlanner;
      readonly momentLedger: typeof MomentLedger;
      readonly silencePolicy: typeof SilencePolicy;
    };
    readonly combat: {
      readonly bossFightEngine: typeof BossFightEngine;
      readonly counterResolver: typeof CounterResolver;
    };
    readonly rescue: {
      readonly interventionPlanner: typeof RescueInterventionPlanner;
      readonly churnRescuePolicy: typeof ChurnRescuePolicy;
      readonly recoveryOutcomeTracker: typeof RecoveryOutcomeTracker;
    };
    readonly continuity: {
      readonly crossModeContinuityLedger: typeof CrossModeContinuityLedger;
      readonly carryoverResolver: typeof CarryoverResolver;
    };
    readonly intelligence: {
      readonly barrel: typeof Intelligence;
      readonly emotionModel: typeof EmotionModelRuntime;
      readonly pressureAffectModel: typeof PressureAffectModelRuntime;
      readonly attachmentModel: typeof AttachmentModelRuntime;
    };
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
  descriptor('phase4_index', 'phase4_index.ts', 'ROOT', 'GENERATED', false, 'Phase-4/experience barrel for stateful chat continuity services.'),
  descriptor('ChatEngine', 'ChatEngine.ts', 'ROOT', 'GENERATED', true, 'Top-level authoritative backend chat engine façade.'),
  descriptor('ChatState', 'ChatState.ts', 'ROOT', 'GENERATED', true, 'Authoritative state shape and lawful state helpers.'),
  descriptor('ChatReducer', 'ChatReducer.ts', 'ROOT', 'GENERATED', true, 'Deterministic backend mutation layer.'),
  descriptor('ChatMessageFactory', 'ChatMessageFactory.ts', 'ROOT', 'GENERATED', true, 'Canonical message construction and revision authority.'),
  descriptor('ChatTranscriptLedger', 'ChatTranscriptLedger.ts', 'ROOT', 'GENERATED', true, 'Transcript append/index/redact/delete authority.'),
  descriptor('ChatProofChain', 'ChatProofChain.ts', 'ROOT', 'GENERATED', true, 'Proof-edge creation and verification authority.'),
  descriptor('ChatRatePolicy', 'ChatRatePolicy.ts', 'ROOT', 'GENERATED', true, 'Rate law before mutation.'),
  descriptor('ChatModerationPolicy', 'ChatModerationPolicy.ts', 'ROOT', 'GENERATED', true, 'Moderation law before mutation.'),
  descriptor('ChatChannelPolicy', 'ChatChannelPolicy.ts', 'ROOT', 'GENERATED', true, 'Visible/shadow channel permission authority.'),
  descriptor('ChatCommandParser', 'ChatCommandParser.ts', 'ROOT', 'GENERATED', true, 'Command normalization and slash-command semantics.'),
  descriptor('ChatRuntimeConfig', 'ChatRuntimeConfig.ts', 'ROOT', 'GENERATED', true, 'Normalized runtime configuration and hard defaults.'),
  descriptor('ChatEventBridge', 'ChatEventBridge.ts', 'ROOT', 'GENERATED', true, 'Game-to-chat backend event translation authority.'),
  descriptor('ChatPresenceState', 'ChatPresenceState.ts', 'ROOT', 'GENERATED', true, 'Backend presence truth.'),
  descriptor('ChatSessionState', 'ChatSessionState.ts', 'ROOT', 'GENERATED', true, 'Backend session/room admission truth.'),
  descriptor('ChatInvasionOrchestrator', 'ChatInvasionOrchestrator.ts', 'ROOT', 'GENERATED', true, 'Escalation and invasion choreography.'),
  descriptor('ChatNpcOrchestrator', 'ChatNpcOrchestrator.ts', 'ROOT', 'GENERATED', true, 'NPC orchestration entry point.'),
  descriptor('HaterResponseOrchestrator', 'HaterResponseOrchestrator.ts', 'ROOT', 'GENERATED', true, 'Backend hater response authority.'),
  descriptor('HelperResponseOrchestrator', 'HelperResponseOrchestrator.ts', 'ROOT', 'GENERATED', true, 'Backend helper response authority.'),

  // Adapters
  descriptor('adapters.index', 'adapters/index.ts', 'ADAPTERS', 'PENDING', false, 'Signal adapter barrel.'),
  descriptor('BattleSignalAdapter', 'adapters/BattleSignalAdapter.ts', 'ADAPTERS', 'PENDING', true, 'Battle engine to chat signal normalization.'),
  descriptor('RunSignalAdapter', 'adapters/RunSignalAdapter.ts', 'ADAPTERS', 'PENDING', true, 'Run lifecycle to chat signal normalization.'),
  descriptor('MultiplayerSignalAdapter', 'adapters/MultiplayerSignalAdapter.ts', 'ADAPTERS', 'PENDING', true, 'Multiplayer/session signal normalization.'),
  descriptor('EconomySignalAdapter', 'adapters/EconomySignalAdapter.ts', 'ADAPTERS', 'PENDING', true, 'Economy/deal-room signal normalization.'),
  descriptor('LiveOpsSignalAdapter', 'adapters/LiveOpsSignalAdapter.ts', 'ADAPTERS', 'PLANNED', true, 'World-event to chat signal normalization.'),

  // Channels
  descriptor('channels.index', 'channels/index.ts', 'CHANNELS', 'PENDING', false, 'Channel policy barrel.'),
  descriptor('GlobalChannelPolicy', 'channels/GlobalChannelPolicy.ts', 'CHANNELS', 'PENDING', true, 'Global crowd-theater channel law.'),
  descriptor('SyndicateChannelPolicy', 'channels/SyndicateChannelPolicy.ts', 'CHANNELS', 'PENDING', true, 'Syndicate trust/reputation channel law.'),
  descriptor('DealRoomChannelPolicy', 'channels/DealRoomChannelPolicy.ts', 'CHANNELS', 'PENDING', true, 'Deal-room negotiation channel law.'),
  descriptor('LobbyChannelPolicy', 'channels/LobbyChannelPolicy.ts', 'CHANNELS', 'PENDING', true, 'Lobby pre-run channel law.'),
  descriptor('ShadowChannelPolicy', 'channels/ShadowChannelPolicy.ts', 'CHANNELS', 'PLANNED', true, 'Backend-only shadow channel law.'),

  // NPC
  descriptor('npc.index', 'npc/index.ts', 'NPC', 'PENDING', false, 'NPC registry barrel.'),
  descriptor('HaterDialogueRegistry', 'npc/HaterDialogueRegistry.ts', 'NPC', 'PENDING', true, 'Canonical backend hater authored line registry.'),
  descriptor('HelperDialogueRegistry', 'npc/HelperDialogueRegistry.ts', 'NPC', 'PENDING', true, 'Canonical backend helper authored line registry.'),
  descriptor('AmbientNpcRegistry', 'npc/AmbientNpcRegistry.ts', 'NPC', 'PENDING', true, 'Canonical backend ambient authored line registry.'),
  descriptor('NpcCadencePolicy', 'npc/NpcCadencePolicy.ts', 'NPC', 'PENDING', true, 'NPC timing law.'),
  descriptor('NpcSuppressionPolicy', 'npc/NpcSuppressionPolicy.ts', 'NPC', 'PENDING', true, 'NPC suppression law.'),

  // Replay
  descriptor('replay.index', 'replay/index.ts', 'REPLAY', 'GENERATED', false, 'Replay lane barrel: assembler + index + authority runtime + profiles.'),
  descriptor('ChatReplayAssembler', 'replay/ChatReplayAssembler.ts', 'REPLAY', 'GENERATED', true, 'Replay artifact assembly, batch ops, scene beats, witness lines, and bundle scoring.'),
  descriptor('ChatReplayIndex', 'replay/ChatReplayIndex.ts', 'REPLAY', 'GENERATED', true, 'Replay lookup, global/room indexing, search, scene frequency, label taxonomy, proof coverage scoring.'),

  // Telemetry
  descriptor('telemetry.index', 'telemetry/index.ts', 'TELEMETRY', 'PENDING', false, 'Telemetry barrel.'),
  descriptor('ChatTelemetrySink', 'telemetry/ChatTelemetrySink.ts', 'TELEMETRY', 'PENDING', true, 'Authoritative telemetry sink.'),
  descriptor('ChatEventStreamWriter', 'telemetry/ChatEventStreamWriter.ts', 'TELEMETRY', 'PENDING', true, 'Event-stream writer for analytics, ML, and replay.'),

  // Experience — generated now
  descriptor('experience.ChatDramaOrchestrator', 'experience/ChatDramaOrchestrator.ts', 'EXPERIENCE', 'GENERATED', true, 'Cinematic scene orchestration over existing backend authorities.'),
  descriptor('experience.ChatScenePlanner', 'experience/ChatScenePlanner.ts', 'EXPERIENCE', 'GENERATED', true, 'Scene planning and beat sequencing for major moments.'),
  descriptor('experience.ChatMomentLedger', 'experience/ChatMomentLedger.ts', 'EXPERIENCE', 'GENERATED', true, 'Durable moment/reveal/silence memory across a run.'),
  descriptor('experience.ChatSilencePolicy', 'experience/ChatSilencePolicy.ts', 'EXPERIENCE', 'GENERATED', true, 'Silence, interruption, and reveal timing law.'),

  // Memory / continuity family
  descriptor('memory.RelationshipLedger', 'memory/RelationshipLedger.ts', 'MEMORY', 'PENDING', true, 'Backend durability for player-to-NPC relationship state.'),
  descriptor('memory.RelationshipResolver', 'memory/RelationshipResolver.ts', 'MEMORY', 'PENDING', true, 'Relationship-state mutation and lookup authority.'),
  descriptor('memory.RivalryEscalationPolicy', 'memory/RivalryEscalationPolicy.ts', 'MEMORY', 'PENDING', true, 'Rivalry escalation law.'),
  descriptor('memory.HelperTrustPolicy', 'memory/HelperTrustPolicy.ts', 'MEMORY', 'PENDING', true, 'Helper trust adaptation law.'),
  descriptor('memory.ConversationMemoryStore', 'memory/ConversationMemoryStore.ts', 'MEMORY', 'PENDING', true, 'Durable callback/carryover memory store.'),
  descriptor('memory.QuoteRecallResolver', 'memory/QuoteRecallResolver.ts', 'MEMORY', 'PENDING', true, 'Quote and receipt recall resolution.'),
  descriptor('memory.MemoryCompressionPolicy', 'memory/MemoryCompressionPolicy.ts', 'MEMORY', 'PENDING', true, 'Compression/trimming law for long-lived chat memory.'),
  descriptor('memory.MemorySalienceScorer', 'memory/MemorySalienceScorer.ts', 'MEMORY', 'PENDING', true, 'Salience scoring for callback-worthy moments.'),

  // Social
  descriptor('social.AudienceHeatLedger', 'social/AudienceHeatLedger.ts', 'SOCIAL', 'PENDING', true, 'Durable crowd heat and audience-state tracking.'),
  descriptor('social.ReputationResolver', 'social/ReputationResolver.ts', 'SOCIAL', 'PENDING', true, 'Reputation consequence resolution.'),
  descriptor('social.CrowdSynthesisEngine', 'social/CrowdSynthesisEngine.ts', 'SOCIAL', 'PENDING', true, 'Crowd-theater line synthesis and timing.'),
  descriptor('social.SwarmReactionPlanner', 'social/SwarmReactionPlanner.ts', 'SOCIAL', 'PENDING', true, 'Swarm reaction planning for global/social moments.'),

  // Persona
  descriptor('persona.PersonaRegistry', 'persona/PersonaRegistry.ts', 'PERSONA', 'PENDING', true, 'Backend persona registry.'),
  descriptor('persona.VoiceprintPolicy', 'persona/VoiceprintPolicy.ts', 'PERSONA', 'PENDING', true, 'Cadence and lexicon law per NPC.'),
  descriptor('persona.LatencyStyleResolver', 'persona/LatencyStyleResolver.ts', 'PERSONA', 'PENDING', true, 'Persona-specific typing/reveal latency policy.'),

  // Rescue
  descriptor('rescue.index', 'rescue/index.ts', 'RESCUE', 'GENERATED', false, 'Rescue lane barrel: churn policy, intervention planner, outcome tracker.'),
  descriptor('rescue.RescueInterventionPlanner', 'rescue/RescueInterventionPlanner.ts', 'RESCUE', 'GENERATED', true, 'Rescue window orchestration, active intervention, expire/resolve flows, profiles, batch ops.'),
  descriptor('rescue.ChurnRescuePolicy', 'rescue/ChurnRescuePolicy.ts', 'RESCUE', 'GENERATED', true, 'Churn-risk scoring, suppression law, urgency/style selection, profile system, batch evaluation.'),
  descriptor('rescue.RecoveryOutcomeTracker', 'rescue/RecoveryOutcomeTracker.ts', 'RESCUE', 'GENERATED', true, 'Recovery state durability, reinforcement, cohort analysis, relapse tracking, profile system.'),

  // Deal room
  descriptor('dealroom.NegotiationEngine', 'dealroom/NegotiationEngine.ts', 'DEALROOM', 'PENDING', true, 'Deal-room negotiation state and response authority.'),
  descriptor('dealroom.OfferCounterEngine', 'dealroom/OfferCounterEngine.ts', 'DEALROOM', 'PENDING', true, 'Counter-offer generation and validation.'),
  descriptor('dealroom.BluffResolver', 'dealroom/BluffResolver.ts', 'DEALROOM', 'PENDING', true, 'Bluff inference and consequence resolution.'),
  descriptor('dealroom.NegotiationReputationPolicy', 'dealroom/NegotiationReputationPolicy.ts', 'DEALROOM', 'PENDING', true, 'Negotiation reputation law.'),

  // Shadow
  descriptor('shadow.ShadowStateLedger', 'shadow/ShadowStateLedger.ts', 'SHADOW', 'PENDING', true, 'Durable shadow-state ledger.'),
  descriptor('shadow.RevealResolver', 'shadow/RevealResolver.ts', 'SHADOW', 'PENDING', true, 'Reveal resolution for delayed/suppressed beats.'),
  descriptor('shadow.DeferredReactionPlanner', 'shadow/DeferredReactionPlanner.ts', 'SHADOW', 'PENDING', true, 'Deferred-reaction queue planning.'),

  // Rewards / prestige
  descriptor('rewards.LegendMomentLedger', 'rewards/LegendMomentLedger.ts', 'REWARDS', 'GENERATED', true, 'Prestige-worthy moment archive.'),
  descriptor('rewards.RewardGrantResolver', 'rewards/RewardGrantResolver.ts', 'REWARDS', 'GENERATED', true, 'Chat reward grant resolution.'),
  descriptor('rewards.ReplayMomentIndexer', 'rewards/ReplayMomentIndexer.ts', 'REWARDS', 'GENERATED', true, 'Legend/replay cross-indexing.'),

  // LiveOps
  descriptor('liveops.WorldEventDirector', 'liveops/WorldEventDirector.ts', 'LIVEOPS', 'PENDING', true, 'World-scale chat event orchestration.'),
  descriptor('liveops.FactionSurgePlanner', 'liveops/FactionSurgePlanner.ts', 'LIVEOPS', 'PENDING', true, 'Faction surge planning.'),
  descriptor('liveops.GlobalEventScheduler', 'liveops/GlobalEventScheduler.ts', 'LIVEOPS', 'PENDING', true, 'Global event scheduling law.'),

  // Presence theater
  descriptor('presence.PresenceStyleResolver', 'presence/PresenceStyleResolver.ts', 'PRESENCE', 'GENERATED', true, 'NPC presence style authority.'),
  descriptor('presence.TypingSimulationEngine', 'presence/TypingSimulationEngine.ts', 'PRESENCE', 'GENERATED', true, 'Typing/lurk simulation authority.'),
  descriptor('presence.ReadReceiptPolicy', 'presence/ReadReceiptPolicy.ts', 'PRESENCE', 'GENERATED', true, 'Read-delay and receipt law.'),

  // Continuity
  descriptor('continuity.CrossModeContinuityLedger', 'continuity/CrossModeContinuityLedger.ts', 'CONTINUITY', 'GENERATED', true, 'Cross-mode continuity durability layer.'),
  descriptor('continuity.CarryoverResolver', 'continuity/CarryoverResolver.ts', 'CONTINUITY', 'GENERATED', true, 'Carryover scene-state resolution between modes.'),

  // Combat / language-as-combat
  descriptor('combat.ChatBossFightEngine', 'combat/ChatBossFightEngine.ts', 'COMBAT', 'GENERATED', true, 'Conversational boss-fight authority.'),
  descriptor('combat.ChatCounterResolver', 'combat/ChatCounterResolver.ts', 'COMBAT', 'GENERATED', true, 'Counterplay resolution authority.'),
  descriptor('combat.ChatTelegraphPolicy', 'combat/ChatTelegraphPolicy.ts', 'COMBAT', 'GENERATED', true, 'Attack telegraph law.'),
  descriptor('combat.ChatAttackWindowPolicy', 'combat/ChatAttackWindowPolicy.ts', 'COMBAT', 'GENERATED', true, 'Attack-window timing law.'),

  // Post-run ritual
  descriptor('postrun.index', 'postrun/index.ts', 'POSTRUN', 'GENERATED', false, 'Post-run ritual barrel — engine, resolver, and planner.'),
  descriptor('postrun.PostRunNarrativeEngine', 'postrun/PostRunNarrativeEngine.ts', 'POSTRUN', 'GENERATED', true, 'Post-run authored narrative and debrief.'),
  descriptor('postrun.TurningPointResolver', 'postrun/TurningPointResolver.ts', 'POSTRUN', 'GENERATED', true, 'Turning-point selection authority.'),
  descriptor('postrun.ForeshadowPlanner', 'postrun/ForeshadowPlanner.ts', 'POSTRUN', 'GENERATED', true, 'Foreshadow and next-run pressure planning.'),

  // Phase 1 — novelty and episodic memory intelligence
  descriptor('phase1.index', 'phase1/index.ts', 'PHASE1', 'GENERATED', false, 'Phase 1 barrel — state slice and intelligence bridge.'),
  descriptor('phase1.ChatStatePhaseOne', 'phase1/ChatStatePhaseOne.ts', 'PHASE1', 'GENERATED', true, 'Phase 1 state slice: conversational fingerprint, novelty ledger, episodic memory.'),
  descriptor('phase1.ChatEnginePhaseOneBridge', 'phase1/ChatEnginePhaseOneBridge.ts', 'PHASE1', 'GENERATED', true, 'Phase 1 intelligence bridge: novelty, episodic memory, callback, carryover.'),

  // Phase 2 — relationship evolution
  descriptor('phase2.index', 'phase2/index.ts', 'PHASE2', 'GENERATED', false, 'Phase 2 barrel — state slice and relationship bridge.'),
  descriptor('phase2.ChatStatePhaseTwo', 'phase2/ChatStatePhaseTwo.ts', 'PHASE2', 'GENERATED', true, 'Phase 2 state slice: counterpart projections, channel heat, escalation risk.'),
  descriptor('phase2.ChatEnginePhaseTwoBridge', 'phase2/ChatEnginePhaseTwoBridge.ts', 'PHASE2', 'GENERATED', true, 'Phase 2 relationship evolution bridge: NPC signals, heat decay, sync, audit.'),

  // Intelligence root
  descriptor('intelligence.index', 'intelligence/index.ts', 'INTELLIGENCE', 'GENERATED', false, 'Intelligence barrel.'),
  descriptor('ChatSemanticSimilarityIndex', 'intelligence/ChatSemanticSimilarityIndex.ts', 'INTELLIGENCE', 'GENERATED', true, 'Semantic anti-repetition and authored-line similarity index.'),
  descriptor('BehavioralAnomalyDetector', 'intelligence/BehavioralAnomalyDetector.ts', 'INTELLIGENCE', 'PENDING', false, 'Detects behavioral outliers in player chat activity.'),
  descriptor('PlayerIntentClassifier', 'intelligence/PlayerIntentClassifier.ts', 'INTELLIGENCE', 'PENDING', false, 'Intent-classification surface for player messages.'),
  descriptor('MessageRiskClassifier', 'intelligence/MessageRiskClassifier.ts', 'INTELLIGENCE', 'PENDING', false, 'Risk scoring for risky or exploitative messages.'),
  descriptor('RetrievalRankCoordinator', 'intelligence/RetrievalRankCoordinator.ts', 'INTELLIGENCE', 'PLANNED', false, 'Coordinates retrieval, ranking, and response gates.'),

  // Intelligence ML
  descriptor('intelligence.ml.index', 'intelligence/ml/index.ts', 'INTELLIGENCE_ML', 'PENDING', false, 'ML barrel.'),
  descriptor('EmotionModel', 'intelligence/ml/EmotionModel.ts', 'INTELLIGENCE_ML', 'GENERATED', true, 'Backend emotion scoring for intimidation/confidence/frustration.'),
  descriptor('PressureAffectModel', 'intelligence/ml/PressureAffectModel.ts', 'INTELLIGENCE_ML', 'GENERATED', true, 'Pressure-affect scoring.'),
  descriptor('AttachmentModel', 'intelligence/ml/AttachmentModel.ts', 'INTELLIGENCE_ML', 'GENERATED', true, 'Attachment/trust intensity scoring.'),

  // Intelligence DL
  descriptor('intelligence.dl.index', 'intelligence/dl/index.ts', 'INTELLIGENCE_DL', 'PENDING', false, 'DL barrel.'),
  descriptor('MemoryAnchorStore', 'intelligence/dl/MemoryAnchorStore.ts', 'INTELLIGENCE_DL', 'PENDING', false, 'Retrieval-backed memory anchor durability.'),
  descriptor('RetrievalContextBuilder', 'intelligence/dl/RetrievalContextBuilder.ts', 'INTELLIGENCE_DL', 'PENDING', false, 'Historical retrieval context builder.'),
  descriptor('MemoryRankingPolicy', 'intelligence/dl/MemoryRankingPolicy.ts', 'INTELLIGENCE_DL', 'PENDING', false, 'Top-salience memory ranking policy.'),
  descriptor('IntentSequenceModel', 'intelligence/dl/IntentSequenceModel.ts', 'INTELLIGENCE_DL', 'PENDING', false, 'Sequence-level intent inference.'),
  descriptor('ResponseRankingModel', 'intelligence/dl/ResponseRankingModel.ts', 'INTELLIGENCE_DL', 'PENDING', false, 'Final response ranking.'),
  descriptor('ConversationMemoryModel', 'intelligence/dl/ConversationMemoryModel.ts', 'INTELLIGENCE_DL', 'PENDING', false, 'Long-window conversation memory.'),

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
      phase4: Phase4,
      phase1: Phase1,
      phase2: Phase2,
      experience: Object.freeze({
        dramaOrchestrator: DramaOrchestrator,
        scenePlanner: ScenePlanner,
        momentLedger: MomentLedger,
        silencePolicy: SilencePolicy,
      }),
      combat: Object.freeze({
        bossFightEngine: BossFightEngine,
        counterResolver: CounterResolver,
        telegraphPolicy: TelegraphPolicy,
        attackWindowPolicy: AttackWindowPolicy,
      }),
      rescue: Object.freeze({
        interventionPlanner: RescueInterventionPlanner,
        churnRescuePolicy: ChurnRescuePolicy,
        recoveryOutcomeTracker: RecoveryOutcomeTracker,
      }),
      continuity: Object.freeze({
        crossModeContinuityLedger: CrossModeContinuityLedger,
        carryoverResolver: CarryoverResolver,
      }),
      rewards: Object.freeze({
        legendMomentLedger: LegendMomentLedger,
        rewardGrantResolver: RewardGrantResolver,
        replayMomentIndexer: ReplayMomentIndexer,
      }),
      dealroom: {
        negotiationEngine: ChatNegotiationEngineModule,
        offerCounterEngine: ChatOfferCounterEngineModule,
      },
      intelligence: Object.freeze({
        barrel: Intelligence,
        emotionModel: EmotionModelRuntime,
        pressureAffectModel: PressureAffectModelRuntime,
        attachmentModel: AttachmentModelRuntime,
      }),
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

  const categories = uniqueCategories(BACKEND_CHAT_CANONICAL_MODULES);
  const byCategory = categories.map((category) =>
    Object.freeze({
      category,
      modules: Object.freeze(BACKEND_CHAT_CANONICAL_MODULES.filter((value) => value.category === category)),
    }),
  );

  return Object.freeze({
    generatedCount: generated.length,
    pendingCount: pending.length,
    plannedCount: planned.length,
    deferredCount: deferred.length,
    byCategory: Object.freeze(byCategory),
    generatedPaths: Object.freeze(generated.map((value) => value.relativePath)),
    pendingPaths: Object.freeze(pending.map((value) => value.relativePath)),
    plannedPaths: Object.freeze(planned.map((value) => value.relativePath)),
    deferredPaths: Object.freeze(deferred.map((value) => value.relativePath)),
  });
}

export function listBackendChatModules(): readonly BackendChatCanonicalModuleDescriptor[] {
  return BACKEND_CHAT_CANONICAL_MODULES;
}

export function listGeneratedBackendChatModules(): readonly BackendChatCanonicalModuleDescriptor[] {
  return Object.freeze(BACKEND_CHAT_CANONICAL_MODULES.filter((value) => value.readiness === 'GENERATED'));
}

export function listPendingBackendChatModules(): readonly BackendChatCanonicalModuleDescriptor[] {
  return Object.freeze(BACKEND_CHAT_CANONICAL_MODULES.filter((value) => value.readiness === 'PENDING'));
}

export function listPlannedBackendChatModules(): readonly BackendChatCanonicalModuleDescriptor[] {
  return Object.freeze(BACKEND_CHAT_CANONICAL_MODULES.filter((value) => value.readiness === 'PLANNED'));
}

export function listDeferredBackendChatModules(): readonly BackendChatCanonicalModuleDescriptor[] {
  return Object.freeze(BACKEND_CHAT_CANONICAL_MODULES.filter((value) => value.readiness === 'DEFERRED'));
}

export function getBackendChatModuleDescriptor(id: string): BackendChatCanonicalModuleDescriptor | null {
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

export function summarizeBackendChatCategory(category: BackendChatCanonicalModuleCategory): string {
  const modules = BACKEND_CHAT_CANONICAL_MODULES.filter((value) => value.category === category);
  const generated = modules.filter((value) => value.readiness === 'GENERATED').length;
  const pending = modules.filter((value) => value.readiness === 'PENDING').length;
  const planned = modules.filter((value) => value.readiness === 'PLANNED').length;
  const deferred = modules.filter((value) => value.readiness === 'DEFERRED').length;
  return `${category}: generated=${generated} pending=${pending} planned=${planned} deferred=${deferred}`;
}

export function listModulesByCategory(
  category: BackendChatCanonicalModuleCategory,
): readonly BackendChatCanonicalModuleDescriptor[] {
  return Object.freeze(BACKEND_CHAT_CANONICAL_MODULES.filter((value) => value.category === category));
}

// ============================================================================
// MARK: Current generated authority surface
// ============================================================================

export const BACKEND_CHAT_GENERATED_ROOT_MODULE_IDS = Object.freeze([
  'types',
  'index',
  'phase4_index',
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

export const BACKEND_CHAT_GENERATED_EXPERIENCE_MODULE_IDS = Object.freeze([
  'experience.ChatDramaOrchestrator',
  'experience.ChatScenePlanner',
  'experience.ChatMomentLedger',
  'experience.ChatSilencePolicy',
] as const);

export const BACKEND_CHAT_GENERATED_COMBAT_MODULE_IDS = Object.freeze([
  'combat.ChatBossFightEngine',
  'combat.ChatCounterResolver',
  'combat.ChatTelegraphPolicy',
  'combat.ChatAttackWindowPolicy',
] as const);

export const BACKEND_CHAT_GENERATED_REWARD_MODULE_IDS = Object.freeze([
  'rewards.LegendMomentLedger',
  'rewards.RewardGrantResolver',
  'rewards.ReplayMomentIndexer',
] as const);

export type BackendChatGeneratedRootModuleId = (typeof BACKEND_CHAT_GENERATED_ROOT_MODULE_IDS)[number];
export type BackendChatGeneratedExperienceModuleId =
  (typeof BACKEND_CHAT_GENERATED_EXPERIENCE_MODULE_IDS)[number];
export type BackendChatGeneratedCombatModuleId =
  (typeof BACKEND_CHAT_GENERATED_COMBAT_MODULE_IDS)[number];
export type BackendChatGeneratedRewardModuleId =
  (typeof BACKEND_CHAT_GENERATED_REWARD_MODULE_IDS)[number];

export interface BackendChatGeneratedSurfaceDescriptor {
  readonly id: BackendChatGeneratedRootModuleId | BackendChatGeneratedExperienceModuleId | BackendChatGeneratedCombatModuleId | BackendChatGeneratedRewardModuleId;
  readonly namespaceKey: string;
  readonly exported: boolean;
  readonly description: string;
}

export const BACKEND_CHAT_GENERATED_SURFACE = Object.freeze([
  generatedSurface('types', 'types', 'Canonical backend type surface and helper predicates.'),
  generatedSurface('ChatRuntimeConfig', 'runtime', 'Runtime config normalization and authoritative defaults.'),
  generatedSurface('ChatState', 'state', 'Authoritative state creation, selectors, and lawful mutation helpers.'),
  generatedSurface('ChatReducer', 'reducer', 'Deterministic reducer operations.'),
  generatedSurface('ChatMessageFactory', 'messageFactory', 'Canonical message construction and revision authority.'),
  generatedSurface('ChatTranscriptLedger', 'transcriptLedger', 'Transcript append, index, redact, and delete operations.'),
  generatedSurface('ChatProofChain', 'proofChain', 'Proof-edge creation and verification.'),
  generatedSurface('ChatRatePolicy', 'ratePolicy', 'Rate-gating law before state mutation.'),
  generatedSurface('ChatModerationPolicy', 'moderationPolicy', 'Moderation law before state mutation.'),
  generatedSurface('ChatChannelPolicy', 'channelPolicy', 'Visible and shadow channel law.'),
  generatedSurface('ChatCommandParser', 'commandParser', 'Canonical command semantics.'),
  generatedSurface('ChatEventBridge', 'eventBridge', 'Backend event normalization into chat-native inputs.'),
  generatedSurface('ChatPresenceState', 'presenceState', 'Presence truth and presence snapshots.'),
  generatedSurface('ChatSessionState', 'sessionState', 'Authenticated session and room truth.'),
  generatedSurface('ChatInvasionOrchestrator', 'invasion', 'Escalation/invasion timing and sequencing.'),
  generatedSurface('ChatNpcOrchestrator', 'npc', 'NPC orchestration entry point.'),
  generatedSurface('HaterResponseOrchestrator', 'hater', 'Hater-response authority.'),
  generatedSurface('HelperResponseOrchestrator', 'helper', 'Helper-response authority.'),
  generatedSurface('ChatEngine', 'engine', 'Top-level authoritative backend chat engine façade.'),
  generatedSurface('experience.ChatDramaOrchestrator', 'experience.dramaOrchestrator', 'Cinematic scene orchestration.'),
  generatedSurface('experience.ChatScenePlanner', 'experience.scenePlanner', 'Moment-to-scene planning and beat ranking.'),
  generatedSurface('experience.ChatMomentLedger', 'experience.momentLedger', 'Durable moment/reveal/silence memory.'),
  generatedSurface('experience.ChatSilencePolicy', 'experience.silencePolicy', 'Silence, reveal, and interruption law.'),
  generatedSurface('combat.ChatBossFightEngine', 'combat.bossFightEngine', 'Authoritative conversational boss-fight runtime.'),
  generatedSurface('combat.ChatCounterResolver', 'combat.counterResolver', 'Authoritative counter window scoring and resolution.'),
  generatedSurface('combat.ChatTelegraphPolicy', 'combat.telegraphPolicy', 'Authoritative attack telegraph selection and beat timing.'),
  generatedSurface('combat.ChatAttackWindowPolicy', 'combat.attackWindowPolicy', 'Authoritative attack-window timing and grace law.'),
  generatedSurface('rewards.LegendMomentLedger', 'rewards.legendMomentLedger', 'Authoritative prestige ledger over legend-class moments.'),
  generatedSurface('rewards.RewardGrantResolver', 'rewards.rewardGrantResolver', 'Authoritative legend-to-reward grant resolution.'),
  generatedSurface('rewards.ReplayMomentIndexer', 'rewards.replayMomentIndexer', 'Authoritative replay-to-prestige cross indexing.'),
] as const satisfies readonly BackendChatGeneratedSurfaceDescriptor[]);

export function listGeneratedSurfaceDescriptors(): readonly BackendChatGeneratedSurfaceDescriptor[] {
  return BACKEND_CHAT_GENERATED_SURFACE;
}

export const CHAT_BACKEND_DEALROOM_RUNTIME_MODULES = {
  NegotiationEngine: () => import('./dealroom/NegotiationEngine'),
  OfferCounterEngine: () => import('./dealroom/OfferCounterEngine'),
  BluffResolver: () => import('./dealroom/BluffResolver'),
  NegotiationReputationPolicy: () => import('./dealroom/NegotiationReputationPolicy'),
} as const;

export const CHAT_BACKEND_REWARD_RUNTIME_MODULES = {
  LegendMomentLedger: () => import('./rewards/LegendMomentLedger'),
  RewardGrantResolver: () => import('./rewards/RewardGrantResolver'),
  ReplayMomentIndexer: () => import('./rewards/ReplayMomentIndexer'),
} as const;

// ============================================================================
// MARK: Downstream integration surfaces
// ============================================================================

export interface BackendChatDownstreamIntegrationSurface {
  readonly forBackendLanes: readonly string[];
  readonly forServerTransport: readonly string[];
  readonly forPhase4Consumers: readonly string[];
  readonly forbiddenImports: readonly string[];
}

export const BACKEND_CHAT_DOWNSTREAM_INTEGRATION_SURFACE: BackendChatDownstreamIntegrationSurface =
  Object.freeze({
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
      './phase4_index',
      './experience/ChatDramaOrchestrator',
      './experience/ChatScenePlanner',
      './experience/ChatMomentLedger',
      './experience/ChatSilencePolicy',
      './intelligence',
      './intelligence/ml/EmotionModel',
      './intelligence/ml/PressureAffectModel',
      './intelligence/ml/AttachmentModel',
    ]),
    forServerTransport: Object.freeze([
      './types',
      './ChatEventBridge',
      './ChatSessionState',
      './ChatPresenceState',
      './ChatEngine',
      './phase4_index',
    ]),
    forPhase4Consumers: Object.freeze([
      './ChatMemoryService',
      './ChatNoveltyService',
      './ChatRelationshipService',
      './ChatSceneArchiveService',
      './ChatPlayerModelService',
      './intelligence/ChatSemanticSimilarityIndex',
      './experience/ChatDramaOrchestrator',
      './experience/ChatScenePlanner',
      './experience/ChatMomentLedger',
      './experience/ChatSilencePolicy',
      './intelligence',
      './intelligence/ml/EmotionModel',
      './intelligence/ml/PressureAffectModel',
      './intelligence/ml/AttachmentModel',
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

export function listPhase4IntegrationExports(): readonly string[] {
  return BACKEND_CHAT_DOWNSTREAM_INTEGRATION_SURFACE.forPhase4Consumers;
}

export function listForbiddenBackendChatImports(): readonly string[] {
  return BACKEND_CHAT_DOWNSTREAM_INTEGRATION_SURFACE.forbiddenImports;
}

// ============================================================================
// MARK: Integrity and diagnostics
// ============================================================================

export function assertBackendChatManifestIntegrity(): readonly string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  const paths = new Set<string>();

  for (const module of BACKEND_CHAT_CANONICAL_MODULES) {
    if (ids.has(module.id)) issues.push(`duplicate_module_id:${module.id}`);
    if (paths.has(module.relativePath)) issues.push(`duplicate_module_path:${module.relativePath}`);
    ids.add(module.id);
    paths.add(module.relativePath);

    if (module.relativePath.startsWith('/')) {
      issues.push(`absolute_relative_path_forbidden:${module.relativePath}`);
    }

    if (module.category === 'EXPERIENCE' && !module.relativePath.startsWith('experience/')) {
      issues.push(`experience_category_path_mismatch:${module.id}`);
    }
  }

  for (const id of BACKEND_CHAT_GENERATED_ROOT_MODULE_IDS) {
    const descriptor = getBackendChatModuleDescriptor(id);
    if (!descriptor) issues.push(`generated_surface_missing_descriptor:${id}`);
    else if (descriptor.readiness !== 'GENERATED') issues.push(`generated_surface_not_generated:${id}`);
  }

  for (const id of BACKEND_CHAT_GENERATED_EXPERIENCE_MODULE_IDS) {
    const descriptor = getBackendChatModuleDescriptor(id);
    if (!descriptor) issues.push(`generated_experience_surface_missing_descriptor:${id}`);
    else if (descriptor.readiness !== 'GENERATED') issues.push(`generated_experience_surface_not_generated:${id}`);
  }

  for (const id of BACKEND_CHAT_GENERATED_REWARD_MODULE_IDS) {
    const descriptor = getBackendChatModuleDescriptor(id);
    if (!descriptor) issues.push(`generated_reward_surface_missing_descriptor:${id}`);
    else if (descriptor.readiness !== 'GENERATED') issues.push(`generated_reward_surface_not_generated:${id}`);
  }

  return Object.freeze(issues);
}

export function assertBackendChatAuthorityBundleIntegrity(): readonly string[] {
  const issues = [...assertBackendChatManifestIntegrity()];

  if (BACKEND_CHAT_AUTHORITY_BUNDLE.version !== BACKEND_CHAT_ENGINE_VERSION) {
    issues.push('authority_bundle_version_mismatch');
  }

  if (BACKEND_CHAT_AUTHORITY_BUNDLE.publicApiVersion !== BACKEND_CHAT_ENGINE_PUBLIC_API_VERSION) {
    issues.push('authority_bundle_public_api_version_mismatch');
  }

  return Object.freeze(issues);
}

export function createBackendChatDiagnosticsSnapshot(): Readonly<Record<string, JsonValue>> {
  const readiness = buildBackendChatLaneReadinessReport();
  const manifestIssues = assertBackendChatManifestIntegrity();
  const bundleIssues = assertBackendChatAuthorityBundleIntegrity();

  return Object.freeze({
    version: BACKEND_CHAT_ENGINE_VERSION,
    publicApiVersion: BACKEND_CHAT_ENGINE_PUBLIC_API_VERSION,
    authorityRoots: CHAT_AUTHORITY_ROOTS,
    readinessSummary: summarizeBackendChatLaneReadiness(),
    generatedCount: readiness.generatedCount,
    pendingCount: readiness.pendingCount,
    plannedCount: readiness.plannedCount,
    deferredCount: readiness.deferredCount,
    manifestIssues: [...manifestIssues],
    bundleIssues: [...bundleIssues],
    backendIntegrationExports: [...listBackendLaneIntegrationExports()],
    serverTransportIntegrationExports: [...listServerTransportIntegrationExports()],
    phase4IntegrationExports: [...listPhase4IntegrationExports()],
  });
}

// ============================================================================
// MARK: Experience addendum and movement map
// ============================================================================

export type BackendChatMovementId =
  | 'MOVEMENT_0_BOOT_AND_DOCTRINE'
  | 'MOVEMENT_1_SESSION_ADMISSION_AND_PRESENCE'
  | 'MOVEMENT_2_EVENT_INGESTION_AND_TRANSLATION'
  | 'MOVEMENT_3_INPUT_GATING_AND_ENFORCEMENT'
  | 'MOVEMENT_4_ENGINE_REDUCTION_AND_RUNTIME_TRUTH'
  | 'MOVEMENT_5_MESSAGE_CREATION_AND_TRANSCRIPT_TRUTH'
  | 'MOVEMENT_6_NPC_HELPER_HATER_INVASION_ORCHESTRATION'
  | 'MOVEMENT_7_PHASE4_MEMORY_AND_SIMILARITY'
  | 'MOVEMENT_8_DRAMA_AND_SCENE_DIRECTION'
  | 'MOVEMENT_9_SILENCE_AND_REVEAL_TIMING'
  | 'MOVEMENT_10_SOCIAL_MEMORY_AND_PRESTIGE'
  | 'MOVEMENT_11_LIVEOPS_AND_WORLD_SCALE_PRESSURE'
  | 'MOVEMENT_12_LEARNING_COORDINATION';

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
    'Defines runtime law, authority roots, root barrels, and backend-only type surface.',
    ['ChatRuntimeConfig', 'types', 'index', 'phase4_index'],
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
    'Normalizes battle, run, multiplayer, economy, and liveops facts into backend chat-native input.',
    ['ChatEventBridge'],
    ['adapters.index', 'BattleSignalAdapter', 'RunSignalAdapter', 'MultiplayerSignalAdapter', 'EconomySignalAdapter'],
  ),
  movement(
    'MOVEMENT_3_INPUT_GATING_AND_ENFORCEMENT',
    'Input gating and enforcement',
    'Applies rate, moderation, channel, and command law before transcript truth changes.',
    ['ChatRatePolicy', 'ChatModerationPolicy', 'ChatChannelPolicy', 'ChatCommandParser'],
    ['GlobalChannelPolicy', 'SyndicateChannelPolicy', 'DealRoomChannelPolicy', 'ShadowChannelPolicy'],
  ),
  movement(
    'MOVEMENT_4_ENGINE_REDUCTION_AND_RUNTIME_TRUTH',
    'Engine reduction and runtime truth',
    'Owns top-level backend orchestration and lawful state transitions.',
    ['ChatEngine', 'ChatState', 'ChatReducer'],
    ['ChatRuntimeConfig', 'ChatSessionState', 'ChatPresenceState'],
  ),
  movement(
    'MOVEMENT_5_MESSAGE_CREATION_AND_TRANSCRIPT_TRUTH',
    'Message creation and transcript truth',
    'Ensures all visible and shadow messages are authored, indexed, and proof-linked from backend truth.',
    ['ChatMessageFactory', 'ChatTranscriptLedger', 'ChatProofChain'],
    ['ChatEventBridge', 'ChatReducer'],
  ),
  movement(
    'MOVEMENT_6_NPC_HELPER_HATER_INVASION_ORCHESTRATION',
    'NPC, helper, hater, and invasion orchestration',
    'Routes helper, rival, and ambient authored responses from backend authority.',
    ['ChatNpcOrchestrator', 'HaterResponseOrchestrator', 'HelperResponseOrchestrator', 'ChatInvasionOrchestrator'],
    ['npc.index', 'HaterDialogueRegistry', 'HelperDialogueRegistry', 'NpcCadencePolicy'],
  ),
  movement(
    'MOVEMENT_7_PHASE4_MEMORY_AND_SIMILARITY',
    'Phase-4 memory, novelty, relationships, and semantic continuity',
    'Preserves recall, novelty suppression, relationship continuity, scene archives, player modeling, and semantic repetition control.',
    [
      'phase4_index',
      'ChatMemoryService',
      'ChatNoveltyService',
      'ChatRelationshipService',
      'ChatSceneArchiveService',
      'ChatPlayerModelService',
      'ChatSemanticSimilarityIndex',
    ],
    ['memory.ConversationMemoryStore', 'memory.MemorySalienceScorer'],
  ),
  movement(
    'MOVEMENT_8_DRAMA_AND_SCENE_DIRECTION',
    'Drama and scene direction',
    'Promotes chat from utility layer to emotional game director through scene planning and orchestration.',
    [
      'experience.ChatDramaOrchestrator',
      'experience.ChatScenePlanner',
      'experience.ChatMomentLedger',
    ],
    ['ChatNpcOrchestrator', 'HaterResponseOrchestrator', 'HelperResponseOrchestrator', 'ChatSceneArchiveService'],
  ),
  movement(
    'MOVEMENT_9_SILENCE_AND_REVEAL_TIMING',
    'Silence and reveal timing',
    'Treats silence, delayed reveals, and interruption priority as first-class backend timing law.',
    ['experience.ChatSilencePolicy', 'experience.ChatMomentLedger'],
    ['presence.TypingSimulationEngine', 'shadow.RevealResolver'],
  ),
  movement(
    'MOVEMENT_10_SOCIAL_MEMORY_AND_PRESTIGE',
    'Social memory, callback continuity, and prestige',
    'Extends chat into relationship memory, audience heat, legend moments, and callback continuity.',
    ['memory.RelationshipResolver', 'social.AudienceHeatLedger', 'rewards.LegendMomentLedger'],
    ['memory.QuoteRecallResolver', 'social.CrowdSynthesisEngine', 'rewards.ReplayMomentIndexer'],
  ),
  movement(
    'MOVEMENT_11_LIVEOPS_AND_WORLD_SCALE_PRESSURE',
    'LiveOps and world-scale pressure',
    'Supports world events, coordinated raids, faction surges, and platform-wide social pressure.',
    ['liveops.WorldEventDirector', 'liveops.GlobalEventScheduler'],
    ['liveops.FactionSurgePlanner', 'shadow.DeferredReactionPlanner', 'presence.PresenceStyleResolver'],
  ),
  movement(
    'MOVEMENT_12_LEARNING_COORDINATION',
    'Learning coordination',
    'Coordinates online intelligence, emotion scoring, retrieval, and offline training without breaking backend authority.',
    ['intelligence.index', 'ChatSemanticSimilarityIndex'],
    ['EmotionModel', 'PressureAffectModel', 'AttachmentModel', 'MemoryAnchorStore', 'RetrievalContextBuilder', 'PolicyTrainer'],
  ),
] as const satisfies readonly BackendChatMovementDescriptor[]);

export function getBackendChatMovement(id: BackendChatMovementId): BackendChatMovementDescriptor | null {
  return BACKEND_CHAT_MOVEMENTS.find((value) => value.id === id) ?? null;
}

export function listModulesForMovement(id: BackendChatMovementId): readonly BackendChatCanonicalModuleDescriptor[] {
  const movementDescriptor = getBackendChatMovement(id);
  if (!movementDescriptor) return Object.freeze([]);

  const ids = new Set([...movementDescriptor.primaryModuleIds, ...movementDescriptor.secondaryModuleIds]);
  return Object.freeze(BACKEND_CHAT_CANONICAL_MODULES.filter((value) => ids.has(value.id)));
}

// ============================================================================
// MARK: Ownership matrix
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
  ownershipRow('NPC helper/hater orchestration', ['ChatNpcOrchestrator', 'HaterResponseOrchestrator', 'HelperResponseOrchestrator'], ['frontend-only bot reply generators']),
  ownershipRow('Scene orchestration', ['experience.ChatDramaOrchestrator', 'experience.ChatScenePlanner'], ['frontend dock sequencing as final truth']),
  ownershipRow('Silence/reveal timing', ['experience.ChatSilencePolicy', 'experience.ChatMomentLedger'], ['typing indicator UI', 'client reveal queues as final truth']),
  ownershipRow('Memory continuity', ['ChatMemoryService', 'ChatRelationshipService', 'ChatSceneArchiveService'], ['browser-local chat memory as authority']),
  ownershipRow('Player modeling', ['ChatPlayerModelService'], ['frontend analytics-only scores as authority']),
  ownershipRow('Semantic repetition control', ['ChatSemanticSimilarityIndex'], ['frontend anti-spam heuristics as authority']),
  ownershipRow('World events and pressure', ['liveops.WorldEventDirector', 'social.AudienceHeatLedger'], ['server transport banners', 'frontend overlays as authority']),
]);

export function listBackendChatOwnershipRows(): readonly BackendChatOwnershipMatrixRow[] {
  return BACKEND_CHAT_OWNERSHIP_MATRIX;
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
  id: BackendChatGeneratedSurfaceDescriptor['id'],
  namespaceKey: string,
  description: string,
): BackendChatGeneratedSurfaceDescriptor {
  return Object.freeze({
    id,
    namespaceKey,
    exported: true,
    description,
  });
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

function uniqueCategories(
  modules: readonly BackendChatCanonicalModuleDescriptor[],
): readonly BackendChatCanonicalModuleCategory[] {
  const seen = new Set<BackendChatCanonicalModuleCategory>();
  const categories: BackendChatCanonicalModuleCategory[] = [];

  for (const module of modules) {
    if (seen.has(module.category)) continue;
    seen.add(module.category);
    categories.push(module.category);
  }

  return Object.freeze(categories);
}