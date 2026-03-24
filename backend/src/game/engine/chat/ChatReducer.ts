/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT REDUCER
 * FILE: backend/src/game/engine/chat/ChatReducer.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
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
  type ChatUserId,
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
  reconcileRoomWithMountPolicy,
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

export interface MutableReducerEffect {
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

export function createEffect(state: ChatState): MutableReducerEffect {
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

export function freezeEffect(effect: MutableReducerEffect): ChatReducerResult {
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

export function touchRoom(effect: MutableReducerEffect, roomId: ChatRoomId | null | undefined): void {
  if (roomId) {
    effect.touchedRoomIds.add(roomId);
  }
}

export function touchSession(effect: MutableReducerEffect, sessionId: ChatSessionId | null | undefined): void {
  if (sessionId) {
    effect.touchedSessionIds.add(sessionId);
  }
}

export function pushTelemetry(effect: MutableReducerEffect, telemetry: readonly ChatTelemetryEnvelope[]): void {
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

export function pushProofEdges(effect: MutableReducerEffect, proofEdges: readonly ChatProofEdge[]): void {
  for (const edge of proofEdges) {
    effect.state = appendProofEdge(effect.state, edge);
    effect.proofEdges.push(edge);
    effect.touchedRoomIds.add(edge.roomId);
  }
}

export function pushReplayArtifacts(effect: MutableReducerEffect, artifacts: readonly ChatReplayArtifact[]): void {
  for (const artifact of artifacts) {
    effect.state = appendReplayArtifact(effect.state, artifact);
    effect.replayArtifacts.push(artifact);
    effect.touchedRoomIds.add(artifact.roomId);
  }
}

export function appendMessages(effect: MutableReducerEffect, messages: readonly ChatMessage[]): void {
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

export function applyAction(effect: MutableReducerEffect, action: ChatReducerAction): void {
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

export function reduceUpsertRoom(effect: MutableReducerEffect, room: ChatRoomState): void {
  effect.state = upsertRoom(effect.state, room);
  touchRoom(effect, room.roomId);
}

export function reduceRemoveRoom(effect: MutableReducerEffect, roomId: ChatRoomId): void {
  effect.state = removeRoom(effect.state, roomId);
  touchRoom(effect, roomId);
}

export function reduceUpsertSession(effect: MutableReducerEffect, session: ChatSessionState): void {
  effect.state = upsertSession(effect.state, session);
  touchSession(effect, session.identity.sessionId);
}

export function reduceRemoveSession(effect: MutableReducerEffect, sessionId: ChatSessionId): void {
  effect.state = removeSession(effect.state, sessionId);
  touchSession(effect, sessionId);
}

export function reduceAttachSessionToRoom(
  effect: MutableReducerEffect,
  roomId: ChatRoomId,
  sessionId: ChatSessionId,
): void {
  effect.state = attachSessionToRoom(effect.state, roomId, sessionId);
  touchRoom(effect, roomId);
  touchSession(effect, sessionId);
}

export function reduceDetachSessionFromRoom(
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

export function reduceSetSessionConnectionState(
  effect: MutableReducerEffect,
  sessionId: ChatSessionId,
  connectionState: ChatSessionState['connectionState'],
  now: UnixMs,
): void {
  effect.state = setSessionConnectionState(effect.state, sessionId, connectionState, now);
  touchSession(effect, sessionId);
}

export function reduceSetSessionMuting(
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

export function reduceUpsertPresence(effect: MutableReducerEffect, snapshot: ChatPresenceSnapshot): void {
  effect.state = upsertPresenceSnapshot(effect.state, snapshot);
  touchRoom(effect, snapshot.roomId);
  touchSession(effect, snapshot.sessionId);
}

export function reduceRemovePresence(
  effect: MutableReducerEffect,
  roomId: ChatRoomId,
  sessionId: ChatSessionId,
): void {
  effect.state = removePresenceSnapshot(effect.state, roomId, sessionId);
  touchRoom(effect, roomId);
  touchSession(effect, sessionId);
}

export function reduceUpsertTyping(effect: MutableReducerEffect, snapshot: ChatTypingSnapshot): void {
  effect.state = upsertTypingSnapshot(effect.state, snapshot);
  touchRoom(effect, snapshot.roomId);
  touchSession(effect, snapshot.sessionId);
}

export function reduceClearTyping(
  effect: MutableReducerEffect,
  roomId: ChatRoomId,
  sessionId: ChatSessionId,
  channelId?: ChatVisibleChannel,
): void {
  effect.state = clearTypingSnapshot(effect.state, roomId, sessionId, channelId);
  touchRoom(effect, roomId);
  touchSession(effect, sessionId);
}

export function reduceAppendMessage(effect: MutableReducerEffect, message: ChatMessage): void {
  effect.state = appendTranscriptMessage(effect.state, message);
  effect.appendedMessages.push(message);
  touchRoom(effect, message.roomId);
}

export function reduceReplaceMessage(effect: MutableReducerEffect, message: ChatMessage): void {
  effect.state = replaceTranscriptMessage(effect.state, message);
  effect.replacedMessageIds.push(message.id);
  touchRoom(effect, message.roomId);
}

export function reduceRedactMessage(
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

export function reduceDeleteMessage(
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

export function reduceUpsertPendingRequest(effect: MutableReducerEffect, pending: ChatPendingRequestState): void {
  effect.state = upsertPendingRequest(effect.state, pending);
  effect.processedRequestIds.push(pending.requestId);
  touchRoom(effect, pending.roomId);
  touchSession(effect, pending.sessionId);
}

export function reduceRemovePendingRequest(effect: MutableReducerEffect, requestId: ChatRequestId): void {
  const pending = effect.state.pendingRequests[requestId] ?? null;
  effect.state = removePendingRequest(effect.state, requestId);
  effect.processedRequestIds.push(requestId);
  if (pending) {
    touchRoom(effect, pending.roomId);
    touchSession(effect, pending.sessionId);
  }
}

export function reduceQueuePendingReveal(effect: MutableReducerEffect, reveal: ChatPendingReveal): void {
  effect.state = queuePendingReveal(effect.state, reveal);
  touchRoom(effect, reveal.roomId);
}

export function reduceQueueTelemetry(effect: MutableReducerEffect, telemetry: readonly ChatTelemetryEnvelope[]): void {
  for (const item of telemetry) {
    effect.state = queueTelemetry(effect.state, item);
  }
  pushTelemetry(effect, telemetry);
}

export function reduceUpsertLearningProfile(effect: MutableReducerEffect, profile: ChatLearningProfile): void {
  effect.state = upsertLearningProfile(effect.state, profile);
  effect.learningProfilesTouched.add(profile.userId);
}

export function reduceUpsertInferenceSnapshot(effect: MutableReducerEffect, snapshot: ChatInferenceSnapshot): void {
  effect.state = upsertInferenceSnapshot(effect.state, snapshot);
  effect.inferenceSnapshots.push(snapshot);
  effect.learningProfilesTouched.add(snapshot.userId);
  touchRoom(effect, snapshot.roomId);
}

export function reduceUpsertRelationship(effect: MutableReducerEffect, relationship: ChatRelationshipState): void {
  effect.state = upsertRelationship(effect.state, relationship);
  touchRoom(effect, relationship.roomId);
  effect.learningProfilesTouched.add(relationship.userId);
}

export function reduceSetAudienceHeat(effect: MutableReducerEffect, heat: ChatAudienceHeat): void {
  effect.state = setAudienceHeat(effect.state, heat);
  touchRoom(effect, heat.roomId);
}

export function reduceApplyAudienceHeatDelta(
  effect: MutableReducerEffect,
  roomId: ChatRoomId,
  channelId: ChatVisibleChannel,
  delta: number,
  now: UnixMs,
): void {
  effect.state = applyAudienceHeatDelta(effect.state, roomId, channelId, delta, now);
  touchRoom(effect, roomId);
}

export function reduceSetRoomStageMood(
  effect: MutableReducerEffect,
  roomId: ChatRoomId,
  stageMood: ChatRoomState['stageMood'],
): void {
  effect.state = setRoomStageMood(effect.state, roomId, stageMood);
  touchRoom(effect, roomId);
}

export function reduceSetRoomCollapsed(
  effect: MutableReducerEffect,
  roomId: ChatRoomId,
  collapsed: boolean,
): void {
  effect.state = setRoomCollapsed(effect.state, roomId, collapsed);
  touchRoom(effect, roomId);
}

export function reduceSetRoomScene(
  effect: MutableReducerEffect,
  roomId: ChatRoomId,
  sceneId: ChatRoomState['activeSceneId'],
): void {
  effect.state = setRoomScene(effect.state, roomId, sceneId);
  touchRoom(effect, roomId);
}

export function reduceSetActiveVisibleChannel(
  effect: MutableReducerEffect,
  roomId: ChatRoomId,
  channelId: ChatVisibleChannel,
): void {
  effect.state = setActiveVisibleChannel(effect.state, roomId, channelId);
  touchRoom(effect, roomId);
}

export function reduceResetUnreadByChannel(
  effect: MutableReducerEffect,
  roomId: ChatRoomId,
  channelId: ChatVisibleChannel,
): void {
  effect.state = resetUnreadByChannel(effect.state, roomId, channelId);
  touchRoom(effect, roomId);
}

export function reduceOpenInvasion(effect: MutableReducerEffect, invasion: ChatInvasionState): void {
  effect.state = openInvasion(effect.state, invasion);
  effect.openedInvasionIds.push(invasion.invasionId);
  touchRoom(effect, invasion.roomId);
}

export function reduceCloseInvasion(effect: MutableReducerEffect, invasionId: ChatInvasionId): void {
  const existing = effect.state.activeInvasions[invasionId] ?? null;
  effect.state = closeInvasion(effect.state, invasionId);
  if (existing) {
    effect.closedInvasionIds.push(invasionId);
    touchRoom(effect, existing.roomId);
  }
}

export function reduceSetSilence(
  effect: MutableReducerEffect,
  roomId: ChatRoomId,
  silence: ChatSilenceDecision,
): void {
  effect.state = setSilenceDecision(effect.state, roomId, silence);
  touchRoom(effect, roomId);
}

export function reduceClearSilence(effect: MutableReducerEffect, roomId: ChatRoomId): void {
  effect.state = clearSilenceDecision(effect.state, roomId);
  touchRoom(effect, roomId);
}

export function reduceMarkRoomEvent(
  effect: MutableReducerEffect,
  roomId: ChatRoomId,
  eventId: ChatState['lastEventByRoom'][ChatRoomId],
  now: UnixMs,
): void {
  effect.state = markLastRoomEvent(effect.state, roomId, eventId, now);
  touchRoom(effect, roomId);
}

export function reduceMaintenanceTick(effect: MutableReducerEffect, now: UnixMs, flushTelemetryFlag: boolean): void {
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

export function reduceApplyJoinAccepted(
  effect: MutableReducerEffect,
  action: Extract<ChatReducerSemanticAction, { type: 'APPLY_JOIN_ACCEPTED' }>,
): void {
  const sessionId = action.request.session.sessionId;
  const roomId = action.request.roomId;

  const existingRoom = effect.state.rooms[roomId] ?? null;
  const roomState = existingRoom
    ? reconcileRoomWithMountPolicy(
        existingRoom,
        action.request.mountTarget,
        action.request.requestedVisibleChannel,
      )
    : createChatRoomState({
        roomId: action.request.roomId,
        roomKind: action.request.roomKind,
        title: action.request.title,
        now: action.now,
        mountTarget: action.request.mountTarget,
        requestedVisibleChannel: action.request.requestedVisibleChannel,
      });

  if (!existingRoom || roomState !== existingRoom) {
    applyAction(effect, {
      type: 'UPSERT_ROOM',
      room: roomState,
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

export function reduceApplyJoinRejected(
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

export function reduceApplyLeaveAccepted(
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

export function reduceApplyPlayerMessageAccepted(
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

export function reduceApplyPlayerMessageRejected(
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

export function reduceApplySystemSignal(
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

export function reduceApplyNpcScene(
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

export function visibleChannelOrFallback(channelId: ChatMessage['channelId']): ChatVisibleChannel {
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

// ============================================================================
// MARK: Watch bus
// ============================================================================

export interface ChatReducerWatchEvent {
  readonly kind: 'message_appended' | 'message_deleted' | 'session_joined' | 'session_left' | 'invasion_opened' | 'invasion_closed';
  readonly roomId: ChatRoomId;
  readonly at: UnixMs;
  readonly payload: Readonly<Record<string, unknown>>;
}

export type ChatReducerWatchHandler = (event: ChatReducerWatchEvent) => void;

export class ChatReducerWatchBus {
  private readonly handlers: ChatReducerWatchHandler[] = [];

  subscribe(handler: ChatReducerWatchHandler): () => void {
    this.handlers.push(handler);
    return () => {
      const idx = this.handlers.indexOf(handler);
      if (idx >= 0) this.handlers.splice(idx, 1);
    };
  }

  emit(event: ChatReducerWatchEvent): void {
    for (const h of this.handlers) {
      try { h(event); } catch { /* isolated */ }
    }
  }

  get listenerCount(): number {
    return this.handlers.length;
  }
}

// ============================================================================
// MARK: Reducer fingerprint
// ============================================================================

export interface ChatReducerFingerprint {
  readonly roomId: ChatRoomId;
  readonly lastSequence: number;
  readonly appendedCount: number;
  readonly deletedCount: number;
  readonly invasionChange: boolean;
  readonly computedAt: UnixMs;
}

export function computeReducerFingerprint(
  roomId: ChatRoomId,
  result: ChatReducerResult,
  state: ChatState,
  now: UnixMs,
): ChatReducerFingerprint {
  const lastSeq = deriveReducerReplayAnchorSequence(state, roomId);
  return Object.freeze({
    roomId,
    lastSequence: lastSeq as unknown as number,
    appendedCount: result.appendedMessages.length,
    deletedCount: result.deletedMessageIds.length,
    invasionChange: reducerOpenedOrClosedInvasion(result),
    computedAt: now,
  });
}

// ============================================================================
// MARK: Epoch tracker
// ============================================================================

export interface ChatReducerEpochEntry {
  readonly roomId: ChatRoomId;
  readonly fingerprint: ChatReducerFingerprint;
  readonly at: UnixMs;
}

export class ChatReducerEpochTracker {
  private readonly epochs = new Map<ChatRoomId, ChatReducerEpochEntry[]>();

  record(roomId: ChatRoomId, fp: ChatReducerFingerprint, at: UnixMs): void {
    if (!this.epochs.has(roomId)) this.epochs.set(roomId, []);
    this.epochs.get(roomId)!.push({ roomId, fingerprint: fp, at });
  }

  getHistory(roomId: ChatRoomId): readonly ChatReducerEpochEntry[] {
    return this.epochs.get(roomId) ?? [];
  }

  getLastEntry(roomId: ChatRoomId): ChatReducerEpochEntry | null {
    const arr = this.epochs.get(roomId);
    return arr?.[arr.length - 1] ?? null;
  }

  listRoomIds(): readonly ChatRoomId[] {
    return Object.freeze([...this.epochs.keys()]);
  }

  clear(roomId: ChatRoomId): void {
    this.epochs.delete(roomId);
  }
}

// ============================================================================
// MARK: Result inspection utilities
// ============================================================================

export function reducerResultHasNewMessages(result: ChatReducerResult): boolean {
  return result.appendedMessages.length > 0;
}

export function reducerResultHasDeletions(result: ChatReducerResult): boolean {
  return result.deletedMessageIds.length > 0;
}

export function reducerResultHasSessionChanges(result: ChatReducerResult): boolean {
  return result.touchedSessionIds.length > 0;
}

export function reducerResultHasInvasionChanges(result: ChatReducerResult): boolean {
  return reducerOpenedOrClosedInvasion(result);
}

export function reducerResultMessageIds(result: ChatReducerResult): readonly ChatMessageId[] {
  return result.appendedMessages.map((m) => m.id);
}

export function reducerResultTouchedSessionIds(result: ChatReducerResult): readonly ChatSessionId[] {
  return result.touchedSessionIds;
}

export function reducerResultOpenedInvasionIds(result: ChatReducerResult): readonly ChatInvasionId[] {
  return result.openedInvasionIds;
}

export function reducerResultClosedInvasionIds(result: ChatReducerResult): readonly ChatInvasionId[] {
  return result.closedInvasionIds;
}

// ============================================================================
// MARK: Module descriptor
// ============================================================================

export const CHAT_REDUCER_MODULE_ID = 'chat_reducer' as const;
export const CHAT_REDUCER_MODULE_VERSION = '2026.03.14' as const;

export const CHAT_REDUCER_MODULE_DESCRIPTOR = Object.freeze({
  moduleId: CHAT_REDUCER_MODULE_ID,
  version: CHAT_REDUCER_MODULE_VERSION,
  capabilities: Object.freeze([
    'message_append',
    'message_delete',
    'session_join',
    'session_leave',
    'invasion_open',
    'invasion_close',
    'proof_append',
    'replay_append',
    'learning_update',
    'heat_update',
    'epoch_tracking',
    'fingerprinting',
    'watch_bus',
  ]),
});

// ============================================================================
// MARK: Extended module namespace
// ============================================================================

export namespace ChatReducerModuleExtended {
  export type WatchBus = ChatReducerWatchBus;
  export type WatchEvent = ChatReducerWatchEvent;
  export type Fingerprint = ChatReducerFingerprint;
  export type EpochTracker = ChatReducerEpochTracker;

  export function createWatchBus(): ChatReducerWatchBus {
    return new ChatReducerWatchBus();
  }

  export function createEpochTracker(): ChatReducerEpochTracker {
    return new ChatReducerEpochTracker();
  }

  export function describe(): string {
    return `${CHAT_REDUCER_MODULE_ID}@${CHAT_REDUCER_MODULE_VERSION}`;
  }
}

// ============================================================================
// MARK: State inspection helpers exposed for consumers
// ============================================================================

export function reducerGetRoomAudienceHeat(state: ChatState, roomId: ChatRoomId): ChatAudienceHeat | null {
  return state.audienceHeatByRoom[roomId] ?? null;
}

export function reducerGetInvasionState(state: ChatState, invasionId: ChatInvasionId): ChatInvasionState | null {
  return state.activeInvasions[invasionId] ?? null;
}

export function reducerGetRoomSilenceDecision(state: ChatState, roomId: ChatRoomId): ChatSilenceDecision | null {
  return state.silencesByRoom[roomId] ?? null;
}

export function reducerGetRoomSessionCount(state: ChatState, roomId: ChatRoomId): number {
  return state.roomSessions.byRoom[roomId]?.length ?? 0;
}

export function reducerGetRoomMessageCount(state: ChatState, roomId: ChatRoomId): number {
  return state.transcript.byRoom[roomId]?.length ?? 0;
}

export function reducerGetInferenceSnapshots(state: ChatState, roomId: ChatRoomId, userId: string): readonly ChatInferenceSnapshot[] {
  return Object.values(state.inferenceSnapshots).filter(
    (s) => s.userId === (userId as ChatUserId) && s.roomId === roomId,
  );
}

export function reducerGetLearningProfile(state: ChatState, _roomId: ChatRoomId, userId: string): ChatLearningProfile | null {
  return state.learningProfiles[userId as ChatUserId] ?? null;
}

export function reducerGetPresenceSnapshot(state: ChatState, roomId: ChatRoomId, sessionId: ChatSessionId): ChatPresenceSnapshot | null {
  return state.presence.byRoom[roomId]?.[sessionId] ?? null;
}

export function reducerGetTypingSnapshot(state: ChatState, roomId: ChatRoomId, sessionId: ChatSessionId): ChatTypingSnapshot | null {
  return state.typing.byRoom[roomId]?.find((s) => s.sessionId === sessionId) ?? null;
}

export function reducerGetRelationshipState(state: ChatState, relationshipId: ChatRelationshipId): ChatRelationshipState | null {
  return state.relationships[relationshipId] ?? null;
}

export function reducerGetReplayArtifact(state: ChatState, roomId: ChatRoomId, index: number): ChatReplayArtifact | null {
  return state.replay.byRoom[roomId]?.[index] ?? null;
}

export function reducerGetPendingRequestState(state: ChatState, _roomId: ChatRoomId, requestId: ChatRequestId): ChatPendingRequestState | null {
  return state.pendingRequests[requestId] ?? null;
}

export function reducerGetPendingReveal(state: ChatState, _roomId: ChatRoomId, messageId: ChatMessageId): ChatPendingReveal | null {
  return state.pendingReveals.find((r) => r.message.id === messageId) ?? null;
}

export function reducerGetProofEdge(state: ChatState, roomId: ChatRoomId, edgeId: string): ChatProofEdge | null {
  const edges = state.proofChain.byRoom[roomId] ?? [];
  return edges.find((e) => (e.id as string) === edgeId) ?? null;
}

export function reducerGetTelemetryEnvelope(state: ChatState, _roomId: ChatRoomId, index: number): ChatTelemetryEnvelope | null {
  return state.telemetryQueue[index] ?? null;
}

export function reducerGetRoomState(state: ChatState, roomId: ChatRoomId): ChatRoomState | null {
  return state.rooms[roomId] ?? null;
}

export function reducerGetSessionState(state: ChatState, _roomId: ChatRoomId, sessionId: ChatSessionId): ChatSessionState | null {
  return state.sessions[sessionId] ?? null;
}

export function reducerGetJoinRequest(_state: ChatState, _roomId: ChatRoomId, _sessionId: ChatSessionId): ChatJoinRequest | null {
  return null;
}

export function reducerGetLeaveRequest(_state: ChatState, _roomId: ChatRoomId, _sessionId: ChatSessionId): ChatLeaveRequest | null {
  return null;
}

export function reducerGetVisibleChannelUnread(state: ChatState, roomId: ChatRoomId, channel: ChatVisibleChannel): number {
  return state.rooms[roomId]?.unreadByChannel?.[channel] ?? 0;
}

export function reducerSequenceAsNumber(seq: SequenceNumber): number {
  return seq as unknown as number;
}

// ============================================================================
// MARK: UX-focused computed state helpers
// ============================================================================

/**
 * Sum all unread counts across all visible channels in a room.
 * Used to drive badge counts, attention indicators, and notification dots.
 */
export function reducerComputeRoomUnreadCount(state: ChatState, roomId: ChatRoomId): number {
  const room = state.rooms[roomId];
  if (!room) return 0;
  const byChannel = (room.unreadByChannel ?? {}) as Record<string, number | undefined>;
  return Object.values(byChannel).reduce((sum, n) => sum + (n ?? 0), 0);
}

/**
 * Count of sessions that have a live presence snapshot in a room.
 * Drives "X people here" occupancy UI for deal rooms, lobbies, and global.
 */
export function reducerComputeRoomPresenceCount(state: ChatState, roomId: ChatRoomId): number {
  return Object.keys(state.presence.byRoom[roomId] ?? {}).length;
}

/**
 * Count of sessions currently showing a typing indicator in a room.
 * Used to control the typing bubble visiblity and pulse animation.
 */
export function reducerComputeRoomTypingCount(state: ChatState, roomId: ChatRoomId): number {
  return (state.typing.byRoom[roomId] ?? []).length;
}

/**
 * All roomIds a session is currently attached to.
 * Used to efficiently compute session-scope notifications and cross-room state.
 */
export function reducerComputeSessionRoomIds(state: ChatState, sessionId: ChatSessionId): readonly ChatRoomId[] {
  return (state.roomSessions as unknown as Record<string, Record<string, string[]>>).bySession?.[sessionId] as unknown as readonly ChatRoomId[] ?? [];
}

/**
 * All live presence snapshots for a room, as an ordered array.
 * Used to render participant panels, avatars, and spectator lists.
 */
export function reducerComputeActivePresenceList(
  state: ChatState,
  roomId: ChatRoomId,
): readonly ChatPresenceSnapshot[] {
  const bySession = state.presence.byRoom[roomId] ?? ({} as Record<ChatSessionId, ChatPresenceSnapshot>);
  return Object.values(bySession).filter((s): s is ChatPresenceSnapshot => !!s);
}

/**
 * Display names of sessions actively typing in a given channel.
 * Drives the "{name} is typing..." footer text shown to all room participants.
 */
export function reducerComputeTypingActorLabels(
  state: ChatState,
  roomId: ChatRoomId,
  channelId: ChatVisibleChannel,
): readonly string[] {
  return (state.typing.byRoom[roomId] ?? [])
    .filter((s) => s.channelId === channelId && s.mode === 'TYPING')
    .map((s) => {
      const presence = state.presence.byRoom[roomId]?.[s.sessionId];
      return presence?.actorLabel ?? (s.sessionId as string);
    });
}

/**
 * Whether any active invasion is targeting a given room.
 * Used to drive alert banners, invasion overlays, and room state coloring.
 */
export function reducerComputeRoomHasActiveInvasion(state: ChatState, roomId: ChatRoomId): boolean {
  return Object.values(state.activeInvasions).some((inv) => inv?.roomId === roomId);
}

/**
 * All active invasion records for a given room.
 * Used to render stacked invasion notices and determine escalation level.
 */
export function reducerComputeRoomActiveInvasions(state: ChatState, roomId: ChatRoomId): readonly ChatInvasionState[] {
  return Object.values(state.activeInvasions).filter(
    (inv): inv is ChatInvasionState => !!(inv) && inv.roomId === roomId,
  );
}

/**
 * Whether a silence decision currently exists for a room (expiry not evaluated here).
 * Used to prevent user input and show "room is silenced" banners immediately.
 */
export function reducerComputeIsRoomSilenced(state: ChatState, roomId: ChatRoomId, _now: UnixMs): boolean {
  return !!(state.silencesByRoom[roomId]);
}

/**
 * Whether a session has a live presence snapshot in a specific room.
 * Used to gate chat input UI and mark sessions as "in room" vs. "spectating".
 */
export function reducerComputeSessionIsPresent(
  state: ChatState,
  roomId: ChatRoomId,
  sessionId: ChatSessionId,
): boolean {
  return !!(state.presence.byRoom[roomId]?.[sessionId]);
}

/**
 * Most recent non-deleted message in a specific visible channel.
 * Used to render channel previews, last-message footers, and reply targets.
 */
export function reducerComputeLatestMessageInChannel(
  state: ChatState,
  roomId: ChatRoomId,
  channelId: ChatVisibleChannel,
): ChatMessage | null {
  const entries = state.transcript.byRoom[roomId] ?? [];
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry?.message.channelId === channelId) {
      return entry.message;
    }
  }
  return null;
}

/**
 * Latest N non-deleted messages in a room, ordered oldest-first.
 * Used to populate initial chat window renders without scanning the full transcript.
 */
export function reducerComputeRecentMessages(
  state: ChatState,
  roomId: ChatRoomId,
  limit: number,
): readonly ChatMessage[] {
  const entries = state.transcript.byRoom[roomId] ?? [];
  const result: ChatMessage[] = [];
  for (let i = entries.length - 1; i >= 0 && result.length < limit; i--) {
    const entry = entries[i];
    if (entry) {
      result.unshift(entry.message);
    }
  }
  return result;
}

/**
 * Timestamp of the last known activity in a room.
 * Used to sort room list by recency, highlight newly active rooms.
 */
export function reducerComputeRoomLastActivityTime(
  state: ChatState,
  roomId: ChatRoomId,
): UnixMs | null {
  return (state.rooms[roomId] as unknown as Record<string, UnixMs | undefined>)?.lastActivityAt ?? null;
}

/**
 * Current connection state of a session.
 * Drives session icon state (online dot, disconnected, idle) across all room panels.
 */
export function reducerComputeSessionConnectionState(
  state: ChatState,
  sessionId: ChatSessionId,
): ChatSessionState['connectionState'] | null {
  return state.sessions[sessionId]?.connectionState ?? null;
}

/**
 * Ratio of current presence count to a given max occupancy ceiling (clamped 0–1).
 * Used to render room fullness progress bars and soft-cap warning indicators.
 */
export function reducerComputeRoomOccupancyRatio(
  state: ChatState,
  roomId: ChatRoomId,
  maxOccupants: number,
): number {
  if (maxOccupants <= 0) return 0;
  const count = reducerComputeRoomPresenceCount(state, roomId);
  return Math.min(1, count / maxOccupants);
}

/**
 * Number of pending delayed-reveal messages queued for a room.
 * Used to display a "pending messages" indicator and control NPC scene timing.
 */
export function reducerComputePendingRevealCount(state: ChatState, roomId: ChatRoomId): number {
  return state.pendingReveals.filter((r) => r.roomId === roomId).length;
}

/**
 * Total number of proof edges anchored to a room's proof chain.
 * Used in audit UIs and replay verification views.
 */
export function reducerComputeProofChainLength(state: ChatState, roomId: ChatRoomId): number {
  return state.proofChain.byRoom[roomId]?.length ?? 0;
}

/**
 * All relationship records owned by a given user.
 * Used to drive the relationship graph panel and trust/distrust indicators.
 */
export function reducerComputeRelationshipsByUser(
  state: ChatState,
  userId: ChatUserId,
): readonly ChatRelationshipState[] {
  return Object.values(state.relationships).filter(
    (r): r is ChatRelationshipState => !!(r) && r.userId === userId,
  );
}

/**
 * Active scene id for a room.
 * Used to synchronize scene transitions across connected viewers in deal rooms.
 */
export function reducerComputeRoomSceneId(
  state: ChatState,
  roomId: ChatRoomId,
): ChatRoomState['activeSceneId'] | null {
  return state.rooms[roomId]?.activeSceneId ?? null;
}

/**
 * Current stage mood for a room.
 * Used to drive ambient audio, background color shifts, and NPC tone transitions.
 */
export function reducerComputeRoomStageMood(
  state: ChatState,
  roomId: ChatRoomId,
): ChatRoomState['stageMood'] | null {
  return state.rooms[roomId]?.stageMood ?? null;
}

/**
 * Whether a room's panel is currently in collapsed (minimized) state.
 * Used to control room card expansion and preserve layout intent across refreshes.
 */
export function reducerComputeIsRoomCollapsed(state: ChatState, roomId: ChatRoomId): boolean {
  return state.rooms[roomId]?.collapsed ?? false;
}

/**
 * The currently active visible channel for a room.
 * Used to focus the message input, filter the transcript, and route typing events.
 */
export function reducerComputeActiveVisibleChannel(
  state: ChatState,
  roomId: ChatRoomId,
): ChatVisibleChannel {
  return state.rooms[roomId]?.activeVisibleChannel ?? 'GLOBAL';
}

/**
 * Full mute and visibility status for a session at a given moment.
 * Used to gate message submission, dim user avatars, and show "you are muted" notices.
 */
export function reducerComputeSessionMuteStatus(
  state: ChatState,
  sessionId: ChatSessionId,
  now: UnixMs,
): { readonly muted: boolean; readonly shadowMuted: boolean; readonly invisible: boolean } {
  const session = state.sessions[sessionId];
  if (!session) return { muted: false, shadowMuted: false, invisible: false };
  return Object.freeze({
    muted: session.mutedUntil != null && session.mutedUntil > now,
    shadowMuted: (session as unknown as Record<string, boolean>).shadowMuted ?? false,
    invisible: (session as unknown as Record<string, boolean>).invisible ?? false,
  });
}

/**
 * All inference snapshots for a given userId across all rooms.
 * Used to render the player model panel and animate learning signal visualizations.
 */
export function reducerComputeInferenceSnapshotsByUser(
  state: ChatState,
  userId: ChatUserId,
): readonly ChatInferenceSnapshot[] {
  return Object.values(state.inferenceSnapshots).filter(
    (s): s is ChatInferenceSnapshot => !!(s) && s.userId === userId,
  );
}

/**
 * Whether a pending request exists in the current state for the given requestId.
 * Used to show optimistic "sending..." state and detect double-submission attempts.
 */
export function reducerComputeHasPendingRequest(
  state: ChatState,
  requestId: ChatRequestId,
): boolean {
  return !!(state.pendingRequests[requestId]);
}

/**
 * Total number of replay artifacts recorded for a room.
 * Used to determine replay availability and build replay scrubber bounds.
 */
export function reducerComputeReplayDepth(state: ChatState, roomId: ChatRoomId): number {
  return state.replay.byRoom[roomId]?.length ?? 0;
}

/**
 * All room IDs present in the current state.
 * Used to enumerate active rooms for presence sweeps, telemetry, and room list renders.
 */
export function reducerComputeAllRoomIds(state: ChatState): readonly ChatRoomId[] {
  return Object.keys(state.rooms) as unknown as readonly ChatRoomId[];
}

/**
 * All session IDs present in the current state.
 * Used to enumerate connected participants for connection audits and sweep operations.
 */
export function reducerComputeAllSessionIds(state: ChatState): readonly ChatSessionId[] {
  return Object.keys(state.sessions) as unknown as readonly ChatSessionId[];
}

/**
 * First and last sequence numbers of the transcript in a room.
 * Used to compute scroll anchors, jump-to-bottom targets, and replay range labels.
 */
export function reducerComputeRoomTranscriptRange(
  state: ChatState,
  roomId: ChatRoomId,
): { readonly first: SequenceNumber | null; readonly last: SequenceNumber | null } {
  const entries = state.transcript.byRoom[roomId] ?? [];
  if (entries.length === 0) return { first: null, last: null };
  const firstEntry = entries[0];
  const lastEntry = entries[entries.length - 1];
  return Object.freeze({
    first: firstEntry?.message.sequenceNumber ?? null,
    last: lastEntry?.message.sequenceNumber ?? null,
  });
}

/**
 * Count of messages sent by a specific session in a room.
 * Used for per-user contribution meters in competitive syndicate rooms.
 */
export function reducerComputeSessionMessageCount(
  state: ChatState,
  roomId: ChatRoomId,
  sessionId: ChatSessionId,
): number {
  const entries = state.transcript.byRoom[roomId] ?? [];
  let count = 0;
  for (const entry of entries) {
    if (entry?.message.attribution.authorSessionId === sessionId) {
      count++;
    }
  }
  return count;
}

/**
 * Whether a room currently exists in state (not removed).
 * Used in guards before attempting room-specific operations in derived hooks.
 */
export function reducerComputeRoomExists(state: ChatState, roomId: ChatRoomId): boolean {
  return !!(state.rooms[roomId]);
}

/**
 * Whether a session currently exists in state (not removed).
 * Used in guards before attempting session-specific UI or telemetry operations.
 */
export function reducerComputeSessionExists(state: ChatState, sessionId: ChatSessionId): boolean {
  return !!(state.sessions[sessionId]);
}

/**
 * Current room kind for a given roomId.
 * Used to conditionally render room-type-specific UI (lobby vs. deal_room vs. syndicate).
 */
export function reducerComputeRoomKind(
  state: ChatState,
  roomId: ChatRoomId,
): ChatRoomState['roomKind'] | null {
  return state.rooms[roomId]?.roomKind ?? null;
}

/**
 * Count of open invasion records across ALL rooms.
 * Used for global alert badges and engine-level capacity throttling checks.
 */
export function reducerComputeTotalActiveInvasionCount(state: ChatState): number {
  return Object.keys(state.activeInvasions).length;
}

/**
 * All learning profile IDs currently stored in state.
 * Used to determine which user models have accumulated enough signal for inference.
 */
export function reducerComputeAllLearningProfileUserIds(state: ChatState): readonly ChatUserId[] {
  return Object.keys(state.learningProfiles) as unknown as readonly ChatUserId[];
}

/**
 * Number of messages currently in the telemetry flush queue.
 * Used to determine whether to trigger an early flush before a maintenance tick.
 */
export function reducerComputeTelemetryQueueDepth(state: ChatState): number {
  return state.telemetryQueue.length;
}

// ============================================================================
// MARK: Diagnostic observability helpers
// ============================================================================

/**
 * Compact cross-sectional summary of the entire chat state volume.
 * Used by the engine health endpoint, admin debug panels, and load dashboards.
 */
export interface ChatReducerStateSummary {
  readonly roomCount: number;
  readonly sessionCount: number;
  readonly transcriptMessageCount: number;
  readonly activeInvasionCount: number;
  readonly pendingRevealCount: number;
  readonly proofEdgeTotal: number;
  readonly telemetryQueueDepth: number;
  readonly learningProfileCount: number;
  readonly inferenceSnapshotCount: number;
  readonly relationshipCount: number;
  readonly pendingRequestCount: number;
  readonly replayArtifactTotal: number;
}

export function reducerComputeStateSummary(state: ChatState): ChatReducerStateSummary {
  const transcriptMessageCount = Object.keys(state.transcript.byMessageId).length;
  const proofEdgeTotal = Object.values(state.proofChain.byRoom).reduce(
    (sum, arr) => sum + (arr?.length ?? 0),
    0,
  );
  const replayArtifactTotal = Object.values(state.replay.byRoom).reduce(
    (sum, arr) => sum + (arr?.length ?? 0),
    0,
  );
  return Object.freeze({
    roomCount: Object.keys(state.rooms).length,
    sessionCount: Object.keys(state.sessions).length,
    transcriptMessageCount,
    activeInvasionCount: Object.keys(state.activeInvasions).length,
    pendingRevealCount: state.pendingReveals.length,
    proofEdgeTotal,
    telemetryQueueDepth: state.telemetryQueue.length,
    learningProfileCount: Object.keys(state.learningProfiles).length,
    inferenceSnapshotCount: Object.keys(state.inferenceSnapshots).length,
    relationshipCount: Object.keys(state.relationships).length,
    pendingRequestCount: Object.keys(state.pendingRequests).length,
    replayArtifactTotal,
  });
}

/**
 * Full per-room diagnostic record covering all mutable state categories.
 * Used by admin room inspection tooling, alerting pipelines, and engine invariant checks.
 */
export interface ChatReducerRoomDiagnostic {
  readonly roomId: ChatRoomId;
  readonly roomKind: ChatRoomState['roomKind'] | null;
  readonly sessionCount: number;
  readonly presenceCount: number;
  readonly typingCount: number;
  readonly messageCount: number;
  readonly unreadTotal: number;
  readonly hasActiveInvasion: boolean;
  readonly isSilenced: boolean;
  readonly pendingRevealCount: number;
  readonly replayDepth: number;
  readonly proofChainLength: number;
  readonly stageMood: ChatRoomState['stageMood'] | null;
  readonly activeScene: ChatRoomState['activeSceneId'] | null;
  readonly collapsed: boolean;
  readonly activeChannel: ChatVisibleChannel;
  readonly lastActivityAt: UnixMs | null;
  readonly occupancyRatio: number;
}

export function reducerComputeRoomDiagnostic(
  state: ChatState,
  roomId: ChatRoomId,
  now: UnixMs,
  maxOccupants = 100,
): ChatReducerRoomDiagnostic {
  return Object.freeze({
    roomId,
    roomKind: reducerComputeRoomKind(state, roomId),
    sessionCount: reducerGetRoomSessionCount(state, roomId),
    presenceCount: reducerComputeRoomPresenceCount(state, roomId),
    typingCount: reducerComputeRoomTypingCount(state, roomId),
    messageCount: reducerGetRoomMessageCount(state, roomId),
    unreadTotal: reducerComputeRoomUnreadCount(state, roomId),
    hasActiveInvasion: reducerComputeRoomHasActiveInvasion(state, roomId),
    isSilenced: reducerComputeIsRoomSilenced(state, roomId, now),
    pendingRevealCount: reducerComputePendingRevealCount(state, roomId),
    replayDepth: reducerComputeReplayDepth(state, roomId),
    proofChainLength: reducerComputeProofChainLength(state, roomId),
    stageMood: reducerComputeRoomStageMood(state, roomId),
    activeScene: reducerComputeRoomSceneId(state, roomId),
    collapsed: reducerComputeIsRoomCollapsed(state, roomId),
    activeChannel: reducerComputeActiveVisibleChannel(state, roomId),
    lastActivityAt: reducerComputeRoomLastActivityTime(state, roomId),
    occupancyRatio: reducerComputeRoomOccupancyRatio(state, roomId, maxOccupants),
  });
}

/**
 * Diagnostic records for every room currently in state.
 * Used by the engine's health broadcast and admin dashboard fleet view.
 */
export function reducerComputeAllRoomDiagnostics(
  state: ChatState,
  now: UnixMs,
  maxOccupants = 100,
): readonly ChatReducerRoomDiagnostic[] {
  return reducerComputeAllRoomIds(state).map((roomId) =>
    reducerComputeRoomDiagnostic(state, roomId, now, maxOccupants),
  );
}

/**
 * Determine whether a result represents a complete no-op (nothing was touched).
 * Used to skip downstream dispatch when batched actions produce no state change.
 */
export function reducerResultIsNoOp(result: ChatReducerResult): boolean {
  return (
    result.touchedRoomIds.length === 0 &&
    result.touchedSessionIds.length === 0 &&
    result.appendedMessages.length === 0 &&
    result.replacedMessageIds.length === 0 &&
    result.redactedMessageIds.length === 0 &&
    result.deletedMessageIds.length === 0 &&
    result.replayArtifacts.length === 0 &&
    result.proofEdges.length === 0 &&
    result.telemetry.length === 0 &&
    result.openedInvasionIds.length === 0 &&
    result.closedInvasionIds.length === 0 &&
    result.processedRequestIds.length === 0 &&
    result.revealedMessages.length === 0
  );
}

/**
 * Serialize a result's key mutation vectors as a compact diagnostic label.
 * Used in debug logs, tracing spans, and replay event metadata.
 */
export function reducerResultLabel(result: ChatReducerResult): string {
  const parts: string[] = [];
  if (result.appendedMessages.length > 0) parts.push(`+${result.appendedMessages.length}msg`);
  if (result.deletedMessageIds.length > 0) parts.push(`-${result.deletedMessageIds.length}del`);
  if (result.redactedMessageIds.length > 0) parts.push(`~${result.redactedMessageIds.length}redact`);
  if (result.openedInvasionIds.length > 0) parts.push(`invasion:open(${result.openedInvasionIds.length})`);
  if (result.closedInvasionIds.length > 0) parts.push(`invasion:close(${result.closedInvasionIds.length})`);
  if (result.proofEdges.length > 0) parts.push(`proof:${result.proofEdges.length}`);
  if (result.telemetry.length > 0) parts.push(`telemetry:${result.telemetry.length}`);
  if (result.revealedMessages.length > 0) parts.push(`reveal:${result.revealedMessages.length}`);
  if (parts.length === 0) return 'noop';
  return parts.join(' ');
}

/**
 * Merge the mutations from two results into a single logical summary.
 * Used when replaying batched history to produce a unified change envelope.
 */
export function reducerResultMerge(
  a: ChatReducerResult,
  b: ChatReducerResult,
): Omit<ChatReducerResult, 'state'> {
  return {
    touchedRoomIds: [...new Set([...a.touchedRoomIds, ...b.touchedRoomIds])],
    touchedSessionIds: [...new Set([...a.touchedSessionIds, ...b.touchedSessionIds])],
    appendedMessages: [...a.appendedMessages, ...b.appendedMessages],
    replacedMessageIds: [...a.replacedMessageIds, ...b.replacedMessageIds],
    redactedMessageIds: [...a.redactedMessageIds, ...b.redactedMessageIds],
    deletedMessageIds: [...a.deletedMessageIds, ...b.deletedMessageIds],
    replayArtifacts: [...a.replayArtifacts, ...b.replayArtifacts],
    proofEdges: [...a.proofEdges, ...b.proofEdges],
    telemetry: [...a.telemetry, ...b.telemetry],
    learningProfilesTouched: [...new Set([...a.learningProfilesTouched, ...b.learningProfilesTouched])],
    inferenceSnapshots: [...a.inferenceSnapshots, ...b.inferenceSnapshots],
    openedInvasionIds: [...a.openedInvasionIds, ...b.openedInvasionIds],
    closedInvasionIds: [...a.closedInvasionIds, ...b.closedInvasionIds],
    processedRequestIds: [...a.processedRequestIds, ...b.processedRequestIds],
    revealedMessages: [...a.revealedMessages, ...b.revealedMessages],
  };
}

// ============================================================================
// MARK: Factory functions
// ============================================================================

export function createReducerWatchBus(): ChatReducerWatchBus {
  return new ChatReducerWatchBus();
}

export function createReducerEpochTracker(): ChatReducerEpochTracker {
  return new ChatReducerEpochTracker();
}

export function describeReducerModule(): string {
  return `${CHAT_REDUCER_MODULE_ID}@${CHAT_REDUCER_MODULE_VERSION}`;
}

export const CHAT_REDUCER_FULL_MODULE = Object.freeze({
  descriptor: CHAT_REDUCER_MODULE_DESCRIPTOR,
  createWatchBus: () => new ChatReducerWatchBus(),
  createEpochTracker: () => new ChatReducerEpochTracker(),
  computeFingerprint: computeReducerFingerprint,
  resultHasNewMessages: reducerResultHasNewMessages,
  resultHasDeletions: reducerResultHasDeletions,
  resultHasSessionChanges: reducerResultHasSessionChanges,
  resultHasInvasionChanges: reducerResultHasInvasionChanges,
});

// ============================================================================
// MARK: Comprehensive module authority object
// ============================================================================

export const ChatReducerModule = Object.freeze({
  // ── Identity ────────────────────────────────────────────────────────────
  moduleId: CHAT_REDUCER_MODULE_ID,
  version: CHAT_REDUCER_MODULE_VERSION,
  descriptor: CHAT_REDUCER_MODULE_DESCRIPTOR,

  // ── Core entry points ───────────────────────────────────────────────────
  reduceChatState,
  reduceChatStateBatch,

  // ── High-level semantic wrappers ────────────────────────────────────────
  reduceJoinRequestAccepted,
  reduceLeaveRequestAccepted,
  reducePresenceUpdate,
  reduceTypingUpdate,
  reduceAcceptedPlayerMessage,
  reduceRejectedPlayerMessage,
  reduceSystemSignalMutation,
  reduceNpcSceneMutation,

  // ── Primitive reducers — room ────────────────────────────────────────────
  reduceUpsertRoom,
  reduceRemoveRoom,
  reduceSetRoomStageMood,
  reduceSetRoomCollapsed,
  reduceSetRoomScene,
  reduceSetActiveVisibleChannel,
  reduceResetUnreadByChannel,
  reduceMarkRoomEvent,

  // ── Primitive reducers — session ─────────────────────────────────────────
  reduceUpsertSession,
  reduceRemoveSession,
  reduceAttachSessionToRoom,
  reduceDetachSessionFromRoom,
  reduceSetSessionConnectionState,
  reduceSetSessionMuting,

  // ── Primitive reducers — presence & typing ───────────────────────────────
  reduceUpsertPresence,
  reduceRemovePresence,
  reduceUpsertTyping,
  reduceClearTyping,

  // ── Primitive reducers — transcript ──────────────────────────────────────
  reduceAppendMessage,
  reduceReplaceMessage,
  reduceRedactMessage,
  reduceDeleteMessage,

  // ── Primitive reducers — requests & reveals ──────────────────────────────
  reduceUpsertPendingRequest,
  reduceRemovePendingRequest,
  reduceQueuePendingReveal,

  // ── Primitive reducers — telemetry ────────────────────────────────────────
  reduceQueueTelemetry,

  // ── Primitive reducers — learning & inference ────────────────────────────
  reduceUpsertLearningProfile,
  reduceUpsertInferenceSnapshot,
  reduceUpsertRelationship,

  // ── Primitive reducers — audience & heat ─────────────────────────────────
  reduceSetAudienceHeat,
  reduceApplyAudienceHeatDelta,

  // ── Primitive reducers — invasions & silence ─────────────────────────────
  reduceOpenInvasion,
  reduceCloseInvasion,
  reduceSetSilence,
  reduceClearSilence,

  // ── Primitive reducers — maintenance ─────────────────────────────────────
  reduceMaintenanceTick,

  // ── Semantic reducers (exposed for testing & composition) ─────────────────
  reduceApplyJoinAccepted,
  reduceApplyJoinRejected,
  reduceApplyLeaveAccepted,
  reduceApplyPlayerMessageAccepted,
  reduceApplyPlayerMessageRejected,
  reduceApplySystemSignal,
  reduceApplyNpcScene,

  // ── Effect machinery ──────────────────────────────────────────────────────
  createEffect,
  freezeEffect,
  touchRoom,
  touchSession,
  pushTelemetry,
  pushProofEdges,
  pushReplayArtifacts,
  appendMessages,
  applyAction,
  visibleChannelOrFallback,

  // ── Query helpers over results ────────────────────────────────────────────
  didReducerTouchRoom,
  didReducerTouchSession,
  reducerAppendedVisibleSequenceRange,
  reducerNetTranscriptGrowth,
  reducerOpenedOrClosedInvasion,

  // ── Result inspection ─────────────────────────────────────────────────────
  reducerResultHasNewMessages,
  reducerResultHasDeletions,
  reducerResultHasSessionChanges,
  reducerResultHasInvasionChanges,
  reducerResultMessageIds,
  reducerResultTouchedSessionIds,
  reducerResultOpenedInvasionIds,
  reducerResultClosedInvasionIds,
  reducerResultIsNoOp,
  reducerResultLabel,
  reducerResultMerge,

  // ── Point state inspection ─────────────────────────────────────────────────
  reducerGetRoomAudienceHeat,
  reducerGetInvasionState,
  reducerGetRoomSilenceDecision,
  reducerGetRoomSessionCount,
  reducerGetRoomMessageCount,
  reducerGetInferenceSnapshots,
  reducerGetLearningProfile,
  reducerGetPresenceSnapshot,
  reducerGetTypingSnapshot,
  reducerGetRelationshipState,
  reducerGetReplayArtifact,
  reducerGetPendingRequestState,
  reducerGetPendingReveal,
  reducerGetProofEdge,
  reducerGetTelemetryEnvelope,
  reducerGetRoomState,
  reducerGetSessionState,
  reducerGetJoinRequest,
  reducerGetLeaveRequest,
  reducerGetVisibleChannelUnread,
  reducerSequenceAsNumber,

  // ── UX-focused computed helpers ───────────────────────────────────────────
  reducerComputeRoomUnreadCount,
  reducerComputeRoomPresenceCount,
  reducerComputeRoomTypingCount,
  reducerComputeSessionRoomIds,
  reducerComputeActivePresenceList,
  reducerComputeTypingActorLabels,
  reducerComputeRoomHasActiveInvasion,
  reducerComputeRoomActiveInvasions,
  reducerComputeIsRoomSilenced,
  reducerComputeSessionIsPresent,
  reducerComputeLatestMessageInChannel,
  reducerComputeRecentMessages,
  reducerComputeRoomLastActivityTime,
  reducerComputeSessionConnectionState,
  reducerComputeRoomOccupancyRatio,
  reducerComputePendingRevealCount,
  reducerComputeProofChainLength,
  reducerComputeRelationshipsByUser,
  reducerComputeRoomSceneId,
  reducerComputeRoomStageMood,
  reducerComputeIsRoomCollapsed,
  reducerComputeActiveVisibleChannel,
  reducerComputeSessionMuteStatus,
  reducerComputeInferenceSnapshotsByUser,
  reducerComputeHasPendingRequest,
  reducerComputeReplayDepth,
  reducerComputeAllRoomIds,
  reducerComputeAllSessionIds,
  reducerComputeRoomTranscriptRange,
  reducerComputeSessionMessageCount,
  reducerComputeRoomExists,
  reducerComputeSessionExists,
  reducerComputeRoomKind,
  reducerComputeTotalActiveInvasionCount,
  reducerComputeAllLearningProfileUserIds,
  reducerComputeTelemetryQueueDepth,

  // ── Diagnostics ──────────────────────────────────────────────────────────
  reducerComputeStateSummary,
  reducerComputeRoomDiagnostic,
  reducerComputeAllRoomDiagnostics,

  // ── Construction utilities ────────────────────────────────────────────────
  createReplacementMessageFromPrevious,
  deriveReducerReplayAnchorSequence,
  computeReducerFingerprint,
  createReducerWatchBus,
  createReducerEpochTracker,
  describeReducerModule,
} as const);

