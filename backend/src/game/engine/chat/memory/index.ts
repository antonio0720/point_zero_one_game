/**
 * ============================================================================
 * POINT ZERO ONE — CHAT MEMORY SUBSYSTEM BARREL
 * FILE: backend/src/game/engine/chat/memory/index.ts
 * VERSION: 2026.03.22
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Single entry point for the entire chat memory subsystem. Re-exports every
 * public class, interface, type, function, and constant from all 8 memory
 * modules. Provides a MemorySubsystemFactory that wires the full dependency
 * graph from a single configuration object.
 * ============================================================================
 */

// --- ConversationMemoryStore ---
export {
  ConversationMemoryStore,
  WallClock,
  ReplayClock,
  SeededPRNG,
  InMemoryPersistenceAdapter,
  PostgresPersistenceAdapterStub,
  DEFAULT_CONVERSATION_MEMORY_STORE_CONFIG,
  DEFAULT_CROSS_RUN_BRIDGE_CONFIG,
  MODE_MEMORY_PROFILES,
  EMOTION_DECAY_PROFILES,
  CONVERSATION_MEMORY_EVENT_WEIGHT_TABLE,
  CONVERSATION_MEMORY_KIND_WEIGHT_TABLE,
  getModeMemoryProfile,
  computeEmotionDecay,
  applyEmotionDecayToEvent,
} from './ConversationMemoryStore';
export type {
  MemoryClock,
  ConversationMemoryPersistenceAdapter,
  ConversationMemoryStoreConfig,
  ConversationMemoryEventRecord,
  ConversationMemoryQuoteRecord,
  ConversationMemoryCallbackRecord,
  ConversationMemoryMutation,
  ConversationMemorySnapshot,
  ConversationMemoryContext,
  ConversationMemoryActorRef,
  ConversationMemoryQuery,
  ConversationQuoteQuery,
  ConversationCallbackQuery,
  ConversationMemoryIngestMessage,
  ConversationQuoteCandidate,
  ConversationCallbackCandidate,
  ModeMemoryProfile,
  BridgedMemoryRecord,
  CrossRunBridgeConfig,
  SharedMemoryOverlap,
  ConflictingRecollection,
  MemorySelectionClaim,
  ConversationMemoryConflictArbitrationResult,
  CrossRunPattern,
  EmotionDecayProfile,
  EmotionChannel,
} from './ConversationMemoryStore';

// --- MemorySalienceScorer ---
export {
  MemorySalienceScorer,
  createMemorySalienceScorer,
  scoreConversationMemoryBatch,
  topMemoryScores,
  averageSalience,
  filterScoresByTier,
  DEFAULT_CONTEXT_BOOSTS,
  BOOST_COUNTERPART_PROXIMITY,
  BOOST_PRESSURE_ECHO,
  BOOST_CHANNEL_REVISIT,
  BOOST_MODE_REENTRY,
} from './MemorySalienceScorer';
export type {
  MemorySalienceScore,
  MemorySalienceContext,
  MemorySalienceTier,
  MemorySalienceBatch,
  ContextSalienceBoost,
  PredictiveSalienceInput,
  ModeSalienceWeights,
} from './MemorySalienceScorer';

// --- MemoryCompressionPolicy ---
export {
  MemoryCompressionPolicy,
  createMemoryCompressionPolicy,
  planConversationMemoryCompression,
  applyConversationMemoryCompression,
} from './MemoryCompressionPolicy';
export type {
  MemoryCompressionPlan,
  MemoryCompressionDecision,
  MemoryCompressionContext,
  MemoryCompressionConfig,
  SemanticMemoryCluster,
  NarrativeArc,
  ModeCompressionProfile,
  MemoryBudgetUtilization,
  RunMemoryCapsule,
} from './MemoryCompressionPolicy';

// --- QuoteRecallResolver ---
export { QuoteRecallResolver } from './QuoteRecallResolver';
export type {
  QuoteRecallResolverRequest,
  QuoteRecallResolverResponse,
  QuoteRecallSelection,
  QuoteRecallMode,
  QuoteChain,
  QuoteMutationStrategy,
  RecallFusionCandidate,
  ModeRecallProfile,
} from './QuoteRecallResolver';

// --- RelationshipLedger ---
export { RelationshipLedger } from './RelationshipLedger';
export type {
  RelationshipLedgerConfig,
  RelationshipLedgerIndexEntry,
  RelationshipLedgerEventRecord,
  RelationshipTrajectorySnapshot,
  RelationshipTrajectoryTrend,
  CounterpartCluster,
  CompactedRelationshipSummary,
} from './RelationshipLedger';

// --- RelationshipResolver ---
export { RelationshipResolver } from './RelationshipResolver';
export type {
  RelationshipResolverContext,
  RelationshipResolution,
  RelationshipResolutionEnvelope,
  SceneComposition,
  SceneBeat,
  NegotiationResolution,
  PostRunResolution,
} from './RelationshipResolver';

// --- RivalryEscalationPolicy ---
export {
  RivalryEscalationPolicy,
  RIVALRY_EVENT_PRESETS,
  DEFAULT_RIVALRY_ESCALATION_POLICY_CONFIG,
} from './RivalryEscalationPolicy';
export type {
  RivalryEscalationTier,
  RivalryEscalationRequest,
  RivalryEscalationDecision,
  RivalryEscalationAssessment,
  RivalryEscalationPolicyConfig,
  RivalryStateMachineState,
  RivalryStateTransitionResult,
  RivalryEscalationPrediction,
  PackHuntAssessment,
  PackHuntRole,
  DeEscalationDecision,
  BossFightComposition,
  RivalryEscalationAuditEntry,
} from './RivalryEscalationPolicy';

// --- HelperTrustPolicy ---
export {
  HelperTrustPolicy,
  createHelperTrustPolicy,
  evaluateHelperTrust,
  assessHelperTrust,
  inferHelperTrustStage,
  adjustDispositionForTrajectory,
  adjustDispositionForFatigue,
  shouldResetFatigue,
  computeHelperReadinessScore01,
  explainHelperTrustDecision,
  buildHelperTrustDiagnostic,
} from './HelperTrustPolicy';
export type {
  HelperTrustRequest,
  HelperTrustAssessment,
  HelperTrustDecision,
  HelperTrustStage,
  HelperTrustDisposition,
  HelperTrustPolicyConfig,
  HelperTrustModeProfile,
  TrustTrajectoryEntry,
  TrustTrajectoryTrend,
  HelperFatigueState,
} from './HelperTrustPolicy';

// ============================================================================
// MARK: Memory Subsystem Factory
// ============================================================================

import { ConversationMemoryStore } from './ConversationMemoryStore';
import { MemorySalienceScorer } from './MemorySalienceScorer';
import { MemoryCompressionPolicy } from './MemoryCompressionPolicy';
import { QuoteRecallResolver } from './QuoteRecallResolver';
import { RelationshipLedger } from './RelationshipLedger';
import { RelationshipResolver } from './RelationshipResolver';
import { RivalryEscalationPolicy } from './RivalryEscalationPolicy';
import { HelperTrustPolicy } from './HelperTrustPolicy';

export interface MemorySubsystemConfig {
  readonly storeConfig?: Partial<import('./ConversationMemoryStore').ConversationMemoryStoreConfig>;
  readonly salienceConfig?: Partial<import('./MemorySalienceScorer').MemorySalienceScorerConfig>;
  readonly compressionConfig?: Partial<import('./MemoryCompressionPolicy').MemoryCompressionConfig>;
  readonly rivalryConfig?: Partial<import('./RivalryEscalationPolicy').RivalryEscalationPolicyConfig>;
  readonly helperTrustConfig?: Partial<import('./HelperTrustPolicy').HelperTrustPolicyConfig>;
  readonly resolverConfig?: Partial<import('./RelationshipResolver').RelationshipResolverConfig>;
}

export interface MemorySubsystem {
  readonly store: ConversationMemoryStore;
  readonly salienceScorer: MemorySalienceScorer;
  readonly compressionPolicy: MemoryCompressionPolicy;
  readonly quoteRecallResolver: QuoteRecallResolver;
  readonly relationshipLedger: RelationshipLedger;
  readonly relationshipResolver: RelationshipResolver;
  readonly rivalryEscalationPolicy: RivalryEscalationPolicy;
  readonly helperTrustPolicy: HelperTrustPolicy;
}

/**
 * Construct the entire memory subsystem dependency graph from a single config.
 * This is the canonical entry point for the rest of the chat engine.
 */
export function createMemorySubsystem(config: MemorySubsystemConfig = {}): MemorySubsystem {
  const store = new ConversationMemoryStore(config.storeConfig);
  const salienceScorer = new MemorySalienceScorer(config.salienceConfig);
  const compressionPolicy = new MemoryCompressionPolicy(config.compressionConfig, salienceScorer);
  const quoteRecallResolver = new QuoteRecallResolver(store);
  const rivalryEscalationPolicy = new RivalryEscalationPolicy(config.rivalryConfig);
  const helperTrustPolicy = new HelperTrustPolicy(config.helperTrustConfig);
  const relationshipResolver = new RelationshipResolver(config.resolverConfig);
  const relationshipLedger = new RelationshipLedger({ relationshipService: undefined as any });

  return Object.freeze({
    store, salienceScorer, compressionPolicy, quoteRecallResolver,
    relationshipLedger, relationshipResolver, rivalryEscalationPolicy, helperTrustPolicy,
  });
}
