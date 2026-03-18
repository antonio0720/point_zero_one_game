
/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ENGINE TRANSCRIPT BUFFER
 * FILE: pzo-web/src/engines/chat/ChatTranscriptBuffer.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical client-side transcript window and replay merge authority for the
 * unified frontend chat engine.
 *
 * This file exists because the current repo still keeps chat state in
 * pzo-web/src/components/chat/useChatEngine.ts, where the client owns a flat
 * message array and truncates to a 500-message window. That donor lane is good
 * enough for a prototype, but not for a first-class chat engine that has to
 * survive:
 *   - room reconnects,
 *   - replay hydration,
 *   - immutable Deal Room receipts,
 *   - channel-specific windows,
 *   - proof-bearing recap cards,
 *   - out-of-order batches,
 *   - optimistic client messages that later get acked,
 *   - moderation redaction without transcript corruption,
 *   - 20M-concurrency scale assumptions where the server paginates and the
 *     client holds precise working sets rather than pretending to store the
 *     whole universe.
 *
 * Preserved repo truths
 * ---------------------
 * - Existing chat keeps a bounded client transcript window while the server is
 *   the long-term transcript owner.
 * - Existing chat emits message types with engine-oriented metadata such as
 *   proofHash, pressureTier, tickTier, runOutcome, bot attack context, and
 *   shield / cascade info.
 * - Existing chat performs dedup for event-batch storms.
 * - Existing chat elevates DEAL_ROOM integrity by carrying immutable / proofHash
 *   semantics in the message model.
 *
 * Design laws
 * -----------
 * - Transcript buffering is not the same thing as transcript truth.
 * - The backend owns canonical history; the frontend owns working-set clarity.
 * - DEAL_ROOM immutable records are never mutated in-place in a way that breaks
 *   proof continuity.
 * - Replays merge by identity, proof, and time — never by naive append only.
 * - Optimistic client sends are first-class citizens and must reconcile cleanly.
 * - Pruning is deterministic and channel-aware.
 * - Search, export, drawer paging, and replay cursors all read from one
 *   authoritative local transcript buffer rather than duplicating slices in UI.
 *
 * Migration note
 * --------------
 * This file intentionally keeps local compatibility contracts until the final
 * shared contracts lane is live under:
 *   /shared/contracts/chat
 *   /shared/contracts/chat/learning
 *
 * Density6 LLC · Point Zero One · Production-first architecture
 * ============================================================================
 */

import {
  type ChatChannel,
  type ChatMessage,
  type ChatMessageKind,
  type ChatModerationEvent,
  type ChatReplayResponse,
} from './ChatSocketClient';

export type ChatTranscriptMutationReason =
  | 'bootstrap'
  | 'outbound_optimistic'
  | 'outbound_ack'
  | 'socket_message'
  | 'socket_batch'
  | 'socket_replay'
  | 'moderation'
  | 'system_insert'
  | 'manual_patch'
  | 'prune'
  | 'destroyed';

export type ChatTranscriptRecordState =
  | 'OPTIMISTIC'
  | 'ACKED'
  | 'SERVER'
  | 'FAILED'
  | 'REDACTED'
  | 'TOMBSTONED';

export type ChatTranscriptConflictPolicy =
  | 'PREFER_SERVER'
  | 'PREFER_IMMUTABLE'
  | 'MERGE_METADATA'
  | 'KEEP_BOTH';

export type ChatTranscriptSearchField =
  | 'body'
  | 'sender'
  | 'proofHash'
  | 'messageId'
  | 'metadata'
  | 'sceneId'
  | 'eventId'
  | 'callbackRef'
  | 'rhetoricalTemplate'
  | 'semanticCluster';

export type ChatTranscriptExportMode =
  | 'VISIBLE_WINDOW'
  | 'CHANNEL_FULL'
  | 'SEARCH_RESULTS'
  | 'DRAWER_PAGE'
  | 'PROOF_ONLY';

export type ChatTranscriptSortMode =
  | 'TS_ASC'
  | 'TS_DESC';

export type ChatTranscriptProofClass =
  | 'NONE'
  | 'DEAL_IMMUTABLE'
  | 'DEAL_PROOF'
  | 'SYSTEM_RECEIPT'
  | 'LEGENDARY'
  | 'REPLAY_ANCHOR';

export interface ChatTranscriptCallbackReference {
  callbackId: string;
  callbackType:
    | 'QUOTE'
    | 'MEMORY'
    | 'HUMILIATION'
    | 'COMEBACK'
    | 'RESCUE'
    | 'DEAL_ROOM'
    | 'WORLD_EVENT'
    | 'SOVEREIGNTY';
  payloadRef: string;
}

export interface ChatTranscriptSceneAnnotation {
  sceneId?: string;
  momentId?: string;
  eventIds?: readonly string[];
  semanticClusterIds?: readonly string[];
  rhetoricalTemplateIds?: readonly string[];
  callbackRefs?: readonly ChatTranscriptCallbackReference[];
  relatedMemoryAnchorIds?: readonly string[];
  transcriptTags?: readonly string[];
  canonicalLineId?: string;
  surfaceVariantId?: string;
  realizationStrategy?: string;
}


export interface ChatTranscriptRecord {
  localId: string;
  messageId: string;
  ackedServerId?: string;
  channel: ChatChannel;
  ts: number;
  sortTs: number;
  senderId: string;
  senderName: string;
  senderRank?: string;
  kind: string;
  body: string;
  emoji?: string;
  immutable: boolean;
  proofHash?: string;
  pressureTier?: string;
  tickTier?: string;
  runOutcome?: string;
  metadata?: Record<string, unknown>;
  state: ChatTranscriptRecordState;
  proofClass: ChatTranscriptProofClass;
  insertedAt: number;
  lastMutatedAt: number;
  dedupKey: string;
  searchBody: string;
  searchSender: string;
  normalizedBody: string;
  semanticClusterIds: readonly string[];
  rhetoricalTemplateIds: readonly string[];
  callbackRefs: readonly ChatTranscriptCallbackReference[];
  sceneId?: string;
  momentId?: string;
  eventIds: readonly string[];
  relatedMemoryAnchorIds: readonly string[];
  transcriptTags: readonly string[];
  canonicalLineId?: string;
  surfaceVariantId?: string;
  realizationStrategy?: string;
  redactedBody?: string;
  tombstoneReason?: string;
  redactReason?: string;
  sourceReason: ChatTranscriptMutationReason;
  history: ChatTranscriptHistoryEntry[];
}

export interface ChatTranscriptHistoryEntry {
  ts: number;
  reason: ChatTranscriptMutationReason;
  summary: string;
}

export interface ChatTranscriptChannelLedger {
  channel: ChatChannel;
  revision: number;
  recordCount: number;
  visibleCount: number;
  optimisticCount: number;
  ackPendingCount: number;
  failedCount: number;
  redactedCount: number;
  immutableCount: number;
  proofCount: number;
  earliestTs: number | null;
  latestTs: number | null;
  lastReplayAt: number | null;
  lastInboundAt: number | null;
  lastPrunedAt: number | null;
  replayToken?: string;
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
}

export interface ChatTranscriptDrawerCursor {
  channel: ChatChannel;
  anchorMessageId?: string;
  anchorTs?: number;
  pageSize: number;
  beforeCount: number;
  afterCount: number;
}

export interface ChatTranscriptDrawerPage {
  channel: ChatChannel;
  anchorMessageId?: string;
  anchorTs?: number;
  records: ChatTranscriptRecord[];
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
  pageStartTs: number | null;
  pageEndTs: number | null;
}

export interface ChatTranscriptSearchRequest {
  channel?: ChatChannel;
  query: string;
  fields?: ChatTranscriptSearchField[];
  includeRedacted?: boolean;
  includeFailed?: boolean;
  includeTombstoned?: boolean;
  limit?: number;
  sort?: ChatTranscriptSortMode;
}

export interface ChatTranscriptSearchMatch {
  record: ChatTranscriptRecord;
  score: number;
  reasons: string[];
}

export interface ChatTranscriptSearchResponse {
  query: string;
  matches: ChatTranscriptSearchMatch[];
  totalMatches: number;
}

export interface ChatTranscriptExportRecord {
  channel: ChatChannel;
  messageId: string;
  ts: number;
  senderName: string;
  senderRank?: string;
  kind: string;
  body: string;
  immutable: boolean;
  proofHash?: string;
  pressureTier?: string;
  tickTier?: string;
  runOutcome?: string;
  sceneId?: string;
  momentId?: string;
  eventIds?: readonly string[];
  semanticClusterIds?: readonly string[];
  rhetoricalTemplateIds?: readonly string[];
  callbackRefs?: readonly ChatTranscriptCallbackReference[];
  metadata?: Record<string, unknown>;
}

export interface ChatTranscriptExportBundle {
  mode: ChatTranscriptExportMode;
  createdAt: number;
  channel?: ChatChannel;
  totalRecords: number;
  records: ChatTranscriptExportRecord[];
  summary: {
    immutableCount: number;
    proofCount: number;
    redactedCount: number;
    failedCount: number;
  };
}

export interface ChatTranscriptBufferSnapshot {
  activeChannel: ChatChannel;
  totalRecordCount: number;
  ledgers: ChatTranscriptChannelLedger[];
}

export interface ChatTranscriptBufferCallbacks {
  onRecordInserted?: (
    channel: ChatChannel,
    record: ChatTranscriptRecord,
    reason: ChatTranscriptMutationReason,
  ) => void;
  onRecordUpdated?: (
    channel: ChatChannel,
    record: ChatTranscriptRecord,
    reason: ChatTranscriptMutationReason,
  ) => void;
  onRecordPruned?: (
    channel: ChatChannel,
    record: ChatTranscriptRecord,
    reason: ChatTranscriptMutationReason,
  ) => void;
  onChannelChanged?: (
    channel: ChatChannel,
    ledger: ChatTranscriptChannelLedger,
    reason: ChatTranscriptMutationReason,
  ) => void;
  onSnapshotChanged?: (snapshot: ChatTranscriptBufferSnapshot) => void;
  onError?: (error: Error, context?: Record<string, unknown>) => void;
}

export interface ChatTranscriptBufferConfig {
  maxWindowPerChannel?: number;
  maxDrawerSearchScan?: number;
  replayMergeLimit?: number;
  optimisticTimeoutMs?: number;
  dedupWindowMs?: number;
  dedupCacheLimit?: number;
  proofRetentionFloor?: number;
  keepFailedMessages?: boolean;
  pruneTombstonesAfterMs?: number;
  preserveSystemReceipts?: boolean;
  allowImmutableRebodyOnlyIfProofMatches?: boolean;
  log?: (message: string, context?: Record<string, unknown>) => void;
  warn?: (message: string, context?: Record<string, unknown>) => void;
  error?: (message: string, context?: Record<string, unknown>) => void;
}

export interface ChatTranscriptBufferOptions {
  initialChannel?: ChatChannel;
  callbacks?: ChatTranscriptBufferCallbacks;
  config?: ChatTranscriptBufferConfig;
}

interface InternalChannelState {
  channel: ChatChannel;
  revision: number;
  ordered: ChatTranscriptRecord[];
  byMessageId: Map<string, ChatTranscriptRecord>;
  byLocalId: Map<string, ChatTranscriptRecord>;
  byProofHash: Map<string, ChatTranscriptRecord>;
  bySenderId: Map<string, ChatTranscriptRecord[]>;
  lastReplayAt: number | null;
  lastInboundAt: number | null;
  lastPrunedAt: number | null;
  replayToken?: string;
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
}

interface DedupEntry {
  key: string;
  channel: ChatChannel;
  expiresAt: number;
}

const CHANNELS: ChatChannel[] = ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY'];

const DEFAULT_CONFIG: Required<
  Pick<
    ChatTranscriptBufferConfig,
    | 'maxWindowPerChannel'
    | 'maxDrawerSearchScan'
    | 'replayMergeLimit'
    | 'optimisticTimeoutMs'
    | 'dedupWindowMs'
    | 'dedupCacheLimit'
    | 'proofRetentionFloor'
    | 'keepFailedMessages'
    | 'pruneTombstonesAfterMs'
    | 'preserveSystemReceipts'
    | 'allowImmutableRebodyOnlyIfProofMatches'
  >
> = {
  maxWindowPerChannel: 500,
  maxDrawerSearchScan: 2500,
  replayMergeLimit: 300,
  optimisticTimeoutMs: 15_000,
  dedupWindowMs: 100,
  dedupCacheLimit: 2000,
  proofRetentionFloor: 50,
  keepFailedMessages: true,
  pruneTombstonesAfterMs: 120_000,
  preserveSystemReceipts: true,
  allowImmutableRebodyOnlyIfProofMatches: false,
};

function now(): number {
  return Date.now();
}

function createError(message: string): Error {
  return new Error(`[ChatTranscriptBuffer] ${message}`);
}

function normalizeText(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim()
    : '';
}

function normalizeSearchText(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    .join(',')}}`;
}

function normalizeStringArray(values: readonly string[] | undefined): string[] {
  if (!values?.length) return [];
  const out: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }

  return out;
}

function cloneCallbackRefs(
  refs: readonly ChatTranscriptCallbackReference[] | undefined,
): ChatTranscriptCallbackReference[] {
  if (!refs?.length) return [];
  const dedup = new Set<string>();
  const out: ChatTranscriptCallbackReference[] = [];

  for (const ref of refs) {
    const callbackId = normalizeText(ref.callbackId);
    const payloadRef = normalizeText(ref.payloadRef);
    const callbackType = normalizeText(ref.callbackType).toUpperCase() as ChatTranscriptCallbackReference['callbackType'];
    if (!callbackId || !payloadRef || !callbackType) continue;

    const key = `${callbackType}|${callbackId}|${payloadRef}`;
    if (dedup.has(key)) continue;
    dedup.add(key);

    out.push({
      callbackId,
      callbackType,
      payloadRef,
    });
  }

  return out;
}

function mergeStringArrays(
  left: readonly string[] | undefined,
  right: readonly string[] | undefined,
): string[] {
  return normalizeStringArray([...(left ?? []), ...(right ?? [])]);
}

function mergeCallbackRefs(
  left: readonly ChatTranscriptCallbackReference[] | undefined,
  right: readonly ChatTranscriptCallbackReference[] | undefined,
): ChatTranscriptCallbackReference[] {
  return cloneCallbackRefs([...(left ?? []), ...(right ?? [])]);
}


let localSequence = 0;
function nextLocalId(): string {
  localSequence += 1;
  return `ctb_${Date.now()}_${localSequence}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function safeTs(value: unknown, fallback: number = now()): number {
  return isFiniteNumber(value) ? value : fallback;
}

function hashString(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `h${(h >>> 0).toString(16)}`;
}

function shallowMergeMetadata(
  left?: Record<string, unknown>,
  right?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!left && !right) return undefined;
  return { ...(left ?? {}), ...(right ?? {}) };
}

function inferProofClass(message: ChatMessage): ChatTranscriptProofClass {
  if (message.proofHash && message.immutable) return 'DEAL_PROOF';
  if (message.immutable) return 'DEAL_IMMUTABLE';
  if (message.proofHash) return 'SYSTEM_RECEIPT';
  if (message.kind === 'ACHIEVEMENT' && String(message.runOutcome ?? '').toUpperCase() === 'SOVEREIGNTY') {
    return 'LEGENDARY';
  }
  return 'NONE';
}

function transcriptDedupKey(message: Pick<
  ChatMessage,
  'channel' | 'kind' | 'body' | 'senderId' | 'proofHash' | 'ts'
>): string {
  const timeBucket = Math.floor(safeTs(message.ts, 0) / 100);
  return hashString([
    message.channel,
    message.kind,
    normalizeSearchText(message.senderId),
    normalizeSearchText(message.body),
    message.proofHash ?? '',
    String(timeBucket),
  ].join('|'));
}

function compareRecordsAsc(left: ChatTranscriptRecord, right: ChatTranscriptRecord): number {
  if (left.sortTs !== right.sortTs) return left.sortTs - right.sortTs;
  if (left.messageId !== right.messageId) return left.messageId.localeCompare(right.messageId);
  return left.localId.localeCompare(right.localId);
}

function compareRecordsDesc(left: ChatTranscriptRecord, right: ChatTranscriptRecord): number {
  return compareRecordsAsc(right, left);
}

function cloneLedger(state: InternalChannelState): ChatTranscriptChannelLedger {
  let optimisticCount = 0;
  let ackPendingCount = 0;
  let failedCount = 0;
  let redactedCount = 0;
  let immutableCount = 0;
  let proofCount = 0;

  for (const record of state.ordered) {
    if (record.state === 'OPTIMISTIC') optimisticCount += 1;
    if (record.state === 'OPTIMISTIC' || record.state === 'FAILED') ackPendingCount += 1;
    if (record.state === 'FAILED') failedCount += 1;
    if (record.state === 'REDACTED' || record.redactedBody) redactedCount += 1;
    if (record.immutable) immutableCount += 1;
    if (record.proofHash) proofCount += 1;
  }

  return {
    channel: state.channel,
    revision: state.revision,
    recordCount: state.ordered.length,
    visibleCount: state.ordered.filter((record) => record.state !== 'TOMBSTONED').length,
    optimisticCount,
    ackPendingCount,
    failedCount,
    redactedCount,
    immutableCount,
    proofCount,
    earliestTs: state.ordered[0]?.sortTs ?? null,
    latestTs: state.ordered[state.ordered.length - 1]?.sortTs ?? null,
    lastReplayAt: state.lastReplayAt,
    lastInboundAt: state.lastInboundAt,
    lastPrunedAt: state.lastPrunedAt,
    replayToken: state.replayToken,
    hasMoreBefore: state.hasMoreBefore,
    hasMoreAfter: state.hasMoreAfter,
  };
}

function exportRecord(record: ChatTranscriptRecord): ChatTranscriptExportRecord {
  return {
    channel: record.channel,
    messageId: record.messageId,
    ts: record.ts,
    senderName: record.senderName,
    senderRank: record.senderRank,
    kind: record.kind as ChatMessageKind,
    body: record.redactedBody ?? record.body,
    immutable: record.immutable,
    proofHash: record.proofHash,
    pressureTier: record.pressureTier,
    tickTier: record.tickTier,
    runOutcome: record.runOutcome,
    sceneId: record.sceneId,
    momentId: record.momentId,
    eventIds: record.eventIds,
    semanticClusterIds: record.semanticClusterIds,
    rhetoricalTemplateIds: record.rhetoricalTemplateIds,
    callbackRefs: record.callbackRefs,
    metadata: record.metadata,
  };
}

function createRecord(
  message: ChatMessage,
  state: ChatTranscriptRecordState,
  sourceReason: ChatTranscriptMutationReason,
): ChatTranscriptRecord {
  const insertedAt = now();
  const normalizedBody = normalizeText(message.body);
  const searchSender = normalizeSearchText([
    message.senderName,
    message.senderRank,
    message.senderId,
  ].filter(Boolean).join(' '));

  return {
    localId: nextLocalId(),
    messageId: normalizeText(message.id) || nextLocalId(),
    ackedServerId: undefined,
    channel: message.channel,
    ts: safeTs(message.ts, insertedAt),
    sortTs: safeTs(message.ts, insertedAt),
    senderId: normalizeText(message.senderId),
    senderName: normalizeText(message.senderName),
    senderRank: normalizeText(message.senderRank) || undefined,
    kind: normalizeText(message.kind),
    body: normalizedBody,
    emoji: normalizeText(message.emoji) || undefined,
    immutable: Boolean(message.immutable),
    proofHash: normalizeText(message.proofHash) || undefined,
    pressureTier: normalizeText(message.pressureTier) || undefined,
    tickTier: normalizeText(message.tickTier) || undefined,
    runOutcome: normalizeText(message.runOutcome) || undefined,
    metadata: message.metadata ? { ...message.metadata } : undefined,
    state,
    proofClass: inferProofClass(message),
    insertedAt,
    lastMutatedAt: insertedAt,
    dedupKey: transcriptDedupKey(message),
    searchBody: normalizeSearchText(normalizedBody),
    searchSender,
    normalizedBody,
    semanticClusterIds: [],
    rhetoricalTemplateIds: [],
    callbackRefs: [],
    sceneId: undefined,
    momentId: undefined,
    eventIds: [],
    relatedMemoryAnchorIds: [],
    transcriptTags: [],
    canonicalLineId: undefined,
    surfaceVariantId: undefined,
    realizationStrategy: undefined,
    sourceReason,
    history: [{
      ts: insertedAt,
      reason: sourceReason,
      summary: `created:${state.toLowerCase()}`,
    }],
  };
}

function recordToMessage(record: ChatTranscriptRecord): ChatMessage {
  return {
    id: record.ackedServerId ?? record.messageId,
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
    pressureTier: record.pressureTier,
    tickTier: record.tickTier,
    runOutcome: record.runOutcome,
    metadata: record.metadata ? { ...record.metadata } : undefined,
  };
}

function appendHistory(
  record: ChatTranscriptRecord,
  reason: ChatTranscriptMutationReason,
  summary: string,
): void {
  record.history.push({
    ts: now(),
    reason,
    summary,
  });
  if (record.history.length > 40) {
    record.history.splice(0, record.history.length - 40);
  }
  record.lastMutatedAt = now();
}

export class ChatTranscriptBuffer {
  private readonly callbacks: ChatTranscriptBufferCallbacks;
  private readonly config: ChatTranscriptBufferConfig & typeof DEFAULT_CONFIG;
  private readonly channels = new Map<ChatChannel, InternalChannelState>();
  private readonly dedupEntries: DedupEntry[] = [];
  private activeChannel: ChatChannel;
  private destroyed = false;
  private optimisticTimeout: ReturnType<typeof setInterval> | null = null;
  private pruneTimeout: ReturnType<typeof setInterval> | null = null;

  constructor(options: ChatTranscriptBufferOptions = {}) {
    this.callbacks = options.callbacks ?? {};
    this.config = {
      ...DEFAULT_CONFIG,
      ...(options.config ?? {}),
    };
    this.activeChannel = options.initialChannel ?? 'GLOBAL';

    for (const channel of CHANNELS) {
      this.channels.set(channel, this.createChannelState(channel));
    }

    this.optimisticTimeout = setInterval(() => {
      this.expireStaleOptimisticRecords();
    }, 2_000);

    this.pruneTimeout = setInterval(() => {
      this.compactDedup();
      this.pruneTombstones();
    }, 5_000);

    this.emitSnapshot();
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.optimisticTimeout) clearInterval(this.optimisticTimeout);
    if (this.pruneTimeout) clearInterval(this.pruneTimeout);

    this.optimisticTimeout = null;
    this.pruneTimeout = null;

    for (const channel of CHANNELS) {
      const state = this.requireChannel(channel);
      for (const record of state.ordered) {
        appendHistory(record, 'destroyed', 'buffer_destroyed');
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Public snapshot / selection
  // ---------------------------------------------------------------------------

  public setActiveChannel(channel: ChatChannel): void {
    this.assertNotDestroyed('setActiveChannel');
    this.activeChannel = channel;
    this.emitSnapshot();
  }

  public getActiveChannel(): ChatChannel {
    return this.activeChannel;
  }

  public getSnapshot(): ChatTranscriptBufferSnapshot {
    return {
      activeChannel: this.activeChannel,
      totalRecordCount: CHANNELS.reduce(
        (sum, channel) => sum + this.requireChannel(channel).ordered.length,
        0,
      ),
      ledgers: CHANNELS.map((channel) => cloneLedger(this.requireChannel(channel))),
    };
  }

  public getLedger(channel: ChatChannel): ChatTranscriptChannelLedger {
    return cloneLedger(this.requireChannel(channel));
  }

  public getVisibleWindow(channel: ChatChannel = this.activeChannel): ChatTranscriptRecord[] {
    return this.requireChannel(channel).ordered.filter((record) => record.state !== 'TOMBSTONED');
  }

  public getRawWindow(channel: ChatChannel = this.activeChannel): ChatTranscriptRecord[] {
    return [...this.requireChannel(channel).ordered];
  }

  public getMessage(messageId: string, channel?: ChatChannel): ChatTranscriptRecord | undefined {
    const normalized = normalizeText(messageId);
    if (!normalized) return undefined;

    if (channel) {
      return this.requireChannel(channel).byMessageId.get(normalized);
    }

    for (const candidate of CHANNELS) {
      const hit = this.requireChannel(candidate).byMessageId.get(normalized);
      if (hit) return hit;
    }
    return undefined;
  }

  public getByProofHash(proofHash: string, channel?: ChatChannel): ChatTranscriptRecord | undefined {
    const normalized = normalizeText(proofHash);
    if (!normalized) return undefined;

    if (channel) {
      return this.requireChannel(channel).byProofHash.get(normalized);
    }

    for (const candidate of CHANNELS) {
      const hit = this.requireChannel(candidate).byProofHash.get(normalized);
      if (hit) return hit;
    }
    return undefined;
  }

  public getOptimisticRecords(channel?: ChatChannel): ChatTranscriptRecord[] {
    if (channel) {
      return this.requireChannel(channel).ordered.filter((record) => record.state === 'OPTIMISTIC');
    }

    const results: ChatTranscriptRecord[] = [];
    for (const candidate of CHANNELS) {
      results.push(
        ...this.requireChannel(candidate).ordered.filter((record) => record.state === 'OPTIMISTIC'),
      );
    }
    return results;
  }

  public getFailedRecords(channel?: ChatChannel): ChatTranscriptRecord[] {
    if (channel) {
      return this.requireChannel(channel).ordered.filter((record) => record.state === 'FAILED');
    }

    const results: ChatTranscriptRecord[] = [];
    for (const candidate of CHANNELS) {
      results.push(
        ...this.requireChannel(candidate).ordered.filter((record) => record.state === 'FAILED'),
      );
    }
    return results;
  }

  // ---------------------------------------------------------------------------
  // Public insertions
  // ---------------------------------------------------------------------------

  public insertOptimisticMessage(input: ChatMessage): ChatTranscriptRecord {
    this.assertNotDestroyed('insertOptimisticMessage');
    const channel = input.channel;
    const state = this.requireChannel(channel);

    const record = createRecord(input, 'OPTIMISTIC', 'outbound_optimistic');
    const existing = this.findMergeCandidate(state, record);

    if (existing) {
      this.patchRecord(
        existing,
        recordToMessage(record),
        'outbound_optimistic',
        'optimistic_merge_reused_existing',
        'MERGE_METADATA',
      );
      return existing;
    }

    this.insertRecord(state, record, 'outbound_optimistic');
    this.schedulePrune(state, 'outbound_optimistic');
    return record;
  }

  public insertSystemMessage(input: ChatMessage): ChatTranscriptRecord {
    this.assertNotDestroyed('insertSystemMessage');
    const state = this.requireChannel(input.channel);
    const record = createRecord(input, 'SERVER', 'system_insert');

    const existing = this.findMergeCandidate(state, record);
    if (existing) {
      this.patchRecord(
        existing,
        input,
        'system_insert',
        'system_merge',
        record.immutable ? 'PREFER_IMMUTABLE' : 'MERGE_METADATA',
      );
      return existing;
    }

    this.insertRecord(state, record, 'system_insert');
    this.schedulePrune(state, 'system_insert');
    return record;
  }

  public noteInboundMessage(message: ChatMessage): ChatTranscriptRecord {
    this.assertNotDestroyed('noteInboundMessage');
    const state = this.requireChannel(message.channel);
    const record = createRecord(message, 'SERVER', 'socket_message');
    const existing = this.findMergeCandidate(state, record);

    if (existing) {
      this.patchRecord(
        existing,
        message,
        'socket_message',
        'server_inbound_merge',
        existing.immutable || record.immutable
          ? 'PREFER_IMMUTABLE'
          : 'PREFER_SERVER',
      );
      state.lastInboundAt = now();
      this.bumpChannel(state, 'socket_message');
      return existing;
    }

    this.insertRecord(state, record, 'socket_message');
    state.lastInboundAt = now();
    this.schedulePrune(state, 'socket_message');
    return record;
  }

  public noteInboundBatch(messages: ChatMessage[]): ChatTranscriptRecord[] {
    this.assertNotDestroyed('noteInboundBatch');

    const accepted: ChatTranscriptRecord[] = [];
    for (const message of messages) {
      accepted.push(this.noteInboundMessageWithReason(message, 'socket_batch'));
    }
    return accepted;
  }

  public noteReplay(replay: ChatReplayResponse): ChatTranscriptRecord[] {
    this.assertNotDestroyed('noteReplay');
    const state = this.requireChannel(replay.channel);
    const merged: ChatTranscriptRecord[] = [];

    state.lastReplayAt = now();
    state.replayToken = replay.replayToken;
    state.hasMoreBefore = Boolean(replay.hasMoreBefore);
    state.hasMoreAfter = Boolean(replay.hasMoreAfter);

    const limit = Math.min(replay.messages.length, this.config.replayMergeLimit);
    for (let i = 0; i < limit; i += 1) {
      const message = replay.messages[i];
      const record = createRecord(message, 'SERVER', 'socket_replay');
      const existing = this.findMergeCandidate(state, record);

      if (existing) {
        this.patchRecord(
          existing,
          message,
          'socket_replay',
          'replay_merge',
          existing.immutable || record.immutable
            ? 'PREFER_IMMUTABLE'
            : 'PREFER_SERVER',
        );
        merged.push(existing);
      } else {
        this.insertRecord(state, record, 'socket_replay');
        merged.push(record);
      }
    }

    this.schedulePrune(state, 'socket_replay');
    return merged;
  }

  public noteAck(input: {
    channel: ChatChannel;
    clientMessageId: string;
    serverMessageId?: string;
    ackTs?: number;
    accepted: boolean;
    reason?: string;
  }): ChatTranscriptRecord | undefined {
    this.assertNotDestroyed('noteAck');

    const state = this.requireChannel(input.channel);
    const normalized = normalizeText(input.clientMessageId);
    const record = state.byMessageId.get(normalized) ?? this.findByAckedServerId(state, normalized);

    if (!record) {
      return undefined;
    }

    if (input.accepted) {
      const ackTs = safeTs(input.ackTs, record.ts);
      record.state = 'ACKED';
      record.ackedServerId = normalizeText(input.serverMessageId) || record.ackedServerId;
      record.messageId = record.ackedServerId ?? record.messageId;
      record.ts = ackTs;
      record.sortTs = ackTs;
      record.lastMutatedAt = now();
      appendHistory(record, 'outbound_ack', `ack:${record.messageId}`);
      this.reindexRecord(state, record);
      this.resort(state);
      this.bumpChannel(state, 'outbound_ack');
      return record;
    }

    record.state = 'FAILED';
    record.lastMutatedAt = now();
    appendHistory(
      record,
      'outbound_ack',
      `ack_rejected:${normalizeText(input.reason) || 'unknown'}`,
    );
    this.bumpChannel(state, 'outbound_ack');
    return record;
  }

  public markFailed(input: {
    channel: ChatChannel;
    messageId: string;
    reason?: string;
  }): ChatTranscriptRecord | undefined {
    this.assertNotDestroyed('markFailed');

    const record = this.getMessage(input.messageId, input.channel);
    if (!record) return undefined;

    record.state = 'FAILED';
    appendHistory(
      record,
      'manual_patch',
      `failed:${normalizeText(input.reason) || 'unknown'}`,
    );
    this.bumpChannel(this.requireChannel(input.channel), 'manual_patch');
    return record;
  }

  public patchRedaction(input: {
    channel: ChatChannel;
    messageId: string;
    redactedBody: string;
    reason?: string;
  }): ChatTranscriptRecord | undefined {
    this.assertNotDestroyed('patchRedaction');

    const record = this.getMessage(input.messageId, input.channel);
    if (!record) return undefined;

    record.redactedBody = normalizeText(input.redactedBody);
    record.redactReason = normalizeText(input.reason) || 'policy_redaction';
    record.state = 'REDACTED';
    record.normalizedBody = normalizeText(record.redactedBody);
    record.searchBody = normalizeSearchText(record.redactedBody);
    appendHistory(record, 'manual_patch', `redacted:${record.redactReason}`);

    const state = this.requireChannel(input.channel);
    this.bumpChannel(state, 'manual_patch');
    return record;
  }

  public applyModeration(event: ChatModerationEvent): ChatTranscriptRecord[] {
    this.assertNotDestroyed('applyModeration');
    const results: ChatTranscriptRecord[] = [];
    const channel = event.channel;

    if (event.code === 'MESSAGE_REJECTED' && channel) {
      const targetId =
        normalizeText(String(event.metadata?.messageId ?? '')) ||
        normalizeText(String(event.metadata?.clientMessageId ?? ''));

      if (targetId) {
        const record = this.getMessage(targetId, channel);
        if (record) {
          if (this.config.keepFailedMessages) {
            record.state = 'FAILED';
            appendHistory(
              record,
              'moderation',
              `message_rejected:${normalizeText(event.reason) || 'unknown'}`,
            );
          } else {
            record.state = 'TOMBSTONED';
            record.tombstoneReason = normalizeText(event.reason) || 'moderated';
            appendHistory(record, 'moderation', 'message_tombstoned');
          }
          this.bumpChannel(this.requireChannel(channel), 'moderation');
          results.push(record);
        }
      }
    }

    if ((event.code === 'MUTED' || event.code === 'CHANNEL_LOCKED') && channel) {
      const state = this.requireChannel(channel);
      const system = this.insertSystemMessage({
        id: nextLocalId(),
        channel,
        kind: 'MODERATION' as ChatMessageKind,
        senderId: 'SYSTEM',
        senderName: 'SYSTEM',
        body: event.code === 'MUTED'
          ? `Moderation notice: you have been muted.${event.reason ? ` ${event.reason}` : ''}`
          : `Channel locked.${event.reason ? ` ${event.reason}` : ''}`,
        ts: event.ts,
        metadata: event.metadata,
      });
      results.push(system);
      this.bumpChannel(state, 'moderation');
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Drawer, paging, search, export
  // ---------------------------------------------------------------------------

  public buildDrawerPage(cursor: ChatTranscriptDrawerCursor): ChatTranscriptDrawerPage {
    this.assertNotDestroyed('buildDrawerPage');

    const state = this.requireChannel(cursor.channel);
    const visible = state.ordered.filter((record) => record.state !== 'TOMBSTONED');

    if (visible.length === 0) {
      return {
        channel: cursor.channel,
        anchorMessageId: cursor.anchorMessageId,
        anchorTs: cursor.anchorTs,
        records: [],
        hasMoreBefore: state.hasMoreBefore,
        hasMoreAfter: state.hasMoreAfter,
        pageStartTs: null,
        pageEndTs: null,
      };
    }

    let anchorIndex = -1;
    if (cursor.anchorMessageId) {
      anchorIndex = visible.findIndex((record) => record.messageId === cursor.anchorMessageId);
    }
    if (anchorIndex < 0 && cursor.anchorTs) {
      const anchorTs = cursor.anchorTs;
      anchorIndex = visible.findIndex((record) => record.sortTs >= anchorTs);
    }
    if (anchorIndex < 0) {
      anchorIndex = Math.max(visible.length - 1, 0);
    }

    const pageSize = Math.max(cursor.pageSize, 1);
    const beforeCount = Math.max(cursor.beforeCount, Math.floor(pageSize / 2));
    const afterCount = Math.max(cursor.afterCount, pageSize - beforeCount - 1);

    const start = Math.max(anchorIndex - beforeCount, 0);
    const endExclusive = Math.min(anchorIndex + afterCount + 1, visible.length);
    const page = visible.slice(start, endExclusive);

    return {
      channel: cursor.channel,
      anchorMessageId: cursor.anchorMessageId ?? visible[anchorIndex]?.messageId,
      anchorTs: cursor.anchorTs ?? visible[anchorIndex]?.sortTs,
      records: page,
      hasMoreBefore: state.hasMoreBefore || start > 0,
      hasMoreAfter: state.hasMoreAfter || endExclusive < visible.length,
      pageStartTs: page[0]?.sortTs ?? null,
      pageEndTs: page[page.length - 1]?.sortTs ?? null,
    };
  }

  public search(request: ChatTranscriptSearchRequest): ChatTranscriptSearchResponse {
    this.assertNotDestroyed('search');

    const query = normalizeSearchText(request.query);
    if (!query) {
      return { query: request.query, matches: [], totalMatches: 0 };
    }

    const fields = request.fields ?? ['body', 'sender', 'proofHash', 'messageId'];
    const includeRedacted = Boolean(request.includeRedacted);
    const includeFailed = request.includeFailed !== false;
    const includeTombstoned = Boolean(request.includeTombstoned);
    const limit = Math.max(request.limit ?? 50, 1);

    const pool = request.channel
      ? this.requireChannel(request.channel).ordered
      : CHANNELS.flatMap((channel) => this.requireChannel(channel).ordered);

    const cappedPool = pool.slice(-this.config.maxDrawerSearchScan);

    const matches: ChatTranscriptSearchMatch[] = [];
    for (const record of cappedPool) {
      if (!includeRedacted && record.state === 'REDACTED') continue;
      if (!includeFailed && record.state === 'FAILED') continue;
      if (!includeTombstoned && record.state === 'TOMBSTONED') continue;

      const reasons: string[] = [];
      let score = 0;

      if (fields.includes('body')) {
        const body = includeRedacted && record.redactedBody
          ? normalizeSearchText(record.redactedBody)
          : record.searchBody;

        if (body.includes(query)) {
          score += body === query ? 100 : 50;
          reasons.push('body');
        }
      }

      if (fields.includes('sender') && record.searchSender.includes(query)) {
        score += record.searchSender === query ? 80 : 40;
        reasons.push('sender');
      }

      if (fields.includes('proofHash') && normalizeSearchText(record.proofHash).includes(query)) {
        score += 60;
        reasons.push('proofHash');
      }

      if (fields.includes('messageId') && normalizeSearchText(record.messageId).includes(query)) {
        score += 60;
        reasons.push('messageId');
      }

      if (fields.includes('metadata')) {
        const metadataSearch = normalizeSearchText(stableStringify(record.metadata));
        if (metadataSearch.includes(query)) {
          score += 25;
          reasons.push('metadata');
        }
      }

      if (fields.includes('sceneId') && normalizeSearchText(record.sceneId).includes(query)) {
        score += 35;
        reasons.push('sceneId');
      }

      if (fields.includes('eventId')) {
        const eventSearch = normalizeSearchText(record.eventIds.join(' '));
        if (eventSearch.includes(query)) {
          score += 35;
          reasons.push('eventId');
        }
      }

      if (fields.includes('callbackRef')) {
        const callbackSearch = normalizeSearchText(stableStringify(record.callbackRefs));
        if (callbackSearch.includes(query)) {
          score += 30;
          reasons.push('callbackRef');
        }
      }

      if (fields.includes('rhetoricalTemplate')) {
        const rhetoricalSearch = normalizeSearchText(record.rhetoricalTemplateIds.join(' '));
        if (rhetoricalSearch.includes(query)) {
          score += 20;
          reasons.push('rhetoricalTemplate');
        }
      }

      if (fields.includes('semanticCluster')) {
        const semanticSearch = normalizeSearchText(record.semanticClusterIds.join(' '));
        if (semanticSearch.includes(query)) {
          score += 20;
          reasons.push('semanticCluster');
        }
      }

      if (score > 0) {
        matches.push({ record, score, reasons });
      }
    }

    const sorted = [...matches].sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if ((request.sort ?? 'TS_DESC') === 'TS_ASC') return compareRecordsAsc(left.record, right.record);
      return compareRecordsDesc(left.record, right.record);
    });

    return {
      query: request.query,
      matches: sorted.slice(0, limit),
      totalMatches: matches.length,
    };
  }

  public exportBundle(input: {
    mode: ChatTranscriptExportMode;
    channel?: ChatChannel;
    searchResponse?: ChatTranscriptSearchResponse;
    drawerPage?: ChatTranscriptDrawerPage;
  }): ChatTranscriptExportBundle {
    this.assertNotDestroyed('exportBundle');

    let records: ChatTranscriptRecord[] = [];
    switch (input.mode) {
      case 'VISIBLE_WINDOW':
        records = this.getVisibleWindow(input.channel ?? this.activeChannel);
        break;
      case 'CHANNEL_FULL':
        records = this.getRawWindow(input.channel ?? this.activeChannel)
          .filter((record) => record.state !== 'TOMBSTONED');
        break;
      case 'SEARCH_RESULTS':
        records = input.searchResponse?.matches.map((match) => match.record) ?? [];
        break;
      case 'DRAWER_PAGE':
        records = input.drawerPage?.records ?? [];
        break;
      case 'PROOF_ONLY':
        records = (input.channel
          ? this.getRawWindow(input.channel)
          : CHANNELS.flatMap((channel) => this.getRawWindow(channel)))
          .filter((record) => Boolean(record.proofHash));
        break;
      default:
        records = [];
    }

    const exportRecords = records.map(exportRecord);
    return {
      mode: input.mode,
      createdAt: now(),
      channel: input.channel,
      totalRecords: exportRecords.length,
      records: exportRecords,
      summary: {
        immutableCount: records.filter((record) => record.immutable).length,
        proofCount: records.filter((record) => Boolean(record.proofHash)).length,
        redactedCount: records.filter((record) => record.state === 'REDACTED' || record.redactedBody).length,
        failedCount: records.filter((record) => record.state === 'FAILED').length,
      },
    };
  }

  public toMessages(channel: ChatChannel = this.activeChannel): ChatMessage[] {
    return this.getVisibleWindow(channel).map(recordToMessage);
  }


  public annotateMessage(input: {
    channel: ChatChannel;
    messageId: string;
    annotation: ChatTranscriptSceneAnnotation;
  }): ChatTranscriptRecord | undefined {
    this.assertNotDestroyed('annotateMessage');

    const record = this.getMessage(input.messageId, input.channel);
    if (!record) return undefined;

    const state = this.requireChannel(input.channel);
    const annotation = input.annotation;

    if (annotation.sceneId) record.sceneId = normalizeText(annotation.sceneId) || record.sceneId;
    if (annotation.momentId) record.momentId = normalizeText(annotation.momentId) || record.momentId;
    if (annotation.canonicalLineId) {
      record.canonicalLineId = normalizeText(annotation.canonicalLineId) || record.canonicalLineId;
    }
    if (annotation.surfaceVariantId) {
      record.surfaceVariantId = normalizeText(annotation.surfaceVariantId) || record.surfaceVariantId;
    }
    if (annotation.realizationStrategy) {
      record.realizationStrategy = normalizeText(annotation.realizationStrategy) || record.realizationStrategy;
    }

    record.eventIds = mergeStringArrays(record.eventIds, annotation.eventIds);
    record.semanticClusterIds = mergeStringArrays(record.semanticClusterIds, annotation.semanticClusterIds);
    record.rhetoricalTemplateIds = mergeStringArrays(record.rhetoricalTemplateIds, annotation.rhetoricalTemplateIds);
    record.relatedMemoryAnchorIds = mergeStringArrays(
      record.relatedMemoryAnchorIds,
      annotation.relatedMemoryAnchorIds,
    );
    record.transcriptTags = mergeStringArrays(record.transcriptTags, annotation.transcriptTags);
    record.callbackRefs = mergeCallbackRefs(record.callbackRefs, annotation.callbackRefs);

    appendHistory(
      record,
      'manual_patch',
      `annotated:${record.sceneId ?? 'none'}:${record.momentId ?? 'none'}`,
    );

    this.bumpChannel(state, 'manual_patch');
    return record;
  }

  public annotateSceneBatch(input: {
    channel: ChatChannel;
    messageIds: readonly string[];
    annotation: ChatTranscriptSceneAnnotation;
  }): readonly ChatTranscriptRecord[] {
    this.assertNotDestroyed('annotateSceneBatch');

    const updated: ChatTranscriptRecord[] = [];
    for (const messageId of input.messageIds) {
      const record = this.annotateMessage({
        channel: input.channel,
        messageId,
        annotation: input.annotation,
      });
      if (record) updated.push(record);
    }
    return updated;
  }

  public getSceneRecords(
    sceneId: string,
    channel?: ChatChannel,
  ): readonly ChatTranscriptRecord[] {
    const normalized = normalizeText(sceneId);
    if (!normalized) return [];

    const pool = channel
      ? this.requireChannel(channel).ordered
      : CHANNELS.flatMap((candidate) => this.requireChannel(candidate).ordered);

    return pool.filter((record) => record.sceneId === normalized);
  }

  public getEventRecords(
    eventId: string,
    channel?: ChatChannel,
  ): readonly ChatTranscriptRecord[] {
    const normalized = normalizeText(eventId);
    if (!normalized) return [];

    const pool = channel
      ? this.requireChannel(channel).ordered
      : CHANNELS.flatMap((candidate) => this.requireChannel(candidate).ordered);

    return pool.filter((record) => record.eventIds.includes(normalized));
  }

  public getCallbackRecords(
    callbackId: string,
    channel?: ChatChannel,
  ): readonly ChatTranscriptRecord[] {
    const normalized = normalizeText(callbackId);
    if (!normalized) return [];

    const pool = channel
      ? this.requireChannel(channel).ordered
      : CHANNELS.flatMap((candidate) => this.requireChannel(candidate).ordered);

    return pool.filter((record) =>
      record.callbackRefs.some((ref) => ref.callbackId === normalized || ref.payloadRef === normalized),
    );
  }

  public getSemanticClusterWindow(
    semanticClusterId: string,
    channel?: ChatChannel,
  ): readonly ChatTranscriptRecord[] {
    const normalized = normalizeText(semanticClusterId);
    if (!normalized) return [];

    const pool = channel
      ? this.requireChannel(channel).ordered
      : CHANNELS.flatMap((candidate) => this.requireChannel(candidate).ordered);

    return pool.filter((record) => record.semanticClusterIds.includes(normalized));
  }

  // ---------------------------------------------------------------------------
  // Internal insertion pipeline
  // ---------------------------------------------------------------------------

  private noteInboundMessageWithReason(
    message: ChatMessage,
    reason: ChatTranscriptMutationReason,
  ): ChatTranscriptRecord {
    const state = this.requireChannel(message.channel);
    const record = createRecord(message, 'SERVER', reason);
    const existing = this.findMergeCandidate(state, record);

    if (existing) {
      this.patchRecord(
        existing,
        message,
        reason,
        'batch_merge',
        existing.immutable || record.immutable
          ? 'PREFER_IMMUTABLE'
          : 'PREFER_SERVER',
      );
      state.lastInboundAt = now();
      this.bumpChannel(state, reason);
      return existing;
    }

    this.insertRecord(state, record, reason);
    state.lastInboundAt = now();
    this.schedulePrune(state, reason);
    return record;
  }

  private createChannelState(channel: ChatChannel): InternalChannelState {
    return {
      channel,
      revision: 0,
      ordered: [],
      byMessageId: new Map(),
      byLocalId: new Map(),
      byProofHash: new Map(),
      bySenderId: new Map(),
      lastReplayAt: null,
      lastInboundAt: null,
      lastPrunedAt: null,
      replayToken: undefined,
      hasMoreBefore: false,
      hasMoreAfter: false,
    };
  }

  private insertRecord(
    state: InternalChannelState,
    record: ChatTranscriptRecord,
    reason: ChatTranscriptMutationReason,
  ): void {
    if (this.shouldDropDedup(record)) {
      return;
    }

    state.ordered.push(record);
    this.reindexRecord(state, record);
    this.resort(state);
    this.bumpChannel(state, reason);
    this.callbacks.onRecordInserted?.(state.channel, record, reason);
  }

  private patchRecord(
    record: ChatTranscriptRecord,
    next: ChatMessage,
    reason: ChatTranscriptMutationReason,
    historySummary: string,
    policy: ChatTranscriptConflictPolicy,
  ): void {
    const channelState = this.requireChannel(record.channel);

    const incomingBody = normalizeText(next.body);
    const incomingImmutable = Boolean(next.immutable);
    const incomingProofHash = normalizeText(next.proofHash) || undefined;
    const canReplaceBody = this.canReplaceBody(record, next, policy);

    if (policy === 'KEEP_BOTH') {
      const fork = createRecord(next, 'SERVER', reason);
      this.insertRecord(channelState, fork, reason);
      return;
    }

    if (policy === 'PREFER_SERVER' || canReplaceBody) {
      if (incomingBody) {
        record.body = incomingBody;
        record.searchBody = normalizeSearchText(incomingBody);
      }
      record.senderName = normalizeText(next.senderName) || record.senderName;
      record.senderRank = normalizeText(next.senderRank) || record.senderRank;
      record.emoji = normalizeText(next.emoji) || record.emoji;
      record.ts = safeTs(next.ts, record.ts);
      record.sortTs = safeTs(next.ts, record.sortTs);
      record.pressureTier = normalizeText(next.pressureTier) || record.pressureTier;
      record.tickTier = normalizeText(next.tickTier) || record.tickTier;
      record.runOutcome = normalizeText(next.runOutcome) || record.runOutcome;
      record.metadata = shallowMergeMetadata(record.metadata, next.metadata);
      if (incomingProofHash) record.proofHash = incomingProofHash;
      if (incomingImmutable) record.immutable = true;
      record.proofClass = inferProofClass({
        ...next,
        immutable: record.immutable,
        proofHash: record.proofHash,
      });
    } else if (policy === 'MERGE_METADATA') {
      record.metadata = shallowMergeMetadata(record.metadata, next.metadata);
      record.pressureTier = normalizeText(next.pressureTier) || record.pressureTier;
      record.tickTier = normalizeText(next.tickTier) || record.tickTier;
      record.runOutcome = normalizeText(next.runOutcome) || record.runOutcome;
      if (incomingProofHash) record.proofHash = incomingProofHash;
      if (incomingImmutable) record.immutable = true;
      record.proofClass = inferProofClass({
        ...next,
        immutable: record.immutable,
        proofHash: record.proofHash,
      });
    } else if (policy === 'PREFER_IMMUTABLE') {
      if (!record.immutable) {
        if (incomingBody) {
          record.body = incomingBody;
          record.searchBody = normalizeSearchText(incomingBody);
        }
      }
      if (incomingImmutable) record.immutable = true;
      if (incomingProofHash) record.proofHash = incomingProofHash;
      record.metadata = shallowMergeMetadata(record.metadata, next.metadata);
      record.proofClass = inferProofClass({
        ...next,
        immutable: record.immutable,
        proofHash: record.proofHash,
      });
    }

    if (record.state === 'OPTIMISTIC' || record.state === 'FAILED') {
      record.state = 'SERVER';
    }

    record.ackedServerId = normalizeText(next.id) || record.ackedServerId;
    record.messageId = record.ackedServerId ?? record.messageId;
    record.dedupKey = transcriptDedupKey({
      channel: record.channel,
      kind: record.kind as ChatMessageKind,
      body: record.body,
      senderId: record.senderId,
      proofHash: record.proofHash,
      ts: record.ts,
    });
    record.normalizedBody = normalizeText(record.redactedBody ?? record.body);

    appendHistory(record, reason, historySummary);
    this.reindexRecord(channelState, record);
    this.resort(channelState);
    this.bumpChannel(channelState, reason);
    this.callbacks.onRecordUpdated?.(channelState.channel, record, reason);
  }

  private canReplaceBody(
    record: ChatTranscriptRecord,
    next: ChatMessage,
    policy: ChatTranscriptConflictPolicy,
  ): boolean {
    if (policy === 'PREFER_SERVER') return true;
    if (policy === 'MERGE_METADATA') return false;
    if (policy === 'KEEP_BOTH') return false;

    if (!record.immutable) return true;
    if (!next.immutable) return false;

    const nextProofHash = normalizeText(next.proofHash) || undefined;
    if (!this.config.allowImmutableRebodyOnlyIfProofMatches) {
      return nextProofHash === record.proofHash && Boolean(nextProofHash);
    }

    return nextProofHash === record.proofHash;
  }

  private findMergeCandidate(
    state: InternalChannelState,
    record: ChatTranscriptRecord,
  ): ChatTranscriptRecord | undefined {
    if (record.messageId) {
      const byId = state.byMessageId.get(record.messageId);
      if (byId) return byId;
    }

    if (record.ackedServerId) {
      const byAckId = this.findByAckedServerId(state, record.ackedServerId);
      if (byAckId) return byAckId;
    }

    if (record.proofHash) {
      const byProof = state.byProofHash.get(record.proofHash);
      if (byProof) return byProof;
    }

    const timeFloor = record.sortTs - this.config.dedupWindowMs;
    const timeCeil = record.sortTs + this.config.dedupWindowMs;

    for (let i = state.ordered.length - 1; i >= 0; i -= 1) {
      const candidate = state.ordered[i];
      if (candidate.sortTs < timeFloor) break;
      if (candidate.sortTs > timeCeil) continue;
      if (
        candidate.channel === record.channel &&
        candidate.senderId === record.senderId &&
        candidate.kind === record.kind &&
        candidate.body === record.body
      ) {
        return candidate;
      }
    }

    return undefined;
  }

  private findByAckedServerId(
    state: InternalChannelState,
    ackedServerId: string,
  ): ChatTranscriptRecord | undefined {
    for (const record of state.ordered) {
      if (record.ackedServerId === ackedServerId) return record;
    }
    return undefined;
  }

  private reindexRecord(
    state: InternalChannelState,
    record: ChatTranscriptRecord,
  ): void {
    state.byLocalId.set(record.localId, record);
    state.byMessageId.set(record.messageId, record);

    if (record.ackedServerId) {
      state.byMessageId.set(record.ackedServerId, record);
    }

    if (record.proofHash) {
      state.byProofHash.set(record.proofHash, record);
    }

    const bucket = state.bySenderId.get(record.senderId) ?? [];
    if (!bucket.includes(record)) {
      bucket.push(record);
      state.bySenderId.set(record.senderId, bucket);
    }
  }

  private deindexRecord(
    state: InternalChannelState,
    record: ChatTranscriptRecord,
  ): void {
    state.byLocalId.delete(record.localId);
    state.byMessageId.delete(record.messageId);
    if (record.ackedServerId) state.byMessageId.delete(record.ackedServerId);
    if (record.proofHash) state.byProofHash.delete(record.proofHash);

    const bucket = state.bySenderId.get(record.senderId);
    if (bucket) {
      const next = bucket.filter((candidate) => candidate.localId !== record.localId);
      if (next.length === 0) state.bySenderId.delete(record.senderId);
      else state.bySenderId.set(record.senderId, next);
    }
  }

  private resort(state: InternalChannelState): void {
    state.ordered.sort(compareRecordsAsc);
  }

  private schedulePrune(
    state: InternalChannelState,
    reason: ChatTranscriptMutationReason,
  ): void {
    const ledger = cloneLedger(state);
    if (ledger.recordCount <= this.config.maxWindowPerChannel) {
      return;
    }

    const removable = this.buildPruneList(state, ledger.recordCount - this.config.maxWindowPerChannel);
    if (removable.length === 0) return;

    for (const record of removable) {
      this.removeRecord(state, record, reason);
    }

    state.lastPrunedAt = now();
    this.bumpChannel(state, 'prune');
  }

  private buildPruneList(
    state: InternalChannelState,
    targetCount: number,
  ): ChatTranscriptRecord[] {
    const removable: ChatTranscriptRecord[] = [];
    let proofsRetained = state.ordered.filter((record) => Boolean(record.proofHash)).length;

    for (const record of state.ordered) {
      if (removable.length >= targetCount) break;

      if (record.state === 'OPTIMISTIC') continue;
      if (record.state === 'FAILED' && this.config.keepFailedMessages) continue;
      if (record.immutable) continue;
      if (record.proofHash && proofsRetained <= this.config.proofRetentionFloor) continue;
      if (
        this.config.preserveSystemReceipts &&
        record.proofClass === 'SYSTEM_RECEIPT'
      ) continue;

      removable.push(record);
      if (record.proofHash) proofsRetained -= 1;
    }

    return removable;
  }

  private removeRecord(
    state: InternalChannelState,
    record: ChatTranscriptRecord,
    reason: ChatTranscriptMutationReason,
  ): void {
    const index = state.ordered.findIndex((candidate) => candidate.localId === record.localId);
    if (index >= 0) {
      state.ordered.splice(index, 1);
    }

    this.deindexRecord(state, record);
    appendHistory(record, 'prune', `pruned:${reason}`);
    this.callbacks.onRecordPruned?.(state.channel, record, 'prune');
  }

  private shouldDropDedup(record: ChatTranscriptRecord): boolean {
    const expiresAt = now() + this.config.dedupWindowMs;

    for (let i = this.dedupEntries.length - 1; i >= 0; i -= 1) {
      const entry = this.dedupEntries[i];
      if (entry.expiresAt <= now()) {
        this.dedupEntries.splice(i, 1);
        continue;
      }
      if (entry.key === record.dedupKey && entry.channel === record.channel) {
        return true;
      }
    }

    this.dedupEntries.push({
      key: record.dedupKey,
      channel: record.channel,
      expiresAt,
    });

    if (this.dedupEntries.length > this.config.dedupCacheLimit) {
      this.dedupEntries.splice(0, this.dedupEntries.length - this.config.dedupCacheLimit);
    }

    return false;
  }

  private compactDedup(): void {
    const current = now();
    for (let i = this.dedupEntries.length - 1; i >= 0; i -= 1) {
      if (this.dedupEntries[i].expiresAt <= current) {
        this.dedupEntries.splice(i, 1);
      }
    }
  }

  private expireStaleOptimisticRecords(): void {
    if (this.destroyed) return;

    const threshold = now() - this.config.optimisticTimeoutMs;
    for (const channel of CHANNELS) {
      const state = this.requireChannel(channel);
      let changed = false;
      for (const record of state.ordered) {
        if (record.state !== 'OPTIMISTIC') continue;
        if (record.insertedAt >= threshold) continue;

        record.state = 'FAILED';
        appendHistory(record, 'manual_patch', 'optimistic_timeout');
        changed = true;
      }

      if (changed) {
        this.bumpChannel(state, 'manual_patch');
      }
    }
  }

  private pruneTombstones(): void {
    if (this.destroyed) return;

    const threshold = now() - this.config.pruneTombstonesAfterMs;
    for (const channel of CHANNELS) {
      const state = this.requireChannel(channel);
      const removable = state.ordered.filter((record) => {
        if (record.state !== 'TOMBSTONED') return false;
        return record.lastMutatedAt <= threshold;
      });

      if (removable.length === 0) continue;

      for (const record of removable) {
        this.removeRecord(state, record, 'prune');
      }
      state.lastPrunedAt = now();
      this.bumpChannel(state, 'prune');
    }
  }

  private bumpChannel(
    state: InternalChannelState,
    reason: ChatTranscriptMutationReason,
  ): void {
    state.revision += 1;
    const ledger = cloneLedger(state);
    this.callbacks.onChannelChanged?.(state.channel, ledger, reason);
    this.emitSnapshot();
  }

  private emitSnapshot(): void {
    this.callbacks.onSnapshotChanged?.(this.getSnapshot());
  }

  private requireChannel(channel: ChatChannel): InternalChannelState {
    const state = this.channels.get(channel);
    if (!state) throw createError(`Unknown channel: ${channel}`);
    return state;
  }

  private assertNotDestroyed(operation: string): void {
    if (this.destroyed) {
      throw createError(`${operation} called after destroy().`);
    }
  }
}
