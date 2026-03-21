/* eslint-disable max-lines */
/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT INTELLIGENCE / DL BARREL
 * FILE: backend/src/game/engine/chat/intelligence/dl/index.ts
 * VERSION: 2026.03.21-intelligence-dl-barrel-15x
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
 * Why this file exists
 * --------------------
 * The current repo split exposes two real homes:
 * - backend/src/game/engine/chat/dl/
 * - backend/src/game/engine/chat/intelligence/dl/
 *
 * The legacy backend DL lane already owns:
 * - deterministic / hybrid message embeddings,
 * - dialogue-intent encoding,
 * - accepted-truth conversation memory,
 * - response ranking,
 * - and sequence-memory coordination.
 *
 * The intelligence DL lane now adds:
 * - deterministic memory-anchor ranking,
 * - durable anchor storage and proof binding,
 * - and retrieval-context packet construction.
 *
 * This index therefore needs to do five things at once:
 * 1. export the full public surface across both homes,
 * 2. preserve backwards-compatible import ergonomics,
 * 3. compose shared dependencies once instead of repeatedly,
 * 4. expose runtime readiness / version law / surface metadata,
 * 5. provide one coherent entry point for backend chat orchestration.
 *
 * Ownership doctrine
 * ------------------
 * - This file does not become transcript-truth owner.
 * - This file does not bypass moderation, channel law, or orchestration.
 * - This file does not replace frontend local mirrors or transport concerns.
 * - This file does provide a coherent backend intelligence lane that is
 *   import-safe, replay-safe, and retrieval-ready.
 * ============================================================================
 */

import {
  CHAT_CONVERSATION_MEMORY_MODEL_VERSION,
  ConversationMemoryModel,
  createConversationMemoryModel,
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
  type EmbeddingMessageInput,
  type EmbeddingVector,
  type MessageEmbeddingClientOptions,
  type MessageEmbeddingClientClockPort,
  type TranscriptWindowInput,
} from '../../dl/MessageEmbeddingClient';
import {
  CHAT_RESPONSE_RANKING_MODEL_VERSION,
  ResponseRankingModel,
  createResponseRankingModel,
  type ResponseRankingCandidateInput,
  type ResponseRankingContext,
  type ResponseRankingDependencyBundle,
  type ResponseRankingResult,
} from '../../dl/ResponseRankingModel';
import {
  SequenceMemoryClient,
  createSequenceMemoryClient,
  type SequenceMemoryActorType,
  type SequenceMemoryAnchor,
  type SequenceMemoryClientConfig,
  type SequenceMemoryClientDependencies,
  type SequenceMemorySourceMessage,
  type SequenceMemoryVector,
} from '../../dl/SequenceMemoryClient';
import {
  MEMORY_RANKING_POLICY_VERSION,
  createMemoryRankingPolicy,
  type MemoryRankingPolicyApi,
  type MemoryRankingPolicyOptions,
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
  createRetrievalContextBuilder,
  type RetrievalContextBuilderApi,
  type RetrievalContextBuilderOptions,
  type RetrievalContextBuildRequest,
  type RetrievalContextPacket,
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
  '2026.03.21-intelligence-dl-barrel-15x' as const;

export const BACKEND_CHAT_INTELLIGENCE_DL_RUNTIME_LAWS = Object.freeze([
  'One import surface should expose the real backend chat intelligence lane.',
  'Retrieval continuity should compose with legacy backend DL, not compete with it.',
  'Shared embedding and intent dependencies should be instantiated once and reused.',
  'Conversation memory, response ranking, and retrieval anchors must remain explainable.',
  'This barrel exists to reduce drift between chat/dl and chat/intelligence/dl.',
  'The surface map is part of the product: imports should communicate responsibility.',
  'Do not flatten the lane into a generic SDK shim.',
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

export interface BackendChatIntelligenceDlSurfaceEntry {
  readonly id: string;
  readonly relativePath: string;
  readonly concern: BackendChatIntelligenceDlConcern;
  readonly generated: boolean;
  readonly ownsTruth: boolean;
  readonly description: string;
  readonly moduleVersion: string;
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
} as const);

export interface BackendChatIntelligenceDlRuntimeHealth {
  readonly version: typeof BACKEND_CHAT_INTELLIGENCE_DL_VERSION;
  readonly surfaceCount: number;
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

export interface BackendChatIntelligenceDlRuntime {
  readonly version: typeof BACKEND_CHAT_INTELLIGENCE_DL_VERSION;
  readonly surface: typeof BACKEND_CHAT_INTELLIGENCE_DL_SURFACE;
  readonly versions: typeof BACKEND_CHAT_INTELLIGENCE_DL_VERSION_MAP;
  readonly laws: typeof BACKEND_CHAT_INTELLIGENCE_DL_RUNTIME_LAWS;

  readonly embeddingClient: MessageEmbeddingClient;
  readonly intentEncoder: DialogueIntentEncoder;
  readonly conversationMemoryModel: ConversationMemoryModel;
  readonly responseRankingModel: ResponseRankingModel;
  readonly sequenceMemoryClient: SequenceMemoryClient;
  readonly memoryRankingPolicy: MemoryRankingPolicyApi;
  readonly memoryAnchorStore: MemoryAnchorStoreApi;
  readonly retrievalContextBuilder: RetrievalContextBuilderApi;

  health(): BackendChatIntelligenceDlRuntimeHealth;

  embedMessage(input: EmbeddingMessageInput): EmbeddingVector;
  embedTranscriptWindow(input: TranscriptWindowInput): EmbeddingVector;

  encodeIntentTurn(input: DialogueIntentTurnInput): DialogueIntentResult;
  encodeIntentSequence(input: DialogueIntentSequenceInput): DialogueIntentSequenceResult;

  ingestAcceptedConversationTurn(
    turn: ConversationMemoryTurn,
    context: ConversationMemoryContext,
  ): ConversationMemoryRecord;
  retrieveConversationMemories(
    request: ConversationMemoryRetrievalRequest,
  ): ConversationMemoryRetrievalResult;

  rankCandidates(
    context: ResponseRankingContext,
    candidates: readonly ResponseRankingCandidateInput[],
  ): ResponseRankingResult;
  rankHelperCandidates(
    context: ResponseRankingContext,
    candidates: readonly ResponseRankingCandidateInput[],
  ): ResponseRankingResult;
  rankHaterCandidates(
    context: ResponseRankingContext,
    candidates: readonly ResponseRankingCandidateInput[],
  ): ResponseRankingResult;

  queryAnchors(request: MemoryAnchorStoreQueryRequest): MemoryAnchorQueryResponse;
  buildRetrievalContext(request: RetrievalContextBuildRequest): RetrievalContextPacket;
  buildRetrievalPrompt(request: RetrievalContextBuildRequest): string;

  ingestAcceptedTurnAcrossMemorySurfaces(
    input: BackendChatIntelligenceAcceptedTurnInput,
  ): BackendChatIntelligenceAcceptedTurnResult;
}

export function createBackendChatIntelligenceDlRuntime(
  deps: BackendChatIntelligenceDlRuntimeDependencies = {},
): BackendChatIntelligenceDlRuntime {
  const sharedNow = deps.now ?? deps.sequenceMemoryDependencies?.now ?? defaultNow;

  const embeddingClient =
    deps.embeddingClient ??
    createMessageEmbeddingClient({
      ...(deps.embeddingClientOptions ?? {}),
      clock: createEmbeddingClock(sharedNow),
    });

  const intentEncoder =
    deps.intentEncoder ??
    createDialogueIntentEncoder({
      ...(deps.intentEncoderOptions ?? {}),
      embeddingClient,
      clock: createIntentClock(sharedNow),
    });

  const conversationMemoryModel =
    deps.conversationMemoryModel ??
    createConversationMemoryModel({
      ...(deps.conversationMemoryModelDependencies ?? {}),
      embeddingClient,
      intentEncoder,
      now: (() => sharedNow()) as unknown as NonNullable<ConversationMemoryModelDependencies['now']>,
    });

  const responseRankingModel =
    deps.responseRankingModel ??
    createResponseRankingModel({
      ...(deps.responseRankingDependencies ?? {}),
      embeddingClient,
      intentEncoder,
      now: (() => sharedNow()) as unknown as NonNullable<ResponseRankingDependencyBundle['now']>,
    });

  const sequenceMemoryClient =
    deps.sequenceMemoryClient ??
    createSequenceMemoryClient(
      deps.sequenceMemoryConfig ?? {},
      {
        ...(deps.sequenceMemoryDependencies ?? {}),
        now:
          deps.sequenceMemoryDependencies?.now ??
          (sharedNow as unknown as NonNullable<SequenceMemoryClientDependencies['now']>),
      },
    );

  const memoryRankingPolicy =
    deps.memoryRankingPolicy ??
    createMemoryRankingPolicy(deps.memoryRankingPolicyOptions ?? {});

  const memoryAnchorStore =
    deps.memoryAnchorStore ??
    createMemoryAnchorStore({
      ...(deps.memoryAnchorStoreOptions ?? {}),
      rankingPolicy: memoryRankingPolicy,
      now: sharedNow,
    });

  const retrievalContextBuilder =
    deps.retrievalContextBuilder ??
    createRetrievalContextBuilder(
      memoryAnchorStore,
      deps.retrievalContextBuilderOptions ?? {},
    );

  return Object.freeze<BackendChatIntelligenceDlRuntime>({
    version: BACKEND_CHAT_INTELLIGENCE_DL_VERSION,
    surface: BACKEND_CHAT_INTELLIGENCE_DL_SURFACE,
    versions: BACKEND_CHAT_INTELLIGENCE_DL_VERSION_MAP,
    laws: BACKEND_CHAT_INTELLIGENCE_DL_RUNTIME_LAWS,

    embeddingClient,
    intentEncoder,
    conversationMemoryModel,
    responseRankingModel,
    sequenceMemoryClient,
    memoryRankingPolicy,
    memoryAnchorStore,
    retrievalContextBuilder,

    health(): BackendChatIntelligenceDlRuntimeHealth {
      return createRuntimeHealth({
        embeddingClient,
        intentEncoder,
        conversationMemoryModel,
        responseRankingModel,
        sequenceMemoryClient,
        memoryRankingPolicy,
        memoryAnchorStore,
        retrievalContextBuilder,
      });
    },

    embedMessage(input: EmbeddingMessageInput): EmbeddingVector {
      return embeddingClient.embedMessage(input);
    },

    embedTranscriptWindow(input: TranscriptWindowInput): EmbeddingVector {
      return embeddingClient.embedTranscriptWindow(input);
    },

    encodeIntentTurn(input: DialogueIntentTurnInput): DialogueIntentResult {
      return intentEncoder.encodeTurn(input);
    },

    encodeIntentSequence(input: DialogueIntentSequenceInput): DialogueIntentSequenceResult {
      return intentEncoder.encodeSequence(input);
    },

    ingestAcceptedConversationTurn(
      turn: ConversationMemoryTurn,
      context: ConversationMemoryContext,
    ): ConversationMemoryRecord {
      return conversationMemoryModel.ingestAcceptedTurn(turn, context);
    },

    retrieveConversationMemories(
      request: ConversationMemoryRetrievalRequest,
    ): ConversationMemoryRetrievalResult {
      return conversationMemoryModel.retrieveRelevantMemories(request);
    },

    rankCandidates(
      context: ResponseRankingContext,
      candidates: readonly ResponseRankingCandidateInput[],
    ): ResponseRankingResult {
      return responseRankingModel.rankCandidates(context, candidates);
    },

    rankHelperCandidates(
      context: ResponseRankingContext,
      candidates: readonly ResponseRankingCandidateInput[],
    ): ResponseRankingResult {
      return responseRankingModel.rankHelperCandidates(context, candidates);
    },

    rankHaterCandidates(
      context: ResponseRankingContext,
      candidates: readonly ResponseRankingCandidateInput[],
    ): ResponseRankingResult {
      return responseRankingModel.rankHaterCandidates(context, candidates);
    },

    queryAnchors(request: MemoryAnchorStoreQueryRequest): MemoryAnchorQueryResponse {
      return memoryAnchorStore.query(request);
    },

    buildRetrievalContext(request: RetrievalContextBuildRequest): RetrievalContextPacket {
      return retrievalContextBuilder.build(request);
    },

    buildRetrievalPrompt(request: RetrievalContextBuildRequest): string {
      return retrievalContextBuilder.toPrompt(retrievalContextBuilder.build(request));
    },

    ingestAcceptedTurnAcrossMemorySurfaces(
      input: BackendChatIntelligenceAcceptedTurnInput,
    ): BackendChatIntelligenceAcceptedTurnResult {
      const conversationRecord = conversationMemoryModel.ingestAcceptedTurn(
        input.turn,
        input.context,
      );

      const embeddingVector = embeddingClient.embedMessage({
        messageId: input.turn.messageId,
        text: input.turn.body,
        createdAtMs: input.turn.createdAt,
        channel: input.turn.channel,
        roomKind: input.turn.roomKind,
        pressureTier: input.turn.pressureTier ?? null,
        modeId: input.turn.modeId ?? input.context.modeId ?? null,
        speakerId: input.authorId ?? input.turn.userId ?? input.context.ownerUserId ?? null,
        tags: input.tags,
        metadata: {
          source: 'createBackendChatIntelligenceDlRuntime.ingestAcceptedTurnAcrossMemorySurfaces',
          conversationMemoryId: conversationRecord.memoryId,
          roomId: input.turn.roomId,
          sessionId: input.turn.sessionId ?? input.context.sessionId ?? null,
          modeId: input.turn.modeId ?? input.context.modeId ?? null,
          authorId: input.authorId ?? input.turn.userId ?? input.context.ownerUserId ?? null,
          counterpartUserId:
            input.turn.counterpartUserId ?? input.context.counterpartUserId ?? null,
        },
      });

      const sequenceSourceMessage: SequenceMemorySourceMessage = Object.freeze({
        messageId: input.turn.messageId,
        roomId: input.turn.roomId,
        channelId: input.turn.channel,
        modeId: input.turn.modeId ?? input.context.modeId ?? 'UNKNOWN',
        authorId:
          input.authorId ??
          input.turn.userId ??
          input.context.ownerUserId ??
          'system::unknown-author',
        actorType: input.actorType ?? inferSequenceActorType(input),
        body: input.turn.body,
        createdAtMs: input.turn.createdAt,
        acceptedAtMs: input.context.nowMs ?? sharedNow(),
        sequence: resolveSequenceNumber(input.turn.createdAt),
        eventId: input.eventId,
        causalParentIds: input.causalParentIds,
        moderationMaskLevel: input.moderationMaskLevel,
        proofHash: input.proofHash,
        tags: input.tags,
        metadata: {
          conversationMemoryId: conversationRecord.memoryId,
          relationshipHeat: conversationRecord.relationshipHeat,
          callbackPotential: conversationRecord.callbackPotential,
          witnessValue: conversationRecord.witnessValue,
          legendValue: conversationRecord.legendValue,
          continuityValue: conversationRecord.continuityValue,
          messagePressureTier: input.turn.pressureTier ?? null,
          contextPressureTier: input.context.pressureTier ?? null,
          roomKind: input.turn.roomKind,
          activeChannel: input.context.activeChannel,
          ...input.metadata,
        },
      });

      const sequenceAnchor = sequenceMemoryClient.appendMessageAsTurnAnchor(
        sequenceSourceMessage,
        toSequenceMemoryVector(embeddingVector),
      );

      return Object.freeze({
        conversationRecord,
        embeddingVector,
        sequenceSourceMessage,
        sequenceAnchor,
      });
    },
  });
}

export function createBackendChatIntelligenceRetrievalRuntime(
  deps: Pick<
    BackendChatIntelligenceDlRuntimeDependencies,
    | 'now'
    | 'memoryRankingPolicy'
    | 'memoryRankingPolicyOptions'
    | 'memoryAnchorStore'
    | 'memoryAnchorStoreOptions'
    | 'retrievalContextBuilder'
    | 'retrievalContextBuilderOptions'
  > = {},
): Pick<
  BackendChatIntelligenceDlRuntime,
  | 'version'
  | 'surface'
  | 'versions'
  | 'laws'
  | 'memoryRankingPolicy'
  | 'memoryAnchorStore'
  | 'retrievalContextBuilder'
  | 'health'
  | 'queryAnchors'
  | 'buildRetrievalContext'
  | 'buildRetrievalPrompt'
> {
  const runtime = createBackendChatIntelligenceDlRuntime(deps);

  return Object.freeze({
    version: runtime.version,
    surface: runtime.surface,
    versions: runtime.versions,
    laws: runtime.laws,
    memoryRankingPolicy: runtime.memoryRankingPolicy,
    memoryAnchorStore: runtime.memoryAnchorStore,
    retrievalContextBuilder: runtime.retrievalContextBuilder,
    health: runtime.health,
    queryAnchors: runtime.queryAnchors,
    buildRetrievalContext: runtime.buildRetrievalContext,
    buildRetrievalPrompt: runtime.buildRetrievalPrompt,
  });
}

export function getBackendChatIntelligenceDlHealth(
  runtime: Pick<
    BackendChatIntelligenceDlRuntime,
    | 'embeddingClient'
    | 'intentEncoder'
    | 'conversationMemoryModel'
    | 'responseRankingModel'
    | 'sequenceMemoryClient'
    | 'memoryRankingPolicy'
    | 'memoryAnchorStore'
    | 'retrievalContextBuilder'
  >,
): BackendChatIntelligenceDlRuntimeHealth {
  return createRuntimeHealth(runtime);
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
    concerns: Object.freeze(
      BACKEND_CHAT_INTELLIGENCE_DL_SURFACE.map((entry) => entry.concern),
    ),
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

function createEmbeddingClock(
  now: () => number,
): { now(): ReturnType<MessageEmbeddingClientClockPort['now']> } {
  return Object.freeze({
    now: () => now() as unknown as ReturnType<MessageEmbeddingClientClockPort['now']>,
  });
}

function createIntentClock(
  now: () => number,
): { now(): ReturnType<MessageEmbeddingClientClockPort['now']> } {
  return Object.freeze({
    now: () => now() as unknown as ReturnType<MessageEmbeddingClientClockPort['now']>,
  });
}

function defaultNow(): number {
  return Date.now();
}

function inferSequenceActorType(
  input: BackendChatIntelligenceAcceptedTurnInput,
): SequenceMemoryActorType {
  const ownerUserId = input.context.ownerUserId;
  const turnUserId = input.turn.userId;

  if (turnUserId && ownerUserId && turnUserId === ownerUserId) {
    return 'PLAYER';
  }

  const channel = String(input.turn.channel ?? '').toUpperCase();
  const metadataString = JSON.stringify(input.metadata ?? {}).toUpperCase();

  if (channel.includes('SYSTEM') || metadataString.includes('SYSTEM')) {
    return 'SYSTEM';
  }

  if (metadataString.includes('HELPER')) {
    return 'HELPER';
  }

  if (metadataString.includes('HATER')) {
    return 'HATER';
  }

  if (metadataString.includes('LIVEOPS')) {
    return 'LIVEOPS';
  }

  return 'UNKNOWN';
}

function resolveSequenceNumber(createdAtMs: number): number {
  if (!Number.isFinite(createdAtMs)) {
    return 0;
  }

  return Math.max(0, Math.trunc(createdAtMs));
}

function toSequenceMemoryVector(vector: EmbeddingVector): SequenceMemoryVector {
  return Object.freeze({
    dimensions: vector.dimensions,
    values: [...vector.vector],
    modelId: vector.version,
    checksum: vector.fingerprint,
  });
}
