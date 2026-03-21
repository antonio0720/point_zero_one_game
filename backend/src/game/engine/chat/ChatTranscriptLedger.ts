
/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT TRANSCRIPT LEDGER
 * FILE: backend/src/game/engine/chat/ChatTranscriptLedger.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Transcript append / reveal / redact / delete / query / audit authority for
 * backend chat truth.
 *
 * The reducer mutates state. The message factory stamps messages. This ledger
 * governs how transcript history is written and read as durable backend truth.
 *
 * It is intentionally not just a list helper. It is the backend memory substrate
 * for:
 *
 * - visible versus shadow transcript law,
 * - replay window anchoring,
 * - sequence continuity auditing,
 * - retention and compaction,
 * - pagination and transcript-range retrieval,
 * - reveal queue promotion,
 * - callback-memory and after-action lookup,
 * - moderation-safe redaction and soft deletion.
 *
 * Design law
 * ----------
 * - The ledger never accepts raw client intent as transcript truth.
 * - It only accepts canonical ChatMessage values.
 * - It preserves auditability when messages are revised, redacted, or deleted.
 * - It favors deterministic reconstruction over convenience.
 * ============================================================================
 */

import {
  CHAT_CHANNEL_DESCRIPTORS,
  CHAT_RUNTIME_DEFAULTS,
  asSequenceNumber,
  asUnixMs,
  type ChatChannelId,
  type ChatEventId,
  type ChatMessage,
  type ChatMessageId,
  type ChatPendingReveal,
  type ChatProofEdge,
  type ChatReplayArtifact,
  type ChatReplayId,
  type ChatRequestId,
  type ChatRoomId,
  type ChatRoomState,
  type ChatRuntimeConfig,
  type ChatState,
  type ChatTranscriptEntry,
  type ChatTypingSnapshot,
  type ChatVisibleChannel,
  type JsonValue,
  type SequenceNumber,
  type UnixMs,
} from './types';
import {
  appendTranscriptMessage,
  cloneChatState,
  createPendingReveal,
  createTranscriptEntry,
  nextSequenceForRoom,
  redactTranscriptMessage,
  removeTranscriptMessageHard,
  replaceTranscriptMessage,
  selectLatestMessage,
  selectMostRecentReplayAroundSequence,
  selectRoom,
  selectRoomProofEdges,
  selectRoomReplayArtifacts,
  selectRoomTranscript,
  softDeleteTranscriptMessage,
} from './ChatState';

// ============================================================================
// MARK: Ledger configuration and result contracts
// ============================================================================

export interface ChatTranscriptLedgerOptions {
  readonly runtime?: Partial<ChatRuntimeConfig>;
}

export interface ChatTranscriptWriteResult {
  readonly state: ChatState;
  readonly entry: ChatTranscriptEntry;
  readonly evictedEntries: readonly ChatTranscriptEntry[];
  readonly sequenceGapDetected: boolean;
  readonly warnings: readonly string[];
}

export interface ChatTranscriptWriteManyResult {
  readonly state: ChatState;
  readonly entries: readonly ChatTranscriptEntry[];
  readonly evictedEntries: readonly ChatTranscriptEntry[];
  readonly warnings: readonly string[];
}

export interface ChatTranscriptRevisionResult {
  readonly state: ChatState;
  readonly previous: ChatTranscriptEntry | null;
  readonly current: ChatTranscriptEntry | null;
  readonly changed: boolean;
}

export interface ChatTranscriptRevealResult {
  readonly state: ChatState;
  readonly revealed: readonly ChatTranscriptEntry[];
  readonly remaining: readonly ChatPendingReveal[];
}

export interface ChatTranscriptRoomWindow {
  readonly roomId: ChatRoomId;
  readonly entries: readonly ChatTranscriptEntry[];
  readonly startSequence: SequenceNumber;
  readonly endSequence: SequenceNumber;
}

export interface ChatTranscriptCursor {
  readonly roomId: ChatRoomId;
  readonly anchorMessageId: ChatMessageId | null;
  readonly anchorSequence: SequenceNumber;
  readonly direction: 'OLDER' | 'NEWER';
}

export interface ChatTranscriptPage {
  readonly roomId: ChatRoomId;
  readonly entries: readonly ChatTranscriptEntry[];
  readonly cursor: ChatTranscriptCursor | null;
  readonly hasMoreOlder: boolean;
  readonly hasMoreNewer: boolean;
}

export interface ChatTranscriptSequenceAuditIssue {
  readonly code:
    | 'DUPLICATE_SEQUENCE'
    | 'NON_MONOTONIC_SEQUENCE'
    | 'ROOM_INDEX_MISMATCH'
    | 'MISSING_BY_MESSAGE_ID'
    | 'STALE_LAST_SEQUENCE'
    | 'ORPHANED_BY_MESSAGE_ID';
  readonly severity: 'ERROR' | 'WARN';
  readonly roomId: ChatRoomId | null;
  readonly messageId: ChatMessageId | null;
  readonly detail: string;
}

export interface ChatTranscriptSequenceAudit {
  readonly roomId: ChatRoomId;
  readonly issues: readonly ChatTranscriptSequenceAuditIssue[];
  readonly expectedLastSequence: SequenceNumber;
  readonly actualLastSequence: SequenceNumber;
  readonly messageCount: number;
}

export interface ChatTranscriptAuditSummary {
  readonly issues: readonly ChatTranscriptSequenceAuditIssue[];
  readonly byRoom: Readonly<Record<ChatRoomId, ChatTranscriptSequenceAudit>>;
}

export interface ChatTranscriptRetentionResult {
  readonly state: ChatState;
  readonly removedEntries: readonly ChatTranscriptEntry[];
  readonly keptEntries: readonly ChatTranscriptEntry[];
}

export interface ChatTranscriptSearchHit {
  readonly roomId: ChatRoomId;
  readonly entry: ChatTranscriptEntry;
  readonly score: number;
  readonly matchedTerms: readonly string[];
}

export interface ChatTranscriptExportLine {
  readonly roomId: ChatRoomId;
  readonly sequenceNumber: SequenceNumber;
  readonly timestamp: UnixMs;
  readonly author: string;
  readonly channelId: ChatChannelId;
  readonly visibility: ChatTranscriptEntry['visibility'];
  readonly plainText: string;
}

export interface ChatTranscriptWriteBatchItem {
  readonly message: ChatMessage;
  readonly dedupeByMessageId?: boolean;
}

// ============================================================================
// MARK: Ledger bootstrap
// ============================================================================

export function createChatTranscriptLedger(options: ChatTranscriptLedgerOptions = {}) {
  const runtime = mergeRuntime(options.runtime);

  return {
    runtime,
    append(state: ChatState, message: ChatMessage): ChatTranscriptWriteResult {
      return appendToTranscript(runtime, state, message);
    },
    appendMany(state: ChatState, messages: readonly ChatMessage[]): ChatTranscriptWriteManyResult {
      return appendManyToTranscript(runtime, state, messages);
    },
    appendBatch(state: ChatState, items: readonly ChatTranscriptWriteBatchItem[]): ChatTranscriptWriteManyResult {
      return appendBatch(runtime, state, items);
    },
    replace(state: ChatState, message: ChatMessage): ChatTranscriptRevisionResult {
      return replaceInTranscript(state, message);
    },
    redact(state: ChatState, messageId: ChatMessageId, now?: UnixMs): ChatTranscriptRevisionResult {
      return redactInTranscript(state, messageId, now ?? asUnixMs(Date.now()));
    },
    softDelete(state: ChatState, messageId: ChatMessageId, now?: UnixMs): ChatTranscriptRevisionResult {
      return softDeleteInTranscript(state, messageId, now ?? asUnixMs(Date.now()));
    },
    hardDelete(state: ChatState, messageId: ChatMessageId): ChatTranscriptRevisionResult {
      return hardDeleteInTranscript(state, messageId);
    },
    queueReveal(state: ChatState, reveal: ChatPendingReveal): ChatState {
      return queueReveal(state, reveal);
    },
    drainRevealsDue(state: ChatState, now?: UnixMs): ChatTranscriptRevealResult {
      return drainRevealsDue(runtime, state, now ?? asUnixMs(Date.now()));
    },
    getRoomWindow(state: ChatState, roomId: ChatRoomId, start: number, end: number): ChatTranscriptRoomWindow {
      return getRoomWindow(state, roomId, start, end);
    },
    getPageAroundMessage(
      state: ChatState,
      roomId: ChatRoomId,
      messageId: ChatMessageId | null,
      pageSize: number,
    ): ChatTranscriptPage {
      return getPageAroundMessage(state, roomId, messageId, pageSize);
    },
    getVisiblePage(state: ChatState, roomId: ChatRoomId, pageSize: number, cursor?: ChatTranscriptCursor | null): ChatTranscriptPage {
      return getChannelPage(state, roomId, 'VISIBLE', pageSize, cursor ?? null);
    },
    getShadowPage(state: ChatState, roomId: ChatRoomId, pageSize: number, cursor?: ChatTranscriptCursor | null): ChatTranscriptPage {
      return getChannelPage(state, roomId, 'SHADOW', pageSize, cursor ?? null);
    },
    getReplayWindow(state: ChatState, roomId: ChatRoomId, replayId: ChatReplayId): ChatTranscriptRoomWindow | null {
      return getReplayWindow(state, roomId, replayId);
    },
    getAroundSequence(state: ChatState, roomId: ChatRoomId, sequenceNumber: SequenceNumber, radius: number): ChatTranscriptRoomWindow {
      return getAroundSequence(state, roomId, sequenceNumber, radius);
    },
    search(state: ChatState, roomId: ChatRoomId | null, query: string, limit = 20): readonly ChatTranscriptSearchHit[] {
      return searchTranscript(state, roomId, query, limit);
    },
    exportLines(state: ChatState, roomId: ChatRoomId): readonly ChatTranscriptExportLine[] {
      return exportTranscriptLines(state, roomId);
    },
    auditRoom(state: ChatState, roomId: ChatRoomId): ChatTranscriptSequenceAudit {
      return auditRoomSequences(state, roomId);
    },
    auditAll(state: ChatState): ChatTranscriptAuditSummary {
      return auditAllRooms(state);
    },
    compactRoom(state: ChatState, roomId: ChatRoomId): ChatTranscriptRetentionResult {
      return compactRoomByRetention(runtime, state, roomId);
    },
    compactAll(state: ChatState): ChatTranscriptRetentionResult {
      return compactAllRooms(runtime, state);
    },
  };
}

export type ChatTranscriptLedgerApi = ReturnType<typeof createChatTranscriptLedger>;

// ============================================================================
// MARK: Append / replace / reveal operations
// ============================================================================

export function appendToTranscript(
  runtime: ChatRuntimeConfig,
  state: ChatState,
  message: ChatMessage,
): ChatTranscriptWriteResult {
  const room = requireRoom(state, message.roomId);
  const previousEntries = selectRoomTranscript(state, room.roomId);
  const nextExpectedSequence = asSequenceNumber(Number(previousEntries.at(-1)?.message.sequenceNumber ?? asSequenceNumber(0)) + 1);
  const warnings: string[] = [];

  if (Number(message.sequenceNumber) !== Number(nextExpectedSequence)) {
    warnings.push(
      `Transcript append sequence mismatch for room ${String(room.roomId)}. Expected ${String(nextExpectedSequence)} got ${String(message.sequenceNumber)}.`,
    );
  }

  const beforeIds = new Set(previousEntries.map((entry) => String(entry.message.id)));
  let next = appendTranscriptMessage(state, message);
  const afterEntries = selectRoomTranscript(next, room.roomId);
  const evictedEntries = previousEntries.filter((entry) => !afterEntries.some((candidate) => candidate.message.id === entry.message.id));

  next = enforceRoomRetention(runtime, next, room.roomId);
  const entry = next.transcript.byMessageId[message.id] ?? createTranscriptEntry(message);

  if (beforeIds.has(String(message.id))) {
    warnings.push(`Message ${String(message.id)} already existed in transcript before append.`);
  }

  return {
    state: next,
    entry,
    evictedEntries,
    sequenceGapDetected: warnings.length > 0,
    warnings,
  };
}

export function appendManyToTranscript(
  runtime: ChatRuntimeConfig,
  state: ChatState,
  messages: readonly ChatMessage[],
): ChatTranscriptWriteManyResult {
  let next = state;
  const entries: ChatTranscriptEntry[] = [];
  const evictedEntries: ChatTranscriptEntry[] = [];
  const warnings: string[] = [];

  for (const message of stableSortMessages(messages)) {
    const result = appendToTranscript(runtime, next, message);
    next = result.state;
    entries.push(result.entry);
    evictedEntries.push(...result.evictedEntries);
    warnings.push(...result.warnings);
  }

  return {
    state: next,
    entries,
    evictedEntries: dedupeEntries(evictedEntries),
    warnings: uniqueStrings(warnings),
  };
}

export function appendBatch(
  runtime: ChatRuntimeConfig,
  state: ChatState,
  items: readonly ChatTranscriptWriteBatchItem[],
): ChatTranscriptWriteManyResult {
  const filtered: ChatMessage[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const key = String(item.message.id);
    if (item.dedupeByMessageId && seen.has(key)) {
      continue;
    }
    seen.add(key);
    filtered.push(item.message);
  }

  return appendManyToTranscript(runtime, state, filtered);
}

export function replaceInTranscript(state: ChatState, message: ChatMessage): ChatTranscriptRevisionResult {
  const previous = state.transcript.byMessageId[message.id] ?? null;
  if (!previous) {
    const next = appendTranscriptMessage(state, message);
    return {
      state: next,
      previous: null,
      current: next.transcript.byMessageId[message.id] ?? null,
      changed: true,
    };
  }

  const next = replaceTranscriptMessage(state, message);
  return {
    state: next,
    previous,
    current: next.transcript.byMessageId[message.id] ?? null,
    changed: true,
  };
}

export function redactInTranscript(state: ChatState, messageId: ChatMessageId, now: UnixMs): ChatTranscriptRevisionResult {
  const previous = state.transcript.byMessageId[messageId] ?? null;
  if (!previous) {
    return { state, previous: null, current: null, changed: false };
  }

  const next = redactTranscriptMessage(state, messageId, now);
  return {
    state: next,
    previous,
    current: next.transcript.byMessageId[messageId] ?? null,
    changed: true,
  };
}

export function softDeleteInTranscript(state: ChatState, messageId: ChatMessageId, now: UnixMs): ChatTranscriptRevisionResult {
  const previous = state.transcript.byMessageId[messageId] ?? null;
  if (!previous) {
    return { state, previous: null, current: null, changed: false };
  }

  const next = softDeleteTranscriptMessage(state, messageId, now);
  return {
    state: next,
    previous,
    current: next.transcript.byMessageId[messageId] ?? null,
    changed: true,
  };
}

export function hardDeleteInTranscript(state: ChatState, messageId: ChatMessageId): ChatTranscriptRevisionResult {
  const previous = state.transcript.byMessageId[messageId] ?? null;
  if (!previous) {
    return { state, previous: null, current: null, changed: false };
  }

  const next = removeTranscriptMessageHard(state, messageId);
  return {
    state: next,
    previous,
    current: next.transcript.byMessageId[messageId] ?? null,
    changed: true,
  };
}

export function queueReveal(state: ChatState, reveal: ChatPendingReveal): ChatState {
  const nextReveals = [...state.pendingReveals, reveal].sort((a, b) => Number(a.revealAt) - Number(b.revealAt));
  return {
    ...state,
    pendingReveals: nextReveals,
  };
}

export function drainRevealsDue(
  runtime: ChatRuntimeConfig,
  state: ChatState,
  now: UnixMs,
): ChatTranscriptRevealResult {
  const due = state.pendingReveals.filter((reveal: ChatPendingReveal) => Number(reveal.revealAt) <= Number(now));
  const remaining = state.pendingReveals.filter((reveal: ChatPendingReveal) => Number(reveal.revealAt) > Number(now));

  if (due.length === 0) {
    return {
      state,
      revealed: [],
      remaining,
    };
  }

  let next: ChatState = {
    ...state,
    pendingReveals: remaining,
  };

  const revealed: ChatTranscriptEntry[] = [];
  for (const reveal of due) {
    const result = appendToTranscript(runtime, next, reveal.message);
    next = result.state;
    revealed.push(result.entry);
  }

  return {
    state: next,
    revealed,
    remaining: next.pendingReveals,
  };
}

// ============================================================================
// MARK: Query surfaces
// ============================================================================

export function getRoomWindow(
  state: ChatState,
  roomId: ChatRoomId,
  start: number,
  end: number,
): ChatTranscriptRoomWindow {
  const entries = selectRoomTranscript(state, roomId);
  const safeStart = Math.max(0, Math.min(entries.length, start));
  const safeEnd = Math.max(safeStart, Math.min(entries.length, end + 1));
  const slice = entries.slice(safeStart, safeEnd);
  return {
    roomId,
    entries: slice,
    startSequence: slice[0]?.message.sequenceNumber ?? asSequenceNumber(0),
    endSequence: slice.at(-1)?.message.sequenceNumber ?? asSequenceNumber(0),
  };
}

export function getPageAroundMessage(
  state: ChatState,
  roomId: ChatRoomId,
  messageId: ChatMessageId | null,
  pageSize: number,
): ChatTranscriptPage {
  const entries = selectRoomTranscript(state, roomId);
  const size = Math.max(1, Math.floor(pageSize));
  if (entries.length === 0) {
    return emptyPage(roomId);
  }

  const anchorIndex = messageId
    ? entries.findIndex((entry) => entry.message.id === messageId)
    : entries.length - 1;

  const resolvedAnchor = anchorIndex >= 0 ? anchorIndex : entries.length - 1;
  const half = Math.floor(size / 2);
  const start = Math.max(0, resolvedAnchor - half);
  const end = Math.min(entries.length, start + size);
  const slice = entries.slice(start, end);

  return {
    roomId,
    entries: slice,
    cursor: makeCursor(roomId, slice.at(-1)?.message ?? null, 'OLDER'),
    hasMoreOlder: start > 0,
    hasMoreNewer: end < entries.length,
  };
}

export function getChannelPage(
  state: ChatState,
  roomId: ChatRoomId,
  visibility: ChatTranscriptEntry['visibility'],
  pageSize: number,
  cursor: ChatTranscriptCursor | null,
): ChatTranscriptPage {
  const entries = selectRoomTranscript(state, roomId).filter((entry) => entry.visibility === visibility);
  const size = Math.max(1, Math.floor(pageSize));
  if (entries.length === 0) {
    return emptyPage(roomId);
  }

  let anchorIndex = entries.length - 1;
  if (cursor?.anchorMessageId) {
    const found = entries.findIndex((entry) => entry.message.id === cursor.anchorMessageId);
    if (found >= 0) {
      anchorIndex = cursor.direction === 'OLDER' ? Math.max(0, found - 1) : Math.min(entries.length - 1, found + 1);
    }
  }

  const start = Math.max(0, anchorIndex - size + 1);
  const end = Math.min(entries.length, start + size);
  const slice = entries.slice(start, end);

  return {
    roomId,
    entries: slice,
    cursor: makeCursor(roomId, slice[0]?.message ?? null, 'OLDER'),
    hasMoreOlder: start > 0,
    hasMoreNewer: end < entries.length,
  };
}

export function getReplayWindow(
  state: ChatState,
  roomId: ChatRoomId,
  replayId: ChatReplayId,
): ChatTranscriptRoomWindow | null {
  const replay = selectRoomReplayArtifacts(state, roomId).find((artifact) => artifact.id === replayId);
  if (!replay) {
    return null;
  }
  return getRoomWindow(state, roomId, replay.range.start, replay.range.end);
}

export function getAroundSequence(
  state: ChatState,
  roomId: ChatRoomId,
  sequenceNumber: SequenceNumber,
  radius: number,
): ChatTranscriptRoomWindow {
  const entries = selectRoomTranscript(state, roomId);
  const index = entries.findIndex((entry) => Number(entry.message.sequenceNumber) >= Number(sequenceNumber));
  const resolved = index >= 0 ? index : Math.max(0, entries.length - 1);
  const safeRadius = Math.max(0, Math.floor(radius));
  return getRoomWindow(state, roomId, resolved - safeRadius, resolved + safeRadius);
}

export function searchTranscript(
  state: ChatState,
  roomId: ChatRoomId | null,
  query: string,
  limit: number,
): readonly ChatTranscriptSearchHit[] {
  const terms = tokenize(query);
  if (terms.length === 0) {
    return [];
  }

  const hits: ChatTranscriptSearchHit[] = [];
  const roomIds = roomId ? [roomId] : Object.keys(state.transcript.byRoom) as ChatRoomId[];

  for (const id of roomIds) {
    const entries = selectRoomTranscript(state, id);
    for (const entry of entries) {
      const haystack = buildSearchHaystack(entry.message);
      const matchedTerms = terms.filter((term) => haystack.includes(term));
      if (matchedTerms.length === 0) {
        continue;
      }
      const score = scoreSearchHit(entry.message, matchedTerms);
      hits.push({ roomId: id, entry, score, matchedTerms });
    }
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, Math.max(1, Math.floor(limit)));
}

export function exportTranscriptLines(state: ChatState, roomId: ChatRoomId): readonly ChatTranscriptExportLine[] {
  return selectRoomTranscript(state, roomId).map((entry) => ({
    roomId,
    sequenceNumber: entry.message.sequenceNumber,
    timestamp: entry.message.createdAt,
    author: entry.message.attribution.displayName,
    channelId: entry.message.channelId,
    visibility: entry.visibility,
    plainText: entry.message.plainText,
  }));
}

// ============================================================================
// MARK: Audit and repair
// ============================================================================

export function auditRoomSequences(state: ChatState, roomId: ChatRoomId): ChatTranscriptSequenceAudit {
  const entries = selectRoomTranscript(state, roomId);
  const issues: ChatTranscriptSequenceAuditIssue[] = [];
  const seenSequence = new Set<number>();
  let previous = 0;

  for (const entry of entries) {
    const sequence = Number(entry.message.sequenceNumber);
    if (seenSequence.has(sequence)) {
      issues.push({
        code: 'DUPLICATE_SEQUENCE',
        severity: 'ERROR',
        roomId,
        messageId: entry.message.id,
        detail: `Duplicate sequence ${sequence} in room ${String(roomId)}.`,
      });
    }
    seenSequence.add(sequence);

    if (sequence < previous) {
      issues.push({
        code: 'NON_MONOTONIC_SEQUENCE',
        severity: 'ERROR',
        roomId,
        messageId: entry.message.id,
        detail: `Sequence ${sequence} followed ${previous} in descending order.`,
      });
    }

    previous = sequence;

    const byMessageId = state.transcript.byMessageId[entry.message.id];
    if (!byMessageId) {
      issues.push({
        code: 'MISSING_BY_MESSAGE_ID',
        severity: 'ERROR',
        roomId,
        messageId: entry.message.id,
        detail: 'Entry exists in byRoom but is missing in byMessageId.',
      });
    }
  }

  for (const [messageId, entry] of Object.entries(state.transcript.byMessageId) as [ChatMessageId, ChatTranscriptEntry][]) {
    if (entry.message.roomId !== roomId) {
      continue;
    }
    if (!entries.some((candidate) => candidate.message.id === messageId)) {
      issues.push({
        code: 'ORPHANED_BY_MESSAGE_ID',
        severity: 'WARN',
        roomId,
        messageId,
        detail: 'Entry exists in byMessageId but not in room transcript.',
      });
    }
  }

  const actualLastSequence = entries.at(-1)?.message.sequenceNumber ?? asSequenceNumber(0);
  const expectedLastSequence = state.transcript.lastSequenceByRoom[roomId] ?? asSequenceNumber(0);
  if (Number(actualLastSequence) !== Number(expectedLastSequence)) {
    issues.push({
      code: 'STALE_LAST_SEQUENCE',
      severity: 'WARN',
      roomId,
      messageId: entries.at(-1)?.message.id ?? null,
      detail: `lastSequenceByRoom stores ${String(expectedLastSequence)} but transcript tail is ${String(actualLastSequence)}.`,
    });
  }

  return {
    roomId,
    issues,
    expectedLastSequence,
    actualLastSequence,
    messageCount: entries.length,
  };
}

export function auditAllRooms(state: ChatState): ChatTranscriptAuditSummary {
  const roomIds = Object.keys(state.transcript.byRoom) as ChatRoomId[];
  const byRoom: Record<ChatRoomId, ChatTranscriptSequenceAudit> = {};
  const issues: ChatTranscriptSequenceAuditIssue[] = [];

  for (const roomId of roomIds) {
    const audit = auditRoomSequences(state, roomId);
    byRoom[roomId] = audit;
    issues.push(...audit.issues);
  }

  return { issues, byRoom };
}

export function repairRoomSequenceIndex(state: ChatState, roomId: ChatRoomId): ChatState {
  const entries = selectRoomTranscript(state, roomId);
  const lastSequence = entries.at(-1)?.message.sequenceNumber ?? asSequenceNumber(0);
  return {
    ...state,
    transcript: {
      ...state.transcript,
      lastSequenceByRoom: {
        ...state.transcript.lastSequenceByRoom,
        [roomId]: lastSequence,
      },
    },
  };
}

export function rebuildTranscriptByMessageIndex(state: ChatState, roomId: ChatRoomId): ChatState {
  const entries = selectRoomTranscript(state, roomId);
  const rebuilt = { ...state.transcript.byMessageId } as Record<ChatMessageId, ChatTranscriptEntry>;

  for (const entry of entries) {
    rebuilt[entry.message.id] = entry;
  }

  return {
    ...state,
    transcript: {
      ...state.transcript,
      byMessageId: rebuilt,
    },
  };
}

// ============================================================================
// MARK: Retention and compaction
// ============================================================================

export function compactRoomByRetention(
  runtime: ChatRuntimeConfig,
  state: ChatState,
  roomId: ChatRoomId,
): ChatTranscriptRetentionResult {
  const entries = selectRoomTranscript(state, roomId);
  const maxMessages = runtime.replayPolicy.maxMessagesPerRoom;
  if (entries.length <= maxMessages) {
    return {
      state,
      removedEntries: [],
      keptEntries: entries,
    };
  }

  const keep = entries.slice(-maxMessages);
  const remove = entries.slice(0, Math.max(0, entries.length - maxMessages));
  let next = cloneChatState(state);

  next = {
    ...next,
    transcript: {
      ...next.transcript,
      byRoom: {
        ...next.transcript.byRoom,
        [roomId]: keep,
      },
      byMessageId: stripEntriesFromIndex(next.transcript.byMessageId, remove),
      lastSequenceByRoom: {
        ...next.transcript.lastSequenceByRoom,
        [roomId]: keep.at(-1)?.message.sequenceNumber ?? asSequenceNumber(0),
      },
    },
  };

  return {
    state: next,
    removedEntries: remove,
    keptEntries: keep,
  };
}

export function compactAllRooms(
  runtime: ChatRuntimeConfig,
  state: ChatState,
): ChatTranscriptRetentionResult {
  let next = state;
  const removedEntries: ChatTranscriptEntry[] = [];
  let keptEntries: ChatTranscriptEntry[] = [];

  for (const roomId of Object.keys(state.transcript.byRoom) as ChatRoomId[]) {
    const result = compactRoomByRetention(runtime, next, roomId);
    next = result.state;
    removedEntries.push(...result.removedEntries);
    keptEntries = keptEntries.concat(result.keptEntries);
  }

  return { state: next, removedEntries, keptEntries };
}

function enforceRoomRetention(runtime: ChatRuntimeConfig, state: ChatState, roomId: ChatRoomId): ChatState {
  return compactRoomByRetention(runtime, state, roomId).state;
}

// ============================================================================
// MARK: Replay / proof helpers built on transcript
// ============================================================================

export function getMostRelevantReplayForMessage(
  state: ChatState,
  message: ChatMessage,
): ChatReplayArtifact | null {
  return selectMostRecentReplayAroundSequence(state, message.roomId, message.sequenceNumber);
}

export function collectProofEdgesForMessage(
  state: ChatState,
  roomId: ChatRoomId,
  messageId: ChatMessageId,
): readonly ChatProofEdge[] {
  return selectRoomProofEdges(state, roomId).filter((edge) => edge.fromMessageId === messageId || edge.toMessageId === messageId);
}

export function collectConversationWindowForMessage(
  state: ChatState,
  roomId: ChatRoomId,
  messageId: ChatMessageId,
  radius: number,
): ChatTranscriptRoomWindow | null {
  const entries = selectRoomTranscript(state, roomId);
  const index = entries.findIndex((entry) => entry.message.id === messageId);
  if (index < 0) {
    return null;
  }
  return getRoomWindow(state, roomId, index - Math.max(0, radius), index + Math.max(0, radius));
}

export function collectLatestVisibleWindow(
  state: ChatState,
  roomId: ChatRoomId,
  size: number,
): ChatTranscriptRoomWindow {
  const entries = selectRoomTranscript(state, roomId).filter((entry) => entry.visibility === 'VISIBLE');
  const safeSize = Math.max(1, Math.floor(size));
  const slice = entries.slice(-safeSize);
  return {
    roomId,
    entries: slice,
    startSequence: slice[0]?.message.sequenceNumber ?? asSequenceNumber(0),
    endSequence: slice.at(-1)?.message.sequenceNumber ?? asSequenceNumber(0),
  };
}

export function collectLatestShadowWindow(
  state: ChatState,
  roomId: ChatRoomId,
  size: number,
): ChatTranscriptRoomWindow {
  const entries = selectRoomTranscript(state, roomId).filter((entry) => entry.visibility === 'SHADOW');
  const safeSize = Math.max(1, Math.floor(size));
  const slice = entries.slice(-safeSize);
  return {
    roomId,
    entries: slice,
    startSequence: slice[0]?.message.sequenceNumber ?? asSequenceNumber(0),
    endSequence: slice.at(-1)?.message.sequenceNumber ?? asSequenceNumber(0),
  };
}

// ============================================================================
// MARK: Internal pagination and search helpers
// ============================================================================

function emptyPage(roomId: ChatRoomId): ChatTranscriptPage {
  return {
    roomId,
    entries: [],
    cursor: null,
    hasMoreOlder: false,
    hasMoreNewer: false,
  };
}

function makeCursor(
  roomId: ChatRoomId,
  message: ChatMessage | null,
  direction: ChatTranscriptCursor['direction'],
): ChatTranscriptCursor | null {
  if (!message) {
    return null;
  }
  return {
    roomId,
    anchorMessageId: message.id,
    anchorSequence: message.sequenceNumber,
    direction,
  };
}

function stableSortMessages(messages: readonly ChatMessage[]): readonly ChatMessage[] {
  return [...messages].sort((a, b) => {
    if (a.roomId !== b.roomId) {
      return String(a.roomId).localeCompare(String(b.roomId));
    }
    if (Number(a.sequenceNumber) !== Number(b.sequenceNumber)) {
      return Number(a.sequenceNumber) - Number(b.sequenceNumber);
    }
    if (Number(a.createdAt) !== Number(b.createdAt)) {
      return Number(a.createdAt) - Number(b.createdAt);
    }
    return String(a.id).localeCompare(String(b.id));
  });
}

function dedupeEntries(entries: readonly ChatTranscriptEntry[]): readonly ChatTranscriptEntry[] {
  const seen = new Set<string>();
  const out: ChatTranscriptEntry[] = [];
  for (const entry of entries) {
    const key = String(entry.message.id);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(entry);
  }
  return out;
}

function buildSearchHaystack(message: ChatMessage): string {
  return [
    message.plainText,
    message.attribution.displayName,
    message.attribution.actorId,
    message.channelId,
    ...message.tags,
  ]
    .join(' ')
    .toLowerCase();
}

function scoreSearchHit(message: ChatMessage, matchedTerms: readonly string[]): number {
  let score = matchedTerms.length * 10;
  if (message.attribution.sourceType === 'PLAYER') {
    score += 8;
  }
  if (message.policy.shadowOnly) {
    score -= 2;
  }
  if (message.replay.replayId) {
    score += 6;
  }
  return score + Math.min(15, message.tags.length);
}

function stripEntriesFromIndex(
  index: Readonly<Record<ChatMessageId, ChatTranscriptEntry>>,
  removedEntries: readonly ChatTranscriptEntry[],
): Readonly<Record<ChatMessageId, ChatTranscriptEntry>> {
  const next = { ...index } as Record<ChatMessageId, ChatTranscriptEntry>;
  for (const entry of removedEntries) {
    delete next[entry.message.id];
  }
  return next;
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = collapseWhitespace(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function collapseWhitespace(value: string): string {
  return String(value).replace(/\s+/g, ' ').trim();
}

function tokenize(query: string): readonly string[] {
  return collapseWhitespace(query)
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function requireRoom(state: ChatState, roomId: ChatRoomId): ChatRoomState {
  const room = selectRoom(state, roomId);
  if (!room) {
    throw new Error(`ChatTranscriptLedger: room ${String(roomId)} does not exist.`);
  }
  return room;
}

function mergeRuntime(runtime: Partial<ChatRuntimeConfig> | undefined): ChatRuntimeConfig {
  return {
    ...CHAT_RUNTIME_DEFAULTS,
    ...(runtime ?? {}),
    ratePolicy: {
      ...CHAT_RUNTIME_DEFAULTS.ratePolicy,
      ...(runtime?.ratePolicy ?? {}),
    },
    moderationPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.moderationPolicy,
      ...(runtime?.moderationPolicy ?? {}),
    },
    replayPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.replayPolicy,
      ...(runtime?.replayPolicy ?? {}),
    },
    learningPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.learningPolicy,
      ...(runtime?.learningPolicy ?? {}),
    },
    proofPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.proofPolicy,
      ...(runtime?.proofPolicy ?? {}),
    },
    invasionPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.invasionPolicy,
      ...(runtime?.invasionPolicy ?? {}),
    },
  };
}
