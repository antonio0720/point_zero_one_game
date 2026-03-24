/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT REPLAY ASSEMBLER
 * FILE: backend/src/game/engine/chat/replay/ChatReplayAssembler.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Backend replay assembly authority for the canonical chat engine.
 *
 * Why this file exists in the backend chat lane
 * ---------------------------------------------
 * The backend chat engine already owns transcript truth, proof edges, policy
 * enforcement, NPC timing, and authoritative message sequencing. Replay cannot
 * be treated as a frontend view-only ornament because the replay artifact is an
 * auditable backend product that must answer all of the following:
 *
 * 1. what transcript window is being preserved,
 * 2. what message / event / sequence / timestamp anchored it,
 * 3. which proof edges cover it,
 * 4. what authored scene classes exist inside the window,
 * 5. which witness lines, helper beats, hater spikes, and legend moments it
 *    captures,
 * 6. how it should be compacted, repaired, reconciled, and re-indexed.
 *
 * Backend doctrine
 * ----------------
 * - replay is a view over authoritative transcript truth, not a second
 *   transcript,
 * - replay artifacts belong beside transcript and proof truth,
 * - replay windows must remain reconstructible from range + ledger + proof,
 * - replay creation may be heuristic, but replay persistence must be
 *   deterministic,
 * - frontend may mirror replay slices later, but backend owns durable replay
 *   artifact identity and coverage,
 * - replay law must preserve visible/shadow distinctions rather than flattening
 *   them into one undifferentiated export.
 *
 * Architectural role
 * ------------------
 * This file sits between:
 * - ChatTranscriptLedger.ts          -> transcript window recovery
 * - ChatProofChain.ts                -> proof coverage and causal closure
 * - ChatState.ts                     -> authoritative replay artifact mutation
 * - ChatEngine.ts                    -> orchestration that emits replay outputs
 * - ChatReplayIndex.ts               -> fast lookup and audit retrieval
 *
 * Permanent fit inside the tree you locked
 * ----------------------------------------
 * backend/src/game/engine/chat/replay/
 *   ChatReplayAssembler.ts
 *   ChatReplayIndex.ts
 *
 * This file is the authoring / assembly / mutation lane.
 * ChatReplayIndex.ts is the lookup / query / audit lane.
 * ============================================================================
 */

import {
  CHAT_RUNTIME_DEFAULTS,
  asSequenceNumber,
  asUnixMs,
  type ChatChannelId,
  type ChatEventId,
  type ChatHashPort,
  type ChatMessage,
  type ChatMessageId,
  type ChatProofEdge,
  type ChatProofHash,
  type ChatRange,
  type ChatReplayArtifact,
  type ChatReplayId,
  type ChatRoomId,
  type ChatRoomState,
  type ChatState,
  type ChatTranscriptEntry,
  type JsonValue,
  type SequenceNumber,
  type UnixMs,
} from '../types';
import {
  appendProofEdge,
  appendReplayArtifact,
  cloneChatState,
  removeReplayArtifact,
  selectCurrentSequence,
  selectMostRecentReplayAroundSequence,
  selectRoomProofEdges,
  selectRoomReplayArtifacts,
  selectRoomTranscript,
} from '../ChatState';
import {
  auditRoomSequences,
  collectConversationWindowForMessage,
  collectLatestShadowWindow,
  collectLatestVisibleWindow,
  collectProofEdgesForMessage,
  exportTranscriptLines,
  getAroundSequence,
  getMostRelevantReplayForMessage,
  getReplayWindow,
  getRoomWindow,
  type ChatTranscriptRoomWindow,
} from '../ChatTranscriptLedger';
import {
  buildMessageCausalClosure,
  buildRoomProofTimeline,
  createChatProofChainContext,
  createProofEdgesForReplayArtifacts,
  selectProofEdgesToReplay,
  verifyRoomProofChain,
  type ChatMessageCausalClosure,
  type ChatProofChainContext,
  type ChatProofVerificationReport,
  type ChatRoomProofTimeline,
} from '../ChatProofChain';

// ============================================================================
// MARK: Assembly policy surfaces
// ============================================================================

export type ChatReplayAssemblyReason =
  | 'PLAYER_MESSAGE_ACCEPTED'
  | 'NPC_MESSAGE_EMITTED'
  | 'HELPER_INTERVENTION'
  | 'HATER_ESCALATION'
  | 'INVASION_OPENED'
  | 'INVASION_CLOSED'
  | 'SYSTEM_NOTICE'
  | 'LEGEND_MOMENT'
  | 'MANUAL_REQUEST'
  | 'POST_RUN_RITUAL'
  | 'RECONCILIATION'
  | 'RECOVERY_REPAIR';

export type ChatReplayAnchorStrategy =
  | 'LATEST_VISIBLE'
  | 'LATEST_ANY'
  | 'MESSAGE_ID'
  | 'SEQUENCE'
  | 'EVENT_ID'
  | 'TIMESTAMP'
  | 'REPLAY_ID'
  | 'EXPLICIT_RANGE';

export type ChatReplaySceneClass =
  | 'SYSTEM_ARC'
  | 'PLAYER_PUSH'
  | 'HELPER_BEAT'
  | 'HATER_SPIKE'
  | 'CROWD_WITNESS'
  | 'NEGOTIATION_SWING'
  | 'RITUAL_CLOSE'
  | 'MIXED_SCENE';

export type ChatReplayMessageRole =
  | 'ANCHOR'
  | 'WITNESS'
  | 'SUPPORT'
  | 'ESCALATION'
  | 'RESCUE'
  | 'SYSTEM_FRAME'
  | 'SHADOW_CONTEXT';

export interface ChatReplayAssemblerClockPort {
  now(): number;
}

export interface ChatReplayAssemblerIdPort {
  replayId(prefix?: string): ChatReplayId;
}

export interface ChatReplayAssemblerLoggerPort {
  debug(message: string, context?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, context?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, context?: Readonly<Record<string, JsonValue>>): void;
}

export interface ChatReplayAssemblerPorts {
  readonly clock: ChatReplayAssemblerClockPort;
  readonly ids: ChatReplayAssemblerIdPort;
  readonly hash: ChatHashPort;
  readonly logger: ChatReplayAssemblerLoggerPort;
}

export interface ChatReplayAssemblerOptions {
  readonly ports?: Partial<ChatReplayAssemblerPorts>;
}

export interface ChatReplayAssemblyRequest {
  readonly roomId: ChatRoomId;
  readonly label: string;
  readonly reason: ChatReplayAssemblyReason;
  readonly strategy?: ChatReplayAnchorStrategy;
  readonly eventId?: ChatEventId | null;
  readonly anchorMessageId?: ChatMessageId | null;
  readonly anchorSequence?: SequenceNumber | null;
  readonly anchorTimestamp?: UnixMs | null;
  readonly replayId?: ChatReplayId | null;
  readonly explicitRange?: ChatRange | null;
  readonly radiusBefore?: number;
  readonly radiusAfter?: number;
  readonly includeShadow?: boolean;
  readonly forceCreateWhenEmpty?: boolean;
  readonly dedupeByAnchorKey?: boolean;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface ChatReplayResolvedAnchor {
  readonly strategy: ChatReplayAnchorStrategy;
  readonly roomId: ChatRoomId;
  readonly eventId: ChatEventId | null;
  readonly anchorMessageId: ChatMessageId | null;
  readonly anchorSequence: SequenceNumber;
  readonly anchorTimestamp: UnixMs | null;
  readonly range: ChatRange;
  readonly window: ChatTranscriptRoomWindow | null;
}

export interface ChatReplaySceneBeat {
  readonly id: string;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly sceneClass: ChatReplaySceneClass;
  readonly startSequence: SequenceNumber;
  readonly endSequence: SequenceNumber;
  readonly startedAt: UnixMs;
  readonly endedAt: UnixMs;
  readonly messageIds: readonly ChatMessageId[];
  readonly witnessCount: number;
  readonly tags: readonly string[];
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ChatReplayWitnessLine {
  readonly messageId: ChatMessageId;
  readonly role: ChatReplayMessageRole;
  readonly channelId: ChatChannelId;
  readonly sequenceNumber: SequenceNumber;
  readonly createdAt: UnixMs;
  readonly actorId: string;
  readonly displayName: string;
  readonly plainText: string;
  readonly proofHash: ChatProofHash | null;
  readonly tags: readonly string[];
}

export interface ChatReplayBundle {
  readonly artifact: ChatReplayArtifact;
  readonly room: ChatRoomState;
  readonly anchor: ChatReplayResolvedAnchor;
  readonly transcriptWindow: ChatTranscriptRoomWindow | null;
  readonly entries: readonly ChatTranscriptEntry[];
  readonly visibleEntries: readonly ChatTranscriptEntry[];
  readonly shadowEntries: readonly ChatTranscriptEntry[];
  readonly witnessLines: readonly ChatReplayWitnessLine[];
  readonly scenes: readonly ChatReplaySceneBeat[];
  readonly proofTimeline: ChatRoomProofTimeline;
  readonly replayProofEdges: readonly ChatProofEdge[];
  readonly anchorCausalClosure: ChatMessageCausalClosure | null;
  readonly transcriptAuditWarnings: readonly string[];
  readonly exportPreview: readonly string[];
}

export interface ChatReplayArtifactEnvelope {
  readonly artifact: ChatReplayArtifact;
  readonly anchor: ChatReplayResolvedAnchor;
  readonly sourceMessageIds: readonly ChatMessageId[];
  readonly proofEdges: readonly ChatProofEdge[];
  readonly bundle: ChatReplayBundle;
  readonly dedupedAgainstReplayId: ChatReplayId | null;
}

export interface ChatReplayAppendResult {
  readonly state: ChatState;
  readonly artifact: ChatReplayArtifact;
  readonly proofEdges: readonly ChatProofEdge[];
  readonly deduped: boolean;
}

export interface ChatReplayCoverageIssue {
  readonly code:
    | 'ROOM_NOT_FOUND'
    | 'ARTIFACT_RANGE_EMPTY'
    | 'ARTIFACT_RANGE_OUT_OF_BOUNDS'
    | 'ARTIFACT_WITHOUT_PROOF'
    | 'ARTIFACT_WITHOUT_SOURCE_MESSAGE'
    | 'DUPLICATE_ANCHOR_KEY'
    | 'BROKEN_REPLAY_WINDOW'
    | 'TRANSCRIPT_AUDIT_WARNINGS'
    | 'BROKEN_PROOF_CHAIN';
  readonly roomId: ChatRoomId;
  readonly replayId: ChatReplayId | null;
  readonly severity: 'WARN' | 'ERROR';
  readonly detail: string;
}

export interface ChatReplayCoverageReport {
  readonly roomId: ChatRoomId;
  readonly ok: boolean;
  readonly artifactCount: number;
  readonly issues: readonly ChatReplayCoverageIssue[];
  readonly proofVerification: ChatProofVerificationReport;
}

export interface ChatReplayRoomCompactionResult {
  readonly state: ChatState;
  readonly removedReplayIds: readonly ChatReplayId[];
  readonly keptReplayIds: readonly ChatReplayId[];
}

export interface ChatReplayRoomRebuildResult {
  readonly state: ChatState;
  readonly createdArtifacts: readonly ChatReplayArtifact[];
  readonly removedReplayIds: readonly ChatReplayId[];
  readonly createdProofEdges: readonly ChatProofEdge[];
}

// ============================================================================
// MARK: Default ports
// ============================================================================

const DEFAULT_CLOCK: ChatReplayAssemblerClockPort = {
  now: () => Date.now(),
};

const DEFAULT_IDS: ChatReplayAssemblerIdPort = {
  replayId: (prefix = 'rpl') => `${prefix}_${Date.now()}_${randomBase36(10)}` as ChatReplayId,
};

const DEFAULT_HASH: ChatHashPort = {
  hash: (input: string) => fnv1a32(input) as ChatProofHash,
};

const DEFAULT_LOGGER: ChatReplayAssemblerLoggerPort = {
  debug: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const DEFAULT_PORTS: ChatReplayAssemblerPorts = {
  clock: DEFAULT_CLOCK,
  ids: DEFAULT_IDS,
  hash: DEFAULT_HASH,
  logger: DEFAULT_LOGGER,
};

// ============================================================================
// MARK: Public API construction
// ============================================================================

export function createChatReplayAssembler(options: ChatReplayAssemblerOptions = {}) {
  const ports = makePorts(options);
  const proofContext = createChatProofChainContext({
    ports: {
      clock: { now: () => ports.clock.now() },
      ids: { proofEdgeId: (prefix = 'prf') => `${prefix}_${ports.clock.now()}_${randomBase36(10)}` as any },
      hash: ports.hash,
      logger: ports.logger,
    },
  });

  return {
    ports,
    proofContext,
    resolveAnchor(state: ChatState, request: ChatReplayAssemblyRequest): ChatReplayResolvedAnchor {
      return resolveReplayAnchor(state, request);
    },
    assemble(state: ChatState, request: ChatReplayAssemblyRequest): ChatReplayArtifactEnvelope | null {
      return assembleReplayArtifactEnvelope(ports, proofContext, state, request);
    },
    append(state: ChatState, envelope: ChatReplayArtifactEnvelope): ChatReplayAppendResult {
      return appendReplayArtifactEnvelope(state, envelope);
    },
    assembleAndAppend(state: ChatState, request: ChatReplayAssemblyRequest): ChatReplayAppendResult | null {
      const envelope = assembleReplayArtifactEnvelope(ports, proofContext, state, request);
      if (!envelope) {
        return null;
      }
      return appendReplayArtifactEnvelope(state, envelope);
    },
    assembleBundleByReplayId(state: ChatState, roomId: ChatRoomId, replayId: ChatReplayId): ChatReplayBundle | null {
      return assembleBundleByReplayId(ports, proofContext, state, roomId, replayId);
    },
    assembleBundleAroundMessage(
      state: ChatState,
      roomId: ChatRoomId,
      messageId: ChatMessageId,
      label = 'Replay Window',
    ): ChatReplayBundle | null {
      const envelope = assembleReplayArtifactEnvelope(ports, proofContext, state, {
        roomId,
        label,
        reason: 'MANUAL_REQUEST',
        strategy: 'MESSAGE_ID',
        anchorMessageId: messageId,
        dedupeByAnchorKey: false,
      });
      return envelope?.bundle ?? null;
    },
    assembleBundleAroundSequence(
      state: ChatState,
      roomId: ChatRoomId,
      sequenceNumber: SequenceNumber,
      label = 'Replay Window',
    ): ChatReplayBundle | null {
      const envelope = assembleReplayArtifactEnvelope(ports, proofContext, state, {
        roomId,
        label,
        reason: 'MANUAL_REQUEST',
        strategy: 'SEQUENCE',
        anchorSequence: sequenceNumber,
        dedupeByAnchorKey: false,
      });
      return envelope?.bundle ?? null;
    },
    verifyRoom(state: ChatState, roomId: ChatRoomId): ChatReplayCoverageReport {
      return verifyReplayCoverage(ports, proofContext, state, roomId);
    },
    repairRoom(state: ChatState, roomId: ChatRoomId): ChatReplayRoomRebuildResult {
      return repairReplayCoverage(ports, proofContext, state, roomId);
    },
    compactRoom(state: ChatState, roomId: ChatRoomId): ChatReplayRoomCompactionResult {
      return compactReplayRoom(state, roomId);
    },
    rebuildRoom(state: ChatState, roomId: ChatRoomId): ChatReplayRoomRebuildResult {
      return rebuildReplayRoom(ports, proofContext, state, roomId);
    },
  };
}

export type ChatReplayAssemblerApi = ReturnType<typeof createChatReplayAssembler>;

// ============================================================================
// MARK: Core assembly
// ============================================================================

export function assembleReplayArtifactEnvelope(
  ports: ChatReplayAssemblerPorts,
  proofContext: ChatProofChainContext,
  state: ChatState,
  request: ChatReplayAssemblyRequest,
): ChatReplayArtifactEnvelope | null {
  const room = state.rooms[request.roomId];
  if (!room) {
    ports.logger.warn('Replay assembly skipped because room is missing.', {
      roomId: request.roomId,
      label: request.label,
    });
    return null;
  }

  const anchor = resolveReplayAnchor(state, request);
  const entries = anchor.window?.entries ?? [];

  if (entries.length === 0 && !request.forceCreateWhenEmpty) {
    return null;
  }

  const artifact = createReplayArtifact(ports, state, room, anchor, request, entries);
  const dedupedAgainstReplayId = request.dedupeByAnchorKey !== false
    ? findReplayByAnchorKey(state, room.roomId, artifact.anchorKey)?.id ?? null
    : null;

  const sourceMessageIds = dedupeStringArray(
    entries
      .filter((entry) => !request.includeShadow ? entry.visibility !== 'SHADOW' : true)
      .map((entry) => entry.message.id),
  ) as readonly ChatMessageId[];

  const proofEdges = createProofEdgesForReplayArtifacts(proofContext, {
    roomId: room.roomId,
    sourceMessageIds,
    replayArtifacts: [artifact],
    sourceEventId: request.eventId ?? null,
    reason: `replay.assembled.${request.reason.toLowerCase()}`,
  });

  const bundle = assembleReplayBundle(ports, proofContext, state, room, artifact, anchor);

  return {
    artifact,
    anchor,
    sourceMessageIds,
    proofEdges,
    bundle,
    dedupedAgainstReplayId,
  };
}

export function appendReplayArtifactEnvelope(
  state: ChatState,
  envelope: ChatReplayArtifactEnvelope,
): ChatReplayAppendResult {
  if (envelope.dedupedAgainstReplayId) {
    return {
      state,
      artifact: state.replay.byReplayId[envelope.dedupedAgainstReplayId] ?? envelope.artifact,
      proofEdges: [],
      deduped: true,
    };
  }

  let next = appendReplayArtifact(state, envelope.artifact);
  for (const edge of envelope.proofEdges) {
    next = appendProofEdge(next, edge);
  }

  next = enforceReplayRetention(next, envelope.artifact.roomId);

  return {
    state: next,
    artifact: envelope.artifact,
    proofEdges: envelope.proofEdges,
    deduped: false,
  };
}

export function assembleBundleByReplayId(
  ports: ChatReplayAssemblerPorts,
  proofContext: ChatProofChainContext,
  state: ChatState,
  roomId: ChatRoomId,
  replayId: ChatReplayId,
): ChatReplayBundle | null {
  const artifact = state.replay.byReplayId[replayId];
  if (!artifact || artifact.roomId !== roomId) {
    return null;
  }

  const room = state.rooms[roomId];
  if (!room) {
    return null;
  }

  const anchor: ChatReplayResolvedAnchor = {
    strategy: 'REPLAY_ID',
    roomId,
    eventId: artifact.eventId,
    anchorMessageId: resolveAnchorMessageIdFromArtifact(state, artifact),
    anchorSequence: resolveAnchorSequenceFromArtifact(state, artifact),
    anchorTimestamp: resolveAnchorTimestampFromArtifact(state, artifact),
    range: artifact.range,
    window: getReplayWindow(state, roomId, replayId),
  };

  return assembleReplayBundle(ports, proofContext, state, room, artifact, anchor);
}

export function assembleReplayBundle(
  ports: ChatReplayAssemblerPorts,
  proofContext: ChatProofChainContext,
  state: ChatState,
  room: ChatRoomState,
  artifact: ChatReplayArtifact,
  anchor: ChatReplayResolvedAnchor,
): ChatReplayBundle {
  const transcriptWindow = anchor.window ?? getRoomWindow(state, room.roomId, artifact.range.start, artifact.range.end);
  const entries = transcriptWindow?.entries ?? [];
  const visibleEntries = entries.filter((entry) => entry.visibility === 'VISIBLE');
  const shadowEntries = entries.filter((entry) => entry.visibility === 'SHADOW');
  const replayProofEdges = selectProofEdgesToReplay(state.proofChain, room.roomId, artifact.id);
  const proofTimeline = buildRoomProofTimeline(proofContext, state, room.roomId);
  const transcriptAudit = auditRoomSequences(state, room.roomId);
  const anchorMessageId = anchor.anchorMessageId;
  const anchorCausalClosure = anchorMessageId
    ? buildMessageCausalClosure(state, room.roomId, anchorMessageId)
    : null;

  return {
    artifact,
    room,
    anchor,
    transcriptWindow,
    entries,
    visibleEntries,
    shadowEntries,
    witnessLines: buildWitnessLines(entries, anchorMessageId),
    scenes: buildSceneBeats(room.roomId, entries),
    proofTimeline,
    replayProofEdges,
    anchorCausalClosure,
    transcriptAuditWarnings: transcriptAudit.issues.map((issue) => issue.detail),
    exportPreview: exportTranscriptLines(state, room.roomId)
      .slice(Math.max(0, artifact.range.start), artifact.range.end + 1)
      .map((line) => `${String(line.sequenceNumber)} ${line.author}: ${line.plainText}`),
  };
}

// ============================================================================
// MARK: Anchor resolution
// ============================================================================

export function resolveReplayAnchor(
  state: ChatState,
  request: ChatReplayAssemblyRequest,
): ChatReplayResolvedAnchor {
  const strategy = request.strategy ?? inferAnchorStrategy(request);
  const entries = selectRoomTranscript(state, request.roomId);
  const safeBefore = Math.max(0, Math.floor(request.radiusBefore ?? 4));
  const safeAfter = Math.max(0, Math.floor(request.radiusAfter ?? 4));

  if (strategy === 'REPLAY_ID' && request.replayId) {
    const artifact = state.replay.byReplayId[request.replayId] ?? null;
    const window = artifact ? getReplayWindow(state, request.roomId, request.replayId) : null;
    return {
      strategy,
      roomId: request.roomId,
      eventId: artifact?.eventId ?? request.eventId ?? null,
      anchorMessageId: artifact ? resolveAnchorMessageIdFromArtifact(state, artifact) : null,
      anchorSequence: artifact ? resolveAnchorSequenceFromArtifact(state, artifact) : asSequenceNumber(0),
      anchorTimestamp: artifact ? resolveAnchorTimestampFromArtifact(state, artifact) : null,
      range: artifact?.range ?? { start: 0, end: 0 },
      window,
    };
  }

  if (strategy === 'EXPLICIT_RANGE' && request.explicitRange) {
    const range = sanitizeRange(request.explicitRange, entries.length);
    const window = getRoomWindow(state, request.roomId, range.start, range.end);
    return {
      strategy,
      roomId: request.roomId,
      eventId: request.eventId ?? null,
      anchorMessageId: window.entries[0]?.message.id ?? null,
      anchorSequence: window.entries[0]?.message.sequenceNumber ?? asSequenceNumber(0),
      anchorTimestamp: window.entries[0]?.message.createdAt ?? null,
      range,
      window,
    };
  }

  if (strategy === 'MESSAGE_ID' && request.anchorMessageId) {
    const index = entries.findIndex((entry) => entry.message.id === request.anchorMessageId);
    const range = index >= 0
      ? sanitizeRange({ start: index - safeBefore, end: index + safeAfter }, entries.length)
      : { start: Math.max(0, entries.length - 1), end: Math.max(0, entries.length - 1) };
    const window = getRoomWindow(state, request.roomId, range.start, range.end);
    return {
      strategy,
      roomId: request.roomId,
      eventId: request.eventId ?? null,
      anchorMessageId: request.anchorMessageId,
      anchorSequence: entries[index]?.message.sequenceNumber ?? asSequenceNumber(0),
      anchorTimestamp: entries[index]?.message.createdAt ?? null,
      range,
      window,
    };
  }

  if (strategy === 'SEQUENCE' && request.anchorSequence) {
    const window = getAroundSequence(state, request.roomId, request.anchorSequence, Math.max(safeBefore, safeAfter));
    const anchorEntry = window.entries.find(
      (entry) => Number(entry.message.sequenceNumber) >= Number(request.anchorSequence),
    ) ?? window.entries[0] ?? null;
    return {
      strategy,
      roomId: request.roomId,
      eventId: request.eventId ?? null,
      anchorMessageId: anchorEntry?.message.id ?? null,
      anchorSequence: anchorEntry?.message.sequenceNumber ?? request.anchorSequence,
      anchorTimestamp: anchorEntry?.message.createdAt ?? null,
      range: {
        start: Number(window.startSequence),
        end: Number(window.endSequence),
      },
      window,
    };
  }

  if (strategy === 'EVENT_ID' && request.eventId) {
    const index = entries.findIndex((entry) => {
      return entry.message.proof.causalParentEventIds.includes(request.eventId as ChatEventId);
    });
    const resolvedIndex = index >= 0 ? index : Math.max(0, entries.length - 1);
    const range = sanitizeRange({ start: resolvedIndex - safeBefore, end: resolvedIndex + safeAfter }, entries.length);
    const window = getRoomWindow(state, request.roomId, range.start, range.end);
    return {
      strategy,
      roomId: request.roomId,
      eventId: request.eventId,
      anchorMessageId: entries[resolvedIndex]?.message.id ?? null,
      anchorSequence: entries[resolvedIndex]?.message.sequenceNumber ?? asSequenceNumber(0),
      anchorTimestamp: entries[resolvedIndex]?.message.createdAt ?? null,
      range,
      window,
    };
  }

  if (strategy === 'TIMESTAMP' && request.anchorTimestamp) {
    const nearest = findNearestMessageByTimestamp(entries, request.anchorTimestamp);
    const resolvedIndex = nearest?.index ?? Math.max(0, entries.length - 1);
    const range = sanitizeRange({ start: resolvedIndex - safeBefore, end: resolvedIndex + safeAfter }, entries.length);
    const window = getRoomWindow(state, request.roomId, range.start, range.end);
    return {
      strategy,
      roomId: request.roomId,
      eventId: request.eventId ?? null,
      anchorMessageId: nearest?.entry.message.id ?? null,
      anchorSequence: nearest?.entry.message.sequenceNumber ?? asSequenceNumber(0),
      anchorTimestamp: nearest?.entry.message.createdAt ?? request.anchorTimestamp,
      range,
      window,
    };
  }

  if (strategy === 'LATEST_VISIBLE') {
    const latest = collectLatestVisibleWindow(state, request.roomId, Math.max(1, safeBefore + safeAfter + 1));
    return {
      strategy,
      roomId: request.roomId,
      eventId: request.eventId ?? null,
      anchorMessageId: latest.entries[latest.entries.length - 1]?.message.id ?? null,
      anchorSequence: latest.entries[latest.entries.length - 1]?.message.sequenceNumber ?? selectCurrentSequence(state, request.roomId),
      anchorTimestamp: latest.entries[latest.entries.length - 1]?.message.createdAt ?? null,
      range: { start: Number(latest.startSequence), end: Number(latest.endSequence) },
      window: latest,
    };
  }

  if (strategy === 'LATEST_ANY') {
    const visible = collectLatestVisibleWindow(state, request.roomId, Math.max(1, safeBefore + safeAfter + 1));
    if (visible.entries.length > 0) {
      return {
        strategy,
        roomId: request.roomId,
        eventId: request.eventId ?? null,
        anchorMessageId: visible.entries[visible.entries.length - 1]?.message.id ?? null,
        anchorSequence: visible.entries[visible.entries.length - 1]?.message.sequenceNumber ?? selectCurrentSequence(state, request.roomId),
        anchorTimestamp: visible.entries[visible.entries.length - 1]?.message.createdAt ?? null,
        range: { start: Number(visible.startSequence), end: Number(visible.endSequence) },
        window: visible,
      };
    }

    const shadow = collectLatestShadowWindow(state, request.roomId, Math.max(1, safeBefore + safeAfter + 1));
    return {
      strategy,
      roomId: request.roomId,
      eventId: request.eventId ?? null,
      anchorMessageId: shadow.entries[shadow.entries.length - 1]?.message.id ?? null,
      anchorSequence: shadow.entries[shadow.entries.length - 1]?.message.sequenceNumber ?? selectCurrentSequence(state, request.roomId),
      anchorTimestamp: shadow.entries[shadow.entries.length - 1]?.message.createdAt ?? null,
      range: { start: Number(shadow.startSequence), end: Number(shadow.endSequence) },
      window: shadow,
    };
  }

  return {
    strategy: 'LATEST_ANY',
    roomId: request.roomId,
    eventId: request.eventId ?? null,
    anchorMessageId: entries[entries.length - 1]?.message.id ?? null,
    anchorSequence: entries[entries.length - 1]?.message.sequenceNumber ?? asSequenceNumber(0),
    anchorTimestamp: entries[entries.length - 1]?.message.createdAt ?? null,
    range: sanitizeRange({ start: entries.length - (safeBefore + safeAfter + 1), end: entries.length - 1 }, entries.length),
    window: getRoomWindow(
      state,
      request.roomId,
      Math.max(0, entries.length - (safeBefore + safeAfter + 1)),
      Math.max(0, entries.length - 1),
    ),
  };
}

// ============================================================================
// MARK: Artifact creation
// ============================================================================

export function createReplayArtifact(
  ports: ChatReplayAssemblerPorts,
  state: ChatState,
  room: ChatRoomState,
  anchor: ChatReplayResolvedAnchor,
  request: ChatReplayAssemblyRequest,
  entries: readonly ChatTranscriptEntry[],
): ChatReplayArtifact {
  const now = asUnixMs(ports.clock.now());
  const visibleCount = entries.filter((entry) => entry.visibility === 'VISIBLE').length;
  const shadowCount = entries.filter((entry) => entry.visibility === 'SHADOW').length;
  const messageIds = entries.map((entry) => String(entry.message.id)).join('|');
  const anchorKey = makeReplayAnchorKey(ports.hash, room.roomId, anchor, messageIds, request.label);
  const startSequence = entries[0]?.message.sequenceNumber ?? asSequenceNumber(anchor.range.start);
  const endSequence = entries[entries.length - 1]?.message.sequenceNumber ?? asSequenceNumber(anchor.range.end);

  return {
    id: ports.ids.replayId('rpl'),
    roomId: room.roomId,
    createdAt: now,
    eventId: request.eventId ?? anchor.eventId ?? (`evt_replay_${String(room.roomId)}` as ChatEventId),
    range: {
      start: Number(startSequence),
      end: Number(endSequence),
    },
    anchorKey,
    label: request.label,
    metadata: {
      reason: request.reason,
      anchorStrategy: anchor.strategy,
      anchorMessageId: anchor.anchorMessageId,
      anchorSequence: Number(anchor.anchorSequence),
      anchorTimestamp: anchor.anchorTimestamp,
      roomKind: room.roomKind,
      stageMood: room.stageMood,
      activeVisibleChannel: room.activeVisibleChannel,
      activeSceneId: room.activeSceneId,
      activeMomentId: room.activeMomentId,
      activeLegendId: room.activeLegendId,
      entryCount: entries.length,
      visibleCount,
      shadowCount,
      dedupeByAnchorKey: request.dedupeByAnchorKey !== false,
      replayTimeWindowMs: state.runtime.replayPolicy.replayTimeWindowMs,
      replayPolicyMaxPerRoom: state.runtime.replayPolicy.maxReplayArtifactsPerRoom,
      requestMetadata: request.metadata ?? {},
    },
  };
}

// ============================================================================
// MARK: Query, verification, and repair
// ============================================================================

export function verifyReplayCoverage(
  ports: ChatReplayAssemblerPorts,
  proofContext: ChatProofChainContext,
  state: ChatState,
  roomId: ChatRoomId,
): ChatReplayCoverageReport {
  const room = state.rooms[roomId];
  const issues: ChatReplayCoverageIssue[] = [];
  const artifacts = selectRoomReplayArtifacts(state, roomId);

  if (!room) {
    return {
      roomId,
      ok: false,
      artifactCount: 0,
      issues: [
        {
          code: 'ROOM_NOT_FOUND',
          roomId,
          replayId: null,
          severity: 'ERROR',
          detail: `Room ${String(roomId)} does not exist in chat state.`,
        },
      ],
      proofVerification: verifyRoomProofChain(proofContext, state, roomId),
    };
  }

  const seenAnchorKeys = new Map<string, ChatReplayId>();
  const transcriptEntries = selectRoomTranscript(state, roomId);
  const transcriptAudit = auditRoomSequences(state, roomId);

  if (transcriptAudit.issues.length > 0) {
    issues.push({
      code: 'TRANSCRIPT_AUDIT_WARNINGS',
      roomId,
      replayId: null,
      severity: 'WARN',
      detail: `Transcript audit reported ${transcriptAudit.issues.length} issue(s) for room ${String(roomId)}.`,
    });
  }

  for (const artifact of artifacts) {
    if (artifact.range.end < artifact.range.start) {
      issues.push({
        code: 'ARTIFACT_RANGE_EMPTY',
        roomId,
        replayId: artifact.id,
        severity: 'ERROR',
        detail: `Replay ${String(artifact.id)} has inverted range ${artifact.range.start}-${artifact.range.end}.`,
      });
    }

    if (artifact.range.start < 0 || artifact.range.end >= transcriptEntries.length) {
      issues.push({
        code: 'ARTIFACT_RANGE_OUT_OF_BOUNDS',
        roomId,
        replayId: artifact.id,
        severity: 'ERROR',
        detail: `Replay ${String(artifact.id)} points outside transcript bounds.`,
      });
    }

    const prior = seenAnchorKeys.get(artifact.anchorKey);
    if (prior) {
      issues.push({
        code: 'DUPLICATE_ANCHOR_KEY',
        roomId,
        replayId: artifact.id,
        severity: 'WARN',
        detail: `Replay ${String(artifact.id)} duplicates anchor key with replay ${String(prior)}.`,
      });
    } else {
      seenAnchorKeys.set(artifact.anchorKey, artifact.id);
    }

    const window = getReplayWindow(state, roomId, artifact.id);
    if (!window || window.entries.length === 0) {
      issues.push({
        code: 'BROKEN_REPLAY_WINDOW',
        roomId,
        replayId: artifact.id,
        severity: 'ERROR',
        detail: `Replay ${String(artifact.id)} could not be reconstructed from the transcript ledger.`,
      });
    }

    const replayProofEdges = selectProofEdgesToReplay(state.proofChain, roomId, artifact.id);
    if (replayProofEdges.length === 0) {
      issues.push({
        code: 'ARTIFACT_WITHOUT_PROOF',
        roomId,
        replayId: artifact.id,
        severity: 'WARN',
        detail: `Replay ${String(artifact.id)} has no proof edge coverage.`,
      });
    }

    const sourceMessageIds = new Set(replayProofEdges.map((edge) => edge.fromMessageId).filter(Boolean));
    if (sourceMessageIds.size === 0) {
      issues.push({
        code: 'ARTIFACT_WITHOUT_SOURCE_MESSAGE',
        roomId,
        replayId: artifact.id,
        severity: 'WARN',
        detail: `Replay ${String(artifact.id)} is not linked back to any source message.`,
      });
    }
  }

  const proofVerification = verifyRoomProofChain(proofContext, state, roomId);
  if (!proofVerification.ok) {
    issues.push({
      code: 'BROKEN_PROOF_CHAIN',
      roomId,
      replayId: null,
      severity: 'ERROR',
      detail: `Proof verification failed for room ${String(roomId)}.`,
    });
  }

  return {
    roomId,
    ok: issues.every((issue) => issue.severity !== 'ERROR'),
    artifactCount: artifacts.length,
    issues,
    proofVerification,
  };
}

export function repairReplayCoverage(
  ports: ChatReplayAssemblerPorts,
  proofContext: ChatProofChainContext,
  state: ChatState,
  roomId: ChatRoomId,
): ChatReplayRoomRebuildResult {
  const report = verifyReplayCoverage(ports, proofContext, state, roomId);
  let next = cloneChatState(state);
  const createdArtifacts: ChatReplayArtifact[] = [];
  const removedReplayIds: ChatReplayId[] = [];
  const createdProofEdges: ChatProofEdge[] = [];

  for (const artifact of selectRoomReplayArtifacts(next, roomId)) {
    const hasBrokenRange = report.issues.some((issue) => {
      return issue.replayId === artifact.id && (
        issue.code === 'ARTIFACT_RANGE_EMPTY' ||
        issue.code === 'ARTIFACT_RANGE_OUT_OF_BOUNDS' ||
        issue.code === 'BROKEN_REPLAY_WINDOW'
      );
    });

    if (hasBrokenRange) {
      next = removeReplayArtifact(next, artifact.id);
      removedReplayIds.push(artifact.id);
      continue;
    }

    const replayProofEdges = selectProofEdgesToReplay(next.proofChain, roomId, artifact.id);
    if (replayProofEdges.length === 0) {
      const window = getReplayWindow(next, roomId, artifact.id);
      const sourceMessageIds = dedupeStringArray((window?.entries ?? []).map((entry) => entry.message.id)) as readonly ChatMessageId[];
      const edges = createProofEdgesForReplayArtifacts(proofContext, {
        roomId,
        sourceMessageIds,
        replayArtifacts: [artifact],
        sourceEventId: artifact.eventId,
        reason: 'replay.repair.missing_proof_coverage',
      });
      for (const edge of edges) {
        next = appendProofEdge(next, edge);
      }
      createdProofEdges.push(...edges);
    }
  }

  const rebuilt = rebuildReplayRoom(ports, proofContext, next, roomId);
  return {
    state: rebuilt.state,
    createdArtifacts: [...createdArtifacts, ...rebuilt.createdArtifacts],
    removedReplayIds: [...removedReplayIds, ...rebuilt.removedReplayIds],
    createdProofEdges: [...createdProofEdges, ...rebuilt.createdProofEdges],
  };
}

export function rebuildReplayRoom(
  ports: ChatReplayAssemblerPorts,
  proofContext: ChatProofChainContext,
  state: ChatState,
  roomId: ChatRoomId,
): ChatReplayRoomRebuildResult {
  const room = state.rooms[roomId];
  if (!room) {
    return {
      state,
      createdArtifacts: [],
      removedReplayIds: [],
      createdProofEdges: [],
    };
  }

  const transcript = selectRoomTranscript(state, roomId);
  const candidateAnchors = chooseRebuildAnchors(transcript);
  let next = cloneChatState(state);
  const createdArtifacts: ChatReplayArtifact[] = [];
  const createdProofEdges: ChatProofEdge[] = [];

  for (const anchor of candidateAnchors) {
    const envelope = assembleReplayArtifactEnvelope(ports, proofContext, next, {
      roomId,
      label: deriveRebuildLabel(anchor.message),
      reason: 'RECONCILIATION',
      strategy: 'MESSAGE_ID',
      anchorMessageId: anchor.message.id,
      radiusBefore: anchor.radiusBefore,
      radiusAfter: anchor.radiusAfter,
      dedupeByAnchorKey: true,
      forceCreateWhenEmpty: false,
      metadata: {
        rebuildReason: anchor.reason,
      },
    });

    if (!envelope || envelope.dedupedAgainstReplayId) {
      continue;
    }

    const result = appendReplayArtifactEnvelope(next, envelope);
    next = result.state;
    createdArtifacts.push(result.artifact);
    createdProofEdges.push(...result.proofEdges);
  }

  const compaction = compactReplayRoom(next, roomId);

  return {
    state: compaction.state,
    createdArtifacts,
    removedReplayIds: compaction.removedReplayIds,
    createdProofEdges,
  };
}

export function compactReplayRoom(
  state: ChatState,
  roomId: ChatRoomId,
): ChatReplayRoomCompactionResult {
  const artifacts = [...selectRoomReplayArtifacts(state, roomId)];
  if (artifacts.length === 0) {
    return {
      state,
      removedReplayIds: [],
      keptReplayIds: [],
    };
  }

  const maxArtifacts = Math.max(1, state.runtime.replayPolicy.maxReplayArtifactsPerRoom);
  const deduped = new Map<string, ChatReplayArtifact>();

  for (const artifact of artifacts) {
    const prior = deduped.get(artifact.anchorKey);
    if (!prior || Number(artifact.createdAt) > Number(prior.createdAt)) {
      deduped.set(artifact.anchorKey, artifact);
    }
  }

  const kept = [...deduped.values()]
    .sort((left, right) => Number(right.createdAt) - Number(left.createdAt))
    .slice(0, maxArtifacts);
  const keepIds = new Set(kept.map((artifact) => artifact.id));
  const removedReplayIds = artifacts.filter((artifact) => !keepIds.has(artifact.id)).map((artifact) => artifact.id);

  let next = state;
  for (const replayId of removedReplayIds) {
    next = removeReplayArtifact(next, replayId);
  }

  return {
    state: next,
    removedReplayIds,
    keptReplayIds: kept.map((artifact) => artifact.id),
  };
}

// ============================================================================
// MARK: Scene and witness shaping
// ============================================================================

export function buildSceneBeats(
  roomId: ChatRoomId,
  entries: readonly ChatTranscriptEntry[],
): readonly ChatReplaySceneBeat[] {
  if (entries.length === 0) {
    return [];
  }

  const scenes: ChatReplaySceneBeat[] = [];
  let current: ChatTranscriptEntry[] = [];

  const flush = () => {
    if (current.length === 0) {
      return;
    }

    const first = current[0];
    const last = current[current.length - 1];
    const messageIds = current.map((entry) => entry.message.id);
    const tags = dedupeStringArray(current.flatMap((entry) => entry.message.tags));

    scenes.push({
      id: `scene_${String(roomId)}_${String(first.message.id)}_${String(last.message.id)}`,
      roomId,
      channelId: dominantChannel(current),
      sceneClass: classifyScene(current),
      startSequence: first.message.sequenceNumber,
      endSequence: last.message.sequenceNumber,
      startedAt: first.message.createdAt,
      endedAt: last.message.createdAt,
      messageIds,
      witnessCount: current.filter((entry) => entry.message.attribution.sourceType !== 'PLAYER').length,
      tags,
      metadata: {
        entryCount: current.length,
        sourceSpread: dedupeStringArray(current.map((entry) => entry.message.attribution.sourceType)),
      },
    });

    current = [];
  };

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const previous = current[current.length - 1] ?? null;

    if (!previous) {
      current.push(entry);
      continue;
    }

    const gapMs = Number(entry.message.createdAt) - Number(previous.message.createdAt);
    const sourceChanged = entry.message.attribution.sourceType !== previous.message.attribution.sourceType;
    const channelChanged = entry.message.channelId !== previous.message.channelId;
    const hardBoundary = gapMs > 15_000 || channelChanged;
    const softBoundary = gapMs > 6_000 && sourceChanged;
    const legendBoundary = Boolean(previous.message.replay.legendId || entry.message.replay.legendId);

    if (hardBoundary || softBoundary || legendBoundary) {
      flush();
    }

    current.push(entry);
  }

  flush();
  return scenes;
}

export function buildWitnessLines(
  entries: readonly ChatTranscriptEntry[],
  anchorMessageId: ChatMessageId | null,
): readonly ChatReplayWitnessLine[] {
  const lines: ChatReplayWitnessLine[] = [];

  for (const entry of entries) {
    lines.push({
      messageId: entry.message.id,
      role: classifyWitnessRole(entry.message, anchorMessageId),
      channelId: entry.message.channelId,
      sequenceNumber: entry.message.sequenceNumber,
      createdAt: entry.message.createdAt,
      actorId: entry.message.attribution.actorId,
      displayName: entry.message.attribution.displayName,
      plainText: entry.message.plainText,
      proofHash: entry.message.proof.proofHash,
      tags: entry.message.tags,
    });
  }

  return lines;
}

// ============================================================================
// MARK: Internal heuristics
// ============================================================================

interface RebuildAnchorCandidate {
  readonly message: ChatMessage;
  readonly reason: string;
  readonly radiusBefore: number;
  readonly radiusAfter: number;
}

function chooseRebuildAnchors(entries: readonly ChatTranscriptEntry[]): readonly RebuildAnchorCandidate[] {
  const candidates: RebuildAnchorCandidate[] = [];

  for (const entry of entries) {
    const message = entry.message;
    const tags = new Set(message.tags);
    const text = message.plainText.toLowerCase();
    const isSystem = message.attribution.sourceType === 'SYSTEM';
    const isHelper = message.attribution.sourceType === 'NPC_HELPER';
    const isHater = message.attribution.sourceType === 'NPC_HATER';
    const isLegend = Boolean(message.replay.legendId) || tags.has('legend');
    const isProofy = Boolean(message.proof.proofHash) && (tags.has('proof') || message.channelId === 'DEAL_ROOM');
    const isEscalation = tags.has('invasion') || tags.has('helper') || tags.has('hater') || text.includes('collapse') || text.includes('sovereign');

    if (isLegend) {
      candidates.push({ message, reason: 'legend', radiusBefore: 5, radiusAfter: 5 });
      continue;
    }

    if (isProofy) {
      candidates.push({ message, reason: 'proof', radiusBefore: 3, radiusAfter: 4 });
      continue;
    }

    if (isSystem || isHelper || isHater || isEscalation) {
      candidates.push({ message, reason: 'authored_beat', radiusBefore: 4, radiusAfter: 4 });
    }
  }

  return dedupeCandidatesByMessageId(candidates);
}

function deriveRebuildLabel(message: ChatMessage): string {
  if (message.replay.legendId) {
    return 'Legend Replay';
  }
  if (message.attribution.sourceType === 'NPC_HELPER') {
    return 'Helper Intervention Replay';
  }
  if (message.attribution.sourceType === 'NPC_HATER') {
    return 'Hater Escalation Replay';
  }
  if (message.channelId === 'DEAL_ROOM') {
    return 'Deal Room Replay';
  }
  if (message.attribution.sourceType === 'SYSTEM') {
    return 'System Witness Replay';
  }
  return 'Authored Replay';
}

function inferAnchorStrategy(request: ChatReplayAssemblyRequest): ChatReplayAnchorStrategy {
  if (request.replayId) {
    return 'REPLAY_ID';
  }
  if (request.explicitRange) {
    return 'EXPLICIT_RANGE';
  }
  if (request.anchorMessageId) {
    return 'MESSAGE_ID';
  }
  if (request.anchorSequence) {
    return 'SEQUENCE';
  }
  if (request.eventId) {
    return 'EVENT_ID';
  }
  if (request.anchorTimestamp) {
    return 'TIMESTAMP';
  }
  return 'LATEST_VISIBLE';
}

function sanitizeRange(range: ChatRange, length: number): ChatRange {
  if (length <= 0) {
    return { start: 0, end: 0 };
  }

  const start = Math.max(0, Math.min(length - 1, Math.floor(range.start)));
  const end = Math.max(start, Math.min(length - 1, Math.floor(range.end)));
  return { start, end };
}

function findNearestMessageByTimestamp(
  entries: readonly ChatTranscriptEntry[],
  target: UnixMs,
): { readonly index: number; readonly entry: ChatTranscriptEntry } | null {
  let winnerIndex = -1;
  let winnerDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const distance = Math.abs(Number(entry.message.createdAt) - Number(target));
    if (distance < winnerDistance) {
      winnerDistance = distance;
      winnerIndex = index;
    }
  }

  return winnerIndex >= 0
    ? { index: winnerIndex, entry: entries[winnerIndex] }
    : null;
}

function dominantChannel(entries: readonly ChatTranscriptEntry[]): ChatChannelId {
  const counts = new Map<ChatChannelId, number>();
  for (const entry of entries) {
    counts.set(entry.message.channelId, (counts.get(entry.message.channelId) ?? 0) + 1);
  }
  let winner = entries[0].message.channelId;
  let best = -1;
  for (const [channelId, count] of counts.entries()) {
    if (count > best) {
      winner = channelId;
      best = count;
    }
  }
  return winner;
}

function classifyScene(entries: readonly ChatTranscriptEntry[]): ChatReplaySceneClass {
  const sourceTypes = new Set(entries.map((entry) => entry.message.attribution.sourceType));
  const tags = new Set(entries.flatMap((entry) => entry.message.tags));

  if (tags.has('postrun') || tags.has('ritual')) {
    return 'RITUAL_CLOSE';
  }
  if (sourceTypes.size === 1 && sourceTypes.has('SYSTEM')) {
    return 'SYSTEM_ARC';
  }
  if (sourceTypes.has('NPC_HELPER') && !sourceTypes.has('NPC_HATER')) {
    return 'HELPER_BEAT';
  }
  if (sourceTypes.has('NPC_HATER') && !sourceTypes.has('NPC_HELPER')) {
    return 'HATER_SPIKE';
  }
  if (sourceTypes.has('SYSTEM') && sourceTypes.has('PLAYER')) {
    return 'PLAYER_PUSH';
  }
  if (tags.has('deal') || entries.some((entry) => entry.message.channelId === 'DEAL_ROOM')) {
    return 'NEGOTIATION_SWING';
  }
  if (sourceTypes.has('NPC_AMBIENT')) {
    return 'CROWD_WITNESS';
  }
  return 'MIXED_SCENE';
}

function classifyWitnessRole(message: ChatMessage, anchorMessageId: ChatMessageId | null): ChatReplayMessageRole {
  if (anchorMessageId && message.id === anchorMessageId) {
    return 'ANCHOR';
  }
  if (message.attribution.sourceType === 'SYSTEM') {
    return 'SYSTEM_FRAME';
  }
  if (message.attribution.sourceType === 'NPC_HELPER') {
    return 'RESCUE';
  }
  if (message.attribution.sourceType === 'NPC_HATER') {
    return 'ESCALATION';
  }
  if (message.policy.shadowOnly || message.channelId === 'NPC_SHADOW' || message.channelId === 'RIVALRY_SHADOW') {
    return 'SHADOW_CONTEXT';
  }
  if (message.attribution.sourceType === 'NPC_AMBIENT') {
    return 'WITNESS';
  }
  return 'SUPPORT';
}

function findReplayByAnchorKey(
  state: ChatState,
  roomId: ChatRoomId,
  anchorKey: string,
): ChatReplayArtifact | null {
  return selectRoomReplayArtifacts(state, roomId).find((artifact) => artifact.anchorKey === anchorKey) ?? null;
}

function resolveAnchorMessageIdFromArtifact(
  state: ChatState,
  artifact: ChatReplayArtifact,
): ChatMessageId | null {
  const window = getReplayWindow(state, artifact.roomId, artifact.id);
  if (!window || window.entries.length === 0) {
    return null;
  }
  const middle = Math.floor(window.entries.length / 2);
  return window.entries[middle]?.message.id ?? window.entries[0]?.message.id ?? null;
}

function resolveAnchorSequenceFromArtifact(
  state: ChatState,
  artifact: ChatReplayArtifact,
): SequenceNumber {
  const window = getReplayWindow(state, artifact.roomId, artifact.id);
  if (!window || window.entries.length === 0) {
    return asSequenceNumber(artifact.range.start);
  }
  const middle = Math.floor(window.entries.length / 2);
  return window.entries[middle]?.message.sequenceNumber ?? window.entries[0]?.message.sequenceNumber ?? asSequenceNumber(artifact.range.start);
}

function resolveAnchorTimestampFromArtifact(
  state: ChatState,
  artifact: ChatReplayArtifact,
): UnixMs | null {
  const window = getReplayWindow(state, artifact.roomId, artifact.id);
  if (!window || window.entries.length === 0) {
    return null;
  }
  const middle = Math.floor(window.entries.length / 2);
  return window.entries[middle]?.message.createdAt ?? window.entries[0]?.message.createdAt ?? null;
}

function makeReplayAnchorKey(
  hashPort: ChatHashPort,
  roomId: ChatRoomId,
  anchor: ChatReplayResolvedAnchor,
  messageIdsMaterial: string,
  label: string,
): string {
  return String(hashPort.hash([
    'room',
    String(roomId),
    'strategy',
    anchor.strategy,
    'event',
    String(anchor.eventId ?? ''),
    'anchorMessage',
    String(anchor.anchorMessageId ?? ''),
    'anchorSequence',
    String(anchor.anchorSequence),
    'range',
    `${anchor.range.start}:${anchor.range.end}`,
    'label',
    label,
    'messages',
    messageIdsMaterial,
  ].join('|')));
}

function makePorts(options: ChatReplayAssemblerOptions): ChatReplayAssemblerPorts {
  return {
    clock: options.ports?.clock ?? DEFAULT_PORTS.clock,
    ids: options.ports?.ids ?? DEFAULT_PORTS.ids,
    hash: options.ports?.hash ?? DEFAULT_PORTS.hash,
    logger: options.ports?.logger ?? DEFAULT_PORTS.logger,
  };
}

function enforceReplayRetention(state: ChatState, roomId: ChatRoomId): ChatState {
  const artifacts = [...selectRoomReplayArtifacts(state, roomId)].sort((left, right) => Number(right.createdAt) - Number(left.createdAt));
  const maxArtifacts = Math.max(1, state.runtime.replayPolicy.maxReplayArtifactsPerRoom);
  if (artifacts.length <= maxArtifacts) {
    return state;
  }

  let next = state;
  for (const artifact of artifacts.slice(maxArtifacts)) {
    next = removeReplayArtifact(next, artifact.id);
  }
  return next;
}

function dedupeCandidatesByMessageId(
  candidates: readonly RebuildAnchorCandidate[],
): readonly RebuildAnchorCandidate[] {
  const byId = new Map<string, RebuildAnchorCandidate>();
  for (const candidate of candidates) {
    const key = String(candidate.message.id);
    if (!byId.has(key)) {
      byId.set(key, candidate);
      continue;
    }

    const prior = byId.get(key)!;
    const priorRadius = prior.radiusBefore + prior.radiusAfter;
    const nextRadius = candidate.radiusBefore + candidate.radiusAfter;
    if (nextRadius > priorRadius) {
      byId.set(key, candidate);
    }
  }
  return [...byId.values()];
}

function dedupeStringArray<T extends string | ChatMessageId>(values: readonly T[]): readonly T[] {
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

function randomBase36(length: number): string {
  let out = '';
  while (out.length < length) {
    out += Math.random().toString(36).slice(2);
  }
  return out.slice(0, length);
}

function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function computeRelevanceScore(bundle: ChatReplayBundle): number {
  let score = 0;
  const total = bundle.entries.length;
  if (total === 0) {
    return 0;
  }
  score += Math.min(0.3, bundle.witnessLines.filter((line) => line.role === 'ANCHOR').length * 0.3);
  score += Math.min(0.2, bundle.witnessLines.filter((line) => line.role === 'RESCUE').length * 0.1);
  score += Math.min(0.15, bundle.witnessLines.filter((line) => line.role === 'ESCALATION').length * 0.075);
  score += Math.min(0.15, bundle.scenes.length * 0.05);
  score += Math.min(0.1, bundle.replayProofEdges.length * 0.033);
  if (bundle.anchorCausalClosure && Object.keys(bundle.anchorCausalClosure).length > 0) {
    score += 0.1;
  }
  return Math.min(1, score);
}

function maxByCount<T>(counts: Map<T, number>): T | null {
  let winner: T | null = null;
  let best = -1;
  for (const [key, count] of counts.entries()) {
    if (count > best) {
      best = count;
      winner = key;
    }
  }
  return winner;
}

// ============================================================================
// MARK: Assembly profiles
// ============================================================================

export type ChatReplayAssemblerProfile =
  | 'STANDARD'
  | 'CINEMATIC'
  | 'RAPID'
  | 'FORENSIC'
  | 'LEGEND_FOCUS'
  | 'SHADOW_AWARE'
  | 'MINIMAL';

export interface ChatReplayAssemblerProfileConfig {
  readonly radiusBefore: number;
  readonly radiusAfter: number;
  readonly includeShadow: boolean;
  readonly dedupeByAnchorKey: boolean;
  readonly forceCreateWhenEmpty: boolean;
  readonly defaultStrategy: ChatReplayAnchorStrategy;
  readonly defaultReason: ChatReplayAssemblyReason;
  readonly sceneBoundaryGapMs: number;
  readonly legendRadiusBoost: number;
  readonly proofyRadiusBoost: number;
  readonly maxEntriesPerScene: number;
}

export const ASSEMBLER_PROFILE_OPTIONS: Readonly<
  Record<ChatReplayAssemblerProfile, ChatReplayAssemblerProfileConfig>
> = Object.freeze({
  STANDARD: Object.freeze({
    radiusBefore: 4,
    radiusAfter: 4,
    includeShadow: false,
    dedupeByAnchorKey: true,
    forceCreateWhenEmpty: false,
    defaultStrategy: 'LATEST_VISIBLE' as ChatReplayAnchorStrategy,
    defaultReason: 'PLAYER_MESSAGE_ACCEPTED' as ChatReplayAssemblyReason,
    sceneBoundaryGapMs: 15_000,
    legendRadiusBoost: 2,
    proofyRadiusBoost: 1,
    maxEntriesPerScene: 12,
  }),
  CINEMATIC: Object.freeze({
    radiusBefore: 8,
    radiusAfter: 8,
    includeShadow: true,
    dedupeByAnchorKey: true,
    forceCreateWhenEmpty: false,
    defaultStrategy: 'LATEST_ANY' as ChatReplayAnchorStrategy,
    defaultReason: 'LEGEND_MOMENT' as ChatReplayAssemblyReason,
    sceneBoundaryGapMs: 30_000,
    legendRadiusBoost: 5,
    proofyRadiusBoost: 3,
    maxEntriesPerScene: 32,
  }),
  RAPID: Object.freeze({
    radiusBefore: 2,
    radiusAfter: 2,
    includeShadow: false,
    dedupeByAnchorKey: true,
    forceCreateWhenEmpty: false,
    defaultStrategy: 'LATEST_VISIBLE' as ChatReplayAnchorStrategy,
    defaultReason: 'NPC_MESSAGE_EMITTED' as ChatReplayAssemblyReason,
    sceneBoundaryGapMs: 6_000,
    legendRadiusBoost: 1,
    proofyRadiusBoost: 1,
    maxEntriesPerScene: 6,
  }),
  FORENSIC: Object.freeze({
    radiusBefore: 10,
    radiusAfter: 10,
    includeShadow: true,
    dedupeByAnchorKey: false,
    forceCreateWhenEmpty: true,
    defaultStrategy: 'EXPLICIT_RANGE' as ChatReplayAnchorStrategy,
    defaultReason: 'RECOVERY_REPAIR' as ChatReplayAssemblyReason,
    sceneBoundaryGapMs: 60_000,
    legendRadiusBoost: 5,
    proofyRadiusBoost: 5,
    maxEntriesPerScene: 64,
  }),
  LEGEND_FOCUS: Object.freeze({
    radiusBefore: 6,
    radiusAfter: 6,
    includeShadow: false,
    dedupeByAnchorKey: true,
    forceCreateWhenEmpty: false,
    defaultStrategy: 'LATEST_VISIBLE' as ChatReplayAnchorStrategy,
    defaultReason: 'LEGEND_MOMENT' as ChatReplayAssemblyReason,
    sceneBoundaryGapMs: 20_000,
    legendRadiusBoost: 8,
    proofyRadiusBoost: 2,
    maxEntriesPerScene: 20,
  }),
  SHADOW_AWARE: Object.freeze({
    radiusBefore: 5,
    radiusAfter: 5,
    includeShadow: true,
    dedupeByAnchorKey: true,
    forceCreateWhenEmpty: false,
    defaultStrategy: 'LATEST_ANY' as ChatReplayAnchorStrategy,
    defaultReason: 'NPC_MESSAGE_EMITTED' as ChatReplayAssemblyReason,
    sceneBoundaryGapMs: 15_000,
    legendRadiusBoost: 2,
    proofyRadiusBoost: 2,
    maxEntriesPerScene: 16,
  }),
  MINIMAL: Object.freeze({
    radiusBefore: 1,
    radiusAfter: 1,
    includeShadow: false,
    dedupeByAnchorKey: true,
    forceCreateWhenEmpty: false,
    defaultStrategy: 'LATEST_VISIBLE' as ChatReplayAnchorStrategy,
    defaultReason: 'MANUAL_REQUEST' as ChatReplayAssemblyReason,
    sceneBoundaryGapMs: 5_000,
    legendRadiusBoost: 0,
    proofyRadiusBoost: 0,
    maxEntriesPerScene: 4,
  }),
} as const);

// ============================================================================
// MARK: Diagnostics and audit interfaces
// ============================================================================

export interface ChatReplayAssemblerDiagnostics {
  readonly profile: ChatReplayAssemblerProfile | null;
  readonly config: ChatReplayAssemblerProfileConfig | null;
  readonly supportedProfiles: readonly ChatReplayAssemblerProfile[];
  readonly assemblyCountEstimate: number;
  readonly portIdentifiers: Readonly<{
    hasClock: boolean;
    hasIds: boolean;
    hasHash: boolean;
    hasLogger: boolean;
  }>;
}

export interface ChatReplayAssemblerAuditEntry {
  readonly roomId: ChatRoomId;
  readonly replayId: ChatReplayId;
  readonly label: string;
  readonly reason: ChatReplayAssemblyReason;
  readonly anchorStrategy: ChatReplayAnchorStrategy;
  readonly entryCount: number;
  readonly visibleCount: number;
  readonly shadowCount: number;
  readonly sceneBeatCount: number;
  readonly witnessLineCount: number;
  readonly replayProofEdgeCount: number;
  readonly anchorMessageId: ChatMessageId | null;
  readonly anchorSequence: number;
  readonly rangeStart: number;
  readonly rangeEnd: number;
  readonly createdAt: UnixMs;
  readonly warnings: readonly string[];
}

export interface ChatReplayAssemblerAuditReport {
  readonly roomId: ChatRoomId;
  readonly generatedAt: UnixMs;
  readonly artifactCount: number;
  readonly totalEntries: number;
  readonly totalVisibleEntries: number;
  readonly totalShadowEntries: number;
  readonly totalSceneBeats: number;
  readonly totalWitnessLines: number;
  readonly totalProofEdges: number;
  readonly entries: readonly ChatReplayAssemblerAuditEntry[];
  readonly issues: readonly string[];
}

export interface ChatReplayAssemblerDiff {
  readonly roomId: ChatRoomId;
  readonly addedReplayIds: readonly ChatReplayId[];
  readonly removedReplayIds: readonly ChatReplayId[];
  readonly modifiedReplayIds: readonly ChatReplayId[];
  readonly unchangedReplayIds: readonly ChatReplayId[];
  readonly totalBefore: number;
  readonly totalAfter: number;
}

export interface ChatReplayAssemblerStatsSummary {
  readonly roomId: ChatRoomId;
  readonly artifactCount: number;
  readonly totalEntries: number;
  readonly averageEntriesPerArtifact: number;
  readonly averageRangeSpan: number;
  readonly visibleFraction: number;
  readonly shadowFraction: number;
  readonly mostCommonReason: ChatReplayAssemblyReason | null;
  readonly mostCommonStrategy: ChatReplayAnchorStrategy | null;
  readonly legendArtifactCount: number;
  readonly proofCoveredCount: number;
}

// ============================================================================
// MARK: Bundle scoring interfaces
// ============================================================================

export interface ChatReplayBundleScore {
  readonly replayId: ChatReplayId;
  readonly roomId: ChatRoomId;
  readonly relevanceScore: number;
  readonly densityScore: number;
  readonly legendScore: number;
  readonly proofScore: number;
  readonly compositeScore: number;
  readonly anchorQuality: 'STRONG' | 'MODERATE' | 'WEAK' | 'EMPTY';
  readonly exposureClass: 'VISIBLE_ONLY' | 'SHADOW_HEAVY' | 'MIXED' | 'EMPTY';
}

// ============================================================================
// MARK: Batch assembly interfaces
// ============================================================================

export interface ChatReplayBatchAssemblyRequest {
  readonly roomId: ChatRoomId;
  readonly requests: readonly ChatReplayAssemblyRequest[];
  readonly stopOnFirstFailure?: boolean;
  readonly dedupeAcrossRequests?: boolean;
}

export interface ChatReplayBatchAssemblyResult {
  readonly roomId: ChatRoomId;
  readonly state: ChatState;
  readonly assembled: readonly ChatReplayAppendResult[];
  readonly skipped: number;
  readonly failed: number;
}

export interface ChatReplayMultiRoomBatchRequest {
  readonly rooms: readonly ChatReplayBatchAssemblyRequest[];
}

export interface ChatReplayMultiRoomBatchResult {
  readonly results: readonly ChatReplayBatchAssemblyResult[];
  readonly totalAssembled: number;
  readonly totalSkipped: number;
  readonly totalFailed: number;
  readonly finalState: ChatState;
}

// ============================================================================
// MARK: Profile-aware assembler factory
// ============================================================================

export function createChatReplayAssemblerFromProfile(
  profile: ChatReplayAssemblerProfile,
  options: ChatReplayAssemblerOptions = {},
) {
  const profileConfig = ASSEMBLER_PROFILE_OPTIONS[profile];
  const base = createChatReplayAssembler(options);

  return {
    ...base,
    profile,
    profileConfig,

    assembleWithProfile(
      state: ChatState,
      partial: Omit<ChatReplayAssemblyRequest, 'roomId'> & { readonly roomId: ChatRoomId },
    ): ChatReplayArtifactEnvelope | null {
      const merged: ChatReplayAssemblyRequest = {
        radiusBefore: profileConfig.radiusBefore,
        radiusAfter: profileConfig.radiusAfter,
        includeShadow: profileConfig.includeShadow,
        dedupeByAnchorKey: profileConfig.dedupeByAnchorKey,
        forceCreateWhenEmpty: profileConfig.forceCreateWhenEmpty,
        strategy: profileConfig.defaultStrategy,
        reason: profileConfig.defaultReason,
        ...partial,
      };
      return assembleReplayArtifactEnvelope(base.ports, base.proofContext, state, merged);
    },

    assembleAndAppendWithProfile(
      state: ChatState,
      partial: Omit<ChatReplayAssemblyRequest, 'roomId'> & { readonly roomId: ChatRoomId },
    ): ChatReplayAppendResult | null {
      const merged: ChatReplayAssemblyRequest = {
        radiusBefore: profileConfig.radiusBefore,
        radiusAfter: profileConfig.radiusAfter,
        includeShadow: profileConfig.includeShadow,
        dedupeByAnchorKey: profileConfig.dedupeByAnchorKey,
        forceCreateWhenEmpty: profileConfig.forceCreateWhenEmpty,
        strategy: profileConfig.defaultStrategy,
        reason: profileConfig.defaultReason,
        ...partial,
      };
      const envelope = assembleReplayArtifactEnvelope(base.ports, base.proofContext, state, merged);
      if (!envelope) {
        return null;
      }
      return appendReplayArtifactEnvelope(state, envelope);
    },

    batchAssembleAndAppend(
      state: ChatState,
      batch: ChatReplayBatchAssemblyRequest,
    ): ChatReplayBatchAssemblyResult {
      return batchAssembleAndAppend(base.ports, base.proofContext, state, batch);
    },

    batchMultiRoom(
      state: ChatState,
      batch: ChatReplayMultiRoomBatchRequest,
    ): ChatReplayMultiRoomBatchResult {
      return batchMultiRoom(base.ports, base.proofContext, state, batch);
    },

    getDiagnostics(): ChatReplayAssemblerDiagnostics {
      return {
        profile,
        config: profileConfig,
        supportedProfiles: Object.keys(ASSEMBLER_PROFILE_OPTIONS) as ChatReplayAssemblerProfile[],
        assemblyCountEstimate: 0,
        portIdentifiers: {
          hasClock: Boolean(base.ports.clock),
          hasIds: Boolean(base.ports.ids),
          hasHash: Boolean(base.ports.hash),
          hasLogger: Boolean(base.ports.logger),
        },
      };
    },

    buildAuditReport(state: ChatState, roomId: ChatRoomId): ChatReplayAssemblerAuditReport {
      return buildAssemblerAuditReport(base.ports, base.proofContext, state, roomId);
    },

    computeDiff(
      stateBefore: ChatState,
      stateAfter: ChatState,
      roomId: ChatRoomId,
    ): ChatReplayAssemblerDiff {
      return computeAssemblerDiff(stateBefore, stateAfter, roomId);
    },

    getStatsSummary(state: ChatState, roomId: ChatRoomId): ChatReplayAssemblerStatsSummary {
      return buildAssemblerStatsSummary(base.ports, base.proofContext, state, roomId);
    },

    scoreBundle(bundle: ChatReplayBundle): ChatReplayBundleScore {
      return scoreBundleRelevance(bundle);
    },

    serializeBundle(bundle: ChatReplayBundle): string {
      return JSON.stringify(bundle, null, 0);
    },

    clone() {
      return createChatReplayAssemblerFromProfile(profile, options);
    },

    toJSON(): Readonly<{ profile: ChatReplayAssemblerProfile; config: ChatReplayAssemblerProfileConfig }> {
      return Object.freeze({ profile, config: profileConfig });
    },
  };
}

export type ChatReplayProfileAssemblerApi = ReturnType<typeof createChatReplayAssemblerFromProfile>;

// ============================================================================
// MARK: Standalone extended assembler
// ============================================================================

export function extendChatReplayAssembler(base: ChatReplayAssemblerApi) {
  return {
    ...base,

    getDiagnostics(): ChatReplayAssemblerDiagnostics {
      return {
        profile: null,
        config: null,
        supportedProfiles: Object.keys(ASSEMBLER_PROFILE_OPTIONS) as ChatReplayAssemblerProfile[],
        assemblyCountEstimate: 0,
        portIdentifiers: {
          hasClock: Boolean(base.ports.clock),
          hasIds: Boolean(base.ports.ids),
          hasHash: Boolean(base.ports.hash),
          hasLogger: Boolean(base.ports.logger),
        },
      };
    },

    buildAuditReport(state: ChatState, roomId: ChatRoomId): ChatReplayAssemblerAuditReport {
      return buildAssemblerAuditReport(base.ports, base.proofContext, state, roomId);
    },

    computeDiff(
      stateBefore: ChatState,
      stateAfter: ChatState,
      roomId: ChatRoomId,
    ): ChatReplayAssemblerDiff {
      return computeAssemblerDiff(stateBefore, stateAfter, roomId);
    },

    getStatsSummary(state: ChatState, roomId: ChatRoomId): ChatReplayAssemblerStatsSummary {
      return buildAssemblerStatsSummary(base.ports, base.proofContext, state, roomId);
    },

    batchAssembleAndAppend(
      state: ChatState,
      batch: ChatReplayBatchAssemblyRequest,
    ): ChatReplayBatchAssemblyResult {
      return batchAssembleAndAppend(base.ports, base.proofContext, state, batch);
    },

    batchMultiRoom(
      state: ChatState,
      batch: ChatReplayMultiRoomBatchRequest,
    ): ChatReplayMultiRoomBatchResult {
      return batchMultiRoom(base.ports, base.proofContext, state, batch);
    },

    scoreBundle(bundle: ChatReplayBundle): ChatReplayBundleScore {
      return scoreBundleRelevance(bundle);
    },

    toJSON(): Readonly<{ profile: null }> {
      return Object.freeze({ profile: null });
    },
  };
}

// ============================================================================
// MARK: Batch assembly functions
// ============================================================================

export function batchAssembleAndAppend(
  ports: ChatReplayAssemblerPorts,
  proofContext: ChatProofChainContext,
  state: ChatState,
  batch: ChatReplayBatchAssemblyRequest,
): ChatReplayBatchAssemblyResult {
  let next = state;
  const assembled: ChatReplayAppendResult[] = [];
  const seenAnchorKeys = new Set<string>();
  let skipped = 0;
  let failed = 0;

  for (const request of batch.requests) {
    if (request.roomId !== batch.roomId) {
      failed += 1;
      continue;
    }

    const envelope = assembleReplayArtifactEnvelope(ports, proofContext, next, request);

    if (!envelope) {
      skipped += 1;
      if (batch.stopOnFirstFailure) {
        break;
      }
      continue;
    }

    if (batch.dedupeAcrossRequests && seenAnchorKeys.has(envelope.artifact.anchorKey)) {
      skipped += 1;
      continue;
    }

    seenAnchorKeys.add(envelope.artifact.anchorKey);
    const result = appendReplayArtifactEnvelope(next, envelope);
    next = result.state;
    assembled.push(result);
  }

  return {
    roomId: batch.roomId,
    state: next,
    assembled,
    skipped,
    failed,
  };
}

export function batchMultiRoom(
  ports: ChatReplayAssemblerPorts,
  proofContext: ChatProofChainContext,
  state: ChatState,
  batch: ChatReplayMultiRoomBatchRequest,
): ChatReplayMultiRoomBatchResult {
  let next = state;
  const results: ChatReplayBatchAssemblyResult[] = [];
  let totalAssembled = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const roomBatch of batch.rooms) {
    const result = batchAssembleAndAppend(ports, proofContext, next, roomBatch);
    next = result.state;
    results.push(result);
    totalAssembled += result.assembled.length;
    totalSkipped += result.skipped;
    totalFailed += result.failed;
  }

  return {
    results,
    totalAssembled,
    totalSkipped,
    totalFailed,
    finalState: next,
  };
}

// ============================================================================
// MARK: Audit report
// ============================================================================

export function buildAssemblerAuditReport(
  ports: ChatReplayAssemblerPorts,
  proofContext: ChatProofChainContext,
  state: ChatState,
  roomId: ChatRoomId,
): ChatReplayAssemblerAuditReport {
  const now = asUnixMs(ports.clock.now());
  const artifacts = selectRoomReplayArtifacts(state, roomId);
  const entries: ChatReplayAssemblerAuditEntry[] = [];
  const issues: string[] = [];
  let totalEntries = 0;
  let totalVisible = 0;
  let totalShadow = 0;
  let totalSceneBeats = 0;
  let totalWitnesses = 0;
  let totalProofEdges = 0;

  for (const artifact of artifacts) {
    const bundle = assembleBundleByReplayId(ports, proofContext, state, roomId, artifact.id);

    if (!bundle) {
      issues.push(`Artifact ${String(artifact.id)} could not produce a bundle.`);
      continue;
    }

    const replayProofEdges = selectProofEdgesToReplay(state.proofChain, roomId, artifact.id);
    const warnings: string[] = [...bundle.transcriptAuditWarnings];

    if (replayProofEdges.length === 0) {
      warnings.push('No proof edge coverage.');
    }

    if (bundle.entries.length === 0) {
      warnings.push('Bundle has no entries.');
    }

    const auditEntry: ChatReplayAssemblerAuditEntry = {
      roomId,
      replayId: artifact.id,
      label: artifact.label,
      reason: (artifact.metadata.reason as ChatReplayAssemblyReason) ?? 'MANUAL_REQUEST',
      anchorStrategy: (artifact.metadata.anchorStrategy as ChatReplayAnchorStrategy) ?? 'LATEST_VISIBLE',
      entryCount: bundle.entries.length,
      visibleCount: bundle.visibleEntries.length,
      shadowCount: bundle.shadowEntries.length,
      sceneBeatCount: bundle.scenes.length,
      witnessLineCount: bundle.witnessLines.length,
      replayProofEdgeCount: replayProofEdges.length,
      anchorMessageId: bundle.anchor.anchorMessageId,
      anchorSequence: Number(bundle.anchor.anchorSequence),
      rangeStart: artifact.range.start,
      rangeEnd: artifact.range.end,
      createdAt: artifact.createdAt,
      warnings,
    };

    entries.push(auditEntry);
    totalEntries += bundle.entries.length;
    totalVisible += bundle.visibleEntries.length;
    totalShadow += bundle.shadowEntries.length;
    totalSceneBeats += bundle.scenes.length;
    totalWitnesses += bundle.witnessLines.length;
    totalProofEdges += replayProofEdges.length;
  }

  return {
    roomId,
    generatedAt: now,
    artifactCount: artifacts.length,
    totalEntries,
    totalVisibleEntries: totalVisible,
    totalShadowEntries: totalShadow,
    totalSceneBeats,
    totalWitnessLines: totalWitnesses,
    totalProofEdges,
    entries,
    issues,
  };
}

// ============================================================================
// MARK: Diff
// ============================================================================

export function computeAssemblerDiff(
  stateBefore: ChatState,
  stateAfter: ChatState,
  roomId: ChatRoomId,
): ChatReplayAssemblerDiff {
  const beforeMap = new Map(
    selectRoomReplayArtifacts(stateBefore, roomId).map((artifact) => [artifact.id, artifact]),
  );
  const afterMap = new Map(
    selectRoomReplayArtifacts(stateAfter, roomId).map((artifact) => [artifact.id, artifact]),
  );
  const addedReplayIds: ChatReplayId[] = [];
  const removedReplayIds: ChatReplayId[] = [];
  const modifiedReplayIds: ChatReplayId[] = [];
  const unchangedReplayIds: ChatReplayId[] = [];

  for (const [replayId, after] of afterMap.entries()) {
    const before = beforeMap.get(replayId);
    if (!before) {
      addedReplayIds.push(replayId);
    } else if (before.anchorKey !== after.anchorKey || before.label !== after.label) {
      modifiedReplayIds.push(replayId);
    } else {
      unchangedReplayIds.push(replayId);
    }
  }

  for (const replayId of beforeMap.keys()) {
    if (!afterMap.has(replayId)) {
      removedReplayIds.push(replayId);
    }
  }

  return {
    roomId,
    addedReplayIds,
    removedReplayIds,
    modifiedReplayIds,
    unchangedReplayIds,
    totalBefore: beforeMap.size,
    totalAfter: afterMap.size,
  };
}

// ============================================================================
// MARK: Stats summary
// ============================================================================

export function buildAssemblerStatsSummary(
  ports: ChatReplayAssemblerPorts,
  proofContext: ChatProofChainContext,
  state: ChatState,
  roomId: ChatRoomId,
): ChatReplayAssemblerStatsSummary {
  const artifacts = selectRoomReplayArtifacts(state, roomId);

  if (artifacts.length === 0) {
    return {
      roomId,
      artifactCount: 0,
      totalEntries: 0,
      averageEntriesPerArtifact: 0,
      averageRangeSpan: 0,
      visibleFraction: 0,
      shadowFraction: 0,
      mostCommonReason: null,
      mostCommonStrategy: null,
      legendArtifactCount: 0,
      proofCoveredCount: 0,
    };
  }

  const reasonCounts = new Map<ChatReplayAssemblyReason, number>();
  const strategyCounts = new Map<ChatReplayAnchorStrategy, number>();
  let totalEntries = 0;
  let totalVisible = 0;
  let totalShadow = 0;
  let totalRangeSpan = 0;
  let legendCount = 0;
  let proofCoveredCount = 0;

  for (const artifact of artifacts) {
    const bundle = assembleBundleByReplayId(ports, proofContext, state, roomId, artifact.id);
    if (!bundle) {
      continue;
    }

    totalEntries += bundle.entries.length;
    totalVisible += bundle.visibleEntries.length;
    totalShadow += bundle.shadowEntries.length;
    totalRangeSpan += artifact.range.end - artifact.range.start + 1;

    const reason = artifact.metadata.reason as ChatReplayAssemblyReason | undefined;
    if (reason) {
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }

    const strategy = artifact.metadata.anchorStrategy as ChatReplayAnchorStrategy | undefined;
    if (strategy) {
      strategyCounts.set(strategy, (strategyCounts.get(strategy) ?? 0) + 1);
    }

    if (artifact.label.toLowerCase().includes('legend')) {
      legendCount += 1;
    }

    const edges = selectProofEdgesToReplay(state.proofChain, roomId, artifact.id);
    if (edges.length > 0) {
      proofCoveredCount += 1;
    }
  }

  return {
    roomId,
    artifactCount: artifacts.length,
    totalEntries,
    averageEntriesPerArtifact: totalEntries / artifacts.length,
    averageRangeSpan: totalRangeSpan / artifacts.length,
    visibleFraction: totalEntries > 0 ? totalVisible / totalEntries : 0,
    shadowFraction: totalEntries > 0 ? totalShadow / totalEntries : 0,
    mostCommonReason: maxByCount(reasonCounts),
    mostCommonStrategy: maxByCount(strategyCounts),
    legendArtifactCount: legendCount,
    proofCoveredCount,
  };
}

// ============================================================================
// MARK: Bundle scoring and classification
// ============================================================================

export function scoreBundleRelevance(bundle: ChatReplayBundle): ChatReplayBundleScore {
  const totalEntries = bundle.entries.length;
  const visibleEntries = bundle.visibleEntries.length;
  const shadowEntries = bundle.shadowEntries.length;
  const hasLegend = bundleContainsLegendMoment(bundle);
  const hasProof = bundle.replayProofEdges.length > 0;
  const hasAnchor = bundle.anchor.anchorMessageId !== null;

  const relevanceScore = computeRelevanceScore(bundle);
  const densityScore = totalEntries > 0
    ? Math.min(1, bundle.scenes.length / Math.max(1, totalEntries / 4))
    : 0;
  const legendScore = hasLegend ? 1 : 0;
  const proofScore = hasProof ? Math.min(1, bundle.replayProofEdges.length / 3) : 0;
  const compositeScore = relevanceScore * 0.4 + densityScore * 0.2 + legendScore * 0.25 + proofScore * 0.15;

  const anchorQuality: ChatReplayBundleScore['anchorQuality'] =
    totalEntries === 0 ? 'EMPTY' :
    !hasAnchor ? 'WEAK' :
    (bundle.anchorCausalClosure && Object.keys(bundle.anchorCausalClosure).length > 0) ? 'STRONG' :
    'MODERATE';

  const exposureClass: ChatReplayBundleScore['exposureClass'] = bundleExposureClass(bundle);

  return {
    replayId: bundle.artifact.id,
    roomId: bundle.artifact.roomId,
    relevanceScore,
    densityScore,
    legendScore,
    proofScore,
    compositeScore,
    anchorQuality,
    exposureClass,
  };
}

export function summarizeBundleWitnesses(bundle: ChatReplayBundle): readonly string[] {
  return bundle.witnessLines.map(
    (line) => `${line.role}:${line.displayName}:seq${Number(line.sequenceNumber)}`,
  );
}

export function bundleContainsLegendMoment(bundle: ChatReplayBundle): boolean {
  return (
    bundle.witnessLines.some((line) => line.tags.includes('legend')) ||
    bundle.artifact.label.toLowerCase().includes('legend') ||
    bundle.entries.some((entry) => entry.message.replay.legendId !== null)
  );
}

export function bundleExposureClass(
  bundle: ChatReplayBundle,
): 'VISIBLE_ONLY' | 'SHADOW_HEAVY' | 'MIXED' | 'EMPTY' {
  const visible = bundle.visibleEntries.length;
  const shadow = bundle.shadowEntries.length;
  if (visible === 0 && shadow === 0) {
    return 'EMPTY';
  }
  if (shadow === 0) {
    return 'VISIBLE_ONLY';
  }
  if (visible === 0 || shadow > visible) {
    return 'SHADOW_HEAVY';
  }
  return 'MIXED';
}

export function classifyAnchorQuality(
  bundle: ChatReplayBundle,
): 'STRONG' | 'MODERATE' | 'WEAK' | 'EMPTY' {
  if (bundle.entries.length === 0) {
    return 'EMPTY';
  }
  if (!bundle.anchor.anchorMessageId) {
    return 'WEAK';
  }
  if (bundle.anchorCausalClosure && Object.keys(bundle.anchorCausalClosure).length > 0) {
    return 'STRONG';
  }
  return 'MODERATE';
}

export function estimateBundleDensity(bundle: ChatReplayBundle): number {
  if (bundle.entries.length === 0 || bundle.scenes.length === 0) {
    return 0;
  }
  return bundle.scenes.length / bundle.entries.length;
}

// ============================================================================
// MARK: Factory functions
// ============================================================================

export function createStandardReplayAssembler(
  options: ChatReplayAssemblerOptions = {},
): ChatReplayProfileAssemblerApi {
  return createChatReplayAssemblerFromProfile('STANDARD', options);
}

export function createCinematicReplayAssembler(
  options: ChatReplayAssemblerOptions = {},
): ChatReplayProfileAssemblerApi {
  return createChatReplayAssemblerFromProfile('CINEMATIC', options);
}

export function createRapidReplayAssembler(
  options: ChatReplayAssemblerOptions = {},
): ChatReplayProfileAssemblerApi {
  return createChatReplayAssemblerFromProfile('RAPID', options);
}

export function createForensicReplayAssembler(
  options: ChatReplayAssemblerOptions = {},
): ChatReplayProfileAssemblerApi {
  return createChatReplayAssemblerFromProfile('FORENSIC', options);
}

export function createLegendFocusReplayAssembler(
  options: ChatReplayAssemblerOptions = {},
): ChatReplayProfileAssemblerApi {
  return createChatReplayAssemblerFromProfile('LEGEND_FOCUS', options);
}

export function createShadowAwareReplayAssembler(
  options: ChatReplayAssemblerOptions = {},
): ChatReplayProfileAssemblerApi {
  return createChatReplayAssemblerFromProfile('SHADOW_AWARE', options);
}

export function createMinimalReplayAssembler(
  options: ChatReplayAssemblerOptions = {},
): ChatReplayProfileAssemblerApi {
  return createChatReplayAssemblerFromProfile('MINIMAL', options);
}

// ============================================================================
// MARK: Extended query helpers
// ============================================================================

export function getReplayAssemblerDefaults() {
  return CHAT_RUNTIME_DEFAULTS;
}

export function selectRecentReplayAroundSequence(
  state: ChatState,
  roomId: ChatRoomId,
  sequence: SequenceNumber,
) {
  return selectMostRecentReplayAroundSequence(state, roomId, sequence);
}

export function getRoomProofEdgeList(state: ChatState, roomId: ChatRoomId): readonly ChatProofEdge[] {
  return selectRoomProofEdges(state, roomId);
}

export function assembleConversationWindowForMessage(
  state: ChatState,
  roomId: ChatRoomId,
  messageId: ChatMessageId,
  radius: number = 4,
): ChatTranscriptRoomWindow {
  return collectConversationWindowForMessage(state, roomId, messageId, radius);
}

export function getProofEdgesForMessage(
  state: ChatState,
  roomId: ChatRoomId,
  messageId: ChatMessageId,
): readonly ChatProofEdge[] {
  return collectProofEdgesForMessage(state, roomId, messageId);
}

export function findRelevantReplayForMessage(
  state: ChatState,
  message: ChatMessage,
) {
  return getMostRelevantReplayForMessage(state, message);
}

// ============================================================================
// MARK: Combined module object
// ============================================================================

/**
 * Combined namespace object for the chat replay assembler subsystem.
 *
 *   import { ChatReplayAssemblerModule } from './ChatReplayAssembler';
 *   ChatReplayAssemblerModule.create();
 *   ChatReplayAssemblerModule.createCinematic();
 *   ChatReplayAssemblerModule.batchAssemble(ports, proofCtx, state, batch);
 */
export const ChatReplayAssemblerModule = Object.freeze({
  create: createChatReplayAssembler,
  createFromProfile: createChatReplayAssemblerFromProfile,
  extend: extendChatReplayAssembler,
  createStandard: createStandardReplayAssembler,
  createCinematic: createCinematicReplayAssembler,
  createRapid: createRapidReplayAssembler,
  createForensic: createForensicReplayAssembler,
  createLegendFocus: createLegendFocusReplayAssembler,
  createShadowAware: createShadowAwareReplayAssembler,
  createMinimal: createMinimalReplayAssembler,
  assembleEnvelope: assembleReplayArtifactEnvelope,
  appendEnvelope: appendReplayArtifactEnvelope,
  assembleBundleByReplayId,
  assembleBundle: assembleReplayBundle,
  resolveAnchor: resolveReplayAnchor,
  createArtifact: createReplayArtifact,
  verifyCoverage: verifyReplayCoverage,
  repairCoverage: repairReplayCoverage,
  rebuildRoom: rebuildReplayRoom,
  compactRoom: compactReplayRoom,
  buildSceneBeats,
  buildWitnessLines,
  batchAssemble: batchAssembleAndAppend,
  batchMultiRoom,
  buildAuditReport: buildAssemblerAuditReport,
  computeDiff: computeAssemblerDiff,
  buildStats: buildAssemblerStatsSummary,
  scoreBundle: scoreBundleRelevance,
  summarizeWitnesses: summarizeBundleWitnesses,
  bundleContainsLegend: bundleContainsLegendMoment,
  bundleExposureClass,
  classifyAnchorQuality,
  estimateDensity: estimateBundleDensity,
  profiles: ASSEMBLER_PROFILE_OPTIONS,
  getDefaults: getReplayAssemblerDefaults,
  selectRecentReplayAroundSequence,
  getRoomProofEdges: getRoomProofEdgeList,
  assembleConversationWindow: assembleConversationWindowForMessage,
  getProofEdgesForMessage,
  findRelevantReplayForMessage,
} as const);
