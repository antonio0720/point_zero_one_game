/* eslint-disable max-lines */
/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT INTELLIGENCE / DL BARREL
 * FILE: backend/src/game/engine/chat/intelligence/dl/index.ts
 * VERSION: 2026.03.22-intelligence-dl-barrel-15x.v2
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical composition barrel for the backend chat intelligence DL lane.
 *
 * This file is intentionally not a tiny export shim. It binds the retrieval-
 * continuity stack that lives under chat/intelligence/dl with the legacy-
 * authoritative backend DL lane that lives under chat/dl.
 *
 * Upgrade doctrine
 * ----------------
 * This revision pushes the barrel past simple exports and basic runtime
 * composition. It now:
 * - preserves the original import-safe runtime,
 * - surfaces the full retrieval/analyzer helper plane from the upgraded files,
 * - mirrors the durable memory-store control plane through one runtime entry,
 * - exposes sequence-memory, ranking, and retrieval orchestration helpers,
 * - provides preset-aware request enrichment for chat response intents,
 * - and ships helper-surface metadata so orchestration can discover callable
 *   capabilities without guessing.
 * ============================================================================
 */

import {
  CHAT_CONVERSATION_MEMORY_MODEL_VERSION,
  ConversationMemoryModel,
  createConversationMemoryModel,
  ingestBackendChatMemoryTurn,
  retrieveBackendConversationMemories,
  type ConversationMemoryContext,
  type ConversationMemoryModelDependencies,
  type ConversationMemoryRecord,
  type ConversationMemoryRetrievalRequest,
  type ConversationMemoryRetrievalResult,
  type ConversationMemoryTurn,
} from '../../dl/ConversationMemoryModel';
import {
  CHAT_DIALOGUE_INTENT_ENCODER_VERSION,
  DialogueIntentEncoder,
  createDialogueIntentEncoder,
  encodeDialogueIntentSequence,
  encodeDialogueIntentTurn,
  type DialogueIntentEncoderOptions,
  type DialogueIntentResult,
  type DialogueIntentSequenceInput,
  type DialogueIntentSequenceResult,
  type DialogueIntentTurnInput,
} from '../../dl/DialogueIntentEncoder';
import {
  CHAT_MESSAGE_EMBEDDING_CLIENT_VERSION,
  MessageEmbeddingClient,
  createMessageEmbeddingClient,
  embedAuthoritativeChatMessage,
  embedAuthoritativeTranscriptWindow,
  computeEmbeddingSimilarity,
  type EmbeddingMessageInput,
  type EmbeddingVector,
  type MessageEmbeddingClientOptions,
  type MessageEmbeddingClientClockPort,
  type SimilarityResult,
  type TranscriptWindowInput,
} from '../../dl/MessageEmbeddingClient';
import {
  CHAT_RESPONSE_RANKING_MODEL_VERSION,
  ResponseRankingModel,
  createResponseRankingModel,
  rankBackendChatHelperCandidates,
  rankBackendChatHaterCandidates,
  rankBackendChatResponseCandidates,
  type ResponseRankingCandidateInput,
  type ResponseRankingContext,
  type ResponseRankingDependencyBundle,
  type ResponseRankingResult,
} from '../../dl/ResponseRankingModel';
import {
  SequenceMemoryClient,
  createSequenceMemoryClient,
  type ChatDlChannelId,
  type ChatDlModeId,
  type SequenceMemoryActorType,
  type SequenceMemoryAnchor,
  type SequenceMemoryClientConfig,
  type SequenceMemoryClientDependencies,
  type SequenceMemoryCompressionRequest,
  type SequenceMemoryReadQuery,
  type SequenceMemoryRetrievalHit,
  type SequenceMemoryRetrievalQuery,
  type SequenceMemorySnapshot,
  type SequenceMemorySourceMessage,
  type SequenceMemoryStats,
  type SequenceMemoryVector,
} from '../../dl/SequenceMemoryClient';
import {
  MEMORY_RANKING_POLICY_VERSION,
  createMemoryRankingPolicy,
  type MemoryRankingPolicyApi,
  type MemoryRankingPolicyOptions,
  type MemoryRankingCandidate,
  type MemoryRankingContext,
  type MemoryRankingResult,
  type RankedMemoryAnchor,
  type MemoryRankingTrace,
  type MemoryRankingLane,
  type MemoryRankingRetrievalSource,
  buildMemoryRankingQueryFromContext,
  createCanonicalBaselineMatches,
  summarizeMemoryRankingResult,
  explainMemoryRankingTrace,
  explainRankedAnchor,
  createMemoryRankingCandidate,
  groupRankedAnchorsByFamily
} from './MemoryRankingPolicy';
import {
  MEMORY_ANCHOR_STORE_VERSION,
  createMemoryAnchorStore,
  type MemoryAnchorStoreApi,
  type MemoryAnchorStoreOptions,
  type MemoryAnchorQueryResponse,
  type MemoryAnchorStoreQueryRequest,
} from './MemoryAnchorStore';
import {
  RETRIEVAL_CONTEXT_BUILDER_VERSION,
  RETRIEVAL_CONTEXT_ANALYZER_VERSION,
  createRetrievalContextBuilder,
  type RetrievalContextBuilderApi,
  type RetrievalContextBuilderOptions,
  type RetrievalContextBuildRequest,
  type RetrievalContextPacket,
  type RetrievalContextSummary,
  type RetrievalContextAnchorItem,
  type RetrievalContextDocumentItem,
  type RetrievalPromptBlock,
  summarizeRetrievalContextPacket,
  hasAnyAnchors,
  hasAnyDocuments,
  hasAnyCallbacks,
  hasAnyRestraints,
  hasAnyTacticalNotes,
  getTopAnchor,
  getTopDocument,
  getTopCallback,
  getTopPromptBlock,
  retrievalContextIsBotResponse,
  requestIsBotResponse,
  retrievalContextIsHelperIntervention,
  requestIsHelperIntervention,
  retrievalContextIsHaterTaunt,
  requestIsHaterTaunt,
  retrievalContextIsDealroomCounter,
  requestIsDealroomCounter,
  retrievalContextIsPostrunNarration,
  requestIsPostrunNarration,
  retrievalContextIsScenePlanning,
  requestIsScenePlanning,
  retrievalContextIsLiveopsOverlay,
  requestIsLiveopsOverlay,
  packetHasRescueAnchor,
  anchorIsRescue,
  packetHasLegendAnchor,
  anchorIsLegend,
  packetHasQuoteReversalAnchor,
  anchorIsQuoteReversal,
  packetHasDealroomExposureAnchor,
  anchorIsDealroomExposure,
  packetHasWorldEventAnchor,
  anchorIsWorldEvent,
  packetHasPromiseAnchor,
  anchorIsPromise,
  packetHasBetrayalAnchor,
  anchorIsBetrayal,
  packetHasComebackAnchor,
  anchorIsComeback,
  packetHasCollapseAnchor,
  anchorIsCollapse,
  packetHasHumiliationAnchor,
  anchorIsHumiliation,
  packetHasHypeAnchor,
  anchorIsHype,
  packetHasThreatAnchor,
  anchorIsThreat,
  packetHasClutchAnchor,
  anchorIsClutch,
  packetHasWarningAnchor,
  anchorIsWarning,
  packetHasReceiptAnchor,
  anchorIsReceipt,
  packetHasRivalryAnchor,
  anchorIsRivalry,
  packetHasNegotiationAnchor,
  anchorIsNegotiation,
  packetHasVowAnchor,
  anchorIsVow,
  packetHasAllianceAnchor,
  anchorIsAlliance,
  packetHasSystemMarkerAnchor,
  anchorIsSystemMarker,
  requestMatchesPressureCritical,
  requestMatchesPressureBreakpoint,
  requestMatchesPressureCollapse,
  requestMatchesPressureHigh,
  requestMatchesPressureElevated,
  requestMatchesPressureVolatile,
  requestMatchesPressureReset,
  requestMatchesPressureCalm,
  requestMatchesEmotionFrustrated,
  requestMatchesEmotionDesperate,
  requestMatchesEmotionEmbarrassed,
  requestMatchesEmotionAngry,
  requestMatchesEmotionAnxious,
  requestMatchesEmotionHaunted,
  requestMatchesEmotionHopeful,
  requestMatchesEmotionTriumphant,
  requestMatchesEmotionCold,
  requestMatchesEmotionCalm,
  requestMatchesAudienceHigh,
  requestMatchesAudienceCritical,
  requestMatchesAudienceMob,
  requestMatchesAudienceVolatile,
  requestMatchesAudienceHot,
  requestMatchesAudienceCalm,
  requestMatchesRelationshipAlly,
  requestMatchesRelationshipRival,
  requestMatchesRelationshipDistrust,
  requestMatchesRelationshipMentor,
  requestMatchesRelationshipHunted,
  requestMatchesRelationshipFascinated,
  requestMatchesRelationshipBroken,
  getRetrievalContextAnchorIds,
  getRetrievalContextAnchorKinds,
  getRetrievalContextAnchorHeadlines,
  getRetrievalContextAnchorScores,
  getRetrievalContextAnchorSalience,
  getRetrievalContextDocumentIds,
  getRetrievalContextDocumentScores,
  getRetrievalContextCallbackPhrases,
  getRetrievalContextRestraintFlags,
  getRetrievalContextTacticalNotes,
  getRetrievalContextDebugNotes,
  getAnchorById,
  getDocumentById,
  getPromptBlockByKey,
  listPromptBlockKeys,
  flattenPromptBlockLines,
  renderPromptBlock,
  renderPromptBlocks,
  collectAllAnchorTags,
  collectAllAnchorEmotions,
  collectAllRelationshipRefs,
  collectAllQuoteRefs,
  averageAnchorScore,
  averageAnchorSalience,
  averageDocumentScore,
  highestAnchorScore,
  highestDocumentScore,
  countAnchorsByKind,
  countPromptBlocksByKey,
  countDocumentsBySourceKind,
  selectAnchorsByMinimumScore,
  selectDocumentsByMinimumScore,
  selectAnchorsByPriority,
  selectAnchorsByStabilityClass,
  selectDocumentsByPurpose,
  selectAnchorsByTag,
  selectAnchorsByEmotion,
  selectAnchorsByRelationshipRef,
  selectAnchorsByQuoteRef,
  packetUsesCallbackPhrase,
  packetUsesRestraintFlag,
  packetUsesTacticalNote,
  packetHasPromptBlockKey,
  packetHasDiagnosticPrefix,
  summarizeAnchor,
  summarizeDocument,
  summarizePacketTopline,
  selectMostActionableCallback,
  computeCallbackActionability,
  getRescueAnchors,
  countRescueAnchors,
  getLegendAnchors,
  countLegendAnchors,
  getQuoteReversalAnchors,
  countQuoteReversalAnchors,
  getDealroomExposureAnchors,
  countDealroomExposureAnchors,
  getWorldEventAnchors,
  countWorldEventAnchors,
  getPromiseAnchors,
  countPromiseAnchors,
  getBetrayalAnchors,
  countBetrayalAnchors,
  getComebackAnchors,
  countComebackAnchors,
  getCollapseAnchors,
  countCollapseAnchors,
  getHumiliationAnchors,
  countHumiliationAnchors,
  getHypeAnchors,
  countHypeAnchors,
  getThreatAnchors,
  countThreatAnchors,
  getClutchAnchors,
  countClutchAnchors,
  getWarningAnchors,
  countWarningAnchors,
  getReceiptAnchors,
  countReceiptAnchors,
  getRivalryAnchors,
  countRivalryAnchors,
  getNegotiationAnchors,
  countNegotiationAnchors,
  getVowAnchors,
  countVowAnchors,
  getAllianceAnchors,
  countAllianceAnchors,
  getSystemMarkerAnchors,
  countSystemMarkerAnchors,
  packetSuggestsPressureCritical,
  requestSuggestsPressureCritical,
  packetSuggestsPressureBreakpoint,
  requestSuggestsPressureBreakpoint,
  packetSuggestsPressureCollapse,
  requestSuggestsPressureCollapse,
  packetSuggestsPressureHigh,
  requestSuggestsPressureHigh,
  packetSuggestsPressureElevated,
  requestSuggestsPressureElevated,
  packetSuggestsPressureVolatile,
  requestSuggestsPressureVolatile,
  packetSuggestsPressureReset,
  requestSuggestsPressureReset,
  packetSuggestsPressureCalm,
  requestSuggestsPressureCalm,
  packetSuggestsEmotionFrustrated,
  requestSuggestsEmotionFrustrated,
  packetSuggestsEmotionDesperate,
  requestSuggestsEmotionDesperate,
  packetSuggestsEmotionEmbarrassed,
  requestSuggestsEmotionEmbarrassed,
  packetSuggestsEmotionAngry,
  requestSuggestsEmotionAngry,
  packetSuggestsEmotionAnxious,
  requestSuggestsEmotionAnxious,
  packetSuggestsEmotionHaunted,
  requestSuggestsEmotionHaunted,
  packetSuggestsEmotionHopeful,
  requestSuggestsEmotionHopeful,
  packetSuggestsEmotionTriumphant,
  requestSuggestsEmotionTriumphant,
  packetSuggestsEmotionCold,
  requestSuggestsEmotionCold,
  packetSuggestsEmotionCalm,
  requestSuggestsEmotionCalm,
  packetSuggestsAudienceHigh,
  requestSuggestsAudienceHigh,
  packetSuggestsAudienceCritical,
  requestSuggestsAudienceCritical,
  packetSuggestsAudienceMob,
  requestSuggestsAudienceMob,
  packetSuggestsAudienceVolatile,
  requestSuggestsAudienceVolatile,
  packetSuggestsAudienceHot,
  requestSuggestsAudienceHot,
  packetSuggestsAudienceCalm,
  requestSuggestsAudienceCalm,
  packetSuggestsRelationshipAlly,
  requestSuggestsRelationshipAlly,
  packetSuggestsRelationshipRival,
  requestSuggestsRelationshipRival,
  packetSuggestsRelationshipDistrust,
  requestSuggestsRelationshipDistrust,
  packetSuggestsRelationshipMentor,
  requestSuggestsRelationshipMentor,
  packetSuggestsRelationshipHunted,
  requestSuggestsRelationshipHunted,
  packetSuggestsRelationshipFascinated,
  requestSuggestsRelationshipFascinated,
  packetSuggestsRelationshipBroken,
  requestSuggestsRelationshipBroken,
  packetScoreProfile,
  packetDensityProfile,
  packetQualityGate,
  packetNarrativeProfile,
  packetSortingView
} from './RetrievalContextBuilder';

export * from '../../dl/ConversationMemoryModel';
export * from '../../dl/DialogueIntentEncoder';
export * from '../../dl/MessageEmbeddingClient';
export * from '../../dl/ResponseRankingModel';
export * from '../../dl/SequenceMemoryClient';
export * from './MemoryRankingPolicy';
export * from './MemoryAnchorStore';
export * from './RetrievalContextBuilder';

export const BACKEND_CHAT_INTELLIGENCE_DL_MODULE_NAME =
  'PZO_BACKEND_CHAT_INTELLIGENCE_DL_BARREL' as const;

export const BACKEND_CHAT_INTELLIGENCE_DL_VERSION =
  '2026.03.22-intelligence-dl-barrel-15x.v2' as const;

export const BACKEND_CHAT_INTELLIGENCE_DL_RUNTIME_LAWS = Object.freeze([
  'One import surface should expose the real backend chat intelligence lane.',
  'Retrieval continuity should compose with legacy backend DL, not compete with it.',
  'Shared embedding and intent dependencies should be instantiated once and reused.',
  'Conversation memory, response ranking, and retrieval anchors must remain explainable.',
  'This barrel exists to reduce drift between chat/dl and chat/intelligence/dl.',
  'The surface map is part of the product: imports should communicate responsibility.',
  'Do not flatten the lane into a generic SDK shim.',
  'The durable memory store should be operable through the same runtime that queries it.',
  'Sequence memory, response ranking, and retrieval context should be able to cooperate without hidden state.',
  'Utility helpers exported by upgraded modules should be discoverable as first-class barrel surfaces.',
  'Preset enrichment should sharpen intent without mutating canonical request truth unexpectedly.',
  'All wrapper methods should delegate to authoritative owners instead of re-implementing their doctrine.',
] as const);

export type BackendChatIntelligenceDlConcern =
  | 'SEMANTIC_EMBEDDING'
  | 'INTENT_ENCODING'
  | 'CONVERSATION_MEMORY'
  | 'RESPONSE_RANKING'
  | 'SEQUENCE_MEMORY'
  | 'RETRIEVAL_RANKING'
  | 'RETRIEVAL_MEMORY'
  | 'RETRIEVAL_CONTEXT';

export type BackendChatIntelligenceDlHelperOwner =
  | 'LEGACY_EMBEDDING'
  | 'LEGACY_INTENT'
  | 'LEGACY_CONVERSATION_MEMORY'
  | 'LEGACY_RESPONSE_RANKING'
  | 'RETRIEVAL_RANKING'
  | 'RETRIEVAL_CONTEXT';

export type BackendChatIntelligenceDlHelperCategory =
  | 'FACTORY'
  | 'OPERATION'
  | 'SUMMARY'
  | 'EXPLAIN'
  | 'PREDICATE'
  | 'SELECTOR'
  | 'COLLECTION'
  | 'SELECTION'
  | 'RENDER'
  | 'PROFILE'
  | 'UTILITY';

export interface BackendChatIntelligenceDlSurfaceEntry {
  readonly id: string;
  readonly relativePath: string;
  readonly concern: BackendChatIntelligenceDlConcern;
  readonly generated: boolean;
  readonly ownsTruth: boolean;
  readonly description: string;
  readonly moduleVersion: string;
}

export interface BackendChatIntelligenceDlHelperSurfaceEntry {
  readonly id: string;
  readonly owner: BackendChatIntelligenceDlHelperOwner;
  readonly category: BackendChatIntelligenceDlHelperCategory;
  readonly callableName: string;
  readonly relativePath: string;
  readonly description: string;
}

export interface BackendChatIntelligenceResponseIntentPreset {
  readonly responseIntent: RetrievalContextBuildRequest['responseIntent'];
  readonly memoryIntent: RetrievalContextBuildRequest['intent'];
  readonly preferredLane: MemoryRankingLane;
  readonly topK: number;
  readonly includeShadow: boolean;
  readonly currentTags: readonly string[];
  readonly relationshipSignals: readonly string[];
  readonly emotionSignals: readonly string[];
  readonly notes: readonly string[];
}

export interface BackendChatIntelligenceModeHint {
  readonly modeId: string;
  readonly currentTags: readonly string[];
  readonly relationshipSignals: readonly string[];
  readonly emotionSignals: readonly string[];
  readonly notes: readonly string[];
}

export interface BackendChatIntelligenceDlRuntimeHealth {
  readonly version: typeof BACKEND_CHAT_INTELLIGENCE_DL_VERSION;
  readonly surfaceCount: number;
  readonly helperSurfaceCount: number;
  readonly concerns: readonly BackendChatIntelligenceDlConcern[];
  readonly sharedDependencies: Readonly<{
    embeddingClient: boolean;
    intentEncoder: boolean;
    conversationMemoryModel: boolean;
    responseRankingModel: boolean;
    sequenceMemoryClient: boolean;
    memoryRankingPolicy: boolean;
    memoryAnchorStore: boolean;
    retrievalContextBuilder: boolean;
  }>;
  readonly versions: typeof BACKEND_CHAT_INTELLIGENCE_DL_VERSION_MAP;
}

export interface BackendChatIntelligenceDlRuntimeDependencies {
  readonly now?: () => number;

  readonly embeddingClient?: MessageEmbeddingClient;
  readonly embeddingClientOptions?: MessageEmbeddingClientOptions;

  readonly intentEncoder?: DialogueIntentEncoder;
  readonly intentEncoderOptions?: Omit<DialogueIntentEncoderOptions, 'embeddingClient' | 'clock'>;

  readonly conversationMemoryModel?: ConversationMemoryModel;
  readonly conversationMemoryModelDependencies?: Omit<
    ConversationMemoryModelDependencies,
    'embeddingClient' | 'intentEncoder' | 'now'
  >;

  readonly responseRankingModel?: ResponseRankingModel;
  readonly responseRankingDependencies?: Omit<
    ResponseRankingDependencyBundle,
    'embeddingClient' | 'intentEncoder' | 'now'
  >;

  readonly sequenceMemoryClient?: SequenceMemoryClient;
  readonly sequenceMemoryConfig?: Partial<SequenceMemoryClientConfig>;
  readonly sequenceMemoryDependencies?: SequenceMemoryClientDependencies;

  readonly memoryRankingPolicy?: MemoryRankingPolicyApi;
  readonly memoryRankingPolicyOptions?: MemoryRankingPolicyOptions;

  readonly memoryAnchorStore?: MemoryAnchorStoreApi;
  readonly memoryAnchorStoreOptions?: Omit<MemoryAnchorStoreOptions, 'rankingPolicy' | 'now'>;

  readonly retrievalContextBuilder?: RetrievalContextBuilderApi;
  readonly retrievalContextBuilderOptions?: RetrievalContextBuilderOptions;
}

export interface BackendChatIntelligenceAcceptedTurnInput {
  readonly turn: ConversationMemoryTurn;
  readonly context: ConversationMemoryContext;
  readonly actorType?: SequenceMemoryActorType;
  readonly authorId?: string;
  readonly eventId?: string;
  readonly causalParentIds?: readonly string[];
  readonly moderationMaskLevel?: number;
  readonly proofHash?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface BackendChatIntelligenceAcceptedTurnResult {
  readonly conversationRecord: ConversationMemoryRecord;
  readonly embeddingVector: EmbeddingVector;
  readonly sequenceSourceMessage: SequenceMemorySourceMessage;
  readonly sequenceAnchor: SequenceMemoryAnchor;
}

export interface BackendChatIntelligenceSequenceInferenceInput {
  readonly roomId: string;
  readonly channelId: ChatDlChannelId;
  readonly modeId: ChatDlModeId;
  readonly actorIds: readonly string[];
  readonly text?: string;
  readonly sourceTurn?: ConversationMemoryTurn;
  readonly sourceContext?: ConversationMemoryContext;
  readonly intentTurnInput?: DialogueIntentTurnInput;
  readonly intentResult?: DialogueIntentResult;
  readonly vector?: SequenceMemoryVector;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly salience?: number;
  readonly retrievalWeight?: number;
  readonly continuityWeight?: number;
  readonly callbackWeight?: number;
  readonly pressureWeight?: number;
}

export interface BackendChatIntelligenceRetrievalPacketAudit {
  readonly version: typeof BACKEND_CHAT_INTELLIGENCE_DL_VERSION;
  readonly retrievalAnalyzerVersion: typeof RETRIEVAL_CONTEXT_ANALYZER_VERSION;
  readonly summary: RetrievalContextSummary;
  readonly scoreProfile: Readonly<Record<string, number>>;
  readonly densityProfile: Readonly<Record<string, number>>;
  readonly qualityGate: Readonly<Record<string, boolean>>;
  readonly narrativeProfile: Readonly<Record<string, boolean>>;
  readonly sortingView: readonly string[];
  readonly promptKeys: readonly RetrievalPromptBlock['key'][];
  readonly flattenedPromptLines: readonly string[];
  readonly topAnchor: RetrievalContextAnchorItem | null;
  readonly topDocument: RetrievalContextDocumentItem | null;
  readonly topCallback: string | null;
  readonly topPromptBlock: RetrievalPromptBlock | null;
  readonly actionableCallback: string | null;
  readonly topLine: string;
  readonly anchorTags: readonly string[];
  readonly anchorEmotions: readonly string[];
}

export const BACKEND_CHAT_INTELLIGENCE_DL_SURFACE = Object.freeze([
  Object.freeze<BackendChatIntelligenceDlSurfaceEntry>({
    id: 'dl.MessageEmbeddingClient',
    relativePath: '../../dl/MessageEmbeddingClient',
    concern: 'SEMANTIC_EMBEDDING',
    generated: true,
    ownsTruth: true,
    description: 'Deterministic / hybrid semantic embedding authority for accepted backend chat truth.',
    moduleVersion: CHAT_MESSAGE_EMBEDDING_CLIENT_VERSION,
  }),
  Object.freeze<BackendChatIntelligenceDlSurfaceEntry>({
    id: 'dl.DialogueIntentEncoder',
    relativePath: '../../dl/DialogueIntentEncoder',
    concern: 'INTENT_ENCODING',
    generated: true,
    ownsTruth: true,
    description: 'Explainable intent encoder for accepted transcript truth and scene context.',
    moduleVersion: CHAT_DIALOGUE_INTENT_ENCODER_VERSION,
  }),
  Object.freeze<BackendChatIntelligenceDlSurfaceEntry>({
    id: 'dl.ConversationMemoryModel',
    relativePath: '../../dl/ConversationMemoryModel',
    concern: 'CONVERSATION_MEMORY',
    generated: true,
    ownsTruth: true,
    description: 'Accepted-truth conversation memory surface for callbacks, replay, and continuity.',
    moduleVersion: CHAT_CONVERSATION_MEMORY_MODEL_VERSION,
  }),
  Object.freeze<BackendChatIntelligenceDlSurfaceEntry>({
    id: 'dl.ResponseRankingModel',
    relativePath: '../../dl/ResponseRankingModel',
    concern: 'RESPONSE_RANKING',
    generated: true,
    ownsTruth: true,
    description: 'Backend ranking authority for helper, hater, system, ambient, and silence candidates.',
    moduleVersion: CHAT_RESPONSE_RANKING_MODEL_VERSION,
  }),
  Object.freeze<BackendChatIntelligenceDlSurfaceEntry>({
    id: 'dl.SequenceMemoryClient',
    relativePath: '../../dl/SequenceMemoryClient',
    concern: 'SEQUENCE_MEMORY',
    generated: true,
    ownsTruth: true,
    description: 'Durable sequence-memory coordination layer for replay and memory-aware downstream systems.',
    moduleVersion: 'backend-sequence-memory-client.v1',
  }),
  Object.freeze<BackendChatIntelligenceDlSurfaceEntry>({
    id: 'intelligence.dl.MemoryRankingPolicy',
    relativePath: './MemoryRankingPolicy',
    concern: 'RETRIEVAL_RANKING',
    generated: true,
    ownsTruth: true,
    description: 'Deterministic ranking authority for durable memory anchor retrieval.',
    moduleVersion: MEMORY_RANKING_POLICY_VERSION,
  }),
  Object.freeze<BackendChatIntelligenceDlSurfaceEntry>({
    id: 'intelligence.dl.MemoryAnchorStore',
    relativePath: './MemoryAnchorStore',
    concern: 'RETRIEVAL_MEMORY',
    generated: true,
    ownsTruth: true,
    description: 'Authoritative durable store for memory anchors, windows, proof bindings, and receipts.',
    moduleVersion: MEMORY_ANCHOR_STORE_VERSION,
  }),
  Object.freeze<BackendChatIntelligenceDlSurfaceEntry>({
    id: 'intelligence.dl.RetrievalContextBuilder',
    relativePath: './RetrievalContextBuilder',
    concern: 'RETRIEVAL_CONTEXT',
    generated: true,
    ownsTruth: true,
    description: 'Deterministic continuity packet builder for downstream chat authoring and orchestration.',
    moduleVersion: RETRIEVAL_CONTEXT_BUILDER_VERSION,
  }),
] as const);

export const BACKEND_CHAT_INTELLIGENCE_DL_VERSION_MAP = Object.freeze({
  barrel: BACKEND_CHAT_INTELLIGENCE_DL_VERSION,
  embedding: CHAT_MESSAGE_EMBEDDING_CLIENT_VERSION,
  intent: CHAT_DIALOGUE_INTENT_ENCODER_VERSION,
  conversationMemory: CHAT_CONVERSATION_MEMORY_MODEL_VERSION,
  responseRanking: CHAT_RESPONSE_RANKING_MODEL_VERSION,
  sequenceMemory: 'backend-sequence-memory-client.v1',
  retrievalRanking: MEMORY_RANKING_POLICY_VERSION,
  retrievalMemory: MEMORY_ANCHOR_STORE_VERSION,
  retrievalContext: RETRIEVAL_CONTEXT_BUILDER_VERSION,
  retrievalAnalyzer: RETRIEVAL_CONTEXT_ANALYZER_VERSION,
} as const);

export const BACKEND_CHAT_INTELLIGENCE_RESPONSE_INTENT_PRESETS = Object.freeze({
  BOT_RESPONSE: Object.freeze<BackendChatIntelligenceResponseIntentPreset>({
    responseIntent: 'BOT_RESPONSE',
    memoryIntent: 'CALLBACK',
    preferredLane: 'CALLBACK',
    topK: 6,
    includeShadow: false,
    currentTags: Object.freeze(["reply", "continuity", "callback"] as const),
    relationshipSignals: Object.freeze(["response", "continuity"] as const),
    emotionSignals: Object.freeze(["composed", "aware"] as const),
    notes: Object.freeze(["Balance continuity and restraint.", "Prefer recall that sharpens authored response rather than flooding context."] as const),
  }),
  HELPER_INTERVENTION: Object.freeze<BackendChatIntelligenceResponseIntentPreset>({
    responseIntent: 'HELPER_INTERVENTION',
    memoryIntent: 'RESCUE',
    preferredLane: 'RESCUE',
    topK: 6,
    includeShadow: true,
    currentTags: Object.freeze(["helper", "rescue", "support"] as const),
    relationshipSignals: Object.freeze(["ally", "assist", "protection"] as const),
    emotionSignals: Object.freeze(["urgent", "protective", "stabilize"] as const),
    notes: Object.freeze(["Favor rescue anchors and stabilizing continuity.", "Escalate shadow memory only when it improves intervention quality."] as const),
  }),
  HATER_TAUNT: Object.freeze<BackendChatIntelligenceResponseIntentPreset>({
    responseIntent: 'HATER_TAUNT',
    memoryIntent: 'TAUNT',
    preferredLane: 'TAUNT',
    topK: 5,
    includeShadow: true,
    currentTags: Object.freeze(["hater", "pressure", "taunt"] as const),
    relationshipSignals: Object.freeze(["rival", "dominance", "antagonism"] as const),
    emotionSignals: Object.freeze(["hostile", "heated", "predatory"] as const),
    notes: Object.freeze(["Prefer memorable pressure and rivalry callbacks.", "Keep recall sharp enough to sting without flattening scene control."] as const),
  }),
  DEALROOM_COUNTER: Object.freeze<BackendChatIntelligenceResponseIntentPreset>({
    responseIntent: 'DEALROOM_COUNTER',
    memoryIntent: 'DEALROOM_CONTEXT',
    preferredLane: 'DEALROOM',
    topK: 6,
    includeShadow: true,
    currentTags: Object.freeze(["dealroom", "negotiation", "counter"] as const),
    relationshipSignals: Object.freeze(["negotiation", "exposure", "leverage"] as const),
    emotionSignals: Object.freeze(["cold", "strategic", "disciplined"] as const),
    notes: Object.freeze(["Surface leverage, exposure, and prior concessions.", "Favor negotiation anchors with proof density and continuity."] as const),
  }),
  POSTRUN_NARRATION: Object.freeze<BackendChatIntelligenceResponseIntentPreset>({
    responseIntent: 'POSTRUN_NARRATION',
    memoryIntent: 'POSTRUN_CONTEXT',
    preferredLane: 'POSTRUN',
    topK: 7,
    includeShadow: false,
    currentTags: Object.freeze(["postrun", "recap", "aftermath"] as const),
    relationshipSignals: Object.freeze(["after-action", "witness", "legacy"] as const),
    emotionSignals: Object.freeze(["reflective", "resolved", "measured"] as const),
    notes: Object.freeze(["Prefer aftermath, receipts, and consequences.", "Allow broader contextual recall than direct response lanes."] as const),
  }),
  SCENE_PLANNING: Object.freeze<BackendChatIntelligenceResponseIntentPreset>({
    responseIntent: 'SCENE_PLANNING',
    memoryIntent: 'RELATIONSHIP_CONTEXT',
    preferredLane: 'RELATIONSHIP',
    topK: 8,
    includeShadow: true,
    currentTags: Object.freeze(["scene", "planning", "setup"] as const),
    relationshipSignals: Object.freeze(["tension", "relationship", "positioning"] as const),
    emotionSignals: Object.freeze(["anticipatory", "strategic", "framed"] as const),
    notes: Object.freeze(["Favor anchors that shape scene pressure and relational stakes.", "Broaden recall to include setup, promise, threat, and warning lines."] as const),
  }),
  LIVEOPS_OVERLAY: Object.freeze<BackendChatIntelligenceResponseIntentPreset>({
    responseIntent: 'LIVEOPS_OVERLAY',
    memoryIntent: 'LIVEOPS_CONTEXT',
    preferredLane: 'LIVEOPS',
    topK: 6,
    includeShadow: true,
    currentTags: Object.freeze(["liveops", "overlay", "event"] as const),
    relationshipSignals: Object.freeze(["audience", "event", "system"] as const),
    emotionSignals: Object.freeze(["volatile", "reactive", "hyped"] as const),
    notes: Object.freeze(["Prefer public, event-linked, and audience-facing anchors.", "Allow shadow/system recall when it improves liveops explainability."] as const),
  })
} as const);

export const BACKEND_CHAT_INTELLIGENCE_MODE_HINTS = Object.freeze({
  EMPIRE: Object.freeze<BackendChatIntelligenceModeHint>({
    modeId: 'EMPIRE',
    currentTags: Object.freeze(["empire", "control", "command"] as const),
    relationshipSignals: Object.freeze(["authority", "dominion"] as const),
    emotionSignals: Object.freeze(["cold", "dominant"] as const),
    notes: Object.freeze(["Favor command, hierarchy, and dominance continuity."] as const),
  }),
  PREDATOR: Object.freeze<BackendChatIntelligenceModeHint>({
    modeId: 'PREDATOR',
    currentTags: Object.freeze(["predator", "hunt", "pressure"] as const),
    relationshipSignals: Object.freeze(["hunt", "predation"] as const),
    emotionSignals: Object.freeze(["aggressive", "focused"] as const),
    notes: Object.freeze(["Favor intimidation, pursuit, and pressure spikes."] as const),
  }),
  SYNDICATE: Object.freeze<BackendChatIntelligenceModeHint>({
    modeId: 'SYNDICATE',
    currentTags: Object.freeze(["syndicate", "dealroom", "network"] as const),
    relationshipSignals: Object.freeze(["transaction", "alliance"] as const),
    emotionSignals: Object.freeze(["calculated", "negotiation"] as const),
    notes: Object.freeze(["Favor negotiation leverage, alliances, and betrayals."] as const),
  }),
  PHANTOM: Object.freeze<BackendChatIntelligenceModeHint>({
    modeId: 'PHANTOM',
    currentTags: Object.freeze(["phantom", "shadow", "stealth"] as const),
    relationshipSignals: Object.freeze(["misdirection", "ghosting"] as const),
    emotionSignals: Object.freeze(["haunted", "cold"] as const),
    notes: Object.freeze(["Allow stealth and shadow recall when continuity benefits."] as const),
  }),
  LOBBY: Object.freeze<BackendChatIntelligenceModeHint>({
    modeId: 'LOBBY',
    currentTags: Object.freeze(["lobby", "public", "ambient"] as const),
    relationshipSignals: Object.freeze(["public", "ambient"] as const),
    emotionSignals: Object.freeze(["calm", "social"] as const),
    notes: Object.freeze(["Favor broad continuity and public witness over deep shadow recall."] as const),
  }),
  POST_RUN: Object.freeze<BackendChatIntelligenceModeHint>({
    modeId: 'POST_RUN',
    currentTags: Object.freeze(["postrun", "receipt", "aftermath"] as const),
    relationshipSignals: Object.freeze(["aftermath", "receipt"] as const),
    emotionSignals: Object.freeze(["reflective", "settled"] as const),
    notes: Object.freeze(["Favor receipts, summaries, and carry-forward consequence."] as const),
  }),
  UNKNOWN: Object.freeze<BackendChatIntelligenceModeHint>({
    modeId: 'UNKNOWN',
    currentTags: Object.freeze(["unknown"] as const),
    relationshipSignals: Object.freeze([] as const),
    emotionSignals: Object.freeze([] as const),
    notes: Object.freeze(["Use neutral continuity defaults."] as const),
  })
} as const);

export const BACKEND_CHAT_INTELLIGENCE_LEGACY_EMBEDDING_UTILITIES = Object.freeze({
    createMessageEmbeddingClient,
    embedAuthoritativeChatMessage,
    embedAuthoritativeTranscriptWindow,
    computeEmbeddingSimilarity
} as const);

export const BACKEND_CHAT_INTELLIGENCE_LEGACY_INTENT_UTILITIES = Object.freeze({
    createDialogueIntentEncoder,
    encodeDialogueIntentTurn,
    encodeDialogueIntentSequence
} as const);

export const BACKEND_CHAT_INTELLIGENCE_LEGACY_CONVERSATION_MEMORY_UTILITIES = Object.freeze({
    createConversationMemoryModel,
    ingestBackendChatMemoryTurn,
    retrieveBackendConversationMemories
} as const);

export const BACKEND_CHAT_INTELLIGENCE_LEGACY_RESPONSE_RANKING_UTILITIES = Object.freeze({
    createResponseRankingModel,
    rankBackendChatResponseCandidates,
    rankBackendChatHelperCandidates,
    rankBackendChatHaterCandidates
} as const);

export const BACKEND_CHAT_INTELLIGENCE_MEMORY_RANKING_UTILITIES = Object.freeze({
    buildMemoryRankingQueryFromContext,
    createCanonicalBaselineMatches,
    summarizeMemoryRankingResult,
    explainMemoryRankingTrace,
    explainRankedAnchor,
    createMemoryRankingCandidate,
    groupRankedAnchorsByFamily
} as const);

export const BACKEND_CHAT_INTELLIGENCE_RETRIEVAL_CONTEXT_UTILITIES = Object.freeze({
    summarizeRetrievalContextPacket,
    hasAnyAnchors,
    hasAnyDocuments,
    hasAnyCallbacks,
    hasAnyRestraints,
    hasAnyTacticalNotes,
    getTopAnchor,
    getTopDocument,
    getTopCallback,
    getTopPromptBlock,
    retrievalContextIsBotResponse,
    requestIsBotResponse,
    retrievalContextIsHelperIntervention,
    requestIsHelperIntervention,
    retrievalContextIsHaterTaunt,
    requestIsHaterTaunt,
    retrievalContextIsDealroomCounter,
    requestIsDealroomCounter,
    retrievalContextIsPostrunNarration,
    requestIsPostrunNarration,
    retrievalContextIsScenePlanning,
    requestIsScenePlanning,
    retrievalContextIsLiveopsOverlay,
    requestIsLiveopsOverlay,
    packetHasRescueAnchor,
    anchorIsRescue,
    packetHasLegendAnchor,
    anchorIsLegend,
    packetHasQuoteReversalAnchor,
    anchorIsQuoteReversal,
    packetHasDealroomExposureAnchor,
    anchorIsDealroomExposure,
    packetHasWorldEventAnchor,
    anchorIsWorldEvent,
    packetHasPromiseAnchor,
    anchorIsPromise,
    packetHasBetrayalAnchor,
    anchorIsBetrayal,
    packetHasComebackAnchor,
    anchorIsComeback,
    packetHasCollapseAnchor,
    anchorIsCollapse,
    packetHasHumiliationAnchor,
    anchorIsHumiliation,
    packetHasHypeAnchor,
    anchorIsHype,
    packetHasThreatAnchor,
    anchorIsThreat,
    packetHasClutchAnchor,
    anchorIsClutch,
    packetHasWarningAnchor,
    anchorIsWarning,
    packetHasReceiptAnchor,
    anchorIsReceipt,
    packetHasRivalryAnchor,
    anchorIsRivalry,
    packetHasNegotiationAnchor,
    anchorIsNegotiation,
    packetHasVowAnchor,
    anchorIsVow,
    packetHasAllianceAnchor,
    anchorIsAlliance,
    packetHasSystemMarkerAnchor,
    anchorIsSystemMarker,
    requestMatchesPressureCritical,
    requestMatchesPressureBreakpoint,
    requestMatchesPressureCollapse,
    requestMatchesPressureHigh,
    requestMatchesPressureElevated,
    requestMatchesPressureVolatile,
    requestMatchesPressureReset,
    requestMatchesPressureCalm,
    requestMatchesEmotionFrustrated,
    requestMatchesEmotionDesperate,
    requestMatchesEmotionEmbarrassed,
    requestMatchesEmotionAngry,
    requestMatchesEmotionAnxious,
    requestMatchesEmotionHaunted,
    requestMatchesEmotionHopeful,
    requestMatchesEmotionTriumphant,
    requestMatchesEmotionCold,
    requestMatchesEmotionCalm,
    requestMatchesAudienceHigh,
    requestMatchesAudienceCritical,
    requestMatchesAudienceMob,
    requestMatchesAudienceVolatile,
    requestMatchesAudienceHot,
    requestMatchesAudienceCalm,
    requestMatchesRelationshipAlly,
    requestMatchesRelationshipRival,
    requestMatchesRelationshipDistrust,
    requestMatchesRelationshipMentor,
    requestMatchesRelationshipHunted,
    requestMatchesRelationshipFascinated,
    requestMatchesRelationshipBroken,
    getRetrievalContextAnchorIds,
    getRetrievalContextAnchorKinds,
    getRetrievalContextAnchorHeadlines,
    getRetrievalContextAnchorScores,
    getRetrievalContextAnchorSalience,
    getRetrievalContextDocumentIds,
    getRetrievalContextDocumentScores,
    getRetrievalContextCallbackPhrases,
    getRetrievalContextRestraintFlags,
    getRetrievalContextTacticalNotes,
    getRetrievalContextDebugNotes,
    getAnchorById,
    getDocumentById,
    getPromptBlockByKey,
    listPromptBlockKeys,
    flattenPromptBlockLines,
    renderPromptBlock,
    renderPromptBlocks,
    collectAllAnchorTags,
    collectAllAnchorEmotions,
    collectAllRelationshipRefs,
    collectAllQuoteRefs,
    averageAnchorScore,
    averageAnchorSalience,
    averageDocumentScore,
    highestAnchorScore,
    highestDocumentScore,
    countAnchorsByKind,
    countPromptBlocksByKey,
    countDocumentsBySourceKind,
    selectAnchorsByMinimumScore,
    selectDocumentsByMinimumScore,
    selectAnchorsByPriority,
    selectAnchorsByStabilityClass,
    selectDocumentsByPurpose,
    selectAnchorsByTag,
    selectAnchorsByEmotion,
    selectAnchorsByRelationshipRef,
    selectAnchorsByQuoteRef,
    packetUsesCallbackPhrase,
    packetUsesRestraintFlag,
    packetUsesTacticalNote,
    packetHasPromptBlockKey,
    packetHasDiagnosticPrefix,
    summarizeAnchor,
    summarizeDocument,
    summarizePacketTopline,
    selectMostActionableCallback,
    computeCallbackActionability,
    getRescueAnchors,
    countRescueAnchors,
    getLegendAnchors,
    countLegendAnchors,
    getQuoteReversalAnchors,
    countQuoteReversalAnchors,
    getDealroomExposureAnchors,
    countDealroomExposureAnchors,
    getWorldEventAnchors,
    countWorldEventAnchors,
    getPromiseAnchors,
    countPromiseAnchors,
    getBetrayalAnchors,
    countBetrayalAnchors,
    getComebackAnchors,
    countComebackAnchors,
    getCollapseAnchors,
    countCollapseAnchors,
    getHumiliationAnchors,
    countHumiliationAnchors,
    getHypeAnchors,
    countHypeAnchors,
    getThreatAnchors,
    countThreatAnchors,
    getClutchAnchors,
    countClutchAnchors,
    getWarningAnchors,
    countWarningAnchors,
    getReceiptAnchors,
    countReceiptAnchors,
    getRivalryAnchors,
    countRivalryAnchors,
    getNegotiationAnchors,
    countNegotiationAnchors,
    getVowAnchors,
    countVowAnchors,
    getAllianceAnchors,
    countAllianceAnchors,
    getSystemMarkerAnchors,
    countSystemMarkerAnchors,
    packetSuggestsPressureCritical,
    requestSuggestsPressureCritical,
    packetSuggestsPressureBreakpoint,
    requestSuggestsPressureBreakpoint,
    packetSuggestsPressureCollapse,
    requestSuggestsPressureCollapse,
    packetSuggestsPressureHigh,
    requestSuggestsPressureHigh,
    packetSuggestsPressureElevated,
    requestSuggestsPressureElevated,
    packetSuggestsPressureVolatile,
    requestSuggestsPressureVolatile,
    packetSuggestsPressureReset,
    requestSuggestsPressureReset,
    packetSuggestsPressureCalm,
    requestSuggestsPressureCalm,
    packetSuggestsEmotionFrustrated,
    requestSuggestsEmotionFrustrated,
    packetSuggestsEmotionDesperate,
    requestSuggestsEmotionDesperate,
    packetSuggestsEmotionEmbarrassed,
    requestSuggestsEmotionEmbarrassed,
    packetSuggestsEmotionAngry,
    requestSuggestsEmotionAngry,
    packetSuggestsEmotionAnxious,
    requestSuggestsEmotionAnxious,
    packetSuggestsEmotionHaunted,
    requestSuggestsEmotionHaunted,
    packetSuggestsEmotionHopeful,
    requestSuggestsEmotionHopeful,
    packetSuggestsEmotionTriumphant,
    requestSuggestsEmotionTriumphant,
    packetSuggestsEmotionCold,
    requestSuggestsEmotionCold,
    packetSuggestsEmotionCalm,
    requestSuggestsEmotionCalm,
    packetSuggestsAudienceHigh,
    requestSuggestsAudienceHigh,
    packetSuggestsAudienceCritical,
    requestSuggestsAudienceCritical,
    packetSuggestsAudienceMob,
    requestSuggestsAudienceMob,
    packetSuggestsAudienceVolatile,
    requestSuggestsAudienceVolatile,
    packetSuggestsAudienceHot,
    requestSuggestsAudienceHot,
    packetSuggestsAudienceCalm,
    requestSuggestsAudienceCalm,
    packetSuggestsRelationshipAlly,
    requestSuggestsRelationshipAlly,
    packetSuggestsRelationshipRival,
    requestSuggestsRelationshipRival,
    packetSuggestsRelationshipDistrust,
    requestSuggestsRelationshipDistrust,
    packetSuggestsRelationshipMentor,
    requestSuggestsRelationshipMentor,
    packetSuggestsRelationshipHunted,
    requestSuggestsRelationshipHunted,
    packetSuggestsRelationshipFascinated,
    requestSuggestsRelationshipFascinated,
    packetSuggestsRelationshipBroken,
    requestSuggestsRelationshipBroken,
    packetScoreProfile,
    packetDensityProfile,
    packetQualityGate,
    packetNarrativeProfile,
    packetSortingView
} as const);

export const BACKEND_CHAT_INTELLIGENCE_DL_UTILITY_NAMESPACES = Object.freeze({
  legacyEmbedding: BACKEND_CHAT_INTELLIGENCE_LEGACY_EMBEDDING_UTILITIES,
  legacyIntent: BACKEND_CHAT_INTELLIGENCE_LEGACY_INTENT_UTILITIES,
  legacyConversationMemory: BACKEND_CHAT_INTELLIGENCE_LEGACY_CONVERSATION_MEMORY_UTILITIES,
  legacyResponseRanking: BACKEND_CHAT_INTELLIGENCE_LEGACY_RESPONSE_RANKING_UTILITIES,
  memoryRanking: BACKEND_CHAT_INTELLIGENCE_MEMORY_RANKING_UTILITIES,
  retrievalContext: BACKEND_CHAT_INTELLIGENCE_RETRIEVAL_CONTEXT_UTILITIES,
} as const);

export const BACKEND_CHAT_INTELLIGENCE_DL_HELPER_SURFACE = Object.freeze([
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'LEGACY_EMBEDDING.createMessageEmbeddingClient',
    owner: 'LEGACY_EMBEDDING',
    category: 'FACTORY',
    callableName: 'createMessageEmbeddingClient',
    relativePath: '../../dl/MessageEmbeddingClient',
    description: 'createMessageEmbeddingClient surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'LEGACY_EMBEDDING.embedAuthoritativeChatMessage',
    owner: 'LEGACY_EMBEDDING',
    category: 'OPERATION',
    callableName: 'embedAuthoritativeChatMessage',
    relativePath: '../../dl/MessageEmbeddingClient',
    description: 'embedAuthoritativeChatMessage surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'LEGACY_EMBEDDING.embedAuthoritativeTranscriptWindow',
    owner: 'LEGACY_EMBEDDING',
    category: 'OPERATION',
    callableName: 'embedAuthoritativeTranscriptWindow',
    relativePath: '../../dl/MessageEmbeddingClient',
    description: 'embedAuthoritativeTranscriptWindow surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'LEGACY_EMBEDDING.computeEmbeddingSimilarity',
    owner: 'LEGACY_EMBEDDING',
    category: 'UTILITY',
    callableName: 'computeEmbeddingSimilarity',
    relativePath: '../../dl/MessageEmbeddingClient',
    description: 'computeEmbeddingSimilarity surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'LEGACY_INTENT.createDialogueIntentEncoder',
    owner: 'LEGACY_INTENT',
    category: 'FACTORY',
    callableName: 'createDialogueIntentEncoder',
    relativePath: '../../dl/DialogueIntentEncoder',
    description: 'createDialogueIntentEncoder surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'LEGACY_INTENT.encodeDialogueIntentTurn',
    owner: 'LEGACY_INTENT',
    category: 'OPERATION',
    callableName: 'encodeDialogueIntentTurn',
    relativePath: '../../dl/DialogueIntentEncoder',
    description: 'encodeDialogueIntentTurn surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'LEGACY_INTENT.encodeDialogueIntentSequence',
    owner: 'LEGACY_INTENT',
    category: 'OPERATION',
    callableName: 'encodeDialogueIntentSequence',
    relativePath: '../../dl/DialogueIntentEncoder',
    description: 'encodeDialogueIntentSequence surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'LEGACY_CONVERSATION_MEMORY.createConversationMemoryModel',
    owner: 'LEGACY_CONVERSATION_MEMORY',
    category: 'FACTORY',
    callableName: 'createConversationMemoryModel',
    relativePath: '../../dl/ConversationMemoryModel',
    description: 'createConversationMemoryModel surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'LEGACY_CONVERSATION_MEMORY.ingestBackendChatMemoryTurn',
    owner: 'LEGACY_CONVERSATION_MEMORY',
    category: 'OPERATION',
    callableName: 'ingestBackendChatMemoryTurn',
    relativePath: '../../dl/ConversationMemoryModel',
    description: 'ingestBackendChatMemoryTurn surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'LEGACY_CONVERSATION_MEMORY.retrieveBackendConversationMemories',
    owner: 'LEGACY_CONVERSATION_MEMORY',
    category: 'OPERATION',
    callableName: 'retrieveBackendConversationMemories',
    relativePath: '../../dl/ConversationMemoryModel',
    description: 'retrieveBackendConversationMemories surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'LEGACY_RESPONSE_RANKING.createResponseRankingModel',
    owner: 'LEGACY_RESPONSE_RANKING',
    category: 'FACTORY',
    callableName: 'createResponseRankingModel',
    relativePath: '../../dl/ResponseRankingModel',
    description: 'createResponseRankingModel surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'LEGACY_RESPONSE_RANKING.rankBackendChatResponseCandidates',
    owner: 'LEGACY_RESPONSE_RANKING',
    category: 'OPERATION',
    callableName: 'rankBackendChatResponseCandidates',
    relativePath: '../../dl/ResponseRankingModel',
    description: 'rankBackendChatResponseCandidates surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'LEGACY_RESPONSE_RANKING.rankBackendChatHelperCandidates',
    owner: 'LEGACY_RESPONSE_RANKING',
    category: 'OPERATION',
    callableName: 'rankBackendChatHelperCandidates',
    relativePath: '../../dl/ResponseRankingModel',
    description: 'rankBackendChatHelperCandidates surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'LEGACY_RESPONSE_RANKING.rankBackendChatHaterCandidates',
    owner: 'LEGACY_RESPONSE_RANKING',
    category: 'OPERATION',
    callableName: 'rankBackendChatHaterCandidates',
    relativePath: '../../dl/ResponseRankingModel',
    description: 'rankBackendChatHaterCandidates surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_RANKING.createMemoryRankingPolicy',
    owner: 'RETRIEVAL_RANKING',
    category: 'FACTORY',
    callableName: 'createMemoryRankingPolicy',
    relativePath: './MemoryRankingPolicy',
    description: 'createMemoryRankingPolicy surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_RANKING.buildMemoryRankingQueryFromContext',
    owner: 'RETRIEVAL_RANKING',
    category: 'FACTORY',
    callableName: 'buildMemoryRankingQueryFromContext',
    relativePath: './MemoryRankingPolicy',
    description: 'buildMemoryRankingQueryFromContext surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_RANKING.createCanonicalBaselineMatches',
    owner: 'RETRIEVAL_RANKING',
    category: 'FACTORY',
    callableName: 'createCanonicalBaselineMatches',
    relativePath: './MemoryRankingPolicy',
    description: 'createCanonicalBaselineMatches surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_RANKING.summarizeMemoryRankingResult',
    owner: 'RETRIEVAL_RANKING',
    category: 'SUMMARY',
    callableName: 'summarizeMemoryRankingResult',
    relativePath: './MemoryRankingPolicy',
    description: 'summarizeMemoryRankingResult surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_RANKING.explainMemoryRankingTrace',
    owner: 'RETRIEVAL_RANKING',
    category: 'EXPLAIN',
    callableName: 'explainMemoryRankingTrace',
    relativePath: './MemoryRankingPolicy',
    description: 'explainMemoryRankingTrace surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_RANKING.explainRankedAnchor',
    owner: 'RETRIEVAL_RANKING',
    category: 'EXPLAIN',
    callableName: 'explainRankedAnchor',
    relativePath: './MemoryRankingPolicy',
    description: 'explainRankedAnchor surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_RANKING.createMemoryRankingCandidate',
    owner: 'RETRIEVAL_RANKING',
    category: 'FACTORY',
    callableName: 'createMemoryRankingCandidate',
    relativePath: './MemoryRankingPolicy',
    description: 'createMemoryRankingCandidate surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_RANKING.groupRankedAnchorsByFamily',
    owner: 'RETRIEVAL_RANKING',
    category: 'COLLECTION',
    callableName: 'groupRankedAnchorsByFamily',
    relativePath: './MemoryRankingPolicy',
    description: 'groupRankedAnchorsByFamily surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.createRetrievalContextBuilder',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'FACTORY',
    callableName: 'createRetrievalContextBuilder',
    relativePath: './RetrievalContextBuilder',
    description: 'createRetrievalContextBuilder surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.summarizeRetrievalContextPacket',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SUMMARY',
    callableName: 'summarizeRetrievalContextPacket',
    relativePath: './RetrievalContextBuilder',
    description: 'summarizeRetrievalContextPacket surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.hasAnyAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'hasAnyAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'hasAnyAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.hasAnyDocuments',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'hasAnyDocuments',
    relativePath: './RetrievalContextBuilder',
    description: 'hasAnyDocuments surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.hasAnyCallbacks',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'hasAnyCallbacks',
    relativePath: './RetrievalContextBuilder',
    description: 'hasAnyCallbacks surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.hasAnyRestraints',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'hasAnyRestraints',
    relativePath: './RetrievalContextBuilder',
    description: 'hasAnyRestraints surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.hasAnyTacticalNotes',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'hasAnyTacticalNotes',
    relativePath: './RetrievalContextBuilder',
    description: 'hasAnyTacticalNotes surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getTopAnchor',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getTopAnchor',
    relativePath: './RetrievalContextBuilder',
    description: 'getTopAnchor surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getTopDocument',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getTopDocument',
    relativePath: './RetrievalContextBuilder',
    description: 'getTopDocument surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getTopCallback',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getTopCallback',
    relativePath: './RetrievalContextBuilder',
    description: 'getTopCallback surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getTopPromptBlock',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getTopPromptBlock',
    relativePath: './RetrievalContextBuilder',
    description: 'getTopPromptBlock surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.retrievalContextIsBotResponse',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'retrievalContextIsBotResponse',
    relativePath: './RetrievalContextBuilder',
    description: 'retrievalContextIsBotResponse surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestIsBotResponse',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestIsBotResponse',
    relativePath: './RetrievalContextBuilder',
    description: 'requestIsBotResponse surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.retrievalContextIsHelperIntervention',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'retrievalContextIsHelperIntervention',
    relativePath: './RetrievalContextBuilder',
    description: 'retrievalContextIsHelperIntervention surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestIsHelperIntervention',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestIsHelperIntervention',
    relativePath: './RetrievalContextBuilder',
    description: 'requestIsHelperIntervention surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.retrievalContextIsHaterTaunt',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'retrievalContextIsHaterTaunt',
    relativePath: './RetrievalContextBuilder',
    description: 'retrievalContextIsHaterTaunt surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestIsHaterTaunt',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestIsHaterTaunt',
    relativePath: './RetrievalContextBuilder',
    description: 'requestIsHaterTaunt surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.retrievalContextIsDealroomCounter',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'retrievalContextIsDealroomCounter',
    relativePath: './RetrievalContextBuilder',
    description: 'retrievalContextIsDealroomCounter surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestIsDealroomCounter',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestIsDealroomCounter',
    relativePath: './RetrievalContextBuilder',
    description: 'requestIsDealroomCounter surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.retrievalContextIsPostrunNarration',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'retrievalContextIsPostrunNarration',
    relativePath: './RetrievalContextBuilder',
    description: 'retrievalContextIsPostrunNarration surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestIsPostrunNarration',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestIsPostrunNarration',
    relativePath: './RetrievalContextBuilder',
    description: 'requestIsPostrunNarration surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.retrievalContextIsScenePlanning',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'retrievalContextIsScenePlanning',
    relativePath: './RetrievalContextBuilder',
    description: 'retrievalContextIsScenePlanning surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestIsScenePlanning',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestIsScenePlanning',
    relativePath: './RetrievalContextBuilder',
    description: 'requestIsScenePlanning surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.retrievalContextIsLiveopsOverlay',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'retrievalContextIsLiveopsOverlay',
    relativePath: './RetrievalContextBuilder',
    description: 'retrievalContextIsLiveopsOverlay surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestIsLiveopsOverlay',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestIsLiveopsOverlay',
    relativePath: './RetrievalContextBuilder',
    description: 'requestIsLiveopsOverlay surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetHasRescueAnchor',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetHasRescueAnchor',
    relativePath: './RetrievalContextBuilder',
    description: 'packetHasRescueAnchor surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.anchorIsRescue',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'anchorIsRescue',
    relativePath: './RetrievalContextBuilder',
    description: 'anchorIsRescue surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetHasLegendAnchor',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetHasLegendAnchor',
    relativePath: './RetrievalContextBuilder',
    description: 'packetHasLegendAnchor surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.anchorIsLegend',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'anchorIsLegend',
    relativePath: './RetrievalContextBuilder',
    description: 'anchorIsLegend surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetHasQuoteReversalAnchor',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetHasQuoteReversalAnchor',
    relativePath: './RetrievalContextBuilder',
    description: 'packetHasQuoteReversalAnchor surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.anchorIsQuoteReversal',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'anchorIsQuoteReversal',
    relativePath: './RetrievalContextBuilder',
    description: 'anchorIsQuoteReversal surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetHasDealroomExposureAnchor',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetHasDealroomExposureAnchor',
    relativePath: './RetrievalContextBuilder',
    description: 'packetHasDealroomExposureAnchor surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.anchorIsDealroomExposure',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'anchorIsDealroomExposure',
    relativePath: './RetrievalContextBuilder',
    description: 'anchorIsDealroomExposure surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetHasWorldEventAnchor',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetHasWorldEventAnchor',
    relativePath: './RetrievalContextBuilder',
    description: 'packetHasWorldEventAnchor surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.anchorIsWorldEvent',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'anchorIsWorldEvent',
    relativePath: './RetrievalContextBuilder',
    description: 'anchorIsWorldEvent surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetHasPromiseAnchor',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetHasPromiseAnchor',
    relativePath: './RetrievalContextBuilder',
    description: 'packetHasPromiseAnchor surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.anchorIsPromise',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'anchorIsPromise',
    relativePath: './RetrievalContextBuilder',
    description: 'anchorIsPromise surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetHasBetrayalAnchor',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetHasBetrayalAnchor',
    relativePath: './RetrievalContextBuilder',
    description: 'packetHasBetrayalAnchor surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.anchorIsBetrayal',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'anchorIsBetrayal',
    relativePath: './RetrievalContextBuilder',
    description: 'anchorIsBetrayal surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetHasComebackAnchor',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetHasComebackAnchor',
    relativePath: './RetrievalContextBuilder',
    description: 'packetHasComebackAnchor surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.anchorIsComeback',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'anchorIsComeback',
    relativePath: './RetrievalContextBuilder',
    description: 'anchorIsComeback surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetHasCollapseAnchor',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetHasCollapseAnchor',
    relativePath: './RetrievalContextBuilder',
    description: 'packetHasCollapseAnchor surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.anchorIsCollapse',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'anchorIsCollapse',
    relativePath: './RetrievalContextBuilder',
    description: 'anchorIsCollapse surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetHasHumiliationAnchor',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetHasHumiliationAnchor',
    relativePath: './RetrievalContextBuilder',
    description: 'packetHasHumiliationAnchor surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.anchorIsHumiliation',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'anchorIsHumiliation',
    relativePath: './RetrievalContextBuilder',
    description: 'anchorIsHumiliation surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetHasHypeAnchor',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetHasHypeAnchor',
    relativePath: './RetrievalContextBuilder',
    description: 'packetHasHypeAnchor surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.anchorIsHype',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'anchorIsHype',
    relativePath: './RetrievalContextBuilder',
    description: 'anchorIsHype surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetHasThreatAnchor',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetHasThreatAnchor',
    relativePath: './RetrievalContextBuilder',
    description: 'packetHasThreatAnchor surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.anchorIsThreat',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'anchorIsThreat',
    relativePath: './RetrievalContextBuilder',
    description: 'anchorIsThreat surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetHasClutchAnchor',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetHasClutchAnchor',
    relativePath: './RetrievalContextBuilder',
    description: 'packetHasClutchAnchor surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.anchorIsClutch',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'anchorIsClutch',
    relativePath: './RetrievalContextBuilder',
    description: 'anchorIsClutch surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetHasWarningAnchor',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetHasWarningAnchor',
    relativePath: './RetrievalContextBuilder',
    description: 'packetHasWarningAnchor surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.anchorIsWarning',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'anchorIsWarning',
    relativePath: './RetrievalContextBuilder',
    description: 'anchorIsWarning surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetHasReceiptAnchor',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetHasReceiptAnchor',
    relativePath: './RetrievalContextBuilder',
    description: 'packetHasReceiptAnchor surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.anchorIsReceipt',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'anchorIsReceipt',
    relativePath: './RetrievalContextBuilder',
    description: 'anchorIsReceipt surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetHasRivalryAnchor',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetHasRivalryAnchor',
    relativePath: './RetrievalContextBuilder',
    description: 'packetHasRivalryAnchor surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.anchorIsRivalry',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'anchorIsRivalry',
    relativePath: './RetrievalContextBuilder',
    description: 'anchorIsRivalry surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetHasNegotiationAnchor',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetHasNegotiationAnchor',
    relativePath: './RetrievalContextBuilder',
    description: 'packetHasNegotiationAnchor surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.anchorIsNegotiation',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'anchorIsNegotiation',
    relativePath: './RetrievalContextBuilder',
    description: 'anchorIsNegotiation surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetHasVowAnchor',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetHasVowAnchor',
    relativePath: './RetrievalContextBuilder',
    description: 'packetHasVowAnchor surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.anchorIsVow',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'anchorIsVow',
    relativePath: './RetrievalContextBuilder',
    description: 'anchorIsVow surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetHasAllianceAnchor',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetHasAllianceAnchor',
    relativePath: './RetrievalContextBuilder',
    description: 'packetHasAllianceAnchor surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.anchorIsAlliance',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'anchorIsAlliance',
    relativePath: './RetrievalContextBuilder',
    description: 'anchorIsAlliance surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetHasSystemMarkerAnchor',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetHasSystemMarkerAnchor',
    relativePath: './RetrievalContextBuilder',
    description: 'packetHasSystemMarkerAnchor surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.anchorIsSystemMarker',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'anchorIsSystemMarker',
    relativePath: './RetrievalContextBuilder',
    description: 'anchorIsSystemMarker surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesPressureCritical',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesPressureCritical',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesPressureCritical surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesPressureBreakpoint',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesPressureBreakpoint',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesPressureBreakpoint surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesPressureCollapse',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesPressureCollapse',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesPressureCollapse surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesPressureHigh',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesPressureHigh',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesPressureHigh surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesPressureElevated',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesPressureElevated',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesPressureElevated surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesPressureVolatile',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesPressureVolatile',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesPressureVolatile surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesPressureReset',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesPressureReset',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesPressureReset surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesPressureCalm',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesPressureCalm',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesPressureCalm surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesEmotionFrustrated',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesEmotionFrustrated',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesEmotionFrustrated surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesEmotionDesperate',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesEmotionDesperate',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesEmotionDesperate surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesEmotionEmbarrassed',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesEmotionEmbarrassed',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesEmotionEmbarrassed surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesEmotionAngry',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesEmotionAngry',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesEmotionAngry surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesEmotionAnxious',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesEmotionAnxious',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesEmotionAnxious surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesEmotionHaunted',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesEmotionHaunted',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesEmotionHaunted surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesEmotionHopeful',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesEmotionHopeful',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesEmotionHopeful surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesEmotionTriumphant',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesEmotionTriumphant',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesEmotionTriumphant surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesEmotionCold',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesEmotionCold',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesEmotionCold surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesEmotionCalm',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesEmotionCalm',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesEmotionCalm surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesAudienceHigh',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesAudienceHigh',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesAudienceHigh surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesAudienceCritical',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesAudienceCritical',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesAudienceCritical surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesAudienceMob',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesAudienceMob',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesAudienceMob surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesAudienceVolatile',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesAudienceVolatile',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesAudienceVolatile surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesAudienceHot',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesAudienceHot',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesAudienceHot surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesAudienceCalm',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesAudienceCalm',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesAudienceCalm surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesRelationshipAlly',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesRelationshipAlly',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesRelationshipAlly surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesRelationshipRival',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesRelationshipRival',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesRelationshipRival surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesRelationshipDistrust',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesRelationshipDistrust',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesRelationshipDistrust surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesRelationshipMentor',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesRelationshipMentor',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesRelationshipMentor surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesRelationshipHunted',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesRelationshipHunted',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesRelationshipHunted surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesRelationshipFascinated',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesRelationshipFascinated',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesRelationshipFascinated surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestMatchesRelationshipBroken',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestMatchesRelationshipBroken',
    relativePath: './RetrievalContextBuilder',
    description: 'requestMatchesRelationshipBroken surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getRetrievalContextAnchorIds',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getRetrievalContextAnchorIds',
    relativePath: './RetrievalContextBuilder',
    description: 'getRetrievalContextAnchorIds surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getRetrievalContextAnchorKinds',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getRetrievalContextAnchorKinds',
    relativePath: './RetrievalContextBuilder',
    description: 'getRetrievalContextAnchorKinds surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getRetrievalContextAnchorHeadlines',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getRetrievalContextAnchorHeadlines',
    relativePath: './RetrievalContextBuilder',
    description: 'getRetrievalContextAnchorHeadlines surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getRetrievalContextAnchorScores',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getRetrievalContextAnchorScores',
    relativePath: './RetrievalContextBuilder',
    description: 'getRetrievalContextAnchorScores surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getRetrievalContextAnchorSalience',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getRetrievalContextAnchorSalience',
    relativePath: './RetrievalContextBuilder',
    description: 'getRetrievalContextAnchorSalience surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getRetrievalContextDocumentIds',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getRetrievalContextDocumentIds',
    relativePath: './RetrievalContextBuilder',
    description: 'getRetrievalContextDocumentIds surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getRetrievalContextDocumentScores',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getRetrievalContextDocumentScores',
    relativePath: './RetrievalContextBuilder',
    description: 'getRetrievalContextDocumentScores surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getRetrievalContextCallbackPhrases',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getRetrievalContextCallbackPhrases',
    relativePath: './RetrievalContextBuilder',
    description: 'getRetrievalContextCallbackPhrases surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getRetrievalContextRestraintFlags',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getRetrievalContextRestraintFlags',
    relativePath: './RetrievalContextBuilder',
    description: 'getRetrievalContextRestraintFlags surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getRetrievalContextTacticalNotes',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getRetrievalContextTacticalNotes',
    relativePath: './RetrievalContextBuilder',
    description: 'getRetrievalContextTacticalNotes surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getRetrievalContextDebugNotes',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getRetrievalContextDebugNotes',
    relativePath: './RetrievalContextBuilder',
    description: 'getRetrievalContextDebugNotes surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getAnchorById',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getAnchorById',
    relativePath: './RetrievalContextBuilder',
    description: 'getAnchorById surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getDocumentById',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getDocumentById',
    relativePath: './RetrievalContextBuilder',
    description: 'getDocumentById surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getPromptBlockByKey',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getPromptBlockByKey',
    relativePath: './RetrievalContextBuilder',
    description: 'getPromptBlockByKey surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.listPromptBlockKeys',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'COLLECTION',
    callableName: 'listPromptBlockKeys',
    relativePath: './RetrievalContextBuilder',
    description: 'listPromptBlockKeys surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.flattenPromptBlockLines',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'COLLECTION',
    callableName: 'flattenPromptBlockLines',
    relativePath: './RetrievalContextBuilder',
    description: 'flattenPromptBlockLines surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.renderPromptBlock',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'RENDER',
    callableName: 'renderPromptBlock',
    relativePath: './RetrievalContextBuilder',
    description: 'renderPromptBlock surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.renderPromptBlocks',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'RENDER',
    callableName: 'renderPromptBlocks',
    relativePath: './RetrievalContextBuilder',
    description: 'renderPromptBlocks surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.collectAllAnchorTags',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'COLLECTION',
    callableName: 'collectAllAnchorTags',
    relativePath: './RetrievalContextBuilder',
    description: 'collectAllAnchorTags surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.collectAllAnchorEmotions',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'COLLECTION',
    callableName: 'collectAllAnchorEmotions',
    relativePath: './RetrievalContextBuilder',
    description: 'collectAllAnchorEmotions surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.collectAllRelationshipRefs',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'COLLECTION',
    callableName: 'collectAllRelationshipRefs',
    relativePath: './RetrievalContextBuilder',
    description: 'collectAllRelationshipRefs surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.collectAllQuoteRefs',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'COLLECTION',
    callableName: 'collectAllQuoteRefs',
    relativePath: './RetrievalContextBuilder',
    description: 'collectAllQuoteRefs surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.averageAnchorScore',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'UTILITY',
    callableName: 'averageAnchorScore',
    relativePath: './RetrievalContextBuilder',
    description: 'averageAnchorScore surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.averageAnchorSalience',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'UTILITY',
    callableName: 'averageAnchorSalience',
    relativePath: './RetrievalContextBuilder',
    description: 'averageAnchorSalience surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.averageDocumentScore',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'UTILITY',
    callableName: 'averageDocumentScore',
    relativePath: './RetrievalContextBuilder',
    description: 'averageDocumentScore surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.highestAnchorScore',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'UTILITY',
    callableName: 'highestAnchorScore',
    relativePath: './RetrievalContextBuilder',
    description: 'highestAnchorScore surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.highestDocumentScore',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'UTILITY',
    callableName: 'highestDocumentScore',
    relativePath: './RetrievalContextBuilder',
    description: 'highestDocumentScore surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.countAnchorsByKind',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'countAnchorsByKind',
    relativePath: './RetrievalContextBuilder',
    description: 'countAnchorsByKind surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.countPromptBlocksByKey',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'countPromptBlocksByKey',
    relativePath: './RetrievalContextBuilder',
    description: 'countPromptBlocksByKey surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.countDocumentsBySourceKind',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'countDocumentsBySourceKind',
    relativePath: './RetrievalContextBuilder',
    description: 'countDocumentsBySourceKind surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.selectAnchorsByMinimumScore',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTION',
    callableName: 'selectAnchorsByMinimumScore',
    relativePath: './RetrievalContextBuilder',
    description: 'selectAnchorsByMinimumScore surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.selectDocumentsByMinimumScore',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTION',
    callableName: 'selectDocumentsByMinimumScore',
    relativePath: './RetrievalContextBuilder',
    description: 'selectDocumentsByMinimumScore surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.selectAnchorsByPriority',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTION',
    callableName: 'selectAnchorsByPriority',
    relativePath: './RetrievalContextBuilder',
    description: 'selectAnchorsByPriority surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.selectAnchorsByStabilityClass',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTION',
    callableName: 'selectAnchorsByStabilityClass',
    relativePath: './RetrievalContextBuilder',
    description: 'selectAnchorsByStabilityClass surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.selectDocumentsByPurpose',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTION',
    callableName: 'selectDocumentsByPurpose',
    relativePath: './RetrievalContextBuilder',
    description: 'selectDocumentsByPurpose surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.selectAnchorsByTag',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTION',
    callableName: 'selectAnchorsByTag',
    relativePath: './RetrievalContextBuilder',
    description: 'selectAnchorsByTag surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.selectAnchorsByEmotion',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTION',
    callableName: 'selectAnchorsByEmotion',
    relativePath: './RetrievalContextBuilder',
    description: 'selectAnchorsByEmotion surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.selectAnchorsByRelationshipRef',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTION',
    callableName: 'selectAnchorsByRelationshipRef',
    relativePath: './RetrievalContextBuilder',
    description: 'selectAnchorsByRelationshipRef surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.selectAnchorsByQuoteRef',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTION',
    callableName: 'selectAnchorsByQuoteRef',
    relativePath: './RetrievalContextBuilder',
    description: 'selectAnchorsByQuoteRef surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetUsesCallbackPhrase',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetUsesCallbackPhrase',
    relativePath: './RetrievalContextBuilder',
    description: 'packetUsesCallbackPhrase surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetUsesRestraintFlag',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetUsesRestraintFlag',
    relativePath: './RetrievalContextBuilder',
    description: 'packetUsesRestraintFlag surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetUsesTacticalNote',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetUsesTacticalNote',
    relativePath: './RetrievalContextBuilder',
    description: 'packetUsesTacticalNote surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetHasPromptBlockKey',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetHasPromptBlockKey',
    relativePath: './RetrievalContextBuilder',
    description: 'packetHasPromptBlockKey surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetHasDiagnosticPrefix',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetHasDiagnosticPrefix',
    relativePath: './RetrievalContextBuilder',
    description: 'packetHasDiagnosticPrefix surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.summarizeAnchor',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SUMMARY',
    callableName: 'summarizeAnchor',
    relativePath: './RetrievalContextBuilder',
    description: 'summarizeAnchor surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.summarizeDocument',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SUMMARY',
    callableName: 'summarizeDocument',
    relativePath: './RetrievalContextBuilder',
    description: 'summarizeDocument surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.summarizePacketTopline',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SUMMARY',
    callableName: 'summarizePacketTopline',
    relativePath: './RetrievalContextBuilder',
    description: 'summarizePacketTopline surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.selectMostActionableCallback',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTION',
    callableName: 'selectMostActionableCallback',
    relativePath: './RetrievalContextBuilder',
    description: 'selectMostActionableCallback surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.computeCallbackActionability',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'UTILITY',
    callableName: 'computeCallbackActionability',
    relativePath: './RetrievalContextBuilder',
    description: 'computeCallbackActionability surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getRescueAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getRescueAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'getRescueAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.countRescueAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'countRescueAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'countRescueAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getLegendAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getLegendAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'getLegendAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.countLegendAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'countLegendAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'countLegendAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getQuoteReversalAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getQuoteReversalAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'getQuoteReversalAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.countQuoteReversalAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'countQuoteReversalAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'countQuoteReversalAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getDealroomExposureAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getDealroomExposureAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'getDealroomExposureAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.countDealroomExposureAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'countDealroomExposureAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'countDealroomExposureAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getWorldEventAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getWorldEventAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'getWorldEventAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.countWorldEventAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'countWorldEventAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'countWorldEventAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getPromiseAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getPromiseAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'getPromiseAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.countPromiseAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'countPromiseAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'countPromiseAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getBetrayalAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getBetrayalAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'getBetrayalAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.countBetrayalAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'countBetrayalAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'countBetrayalAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getComebackAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getComebackAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'getComebackAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.countComebackAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'countComebackAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'countComebackAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getCollapseAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getCollapseAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'getCollapseAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.countCollapseAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'countCollapseAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'countCollapseAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getHumiliationAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getHumiliationAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'getHumiliationAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.countHumiliationAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'countHumiliationAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'countHumiliationAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getHypeAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getHypeAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'getHypeAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.countHypeAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'countHypeAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'countHypeAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getThreatAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getThreatAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'getThreatAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.countThreatAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'countThreatAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'countThreatAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getClutchAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getClutchAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'getClutchAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.countClutchAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'countClutchAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'countClutchAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getWarningAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getWarningAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'getWarningAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.countWarningAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'countWarningAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'countWarningAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getReceiptAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getReceiptAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'getReceiptAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.countReceiptAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'countReceiptAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'countReceiptAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getRivalryAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getRivalryAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'getRivalryAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.countRivalryAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'countRivalryAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'countRivalryAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getNegotiationAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getNegotiationAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'getNegotiationAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.countNegotiationAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'countNegotiationAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'countNegotiationAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getVowAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getVowAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'getVowAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.countVowAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'countVowAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'countVowAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getAllianceAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getAllianceAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'getAllianceAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.countAllianceAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'countAllianceAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'countAllianceAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.getSystemMarkerAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'getSystemMarkerAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'getSystemMarkerAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.countSystemMarkerAnchors',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'SELECTOR',
    callableName: 'countSystemMarkerAnchors',
    relativePath: './RetrievalContextBuilder',
    description: 'countSystemMarkerAnchors surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsPressureCritical',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsPressureCritical',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsPressureCritical surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsPressureCritical',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsPressureCritical',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsPressureCritical surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsPressureBreakpoint',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsPressureBreakpoint',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsPressureBreakpoint surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsPressureBreakpoint',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsPressureBreakpoint',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsPressureBreakpoint surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsPressureCollapse',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsPressureCollapse',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsPressureCollapse surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsPressureCollapse',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsPressureCollapse',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsPressureCollapse surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsPressureHigh',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsPressureHigh',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsPressureHigh surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsPressureHigh',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsPressureHigh',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsPressureHigh surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsPressureElevated',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsPressureElevated',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsPressureElevated surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsPressureElevated',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsPressureElevated',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsPressureElevated surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsPressureVolatile',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsPressureVolatile',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsPressureVolatile surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsPressureVolatile',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsPressureVolatile',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsPressureVolatile surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsPressureReset',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsPressureReset',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsPressureReset surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsPressureReset',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsPressureReset',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsPressureReset surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsPressureCalm',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsPressureCalm',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsPressureCalm surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsPressureCalm',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsPressureCalm',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsPressureCalm surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsEmotionFrustrated',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsEmotionFrustrated',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsEmotionFrustrated surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsEmotionFrustrated',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsEmotionFrustrated',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsEmotionFrustrated surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsEmotionDesperate',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsEmotionDesperate',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsEmotionDesperate surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsEmotionDesperate',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsEmotionDesperate',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsEmotionDesperate surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsEmotionEmbarrassed',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsEmotionEmbarrassed',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsEmotionEmbarrassed surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsEmotionEmbarrassed',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsEmotionEmbarrassed',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsEmotionEmbarrassed surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsEmotionAngry',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsEmotionAngry',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsEmotionAngry surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsEmotionAngry',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsEmotionAngry',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsEmotionAngry surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsEmotionAnxious',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsEmotionAnxious',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsEmotionAnxious surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsEmotionAnxious',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsEmotionAnxious',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsEmotionAnxious surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsEmotionHaunted',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsEmotionHaunted',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsEmotionHaunted surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsEmotionHaunted',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsEmotionHaunted',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsEmotionHaunted surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsEmotionHopeful',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsEmotionHopeful',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsEmotionHopeful surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsEmotionHopeful',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsEmotionHopeful',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsEmotionHopeful surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsEmotionTriumphant',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsEmotionTriumphant',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsEmotionTriumphant surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsEmotionTriumphant',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsEmotionTriumphant',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsEmotionTriumphant surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsEmotionCold',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsEmotionCold',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsEmotionCold surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsEmotionCold',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsEmotionCold',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsEmotionCold surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsEmotionCalm',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsEmotionCalm',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsEmotionCalm surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsEmotionCalm',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsEmotionCalm',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsEmotionCalm surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsAudienceHigh',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsAudienceHigh',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsAudienceHigh surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsAudienceHigh',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsAudienceHigh',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsAudienceHigh surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsAudienceCritical',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsAudienceCritical',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsAudienceCritical surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsAudienceCritical',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsAudienceCritical',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsAudienceCritical surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsAudienceMob',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsAudienceMob',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsAudienceMob surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsAudienceMob',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsAudienceMob',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsAudienceMob surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsAudienceVolatile',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsAudienceVolatile',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsAudienceVolatile surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsAudienceVolatile',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsAudienceVolatile',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsAudienceVolatile surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsAudienceHot',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsAudienceHot',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsAudienceHot surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsAudienceHot',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsAudienceHot',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsAudienceHot surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsAudienceCalm',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsAudienceCalm',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsAudienceCalm surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsAudienceCalm',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsAudienceCalm',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsAudienceCalm surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsRelationshipAlly',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsRelationshipAlly',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsRelationshipAlly surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsRelationshipAlly',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsRelationshipAlly',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsRelationshipAlly surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsRelationshipRival',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsRelationshipRival',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsRelationshipRival surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsRelationshipRival',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsRelationshipRival',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsRelationshipRival surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsRelationshipDistrust',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsRelationshipDistrust',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsRelationshipDistrust surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsRelationshipDistrust',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsRelationshipDistrust',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsRelationshipDistrust surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsRelationshipMentor',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsRelationshipMentor',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsRelationshipMentor surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsRelationshipMentor',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsRelationshipMentor',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsRelationshipMentor surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsRelationshipHunted',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsRelationshipHunted',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsRelationshipHunted surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsRelationshipHunted',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsRelationshipHunted',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsRelationshipHunted surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsRelationshipFascinated',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsRelationshipFascinated',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsRelationshipFascinated surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsRelationshipFascinated',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsRelationshipFascinated',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsRelationshipFascinated surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSuggestsRelationshipBroken',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'packetSuggestsRelationshipBroken',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSuggestsRelationshipBroken surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.requestSuggestsRelationshipBroken',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PREDICATE',
    callableName: 'requestSuggestsRelationshipBroken',
    relativePath: './RetrievalContextBuilder',
    description: 'requestSuggestsRelationshipBroken surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetScoreProfile',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PROFILE',
    callableName: 'packetScoreProfile',
    relativePath: './RetrievalContextBuilder',
    description: 'packetScoreProfile surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetDensityProfile',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PROFILE',
    callableName: 'packetDensityProfile',
    relativePath: './RetrievalContextBuilder',
    description: 'packetDensityProfile surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetQualityGate',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PROFILE',
    callableName: 'packetQualityGate',
    relativePath: './RetrievalContextBuilder',
    description: 'packetQualityGate surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetNarrativeProfile',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PROFILE',
    callableName: 'packetNarrativeProfile',
    relativePath: './RetrievalContextBuilder',
    description: 'packetNarrativeProfile surfaced through the backend chat intelligence barrel.',
  }),
  Object.freeze<BackendChatIntelligenceDlHelperSurfaceEntry>({
    id: 'RETRIEVAL_CONTEXT.packetSortingView',
    owner: 'RETRIEVAL_CONTEXT',
    category: 'PROFILE',
    callableName: 'packetSortingView',
    relativePath: './RetrievalContextBuilder',
    description: 'packetSortingView surfaced through the backend chat intelligence barrel.',
  })
] as const);

export type BackendChatIntelligenceMemoryAnchor = Parameters<MemoryAnchorStoreApi['upsert']>[0];
export type BackendChatIntelligenceAnchorProofBinding = Parameters<MemoryAnchorStoreApi['bindProof']>[1];
export type BackendChatIntelligenceBatchUpsertRequest = Parameters<MemoryAnchorStoreApi['batchUpsert']>[0];
export type BackendChatIntelligenceBatchUpsertResult = ReturnType<MemoryAnchorStoreApi['batchUpsert']>;
export type BackendChatIntelligenceMutationReceipt = ReturnType<MemoryAnchorStoreApi['upsert']>;
export type BackendChatIntelligenceMemoryWindowSeed = Parameters<MemoryAnchorStoreApi['openWindow']>[0];
export type BackendChatIntelligenceMemoryWindow = ReturnType<MemoryAnchorStoreApi['openWindow']>;
export type BackendChatIntelligenceMemoryStoreSnapshot = ReturnType<MemoryAnchorStoreApi['exportSnapshot']>;
export type BackendChatIntelligenceMemoryStoreMetrics = ReturnType<MemoryAnchorStoreApi['metrics']>;
export type BackendChatIntelligenceAnchorTelemetryPayload = ReturnType<MemoryAnchorStoreApi['exportTelemetry']>;
export type BackendChatIntelligenceMemoryAnchorId = Parameters<MemoryAnchorStoreApi['get']>[0];
export type BackendChatIntelligenceRelationshipEdge = NonNullable<ReturnType<MemoryAnchorStoreApi['getRelationshipEdge']>>;

// Full runtime and advanced wrappers
export interface BackendChatIntelligenceDlRuntime {
  readonly version: typeof BACKEND_CHAT_INTELLIGENCE_DL_VERSION;
  readonly surface: typeof BACKEND_CHAT_INTELLIGENCE_DL_SURFACE;
  readonly helperSurface: typeof BACKEND_CHAT_INTELLIGENCE_DL_HELPER_SURFACE;
  readonly versions: typeof BACKEND_CHAT_INTELLIGENCE_DL_VERSION_MAP;
  readonly laws: typeof BACKEND_CHAT_INTELLIGENCE_DL_RUNTIME_LAWS;
  readonly responseIntentPresets: typeof BACKEND_CHAT_INTELLIGENCE_RESPONSE_INTENT_PRESETS;
  readonly modeHints: typeof BACKEND_CHAT_INTELLIGENCE_MODE_HINTS;
  readonly utilities: typeof BACKEND_CHAT_INTELLIGENCE_DL_UTILITY_NAMESPACES;
  readonly embeddingClient: MessageEmbeddingClient;
  readonly intentEncoder: DialogueIntentEncoder;
  readonly conversationMemoryModel: ConversationMemoryModel;
  readonly responseRankingModel: ResponseRankingModel;
  readonly sequenceMemoryClient: SequenceMemoryClient;
  readonly memoryRankingPolicy: MemoryRankingPolicyApi;
  readonly memoryAnchorStore: MemoryAnchorStoreApi;
  readonly retrievalContextBuilder: RetrievalContextBuilderApi;
  health(): BackendChatIntelligenceDlRuntimeHealth;
  getSurfaceEntry(id: string): BackendChatIntelligenceDlSurfaceEntry | null;
  getHelperSurfaceEntry(id: string): BackendChatIntelligenceDlHelperSurfaceEntry | null;
  getConversationRuntimeDiagnostics(): Readonly<Record<string, unknown>>;
  decayConversationMemory(nowMs?: number): void;
  embedMessage(input: EmbeddingMessageInput): EmbeddingVector;
  embedTranscriptWindow(input: TranscriptWindowInput): EmbeddingVector;
  compareEmbeddings(a: EmbeddingVector, b: EmbeddingVector): SimilarityResult;
  encodeIntentTurn(input: DialogueIntentTurnInput): DialogueIntentResult;
  encodeIntentSequence(input: DialogueIntentSequenceInput): DialogueIntentSequenceResult;
  ingestAcceptedConversationTurn(turn: ConversationMemoryTurn, context: ConversationMemoryContext): ConversationMemoryRecord;
  retrieveConversationMemories(request: ConversationMemoryRetrievalRequest): ConversationMemoryRetrievalResult;
  rankCandidates(context: ResponseRankingContext, candidates: readonly ResponseRankingCandidateInput[]): ResponseRankingResult;
  rankHelperCandidates(context: ResponseRankingContext, candidates: readonly ResponseRankingCandidateInput[]): ResponseRankingResult;
  rankHaterCandidates(context: ResponseRankingContext, candidates: readonly ResponseRankingCandidateInput[]): ResponseRankingResult;
  rankSceneCandidates(context: ResponseRankingContext, candidates: readonly ResponseRankingCandidateInput[]): ResponseRankingResult;
  buildMemoryRankingQuery(context: MemoryRankingContext, options?: MemoryRankingPolicyOptions): ReturnType<typeof buildMemoryRankingQueryFromContext>;
  createMemoryRankingCandidate(anchor: BackendChatIntelligenceMemoryAnchor, partial?: Omit<Partial<MemoryRankingCandidate>, 'anchor'>): MemoryRankingCandidate;
  rankMemoryAnchors(candidates: readonly MemoryRankingCandidate[], context: MemoryRankingContext): MemoryRankingResult;
  summarizeMemoryRanking(result: MemoryRankingResult): readonly string[];
  explainMemoryRankingTrace(trace: MemoryRankingTrace): string;
  explainRankedMemoryAnchor(ranked: RankedMemoryAnchor): string;
  groupMemoryRankingByFamily(ranked: readonly RankedMemoryAnchor[]): Readonly<Record<string, readonly RankedMemoryAnchor[]>>;
  queryAnchors(request: MemoryAnchorStoreQueryRequest): MemoryAnchorQueryResponse;
  buildPresetRetrievalRequest(request: RetrievalContextBuildRequest): RetrievalContextBuildRequest;
  buildPresetRetrievalContext(request: RetrievalContextBuildRequest): RetrievalContextPacket;
  buildPresetRetrievalPrompt(request: RetrievalContextBuildRequest): string;
  auditRetrievalContext(packet: RetrievalContextPacket): BackendChatIntelligenceRetrievalPacketAudit;
}

export function createBackendChatIntelligenceDlRuntime(
  deps: BackendChatIntelligenceDlRuntimeDependencies = {},
): BackendChatIntelligenceDlRuntime {
  const sharedNow = deps.now ?? deps.sequenceMemoryDependencies?.now ?? defaultNow;
  const embeddingClient = deps.embeddingClient ?? createMessageEmbeddingClient({ ...(deps.embeddingClientOptions ?? {}), clock: createEmbeddingClock(sharedNow) });
  const intentEncoder = deps.intentEncoder ?? createDialogueIntentEncoder({ ...(deps.intentEncoderOptions ?? {}), embeddingClient, clock: createIntentClock(sharedNow) });
  const conversationMemoryModel = deps.conversationMemoryModel ?? createConversationMemoryModel({ ...(deps.conversationMemoryModelDependencies ?? {}), embeddingClient, intentEncoder, now: (() => sharedNow()) as unknown as NonNullable<ConversationMemoryModelDependencies['now']> });
  const responseRankingModel = deps.responseRankingModel ?? createResponseRankingModel({ ...(deps.responseRankingDependencies ?? {}), embeddingClient, intentEncoder, now: (() => sharedNow()) as unknown as NonNullable<ResponseRankingDependencyBundle['now']> });
  const sequenceMemoryClient = deps.sequenceMemoryClient ?? createSequenceMemoryClient(deps.sequenceMemoryConfig ?? {}, { ...(deps.sequenceMemoryDependencies ?? {}), now: deps.sequenceMemoryDependencies?.now ?? (sharedNow as unknown as NonNullable<SequenceMemoryClientDependencies['now']>) });
  const memoryRankingPolicy = deps.memoryRankingPolicy ?? createMemoryRankingPolicy(deps.memoryRankingPolicyOptions ?? {});
  const memoryAnchorStore = deps.memoryAnchorStore ?? createMemoryAnchorStore({ ...(deps.memoryAnchorStoreOptions ?? {}), rankingPolicy: memoryRankingPolicy, now: sharedNow });
  const retrievalContextBuilder = deps.retrievalContextBuilder ?? createRetrievalContextBuilder(memoryAnchorStore, deps.retrievalContextBuilderOptions ?? {});

  return Object.freeze<BackendChatIntelligenceDlRuntime>({
    version: BACKEND_CHAT_INTELLIGENCE_DL_VERSION,
    surface: BACKEND_CHAT_INTELLIGENCE_DL_SURFACE,
    helperSurface: BACKEND_CHAT_INTELLIGENCE_DL_HELPER_SURFACE,
    versions: BACKEND_CHAT_INTELLIGENCE_DL_VERSION_MAP,
    laws: BACKEND_CHAT_INTELLIGENCE_DL_RUNTIME_LAWS,
    responseIntentPresets: BACKEND_CHAT_INTELLIGENCE_RESPONSE_INTENT_PRESETS,
    modeHints: BACKEND_CHAT_INTELLIGENCE_MODE_HINTS,
    utilities: BACKEND_CHAT_INTELLIGENCE_DL_UTILITY_NAMESPACES,
    embeddingClient,
    intentEncoder,
    conversationMemoryModel,
    responseRankingModel,
    sequenceMemoryClient,
    memoryRankingPolicy,
    memoryAnchorStore,
    retrievalContextBuilder,
    health: () => createRuntimeHealth({ embeddingClient, intentEncoder, conversationMemoryModel, responseRankingModel, sequenceMemoryClient, memoryRankingPolicy, memoryAnchorStore, retrievalContextBuilder }),
    getSurfaceEntry: (id: string) => BACKEND_CHAT_INTELLIGENCE_DL_SURFACE.find((entry) => entry.id === id) ?? null,
    getHelperSurfaceEntry: (id: string) => BACKEND_CHAT_INTELLIGENCE_DL_HELPER_SURFACE.find((entry) => entry.id === id) ?? null,
    getConversationRuntimeDiagnostics: () => conversationMemoryModel.getRuntimeMemoryDiagnostics() as Readonly<Record<string, unknown>>,
    decayConversationMemory: (nowMs?: number) => conversationMemoryModel.decayAll(nowMs as never),
    embedMessage: (input) => embeddingClient.embedMessage(input),
    embedTranscriptWindow: (input) => embeddingClient.embedTranscriptWindow(input),
    compareEmbeddings: (a, b) => computeEmbeddingSimilarity(embeddingClient, a, b),
    encodeIntentTurn: (input) => intentEncoder.encodeTurn(input),
    encodeIntentSequence: (input) => intentEncoder.encodeSequence(input),
    ingestAcceptedConversationTurn: (turn, context) => conversationMemoryModel.ingestAcceptedTurn(turn, context),
    retrieveConversationMemories: (request) => conversationMemoryModel.retrieveRelevantMemories(request),
    rankCandidates: (context, candidates) => responseRankingModel.rankCandidates(context, candidates),
    rankHelperCandidates: (context, candidates) => responseRankingModel.rankHelperCandidates(context, candidates),
    rankHaterCandidates: (context, candidates) => responseRankingModel.rankHaterCandidates(context, candidates),
    rankSceneCandidates: (context, candidates) => responseRankingModel.rankSceneCandidates(context, candidates),
    buildMemoryRankingQuery: (context, options = {}) => buildMemoryRankingQueryFromContext(context, options),
    createMemoryRankingCandidate: (anchor, partial = {}) => createMemoryRankingCandidate(anchor, partial),
    rankMemoryAnchors: (candidates, context) => memoryRankingPolicy.rank(candidates, context),
    summarizeMemoryRanking: (result) => summarizeMemoryRankingResult(result),
    explainMemoryRankingTrace: (trace) => explainMemoryRankingTrace(trace),
    explainRankedMemoryAnchor: (ranked) => explainRankedAnchor(ranked),
    groupMemoryRankingByFamily: (ranked) => groupRankedAnchorsByFamily(ranked),
    queryAnchors: (request) => memoryAnchorStore.query(request),
    buildPresetRetrievalRequest: (request) => applyRetrievalPreset(request),
    buildPresetRetrievalContext: (request) => retrievalContextBuilder.build(applyRetrievalPreset(request)),
    buildPresetRetrievalPrompt: (request) => retrievalContextBuilder.toPrompt(retrievalContextBuilder.build(applyRetrievalPreset(request))),
    auditRetrievalContext: (packet) => createRetrievalAudit(packet),
  });
}

export function createBackendChatIntelligenceRetrievalRuntime(
  deps: Pick<BackendChatIntelligenceDlRuntimeDependencies, 'now' | 'memoryRankingPolicy' | 'memoryRankingPolicyOptions' | 'memoryAnchorStore' | 'memoryAnchorStoreOptions' | 'retrievalContextBuilder' | 'retrievalContextBuilderOptions'> = {},
): Pick<BackendChatIntelligenceDlRuntime, 'version' | 'surface' | 'helperSurface' | 'versions' | 'laws' | 'responseIntentPresets' | 'modeHints' | 'utilities' | 'memoryRankingPolicy' | 'memoryAnchorStore' | 'retrievalContextBuilder' | 'health' | 'buildMemoryRankingQuery' | 'createMemoryRankingCandidate' | 'rankMemoryAnchors' | 'summarizeMemoryRanking' | 'explainMemoryRankingTrace' | 'explainRankedMemoryAnchor' | 'groupMemoryRankingByFamily' | 'queryAnchors' | 'buildPresetRetrievalRequest' | 'buildPresetRetrievalContext' | 'buildPresetRetrievalPrompt' | 'auditRetrievalContext'> {
  const runtime = createBackendChatIntelligenceDlRuntime(deps);
  return Object.freeze({
    version: runtime.version,
    surface: runtime.surface,
    helperSurface: runtime.helperSurface,
    versions: runtime.versions,
    laws: runtime.laws,
    responseIntentPresets: runtime.responseIntentPresets,
    modeHints: runtime.modeHints,
    utilities: runtime.utilities,
    memoryRankingPolicy: runtime.memoryRankingPolicy,
    memoryAnchorStore: runtime.memoryAnchorStore,
    retrievalContextBuilder: runtime.retrievalContextBuilder,
    health: runtime.health,
    buildMemoryRankingQuery: runtime.buildMemoryRankingQuery,
    createMemoryRankingCandidate: runtime.createMemoryRankingCandidate,
    rankMemoryAnchors: runtime.rankMemoryAnchors,
    summarizeMemoryRanking: runtime.summarizeMemoryRanking,
    explainMemoryRankingTrace: runtime.explainMemoryRankingTrace,
    explainRankedMemoryAnchor: runtime.explainRankedMemoryAnchor,
    groupMemoryRankingByFamily: runtime.groupMemoryRankingByFamily,
    queryAnchors: runtime.queryAnchors,
    buildPresetRetrievalRequest: runtime.buildPresetRetrievalRequest,
    buildPresetRetrievalContext: runtime.buildPresetRetrievalContext,
    buildPresetRetrievalPrompt: runtime.buildPresetRetrievalPrompt,
    auditRetrievalContext: runtime.auditRetrievalContext,
  });
}

export function getBackendChatIntelligenceDlHealth(
  runtime: Pick<BackendChatIntelligenceDlRuntime, 'embeddingClient' | 'intentEncoder' | 'conversationMemoryModel' | 'responseRankingModel' | 'sequenceMemoryClient' | 'memoryRankingPolicy' | 'memoryAnchorStore' | 'retrievalContextBuilder'>,
): BackendChatIntelligenceDlRuntimeHealth {
  return createRuntimeHealth(runtime);
}

export function listBackendChatIntelligenceHelperSurfaceEntries(): readonly BackendChatIntelligenceDlHelperSurfaceEntry[] {
  return BACKEND_CHAT_INTELLIGENCE_DL_HELPER_SURFACE;
}

export function findBackendChatIntelligenceHelperSurfaceEntry(id: string): BackendChatIntelligenceDlHelperSurfaceEntry | null {
  return BACKEND_CHAT_INTELLIGENCE_DL_HELPER_SURFACE.find((entry) => entry.id === id) ?? null;
}

export function applyRetrievalPreset(request: RetrievalContextBuildRequest): RetrievalContextBuildRequest {
  const preset = BACKEND_CHAT_INTELLIGENCE_RESPONSE_INTENT_PRESETS[request.responseIntent];
  const modeHint = BACKEND_CHAT_INTELLIGENCE_MODE_HINTS[normalizeModeId(request.currentModeId)];
  return Object.freeze({
    ...request,
    intent: request.intent ?? preset.memoryIntent,
    topK: request.topK ?? preset.topK,
    includeShadow: request.includeShadow ?? preset.includeShadow,
    currentTags: mergeUniqueStrings(request.currentTags, preset.currentTags, modeHint.currentTags),
    relationshipSignals: mergeUniqueStrings(request.relationshipSignals, preset.relationshipSignals, modeHint.relationshipSignals),
    emotionSignals: mergeUniqueStrings(request.emotionSignals, preset.emotionSignals, modeHint.emotionSignals),
  });
}

export function createRetrievalAudit(packet: RetrievalContextPacket): BackendChatIntelligenceRetrievalPacketAudit {
  return Object.freeze({
    version: BACKEND_CHAT_INTELLIGENCE_DL_VERSION,
    retrievalAnalyzerVersion: RETRIEVAL_CONTEXT_ANALYZER_VERSION,
    summary: summarizeRetrievalContextPacket(packet),
    scoreProfile: packetScoreProfile(packet),
    densityProfile: packetDensityProfile(packet),
    qualityGate: packetQualityGate(packet),
    narrativeProfile: packetNarrativeProfile(packet),
    sortingView: packetSortingView(packet),
    promptKeys: listPromptBlockKeys(packet),
    flattenedPromptLines: flattenPromptBlockLines(packet),
    topAnchor: getTopAnchor(packet),
    topDocument: getTopDocument(packet),
    topCallback: getTopCallback(packet),
    topPromptBlock: getTopPromptBlock(packet),
    actionableCallback: selectMostActionableCallback(packet),
    topLine: summarizePacketTopline(packet),
    anchorTags: collectAllAnchorTags(packet),
    anchorEmotions: collectAllAnchorEmotions(packet),
  });
}

function createRuntimeHealth(runtime: {
  readonly embeddingClient: MessageEmbeddingClient;
  readonly intentEncoder: DialogueIntentEncoder;
  readonly conversationMemoryModel: ConversationMemoryModel;
  readonly responseRankingModel: ResponseRankingModel;
  readonly sequenceMemoryClient: SequenceMemoryClient;
  readonly memoryRankingPolicy: MemoryRankingPolicyApi;
  readonly memoryAnchorStore: MemoryAnchorStoreApi;
  readonly retrievalContextBuilder: RetrievalContextBuilderApi;
}): BackendChatIntelligenceDlRuntimeHealth {
  return Object.freeze({
    version: BACKEND_CHAT_INTELLIGENCE_DL_VERSION,
    surfaceCount: BACKEND_CHAT_INTELLIGENCE_DL_SURFACE.length,
    helperSurfaceCount: BACKEND_CHAT_INTELLIGENCE_DL_HELPER_SURFACE.length,
    concerns: Object.freeze(BACKEND_CHAT_INTELLIGENCE_DL_SURFACE.map((entry) => entry.concern)),
    sharedDependencies: Object.freeze({
      embeddingClient: runtime.embeddingClient instanceof MessageEmbeddingClient,
      intentEncoder: runtime.intentEncoder instanceof DialogueIntentEncoder,
      conversationMemoryModel: runtime.conversationMemoryModel instanceof ConversationMemoryModel,
      responseRankingModel: runtime.responseRankingModel instanceof ResponseRankingModel,
      sequenceMemoryClient: runtime.sequenceMemoryClient instanceof SequenceMemoryClient,
      memoryRankingPolicy: Boolean(runtime.memoryRankingPolicy?.version),
      memoryAnchorStore: Boolean(runtime.memoryAnchorStore?.version),
      retrievalContextBuilder: Boolean(runtime.retrievalContextBuilder?.version),
    }),
    versions: BACKEND_CHAT_INTELLIGENCE_DL_VERSION_MAP,
  });
}

function createEmbeddingClock(now: () => number): { now(): ReturnType<MessageEmbeddingClientClockPort['now']> } {
  return Object.freeze({ now: () => now() as unknown as ReturnType<MessageEmbeddingClientClockPort['now']> });
}

function createIntentClock(now: () => number): { now(): ReturnType<MessageEmbeddingClientClockPort['now']> } {
  return Object.freeze({ now: () => now() as unknown as ReturnType<MessageEmbeddingClientClockPort['now']> });
}

function defaultNow(): number {
  return Date.now();
}

function normalizeModeId(modeId?: string | null): keyof typeof BACKEND_CHAT_INTELLIGENCE_MODE_HINTS {
  const normalized = String(modeId ?? 'UNKNOWN').trim().toUpperCase().replace(/[^A-Z_]/g, '_');
  return (normalized in BACKEND_CHAT_INTELLIGENCE_MODE_HINTS ? normalized : 'UNKNOWN') as keyof typeof BACKEND_CHAT_INTELLIGENCE_MODE_HINTS;
}

function mergeUniqueStrings(...groups: ReadonlyArray<readonly string[] | undefined>): readonly string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const group of groups) {
    for (const raw of group ?? []) {
      const value = String(raw ?? '').trim();
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(value);
    }
  }
  return Object.freeze(merged);
}
