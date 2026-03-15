
/**
 * ============================================================================
 * POINT ZERO ONE — SERVER CHAT REPLAY SERVICE
 * FILE: pzo-server/src/chat/ChatReplayService.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical server transport-side replay broker for unified chat.
 *
 * Backend chat authority owns:
 * - transcript truth,
 * - proof truth,
 * - replay truth,
 * - sequence truth,
 * - replay assembly truth.
 *
 * This service does not replace any of that. It exists because the server
 * transport lane still needs a dedicated place to:
 * - accept replay requests,
 * - normalize replay hydration intents,
 * - validate transport-facing constraints,
 * - dedupe duplicate replay fetches,
 * - cache recent replay snapshots,
 * - chunk replay responses for sockets,
 * - map authoritative replay data into client-deliverable frames,
 * - coordinate fanout to one or many sessions,
 * - and keep replay orchestration out of generic gateway code.
 *
 * Preserved donor truths
 * ---------------------
 * - Existing websocket files in pzo-server/src/ws are still thin and generic.
 * - Existing frontend chat donor files already separate socket transport and
 *   typing from UI render code.
 * - Backend chat replay will live under backend/src/game/engine/chat/replay and
 *   remain the authority. This file only brokers transport.
 *
 * Design laws
 * -----------
 * - Replay service never invents transcript history.
 * - Replay service never mutates transcript history.
 * - Replay service never decides authorization policy beyond transport-facing
 *   request validation and envelope shape.
 * - Replay service may reshape, chunk, cache, and route authoritative replay
 *   snapshots only.
 * - Join hydration, reconnect hydration, audit replay, and manual replay all
 *   share the same canonical request pipeline.
 * ============================================================================
 */

import { createHash, randomUUID } from 'crypto';
import {
  ChatAuthoritativeEnvelope,
  ChatChannelId,
  ChatControlFanoutPayload,
  ChatFanoutPolicy,
  ChatFanoutService,
  ChatReplayFanoutPayload,
  ChatPreparedEmission,
  ChatEmissionResult,
  createChatControlEnvelope,
  createChatReplayEnvelope,
} from './ChatFanoutService';

export type ChatReplayHydrationMode =
  | 'JOIN'
  | 'RESUME'
  | 'AUDIT'
  | 'MANUAL'
  | 'POST_RUN'
  | 'INVASION_REVIEW';

export type ChatReplayWindowAnchorKind =
  | 'TAIL'
  | 'MESSAGE_ID'
  | 'SEQUENCE'
  | 'EVENT_ID'
  | 'TIMESTAMP'
  | 'TURNING_POINT'
  | 'INVASION_START'
  | 'HELPER_INTERVENTION'
  | 'CHANNEL_BOUNDARY';

export type ChatReplayCompressionMode =
  | 'NONE'
  | 'BODY_ONLY'
  | 'BODY_AND_META'
  | 'CHUNK_HASH_ONLY';

export type ChatReplayExcerptKind =
  | 'TRANSCRIPT_RANGE'
  | 'SCENE'
  | 'INCURSION'
  | 'HELPER_SEQUENCE'
  | 'HATER_SEQUENCE'
  | 'DEAL_ROOM_WINDOW'
  | 'AUDIT_PROOF_WINDOW'
  | 'POST_RUN_SUMMARY';

export type ChatReplayRequestDisposition =
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CACHE_HIT'
  | 'INFLIGHT_JOIN'
  | 'TIMEOUT'
  | 'FAILED';

export interface ChatReplayMessageFrame {
  readonly messageId: string;
  readonly channelId: ChatChannelId;
  readonly sequence: number;
  readonly body: string;
  readonly renderedBody?: string;
  readonly senderSessionId?: string;
  readonly senderPlayerId?: string;
  readonly senderUsername?: string;
  readonly senderRole?: string;
  readonly sourcePersonaId?: string;
  readonly proofHash?: string;
  readonly moderationState?: 'ALLOWED' | 'MASKED' | 'SHADOWED' | 'REDACTED';
  readonly createdAtMs: number;
  readonly causalParentIds?: readonly string[];
  readonly tags?: readonly string[];
  readonly badges?: readonly string[];
}

export interface ChatReplayEventFrame {
  readonly eventId: string;
  readonly type: string;
  readonly channelId?: ChatChannelId;
  readonly sequence?: number;
  readonly timestampMs: number;
  readonly payload?: unknown;
  readonly proofHash?: string;
}

export interface ChatReplayCursor {
  readonly roomId: string;
  readonly channelId?: ChatChannelId;
  readonly lastSequence?: number;
  readonly lastMessageId?: string;
  readonly lastEventId?: string;
  readonly lastTimestampMs?: number;
  readonly opaque?: string;
}

export interface ChatReplayWindowAnchor {
  readonly kind: ChatReplayWindowAnchorKind;
  readonly value?: string | number;
  readonly roomId: string;
  readonly channelId?: ChatChannelId;
}

export interface ChatReplayQuery {
  readonly requestId: string;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly roomId: string;
  readonly channelIds?: readonly ChatChannelId[];
  readonly anchor: ChatReplayWindowAnchor;
  readonly beforeCount: number;
  readonly afterCount: number;
  readonly includeMessages: boolean;
  readonly includeEvents: boolean;
  readonly includeProof: boolean;
  readonly includeRedacted: boolean;
  readonly includeShadow: boolean;
  readonly excerptKind?: ChatReplayExcerptKind;
  readonly requestingSessionId: string;
  readonly targetSessionIds: readonly string[];
  readonly correlationId?: string;
}

export interface ChatReplaySnapshot {
  readonly replayId: string;
  readonly roomId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly cursor: ChatReplayCursor;
  readonly messages: readonly ChatReplayMessageFrame[];
  readonly events: readonly ChatReplayEventFrame[];
  readonly proof?: unknown;
  readonly fetchedAtMs: number;
  readonly authoritativeSequenceHighWater: number;
  readonly chunkHintSize?: number;
}

export interface ChatReplayChunk {
  readonly requestId: string;
  readonly replayId: string;
  readonly roomId: string;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly chunkIndex: number;
  readonly totalChunks: number;
  readonly messages: readonly ChatReplayMessageFrame[];
  readonly events: readonly ChatReplayEventFrame[];
  readonly proof?: unknown;
  readonly isFinalChunk: boolean;
  readonly replayCursor: ChatReplayCursor;
  readonly compressionMode: ChatReplayCompressionMode;
  readonly chunkHash: string;
}

export interface ChatReplayBridgeRequest {
  readonly requestId: string;
  readonly roomId: string;
  readonly channelIds?: readonly ChatChannelId[];
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly anchor: ChatReplayWindowAnchor;
  readonly beforeCount: number;
  readonly afterCount: number;
  readonly includeMessages: boolean;
  readonly includeEvents: boolean;
  readonly includeProof: boolean;
  readonly includeRedacted: boolean;
  readonly includeShadow: boolean;
  readonly excerptKind?: ChatReplayExcerptKind;
  readonly correlationId?: string;
}

export interface ChatReplayBridgeAdapter {
  fetchReplay(request: ChatReplayBridgeRequest): Promise<ChatReplaySnapshot>;
}

export interface ChatReplayCacheRecord {
  readonly cacheKey: string;
  readonly snapshot: ChatReplaySnapshot;
  readonly createdAtMs: number;
  readonly expiresAtMs: number;
}

export interface ChatReplayInflightRecord {
  readonly cacheKey: string;
  readonly requestId: string;
  readonly startedAtMs: number;
  readonly promise: Promise<ChatReplaySnapshot>;
}

export interface ChatReplayMetricsAdapter {
  increment(metric: string, value?: number, tags?: Record<string, string | number | boolean>): void;
  observe(metric: string, value: number, tags?: Record<string, string | number | boolean>): void;
}

export interface ChatReplayLoggerAdapter {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface ChatReplayServiceConfig {
  readonly defaultBeforeCount: number;
  readonly defaultAfterCount: number;
  readonly maxBeforeCount: number;
  readonly maxAfterCount: number;
  readonly defaultChunkMessageSize: number;
  readonly maxChunkMessageSize: number;
  readonly cacheTtlMs: number;
  readonly maxCacheEntries: number;
  readonly inflightTtlMs: number;
  readonly replayTimeoutMs: number;
  readonly allowShadowHydrationByDefault: boolean;
  readonly emitControlFrames: boolean;
}

export interface ChatReplayRequestResult {
  readonly requestId: string;
  readonly disposition: ChatReplayRequestDisposition;
  readonly cacheKey: string;
  readonly snapshot?: ChatReplaySnapshot;
  readonly chunks?: readonly ChatReplayChunk[];
  readonly emissions?: readonly ChatEmissionResult[];
  readonly controlEmission?: ChatEmissionResult;
  readonly errorCode?: string;
  readonly errorMessage?: string;
}

export const DEFAULT_CHAT_REPLAY_SERVICE_CONFIG: ChatReplayServiceConfig = {
  defaultBeforeCount: 30,
  defaultAfterCount: 10,
  maxBeforeCount: 300,
  maxAfterCount: 120,
  defaultChunkMessageSize: 40,
  maxChunkMessageSize: 120,
  cacheTtlMs: 45_000,
  maxCacheEntries: 2_500,
  inflightTtlMs: 15_000,
  replayTimeoutMs: 12_000,
  allowShadowHydrationByDefault: false,
  emitControlFrames: true,
};

function createNoopReplayMetrics(): ChatReplayMetricsAdapter {
  return {
    increment: () => undefined,
    observe: () => undefined,
  };
}

function createNoopReplayLogger(): ChatReplayLoggerAdapter {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

function nowMs(): number {
  return Date.now();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hashJson(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
}

function sliceIntoBatches<T>(items: readonly T[], size: number): T[][] {
  const partitions: T[][] = [];
  if (size <= 0) {
    return partitions;
  }
  for (let index = 0; index < items.length; index += size) {
    partitions.push(items.slice(index, index + size));
  }
  return partitions;
}

export class ChatReplayService {
  private readonly config: ChatReplayServiceConfig;
  private readonly replayBridge: ChatReplayBridgeAdapter;
  private readonly fanout: ChatFanoutService;
  private readonly metrics: ChatReplayMetricsAdapter;
  private readonly logger: ChatReplayLoggerAdapter;
  private readonly cache = new Map<string, ChatReplayCacheRecord>();
  private readonly inflight = new Map<string, ChatReplayInflightRecord>();

  public constructor(deps: {
    config?: Partial<ChatReplayServiceConfig>;
    replayBridge: ChatReplayBridgeAdapter;
    fanout: ChatFanoutService;
    metrics?: ChatReplayMetricsAdapter;
    logger?: ChatReplayLoggerAdapter;
  }) {
    this.config = {
      ...DEFAULT_CHAT_REPLAY_SERVICE_CONFIG,
      ...(deps.config ?? {}),
    };
    this.replayBridge = deps.replayBridge;
    this.fanout = deps.fanout;
    this.metrics = deps.metrics ?? createNoopReplayMetrics();
    this.logger = deps.logger ?? createNoopReplayLogger();
  }

  public async requestReplay(query: ChatReplayQuery): Promise<ChatReplayRequestResult> {
    const startedAtMs = nowMs();
    this.sweep();

    const normalized = this.normalizeQuery(query);
    const cacheKey = this.buildCacheKey(normalized);

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAtMs > nowMs()) {
      this.metrics.increment('chat_replay_cache_hit_total', 1, {
        hydrationMode: normalized.hydrationMode,
        roomId: normalized.roomId,
      });
      const chunks = this.chunkSnapshot(normalized, cached.snapshot);
      const emissions = await this.emitChunks(normalized, chunks);
      const controlEmission = this.config.emitControlFrames
        ? await this.emitReplayReadyControl(normalized, cached.snapshot, 'CACHE_HIT')
        : undefined;

      this.metrics.observe('chat_replay_request_duration_ms', nowMs() - startedAtMs, {
        hydrationMode: normalized.hydrationMode,
        disposition: 'CACHE_HIT',
      });

      return {
        requestId: normalized.requestId,
        disposition: 'CACHE_HIT',
        cacheKey,
        snapshot: cached.snapshot,
        chunks,
        emissions,
        controlEmission,
      };
    }

    const inflight = this.inflight.get(cacheKey);
    if (inflight && (nowMs() - inflight.startedAtMs) < this.config.inflightTtlMs) {
      try {
        const snapshot = await Promise.race([
          inflight.promise,
          this.timeoutSnapshot(cacheKey),
        ]);
        const chunks = this.chunkSnapshot(normalized, snapshot);
        const emissions = await this.emitChunks(normalized, chunks);
        const controlEmission = this.config.emitControlFrames
          ? await this.emitReplayReadyControl(normalized, snapshot, 'INFLIGHT_JOIN')
          : undefined;

        this.metrics.increment('chat_replay_inflight_join_total', 1, {
          hydrationMode: normalized.hydrationMode,
          roomId: normalized.roomId,
        });

        return {
          requestId: normalized.requestId,
          disposition: 'INFLIGHT_JOIN',
          cacheKey,
          snapshot,
          chunks,
          emissions,
          controlEmission,
        };
      } catch (error) {
        return this.failRequest(normalized, cacheKey, 'INFLIGHT_TIMEOUT', error, startedAtMs);
      }
    }

    const promise = this.replayBridge.fetchReplay(this.toBridgeRequest(normalized));
    this.inflight.set(cacheKey, {
      cacheKey,
      requestId: normalized.requestId,
      startedAtMs: nowMs(),
      promise,
    });

    try {
      const snapshot = await Promise.race([
        promise,
        this.timeoutSnapshot(cacheKey),
      ]);

      this.inflight.delete(cacheKey);
      this.insertCache(cacheKey, snapshot);

      const chunks = this.chunkSnapshot(normalized, snapshot);
      const emissions = await this.emitChunks(normalized, chunks);
      const controlEmission = this.config.emitControlFrames
        ? await this.emitReplayReadyControl(normalized, snapshot, 'ACCEPTED')
        : undefined;

      this.metrics.increment('chat_replay_accepted_total', 1, {
        hydrationMode: normalized.hydrationMode,
        roomId: normalized.roomId,
        excerptKind: snapshot.excerptKind,
      });

      this.metrics.observe('chat_replay_request_duration_ms', nowMs() - startedAtMs, {
        hydrationMode: normalized.hydrationMode,
        disposition: 'ACCEPTED',
      });

      this.logger.info('Resolved chat replay request', {
        requestId: normalized.requestId,
        roomId: normalized.roomId,
        hydrationMode: normalized.hydrationMode,
        chunkCount: chunks.length,
      });

      return {
        requestId: normalized.requestId,
        disposition: 'ACCEPTED',
        cacheKey,
        snapshot,
        chunks,
        emissions,
        controlEmission,
      };
    } catch (error) {
      this.inflight.delete(cacheKey);
      return this.failRequest(normalized, cacheKey, 'FETCH_FAILED', error, startedAtMs);
    }
  }

  public getCacheRecords(): readonly ChatReplayCacheRecord[] {
    return Array.from(this.cache.values()).sort((left, right) => left.createdAtMs - right.createdAtMs);
  }

  public clearCache(): void {
    const removed = this.cache.size;
    this.cache.clear();
    if (removed > 0) {
      this.logger.warn('Cleared chat replay cache', { removed });
    }
  }

  public clearInflight(): void {
    const removed = this.inflight.size;
    this.inflight.clear();
    if (removed > 0) {
      this.logger.warn('Cleared chat replay inflight registry', { removed });
    }
  }

  public normalizeQuery(query: ChatReplayQuery): ChatReplayQuery {
    return {
      ...query,
      requestId: query.requestId || randomUUID(),
      beforeCount: clamp(query.beforeCount || this.config.defaultBeforeCount, 0, this.config.maxBeforeCount),
      afterCount: clamp(query.afterCount || this.config.defaultAfterCount, 0, this.config.maxAfterCount),
      includeMessages: query.includeMessages ?? true,
      includeEvents: query.includeEvents ?? true,
      includeProof: query.includeProof ?? false,
      includeRedacted: query.includeRedacted ?? false,
      includeShadow: query.includeShadow ?? this.config.allowShadowHydrationByDefault,
      targetSessionIds: query.targetSessionIds && query.targetSessionIds.length > 0
        ? query.targetSessionIds
        : [query.requestingSessionId],
    };
  }

  public buildCacheKey(query: ChatReplayQuery): string {
    return hashJson({
      roomId: query.roomId,
      channelIds: query.channelIds,
      hydrationMode: query.hydrationMode,
      anchor: query.anchor,
      beforeCount: query.beforeCount,
      afterCount: query.afterCount,
      includeMessages: query.includeMessages,
      includeEvents: query.includeEvents,
      includeProof: query.includeProof,
      includeRedacted: query.includeRedacted,
      includeShadow: query.includeShadow,
      excerptKind: query.excerptKind,
    });
  }

  public toBridgeRequest(query: ChatReplayQuery): ChatReplayBridgeRequest {
    return {
      requestId: query.requestId,
      roomId: query.roomId,
      channelIds: query.channelIds,
      hydrationMode: query.hydrationMode,
      anchor: query.anchor,
      beforeCount: query.beforeCount,
      afterCount: query.afterCount,
      includeMessages: query.includeMessages,
      includeEvents: query.includeEvents,
      includeProof: query.includeProof,
      includeRedacted: query.includeRedacted,
      includeShadow: query.includeShadow,
      excerptKind: query.excerptKind,
      correlationId: query.correlationId,
    };
  }

  public chunkSnapshot(query: ChatReplayQuery, snapshot: ChatReplaySnapshot): readonly ChatReplayChunk[] {
    const targetChunkSize = clamp(
      snapshot.chunkHintSize ?? this.config.defaultChunkMessageSize,
      1,
      this.config.maxChunkMessageSize,
    );

    const messageBatches = sliceIntoBatches(snapshot.messages, targetChunkSize);
    const eventBatches = sliceIntoBatches(snapshot.events, targetChunkSize);

    const chunkCount = Math.max(messageBatches.length, eventBatches.length, 1);
    const chunks: ChatReplayChunk[] = [];

    for (let index = 0; index < chunkCount; index += 1) {
      const messages = messageBatches[index] ?? [];
      const events = eventBatches[index] ?? [];
      const isFinalChunk = index === chunkCount - 1;
      const compressionMode = this.resolveCompressionMode(query, messages, events, isFinalChunk);
      const chunk: ChatReplayChunk = {
        requestId: query.requestId,
        replayId: snapshot.replayId,
        roomId: snapshot.roomId,
        hydrationMode: snapshot.hydrationMode,
        chunkIndex: index,
        totalChunks: chunkCount,
        messages,
        events,
        proof: isFinalChunk ? snapshot.proof : undefined,
        isFinalChunk,
        replayCursor: snapshot.cursor,
        compressionMode,
        chunkHash: hashJson({
          replayId: snapshot.replayId,
          chunkIndex: index,
          messageIds: messages.map((item) => item.messageId),
          eventIds: events.map((item) => item.eventId),
          compressionMode,
        }),
      };
      chunks.push(chunk);
    }

    return chunks;
  }

  public resolveCompressionMode(
    query: ChatReplayQuery,
    messages: readonly ChatReplayMessageFrame[],
    events: readonly ChatReplayEventFrame[],
    isFinalChunk: boolean,
  ): ChatReplayCompressionMode {
    if (query.includeProof && isFinalChunk) {
      return 'BODY_AND_META';
    }
    if (messages.length > 0 || events.length > 0) {
      return 'BODY_ONLY';
    }
    return 'CHUNK_HASH_ONLY';
  }

  public async emitChunks(
    query: ChatReplayQuery,
    chunks: readonly ChatReplayChunk[],
  ): Promise<readonly ChatEmissionResult[]> {
    const results: ChatEmissionResult[] = [];

    for (const chunk of chunks) {
      const payload: ChatReplayFanoutPayload = {
        requestId: chunk.requestId,
        replayId: chunk.replayId,
        chunkIndex: chunk.chunkIndex,
        totalChunks: chunk.totalChunks,
        isFinalChunk: chunk.isFinalChunk,
        hydrationMode: chunk.hydrationMode,
        excerpt: {
          roomId: chunk.roomId,
          messages: chunk.messages,
          events: chunk.events,
          proof: chunk.proof,
          compressionMode: chunk.compressionMode,
          chunkHash: chunk.chunkHash,
        },
        replayCursor: chunk.replayCursor.opaque ?? this.serializeCursor(chunk.replayCursor),
      };

      const envelope: ChatAuthoritativeEnvelope<ChatReplayFanoutPayload> = createChatReplayEnvelope({
        authoritativeSequence: 0,
        roomId: query.roomId,
        channelId: this.resolveReplayChannel(query),
        payload,
        correlationId: query.correlationId,
        visibility: 'TARGET_ONLY',
        meta: {
          excerptKind: query.excerptKind,
          anchorKind: query.anchor.kind,
        },
      });

      const emission = this.fanout.prepareTargetedReplay(
        query.roomId,
        this.resolveReplayChannel(query),
        envelope,
        query.targetSessionIds,
        {
          batchSize: 32,
          maxRetryCount: 2,
          retryBackoffMs: 100,
          retainOutboxMs: 120_000,
        },
      );

      results.push(await this.fanout.emitPrepared(emission));
    }

    return results;
  }

  public async emitReplayReadyControl(
    query: ChatReplayQuery,
    snapshot: ChatReplaySnapshot,
    code: 'ACCEPTED' | 'CACHE_HIT' | 'INFLIGHT_JOIN',
  ): Promise<ChatEmissionResult> {
    const payload: ChatControlFanoutPayload = {
      code: 'REPLAY_READY',
      message: code === 'CACHE_HIT'
        ? 'Replay hydrated from server cache.'
        : code === 'INFLIGHT_JOIN'
          ? 'Replay joined active server fetch.'
          : 'Replay hydrated from backend authority.',
      details: {
        requestId: query.requestId,
        replayId: snapshot.replayId,
        roomId: snapshot.roomId,
        chunkHintSize: snapshot.chunkHintSize,
        excerptKind: snapshot.excerptKind,
      },
    };

    const envelope = createChatControlEnvelope({
      authoritativeSequence: 0,
      roomId: query.roomId,
      channelId: this.resolveReplayChannel(query),
      payload,
      correlationId: query.correlationId,
      visibility: 'TARGET_ONLY',
    });

    const emission = this.fanout.prepareTargetedControl(
      query.roomId,
      this.resolveReplayChannel(query),
      envelope,
      query.targetSessionIds,
      {
        batchSize: 32,
        maxRetryCount: 1,
        retryBackoffMs: 50,
        retainOutboxMs: 60_000,
      },
    );

    return this.fanout.emitPrepared(emission);
  }

  public async emitReplayErrorControl(
    query: ChatReplayQuery,
    code: string,
    errorMessage: string,
  ): Promise<ChatEmissionResult | undefined> {
    if (!this.config.emitControlFrames) {
      return undefined;
    }

    const payload: ChatControlFanoutPayload = {
      code: 'REPLAY_REJECTED',
      message: errorMessage,
      details: {
        requestId: query.requestId,
        roomId: query.roomId,
        code,
      },
    };

    const envelope = createChatControlEnvelope({
      authoritativeSequence: 0,
      roomId: query.roomId,
      channelId: this.resolveReplayChannel(query),
      payload,
      correlationId: query.correlationId,
      visibility: 'TARGET_ONLY',
    });

    const emission = this.fanout.prepareTargetedControl(
      query.roomId,
      this.resolveReplayChannel(query),
      envelope,
      query.targetSessionIds,
      {
        batchSize: 32,
        maxRetryCount: 0,
        retryBackoffMs: 0,
        retainOutboxMs: 60_000,
      },
    );

    return this.fanout.emitPrepared(emission);
  }

  public serializeCursor(cursor: ChatReplayCursor): string {
    return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
  }

  public deserializeCursor(value?: string): ChatReplayCursor | undefined {
    if (!value) {
      return undefined;
    }
    try {
      const decoded = Buffer.from(value, 'base64url').toString('utf8');
      return JSON.parse(decoded) as ChatReplayCursor;
    } catch {
      return undefined;
    }
  }

  public resolveReplayChannel(query: ChatReplayQuery): ChatChannelId {
    if (query.channelIds && query.channelIds.length === 1) {
      return query.channelIds[0];
    }
    return 'GLOBAL';
  }

  private insertCache(cacheKey: string, snapshot: ChatReplaySnapshot): void {
    const createdAtMs = nowMs();
    this.cache.set(cacheKey, {
      cacheKey,
      snapshot,
      createdAtMs,
      expiresAtMs: createdAtMs + this.config.cacheTtlMs,
    });

    if (this.cache.size > this.config.maxCacheEntries) {
      const oldest = Array.from(this.cache.values()).sort((left, right) => left.createdAtMs - right.createdAtMs)[0];
      if (oldest) {
        this.cache.delete(oldest.cacheKey);
      }
    }
  }

  private async timeoutSnapshot(cacheKey: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Replay request timed out for cache key ${cacheKey}`));
      }, this.config.replayTimeoutMs);
    });
  }

  private failRequest(
    query: ChatReplayQuery,
    cacheKey: string,
    code: string,
    error: unknown,
    startedAtMs: number,
  ): ChatReplayRequestResult {
    const errorMessage = error instanceof Error ? error.message : String(error);

    this.metrics.increment('chat_replay_failed_total', 1, {
      hydrationMode: query.hydrationMode,
      roomId: query.roomId,
      code,
    });

    this.metrics.observe('chat_replay_request_duration_ms', nowMs() - startedAtMs, {
      hydrationMode: query.hydrationMode,
      disposition: 'FAILED',
    });

    void this.emitReplayErrorControl(query, code, errorMessage);

    this.logger.warn('Chat replay request failed', {
      requestId: query.requestId,
      roomId: query.roomId,
      hydrationMode: query.hydrationMode,
      code,
      errorMessage,
    });

    return {
      requestId: query.requestId,
      disposition: code === 'TIMEOUT' ? 'TIMEOUT' : 'FAILED',
      cacheKey,
      errorCode: code,
      errorMessage,
    };
  }

  private sweep(): void {
    const now = nowMs();
    for (const [key, record] of this.cache.entries()) {
      if (record.expiresAtMs <= now) {
        this.cache.delete(key);
      }
    }
    for (const [key, inflight] of this.inflight.entries()) {
      if ((now - inflight.startedAtMs) > this.config.inflightTtlMs) {
        this.inflight.delete(key);
      }
    }
  }
}

export interface ChatReplayScenarioPreset1 {
  readonly ordinal: 1;
  readonly hydrationMode: 'JOIN';
  readonly beforeCount: number;
  readonly afterCount: number;
  readonly includeMessages: boolean;
  readonly includeEvents: boolean;
  readonly includeProof: boolean;
  readonly includeRedacted: boolean;
  readonly includeShadow: boolean;
}

export function createReplayScenarioPreset1(): ChatReplayScenarioPreset1 {
  return {
    ordinal: 1,
    hydrationMode: 'JOIN',
    beforeCount: 35,
    afterCount: 11,
    includeMessages: true,
    includeEvents: true,
    includeProof: false,
    includeRedacted: false,
    includeShadow: false,
  };
}

export function createReplayQueryFromPreset1(input: {
  roomId: string;
  requestingSessionId: string;
  targetSessionIds?: readonly string[];
  channelIds?: readonly ChatChannelId[];
  anchor: ChatReplayWindowAnchor;
  correlationId?: string;
}): ChatReplayQuery {
  const preset = createReplayScenarioPreset1();
  return {
    requestId: randomUUID(),
    hydrationMode: preset.hydrationMode,
    roomId: input.roomId,
    channelIds: input.channelIds,
    anchor: input.anchor,
    beforeCount: preset.beforeCount,
    afterCount: preset.afterCount,
    includeMessages: preset.includeMessages,
    includeEvents: preset.includeEvents,
    includeProof: preset.includeProof,
    includeRedacted: preset.includeRedacted,
    includeShadow: preset.includeShadow,
    excerptKind: 'TRANSCRIPT_RANGE',
    requestingSessionId: input.requestingSessionId,
    targetSessionIds: input.targetSessionIds ?? [input.requestingSessionId],
    correlationId: input.correlationId,
  };
}


export interface ChatReplayScenarioPreset2 {
  readonly ordinal: 2;
  readonly hydrationMode: 'RESUME';
  readonly beforeCount: number;
  readonly afterCount: number;
  readonly includeMessages: boolean;
  readonly includeEvents: boolean;
  readonly includeProof: boolean;
  readonly includeRedacted: boolean;
  readonly includeShadow: boolean;
}

export function createReplayScenarioPreset2(): ChatReplayScenarioPreset2 {
  return {
    ordinal: 2,
    hydrationMode: 'RESUME',
    beforeCount: 40,
    afterCount: 12,
    includeMessages: true,
    includeEvents: true,
    includeProof: false,
    includeRedacted: false,
    includeShadow: false,
  };
}

export function createReplayQueryFromPreset2(input: {
  roomId: string;
  requestingSessionId: string;
  targetSessionIds?: readonly string[];
  channelIds?: readonly ChatChannelId[];
  anchor: ChatReplayWindowAnchor;
  correlationId?: string;
}): ChatReplayQuery {
  const preset = createReplayScenarioPreset2();
  return {
    requestId: randomUUID(),
    hydrationMode: preset.hydrationMode,
    roomId: input.roomId,
    channelIds: input.channelIds,
    anchor: input.anchor,
    beforeCount: preset.beforeCount,
    afterCount: preset.afterCount,
    includeMessages: preset.includeMessages,
    includeEvents: preset.includeEvents,
    includeProof: preset.includeProof,
    includeRedacted: preset.includeRedacted,
    includeShadow: preset.includeShadow,
    excerptKind: 'TRANSCRIPT_RANGE',
    requestingSessionId: input.requestingSessionId,
    targetSessionIds: input.targetSessionIds ?? [input.requestingSessionId],
    correlationId: input.correlationId,
  };
}


export interface ChatReplayScenarioPreset3 {
  readonly ordinal: 3;
  readonly hydrationMode: 'AUDIT';
  readonly beforeCount: number;
  readonly afterCount: number;
  readonly includeMessages: boolean;
  readonly includeEvents: boolean;
  readonly includeProof: boolean;
  readonly includeRedacted: boolean;
  readonly includeShadow: boolean;
}

export function createReplayScenarioPreset3(): ChatReplayScenarioPreset3 {
  return {
    ordinal: 3,
    hydrationMode: 'AUDIT',
    beforeCount: 45,
    afterCount: 13,
    includeMessages: true,
    includeEvents: true,
    includeProof: true,
    includeRedacted: true,
    includeShadow: true,
  };
}

export function createReplayQueryFromPreset3(input: {
  roomId: string;
  requestingSessionId: string;
  targetSessionIds?: readonly string[];
  channelIds?: readonly ChatChannelId[];
  anchor: ChatReplayWindowAnchor;
  correlationId?: string;
}): ChatReplayQuery {
  const preset = createReplayScenarioPreset3();
  return {
    requestId: randomUUID(),
    hydrationMode: preset.hydrationMode,
    roomId: input.roomId,
    channelIds: input.channelIds,
    anchor: input.anchor,
    beforeCount: preset.beforeCount,
    afterCount: preset.afterCount,
    includeMessages: preset.includeMessages,
    includeEvents: preset.includeEvents,
    includeProof: preset.includeProof,
    includeRedacted: preset.includeRedacted,
    includeShadow: preset.includeShadow,
    excerptKind: 'TRANSCRIPT_RANGE',
    requestingSessionId: input.requestingSessionId,
    targetSessionIds: input.targetSessionIds ?? [input.requestingSessionId],
    correlationId: input.correlationId,
  };
}


export interface ChatReplayScenarioPreset4 {
  readonly ordinal: 4;
  readonly hydrationMode: 'MANUAL';
  readonly beforeCount: number;
  readonly afterCount: number;
  readonly includeMessages: boolean;
  readonly includeEvents: boolean;
  readonly includeProof: boolean;
  readonly includeRedacted: boolean;
  readonly includeShadow: boolean;
}

export function createReplayScenarioPreset4(): ChatReplayScenarioPreset4 {
  return {
    ordinal: 4,
    hydrationMode: 'MANUAL',
    beforeCount: 50,
    afterCount: 14,
    includeMessages: true,
    includeEvents: true,
    includeProof: false,
    includeRedacted: false,
    includeShadow: false,
  };
}

export function createReplayQueryFromPreset4(input: {
  roomId: string;
  requestingSessionId: string;
  targetSessionIds?: readonly string[];
  channelIds?: readonly ChatChannelId[];
  anchor: ChatReplayWindowAnchor;
  correlationId?: string;
}): ChatReplayQuery {
  const preset = createReplayScenarioPreset4();
  return {
    requestId: randomUUID(),
    hydrationMode: preset.hydrationMode,
    roomId: input.roomId,
    channelIds: input.channelIds,
    anchor: input.anchor,
    beforeCount: preset.beforeCount,
    afterCount: preset.afterCount,
    includeMessages: preset.includeMessages,
    includeEvents: preset.includeEvents,
    includeProof: preset.includeProof,
    includeRedacted: preset.includeRedacted,
    includeShadow: preset.includeShadow,
    excerptKind: 'TRANSCRIPT_RANGE',
    requestingSessionId: input.requestingSessionId,
    targetSessionIds: input.targetSessionIds ?? [input.requestingSessionId],
    correlationId: input.correlationId,
  };
}


export interface ChatReplayScenarioPreset5 {
  readonly ordinal: 5;
  readonly hydrationMode: 'POST_RUN';
  readonly beforeCount: number;
  readonly afterCount: number;
  readonly includeMessages: boolean;
  readonly includeEvents: boolean;
  readonly includeProof: boolean;
  readonly includeRedacted: boolean;
  readonly includeShadow: boolean;
}

export function createReplayScenarioPreset5(): ChatReplayScenarioPreset5 {
  return {
    ordinal: 5,
    hydrationMode: 'POST_RUN',
    beforeCount: 55,
    afterCount: 15,
    includeMessages: true,
    includeEvents: true,
    includeProof: true,
    includeRedacted: false,
    includeShadow: false,
  };
}

export function createReplayQueryFromPreset5(input: {
  roomId: string;
  requestingSessionId: string;
  targetSessionIds?: readonly string[];
  channelIds?: readonly ChatChannelId[];
  anchor: ChatReplayWindowAnchor;
  correlationId?: string;
}): ChatReplayQuery {
  const preset = createReplayScenarioPreset5();
  return {
    requestId: randomUUID(),
    hydrationMode: preset.hydrationMode,
    roomId: input.roomId,
    channelIds: input.channelIds,
    anchor: input.anchor,
    beforeCount: preset.beforeCount,
    afterCount: preset.afterCount,
    includeMessages: preset.includeMessages,
    includeEvents: preset.includeEvents,
    includeProof: preset.includeProof,
    includeRedacted: preset.includeRedacted,
    includeShadow: preset.includeShadow,
    excerptKind: 'TRANSCRIPT_RANGE',
    requestingSessionId: input.requestingSessionId,
    targetSessionIds: input.targetSessionIds ?? [input.requestingSessionId],
    correlationId: input.correlationId,
  };
}


export interface ChatReplayScenarioPreset6 {
  readonly ordinal: 6;
  readonly hydrationMode: 'INVASION_REVIEW';
  readonly beforeCount: number;
  readonly afterCount: number;
  readonly includeMessages: boolean;
  readonly includeEvents: boolean;
  readonly includeProof: boolean;
  readonly includeRedacted: boolean;
  readonly includeShadow: boolean;
}

export function createReplayScenarioPreset6(): ChatReplayScenarioPreset6 {
  return {
    ordinal: 6,
    hydrationMode: 'INVASION_REVIEW',
    beforeCount: 60,
    afterCount: 16,
    includeMessages: true,
    includeEvents: true,
    includeProof: false,
    includeRedacted: false,
    includeShadow: true,
  };
}

export function createReplayQueryFromPreset6(input: {
  roomId: string;
  requestingSessionId: string;
  targetSessionIds?: readonly string[];
  channelIds?: readonly ChatChannelId[];
  anchor: ChatReplayWindowAnchor;
  correlationId?: string;
}): ChatReplayQuery {
  const preset = createReplayScenarioPreset6();
  return {
    requestId: randomUUID(),
    hydrationMode: preset.hydrationMode,
    roomId: input.roomId,
    channelIds: input.channelIds,
    anchor: input.anchor,
    beforeCount: preset.beforeCount,
    afterCount: preset.afterCount,
    includeMessages: preset.includeMessages,
    includeEvents: preset.includeEvents,
    includeProof: preset.includeProof,
    includeRedacted: preset.includeRedacted,
    includeShadow: preset.includeShadow,
    excerptKind: 'TRANSCRIPT_RANGE',
    requestingSessionId: input.requestingSessionId,
    targetSessionIds: input.targetSessionIds ?? [input.requestingSessionId],
    correlationId: input.correlationId,
  };
}

export interface ChatReplayInspectionRow1 {
  readonly ordinal: 1;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow1(record: ChatReplayCacheRecord): ChatReplayInspectionRow1 {
  return {
    ordinal: 1,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow2 {
  readonly ordinal: 2;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow2(record: ChatReplayCacheRecord): ChatReplayInspectionRow2 {
  return {
    ordinal: 2,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow3 {
  readonly ordinal: 3;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow3(record: ChatReplayCacheRecord): ChatReplayInspectionRow3 {
  return {
    ordinal: 3,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow4 {
  readonly ordinal: 4;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow4(record: ChatReplayCacheRecord): ChatReplayInspectionRow4 {
  return {
    ordinal: 4,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow5 {
  readonly ordinal: 5;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow5(record: ChatReplayCacheRecord): ChatReplayInspectionRow5 {
  return {
    ordinal: 5,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow6 {
  readonly ordinal: 6;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow6(record: ChatReplayCacheRecord): ChatReplayInspectionRow6 {
  return {
    ordinal: 6,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow7 {
  readonly ordinal: 7;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow7(record: ChatReplayCacheRecord): ChatReplayInspectionRow7 {
  return {
    ordinal: 7,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow8 {
  readonly ordinal: 8;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow8(record: ChatReplayCacheRecord): ChatReplayInspectionRow8 {
  return {
    ordinal: 8,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow9 {
  readonly ordinal: 9;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow9(record: ChatReplayCacheRecord): ChatReplayInspectionRow9 {
  return {
    ordinal: 9,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow10 {
  readonly ordinal: 10;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow10(record: ChatReplayCacheRecord): ChatReplayInspectionRow10 {
  return {
    ordinal: 10,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow11 {
  readonly ordinal: 11;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow11(record: ChatReplayCacheRecord): ChatReplayInspectionRow11 {
  return {
    ordinal: 11,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow12 {
  readonly ordinal: 12;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow12(record: ChatReplayCacheRecord): ChatReplayInspectionRow12 {
  return {
    ordinal: 12,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow13 {
  readonly ordinal: 13;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow13(record: ChatReplayCacheRecord): ChatReplayInspectionRow13 {
  return {
    ordinal: 13,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow14 {
  readonly ordinal: 14;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow14(record: ChatReplayCacheRecord): ChatReplayInspectionRow14 {
  return {
    ordinal: 14,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow15 {
  readonly ordinal: 15;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow15(record: ChatReplayCacheRecord): ChatReplayInspectionRow15 {
  return {
    ordinal: 15,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow16 {
  readonly ordinal: 16;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow16(record: ChatReplayCacheRecord): ChatReplayInspectionRow16 {
  return {
    ordinal: 16,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow17 {
  readonly ordinal: 17;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow17(record: ChatReplayCacheRecord): ChatReplayInspectionRow17 {
  return {
    ordinal: 17,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow18 {
  readonly ordinal: 18;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow18(record: ChatReplayCacheRecord): ChatReplayInspectionRow18 {
  return {
    ordinal: 18,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow19 {
  readonly ordinal: 19;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow19(record: ChatReplayCacheRecord): ChatReplayInspectionRow19 {
  return {
    ordinal: 19,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow20 {
  readonly ordinal: 20;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow20(record: ChatReplayCacheRecord): ChatReplayInspectionRow20 {
  return {
    ordinal: 20,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow21 {
  readonly ordinal: 21;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow21(record: ChatReplayCacheRecord): ChatReplayInspectionRow21 {
  return {
    ordinal: 21,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow22 {
  readonly ordinal: 22;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow22(record: ChatReplayCacheRecord): ChatReplayInspectionRow22 {
  return {
    ordinal: 22,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow23 {
  readonly ordinal: 23;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow23(record: ChatReplayCacheRecord): ChatReplayInspectionRow23 {
  return {
    ordinal: 23,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow24 {
  readonly ordinal: 24;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow24(record: ChatReplayCacheRecord): ChatReplayInspectionRow24 {
  return {
    ordinal: 24,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow25 {
  readonly ordinal: 25;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow25(record: ChatReplayCacheRecord): ChatReplayInspectionRow25 {
  return {
    ordinal: 25,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow26 {
  readonly ordinal: 26;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow26(record: ChatReplayCacheRecord): ChatReplayInspectionRow26 {
  return {
    ordinal: 26,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow27 {
  readonly ordinal: 27;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow27(record: ChatReplayCacheRecord): ChatReplayInspectionRow27 {
  return {
    ordinal: 27,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow28 {
  readonly ordinal: 28;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow28(record: ChatReplayCacheRecord): ChatReplayInspectionRow28 {
  return {
    ordinal: 28,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow29 {
  readonly ordinal: 29;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow29(record: ChatReplayCacheRecord): ChatReplayInspectionRow29 {
  return {
    ordinal: 29,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow30 {
  readonly ordinal: 30;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow30(record: ChatReplayCacheRecord): ChatReplayInspectionRow30 {
  return {
    ordinal: 30,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow31 {
  readonly ordinal: 31;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow31(record: ChatReplayCacheRecord): ChatReplayInspectionRow31 {
  return {
    ordinal: 31,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow32 {
  readonly ordinal: 32;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow32(record: ChatReplayCacheRecord): ChatReplayInspectionRow32 {
  return {
    ordinal: 32,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow33 {
  readonly ordinal: 33;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow33(record: ChatReplayCacheRecord): ChatReplayInspectionRow33 {
  return {
    ordinal: 33,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow34 {
  readonly ordinal: 34;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow34(record: ChatReplayCacheRecord): ChatReplayInspectionRow34 {
  return {
    ordinal: 34,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow35 {
  readonly ordinal: 35;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow35(record: ChatReplayCacheRecord): ChatReplayInspectionRow35 {
  return {
    ordinal: 35,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow36 {
  readonly ordinal: 36;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow36(record: ChatReplayCacheRecord): ChatReplayInspectionRow36 {
  return {
    ordinal: 36,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow37 {
  readonly ordinal: 37;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow37(record: ChatReplayCacheRecord): ChatReplayInspectionRow37 {
  return {
    ordinal: 37,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow38 {
  readonly ordinal: 38;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow38(record: ChatReplayCacheRecord): ChatReplayInspectionRow38 {
  return {
    ordinal: 38,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow39 {
  readonly ordinal: 39;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow39(record: ChatReplayCacheRecord): ChatReplayInspectionRow39 {
  return {
    ordinal: 39,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow40 {
  readonly ordinal: 40;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow40(record: ChatReplayCacheRecord): ChatReplayInspectionRow40 {
  return {
    ordinal: 40,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow41 {
  readonly ordinal: 41;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow41(record: ChatReplayCacheRecord): ChatReplayInspectionRow41 {
  return {
    ordinal: 41,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow42 {
  readonly ordinal: 42;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow42(record: ChatReplayCacheRecord): ChatReplayInspectionRow42 {
  return {
    ordinal: 42,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow43 {
  readonly ordinal: 43;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow43(record: ChatReplayCacheRecord): ChatReplayInspectionRow43 {
  return {
    ordinal: 43,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow44 {
  readonly ordinal: 44;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow44(record: ChatReplayCacheRecord): ChatReplayInspectionRow44 {
  return {
    ordinal: 44,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow45 {
  readonly ordinal: 45;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow45(record: ChatReplayCacheRecord): ChatReplayInspectionRow45 {
  return {
    ordinal: 45,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow46 {
  readonly ordinal: 46;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow46(record: ChatReplayCacheRecord): ChatReplayInspectionRow46 {
  return {
    ordinal: 46,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow47 {
  readonly ordinal: 47;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow47(record: ChatReplayCacheRecord): ChatReplayInspectionRow47 {
  return {
    ordinal: 47,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow48 {
  readonly ordinal: 48;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow48(record: ChatReplayCacheRecord): ChatReplayInspectionRow48 {
  return {
    ordinal: 48,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow49 {
  readonly ordinal: 49;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow49(record: ChatReplayCacheRecord): ChatReplayInspectionRow49 {
  return {
    ordinal: 49,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow50 {
  readonly ordinal: 50;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow50(record: ChatReplayCacheRecord): ChatReplayInspectionRow50 {
  return {
    ordinal: 50,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow51 {
  readonly ordinal: 51;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow51(record: ChatReplayCacheRecord): ChatReplayInspectionRow51 {
  return {
    ordinal: 51,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow52 {
  readonly ordinal: 52;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow52(record: ChatReplayCacheRecord): ChatReplayInspectionRow52 {
  return {
    ordinal: 52,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow53 {
  readonly ordinal: 53;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow53(record: ChatReplayCacheRecord): ChatReplayInspectionRow53 {
  return {
    ordinal: 53,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow54 {
  readonly ordinal: 54;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow54(record: ChatReplayCacheRecord): ChatReplayInspectionRow54 {
  return {
    ordinal: 54,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow55 {
  readonly ordinal: 55;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow55(record: ChatReplayCacheRecord): ChatReplayInspectionRow55 {
  return {
    ordinal: 55,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow56 {
  readonly ordinal: 56;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow56(record: ChatReplayCacheRecord): ChatReplayInspectionRow56 {
  return {
    ordinal: 56,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow57 {
  readonly ordinal: 57;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow57(record: ChatReplayCacheRecord): ChatReplayInspectionRow57 {
  return {
    ordinal: 57,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow58 {
  readonly ordinal: 58;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow58(record: ChatReplayCacheRecord): ChatReplayInspectionRow58 {
  return {
    ordinal: 58,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow59 {
  readonly ordinal: 59;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow59(record: ChatReplayCacheRecord): ChatReplayInspectionRow59 {
  return {
    ordinal: 59,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}


export interface ChatReplayInspectionRow60 {
  readonly ordinal: 60;
  readonly cacheKey: string;
  readonly roomId: string;
  readonly replayId: string;
  readonly excerptKind: ChatReplayExcerptKind;
  readonly hydrationMode: ChatReplayHydrationMode;
  readonly messageCount: number;
  readonly eventCount: number;
  readonly authoritativeSequenceHighWater: number;
}

export function createReplayInspectionRow60(record: ChatReplayCacheRecord): ChatReplayInspectionRow60 {
  return {
    ordinal: 60,
    cacheKey: record.cacheKey,
    roomId: record.snapshot.roomId,
    replayId: record.snapshot.replayId,
    excerptKind: record.snapshot.excerptKind,
    hydrationMode: record.snapshot.hydrationMode,
    messageCount: record.snapshot.messages.length,
    eventCount: record.snapshot.events.length,
    authoritativeSequenceHighWater: record.snapshot.authoritativeSequenceHighWater,
  };
}
