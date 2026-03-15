/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT TRANSCRIPT CONTRACTS
 * FILE: shared/contracts/chat/ChatTranscript.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared contract surface for transcript truth, transcript windows,
 * proof-linked message history, replay indexing, excerpt generation, search,
 * export, redaction, buffer compatibility, and ledger synchronization used by:
 *
 *   - /shared/contracts/chat
 *   - /pzo-web/src/engines/chat
 *   - /pzo-web/src/components/chat
 *   - /backend/src/game/engine/chat
 *   - /pzo-server/src/chat
 *
 * Design laws
 * -----------
 * 1. Transcript is not a UI list. It is a ledger with visible, shadow, proof,
 *    replay, search, and redaction semantics.
 * 2. Frontend may stage message buffers quickly, but backend remains the final
 *    authority for transcript history, redaction, replay indexing, and proof.
 * 3. Shared transcript contracts must be import-safe for frontend, backend,
 *    and transport without pulling reducer or socket implementation code.
 * 4. Visible channels and shadow channels stay first-class because the repo’s
 *    live chat doctrine explicitly treats invisible state as part of authored
 *    dramaturgy and pressure, not debug residue. citeturn171000view0
 * 5. This file preserves compatibility with the donor `ChatTranscriptBufferApi`
 *    and the current pzo-web engine state shape, while upgrading transcript
 *    into the long-term shared authority lane. citeturn171000view0
 * ============================================================================
 */

import {
  type Brand,
  type ChatChannelDescriptor,
  type ChatChannelFamily,
  type ChatChannelId,
  type ChatMountPreset,
  type ChatMountTarget,
  type ChatModeScope,
  type ChatRoomId,
  type ChatShadowChannel,
  type ChatVisibleChannel,
  type JsonObject,
  type JsonValue,
  type Nullable,
  type Optional,
  type Score01,
  type Score100,
  type TickNumber,
  type UnixMs,
  CHAT_ALL_CHANNELS,
  CHAT_CHANNEL_DESCRIPTORS,
  CHAT_CONTRACT_AUTHORITIES,
  CHAT_CONTRACT_VERSION,
  CHAT_MOUNT_PRESETS,
  CHAT_SHADOW_CHANNELS,
  CHAT_VISIBLE_CHANNELS,
  channelExposesProofHashes,
  channelSupportsReplay,
  channelSupportsShadowWrites,
} from './ChatChannels';

import {
  type ChatActorKind,
  type ChatAuditMeta,
  type ChatAuthority,
  type ChatCausalEdgeId,
  type ChatLegendId,
  type ChatLegendMeta,
  type ChatMomentId,
  type ChatMomentType,
  type ChatMessage,
  type ChatMessageId,
  type ChatMessageKind,
  type ChatNotificationKind,
  type ChatProofHash,
  type ChatProofMeta,
  type ChatReadReceipt,
  type ChatReplayId,
  type ChatReplayMeta,
  type ChatRequestId,
  type ChatSceneId,
  type ChatSequenceNumber,
  type ChatSessionId,
  type ChatTelemetryId,
  type ChatUserId,
  type ChatWorldEventId,
} from './ChatEvents';

import {
  type ChatCanonicalMessage,
  type ChatExcerptId,
  type ChatMessageAuditEntry,
  type ChatMessageDeliveryEnvelope,
  type ChatMessageModerationEnvelope,
  type ChatMessageProofEnvelope,
  type ChatMessageReadReceipt,
  type ChatMessageVersion,
  type ChatQuoteReference,
  type ChatReplyReference,
  type ChatThreadId,
  type ChatThreadReference,
} from './ChatMessage';

import {
  type ChatCursorSnapshot,
  type ChatTranscriptWindow,
  buildDefaultTranscriptWindow,
} from './ChatCursor';

// ============================================================================
// MARK: Foundational transcript IDs and branded keys
// ============================================================================

export type ChatTranscriptId = Brand<string, 'ChatTranscriptId'>;
export type ChatTranscriptLedgerId = Brand<string, 'ChatTranscriptLedgerId'>;
export type ChatTranscriptSliceId = Brand<string, 'ChatTranscriptSliceId'>;
export type ChatTranscriptBatchId = Brand<string, 'ChatTranscriptBatchId'>;
export type ChatTranscriptQueryId = Brand<string, 'ChatTranscriptQueryId'>;
export type ChatTranscriptRangeId = Brand<string, 'ChatTranscriptRangeId'>;
export type ChatTranscriptPointerId = Brand<string, 'ChatTranscriptPointerId'>;
export type ChatTranscriptNonce = Brand<string, 'ChatTranscriptNonce'>;
export type ChatTranscriptCheckpointId = Brand<string, 'ChatTranscriptCheckpointId'>;
export type ChatTranscriptDiffId = Brand<string, 'ChatTranscriptDiffId'>;
export type ChatTranscriptSnapshotId = Brand<string, 'ChatTranscriptSnapshotId'>;
export type ChatTranscriptExportId = Brand<string, 'ChatTranscriptExportId'>;
export type ChatTranscriptAnchorId = Brand<string, 'ChatTranscriptAnchorId'>;
export type ChatTranscriptExcerptId = Brand<string, 'ChatTranscriptExcerptId'>;
export type ChatTranscriptProofEdgeId = Brand<string, 'ChatTranscriptProofEdgeId'>;
export type ChatTranscriptMutationId = Brand<string, 'ChatTranscriptMutationId'>;
export type ChatTranscriptPolicyId = Brand<string, 'ChatTranscriptPolicyId'>;
export type ChatTranscriptCursorSyncId = Brand<string, 'ChatTranscriptCursorSyncId'>;
export type ChatTranscriptRetentionKey = Brand<string, 'ChatTranscriptRetentionKey'>;
export type ChatTranscriptSearchToken = Brand<string, 'ChatTranscriptSearchToken'>;

// ============================================================================
// MARK: Transcript classifications and policies
// ============================================================================

export const CHAT_TRANSCRIPT_SLICE_KINDS = [
  'VISIBLE_CHANNEL',
  'SHADOW_CHANNEL',
  'ROOM_AGGREGATE',
  'THREAD',
  'SCENE',
  'MOMENT',
  'REPLAY_SEGMENT',
  'EXPORT_VIEW',
] as const;

export type ChatTranscriptSliceKind = (typeof CHAT_TRANSCRIPT_SLICE_KINDS)[number];

export const CHAT_TRANSCRIPT_RETENTION_CLASSES = [
  'EPHEMERAL',
  'RUN_SCOPED',
  'ROOM_SCOPED',
  'PLAYER_MEMORY',
  'PROOF_CRITICAL',
  'REPLAY_CRITICAL',
  'LEGEND_ARCHIVE',
] as const;

export type ChatTranscriptRetentionClass =
  (typeof CHAT_TRANSCRIPT_RETENTION_CLASSES)[number];

export const CHAT_TRANSCRIPT_QUERY_INTENTS = [
  'LATEST',
  'WINDOW',
  'SEARCH_TEXT',
  'SEARCH_TAG',
  'SEARCH_MESSAGE_ID',
  'SEARCH_THREAD',
  'SEARCH_SCENE',
  'SEARCH_MOMENT',
  'SEARCH_REPLAY',
  'SEARCH_WORLD_EVENT',
  'SEARCH_RELATIONSHIP_CALLBACK',
  'AUDIT',
  'EXPORT',
] as const;

export type ChatTranscriptQueryIntent =
  (typeof CHAT_TRANSCRIPT_QUERY_INTENTS)[number];

export const CHAT_TRANSCRIPT_SEARCH_SCOPES = [
  'ACTIVE_CHANNEL',
  'VISIBLE_CHANNELS',
  'SHADOW_CHANNELS',
  'ROOM_WIDE',
  'THREAD_ONLY',
  'SCENE_ONLY',
  'MOMENT_ONLY',
  'WORLD_EVENT_ONLY',
  'REPLAY_ONLY',
] as const;

export type ChatTranscriptSearchScope =
  (typeof CHAT_TRANSCRIPT_SEARCH_SCOPES)[number];

export const CHAT_TRANSCRIPT_SORT_MODES = [
  'SEQUENCE_ASC',
  'SEQUENCE_DESC',
  'TIME_ASC',
  'TIME_DESC',
  'SALience_DESC',
] as const;

export type ChatTranscriptSortMode = (typeof CHAT_TRANSCRIPT_SORT_MODES)[number];

export const CHAT_TRANSCRIPT_REDACTION_MODES = [
  'NONE',
  'MASK_BODY',
  'HIDE_FROM_VISIBLE',
  'SOFT_DELETE',
  'PROOF_ONLY',
  'SHADOW_ONLY',
] as const;

export type ChatTranscriptRedactionMode =
  (typeof CHAT_TRANSCRIPT_REDACTION_MODES)[number];

export const CHAT_TRANSCRIPT_EXPORT_FORMATS = [
  'JSON',
  'JSONL',
  'MARKDOWN',
  'AUDIT_LEDGER',
  'REPLAY_TIMELINE',
] as const;

export type ChatTranscriptExportFormat =
  (typeof CHAT_TRANSCRIPT_EXPORT_FORMATS)[number];

export const CHAT_TRANSCRIPT_CURSOR_SYNC_MODES = [
  'NONE',
  'FOLLOW_READ_CURSOR',
  'FOLLOW_VIEWPORT',
  'FOLLOW_REPLAY_CURSOR',
  'LOCK_TO_THREAD',
] as const;

export type ChatTranscriptCursorSyncMode =
  (typeof CHAT_TRANSCRIPT_CURSOR_SYNC_MODES)[number];

// ============================================================================
// MARK: Core transcript descriptors
// ============================================================================

export interface ChatTranscriptAuthorityStamp {
  readonly ledgerId: ChatTranscriptLedgerId;
  readonly currentAuthority: ChatAuthority;
  readonly acceptedBy?: 'CLIENT' | 'SERVER' | 'BACKEND';
  readonly authoritativeAt?: UnixMs;
  readonly requestId?: ChatRequestId;
  readonly sessionId?: ChatSessionId;
  readonly telemetryId?: ChatTelemetryId;
  readonly contractVersion: typeof CHAT_CONTRACT_VERSION;
}

export interface ChatTranscriptSequenceRange {
  readonly rangeId: ChatTranscriptRangeId;
  readonly roomId: ChatRoomId;
  readonly channelId?: ChatChannelId;
  readonly startSequence: ChatSequenceNumber;
  readonly endSequence: ChatSequenceNumber;
  readonly inclusive: boolean;
}

export interface ChatTranscriptTimeRange {
  readonly rangeId: ChatTranscriptRangeId;
  readonly startAt: UnixMs;
  readonly endAt: UnixMs;
  readonly inclusive: boolean;
}

export interface ChatTranscriptPointer {
  readonly pointerId: ChatTranscriptPointerId;
  readonly roomId: ChatRoomId;
  readonly channelId?: ChatChannelId;
  readonly messageId?: ChatMessageId;
  readonly sequenceNumber?: ChatSequenceNumber;
  readonly cursor?: ChatCursorSnapshot;
  readonly window?: ChatTranscriptWindow;
}

export interface ChatTranscriptLocator {
  readonly roomId: ChatRoomId;
  readonly channelId?: ChatChannelId;
  readonly mountTarget?: ChatMountTarget;
  readonly mountPreset?: ChatMountPreset;
  readonly modeScope?: ChatModeScope;
}

export interface ChatTranscriptExcerpt {
  readonly excerptId: ChatTranscriptExcerptId;
  readonly messageId: ChatMessageId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly bodyText: string;
  readonly highlightedText?: string;
  readonly reason: string;
  readonly salience01: Score01;
}

export interface ChatTranscriptIndexEntry {
  readonly messageId: ChatMessageId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly sequenceNumber?: ChatSequenceNumber;
  readonly threadId?: ChatThreadId;
  readonly sceneId?: ChatSceneId;
  readonly momentId?: ChatMomentId;
  readonly worldEventId?: ChatWorldEventId;
  readonly createdAt: UnixMs;
  readonly bodyText: string;
  readonly searchTokens: readonly ChatTranscriptSearchToken[];
  readonly tags: readonly string[];
  readonly replayId?: ChatReplayId;
  readonly legendId?: ChatLegendId;
  readonly proofHash?: ChatProofHash;
  readonly playerVisible: boolean;
}

export interface ChatTranscriptFilter {
  readonly includeChannels?: readonly ChatChannelId[];
  readonly excludeChannels?: readonly ChatChannelId[];
  readonly includeKinds?: readonly ChatMessageKind[];
  readonly includeSenderIds?: readonly string[];
  readonly includeActorKinds?: readonly ChatActorKind[];
  readonly includeThreadIds?: readonly ChatThreadId[];
  readonly includeSceneIds?: readonly ChatSceneId[];
  readonly includeMomentIds?: readonly ChatMomentId[];
  readonly includeLegendIds?: readonly ChatLegendId[];
  readonly includeReplayIds?: readonly ChatReplayId[];
  readonly includeWorldEventIds?: readonly ChatWorldEventId[];
  readonly includeTags?: readonly string[];
  readonly visibilityPlayerOnly?: boolean;
  readonly proofRequired?: boolean;
  readonly replayEligibleOnly?: boolean;
  readonly legendOnly?: boolean;
}

export interface ChatTranscriptQuery {
  readonly queryId: ChatTranscriptQueryId;
  readonly locator: ChatTranscriptLocator;
  readonly intent: ChatTranscriptQueryIntent;
  readonly searchScope: ChatTranscriptSearchScope;
  readonly sequenceRange?: ChatTranscriptSequenceRange;
  readonly timeRange?: ChatTranscriptTimeRange;
  readonly cursorSyncMode?: ChatTranscriptCursorSyncMode;
  readonly pointer?: ChatTranscriptPointer;
  readonly searchText?: string;
  readonly filter?: ChatTranscriptFilter;
  readonly sortMode?: ChatTranscriptSortMode;
  readonly limit: number;
  readonly offset: number;
  readonly includeReceipts: boolean;
  readonly includeProofGraph: boolean;
  readonly includeReplayAnchors: boolean;
  readonly includeExcerpts: boolean;
}

export interface ChatTranscriptHit {
  readonly message: ChatCanonicalMessage;
  readonly indexEntry: ChatTranscriptIndexEntry;
  readonly excerpt?: ChatTranscriptExcerpt;
  readonly score01: Score01;
}

// ============================================================================
// MARK: Proof, replay, legend, and audit bridges
// ============================================================================

export interface ChatTranscriptProofEdge {
  readonly edgeId: ChatTranscriptProofEdgeId;
  readonly fromMessageId: ChatMessageId;
  readonly toMessageId?: ChatMessageId;
  readonly toEventId?: string;
  readonly relation: string;
  readonly proofHash?: ChatProofHash;
  readonly parentProofHash?: ChatProofHash;
  readonly playerVisible: boolean;
}

export interface ChatTranscriptProofGraph {
  readonly roomId: ChatRoomId;
  readonly channelId?: ChatChannelId;
  readonly messageIds: readonly ChatMessageId[];
  readonly edges: readonly ChatTranscriptProofEdge[];
  readonly builtAt: UnixMs;
}

export interface ChatTranscriptReplayAnchor {
  readonly anchorId: ChatTranscriptAnchorId;
  readonly replayId: ChatReplayId;
  readonly messageId: ChatMessageId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly replayOffsetMs?: number;
  readonly momentType?: ChatMomentType;
  readonly worldEventId?: ChatWorldEventId;
  readonly createdAt: UnixMs;
}

export interface ChatTranscriptLegendAnchor {
  readonly anchorId: ChatTranscriptAnchorId;
  readonly legendId: ChatLegendId;
  readonly messageId: ChatMessageId;
  readonly title?: string;
  readonly legendClass?: ChatLegendMeta['legendClass'];
  readonly prestigeScore?: number;
}

export interface ChatTranscriptAuditEnvelope {
  readonly messageId: ChatMessageId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly requestId?: ChatRequestId;
  readonly telemetryId?: ChatTelemetryId;
  readonly messageAuditTrail: readonly ChatMessageAuditEntry[];
  readonly auditMeta?: ChatAuditMeta;
}

export interface ChatTranscriptReceiptAggregate {
  readonly messageId: ChatMessageId;
  readonly visibleReceiptCount: number;
  readonly hiddenReceiptCount: number;
  readonly readByActorIds: readonly string[];
  readonly latestReadAt?: UnixMs;
}

// ============================================================================
// MARK: Transcript slice state
// ============================================================================

export interface ChatTranscriptSliceBase {
  readonly sliceId: ChatTranscriptSliceId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly kind: ChatTranscriptSliceKind;
  readonly descriptor: ChatChannelDescriptor;
  readonly retentionClass: ChatTranscriptRetentionClass;
  readonly nonce: ChatTranscriptNonce;
  readonly authority: ChatTranscriptAuthorityStamp;
  readonly messageIds: readonly ChatMessageId[];
  readonly messagesById: Readonly<Record<string, ChatCanonicalMessage>>;
  readonly indexByMessageId: Readonly<Record<string, ChatTranscriptIndexEntry>>;
  readonly proofEdgesByMessageId: Readonly<Record<string, readonly ChatTranscriptProofEdge[]>>;
  readonly replayAnchorsByMessageId: Readonly<Record<string, readonly ChatTranscriptReplayAnchor[]>>;
  readonly legendAnchorsByMessageId: Readonly<Record<string, readonly ChatTranscriptLegendAnchor[]>>;
  readonly auditByMessageId: Readonly<Record<string, ChatTranscriptAuditEnvelope>>;
  readonly receiptsByMessageId: Readonly<Record<string, ChatTranscriptReceiptAggregate>>;
  readonly sequenceFloor?: ChatSequenceNumber;
  readonly sequenceCeil?: ChatSequenceNumber;
  readonly lastUpdatedAt?: UnixMs;
}

export interface ChatVisibleTranscriptSlice extends ChatTranscriptSliceBase {
  readonly channelId: ChatVisibleChannel;
  readonly kind: 'VISIBLE_CHANNEL' | 'ROOM_AGGREGATE' | 'THREAD' | 'SCENE' | 'MOMENT' | 'REPLAY_SEGMENT' | 'EXPORT_VIEW';
}

export interface ChatShadowTranscriptSlice extends ChatTranscriptSliceBase {
  readonly channelId: ChatShadowChannel;
  readonly kind: 'SHADOW_CHANNEL' | 'ROOM_AGGREGATE' | 'SCENE' | 'MOMENT' | 'REPLAY_SEGMENT' | 'EXPORT_VIEW';
}

export type ChatAnyTranscriptSlice =
  | ChatVisibleTranscriptSlice
  | ChatShadowTranscriptSlice;

export interface ChatTranscriptRoomState {
  readonly roomId: ChatRoomId;
  readonly visibleSlicesByChannel: Readonly<Record<ChatVisibleChannel, ChatVisibleTranscriptSlice>>;
  readonly shadowSlicesByChannel: Readonly<Record<ChatShadowChannel, ChatShadowTranscriptSlice>>;
  readonly aggregateSlice: ChatTranscriptSliceBase;
  readonly threadSlicesByThreadId: Readonly<Record<string, ChatTranscriptSliceBase>>;
  readonly sceneSlicesBySceneId: Readonly<Record<string, ChatTranscriptSliceBase>>;
  readonly momentSlicesByMomentId: Readonly<Record<string, ChatTranscriptSliceBase>>;
  readonly replaySlicesByReplayId: Readonly<Record<string, ChatTranscriptSliceBase>>;
  readonly snapshotAt: UnixMs;
}

export interface ChatTranscriptLedgerState {
  readonly transcriptId: ChatTranscriptId;
  readonly ledgerId: ChatTranscriptLedgerId;
  readonly roomsById: Readonly<Record<string, ChatTranscriptRoomState>>;
  readonly version: typeof CHAT_CONTRACT_VERSION;
  readonly generatedAt: UnixMs;
  readonly cursorSyncModeByRoomId: Readonly<Record<string, ChatTranscriptCursorSyncMode>>;
}

// ============================================================================
// MARK: Mutations, diffs, and checkpoints
// ============================================================================

export interface ChatTranscriptAppendMutation {
  readonly mutationId: ChatTranscriptMutationId;
  readonly kind: 'APPEND';
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly message: ChatCanonicalMessage;
}

export interface ChatTranscriptAppendBatchMutation {
  readonly mutationId: ChatTranscriptMutationId;
  readonly kind: 'APPEND_BATCH';
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly messages: readonly ChatCanonicalMessage[];
}

export interface ChatTranscriptRedactionMutation {
  readonly mutationId: ChatTranscriptMutationId;
  readonly kind: 'REDACT';
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly messageId: ChatMessageId;
  readonly mode: ChatTranscriptRedactionMode;
  readonly redactedBodyText?: string;
  readonly reason: string;
}

export interface ChatTranscriptReceiptMutation {
  readonly mutationId: ChatTranscriptMutationId;
  readonly kind: 'UPDATE_RECEIPTS';
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly messageId: ChatMessageId;
  readonly receipts: readonly ChatMessageReadReceipt[];
}

export type ChatTranscriptMutation =
  | ChatTranscriptAppendMutation
  | ChatTranscriptAppendBatchMutation
  | ChatTranscriptRedactionMutation
  | ChatTranscriptReceiptMutation;

export interface ChatTranscriptDiffOp {
  readonly diffId: ChatTranscriptDiffId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly op: 'APPEND' | 'UPSERT' | 'REMOVE' | 'REDACT' | 'RECEIPTS';
  readonly messageId: ChatMessageId;
  readonly at: UnixMs;
}

export interface ChatTranscriptCheckpoint {
  readonly checkpointId: ChatTranscriptCheckpointId;
  readonly transcriptId: ChatTranscriptId;
  readonly roomId: ChatRoomId;
  readonly channelId?: ChatChannelId;
  readonly createdAt: UnixMs;
  readonly messageCount: number;
  readonly sequenceFloor?: ChatSequenceNumber;
  readonly sequenceCeil?: ChatSequenceNumber;
  readonly lastMessageId?: ChatMessageId;
}

// ============================================================================
// MARK: Export, search, and snapshot shapes
// ============================================================================

export interface ChatTranscriptExportRequest {
  readonly exportId: ChatTranscriptExportId;
  readonly locator: ChatTranscriptLocator;
  readonly format: ChatTranscriptExportFormat;
  readonly filter?: ChatTranscriptFilter;
  readonly includeProofHashes: boolean;
  readonly includeAuditTrail: boolean;
  readonly includeShadowChannels: boolean;
  readonly includeReplayAnchors: boolean;
}

export interface ChatTranscriptExportResult {
  readonly exportId: ChatTranscriptExportId;
  readonly format: ChatTranscriptExportFormat;
  readonly mimeType: string;
  readonly body: string;
  readonly messageCount: number;
  readonly generatedAt: UnixMs;
}

export interface ChatTranscriptQueryResult {
  readonly queryId: ChatTranscriptQueryId;
  readonly hits: readonly ChatTranscriptHit[];
  readonly totalHits: number;
  readonly proofGraph?: ChatTranscriptProofGraph;
  readonly replayAnchors?: readonly ChatTranscriptReplayAnchor[];
  readonly generatedAt: UnixMs;
}

export interface ChatTranscriptSnapshot {
  readonly snapshotId: ChatTranscriptSnapshotId;
  readonly transcriptId: ChatTranscriptId;
  readonly roomId: ChatRoomId;
  readonly slice: ChatTranscriptSliceBase;
  readonly window: ChatTranscriptWindow;
  readonly cursorSyncMode: ChatTranscriptCursorSyncMode;
  readonly createdAt: UnixMs;
}

export interface ChatLegacyTranscriptBufferSnapshot {
  readonly channel: ChatVisibleChannel;
  readonly messages: readonly ChatMessage[];
}

// ============================================================================
// MARK: Default retention and cursor policies by channel
// ============================================================================

export interface ChatTranscriptRetentionPolicy {
  readonly retentionKey: ChatTranscriptRetentionKey;
  readonly channelId: ChatChannelId;
  readonly retentionClass: ChatTranscriptRetentionClass;
  readonly keepProofGraph: boolean;
  readonly keepReplayAnchors: boolean;
  readonly keepAuditTrail: boolean;
  readonly pruneAfterMs?: number;
  readonly exportEnabled: boolean;
  readonly searchEnabled: boolean;
}

export const CHAT_TRANSCRIPT_RETENTION_POLICIES: Readonly<Record<ChatChannelId, ChatTranscriptRetentionPolicy>> = Object.freeze({
  GLOBAL: {
    retentionKey: 'retention:global' as ChatTranscriptRetentionKey,
    channelId: 'GLOBAL',
    retentionClass: 'ROOM_SCOPED',
    keepProofGraph: true,
    keepReplayAnchors: true,
    keepAuditTrail: true,
    exportEnabled: true,
    searchEnabled: true,
  },
  SYNDICATE: {
    retentionKey: 'retention:syndicate' as ChatTranscriptRetentionKey,
    channelId: 'SYNDICATE',
    retentionClass: 'PLAYER_MEMORY',
    keepProofGraph: true,
    keepReplayAnchors: true,
    keepAuditTrail: true,
    exportEnabled: true,
    searchEnabled: true,
  },
  DEAL_ROOM: {
    retentionKey: 'retention:deal-room' as ChatTranscriptRetentionKey,
    channelId: 'DEAL_ROOM',
    retentionClass: 'PROOF_CRITICAL',
    keepProofGraph: true,
    keepReplayAnchors: true,
    keepAuditTrail: true,
    exportEnabled: true,
    searchEnabled: true,
  },
  LOBBY: {
    retentionKey: 'retention:lobby' as ChatTranscriptRetentionKey,
    channelId: 'LOBBY',
    retentionClass: 'RUN_SCOPED',
    keepProofGraph: false,
    keepReplayAnchors: true,
    keepAuditTrail: true,
    exportEnabled: true,
    searchEnabled: true,
  },
  SYSTEM_SHADOW: {
    retentionKey: 'retention:system-shadow' as ChatTranscriptRetentionKey,
    channelId: 'SYSTEM_SHADOW',
    retentionClass: 'PROOF_CRITICAL',
    keepProofGraph: true,
    keepReplayAnchors: false,
    keepAuditTrail: true,
    exportEnabled: false,
    searchEnabled: true,
  },
  NPC_SHADOW: {
    retentionKey: 'retention:npc-shadow' as ChatTranscriptRetentionKey,
    channelId: 'NPC_SHADOW',
    retentionClass: 'PLAYER_MEMORY',
    keepProofGraph: false,
    keepReplayAnchors: false,
    keepAuditTrail: true,
    exportEnabled: false,
    searchEnabled: true,
  },
  RIVALRY_SHADOW: {
    retentionKey: 'retention:rivalry-shadow' as ChatTranscriptRetentionKey,
    channelId: 'RIVALRY_SHADOW',
    retentionClass: 'PLAYER_MEMORY',
    keepProofGraph: true,
    keepReplayAnchors: true,
    keepAuditTrail: true,
    exportEnabled: false,
    searchEnabled: true,
  },
  RESCUE_SHADOW: {
    retentionKey: 'retention:rescue-shadow' as ChatTranscriptRetentionKey,
    channelId: 'RESCUE_SHADOW',
    retentionClass: 'PLAYER_MEMORY',
    keepProofGraph: false,
    keepReplayAnchors: true,
    keepAuditTrail: true,
    exportEnabled: false,
    searchEnabled: true,
  },
  LIVEOPS_SHADOW: {
    retentionKey: 'retention:liveops-shadow' as ChatTranscriptRetentionKey,
    channelId: 'LIVEOPS_SHADOW',
    retentionClass: 'LEGEND_ARCHIVE',
    keepProofGraph: true,
    keepReplayAnchors: true,
    keepAuditTrail: true,
    exportEnabled: false,
    searchEnabled: true,
  },
});

export const CHAT_TRANSCRIPT_CURSOR_SYNC_BY_MOUNT: Readonly<Record<ChatMountTarget, ChatTranscriptCursorSyncMode>> = Object.freeze({
  BATTLE_HUD: 'FOLLOW_READ_CURSOR',
  CLUB_UI: 'FOLLOW_VIEWPORT',
  EMPIRE_GAME_SCREEN: 'FOLLOW_VIEWPORT',
  GAME_BOARD: 'FOLLOW_VIEWPORT',
  LEAGUE_UI: 'FOLLOW_VIEWPORT',
  LOBBY_SCREEN: 'FOLLOW_VIEWPORT',
  PHANTOM_GAME_SCREEN: 'FOLLOW_VIEWPORT',
  PREDATOR_GAME_SCREEN: 'FOLLOW_VIEWPORT',
  SYNDICATE_GAME_SCREEN: 'LOCK_TO_THREAD',
  COUNTERPLAY_MODAL: 'LOCK_TO_THREAD',
  EMPIRE_BLEED_BANNER: 'NONE',
  MOMENT_FLASH: 'NONE',
  PROOF_CARD: 'LOCK_TO_THREAD',
  PROOF_CARD_V2: 'LOCK_TO_THREAD',
  RESCUE_WINDOW_BANNER: 'FOLLOW_READ_CURSOR',
  SABOTAGE_IMPACT_PANEL: 'NONE',
  THREAT_RADAR_PANEL: 'NONE',
  POST_RUN_SUMMARY: 'FOLLOW_VIEWPORT',
});

// ============================================================================
// MARK: Transcript slice constructors
// ============================================================================

const createTranscriptAuthorityStamp = (
  ledgerId: ChatTranscriptLedgerId,
  currentAuthority: ChatAuthority,
  now: UnixMs,
): ChatTranscriptAuthorityStamp => ({
  ledgerId,
  currentAuthority,
  acceptedBy: currentAuthority === 'CLIENT_STAGED' ? 'CLIENT' : currentAuthority === 'SERVER_ACCEPTED' ? 'SERVER' : 'BACKEND',
  authoritativeAt: now,
  contractVersion: CHAT_CONTRACT_VERSION,
});

const createTranscriptNonce = (
  roomId: ChatRoomId,
  channelId: ChatChannelId,
  now: UnixMs,
): ChatTranscriptNonce => `nonce:${roomId}:${channelId}:${now}` as ChatTranscriptNonce;

const createEmptySlice = (
  roomId: ChatRoomId,
  channelId: ChatChannelId,
  kind: ChatTranscriptSliceKind,
  authority: ChatAuthority,
  now: UnixMs,
): ChatTranscriptSliceBase => ({
  sliceId: `transcript-slice:${roomId}:${channelId}:${kind}` as ChatTranscriptSliceId,
  roomId,
  channelId,
  kind,
  descriptor: CHAT_CHANNEL_DESCRIPTORS[channelId],
  retentionClass: CHAT_TRANSCRIPT_RETENTION_POLICIES[channelId].retentionClass,
  nonce: createTranscriptNonce(roomId, channelId, now),
  authority: createTranscriptAuthorityStamp(
    `ledger:${roomId}` as ChatTranscriptLedgerId,
    authority,
    now,
  ),
  messageIds: [],
  messagesById: Object.freeze({}),
  indexByMessageId: Object.freeze({}),
  proofEdgesByMessageId: Object.freeze({}),
  replayAnchorsByMessageId: Object.freeze({}),
  legendAnchorsByMessageId: Object.freeze({}),
  auditByMessageId: Object.freeze({}),
  receiptsByMessageId: Object.freeze({}),
  lastUpdatedAt: now,
});

export const createEmptyTranscriptRoomState = (
  roomId: ChatRoomId,
  authority: ChatAuthority = 'BACKEND_LEDGER',
  now: UnixMs = Date.now() as UnixMs,
): ChatTranscriptRoomState => {
  const visibleSlicesByChannel = Object.freeze(
    Object.fromEntries(
      CHAT_VISIBLE_CHANNELS.map((channelId) => [
        channelId,
        createEmptySlice(roomId, channelId, 'VISIBLE_CHANNEL', authority, now) as ChatVisibleTranscriptSlice,
      ]),
    ) as Record<ChatVisibleChannel, ChatVisibleTranscriptSlice>,
  );

  const shadowSlicesByChannel = Object.freeze(
    Object.fromEntries(
      CHAT_SHADOW_CHANNELS.map((channelId) => [
        channelId,
        createEmptySlice(roomId, channelId, 'SHADOW_CHANNEL', authority, now) as ChatShadowTranscriptSlice,
      ]),
    ) as Record<ChatShadowChannel, ChatShadowTranscriptSlice>,
  );

  return Object.freeze({
    roomId,
    visibleSlicesByChannel,
    shadowSlicesByChannel,
    aggregateSlice: createEmptySlice(roomId, 'GLOBAL', 'ROOM_AGGREGATE', authority, now),
    threadSlicesByThreadId: Object.freeze({}),
    sceneSlicesBySceneId: Object.freeze({}),
    momentSlicesByMomentId: Object.freeze({}),
    replaySlicesByReplayId: Object.freeze({}),
    snapshotAt: now,
  });
};

export const createEmptyTranscriptLedgerState = (
  roomIds: readonly ChatRoomId[] = [],
  authority: ChatAuthority = 'BACKEND_LEDGER',
  now: UnixMs = Date.now() as UnixMs,
): ChatTranscriptLedgerState => {
  const roomsById = Object.freeze(
    Object.fromEntries(
      roomIds.map((roomId) => [roomId, createEmptyTranscriptRoomState(roomId, authority, now)]),
    ) as Record<string, ChatTranscriptRoomState>,
  );

  const cursorSyncModeByRoomId = Object.freeze(
    Object.fromEntries(roomIds.map((roomId) => [roomId, 'FOLLOW_VIEWPORT'])) as Record<
      string,
      ChatTranscriptCursorSyncMode
    >,
  );

  return Object.freeze({
    transcriptId: `transcript:${now}` as ChatTranscriptId,
    ledgerId: `ledger:${now}` as ChatTranscriptLedgerId,
    roomsById,
    version: CHAT_CONTRACT_VERSION,
    generatedAt: now,
    cursorSyncModeByRoomId,
  });
};

// ============================================================================
// MARK: Indexing helpers
// ============================================================================

export const tokenizeTranscriptSearchText = (
  value: string,
): readonly ChatTranscriptSearchToken[] =>
  value
    .toLowerCase()
    .split(/[^a-z0-9_:-]+/g)
    .filter(Boolean)
    .map((token) => token as ChatTranscriptSearchToken);

export const canonicalMessageBodyText = (message: ChatCanonicalMessage): string =>
  message.body.plainText;

export const buildTranscriptIndexEntry = (
  message: ChatCanonicalMessage,
): ChatTranscriptIndexEntry => ({
  messageId: message.messageId,
  roomId: message.roomId,
  channelId: message.channelId,
  sequenceNumber: message.sequenceStamp.sequenceNumber,
  threadId: message.thread?.threadId,
  sceneId: message.thread?.sceneId as Optional<ChatSceneId>,
  momentId: message.customData?.momentId as Optional<ChatMomentId>,
  worldEventId: message.worldEvent?.worldEventId,
  createdAt: message.sequenceStamp.createdAt,
  bodyText: canonicalMessageBodyText(message),
  searchTokens: tokenizeTranscriptSearchText(canonicalMessageBodyText(message)),
  tags: message.tags ?? [],
  replayId: message.proof.replayId,
  legendId: message.legend?.legendId,
  proofHash: message.proof.proofHash,
  playerVisible: message.visibilityPolicy.playerVisible,
});

export const buildTranscriptReceiptAggregate = (
  messageId: ChatMessageId,
  receipts: readonly ChatMessageReadReceipt[] = [],
): ChatTranscriptReceiptAggregate => ({
  messageId,
  visibleReceiptCount: receipts.filter((receipt) => receipt.visibleToSender).length,
  hiddenReceiptCount: receipts.filter((receipt) => !receipt.visibleToSender).length,
  readByActorIds: receipts
    .filter((receipt) => receipt.state === 'READ')
    .map((receipt) => receipt.readerId),
  latestReadAt: receipts
    .map((receipt) => receipt.updatedAt)
    .sort((a, b) => Number(b) - Number(a))[0],
});

export const buildTranscriptProofEdges = (
  message: ChatCanonicalMessage,
): readonly ChatTranscriptProofEdge[] =>
  (message.proof.causalEdges ?? []).map((edge, index) => ({
    edgeId: `transcript-proof-edge:${message.messageId}:${index}` as ChatTranscriptProofEdgeId,
    fromMessageId: edge.fromMessageId,
    toMessageId: edge.toMessageId,
    toEventId: edge.toEventId,
    relation: edge.relation,
    proofHash: message.proof.proofHash,
    parentProofHash: message.proof.parentProofHash,
    playerVisible: edge.playerVisible,
  }));

export const buildTranscriptReplayAnchors = (
  message: ChatCanonicalMessage,
): readonly ChatTranscriptReplayAnchor[] =>
  message.proof.replayId
    ? [
        {
          anchorId: `transcript-replay-anchor:${message.messageId}` as ChatTranscriptAnchorId,
          replayId: message.proof.replayId,
          messageId: message.messageId,
          roomId: message.roomId,
          channelId: message.channelId,
          replayOffsetMs: message.proof.replayOffsetMs,
          createdAt: message.sequenceStamp.createdAt,
        },
      ]
    : [];

export const buildTranscriptLegendAnchors = (
  message: ChatCanonicalMessage,
): readonly ChatTranscriptLegendAnchor[] =>
  message.legend?.legendId
    ? [
        {
          anchorId: `transcript-legend-anchor:${message.messageId}` as ChatTranscriptAnchorId,
          legendId: message.legend.legendId,
          messageId: message.messageId,
          title: message.legend.rewardLabels?.[0],
          legendClass: undefined,
          prestigeScore: undefined,
        },
      ]
    : [];

export const buildTranscriptAuditEnvelope = (
  message: ChatCanonicalMessage,
): ChatTranscriptAuditEnvelope => ({
  messageId: message.messageId,
  roomId: message.roomId,
  channelId: message.channelId,
  requestId: message.authorityStamp.requestId,
  messageAuditTrail: message.auditTrail,
});

// ============================================================================
// MARK: Slice mutation helpers
// ============================================================================

const replaceRecordValue = <TValue>(
  record: Readonly<Record<string, TValue>>,
  key: string,
  value: TValue,
): Readonly<Record<string, TValue>> => Object.freeze({ ...record, [key]: value });

const appendMessageId = (
  messageIds: readonly ChatMessageId[],
  messageId: ChatMessageId,
): readonly ChatMessageId[] =>
  messageIds.includes(messageId) ? messageIds : [...messageIds, messageId];

export const appendCanonicalMessageToSlice = (
  slice: ChatTranscriptSliceBase,
  message: ChatCanonicalMessage,
): ChatTranscriptSliceBase => {
  const indexEntry = buildTranscriptIndexEntry(message);
  const proofEdges = buildTranscriptProofEdges(message);
  const replayAnchors = buildTranscriptReplayAnchors(message);
  const legendAnchors = buildTranscriptLegendAnchors(message);
  const auditEnvelope = buildTranscriptAuditEnvelope(message);
  const receiptAggregate = buildTranscriptReceiptAggregate(
    message.messageId,
    message.receipts,
  );

  return Object.freeze({
    ...slice,
    messageIds: appendMessageId(slice.messageIds, message.messageId),
    messagesById: replaceRecordValue(slice.messagesById, message.messageId, message),
    indexByMessageId: replaceRecordValue(slice.indexByMessageId, message.messageId, indexEntry),
    proofEdgesByMessageId: replaceRecordValue(
      slice.proofEdgesByMessageId,
      message.messageId,
      proofEdges,
    ),
    replayAnchorsByMessageId: replaceRecordValue(
      slice.replayAnchorsByMessageId,
      message.messageId,
      replayAnchors,
    ),
    legendAnchorsByMessageId: replaceRecordValue(
      slice.legendAnchorsByMessageId,
      message.messageId,
      legendAnchors,
    ),
    auditByMessageId: replaceRecordValue(slice.auditByMessageId, message.messageId, auditEnvelope),
    receiptsByMessageId: replaceRecordValue(
      slice.receiptsByMessageId,
      message.messageId,
      receiptAggregate,
    ),
    sequenceFloor:
      slice.sequenceFloor === undefined ||
      Number(message.sequenceStamp.sequenceNumber) < Number(slice.sequenceFloor)
        ? message.sequenceStamp.sequenceNumber
        : slice.sequenceFloor,
    sequenceCeil:
      slice.sequenceCeil === undefined ||
      Number(message.sequenceStamp.sequenceNumber) > Number(slice.sequenceCeil)
        ? message.sequenceStamp.sequenceNumber
        : slice.sequenceCeil,
    lastUpdatedAt: message.sequenceStamp.updatedAt,
  });
};

export const redactTranscriptMessageInSlice = (
  slice: ChatTranscriptSliceBase,
  messageId: ChatMessageId,
  mode: ChatTranscriptRedactionMode,
  replacementBodyText = '[redacted]',
): ChatTranscriptSliceBase => {
  const message = slice.messagesById[messageId];
  if (!message) return slice;

  if (mode === 'NONE') return slice;

  const nextMessage: ChatCanonicalMessage = Object.freeze({
    ...message,
    moderation: {
      ...message.moderation,
      visibleTextOverride: replacementBodyText,
    },
    body:
      mode === 'MASK_BODY'
        ? ([{ kind: 'TEXT', text: replacementBodyText }] as any)
        : message.body,
    visibilityPolicy:
      mode === 'HIDE_FROM_VISIBLE'
        ? {
            ...message.visibilityPolicy,
            playerVisible: false,
          }
        : message.visibilityPolicy,
  });

  return appendCanonicalMessageToSlice(
    Object.freeze({
      ...slice,
      messageIds: slice.messageIds,
    }),
    nextMessage,
  );
};

export const updateTranscriptReceiptsInSlice = (
  slice: ChatTranscriptSliceBase,
  messageId: ChatMessageId,
  receipts: readonly ChatMessageReadReceipt[],
): ChatTranscriptSliceBase => {
  const message = slice.messagesById[messageId];
  if (!message) return slice;

  const nextMessage: ChatCanonicalMessage = Object.freeze({
    ...message,
    receipts,
  });

  return appendCanonicalMessageToSlice(slice, nextMessage);
};

// ============================================================================
// MARK: Query helpers
// ============================================================================

const passTranscriptFilter = (
  entry: ChatTranscriptIndexEntry,
  filter: Optional<ChatTranscriptFilter>,
): boolean => {
  if (!filter) return true;
  if (filter.includeChannels && !filter.includeChannels.includes(entry.channelId)) return false;
  if (filter.excludeChannels && filter.excludeChannels.includes(entry.channelId)) return false;
  if (filter.includeTags && !filter.includeTags.every((tag) => entry.tags.includes(tag))) return false;
  if (filter.visibilityPlayerOnly && !entry.playerVisible) return false;
  if (filter.proofRequired && !entry.proofHash) return false;
  if (filter.replayEligibleOnly && !entry.replayId) return false;
  if (filter.legendOnly && !entry.legendId) return false;
  return true;
};

const scoreTranscriptHit = (
  entry: ChatTranscriptIndexEntry,
  searchText: Optional<string>,
): Score01 => {
  if (!searchText) return 1 as Score01;
  const text = searchText.toLowerCase();
  if (entry.bodyText.toLowerCase() === text) return 1 as Score01;
  if (entry.bodyText.toLowerCase().includes(text)) return 0.85 as Score01;
  if (entry.searchTokens.some((token) => String(token).includes(text))) return 0.65 as Score01;
  return 0.15 as Score01;
};

export const searchTranscriptSlice = (
  slice: ChatTranscriptSliceBase,
  query: ChatTranscriptQuery,
): ChatTranscriptQueryResult => {
  const allMessages = slice.messageIds
    .map((messageId) => slice.messagesById[messageId])
    .filter(Boolean);

  const hits = allMessages
    .map((message) => {
      const indexEntry = slice.indexByMessageId[message.messageId];
      if (!indexEntry) return null;
      if (!passTranscriptFilter(indexEntry, query.filter)) return null;
      if (
        query.searchText &&
        !indexEntry.bodyText.toLowerCase().includes(query.searchText.toLowerCase()) &&
        !indexEntry.searchTokens.some((token) =>
          String(token).includes(query.searchText!.toLowerCase()),
        )
      ) {
        return null;
      }
      const excerpt = query.includeExcerpts
        ? buildTranscriptExcerpt(message, query.searchText)
        : undefined;
      return {
        message,
        indexEntry,
        excerpt,
        score01: scoreTranscriptHit(indexEntry, query.searchText),
      } satisfies ChatTranscriptHit;
    })
    .filter(Boolean) as ChatTranscriptHit[];

  const sortedHits = sortTranscriptHits(hits, query.sortMode ?? 'SEQUENCE_ASC');
  const pagedHits = sortedHits.slice(query.offset, query.offset + query.limit);
  const replayAnchors = query.includeReplayAnchors
    ? pagedHits.flatMap((hit) => slice.replayAnchorsByMessageId[hit.message.messageId] ?? [])
    : undefined;

  return Object.freeze({
    queryId: query.queryId,
    hits: pagedHits,
    totalHits: hits.length,
    proofGraph: query.includeProofGraph ? buildProofGraphFromSlice(slice) : undefined,
    replayAnchors,
    generatedAt: Date.now() as UnixMs,
  });
};

export const buildTranscriptExcerpt = (
  message: ChatCanonicalMessage,
  searchText?: string,
): ChatTranscriptExcerpt => {
  const bodyText = canonicalMessageBodyText(message);
  const lowerBody = bodyText.toLowerCase();
  const lowerQuery = searchText?.toLowerCase();
  const startOffset = lowerQuery ? Math.max(0, lowerBody.indexOf(lowerQuery)) : 0;
  const endOffset = lowerQuery
    ? startOffset + lowerQuery.length
    : Math.min(bodyText.length, 140);

  return Object.freeze({
    excerptId: `excerpt:${message.messageId}:${startOffset}:${endOffset}` as ChatTranscriptExcerptId,
    messageId: message.messageId,
    roomId: message.roomId,
    channelId: message.channelId,
    startOffset,
    endOffset,
    bodyText,
    highlightedText: lowerQuery ? bodyText.slice(startOffset, endOffset) : undefined,
    reason: lowerQuery ? 'SEARCH_TEXT' : 'WINDOW',
    salience01: (lowerQuery ? 0.8 : 0.4) as Score01,
  });
};

export const sortTranscriptHits = (
  hits: readonly ChatTranscriptHit[],
  mode: ChatTranscriptSortMode,
): readonly ChatTranscriptHit[] => {
  const copy = [...hits];
  copy.sort((a, b) => {
    switch (mode) {
      case 'SEQUENCE_DESC':
        return Number(b.message.sequenceStamp.sequenceNumber) - Number(a.message.sequenceStamp.sequenceNumber);
      case 'TIME_ASC':
        return Number(a.message.sequenceStamp.createdAt) - Number(b.message.sequenceStamp.createdAt);
      case 'TIME_DESC':
        return Number(b.message.sequenceStamp.createdAt) - Number(a.message.sequenceStamp.createdAt);
      case 'SALience_DESC':
        return Number(b.score01) - Number(a.score01);
      case 'SEQUENCE_ASC':
      default:
        return Number(a.message.sequenceStamp.sequenceNumber) - Number(b.message.sequenceStamp.sequenceNumber);
    }
  });
  return copy;
};

export const buildProofGraphFromSlice = (
  slice: ChatTranscriptSliceBase,
): ChatTranscriptProofGraph => ({
  roomId: slice.roomId,
  channelId: slice.channelId,
  messageIds: slice.messageIds,
  edges: slice.messageIds.flatMap(
    (messageId) => slice.proofEdgesByMessageId[messageId] ?? [],
  ),
  builtAt: Date.now() as UnixMs,
});

// ============================================================================
// MARK: Export helpers
// ============================================================================

export const exportTranscriptSlice = (
  slice: ChatTranscriptSliceBase,
  request: ChatTranscriptExportRequest,
): ChatTranscriptExportResult => {
  const messages = slice.messageIds
    .map((messageId) => slice.messagesById[messageId])
    .filter(Boolean)
    .filter((message) => passTranscriptFilter(slice.indexByMessageId[message.messageId], request.filter));

  let body = '';
  let mimeType = 'application/json';

  switch (request.format) {
    case 'JSONL':
      mimeType = 'application/x-ndjson';
      body = messages.map((message) => JSON.stringify(message)).join('\n');
      break;
    case 'MARKDOWN':
      mimeType = 'text/markdown';
      body = messages
        .map(
          (message) =>
            `- [${message.sequenceStamp.sequenceNumber}] **${message.sender.senderName}** (${message.channelId}) ${canonicalMessageBodyText(message)}`,
        )
        .join('\n');
      break;
    case 'AUDIT_LEDGER':
      mimeType = 'application/json';
      body = JSON.stringify(
        messages.map((message) => ({
          messageId: message.messageId,
          requestId: message.authorityStamp.requestId,
          proofHash: message.proof.proofHash,
          delivery: message.delivery.state,
          auditTrail: message.auditTrail,
        })),
        null,
        2,
      );
      break;
    case 'REPLAY_TIMELINE':
      mimeType = 'application/json';
      body = JSON.stringify(
        messages.map((message) => ({
          messageId: message.messageId,
          replayId: message.proof.replayId,
          replayOffsetMs: message.proof.replayOffsetMs,
          bodyText: canonicalMessageBodyText(message),
        })),
        null,
        2,
      );
      break;
    case 'JSON':
    default:
      mimeType = 'application/json';
      body = JSON.stringify(messages, null, 2);
      break;
  }

  return Object.freeze({
    exportId: request.exportId,
    format: request.format,
    mimeType,
    body,
    messageCount: messages.length,
    generatedAt: Date.now() as UnixMs,
  });
};

// ============================================================================
// MARK: Compatibility bridges for existing frontend transcript buffer usage
// ============================================================================

export const toLegacyChatMessage = (message: ChatCanonicalMessage): ChatMessage => ({
  id: message.messageId,
  channel: message.channelId as ChatVisibleChannel,
  kind: message.kind,
  senderId: message.sender.senderId,
  senderName: message.sender.senderName,
  senderRank: message.sender.senderRank,
  body: canonicalMessageBodyText(message),
  emoji: undefined,
  ts: Number(message.sequenceStamp.createdAt),
  immutable: Boolean(message.proof.proofHash && channelExposesProofHashes(message.channelId)),
  proofHash: message.proof.proofHash,
  sender: message.sender,
  deliveryState: message.delivery.state,
  moderation: message.moderation.decision,
  proof: {
    proofHash: message.proof.proofHash,
    proofSequence: Number(message.sequenceStamp.sequenceNumber),
    proofChainPosition: undefined,
    transcriptNonce: undefined,
    runId: undefined,
    immutable: Boolean(message.proof.proofHash && channelExposesProofHashes(message.channelId)),
    authority: message.authorityStamp.currentAuthority === 'CLIENT_STAGED' ? 'LOCAL' : message.authorityStamp.currentAuthority === 'BACKEND_LEDGER' ? 'BACKEND_LEDGER' : 'SERVER',
  },
  replay: {
    replayId: message.proof.replayId,
    replayAnchorIndex: undefined,
    replayEligible: Boolean(message.proof.replayId || channelSupportsReplay(message.channelId)),
    legendEligible: Boolean(message.legend?.legendId),
    worldEventEligible: Boolean(message.worldEvent?.worldEventId),
  },
  legend: message.legend?.legendId
    ? {
        legendId: message.legend.legendId,
        legendClass: undefined,
        title: undefined,
        prestigeScore: undefined,
        unlocksReward: Boolean(message.legend.rewardLabels?.length),
      }
    : undefined,
  audit: {
    requestId: message.authorityStamp.requestId,
    stagedAt: message.delivery.stagedLocallyAt,
    authoritativeAt: message.authorityStamp.authoritativeAt,
    moderationAppliedAt: message.moderation.moderatedAt,
    replayIndexedAt: message.sequenceStamp.updatedAt,
    originAuthority: message.authorityStamp.currentAuthority,
  },
  meta: message.customData,
  readReceipts: message.receipts.map((receipt) => ({
    actorId: receipt.readerId,
    actorKind: receipt.readerKind,
    messageId: receipt.messageId,
    readAt: receipt.updatedAt,
    delayedByPolicy: false,
  })),
  tags: message.tags,
});

export const toLegacyTranscriptBufferSnapshot = (
  slice: ChatTranscriptSliceBase,
): ChatLegacyTranscriptBufferSnapshot => ({
  channel: slice.channelId as ChatVisibleChannel,
  messages: slice.messageIds
    .map((messageId) => slice.messagesById[messageId])
    .filter(Boolean)
    .map((message) => toLegacyChatMessage(message)),
});

// ============================================================================
// MARK: Public ledger operations
// ============================================================================

export const appendCanonicalMessageToLedger = (
  ledger: ChatTranscriptLedgerState,
  message: ChatCanonicalMessage,
): ChatTranscriptLedgerState => {
  const currentRoom = ledger.roomsById[message.roomId] ?? createEmptyTranscriptRoomState(message.roomId);
  const nextChannelSlice = appendCanonicalMessageToSlice(
    message.channelId in currentRoom.visibleSlicesByChannel
      ? currentRoom.visibleSlicesByChannel[message.channelId as ChatVisibleChannel]
      : currentRoom.shadowSlicesByChannel[message.channelId as ChatShadowChannel],
    message,
  );

  const nextAggregate = appendCanonicalMessageToSlice(currentRoom.aggregateSlice, message);

  const nextRoom: ChatTranscriptRoomState = Object.freeze({
    ...currentRoom,
    visibleSlicesByChannel:
      message.channelId in currentRoom.visibleSlicesByChannel
        ? Object.freeze({
            ...currentRoom.visibleSlicesByChannel,
            [message.channelId]: nextChannelSlice,
          })
        : currentRoom.visibleSlicesByChannel,
    shadowSlicesByChannel:
      message.channelId in currentRoom.shadowSlicesByChannel
        ? Object.freeze({
            ...currentRoom.shadowSlicesByChannel,
            [message.channelId]: nextChannelSlice,
          })
        : currentRoom.shadowSlicesByChannel,
    aggregateSlice: nextAggregate,
    snapshotAt: message.sequenceStamp.updatedAt,
  });

  return Object.freeze({
    ...ledger,
    roomsById: Object.freeze({
      ...ledger.roomsById,
      [message.roomId]: nextRoom,
    }),
  });
};

export const appendCanonicalMessagesToLedger = (
  ledger: ChatTranscriptLedgerState,
  messages: readonly ChatCanonicalMessage[],
): ChatTranscriptLedgerState =>
  messages.reduce((nextLedger, message) => appendCanonicalMessageToLedger(nextLedger, message), ledger);

export const queryTranscriptLedger = (
  ledger: ChatTranscriptLedgerState,
  query: ChatTranscriptQuery,
): ChatTranscriptQueryResult => {
  const room = ledger.roomsById[query.locator.roomId];
  if (!room) {
    return Object.freeze({
      queryId: query.queryId,
      hits: [],
      totalHits: 0,
      generatedAt: Date.now() as UnixMs,
    });
  }

  const slice = query.locator.channelId
    ? (query.locator.channelId in room.visibleSlicesByChannel
        ? room.visibleSlicesByChannel[query.locator.channelId as ChatVisibleChannel]
        : room.shadowSlicesByChannel[query.locator.channelId as ChatShadowChannel])
    : room.aggregateSlice;

  return searchTranscriptSlice(slice, query);
};

export const snapshotTranscriptSlice = (
  slice: ChatTranscriptSliceBase,
  window?: ChatTranscriptWindow,
  cursorSyncMode: ChatTranscriptCursorSyncMode = 'FOLLOW_VIEWPORT',
): ChatTranscriptSnapshot => ({
  snapshotId: `transcript-snapshot:${slice.roomId}:${slice.channelId}:${Date.now()}` as ChatTranscriptSnapshotId,
  transcriptId: `transcript:${slice.roomId}` as ChatTranscriptId,
  roomId: slice.roomId,
  slice,
  window: window ?? buildDefaultTranscriptWindow('GAME_BOARD'),
  cursorSyncMode,
  createdAt: Date.now() as UnixMs,
});

// ============================================================================
// MARK: Guards and namespace descriptor
// ============================================================================

export const isTranscriptShadowChannel = (channelId: ChatChannelId): channelId is ChatShadowChannel =>
  (CHAT_SHADOW_CHANNELS as readonly string[]).includes(channelId);

export const isTranscriptVisibleChannel = (
  channelId: ChatChannelId,
): channelId is ChatVisibleChannel =>
  (CHAT_VISIBLE_CHANNELS as readonly string[]).includes(channelId);

export interface ChatTranscriptContractNamespace {
  readonly version: typeof CHAT_CONTRACT_VERSION;
  readonly authorities: typeof CHAT_CONTRACT_AUTHORITIES;
  readonly sliceKinds: typeof CHAT_TRANSCRIPT_SLICE_KINDS;
  readonly retentionClasses: typeof CHAT_TRANSCRIPT_RETENTION_CLASSES;
  readonly queryIntents: typeof CHAT_TRANSCRIPT_QUERY_INTENTS;
  readonly exportFormats: typeof CHAT_TRANSCRIPT_EXPORT_FORMATS;
}

export const CHAT_TRANSCRIPT_CONTRACT_NAMESPACE: ChatTranscriptContractNamespace = Object.freeze({
  version: CHAT_CONTRACT_VERSION,
  authorities: CHAT_CONTRACT_AUTHORITIES,
  sliceKinds: CHAT_TRANSCRIPT_SLICE_KINDS,
  retentionClasses: CHAT_TRANSCRIPT_RETENTION_CLASSES,
  queryIntents: CHAT_TRANSCRIPT_QUERY_INTENTS,
  exportFormats: CHAT_TRANSCRIPT_EXPORT_FORMATS,
});
