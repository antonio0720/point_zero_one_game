
/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ENGINE SOCKET CLIENT
 * FILE: pzo-web/src/engines/chat/ChatSocketClient.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical frontend transport authority for chat runtime I/O.
 *
 * This file deliberately replaces the socket ownership that currently lives
 * inside pzo-web/src/components/chat/useChatEngine.ts and lifts it into the
 * frontend chat engine lane without flattening repo-specific behavior.
 *
 * Preserved repo truths
 * ---------------------
 * - Transport uses socket.io-client with token auth.
 * - Existing client emits:
 *   - run:start
 *   - chat:send
 *   - game:event
 * - Existing client listens to:
 *   - chat:message
 *   - hater:sabotage
 * - Existing client supports websocket + polling transport fallback.
 * - Existing client reconnects with bounded retry behavior.
 * - Existing client is client-windowed while backend/server own transcript truth.
 *
 * Design laws
 * -----------
 * - UI never owns socket orchestration.
 * - Components never emit raw socket events directly.
 * - Room attachment, outbox buffering, dedup, heartbeat, and replay hydration
 *   happen here, not in render code.
 * - Client may be optimistic, but backend remains authoritative.
 * - This file is self-contained today so it can land before canonical
 *   shared/contracts/chat and pzo-web/src/engines/chat/types.ts are fully built.
 *
 * Migration note
 * --------------
 * Once shared/contracts/chat is live, the local compatibility contracts in this
 * file should be replaced by imports from:
 *   /shared/contracts/chat
 *   /shared/contracts/chat/learning
 *
 * Density6 LLC · Point Zero One · Production-first architecture
 */


export type ChatChannel = 'GLOBAL' | 'SYNDICATE' | 'DEAL_ROOM' | 'LOBBY';

export type ChatSocketInboundEvent =
  | 'chat:message'
  | 'chat:message:batch'
  | 'chat:replay'
  | 'chat:presence'
  | 'chat:presence:delta'
  | 'chat:typing'
  | 'chat:receipt'
  | 'chat:channel:snapshot'
  | 'chat:channel:joined'
  | 'chat:channel:left'
  | 'chat:notification'
  | 'chat:moderation'
  | 'chat:invasion'
  | 'chat:system'
  | 'chat:metrics'
  | 'chat:ack'
  | 'chat:error'
  | 'hater:sabotage'
  | 'connect'
  | 'disconnect'
  | 'connect_error'
  | 'reconnect_attempt'
  | 'reconnect_failed';

export type ChatSocketOutboundEvent =
  | 'run:start'
  | 'chat:send'
  | 'chat:message:ack'
  | 'chat:presence'
  | 'chat:presence:heartbeat'
  | 'chat:typing'
  | 'chat:receipt'
  | 'chat:join'
  | 'chat:leave'
  | 'chat:sync'
  | 'chat:replay:request'
  | 'chat:notification:seen'
  | 'game:event'
  | 'chat:client:metrics';

export type ChatMessageKind =
  | 'PLAYER'
  | 'SYSTEM'
  | 'NPC'
  | 'BOT_ATTACK'
  | 'BOT_RETREAT'
  | 'HELPER'
  | 'MARKET_ALERT'
  | 'SHIELD_EVENT'
  | 'CASCADE_ALERT'
  | 'ACHIEVEMENT'
  | 'DEAL_ROOM'
  | 'MODERATION'
  | 'INVASION'
  | 'LIVEOPS'
  | 'PRESENCE';

export type ChatTransportState =
  | 'IDLE'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'DEGRADED'
  | 'RECONNECTING'
  | 'DISCONNECTED'
  | 'DESTROYED';

export type ChatDisconnectReason =
  | 'manual_disconnect'
  | 'socket_disconnect'
  | 'transport_error'
  | 'visibility_pause'
  | 'auth_replaced'
  | 'destroyed'
  | 'network_offline'
  | 'reconnect_exhausted'
  | 'unknown';

export type ChatPresenceState =
  | 'ACTIVE'
  | 'IDLE'
  | 'AWAY'
  | 'BACKGROUND'
  | 'OFFLINE'
  | 'HIDDEN';

export type ChatTypingState = 'STARTED' | 'STOPPED';

export type ChatRoomScope =
  | 'RUN'
  | 'LOBBY'
  | 'MODE'
  | 'ACCOUNT'
  | 'SYNDICATE'
  | 'DEAL'
  | 'CUSTOM';

export type ChatClientMetricName =
  | 'connect_latency_ms'
  | 'replay_latency_ms'
  | 'message_rtt_ms'
  | 'outbox_depth'
  | 'heartbeat_lag_ms'
  | 'ack_timeout_count'
  | 'dedup_drop_count'
  | 'reconnect_count'
  | 'presence_flush_count'
  | 'typing_flush_count';

export interface ChatMessage {
  id: string;
  channel: ChatChannel;
  kind: ChatMessageKind;
  senderId: string;
  senderName: string;
  senderRank?: string;
  body: string;
  emoji?: string;
  ts: number;
  immutable?: boolean;
  proofHash?: string;
  pressureTier?: string;
  tickTier?: string;
  runOutcome?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatPresenceMember {
  playerId: string;
  displayName: string;
  channel: ChatChannel;
  state: ChatPresenceState;
  modeId?: string;
  roomId?: string;
  isSelf?: boolean;
  isNpc?: boolean;
  isHelper?: boolean;
  isHater?: boolean;
  aura?: string;
  lastSeenAt: number;
  lastReadAt?: number;
  typingUntil?: number;
  muted?: boolean;
  hidden?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ChatPresenceSnapshot {
  channel: ChatChannel;
  roomId?: string;
  members: ChatPresenceMember[];
  serverTs: number;
  revision: number;
}

export interface ChatPresenceDelta {
  channel: ChatChannel;
  roomId?: string;
  joins?: ChatPresenceMember[];
  updates?: ChatPresenceMember[];
  leaves?: string[];
  serverTs: number;
  revision: number;
}

export interface ChatTypingSignal {
  channel: ChatChannel;
  playerId: string;
  displayName?: string;
  state: ChatTypingState;
  ts: number;
  expiresAt?: number;
  isNpc?: boolean;
  isHelper?: boolean;
  isHater?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ChatReadReceipt {
  channel: ChatChannel;
  playerId: string;
  lastReadMessageId?: string;
  lastReadAt: number;
  roomId?: string;
}

export interface ChatReplayRequest {
  channel?: ChatChannel;
  roomId?: string;
  beforeTs?: number;
  afterTs?: number;
  limit?: number;
  reason?:
    | 'bootstrap'
    | 'reconnect'
    | 'tab_switch'
    | 'drawer_open'
    | 'manual_refresh'
    | 'recovery';
}

export interface ChatReplayResponse {
  channel: ChatChannel;
  roomId?: string;
  messages: ChatMessage[];
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
  serverTs: number;
  replayToken?: string;
}

export interface ChatNotification {
  id: string;
  channel: ChatChannel;
  title: string;
  body: string;
  ts: number;
  severity?: 'INFO' | 'WARN' | 'CRITICAL';
  metadata?: Record<string, unknown>;
}

export interface ChatModerationEvent {
  code:
    | 'MUTED'
    | 'UNMUTED'
    | 'MESSAGE_REJECTED'
    | 'CHANNEL_LOCKED'
    | 'CHANNEL_UNLOCKED'
    | 'RATE_LIMITED';
  channel?: ChatChannel;
  playerId?: string;
  reason?: string;
  ts: number;
  metadata?: Record<string, unknown>;
}

export interface ChatInvasionEvent {
  id: string;
  channel: ChatChannel;
  title: string;
  body: string;
  ts: number;
  sourceId?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  metadata?: Record<string, unknown>;
}

export interface ChatSabotageEvent {
  botId?: string;
  botName?: string;
  attackType?: string;
  targetLayer?: string;
  dialogue?: string;
  isRetreat?: boolean;
  ts?: number;
  metadata?: Record<string, unknown>;
}

export interface ChatAckPayload {
  clientMessageId: string;
  serverMessageId?: string;
  ackTs: number;
  accepted: boolean;
  channel?: ChatChannel;
  reason?: string;
}

export interface ChatSocketClientMetric {
  name: ChatClientMetricName;
  value: number;
  ts: number;
  tags?: Record<string, string | number | boolean>;
}

export interface ChatRoomBinding {
  scope: ChatRoomScope;
  roomId: string;
  channel: ChatChannel;
  modeId?: string;
  runId?: string;
  syndicateId?: string;
  dealId?: string;
  seed?: number;
  allowReplay?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ChatSocketIdentity {
  playerId: string;
  displayName: string;
  accessToken?: string | null;
  sessionId?: string;
  runId?: string;
  modeId?: string;
  syndicateId?: string;
  dealId?: string;
}

export interface ChatRuntimeVisibility {
  isWindowVisible: boolean;
  isWindowFocused: boolean;
  isChatOpen: boolean;
  activeChannel: ChatChannel;
}

export interface ChatSocketRuntimeConfig {
  endpoint: string;
  namespace?: string;
  transports?: Array<'websocket' | 'polling'>;
  autoConnect?: boolean;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
  ackTimeoutMs?: number;
  replayRequestTimeoutMs?: number;
  maxReconnectAttempts?: number;
  reconnectBaseDelayMs?: number;
  reconnectMaxDelayMs?: number;
  dedupWindowMs?: number;
  dedupCacheSize?: number;
  outboundQueueLimit?: number;
  metricsFlushIntervalMs?: number;
  idlePresenceHeartbeatMs?: number;
  activePresenceHeartbeatMs?: number;
  typingDebounceMs?: number;
  typingMaxWindowMs?: number;
  log?: (message: string, context?: Record<string, unknown>) => void;
  warn?: (message: string, context?: Record<string, unknown>) => void;
  error?: (message: string, context?: Record<string, unknown>) => void;
}

export interface ChatSocketClientCallbacks {
  onTransportState?: (
    state: ChatTransportState,
    previous: ChatTransportState,
    reason?: ChatDisconnectReason,
  ) => void;
  onConnect?: (socketId?: string) => void;
  onDisconnect?: (reason: ChatDisconnectReason, details?: unknown) => void;
  onMessage?: (message: ChatMessage) => void;
  onMessageBatch?: (messages: ChatMessage[]) => void;
  onReplay?: (replay: ChatReplayResponse) => void;
  onPresenceSnapshot?: (snapshot: ChatPresenceSnapshot) => void;
  onPresenceDelta?: (delta: ChatPresenceDelta) => void;
  onTyping?: (signal: ChatTypingSignal) => void;
  onReceipt?: (receipt: ChatReadReceipt) => void;
  onNotification?: (notification: ChatNotification) => void;
  onModeration?: (event: ChatModerationEvent) => void;
  onInvasion?: (event: ChatInvasionEvent) => void;
  onSabotage?: (event: ChatSabotageEvent) => void;
  onAck?: (ack: ChatAckPayload) => void;
  onError?: (error: Error, context?: Record<string, unknown>) => void;
  onMetric?: (metric: ChatSocketClientMetric) => void;
}

export interface ChatSocketClientStateSnapshot {
  state: ChatTransportState;
  socketConnected: boolean;
  room: ChatRoomBinding | null;
  identity: ChatSocketIdentity | null;
  activeChannel: ChatChannel | null;
  reconnectAttempt: number;
  lastConnectAt: number | null;
  lastDisconnectAt: number | null;
  lastHeartbeatSentAt: number | null;
  lastHeartbeatAckAt: number | null;
  outboxDepth: number;
  pendingAcks: number;
  replayInFlight: boolean;
}

export interface ChatOutboundMessageIntent {
  clientMessageId?: string;
  channel: ChatChannel;
  body: string;
  kind?: ChatMessageKind;
  metadata?: Record<string, unknown>;
  immutable?: boolean;
  proofHash?: string;
}

export interface ChatPresenceIntent {
  channel: ChatChannel;
  state: ChatPresenceState;
  roomId?: string;
  modeId?: string;
  isChatOpen?: boolean;
  isWindowVisible?: boolean;
  isWindowFocused?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ChatTypingIntent {
  channel: ChatChannel;
  state: ChatTypingState;
  roomId?: string;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
}

export interface ChatGameEventIntent {
  event: string;
  channel?: ChatChannel;
  roomId?: string;
  metadata?: Record<string, unknown>;
}

interface SocketLike {
  id?: string;
  connected: boolean;
  emit: (event: string, payload?: unknown, ack?: (...args: any[]) => void) => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler?: (...args: any[]) => void) => void;
  disconnect: () => void;
  connect?: () => void;
}

interface SocketFactoryModule {
  io: (endpoint: string, options?: Record<string, unknown>) => SocketLike;
}

interface OutboxEntry {
  id: string;
  event: ChatSocketOutboundEvent;
  payload: unknown;
  enqueuedAt: number;
  attempt: number;
  requiresAck: boolean;
  timeoutAt?: number;
  roomId?: string;
}

interface PendingAckEntry {
  clientMessageId: string;
  channel: ChatChannel;
  createdAt: number;
  resolve: (ack: ChatAckPayload) => void;
  reject: (error: Error) => void;
  timeoutHandle: ReturnType<typeof setTimeout> | null;
}

interface PresenceFlushRequest {
  latest: ChatPresenceIntent;
  enqueuedAt: number;
}

interface TypingFlushRequest {
  latest: ChatTypingIntent;
  enqueuedAt: number;
}

const DEFAULT_CONFIG: Required<
  Pick<
    ChatSocketRuntimeConfig,
    | 'namespace'
    | 'transports'
    | 'autoConnect'
    | 'heartbeatIntervalMs'
    | 'heartbeatTimeoutMs'
    | 'ackTimeoutMs'
    | 'replayRequestTimeoutMs'
    | 'maxReconnectAttempts'
    | 'reconnectBaseDelayMs'
    | 'reconnectMaxDelayMs'
    | 'dedupWindowMs'
    | 'dedupCacheSize'
    | 'outboundQueueLimit'
    | 'metricsFlushIntervalMs'
    | 'idlePresenceHeartbeatMs'
    | 'activePresenceHeartbeatMs'
    | 'typingDebounceMs'
    | 'typingMaxWindowMs'
  >
> = {
  namespace: '',
  transports: ['websocket', 'polling'],
  autoConnect: true,
  heartbeatIntervalMs: 10_000,
  heartbeatTimeoutMs: 25_000,
  ackTimeoutMs: 8_000,
  replayRequestTimeoutMs: 8_000,
  maxReconnectAttempts: 10,
  reconnectBaseDelayMs: 1_000,
  reconnectMaxDelayMs: 15_000,
  dedupWindowMs: 7_500,
  dedupCacheSize: 1_024,
  outboundQueueLimit: 500,
  metricsFlushIntervalMs: 15_000,
  idlePresenceHeartbeatMs: 20_000,
  activePresenceHeartbeatMs: 8_000,
  typingDebounceMs: 350,
  typingMaxWindowMs: 6_000,
};

const NOOP = (): void => undefined;

function now(): number {
  return Date.now();
}

function makeClientMessageId(prefix: string): string {
  const entropy = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${entropy}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createError(message: string, cause?: unknown): Error {
  const error = new Error(message);
  if (cause !== undefined) {
    (error as Error & { cause?: unknown }).cause = cause;
  }
  return error;
}

function isBrowserOnline(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean') {
    return true;
  }
  return navigator.onLine;
}

function stableJson(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(',')}}`;
}

function computePayloadHash(event: string, payload: unknown): string {
  return `${event}:${stableJson(payload)}`;
}

function computeReconnectDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  const jitter = 0.75 + Math.random() * 0.5;
  const exponential = baseDelayMs * Math.pow(2, Math.max(0, attempt - 1));
  return Math.floor(clamp(exponential * jitter, baseDelayMs, maxDelayMs));
}

function shallowClone<T>(value: T): T {
  if (Array.isArray(value)) return [...value] as T;
  if (value && typeof value === 'object') return { ...(value as Record<string, unknown>) } as T;
  return value;
}

function getLogger(config: ChatSocketRuntimeConfig): Required<
  Pick<ChatSocketRuntimeConfig, 'log' | 'warn' | 'error'>
> {
  return {
    log: config.log ?? NOOP,
    warn: config.warn ?? NOOP,
    error: config.error ?? NOOP,
  };
}

export class ChatSocketClient {
  private readonly config: ChatSocketRuntimeConfig;
  private readonly callbacks: ChatSocketClientCallbacks;
  private readonly logger: Required<Pick<ChatSocketRuntimeConfig, 'log' | 'warn' | 'error'>>;

  private state: ChatTransportState = 'IDLE';
  private socket: SocketLike | null = null;
  private socketFactoryPromise: Promise<SocketFactoryModule> | null = null;
  private destroyed = false;

  private identity: ChatSocketIdentity | null = null;
  private room: ChatRoomBinding | null = null;
  private activeChannel: ChatChannel | null = null;
  private visibility: ChatRuntimeVisibility = {
    isWindowVisible: true,
    isWindowFocused: true,
    isChatOpen: false,
    activeChannel: 'GLOBAL',
  };

  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatStaleTimer: ReturnType<typeof setTimeout> | null = null;
  private metricsTimer: ReturnType<typeof setInterval> | null = null;
  private presenceTimer: ReturnType<typeof setTimeout> | null = null;
  private typingTimer: ReturnType<typeof setTimeout> | null = null;
  private lastConnectAt: number | null = null;
  private lastDisconnectAt: number | null = null;
  private lastHeartbeatSentAt: number | null = null;
  private lastHeartbeatAckAt: number | null = null;

  private outbox: OutboxEntry[] = [];
  private pendingAcks = new Map<string, PendingAckEntry>();
  private recentInboundHashes = new Map<string, number>();
  private metricsBuffer: ChatSocketClientMetric[] = [];

  private replayInFlight = false;
  private pendingPresenceFlush: PresenceFlushRequest | null = null;
  private pendingTypingFlush: TypingFlushRequest | null = null;

  private readonly boundOnline = (): void => {
    this.logger.log('ChatSocketClient network online observed.');
    if (this.destroyed) return;
    if (this.state === 'DISCONNECTED' || this.state === 'DEGRADED') {
      void this.connect('network_offline');
    }
  };

  private readonly boundOffline = (): void => {
    this.logger.warn('ChatSocketClient network offline observed.');
    this.transitionState('DEGRADED', 'network_offline');
    this.stopHeartbeat();
  };

  private readonly boundVisibility = (): void => {
    if (typeof document === 'undefined') return;

    const isWindowVisible = document.visibilityState !== 'hidden';
    this.setVisibility({
      ...this.visibility,
      isWindowVisible,
      isWindowFocused:
        typeof document.hasFocus === 'function'
          ? document.hasFocus()
          : this.visibility.isWindowFocused,
    });

    if (isWindowVisible && this.state !== 'CONNECTED' && !this.destroyed) {
      void this.connect('visibility_pause');
    }
  };

  constructor(
    config: ChatSocketRuntimeConfig,
    callbacks: ChatSocketClientCallbacks = {},
  ) {
    if (!config.endpoint) {
      throw createError('ChatSocketClient requires a non-empty endpoint.');
    }

    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      transports: config.transports ?? DEFAULT_CONFIG.transports,
    };
    this.callbacks = callbacks;
    this.logger = getLogger(this.config);

    this.installEnvironmentListeners();

    if (this.config.autoConnect) {
      queueMicrotask(() => {
        if (!this.destroyed) void this.connect();
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Public lifecycle
  // ---------------------------------------------------------------------------

  public setIdentity(identity: ChatSocketIdentity | null): void {
    const previousToken = this.identity?.accessToken ?? null;
    const nextToken = identity?.accessToken ?? null;
    this.identity = identity ? { ...identity } : null;

    if (previousToken !== nextToken && this.socket) {
      this.logger.log('ChatSocketClient identity token changed; recycling socket.', {
        previousTokenPresent: Boolean(previousToken),
        nextTokenPresent: Boolean(nextToken),
      });
      this.disconnect('auth_replaced');
      if (!this.destroyed && this.config.autoConnect) {
        void this.connect('auth_replaced');
      }
    }
  }

  public bindRoom(room: ChatRoomBinding | null): void {
    const previousRoom = this.room?.roomId ?? null;
    const nextRoom = room?.roomId ?? null;
    this.room = room ? { ...room, metadata: shallowClone(room.metadata) } : null;

    if (previousRoom !== nextRoom && this.socket?.connected) {
      if (previousRoom) {
        this.emitImmediate('chat:leave', { roomId: previousRoom });
      }
      if (room) {
        this.emitImmediate('chat:join', this.buildJoinPayload(room));
      }
    }

    if (room) {
      this.activeChannel = room.channel;
      this.visibility = {
        ...this.visibility,
        activeChannel: room.channel,
      };
    }
  }

  public setVisibility(next: ChatRuntimeVisibility): void {
    this.visibility = { ...next };

    if (!this.identity || !this.room) return;

    const presenceState = this.derivePresenceState();
    this.queuePresenceFlush({
      channel: this.visibility.activeChannel,
      state: presenceState,
      roomId: this.room.roomId,
      modeId: this.identity.modeId,
      isChatOpen: this.visibility.isChatOpen,
      isWindowVisible: this.visibility.isWindowVisible,
      isWindowFocused: this.visibility.isWindowFocused,
      metadata: {
        scope: this.room.scope,
        modeId: this.identity.modeId,
      },
    });
  }

  public async connect(reason: ChatDisconnectReason = 'unknown'): Promise<void> {
    if (this.destroyed) return;
    if (!isBrowserOnline()) {
      this.transitionState('DEGRADED', 'network_offline');
      return;
    }
    if (this.state === 'CONNECTING' || this.state === 'CONNECTED') return;

    this.clearReconnectTimer();
    const previousState = this.state;
    this.transitionState(
      previousState === 'RECONNECTING' ? 'RECONNECTING' : 'CONNECTING',
      reason,
    );

    try {
      const socket = await this.createSocket();
      if (this.destroyed) {
        socket.disconnect();
        return;
      }

      this.socket = socket;
      this.bindSocketHandlers(socket);

      if (typeof socket.connect === 'function') {
        socket.connect();
      }
    } catch (error) {
      this.logger.error('ChatSocketClient connect failed.', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.callbacks.onError?.(createError('Chat socket connect failed.', error), {
        phase: 'connect',
      });
      this.scheduleReconnect('transport_error');
    }
  }

  public disconnect(reason: ChatDisconnectReason = 'manual_disconnect'): void {
    if (this.socket) {
      try {
        this.socket.disconnect();
      } catch (error) {
        this.logger.warn('ChatSocketClient disconnect threw.', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      this.socket = null;
    }

    this.stopHeartbeat();
    this.clearReconnectTimer();
    this.rejectAllPendingAcks(
      createError(`Chat socket disconnected: ${reason}.`),
    );
    this.transitionState('DISCONNECTED', reason);
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.disconnect('destroyed');
    this.clearTimers();
    this.outbox.length = 0;
    this.pendingPresenceFlush = null;
    this.pendingTypingFlush = null;
    this.recentInboundHashes.clear();
    this.metricsBuffer.length = 0;
    this.removeEnvironmentListeners();
    this.transitionState('DESTROYED', 'destroyed');
  }

  // ---------------------------------------------------------------------------
  // Public API — outbound
  // ---------------------------------------------------------------------------

  public async sendMessage(intent: ChatOutboundMessageIntent): Promise<ChatAckPayload> {
    const clientMessageId = intent.clientMessageId ?? makeClientMessageId('chatmsg');
    const payload = {
      clientMessageId,
      channel: intent.channel,
      body: intent.body,
      kind: intent.kind ?? 'PLAYER',
      immutable: intent.immutable ?? false,
      proofHash: intent.proofHash,
      roomId: this.room?.roomId,
      runId: this.identity?.runId,
      modeId: this.identity?.modeId,
      metadata: {
        ...(intent.metadata ?? {}),
        activeChannel: this.visibility.activeChannel,
        scope: this.room?.scope,
      },
    };

    return await this.emitWithAck('chat:send', payload, intent.channel, clientMessageId);
  }

  public queueGameEvent(intent: ChatGameEventIntent): void {
    const payload = {
      event: intent.event,
      channel: intent.channel ?? this.visibility.activeChannel ?? this.room?.channel,
      roomId: intent.roomId ?? this.room?.roomId,
      runId: this.identity?.runId,
      modeId: this.identity?.modeId,
      metadata: intent.metadata ?? {},
    };

    this.enqueueOutbound({
      event: 'game:event',
      payload,
      requiresAck: false,
      roomId: payload.roomId,
    });
    this.flushOutbox();
  }

  public queuePresence(intent: ChatPresenceIntent): void {
    this.queuePresenceFlush(intent);
  }

  public queueTyping(intent: ChatTypingIntent): void {
    this.pendingTypingFlush = {
      latest: { ...intent, roomId: intent.roomId ?? this.room?.roomId },
      enqueuedAt: now(),
    };

    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
      this.typingTimer = null;
    }

    this.typingTimer = setTimeout(() => {
      if (!this.pendingTypingFlush) return;
      const request = this.pendingTypingFlush;
      this.pendingTypingFlush = null;

      this.enqueueOutbound({
        event: 'chat:typing',
        payload: {
          ...request.latest,
          runId: this.identity?.runId,
          modeId: this.identity?.modeId,
        },
        requiresAck: false,
        roomId: request.latest.roomId,
      });
      this.emitMetric('typing_flush_count', 1, {
        channel: request.latest.channel,
        state: request.latest.state,
      });
      this.flushOutbox();
    }, this.config.typingDebounceMs);
  }

  public queueReadReceipt(receipt: ChatReadReceipt): void {
    this.enqueueOutbound({
      event: 'chat:receipt',
      payload: {
        ...receipt,
        roomId: receipt.roomId ?? this.room?.roomId,
        runId: this.identity?.runId,
      },
      requiresAck: false,
      roomId: receipt.roomId ?? this.room?.roomId,
    });
    this.flushOutbox();
  }

  public requestReplay(request: ChatReplayRequest): void {
    if (this.replayInFlight) {
      this.logger.warn('ChatSocketClient replay request skipped because one is already in flight.');
      return;
    }

    this.replayInFlight = true;
    const startedAt = now();

    const timeoutHandle = setTimeout(() => {
      this.replayInFlight = false;
      this.callbacks.onError?.(
        createError('Chat replay request timed out.'),
        { phase: 'replay', request },
      );
    }, this.config.replayRequestTimeoutMs);

    this.emitImmediate('chat:replay:request', {
      ...request,
      channel: request.channel ?? this.visibility.activeChannel ?? this.room?.channel,
      roomId: request.roomId ?? this.room?.roomId,
      runId: this.identity?.runId,
      modeId: this.identity?.modeId,
    }, () => {
      clearTimeout(timeoutHandle);
      this.replayInFlight = false;
      this.emitMetric('replay_latency_ms', now() - startedAt, {
        reason: request.reason ?? 'manual_refresh',
      });
    });
  }

  public markNotificationSeen(notificationId: string): void {
    this.enqueueOutbound({
      event: 'chat:notification:seen',
      payload: {
        notificationId,
        roomId: this.room?.roomId,
        channel: this.visibility.activeChannel ?? this.room?.channel,
      },
      requiresAck: false,
      roomId: this.room?.roomId,
    });
    this.flushOutbox();
  }

  public getStateSnapshot(): ChatSocketClientStateSnapshot {
    return {
      state: this.state,
      socketConnected: Boolean(this.socket?.connected),
      room: this.room ? { ...this.room } : null,
      identity: this.identity ? { ...this.identity } : null,
      activeChannel: this.visibility.activeChannel ?? this.activeChannel,
      reconnectAttempt: this.reconnectAttempt,
      lastConnectAt: this.lastConnectAt,
      lastDisconnectAt: this.lastDisconnectAt,
      lastHeartbeatSentAt: this.lastHeartbeatSentAt,
      lastHeartbeatAckAt: this.lastHeartbeatAckAt,
      outboxDepth: this.outbox.length,
      pendingAcks: this.pendingAcks.size,
      replayInFlight: this.replayInFlight,
    };
  }

  // ---------------------------------------------------------------------------
  // Internal — socket boot
  // ---------------------------------------------------------------------------

  private async createSocket(): Promise<SocketLike> {
    const module = await this.loadSocketFactory();

    const endpoint = this.config.namespace
      ? `${this.config.endpoint}${this.config.namespace}`
      : this.config.endpoint;

    return module.io(endpoint, {
      autoConnect: false,
      auth: {
        token: this.identity?.accessToken ?? undefined,
        sessionId: this.identity?.sessionId ?? undefined,
        playerId: this.identity?.playerId ?? undefined,
      },
      transports: this.config.transports,
      reconnection: false,
      forceNew: true,
    });
  }

  private async loadSocketFactory(): Promise<SocketFactoryModule> {
    if (!this.socketFactoryPromise) {
      const dynamicImporter = new Function(
        'return import("socket.io-client")',
      ) as () => Promise<SocketFactoryModule>;
      this.socketFactoryPromise = dynamicImporter();
    }
    return await this.socketFactoryPromise;
  }

  private bindSocketHandlers(socket: SocketLike): void {
    socket.on('connect', this.handleConnect);
    socket.on('disconnect', this.handleSocketDisconnect);
    socket.on('connect_error', this.handleConnectError);
    socket.on('chat:message', this.handleInboundMessage);
    socket.on('chat:message:batch', this.handleInboundBatch);
    socket.on('chat:replay', this.handleReplay);
    socket.on('chat:presence', this.handlePresenceSnapshot);
    socket.on('chat:presence:delta', this.handlePresenceDelta);
    socket.on('chat:typing', this.handleTypingSignal);
    socket.on('chat:receipt', this.handleReadReceipt);
    socket.on('chat:notification', this.handleNotification);
    socket.on('chat:moderation', this.handleModeration);
    socket.on('chat:invasion', this.handleInvasion);
    socket.on('chat:ack', this.handleAck);
    socket.on('chat:error', this.handleServerError);
    socket.on('hater:sabotage', this.handleSabotage);
  }

  private readonly handleConnect = (): void => {
    this.reconnectAttempt = 0;
    this.lastConnectAt = now();
    this.lastHeartbeatAckAt = this.lastConnectAt;
    this.transitionState('CONNECTED');
    this.callbacks.onConnect?.(this.socket?.id);

    if (this.identity?.runId) {
      this.emitImmediate('run:start', {
        seed: this.room?.seed ?? 0,
        runId: this.identity.runId,
        modeId: this.identity.modeId,
      });
    }

    if (this.room) {
      this.emitImmediate('chat:join', this.buildJoinPayload(this.room));
      if (this.room.allowReplay !== false) {
        this.requestReplay({
          channel: this.room.channel,
          roomId: this.room.roomId,
          reason: 'bootstrap',
          limit: 100,
        });
      }
    }

    this.queuePresence({
      channel: this.visibility.activeChannel ?? this.room?.channel ?? 'GLOBAL',
      state: this.derivePresenceState(),
      roomId: this.room?.roomId,
      modeId: this.identity?.modeId,
      isChatOpen: this.visibility.isChatOpen,
      isWindowFocused: this.visibility.isWindowFocused,
      isWindowVisible: this.visibility.isWindowVisible,
    });

    this.startHeartbeat();
    this.flushOutbox();
  };

  private readonly handleSocketDisconnect = (details?: unknown): void => {
    this.lastDisconnectAt = now();
    this.stopHeartbeat();
    this.callbacks.onDisconnect?.('socket_disconnect', details);

    if (this.destroyed) return;
    this.scheduleReconnect('socket_disconnect');
  };

  private readonly handleConnectError = (details?: unknown): void => {
    this.callbacks.onError?.(
      createError('Chat socket connect_error received.', details),
      { phase: 'socket_connect_error' },
    );
    this.scheduleReconnect('transport_error');
  };

  // ---------------------------------------------------------------------------
  // Internal — inbound handlers
  // ---------------------------------------------------------------------------

  private readonly handleInboundMessage = (message: ChatMessage): void => {
    if (!this.acceptInbound('chat:message', message)) return;
    this.callbacks.onMessage?.(message);
  };

  private readonly handleInboundBatch = (messages: ChatMessage[]): void => {
    const accepted: ChatMessage[] = [];
    for (const message of messages) {
      if (this.acceptInbound('chat:message:batch', message)) {
        accepted.push(message);
      }
    }
    if (!accepted.length) return;
    this.callbacks.onMessageBatch?.(accepted);
  };

  private readonly handleReplay = (replay: ChatReplayResponse): void => {
    this.replayInFlight = false;
    this.lastHeartbeatAckAt = now();
    this.callbacks.onReplay?.(replay);
  };

  private readonly handlePresenceSnapshot = (snapshot: ChatPresenceSnapshot): void => {
    if (!this.acceptInbound('chat:presence', snapshot)) return;
    this.callbacks.onPresenceSnapshot?.(snapshot);
  };

  private readonly handlePresenceDelta = (delta: ChatPresenceDelta): void => {
    if (!this.acceptInbound('chat:presence:delta', delta)) return;
    this.callbacks.onPresenceDelta?.(delta);
  };

  private readonly handleTypingSignal = (signal: ChatTypingSignal): void => {
    if (!this.acceptInbound('chat:typing', signal)) return;
    this.callbacks.onTyping?.(signal);
  };

  private readonly handleReadReceipt = (receipt: ChatReadReceipt): void => {
    if (!this.acceptInbound('chat:receipt', receipt)) return;
    this.callbacks.onReceipt?.(receipt);
  };

  private readonly handleNotification = (notification: ChatNotification): void => {
    if (!this.acceptInbound('chat:notification', notification)) return;
    this.callbacks.onNotification?.(notification);
  };

  private readonly handleModeration = (event: ChatModerationEvent): void => {
    if (!this.acceptInbound('chat:moderation', event)) return;
    this.callbacks.onModeration?.(event);
  };

  private readonly handleInvasion = (event: ChatInvasionEvent): void => {
    if (!this.acceptInbound('chat:invasion', event)) return;
    this.callbacks.onInvasion?.(event);
  };

  private readonly handleSabotage = (event: ChatSabotageEvent): void => {
    if (!this.acceptInbound('hater:sabotage', event)) return;
    this.callbacks.onSabotage?.(event);
  };

  private readonly handleAck = (ack: ChatAckPayload): void => {
    this.lastHeartbeatAckAt = now();

    const pending = this.pendingAcks.get(ack.clientMessageId);
    if (!pending) {
      this.callbacks.onAck?.(ack);
      return;
    }

    if (pending.timeoutHandle) {
      clearTimeout(pending.timeoutHandle);
    }
    this.pendingAcks.delete(ack.clientMessageId);

    this.emitMetric('message_rtt_ms', now() - pending.createdAt, {
      channel: pending.channel,
      accepted: ack.accepted,
    });

    if (ack.accepted) {
      pending.resolve(ack);
    } else {
      pending.reject(createError(ack.reason ?? 'Chat send rejected by server.'));
    }

    this.callbacks.onAck?.(ack);
  };

  private readonly handleServerError = (payload: unknown): void => {
    const error = createError('Chat server error received.');
    this.callbacks.onError?.(error, {
      phase: 'server_error',
      payload,
    });
  };

  // ---------------------------------------------------------------------------
  // Internal — outbound queue / ack
  // ---------------------------------------------------------------------------

  private enqueueOutbound(input: {
    event: ChatSocketOutboundEvent;
    payload: unknown;
    requiresAck: boolean;
    roomId?: string;
  }): void {
    if (this.outbox.length >= this.config.outboundQueueLimit!) {
      this.outbox.shift();
      this.logger.warn('ChatSocketClient outbox limit reached; oldest entry dropped.', {
        limit: this.config.outboundQueueLimit,
      });
    }

    this.outbox.push({
      id: makeClientMessageId('outbox'),
      event: input.event,
      payload: input.payload,
      enqueuedAt: now(),
      attempt: 0,
      requiresAck: input.requiresAck,
      roomId: input.roomId,
    });

    this.emitMetric('outbox_depth', this.outbox.length);
  }

  private flushOutbox(): void {
    if (!this.socket?.connected || !this.outbox.length) return;

    const remaining: OutboxEntry[] = [];

    for (const entry of this.outbox) {
      const sent = this.sendOutboxEntry(entry);
      if (!sent) remaining.push(entry);
    }

    this.outbox = remaining;
    this.emitMetric('outbox_depth', this.outbox.length);
  }

  private sendOutboxEntry(entry: OutboxEntry): boolean {
    if (!this.socket?.connected) return false;

    try {
      entry.attempt += 1;

      if (entry.requiresAck) {
        const payload = entry.payload as {
          clientMessageId: string;
          channel: ChatChannel;
        };
        void this.emitWithAck(
          entry.event,
          entry.payload,
          payload.channel,
          payload.clientMessageId,
        );
        return true;
      }

      this.emitImmediate(entry.event, entry.payload);
      return true;
    } catch (error) {
      this.logger.warn('ChatSocketClient failed to flush outbox entry.', {
        event: entry.event,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private emitImmediate(
    event: ChatSocketOutboundEvent,
    payload: unknown,
    onAck?: () => void,
  ): void {
    if (!this.socket?.connected) {
      this.enqueueOutbound({
        event,
        payload,
        requiresAck: false,
        roomId:
          (payload as Record<string, unknown> | undefined)?.roomId as string | undefined,
      });
      return;
    }

    this.socket.emit(event, payload, (..._ackArgs: any[]) => {
      onAck?.();
    });
  }

  private async emitWithAck(
    event: ChatSocketOutboundEvent,
    payload: unknown,
    channel: ChatChannel,
    clientMessageId: string,
  ): Promise<ChatAckPayload> {
    if (!this.socket?.connected) {
      this.enqueueOutbound({
        event,
        payload,
        requiresAck: true,
        roomId:
          (payload as Record<string, unknown> | undefined)?.roomId as string | undefined,
      });
      void this.connect('unknown');
    }

    return await new Promise<ChatAckPayload>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingAcks.delete(clientMessageId);
        this.emitMetric('ack_timeout_count', 1, { channel });
        reject(createError(`Chat ack timed out for ${clientMessageId}.`));
      }, this.config.ackTimeoutMs);

      this.pendingAcks.set(clientMessageId, {
        clientMessageId,
        channel,
        createdAt: now(),
        resolve,
        reject,
        timeoutHandle,
      });

      if (!this.socket?.connected) {
        return;
      }

      this.socket.emit(event, payload);
    });
  }

  private rejectAllPendingAcks(error: Error): void {
    for (const entry of this.pendingAcks.values()) {
      if (entry.timeoutHandle) {
        clearTimeout(entry.timeoutHandle);
      }
      entry.reject(error);
    }
    this.pendingAcks.clear();
  }

  // ---------------------------------------------------------------------------
  // Internal — presence / typing / heartbeat
  // ---------------------------------------------------------------------------

  private queuePresenceFlush(intent: ChatPresenceIntent): void {
    this.pendingPresenceFlush = {
      latest: {
        ...intent,
        roomId: intent.roomId ?? this.room?.roomId,
      },
      enqueuedAt: now(),
    };

    if (this.presenceTimer) {
      clearTimeout(this.presenceTimer);
      this.presenceTimer = null;
    }

    const interval = intent.state === 'ACTIVE'
      ? this.config.activePresenceHeartbeatMs!
      : this.config.idlePresenceHeartbeatMs!;

    this.presenceTimer = setTimeout(() => {
      if (!this.pendingPresenceFlush) return;
      const request = this.pendingPresenceFlush;
      this.pendingPresenceFlush = null;

      this.enqueueOutbound({
        event: 'chat:presence',
        payload: {
          ...request.latest,
          runId: this.identity?.runId,
          modeId: this.identity?.modeId,
          playerId: this.identity?.playerId,
          displayName: this.identity?.displayName,
          sessionId: this.identity?.sessionId,
        },
        requiresAck: false,
        roomId: request.latest.roomId,
      });

      this.emitMetric('presence_flush_count', 1, {
        channel: request.latest.channel,
        state: request.latest.state,
      });

      this.flushOutbox();
    }, Math.min(250, interval / 4));
  }

  private derivePresenceState(): ChatPresenceState {
    if (!this.visibility.isWindowVisible) return 'BACKGROUND';
    if (!this.visibility.isWindowFocused) return 'AWAY';
    if (this.visibility.isChatOpen) return 'ACTIVE';
    return 'IDLE';
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (!this.socket?.connected) return;

      this.lastHeartbeatSentAt = now();

      this.emitImmediate('chat:presence:heartbeat', {
        roomId: this.room?.roomId,
        channel: this.visibility.activeChannel ?? this.room?.channel,
        runId: this.identity?.runId,
        modeId: this.identity?.modeId,
        state: this.derivePresenceState(),
        ts: this.lastHeartbeatSentAt,
      });

      this.armHeartbeatStaleGuard();
    }, this.config.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.heartbeatStaleTimer) {
      clearTimeout(this.heartbeatStaleTimer);
      this.heartbeatStaleTimer = null;
    }
  }

  private armHeartbeatStaleGuard(): void {
    if (this.heartbeatStaleTimer) {
      clearTimeout(this.heartbeatStaleTimer);
      this.heartbeatStaleTimer = null;
    }

    this.heartbeatStaleTimer = setTimeout(() => {
      const sentAt = this.lastHeartbeatSentAt ?? 0;
      const ackAt = this.lastHeartbeatAckAt ?? 0;
      const lag = Math.max(0, sentAt - ackAt);

      this.emitMetric('heartbeat_lag_ms', lag);

      if (lag >= this.config.heartbeatTimeoutMs!) {
        this.logger.warn('ChatSocketClient heartbeat stale guard fired.', { lag });
        this.transitionState('DEGRADED', 'transport_error');
        this.scheduleReconnect('transport_error');
      }
    }, this.config.heartbeatTimeoutMs);
  }

  // ---------------------------------------------------------------------------
  // Internal — reconnection / state
  // ---------------------------------------------------------------------------

  private scheduleReconnect(reason: ChatDisconnectReason): void {
    if (this.destroyed) return;
    if (this.reconnectAttempt >= this.config.maxReconnectAttempts!) {
      this.transitionState('DISCONNECTED', 'reconnect_exhausted');
      this.callbacks.onDisconnect?.('reconnect_exhausted');
      return;
    }

    this.transitionState('RECONNECTING', reason);
    this.reconnectAttempt += 1;
    this.emitMetric('reconnect_count', this.reconnectAttempt);

    const delayMs = computeReconnectDelay(
      this.reconnectAttempt,
      this.config.reconnectBaseDelayMs!,
      this.config.reconnectMaxDelayMs!,
    );

    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect(reason);
    }, delayMs);
  }

  private transitionState(
    next: ChatTransportState,
    reason?: ChatDisconnectReason,
  ): void {
    if (this.state === next) return;
    const previous = this.state;
    this.state = next;
    this.callbacks.onTransportState?.(next, previous, reason);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearTimers(): void {
    this.clearReconnectTimer();
    this.stopHeartbeat();

    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }
    if (this.presenceTimer) {
      clearTimeout(this.presenceTimer);
      this.presenceTimer = null;
    }
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
      this.typingTimer = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Internal — dedup / metrics
  // ---------------------------------------------------------------------------

  private acceptInbound(event: ChatSocketInboundEvent, payload: unknown): boolean {
    const hash = computePayloadHash(event, payload);
    const currentTs = now();
    const previousTs = this.recentInboundHashes.get(hash);

    if (
      previousTs !== undefined &&
      currentTs - previousTs <= this.config.dedupWindowMs!
    ) {
      this.emitMetric('dedup_drop_count', 1, { event });
      return false;
    }

    this.recentInboundHashes.set(hash, currentTs);
    this.trimDedupCache();
    return true;
  }

  private trimDedupCache(): void {
    const limit = this.config.dedupCacheSize!;
    if (this.recentInboundHashes.size <= limit) return;

    const entries = [...this.recentInboundHashes.entries()].sort((a, b) => a[1] - b[1]);
    const removeCount = entries.length - limit;
    for (let index = 0; index < removeCount; index += 1) {
      this.recentInboundHashes.delete(entries[index][0]);
    }
  }

  private emitMetric(
    name: ChatClientMetricName,
    value: number,
    tags?: Record<string, string | number | boolean>,
  ): void {
    const metric: ChatSocketClientMetric = {
      name,
      value,
      ts: now(),
      tags,
    };
    this.metricsBuffer.push(metric);
    this.callbacks.onMetric?.(metric);

    if (!this.metricsTimer) {
      this.metricsTimer = setInterval(() => {
        if (!this.metricsBuffer.length) return;

        const buffer = this.metricsBuffer.splice(0, this.metricsBuffer.length);
        this.emitImmediate('chat:client:metrics', {
          roomId: this.room?.roomId,
          channel: this.visibility.activeChannel ?? this.room?.channel,
          runId: this.identity?.runId,
          metrics: buffer,
        });
      }, this.config.metricsFlushIntervalMs);
    }
  }

  // ---------------------------------------------------------------------------
  // Internal — join payload / environment
  // ---------------------------------------------------------------------------

  private buildJoinPayload(room: ChatRoomBinding): Record<string, unknown> {
    return {
      roomId: room.roomId,
      scope: room.scope,
      channel: room.channel,
      modeId: room.modeId ?? this.identity?.modeId,
      runId: room.runId ?? this.identity?.runId,
      syndicateId: room.syndicateId ?? this.identity?.syndicateId,
      dealId: room.dealId ?? this.identity?.dealId,
      sessionId: this.identity?.sessionId,
      playerId: this.identity?.playerId,
      displayName: this.identity?.displayName,
      seed: room.seed,
      metadata: room.metadata ?? {},
    };
  }

  private installEnvironmentListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.boundOnline);
      window.addEventListener('offline', this.boundOffline);
      window.addEventListener('focus', this.boundVisibility);
      window.addEventListener('blur', this.boundVisibility);
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.boundVisibility);
    }
  }

  private removeEnvironmentListeners(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.boundOnline);
      window.removeEventListener('offline', this.boundOffline);
      window.removeEventListener('focus', this.boundVisibility);
      window.removeEventListener('blur', this.boundVisibility);
    }

    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.boundVisibility);
    }
  }
}

// -----------------------------------------------------------------------------
// Factory helpers
// -----------------------------------------------------------------------------

export interface CreateChatSocketClientArgs {
  endpoint: string;
  accessToken?: string | null;
  playerId: string;
  displayName: string;
  sessionId?: string;
  runId?: string;
  modeId?: string;
  syndicateId?: string;
  dealId?: string;
  room?: ChatRoomBinding | null;
  activeChannel?: ChatChannel;
  callbacks?: ChatSocketClientCallbacks;
  config?: Omit<ChatSocketRuntimeConfig, 'endpoint'>;
}

export function createChatSocketClient(
  args: CreateChatSocketClientArgs,
): ChatSocketClient {
  const client = new ChatSocketClient(
    {
      endpoint: args.endpoint,
      ...(args.config ?? {}),
    },
    args.callbacks,
  );

  client.setIdentity({
    playerId: args.playerId,
    displayName: args.displayName,
    accessToken: args.accessToken ?? null,
    sessionId: args.sessionId,
    runId: args.runId,
    modeId: args.modeId,
    syndicateId: args.syndicateId,
    dealId: args.dealId,
  });

  if (args.room) {
    client.bindRoom(args.room);
  }

  if (args.activeChannel) {
    client.setVisibility({
      isWindowVisible: true,
      isWindowFocused: true,
      isChatOpen: false,
      activeChannel: args.activeChannel,
    });
  }

  return client;
}

// -----------------------------------------------------------------------------
// Migration-friendly narrow helpers
// -----------------------------------------------------------------------------

export function createDefaultChatSocketRuntimeConfig(
  endpoint: string,
): ChatSocketRuntimeConfig {
  return {
    endpoint,
    namespace: '',
    transports: ['websocket', 'polling'],
    autoConnect: true,
    heartbeatIntervalMs: DEFAULT_CONFIG.heartbeatIntervalMs,
    heartbeatTimeoutMs: DEFAULT_CONFIG.heartbeatTimeoutMs,
    ackTimeoutMs: DEFAULT_CONFIG.ackTimeoutMs,
    replayRequestTimeoutMs: DEFAULT_CONFIG.replayRequestTimeoutMs,
    maxReconnectAttempts: DEFAULT_CONFIG.maxReconnectAttempts,
    reconnectBaseDelayMs: DEFAULT_CONFIG.reconnectBaseDelayMs,
    reconnectMaxDelayMs: DEFAULT_CONFIG.reconnectMaxDelayMs,
    dedupWindowMs: DEFAULT_CONFIG.dedupWindowMs,
    dedupCacheSize: DEFAULT_CONFIG.dedupCacheSize,
    outboundQueueLimit: DEFAULT_CONFIG.outboundQueueLimit,
    metricsFlushIntervalMs: DEFAULT_CONFIG.metricsFlushIntervalMs,
    idlePresenceHeartbeatMs: DEFAULT_CONFIG.idlePresenceHeartbeatMs,
    activePresenceHeartbeatMs: DEFAULT_CONFIG.activePresenceHeartbeatMs,
    typingDebounceMs: DEFAULT_CONFIG.typingDebounceMs,
    typingMaxWindowMs: DEFAULT_CONFIG.typingMaxWindowMs,
  };
}

export function buildChatRoomBinding(input: {
  scope: ChatRoomScope;
  roomId: string;
  channel: ChatChannel;
  modeId?: string;
  runId?: string;
  syndicateId?: string;
  dealId?: string;
  seed?: number;
  allowReplay?: boolean;
  metadata?: Record<string, unknown>;
}): ChatRoomBinding {
  return {
    scope: input.scope,
    roomId: input.roomId,
    channel: input.channel,
    modeId: input.modeId,
    runId: input.runId,
    syndicateId: input.syndicateId,
    dealId: input.dealId,
    seed: input.seed,
    allowReplay: input.allowReplay ?? true,
    metadata: input.metadata ?? {},
  };
}

export function buildVisibilitySnapshot(input?: Partial<ChatRuntimeVisibility>): ChatRuntimeVisibility {
  return {
    isWindowVisible: input?.isWindowVisible ?? true,
    isWindowFocused: input?.isWindowFocused ?? true,
    isChatOpen: input?.isChatOpen ?? false,
    activeChannel: input?.activeChannel ?? 'GLOBAL',
  };
}
