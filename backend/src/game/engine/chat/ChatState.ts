/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT STATE
 * FILE: backend/src/game/engine/chat/ChatState.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical state factory, immutable state helpers, selectors, and lawful
 * mutation primitives for the backend chat authority lane.
 *
 * This file is not a transport helper and not a UI convenience layer.
 * It exists so backend chat can own truth in the same way the other backend
 * engine lanes already own truth. The reducer and engine are expected to call
 * into this module rather than hand-rolling ad hoc object mutation.
 *
 * What lives here
 * ---------------
 * - runtime config merge and authoritative boot state creation
 * - deterministic room/session/presence/typing builders
 * - transcript append, redact, delete, and reveal helpers
 * - proof, replay, telemetry, learning, relationship, heat, invasion,
 *   silence, request, and event index helpers
 * - selectors and query helpers for reducer / engine / replay / fanout layers
 * - clone helpers that preserve backend-only shapes without leaking transport
 *
 * Design law
 * ----------
 * - ChatState owns backend chat truth shape.
 * - ChatReducer composes operations using these lawful helpers.
 * - ChatEngine orchestrates policy, ports, and side effects.
 * - No socket ownership. No frontend concerns. No React. No DOM.
 * ============================================================================
 */

import {
  BACKEND_CHAT_ENGINE_VERSION,
  CHAT_CHANNEL_DESCRIPTORS,
  CHAT_MOUNT_POLICIES,
  CHAT_RUNTIME_DEFAULTS,
  asSequenceNumber,
  asUnixMs,
  clamp01,
  type ChatAudienceHeat,
  type ChatChannelId,
  type ChatInferenceSnapshot,
  type ChatInvasionId,
  type ChatInvasionState,
  type ChatLearningProfile,
  type ChatMessage,
  type ChatMessageId,
  type ChatPendingRequestState,
  type ChatPendingReveal,
  type ChatPersonaId,
  type ChatPresenceMode,
  type ChatPresenceSnapshot,
  type ChatPresenceState,
  type ChatProofChain,
  type ChatProofEdge,
  type ChatRelationshipId,
  type ChatRelationshipState,
  type ChatReplayArtifact,
  type ChatReplayId,
  type ChatReplayIndex,
  type ChatRequestId,
  type ChatRescueDecision,
  type ChatRoomId,
  type ChatRoomKind,
  type ChatRoomSessionIndex,
  type ChatRoomState,
  type ChatRuntimeConfig,
  type ChatSceneId,
  type ChatSessionId,
  type ChatSessionIdentity,
  type ChatSessionState,
  type ChatSilenceDecision,
  type ChatState,
  type ChatTelemetryEnvelope,
  type ChatTranscriptEntry,
  type ChatTranscriptLedger,
  type ChatTypingMode,
  type ChatTypingSnapshot,
  type ChatTypingState,
  type ChatVisibleChannel,
  type JsonValue,
  type Nullable,
  type Score01,
  type SequenceNumber,
  type UnixMs,
} from './types';

// ============================================================================
// MARK: Local mutability helper
// ============================================================================

type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

// ============================================================================
// MARK: Empty singletons and boot factories
// ============================================================================

export const EMPTY_ROOM_SESSION_INDEX: ChatRoomSessionIndex = Object.freeze({
  byRoom: {},
  bySession: {},
});

export const EMPTY_PRESENCE_STATE: ChatPresenceState = Object.freeze({
  byRoom: {},
  bySession: {},
});

export const EMPTY_TYPING_STATE: ChatTypingState = Object.freeze({
  byRoom: {},
  bySession: {},
});

export const EMPTY_TRANSCRIPT_LEDGER: ChatTranscriptLedger = Object.freeze({
  byRoom: {},
  byMessageId: {},
  lastSequenceByRoom: {},
});

export const EMPTY_PROOF_CHAIN: ChatProofChain = Object.freeze({
  byRoom: {},
  byEdgeId: {},
});

export const EMPTY_REPLAY_INDEX: ChatReplayIndex = Object.freeze({
  byRoom: {},
  byReplayId: {},
});

export interface CreateChatStateArgs {
  readonly runtime?: Partial<ChatRuntimeConfig>;
  readonly now: UnixMs;
}

export function createChatState(args: CreateChatStateArgs): ChatState {
  return {
    version: BACKEND_CHAT_ENGINE_VERSION,
    bootedAt: args.now,
    runtime: mergeChatRuntimeConfig(args.runtime),
    rooms: {},
    sessions: {},
    roomSessions: {
      byRoom: {},
      bySession: {},
    },
    presence: {
      byRoom: {},
      bySession: {},
    },
    typing: {
      byRoom: {},
      bySession: {},
    },
    transcript: {
      byRoom: {},
      byMessageId: {},
      lastSequenceByRoom: {},
    },
    proofChain: {
      byRoom: {},
      byEdgeId: {},
    },
    replay: {
      byRoom: {},
      byReplayId: {},
    },
    relationships: {},
    learningProfiles: {},
    inferenceSnapshots: {},
    audienceHeatByRoom: {},
    activeInvasions: {},
    silencesByRoom: {},
    pendingReveals: [],
    pendingRequests: {},
    telemetryQueue: [],
    lastEventByRoom: {},
    lastEventAtByRoom: {},
  };
}

export function mergeChatRuntimeConfig(runtime?: Partial<ChatRuntimeConfig>): ChatRuntimeConfig {
  if (!runtime) {
    return CHAT_RUNTIME_DEFAULTS;
  }

  return {
    ...CHAT_RUNTIME_DEFAULTS,
    ...runtime,
    allowVisibleChannels: runtime.allowVisibleChannels ?? CHAT_RUNTIME_DEFAULTS.allowVisibleChannels,
    allowShadowChannels: runtime.allowShadowChannels ?? CHAT_RUNTIME_DEFAULTS.allowShadowChannels,
    ratePolicy: {
      ...CHAT_RUNTIME_DEFAULTS.ratePolicy,
      ...(runtime.ratePolicy ?? {}),
    },
    moderationPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.moderationPolicy,
      ...(runtime.moderationPolicy ?? {}),
    },
    replayPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.replayPolicy,
      ...(runtime.replayPolicy ?? {}),
    },
    learningPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.learningPolicy,
      ...(runtime.learningPolicy ?? {}),
    },
    proofPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.proofPolicy,
      ...(runtime.proofPolicy ?? {}),
    },
    invasionPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.invasionPolicy,
      ...(runtime.invasionPolicy ?? {}),
    },
  };
}

export function cloneChatState(state: ChatState): ChatState {
  return {
    ...state,
    rooms: { ...state.rooms },
    sessions: { ...state.sessions },
    roomSessions: {
      byRoom: cloneReadonlyRecordOfArrays(state.roomSessions.byRoom),
      bySession: cloneReadonlyRecordOfArrays(state.roomSessions.bySession),
    },
    presence: {
      byRoom: cloneNestedPresence(state.presence.byRoom),
      bySession: cloneReadonlyRecordOfArrays(state.presence.bySession),
    },
    typing: {
      byRoom: cloneReadonlyRecordOfArrays(state.typing.byRoom),
      bySession: cloneReadonlyRecordOfArrays(state.typing.bySession),
    },
    transcript: {
      byRoom: cloneReadonlyRecordOfArrays(state.transcript.byRoom),
      byMessageId: { ...state.transcript.byMessageId },
      lastSequenceByRoom: { ...state.transcript.lastSequenceByRoom },
    },
    proofChain: {
      byRoom: cloneReadonlyRecordOfArrays(state.proofChain.byRoom),
      byEdgeId: { ...state.proofChain.byEdgeId },
    },
    replay: {
      byRoom: cloneReadonlyRecordOfArrays(state.replay.byRoom),
      byReplayId: { ...state.replay.byReplayId },
    },
    relationships: { ...state.relationships },
    learningProfiles: { ...state.learningProfiles },
    inferenceSnapshots: { ...state.inferenceSnapshots },
    audienceHeatByRoom: { ...state.audienceHeatByRoom },
    activeInvasions: { ...state.activeInvasions },
    silencesByRoom: { ...state.silencesByRoom },
    pendingReveals: [...state.pendingReveals],
    pendingRequests: { ...state.pendingRequests },
    telemetryQueue: [...state.telemetryQueue],
    lastEventByRoom: { ...state.lastEventByRoom },
    lastEventAtByRoom: { ...state.lastEventAtByRoom },
  };
}

// ============================================================================
// MARK: Room builders and room mutation helpers
// ============================================================================

export interface CreateChatRoomStateArgs {
  readonly roomId: ChatRoomId;
  readonly roomKind: ChatRoomKind;
  readonly title: string;
  readonly now: UnixMs;
  readonly mountTarget?: string;
  readonly requestedVisibleChannel?: ChatVisibleChannel;
}

export function createChatRoomState(args: CreateChatRoomStateArgs): ChatRoomState {
  const preset =
    args.mountTarget && args.mountTarget in CHAT_MOUNT_POLICIES
      ? CHAT_MOUNT_POLICIES[args.mountTarget as keyof typeof CHAT_MOUNT_POLICIES]
      : CHAT_MOUNT_POLICIES.BATTLE_HUD;

  const activeVisibleChannel =
    args.requestedVisibleChannel && preset.allowedVisibleChannels.includes(args.requestedVisibleChannel)
      ? args.requestedVisibleChannel
      : preset.defaultVisibleChannel;

  return {
    roomId: args.roomId,
    roomKind: args.roomKind,
    title: args.title,
    createdAt: args.now,
    lastActivityAt: args.now,
    activeVisibleChannel,
    allowedVisibleChannels: preset.allowedVisibleChannels,
    stageMood: preset.stageMood,
    collapsed: preset.defaultCollapsed,
    unreadByChannel: {
      GLOBAL: 0,
      SYNDICATE: 0,
      DEAL_ROOM: 0,
      LOBBY: 0,
    },
    activeSceneId: null,
    activeMomentId: null,
    activeLegendId: null,
  };
}

export function upsertRoom(state: ChatState, room: ChatRoomState): ChatState {
  if (state.rooms[room.roomId] === room) {
    return state;
  }

  return {
    ...state,
    rooms: {
      ...state.rooms,
      [room.roomId]: room,
    },
    roomSessions: {
      byRoom: {
        ...state.roomSessions.byRoom,
        [room.roomId]: state.roomSessions.byRoom[room.roomId] ?? [],
      },
      bySession: { ...state.roomSessions.bySession },
    },
    presence: {
      byRoom: {
        ...state.presence.byRoom,
        [room.roomId]: state.presence.byRoom[room.roomId] ?? {},
      },
      bySession: { ...state.presence.bySession },
    },
    typing: {
      byRoom: {
        ...state.typing.byRoom,
        [room.roomId]: state.typing.byRoom[room.roomId] ?? [],
      },
      bySession: { ...state.typing.bySession },
    },
    transcript: {
      byRoom: {
        ...state.transcript.byRoom,
        [room.roomId]: state.transcript.byRoom[room.roomId] ?? [],
      },
      byMessageId: { ...state.transcript.byMessageId },
      lastSequenceByRoom: {
        ...state.transcript.lastSequenceByRoom,
        [room.roomId]: state.transcript.lastSequenceByRoom[room.roomId] ?? asSequenceNumber(0),
      },
    },
    proofChain: {
      byRoom: {
        ...state.proofChain.byRoom,
        [room.roomId]: state.proofChain.byRoom[room.roomId] ?? [],
      },
      byEdgeId: { ...state.proofChain.byEdgeId },
    },
    replay: {
      byRoom: {
        ...state.replay.byRoom,
        [room.roomId]: state.replay.byRoom[room.roomId] ?? [],
      },
      byReplayId: { ...state.replay.byReplayId },
    },
  };
}

export function removeRoom(state: ChatState, roomId: ChatRoomId): ChatState {
  if (!state.rooms[roomId]) {
    return state;
  }

  const next = cloneChatState(state) as Mutable<ChatState>;
  delete (next.rooms as Mutable<typeof next.rooms>)[roomId];
  delete (next.roomSessions.byRoom as Mutable<typeof next.roomSessions.byRoom>)[roomId];
  delete (next.presence.byRoom as Mutable<typeof next.presence.byRoom>)[roomId];
  delete (next.typing.byRoom as Mutable<typeof next.typing.byRoom>)[roomId];
  delete (next.transcript.byRoom as Mutable<typeof next.transcript.byRoom>)[roomId];
  delete (next.transcript.lastSequenceByRoom as Mutable<typeof next.transcript.lastSequenceByRoom>)[roomId];
  delete (next.proofChain.byRoom as Mutable<typeof next.proofChain.byRoom>)[roomId];
  delete (next.replay.byRoom as Mutable<typeof next.replay.byRoom>)[roomId];
  delete (next.audienceHeatByRoom as Mutable<typeof next.audienceHeatByRoom>)[roomId];
  delete (next.silencesByRoom as Mutable<typeof next.silencesByRoom>)[roomId];
  delete (next.lastEventByRoom as Mutable<typeof next.lastEventByRoom>)[roomId];
  delete (next.lastEventAtByRoom as Mutable<typeof next.lastEventAtByRoom>)[roomId];

  const nextBySession = { ...(next.roomSessions.bySession as Record<ChatSessionId, readonly ChatRoomId[]>) };
  for (const [sessionId, roomIds] of Object.entries(next.roomSessions.bySession) as [ChatSessionId, readonly ChatRoomId[]][]) {
    nextBySession[sessionId] = roomIds.filter((value) => value !== roomId);
  }
  next.roomSessions = {
    ...next.roomSessions,
    bySession: nextBySession,
  };

  for (const [relationshipId, relationship] of Object.entries(next.relationships) as [ChatRelationshipId, ChatRelationshipState][]) {
    if (relationship.roomId === roomId) {
      delete (next.relationships as Mutable<typeof next.relationships>)[relationshipId];
    }
  }

  for (const [invasionId, invasion] of Object.entries(next.activeInvasions) as [ChatInvasionId, ChatInvasionState][]) {
    if (invasion.roomId === roomId) {
      delete (next.activeInvasions as Mutable<typeof next.activeInvasions>)[invasionId];
    }
  }

  next.pendingReveals = next.pendingReveals.filter((item) => item.roomId !== roomId);

  for (const [requestId, request] of Object.entries(next.pendingRequests) as [ChatRequestId, ChatPendingRequestState][]) {
    if (request.roomId === roomId) {
      delete (next.pendingRequests as Mutable<typeof next.pendingRequests>)[requestId];
    }
  }

  next.telemetryQueue = next.telemetryQueue.filter((item) => item.roomId !== roomId);

  return next;
}

export function touchRoomActivity(state: ChatState, roomId: ChatRoomId, now: UnixMs): ChatState {
  const room = state.rooms[roomId];
  if (!room) {
    return state;
  }

  return {
    ...state,
    rooms: {
      ...state.rooms,
      [roomId]: {
        ...room,
        lastActivityAt: now,
      },
    },
  };
}

export function setRoomStageMood(
  state: ChatState,
  roomId: ChatRoomId,
  stageMood: ChatRoomState['stageMood'],
): ChatState {
  const room = state.rooms[roomId];
  if (!room || room.stageMood === stageMood) {
    return state;
  }

  return {
    ...state,
    rooms: {
      ...state.rooms,
      [roomId]: {
        ...room,
        stageMood,
      },
    },
  };
}

export function setRoomCollapsed(state: ChatState, roomId: ChatRoomId, collapsed: boolean): ChatState {
  const room = state.rooms[roomId];
  if (!room || room.collapsed === collapsed) {
    return state;
  }

  return {
    ...state,
    rooms: {
      ...state.rooms,
      [roomId]: {
        ...room,
        collapsed,
      },
    },
  };
}

export function setActiveVisibleChannel(
  state: ChatState,
  roomId: ChatRoomId,
  channelId: ChatVisibleChannel,
): ChatState {
  const room = state.rooms[roomId];
  if (!room) {
    return state;
  }

  if (!room.allowedVisibleChannels.includes(channelId)) {
    return state;
  }

  return {
    ...state,
    rooms: {
      ...state.rooms,
      [roomId]: {
        ...room,
        activeVisibleChannel: channelId,
        unreadByChannel: {
          ...room.unreadByChannel,
          [channelId]: 0,
        },
      },
    },
  };
}

export function setRoomScene(
  state: ChatState,
  roomId: ChatRoomId,
  sceneId: Nullable<ChatSceneId>,
): ChatState {
  const room = state.rooms[roomId];
  if (!room || room.activeSceneId === sceneId) {
    return state;
  }

  return {
    ...state,
    rooms: {
      ...state.rooms,
      [roomId]: {
        ...room,
        activeSceneId: sceneId,
      },
    },
  };
}

export function resetUnreadByChannel(
  state: ChatState,
  roomId: ChatRoomId,
  channelId: ChatVisibleChannel,
): ChatState {
  const room = state.rooms[roomId];
  if (!room || room.unreadByChannel[channelId] === 0) {
    return state;
  }

  return {
    ...state,
    rooms: {
      ...state.rooms,
      [roomId]: {
        ...room,
        unreadByChannel: {
          ...room.unreadByChannel,
          [channelId]: 0,
        },
      },
    },
  };
}

// ============================================================================
// MARK: Session helpers and room membership indexes
// ============================================================================

export interface CreateChatSessionStateArgs {
  readonly identity: ChatSessionIdentity;
  readonly now: UnixMs;
  readonly transportMetadata?: Readonly<Record<string, JsonValue>>;
}

export function createChatSessionState(args: CreateChatSessionStateArgs): ChatSessionState {
  return {
    identity: args.identity,
    roomIds: [],
    connectionState: 'ATTACHED',
    joinedAt: args.now,
    lastSeenAt: args.now,
    mutedUntil: null,
    shadowMuted: false,
    invisible: false,
    transportMetadata: args.transportMetadata ?? {},
  };
}

export function upsertSession(state: ChatState, session: ChatSessionState): ChatState {
  return {
    ...state,
    sessions: {
      ...state.sessions,
      [session.identity.sessionId]: session,
    },
    roomSessions: {
      byRoom: { ...state.roomSessions.byRoom },
      bySession: {
        ...state.roomSessions.bySession,
        [session.identity.sessionId]: state.roomSessions.bySession[session.identity.sessionId] ?? session.roomIds,
      },
    },
  };
}

export function removeSession(state: ChatState, sessionId: ChatSessionId): ChatState {
  if (!state.sessions[sessionId]) {
    return state;
  }

  const next = cloneChatState(state) as Mutable<ChatState>;
  const roomIds = next.roomSessions.bySession[sessionId] ?? [];

  delete (next.sessions as Mutable<typeof next.sessions>)[sessionId];
  delete (next.roomSessions.bySession as Mutable<typeof next.roomSessions.bySession>)[sessionId];
  delete (next.presence.bySession as Mutable<typeof next.presence.bySession>)[sessionId];
  delete (next.typing.bySession as Mutable<typeof next.typing.bySession>)[sessionId];

  const nextByRoom = { ...(next.roomSessions.byRoom as Record<ChatRoomId, readonly ChatSessionId[]>) };
  const nextPresenceByRoom = { ...(next.presence.byRoom as Record<ChatRoomId, Readonly<Record<ChatSessionId, ChatPresenceSnapshot>>>) };
  const nextTypingByRoom = { ...(next.typing.byRoom as Record<ChatRoomId, readonly ChatTypingSnapshot[]>) };

  for (const roomId of roomIds) {
    nextByRoom[roomId] = (nextByRoom[roomId] ?? []).filter((value) => value !== sessionId);

    const roomPresence = { ...(nextPresenceByRoom[roomId] ?? {}) };
    delete roomPresence[sessionId];
    nextPresenceByRoom[roomId] = roomPresence;

    nextTypingByRoom[roomId] = (nextTypingByRoom[roomId] ?? []).filter((item) => item.sessionId !== sessionId);
  }

  next.roomSessions = {
    ...next.roomSessions,
    byRoom: nextByRoom,
  };
  next.presence = {
    ...next.presence,
    byRoom: nextPresenceByRoom,
  };
  next.typing = {
    ...next.typing,
    byRoom: nextTypingByRoom,
  };

  for (const [requestId, request] of Object.entries(next.pendingRequests) as [ChatRequestId, ChatPendingRequestState][]) {
    if (request.sessionId === sessionId) {
      delete (next.pendingRequests as Mutable<typeof next.pendingRequests>)[requestId];
    }
  }

  next.telemetryQueue = next.telemetryQueue.filter((item) => item.sessionId !== sessionId);

  return next;
}

export function setSessionConnectionState(
  state: ChatState,
  sessionId: ChatSessionId,
  connectionState: ChatSessionState['connectionState'],
  now: UnixMs,
): ChatState {
  const session = state.sessions[sessionId];
  if (!session) {
    return state;
  }

  return {
    ...state,
    sessions: {
      ...state.sessions,
      [sessionId]: {
        ...session,
        connectionState,
        lastSeenAt: now,
      },
    },
  };
}

export function setSessionMutedUntil(
  state: ChatState,
  sessionId: ChatSessionId,
  mutedUntil: Nullable<UnixMs>,
): ChatState {
  const session = state.sessions[sessionId];
  if (!session) {
    return state;
  }

  return {
    ...state,
    sessions: {
      ...state.sessions,
      [sessionId]: {
        ...session,
        mutedUntil,
      },
    },
  };
}

export function setSessionShadowMuted(state: ChatState, sessionId: ChatSessionId, shadowMuted: boolean): ChatState {
  const session = state.sessions[sessionId];
  if (!session || session.shadowMuted === shadowMuted) {
    return state;
  }

  return {
    ...state,
    sessions: {
      ...state.sessions,
      [sessionId]: {
        ...session,
        shadowMuted,
      },
    },
  };
}

export function setSessionInvisible(state: ChatState, sessionId: ChatSessionId, invisible: boolean): ChatState {
  const session = state.sessions[sessionId];
  if (!session || session.invisible === invisible) {
    return state;
  }

  return {
    ...state,
    sessions: {
      ...state.sessions,
      [sessionId]: {
        ...session,
        invisible,
      },
    },
  };
}

export function attachSessionToRoom(
  state: ChatState,
  roomId: ChatRoomId,
  sessionId: ChatSessionId,
): ChatState {
  const room = state.rooms[roomId];
  const session = state.sessions[sessionId];
  if (!room || !session) {
    return state;
  }

  const roomSessions = uniqueBy(
    [...(state.roomSessions.byRoom[roomId] ?? []), sessionId],
    (value) => value,
  );

  const sessionRooms = uniqueBy(
    [...(state.roomSessions.bySession[sessionId] ?? []), roomId],
    (value) => value,
  );

  return {
    ...state,
    sessions: {
      ...state.sessions,
      [sessionId]: {
        ...session,
        roomIds: sessionRooms,
      },
    },
    roomSessions: {
      byRoom: {
        ...state.roomSessions.byRoom,
        [roomId]: roomSessions,
      },
      bySession: {
        ...state.roomSessions.bySession,
        [sessionId]: sessionRooms,
      },
    },
  };
}

export function detachSessionFromRoom(
  state: ChatState,
  roomId: ChatRoomId,
  sessionId: ChatSessionId,
): ChatState {
  const room = state.rooms[roomId];
  const session = state.sessions[sessionId];
  if (!room || !session) {
    return state;
  }

  const roomSessions = (state.roomSessions.byRoom[roomId] ?? []).filter((value) => value !== sessionId);
  const sessionRooms = (state.roomSessions.bySession[sessionId] ?? []).filter((value) => value !== roomId);

  return {
    ...state,
    sessions: {
      ...state.sessions,
      [sessionId]: {
        ...session,
        roomIds: sessionRooms,
      },
    },
    roomSessions: {
      byRoom: {
        ...state.roomSessions.byRoom,
        [roomId]: roomSessions,
      },
      bySession: {
        ...state.roomSessions.bySession,
        [sessionId]: sessionRooms,
      },
    },
  };
}

// ============================================================================
// MARK: Presence helpers
// ============================================================================

export interface CreateChatPresenceSnapshotArgs {
  readonly roomId: ChatRoomId;
  readonly sessionId: ChatSessionId;
  readonly mode: ChatPresenceMode;
  readonly visibleToRoom: boolean;
  readonly spectating: boolean;
  readonly actorLabel: string;
  readonly now: UnixMs;
}

export function createChatPresenceSnapshot(args: CreateChatPresenceSnapshotArgs): ChatPresenceSnapshot {
  return {
    roomId: args.roomId,
    sessionId: args.sessionId,
    mode: args.mode,
    visibleToRoom: args.visibleToRoom,
    updatedAt: args.now,
    spectating: args.spectating,
    actorLabel: args.actorLabel,
  };
}

export function upsertPresenceSnapshot(state: ChatState, snapshot: ChatPresenceSnapshot): ChatState {
  const roomPresence = {
    ...(state.presence.byRoom[snapshot.roomId] ?? {}),
    [snapshot.sessionId]: snapshot,
  };

  const sessionPresence = uniqueBy(
    [
      ...(state.presence.bySession[snapshot.sessionId] ?? []).filter((value) => value.roomId !== snapshot.roomId),
      snapshot,
    ],
    (value) => `${value.roomId}:${value.sessionId}`,
  );

  return {
    ...state,
    presence: {
      byRoom: {
        ...state.presence.byRoom,
        [snapshot.roomId]: roomPresence,
      },
      bySession: {
        ...state.presence.bySession,
        [snapshot.sessionId]: sessionPresence,
      },
    },
  };
}

export function removePresenceSnapshot(
  state: ChatState,
  roomId: ChatRoomId,
  sessionId: ChatSessionId,
): ChatState {
  const roomPresence = { ...(state.presence.byRoom[roomId] ?? {}) };
  delete roomPresence[sessionId];

  return {
    ...state,
    presence: {
      byRoom: {
        ...state.presence.byRoom,
        [roomId]: roomPresence,
      },
      bySession: {
        ...state.presence.bySession,
        [sessionId]: (state.presence.bySession[sessionId] ?? []).filter((item) => item.roomId !== roomId),
      },
    },
  };
}

export function removeAllPresenceForSession(state: ChatState, sessionId: ChatSessionId): ChatState {
  const snapshots = state.presence.bySession[sessionId] ?? [];
  let next = state;
  for (const snapshot of snapshots) {
    next = removePresenceSnapshot(next, snapshot.roomId, sessionId);
  }
  return next;
}

// ============================================================================
// MARK: Typing helpers
// ============================================================================

export interface CreateChatTypingSnapshotArgs {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatVisibleChannel;
  readonly sessionId: ChatSessionId;
  readonly mode: ChatTypingMode;
  readonly now: UnixMs;
  readonly windowMs: number;
}

export function createChatTypingSnapshot(args: CreateChatTypingSnapshotArgs): ChatTypingSnapshot {
  return {
    roomId: args.roomId,
    channelId: args.channelId,
    sessionId: args.sessionId,
    token: `${String(args.sessionId)}:${args.channelId}` as ChatTypingSnapshot['token'],
    mode: args.mode,
    startedAt: args.now,
    expiresAt: asUnixMs(Number(args.now) + args.windowMs),
  };
}

export function upsertTypingSnapshot(state: ChatState, snapshot: ChatTypingSnapshot): ChatState {
  const roomTyping = uniqueBy(
    [
      ...(state.typing.byRoom[snapshot.roomId] ?? []).filter(
        (item) => !(item.sessionId === snapshot.sessionId && item.channelId === snapshot.channelId),
      ),
      snapshot,
    ],
    (value) => `${value.roomId}:${value.sessionId}:${value.channelId}`,
  );

  const sessionTyping = uniqueBy(
    [
      ...(state.typing.bySession[snapshot.sessionId] ?? []).filter(
        (item) => !(item.roomId === snapshot.roomId && item.channelId === snapshot.channelId),
      ),
      snapshot,
    ],
    (value) => `${value.roomId}:${value.sessionId}:${value.channelId}`,
  );

  return {
    ...state,
    typing: {
      byRoom: {
        ...state.typing.byRoom,
        [snapshot.roomId]: roomTyping,
      },
      bySession: {
        ...state.typing.bySession,
        [snapshot.sessionId]: sessionTyping,
      },
    },
  };
}

export function clearTypingSnapshot(
  state: ChatState,
  roomId: ChatRoomId,
  sessionId: ChatSessionId,
  channelId?: ChatVisibleChannel,
): ChatState {
  const byRoom = (state.typing.byRoom[roomId] ?? []).filter((item) => {
    if (item.sessionId !== sessionId) {
      return true;
    }
    return channelId ? item.channelId !== channelId : false;
  });

  const bySession = (state.typing.bySession[sessionId] ?? []).filter((item) => {
    if (item.roomId !== roomId) {
      return true;
    }
    return channelId ? item.channelId !== channelId : false;
  });

  return {
    ...state,
    typing: {
      byRoom: {
        ...state.typing.byRoom,
        [roomId]: byRoom,
      },
      bySession: {
        ...state.typing.bySession,
        [sessionId]: bySession,
      },
    },
  };
}

export function removeAllTypingForSession(state: ChatState, sessionId: ChatSessionId): ChatState {
  const entries = state.typing.bySession[sessionId] ?? [];
  let next = state;
  for (const entry of entries) {
    next = clearTypingSnapshot(next, entry.roomId, sessionId, entry.channelId);
  }
  return next;
}

export function pruneExpiredTyping(state: ChatState, now: UnixMs): ChatState {
  const byRoom: Record<ChatRoomId, readonly ChatTypingSnapshot[]> = {};
  const bySession: Record<ChatSessionId, readonly ChatTypingSnapshot[]> = {};

  for (const [roomId, values] of Object.entries(state.typing.byRoom) as [ChatRoomId, readonly ChatTypingSnapshot[]][]) {
    byRoom[roomId] = values.filter((item) => Number(item.expiresAt) > Number(now));
  }

  for (const [sessionId, values] of Object.entries(state.typing.bySession) as [ChatSessionId, readonly ChatTypingSnapshot[]][]) {
    bySession[sessionId] = values.filter((item) => Number(item.expiresAt) > Number(now));
  }

  return {
    ...state,
    typing: {
      byRoom,
      bySession,
    },
  };
}

// ============================================================================
// MARK: Transcript helpers
// ============================================================================

export function nextSequenceForRoom(state: ChatState, roomId: ChatRoomId): SequenceNumber {
  return asSequenceNumber(Number(state.transcript.lastSequenceByRoom[roomId] ?? asSequenceNumber(0)) + 1);
}

export function createTranscriptEntry(message: ChatMessage): ChatTranscriptEntry {
  return {
    message,
    appendedAt: message.createdAt,
    visibility: CHAT_CHANNEL_DESCRIPTORS[message.channelId].visibleToPlayer ? 'VISIBLE' : 'SHADOW',
  };
}

export function appendTranscriptMessage(state: ChatState, message: ChatMessage): ChatState {
  const existingRoom = state.rooms[message.roomId];
  if (!existingRoom) {
    return state;
  }

  const entry = createTranscriptEntry(message);
  const currentRoomEntries = state.transcript.byRoom[message.roomId] ?? [];
  const maxMessages = state.runtime.replayPolicy.maxMessagesPerRoom;
  const nextRoomEntries = [...currentRoomEntries, entry].slice(-maxMessages);

  return {
    ...state,
    transcript: {
      byRoom: {
        ...state.transcript.byRoom,
        [message.roomId]: nextRoomEntries,
      },
      byMessageId: {
        ...state.transcript.byMessageId,
        [message.id]: entry,
      },
      lastSequenceByRoom: {
        ...state.transcript.lastSequenceByRoom,
        [message.roomId]: message.sequenceNumber,
      },
    },
    rooms: {
      ...state.rooms,
      [message.roomId]: {
        ...existingRoom,
        lastActivityAt: message.createdAt,
        unreadByChannel: incrementUnread(existingRoom.unreadByChannel, message.channelId),
      },
    },
  };
}

export function replaceTranscriptMessage(state: ChatState, message: ChatMessage): ChatState {
  const entry = state.transcript.byMessageId[message.id];
  if (!entry) {
    return appendTranscriptMessage(state, message);
  }

  const nextEntry: ChatTranscriptEntry = {
    ...entry,
    message,
  };

  const roomEntries = (state.transcript.byRoom[message.roomId] ?? []).map((value) =>
    value.message.id === message.id ? nextEntry : value,
  );

  return {
    ...state,
    transcript: {
      byRoom: {
        ...state.transcript.byRoom,
        [message.roomId]: roomEntries,
      },
      byMessageId: {
        ...state.transcript.byMessageId,
        [message.id]: nextEntry,
      },
      lastSequenceByRoom: { ...state.transcript.lastSequenceByRoom },
    },
  };
}

export function redactTranscriptMessage(state: ChatState, messageId: ChatMessageId, now: UnixMs): ChatState {
  const entry = state.transcript.byMessageId[messageId];
  if (!entry) {
    return state;
  }

  const message: ChatMessage = {
    ...entry.message,
    redactedAt: now,
    plainText: '[REDACTED]',
    bodyParts: [{ type: 'TEXT', text: '[REDACTED]' }],
  };

  const nextEntry: ChatTranscriptEntry = {
    ...entry,
    visibility: 'REDACTED',
    message,
  };

  return replaceTranscriptEntry(state, nextEntry);
}

export function softDeleteTranscriptMessage(state: ChatState, messageId: ChatMessageId, now: UnixMs): ChatState {
  const entry = state.transcript.byMessageId[messageId];
  if (!entry) {
    return state;
  }

  const nextEntry: ChatTranscriptEntry = {
    ...entry,
    visibility: 'DELETED',
    message: {
      ...entry.message,
      deletedAt: now,
    },
  };

  return replaceTranscriptEntry(state, nextEntry);
}

export function removeTranscriptMessageHard(state: ChatState, messageId: ChatMessageId): ChatState {
  const entry = state.transcript.byMessageId[messageId];
  if (!entry) {
    return state;
  }

  const next = cloneChatState(state) as Mutable<ChatState>;
  const nextByRoom = { ...(next.transcript.byRoom as Record<ChatRoomId, readonly ChatTranscriptEntry[]>) };
  nextByRoom[entry.message.roomId] = (nextByRoom[entry.message.roomId] ?? []).filter(
    (value) => value.message.id !== messageId,
  );
  delete (next.transcript.byMessageId as Mutable<typeof next.transcript.byMessageId>)[messageId];

  const nextLastSequence = { ...(next.transcript.lastSequenceByRoom as Record<ChatRoomId, SequenceNumber>) };
  const last = nextByRoom[entry.message.roomId]?.at(-1)?.message.sequenceNumber ?? asSequenceNumber(0);
  nextLastSequence[entry.message.roomId] = last;

  next.transcript = {
    ...next.transcript,
    byRoom: nextByRoom,
    lastSequenceByRoom: nextLastSequence,
  };
  return next;
}

function replaceTranscriptEntry(state: ChatState, entry: ChatTranscriptEntry): ChatState {
  const roomEntries = (state.transcript.byRoom[entry.message.roomId] ?? []).map((value) =>
    value.message.id === entry.message.id ? entry : value,
  );

  return {
    ...state,
    transcript: {
      byRoom: {
        ...state.transcript.byRoom,
        [entry.message.roomId]: roomEntries,
      },
      byMessageId: {
        ...state.transcript.byMessageId,
        [entry.message.id]: entry,
      },
      lastSequenceByRoom: { ...state.transcript.lastSequenceByRoom },
    },
  };
}

// ============================================================================
// MARK: Proof and replay helpers
// ============================================================================

export function appendProofEdge(state: ChatState, edge: ChatProofEdge): ChatState {
  return {
    ...state,
    proofChain: {
      byRoom: {
        ...state.proofChain.byRoom,
        [edge.roomId]: [...(state.proofChain.byRoom[edge.roomId] ?? []), edge],
      },
      byEdgeId: {
        ...state.proofChain.byEdgeId,
        [edge.id]: edge,
      },
    },
  };
}

export function appendReplayArtifact(state: ChatState, artifact: ChatReplayArtifact): ChatState {
  return {
    ...state,
    replay: {
      byRoom: {
        ...state.replay.byRoom,
        [artifact.roomId]: [...(state.replay.byRoom[artifact.roomId] ?? []), artifact],
      },
      byReplayId: {
        ...state.replay.byReplayId,
        [artifact.id]: artifact,
      },
    },
  };
}

export function removeReplayArtifact(state: ChatState, replayId: ChatReplayId): ChatState {
  const artifact = state.replay.byReplayId[replayId];
  if (!artifact) {
    return state;
  }

  const next = cloneChatState(state) as Mutable<ChatState>;
  const nextByRoom = { ...(next.replay.byRoom as Record<ChatRoomId, readonly ChatReplayArtifact[]>) };
  nextByRoom[artifact.roomId] = (nextByRoom[artifact.roomId] ?? []).filter((value) => value.id !== replayId);
  delete (next.replay.byReplayId as Mutable<typeof next.replay.byReplayId>)[replayId];
  next.replay = {
    ...next.replay,
    byRoom: nextByRoom,
  };
  return next;
}

// ============================================================================
// MARK: Learning, inference, relationship, and affect helpers
// ============================================================================

export function upsertLearningProfile(state: ChatState, profile: ChatLearningProfile): ChatState {
  return {
    ...state,
    learningProfiles: {
      ...state.learningProfiles,
      [profile.userId]: profile,
    },
  };
}

export function updateLearningProfile(
  state: ChatState,
  userId: ChatLearningProfile['userId'],
  updater: (profile: ChatLearningProfile | null) => ChatLearningProfile,
): ChatState {
  return upsertLearningProfile(state, updater(state.learningProfiles[userId] ?? null));
}

export function upsertInferenceSnapshot(state: ChatState, snapshot: ChatInferenceSnapshot): ChatState {
  return {
    ...state,
    inferenceSnapshots: {
      ...state.inferenceSnapshots,
      [snapshot.inferenceId]: snapshot,
    },
  };
}

export function upsertRelationship(state: ChatState, relationship: ChatRelationshipState): ChatState {
  return {
    ...state,
    relationships: {
      ...state.relationships,
      [relationship.id]: relationship,
    },
  };
}

export function removeRelationshipsForRoom(state: ChatState, roomId: ChatRoomId): ChatState {
  const next = cloneChatState(state) as Mutable<ChatState>;
  for (const [id, relationship] of Object.entries(next.relationships) as [ChatRelationshipId, ChatRelationshipState][]) {
    if (relationship.roomId === roomId) {
      delete (next.relationships as Mutable<typeof next.relationships>)[id];
    }
  }
  return next;
}

// ============================================================================
// MARK: Audience heat, rescue, silence, and invasion helpers
// ============================================================================

export function setAudienceHeat(state: ChatState, heat: ChatAudienceHeat): ChatState {
  return {
    ...state,
    audienceHeatByRoom: {
      ...state.audienceHeatByRoom,
      [heat.roomId]: heat,
    },
  };
}

export function applyAudienceHeatDelta(
  state: ChatState,
  roomId: ChatRoomId,
  channelId: ChatVisibleChannel,
  delta: number,
  now: UnixMs,
): ChatState {
  const current =
    state.audienceHeatByRoom[roomId] ??
    ({
      roomId,
      channelId,
      heat01: clamp01(0.25),
      swarmDirection: 'NEUTRAL',
      updatedAt: now,
    } satisfies ChatAudienceHeat);

  const next: ChatAudienceHeat = {
    roomId,
    channelId,
    heat01: clamp01(Number(current.heat01) + delta),
    swarmDirection:
      delta > 0.02 ? 'NEGATIVE' : delta < -0.02 ? 'POSITIVE' : current.swarmDirection,
    updatedAt: now,
  };

  return setAudienceHeat(state, next);
}

export function setSilenceDecision(
  state: ChatState,
  roomId: ChatRoomId,
  silence: ChatSilenceDecision,
): ChatState {
  return {
    ...state,
    silencesByRoom: {
      ...state.silencesByRoom,
      [roomId]: silence,
    },
  };
}

export function clearSilenceDecision(state: ChatState, roomId: ChatRoomId): ChatState {
  if (!state.silencesByRoom[roomId]) {
    return state;
  }

  const next = cloneChatState(state) as Mutable<ChatState>;
  delete (next.silencesByRoom as Mutable<typeof next.silencesByRoom>)[roomId];
  return next;
}

export function pruneExpiredSilences(state: ChatState, now: UnixMs): ChatState {
  const next: Record<ChatRoomId, ChatSilenceDecision> = {};
  for (const [roomId, silence] of Object.entries(state.silencesByRoom) as [ChatRoomId, ChatSilenceDecision][]) {
    if (Number(silence.endsAt) > Number(now)) {
      next[roomId] = silence;
    }
  }

  return {
    ...state,
    silencesByRoom: next,
  };
}

export function openInvasion(state: ChatState, invasion: ChatInvasionState): ChatState {
  return {
    ...state,
    activeInvasions: {
      ...state.activeInvasions,
      [invasion.invasionId]: invasion,
    },
  };
}

export function closeInvasion(state: ChatState, invasionId: ChatInvasionId): ChatState {
  if (!state.activeInvasions[invasionId]) {
    return state;
  }

  const next = cloneChatState(state) as Mutable<ChatState>;
  delete (next.activeInvasions as Mutable<typeof next.activeInvasions>)[invasionId];
  return next;
}

export function pruneExpiredInvasions(state: ChatState, now: UnixMs): ChatState {
  const next: Record<ChatInvasionId, ChatInvasionState> = {};
  for (const [id, invasion] of Object.entries(state.activeInvasions) as [ChatInvasionId, ChatInvasionState][]) {
    if (Number(invasion.closesAt) > Number(now)) {
      next[id] = invasion;
    }
  }

  return {
    ...state,
    activeInvasions: next,
  };
}

export function isRoomSilenced(state: ChatState, roomId: ChatRoomId, now: UnixMs): boolean {
  const silence = state.silencesByRoom[roomId];
  if (!silence) {
    return false;
  }
  return silence.active && Number(silence.endsAt) > Number(now);
}

export function getActiveRoomInvasions(state: ChatState, roomId: ChatRoomId): readonly ChatInvasionState[] {
  return Object.values(state.activeInvasions).filter((value) => value.roomId === roomId);
}

export function hasActiveInvasion(state: ChatState, roomId: ChatRoomId): boolean {
  return getActiveRoomInvasions(state, roomId).length > 0;
}

// ============================================================================
// MARK: Pending requests, pending reveals, and telemetry queue
// ============================================================================

export function upsertPendingRequest(state: ChatState, pending: ChatPendingRequestState): ChatState {
  return {
    ...state,
    pendingRequests: {
      ...state.pendingRequests,
      [pending.requestId]: pending,
    },
  };
}

export function removePendingRequest(state: ChatState, requestId: ChatRequestId): ChatState {
  if (!state.pendingRequests[requestId]) {
    return state;
  }

  const next = cloneChatState(state) as Mutable<ChatState>;
  delete (next.pendingRequests as Mutable<typeof next.pendingRequests>)[requestId];
  return next;
}

export function queuePendingReveal(state: ChatState, reveal: ChatPendingReveal): ChatState {
  return {
    ...state,
    pendingReveals: [...state.pendingReveals, reveal].sort((a, b) => Number(a.revealAt) - Number(b.revealAt)),
  };
}

export function flushDuePendingReveals(state: ChatState, now: UnixMs): {
  readonly state: ChatState;
  readonly revealedMessages: readonly ChatMessage[];
} {
  if (state.pendingReveals.length === 0) {
    return {
      state,
      revealedMessages: [],
    };
  }

  const due = state.pendingReveals.filter((value) => Number(value.revealAt) <= Number(now));
  const future = state.pendingReveals.filter((value) => Number(value.revealAt) > Number(now));

  let next: ChatState = {
    ...state,
    pendingReveals: future,
  };

  for (const item of due) {
    next = appendTranscriptMessage(next, item.message);
  }

  return {
    state: next,
    revealedMessages: due.map((item) => item.message),
  };
}

export function queueTelemetry(state: ChatState, telemetry: ChatTelemetryEnvelope): ChatState {
  return {
    ...state,
    telemetryQueue: [...state.telemetryQueue, telemetry],
  };
}

export function flushTelemetryQueue(state: ChatState): {
  readonly state: ChatState;
  readonly flushed: readonly ChatTelemetryEnvelope[];
} {
  return {
    state: {
      ...state,
      telemetryQueue: [],
    },
    flushed: state.telemetryQueue,
  };
}

// ============================================================================
// MARK: Event markers and room activity indexes
// ============================================================================

export function markLastRoomEvent(
  state: ChatState,
  roomId: ChatRoomId,
  eventId: ChatState['lastEventByRoom'][ChatRoomId],
  now: UnixMs,
): ChatState {
  return {
    ...state,
    lastEventByRoom: {
      ...state.lastEventByRoom,
      [roomId]: eventId,
    },
    lastEventAtByRoom: {
      ...state.lastEventAtByRoom,
      [roomId]: now,
    },
  };
}

// ============================================================================
// MARK: Selectors and query helpers
// ============================================================================

export function hasRoom(state: ChatState, roomId: ChatRoomId): boolean {
  return Boolean(state.rooms[roomId]);
}

export function hasSession(state: ChatState, sessionId: ChatSessionId): boolean {
  return Boolean(state.sessions[sessionId]);
}

export function isSessionInRoom(state: ChatState, roomId: ChatRoomId, sessionId: ChatSessionId): boolean {
  return (state.roomSessions.byRoom[roomId] ?? []).includes(sessionId);
}

export function selectRoom(state: ChatState, roomId: ChatRoomId): Nullable<ChatRoomState> {
  return state.rooms[roomId] ?? null;
}

export function selectSession(state: ChatState, sessionId: ChatSessionId): Nullable<ChatSessionState> {
  return state.sessions[sessionId] ?? null;
}

export function selectRoomSessions(state: ChatState, roomId: ChatRoomId): readonly ChatSessionState[] {
  return (state.roomSessions.byRoom[roomId] ?? [])
    .map((sessionId) => state.sessions[sessionId])
    .filter((value): value is ChatSessionState => Boolean(value));
}

export function selectRoomTranscript(state: ChatState, roomId: ChatRoomId): readonly ChatTranscriptEntry[] {
  return state.transcript.byRoom[roomId] ?? [];
}

export function selectVisibleMessages(state: ChatState, roomId: ChatRoomId): readonly ChatMessage[] {
  return selectRoomTranscript(state, roomId)
    .filter((entry) => entry.visibility === 'VISIBLE')
    .map((entry) => entry.message);
}

export function selectShadowMessages(state: ChatState, roomId: ChatRoomId): readonly ChatMessage[] {
  return selectRoomTranscript(state, roomId)
    .filter((entry) => entry.visibility === 'SHADOW')
    .map((entry) => entry.message);
}

export function selectLatestMessage(state: ChatState, roomId: ChatRoomId): Nullable<ChatMessage> {
  return selectRoomTranscript(state, roomId).at(-1)?.message ?? null;
}

export function selectRoomPresence(state: ChatState, roomId: ChatRoomId): readonly ChatPresenceSnapshot[] {
  return Object.values(state.presence.byRoom[roomId] ?? {});
}

export function selectRoomTyping(state: ChatState, roomId: ChatRoomId): readonly ChatTypingSnapshot[] {
  return state.typing.byRoom[roomId] ?? [];
}

export function selectAudienceHeat(state: ChatState, roomId: ChatRoomId): Nullable<ChatAudienceHeat> {
  return state.audienceHeatByRoom[roomId] ?? null;
}

export function selectLearningProfile(
  state: ChatState,
  userId: ChatLearningProfile['userId'],
): Nullable<ChatLearningProfile> {
  return state.learningProfiles[userId] ?? null;
}

export function selectInferenceSnapshotsForUser(
  state: ChatState,
  userId: ChatLearningProfile['userId'],
): readonly ChatInferenceSnapshot[] {
  return Object.values(state.inferenceSnapshots)
    .filter((value) => value.userId === userId)
    .sort((a, b) => Number(a.generatedAt) - Number(b.generatedAt));
}

export function selectRoomOccupancy(state: ChatState, roomId: ChatRoomId): number {
  return selectRoomPresence(state, roomId).filter((snapshot) => snapshot.visibleToRoom).length;
}

export function selectVisibleOccupants(state: ChatState, roomId: ChatRoomId): readonly ChatPresenceSnapshot[] {
  return selectRoomPresence(state, roomId).filter((snapshot) => snapshot.visibleToRoom);
}

export function selectCurrentSequence(state: ChatState, roomId: ChatRoomId): SequenceNumber {
  return state.transcript.lastSequenceByRoom[roomId] ?? asSequenceNumber(0);
}

export function selectRoomProofEdges(state: ChatState, roomId: ChatRoomId): readonly ChatProofEdge[] {
  return state.proofChain.byRoom[roomId] ?? [];
}

export function selectRoomReplayArtifacts(state: ChatState, roomId: ChatRoomId): readonly ChatReplayArtifact[] {
  return state.replay.byRoom[roomId] ?? [];
}

export function selectPendingRequestsForRoom(state: ChatState, roomId: ChatRoomId): readonly ChatPendingRequestState[] {
  return Object.values(state.pendingRequests).filter((value) => value.roomId === roomId);
}

export function selectPendingRequestsForSession(
  state: ChatState,
  sessionId: ChatSessionId,
): readonly ChatPendingRequestState[] {
  return Object.values(state.pendingRequests).filter((value) => value.sessionId === sessionId);
}

export function selectRoomRelationships(
  state: ChatState,
  roomId: ChatRoomId,
): readonly ChatRelationshipState[] {
  return Object.values(state.relationships).filter((value) => value.roomId === roomId);
}

export function selectRelationshipForActor(
  state: ChatState,
  roomId: ChatRoomId,
  actorId: string,
  userId: ChatLearningProfile['userId'],
): Nullable<ChatRelationshipState> {
  return (
    Object.values(state.relationships).find(
      (value) => value.roomId === roomId && value.actorId === actorId && value.userId === userId,
    ) ?? null
  );
}

export function selectMostRecentReplayAroundSequence(
  state: ChatState,
  roomId: ChatRoomId,
  sequenceNumber: SequenceNumber,
): Nullable<ChatReplayArtifact> {
  const target = Number(sequenceNumber);
  const artifacts = state.replay.byRoom[roomId] ?? [];
  let winner: ChatReplayArtifact | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const artifact of artifacts) {
    const distance = Math.min(
      Math.abs(target - artifact.range.start),
      Math.abs(target - artifact.range.end),
    );

    if (distance < bestDistance) {
      bestDistance = distance;
      winner = artifact;
    }
  }

  return winner;
}

// ============================================================================
// MARK: Derived builders for downstream engine/reducer usage
// ============================================================================

export function createPendingRequestState(args: {
  readonly requestId: ChatRequestId;
  readonly roomId: ChatRoomId;
  readonly sessionId: ChatSessionId;
  readonly messageId: ChatMessageId;
  readonly now: UnixMs;
}): ChatPendingRequestState {
  return {
    requestId: args.requestId,
    roomId: args.roomId,
    sessionId: args.sessionId,
    messageId: args.messageId,
    createdAt: args.now,
  };
}

export function createPendingReveal(args: {
  readonly revealAt: UnixMs;
  readonly roomId: ChatRoomId;
  readonly message: ChatMessage;
}): ChatPendingReveal {
  return {
    revealAt: args.revealAt,
    roomId: args.roomId,
    message: args.message,
  };
}

export function createDefaultAudienceHeat(
  roomId: ChatRoomId,
  channelId: ChatVisibleChannel,
  now: UnixMs,
): ChatAudienceHeat {
  return {
    roomId,
    channelId,
    heat01: clamp01(0.25),
    swarmDirection: 'NEUTRAL',
    updatedAt: now,
  };
}

export function createDefaultRelationship(args: {
  readonly id: ChatRelationshipId;
  readonly roomId: ChatRoomId;
  readonly userId: ChatLearningProfile['userId'];
  readonly actorId: string;
  readonly now: UnixMs;
}): ChatRelationshipState {
  return {
    id: args.id,
    roomId: args.roomId,
    userId: args.userId,
    actorId: args.actorId,
    trust01: clamp01(0.15),
    fear01: clamp01(0.05),
    contempt01: clamp01(0.05),
    fascination01: clamp01(0.10),
    rivalry01: clamp01(0.00),
    rescueDebt01: clamp01(0.00),
    updatedAt: args.now,
  };
}

export function createDefaultRescueDecision(): ChatRescueDecision {
  return {
    triggered: false,
    urgency: 'NONE',
    reason: 'No rescue threshold crossed.',
    helperPersonaId: null,
    shouldOpenRecoveryWindow: false,
  };
}

// ============================================================================
// MARK: Generic low-level utilities
// ============================================================================

export function cloneReadonlyRecordOfArrays<TKey extends string, TValue>(
  record: Readonly<Record<TKey, readonly TValue[]>>,
): Record<TKey, readonly TValue[]> {
  const next = {} as Record<TKey, readonly TValue[]>;
  for (const [key, value] of Object.entries(record) as [TKey, readonly TValue[]][]) {
    next[key] = [...value];
  }
  return next;
}

export function cloneNestedPresence(
  record: Readonly<Record<ChatRoomId, Readonly<Record<ChatSessionId, ChatPresenceSnapshot>>>>,
): Record<ChatRoomId, Readonly<Record<ChatSessionId, ChatPresenceSnapshot>>> {
  const next = {} as Record<ChatRoomId, Readonly<Record<ChatSessionId, ChatPresenceSnapshot>>>;
  for (const [roomId, value] of Object.entries(record) as [
    ChatRoomId,
    Readonly<Record<ChatSessionId, ChatPresenceSnapshot>>,
  ][]) {
    next[roomId] = { ...value };
  }
  return next;
}

export function uniqueBy<T>(values: readonly T[], getKey: (value: T) => string): readonly T[] {
  const map = new Map<string, T>();
  for (const value of values) {
    map.set(getKey(value), value);
  }
  return [...map.values()];
}

export function incrementUnread(
  unreadByChannel: ChatRoomState['unreadByChannel'],
  channelId: ChatChannelId,
): ChatRoomState['unreadByChannel'] {
  if (channelId === 'SYSTEM_SHADOW' || channelId === 'NPC_SHADOW' || channelId === 'RIVALRY_SHADOW' || channelId === 'RESCUE_SHADOW' || channelId === 'LIVEOPS_SHADOW') {
    return unreadByChannel;
  }

  return {
    ...unreadByChannel,
    [channelId]: (unreadByChannel[channelId] ?? 0) + 1,
  };
}

export function sumUnread(unreadByChannel: ChatRoomState['unreadByChannel']): number {
  return unreadByChannel.GLOBAL + unreadByChannel.SYNDICATE + unreadByChannel.DEAL_ROOM + unreadByChannel.LOBBY;
}

export function normalizeHeat(value: number): Score01 {
  return clamp01(value);
}

export function stampNow(now: number): UnixMs {
  return asUnixMs(now);
}
