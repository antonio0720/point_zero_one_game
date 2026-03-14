// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/intelligence/ChatLearningBridge.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT LEARNING BRIDGE
 * FILE: pzo-web/src/engines/chat/intelligence/ChatLearningBridge.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * This file is the frontend intelligence bridge for the unified chat engine.
 *
 * It owns:
 * - local cold-start profile hydration,
 * - compile-safe learning state before dedicated ML/DL modules land,
 * - telemetry preparation and queueing,
 * - offline-tolerant emission,
 * - heuristics for engagement / drop-off / helper need / hater tolerance,
 * - channel affinity scoring,
 * - bridge-safe feature snapshot derivation,
 * - server profile merge without surrendering local responsiveness.
 *
 * It does NOT own:
 * - final transcript truth,
 * - moderation enforcement,
 * - durable training labels,
 * - authoritative ranking,
 * - backend-only memory retrieval,
 * - final model decisions.
 *
 * Permanent doctrine
 * ------------------
 * - Frontend learns first, but never rules last.
 * - Queue emission is mandatory; transport availability is optional.
 * - Local heuristics must degrade gracefully when future submodules do not yet
 *   exist.
 * - The bridge must remain useful while ML/DL files arrive in phases.
 * - Every recorded interaction must be convertible into a telemetry envelope.
 *
 * Compile-safe law
 * ----------------
 * This file intentionally avoids hard runtime imports of not-yet-landed files:
 * - ChatLearningProfile.ts
 * - ChatColdStartProfile.ts
 * - ml/*
 * - dl/*
 * - telemetry/ChatTelemetryEmitter.ts
 * - telemetry/ChatTelemetryQueue.ts
 *
 * Instead it provides injectable ports so later modules can dock into this
 * bridge without forcing circular imports or temporary fake architecture.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import {
  CHAT_ENGINE_AUTHORITIES,
  CHAT_ENGINE_PUBLIC_API_VERSION,
  CHAT_ENGINE_VERSION,
  CHAT_VISIBLE_CHANNELS,
  type JsonObject,
  type JsonValue,
  type Nullable,
  type Score01,
  type UnixMs,
  type ChatAffectSnapshot,
  type ChatAudienceHeat,
  type ChatFeatureSnapshot,
  type ChatLearningProfile,
  type ChatMessage,
  type ChatMessageId,
  type ChatRequestId,
  type ChatTelemetryEnvelope,
  type ChatTelemetryEventName,
  type ChatVisibleChannel,
} from '../types';

/* ========================================================================== */
/* MARK: Public constants                                                     */
/* ========================================================================== */

export const CHAT_LEARNING_BRIDGE_MODULE_NAME =
  'PZO_CHAT_LEARNING_BRIDGE' as const;

export const CHAT_LEARNING_BRIDGE_VERSION = '2026.03.13' as const;

export const CHAT_LEARNING_BRIDGE_RUNTIME_LAWS = Object.freeze([
  'Bridge logic is advisory, not authoritative.',
  'Local state survives transport gaps.',
  'Cold-start defaults are first-class runtime inputs.',
  'Every meaningful interaction can become telemetry.',
  'Queue-before-send is mandatory.',
  'Server revisions merge forward; they do not erase local immediacy.',
  'Helper timing and drop-off pressure should be inferred early.',
  'The bridge can recommend; ChatEngine decides local presentation.',
] as const);

export const CHAT_LEARNING_BRIDGE_DEFAULTS = Object.freeze({
  autoFlushMs: 1_500,
  maxQueueSize: 256,
  maxEventHistory: 512,
  maxFeatureHistory: 128,
  maxEnvelopeBatchSize: 24,
  persistenceVersion: 1,
  quietWindowMs: 12_000,
  disengagementWindowMs: 30_000,
  shameSpikeThreshold: 0.72,
  rescueNeedThreshold: 0.66,
  haterAggressionEscalationThreshold: 0.61,
  helperUrgencyThreshold: 0.58,
} as const);

export const CHAT_LEARNING_BRIDGE_CHANNEL_KEYS = Object.freeze(
  [...CHAT_VISIBLE_CHANNELS] as readonly ChatVisibleChannel[],
);

export const CHAT_LEARNING_BRIDGE_EVENT_NAMES = Object.freeze([
  'chat_opened',
  'chat_closed',
  'mount_activated',
  'channel_viewed',
  'channel_changed',
  'composer_focused',
  'composer_blurred',
  'typing_started',
  'typing_stopped',
  'message_outbound_staged',
  'message_outbound_committed',
  'message_outbound_failed',
  'message_inbound_received',
  'npc_intervention',
  'rescue_decision',
  'affect_snapshot',
  'audience_heat_snapshot',
  'legend_moment',
  'replay_opened',
  'server_profile_applied',
  'cold_start_seeded',
  'bridge_flushed',
] as const);

export type FrontendLearningTelemetryEventName =
  (typeof CHAT_LEARNING_BRIDGE_EVENT_NAMES)[number];

export function isFrontendLearningTelemetryEventName(
  value: string,
): value is FrontendLearningTelemetryEventName {
  return (CHAT_LEARNING_BRIDGE_EVENT_NAMES as readonly string[]).includes(value);
}

/* ========================================================================== */
/* MARK: Public ports                                                         */
/* ========================================================================== */

export interface ChatLearningBridgeClockPort {
  now(): number;
  setTimeout(handler: () => void, ms: number): unknown;
  clearTimeout(token: unknown): void;
}

export interface ChatLearningBridgePersistencePort {
  load(key: string): string | null;
  save(key: string, value: string): void;
  remove?(key: string): void;
}

export interface ChatLearningBridgeTelemetryPort {
  emit?(envelope: ChatTelemetryEnvelope): void | Promise<void>;
  emitBatch?(batch: readonly ChatTelemetryEnvelope[]): void | Promise<void>;
}

export interface ChatLearningBridgeQueueEmitterPort {
  enqueue?(batch: readonly ChatTelemetryEnvelope[]): void | Promise<void>;
}

export interface ChatLearningBridgeFeatureExtractorPort {
  extract(input: ChatLearningBridgeFeatureExtractionInput): ChatFeatureSnapshot;
}

export interface ChatLearningBridgeInferencePort {
  refineProfile?(
    snapshot: ChatLearningBridgePublicSnapshot,
  ):
    | Partial<ChatLearningBridgeProfileState>
    | Promise<Partial<ChatLearningBridgeProfileState> | void>
    | void;
  recommend?(
    snapshot: ChatLearningBridgePublicSnapshot,
  ):
    | ChatLearningBridgeRecommendation
    | Promise<ChatLearningBridgeRecommendation | void>
    | void;
}

export interface ChatLearningBridgeObserver {
  (snapshot: Readonly<ChatLearningBridgePublicSnapshot>): void;
}

export interface ChatLearningBridgeEventObserver {
  (
    envelope: Readonly<ChatTelemetryEnvelope>,
    snapshot: Readonly<ChatLearningBridgePublicSnapshot>,
  ): void;
}

/* ========================================================================== */
/* MARK: Public options                                                       */
/* ========================================================================== */

export interface ChatLearningBridgeOptions {
  readonly sessionId?: string;
  readonly roomId?: string;
  readonly userId?: string;
  readonly activeChannel?: ChatVisibleChannel;
  readonly autoFlushMs?: number;
  readonly maxQueueSize?: number;
  readonly maxEventHistory?: number;
  readonly maxFeatureHistory?: number;
  readonly maxEnvelopeBatchSize?: number;
  readonly storageKey?: string;
  readonly persistenceVersion?: number;
  readonly persistence?: ChatLearningBridgePersistencePort;
  readonly telemetry?: ChatLearningBridgeTelemetryPort;
  readonly queueEmitter?: ChatLearningBridgeQueueEmitterPort;
  readonly featureExtractor?: ChatLearningBridgeFeatureExtractorPort;
  readonly inference?: ChatLearningBridgeInferencePort;
  readonly clock?: ChatLearningBridgeClockPort;
  readonly initialProfile?: ChatLearningProfile;
  readonly initialDisplayName?: string;
  readonly enablePersistence?: boolean;
  readonly emitOnEveryEvent?: boolean;
  readonly autoSeedColdStart?: boolean;
}

/* ========================================================================== */
/* MARK: Public snapshots and recommendations                                 */
/* ========================================================================== */

export interface ChatLearningBridgeRecommendation {
  readonly recommendedChannel: ChatVisibleChannel;
  readonly helperUrgency01: number;
  readonly rescueNeeded: boolean;
  readonly haterAggression01: number;
  readonly dropOffRisk01: number;
  readonly explanation: string;
}

export interface ChatLearningBridgeHeuristicSignals {
  readonly engagement01: number;
  readonly dropOffRisk01: number;
  readonly helperNeed01: number;
  readonly haterTolerance01: number;
  readonly shameSensitivity01: number;
  readonly confidence01: number;
  readonly dealRoomAffinity01: number;
  readonly syndicateAffinity01: number;
  readonly globalAffinity01: number;
  readonly typingCommitment01: number;
  readonly rescueNeed01: number;
  readonly crowdStress01: number;
}

export interface ChatLearningBridgePreparedEnvelope {
  readonly envelope: ChatTelemetryEnvelope;
  readonly snapshot: ChatLearningBridgePublicSnapshot;
}

export interface ChatLearningBridgePreparedBatch {
  readonly envelopes: readonly ChatTelemetryEnvelope[];
  readonly snapshot: ChatLearningBridgePublicSnapshot;
}

export type ChatLearningBridgeServerSyncReason =
  | 'INITIAL_SEED'
  | 'AUTHORITATIVE_REFRESH'
  | 'POST_FLUSH'
  | 'RECOVERY'
  | 'ROOM_TRANSITION'
  | 'MANUAL';

export interface ChatLearningBridgeQueueItem {
  readonly queueId: string;
  readonly telemetryId: string;
  readonly eventName: FrontendLearningTelemetryEventName;
  readonly occurredAtMs: UnixMs;
  readonly envelope: ChatTelemetryEnvelope;
}

/* ========================================================================== */
/* MARK: Internal profile state                                               */
/* ========================================================================== */

export interface ChatLearningBridgeProfileState {
  readonly userId: string;
  readonly roomId: Nullable<string>;
  readonly sessionId: string;
  readonly displayName: string;
  readonly revision: number;
  readonly lastUpdatedAtMs: UnixMs;

  readonly preferredChannel: ChatVisibleChannel;

  readonly totalSessionsSeen: number;
  readonly totalRunsSeen: number;
  readonly totalChatOpens: number;
  readonly totalMessagesOutbound: number;
  readonly totalMessagesInbound: number;
  readonly totalHelperContacts: number;
  readonly totalHaterContacts: number;
  readonly totalRescueContacts: number;
  readonly totalReplayOpens: number;
  readonly totalLegendMoments: number;

  readonly engagement01: number;
  readonly dropOffRisk01: number;
  readonly helperNeed01: number;
  readonly haterTolerance01: number;
  readonly shameSensitivity01: number;
  readonly confidence01: number;
  readonly typingCommitment01: number;
  readonly rescueNeed01: number;

  readonly globalAffinity01: number;
  readonly syndicateAffinity01: number;
  readonly dealRoomAffinity01: number;

  readonly lastServerSyncReason: Nullable<ChatLearningBridgeServerSyncReason>;
  readonly lastServerSyncAtMs: Nullable<UnixMs>;
  readonly serverRevisionApplied: number;
}

interface ChatLearningBridgeSessionState {
  activeChannel: ChatVisibleChannel;
  openedAtMs: Nullable<UnixMs>;
  lastEventAtMs: Nullable<UnixMs>;
  lastFlushAtMs: Nullable<UnixMs>;
  lastInboundAtMs: Nullable<UnixMs>;
  lastOutboundAtMs: Nullable<UnixMs>;
  lastTypingStartAtMs: Nullable<UnixMs>;
  lastComposerFocusAtMs: Nullable<UnixMs>;

  mountTarget: Nullable<string>;
  isOpen: boolean;
  isTyping: boolean;
  hasComposerFocus: boolean;

  queue: ChatLearningBridgeQueueItem[];
  recentEventNames: FrontendLearningTelemetryEventName[];
  recentFeatureHistory: ChatFeatureSnapshot[];
  recentMessageIds: string[];
  recentFailedRequestIds: string[];

  channelViews: Record<ChatVisibleChannel, number>;
  channelDwellsMs: Record<ChatVisibleChannel, number>;
  channelSwitches: Record<ChatVisibleChannel, number>;

  outboundByChannel: Record<ChatVisibleChannel, number>;
  inboundByChannel: Record<ChatVisibleChannel, number>;

  helperContactsByChannel: Record<ChatVisibleChannel, number>;
  haterContactsByChannel: Record<ChatVisibleChannel, number>;

  rollingTypingDurationsMs: number[];
  rollingResponseDelaysMs: number[];
  rollingDraftLengths: number[];
  rollingAffectIntensity: number[];
  rollingAudienceHeat: number[];

  outboundCount: number;
  inboundCount: number;
  helperCount: number;
  haterCount: number;
  rescueCount: number;
  replayOpenCount: number;
  legendCount: number;
  composerFocusCount: number;
  composerBlurCount: number;
  typingStartCount: number;
  typingStopCount: number;
  failureCount: number;
}

/* ========================================================================== */
/* MARK: Extraction input                                                     */
/* ========================================================================== */

export interface ChatLearningBridgeFeatureExtractionInput {
  readonly profile: Readonly<ChatLearningBridgeProfileState>;
  readonly session: Readonly<ChatLearningBridgeSessionState>;
  readonly heuristicSignals: Readonly<ChatLearningBridgeHeuristicSignals>;
  readonly eventName: FrontendLearningTelemetryEventName;
  readonly occurredAtMs: UnixMs;
  readonly activeChannel: ChatVisibleChannel;
  readonly payload: Readonly<JsonObject>;
}

export interface ChatLearningBridgePublicSnapshot {
  readonly moduleName: typeof CHAT_LEARNING_BRIDGE_MODULE_NAME;
  readonly moduleVersion: typeof CHAT_LEARNING_BRIDGE_VERSION;
  readonly engineVersion: typeof CHAT_ENGINE_VERSION;
  readonly publicApiVersion: typeof CHAT_ENGINE_PUBLIC_API_VERSION;
  readonly authorities: typeof CHAT_ENGINE_AUTHORITIES;

  readonly roomId: Nullable<string>;
  readonly sessionId: string;
  readonly userId: string;
  readonly displayName: string;

  readonly activeChannel: ChatVisibleChannel;
  readonly isOpen: boolean;
  readonly queueDepth: number;
  readonly pendingFlush: boolean;

  readonly profile: Readonly<ChatLearningBridgeProfileState>;
  readonly heuristicSignals: Readonly<ChatLearningBridgeHeuristicSignals>;
  readonly latestFeatureSnapshot: Nullable<ChatFeatureSnapshot>;
  readonly lastRecommendation: Nullable<ChatLearningBridgeRecommendation>;
}

/* ========================================================================== */
/* MARK: Defaults                                                             */
/* ========================================================================== */

const DEFAULT_CLOCK: ChatLearningBridgeClockPort = {
  now: () => Date.now(),
  setTimeout: (handler, ms) => globalThis.setTimeout(handler, ms),
  clearTimeout: (token) => globalThis.clearTimeout(token as number),
};

const DEFAULT_PERSISTENCE: ChatLearningBridgePersistencePort = {
  load: (key) => {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  save: (key, value) => {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      //
    }
  },
  remove: (key) => {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      //
    }
  },
};

const NOOP_TELEMETRY: ChatLearningBridgeTelemetryPort = {
  emit: () => undefined,
  emitBatch: () => undefined,
};

const NOOP_QUEUE_EMITTER: ChatLearningBridgeQueueEmitterPort = {
  enqueue: () => undefined,
};

/* ========================================================================== */
/* MARK: Utility helpers                                                      */
/* ========================================================================== */

function nowAsUnixMs(clock: ChatLearningBridgeClockPort): UnixMs {
  return clock.now() as UnixMs;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function lerp01(current: number, next: number, alpha: number): number {
  return clamp01(current + (next - current) * clamp01(alpha));
}

function average(values: readonly number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maxLast<T>(values: readonly T[], limit: number): T[] {
  if (values.length <= limit) return [...values];
  return [...values.slice(values.length - limit)];
}

function createId(prefix: string): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return `${prefix}_${globalThis.crypto.randomUUID().replace(/-/g, '')}`;
    }
  } catch {
    //
  }

  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function toTelemetryEventName(
  value: FrontendLearningTelemetryEventName,
): ChatTelemetryEventName {
  return value as ChatTelemetryEventName;
}

function safeJsonClone<T>(value: T): T {
  try {
    if (typeof globalThis.structuredClone === 'function') {
      return globalThis.structuredClone(value);
    }
  } catch {
    //
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function buildStorageKey(options: ChatLearningBridgeOptions): string {
  if (options.storageKey && options.storageKey.trim().length > 0) {
    return options.storageKey;
  }

  const userKey = options.userId?.trim() || 'anonymous';
  const roomKey = options.roomId?.trim() || 'roomless';
  const sessionKey = options.sessionId?.trim() || 'sessionless';

  return `pzo.chat.learning.${userKey}.${roomKey}.${sessionKey}.v${options.persistenceVersion ?? CHAT_LEARNING_BRIDGE_DEFAULTS.persistenceVersion}`;
}

function asJsonObject(value: Record<string, JsonValue>): JsonObject {
  return value as JsonObject;
}

function createChannelNumberMap(seed = 0): Record<ChatVisibleChannel, number> {
  return CHAT_VISIBLE_CHANNELS.reduce((acc, channelId) => {
    acc[channelId] = seed;
    return acc;
  }, {} as Record<ChatVisibleChannel, number>);
}

function normalizeVisibleChannel(
  value: Nullable<string>,
  fallback: ChatVisibleChannel,
): ChatVisibleChannel {
  if (
    value &&
    (CHAT_VISIBLE_CHANNELS as readonly string[]).includes(value)
  ) {
    return value as ChatVisibleChannel;
  }

  return fallback;
}

function extractMessageChannel(
  message: ChatMessage | Record<string, unknown>,
  fallback: ChatVisibleChannel,
): ChatVisibleChannel {
  const raw =
    (message as any)?.channelId ??
    (message as any)?.channel ??
    (message as any)?.roomChannel ??
    null;

  return normalizeVisibleChannel(
    typeof raw === 'string' ? raw : null,
    fallback,
  );
}

function extractMessageId(message: ChatMessage | Record<string, unknown>): string {
  const raw =
    (message as any)?.messageId ??
    (message as any)?.id ??
    (message as any)?.clientMessageId ??
    null;

  return typeof raw === 'string' && raw.length > 0 ? raw : createId('msg');
}

function extractMessageTextLength(
  message: ChatMessage | Record<string, unknown>,
): number {
  const raw =
    (message as any)?.body ??
    (message as any)?.text ??
    (message as any)?.content ??
    '';

  return typeof raw === 'string' ? raw.length : 0;
}

function extractAuthorRole(
  message: ChatMessage | Record<string, unknown>,
): 'PLAYER' | 'HELPER' | 'HATER' | 'SYSTEM' | 'NPC' | 'UNKNOWN' {
  const raw =
    (message as any)?.author?.role ??
    (message as any)?.authorRole ??
    (message as any)?.sourceRole ??
    (message as any)?.senderRole ??
    null;

  if (typeof raw !== 'string') return 'UNKNOWN';

  const normalized = raw.toUpperCase();

  if (normalized.includes('PLAYER')) return 'PLAYER';
  if (normalized.includes('HELPER')) return 'HELPER';
  if (normalized.includes('HATER')) return 'HATER';
  if (normalized.includes('SYSTEM')) return 'SYSTEM';
  if (normalized.includes('NPC')) return 'NPC';

  return 'UNKNOWN';
}

function extractAffectIntensity01(snapshot: Nullable<ChatAffectSnapshot>): number {
  if (!snapshot) return 0;

  const raw =
    (snapshot as any)?.intensity01 ??
    (snapshot as any)?.affect01 ??
    (snapshot as any)?.pressure01 ??
    (snapshot as any)?.magnitude01 ??
    0;

  return clamp01(Number(raw) || 0);
}

function extractAudienceHeat01(snapshot: Nullable<ChatAudienceHeat>): number {
  if (!snapshot) return 0;

  const raw =
    (snapshot as any)?.heat01 ??
    (snapshot as any)?.intensity01 ??
    (snapshot as any)?.score01 ??
    (snapshot as any)?.magnitude01 ??
    0;

  return clamp01(Number(raw) || 0);
}

function scoreFromCount(count: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return clamp01(count / denominator);
}

function buildDefaultProfileState(
  options: ChatLearningBridgeOptions,
  clock: ChatLearningBridgeClockPort,
): ChatLearningBridgeProfileState {
  const now = nowAsUnixMs(clock);
  const userId = options.userId?.trim() || 'anonymous';
  const roomId = options.roomId?.trim() || null;
  const sessionId = options.sessionId?.trim() || createId('session');
  const displayName = options.initialDisplayName?.trim() || 'PLAYER';

  return {
    userId,
    roomId,
    sessionId,
    displayName,
    revision: 1,
    lastUpdatedAtMs: now,

    preferredChannel: options.activeChannel ?? 'GLOBAL',

    totalSessionsSeen: 1,
    totalRunsSeen: 0,
    totalChatOpens: 0,
    totalMessagesOutbound: 0,
    totalMessagesInbound: 0,
    totalHelperContacts: 0,
    totalHaterContacts: 0,
    totalRescueContacts: 0,
    totalReplayOpens: 0,
    totalLegendMoments: 0,

    engagement01: 0.18,
    dropOffRisk01: 0.30,
    helperNeed01: 0.22,
    haterTolerance01: 0.40,
    shameSensitivity01: 0.45,
    confidence01: 0.48,
    typingCommitment01: 0.22,
    rescueNeed01: 0.24,

    globalAffinity01: 0.50,
    syndicateAffinity01: 0.50,
    dealRoomAffinity01: 0.50,

    lastServerSyncReason: null,
    lastServerSyncAtMs: null,
    serverRevisionApplied: 0,
  };
}

function buildDefaultSessionState(
  activeChannel: ChatVisibleChannel,
): ChatLearningBridgeSessionState {
  return {
    activeChannel,
    openedAtMs: null,
    lastEventAtMs: null,
    lastFlushAtMs: null,
    lastInboundAtMs: null,
    lastOutboundAtMs: null,
    lastTypingStartAtMs: null,
    lastComposerFocusAtMs: null,

    mountTarget: null,
    isOpen: false,
    isTyping: false,
    hasComposerFocus: false,

    queue: [],
    recentEventNames: [],
    recentFeatureHistory: [],
    recentMessageIds: [],
    recentFailedRequestIds: [],

    channelViews: createChannelNumberMap(0),
    channelDwellsMs: createChannelNumberMap(0),
    channelSwitches: createChannelNumberMap(0),

    outboundByChannel: createChannelNumberMap(0),
    inboundByChannel: createChannelNumberMap(0),

    helperContactsByChannel: createChannelNumberMap(0),
    haterContactsByChannel: createChannelNumberMap(0),

    rollingTypingDurationsMs: [],
    rollingResponseDelaysMs: [],
    rollingDraftLengths: [],
    rollingAffectIntensity: [],
    rollingAudienceHeat: [],

    outboundCount: 0,
    inboundCount: 0,
    helperCount: 0,
    haterCount: 0,
    rescueCount: 0,
    replayOpenCount: 0,
    legendCount: 0,
    composerFocusCount: 0,
    composerBlurCount: 0,
    typingStartCount: 0,
    typingStopCount: 0,
    failureCount: 0,
  };
}

/* ========================================================================== */
/* MARK: Bridge implementation                                                */
/* ========================================================================== */

export class ChatLearningBridge {
  private readonly clock: ChatLearningBridgeClockPort;
  private readonly persistence: ChatLearningBridgePersistencePort;
  private readonly telemetry: ChatLearningBridgeTelemetryPort;
  private readonly queueEmitter: ChatLearningBridgeQueueEmitterPort;
  private readonly featureExtractor: Nullable<ChatLearningBridgeFeatureExtractorPort>;
  private readonly inference: Nullable<ChatLearningBridgeInferencePort>;
  private readonly observers = new Set<ChatLearningBridgeObserver>();
  private readonly eventObservers = new Set<ChatLearningBridgeEventObserver>();
  private readonly options: Required<
    Pick<
      ChatLearningBridgeOptions,
      | 'autoFlushMs'
      | 'maxQueueSize'
      | 'maxEventHistory'
      | 'maxFeatureHistory'
      | 'maxEnvelopeBatchSize'
      | 'enablePersistence'
      | 'emitOnEveryEvent'
      | 'autoSeedColdStart'
      | 'persistenceVersion'
    >
  > &
    Omit<
      ChatLearningBridgeOptions,
      | 'autoFlushMs'
      | 'maxQueueSize'
      | 'maxEventHistory'
      | 'maxFeatureHistory'
      | 'maxEnvelopeBatchSize'
      | 'enablePersistence'
      | 'emitOnEveryEvent'
      | 'autoSeedColdStart'
      | 'persistenceVersion'
    >;
  private readonly storageKey: string;

  private profile: ChatLearningBridgeProfileState;
  private session: ChatLearningBridgeSessionState;
  private latestFeatureSnapshot: Nullable<ChatFeatureSnapshot> = null;
  private latestRecommendation: Nullable<ChatLearningBridgeRecommendation> = null;

  private pendingFlushToken: Nullable<unknown> = null;
  private isDestroyed = false;
  private isFlushing = false;

  constructor(options: ChatLearningBridgeOptions = {}) {
    this.clock = options.clock ?? DEFAULT_CLOCK;
    this.persistence = options.persistence ?? DEFAULT_PERSISTENCE;
    this.telemetry = options.telemetry ?? NOOP_TELEMETRY;
    this.queueEmitter = options.queueEmitter ?? NOOP_QUEUE_EMITTER;
    this.featureExtractor = options.featureExtractor ?? null;
    this.inference = options.inference ?? null;

    this.options = {
      ...options,
      autoFlushMs: options.autoFlushMs ?? CHAT_LEARNING_BRIDGE_DEFAULTS.autoFlushMs,
      maxQueueSize: options.maxQueueSize ?? CHAT_LEARNING_BRIDGE_DEFAULTS.maxQueueSize,
      maxEventHistory:
        options.maxEventHistory ?? CHAT_LEARNING_BRIDGE_DEFAULTS.maxEventHistory,
      maxFeatureHistory:
        options.maxFeatureHistory ??
        CHAT_LEARNING_BRIDGE_DEFAULTS.maxFeatureHistory,
      maxEnvelopeBatchSize:
        options.maxEnvelopeBatchSize ??
        CHAT_LEARNING_BRIDGE_DEFAULTS.maxEnvelopeBatchSize,
      enablePersistence: options.enablePersistence ?? true,
      emitOnEveryEvent: options.emitOnEveryEvent ?? false,
      autoSeedColdStart: options.autoSeedColdStart ?? true,
      persistenceVersion:
        options.persistenceVersion ??
        CHAT_LEARNING_BRIDGE_DEFAULTS.persistenceVersion,
    };

    this.storageKey = buildStorageKey(this.options);
    this.profile = buildDefaultProfileState(this.options, this.clock);
    this.session = buildDefaultSessionState(
      this.options.activeChannel ?? this.profile.preferredChannel,
    );

    this.hydrateFromPersistence();

    if (this.options.initialProfile) {
      this.applyServerLearningProfile(this.options.initialProfile, 'INITIAL_SEED');
    } else if (this.options.autoSeedColdStart) {
      this.seedColdStart();
    }
  }

  /* ====================================================================== */
  /* MARK: Public lifecycle                                                 */
  /* ====================================================================== */

  subscribe(observer: ChatLearningBridgeObserver): () => void {
    this.observers.add(observer);
    observer(this.getPublicSnapshot());

    return () => {
      this.observers.delete(observer);
    };
  }

  subscribeToEvents(observer: ChatLearningBridgeEventObserver): () => void {
    this.eventObservers.add(observer);

    return () => {
      this.eventObservers.delete(observer);
    };
  }

  destroy(): void {
    if (this.isDestroyed) return;

    this.cancelPendingFlush();
    this.persistIfEnabled();
    this.observers.clear();
    this.eventObservers.clear();
    this.isDestroyed = true;
  }

  /* ====================================================================== */
  /* MARK: Public getters                                                   */
  /* ====================================================================== */

  getProfile(): ChatLearningProfile {
    return safeJsonClone(this.profile) as ChatLearningProfile;
  }

  getPublicSnapshot(): ChatLearningBridgePublicSnapshot {
    return Object.freeze({
      moduleName: CHAT_LEARNING_BRIDGE_MODULE_NAME,
      moduleVersion: CHAT_LEARNING_BRIDGE_VERSION,
      engineVersion: CHAT_ENGINE_VERSION,
      publicApiVersion: CHAT_ENGINE_PUBLIC_API_VERSION,
      authorities: CHAT_ENGINE_AUTHORITIES,

      roomId: this.profile.roomId,
      sessionId: this.profile.sessionId,
      userId: this.profile.userId,
      displayName: this.profile.displayName,

      activeChannel: this.session.activeChannel,
      isOpen: this.session.isOpen,
      queueDepth: this.session.queue.length,
      pendingFlush: this.pendingFlushToken !== null,

      profile: safeJsonClone(this.profile),
      heuristicSignals: this.computeHeuristicSignals(),
      latestFeatureSnapshot: this.latestFeatureSnapshot
        ? safeJsonClone(this.latestFeatureSnapshot)
        : null,
      lastRecommendation: this.latestRecommendation
        ? safeJsonClone(this.latestRecommendation)
        : null,
    });
  }

  getPendingQueue(): readonly ChatLearningBridgeQueueItem[] {
    return this.session.queue.map((item) => safeJsonClone(item));
  }

  getLatestFeatureSnapshot(): Nullable<ChatFeatureSnapshot> {
    return this.latestFeatureSnapshot
      ? safeJsonClone(this.latestFeatureSnapshot)
      : null;
  }

  getLatestRecommendation(): Nullable<ChatLearningBridgeRecommendation> {
    return this.latestRecommendation
      ? safeJsonClone(this.latestRecommendation)
      : null;
  }

  /* ====================================================================== */
  /* MARK: Server sync                                                      */
  /* ====================================================================== */

  applyServerLearningProfile(
    profile: ChatLearningProfile,
    reason: ChatLearningBridgeServerSyncReason = 'MANUAL',
  ): void {
    const now = nowAsUnixMs(this.clock);
    const incoming = (profile as any) ?? {};

    this.profile = {
      ...this.profile,
      ...(incoming as Partial<ChatLearningBridgeProfileState>),
      preferredChannel: normalizeVisibleChannel(
        typeof incoming.preferredChannel === 'string'
          ? incoming.preferredChannel
          : this.profile.preferredChannel,
        this.profile.preferredChannel,
      ),
      revision: Math.max(
        this.profile.revision + 1,
        Number(incoming.revision) || this.profile.revision + 1,
      ),
      serverRevisionApplied: Math.max(
        this.profile.serverRevisionApplied,
        Number(incoming.serverRevisionApplied) ||
          Number(incoming.revision) ||
          this.profile.serverRevisionApplied,
      ),
      lastServerSyncReason: reason,
      lastServerSyncAtMs: now,
      lastUpdatedAtMs: now,
    };

    this.recordInternal(
      'server_profile_applied',
      asJsonObject({
        reason,
        appliedRevision: this.profile.revision,
      }),
      now,
    );
  }

  seedColdStart(): void {
    const now = nowAsUnixMs(this.clock);

    this.profile = {
      ...this.profile,
      revision: this.profile.revision + 1,
      lastUpdatedAtMs: now,
    };

    this.recordInternal(
      'cold_start_seeded',
      asJsonObject({
        preferredChannel: this.profile.preferredChannel,
        confidence01: this.profile.confidence01,
        dropOffRisk01: this.profile.dropOffRisk01,
      }),
      now,
    );
  }

  /* ====================================================================== */
  /* MARK: Public event recorders                                            */
  /* ====================================================================== */

  recordChatOpened(mountTarget?: string): void {
    const now = nowAsUnixMs(this.clock);

    this.session.isOpen = true;
    this.session.openedAtMs = now;
    this.session.mountTarget = mountTarget ?? this.session.mountTarget;
    this.profile = {
      ...this.profile,
      totalChatOpens: this.profile.totalChatOpens + 1,
      engagement01: lerp01(this.profile.engagement01, 0.58, 0.18),
      dropOffRisk01: lerp01(this.profile.dropOffRisk01, 0.26, 0.12),
      lastUpdatedAtMs: now,
      revision: this.profile.revision + 1,
    };

    this.recordInternal(
      'chat_opened',
      asJsonObject({
        mountTarget: this.session.mountTarget,
        activeChannel: this.session.activeChannel,
      }),
      now,
    );
  }

  recordChatClosed(reason = 'USER_CLOSE'): void {
    const now = nowAsUnixMs(this.clock);

    this.session.isOpen = false;
    this.session.hasComposerFocus = false;
    this.session.isTyping = false;

    this.recordInternal(
      'chat_closed',
      asJsonObject({
        reason,
        activeChannel: this.session.activeChannel,
      }),
      now,
    );
  }

  recordMountActivated(mountTarget: string): void {
    const now = nowAsUnixMs(this.clock);
    this.session.mountTarget = mountTarget;

    this.recordInternal(
      'mount_activated',
      asJsonObject({
        mountTarget,
        activeChannel: this.session.activeChannel,
      }),
      now,
    );
  }

  recordChannelViewed(channelId: ChatVisibleChannel): void {
    const now = nowAsUnixMs(this.clock);
    this.session.channelViews[channelId] += 1;
    this.bumpChannelAffinity(channelId, 0.025);

    this.recordInternal(
      'channel_viewed',
      asJsonObject({
        channelId,
        viewCount: this.session.channelViews[channelId],
      }),
      now,
    );
  }

  recordChannelChanged(
    channelId: ChatVisibleChannel,
    reason = 'USER_SWITCH',
  ): void {
    const now = nowAsUnixMs(this.clock);
    const previousChannel = this.session.activeChannel;

    if (previousChannel === channelId) {
      this.recordChannelViewed(channelId);
      return;
    }

    if (this.session.lastEventAtMs) {
      const dwellDelta = Math.max(0, now - this.session.lastEventAtMs);
      this.session.channelDwellsMs[previousChannel] += dwellDelta;
    }

    this.session.channelSwitches[channelId] += 1;
    this.session.activeChannel = channelId;
    this.profile = {
      ...this.profile,
      preferredChannel: this.computeRecommendedChannel(),
      lastUpdatedAtMs: now,
      revision: this.profile.revision + 1,
    };

    this.bumpChannelAffinity(channelId, 0.055);

    this.recordInternal(
      'channel_changed',
      asJsonObject({
        fromChannelId: previousChannel,
        toChannelId: channelId,
        reason,
      }),
      now,
    );
  }

  recordComposerFocused(channelId = this.session.activeChannel): void {
    const now = nowAsUnixMs(this.clock);
    this.session.hasComposerFocus = true;
    this.session.lastComposerFocusAtMs = now;
    this.session.composerFocusCount += 1;

    this.profile = {
      ...this.profile,
      typingCommitment01: lerp01(this.profile.typingCommitment01, 0.62, 0.14),
      engagement01: lerp01(this.profile.engagement01, 0.64, 0.08),
      lastUpdatedAtMs: now,
      revision: this.profile.revision + 1,
    };

    this.recordInternal(
      'composer_focused',
      asJsonObject({
        channelId,
        composerFocusCount: this.session.composerFocusCount,
      }),
      now,
    );
  }

  recordComposerBlurred(
    channelId = this.session.activeChannel,
    draftLength = 0,
  ): void {
    const now = nowAsUnixMs(this.clock);
    this.session.hasComposerFocus = false;
    this.session.composerBlurCount += 1;
    this.session.rollingDraftLengths = maxLast(
      [...this.session.rollingDraftLengths, Math.max(0, draftLength)],
      32,
    );

    const abortedLongDraft =
      draftLength >= 64 && !this.session.isTyping && !this.session.outboundCount;

    this.profile = {
      ...this.profile,
      dropOffRisk01: lerp01(
        this.profile.dropOffRisk01,
        abortedLongDraft ? 0.74 : 0.34,
        abortedLongDraft ? 0.14 : 0.06,
      ),
      lastUpdatedAtMs: now,
      revision: this.profile.revision + 1,
    };

    this.recordInternal(
      'composer_blurred',
      asJsonObject({
        channelId,
        draftLength,
        composerBlurCount: this.session.composerBlurCount,
      }),
      now,
    );
  }

  recordTypingStarted(channelId = this.session.activeChannel): void {
    const now = nowAsUnixMs(this.clock);
    this.session.isTyping = true;
    this.session.lastTypingStartAtMs = now;
    this.session.typingStartCount += 1;

    this.recordInternal(
      'typing_started',
      asJsonObject({
        channelId,
        typingStartCount: this.session.typingStartCount,
      }),
      now,
    );
  }

  recordTypingStopped(channelId = this.session.activeChannel): void {
    const now = nowAsUnixMs(this.clock);
    this.session.isTyping = false;
    this.session.typingStopCount += 1;

    if (this.session.lastTypingStartAtMs) {
      const typingMs = Math.max(0, now - this.session.lastTypingStartAtMs);
      this.session.rollingTypingDurationsMs = maxLast(
        [...this.session.rollingTypingDurationsMs, typingMs],
        32,
      );

      this.profile = {
        ...this.profile,
        typingCommitment01: lerp01(
          this.profile.typingCommitment01,
          clamp01(typingMs / 3_000),
          0.10,
        ),
        lastUpdatedAtMs: now,
        revision: this.profile.revision + 1,
      };
    }

    this.recordInternal(
      'typing_stopped',
      asJsonObject({
        channelId,
        typingStopCount: this.session.typingStopCount,
      }),
      now,
    );
  }

  recordOutboundMessageStaged(
    message: ChatMessage | Record<string, unknown>,
    requestId?: string,
  ): void {
    const now = nowAsUnixMs(this.clock);
    const channelId = extractMessageChannel(message, this.session.activeChannel);
    const messageId = extractMessageId(message);

    this.session.outboundCount += 1;
    this.session.outboundByChannel[channelId] += 1;
    this.session.lastOutboundAtMs = now;
    this.session.recentMessageIds = maxLast(
      [...this.session.recentMessageIds, messageId],
      64,
    );

    const draftLength = extractMessageTextLength(message);
    this.session.rollingDraftLengths = maxLast(
      [...this.session.rollingDraftLengths, draftLength],
      32,
    );

    this.bumpChannelAffinity(channelId, 0.08);

    this.profile = {
      ...this.profile,
      totalMessagesOutbound: this.profile.totalMessagesOutbound + 1,
      engagement01: lerp01(this.profile.engagement01, 0.76, 0.09),
      confidence01: lerp01(this.profile.confidence01, 0.64, 0.07),
      dropOffRisk01: lerp01(this.profile.dropOffRisk01, 0.22, 0.06),
      lastUpdatedAtMs: now,
      revision: this.profile.revision + 1,
    };

    this.recordInternal(
      'message_outbound_staged',
      asJsonObject({
        channelId,
        messageId,
        requestId: requestId ?? null,
        draftLength,
      }),
      now,
    );
  }

  recordOutboundMessageCommitted(
    message: ChatMessage | Record<string, unknown>,
    requestId?: string,
  ): void {
    const now = nowAsUnixMs(this.clock);
    const channelId = extractMessageChannel(message, this.session.activeChannel);
    const messageId = extractMessageId(message);

    this.profile = {
      ...this.profile,
      confidence01: lerp01(this.profile.confidence01, 0.72, 0.08),
      lastUpdatedAtMs: now,
      revision: this.profile.revision + 1,
    };

    this.recordInternal(
      'message_outbound_committed',
      asJsonObject({
        channelId,
        messageId,
        requestId: requestId ?? null,
      }),
      now,
    );
  }

  recordOutboundMessageFailed(
    requestId: ChatRequestId | string,
    reason = 'TRANSPORT_FAILURE',
  ): void {
    const now = nowAsUnixMs(this.clock);

    this.session.failureCount += 1;
    this.session.recentFailedRequestIds = maxLast(
      [...this.session.recentFailedRequestIds, String(requestId)],
      64,
    );

    this.profile = {
      ...this.profile,
      dropOffRisk01: lerp01(this.profile.dropOffRisk01, 0.66, 0.13),
      helperNeed01: lerp01(this.profile.helperNeed01, 0.58, 0.09),
      confidence01: lerp01(this.profile.confidence01, 0.34, 0.12),
      lastUpdatedAtMs: now,
      revision: this.profile.revision + 1,
    };

    this.recordInternal(
      'message_outbound_failed',
      asJsonObject({
        requestId: String(requestId),
        reason,
        failureCount: this.session.failureCount,
      }),
      now,
    );
  }

  recordInboundMessage(
    message: ChatMessage | Record<string, unknown>,
  ): void {
    const now = nowAsUnixMs(this.clock);
    const channelId = extractMessageChannel(message, this.session.activeChannel);
    const messageId = extractMessageId(message);
    const authorRole = extractAuthorRole(message);

    this.session.inboundCount += 1;
    this.session.inboundByChannel[channelId] += 1;
    this.session.lastInboundAtMs = now;
    this.session.recentMessageIds = maxLast(
      [...this.session.recentMessageIds, messageId],
      64,
    );

    if (this.session.lastOutboundAtMs) {
      const responseDelayMs = Math.max(0, now - this.session.lastOutboundAtMs);
      this.session.rollingResponseDelaysMs = maxLast(
        [...this.session.rollingResponseDelaysMs, responseDelayMs],
        32,
      );
    }

    if (authorRole === 'HELPER') {
      this.session.helperCount += 1;
      this.session.helperContactsByChannel[channelId] += 1;

      this.profile = {
        ...this.profile,
        totalHelperContacts: this.profile.totalHelperContacts + 1,
        helperNeed01: lerp01(this.profile.helperNeed01, 0.42, 0.07),
        dropOffRisk01: lerp01(this.profile.dropOffRisk01, 0.21, 0.09),
        confidence01: lerp01(this.profile.confidence01, 0.59, 0.06),
        lastUpdatedAtMs: now,
        revision: this.profile.revision + 1,
      };
    } else if (authorRole === 'HATER') {
      this.session.haterCount += 1;
      this.session.haterContactsByChannel[channelId] += 1;

      this.profile = {
        ...this.profile,
        totalHaterContacts: this.profile.totalHaterContacts + 1,
        haterTolerance01: lerp01(this.profile.haterTolerance01, 0.57, 0.06),
        shameSensitivity01: lerp01(this.profile.shameSensitivity01, 0.68, 0.09),
        confidence01: lerp01(this.profile.confidence01, 0.38, 0.08),
        lastUpdatedAtMs: now,
        revision: this.profile.revision + 1,
      };
    } else {
      this.profile = {
        ...this.profile,
        totalMessagesInbound: this.profile.totalMessagesInbound + 1,
        engagement01: lerp01(this.profile.engagement01, 0.60, 0.05),
        lastUpdatedAtMs: now,
        revision: this.profile.revision + 1,
      };
    }

    this.recordInternal(
      'message_inbound_received',
      asJsonObject({
        channelId,
        messageId,
        authorRole,
        textLength: extractMessageTextLength(message),
      }),
      now,
    );
  }

  recordNpcIntervention(
    kind: 'HELPER' | 'HATER' | 'AMBIENT' | 'SYSTEM',
    payload: Record<string, JsonValue> = {},
  ): void {
    const now = nowAsUnixMs(this.clock);

    if (kind === 'HELPER') {
      this.profile = {
        ...this.profile,
        helperNeed01: lerp01(this.profile.helperNeed01, 0.44, 0.05),
        lastUpdatedAtMs: now,
        revision: this.profile.revision + 1,
      };
    } else if (kind === 'HATER') {
      this.profile = {
        ...this.profile,
        shameSensitivity01: lerp01(this.profile.shameSensitivity01, 0.64, 0.07),
        lastUpdatedAtMs: now,
        revision: this.profile.revision + 1,
      };
    }

    this.recordInternal(
      'npc_intervention',
      asJsonObject({
        kind,
        channelId: this.session.activeChannel,
        ...payload,
      }),
      now,
    );
  }

  recordRescueDecision(
    decision:
      | 'PROMPT'
      | 'BANNER'
      | 'QUIET_COMFORT'
      | 'NO_ACTION'
      | 'GUIDED_RECOVERY',
    payload: Record<string, JsonValue> = {},
  ): void {
    const now = nowAsUnixMs(this.clock);

    this.session.rescueCount += 1;
    this.profile = {
      ...this.profile,
      totalRescueContacts: this.profile.totalRescueContacts + 1,
      rescueNeed01: lerp01(
        this.profile.rescueNeed01,
        decision === 'NO_ACTION' ? 0.34 : 0.61,
        0.10,
      ),
      helperNeed01: lerp01(this.profile.helperNeed01, 0.63, 0.08),
      lastUpdatedAtMs: now,
      revision: this.profile.revision + 1,
    };

    this.recordInternal(
      'rescue_decision',
      asJsonObject({
        decision,
        channelId: this.session.activeChannel,
        ...payload,
      }),
      now,
    );
  }

  recordAffectSnapshot(
    affect: Nullable<ChatAffectSnapshot>,
    payload: Record<string, JsonValue> = {},
  ): void {
    const now = nowAsUnixMs(this.clock);
    const affect01 = extractAffectIntensity01(affect);

    this.session.rollingAffectIntensity = maxLast(
      [...this.session.rollingAffectIntensity, affect01],
      32,
    );

    this.profile = {
      ...this.profile,
      dropOffRisk01: lerp01(
        this.profile.dropOffRisk01,
        clamp01(0.18 + affect01 * 0.72),
        0.08,
      ),
      helperNeed01: lerp01(
        this.profile.helperNeed01,
        clamp01(0.12 + affect01 * 0.68),
        0.07,
      ),
      lastUpdatedAtMs: now,
      revision: this.profile.revision + 1,
    };

    this.recordInternal(
      'affect_snapshot',
      asJsonObject({
        affect01,
        ...payload,
      }),
      now,
    );
  }

  recordAudienceHeat(
    audienceHeat: Nullable<ChatAudienceHeat>,
    payload: Record<string, JsonValue> = {},
  ): void {
    const now = nowAsUnixMs(this.clock);
    const heat01 = extractAudienceHeat01(audienceHeat);

    this.session.rollingAudienceHeat = maxLast(
      [...this.session.rollingAudienceHeat, heat01],
      32,
    );

    this.profile = {
      ...this.profile,
      shameSensitivity01: lerp01(
        this.profile.shameSensitivity01,
        clamp01(0.16 + heat01 * 0.80),
        0.09,
      ),
      haterTolerance01: lerp01(
        this.profile.haterTolerance01,
        clamp01(0.25 + heat01 * 0.55),
        0.05,
      ),
      lastUpdatedAtMs: now,
      revision: this.profile.revision + 1,
    };

    this.recordInternal(
      'audience_heat_snapshot',
      asJsonObject({
        heat01,
        channelId: this.session.activeChannel,
        ...payload,
      }),
      now,
    );
  }

  recordLegendMoment(
    legendClass: string,
    payload: Record<string, JsonValue> = {},
  ): void {
    const now = nowAsUnixMs(this.clock);

    this.session.legendCount += 1;
    this.profile = {
      ...this.profile,
      totalLegendMoments: this.profile.totalLegendMoments + 1,
      confidence01: lerp01(this.profile.confidence01, 0.84, 0.12),
      engagement01: lerp01(this.profile.engagement01, 0.88, 0.10),
      dropOffRisk01: lerp01(this.profile.dropOffRisk01, 0.14, 0.10),
      lastUpdatedAtMs: now,
      revision: this.profile.revision + 1,
    };

    this.recordInternal(
      'legend_moment',
      asJsonObject({
        legendClass,
        legendCount: this.session.legendCount,
        ...payload,
      }),
      now,
    );
  }

  recordReplayOpened(
    replayId: string,
    payload: Record<string, JsonValue> = {},
  ): void {
    const now = nowAsUnixMs(this.clock);

    this.session.replayOpenCount += 1;
    this.profile = {
      ...this.profile,
      totalReplayOpens: this.profile.totalReplayOpens + 1,
      engagement01: lerp01(this.profile.engagement01, 0.69, 0.05),
      lastUpdatedAtMs: now,
      revision: this.profile.revision + 1,
    };

    this.recordInternal(
      'replay_opened',
      asJsonObject({
        replayId,
        replayOpenCount: this.session.replayOpenCount,
        ...payload,
      }),
      now,
    );
  }

  /* ====================================================================== */
  /* MARK: Flush                                                             */
  /* ====================================================================== */

  async flush(reason = 'MANUAL'): Promise<ChatLearningBridgePreparedBatch> {
    const snapshotBefore = this.getPublicSnapshot();

    if (this.isFlushing || this.isDestroyed) {
      return {
        envelopes: snapshotBefore.queueDepth
          ? this.session.queue.map((item) => item.envelope)
          : [],
        snapshot: snapshotBefore,
      };
    }

    this.cancelPendingFlush();
    this.isFlushing = true;

    try {
      const batch = this.session.queue
        .slice(0, this.options.maxEnvelopeBatchSize)
        .map((item) => item.envelope);

      if (batch.length) {
        await this.queueEmitter.enqueue?.(batch);
        if (this.telemetry.emitBatch) {
          await this.telemetry.emitBatch(batch);
        } else if (this.telemetry.emit) {
          for (const envelope of batch) {
            await this.telemetry.emit(envelope);
          }
        }

        this.session.queue = this.session.queue.slice(batch.length);
      }

      const now = nowAsUnixMs(this.clock);
      this.session.lastFlushAtMs = now;

      this.recordInternal(
        'bridge_flushed',
        asJsonObject({
          reason,
          flushedCount: batch.length,
          remainingQueueDepth: this.session.queue.length,
        }),
        now,
        true,
      );

      this.persistIfEnabled();

      return {
        envelopes: batch,
        snapshot: this.getPublicSnapshot(),
      };
    } finally {
      this.isFlushing = false;
    }
  }

  /* ====================================================================== */
  /* MARK: Internal event pipeline                                           */
  /* ====================================================================== */

  private recordInternal(
    eventName: FrontendLearningTelemetryEventName,
    payload: JsonObject,
    occurredAtMs: UnixMs,
    silentFlushEvent = false,
  ): void {
    if (this.isDestroyed) return;

    this.session.lastEventAtMs = occurredAtMs;
    this.session.recentEventNames = maxLast(
      [...this.session.recentEventNames, eventName],
      this.options.maxEventHistory,
    );

    const featureSnapshot = this.prepareFeatureSnapshot(
      eventName,
      payload,
      occurredAtMs,
    );

    this.latestFeatureSnapshot = featureSnapshot;

    const envelope = this.prepareEnvelope(
      eventName,
      payload,
      featureSnapshot,
      occurredAtMs,
    );

    if (!silentFlushEvent) {
      this.enqueueEnvelope(envelope, occurredAtMs, eventName);
    }

    this.latestRecommendation = this.computeRecommendation();

    this.runInferenceHook();
    this.persistIfEnabled();
    this.notifyObservers(envelope);

    if (this.options.emitOnEveryEvent && !silentFlushEvent) {
      void this.flush('EMIT_ON_EVERY_EVENT');
    } else {
      this.scheduleFlushIfNeeded();
    }
  }

  private prepareFeatureSnapshot(
    eventName: FrontendLearningTelemetryEventName,
    payload: JsonObject,
    occurredAtMs: UnixMs,
  ): ChatFeatureSnapshot {
    const heuristics = this.computeHeuristicSignals();

    if (this.featureExtractor) {
      return this.featureExtractor.extract({
        profile: safeJsonClone(this.profile),
        session: safeJsonClone(this.session),
        heuristicSignals: heuristics,
        eventName,
        occurredAtMs,
        activeChannel: this.session.activeChannel,
        payload: safeJsonClone(payload),
      });
    }

    const snapshot = {
      snapshotId: createId('feature'),
      occurredAtMs,
      eventName,
      activeChannel: this.session.activeChannel,

      messageVelocity01: clamp01(
        (this.session.inboundCount + this.session.outboundCount) / 24,
      ),
      engagement01: heuristics.engagement01,
      dropOffRisk01: heuristics.dropOffRisk01,
      helperNeed01: heuristics.helperNeed01,
      haterTolerance01: heuristics.haterTolerance01,
      shameSensitivity01: heuristics.shameSensitivity01,
      confidence01: heuristics.confidence01,
      rescueNeed01: heuristics.rescueNeed01,

      channelViews: safeJsonClone(this.session.channelViews),
      outboundByChannel: safeJsonClone(this.session.outboundByChannel),
      inboundByChannel: safeJsonClone(this.session.inboundByChannel),

      avgTypingDurationMs: average(this.session.rollingTypingDurationsMs),
      avgResponseDelayMs: average(this.session.rollingResponseDelaysMs),
      avgDraftLength: average(this.session.rollingDraftLengths),

      affectIntensity01: average(this.session.rollingAffectIntensity),
      audienceHeat01: average(this.session.rollingAudienceHeat),

      payload,
    } as ChatFeatureSnapshot;

    this.session.recentFeatureHistory = maxLast(
      [...this.session.recentFeatureHistory, snapshot],
      this.options.maxFeatureHistory,
    );

    return snapshot;
  }

  private prepareEnvelope(
    eventName: FrontendLearningTelemetryEventName,
    payload: JsonObject,
    featureSnapshot: ChatFeatureSnapshot,
    occurredAtMs: UnixMs,
  ): ChatTelemetryEnvelope {
    const heuristics = this.computeHeuristicSignals();

    return {
      telemetryId: createId('telemetry'),
      eventName: toTelemetryEventName(eventName),
      occurredAtMs,
      emittedAtMs: occurredAtMs,
      roomId: this.profile.roomId,
      sessionId: this.profile.sessionId,
      userId: this.profile.userId,
      channelId: this.session.activeChannel,
      profileRevision: this.profile.revision,
      engineVersion: CHAT_ENGINE_VERSION,
      publicApiVersion: CHAT_ENGINE_PUBLIC_API_VERSION,
      origin: 'FRONTEND_CHAT_INTELLIGENCE',
      payload: {
        ...payload,
        heuristics,
      },
      featureSnapshot,
      bridge: {
        moduleName: CHAT_LEARNING_BRIDGE_MODULE_NAME,
        moduleVersion: CHAT_LEARNING_BRIDGE_VERSION,
        preferredChannel: this.profile.preferredChannel,
        queueDepthBeforeEnqueue: this.session.queue.length,
      },
    } as ChatTelemetryEnvelope;
  }

  private enqueueEnvelope(
    envelope: ChatTelemetryEnvelope,
    occurredAtMs: UnixMs,
    eventName: FrontendLearningTelemetryEventName,
  ): void {
    const telemetryId =
      (envelope as any)?.telemetryId && typeof (envelope as any).telemetryId === 'string'
        ? (envelope as any).telemetryId
        : createId('telemetry');

    const queueItem: ChatLearningBridgeQueueItem = {
      queueId: createId('queue'),
      telemetryId,
      eventName,
      occurredAtMs,
      envelope,
    };

    this.session.queue = maxLast(
      [...this.session.queue, queueItem],
      this.options.maxQueueSize,
    );
  }

  private scheduleFlushIfNeeded(): void {
    if (this.pendingFlushToken !== null || this.isDestroyed) return;

    this.pendingFlushToken = this.clock.setTimeout(() => {
      this.pendingFlushToken = null;
      void this.flush('SCHEDULED');
    }, this.options.autoFlushMs);
  }

  private cancelPendingFlush(): void {
    if (this.pendingFlushToken === null) return;

    this.clock.clearTimeout(this.pendingFlushToken);
    this.pendingFlushToken = null;
  }

  /* ====================================================================== */
  /* MARK: Heuristics                                                        */
  /* ====================================================================== */

  private computeHeuristicSignals(): ChatLearningBridgeHeuristicSignals {
    const avgAffect = average(this.session.rollingAffectIntensity);
    const avgHeat = average(this.session.rollingAudienceHeat);
    const avgTypingMs = average(this.session.rollingTypingDurationsMs);
    const avgDraftLength = average(this.session.rollingDraftLengths);

    const engagement01 = clamp01(
      this.profile.engagement01 * 0.48 +
        scoreFromCount(this.session.outboundCount + this.session.inboundCount, 30) *
          0.22 +
        scoreFromCount(this.session.channelViews[this.session.activeChannel], 8) * 0.10 +
        scoreFromCount(this.session.composerFocusCount, 10) * 0.08 +
        clamp01(avgDraftLength / 180) * 0.06 +
        clamp01(avgTypingMs / 4_000) * 0.06,
    );

    const dropOffRisk01 = clamp01(
      this.profile.dropOffRisk01 * 0.44 +
        avgAffect * 0.18 +
        avgHeat * 0.14 +
        scoreFromCount(this.session.failureCount, 6) * 0.12 +
        this.computeQuietness01() * 0.12,
    );

    const helperNeed01 = clamp01(
      this.profile.helperNeed01 * 0.45 +
        dropOffRisk01 * 0.18 +
        avgAffect * 0.16 +
        scoreFromCount(this.session.failureCount, 4) * 0.11 +
        scoreFromCount(this.session.haterCount, 8) * 0.10,
    );

    const haterTolerance01 = clamp01(
      this.profile.haterTolerance01 * 0.58 +
        scoreFromCount(this.session.haterCount, 16) * 0.16 +
        this.profile.confidence01 * 0.12 +
        clamp01(1 - this.profile.shameSensitivity01) * 0.14,
    );

    const shameSensitivity01 = clamp01(
      this.profile.shameSensitivity01 * 0.54 +
        avgHeat * 0.18 +
        scoreFromCount(this.session.haterCount, 10) * 0.14 +
        clamp01(1 - this.profile.confidence01) * 0.14,
    );

    const confidence01 = clamp01(
      this.profile.confidence01 * 0.52 +
        scoreFromCount(this.session.outboundCount, 16) * 0.14 +
        scoreFromCount(this.session.legendCount, 4) * 0.12 +
        clamp01(1 - dropOffRisk01) * 0.22,
    );

    const typingCommitment01 = clamp01(
      this.profile.typingCommitment01 * 0.56 +
        clamp01(avgTypingMs / 4_000) * 0.18 +
        clamp01(avgDraftLength / 160) * 0.16 +
        scoreFromCount(this.session.typingStartCount, 12) * 0.10,
    );

    const rescueNeed01 = clamp01(
      this.profile.rescueNeed01 * 0.48 +
        helperNeed01 * 0.22 +
        dropOffRisk01 * 0.18 +
        scoreFromCount(this.session.failureCount, 5) * 0.12,
    );

    return {
      engagement01,
      dropOffRisk01,
      helperNeed01,
      haterTolerance01,
      shameSensitivity01,
      confidence01,
      dealRoomAffinity01: this.profile.dealRoomAffinity01,
      syndicateAffinity01: this.profile.syndicateAffinity01,
      globalAffinity01: this.profile.globalAffinity01,
      typingCommitment01,
      rescueNeed01,
      crowdStress01: avgHeat,
    };
  }

  private computeQuietness01(): number {
    const now = nowAsUnixMs(this.clock);
    const anchor =
      this.session.lastInboundAtMs ??
      this.session.lastOutboundAtMs ??
      this.session.openedAtMs ??
      now;

    const elapsedMs = Math.max(0, now - anchor);
    return clamp01(elapsedMs / CHAT_LEARNING_BRIDGE_DEFAULTS.disengagementWindowMs);
  }

  private computeRecommendedChannel(): ChatVisibleChannel {
    const scores: Record<ChatVisibleChannel, number> = {
      GLOBAL:
        this.profile.globalAffinity01 * 0.66 +
        scoreFromCount(this.session.channelViews.GLOBAL, 8) * 0.14 +
        scoreFromCount(this.session.outboundByChannel.GLOBAL, 8) * 0.20,
      SYNDICATE:
        this.profile.syndicateAffinity01 * 0.66 +
        scoreFromCount(this.session.channelViews.SYNDICATE, 8) * 0.14 +
        scoreFromCount(this.session.outboundByChannel.SYNDICATE, 8) * 0.20,
      DEAL_ROOM:
        this.profile.dealRoomAffinity01 * 0.66 +
        scoreFromCount(this.session.channelViews.DEAL_ROOM, 8) * 0.14 +
        scoreFromCount(this.session.outboundByChannel.DEAL_ROOM, 8) * 0.20,
      LOBBY:
        0.15 +
        scoreFromCount(this.session.channelViews.LOBBY, 6) * 0.35 +
        scoreFromCount(this.session.outboundByChannel.LOBBY, 6) * 0.20 +
        (this.session.mountTarget === 'LOBBY_SCREEN' ? 0.30 : 0),
    };

    let bestChannel: ChatVisibleChannel = 'GLOBAL';
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const channelId of CHAT_VISIBLE_CHANNELS) {
      const score = scores[channelId];
      if (score > bestScore) {
        bestScore = score;
        bestChannel = channelId;
      }
    }

    return bestChannel;
  }

  private computeRecommendation(): ChatLearningBridgeRecommendation {
    const heuristics = this.computeHeuristicSignals();
    const recommendedChannel = this.computeRecommendedChannel();

    const helperUrgency01 = clamp01(
      heuristics.helperNeed01 * 0.52 +
        heuristics.dropOffRisk01 * 0.24 +
        heuristics.crowdStress01 * 0.12 +
        this.computeQuietness01() * 0.12,
    );

    const haterAggression01 = clamp01(
      (1 - heuristics.confidence01) * 0.30 +
        heuristics.crowdStress01 * 0.18 +
        scoreFromCount(this.session.haterCount, 12) * 0.22 +
        scoreFromCount(this.session.outboundCount, 18) * 0.10 +
        heuristics.shameSensitivity01 * 0.20,
    );

    const rescueNeeded =
      helperUrgency01 >= CHAT_LEARNING_BRIDGE_DEFAULTS.helperUrgencyThreshold ||
      heuristics.rescueNeed01 >= CHAT_LEARNING_BRIDGE_DEFAULTS.rescueNeedThreshold;

    const explanationParts: string[] = [];

    if (rescueNeeded) explanationParts.push('rescue-pressure-rising');
    if (heuristics.dropOffRisk01 >= 0.58) explanationParts.push('dropoff-risk-elevated');
    if (heuristics.crowdStress01 >= 0.55) explanationParts.push('crowd-heat-elevated');
    if (haterAggression01 >= 0.60) explanationParts.push('hater-escalation-window');
    if (!explanationParts.length) explanationParts.push('steady-local-adaptation');

    return {
      recommendedChannel,
      helperUrgency01,
      rescueNeeded,
      haterAggression01,
      dropOffRisk01: heuristics.dropOffRisk01,
      explanation: explanationParts.join(' | '),
    };
  }

  private bumpChannelAffinity(channelId: ChatVisibleChannel, delta01: number): void {
    if (channelId === 'GLOBAL') {
      this.profile = {
        ...this.profile,
        globalAffinity01: lerp01(this.profile.globalAffinity01, 1, delta01),
        preferredChannel: channelId,
      };
      return;
    }

    if (channelId === 'SYNDICATE') {
      this.profile = {
        ...this.profile,
        syndicateAffinity01: lerp01(this.profile.syndicateAffinity01, 1, delta01),
        preferredChannel: channelId,
      };
      return;
    }

    if (channelId === 'DEAL_ROOM') {
      this.profile = {
        ...this.profile,
        dealRoomAffinity01: lerp01(this.profile.dealRoomAffinity01, 1, delta01),
        preferredChannel: channelId,
      };
      return;
    }

    this.profile = {
      ...this.profile,
      preferredChannel: channelId,
    };
  }

  /* ====================================================================== */
  /* MARK: Persistence                                                       */
  /* ====================================================================== */

  private hydrateFromPersistence(): void {
    if (!this.options.enablePersistence) return;

    const raw = this.persistence.load(this.storageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as {
        version?: number;
        profile?: Partial<ChatLearningBridgeProfileState>;
        session?: Partial<ChatLearningBridgeSessionState>;
        latestFeatureSnapshot?: ChatFeatureSnapshot | null;
        latestRecommendation?: ChatLearningBridgeRecommendation | null;
      };

      if (
        typeof parsed.version !== 'number' ||
        parsed.version !== this.options.persistenceVersion
      ) {
        return;
      }

      if (parsed.profile) {
        this.profile = {
          ...this.profile,
          ...parsed.profile,
          preferredChannel: normalizeVisibleChannel(
            typeof parsed.profile.preferredChannel === 'string'
              ? parsed.profile.preferredChannel
              : this.profile.preferredChannel,
            this.profile.preferredChannel,
          ),
        };
      }

      if (parsed.session) {
        this.session = {
          ...this.session,
          ...parsed.session,
          activeChannel: normalizeVisibleChannel(
            typeof parsed.session.activeChannel === 'string'
              ? parsed.session.activeChannel
              : this.session.activeChannel,
            this.session.activeChannel,
          ),
          queue: [],
          recentEventNames: Array.isArray(parsed.session.recentEventNames)
            ? parsed.session.recentEventNames.filter((value): value is FrontendLearningTelemetryEventName =>
                typeof value === 'string' &&
                isFrontendLearningTelemetryEventName(value),
              )
            : this.session.recentEventNames,
          recentFeatureHistory: Array.isArray(parsed.session.recentFeatureHistory)
            ? parsed.session.recentFeatureHistory
            : this.session.recentFeatureHistory,
          recentMessageIds: Array.isArray(parsed.session.recentMessageIds)
            ? parsed.session.recentMessageIds.filter(
                (value): value is string => typeof value === 'string',
              )
            : this.session.recentMessageIds,
          recentFailedRequestIds: Array.isArray(parsed.session.recentFailedRequestIds)
            ? parsed.session.recentFailedRequestIds.filter(
                (value): value is string => typeof value === 'string',
              )
            : this.session.recentFailedRequestIds,
        };
      }

      this.latestFeatureSnapshot = parsed.latestFeatureSnapshot ?? null;
      this.latestRecommendation = parsed.latestRecommendation ?? null;
    } catch {
      //
    }
  }

  private persistIfEnabled(): void {
    if (!this.options.enablePersistence || this.isDestroyed) return;

    const payload = {
      version: this.options.persistenceVersion,
      profile: this.profile,
      session: {
        ...this.session,
        queue: [],
      },
      latestFeatureSnapshot: this.latestFeatureSnapshot,
      latestRecommendation: this.latestRecommendation,
    };

    this.persistence.save(this.storageKey, JSON.stringify(payload));
  }

  /* ====================================================================== */
  /* MARK: Inference hook                                                    */
  /* ====================================================================== */

  private runInferenceHook(): void {
    if (!this.inference) return;

    const snapshot = this.getPublicSnapshot();
    const recommendationResult = this.inference.recommend?.(snapshot);

    if (recommendationResult && typeof (recommendationResult as Promise<unknown>).then === 'function') {
      void (recommendationResult as Promise<ChatLearningBridgeRecommendation | void>).then(
        (result) => {
          if (result) {
            this.latestRecommendation = safeJsonClone(result);
            this.notifySnapshotOnly();
          }
        },
      );
    } else if (recommendationResult) {
      this.latestRecommendation = safeJsonClone(
        recommendationResult as ChatLearningBridgeRecommendation,
      );
    }

    const profileResult = this.inference.refineProfile?.(snapshot);

    if (profileResult && typeof (profileResult as Promise<unknown>).then === 'function') {
      void (profileResult as Promise<Partial<ChatLearningBridgeProfileState> | void>).then(
        (partial) => {
          if (partial) {
            this.mergeRefinedProfile(partial);
          }
        },
      );
    } else if (profileResult) {
      this.mergeRefinedProfile(
        profileResult as Partial<ChatLearningBridgeProfileState>,
      );
    }
  }

  private mergeRefinedProfile(
    partial: Partial<ChatLearningBridgeProfileState>,
  ): void {
    const now = nowAsUnixMs(this.clock);

    this.profile = {
      ...this.profile,
      ...partial,
      preferredChannel: normalizeVisibleChannel(
        typeof partial.preferredChannel === 'string'
          ? partial.preferredChannel
          : this.profile.preferredChannel,
        this.profile.preferredChannel,
      ),
      revision: this.profile.revision + 1,
      lastUpdatedAtMs: now,
    };

    this.persistIfEnabled();
    this.notifySnapshotOnly();
  }

  /* ====================================================================== */
  /* MARK: Observer notifications                                            */
  /* ====================================================================== */

  private notifyObservers(envelope: ChatTelemetryEnvelope): void {
    const snapshot = this.getPublicSnapshot();

    for (const observer of this.observers) {
      observer(snapshot);
    }

    for (const observer of this.eventObservers) {
      observer(envelope, snapshot);
    }
  }

  private notifySnapshotOnly(): void {
    const snapshot = this.getPublicSnapshot();

    for (const observer of this.observers) {
      observer(snapshot);
    }
  }
}

/* ========================================================================== */
/* MARK: Factory                                                              */
/* ========================================================================== */

export function createChatLearningBridge(
  options: ChatLearningBridgeOptions = {},
): ChatLearningBridge {
  return new ChatLearningBridge(options);
}