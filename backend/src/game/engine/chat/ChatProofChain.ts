
/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT PROOF CHAIN
 * FILE: backend/src/game/engine/chat/ChatProofChain.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical proof-chain authority for backend chat truth.
 *
 * Chat in Point Zero One is not just a string stream. Once a message enters
 * authoritative backend state, it must be possible to answer:
 *
 * 1. what event caused this message to exist,
 * 2. what earlier message(s) influenced it,
 * 3. what replay artifact, telemetry artifact, or inference snapshot it caused,
 * 4. whether moderation altered it,
 * 5. whether proof hashes still reconcile,
 * 6. whether transcript history is internally auditable.
 *
 * This module owns that linkage layer.
 *
 * Design law
 * ----------
 * - ChatProofChain.ts does not mutate transcript text.
 * - ChatProofChain.ts does not decide policy or moderation outcomes.
 * - ChatProofChain.ts does not own transport or socket state.
 * - ChatProofChain.ts only links authoritative facts that already passed the
 *   rest of backend law.
 *
 * Architectural fit
 * -----------------
 * This file sits inside backend/src/game/engine/chat because proof truth is
 * backend truth. Frontend proof rendering may mirror it later, but the
 * canonical edge ledger belongs here beside transcript, replay, rate, and
 * orchestration authority.
 * ============================================================================
 */

import {
  asUnixMs,
  type ChatEventId,
  type ChatHashPort,
  type ChatInferenceId,
  type ChatMessage,
  type ChatMessageId,
  type ChatProofChain,
  type ChatProofEdge,
  type ChatProofEdgeId,
  type ChatProofHash,
  type ChatReplayArtifact,
  type ChatReplayId,
  type ChatRoomId,
  type ChatState,
  type ChatTelemetryEnvelope,
  type ChatTelemetryId,
  type JsonValue,
  type UnixMs,
} from './types';
import {
  appendProofEdge as appendProofEdgeToState,
  selectRoomProofEdges,
  selectRoomTranscript,
} from './ChatState';

// ============================================================================
// MARK: Ports, options, and context
// ============================================================================

export interface ChatProofChainClockPort {
  now(): number;
}

export interface ChatProofChainIdPort {
  proofEdgeId(prefix?: string): ChatProofEdgeId;
}

export interface ChatProofChainLoggerPort {
  debug(message: string, context?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, context?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, context?: Readonly<Record<string, JsonValue>>): void;
}

export interface ChatProofChainPorts {
  readonly clock: ChatProofChainClockPort;
  readonly ids: ChatProofChainIdPort;
  readonly hash: ChatHashPort;
  readonly logger: ChatProofChainLoggerPort;
}

export interface ChatProofChainOptions {
  readonly ports?: Partial<ChatProofChainPorts>;
}

export interface ChatProofChainContext {
  readonly ports: ChatProofChainPorts;
}

export const DEFAULT_CLOCK: ChatProofChainClockPort = {
  now: () => Date.now(),
};

export const DEFAULT_IDS: ChatProofChainIdPort = {
  proofEdgeId: (prefix = 'prf') => `${prefix}_${Date.now()}_${randomBase36(12)}` as ChatProofEdgeId,
};

export const DEFAULT_HASH: ChatHashPort = {
  hash: (input: string) => fnv1a32(input) as ChatProofHash,
};

export const DEFAULT_LOGGER: ChatProofChainLoggerPort = {
  debug: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export const DEFAULT_PORTS: ChatProofChainPorts = {
  clock: DEFAULT_CLOCK,
  ids: DEFAULT_IDS,
  hash: DEFAULT_HASH,
  logger: DEFAULT_LOGGER,
};

// ============================================================================
// MARK: Public construction shapes
// ============================================================================

export interface ChatProofEdgeSeed {
  readonly roomId: ChatRoomId;
  readonly createdAt?: UnixMs;
  readonly fromMessageId?: ChatMessageId | null;
  readonly fromEventId?: ChatEventId | null;
  readonly toMessageId?: ChatMessageId | null;
  readonly toReplayId?: ChatReplayId | null;
  readonly toTelemetryId?: ChatTelemetryId | null;
  readonly toInferenceId?: ChatInferenceId | null;
  readonly edgeType: ChatProofEdge['edgeType'];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface ChatModerationProofSeed extends ChatProofEdgeSeed {
  readonly originalText?: string | null;
  readonly rewrittenText?: string | null;
  readonly moderationOutcome?: string | null;
  readonly moderationReasons?: readonly string[];
}

export interface ChatProofVerificationReport {
  readonly ok: boolean;
  readonly roomId: ChatRoomId | null;
  readonly checkedEdgeCount: number;
  readonly invalidEdgeIds: readonly ChatProofEdgeId[];
  readonly orphanEdgeIds: readonly ChatProofEdgeId[];
  readonly duplicateEdgeIds: readonly ChatProofEdgeId[];
  readonly brokenMessageTargets: readonly ChatProofEdgeId[];
  readonly brokenReplayTargets: readonly ChatProofEdgeId[];
  readonly brokenTelemetryTargets: readonly ChatProofEdgeId[];
  readonly brokenInferenceTargets: readonly ChatProofEdgeId[];
  readonly notes: readonly string[];
}

export interface ChatProofDigest {
  readonly algorithm: 'FNV1A32';
  readonly hash: ChatProofHash;
  readonly materializedAt: UnixMs;
  readonly sourceCount: number;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ChatMessageCausalClosure {
  readonly rootMessageId: ChatMessageId;
  readonly roomId: ChatRoomId;
  readonly upstreamMessageIds: readonly ChatMessageId[];
  readonly upstreamEventIds: readonly ChatEventId[];
  readonly downstreamMessageIds: readonly ChatMessageId[];
  readonly downstreamReplayIds: readonly ChatReplayId[];
  readonly downstreamTelemetryIds: readonly ChatTelemetryId[];
  readonly downstreamInferenceIds: readonly ChatInferenceId[];
  readonly traversedEdgeIds: readonly ChatProofEdgeId[];
}

export interface ChatRoomProofTimeline {
  readonly roomId: ChatRoomId;
  readonly firstEdgeAt: UnixMs | null;
  readonly lastEdgeAt: UnixMs | null;
  readonly messageEdgeCount: number;
  readonly moderationEdgeCount: number;
  readonly replayEdgeCount: number;
  readonly telemetryEdgeCount: number;
  readonly inferenceEdgeCount: number;
  readonly digest: ChatProofDigest;
}

export interface ChatTranscriptRangeProof {
  readonly roomId: ChatRoomId;
  readonly fromSequenceInclusive: number;
  readonly toSequenceInclusive: number;
  readonly messageIds: readonly ChatMessageId[];
  readonly edgeIds: readonly ChatProofEdgeId[];
  readonly transcriptDigest: ChatProofDigest;
  readonly proofDigest: ChatProofDigest;
}

// ============================================================================
// MARK: Context creation
// ============================================================================

export function createChatProofChainContext(
  options: ChatProofChainOptions = {},
): ChatProofChainContext {
  return {
    ports: {
      clock: options.ports?.clock ?? DEFAULT_PORTS.clock,
      ids: options.ports?.ids ?? DEFAULT_PORTS.ids,
      hash: options.ports?.hash ?? DEFAULT_PORTS.hash,
      logger: options.ports?.logger ?? DEFAULT_PORTS.logger,
    },
  };
}

// ============================================================================
// MARK: Empty and clone helpers
// ============================================================================

export function createEmptyProofChain(): ChatProofChain {
  return {
    byRoom: {},
    byEdgeId: {},
  };
}

export function cloneProofChain(chain: ChatProofChain): ChatProofChain {
  const byRoom: Record<string, readonly ChatProofEdge[]> = {};
  for (const [roomId, edges] of Object.entries(chain.byRoom)) {
    byRoom[roomId] = edges.map(cloneProofEdge);
  }

  const byEdgeId: Record<string, ChatProofEdge> = {};
  for (const [edgeId, edge] of Object.entries(chain.byEdgeId)) {
    byEdgeId[edgeId] = cloneProofEdge(edge);
  }

  return {
    byRoom: byRoom as ChatProofChain['byRoom'],
    byEdgeId: byEdgeId as ChatProofChain['byEdgeId'],
  };
}

export function cloneProofEdge(edge: ChatProofEdge): ChatProofEdge {
  return {
    ...edge,
    metadata: { ...(edge.metadata ?? {}) },
  };
}

// ============================================================================
// MARK: Canonical edge creation
// ============================================================================

export function createProofEdge(
  context: ChatProofChainContext,
  seed: ChatProofEdgeSeed,
): ChatProofEdge {
  const createdAt = seed.createdAt ?? asUnixMs(context.ports.clock.now());
  const id = context.ports.ids.proofEdgeId('prf');
  const material = createCanonicalProofMaterial(seed, createdAt);
  const hash = context.ports.hash.hash(material);

  return {
    id,
    roomId: seed.roomId,
    createdAt,
    fromMessageId: seed.fromMessageId ?? null,
    fromEventId: seed.fromEventId ?? null,
    toMessageId: seed.toMessageId ?? null,
    toReplayId: seed.toReplayId ?? null,
    toTelemetryId: seed.toTelemetryId ?? null,
    toInferenceId: seed.toInferenceId ?? null,
    edgeType: seed.edgeType,
    hash,
    metadata: { ...(seed.metadata ?? {}) },
  };
}

export function createMessageToMessageProofEdge(
  context: ChatProofChainContext,
  args: {
    readonly roomId: ChatRoomId;
    readonly fromMessageId: ChatMessageId;
    readonly toMessageId: ChatMessageId;
    readonly fromEventId?: ChatEventId | null;
    readonly metadata?: Readonly<Record<string, JsonValue>>;
    readonly createdAt?: UnixMs;
  },
): ChatProofEdge {
  return createProofEdge(context, {
    roomId: args.roomId,
    createdAt: args.createdAt,
    fromMessageId: args.fromMessageId,
    fromEventId: args.fromEventId ?? null,
    toMessageId: args.toMessageId,
    edgeType: 'MESSAGE_TO_MESSAGE',
    metadata: args.metadata,
  });
}

export function createEventToMessageProofEdge(
  context: ChatProofChainContext,
  args: {
    readonly roomId: ChatRoomId;
    readonly fromEventId: ChatEventId;
    readonly toMessageId: ChatMessageId;
    readonly metadata?: Readonly<Record<string, JsonValue>>;
    readonly createdAt?: UnixMs;
  },
): ChatProofEdge {
  return createProofEdge(context, {
    roomId: args.roomId,
    createdAt: args.createdAt,
    fromEventId: args.fromEventId,
    toMessageId: args.toMessageId,
    edgeType: 'EVENT_TO_MESSAGE',
    metadata: args.metadata,
  });
}

export function createMessageToReplayProofEdge(
  context: ChatProofChainContext,
  args: {
    readonly roomId: ChatRoomId;
    readonly fromMessageId: ChatMessageId;
    readonly toReplayId: ChatReplayId;
    readonly fromEventId?: ChatEventId | null;
    readonly metadata?: Readonly<Record<string, JsonValue>>;
    readonly createdAt?: UnixMs;
  },
): ChatProofEdge {
  return createProofEdge(context, {
    roomId: args.roomId,
    createdAt: args.createdAt,
    fromMessageId: args.fromMessageId,
    fromEventId: args.fromEventId ?? null,
    toReplayId: args.toReplayId,
    edgeType: 'MESSAGE_TO_REPLAY',
    metadata: args.metadata,
  });
}

export function createMessageToTelemetryProofEdge(
  context: ChatProofChainContext,
  args: {
    readonly roomId: ChatRoomId;
    readonly fromMessageId: ChatMessageId;
    readonly toTelemetryId: ChatTelemetryId;
    readonly fromEventId?: ChatEventId | null;
    readonly metadata?: Readonly<Record<string, JsonValue>>;
    readonly createdAt?: UnixMs;
  },
): ChatProofEdge {
  return createProofEdge(context, {
    roomId: args.roomId,
    createdAt: args.createdAt,
    fromMessageId: args.fromMessageId,
    fromEventId: args.fromEventId ?? null,
    toTelemetryId: args.toTelemetryId,
    edgeType: 'MESSAGE_TO_TELEMETRY',
    metadata: args.metadata,
  });
}

export function createMessageToInferenceProofEdge(
  context: ChatProofChainContext,
  args: {
    readonly roomId: ChatRoomId;
    readonly fromMessageId: ChatMessageId;
    readonly toInferenceId: ChatInferenceId;
    readonly fromEventId?: ChatEventId | null;
    readonly metadata?: Readonly<Record<string, JsonValue>>;
    readonly createdAt?: UnixMs;
  },
): ChatProofEdge {
  return createProofEdge(context, {
    roomId: args.roomId,
    createdAt: args.createdAt,
    fromMessageId: args.fromMessageId,
    fromEventId: args.fromEventId ?? null,
    toInferenceId: args.toInferenceId,
    edgeType: 'MESSAGE_TO_INFERENCE',
    metadata: args.metadata,
  });
}

export function createModerationDecisionProofEdge(
  context: ChatProofChainContext,
  args: {
    readonly roomId: ChatRoomId;
    readonly fromEventId?: ChatEventId | null;
    readonly fromMessageId?: ChatMessageId | null;
    readonly toMessageId: ChatMessageId;
    readonly originalText?: string | null;
    readonly rewrittenText?: string | null;
    readonly moderationOutcome?: string | null;
    readonly moderationReasons?: readonly string[];
    readonly maskedLexemes?: readonly string[];
    readonly createdAt?: UnixMs;
    readonly metadata?: Readonly<Record<string, JsonValue>>;
  },
): ChatProofEdge {
  return createProofEdge(context, {
    roomId: args.roomId,
    createdAt: args.createdAt,
    fromEventId: args.fromEventId ?? null,
    fromMessageId: args.fromMessageId ?? null,
    toMessageId: args.toMessageId,
    edgeType: 'MODERATION_DECISION',
    metadata: {
      ...(args.metadata ?? {}),
      originalText: args.originalText ?? null,
      rewrittenText: args.rewrittenText ?? null,
      moderationOutcome: args.moderationOutcome ?? null,
      moderationReasons: (args.moderationReasons ?? []) as unknown as JsonValue,
      maskedLexemes: (args.maskedLexemes ?? []) as unknown as JsonValue,
    },
  });
}

// ============================================================================
// MARK: Message-driven proof materialization
// ============================================================================

export function createProofEdgesForMessage(
  context: ChatProofChainContext,
  args: {
    readonly message: ChatMessage;
    readonly sourceEventId?: ChatEventId | null;
    readonly replayArtifact?: ChatReplayArtifact | null;
    readonly telemetry?: ChatTelemetryEnvelope | null;
    readonly inferenceId?: ChatInferenceId | null;
    readonly linkReplay?: boolean;
    readonly linkTelemetry?: boolean;
    readonly linkInference?: boolean;
    readonly linkModeration?: boolean;
  },
): readonly ChatProofEdge[] {
  const edges: ChatProofEdge[] = [];
  const message = args.message;
  const roomId = message.roomId;

  for (const eventId of message.proof.causalParentEventIds) {
    edges.push(
      createEventToMessageProofEdge(context, {
        roomId,
        fromEventId: eventId,
        toMessageId: message.id,
        metadata: {
          reason: 'message.causal_parent_event',
        },
        createdAt: message.createdAt,
      }),
    );
  }

  for (const parentMessageId of message.proof.causalParentMessageIds) {
    edges.push(
      createMessageToMessageProofEdge(context, {
        roomId,
        fromMessageId: parentMessageId,
        toMessageId: message.id,
        fromEventId: args.sourceEventId ?? null,
        metadata: {
          reason: 'message.causal_parent_message',
        },
        createdAt: message.createdAt,
      }),
    );
  }

  if (args.linkReplay && args.replayArtifact) {
    edges.push(
      createMessageToReplayProofEdge(context, {
        roomId,
        fromMessageId: message.id,
        toReplayId: args.replayArtifact.id,
        fromEventId: args.sourceEventId ?? null,
        metadata: {
          reason: 'message.created_replay_artifact',
          replayLabel: args.replayArtifact.label,
        },
        createdAt: args.replayArtifact.createdAt,
      }),
    );
  }

  if (args.linkTelemetry && args.telemetry) {
    edges.push(
      createMessageToTelemetryProofEdge(context, {
        roomId,
        fromMessageId: message.id,
        toTelemetryId: args.telemetry.telemetryId,
        fromEventId: args.sourceEventId ?? null,
        metadata: {
          reason: 'message.created_telemetry',
          eventName: args.telemetry.eventName,
        },
        createdAt: args.telemetry.createdAt,
      }),
    );
  }

  if (args.linkInference && args.inferenceId) {
    edges.push(
      createMessageToInferenceProofEdge(context, {
        roomId,
        fromMessageId: message.id,
        toInferenceId: args.inferenceId,
        fromEventId: args.sourceEventId ?? null,
        metadata: {
          reason: 'message.created_inference',
        },
        createdAt: message.createdAt,
      }),
    );
  }

  if (
    args.linkModeration &&
    (message.policy.wasMasked || message.policy.wasRewritten || message.policy.shadowOnly)
  ) {
    edges.push(
      createModerationDecisionProofEdge(context, {
        roomId,
        fromEventId: args.sourceEventId ?? null,
        fromMessageId: null,
        toMessageId: message.id,
        originalText: null,
        rewrittenText: message.policy.wasRewritten ? message.plainText : null,
        moderationOutcome: message.policy.moderationOutcome,
        moderationReasons: message.policy.moderationReasons,
        maskedLexemes: [],
        createdAt: message.createdAt,
        metadata: {
          reason: 'message.policy_altered_output',
          shadowOnly: message.policy.shadowOnly,
          wasMasked: message.policy.wasMasked,
          wasRewritten: message.policy.wasRewritten,
          rateOutcome: message.policy.rateOutcome,
        },
      }),
    );
  }

  return edges;
}

// ============================================================================
// MARK: Append, merge, and state application
// ============================================================================

export function appendProofEdge(chain: ChatProofChain, edge: ChatProofEdge): ChatProofChain {
  const roomEdges = chain.byRoom[edge.roomId] ?? [];
  return {
    byRoom: {
      ...chain.byRoom,
      [edge.roomId]: [...roomEdges, edge],
    },
    byEdgeId: {
      ...chain.byEdgeId,
      [edge.id]: edge,
    },
  };
}

export function appendProofEdges(
  chain: ChatProofChain,
  edges: readonly ChatProofEdge[],
): ChatProofChain {
  let next = chain;
  for (const edge of edges) {
    next = appendProofEdge(next, edge);
  }
  return next;
}

export function applyProofEdge(state: ChatState, edge: ChatProofEdge): ChatState {
  return appendProofEdgeToState(state, edge);
}

export function applyProofEdges(state: ChatState, edges: readonly ChatProofEdge[]): ChatState {
  let next = state;
  for (const edge of edges) {
    next = appendProofEdgeToState(next, edge);
  }
  return next;
}

export function removeProofEdge(chain: ChatProofChain, edgeId: ChatProofEdgeId): ChatProofChain {
  const existing = chain.byEdgeId[edgeId];
  if (!existing) {
    return chain;
  }

  const byEdgeId = { ...chain.byEdgeId };
  delete byEdgeId[edgeId];

  const roomEdges = (chain.byRoom[existing.roomId] ?? []).filter((edge) => edge.id !== edgeId);
  const byRoom = {
    ...chain.byRoom,
    [existing.roomId]: roomEdges,
  };

  return {
    byRoom,
    byEdgeId,
  };
}

export function dedupeProofEdges(edges: readonly ChatProofEdge[]): readonly ChatProofEdge[] {
  const seen = new Set<string>();
  const result: ChatProofEdge[] = [];

  for (const edge of edges) {
    const key = [
      edge.roomId,
      edge.fromMessageId ?? '',
      edge.fromEventId ?? '',
      edge.toMessageId ?? '',
      edge.toReplayId ?? '',
      edge.toTelemetryId ?? '',
      edge.toInferenceId ?? '',
      edge.edgeType,
      canonicalizeJson(edge.metadata ?? {}),
    ].join('|');

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(edge);
  }

  return result;
}

// ============================================================================
// MARK: Selection helpers
// ============================================================================

export function selectProofEdge(
  chain: ChatProofChain,
  edgeId: ChatProofEdgeId,
): ChatProofEdge | null {
  return chain.byEdgeId[edgeId] ?? null;
}

export function selectProofEdgesForRoom(
  chain: ChatProofChain,
  roomId: ChatRoomId,
): readonly ChatProofEdge[] {
  return chain.byRoom[roomId] ?? [];
}

export function selectProofEdgesFromMessage(
  chain: ChatProofChain,
  roomId: ChatRoomId,
  messageId: ChatMessageId,
): readonly ChatProofEdge[] {
  return (chain.byRoom[roomId] ?? []).filter((edge) => edge.fromMessageId === messageId);
}

export function selectProofEdgesToMessage(
  chain: ChatProofChain,
  roomId: ChatRoomId,
  messageId: ChatMessageId,
): readonly ChatProofEdge[] {
  return (chain.byRoom[roomId] ?? []).filter((edge) => edge.toMessageId === messageId);
}

export function selectProofEdgesForMessage(
  chain: ChatProofChain,
  roomId: ChatRoomId,
  messageId: ChatMessageId,
): readonly ChatProofEdge[] {
  return (chain.byRoom[roomId] ?? []).filter((edge) => {
    return edge.fromMessageId === messageId || edge.toMessageId === messageId;
  });
}

export function selectProofEdgesFromEvent(
  chain: ChatProofChain,
  roomId: ChatRoomId,
  eventId: ChatEventId,
): readonly ChatProofEdge[] {
  return (chain.byRoom[roomId] ?? []).filter((edge) => edge.fromEventId === eventId);
}

export function selectProofEdgesToReplay(
  chain: ChatProofChain,
  roomId: ChatRoomId,
  replayId: ChatReplayId,
): readonly ChatProofEdge[] {
  return (chain.byRoom[roomId] ?? []).filter((edge) => edge.toReplayId === replayId);
}

export function selectProofEdgesToTelemetry(
  chain: ChatProofChain,
  roomId: ChatRoomId,
  telemetryId: ChatTelemetryId,
): readonly ChatProofEdge[] {
  return (chain.byRoom[roomId] ?? []).filter((edge) => edge.toTelemetryId === telemetryId);
}

export function selectProofEdgesToInference(
  chain: ChatProofChain,
  roomId: ChatRoomId,
  inferenceId: ChatInferenceId,
): readonly ChatProofEdge[] {
  return (chain.byRoom[roomId] ?? []).filter((edge) => edge.toInferenceId === inferenceId);
}

export function selectModerationProofEdges(
  chain: ChatProofChain,
  roomId: ChatRoomId,
): readonly ChatProofEdge[] {
  return (chain.byRoom[roomId] ?? []).filter((edge) => edge.edgeType === 'MODERATION_DECISION');
}

export function selectProofEdgesWithinTimeRange(
  chain: ChatProofChain,
  roomId: ChatRoomId,
  startInclusive: UnixMs,
  endInclusive: UnixMs,
): readonly ChatProofEdge[] {
  return (chain.byRoom[roomId] ?? []).filter((edge) => {
    return Number(edge.createdAt) >= Number(startInclusive) && Number(edge.createdAt) <= Number(endInclusive);
  });
}

// ============================================================================
// MARK: Verification and integrity
// ============================================================================

export function verifyProofEdgeHash(
  context: ChatProofChainContext,
  edge: ChatProofEdge,
): boolean {
  const seed: ChatProofEdgeSeed = {
    roomId: edge.roomId,
    createdAt: edge.createdAt,
    fromMessageId: edge.fromMessageId,
    fromEventId: edge.fromEventId,
    toMessageId: edge.toMessageId,
    toReplayId: edge.toReplayId,
    toTelemetryId: edge.toTelemetryId,
    toInferenceId: edge.toInferenceId,
    edgeType: edge.edgeType,
    metadata: edge.metadata,
  };

  const material = createCanonicalProofMaterial(seed, edge.createdAt);
  const expected = context.ports.hash.hash(material);
  return expected === edge.hash;
}

export function verifyRoomProofChain(
  context: ChatProofChainContext,
  state: ChatState,
  roomId: ChatRoomId,
): ChatProofVerificationReport {
  const edges = selectRoomProofEdges(state, roomId);
  const transcript = selectRoomTranscript(state, roomId);
  const messageIds = new Set(transcript.map((entry) => entry.message.id));
  const replayIds = new Set((state.replay.byRoom[roomId] ?? []).map((item) => item.id));
  const telemetryIds = new Set(
    state.telemetryQueue
      .filter((item) => item.roomId === roomId)
      .map((item) => item.telemetryId),
  );
  const inferenceIds = new Set(
    Object.values(state.inferenceSnapshots)
      .filter((item) => item.roomId === roomId)
      .map((item) => item.inferenceId),
  );

  const invalidEdgeIds: ChatProofEdgeId[] = [];
  const orphanEdgeIds: ChatProofEdgeId[] = [];
  const duplicateEdgeIds: ChatProofEdgeId[] = [];
  const brokenMessageTargets: ChatProofEdgeId[] = [];
  const brokenReplayTargets: ChatProofEdgeId[] = [];
  const brokenTelemetryTargets: ChatProofEdgeId[] = [];
  const brokenInferenceTargets: ChatProofEdgeId[] = [];
  const notes: string[] = [];
  const dedupe = new Set<string>();

  for (const edge of edges) {
    if (!verifyProofEdgeHash(context, edge)) {
      invalidEdgeIds.push(edge.id);
    }

    const dedupeKey = [
      edge.roomId,
      edge.fromMessageId ?? '',
      edge.fromEventId ?? '',
      edge.toMessageId ?? '',
      edge.toReplayId ?? '',
      edge.toTelemetryId ?? '',
      edge.toInferenceId ?? '',
      edge.edgeType,
      canonicalizeJson(edge.metadata ?? {}),
    ].join('|');

    if (dedupe.has(dedupeKey)) {
      duplicateEdgeIds.push(edge.id);
    } else {
      dedupe.add(dedupeKey);
    }

    const hasOrigin = Boolean(edge.fromMessageId || edge.fromEventId);
    const hasDestination = Boolean(
      edge.toMessageId || edge.toReplayId || edge.toTelemetryId || edge.toInferenceId,
    );

    if (!hasOrigin || !hasDestination) {
      orphanEdgeIds.push(edge.id);
    }

    if (edge.fromMessageId && !messageIds.has(edge.fromMessageId)) {
      brokenMessageTargets.push(edge.id);
      notes.push(`fromMessageId missing from transcript: ${String(edge.fromMessageId)}`);
    }

    if (edge.toMessageId && !messageIds.has(edge.toMessageId)) {
      brokenMessageTargets.push(edge.id);
      notes.push(`toMessageId missing from transcript: ${String(edge.toMessageId)}`);
    }

    if (edge.toReplayId && !replayIds.has(edge.toReplayId)) {
      brokenReplayTargets.push(edge.id);
      notes.push(`toReplayId missing from replay index: ${String(edge.toReplayId)}`);
    }

    if (edge.toTelemetryId && !telemetryIds.has(edge.toTelemetryId)) {
      brokenTelemetryTargets.push(edge.id);
      notes.push(`toTelemetryId not currently queued/published in state: ${String(edge.toTelemetryId)}`);
    }

    if (edge.toInferenceId && !inferenceIds.has(edge.toInferenceId)) {
      brokenInferenceTargets.push(edge.id);
      notes.push(`toInferenceId missing from inference snapshots: ${String(edge.toInferenceId)}`);
    }
  }

  const ok =
    invalidEdgeIds.length === 0 &&
    orphanEdgeIds.length === 0 &&
    duplicateEdgeIds.length === 0 &&
    brokenMessageTargets.length === 0 &&
    brokenReplayTargets.length === 0 &&
    brokenTelemetryTargets.length === 0 &&
    brokenInferenceTargets.length === 0;

  return {
    ok,
    roomId,
    checkedEdgeCount: edges.length,
    invalidEdgeIds,
    orphanEdgeIds,
    duplicateEdgeIds,
    brokenMessageTargets,
    brokenReplayTargets,
    brokenTelemetryTargets,
    brokenInferenceTargets,
    notes,
  };
}

export function verifyStateProofIntegrity(
  context: ChatProofChainContext,
  state: ChatState,
): readonly ChatProofVerificationReport[] {
  return Object.keys(state.rooms).map((roomId) =>
    verifyRoomProofChain(context, state, roomId as ChatRoomId),
  );
}

// ============================================================================
// MARK: Digest and proof materialization helpers
// ============================================================================

export function createProofDigest(
  context: ChatProofChainContext,
  args: {
    readonly material: readonly string[];
    readonly metadata?: Readonly<Record<string, JsonValue>>;
    readonly createdAt?: UnixMs;
  },
): ChatProofDigest {
  const createdAt = args.createdAt ?? asUnixMs(context.ports.clock.now());
  const canonical = args.material.join('\n');
  return {
    algorithm: 'FNV1A32',
    hash: context.ports.hash.hash(canonical),
    materializedAt: createdAt,
    sourceCount: args.material.length,
    metadata: { ...(args.metadata ?? {}) },
  };
}

export function buildTranscriptRangeProof(
  context: ChatProofChainContext,
  state: ChatState,
  args: {
    readonly roomId: ChatRoomId;
    readonly fromSequenceInclusive: number;
    readonly toSequenceInclusive: number;
  },
): ChatTranscriptRangeProof {
  const entries = selectRoomTranscript(state, args.roomId).filter((entry) => {
    const sequence = Number(entry.message.sequenceNumber);
    return sequence >= args.fromSequenceInclusive && sequence <= args.toSequenceInclusive;
  });

  const messageIds = entries.map((entry) => entry.message.id);
  const edges = selectProofEdgesForRoom(state.proofChain, args.roomId).filter((edge) => {
    return (
      (edge.fromMessageId && messageIds.includes(edge.fromMessageId)) ||
      (edge.toMessageId && messageIds.includes(edge.toMessageId))
    );
  });

  const transcriptMaterial = entries.map((entry) =>
    createCanonicalTranscriptMaterial(entry.message),
  );
  const proofMaterial = edges.map((edge) =>
    createCanonicalProofMaterial(
      {
        roomId: edge.roomId,
        createdAt: edge.createdAt,
        fromMessageId: edge.fromMessageId,
        fromEventId: edge.fromEventId,
        toMessageId: edge.toMessageId,
        toReplayId: edge.toReplayId,
        toTelemetryId: edge.toTelemetryId,
        toInferenceId: edge.toInferenceId,
        edgeType: edge.edgeType,
        metadata: edge.metadata,
      },
      edge.createdAt,
    ),
  );

  return {
    roomId: args.roomId,
    fromSequenceInclusive: args.fromSequenceInclusive,
    toSequenceInclusive: args.toSequenceInclusive,
    messageIds,
    edgeIds: edges.map((edge) => edge.id),
    transcriptDigest: createProofDigest(context, {
      material: transcriptMaterial,
      metadata: {
        scope: 'transcript.range',
        roomId: args.roomId,
        fromSequenceInclusive: args.fromSequenceInclusive,
        toSequenceInclusive: args.toSequenceInclusive,
      },
    }),
    proofDigest: createProofDigest(context, {
      material: proofMaterial,
      metadata: {
        scope: 'proof.range',
        roomId: args.roomId,
        fromSequenceInclusive: args.fromSequenceInclusive,
        toSequenceInclusive: args.toSequenceInclusive,
      },
    }),
  };
}

export function buildRoomProofTimeline(
  context: ChatProofChainContext,
  state: ChatState,
  roomId: ChatRoomId,
): ChatRoomProofTimeline {
  const edges = selectProofEdgesForRoom(state.proofChain, roomId);
  const firstEdgeAt = edges.length > 0 ? edges[0].createdAt : null;
  const lastEdgeAt = edges.length > 0 ? edges[edges.length - 1].createdAt : null;

  const digestMaterial = edges.map((edge) =>
    createCanonicalProofMaterial(
      {
        roomId: edge.roomId,
        createdAt: edge.createdAt,
        fromMessageId: edge.fromMessageId,
        fromEventId: edge.fromEventId,
        toMessageId: edge.toMessageId,
        toReplayId: edge.toReplayId,
        toTelemetryId: edge.toTelemetryId,
        toInferenceId: edge.toInferenceId,
        edgeType: edge.edgeType,
        metadata: edge.metadata,
      },
      edge.createdAt,
    ),
  );

  return {
    roomId,
    firstEdgeAt,
    lastEdgeAt,
    messageEdgeCount: edges.filter((edge) => edge.edgeType === 'MESSAGE_TO_MESSAGE').length,
    moderationEdgeCount: edges.filter((edge) => edge.edgeType === 'MODERATION_DECISION').length,
    replayEdgeCount: edges.filter((edge) => edge.edgeType === 'MESSAGE_TO_REPLAY').length,
    telemetryEdgeCount: edges.filter((edge) => edge.edgeType === 'MESSAGE_TO_TELEMETRY').length,
    inferenceEdgeCount: edges.filter((edge) => edge.edgeType === 'MESSAGE_TO_INFERENCE').length,
    digest: createProofDigest(context, {
      material: digestMaterial,
      metadata: {
        scope: 'room.timeline',
        roomId,
        edgeCount: edges.length,
      },
    }),
  };
}

export function buildMessageCausalClosure(
  state: ChatState,
  roomId: ChatRoomId,
  rootMessageId: ChatMessageId,
): ChatMessageCausalClosure {
  const edges = selectProofEdgesForRoom(state.proofChain, roomId);
  const upstreamMessageIds = new Set<ChatMessageId>();
  const upstreamEventIds = new Set<ChatEventId>();
  const downstreamMessageIds = new Set<ChatMessageId>();
  const downstreamReplayIds = new Set<ChatReplayId>();
  const downstreamTelemetryIds = new Set<ChatTelemetryId>();
  const downstreamInferenceIds = new Set<ChatInferenceId>();
  const traversedEdgeIds = new Set<ChatProofEdgeId>();

  const queue: ChatMessageId[] = [rootMessageId];
  const visited = new Set<ChatMessageId>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    for (const edge of edges) {
      if (edge.toMessageId === current) {
        traversedEdgeIds.add(edge.id);
        if (edge.fromMessageId) {
          upstreamMessageIds.add(edge.fromMessageId);
          queue.push(edge.fromMessageId);
        }
        if (edge.fromEventId) {
          upstreamEventIds.add(edge.fromEventId);
        }
      }

      if (edge.fromMessageId === current) {
        traversedEdgeIds.add(edge.id);
        if (edge.toMessageId) {
          downstreamMessageIds.add(edge.toMessageId);
        }
        if (edge.toReplayId) {
          downstreamReplayIds.add(edge.toReplayId);
        }
        if (edge.toTelemetryId) {
          downstreamTelemetryIds.add(edge.toTelemetryId);
        }
        if (edge.toInferenceId) {
          downstreamInferenceIds.add(edge.toInferenceId);
        }
      }
    }
  }

  downstreamMessageIds.delete(rootMessageId);
  upstreamMessageIds.delete(rootMessageId);

  return {
    rootMessageId,
    roomId,
    upstreamMessageIds: [...upstreamMessageIds],
    upstreamEventIds: [...upstreamEventIds],
    downstreamMessageIds: [...downstreamMessageIds],
    downstreamReplayIds: [...downstreamReplayIds],
    downstreamTelemetryIds: [...downstreamTelemetryIds],
    downstreamInferenceIds: [...downstreamInferenceIds],
    traversedEdgeIds: [...traversedEdgeIds],
  };
}

// ============================================================================
// MARK: State-derived proof convenience helpers
// ============================================================================

export function createProofEdgesForReplayArtifacts(
  context: ChatProofChainContext,
  args: {
    readonly roomId: ChatRoomId;
    readonly sourceMessageIds: readonly ChatMessageId[];
    readonly replayArtifacts: readonly ChatReplayArtifact[];
    readonly sourceEventId?: ChatEventId | null;
    readonly reason?: string;
  },
): readonly ChatProofEdge[] {
  const edges: ChatProofEdge[] = [];

  for (const replay of args.replayArtifacts) {
    for (const messageId of args.sourceMessageIds) {
      edges.push(
        createMessageToReplayProofEdge(context, {
          roomId: args.roomId,
          fromMessageId: messageId,
          toReplayId: replay.id,
          fromEventId: args.sourceEventId ?? null,
          metadata: {
            reason: args.reason ?? 'replay.linked_to_source_message',
            replayAnchorKey: replay.anchorKey,
            replayLabel: replay.label,
          },
          createdAt: replay.createdAt,
        }),
      );
    }
  }

  return edges;
}

export function createProofEdgesForTelemetryBatch(
  context: ChatProofChainContext,
  args: {
    readonly roomId: ChatRoomId;
    readonly sourceMessageIds: readonly ChatMessageId[];
    readonly telemetry: readonly ChatTelemetryEnvelope[];
    readonly sourceEventId?: ChatEventId | null;
    readonly reason?: string;
  },
): readonly ChatProofEdge[] {
  const edges: ChatProofEdge[] = [];

  for (const telemetry of args.telemetry) {
    for (const messageId of args.sourceMessageIds) {
      edges.push(
        createMessageToTelemetryProofEdge(context, {
          roomId: args.roomId,
          fromMessageId: messageId,
          toTelemetryId: telemetry.telemetryId,
          fromEventId: args.sourceEventId ?? null,
          metadata: {
            reason: args.reason ?? 'telemetry.linked_to_source_message',
            eventName: telemetry.eventName,
          },
          createdAt: telemetry.createdAt,
        }),
      );
    }
  }

  return edges;
}

export function createProofEdgesForInferenceBatch(
  context: ChatProofChainContext,
  args: {
    readonly roomId: ChatRoomId;
    readonly sourceMessageIds: readonly ChatMessageId[];
    readonly inferenceIds: readonly ChatInferenceId[];
    readonly sourceEventId?: ChatEventId | null;
    readonly reason?: string;
    readonly createdAt?: UnixMs;
  },
): readonly ChatProofEdge[] {
  const edges: ChatProofEdge[] = [];
  const createdAt = args.createdAt ?? asUnixMs(context.ports.clock.now());

  for (const inferenceId of args.inferenceIds) {
    for (const messageId of args.sourceMessageIds) {
      edges.push(
        createMessageToInferenceProofEdge(context, {
          roomId: args.roomId,
          fromMessageId: messageId,
          toInferenceId: inferenceId,
          fromEventId: args.sourceEventId ?? null,
          metadata: {
            reason: args.reason ?? 'inference.linked_to_source_message',
          },
          createdAt,
        }),
      );
    }
  }

  return edges;
}

// ============================================================================
// MARK: Proof coverage analysis
// ============================================================================

export function findTranscriptMessagesWithoutProofCoverage(
  state: ChatState,
  roomId: ChatRoomId,
): readonly ChatMessageId[] {
  const transcript = selectRoomTranscript(state, roomId);
  const edgeCovered = new Set<ChatMessageId>();

  for (const edge of selectRoomProofEdges(state, roomId)) {
    if (edge.fromMessageId) {
      edgeCovered.add(edge.fromMessageId);
    }
    if (edge.toMessageId) {
      edgeCovered.add(edge.toMessageId);
    }
  }

  return transcript
    .map((entry) => entry.message.id)
    .filter((messageId) => !edgeCovered.has(messageId));
}

export function findReplayArtifactsWithoutProofCoverage(
  state: ChatState,
  roomId: ChatRoomId,
): readonly ChatReplayId[] {
  const replayIds = new Set((state.replay.byRoom[roomId] ?? []).map((item) => item.id));
  const linked = new Set<ChatReplayId>();

  for (const edge of selectRoomProofEdges(state, roomId)) {
    if (edge.toReplayId) {
      linked.add(edge.toReplayId);
    }
  }

  return [...replayIds].filter((id) => !linked.has(id));
}

export function findInferenceSnapshotsWithoutProofCoverage(
  state: ChatState,
  roomId: ChatRoomId,
): readonly ChatInferenceId[] {
  const inferenceIds = Object.values(state.inferenceSnapshots)
    .filter((snapshot) => snapshot.roomId === roomId)
    .map((snapshot) => snapshot.inferenceId);

  const linked = new Set<ChatInferenceId>();
  for (const edge of selectRoomProofEdges(state, roomId)) {
    if (edge.toInferenceId) {
      linked.add(edge.toInferenceId);
    }
  }

  return inferenceIds.filter((id) => !linked.has(id));
}

// ============================================================================
// MARK: Room-wide reconciliation
// ============================================================================

export function reconcileRoomProofCoverage(
  context: ChatProofChainContext,
  state: ChatState,
  roomId: ChatRoomId,
): {
  readonly state: ChatState;
  readonly appendedEdges: readonly ChatProofEdge[];
} {
  const transcript = selectRoomTranscript(state, roomId);
  const replayArtifacts = state.replay.byRoom[roomId] ?? [];
  const existingEdges = selectRoomProofEdges(state, roomId);

  const messageIdsWithCoverage = new Set<ChatMessageId>();
  const replayIdsWithCoverage = new Set<ChatReplayId>();

  for (const edge of existingEdges) {
    if (edge.toMessageId) {
      messageIdsWithCoverage.add(edge.toMessageId);
    }
    if (edge.fromMessageId) {
      messageIdsWithCoverage.add(edge.fromMessageId);
    }
    if (edge.toReplayId) {
      replayIdsWithCoverage.add(edge.toReplayId);
    }
  }

  const appendedEdges: ChatProofEdge[] = [];
  let nextState = state;

  for (const entry of transcript) {
    const message = entry.message;
    if (messageIdsWithCoverage.has(message.id)) {
      continue;
    }

    const edges = createProofEdgesForMessage(context, {
      message,
      sourceEventId: message.proof.causalParentEventIds[0] ?? null,
      replayArtifact: null,
      telemetry: null,
      inferenceId: message.learning.inferenceId,
      linkReplay: false,
      linkTelemetry: false,
      linkInference: Boolean(message.learning.inferenceId),
      linkModeration: true,
    });

    nextState = applyProofEdges(nextState, edges);
    appendedEdges.push(...edges);
  }

  for (const replay of replayArtifacts) {
    if (replayIdsWithCoverage.has(replay.id)) {
      continue;
    }

    const anchorEntries = transcript.filter((entry) => {
      return entry.message.replay.replayAnchorKey === replay.anchorKey;
    });

    const sourceIds = anchorEntries.map((entry) => entry.message.id);
    if (sourceIds.length === 0) {
      continue;
    }

    const edges = createProofEdgesForReplayArtifacts(context, {
      roomId,
      sourceMessageIds: sourceIds,
      replayArtifacts: [replay],
      sourceEventId: replay.eventId,
      reason: 'reconcile.room_replay_coverage',
    });

    nextState = applyProofEdges(nextState, edges);
    appendedEdges.push(...edges);
  }

  return {
    state: nextState,
    appendedEdges,
  };
}

// ============================================================================
// MARK: Canonical material builders
// ============================================================================

export function createCanonicalProofMaterial(
  seed: ChatProofEdgeSeed,
  createdAt: UnixMs,
): string {
  return [
    `roomId=${String(seed.roomId)}`,
    `createdAt=${String(createdAt)}`,
    `fromMessageId=${String(seed.fromMessageId ?? '')}`,
    `fromEventId=${String(seed.fromEventId ?? '')}`,
    `toMessageId=${String(seed.toMessageId ?? '')}`,
    `toReplayId=${String(seed.toReplayId ?? '')}`,
    `toTelemetryId=${String(seed.toTelemetryId ?? '')}`,
    `toInferenceId=${String(seed.toInferenceId ?? '')}`,
    `edgeType=${seed.edgeType}`,
    `metadata=${canonicalizeJson(seed.metadata ?? {})}`,
  ].join('|');
}

export function createCanonicalTranscriptMaterial(message: ChatMessage): string {
  return [
    `id=${String(message.id)}`,
    `roomId=${String(message.roomId)}`,
    `channelId=${message.channelId}`,
    `sequenceNumber=${String(message.sequenceNumber)}`,
    `createdAt=${String(message.createdAt)}`,
    `editedAt=${String(message.editedAt ?? '')}`,
    `deletedAt=${String(message.deletedAt ?? '')}`,
    `redactedAt=${String(message.redactedAt ?? '')}`,
    `plainText=${message.plainText}`,
    `sourceType=${message.attribution.sourceType}`,
    `actorId=${message.attribution.actorId}`,
    `displayName=${message.attribution.displayName}`,
    `npcRole=${String(message.attribution.npcRole ?? '')}`,
    `botId=${String(message.attribution.botId ?? '')}`,
    `moderationOutcome=${message.policy.moderationOutcome}`,
    `rateOutcome=${message.policy.rateOutcome}`,
    `shadowOnly=${String(message.policy.shadowOnly)}`,
    `wasRewritten=${String(message.policy.wasRewritten)}`,
    `wasMasked=${String(message.policy.wasMasked)}`,
    `replayId=${String(message.replay.replayId ?? '')}`,
    `sceneId=${String(message.replay.sceneId ?? '')}`,
    `momentId=${String(message.replay.momentId ?? '')}`,
    `legendId=${String(message.replay.legendId ?? '')}`,
    `learningTriggered=${String(message.learning.learningTriggered)}`,
    `inferenceSource=${message.learning.inferenceSource}`,
    `inferenceId=${String(message.learning.inferenceId ?? '')}`,
    `proofHash=${String(message.proof.proofHash ?? '')}`,
    `causalParentMessageIds=${message.proof.causalParentMessageIds.join(',')}`,
    `causalParentEventIds=${message.proof.causalParentEventIds.join(',')}`,
    `tags=${message.tags.join(',')}`,
    `metadata=${canonicalizeJson(message.metadata ?? {})}`,
  ].join('|');
}

// ============================================================================
// MARK: Utility
// ============================================================================

export function summarizeProofChain(chain: ChatProofChain): {
  readonly roomCount: number;
  readonly edgeCount: number;
  readonly edgeTypeCounts: Readonly<Record<ChatProofEdge['edgeType'], number>>;
} {
  const edgeTypeCounts: Record<ChatProofEdge['edgeType'], number> = {
    MESSAGE_TO_MESSAGE: 0,
    EVENT_TO_MESSAGE: 0,
    MESSAGE_TO_REPLAY: 0,
    MESSAGE_TO_TELEMETRY: 0,
    MESSAGE_TO_INFERENCE: 0,
    MODERATION_DECISION: 0,
  };

  let edgeCount = 0;
  for (const edge of Object.values(chain.byEdgeId)) {
    edgeCount += 1;
    edgeTypeCounts[edge.edgeType] += 1;
  }

  return {
    roomCount: Object.keys(chain.byRoom).length,
    edgeCount,
    edgeTypeCounts,
  };
}

export function canonicalizeJson(value: JsonValue): string {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item)).join(',')}]`;
  }

  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalizeJson((value as Record<string, JsonValue>)[key])}`).join(',')}}`;
}

export function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function randomBase36(length: number): string {
  let output = '';
  while (output.length < length) {
    output += Math.random().toString(36).slice(2);
  }
  return output.slice(0, length);
}

// ============================================================================
// MARK: Proof watch bus
// ============================================================================

export type ProofWatchEvent =
  | { kind: 'EDGE_APPENDED'; edgeId: ChatProofEdgeId; roomId: ChatRoomId }
  | { kind: 'CHAIN_VALIDATED'; roomId: ChatRoomId; valid: boolean }
  | { kind: 'HASH_MISMATCH'; roomId: ChatRoomId; messageId: ChatMessageId };

export type ProofWatchCallback = (event: ProofWatchEvent) => void;

export class ProofWatchBus {
  private readonly subscribers = new Set<ProofWatchCallback>();

  subscribe(cb: ProofWatchCallback): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  emit(event: ProofWatchEvent): void {
    for (const cb of this.subscribers) {
      try { cb(event); } catch { /* isolate */ }
    }
  }

  emitEdgeAppended(edgeId: ChatProofEdgeId, roomId: ChatRoomId): void {
    this.emit({ kind: 'EDGE_APPENDED', edgeId, roomId });
  }

  emitChainValidated(roomId: ChatRoomId, valid: boolean): void {
    this.emit({ kind: 'CHAIN_VALIDATED', roomId, valid });
  }

  emitHashMismatch(roomId: ChatRoomId, messageId: ChatMessageId): void {
    this.emit({ kind: 'HASH_MISMATCH', roomId, messageId });
  }

  size(): number { return this.subscribers.size; }
}

// ============================================================================
// MARK: Proof edge fingerprint
// ============================================================================

export interface ProofEdgeFingerprint {
  readonly edgeId: ChatProofEdgeId;
  readonly roomId: ChatRoomId;
  readonly messageId: ChatMessageId;
  readonly edgeKind: string;
  readonly hash: string;
}

export function computeProofEdgeFingerprint(
  edge: ChatProofEdge,
  roomId: ChatRoomId,
): ProofEdgeFingerprint {
  const hash = [
    edge.id,
    roomId,
    edge.toMessageId,
    edge.edgeType,
    edge.hash,
  ].join('|');

  return Object.freeze({
    edgeId: edge.id,
    roomId,
    messageId: edge.toMessageId,
    edgeKind: edge.edgeType,
    hash,
  });
}

// ============================================================================
// MARK: Proof chain integrity report
// ============================================================================

export interface ProofChainIntegrityReport {
  readonly roomId: ChatRoomId;
  readonly totalEdges: number;
  readonly validEdges: number;
  readonly invalidEdges: number;
  readonly missingEdges: number;
  readonly integrityScore01: number;
  readonly computedAt: UnixMs;
}

export function buildProofChainIntegrityReport(
  state: ChatState,
  roomId: ChatRoomId,
  hashPort: ChatHashPort,
  now: UnixMs,
): ProofChainIntegrityReport {
  const edges = selectRoomProofEdges(state, roomId);
  const transcript = selectRoomTranscript(state, roomId);

  let valid = 0;
  let invalid = 0;

  for (const edge of edges) {
    const msg = transcript.find((e) => e.message.id === edge.toMessageId);
    if (!msg) { invalid++; continue; }
    const computed = hashPort.hash(msg.message.plainText);
    if (computed === edge.hash) valid++;
    else invalid++;
  }

  const missing = Math.max(0, transcript.length - edges.length);
  const total = edges.length;

  return Object.freeze({
    roomId,
    totalEdges: total,
    validEdges: valid,
    invalidEdges: invalid,
    missingEdges: missing,
    integrityScore01: total > 0 ? valid / total : 1,
    computedAt: now,
  });
}

// ============================================================================
// MARK: Proof chain diff
// ============================================================================

export interface ProofChainDiff {
  readonly roomId: ChatRoomId;
  readonly addedEdges: readonly ChatProofEdgeId[];
  readonly removedEdges: readonly ChatProofEdgeId[];
  readonly computedAt: UnixMs;
}

export function diffProofChains(
  roomId: ChatRoomId,
  before: readonly ChatProofEdge[],
  after: readonly ChatProofEdge[],
  now: UnixMs,
): ProofChainDiff {
  const beforeIds = new Set(before.map((e) => e.id));
  const afterIds = new Set(after.map((e) => e.id));

  const added = after.filter((e) => !beforeIds.has(e.id)).map((e) => e.id);
  const removed = before.filter((e) => !afterIds.has(e.id)).map((e) => e.id);

  return Object.freeze({
    roomId,
    addedEdges: Object.freeze(added),
    removedEdges: Object.freeze(removed),
    computedAt: now,
  });
}

// ============================================================================
// MARK: Proof edge ledger (in-memory)
// ============================================================================

export class ProofEdgeLedger {
  private readonly edges = new Map<ChatRoomId, ChatProofEdge[]>();

  append(roomId: ChatRoomId, edge: ChatProofEdge): void {
    if (!this.edges.has(roomId)) this.edges.set(roomId, []);
    this.edges.get(roomId)!.push(edge);
  }

  getEdges(roomId: ChatRoomId): readonly ChatProofEdge[] {
    return this.edges.get(roomId) ?? [];
  }

  countEdges(roomId: ChatRoomId): number {
    return this.edges.get(roomId)?.length ?? 0;
  }

  allRooms(): readonly ChatRoomId[] {
    return Array.from(this.edges.keys());
  }

  purgeRoom(roomId: ChatRoomId): void {
    this.edges.delete(roomId);
  }

  latestEdge(roomId: ChatRoomId): ChatProofEdge | null {
    const list = this.edges.get(roomId);
    return list && list.length > 0 ? list[list.length - 1]! : null;
  }
}

// ============================================================================
// MARK: Replay artifact proof linker
// ============================================================================

export interface ReplayProofLink {
  readonly replayId: ChatReplayId;
  readonly linkedEdgeIds: readonly ChatProofEdgeId[];
  readonly linkedMessageIds: readonly ChatMessageId[];
}

export function buildReplayProofLink(
  replayArtifact: ChatReplayArtifact,
  edges: readonly ChatProofEdge[],
): ReplayProofLink {
  const linked = edges.filter((e) => e.toReplayId === replayArtifact.id);

  return Object.freeze({
    replayId: replayArtifact.id,
    linkedEdgeIds: Object.freeze(linked.map((e) => e.id)),
    linkedMessageIds: Object.freeze(linked.map((e) => e.toMessageId)),
  });
}

// ============================================================================
// MARK: Inference ID proof linker
// ============================================================================

export interface InferenceProofLink {
  readonly inferenceId: ChatInferenceId;
  readonly linkedEdgeCount: number;
  readonly linkedEdgeIds: readonly ChatProofEdgeId[];
}

export function buildInferenceProofLink(
  inferenceId: ChatInferenceId,
  edges: readonly ChatProofEdge[],
): InferenceProofLink {
  const linked = edges.filter((e) => e.toInferenceId === inferenceId);
  return Object.freeze({
    inferenceId,
    linkedEdgeCount: linked.length,
    linkedEdgeIds: Object.freeze(linked.map((e) => e.id)),
  });
}

// ============================================================================
// MARK: Telemetry proof linker
// ============================================================================

export interface TelemetryProofLink {
  readonly telemetryId: ChatTelemetryId;
  readonly linkedEdgeIds: readonly ChatProofEdgeId[];
}

export function buildTelemetryProofLink(
  telemetry: ChatTelemetryEnvelope,
  edges: readonly ChatProofEdge[],
): TelemetryProofLink {
  const linked = edges.filter((e) => e.toTelemetryId === telemetry.telemetryId);
  return Object.freeze({
    telemetryId: telemetry.telemetryId,
    linkedEdgeIds: Object.freeze(linked.map((e) => e.id)),
  });
}

// ============================================================================
// MARK: Module constants
// ============================================================================

export const CHAT_PROOF_CHAIN_MODULE_NAME = 'ChatProofChain' as const;
export const CHAT_PROOF_CHAIN_MODULE_VERSION = '2026.03.14.2' as const;

export const CHAT_PROOF_CHAIN_MODULE_LAWS = Object.freeze([
  'Proof chain never mutates transcript text.',
  'Proof edges are append-only — no editing.',
  'Hash mismatches are flagged, not silently ignored.',
  'Replay, inference, and telemetry links are derived from existing edges.',
  'All proof objects are frozen before export.',
]);

export const CHAT_PROOF_CHAIN_MODULE_DESCRIPTOR = Object.freeze({
  name: CHAT_PROOF_CHAIN_MODULE_NAME,
  version: CHAT_PROOF_CHAIN_MODULE_VERSION,
  laws: CHAT_PROOF_CHAIN_MODULE_LAWS,
});

export function createProofWatchBus(): ProofWatchBus {
  return new ProofWatchBus();
}

export function createProofEdgeLedger(): ProofEdgeLedger {
  return new ProofEdgeLedger();
}

// Re-export state helpers for convenience
export { appendProofEdgeToState, selectRoomProofEdges, selectRoomTranscript };

// ============================================================================
// MARK: Proof chain snapshot builder
// ============================================================================

export interface ProofChainSnapshot {
  readonly roomId: ChatRoomId;
  readonly edgeCount: number;
  readonly latestEdgeId: ChatProofEdgeId | null;
  readonly latestHash: ChatProofHash | null;
  readonly computedAt: UnixMs;
}

export function buildProofChainSnapshot(
  state: ChatState,
  roomId: ChatRoomId,
  now: UnixMs,
): ProofChainSnapshot {
  const edges = selectRoomProofEdges(state, roomId);
  const latest = edges.length > 0 ? edges[edges.length - 1]! : null;
  return Object.freeze({
    roomId,
    edgeCount: edges.length,
    latestEdgeId: latest?.id ?? null,
    latestHash: latest?.hash ?? null,
    computedAt: now,
  });
}

// ============================================================================
// MARK: Proof coverage report
// ============================================================================

export interface ProofCoverageReport {
  readonly roomId: ChatRoomId;
  readonly totalMessages: number;
  readonly coveredMessages: number;
  readonly uncoveredMessages: number;
  readonly coverageRate01: number;
}

export function buildProofCoverageReport(
  state: ChatState,
  roomId: ChatRoomId,
): ProofCoverageReport {
  const transcript = selectRoomTranscript(state, roomId);
  const edges = selectRoomProofEdges(state, roomId);
  const coveredIds = new Set(edges.map((e) => e.toMessageId));
  const covered = transcript.filter((e) => coveredIds.has(e.message.id)).length;

  return Object.freeze({
    roomId,
    totalMessages: transcript.length,
    coveredMessages: covered,
    uncoveredMessages: transcript.length - covered,
    coverageRate01: transcript.length > 0 ? covered / transcript.length : 1,
  });
}

// ============================================================================
// MARK: Proof edge search helpers
// ============================================================================

export function findEdgeByMessageId(
  edges: readonly ChatProofEdge[],
  messageId: ChatMessageId,
): ChatProofEdge | null {
  return edges.find((e) => e.toMessageId === messageId) ?? null;
}

export function findEdgesByEventId(
  edges: readonly ChatProofEdge[],
  eventId: ChatEventId,
): readonly ChatProofEdge[] {
  return edges.filter((e) => e.fromEventId === eventId);
}

export function findEdgesByKind(
  edges: readonly ChatProofEdge[],
  kind: string,
): readonly ChatProofEdge[] {
  return edges.filter((e) => e.edgeType === kind);
}

// ============================================================================
// MARK: Proof chain age report
// ============================================================================

export interface ProofChainAgeReport {
  readonly roomId: ChatRoomId;
  readonly oldestEdgeAt: UnixMs | null;
  readonly newestEdgeAt: UnixMs | null;
  readonly spanMs: number;
}

export function buildProofChainAgeReport(
  state: ChatState,
  roomId: ChatRoomId,
): ProofChainAgeReport {
  const edges = selectRoomProofEdges(state, roomId);
  if (edges.length === 0) {
    return Object.freeze({ roomId, oldestEdgeAt: null, newestEdgeAt: null, spanMs: 0 });
  }

  const times = edges.map((e) => e.createdAt as unknown as number);
  const oldest = asUnixMs(Math.min(...times));
  const newest = asUnixMs(Math.max(...times));
  const spanMs = (newest as unknown as number) - (oldest as unknown as number);

  return Object.freeze({ roomId, oldestEdgeAt: oldest, newestEdgeAt: newest, spanMs });
}

// ============================================================================
// MARK: Message body hash verifier
// ============================================================================

export interface MessageHashVerificationResult {
  readonly messageId: ChatMessageId;
  readonly expected: ChatProofHash;
  readonly computed: ChatProofHash;
  readonly valid: boolean;
}

export function verifyMessageBodyHash(
  message: ChatMessage,
  edge: ChatProofEdge,
  hashPort: ChatHashPort,
): MessageHashVerificationResult {
  const computed = hashPort.hash(message.plainText);
  return Object.freeze({
    messageId: message.id,
    expected: edge.hash,
    computed,
    valid: computed === edge.hash,
  });
}

// ============================================================================
// MARK: Extended module namespace
// ============================================================================

export const ChatProofChainModuleExtended = Object.freeze({
  createProofWatchBus,
  createProofEdgeLedger,
  computeProofEdgeFingerprint,
  buildProofChainIntegrityReport,
  diffProofChains,
  buildReplayProofLink,
  buildInferenceProofLink,
  buildTelemetryProofLink,
  buildProofChainSnapshot,
  buildProofCoverageReport,
  findEdgeByMessageId,
  findEdgesByEventId,
  findEdgesByKind,
  buildProofChainAgeReport,
  verifyMessageBodyHash,
  CHAT_PROOF_CHAIN_MODULE_DESCRIPTOR,
  CHAT_PROOF_CHAIN_MODULE_LAWS,
} as const);

// ============================================================================
// MARK: Proof edge kind frequency counter
// ============================================================================

export class ProofEdgeKindCounter {
  private readonly counts = new Map<string, number>();

  record(kind: string): void {
    this.counts.set(kind, (this.counts.get(kind) ?? 0) + 1);
  }

  count(kind: string): number { return this.counts.get(kind) ?? 0; }
  total(): number { let s = 0; for (const n of this.counts.values()) s += n; return s; }

  mostFrequent(): string | null {
    let max = 0; let best: string | null = null;
    for (const [k, n] of this.counts) if (n > max) { max = n; best = k; }
    return best;
  }

  distribution(): Readonly<Record<string, number>> {
    const result: Record<string, number> = {};
    for (const [k, n] of this.counts) result[k] = n;
    return Object.freeze(result);
  }

  reset(): void { this.counts.clear(); }
}

// ============================================================================
// MARK: Proof chain summary exporter
// ============================================================================

export interface ProofChainSummaryExport {
  readonly roomId: ChatRoomId;
  readonly edgeCount: number;
  readonly coverage: ProofCoverageReport;
  readonly age: ProofChainAgeReport;
}

export function exportProofChainSummary(
  state: ChatState,
  roomId: ChatRoomId,
): ProofChainSummaryExport {
  return Object.freeze({
    roomId,
    edgeCount: selectRoomProofEdges(state, roomId).length,
    coverage: buildProofCoverageReport(state, roomId),
    age: buildProofChainAgeReport(state, roomId),
  });
}

export function createProofEdgeKindCounter(): ProofEdgeKindCounter {
  return new ProofEdgeKindCounter();
}

export const CHAT_PROOF_CHAIN_MODULE_VERSION_EXTENDED = '2026.03.14.2' as const;

export function countProofEdgesForRoom(state: ChatState, roomId: ChatRoomId): number {
  return selectRoomProofEdges(state, roomId).length;
}

export function isProofChainEmpty(state: ChatState, roomId: ChatRoomId): boolean {
  return selectRoomProofEdges(state, roomId).length === 0;
}

export function getProofHashForMessage(state: ChatState, roomId: ChatRoomId, messageId: ChatMessageId): ChatProofHash | null {
  const edges = selectRoomProofEdges(state, roomId);
  return edges.find((e) => e.toMessageId === messageId)?.hash ?? null;
}

export function countUncoveredMessages(state: ChatState, roomId: ChatRoomId): number {
  return buildProofCoverageReport(state, roomId).uncoveredMessages;
}

export const PROOF_CHAIN_INTEGRITY_THRESHOLD = 0.95 as const;

export const ChatProofChainModule = Object.freeze({
  name: CHAT_PROOF_CHAIN_MODULE_NAME,
  version: CHAT_PROOF_CHAIN_MODULE_VERSION,
  versionExtended: CHAT_PROOF_CHAIN_MODULE_VERSION_EXTENDED,
  laws: CHAT_PROOF_CHAIN_MODULE_LAWS,
  descriptor: CHAT_PROOF_CHAIN_MODULE_DESCRIPTOR,
  integrityThreshold: PROOF_CHAIN_INTEGRITY_THRESHOLD,
  DEFAULT_CLOCK,
  DEFAULT_IDS,
  DEFAULT_HASH,
  DEFAULT_LOGGER,
  DEFAULT_PORTS,
  fnv1a32,
  randomBase36,
  createChatProofChainContext,
  createEmptyProofChain,
  cloneProofChain,
  cloneProofEdge,
  createProofEdge,
  createMessageToMessageProofEdge,
  createEventToMessageProofEdge,
  createMessageToReplayProofEdge,
  createMessageToTelemetryProofEdge,
  createMessageToInferenceProofEdge,
  createModerationDecisionProofEdge,
  createProofEdgesForMessage,
  appendProofEdge,
  appendProofEdges,
  applyProofEdge,
  applyProofEdges,
  removeProofEdge,
  dedupeProofEdges,
  selectProofEdge,
  selectProofEdgesForRoom,
  selectProofEdgesFromMessage,
  selectProofEdgesToMessage,
  selectProofEdgesForMessage,
  selectProofEdgesFromEvent,
  selectProofEdgesToReplay,
  selectProofEdgesToTelemetry,
  selectProofEdgesToInference,
  selectModerationProofEdges,
  selectProofEdgesWithinTimeRange,
  verifyProofEdgeHash,
  verifyRoomProofChain,
  verifyStateProofIntegrity,
  createProofDigest,
  buildTranscriptRangeProof,
  buildRoomProofTimeline,
  buildMessageCausalClosure,
  createProofEdgesForReplayArtifacts,
  createProofEdgesForTelemetryBatch,
  createProofEdgesForInferenceBatch,
  findTranscriptMessagesWithoutProofCoverage,
  findReplayArtifactsWithoutProofCoverage,
  findInferenceSnapshotsWithoutProofCoverage,
  reconcileRoomProofCoverage,
  createCanonicalProofMaterial,
  createCanonicalTranscriptMaterial,
  summarizeProofChain,
  canonicalizeJson,
  ProofWatchBus,
  createProofWatchBus,
  ProofEdgeLedger,
  createProofEdgeLedger,
  ProofEdgeKindCounter,
  createProofEdgeKindCounter,
  computeProofEdgeFingerprint,
  buildProofChainIntegrityReport,
  diffProofChains,
  buildReplayProofLink,
  buildInferenceProofLink,
  buildTelemetryProofLink,
  buildProofChainSnapshot,
  buildProofCoverageReport,
  findEdgeByMessageId,
  findEdgesByEventId,
  findEdgesByKind,
  buildProofChainAgeReport,
  verifyMessageBodyHash,
  exportProofChainSummary,
  countProofEdgesForRoom,
  isProofChainEmpty,
  getProofHashForMessage,
  countUncoveredMessages,
} as const);
