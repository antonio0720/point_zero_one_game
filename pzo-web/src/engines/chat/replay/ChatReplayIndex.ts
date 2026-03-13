// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/replay/ChatReplayIndex.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT REPLAY INDEX
 * FILE: pzo-web/src/engines/chat/replay/ChatReplayIndex.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Fast replay lookup, range resolution, proof/legend threading, witness access,
 * and recap retrieval for the unified frontend chat engine.
 *
 * This file sits between:
 * - `ChatReplayBuffer.ts`, which owns replay session / slice orchestration,
 * - `ChatReplaySerializer.ts`, which owns deterministic export and envelope
 *   generation,
 * - `ChatTranscriptBuffer.ts`, which owns bounded transcript truth.
 *
 * This file deliberately does NOT replace any of those lanes.
 *
 * It exists because the UI, drawer, recap, hover, moment review, proof audit,
 * legend browser, and future backend-sync surfaces should not repeatedly walk
 * every record, every message, every segment, every proof chain, and every
 * thread view on demand. Replays in Point Zero One are not small, generic chat
 * logs. They are dramaturgical artifacts with proof-bearing receipts, witnessed
 * turns, legend spikes, rescue beats, and mode-sensitive continuity.
 *
 * This file becomes the deterministic lookup brain for the replay lane.
 *
 * What this file owns
 * -------------------
 * - per-channel replay indexes
 * - replay-global cross-channel lookup tables
 * - proof hash, legend id, moment id, segment id, thread id, and message id
 *   resolution
 * - timestamp and range querying
 * - recap and witness retrieval
 * - continuity digest indexing
 * - stable summary and cache signatures for replay working sets
 * - fast search over replay-shaped text without rescanning raw slices
 * - serializer-envelope indexing without forcing UI callers to understand the
 *   serializer payload layout
 *
 * What this file does NOT own
 * ---------------------------
 * - transcript truth
 * - session creation policy
 * - export text formatting
 * - server authority
 * - moderation truth
 * - learning profile truth
 *
 * Permanent doctrine
 * ------------------
 * - This index is a view over replay truth, not a competing truth store.
 * - Immutable proof-bearing lines remain immutable here.
 * - Index entries may enrich navigation metadata, but they do not invent chat.
 * - Any cache signature produced here must be stable for equal replay inputs.
 * - Channel-local identity is preserved even when a global index is built.
 * - Global lookup never erases visible-channel ownership.
 * - Post-run ritual artifacts are indexed as first-class replay retrieval lanes.
 *
 * Companion note
 * --------------
 * This file is intended to be exported from `./index.ts` once mounted into the
 * public replay barrel.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import {
  CHAT_ENGINE_AUTHORITIES,
  CHAT_ENGINE_PUBLIC_API_VERSION,
  CHAT_ENGINE_VERSION,
  isVisibleChatChannel,
  type ChatLegendId,
  type ChatMessage,
  type ChatMessageId,
  type ChatMomentId,
  type ChatProofHash,
  type ChatReplayId,
  type ChatVisibleChannel,
  type UnixMs,
} from '../types';

import type {
  ChatTranscriptExportBundle,
  ChatTranscriptRecord,
} from '../ChatTranscriptBuffer';

import {
  ChatReplayBuffer,
  type ChatReplayBufferCallbacks,
  type ChatReplayContinuityDigest,
  type ChatReplayExportBundle,
  type ChatReplayLegendMoment,
  type ChatReplayMomentAnchor,
  type ChatReplayPostRunRecap,
  type ChatReplayProofReference,
  type ChatReplaySession,
  type ChatReplaySlice,
  type ChatReplaySliceRequest,
  type ChatReplaySummary,
  type ChatReplayThreadView,
  type ChatReplayTimelineSegment,
} from './ChatReplayBuffer';

import {
  ChatReplaySerializer,
  CHAT_REPLAY_SERIALIZER_MODULE_NAME,
  type ChatReplayNormalizedContinuityDigest,
  type ChatReplayNormalizedLegendMoment,
  type ChatReplayNormalizedMessage,
  type ChatReplayNormalizedMomentAnchor,
  type ChatReplayNormalizedProofReference,
  type ChatReplayNormalizedRecord,
  type ChatReplayNormalizedSegment,
  type ChatReplayNormalizedSummary,
  type ChatReplayNormalizedThreadView,
  type ChatReplaySerializedEnvelope,
  type ChatReplaySerializedPayload,
  type ChatReplaySerializedRecap,
  type ChatReplaySerializedSlice,
  type ChatReplaySerializationOptions,
} from './ChatReplaySerializer';

// ============================================================================
// MARK: Public constants
// ============================================================================

export const CHAT_REPLAY_INDEX_VERSION = '2026.03.13' as const;
export const CHAT_REPLAY_INDEX_MODULE_NAME = 'PZO_CHAT_REPLAY_INDEX' as const;

export const CHAT_REPLAY_INDEX_AUTHORITIES = Object.freeze({
  replayIndex: '/pzo-web/src/engines/chat/replay/ChatReplayIndex.ts',
  replayBuffer: '/pzo-web/src/engines/chat/replay/ChatReplayBuffer.ts',
  replaySerializer: '/pzo-web/src/engines/chat/replay/ChatReplaySerializer.ts',
  transcriptTruth: '/pzo-web/src/engines/chat/ChatTranscriptBuffer.ts',
  contractSurface: '/pzo-web/src/engines/chat/types.ts',
} as const);

// ============================================================================
// MARK: Public source types
// ============================================================================

export type ChatReplayIndexSourceClass =
  | 'SLICE'
  | 'EXPORT_BUNDLE'
  | 'POST_RUN_RECAP'
  | 'SERIALIZED_SLICE'
  | 'SERIALIZED_PAYLOAD'
  | 'SERIALIZED_ENVELOPE'
  | 'BUFFER_SESSION'
  | 'BUFFER_REQUEST'
  | 'HYBRID';

export type ChatReplaySearchDomain =
  | 'MESSAGES'
  | 'SEGMENTS'
  | 'PROOFS'
  | 'LEGENDS'
  | 'MOMENTS'
  | 'THREADS'
  | 'CONTINUITY'
  | 'ALL';

export type ChatReplayRangeClampStrategy =
  | 'STRICT'
  | 'CLAMP_TO_AVAILABLE'
  | 'RETURN_EMPTY';

export type ChatReplayIndexDigestAlgorithm =
  | 'FNV1A_32'
  | 'FNV1A_64_COMPAT';

export type ChatReplayEntityKind =
  | 'MESSAGE'
  | 'RECORD'
  | 'SEGMENT'
  | 'PROOF'
  | 'LEGEND'
  | 'MOMENT'
  | 'THREAD'
  | 'RECAP'
  | 'CONTINUITY';

// ============================================================================
// MARK: Public configuration
// ============================================================================

export interface ChatReplayIndexConfig {
  readonly maxSearchResults?: number;
  readonly maxRecentLookups?: number;
  readonly maxCachedChannels?: number;
  readonly includeMessageBodySearch?: boolean;
  readonly includeMetadataSearch?: boolean;
  readonly includeThreadCounterpartSearch?: boolean;
  readonly includeContinuityCandidates?: boolean;
  readonly digestAlgorithm?: ChatReplayIndexDigestAlgorithm;
  readonly defaultRangeClampStrategy?: ChatReplayRangeClampStrategy;
  readonly buildCrossChannelIndexes?: boolean;
  readonly retainRecordViews?: boolean;
  readonly retainSerializerEcho?: boolean;
  readonly log?: (message: string, context?: Record<string, unknown>) => void;
  readonly warn?: (message: string, context?: Record<string, unknown>) => void;
  readonly error?: (message: string, context?: Record<string, unknown>) => void;
}

export interface ChatReplayIndexBuildOptions {
  readonly sourceLabel?: string;
  readonly sourceClass?: ChatReplayIndexSourceClass;
  readonly replaceExistingChannel?: boolean;
  readonly retainPreviousChannels?: boolean;
  readonly primaryChannel?: ChatVisibleChannel;
  readonly serializerOptions?: ChatReplaySerializationOptions;
}

export interface ChatReplayIndexBufferOptions {
  readonly replayBuffer: ChatReplayBuffer;
  readonly serializer?: ChatReplaySerializer;
  readonly request?: ChatReplaySliceRequest;
  readonly buildOptions?: ChatReplayIndexBuildOptions;
}

// ============================================================================
// MARK: Public lookup entries
// ============================================================================

export interface ChatReplayMessageIndexEntry {
  readonly kind: 'MESSAGE';
  readonly id: ChatMessageId;
  readonly channel: ChatVisibleChannel;
  readonly ordinal: number;
  readonly ts: UnixMs;
  readonly stableDigest: string;
  readonly sourceClass: ChatReplayIndexSourceClass;
  readonly message: ChatReplayNormalizedMessage;
  readonly related: Readonly<{
    proofHash?: ChatProofHash;
    legendId?: ChatLegendId;
    momentId?: ChatMomentId;
    replayId?: ChatReplayId;
    sceneId?: string;
    segmentIds: readonly string[];
    threadIds: readonly string[];
    witnessLegendIds: readonly ChatLegendId[];
  }>;
}

export interface ChatReplayRecordIndexEntry {
  readonly kind: 'RECORD';
  readonly id: ChatMessageId;
  readonly channel: ChatVisibleChannel;
  readonly ordinal: number;
  readonly stableDigest: string;
  readonly sourceClass: ChatReplayIndexSourceClass;
  readonly record: ChatReplayNormalizedRecord;
}

export interface ChatReplaySegmentIndexEntry {
  readonly kind: 'SEGMENT';
  readonly id: string;
  readonly channel: ChatVisibleChannel;
  readonly ordinal: number;
  readonly startTs: UnixMs;
  readonly endTs: UnixMs;
  readonly stableDigest: string;
  readonly sourceClass: ChatReplayIndexSourceClass;
  readonly segment: ChatReplayNormalizedSegment;
}

export interface ChatReplayProofIndexEntry {
  readonly kind: 'PROOF';
  readonly proofHash: ChatProofHash;
  readonly channel: ChatVisibleChannel;
  readonly ordinal: number;
  readonly startTs: UnixMs;
  readonly endTs: UnixMs;
  readonly stableDigest: string;
  readonly sourceClass: ChatReplayIndexSourceClass;
  readonly proof: ChatReplayNormalizedProofReference;
}

export interface ChatReplayLegendIndexEntry {
  readonly kind: 'LEGEND';
  readonly legendId: ChatLegendId;
  readonly channel: ChatVisibleChannel;
  readonly ordinal: number;
  readonly ts: UnixMs;
  readonly stableDigest: string;
  readonly sourceClass: ChatReplayIndexSourceClass;
  readonly legend: ChatReplayNormalizedLegendMoment;
}

export interface ChatReplayMomentIndexEntry {
  readonly kind: 'MOMENT';
  readonly momentId: ChatMomentId;
  readonly channel: ChatVisibleChannel;
  readonly ordinal: number;
  readonly firstTs: UnixMs;
  readonly lastTs: UnixMs;
  readonly stableDigest: string;
  readonly sourceClass: ChatReplayIndexSourceClass;
  readonly moment: ChatReplayNormalizedMomentAnchor;
}

export interface ChatReplayThreadIndexEntry {
  readonly kind: 'THREAD';
  readonly id: string;
  readonly channel: ChatVisibleChannel;
  readonly ordinal: number;
  readonly firstTs: UnixMs;
  readonly lastTs: UnixMs;
  readonly stableDigest: string;
  readonly sourceClass: ChatReplayIndexSourceClass;
  readonly thread: ChatReplayNormalizedThreadView;
}

export interface ChatReplayRecapIndexEntry {
  readonly kind: 'RECAP';
  readonly channel: ChatVisibleChannel;
  readonly builtAt: UnixMs;
  readonly stableDigest: string;
  readonly sourceClass: ChatReplayIndexSourceClass;
  readonly recap: ChatReplaySerializedRecap;
}

export interface ChatReplayContinuityIndexEntry {
  readonly kind: 'CONTINUITY';
  readonly channel: ChatVisibleChannel;
  readonly builtAt: UnixMs;
  readonly stableDigest: string;
  readonly sourceClass: ChatReplayIndexSourceClass;
  readonly continuity: ChatReplayNormalizedContinuityDigest;
}

export type ChatReplayIndexedEntity =
  | ChatReplayMessageIndexEntry
  | ChatReplayRecordIndexEntry
  | ChatReplaySegmentIndexEntry
  | ChatReplayProofIndexEntry
  | ChatReplayLegendIndexEntry
  | ChatReplayMomentIndexEntry
  | ChatReplayThreadIndexEntry
  | ChatReplayRecapIndexEntry
  | ChatReplayContinuityIndexEntry;

// ============================================================================
// MARK: Public query results
// ============================================================================

export interface ChatReplaySearchHit {
  readonly domain: ChatReplaySearchDomain;
  readonly channel: ChatVisibleChannel;
  readonly id: string;
  readonly score: number;
  readonly label: string;
  readonly excerpt: string;
  readonly digest: string;
}

export interface ChatReplayWitnessBundle {
  readonly channel: ChatVisibleChannel;
  readonly legendId: ChatLegendId;
  readonly witnessLines: readonly ChatReplayMessageIndexEntry[];
  readonly subject?: ChatReplayLegendIndexEntry;
}

export interface ChatReplayProofBundle {
  readonly channel: ChatVisibleChannel;
  readonly proof: ChatReplayProofIndexEntry;
  readonly messages: readonly ChatReplayMessageIndexEntry[];
  readonly segments: readonly ChatReplaySegmentIndexEntry[];
}

export interface ChatReplayMomentBundle {
  readonly channel: ChatVisibleChannel;
  readonly moment: ChatReplayMomentIndexEntry;
  readonly messages: readonly ChatReplayMessageIndexEntry[];
  readonly segments: readonly ChatReplaySegmentIndexEntry[];
  readonly legends: readonly ChatReplayLegendIndexEntry[];
  readonly proofs: readonly ChatReplayProofIndexEntry[];
}

export interface ChatReplayThreadBundle {
  readonly channel: ChatVisibleChannel;
  readonly thread: ChatReplayThreadIndexEntry;
  readonly messages: readonly ChatReplayMessageIndexEntry[];
}

export interface ChatReplayRangeResult {
  readonly channel: ChatVisibleChannel;
  readonly startTs?: UnixMs;
  readonly endTs?: UnixMs;
  readonly messages: readonly ChatReplayMessageIndexEntry[];
  readonly segments: readonly ChatReplaySegmentIndexEntry[];
  readonly proofs: readonly ChatReplayProofIndexEntry[];
  readonly legends: readonly ChatReplayLegendIndexEntry[];
}

// ============================================================================
// MARK: Public stats and snapshots
// ============================================================================

export interface ChatReplayChannelIndexStats {
  readonly channel: ChatVisibleChannel;
  readonly builtAt: UnixMs;
  readonly sourceClass: ChatReplayIndexSourceClass;
  readonly sourceLabel: string;
  readonly sessionId?: string;
  readonly replayId?: ChatReplayId;
  readonly recordCount: number;
  readonly messageCount: number;
  readonly segmentCount: number;
  readonly proofCount: number;
  readonly legendCount: number;
  readonly momentCount: number;
  readonly threadCount: number;
  readonly witnessLegendCount: number;
  readonly witnessLineCount: number;
  readonly immutableCount: number;
  readonly startTs?: UnixMs;
  readonly endTs?: UnixMs;
  readonly durationMs?: number;
  readonly digest: string;
  readonly searchTermCount: number;
}

export interface ChatReplayGlobalIndexStats {
  readonly builtAt: UnixMs;
  readonly engineVersion: string;
  readonly apiVersion: string;
  readonly channelCount: number;
  readonly totalMessages: number;
  readonly totalSegments: number;
  readonly totalProofs: number;
  readonly totalLegends: number;
  readonly totalMoments: number;
  readonly totalThreads: number;
  readonly totalWitnessLines: number;
  readonly digest: string;
}

export interface ChatReplayChannelIndexSnapshot {
  readonly stats: ChatReplayChannelIndexStats;
  readonly summary: ChatReplayNormalizedSummary;
  readonly continuity: ChatReplayNormalizedContinuityDigest;
  readonly recap?: ChatReplaySerializedRecap;
  readonly messageIds: readonly ChatMessageId[];
  readonly proofHashes: readonly ChatProofHash[];
  readonly legendIds: readonly ChatLegendId[];
  readonly momentIds: readonly ChatMomentId[];
  readonly threadIds: readonly string[];
  readonly segmentIds: readonly string[];
}

export interface ChatReplayGlobalIndexSnapshot {
  readonly builtAt: UnixMs;
  readonly authorities: typeof CHAT_ENGINE_AUTHORITIES;
  readonly replayAuthorities: typeof CHAT_REPLAY_INDEX_AUTHORITIES;
  readonly stats: ChatReplayGlobalIndexStats;
  readonly channels: readonly ChatReplayChannelIndexSnapshot[];
}

// ============================================================================
// MARK: Internal channel state
// ============================================================================

interface InternalChannelIndexState {
  channel: ChatVisibleChannel;
  builtAt: UnixMs;
  sourceClass: ChatReplayIndexSourceClass;
  sourceLabel: string;
  sourceDigest: string;
  slice: ChatReplaySerializedSlice;
  recap?: ChatReplaySerializedRecap;
  transcriptBundle?: ChatTranscriptExportBundle;
  payloadEcho?: ChatReplaySerializedPayload;
  messageEntries: ChatReplayMessageIndexEntry[];
  recordEntries: ChatReplayRecordIndexEntry[];
  segmentEntries: ChatReplaySegmentIndexEntry[];
  proofEntries: ChatReplayProofIndexEntry[];
  legendEntries: ChatReplayLegendIndexEntry[];
  momentEntries: ChatReplayMomentIndexEntry[];
  threadEntries: ChatReplayThreadIndexEntry[];
  recapEntry?: ChatReplayRecapIndexEntry;
  continuityEntry: ChatReplayContinuityIndexEntry;
  messageById: Map<ChatMessageId, ChatReplayMessageIndexEntry>;
  recordById: Map<ChatMessageId, ChatReplayRecordIndexEntry>;
  segmentById: Map<string, ChatReplaySegmentIndexEntry>;
  proofByHash: Map<ChatProofHash, ChatReplayProofIndexEntry>;
  legendById: Map<ChatLegendId, ChatReplayLegendIndexEntry>;
  momentById: Map<ChatMomentId, ChatReplayMomentIndexEntry>;
  threadById: Map<string, ChatReplayThreadIndexEntry>;
  messageIdsByProof: Map<ChatProofHash, ChatMessageId[]>;
  messageIdsByLegend: Map<ChatLegendId, ChatMessageId[]>;
  messageIdsByMoment: Map<ChatMomentId, ChatMessageId[]>;
  segmentIdsByMoment: Map<ChatMomentId, string[]>;
  segmentIdsByProof: Map<ChatProofHash, string[]>;
  segmentIdsByLegend: Map<ChatLegendId, string[]>;
  threadIdsByCounterpart: Map<string, string[]>;
  legendIdsByWitnessMessageId: Map<ChatMessageId, ChatLegendId[]>;
  searchCorpus: Map<string, ChatReplaySearchHit[]>;
  recentLookupIds: string[];
  stats: ChatReplayChannelIndexStats;
}

// ============================================================================
// MARK: Default configuration
// ============================================================================

const DEFAULT_CONFIG: Required<
  Pick<
    ChatReplayIndexConfig,
    | 'maxSearchResults'
    | 'maxRecentLookups'
    | 'maxCachedChannels'
    | 'includeMessageBodySearch'
    | 'includeMetadataSearch'
    | 'includeThreadCounterpartSearch'
    | 'includeContinuityCandidates'
    | 'digestAlgorithm'
    | 'defaultRangeClampStrategy'
    | 'buildCrossChannelIndexes'
    | 'retainRecordViews'
    | 'retainSerializerEcho'
  >
> = {
  maxSearchResults: 50,
  maxRecentLookups: 512,
  maxCachedChannels: 8,
  includeMessageBodySearch: true,
  includeMetadataSearch: true,
  includeThreadCounterpartSearch: true,
  includeContinuityCandidates: true,
  digestAlgorithm: 'FNV1A_32',
  defaultRangeClampStrategy: 'CLAMP_TO_AVAILABLE',
  buildCrossChannelIndexes: true,
  retainRecordViews: true,
  retainSerializerEcho: true,
};

const ALL_VISIBLE_CHANNELS: readonly ChatVisibleChannel[] = [
  'GLOBAL',
  'SYNDICATE',
  'DEAL_ROOM',
  'LOBBY',
] as const;

// ============================================================================
// MARK: Utility functions
// ============================================================================

function now(): UnixMs {
  return Date.now() as UnixMs;
}

function createError(message: string): Error {
  return new Error(`[ChatReplayIndex] ${message}`);
}

function normalizeText(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim()
    : '';
}

function normalizeKey(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function safeArray<T>(value: readonly T[] | undefined | null): readonly T[] {
  return Array.isArray(value) ? [...value] : [];
}

function safeNumber(value: unknown, fallback = 0): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function uniq<T>(values: Iterable<T>): T[] {
  return [...new Set(values)];
}

function uniqStrings(values: Iterable<string>): string[] {
  const normalized = new Set<string>();
  for (const value of values) {
    const next = normalizeText(value);
    if (next) normalized.add(next);
  }
  return [...normalized];
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries
    .map(([key, inner]) => `${JSON.stringify(key)}:${stableStringify(inner)}`)
    .join(',')}}`;
}

function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function fnv1a64Compat(input: string): string {
  let high = 0xcbf29ce4;
  let low = 0x84222325;
  for (let index = 0; index < input.length; index += 1) {
    low ^= input.charCodeAt(index);
    const nextLow = Math.imul(low, 0x1b3);
    const carry = ((low >>> 16) * 0x1b3) >>> 0;
    const nextHigh = (Math.imul(high, 0x1b3) + carry) >>> 0;
    low = nextLow >>> 0;
    high = nextHigh >>> 0;
  }
  return `fnv64c:${high.toString(16).padStart(8, '0')}${low.toString(16).padStart(8, '0')}`;
}

function digestOf(value: unknown, algorithm: ChatReplayIndexDigestAlgorithm): string {
  const stable = typeof value === 'string' ? value : stableStringify(value);
  return algorithm === 'FNV1A_64_COMPAT'
    ? fnv1a64Compat(stable)
    : fnv1a32(stable);
}

function compareMessageAsc(
  left: ChatReplayMessageIndexEntry,
  right: ChatReplayMessageIndexEntry,
): number {
  if (left.ts !== right.ts) return left.ts - right.ts;
  return left.id.localeCompare(right.id);
}

function compareSegmentAsc(
  left: ChatReplaySegmentIndexEntry,
  right: ChatReplaySegmentIndexEntry,
): number {
  if (left.startTs !== right.startTs) return left.startTs - right.startTs;
  return left.id.localeCompare(right.id);
}

function compareLegendDesc(
  left: ChatReplayLegendIndexEntry,
  right: ChatReplayLegendIndexEntry,
): number {
  if (left.legend.prestigeScore !== right.legend.prestigeScore) {
    return right.legend.prestigeScore - left.legend.prestigeScore;
  }
  if (left.ts !== right.ts) return right.ts - left.ts;
  return left.legendId.localeCompare(right.legendId);
}

function compareSearchHitDesc(left: ChatReplaySearchHit, right: ChatReplaySearchHit): number {
  if (left.score !== right.score) return right.score - left.score;
  if (left.channel !== right.channel) return left.channel.localeCompare(right.channel);
  return left.id.localeCompare(right.id);
}

function pickChannel(value: unknown): ChatVisibleChannel {
  if (isVisibleChatChannel(value)) return value;
  return 'GLOBAL';
}

function ensureVisibleChannel(value: unknown, label: string): ChatVisibleChannel {
  if (!isVisibleChatChannel(value)) {
    throw createError(`${label} resolved to a non-visible channel.`);
  }
  return value;
}

function buildExcerpt(text: string, query: string, maxLength = 180): string {
  const normalized = normalizeText(text);
  if (!normalized) return '';
  const lowered = normalized.toLowerCase();
  const target = normalizeKey(query);
  if (!target) return normalized.slice(0, maxLength);
  const index = lowered.indexOf(target);
  if (index < 0) return normalized.slice(0, maxLength);
  const start = Math.max(0, index - 48);
  const end = Math.min(normalized.length, index + target.length + 96);
  const excerpt = normalized.slice(start, end);
  return `${start > 0 ? '…' : ''}${excerpt}${end < normalized.length ? '…' : ''}`;
}

function ratio(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Number((numerator / denominator).toFixed(6));
}

function sortUniqueMessageIds(
  messageIds: Iterable<ChatMessageId>,
  lookup: Map<ChatMessageId, ChatReplayMessageIndexEntry>,
): ChatMessageId[] {
  return [...new Set(messageIds)].sort((left, right) => {
    const leftEntry = lookup.get(left);
    const rightEntry = lookup.get(right);
    if (leftEntry && rightEntry) return compareMessageAsc(leftEntry, rightEntry);
    return left.localeCompare(right);
  });
}

function buildMessageSearchText(input: {
  message: ChatReplayNormalizedMessage;
  includeBody: boolean;
  includeMetadata: boolean;
}): string {
  const metadata = input.includeMetadata ? stableStringify(input.message.metadata) : '';
  const parts = [
    input.message.id,
    input.message.channel,
    input.message.kind,
    input.message.senderId ?? '',
    input.message.senderName ?? '',
    input.message.senderRank ?? '',
    input.includeBody ? input.message.body ?? '' : '',
    input.message.emoji ?? '',
    input.message.proofHash ?? '',
    input.message.replayId ?? '',
    input.message.sceneId ?? '',
    input.message.momentId ?? '',
    input.message.legendId ?? '',
    input.message.pressureTier ?? '',
    input.message.tickTier ?? '',
    input.message.runOutcome ?? '',
    ...safeArray(input.message.tags),
    metadata,
  ];
  return uniqStrings(parts).join(' ');
}

function buildRecordSearchText(record: ChatReplayNormalizedRecord, includeMetadata: boolean): string {
  const parts = [
    record.id,
    record.channel,
    record.state ?? '',
    record.ackedServerId ?? '',
    record.requestId ?? '',
    record.roomId ?? '',
    record.sessionId ?? '',
    record.body ?? '',
    record.redactedBody ?? '',
    record.proofHash ?? '',
    record.replayId ?? '',
    record.sceneId ?? '',
    record.momentId ?? '',
    record.legendId ?? '',
    ...safeArray(record.tags),
    includeMetadata ? stableStringify(record.metadata) : '',
  ];
  return uniqStrings(parts).join(' ');
}

function buildSegmentSearchText(segment: ChatReplayNormalizedSegment): string {
  const parts = [
    segment.id,
    segment.channel,
    segment.timelineClass,
    segment.dominantKind,
    segment.summaryLine,
    segment.sceneId ?? '',
    segment.momentId ?? '',
    segment.anchorMessageId ?? '',
    segment.pressureBand ?? '',
    segment.tickBand ?? '',
    ...safeArray(segment.proofHashes),
    ...safeArray(segment.legendIds),
    ...safeArray(segment.messageIds),
  ];
  return uniqStrings(parts).join(' ');
}

function buildProofSearchText(proof: ChatReplayNormalizedProofReference): string {
  const parts = [
    proof.proofHash,
    proof.channel,
    proof.proofClass,
    ...safeArray(proof.messageIds),
    ...safeArray(proof.segmentIds),
  ];
  return uniqStrings(parts).join(' ');
}

function buildLegendSearchText(legend: ChatReplayNormalizedLegendMoment): string {
  const parts = [
    legend.legendId,
    legend.channel,
    legend.title,
    legend.legendClass,
    legend.messageId,
    legend.proofHash ?? '',
    legend.replayId ?? '',
    ...safeArray(legend.witnessMessageIds),
  ];
  return uniqStrings(parts).join(' ');
}

function buildMomentSearchText(moment: ChatReplayNormalizedMomentAnchor): string {
  const parts = [
    moment.momentId,
    moment.channel,
    moment.firstMessageId,
    moment.lastMessageId,
    ...safeArray(moment.sceneIds),
    ...safeArray(moment.messageIds),
  ];
  return uniqStrings(parts).join(' ');
}

function buildThreadSearchText(
  thread: ChatReplayNormalizedThreadView,
  includeCounterparts: boolean,
): string {
  const parts = [
    thread.id,
    thread.channel,
    thread.label,
    ...safeArray(thread.messageIds),
    ...(includeCounterparts ? safeArray(thread.counterpartIds) : []),
  ];
  return uniqStrings(parts).join(' ');
}

function normalizeSummary(
  summary: ChatReplaySummary | ChatReplayNormalizedSummary,
): ChatReplayNormalizedSummary {
  const startTs = summary.startTs;
  const endTs = summary.endTs;
  const durationMs =
    typeof startTs === 'number' && typeof endTs === 'number' && endTs >= startTs
      ? endTs - startTs
      : undefined;
  const totalLines = Math.max(summary.totalRecords, 1);
  return {
    channel: summary.channel,
    totalRecords: summary.totalRecords,
    replayEligibleCount: summary.replayEligibleCount,
    proofCount: summary.proofCount,
    legendCount: summary.legendCount,
    immutableCount: summary.immutableCount,
    playerLines: summary.playerLines,
    helperLines: summary.helperLines,
    haterLines: summary.haterLines,
    ambientLines: summary.ambientLines,
    worldEventLines: summary.worldEventLines,
    startTs,
    endTs,
    durationMs,
    turningPointMessageIds: safeArray(summary.turningPointMessageIds),
    dominantPressureTier: summary.dominantPressureTier,
    dominantTickTier: summary.dominantTickTier,
    lastWordMessageId: summary.lastWordMessageId,
    ratios: 'ratios' in summary
      ? (summary.ratios as ChatReplayNormalizedSummary['ratios'])
      : {
          player: ratio(summary.playerLines, totalLines),
          helper: ratio(summary.helperLines, totalLines),
          hater: ratio(summary.haterLines, totalLines),
          ambient: ratio(summary.ambientLines, totalLines),
          worldEvent: ratio(summary.worldEventLines, totalLines),
          immutable: ratio(summary.immutableCount, totalLines),
        },
  };
}

function normalizeContinuity(
  digest: ChatReplayContinuityDigest | ChatReplayNormalizedContinuityDigest,
  algorithm: ChatReplayIndexDigestAlgorithm,
): ChatReplayNormalizedContinuityDigest {
  const base = {
    channel: digest.channel,
    builtAt: digest.builtAt,
    unresolvedMomentIds: safeArray(digest.unresolvedMomentIds),
    topProofHashes: safeArray(digest.topProofHashes),
    legendIds: safeArray(digest.legendIds),
    recurringCounterpartIds: safeArray(digest.recurringCounterpartIds),
    callbackCandidateMessageIds: safeArray(digest.callbackCandidateMessageIds),
    summaryLine: normalizeText(digest.summaryLine),
  };
  return {
    ...base,
    digest: 'digest' in digest && typeof digest.digest === 'string'
      ? digest.digest
      : digestOf(base, algorithm),
  };
}

function normalizeMessage(message: ChatMessage, algorithm: ChatReplayIndexDigestAlgorithm): ChatReplayNormalizedMessage {
  const metadata = (message.meta && typeof message.meta === 'object'
    ? (message.meta as Record<string, unknown>)
    : {}) as Readonly<Record<string, unknown>>;
  const tags = Array.isArray(metadata.tags)
    ? metadata.tags.filter((value): value is string => typeof value === 'string')
    : [];
  const body = typeof message.body === 'string' ? message.body : undefined;
  const searchText = buildMessageSearchText({
    message: {
      id: message.id,
      channel: message.channel,
      kind: message.kind,
      senderId: message.senderId,
      senderName: message.senderName,
      senderRank: message.senderRank,
      ts: message.ts,
      immutable: message.immutable,
      body,
      emoji: message.emoji,
      proofHash: message.proofHash,
      replayId: message.replay?.replayId,
      sceneId: message.sceneId,
      momentId: message.momentId,
      legendId: message.legend?.legendId,
      tags,
      pressureTier: typeof message.pressureTier === 'string' ? message.pressureTier : undefined,
      tickTier: typeof message.tickTier === 'string' ? message.tickTier : undefined,
      runOutcome: typeof message.runOutcome === 'string' ? message.runOutcome : undefined,
      replayEligible: message.replay?.replayEligible !== false,
      legendEligible: Boolean(message.replay?.legendEligible),
      worldEventEligible: Boolean(message.replay?.worldEventEligible),
      metadata,
      stableBodyDigest: '',
      searchText: '',
    },
    includeBody: true,
    includeMetadata: true,
  });

  return {
    id: message.id,
    channel: message.channel,
    kind: message.kind,
    senderId: message.senderId,
    senderName: message.senderName,
    senderRank: message.senderRank,
    ts: message.ts,
    immutable: message.immutable,
    body,
    emoji: message.emoji,
    proofHash: message.proofHash,
    replayId: message.replay?.replayId,
    sceneId: message.sceneId,
    momentId: message.momentId,
    legendId: message.legend?.legendId,
    tags,
    pressureTier: typeof message.pressureTier === 'string' ? message.pressureTier : undefined,
    tickTier: typeof message.tickTier === 'string' ? message.tickTier : undefined,
    runOutcome: typeof message.runOutcome === 'string' ? message.runOutcome : undefined,
    replayEligible: message.replay?.replayEligible !== false,
    legendEligible: Boolean(message.replay?.legendEligible),
    worldEventEligible: Boolean(message.replay?.worldEventEligible),
    metadata,
    stableBodyDigest: digestOf(body ?? '', algorithm),
    searchText,
  };
}

function normalizeRecord(
  record: ChatTranscriptRecord,
  algorithm: ChatReplayIndexDigestAlgorithm,
): ChatReplayNormalizedRecord {
  const metadata = (record.metadata && typeof record.metadata === 'object'
    ? (record.metadata as Record<string, unknown>)
    : {}) as Readonly<Record<string, unknown>>;
  const tags = Array.isArray(metadata.tags)
    ? metadata.tags.filter((value): value is string => typeof value === 'string')
    : [];

  const normalized: ChatReplayNormalizedRecord = {
    id: record.messageId,
    channel: record.channel,
    state: record.state,
    ackedServerId: record.ackedServerId,
    insertedAt: record.insertedAt,
    authoritativeSequence: record.authoritativeSequence,
    requestId: record.requestId,
    roomId: record.roomId,
    sessionId: record.sessionId,
    body: record.body,
    redactedBody: record.redactedBody,
    immutable: record.immutable,
    proofHash: record.proofHash,
    replayId: typeof metadata.replayId === 'string' ? (metadata.replayId as ChatReplayId) : undefined,
    sceneId: typeof metadata.sceneId === 'string' ? metadata.sceneId : undefined,
    momentId: typeof metadata.momentId === 'string' ? (metadata.momentId as ChatMomentId) : undefined,
    legendId: typeof metadata.legendId === 'string' ? (metadata.legendId as ChatLegendId) : undefined,
    tags,
    metadata,
  };

  void algorithm;
  return normalized;
}

function normalizeSegment(segment: ChatReplayTimelineSegment): ChatReplayNormalizedSegment {
  return {
    id: segment.id,
    channel: segment.channel,
    timelineClass: segment.timelineClass,
    dominantKind: segment.dominantKind,
    startTs: segment.startTs,
    endTs: segment.endTs,
    durationMs: Math.max(0, segment.endTs - segment.startTs),
    messageIds: safeArray(segment.messageIds),
    messageCount: segment.messageIds.length,
    witnessCount: segment.witnessCount,
    summaryLine: normalizeText(segment.summaryLine),
    sceneId: segment.sceneId,
    momentId: segment.momentId,
    anchorMessageId: segment.anchorMessageId,
    proofHashes: safeArray(segment.proofHashes),
    legendIds: safeArray(segment.legendIds),
    pressureBand: segment.pressureBand,
    tickBand: segment.tickBand,
  };
}

function normalizeProof(proof: ChatReplayProofReference): ChatReplayNormalizedProofReference {
  return {
    proofHash: proof.proofHash,
    channel: proof.channel,
    proofClass: proof.proofClass,
    firstTs: proof.firstTs,
    lastTs: proof.lastTs,
    durationMs: Math.max(0, proof.lastTs - proof.firstTs),
    immutableCount: proof.immutableCount,
    messageIds: safeArray(proof.messageIds),
    segmentIds: safeArray(proof.segmentIds),
    lineCount: proof.messageIds.length,
  };
}

function normalizeLegend(legend: ChatReplayLegendMoment): ChatReplayNormalizedLegendMoment {
  return {
    legendId: legend.legendId,
    messageId: legend.messageId,
    channel: legend.channel,
    ts: legend.ts,
    title: normalizeText(legend.title),
    legendClass: legend.legendClass,
    prestigeScore: legend.prestigeScore,
    proofHash: legend.proofHash,
    witnessMessageIds: safeArray(legend.witnessMessageIds),
    replayId: legend.replayId,
  };
}

function normalizeMoment(moment: ChatReplayMomentAnchor): ChatReplayNormalizedMomentAnchor {
  return {
    momentId: moment.momentId,
    channel: moment.channel,
    firstMessageId: moment.firstMessageId,
    lastMessageId: moment.lastMessageId,
    firstTs: moment.firstTs,
    lastTs: moment.lastTs,
    durationMs: Math.max(0, moment.lastTs - moment.firstTs),
    messageIds: safeArray(moment.messageIds),
    sceneIds: safeArray(moment.sceneIds),
  };
}

function normalizeThread(thread: ChatReplayThreadView): ChatReplayNormalizedThreadView {
  return {
    id: thread.id,
    channel: thread.channel,
    label: normalizeText(thread.label),
    firstTs: thread.firstTs,
    lastTs: thread.lastTs,
    durationMs: Math.max(0, thread.lastTs - thread.firstTs),
    messageIds: safeArray(thread.messageIds),
    counterpartIds: safeArray(thread.counterpartIds),
  };
}

function buildSerializedSliceFromReplaySlice(input: {
  slice: ChatReplaySlice;
  transcriptBundle?: ChatTranscriptExportBundle;
  algorithm: ChatReplayIndexDigestAlgorithm;
}): ChatReplaySerializedSlice {
  const messages = input.slice.messages.map((message: ChatMessage) => normalizeMessage(message, input.algorithm));
  const records = input.slice.records.map((record: ChatTranscriptRecord) => normalizeRecord(record, input.algorithm));
  const segments = input.slice.segments.map(normalizeSegment);
  const proofReferences = input.slice.proofReferences.map(normalizeProof);
  const legendMoments = input.slice.legendMoments.map(normalizeLegend);
  const momentAnchors = input.slice.momentAnchors.map(normalizeMoment);
  const threadViews = input.slice.threadViews.map(normalizeThread);
  const continuity = normalizeContinuity(input.slice.continuity, input.algorithm);
  const summary = normalizeSummary(input.slice.summary);

  const indexes = {
    messageIds: Object.freeze(Object.fromEntries(messages.map((message: ChatReplayNormalizedMessage, index: number) => [message.id, index]))),
    segmentIds: Object.freeze(Object.fromEntries(segments.map((segment: ChatReplayNormalizedSegment, index: number) => [segment.id, index]))),
    proofHashes: Object.freeze(Object.fromEntries(proofReferences.map((proof: ChatReplayNormalizedProofReference, index: number) => [proof.proofHash, index]))),
    legendIds: Object.freeze(Object.fromEntries(legendMoments.map((legend: ChatReplayNormalizedLegendMoment, index: number) => [legend.legendId, index]))),
    momentIds: Object.freeze(Object.fromEntries(momentAnchors.map((moment: ChatReplayNormalizedMomentAnchor, index: number) => [moment.momentId, index]))),
    threadIds: Object.freeze(Object.fromEntries(threadViews.map((thread: ChatReplayNormalizedThreadView, index: number) => [thread.id, index]))),
    tags: Object.freeze(
      Object.fromEntries(
        messages.map((message: ChatReplayNormalizedMessage) => [
          message.id,
          Object.freeze([...message.tags]),
        ]),
      ),
    ),
  } as const;

  const derivedMetrics = {
    witnessDensity: ratio(
      legendMoments.reduce((sum: number, legend: ChatReplayNormalizedLegendMoment) => sum + legend.witnessMessageIds.length, 0),
      messages.length,
    ),
    proofDensity: ratio(proofReferences.length, messages.length),
    legendDensity: ratio(legendMoments.length, messages.length),
    immutableDensity: ratio(messages.filter((message: ChatReplayNormalizedMessage) => message.immutable).length, messages.length),
    averageSegmentDurationMs: segments.length
      ? Math.round(segments.reduce((sum: number, segment: ChatReplayNormalizedSegment) => sum + segment.durationMs, 0) / segments.length)
      : 0,
    averageThreadDurationMs: threadViews.length
      ? Math.round(threadViews.reduce((sum: number, thread: ChatReplayNormalizedThreadView) => sum + thread.durationMs, 0) / threadViews.length)
      : 0,
    averageLinesPerSegment: segments.length
      ? Number((messages.length / segments.length).toFixed(6))
      : 0,
    averageLinesPerThread: threadViews.length
      ? Number((messages.length / threadViews.length).toFixed(6))
      : 0,
    prestigeTotal: legendMoments.reduce((sum: number, legend: ChatReplayNormalizedLegendMoment) => sum + legend.prestigeScore, 0),
    prestigeAverage: legendMoments.length
      ? Number((legendMoments.reduce((sum: number, legend: ChatReplayNormalizedLegendMoment) => sum + legend.prestigeScore, 0) / legendMoments.length).toFixed(6))
      : 0,
    recapLineCount: 0,
    counterpartSpread: uniq(threadViews.flatMap((thread: ChatReplayNormalizedThreadView) => thread.counterpartIds)).length,
  };

  void input.transcriptBundle;

  return {
    channel: input.slice.channel,
    builtAt: input.slice.builtAt,
    reason: input.slice.reason,
    anchorStrategy: input.slice.anchorStrategy,
    session: input.slice.session,
    summary,
    continuity,
    messages,
    records,
    segments,
    proofReferences,
    legendMoments,
    momentAnchors,
    threadViews,
    indexes,
    derivedMetrics,
  };
}

function buildSerializedRecapFromPostRunRecap(recap: ChatReplayPostRunRecap): ChatReplaySerializedRecap {
  return {
    channel: recap.channel,
    builtAt: recap.builtAt,
    narrativeLine: normalizeText(recap.narrativeLine),
    turningPoints: recap.turningPoints.map(normalizeLegend),
    witnessMessageIds: recap.witnessLines.map((line: ChatMessage) => line.id),
    proofHighlights: recap.proofHighlights.map(normalizeProof),
    finalWordMessageId: recap.finalWord?.id,
  };
}

function buildSourceLabel(input: {
  sourceClass: ChatReplayIndexSourceClass;
  channel: ChatVisibleChannel;
  sessionId?: string;
  replayId?: ChatReplayId;
}): string {
  const parts = [
    input.sourceClass,
    input.channel,
    input.sessionId ?? '',
    input.replayId ?? '',
  ].filter(Boolean);
  return parts.join(':');
}

// ============================================================================
// MARK: ChatReplayIndex
// ============================================================================

export class ChatReplayIndex {
  private readonly config: Required<
    Pick<
      ChatReplayIndexConfig,
      | 'maxSearchResults'
      | 'maxRecentLookups'
      | 'maxCachedChannels'
      | 'includeMessageBodySearch'
      | 'includeMetadataSearch'
      | 'includeThreadCounterpartSearch'
      | 'includeContinuityCandidates'
      | 'digestAlgorithm'
      | 'defaultRangeClampStrategy'
      | 'buildCrossChannelIndexes'
      | 'retainRecordViews'
      | 'retainSerializerEcho'
    >
  >;

  private readonly log?: ChatReplayIndexConfig['log'];
  private readonly warn?: ChatReplayIndexConfig['warn'];
  private readonly error?: ChatReplayIndexConfig['error'];

  private builtAt: UnixMs = now();
  private readonly channels = new Map<ChatVisibleChannel, InternalChannelIndexState>();

  private readonly globalMessageById = new Map<ChatMessageId, ChatReplayMessageIndexEntry>();
  private readonly globalSegmentById = new Map<string, ChatReplaySegmentIndexEntry>();
  private readonly globalProofByHash = new Map<ChatProofHash, ChatReplayProofIndexEntry>();
  private readonly globalLegendById = new Map<ChatLegendId, ChatReplayLegendIndexEntry>();
  private readonly globalMomentById = new Map<ChatMomentId, ChatReplayMomentIndexEntry>();
  private readonly globalThreadById = new Map<string, ChatReplayThreadIndexEntry>();
  private readonly recentLookupIds: string[] = [];

  constructor(config: ChatReplayIndexConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
    this.log = config.log;
    this.warn = config.warn;
    this.error = config.error;
  }

  // ========================================================================
  // MARK: Public build methods
  // ========================================================================

  buildFromSlice(
    slice: ChatReplaySlice,
    transcriptBundle?: ChatTranscriptExportBundle,
    options: ChatReplayIndexBuildOptions = {},
  ): ChatReplayChannelIndexSnapshot {
    const serializedSlice = buildSerializedSliceFromReplaySlice({
      slice,
      transcriptBundle,
      algorithm: this.config.digestAlgorithm,
    });

    return this.ingestSerializedChannel({
      serializedSlice,
      recap: undefined,
      transcriptBundle,
      payloadEcho: undefined,
      options: {
        sourceClass: options.sourceClass ?? 'SLICE',
        sourceLabel:
          options.sourceLabel ??
          buildSourceLabel({
            sourceClass: options.sourceClass ?? 'SLICE',
            channel: slice.channel,
            sessionId: slice.session.id,
            replayId: slice.session.replayId,
          }),
        replaceExistingChannel: options.replaceExistingChannel,
        retainPreviousChannels: options.retainPreviousChannels,
        primaryChannel: options.primaryChannel,
      },
    });
  }

  buildFromExportBundle(
    bundle: ChatReplayExportBundle,
    options: ChatReplayIndexBuildOptions = {},
  ): ChatReplayChannelIndexSnapshot {
    return this.buildFromSlice(bundle.slice, bundle.transcriptBundle, {
      ...options,
      sourceClass: options.sourceClass ?? 'EXPORT_BUNDLE',
      sourceLabel:
        options.sourceLabel ??
        buildSourceLabel({
          sourceClass: options.sourceClass ?? 'EXPORT_BUNDLE',
          channel: bundle.slice.channel,
          sessionId: bundle.slice.session.id,
          replayId: bundle.slice.session.replayId,
        }),
    });
  }

  buildFromPostRunRecap(
    recap: ChatReplayPostRunRecap,
    options: ChatReplayIndexBuildOptions = {},
  ): ChatReplayChannelIndexSnapshot {
    const serializedSlice = buildSerializedSliceFromReplaySlice({
      slice: recap.slice,
      transcriptBundle: undefined,
      algorithm: this.config.digestAlgorithm,
    });
    const serializedRecap = buildSerializedRecapFromPostRunRecap(recap);

    return this.ingestSerializedChannel({
      serializedSlice,
      recap: serializedRecap,
      transcriptBundle: undefined,
      payloadEcho: undefined,
      options: {
        sourceClass: options.sourceClass ?? 'POST_RUN_RECAP',
        sourceLabel:
          options.sourceLabel ??
          buildSourceLabel({
            sourceClass: options.sourceClass ?? 'POST_RUN_RECAP',
            channel: recap.channel,
            sessionId: recap.slice.session.id,
            replayId: recap.slice.session.replayId,
          }),
        replaceExistingChannel: options.replaceExistingChannel,
        retainPreviousChannels: options.retainPreviousChannels,
        primaryChannel: options.primaryChannel,
      },
    });
  }

  buildFromSerializedSlice(
    serializedSlice: ChatReplaySerializedSlice,
    recap?: ChatReplaySerializedRecap,
    options: ChatReplayIndexBuildOptions = {},
  ): ChatReplayChannelIndexSnapshot {
    return this.ingestSerializedChannel({
      serializedSlice,
      recap,
      transcriptBundle: undefined,
      payloadEcho: undefined,
      options: {
        sourceClass: options.sourceClass ?? 'SERIALIZED_SLICE',
        sourceLabel:
          options.sourceLabel ??
          buildSourceLabel({
            sourceClass: options.sourceClass ?? 'SERIALIZED_SLICE',
            channel: serializedSlice.channel,
            sessionId: serializedSlice.session.id,
            replayId: serializedSlice.session.replayId,
          }),
        replaceExistingChannel: options.replaceExistingChannel,
        retainPreviousChannels: options.retainPreviousChannels,
        primaryChannel: options.primaryChannel,
      },
    });
  }

  buildFromSerializedPayload(
    payload: ChatReplaySerializedPayload,
    options: ChatReplayIndexBuildOptions = {},
  ): ChatReplayChannelIndexSnapshot {
    return this.ingestSerializedChannel({
      serializedSlice: payload.slice,
      recap: payload.recap,
      transcriptBundle: payload.transcriptBundle as ChatTranscriptExportBundle | undefined,
      payloadEcho: this.config.retainSerializerEcho ? payload : undefined,
      options: {
        sourceClass: options.sourceClass ?? 'SERIALIZED_PAYLOAD',
        sourceLabel:
          options.sourceLabel ??
          buildSourceLabel({
            sourceClass: options.sourceClass ?? 'SERIALIZED_PAYLOAD',
            channel: payload.slice.channel,
            sessionId: payload.slice.session.id,
            replayId: payload.slice.session.replayId,
          }),
        replaceExistingChannel: options.replaceExistingChannel,
        retainPreviousChannels: options.retainPreviousChannels,
        primaryChannel: options.primaryChannel,
      },
    });
  }

  buildFromSerializedEnvelope(
    envelope: ChatReplaySerializedEnvelope,
    options: ChatReplayIndexBuildOptions = {},
  ): ChatReplayChannelIndexSnapshot {
    return this.ingestSerializedChannel({
      serializedSlice: envelope.payload.slice,
      recap: envelope.payload.recap,
      transcriptBundle: envelope.payload.transcriptBundle as ChatTranscriptExportBundle | undefined,
      payloadEcho: this.config.retainSerializerEcho ? envelope.payload : undefined,
      options: {
        sourceClass: options.sourceClass ?? 'SERIALIZED_ENVELOPE',
        sourceLabel:
          options.sourceLabel ??
          buildSourceLabel({
            sourceClass: options.sourceClass ?? 'SERIALIZED_ENVELOPE',
            channel: envelope.payload.slice.channel,
            sessionId: envelope.payload.slice.session.id,
            replayId: envelope.payload.slice.session.replayId,
          }),
        replaceExistingChannel: options.replaceExistingChannel,
        retainPreviousChannels: options.retainPreviousChannels,
        primaryChannel: options.primaryChannel,
      },
    });
  }

  buildFromBuffer(input: ChatReplayIndexBufferOptions): ChatReplayChannelIndexSnapshot {
    const request = input.request ?? {};
    const buildOptions = input.buildOptions ?? {};
    const slice = input.replayBuffer.buildSlice(request);

    if (input.serializer) {
      const envelope = input.serializer.serializeSlice(slice, buildOptions.serializerOptions);
      return this.buildFromSerializedEnvelope(envelope, {
        ...buildOptions,
        sourceClass: buildOptions.sourceClass ?? 'BUFFER_REQUEST',
      });
    }

    return this.buildFromSlice(slice, undefined, {
      ...buildOptions,
      sourceClass: buildOptions.sourceClass ?? 'BUFFER_REQUEST',
    });
  }

  rebuildFromBufferSession(input: {
    replayBuffer: ChatReplayBuffer;
    channel: ChatVisibleChannel;
    sessionId: string;
    serializer?: ChatReplaySerializer;
    options?: ChatReplayIndexBuildOptions;
  }): ChatReplayChannelIndexSnapshot {
    return this.buildFromBuffer({
      replayBuffer: input.replayBuffer,
      serializer: input.serializer,
      request: {
        channel: input.channel,
        sessionId: input.sessionId,
        reason: 'SESSION_REBUILD',
      },
      buildOptions: {
        ...input.options,
        sourceClass: input.options?.sourceClass ?? 'BUFFER_SESSION',
      },
    });
  }

  // ========================================================================
  // MARK: Public accessors
  // ========================================================================

  getBuiltAt(): UnixMs {
    return this.builtAt;
  }

  getKnownChannels(): readonly ChatVisibleChannel[] {
    return [...this.channels.keys()];
  }

  hasChannel(channel: ChatVisibleChannel): boolean {
    return this.channels.has(channel);
  }

  getChannelSnapshot(channel: ChatVisibleChannel): ChatReplayChannelIndexSnapshot | undefined {
    const state = this.channels.get(channel);
    if (!state) return undefined;
    return this.toChannelSnapshot(state);
  }

  getSnapshot(): ChatReplayGlobalIndexSnapshot {
    return {
      builtAt: this.builtAt,
      authorities: CHAT_ENGINE_AUTHORITIES,
      replayAuthorities: CHAT_REPLAY_INDEX_AUTHORITIES,
      stats: this.computeGlobalStats(),
      channels: this.getKnownChannels()
        .map((channel) => this.channels.get(channel))
        .filter((state): state is InternalChannelIndexState => Boolean(state))
        .map((state) => this.toChannelSnapshot(state)),
    };
  }

  getMessage(channel: ChatVisibleChannel, messageId: ChatMessageId): ChatReplayMessageIndexEntry | undefined {
    this.touchLookup(`message:${channel}:${messageId}`);
    return this.channels.get(channel)?.messageById.get(messageId);
  }

  getMessageGlobal(messageId: ChatMessageId): ChatReplayMessageIndexEntry | undefined {
    this.touchLookup(`gmessage:${messageId}`);
    return this.globalMessageById.get(messageId);
  }

  getRecord(channel: ChatVisibleChannel, messageId: ChatMessageId): ChatReplayRecordIndexEntry | undefined {
    this.touchLookup(`record:${channel}:${messageId}`);
    return this.channels.get(channel)?.recordById.get(messageId);
  }

  getSegment(channel: ChatVisibleChannel, segmentId: string): ChatReplaySegmentIndexEntry | undefined {
    this.touchLookup(`segment:${channel}:${segmentId}`);
    return this.channels.get(channel)?.segmentById.get(segmentId);
  }

  getProof(channel: ChatVisibleChannel, proofHash: ChatProofHash): ChatReplayProofIndexEntry | undefined {
    this.touchLookup(`proof:${channel}:${proofHash}`);
    return this.channels.get(channel)?.proofByHash.get(proofHash);
  }

  getLegend(channel: ChatVisibleChannel, legendId: ChatLegendId): ChatReplayLegendIndexEntry | undefined {
    this.touchLookup(`legend:${channel}:${legendId}`);
    return this.channels.get(channel)?.legendById.get(legendId);
  }

  getMoment(channel: ChatVisibleChannel, momentId: ChatMomentId): ChatReplayMomentIndexEntry | undefined {
    this.touchLookup(`moment:${channel}:${momentId}`);
    return this.channels.get(channel)?.momentById.get(momentId);
  }

  getThread(channel: ChatVisibleChannel, threadId: string): ChatReplayThreadIndexEntry | undefined {
    this.touchLookup(`thread:${channel}:${threadId}`);
    return this.channels.get(channel)?.threadById.get(threadId);
  }

  getRecap(channel: ChatVisibleChannel): ChatReplayRecapIndexEntry | undefined {
    this.touchLookup(`recap:${channel}`);
    return this.channels.get(channel)?.recapEntry;
  }

  getContinuity(channel: ChatVisibleChannel): ChatReplayContinuityIndexEntry | undefined {
    this.touchLookup(`continuity:${channel}`);
    return this.channels.get(channel)?.continuityEntry;
  }

  getMessagesForChannel(channel: ChatVisibleChannel): readonly ChatReplayMessageIndexEntry[] {
    const state = this.channels.get(channel);
    return state ? [...state.messageEntries] : [];
  }

  getLegendsForChannel(channel: ChatVisibleChannel): readonly ChatReplayLegendIndexEntry[] {
    const state = this.channels.get(channel);
    return state ? [...state.legendEntries] : [];
  }

  getProofsForChannel(channel: ChatVisibleChannel): readonly ChatReplayProofIndexEntry[] {
    const state = this.channels.get(channel);
    return state ? [...state.proofEntries] : [];
  }

  getThreadsForChannel(channel: ChatVisibleChannel): readonly ChatReplayThreadIndexEntry[] {
    const state = this.channels.get(channel);
    return state ? [...state.threadEntries] : [];
  }

  getMomentsForChannel(channel: ChatVisibleChannel): readonly ChatReplayMomentIndexEntry[] {
    const state = this.channels.get(channel);
    return state ? [...state.momentEntries] : [];
  }

  getSegmentsForChannel(channel: ChatVisibleChannel): readonly ChatReplaySegmentIndexEntry[] {
    const state = this.channels.get(channel);
    return state ? [...state.segmentEntries] : [];
  }

  getRecentLookupIds(): readonly string[] {
    return [...this.recentLookupIds];
  }

  // ========================================================================
  // MARK: Public bundle lookups
  // ========================================================================

  getProofBundle(
    channel: ChatVisibleChannel,
    proofHash: ChatProofHash,
  ): ChatReplayProofBundle | undefined {
    const state = this.channels.get(channel);
    if (!state) return undefined;
    const proof = state.proofByHash.get(proofHash);
    if (!proof) return undefined;

    const messages = sortUniqueMessageIds(
      state.messageIdsByProof.get(proofHash) ?? [],
      state.messageById,
    )
      .map((messageId) => state.messageById.get(messageId))
      .filter((entry): entry is ChatReplayMessageIndexEntry => Boolean(entry));

    const segments = uniq(state.segmentIdsByProof.get(proofHash) ?? [])
      .map((segmentId) => state.segmentById.get(segmentId))
      .filter((entry): entry is ChatReplaySegmentIndexEntry => Boolean(entry))
      .sort(compareSegmentAsc);

    return {
      channel,
      proof,
      messages,
      segments,
    };
  }

  getWitnessBundle(
    channel: ChatVisibleChannel,
    legendId: ChatLegendId,
  ): ChatReplayWitnessBundle | undefined {
    const state = this.channels.get(channel);
    if (!state) return undefined;
    const subject = state.legendById.get(legendId);
    if (!subject) return undefined;

    const witnessLines = sortUniqueMessageIds(subject.legend.witnessMessageIds, state.messageById)
      .map((messageId) => state.messageById.get(messageId))
      .filter((entry): entry is ChatReplayMessageIndexEntry => Boolean(entry));

    return {
      channel,
      legendId,
      witnessLines,
      subject,
    };
  }

  getMomentBundle(
    channel: ChatVisibleChannel,
    momentId: ChatMomentId,
  ): ChatReplayMomentBundle | undefined {
    const state = this.channels.get(channel);
    if (!state) return undefined;
    const moment = state.momentById.get(momentId);
    if (!moment) return undefined;

    const messageIds = state.messageIdsByMoment.get(momentId) ?? moment.moment.messageIds;
    const messages = sortUniqueMessageIds(messageIds, state.messageById)
      .map((messageId) => state.messageById.get(messageId))
      .filter((entry): entry is ChatReplayMessageIndexEntry => Boolean(entry));

    const segments = uniq(state.segmentIdsByMoment.get(momentId) ?? [])
      .map((segmentId) => state.segmentById.get(segmentId))
      .filter((entry): entry is ChatReplaySegmentIndexEntry => Boolean(entry))
      .sort(compareSegmentAsc);

    const legends = state.legendEntries
      .filter((legend) => legend.legend.messageId === moment.moment.firstMessageId || legend.legend.witnessMessageIds.some((messageId: ChatMessageId) => messageIds.includes(messageId)))
      .sort(compareLegendDesc);

    const proofs = uniq(
      messages
        .map((message) => message.related.proofHash)
        .filter((proofHash): proofHash is ChatProofHash => Boolean(proofHash)),
    )
      .map((proofHash) => state.proofByHash.get(proofHash))
      .filter((entry): entry is ChatReplayProofIndexEntry => Boolean(entry));

    return {
      channel,
      moment,
      messages,
      segments,
      legends,
      proofs,
    };
  }

  getThreadBundle(
    channel: ChatVisibleChannel,
    threadId: string,
  ): ChatReplayThreadBundle | undefined {
    const state = this.channels.get(channel);
    if (!state) return undefined;
    const thread = state.threadById.get(threadId);
    if (!thread) return undefined;

    const messages = sortUniqueMessageIds(thread.thread.messageIds, state.messageById)
      .map((messageId) => state.messageById.get(messageId))
      .filter((entry): entry is ChatReplayMessageIndexEntry => Boolean(entry));

    return {
      channel,
      thread,
      messages,
    };
  }

  // ========================================================================
  // MARK: Public range and search
  // ========================================================================

  getRange(input: {
    channel: ChatVisibleChannel;
    startTs?: UnixMs;
    endTs?: UnixMs;
    clampStrategy?: ChatReplayRangeClampStrategy;
  }): ChatReplayRangeResult {
    const state = this.channels.get(input.channel);
    if (!state) {
      return {
        channel: input.channel,
        startTs: input.startTs,
        endTs: input.endTs,
        messages: [],
        segments: [],
        proofs: [],
        legends: [],
      };
    }

    const clampStrategy = input.clampStrategy ?? this.config.defaultRangeClampStrategy;
    const firstTs = state.stats.startTs;
    const lastTs = state.stats.endTs;

    let startTs = input.startTs;
    let endTs = input.endTs;

    if (typeof firstTs === 'number' && typeof startTs === 'number' && startTs < firstTs) {
      if (clampStrategy === 'STRICT') {
        return { channel: input.channel, startTs, endTs, messages: [], segments: [], proofs: [], legends: [] };
      }
      if (clampStrategy === 'CLAMP_TO_AVAILABLE') startTs = firstTs;
    }

    if (typeof lastTs === 'number' && typeof endTs === 'number' && endTs > lastTs) {
      if (clampStrategy === 'STRICT') {
        return { channel: input.channel, startTs, endTs, messages: [], segments: [], proofs: [], legends: [] };
      }
      if (clampStrategy === 'CLAMP_TO_AVAILABLE') endTs = lastTs;
    }

    const messages = state.messageEntries.filter((message) => {
      if (typeof startTs === 'number' && message.ts < startTs) return false;
      if (typeof endTs === 'number' && message.ts > endTs) return false;
      return true;
    });

    const segments = state.segmentEntries.filter((segment) => {
      if (typeof startTs === 'number' && segment.endTs < startTs) return false;
      if (typeof endTs === 'number' && segment.startTs > endTs) return false;
      return true;
    });

    const proofs = state.proofEntries.filter((proof) => {
      if (typeof startTs === 'number' && proof.endTs < startTs) return false;
      if (typeof endTs === 'number' && proof.startTs > endTs) return false;
      return true;
    });

    const legends = state.legendEntries.filter((legend) => {
      if (typeof startTs === 'number' && legend.ts < startTs) return false;
      if (typeof endTs === 'number' && legend.ts > endTs) return false;
      return true;
    });

    return {
      channel: input.channel,
      startTs,
      endTs,
      messages,
      segments,
      proofs,
      legends,
    };
  }

  search(input: {
    query: string;
    domain?: ChatReplaySearchDomain;
    channel?: ChatVisibleChannel;
    maxResults?: number;
  }): readonly ChatReplaySearchHit[] {
    const query = normalizeText(input.query);
    if (!query) return [];

    const domain = input.domain ?? 'ALL';
    const maxResults = clamp(input.maxResults ?? this.config.maxSearchResults, 1, 500);
    const hits: ChatReplaySearchHit[] = [];

    const channels = input.channel ? [input.channel] : this.getKnownChannels();

    for (const channel of channels) {
      const state = this.channels.get(channel);
      if (!state) continue;
      const terms = uniqStrings([query, normalizeKey(query)]);

      for (const term of terms) {
        const termKey = `${domain}:${normalizeKey(term)}`;
        const cached = state.searchCorpus.get(termKey);
        if (cached) {
          hits.push(...cached.map((hit) => ({ ...hit })));
          continue;
        }

        const computed = this.computeSearchHitsForTerm({
          state,
          term,
          domain,
        });
        state.searchCorpus.set(termKey, computed);
        hits.push(...computed.map((hit) => ({ ...hit })));
      }
    }

    return uniq(hits.map((hit) => `${hit.domain}:${hit.channel}:${hit.id}:${hit.digest}`))
      .map((key) => hits.find((hit) => `${hit.domain}:${hit.channel}:${hit.id}:${hit.digest}` === key))
      .filter((hit): hit is ChatReplaySearchHit => Boolean(hit))
      .sort(compareSearchHitDesc)
      .slice(0, maxResults);
  }

  // ========================================================================
  // MARK: Public maintenance
  // ========================================================================

  clear(): void {
    this.channels.clear();
    this.globalMessageById.clear();
    this.globalSegmentById.clear();
    this.globalProofByHash.clear();
    this.globalLegendById.clear();
    this.globalMomentById.clear();
    this.globalThreadById.clear();
    this.recentLookupIds.length = 0;
    this.builtAt = now();
    this.debug('Cleared replay index.');
  }

  removeChannel(channel: ChatVisibleChannel): boolean {
    const removed = this.channels.delete(channel);
    if (removed) {
      this.rebuildGlobalMaps();
      this.builtAt = now();
      this.debug('Removed replay channel index.', { channel });
    }
    return removed;
  }

  // ========================================================================
  // MARK: Internal ingest
  // ========================================================================

  private ingestSerializedChannel(input: {
    serializedSlice: ChatReplaySerializedSlice;
    recap?: ChatReplaySerializedRecap;
    transcriptBundle?: ChatTranscriptExportBundle;
    payloadEcho?: ChatReplaySerializedPayload;
    options: Required<
      Pick<ChatReplayIndexBuildOptions, 'sourceClass' | 'sourceLabel'>
    > & Pick<ChatReplayIndexBuildOptions, 'replaceExistingChannel' | 'retainPreviousChannels' | 'primaryChannel'>;
  }): ChatReplayChannelIndexSnapshot {
    const channel = ensureVisibleChannel(input.serializedSlice.channel, 'Serialized slice channel');

    if (input.options.retainPreviousChannels === false) {
      this.clear();
    }

    if (!input.options.replaceExistingChannel && this.channels.has(channel)) {
      this.warn?.('Replacing existing replay channel index because channel already exists.', {
        channel,
        sourceLabel: input.options.sourceLabel,
      });
    }

    const state = this.buildChannelState({
      channel,
      serializedSlice: input.serializedSlice,
      recap: input.recap,
      transcriptBundle: input.transcriptBundle,
      payloadEcho: input.payloadEcho,
      sourceClass: input.options.sourceClass,
      sourceLabel: input.options.sourceLabel,
    });

    this.channels.set(channel, state);
    this.enforceChannelLimit();
    this.rebuildGlobalMaps();
    this.builtAt = now();

    const snapshot = this.toChannelSnapshot(state);
    this.debug('Built replay index channel snapshot.', {
      channel,
      sourceClass: state.sourceClass,
      sourceLabel: state.sourceLabel,
      digest: state.stats.digest,
      messageCount: state.stats.messageCount,
      segmentCount: state.stats.segmentCount,
      proofCount: state.stats.proofCount,
      legendCount: state.stats.legendCount,
    });
    return snapshot;
  }

  private buildChannelState(input: {
    channel: ChatVisibleChannel;
    serializedSlice: ChatReplaySerializedSlice;
    recap?: ChatReplaySerializedRecap;
    transcriptBundle?: ChatTranscriptExportBundle;
    payloadEcho?: ChatReplaySerializedPayload;
    sourceClass: ChatReplayIndexSourceClass;
    sourceLabel: string;
  }): InternalChannelIndexState {
    const builtAt = now();
    const slice = input.serializedSlice;

    const messageEntries = this.buildMessageEntries(slice, input.sourceClass);
    const recordEntries = this.config.retainRecordViews
      ? this.buildRecordEntries(slice, input.sourceClass)
      : [];
    const segmentEntries = this.buildSegmentEntries(slice, input.sourceClass);
    const proofEntries = this.buildProofEntries(slice, input.sourceClass);
    const legendEntries = this.buildLegendEntries(slice, input.sourceClass);
    const momentEntries = this.buildMomentEntries(slice, input.sourceClass);
    const threadEntries = this.buildThreadEntries(slice, input.sourceClass);
    const continuityEntry = this.buildContinuityEntry(slice.continuity, input.channel, input.sourceClass);
    const recapEntry = input.recap
      ? this.buildRecapEntry(input.recap, input.channel, input.sourceClass)
      : undefined;

    const messageById = new Map(messageEntries.map((entry) => [entry.id, entry] as const));
    const recordById = new Map(recordEntries.map((entry) => [entry.id, entry] as const));
    const segmentById = new Map(segmentEntries.map((entry) => [entry.id, entry] as const));
    const proofByHash = new Map(proofEntries.map((entry) => [entry.proofHash, entry] as const));
    const legendById = new Map(legendEntries.map((entry) => [entry.legendId, entry] as const));
    const momentById = new Map(momentEntries.map((entry) => [entry.momentId, entry] as const));
    const threadById = new Map(threadEntries.map((entry) => [entry.id, entry] as const));

    const messageIdsByProof = new Map<ChatProofHash, ChatMessageId[]>();
    const messageIdsByLegend = new Map<ChatLegendId, ChatMessageId[]>();
    const messageIdsByMoment = new Map<ChatMomentId, ChatMessageId[]>();
    const segmentIdsByMoment = new Map<ChatMomentId, string[]>();
    const segmentIdsByProof = new Map<ChatProofHash, string[]>();
    const segmentIdsByLegend = new Map<ChatLegendId, string[]>();
    const threadIdsByCounterpart = new Map<string, string[]>();
    const legendIdsByWitnessMessageId = new Map<ChatMessageId, ChatLegendId[]>();

    for (const message of messageEntries) {
      const proofHash = message.related.proofHash;
      if (proofHash) pushMapArray(messageIdsByProof, proofHash, message.id);
      const legendId = message.related.legendId;
      if (legendId) pushMapArray(messageIdsByLegend, legendId, message.id);
      const momentId = message.related.momentId;
      if (momentId) pushMapArray(messageIdsByMoment, momentId, message.id);
      for (const witnessLegendId of message.related.witnessLegendIds) {
        pushMapArray(legendIdsByWitnessMessageId, message.id, witnessLegendId);
      }
    }

    for (const moment of momentEntries) {
      for (const messageId of moment.moment.messageIds) {
        pushMapArray(messageIdsByMoment, moment.momentId, messageId);
      }
    }

    for (const segment of segmentEntries) {
      if (segment.segment.momentId) {
        pushMapArray(segmentIdsByMoment, segment.segment.momentId, segment.id);
      }
      for (const proofHash of segment.segment.proofHashes) {
        pushMapArray(segmentIdsByProof, proofHash, segment.id);
      }
      for (const legendId of segment.segment.legendIds) {
        pushMapArray(segmentIdsByLegend, legendId, segment.id);
      }
    }

    for (const legend of legendEntries) {
      for (const witnessMessageId of legend.legend.witnessMessageIds) {
        pushMapArray(legendIdsByWitnessMessageId, witnessMessageId, legend.legendId);
      }
      pushMapArray(messageIdsByLegend, legend.legendId, legend.legend.messageId);
      if (legend.legend.proofHash) {
        pushMapArray(messageIdsByProof, legend.legend.proofHash, legend.legend.messageId);
      }
    }

    for (const thread of threadEntries) {
      for (const counterpartId of thread.thread.counterpartIds) {
        pushMapArray(threadIdsByCounterpart, counterpartId, thread.id);
      }
    }

    const stats: ChatReplayChannelIndexStats = {
      channel: input.channel,
      builtAt,
      sourceClass: input.sourceClass,
      sourceLabel: input.sourceLabel,
      sessionId: slice.session.id,
      replayId: slice.session.replayId,
      recordCount: recordEntries.length,
      messageCount: messageEntries.length,
      segmentCount: segmentEntries.length,
      proofCount: proofEntries.length,
      legendCount: legendEntries.length,
      momentCount: momentEntries.length,
      threadCount: threadEntries.length,
      witnessLegendCount: legendEntries.filter((legend) => legend.legend.witnessMessageIds.length > 0).length,
      witnessLineCount: uniq(legendEntries.flatMap((legend) => legend.legend.witnessMessageIds)).length,
      immutableCount: messageEntries.filter((message) => message.message.immutable).length,
      startTs: slice.summary.startTs,
      endTs: slice.summary.endTs,
      durationMs: slice.summary.durationMs,
      digest: digestOf(
        {
          channel: input.channel,
          sessionId: slice.session.id,
          replayId: slice.session.replayId,
          sourceClass: input.sourceClass,
          sourceLabel: input.sourceLabel,
          messageDigests: messageEntries.map((entry) => entry.stableDigest),
          segmentDigests: segmentEntries.map((entry) => entry.stableDigest),
          proofDigests: proofEntries.map((entry) => entry.stableDigest),
          legendDigests: legendEntries.map((entry) => entry.stableDigest),
          momentDigests: momentEntries.map((entry) => entry.stableDigest),
          threadDigests: threadEntries.map((entry) => entry.stableDigest),
          recapDigest: recapEntry?.stableDigest,
          continuityDigest: continuityEntry.stableDigest,
        },
        this.config.digestAlgorithm,
      ),
      searchTermCount: 0,
    };

    const state: InternalChannelIndexState = {
      channel: input.channel,
      builtAt,
      sourceClass: input.sourceClass,
      sourceLabel: input.sourceLabel,
      sourceDigest: digestOf(
        {
          sourceClass: input.sourceClass,
          sourceLabel: input.sourceLabel,
          sliceDigest: stats.digest,
        },
        this.config.digestAlgorithm,
      ),
      slice,
      recap: input.recap,
      transcriptBundle: input.transcriptBundle,
      payloadEcho: input.payloadEcho,
      messageEntries,
      recordEntries,
      segmentEntries,
      proofEntries,
      legendEntries,
      momentEntries,
      threadEntries,
      recapEntry,
      continuityEntry,
      messageById,
      recordById,
      segmentById,
      proofByHash,
      legendById,
      momentById,
      threadById,
      messageIdsByProof,
      messageIdsByLegend,
      messageIdsByMoment,
      segmentIdsByMoment,
      segmentIdsByProof,
      segmentIdsByLegend,
      threadIdsByCounterpart,
      legendIdsByWitnessMessageId,
      searchCorpus: new Map<string, ChatReplaySearchHit[]>(),
      recentLookupIds: [],
      stats,
    };

    state.stats = {
      ...state.stats,
      searchTermCount: this.estimateSearchTermCount(state),
    };

    return state;
  }

  private buildMessageEntries(
    slice: ChatReplaySerializedSlice,
    sourceClass: ChatReplayIndexSourceClass,
  ): ChatReplayMessageIndexEntry[] {
    const segmentIdsByMessageId = new Map<ChatMessageId, string[]>();
    const witnessLegendIdsByMessageId = new Map<ChatMessageId, ChatLegendId[]>();
    const threadIdsByMessageId = new Map<ChatMessageId, string[]>();

    for (const segment of slice.segments) {
      for (const messageId of segment.messageIds) {
        pushMapArray(segmentIdsByMessageId, messageId, segment.id);
      }
    }

    for (const legend of slice.legendMoments) {
      for (const witnessMessageId of legend.witnessMessageIds) {
        pushMapArray(witnessLegendIdsByMessageId, witnessMessageId, legend.legendId);
      }
      pushMapArray(witnessLegendIdsByMessageId, legend.messageId, legend.legendId);
    }

    for (const thread of slice.threadViews) {
      for (const messageId of thread.messageIds) {
        pushMapArray(threadIdsByMessageId, messageId, thread.id);
      }
    }

    return [...slice.messages]
      .sort((left, right) => {
        if (left.ts !== right.ts) return left.ts - right.ts;
        return left.id.localeCompare(right.id);
      })
      .map((message, ordinal) => ({
        kind: 'MESSAGE',
        id: message.id,
        channel: message.channel,
        ordinal,
        ts: message.ts,
        stableDigest: digestOf(
          {
            id: message.id,
            ts: message.ts,
            stableBodyDigest: message.stableBodyDigest,
            proofHash: message.proofHash,
            legendId: message.legendId,
            momentId: message.momentId,
            replayId: message.replayId,
          },
          this.config.digestAlgorithm,
        ),
        sourceClass,
        message,
        related: {
          proofHash: message.proofHash,
          legendId: message.legendId,
          momentId: message.momentId,
          replayId: message.replayId,
          sceneId: message.sceneId,
          segmentIds: Object.freeze(uniq(segmentIdsByMessageId.get(message.id) ?? []).sort()),
          threadIds: Object.freeze(uniq(threadIdsByMessageId.get(message.id) ?? []).sort()),
          witnessLegendIds: Object.freeze(uniq(witnessLegendIdsByMessageId.get(message.id) ?? []).sort()),
        },
      }));
  }

  private buildRecordEntries(
    slice: ChatReplaySerializedSlice,
    sourceClass: ChatReplayIndexSourceClass,
  ): ChatReplayRecordIndexEntry[] {
    const records = slice.records ?? [];
    return [...records].map((record, ordinal) => ({
      kind: 'RECORD',
      id: record.id,
      channel: record.channel,
      ordinal,
      stableDigest: digestOf(record, this.config.digestAlgorithm),
      sourceClass,
      record,
    }));
  }

  private buildSegmentEntries(
    slice: ChatReplaySerializedSlice,
    sourceClass: ChatReplayIndexSourceClass,
  ): ChatReplaySegmentIndexEntry[] {
    return [...slice.segments]
      .sort((left, right) => {
        if (left.startTs !== right.startTs) return left.startTs - right.startTs;
        return left.id.localeCompare(right.id);
      })
      .map((segment, ordinal) => ({
        kind: 'SEGMENT',
        id: segment.id,
        channel: segment.channel,
        ordinal,
        startTs: segment.startTs,
        endTs: segment.endTs,
        stableDigest: digestOf(segment, this.config.digestAlgorithm),
        sourceClass,
        segment,
      }));
  }

  private buildProofEntries(
    slice: ChatReplaySerializedSlice,
    sourceClass: ChatReplayIndexSourceClass,
  ): ChatReplayProofIndexEntry[] {
    return [...slice.proofReferences]
      .sort((left, right) => {
        if (left.firstTs !== right.firstTs) return left.firstTs - right.firstTs;
        return left.proofHash.localeCompare(right.proofHash);
      })
      .map((proof, ordinal) => ({
        kind: 'PROOF',
        proofHash: proof.proofHash,
        channel: proof.channel,
        ordinal,
        startTs: proof.firstTs,
        endTs: proof.lastTs,
        stableDigest: digestOf(proof, this.config.digestAlgorithm),
        sourceClass,
        proof,
      }));
  }

  private buildLegendEntries(
    slice: ChatReplaySerializedSlice,
    sourceClass: ChatReplayIndexSourceClass,
  ): ChatReplayLegendIndexEntry[] {
    return [...slice.legendMoments]
      .sort((left, right) => {
        if (left.prestigeScore !== right.prestigeScore) return right.prestigeScore - left.prestigeScore;
        if (left.ts !== right.ts) return left.ts - right.ts;
        return left.legendId.localeCompare(right.legendId);
      })
      .map((legend, ordinal) => ({
        kind: 'LEGEND',
        legendId: legend.legendId,
        channel: legend.channel,
        ordinal,
        ts: legend.ts,
        stableDigest: digestOf(legend, this.config.digestAlgorithm),
        sourceClass,
        legend,
      }));
  }

  private buildMomentEntries(
    slice: ChatReplaySerializedSlice,
    sourceClass: ChatReplayIndexSourceClass,
  ): ChatReplayMomentIndexEntry[] {
    return [...slice.momentAnchors]
      .sort((left, right) => {
        if (left.firstTs !== right.firstTs) return left.firstTs - right.firstTs;
        return left.momentId.localeCompare(right.momentId);
      })
      .map((moment, ordinal) => ({
        kind: 'MOMENT',
        momentId: moment.momentId,
        channel: moment.channel,
        ordinal,
        firstTs: moment.firstTs,
        lastTs: moment.lastTs,
        stableDigest: digestOf(moment, this.config.digestAlgorithm),
        sourceClass,
        moment,
      }));
  }

  private buildThreadEntries(
    slice: ChatReplaySerializedSlice,
    sourceClass: ChatReplayIndexSourceClass,
  ): ChatReplayThreadIndexEntry[] {
    return [...slice.threadViews]
      .sort((left, right) => {
        if (left.firstTs !== right.firstTs) return left.firstTs - right.firstTs;
        return left.id.localeCompare(right.id);
      })
      .map((thread, ordinal) => ({
        kind: 'THREAD',
        id: thread.id,
        channel: thread.channel,
        ordinal,
        firstTs: thread.firstTs,
        lastTs: thread.lastTs,
        stableDigest: digestOf(thread, this.config.digestAlgorithm),
        sourceClass,
        thread,
      }));
  }

  private buildContinuityEntry(
    continuity: ChatReplayNormalizedContinuityDigest,
    channel: ChatVisibleChannel,
    sourceClass: ChatReplayIndexSourceClass,
  ): ChatReplayContinuityIndexEntry {
    return {
      kind: 'CONTINUITY',
      channel,
      builtAt: continuity.builtAt,
      stableDigest: digestOf(continuity, this.config.digestAlgorithm),
      sourceClass,
      continuity,
    };
  }

  private buildRecapEntry(
    recap: ChatReplaySerializedRecap,
    channel: ChatVisibleChannel,
    sourceClass: ChatReplayIndexSourceClass,
  ): ChatReplayRecapIndexEntry {
    return {
      kind: 'RECAP',
      channel,
      builtAt: recap.builtAt,
      stableDigest: digestOf(recap, this.config.digestAlgorithm),
      sourceClass,
      recap,
    };
  }

  private estimateSearchTermCount(state: InternalChannelIndexState): number {
    const tokens = new Set<string>();
    for (const entry of state.messageEntries) tokenizeInto(entry.message.searchText, tokens);
    for (const entry of state.recordEntries) tokenizeInto(buildRecordSearchText(entry.record, this.config.includeMetadataSearch), tokens);
    for (const entry of state.segmentEntries) tokenizeInto(buildSegmentSearchText(entry.segment), tokens);
    for (const entry of state.proofEntries) tokenizeInto(buildProofSearchText(entry.proof), tokens);
    for (const entry of state.legendEntries) tokenizeInto(buildLegendSearchText(entry.legend), tokens);
    for (const entry of state.momentEntries) tokenizeInto(buildMomentSearchText(entry.moment), tokens);
    for (const entry of state.threadEntries) tokenizeInto(buildThreadSearchText(entry.thread, this.config.includeThreadCounterpartSearch), tokens);
    tokenizeInto(state.continuityEntry.continuity.summaryLine, tokens);
    return tokens.size;
  }

  // ========================================================================
  // MARK: Internal global state rebuild
  // ========================================================================

  private enforceChannelLimit(): void {
    if (this.channels.size <= this.config.maxCachedChannels) return;

    const ordered = [...this.channels.values()]
      .sort((left, right) => left.builtAt - right.builtAt)
      .map((state) => state.channel);

    while (this.channels.size > this.config.maxCachedChannels && ordered.length > 0) {
      const next = ordered.shift();
      if (!next) break;
      this.channels.delete(next);
      this.warn?.('Evicted replay index channel due to cache limit.', {
        channel: next,
        maxCachedChannels: this.config.maxCachedChannels,
      });
    }
  }

  private rebuildGlobalMaps(): void {
    this.globalMessageById.clear();
    this.globalSegmentById.clear();
    this.globalProofByHash.clear();
    this.globalLegendById.clear();
    this.globalMomentById.clear();
    this.globalThreadById.clear();

    if (!this.config.buildCrossChannelIndexes) return;

    for (const state of this.channels.values()) {
      for (const entry of state.messageEntries) this.globalMessageById.set(entry.id, entry);
      for (const entry of state.segmentEntries) this.globalSegmentById.set(entry.id, entry);
      for (const entry of state.proofEntries) this.globalProofByHash.set(entry.proofHash, entry);
      for (const entry of state.legendEntries) this.globalLegendById.set(entry.legendId, entry);
      for (const entry of state.momentEntries) this.globalMomentById.set(entry.momentId, entry);
      for (const entry of state.threadEntries) this.globalThreadById.set(entry.id, entry);
    }
  }

  private computeGlobalStats(): ChatReplayGlobalIndexStats {
    const channelStates = [...this.channels.values()];
    const digest = digestOf(
      channelStates.map((state) => ({
        channel: state.channel,
        digest: state.stats.digest,
        sourceDigest: state.sourceDigest,
      })),
      this.config.digestAlgorithm,
    );

    return {
      builtAt: this.builtAt,
      engineVersion: CHAT_ENGINE_VERSION,
      apiVersion: CHAT_ENGINE_PUBLIC_API_VERSION,
      channelCount: channelStates.length,
      totalMessages: channelStates.reduce((sum, state) => sum + state.stats.messageCount, 0),
      totalSegments: channelStates.reduce((sum, state) => sum + state.stats.segmentCount, 0),
      totalProofs: channelStates.reduce((sum, state) => sum + state.stats.proofCount, 0),
      totalLegends: channelStates.reduce((sum, state) => sum + state.stats.legendCount, 0),
      totalMoments: channelStates.reduce((sum, state) => sum + state.stats.momentCount, 0),
      totalThreads: channelStates.reduce((sum, state) => sum + state.stats.threadCount, 0),
      totalWitnessLines: channelStates.reduce((sum, state) => sum + state.stats.witnessLineCount, 0),
      digest,
    };
  }

  private toChannelSnapshot(state: InternalChannelIndexState): ChatReplayChannelIndexSnapshot {
    return {
      stats: state.stats,
      summary: state.slice.summary,
      continuity: state.continuityEntry.continuity,
      recap: state.recap,
      messageIds: state.messageEntries.map((entry) => entry.id),
      proofHashes: state.proofEntries.map((entry) => entry.proofHash),
      legendIds: state.legendEntries.map((entry) => entry.legendId),
      momentIds: state.momentEntries.map((entry) => entry.momentId),
      threadIds: state.threadEntries.map((entry) => entry.id),
      segmentIds: state.segmentEntries.map((entry) => entry.id),
    };
  }

  // ========================================================================
  // MARK: Internal search
  // ========================================================================

  private computeSearchHitsForTerm(input: {
    state: InternalChannelIndexState;
    term: string;
    domain: ChatReplaySearchDomain;
  }): ChatReplaySearchHit[] {
    const lowered = normalizeKey(input.term);
    if (!lowered) return [];

    const hits: ChatReplaySearchHit[] = [];

    const domains: readonly ChatReplaySearchDomain[] = input.domain === 'ALL'
      ? ['MESSAGES', 'SEGMENTS', 'PROOFS', 'LEGENDS', 'MOMENTS', 'THREADS', 'CONTINUITY']
      : [input.domain];

    if (domains.includes('MESSAGES')) {
      for (const entry of input.state.messageEntries) {
        const haystack = normalizeKey(entry.message.searchText);
        const score = this.matchScore(haystack, lowered, 10);
        if (!score) continue;
        hits.push({
          domain: 'MESSAGES',
          channel: entry.channel,
          id: entry.id,
          score,
          label: `${entry.message.senderName ?? entry.message.senderId ?? 'UNKNOWN'} • ${entry.message.kind}`,
          excerpt: buildExcerpt(entry.message.searchText, lowered),
          digest: entry.stableDigest,
        });
      }
    }

    if (domains.includes('SEGMENTS')) {
      for (const entry of input.state.segmentEntries) {
        const haystack = normalizeKey(buildSegmentSearchText(entry.segment));
        const score = this.matchScore(haystack, lowered, 8);
        if (!score) continue;
        hits.push({
          domain: 'SEGMENTS',
          channel: entry.channel,
          id: entry.id,
          score,
          label: `${entry.segment.timelineClass} • ${entry.segment.dominantKind}`,
          excerpt: buildExcerpt(entry.segment.summaryLine, lowered),
          digest: entry.stableDigest,
        });
      }
    }

    if (domains.includes('PROOFS')) {
      for (const entry of input.state.proofEntries) {
        const haystack = normalizeKey(buildProofSearchText(entry.proof));
        const score = this.matchScore(haystack, lowered, 9);
        if (!score) continue;
        hits.push({
          domain: 'PROOFS',
          channel: entry.channel,
          id: entry.proofHash,
          score,
          label: `${entry.proof.proofClass} • ${entry.proof.proofHash}`,
          excerpt: buildExcerpt(buildProofSearchText(entry.proof), lowered),
          digest: entry.stableDigest,
        });
      }
    }

    if (domains.includes('LEGENDS')) {
      for (const entry of input.state.legendEntries) {
        const haystack = normalizeKey(buildLegendSearchText(entry.legend));
        const score = this.matchScore(haystack, lowered, 12);
        if (!score) continue;
        hits.push({
          domain: 'LEGENDS',
          channel: entry.channel,
          id: entry.legendId,
          score,
          label: `${entry.legend.title} • ${entry.legend.legendClass}`,
          excerpt: buildExcerpt(buildLegendSearchText(entry.legend), lowered),
          digest: entry.stableDigest,
        });
      }
    }

    if (domains.includes('MOMENTS')) {
      for (const entry of input.state.momentEntries) {
        const haystack = normalizeKey(buildMomentSearchText(entry.moment));
        const score = this.matchScore(haystack, lowered, 7);
        if (!score) continue;
        hits.push({
          domain: 'MOMENTS',
          channel: entry.channel,
          id: entry.momentId,
          score,
          label: `Moment ${entry.momentId}`,
          excerpt: buildExcerpt(buildMomentSearchText(entry.moment), lowered),
          digest: entry.stableDigest,
        });
      }
    }

    if (domains.includes('THREADS')) {
      for (const entry of input.state.threadEntries) {
        const haystack = normalizeKey(buildThreadSearchText(entry.thread, this.config.includeThreadCounterpartSearch));
        const score = this.matchScore(haystack, lowered, 7);
        if (!score) continue;
        hits.push({
          domain: 'THREADS',
          channel: entry.channel,
          id: entry.id,
          score,
          label: entry.thread.label,
          excerpt: buildExcerpt(buildThreadSearchText(entry.thread, this.config.includeThreadCounterpartSearch), lowered),
          digest: entry.stableDigest,
        });
      }
    }

    if (domains.includes('CONTINUITY')) {
      const continuityText = [
        input.state.continuityEntry.continuity.summaryLine,
        ...input.state.continuityEntry.continuity.recurringCounterpartIds,
        ...input.state.continuityEntry.continuity.topProofHashes,
        ...input.state.continuityEntry.continuity.legendIds,
        ...(
          this.config.includeContinuityCandidates
            ? input.state.continuityEntry.continuity.callbackCandidateMessageIds
            : []
        ),
      ].join(' ');
      const haystack = normalizeKey(continuityText);
      const score = this.matchScore(haystack, lowered, 6);
      if (score) {
        hits.push({
          domain: 'CONTINUITY',
          channel: input.state.channel,
          id: `${input.state.channel}:continuity`,
          score,
          label: `Continuity • ${input.state.channel}`,
          excerpt: buildExcerpt(continuityText, lowered),
          digest: input.state.continuityEntry.stableDigest,
        });
      }
    }

    return hits.sort(compareSearchHitDesc).slice(0, this.config.maxSearchResults);
  }

  private matchScore(haystack: string, needle: string, base: number): number {
    if (!haystack || !needle) return 0;
    if (haystack === needle) return base + 10;
    if (haystack.startsWith(needle)) return base + 8;
    if (haystack.includes(` ${needle} `)) return base + 7;
    if (haystack.includes(needle)) return base + 5;

    const needleParts = needle.split(/\s+/g).filter(Boolean);
    if (!needleParts.length) return 0;

    const matched = needleParts.filter((part) => haystack.includes(part)).length;
    if (!matched) return 0;
    return base + matched;
  }

  // ========================================================================
  // MARK: Internal diagnostics
  // ========================================================================

  private touchLookup(id: string): void {
    this.recentLookupIds.push(id);
    if (this.recentLookupIds.length > this.config.maxRecentLookups) {
      this.recentLookupIds.splice(0, this.recentLookupIds.length - this.config.maxRecentLookups);
    }
  }

  private debug(message: string, context?: Record<string, unknown>): void {
    this.log?.(message, context);
  }
}

// ============================================================================
// MARK: Helper functions for map construction
// ============================================================================

function pushMapArray<TKey, TValue>(map: Map<TKey, TValue[]>, key: TKey, value: TValue): void {
  const existing = map.get(key);
  if (existing) {
    existing.push(value);
    return;
  }
  map.set(key, [value]);
}

function tokenizeInto(input: string, bucket: Set<string>): void {
  const normalized = normalizeKey(input);
  if (!normalized) return;
  for (const token of normalized.split(/[^a-z0-9_:@.-]+/g)) {
    if (!token) continue;
    bucket.add(token);
  }
}

// ============================================================================
// MARK: Factory helpers
// ============================================================================

export function createChatReplayIndex(config: ChatReplayIndexConfig = {}): ChatReplayIndex {
  return new ChatReplayIndex(config);
}

export function buildReplayIndexFromSlice(input: {
  slice: ChatReplaySlice;
  transcriptBundle?: ChatTranscriptExportBundle;
  config?: ChatReplayIndexConfig;
  options?: ChatReplayIndexBuildOptions;
}): ChatReplayChannelIndexSnapshot {
  const index = new ChatReplayIndex(input.config);
  return index.buildFromSlice(input.slice, input.transcriptBundle, input.options);
}

export function buildReplayIndexFromExportBundle(input: {
  bundle: ChatReplayExportBundle;
  config?: ChatReplayIndexConfig;
  options?: ChatReplayIndexBuildOptions;
}): ChatReplayChannelIndexSnapshot {
  const index = new ChatReplayIndex(input.config);
  return index.buildFromExportBundle(input.bundle, input.options);
}

export function buildReplayIndexFromSerializedEnvelope(input: {
  envelope: ChatReplaySerializedEnvelope;
  config?: ChatReplayIndexConfig;
  options?: ChatReplayIndexBuildOptions;
}): ChatReplayChannelIndexSnapshot {
  const index = new ChatReplayIndex(input.config);
  return index.buildFromSerializedEnvelope(input.envelope, input.options);
}

export function buildReplayIndexFromBuffer(input: {
  replayBuffer: ChatReplayBuffer;
  serializer?: ChatReplaySerializer;
  request?: ChatReplaySliceRequest;
  config?: ChatReplayIndexConfig;
  options?: ChatReplayIndexBuildOptions;
}): ChatReplayChannelIndexSnapshot {
  const index = new ChatReplayIndex(input.config);
  return index.buildFromBuffer({
    replayBuffer: input.replayBuffer,
    serializer: input.serializer,
    request: input.request,
    buildOptions: input.options,
  });
}

export interface ChatReplayIndexCallbacks extends ChatReplayBufferCallbacks {
  readonly replayIndex: ChatReplayIndex;
  readonly serializer?: ChatReplaySerializer;
  readonly buildOptions?: ChatReplayIndexBuildOptions;
}

export function createReplayIndexAwareCallbacks(input: {
  replayIndex: ChatReplayIndex;
  serializer?: ChatReplaySerializer;
  buildOptions?: ChatReplayIndexBuildOptions;
  callbacks?: ChatReplayBufferCallbacks;
}): ChatReplayBufferCallbacks {
  return {
    ...input.callbacks,
    onSliceBuilt: (slice: ChatReplaySlice) => {
      try {
        input.replayIndex.buildFromBuffer({
          replayBuffer: {
            buildSlice: () => slice,
          } as unknown as ChatReplayBuffer,
          serializer: input.serializer,
          request: {
            channel: slice.channel,
            sessionId: slice.session.id,
            reason: slice.reason,
          },
          buildOptions: {
            ...input.buildOptions,
            sourceClass: input.buildOptions?.sourceClass ?? 'BUFFER_REQUEST',
          },
        });
      } catch {
        input.replayIndex.buildFromSlice(slice, undefined, {
          ...input.buildOptions,
          sourceClass: input.buildOptions?.sourceClass ?? 'SLICE',
        });
      }
      input.callbacks?.onSliceBuilt?.(slice);
    },
    onExported: (bundle: ChatReplayExportBundle) => {
      input.replayIndex.buildFromExportBundle(bundle, {
        ...input.buildOptions,
        sourceClass: input.buildOptions?.sourceClass ?? 'EXPORT_BUNDLE',
      });
      input.callbacks?.onExported?.(bundle);
    },
  };
}

// ============================================================================
// MARK: Public manifest
// ============================================================================

export const CHAT_REPLAY_INDEX_PUBLIC_MANIFEST = Object.freeze({
  moduleName: CHAT_REPLAY_INDEX_MODULE_NAME,
  version: CHAT_REPLAY_INDEX_VERSION,
  engineVersion: CHAT_ENGINE_VERSION,
  apiVersion: CHAT_ENGINE_PUBLIC_API_VERSION,
  authorities: Object.freeze({
    ...CHAT_REPLAY_INDEX_AUTHORITIES,
    engineAuthorities: CHAT_ENGINE_AUTHORITIES,
    serializerModule: CHAT_REPLAY_SERIALIZER_MODULE_NAME,
  }),
  owns: Object.freeze([
    'replay lookup tables',
    'message / proof / legend / moment / thread resolution',
    'channel-scoped replay indexes',
    'cross-channel replay lookup maps',
    'range retrieval',
    'proof bundle lookup',
    'witness retrieval',
    'moment bundle lookup',
    'thread bundle lookup',
    'search corpus indexing',
    'recap retrieval',
    'continuity retrieval',
    'buffer-aware replay indexing callbacks',
  ] as const),
  companionFiles: Object.freeze([
    '/pzo-web/src/engines/chat/replay/ChatReplayBuffer.ts',
    '/pzo-web/src/engines/chat/replay/ChatReplaySerializer.ts',
    '/pzo-web/src/engines/chat/replay/index.ts',
    '/pzo-web/src/engines/chat/ChatTranscriptBuffer.ts',
    '/pzo-web/src/engines/chat/types.ts',
  ] as const),
} as const);
