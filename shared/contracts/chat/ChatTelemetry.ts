/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT TELEMETRY CONTRACTS
 * FILE: shared/contracts/chat/ChatTelemetry.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared contract surface for chat telemetry, event streaming,
 * analytics facts, queueing, flushing, aggregation, training exports, and
 * privacy-safe observability across the unified chat system.
 *
 * This file serves as the long-term telemetry authority for:
 *   - /shared/contracts/chat
 *   - /pzo-web/src/engines/chat
 *   - /backend/src/game/engine/chat
 *   - /pzo-server/src/chat
 *
 * Design laws
 * -----------
 * 1. Telemetry must reflect authoritative truth when available, and clearly
 *    mark optimistic or client-local signals when authority has not yet been
 *    established.
 * 2. Transport remains a servant. It may fan out, batch, flush, and meter
 *    telemetry, but it does not get to redefine event meaning.
 * 3. Telemetry contracts must preserve the repo’s existing distinctions between
 *    message, presence, typing, cursor, moderation, replay, NPC, invasion,
 *    liveops, and learning surfaces.
 * 4. Telemetry must be rich enough to power drift detection, offline training,
 *    feature stores, retention policy, incident review, replay stitching, and
 *    revenue-safe debugging without inventing side-band schemas later.
 * 5. Shared telemetry contracts must be import-safe for frontend, backend, and
 *    server transport without pulling engine implementations into the shared
 *    lane.
 * ============================================================================
 */

import {
  type Brand,
  type ChatChannelFamily,
  type ChatChannelId,
  type ChatDeliveryPriority,
  type ChatFanoutClass,
  type ChatModeScope,
  type ChatMountTarget,
  type ChatPersistenceClass,
  type ChatRoomId,
  type ChatStageMood,
  type JsonObject,
  type JsonValue,
  type Nullable,
  type Optional,
  type Score01,
  type Score100,
  type UnixMs,
  CHAT_CHANNEL_DESCRIPTORS,
  CHAT_CONTRACT_AUTHORITIES,
  CHAT_CONTRACT_VERSION,
  CHAT_FANOUT_CLASSES,
  CHAT_MOUNT_TARGETS,
  CHAT_STAGE_MOODS,
} from './ChatChannels';

import {
  type ChatActorKind,
  type ChatInterventionId,
  type ChatLegendId,
  type ChatMemoryAnchorId,
  type ChatMessageId,
  type ChatNpcId,
  type ChatOfferId,
  type ChatProofHash,
  type ChatRange,
  type ChatReplayId,
  type ChatRequestId,
  type ChatSessionId,
  type ChatTelemetryId,
  type ChatUserId,
  type ChatWorldEventId,
  CHAT_ACTOR_KINDS,
} from './ChatChannels';

import {
  type ChatAffectSnapshot,
  type ChatAuthority,
  type ChatDeliveryState,
  type ChatFeatureSnapshot,
  type ChatModerationDecision,
  type ChatModerationState,
  type ChatNotificationKind,
  type ChatTelemetryEvent as ChatTelemetryEnvelope,
  type ChatTelemetryEventName,
  type ChatUpstreamSignal,
  CHAT_AUTHORITIES,
  CHAT_DELIVERY_STATES,
  CHAT_MODERATION_STATES,
  CHAT_NOTIFICATION_KINDS,
  CHAT_TELEMETRY_EVENTS,
} from './ChatEvents';

import { type ChatWorldEventDefinition as ChatWorldEventDescriptor } from './ChatWorldEvent';

import {
  type ChatAttachment,
  type ChatCanonicalMessage,
  type ChatEmbed,
  type ChatMessageOriginSurface,
  type ChatMessageProofEnvelope,
  type ChatMessageToneBand,
  CHAT_MESSAGE_ORIGIN_SURFACES,
  CHAT_MESSAGE_TONE_BANDS,
} from './ChatMessage';

import {
  type ChatPresenceEntry,
  type ChatPresenceRoster,
  type ChatPresenceTransportEnvelope,
  type ChatRoomPresenceStateAggregate,
} from './ChatPresence';

import {
  type ChatTypingEnvelope,
  type ChatTypingRosterSnapshot,
  type ChatTypingSimulationPlan,
  type ChatTypingTelemetryEvent,
} from './ChatTyping';

import {
  type ChatCursorEnvelope,
  type ChatCursorTelemetryEvent,
} from './ChatCursor';

import {
  type ChatTranscriptAuditEnvelope,
  type ChatTranscriptExportRequest,
  type ChatTranscriptExportResult,
  type ChatTranscriptLedgerState,
  type ChatTranscriptQuery,
  type ChatTranscriptQueryResult,
  type ChatTranscriptSnapshot,
} from './ChatTranscript';

import {
  type ChatAnyNpcDescriptor,
  type ChatNpcDescriptor,
  type ChatNpcRegistrySnapshot,
  type ChatNpcTurnPlan,
} from './ChatNpc';

import {
  type ChatCommandDescriptor,
  type ChatCommandEnvelope,
  type ChatCommandExecutionReceipt,
  type ChatCommandExecutionState,
  type ChatCommandTelemetryEventName,
} from './ChatCommand';

import {
  type ChatExpandedModerationDecision,
  type ChatModerationAction,
  type ChatModerationAuditRecord,
  type ChatModerationContext,
  type ChatModerationResult,
  type ChatModerationTelemetryEventName,
} from './ChatModeration';

import {
  type ChatInvasionCandidate,
  type ChatInvasionKind,
  type ChatInvasionOutcome,
  type ChatInvasionRuntimeState,
  type ChatInvasionStage,
  type ChatInvasionTemplate,
  CHAT_INVASION_KINDS,
  CHAT_INVASION_STAGES,
} from './ChatInvasion';

// ============================================================================
// MARK: Branded identifiers
// ============================================================================

export type ChatTelemetryStreamId = Brand<string, 'ChatTelemetryStreamId'>;
export type ChatTelemetrySinkId = Brand<string, 'ChatTelemetrySinkId'>;
export type ChatTelemetryBatchId = Brand<string, 'ChatTelemetryBatchId'>;
export type ChatTelemetryEnvelopeId = Brand<string, 'ChatTelemetryEnvelopeId'>;
export type ChatTelemetryRecordId = Brand<string, 'ChatTelemetryRecordId'>;
export type ChatTelemetryFactId = Brand<string, 'ChatTelemetryFactId'>;
export type ChatTelemetryFlushId = Brand<string, 'ChatTelemetryFlushId'>;
export type ChatTelemetryMetricId = Brand<string, 'ChatTelemetryMetricId'>;
export type ChatTelemetryAggregateId = Brand<string, 'ChatTelemetryAggregateId'>;
export type ChatTelemetryWindowId = Brand<string, 'ChatTelemetryWindowId'>;
export type ChatTelemetryDimensionId = Brand<string, 'ChatTelemetryDimensionId'>;
export type ChatTelemetrySessionKey = Brand<string, 'ChatTelemetrySessionKey'>;
export type ChatTelemetryQueueId = Brand<string, 'ChatTelemetryQueueId'>;
export type ChatTelemetryCorrelationId = Brand<string, 'ChatTelemetryCorrelationId'>;
export type ChatTelemetryDedupeKey = Brand<string, 'ChatTelemetryDedupeKey'>;
export type ChatTelemetryExportId = Brand<string, 'ChatTelemetryExportId'>;
export type ChatTelemetrySchemaId = Brand<string, 'ChatTelemetrySchemaId'>;
export type ChatTelemetryIncidentId = Brand<string, 'ChatTelemetryIncidentId'>;
export type ChatTelemetryQueryId = Brand<string, 'ChatTelemetryQueryId'>;
export type ChatTelemetryFactTableId = Brand<string, 'ChatTelemetryFactTableId'>;
export type ChatTelemetryFeatureRowId = Brand<string, 'ChatTelemetryFeatureRowId'>;

// ============================================================================
// MARK: Vocabularies
// ============================================================================

export const CHAT_TELEMETRY_STREAM_KINDS = [
  'AUTHORITATIVE_EVENT_STREAM',
  'CLIENT_INTENT_STREAM',
  'SERVER_TRANSPORT_STREAM',
  'REPLAY_EXPORT_STREAM',
  'TRAINING_EXPORT_STREAM',
  'OBSERVABILITY_STREAM',
] as const;

export type ChatTelemetryStreamKind =
  (typeof CHAT_TELEMETRY_STREAM_KINDS)[number];

export const CHAT_TELEMETRY_SINK_KINDS = [
  'IN_MEMORY_QUEUE',
  'HTTP_INGEST',
  'WEBSOCKET_RELAY',
  'NDJSON_FILE',
  'WAREHOUSE_EXPORT',
  'FEATURE_STORE',
  'DEBUG_CONSOLE',
] as const;

export type ChatTelemetrySinkKind =
  (typeof CHAT_TELEMETRY_SINK_KINDS)[number];

export const CHAT_TELEMETRY_TRANSPORT_KINDS = [
  'INTERNAL_CALL',
  'POST',
  'STREAM',
  'BATCH_POST',
  'FILE_APPEND',
  'QUEUE_PUSH',
] as const;

export type ChatTelemetryTransportKind =
  (typeof CHAT_TELEMETRY_TRANSPORT_KINDS)[number];

export const CHAT_TELEMETRY_DELIVERY_GUARANTEES = [
  'BEST_EFFORT',
  'AT_LEAST_ONCE',
  'EXACTLY_ONCE_SIMULATED',
  'REPLAYABLE',
] as const;

export type ChatTelemetryDeliveryGuarantee =
  (typeof CHAT_TELEMETRY_DELIVERY_GUARANTEES)[number];

export const CHAT_TELEMETRY_FLUSH_TRIGGERS = [
  'SIZE_LIMIT',
  'TIME_LIMIT',
  'CHANNEL_SWITCH',
  'ROOM_EXIT',
  'RUN_END',
  'WORLD_EVENT_BOUNDARY',
  'FORCE_DEBUG',
] as const;

export type ChatTelemetryFlushTrigger =
  (typeof CHAT_TELEMETRY_FLUSH_TRIGGERS)[number];

export const CHAT_TELEMETRY_RETENTION_CLASSES = [
  'EPHEMERAL',
  'RUN_SCOPED',
  'SESSION_SCOPED',
  'ACCOUNT_SCOPED',
  'AUDIT_SCOPED',
  'TRAINING_SCOPED',
] as const;

export type ChatTelemetryRetentionClass =
  (typeof CHAT_TELEMETRY_RETENTION_CLASSES)[number];

export const CHAT_TELEMETRY_PRIVACY_CLASSES = [
  'PUBLIC_SAFE',
  'PRODUCT_INTERNAL',
  'AUDIT_ONLY',
  'TRAINING_SAFE',
  'PII_RESTRICTED',
  'SHADOW_RESTRICTED',
] as const;

export type ChatTelemetryPrivacyClass =
  (typeof CHAT_TELEMETRY_PRIVACY_CLASSES)[number];

export const CHAT_TELEMETRY_AGGREGATION_WINDOWS = [
  'REALTIME',
  '15S',
  '1M',
  '5M',
  '15M',
  'RUN_TOTAL',
  'SESSION_TOTAL',
  'DAY_TOTAL',
] as const;

export type ChatTelemetryAggregationWindow =
  (typeof CHAT_TELEMETRY_AGGREGATION_WINDOWS)[number];

export const CHAT_TELEMETRY_METRIC_KINDS = [
  'COUNT',
  'RATE',
  'GAUGE',
  'LATENCY_MS',
  'SIZE_BYTES',
  'PERCENT',
  'SCORE_100',
  'BOOLEAN_RATIO',
] as const;

export type ChatTelemetryMetricKind =
  (typeof CHAT_TELEMETRY_METRIC_KINDS)[number];

export const CHAT_TELEMETRY_EVENT_CLASSES = [
  'SESSION',
  'MESSAGE',
  'PRESENCE',
  'TYPING',
  'CURSOR',
  'TRANSCRIPT',
  'MODERATION',
  'COMMAND',
  'NPC',
  'INVASION',
  'WORLD_EVENT',
  'LEARNING',
  'REPLAY',
  'PIPELINE',
] as const;

export type ChatTelemetryEventClass =
  (typeof CHAT_TELEMETRY_EVENT_CLASSES)[number];

export const CHAT_TELEMETRY_BACKPRESSURE_POLICIES = [
  'DROP_LOW_PRIORITY',
  'MERGE_DUPLICATES',
  'BLOCK_ON_FLUSH',
  'WRITE_TO_FILE',
  'ESCALATE_DEBUG',
] as const;

export type ChatTelemetryBackpressurePolicy =
  (typeof CHAT_TELEMETRY_BACKPRESSURE_POLICIES)[number];

export const CHAT_TELEMETRY_SCHEMA_NAMES = [
  'chat.session.fact.v1',
  'chat.message.fact.v1',
  'chat.presence.fact.v1',
  'chat.typing.fact.v1',
  'chat.cursor.fact.v1',
  'chat.transcript.fact.v1',
  'chat.moderation.fact.v1',
  'chat.command.fact.v1',
  'chat.npc.fact.v1',
  'chat.invasion.fact.v1',
  'chat.world_event.fact.v1',
  'chat.learning.fact.v1',
  'chat.pipeline.fact.v1',
] as const;

export type ChatTelemetrySchemaName =
  (typeof CHAT_TELEMETRY_SCHEMA_NAMES)[number];

export const CHAT_TELEMETRY_STREAM_TOPICS = [
  'chat.events.authoritative',
  'chat.events.client_intent',
  'chat.events.transport',
  'chat.events.replay',
  'chat.events.training',
  'chat.metrics.realtime',
  'chat.metrics.audit',
] as const;

export type ChatTelemetryStreamTopic =
  (typeof CHAT_TELEMETRY_STREAM_TOPICS)[number];

export const CHAT_TELEMETRY_PIPELINE_STATES = [
  'QUEUED',
  'BUFFERED',
  'FLUSHING',
  'DELIVERED',
  'FAILED',
  'RETRIED',
  'DROPPED',
] as const;

export type ChatTelemetryPipelineState =
  (typeof CHAT_TELEMETRY_PIPELINE_STATES)[number];

// ============================================================================
// MARK: Dimensions and schemas
// ============================================================================

export interface ChatTelemetryDimension {
  readonly dimensionId: ChatTelemetryDimensionId;
  readonly key: string;
  readonly value: string | number | boolean;
  readonly privacyClass: ChatTelemetryPrivacyClass;
}

export interface ChatTelemetrySchemaDescriptor {
  readonly schemaId: ChatTelemetrySchemaId;
  readonly schemaName: ChatTelemetrySchemaName;
  readonly version: string;
  readonly eventClass: ChatTelemetryEventClass;
  readonly retentionClass: ChatTelemetryRetentionClass;
  readonly privacyClass: ChatTelemetryPrivacyClass;
  readonly trainingSafe: boolean;
  readonly fields: readonly string[];
}

export interface ChatTelemetryContext {
  readonly sessionId?: ChatSessionId;
  readonly roomId?: ChatRoomId;
  readonly channelId?: ChatChannelId;
  readonly modeScope?: ChatModeScope;
  readonly mountTarget?: ChatMountTarget;
  readonly requestId?: ChatRequestId;
  readonly userId?: ChatUserId;
  readonly npcId?: ChatNpcId;
  readonly worldEventId?: ChatWorldEventId;
  readonly replayId?: ChatReplayId;
  readonly correlationId?: ChatTelemetryCorrelationId;
  readonly dedupeKey?: ChatTelemetryDedupeKey;
  readonly dimensions: readonly ChatTelemetryDimension[];
}

export interface ChatTelemetrySinkDescriptor {
  readonly sinkId: ChatTelemetrySinkId;
  readonly name: string;
  readonly kind: ChatTelemetrySinkKind;
  readonly transport: ChatTelemetryTransportKind;
  readonly guarantee: ChatTelemetryDeliveryGuarantee;
  readonly enabled: boolean;
  readonly acceptsEventClasses: readonly ChatTelemetryEventClass[];
  readonly acceptsPrivacyClasses: readonly ChatTelemetryPrivacyClass[];
  readonly acceptsStreamTopics: readonly ChatTelemetryStreamTopic[];
  readonly backpressurePolicy: ChatTelemetryBackpressurePolicy;
  readonly retryBudget: number;
}

export interface ChatTelemetryStreamDescriptor {
  readonly streamId: ChatTelemetryStreamId;
  readonly topic: ChatTelemetryStreamTopic;
  readonly kind: ChatTelemetryStreamKind;
  readonly description: string;
  readonly deliveryGuarantee: ChatTelemetryDeliveryGuarantee;
  readonly retentionClass: ChatTelemetryRetentionClass;
  readonly defaultFlushTriggers: readonly ChatTelemetryFlushTrigger[];
  readonly sinks: readonly ChatTelemetrySinkId[];
}

// ============================================================================
// MARK: Core fact base contracts
// ============================================================================

export interface ChatTelemetryFactBase {
  readonly factId: ChatTelemetryFactId;
  readonly telemetryId: ChatTelemetryId;
  readonly occurredAt: UnixMs;
  readonly schema: ChatTelemetrySchemaName;
  readonly eventClass: ChatTelemetryEventClass;
  readonly privacyClass: ChatTelemetryPrivacyClass;
  readonly authoritative: boolean;
  readonly context: ChatTelemetryContext;
  readonly payload: JsonObject;
}

export interface ChatSessionTelemetryFact extends ChatTelemetryFactBase {
  readonly eventClass: 'SESSION';
  readonly schema: 'chat.session.fact.v1';
  readonly lifecycleEvent:
    | 'OPENED'
    | 'CLOSED'
    | 'ROOM_JOINED'
    | 'ROOM_LEFT'
    | 'CHANNEL_CHANGED'
    | 'DISCONNECTED'
    | 'RECONNECTED';
  readonly panelOpen: boolean;
  readonly activeChannel?: ChatChannelId;
  readonly activeMount?: ChatMountTarget;
  readonly unreadCount?: number;
}

export interface ChatMessageTelemetryFact extends ChatTelemetryFactBase {
  readonly eventClass: 'MESSAGE';
  readonly schema: 'chat.message.fact.v1';
  readonly messageId?: ChatMessageId;
  readonly originSurface?: ChatMessageOriginSurface;
  readonly deliveryState?: ChatDeliveryState;
  readonly moderationState?: ChatModerationState;
  readonly attachmentCount: number;
  readonly embedCount: number;
  readonly bodyLength: number;
  readonly toneBand?: ChatMessageToneBand;
  readonly notificationKind?: ChatNotificationKind;
}

export interface ChatPresenceTelemetryFact extends ChatTelemetryFactBase {
  readonly eventClass: 'PRESENCE';
  readonly schema: 'chat.presence.fact.v1';
  readonly visibleCount: number;
  readonly hiddenCount: number;
  readonly typingActors: number;
  readonly rosterVersion?: string;
}

export interface ChatTypingTelemetryFact extends ChatTelemetryFactBase {
  readonly eventClass: 'TYPING';
  readonly schema: 'chat.typing.fact.v1';
  readonly actorKey: string;
  readonly source: string;
  readonly typingState: string;
  readonly latencyBudgetMs?: number;
  readonly revealDelayMs?: number;
}

export interface ChatCursorTelemetryFact extends ChatTelemetryFactBase {
  readonly eventClass: 'CURSOR';
  readonly schema: 'chat.cursor.fact.v1';
  readonly surface: string;
  readonly intent: string;
  readonly hasSelection: boolean;
  readonly hasViewport: boolean;
  readonly windowStart?: number;
  readonly windowEnd?: number;
}

export interface ChatTranscriptTelemetryFact extends ChatTelemetryFactBase {
  readonly eventClass: 'TRANSCRIPT';
  readonly schema: 'chat.transcript.fact.v1';
  readonly appendedCount?: number;
  readonly redactedCount?: number;
  readonly queryIntent?: string;
  readonly hitCount?: number;
  readonly exportFormat?: string;
}

export interface ChatModerationTelemetryFact extends ChatTelemetryFactBase {
  readonly eventClass: 'MODERATION';
  readonly schema: 'chat.moderation.fact.v1';
  readonly moderationState?: ChatModerationState;
  readonly actionKinds: readonly string[];
  readonly riskLabels: readonly string[];
  readonly blockedVisibleTranscript: boolean;
  readonly reviewRequired: boolean;
}

export interface ChatCommandTelemetryFact extends ChatTelemetryFactBase {
  readonly eventClass: 'COMMAND';
  readonly schema: 'chat.command.fact.v1';
  readonly commandKey: string;
  readonly executionState: ChatCommandExecutionState;
  readonly affectedChannel?: ChatChannelId;
  readonly affectedMessageId?: ChatMessageId;
}

export interface ChatNpcTelemetryFact extends ChatTelemetryFactBase {
  readonly eventClass: 'NPC';
  readonly schema: 'chat.npc.fact.v1';
  readonly npcId?: ChatNpcId;
  readonly sceneRole?: string;
  readonly reactionIntent?: string;
  readonly lineBudget?: number;
  readonly selectedLineCount?: number;
}

export interface ChatInvasionTelemetryFact extends ChatTelemetryFactBase {
  readonly eventClass: 'INVASION';
  readonly schema: 'chat.invasion.fact.v1';
  readonly invasionId?: string;
  readonly invasionKind?: ChatInvasionKind;
  readonly invasionStage?: ChatInvasionStage;
  readonly helperIntercepted: boolean;
  readonly counterplayOpen: boolean;
  readonly importanceBand?: string;
}

export interface ChatWorldEventTelemetryFact extends ChatTelemetryFactBase {
  readonly eventClass: 'WORLD_EVENT';
  readonly schema: 'chat.world_event.fact.v1';
  readonly worldEventId?: ChatWorldEventId;
  readonly active: boolean;
  readonly overlayStyle?: string;
  readonly intensity?: Score100;
}

export interface ChatLearningTelemetryFact extends ChatTelemetryFactBase {
  readonly eventClass: 'LEARNING';
  readonly schema: 'chat.learning.fact.v1';
  readonly candidateCount?: number;
  readonly selectedCandidateId?: string;
  readonly helperShouldIntervene?: boolean;
  readonly haterShouldEscalate?: boolean;
  readonly retrievalAnchorCount?: number;
}

export interface ChatPipelineTelemetryFact extends ChatTelemetryFactBase {
  readonly eventClass: 'PIPELINE';
  readonly schema: 'chat.pipeline.fact.v1';
  readonly streamId: ChatTelemetryStreamId;
  readonly sinkId?: ChatTelemetrySinkId;
  readonly pipelineState: ChatTelemetryPipelineState;
  readonly batchSize?: number;
  readonly flushTrigger?: ChatTelemetryFlushTrigger;
  readonly retryAttempt?: number;
  readonly latencyMs?: number;
}

export type ChatTelemetryFact =
  | ChatSessionTelemetryFact
  | ChatMessageTelemetryFact
  | ChatPresenceTelemetryFact
  | ChatTypingTelemetryFact
  | ChatCursorTelemetryFact
  | ChatTranscriptTelemetryFact
  | ChatModerationTelemetryFact
  | ChatCommandTelemetryFact
  | ChatNpcTelemetryFact
  | ChatInvasionTelemetryFact
  | ChatWorldEventTelemetryFact
  | ChatLearningTelemetryFact
  | ChatPipelineTelemetryFact;

// ============================================================================
// MARK: Batching, queueing, flushing
// ============================================================================

export interface ChatTelemetryBatch {
  readonly batchId: ChatTelemetryBatchId;
  readonly streamId: ChatTelemetryStreamId;
  readonly createdAt: UnixMs;
  readonly flushAt?: UnixMs;
  readonly facts: readonly ChatTelemetryFact[];
  readonly approximateBytes: number;
  readonly highestPriority: ChatDeliveryPriority;
}

export interface ChatTelemetryFlushPlan {
  readonly flushId: ChatTelemetryFlushId;
  readonly streamId: ChatTelemetryStreamId;
  readonly sinkId: ChatTelemetrySinkId;
  readonly trigger: ChatTelemetryFlushTrigger;
  readonly createdAt: UnixMs;
  readonly batchIds: readonly ChatTelemetryBatchId[];
  readonly expectedFactCount: number;
  readonly expectedBytes: number;
}

export interface ChatTelemetryQueueState {
  readonly queueId: ChatTelemetryQueueId;
  readonly streamId: ChatTelemetryStreamId;
  readonly batches: readonly ChatTelemetryBatch[];
  readonly pendingFlushes: readonly ChatTelemetryFlushPlan[];
  readonly droppedFacts: number;
  readonly mergedFacts: number;
  readonly lastFlushAt?: UnixMs;
}

export interface ChatTelemetryDeliveryReceipt {
  readonly flushId: ChatTelemetryFlushId;
  readonly sinkId: ChatTelemetrySinkId;
  readonly deliveredAt: UnixMs;
  readonly factCount: number;
  readonly byteCount: number;
  readonly latencyMs: number;
  readonly success: boolean;
  readonly errorMessage?: string;
}

// ============================================================================
// MARK: Aggregate and KPI contracts
// ============================================================================

export interface ChatTelemetryRateMetric {
  readonly metricId: ChatTelemetryMetricId;
  readonly name: string;
  readonly kind: ChatTelemetryMetricKind;
  readonly window: ChatTelemetryAggregationWindow;
  readonly value: number;
  readonly dimensions: readonly ChatTelemetryDimension[];
}

export interface ChatSessionTelemetrySummary {
  readonly aggregateId: ChatTelemetryAggregateId;
  readonly sessionId: ChatSessionId;
  readonly openedAt: UnixMs;
  readonly closedAt?: UnixMs;
  readonly openCount: number;
  readonly channelChanges: number;
  readonly messageComposedCount: number;
  readonly messageSentCount: number;
  readonly messageFailedCount: number;
  readonly visibleReceiveCount: number;
  readonly typingSeenCount: number;
}

export interface ChatChannelTelemetrySummary {
  readonly aggregateId: ChatTelemetryAggregateId;
  readonly roomId?: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly window: ChatTelemetryAggregationWindow;
  readonly openedCount: number;
  readonly sentCount: number;
  readonly receivedCount: number;
  readonly crowdHeatMentions: number;
  readonly helperInterventions: number;
  readonly haterEscalations: number;
}

export interface ChatInvasionTelemetrySummary {
  readonly aggregateId: ChatTelemetryAggregateId;
  readonly roomId?: ChatRoomId;
  readonly window: ChatTelemetryAggregationWindow;
  readonly startedCount: number;
  readonly resolvedCount: number;
  readonly suppressedCount: number;
  readonly failedCount: number;
  readonly helperInterceptRate: number;
  readonly averageEscalationScore: number;
}

export interface ChatModerationTelemetrySummary {
  readonly aggregateId: ChatTelemetryAggregateId;
  readonly roomId?: ChatRoomId;
  readonly window: ChatTelemetryAggregationWindow;
  readonly allowedCount: number;
  readonly blockedCount: number;
  readonly shadowSuppressedCount: number;
  readonly redactedCount: number;
  readonly reviewQueuedCount: number;
}

export interface ChatLearningTelemetrySummary {
  readonly aggregateId: ChatTelemetryAggregateId;
  readonly window: ChatTelemetryAggregationWindow;
  readonly inferenceCount: number;
  readonly helperRecommendCount: number;
  readonly haterRecommendCount: number;
  readonly averageRankingLatencyMs: number;
  readonly averageRetrievalAnchorCount: number;
}

export interface ChatTelemetryDashboardSnapshot {
  readonly createdAt: UnixMs;
  readonly sessions: readonly ChatSessionTelemetrySummary[];
  readonly channels: readonly ChatChannelTelemetrySummary[];
  readonly invasions: readonly ChatInvasionTelemetrySummary[];
  readonly moderation: readonly ChatModerationTelemetrySummary[];
  readonly learning: readonly ChatLearningTelemetrySummary[];
  readonly pipelineHealth: readonly ChatTelemetryRateMetric[];
}

// ============================================================================
// MARK: Training and export contracts
// ============================================================================

export interface ChatTelemetryFeatureRow {
  readonly featureRowId: ChatTelemetryFeatureRowId;
  readonly createdAt: UnixMs;
  readonly sessionId?: ChatSessionId;
  readonly roomId?: ChatRoomId;
  readonly channelId?: ChatChannelId;
  readonly featureFamily:
    | 'ENGAGEMENT'
    | 'MODERATION'
    | 'INVASION'
    | 'NEGOTIATION'
    | 'HELPER'
    | 'HATER'
    | 'REPLAY';
  readonly numericFeatures: Readonly<Record<string, number>>;
  readonly categoricalFeatures: Readonly<Record<string, string>>;
  readonly booleanFeatures: Readonly<Record<string, boolean>>;
  readonly labelHints?: Readonly<Record<string, string | number | boolean>>;
}

export interface ChatTelemetryExportManifest {
  readonly exportId: ChatTelemetryExportId;
  readonly createdAt: UnixMs;
  readonly streamIds: readonly ChatTelemetryStreamId[];
  readonly schemaNames: readonly ChatTelemetrySchemaName[];
  readonly retentionClass: ChatTelemetryRetentionClass;
  readonly privacyClass: ChatTelemetryPrivacyClass;
  readonly factCount: number;
  readonly featureRowCount: number;
  readonly fileCount: number;
}

export interface ChatTelemetryQuery {
  readonly queryId: ChatTelemetryQueryId;
  readonly streamIds?: readonly ChatTelemetryStreamId[];
  readonly schemaNames?: readonly ChatTelemetrySchemaName[];
  readonly eventClasses?: readonly ChatTelemetryEventClass[];
  readonly roomId?: ChatRoomId;
  readonly channelId?: ChatChannelId;
  readonly sessionId?: ChatSessionId;
  readonly since?: UnixMs;
  readonly until?: UnixMs;
  readonly limit?: number;
}

export interface ChatTelemetryQueryResult {
  readonly queryId: ChatTelemetryQueryId;
  readonly facts: readonly ChatTelemetryFact[];
  readonly totalMatched: number;
  readonly truncated: boolean;
}

// ============================================================================
// MARK: Sink and stream registries
// ============================================================================

export const CHAT_TELEMETRY_SINKS: readonly ChatTelemetrySinkDescriptor[] = [
  {
    sinkId: 'sink_chat_realtime_queue' as ChatTelemetrySinkId,
    name: 'Realtime Queue',
    kind: 'IN_MEMORY_QUEUE',
    transport: 'QUEUE_PUSH',
    guarantee: 'AT_LEAST_ONCE',
    enabled: true,
    acceptsEventClasses: CHAT_TELEMETRY_EVENT_CLASSES,
    acceptsPrivacyClasses: ['PUBLIC_SAFE', 'PRODUCT_INTERNAL', 'SHADOW_RESTRICTED'],
    acceptsStreamTopics: ['chat.events.authoritative', 'chat.events.transport', 'chat.metrics.realtime'],
    backpressurePolicy: 'MERGE_DUPLICATES',
    retryBudget: 3,
  },
  {
    sinkId: 'sink_chat_audit_ndjson' as ChatTelemetrySinkId,
    name: 'Audit NDJSON',
    kind: 'NDJSON_FILE',
    transport: 'FILE_APPEND',
    guarantee: 'REPLAYABLE',
    enabled: true,
    acceptsEventClasses: ['SESSION', 'MESSAGE', 'MODERATION', 'COMMAND', 'INVASION', 'PIPELINE'],
    acceptsPrivacyClasses: ['AUDIT_ONLY', 'PRODUCT_INTERNAL', 'SHADOW_RESTRICTED'],
    acceptsStreamTopics: ['chat.events.authoritative', 'chat.metrics.audit'],
    backpressurePolicy: 'WRITE_TO_FILE',
    retryBudget: 5,
  },
  {
    sinkId: 'sink_chat_feature_store' as ChatTelemetrySinkId,
    name: 'Feature Store',
    kind: 'FEATURE_STORE',
    transport: 'POST',
    guarantee: 'AT_LEAST_ONCE',
    enabled: true,
    acceptsEventClasses: ['LEARNING', 'INVASION', 'MESSAGE', 'MODERATION'],
    acceptsPrivacyClasses: ['TRAINING_SAFE', 'PRODUCT_INTERNAL'],
    acceptsStreamTopics: ['chat.events.training'],
    backpressurePolicy: 'DROP_LOW_PRIORITY',
    retryBudget: 2,
  },
] as const;

export const CHAT_TELEMETRY_STREAMS: readonly ChatTelemetryStreamDescriptor[] = [
  {
    streamId: 'stream_chat_authoritative' as ChatTelemetryStreamId,
    topic: 'chat.events.authoritative',
    kind: 'AUTHORITATIVE_EVENT_STREAM',
    description: 'Backend-authoritative chat facts accepted into truth.',
    deliveryGuarantee: 'AT_LEAST_ONCE',
    retentionClass: 'AUDIT_SCOPED',
    defaultFlushTriggers: ['SIZE_LIMIT', 'TIME_LIMIT', 'RUN_END'],
    sinks: ['sink_chat_realtime_queue' as ChatTelemetrySinkId, 'sink_chat_audit_ndjson' as ChatTelemetrySinkId],
  },
  {
    streamId: 'stream_chat_transport' as ChatTelemetryStreamId,
    topic: 'chat.events.transport',
    kind: 'SERVER_TRANSPORT_STREAM',
    description: 'Transport-adjacent facts useful for fanout and debug.',
    deliveryGuarantee: 'BEST_EFFORT',
    retentionClass: 'SESSION_SCOPED',
    defaultFlushTriggers: ['SIZE_LIMIT', 'TIME_LIMIT', 'ROOM_EXIT'],
    sinks: ['sink_chat_realtime_queue' as ChatTelemetrySinkId],
  },
  {
    streamId: 'stream_chat_training' as ChatTelemetryStreamId,
    topic: 'chat.events.training',
    kind: 'TRAINING_EXPORT_STREAM',
    description: 'Training-safe feature and label exports.',
    deliveryGuarantee: 'REPLAYABLE',
    retentionClass: 'TRAINING_SCOPED',
    defaultFlushTriggers: ['RUN_END', 'TIME_LIMIT'],
    sinks: ['sink_chat_feature_store' as ChatTelemetrySinkId],
  },
] as const;

export const CHAT_TELEMETRY_SCHEMAS: readonly ChatTelemetrySchemaDescriptor[] = [
  {
    schemaId: 'schema_chat_session_v1' as ChatTelemetrySchemaId,
    schemaName: 'chat.session.fact.v1',
    version: '1',
    eventClass: 'SESSION',
    retentionClass: 'SESSION_SCOPED',
    privacyClass: 'PRODUCT_INTERNAL',
    trainingSafe: true,
    fields: ['lifecycleEvent', 'panelOpen', 'activeChannel', 'activeMount', 'unreadCount'],
  },
  {
    schemaId: 'schema_chat_message_v1' as ChatTelemetrySchemaId,
    schemaName: 'chat.message.fact.v1',
    version: '1',
    eventClass: 'MESSAGE',
    retentionClass: 'AUDIT_SCOPED',
    privacyClass: 'PRODUCT_INTERNAL',
    trainingSafe: true,
    fields: ['messageId', 'originSurface', 'deliveryState', 'moderationState', 'attachmentCount', 'embedCount', 'bodyLength'],
  },
  {
    schemaId: 'schema_chat_invasion_v1' as ChatTelemetrySchemaId,
    schemaName: 'chat.invasion.fact.v1',
    version: '1',
    eventClass: 'INVASION',
    retentionClass: 'AUDIT_SCOPED',
    privacyClass: 'SHADOW_RESTRICTED',
    trainingSafe: true,
    fields: ['invasionId', 'invasionKind', 'invasionStage', 'helperIntercepted', 'counterplayOpen', 'importanceBand'],
  },
] as const;

// ============================================================================
// MARK: Builders and mappers
// ============================================================================

export function isChatTelemetryStreamKind(
  value: unknown,
): value is ChatTelemetryStreamKind {
  return typeof value === 'string' &&
    (CHAT_TELEMETRY_STREAM_KINDS as readonly string[]).includes(value);
}

export function isChatTelemetrySinkKind(
  value: unknown,
): value is ChatTelemetrySinkKind {
  return typeof value === 'string' &&
    (CHAT_TELEMETRY_SINK_KINDS as readonly string[]).includes(value);
}

export function isChatTelemetryTransportKind(
  value: unknown,
): value is ChatTelemetryTransportKind {
  return typeof value === 'string' &&
    (CHAT_TELEMETRY_TRANSPORT_KINDS as readonly string[]).includes(value);
}

export function isChatTelemetryPrivacyClass(
  value: unknown,
): value is ChatTelemetryPrivacyClass {
  return typeof value === 'string' &&
    (CHAT_TELEMETRY_PRIVACY_CLASSES as readonly string[]).includes(value);
}

export function isChatTelemetryEventClass(
  value: unknown,
): value is ChatTelemetryEventClass {
  return typeof value === 'string' &&
    (CHAT_TELEMETRY_EVENT_CLASSES as readonly string[]).includes(value);
}

export function getTelemetryStream(
  streamId: ChatTelemetryStreamId | string,
): Optional<ChatTelemetryStreamDescriptor> {
  return CHAT_TELEMETRY_STREAMS.find((stream) => stream.streamId === streamId);
}

export function getTelemetrySink(
  sinkId: ChatTelemetrySinkId | string,
): Optional<ChatTelemetrySinkDescriptor> {
  return CHAT_TELEMETRY_SINKS.find((sink) => sink.sinkId === sinkId);
}

export function getTelemetrySchema(
  schemaName: ChatTelemetrySchemaName | string,
): Optional<ChatTelemetrySchemaDescriptor> {
  return CHAT_TELEMETRY_SCHEMAS.find((schema) => schema.schemaName === schemaName);
}

export function buildTelemetryContext(
  partial: Partial<ChatTelemetryContext>,
): ChatTelemetryContext {
  return {
    dimensions: partial.dimensions ?? [],
    sessionId: partial.sessionId,
    roomId: partial.roomId,
    channelId: partial.channelId,
    modeScope: partial.modeScope,
    mountTarget: partial.mountTarget,
    requestId: partial.requestId,
    userId: partial.userId,
    npcId: partial.npcId,
    worldEventId: partial.worldEventId,
    replayId: partial.replayId,
    correlationId: partial.correlationId,
    dedupeKey: partial.dedupeKey,
  };
}

export function buildPipelineTelemetryFact(
  telemetryId: ChatTelemetryId,
  streamId: ChatTelemetryStreamId,
  occurredAt: UnixMs,
  context: ChatTelemetryContext,
  pipelineState: ChatTelemetryPipelineState,
  sinkId?: ChatTelemetrySinkId,
  batchSize?: number,
  flushTrigger?: ChatTelemetryFlushTrigger,
  retryAttempt?: number,
  latencyMs?: number,
): ChatPipelineTelemetryFact {
  return {
    factId: (`fact:pipeline:${String(occurredAt)}:${pipelineState}`) as ChatTelemetryFactId,
    telemetryId,
    occurredAt,
    schema: 'chat.pipeline.fact.v1',
    eventClass: 'PIPELINE',
    privacyClass: 'PRODUCT_INTERNAL',
    authoritative: true,
    context,
    payload: {},
    streamId,
    sinkId,
    pipelineState,
    batchSize,
    flushTrigger,
    retryAttempt,
    latencyMs,
  };
}

export function buildMessageTelemetryFact(
  telemetryId: ChatTelemetryId,
  occurredAt: UnixMs,
  context: ChatTelemetryContext,
  message: ChatCanonicalMessage,
): ChatMessageTelemetryFact {
  return {
    factId: (`fact:message:${message.messageId}`) as ChatTelemetryFactId,
    telemetryId,
    occurredAt,
    schema: 'chat.message.fact.v1',
    eventClass: 'MESSAGE',
    privacyClass: 'PRODUCT_INTERNAL',
    authoritative: message.delivery.state === 'AUTHORITATIVE' || message.delivery.state === 'ACKNOWLEDGED',
    context,
    payload: {},
    messageId: message.messageId,
    originSurface: message.origin.originSurface,
    deliveryState: message.delivery.state,
    moderationState: message.moderation.decision.state,
    attachmentCount: message.attachments.length,
    embedCount: message.embeds.length,
    bodyLength: message.body.plainText.length,
    toneBand: message.toneBand,
    notificationKind: message.notifications.at(0),
  };
}

export function buildPresenceTelemetryFact(
  telemetryId: ChatTelemetryId,
  occurredAt: UnixMs,
  context: ChatTelemetryContext,
  roster: ChatPresenceRoster,
): ChatPresenceTelemetryFact {
  return {
    factId: (`fact:presence:${roster.rosterId}`) as ChatTelemetryFactId,
    telemetryId,
    occurredAt,
    schema: 'chat.presence.fact.v1',
    eventClass: 'PRESENCE',
    privacyClass: 'PRODUCT_INTERNAL',
    authoritative: true,
    context,
    payload: {},
    visibleCount: roster.entries.filter((entry) => entry.playerVisible).length,
    hiddenCount: roster.entries.filter((entry) => !entry.playerVisible).length,
    typingActors: roster.entries.filter((entry) => Boolean(entry.typingPlan)).length,
    rosterVersion: String(roster.version),
  };
}

export function buildTypingTelemetryFact(
  telemetryId: ChatTelemetryId,
  occurredAt: UnixMs,
  context: ChatTelemetryContext,
  event: ChatTypingTelemetryEvent,
): ChatTypingTelemetryFact {
  return {
    factId: (`fact:typing:${event.telemetryId}`) as ChatTelemetryFactId,
    telemetryId,
    occurredAt,
    schema: 'chat.typing.fact.v1',
    eventClass: 'TYPING',
    privacyClass: 'PRODUCT_INTERNAL',
    authoritative: event.authority === 'BACKEND_AUTHORITATIVE' || event.authority === 'BACKEND_LEDGER',
    context,
    payload: {},
    actorKey: event.actorId,
    source: event.eventName,
    typingState: event.eventName,
    latencyBudgetMs: undefined,
    revealDelayMs: undefined,
  };
}

export function buildCursorTelemetryFact(
  telemetryId: ChatTelemetryId,
  occurredAt: UnixMs,
  context: ChatTelemetryContext,
  event: ChatCursorTelemetryEvent,
): ChatCursorTelemetryFact {
  return {
    factId: (`fact:cursor:${event.telemetryId}`) as ChatTelemetryFactId,
    telemetryId,
    occurredAt,
    schema: 'chat.cursor.fact.v1',
    eventClass: 'CURSOR',
    privacyClass: 'PRODUCT_INTERNAL',
    authoritative: event.authority === 'BACKEND_AUTHORITATIVE' || event.authority === 'BACKEND_LEDGER',
    context,
    payload: {},
    surface: 'TRANSCRIPT',
    intent: 'NAVIGATE',
    hasSelection: false,
    hasViewport: false,
    windowStart: undefined,
    windowEnd: undefined,
  };
}

export function buildModerationTelemetryFact(
  telemetryId: ChatTelemetryId,
  occurredAt: UnixMs,
  context: ChatTelemetryContext,
  result: ChatModerationResult,
): ChatModerationTelemetryFact {
  return {
    factId: (`fact:moderation:${String(occurredAt)}`) as ChatTelemetryFactId,
    telemetryId,
    occurredAt,
    schema: 'chat.moderation.fact.v1',
    eventClass: 'MODERATION',
    privacyClass: 'AUDIT_ONLY',
    authoritative: true,
    context,
    payload: {},
    moderationState: result.decision.state,
    actionKinds: [result.decision.actionKind],
    riskLabels: result.classifierOutputs.map((risk) => risk.label),
    blockedVisibleTranscript: result.decision.state === 'BLOCKED' || result.decision.state === 'SHADOW_SUPPRESSED',
    reviewRequired: result.decision.reviewRequired,
  };
}

export function buildInvasionTelemetryFact(
  telemetryId: ChatTelemetryId,
  occurredAt: UnixMs,
  context: ChatTelemetryContext,
  runtimeState: ChatInvasionRuntimeState,
  template: ChatInvasionTemplate,
  counterplayOpen: boolean,
): ChatInvasionTelemetryFact {
  return {
    factId: (`fact:invasion:${runtimeState.invasionId}`) as ChatTelemetryFactId,
    telemetryId,
    occurredAt,
    schema: 'chat.invasion.fact.v1',
    eventClass: 'INVASION',
    privacyClass: 'SHADOW_RESTRICTED',
    authoritative: true,
    context,
    payload: {},
    invasionId: runtimeState.invasionId,
    invasionKind: runtimeState.kind,
    invasionStage: runtimeState.stage,
    helperIntercepted: runtimeState.helperIntercepted,
    counterplayOpen,
    importanceBand: template.importance,
  };
}

export function buildLearningTelemetryFact(
  telemetryId: ChatTelemetryId,
  occurredAt: UnixMs,
  context: ChatTelemetryContext,
  inferenceSnapshot: { requestId?: ChatRequestId; selectedCandidateId?: string; helperShouldIntervene?: boolean; haterShouldEscalate?: boolean; retrievalAnchorIds: readonly unknown[] },
): ChatLearningTelemetryFact {
  return {
    factId: (`fact:learning:${inferenceSnapshot.requestId}`) as ChatTelemetryFactId,
    telemetryId,
    occurredAt,
    schema: 'chat.learning.fact.v1',
    eventClass: 'LEARNING',
    privacyClass: 'TRAINING_SAFE',
    authoritative: true,
    context,
    payload: {},
    candidateCount: undefined,
    selectedCandidateId: inferenceSnapshot.selectedCandidateId,
    helperShouldIntervene: inferenceSnapshot.helperShouldIntervene,
    haterShouldEscalate: inferenceSnapshot.haterShouldEscalate,
    retrievalAnchorCount: inferenceSnapshot.retrievalAnchorIds.length,
  };
}

export function createTelemetryBatch(
  streamId: ChatTelemetryStreamId,
  facts: readonly ChatTelemetryFact[],
  createdAt: UnixMs,
  flushAt?: UnixMs,
): ChatTelemetryBatch {
  const priorityOrder: Record<ChatDeliveryPriority, number> = {
    IMMEDIATE: 5,
    HIGH: 4,
    NORMAL: 3,
    LOW: 2,
    DEFERRED: 1,
  };

  const highestPriority = facts.reduce<ChatDeliveryPriority>(
    (current, fact) => {
      const factPriority: ChatDeliveryPriority =
        fact.eventClass === 'INVASION' || fact.eventClass === 'MODERATION'
          ? 'HIGH'
          : fact.eventClass === 'PIPELINE'
            ? 'LOW'
            : 'NORMAL';
      return priorityOrder[factPriority] > priorityOrder[current]
        ? factPriority
        : current;
    },
    'DEFERRED',
  );

  return {
    batchId: (`batch:${streamId}:${String(createdAt)}`) as ChatTelemetryBatchId,
    streamId,
    createdAt,
    flushAt,
    facts,
    approximateBytes: JSON.stringify(facts).length,
    highestPriority,
  };
}

export function buildTelemetryFeatureRows(
  facts: readonly ChatTelemetryFact[],
  createdAt: UnixMs,
): readonly ChatTelemetryFeatureRow[] {
  return facts.map((fact, index) => ({
    featureRowId: (`feature:${index}:${String(createdAt)}`) as ChatTelemetryFeatureRowId,
    createdAt,
    sessionId: fact.context.sessionId,
    roomId: fact.context.roomId,
    channelId: fact.context.channelId,
    featureFamily:
      fact.eventClass === 'INVASION'
        ? 'INVASION'
        : fact.eventClass === 'MODERATION'
          ? 'MODERATION'
          : fact.eventClass === 'LEARNING'
            ? 'HELPER'
            : 'ENGAGEMENT',
    numericFeatures: {
      occurredAt: fact.occurredAt,
    },
    categoricalFeatures: {
      eventClass: fact.eventClass,
      schema: fact.schema,
    },
    booleanFeatures: {
      authoritative: fact.authoritative,
    },
    labelHints: {
      privacyClass: fact.privacyClass,
    },
  }));
}

export function summarizeChannelTelemetry(
  facts: readonly ChatTelemetryFact[],
  channelId: ChatChannelId,
  window: ChatTelemetryAggregationWindow,
): ChatChannelTelemetrySummary {
  const channelFacts = facts.filter((fact) => fact.context.channelId === channelId);
  return {
    aggregateId: (`agg:channel:${channelId}:${window}`) as ChatTelemetryAggregateId,
    roomId: channelFacts[0]?.context.roomId,
    channelId,
    window,
    openedCount: channelFacts.filter((fact) => fact.eventClass === 'SESSION').length,
    sentCount: channelFacts.filter((fact) => fact.eventClass === 'MESSAGE').length,
    receivedCount: channelFacts.filter((fact) => fact.eventClass === 'MESSAGE').length,
    crowdHeatMentions: channelFacts.filter((fact) =>
      fact.eventClass === 'INVASION' || fact.eventClass === 'WORLD_EVENT',
    ).length,
    helperInterventions: channelFacts.filter((fact) =>
      fact.eventClass === 'LEARNING' &&
      'helperShouldIntervene' in fact &&
      fact.helperShouldIntervene,
    ).length,
    haterEscalations: channelFacts.filter((fact) =>
      fact.eventClass === 'INVASION' &&
      'invasionKind' in fact &&
      fact.invasionKind === 'HATER_SWARM',
    ).length,
  };
}

export function summarizeInvasionTelemetry(
  facts: readonly ChatTelemetryFact[],
  window: ChatTelemetryAggregationWindow,
): ChatInvasionTelemetrySummary {
  const invasionFacts = facts.filter((fact): fact is ChatInvasionTelemetryFact =>
    fact.eventClass === 'INVASION',
  );
  const started = invasionFacts.filter((fact) => fact.invasionStage === 'VISIBLE_OPEN' || fact.invasionStage === 'SHADOW_OPEN').length;
  const resolved = invasionFacts.filter((fact) => fact.invasionStage === 'RESOLVED').length;
  const suppressed = invasionFacts.filter((fact) => fact.invasionStage === 'SUPPRESSED').length;
  const failed = invasionFacts.filter((fact) => fact.invasionStage === 'FAILED').length;

  return {
    aggregateId: (`agg:invasion:${window}`) as ChatTelemetryAggregateId,
    roomId: invasionFacts[0]?.context.roomId,
    window,
    startedCount: started,
    resolvedCount: resolved,
    suppressedCount: suppressed,
    failedCount: failed,
    helperInterceptRate:
      invasionFacts.length === 0
        ? 0
        : invasionFacts.filter((fact) => fact.helperIntercepted).length / invasionFacts.length,
    averageEscalationScore: invasionFacts.length === 0 ? 0 : 50,
  };
}

export interface ChatTelemetryValidationIssue {
  readonly code:
    | 'unknown_stream'
    | 'unknown_sink'
    | 'unknown_schema'
    | 'schema_event_class_mismatch'
    | 'privacy_violation'
    | 'empty_batch';
  readonly message: string;
}

export interface ChatTelemetryValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ChatTelemetryValidationIssue[];
}

export function validateTelemetryFact(
  fact: ChatTelemetryFact,
): ChatTelemetryValidationResult {
  const issues: ChatTelemetryValidationIssue[] = [];
  const schema = getTelemetrySchema(fact.schema);

  if (!schema) {
    issues.push({
      code: 'unknown_schema',
      message: `Unknown telemetry schema: ${fact.schema}`,
    });
  } else if (schema.eventClass !== fact.eventClass) {
    issues.push({
      code: 'schema_event_class_mismatch',
      message: `Telemetry schema ${fact.schema} does not match event class ${fact.eventClass}`,
    });
  }

  if (
    fact.privacyClass === 'PUBLIC_SAFE' &&
    fact.eventClass === 'MODERATION'
  ) {
    issues.push({
      code: 'privacy_violation',
      message: 'Moderation telemetry cannot be marked PUBLIC_SAFE.',
    });
  }

  return { ok: issues.length === 0, issues };
}

export function validateTelemetryBatch(
  batch: ChatTelemetryBatch,
): ChatTelemetryValidationResult {
  const issues: ChatTelemetryValidationIssue[] = [];

  if (!getTelemetryStream(batch.streamId)) {
    issues.push({
      code: 'unknown_stream',
      message: `Unknown telemetry stream: ${batch.streamId}`,
    });
  }

  if (batch.facts.length === 0) {
    issues.push({
      code: 'empty_batch',
      message: 'Telemetry batch must contain at least one fact.',
    });
  }

  for (const fact of batch.facts) {
    issues.push(...validateTelemetryFact(fact).issues);
  }

  return { ok: issues.length === 0, issues };
}

export const CHAT_TELEMETRY_CONTRACT_DESCRIPTOR = Object.freeze({
  namespace: 'shared/contracts/chat/ChatTelemetry',
  version: CHAT_CONTRACT_VERSION,
  authorities: CHAT_CONTRACT_AUTHORITIES,
  streamKinds: CHAT_TELEMETRY_STREAM_KINDS,
  sinkKinds: CHAT_TELEMETRY_SINK_KINDS,
  transportKinds: CHAT_TELEMETRY_TRANSPORT_KINDS,
  deliveryGuarantees: CHAT_TELEMETRY_DELIVERY_GUARANTEES,
  flushTriggers: CHAT_TELEMETRY_FLUSH_TRIGGERS,
  retentionClasses: CHAT_TELEMETRY_RETENTION_CLASSES,
  privacyClasses: CHAT_TELEMETRY_PRIVACY_CLASSES,
  aggregationWindows: CHAT_TELEMETRY_AGGREGATION_WINDOWS,
  metricKinds: CHAT_TELEMETRY_METRIC_KINDS,
  eventClasses: CHAT_TELEMETRY_EVENT_CLASSES,
  backpressurePolicies: CHAT_TELEMETRY_BACKPRESSURE_POLICIES,
  schemas: CHAT_TELEMETRY_SCHEMAS.map((schema) => ({
    schemaName: schema.schemaName,
    eventClass: schema.eventClass,
    retentionClass: schema.retentionClass,
    privacyClass: schema.privacyClass,
  })),
  sinks: CHAT_TELEMETRY_SINKS.map((sink) => ({
    sinkId: sink.sinkId,
    name: sink.name,
    kind: sink.kind,
    enabled: sink.enabled,
  })),
  streams: CHAT_TELEMETRY_STREAMS.map((stream) => ({
    streamId: stream.streamId,
    topic: stream.topic,
    kind: stream.kind,
    sinkCount: stream.sinks.length,
  })),
} as const);
