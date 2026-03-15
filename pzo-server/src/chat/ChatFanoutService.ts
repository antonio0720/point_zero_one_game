
/**
 * ============================================================================
 * POINT ZERO ONE — SERVER CHAT FANOUT SERVICE
 * FILE: pzo-server/src/chat/ChatFanoutService.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical server-side fanout service for the unified chat transport lane.
 *
 * This service sits inside pzo-server/src/chat and intentionally remains a
 * servant, not a brain:
 * - it does not own transcript truth,
 * - it does not moderate content,
 * - it does not decide whether a message may exist,
 * - it does not simulate NPCs,
 * - it does not mutate backend chat authority.
 *
 * Instead, it owns the transport-critical problem of taking already-authorized
 * backend chat outputs and turning them into deterministic room/session
 * emissions that the gateway can push to sockets without re-deciding truth.
 *
 * Preserved donor truths
 * ---------------------
 * - Existing pzo-server websocket plumbing is still thin and fragmented.
 * - Existing frontend donor lanes already treat socket transport and typing as
 *   first-class engine subsystems rather than UI concerns.
 * - Existing hater behavior already implies room-wide and targeted broadcast
 *   patterns that cannot safely live in generic socket code forever.
 *
 * Design laws
 * -----------
 * - Backend authority decides what happened. Fanout decides who hears about it.
 * - Fanout never rewrites canonical payload meaning.
 * - Fanout may enrich with transport metadata only.
 * - Fanout must be deterministic, idempotent-aware, and batch-safe.
 * - Shadow audiences, room-wide audiences, session-specific audiences,
 *   spectators, helpers, haters, and replay listeners must all remain
 *   representable without letting gateway code become a second engine.
 *
 * Concurrency posture
 * -------------------
 * This file is designed for large-concurrency room fanout:
 * - recipient resolution is set-based,
 * - batching is explicit,
 * - deduplication is explicit,
 * - retry semantics are explicit,
 * - delivery reports are structured,
 * - outbox retention is bounded,
 * - metrics hooks are zero-ownership and optional.
 *
 * Notes
 * -----
 * This file is deliberately self-contained so it can land before every shared
 * contract file is finalized. Where canonical shared/contracts/chat types
 * become available later, these local interfaces can be narrowed or replaced
 * with re-exports.
 * ============================================================================
 */

import { createHash, randomUUID } from 'crypto';

export type ChatChannelId =
  | 'GLOBAL'
  | 'SYNDICATE'
  | 'DEAL_ROOM'
  | 'LOBBY'
  | 'SYSTEM_SHADOW'
  | 'NPC_SHADOW'
  | 'RIVALRY_SHADOW'
  | 'RESCUE_SHADOW'
  | 'LIVEOPS_SHADOW';

export type ChatAudienceKind =
  | 'ROOM_ALL'
  | 'ROOM_MEMBERS'
  | 'ROOM_ACTIVE'
  | 'ROOM_VISIBLE'
  | 'ROOM_SPECTATORS'
  | 'ROOM_NON_SPECTATORS'
  | 'ROOM_HELPERS'
  | 'ROOM_HATERS'
  | 'SESSION_LIST'
  | 'SESSION_SINGLE'
  | 'PLAYER_LIST'
  | 'PLAYER_SINGLE'
  | 'SHADOW_INTERNAL'
  | 'REPLAY_SUBSCRIBERS';

export type ChatDeliverySemantics =
  | 'BEST_EFFORT'
  | 'AT_MOST_ONCE'
  | 'AT_LEAST_ONCE'
  | 'TARGETED_RETRYABLE'
  | 'NO_RETRY';

export type ChatFanoutEventName =
  | 'chat:message'
  | 'chat:message:redacted'
  | 'chat:presence'
  | 'chat:typing'
  | 'chat:cursor'
  | 'chat:replay:chunk'
  | 'chat:replay:complete'
  | 'chat:replay:error'
  | 'chat:control'
  | 'chat:metrics'
  | 'chat:helper'
  | 'chat:hater'
  | 'chat:invasion'
  | 'chat:system'
  | 'chat:delivery:ack';

export type ChatPresenceKind =
  | 'ONLINE'
  | 'AWAY'
  | 'HIDDEN'
  | 'DISCONNECTED'
  | 'RECONNECTING'
  | 'SPECTATING'
  | 'HELPER_PRESENT'
  | 'HATER_PRESENT'
  | 'NPC_PRESENT';

export type ChatFanoutVisibility =
  | 'PUBLIC'
  | 'ROOM_ONLY'
  | 'ROLE_FILTERED'
  | 'TARGET_ONLY'
  | 'SHADOW_ONLY'
  | 'SERVER_ONLY';

export type ChatRecipientRole =
  | 'PLAYER'
  | 'SPECTATOR'
  | 'MODERATOR'
  | 'HELPER'
  | 'HATER'
  | 'NPC'
  | 'SYSTEM';

export type ChatOutboxStatus =
  | 'QUEUED'
  | 'EMITTED'
  | 'PARTIAL'
  | 'ACKED'
  | 'FAILED'
  | 'EXPIRED'
  | 'DROPPED';

export type ChatRecipientSuppressionReason =
  | 'NONE'
  | 'HIDDEN'
  | 'SHADOWED'
  | 'ROLE_BLOCKED'
  | 'CHANNEL_BLOCKED'
  | 'ROOM_MISMATCH'
  | 'SESSION_STALE'
  | 'DISCONNECTED'
  | 'SPECTATOR_FILTERED'
  | 'DUPLICATE'
  | 'EXCLUDED_ORIGIN'
  | 'TARGET_MISMATCH';

export interface ChatAuthoritativeEnvelope<TPayload = unknown> {
  readonly authoritativeEventId: string;
  readonly authoritativeSequence: number;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly sourceKind:
    | 'PLAYER'
    | 'NPC'
    | 'HELPER'
    | 'HATER'
    | 'SYSTEM'
    | 'LIVEOPS'
    | 'REPLAY';
  readonly subtype:
    | 'MESSAGE'
    | 'PRESENCE'
    | 'TYPING'
    | 'CURSOR'
    | 'REPLAY'
    | 'CONTROL'
    | 'METRIC';
  readonly visibility: ChatFanoutVisibility;
  readonly causalityRootId?: string;
  readonly correlationId?: string;
  readonly causalParentIds?: readonly string[];
  readonly backendTimestampMs: number;
  readonly payload: TPayload;
  readonly meta?: Record<string, unknown>;
}

export interface ChatMessageFanoutPayload {
  readonly messageId: string;
  readonly senderSessionId?: string;
  readonly senderPlayerId?: string;
  readonly senderUsername?: string;
  readonly senderRole: ChatRecipientRole;
  readonly body: string;
  readonly renderedBody?: string;
  readonly proofHash?: string;
  readonly moderationState?: 'ALLOWED' | 'MASKED' | 'SHADOWED' | 'REDACTED';
  readonly tags?: readonly string[];
  readonly badges?: readonly string[];
  readonly tick?: number;
  readonly pressure?: number;
  readonly sourcePersonaId?: string;
}

export interface ChatPresenceFanoutPayload {
  readonly sessionId: string;
  readonly playerId?: string;
  readonly username?: string;
  readonly presence: ChatPresenceKind;
  readonly statusText?: string;
  readonly roomPopulation?: number;
  readonly hidden?: boolean;
}

export interface ChatTypingFanoutPayload {
  readonly sessionId: string;
  readonly playerId?: string;
  readonly username?: string;
  readonly typing: boolean;
  readonly startedAtMs?: number;
  readonly expiresAtMs?: number;
  readonly cadenceClass?: 'FAST' | 'STEADY' | 'QUIET' | 'PREDATORY' | 'THEATRICAL';
}

export interface ChatCursorFanoutPayload {
  readonly sessionId: string;
  readonly playerId?: string;
  readonly username?: string;
  readonly composing: boolean;
  readonly caretStart: number;
  readonly caretEnd: number;
  readonly compositionLength: number;
  readonly previewText?: string;
  readonly viewportToken?: string;
  readonly expiresAtMs?: number;
}

export interface ChatReplayFanoutPayload {
  readonly requestId: string;
  readonly replayId?: string;
  readonly chunkIndex: number;
  readonly totalChunks: number;
  readonly isFinalChunk: boolean;
  readonly hydrationMode: 'JOIN' | 'RESUME' | 'AUDIT' | 'MANUAL' | 'POST_RUN' | 'INVASION_REVIEW';
  readonly excerpt: unknown;
  readonly replayCursor?: string;
}

export interface ChatControlFanoutPayload {
  readonly code:
    | 'ROOM_JOINED'
    | 'ROOM_LEFT'
    | 'REPLAY_READY'
    | 'REPLAY_REJECTED'
    | 'BACKEND_TIMEOUT'
    | 'DELIVERY_PARTIAL'
    | 'DELIVERY_FAILED'
    | 'AUDIENCE_CHANGED'
    | 'ROOM_RESET'
    | 'SHADOW_SUPPRESSED';
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

export interface ChatMetricsFanoutPayload {
  readonly metricName: string;
  readonly metricValue: number;
  readonly dimensionRoomId?: string;
  readonly dimensionChannelId?: ChatChannelId;
  readonly dimensionAudienceKind?: ChatAudienceKind;
  readonly tags?: Record<string, string | number | boolean>;
}

export interface ChatSessionSnapshot {
  readonly sessionId: string;
  readonly playerId?: string;
  readonly username?: string;
  readonly roomId?: string;
  readonly socketId?: string;
  readonly role: ChatRecipientRole;
  readonly connected: boolean;
  readonly visible: boolean;
  readonly spectator: boolean;
  readonly helper: boolean;
  readonly hater: boolean;
  readonly npc: boolean;
  readonly mutedChannels: readonly ChatChannelId[];
  readonly hiddenChannels: readonly ChatChannelId[];
  readonly subscribedReplayRooms?: readonly string[];
  readonly lastSeenAtMs?: number;
  readonly attachedAtMs?: number;
}

export interface ChatRoomSnapshot {
  readonly roomId: string;
  readonly memberSessionIds: readonly string[];
  readonly activeSessionIds: readonly string[];
  readonly visibleSessionIds: readonly string[];
  readonly spectatorSessionIds: readonly string[];
  readonly helperSessionIds: readonly string[];
  readonly haterSessionIds: readonly string[];
  readonly replaySubscriberSessionIds: readonly string[];
  readonly metadata?: Record<string, unknown>;
}

export interface ChatSessionRegistryAdapter {
  getSession(sessionId: string): ChatSessionSnapshot | undefined;
  getSessions(sessionIds: readonly string[]): readonly ChatSessionSnapshot[];
  getSessionsByPlayerIds(playerIds: readonly string[]): readonly ChatSessionSnapshot[];
  getSessionsByRoomId(roomId: string): readonly ChatSessionSnapshot[];
}

export interface ChatRoomRegistryAdapter {
  getRoom(roomId: string): ChatRoomSnapshot | undefined;
  getMemberSessionIds(roomId: string): readonly string[];
  getVisibleSessionIds(roomId: string): readonly string[];
  getActiveSessionIds(roomId: string): readonly string[];
  getSpectatorSessionIds(roomId: string): readonly string[];
  getHelperSessionIds(roomId: string): readonly string[];
  getHaterSessionIds(roomId: string): readonly string[];
  getReplaySubscriberSessionIds(roomId: string): readonly string[];
}

export interface ChatSocketEmitterAdapter {
  emitToSocket(socketId: string, eventName: ChatFanoutEventName, payload: unknown): Promise<void> | void;
}

export interface ChatMetricsAdapter {
  increment(metric: string, value?: number, tags?: Record<string, string | number | boolean>): void;
  observe(metric: string, value: number, tags?: Record<string, string | number | boolean>): void;
}

export interface ChatLoggerAdapter {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface ChatFanoutAudience {
  readonly kind: ChatAudienceKind;
  readonly roomId?: string;
  readonly sessionIds?: readonly string[];
  readonly playerIds?: readonly string[];
  readonly includeOriginSession?: boolean;
  readonly originSessionId?: string;
  readonly includeSpectators?: boolean;
  readonly replayRoomId?: string;
  readonly requiredRoles?: readonly ChatRecipientRole[];
  readonly excludedSessionIds?: readonly string[];
}

export interface ChatFanoutPolicy {
  readonly eventName: ChatFanoutEventName;
  readonly semantics: ChatDeliverySemantics;
  readonly audience: ChatFanoutAudience;
  readonly batchSize: number;
  readonly maxRetryCount: number;
  readonly retryBackoffMs: number;
  readonly retainOutboxMs: number;
  readonly allowHiddenDelivery: boolean;
  readonly allowShadowDelivery: boolean;
  readonly dedupeWithinPlan: boolean;
  readonly ackExpected: boolean;
}

export interface ChatPreparedRecipient {
  readonly sessionId: string;
  readonly socketId?: string;
  readonly playerId?: string;
  readonly username?: string;
  readonly role: ChatRecipientRole;
  readonly roomId?: string;
  readonly suppressionReason: ChatRecipientSuppressionReason;
  readonly deliverable: boolean;
}

export interface ChatPreparedEmission {
  readonly planId: string;
  readonly authoritativeEventId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly payload: unknown;
  readonly payloadHash: string;
  readonly policy: ChatFanoutPolicy;
  readonly recipients: readonly ChatPreparedRecipient[];
  readonly preparedAtMs: number;
  readonly transportMeta: Record<string, unknown>;
}

export interface ChatEmissionAttempt {
  readonly sessionId: string;
  readonly socketId?: string;
  readonly startedAtMs: number;
  readonly finishedAtMs: number;
  readonly success: boolean;
  readonly errorMessage?: string;
}

export interface ChatEmissionResult {
  readonly planId: string;
  readonly status: ChatOutboxStatus;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly attempts: readonly ChatEmissionAttempt[];
  readonly startedAtMs: number;
  readonly finishedAtMs: number;
  readonly durationMs: number;
}

export interface ChatOutboxRecord {
  readonly planId: string;
  readonly status: ChatOutboxStatus;
  readonly emission: ChatPreparedEmission;
  readonly result?: ChatEmissionResult;
  readonly createdAtMs: number;
  readonly expiresAtMs: number;
}

export interface ChatFanoutServiceConfig {
  readonly defaultBatchSize: number;
  readonly maxBatchSize: number;
  readonly maxOutboxEntries: number;
  readonly outboxSweepIntervalMs: number;
  readonly defaultRetainOutboxMs: number;
  readonly defaultMaxRetryCount: number;
  readonly defaultRetryBackoffMs: number;
  readonly maxPayloadPreviewLength: number;
  readonly allowBestEffortWithoutSocketId: boolean;
}

export const DEFAULT_CHAT_FANOUT_CONFIG: ChatFanoutServiceConfig = {
  defaultBatchSize: 128,
  maxBatchSize: 512,
  maxOutboxEntries: 10_000,
  outboxSweepIntervalMs: 30_000,
  defaultRetainOutboxMs: 180_000,
  defaultMaxRetryCount: 1,
  defaultRetryBackoffMs: 50,
  maxPayloadPreviewLength: 180,
  allowBestEffortWithoutSocketId: false,
};

const CHANNEL_EVENT_DEFAULTS: Record<ChatChannelId, Partial<ChatFanoutPolicy>> = {
  GLOBAL: {
    batchSize: 256,
    semantics: 'BEST_EFFORT',
  },
  SYNDICATE: {
    batchSize: 128,
    semantics: 'AT_MOST_ONCE',
  },
  DEAL_ROOM: {
    batchSize: 64,
    semantics: 'TARGETED_RETRYABLE',
  },
  LOBBY: {
    batchSize: 128,
    semantics: 'BEST_EFFORT',
  },
  SYSTEM_SHADOW: {
    batchSize: 32,
    semantics: 'NO_RETRY',
  },
  NPC_SHADOW: {
    batchSize: 32,
    semantics: 'NO_RETRY',
  },
  RIVALRY_SHADOW: {
    batchSize: 32,
    semantics: 'NO_RETRY',
  },
  RESCUE_SHADOW: {
    batchSize: 32,
    semantics: 'NO_RETRY',
  },
  LIVEOPS_SHADOW: {
    batchSize: 64,
    semantics: 'NO_RETRY',
  },
};

function createNoopLogger(): ChatLoggerAdapter {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

function createNoopMetrics(): ChatMetricsAdapter {
  return {
    increment: () => undefined,
    observe: () => undefined,
  };
}

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function nowMs(): number {
  return Date.now();
}

function hashPayload(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload ?? null)).digest('hex');
}

function compactTextPreview(payload: unknown, maxLength: number): string {
  const source = typeof payload === 'string' ? payload : JSON.stringify(payload ?? null);
  if (!source) {
    return '';
  }
  if (source.length <= maxLength) {
    return source;
  }
  return `${source.slice(0, maxLength)}…`;
}

function roleAllowed(role: ChatRecipientRole, requiredRoles?: readonly ChatRecipientRole[]): boolean {
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }
  return requiredRoles.includes(role);
}

function channelSuppressed(session: ChatSessionSnapshot, channelId: ChatChannelId, allowHiddenDelivery: boolean, allowShadowDelivery: boolean): ChatRecipientSuppressionReason {
  if (session.hiddenChannels.includes(channelId) && !allowHiddenDelivery) {
    return 'CHANNEL_BLOCKED';
  }
  if (session.mutedChannels.includes(channelId) && !allowShadowDelivery) {
    return 'CHANNEL_BLOCKED';
  }
  return 'NONE';
}

function isShadowChannel(channelId: ChatChannelId): boolean {
  return channelId.endsWith('_SHADOW');
}

function isDeliverableSocket(session: ChatSessionSnapshot, allowBestEffortWithoutSocketId: boolean): boolean {
  if (!session.connected) {
    return false;
  }
  if (session.socketId) {
    return true;
  }
  return allowBestEffortWithoutSocketId;
}

export class ChatFanoutService {
  private readonly config: ChatFanoutServiceConfig;
  private readonly rooms: ChatRoomRegistryAdapter;
  private readonly sessions: ChatSessionRegistryAdapter;
  private readonly emitter: ChatSocketEmitterAdapter;
  private readonly metrics: ChatMetricsAdapter;
  private readonly logger: ChatLoggerAdapter;
  private readonly outbox = new Map<string, ChatOutboxRecord>();
  private lastSweepAtMs = 0;

  public constructor(deps: {
    config?: Partial<ChatFanoutServiceConfig>;
    rooms: ChatRoomRegistryAdapter;
    sessions: ChatSessionRegistryAdapter;
    emitter: ChatSocketEmitterAdapter;
    metrics?: ChatMetricsAdapter;
    logger?: ChatLoggerAdapter;
  }) {
    this.config = {
      ...DEFAULT_CHAT_FANOUT_CONFIG,
      ...(deps.config ?? {}),
    };
    this.rooms = deps.rooms;
    this.sessions = deps.sessions;
    this.emitter = deps.emitter;
    this.metrics = deps.metrics ?? createNoopMetrics();
    this.logger = deps.logger ?? createNoopLogger();
  }

  public buildDefaultPolicy(
    channelId: ChatChannelId,
    eventName: ChatFanoutEventName,
    audience: ChatFanoutAudience,
    overrides?: Partial<Omit<ChatFanoutPolicy, 'eventName' | 'audience'>>
  ): ChatFanoutPolicy {
    const channelDefaults = CHANNEL_EVENT_DEFAULTS[channelId] ?? {};
    return {
      eventName,
      audience,
      semantics: overrides?.semantics ?? channelDefaults.semantics ?? 'AT_MOST_ONCE',
      batchSize: clamp(
        overrides?.batchSize ?? channelDefaults.batchSize ?? this.config.defaultBatchSize,
        1,
        this.config.maxBatchSize,
      ),
      maxRetryCount: overrides?.maxRetryCount ?? this.config.defaultMaxRetryCount,
      retryBackoffMs: overrides?.retryBackoffMs ?? this.config.defaultRetryBackoffMs,
      retainOutboxMs: overrides?.retainOutboxMs ?? this.config.defaultRetainOutboxMs,
      allowHiddenDelivery: overrides?.allowHiddenDelivery ?? false,
      allowShadowDelivery: overrides?.allowShadowDelivery ?? isShadowChannel(channelId),
      dedupeWithinPlan: overrides?.dedupeWithinPlan ?? true,
      ackExpected: overrides?.ackExpected ?? false,
    };
  }

  public prepareFromEnvelope<TPayload>(
    envelope: ChatAuthoritativeEnvelope<TPayload>,
    policy: ChatFanoutPolicy,
  ): ChatPreparedEmission {
    this.sweepOutboxIfNeeded();

    const recipients = this.resolveAudience(policy.audience, envelope.channelId, policy);
    const planId = this.buildPlanId(envelope, policy, recipients);
    const payloadHash = hashPayload(envelope.payload);

    const emission: ChatPreparedEmission = {
      planId,
      authoritativeEventId: envelope.authoritativeEventId,
      roomId: envelope.roomId,
      channelId: envelope.channelId,
      eventName: policy.eventName,
      payload: envelope.payload,
      payloadHash,
      policy,
      recipients,
      preparedAtMs: nowMs(),
      transportMeta: {
        authoritativeSequence: envelope.authoritativeSequence,
        visibility: envelope.visibility,
        subtype: envelope.subtype,
        sourceKind: envelope.sourceKind,
        correlationId: envelope.correlationId,
        causalityRootId: envelope.causalityRootId,
        payloadPreview: compactTextPreview(envelope.payload, this.config.maxPayloadPreviewLength),
      },
    };

    this.insertOutboxRecord(emission, 'QUEUED');

    this.metrics.increment('chat_fanout_prepared_total', 1, {
      channelId: envelope.channelId,
      eventName: policy.eventName,
      audienceKind: policy.audience.kind,
      deliverableCount: emission.recipients.filter((item) => item.deliverable).length,
    });

    this.logger.debug('Prepared chat fanout emission', {
      planId,
      authoritativeEventId: envelope.authoritativeEventId,
      roomId: envelope.roomId,
      channelId: envelope.channelId,
      eventName: policy.eventName,
      audienceKind: policy.audience.kind,
      recipientCount: emission.recipients.length,
    });

    return emission;
  }

  public async emitPrepared(emission: ChatPreparedEmission): Promise<ChatEmissionResult> {
    const startedAtMs = nowMs();
    const deliverable = emission.recipients.filter((item) => item.deliverable);

    if (deliverable.length === 0) {
      const finishedAtMs = nowMs();
      const emptyResult: ChatEmissionResult = {
        planId: emission.planId,
        status: 'DROPPED',
        preparedRecipientCount: emission.recipients.length,
        emittedRecipientCount: 0,
        failedRecipientCount: 0,
        droppedRecipientCount: emission.recipients.length,
        attempts: [],
        startedAtMs,
        finishedAtMs,
        durationMs: finishedAtMs - startedAtMs,
      };
      this.finalizeOutbox(emission.planId, emptyResult);
      this.metrics.increment('chat_fanout_dropped_total', emission.recipients.length, {
        channelId: emission.channelId,
        eventName: emission.eventName,
      });
      return emptyResult;
    }

    const attempts: ChatEmissionAttempt[] = [];
    let emittedRecipientCount = 0;
    let failedRecipientCount = 0;

    const batches = this.partitionRecipients(deliverable, emission.policy.batchSize);

    for (const batch of batches) {
      for (const recipient of batch) {
        const attempt = await this.emitToRecipient(emission, recipient);
        attempts.push(attempt);
        if (attempt.success) {
          emittedRecipientCount += 1;
        } else {
          failedRecipientCount += 1;
        }
      }
    }

    const finishedAtMs = nowMs();
    const status: ChatOutboxStatus =
      failedRecipientCount === 0
        ? (emission.policy.ackExpected ? 'EMITTED' : 'EMITTED')
        : emittedRecipientCount === 0
          ? 'FAILED'
          : 'PARTIAL';

    const result: ChatEmissionResult = {
      planId: emission.planId,
      status,
      preparedRecipientCount: emission.recipients.length,
      emittedRecipientCount,
      failedRecipientCount,
      droppedRecipientCount: emission.recipients.length - deliverable.length,
      attempts,
      startedAtMs,
      finishedAtMs,
      durationMs: finishedAtMs - startedAtMs,
    };

    this.finalizeOutbox(emission.planId, result);

    this.metrics.increment('chat_fanout_emitted_total', emittedRecipientCount, {
      channelId: emission.channelId,
      eventName: emission.eventName,
      audienceKind: emission.policy.audience.kind,
    });

    if (failedRecipientCount > 0) {
      this.metrics.increment('chat_fanout_failed_total', failedRecipientCount, {
        channelId: emission.channelId,
        eventName: emission.eventName,
        audienceKind: emission.policy.audience.kind,
      });
    }

    this.metrics.observe('chat_fanout_duration_ms', result.durationMs, {
      channelId: emission.channelId,
      eventName: emission.eventName,
    });

    this.logger.info('Executed chat fanout emission', {
      planId: emission.planId,
      status,
      emittedRecipientCount,
      failedRecipientCount,
      droppedRecipientCount: result.droppedRecipientCount,
      durationMs: result.durationMs,
    });

    return result;
  }

  public async prepareAndEmit<TPayload>(
    envelope: ChatAuthoritativeEnvelope<TPayload>,
    policy: ChatFanoutPolicy,
  ): Promise<ChatEmissionResult> {
    const emission = this.prepareFromEnvelope(envelope, policy);
    return this.emitPrepared(emission);
  }

  public getOutboxRecord(planId: string): ChatOutboxRecord | undefined {
    return this.outbox.get(planId);
  }

  public getOutboxRecords(): readonly ChatOutboxRecord[] {
    return Array.from(this.outbox.values()).sort((left, right) => left.createdAtMs - right.createdAtMs);
  }

  public clearExpiredOutboxRecords(now: number = nowMs()): number {
    let removed = 0;
    for (const [planId, record] of this.outbox.entries()) {
      if (record.expiresAtMs <= now) {
        this.outbox.delete(planId);
        removed += 1;
      }
    }
    if (removed > 0) {
      this.metrics.increment('chat_fanout_outbox_evicted_total', removed);
      this.logger.debug('Evicted expired chat fanout outbox records', {
        removed,
        remaining: this.outbox.size,
      });
    }
    return removed;
  }

  public clearAllOutboxRecords(): void {
    const removed = this.outbox.size;
    this.outbox.clear();
    if (removed > 0) {
      this.logger.warn('Cleared all chat fanout outbox records', { removed });
    }
  }

  public prepareRoomMessage(
    roomId: string,
    channelId: ChatChannelId,
    envelope: ChatAuthoritativeEnvelope<ChatMessageFanoutPayload>,
    overrides?: Partial<Omit<ChatFanoutPolicy, 'eventName' | 'audience'>>
  ): ChatPreparedEmission {
    const policy = this.buildDefaultPolicy(
      channelId,
      envelope.payload.moderationState === 'REDACTED' ? 'chat:message:redacted' : 'chat:message',
      {
        kind: 'ROOM_VISIBLE',
        roomId,
        includeSpectators: channelId === 'GLOBAL' || channelId === 'LOBBY',
      },
      overrides,
    );
    return this.prepareFromEnvelope(envelope, policy);
  }

  public prepareRoomPresence(
    roomId: string,
    channelId: ChatChannelId,
    envelope: ChatAuthoritativeEnvelope<ChatPresenceFanoutPayload>,
    overrides?: Partial<Omit<ChatFanoutPolicy, 'eventName' | 'audience'>>
  ): ChatPreparedEmission {
    const policy = this.buildDefaultPolicy(
      channelId,
      'chat:presence',
      {
        kind: 'ROOM_VISIBLE',
        roomId,
        includeSpectators: true,
      },
      overrides,
    );
    return this.prepareFromEnvelope(envelope, policy);
  }

  public prepareRoomTyping(
    roomId: string,
    channelId: ChatChannelId,
    envelope: ChatAuthoritativeEnvelope<ChatTypingFanoutPayload>,
    overrides?: Partial<Omit<ChatFanoutPolicy, 'eventName' | 'audience'>>
  ): ChatPreparedEmission {
    const policy = this.buildDefaultPolicy(
      channelId,
      'chat:typing',
      {
        kind: 'ROOM_VISIBLE',
        roomId,
        includeSpectators: channelId === 'GLOBAL' || channelId === 'LOBBY',
        originSessionId: envelope.payload.sessionId,
        includeOriginSession: false,
      },
      overrides,
    );
    return this.prepareFromEnvelope(envelope, policy);
  }

  public prepareRoomCursor(
    roomId: string,
    channelId: ChatChannelId,
    envelope: ChatAuthoritativeEnvelope<ChatCursorFanoutPayload>,
    overrides?: Partial<Omit<ChatFanoutPolicy, 'eventName' | 'audience'>>
  ): ChatPreparedEmission {
    const policy = this.buildDefaultPolicy(
      channelId,
      'chat:cursor',
      {
        kind: 'ROOM_VISIBLE',
        roomId,
        includeSpectators: false,
        originSessionId: envelope.payload.sessionId,
        includeOriginSession: false,
      },
      overrides,
    );
    return this.prepareFromEnvelope(envelope, policy);
  }

  public prepareTargetedReplay(
    roomId: string,
    channelId: ChatChannelId,
    envelope: ChatAuthoritativeEnvelope<ChatReplayFanoutPayload>,
    sessionIds: readonly string[],
    overrides?: Partial<Omit<ChatFanoutPolicy, 'eventName' | 'audience'>>
  ): ChatPreparedEmission {
    const policy = this.buildDefaultPolicy(
      channelId,
      envelope.payload.isFinalChunk ? 'chat:replay:complete' : 'chat:replay:chunk',
      {
        kind: 'SESSION_LIST',
        roomId,
        sessionIds,
        includeOriginSession: true,
      },
      {
        ...overrides,
        semantics: overrides?.semantics ?? 'TARGETED_RETRYABLE',
        batchSize: overrides?.batchSize ?? 32,
      },
    );
    return this.prepareFromEnvelope(envelope, policy);
  }

  public prepareTargetedControl(
    roomId: string,
    channelId: ChatChannelId,
    envelope: ChatAuthoritativeEnvelope<ChatControlFanoutPayload>,
    sessionIds: readonly string[],
    overrides?: Partial<Omit<ChatFanoutPolicy, 'eventName' | 'audience'>>
  ): ChatPreparedEmission {
    const policy = this.buildDefaultPolicy(
      channelId,
      'chat:control',
      {
        kind: 'SESSION_LIST',
        roomId,
        sessionIds,
      },
      {
        ...overrides,
        semantics: overrides?.semantics ?? 'TARGETED_RETRYABLE',
        batchSize: overrides?.batchSize ?? 64,
      },
    );
    return this.prepareFromEnvelope(envelope, policy);
  }

  public prepareShadowInternal<TPayload>(
    roomId: string,
    channelId: ChatChannelId,
    envelope: ChatAuthoritativeEnvelope<TPayload>,
    sessionIds: readonly string[],
    overrides?: Partial<Omit<ChatFanoutPolicy, 'eventName' | 'audience'>>
  ): ChatPreparedEmission {
    const policy = this.buildDefaultPolicy(
      channelId,
      'chat:system',
      {
        kind: 'SESSION_LIST',
        roomId,
        sessionIds,
      },
      {
        ...overrides,
        allowShadowDelivery: true,
        allowHiddenDelivery: true,
        semantics: overrides?.semantics ?? 'NO_RETRY',
        batchSize: overrides?.batchSize ?? 32,
      },
    );
    return this.prepareFromEnvelope(envelope, policy);
  }

  private resolveAudience(
    audience: ChatFanoutAudience,
    channelId: ChatChannelId,
    policy: ChatFanoutPolicy,
  ): readonly ChatPreparedRecipient[] {
    const rawSessionIds = this.resolveAudienceSessionIds(audience);
    const dedupedSessionIds = policy.dedupeWithinPlan ? unique(rawSessionIds) : [...rawSessionIds];
    const sessions = this.sessions.getSessions(dedupedSessionIds);

    return sessions.map((session) => this.evaluateRecipient(session, audience, channelId, policy));
  }

  private resolveAudienceSessionIds(audience: ChatFanoutAudience): readonly string[] {
    switch (audience.kind) {
      case 'ROOM_ALL':
      case 'ROOM_MEMBERS': {
        return audience.roomId ? this.rooms.getMemberSessionIds(audience.roomId) : [];
      }
      case 'ROOM_ACTIVE': {
        return audience.roomId ? this.rooms.getActiveSessionIds(audience.roomId) : [];
      }
      case 'ROOM_VISIBLE': {
        return audience.roomId ? this.rooms.getVisibleSessionIds(audience.roomId) : [];
      }
      case 'ROOM_SPECTATORS': {
        return audience.roomId ? this.rooms.getSpectatorSessionIds(audience.roomId) : [];
      }
      case 'ROOM_NON_SPECTATORS': {
        const roomId = audience.roomId;
        if (!roomId) {
          return [];
        }
        const members = this.rooms.getMemberSessionIds(roomId);
        const spectators = new Set(this.rooms.getSpectatorSessionIds(roomId));
        return members.filter((sessionId) => !spectators.has(sessionId));
      }
      case 'ROOM_HELPERS': {
        return audience.roomId ? this.rooms.getHelperSessionIds(audience.roomId) : [];
      }
      case 'ROOM_HATERS': {
        return audience.roomId ? this.rooms.getHaterSessionIds(audience.roomId) : [];
      }
      case 'REPLAY_SUBSCRIBERS': {
        return audience.roomId ? this.rooms.getReplaySubscriberSessionIds(audience.roomId) : [];
      }
      case 'SESSION_LIST': {
        return audience.sessionIds ?? [];
      }
      case 'SESSION_SINGLE': {
        return audience.sessionIds?.slice(0, 1) ?? [];
      }
      case 'PLAYER_LIST': {
        return audience.playerIds ? this.sessions.getSessionsByPlayerIds(audience.playerIds).map((item) => item.sessionId) : [];
      }
      case 'PLAYER_SINGLE': {
        const ids = audience.playerIds ? this.sessions.getSessionsByPlayerIds(audience.playerIds.slice(0, 1)).map((item) => item.sessionId) : [];
        return ids.slice(0, 1);
      }
      case 'SHADOW_INTERNAL': {
        return audience.sessionIds ?? [];
      }
      default: {
        return [];
      }
    }
  }

  private evaluateRecipient(
    session: ChatSessionSnapshot,
    audience: ChatFanoutAudience,
    channelId: ChatChannelId,
    policy: ChatFanoutPolicy,
  ): ChatPreparedRecipient {
    const excludedSessions = new Set(audience.excludedSessionIds ?? []);
    const includeOriginSession = audience.includeOriginSession ?? true;

    let suppressionReason: ChatRecipientSuppressionReason = 'NONE';

    if (excludedSessions.has(session.sessionId)) {
      suppressionReason = 'DUPLICATE';
    } else if (!includeOriginSession && audience.originSessionId && audience.originSessionId === session.sessionId) {
      suppressionReason = 'EXCLUDED_ORIGIN';
    } else if (audience.roomId && session.roomId && audience.roomId !== session.roomId) {
      suppressionReason = 'ROOM_MISMATCH';
    } else if (!roleAllowed(session.role, audience.requiredRoles)) {
      suppressionReason = 'ROLE_BLOCKED';
    } else if (session.spectator && audience.includeSpectators === false) {
      suppressionReason = 'SPECTATOR_FILTERED';
    } else if (!session.visible && !policy.allowHiddenDelivery) {
      suppressionReason = 'HIDDEN';
    } else {
      suppressionReason = channelSuppressed(session, channelId, policy.allowHiddenDelivery, policy.allowShadowDelivery);
    }

    if (suppressionReason === 'NONE' && !isDeliverableSocket(session, this.config.allowBestEffortWithoutSocketId)) {
      suppressionReason = 'DISCONNECTED';
    }

    return {
      sessionId: session.sessionId,
      socketId: session.socketId,
      playerId: session.playerId,
      username: session.username,
      role: session.role,
      roomId: session.roomId,
      suppressionReason,
      deliverable: suppressionReason === 'NONE',
    };
  }

  private buildPlanId(
    envelope: ChatAuthoritativeEnvelope<unknown>,
    policy: ChatFanoutPolicy,
    recipients: readonly ChatPreparedRecipient[],
  ): string {
    const seed = [
      envelope.authoritativeEventId,
      envelope.authoritativeSequence,
      envelope.roomId,
      envelope.channelId,
      policy.eventName,
      policy.audience.kind,
      recipients.map((item) => item.sessionId).join(','),
    ].join('|');

    return createHash('sha256').update(seed).digest('hex');
  }

  private insertOutboxRecord(emission: ChatPreparedEmission, status: ChatOutboxStatus): void {
    const createdAtMs = nowMs();
    const record: ChatOutboxRecord = {
      planId: emission.planId,
      status,
      emission,
      createdAtMs,
      expiresAtMs: createdAtMs + emission.policy.retainOutboxMs,
    };
    this.outbox.set(record.planId, record);

    if (this.outbox.size > this.config.maxOutboxEntries) {
      const oldest = Array.from(this.outbox.values()).sort((left, right) => left.createdAtMs - right.createdAtMs)[0];
      if (oldest) {
        this.outbox.delete(oldest.planId);
        this.metrics.increment('chat_fanout_outbox_evicted_total', 1, { reason: 'MAX_ENTRIES' });
      }
    }
  }

  private finalizeOutbox(planId: string, result: ChatEmissionResult): void {
    const existing = this.outbox.get(planId);
    if (!existing) {
      return;
    }
    this.outbox.set(planId, {
      ...existing,
      status: result.status,
      result,
    });
  }

  private partitionRecipients(
    recipients: readonly ChatPreparedRecipient[],
    batchSize: number,
  ): readonly ChatPreparedRecipient[][] {
    if (recipients.length === 0) {
      return [];
    }
    const partitions: ChatPreparedRecipient[][] = [];
    for (let index = 0; index < recipients.length; index += batchSize) {
      partitions.push(recipients.slice(index, index + batchSize));
    }
    return partitions;
  }

  private async emitToRecipient(
    emission: ChatPreparedEmission,
    recipient: ChatPreparedRecipient,
  ): Promise<ChatEmissionAttempt> {
    const startedAtMs = nowMs();
    try {
      if (!recipient.socketId && !this.config.allowBestEffortWithoutSocketId) {
        throw new Error('Missing socketId for deliverable recipient');
      }

      await this.emitter.emitToSocket(
        recipient.socketId ?? recipient.sessionId,
        emission.eventName,
        this.buildClientPayload(emission, recipient),
      );

      const finishedAtMs = nowMs();
      return {
        sessionId: recipient.sessionId,
        socketId: recipient.socketId,
        startedAtMs,
        finishedAtMs,
        success: true,
      };
    } catch (error) {
      const finishedAtMs = nowMs();
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn('Chat fanout recipient emission failed', {
        planId: emission.planId,
        sessionId: recipient.sessionId,
        socketId: recipient.socketId,
        errorMessage,
      });
      return {
        sessionId: recipient.sessionId,
        socketId: recipient.socketId,
        startedAtMs,
        finishedAtMs,
        success: false,
        errorMessage,
      };
    }
  }

  private buildClientPayload(
    emission: ChatPreparedEmission,
    recipient: ChatPreparedRecipient,
  ): Record<string, unknown> {
    return {
      planId: emission.planId,
      authoritativeEventId: emission.authoritativeEventId,
      roomId: emission.roomId,
      channelId: emission.channelId,
      eventName: emission.eventName,
      payload: emission.payload,
      transport: {
        recipientSessionId: recipient.sessionId,
        recipientRole: recipient.role,
        payloadHash: emission.payloadHash,
        preparedAtMs: emission.preparedAtMs,
        semantics: emission.policy.semantics,
        ackExpected: emission.policy.ackExpected,
      },
      meta: emission.transportMeta,
    };
  }

  private sweepOutboxIfNeeded(): void {
    const now = nowMs();
    if (now - this.lastSweepAtMs < this.config.outboxSweepIntervalMs) {
      return;
    }
    this.lastSweepAtMs = now;
    this.clearExpiredOutboxRecords(now);
  }
}

export function createRoomVisibleAudience(roomId: string, includeSpectators = false): ChatFanoutAudience {
  return {
    kind: 'ROOM_VISIBLE',
    roomId,
    includeSpectators,
  };
}

export function createSessionListAudience(sessionIds: readonly string[], roomId?: string): ChatFanoutAudience {
  return {
    kind: 'SESSION_LIST',
    roomId,
    sessionIds,
  };
}

export function createReplaySubscriberAudience(roomId: string): ChatFanoutAudience {
  return {
    kind: 'REPLAY_SUBSCRIBERS',
    roomId,
    includeSpectators: true,
  };
}

export function createChatMessageEnvelope(input: {
  authoritativeEventId?: string;
  authoritativeSequence: number;
  roomId: string;
  channelId: ChatChannelId;
  sourceKind: ChatAuthoritativeEnvelope<ChatMessageFanoutPayload>['sourceKind'];
  payload: ChatMessageFanoutPayload;
  backendTimestampMs?: number;
  visibility?: ChatFanoutVisibility;
  correlationId?: string;
  meta?: Record<string, unknown>;
}): ChatAuthoritativeEnvelope<ChatMessageFanoutPayload> {
  return {
    authoritativeEventId: input.authoritativeEventId ?? randomUUID(),
    authoritativeSequence: input.authoritativeSequence,
    roomId: input.roomId,
    channelId: input.channelId,
    sourceKind: input.sourceKind,
    subtype: 'MESSAGE',
    visibility: input.visibility ?? 'ROOM_ONLY',
    correlationId: input.correlationId,
    backendTimestampMs: input.backendTimestampMs ?? nowMs(),
    payload: input.payload,
    meta: input.meta,
  };
}

export function createChatPresenceEnvelope(input: {
  authoritativeEventId?: string;
  authoritativeSequence: number;
  roomId: string;
  channelId: ChatChannelId;
  sourceKind?: ChatAuthoritativeEnvelope<ChatPresenceFanoutPayload>['sourceKind'];
  payload: ChatPresenceFanoutPayload;
  backendTimestampMs?: number;
  visibility?: ChatFanoutVisibility;
  correlationId?: string;
  meta?: Record<string, unknown>;
}): ChatAuthoritativeEnvelope<ChatPresenceFanoutPayload> {
  return {
    authoritativeEventId: input.authoritativeEventId ?? randomUUID(),
    authoritativeSequence: input.authoritativeSequence,
    roomId: input.roomId,
    channelId: input.channelId,
    sourceKind: input.sourceKind ?? 'SYSTEM',
    subtype: 'PRESENCE',
    visibility: input.visibility ?? 'ROOM_ONLY',
    correlationId: input.correlationId,
    backendTimestampMs: input.backendTimestampMs ?? nowMs(),
    payload: input.payload,
    meta: input.meta,
  };
}

export function createChatTypingEnvelope(input: {
  authoritativeEventId?: string;
  authoritativeSequence: number;
  roomId: string;
  channelId: ChatChannelId;
  sourceKind?: ChatAuthoritativeEnvelope<ChatTypingFanoutPayload>['sourceKind'];
  payload: ChatTypingFanoutPayload;
  backendTimestampMs?: number;
  visibility?: ChatFanoutVisibility;
  correlationId?: string;
  meta?: Record<string, unknown>;
}): ChatAuthoritativeEnvelope<ChatTypingFanoutPayload> {
  return {
    authoritativeEventId: input.authoritativeEventId ?? randomUUID(),
    authoritativeSequence: input.authoritativeSequence,
    roomId: input.roomId,
    channelId: input.channelId,
    sourceKind: input.sourceKind ?? 'PLAYER',
    subtype: 'TYPING',
    visibility: input.visibility ?? 'ROOM_ONLY',
    correlationId: input.correlationId,
    backendTimestampMs: input.backendTimestampMs ?? nowMs(),
    payload: input.payload,
    meta: input.meta,
  };
}

export function createChatCursorEnvelope(input: {
  authoritativeEventId?: string;
  authoritativeSequence: number;
  roomId: string;
  channelId: ChatChannelId;
  sourceKind?: ChatAuthoritativeEnvelope<ChatCursorFanoutPayload>['sourceKind'];
  payload: ChatCursorFanoutPayload;
  backendTimestampMs?: number;
  visibility?: ChatFanoutVisibility;
  correlationId?: string;
  meta?: Record<string, unknown>;
}): ChatAuthoritativeEnvelope<ChatCursorFanoutPayload> {
  return {
    authoritativeEventId: input.authoritativeEventId ?? randomUUID(),
    authoritativeSequence: input.authoritativeSequence,
    roomId: input.roomId,
    channelId: input.channelId,
    sourceKind: input.sourceKind ?? 'PLAYER',
    subtype: 'CURSOR',
    visibility: input.visibility ?? 'ROOM_ONLY',
    correlationId: input.correlationId,
    backendTimestampMs: input.backendTimestampMs ?? nowMs(),
    payload: input.payload,
    meta: input.meta,
  };
}

export function createChatReplayEnvelope(input: {
  authoritativeEventId?: string;
  authoritativeSequence: number;
  roomId: string;
  channelId: ChatChannelId;
  payload: ChatReplayFanoutPayload;
  backendTimestampMs?: number;
  visibility?: ChatFanoutVisibility;
  correlationId?: string;
  meta?: Record<string, unknown>;
}): ChatAuthoritativeEnvelope<ChatReplayFanoutPayload> {
  return {
    authoritativeEventId: input.authoritativeEventId ?? randomUUID(),
    authoritativeSequence: input.authoritativeSequence,
    roomId: input.roomId,
    channelId: input.channelId,
    sourceKind: 'REPLAY',
    subtype: 'REPLAY',
    visibility: input.visibility ?? 'TARGET_ONLY',
    correlationId: input.correlationId,
    backendTimestampMs: input.backendTimestampMs ?? nowMs(),
    payload: input.payload,
    meta: input.meta,
  };
}

export function createChatControlEnvelope(input: {
  authoritativeEventId?: string;
  authoritativeSequence: number;
  roomId: string;
  channelId: ChatChannelId;
  payload: ChatControlFanoutPayload;
  backendTimestampMs?: number;
  visibility?: ChatFanoutVisibility;
  correlationId?: string;
  meta?: Record<string, unknown>;
}): ChatAuthoritativeEnvelope<ChatControlFanoutPayload> {
  return {
    authoritativeEventId: input.authoritativeEventId ?? randomUUID(),
    authoritativeSequence: input.authoritativeSequence,
    roomId: input.roomId,
    channelId: input.channelId,
    sourceKind: 'SYSTEM',
    subtype: 'CONTROL',
    visibility: input.visibility ?? 'TARGET_ONLY',
    correlationId: input.correlationId,
    backendTimestampMs: input.backendTimestampMs ?? nowMs(),
    payload: input.payload,
    meta: input.meta,
  };
}

export function createChatMetricsEnvelope(input: {
  authoritativeEventId?: string;
  authoritativeSequence: number;
  roomId: string;
  channelId: ChatChannelId;
  payload: ChatMetricsFanoutPayload;
  backendTimestampMs?: number;
  visibility?: ChatFanoutVisibility;
  correlationId?: string;
  meta?: Record<string, unknown>;
}): ChatAuthoritativeEnvelope<ChatMetricsFanoutPayload> {
  return {
    authoritativeEventId: input.authoritativeEventId ?? randomUUID(),
    authoritativeSequence: input.authoritativeSequence,
    roomId: input.roomId,
    channelId: input.channelId,
    sourceKind: 'SYSTEM',
    subtype: 'METRIC',
    visibility: input.visibility ?? 'SERVER_ONLY',
    correlationId: input.correlationId,
    backendTimestampMs: input.backendTimestampMs ?? nowMs(),
    payload: input.payload,
    meta: input.meta,
  };
}

export function createGlobalBroadcastPolicy(roomId: string): ChatFanoutPolicy {
  return {
    eventName: 'chat:message',
    audience: {
      kind: 'ROOM_VISIBLE',
      roomId,
      includeSpectators: true,
    },
    semantics: 'AT_MOST_ONCE',
    batchSize: 256,
    maxRetryCount: 1,
    retryBackoffMs: 50,
    retainOutboxMs: 180000,
    allowHiddenDelivery: false,
    allowShadowDelivery: false,
    dedupeWithinPlan: true,
    ackExpected: false,
  };
}


export function createSyndicateBroadcastPolicy(roomId: string): ChatFanoutPolicy {
  return {
    eventName: 'chat:message',
    audience: {
      kind: 'ROOM_VISIBLE',
      roomId,
      includeSpectators: false,
    },
    semantics: 'AT_MOST_ONCE',
    batchSize: 128,
    maxRetryCount: 1,
    retryBackoffMs: 50,
    retainOutboxMs: 180000,
    allowHiddenDelivery: false,
    allowShadowDelivery: false,
    dedupeWithinPlan: true,
    ackExpected: false,
  };
}


export function createDealRoomBroadcastPolicy(roomId: string): ChatFanoutPolicy {
  return {
    eventName: 'chat:message',
    audience: {
      kind: 'ROOM_VISIBLE',
      roomId,
      includeSpectators: false,
    },
    semantics: 'TARGETED_RETRYABLE',
    batchSize: 64,
    maxRetryCount: 2,
    retryBackoffMs: 125,
    retainOutboxMs: 180000,
    allowHiddenDelivery: false,
    allowShadowDelivery: false,
    dedupeWithinPlan: true,
    ackExpected: false,
  };
}


export function createLobbyBroadcastPolicy(roomId: string): ChatFanoutPolicy {
  return {
    eventName: 'chat:message',
    audience: {
      kind: 'ROOM_VISIBLE',
      roomId,
      includeSpectators: true,
    },
    semantics: 'AT_MOST_ONCE',
    batchSize: 128,
    maxRetryCount: 1,
    retryBackoffMs: 50,
    retainOutboxMs: 180000,
    allowHiddenDelivery: false,
    allowShadowDelivery: false,
    dedupeWithinPlan: true,
    ackExpected: false,
  };
}


export function createSystemShadowBroadcastPolicy(roomId: string): ChatFanoutPolicy {
  return {
    eventName: 'chat:message',
    audience: {
      kind: 'ROOM_VISIBLE',
      roomId,
      includeSpectators: false,
    },
    semantics: 'NO_RETRY',
    batchSize: 32,
    maxRetryCount: 0,
    retryBackoffMs: 0,
    retainOutboxMs: 60000,
    allowHiddenDelivery: true,
    allowShadowDelivery: true,
    dedupeWithinPlan: true,
    ackExpected: false,
  };
}


export function createNpcShadowBroadcastPolicy(roomId: string): ChatFanoutPolicy {
  return {
    eventName: 'chat:message',
    audience: {
      kind: 'ROOM_VISIBLE',
      roomId,
      includeSpectators: false,
    },
    semantics: 'NO_RETRY',
    batchSize: 32,
    maxRetryCount: 0,
    retryBackoffMs: 0,
    retainOutboxMs: 60000,
    allowHiddenDelivery: true,
    allowShadowDelivery: true,
    dedupeWithinPlan: true,
    ackExpected: false,
  };
}


export function createRivalryShadowBroadcastPolicy(roomId: string): ChatFanoutPolicy {
  return {
    eventName: 'chat:message',
    audience: {
      kind: 'ROOM_VISIBLE',
      roomId,
      includeSpectators: false,
    },
    semantics: 'NO_RETRY',
    batchSize: 32,
    maxRetryCount: 0,
    retryBackoffMs: 0,
    retainOutboxMs: 60000,
    allowHiddenDelivery: true,
    allowShadowDelivery: true,
    dedupeWithinPlan: true,
    ackExpected: false,
  };
}


export function createRescueShadowBroadcastPolicy(roomId: string): ChatFanoutPolicy {
  return {
    eventName: 'chat:message',
    audience: {
      kind: 'ROOM_VISIBLE',
      roomId,
      includeSpectators: false,
    },
    semantics: 'NO_RETRY',
    batchSize: 32,
    maxRetryCount: 0,
    retryBackoffMs: 0,
    retainOutboxMs: 60000,
    allowHiddenDelivery: true,
    allowShadowDelivery: true,
    dedupeWithinPlan: true,
    ackExpected: false,
  };
}


export function createLiveopsShadowBroadcastPolicy(roomId: string): ChatFanoutPolicy {
  return {
    eventName: 'chat:message',
    audience: {
      kind: 'ROOM_VISIBLE',
      roomId,
      includeSpectators: false,
    },
    semantics: 'NO_RETRY',
    batchSize: 32,
    maxRetryCount: 0,
    retryBackoffMs: 0,
    retainOutboxMs: 60000,
    allowHiddenDelivery: true,
    allowShadowDelivery: true,
    dedupeWithinPlan: true,
    ackExpected: false,
  };
}

export interface ChatFanoutInspectionRow1 {
  readonly ordinal: 1;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow1(record: ChatOutboxRecord): ChatFanoutInspectionRow1 {
  const result = record.result;
  return {
    ordinal: 1,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow2 {
  readonly ordinal: 2;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow2(record: ChatOutboxRecord): ChatFanoutInspectionRow2 {
  const result = record.result;
  return {
    ordinal: 2,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow3 {
  readonly ordinal: 3;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow3(record: ChatOutboxRecord): ChatFanoutInspectionRow3 {
  const result = record.result;
  return {
    ordinal: 3,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow4 {
  readonly ordinal: 4;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow4(record: ChatOutboxRecord): ChatFanoutInspectionRow4 {
  const result = record.result;
  return {
    ordinal: 4,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow5 {
  readonly ordinal: 5;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow5(record: ChatOutboxRecord): ChatFanoutInspectionRow5 {
  const result = record.result;
  return {
    ordinal: 5,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow6 {
  readonly ordinal: 6;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow6(record: ChatOutboxRecord): ChatFanoutInspectionRow6 {
  const result = record.result;
  return {
    ordinal: 6,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow7 {
  readonly ordinal: 7;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow7(record: ChatOutboxRecord): ChatFanoutInspectionRow7 {
  const result = record.result;
  return {
    ordinal: 7,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow8 {
  readonly ordinal: 8;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow8(record: ChatOutboxRecord): ChatFanoutInspectionRow8 {
  const result = record.result;
  return {
    ordinal: 8,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow9 {
  readonly ordinal: 9;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow9(record: ChatOutboxRecord): ChatFanoutInspectionRow9 {
  const result = record.result;
  return {
    ordinal: 9,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow10 {
  readonly ordinal: 10;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow10(record: ChatOutboxRecord): ChatFanoutInspectionRow10 {
  const result = record.result;
  return {
    ordinal: 10,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow11 {
  readonly ordinal: 11;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow11(record: ChatOutboxRecord): ChatFanoutInspectionRow11 {
  const result = record.result;
  return {
    ordinal: 11,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow12 {
  readonly ordinal: 12;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow12(record: ChatOutboxRecord): ChatFanoutInspectionRow12 {
  const result = record.result;
  return {
    ordinal: 12,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow13 {
  readonly ordinal: 13;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow13(record: ChatOutboxRecord): ChatFanoutInspectionRow13 {
  const result = record.result;
  return {
    ordinal: 13,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow14 {
  readonly ordinal: 14;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow14(record: ChatOutboxRecord): ChatFanoutInspectionRow14 {
  const result = record.result;
  return {
    ordinal: 14,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow15 {
  readonly ordinal: 15;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow15(record: ChatOutboxRecord): ChatFanoutInspectionRow15 {
  const result = record.result;
  return {
    ordinal: 15,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow16 {
  readonly ordinal: 16;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow16(record: ChatOutboxRecord): ChatFanoutInspectionRow16 {
  const result = record.result;
  return {
    ordinal: 16,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow17 {
  readonly ordinal: 17;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow17(record: ChatOutboxRecord): ChatFanoutInspectionRow17 {
  const result = record.result;
  return {
    ordinal: 17,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow18 {
  readonly ordinal: 18;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow18(record: ChatOutboxRecord): ChatFanoutInspectionRow18 {
  const result = record.result;
  return {
    ordinal: 18,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow19 {
  readonly ordinal: 19;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow19(record: ChatOutboxRecord): ChatFanoutInspectionRow19 {
  const result = record.result;
  return {
    ordinal: 19,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow20 {
  readonly ordinal: 20;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow20(record: ChatOutboxRecord): ChatFanoutInspectionRow20 {
  const result = record.result;
  return {
    ordinal: 20,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow21 {
  readonly ordinal: 21;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow21(record: ChatOutboxRecord): ChatFanoutInspectionRow21 {
  const result = record.result;
  return {
    ordinal: 21,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow22 {
  readonly ordinal: 22;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow22(record: ChatOutboxRecord): ChatFanoutInspectionRow22 {
  const result = record.result;
  return {
    ordinal: 22,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow23 {
  readonly ordinal: 23;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow23(record: ChatOutboxRecord): ChatFanoutInspectionRow23 {
  const result = record.result;
  return {
    ordinal: 23,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow24 {
  readonly ordinal: 24;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow24(record: ChatOutboxRecord): ChatFanoutInspectionRow24 {
  const result = record.result;
  return {
    ordinal: 24,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow25 {
  readonly ordinal: 25;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow25(record: ChatOutboxRecord): ChatFanoutInspectionRow25 {
  const result = record.result;
  return {
    ordinal: 25,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow26 {
  readonly ordinal: 26;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow26(record: ChatOutboxRecord): ChatFanoutInspectionRow26 {
  const result = record.result;
  return {
    ordinal: 26,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow27 {
  readonly ordinal: 27;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow27(record: ChatOutboxRecord): ChatFanoutInspectionRow27 {
  const result = record.result;
  return {
    ordinal: 27,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow28 {
  readonly ordinal: 28;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow28(record: ChatOutboxRecord): ChatFanoutInspectionRow28 {
  const result = record.result;
  return {
    ordinal: 28,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow29 {
  readonly ordinal: 29;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow29(record: ChatOutboxRecord): ChatFanoutInspectionRow29 {
  const result = record.result;
  return {
    ordinal: 29,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow30 {
  readonly ordinal: 30;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow30(record: ChatOutboxRecord): ChatFanoutInspectionRow30 {
  const result = record.result;
  return {
    ordinal: 30,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow31 {
  readonly ordinal: 31;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow31(record: ChatOutboxRecord): ChatFanoutInspectionRow31 {
  const result = record.result;
  return {
    ordinal: 31,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow32 {
  readonly ordinal: 32;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow32(record: ChatOutboxRecord): ChatFanoutInspectionRow32 {
  const result = record.result;
  return {
    ordinal: 32,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow33 {
  readonly ordinal: 33;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow33(record: ChatOutboxRecord): ChatFanoutInspectionRow33 {
  const result = record.result;
  return {
    ordinal: 33,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow34 {
  readonly ordinal: 34;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow34(record: ChatOutboxRecord): ChatFanoutInspectionRow34 {
  const result = record.result;
  return {
    ordinal: 34,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow35 {
  readonly ordinal: 35;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow35(record: ChatOutboxRecord): ChatFanoutInspectionRow35 {
  const result = record.result;
  return {
    ordinal: 35,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow36 {
  readonly ordinal: 36;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow36(record: ChatOutboxRecord): ChatFanoutInspectionRow36 {
  const result = record.result;
  return {
    ordinal: 36,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow37 {
  readonly ordinal: 37;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow37(record: ChatOutboxRecord): ChatFanoutInspectionRow37 {
  const result = record.result;
  return {
    ordinal: 37,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow38 {
  readonly ordinal: 38;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow38(record: ChatOutboxRecord): ChatFanoutInspectionRow38 {
  const result = record.result;
  return {
    ordinal: 38,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow39 {
  readonly ordinal: 39;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow39(record: ChatOutboxRecord): ChatFanoutInspectionRow39 {
  const result = record.result;
  return {
    ordinal: 39,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow40 {
  readonly ordinal: 40;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow40(record: ChatOutboxRecord): ChatFanoutInspectionRow40 {
  const result = record.result;
  return {
    ordinal: 40,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow41 {
  readonly ordinal: 41;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow41(record: ChatOutboxRecord): ChatFanoutInspectionRow41 {
  const result = record.result;
  return {
    ordinal: 41,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow42 {
  readonly ordinal: 42;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow42(record: ChatOutboxRecord): ChatFanoutInspectionRow42 {
  const result = record.result;
  return {
    ordinal: 42,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow43 {
  readonly ordinal: 43;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow43(record: ChatOutboxRecord): ChatFanoutInspectionRow43 {
  const result = record.result;
  return {
    ordinal: 43,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow44 {
  readonly ordinal: 44;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow44(record: ChatOutboxRecord): ChatFanoutInspectionRow44 {
  const result = record.result;
  return {
    ordinal: 44,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow45 {
  readonly ordinal: 45;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow45(record: ChatOutboxRecord): ChatFanoutInspectionRow45 {
  const result = record.result;
  return {
    ordinal: 45,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow46 {
  readonly ordinal: 46;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow46(record: ChatOutboxRecord): ChatFanoutInspectionRow46 {
  const result = record.result;
  return {
    ordinal: 46,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow47 {
  readonly ordinal: 47;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow47(record: ChatOutboxRecord): ChatFanoutInspectionRow47 {
  const result = record.result;
  return {
    ordinal: 47,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow48 {
  readonly ordinal: 48;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow48(record: ChatOutboxRecord): ChatFanoutInspectionRow48 {
  const result = record.result;
  return {
    ordinal: 48,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow49 {
  readonly ordinal: 49;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow49(record: ChatOutboxRecord): ChatFanoutInspectionRow49 {
  const result = record.result;
  return {
    ordinal: 49,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow50 {
  readonly ordinal: 50;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow50(record: ChatOutboxRecord): ChatFanoutInspectionRow50 {
  const result = record.result;
  return {
    ordinal: 50,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow51 {
  readonly ordinal: 51;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow51(record: ChatOutboxRecord): ChatFanoutInspectionRow51 {
  const result = record.result;
  return {
    ordinal: 51,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow52 {
  readonly ordinal: 52;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow52(record: ChatOutboxRecord): ChatFanoutInspectionRow52 {
  const result = record.result;
  return {
    ordinal: 52,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow53 {
  readonly ordinal: 53;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow53(record: ChatOutboxRecord): ChatFanoutInspectionRow53 {
  const result = record.result;
  return {
    ordinal: 53,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow54 {
  readonly ordinal: 54;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow54(record: ChatOutboxRecord): ChatFanoutInspectionRow54 {
  const result = record.result;
  return {
    ordinal: 54,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow55 {
  readonly ordinal: 55;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow55(record: ChatOutboxRecord): ChatFanoutInspectionRow55 {
  const result = record.result;
  return {
    ordinal: 55,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow56 {
  readonly ordinal: 56;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow56(record: ChatOutboxRecord): ChatFanoutInspectionRow56 {
  const result = record.result;
  return {
    ordinal: 56,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow57 {
  readonly ordinal: 57;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow57(record: ChatOutboxRecord): ChatFanoutInspectionRow57 {
  const result = record.result;
  return {
    ordinal: 57,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow58 {
  readonly ordinal: 58;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow58(record: ChatOutboxRecord): ChatFanoutInspectionRow58 {
  const result = record.result;
  return {
    ordinal: 58,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow59 {
  readonly ordinal: 59;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow59(record: ChatOutboxRecord): ChatFanoutInspectionRow59 {
  const result = record.result;
  return {
    ordinal: 59,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}


export interface ChatFanoutInspectionRow60 {
  readonly ordinal: 60;
  readonly planId: string;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly eventName: ChatFanoutEventName;
  readonly preparedRecipientCount: number;
  readonly emittedRecipientCount: number;
  readonly failedRecipientCount: number;
  readonly droppedRecipientCount: number;
  readonly payloadHash: string;
}

export function createInspectionRow60(record: ChatOutboxRecord): ChatFanoutInspectionRow60 {
  const result = record.result;
  return {
    ordinal: 60,
    planId: record.planId,
    roomId: record.emission.roomId,
    channelId: record.emission.channelId,
    eventName: record.emission.eventName,
    preparedRecipientCount: result?.preparedRecipientCount ?? record.emission.recipients.length,
    emittedRecipientCount: result?.emittedRecipientCount ?? 0,
    failedRecipientCount: result?.failedRecipientCount ?? 0,
    droppedRecipientCount: result?.droppedRecipientCount ?? 0,
    payloadHash: record.emission.payloadHash,
  };
}
