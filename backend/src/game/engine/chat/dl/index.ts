/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT DL BARREL
 * FILE: backend/src/game/engine/chat/dl/index.ts
 * VERSION: 2026.03.21-dl-barrel-15x
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Single authoritative backend-export surface for the chat DL lane.
 *
 * This barrel is intentionally not a tiny re-export shim. It is the composition
 * surface that binds the lane's real backend capabilities into one runtime-safe,
 * strongly-typed, replay-friendly entry point for the rest of backend chat.
 *
 * Why this file exists
 * --------------------
 * Point Zero One backend chat now has real lane implementations for:
 * - deterministic / hybrid semantic embeddings,
 * - explainable dialogue-intent encoding,
 * - accepted-truth conversation memory,
 * - response ranking,
 * - and durable sequence-memory coordination.
 *
 * The index therefore needs to do more than forward names. It needs to:
 * 1. export the full public lane surface,
 * 2. compose the lane with shared dependencies,
 * 3. expose readiness / health / version law,
 * 4. bridge memory truth into sequence-memory truth,
 * 5. provide one place for backend orchestration to call the lane coherently,
 * 6. stay faithful to the real repo split,
 * 7. and never flatten the lane into generic SDK mush.
 *
 * Ownership doctrine
 * ------------------
 * - This file does not become transcript truth owner.
 * - This file does not bypass moderation or channel law.
 * - This file does not replace orchestration, battle logic, or transport.
 * - This file does provide a coherent DL runtime for the backend chat lane.
 *
 * The result is a barrel that is actually useful to the runtime.
 * ============================================================================
 */

/* eslint-disable max-lines */

import {
  CHAT_MESSAGE_EMBEDDING_CLIENT_VERSION,
  MessageEmbeddingClient,
  computeEmbeddingSimilarity,
  createMessageEmbeddingClient,
  embedAuthoritativeChatMessage,
  embedAuthoritativeTranscriptWindow,
} from './MessageEmbeddingClient';
import type {
  EmbeddingInputKind,
  EmbeddingMessageInput,
  EmbeddingSceneContext,
  EmbeddingSemanticFamily,
  EmbeddingSourceKind,
  EmbeddingVector,
  MessageEmbeddingClientOptions,
  MessageEmbeddingClientClockPort,
  SimilarityResult,
  TranscriptWindowInput,
} from './MessageEmbeddingClient';
import {
  CHAT_DIALOGUE_INTENT_ENCODER_VERSION,
  DialogueIntentEncoder,
  createDialogueIntentEncoder,
  encodeDialogueIntentSequence,
  encodeDialogueIntentTurn,
} from './DialogueIntentEncoder';
import type {
  DialogueIntentEncoderOptions,
  DialogueIntentEncoderClockPort,
  DialogueIntentKind,
  DialogueIntentResult,
  DialogueIntentSequenceInput,
  DialogueIntentSequenceResult,
  DialogueIntentSocialRead,
  DialogueIntentTurnInput,
} from './DialogueIntentEncoder';
import {
  CHAT_CONVERSATION_MEMORY_MODEL_VERSION,
  ConversationMemoryModel,
  createConversationMemoryModel,
  ingestBackendChatMemoryTurn,
  retrieveBackendConversationMemories,
} from './ConversationMemoryModel';
import type {
  ConversationMemoryContext,
  ConversationMemoryKind,
  ConversationMemoryModelDependencies,
  ConversationMemoryRecord,
  ConversationMemoryRetrievalRequest,
  ConversationMemoryRetrievalResult,
  ConversationMemoryTurn,
  RetrievedConversationMemory,
} from './ConversationMemoryModel';
import {
  CHAT_RESPONSE_RANKING_MODEL_VERSION,
  ResponseRankingModel,
  createResponseRankingModel,
  rankBackendChatHaterCandidates,
  rankBackendChatHelperCandidates,
  rankBackendChatResponseCandidates,
} from './ResponseRankingModel';
import type {
  RankedResponseDecision,
  ResponseCandidateIntentFamily,
  ResponseCandidateSourceKind,
  ResponseRankingCandidateInput,
  ResponseRankingContext,
  ResponseRankingDependencyBundle,
  ResponseRankingResult,
} from './ResponseRankingModel';
import {
  SequenceMemoryClient,
  createSequenceMemoryClient,
} from './SequenceMemoryClient';
import type {
  ChatDlChannelId,
  ChatDlModeId,
  SequenceMemoryActorType,
  SequenceMemoryAnchor,
  SequenceMemoryAnchorKind,
  SequenceMemoryClientConfig,
  SequenceMemoryClientDependencies,
  SequenceMemoryCompressionRequest,
  SequenceMemoryEmotionProfile,
  SequenceMemoryRelationshipProfile,
  SequenceMemoryRetrievalHit,
  SequenceMemorySceneWindow,
  SequenceMemorySnapshot,
  SequenceMemorySourceMessage,
  SequenceMemoryStats,
  SequenceMemoryTrigger,
  SequenceMemoryVector,
} from './SequenceMemoryClient';

// ============================================================================
// MARK: Re-export authoritative lane modules
// ============================================================================

export {
  MessageEmbeddingClient,
  createMessageEmbeddingClient,
  embedAuthoritativeChatMessage,
  embedAuthoritativeTranscriptWindow,
  computeEmbeddingSimilarity,
};

export type {
  MessageEmbeddingClientOptions,
  EmbeddingSourceKind,
  EmbeddingInputKind,
  EmbeddingSemanticFamily,
  EmbeddingSceneContext,
  EmbeddingMessageInput,
  TranscriptWindowInput,
  EmbeddingVector,
  SimilarityResult,
};

export {
  DialogueIntentEncoder,
  createDialogueIntentEncoder,
  encodeDialogueIntentTurn,
  encodeDialogueIntentSequence,
};

export type {
  DialogueIntentEncoderOptions,
  DialogueIntentKind,
  DialogueIntentTurnInput,
  DialogueIntentSequenceInput,
  DialogueIntentResult,
  DialogueIntentSequenceResult,
  DialogueIntentSocialRead,
};

export {
  ConversationMemoryModel,
  createConversationMemoryModel,
  ingestBackendChatMemoryTurn,
  retrieveBackendConversationMemories,
};

export type {
  ConversationMemoryKind,
  ConversationMemoryRecord,
  ConversationMemoryTurn,
  ConversationMemoryContext,
  ConversationMemoryRetrievalRequest,
  ConversationMemoryRetrievalResult,
  RetrievedConversationMemory,
  ConversationMemoryModelDependencies,
};

export {
  ResponseRankingModel,
  createResponseRankingModel,
  rankBackendChatResponseCandidates,
  rankBackendChatHelperCandidates,
  rankBackendChatHaterCandidates,
};

export type {
  ResponseCandidateSourceKind,
  ResponseCandidateIntentFamily,
  ResponseRankingCandidateInput,
  ResponseRankingContext,
  ResponseRankingResult,
  RankedResponseDecision,
  ResponseRankingDependencyBundle,
};

export {
  SequenceMemoryClient,
  createSequenceMemoryClient,
};

export type {
  ChatDlChannelId,
  ChatDlModeId,
  SequenceMemoryActorType,
  SequenceMemoryAnchorKind,
  SequenceMemorySourceMessage,
  SequenceMemorySceneWindow,
  SequenceMemoryAnchor,
  SequenceMemoryRetrievalHit,
  SequenceMemoryVector,
  SequenceMemoryEmotionProfile,
  SequenceMemoryRelationshipProfile,
  SequenceMemorySnapshot,
  SequenceMemoryStats,
  SequenceMemoryClientConfig,
  SequenceMemoryClientDependencies,
  SequenceMemoryTrigger,
  SequenceMemoryCompressionRequest,
};

// ============================================================================
// MARK: Barrel module constants
// ============================================================================

export const BACKEND_CHAT_DL_BARREL_MODULE_NAME =
  'PZO_BACKEND_CHAT_DL_BARREL' as const;

export const BACKEND_CHAT_DL_BARREL_VERSION =
  '2026.03.21-dl-barrel-15x' as const;

export const BACKEND_CHAT_DL_RUNTIME_LAWS = Object.freeze([
  'The barrel composes the real lane; it does not simulate missing modules.',
  'Embedding, intent, memory, ranking, and sequence-memory must share one coherent runtime surface.',
  'Conversation memory stores accepted-truth meaning; sequence memory stores durable anchor continuity.',
  'The index must remain replay-safe, proof-friendly, and backend-authoritative.',
  'No helper, hater, or scene ranking should need ad hoc lane stitching outside this file.',
  'The barrel must expose health and readiness explicitly for orchestration and diagnostics.',
  'Bridge functions should preserve channel, room, pressure, and mode semantics.',
  'The lane should be usable both at fine-grained method level and at composite orchestration level.',
] as const);

export const DEFAULT_BACKEND_CHAT_DL_LANE_CONFIG = Object.freeze({
  mirrorConversationMemoryIntoSequenceInference: true,
  includeSequenceShadowReadsByDefault: false,
  defaultCompositeLimit: 8,
  defaultSequenceRetrievalLimit: 8,
  defaultConversationRetrievalLimit: 8,
  defaultCompressionBatchSize: 48,
  defaultCompressionTier: 'SCENE_SUMMARY' as const,
  defaultTrigger: 'INFERENCE_SNAPSHOT' as const,
  defaultInferenceVisibilityShadowOnly: false,
  defaultInferenceKind: 'INFERENCE' as const,
  queryActorType: 'PLAYER' as const,
  defaultSceneSourceKind: 'SYSTEM' as const,
  defaultSequenceTags: Object.freeze(['backend-dl', 'authoritative']) as readonly string[],
});


export interface BackendChatDlPureFunctionPorts {
  readonly computeEmbeddingSimilarity: typeof computeEmbeddingSimilarity;
  readonly embedAuthoritativeChatMessage: typeof embedAuthoritativeChatMessage;
  readonly embedAuthoritativeTranscriptWindow: typeof embedAuthoritativeTranscriptWindow;
  readonly encodeDialogueIntentTurn: typeof encodeDialogueIntentTurn;
  readonly encodeDialogueIntentSequence: typeof encodeDialogueIntentSequence;
  readonly ingestBackendChatMemoryTurn: typeof ingestBackendChatMemoryTurn;
  readonly retrieveBackendConversationMemories: typeof retrieveBackendConversationMemories;
  readonly rankBackendChatResponseCandidates: typeof rankBackendChatResponseCandidates;
  readonly rankBackendChatHelperCandidates: typeof rankBackendChatHelperCandidates;
  readonly rankBackendChatHaterCandidates: typeof rankBackendChatHaterCandidates;
}

export const BACKEND_CHAT_DL_FUNCTION_PORTS: BackendChatDlPureFunctionPorts = Object.freeze({
  computeEmbeddingSimilarity,
  embedAuthoritativeChatMessage,
  embedAuthoritativeTranscriptWindow,
  encodeDialogueIntentTurn,
  encodeDialogueIntentSequence,
  ingestBackendChatMemoryTurn,
  retrieveBackendConversationMemories,
  rankBackendChatResponseCandidates,
  rankBackendChatHelperCandidates,
  rankBackendChatHaterCandidates,
});

// ============================================================================
// MARK: Logger and hooks
// ============================================================================

export interface BackendChatDlLaneLogger {
  debug(message: string, payload?: unknown): void;
  info(message: string, payload?: unknown): void;
  warn(message: string, payload?: unknown): void;
  error(message: string, payload?: unknown): void;
}

export interface BackendChatDlRuntimeHooks {
  readonly now?: () => number;
  readonly logger?: BackendChatDlLaneLogger;
  readonly idFactory?: (prefix: string) => string;
}

export interface BackendChatDlLaneConfig {
  readonly embeddingClientConfig?: Readonly<MessageEmbeddingClientOptions>;
  readonly intentEncoderConfig?: Readonly<DialogueIntentEncoderOptions>;
  readonly conversationMemoryConfig?: Readonly<ConversationMemoryModelDependencies>;
  readonly responseRankingConfig?: Readonly<ResponseRankingDependencyBundle>;
  readonly sequenceMemoryConfig?: Readonly<Partial<SequenceMemoryClientConfig>>;
  readonly sequenceMemoryDependencies?: Readonly<SequenceMemoryClientDependencies>;
  readonly runtimeHooks?: Readonly<BackendChatDlRuntimeHooks>;
  readonly mirrorConversationMemoryIntoSequenceInference?: boolean;
  readonly includeSequenceShadowReadsByDefault?: boolean;
  readonly defaultCompositeLimit?: number;
  readonly defaultSequenceRetrievalLimit?: number;
  readonly defaultConversationRetrievalLimit?: number;
  readonly defaultCompressionBatchSize?: number;
  readonly defaultCompressionTier?: SequenceMemoryCompressionRequest['targetTier'];
}

export interface BackendChatDlLaneModules {
  readonly MessageEmbeddingClient: typeof MessageEmbeddingClient;
  readonly DialogueIntentEncoder: typeof DialogueIntentEncoder;
  readonly ConversationMemoryModel: typeof ConversationMemoryModel;
  readonly ResponseRankingModel: typeof ResponseRankingModel;
  readonly SequenceMemoryClient: typeof SequenceMemoryClient;
  readonly createMessageEmbeddingClient: typeof createMessageEmbeddingClient;
  readonly createDialogueIntentEncoder: typeof createDialogueIntentEncoder;
  readonly createConversationMemoryModel: typeof createConversationMemoryModel;
  readonly createResponseRankingModel: typeof createResponseRankingModel;
  readonly createSequenceMemoryClient: typeof createSequenceMemoryClient;
}

export interface BackendChatDlLaneServices {
  readonly embeddingClient: MessageEmbeddingClient;
  readonly intentEncoder: DialogueIntentEncoder;
  readonly conversationMemory: ConversationMemoryModel;
  readonly responseRanking: ResponseRankingModel;
  readonly sequenceMemory: SequenceMemoryClient;
}

export interface BackendChatDlModuleVersions {
  readonly barrel: string;
  readonly embedding: string;
  readonly intent: string;
  readonly conversationMemory: string;
  readonly responseRanking: string;
  readonly sequenceMemory: string;
}

export interface BackendChatDlLaneHealthReport {
  readonly moduleName: string;
  readonly versions: BackendChatDlModuleVersions;
  readonly hasEmbeddingClient: boolean;
  readonly hasIntentEncoder: boolean;
  readonly hasConversationMemory: boolean;
  readonly hasResponseRanking: boolean;
  readonly hasSequenceMemory: boolean;
  readonly readyForIntent: boolean;
  readonly readyForMemory: boolean;
  readonly readyForRanking: boolean;
  readonly readyForSequence: boolean;
  readonly readyForFullLane: boolean;
  readonly warnings: readonly string[];
  readonly missing: readonly string[];
}

export interface BackendChatDlAggregateReadiness {
  readonly embeddingReady: boolean;
  readonly intentReady: boolean;
  readonly conversationMemoryReady: boolean;
  readonly rankingReady: boolean;
  readonly sequenceMemoryReady: boolean;
  readonly compositeQueryReady: boolean;
  readonly fullReady: boolean;
}

export interface BackendChatDlLane {
  readonly modules: BackendChatDlLaneModules;
  readonly pure: BackendChatDlPureFunctionPorts;
  readonly services: BackendChatDlLaneServices;
  readonly health: BackendChatDlLaneHealthReport;
  readonly readiness: BackendChatDlAggregateReadiness;
  readonly runtime: BackendChatDlRuntime;
}

// ============================================================================
// MARK: Composite query / ingest / maintenance contracts
// ============================================================================

export interface BackendChatDlTurnEnvelope {
  readonly turn: ConversationMemoryTurn;
  readonly context: ConversationMemoryContext;
  readonly previousMessages?: ReadonlyArray<EmbeddingMessageInput>;
  readonly sceneContext?: EmbeddingSceneContext | null;
  readonly signalEnvelope?: EmbeddingMessageInput['signalEnvelope'];
  readonly speakerProfile?: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly sourceKind?: EmbeddingSourceKind;
  readonly actorType?: SequenceMemoryActorType;
  readonly sequenceTags?: readonly string[];
  readonly inferenceMetadata?: Readonly<Record<string, unknown>>;
}

export interface BackendChatDlTurnResult {
  readonly embedding: EmbeddingVector;
  readonly intent: DialogueIntentResult;
  readonly memoryRecord: ConversationMemoryRecord;
  readonly turnAnchor: SequenceMemoryAnchor;
  readonly inferenceAnchor: SequenceMemoryAnchor | null;
  readonly roomSnapshot: SequenceMemorySnapshot;
}

export interface BackendChatDlSceneWindowWrite {
  readonly window: SequenceMemorySceneWindow;
  readonly sceneContext?: EmbeddingSceneContext | null;
  readonly sourceKind?: EmbeddingSourceKind;
}

export interface BackendChatDlSceneWindowResult {
  readonly embedding: EmbeddingVector | null;
  readonly anchor: SequenceMemoryAnchor;
  readonly snapshot: SequenceMemorySnapshot;
}

export interface BackendChatDlCompositeQuery {
  readonly roomId: string;
  readonly channelId: ChatDlChannelId;
  readonly modeId: ChatDlModeId;
  readonly roomKind: ConversationMemoryContext['roomKind'];
  readonly activeChannel: ConversationMemoryContext['activeChannel'];
  readonly ownerUserId: ConversationMemoryContext['ownerUserId'];
  readonly counterpartUserId?: ConversationMemoryContext['counterpartUserId'];
  readonly actorId?: string;
  readonly actorIds?: readonly string[];
  readonly queryText: string;
  readonly desiredConversationKinds?: readonly ConversationMemoryKind[];
  readonly desiredSequenceKinds?: readonly SequenceMemoryAnchorKind[];
  readonly conversationLimit?: number;
  readonly sequenceLimit?: number;
  readonly includeShadowAnchors?: boolean;
  readonly sceneContext?: EmbeddingSceneContext | null;
  readonly rankingContext?: ResponseRankingContext | null;
  readonly rankingCandidates?: readonly ResponseRankingCandidateInput[];
  readonly nowMs?: number | null;
}

export interface BackendChatDlCompositeResult {
  readonly readiness: BackendChatDlAggregateReadiness;
  readonly queryText: string;
  readonly embeddingVector: EmbeddingVector;
  readonly intentSnapshot: DialogueIntentResult;
  readonly socialSummary: string;
  readonly memorySnapshot: ConversationMemoryRetrievalResult;
  readonly retrievedMemories: readonly RetrievedConversationMemory[];
  readonly sequenceHits: readonly SequenceMemoryRetrievalHit[];
  readonly sequenceSnapshot: SequenceMemorySnapshot;
  readonly rankingSnapshot: ResponseRankingResult | null;
  readonly topDecision: RankedResponseDecision | null;
  readonly summary: string;
}

export interface BackendChatDlEmbeddingRecipe {
  readonly inputKind: EmbeddingInputKind;
  readonly text: string;
  readonly sourceKind?: EmbeddingSourceKind;
  readonly sceneContext?: EmbeddingSceneContext | null;
  readonly semanticFamilies?: readonly EmbeddingSemanticFamily[];
}

export interface BackendChatDlIntentExpectation {
  readonly expectedIntent?: DialogueIntentKind;
  readonly socialRead?: DialogueIntentSocialRead | null;
}

export interface BackendChatDlRoomMaintenanceRequest {
  readonly roomId: string;
  readonly channelId: ChatDlChannelId;
  readonly modeId: ChatDlModeId;
  readonly ownerUserId?: ConversationMemoryContext['ownerUserId'];
  readonly nowMs?: number;
  readonly closeConversationWindow?: boolean;
  readonly compactConversationMemory?: boolean;
  readonly decayConversationMemory?: boolean;
  readonly compressSequenceMemory?: boolean;
  readonly pruneSequenceMemory?: boolean;
  readonly sequenceCompressionOlderThanMs?: number;
  readonly retainRawRecentCount?: number;
  readonly maxAnchorsToProcess?: number;
  readonly targetTier?: SequenceMemoryCompressionRequest['targetTier'];
}

export interface BackendChatDlRoomMaintenanceResult {
  readonly closedSceneSummary: ConversationMemoryRecord | null;
  readonly compactedConversationRecords: readonly ConversationMemoryRecord[];
  readonly createdSequenceSummaries: readonly SequenceMemoryAnchor[];
  readonly prunedAnchorIds: readonly string[];
  readonly sequenceSnapshot: SequenceMemorySnapshot;
  readonly sequenceStats: Readonly<SequenceMemoryStats>;
}

export interface BackendChatDlSequenceBridgeOptions {
  readonly actorType?: SequenceMemoryActorType;
  readonly sourceKind?: EmbeddingSourceKind;
  readonly tags?: readonly string[];
  readonly trigger?: SequenceMemoryTrigger;
}

// ============================================================================
// MARK: Null logger
// ============================================================================

const NULL_LOGGER: BackendChatDlLaneLogger = Object.freeze({
  debug() {
    /* noop */
  },
  info() {
    /* noop */
  },
  warn() {
    /* noop */
  },
  error() {
    /* noop */
  },
});

// ============================================================================
// MARK: Small utilities
// ============================================================================

function nowMsFromHooks(hooks?: Readonly<BackendChatDlRuntimeHooks>): number {
  return hooks?.now?.() ?? Date.now();
}

function clampInt(value: number | undefined, min: number, fallback: number): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  if (value <= min) return min;
  return Math.round(value);
}

function normalizeText(value: string): string {
  return value.replace(/\r\n/g, '\n').trim();
}

function normalizeStringArray(values: readonly string[] | undefined): string[] {
  if (!values?.length) return [];
  const set = new Set<string>();
  for (const value of values) {
    const normalized = normalizeText(String(value ?? ''));
    if (normalized) {
      set.add(normalized);
    }
  }
  return [...set];
}

function deriveEmbeddingSourceKind(actorType: SequenceMemoryActorType | undefined): EmbeddingSourceKind {
  switch (actorType) {
    case 'PLAYER':
      return 'PLAYER';
    case 'HELPER':
      return 'HELPER';
    case 'HATER':
      return 'HATER';
    case 'SYSTEM':
    case 'LIVEOPS':
    case 'MODERATION':
      return 'SYSTEM';
    case 'NPC_AMBIENT':
      return 'AMBIENT';
    default:
      return 'UNKNOWN';
  }
}

function deriveSequenceActorType(sourceKind: EmbeddingSourceKind | undefined): SequenceMemoryActorType {
  switch (sourceKind) {
    case 'PLAYER':
      return 'PLAYER';
    case 'HELPER':
      return 'HELPER';
    case 'HATER':
      return 'HATER';
    case 'SYSTEM':
      return 'SYSTEM';
    case 'AMBIENT':
      return 'NPC_AMBIENT';
    default:
      return 'UNKNOWN';
  }
}

function deriveSequenceChannelId(channel: ConversationMemoryTurn['channel']): ChatDlChannelId {
  return channel as ChatDlChannelId;
}

function deriveSequenceModeId(modeId: ConversationMemoryTurn['modeId']): ChatDlModeId {
  return (modeId ?? 'UNKNOWN') as ChatDlModeId;
}

function buildModuleVersions(): BackendChatDlModuleVersions {
  return Object.freeze({
    barrel: BACKEND_CHAT_DL_BARREL_VERSION,
    embedding: CHAT_MESSAGE_EMBEDDING_CLIENT_VERSION,
    intent: CHAT_DIALOGUE_INTENT_ENCODER_VERSION,
    conversationMemory: CHAT_CONVERSATION_MEMORY_MODEL_VERSION,
    responseRanking: CHAT_RESPONSE_RANKING_MODEL_VERSION,
    sequenceMemory: '2026.03.14-sequence-memory-client.v1',
  });
}

function mapConversationMemoryKindToSequenceAnchorKind(
  kind: ConversationMemoryKind,
): SequenceMemoryAnchorKind {
  switch (kind) {
    case 'turn':
      return 'TURN';
    case 'window':
    case 'scene_summary':
      return 'SCENE';
    case 'callback':
      return 'CALLBACK';
    case 'legend':
      return 'LEGEND';
    case 'relationship':
      return 'STATE_SHIFT';
    case 'rescue':
      return 'RESCUE';
    case 'threat':
      return 'RIVALRY';
    case 'negotiation':
      return 'NEGOTIATION';
    case 'proof':
      return 'QUOTE';
    default:
      return 'INFERENCE';
  }
}

function buildEmotionProfileFromIntent(
  intent: DialogueIntentResult,
  turn: ConversationMemoryTurn,
): Partial<SequenceMemoryEmotionProfile> {
  const social = intent.socialRead;
  const intensity = Math.max(
    social.aggression01,
    social.helperNeed01,
    social.negotiation01,
    social.publicPerformance01,
    social.distress01,
    turn.emotionalCharge ?? 0,
  );

  return {
    intimidation: social.aggression01,
    confidence: intent.confidence01,
    frustration: social.distress01,
    curiosity: intent.primaryIntent === 'ASK_FOR_CLARITY' ? intent.confidence01 : 0,
    attachment: social.posture === 'SUPPORTIVE' ? social.confidence01 : 0,
    embarrassment: social.publicPerformance01 * (turn.witnessValue ?? 0),
    relief: intent.primaryIntent === 'REASSURE' ? intensity : 0,
    dominance: intent.primaryIntent === 'SOVEREIGNTY_SIGNAL' ? intensity : social.aggression01,
    desperation: social.helperNeed01,
    trust: intent.primaryIntent === 'BOND' || intent.primaryIntent === 'GUIDE'
      ? Math.max(social.confidence01, turn.legendValue ?? 0)
      : 0,
  };
}

function buildRelationshipProfileFromRecord(
  record: ConversationMemoryRecord,
): Partial<SequenceMemoryRelationshipProfile> {
  return {
    respect: record.legendValue,
    fear: record.threatValue,
    contempt: Math.max(0, record.threatValue - record.rescueValue * 0.5),
    fascination: record.callbackPotential,
    trust: Math.max(record.rescueValue, record.negotiationValue * 0.35),
    familiarity: record.continuityValue,
    rivalryIntensity: Math.max(record.threatValue, record.negotiationValue),
    rescueDebt: record.rescueValue,
  };
}

function buildEmbeddingMessageInputFromTurn(
  turn: ConversationMemoryTurn,
  context: ConversationMemoryContext,
  sourceKind: EmbeddingSourceKind,
  sceneContext?: EmbeddingSceneContext | null,
  signalEnvelope?: EmbeddingMessageInput['signalEnvelope'],
  metadata?: Readonly<Record<string, unknown>>,
): EmbeddingMessageInput {
  return {
    inputKind: 'MESSAGE',
    messageId: turn.messageId,
    text: normalizeText(turn.body),
    createdAtMs: turn.createdAt,
    sourceKind,
    channel: turn.channel,
    roomKind: turn.roomKind,
    pressureTier: turn.pressureTier ?? context.pressureTier,
    modeId: turn.modeId,
    speakerId: turn.userId ?? undefined,
    signalEnvelope: signalEnvelope ?? null,
    tags: normalizeStringArray([
      ...(turn.semanticFamilies ?? []),
      ...(context.sceneNotes ?? []),
    ]),
    sceneContext: sceneContext ?? null,
    metadata: {
      ownerUserId: context.ownerUserId ?? null,
      counterpartUserId: context.counterpartUserId ?? null,
      publicWitnessHeat: context.publicWitnessHeat,
      helperUrgency: context.helperUrgency,
      haterPressure: context.haterPressure,
      toxicityRisk: context.toxicityRisk,
      churnRisk: context.churnRisk,
      ...(metadata ?? {}),
    },
  };
}

function buildIntentTurnInput(
  message: EmbeddingMessageInput,
  previousMessages?: ReadonlyArray<EmbeddingMessageInput>,
  sceneContext?: EmbeddingSceneContext | null,
  signalEnvelope?: EmbeddingMessageInput['signalEnvelope'],
  speakerProfile?: Readonly<Record<string, unknown>>,
  metadata?: Readonly<Record<string, unknown>>,
): DialogueIntentTurnInput {
  return {
    message,
    previousMessages: previousMessages ?? [],
    sceneContext: sceneContext ?? null,
    signalEnvelope: signalEnvelope ?? null,
    speakerProfile: speakerProfile as DialogueIntentTurnInput['speakerProfile'],
    metadata: metadata as DialogueIntentTurnInput['metadata'],
  };
}

function buildSequenceSourceMessageFromTurn(
  turn: ConversationMemoryTurn,
  actorType: SequenceMemoryActorType,
  tags?: readonly string[],
): SequenceMemorySourceMessage {
  return {
    messageId: String(turn.messageId),
    roomId: String(turn.roomId),
    channelId: deriveSequenceChannelId(turn.channel),
    modeId: deriveSequenceModeId(turn.modeId),
    authorId: String(turn.userId ?? 'unknown'),
    actorType,
    body: normalizeText(turn.body),
    createdAtMs: turn.createdAt,
    acceptedAtMs: turn.createdAt,
    sequence: turn.createdAt,
    tags: normalizeStringArray([
      ...(tags ?? []),
      ...DEFAULT_BACKEND_CHAT_DL_LANE_CONFIG.defaultSequenceTags,
    ]),
    metadata: {
      roomKind: turn.roomKind,
      sessionId: turn.sessionId ?? null,
      counterpartUserId: turn.counterpartUserId ?? null,
      channel: turn.channel,
      pressureTier: turn.pressureTier ?? null,
      metadata: turn.metadata ?? {},
    },
  };
}

function buildInferenceTextFromRecord(
  record: ConversationMemoryRecord,
  intent: DialogueIntentResult,
): string {
  return normalizeText([
    record.title,
    record.summary,
    `primary_intent=${intent.primaryIntent}`,
    `channel=${record.channel}`,
    `kind=${record.memoryKind}`,
    `continuity=${record.continuityValue.toFixed(3)}`,
  ].join(' | '));
}

function buildSequenceInferenceVector(
  embedding: EmbeddingVector,
): SequenceMemoryVector {
  return {
    dimensions: embedding.dimensions,
    values: [...embedding.vector],
    modelId: embedding.version,
    checksum: embedding.fingerprint,
  };
}

function buildIntentSocialSummary(social: DialogueIntentSocialRead): string {
  return [
    `posture=${social.posture}`,
    `confidence=${social.confidence01.toFixed(3)}`,
    `aggression=${social.aggression01.toFixed(3)}`,
    `helper_need=${social.helperNeed01.toFixed(3)}`,
    `public_performance=${social.publicPerformance01.toFixed(3)}`,
  ].join(' | ');
}

function extractRetrievedConversationMemories(
  result: ConversationMemoryRetrievalResult,
): readonly RetrievedConversationMemory[] {
  return result.results as readonly RetrievedConversationMemory[];
}

function buildCompositeSummary(
  query: BackendChatDlCompositeQuery,
  intentSnapshot: DialogueIntentResult,
  memorySnapshot: ConversationMemoryRetrievalResult,
  sequenceHits: readonly SequenceMemoryRetrievalHit[],
  rankingSnapshot: ResponseRankingResult | null,
): string {
  const retrievedMemories = extractRetrievedConversationMemories(memorySnapshot);
  const topMemory = retrievedMemories[0]?.title ?? 'none';
  const topAnchor = sequenceHits[0]?.anchor.anchorId ?? 'none';
  const topRank = rankingSnapshot?.top?.candidateId ?? 'none';
  const socialSummary = buildIntentSocialSummary(intentSnapshot.socialRead);
  return [
    `query="${normalizeText(query.queryText)}"`,
    `memory_hits=${retrievedMemories.length}`,
    `top_memory=${topMemory}`,
    `sequence_hits=${sequenceHits.length}`,
    `top_anchor=${topAnchor}`,
    `top_rank=${topRank}`,
    socialSummary,
  ].join(' | ');
}

function createLaneWarnings(health: Omit<BackendChatDlLaneHealthReport, 'warnings' | 'missing'>): {
  warnings: string[];
  missing: string[];
} {
  const warnings: string[] = [];
  const missing: string[] = [];

  if (!health.hasEmbeddingClient) missing.push('embeddingClient');
  if (!health.hasIntentEncoder) missing.push('intentEncoder');
  if (!health.hasConversationMemory) missing.push('conversationMemory');
  if (!health.hasResponseRanking) missing.push('responseRanking');
  if (!health.hasSequenceMemory) missing.push('sequenceMemory');

  if (!health.readyForIntent) {
    warnings.push('Intent lane is not fully ready.');
  }
  if (!health.readyForMemory) {
    warnings.push('Memory lane is not fully ready.');
  }
  if (!health.readyForRanking) {
    warnings.push('Ranking lane is not fully ready.');
  }
  if (!health.readyForSequence) {
    warnings.push('Sequence-memory lane is not fully ready.');
  }
  if (!health.readyForFullLane) {
    warnings.push('Full DL lane is not fully ready.');
  }

  return { warnings, missing };
}

// ============================================================================
// MARK: Runtime
// ============================================================================

export class BackendChatDlRuntime {
  private readonly hooks: Readonly<BackendChatDlRuntimeHooks>;
  private readonly config: Readonly<BackendChatDlLaneConfig>;

  public readonly modules: BackendChatDlLaneModules;
  public readonly services: BackendChatDlLaneServices;

  constructor(config: BackendChatDlLaneConfig = {}) {
    this.config = config;
    this.hooks = Object.freeze(config.runtimeHooks ?? {});

    const sharedLogger = this.hooks.logger ?? NULL_LOGGER;
    const sharedNow = () => nowMsFromHooks(this.hooks);

    const embeddingClient = createMessageEmbeddingClient({
      ...(config.embeddingClientConfig ?? {}),
      logger: config.embeddingClientConfig?.logger ?? sharedLogger,
      clock:
        config.embeddingClientConfig?.clock ??
        ({ now: sharedNow } as unknown as MessageEmbeddingClientClockPort),
    });

    const intentEncoder = createDialogueIntentEncoder({
      ...(config.intentEncoderConfig ?? {}),
      embeddingClient,
      logger: config.intentEncoderConfig?.logger ?? sharedLogger,
      clock:
        config.intentEncoderConfig?.clock ??
        ({ now: sharedNow } as unknown as DialogueIntentEncoderClockPort),
    });

    const conversationMemory = createConversationMemoryModel({
      ...(config.conversationMemoryConfig ?? {}),
      embeddingClient,
      intentEncoder,
      now: config.conversationMemoryConfig?.now ?? (() => sharedNow() as never),
    });

    const responseRanking = createResponseRankingModel({
      ...(config.responseRankingConfig ?? {}),
      embeddingClient,
      intentEncoder,
      now: config.responseRankingConfig?.now ?? (() => sharedNow() as never),
    });

    const sequenceMemory = createSequenceMemoryClient(
      {
        ...(config.sequenceMemoryConfig ?? {}),
      },
      {
        ...(config.sequenceMemoryDependencies ?? {}),
        now: config.sequenceMemoryDependencies?.now ?? this.hooks.now,
        idFactory: config.sequenceMemoryDependencies?.idFactory ?? this.hooks.idFactory,
        logger: config.sequenceMemoryDependencies?.logger ?? sharedLogger,
      },
    );

    this.modules = Object.freeze({
      MessageEmbeddingClient,
      DialogueIntentEncoder,
      ConversationMemoryModel,
      ResponseRankingModel,
      SequenceMemoryClient,
      createMessageEmbeddingClient,
      createDialogueIntentEncoder,
      createConversationMemoryModel,
      createResponseRankingModel,
      createSequenceMemoryClient,
    });

    this.services = Object.freeze({
      embeddingClient,
      intentEncoder,
      conversationMemory,
      responseRanking,
      sequenceMemory,
    });
  }

  public getModuleVersions(): BackendChatDlModuleVersions {
    return buildModuleVersions();
  }

  public getHealthReport(): BackendChatDlLaneHealthReport {
    const base = {
      moduleName: BACKEND_CHAT_DL_BARREL_MODULE_NAME,
      versions: this.getModuleVersions(),
      hasEmbeddingClient: this.services.embeddingClient instanceof MessageEmbeddingClient,
      hasIntentEncoder: this.services.intentEncoder instanceof DialogueIntentEncoder,
      hasConversationMemory: this.services.conversationMemory instanceof ConversationMemoryModel,
      hasResponseRanking: this.services.responseRanking instanceof ResponseRankingModel,
      hasSequenceMemory: this.services.sequenceMemory instanceof SequenceMemoryClient,
      readyForIntent:
        this.services.embeddingClient instanceof MessageEmbeddingClient &&
        this.services.intentEncoder instanceof DialogueIntentEncoder,
      readyForMemory:
        this.services.embeddingClient instanceof MessageEmbeddingClient &&
        this.services.intentEncoder instanceof DialogueIntentEncoder &&
        this.services.conversationMemory instanceof ConversationMemoryModel,
      readyForRanking:
        this.services.embeddingClient instanceof MessageEmbeddingClient &&
        this.services.intentEncoder instanceof DialogueIntentEncoder &&
        this.services.responseRanking instanceof ResponseRankingModel,
      readyForSequence:
        this.services.sequenceMemory instanceof SequenceMemoryClient,
      readyForFullLane:
        this.services.embeddingClient instanceof MessageEmbeddingClient &&
        this.services.intentEncoder instanceof DialogueIntentEncoder &&
        this.services.conversationMemory instanceof ConversationMemoryModel &&
        this.services.responseRanking instanceof ResponseRankingModel &&
        this.services.sequenceMemory instanceof SequenceMemoryClient,
    } as const;

    const diagnostics = createLaneWarnings(base);

    return Object.freeze({
      ...base,
      warnings: Object.freeze(diagnostics.warnings),
      missing: Object.freeze(diagnostics.missing),
    });
  }

  public getReadiness(): BackendChatDlAggregateReadiness {
    const health = this.getHealthReport();
    return Object.freeze({
      embeddingReady: health.hasEmbeddingClient,
      intentReady: health.readyForIntent,
      conversationMemoryReady: health.readyForMemory,
      rankingReady: health.readyForRanking,
      sequenceMemoryReady: health.readyForSequence,
      compositeQueryReady: health.readyForMemory && health.readyForSequence,
      fullReady: health.readyForFullLane,
    });
  }

  public asLane(): BackendChatDlLane {
    return Object.freeze({
      modules: this.modules,
      pure: BACKEND_CHAT_DL_FUNCTION_PORTS,
      services: this.services,
      health: this.getHealthReport(),
      readiness: this.getReadiness(),
      runtime: this,
    });
  }

  public getPureFunctionPorts(): BackendChatDlPureFunctionPorts {
    return BACKEND_CHAT_DL_FUNCTION_PORTS;
  }

  public statelessEmbedAuthoritativeChatMessage(
    ...args: Parameters<typeof embedAuthoritativeChatMessage>
  ): ReturnType<typeof embedAuthoritativeChatMessage> {
    return embedAuthoritativeChatMessage(...args);
  }

  public statelessEmbedAuthoritativeTranscriptWindow(
    ...args: Parameters<typeof embedAuthoritativeTranscriptWindow>
  ): ReturnType<typeof embedAuthoritativeTranscriptWindow> {
    return embedAuthoritativeTranscriptWindow(...args);
  }

  public statelessEncodeDialogueIntentTurn(
    ...args: Parameters<typeof encodeDialogueIntentTurn>
  ): ReturnType<typeof encodeDialogueIntentTurn> {
    return encodeDialogueIntentTurn(...args);
  }

  public statelessEncodeDialogueIntentSequence(
    ...args: Parameters<typeof encodeDialogueIntentSequence>
  ): ReturnType<typeof encodeDialogueIntentSequence> {
    return encodeDialogueIntentSequence(...args);
  }

  public statelessIngestConversationMemoryTurn(
    ...args: Parameters<typeof ingestBackendChatMemoryTurn>
  ): ReturnType<typeof ingestBackendChatMemoryTurn> {
    return ingestBackendChatMemoryTurn(...args);
  }

  public statelessRetrieveConversationMemories(
    ...args: Parameters<typeof retrieveBackendConversationMemories>
  ): ReturnType<typeof retrieveBackendConversationMemories> {
    return retrieveBackendConversationMemories(...args);
  }

  public statelessRankResponseCandidates(
    ...args: Parameters<typeof rankBackendChatResponseCandidates>
  ): ReturnType<typeof rankBackendChatResponseCandidates> {
    return rankBackendChatResponseCandidates(...args);
  }

  public statelessRankHelperCandidates(
    ...args: Parameters<typeof rankBackendChatHelperCandidates>
  ): ReturnType<typeof rankBackendChatHelperCandidates> {
    return rankBackendChatHelperCandidates(...args);
  }

  public statelessRankHaterCandidates(
    ...args: Parameters<typeof rankBackendChatHaterCandidates>
  ): ReturnType<typeof rankBackendChatHaterCandidates> {
    return rankBackendChatHaterCandidates(...args);
  }

  public embedMessage(input: EmbeddingMessageInput): EmbeddingVector {
    return this.services.embeddingClient.embedMessage(input);
  }

  public embedTranscriptWindow(input: TranscriptWindowInput): EmbeddingVector {
    return this.services.embeddingClient.embedTranscriptWindow(input);
  }

  public encodeTurn(input: DialogueIntentTurnInput): DialogueIntentResult {
    return this.services.intentEncoder.encodeTurn(input);
  }

  public encodeSequence(input: DialogueIntentSequenceInput): DialogueIntentSequenceResult {
    return this.services.intentEncoder.encodeSequence(input);
  }

  public compareSemanticFit(left: EmbeddingVector, right: EmbeddingVector): SimilarityResult {
    return this.services.embeddingClient.cosineSimilarity(left, right);
  }

  public exportEmbeddingCacheSnapshot(): ReadonlyArray<Readonly<Record<string, unknown>>> {
    return this.services.embeddingClient.exportCacheSnapshot() as ReadonlyArray<
      Readonly<Record<string, unknown>>
    >;
  }

  public getConversationMemoryDiagnostics(): Readonly<Record<string, unknown>> {
    return this.services.conversationMemory.getRuntimeMemoryDiagnostics() as Readonly<
      Record<string, unknown>
    >;
  }

  public buildTurnEnvelopeEmbeddingInput(
    envelope: BackendChatDlTurnEnvelope,
  ): EmbeddingMessageInput {
    const sourceKind = envelope.sourceKind ?? deriveEmbeddingSourceKind(envelope.actorType);
    return buildEmbeddingMessageInputFromTurn(
      envelope.turn,
      envelope.context,
      sourceKind,
      envelope.sceneContext,
      envelope.signalEnvelope,
      envelope.metadata,
    );
  }

  public buildTurnEnvelopeIntentInput(
    envelope: BackendChatDlTurnEnvelope,
  ): DialogueIntentTurnInput {
    return buildIntentTurnInput(
      this.buildTurnEnvelopeEmbeddingInput(envelope),
      envelope.previousMessages,
      envelope.sceneContext,
      envelope.signalEnvelope,
      envelope.speakerProfile,
      envelope.metadata,
    );
  }

  public buildSequenceSourceMessage(
    envelope: BackendChatDlTurnEnvelope,
  ): SequenceMemorySourceMessage {
    const actorType = envelope.actorType ?? deriveSequenceActorType(envelope.sourceKind);
    return buildSequenceSourceMessageFromTurn(
      envelope.turn,
      actorType,
      envelope.sequenceTags,
    );
  }

  public ingestAcceptedTurn(envelope: BackendChatDlTurnEnvelope): BackendChatDlTurnResult {
    const embeddingInput = this.buildTurnEnvelopeEmbeddingInput(envelope);
    const embedding = this.embedMessage(embeddingInput);
    const intent = this.encodeTurn(this.buildTurnEnvelopeIntentInput(envelope));
    const memoryRecord = this.services.conversationMemory.ingestAcceptedTurn(
      envelope.turn,
      envelope.context,
    );

    const turnAnchor = this.services.sequenceMemory.appendMessageAsTurnAnchor(
      this.buildSequenceSourceMessage(envelope),
      buildSequenceInferenceVector(embedding),
      buildEmotionProfileFromIntent(intent, envelope.turn),
      buildRelationshipProfileFromRecord(memoryRecord),
    );

    const inferenceAnchor =
      this.config.mirrorConversationMemoryIntoSequenceInference === false
        ? null
        : this.services.sequenceMemory.upsertInferenceAnchor({
            roomId: String(envelope.turn.roomId),
            channelId: deriveSequenceChannelId(envelope.turn.channel),
            modeId: deriveSequenceModeId(envelope.turn.modeId),
            actorIds: normalizeStringArray([
              String(envelope.turn.userId ?? ''),
              String(envelope.turn.counterpartUserId ?? ''),
            ]),
            text: buildInferenceTextFromRecord(memoryRecord, intent),
            vector: buildSequenceInferenceVector(embedding),
            metadata: {
              memoryId: memoryRecord.memoryId,
              conversationKind: memoryRecord.memoryKind,
              primaryIntent: intent.primaryIntent,
              summary: memoryRecord.summary,
              metadata: envelope.inferenceMetadata ?? {},
            },
            salience: Math.max(memoryRecord.signalStrength, memoryRecord.legendValue),
            retrievalWeight: memoryRecord.callbackPotential,
            continuityWeight: memoryRecord.continuityValue,
            callbackWeight: memoryRecord.callbackPotential,
            pressureWeight: Math.max(memoryRecord.threatValue, memoryRecord.negotiationValue),
            emotion: buildEmotionProfileFromIntent(intent, envelope.turn),
            relationship: buildRelationshipProfileFromRecord(memoryRecord),
            visibility:
              DEFAULT_BACKEND_CHAT_DL_LANE_CONFIG.defaultInferenceVisibilityShadowOnly
                ? 'SHADOW'
                : 'VISIBLE',
            kind: mapConversationMemoryKindToSequenceAnchorKind(memoryRecord.memoryKind),
          });

    const roomSnapshot = this.services.sequenceMemory.getRoomSnapshot(
      String(envelope.turn.roomId),
      deriveSequenceChannelId(envelope.turn.channel),
      deriveSequenceModeId(envelope.turn.modeId),
    );

    return Object.freeze({
      embedding,
      intent,
      memoryRecord,
      turnAnchor,
      inferenceAnchor,
      roomSnapshot,
    });
  }

  public ingestAcceptedTurns(
    envelopes: readonly BackendChatDlTurnEnvelope[],
  ): readonly BackendChatDlTurnResult[] {
    return envelopes.map((envelope) => this.ingestAcceptedTurn(envelope));
  }

  public writeSceneWindow(write: BackendChatDlSceneWindowWrite): BackendChatDlSceneWindowResult {
    const messages = write.window.messages.map((message) => ({
      inputKind: 'MESSAGE' as EmbeddingInputKind,
      messageId: message.messageId as EmbeddingMessageInput['messageId'],
      text: message.body,
      createdAtMs: message.acceptedAtMs as EmbeddingMessageInput['createdAtMs'],
      sourceKind: write.sourceKind ?? deriveEmbeddingSourceKind(message.actorType),
      channel: message.channelId as EmbeddingMessageInput['channel'],
      roomKind: null,
      pressureTier: null,
      modeId: message.modeId,
      speakerId: message.authorId,
      tags: normalizeStringArray(message.tags ?? []),
      sceneContext: write.sceneContext ?? null,
      metadata: message.metadata as EmbeddingMessageInput['metadata'],
    }));

    const embedding = messages.length
      ? this.embedTranscriptWindow({
          inputKind: 'SCENE',
          windowId: write.window.sceneIdHint ?? `${write.window.roomId}:${write.window.startedAtMs}`,
          label: write.window.trigger,
          messages,
          sceneContext: write.sceneContext ?? null,
          metadata: {
            roomId: write.window.roomId,
            channelId: write.window.channelId,
            modeId: write.window.modeId,
          },
        })
      : null;

    const anchor = this.services.sequenceMemory.upsertSceneWindow(
      write.window,
      embedding ? buildSequenceInferenceVector(embedding) : undefined,
    );

    const snapshot = this.services.sequenceMemory.getRoomSnapshot(
      write.window.roomId,
      write.window.channelId,
      write.window.modeId,
    );

    return Object.freeze({
      embedding,
      anchor,
      snapshot,
    });
  }

  public buildConversationMemoryRetrievalRequest(
    query: BackendChatDlCompositeQuery,
  ): ConversationMemoryRetrievalRequest {
    return {
      roomId: query.roomId as ConversationMemoryRetrievalRequest['roomId'],
      ownerUserId: query.ownerUserId ?? null,
      counterpartUserId: query.counterpartUserId ?? null,
      activeChannel: query.activeChannel,
      roomKind: query.roomKind,
      modeId: query.modeId,
      queryText: normalizeText(query.queryText),
      desiredKinds: query.desiredConversationKinds,
      maxResults: clampInt(
        query.conversationLimit,
        1,
        this.config.defaultConversationRetrievalLimit ??
          DEFAULT_BACKEND_CHAT_DL_LANE_CONFIG.defaultConversationRetrievalLimit,
      ),
      nowMs: (query.nowMs ?? nowMsFromHooks(this.hooks)) as ConversationMemoryRetrievalRequest['nowMs'],
      sceneContext: query.sceneContext ?? null,
    };
  }

  public buildSequenceRetrievalQuery(
    query: BackendChatDlCompositeQuery,
    embedding: EmbeddingVector,
    intent: DialogueIntentResult,
  ): Parameters<SequenceMemoryClient['retrieveRelevantAnchors']>[0] {
    return {
      roomId: query.roomId,
      channelId: query.channelId,
      modeId: query.modeId,
      viewerActorId: query.actorId,
      targetActorIds: query.actorIds,
      trigger: DEFAULT_BACKEND_CHAT_DL_LANE_CONFIG.defaultTrigger,
      limit: clampInt(
        query.sequenceLimit,
        1,
        this.config.defaultSequenceRetrievalLimit ??
          DEFAULT_BACKEND_CHAT_DL_LANE_CONFIG.defaultSequenceRetrievalLimit,
      ),
      includeShadow:
        query.includeShadowAnchors ??
        this.config.includeSequenceShadowReadsByDefault ??
        DEFAULT_BACKEND_CHAT_DL_LANE_CONFIG.includeSequenceShadowReadsByDefault,
      queryText: normalizeText(query.queryText),
      queryVector: buildSequenceInferenceVector(embedding),
      currentEmotion: buildEmotionProfileFromIntent(intent, {
        messageId: '' as ConversationMemoryTurn['messageId'],
        roomId: query.roomId as ConversationMemoryTurn['roomId'],
        roomKind: query.roomKind,
        sessionId: null,
        userId: query.ownerUserId ?? null,
        counterpartUserId: query.counterpartUserId ?? null,
        modeId: query.modeId,
        channel: query.activeChannel,
        body: query.queryText,
        createdAt: (query.nowMs ?? nowMsFromHooks(this.hooks)) as ConversationMemoryTurn['createdAt'],
        pressureTier: query.rankingContext?.pressureTier ?? null,
      }),
      desiredKinds: query.desiredSequenceKinds,
      metadata: {
        queryActorId: query.actorId ?? null,
        queryActorIds: query.actorIds ?? [],
        dominantIntent: intent.primaryIntent,
      },
    };
  }

  public runCompositeQuery(query: BackendChatDlCompositeQuery): BackendChatDlCompositeResult {
    const queryText = normalizeText(query.queryText);
    const now = query.nowMs ?? nowMsFromHooks(this.hooks);

    const queryEmbedding = this.embedMessage({
      inputKind: 'MESSAGE',
      text: queryText,
      createdAtMs: now as EmbeddingMessageInput['createdAtMs'],
      sourceKind: DEFAULT_BACKEND_CHAT_DL_LANE_CONFIG.queryActorType,
      channel: query.activeChannel,
      roomKind: query.roomKind,
      pressureTier: query.rankingContext?.pressureTier ?? null,
      modeId: query.modeId,
      speakerId: query.actorId,
      sceneContext: query.sceneContext ?? null,
      metadata: {
        roomId: query.roomId,
        channelId: query.channelId,
        modeId: query.modeId,
      },
    });

    const intentSnapshot = this.encodeTurn({
      message: {
        inputKind: 'MESSAGE',
        text: queryText,
        createdAtMs: now as EmbeddingMessageInput['createdAtMs'],
        sourceKind: DEFAULT_BACKEND_CHAT_DL_LANE_CONFIG.queryActorType,
        channel: query.activeChannel,
        roomKind: query.roomKind,
        pressureTier: query.rankingContext?.pressureTier ?? null,
        modeId: query.modeId,
        speakerId: query.actorId,
        sceneContext: query.sceneContext ?? null,
      },
      previousMessages: [],
      sceneContext: query.sceneContext ?? null,
      metadata: {
        queryActorIds: query.actorIds ?? [],
      },
    });

    const memorySnapshot = this.services.conversationMemory.retrieveRelevantMemories(
      this.buildConversationMemoryRetrievalRequest(query),
    );

    const sequenceHits = this.services.sequenceMemory.retrieveRelevantAnchors(
      this.buildSequenceRetrievalQuery(query, queryEmbedding, intentSnapshot),
    );

    const sequenceSnapshot = this.services.sequenceMemory.getRoomSnapshot(
      query.roomId,
      query.channelId,
      query.modeId,
    );

    const rankingSnapshot =
      query.rankingContext && query.rankingCandidates?.length
        ? this.services.responseRanking.rankCandidates(
            query.rankingContext,
            query.rankingCandidates,
          )
        : null;

    const retrievedMemories = extractRetrievedConversationMemories(memorySnapshot);
    const topDecision = (rankingSnapshot?.top ?? null) as RankedResponseDecision | null;
    const socialSummary = buildIntentSocialSummary(intentSnapshot.socialRead);

    return Object.freeze({
      readiness: this.getReadiness(),
      queryText,
      embeddingVector: queryEmbedding,
      intentSnapshot,
      socialSummary,
      memorySnapshot,
      retrievedMemories,
      sequenceHits,
      sequenceSnapshot,
      rankingSnapshot,
      topDecision,
      summary: buildCompositeSummary(
        query,
        intentSnapshot,
        memorySnapshot,
        sequenceHits,
        rankingSnapshot,
      ),
    });
  }

  public rankCandidates(
    context: ResponseRankingContext,
    candidates: readonly ResponseRankingCandidateInput[],
  ): ResponseRankingResult {
    return this.services.responseRanking.rankCandidates(context, candidates);
  }

  public rankHelperCandidates(
    context: ResponseRankingContext,
    candidates: readonly ResponseRankingCandidateInput[],
  ): ResponseRankingResult {
    return this.services.responseRanking.rankHelperCandidates(context, candidates);
  }

  public rankHaterCandidates(
    context: ResponseRankingContext,
    candidates: readonly ResponseRankingCandidateInput[],
  ): ResponseRankingResult {
    return this.services.responseRanking.rankHaterCandidates(context, candidates);
  }

  public rankSceneCandidates(
    context: ResponseRankingContext,
    candidates: readonly ResponseRankingCandidateInput[],
  ): ResponseRankingResult {
    return this.services.responseRanking.rankSceneCandidates(context, candidates);
  }

  public maintainRoom(
    request: BackendChatDlRoomMaintenanceRequest,
  ): BackendChatDlRoomMaintenanceResult {
    const now = request.nowMs ?? nowMsFromHooks(this.hooks);

    const closedSceneSummary = request.closeConversationWindow
      ? this.services.conversationMemory.closeSceneWindow(
          request.roomId as ConversationMemoryTurn['roomId'],
          request.ownerUserId ?? null,
          now as never,
        )
      : null;

    const compactedConversationRecords = request.compactConversationMemory
      ? this.services.conversationMemory.compactRoom(
          request.roomId as ConversationMemoryTurn['roomId'],
          request.ownerUserId ?? null,
          now as never,
        )
      : [];

    if (request.decayConversationMemory) {
      this.services.conversationMemory.decayAll(now as never);
    }

    const createdSequenceSummaries = request.compressSequenceMemory
      ? this.services.sequenceMemory.compressAnchors({
          roomId: request.roomId,
          channelId: request.channelId,
          modeId: request.modeId,
          olderThanMs:
            request.sequenceCompressionOlderThanMs ??
            now - 1000 * 60 * 15,
          retainRawRecentCount: clampInt(request.retainRawRecentCount, 1, 8),
          maxAnchorsToProcess: clampInt(
            request.maxAnchorsToProcess,
            1,
            this.config.defaultCompressionBatchSize ??
              DEFAULT_BACKEND_CHAT_DL_LANE_CONFIG.defaultCompressionBatchSize,
          ),
          targetTier:
            request.targetTier ??
            this.config.defaultCompressionTier ??
            DEFAULT_BACKEND_CHAT_DL_LANE_CONFIG.defaultCompressionTier,
        })
      : [];

    const prunedAnchorIds = request.pruneSequenceMemory
      ? this.services.sequenceMemory.pruneRoom(request.roomId)
      : [];

    const sequenceSnapshot = this.services.sequenceMemory.getRoomSnapshot(
      request.roomId,
      request.channelId,
      request.modeId,
    );

    return Object.freeze({
      closedSceneSummary,
      compactedConversationRecords,
      createdSequenceSummaries,
      prunedAnchorIds,
      sequenceSnapshot,
      sequenceStats: this.services.sequenceMemory.getStats(),
    });
  }

  public getSequenceSnapshot(
    roomId: string,
    channelId: ChatDlChannelId,
    modeId: ChatDlModeId,
  ): SequenceMemorySnapshot {
    return this.services.sequenceMemory.getRoomSnapshot(roomId, channelId, modeId);
  }

  public getSequenceStats(): Readonly<SequenceMemoryStats> {
    return this.services.sequenceMemory.getStats();
  }

  public resetSequenceRoom(roomId: string): void {
    this.services.sequenceMemory.resetRoom(roomId);
  }

  public resetSequenceAll(): void {
    this.services.sequenceMemory.resetAll();
  }
}

// ============================================================================
// MARK: Factory helpers
// ============================================================================

export function createBackendChatDlRuntime(
  config: BackendChatDlLaneConfig = {},
): BackendChatDlRuntime {
  return new BackendChatDlRuntime(config);
}

export function createBackendChatDlLane(
  config: BackendChatDlLaneConfig = {},
): BackendChatDlLane {
  return createBackendChatDlRuntime(config).asLane();
}

export function getBackendChatDlLaneHealth(
  config: BackendChatDlLaneConfig = {},
): BackendChatDlLaneHealthReport {
  return createBackendChatDlRuntime(config).getHealthReport();
}

export function getBackendChatDlLaneReadiness(
  config: BackendChatDlLaneConfig = {},
): BackendChatDlAggregateReadiness {
  return createBackendChatDlRuntime(config).getReadiness();
}

// ============================================================================
// MARK: Bridge helpers
// ============================================================================

export function buildBackendChatEmbeddingInputFromTurn(
  envelope: BackendChatDlTurnEnvelope,
): EmbeddingMessageInput {
  const runtime = createBackendChatDlRuntime();
  return runtime.buildTurnEnvelopeEmbeddingInput(envelope);
}

export function buildBackendChatIntentInputFromTurn(
  envelope: BackendChatDlTurnEnvelope,
): DialogueIntentTurnInput {
  const runtime = createBackendChatDlRuntime();
  return runtime.buildTurnEnvelopeIntentInput(envelope);
}

export function buildBackendChatSequenceMessageFromTurn(
  envelope: BackendChatDlTurnEnvelope,
): SequenceMemorySourceMessage {
  const runtime = createBackendChatDlRuntime();
  return runtime.buildSequenceSourceMessage(envelope);
}

export function buildBackendChatSceneWindowFromTurns(input: {
  readonly roomId: string;
  readonly channelId: ChatDlChannelId;
  readonly modeId: ChatDlModeId;
  readonly turns: readonly BackendChatDlTurnEnvelope[];
  readonly trigger?: SequenceMemoryTrigger;
  readonly sceneIdHint?: string;
}): SequenceMemorySceneWindow {
  const turns = [...input.turns]
    .sort((a, b) => Number(a.turn.createdAt) - Number(b.turn.createdAt));

  const messages = turns.map((turn) =>
    buildSequenceSourceMessageFromTurn(
      turn.turn,
      turn.actorType ?? deriveSequenceActorType(turn.sourceKind),
      turn.sequenceTags,
    ),
  );

  return {
    roomId: input.roomId,
    channelId: input.channelId,
    modeId: input.modeId,
    startedAtMs: messages[0]?.acceptedAtMs ?? Date.now(),
    endedAtMs: messages[messages.length - 1]?.acceptedAtMs ?? Date.now(),
    messages,
    trigger: input.trigger ?? 'INFERENCE_SNAPSHOT',
    sceneIdHint: input.sceneIdHint,
  };
}

export function bridgeConversationMemoryRecordToSequenceInference(input: {
  readonly record: ConversationMemoryRecord;
  readonly intent: DialogueIntentResult;
  readonly embedding: EmbeddingVector;
  readonly runtime?: BackendChatDlRuntime;
}): SequenceMemoryAnchor {
  const runtime = input.runtime ?? createBackendChatDlRuntime();
  return runtime.services.sequenceMemory.upsertInferenceAnchor({
    roomId: String(input.record.roomId),
    channelId: deriveSequenceChannelId(input.record.channel),
    modeId: deriveSequenceModeId(input.record.modeId),
    actorIds: normalizeStringArray([
      String(input.record.ownerUserId ?? ''),
      String(input.record.counterpartUserId ?? ''),
    ]),
    text: buildInferenceTextFromRecord(input.record, input.intent),
    vector: buildSequenceInferenceVector(input.embedding),
    metadata: {
      memoryId: input.record.memoryId,
      title: input.record.title,
      summary: input.record.summary,
      primaryIntent: input.intent.primaryIntent,
    },
    salience: Math.max(input.record.signalStrength, input.record.legendValue),
    retrievalWeight: input.record.callbackPotential,
    continuityWeight: input.record.continuityValue,
    callbackWeight: input.record.callbackPotential,
    pressureWeight: Math.max(input.record.threatValue, input.record.negotiationValue),
    emotion: buildEmotionProfileFromIntent(input.intent, {
      messageId: '' as ConversationMemoryTurn['messageId'],
      roomId: input.record.roomId,
      roomKind: input.record.roomKind,
      sessionId: input.record.sessionId,
      userId: input.record.ownerUserId,
      counterpartUserId: input.record.counterpartUserId,
      modeId: input.record.modeId,
      channel: input.record.channel,
      body: input.record.body,
      createdAt: input.record.createdAt,
      pressureTier: null,
    }),
    relationship: buildRelationshipProfileFromRecord(input.record),
    visibility: 'VISIBLE',
    kind: mapConversationMemoryKindToSequenceAnchorKind(input.record.memoryKind),
  });
}

// ============================================================================
// MARK: Composite convenience helpers
// ============================================================================

export function ingestBackendChatDlTurn(
  envelope: BackendChatDlTurnEnvelope,
  config: BackendChatDlLaneConfig = {},
): BackendChatDlTurnResult {
  return createBackendChatDlRuntime(config).ingestAcceptedTurn(envelope);
}

export function ingestBackendChatDlTurns(
  envelopes: readonly BackendChatDlTurnEnvelope[],
  config: BackendChatDlLaneConfig = {},
): readonly BackendChatDlTurnResult[] {
  return createBackendChatDlRuntime(config).ingestAcceptedTurns(envelopes);
}

export function writeBackendChatDlSceneWindow(
  write: BackendChatDlSceneWindowWrite,
  config: BackendChatDlLaneConfig = {},
): BackendChatDlSceneWindowResult {
  return createBackendChatDlRuntime(config).writeSceneWindow(write);
}

export function queryBackendChatDlComposite(
  query: BackendChatDlCompositeQuery,
  config: BackendChatDlLaneConfig = {},
): BackendChatDlCompositeResult {
  return createBackendChatDlRuntime(config).runCompositeQuery(query);
}

export function maintainBackendChatDlRoom(
  request: BackendChatDlRoomMaintenanceRequest,
  config: BackendChatDlLaneConfig = {},
): BackendChatDlRoomMaintenanceResult {
  return createBackendChatDlRuntime(config).maintainRoom(request);
}

export function rankBackendChatDlCandidates(
  context: ResponseRankingContext,
  candidates: readonly ResponseRankingCandidateInput[],
  config: BackendChatDlLaneConfig = {},
): ResponseRankingResult {
  return createBackendChatDlRuntime(config).rankCandidates(context, candidates);
}

export function rankBackendChatDlHelperCandidates(
  context: ResponseRankingContext,
  candidates: readonly ResponseRankingCandidateInput[],
  config: BackendChatDlLaneConfig = {},
): ResponseRankingResult {
  return createBackendChatDlRuntime(config).rankHelperCandidates(context, candidates);
}

export function rankBackendChatDlHaterCandidates(
  context: ResponseRankingContext,
  candidates: readonly ResponseRankingCandidateInput[],
  config: BackendChatDlLaneConfig = {},
): ResponseRankingResult {
  return createBackendChatDlRuntime(config).rankHaterCandidates(context, candidates);
}

export function rankBackendChatDlSceneCandidates(
  context: ResponseRankingContext,
  candidates: readonly ResponseRankingCandidateInput[],
  config: BackendChatDlLaneConfig = {},
): ResponseRankingResult {
  return createBackendChatDlRuntime(config).rankSceneCandidates(context, candidates);
}

// ============================================================================
// MARK: Higher-order orchestration helpers
// ============================================================================

export interface BackendChatDlFullTurnPipelineRequest {
  readonly envelope: BackendChatDlTurnEnvelope;
  readonly followupCompositeQuery?: Omit<BackendChatDlCompositeQuery, 'roomId' | 'channelId' | 'modeId' | 'roomKind' | 'activeChannel' | 'ownerUserId'>;
  readonly rankingCandidates?: readonly ResponseRankingCandidateInput[];
  readonly rankingContext?: ResponseRankingContext | null;
}

export interface BackendChatDlFullTurnPipelineResult {
  readonly turnResult: BackendChatDlTurnResult;
  readonly compositeResult: BackendChatDlCompositeResult | null;
  readonly rankingResult: ResponseRankingResult | null;
}

export function runBackendChatDlFullTurnPipeline(
  request: BackendChatDlFullTurnPipelineRequest,
  config: BackendChatDlLaneConfig = {},
): BackendChatDlFullTurnPipelineResult {
  const runtime = createBackendChatDlRuntime(config);
  const turnResult = runtime.ingestAcceptedTurn(request.envelope);

  const compositeResult = request.followupCompositeQuery
    ? runtime.runCompositeQuery({
        roomId: String(request.envelope.turn.roomId),
        channelId: deriveSequenceChannelId(request.envelope.turn.channel),
        modeId: deriveSequenceModeId(request.envelope.turn.modeId),
        roomKind: request.envelope.turn.roomKind,
        activeChannel: request.envelope.turn.channel,
        ownerUserId: request.envelope.context.ownerUserId,
        counterpartUserId: request.envelope.context.counterpartUserId,
        queryText: request.followupCompositeQuery.queryText ?? request.envelope.turn.body,
        actorId: request.followupCompositeQuery.actorId ?? String(request.envelope.turn.userId ?? ''),
        actorIds: request.followupCompositeQuery.actorIds,
        desiredConversationKinds: request.followupCompositeQuery.desiredConversationKinds,
        desiredSequenceKinds: request.followupCompositeQuery.desiredSequenceKinds,
        conversationLimit: request.followupCompositeQuery.conversationLimit,
        sequenceLimit: request.followupCompositeQuery.sequenceLimit,
        includeShadowAnchors: request.followupCompositeQuery.includeShadowAnchors,
        sceneContext: request.followupCompositeQuery.sceneContext ?? request.envelope.sceneContext ?? null,
        rankingContext: request.followupCompositeQuery.rankingContext ?? null,
        rankingCandidates: request.followupCompositeQuery.rankingCandidates,
        nowMs: request.followupCompositeQuery.nowMs,
      })
    : null;

  const rankingResult =
    request.rankingContext && request.rankingCandidates?.length
      ? runtime.rankCandidates(request.rankingContext, request.rankingCandidates)
      : null;

  return Object.freeze({
    turnResult,
    compositeResult,
    rankingResult,
  });
}

// ============================================================================
// MARK: Diagnostics helpers
// ============================================================================

export interface BackendChatDlDiagnosticsSnapshot {
  readonly health: BackendChatDlLaneHealthReport;
  readonly readiness: BackendChatDlAggregateReadiness;
  readonly versions: BackendChatDlModuleVersions;
  readonly conversationMemoryDiagnostics: Readonly<Record<string, unknown>>;
  readonly embeddingCacheRows: ReadonlyArray<Readonly<Record<string, unknown>>>;
  readonly sequenceStats: Readonly<SequenceMemoryStats>;
}

export function captureBackendChatDlDiagnostics(
  config: BackendChatDlLaneConfig = {},
): BackendChatDlDiagnosticsSnapshot {
  const runtime = createBackendChatDlRuntime(config);
  return Object.freeze({
    health: runtime.getHealthReport(),
    readiness: runtime.getReadiness(),
    versions: runtime.getModuleVersions(),
    conversationMemoryDiagnostics: runtime.getConversationMemoryDiagnostics(),
    embeddingCacheRows: runtime.exportEmbeddingCacheSnapshot(),
    sequenceStats: runtime.getSequenceStats(),
  });
}

// ============================================================================
// MARK: Aggregate typed recipes
// ============================================================================

export interface BackendChatDlQueryRecipe {
  readonly roomId: string;
  readonly channelId: ChatDlChannelId;
  readonly modeId: ChatDlModeId;
  readonly roomKind: ConversationMemoryContext['roomKind'];
  readonly activeChannel: ConversationMemoryContext['activeChannel'];
  readonly ownerUserId: ConversationMemoryContext['ownerUserId'];
  readonly queryText: string;
  readonly sourceKind?: EmbeddingSourceKind;
  readonly actorType?: SequenceMemoryActorType;
  readonly semanticFamilies?: readonly EmbeddingSemanticFamily[];
  readonly expectedIntent?: DialogueIntentKind;
  readonly candidateIntentFamily?: ResponseCandidateIntentFamily;
  readonly candidateSourceKind?: ResponseCandidateSourceKind;
  readonly candidateBody?: string;
  readonly candidateChannel?: ResponseRankingCandidateInput['channelPreference'];
}

export interface BackendChatDlQueryRecipeResult {
  readonly embedding: EmbeddingVector;
  readonly intent: DialogueIntentResult;
  readonly retrieval: BackendChatDlCompositeResult;
  readonly ranking: ResponseRankingResult | null;
}

export function executeBackendChatDlQueryRecipe(
  recipe: BackendChatDlQueryRecipe,
  config: BackendChatDlLaneConfig = {},
): BackendChatDlQueryRecipeResult {
  const runtime = createBackendChatDlRuntime(config);
  const embedding = runtime.embedMessage({
    inputKind: 'MESSAGE',
    text: recipe.queryText,
    sourceKind: recipe.sourceKind ?? deriveEmbeddingSourceKind(recipe.actorType),
    channel: recipe.activeChannel,
    roomKind: recipe.roomKind,
    modeId: recipe.modeId,
    speakerId: recipe.ownerUserId ?? undefined,
    tags: normalizeStringArray(recipe.semanticFamilies?.map((family) => String(family))),
  });
  const intent = runtime.encodeTurn({
    message: {
      inputKind: 'MESSAGE',
      text: recipe.queryText,
      sourceKind: recipe.sourceKind ?? deriveEmbeddingSourceKind(recipe.actorType),
      channel: recipe.activeChannel,
      roomKind: recipe.roomKind,
      modeId: recipe.modeId,
      speakerId: recipe.ownerUserId ?? undefined,
      tags: normalizeStringArray(recipe.semanticFamilies?.map((family) => String(family))),
    },
    metadata: {
      expectedIntent: recipe.expectedIntent ?? null,
    },
  });
  const retrieval = runtime.runCompositeQuery({
    roomId: recipe.roomId,
    channelId: recipe.channelId,
    modeId: recipe.modeId,
    roomKind: recipe.roomKind,
    activeChannel: recipe.activeChannel,
    ownerUserId: recipe.ownerUserId,
    queryText: recipe.queryText,
  });
  const ranking = recipe.candidateBody
    ? runtime.rankCandidates(
        {
          roomId: recipe.roomId as ResponseRankingContext['roomId'],
          roomKind: recipe.roomKind,
          sessionId: null,
          actorUserId: recipe.ownerUserId ?? null,
          targetUserId: null,
          activeChannel: recipe.activeChannel,
          pressureTier: null,
          activeModeId: recipe.modeId,
          sovereigntyProximity: 0.5 as ResponseRankingContext['sovereigntyProximity'],
          shieldIntegrity: 0.5 as ResponseRankingContext['shieldIntegrity'],
          publicWitnessHeat: 0.25 as ResponseRankingContext['publicWitnessHeat'],
          helperUrgency: 0.2 as ResponseRankingContext['helperUrgency'],
          helperFatigue: 0.1 as ResponseRankingContext['helperFatigue'],
          haterPressure: 0.15 as ResponseRankingContext['haterPressure'],
          toxicityRisk: 0.1 as ResponseRankingContext['toxicityRisk'],
          churnRisk: 0.1 as ResponseRankingContext['churnRisk'],
          recoveryPotential: 0.35 as ResponseRankingContext['recoveryPotential'],
          currentSignals: [],
          transcriptWindow: [],
          sceneContext: null,
        },
        [
          {
            candidateId: 'recipe_candidate',
            sourceKind: recipe.candidateSourceKind ?? 'ambient',
            actionKind: 'message',
            intentFamily: recipe.candidateIntentFamily ?? 'witness',
            body: recipe.candidateBody,
            channelPreference: recipe.candidateChannel ?? 'same',
          },
        ],
      )
    : null;

  return Object.freeze({
    embedding,
    intent,
    retrieval,
    ranking,
  });
}

// ============================================================================
// MARK: Stateless ports
// ============================================================================

export function statelessEmbedBackendChatMessage(
  ...args: Parameters<typeof embedAuthoritativeChatMessage>
): ReturnType<typeof embedAuthoritativeChatMessage> {
  return embedAuthoritativeChatMessage(...args);
}

export function statelessEmbedBackendChatTranscriptWindow(
  ...args: Parameters<typeof embedAuthoritativeTranscriptWindow>
): ReturnType<typeof embedAuthoritativeTranscriptWindow> {
  return embedAuthoritativeTranscriptWindow(...args);
}

export function statelessEncodeBackendChatIntentTurn(
  ...args: Parameters<typeof encodeDialogueIntentTurn>
): ReturnType<typeof encodeDialogueIntentTurn> {
  return encodeDialogueIntentTurn(...args);
}

export function statelessEncodeBackendChatIntentSequence(
  ...args: Parameters<typeof encodeDialogueIntentSequence>
): ReturnType<typeof encodeDialogueIntentSequence> {
  return encodeDialogueIntentSequence(...args);
}

export function statelessIngestBackendConversationMemoryTurn(
  ...args: Parameters<typeof ingestBackendChatMemoryTurn>
): ReturnType<typeof ingestBackendChatMemoryTurn> {
  return ingestBackendChatMemoryTurn(...args);
}

export function statelessRetrieveBackendConversationMemories(
  ...args: Parameters<typeof retrieveBackendConversationMemories>
): ReturnType<typeof retrieveBackendConversationMemories> {
  return retrieveBackendConversationMemories(...args);
}

export function statelessRankBackendChatResponses(
  ...args: Parameters<typeof rankBackendChatResponseCandidates>
): ReturnType<typeof rankBackendChatResponseCandidates> {
  return rankBackendChatResponseCandidates(...args);
}

export function statelessRankBackendChatHelpers(
  ...args: Parameters<typeof rankBackendChatHelperCandidates>
): ReturnType<typeof rankBackendChatHelperCandidates> {
  return rankBackendChatHelperCandidates(...args);
}

export function statelessRankBackendChatHaters(
  ...args: Parameters<typeof rankBackendChatHaterCandidates>
): ReturnType<typeof rankBackendChatHaterCandidates> {
  return rankBackendChatHaterCandidates(...args);
}

// ============================================================================
// MARK: Barrel default export
// ============================================================================

export default BackendChatDlRuntime;
