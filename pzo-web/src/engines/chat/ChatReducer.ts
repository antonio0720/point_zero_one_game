// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/ChatReducer.ts

/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT ENGINE FRONTEND REDUCER
 * FILE: pzo-web/src/engines/chat/ChatReducer.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Deterministic reducer layer for the sovereign frontend chat engine.
 *
 * This file sits between:
 * - ChatEngine.ts (runtime orchestration / timers / transport / EventBus binding)
 * - ChatState.ts  (state factories, low-level state mutations, normalization)
 * - ChatSelectors.ts (derived read models for UI, overlays, intervention surfaces)
 *
 * Design law
 * ----------
 * - Reducer owns legal transitions.
 * - ChatState owns mechanical mutations.
 * - ChatEngine owns clocks, transport, async, and external orchestration.
 * - Components render and dispatch intent. They do not author runtime truth.
 *
 * Why this exists even with ChatState helpers
 * -------------------------------------------
 * ChatState.ts is intentionally a state utility module.
 * ChatReducer.ts is the domain transition gate.
 *
 * That means:
 * - every state mutation gets a named action,
 * - transitions can be replayed deterministically,
 * - UI and runtime layers do not call 20 different mutation helpers ad hoc,
 * - future backend parity becomes straightforward because a similar reducer
 *   shape can exist server-side even if authority differs.
 *
 * Doctrine alignment
 * ------------------
 * The uploaded unified chat doctrine requires:
 * - frontend engine ownership of immediacy and presentation-state decisions,
 * - no direct battle/pressure imports inside UI rendering surfaces,
 * - typed downstream response to seven-engine truth,
 * - reducer/selectors as first-class engine files under
 *   /pzo-web/src/engines/chat.
 *
 * This reducer therefore:
 * - consumes upstream signals but does not fabricate financial truth,
 * - supports shadow channels without surfacing them as UI-first concerns,
 * - preserves optimistic staging vs authoritative apply split,
 * - supports dramaturgy, silence, relationship memory, rescue, negotiation,
 *   audience heat, liveops overlays, and post-run ritual surfaces,
 * - remains compile-safe before the rest of the chat tree lands.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import {
  CHAT_ENGINE_CONSTANTS,
  CHAT_MOUNT_PRESETS,
  CHAT_VISIBLE_CHANNELS,
} from './types';

import type {
  ChatAffectSnapshot,
  ChatAudienceHeat,
  ChatAuthoritativeFrame,
  ChatClientSendMessageRequest,
  ChatConnectionState,
  ChatContinuityState,
  ChatEngineState,
  ChatFeatureSnapshot,
  ChatLearningProfile,
  ChatLiveOpsState,
  ChatMessage,
  ChatMessageId,
  ChatMountTarget,
  ChatNotificationKind,
  ChatNotificationState,
  ChatPresenceSnapshot,
  ChatRelationshipState,
  ChatReplayMeta,
  ChatRequestId,
  ChatRescueDecision,
  ChatRevealSchedule,
  ChatRoomId,
  ChatScenePlan,
  ChatSessionId,
  ChatSilenceDecision,
  ChatTelemetryEnvelope,
  ChatTypingSnapshot,
  ChatTypingState,
  ChatUpstreamSignal,
  ChatVisibleChannel,
  Nullable,
  PressureTier,
  Score100,
  TickTier,
  UnixMs,
} from './types';

import {
  applyAuthoritativeFrameToState,
  beginSilenceInState,
  buildLocalSystemMessage,
  cloneChatEngineState,
  createChatEngineState,
  deriveFeatureSnapshotFromState,
  endSilenceInState,
  getLatestVisibleMessage,
  getMessagesForVisibleChannel,
  isVisibleChannelId,
  markChannelReadInState,
  markRequestFailedInState,
  popDueRevealsFromState,
  pruneExpiredTypingSnapshotsInState,
  pushMessageToState,
  scheduleRevealInState,
  setActiveSceneInState,
  setActiveVisibleChannelInState,
  setAffectInState,
  setAudienceHeatInState,
  setChannelMoodInState,
  setComposerDisabledInState,
  setLearningProfileInState,
  setLiveOpsStateInState,
  stageOptimisticLocalMessage,
  transitionConnectionState,
  trimChatStateWindow,
  updateComposerDraftInState,
  upsertPresenceSnapshotsInState,
  upsertRelationshipInState,
  upsertTypingSnapshotsInState,
} from './ChatState';

// ============================================================================
// MARK: Action names
// ============================================================================

export const CHAT_REDUCER_ACTION_NAMES = [
  'CHAT_BOOTSTRAPPED',
  'CHAT_MOUNT_CHANGED',
  'CHAT_VISIBLE_CHANNEL_SET',
  'CHAT_PANEL_OPENED',
  'CHAT_PANEL_CLOSED',
  'CHAT_PANEL_COLLAPSE_SET',
  'CHAT_COMPOSER_DRAFT_SET',
  'CHAT_COMPOSER_DISABLED_SET',
  'CHAT_CONNECTION_PATCHED',
  'CHAT_MEMBERSHIPS_SYNCED',
  'CHAT_LOCAL_MESSAGE_STAGED',
  'CHAT_MESSAGE_APPENDED',
  'CHAT_MESSAGE_REPLACED',
  'CHAT_REQUEST_FAILED',
  'CHAT_MESSAGE_READ_RECEIPT_APPLIED',
  'CHAT_AUTHORITATIVE_FRAME_APPLIED',
  'CHAT_PRESENCE_APPLIED',
  'CHAT_TYPING_APPLIED',
  'CHAT_TYPING_PRUNED',
  'CHAT_SCENE_SET',
  'CHAT_REVEAL_SCHEDULED',
  'CHAT_DUE_REVEALS_CONSUMED',
  'CHAT_SILENCE_STARTED',
  'CHAT_SILENCE_ENDED',
  'CHAT_AUDIENCE_HEAT_SET',
  'CHAT_CHANNEL_MOOD_SET',
  'CHAT_AFFECT_SET',
  'CHAT_LIVEOPS_SET',
  'CHAT_LEARNING_PROFILE_SET',
  'CHAT_RELATIONSHIP_UPSERTED',
  'CHAT_NOTIFICATION_STATE_SET',
  'CHAT_NOTIFICATION_KIND_PUSHED',
  'CHAT_UNREAD_CLEARED',
  'CHAT_UPSTREAM_SIGNAL_INGESTED',
  'CHAT_RESCUE_TRIGGERED',
  'CHAT_CACHE_RESTORED',
  'CHAT_STATE_REPLACED',
  'CHAT_STATE_RESET',
] as const;

export type ChatReducerActionName = (typeof CHAT_REDUCER_ACTION_NAMES)[number];

// ============================================================================
// MARK: Shared action payload contracts
// ============================================================================

export interface ChatBootstrapPayload {
  readonly mountTarget?: ChatMountTarget;
  readonly visibleChannel?: ChatVisibleChannel;
  readonly roomId?: ChatRoomId;
  readonly sessionId?: ChatSessionId;
  readonly learningProfile?: ChatLearningProfile;
}

export interface ChatMountChangedPayload {
  readonly mountTarget: ChatMountTarget;
}

export interface ChatVisibleChannelSetPayload {
  readonly channelId: ChatVisibleChannel;
  readonly markRead?: boolean;
}

export interface ChatPanelOpenedPayload {
  readonly markActiveChannelRead?: boolean;
}

export interface ChatPanelClosedPayload {
  readonly reason?: string;
}

export interface ChatPanelCollapseSetPayload {
  readonly collapsed: boolean;
}

export interface ChatComposerDraftSetPayload {
  readonly channelId: ChatVisibleChannel;
  readonly draft: string;
  readonly at: UnixMs;
}

export interface ChatComposerDisabledSetPayload {
  readonly disabled: boolean;
  readonly reason?: string;
}

export interface ChatConnectionPatchedPayload {
  readonly patch: Partial<ChatConnectionState>;
}

export interface ChatMembershipsSyncedPayload {
  readonly roomId: ChatRoomId;
  readonly sessionId?: ChatSessionId;
}

export interface ChatLocalMessageStagedPayload {
  readonly requestId: ChatRequestId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatVisibleChannel;
  readonly body: string;
  readonly senderId: string;
  readonly senderName: string;
  readonly senderRank?: string;
  readonly at: UnixMs;
  readonly tags?: readonly string[];
}

export interface ChatMessageAppendedPayload {
  readonly channelId: ChatVisibleChannel;
  readonly message: ChatMessage;
  readonly markUnreadWhenBackgrounded?: boolean;
}

export interface ChatMessageReplacedPayload {
  readonly channelId: ChatVisibleChannel;
  readonly messageId: ChatMessageId;
  readonly replacement: ChatMessage;
}

export interface ChatRequestFailedPayload {
  readonly requestId: ChatRequestId;
  readonly reason: string;
}

export interface ChatMessageReadReceiptAppliedPayload {
  readonly channelId: ChatVisibleChannel;
  readonly messageId: ChatMessageId;
  readonly actorId: string;
  readonly readAt: UnixMs;
}

export interface ChatAuthoritativeFrameAppliedPayload {
  readonly frame: ChatAuthoritativeFrame;
  readonly activeRoomId?: ChatRoomId;
  readonly activeSessionId?: ChatSessionId;
}

export interface ChatPresenceAppliedPayload {
  readonly snapshots: readonly ChatPresenceSnapshot[];
}

export interface ChatTypingAppliedPayload {
  readonly snapshots: readonly ChatTypingSnapshot[];
}

export interface ChatTypingPrunedPayload {
  readonly now: UnixMs;
}

export interface ChatSceneSetPayload {
  readonly scene?: ChatScenePlan;
}

export interface ChatRevealScheduledPayload {
  readonly reveal: ChatRevealSchedule;
}

export interface ChatDueRevealsConsumedPayload {
  readonly now: UnixMs;
}

export interface ChatSilenceStartedPayload {
  readonly silence: ChatSilenceDecision;
}

export interface ChatSilenceEndedPayload {
  readonly endedAt?: UnixMs;
}

export interface ChatAudienceHeatSetPayload {
  readonly channelId: ChatVisibleChannel;
  readonly patch: Partial<ChatAudienceHeat>;
}

export interface ChatChannelMoodSetPayload {
  readonly channelId: ChatEngineState['channelMoodByChannel'][keyof ChatEngineState['channelMoodByChannel']]['channelId'];
  readonly mood: ChatEngineState['channelMoodByChannel'][keyof ChatEngineState['channelMoodByChannel']]['mood'];
  readonly reason: string;
  readonly updatedAt?: UnixMs;
}

export interface ChatAffectSetPayload {
  readonly affect: ChatAffectSnapshot;
}

export interface ChatLiveOpsSetPayload {
  readonly liveOps: ChatLiveOpsState;
}

export interface ChatLearningProfileSetPayload {
  readonly learningProfile?: ChatLearningProfile;
}

export interface ChatRelationshipUpsertedPayload {
  readonly relationship: ChatRelationshipState;
}

export interface ChatNotificationStateSetPayload {
  readonly notificationState: ChatNotificationState;
}

export interface ChatNotificationKindPushedPayload {
  readonly kind: ChatNotificationKind;
  readonly at?: UnixMs;
}

export interface ChatUnreadClearedPayload {
  readonly channelId: ChatVisibleChannel;
}

export interface ChatUpstreamSignalIngestedPayload {
  readonly signal: ChatUpstreamSignal;
  readonly targetChannel?: ChatVisibleChannel;
}

export interface ChatRescueTriggeredPayload {
  readonly rescue: ChatRescueDecision;
}

export interface ChatCacheRestoredPayload {
  readonly state: ChatEngineState;
}

export interface ChatStateReplacedPayload {
  readonly state: ChatEngineState;
}

export interface ChatStateResetPayload {
  readonly mountTarget?: ChatMountTarget;
  readonly visibleChannel?: ChatVisibleChannel;
  readonly roomId?: ChatRoomId;
  readonly sessionId?: ChatSessionId;
}

// ============================================================================
// MARK: Action map and discriminated union
// ============================================================================

export interface ChatReducerActionMap {
  CHAT_BOOTSTRAPPED: ChatBootstrapPayload;
  CHAT_MOUNT_CHANGED: ChatMountChangedPayload;
  CHAT_VISIBLE_CHANNEL_SET: ChatVisibleChannelSetPayload;
  CHAT_PANEL_OPENED: ChatPanelOpenedPayload;
  CHAT_PANEL_CLOSED: ChatPanelClosedPayload;
  CHAT_PANEL_COLLAPSE_SET: ChatPanelCollapseSetPayload;
  CHAT_COMPOSER_DRAFT_SET: ChatComposerDraftSetPayload;
  CHAT_COMPOSER_DISABLED_SET: ChatComposerDisabledSetPayload;
  CHAT_CONNECTION_PATCHED: ChatConnectionPatchedPayload;
  CHAT_MEMBERSHIPS_SYNCED: ChatMembershipsSyncedPayload;
  CHAT_LOCAL_MESSAGE_STAGED: ChatLocalMessageStagedPayload;
  CHAT_MESSAGE_APPENDED: ChatMessageAppendedPayload;
  CHAT_MESSAGE_REPLACED: ChatMessageReplacedPayload;
  CHAT_REQUEST_FAILED: ChatRequestFailedPayload;
  CHAT_MESSAGE_READ_RECEIPT_APPLIED: ChatMessageReadReceiptAppliedPayload;
  CHAT_AUTHORITATIVE_FRAME_APPLIED: ChatAuthoritativeFrameAppliedPayload;
  CHAT_PRESENCE_APPLIED: ChatPresenceAppliedPayload;
  CHAT_TYPING_APPLIED: ChatTypingAppliedPayload;
  CHAT_TYPING_PRUNED: ChatTypingPrunedPayload;
  CHAT_SCENE_SET: ChatSceneSetPayload;
  CHAT_REVEAL_SCHEDULED: ChatRevealScheduledPayload;
  CHAT_DUE_REVEALS_CONSUMED: ChatDueRevealsConsumedPayload;
  CHAT_SILENCE_STARTED: ChatSilenceStartedPayload;
  CHAT_SILENCE_ENDED: ChatSilenceEndedPayload;
  CHAT_AUDIENCE_HEAT_SET: ChatAudienceHeatSetPayload;
  CHAT_CHANNEL_MOOD_SET: ChatChannelMoodSetPayload;
  CHAT_AFFECT_SET: ChatAffectSetPayload;
  CHAT_LIVEOPS_SET: ChatLiveOpsSetPayload;
  CHAT_LEARNING_PROFILE_SET: ChatLearningProfileSetPayload;
  CHAT_RELATIONSHIP_UPSERTED: ChatRelationshipUpsertedPayload;
  CHAT_NOTIFICATION_STATE_SET: ChatNotificationStateSetPayload;
  CHAT_NOTIFICATION_KIND_PUSHED: ChatNotificationKindPushedPayload;
  CHAT_UNREAD_CLEARED: ChatUnreadClearedPayload;
  CHAT_UPSTREAM_SIGNAL_INGESTED: ChatUpstreamSignalIngestedPayload;
  CHAT_RESCUE_TRIGGERED: ChatRescueTriggeredPayload;
  CHAT_CACHE_RESTORED: ChatCacheRestoredPayload;
  CHAT_STATE_REPLACED: ChatStateReplacedPayload;
  CHAT_STATE_RESET: ChatStateResetPayload;
}

export type ChatReducerAction<
  TName extends keyof ChatReducerActionMap = keyof ChatReducerActionMap,
> = {
  readonly type: TName;
  readonly payload: ChatReducerActionMap[TName];
};

// ============================================================================
// MARK: Reducer meta and transition diagnostics
// ============================================================================

export interface ChatReducerMeta {
  readonly now?: UnixMs;
  readonly panelOpen?: boolean;
  readonly panelCollapsed?: boolean;
  readonly requestFeatureSnapshot?: ChatFeatureSnapshot;
}

export interface ChatReducerResult {
  readonly state: ChatEngineState;
  readonly sideChannel: {
    readonly stagedMessage?: ChatMessage;
    readonly dueReveals?: readonly ChatRevealSchedule[];
    readonly appendedRescueMessage?: ChatMessage;
  };
}

export interface ChatReducerTransition {
  readonly previousState: ChatEngineState;
  readonly nextState: ChatEngineState;
  readonly action: ChatReducerAction;
  readonly changed: boolean;
}

// ============================================================================
// MARK: Action creators
// ============================================================================

export const ChatReducerActions = Object.freeze({
  bootstrap: (
    payload: ChatBootstrapPayload,
  ): ChatReducerAction<'CHAT_BOOTSTRAPPED'> => ({
    type: 'CHAT_BOOTSTRAPPED',
    payload,
  }),

  mountChanged: (
    payload: ChatMountChangedPayload,
  ): ChatReducerAction<'CHAT_MOUNT_CHANGED'> => ({
    type: 'CHAT_MOUNT_CHANGED',
    payload,
  }),

  visibleChannelSet: (
    payload: ChatVisibleChannelSetPayload,
  ): ChatReducerAction<'CHAT_VISIBLE_CHANNEL_SET'> => ({
    type: 'CHAT_VISIBLE_CHANNEL_SET',
    payload,
  }),

  panelOpened: (
    payload: ChatPanelOpenedPayload = {},
  ): ChatReducerAction<'CHAT_PANEL_OPENED'> => ({
    type: 'CHAT_PANEL_OPENED',
    payload,
  }),

  panelClosed: (
    payload: ChatPanelClosedPayload = {},
  ): ChatReducerAction<'CHAT_PANEL_CLOSED'> => ({
    type: 'CHAT_PANEL_CLOSED',
    payload,
  }),

  panelCollapseSet: (
    payload: ChatPanelCollapseSetPayload,
  ): ChatReducerAction<'CHAT_PANEL_COLLAPSE_SET'> => ({
    type: 'CHAT_PANEL_COLLAPSE_SET',
    payload,
  }),

  composerDraftSet: (
    payload: ChatComposerDraftSetPayload,
  ): ChatReducerAction<'CHAT_COMPOSER_DRAFT_SET'> => ({
    type: 'CHAT_COMPOSER_DRAFT_SET',
    payload,
  }),

  composerDisabledSet: (
    payload: ChatComposerDisabledSetPayload,
  ): ChatReducerAction<'CHAT_COMPOSER_DISABLED_SET'> => ({
    type: 'CHAT_COMPOSER_DISABLED_SET',
    payload,
  }),

  connectionPatched: (
    payload: ChatConnectionPatchedPayload,
  ): ChatReducerAction<'CHAT_CONNECTION_PATCHED'> => ({
    type: 'CHAT_CONNECTION_PATCHED',
    payload,
  }),

  membershipsSynced: (
    payload: ChatMembershipsSyncedPayload,
  ): ChatReducerAction<'CHAT_MEMBERSHIPS_SYNCED'> => ({
    type: 'CHAT_MEMBERSHIPS_SYNCED',
    payload,
  }),

  localMessageStaged: (
    payload: ChatLocalMessageStagedPayload,
  ): ChatReducerAction<'CHAT_LOCAL_MESSAGE_STAGED'> => ({
    type: 'CHAT_LOCAL_MESSAGE_STAGED',
    payload,
  }),

  messageAppended: (
    payload: ChatMessageAppendedPayload,
  ): ChatReducerAction<'CHAT_MESSAGE_APPENDED'> => ({
    type: 'CHAT_MESSAGE_APPENDED',
    payload,
  }),

  messageReplaced: (
    payload: ChatMessageReplacedPayload,
  ): ChatReducerAction<'CHAT_MESSAGE_REPLACED'> => ({
    type: 'CHAT_MESSAGE_REPLACED',
    payload,
  }),

  requestFailed: (
    payload: ChatRequestFailedPayload,
  ): ChatReducerAction<'CHAT_REQUEST_FAILED'> => ({
    type: 'CHAT_REQUEST_FAILED',
    payload,
  }),

  authoritativeFrameApplied: (
    payload: ChatAuthoritativeFrameAppliedPayload,
  ): ChatReducerAction<'CHAT_AUTHORITATIVE_FRAME_APPLIED'> => ({
    type: 'CHAT_AUTHORITATIVE_FRAME_APPLIED',
    payload,
  }),

  presenceApplied: (
    payload: ChatPresenceAppliedPayload,
  ): ChatReducerAction<'CHAT_PRESENCE_APPLIED'> => ({
    type: 'CHAT_PRESENCE_APPLIED',
    payload,
  }),

  typingApplied: (
    payload: ChatTypingAppliedPayload,
  ): ChatReducerAction<'CHAT_TYPING_APPLIED'> => ({
    type: 'CHAT_TYPING_APPLIED',
    payload,
  }),

  typingPruned: (
    payload: ChatTypingPrunedPayload,
  ): ChatReducerAction<'CHAT_TYPING_PRUNED'> => ({
    type: 'CHAT_TYPING_PRUNED',
    payload,
  }),

  sceneSet: (
    payload: ChatSceneSetPayload,
  ): ChatReducerAction<'CHAT_SCENE_SET'> => ({
    type: 'CHAT_SCENE_SET',
    payload,
  }),

  revealScheduled: (
    payload: ChatRevealScheduledPayload,
  ): ChatReducerAction<'CHAT_REVEAL_SCHEDULED'> => ({
    type: 'CHAT_REVEAL_SCHEDULED',
    payload,
  }),

  dueRevealsConsumed: (
    payload: ChatDueRevealsConsumedPayload,
  ): ChatReducerAction<'CHAT_DUE_REVEALS_CONSUMED'> => ({
    type: 'CHAT_DUE_REVEALS_CONSUMED',
    payload,
  }),

  silenceStarted: (
    payload: ChatSilenceStartedPayload,
  ): ChatReducerAction<'CHAT_SILENCE_STARTED'> => ({
    type: 'CHAT_SILENCE_STARTED',
    payload,
  }),

  silenceEnded: (
    payload: ChatSilenceEndedPayload = {},
  ): ChatReducerAction<'CHAT_SILENCE_ENDED'> => ({
    type: 'CHAT_SILENCE_ENDED',
    payload,
  }),

  audienceHeatSet: (
    payload: ChatAudienceHeatSetPayload,
  ): ChatReducerAction<'CHAT_AUDIENCE_HEAT_SET'> => ({
    type: 'CHAT_AUDIENCE_HEAT_SET',
    payload,
  }),

  channelMoodSet: (
    payload: ChatChannelMoodSetPayload,
  ): ChatReducerAction<'CHAT_CHANNEL_MOOD_SET'> => ({
    type: 'CHAT_CHANNEL_MOOD_SET',
    payload,
  }),

  affectSet: (
    payload: ChatAffectSetPayload,
  ): ChatReducerAction<'CHAT_AFFECT_SET'> => ({
    type: 'CHAT_AFFECT_SET',
    payload,
  }),

  liveOpsSet: (
    payload: ChatLiveOpsSetPayload,
  ): ChatReducerAction<'CHAT_LIVEOPS_SET'> => ({
    type: 'CHAT_LIVEOPS_SET',
    payload,
  }),

  learningProfileSet: (
    payload: ChatLearningProfileSetPayload,
  ): ChatReducerAction<'CHAT_LEARNING_PROFILE_SET'> => ({
    type: 'CHAT_LEARNING_PROFILE_SET',
    payload,
  }),

  relationshipUpserted: (
    payload: ChatRelationshipUpsertedPayload,
  ): ChatReducerAction<'CHAT_RELATIONSHIP_UPSERTED'> => ({
    type: 'CHAT_RELATIONSHIP_UPSERTED',
    payload,
  }),

  notificationStateSet: (
    payload: ChatNotificationStateSetPayload,
  ): ChatReducerAction<'CHAT_NOTIFICATION_STATE_SET'> => ({
    type: 'CHAT_NOTIFICATION_STATE_SET',
    payload,
  }),

  notificationKindPushed: (
    payload: ChatNotificationKindPushedPayload,
  ): ChatReducerAction<'CHAT_NOTIFICATION_KIND_PUSHED'> => ({
    type: 'CHAT_NOTIFICATION_KIND_PUSHED',
    payload,
  }),

  unreadCleared: (
    payload: ChatUnreadClearedPayload,
  ): ChatReducerAction<'CHAT_UNREAD_CLEARED'> => ({
    type: 'CHAT_UNREAD_CLEARED',
    payload,
  }),

  upstreamSignalIngested: (
    payload: ChatUpstreamSignalIngestedPayload,
  ): ChatReducerAction<'CHAT_UPSTREAM_SIGNAL_INGESTED'> => ({
    type: 'CHAT_UPSTREAM_SIGNAL_INGESTED',
    payload,
  }),

  rescueTriggered: (
    payload: ChatRescueTriggeredPayload,
  ): ChatReducerAction<'CHAT_RESCUE_TRIGGERED'> => ({
    type: 'CHAT_RESCUE_TRIGGERED',
    payload,
  }),

  cacheRestored: (
    payload: ChatCacheRestoredPayload,
  ): ChatReducerAction<'CHAT_CACHE_RESTORED'> => ({
    type: 'CHAT_CACHE_RESTORED',
    payload,
  }),

  stateReplaced: (
    payload: ChatStateReplacedPayload,
  ): ChatReducerAction<'CHAT_STATE_REPLACED'> => ({
    type: 'CHAT_STATE_REPLACED',
    payload,
  }),

  stateReset: (
    payload: ChatStateResetPayload = {},
  ): ChatReducerAction<'CHAT_STATE_RESET'> => ({
    type: 'CHAT_STATE_RESET',
    payload,
  }),
} as const);

// ============================================================================
// MARK: Bootstrap and reset helpers
// ============================================================================

export function createInitialChatReducerState(
  payload: ChatBootstrapPayload = {},
): ChatEngineState {
  const mountTarget = payload.mountTarget ?? 'LOBBY_SCREEN';
  const visibleChannel = nextAllowedVisibleChannel(
    mountTarget,
    payload.visibleChannel ?? CHAT_MOUNT_PRESETS[mountTarget].defaultVisibleChannel,
  );

  return createChatEngineState({
    mountTarget,
    initialVisibleChannel: visibleChannel,
    initialRoomId: payload.roomId,
    initialSessionId: payload.sessionId,
    initialLearningProfile: payload.learningProfile,
  });
}

export function resetChatReducerState(
  payload: ChatStateResetPayload = {},
): ChatEngineState {
  return createInitialChatReducerState({
    mountTarget: payload.mountTarget,
    visibleChannel: payload.visibleChannel,
    roomId: payload.roomId,
    sessionId: payload.sessionId,
  });
}

// ============================================================================
// MARK: Public reducer entrypoint
// ============================================================================

export function reduceChatState(
  state: ChatEngineState,
  action: ChatReducerAction,
  meta: ChatReducerMeta = {},
): ChatReducerResult {
  switch (action.type) {
    case 'CHAT_BOOTSTRAPPED':
      return reduceBootstrapped(action.payload);

    case 'CHAT_MOUNT_CHANGED':
      return reduceMountChanged(state, action.payload);

    case 'CHAT_VISIBLE_CHANNEL_SET':
      return reduceVisibleChannelSet(state, action.payload);

    case 'CHAT_PANEL_OPENED':
      return reducePanelOpened(state, action.payload);

    case 'CHAT_PANEL_CLOSED':
      return unchanged(state);

    case 'CHAT_PANEL_COLLAPSE_SET':
      return unchanged(state);

    case 'CHAT_COMPOSER_DRAFT_SET':
      return changed(
        updateComposerDraftInState(
          state,
          action.payload.channelId,
          action.payload.draft,
          action.payload.at,
        ),
      );

    case 'CHAT_COMPOSER_DISABLED_SET':
      return changed(
        setComposerDisabledInState(
          state,
          action.payload.disabled,
          action.payload.reason,
        ),
      );

    case 'CHAT_CONNECTION_PATCHED':
      return changed(
        transitionConnectionState(state, action.payload.patch),
      );

    case 'CHAT_MEMBERSHIPS_SYNCED':
      return reduceMembershipsSynced(state, action.payload);

    case 'CHAT_LOCAL_MESSAGE_STAGED':
      return reduceLocalMessageStaged(state, action.payload);

    case 'CHAT_MESSAGE_APPENDED':
      return changed(
        pushMessageToState(state, {
          channelId: action.payload.channelId,
          message: action.payload.message,
          markUnreadWhenBackgrounded: action.payload.markUnreadWhenBackgrounded,
        }),
      );

    case 'CHAT_MESSAGE_REPLACED':
      return reduceMessageReplaced(state, action.payload);

    case 'CHAT_REQUEST_FAILED':
      return changed(
        markRequestFailedInState(
          state,
          action.payload.requestId,
          action.payload.reason,
        ),
      );

    case 'CHAT_MESSAGE_READ_RECEIPT_APPLIED':
      return reduceReadReceiptApplied(state, action.payload);

    case 'CHAT_AUTHORITATIVE_FRAME_APPLIED':
      return changed(
        applyAuthoritativeFrameToState(state, {
          frame: action.payload.frame,
          activeRoomId: action.payload.activeRoomId,
          activeSessionId: action.payload.activeSessionId,
        }),
      );

    case 'CHAT_PRESENCE_APPLIED':
      return changed(
        upsertPresenceSnapshotsInState(state, action.payload.snapshots),
      );

    case 'CHAT_TYPING_APPLIED':
      return changed(
        upsertTypingSnapshotsInState(state, action.payload.snapshots),
      );

    case 'CHAT_TYPING_PRUNED':
      return changed(
        pruneExpiredTypingSnapshotsInState(state, action.payload.now),
      );

    case 'CHAT_SCENE_SET':
      return changed(
        setActiveSceneInState(state, action.payload.scene),
      );

    case 'CHAT_REVEAL_SCHEDULED':
      return changed(
        scheduleRevealInState(state, action.payload.reveal),
      );

    case 'CHAT_DUE_REVEALS_CONSUMED':
      return reduceDueRevealsConsumed(state, action.payload);

    case 'CHAT_SILENCE_STARTED':
      return changed(
        beginSilenceInState(state, action.payload.silence),
      );

    case 'CHAT_SILENCE_ENDED':
      return changed(endSilenceInState(state));

    case 'CHAT_AUDIENCE_HEAT_SET':
      return changed(
        setAudienceHeatInState(
          state,
          action.payload.channelId,
          action.payload.patch,
        ),
      );

    case 'CHAT_CHANNEL_MOOD_SET':
      return changed(
        setChannelMoodInState(
          state,
          action.payload.channelId,
          action.payload.mood,
          action.payload.reason,
          action.payload.updatedAt,
        ),
      );

    case 'CHAT_AFFECT_SET':
      return changed(
        setAffectInState(state, action.payload.affect),
      );

    case 'CHAT_LIVEOPS_SET':
      return changed(
        setLiveOpsStateInState(state, action.payload.liveOps),
      );

    case 'CHAT_LEARNING_PROFILE_SET':
      return changed(
        setLearningProfileInState(state, action.payload.learningProfile),
      );

    case 'CHAT_RELATIONSHIP_UPSERTED':
      return changed(
        upsertRelationshipInState(state, action.payload.relationship),
      );

    case 'CHAT_NOTIFICATION_STATE_SET':
      return reduceNotificationStateSet(state, action.payload);

    case 'CHAT_NOTIFICATION_KIND_PUSHED':
      return reduceNotificationKindPushed(state, action.payload);

    case 'CHAT_UNREAD_CLEARED':
      return changed(
        markChannelReadInState(state, action.payload.channelId),
      );

    case 'CHAT_UPSTREAM_SIGNAL_INGESTED':
      return reduceUpstreamSignalIngested(state, action.payload, meta);

    case 'CHAT_RESCUE_TRIGGERED':
      return reduceRescueTriggered(state, action.payload);

    case 'CHAT_CACHE_RESTORED':
      return changed(trimChatStateWindow(action.payload.state));

    case 'CHAT_STATE_REPLACED':
      return changed(trimChatStateWindow(action.payload.state));

    case 'CHAT_STATE_RESET':
      return changed(resetChatReducerState(action.payload));

    default:
      return unchanged(state);
  }
}

// ============================================================================
// MARK: Reducer cases — bootstrap / mount / channels
// ============================================================================

function reduceBootstrapped(
  payload: ChatBootstrapPayload,
): ChatReducerResult {
  return changed(createInitialChatReducerState(payload));
}

function reduceMountChanged(
  state: ChatEngineState,
  payload: ChatMountChangedPayload,
): ChatReducerResult {
  const nextMount = payload.mountTarget;
  const nextVisible = nextAllowedVisibleChannel(
    nextMount,
    state.activeVisibleChannel,
  );

  let next = cloneChatEngineState(state);
  next.activeMountTarget = nextMount;
  next.continuity = {
    ...next.continuity,
    lastMountTarget: nextMount,
  };

  next = setActiveVisibleChannelInState(next, nextVisible);
  return changed(next);
}

function reduceVisibleChannelSet(
  state: ChatEngineState,
  payload: ChatVisibleChannelSetPayload,
): ChatReducerResult {
  const nextAllowed = nextAllowedVisibleChannel(
    state.activeMountTarget,
    payload.channelId,
  );

  let next = setActiveVisibleChannelInState(state, nextAllowed);
  if (payload.markRead !== false) {
    next = markChannelReadInState(next, nextAllowed);
  }

  return changed(next);
}

function reducePanelOpened(
  state: ChatEngineState,
  payload: ChatPanelOpenedPayload,
): ChatReducerResult {
  const markRead = payload.markActiveChannelRead !== false;
  let next = setComposerDisabledInState(state, false);

  if (markRead) {
    next = markChannelReadInState(next, next.activeVisibleChannel);
  }

  return changed(next);
}

function reduceMembershipsSynced(
  state: ChatEngineState,
  payload: ChatMembershipsSyncedPayload,
): ChatReducerResult {
  const next = transitionConnectionState(state, {
    sessionId: payload.sessionId,
  });

  if (next.memberships.length > 0) return changed(next);

  const bootstrapped = createChatEngineState({
    mountTarget: next.activeMountTarget,
    initialVisibleChannel: next.activeVisibleChannel,
    initialRoomId: payload.roomId,
    initialSessionId: payload.sessionId,
    initialLearningProfile: next.learningProfile,
    initialMessages: next.messagesByChannel,
  });

  return changed({
    ...bootstrapped,
    composer: next.composer,
    notifications: next.notifications,
    presenceByActorId: next.presenceByActorId,
    typingByActorId: next.typingByActorId,
    audienceHeat: next.audienceHeat,
    channelMoodByChannel: next.channelMoodByChannel,
    reputation: next.reputation,
    affect: next.affect,
    liveOps: next.liveOps,
    relationshipsByCounterpartId: next.relationshipsByCounterpartId,
    continuity: next.continuity,
    lastAuthoritativeSyncAt: next.lastAuthoritativeSyncAt,
  });
}

// ============================================================================
// MARK: Reducer cases — message mutation
// ============================================================================

function reduceLocalMessageStaged(
  state: ChatEngineState,
  payload: ChatLocalMessageStagedPayload,
): ChatReducerResult {
  const staged = stageOptimisticLocalMessage(state, {
    requestId: payload.requestId,
    roomId: payload.roomId,
    channelId: payload.channelId,
    body: payload.body,
    senderId: payload.senderId,
    senderName: payload.senderName,
    senderRank: payload.senderRank,
    at: payload.at,
    tags: payload.tags,
  });

  return {
    state: trimChatStateWindow(staged.state),
    sideChannel: {
      stagedMessage: staged.message,
    },
  };
}

function reduceMessageReplaced(
  state: ChatEngineState,
  payload: ChatMessageReplacedPayload,
): ChatReducerResult {
  const existing = getMessagesForVisibleChannel(state, payload.channelId);
  const idx = existing.findIndex((message) => message.id === payload.messageId);
  if (idx === -1) {
    return changed(
      pushMessageToState(state, {
        channelId: payload.channelId,
        message: payload.replacement,
      }),
    );
  }

  const next = cloneChatEngineState(state);
  const copy = [...existing];
  copy[idx] = cloneMessage(payload.replacement);
  next.messagesByChannel = {
    ...next.messagesByChannel,
    [payload.channelId]: normalizeMessageWindowForReducer(copy),
  };

  return changed(next);
}

function reduceReadReceiptApplied(
  state: ChatEngineState,
  payload: ChatMessageReadReceiptAppliedPayload,
): ChatReducerResult {
  const existing = getMessagesForVisibleChannel(state, payload.channelId);
  const idx = existing.findIndex((message) => message.id === payload.messageId);
  if (idx === -1) return unchanged(state);

  const target = existing[idx];
  const receipts = [
    ...(target.readReceipts ?? []),
    {
      actorId: payload.actorId,
      actorKind: 'PLAYER',
      messageId: payload.messageId,
      readAt: payload.readAt,
      delayedByPolicy: false,
    },
  ];

  const dedupMap = new Map<string, ChatMessage['readReceipts'][number]>();
  for (const receipt of receipts) {
    const key = `${receipt.actorId}::${receipt.messageId}`;
    const current = dedupMap.get(key);
    if (!current || receipt.readAt >= current.readAt) dedupMap.set(key, receipt);
  }

  const replacement: ChatMessage = {
    ...target,
    readReceipts: [...dedupMap.values()].sort((a, b) => a.readAt - b.readAt),
  };

  return reduceMessageReplaced(state, {
    channelId: payload.channelId,
    messageId: payload.messageId,
    replacement,
  });
}

// ============================================================================
// MARK: Reducer cases — reveals / silence / rescue
// ============================================================================

function reduceDueRevealsConsumed(
  state: ChatEngineState,
  payload: ChatDueRevealsConsumedPayload,
): ChatReducerResult {
  const popped = popDueRevealsFromState(state, payload.now);
  return {
    state: popped.state,
    sideChannel: {
      dueReveals: popped.due,
    },
  };
}

function reduceRescueTriggered(
  state: ChatEngineState,
  payload: ChatRescueTriggeredPayload,
): ChatReducerResult {
  const helperMessage = buildLocalSystemMessage({
    id: (`chat_rescue:${payload.rescue.interventionId}`) as ChatMessageId,
    channel: payload.rescue.deliverInChannel,
    kind: 'HELPER_RESCUE',
    body: rescueCopyForIntent(payload.rescue.intent),
    at: payload.rescue.triggerAt,
    emoji: payload.rescue.intent === 'CALM' ? '🫶' : '🛡️',
  });

  const next = pushMessageToState(state, {
    channelId: payload.rescue.deliverInChannel,
    message: helperMessage,
  });

  return {
    state: next,
    sideChannel: {
      appendedRescueMessage: helperMessage,
    },
  };
}

// ============================================================================
// MARK: Reducer cases — notifications
// ============================================================================

function reduceNotificationStateSet(
  state: ChatEngineState,
  payload: ChatNotificationStateSetPayload,
): ChatReducerResult {
  const next = cloneChatEngineState(state);
  next.notifications = {
    ...payload.notificationState,
    unreadByChannel: { ...payload.notificationState.unreadByChannel },
    notificationKinds: [...payload.notificationState.notificationKinds],
  };
  return changed(next);
}

function reduceNotificationKindPushed(
  state: ChatEngineState,
  payload: ChatNotificationKindPushedPayload,
): ChatReducerResult {
  if (state.notifications.notificationKinds.includes(payload.kind)) {
    return unchanged(state);
  }

  const next = cloneChatEngineState(state);
  next.notifications = {
    ...next.notifications,
    notificationKinds: [...next.notifications.notificationKinds, payload.kind],
    lastNotifiedAt: payload.at ?? next.notifications.lastNotifiedAt,
  };

  return changed(next);
}

// ============================================================================
// MARK: Reducer case — upstream signal ingestion
// ============================================================================

function reduceUpstreamSignalIngested(
  state: ChatEngineState,
  payload: ChatUpstreamSignalIngestedPayload,
  meta: ChatReducerMeta,
): ChatReducerResult {
  const targetChannel =
    payload.targetChannel ??
    defaultTargetChannelForSignal(state.activeMountTarget, payload.signal);

  let next = cloneChatEngineState(state);

  // 1) Affect update
  next = setAffectInState(next, deriveAffectFromSignal(next.affect, payload.signal));

  // 2) Channel mood update
  next = setChannelMoodInState(
    next,
    targetChannel,
    deriveMoodFromSignal(payload.signal),
    payload.signal.signalType,
    payload.signal.emittedAt,
  );

  // 3) Audience heat update
  next = setAudienceHeatInState(
    next,
    targetChannel,
    deriveAudiencePatchFromSignal(next.audienceHeat[targetChannel], payload.signal),
  );

  // 4) Immediate witnessed system layer
  const witnessedMessages = buildImmediateSignalMessages(next, payload.signal, targetChannel);
  for (const message of witnessedMessages) {
    next = pushMessageToState(next, {
      channelId: message.channel,
      message,
    });
  }

  // 5) Scene / silence law
  const maybeScene = buildScenePlanFromSignal(payload.signal, targetChannel);
  if (maybeScene) {
    next = setActiveSceneInState(next, maybeScene);
  }

  const maybeSilence = buildSilenceDecisionFromSignal(payload.signal);
  if (maybeSilence?.enforced) {
    next = beginSilenceInState(next, maybeSilence);
  }

  // 6) Opportunistic helper rescue on high-risk signal states
  if (shouldOfferRescueAfterSignal(next, payload.signal)) {
    const rescue = buildRescueDecisionFromSignal(next, payload.signal, targetChannel);
    const reduced = reduceRescueTriggered(next, { rescue });
    next = reduced.state;
    return {
      state: next,
      sideChannel: reduced.sideChannel,
    };
  }

  // 7) Trim for safety
  next = trimChatStateWindow(next);
  return changed(next);
}

// ============================================================================
// MARK: Reducer helpers — upstream signal interpretation
// ============================================================================

function deriveMoodFromSignal(
  signal: ChatUpstreamSignal,
): ChatEngineState['channelMoodByChannel'][keyof ChatEngineState['channelMoodByChannel']]['mood'] {
  switch (signal.signalType) {
    case 'BOT_ATTACK_FIRED':
    case 'SHIELD_LAYER_BREACHED':
      return 'HOSTILE';
    case 'CASCADE_CHAIN_STARTED':
    case 'CASCADE_POSITIVE_ACTIVATED':
      return 'SUSPICIOUS';
    case 'CASCADE_CHAIN_BROKEN':
    case 'SHIELD_FORTIFIED':
      return 'ECSTATIC';
    case 'SOVEREIGNTY_APPROACH':
    case 'SOVEREIGNTY_ACHIEVED':
      return 'ECSTATIC';
    case 'RUN_ENDED':
      return 'MOURNFUL';
    case 'DEAL_PROOF_ISSUED':
      return 'PREDATORY';
    default:
      return 'CALM';
  }
}

function deriveAudiencePatchFromSignal(
  current: ChatAudienceHeat,
  signal: ChatUpstreamSignal,
): Partial<ChatAudienceHeat> {
  const delta = audienceDeltaForSignal(signal);

  return {
    heat: clampScore100(current.heat + (delta.heat ?? 0)),
    hype: clampScore100(current.hype + (delta.hype ?? 0)),
    ridicule: clampScore100(current.ridicule + (delta.ridicule ?? 0)),
    scrutiny: clampScore100(current.scrutiny + (delta.scrutiny ?? 0)),
    volatility: clampScore100(current.volatility + (delta.volatility ?? 0)),
    lastUpdatedAt: signal.emittedAt,
  };
}

function audienceDeltaForSignal(
  signal: ChatUpstreamSignal,
): Partial<Record<'heat' | 'hype' | 'ridicule' | 'scrutiny' | 'volatility', number>> {
  switch (signal.signalType) {
    case 'BOT_ATTACK_FIRED':
      return { heat: 18, scrutiny: 12, volatility: 10 };
    case 'SHIELD_LAYER_BREACHED':
      return { heat: 14, scrutiny: 16, ridicule: 4, volatility: 8 };
    case 'CASCADE_CHAIN_STARTED':
      return { heat: 8, scrutiny: 8, volatility: 14 };
    case 'CASCADE_CHAIN_BROKEN':
      return { hype: 12, heat: 6 };
    case 'SOVEREIGNTY_APPROACH':
      return { hype: 14, scrutiny: 10 };
    case 'SOVEREIGNTY_ACHIEVED':
      return { hype: 22, heat: 14, scrutiny: -4 };
    case 'RUN_ENDED':
      return { heat: -3, hype: 0, ridicule: 0, scrutiny: 3, volatility: -4 };
    default:
      return { heat: 2 };
  }
}

function deriveAffectFromSignal(
  current: ChatAffectSnapshot,
  signal: ChatUpstreamSignal,
): ChatAffectSnapshot {
  const vector = { ...current.vector };

  switch (signal.signalType) {
    case 'SHIELD_LAYER_BREACHED':
      vector.intimidation = clampScore100(vector.intimidation + 18);
      vector.frustration = clampScore100(vector.frustration + 12);
      vector.desperation = clampScore100(vector.desperation + 8);
      vector.confidence = clampScore100(vector.confidence - 14);
      return {
        vector,
        lastUpdatedAt: signal.emittedAt,
        dominantEmotion: 'INTIMIDATION',
        confidenceSwingDelta: -14,
      };

    case 'BOT_ATTACK_FIRED':
      vector.intimidation = clampScore100(vector.intimidation + 14);
      vector.desperation = clampScore100(vector.desperation + 6);
      vector.confidence = clampScore100(vector.confidence - 10);
      return {
        vector,
        lastUpdatedAt: signal.emittedAt,
        dominantEmotion: 'INTIMIDATION',
        confidenceSwingDelta: -10,
      };

    case 'CASCADE_CHAIN_STARTED':
      vector.frustration = clampScore100(vector.frustration + 10);
      vector.curiosity = clampScore100(vector.curiosity + 6);
      return {
        vector,
        lastUpdatedAt: signal.emittedAt,
        dominantEmotion: 'FRUSTRATION',
        confidenceSwingDelta: -4,
      };

    case 'CASCADE_CHAIN_BROKEN':
      vector.relief = clampScore100(vector.relief + 16);
      vector.confidence = clampScore100(vector.confidence + 8);
      vector.desperation = clampScore100(vector.desperation - 6);
      return {
        vector,
        lastUpdatedAt: signal.emittedAt,
        dominantEmotion: 'RELIEF',
        confidenceSwingDelta: 8,
      };

    case 'SOVEREIGNTY_APPROACH':
      vector.confidence = clampScore100(vector.confidence + 10);
      vector.curiosity = clampScore100(vector.curiosity + 8);
      return {
        vector,
        lastUpdatedAt: signal.emittedAt,
        dominantEmotion: 'CONFIDENCE',
        confidenceSwingDelta: 10,
      };

    case 'SOVEREIGNTY_ACHIEVED':
      vector.confidence = clampScore100(vector.confidence + 24);
      vector.relief = clampScore100(vector.relief + 20);
      vector.dominance = clampScore100(vector.dominance + 18);
      return {
        vector,
        lastUpdatedAt: signal.emittedAt,
        dominantEmotion: 'DOMINANCE',
        confidenceSwingDelta: 24,
      };

    case 'RUN_ENDED':
      vector.relief = clampScore100(vector.relief + 10);
      return {
        vector,
        lastUpdatedAt: signal.emittedAt,
        dominantEmotion: 'RELIEF',
        confidenceSwingDelta: 0,
      };

    default:
      return {
        ...current,
        vector,
        lastUpdatedAt: signal.emittedAt,
      };
  }
}

function buildImmediateSignalMessages(
  state: ChatEngineState,
  signal: ChatUpstreamSignal,
  targetChannel: ChatVisibleChannel,
): readonly ChatMessage[] {
  const messages: ChatMessage[] = [];
  const pressureTier = state.messagesByChannel[targetChannel]
    .slice(-1)[0]?.pressureTier;
  const tickTier = state.messagesByChannel[targetChannel]
    .slice(-1)[0]?.tickTier;

  switch (signal.signalType) {
    case 'PRESSURE_TIER_CHANGED':
      messages.push(
        buildLocalSystemMessage({
          id: (`sys:pressure:${signal.emittedAt}`) as ChatMessageId,
          channel: targetChannel,
          kind: 'MARKET_ALERT',
          body: `PRESSURE → ${signal.nextTier}. The room should feel the cost now.`,
          at: signal.emittedAt,
          emoji: '📈',
          pressureTier: signal.nextTier,
          tickTier,
        }),
      );
      break;

    case 'TICK_TIER_CHANGED':
      messages.push(
        buildLocalSystemMessage({
          id: (`sys:tick:${signal.emittedAt}`) as ChatMessageId,
          channel: targetChannel,
          kind: 'SYSTEM',
          body: `TICK TIER → ${signal.nextTier}. Timing just became part of the threat model.`,
          at: signal.emittedAt,
          emoji: '⏱️',
          pressureTier,
          tickTier: signal.nextTier,
        }),
      );
      break;

    case 'BOT_ATTACK_FIRED':
      messages.push(
        buildLocalSystemMessage({
          id: (`sys:attack:${signal.emittedAt}`) as ChatMessageId,
          channel: targetChannel,
          kind: 'BOT_ATTACK',
          body: `HATER ATTACK FIRED — ${safeString(signal.botId, 'UNKNOWN_BOT')} opened an attack window.`,
          at: signal.emittedAt,
          emoji: '⚔️',
          pressureTier,
          tickTier,
        }),
      );
      break;

    case 'SHIELD_LAYER_BREACHED':
      messages.push(
        buildLocalSystemMessage({
          id: (`sys:breach:${signal.emittedAt}`) as ChatMessageId,
          channel: targetChannel,
          kind: 'SHIELD_EVENT',
          body: `SHIELD BREACHED — ${safeString(signal.layerId, 'UNKNOWN_LAYER')} fell to zero integrity.`,
          at: signal.emittedAt,
          emoji: '🛡️',
          pressureTier,
          tickTier,
        }),
      );
      break;

    case 'CASCADE_CHAIN_STARTED':
      messages.push(
        buildLocalSystemMessage({
          id: (`sys:cascade-start:${signal.emittedAt}`) as ChatMessageId,
          channel: targetChannel,
          kind: 'CASCADE_ALERT',
          body: `CASCADE STARTED — ${safeString(signal.chainId, 'UNKNOWN_CHAIN')} is now live.`,
          at: signal.emittedAt,
          emoji: '⛓️',
          pressureTier,
          tickTier,
        }),
      );
      break;

    case 'CASCADE_CHAIN_BROKEN':
      messages.push(
        buildLocalSystemMessage({
          id: (`sys:cascade-broken:${signal.emittedAt}`) as ChatMessageId,
          channel: targetChannel,
          kind: 'CASCADE_ALERT',
          body: `CASCADE BROKEN — ${safeString(signal.chainId, 'UNKNOWN_CHAIN')} was intercepted.`,
          at: signal.emittedAt,
          emoji: '✂️',
          pressureTier,
          tickTier,
        }),
      );
      break;

    case 'SOVEREIGNTY_APPROACH':
      messages.push(
        buildLocalSystemMessage({
          id: (`sys:sovereignty-approach:${signal.emittedAt}`) as ChatMessageId,
          channel: targetChannel,
          kind: 'ACHIEVEMENT',
          body: 'SOVEREIGNTY APPROACH — the run just entered witnessed prestige territory.',
          at: signal.emittedAt,
          emoji: '⚡',
          pressureTier,
          tickTier,
        }),
      );
      break;

    case 'SOVEREIGNTY_ACHIEVED':
      messages.push(
        buildLocalSystemMessage({
          id: (`sys:sovereignty:${signal.emittedAt}`) as ChatMessageId,
          channel: targetChannel,
          kind: 'LEGEND_MOMENT',
          body: 'LEGEND MOMENT — sovereignty achieved under witnessed pressure.',
          at: signal.emittedAt,
          emoji: '🏆',
          legend: {
            legendClass: 'SOVEREIGNTY',
            title: 'Sovereignty Achieved',
            prestigeScore: 95,
            unlocksReward: true,
          },
          replay: {
            replayEligible: true,
            legendEligible: true,
            worldEventEligible: false,
          } as ChatReplayMeta,
          pressureTier,
          tickTier,
        }),
      );
      break;

    case 'RUN_STARTED':
      messages.push(
        buildLocalSystemMessage({
          id: (`sys:run-start:${signal.emittedAt}`) as ChatMessageId,
          channel: targetChannel,
          kind: 'SYSTEM',
          body: 'RUN STARTED — the room is live and already watching.',
          at: signal.emittedAt,
          emoji: '▶️',
        }),
      );
      break;

    case 'RUN_ENDED':
      messages.push(
        buildLocalSystemMessage({
          id: (`sys:run-ended:${signal.emittedAt}`) as ChatMessageId,
          channel: targetChannel,
          kind: 'POST_RUN_RITUAL',
          body: 'RUN ENDED — the run is over, but the witnesses remain.',
          at: signal.emittedAt,
          emoji: '⏹️',
        }),
      );
      break;

    default:
      break;
  }

  return messages;
}

function buildScenePlanFromSignal(
  signal: ChatUpstreamSignal,
  channel: ChatVisibleChannel,
): Nullable<ChatScenePlan> {
  switch (signal.signalType) {
    case 'SHIELD_LAYER_BREACHED':
      return {
        sceneId: (`scene:breach:${signal.emittedAt}`) as any,
        momentId: (`moment:breach:${signal.emittedAt}`) as any,
        momentType: 'SHIELD_BREACH',
        primaryChannel: channel,
        beats: [
          {
            beatType: 'SYSTEM_NOTICE',
            delayMs: 0,
            requiredChannel: channel,
            skippable: false,
            canInterrupt: true,
          },
          {
            beatType: 'HATER_ENTRY',
            delayMs: 120,
            requiredChannel: channel,
            skippable: false,
            canInterrupt: true,
          },
          {
            beatType: 'HELPER_INTERVENTION',
            delayMs: 460,
            requiredChannel: channel,
            skippable: false,
            canInterrupt: true,
          },
        ],
        startedAt: signal.emittedAt,
        expectedDurationMs: 460,
        allowPlayerComposerDuringScene: true,
        cancellableByAuthoritativeEvent: true,
      };

    case 'CASCADE_CHAIN_STARTED':
      return {
        sceneId: (`scene:cascade:${signal.emittedAt}`) as any,
        momentId: (`moment:cascade:${signal.emittedAt}`) as any,
        momentType: 'CASCADE_TRIGGER',
        primaryChannel: channel,
        beats: [
          {
            beatType: 'SYSTEM_NOTICE',
            delayMs: 0,
            requiredChannel: channel,
            skippable: false,
            canInterrupt: true,
          },
          {
            beatType: 'SILENCE',
            delayMs: 220,
            requiredChannel: channel,
            skippable: false,
            canInterrupt: false,
          },
          {
            beatType: 'POST_BEAT_ECHO',
            delayMs: 400,
            requiredChannel: channel,
            skippable: true,
            canInterrupt: true,
          },
        ],
        startedAt: signal.emittedAt,
        expectedDurationMs: 400,
        allowPlayerComposerDuringScene: true,
        cancellableByAuthoritativeEvent: true,
      };

    default:
      return null;
  }
}

function buildSilenceDecisionFromSignal(
  signal: ChatUpstreamSignal,
): Nullable<ChatSilenceDecision> {
  switch (signal.signalType) {
    case 'SHIELD_LAYER_BREACHED':
      return {
        enforced: true,
        durationMs: 320,
        reason: 'DREAD',
        breakConditions: ['HELPER_RESCUE', 'PLAYER_REPLY_WINDOW'],
      };

    case 'CASCADE_CHAIN_STARTED':
      return {
        enforced: true,
        durationMs: 280,
        reason: 'SCENE_COMPOSITION',
        breakConditions: ['POST_BEAT_ECHO', 'PLAYER_REPLY_WINDOW'],
      };

    default:
      return null;
  }
}

function shouldOfferRescueAfterSignal(
  state: ChatEngineState,
  signal: ChatUpstreamSignal,
): boolean {
  if (signal.signalType !== 'SHIELD_LAYER_BREACHED' && signal.signalType !== 'BOT_ATTACK_FIRED') {
    return false;
  }

  const affect = state.affect.vector;
  return (
    affect.frustration >= 50 ||
    affect.intimidation >= 50 ||
    affect.desperation >= 45
  );
}

function buildRescueDecisionFromSignal(
  state: ChatEngineState,
  signal: ChatUpstreamSignal,
  channel: ChatVisibleChannel,
): ChatRescueDecision {
  const calm = signal.signalType === 'SHIELD_LAYER_BREACHED';
  return {
    interventionId: (`rescue:${signal.signalType}:${signal.emittedAt}`) as any,
    intent: calm ? 'CALM' : 'WARN',
    urgency: clampScore100(calm ? 68 : 56),
    helperPersonaId: calm ? 'SURVIVOR' : 'MENTOR',
    deliverInChannel: channel,
    respectSilenceFirst: calm,
    triggerAt: signal.emittedAt,
  };
}

// ============================================================================
// MARK: Transition trace helpers
// ============================================================================

export function traceChatReducerTransition(
  state: ChatEngineState,
  action: ChatReducerAction,
  meta: ChatReducerMeta = {},
): ChatReducerTransition {
  const previousState = cloneChatEngineState(state);
  const result = reduceChatState(state, action, meta);
  const nextState = cloneChatEngineState(result.state);

  return {
    previousState,
    nextState,
    action,
    changed: previousState !== nextState,
  };
}

// ============================================================================
// MARK: Batch reduce helpers
// ============================================================================

export function reduceChatStateBatch(
  state: ChatEngineState,
  actions: readonly ChatReducerAction[],
  meta: ChatReducerMeta = {},
): ChatReducerResult {
  let nextState = state;
  let stagedMessage: Nullable<ChatMessage> = null;
  let dueReveals: readonly ChatRevealSchedule[] = [];
  let appendedRescueMessage: Nullable<ChatMessage> = null;

  for (const action of actions) {
    const result = reduceChatState(nextState, action, meta);
    nextState = result.state;

    if (result.sideChannel.stagedMessage) {
      stagedMessage = result.sideChannel.stagedMessage;
    }
    if (result.sideChannel.dueReveals?.length) {
      dueReveals = [...dueReveals, ...result.sideChannel.dueReveals];
    }
    if (result.sideChannel.appendedRescueMessage) {
      appendedRescueMessage = result.sideChannel.appendedRescueMessage;
    }
  }

  return {
    state: trimChatStateWindow(nextState),
    sideChannel: {
      stagedMessage: stagedMessage ?? undefined,
      dueReveals,
      appendedRescueMessage: appendedRescueMessage ?? undefined,
    },
  };
}

// ============================================================================
// MARK: Feature snapshot convenience reducer adapter
// ============================================================================

export function deriveFeatureSnapshotAfterAction(
  state: ChatEngineState,
  action: ChatReducerAction,
  meta: ChatReducerMeta = {},
): ChatFeatureSnapshot {
  const result = reduceChatState(state, action, meta);
  const next = result.state;
  const activeChannel = next.activeVisibleChannel;

  return deriveFeatureSnapshotFromState(next, {
    now: meta.now ?? (Date.now() as UnixMs),
    panelOpen: meta.panelOpen ?? false,
    currentMountTarget: next.activeMountTarget,
    activeChannel,
    composerLength: next.composer.draftByChannel[activeChannel].length,
    silenceWindowMs: next.currentSilence?.durationMs ?? 0,
    pressureTier: latestPressureTier(next),
    tickTier: latestTickTier(next),
    haterHeat: latestHaterHeatApproximation(next),
    dropOffSignals: {
      silenceAfterCollapseMs: next.currentSilence?.durationMs ?? 0,
      repeatedComposerDeletes: 0,
      panelCollapseCount: meta.panelCollapsed ? 1 : 0,
      channelHopCount: 0,
      failedInputCount: 0,
      negativeEmotionScore: highestNegativeAffect(next.affect),
    },
  });
}

// ============================================================================
// MARK: Public action synthesizers for ChatEngine integration
// ============================================================================

export function createSendMessageActionFromRequest(
  request: ChatClientSendMessageRequest,
  sender: {
    readonly senderId: string;
    readonly senderName: string;
    readonly senderRank?: string;
  },
): ChatReducerAction<'CHAT_LOCAL_MESSAGE_STAGED'> {
  return ChatReducerActions.localMessageStaged({
    requestId: request.requestId,
    roomId: request.roomId,
    channelId: request.channelId,
    body: request.body,
    senderId: sender.senderId,
    senderName: sender.senderName,
    senderRank: sender.senderRank,
    at: request.clientSentAt,
  });
}

export function createTypingPruneAction(
  now: UnixMs,
): ChatReducerAction<'CHAT_TYPING_PRUNED'> {
  return ChatReducerActions.typingPruned({ now });
}

export function createAuthoritativeApplyAction(
  frame: ChatAuthoritativeFrame,
  options: {
    readonly activeRoomId?: ChatRoomId;
    readonly activeSessionId?: ChatSessionId;
  } = {},
): ChatReducerAction<'CHAT_AUTHORITATIVE_FRAME_APPLIED'> {
  return ChatReducerActions.authoritativeFrameApplied({
    frame,
    activeRoomId: options.activeRoomId,
    activeSessionId: options.activeSessionId,
  });
}

// ============================================================================
// MARK: Internal reducer helpers
// ============================================================================

function unchanged(state: ChatEngineState): ChatReducerResult {
  return {
    state,
    sideChannel: {},
  };
}

function changed(state: ChatEngineState): ChatReducerResult {
  return {
    state: trimChatStateWindow(state),
    sideChannel: {},
  };
}

function nextAllowedVisibleChannel(
  mountTarget: ChatMountTarget,
  preferred: ChatVisibleChannel,
): ChatVisibleChannel {
  const preset = CHAT_MOUNT_PRESETS[mountTarget];
  return preset.allowedVisibleChannels.includes(preferred)
    ? preferred
    : preset.defaultVisibleChannel;
}

function clampScore100(value: number): Score100 {
  if (Number.isNaN(value)) return 0 as Score100;
  if (value < 0) return 0 as Score100;
  if (value > 100) return 100 as Score100;
  return Math.round(value) as Score100;
}

function safeString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (value == null) return fallback;
  return String(value);
}

function latestPressureTier(state: ChatEngineState): PressureTier | undefined {
  const latest = getLatestVisibleMessage(state, state.activeVisibleChannel);
  return latest?.pressureTier;
}

function latestTickTier(state: ChatEngineState): TickTier | undefined {
  const latest = getLatestVisibleMessage(state, state.activeVisibleChannel);
  return latest?.tickTier;
}

function latestHaterHeatApproximation(state: ChatEngineState): number {
  const heat = state.audienceHeat[state.activeVisibleChannel].heat;
  return heat;
}

function highestNegativeAffect(affect: ChatAffectSnapshot): Score100 {
  return Math.max(
    affect.vector.frustration,
    affect.vector.intimidation,
    affect.vector.desperation,
    affect.vector.embarrassment,
  ) as Score100;
}

function rescueCopyForIntent(
  intent: ChatRescueDecision['intent'],
): string {
  switch (intent) {
    case 'CALM':
      return 'Breathe. The breach is real, but panic is still optional.';
    case 'WARN':
      return 'Do not hand the room a second mistake immediately after the first one.';
    case 'SIMPLIFY':
      return 'One clean decision now is worth more than five frantic reactions.';
    case 'PROTECT_DIGNITY':
      return 'You do not need to perform confidence for the room. Stabilize first.';
    case 'OFFER_EXIT':
      return 'If you need the smallest safe line, take it. Survival still counts.';
    case 'COACH':
    default:
      return 'Read the state, then answer it. Do not answer the fear first.';
  }
}

function cloneMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    sender: message.sender ? { ...message.sender } : undefined,
    moderation: message.moderation ? { ...message.moderation } : undefined,
    proof: message.proof ? { ...message.proof } : undefined,
    replay: message.replay ? { ...message.replay } : undefined,
    legend: message.legend ? { ...message.legend } : undefined,
    audit: message.audit ? { ...message.audit } : undefined,
    meta: message.meta
      ? {
          ...message.meta,
          botSource: message.meta.botSource ? { ...message.meta.botSource } : undefined,
          shieldMeta: message.meta.shieldMeta ? { ...message.meta.shieldMeta } : undefined,
          cascadeMeta: message.meta.cascadeMeta ? { ...message.meta.cascadeMeta } : undefined,
          pressure: message.meta.pressure ? { ...message.meta.pressure } : undefined,
          tick: message.meta.tick ? { ...message.meta.tick } : undefined,
          dealRoom: message.meta.dealRoom ? { ...message.meta.dealRoom } : undefined,
        }
      : undefined,
    readReceipts: message.readReceipts?.map((r) => ({ ...r })),
    relationshipIds: message.relationshipIds ? [...message.relationshipIds] : undefined,
    quoteIds: message.quoteIds ? [...message.quoteIds] : undefined,
    tags: message.tags ? [...message.tags] : undefined,
  };
}

function normalizeMessageWindowForReducer(
  messages: readonly ChatMessage[],
): readonly ChatMessage[] {
  const dedup = new Map<string, ChatMessage>();

  for (const message of messages) {
    const key = [
      message.id,
      message.audit?.requestId ?? '',
      message.proofHash ?? message.proof?.proofHash ?? '',
      message.senderId,
      message.kind,
      message.ts,
      message.body,
    ].join('::');

    dedup.set(key, cloneMessage(message));
  }

  return [...dedup.values()]
    .sort((a, b) => {
      if (a.ts !== b.ts) return a.ts - b.ts;
      return a.id < b.id ? -1 : 1;
    })
    .slice(-CHAT_ENGINE_CONSTANTS.maxVisibleMessagesDefault);
}

function defaultTargetChannelForSignal(
  mountTarget: ChatMountTarget,
  signal: ChatUpstreamSignal,
): ChatVisibleChannel {
  switch (signal.signalType) {
    case 'RUN_STARTED':
      return nextAllowedVisibleChannel(mountTarget, 'LOBBY');
    case 'DEAL_PROOF_ISSUED':
      return nextAllowedVisibleChannel(mountTarget, 'DEAL_ROOM');
    default:
      return nextAllowedVisibleChannel(mountTarget, 'GLOBAL');
  }
}

// ============================================================================
// MARK: End
// ============================================================================