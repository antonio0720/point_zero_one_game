/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ENGINE REPLAY BUFFER
 * FILE: pzo-web/src/engines/chat/replay/ChatReplayBuffer.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical frontend replay-working-set authority for the unified chat engine.
 *
 * This file deliberately sits ABOVE `../ChatTranscriptBuffer.ts` rather than
 * replacing it.
 *
 * Why that matters in this repo:
 * - `ChatTranscriptBuffer.ts` is already the bounded, deterministic local
 *   working-set authority for raw transcript records, replay hydration merges,
 *   optimistic / ack reconciliation, moderation redaction, proof-bearing Deal
 *   Room receipts, and drawer/search/export surfaces.
 * - `types.ts` already exposes replay-aware message metadata through
 *   `ChatReplayMeta`, `ChatLegendMeta`, `ChatProofMeta`, and the core
 *   `ChatMessage` contract.
 * - `ChatEngine.ts` is already generating legend and replay-eligible message
 *   flows for sovereignty, crowd reactions, helper rescue beats, and witnessed
 *   dramatic turns.
 *
 * The missing lane is not transcript storage.
 * The missing lane is replay orchestration.
 *
 * This buffer becomes the frontend owner for:
 * - replay sessions,
 * - anchor resolution,
 * - bounded replay slice assembly,
 * - scene / moment segmentation,
 * - proof-chain extraction,
 * - legend review windows,
 * - post-run ritual recap shaping,
 * - serializer-ready export payloads,
 * - channel-aware replay continuity,
 * - cache-safe recap generation without mutating transcript truth.
 *
 * Permanent doctrine
 * ------------------
 * - Backend remains the long-term replay authority.
 * - Frontend owns replay immediacy, dramaturgical shaping, and bounded working
 *   sets suitable for drawers, recap overlays, replay panels, and witness
 *   moments.
 * - Replay does not append blindly. It resolves anchors, proof chains, legends,
 *   witness lines, and continuity windows from the transcript working set.
 * - Deal Room receipts remain immutable in replay surfaces.
 * - A replay slice is a view over transcript truth, not a second transcript.
 * - A recap is shaped, not fabricated.
 *
 * Design laws
 * -----------
 * - No direct UI ownership.
 * - No server-truth invention.
 * - No silent mutation of immutable proof-bearing lines.
 * - Every exported replay bundle must be serializer-ready for the upcoming
 *   `ChatReplaySerializer.ts` lane without forcing that file to exist now.
 * - Every session is bounded, cache-aware, and deterministic under repeated
 *   calls with the same transcript signature.
 * - Legend and proof extraction must remain channel-specific.
 * - Post-run recap must feel authored without becoming fictional.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import {
  CHAT_ENGINE_AUTHORITIES,
  CHAT_ENGINE_VERSION,
  isVisibleChatChannel,
  type ChatAuthoritativeFrame,
  type ChatChannelId,
  type ChatLegendId,
  type ChatMessage,
  type ChatMessageId,
  type ChatMessageKind,
  type ChatMomentId,
  type ChatMountTarget,
  type ChatProofHash,
  type ChatReplayId,
  type ChatVisibleChannel,
  type UnixMs,
} from '../types';

import {
  ChatTranscriptBuffer,
  type ChatTranscriptBufferSnapshot,
  type ChatTranscriptDrawerCursor,
  type ChatTranscriptDrawerPage,
  type ChatTranscriptExportBundle,
  type ChatTranscriptExportMode,
  type ChatTranscriptRecord,
} from '../ChatTranscriptBuffer';

// ============================================================================
// MARK: Public replay types
// ============================================================================

export type ChatReplayOpenReason =
  | 'MOUNT_BOOT'
  | 'CHANNEL_SWITCH'
  | 'MANUAL_OPEN'
  | 'DRAWER_REVIEW'
  | 'LEGEND_REVIEW'
  | 'POST_RUN_RITUAL'
  | 'AUTHORITATIVE_REPLAY'
  | 'AUTHORITATIVE_FRAME'
  | 'RECONNECT_RECOVERY'
  | 'HYDRATION';

export type ChatReplayCloseReason =
  | 'MANUAL_CLOSE'
  | 'CHANNEL_SWITCH'
  | 'MOUNT_CHANGE'
  | 'IDLE_EVICTION'
  | 'RESET'
  | 'DESTROY';

export type ChatReplaySliceReason =
  | 'SESSION_OPEN'
  | 'SESSION_RESUME'
  | 'SESSION_REBUILD'
  | 'SESSION_EXPORT'
  | 'LEGEND_REVIEW'
  | 'PROOF_REVIEW'
  | 'POST_RUN_RECAP'
  | 'AUTHORITATIVE_SYNC'
  | 'MANUAL_REQUEST';

export type ChatReplayAnchorStrategy =
  | 'LATEST'
  | 'MESSAGE_ID'
  | 'PROOF_HASH'
  | 'TIMESTAMP'
  | 'LEGEND_ID'
  | 'MOMENT_ID'
  | 'DRAWER_CURSOR';

export type ChatReplayTimelineClass =
  | 'SYSTEM_ARC'
  | 'PLAYER_TURN'
  | 'NPC_WAVE'
  | 'HELPER_BEAT'
  | 'HATER_PRESSURE'
  | 'NEGOTIATION_SWING'
  | 'PROOF_CHAIN'
  | 'LEGEND_SPIKE'
  | 'POST_RUN_RITUAL'
  | 'WORLD_EVENT'
  | 'SCENE_BLOCK';

export type ChatReplayContinuityMode =
  | 'RUN_SCOPED'
  | 'ACCOUNT_SCOPED'
  | 'LEGEND_ONLY'
  | 'POST_RUN_ONLY';

export type ChatReplayExportFormat =
  | 'JSON_BUNDLE'
  | 'SERIALIZER_READY'
  | 'SUMMARY_ONLY';

export interface ChatReplaySession {
  readonly id: string;
  readonly channel: ChatVisibleChannel;
  readonly mountTarget: ChatMountTarget;
  readonly openedAt: UnixMs;
  readonly lastAccessedAt: UnixMs;
  readonly openedReason: ChatReplayOpenReason;
  readonly continuityMode: ChatReplayContinuityMode;
  readonly replayId?: ChatReplayId;
  readonly anchorMessageId?: ChatMessageId;
  readonly anchorProofHash?: ChatProofHash;
  readonly anchorMomentId?: ChatMomentId;
  readonly replayToken?: string;
  readonly hasMoreBefore: boolean;
  readonly hasMoreAfter: boolean;
  readonly recordSignature: string;
  readonly cachedSliceCount: number;
}

export interface ChatReplayTimelineSegment {
  readonly id: string;
  readonly channel: ChatVisibleChannel;
  readonly timelineClass: ChatReplayTimelineClass;
  readonly startTs: UnixMs;
  readonly endTs: UnixMs;
  readonly anchorMessageId?: ChatMessageId;
  readonly messageIds: readonly ChatMessageId[];
  readonly dominantKind: ChatMessageKind;
  readonly summaryLine: string;
  readonly sceneId?: string;
  readonly momentId?: ChatMomentId;
  readonly proofHashes: readonly ChatProofHash[];
  readonly legendIds: readonly ChatLegendId[];
  readonly witnessCount: number;
  readonly pressureBand?: string;
  readonly tickBand?: string;
}

export interface ChatReplayProofReference {
  readonly proofHash: ChatProofHash;
  readonly channel: ChatVisibleChannel;
  readonly messageIds: readonly ChatMessageId[];
  readonly firstTs: UnixMs;
  readonly lastTs: UnixMs;
  readonly immutableCount: number;
  readonly segmentIds: readonly string[];
  readonly proofClass:
    | 'DEAL_CHAIN'
    | 'SYSTEM_RECEIPT'
    | 'LEGEND_CHAIN'
    | 'MIXED_CHAIN';
}

export interface ChatReplayLegendMoment {
  readonly legendId: ChatLegendId;
  readonly messageId: ChatMessageId;
  readonly channel: ChatVisibleChannel;
  readonly ts: UnixMs;
  readonly title: string;
  readonly legendClass: string;
  readonly prestigeScore: number;
  readonly proofHash?: ChatProofHash;
  readonly witnessMessageIds: readonly ChatMessageId[];
  readonly replayId?: ChatReplayId;
}

export interface ChatReplayMomentAnchor {
  readonly momentId: ChatMomentId;
  readonly channel: ChatVisibleChannel;
  readonly firstMessageId: ChatMessageId;
  readonly lastMessageId: ChatMessageId;
  readonly firstTs: UnixMs;
  readonly lastTs: UnixMs;
  readonly messageIds: readonly ChatMessageId[];
  readonly sceneIds: readonly string[];
}

export interface ChatReplayThreadView {
  readonly id: string;
  readonly channel: ChatVisibleChannel;
  readonly label: string;
  readonly messageIds: readonly ChatMessageId[];
  readonly firstTs: UnixMs;
  readonly lastTs: UnixMs;
  readonly counterpartIds: readonly string[];
}

export interface ChatReplaySummary {
  readonly channel: ChatVisibleChannel;
  readonly totalRecords: number;
  readonly replayEligibleCount: number;
  readonly proofCount: number;
  readonly legendCount: number;
  readonly immutableCount: number;
  readonly playerLines: number;
  readonly helperLines: number;
  readonly haterLines: number;
  readonly ambientLines: number;
  readonly worldEventLines: number;
  readonly startTs?: UnixMs;
  readonly endTs?: UnixMs;
  readonly turningPointMessageIds: readonly ChatMessageId[];
  readonly dominantPressureTier?: string;
  readonly dominantTickTier?: string;
  readonly lastWordMessageId?: ChatMessageId;
}

export interface ChatReplayContinuityDigest {
  readonly channel: ChatVisibleChannel;
  readonly builtAt: UnixMs;
  readonly unresolvedMomentIds: readonly ChatMomentId[];
  readonly topProofHashes: readonly ChatProofHash[];
  readonly legendIds: readonly ChatLegendId[];
  readonly recurringCounterpartIds: readonly string[];
  readonly callbackCandidateMessageIds: readonly ChatMessageId[];
  readonly summaryLine: string;
}

export interface ChatReplaySlice {
  readonly session: ChatReplaySession;
  readonly reason: ChatReplaySliceReason;
  readonly builtAt: UnixMs;
  readonly channel: ChatVisibleChannel;
  readonly anchorStrategy: ChatReplayAnchorStrategy;
  readonly anchorMessageId?: ChatMessageId;
  readonly anchorProofHash?: ChatProofHash;
  readonly anchorMomentId?: ChatMomentId;
  readonly anchorTs?: UnixMs;
  readonly records: readonly ChatTranscriptRecord[];
  readonly messages: readonly ChatMessage[];
  readonly segments: readonly ChatReplayTimelineSegment[];
  readonly proofReferences: readonly ChatReplayProofReference[];
  readonly legendMoments: readonly ChatReplayLegendMoment[];
  readonly momentAnchors: readonly ChatReplayMomentAnchor[];
  readonly threadViews: readonly ChatReplayThreadView[];
  readonly continuity: ChatReplayContinuityDigest;
  readonly summary: ChatReplaySummary;
  readonly hasMoreBefore: boolean;
  readonly hasMoreAfter: boolean;
}

export interface ChatReplayPostRunRecap {
  readonly channel: ChatVisibleChannel;
  readonly builtAt: UnixMs;
  readonly slice: ChatReplaySlice;
  readonly turningPoints: readonly ChatReplayLegendMoment[];
  readonly witnessLines: readonly ChatMessage[];
  readonly proofHighlights: readonly ChatReplayProofReference[];
  readonly finalWord?: ChatMessage;
  readonly narrativeLine: string;
}

export interface ChatReplayChannelSnapshot {
  readonly channel: ChatVisibleChannel;
  readonly revision: number;
  readonly openSessionId?: string;
  readonly recordSignature: string;
  readonly recordCount: number;
  readonly replayEligibleCount: number;
  readonly proofCount: number;
  readonly legendCount: number;
  readonly lastHydratedAt?: UnixMs;
  readonly replayToken?: string;
  readonly hasMoreBefore: boolean;
  readonly hasMoreAfter: boolean;
}

export interface ChatReplaySnapshot {
  readonly activeChannel: ChatVisibleChannel;
  readonly mountTarget: ChatMountTarget;
  readonly channels: readonly ChatReplayChannelSnapshot[];
  readonly openSessions: readonly ChatReplaySession[];
  readonly transcript: ChatTranscriptBufferSnapshot;
}

export interface ChatReplaySliceRequest {
  readonly channel?: ChatVisibleChannel;
  readonly sessionId?: string;
  readonly reason?: ChatReplaySliceReason;
  readonly anchorStrategy?: ChatReplayAnchorStrategy;
  readonly anchorMessageId?: ChatMessageId;
  readonly anchorProofHash?: ChatProofHash;
  readonly anchorMomentId?: ChatMomentId;
  readonly anchorLegendId?: ChatLegendId;
  readonly anchorTs?: UnixMs;
  readonly drawerCursor?: ChatTranscriptDrawerCursor;
  readonly beforeCount?: number;
  readonly afterCount?: number;
  readonly maxRecords?: number;
  readonly includeFailed?: boolean;
  readonly includeRedacted?: boolean;
  readonly replayEligibleOnly?: boolean;
  readonly proofOnly?: boolean;
  readonly continuityMode?: ChatReplayContinuityMode;
}

export interface ChatReplayExportBundle {
  readonly format: ChatReplayExportFormat;
  readonly builtAt: UnixMs;
  readonly engineVersion: string;
  readonly authorities: typeof CHAT_ENGINE_AUTHORITIES;
  readonly slice: ChatReplaySlice;
  readonly serializerHint: {
    readonly pendingFile: '/pzo-web/src/engines/chat/replay/ChatReplaySerializer.ts';
    readonly ready: true;
  };
  readonly transcriptBundle?: ChatTranscriptExportBundle;
}

export interface ChatReplayBufferCallbacks {
  onSessionOpened?: (session: ChatReplaySession) => void;
  onSessionClosed?: (session: ChatReplaySession, reason: ChatReplayCloseReason) => void;
  onSliceBuilt?: (slice: ChatReplaySlice) => void;
  onSnapshotChanged?: (snapshot: ChatReplaySnapshot) => void;
  onExported?: (bundle: ChatReplayExportBundle) => void;
  onError?: (error: Error, context?: Record<string, unknown>) => void;
}

export interface ChatReplayBufferConfig {
  maxOpenSessionsPerChannel?: number;
  maxSliceCachePerSession?: number;
  defaultBeforeCount?: number;
  defaultAfterCount?: number;
  maxRecordsPerSlice?: number;
  proofContextRadius?: number;
  legendWitnessWindow?: number;
  continuityLookback?: number;
  segmentGapMs?: number;
  sessionIdleTtlMs?: number;
  compactionIntervalMs?: number;
  preferVisibleWindow?: boolean;
  cacheContinuityDigest?: boolean;
  log?: (message: string, context?: Record<string, unknown>) => void;
  warn?: (message: string, context?: Record<string, unknown>) => void;
  error?: (message: string, context?: Record<string, unknown>) => void;
}

export interface ChatReplayBufferOptions {
  readonly transcriptBuffer: ChatTranscriptBuffer;
  readonly initialChannel?: ChatVisibleChannel;
  readonly mountTarget?: ChatMountTarget;
  readonly callbacks?: ChatReplayBufferCallbacks;
  readonly config?: ChatReplayBufferConfig;
}

// ============================================================================
// MARK: Internal state
// ============================================================================

interface InternalReplaySession {
  session: ChatReplaySession;
  sliceCache: Map<string, ChatReplaySlice>;
  continuityCache?: ChatReplayContinuityDigest;
}

interface InternalReplayChannelState {
  channel: ChatVisibleChannel;
  revision: number;
  recordSignature: string;
  openSessionId?: string;
  sessionsById: Map<string, InternalReplaySession>;
  orderedSessionIds: string[];
  replayToken?: string;
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
  lastHydratedAt?: UnixMs;
}

const CHANNELS: readonly ChatVisibleChannel[] = [
  'GLOBAL',
  'SYNDICATE',
  'DEAL_ROOM',
  'LOBBY',
] as const;

const DEFAULT_CONFIG: Required<
  Pick<
    ChatReplayBufferConfig,
    | 'maxOpenSessionsPerChannel'
    | 'maxSliceCachePerSession'
    | 'defaultBeforeCount'
    | 'defaultAfterCount'
    | 'maxRecordsPerSlice'
    | 'proofContextRadius'
    | 'legendWitnessWindow'
    | 'continuityLookback'
    | 'segmentGapMs'
    | 'sessionIdleTtlMs'
    | 'compactionIntervalMs'
    | 'preferVisibleWindow'
    | 'cacheContinuityDigest'
  >
> = {
  maxOpenSessionsPerChannel: 8,
  maxSliceCachePerSession: 12,
  defaultBeforeCount: 28,
  defaultAfterCount: 40,
  maxRecordsPerSlice: 240,
  proofContextRadius: 3,
  legendWitnessWindow: 5,
  continuityLookback: 120,
  segmentGapMs: 45_000,
  sessionIdleTtlMs: 10 * 60_000,
  compactionIntervalMs: 30_000,
  preferVisibleWindow: false,
  cacheContinuityDigest: true,
};

// ============================================================================
// MARK: Utilities
// ============================================================================

function now(): UnixMs {
  return Date.now() as UnixMs;
}

function createError(message: string): Error {
  return new Error(`[ChatReplayBuffer] ${message}`);
}

function normalizeText(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim()
    : '';
}

function normalizeArray<T>(value: readonly T[] | undefined | null): readonly T[] {
  return Array.isArray(value) ? [...value] : [];
}

function safeNumber(value: unknown, fallback = 0): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toReplayId(raw: string): ChatReplayId {
  return raw as ChatReplayId;
}

function toMessageId(raw: string): ChatMessageId {
  return raw as ChatMessageId;
}

function toProofHash(raw: string): ChatProofHash {
  return raw as ChatProofHash;
}

function toLegendId(raw: string): ChatLegendId {
  return raw as ChatLegendId;
}

function toMomentId(raw: string): ChatMomentId {
  return raw as ChatMomentId;
}

function buildReplayId(channel: ChatVisibleChannel, suffix: string): ChatReplayId {
  return toReplayId(`replay:${channel}:${suffix}`);
}

function buildSessionId(channel: ChatVisibleChannel): string {
  return `session:${channel}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

function buildSegmentId(channel: ChatVisibleChannel, anchor: string, index: number): string {
  return `segment:${channel}:${anchor}:${index}`;
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}:${stableStringify(inner)}`).join(',')}}`;
}

function compareRecordAsc(left: ChatTranscriptRecord, right: ChatTranscriptRecord): number {
  if (left.sortTs !== right.sortTs) return left.sortTs - right.sortTs;
  return left.messageId.localeCompare(right.messageId);
}

function compareRecordDesc(left: ChatTranscriptRecord, right: ChatTranscriptRecord): number {
  if (left.sortTs !== right.sortTs) return right.sortTs - left.sortTs;
  return right.messageId.localeCompare(left.messageId);
}

function compareLegendDesc(left: ChatReplayLegendMoment, right: ChatReplayLegendMoment): number {
  if (left.prestigeScore !== right.prestigeScore) return right.prestigeScore - left.prestigeScore;
  if (left.ts !== right.ts) return right.ts - left.ts;
  return left.messageId.localeCompare(right.messageId);
}

function compareProofAsc(left: ChatReplayProofReference, right: ChatReplayProofReference): number {
  if (left.firstTs !== right.firstTs) return left.firstTs - right.firstTs;
  return left.proofHash.localeCompare(right.proofHash);
}

function uniqueStrings(values: Iterable<string>): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) seen.add(normalized);
  }
  return [...seen];
}

function recordToMessage(record: ChatTranscriptRecord): ChatMessage {
  return {
    id: (record.ackedServerId ?? record.messageId) as ChatMessageId,
    channel: record.channel,
    kind: record.kind as ChatMessageKind,
    senderId: record.senderId,
    senderName: record.senderName,
    senderRank: record.senderRank,
    body: record.redactedBody ?? record.body,
    emoji: record.emoji,
    ts: record.ts,
    immutable: record.immutable,
    proofHash: record.proofHash,
    pressureTier: record.pressureTier as any,
    tickTier: record.tickTier as any,
    runOutcome: record.runOutcome as any,
    sceneId: record.metadata?.sceneId && typeof record.metadata.sceneId === 'string'
      ? record.metadata.sceneId
      : undefined,
    momentId: record.metadata?.momentId && typeof record.metadata.momentId === 'string'
      ? (record.metadata.momentId as ChatMomentId)
      : undefined,
    quoteIds: Array.isArray(record.metadata?.quoteIds)
      ? record.metadata?.quoteIds.filter((value): value is string => typeof value === 'string')
      : undefined,
    relationshipIds: Array.isArray(record.metadata?.relationshipIds)
      ? record.metadata?.relationshipIds.filter((value): value is string => typeof value === 'string')
      : undefined,
    meta: record.metadata as any,
    replay: {
      replayEligible: record.metadata?.replayEligible === false ? false : true,
      legendEligible: record.kind === 'LEGEND_MOMENT' || Boolean(record.metadata?.legendEligible),
      worldEventEligible: record.kind === 'WORLD_EVENT' || Boolean(record.metadata?.worldEventEligible),
      replayId: record.metadata?.replayId && typeof record.metadata.replayId === 'string'
        ? (record.metadata.replayId as ChatReplayId)
        : undefined,
      replayAnchorIndex: typeof record.metadata?.replayAnchorIndex === 'number'
        ? record.metadata.replayAnchorIndex
        : undefined,
    },
    legend: record.kind === 'LEGEND_MOMENT' || record.metadata?.legendId
      ? {
          legendId: record.metadata?.legendId && typeof record.metadata.legendId === 'string'
            ? (record.metadata.legendId as ChatLegendId)
            : undefined,
          legendClass: typeof record.metadata?.legendClass === 'string'
            ? record.metadata.legendClass as any
            : undefined,
          title: typeof record.metadata?.legendTitle === 'string'
            ? record.metadata.legendTitle
            : undefined,
          prestigeScore: typeof record.metadata?.prestigeScore === 'number'
            ? record.metadata.prestigeScore
            : undefined,
          unlocksReward: Boolean(record.metadata?.unlocksReward),
        }
      : undefined,
    proof: record.proofHash
      ? {
          proofHash: record.proofHash as ChatProofHash,
          immutable: Boolean(record.immutable),
          authority: 'SERVER',
          transcriptNonce: typeof record.metadata?.transcriptNonce === 'string'
            ? record.metadata.transcriptNonce
            : undefined,
          proofSequence: typeof record.metadata?.proofSequence === 'number'
            ? record.metadata.proofSequence
            : undefined,
          proofChainPosition: typeof record.metadata?.proofChainPosition === 'number'
            ? record.metadata.proofChainPosition
            : undefined,
        }
      : undefined,
    audit: {
      insertedAt: (record.insertedAt || record.ts) as UnixMs,
      authoritativeSequence: typeof record.metadata?.authoritativeSequence === 'number'
        ? record.metadata.authoritativeSequence
        : undefined,
      requestId: typeof record.metadata?.requestId === 'string'
        ? record.metadata.requestId as any
        : undefined,
      roomId: typeof record.metadata?.roomId === 'string'
        ? record.metadata.roomId as any
        : undefined,
      sessionId: typeof record.metadata?.sessionId === 'string'
        ? record.metadata.sessionId as any
        : undefined,
    },
    tags: Array.isArray(record.metadata?.tags)
      ? record.metadata.tags.filter((value): value is string => typeof value === 'string')
      : undefined,
  };
}

function recordSignature(records: readonly ChatTranscriptRecord[]): string {
  const count = records.length;
  const first = records[0];
  const last = records[count - 1];
  return [
    count,
    first?.messageId ?? 'none',
    first?.sortTs ?? 0,
    last?.messageId ?? 'none',
    last?.sortTs ?? 0,
  ].join(':');
}

function sessionCacheKey(input: {
  channel: ChatVisibleChannel;
  anchorStrategy: ChatReplayAnchorStrategy;
  anchorMessageId?: ChatMessageId;
  anchorProofHash?: ChatProofHash;
  anchorMomentId?: ChatMomentId;
  anchorLegendId?: ChatLegendId;
  anchorTs?: UnixMs;
  beforeCount: number;
  afterCount: number;
  maxRecords: number;
  includeFailed: boolean;
  includeRedacted: boolean;
  replayEligibleOnly: boolean;
  proofOnly: boolean;
  continuityMode: ChatReplayContinuityMode;
}): string {
  return stableStringify(input);
}

function inferTimelineClass(record: ChatTranscriptRecord): ChatReplayTimelineClass {
  switch (record.kind as ChatMessageKind) {
    case 'PLAYER':
      return 'PLAYER_TURN';
    case 'BOT_ATTACK':
    case 'BOT_TAUNT':
    case 'HATER_TELEGRAPH':
    case 'HATER_PUNISH':
      return 'HATER_PRESSURE';
    case 'HELPER_PROMPT':
    case 'HELPER_RESCUE':
      return 'HELPER_BEAT';
    case 'NEGOTIATION_OFFER':
    case 'NEGOTIATION_COUNTER':
    case 'DEAL_RECAP':
      return 'NEGOTIATION_SWING';
    case 'LEGEND_MOMENT':
      return 'LEGEND_SPIKE';
    case 'POST_RUN_RITUAL':
      return 'POST_RUN_RITUAL';
    case 'WORLD_EVENT':
      return 'WORLD_EVENT';
    case 'SYSTEM':
    case 'MARKET_ALERT':
    case 'ACHIEVEMENT':
    case 'SYSTEM_SHADOW_MARKER':
      return 'SYSTEM_ARC';
    case 'NPC_AMBIENT':
    case 'CROWD_REACTION':
    case 'RELATIONSHIP_CALLBACK':
    case 'QUOTE_CALLBACK':
      return 'NPC_WAVE';
    case 'SHIELD_EVENT':
    case 'CASCADE_ALERT':
      return record.proofHash ? 'PROOF_CHAIN' : 'SCENE_BLOCK';
    default:
      return record.proofHash ? 'PROOF_CHAIN' : 'SCENE_BLOCK';
  }
}

function isReplayEligibleRecord(record: ChatTranscriptRecord): boolean {
  if (record.state === 'TOMBSTONED') return false;
  if (record.metadata?.replayEligible === false) return false;
  return true;
}

function dominantKindOf(records: readonly ChatTranscriptRecord[]): ChatMessageKind {
  const counts = new Map<string, number>();
  for (const record of records) {
    counts.set(record.kind, (counts.get(record.kind) ?? 0) + 1);
  }
  let winner: string = records[0]?.kind ?? 'SYSTEM';
  let winnerScore = -1;
  for (const [kind, score] of counts.entries()) {
    if (score > winnerScore) {
      winner = kind;
      winnerScore = score;
    }
  }
  return winner as ChatMessageKind;
}

function extractSceneId(record: ChatTranscriptRecord): string | undefined {
  if (typeof record.metadata?.sceneId === 'string' && record.metadata.sceneId.trim()) {
    return record.metadata.sceneId;
  }
  return recordToMessage(record).sceneId;
}

function extractMomentId(record: ChatTranscriptRecord): ChatMomentId | undefined {
  if (typeof record.metadata?.momentId === 'string' && record.metadata.momentId.trim()) {
    return record.metadata.momentId as ChatMomentId;
  }
  return recordToMessage(record).momentId;
}

function extractLegendId(record: ChatTranscriptRecord): ChatLegendId | undefined {
  if (typeof record.metadata?.legendId === 'string' && record.metadata.legendId.trim()) {
    return record.metadata.legendId as ChatLegendId;
  }
  if (record.kind === 'LEGEND_MOMENT') {
    return toLegendId(`legend:${record.messageId}`);
  }
  return undefined;
}

function extractReplayId(record: ChatTranscriptRecord): ChatReplayId | undefined {
  if (typeof record.metadata?.replayId === 'string' && record.metadata.replayId.trim()) {
    return record.metadata.replayId as ChatReplayId;
  }
  return undefined;
}

function summaryLineForSegment(
  timelineClass: ChatReplayTimelineClass,
  records: readonly ChatTranscriptRecord[],
): string {
  const first = records[0];
  const last = records[records.length - 1];
  const firstSpeaker = first?.senderName || 'Unknown';
  const lastBody = normalizeText(last?.redactedBody ?? last?.body).slice(0, 96);

  switch (timelineClass) {
    case 'HATER_PRESSURE':
      return `${firstSpeaker} pressed the room${lastBody ? ` — ${lastBody}` : ''}`;
    case 'HELPER_BEAT':
      return `${firstSpeaker} intervened${lastBody ? ` — ${lastBody}` : ''}`;
    case 'NEGOTIATION_SWING':
      return `Deal Room pressure shifted${lastBody ? ` — ${lastBody}` : ''}`;
    case 'LEGEND_SPIKE':
      return `Legend registered${lastBody ? ` — ${lastBody}` : ''}`;
    case 'POST_RUN_RITUAL':
      return `Post-run ritual formed${lastBody ? ` — ${lastBody}` : ''}`;
    case 'WORLD_EVENT':
      return `World event punctured the room${lastBody ? ` — ${lastBody}` : ''}`;
    case 'PROOF_CHAIN':
      return `Proof-bearing sequence${lastBody ? ` — ${lastBody}` : ''}`;
    case 'PLAYER_TURN':
      return `Player turn witnessed${lastBody ? ` — ${lastBody}` : ''}`;
    case 'NPC_WAVE':
      return `NPC wave carried the moment${lastBody ? ` — ${lastBody}` : ''}`;
    case 'SYSTEM_ARC':
      return `System arc shifted${lastBody ? ` — ${lastBody}` : ''}`;
    default:
      return `${firstSpeaker} shaped the scene${lastBody ? ` — ${lastBody}` : ''}`;
  }
}

function cloneSession(session: ChatReplaySession): ChatReplaySession {
  return { ...session };
}

function cloneChannelSnapshot(snapshot: ChatReplayChannelSnapshot): ChatReplayChannelSnapshot {
  return { ...snapshot };
}

// ============================================================================
// MARK: Replay buffer
// ============================================================================

export class ChatReplayBuffer {
  private readonly transcriptBuffer: ChatTranscriptBuffer;
  private readonly callbacks: ChatReplayBufferCallbacks;
  private readonly config: ChatReplayBufferConfig & typeof DEFAULT_CONFIG;
  private readonly channels = new Map<ChatVisibleChannel, InternalReplayChannelState>();
  private activeChannel: ChatVisibleChannel;
  private mountTarget: ChatMountTarget;
  private destroyed = false;
  private compactionTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: ChatReplayBufferOptions) {
    this.transcriptBuffer = options.transcriptBuffer;
    this.callbacks = options.callbacks ?? {};
    this.config = {
      ...DEFAULT_CONFIG,
      ...(options.config ?? {}),
    };
    this.activeChannel = options.initialChannel ?? 'GLOBAL';
    this.mountTarget = options.mountTarget ?? 'BATTLE_HUD';

    for (const channel of CHANNELS) {
      this.channels.set(channel, this.createChannelState(channel));
    }

    this.compactionTimer = setInterval(() => {
      this.compactIdleSessions();
    }, this.config.compactionIntervalMs);

    this.refreshChannelSnapshots('GLOBAL');
    this.emitSnapshot();
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.compactionTimer) {
      clearInterval(this.compactionTimer);
      this.compactionTimer = null;
    }

    for (const channel of CHANNELS) {
      this.closeChannelSessions(channel, 'DESTROY');
    }
  }

  public reset(channel?: ChatVisibleChannel): void {
    this.assertNotDestroyed('reset');

    if (channel) {
      this.closeChannelSessions(channel, 'RESET');
      this.channels.set(channel, this.createChannelState(channel));
      this.refreshChannelSnapshots(channel);
      this.emitSnapshot();
      return;
    }

    for (const candidate of CHANNELS) {
      this.closeChannelSessions(candidate, 'RESET');
      this.channels.set(candidate, this.createChannelState(candidate));
      this.refreshChannelSnapshots(candidate);
    }

    this.emitSnapshot();
  }

  // ---------------------------------------------------------------------------
  // Mount / channel selection
  // ---------------------------------------------------------------------------

  public setMountTarget(mountTarget: ChatMountTarget): void {
    this.assertNotDestroyed('setMountTarget');
    this.mountTarget = mountTarget;
    this.emitSnapshot();
  }

  public getMountTarget(): ChatMountTarget {
    return this.mountTarget;
  }

  public setActiveChannel(channel: ChatVisibleChannel): void {
    this.assertNotDestroyed('setActiveChannel');
    this.activeChannel = channel;
    this.refreshChannelSnapshots(channel);
    this.emitSnapshot();
  }

  public getActiveChannel(): ChatVisibleChannel {
    return this.activeChannel;
  }

  // ---------------------------------------------------------------------------
  // Snapshot and session inventory
  // ---------------------------------------------------------------------------

  public getSnapshot(): ChatReplaySnapshot {
    return {
      activeChannel: this.activeChannel,
      mountTarget: this.mountTarget,
      channels: CHANNELS.map((channel) => this.buildChannelSnapshot(channel)),
      openSessions: CHANNELS
        .flatMap((channel) => this.listSessions(channel))
        .filter((session) => this.requireChannel(channelOfSession(session)).openSessionId === session.id),
      transcript: this.transcriptBuffer.getSnapshot(),
    };
  }

  public listSessions(channel?: ChatVisibleChannel): ChatReplaySession[] {
    this.assertNotDestroyed('listSessions');

    if (channel) {
      const state = this.requireChannel(channel);
      return state.orderedSessionIds
        .map((id) => state.sessionsById.get(id)?.session)
        .filter((session): session is ChatReplaySession => Boolean(session))
        .map(cloneSession);
    }

    const all: ChatReplaySession[] = [];
    for (const candidate of CHANNELS) {
      all.push(...this.listSessions(candidate));
    }
    return all.sort((left, right) => right.lastAccessedAt - left.lastAccessedAt);
  }

  public getOpenSession(channel: ChatVisibleChannel = this.activeChannel): ChatReplaySession | undefined {
    this.assertNotDestroyed('getOpenSession');
    const state = this.requireChannel(channel);
    if (!state.openSessionId) return undefined;
    const session = state.sessionsById.get(state.openSessionId)?.session;
    return session ? cloneSession(session) : undefined;
  }

  public getSessionById(sessionId: string): ChatReplaySession | undefined {
    this.assertNotDestroyed('getSessionById');
    for (const channel of CHANNELS) {
      const session = this.requireChannel(channel).sessionsById.get(sessionId)?.session;
      if (session) return cloneSession(session);
    }
    return undefined;
  }

  public getChannelSnapshot(channel: ChatVisibleChannel): ChatReplayChannelSnapshot {
    this.assertNotDestroyed('getChannelSnapshot');
    return this.buildChannelSnapshot(channel);
  }

  // ---------------------------------------------------------------------------
  // Session control
  // ---------------------------------------------------------------------------

  public openSession(input: {
    readonly channel?: ChatVisibleChannel;
    readonly reason?: ChatReplayOpenReason;
    readonly replayId?: ChatReplayId;
    readonly continuityMode?: ChatReplayContinuityMode;
    readonly anchorMessageId?: ChatMessageId;
    readonly anchorProofHash?: ChatProofHash;
    readonly anchorMomentId?: ChatMomentId;
  } = {}): ChatReplaySession {
    this.assertNotDestroyed('openSession');

    const channel = input.channel ?? this.activeChannel;
    const state = this.requireChannel(channel);
    this.refreshChannelSnapshots(channel);

    const session: ChatReplaySession = {
      id: buildSessionId(channel),
      channel,
      mountTarget: this.mountTarget,
      openedAt: now(),
      lastAccessedAt: now(),
      openedReason: input.reason ?? 'MANUAL_OPEN',
      continuityMode: input.continuityMode ?? 'RUN_SCOPED',
      replayId: input.replayId,
      anchorMessageId: input.anchorMessageId,
      anchorProofHash: input.anchorProofHash,
      anchorMomentId: input.anchorMomentId,
      replayToken: state.replayToken,
      hasMoreBefore: state.hasMoreBefore,
      hasMoreAfter: state.hasMoreAfter,
      recordSignature: state.recordSignature,
      cachedSliceCount: 0,
    };

    const internal: InternalReplaySession = {
      session,
      sliceCache: new Map<string, ChatReplaySlice>(),
      continuityCache: undefined,
    };

    state.sessionsById.set(session.id, internal);
    state.orderedSessionIds.push(session.id);
    state.openSessionId = session.id;
    this.enforceSessionLimit(state);
    this.callbacks.onSessionOpened?.(cloneSession(session));
    this.emitSnapshot();
    return cloneSession(session);
  }

  public closeSession(sessionId: string, reason: ChatReplayCloseReason = 'MANUAL_CLOSE'): void {
    this.assertNotDestroyed('closeSession');

    for (const channel of CHANNELS) {
      const state = this.requireChannel(channel);
      const internal = state.sessionsById.get(sessionId);
      if (!internal) continue;

      state.sessionsById.delete(sessionId);
      state.orderedSessionIds = state.orderedSessionIds.filter((id) => id !== sessionId);
      if (state.openSessionId === sessionId) {
        state.openSessionId = state.orderedSessionIds[state.orderedSessionIds.length - 1];
      }
      this.callbacks.onSessionClosed?.(cloneSession(internal.session), reason);
      this.emitSnapshot();
      return;
    }
  }

  public closeChannelSessions(
    channel: ChatVisibleChannel,
    reason: ChatReplayCloseReason = 'MANUAL_CLOSE',
  ): void {
    this.assertNotDestroyed('closeChannelSessions');
    const state = this.requireChannel(channel);
    for (const sessionId of [...state.orderedSessionIds]) {
      const session = state.sessionsById.get(sessionId)?.session;
      if (session) {
        this.callbacks.onSessionClosed?.(cloneSession(session), reason);
      }
    }
    state.sessionsById.clear();
    state.orderedSessionIds = [];
    state.openSessionId = undefined;
    this.emitSnapshot();
  }

  // ---------------------------------------------------------------------------
  // Authoritative hydration / replay truth handoff
  // ---------------------------------------------------------------------------

  public noteHydration(input: {
    readonly channel: ChatVisibleChannel;
    readonly replayId?: ChatReplayId;
    readonly replayToken?: string;
    readonly hasMoreBefore?: boolean;
    readonly hasMoreAfter?: boolean;
    readonly reason?: ChatReplayOpenReason;
  }): ChatReplaySession {
    this.assertNotDestroyed('noteHydration');

    const state = this.requireChannel(input.channel);
    state.lastHydratedAt = now();
    state.replayToken = input.replayToken ?? state.replayToken;
    state.hasMoreBefore = Boolean(input.hasMoreBefore);
    state.hasMoreAfter = Boolean(input.hasMoreAfter);
    this.refreshChannelSnapshots(input.channel);

    const existingOpen = this.getOpenSession(input.channel);
    if (existingOpen) {
      const internal = state.sessionsById.get(existingOpen.id);
      if (internal) {
        internal.session = {
          ...internal.session,
          replayId: input.replayId ?? internal.session.replayId,
          replayToken: state.replayToken,
          hasMoreBefore: state.hasMoreBefore,
          hasMoreAfter: state.hasMoreAfter,
          recordSignature: state.recordSignature,
          lastAccessedAt: now(),
          cachedSliceCount: internal.sliceCache.size,
        };
        this.emitSnapshot();
        return cloneSession(internal.session);
      }
    }

    return this.openSession({
      channel: input.channel,
      replayId: input.replayId,
      reason: input.reason ?? 'HYDRATION',
    });
  }

  public hydrateFromAuthoritativeFrame(
    frame: ChatAuthoritativeFrame,
  ): ChatReplaySlice | undefined {
    this.assertNotDestroyed('hydrateFromAuthoritativeFrame');

    if (!isVisibleChatChannel(frame.channelId as string)) {
      return undefined;
    }

    const channel = frame.channelId as ChatVisibleChannel;
    this.noteHydration({
      channel,
      replayToken: undefined,
      hasMoreBefore: false,
      hasMoreAfter: false,
      reason: 'AUTHORITATIVE_FRAME',
    });

    return this.buildSlice({
      channel,
      reason: 'AUTHORITATIVE_SYNC',
      anchorStrategy: 'LATEST',
    });
  }

  // ---------------------------------------------------------------------------
  // Slice builders
  // ---------------------------------------------------------------------------

  public buildLatestSlice(
    channel: ChatVisibleChannel = this.activeChannel,
    reason: ChatReplaySliceReason = 'MANUAL_REQUEST',
  ): ChatReplaySlice {
    return this.buildSlice({
      channel,
      reason,
      anchorStrategy: 'LATEST',
    });
  }

  public buildSlice(request: ChatReplaySliceRequest = {}): ChatReplaySlice {
    this.assertNotDestroyed('buildSlice');

    const channel = request.channel ?? this.activeChannel;
    const state = this.requireChannel(channel);
    this.refreshChannelSnapshots(channel);

    const internalSession = this.resolveSessionForRequest(channel, request);
    const beforeCount = clamp(
      safeNumber(request.beforeCount, this.config.defaultBeforeCount),
      0,
      this.config.maxRecordsPerSlice,
    );
    const afterCount = clamp(
      safeNumber(request.afterCount, this.config.defaultAfterCount),
      0,
      this.config.maxRecordsPerSlice,
    );
    const maxRecords = clamp(
      safeNumber(request.maxRecords, beforeCount + afterCount + 1),
      1,
      this.config.maxRecordsPerSlice,
    );

    const anchorStrategy = request.anchorStrategy
      ?? (request.drawerCursor
        ? 'DRAWER_CURSOR'
        : request.anchorMessageId
          ? 'MESSAGE_ID'
          : request.anchorProofHash
            ? 'PROOF_HASH'
            : request.anchorMomentId
              ? 'MOMENT_ID'
              : request.anchorLegendId
                ? 'LEGEND_ID'
                : request.anchorTs
                  ? 'TIMESTAMP'
                  : 'LATEST');

    const cacheKey = sessionCacheKey({
      channel,
      anchorStrategy,
      anchorMessageId: request.anchorMessageId,
      anchorProofHash: request.anchorProofHash,
      anchorMomentId: request.anchorMomentId,
      anchorLegendId: request.anchorLegendId,
      anchorTs: request.anchorTs,
      beforeCount,
      afterCount,
      maxRecords,
      includeFailed: Boolean(request.includeFailed),
      includeRedacted: Boolean(request.includeRedacted),
      replayEligibleOnly: request.replayEligibleOnly !== false,
      proofOnly: Boolean(request.proofOnly),
      continuityMode: request.continuityMode ?? internalSession.session.continuityMode,
    });

    if (internalSession.session.recordSignature === state.recordSignature) {
      const cached = internalSession.sliceCache.get(cacheKey);
      if (cached) {
        internalSession.session = {
          ...internalSession.session,
          lastAccessedAt: now(),
          cachedSliceCount: internalSession.sliceCache.size,
        };
        return cached;
      }
    } else {
      internalSession.sliceCache.clear();
      internalSession.continuityCache = undefined;
      internalSession.session = {
        ...internalSession.session,
        recordSignature: state.recordSignature,
        cachedSliceCount: 0,
      };
    }

    const sourceRecords = this.collectSourceRecords(channel, {
      includeFailed: Boolean(request.includeFailed),
      includeRedacted: Boolean(request.includeRedacted),
      replayEligibleOnly: request.replayEligibleOnly !== false,
      proofOnly: Boolean(request.proofOnly),
    });

    const anchorResolution = this.resolveAnchor(channel, sourceRecords, {
      anchorStrategy,
      anchorMessageId: request.anchorMessageId,
      anchorProofHash: request.anchorProofHash,
      anchorMomentId: request.anchorMomentId,
      anchorLegendId: request.anchorLegendId,
      anchorTs: request.anchorTs,
      drawerCursor: request.drawerCursor,
      beforeCount,
      afterCount,
      maxRecords,
    });

    const records = anchorResolution.records;
    const segments = this.buildTimelineSegments(channel, records);
    const proofReferences = this.buildProofReferences(channel, records, segments);
    const legendMoments = this.buildLegendMoments(channel, records);
    const momentAnchors = this.buildMomentAnchors(channel, records);
    const threadViews = this.buildThreadViews(channel, records);
    const continuity = this.buildContinuityDigest(channel, records, {
      mode: request.continuityMode ?? internalSession.session.continuityMode,
      legends: legendMoments,
      proofs: proofReferences,
      moments: momentAnchors,
    });
    const summary = this.buildSummary(channel, records, legendMoments);

    internalSession.session = {
      ...internalSession.session,
      anchorMessageId: anchorResolution.anchorMessageId,
      anchorProofHash: anchorResolution.anchorProofHash,
      anchorMomentId: anchorResolution.anchorMomentId,
      replayToken: state.replayToken,
      hasMoreBefore: anchorResolution.hasMoreBefore,
      hasMoreAfter: anchorResolution.hasMoreAfter,
      recordSignature: state.recordSignature,
      lastAccessedAt: now(),
      cachedSliceCount: internalSession.sliceCache.size,
    };

    const slice: ChatReplaySlice = {
      session: cloneSession(internalSession.session),
      reason: request.reason ?? 'MANUAL_REQUEST',
      builtAt: now(),
      channel,
      anchorStrategy,
      anchorMessageId: anchorResolution.anchorMessageId,
      anchorProofHash: anchorResolution.anchorProofHash,
      anchorMomentId: anchorResolution.anchorMomentId,
      anchorTs: anchorResolution.anchorTs,
      records,
      messages: records.map(recordToMessage),
      segments,
      proofReferences,
      legendMoments,
      momentAnchors,
      threadViews,
      continuity,
      summary,
      hasMoreBefore: anchorResolution.hasMoreBefore,
      hasMoreAfter: anchorResolution.hasMoreAfter,
    };

    internalSession.sliceCache.set(cacheKey, slice);
    this.pruneSessionCache(internalSession);
    internalSession.session = {
      ...internalSession.session,
      cachedSliceCount: internalSession.sliceCache.size,
    };

    this.callbacks.onSliceBuilt?.(slice);
    this.emitSnapshot();
    return slice;
  }

  public buildProofSlice(input: {
    readonly channel?: ChatVisibleChannel;
    readonly proofHash: ChatProofHash;
    readonly contextRadius?: number;
  }): ChatReplaySlice {
    this.assertNotDestroyed('buildProofSlice');
    const channel = input.channel ?? this.activeChannel;
    const state = this.requireChannel(channel);
    this.refreshChannelSnapshots(channel);

    const proofRecord = this.transcriptBuffer.getByProofHash(input.proofHash, channel);
    const radius = clamp(
      safeNumber(input.contextRadius, this.config.proofContextRadius),
      0,
      20,
    );

    const raw = this.collectSourceRecords(channel, {
      includeFailed: true,
      includeRedacted: true,
      replayEligibleOnly: false,
      proofOnly: false,
    });

    const anchorIndex = proofRecord
      ? raw.findIndex((record) => record.messageId === proofRecord.messageId)
      : raw.length - 1;

    const start = Math.max(anchorIndex - radius, 0);
    const endExclusive = Math.min(anchorIndex + radius + 1, raw.length);
    const focused = raw.slice(start, endExclusive);

    return this.buildSlice({
      channel,
      reason: 'PROOF_REVIEW',
      anchorStrategy: 'PROOF_HASH',
      anchorProofHash: input.proofHash,
      beforeCount: radius,
      afterCount: radius,
      maxRecords: focused.length || radius * 2 + 1,
      includeFailed: true,
      includeRedacted: true,
      replayEligibleOnly: false,
    });
  }

  public buildLegendSlice(input: {
    readonly channel?: ChatVisibleChannel;
    readonly legendId: ChatLegendId;
  }): ChatReplaySlice {
    this.assertNotDestroyed('buildLegendSlice');
    return this.buildSlice({
      channel: input.channel ?? this.activeChannel,
      reason: 'LEGEND_REVIEW',
      anchorStrategy: 'LEGEND_ID',
      anchorLegendId: input.legendId,
      includeFailed: true,
      includeRedacted: true,
      replayEligibleOnly: false,
    });
  }

  public buildPostRunRecap(
    channel: ChatVisibleChannel = this.activeChannel,
  ): ChatReplayPostRunRecap {
    this.assertNotDestroyed('buildPostRunRecap');

    const slice = this.buildSlice({
      channel,
      reason: 'POST_RUN_RECAP',
      anchorStrategy: 'LATEST',
      continuityMode: 'POST_RUN_ONLY',
      includeFailed: true,
      includeRedacted: true,
      replayEligibleOnly: false,
      maxRecords: clamp(this.config.maxRecordsPerSlice, 1, 180),
    });

    const turningPoints = [...slice.legendMoments].sort(compareLegendDesc).slice(0, 6);
    const witnessLines = slice.messages
      .filter((message) => message.kind === 'CROWD_REACTION'
        || message.kind === 'NPC_AMBIENT'
        || message.kind === 'POST_RUN_RITUAL'
        || message.kind === 'HELPER_RESCUE'
        || message.kind === 'RELATIONSHIP_CALLBACK')
      .slice(-12);
    const proofHighlights = [...slice.proofReferences].sort(compareProofAsc).slice(-6);
    const finalWord = slice.messages[slice.messages.length - 1];

    const narrativeLine = this.buildPostRunNarrativeLine(slice, turningPoints, finalWord);

    return {
      channel,
      builtAt: now(),
      slice,
      turningPoints,
      witnessLines,
      proofHighlights,
      finalWord,
      narrativeLine,
    };
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  public exportSession(input: {
    readonly sessionId?: string;
    readonly channel?: ChatVisibleChannel;
    readonly format?: ChatReplayExportFormat;
    readonly transcriptMode?: ChatTranscriptExportMode;
  } = {}): ChatReplayExportBundle {
    this.assertNotDestroyed('exportSession');

    const session = input.sessionId
      ? this.getSessionById(input.sessionId)
      : this.getOpenSession(input.channel ?? this.activeChannel)
        ?? this.openSession({ channel: input.channel ?? this.activeChannel, reason: 'MANUAL_OPEN' });

    const slice = this.buildSlice({
      sessionId: session.id,
      channel: session.channel,
      reason: 'SESSION_EXPORT',
      anchorStrategy: session.anchorMessageId
        ? 'MESSAGE_ID'
        : session.anchorProofHash
          ? 'PROOF_HASH'
          : session.anchorMomentId
            ? 'MOMENT_ID'
            : 'LATEST',
      anchorMessageId: session.anchorMessageId,
      anchorProofHash: session.anchorProofHash,
      anchorMomentId: session.anchorMomentId,
      includeFailed: true,
      includeRedacted: true,
      replayEligibleOnly: false,
    });

    const transcriptBundle = this.transcriptBuffer.exportBundle({
      mode: input.transcriptMode ?? 'CHANNEL_FULL',
      channel: slice.channel,
    });

    const bundle: ChatReplayExportBundle = {
      format: input.format ?? 'JSON_BUNDLE',
      builtAt: now(),
      engineVersion: CHAT_ENGINE_VERSION,
      authorities: CHAT_ENGINE_AUTHORITIES,
      slice,
      serializerHint: {
        pendingFile: '/pzo-web/src/engines/chat/replay/ChatReplaySerializer.ts',
        ready: true,
      },
      transcriptBundle,
    };

    this.callbacks.onExported?.(bundle);
    return bundle;
  }

  // ---------------------------------------------------------------------------
  // Internals — channel state and signature tracking
  // ---------------------------------------------------------------------------

  private createChannelState(channel: ChatVisibleChannel): InternalReplayChannelState {
    const records = this.transcriptBuffer.getRawWindow(channel);
    return {
      channel,
      revision: 1,
      recordSignature: recordSignature(records),
      openSessionId: undefined,
      sessionsById: new Map<string, InternalReplaySession>(),
      orderedSessionIds: [],
      replayToken: undefined,
      hasMoreBefore: false,
      hasMoreAfter: false,
      lastHydratedAt: undefined,
    };
  }

  private refreshChannelSnapshots(channel: ChatVisibleChannel): void {
    const state = this.requireChannel(channel);
    const records = this.transcriptBuffer.getRawWindow(channel);
    const nextSignature = recordSignature(records);
    if (nextSignature !== state.recordSignature) {
      state.revision += 1;
      state.recordSignature = nextSignature;
      for (const internal of state.sessionsById.values()) {
        internal.sliceCache.clear();
        internal.continuityCache = undefined;
        internal.session = {
          ...internal.session,
          recordSignature: nextSignature,
          cachedSliceCount: 0,
        };
      }
    }
  }

  private buildChannelSnapshot(channel: ChatVisibleChannel): ChatReplayChannelSnapshot {
    const state = this.requireChannel(channel);
    const records = this.collectSourceRecords(channel, {
      includeFailed: true,
      includeRedacted: true,
      replayEligibleOnly: false,
      proofOnly: false,
    });
    const replayEligibleCount = records.filter(isReplayEligibleRecord).length;
    const proofCount = records.filter((record) => Boolean(record.proofHash)).length;
    const legendCount = records.filter((record) => record.kind === 'LEGEND_MOMENT' || Boolean(record.metadata?.legendId)).length;

    return {
      channel,
      revision: state.revision,
      openSessionId: state.openSessionId,
      recordSignature: state.recordSignature,
      recordCount: records.length,
      replayEligibleCount,
      proofCount,
      legendCount,
      lastHydratedAt: state.lastHydratedAt,
      replayToken: state.replayToken,
      hasMoreBefore: state.hasMoreBefore,
      hasMoreAfter: state.hasMoreAfter,
    };
  }

  private resolveSessionForRequest(
    channel: ChatVisibleChannel,
    request: ChatReplaySliceRequest,
  ): InternalReplaySession {
    const state = this.requireChannel(channel);

    if (request.sessionId) {
      const explicit = state.sessionsById.get(request.sessionId);
      if (explicit) return explicit;
    }

    if (state.openSessionId) {
      const open = state.sessionsById.get(state.openSessionId);
      if (open) return open;
    }

    const created = this.openSession({
      channel,
      reason: request.reason === 'POST_RUN_RECAP' ? 'POST_RUN_RITUAL' : 'MANUAL_OPEN',
      continuityMode: request.continuityMode,
      anchorMessageId: request.anchorMessageId,
      anchorProofHash: request.anchorProofHash,
      anchorMomentId: request.anchorMomentId,
    });

    const internal = state.sessionsById.get(created.id);
    if (!internal) {
      throw createError('Session created but not found in internal state.');
    }
    return internal;
  }

  private enforceSessionLimit(state: InternalReplayChannelState): void {
    while (state.orderedSessionIds.length > this.config.maxOpenSessionsPerChannel) {
      const oldestId = state.orderedSessionIds.shift();
      if (!oldestId) return;
      const session = state.sessionsById.get(oldestId)?.session;
      state.sessionsById.delete(oldestId);
      if (session) {
        this.callbacks.onSessionClosed?.(cloneSession(session), 'IDLE_EVICTION');
      }
    }
  }

  private pruneSessionCache(session: InternalReplaySession): void {
    while (session.sliceCache.size > this.config.maxSliceCachePerSession) {
      const oldest = session.sliceCache.keys().next().value;
      if (!oldest) return;
      session.sliceCache.delete(oldest);
    }
  }

  private compactIdleSessions(): void {
    if (this.destroyed) return;
    const cutoff = Date.now() - this.config.sessionIdleTtlMs;

    for (const channel of CHANNELS) {
      const state = this.requireChannel(channel);
      const toRemove: string[] = [];
      for (const sessionId of state.orderedSessionIds) {
        const session = state.sessionsById.get(sessionId)?.session;
        if (!session) continue;
        if (session.lastAccessedAt < cutoff && state.openSessionId !== sessionId) {
          toRemove.push(sessionId);
        }
      }

      for (const sessionId of toRemove) {
        const session = state.sessionsById.get(sessionId)?.session;
        state.sessionsById.delete(sessionId);
        state.orderedSessionIds = state.orderedSessionIds.filter((id) => id !== sessionId);
        if (session) {
          this.callbacks.onSessionClosed?.(cloneSession(session), 'IDLE_EVICTION');
        }
      }
    }

    this.emitSnapshot();
  }

  // ---------------------------------------------------------------------------
  // Internals — source collection and anchor resolution
  // ---------------------------------------------------------------------------

  private collectSourceRecords(
    channel: ChatVisibleChannel,
    options: {
      readonly includeFailed: boolean;
      readonly includeRedacted: boolean;
      readonly replayEligibleOnly: boolean;
      readonly proofOnly: boolean;
    },
  ): ChatTranscriptRecord[] {
    const raw = this.config.preferVisibleWindow
      ? this.transcriptBuffer.getVisibleWindow(channel)
      : this.transcriptBuffer.getRawWindow(channel);

    return raw.filter((record) => {
      if (record.state === 'TOMBSTONED') return false;
      if (!options.includeFailed && record.state === 'FAILED') return false;
      if (!options.includeRedacted && record.state === 'REDACTED') return false;
      if (options.replayEligibleOnly && !isReplayEligibleRecord(record)) return false;
      if (options.proofOnly && !record.proofHash) return false;
      return true;
    });
  }

  private resolveAnchor(
    channel: ChatVisibleChannel,
    records: readonly ChatTranscriptRecord[],
    input: {
      readonly anchorStrategy: ChatReplayAnchorStrategy;
      readonly anchorMessageId?: ChatMessageId;
      readonly anchorProofHash?: ChatProofHash;
      readonly anchorMomentId?: ChatMomentId;
      readonly anchorLegendId?: ChatLegendId;
      readonly anchorTs?: UnixMs;
      readonly drawerCursor?: ChatTranscriptDrawerCursor;
      readonly beforeCount: number;
      readonly afterCount: number;
      readonly maxRecords: number;
    },
  ): {
    readonly records: readonly ChatTranscriptRecord[];
    readonly anchorMessageId?: ChatMessageId;
    readonly anchorProofHash?: ChatProofHash;
    readonly anchorMomentId?: ChatMomentId;
    readonly anchorTs?: UnixMs;
    readonly hasMoreBefore: boolean;
    readonly hasMoreAfter: boolean;
  } {
    if (records.length === 0) {
      return {
        records: [],
        anchorMessageId: input.anchorMessageId,
        anchorProofHash: input.anchorProofHash,
        anchorMomentId: input.anchorMomentId,
        anchorTs: input.anchorTs,
        hasMoreBefore: false,
        hasMoreAfter: false,
      };
    }

    if (input.anchorStrategy === 'DRAWER_CURSOR' && input.drawerCursor) {
      const page = this.transcriptBuffer.buildDrawerPage(input.drawerCursor);
      return {
        records: page.records,
        anchorMessageId: page.anchorMessageId as ChatMessageId | undefined,
        anchorTs: page.anchorTs as UnixMs | undefined,
        hasMoreBefore: page.hasMoreBefore,
        hasMoreAfter: page.hasMoreAfter,
      };
    }

    let anchorIndex = records.length - 1;
    let anchorMessageId = input.anchorMessageId;
    let anchorProofHash = input.anchorProofHash;
    let anchorMomentId = input.anchorMomentId;
    let anchorTs = input.anchorTs;

    switch (input.anchorStrategy) {
      case 'MESSAGE_ID': {
        const target = input.anchorMessageId && normalizeText(input.anchorMessageId);
        const index = target
          ? records.findIndex((record) => record.messageId === target || record.ackedServerId === target)
          : -1;
        if (index >= 0) anchorIndex = index;
        break;
      }
      case 'PROOF_HASH': {
        const target = input.anchorProofHash && normalizeText(input.anchorProofHash);
        const index = target
          ? records.findIndex((record) => record.proofHash === target)
          : -1;
        if (index >= 0) {
          anchorIndex = index;
          anchorMessageId = records[index].messageId as ChatMessageId;
          anchorTs = records[index].sortTs as UnixMs;
        }
        break;
      }
      case 'TIMESTAMP': {
        if (input.anchorTs) {
          const targetTs = input.anchorTs;
          let bestIndex = 0;
          let bestDistance = Number.POSITIVE_INFINITY;
          for (let index = 0; index < records.length; index += 1) {
            const distance = Math.abs(records[index].sortTs - targetTs);
            if (distance < bestDistance) {
              bestDistance = distance;
              bestIndex = index;
            }
          }
          anchorIndex = bestIndex;
          anchorMessageId = records[bestIndex].messageId as ChatMessageId;
          anchorTs = records[bestIndex].sortTs as UnixMs;
        }
        break;
      }
      case 'LEGEND_ID': {
        const target = input.anchorLegendId && normalizeText(input.anchorLegendId);
        const index = target
          ? records.findIndex((record) => extractLegendId(record) === target)
          : -1;
        if (index >= 0) {
          anchorIndex = index;
          anchorMessageId = records[index].messageId as ChatMessageId;
          anchorTs = records[index].sortTs as UnixMs;
          anchorMomentId = extractMomentId(records[index]);
        }
        break;
      }
      case 'MOMENT_ID': {
        const target = input.anchorMomentId && normalizeText(input.anchorMomentId);
        const index = target
          ? records.findIndex((record) => extractMomentId(record) === target)
          : -1;
        if (index >= 0) {
          anchorIndex = index;
          anchorMessageId = records[index].messageId as ChatMessageId;
          anchorTs = records[index].sortTs as UnixMs;
        }
        break;
      }
      case 'LATEST':
      default:
        anchorIndex = records.length - 1;
        anchorMessageId = records[anchorIndex].messageId as ChatMessageId;
        anchorTs = records[anchorIndex].sortTs as UnixMs;
        anchorMomentId = extractMomentId(records[anchorIndex]);
        anchorProofHash = records[anchorIndex].proofHash as ChatProofHash | undefined;
        break;
    }

    anchorIndex = clamp(anchorIndex, 0, records.length - 1);

    const start = Math.max(anchorIndex - input.beforeCount, 0);
    const endExclusive = Math.min(anchorIndex + input.afterCount + 1, records.length);
    let slice = records.slice(start, endExclusive);

    if (slice.length > input.maxRecords) {
      slice = slice.slice(slice.length - input.maxRecords);
    }

    const finalAnchor = slice.find((record) => record.messageId === anchorMessageId)
      ?? slice[slice.length - 1]
      ?? records[anchorIndex];

    return {
      records: slice,
      anchorMessageId: (finalAnchor?.messageId ?? anchorMessageId) as ChatMessageId | undefined,
      anchorProofHash: (finalAnchor?.proofHash ?? anchorProofHash) as ChatProofHash | undefined,
      anchorMomentId: extractMomentId(finalAnchor ?? records[anchorIndex]) ?? anchorMomentId,
      anchorTs: (finalAnchor?.sortTs ?? anchorTs) as UnixMs | undefined,
      hasMoreBefore: start > 0,
      hasMoreAfter: endExclusive < records.length,
    };
  }

  // ---------------------------------------------------------------------------
  // Internals — timeline builders
  // ---------------------------------------------------------------------------

  private buildTimelineSegments(
    channel: ChatVisibleChannel,
    records: readonly ChatTranscriptRecord[],
  ): ChatReplayTimelineSegment[] {
    if (records.length === 0) return [];

    const segments: ChatReplayTimelineSegment[] = [];
    let bucket: ChatTranscriptRecord[] = [];
    let bucketClass: ChatReplayTimelineClass | null = null;

    const flush = (): void => {
      if (bucket.length === 0 || !bucketClass) return;
      const first = bucket[0];
      const last = bucket[bucket.length - 1];
      const proofHashes = uniqueStrings(bucket.map((record) => record.proofHash ?? ''))
        .map(toProofHash);
      const legendIds = uniqueStrings(bucket.map((record) => extractLegendId(record) ?? ''))
        .map(toLegendId);
      segments.push({
        id: buildSegmentId(channel, first.messageId, segments.length),
        channel,
        timelineClass: bucketClass,
        startTs: first.sortTs as UnixMs,
        endTs: last.sortTs as UnixMs,
        anchorMessageId: first.messageId as ChatMessageId,
        messageIds: bucket.map((record) => record.messageId as ChatMessageId),
        dominantKind: dominantKindOf(bucket),
        summaryLine: summaryLineForSegment(bucketClass, bucket),
        sceneId: extractSceneId(first) ?? extractSceneId(last),
        momentId: extractMomentId(first) ?? extractMomentId(last),
        proofHashes,
        legendIds,
        witnessCount: bucket.filter((record) => record.kind === 'CROWD_REACTION' || record.kind === 'NPC_AMBIENT').length,
        pressureBand: uniqueStrings(bucket.map((record) => record.pressureTier ?? ''))[0] || undefined,
        tickBand: uniqueStrings(bucket.map((record) => record.tickTier ?? ''))[0] || undefined,
      });
      bucket = [];
      bucketClass = null;
    };

    for (const record of records) {
      const nextClass = inferTimelineClass(record);
      const previous = bucket[bucket.length - 1];
      const previousTs = previous?.sortTs ?? record.sortTs;
      const gap = Math.abs(record.sortTs - previousTs);
      const sceneShift = previous && extractSceneId(previous) !== extractSceneId(record);
      const momentShift = previous && extractMomentId(previous) !== extractMomentId(record);
      const classShift = bucketClass !== null && bucketClass !== nextClass;

      if (
        bucket.length > 0 && (
          classShift
          || gap > this.config.segmentGapMs
          || sceneShift
          || momentShift
        )
      ) {
        flush();
      }

      bucket.push(record);
      bucketClass = nextClass;
    }

    flush();
    return segments;
  }

  private buildProofReferences(
    channel: ChatVisibleChannel,
    records: readonly ChatTranscriptRecord[],
    segments: readonly ChatReplayTimelineSegment[],
  ): ChatReplayProofReference[] {
    const grouped = new Map<string, ChatTranscriptRecord[]>();
    for (const record of records) {
      if (!record.proofHash) continue;
      const key = record.proofHash;
      const bucket = grouped.get(key) ?? [];
      bucket.push(record);
      grouped.set(key, bucket);
    }

    const references: ChatReplayProofReference[] = [];
    for (const [proofHash, groupedRecords] of grouped.entries()) {
      groupedRecords.sort(compareRecordAsc);
      const immutableCount = groupedRecords.filter((record) => record.immutable).length;
      const legendCount = groupedRecords.filter((record) => Boolean(extractLegendId(record))).length;
      const segmentIds = segments
        .filter((segment) => segment.proofHashes.includes(proofHash as ChatProofHash))
        .map((segment) => segment.id);

      references.push({
        proofHash: proofHash as ChatProofHash,
        channel,
        messageIds: groupedRecords.map((record) => record.messageId as ChatMessageId),
        firstTs: groupedRecords[0].sortTs as UnixMs,
        lastTs: groupedRecords[groupedRecords.length - 1].sortTs as UnixMs,
        immutableCount,
        segmentIds,
        proofClass: legendCount > 0
          ? 'LEGEND_CHAIN'
          : immutableCount === groupedRecords.length
            ? 'DEAL_CHAIN'
            : groupedRecords.some((record) => record.kind === 'SYSTEM' || record.kind === 'MARKET_ALERT')
              ? 'SYSTEM_RECEIPT'
              : 'MIXED_CHAIN',
      });
    }

    return references.sort(compareProofAsc);
  }

  private buildLegendMoments(
    channel: ChatVisibleChannel,
    records: readonly ChatTranscriptRecord[],
  ): ChatReplayLegendMoment[] {
    const legends: ChatReplayLegendMoment[] = [];
    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      const legendId = extractLegendId(record);
      if (!legendId) continue;

      const witnessStart = Math.max(index - this.config.legendWitnessWindow, 0);
      const witnessEnd = Math.min(index + this.config.legendWitnessWindow + 1, records.length);
      const witnessMessageIds = records
        .slice(witnessStart, witnessEnd)
        .filter((candidate) => candidate.messageId !== record.messageId)
        .filter((candidate) => candidate.kind === 'CROWD_REACTION'
          || candidate.kind === 'NPC_AMBIENT'
          || candidate.kind === 'HELPER_RESCUE'
          || candidate.kind === 'POST_RUN_RITUAL')
        .map((candidate) => candidate.messageId as ChatMessageId);

      legends.push({
        legendId,
        messageId: record.messageId as ChatMessageId,
        channel,
        ts: record.sortTs as UnixMs,
        title: typeof record.metadata?.legendTitle === 'string'
          ? record.metadata.legendTitle
          : normalizeText(record.redactedBody ?? record.body) || 'Legend Moment',
        legendClass: typeof record.metadata?.legendClass === 'string'
          ? record.metadata.legendClass
          : 'WITNESS_LINE',
        prestigeScore: typeof record.metadata?.prestigeScore === 'number'
          ? record.metadata.prestigeScore
          : record.kind === 'LEGEND_MOMENT'
            ? 80
            : 60,
        proofHash: record.proofHash as ChatProofHash | undefined,
        witnessMessageIds,
        replayId: extractReplayId(record),
      });
    }

    return legends.sort(compareLegendDesc);
  }

  private buildMomentAnchors(
    channel: ChatVisibleChannel,
    records: readonly ChatTranscriptRecord[],
  ): ChatReplayMomentAnchor[] {
    const grouped = new Map<string, ChatTranscriptRecord[]>();
    for (const record of records) {
      const momentId = extractMomentId(record);
      if (!momentId) continue;
      const key = momentId;
      const bucket = grouped.get(key) ?? [];
      bucket.push(record);
      grouped.set(key, bucket);
    }

    const anchors: ChatReplayMomentAnchor[] = [];
    for (const [momentId, groupedRecords] of grouped.entries()) {
      groupedRecords.sort(compareRecordAsc);
      anchors.push({
        momentId: momentId as ChatMomentId,
        channel,
        firstMessageId: groupedRecords[0].messageId as ChatMessageId,
        lastMessageId: groupedRecords[groupedRecords.length - 1].messageId as ChatMessageId,
        firstTs: groupedRecords[0].sortTs as UnixMs,
        lastTs: groupedRecords[groupedRecords.length - 1].sortTs as UnixMs,
        messageIds: groupedRecords.map((record) => record.messageId as ChatMessageId),
        sceneIds: uniqueStrings(groupedRecords.map((record) => extractSceneId(record) ?? '')),
      });
    }

    return anchors.sort((left, right) => left.firstTs - right.firstTs);
  }

  private buildThreadViews(
    channel: ChatVisibleChannel,
    records: readonly ChatTranscriptRecord[],
  ): ChatReplayThreadView[] {
    const grouped = new Map<string, ChatTranscriptRecord[]>();

    for (const record of records) {
      const sceneId = extractSceneId(record);
      const momentId = extractMomentId(record);
      const counterpartId = normalizeText(record.senderId);
      const key = sceneId
        ? `scene:${sceneId}`
        : momentId
          ? `moment:${momentId}`
          : `sender:${counterpartId || 'unknown'}`;
      const bucket = grouped.get(key) ?? [];
      bucket.push(record);
      grouped.set(key, bucket);
    }

    const threads: ChatReplayThreadView[] = [];
    for (const [key, groupedRecords] of grouped.entries()) {
      groupedRecords.sort(compareRecordAsc);
      threads.push({
        id: `thread:${channel}:${key}`,
        channel,
        label: key.startsWith('scene:')
          ? key.replace('scene:', 'Scene ')
          : key.startsWith('moment:')
            ? key.replace('moment:', 'Moment ')
            : `${groupedRecords[0].senderName} thread`,
        messageIds: groupedRecords.map((record) => record.messageId as ChatMessageId),
        firstTs: groupedRecords[0].sortTs as UnixMs,
        lastTs: groupedRecords[groupedRecords.length - 1].sortTs as UnixMs,
        counterpartIds: uniqueStrings(groupedRecords.map((record) => record.senderId)),
      });
    }

    return threads.sort((left, right) => left.firstTs - right.firstTs);
  }

  private buildContinuityDigest(
    channel: ChatVisibleChannel,
    records: readonly ChatTranscriptRecord[],
    input: {
      readonly mode: ChatReplayContinuityMode;
      readonly legends: readonly ChatReplayLegendMoment[];
      readonly proofs: readonly ChatReplayProofReference[];
      readonly moments: readonly ChatReplayMomentAnchor[];
    },
  ): ChatReplayContinuityDigest {
    const state = this.requireChannel(channel);
    const session = state.openSessionId ? state.sessionsById.get(state.openSessionId) : undefined;

    if (
      this.config.cacheContinuityDigest
      && session?.continuityCache
      && session.session.recordSignature === state.recordSignature
    ) {
      return session.continuityCache;
    }

    const continuityRecords = records.slice(-this.config.continuityLookback);
    const unresolvedMomentIds = input.moments
      .filter((moment) => moment.messageIds.length > 1)
      .slice(-12)
      .map((moment) => moment.momentId);
    const topProofHashes = input.proofs
      .slice(-8)
      .map((proof) => proof.proofHash);
    const legendIds = input.legends
      .slice(0, 8)
      .map((legend) => legend.legendId);
    const recurringCounterpartIds = uniqueStrings(continuityRecords.map((record) => record.senderId))
      .slice(0, 12);
    const callbackCandidateMessageIds = continuityRecords
      .filter((record) => record.kind === 'PLAYER'
        || record.kind === 'RELATIONSHIP_CALLBACK'
        || record.kind === 'QUOTE_CALLBACK'
        || record.kind === 'HELPER_PROMPT'
        || record.kind === 'BOT_TAUNT')
      .slice(-12)
      .map((record) => record.messageId as ChatMessageId);

    const summaryLine = this.buildContinuitySummaryLine({
      mode: input.mode,
      legends: input.legends,
      proofs: input.proofs,
      unresolvedMomentIds,
      recurringCounterpartIds,
    });

    const digest: ChatReplayContinuityDigest = {
      channel,
      builtAt: now(),
      unresolvedMomentIds,
      topProofHashes,
      legendIds,
      recurringCounterpartIds,
      callbackCandidateMessageIds,
      summaryLine,
    };

    if (session) {
      session.continuityCache = digest;
    }

    return digest;
  }

  private buildContinuitySummaryLine(input: {
    readonly mode: ChatReplayContinuityMode;
    readonly legends: readonly ChatReplayLegendMoment[];
    readonly proofs: readonly ChatReplayProofReference[];
    readonly unresolvedMomentIds: readonly ChatMomentId[];
    readonly recurringCounterpartIds: readonly string[];
  }): string {
    switch (input.mode) {
      case 'LEGEND_ONLY':
        return input.legends.length > 0
          ? `Continuity is legend-led with ${input.legends.length} prestige anchor(s).`
          : 'Continuity is waiting for its first prestige anchor.';
      case 'POST_RUN_ONLY':
        return input.proofs.length > 0
          ? `Post-run continuity locks around ${input.proofs.length} proof-bearing chain(s).`
          : 'Post-run continuity is witness-first because proof chains are still sparse.';
      case 'ACCOUNT_SCOPED':
        return input.recurringCounterpartIds.length > 0
          ? `Account continuity is counterpart-heavy with ${input.recurringCounterpartIds.length} recurring voice(s).`
          : 'Account continuity has not stabilized into recurring voices yet.';
      case 'RUN_SCOPED':
      default:
        return input.unresolvedMomentIds.length > 0
          ? `Run continuity still carries ${input.unresolvedMomentIds.length} unresolved moment anchor(s).`
          : 'Run continuity is currently resolved and ready for the next witness beat.';
    }
  }

  private buildSummary(
    channel: ChatVisibleChannel,
    records: readonly ChatTranscriptRecord[],
    legends: readonly ChatReplayLegendMoment[],
  ): ChatReplaySummary {
    const proofCount = records.filter((record) => Boolean(record.proofHash)).length;
    const immutableCount = records.filter((record) => record.immutable).length;
    const playerLines = records.filter((record) => record.kind === 'PLAYER').length;
    const helperLines = records.filter((record) => record.kind === 'HELPER_PROMPT' || record.kind === 'HELPER_RESCUE').length;
    const haterLines = records.filter((record) => record.kind === 'BOT_TAUNT'
      || record.kind === 'BOT_ATTACK'
      || record.kind === 'HATER_TELEGRAPH'
      || record.kind === 'HATER_PUNISH').length;
    const ambientLines = records.filter((record) => record.kind === 'NPC_AMBIENT' || record.kind === 'CROWD_REACTION').length;
    const worldEventLines = records.filter((record) => record.kind === 'WORLD_EVENT').length;
    const replayEligibleCount = records.filter(isReplayEligibleRecord).length;
    const turningPointMessageIds = legends.slice(0, 8).map((legend) => legend.messageId);
    const dominantPressureTier = uniqueStrings(records.map((record) => record.pressureTier ?? ''))[0] || undefined;
    const dominantTickTier = uniqueStrings(records.map((record) => record.tickTier ?? ''))[0] || undefined;

    return {
      channel,
      totalRecords: records.length,
      replayEligibleCount,
      proofCount,
      legendCount: legends.length,
      immutableCount,
      playerLines,
      helperLines,
      haterLines,
      ambientLines,
      worldEventLines,
      startTs: records[0]?.sortTs as UnixMs | undefined,
      endTs: records[records.length - 1]?.sortTs as UnixMs | undefined,
      turningPointMessageIds,
      dominantPressureTier,
      dominantTickTier,
      lastWordMessageId: records[records.length - 1]?.messageId as ChatMessageId | undefined,
    };
  }

  private buildPostRunNarrativeLine(
    slice: ChatReplaySlice,
    turningPoints: readonly ChatReplayLegendMoment[],
    finalWord?: ChatMessage,
  ): string {
    const topLegend = turningPoints[0];
    const proofCount = slice.proofReferences.length;
    const finalBody = normalizeText(finalWord?.body).slice(0, 80);

    if (topLegend) {
      return `The run bent hardest at “${topLegend.title},” then closed with ${proofCount} proof-bearing chain(s)${finalBody ? ` — ${finalBody}` : ''}.`;
    }

    if (proofCount > 0) {
      return `The run closed on proof rather than noise, carrying ${proofCount} chain(s) into ritual memory${finalBody ? ` — ${finalBody}` : ''}.`;
    }

    return `The run ended without a prestige spike, so the room remembers the closing witness line${finalBody ? ` — ${finalBody}` : ''}.`;
  }

  // ---------------------------------------------------------------------------
  // Internals — error handling and snapshot emission
  // ---------------------------------------------------------------------------

  private emitSnapshot(): void {
    try {
      this.callbacks.onSnapshotChanged?.(this.getSnapshot());
    } catch (error) {
      this.handleError(error, { stage: 'emitSnapshot' });
    }
  }

  private requireChannel(channel: ChatVisibleChannel): InternalReplayChannelState {
    const state = this.channels.get(channel);
    if (!state) throw createError(`Unknown channel: ${channel}`);
    return state;
  }

  private assertNotDestroyed(method: string): void {
    if (this.destroyed) {
      throw createError(`Cannot call ${method}() after destroy().`);
    }
  }

  private handleError(error: unknown, context?: Record<string, unknown>): never {
    const normalized = error instanceof Error ? error : createError(String(error));
    this.callbacks.onError?.(normalized, context);
    throw normalized;
  }
}

function channelOfSession(session: ChatReplaySession): ChatVisibleChannel {
  return session.channel;
}
