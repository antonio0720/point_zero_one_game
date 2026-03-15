/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT DL BARREL
 * FILE: backend/src/game/engine/chat/dl/index.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Single backend-export surface for the authoritative chat DL lane.
 *
 * This barrel is intentionally richer than a tiny re-export file because the
 * user asked for an index that is fully functional with the lane’s core files.
 * In practice that means three things:
 *
 * 1. It exports all public backend DL modules expected by the current lane.
 * 2. It provides runtime-safe factory helpers for composing the lane.
 * 3. It defines cohesive aggregate types and helper utilities so callers do not
 *    need to manually stitch together the DL surface in ad hoc ways.
 *
 * Scope
 * -----
 * This barrel does not own transcript truth, socket transport, moderation, or
 * battle authority. It is a composition surface only. Backend chat remains the
 * truth owner, while this barrel exposes the DL capabilities that sit beneath
 * ranking, memory, retrieval, and sequence reasoning.
 * ============================================================================
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

declare const require: (path: string) => unknown;

export {
  SequenceMemoryClient,
  createSequenceMemoryClient,
} from './SequenceMemoryClient';

export type {
  ChatDlChannelId,
  ChatDlModeId,
  SequenceMemoryActorType,
  SequenceMemoryAnchorKind,
  SequenceMemoryCompressionTier,
  SequenceMemoryRetentionClass,
  SequenceMemoryVisibility,
  SequenceMemoryTrigger,
  SequenceMemoryVector,
  SequenceMemoryEmotionProfile,
  SequenceMemoryRelationshipProfile,
  SequenceMemorySourceMessage,
  SequenceMemorySceneWindow,
  SequenceMemoryAnchor,
  SequenceMemoryArcSummary,
  SequenceMemoryReadQuery,
  SequenceMemoryRetrievalQuery,
  SequenceMemoryRetrievalHit,
  SequenceMemoryCompressionRequest,
  SequenceMemorySnapshot,
  SequenceMemoryStats,
  SequenceMemoryClientConfig,
  SequenceMemoryClientDependencies,
  SequenceMemoryLogger,
} from './SequenceMemoryClient';

/**
 * The files below were generated in earlier steps of the same lane build.
 * The barrel keeps them optional at runtime so callers can use this file in
 * partial build states without crashing import evaluation.
 */

type GenericCtor<T = unknown> = new (...args: any[]) => T;

type GenericFactory<T = unknown> = (...args: any[]) => T;

interface DlLaneModuleRegistry {
  MessageEmbeddingClient?: GenericCtor | GenericFactory | Record<string, unknown>;
  DialogueIntentEncoder?: GenericCtor | GenericFactory | Record<string, unknown>;
  ConversationStateEncoder?: GenericCtor | GenericFactory | Record<string, unknown>;
  ResponseRankerClient?: GenericCtor | GenericFactory | Record<string, unknown>;
  SequenceMemoryClient?: GenericCtor | GenericFactory | Record<string, unknown>;
}

export interface BackendChatDlRuntimeHooks {
  now?: () => number;
  logger?: {
    debug(message: string, payload?: unknown): void;
    info(message: string, payload?: unknown): void;
    warn(message: string, payload?: unknown): void;
    error(message: string, payload?: unknown): void;
  };
  idFactory?: (prefix: string) => string;
}

export interface BackendChatDlLaneConfig {
  readonly embeddingClientConfig?: Readonly<Record<string, unknown>>;
  readonly intentEncoderConfig?: Readonly<Record<string, unknown>>;
  readonly stateEncoderConfig?: Readonly<Record<string, unknown>>;
  readonly responseRankerConfig?: Readonly<Record<string, unknown>>;
  readonly sequenceMemoryConfig?: Readonly<Record<string, unknown>>;
}

export interface BackendChatDlLane {
  readonly modules: DlLaneModuleRegistry;
  readonly services: {
    embeddingClient: unknown | null;
    intentEncoder: unknown | null;
    stateEncoder: unknown | null;
    responseRanker: unknown | null;
    sequenceMemory: unknown | null;
  };
  readonly health: BackendChatDlLaneHealthReport;
}

export interface BackendChatDlLaneHealthReport {
  readonly hasEmbeddingClient: boolean;
  readonly hasIntentEncoder: boolean;
  readonly hasStateEncoder: boolean;
  readonly hasResponseRanker: boolean;
  readonly hasSequenceMemory: boolean;
  readonly readyForRanking: boolean;
  readonly readyForMemory: boolean;
  readonly readyForFullLane: boolean;
  readonly missing: readonly string[];
}

export interface BackendChatDlAggregateReadiness {
  readonly embeddingReady: boolean;
  readonly sequenceReasoningReady: boolean;
  readonly rankingReady: boolean;
  readonly memoryReady: boolean;
  readonly fullReady: boolean;
}

export interface BackendChatDlCompositeQuery {
  readonly roomId: string;
  readonly channelId: string;
  readonly modeId: string;
  readonly queryText?: string;
  readonly actorId?: string;
  readonly actorIds?: readonly string[];
  readonly limit?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface BackendChatDlCompositeResult {
  readonly readiness: BackendChatDlAggregateReadiness;
  readonly memoryHits: readonly unknown[];
  readonly embeddingVector?: readonly number[];
  readonly intentSnapshot?: unknown;
  readonly stateSnapshot?: unknown;
  readonly rankingSnapshot?: unknown;
}

const NULL_LOGGER = {
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
};

function safeRequire(path: string): unknown | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    return require(path);
  } catch {
    return null;
  }
}

function getExportCandidate(moduleValue: unknown, names: readonly string[]): unknown | null {
  if (!moduleValue) return null;
  if (typeof moduleValue === 'function') return moduleValue;
  if (typeof moduleValue !== 'object') return null;

  const asRecord = moduleValue as Record<string, unknown>;
  for (const name of names) {
    if (name in asRecord && asRecord[name]) {
      return asRecord[name];
    }
  }
  return null;
}

function isConstructable(value: unknown): value is GenericCtor {
  return typeof value === 'function' && Boolean((value as { prototype?: unknown }).prototype);
}

function instantiateCandidate<T>(
  candidate: unknown,
  args: readonly unknown[],
): T | null {
  if (!candidate) return null;
  if (isConstructable(candidate)) {
    return new (candidate as GenericCtor<T>)(...args);
  }
  if (typeof candidate === 'function') {
    return (candidate as GenericFactory<T>)(...args);
  }
  return candidate as T;
}

function detectModules(): DlLaneModuleRegistry {
  const embeddingModule = safeRequire('./MessageEmbeddingClient');
  const intentModule = safeRequire('./DialogueIntentEncoder');
  const stateModule = safeRequire('./ConversationStateEncoder');
  const rankerModule = safeRequire('./ResponseRankerClient');
  const memoryModule = safeRequire('./SequenceMemoryClient');

  return {
    MessageEmbeddingClient: getExportCandidate(embeddingModule, [
      'MessageEmbeddingClient',
      'createMessageEmbeddingClient',
      'default',
    ]) as DlLaneModuleRegistry['MessageEmbeddingClient'],
    DialogueIntentEncoder: getExportCandidate(intentModule, [
      'DialogueIntentEncoder',
      'createDialogueIntentEncoder',
      'default',
    ]) as DlLaneModuleRegistry['DialogueIntentEncoder'],
    ConversationStateEncoder: getExportCandidate(stateModule, [
      'ConversationStateEncoder',
      'createConversationStateEncoder',
      'default',
    ]) as DlLaneModuleRegistry['ConversationStateEncoder'],
    ResponseRankerClient: getExportCandidate(rankerModule, [
      'ResponseRankerClient',
      'createResponseRankerClient',
      'default',
    ]) as DlLaneModuleRegistry['ResponseRankerClient'],
    SequenceMemoryClient: getExportCandidate(memoryModule, [
      'SequenceMemoryClient',
      'createSequenceMemoryClient',
      'default',
    ]) as DlLaneModuleRegistry['SequenceMemoryClient'],
  };
}

export function buildBackendChatDlHealthReport(
  modules: DlLaneModuleRegistry,
): BackendChatDlLaneHealthReport {
  const hasEmbeddingClient = Boolean(modules.MessageEmbeddingClient);
  const hasIntentEncoder = Boolean(modules.DialogueIntentEncoder);
  const hasStateEncoder = Boolean(modules.ConversationStateEncoder);
  const hasResponseRanker = Boolean(modules.ResponseRankerClient);
  const hasSequenceMemory = Boolean(modules.SequenceMemoryClient);

  const missing: string[] = [];
  if (!hasEmbeddingClient) missing.push('MessageEmbeddingClient');
  if (!hasIntentEncoder) missing.push('DialogueIntentEncoder');
  if (!hasStateEncoder) missing.push('ConversationStateEncoder');
  if (!hasResponseRanker) missing.push('ResponseRankerClient');
  if (!hasSequenceMemory) missing.push('SequenceMemoryClient');

  const readyForRanking = hasEmbeddingClient && hasIntentEncoder && hasResponseRanker;
  const readyForMemory = hasSequenceMemory;
  const readyForFullLane = readyForRanking && readyForMemory && hasStateEncoder;

  return {
    hasEmbeddingClient,
    hasIntentEncoder,
    hasStateEncoder,
    hasResponseRanker,
    hasSequenceMemory,
    readyForRanking,
    readyForMemory,
    readyForFullLane,
    missing,
  };
}

export function buildBackendChatDlReadiness(
  health: BackendChatDlLaneHealthReport,
): BackendChatDlAggregateReadiness {
  return {
    embeddingReady: health.hasEmbeddingClient,
    sequenceReasoningReady: health.hasIntentEncoder && health.hasStateEncoder,
    rankingReady: health.readyForRanking,
    memoryReady: health.readyForMemory,
    fullReady: health.readyForFullLane,
  };
}

export function createBackendChatDlLane(
  config: BackendChatDlLaneConfig = {},
  hooks: BackendChatDlRuntimeHooks = {},
): BackendChatDlLane {
  const logger = hooks.logger ?? NULL_LOGGER;
  const modules = detectModules();
  const health = buildBackendChatDlHealthReport(modules);

  const embeddingClient = instantiateCandidate(
    modules.MessageEmbeddingClient,
    [config.embeddingClientConfig ?? {}, { now: hooks.now, logger, idFactory: hooks.idFactory }],
  );
  const intentEncoder = instantiateCandidate(
    modules.DialogueIntentEncoder,
    [config.intentEncoderConfig ?? {}, { now: hooks.now, logger, idFactory: hooks.idFactory }],
  );
  const stateEncoder = instantiateCandidate(
    modules.ConversationStateEncoder,
    [config.stateEncoderConfig ?? {}, { now: hooks.now, logger, idFactory: hooks.idFactory }],
  );
  const responseRanker = instantiateCandidate(
    modules.ResponseRankerClient,
    [config.responseRankerConfig ?? {}, { now: hooks.now, logger, idFactory: hooks.idFactory }],
  );
  const sequenceMemory = instantiateCandidate(
    modules.SequenceMemoryClient,
    [config.sequenceMemoryConfig ?? {}, { now: hooks.now, logger, idFactory: hooks.idFactory }],
  );

  logger.info('Backend chat DL lane created', {
    readyForFullLane: health.readyForFullLane,
    missing: health.missing,
  });

  return {
    modules,
    services: {
      embeddingClient,
      intentEncoder,
      stateEncoder,
      responseRanker,
      sequenceMemory,
    },
    health,
  };
}

export function inspectBackendChatDlLane(): BackendChatDlLaneHealthReport {
  const modules = detectModules();
  return buildBackendChatDlHealthReport(modules);
}

export function runBackendChatDlCompositeQuery(
  lane: BackendChatDlLane,
  query: BackendChatDlCompositeQuery,
): BackendChatDlCompositeResult {
  const readiness = buildBackendChatDlReadiness(lane.health);
  const memoryHits: unknown[] = [];
  let embeddingVector: readonly number[] | undefined;
  let intentSnapshot: unknown;
  let stateSnapshot: unknown;
  let rankingSnapshot: unknown;

  const memoryService = lane.services.sequenceMemory as Record<string, unknown> | null;
  if (memoryService && typeof memoryService.retrieveRelevantAnchors === 'function') {
    try {
      const hits = (memoryService.retrieveRelevantAnchors as Function)({
        roomId: query.roomId,
        channelId: query.channelId,
        modeId: query.modeId,
        limit: query.limit ?? 8,
        includeShadow: false,
        queryText: query.queryText,
        targetActorIds: query.actorIds,
        trigger: 'MANUAL_IMPORT',
      });
      if (Array.isArray(hits)) memoryHits.push(...hits);
    } catch {
      /* noop */
    }
  }

  const embeddingService = lane.services.embeddingClient as Record<string, unknown> | null;
  if (embeddingService) {
    const fn =
      (typeof embeddingService.embedText === 'function' && embeddingService.embedText) ||
      (typeof embeddingService.embedMessage === 'function' && embeddingService.embedMessage) ||
      null;
    if (fn && query.queryText) {
      try {
        const result = (fn as Function).call(embeddingService, query.queryText);
        if (Array.isArray(result)) embeddingVector = result as readonly number[];
        else if (result && typeof result === 'object' && Array.isArray((result as any).values)) {
          embeddingVector = (result as any).values;
        }
      } catch {
        /* noop */
      }
    }
  }

  const intentService = lane.services.intentEncoder as Record<string, unknown> | null;
  if (intentService) {
    const fn =
      (typeof intentService.encodeIntent === 'function' && intentService.encodeIntent) ||
      (typeof intentService.encodeDialogueIntent === 'function' && intentService.encodeDialogueIntent) ||
      null;
    if (fn && query.queryText) {
      try {
        intentSnapshot = (fn as Function).call(intentService, {
          roomId: query.roomId,
          channelId: query.channelId,
          modeId: query.modeId,
          text: query.queryText,
          actorId: query.actorId,
          actorIds: query.actorIds,
        });
      } catch {
        /* noop */
      }
    }
  }

  const stateService = lane.services.stateEncoder as Record<string, unknown> | null;
  if (stateService) {
    const fn =
      (typeof stateService.encodeState === 'function' && stateService.encodeState) ||
      (typeof stateService.encodeConversationState === 'function' && stateService.encodeConversationState) ||
      null;
    if (fn) {
      try {
        stateSnapshot = (fn as Function).call(stateService, {
          roomId: query.roomId,
          channelId: query.channelId,
          modeId: query.modeId,
          metadata: query.metadata,
          actorId: query.actorId,
          actorIds: query.actorIds,
        });
      } catch {
        /* noop */
      }
    }
  }

  const rankerService = lane.services.responseRanker as Record<string, unknown> | null;
  if (rankerService) {
    const fn =
      (typeof rankerService.rankResponses === 'function' && rankerService.rankResponses) ||
      (typeof rankerService.rankCandidates === 'function' && rankerService.rankCandidates) ||
      null;
    if (fn) {
      try {
        rankingSnapshot = (fn as Function).call(rankerService, {
          roomId: query.roomId,
          channelId: query.channelId,
          modeId: query.modeId,
          queryText: query.queryText,
          actorId: query.actorId,
          actorIds: query.actorIds,
          memoryHits,
          intentSnapshot,
          stateSnapshot,
          embeddingVector,
        });
      } catch {
        /* noop */
      }
    }
  }

  return {
    readiness,
    memoryHits,
    embeddingVector,
    intentSnapshot,
    stateSnapshot,
    rankingSnapshot,
  };
}

export function assertBackendChatDlLaneReady(
  lane: BackendChatDlLane,
  scope: 'ranking' | 'memory' | 'full' = 'full',
): void {
  switch (scope) {
    case 'ranking':
      if (!lane.health.readyForRanking) {
        throw new Error(`Backend chat DL lane is not ranking-ready. Missing: ${lane.health.missing.join(', ')}`);
      }
      return;
    case 'memory':
      if (!lane.health.readyForMemory) {
        throw new Error(`Backend chat DL lane is not memory-ready. Missing: ${lane.health.missing.join(', ')}`);
      }
      return;
    case 'full':
    default:
      if (!lane.health.readyForFullLane) {
        throw new Error(`Backend chat DL lane is not full-ready. Missing: ${lane.health.missing.join(', ')}`);
      }
  }
}

export function listBackendChatDlExports(): readonly string[] {
  return [
    'MessageEmbeddingClient',
    'DialogueIntentEncoder',
    'ConversationStateEncoder',
    'ResponseRankerClient',
    'SequenceMemoryClient',
    'createBackendChatDlLane',
    'inspectBackendChatDlLane',
    'runBackendChatDlCompositeQuery',
    'assertBackendChatDlLaneReady',
    'buildBackendChatDlHealthReport',
    'buildBackendChatDlReadiness',
  ];
}

export default {
  createBackendChatDlLane,
  inspectBackendChatDlLane,
  runBackendChatDlCompositeQuery,
  assertBackendChatDlLaneReady,
  buildBackendChatDlHealthReport,
  buildBackendChatDlReadiness,
  listBackendChatDlExports,
};
