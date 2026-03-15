/**
 * ============================================================================
 * POINT ZERO ONE — SERVER CHAT METRICS SERVICE
 * FILE: pzo-server/src/chat/ChatMetrics.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical transport-observability service for unified chat.
 *
 * This file exists because pzo-server transport is intentionally staying thin.
 * Once ChatGateway, handlers, replay service, and fanout service are split,
 * metrics can no longer remain an afterthought hidden in console logs or
 * scattered counters. The server lane needs one metrics service that can:
 *
 * - count inbound intent traffic,
 * - count outbound authority traffic,
 * - observe replay hydration,
 * - observe fanout preparation and emission,
 * - observe contract acceptance/rejection,
 * - compute room / channel / transport health snapshots,
 * - keep recent windows for rates and latency,
 * - publish structured metric envelopes when desired,
 * - export durable snapshots for dashboards or diagnostics,
 * - and remain explicitly transport-side instead of pretending to be backend
 *   chat authority.
 *
 * This service is not the backend telemetry sink. Backend chat authority will
 * still own authoritative event streams, transcript truth, replay truth, and
 * ML/DL feature truth. This file only measures the server transport lane.
 *
 * Design laws
 * -----------
 * - Metrics service never invents chat state.
 * - Metrics service never mutates transcript truth.
 * - Metrics service may observe intent, delivery, replay, and liveness.
 * - Metrics emission must be bounded and rate-safe.
 * - Windowed rates must be deterministic and cheap.
 * - Fanout metrics must use the same channel and event vocabulary as transport.
 * - Contract validation metrics must distinguish rejection from normalization.
 * ============================================================================
 */

import { createHash, randomUUID } from 'crypto';
import type {
  ChatAudienceKind,
  ChatAuthoritativeEnvelope,
  ChatChannelId,
  ChatEmissionResult,
  ChatFanoutEventName,
  ChatFanoutService,
  ChatMetricsFanoutPayload,
  ChatOutboxStatus,
  ChatPreparedEmission,
} from './ChatFanoutService';
import { createChatMetricsEnvelope } from './ChatFanoutService';
import type {
  ChatSocketErrorCode,
  ChatSocketValidationDisposition,
  ChatSocketValidationSummary,
  ChatSocketWarningCode,
} from './ChatSocketContracts';

/**
 * --------------------------------------------------------------------------
 * Metric identity
 * --------------------------------------------------------------------------
 */

export type ChatMetricDomain =
  | 'TRANSPORT'
  | 'SESSION'
  | 'ROOM'
  | 'CHANNEL'
  | 'INBOUND'
  | 'OUTBOUND'
  | 'MESSAGE'
  | 'PRESENCE'
  | 'TYPING'
  | 'CURSOR'
  | 'REPLAY'
  | 'FANOUT'
  | 'CONTROL'
  | 'CONTRACT'
  | 'HEALTH'
  | 'LATENCY';

export type ChatMetricKind = 'COUNTER' | 'GAUGE' | 'HISTOGRAM' | 'RATE' | 'STATE';

export type ChatMetricName =
  | 'transport.connections.open'
  | 'transport.connections.close'
  | 'transport.heartbeat.accepted'
  | 'transport.heartbeat.missed'
  | 'transport.heartbeat.latency_ms'
  | 'transport.payload.bytes.in'
  | 'transport.payload.bytes.out'
  | 'session.bind.accepted'
  | 'session.bind.rejected'
  | 'session.resume.accepted'
  | 'session.resume.rejected'
  | 'session.active.gauge'
  | 'session.connected.gauge'
  | 'session.reconnecting.gauge'
  | 'room.join.accepted'
  | 'room.leave.accepted'
  | 'room.active.gauge'
  | 'room.population.gauge'
  | 'channel.messages.sent'
  | 'channel.messages.preview_only'
  | 'channel.presence.updates'
  | 'channel.typing.starts'
  | 'channel.typing.stops'
  | 'channel.cursor.updates'
  | 'channel.cursor.clears'
  | 'inbound.frames.accepted'
  | 'inbound.frames.accepted_with_warnings'
  | 'inbound.frames.rejected'
  | 'inbound.errors.count'
  | 'inbound.warnings.count'
  | 'outbound.frames.enqueued'
  | 'outbound.frames.emitted'
  | 'outbound.frames.partial'
  | 'outbound.frames.failed'
  | 'outbound.ack.sent'
  | 'outbound.bytes.total'
  | 'message.intent.accepted'
  | 'message.intent.rejected'
  | 'presence.intent.accepted'
  | 'presence.intent.rejected'
  | 'typing.intent.accepted'
  | 'typing.intent.rejected'
  | 'cursor.intent.accepted'
  | 'cursor.intent.rejected'
  | 'replay.requests.accepted'
  | 'replay.requests.rejected'
  | 'replay.requests.cache_hit'
  | 'replay.requests.cache_miss'
  | 'replay.requests.inflight_join'
  | 'replay.requests.timeout'
  | 'replay.requests.failed'
  | 'replay.chunks.sent'
  | 'replay.chunks.bytes'
  | 'replay.completions'
  | 'replay.duration_ms'
  | 'fanout.prepared'
  | 'fanout.prepared.recipients'
  | 'fanout.emitted'
  | 'fanout.partial'
  | 'fanout.failed'
  | 'fanout.delivery_ratio'
  | 'fanout.outbox.queued'
  | 'fanout.outbox.acked'
  | 'fanout.outbox.failed'
  | 'fanout.outbox.dropped'
  | 'control.events.sent'
  | 'control.errors.sent'
  | 'contract.reject.code'
  | 'contract.warning.code'
  | 'contract.validation.latency_ms'
  | 'health.transport.score'
  | 'health.replay.score'
  | 'health.fanout.score'
  | 'latency.backend.roundtrip_ms'
  | 'latency.gateway.handle_ms'
  | 'latency.fanout.emit_ms'
  | 'latency.replay.fetch_ms';

export interface ChatMetricDimensions {
  readonly roomId?: string;
  readonly channelId?: ChatChannelId;
  readonly audienceKind?: ChatAudienceKind;
  readonly sessionId?: string;
  readonly playerId?: string;
  readonly eventName?: string;
  readonly subtype?: string;
  readonly hydrationMode?: string;
  readonly excerptKind?: string;
  readonly status?: string;
  readonly disposition?: ChatSocketValidationDisposition | ChatOutboxStatus | string;
  readonly errorCode?: ChatSocketErrorCode | string;
  readonly warningCode?: ChatSocketWarningCode | string;
  readonly source?: string;
  readonly tags?: Record<string, string | number | boolean>;
}

export interface ChatMetricDefinition {
  readonly name: ChatMetricName;
  readonly domain: ChatMetricDomain;
  readonly kind: ChatMetricKind;
  readonly description: string;
  readonly unit: 'count' | 'ratio' | 'ms' | 'bytes' | 'sessions' | 'rooms' | 'population' | 'score';
  readonly fanoutEligible: boolean;
}

export const CHAT_METRIC_DEFINITIONS: Readonly<Record<ChatMetricName, ChatMetricDefinition>> = {
  'transport.connections.open': metric('transport.connections.open', 'TRANSPORT', 'COUNTER', 'Accepted transport connections', 'count', true),
  'transport.connections.close': metric('transport.connections.close', 'TRANSPORT', 'COUNTER', 'Closed transport connections', 'count', true),
  'transport.heartbeat.accepted': metric('transport.heartbeat.accepted', 'TRANSPORT', 'COUNTER', 'Accepted heartbeat frames', 'count', false),
  'transport.heartbeat.missed': metric('transport.heartbeat.missed', 'TRANSPORT', 'COUNTER', 'Missed heartbeat windows', 'count', true),
  'transport.heartbeat.latency_ms': metric('transport.heartbeat.latency_ms', 'TRANSPORT', 'HISTOGRAM', 'Heartbeat latency', 'ms', false),
  'transport.payload.bytes.in': metric('transport.payload.bytes.in', 'TRANSPORT', 'COUNTER', 'Inbound payload bytes', 'bytes', false),
  'transport.payload.bytes.out': metric('transport.payload.bytes.out', 'TRANSPORT', 'COUNTER', 'Outbound payload bytes', 'bytes', false),
  'session.bind.accepted': metric('session.bind.accepted', 'SESSION', 'COUNTER', 'Accepted hello binds', 'count', true),
  'session.bind.rejected': metric('session.bind.rejected', 'SESSION', 'COUNTER', 'Rejected hello binds', 'count', true),
  'session.resume.accepted': metric('session.resume.accepted', 'SESSION', 'COUNTER', 'Accepted resumes', 'count', true),
  'session.resume.rejected': metric('session.resume.rejected', 'SESSION', 'COUNTER', 'Rejected resumes', 'count', true),
  'session.active.gauge': metric('session.active.gauge', 'SESSION', 'GAUGE', 'Active sessions', 'sessions', true),
  'session.connected.gauge': metric('session.connected.gauge', 'SESSION', 'GAUGE', 'Connected sessions', 'sessions', true),
  'session.reconnecting.gauge': metric('session.reconnecting.gauge', 'SESSION', 'GAUGE', 'Reconnecting sessions', 'sessions', true),
  'room.join.accepted': metric('room.join.accepted', 'ROOM', 'COUNTER', 'Accepted room joins', 'count', true),
  'room.leave.accepted': metric('room.leave.accepted', 'ROOM', 'COUNTER', 'Accepted room leaves', 'count', true),
  'room.active.gauge': metric('room.active.gauge', 'ROOM', 'GAUGE', 'Active rooms', 'rooms', true),
  'room.population.gauge': metric('room.population.gauge', 'ROOM', 'GAUGE', 'Room population', 'population', true),
  'channel.messages.sent': metric('channel.messages.sent', 'CHANNEL', 'COUNTER', 'Messages sent by channel', 'count', true),
  'channel.messages.preview_only': metric('channel.messages.preview_only', 'CHANNEL', 'COUNTER', 'Preview-only message intents', 'count', false),
  'channel.presence.updates': metric('channel.presence.updates', 'CHANNEL', 'COUNTER', 'Presence updates by channel or room', 'count', true),
  'channel.typing.starts': metric('channel.typing.starts', 'CHANNEL', 'COUNTER', 'Typing starts', 'count', false),
  'channel.typing.stops': metric('channel.typing.stops', 'CHANNEL', 'COUNTER', 'Typing stops', 'count', false),
  'channel.cursor.updates': metric('channel.cursor.updates', 'CHANNEL', 'COUNTER', 'Cursor updates', 'count', false),
  'channel.cursor.clears': metric('channel.cursor.clears', 'CHANNEL', 'COUNTER', 'Cursor clears', 'count', false),
  'inbound.frames.accepted': metric('inbound.frames.accepted', 'INBOUND', 'COUNTER', 'Accepted inbound frames', 'count', true),
  'inbound.frames.accepted_with_warnings': metric('inbound.frames.accepted_with_warnings', 'INBOUND', 'COUNTER', 'Accepted inbound frames with warnings', 'count', true),
  'inbound.frames.rejected': metric('inbound.frames.rejected', 'INBOUND', 'COUNTER', 'Rejected inbound frames', 'count', true),
  'inbound.errors.count': metric('inbound.errors.count', 'INBOUND', 'COUNTER', 'Inbound validation errors', 'count', false),
  'inbound.warnings.count': metric('inbound.warnings.count', 'INBOUND', 'COUNTER', 'Inbound validation warnings', 'count', false),
  'outbound.frames.enqueued': metric('outbound.frames.enqueued', 'OUTBOUND', 'COUNTER', 'Outbound frames enqueued', 'count', true),
  'outbound.frames.emitted': metric('outbound.frames.emitted', 'OUTBOUND', 'COUNTER', 'Outbound frames emitted', 'count', true),
  'outbound.frames.partial': metric('outbound.frames.partial', 'OUTBOUND', 'COUNTER', 'Partial outbound emissions', 'count', true),
  'outbound.frames.failed': metric('outbound.frames.failed', 'OUTBOUND', 'COUNTER', 'Failed outbound emissions', 'count', true),
  'outbound.ack.sent': metric('outbound.ack.sent', 'OUTBOUND', 'COUNTER', 'Server acks sent', 'count', false),
  'outbound.bytes.total': metric('outbound.bytes.total', 'OUTBOUND', 'COUNTER', 'Outbound bytes', 'bytes', false),
  'message.intent.accepted': metric('message.intent.accepted', 'MESSAGE', 'COUNTER', 'Accepted message intents', 'count', true),
  'message.intent.rejected': metric('message.intent.rejected', 'MESSAGE', 'COUNTER', 'Rejected message intents', 'count', true),
  'presence.intent.accepted': metric('presence.intent.accepted', 'PRESENCE', 'COUNTER', 'Accepted presence intents', 'count', false),
  'presence.intent.rejected': metric('presence.intent.rejected', 'PRESENCE', 'COUNTER', 'Rejected presence intents', 'count', false),
  'typing.intent.accepted': metric('typing.intent.accepted', 'TYPING', 'COUNTER', 'Accepted typing intents', 'count', false),
  'typing.intent.rejected': metric('typing.intent.rejected', 'TYPING', 'COUNTER', 'Rejected typing intents', 'count', false),
  'cursor.intent.accepted': metric('cursor.intent.accepted', 'CURSOR', 'COUNTER', 'Accepted cursor intents', 'count', false),
  'cursor.intent.rejected': metric('cursor.intent.rejected', 'CURSOR', 'COUNTER', 'Rejected cursor intents', 'count', false),
  'replay.requests.accepted': metric('replay.requests.accepted', 'REPLAY', 'COUNTER', 'Accepted replay requests', 'count', true),
  'replay.requests.rejected': metric('replay.requests.rejected', 'REPLAY', 'COUNTER', 'Rejected replay requests', 'count', true),
  'replay.requests.cache_hit': metric('replay.requests.cache_hit', 'REPLAY', 'COUNTER', 'Replay cache hits', 'count', true),
  'replay.requests.cache_miss': metric('replay.requests.cache_miss', 'REPLAY', 'COUNTER', 'Replay cache misses', 'count', true),
  'replay.requests.inflight_join': metric('replay.requests.inflight_join', 'REPLAY', 'COUNTER', 'Replay inflight joins', 'count', true),
  'replay.requests.timeout': metric('replay.requests.timeout', 'REPLAY', 'COUNTER', 'Replay timeouts', 'count', true),
  'replay.requests.failed': metric('replay.requests.failed', 'REPLAY', 'COUNTER', 'Replay failures', 'count', true),
  'replay.chunks.sent': metric('replay.chunks.sent', 'REPLAY', 'COUNTER', 'Replay chunks sent', 'count', true),
  'replay.chunks.bytes': metric('replay.chunks.bytes', 'REPLAY', 'COUNTER', 'Replay chunk bytes', 'bytes', false),
  'replay.completions': metric('replay.completions', 'REPLAY', 'COUNTER', 'Replay completions', 'count', true),
  'replay.duration_ms': metric('replay.duration_ms', 'REPLAY', 'HISTOGRAM', 'Replay request duration', 'ms', false),
  'fanout.prepared': metric('fanout.prepared', 'FANOUT', 'COUNTER', 'Prepared fanout emissions', 'count', true),
  'fanout.prepared.recipients': metric('fanout.prepared.recipients', 'FANOUT', 'HISTOGRAM', 'Recipients per prepared emission', 'count', false),
  'fanout.emitted': metric('fanout.emitted', 'FANOUT', 'COUNTER', 'Successful fanout emissions', 'count', true),
  'fanout.partial': metric('fanout.partial', 'FANOUT', 'COUNTER', 'Partial fanout emissions', 'count', true),
  'fanout.failed': metric('fanout.failed', 'FANOUT', 'COUNTER', 'Failed fanout emissions', 'count', true),
  'fanout.delivery_ratio': metric('fanout.delivery_ratio', 'FANOUT', 'RATE', 'Delivered over prepared ratio', 'ratio', true),
  'fanout.outbox.queued': metric('fanout.outbox.queued', 'FANOUT', 'COUNTER', 'Queued outbox items', 'count', false),
  'fanout.outbox.acked': metric('fanout.outbox.acked', 'FANOUT', 'COUNTER', 'Acked outbox items', 'count', false),
  'fanout.outbox.failed': metric('fanout.outbox.failed', 'FANOUT', 'COUNTER', 'Failed outbox items', 'count', false),
  'fanout.outbox.dropped': metric('fanout.outbox.dropped', 'FANOUT', 'COUNTER', 'Dropped outbox items', 'count', false),
  'control.events.sent': metric('control.events.sent', 'CONTROL', 'COUNTER', 'Control events sent', 'count', true),
  'control.errors.sent': metric('control.errors.sent', 'CONTROL', 'COUNTER', 'Control errors sent', 'count', true),
  'contract.reject.code': metric('contract.reject.code', 'CONTRACT', 'COUNTER', 'Rejected contract codes', 'count', false),
  'contract.warning.code': metric('contract.warning.code', 'CONTRACT', 'COUNTER', 'Warning contract codes', 'count', false),
  'contract.validation.latency_ms': metric('contract.validation.latency_ms', 'CONTRACT', 'HISTOGRAM', 'Contract validation latency', 'ms', false),
  'health.transport.score': metric('health.transport.score', 'HEALTH', 'GAUGE', 'Transport health score', 'score', true),
  'health.replay.score': metric('health.replay.score', 'HEALTH', 'GAUGE', 'Replay health score', 'score', true),
  'health.fanout.score': metric('health.fanout.score', 'HEALTH', 'GAUGE', 'Fanout health score', 'score', true),
  'latency.backend.roundtrip_ms': metric('latency.backend.roundtrip_ms', 'LATENCY', 'HISTOGRAM', 'Backend roundtrip latency', 'ms', false),
  'latency.gateway.handle_ms': metric('latency.gateway.handle_ms', 'LATENCY', 'HISTOGRAM', 'Gateway handling latency', 'ms', false),
  'latency.fanout.emit_ms': metric('latency.fanout.emit_ms', 'LATENCY', 'HISTOGRAM', 'Fanout emit latency', 'ms', false),
  'latency.replay.fetch_ms': metric('latency.replay.fetch_ms', 'LATENCY', 'HISTOGRAM', 'Replay fetch latency', 'ms', false),
};

function metric(
  name: ChatMetricName,
  domain: ChatMetricDomain,
  kind: ChatMetricKind,
  description: string,
  unit: ChatMetricDefinition['unit'],
  fanoutEligible: boolean,
): ChatMetricDefinition {
  return { name, domain, kind, description, unit, fanoutEligible };
}

/**
 * --------------------------------------------------------------------------
 * Configuration
 * --------------------------------------------------------------------------
 */

export interface ChatMetricsConfig {
  readonly serviceInstanceId: string;
  readonly bucketBoundariesMs: readonly number[];
  readonly bucketBoundariesCount: readonly number[];
  readonly bucketBoundariesBytes: readonly number[];
  readonly rateWindowsMs: readonly number[];
  readonly publishToFanout: boolean;
  readonly publishRoomId: string;
  readonly publishChannelId: ChatChannelId;
  readonly publishMinimumIntervalMs: number;
  readonly keepRecentEvents: number;
  readonly healthScoreWindowMs: number;
  readonly emitServerOnly: boolean;
}

export function createDefaultChatMetricsConfig(partial?: Partial<ChatMetricsConfig>): ChatMetricsConfig {
  return {
    serviceInstanceId: partial?.serviceInstanceId ?? `chat-metrics-${randomUUID()}`,
    bucketBoundariesMs: partial?.bucketBoundariesMs ?? [1, 2, 5, 10, 20, 50, 100, 200, 500, 1_000, 2_000, 5_000, 10_000],
    bucketBoundariesCount: partial?.bucketBoundariesCount ?? [1, 2, 5, 10, 20, 50, 100, 250, 500, 1_000, 2_000, 5_000],
    bucketBoundariesBytes: partial?.bucketBoundariesBytes ?? [128, 256, 512, 1_024, 2_048, 4_096, 8_192, 16_384, 32_768, 65_536, 131_072],
    rateWindowsMs: partial?.rateWindowsMs ?? [10_000, 60_000, 300_000],
    publishToFanout: partial?.publishToFanout ?? false,
    publishRoomId: partial?.publishRoomId ?? '__server__',
    publishChannelId: partial?.publishChannelId ?? 'SYSTEM_SHADOW',
    publishMinimumIntervalMs: partial?.publishMinimumIntervalMs ?? 5_000,
    keepRecentEvents: partial?.keepRecentEvents ?? 1_000,
    healthScoreWindowMs: partial?.healthScoreWindowMs ?? 60_000,
    emitServerOnly: partial?.emitServerOnly ?? true,
  };
}

/**
 * --------------------------------------------------------------------------
 * Metric storage primitives
 * --------------------------------------------------------------------------
 */

interface ChatMetricPoint {
  readonly metricName: ChatMetricName;
  readonly definition: ChatMetricDefinition;
  readonly value: number;
  readonly timestampMs: number;
  readonly dimensions: ChatMetricDimensions;
  readonly metricKey: string;
}

interface ChatCounterValue {
  value: number;
  updatedAtMs: number;
}

interface ChatGaugeValue {
  value: number;
  updatedAtMs: number;
}

interface ChatHistogramBucket {
  readonly upperBound: number;
  count: number;
}

interface ChatHistogramValue {
  count: number;
  sum: number;
  min: number;
  max: number;
  buckets: ChatHistogramBucket[];
  updatedAtMs: number;
}

interface ChatRateWindow {
  readonly windowMs: number;
  readonly events: { timestampMs: number; value: number }[];
}

interface ChatStateValue {
  value: number;
  text?: string;
  updatedAtMs: number;
}

interface ChatSessionHealthState {
  readonly sessionId: string;
  connected: boolean;
  reconnecting: boolean;
  roomId?: string;
  lastSeenAtMs: number;
  heartbeatLatencyMs?: number;
}

interface ChatRoomHealthState {
  readonly roomId: string;
  population: number;
  lastJoinAtMs?: number;
  lastLeaveAtMs?: number;
}

interface ChatReplayRequestState {
  readonly requestId: string;
  readonly roomId: string;
  readonly hydrationMode?: string;
  readonly startedAtMs: number;
  completedAtMs?: number;
  chunkCount: number;
  failed: boolean;
  cacheHit: boolean;
}

export interface ChatMetricsSnapshot {
  readonly generatedAtMs: number;
  readonly counters: Record<string, number>;
  readonly gauges: Record<string, number>;
  readonly histograms: Record<string, {
    readonly count: number;
    readonly sum: number;
    readonly min: number;
    readonly max: number;
    readonly buckets: readonly { readonly upperBound: number; readonly count: number }[];
  }>;
  readonly rates: Record<string, Record<string, number>>;
  readonly states: Record<string, { readonly value: number; readonly text?: string }>;
  readonly health: {
    readonly transportScore: number;
    readonly replayScore: number;
    readonly fanoutScore: number;
  };
  readonly sessions: {
    readonly connected: number;
    readonly reconnecting: number;
    readonly active: number;
  };
  readonly rooms: {
    readonly active: number;
    readonly populations: Record<string, number>;
  };
}

export interface ChatMetricsPublishResult {
  readonly publishedAtMs: number;
  readonly envelopeCount: number;
  readonly emittedCount: number;
  readonly failedCount: number;
}

/**
 * --------------------------------------------------------------------------
 * Service
 * --------------------------------------------------------------------------
 */

export class ChatMetricsService {
  private readonly config: ChatMetricsConfig;
  private readonly fanoutService?: ChatFanoutService;
  private authoritativeSequence = 0;

  private readonly counters = new Map<string, ChatCounterValue>();
  private readonly gauges = new Map<string, ChatGaugeValue>();
  private readonly histograms = new Map<string, ChatHistogramValue>();
  private readonly states = new Map<string, ChatStateValue>();
  private readonly rateWindows = new Map<string, ChatRateWindow[]>();
  private readonly recentPoints: ChatMetricPoint[] = [];

  private readonly sessions = new Map<string, ChatSessionHealthState>();
  private readonly rooms = new Map<string, ChatRoomHealthState>();
  private readonly replayRequests = new Map<string, ChatReplayRequestState>();

  private preparedFanoutCount = 0;
  private emittedFanoutCount = 0;
  private failedFanoutCount = 0;
  private lastPublishAtMs = 0;

  public constructor(input?: { config?: Partial<ChatMetricsConfig>; fanoutService?: ChatFanoutService }) {
    this.config = createDefaultChatMetricsConfig(input?.config);
    this.fanoutService = input?.fanoutService;
  }

  /**
   * ------------------------------------------------------------------------
   * General recording entry points
   * ------------------------------------------------------------------------
   */

  public increment(metricName: ChatMetricName, value = 1, dimensions?: ChatMetricDimensions): void {
    this.record(metricName, value, dimensions);
  }

  public gauge(metricName: ChatMetricName, value: number, dimensions?: ChatMetricDimensions): void {
    this.record(metricName, value, dimensions);
  }

  public histogram(metricName: ChatMetricName, value: number, dimensions?: ChatMetricDimensions): void {
    this.record(metricName, value, dimensions);
  }

  public record(metricName: ChatMetricName, value: number, dimensions?: ChatMetricDimensions): void {
    const definition = CHAT_METRIC_DEFINITIONS[metricName];
    const now = Date.now();
    const point = this.createPoint(metricName, definition, value, now, dimensions);

    switch (definition.kind) {
      case 'COUNTER':
        this.applyCounter(point);
        this.applyRate(point);
        break;
      case 'GAUGE':
        this.applyGauge(point);
        break;
      case 'HISTOGRAM':
        this.applyHistogram(point);
        break;
      case 'RATE':
        this.applyGauge(point);
        break;
      case 'STATE':
        this.applyState(point);
        break;
      default:
        break;
    }

    this.pushRecentPoint(point);
  }

  /**
   * ------------------------------------------------------------------------
   * Connection / session metrics
   * ------------------------------------------------------------------------
   */

  public recordConnectionOpen(sessionId: string, tags?: Record<string, string | number | boolean>): void {
    const now = Date.now();
    this.sessions.set(sessionId, {
      sessionId,
      connected: true,
      reconnecting: false,
      lastSeenAtMs: now,
    });
    this.increment('transport.connections.open', 1, { sessionId, tags });
    this.recomputeSessionGauges();
    this.recomputeHealthScores();
  }

  public recordConnectionClose(sessionId: string, tags?: Record<string, string | number | boolean>): void {
    const now = Date.now();
    const existing = this.sessions.get(sessionId);
    this.sessions.set(sessionId, {
      sessionId,
      connected: false,
      reconnecting: false,
      roomId: existing?.roomId,
      lastSeenAtMs: now,
      heartbeatLatencyMs: existing?.heartbeatLatencyMs,
    });
    this.increment('transport.connections.close', 1, { sessionId, tags });
    this.recomputeSessionGauges();
    this.recomputeHealthScores();
  }

  public recordHeartbeatAccepted(sessionId: string, latencyMs: number, roomId?: string): void {
    const session = this.ensureSession(sessionId);
    session.lastSeenAtMs = Date.now();
    session.heartbeatLatencyMs = latencyMs;
    if (roomId) {
      session.roomId = roomId;
    }
    this.increment('transport.heartbeat.accepted', 1, { sessionId, roomId });
    this.histogram('transport.heartbeat.latency_ms', latencyMs, { sessionId, roomId });
    this.recomputeHealthScores();
  }

  public recordHeartbeatMissed(sessionId: string, roomId?: string): void {
    const session = this.ensureSession(sessionId);
    session.reconnecting = true;
    session.lastSeenAtMs = Date.now();
    if (roomId) {
      session.roomId = roomId;
    }
    this.increment('transport.heartbeat.missed', 1, { sessionId, roomId, disposition: 'MISSED' });
    this.recomputeSessionGauges();
    this.recomputeHealthScores();
  }

  public recordSessionBind(accepted: boolean, sessionId?: string, roomId?: string): void {
    this.increment(accepted ? 'session.bind.accepted' : 'session.bind.rejected', 1, { sessionId, roomId, disposition: accepted ? 'ACCEPTED' : 'REJECTED' });
  }

  public recordSessionResume(accepted: boolean, sessionId?: string, roomId?: string): void {
    this.increment(accepted ? 'session.resume.accepted' : 'session.resume.rejected', 1, { sessionId, roomId, disposition: accepted ? 'ACCEPTED' : 'REJECTED' });
  }

  public recordRoomJoin(sessionId: string, roomId: string): void {
    const session = this.ensureSession(sessionId);
    session.roomId = roomId;
    session.connected = true;
    session.reconnecting = false;
    session.lastSeenAtMs = Date.now();
    const room = this.ensureRoom(roomId);
    room.population += 1;
    room.lastJoinAtMs = Date.now();
    this.increment('room.join.accepted', 1, { sessionId, roomId });
    this.recomputeRoomGauges();
    this.recomputeSessionGauges();
    this.recomputeHealthScores();
  }

  public recordRoomLeave(sessionId: string, roomId: string): void {
    const session = this.ensureSession(sessionId);
    if (session.roomId === roomId) {
      session.roomId = undefined;
    }
    session.lastSeenAtMs = Date.now();
    const room = this.ensureRoom(roomId);
    room.population = Math.max(0, room.population - 1);
    room.lastLeaveAtMs = Date.now();
    this.increment('room.leave.accepted', 1, { sessionId, roomId });
    this.recomputeRoomGauges();
    this.recomputeSessionGauges();
    this.recomputeHealthScores();
  }

  /**
   * ------------------------------------------------------------------------
   * Payload / contract metrics
   * ------------------------------------------------------------------------
   */

  public recordInboundPayloadBytes(bytes: number, eventName?: string, roomId?: string, channelId?: ChatChannelId): void {
    this.increment('transport.payload.bytes.in', bytes, { eventName, roomId, channelId });
  }

  public recordOutboundPayloadBytes(bytes: number, eventName?: string, roomId?: string, channelId?: ChatChannelId): void {
    this.increment('transport.payload.bytes.out', bytes, { eventName, roomId, channelId });
    this.increment('outbound.bytes.total', bytes, { eventName, roomId, channelId });
  }

  public recordValidationSummary(summary: ChatSocketValidationSummary, validationLatencyMs?: number): void {
    switch (summary.disposition) {
      case 'ACCEPTED':
        this.increment('inbound.frames.accepted', 1, {
          roomId: summary.roomId,
          channelId: summary.channelId,
          eventName: summary.event,
          disposition: summary.disposition,
        });
        break;
      case 'ACCEPTED_WITH_WARNINGS':
        this.increment('inbound.frames.accepted_with_warnings', 1, {
          roomId: summary.roomId,
          channelId: summary.channelId,
          eventName: summary.event,
          disposition: summary.disposition,
        });
        this.increment('inbound.warnings.count', summary.warningCount, {
          roomId: summary.roomId,
          channelId: summary.channelId,
          eventName: summary.event,
          disposition: summary.disposition,
        });
        break;
      case 'REJECTED':
        this.increment('inbound.frames.rejected', 1, {
          roomId: summary.roomId,
          channelId: summary.channelId,
          eventName: summary.event,
          disposition: summary.disposition,
        });
        this.increment('inbound.errors.count', summary.errorCount, {
          roomId: summary.roomId,
          channelId: summary.channelId,
          eventName: summary.event,
          disposition: summary.disposition,
        });
        break;
      default:
        break;
    }
    if (validationLatencyMs !== undefined) {
      this.histogram('contract.validation.latency_ms', validationLatencyMs, {
        roomId: summary.roomId,
        channelId: summary.channelId,
        eventName: summary.event,
        disposition: summary.disposition,
      });
    }
  }

  public recordContractReject(code: ChatSocketErrorCode, eventName?: string, roomId?: string, channelId?: ChatChannelId): void {
    this.increment('contract.reject.code', 1, { errorCode: code, eventName, roomId, channelId });
  }

  public recordContractWarning(code: ChatSocketWarningCode, eventName?: string, roomId?: string, channelId?: ChatChannelId): void {
    this.increment('contract.warning.code', 1, { warningCode: code, eventName, roomId, channelId });
  }

  /**
   * ------------------------------------------------------------------------
   * Intent metrics
   * ------------------------------------------------------------------------
   */

  public recordMessageIntent(accepted: boolean, input: {
    roomId: string;
    channelId: ChatChannelId;
    previewOnly?: boolean;
    sourceTick?: number;
    sourcePressure?: number;
  }): void {
    this.increment(accepted ? 'message.intent.accepted' : 'message.intent.rejected', 1, {
      roomId: input.roomId,
      channelId: input.channelId,
      disposition: accepted ? 'ACCEPTED' : 'REJECTED',
      tags: {
        previewOnly: Boolean(input.previewOnly),
        sourceTick: input.sourceTick ?? -1,
        sourcePressure: input.sourcePressure ?? -1,
      },
    });
    if (accepted) {
      this.increment('channel.messages.sent', 1, { roomId: input.roomId, channelId: input.channelId });
      if (input.previewOnly) {
        this.increment('channel.messages.preview_only', 1, { roomId: input.roomId, channelId: input.channelId });
      }
    }
  }

  public recordPresenceIntent(accepted: boolean, roomId: string, channelId?: ChatChannelId): void {
    this.increment(accepted ? 'presence.intent.accepted' : 'presence.intent.rejected', 1, {
      roomId,
      channelId,
      disposition: accepted ? 'ACCEPTED' : 'REJECTED',
    });
    if (accepted) {
      this.increment('channel.presence.updates', 1, { roomId, channelId });
    }
  }

  public recordTypingIntent(accepted: boolean, roomId: string, channelId: ChatChannelId, typing: boolean): void {
    this.increment(accepted ? 'typing.intent.accepted' : 'typing.intent.rejected', 1, {
      roomId,
      channelId,
      disposition: accepted ? 'ACCEPTED' : 'REJECTED',
      tags: { typing },
    });
    if (accepted) {
      this.increment(typing ? 'channel.typing.starts' : 'channel.typing.stops', 1, { roomId, channelId });
    }
  }

  public recordCursorIntent(accepted: boolean, roomId: string, channelId: ChatChannelId, cleared: boolean): void {
    this.increment(accepted ? 'cursor.intent.accepted' : 'cursor.intent.rejected', 1, {
      roomId,
      channelId,
      disposition: accepted ? 'ACCEPTED' : 'REJECTED',
      tags: { cleared },
    });
    if (accepted) {
      this.increment(cleared ? 'channel.cursor.clears' : 'channel.cursor.updates', 1, { roomId, channelId });
    }
  }

  /**
   * ------------------------------------------------------------------------
   * Replay metrics
   * ------------------------------------------------------------------------
   */

  public recordReplayRequest(input: {
    requestId: string;
    roomId: string;
    hydrationMode?: string;
    accepted: boolean;
    cacheHit?: boolean;
    inflightJoin?: boolean;
    excerptKind?: string;
  }): void {
    const now = Date.now();
    this.replayRequests.set(input.requestId, {
      requestId: input.requestId,
      roomId: input.roomId,
      hydrationMode: input.hydrationMode,
      startedAtMs: now,
      chunkCount: 0,
      failed: !input.accepted,
      cacheHit: Boolean(input.cacheHit),
    });
    this.increment(input.accepted ? 'replay.requests.accepted' : 'replay.requests.rejected', 1, {
      roomId: input.roomId,
      hydrationMode: input.hydrationMode,
      excerptKind: input.excerptKind,
      disposition: input.accepted ? 'ACCEPTED' : 'REJECTED',
    });
    if (input.cacheHit) {
      this.increment('replay.requests.cache_hit', 1, { roomId: input.roomId, hydrationMode: input.hydrationMode });
    } else {
      this.increment('replay.requests.cache_miss', 1, { roomId: input.roomId, hydrationMode: input.hydrationMode });
    }
    if (input.inflightJoin) {
      this.increment('replay.requests.inflight_join', 1, { roomId: input.roomId, hydrationMode: input.hydrationMode });
    }
    this.recomputeHealthScores();
  }

  public recordReplayTimeout(requestId: string, roomId?: string, hydrationMode?: string): void {
    const replay = this.replayRequests.get(requestId);
    if (replay) {
      replay.failed = true;
      replay.completedAtMs = Date.now();
    }
    this.increment('replay.requests.timeout', 1, { roomId: roomId ?? replay?.roomId, hydrationMode: hydrationMode ?? replay?.hydrationMode });
    this.recomputeHealthScores();
  }

  public recordReplayFailure(requestId: string, roomId?: string, hydrationMode?: string): void {
    const replay = this.replayRequests.get(requestId);
    if (replay) {
      replay.failed = true;
      replay.completedAtMs = Date.now();
    }
    this.increment('replay.requests.failed', 1, { roomId: roomId ?? replay?.roomId, hydrationMode: hydrationMode ?? replay?.hydrationMode });
    this.recomputeHealthScores();
  }

  public recordReplayChunk(input: {
    requestId: string;
    roomId: string;
    hydrationMode?: string;
    bytes?: number;
    chunkIndex?: number;
    totalChunks?: number;
  }): void {
    const replay = this.replayRequests.get(input.requestId) ?? {
      requestId: input.requestId,
      roomId: input.roomId,
      hydrationMode: input.hydrationMode,
      startedAtMs: Date.now(),
      chunkCount: 0,
      failed: false,
      cacheHit: false,
    };
    replay.chunkCount += 1;
    this.replayRequests.set(input.requestId, replay);
    this.increment('replay.chunks.sent', 1, {
      roomId: input.roomId,
      hydrationMode: input.hydrationMode,
      tags: {
        chunkIndex: input.chunkIndex ?? -1,
        totalChunks: input.totalChunks ?? -1,
      },
    });
    if (input.bytes !== undefined) {
      this.increment('replay.chunks.bytes', input.bytes, { roomId: input.roomId, hydrationMode: input.hydrationMode });
    }
  }

  public recordReplayCompletion(requestId: string, roomId?: string, hydrationMode?: string): void {
    const replay = this.replayRequests.get(requestId);
    const now = Date.now();
    if (replay) {
      replay.completedAtMs = now;
      const durationMs = now - replay.startedAtMs;
      this.histogram('replay.duration_ms', durationMs, { roomId: replay.roomId, hydrationMode: replay.hydrationMode });
      this.increment('replay.completions', 1, { roomId: replay.roomId, hydrationMode: replay.hydrationMode });
    } else {
      this.increment('replay.completions', 1, { roomId, hydrationMode });
    }
    this.recomputeHealthScores();
  }

  public recordReplayFetchLatency(latencyMs: number, roomId?: string, hydrationMode?: string): void {
    this.histogram('latency.replay.fetch_ms', latencyMs, { roomId, hydrationMode });
  }

  /**
   * ------------------------------------------------------------------------
   * Fanout metrics
   * ------------------------------------------------------------------------
   */

  public recordPreparedEmission(prepared: ChatPreparedEmission): void {
    this.preparedFanoutCount += 1;
    this.increment('fanout.prepared', 1, {
      roomId: prepared.roomId,
      channelId: prepared.channelId,
      audienceKind: prepared.audienceKind,
      eventName: prepared.eventName,
      disposition: prepared.status,
      tags: {
        recipientCount: prepared.recipients.length,
      },
    });
    this.histogram('fanout.prepared.recipients', prepared.recipients.length, {
      roomId: prepared.roomId,
      channelId: prepared.channelId,
      audienceKind: prepared.audienceKind,
      eventName: prepared.eventName,
    });
    this.increment('outbound.frames.enqueued', 1, {
      roomId: prepared.roomId,
      channelId: prepared.channelId,
      audienceKind: prepared.audienceKind,
      eventName: prepared.eventName,
    });
    this.applyOutboxStatus(prepared.status, prepared.roomId, prepared.channelId, prepared.eventName);
    this.recomputeHealthScores();
  }

  public recordEmissionResult(result: ChatEmissionResult): void {
    switch (result.status) {
      case 'EMITTED':
      case 'ACKED':
        this.emittedFanoutCount += 1;
        this.increment('fanout.emitted', 1, {
          roomId: result.roomId,
          channelId: result.channelId,
          audienceKind: result.audienceKind,
          eventName: result.eventName,
          disposition: result.status,
        });
        this.increment('outbound.frames.emitted', 1, {
          roomId: result.roomId,
          channelId: result.channelId,
          audienceKind: result.audienceKind,
          eventName: result.eventName,
          disposition: result.status,
        });
        break;
      case 'PARTIAL':
        this.failedFanoutCount += 1;
        this.increment('fanout.partial', 1, {
          roomId: result.roomId,
          channelId: result.channelId,
          audienceKind: result.audienceKind,
          eventName: result.eventName,
          disposition: result.status,
        });
        this.increment('outbound.frames.partial', 1, {
          roomId: result.roomId,
          channelId: result.channelId,
          audienceKind: result.audienceKind,
          eventName: result.eventName,
          disposition: result.status,
        });
        break;
      case 'FAILED':
      case 'DROPPED':
      case 'EXPIRED':
        this.failedFanoutCount += 1;
        this.increment('fanout.failed', 1, {
          roomId: result.roomId,
          channelId: result.channelId,
          audienceKind: result.audienceKind,
          eventName: result.eventName,
          disposition: result.status,
        });
        this.increment('outbound.frames.failed', 1, {
          roomId: result.roomId,
          channelId: result.channelId,
          audienceKind: result.audienceKind,
          eventName: result.eventName,
          disposition: result.status,
        });
        break;
      default:
        break;
    }
    this.applyOutboxStatus(result.status, result.roomId, result.channelId, result.eventName);
    this.recomputeDeliveryRatio();
    this.recomputeHealthScores();
  }

  public recordFanoutEmitLatency(latencyMs: number, roomId?: string, channelId?: ChatChannelId, eventName?: string): void {
    this.histogram('latency.fanout.emit_ms', latencyMs, { roomId, channelId, eventName });
  }

  private applyOutboxStatus(status: ChatOutboxStatus, roomId?: string, channelId?: ChatChannelId, eventName?: string): void {
    switch (status) {
      case 'QUEUED':
        this.increment('fanout.outbox.queued', 1, { roomId, channelId, eventName, disposition: status });
        break;
      case 'ACKED':
        this.increment('fanout.outbox.acked', 1, { roomId, channelId, eventName, disposition: status });
        break;
      case 'FAILED':
        this.increment('fanout.outbox.failed', 1, { roomId, channelId, eventName, disposition: status });
        break;
      case 'DROPPED':
        this.increment('fanout.outbox.dropped', 1, { roomId, channelId, eventName, disposition: status });
        break;
      default:
        break;
    }
  }

  /**
   * ------------------------------------------------------------------------
   * Control / latency metrics
   * ------------------------------------------------------------------------
   */

  public recordControlEvent(eventName: ChatFanoutEventName | 'chat:error', roomId?: string, channelId?: ChatChannelId): void {
    this.increment(eventName === 'chat:error' ? 'control.errors.sent' : 'control.events.sent', 1, { roomId, channelId, eventName });
  }

  public recordGatewayHandleLatency(latencyMs: number, eventName?: string, roomId?: string, channelId?: ChatChannelId): void {
    this.histogram('latency.gateway.handle_ms', latencyMs, { eventName, roomId, channelId });
  }

  public recordBackendRoundtripLatency(latencyMs: number, eventName?: string, roomId?: string, channelId?: ChatChannelId): void {
    this.histogram('latency.backend.roundtrip_ms', latencyMs, { eventName, roomId, channelId });
  }

  /**
   * ------------------------------------------------------------------------
   * Publishing / export
   * ------------------------------------------------------------------------
   */

  public createSnapshot(): ChatMetricsSnapshot {
    const counters = toNumericObject(this.counters);
    const gauges = toNumericObject(this.gauges);
    const histograms = toHistogramObject(this.histograms);
    const rates = this.computeRateObject();
    const states = toStateObject(this.states);
    const health = {
      transportScore: this.computeTransportHealthScore(),
      replayScore: this.computeReplayHealthScore(),
      fanoutScore: this.computeFanoutHealthScore(),
    };
    const connected = [...this.sessions.values()].filter((session) => session.connected).length;
    const reconnecting = [...this.sessions.values()].filter((session) => session.reconnecting).length;
    const active = [...this.sessions.values()].filter((session) => session.connected || session.reconnecting).length;
    const populations: Record<string, number> = {};
    for (const room of this.rooms.values()) {
      populations[room.roomId] = room.population;
    }
    return {
      generatedAtMs: Date.now(),
      counters,
      gauges,
      histograms,
      rates,
      states,
      health,
      sessions: {
        connected,
        reconnecting,
        active,
      },
      rooms: {
        active: this.rooms.size,
        populations,
      },
    };
  }

  public async maybePublishMetrics(): Promise<ChatMetricsPublishResult | undefined> {
    if (!this.config.publishToFanout || !this.fanoutService) {
      return undefined;
    }
    const now = Date.now();
    if (now - this.lastPublishAtMs < this.config.publishMinimumIntervalMs) {
      return undefined;
    }

    const snapshot = this.createSnapshot();
    const payloads = this.selectPublishableMetrics(snapshot);
    if (payloads.length === 0) {
      this.lastPublishAtMs = now;
      return {
        publishedAtMs: now,
        envelopeCount: 0,
        emittedCount: 0,
        failedCount: 0,
      };
    }

    const results: ChatEmissionResult[] = [];
    for (const payload of payloads) {
      const envelope = this.buildMetricEnvelope(payload);
      const prepared = this.fanoutService.prepareEnvelope(envelope, {
        eventName: 'chat:metrics',
        audienceKind: 'SHADOW_INTERNAL',
        deliverySemantics: 'NO_RETRY',
      });
      this.recordPreparedEmission(prepared);
      const emissionResult = await this.fanoutService.emitPrepared(prepared);
      this.recordEmissionResult(emissionResult);
      results.push(emissionResult);
    }

    this.lastPublishAtMs = now;
    return {
      publishedAtMs: now,
      envelopeCount: payloads.length,
      emittedCount: results.filter((result) => result.status === 'EMITTED' || result.status === 'ACKED').length,
      failedCount: results.filter((result) => result.status === 'FAILED' || result.status === 'PARTIAL' || result.status === 'DROPPED').length,
    };
  }

  public exportRecentEvents(limit = 100): readonly ChatMetricPoint[] {
    return this.recentPoints.slice(Math.max(0, this.recentPoints.length - limit));
  }

  /**
   * ------------------------------------------------------------------------
   * Internal primitives
   * ------------------------------------------------------------------------
   */

  private createPoint(
    metricName: ChatMetricName,
    definition: ChatMetricDefinition,
    value: number,
    timestampMs: number,
    dimensions?: ChatMetricDimensions,
  ): ChatMetricPoint {
    const metricKey = this.makeMetricKey(metricName, dimensions);
    return {
      metricName,
      definition,
      value,
      timestampMs,
      dimensions: dimensions ?? {},
      metricKey,
    };
  }

  private makeMetricKey(metricName: ChatMetricName, dimensions?: ChatMetricDimensions): string {
    const normalized: Record<string, unknown> = {
      roomId: dimensions?.roomId,
      channelId: dimensions?.channelId,
      audienceKind: dimensions?.audienceKind,
      sessionId: dimensions?.sessionId,
      playerId: dimensions?.playerId,
      eventName: dimensions?.eventName,
      subtype: dimensions?.subtype,
      hydrationMode: dimensions?.hydrationMode,
      excerptKind: dimensions?.excerptKind,
      status: dimensions?.status,
      disposition: dimensions?.disposition,
      errorCode: dimensions?.errorCode,
      warningCode: dimensions?.warningCode,
      source: dimensions?.source,
      tags: dimensions?.tags,
    };
    const signature = JSON.stringify(normalized);
    const hash = createHash('sha1').update(signature).digest('hex');
    return `${metricName}::${hash}`;
  }

  private applyCounter(point: ChatMetricPoint): void {
    const existing = this.counters.get(point.metricKey);
    if (!existing) {
      this.counters.set(point.metricKey, { value: point.value, updatedAtMs: point.timestampMs });
      return;
    }
    existing.value += point.value;
    existing.updatedAtMs = point.timestampMs;
  }

  private applyGauge(point: ChatMetricPoint): void {
    this.gauges.set(point.metricKey, { value: point.value, updatedAtMs: point.timestampMs });
  }

  private applyState(point: ChatMetricPoint): void {
    this.states.set(point.metricKey, { value: point.value, updatedAtMs: point.timestampMs });
  }

  private applyHistogram(point: ChatMetricPoint): void {
    const existing = this.histograms.get(point.metricKey) ?? this.createHistogramValue(point.definition, point.timestampMs);
    existing.count += 1;
    existing.sum += point.value;
    existing.min = Math.min(existing.min, point.value);
    existing.max = Math.max(existing.max, point.value);
    existing.updatedAtMs = point.timestampMs;
    const bucket = existing.buckets.find((candidate) => point.value <= candidate.upperBound) ?? existing.buckets[existing.buckets.length - 1];
    bucket.count += 1;
    this.histograms.set(point.metricKey, existing);
  }

  private applyRate(point: ChatMetricPoint): void {
    const windows = this.rateWindows.get(point.metricKey) ?? this.config.rateWindowsMs.map((windowMs) => ({ windowMs, events: [] }));
    for (const window of windows) {
      window.events.push({ timestampMs: point.timestampMs, value: point.value });
      pruneWindow(window, point.timestampMs);
    }
    this.rateWindows.set(point.metricKey, windows);
  }

  private createHistogramValue(definition: ChatMetricDefinition, updatedAtMs: number): ChatHistogramValue {
    const boundaries = (() => {
      switch (definition.unit) {
        case 'ms':
          return this.config.bucketBoundariesMs;
        case 'bytes':
          return this.config.bucketBoundariesBytes;
        default:
          return this.config.bucketBoundariesCount;
      }
    })();
    return {
      count: 0,
      sum: 0,
      min: Number.POSITIVE_INFINITY,
      max: Number.NEGATIVE_INFINITY,
      buckets: [...boundaries, Number.POSITIVE_INFINITY].map((upperBound) => ({ upperBound, count: 0 })),
      updatedAtMs,
    };
  }

  private pushRecentPoint(point: ChatMetricPoint): void {
    this.recentPoints.push(point);
    if (this.recentPoints.length > this.config.keepRecentEvents) {
      this.recentPoints.splice(0, this.recentPoints.length - this.config.keepRecentEvents);
    }
  }

  private ensureSession(sessionId: string): ChatSessionHealthState {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      return existing;
    }
    const created: ChatSessionHealthState = {
      sessionId,
      connected: false,
      reconnecting: false,
      lastSeenAtMs: Date.now(),
    };
    this.sessions.set(sessionId, created);
    return created;
  }

  private ensureRoom(roomId: string): ChatRoomHealthState {
    const existing = this.rooms.get(roomId);
    if (existing) {
      return existing;
    }
    const created: ChatRoomHealthState = {
      roomId,
      population: 0,
    };
    this.rooms.set(roomId, created);
    return created;
  }

  private recomputeSessionGauges(): void {
    const connected = [...this.sessions.values()].filter((session) => session.connected).length;
    const reconnecting = [...this.sessions.values()].filter((session) => session.reconnecting).length;
    const active = [...this.sessions.values()].filter((session) => session.connected || session.reconnecting).length;
    this.gauge('session.connected.gauge', connected);
    this.gauge('session.reconnecting.gauge', reconnecting);
    this.gauge('session.active.gauge', active);
  }

  private recomputeRoomGauges(): void {
    this.gauge('room.active.gauge', this.rooms.size);
    for (const room of this.rooms.values()) {
      this.gauge('room.population.gauge', room.population, { roomId: room.roomId });
    }
  }

  private recomputeDeliveryRatio(): void {
    const ratio = this.preparedFanoutCount === 0 ? 1 : this.emittedFanoutCount / this.preparedFanoutCount;
    this.gauge('fanout.delivery_ratio', ratio);
  }

  private recomputeHealthScores(): void {
    this.gauge('health.transport.score', this.computeTransportHealthScore());
    this.gauge('health.replay.score', this.computeReplayHealthScore());
    this.gauge('health.fanout.score', this.computeFanoutHealthScore());
  }

  private computeTransportHealthScore(): number {
    const connected = [...this.sessions.values()].filter((session) => session.connected).length;
    const reconnecting = [...this.sessions.values()].filter((session) => session.reconnecting).length;
    const recentMisses = this.sumRecentCounter('transport.heartbeat.missed', this.config.healthScoreWindowMs);
    const ratioPenalty = reconnecting * 8 + recentMisses * 2;
    return clampScore(100 - ratioPenalty + Math.min(connected, 20));
  }

  private computeReplayHealthScore(): number {
    const recentTimeouts = this.sumRecentCounter('replay.requests.timeout', this.config.healthScoreWindowMs);
    const recentFailures = this.sumRecentCounter('replay.requests.failed', this.config.healthScoreWindowMs);
    const recentAccepted = this.sumRecentCounter('replay.requests.accepted', this.config.healthScoreWindowMs);
    const completionRate = recentAccepted === 0 ? 1 : this.sumRecentCounter('replay.completions', this.config.healthScoreWindowMs) / recentAccepted;
    return clampScore(100 - recentTimeouts * 10 - recentFailures * 8 + completionRate * 15);
  }

  private computeFanoutHealthScore(): number {
    const prepared = Math.max(1, this.preparedFanoutCount);
    const failed = this.failedFanoutCount;
    const emitted = this.emittedFanoutCount;
    const successRatio = emitted / prepared;
    return clampScore(60 + successRatio * 40 - failed * 2);
  }

  private sumRecentCounter(metricName: ChatMetricName, windowMs: number): number {
    const now = Date.now();
    let total = 0;
    for (const point of this.recentPoints) {
      if (point.metricName !== metricName) {
        continue;
      }
      if (now - point.timestampMs > windowMs) {
        continue;
      }
      total += point.value;
    }
    return total;
  }

  private computeRateObject(): Record<string, Record<string, number>> {
    const result: Record<string, Record<string, number>> = {};
    const now = Date.now();
    for (const [metricKey, windows] of this.rateWindows.entries()) {
      const perWindow: Record<string, number> = {};
      for (const window of windows) {
        pruneWindow(window, now);
        const total = window.events.reduce((sum, event) => sum + event.value, 0);
        perWindow[`${window.windowMs}ms`] = total / Math.max(1, window.windowMs / 1_000);
      }
      result[metricKey] = perWindow;
    }
    return result;
  }

  private selectPublishableMetrics(snapshot: ChatMetricsSnapshot): ChatMetricsFanoutPayload[] {
    const payloads: ChatMetricsFanoutPayload[] = [];
    const healthMetrics: readonly [string, number][] = [
      ['health.transport.score', snapshot.health.transportScore],
      ['health.replay.score', snapshot.health.replayScore],
      ['health.fanout.score', snapshot.health.fanoutScore],
    ];
    for (const [metricName, metricValue] of healthMetrics) {
      payloads.push({
        metricName,
        metricValue,
        dimensionRoomId: this.config.publishRoomId,
        dimensionChannelId: this.config.publishChannelId,
        tags: {
          serviceInstanceId: this.config.serviceInstanceId,
        },
      });
    }
    payloads.push({
      metricName: 'session.connected.gauge',
      metricValue: snapshot.sessions.connected,
      dimensionRoomId: this.config.publishRoomId,
      dimensionChannelId: this.config.publishChannelId,
      tags: { serviceInstanceId: this.config.serviceInstanceId },
    });
    payloads.push({
      metricName: 'room.active.gauge',
      metricValue: snapshot.rooms.active,
      dimensionRoomId: this.config.publishRoomId,
      dimensionChannelId: this.config.publishChannelId,
      tags: { serviceInstanceId: this.config.serviceInstanceId },
    });
    return payloads;
  }

  private buildMetricEnvelope(payload: ChatMetricsFanoutPayload): ChatAuthoritativeEnvelope<ChatMetricsFanoutPayload> {
    this.authoritativeSequence += 1;
    return createChatMetricsEnvelope({
      authoritativeSequence: this.authoritativeSequence,
      roomId: this.config.publishRoomId,
      channelId: this.config.publishChannelId,
      payload,
      visibility: this.config.emitServerOnly ? 'SERVER_ONLY' : 'SHADOW_ONLY',
      meta: {
        serviceInstanceId: this.config.serviceInstanceId,
      },
    });
  }
}

/**
 * --------------------------------------------------------------------------
 * Helpers
 * --------------------------------------------------------------------------
 */

function pruneWindow(window: ChatRateWindow, now: number): void {
  const cutoff = now - window.windowMs;
  while (window.events.length > 0 && window.events[0].timestampMs < cutoff) {
    window.events.shift();
  }
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function toNumericObject<T extends { value: number }>(source: Map<string, T>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, value] of source.entries()) {
    result[key] = Number(value.value.toFixed(6));
  }
  return result;
}

function toStateObject(source: Map<string, ChatStateValue>): Record<string, { readonly value: number; readonly text?: string }> {
  const result: Record<string, { readonly value: number; readonly text?: string }> = {};
  for (const [key, value] of source.entries()) {
    result[key] = { value: Number(value.value.toFixed(6)), text: value.text };
  }
  return result;
}

function toHistogramObject(source: Map<string, ChatHistogramValue>): Record<string, {
  readonly count: number;
  readonly sum: number;
  readonly min: number;
  readonly max: number;
  readonly buckets: readonly { readonly upperBound: number; readonly count: number }[];
}> {
  const result: Record<string, {
    readonly count: number;
    readonly sum: number;
    readonly min: number;
    readonly max: number;
    readonly buckets: readonly { readonly upperBound: number; readonly count: number }[];
  }> = {};
  for (const [key, histogram] of source.entries()) {
    result[key] = {
      count: histogram.count,
      sum: Number(histogram.sum.toFixed(6)),
      min: histogram.count === 0 ? 0 : Number(histogram.min.toFixed(6)),
      max: histogram.count === 0 ? 0 : Number(histogram.max.toFixed(6)),
      buckets: histogram.buckets.map((bucket) => ({ upperBound: bucket.upperBound, count: bucket.count })),
    };
  }
  return result;
}


export function createChatMetricsService(input?: { config?: Partial<ChatMetricsConfig>; fanoutService?: ChatFanoutService }): ChatMetricsService {
  return new ChatMetricsService(input);
}
