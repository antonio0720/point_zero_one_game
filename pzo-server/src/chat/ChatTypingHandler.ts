/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE CHAT TYPING HANDLER
 * FILE: pzo-server/src/chat/ChatTypingHandler.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * This file extracts transport-side typing ingress out of ChatGateway so the
 * gateway stops becoming a hidden theater brain for typing state.
 *
 * Transport doctrine
 * ------------------
 * - This file normalizes typing intent, stage cadence, and typing lease churn.
 * - It may create short-lived transport mirrors and typing leases.
 * - It may NOT become transcript truth.
 * - It may NOT become presence truth.
 * - It may NOT become backend moderation truth.
 * - It forwards normalized typing envelopes to backend chat authority and only
 *   prepares transport fanout once backend authority accepts the event.
 *
 * Relationship to sibling files
 * -----------------------------
 * - ChatConnectionAuth.ts authenticates the socket and resolves restrictions.
 * - ChatSessionRegistry.ts owns session admission truth.
 * - ChatPresenceHandler.ts owns room/panel/activity visibility ingress.
 * - ChatMessageHandler.ts owns message submit and ack ingress.
 * - ChatCursorHandler.ts owns live cursor and selection transport state.
 * - backend/src/game/engine/chat/ChatPresenceState.ts remains authoritative
 *   typing/presence truth once events are accepted.
 *
 * Why this file is separate
 * -------------------------
 * Typing in Point Zero One is not cosmetic. It is part of pressure, bluff,
 * threat theater, helper timing, and social atmosphere:
 * - GLOBAL typing should feel busy and theatrical.
 * - SYNDICATE typing should feel intentional and strategically sparse.
 * - DEAL_ROOM typing should feel delayed, predatory, and psychologically loud
 *   even when little text is sent.
 * - LOBBY typing should feel warm but not spammy.
 *
 * This file therefore needs its own law, leases, throttles, and fanout rules
 * rather than hiding inside ChatGateway or ChatPresenceHandler.
 * ============================================================================
 */

import { createHash, randomUUID } from 'node:crypto';
import type { Socket } from 'socket.io';

import type {
  ChatConnectionRestrictionCode,
  ChatGatewayAuthContext,
} from './ChatConnectionAuth';
import type {
  ChatSessionAuthoritySnapshot,
  ChatSessionRegistry,
} from './ChatSessionRegistry';

// ============================================================================
// MARK: Fundamental aliases
// ============================================================================

export type ChatTypingRoomId = string;
export type ChatTypingChannelId = string;
export type ChatTypingEnvelopeId = string;
export type ChatTypingLeaseId = string;
export type ChatTypingNonce = string;
export type ChatTypingSessionId = string;
export type ChatTypingSocketId = string;
export type ChatTypingAudienceScope =
  | 'ROOM'
  | 'CHANNEL'
  | 'THREAD'
  | 'WHISPER'
  | 'SELF_ONLY';

export type ChatTypingStage =
  | 'STARTED'
  | 'REFRESHED'
  | 'SOFT_STOPPED'
  | 'HARD_STOPPED'
  | 'PULSED'
  | 'EXPIRED'
  | 'CLEARED';

export type ChatTypingSource =
  | 'PLAYER'
  | 'NPC'
  | 'HELPER'
  | 'HATER'
  | 'SYSTEM'
  | 'LIVEOPS';

export type ChatTypingDeviceClass =
  | 'DESKTOP'
  | 'MOBILE'
  | 'TABLET'
  | 'UNKNOWN';

export type ChatTypingIntentKind =
  | 'FREE_TEXT'
  | 'COMMAND'
  | 'REACTION'
  | 'DEAL_OFFER'
  | 'COUNTERPLAY'
  | 'HELPER_REPLY'
  | 'SYSTEM_REPLY'
  | 'UNKNOWN';

export type ChatTypingEventKind =
  | 'START_TYPING'
  | 'REFRESH_TYPING'
  | 'STOP_TYPING'
  | 'PULSE_TYPING'
  | 'REQUEST_REMOTE_STATE'
  | 'CLEAR_ROOM_TYPING'
  | 'DISCONNECT_HINT';

export type ChatTypingAckState =
  | 'ACCEPTED'
  | 'REJECTED'
  | 'DEFERRED'
  | 'RATE_LIMITED'
  | 'QUARANTINED';

export type ChatTypingRejectReason =
  | 'NOT_ADMITTED'
  | 'SESSION_NOT_FOUND'
  | 'ROOM_NOT_JOINED'
  | 'ROOM_NOT_ALLOWED'
  | 'CHANNEL_NOT_ALLOWED'
  | 'TYPING_RESTRICTED'
  | 'RATE_LIMITED'
  | 'SOCKET_MISMATCH'
  | 'MALFORMED_PAYLOAD'
  | 'LEASE_REJECTED'
  | 'BACKEND_UNAVAILABLE'
  | 'REMOTE_STATE_NOT_ALLOWED'
  | 'CLEAR_NOT_ALLOWED'
  | 'DISCONNECT_HINT_REJECTED'
  | 'UNSUPPORTED_KIND'
  | 'UNKNOWN';

export interface ChatTypingTextMetrics {
  readonly charCount: number;
  readonly wordCount: number;
  readonly tokenEstimate: number;
  readonly lineCount: number;
  readonly hasEmoji: boolean;
  readonly hasMentions: boolean;
  readonly hasCommandPrefix: boolean;
}

export interface ChatTypingStagePayload {
  readonly roomId: ChatTypingRoomId;
  readonly channelId: ChatTypingChannelId | null;
  readonly audienceScope: ChatTypingAudienceScope;
  readonly stage: ChatTypingStage;
  readonly source: ChatTypingSource;
  readonly intentKind: ChatTypingIntentKind;
  readonly confidence: number;
  readonly composing: boolean;
  readonly textPreview: string | null;
  readonly textMetrics: ChatTypingTextMetrics;
  readonly expiresInMs: number | null;
  readonly issuedAt: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatTypingPulsePayload {
  readonly roomId: ChatTypingRoomId;
  readonly channelId: ChatTypingChannelId | null;
  readonly audienceScope: ChatTypingAudienceScope;
  readonly source: ChatTypingSource;
  readonly intentKind: ChatTypingIntentKind;
  readonly confidence: number;
  readonly activeLeaseId: ChatTypingLeaseId | null;
  readonly issuedAt: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatTypingRemoteStateRequestPayload {
  readonly roomId: ChatTypingRoomId;
  readonly channelId: ChatTypingChannelId | null;
  readonly includeSelf: boolean;
  readonly includePreview: boolean;
  readonly includeNpc: boolean;
  readonly includeHelpers: boolean;
  readonly includeHaters: boolean;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatTypingClearRoomPayload {
  readonly roomId: ChatTypingRoomId;
  readonly channelId: ChatTypingChannelId | null;
  readonly reason: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatTypingDisconnectHintPayload {
  readonly roomId: ChatTypingRoomId | null;
  readonly channelId: ChatTypingChannelId | null;
  readonly reason: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatTypingEnvelope {
  readonly envelopeId: ChatTypingEnvelopeId;
  readonly namespace: string;
  readonly issuedAt: number;
  readonly kind: ChatTypingEventKind;
  readonly roomId: ChatTypingRoomId | null;
  readonly channelId: ChatTypingChannelId | null;
  readonly nonce: ChatTypingNonce | null;
  readonly stagePayload: ChatTypingStagePayload | null;
  readonly pulsePayload: ChatTypingPulsePayload | null;
  readonly remoteStateRequest: ChatTypingRemoteStateRequestPayload | null;
  readonly clearRoomPayload: ChatTypingClearRoomPayload | null;
  readonly disconnectHintPayload: ChatTypingDisconnectHintPayload | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatTypingLease {
  readonly leaseId: ChatTypingLeaseId;
  readonly sessionId: ChatTypingSessionId;
  readonly userId: string;
  readonly username: string;
  readonly socketId: ChatTypingSocketId;
  readonly roomId: ChatTypingRoomId;
  readonly channelId: ChatTypingChannelId | null;
  readonly audienceScope: ChatTypingAudienceScope;
  readonly source: ChatTypingSource;
  readonly intentKind: ChatTypingIntentKind;
  readonly confidence: number;
  readonly composing: boolean;
  readonly textPreview: string | null;
  readonly textMetrics: ChatTypingTextMetrics;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly expiresAt: number;
  readonly stage: ChatTypingStage;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatTypingMirrorRecord {
  readonly sessionId: ChatTypingSessionId;
  readonly userId: string;
  readonly username: string;
  readonly socketId: ChatTypingSocketId;
  readonly roomId: ChatTypingRoomId;
  readonly channelId: ChatTypingChannelId | null;
  readonly audienceScope: ChatTypingAudienceScope;
  readonly source: ChatTypingSource;
  readonly intentKind: ChatTypingIntentKind;
  readonly confidence: number;
  readonly composing: boolean;
  readonly textPreview: string | null;
  readonly textMetrics: ChatTypingTextMetrics;
  readonly leaseId: ChatTypingLeaseId;
  readonly stage: ChatTypingStage;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly expiresAt: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatTypingBackendEnvelope {
  readonly backendEnvelopeId: string;
  readonly submittedAt: number;
  readonly namespace: string;
  readonly roomId: ChatTypingRoomId;
  readonly channelId: ChatTypingChannelId | null;
  readonly sessionId: ChatTypingSessionId;
  readonly userId: string;
  readonly username: string;
  readonly authLevel: string;
  readonly socketId: ChatTypingSocketId;
  readonly kind: ChatTypingEventKind;
  readonly leaseId: ChatTypingLeaseId | null;
  readonly payloadHash: string;
  readonly restrictions: readonly ChatConnectionRestrictionCode[];
  readonly payload: Readonly<Record<string, unknown>>;
  readonly transportMetadata: Readonly<Record<string, unknown>>;
}

export interface ChatTypingBackendResult {
  readonly accepted: boolean;
  readonly backendEnvelopeId: string;
  readonly roomId: ChatTypingRoomId;
  readonly channelId: ChatTypingChannelId | null;
  readonly state: ChatTypingAckState;
  readonly reason: string | null;
  readonly authoritativeLeaseId: ChatTypingLeaseId | null;
  readonly expiresAt: number | null;
  readonly stage: ChatTypingStage | null;
  readonly echoPayload: Readonly<Record<string, unknown>> | null;
  readonly remoteStatePayload: Readonly<Record<string, unknown>> | null;
  readonly extraMetadata: Readonly<Record<string, unknown>>;
}

export interface ChatTypingFanoutEnvelope {
  readonly fanoutId: string;
  readonly roomId: ChatTypingRoomId;
  readonly channelId: ChatTypingChannelId | null;
  readonly stage: ChatTypingStage;
  readonly audienceScope: ChatTypingAudienceScope;
  readonly source: ChatTypingSource;
  readonly fromUserId: string;
  readonly fromUsername: string;
  readonly leaseId: ChatTypingLeaseId | null;
  readonly expiresAt: number | null;
  readonly emittedAt: number;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface ChatTypingAck {
  readonly ackId: string;
  readonly envelopeId: ChatTypingEnvelopeId;
  readonly roomId: ChatTypingRoomId | null;
  readonly channelId: ChatTypingChannelId | null;
  readonly state: ChatTypingAckState;
  readonly reason: ChatTypingRejectReason | null;
  readonly leaseId: ChatTypingLeaseId | null;
  readonly stage: ChatTypingStage | null;
  readonly retryAfterMs: number | null;
  readonly expiresAt: number | null;
  readonly remoteState: Readonly<Record<string, unknown>> | null;
  readonly issuedAt: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatTypingAuditRecord {
  readonly auditId: string;
  readonly envelopeId: ChatTypingEnvelopeId;
  readonly kind: ChatTypingEventKind;
  readonly sessionId: ChatTypingSessionId | null;
  readonly userId: string;
  readonly roomId: ChatTypingRoomId | null;
  readonly channelId: ChatTypingChannelId | null;
  readonly state: ChatTypingAckState;
  readonly reason: ChatTypingRejectReason | null;
  readonly leaseId: ChatTypingLeaseId | null;
  readonly stage: ChatTypingStage | null;
  readonly dedupeKey: string | null;
  readonly createdAt: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatTypingRateWindow {
  readonly windowStartedAt: number;
  readonly eventCount: number;
  readonly pulseCount: number;
  readonly refreshCount: number;
}

export interface ChatTypingRemoteStateSnapshot {
  readonly roomId: ChatTypingRoomId;
  readonly channelId: ChatTypingChannelId | null;
  readonly generatedAt: number;
  readonly items: readonly Readonly<Record<string, unknown>>[];
}

// ============================================================================
// MARK: Dependencies and configuration
// ============================================================================

export interface ChatTypingHandlerConfig {
  readonly leaseTtlMs: number;
  readonly refreshLeaseTtlMs: number;
  readonly minPulseIntervalMs: number;
  readonly minRefreshIntervalMs: number;
  readonly eventRateWindowMs: number;
  readonly maxTypingEventsPerWindow: number;
  readonly maxTypingPulsesPerWindow: number;
  readonly maxPreviewChars: number;
  readonly auditLimit: number;
  readonly allowPreviewInFanout: boolean;
  readonly allowRemoteStateRequests: boolean;
  readonly allowRoomClear: boolean;
  readonly allowDisconnectHint: boolean;
  readonly requireRoomJoin: boolean;
  readonly expireOnDisconnectHint: boolean;
}

export interface ChatTypingHandlerDependencies {
  readonly sessionRegistry: ChatSessionRegistry;
  readonly backend: ChatTypingBackendPort;
  readonly fanout: ChatTypingFanoutPort;
  readonly metrics?: ChatTypingMetricsPort;
  readonly logger?: ChatTypingLogger;
  readonly clock?: () => number;
}

export interface ChatTypingLogger {
  debug(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  info(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  warn(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  error(message: string, metadata?: Readonly<Record<string, unknown>>): void;
}

export interface ChatTypingBackendPort {
  submitTypingEnvelope(
    envelope: ChatTypingBackendEnvelope,
  ): Promise<ChatTypingBackendResult>;
}

export interface ChatTypingFanoutPort {
  fanout(envelope: ChatTypingFanoutEnvelope): Promise<void> | void;
}

export interface ChatTypingMetricsPort {
  recordAccepted(kind: ChatTypingEventKind, roomId: string | null): void;
  recordRejected(kind: ChatTypingEventKind, reason: ChatTypingRejectReason, roomId: string | null): void;
  recordRateLimited(kind: ChatTypingEventKind, roomId: string | null): void;
  recordLeaseExpired(roomId: string | null): void;
  recordRemoteStateRequest(roomId: string | null): void;
}

export interface ChatTypingSocketAttachmentOptions {
  readonly socket: Socket;
  readonly auth: ChatGatewayAuthContext;
}

export interface ChatTypingSocketBinding {
  detach(): void;
}

export interface ChatTypingMetricsSnapshot {
  readonly totalReceived: number;
  readonly totalAccepted: number;
  readonly totalRejected: number;
  readonly totalRateLimited: number;
  readonly totalRemoteStateRequests: number;
  readonly totalLeaseExpirations: number;
  readonly totalFanouts: number;
  readonly activeLeaseCount: number;
  readonly activeMirrorCount: number;
  readonly auditCount: number;
}

// ============================================================================
// MARK: Defaults
// ============================================================================

export const DEFAULT_CHAT_TYPING_HANDLER_CONFIG: ChatTypingHandlerConfig = {
  leaseTtlMs: 8_000,
  refreshLeaseTtlMs: 10_000,
  minPulseIntervalMs: 700,
  minRefreshIntervalMs: 1_000,
  eventRateWindowMs: 12_000,
  maxTypingEventsPerWindow: 48,
  maxTypingPulsesPerWindow: 24,
  maxPreviewChars: 64,
  auditLimit: 2_500,
  allowPreviewInFanout: false,
  allowRemoteStateRequests: true,
  allowRoomClear: true,
  allowDisconnectHint: true,
  requireRoomJoin: true,
  expireOnDisconnectHint: true,
};

const EMPTY_TEXT_METRICS: ChatTypingTextMetrics = Object.freeze({
  charCount: 0,
  wordCount: 0,
  tokenEstimate: 0,
  lineCount: 0,
  hasEmoji: false,
  hasMentions: false,
  hasCommandPrefix: false,
});

const NOOP_LOGGER: ChatTypingLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

// ============================================================================
// MARK: Utilities
// ============================================================================

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toReadonlyMetadata(value: unknown): Readonly<Record<string, unknown>> {
  return Object.freeze(isRecord(value) ? { ...value } : {});
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function cleanPreview(value: unknown, maxChars: number): string | null {
  const preview = asString(value);
  if (!preview) {
    return null;
  }

  const collapsed = preview.replace(/\s+/g, ' ').trim();
  if (!collapsed) {
    return null;
  }

  return collapsed.slice(0, maxChars);
}

function computeTextMetrics(preview: string | null): ChatTypingTextMetrics {
  if (!preview) {
    return EMPTY_TEXT_METRICS;
  }

  const trimmed = preview.trim();
  const words = trimmed.length === 0 ? [] : trimmed.split(/\s+/g).filter(Boolean);
  const lineCount = preview.split(/\r?\n/g).length;
  const hasEmoji = /[\u{1F300}-\u{1FAFF}]/u.test(preview);
  const hasMentions = /(^|\s)@[^\s]+/u.test(preview);
  const hasCommandPrefix = /^\//.test(trimmed);

  return Object.freeze({
    charCount: preview.length,
    wordCount: words.length,
    tokenEstimate: Math.ceil(preview.length / 4),
    lineCount,
    hasEmoji,
    hasMentions,
    hasCommandPrefix,
  });
}

function normalizeAudienceScope(value: unknown): ChatTypingAudienceScope {
  switch (asString(value)) {
    case 'ROOM':
    case 'CHANNEL':
    case 'THREAD':
    case 'WHISPER':
    case 'SELF_ONLY':
      return value;
    default:
      return 'CHANNEL';
  }
}

function normalizeTypingStage(value: unknown): ChatTypingStage {
  switch (asString(value)) {
    case 'STARTED':
    case 'REFRESHED':
    case 'SOFT_STOPPED':
    case 'HARD_STOPPED':
    case 'PULSED':
    case 'EXPIRED':
    case 'CLEARED':
      return value;
    default:
      return 'STARTED';
  }
}

function normalizeTypingSource(value: unknown): ChatTypingSource {
  switch (asString(value)) {
    case 'PLAYER':
    case 'NPC':
    case 'HELPER':
    case 'HATER':
    case 'SYSTEM':
    case 'LIVEOPS':
      return value;
    default:
      return 'PLAYER';
  }
}

function normalizeIntentKind(value: unknown): ChatTypingIntentKind {
  switch (asString(value)) {
    case 'FREE_TEXT':
    case 'COMMAND':
    case 'REACTION':
    case 'DEAL_OFFER':
    case 'COUNTERPLAY':
    case 'HELPER_REPLY':
    case 'SYSTEM_REPLY':
      return value;
    default:
      return 'UNKNOWN';
  }
}

function normalizeStagePayload(
  payload: unknown,
  config: ChatTypingHandlerConfig,
): ChatTypingStagePayload | null {
  const record = isRecord(payload) ? payload : null;
  if (!record) {
    return null;
  }

  const roomId = asString(record.roomId);
  if (!roomId) {
    return null;
  }

  const preview = cleanPreview(record.textPreview, config.maxPreviewChars);

  return Object.freeze({
    roomId,
    channelId: asString(record.channelId),
    audienceScope: normalizeAudienceScope(record.audienceScope),
    stage: normalizeTypingStage(record.stage),
    source: normalizeTypingSource(record.source),
    intentKind: normalizeIntentKind(record.intentKind),
    confidence: clamp(asNumber(record.confidence) ?? 0.85, 0, 1),
    composing: asBoolean(record.composing) ?? true,
    textPreview: preview,
    textMetrics: computeTextMetrics(preview),
    expiresInMs: asNumber(record.expiresInMs),
    issuedAt: asNumber(record.issuedAt) ?? Date.now(),
    metadata: toReadonlyMetadata(record.metadata),
  });
}

function normalizePulsePayload(payload: unknown): ChatTypingPulsePayload | null {
  const record = isRecord(payload) ? payload : null;
  if (!record) {
    return null;
  }

  const roomId = asString(record.roomId);
  if (!roomId) {
    return null;
  }

  return Object.freeze({
    roomId,
    channelId: asString(record.channelId),
    audienceScope: normalizeAudienceScope(record.audienceScope),
    source: normalizeTypingSource(record.source),
    intentKind: normalizeIntentKind(record.intentKind),
    confidence: clamp(asNumber(record.confidence) ?? 0.8, 0, 1),
    activeLeaseId: asString(record.activeLeaseId),
    issuedAt: asNumber(record.issuedAt) ?? Date.now(),
    metadata: toReadonlyMetadata(record.metadata),
  });
}

function normalizeRemoteStateRequest(
  payload: unknown,
): ChatTypingRemoteStateRequestPayload | null {
  const record = isRecord(payload) ? payload : null;
  if (!record) {
    return null;
  }

  const roomId = asString(record.roomId);
  if (!roomId) {
    return null;
  }

  return Object.freeze({
    roomId,
    channelId: asString(record.channelId),
    includeSelf: asBoolean(record.includeSelf) ?? false,
    includePreview: asBoolean(record.includePreview) ?? false,
    includeNpc: asBoolean(record.includeNpc) ?? true,
    includeHelpers: asBoolean(record.includeHelpers) ?? true,
    includeHaters: asBoolean(record.includeHaters) ?? true,
    metadata: toReadonlyMetadata(record.metadata),
  });
}

function normalizeClearRoomPayload(payload: unknown): ChatTypingClearRoomPayload | null {
  const record = isRecord(payload) ? payload : null;
  if (!record) {
    return null;
  }

  const roomId = asString(record.roomId);
  if (!roomId) {
    return null;
  }

  return Object.freeze({
    roomId,
    channelId: asString(record.channelId),
    reason: asString(record.reason),
    metadata: toReadonlyMetadata(record.metadata),
  });
}

function normalizeDisconnectHintPayload(
  payload: unknown,
): ChatTypingDisconnectHintPayload {
  const record = isRecord(payload) ? payload : {};
  return Object.freeze({
    roomId: asString(record.roomId),
    channelId: asString(record.channelId),
    reason: asString(record.reason),
    metadata: toReadonlyMetadata(record.metadata),
  });
}

function normalizeEnvelope(
  kind: ChatTypingEventKind,
  payload: unknown,
  namespace: string,
  config: ChatTypingHandlerConfig,
): ChatTypingEnvelope {
  const record = isRecord(payload) ? payload : {};
  const stagePayload = normalizeStagePayload(record.stagePayload ?? record, config);
  const pulsePayload = normalizePulsePayload(record.pulsePayload ?? record);
  const remoteStateRequest = normalizeRemoteStateRequest(record.remoteStateRequest ?? record);
  const clearRoomPayload = normalizeClearRoomPayload(record.clearRoomPayload ?? record);
  const disconnectHintPayload = normalizeDisconnectHintPayload(record.disconnectHintPayload ?? record);

  const roomId =
    asString(record.roomId) ??
    stagePayload?.roomId ??
    pulsePayload?.roomId ??
    remoteStateRequest?.roomId ??
    clearRoomPayload?.roomId ??
    disconnectHintPayload.roomId ??
    null;

  const channelId =
    asString(record.channelId) ??
    stagePayload?.channelId ??
    pulsePayload?.channelId ??
    remoteStateRequest?.channelId ??
    clearRoomPayload?.channelId ??
    disconnectHintPayload.channelId ??
    null;

  return Object.freeze({
    envelopeId: asString(record.envelopeId) ?? randomUUID(),
    namespace,
    issuedAt: asNumber(record.issuedAt) ?? Date.now(),
    kind,
    roomId,
    channelId,
    nonce: asString(record.nonce),
    stagePayload,
    pulsePayload,
    remoteStateRequest,
    clearRoomPayload,
    disconnectHintPayload,
    metadata: toReadonlyMetadata(record.metadata),
  });
}

// ============================================================================
// MARK: Main handler
// ============================================================================

export class ChatTypingHandler {
  private readonly config: ChatTypingHandlerConfig;
  private readonly sessionRegistry: ChatSessionRegistry;
  private readonly backend: ChatTypingBackendPort;
  private readonly fanout: ChatTypingFanoutPort;
  private readonly metricsPort?: ChatTypingMetricsPort;
  private readonly logger: ChatTypingLogger;
  private readonly now: () => number;

  private readonly leasesByLeaseId = new Map<string, ChatTypingLease>();
  private readonly mirrorsByCompositeKey = new Map<string, ChatTypingMirrorRecord>();
  private readonly rateWindowsBySessionId = new Map<string, ChatTypingRateWindow>();
  private readonly auditTrail: ChatTypingAuditRecord[] = [];

  private totalReceived = 0;
  private totalAccepted = 0;
  private totalRejected = 0;
  private totalRateLimited = 0;
  private totalRemoteStateRequests = 0;
  private totalLeaseExpirations = 0;
  private totalFanouts = 0;

  public constructor(
    deps: ChatTypingHandlerDependencies,
    config: Partial<ChatTypingHandlerConfig> = {},
  ) {
    this.config = Object.freeze({
      ...DEFAULT_CHAT_TYPING_HANDLER_CONFIG,
      ...config,
    });
    this.sessionRegistry = deps.sessionRegistry;
    this.backend = deps.backend;
    this.fanout = deps.fanout;
    this.metricsPort = deps.metrics;
    this.logger = deps.logger ?? NOOP_LOGGER;
    this.now = deps.clock ?? (() => Date.now());
  }

  // ==========================================================================
  // MARK: Socket binding
  // ==========================================================================

  public attachSocket(
    options: ChatTypingSocketAttachmentOptions,
  ): ChatTypingSocketBinding {
    const { socket, auth } = options;

    const onStartTyping = async (payload: unknown, ack?: (value: unknown) => void) => {
      const result = await this.handleTransportEvent(auth, socket.id, 'START_TYPING', payload);
      ack?.(result);
    };

    const onRefreshTyping = async (payload: unknown, ack?: (value: unknown) => void) => {
      const result = await this.handleTransportEvent(auth, socket.id, 'REFRESH_TYPING', payload);
      ack?.(result);
    };

    const onStopTyping = async (payload: unknown, ack?: (value: unknown) => void) => {
      const result = await this.handleTransportEvent(auth, socket.id, 'STOP_TYPING', payload);
      ack?.(result);
    };

    const onPulseTyping = async (payload: unknown, ack?: (value: unknown) => void) => {
      const result = await this.handleTransportEvent(auth, socket.id, 'PULSE_TYPING', payload);
      ack?.(result);
    };

    const onRequestRemoteState = async (payload: unknown, ack?: (value: unknown) => void) => {
      const result = await this.handleTransportEvent(
        auth,
        socket.id,
        'REQUEST_REMOTE_STATE',
        payload,
      );
      ack?.(result);
    };

    const onClearRoomTyping = async (payload: unknown, ack?: (value: unknown) => void) => {
      const result = await this.handleTransportEvent(
        auth,
        socket.id,
        'CLEAR_ROOM_TYPING',
        payload,
      );
      ack?.(result);
    };

    const onDisconnectHint = async (payload: unknown, ack?: (value: unknown) => void) => {
      const result = await this.handleTransportEvent(
        auth,
        socket.id,
        'DISCONNECT_HINT',
        payload,
      );
      ack?.(result);
    };

    socket.on('chat:typing:start', onStartTyping);
    socket.on('chat:typing:refresh', onRefreshTyping);
    socket.on('chat:typing:stop', onStopTyping);
    socket.on('chat:typing:pulse', onPulseTyping);
    socket.on('chat:typing:request-remote-state', onRequestRemoteState);
    socket.on('chat:typing:clear-room-state', onClearRoomTyping);
    socket.on('chat:typing:disconnect-hint', onDisconnectHint);

    return {
      detach: () => {
        socket.off('chat:typing:start', onStartTyping);
        socket.off('chat:typing:refresh', onRefreshTyping);
        socket.off('chat:typing:stop', onStopTyping);
        socket.off('chat:typing:pulse', onPulseTyping);
        socket.off('chat:typing:request-remote-state', onRequestRemoteState);
        socket.off('chat:typing:clear-room-state', onClearRoomTyping);
        socket.off('chat:typing:disconnect-hint', onDisconnectHint);
      },
    };
  }

  // ==========================================================================
  // MARK: Public stats and sweeps
  // ==========================================================================

  public getMetricsSnapshot(): ChatTypingMetricsSnapshot {
    this.sweepExpiredLeases();

    return Object.freeze({
      totalReceived: this.totalReceived,
      totalAccepted: this.totalAccepted,
      totalRejected: this.totalRejected,
      totalRateLimited: this.totalRateLimited,
      totalRemoteStateRequests: this.totalRemoteStateRequests,
      totalLeaseExpirations: this.totalLeaseExpirations,
      totalFanouts: this.totalFanouts,
      activeLeaseCount: this.leasesByLeaseId.size,
      activeMirrorCount: this.mirrorsByCompositeKey.size,
      auditCount: this.auditTrail.length,
    });
  }

  public exportAuditTrail(): readonly ChatTypingAuditRecord[] {
    return Object.freeze([...this.auditTrail]);
  }

  public sweepExpiredLeases(): void {
    const now = this.now();
    const expired: ChatTypingLease[] = [];

    for (const lease of this.leasesByLeaseId.values()) {
      if (lease.expiresAt <= now) {
        expired.push(lease);
      }
    }

    for (const lease of expired) {
      this.expireLease(lease, 'expired_sweep');
    }
  }

  public clearSession(sessionId: string): void {
    const targets: ChatTypingLease[] = [];
    for (const lease of this.leasesByLeaseId.values()) {
      if (lease.sessionId === sessionId) {
        targets.push(lease);
      }
    }

    for (const lease of targets) {
      this.expireLease(lease, 'session_cleared');
    }
  }

  // ==========================================================================
  // MARK: Core dispatcher
  // ==========================================================================

  public async handleTransportEvent(
    auth: ChatGatewayAuthContext,
    socketId: string,
    kind: ChatTypingEventKind,
    payload: unknown,
  ): Promise<ChatTypingAck> {
    this.totalReceived += 1;
    this.sweepExpiredLeases();

    const envelope = normalizeEnvelope(kind, payload, auth.namespace, this.config);
    const snapshot = this.resolveSessionSnapshot(auth);

    if (!snapshot) {
      return this.reject(envelope, null, 'NOT_ADMITTED');
    }

    if (!this.isSocketBound(snapshot, socketId)) {
      return this.reject(envelope, snapshot, 'SOCKET_MISMATCH');
    }

    if (!envelope.roomId && kind !== 'DISCONNECT_HINT') {
      return this.reject(envelope, snapshot, 'MALFORMED_PAYLOAD');
    }

    if (envelope.roomId && this.config.requireRoomJoin && !this.isRoomJoined(snapshot, envelope.roomId)) {
      return this.reject(envelope, snapshot, 'ROOM_NOT_JOINED');
    }

    if (this.isTypingRestricted(snapshot)) {
      return this.reject(envelope, snapshot, 'TYPING_RESTRICTED');
    }

    const rateResult = this.checkRateWindow(snapshot.sessionId, kind);
    if (!rateResult.accepted) {
      return this.reject(envelope, snapshot, 'RATE_LIMITED', rateResult.retryAfterMs);
    }

    switch (kind) {
      case 'START_TYPING':
        return this.handleStartTyping(auth, snapshot, socketId, envelope);
      case 'REFRESH_TYPING':
        return this.handleRefreshTyping(auth, snapshot, socketId, envelope);
      case 'STOP_TYPING':
        return this.handleStopTyping(auth, snapshot, socketId, envelope);
      case 'PULSE_TYPING':
        return this.handlePulseTyping(auth, snapshot, socketId, envelope);
      case 'REQUEST_REMOTE_STATE':
        return this.handleRequestRemoteState(auth, snapshot, socketId, envelope);
      case 'CLEAR_ROOM_TYPING':
        return this.handleClearRoomTyping(auth, snapshot, socketId, envelope);
      case 'DISCONNECT_HINT':
        return this.handleDisconnectHint(auth, snapshot, socketId, envelope);
      default:
        return this.reject(envelope, snapshot, 'UNSUPPORTED_KIND');
    }
  }

  // ==========================================================================
  // MARK: Individual event handlers
  // ==========================================================================

  private async handleStartTyping(
    auth: ChatGatewayAuthContext,
    snapshot: ChatSessionAuthoritySnapshot,
    socketId: string,
    envelope: ChatTypingEnvelope,
  ): Promise<ChatTypingAck> {
    const stagePayload = envelope.stagePayload;
    if (!stagePayload || !envelope.roomId) {
      return this.reject(envelope, snapshot, 'MALFORMED_PAYLOAD');
    }

    const existing = this.findMirror(snapshot.sessionId, envelope.roomId, envelope.channelId);
    const leaseId = existing?.leaseId ?? randomUUID();
    const now = this.now();
    const expiresAt = now + (stagePayload.expiresInMs ?? this.config.leaseTtlMs);

    const lease: ChatTypingLease = Object.freeze({
      leaseId,
      sessionId: snapshot.sessionId,
      userId: snapshot.userId,
      username: snapshot.username,
      socketId,
      roomId: envelope.roomId,
      channelId: envelope.channelId,
      audienceScope: stagePayload.audienceScope,
      source: stagePayload.source,
      intentKind: stagePayload.intentKind,
      confidence: stagePayload.confidence,
      composing: stagePayload.composing,
      textPreview: stagePayload.textPreview,
      textMetrics: stagePayload.textMetrics,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      expiresAt,
      stage: 'STARTED',
      metadata: Object.freeze({
        ...stagePayload.metadata,
        envelopeMetadata: envelope.metadata,
      }),
    });

    const backendEnvelope = this.buildBackendEnvelope(auth, snapshot, socketId, envelope, lease);
    const backendResult = await this.submitBackendEnvelope(backendEnvelope, envelope, snapshot);
    if (!backendResult.accepted) {
      return this.reject(envelope, snapshot, 'BACKEND_UNAVAILABLE');
    }

    this.storeLease(lease);
    this.storeMirror(lease);
    await this.emitFanout(lease, 'STARTED', backendResult);

    return this.accept(envelope, snapshot, lease, 'STARTED', backendResult, null);
  }

  private async handleRefreshTyping(
    auth: ChatGatewayAuthContext,
    snapshot: ChatSessionAuthoritySnapshot,
    socketId: string,
    envelope: ChatTypingEnvelope,
  ): Promise<ChatTypingAck> {
    const stagePayload = envelope.stagePayload;
    if (!stagePayload || !envelope.roomId) {
      return this.reject(envelope, snapshot, 'MALFORMED_PAYLOAD');
    }

    const mirror = this.findMirror(snapshot.sessionId, envelope.roomId, envelope.channelId);
    const leaseId = mirror?.leaseId ?? randomUUID();
    const now = this.now();
    const expiresAt = now + (stagePayload.expiresInMs ?? this.config.refreshLeaseTtlMs);

    const lease: ChatTypingLease = Object.freeze({
      leaseId,
      sessionId: snapshot.sessionId,
      userId: snapshot.userId,
      username: snapshot.username,
      socketId,
      roomId: envelope.roomId,
      channelId: envelope.channelId,
      audienceScope: stagePayload.audienceScope,
      source: stagePayload.source,
      intentKind: stagePayload.intentKind,
      confidence: stagePayload.confidence,
      composing: stagePayload.composing,
      textPreview: stagePayload.textPreview,
      textMetrics: stagePayload.textMetrics,
      createdAt: mirror?.createdAt ?? now,
      updatedAt: now,
      expiresAt,
      stage: 'REFRESHED',
      metadata: Object.freeze({
        ...stagePayload.metadata,
        envelopeMetadata: envelope.metadata,
      }),
    });

    const backendEnvelope = this.buildBackendEnvelope(auth, snapshot, socketId, envelope, lease);
    const backendResult = await this.submitBackendEnvelope(backendEnvelope, envelope, snapshot);
    if (!backendResult.accepted) {
      return this.reject(envelope, snapshot, 'BACKEND_UNAVAILABLE');
    }

    this.storeLease(lease);
    this.storeMirror(lease);
    await this.emitFanout(lease, 'REFRESHED', backendResult);

    return this.accept(envelope, snapshot, lease, 'REFRESHED', backendResult, null);
  }

  private async handleStopTyping(
    auth: ChatGatewayAuthContext,
    snapshot: ChatSessionAuthoritySnapshot,
    socketId: string,
    envelope: ChatTypingEnvelope,
  ): Promise<ChatTypingAck> {
    const roomId = envelope.roomId;
    if (!roomId) {
      return this.reject(envelope, snapshot, 'MALFORMED_PAYLOAD');
    }

    const mirror = this.findMirror(snapshot.sessionId, roomId, envelope.channelId);
    const lease = mirror ? this.rebuildLeaseFromMirror(mirror) : this.syntheticLeaseForStop(snapshot, socketId, roomId, envelope.channelId);

    const backendEnvelope = this.buildBackendEnvelope(auth, snapshot, socketId, envelope, lease);
    const backendResult = await this.submitBackendEnvelope(backendEnvelope, envelope, snapshot);
    if (!backendResult.accepted) {
      return this.reject(envelope, snapshot, 'BACKEND_UNAVAILABLE');
    }

    this.deleteLeaseById(lease.leaseId);
    this.deleteMirror(snapshot.sessionId, roomId, envelope.channelId);
    await this.emitFanout(lease, 'HARD_STOPPED', backendResult);

    return this.accept(envelope, snapshot, lease, 'HARD_STOPPED', backendResult, null);
  }

  private async handlePulseTyping(
    auth: ChatGatewayAuthContext,
    snapshot: ChatSessionAuthoritySnapshot,
    socketId: string,
    envelope: ChatTypingEnvelope,
  ): Promise<ChatTypingAck> {
    const pulse = envelope.pulsePayload;
    if (!pulse || !envelope.roomId) {
      return this.reject(envelope, snapshot, 'MALFORMED_PAYLOAD');
    }

    const mirror = this.findMirror(snapshot.sessionId, envelope.roomId, envelope.channelId);
    if (!mirror) {
      return this.reject(envelope, snapshot, 'LEASE_REJECTED');
    }

    const lease = Object.freeze({
      ...this.rebuildLeaseFromMirror(mirror),
      socketId,
      updatedAt: this.now(),
      expiresAt: this.now() + this.config.leaseTtlMs,
      stage: 'PULSED' as ChatTypingStage,
      confidence: pulse.confidence,
      metadata: Object.freeze({
        ...mirror.metadata,
        pulseMetadata: pulse.metadata,
      }),
    });

    const backendEnvelope = this.buildBackendEnvelope(auth, snapshot, socketId, envelope, lease);
    const backendResult = await this.submitBackendEnvelope(backendEnvelope, envelope, snapshot);
    if (!backendResult.accepted) {
      return this.reject(envelope, snapshot, 'BACKEND_UNAVAILABLE');
    }

    this.storeLease(lease);
    this.storeMirror(lease);
    await this.emitFanout(lease, 'PULSED', backendResult);

    return this.accept(envelope, snapshot, lease, 'PULSED', backendResult, null);
  }

  private async handleRequestRemoteState(
    auth: ChatGatewayAuthContext,
    snapshot: ChatSessionAuthoritySnapshot,
    socketId: string,
    envelope: ChatTypingEnvelope,
  ): Promise<ChatTypingAck> {
    if (!this.config.allowRemoteStateRequests) {
      return this.reject(envelope, snapshot, 'REMOTE_STATE_NOT_ALLOWED');
    }

    const request = envelope.remoteStateRequest;
    if (!request) {
      return this.reject(envelope, snapshot, 'MALFORMED_PAYLOAD');
    }

    this.totalRemoteStateRequests += 1;
    this.metricsPort?.recordRemoteStateRequest(request.roomId);

    const backendEnvelope = this.buildBackendEnvelope(
      auth,
      snapshot,
      socketId,
      envelope,
      this.syntheticLeaseForRequest(snapshot, socketId, request.roomId, request.channelId),
    );

    const backendResult = await this.submitBackendEnvelope(backendEnvelope, envelope, snapshot);
    if (!backendResult.accepted) {
      return this.reject(envelope, snapshot, 'BACKEND_UNAVAILABLE');
    }

    const remoteState = backendResult.remoteStatePayload ?? this.buildRemoteStateSnapshot(request);

    return this.accept(
      envelope,
      snapshot,
      null,
      null,
      backendResult,
      remoteState,
    );
  }

  private async handleClearRoomTyping(
    auth: ChatGatewayAuthContext,
    snapshot: ChatSessionAuthoritySnapshot,
    socketId: string,
    envelope: ChatTypingEnvelope,
  ): Promise<ChatTypingAck> {
    if (!this.config.allowRoomClear) {
      return this.reject(envelope, snapshot, 'CLEAR_NOT_ALLOWED');
    }

    const clear = envelope.clearRoomPayload;
    if (!clear) {
      return this.reject(envelope, snapshot, 'MALFORMED_PAYLOAD');
    }

    const backendEnvelope = this.buildBackendEnvelope(
      auth,
      snapshot,
      socketId,
      envelope,
      this.syntheticLeaseForRequest(snapshot, socketId, clear.roomId, clear.channelId),
    );

    const backendResult = await this.submitBackendEnvelope(backendEnvelope, envelope, snapshot);
    if (!backendResult.accepted) {
      return this.reject(envelope, snapshot, 'BACKEND_UNAVAILABLE');
    }

    const targets = this.listMirrorsForRoom(clear.roomId, clear.channelId);
    for (const target of targets) {
      const lease = this.rebuildLeaseFromMirror(target);
      this.deleteLeaseById(lease.leaseId);
      this.deleteMirror(target.sessionId, target.roomId, target.channelId);
      await this.emitFanout(lease, 'CLEARED', backendResult);
    }

    return this.accept(envelope, snapshot, null, 'CLEARED', backendResult, null);
  }

  private async handleDisconnectHint(
    auth: ChatGatewayAuthContext,
    snapshot: ChatSessionAuthoritySnapshot,
    socketId: string,
    envelope: ChatTypingEnvelope,
  ): Promise<ChatTypingAck> {
    if (!this.config.allowDisconnectHint) {
      return this.reject(envelope, snapshot, 'DISCONNECT_HINT_REJECTED');
    }

    const hint = envelope.disconnectHintPayload;
    const roomId = hint.roomId;

    const backendEnvelope = this.buildBackendEnvelope(
      auth,
      snapshot,
      socketId,
      envelope,
      this.syntheticLeaseForRequest(snapshot, socketId, roomId ?? '__none__', hint.channelId),
    );

    const backendResult = await this.submitBackendEnvelope(backendEnvelope, envelope, snapshot);
    if (!backendResult.accepted) {
      return this.reject(envelope, snapshot, 'BACKEND_UNAVAILABLE');
    }

    const targets = roomId
      ? this.listMirrorsForRoom(roomId, hint.channelId)
      : this.listMirrorsForSession(snapshot.sessionId);

    for (const target of targets) {
      const lease = this.rebuildLeaseFromMirror(target);
      this.deleteLeaseById(lease.leaseId);
      this.deleteMirror(target.sessionId, target.roomId, target.channelId);
      if (this.config.expireOnDisconnectHint) {
        await this.emitFanout(lease, 'HARD_STOPPED', backendResult);
      }
    }

    return this.accept(envelope, snapshot, null, 'HARD_STOPPED', backendResult, null);
  }

  // ==========================================================================
  // MARK: Backend submission and fanout
  // ==========================================================================

  private async submitBackendEnvelope(
    backendEnvelope: ChatTypingBackendEnvelope,
    envelope: ChatTypingEnvelope,
    snapshot: ChatSessionAuthoritySnapshot,
  ): Promise<ChatTypingBackendResult> {
    try {
      return await this.backend.submitTypingEnvelope(backendEnvelope);
    } catch (error) {
      this.logger.error('chat.typing.backend_submit_failed', {
        envelopeId: envelope.envelopeId,
        sessionId: snapshot.sessionId,
        roomId: envelope.roomId,
        channelId: envelope.channelId,
        error: error instanceof Error ? error.message : String(error),
      });

      return Object.freeze({
        accepted: false,
        backendEnvelopeId: backendEnvelope.backendEnvelopeId,
        roomId: backendEnvelope.roomId,
        channelId: backendEnvelope.channelId,
        state: 'REJECTED',
        reason: 'backend_exception',
        authoritativeLeaseId: null,
        expiresAt: null,
        stage: null,
        echoPayload: null,
        remoteStatePayload: null,
        extraMetadata: Object.freeze({
          error: error instanceof Error ? error.message : String(error),
        }),
      });
    }
  }

  private async emitFanout(
    lease: ChatTypingLease,
    stage: ChatTypingStage,
    result: ChatTypingBackendResult,
  ): Promise<void> {
    const fanout: ChatTypingFanoutEnvelope = Object.freeze({
      fanoutId: randomUUID(),
      roomId: lease.roomId,
      channelId: lease.channelId,
      stage,
      audienceScope: lease.audienceScope,
      source: lease.source,
      fromUserId: lease.userId,
      fromUsername: lease.username,
      leaseId: result.authoritativeLeaseId ?? lease.leaseId,
      expiresAt: result.expiresAt ?? lease.expiresAt,
      emittedAt: this.now(),
      payload: Object.freeze({
        stage,
        confidence: lease.confidence,
        composing: lease.composing,
        source: lease.source,
        intentKind: lease.intentKind,
        textPreview: this.config.allowPreviewInFanout ? lease.textPreview : null,
        textMetrics: lease.textMetrics,
        echoPayload: result.echoPayload,
      }),
    });

    await this.fanout.fanout(fanout);
    this.totalFanouts += 1;
  }

  // ==========================================================================
  // MARK: Session and room checks
  // ==========================================================================

  private resolveSessionSnapshot(
    auth: ChatGatewayAuthContext,
  ): ChatSessionAuthoritySnapshot | null {
    const sessionId = this.extractSessionId(auth);
    if (sessionId) {
      const direct = this.sessionRegistry.getAuthoritySnapshot(sessionId);
      if (direct && direct.userId === auth.userId) {
        return direct;
      }
    }

    const candidates = this.sessionRegistry.listAuthoritySnapshotsForUser(auth.userId);
    if (sessionId) {
      const exact = candidates.find((item) => item.sessionId === sessionId);
      if (exact) {
        return exact;
      }
    }

    return candidates[0] ?? null;
  }

  private extractSessionId(auth: ChatGatewayAuthContext): string | null {
    const record = auth as unknown as Record<string, unknown>;
    return asString(record.sessionId) ?? auth.sessionIdHint ?? null;
  }

  private isSocketBound(
    snapshot: ChatSessionAuthoritySnapshot,
    socketId: string,
  ): boolean {
    return snapshot.socketIds.includes(socketId);
  }

  private isRoomJoined(
    snapshot: ChatSessionAuthoritySnapshot,
    roomId: string,
  ): boolean {
    return snapshot.roomIds.includes(roomId);
  }

  private isTypingRestricted(snapshot: ChatSessionAuthoritySnapshot): boolean {
    const now = this.now();
    if (snapshot.terminatedAt) {
      return true;
    }
    if (snapshot.mutedUntil && snapshot.mutedUntil > now) {
      return true;
    }
    if (snapshot.quarantinedUntil && snapshot.quarantinedUntil > now) {
      return true;
    }
    if (snapshot.suspendedUntil && snapshot.suspendedUntil > now) {
      return true;
    }

    return snapshot.restrictions.some((restriction) => {
      const code = restriction.code.toUpperCase();
      return code.includes('CHAT') || code.includes('TYPING') || code.includes('READ_ONLY');
    });
  }

  // ==========================================================================
  // MARK: Rate windows
  // ==========================================================================

  private checkRateWindow(
    sessionId: string,
    kind: ChatTypingEventKind,
  ): { accepted: true } | { accepted: false; retryAfterMs: number } {
    const now = this.now();
    const window = this.rateWindowsBySessionId.get(sessionId);

    if (!window || now - window.windowStartedAt > this.config.eventRateWindowMs) {
      this.rateWindowsBySessionId.set(sessionId, {
        windowStartedAt: now,
        eventCount: 1,
        pulseCount: kind === 'PULSE_TYPING' ? 1 : 0,
        refreshCount: kind === 'REFRESH_TYPING' ? 1 : 0,
      });
      return { accepted: true };
    }

    const nextEventCount = window.eventCount + 1;
    const nextPulseCount = window.pulseCount + (kind === 'PULSE_TYPING' ? 1 : 0);
    const nextRefreshCount = window.refreshCount + (kind === 'REFRESH_TYPING' ? 1 : 0);

    if (nextEventCount > this.config.maxTypingEventsPerWindow) {
      return {
        accepted: false,
        retryAfterMs: Math.max(250, this.config.eventRateWindowMs - (now - window.windowStartedAt)),
      };
    }

    if (nextPulseCount > this.config.maxTypingPulsesPerWindow) {
      return {
        accepted: false,
        retryAfterMs: Math.max(250, this.config.eventRateWindowMs - (now - window.windowStartedAt)),
      };
    }

    this.rateWindowsBySessionId.set(sessionId, {
      windowStartedAt: window.windowStartedAt,
      eventCount: nextEventCount,
      pulseCount: nextPulseCount,
      refreshCount: nextRefreshCount,
    });

    return { accepted: true };
  }

  // ==========================================================================
  // MARK: Lease and mirror state
  // ==========================================================================

  private compositeKey(
    sessionId: string,
    roomId: string,
    channelId: string | null,
  ): string {
    return `${sessionId}::${roomId}::${channelId ?? '__null__'}`;
  }

  private storeLease(lease: ChatTypingLease): void {
    this.leasesByLeaseId.set(lease.leaseId, lease);
  }

  private deleteLeaseById(leaseId: string): void {
    this.leasesByLeaseId.delete(leaseId);
  }

  private storeMirror(lease: ChatTypingLease): void {
    const record: ChatTypingMirrorRecord = Object.freeze({
      sessionId: lease.sessionId,
      userId: lease.userId,
      username: lease.username,
      socketId: lease.socketId,
      roomId: lease.roomId,
      channelId: lease.channelId,
      audienceScope: lease.audienceScope,
      source: lease.source,
      intentKind: lease.intentKind,
      confidence: lease.confidence,
      composing: lease.composing,
      textPreview: lease.textPreview,
      textMetrics: lease.textMetrics,
      leaseId: lease.leaseId,
      stage: lease.stage,
      createdAt: lease.createdAt,
      updatedAt: lease.updatedAt,
      expiresAt: lease.expiresAt,
      metadata: lease.metadata,
    });

    this.mirrorsByCompositeKey.set(
      this.compositeKey(lease.sessionId, lease.roomId, lease.channelId),
      record,
    );
  }

  private deleteMirror(
    sessionId: string,
    roomId: string,
    channelId: string | null,
  ): void {
    this.mirrorsByCompositeKey.delete(this.compositeKey(sessionId, roomId, channelId));
  }

  private findMirror(
    sessionId: string,
    roomId: string,
    channelId: string | null,
  ): ChatTypingMirrorRecord | null {
    return this.mirrorsByCompositeKey.get(this.compositeKey(sessionId, roomId, channelId)) ?? null;
  }

  private listMirrorsForRoom(
    roomId: string,
    channelId: string | null,
  ): ChatTypingMirrorRecord[] {
    const items: ChatTypingMirrorRecord[] = [];
    for (const mirror of this.mirrorsByCompositeKey.values()) {
      if (mirror.roomId === roomId && mirror.channelId === channelId) {
        items.push(mirror);
      }
    }
    return items;
  }

  private listMirrorsForSession(sessionId: string): ChatTypingMirrorRecord[] {
    const items: ChatTypingMirrorRecord[] = [];
    for (const mirror of this.mirrorsByCompositeKey.values()) {
      if (mirror.sessionId === sessionId) {
        items.push(mirror);
      }
    }
    return items;
  }

  private rebuildLeaseFromMirror(mirror: ChatTypingMirrorRecord): ChatTypingLease {
    return Object.freeze({
      leaseId: mirror.leaseId,
      sessionId: mirror.sessionId,
      userId: mirror.userId,
      username: mirror.username,
      socketId: mirror.socketId,
      roomId: mirror.roomId,
      channelId: mirror.channelId,
      audienceScope: mirror.audienceScope,
      source: mirror.source,
      intentKind: mirror.intentKind,
      confidence: mirror.confidence,
      composing: mirror.composing,
      textPreview: mirror.textPreview,
      textMetrics: mirror.textMetrics,
      createdAt: mirror.createdAt,
      updatedAt: mirror.updatedAt,
      expiresAt: mirror.expiresAt,
      stage: mirror.stage,
      metadata: mirror.metadata,
    });
  }

  private syntheticLeaseForStop(
    snapshot: ChatSessionAuthoritySnapshot,
    socketId: string,
    roomId: string,
    channelId: string | null,
  ): ChatTypingLease {
    const now = this.now();
    return Object.freeze({
      leaseId: randomUUID(),
      sessionId: snapshot.sessionId,
      userId: snapshot.userId,
      username: snapshot.username,
      socketId,
      roomId,
      channelId,
      audienceScope: 'CHANNEL',
      source: 'PLAYER',
      intentKind: 'UNKNOWN',
      confidence: 1,
      composing: false,
      textPreview: null,
      textMetrics: EMPTY_TEXT_METRICS,
      createdAt: now,
      updatedAt: now,
      expiresAt: now,
      stage: 'HARD_STOPPED',
      metadata: Object.freeze({ synthetic: true }),
    });
  }

  private syntheticLeaseForRequest(
    snapshot: ChatSessionAuthoritySnapshot,
    socketId: string,
    roomId: string,
    channelId: string | null,
  ): ChatTypingLease {
    const now = this.now();
    return Object.freeze({
      leaseId: randomUUID(),
      sessionId: snapshot.sessionId,
      userId: snapshot.userId,
      username: snapshot.username,
      socketId,
      roomId,
      channelId,
      audienceScope: 'CHANNEL',
      source: 'PLAYER',
      intentKind: 'UNKNOWN',
      confidence: 1,
      composing: false,
      textPreview: null,
      textMetrics: EMPTY_TEXT_METRICS,
      createdAt: now,
      updatedAt: now,
      expiresAt: now,
      stage: 'PULSED',
      metadata: Object.freeze({ synthetic: true }),
    });
  }

  private expireLease(
    lease: ChatTypingLease,
    reason: string,
  ): void {
    this.deleteLeaseById(lease.leaseId);
    this.deleteMirror(lease.sessionId, lease.roomId, lease.channelId);
    this.totalLeaseExpirations += 1;
    this.metricsPort?.recordLeaseExpired(lease.roomId);
    this.logger.debug('chat.typing.lease_expired', {
      leaseId: lease.leaseId,
      roomId: lease.roomId,
      channelId: lease.channelId,
      sessionId: lease.sessionId,
      reason,
    });
  }

  // ==========================================================================
  // MARK: Backend envelope and remote state
  // ==========================================================================

  private buildBackendEnvelope(
    auth: ChatGatewayAuthContext,
    snapshot: ChatSessionAuthoritySnapshot,
    socketId: string,
    envelope: ChatTypingEnvelope,
    lease: ChatTypingLease,
  ): ChatTypingBackendEnvelope {
    const payload = Object.freeze({
      kind: envelope.kind,
      roomId: envelope.roomId,
      channelId: envelope.channelId,
      stagePayload: envelope.stagePayload,
      pulsePayload: envelope.pulsePayload,
      remoteStateRequest: envelope.remoteStateRequest,
      clearRoomPayload: envelope.clearRoomPayload,
      disconnectHintPayload: envelope.disconnectHintPayload,
      lease,
      envelopeMetadata: envelope.metadata,
    });

    return Object.freeze({
      backendEnvelopeId: randomUUID(),
      submittedAt: this.now(),
      namespace: auth.namespace,
      roomId: envelope.roomId ?? lease.roomId,
      channelId: envelope.channelId,
      sessionId: snapshot.sessionId,
      userId: snapshot.userId,
      username: snapshot.username,
      authLevel: snapshot.authLevel,
      socketId,
      kind: envelope.kind,
      leaseId: lease.leaseId,
      payloadHash: sha256(JSON.stringify(payload)),
      restrictions: Object.freeze(snapshot.restrictions.map((item) => item.code)),
      payload,
      transportMetadata: Object.freeze({
        authAuditId: auth.auditId,
        roomIdHint: auth.roomIdHint ?? null,
        sessionIdHint: auth.sessionIdHint ?? null,
        transportFeatures: auth.transportFeatures ?? [],
      }),
    });
  }

  private buildRemoteStateSnapshot(
    request: ChatTypingRemoteStateRequestPayload,
  ): ChatTypingRemoteStateSnapshot {
    const items = this.listMirrorsForRoom(request.roomId, request.channelId)
      .filter((mirror) => (request.includeSelf ? true : true))
      .filter((mirror) => (request.includeNpc ? true : mirror.source !== 'NPC'))
      .filter((mirror) => (request.includeHelpers ? true : mirror.source !== 'HELPER'))
      .filter((mirror) => (request.includeHaters ? true : mirror.source !== 'HATER'))
      .map((mirror) => {
        const preview = request.includePreview ? mirror.textPreview : null;
        return Object.freeze({
          sessionId: mirror.sessionId,
          userId: mirror.userId,
          username: mirror.username,
          roomId: mirror.roomId,
          channelId: mirror.channelId,
          audienceScope: mirror.audienceScope,
          source: mirror.source,
          intentKind: mirror.intentKind,
          confidence: mirror.confidence,
          composing: mirror.composing,
          textPreview: preview,
          textMetrics: mirror.textMetrics,
          stage: mirror.stage,
          updatedAt: mirror.updatedAt,
          expiresAt: mirror.expiresAt,
        });
      });

    return Object.freeze({
      roomId: request.roomId,
      channelId: request.channelId,
      generatedAt: this.now(),
      items,
    });
  }

  // ==========================================================================
  // MARK: Accept and reject acks
  // ==========================================================================

  private accept(
    envelope: ChatTypingEnvelope,
    snapshot: ChatSessionAuthoritySnapshot,
    lease: ChatTypingLease | null,
    stage: ChatTypingStage | null,
    result: ChatTypingBackendResult,
    remoteState: Readonly<Record<string, unknown>> | ChatTypingRemoteStateSnapshot | null,
  ): ChatTypingAck {
    this.totalAccepted += 1;
    this.metricsPort?.recordAccepted(envelope.kind, envelope.roomId);

    const ack: ChatTypingAck = Object.freeze({
      ackId: randomUUID(),
      envelopeId: envelope.envelopeId,
      roomId: envelope.roomId,
      channelId: envelope.channelId,
      state: result.state,
      reason: null,
      leaseId: result.authoritativeLeaseId ?? lease?.leaseId ?? null,
      stage: stage ?? result.stage,
      retryAfterMs: null,
      expiresAt: result.expiresAt ?? lease?.expiresAt ?? null,
      remoteState: remoteState as Readonly<Record<string, unknown>> | null,
      issuedAt: this.now(),
      metadata: Object.freeze({
        backendEnvelopeId: result.backendEnvelopeId,
        backendReason: result.reason,
        extraMetadata: result.extraMetadata,
      }),
    });

    this.recordAudit(envelope, snapshot, ack.state, null, ack.leaseId, ack.stage, ack.metadata);
    return ack;
  }

  private reject(
    envelope: ChatTypingEnvelope,
    snapshot: ChatSessionAuthoritySnapshot | null,
    reason: ChatTypingRejectReason,
    retryAfterMs: number | null = null,
  ): ChatTypingAck {
    this.totalRejected += 1;
    if (reason === 'RATE_LIMITED') {
      this.totalRateLimited += 1;
      this.metricsPort?.recordRateLimited(envelope.kind, envelope.roomId);
    } else {
      this.metricsPort?.recordRejected(envelope.kind, reason, envelope.roomId);
    }

    const ack: ChatTypingAck = Object.freeze({
      ackId: randomUUID(),
      envelopeId: envelope.envelopeId,
      roomId: envelope.roomId,
      channelId: envelope.channelId,
      state: reason === 'RATE_LIMITED' ? 'RATE_LIMITED' : 'REJECTED',
      reason,
      leaseId: null,
      stage: null,
      retryAfterMs,
      expiresAt: null,
      remoteState: null,
      issuedAt: this.now(),
      metadata: Object.freeze({
        kind: envelope.kind,
        namespace: envelope.namespace,
      }),
    });

    this.recordAudit(envelope, snapshot, ack.state, reason, null, null, ack.metadata);
    this.logger.warn('chat.typing.rejected', {
      reason,
      envelopeId: envelope.envelopeId,
      roomId: envelope.roomId,
      channelId: envelope.channelId,
      sessionId: snapshot?.sessionId ?? null,
    });

    return ack;
  }

  private recordAudit(
    envelope: ChatTypingEnvelope,
    snapshot: ChatSessionAuthoritySnapshot | null,
    state: ChatTypingAckState,
    reason: ChatTypingRejectReason | null,
    leaseId: string | null,
    stage: ChatTypingStage | null,
    metadata: Readonly<Record<string, unknown>>,
  ): void {
    const dedupeKey = envelope.roomId
      ? sha256(
          `${snapshot?.sessionId ?? 'anon'}::${envelope.roomId}::${envelope.channelId ?? '__null__'}::${envelope.kind}`,
        )
      : null;

    const record: ChatTypingAuditRecord = Object.freeze({
      auditId: randomUUID(),
      envelopeId: envelope.envelopeId,
      kind: envelope.kind,
      sessionId: snapshot?.sessionId ?? null,
      userId: snapshot?.userId ?? 'unknown',
      roomId: envelope.roomId,
      channelId: envelope.channelId,
      state,
      reason,
      leaseId,
      stage,
      dedupeKey,
      createdAt: this.now(),
      metadata,
    });

    this.auditTrail.push(record);
    if (this.auditTrail.length > this.config.auditLimit) {
      this.auditTrail.splice(0, this.auditTrail.length - this.config.auditLimit);
    }
  }
}
