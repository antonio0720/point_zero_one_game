/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT EVENT BRIDGE
 * FILE: backend/src/game/engine/chat/ChatEventBridge.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend translation seam that converts transport intents and
 * upstream engine signals into the authoritative normalized chat vocabulary.
 *
 * Backend-truth question
 * ----------------------
 *
 *   "When transport, battle, run, multiplayer, economy, or liveops emit input,
 *    what exact backend-native event shape should authoritative chat mutate
 *    against?"
 *
 * Design doctrine
 * ---------------
 * - translation is deterministic and replayable;
 * - translation is not moderation;
 * - translation is not rate control;
 * - translation is not reducer mutation;
 * - translation is not socket ownership;
 * - upstream engines keep sovereignty over their domains;
 * - chat only consumes their outputs after normalization;
 * - normalized events receive canonical room/session/user coordinates before
 *   any downstream policy gate runs.
 *
 * This file therefore owns:
 * - raw transport payload adaptation,
 * - canonical ChatInputEnvelope construction,
 * - normalized event creation,
 * - room/session/user resolution,
 * - metadata enrichment,
 * - signal canonicalization,
 * - dedupe windows,
 * - batch normalization,
 * - explainable normalization reports.
 *
 * It does not own:
 * - transcript mutation,
 * - proof edges,
 * - replay writes,
 * - moderation decisions,
 * - channel legality,
 * - final rate outcomes,
 * - learning persistence.
 * ============================================================================
 */

import {
  CHAT_CHANNEL_DESCRIPTORS,
  asUnixMs,
  clamp01,
  clamp100,
  isRoomKind,
  isVisibleChannelId,
  type AttackType,
  type BotId,
  type ChatBattleSnapshot,
  type ChatEconomySnapshot,
  type ChatEventId,
  type ChatEventKind,
  type ChatInputEnvelope,
  type ChatJoinRequest,
  type ChatLiveOpsSnapshot,
  type ChatMultiplayerSnapshot,
  type ChatNormalizedEvent,
  type ChatNormalizedInput,
  type ChatPlayerMessageSubmitRequest,
  type ChatPresenceMode,
  type ChatPresenceUpdateRequest,
  type ChatRequestId,
  type ChatRoomId,
  type ChatRoomKind,
  type ChatRoomStageMood,
  type ChatRunSnapshot,
  type ChatSessionId,
  type ChatSessionRole,
  type ChatSignalEnvelope,
  type ChatSignalType,
  type ChatState,
  type ChatTypingMode,
  type ChatTypingUpdateRequest,
  type ChatUserId,
  type ChatVisibleChannel,
  type JsonValue,
  type Nullable,
  type PressureTier,
  type RunOutcome,
  type TickTier,
  type UnixMs,
} from './types';
import {
  DEFAULT_BACKEND_CHAT_RUNTIME,
  createRoomKindOverride,
  mergeRuntimeConfig,
  runtimeAllowsRoomKind,
  runtimeAllowsVisibleChannel,
  type ChatRuntimeConfigOptions,
} from './ChatRuntimeConfig';

// ============================================================================
// MARK: Ports, options, and raw payloads
// ============================================================================

export interface ChatEventBridgeLoggerPort {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface ChatEventBridgeClockPort {
  now(): UnixMs;
}

export interface ChatEventBridgeIdFactoryPort {
  next(seed: string): ChatEventId;
}

export interface ChatEventBridgeOptions {
  readonly logger?: ChatEventBridgeLoggerPort;
  readonly clock?: ChatEventBridgeClockPort;
  readonly idFactory?: ChatEventBridgeIdFactoryPort;
  readonly runtimeOverride?: Partial<typeof DEFAULT_BACKEND_CHAT_RUNTIME>;
  readonly runtimeOptions?: ChatRuntimeConfigOptions;
  readonly dedupeWindowMs?: number;
  readonly fallbackRoomKind?: ChatRoomKind;
  readonly trustClientRoomIds?: boolean;
  readonly trustClientSessionIds?: boolean;
}

export interface ChatEventBridgeContext {
  readonly logger: ChatEventBridgeLoggerPort;
  readonly clock: ChatEventBridgeClockPort;
  readonly idFactory: ChatEventBridgeIdFactoryPort;
  readonly runtimeOverride?: Partial<typeof DEFAULT_BACKEND_CHAT_RUNTIME>;
  readonly runtimeOptions?: ChatRuntimeConfigOptions;
  readonly dedupeWindowMs: number;
  readonly fallbackRoomKind: ChatRoomKind;
  readonly trustClientRoomIds: boolean;
  readonly trustClientSessionIds: boolean;
}

export interface ChatEventBridgeRejection {
  readonly reason: string;
  readonly sourceKind: ChatInputEnvelope['kind'];
  readonly emittedAt: UnixMs;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface ChatNormalizationReport {
  readonly accepted: readonly ChatNormalizedInput[];
  readonly rejected: readonly ChatEventBridgeRejection[];
  readonly deduped: readonly ChatNormalizedInput[];
}

export interface ChatNormalizedBatch {
  readonly source: string;
  readonly report: ChatNormalizationReport;
}

export interface ChatTransportJoinPayload {
  readonly roomId?: string | null;
  readonly roomKind?: string | null;
  readonly title?: string | null;
  readonly sessionId?: string | null;
  readonly userId?: string | null;
  readonly displayName?: string | null;
  readonly role?: string | null;
  readonly entitlementTier?: string | null;
  readonly factionId?: string | null;
  readonly mountTarget?: string | null;
  readonly requestedVisibleChannel?: string | null;
  readonly transportMetadata?: Readonly<Record<string, JsonValue>>;
  readonly emittedAt?: number;
}

export interface ChatTransportLeavePayload {
  readonly roomId?: string | null;
  readonly sessionId?: string | null;
  readonly reason?: string | null;
  readonly emittedAt?: number;
}

export interface ChatTransportPresencePayload {
  readonly roomId?: string | null;
  readonly sessionId?: string | null;
  readonly mode?: string | null;
  readonly spectating?: boolean | null;
  readonly visibleToRoom?: boolean | null;
  readonly emittedAt?: number;
}

export interface ChatTransportTypingPayload {
  readonly roomId?: string | null;
  readonly sessionId?: string | null;
  readonly channelId?: string | null;
  readonly mode?: string | null;
  readonly emittedAt?: number;
}

export interface ChatTransportMessagePayload {
  readonly roomId?: string | null;
  readonly sessionId?: string | null;
  readonly channelId?: string | null;
  readonly requestId?: string | null;
  readonly text?: string | null;
  readonly clientHints?: Readonly<Record<string, JsonValue>>;
  readonly emittedAt?: number;
}

export interface ChatTransportSignalPayload {
  readonly roomId?: string | null;
  readonly emittedAt?: number;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
  readonly battle?: Readonly<Record<string, JsonValue>>;
  readonly run?: Readonly<Record<string, JsonValue>>;
  readonly multiplayer?: Readonly<Record<string, JsonValue>>;
  readonly economy?: Readonly<Record<string, JsonValue>>;
  readonly liveops?: Readonly<Record<string, JsonValue>>;
}

// ============================================================================
// MARK: Main façade
// ============================================================================

export class ChatEventBridge {
  private readonly context: ChatEventBridgeContext;
  private readonly recent = new Map<string, UnixMs>();

  constructor(options: ChatEventBridgeOptions = {}) {
    this.context = {
      logger: options.logger ?? createDefaultLogger(),
      clock: options.clock ?? { now: () => asUnixMs(Date.now()) },
      idFactory: options.idFactory ?? createDefaultIdFactory(),
      runtimeOverride: options.runtimeOverride,
      runtimeOptions: options.runtimeOptions,
      dedupeWindowMs: Math.max(100, options.dedupeWindowMs ?? 1_250),
      fallbackRoomKind: options.fallbackRoomKind ?? 'LOBBY',
      trustClientRoomIds: options.trustClientRoomIds ?? true,
      trustClientSessionIds: options.trustClientSessionIds ?? true,
    };
  }

  // -------------------------------------------------------------------------
  // MARK: Raw transport -> input envelope
  // -------------------------------------------------------------------------

  fromTransportJoin(payload: ChatTransportJoinPayload): ChatInputEnvelope {
    return {
      kind: 'SESSION_JOIN_REQUEST',
      emittedAt: coerceUnixMs(payload.emittedAt, this.context.clock.now()),
      payload: {
        roomId: asRoomId(payload.roomId ?? null, 'room'),
        roomKind: normalizeRoomKind(payload.roomKind ?? null, this.context.fallbackRoomKind),
        title: sanitizeRoomTitle(payload.title ?? null),
        session: {
          sessionId: asSessionId(payload.sessionId ?? null, 'session'),
          userId: asUserId(payload.userId ?? null, 'user'),
          displayName: sanitizeDisplayName(payload.displayName ?? null),
          role: normalizeSessionRole(payload.role ?? null),
          entitlementTier: sanitizeOptionalString(payload.entitlementTier ?? null),
          factionId: sanitizeOptionalString(payload.factionId ?? null),
        },
        mountTarget: sanitizeOptionalString(payload.mountTarget ?? null) as ChatJoinRequest['mountTarget'],
        requestedVisibleChannel: normalizeRequestedVisibleChannel(payload.requestedVisibleChannel ?? null),
        transportMetadata: payload.transportMetadata,
      },
    };
  }

  fromTransportLeave(payload: ChatTransportLeavePayload): ChatInputEnvelope {
    return {
      kind: 'SESSION_LEAVE',
      emittedAt: coerceUnixMs(payload.emittedAt, this.context.clock.now()),
      payload: {
        roomId: asRoomId(payload.roomId ?? null, 'room'),
        sessionId: asSessionId(payload.sessionId ?? null, 'session'),
        reason: sanitizeReason(payload.reason ?? null, 'leave'),
      },
    };
  }

  fromTransportPresence(payload: ChatTransportPresencePayload): ChatInputEnvelope {
    return {
      kind: 'PRESENCE_UPDATED',
      emittedAt: coerceUnixMs(payload.emittedAt, this.context.clock.now()),
      payload: {
        roomId: asRoomId(payload.roomId ?? null, 'room'),
        sessionId: asSessionId(payload.sessionId ?? null, 'session'),
        mode: normalizePresenceMode(payload.mode ?? null),
        spectating: Boolean(payload.spectating),
        visibleToRoom: payload.visibleToRoom ?? true,
      },
    };
  }

  fromTransportTyping(payload: ChatTransportTypingPayload): ChatInputEnvelope {
    return {
      kind: 'TYPING_UPDATED',
      emittedAt: coerceUnixMs(payload.emittedAt, this.context.clock.now()),
      payload: {
        roomId: asRoomId(payload.roomId ?? null, 'room'),
        sessionId: asSessionId(payload.sessionId ?? null, 'session'),
        channelId: normalizeVisibleChannel(payload.channelId ?? null, 'LOBBY'),
        mode: normalizeTypingMode(payload.mode ?? null),
      },
    };
  }

  fromTransportMessage(payload: ChatTransportMessagePayload): ChatInputEnvelope {
    const sessionId = asSessionId(payload.sessionId ?? null, 'session');
    return {
      kind: 'PLAYER_MESSAGE_SUBMIT',
      emittedAt: coerceUnixMs(payload.emittedAt, this.context.clock.now()),
      payload: {
        roomId: asRoomId(payload.roomId ?? null, 'room'),
        sessionId,
        channelId: normalizeVisibleChannel(payload.channelId ?? null, 'LOBBY'),
        requestId: asRequestId(payload.requestId ?? null, sessionId, this.context.clock.now()),
        text: sanitizeMessageText(payload.text ?? null),
        clientHints: payload.clientHints,
      },
    };
  }

  fromBattleSignal(payload: ChatTransportSignalPayload): ChatInputEnvelope {
    return this.fromSignalPayload('BATTLE_SIGNAL', 'BATTLE', payload);
  }

  fromRunSignal(payload: ChatTransportSignalPayload): ChatInputEnvelope {
    return this.fromSignalPayload('RUN_SIGNAL', 'RUN', payload);
  }

  fromMultiplayerSignal(payload: ChatTransportSignalPayload): ChatInputEnvelope {
    return this.fromSignalPayload('MULTIPLAYER_SIGNAL', 'MULTIPLAYER', payload);
  }

  fromEconomySignal(payload: ChatTransportSignalPayload): ChatInputEnvelope {
    return this.fromSignalPayload('ECONOMY_SIGNAL', 'ECONOMY', payload);
  }

  fromLiveOpsSignal(payload: ChatTransportSignalPayload): ChatInputEnvelope {
    return this.fromSignalPayload('LIVEOPS_SIGNAL', 'LIVEOPS', payload);
  }

  fromMaintenanceTick(reason: string, emittedAt?: number): ChatInputEnvelope {
    return {
      kind: 'MAINTENANCE_TICK',
      emittedAt: coerceUnixMs(emittedAt, this.context.clock.now()),
      payload: { reason: sanitizeReason(reason, 'maintenance') },
    };
  }

  private fromSignalPayload(
    kind: Extract<ChatInputEnvelope['kind'], 'BATTLE_SIGNAL' | 'RUN_SIGNAL' | 'MULTIPLAYER_SIGNAL' | 'ECONOMY_SIGNAL' | 'LIVEOPS_SIGNAL'>,
    signalType: ChatSignalType,
    payload: ChatTransportSignalPayload,
  ): ChatInputEnvelope {
    const emittedAt = coerceUnixMs(payload.emittedAt, this.context.clock.now());
    const roomId = payload.roomId ? asRoomId(payload.roomId ?? null, 'room') : null;
    return {
      kind,
      emittedAt,
      payload: canonicalizeSignalEnvelope(
        {
          type: signalType,
          emittedAt,
          roomId,
          battle: payload.battle ? canonicalizeBattleSnapshot(payload.battle) : undefined,
          run: payload.run ? canonicalizeRunSnapshot(payload.run) : undefined,
          multiplayer: payload.multiplayer ? canonicalizeMultiplayerSnapshot(payload.multiplayer) : undefined,
          economy: payload.economy ? canonicalizeEconomySnapshot(payload.economy) : undefined,
          liveops: payload.liveops ? canonicalizeLiveOpsSnapshot(payload.liveops) : undefined,
          metadata: payload.metadata,
        },
        signalType,
        emittedAt,
        roomId,
      ),
    };
  }

  // -------------------------------------------------------------------------
  // MARK: Normalization façade
  // -------------------------------------------------------------------------

  normalize(input: ChatInputEnvelope, state?: ChatState): ChatNormalizationReport {
    const accepted: ChatNormalizedInput[] = [];
    const rejected: ChatEventBridgeRejection[] = [];
    const deduped: ChatNormalizedInput[] = [];

    const candidate = this.translate(input, state);
    if (!candidate) {
      rejected.push({
        reason: 'translation_failed',
        sourceKind: input.kind,
        emittedAt: input.emittedAt,
        details: { kind: input.kind },
      });
      return Object.freeze({ accepted, rejected, deduped });
    }

    const roomKind = resolveNormalizedRoomKind(candidate, state ?? null, this.context.fallbackRoomKind);
    const runtime = resolveRuntimeForRoomKind(roomKind, this.context.runtimeOverride, this.context.runtimeOptions);

    if (!runtimeAllowsRoomKind(runtime, roomKind)) {
      rejected.push({
        reason: 'runtime_disallows_room_kind',
        sourceKind: input.kind,
        emittedAt: input.emittedAt,
        details: { roomKind, normalizedKind: candidate.kind },
      });
      return Object.freeze({ accepted, rejected, deduped });
    }

    const visibleChannel = extractVisibleChannelFromPayload(candidate.payload);
    if (visibleChannel && !runtimeAllowsVisibleChannel(runtime, visibleChannel)) {
      rejected.push({
        reason: 'runtime_disallows_visible_channel',
        sourceKind: input.kind,
        emittedAt: input.emittedAt,
        details: { roomKind, channelId: visibleChannel, normalizedKind: candidate.kind },
      });
      return Object.freeze({ accepted, rejected, deduped });
    }

    if (this.isDeduped(candidate)) {
      deduped.push(candidate);
      return Object.freeze({ accepted, rejected, deduped });
    }

    this.remember(candidate);
    accepted.push(candidate);
    return Object.freeze({ accepted, rejected, deduped });
  }

  normalizeMany(inputs: readonly ChatInputEnvelope[], state?: ChatState, source = 'batch'): ChatNormalizedBatch {
    const accepted: ChatNormalizedInput[] = [];
    const rejected: ChatEventBridgeRejection[] = [];
    const deduped: ChatNormalizedInput[] = [];

    for (const input of inputs) {
      const report = this.normalize(input, state);
      accepted.push(...report.accepted);
      rejected.push(...report.rejected);
      deduped.push(...report.deduped);
    }

    return Object.freeze({
      source,
      report: Object.freeze({
        accepted: Object.freeze(accepted),
        rejected: Object.freeze(rejected),
        deduped: Object.freeze(deduped),
      }),
    });
  }

  // -------------------------------------------------------------------------
  // MARK: Translation core
  // -------------------------------------------------------------------------

  private translate(input: ChatInputEnvelope, state?: ChatState): ChatNormalizedInput | null {
    switch (input.kind) {
      case 'SESSION_JOIN_REQUEST':
        return this.translateJoin(input.payload, input.emittedAt, state);
      case 'SESSION_LEAVE':
        return this.translateLeave(input.payload.roomId, input.payload.sessionId, input.payload.reason, input.emittedAt, state);
      case 'PRESENCE_UPDATED':
        return this.translatePresence(input.payload, input.emittedAt, state);
      case 'TYPING_UPDATED':
        return this.translateTyping(input.payload, input.emittedAt, state);
      case 'PLAYER_MESSAGE_SUBMIT':
        return this.translatePlayerMessage(input.payload, input.emittedAt, state);
      case 'BATTLE_SIGNAL':
      case 'RUN_SIGNAL':
      case 'MULTIPLAYER_SIGNAL':
      case 'ECONOMY_SIGNAL':
      case 'LIVEOPS_SIGNAL':
        return this.translateSignal(input.kind, input.payload, input.emittedAt, state);
      case 'MAINTENANCE_TICK':
        return this.translateMaintenance(input.payload.reason, input.emittedAt, state);
      default:
        return null;
    }
  }

  private translateJoin(payload: ChatJoinRequest, emittedAt: UnixMs, state?: ChatState): ChatNormalizedEvent<ChatJoinRequest> {
    const roomId = resolveRoomId(payload.roomId, payload.session.sessionId, state ?? null, this.context.trustClientRoomIds);
    const roomKind = resolveJoinRoomKind(payload.roomKind, roomId, state ?? null, this.context.fallbackRoomKind);

    return Object.freeze({
      eventId: this.makeEventId('session_join_request', roomId, payload.session.sessionId, emittedAt),
      kind: 'SESSION_JOIN_REQUEST',
      emittedAt,
      roomId,
      sessionId: payload.session.sessionId,
      userId: payload.session.userId,
      payload: {
        ...payload,
        roomId,
        roomKind,
      },
      metadata: Object.freeze({
        source: 'transport_join',
        roomKind,
        mountTarget: payload.mountTarget ?? null,
        requestedVisibleChannel: payload.requestedVisibleChannel ?? null,
        presenceCapable: CHAT_CHANNEL_DESCRIPTORS[roomKindToDefaultChannel(roomKind)].supportsPresence,
      }),
    });
  }

  private translateLeave(
    roomIdInput: ChatRoomId,
    sessionId: ChatSessionId,
    reason: string,
    emittedAt: UnixMs,
    state?: ChatState,
  ): ChatNormalizedEvent<{ readonly roomId: ChatRoomId; readonly sessionId: ChatSessionId; readonly reason: string }> {
    const roomId = resolveRoomId(roomIdInput, sessionId, state ?? null, this.context.trustClientRoomIds);
    const userId = state?.sessions[sessionId]?.identity.userId ?? null;

    return Object.freeze({
      eventId: this.makeEventId('session_leave', roomId, sessionId, emittedAt),
      kind: 'SESSION_LEAVE',
      emittedAt,
      roomId,
      sessionId,
      userId,
      payload: Object.freeze({ roomId, sessionId, reason }),
      metadata: Object.freeze({
        source: 'transport_leave',
        reasonClass: classifyLeaveReason(reason),
      }),
    });
  }

  private translatePresence(
    payload: ChatPresenceUpdateRequest,
    emittedAt: UnixMs,
    state?: ChatState,
  ): ChatNormalizedEvent<ChatPresenceUpdateRequest> {
    const roomId = resolveRoomId(payload.roomId, payload.sessionId, state ?? null, this.context.trustClientRoomIds);
    const previous = state?.presence.byRoom[roomId]?.[payload.sessionId] ?? null;
    const userId = state?.sessions[payload.sessionId]?.identity.userId ?? null;

    return Object.freeze({
      eventId: this.makeEventId('presence_updated', roomId, payload.sessionId, emittedAt),
      kind: 'PRESENCE_UPDATED',
      emittedAt,
      roomId,
      sessionId: payload.sessionId,
      userId,
      payload: { ...payload, roomId },
      metadata: Object.freeze({
        source: 'transport_presence',
        previousMode: previous?.mode ?? null,
        previousVisibleToRoom: previous?.visibleToRoom ?? null,
        spectating: payload.spectating,
      }),
    });
  }

  private translateTyping(
    payload: ChatTypingUpdateRequest,
    emittedAt: UnixMs,
    state?: ChatState,
  ): ChatNormalizedEvent<ChatTypingUpdateRequest> {
    const roomId = resolveRoomId(payload.roomId, payload.sessionId, state ?? null, this.context.trustClientRoomIds);
    const userId = state?.sessions[payload.sessionId]?.identity.userId ?? null;

    return Object.freeze({
      eventId: this.makeEventId('typing_updated', roomId, payload.sessionId, emittedAt),
      kind: 'TYPING_UPDATED',
      emittedAt,
      roomId,
      sessionId: payload.sessionId,
      userId,
      payload: { ...payload, roomId },
      metadata: Object.freeze({
        source: 'transport_typing',
        channelSupportsTyping: CHAT_CHANNEL_DESCRIPTORS[payload.channelId].supportsTyping,
        channelSupportsPresence: CHAT_CHANNEL_DESCRIPTORS[payload.channelId].supportsPresence,
      }),
    });
  }

  private translatePlayerMessage(
    payload: ChatPlayerMessageSubmitRequest,
    emittedAt: UnixMs,
    state?: ChatState,
  ): ChatNormalizedEvent<ChatPlayerMessageSubmitRequest> {
    const roomId = resolveRoomId(payload.roomId, payload.sessionId, state ?? null, this.context.trustClientRoomIds);
    const room = state?.rooms[roomId];
    const userId = state?.sessions[payload.sessionId]?.identity.userId ?? null;
    const text = sanitizeMessageText(payload.text ?? null);

    return Object.freeze({
      eventId: this.makeEventId('player_message_submit', roomId, payload.sessionId, emittedAt),
      kind: 'PLAYER_MESSAGE_SUBMIT',
      emittedAt,
      roomId,
      sessionId: payload.sessionId,
      userId,
      payload: {
        ...payload,
        roomId,
        text,
      },
      metadata: Object.freeze({
        source: 'transport_message',
        roomKind: room?.roomKind ?? this.context.fallbackRoomKind,
        channelId: payload.channelId,
        requestId: String(payload.requestId),
        textLength: text.length,
        lineCount: countLogicalLines(text),
        clientHintKeys: Object.freeze(Object.keys(payload.clientHints ?? {})),
      }),
    });
  }

  private translateSignal(
    kind: Extract<ChatEventKind, 'BATTLE_SIGNAL' | 'RUN_SIGNAL' | 'MULTIPLAYER_SIGNAL' | 'ECONOMY_SIGNAL' | 'LIVEOPS_SIGNAL'>,
    payload: ChatSignalEnvelope,
    emittedAt: UnixMs,
    state?: ChatState,
  ): ChatNormalizedEvent<ChatSignalEnvelope> {
    const roomId = payload.roomId ?? resolveMostRecentRoomId(state ?? null);
    const sessionId = roomId ? resolveSignalSessionId(roomId, state ?? null) : null;
    const userId = sessionId ? (state?.sessions[sessionId]?.identity.userId ?? null) : null;
    const canonical = canonicalizeSignalEnvelope(payload, kindToSignalType(kind), emittedAt, roomId);

    return Object.freeze({
      eventId: this.makeEventId(kind.toLowerCase(), roomId, sessionId, emittedAt),
      kind,
      emittedAt,
      roomId,
      sessionId,
      userId,
      payload: canonical,
      metadata: Object.freeze({
        source: 'signal',
        signalType: canonical.type,
        riskLabel: deriveSignalRiskLabel(canonical),
        roomKindHint: inferRoomKindFromSignal(canonical, roomId, state ?? null, this.context.fallbackRoomKind),
        stageMoodHint: deriveMoodFromSignal(canonical),
        channelRecommendation: deriveSignalChannelRecommendation(canonical),
        heatDelta01: deriveSignalHeatDelta(canonical),
      }),
    });
  }

  private translateMaintenance(reason: string, emittedAt: UnixMs, state?: ChatState): ChatNormalizedEvent<{ readonly reason: string }> {
    return Object.freeze({
      eventId: this.makeEventId('maintenance_tick', null, null, emittedAt),
      kind: 'MAINTENANCE_TICK',
      emittedAt,
      roomId: resolveMostRecentRoomId(state ?? null),
      sessionId: null,
      userId: null,
      payload: Object.freeze({ reason }),
      metadata: Object.freeze({
        source: 'maintenance',
        pendingRevealCount: state?.pendingReveals.length ?? 0,
        roomCount: state ? Object.keys(state.rooms).length : 0,
      }),
    });
  }

  // -------------------------------------------------------------------------
  // MARK: Dedupe helpers
  // -------------------------------------------------------------------------

  private isDeduped(event: ChatNormalizedInput): boolean {
    pruneExpiredDedupeEntries(this.recent, event.emittedAt, this.context.dedupeWindowMs);
    const key = dedupeKeyForEvent(event);
    const seenAt = this.recent.get(key);
    if (seenAt === undefined) {
      return false;
    }
    return Number(event.emittedAt) - Number(seenAt) <= this.context.dedupeWindowMs;
  }

  private remember(event: ChatNormalizedInput): void {
    this.recent.set(dedupeKeyForEvent(event), event.emittedAt);
  }

  private makeEventId(
    seed: string,
    roomId: Nullable<ChatRoomId>,
    sessionId: Nullable<ChatSessionId>,
    emittedAt: UnixMs,
  ): ChatEventId {
    return this.context.idFactory.next([
      seed,
      roomId ?? 'no-room',
      sessionId ?? 'no-session',
      String(emittedAt),
    ].join(':'));
  }
}

// ============================================================================
// MARK: Standalone façade helpers
// ============================================================================

export function createChatEventBridge(options: ChatEventBridgeOptions = {}): ChatEventBridge {
  return new ChatEventBridge(options);
}

export function normalizeChatInputEnvelope(
  input: ChatInputEnvelope,
  state?: ChatState,
  options: ChatEventBridgeOptions = {},
): ChatNormalizationReport {
  return createChatEventBridge(options).normalize(input, state);
}

export function normalizeChatInputBatch(
  inputs: readonly ChatInputEnvelope[],
  state?: ChatState,
  options: ChatEventBridgeOptions = {},
  source = 'batch',
): ChatNormalizedBatch {
  return createChatEventBridge(options).normalizeMany(inputs, state, source);
}

// ============================================================================
// MARK: Canonical signal normalization
// ============================================================================

export function canonicalizeSignalEnvelope(
  signal: ChatSignalEnvelope,
  fallbackType: ChatSignalType,
  fallbackEmittedAt: UnixMs,
  fallbackRoomId: Nullable<ChatRoomId>,
): ChatSignalEnvelope {
  const type = signal.type ?? fallbackType;
  const emittedAt = signal.emittedAt ?? fallbackEmittedAt;
  return Object.freeze({
    type,
    emittedAt,
    roomId: signal.roomId ?? fallbackRoomId,
    battle: signal.battle ? canonicalizeBattleSnapshot(asJsonRecord(signal.battle) ?? {}) : undefined,
    run: signal.run ? canonicalizeRunSnapshot(asJsonRecord(signal.run) ?? {}) : undefined,
    multiplayer: signal.multiplayer ? canonicalizeMultiplayerSnapshot(asJsonRecord(signal.multiplayer) ?? {}) : undefined,
    economy: signal.economy ? canonicalizeEconomySnapshot(asJsonRecord(signal.economy) ?? {}) : undefined,
    liveops: signal.liveops ? canonicalizeLiveOpsSnapshot(asJsonRecord(signal.liveops) ?? {}) : undefined,
    metadata: signal.metadata ?? {},
  });
}

export function canonicalizeBattleSnapshot(record: Readonly<Record<string, JsonValue>>): ChatBattleSnapshot {
  return Object.freeze({
    tickNumber: Math.max(0, numberValue(record, 'tickNumber', 0)),
    pressureTier: normalizePressureTier(stringValue(record, 'pressureTier')),
    activeAttackType: normalizeAttackType(stringValue(record, 'activeAttackType')),
    activeBotId: normalizeBotId(stringValue(record, 'activeBotId')),
    hostileMomentum: clamp100(numberValue(record, 'hostileMomentum', 0)),
    rescueWindowOpen: booleanValue(record, 'rescueWindowOpen', false),
    shieldIntegrity01: clamp01(numberValue(record, 'shieldIntegrity01', 1)),
    lastAttackAt: nullableUnixMs(record, 'lastAttackAt'),
  });
}

export function canonicalizeRunSnapshot(record: Readonly<Record<string, JsonValue>>): ChatRunSnapshot {
  return Object.freeze({
    runId: sanitizeOptionalString(stringValue(record, 'runId')) ?? 'unknown-run',
    runPhase: sanitizeOptionalString(stringValue(record, 'runPhase')) ?? 'unknown',
    tickTier: normalizeTickTier(stringValue(record, 'tickTier')),
    outcome: normalizeRunOutcome(stringValue(record, 'outcome')),
    bankruptcyWarning: booleanValue(record, 'bankruptcyWarning', false),
    nearSovereignty: booleanValue(record, 'nearSovereignty', false),
    elapsedMs: Math.max(0, numberValue(record, 'elapsedMs', 0)),
  });
}

export function canonicalizeMultiplayerSnapshot(record: Readonly<Record<string, JsonValue>>): ChatMultiplayerSnapshot {
  return Object.freeze({
    roomMemberCount: Math.max(0, numberValue(record, 'roomMemberCount', 0)),
    partySize: Math.max(0, numberValue(record, 'partySize', 0)),
    spectatingCount: Math.max(0, numberValue(record, 'spectatingCount', 0)),
    factionName: sanitizeOptionalString(stringValue(record, 'factionName')),
    rankingPressure: clamp100(numberValue(record, 'rankingPressure', 0)),
  });
}

export function canonicalizeEconomySnapshot(record: Readonly<Record<string, JsonValue>>): ChatEconomySnapshot {
  return Object.freeze({
    activeDealCount: Math.max(0, numberValue(record, 'activeDealCount', 0)),
    liquidityStress01: clamp01(numberValue(record, 'liquidityStress01', 0)),
    overpayRisk01: clamp01(numberValue(record, 'overpayRisk01', 0)),
    bluffRisk01: clamp01(numberValue(record, 'bluffRisk01', 0)),
  });
}

export function canonicalizeLiveOpsSnapshot(record: Readonly<Record<string, JsonValue>>): ChatLiveOpsSnapshot {
  return Object.freeze({
    worldEventName: sanitizeOptionalString(stringValue(record, 'worldEventName')),
    heatMultiplier01: clamp01(numberValue(record, 'heatMultiplier01', 0)),
    helperBlackout: booleanValue(record, 'helperBlackout', false),
    haterRaidActive: booleanValue(record, 'haterRaidActive', false),
  });
}

// ============================================================================
// MARK: Runtime, room, and signal inference
// ============================================================================

export function resolveRuntimeForRoomKind(
  roomKind: ChatRoomKind,
  runtimeOverride?: Partial<typeof DEFAULT_BACKEND_CHAT_RUNTIME>,
  runtimeOptions?: ChatRuntimeConfigOptions,
) {
  return mergeRuntimeConfig(
    {
      ...createRoomKindOverride(roomKind),
      ...(runtimeOverride ?? {}),
    },
    runtimeOptions,
  );
}

export function resolveNormalizedRoomKind(
  normalized: ChatNormalizedInput,
  state: Nullable<ChatState>,
  fallback: ChatRoomKind,
): ChatRoomKind {
  if (normalized.roomId && state?.rooms[normalized.roomId]) {
    return state.rooms[normalized.roomId].roomKind;
  }

  if (normalized.kind === 'SESSION_JOIN_REQUEST') {
    const join = normalized as ChatNormalizedEvent<ChatJoinRequest>;
    return join.payload.roomKind;
  }

  if (normalized.kind === 'BATTLE_SIGNAL'
    || normalized.kind === 'RUN_SIGNAL'
    || normalized.kind === 'MULTIPLAYER_SIGNAL'
    || normalized.kind === 'ECONOMY_SIGNAL'
    || normalized.kind === 'LIVEOPS_SIGNAL') {
    const signal = normalized as ChatNormalizedEvent<ChatSignalEnvelope>;
    return inferRoomKindFromSignal(signal.payload, signal.roomId, state, fallback);
  }

  return fallback;
}

export function inferRoomKindFromSignal(
  signal: ChatSignalEnvelope,
  roomId: Nullable<ChatRoomId>,
  state: Nullable<ChatState>,
  fallback: ChatRoomKind,
): ChatRoomKind {
  if (roomId && state?.rooms[roomId]) {
    return state.rooms[roomId].roomKind;
  }

  if (signal.economy && (signal.economy.activeDealCount > 0 || signal.economy.overpayRisk01 > clamp01(0.25))) {
    return 'DEAL_ROOM';
  }
  if (signal.multiplayer && signal.multiplayer.partySize > 0) {
    return 'SYNDICATE';
  }
  if (signal.liveops && signal.liveops.worldEventName) {
    return 'GLOBAL';
  }
  if (signal.run && signal.run.runPhase.toLowerCase().includes('lobby')) {
    return 'LOBBY';
  }
  return fallback;
}

export function deriveMoodFromSignal(signal: ChatSignalEnvelope): ChatRoomStageMood {
  if (signal.liveops?.haterRaidActive) {
    return 'HOSTILE';
  }
  if (signal.economy && signal.economy.overpayRisk01 > clamp01(0.70)) {
    return 'PREDATORY';
  }
  if (signal.battle && signal.battle.rescueWindowOpen) {
    return 'TENSE';
  }
  if (signal.run?.nearSovereignty) {
    return 'CEREMONIAL';
  }
  if (signal.run?.outcome === 'FAILED') {
    return 'MOURNFUL';
  }
  if (signal.run?.outcome === 'SURVIVED') {
    return 'ECSTATIC';
  }
  return 'CALM';
}

export function deriveSignalChannelRecommendation(signal: ChatSignalEnvelope): ChatVisibleChannel {
  if (signal.economy && (signal.economy.activeDealCount > 0 || signal.economy.bluffRisk01 > clamp01(0.35))) {
    return 'DEAL_ROOM';
  }
  if (signal.multiplayer && signal.multiplayer.partySize > 1) {
    return 'SYNDICATE';
  }
  if (signal.run && signal.run.runPhase.toLowerCase().includes('lobby')) {
    return 'LOBBY';
  }
  return 'GLOBAL';
}

export function deriveSignalHeatDelta(signal: ChatSignalEnvelope): number {
  const battle = signal.battle ? Number(signal.battle.hostileMomentum) / 100 : 0;
  const liveops = signal.liveops ? Number(signal.liveops.heatMultiplier01) : 0;
  const economy = signal.economy ? Number(signal.economy.liquidityStress01) : 0;
  return clamp01(battle * 0.45 + liveops * 0.35 + economy * 0.20);
}

export function deriveSignalRiskLabel(signal: ChatSignalEnvelope): string {
  const score = Number(deriveSignalHeatDelta(signal));
  if (score >= 0.85) {
    return 'CRITICAL';
  }
  if (score >= 0.60) {
    return 'HIGH';
  }
  if (score >= 0.35) {
    return 'MEDIUM';
  }
  return 'LOW';
}

export function roomKindToDefaultChannel(roomKind: ChatRoomKind): ChatVisibleChannel {
  switch (roomKind) {
    case 'GLOBAL':
      return 'GLOBAL';
    case 'SYNDICATE':
      return 'SYNDICATE';
    case 'DEAL_ROOM':
      return 'DEAL_ROOM';
    case 'LOBBY':
      return 'LOBBY';
    case 'PRIVATE':
      return 'SYNDICATE';
    case 'SYSTEM':
      return 'GLOBAL';
    default:
      return 'GLOBAL';
  }
}

// ============================================================================
// MARK: State resolution helpers
// ============================================================================

export function resolveRoomId(
  requestedRoomId: ChatRoomId,
  sessionId: Nullable<ChatSessionId>,
  state: Nullable<ChatState>,
  trustClientRoomIds: boolean,
): ChatRoomId {
  if (trustClientRoomIds && requestedRoomId) {
    return requestedRoomId;
  }
  if (sessionId && state?.roomSessions.bySession[sessionId]?.length) {
    return state.roomSessions.bySession[sessionId][0];
  }
  return requestedRoomId;
}

export function resolveJoinRoomKind(
  requested: ChatRoomKind,
  roomId: ChatRoomId,
  state: Nullable<ChatState>,
  fallback: ChatRoomKind,
): ChatRoomKind {
  if (state?.rooms[roomId]) {
    return state.rooms[roomId].roomKind;
  }
  return requested ?? fallback;
}

export function resolveSignalSessionId(roomId: ChatRoomId, state: Nullable<ChatState>): Nullable<ChatSessionId> {
  if (!state) {
    return null;
  }
  const sessions = state.roomSessions.byRoom[roomId] ?? [];
  const player = sessions.find((id) => state.sessions[id]?.identity.role === 'PLAYER');
  return player ?? sessions[0] ?? null;
}

export function resolveMostRecentRoomId(state: Nullable<ChatState>): Nullable<ChatRoomId> {
  if (!state) {
    return null;
  }
  let winner: Nullable<ChatRoomId> = null;
  let winnerAt = -1;
  for (const [roomId, timestamp] of (Object.entries(state.lastEventAtByRoom) as unknown as readonly [ChatRoomId, UnixMs][])) {
    if (Number(timestamp) > winnerAt) {
      winner = roomId;
      winnerAt = Number(timestamp);
    }
  }
  return winner;
}

// ============================================================================
// MARK: Dedupe keys
// ============================================================================

export function dedupeKeyForEvent(event: ChatNormalizedInput): string {
  const payloadSignature = dedupePayloadSignature(event.payload);
  return [
    event.kind,
    event.roomId ?? 'no-room',
    event.sessionId ?? 'no-session',
    payloadSignature,
  ].join('|');
}

export function pruneExpiredDedupeEntries(
  recent: Map<string, UnixMs>,
  now: UnixMs,
  windowMs: number,
): void {
  const floor = Number(now) - windowMs;
  for (const [key, value] of recent.entries()) {
    if (Number(value) < floor) {
      recent.delete(key);
    }
  }
}

export function dedupePayloadSignature(payload: unknown): string {
  if (typeof payload === 'string') {
    return payload;
  }
  if (typeof payload === 'number' || typeof payload === 'boolean') {
    return String(payload);
  }
  return stableStringify(payload);
}

// ============================================================================
// MARK: Normalization helpers for enums and primitives
// ============================================================================

export function normalizeRoomKind(value: Nullable<string>, fallback: ChatRoomKind): ChatRoomKind {
  const normalized = (value ?? '').trim().toUpperCase();
  return isRoomKind(normalized) ? normalized : fallback;
}

export function normalizeVisibleChannel(value: Nullable<string>, fallback: ChatVisibleChannel): ChatVisibleChannel {
  const normalized = (value ?? '').trim().toUpperCase();
  return isVisibleChannelId(normalized) ? normalized : fallback;
}

export function normalizeRequestedVisibleChannel(value: Nullable<string>): ChatVisibleChannel | undefined {
  if (!value) {
    return undefined;
  }
  return normalizeVisibleChannel(value, 'GLOBAL');
}

export function normalizePresenceMode(value: Nullable<string>): ChatPresenceMode {
  const normalized = (value ?? '').trim().toUpperCase();
  switch (normalized) {
    case 'ONLINE':
    case 'AWAY':
    case 'HIDDEN':
    case 'SPECTATING':
    case 'DISCONNECTED':
    case 'RECONNECTING':
      return normalized;
    default:
      return 'ONLINE';
  }
}

export function normalizeTypingMode(value: Nullable<string>): ChatTypingMode {
  const normalized = (value ?? '').trim().toUpperCase();
  switch (normalized) {
    case 'IDLE':
    case 'TYPING':
    case 'PAUSED':
      return normalized;
    default:
      return 'IDLE';
  }
}

export function normalizeSessionRole(value: Nullable<string>): ChatSessionRole {
  const normalized = (value ?? '').trim().toUpperCase();
  switch (normalized) {
    case 'PLAYER':
    case 'SPECTATOR':
    case 'SYSTEM':
    case 'MODERATOR':
    case 'NPC':
      return normalized;
    default:
      return 'PLAYER';
  }
}

export function normalizePressureTier(value: Nullable<string>): PressureTier {
  const normalized = (value ?? '').trim().toUpperCase();
  switch (normalized) {
    case 'NONE':
    case 'BUILDING':
    case 'ELEVATED':
    case 'HIGH':
    case 'CRITICAL':
      return normalized;
    default:
      return 'NONE';
  }
}

export function normalizeTickTier(value: Nullable<string>): TickTier {
  const normalized = (value ?? '').trim().toUpperCase();
  switch (normalized) {
    case 'SETUP':
    case 'WINDOW':
    case 'COMMIT':
    case 'RESOLUTION':
    case 'SEAL':
      return normalized;
    default:
      return 'SETUP';
  }
}

export function normalizeRunOutcome(value: Nullable<string>): RunOutcome {
  const normalized = (value ?? '').trim().toUpperCase();
  switch (normalized) {
    case 'UNRESOLVED':
    case 'SURVIVED':
    case 'FAILED':
      return normalized;
    default:
      return 'UNRESOLVED';
  }
}

export function normalizeAttackType(value: Nullable<string>): Nullable<AttackType> {
  const normalized = (value ?? '').trim().toUpperCase();
  if (!normalized) {
    return null;
  }
  return normalized as AttackType;
}

export function normalizeBotId(value: Nullable<string>): Nullable<BotId> {
  const normalized = (value ?? '').trim();
  return normalized.length > 0 ? (normalized as BotId) : null;
}

export function kindToSignalType(kind: Extract<ChatEventKind, 'BATTLE_SIGNAL' | 'RUN_SIGNAL' | 'MULTIPLAYER_SIGNAL' | 'ECONOMY_SIGNAL' | 'LIVEOPS_SIGNAL'>): ChatSignalType {
  switch (kind) {
    case 'BATTLE_SIGNAL':
      return 'BATTLE';
    case 'RUN_SIGNAL':
      return 'RUN';
    case 'MULTIPLAYER_SIGNAL':
      return 'MULTIPLAYER';
    case 'ECONOMY_SIGNAL':
      return 'ECONOMY';
    case 'LIVEOPS_SIGNAL':
      return 'LIVEOPS';
    default:
      return 'RUN';
  }
}

// ============================================================================
// MARK: String, id, and time helpers
// ============================================================================

export function asRoomId(value: Nullable<string>, kind: string): ChatRoomId {
  return sanitizeIdLike(value, kind, 'room') as ChatRoomId;
}

export function asSessionId(value: Nullable<string>, kind: string): ChatSessionId {
  return sanitizeIdLike(value, kind, 'session') as ChatSessionId;
}

export function asUserId(value: Nullable<string>, kind: string): ChatUserId {
  return sanitizeIdLike(value, kind, 'user') as ChatUserId;
}

export function asRequestId(value: Nullable<string>, sessionId: ChatSessionId, now: UnixMs): ChatRequestId {
  const normalized = sanitizeOptionalString(value);
  return (normalized ?? `req:${String(sessionId)}:${String(now)}`) as ChatRequestId;
}

export function sanitizeIdLike(value: Nullable<string>, kind: string, prefix: string): string {
  const raw = sanitizeOptionalString(value);
  if (raw) {
    return raw;
  }
  return `${prefix}:${kind}:missing`;
}

export function sanitizeOptionalString(value: Nullable<string>): Nullable<string> {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : null;
}

export function sanitizeDisplayName(value: Nullable<string>): string {
  return sanitizeOptionalString(value) ?? 'UNKNOWN ACTOR';
}

export function sanitizeRoomTitle(value: Nullable<string>): string {
  return sanitizeOptionalString(value) ?? 'Untitled Room';
}

export function sanitizeReason(value: Nullable<string>, fallback: string): string {
  return sanitizeOptionalString(value) ?? fallback;
}

export function sanitizeMessageText(value: Nullable<string>): string {
  const raw = typeof value === 'string' ? value.replace(/\r\n?/g, '\n') : '';
  const collapsed = raw
    .split('\n')
    .map((line) => line.replace(/[\t ]+/g, ' ').trimEnd())
    .join('\n')
    .trim();
  return collapsed;
}

export function countLogicalLines(value: string): number {
  if (!value) {
    return 0;
  }
  return value.split('\n').length;
}

export function coerceUnixMs(value: number | null | undefined, fallback: UnixMs): UnixMs {
  return asUnixMs(typeof value === 'number' && Number.isFinite(value) ? value : Number(fallback));
}

export function nullableUnixMs(record: Readonly<Record<string, JsonValue>>, key: string): Nullable<UnixMs> {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? asUnixMs(value) : null;
}

// ============================================================================
// MARK: Payload access helpers
// ============================================================================

export function asJsonRecord(value: unknown): Nullable<Readonly<Record<string, JsonValue>>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Readonly<Record<string, JsonValue>>;
}

export function stringValue(record: Readonly<Record<string, JsonValue>>, key: string): Nullable<string> {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

export function numberValue(record: Readonly<Record<string, JsonValue>>, key: string, fallback: number): number {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function booleanValue(record: Readonly<Record<string, JsonValue>>, key: string, fallback: boolean): boolean {
  const value = record[key];
  return typeof value === 'boolean' ? value : fallback;
}

export function extractVisibleChannelFromPayload(payload: unknown): Nullable<ChatVisibleChannel> {
  const record = asJsonRecord(payload);
  if (!record) {
    return null;
  }
  const raw = stringValue(record, 'channelId');
  if (!raw) {
    return null;
  }
  return normalizeVisibleChannel(raw, 'GLOBAL');
}

// ============================================================================
// MARK: Metadata classifiers
// ============================================================================

export function classifyLeaveReason(reason: string): string {
  const normalized = reason.toLowerCase();
  if (normalized.includes('disconnect')) {
    return 'disconnect';
  }
  if (normalized.includes('kick')) {
    return 'kick';
  }
  if (normalized.includes('ban')) {
    return 'ban';
  }
  if (normalized.includes('timeout')) {
    return 'timeout';
  }
  return 'voluntary';
}

// ============================================================================
// MARK: Stable stringify
// ============================================================================

export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(String(value));
}

// ============================================================================
// MARK: Logger and id factory defaults
// ============================================================================

export function createDefaultLogger(): ChatEventBridgeLoggerPort {
  return {
    debug: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

export function createDefaultIdFactory(): ChatEventBridgeIdFactoryPort {
  let counter = 0;
  return {
    next(seed: string): ChatEventId {
      counter += 1;
      return `${seed}:${counter}` as ChatEventId;
    },
  };
}
