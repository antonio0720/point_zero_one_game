/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT REPLAY INDEX
 * FILE: backend/src/game/engine/chat/replay/ChatReplayIndex.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Fast authoritative lookup, audit, and retrieval for backend replay artifacts.
 *
 * Why this file exists
 * --------------------
 * Chat replay cannot stop at artifact creation. The backend engine also needs a
 * deterministic query plane capable of answering:
 *
 * - what replay covers this message,
 * - what replay is nearest to this sequence,
 * - what replay window came from this event,
 * - which proof edges cover a replay,
 * - which replays overlap a sequence or timestamp range,
 * - where legend / helper / hater / system beats cluster by label,
 * - how replay coverage can be audited without rescanning the entire state on
 *   every call.
 *
 * The frontend may eventually mirror replay navigation, but backend must own
 * the authoritative lookup plane so server transport, engine fanout, audit
 * tooling, evaluation harnesses, and after-action services can all speak the
 * same replay identity language.
 *
 * Relationship to the paired file
 * --------------------------------
 * - ChatReplayAssembler.ts authors and mutates replay artifacts.
 * - ChatReplayIndex.ts indexes and queries them.
 *
 * Replay doctrine
 * ---------------
 * - replay index is a view over authoritative state, not a competing store,
 * - every entry in this index must be derivable from replay + transcript +
 *   proof truth,
 * - the index may cache search material and lookup tables, but it must never
 *   invent transcript content,
 * - a replay lookup should remain cheap enough to serve engine-side audit and
 *   transport-side inspection flows without rescanning full room history.
 * ============================================================================
 */

import {
  asSequenceNumber,
  asUnixMs,
  type ChatChannelId,
  type ChatEventId,
  type ChatMessageId,
  type ChatProofEdge,
  type ChatProofHash,
  type ChatReplayArtifact,
  type ChatReplayId,
  type ChatRoomId,
  type ChatState,
  type ChatTranscriptEntry,
  type JsonValue,
  type SequenceNumber,
  type UnixMs,
} from '../types';
import {
  selectCurrentSequence,
  selectMostRecentReplayAroundSequence,
  selectRoomProofEdges,
  selectRoomReplayArtifacts,
  selectRoomTranscript,
} from '../ChatState';
import {
  collectConversationWindowForMessage,
  getAroundSequence,
  getMostRelevantReplayForMessage,
  getReplayWindow,
  getRoomWindow,
  searchTranscript,
  type ChatTranscriptRoomWindow,
} from '../ChatTranscriptLedger';
import {
  buildMessageCausalClosure,
  buildRoomProofTimeline,
  selectProofEdgesForMessage,
  selectProofEdgesToReplay,
  verifyRoomProofChain,
  type ChatMessageCausalClosure,
  type ChatProofVerificationReport,
  type ChatRoomProofTimeline,
} from '../ChatProofChain';
import {
  assembleReplayBundle,
  createChatReplayAssembler,
  resolveReplayAnchor,
  type ChatReplayAssemblerApi,
  type ChatReplayAssemblyReason,
  type ChatReplayAssemblyRequest,
  type ChatReplayBundle,
  type ChatReplayCoverageIssue,
  type ChatReplayCoverageReport,
  type ChatReplayMessageRole,
  type ChatReplaySceneBeat,
  type ChatReplayWitnessLine,
} from './ChatReplayAssembler';

// ============================================================================
// MARK: Index surface contracts
// ============================================================================

export type ChatReplaySearchDomain =
  | 'LABEL'
  | 'ANCHOR_KEY'
  | 'EVENT_ID'
  | 'MESSAGE_ID'
  | 'TEXT'
  | 'METADATA'
  | 'ALL';

export type ChatReplayRangeMode =
  | 'CONTAINS'
  | 'OVERLAPS'
  | 'NEAREST';

export interface ChatReplayIndexConfig {
  readonly maxSearchResults?: number;
  readonly maxRecentLookups?: number;
  readonly tokenMinLength?: number;
  readonly retainMessageCoverage?: boolean;
  readonly retainProofCoverage?: boolean;
  readonly retainSequenceTables?: boolean;
  readonly retainTimeTables?: boolean;
}

export interface ChatReplayIndexBuildOptions {
  readonly roomIds?: readonly ChatRoomId[];
  readonly includeTranscriptMaterial?: boolean;
  readonly includeProofMaterial?: boolean;
}

export interface ChatReplayRoomIndexEntry {
  readonly replayId: ChatReplayId;
  readonly artifact: ChatReplayArtifact;
  readonly roomId: ChatRoomId;
  readonly eventId: ChatEventId;
  readonly anchorKey: string;
  readonly label: string;
  readonly normalizedLabel: string;
  readonly rangeStart: number;
  readonly rangeEnd: number;
  readonly createdAt: UnixMs;
  readonly proofHash: ChatProofHash | null;
  readonly roomTimeline: ChatRoomProofTimeline;
  readonly proofEdges: readonly ChatProofEdge[];
  readonly messageIds: readonly ChatMessageId[];
  readonly visibleMessageIds: readonly ChatMessageId[];
  readonly shadowMessageIds: readonly ChatMessageId[];
  readonly channels: readonly ChatChannelId[];
  readonly witnessRoles: Readonly<Record<ChatMessageId, ChatReplayMessageRole>>;
  readonly scenes: readonly ChatReplaySceneBeat[];
  readonly witnessLines: readonly ChatReplayWitnessLine[];
  readonly anchorMessageId: ChatMessageId | null;
  readonly anchorSequence: SequenceNumber;
  readonly anchorTimestamp: UnixMs | null;
  readonly transcriptWindow: ChatTranscriptRoomWindow | null;
  readonly bundle: ChatReplayBundle;
  readonly metadataSearchText: string;
  readonly fullTextSearchText: string;
  readonly causalClosure: ChatMessageCausalClosure | null;
}

export interface ChatReplayMessageCoverageEntry {
  readonly messageId: ChatMessageId;
  readonly roomId: ChatRoomId;
  readonly replayIds: readonly ChatReplayId[];
}

export interface ChatReplayEventCoverageEntry {
  readonly eventId: ChatEventId;
  readonly roomId: ChatRoomId;
  readonly replayIds: readonly ChatReplayId[];
}

export interface ChatReplaySequenceCoverageEntry {
  readonly sequenceNumber: SequenceNumber;
  readonly roomId: ChatRoomId;
  readonly replayIds: readonly ChatReplayId[];
}

export interface ChatReplayTimestampCoverageEntry {
  readonly timestamp: UnixMs;
  readonly roomId: ChatRoomId;
  readonly replayIds: readonly ChatReplayId[];
}

export interface ChatReplayRoomIndex {
  readonly roomId: ChatRoomId;
  readonly builtAt: UnixMs;
  readonly artifactCount: number;
  readonly entries: readonly ChatReplayRoomIndexEntry[];
  readonly byReplayId: Readonly<Record<ChatReplayId, ChatReplayRoomIndexEntry>>;
  readonly byAnchorKey: Readonly<Record<string, readonly ChatReplayId[]>>;
  readonly byEventId: Readonly<Record<ChatEventId, readonly ChatReplayId[]>>;
  readonly byMessageId: Readonly<Record<ChatMessageId, readonly ChatReplayId[]>>;
  readonly byLabelToken: Readonly<Record<string, readonly ChatReplayId[]>>;
  readonly byMetadataToken: Readonly<Record<string, readonly ChatReplayId[]>>;
  readonly byTextToken: Readonly<Record<string, readonly ChatReplayId[]>>;
  readonly sequenceCoverage: readonly ChatReplaySequenceCoverageEntry[];
  readonly timestampCoverage: readonly ChatReplayTimestampCoverageEntry[];
  readonly proofVerification: ChatProofVerificationReport;
  readonly issues: readonly ChatReplayCoverageIssue[];
}

export interface ChatReplayGlobalIndex {
  readonly builtAt: UnixMs;
  readonly roomIds: readonly ChatRoomId[];
  readonly rooms: Readonly<Record<ChatRoomId, ChatReplayRoomIndex>>;
  readonly byReplayId: Readonly<Record<ChatReplayId, ChatReplayRoomIndexEntry>>;
  readonly recentReplayIds: readonly ChatReplayId[];
}

export interface ChatReplaySearchRequest {
  readonly roomId?: ChatRoomId | null;
  readonly query: string;
  readonly domain?: ChatReplaySearchDomain;
  readonly limit?: number;
}

export interface ChatReplaySearchHit {
  readonly replayId: ChatReplayId;
  readonly roomId: ChatRoomId;
  readonly score: number;
  readonly matchedDomain: ChatReplaySearchDomain;
  readonly matchedTerms: readonly string[];
  readonly entry: ChatReplayRoomIndexEntry;
}

export interface ChatReplayRangeQuery {
  readonly roomId: ChatRoomId;
  readonly startSequence?: SequenceNumber | null;
  readonly endSequence?: SequenceNumber | null;
  readonly startTimestamp?: UnixMs | null;
  readonly endTimestamp?: UnixMs | null;
  readonly mode?: ChatReplayRangeMode;
  readonly limit?: number;
}

export interface ChatReplayIndexDiagnostics {
  readonly builtAt: UnixMs;
  readonly roomCount: number;
  readonly replayCount: number;
  readonly recentReplayIds: readonly ChatReplayId[];
  readonly orphanReplayIds: readonly ChatReplayId[];
  readonly duplicateAnchorKeys: readonly string[];
  readonly roomIssueCounts: Readonly<Record<ChatRoomId, number>>;
}

// ============================================================================
// MARK: Default config
// ============================================================================

const DEFAULT_CONFIG: Required<ChatReplayIndexConfig> = Object.freeze({
  maxSearchResults: 24,
  maxRecentLookups: 256,
  tokenMinLength: 2,
  retainMessageCoverage: true,
  retainProofCoverage: true,
  retainSequenceTables: true,
  retainTimeTables: true,
});

// ============================================================================
// MARK: Public construction
// ============================================================================

export function createChatReplayIndex(
  config: ChatReplayIndexConfig = {},
  assembler: ChatReplayAssemblerApi = createChatReplayAssembler(),
) {
  const resolved = { ...DEFAULT_CONFIG, ...config };

  return {
    config: resolved,
    assembler,
    build(state: ChatState, options: ChatReplayIndexBuildOptions = {}): ChatReplayGlobalIndex {
      return buildReplayGlobalIndex(resolved, assembler, state, options);
    },
    buildRoom(state: ChatState, roomId: ChatRoomId): ChatReplayRoomIndex {
      return buildReplayRoomIndex(resolved, assembler, state, roomId, {
        includeTranscriptMaterial: true,
        includeProofMaterial: true,
      });
    },
    findReplay(state: ChatState, roomId: ChatRoomId, replayId: ChatReplayId): ChatReplayRoomIndexEntry | null {
      return buildReplayRoomIndex(resolved, assembler, state, roomId, {
        includeTranscriptMaterial: true,
        includeProofMaterial: true,
      }).byReplayId[replayId] ?? null;
    },
    findByAnchorKey(state: ChatState, roomId: ChatRoomId, anchorKey: string): readonly ChatReplayRoomIndexEntry[] {
      const roomIndex = buildReplayRoomIndex(resolved, assembler, state, roomId, {
        includeTranscriptMaterial: true,
        includeProofMaterial: true,
      });
      return (roomIndex.byAnchorKey[anchorKey] ?? []).map((replayId) => roomIndex.byReplayId[replayId]).filter(Boolean);
    },
    findByEventId(state: ChatState, roomId: ChatRoomId, eventId: ChatEventId): readonly ChatReplayRoomIndexEntry[] {
      const roomIndex = buildReplayRoomIndex(resolved, assembler, state, roomId, {
        includeTranscriptMaterial: true,
        includeProofMaterial: true,
      });
      return (roomIndex.byEventId[eventId] ?? []).map((replayId) => roomIndex.byReplayId[replayId]).filter(Boolean);
    },
    findContainingMessage(state: ChatState, roomId: ChatRoomId, messageId: ChatMessageId): readonly ChatReplayRoomIndexEntry[] {
      const roomIndex = buildReplayRoomIndex(resolved, assembler, state, roomId, {
        includeTranscriptMaterial: true,
        includeProofMaterial: true,
      });
      return (roomIndex.byMessageId[messageId] ?? []).map((replayId) => roomIndex.byReplayId[replayId]).filter(Boolean);
    },
    findNearestSequence(
      state: ChatState,
      roomId: ChatRoomId,
      sequenceNumber: SequenceNumber,
    ): ChatReplayRoomIndexEntry | null {
      const roomIndex = buildReplayRoomIndex(resolved, assembler, state, roomId, {
        includeTranscriptMaterial: true,
        includeProofMaterial: true,
      });
      return findNearestSequenceEntry(roomIndex, sequenceNumber);
    },
    queryRange(state: ChatState, request: ChatReplayRangeQuery): readonly ChatReplayRoomIndexEntry[] {
      const roomIndex = buildReplayRoomIndex(resolved, assembler, state, request.roomId, {
        includeTranscriptMaterial: true,
        includeProofMaterial: true,
      });
      return queryReplayRange(roomIndex, request);
    },
    search(state: ChatState, request: ChatReplaySearchRequest): readonly ChatReplaySearchHit[] {
      const global = buildReplayGlobalIndex(resolved, assembler, state, {
        roomIds: request.roomId ? [request.roomId] : undefined,
        includeTranscriptMaterial: true,
        includeProofMaterial: true,
      });
      return searchReplayIndex(resolved, global, request);
    },
    diagnostics(state: ChatState): ChatReplayIndexDiagnostics {
      return buildReplayDiagnostics(resolved, assembler, state);
    },
  };
}

export type ChatReplayIndexApi = ReturnType<typeof createChatReplayIndex>;

// ============================================================================
// MARK: Build routines
// ============================================================================

export function buildReplayGlobalIndex(
  config: Required<ChatReplayIndexConfig>,
  assembler: ChatReplayAssemblerApi,
  state: ChatState,
  options: ChatReplayIndexBuildOptions,
): ChatReplayGlobalIndex {
  const builtAt = asUnixMs(assembler.ports.clock.now());
  const roomIds = options.roomIds
    ? [...options.roomIds]
    : Object.keys(state.rooms).map((roomId) => roomId as ChatRoomId);

  const rooms: Record<ChatRoomId, ChatReplayRoomIndex> = {};
  const byReplayId: Record<ChatReplayId, ChatReplayRoomIndexEntry> = {};
  const recent: ChatReplayRoomIndexEntry[] = [];

  for (const roomId of roomIds) {
    const roomIndex = buildReplayRoomIndex(config, assembler, state, roomId, options);
    rooms[roomId] = roomIndex;
    for (const entry of roomIndex.entries) {
      byReplayId[entry.replayId] = entry;
      recent.push(entry);
    }
  }

  recent.sort((left, right) => Number(right.createdAt) - Number(left.createdAt));

  return {
    builtAt,
    roomIds,
    rooms,
    byReplayId: byReplayId as ChatReplayGlobalIndex['byReplayId'],
    recentReplayIds: recent.slice(0, config.maxRecentLookups).map((entry) => entry.replayId),
  };
}

export function buildReplayRoomIndex(
  config: Required<ChatReplayIndexConfig>,
  assembler: ChatReplayAssemblerApi,
  state: ChatState,
  roomId: ChatRoomId,
  options: ChatReplayIndexBuildOptions,
): ChatReplayRoomIndex {
  const builtAt = asUnixMs(assembler.ports.clock.now());
  const artifacts = [...selectRoomReplayArtifacts(state, roomId)].sort((left, right) => {
    return Number(left.createdAt) - Number(right.createdAt);
  });
  const roomTimeline = buildRoomProofTimeline(assembler.proofContext, state, roomId);
  const coverage = assembler.verifyRoom(state, roomId);

  const entries: ChatReplayRoomIndexEntry[] = [];
  const byReplayId: Record<ChatReplayId, ChatReplayRoomIndexEntry> = {};
  const byAnchorKey: Record<string, ChatReplayId[]> = {};
  const byEventId: Record<ChatEventId, ChatReplayId[]> = {};
  const byMessageId: Record<ChatMessageId, ChatReplayId[]> = {};
  const byLabelToken: Record<string, ChatReplayId[]> = {};
  const byMetadataToken: Record<string, ChatReplayId[]> = {};
  const byTextToken: Record<string, ChatReplayId[]> = {};
  const sequenceCoverage: ChatReplaySequenceCoverageEntry[] = [];
  const timestampCoverage: ChatReplayTimestampCoverageEntry[] = [];

  for (const artifact of artifacts) {
    const bundle = assembler.assembleBundleByReplayId(state, roomId, artifact.id);
    if (!bundle) {
      continue;
    }

    const transcriptWindow = bundle.transcriptWindow;
    const messageIds = transcriptWindow?.entries.map((entry) => entry.message.id) ?? [];
    const visibleMessageIds = bundle.visibleEntries.map((entry) => entry.message.id);
    const shadowMessageIds = bundle.shadowEntries.map((entry) => entry.message.id);
    const channels = dedupeStrings(transcriptWindow?.entries.map((entry) => entry.message.channelId) ?? []) as readonly ChatChannelId[];
    const witnessRoles = buildWitnessRoleMap(bundle.witnessLines);
    const proofEdges = selectProofEdgesToReplay(state.proofChain, roomId, artifact.id);
    const fullTextSearchText = buildFullTextSearchText(bundle);
    const metadataSearchText = buildMetadataSearchText(artifact.metadata);
    const proofHash = proofEdges[0]?.hash ?? bundle.entries.find((entry) => entry.message.proof.proofHash)?.message.proof.proofHash ?? null;
    const causalClosure = bundle.anchor.anchorMessageId
      ? buildMessageCausalClosure(state, roomId, bundle.anchor.anchorMessageId)
      : null;

    const entry: ChatReplayRoomIndexEntry = {
      replayId: artifact.id,
      artifact,
      roomId,
      eventId: artifact.eventId,
      anchorKey: artifact.anchorKey,
      label: artifact.label,
      normalizedLabel: normalizeSearchText(artifact.label),
      rangeStart: artifact.range.start,
      rangeEnd: artifact.range.end,
      createdAt: artifact.createdAt,
      proofHash,
      roomTimeline,
      proofEdges,
      messageIds,
      visibleMessageIds,
      shadowMessageIds,
      channels,
      witnessRoles,
      scenes: bundle.scenes,
      witnessLines: bundle.witnessLines,
      anchorMessageId: bundle.anchor.anchorMessageId,
      anchorSequence: bundle.anchor.anchorSequence,
      anchorTimestamp: bundle.anchor.anchorTimestamp,
      transcriptWindow,
      bundle,
      metadataSearchText,
      fullTextSearchText,
      causalClosure,
    };

    entries.push(entry);
    byReplayId[artifact.id] = entry;
    pushIndexArray(byAnchorKey, artifact.anchorKey, artifact.id);
    pushIndexArray(byEventId, artifact.eventId, artifact.id);

    for (const messageId of messageIds) {
      pushIndexArray(byMessageId, messageId, artifact.id);
    }

    for (const token of tokenize(artifact.label, config.tokenMinLength)) {
      pushIndexArray(byLabelToken, token, artifact.id);
    }

    for (const token of tokenize(metadataSearchText, config.tokenMinLength)) {
      pushIndexArray(byMetadataToken, token, artifact.id);
    }

    for (const token of tokenize(fullTextSearchText, config.tokenMinLength)) {
      pushIndexArray(byTextToken, token, artifact.id);
    }

    if (config.retainSequenceTables) {
      const seenSequences = new Set<number>();
      for (let sequence = artifact.range.start; sequence <= artifact.range.end; sequence += 1) {
        if (seenSequences.has(sequence)) {
          continue;
        }
        seenSequences.add(sequence);
        sequenceCoverage.push({
          sequenceNumber: asSequenceNumber(sequence),
          roomId,
          replayIds: [artifact.id],
        });
      }
    }

    if (config.retainTimeTables) {
      const times = dedupeNumbers(bundle.entries.map((candidate) => Number(candidate.message.createdAt)));
      for (const time of times) {
        timestampCoverage.push({
          timestamp: asUnixMs(time),
          roomId,
          replayIds: [artifact.id],
        });
      }
    }
  }

  return {
    roomId,
    builtAt,
    artifactCount: entries.length,
    entries,
    byReplayId: byReplayId as ChatReplayRoomIndex['byReplayId'],
    byAnchorKey: freezeIndexRecord(byAnchorKey),
    byEventId: byEventId as ChatReplayRoomIndex['byEventId'],
    byMessageId: byMessageId as ChatReplayRoomIndex['byMessageId'],
    byLabelToken: freezeIndexRecord(byLabelToken),
    byMetadataToken: freezeIndexRecord(byMetadataToken),
    byTextToken: freezeIndexRecord(byTextToken),
    sequenceCoverage: mergeSequenceCoverage(sequenceCoverage),
    timestampCoverage: mergeTimestampCoverage(timestampCoverage),
    proofVerification: coverage.proofVerification,
    issues: coverage.issues,
  };
}

// ============================================================================
// MARK: Search and range querying
// ============================================================================

export function searchReplayIndex(
  config: Required<ChatReplayIndexConfig>,
  global: ChatReplayGlobalIndex,
  request: ChatReplaySearchRequest,
): readonly ChatReplaySearchHit[] {
  const normalizedQuery = normalizeSearchText(request.query);
  if (!normalizedQuery) {
    return [];
  }

  const tokens = tokenize(normalizedQuery, config.tokenMinLength);
  if (tokens.length === 0) {
    return [];
  }

  const roomIndexes = request.roomId
    ? [global.rooms[request.roomId]].filter(Boolean)
    : Object.values(global.rooms);
  const hits: ChatReplaySearchHit[] = [];

  for (const roomIndex of roomIndexes) {
    const candidateIds = new Set<ChatReplayId>();
    const domain = request.domain ?? 'ALL';

    for (const token of tokens) {
      if (domain === 'LABEL' || domain === 'ALL') {
        for (const replayId of roomIndex.byLabelToken[token] ?? []) {
          candidateIds.add(replayId);
        }
      }
      if (domain === 'ANCHOR_KEY' || domain === 'ALL') {
        for (const replayId of roomIndex.byAnchorKey[token] ?? []) {
          candidateIds.add(replayId);
        }
      }
      if (domain === 'METADATA' || domain === 'ALL') {
        for (const replayId of roomIndex.byMetadataToken[token] ?? []) {
          candidateIds.add(replayId);
        }
      }
      if (domain === 'TEXT' || domain === 'ALL') {
        for (const replayId of roomIndex.byTextToken[token] ?? []) {
          candidateIds.add(replayId);
        }
      }
    }

    if ((domain === 'EVENT_ID' || domain === 'ALL') && looksLikeEventId(request.query)) {
      const eventId = request.query as ChatEventId;
      for (const replayId of roomIndex.byEventId[eventId] ?? []) {
        candidateIds.add(replayId);
      }
    }

    if ((domain === 'MESSAGE_ID' || domain === 'ALL') && looksLikeMessageId(request.query)) {
      const messageId = request.query as ChatMessageId;
      for (const replayId of roomIndex.byMessageId[messageId] ?? []) {
        candidateIds.add(replayId);
      }
    }

    for (const replayId of candidateIds) {
      const entry = roomIndex.byReplayId[replayId];
      if (!entry) {
        continue;
      }
      const scored = scoreReplaySearchHit(entry, tokens, request.domain ?? 'ALL');
      if (scored.score <= 0) {
        continue;
      }
      hits.push(scored);
    }
  }

  hits.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return Number(right.entry.createdAt) - Number(left.entry.createdAt);
  });

  return hits.slice(0, Math.max(1, request.limit ?? config.maxSearchResults));
}

export function queryReplayRange(
  roomIndex: ChatReplayRoomIndex,
  request: ChatReplayRangeQuery,
): readonly ChatReplayRoomIndexEntry[] {
  const mode = request.mode ?? 'OVERLAPS';
  const limit = Math.max(1, request.limit ?? 24);
  const candidates = roomIndex.entries.filter((entry) => rangeEntryMatches(entry, request, mode));

  if (mode === 'NEAREST') {
    candidates.sort((left, right) => nearestDistance(left, request) - nearestDistance(right, request));
  } else {
    candidates.sort((left, right) => Number(right.createdAt) - Number(left.createdAt));
  }

  return candidates.slice(0, limit);
}

export function findNearestSequenceEntry(
  roomIndex: ChatReplayRoomIndex,
  sequenceNumber: SequenceNumber,
): ChatReplayRoomIndexEntry | null {
  let winner: ChatReplayRoomIndexEntry | null = null;
  let distance = Number.POSITIVE_INFINITY;

  for (const entry of roomIndex.entries) {
    const candidateDistance = sequenceDistance(entry, sequenceNumber);
    if (candidateDistance < distance) {
      distance = candidateDistance;
      winner = entry;
    }
  }

  return winner;
}

// ============================================================================
// MARK: Diagnostics
// ============================================================================

export function buildReplayDiagnostics(
  config: Required<ChatReplayIndexConfig>,
  assembler: ChatReplayAssemblerApi,
  state: ChatState,
): ChatReplayIndexDiagnostics {
  const global = buildReplayGlobalIndex(config, assembler, state, {
    includeTranscriptMaterial: true,
    includeProofMaterial: true,
  });

  const orphanReplayIds: ChatReplayId[] = [];
  const duplicateAnchorKeys: string[] = [];
  const anchorOwners = new Map<string, ChatReplayId>();
  const roomIssueCounts: Record<ChatRoomId, number> = {};

  for (const roomIndex of Object.values(global.rooms)) {
    roomIssueCounts[roomIndex.roomId] = roomIndex.issues.length;

    for (const entry of roomIndex.entries) {
      if (entry.messageIds.length === 0) {
        orphanReplayIds.push(entry.replayId);
      }
      const prior = anchorOwners.get(entry.anchorKey);
      if (prior && prior !== entry.replayId) {
        duplicateAnchorKeys.push(entry.anchorKey);
      } else {
        anchorOwners.set(entry.anchorKey, entry.replayId);
      }
    }
  }

  return {
    builtAt: global.builtAt,
    roomCount: global.roomIds.length,
    replayCount: Object.keys(global.byReplayId).length,
    recentReplayIds: global.recentReplayIds,
    orphanReplayIds,
    duplicateAnchorKeys: dedupeStrings(duplicateAnchorKeys),
    roomIssueCounts,
  };
}

// ============================================================================
// MARK: Scoring and matching
// ============================================================================

function scoreReplaySearchHit(
  entry: ChatReplayRoomIndexEntry,
  tokens: readonly string[],
  domain: ChatReplaySearchDomain,
): ChatReplaySearchHit {
  let score = 0;
  const matchedTerms: string[] = [];
  let matchedDomain: ChatReplaySearchDomain = domain;

  for (const token of tokens) {
    if ((domain === 'LABEL' || domain === 'ALL') && entry.normalizedLabel.includes(token)) {
      score += 12;
      matchedTerms.push(token);
      matchedDomain = matchedDomain === 'ALL' ? 'LABEL' : matchedDomain;
      continue;
    }

    if ((domain === 'ANCHOR_KEY' || domain === 'ALL') && entry.anchorKey.includes(token)) {
      score += 10;
      matchedTerms.push(token);
      matchedDomain = matchedDomain === 'ALL' ? 'ANCHOR_KEY' : matchedDomain;
      continue;
    }

    if ((domain === 'METADATA' || domain === 'ALL') && entry.metadataSearchText.includes(token)) {
      score += 8;
      matchedTerms.push(token);
      matchedDomain = matchedDomain === 'ALL' ? 'METADATA' : matchedDomain;
      continue;
    }

    if ((domain === 'TEXT' || domain === 'ALL') && entry.fullTextSearchText.includes(token)) {
      score += 6;
      matchedTerms.push(token);
      matchedDomain = matchedDomain === 'ALL' ? 'TEXT' : matchedDomain;
      continue;
    }
  }

  if (entry.bundle.artifact.label.toLowerCase().includes('legend')) {
    score += 1;
  }
  if (entry.bundle.witnessLines.some((line) => line.role === 'RESCUE')) {
    score += 1;
  }
  if (entry.bundle.witnessLines.some((line) => line.role === 'ESCALATION')) {
    score += 1;
  }

  return {
    replayId: entry.replayId,
    roomId: entry.roomId,
    score,
    matchedDomain,
    matchedTerms: dedupeStrings(matchedTerms),
    entry,
  };
}

function rangeEntryMatches(
  entry: ChatReplayRoomIndexEntry,
  request: ChatReplayRangeQuery,
  mode: ChatReplayRangeMode,
): boolean {
  const startSequence = request.startSequence ? Number(request.startSequence) : null;
  const endSequence = request.endSequence ? Number(request.endSequence) : null;
  const startTimestamp = request.startTimestamp ? Number(request.startTimestamp) : null;
  const endTimestamp = request.endTimestamp ? Number(request.endTimestamp) : null;

  const sequenceMatch = (() => {
    if (startSequence == null && endSequence == null) {
      return true;
    }

    const entryStart = entry.rangeStart;
    const entryEnd = entry.rangeEnd;
    const targetStart = startSequence ?? endSequence ?? entryStart;
    const targetEnd = endSequence ?? startSequence ?? entryEnd;

    if (mode === 'CONTAINS') {
      return entryStart <= targetStart && entryEnd >= targetEnd;
    }
    if (mode === 'OVERLAPS') {
      return entryStart <= targetEnd && entryEnd >= targetStart;
    }
    return true;
  })();

  const timestampMatch = (() => {
    if (startTimestamp == null && endTimestamp == null) {
      return true;
    }
    const values = entry.bundle.entries.map((candidate) => Number(candidate.message.createdAt));
    if (values.length === 0) {
      return false;
    }
    const entryStart = Math.min(...values);
    const entryEnd = Math.max(...values);
    const targetStart = startTimestamp ?? endTimestamp ?? entryStart;
    const targetEnd = endTimestamp ?? startTimestamp ?? entryEnd;

    if (mode === 'CONTAINS') {
      return entryStart <= targetStart && entryEnd >= targetEnd;
    }
    if (mode === 'OVERLAPS') {
      return entryStart <= targetEnd && entryEnd >= targetStart;
    }
    return true;
  })();

  return sequenceMatch && timestampMatch;
}

function nearestDistance(
  entry: ChatReplayRoomIndexEntry,
  request: ChatReplayRangeQuery,
): number {
  if (request.startSequence || request.endSequence) {
    const target = request.startSequence ?? request.endSequence ?? asSequenceNumber(entry.rangeStart);
    return sequenceDistance(entry, target);
  }

  if (request.startTimestamp || request.endTimestamp) {
    const target = Number(request.startTimestamp ?? request.endTimestamp ?? entry.createdAt);
    const values = entry.bundle.entries.map((candidate) => Number(candidate.message.createdAt));
    if (values.length === 0) {
      return Number.POSITIVE_INFINITY;
    }
    return Math.min(...values.map((value) => Math.abs(value - target)));
  }

  return 0;
}

function sequenceDistance(entry: ChatReplayRoomIndexEntry, sequenceNumber: SequenceNumber): number {
  const target = Number(sequenceNumber);
  if (target >= entry.rangeStart && target <= entry.rangeEnd) {
    return 0;
  }
  return Math.min(Math.abs(entry.rangeStart - target), Math.abs(entry.rangeEnd - target));
}

// ============================================================================
// MARK: Index shaping helpers
// ============================================================================

function buildWitnessRoleMap(
  witnessLines: readonly ChatReplayWitnessLine[],
): Readonly<Record<ChatMessageId, ChatReplayMessageRole>> {
  const out: Record<ChatMessageId, ChatReplayMessageRole> = {} as Record<ChatMessageId, ChatReplayMessageRole>;
  for (const line of witnessLines) {
    out[line.messageId] = line.role;
  }
  return out;
}

function buildFullTextSearchText(bundle: ChatReplayBundle): string {
  const messageText = bundle.entries.map((entry) => entry.message.plainText).join(' ');
  const witnessText = bundle.witnessLines.map((line) => `${line.displayName} ${line.plainText}`).join(' ');
  const sceneText = bundle.scenes.map((scene) => `${scene.sceneClass} ${scene.tags.join(' ')}`).join(' ');
  const previewText = bundle.exportPreview.join(' ');
  return normalizeSearchText([messageText, witnessText, sceneText, previewText].join(' '));
}

function buildMetadataSearchText(metadata: Readonly<Record<string, JsonValue>>): string {
  return normalizeSearchText(flattenMetadata(metadata));
}

function flattenMetadata(metadata: Readonly<Record<string, JsonValue>>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(metadata)) {
    parts.push(key);
    parts.push(flattenJsonValue(value));
  }
  return parts.join(' ');
}

function flattenJsonValue(value: JsonValue): string {
  if (value == null) {
    return 'null';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => flattenJsonValue(item as JsonValue)).join(' ');
  }
  return Object.entries(value)
    .flatMap(([key, item]) => [key, flattenJsonValue(item as JsonValue)])
    .join(' ');
}

function normalizeSearchText(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9:_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(input: string, minLength: number): readonly string[] {
  return dedupeStrings(
    normalizeSearchText(input)
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length >= minLength),
  );
}

function pushIndexArray<TKey extends string>(
  target: Record<TKey, ChatReplayId[]>,
  key: TKey,
  replayId: ChatReplayId,
): void {
  const bucket = target[key] ?? [];
  if (!bucket.includes(replayId)) {
    bucket.push(replayId);
  }
  target[key] = bucket;
}

function mergeSequenceCoverage(
  entries: readonly ChatReplaySequenceCoverageEntry[],
): readonly ChatReplaySequenceCoverageEntry[] {
  const merged = new Map<string, Set<ChatReplayId>>();
  for (const entry of entries) {
    const key = `${String(entry.roomId)}|${String(entry.sequenceNumber)}`;
    const bucket = merged.get(key) ?? new Set<ChatReplayId>();
    for (const replayId of entry.replayIds) {
      bucket.add(replayId);
    }
    merged.set(key, bucket);
  }

  return [...merged.entries()].map(([key, bucket]) => {
    const [roomId, sequenceString] = key.split('|');
    return {
      sequenceNumber: asSequenceNumber(Number(sequenceString)),
      roomId: roomId as ChatRoomId,
      replayIds: [...bucket],
    };
  });
}

function mergeTimestampCoverage(
  entries: readonly ChatReplayTimestampCoverageEntry[],
): readonly ChatReplayTimestampCoverageEntry[] {
  const merged = new Map<string, Set<ChatReplayId>>();
  for (const entry of entries) {
    const key = `${String(entry.roomId)}|${String(entry.timestamp)}`;
    const bucket = merged.get(key) ?? new Set<ChatReplayId>();
    for (const replayId of entry.replayIds) {
      bucket.add(replayId);
    }
    merged.set(key, bucket);
  }

  return [...merged.entries()].map(([key, bucket]) => {
    const [roomId, timestampString] = key.split('|');
    return {
      timestamp: asUnixMs(Number(timestampString)),
      roomId: roomId as ChatRoomId,
      replayIds: [...bucket],
    };
  });
}

function freezeIndexRecord<TValue extends string>(
  source: Record<string, TValue[]>,
): Readonly<Record<string, readonly TValue[]>> {
  const out: Record<string, readonly TValue[]> = {};
  for (const [key, value] of Object.entries(source)) {
    out[key] = dedupeStrings(value);
  }
  return out;
}

function dedupeStrings<T extends string>(values: readonly T[]): readonly T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const key = String(value);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(value);
  }
  return out;
}

function dedupeNumbers(values: readonly number[]): readonly number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
  }
  return out;
}

function looksLikeEventId(value: string): boolean {
  return /^evt[_:]/i.test(value.trim());
}

function looksLikeMessageId(value: string): boolean {
  return /^msg[_:]/i.test(value.trim());
}
