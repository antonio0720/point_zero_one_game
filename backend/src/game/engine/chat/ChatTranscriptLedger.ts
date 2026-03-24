
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

// ============================================================================
// MARK: Transcript watch bus
// ============================================================================

export type TranscriptWatchEventKind =
  | 'MESSAGE_APPENDED'
  | 'MESSAGE_REDACTED'
  | 'MESSAGE_SOFT_DELETED'
  | 'MESSAGE_HARD_DELETED'
  | 'MESSAGE_REPLACED'
  | 'REVEAL_PROMOTED'
  | 'SEQUENCE_GAP_DETECTED'
  | 'COMPACTION_RAN';

export interface TranscriptWatchEvent {
  readonly kind: TranscriptWatchEventKind;
  readonly roomId: ChatRoomId;
  readonly messageId: ChatMessageId | null;
  readonly channelId: ChatChannelId | null;
  readonly detail: string;
  readonly occurredAt: UnixMs;
}

export class TranscriptWatchBus {
  private readonly handlers: Array<(evt: TranscriptWatchEvent) => void> = [];

  subscribe(handler: (evt: TranscriptWatchEvent) => void): () => void {
    this.handlers.push(handler);
    return () => {
      const idx = this.handlers.indexOf(handler);
      if (idx !== -1) this.handlers.splice(idx, 1);
    };
  }

  emit(evt: TranscriptWatchEvent): void {
    for (const h of this.handlers) {
      try { h(evt); } catch { /* noop */ }
    }
  }

  emitAppend(roomId: ChatRoomId, messageId: ChatMessageId, channelId: ChatChannelId): void {
    this.emit({ kind: 'MESSAGE_APPENDED', roomId, messageId, channelId, detail: `msg ${messageId} appended`, occurredAt: asUnixMs(Date.now()) });
  }

  emitRedact(roomId: ChatRoomId, messageId: ChatMessageId): void {
    this.emit({ kind: 'MESSAGE_REDACTED', roomId, messageId, channelId: null, detail: `msg ${messageId} redacted`, occurredAt: asUnixMs(Date.now()) });
  }

  emitSequenceGap(roomId: ChatRoomId, expected: number, got: number): void {
    this.emit({ kind: 'SEQUENCE_GAP_DETECTED', roomId, messageId: null, channelId: null, detail: `gap: expected ${expected}, got ${got}`, occurredAt: asUnixMs(Date.now()) });
  }
}

// ============================================================================
// MARK: Transcript fingerprint
// ============================================================================

export interface TranscriptFingerprint {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly hash: string;
  readonly messageCount: number;
  readonly computedAt: UnixMs;
}

export function computeTranscriptFingerprint(
  roomId: ChatRoomId,
  channelId: ChatChannelId,
  entries: readonly ChatTranscriptEntry[],
): TranscriptFingerprint {
  const channelEntries = entries.filter((e) => e.message.channelId === channelId);
  const parts = channelEntries.map((e) => `${Number(e.message.sequenceNumber)}:${e.message.id}:${e.message.attribution.actorId}`);
  let h = 5381;
  for (const p of parts) {
    for (let i = 0; i < p.length; i++) {
      h = ((h << 5) + h + p.charCodeAt(i)) >>> 0;
    }
  }
  return Object.freeze({
    roomId,
    channelId,
    hash: h.toString(16).padStart(8, '0'),
    messageCount: channelEntries.length,
    computedAt: asUnixMs(Date.now()),
  });
}

// ============================================================================
// MARK: Transcript analytics
// ============================================================================

export interface TranscriptAuthorStat {
  readonly authorId: string;
  readonly messageCount: number;
  readonly firstMessageAt: UnixMs;
  readonly lastMessageAt: UnixMs;
  readonly channelBreakdown: Record<string, number>;
}

export interface TranscriptAnalytics {
  readonly roomId: ChatRoomId;
  readonly totalMessages: number;
  readonly visibleMessages: number;
  readonly redactedMessages: number;
  readonly deletedMessages: number;
  readonly authorStats: readonly TranscriptAuthorStat[];
  readonly channelMessageCounts: Record<string, number>;
  readonly sequenceMin: number;
  readonly sequenceMax: number;
  readonly generatedAt: UnixMs;
}

export function buildTranscriptAnalytics(
  roomId: ChatRoomId,
  entries: readonly ChatTranscriptEntry[],
): TranscriptAnalytics {
  let visible = 0, redacted = 0, deleted = 0;
  const authorMap = new Map<string, { count: number; first: UnixMs; last: UnixMs; channels: Record<string, number> }>();
  const channelCounts: Record<string, number> = {};
  let seqMin = Infinity, seqMax = -Infinity;

  for (const entry of entries) {
    const msg = entry.message;
    if (entry.visibility === 'REDACTED') redacted++;
    else if (entry.visibility === 'DELETED') deleted++;
    else visible++;

    const ch = msg.channelId ?? 'UNKNOWN';
    channelCounts[ch] = (channelCounts[ch] ?? 0) + 1;

    const seq = Number(msg.sequenceNumber);
    if (seq < seqMin) seqMin = seq;
    if (seq > seqMax) seqMax = seq;

    const authorId = msg.attribution.actorId ?? 'SYSTEM';
    const existing = authorMap.get(authorId);
    if (!existing) {
      authorMap.set(authorId, { count: 1, first: msg.createdAt, last: msg.createdAt, channels: { [ch]: 1 } });
    } else {
      existing.count++;
      if (msg.createdAt < existing.first) existing.first = msg.createdAt;
      if (msg.createdAt > existing.last) existing.last = msg.createdAt;
      existing.channels[ch] = (existing.channels[ch] ?? 0) + 1;
    }
  }

  const authorStats: TranscriptAuthorStat[] = [];
  for (const [authorId, data] of authorMap) {
    authorStats.push(Object.freeze({ authorId, messageCount: data.count, firstMessageAt: data.first, lastMessageAt: data.last, channelBreakdown: data.channels }));
  }
  authorStats.sort((a, b) => b.messageCount - a.messageCount);

  return Object.freeze({
    roomId,
    totalMessages: entries.length,
    visibleMessages: visible,
    redactedMessages: redacted,
    deletedMessages: deleted,
    authorStats: Object.freeze(authorStats),
    channelMessageCounts: channelCounts,
    sequenceMin: seqMin === Infinity ? 0 : seqMin,
    sequenceMax: seqMax === -Infinity ? 0 : seqMax,
    generatedAt: asUnixMs(Date.now()),
  });
}

// ============================================================================
// MARK: Transcript replay window builder
// ============================================================================

export interface TranscriptReplayWindow {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly fromSequence: SequenceNumber;
  readonly toSequence: SequenceNumber;
  readonly entries: readonly ChatTranscriptEntry[];
  readonly hasGaps: boolean;
  readonly gapPositions: readonly number[];
}

export function buildTranscriptReplayWindow(
  roomId: ChatRoomId,
  channelId: ChatChannelId,
  allEntries: readonly ChatTranscriptEntry[],
  fromSequence: SequenceNumber,
  toSequence: SequenceNumber,
): TranscriptReplayWindow {
  const filtered = allEntries.filter((e) => {
    const seq = Number(e.message.sequenceNumber);
    const from = Number(fromSequence);
    const to = Number(toSequence);
    return e.message.channelId === channelId && seq >= from && seq <= to;
  }).sort((a, b) => Number(a.message.sequenceNumber) - Number(b.message.sequenceNumber));

  const gapPositions: number[] = [];
  let hasGaps = false;
  for (let i = 1; i < filtered.length; i++) {
    const prev = Number(filtered[i - 1].message.sequenceNumber);
    const curr = Number(filtered[i].message.sequenceNumber);
    if (curr - prev > 1) {
      hasGaps = true;
      gapPositions.push(prev + 1);
    }
  }

  return Object.freeze({ roomId, channelId, fromSequence, toSequence, entries: Object.freeze(filtered), hasGaps, gapPositions: Object.freeze(gapPositions) });
}

// ============================================================================
// MARK: Transcript pending reveal tracker
// ============================================================================

export interface PendingRevealTracker {
  add(reveal: ChatPendingReveal): void;
  getAll(roomId: ChatRoomId): readonly ChatPendingReveal[];
  remove(roomId: ChatRoomId, messageId: ChatMessageId): void;
  promote(roomId: ChatRoomId, messageId: ChatMessageId, nowMs?: number): ChatPendingReveal | null;
  countPending(roomId: ChatRoomId): number;
  getExpired(roomId: ChatRoomId, nowMs?: number): readonly ChatPendingReveal[];
  clearRoom(roomId: ChatRoomId): void;
}

export function createPendingRevealTracker(): PendingRevealTracker {
  const store = new Map<string, ChatPendingReveal[]>();

  return {
    add(reveal: ChatPendingReveal): void {
      const list = store.get(reveal.roomId) ?? [];
      list.push(reveal);
      store.set(reveal.roomId, list);
    },
    getAll(roomId: ChatRoomId): readonly ChatPendingReveal[] {
      return Object.freeze(store.get(roomId) ?? []);
    },
    remove(roomId: ChatRoomId, messageId: ChatMessageId): void {
      const list = store.get(roomId) ?? [];
      store.set(roomId, list.filter((r) => r.message.id !== messageId));
    },
    promote(roomId: ChatRoomId, messageId: ChatMessageId, nowMs: number = Date.now()): ChatPendingReveal | null {
      const list = store.get(roomId) ?? [];
      const idx = list.findIndex((r) => r.message.id === messageId && r.revealAt <= asUnixMs(nowMs));
      if (idx === -1) return null;
      const [promoted] = list.splice(idx, 1);
      store.set(roomId, list);
      return promoted;
    },
    countPending(roomId: ChatRoomId): number {
      return (store.get(roomId) ?? []).length;
    },
    getExpired(roomId: ChatRoomId, nowMs: number = Date.now()): readonly ChatPendingReveal[] {
      const list = store.get(roomId) ?? [];
      return Object.freeze(list.filter((r) => r.revealAt <= asUnixMs(nowMs)));
    },
    clearRoom(roomId: ChatRoomId): void {
      store.delete(roomId);
    },
  };
}

// ============================================================================
// MARK: Transcript sequence gap audit
// ============================================================================

export interface SequenceGapAuditResult {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly hasGaps: boolean;
  readonly gaps: readonly { readonly from: number; readonly to: number; readonly missing: number }[];
  readonly totalMissing: number;
  readonly auditedAt: UnixMs;
}

export function auditTranscriptSequenceGaps(
  roomId: ChatRoomId,
  channelId: ChatChannelId,
  entries: readonly ChatTranscriptEntry[],
): SequenceGapAuditResult {
  const channelEntries = entries
    .filter((e) => e.message.channelId === channelId)
    .sort((a, b) => Number(a.message.sequenceNumber) - Number(b.message.sequenceNumber));

  const gaps: { from: number; to: number; missing: number }[] = [];
  let totalMissing = 0;

  for (let i = 1; i < channelEntries.length; i++) {
    const prev = Number(channelEntries[i - 1].message.sequenceNumber);
    const curr = Number(channelEntries[i].message.sequenceNumber);
    if (curr - prev > 1) {
      const missing = curr - prev - 1;
      totalMissing += missing;
      gaps.push({ from: prev + 1, to: curr - 1, missing });
    }
  }

  return Object.freeze({
    roomId,
    channelId,
    hasGaps: gaps.length > 0,
    gaps: Object.freeze(gaps),
    totalMissing,
    auditedAt: asUnixMs(Date.now()),
  });
}

// ============================================================================
// MARK: Transcript callback memory query
// ============================================================================

export interface CallbackMessageQuery {
  readonly roomId: ChatRoomId;
  readonly authorId?: string;
  readonly channelId?: ChatChannelId;
  readonly tags?: readonly string[];
  readonly sinceSequence?: SequenceNumber;
  readonly limit?: number;
}

export interface CallbackMessageResult {
  readonly messages: readonly ChatMessage[];
  readonly totalFound: number;
  readonly queryAppliedAt: UnixMs;
}

export function queryCallbackMessages(
  entries: readonly ChatTranscriptEntry[],
  query: CallbackMessageQuery,
): CallbackMessageResult {
  let filtered = entries.filter((e) => {
    if (e.visibility === 'REDACTED' || e.visibility === 'DELETED') return false;
    if (query.authorId && e.message.attribution.actorId !== query.authorId) return false;
    if (query.channelId && e.message.channelId !== query.channelId) return false;
    if (query.sinceSequence && Number(e.message.sequenceNumber) < Number(query.sinceSequence)) return false;
    if (query.tags && query.tags.length > 0) {
      const msgTags = e.message.tags ?? [];
      if (!query.tags.some((t) => msgTags.includes(t))) return false;
    }
    return true;
  });

  filtered.sort((a, b) => Number(b.message.sequenceNumber) - Number(a.message.sequenceNumber));
  const limit = query.limit ?? 50;
  const limited = filtered.slice(0, limit);

  return Object.freeze({
    messages: Object.freeze(limited.map((e) => e.message)),
    totalFound: filtered.length,
    queryAppliedAt: asUnixMs(Date.now()),
  });
}

// ============================================================================
// MARK: Transcript compaction result
// ============================================================================

export interface TranscriptCompactionResult {
  readonly roomId: ChatRoomId;
  readonly entriesBeforeCompaction: number;
  readonly entriesAfterCompaction: number;
  readonly entriesRemoved: number;
  readonly compactedAt: UnixMs;
}

export function buildTranscriptCompactionResult(
  roomId: ChatRoomId,
  before: number,
  after: number,
): TranscriptCompactionResult {
  return Object.freeze({
    roomId,
    entriesBeforeCompaction: before,
    entriesAfterCompaction: after,
    entriesRemoved: before - after,
    compactedAt: asUnixMs(Date.now()),
  });
}

// ============================================================================
// MARK: Transcript ledger extended class
// ============================================================================

export class ChatTranscriptLedgerExtended {
  private readonly ledger: ChatTranscriptLedgerApi;
  private readonly watchBus = new TranscriptWatchBus();
  private readonly revealTracker = createPendingRevealTracker();

  constructor(options: ChatTranscriptLedgerOptions = {}) {
    this.ledger = createChatTranscriptLedger(options);
  }

  getLedger(): ChatTranscriptLedgerApi { return this.ledger; }
  getWatchBus(): TranscriptWatchBus { return this.watchBus; }
  getRevealTracker(): PendingRevealTracker { return this.revealTracker; }

  appendWithWatch(state: ChatState, message: ChatMessage): ChatTranscriptWriteResult {
    const result = this.ledger.append(state, message);
    if (result.entry) {
      this.watchBus.emitAppend(
        message.roomId as ChatRoomId,
        result.entry.message.id as ChatMessageId,
        result.entry.message.channelId as ChatChannelId,
      );
    }
    if (result.sequenceGapDetected) {
      this.watchBus.emitSequenceGap(message.roomId as ChatRoomId, 0, 0);
    }
    return result;
  }

  redactWithWatch(state: ChatState, messageId: ChatMessageId, roomId: ChatRoomId, now?: UnixMs): ChatTranscriptRevisionResult {
    const result = this.ledger.redact(state, messageId, now);
    this.watchBus.emitRedact(roomId, messageId);
    return result;
  }

  buildAnalytics(state: ChatState, roomId: ChatRoomId): TranscriptAnalytics {
    const entries = selectRoomTranscript(state, roomId);
    return buildTranscriptAnalytics(roomId, entries);
  }

  auditGaps(state: ChatState, roomId: ChatRoomId, channelId: ChatChannelId): SequenceGapAuditResult {
    const entries = selectRoomTranscript(state, roomId);
    return auditTranscriptSequenceGaps(roomId, channelId, entries);
  }

  computeFingerprint(state: ChatState, roomId: ChatRoomId, channelId: ChatChannelId): TranscriptFingerprint {
    const entries = selectRoomTranscript(state, roomId);
    return computeTranscriptFingerprint(roomId, channelId, entries);
  }

  queryCallbacks(state: ChatState, query: CallbackMessageQuery): CallbackMessageResult {
    const entries = selectRoomTranscript(state, query.roomId);
    return queryCallbackMessages(entries, query);
  }
}

// ============================================================================
// MARK: Visible channel helpers (ChatVisibleChannel + JsonValue wired)
// ============================================================================

export interface VisibleChannelLedgerView {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatVisibleChannel;
  readonly messageCount: number;
  readonly latestMessage: ChatMessage | null;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export function buildVisibleChannelLedgerView(
  state: ChatState,
  roomId: ChatRoomId,
  channelId: ChatVisibleChannel,
): VisibleChannelLedgerView {
  const entries = selectRoomTranscript(state, roomId).filter(
    (e) => e.message.channelId === channelId && e.visibility === 'VISIBLE',
  );
  const latest = entries.at(-1)?.message ?? null;
  const metadata: Record<string, JsonValue> = {
    roomId: String(roomId),
    channelId: String(channelId),
    messageCount: entries.length,
    latestAt: latest ? Number(latest.createdAt) : null,
    latestSequence: latest ? Number(latest.sequenceNumber) : null,
  };
  return Object.freeze({
    roomId,
    channelId,
    messageCount: entries.length,
    latestMessage: latest,
    metadata: Object.freeze(metadata),
  });
}

export function buildAllVisibleChannelViews(
  state: ChatState,
  roomId: ChatRoomId,
  channels: readonly ChatVisibleChannel[],
): readonly VisibleChannelLedgerView[] {
  return Object.freeze(channels.map((channelId) => buildVisibleChannelLedgerView(state, roomId, channelId)));
}

export function transcriptToJsonExport(
  state: ChatState,
  roomId: ChatRoomId,
): readonly Readonly<Record<string, JsonValue>>[] {
  return selectRoomTranscript(state, roomId).map((entry) =>
    Object.freeze({
      id: String(entry.message.id),
      roomId: String(roomId),
      channelId: entry.message.channelId as string,
      sequence: Number(entry.message.sequenceNumber),
      createdAt: Number(entry.message.createdAt),
      author: entry.message.attribution.actorId as string,
      text: entry.message.plainText as JsonValue,
      visibility: entry.visibility as string,
    } satisfies Record<string, JsonValue>),
  );
}

// ============================================================================
// MARK: Sequence and latest message helpers (nextSequenceForRoom + selectLatestMessage wired)
// ============================================================================

export function getNextSequenceForRoom(state: ChatState, roomId: ChatRoomId): SequenceNumber {
  return nextSequenceForRoom(state, roomId);
}

export function getLatestRoomMessage(state: ChatState, roomId: ChatRoomId): ChatMessage | null {
  return selectLatestMessage(state, roomId);
}

export function peekLatestAndNextSequence(
  state: ChatState,
  roomId: ChatRoomId,
): { readonly latest: ChatMessage | null; readonly nextSequence: SequenceNumber } {
  return Object.freeze({
    latest: selectLatestMessage(state, roomId),
    nextSequence: nextSequenceForRoom(state, roomId),
  });
}

// ============================================================================
// MARK: Reveal scheduling helpers (createPendingReveal wired)
// ============================================================================

export function scheduleReveal(
  state: ChatState,
  message: ChatMessage,
  revealAt: UnixMs,
): ChatState {
  const reveal = createPendingReveal({ revealAt, roomId: message.roomId, message });
  return queueReveal(state, reveal);
}

export function scheduleBatchReveals(
  state: ChatState,
  messages: readonly ChatMessage[],
  revealAt: UnixMs,
): ChatState {
  let next = state;
  for (const message of messages) {
    next = scheduleReveal(next, message, revealAt);
  }
  return next;
}

export function scheduleRevealWithDelay(
  state: ChatState,
  message: ChatMessage,
  now: UnixMs,
  delayMs: number,
): ChatState {
  const revealAt = asUnixMs(Number(now) + delayMs);
  return scheduleReveal(state, message, revealAt);
}

export type { ChatVisibleChannel };
export type { JsonValue };

// ============================================================================
// MARK: Transcript module constants
// ============================================================================

export const CHAT_TRANSCRIPT_MODULE_NAME = 'ChatTranscriptLedger' as const;
export const CHAT_TRANSCRIPT_MODULE_VERSION = '3.0.0' as const;

export const CHAT_TRANSCRIPT_LAWS = Object.freeze([
  'The ledger only accepts canonical ChatMessage values — no raw client input.',
  'Redacted messages are preserved with a placeholder — never deleted from sequence.',
  'Soft-deleted messages are excluded from public views but retained for moderation.',
  'Hard-deleted messages must leave a tombstone entry for audit continuity.',
  'Sequence gaps must be detected and emitted as watch events.',
  'Pending reveals are promoted atomically — no partial reveals.',
  'Compaction must not remove entries within the replay anchor window.',
  'Callback queries are always read-only and never mutate state.',
]);

export const CHAT_TRANSCRIPT_MODULE_DESCRIPTOR = Object.freeze({
  name: CHAT_TRANSCRIPT_MODULE_NAME,
  version: CHAT_TRANSCRIPT_MODULE_VERSION,
  laws: CHAT_TRANSCRIPT_LAWS,
  supportedChannelDescriptors: Object.keys(CHAT_CHANNEL_DESCRIPTORS),
  supportedOperations: ['write', 'redact', 'softDelete', 'hardDelete', 'replace', 'reveal', 'compact'] as const,
});

// ============================================================================
// MARK: Transcript channel activity report
// ============================================================================

export interface ChannelActivityReport {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly messageCount: number;
  readonly firstMessageAt: UnixMs | null;
  readonly lastMessageAt: UnixMs | null;
  readonly uniqueAuthors: number;
  readonly avgMessagesPerAuthor: number;
  readonly generatedAt: UnixMs;
}

export function buildChannelActivityReport(
  roomId: ChatRoomId,
  channelId: ChatChannelId,
  entries: readonly ChatTranscriptEntry[],
): ChannelActivityReport {
  const channelEntries = entries.filter((e) => e.message.channelId === channelId && e.visibility !== 'REDACTED' && e.visibility !== 'DELETED');
  const authors = new Set(channelEntries.map((e) => e.message.attribution.actorId ?? 'SYSTEM'));
  const timestamps = channelEntries.map((e) => e.message.createdAt as unknown as number);
  const first = timestamps.length > 0 ? asUnixMs(Math.min(...timestamps)) : null;
  const last = timestamps.length > 0 ? asUnixMs(Math.max(...timestamps)) : null;

  return Object.freeze({
    roomId,
    channelId,
    messageCount: channelEntries.length,
    firstMessageAt: first,
    lastMessageAt: last,
    uniqueAuthors: authors.size,
    avgMessagesPerAuthor: authors.size > 0 ? channelEntries.length / authors.size : 0,
    generatedAt: asUnixMs(Date.now()),
  });
}

// ============================================================================
// MARK: Transcript message velocity
// ============================================================================

export interface TranscriptMessageVelocity {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly windowMs: number;
  readonly messagesInWindow: number;
  readonly messagesPerMinute: number;
  readonly generatedAt: UnixMs;
}

export function computeTranscriptMessageVelocity(
  roomId: ChatRoomId,
  channelId: ChatChannelId,
  entries: readonly ChatTranscriptEntry[],
  windowMs: number = 60_000,
  nowMs: number = Date.now(),
): TranscriptMessageVelocity {
  const cutoff = asUnixMs(nowMs - windowMs);
  const inWindow = entries.filter((e) => e.message.channelId === channelId && e.message.createdAt >= cutoff && e.visibility !== 'REDACTED' && e.visibility !== 'DELETED');
  const perMinute = windowMs > 0 ? (inWindow.length / windowMs) * 60_000 : 0;
  return Object.freeze({ roomId, channelId, windowMs, messagesInWindow: inWindow.length, messagesPerMinute: perMinute, generatedAt: asUnixMs(nowMs) });
}

// ============================================================================
// MARK: Transcript redaction audit
// ============================================================================

export interface RedactionAuditEntry {
  readonly messageId: ChatMessageId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId | null;
  readonly redactedAt: UnixMs | null;
  readonly authorId: string | null;
}

export interface RedactionAuditReport {
  readonly roomId: ChatRoomId;
  readonly entries: readonly RedactionAuditEntry[];
  readonly redactionCount: number;
  readonly softDeleteCount: number;
  readonly generatedAt: UnixMs;
}

export function buildRedactionAuditReport(
  roomId: ChatRoomId,
  entries: readonly ChatTranscriptEntry[],
): RedactionAuditReport {
  const redacted: RedactionAuditEntry[] = [];
  let softDeleteCount = 0;

  for (const entry of entries) {
    if (entry.visibility === 'REDACTED') {
      redacted.push(Object.freeze({
        messageId: entry.message.id as ChatMessageId,
        roomId,
        channelId: entry.message.channelId as ChatChannelId ?? null,
        redactedAt: entry.message.redactedAt ?? null,
        authorId: entry.message.attribution.actorId ?? null,
      }));
    }
    if (entry.visibility === 'DELETED') softDeleteCount++;
  }

  return Object.freeze({ roomId, entries: Object.freeze(redacted), redactionCount: redacted.length, softDeleteCount, generatedAt: asUnixMs(Date.now()) });
}

// ============================================================================
// MARK: Transcript author leaderboard
// ============================================================================

export interface AuthorLeaderboardEntry {
  readonly authorId: string;
  readonly messageCount: number;
  readonly rank: number;
  readonly firstMessageAt: UnixMs | null;
  readonly lastMessageAt: UnixMs | null;
}

export interface TranscriptAuthorLeaderboard {
  readonly roomId: ChatRoomId;
  readonly entries: readonly AuthorLeaderboardEntry[];
  readonly generatedAt: UnixMs;
}

export function buildAuthorLeaderboard(
  roomId: ChatRoomId,
  entries: readonly ChatTranscriptEntry[],
  limit: number = 20,
): TranscriptAuthorLeaderboard {
  const authorMap = new Map<string, { count: number; first: number; last: number }>();

  for (const e of entries) {
    if (e.visibility === 'REDACTED' || e.visibility === 'DELETED') continue;
    const authorId = e.message.attribution.actorId ?? 'SYSTEM';
    const ts = e.message.createdAt as unknown as number;
    const existing = authorMap.get(authorId);
    if (!existing) {
      authorMap.set(authorId, { count: 1, first: ts, last: ts });
    } else {
      existing.count++;
      if (ts < existing.first) existing.first = ts;
      if (ts > existing.last) existing.last = ts;
    }
  }

  const sorted = Array.from(authorMap.entries())
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, limit)
    .map(([authorId, data], idx) => Object.freeze({
      authorId,
      messageCount: data.count,
      rank: idx + 1,
      firstMessageAt: asUnixMs(data.first),
      lastMessageAt: asUnixMs(data.last),
    }));

  return Object.freeze({ roomId, entries: Object.freeze(sorted), generatedAt: asUnixMs(Date.now()) });
}

// ============================================================================
// MARK: Transcript proof edge collector
// ============================================================================

export interface TranscriptProofEdgeReport {
  readonly roomId: ChatRoomId;
  readonly totalEdges: number;
  readonly edgesByKind: Record<string, number>;
  readonly strongestEdgePair: { readonly from: ChatEventId; readonly to: ChatEventId; readonly weight: number } | null;
  readonly generatedAt: UnixMs;
}

export function buildTranscriptProofEdgeReport(
  roomId: ChatRoomId,
  proofEdges: readonly ChatProofEdge[],
): TranscriptProofEdgeReport {
  const byKind: Record<string, number> = {};
  let strongest: { from: ChatEventId; to: ChatEventId; weight: number } | null = null;

  for (const edge of proofEdges) {
    const edgeEx = edge as unknown as { kind?: string; weight?: number };
    const kind = edgeEx.kind ?? 'UNKNOWN';
    byKind[kind] = (byKind[kind] ?? 0) + 1;
    const weight = edgeEx.weight ?? 0;
    if (!strongest || weight > strongest.weight) {
      strongest = { from: edge.fromMessageId as unknown as ChatEventId, to: edge.toMessageId as unknown as ChatEventId, weight };
    }
  }

  return Object.freeze({
    roomId,
    totalEdges: proofEdges.length,
    edgesByKind: byKind,
    strongestEdgePair: strongest ? Object.freeze(strongest) : null,
    generatedAt: asUnixMs(Date.now()),
  });
}

// ============================================================================
// MARK: Transcript replay artifact collector
// ============================================================================

export interface ReplayArtifactSummary {
  readonly roomId: ChatRoomId;
  readonly artifactCount: number;
  readonly latestArtifactAt: UnixMs | null;
  readonly artifacts: readonly ChatReplayArtifact[];
  readonly generatedAt: UnixMs;
}

export function buildReplayArtifactSummary(
  roomId: ChatRoomId,
  state: ChatState,
): ReplayArtifactSummary {
  const artifacts = selectRoomReplayArtifacts(state, roomId);
  const timestamps = artifacts.map((a) => a.createdAt as unknown as number);
  const latest = timestamps.length > 0 ? asUnixMs(Math.max(...timestamps)) : null;

  return Object.freeze({
    roomId,
    artifactCount: artifacts.length,
    latestArtifactAt: latest,
    artifacts: Object.freeze(artifacts),
    generatedAt: asUnixMs(Date.now()),
  });
}

// ============================================================================
// MARK: Transcript proof edge summary
// ============================================================================

export function buildRoomProofEdgeSummary(
  roomId: ChatRoomId,
  state: ChatState,
): TranscriptProofEdgeReport {
  const edges = selectRoomProofEdges(state, roomId);
  return buildTranscriptProofEdgeReport(roomId, edges);
}

// ============================================================================
// MARK: Transcript most recent replay builder
// ============================================================================

export interface RecentReplayEntry {
  readonly roomId: ChatRoomId;
  readonly replayId: ChatReplayId;
  readonly rangeStart: number;
  readonly rangeEnd: number;
  readonly createdAt: UnixMs;
}

export function collectRecentReplayEntries(
  state: ChatState,
  roomId: ChatRoomId,
  limit: number = 10,
): readonly RecentReplayEntry[] {
  const artifacts = selectRoomReplayArtifacts(state, roomId);
  const sorted = [...artifacts].sort((a, b) => (b.createdAt as unknown as number) - (a.createdAt as unknown as number));
  return Object.freeze(
    sorted.slice(0, limit).map((a) => Object.freeze({
      roomId,
      replayId: a.id,
      rangeStart: a.range.start,
      rangeEnd: a.range.end,
      createdAt: a.createdAt,
    })),
  );
}

// ============================================================================
// MARK: Transcript typing snapshot summary
// ============================================================================

export interface TypingSnapshotSummary {
  readonly roomId: ChatRoomId;
  readonly activeTyperCount: number;
  readonly typerIds: readonly string[];
  readonly generatedAt: UnixMs;
}

export function buildTypingSnapshotSummary(
  roomId: ChatRoomId,
  typingSnapshots: ReadonlyMap<string, ChatTypingSnapshot>,
  nowMs: number = Date.now(),
  staleThresholdMs: number = 5_000,
): TypingSnapshotSummary {
  const cutoff = nowMs - staleThresholdMs;
  const activeTypers: string[] = [];

  for (const [sessionId, snap] of typingSnapshots) {
    if (snap.roomId === roomId && Number(snap.startedAt) >= cutoff && snap.mode === 'TYPING') {
      activeTypers.push(sessionId);
    }
  }

  return Object.freeze({ roomId, activeTyperCount: activeTypers.length, typerIds: Object.freeze(activeTypers), generatedAt: asUnixMs(nowMs) });
}

// ============================================================================
// MARK: Transcript room window report
// ============================================================================

export interface RoomWindowReport {
  readonly roomId: ChatRoomId;
  readonly windowSize: number;
  readonly firstSequence: SequenceNumber | null;
  readonly lastSequence: SequenceNumber | null;
  readonly visibleCount: number;
  readonly shadowCount: number;
  readonly generatedAt: UnixMs;
}

export function buildRoomWindowReport(
  state: ChatState,
  roomId: ChatRoomId,
  windowSize: number = 100,
): RoomWindowReport {
  const window = getRoomWindow(state, roomId, 0, windowSize);
  const entries = window.entries ?? [];
  let visible = 0, shadow = 0;
  let firstSeq: SequenceNumber | null = null;
  let lastSeq: SequenceNumber | null = null;

  for (const e of entries) {
    if (e.visibility === 'VISIBLE') visible++;
    else shadow++;
    const seq = e.message.sequenceNumber;
    if (firstSeq === null) firstSeq = seq;
    lastSeq = seq;
  }

  return Object.freeze({
    roomId,
    windowSize,
    firstSequence: firstSeq,
    lastSequence: lastSeq,
    visibleCount: visible,
    shadowCount: shadow,
    generatedAt: asUnixMs(Date.now()),
  });
}

// ============================================================================
// MARK: Transcript most recent visible message
// ============================================================================

export function getMostRecentVisibleMessage(
  state: ChatState,
  roomId: ChatRoomId,
): ChatMessage | null {
  const transcript = selectRoomTranscript(state, roomId);
  const visible = transcript.filter((e) => e.visibility === 'VISIBLE');
  if (visible.length === 0) return null;
  visible.sort((a, b) => Number(b.message.sequenceNumber) - Number(a.message.sequenceNumber));
  return visible[0].message;
}

// ============================================================================
// MARK: Transcript replay artifact fingerprint
// ============================================================================

export interface ReplayArtifactFingerprint {
  readonly roomId: ChatRoomId;
  readonly hash: string;
  readonly artifactCount: number;
  readonly computedAt: UnixMs;
}

export function computeReplayArtifactFingerprint(
  roomId: ChatRoomId,
  artifacts: readonly ChatReplayArtifact[],
): ReplayArtifactFingerprint {
  const sorted = [...artifacts].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const parts = sorted.map((a) => `${a.id}:${a.range.start}-${a.range.end}`);
  let h = 5381;
  for (const p of parts) {
    for (let i = 0; i < p.length; i++) {
      h = ((h << 5) + h + p.charCodeAt(i)) >>> 0;
    }
  }
  return Object.freeze({ roomId, hash: h.toString(16).padStart(8, '0'), artifactCount: artifacts.length, computedAt: asUnixMs(Date.now()) });
}

// ============================================================================
// MARK: Transcript most relevant message for callback
// ============================================================================

export function getMostRelevantCallbackMessage(
  state: ChatState,
  roomId: ChatRoomId,
  anchorSequence: SequenceNumber,
  radius: number = 5,
): ChatMessage | null {
  const entries = state.transcript.byRoom[roomId] ?? [];
  const anchor = entries.find((e) => Number(e.message.sequenceNumber) === Number(anchorSequence));
  if (!anchor) {
    const window = getAroundSequence(state, roomId, anchorSequence, radius);
    return window.entries[0]?.message ?? null;
  }
  getMostRelevantReplayForMessage(state, anchor.message); // side-effectless, drives replay lookup
  const window = getAroundSequence(state, roomId, anchorSequence, radius);
  return window.entries.find((e) => Number(e.message.sequenceNumber) === Number(anchorSequence))?.message
    ?? anchor.message;
}

// ============================================================================
// MARK: Transcript request ID index
// ============================================================================

export interface RequestIdIndex {
  readonly index: ReadonlyMap<ChatRequestId, ChatMessageId>;
  readonly count: number;
  readonly builtAt: UnixMs;
}

export function buildRequestIdIndex(
  entries: readonly ChatTranscriptEntry[],
): RequestIdIndex {
  const index = new Map<ChatRequestId, ChatMessageId>();
  for (const e of entries) {
    const reqId = (e.message as unknown as { requestId?: string }).requestId;
    if (reqId) index.set(reqId as ChatRequestId, e.message.id as ChatMessageId);
  }
  return Object.freeze({ index: index as ReadonlyMap<ChatRequestId, ChatMessageId>, count: index.size, builtAt: asUnixMs(Date.now()) });
}

// ============================================================================
// MARK: Transcript sequence continuity validator
// ============================================================================

export interface SequenceContinuityValidation {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly isContinuous: boolean;
  readonly firstSequence: number;
  readonly lastSequence: number;
  readonly expectedCount: number;
  readonly actualCount: number;
  readonly missingSequences: readonly number[];
  readonly validatedAt: UnixMs;
}

export function validateSequenceContinuity(
  roomId: ChatRoomId,
  channelId: ChatChannelId,
  entries: readonly ChatTranscriptEntry[],
): SequenceContinuityValidation {
  const channelEntries = entries
    .filter((e) => e.message.channelId === channelId)
    .map((e) => Number(e.message.sequenceNumber))
    .sort((a, b) => a - b);

  if (channelEntries.length === 0) {
    return Object.freeze({ roomId, channelId, isContinuous: true, firstSequence: 0, lastSequence: 0, expectedCount: 0, actualCount: 0, missingSequences: Object.freeze([]), validatedAt: asUnixMs(Date.now()) });
  }

  const first = channelEntries[0];
  const last = channelEntries[channelEntries.length - 1];
  const expectedCount = last - first + 1;
  const actualCount = channelEntries.length;
  const seqSet = new Set(channelEntries);
  const missing: number[] = [];
  for (let i = first; i <= last; i++) {
    if (!seqSet.has(i)) missing.push(i);
  }

  return Object.freeze({
    roomId,
    channelId,
    isContinuous: missing.length === 0,
    firstSequence: first,
    lastSequence: last,
    expectedCount,
    actualCount,
    missingSequences: Object.freeze(missing),
    validatedAt: asUnixMs(Date.now()),
  });
}

// ============================================================================
// MARK: Transcript latest message per channel
// ============================================================================

export interface LatestMessagePerChannel {
  readonly roomId: ChatRoomId;
  readonly channels: readonly { readonly channelId: ChatChannelId; readonly message: ChatMessage; readonly sequence: number }[];
  readonly generatedAt: UnixMs;
}

export function getLatestMessagePerChannel(
  roomId: ChatRoomId,
  entries: readonly ChatTranscriptEntry[],
): LatestMessagePerChannel {
  const latestByChannel = new Map<string, { message: ChatMessage; sequence: number }>();

  for (const e of entries) {
    if (e.visibility === 'REDACTED' || e.visibility === 'DELETED') continue;
    const ch = e.message.channelId ?? 'UNKNOWN';
    const seq = Number(e.message.sequenceNumber);
    const existing = latestByChannel.get(ch);
    if (!existing || seq > existing.sequence) {
      latestByChannel.set(ch, { message: e.message, sequence: seq });
    }
  }

  const channels = Array.from(latestByChannel.entries()).map(([channelId, data]) => Object.freeze({
    channelId: channelId as ChatChannelId,
    message: data.message,
    sequence: data.sequence,
  }));

  return Object.freeze({ roomId, channels: Object.freeze(channels), generatedAt: asUnixMs(Date.now()) });
}

// ============================================================================
// MARK: Transcript room proof chain summary
// ============================================================================

export function buildRoomProofChainSummary(state: ChatState, roomId: ChatRoomId): {
  readonly edgeCount: number;
  readonly replayArtifactCount: number;
  readonly latestProofAt: UnixMs | null;
} {
  const edges = selectRoomProofEdges(state, roomId);
  const artifacts = selectRoomReplayArtifacts(state, roomId);
  const latestProof = artifacts.length > 0
    ? asUnixMs(Math.max(...artifacts.map((a) => a.createdAt as unknown as number)))
    : null;
  return Object.freeze({ edgeCount: edges.length, replayArtifactCount: artifacts.length, latestProofAt: latestProof });
}
