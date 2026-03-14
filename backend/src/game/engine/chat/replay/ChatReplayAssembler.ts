/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT REPLAY ASSEMBLER
 * FILE: backend/src/game/engine/chat/replay/ChatReplayAssembler.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
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
