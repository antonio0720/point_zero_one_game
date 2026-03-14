/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT REDUCER
 * FILE: backend/src/game/engine/chat/ChatReducer.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Deterministic mutation layer for the backend chat authority lane.
 *
 * This reducer is intentionally backend-native. It does not own transport,
 * moderation policy, rate policy, or inference execution. It receives accepted
 * operations from the engine and applies them to authoritative state through
 * the lawful state helpers in ChatState.ts.
 *
 * Why this file exists
 * --------------------
 * The permanent architecture requires a strict separation of concerns:
 * - ChatState.ts models and mutates lawful backend truth structures.
 * - ChatReducer.ts composes approved operations into deterministic state deltas.
 * - ChatEngine.ts runs policy, orchestration, ports, and downstream emissions.
 *
 * That separation matters because backend chat is not a mirror of frontend chat.
 * It is the source of truth for transcript history, room membership, presence,
 * typing, replay anchors, proof edges, invasions, scene progression, learning,
 * and all transcript-bearing side effects.
 * ============================================================================
 */

import {
  asSequenceNumber,
  type ChatAudienceHeat,
  type ChatInferenceSnapshot,
  type ChatInvasionId,
  type ChatInvasionState,
  type ChatJoinRequest,
  type ChatLearningProfile,
  type ChatLeaveRequest,
  type ChatMessage,
  type ChatMessageId,
  type ChatPendingRequestState,
  type ChatPendingReveal,
  type ChatPresenceSnapshot,
  type ChatProofEdge,
  type ChatRelationshipId,
  type ChatRelationshipState,
  type ChatReplayArtifact,
  type ChatRequestId,
  type ChatRoomId,
  type ChatRoomState,
  type ChatSessionId,
  type ChatSessionState,
  type ChatSilenceDecision,
  type ChatState,
  type ChatTelemetryEnvelope,
  type ChatTypingSnapshot,
  type ChatVisibleChannel,
  type SequenceNumber,
  type UnixMs,
} from './types';
import {
  appendProofEdge,
  appendReplayArtifact,
  appendTranscriptMessage,
  applyAudienceHeatDelta,
  attachSessionToRoom,
  clearSilenceDecision,
  clearTypingSnapshot,
  cloneChatState,
  closeInvasion,
  createChatPresenceSnapshot,
  createChatRoomState,
  createChatSessionState,
  createChatTypingSnapshot,
  createPendingRequestState,
  detachSessionFromRoom,
  flushDuePendingReveals,
  flushTelemetryQueue,
  hasRoom,
  hasSession,
  incrementUnread,
  isSessionInRoom,
  markLastRoomEvent,
  nextSequenceForRoom,
  openInvasion,
  pruneExpiredInvasions,
  pruneExpiredSilences,
  pruneExpiredTyping,
  queuePendingReveal,
  queueTelemetry,
  redactTranscriptMessage,
  removePendingRequest,
  removeRoom,
  removeSession,
  replaceTranscriptMessage,
  resetUnreadByChannel,
  selectCurrentSequence,
  selectLatestMessage,
  setActiveVisibleChannel,
  setAudienceHeat,
  setRoomCollapsed,
  setRoomScene,
  setRoomStageMood,
  setSessionConnectionState,
  setSessionInvisible,
  setSessionMutedUntil,
  setSessionShadowMuted,
  setSilenceDecision,
  softDeleteTranscriptMessage,
  touchRoomActivity,
  upsertInferenceSnapshot,
  upsertLearningProfile,
  upsertPendingRequest,
  upsertPresenceSnapshot,
  upsertRelationship,
  upsertRoom,
  upsertSession,
  upsertTypingSnapshot,
  removePresenceSnapshot,
} from './ChatState';

// ============================================================================
// MARK: Reducer effect tracking
// ============================================================================

export interface ChatReducerResult {
  readonly state: ChatState;
  readonly touchedRoomIds: readonly ChatRoomId[];
  readonly touchedSessionIds: readonly ChatSessionId[];
  readonly appendedMessages: readonly ChatMessage[];
  readonly replacedMessageIds: readonly ChatMessageId[];
  readonly redactedMessageIds: readonly ChatMessageId[];
  readonly deletedMessageIds: readonly ChatMessageId[];
  readonly replayArtifacts: readonly ChatReplayArtifact[];
  readonly proofEdges: readonly ChatProofEdge[];
  readonly telemetry: readonly ChatTelemetryEnvelope[];
  readonly learningProfilesTouched: readonly ChatLearningProfile['userId'][];
  readonly inferenceSnapshots: readonly ChatInferenceSnapshot[];
  readonly openedInvasionIds: readonly ChatInvasionId[];
  readonly closedInvasionIds: readonly ChatInvasionId[];
  readonly processedRequestIds: readonly ChatRequestId[];
  readonly revealedMessages: readonly ChatMessage[];
}

interface MutableReducerEffect {
  state: ChatState;
  touchedRoomIds: Set<ChatRoomId>;
  touchedSessionIds: Set<ChatSessionId>;
  appendedMessages: ChatMessage[];
  replacedMessageIds: ChatMessageId[];
  redactedMessageIds: ChatMessageId[];
  deletedMessageIds: ChatMessageId[];
  replayArtifacts: ChatReplayArtifact[];
  proofEdges: ChatProofEdge[];
  telemetry: ChatTelemetryEnvelope[];
  learningProfilesTouched: Set<ChatLearningProfile['userId']>;
  inferenceSnapshots: ChatInferenceSnapshot[];
  openedInvasionIds: ChatInvasionId[];
  closedInvasionIds: ChatInvasionId[];
  processedRequestIds: ChatRequestId[];
  revealedMessages: ChatMessage[];
}

function createEffect(state: ChatState): MutableReducerEffect {
  return {
    state,
    touchedRoomIds: new Set<ChatRoomId>(),
    touchedSessionIds: new Set<ChatSessionId>(),
    appendedMessages: [],
    replacedMessageIds: [],
    redactedMessageIds: [],
    deletedMessageIds: [],
    replayArtifacts: [],
    proofEdges: [],
    telemetry: [],
    learningProfilesTouched: new Set<ChatLearningProfile['userId']>(),
    inferenceSnapshots: [],
    openedInvasionIds: [],
    closedInvasionIds: [],
    processedRequestIds: [],
    revealedMessages: [],
  };
}

function freezeEffect(effect: MutableReducerEffect): ChatReducerResult {
  return {
    state: effect.state,
    touchedRoomIds: [...effect.touchedRoomIds],
    touchedSessionIds: [...effect.touchedSessionIds],
    appendedMessages: effect.appendedMessages,
    replacedMessageIds: effect.replacedMessageIds,
    redactedMessageIds: effect.redactedMessageIds,
    deletedMessageIds: effect.deletedMessageIds,
    replayArtifacts: effect.replayArtifacts,
    proofEdges: effect.proofEdges,
    telemetry: effect.telemetry,
    learningProfilesTouched: [...effect.learningProfilesTouched],
    inferenceSnapshots: effect.inferenceSnapshots,
    openedInvasionIds: effect.openedInvasionIds,
    closedInvasionIds: effect.closedInvasionIds,
    processedRequestIds: effect.processedRequestIds,
    revealedMessages: effect.revealedMessages,
  };
}

function touchRoom(effect: MutableReducerEffect, roomId: ChatRoomId | null | undefined): void {
  if (roomId) {
    effect.touchedRoomIds.add(roomId);
  }
}

function touchSession(effect: MutableReducerEffect, sessionId: ChatSessionId | null | undefined): void {
  if (sessionId) {
    effect.touchedSessionIds.add(sessionId);
  }
}

function pushTelemetry(effect: MutableReducerEffect, telemetry: readonly ChatTelemetryEnvelope[]): void {
  for (const item of telemetry) {
    effect.telemetry.push(item);
    if (item.roomId) {
      effect.touchedRoomIds.add(item.roomId);
    }
    if (item.sessionId) {
      effect.touchedSessionIds.add(item.sessionId);
    }
  }
}

function pushProofEdges(effect: MutableReducerEffect, proofEdges: readonly ChatProofEdge[]): void {
  for (const edge of proofEdges) {
    effect.state = appendProofEdge(effect.state, edge);
    effect.proofEdges.push(edge);
    effect.touchedRoomIds.add(edge.roomId);
  }
}

function pushReplayArtifacts(effect: MutableReducerEffect, artifacts: readonly ChatReplayArtifact[]): void {
  for (const artifact of artifacts) {
    effect.state = appendReplayArtifact(effect.state, artifact);
    effect.replayArtifacts.push(artifact);
    effect.touchedRoomIds.add(artifact.roomId);
  }
}

function appendMessages(effect: MutableReducerEffect, messages: readonly ChatMessage[]): void {
  for (const message of messages) {
    effect.state = appendTranscriptMessage(effect.state, message);
    effect.appendedMessages.push(message);
    effect.touchedRoomIds.add(message.roomId);
  }
}

// ============================================================================
// MARK: Primitive reducer action types
// ============================================================================

export type ChatReducerPrimitiveAction =
  | {
      readonly type: 'UPSERT_ROOM';
      readonly room: ChatRoomState;
    }
  | {
      readonly type: 'REMOVE_ROOM';
      readonly roomId: ChatRoomId;
    }
  | {
      readonly type: 'UPSERT_SESSION';
      readonly session: ChatSessionState;
    }
  | {
      readonly type: 'REMOVE_SESSION';
      readonly sessionId: ChatSessionId;
    }
  | {
      readonly type: 'ATTACH_SESSION_TO_ROOM';
      readonly roomId: ChatRoomId;
      readonly sessionId: ChatSessionId;
    }
  | {
      readonly type: 'DETACH_SESSION_FROM_ROOM';
      readonly roomId: ChatRoomId;
      readonly sessionId: ChatSessionId;
    }
  | {
      readonly type: 'SET_SESSION_CONNECTION_STATE';
      readonly sessionId: ChatSessionId;
      readonly connectionState: ChatSessionState['connectionState'];
      readonly now: UnixMs;
    }
  | {
      readonly type: 'SET_SESSION_MUTING';
      readonly sessionId: ChatSessionId;
      readonly mutedUntil: ChatSessionState['mutedUntil'];
      readonly shadowMuted: boolean;
      readonly invisible: boolean;
    }
  | {
      readonly type: 'UPSERT_PRESENCE';
      readonly snapshot: ChatPresenceSnapshot;
    }
  | {
      readonly type: 'REMOVE_PRESENCE';
      readonly roomId: ChatRoomId;
      readonly sessionId: ChatSessionId;
    }
  | {
      readonly type: 'UPSERT_TYPING';
      readonly snapshot: ChatTypingSnapshot;
    }
  | {
      readonly type: 'CLEAR_TYPING';
      readonly roomId: ChatRoomId;
      readonly sessionId: ChatSessionId;
      readonly channelId?: ChatVisibleChannel;
    }
  | {
      readonly type: 'APPEND_MESSAGE';
      readonly message: ChatMessage;
    }
  | {
      readonly type: 'APPEND_MESSAGES';
      readonly messages: readonly ChatMessage[];
    }
  | {
      readonly type: 'REPLACE_MESSAGE';
      readonly message: ChatMessage;
    }
  | {
      readonly type: 'REDACT_MESSAGE';
      readonly messageId: ChatMessageId;
      readonly now: UnixMs;
    }
  | {
      readonly type: 'DELETE_MESSAGE';
      readonly messageId: ChatMessageId;
      readonly now: UnixMs;
    }
  | {
      readonly type: 'UPSERT_PENDING_REQUEST';
      readonly pending: ChatPendingRequestState;
    }
  | {
      readonly type: 'REMOVE_PENDING_REQUEST';
      readonly requestId: ChatRequestId;
    }
  | {
      readonly type: 'QUEUE_PENDING_REVEAL';
      readonly reveal: ChatPendingReveal;
    }
  | {
      readonly type: 'APPEND_PROOF_EDGES';
      readonly proofEdges: readonly ChatProofEdge[];
    }
  | {
      readonly type: 'APPEND_REPLAY_ARTIFACTS';
      readonly replayArtifacts: readonly ChatReplayArtifact[];
    }
  | {
      readonly type: 'QUEUE_TELEMETRY';
      readonly telemetry: readonly ChatTelemetryEnvelope[];
    }
  | {
      readonly type: 'UPSERT_LEARNING_PROFILE';
      readonly profile: ChatLearningProfile;
    }
  | {
      readonly type: 'UPSERT_INFERENCE_SNAPSHOT';
      readonly snapshot: ChatInferenceSnapshot;
    }
  | {
      readonly type: 'UPSERT_RELATIONSHIP';
      readonly relationship: ChatRelationshipState;
    }
  | {
      readonly type: 'SET_AUDIENCE_HEAT';
      readonly heat: ChatAudienceHeat;
    }
  | {
      readonly type: 'APPLY_AUDIENCE_HEAT_DELTA';
      readonly roomId: ChatRoomId;
      readonly channelId: ChatVisibleChannel;
      readonly delta: number;
      readonly now: UnixMs;
    }
  | {
      readonly type: 'SET_ROOM_STAGE_MOOD';
      readonly roomId: ChatRoomId;
      readonly stageMood: ChatRoomState['stageMood'];
    }
  | {
      readonly type: 'SET_ROOM_COLLAPSED';
      readonly roomId: ChatRoomId;
      readonly collapsed: boolean;
    }
  | {
      readonly type: 'SET_ROOM_SCENE';
      readonly roomId: ChatRoomId;
      readonly sceneId: ChatRoomState['activeSceneId'];
    }
  | {
      readonly type: 'SET_ACTIVE_VISIBLE_CHANNEL';
      readonly roomId: ChatRoomId;
      readonly channelId: ChatVisibleChannel;
    }
  | {
      readonly type: 'RESET_UNREAD_BY_CHANNEL';
      readonly roomId: ChatRoomId;
      readonly channelId: ChatVisibleChannel;
    }
  | {
      readonly type: 'OPEN_INVASION';
      readonly invasion: ChatInvasionState;
    }
  | {
      readonly type: 'CLOSE_INVASION';
      readonly invasionId: ChatInvasionId;
    }
  | {
      readonly type: 'SET_SILENCE';
      readonly roomId: ChatRoomId;
      readonly silence: ChatSilenceDecision;
    }
  | {
      readonly type: 'CLEAR_SILENCE';
      readonly roomId: ChatRoomId;
    }
  | {
      readonly type: 'MARK_ROOM_EVENT';
      readonly roomId: ChatRoomId;
      readonly eventId: ChatState['lastEventByRoom'][ChatRoomId];
      readonly now: UnixMs;
    }
  | {
      readonly type: 'MAINTENANCE_TICK';
      readonly now: UnixMs;
      readonly flushTelemetry?: boolean;
    };

// ============================================================================
// MARK: Semantic reducer action types
// ============================================================================

export type ChatReducerSemanticAction =
  | {
      readonly type: 'APPLY_JOIN_ACCEPTED';
      readonly now: UnixMs;
      readonly request: ChatJoinRequest;
      readonly joinSystemMessage?: ChatMessage;
      readonly telemetry?: readonly ChatTelemetryEnvelope[];
      readonly proofEdges?: readonly ChatProofEdge[];
      readonly replayArtifacts?: readonly ChatReplayArtifact[];
    }
  | {
      readonly type: 'APPLY_JOIN_REJECTED';
      readonly now: UnixMs;
      readonly request: ChatJoinRequest;
      readonly telemetry?: readonly ChatTelemetryEnvelope[];
    }
  | {
      readonly type: 'APPLY_LEAVE_ACCEPTED';
      readonly now: UnixMs;
      readonly request: ChatLeaveRequest;
      readonly farewellMessage?: ChatMessage;
      readonly telemetry?: readonly ChatTelemetryEnvelope[];
      readonly proofEdges?: readonly ChatProofEdge[];
      readonly replayArtifacts?: readonly ChatReplayArtifact[];
      readonly removeRoomWhenEmpty?: boolean;
    }
  | {
      readonly type: 'APPLY_PLAYER_MESSAGE_ACCEPTED';
      readonly now: UnixMs;
      readonly message: ChatMessage;
      readonly requestId: ChatRequestId;
      readonly trackPending?: boolean;
      readonly proofEdges?: readonly ChatProofEdge[];
      readonly replayArtifacts?: readonly ChatReplayArtifact[];
      readonly telemetry?: readonly ChatTelemetryEnvelope[];
      readonly learningProfile?: ChatLearningProfile;
      readonly inferenceSnapshot?: ChatInferenceSnapshot;
      readonly audienceHeatDelta?: number;
      readonly stageMood?: ChatRoomState['stageMood'];
      readonly followUpMessages?: readonly ChatMessage[];
      readonly followUpProofEdges?: readonly ChatProofEdge[];
      readonly followUpReplayArtifacts?: readonly ChatReplayArtifact[];
      readonly followUpTelemetry?: readonly ChatTelemetryEnvelope[];
    }
  | {
      readonly type: 'APPLY_PLAYER_MESSAGE_REJECTED';
      readonly now: UnixMs;
      readonly roomId: ChatRoomId;
      readonly sessionId: ChatSessionId;
      readonly requestId: ChatRequestId;
      readonly telemetry?: readonly ChatTelemetryEnvelope[];
    }
  | {
      readonly type: 'APPLY_SYSTEM_SIGNAL';
      readonly now: UnixMs;
      readonly roomId: ChatRoomId;
      readonly systemMessages?: readonly ChatMessage[];
      readonly proofEdges?: readonly ChatProofEdge[];
      readonly replayArtifacts?: readonly ChatReplayArtifact[];
      readonly telemetry?: readonly ChatTelemetryEnvelope[];
      readonly stageMood?: ChatRoomState['stageMood'];
      readonly audienceHeatDelta?: number;
      readonly invasion?: ChatInvasionState;
      readonly silence?: ChatSilenceDecision;
    }
  | {
      readonly type: 'APPLY_NPC_SCENE';
      readonly now: UnixMs;
      readonly roomId: ChatRoomId;
      readonly sceneId?: ChatRoomState['activeSceneId'];
      readonly messages?: readonly ChatMessage[];
      readonly delayedMessages?: readonly ChatPendingReveal[];
      readonly proofEdges?: readonly ChatProofEdge[];
      readonly replayArtifacts?: readonly ChatReplayArtifact[];
      readonly telemetry?: readonly ChatTelemetryEnvelope[];
      readonly invasion?: ChatInvasionState;
      readonly silence?: ChatSilenceDecision;
      readonly audienceHeatDelta?: number;
    }
  | {
      readonly type: 'BATCH';
      readonly actions: readonly ChatReducerAction[];
    };

export type ChatReducerAction = ChatReducerPrimitiveAction | ChatReducerSemanticAction;

// ============================================================================
// MARK: Public reducer entry points
// ============================================================================

export function reduceChatState(state: ChatState, action: ChatReducerAction): ChatReducerResult {
  const effect = createEffect(cloneChatState(state));
  applyAction(effect, action);
  return freezeEffect(effect);
}

export function reduceChatStateBatch(state: ChatState, actions: readonly ChatReducerAction[]): ChatReducerResult {
  const effect = createEffect(cloneChatState(state));
  for (const action of actions) {
    applyAction(effect, action);
  }
  return freezeEffect(effect);
}

// ============================================================================
// MARK: Action dispatcher
// ============================================================================

function applyAction(effect: MutableReducerEffect, action: ChatReducerAction): void {
  switch (action.type) {
    case 'UPSERT_ROOM':
      reduceUpsertRoom(effect, action.room);
      return;

    case 'REMOVE_ROOM':
      reduceRemoveRoom(effect, action.roomId);
      return;

    case 'UPSERT_SESSION':
      reduceUpsertSession(effect, action.session);
      return;

    case 'REMOVE_SESSION':
      reduceRemoveSession(effect, action.sessionId);
      return;

    case 'ATTACH_SESSION_TO_ROOM':
      reduceAttachSessionToRoom(effect, action.roomId, action.sessionId);
      return;

    case 'DETACH_SESSION_FROM_ROOM':
      reduceDetachSessionFromRoom(effect, action.roomId, action.sessionId);
      return;

    case 'SET_SESSION_CONNECTION_STATE':
      reduceSetSessionConnectionState(effect, action.sessionId, action.connectionState, action.now);
      return;

    case 'SET_SESSION_MUTING':
      reduceSetSessionMuting(effect, action.sessionId, action.mutedUntil, action.shadowMuted, action.invisible);
      return;

    case 'UPSERT_PRESENCE':
      reduceUpsertPresence(effect, action.snapshot);
      return;

    case 'REMOVE_PRESENCE':
      reduceRemovePresence(effect, action.roomId, action.sessionId);
      return;

    case 'UPSERT_TYPING':
      reduceUpsertTyping(effect, action.snapshot);
      return;

    case 'CLEAR_TYPING':
      reduceClearTyping(effect, action.roomId, action.sessionId, action.channelId);
      return;

    case 'APPEND_MESSAGE':
      reduceAppendMessage(effect, action.message);
      return;

    case 'APPEND_MESSAGES':
      for (const message of action.messages) {
        reduceAppendMessage(effect, message);
      }
      return;

    case 'REPLACE_MESSAGE':
      reduceReplaceMessage(effect, action.message);
      return;

    case 'REDACT_MESSAGE':
      reduceRedactMessage(effect, action.messageId, action.now);
      return;

    case 'DELETE_MESSAGE':
      reduceDeleteMessage(effect, action.messageId, action.now);
      return;

    case 'UPSERT_PENDING_REQUEST':
      reduceUpsertPendingRequest(effect, action.pending);
      return;

    case 'REMOVE_PENDING_REQUEST':
      reduceRemovePendingRequest(effect, action.requestId);
      return;

    case 'QUEUE_PENDING_REVEAL':
      reduceQueuePendingReveal(effect, action.reveal);
      return;

    case 'APPEND_PROOF_EDGES':
      pushProofEdges(effect, action.proofEdges);
      return;

    case 'APPEND_REPLAY_ARTIFACTS':
      pushReplayArtifacts(effect, action.replayArtifacts);
      return;

    case 'QUEUE_TELEMETRY':
      reduceQueueTelemetry(effect, action.telemetry);
      return;

    case 'UPSERT_LEARNING_PROFILE':
      reduceUpsertLearningProfile(effect, action.profile);
      return;

    case 'UPSERT_INFERENCE_SNAPSHOT':
      reduceUpsertInferenceSnapshot(effect, action.snapshot);
      return;

    case 'UPSERT_RELATIONSHIP':
      reduceUpsertRelationship(effect, action.relationship);
      return;

    case 'SET_AUDIENCE_HEAT':
      reduceSetAudienceHeat(effect, action.heat);
      return;

    case 'APPLY_AUDIENCE_HEAT_DELTA':
      reduceApplyAudienceHeatDelta(effect, action.roomId, action.channelId, action.delta, action.now);
      return;

    case 'SET_ROOM_STAGE_MOOD':
      reduceSetRoomStageMood(effect, action.roomId, action.stageMood);
      return;

    case 'SET_ROOM_COLLAPSED':
      reduceSetRoomCollapsed(effect, action.roomId, action.collapsed);
      return;

    case 'SET_ROOM_SCENE':
      reduceSetRoomScene(effect, action.roomId, action.sceneId);
      return;

    case 'SET_ACTIVE_VISIBLE_CHANNEL':
      reduceSetActiveVisibleChannel(effect, action.roomId, action.channelId);
      return;

    case 'RESET_UNREAD_BY_CHANNEL':
      reduceResetUnreadByChannel(effect, action.roomId, action.channelId);
      return;

    case 'OPEN_INVASION':
      reduceOpenInvasion(effect, action.invasion);
      return;

    case 'CLOSE_INVASION':
      reduceCloseInvasion(effect, action.invasionId);
      return;

    case 'SET_SILENCE':
      reduceSetSilence(effect, action.roomId, action.silence);
      return;

    case 'CLEAR_SILENCE':
      reduceClearSilence(effect, action.roomId);
      return;

    case 'MARK_ROOM_EVENT':
      reduceMarkRoomEvent(effect, action.roomId, action.eventId, action.now);
      return;

    case 'MAINTENANCE_TICK':
      reduceMaintenanceTick(effect, action.now, action.flushTelemetry ?? false);
      return;

    case 'APPLY_JOIN_ACCEPTED':
      reduceApplyJoinAccepted(effect, action);
      return;

    case 'APPLY_JOIN_REJECTED':
      reduceApplyJoinRejected(effect, action);
      return;

    case 'APPLY_LEAVE_ACCEPTED':
      reduceApplyLeaveAccepted(effect, action);
      return;

    case 'APPLY_PLAYER_MESSAGE_ACCEPTED':
      reduceApplyPlayerMessageAccepted(effect, action);
      return;

    case 'APPLY_PLAYER_MESSAGE_REJECTED':
      reduceApplyPlayerMessageRejected(effect, action);
      return;

    case 'APPLY_SYSTEM_SIGNAL':
      reduceApplySystemSignal(effect, action);
      return;

    case 'APPLY_NPC_SCENE':
      reduceApplyNpcScene(effect, action);
      return;

    case 'BATCH':
      for (const child of action.actions) {
        applyAction(effect, child);
      }
      return;
  }
}

// ============================================================================
// MARK: Primitive reducers
// ============================================================================

function reduceUpsertRoom(effect: MutableReducerEffect, room: ChatRoomState): void {
  effect.state = upsertRoom(effect.state, room);
  touchRoom(effect, room.roomId);
}

function reduceRemoveRoom(effect: MutableReducerEffect, roomId: ChatRoomId): void {
  effect.state = removeRoom(effect.state, roomId);
  touchRoom(effect, roomId);
}

function reduceUpsertSession(effect: MutableReducerEffect, session: ChatSessionState): void {
  effect.state = upsertSession(effect.state, session);
  touchSession(effect, session.identity.sessionId);
}

function reduceRemoveSession(effect: MutableReducerEffect, sessionId: ChatSessionId): void {
  effect.state = removeSession(effect.state, sessionId);
  touchSession(effect, sessionId);
}

function reduceAttachSessionToRoom(
  effect: MutableReducerEffect,
  roomId: ChatRoomId,
  sessionId: ChatSessionId,
): void {
  effect.state = attachSessionToRoom(effect.state, roomId, sessionId);
  touchRoom(effect, roomId);
  touchSession(effect, sessionId);
}

function reduceDetachSessionFromRoom(
  effect: MutableReducerEffect,
  roomId: ChatRoomId,
  sessionId: ChatSessionId,
): void {
  effect.state = detachSessionFromRoom(effect.state, roomId, sessionId);
  effect.state = removePresenceSnapshot(effect.state, roomId, sessionId);
  effect.state = clearTypingSnapshot(effect.state, roomId, sessionId);
  touchRoom(effect, roomId);
  touchSession(effect, sessionId);
}

function reduceSetSessionConnectionState(
  effect: MutableReducerEffect,
  sessionId: ChatSessionId,
  connectionState: ChatSessionState['connectionState'],
  now: UnixMs,
): void {
  effect.state = setSessionConnectionState(effect.state, sessionId, connectionState, now);
  touchSession(effect, sessionId);
}

function reduceSetSessionMuting(
  effect: MutableReducerEffect,
  sessionId: ChatSessionId,
  mutedUntil: ChatSessionState['mutedUntil'],
  shadowMuted: boolean,
  invisible: boolean,
): void {
  effect.state = setSessionMutedUntil(effect.state, sessionId, mutedUntil);
  effect.state = setSessionShadowMuted(effect.state, sessionId, shadowMuted);
  effect.state = setSessionInvisible(effect.state, sessionId, invisible);
  touchSession(effect, sessionId);
}

function reduceUpsertPresence(effect: MutableReducerEffect, snapshot: ChatPresenceSnapshot): void {
  effect.state = upsertPresenceSnapshot(effect.state, snapshot);
  touchRoom(effect, snapshot.roomId);
  touchSession(effect, snapshot.sessionId);
}

function reduceRemovePresence(
  effect: MutableReducerEffect,
  roomId: ChatRoomId,
  sessionId: ChatSessionId,
): void {
  effect.state = removePresenceSnapshot(effect.state, roomId, sessionId);
  touchRoom(effect, roomId);
  touchSession(effect, sessionId);
}

function reduceUpsertTyping(effect: MutableReducerEffect, snapshot: ChatTypingSnapshot): void {
  effect.state = upsertTypingSnapshot(effect.state, snapshot);
  touchRoom(effect, snapshot.roomId);
  touchSession(effect, snapshot.sessionId);
}

function reduceClearTyping(
  effect: MutableReducerEffect,
  roomId: ChatRoomId,
  sessionId: ChatSessionId,
  channelId?: ChatVisibleChannel,
): void {
  effect.state = clearTypingSnapshot(effect.state, roomId, sessionId, channelId);
  touchRoom(effect, roomId);
  touchSession(effect, sessionId);
}

function reduceAppendMessage(effect: MutableReducerEffect, message: ChatMessage): void {
  effect.state = appendTranscriptMessage(effect.state, message);
  effect.appendedMessages.push(message);
  touchRoom(effect, message.roomId);
}

function reduceReplaceMessage(effect: MutableReducerEffect, message: ChatMessage): void {
  effect.state = replaceTranscriptMessage(effect.state, message);
  effect.replacedMessageIds.push(message.id);
  touchRoom(effect, message.roomId);
}

function reduceRedactMessage(
  effect: MutableReducerEffect,
  messageId: ChatMessageId,
  now: UnixMs,
): void {
  const before = effect.state.transcript.byMessageId[messageId];
  effect.state = redactTranscriptMessage(effect.state, messageId, now);
  if (before) {
    effect.redactedMessageIds.push(messageId);
    touchRoom(effect, before.message.roomId);
  }
}

function reduceDeleteMessage(
  effect: MutableReducerEffect,
  messageId: ChatMessageId,
  now: UnixMs,
): void {
  const before = effect.state.transcript.byMessageId[messageId];
  effect.state = softDeleteTranscriptMessage(effect.state, messageId, now);
  if (before) {
    effect.deletedMessageIds.push(messageId);
    touchRoom(effect, before.message.roomId);
  }
}

function reduceUpsertPendingRequest(effect: MutableReducerEffect, pending: ChatPendingRequestState): void {
  effect.state = upsertPendingRequest(effect.state, pending);
  effect.processedRequestIds.push(pending.requestId);
  touchRoom(effect, pending.roomId);
  touchSession(effect, pending.sessionId);
}

function reduceRemovePendingRequest(effect: MutableReducerEffect, requestId: ChatRequestId): void {
  const pending = effect.state.pendingRequests[requestId] ?? null;
  effect.state = removePendingRequest(effect.state, requestId);
  effect.processedRequestIds.push(requestId);
  if (pending) {
    touchRoom(effect, pending.roomId);
    touchSession(effect, pending.sessionId);
  }
}

function reduceQueuePendingReveal(effect: MutableReducerEffect, reveal: ChatPendingReveal): void {
  effect.state = queuePendingReveal(effect.state, reveal);
  touchRoom(effect, reveal.roomId);
}

function reduceQueueTelemetry(effect: MutableReducerEffect, telemetry: readonly ChatTelemetryEnvelope[]): void {
  for (const item of telemetry) {
    effect.state = queueTelemetry(effect.state, item);
  }
  pushTelemetry(effect, telemetry);
}

function reduceUpsertLearningProfile(effect: MutableReducerEffect, profile: ChatLearningProfile): void {
  effect.state = upsertLearningProfile(effect.state, profile);
  effect.learningProfilesTouched.add(profile.userId);
}

function reduceUpsertInferenceSnapshot(effect: MutableReducerEffect, snapshot: ChatInferenceSnapshot): void {
  effect.state = upsertInferenceSnapshot(effect.state, snapshot);
  effect.inferenceSnapshots.push(snapshot);
  effect.learningProfilesTouched.add(snapshot.userId);
  touchRoom(effect, snapshot.roomId);
}

function reduceUpsertRelationship(effect: MutableReducerEffect, relationship: ChatRelationshipState): void {
  effect.state = upsertRelationship(effect.state, relationship);
  touchRoom(effect, relationship.roomId);
  effect.learningProfilesTouched.add(relationship.userId);
}

function reduceSetAudienceHeat(effect: MutableReducerEffect, heat: ChatAudienceHeat): void {
  effect.state = setAudienceHeat(effect.state, heat);
  touchRoom(effect, heat.roomId);
}

function reduceApplyAudienceHeatDelta(
  effect: MutableReducerEffect,
  roomId: ChatRoomId,
  channelId: ChatVisibleChannel,
  delta: number,
  now: UnixMs,
): void {
  effect.state = applyAudienceHeatDelta(effect.state, roomId, channelId, delta, now);
  touchRoom(effect, roomId);
}

function reduceSetRoomStageMood(
  effect: MutableReducerEffect,
  roomId: ChatRoomId,
  stageMood: ChatRoomState['stageMood'],
): void {
  effect.state = setRoomStageMood(effect.state, roomId, stageMood);
  touchRoom(effect, roomId);
}

function reduceSetRoomCollapsed(
  effect: MutableReducerEffect,
  roomId: ChatRoomId,
  collapsed: boolean,
): void {
  effect.state = setRoomCollapsed(effect.state, roomId, collapsed);
  touchRoom(effect, roomId);
}

function reduceSetRoomScene(
  effect: MutableReducerEffect,
  roomId: ChatRoomId,
  sceneId: ChatRoomState['activeSceneId'],
): void {
  effect.state = setRoomScene(effect.state, roomId, sceneId);
  touchRoom(effect, roomId);
}

function reduceSetActiveVisibleChannel(
  effect: MutableReducerEffect,
  roomId: ChatRoomId,
  channelId: ChatVisibleChannel,
): void {
  effect.state = setActiveVisibleChannel(effect.state, roomId, channelId);
  touchRoom(effect, roomId);
}

function reduceResetUnreadByChannel(
  effect: MutableReducerEffect,
  roomId: ChatRoomId,
  channelId: ChatVisibleChannel,
): void {
  effect.state = resetUnreadByChannel(effect.state, roomId, channelId);
  touchRoom(effect, roomId);
}

function reduceOpenInvasion(effect: MutableReducerEffect, invasion: ChatInvasionState): void {
  effect.state = openInvasion(effect.state, invasion);
  effect.openedInvasionIds.push(invasion.invasionId);
  touchRoom(effect, invasion.roomId);
}

function reduceCloseInvasion(effect: MutableReducerEffect, invasionId: ChatInvasionId): void {
  const existing = effect.state.activeInvasions[invasionId] ?? null;
  effect.state = closeInvasion(effect.state, invasionId);
  if (existing) {
    effect.closedInvasionIds.push(invasionId);
    touchRoom(effect, existing.roomId);
  }
}

function reduceSetSilence(
  effect: MutableReducerEffect,
  roomId: ChatRoomId,
  silence: ChatSilenceDecision,
): void {
  effect.state = setSilenceDecision(effect.state, roomId, silence);
  touchRoom(effect, roomId);
}

function reduceClearSilence(effect: MutableReducerEffect, roomId: ChatRoomId): void {
  effect.state = clearSilenceDecision(effect.state, roomId);
  touchRoom(effect, roomId);
}

function reduceMarkRoomEvent(
  effect: MutableReducerEffect,
  roomId: ChatRoomId,
  eventId: ChatState['lastEventByRoom'][ChatRoomId],
  now: UnixMs,
): void {
  effect.state = markLastRoomEvent(effect.state, roomId, eventId, now);
  touchRoom(effect, roomId);
}

function reduceMaintenanceTick(effect: MutableReducerEffect, now: UnixMs, flushTelemetryFlag: boolean): void {
  effect.state = pruneExpiredTyping(effect.state, now);
  effect.state = pruneExpiredSilences(effect.state, now);
  effect.state = pruneExpiredInvasions(effect.state, now);

  const revealResult = flushDuePendingReveals(effect.state, now);
  effect.state = revealResult.state;
  for (const message of revealResult.revealedMessages) {
    effect.revealedMessages.push(message);
    effect.appendedMessages.push(message);
    touchRoom(effect, message.roomId);
  }

  if (flushTelemetryFlag) {
    const flushed = flushTelemetryQueue(effect.state);
    effect.state = flushed.state;
    pushTelemetry(effect, flushed.flushed);
  }
}

// ============================================================================
// MARK: Semantic reducers
// ============================================================================

function reduceApplyJoinAccepted(
  effect: MutableReducerEffect,
  action: Extract<ChatReducerSemanticAction, { type: 'APPLY_JOIN_ACCEPTED' }>,
): void {
  const sessionId = action.request.session.sessionId;
  const roomId = action.request.roomId;

  if (!hasRoom(effect.state, roomId)) {
    applyAction(effect, {
      type: 'UPSERT_ROOM',
      room: createChatRoomState({
        roomId: action.request.roomId,
        roomKind: action.request.roomKind,
        title: action.request.title,
        now: action.now,
        mountTarget: action.request.mountTarget,
        requestedVisibleChannel: action.request.requestedVisibleChannel,
      }),
    });
  }

  if (!hasSession(effect.state, sessionId)) {
    applyAction(effect, {
      type: 'UPSERT_SESSION',
      session: createChatSessionState({
        identity: action.request.session,
        now: action.now,
        transportMetadata: action.request.transportMetadata,
      }),
    });
  } else {
    applyAction(effect, {
      type: 'SET_SESSION_CONNECTION_STATE',
      sessionId,
      connectionState: 'ATTACHED',
      now: action.now,
    });
  }

  if (!isSessionInRoom(effect.state, roomId, sessionId)) {
    applyAction(effect, {
      type: 'ATTACH_SESSION_TO_ROOM',
      roomId,
      sessionId,
    });
  }

  applyAction(effect, {
    type: 'UPSERT_PRESENCE',
    snapshot: createChatPresenceSnapshot({
      roomId,
      sessionId,
      mode: 'ONLINE',
      visibleToRoom: true,
      spectating: false,
      actorLabel: action.request.session.displayName,
      now: action.now,
    }),
  });

  if (action.joinSystemMessage) {
    applyAction(effect, {
      type: 'APPEND_MESSAGE',
      message: action.joinSystemMessage,
    });
  }

  if (action.telemetry?.length) {
    applyAction(effect, {
      type: 'QUEUE_TELEMETRY',
      telemetry: action.telemetry,
    });
  }

  if (action.proofEdges?.length) {
    applyAction(effect, {
      type: 'APPEND_PROOF_EDGES',
      proofEdges: action.proofEdges,
    });
  }

  if (action.replayArtifacts?.length) {
    applyAction(effect, {
      type: 'APPEND_REPLAY_ARTIFACTS',
      replayArtifacts: action.replayArtifacts,
    });
  }
}

function reduceApplyJoinRejected(
  effect: MutableReducerEffect,
  action: Extract<ChatReducerSemanticAction, { type: 'APPLY_JOIN_REJECTED' }>,
): void {
  touchRoom(effect, action.request.roomId);
  touchSession(effect, action.request.session.sessionId);
  if (action.telemetry?.length) {
    applyAction(effect, {
      type: 'QUEUE_TELEMETRY',
      telemetry: action.telemetry,
    });
  }
}

function reduceApplyLeaveAccepted(
  effect: MutableReducerEffect,
  action: Extract<ChatReducerSemanticAction, { type: 'APPLY_LEAVE_ACCEPTED' }>,
): void {
  const roomId = action.request.roomId;
  const sessionId = action.request.sessionId;

  if (isSessionInRoom(effect.state, roomId, sessionId)) {
    applyAction(effect, {
      type: 'DETACH_SESSION_FROM_ROOM',
      roomId,
      sessionId,
    });
  }

  applyAction(effect, {
    type: 'SET_SESSION_CONNECTION_STATE',
    sessionId,
    connectionState: 'DETACHED',
    now: action.now,
  });

  if (action.farewellMessage) {
    applyAction(effect, {
      type: 'APPEND_MESSAGE',
      message: action.farewellMessage,
    });
  }

  if (action.telemetry?.length) {
    applyAction(effect, {
      type: 'QUEUE_TELEMETRY',
      telemetry: action.telemetry,
    });
  }

  if (action.proofEdges?.length) {
    applyAction(effect, {
      type: 'APPEND_PROOF_EDGES',
      proofEdges: action.proofEdges,
    });
  }

  if (action.replayArtifacts?.length) {
    applyAction(effect, {
      type: 'APPEND_REPLAY_ARTIFACTS',
      replayArtifacts: action.replayArtifacts,
    });
  }

  if (action.removeRoomWhenEmpty) {
    const remaining = effect.state.roomSessions.byRoom[roomId] ?? [];
    if (remaining.length === 0) {
      applyAction(effect, {
        type: 'REMOVE_ROOM',
        roomId,
      });
    }
  }
}

function reduceApplyPlayerMessageAccepted(
  effect: MutableReducerEffect,
  action: Extract<ChatReducerSemanticAction, { type: 'APPLY_PLAYER_MESSAGE_ACCEPTED' }>,
): void {
  applyAction(effect, {
    type: 'APPEND_MESSAGE',
    message: action.message,
  });

  if (action.trackPending) {
    applyAction(effect, {
      type: 'UPSERT_PENDING_REQUEST',
      pending: createPendingRequestState({
        requestId: action.requestId,
        roomId: action.message.roomId,
        sessionId: action.message.attribution.authorSessionId!,
        messageId: action.message.id,
        now: action.now,
      }),
    });
  } else {
    applyAction(effect, {
      type: 'REMOVE_PENDING_REQUEST',
      requestId: action.requestId,
    });
  }

  if (typeof action.audienceHeatDelta === 'number') {
    applyAction(effect, {
      type: 'APPLY_AUDIENCE_HEAT_DELTA',
      roomId: action.message.roomId,
      channelId: visibleChannelOrFallback(action.message.channelId),
      delta: action.audienceHeatDelta,
      now: action.now,
    });
  }

  if (action.stageMood) {
    applyAction(effect, {
      type: 'SET_ROOM_STAGE_MOOD',
      roomId: action.message.roomId,
      stageMood: action.stageMood,
    });
  }

  if (action.telemetry?.length) {
    applyAction(effect, {
      type: 'QUEUE_TELEMETRY',
      telemetry: action.telemetry,
    });
  }

  if (action.proofEdges?.length) {
    applyAction(effect, {
      type: 'APPEND_PROOF_EDGES',
      proofEdges: action.proofEdges,
    });
  }

  if (action.replayArtifacts?.length) {
    applyAction(effect, {
      type: 'APPEND_REPLAY_ARTIFACTS',
      replayArtifacts: action.replayArtifacts,
    });
  }

  if (action.learningProfile) {
    applyAction(effect, {
      type: 'UPSERT_LEARNING_PROFILE',
      profile: action.learningProfile,
    });
  }

  if (action.inferenceSnapshot) {
    applyAction(effect, {
      type: 'UPSERT_INFERENCE_SNAPSHOT',
      snapshot: action.inferenceSnapshot,
    });
  }

  if (action.followUpMessages?.length) {
    applyAction(effect, {
      type: 'APPEND_MESSAGES',
      messages: action.followUpMessages,
    });
  }

  if (action.followUpProofEdges?.length) {
    applyAction(effect, {
      type: 'APPEND_PROOF_EDGES',
      proofEdges: action.followUpProofEdges,
    });
  }

  if (action.followUpReplayArtifacts?.length) {
    applyAction(effect, {
      type: 'APPEND_REPLAY_ARTIFACTS',
      replayArtifacts: action.followUpReplayArtifacts,
    });
  }

  if (action.followUpTelemetry?.length) {
    applyAction(effect, {
      type: 'QUEUE_TELEMETRY',
      telemetry: action.followUpTelemetry,
    });
  }
}

function reduceApplyPlayerMessageRejected(
  effect: MutableReducerEffect,
  action: Extract<ChatReducerSemanticAction, { type: 'APPLY_PLAYER_MESSAGE_REJECTED' }>,
): void {
  applyAction(effect, {
    type: 'REMOVE_PENDING_REQUEST',
    requestId: action.requestId,
  });

  touchRoom(effect, action.roomId);
  touchSession(effect, action.sessionId);

  if (action.telemetry?.length) {
    applyAction(effect, {
      type: 'QUEUE_TELEMETRY',
      telemetry: action.telemetry,
    });
  }
}

function reduceApplySystemSignal(
  effect: MutableReducerEffect,
  action: Extract<ChatReducerSemanticAction, { type: 'APPLY_SYSTEM_SIGNAL' }>,
): void {
  touchRoom(effect, action.roomId);

  if (action.stageMood) {
    applyAction(effect, {
      type: 'SET_ROOM_STAGE_MOOD',
      roomId: action.roomId,
      stageMood: action.stageMood,
    });
  }

  if (typeof action.audienceHeatDelta === 'number') {
    applyAction(effect, {
      type: 'APPLY_AUDIENCE_HEAT_DELTA',
      roomId: action.roomId,
      channelId: effect.state.rooms[action.roomId]?.activeVisibleChannel ?? 'GLOBAL',
      delta: action.audienceHeatDelta,
      now: action.now,
    });
  }

  if (action.invasion) {
    applyAction(effect, {
      type: 'OPEN_INVASION',
      invasion: action.invasion,
    });
  }

  if (action.silence) {
    applyAction(effect, {
      type: 'SET_SILENCE',
      roomId: action.roomId,
      silence: action.silence,
    });
  }

  if (action.systemMessages?.length) {
    applyAction(effect, {
      type: 'APPEND_MESSAGES',
      messages: action.systemMessages,
    });
  }

  if (action.proofEdges?.length) {
    applyAction(effect, {
      type: 'APPEND_PROOF_EDGES',
      proofEdges: action.proofEdges,
    });
  }

  if (action.replayArtifacts?.length) {
    applyAction(effect, {
      type: 'APPEND_REPLAY_ARTIFACTS',
      replayArtifacts: action.replayArtifacts,
    });
  }

  if (action.telemetry?.length) {
    applyAction(effect, {
      type: 'QUEUE_TELEMETRY',
      telemetry: action.telemetry,
    });
  }
}

function reduceApplyNpcScene(
  effect: MutableReducerEffect,
  action: Extract<ChatReducerSemanticAction, { type: 'APPLY_NPC_SCENE' }>,
): void {
  touchRoom(effect, action.roomId);

  if (action.sceneId !== undefined) {
    applyAction(effect, {
      type: 'SET_ROOM_SCENE',
      roomId: action.roomId,
      sceneId: action.sceneId ?? null,
    });
  }

  if (typeof action.audienceHeatDelta === 'number') {
    applyAction(effect, {
      type: 'APPLY_AUDIENCE_HEAT_DELTA',
      roomId: action.roomId,
      channelId: effect.state.rooms[action.roomId]?.activeVisibleChannel ?? 'GLOBAL',
      delta: action.audienceHeatDelta,
      now: action.now,
    });
  }

  if (action.invasion) {
    applyAction(effect, {
      type: 'OPEN_INVASION',
      invasion: action.invasion,
    });
  }

  if (action.silence) {
    applyAction(effect, {
      type: 'SET_SILENCE',
      roomId: action.roomId,
      silence: action.silence,
    });
  }

  if (action.messages?.length) {
    applyAction(effect, {
      type: 'APPEND_MESSAGES',
      messages: action.messages,
    });
  }

  if (action.delayedMessages?.length) {
    for (const reveal of action.delayedMessages) {
      applyAction(effect, {
        type: 'QUEUE_PENDING_REVEAL',
        reveal,
      });
    }
  }

  if (action.proofEdges?.length) {
    applyAction(effect, {
      type: 'APPEND_PROOF_EDGES',
      proofEdges: action.proofEdges,
    });
  }

  if (action.replayArtifacts?.length) {
    applyAction(effect, {
      type: 'APPEND_REPLAY_ARTIFACTS',
      replayArtifacts: action.replayArtifacts,
    });
  }

  if (action.telemetry?.length) {
    applyAction(effect, {
      type: 'QUEUE_TELEMETRY',
      telemetry: action.telemetry,
    });
  }
}

// ============================================================================
// MARK: Helper reducers for common backend movements
// ============================================================================

export function reduceJoinRequestAccepted(args: {
  readonly state: ChatState;
  readonly now: UnixMs;
  readonly request: ChatJoinRequest;
  readonly joinSystemMessage?: ChatMessage;
  readonly telemetry?: readonly ChatTelemetryEnvelope[];
  readonly proofEdges?: readonly ChatProofEdge[];
  readonly replayArtifacts?: readonly ChatReplayArtifact[];
}): ChatReducerResult {
  return reduceChatState(args.state, {
    type: 'APPLY_JOIN_ACCEPTED',
    now: args.now,
    request: args.request,
    joinSystemMessage: args.joinSystemMessage,
    telemetry: args.telemetry,
    proofEdges: args.proofEdges,
    replayArtifacts: args.replayArtifacts,
  });
}

export function reduceLeaveRequestAccepted(args: {
  readonly state: ChatState;
  readonly now: UnixMs;
  readonly request: ChatLeaveRequest;
  readonly farewellMessage?: ChatMessage;
  readonly telemetry?: readonly ChatTelemetryEnvelope[];
  readonly proofEdges?: readonly ChatProofEdge[];
  readonly replayArtifacts?: readonly ChatReplayArtifact[];
  readonly removeRoomWhenEmpty?: boolean;
}): ChatReducerResult {
  return reduceChatState(args.state, {
    type: 'APPLY_LEAVE_ACCEPTED',
    now: args.now,
    request: args.request,
    farewellMessage: args.farewellMessage,
    telemetry: args.telemetry,
    proofEdges: args.proofEdges,
    replayArtifacts: args.replayArtifacts,
    removeRoomWhenEmpty: args.removeRoomWhenEmpty,
  });
}

export function reducePresenceUpdate(args: {
  readonly state: ChatState;
  readonly roomId: ChatRoomId;
  readonly sessionId: ChatSessionId;
  readonly actorLabel: string;
  readonly mode: ChatPresenceSnapshot['mode'];
  readonly visibleToRoom: boolean;
  readonly spectating: boolean;
  readonly now: UnixMs;
  readonly telemetry?: readonly ChatTelemetryEnvelope[];
}): ChatReducerResult {
  return reduceChatStateBatch(args.state, [
    {
      type: 'UPSERT_PRESENCE',
      snapshot: createChatPresenceSnapshot({
        roomId: args.roomId,
        sessionId: args.sessionId,
        actorLabel: args.actorLabel,
        mode: args.mode,
        visibleToRoom: args.visibleToRoom,
        spectating: args.spectating,
        now: args.now,
      }),
    },
    ...(args.telemetry?.length
      ? [
          {
            type: 'QUEUE_TELEMETRY' as const,
            telemetry: args.telemetry,
          },
        ]
      : []),
  ]);
}

export function reduceTypingUpdate(args: {
  readonly state: ChatState;
  readonly roomId: ChatRoomId;
  readonly sessionId: ChatSessionId;
  readonly channelId: ChatVisibleChannel;
  readonly mode: ChatTypingSnapshot['mode'];
  readonly now: UnixMs;
  readonly windowMs: number;
  readonly telemetry?: readonly ChatTelemetryEnvelope[];
}): ChatReducerResult {
  return reduceChatStateBatch(args.state, [
    {
      type: 'UPSERT_TYPING',
      snapshot: createChatTypingSnapshot({
        roomId: args.roomId,
        sessionId: args.sessionId,
        channelId: args.channelId,
        mode: args.mode,
        now: args.now,
        windowMs: args.windowMs,
      }),
    },
    ...(args.telemetry?.length
      ? [
          {
            type: 'QUEUE_TELEMETRY' as const,
            telemetry: args.telemetry,
          },
        ]
      : []),
  ]);
}

export function reduceAcceptedPlayerMessage(args: {
  readonly state: ChatState;
  readonly now: UnixMs;
  readonly message: ChatMessage;
  readonly requestId: ChatRequestId;
  readonly trackPending?: boolean;
  readonly proofEdges?: readonly ChatProofEdge[];
  readonly replayArtifacts?: readonly ChatReplayArtifact[];
  readonly telemetry?: readonly ChatTelemetryEnvelope[];
  readonly learningProfile?: ChatLearningProfile;
  readonly inferenceSnapshot?: ChatInferenceSnapshot;
  readonly audienceHeatDelta?: number;
  readonly stageMood?: ChatRoomState['stageMood'];
  readonly followUpMessages?: readonly ChatMessage[];
  readonly followUpProofEdges?: readonly ChatProofEdge[];
  readonly followUpReplayArtifacts?: readonly ChatReplayArtifact[];
  readonly followUpTelemetry?: readonly ChatTelemetryEnvelope[];
}): ChatReducerResult {
  return reduceChatState(args.state, {
    type: 'APPLY_PLAYER_MESSAGE_ACCEPTED',
    now: args.now,
    message: args.message,
    requestId: args.requestId,
    trackPending: args.trackPending,
    proofEdges: args.proofEdges,
    replayArtifacts: args.replayArtifacts,
    telemetry: args.telemetry,
    learningProfile: args.learningProfile,
    inferenceSnapshot: args.inferenceSnapshot,
    audienceHeatDelta: args.audienceHeatDelta,
    stageMood: args.stageMood,
    followUpMessages: args.followUpMessages,
    followUpProofEdges: args.followUpProofEdges,
    followUpReplayArtifacts: args.followUpReplayArtifacts,
    followUpTelemetry: args.followUpTelemetry,
  });
}

export function reduceRejectedPlayerMessage(args: {
  readonly state: ChatState;
  readonly now: UnixMs;
  readonly roomId: ChatRoomId;
  readonly sessionId: ChatSessionId;
  readonly requestId: ChatRequestId;
  readonly telemetry?: readonly ChatTelemetryEnvelope[];
}): ChatReducerResult {
  return reduceChatState(args.state, {
    type: 'APPLY_PLAYER_MESSAGE_REJECTED',
    now: args.now,
    roomId: args.roomId,
    sessionId: args.sessionId,
    requestId: args.requestId,
    telemetry: args.telemetry,
  });
}

export function reduceSystemSignalMutation(args: {
  readonly state: ChatState;
  readonly now: UnixMs;
  readonly roomId: ChatRoomId;
  readonly systemMessages?: readonly ChatMessage[];
  readonly proofEdges?: readonly ChatProofEdge[];
  readonly replayArtifacts?: readonly ChatReplayArtifact[];
  readonly telemetry?: readonly ChatTelemetryEnvelope[];
  readonly stageMood?: ChatRoomState['stageMood'];
  readonly audienceHeatDelta?: number;
  readonly invasion?: ChatInvasionState;
  readonly silence?: ChatSilenceDecision;
}): ChatReducerResult {
  return reduceChatState(args.state, {
    type: 'APPLY_SYSTEM_SIGNAL',
    now: args.now,
    roomId: args.roomId,
    systemMessages: args.systemMessages,
    proofEdges: args.proofEdges,
    replayArtifacts: args.replayArtifacts,
    telemetry: args.telemetry,
    stageMood: args.stageMood,
    audienceHeatDelta: args.audienceHeatDelta,
    invasion: args.invasion,
    silence: args.silence,
  });
}

export function reduceNpcSceneMutation(args: {
  readonly state: ChatState;
  readonly now: UnixMs;
  readonly roomId: ChatRoomId;
  readonly sceneId?: ChatRoomState['activeSceneId'];
  readonly messages?: readonly ChatMessage[];
  readonly delayedMessages?: readonly ChatPendingReveal[];
  readonly proofEdges?: readonly ChatProofEdge[];
  readonly replayArtifacts?: readonly ChatReplayArtifact[];
  readonly telemetry?: readonly ChatTelemetryEnvelope[];
  readonly invasion?: ChatInvasionState;
  readonly silence?: ChatSilenceDecision;
  readonly audienceHeatDelta?: number;
}): ChatReducerResult {
  return reduceChatState(args.state, {
    type: 'APPLY_NPC_SCENE',
    now: args.now,
    roomId: args.roomId,
    sceneId: args.sceneId,
    messages: args.messages,
    delayedMessages: args.delayedMessages,
    proofEdges: args.proofEdges,
    replayArtifacts: args.replayArtifacts,
    telemetry: args.telemetry,
    invasion: args.invasion,
    silence: args.silence,
    audienceHeatDelta: args.audienceHeatDelta,
  });
}

// ============================================================================
// MARK: Query helpers over reducer outputs
// ============================================================================

export function didReducerTouchRoom(result: ChatReducerResult, roomId: ChatRoomId): boolean {
  return result.touchedRoomIds.includes(roomId);
}

export function didReducerTouchSession(result: ChatReducerResult, sessionId: ChatSessionId): boolean {
  return result.touchedSessionIds.includes(sessionId);
}

export function reducerAppendedVisibleSequenceRange(
  result: ChatReducerResult,
  roomId: ChatRoomId,
): readonly [SequenceNumber, SequenceNumber] | null {
  const messages = result.appendedMessages.filter((message) => message.roomId === roomId);
  if (messages.length === 0) {
    return null;
  }

  return [messages[0].sequenceNumber, messages[messages.length - 1].sequenceNumber];
}

export function reducerNetTranscriptGrowth(result: ChatReducerResult): number {
  return result.appendedMessages.length - result.deletedMessageIds.length;
}

export function reducerOpenedOrClosedInvasion(result: ChatReducerResult): boolean {
  return result.openedInvasionIds.length > 0 || result.closedInvasionIds.length > 0;
}

// ============================================================================
// MARK: Internal utility helpers
// ============================================================================

function visibleChannelOrFallback(channelId: ChatMessage['channelId']): ChatVisibleChannel {
  switch (channelId) {
    case 'GLOBAL':
    case 'SYNDICATE':
    case 'DEAL_ROOM':
    case 'LOBBY':
      return channelId;
    default:
      return 'GLOBAL';
  }
}

export function createReplacementMessageFromPrevious(args: {
  readonly state: ChatState;
  readonly messageId: ChatMessageId;
  readonly replacePlainText: string;
}): ChatMessage | null {
  const entry = args.state.transcript.byMessageId[args.messageId] ?? null;
  if (!entry) {
    return null;
  }

  return {
    ...entry.message,
    plainText: args.replacePlainText,
    bodyParts: [{ type: 'TEXT', text: args.replacePlainText }],
  };
}

export function deriveReducerReplayAnchorSequence(
  state: ChatState,
  roomId: ChatRoomId,
): SequenceNumber {
  const latest = selectLatestMessage(state, roomId);
  return latest?.sequenceNumber ?? selectCurrentSequence(state, roomId) ?? asSequenceNumber(0);
}
