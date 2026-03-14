/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT TELEMETRY PUBLIC BARREL
 * FILE: pzo-web/src/engines/chat/telemetry/index.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Stable, runtime-useful import surface for the canonical frontend chat
 * telemetry lane.
 *
 * This barrel does more than pass through wildcard exports.
 * It also provides:
 * - a single public manifest for the telemetry subsystem,
 * - compile-safe runtime constants for UI, engine, and server bridges,
 * - a first-class namespace object for factories, validators, transports,
 *   persistence adapters, and runtime classes,
 * - a stack factory that wires queue + emitter coherently,
 * - capability markers so other lanes can depend on telemetry without having
 *   to inspect emitter / schema / queue internals.
 *
 * Doctrine
 * --------
 * - export everything that is real now,
 * - avoid pretending future backend/shared migrations are already complete,
 * - make the barrel useful for direct runtime composition, not just typing,
 * - preserve the separation of concerns already present in the lane:
 *   emitter captures, schema validates, queue delivers, backend stays truth.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

export * from './ChatTelemetryEmitter';
export * from './ChatTelemetrySchema';
export * from './ChatTelemetryQueue';

import {
  ChatTelemetryEmitter,
  createChatTelemetryEmitter,
  createInMemoryChatTelemetryEmitter,
} from './ChatTelemetryEmitter';

import {
  CHAT_TELEMETRY_CHANNELS,
  CHAT_TELEMETRY_EVENT_NAMES,
  CHAT_TELEMETRY_EVENT_SPECS,
  CHAT_TELEMETRY_ORIGINS,
  CHAT_TELEMETRY_SCHEMA_VERSION,
  CHAT_TELEMETRY_SEVERITIES,
  CHAT_TELEMETRY_SENDER_ROLES,
  createChatTelemetryExportSnapshot,
  envelopeHasLearningContext,
  envelopeHasReplayContext,
  envelopeTouchesChannel,
  getChatTelemetryEventSpec,
  getChatTelemetryFamily,
  getChatTelemetryQueuePolicy,
  groupChatTelemetryEnvelopesByFamily,
  groupChatTelemetryEnvelopesBySession,
  isChatTelemetryChannel,
  isChatTelemetryEventName,
  isChatTelemetryOrigin,
  isChatTelemetrySenderRole,
  isChatTelemetrySeverity,
  isImmediateFlushChatTelemetryEvent,
  isLearningRelevantChatTelemetryEvent,
  isReplayWorthyChatTelemetryEvent,
  normalizeChatTelemetryBatch,
  normalizeChatTelemetryEnvelope,
  redactChatTelemetryBatch,
  redactChatTelemetryEnvelope,
  sortChatTelemetryEnvelopesStable,
  splitChatTelemetryBatchForTransport,
  summarizeChatTelemetryEnvelope,
  validateChatTelemetryBatch,
  validateChatTelemetryEnvelope,
} from './ChatTelemetrySchema';

import {
  ChatTelemetryQueue,
  FetchChatTelemetryTransport,
  InMemoryChatTelemetryPersistenceAdapter,
  InMemoryChatTelemetryTransport,
  LocalStorageChatTelemetryPersistenceAdapter,
  SendBeaconChatTelemetryTransport,
  createInMemoryChatTelemetryQueue,
  createLocalDurableChatTelemetryQueue,
} from './ChatTelemetryQueue';

import type {
  ChatTelemetryConfig,
  ChatTelemetryEmitterDependencies,
  ChatTelemetryLoggerLike,
  ChatTelemetryQueueLike,
} from './ChatTelemetryEmitter';

import type {
  ChatTelemetryQueueConfig,
  ChatTelemetryQueueDependencies,
} from './ChatTelemetryQueue';

/* ========================================================================== *
 * Section 1 — Stable barrel metadata
 * ========================================================================== */

export const CHAT_TELEMETRY_MODULE_NAME =
  'PZO_FRONTEND_CHAT_TELEMETRY' as const;

export const CHAT_TELEMETRY_PUBLIC_API_VERSION = '2026.03.13' as const;

export const CHAT_TELEMETRY_AUTHORITIES = Object.freeze({
  frontendTelemetryRoot: 'pzo-web/src/engines/chat/telemetry',
  frontendEmitter: 'pzo-web/src/engines/chat/telemetry/ChatTelemetryEmitter.ts',
  frontendSchema: 'pzo-web/src/engines/chat/telemetry/ChatTelemetrySchema.ts',
  frontendQueue: 'pzo-web/src/engines/chat/telemetry/ChatTelemetryQueue.ts',
  serverTransportRoot: 'pzo-server/src/chat',
  backendAuthorityRoot: 'backend/src/game/engine/chat',
  sharedContractsRoot: 'shared/contracts/chat',
} as const);

export const CHAT_TELEMETRY_RUNTIME_LAWS = Object.freeze([
  'Emitter captures quickly; it does not define backend truth.',
  'Schema validates and normalizes before transport significance is assumed.',
  'Queue owns retry, persistence, flush timing, and burst resilience.',
  'Raw transcript text is not the default telemetry payload.',
  'Replay, legend, learning, rescue, and moderation are first-class telemetry domains.',
  'Frontend telemetry must stay useful while server and shared lanes keep evolving.',
  'Privacy, dedupe, throttling, and offline tolerance are baseline behavior.',
  'Import safety matters: the barrel should be usable as a stable root surface.',
] as const);

export const CHAT_TELEMETRY_PHASE_EXPORTS = Object.freeze({
  providedNow: Object.freeze([
    'index.ts',
    'ChatTelemetryEmitter.ts',
    'ChatTelemetrySchema.ts',
    'ChatTelemetryQueue.ts',
  ] as const),
  expectedNext: Object.freeze([
    'shared/contracts/chat/telemetry.ts',
    'shared/contracts/chat/telemetryQueue.ts',
    'backend/src/game/engine/chat/telemetry/ChatTelemetryIngestor.ts',
    'backend/src/game/engine/chat/telemetry/ChatTelemetryReplayIndex.ts',
    'pzo-server/src/chat/telemetry/ChatTelemetrySocketBridge.ts',
    'pzo-server/src/chat/telemetry/ChatTelemetryHttpBridge.ts',
  ] as const),
} as const);

export const CHAT_TELEMETRY_CHANNEL_LIST = Object.freeze(
  Array.from(CHAT_TELEMETRY_CHANNELS.values()),
);

export const CHAT_TELEMETRY_SEVERITY_LIST = Object.freeze(
  Array.from(CHAT_TELEMETRY_SEVERITIES.values()),
);

export const CHAT_TELEMETRY_ORIGIN_LIST = Object.freeze(
  Array.from(CHAT_TELEMETRY_ORIGINS.values()),
);

export const CHAT_TELEMETRY_SENDER_ROLE_LIST = Object.freeze(
  Array.from(CHAT_TELEMETRY_SENDER_ROLES.values()),
);

export const CHAT_TELEMETRY_EVENT_NAME_LIST = Object.freeze([
  ...CHAT_TELEMETRY_EVENT_NAMES,
] as const);

/* ========================================================================== *
 * Section 2 — Public runtime helpers
 * ========================================================================== */

export interface ChatTelemetryRuntimeStack {
  readonly queue: ChatTelemetryQueue;
  readonly emitter: ChatTelemetryEmitter;
}

export interface CreateChatTelemetryRuntimeOptions {
  readonly endpoint?: string;
  readonly durable?: boolean;
  readonly queueId?: string;
  readonly logger?: ChatTelemetryLoggerLike;
  readonly emitterConfig?: Partial<ChatTelemetryConfig>;
  readonly queueConfig?: Partial<ChatTelemetryQueueConfig>;
  readonly emitterDeps?: Omit<
    ChatTelemetryEmitterDependencies,
    'queue' | 'transport' | 'logger' | 'config'
  >;
  readonly queueDeps?: Omit<
    ChatTelemetryQueueDependencies,
    'transport' | 'logger' | 'queueId' | 'config' | 'emitterConfig'
  >;
}

function toEmitterPrivacyProjection(
  config?: Partial<ChatTelemetryConfig>,
): Pick<
  ChatTelemetryConfig,
  'privacy' | 'includeSafePreview' | 'safePreviewMaxChars'
> | undefined {
  if (!config) {
    return undefined;
  }

  if (
    typeof config.privacy === 'undefined' &&
    typeof config.includeSafePreview === 'undefined' &&
    typeof config.safePreviewMaxChars === 'undefined'
  ) {
    return undefined;
  }

  return {
    privacy: config.privacy ?? {
      includeRoomIds: true,
      includeProfileIds: false,
      includePlayerIds: false,
      includeOfferValues: true,
      includeReplyTargets: true,
    },
    includeSafePreview: config.includeSafePreview ?? true,
    safePreviewMaxChars: config.safePreviewMaxChars ?? 64,
  };
}

export function createChatTelemetryRuntime(
  options: CreateChatTelemetryRuntimeOptions = {},
): ChatTelemetryRuntimeStack {
  const privacyProjection = toEmitterPrivacyProjection(options.emitterConfig);

  const queue =
    options.durable && options.endpoint
      ? createLocalDurableChatTelemetryQueue({
          endpoint: options.endpoint,
          queueId: options.queueId,
          logger: options.logger,
          config: options.queueConfig,
          emitterConfig: privacyProjection,
        })
      : new ChatTelemetryQueue({
          ...options.queueDeps,
          queueId: options.queueId,
          logger: options.logger,
          config: options.queueConfig,
          emitterConfig: privacyProjection,
          transport: new InMemoryChatTelemetryTransport(),
        });

  const emitter = createChatTelemetryEmitter({
    ...options.emitterDeps,
    logger: options.logger,
    config: options.emitterConfig,
    queue,
  });

  return Object.freeze({
    queue,
    emitter,
  });
}

export function createInMemoryChatTelemetryRuntime(
  options: Omit<CreateChatTelemetryRuntimeOptions, 'durable' | 'endpoint'> = {},
): ChatTelemetryRuntimeStack {
  return createChatTelemetryRuntime({
    ...options,
    durable: false,
  });
}

export function createDurableChatTelemetryRuntime(
  endpoint: string,
  options: Omit<CreateChatTelemetryRuntimeOptions, 'durable' | 'endpoint'> = {},
): ChatTelemetryRuntimeStack {
  return createChatTelemetryRuntime({
    ...options,
    endpoint,
    durable: true,
  });
}

export function createEmitterBoundToQueue(
  queue: ChatTelemetryQueueLike,
  deps: Omit<ChatTelemetryEmitterDependencies, 'queue'> = {},
): ChatTelemetryEmitter {
  return createChatTelemetryEmitter({
    ...deps,
    queue,
  });
}

/* ========================================================================== *
 * Section 3 — Public manifest / namespace
 * ========================================================================== */

export const CHAT_TELEMETRY_PUBLIC_MANIFEST = Object.freeze({
  moduleName: CHAT_TELEMETRY_MODULE_NAME,
  publicApiVersion: CHAT_TELEMETRY_PUBLIC_API_VERSION,
  schemaVersion: CHAT_TELEMETRY_SCHEMA_VERSION,
  authorities: CHAT_TELEMETRY_AUTHORITIES,
  files: Object.freeze({
    emitter: CHAT_TELEMETRY_AUTHORITIES.frontendEmitter,
    schema: CHAT_TELEMETRY_AUTHORITIES.frontendSchema,
    queue: CHAT_TELEMETRY_AUTHORITIES.frontendQueue,
  }),
  domains: Object.freeze({
    channelCount: CHAT_TELEMETRY_CHANNEL_LIST.length,
    severityCount: CHAT_TELEMETRY_SEVERITY_LIST.length,
    originCount: CHAT_TELEMETRY_ORIGIN_LIST.length,
    senderRoleCount: CHAT_TELEMETRY_SENDER_ROLE_LIST.length,
    eventCount: CHAT_TELEMETRY_EVENT_NAME_LIST.length,
    specCount: Object.keys(CHAT_TELEMETRY_EVENT_SPECS).length,
  }),
  channels: CHAT_TELEMETRY_CHANNEL_LIST,
  severities: CHAT_TELEMETRY_SEVERITY_LIST,
  origins: CHAT_TELEMETRY_ORIGIN_LIST,
  senderRoles: CHAT_TELEMETRY_SENDER_ROLE_LIST,
  eventNames: CHAT_TELEMETRY_EVENT_NAME_LIST,
  runtimeLaws: CHAT_TELEMETRY_RUNTIME_LAWS,
  phaseExports: CHAT_TELEMETRY_PHASE_EXPORTS,
} as const);

export const CHAT_TELEMETRY_COMPILE_SAFE_SURFACE = Object.freeze({
  canInstantiateEmitter: true,
  canInstantiateQueue: true,
  canCreateDurableRuntime: true,
  canCreateInMemoryRuntime: true,
  canValidateEnvelope: true,
  canValidateBatch: true,
  canNormalizeEnvelope: true,
  canNormalizeBatch: true,
  canRedactEnvelope: true,
  canRedactBatch: true,
  canSummarizeEnvelope: true,
  canSplitTransportBatch: true,
  canExportReplaySnapshot: true,
  canUseInMemoryTransport: true,
  canUseFetchTransport: true,
  canUseBeaconTransport: true,
  canUseLocalStoragePersistence: true,
  awaitsSharedContractLift: true,
  awaitsBackendIngestAuthorityDocking: true,
} as const);

export const CHAT_TELEMETRY_NAMESPACE = Object.freeze({
  manifest: CHAT_TELEMETRY_PUBLIC_MANIFEST,
  capabilities: CHAT_TELEMETRY_COMPILE_SAFE_SURFACE,
  laws: CHAT_TELEMETRY_RUNTIME_LAWS,
  authorities: CHAT_TELEMETRY_AUTHORITIES,
  channels: CHAT_TELEMETRY_CHANNEL_LIST,
  severities: CHAT_TELEMETRY_SEVERITY_LIST,
  origins: CHAT_TELEMETRY_ORIGIN_LIST,
  senderRoles: CHAT_TELEMETRY_SENDER_ROLE_LIST,
  eventNames: CHAT_TELEMETRY_EVENT_NAME_LIST,
  eventSpecs: CHAT_TELEMETRY_EVENT_SPECS,
} as const);

export const ChatTelemetry = Object.freeze({
  ChatTelemetryEmitter,
  ChatTelemetryQueue,
  InMemoryChatTelemetryTransport,
  FetchChatTelemetryTransport,
  SendBeaconChatTelemetryTransport,
  InMemoryChatTelemetryPersistenceAdapter,
  LocalStorageChatTelemetryPersistenceAdapter,
  createChatTelemetryEmitter,
  createInMemoryChatTelemetryEmitter,
  createEmitterBoundToQueue,
  createChatTelemetryRuntime,
  createInMemoryChatTelemetryRuntime,
  createDurableChatTelemetryRuntime,
  createInMemoryChatTelemetryQueue,
  createLocalDurableChatTelemetryQueue,
  validateChatTelemetryEnvelope,
  validateChatTelemetryBatch,
  normalizeChatTelemetryEnvelope,
  normalizeChatTelemetryBatch,
  redactChatTelemetryEnvelope,
  redactChatTelemetryBatch,
  summarizeChatTelemetryEnvelope,
  sortChatTelemetryEnvelopesStable,
  splitChatTelemetryBatchForTransport,
  createChatTelemetryExportSnapshot,
  groupChatTelemetryEnvelopesBySession,
  groupChatTelemetryEnvelopesByFamily,
  getChatTelemetryEventSpec,
  getChatTelemetryFamily,
  getChatTelemetryQueuePolicy,
  isImmediateFlushChatTelemetryEvent,
  isReplayWorthyChatTelemetryEvent,
  isLearningRelevantChatTelemetryEvent,
  isChatTelemetryChannel,
  isChatTelemetrySeverity,
  isChatTelemetryOrigin,
  isChatTelemetryEventName,
  isChatTelemetrySenderRole,
  envelopeHasReplayContext,
  envelopeHasLearningContext,
  envelopeTouchesChannel,
  manifest: CHAT_TELEMETRY_PUBLIC_MANIFEST,
  namespace: CHAT_TELEMETRY_NAMESPACE,
} as const);
