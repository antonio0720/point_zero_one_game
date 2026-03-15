/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT CURSOR CONTRACTS
 * FILE: shared/contracts/chat/ChatCursor.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared contract surface for chat cursor state, transcript window
 * position, replay anchors, composer caret state, selection synchronization,
 * read-head motion, and transport-safe cursor fanout used by:
 *
 *   - /shared/contracts/chat
 *   - /pzo-web/src/engines/chat
 *   - /pzo-web/src/components/chat
 *   - /backend/src/game/engine/chat
 *   - /pzo-server/src/chat
 *
 * Design laws
 * -----------
 * 1. Cursor state must represent more than a caret. It must carry transcript
 *    navigation, replay anchoring, visibility windows, and read-position truth.
 * 2. Frontend may stage viewport movement instantly, but backend remains the
 *    authority for replay anchors, transcript cursors, and read progression.
 * 3. Cursor contracts must stay safe for server transport without importing
 *    runtime reducers or engine implementations.
 * 4. Composer cursor, transcript cursor, replay cursor, and read cursor are
 *    separate but interoperable domains.
 * 5. This file must preserve the donor `ChatClientCursorRequest` and
 *    `ChatCursorSnapshot` shape while expanding it into a full authority lane.
 * ============================================================================
 */

import {
  type Brand,
  type ChatChannelDescriptor,
  type ChatChannelFamily,
  type ChatChannelId,
  type ChatModeScope,
  type ChatMountPreset,
  type ChatMountTarget,
  type ChatRoomId,
  type ChatShadowChannel,
  type ChatVisibleChannel,
  type JsonObject,
  type Optional,
  type Score01,
  type UnixMs,
  CHAT_CHANNEL_DESCRIPTORS,
  CHAT_CONTRACT_AUTHORITIES,
  CHAT_CONTRACT_VERSION,
  CHAT_MOUNT_PRESETS,
  CHAT_MODE_SCOPES,
  isChatChannelId,
  isChatMountTarget,
  isChatModeScope,
} from './ChatChannels';

import {
  type ChatActorKind,
  type ChatAuthority,
  type ChatCursorId as LegacyChatCursorId,
  type ChatCursorSnapshot as LegacyChatCursorSnapshot,
  type ChatClientCursorRequest as LegacyChatClientCursorRequest,
  type ChatMessageId,
  type ChatRange,
  type ChatReplayId,
  type ChatRequestId,
  type ChatSceneId,
  type ChatSessionId,
  type ChatUserId,
  CHAT_ACTOR_KINDS,
  CHAT_AUTHORITIES,
} from './ChatEvents';

// ============================================================================
// MARK: Branded identifiers local to cursor contracts
// ============================================================================

export type ChatCursorId = LegacyChatCursorId;
export type ChatCursorEnvelopeId = Brand<string, 'ChatCursorEnvelopeId'>;
export type ChatCursorFrameId = Brand<string, 'ChatCursorFrameId'>;
export type ChatCursorPlanId = Brand<string, 'ChatCursorPlanId'>;
export type ChatCursorAnchorId = Brand<string, 'ChatCursorAnchorId'>;
export type ChatCursorWindowId = Brand<string, 'ChatCursorWindowId'>;
export type ChatCursorViewportId = Brand<string, 'ChatCursorViewportId'>;
export type ChatCursorSelectionId = Brand<string, 'ChatCursorSelectionId'>;
export type ChatCursorTelemetryId = Brand<string, 'ChatCursorTelemetryId'>;
export type ChatCursorRosterId = Brand<string, 'ChatCursorRosterId'>;
export type ChatCursorSequenceId = Brand<number, 'ChatCursorSequenceId'>;
export type ChatCursorSubjectId = Brand<string, 'ChatCursorSubjectId'>;
export type ChatCursorActorKey = Brand<string, 'ChatCursorActorKey'>;

// ============================================================================
// MARK: Legacy compatibility aliases
// ============================================================================

export type LegacyCompatibleChatCursorSnapshot = LegacyChatCursorSnapshot;
export type LegacyCompatibleChatClientCursorRequest =
  LegacyChatClientCursorRequest;

// ============================================================================
// MARK: Cursor vocabularies
// ============================================================================

export const CHAT_CURSOR_SURFACES = [
  'COMPOSER',
  'TRANSCRIPT',
  'THREAD',
  'REPLAY',
  'READ_HEAD',
  'LEGEND',
  'DEAL_ROOM',
  'SYSTEM',
] as const;

export type ChatCursorSurface = (typeof CHAT_CURSOR_SURFACES)[number];

export const CHAT_CURSOR_SUBJECT_KINDS = [
  'MESSAGE',
  'THREAD',
  'WINDOW',
  'SCENE',
  'REPLAY_EVENT',
  'LEGEND_MOMENT',
  'OFFER',
  'COMPOSER_DRAFT',
  'READ_HEAD',
] as const;

export type ChatCursorSubjectKind =
  (typeof CHAT_CURSOR_SUBJECT_KINDS)[number];

export const CHAT_CURSOR_INTENTS = [
  'EDIT',
  'SELECT',
  'NAVIGATE',
  'REPLAY',
  'READ_SYNC',
  'FOLLOW_LIVE',
  'FOCUS_MESSAGE',
  'FOCUS_OFFER',
  'SCENE_REVEAL',
] as const;

export type ChatCursorIntent = (typeof CHAT_CURSOR_INTENTS)[number];

export const CHAT_CURSOR_ANCHOR_KINDS = [
  'START',
  'END',
  'MESSAGE_ID',
  'SEQUENCE_NUMBER',
  'TIMESTAMP',
  'SCENE_ID',
  'REPLAY_MARK',
  'LEGEND_ID',
  'READ_HEAD',
  'OFFER_ID',
] as const;

export type ChatCursorAnchorKind = (typeof CHAT_CURSOR_ANCHOR_KINDS)[number];

export const CHAT_CURSOR_PAGINATION_DIRECTIONS = [
  'NONE',
  'OLDER',
  'NEWER',
  'BOTH',
] as const;

export type ChatCursorPaginationDirection =
  (typeof CHAT_CURSOR_PAGINATION_DIRECTIONS)[number];

export const CHAT_CURSOR_VISIBILITY_CLASSES = [
  'VISIBLE',
  'SHADOW',
  'AUTHOR_ONLY',
  'SYSTEM_ONLY',
] as const;

export type ChatCursorVisibilityClass =
  (typeof CHAT_CURSOR_VISIBILITY_CLASSES)[number];

export const CHAT_CURSOR_MERGE_POLICIES = [
  'LAST_WRITE_WINS',
  'AUTHORITATIVE_OVERRIDES',
  'SERVER_CLOCK_WINS',
  'READ_HEAD_AHEAD_WINS',
  'VIEWPORT_STAGED_UNTIL_ACK',
] as const;

export type ChatCursorMergePolicy =
  (typeof CHAT_CURSOR_MERGE_POLICIES)[number];

export const CHAT_CURSOR_SUPPRESSION_REASONS = [
  'CHANNEL_HIDDEN',
  'ROOM_UNAVAILABLE',
  'SESSION_MUTED',
  'REPLAY_LOCKED',
  'PRIVACY_POLICY',
  'THREAD_NOT_LOADED',
  'SHADOW_ONLY_POLICY',
  'AUTHORITY_REJECTED',
] as const;

export type ChatCursorSuppressionReason =
  (typeof CHAT_CURSOR_SUPPRESSION_REASONS)[number];

export const CHAT_CURSOR_TELEMETRY_EVENT_NAMES = [
  'cursor_updated',
  'cursor_window_shifted',
  'cursor_anchor_changed',
  'cursor_selection_changed',
  'cursor_follow_live_enabled',
  'cursor_follow_live_disabled',
  'cursor_replay_seeked',
  'cursor_read_head_moved',
  'cursor_rejected',
  'cursor_suppressed',
] as const;

export type ChatCursorTelemetryEventName =
  (typeof CHAT_CURSOR_TELEMETRY_EVENT_NAMES)[number];

export const CHAT_CURSOR_CONTROL_OPS = [
  'UPSERT_CURSOR',
  'REMOVE_CURSOR',
  'CLEAR_CHANNEL',
  'CLEAR_ROOM',
  'SHIFT_WINDOW',
  'SET_ANCHOR',
  'SET_READ_HEAD',
  'ACK_REQUEST',
  'REJECT_REQUEST',
] as const;

export type ChatCursorControlOp = (typeof CHAT_CURSOR_CONTROL_OPS)[number];

// ============================================================================
// MARK: Fine-grained caret and selection contracts
// ============================================================================

export interface ChatCaretPosition {
  readonly index: number;
  readonly line?: number;
  readonly column?: number;
  readonly affinity?: 'FORWARD' | 'BACKWARD';
}

export interface ChatSelectionRange {
  readonly selectionId: ChatCursorSelectionId;
  readonly anchor: ChatCaretPosition;
  readonly focus: ChatCaretPosition;
  readonly normalized: ChatRange;
  readonly direction: 'FORWARD' | 'BACKWARD';
  readonly isCollapsed: boolean;
}

export interface ChatComposerCursorState {
  readonly caret?: ChatCaretPosition;
  readonly selection?: ChatSelectionRange;
  readonly composerLength?: number;
  readonly draftPreview?: string;
  readonly draftVersion?: number;
  readonly dirty: boolean;
}

// ============================================================================
// MARK: Transcript and viewport cursor contracts
// ============================================================================

export interface ChatCursorAnchor {
  readonly anchorId: ChatCursorAnchorId;
  readonly kind: ChatCursorAnchorKind;
  readonly messageId?: ChatMessageId;
  readonly replayId?: ChatReplayId;
  readonly sceneId?: ChatSceneId;
  readonly legendId?: string;
  readonly timestamp?: UnixMs;
  readonly sequenceNumber?: number;
  readonly offerId?: string;
  readonly description?: string;
}

export interface ChatTranscriptWindow {
  readonly windowId: ChatCursorWindowId;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly messageCount: number;
  readonly direction: ChatCursorPaginationDirection;
  readonly overscanBefore: number;
  readonly overscanAfter: number;
  readonly stickToBottom: boolean;
  readonly followLive: boolean;
}

export interface ChatViewportCursorState {
  readonly viewportId: ChatCursorViewportId;
  readonly scrollTop?: number;
  readonly scrollHeight?: number;
  readonly clientHeight?: number;
  readonly firstVisibleMessageId?: ChatMessageId;
  readonly lastVisibleMessageId?: ChatMessageId;
  readonly focusMessageId?: ChatMessageId;
  readonly pinnedMessageIds?: readonly ChatMessageId[];
  readonly highlightMessageId?: ChatMessageId;
}

export interface ChatReplayCursorState {
  readonly replayId?: ChatReplayId;
  readonly frameIndex?: number;
  readonly anchorMessageId?: ChatMessageId;
  readonly anchorTimestamp?: UnixMs;
  readonly isSeeking: boolean;
  readonly playbackDirection?: 'FORWARD' | 'BACKWARD';
  readonly playbackRate?: number;
}

export interface ChatReadCursorState {
  readonly lastReadMessageId?: ChatMessageId;
  readonly lastReadAt?: UnixMs;
  readonly unreadCount?: number;
  readonly followReadHead: boolean;
}

export interface ChatOfferCursorState {
  readonly offerId?: string;
  readonly focusField?:
    | 'PRICE'
    | 'QUANTITY'
    | 'TERMS'
    | 'ESCROW'
    | 'DEADLINE'
    | 'COUNTER';
  readonly negotiationStage?:
    | 'OPEN'
    | 'COUNTER'
    | 'STALL'
    | 'CLOSE'
    | 'ABANDONED';
}

// ============================================================================
// MARK: Canonical cursor snapshots
// ============================================================================

export interface ChatCursorSnapshot extends LegacyCompatibleChatCursorSnapshot {
  readonly roomId: ChatRoomId;
  readonly authority: ChatAuthority;
  readonly surface: ChatCursorSurface;
  readonly intent: ChatCursorIntent;
  readonly visibilityClass: ChatCursorVisibilityClass;
  readonly subjectKind?: ChatCursorSubjectKind;
  readonly subjectId?: ChatCursorSubjectId;
  readonly anchor?: ChatCursorAnchor;
  readonly composer?: ChatComposerCursorState;
  readonly window?: ChatTranscriptWindow;
  readonly viewport?: ChatViewportCursorState;
  readonly replay?: ChatReplayCursorState;
  readonly read?: ChatReadCursorState;
  readonly offer?: ChatOfferCursorState;
  readonly mountTarget?: ChatMountTarget;
  readonly modeScope?: ChatModeScope;
  readonly requestId?: ChatRequestId;
  readonly visibleToPlayer?: boolean;
  readonly suppressionReason?: ChatCursorSuppressionReason;
  readonly shadowCompanionChannel?: ChatShadowChannel;
}

export interface ChatCursorActorState {
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly latest?: ChatCursorSnapshot;
  readonly history: readonly ChatCursorSnapshot[];
}

export interface ChatCursorChannelState {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly family: ChatChannelFamily;
  readonly descriptor: ChatChannelDescriptor;
  readonly actors: Readonly<Record<string, ChatCursorActorState>>;
  readonly followLiveActors: readonly string[];
  readonly updatedAt: UnixMs;
}

export interface ChatCursorRoomState {
  readonly roomId: ChatRoomId;
  readonly channels: Readonly<Record<ChatChannelId, ChatCursorChannelState>>;
  readonly authority: ChatAuthority;
  readonly updatedAt: UnixMs;
}

export interface ChatCursorRosterSnapshot {
  readonly rosterId: ChatCursorRosterId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly authority: ChatAuthority;
  readonly cursors: readonly ChatCursorSnapshot[];
  readonly syncedAt: UnixMs;
}

// ============================================================================
// MARK: Cursor plans and shifts
// ============================================================================

export interface ChatCursorWindowShift {
  readonly from?: ChatTranscriptWindow;
  readonly to: ChatTranscriptWindow;
  readonly reason:
    | 'PAGINATION'
    | 'FOLLOW_LIVE'
    | 'SCENE_REVEAL'
    | 'REPLAY_SEEK'
    | 'FOCUS_MESSAGE'
    | 'READ_HEAD_SYNC';
  readonly occurredAt: UnixMs;
}

export interface ChatCursorPlan {
  readonly planId: ChatCursorPlanId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly surface: ChatCursorSurface;
  readonly intent: ChatCursorIntent;
  readonly anchor?: ChatCursorAnchor;
  readonly targetWindow?: ChatTranscriptWindow;
  readonly focusMessageId?: ChatMessageId;
  readonly replay?: ChatReplayCursorState;
  readonly read?: ChatReadCursorState;
  readonly createdAt: UnixMs;
}

// ============================================================================
// MARK: Authority decisions and merges
// ============================================================================

export interface ChatCursorMergeDecision {
  readonly accepted: boolean;
  readonly mergePolicy: ChatCursorMergePolicy;
  readonly replacesExisting: boolean;
  readonly reason?: string;
}

export interface ChatCursorGatingDecision {
  readonly allowed: boolean;
  readonly authority: ChatAuthority;
  readonly suppressVisibleBroadcast: boolean;
  readonly suppressionReason?: ChatCursorSuppressionReason;
  readonly normalizedIntent: ChatCursorIntent;
  readonly normalizedSurface: ChatCursorSurface;
  readonly reason?: string;
}

export interface ChatCursorAuthorityFrame {
  readonly frameId: ChatCursorFrameId;
  readonly roomId: ChatRoomId;
  readonly authority: ChatAuthority;
  readonly roster?: ChatCursorRosterSnapshot;
  readonly diff?: readonly ChatCursorDiffOp[];
  readonly gating?: ChatCursorGatingDecision;
  readonly syncedAt: UnixMs;
}

export interface ChatCursorDiffOp {
  readonly op: ChatCursorControlOp;
  readonly roomId?: ChatRoomId;
  readonly channelId?: ChatChannelId;
  readonly actorId?: string;
  readonly cursor?: ChatCursorSnapshot;
  readonly shift?: ChatCursorWindowShift;
  readonly reason?: string;
}

// ============================================================================
// MARK: Client requests and transport envelopes
// ============================================================================

export interface ChatClientCursorRequest
  extends LegacyCompatibleChatClientCursorRequest {
  readonly requestId?: ChatRequestId;
  readonly sessionId?: ChatSessionId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatVisibleChannel;
  readonly sentAt: UnixMs;
  readonly surface?: ChatCursorSurface;
  readonly intent?: ChatCursorIntent;
  readonly subjectKind?: ChatCursorSubjectKind;
  readonly subjectId?: ChatCursorSubjectId;
  readonly anchor?: ChatCursorAnchor;
  readonly followLive?: boolean;
  readonly focusMessageId?: ChatMessageId;
  readonly viewport?: ChatViewportCursorState;
  readonly replay?: ChatReplayCursorState;
  readonly read?: ChatReadCursorState;
  readonly mountTarget?: ChatMountTarget;
  readonly modeScope?: ChatModeScope;
}

export interface ChatCursorQueryRequest {
  readonly roomId: ChatRoomId;
  readonly channelId?: ChatChannelId;
  readonly actorId?: string;
  readonly actorKind?: ChatActorKind;
  readonly includeShadow: boolean;
}

export interface ChatCursorAck {
  readonly envelopeId: ChatCursorEnvelopeId;
  readonly requestId?: ChatRequestId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly authority: ChatAuthority;
  readonly accepted: boolean;
  readonly receivedAt: UnixMs;
}

export interface ChatCursorReject {
  readonly envelopeId: ChatCursorEnvelopeId;
  readonly requestId?: ChatRequestId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly accepted: false;
  readonly rejectionReason:
    | 'INVALID_CHANNEL'
    | 'INVALID_ROOM'
    | 'REPLAY_LOCKED'
    | 'PRIVACY_POLICY'
    | 'SHADOW_ONLY_POLICY'
    | 'AUTHORITY_REJECTED';
  readonly receivedAt: UnixMs;
}

export interface ChatCursorEnvelope {
  readonly envelopeId: ChatCursorEnvelopeId;
  readonly authority: ChatAuthority;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly requestId?: ChatRequestId;
  readonly ack?: ChatCursorAck;
  readonly reject?: ChatCursorReject;
  readonly roster?: ChatCursorRosterSnapshot;
  readonly diff?: readonly ChatCursorDiffOp[];
  readonly cursor?: ChatCursorSnapshot;
  readonly frame?: ChatCursorAuthorityFrame;
  readonly sentAt: UnixMs;
}

// ============================================================================
// MARK: Telemetry contracts
// ============================================================================

export interface ChatCursorTelemetryEvent {
  readonly telemetryId: ChatCursorTelemetryId;
  readonly eventName: ChatCursorTelemetryEventName;
  readonly authority: ChatAuthority;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly cursorId?: ChatCursorId;
  readonly requestId?: ChatRequestId;
  readonly occurredAt: UnixMs;
  readonly attributes?: JsonObject;
}

// ============================================================================
// MARK: Descriptor tables and defaults
// ============================================================================

export const CHAT_CURSOR_DEFAULTS_BY_SURFACE: Readonly<
  Record<ChatCursorSurface, { readonly allowSelection: boolean; readonly allowFollowLive: boolean; readonly allowReplaySeek: boolean; }>
> = Object.freeze({
  COMPOSER: { allowSelection: true, allowFollowLive: false, allowReplaySeek: false },
  TRANSCRIPT: { allowSelection: true, allowFollowLive: true, allowReplaySeek: false },
  THREAD: { allowSelection: true, allowFollowLive: true, allowReplaySeek: false },
  REPLAY: { allowSelection: false, allowFollowLive: false, allowReplaySeek: true },
  READ_HEAD: { allowSelection: false, allowFollowLive: true, allowReplaySeek: false },
  LEGEND: { allowSelection: false, allowFollowLive: false, allowReplaySeek: true },
  DEAL_ROOM: { allowSelection: true, allowFollowLive: true, allowReplaySeek: false },
  SYSTEM: { allowSelection: false, allowFollowLive: true, allowReplaySeek: false },
});

export const CHAT_CURSOR_DEFAULTS_BY_MOUNT: Readonly<
  Record<ChatMountTarget, { readonly initialWindow: number; readonly followLiveByDefault: boolean; readonly surface: ChatCursorSurface; }>
> = Object.freeze({
  BATTLE_HUD: { initialWindow: 60, followLiveByDefault: true, surface: 'TRANSCRIPT' },
  CLUB_UI: { initialWindow: 40, followLiveByDefault: true, surface: 'TRANSCRIPT' },
  EMPIRE_GAME_SCREEN: { initialWindow: 70, followLiveByDefault: true, surface: 'TRANSCRIPT' },
  GAME_BOARD: { initialWindow: 55, followLiveByDefault: true, surface: 'TRANSCRIPT' },
  LEAGUE_UI: { initialWindow: 45, followLiveByDefault: true, surface: 'TRANSCRIPT' },
  LOBBY_SCREEN: { initialWindow: 50, followLiveByDefault: true, surface: 'TRANSCRIPT' },
  PHANTOM_GAME_SCREEN: { initialWindow: 65, followLiveByDefault: true, surface: 'TRANSCRIPT' },
  PREDATOR_GAME_SCREEN: { initialWindow: 70, followLiveByDefault: true, surface: 'DEAL_ROOM' },
  SYNDICATE_GAME_SCREEN: { initialWindow: 75, followLiveByDefault: true, surface: 'TRANSCRIPT' },
  POST_RUN_SUMMARY: { initialWindow: 100, followLiveByDefault: false, surface: 'REPLAY' },
});

export const CHAT_CURSOR_INTENTS_BY_CHANNEL_FAMILY: Readonly<
  Record<ChatChannelFamily, readonly ChatCursorIntent[]>
> = Object.freeze({
  PUBLIC: ['EDIT', 'NAVIGATE', 'FOLLOW_LIVE', 'READ_SYNC', 'FOCUS_MESSAGE'],
  PRIVATE: ['EDIT', 'NAVIGATE', 'FOLLOW_LIVE', 'READ_SYNC', 'FOCUS_MESSAGE'],
  NEGOTIATION: ['EDIT', 'NAVIGATE', 'FOLLOW_LIVE', 'READ_SYNC', 'FOCUS_OFFER'],
  PRE_RUN: ['EDIT', 'NAVIGATE', 'FOLLOW_LIVE', 'READ_SYNC'],
  SHADOW: ['NAVIGATE', 'SCENE_REVEAL', 'REPLAY', 'READ_SYNC'],
});

// ============================================================================
// MARK: Validation and helper guards
// ============================================================================

export function isChatCursorSurface(value: string): value is ChatCursorSurface {
  return (CHAT_CURSOR_SURFACES as readonly string[]).includes(value);
}

export function isChatCursorIntent(value: string): value is ChatCursorIntent {
  return (CHAT_CURSOR_INTENTS as readonly string[]).includes(value);
}

export function isChatCursorAnchorKind(
  value: string,
): value is ChatCursorAnchorKind {
  return (CHAT_CURSOR_ANCHOR_KINDS as readonly string[]).includes(value);
}

export function isChatCursorVisibilityClass(
  value: string,
): value is ChatCursorVisibilityClass {
  return (CHAT_CURSOR_VISIBILITY_CLASSES as readonly string[]).includes(value);
}

export function isChatCursorTelemetryEventName(
  value: string,
): value is ChatCursorTelemetryEventName {
  return (CHAT_CURSOR_TELEMETRY_EVENT_NAMES as readonly string[]).includes(value);
}

export function createCursorActorKey(
  roomId: ChatRoomId,
  channelId: ChatChannelId,
  actorId: string,
): ChatCursorActorKey {
  return `${roomId}:${channelId}:${actorId}` as ChatCursorActorKey;
}

export function normalizeCursorRequest(
  request: ChatClientCursorRequest,
): ChatClientCursorRequest {
  return {
    ...request,
    surface:
      request.surface && isChatCursorSurface(request.surface)
        ? request.surface
        : 'COMPOSER',
    intent:
      request.intent && isChatCursorIntent(request.intent)
        ? request.intent
        : 'EDIT',
  };
}

export function toLegacyCursorSnapshot(
  snapshot: ChatCursorSnapshot,
): LegacyCompatibleChatCursorSnapshot {
  return {
    cursorId: snapshot.cursorId,
    actorId: snapshot.actorId,
    actorKind: snapshot.actorKind,
    channelId: snapshot.channelId as ChatVisibleChannel,
    roomId: snapshot.roomId,
    updatedAt: snapshot.updatedAt,
    caretIndex: snapshot.caretIndex,
    selection: snapshot.selection,
    composerLength: snapshot.composerLength,
    draftPreview: snapshot.draftPreview,
  };
}

export function buildCursorFrame(
  roomId: ChatRoomId,
  authority: ChatAuthority,
  roster: ChatCursorRosterSnapshot,
): ChatCursorAuthorityFrame {
  return {
    frameId: `cursor-frame:${roomId}:${roster.syncedAt}` as ChatCursorFrameId,
    roomId,
    authority,
    roster,
    syncedAt: roster.syncedAt,
  };
}

export function buildDefaultTranscriptWindow(
  mountTarget: ChatMountTarget,
): ChatTranscriptWindow {
  const defaults = CHAT_CURSOR_DEFAULTS_BY_MOUNT[mountTarget];

  return {
    windowId: `cursor-window:${mountTarget}` as ChatCursorWindowId,
    startIndex: 0,
    endIndex: defaults.initialWindow,
    messageCount: defaults.initialWindow,
    direction: 'NONE',
    overscanBefore: 12,
    overscanAfter: 12,
    stickToBottom: defaults.followLiveByDefault,
    followLive: defaults.followLiveByDefault,
  };
}

export function buildComposerCursorSnapshot(
  params: {
    cursorId: ChatCursorId;
    actorId: string;
    actorKind: ChatActorKind;
    roomId: ChatRoomId;
    channelId: ChatVisibleChannel;
    updatedAt: UnixMs;
    composer?: ChatComposerCursorState;
    mountTarget?: ChatMountTarget;
    modeScope?: ChatModeScope;
    requestId?: ChatRequestId;
  },
): ChatCursorSnapshot {
  return {
    cursorId: params.cursorId,
    actorId: params.actorId,
    actorKind: params.actorKind,
    channelId: params.channelId,
    roomId: params.roomId,
    updatedAt: params.updatedAt,
    caretIndex: params.composer?.caret?.index,
    selection: params.composer?.selection?.normalized,
    composerLength: params.composer?.composerLength,
    draftPreview: params.composer?.draftPreview,
    authority: 'CLIENT_STAGED',
    surface: 'COMPOSER',
    intent: 'EDIT',
    visibilityClass: 'AUTHOR_ONLY',
    composer: params.composer,
    mountTarget: params.mountTarget,
    modeScope: params.modeScope,
    requestId: params.requestId,
  };
}

// ============================================================================
// MARK: Descriptor snapshot for introspection
// ============================================================================

export const CHAT_CURSOR_CONTRACT_DESCRIPTOR = Object.freeze({
  file: 'shared/contracts/chat/ChatCursor.ts',
  version: CHAT_CONTRACT_VERSION,
  authorities: CHAT_CONTRACT_AUTHORITIES,
  actorKinds: CHAT_ACTOR_KINDS,
  authorityLevels: CHAT_AUTHORITIES,
  cursorSurfaces: CHAT_CURSOR_SURFACES,
  cursorSubjectKinds: CHAT_CURSOR_SUBJECT_KINDS,
  cursorIntents: CHAT_CURSOR_INTENTS,
  cursorAnchorKinds: CHAT_CURSOR_ANCHOR_KINDS,
  cursorTelemetryEvents: CHAT_CURSOR_TELEMETRY_EVENT_NAMES,
  cursorMergePolicies: CHAT_CURSOR_MERGE_POLICIES,
  modeScopes: CHAT_MODE_SCOPES,
  mountTargets: Object.keys(CHAT_MOUNT_PRESETS) as readonly ChatMountTarget[],
} as const);

export type ChatCursorContractDescriptor =
  typeof CHAT_CURSOR_CONTRACT_DESCRIPTOR;

// ============================================================================
// MARK: Extended cursor query and focus contracts
// ============================================================================

export interface ChatCursorFocusRequest {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly messageId?: ChatMessageId;
  readonly anchor?: ChatCursorAnchor;
  readonly intent: Extract<
    ChatCursorIntent,
    'FOCUS_MESSAGE' | 'FOCUS_OFFER' | 'SCENE_REVEAL'
  >;
  readonly sentAt: UnixMs;
}

export interface ChatCursorReplaySeekRequest {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly replayId: ChatReplayId;
  readonly anchor?: ChatCursorAnchor;
  readonly frameIndex?: number;
  readonly playbackDirection?: 'FORWARD' | 'BACKWARD';
  readonly sentAt: UnixMs;
}

export interface ChatCursorWindowRequest {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly direction: ChatCursorPaginationDirection;
  readonly aroundMessageId?: ChatMessageId;
  readonly targetSize: number;
  readonly sentAt: UnixMs;
}

export interface ChatCursorReadSyncRequest {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly lastReadMessageId?: ChatMessageId;
  readonly followReadHead: boolean;
  readonly sentAt: UnixMs;
}

export interface ChatCursorViewportPolicy {
  readonly preserveSelectionAcrossFrames: boolean;
  readonly preserveFocusOnWindowShift: boolean;
  readonly snapToBottomOnLiveMessage: boolean;
  readonly suppressFocusStealDuringTyping: boolean;
  readonly replayOverridesLiveFollow: boolean;
}

export interface ChatCursorPrivacyPolicy {
  readonly broadcastComposerState: boolean;
  readonly broadcastDraftPreview: boolean;
  readonly broadcastSelectionRange: boolean;
  readonly visibleCursorClass: ChatCursorVisibilityClass;
  readonly shadowMirrorChannel?: ChatShadowChannel;
}

export interface ChatCursorDescriptor {
  readonly surface: ChatCursorSurface;
  readonly allowComposerState: boolean;
  readonly allowViewportState: boolean;
  readonly allowReplayState: boolean;
  readonly allowReadState: boolean;
  readonly allowOfferState: boolean;
  readonly defaultVisibilityClass: ChatCursorVisibilityClass;
  readonly defaultIntent: ChatCursorIntent;
  readonly defaultViewportPolicy: ChatCursorViewportPolicy;
  readonly defaultPrivacyPolicy: ChatCursorPrivacyPolicy;
}

export const CHAT_CURSOR_DESCRIPTORS: Readonly<
  Record<ChatCursorSurface, ChatCursorDescriptor>
> = Object.freeze({
  COMPOSER: {
    surface: 'COMPOSER',
    allowComposerState: true,
    allowViewportState: false,
    allowReplayState: false,
    allowReadState: false,
    allowOfferState: false,
    defaultVisibilityClass: 'AUTHOR_ONLY',
    defaultIntent: 'EDIT',
    defaultViewportPolicy: {
      preserveSelectionAcrossFrames: true,
      preserveFocusOnWindowShift: true,
      snapToBottomOnLiveMessage: false,
      suppressFocusStealDuringTyping: true,
      replayOverridesLiveFollow: false,
    },
    defaultPrivacyPolicy: {
      broadcastComposerState: false,
      broadcastDraftPreview: false,
      broadcastSelectionRange: false,
      visibleCursorClass: 'AUTHOR_ONLY',
    },
  },
  TRANSCRIPT: {
    surface: 'TRANSCRIPT',
    allowComposerState: false,
    allowViewportState: true,
    allowReplayState: false,
    allowReadState: true,
    allowOfferState: false,
    defaultVisibilityClass: 'VISIBLE',
    defaultIntent: 'NAVIGATE',
    defaultViewportPolicy: {
      preserveSelectionAcrossFrames: false,
      preserveFocusOnWindowShift: true,
      snapToBottomOnLiveMessage: true,
      suppressFocusStealDuringTyping: true,
      replayOverridesLiveFollow: true,
    },
    defaultPrivacyPolicy: {
      broadcastComposerState: false,
      broadcastDraftPreview: false,
      broadcastSelectionRange: false,
      visibleCursorClass: 'VISIBLE',
    },
  },
  THREAD: {
    surface: 'THREAD',
    allowComposerState: false,
    allowViewportState: true,
    allowReplayState: false,
    allowReadState: true,
    allowOfferState: false,
    defaultVisibilityClass: 'VISIBLE',
    defaultIntent: 'NAVIGATE',
    defaultViewportPolicy: {
      preserveSelectionAcrossFrames: false,
      preserveFocusOnWindowShift: true,
      snapToBottomOnLiveMessage: false,
      suppressFocusStealDuringTyping: true,
      replayOverridesLiveFollow: true,
    },
    defaultPrivacyPolicy: {
      broadcastComposerState: false,
      broadcastDraftPreview: false,
      broadcastSelectionRange: false,
      visibleCursorClass: 'VISIBLE',
    },
  },
  REPLAY: {
    surface: 'REPLAY',
    allowComposerState: false,
    allowViewportState: true,
    allowReplayState: true,
    allowReadState: false,
    allowOfferState: false,
    defaultVisibilityClass: 'SYSTEM_ONLY',
    defaultIntent: 'REPLAY',
    defaultViewportPolicy: {
      preserveSelectionAcrossFrames: false,
      preserveFocusOnWindowShift: true,
      snapToBottomOnLiveMessage: false,
      suppressFocusStealDuringTyping: true,
      replayOverridesLiveFollow: true,
    },
    defaultPrivacyPolicy: {
      broadcastComposerState: false,
      broadcastDraftPreview: false,
      broadcastSelectionRange: false,
      visibleCursorClass: 'SYSTEM_ONLY',
    },
  },
  READ_HEAD: {
    surface: 'READ_HEAD',
    allowComposerState: false,
    allowViewportState: false,
    allowReplayState: false,
    allowReadState: true,
    allowOfferState: false,
    defaultVisibilityClass: 'VISIBLE',
    defaultIntent: 'READ_SYNC',
    defaultViewportPolicy: {
      preserveSelectionAcrossFrames: false,
      preserveFocusOnWindowShift: false,
      snapToBottomOnLiveMessage: false,
      suppressFocusStealDuringTyping: true,
      replayOverridesLiveFollow: false,
    },
    defaultPrivacyPolicy: {
      broadcastComposerState: false,
      broadcastDraftPreview: false,
      broadcastSelectionRange: false,
      visibleCursorClass: 'VISIBLE',
    },
  },
  LEGEND: {
    surface: 'LEGEND',
    allowComposerState: false,
    allowViewportState: true,
    allowReplayState: true,
    allowReadState: false,
    allowOfferState: false,
    defaultVisibilityClass: 'VISIBLE',
    defaultIntent: 'SCENE_REVEAL',
    defaultViewportPolicy: {
      preserveSelectionAcrossFrames: false,
      preserveFocusOnWindowShift: true,
      snapToBottomOnLiveMessage: false,
      suppressFocusStealDuringTyping: true,
      replayOverridesLiveFollow: true,
    },
    defaultPrivacyPolicy: {
      broadcastComposerState: false,
      broadcastDraftPreview: false,
      broadcastSelectionRange: false,
      visibleCursorClass: 'VISIBLE',
    },
  },
  DEAL_ROOM: {
    surface: 'DEAL_ROOM',
    allowComposerState: true,
    allowViewportState: true,
    allowReplayState: false,
    allowReadState: true,
    allowOfferState: true,
    defaultVisibilityClass: 'VISIBLE',
    defaultIntent: 'FOCUS_OFFER',
    defaultViewportPolicy: {
      preserveSelectionAcrossFrames: true,
      preserveFocusOnWindowShift: true,
      snapToBottomOnLiveMessage: true,
      suppressFocusStealDuringTyping: true,
      replayOverridesLiveFollow: true,
    },
    defaultPrivacyPolicy: {
      broadcastComposerState: false,
      broadcastDraftPreview: false,
      broadcastSelectionRange: false,
      visibleCursorClass: 'VISIBLE',
    },
  },
  SYSTEM: {
    surface: 'SYSTEM',
    allowComposerState: false,
    allowViewportState: true,
    allowReplayState: false,
    allowReadState: false,
    allowOfferState: false,
    defaultVisibilityClass: 'SYSTEM_ONLY',
    defaultIntent: 'FOLLOW_LIVE',
    defaultViewportPolicy: {
      preserveSelectionAcrossFrames: false,
      preserveFocusOnWindowShift: true,
      snapToBottomOnLiveMessage: true,
      suppressFocusStealDuringTyping: true,
      replayOverridesLiveFollow: true,
    },
    defaultPrivacyPolicy: {
      broadcastComposerState: false,
      broadcastDraftPreview: false,
      broadcastSelectionRange: false,
      visibleCursorClass: 'SYSTEM_ONLY',
    },
  },
});
