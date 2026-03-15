/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT DL SEQUENCE MEMORY CLIENT
 * FILE: backend/src/game/engine/chat/dl/SequenceMemoryClient.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Backend-authoritative façade for sequence-memory operations inside the chat DL
 * lane. This file is intentionally not a thin wrapper. It is the durable bridge
 * between accepted chat truth and memory-aware downstream intelligence.
 *
 * Responsibilities
 * ----------------
 * 1. Consume authoritative transcript windows, replay anchors, and accepted
 *    inference metadata from the backend chat lane.
 * 2. Normalize those inputs into durable sequence-memory transactions.
 * 3. Coordinate compression, salience promotion, conflict-safe merges,
 *    retrieval-window shaping, and replay-safe continuity snapshots.
 * 4. Expose deterministic read/write operations to ranking, helper, hater,
 *    channel-affinity, and intervention systems without letting those systems
 *    mutate transcript truth directly.
 * 5. Preserve mode/channel semantics from the live repo split:
 *    - frontend render and optimistic mirrors stay in pzo-web
 *    - backend chat remains truth owner
 *    - pzo-server remains transport
 *    - shared/contracts remains cross-lane contract authority
 *
 * Design Rules
 * ------------
 * - No socket ownership.
 * - No transcript-authority ownership.
 * - No moderation bypass.
 * - No battle-logic ownership.
 * - All writes are append-or-version, never destructive by default.
 * - Retrieval must remain explainable enough for replay/debug surfaces.
 *
 * Note
 * ----
 * The user explicitly requested this file name in the backend DL lane even
 * though the earlier architecture draft placed SequenceMemoryClient on the
 * frontend donor side. In this implementation, the backend file is treated as a
 * service façade / coordination client over backend-native memory components.
 * That preserves the naming request while keeping authority in the backend.
 * ============================================================================
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ChatDlChannelId =
  | 'GLOBAL'
  | 'SYNDICATE'
  | 'DEAL_ROOM'
  | 'LOBBY'
  | 'SYSTEM_SHADOW'
  | 'NPC_SHADOW'
  | 'RIVALRY_SHADOW'
  | 'RESCUE_SHADOW'
  | 'LIVEOPS_SHADOW'
  | string;

export type ChatDlModeId =
  | 'LOBBY'
  | 'BATTLE'
  | 'EMPIRE'
  | 'LEAGUE'
  | 'CLUB'
  | 'PREDATOR'
  | 'PHANTOM'
  | 'SYNDICATE'
  | 'GAMEBOARD'
  | string;

export type SequenceMemoryActorType =
  | 'PLAYER'
  | 'HELPER'
  | 'HATER'
  | 'NPC_AMBIENT'
  | 'SYSTEM'
  | 'LIVEOPS'
  | 'MODERATION'
  | 'UNKNOWN';

export type SequenceMemoryAnchorKind =
  | 'TURN'
  | 'SCENE'
  | 'MOMENT'
  | 'CALLBACK'
  | 'QUOTE'
  | 'LEGEND'
  | 'RESCUE'
  | 'RIVALRY'
  | 'NEGOTIATION'
  | 'POST_RUN'
  | 'STATE_SHIFT'
  | 'INFERENCE';

export type SequenceMemoryCompressionTier =
  | 'RAW'
  | 'TURN_SUMMARY'
  | 'SCENE_SUMMARY'
  | 'MOMENT_SUMMARY'
  | 'ARC_SUMMARY';

export type SequenceMemoryRetentionClass =
  | 'EPHEMERAL'
  | 'SHORT'
  | 'MEDIUM'
  | 'LONG'
  | 'PINNED'
  | 'REPLAY_PINNED';

export type SequenceMemoryVisibility =
  | 'VISIBLE'
  | 'SHADOW'
  | 'INTERNAL_ONLY'
  | 'REPLAY_ONLY';

export type SequenceMemoryTrigger =
  | 'MESSAGE_ACCEPTED'
  | 'NPC_INTERVENTION'
  | 'HATER_ESCALATION'
  | 'HELPER_INTERVENTION'
  | 'INFERENCE_SNAPSHOT'
  | 'CHANNEL_SWITCH'
  | 'MODE_TRANSITION'
  | 'REPLAY_WRITE'
  | 'RUN_END'
  | 'LEGEND_EVENT'
  | 'RESCUE_EVENT'
  | 'MANUAL_IMPORT'
  | string;

export interface SequenceMemoryVector {
  readonly dimensions: number;
  readonly values: number[];
  readonly modelId: string;
  readonly checksum?: string;
}

export interface SequenceMemoryEmotionProfile {
  intimidation: number;
  confidence: number;
  frustration: number;
  curiosity: number;
  attachment: number;
  embarrassment: number;
  relief: number;
  dominance: number;
  desperation: number;
  trust: number;
}

export interface SequenceMemoryRelationshipProfile {
  respect: number;
  fear: number;
  contempt: number;
  fascination: number;
  trust: number;
  familiarity: number;
  rivalryIntensity: number;
  rescueDebt: number;
}

export interface SequenceMemorySourceMessage {
  readonly messageId: string;
  readonly roomId: string;
  readonly channelId: ChatDlChannelId;
  readonly modeId: ChatDlModeId;
  readonly authorId: string;
  readonly actorType: SequenceMemoryActorType;
  readonly body: string;
  readonly createdAtMs: number;
  readonly acceptedAtMs: number;
  readonly sequence: number;
  readonly eventId?: string;
  readonly causalParentIds?: readonly string[];
  readonly moderationMaskLevel?: number;
  readonly proofHash?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface SequenceMemorySceneWindow {
  readonly roomId: string;
  readonly channelId: ChatDlChannelId;
  readonly modeId: ChatDlModeId;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly messages: readonly SequenceMemorySourceMessage[];
  readonly trigger: SequenceMemoryTrigger;
  readonly runId?: string;
  readonly battleId?: string;
  readonly economyContextId?: string;
  readonly sceneIdHint?: string;
}

export interface SequenceMemoryAnchor {
  readonly anchorId: string;
  readonly roomId: string;
  readonly channelId: ChatDlChannelId;
  readonly modeId: ChatDlModeId;
  readonly actorIds: readonly string[];
  readonly actorTypes: readonly SequenceMemoryActorType[];
  readonly kind: SequenceMemoryAnchorKind;
  readonly retentionClass: SequenceMemoryRetentionClass;
  readonly compressionTier: SequenceMemoryCompressionTier;
  readonly visibility: SequenceMemoryVisibility;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  readonly firstMessageSequence?: number;
  readonly lastMessageSequence?: number;
  readonly firstMessageId?: string;
  readonly lastMessageId?: string;
  readonly text: string;
  readonly normalizedText: string;
  readonly vector?: SequenceMemoryVector;
  readonly salience: number;
  readonly replayWeight: number;
  readonly retrievalWeight: number;
  readonly continuityWeight: number;
  readonly callbackWeight: number;
  readonly pressureWeight: number;
  readonly emotion?: SequenceMemoryEmotionProfile;
  readonly relationship?: SequenceMemoryRelationshipProfile;
  readonly tags: readonly string[];
  readonly proofHashes: readonly string[];
  readonly sourceMessageIds: readonly string[];
  readonly sourceEventIds: readonly string[];
  readonly shadowOnly: boolean;
  readonly pinnedReason?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface SequenceMemoryArcSummary {
  readonly arcId: string;
  readonly roomId: string;
  readonly channelId: ChatDlChannelId;
  readonly modeId: ChatDlModeId;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly anchorIds: readonly string[];
  readonly principalActorIds: readonly string[];
  readonly label: string;
  readonly synopsis: string;
  readonly confidence: number;
  readonly emotionalCenter: keyof SequenceMemoryEmotionProfile | 'mixed';
  readonly tensionDelta: number;
  readonly recoveryDelta: number;
  readonly rivalryDelta: number;
  readonly helperTrustDelta: number;
  readonly retrievalPriority: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface SequenceMemoryReadQuery {
  readonly roomId?: string;
  readonly channelId?: ChatDlChannelId;
  readonly modeId?: ChatDlModeId;
  readonly actorId?: string;
  readonly actorIds?: readonly string[];
  readonly kinds?: readonly SequenceMemoryAnchorKind[];
  readonly minSalience?: number;
  readonly minRetrievalWeight?: number;
  readonly afterMs?: number;
  readonly beforeMs?: number;
  readonly textQuery?: string;
  readonly tagsAny?: readonly string[];
  readonly tagsAll?: readonly string[];
  readonly visibility?: SequenceMemoryVisibility;
  readonly retentionClasses?: readonly SequenceMemoryRetentionClass[];
  readonly limit?: number;
  readonly includeShadow?: boolean;
  readonly includeVectors?: boolean;
  readonly sortBy?: 'createdAtMs' | 'updatedAtMs' | 'salience' | 'retrievalWeight' | 'continuityWeight';
  readonly sortDirection?: 'asc' | 'desc';
}

export interface SequenceMemoryRetrievalQuery {
  readonly roomId: string;
  readonly channelId: ChatDlChannelId;
  readonly modeId: ChatDlModeId;
  readonly viewerActorId?: string;
  readonly targetActorIds?: readonly string[];
  readonly trigger: SequenceMemoryTrigger;
  readonly limit: number;
  readonly includeShadow: boolean;
  readonly queryText?: string;
  readonly queryVector?: SequenceMemoryVector;
  readonly currentEmotion?: Partial<SequenceMemoryEmotionProfile>;
  readonly desiredKinds?: readonly SequenceMemoryAnchorKind[];
  readonly excludeAnchorIds?: readonly string[];
  readonly replayBias?: number;
  readonly continuityBias?: number;
  readonly callbackBias?: number;
  readonly recencyBias?: number;
  readonly pressureBias?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface SequenceMemoryRetrievalHit {
  readonly anchor: SequenceMemoryAnchor;
  readonly combinedScore: number;
  readonly lexicalScore: number;
  readonly vectorScore: number;
  readonly recencyScore: number;
  readonly salienceScore: number;
  readonly continuityScore: number;
  readonly callbackScore: number;
  readonly pressureScore: number;
  readonly emotionalFitScore: number;
  readonly explanation: readonly string[];
}

export interface SequenceMemoryCompressionRequest {
  readonly roomId: string;
  readonly channelId?: ChatDlChannelId;
  readonly modeId?: ChatDlModeId;
  readonly olderThanMs: number;
  readonly retainRawRecentCount: number;
  readonly maxAnchorsToProcess: number;
  readonly targetTier: SequenceMemoryCompressionTier;
  readonly preserveKinds?: readonly SequenceMemoryAnchorKind[];
}

export interface SequenceMemorySnapshot {
  readonly roomId: string;
  readonly channelId: ChatDlChannelId;
  readonly modeId: ChatDlModeId;
  readonly createdAtMs: number;
  readonly anchorCount: number;
  readonly arcCount: number;
  readonly rawAnchorCount: number;
  readonly pinnedAnchorCount: number;
  readonly shadowAnchorCount: number;
  readonly recentAnchorIds: readonly string[];
  readonly topRetrievalAnchorIds: readonly string[];
  readonly topContinuityAnchorIds: readonly string[];
  readonly activeArcIds: readonly string[];
}

export interface SequenceMemoryStats {
  totalAnchors: number;
  totalArcs: number;
  totalWrites: number;
  totalReads: number;
  totalRetrievals: number;
  totalCompressions: number;
  totalPrunes: number;
  shadowAnchors: number;
  replayPinnedAnchors: number;
  averageWriteLatencyMs: number;
  averageRetrievalLatencyMs: number;
  averageCompressionLatencyMs: number;
  lastUpdatedAtMs: number;
}

export interface SequenceMemoryClientConfig {
  readonly maxAnchorsPerRoom: number;
  readonly maxShadowAnchorsPerRoom: number;
  readonly maxAnchorsReturnedPerRead: number;
  readonly maxAnchorsReturnedPerRetrieval: number;
  readonly defaultCompressionTier: SequenceMemoryCompressionTier;
  readonly defaultRetentionClass: SequenceMemoryRetentionClass;
  readonly lexicalCaseSensitive: boolean;
  readonly enableVectorScoring: boolean;
  readonly enableArcSynthesis: boolean;
  readonly enableShadowReads: boolean;
  readonly enableReplayBias: boolean;
  readonly enableContinuityBias: boolean;
  readonly enableEmotionalFit: boolean;
  readonly lexicalWeight: number;
  readonly vectorWeight: number;
  readonly recencyWeight: number;
  readonly salienceWeight: number;
  readonly continuityWeight: number;
  readonly callbackWeight: number;
  readonly pressureWeight: number;
  readonly emotionalFitWeight: number;
  readonly pruneLowSalienceThreshold: number;
  readonly staleAnchorMs: number;
  readonly arcMergeGapMs: number;
  readonly defaultReadLimit: number;
  readonly defaultRetrievalLimit: number;
}

export interface SequenceMemoryClientDependencies {
  readonly now?: () => number;
  readonly idFactory?: (prefix: string) => string;
  readonly logger?: SequenceMemoryLogger;
}

export interface SequenceMemoryLogger {
  debug(message: string, payload?: unknown): void;
  info(message: string, payload?: unknown): void;
  warn(message: string, payload?: unknown): void;
  error(message: string, payload?: unknown): void;
}

interface SequenceMemoryRoomState {
  anchorsById: Map<string, SequenceMemoryAnchor>;
  arcsById: Map<string, SequenceMemoryArcSummary>;
  anchorOrder: string[];
  actorAnchorIndex: Map<string, Set<string>>;
  tagAnchorIndex: Map<string, Set<string>>;
  kindAnchorIndex: Map<SequenceMemoryAnchorKind, Set<string>>;
  proofHashIndex: Map<string, Set<string>>;
  shadowAnchorIds: Set<string>;
  replayPinnedAnchorIds: Set<string>;
  lastSequence?: number;
  lastUpdatedAtMs: number;
}

const DEFAULT_CONFIG: SequenceMemoryClientConfig = {
  maxAnchorsPerRoom: 15000,
  maxShadowAnchorsPerRoom: 6000,
  maxAnchorsReturnedPerRead: 100,
  maxAnchorsReturnedPerRetrieval: 24,
  defaultCompressionTier: 'TURN_SUMMARY',
  defaultRetentionClass: 'MEDIUM',
  lexicalCaseSensitive: false,
  enableVectorScoring: true,
  enableArcSynthesis: true,
  enableShadowReads: false,
  enableReplayBias: true,
  enableContinuityBias: true,
  enableEmotionalFit: true,
  lexicalWeight: 0.22,
  vectorWeight: 0.18,
  recencyWeight: 0.12,
  salienceWeight: 0.16,
  continuityWeight: 0.12,
  callbackWeight: 0.08,
  pressureWeight: 0.06,
  emotionalFitWeight: 0.06,
  pruneLowSalienceThreshold: 0.18,
  staleAnchorMs: 1000 * 60 * 60 * 24 * 21,
  arcMergeGapMs: 1000 * 60 * 8,
  defaultReadLimit: 25,
  defaultRetrievalLimit: 8,
};

const NULL_LOGGER: SequenceMemoryLogger = {
  debug() {
    /* noop */
  },
  info() {
    /* noop */
  },
  warn() {
    /* noop */
  },
  error() {
    /* noop */
  },
};

const DEFAULT_EMOTION: SequenceMemoryEmotionProfile = {
  intimidation: 0,
  confidence: 0,
  frustration: 0,
  curiosity: 0,
  attachment: 0,
  embarrassment: 0,
  relief: 0,
  dominance: 0,
  desperation: 0,
  trust: 0,
};

const DEFAULT_RELATIONSHIP: SequenceMemoryRelationshipProfile = {
  respect: 0,
  fear: 0,
  contempt: 0,
  fascination: 0,
  trust: 0,
  familiarity: 0,
  rivalryIntensity: 0,
  rescueDebt: 0,
};

function clamp01(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function normalizeForSearch(text: string, caseSensitive: boolean): string {
  const normalized = normalizeWhitespace(text);
  return caseSensitive ? normalized : normalized.toLowerCase();
}

function overlapScore(queryTokens: readonly string[], candidateTokens: readonly string[]): number {
  if (queryTokens.length === 0 || candidateTokens.length === 0) return 0;
  const candidateSet = new Set(candidateTokens);
  let hits = 0;
  for (const token of queryTokens) {
    if (candidateSet.has(token)) hits += 1;
  }
  return hits / Math.max(queryTokens.length, candidateTokens.length);
}

function tokenize(text: string, caseSensitive: boolean): string[] {
  const prepared = normalizeForSearch(text, caseSensitive);
  return prepared
    .split(/[^a-zA-Z0-9_@#:$'-]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function cosineSimilarity(a?: SequenceMemoryVector, b?: SequenceMemoryVector): number {
  if (!a || !b) return 0;
  if (a.dimensions !== b.dimensions) return 0;
  if (a.values.length !== b.values.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.values.length; i += 1) {
    const av = a.values[i] ?? 0;
    const bv = b.values[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (normA <= 0 || normB <= 0) return 0;
  return clamp01((dot / (Math.sqrt(normA) * Math.sqrt(normB)) + 1) / 2);
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function mergeUnique<T>(...groups: ReadonlyArray<readonly T[]>): T[] {
  const seen = new Set<T>();
  const result: T[] = [];
  for (const group of groups) {
    for (const item of group) {
      if (seen.has(item)) continue;
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}

function emotionalFit(
  current: Partial<SequenceMemoryEmotionProfile> | undefined,
  anchorEmotion: SequenceMemoryEmotionProfile | undefined,
): number {
  if (!current || !anchorEmotion) return 0;
  const keys = Object.keys(DEFAULT_EMOTION) as Array<keyof SequenceMemoryEmotionProfile>;
  const distances: number[] = [];
  for (const key of keys) {
    const currentValue = current[key];
    if (typeof currentValue !== 'number') continue;
    distances.push(1 - Math.abs(clamp01(currentValue) - clamp01(anchorEmotion[key])));
  }
  return distances.length ? average(distances) : 0;
}

function recencyScore(nowMs: number, updatedAtMs: number, staleMs: number): number {
  const age = Math.max(0, nowMs - updatedAtMs);
  if (age === 0) return 1;
  if (age >= staleMs) return 0;
  return clamp01(1 - age / staleMs);
}

function compareNumber(a: number, b: number, direction: 'asc' | 'desc'): number {
  return direction === 'asc' ? a - b : b - a;
}

function inferRetentionFromKind(kind: SequenceMemoryAnchorKind): SequenceMemoryRetentionClass {
  switch (kind) {
    case 'LEGEND':
    case 'QUOTE':
      return 'PINNED';
    case 'RESCUE':
    case 'RIVALRY':
    case 'CALLBACK':
      return 'LONG';
    case 'SCENE':
    case 'MOMENT':
    case 'NEGOTIATION':
      return 'MEDIUM';
    case 'INFERENCE':
      return 'SHORT';
    default:
      return 'MEDIUM';
  }
}

function inferVisibility(trigger: SequenceMemoryTrigger, channelId: ChatDlChannelId): SequenceMemoryVisibility {
  if (channelId.includes('SHADOW')) return 'SHADOW';
  if (trigger === 'REPLAY_WRITE') return 'REPLAY_ONLY';
  return 'VISIBLE';
}

function inferKindFromTrigger(trigger: SequenceMemoryTrigger): SequenceMemoryAnchorKind {
  switch (trigger) {
    case 'HELPER_INTERVENTION':
      return 'RESCUE';
    case 'HATER_ESCALATION':
      return 'RIVALRY';
    case 'LEGEND_EVENT':
      return 'LEGEND';
    case 'RUN_END':
      return 'POST_RUN';
    case 'CHANNEL_SWITCH':
    case 'MODE_TRANSITION':
      return 'STATE_SHIFT';
    case 'INFERENCE_SNAPSHOT':
      return 'INFERENCE';
    default:
      return 'SCENE';
  }
}

export class SequenceMemoryClient {
  private readonly config: SequenceMemoryClientConfig;
  private readonly logger: SequenceMemoryLogger;
  private readonly now: () => number;
  private readonly idFactory: (prefix: string) => string;
  private readonly rooms: Map<string, SequenceMemoryRoomState> = new Map();
  private readonly stats: SequenceMemoryStats = {
    totalAnchors: 0,
    totalArcs: 0,
    totalWrites: 0,
    totalReads: 0,
    totalRetrievals: 0,
    totalCompressions: 0,
    totalPrunes: 0,
    shadowAnchors: 0,
    replayPinnedAnchors: 0,
    averageWriteLatencyMs: 0,
    averageRetrievalLatencyMs: 0,
    averageCompressionLatencyMs: 0,
    lastUpdatedAtMs: 0,
  };

  public constructor(
    config: Partial<SequenceMemoryClientConfig> = {},
    dependencies: SequenceMemoryClientDependencies = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = dependencies.logger ?? NULL_LOGGER;
    this.now = dependencies.now ?? (() => Date.now());
    this.idFactory =
      dependencies.idFactory ??
      ((prefix: string) => `${prefix}_${this.now()}_${Math.random().toString(36).slice(2, 10)}`);
  }

  public getConfig(): Readonly<SequenceMemoryClientConfig> {
    return { ...this.config };
  }

  public upsertSceneWindow(window: SequenceMemorySceneWindow, vector?: SequenceMemoryVector): SequenceMemoryAnchor {
    const startedAt = this.now();
    const room = this.ensureRoom(window.roomId);
    const anchor = this.buildAnchorFromScene(window, vector);
    const existing = room.anchorsById.get(anchor.anchorId);

    this.writeAnchor(room, anchor, existing);
    if (this.config.enableArcSynthesis) {
      this.mergeAnchorIntoArc(room, anchor);
    }
    this.enforceRoomCapacity(window.roomId, room);
    this.recordLatency('write', this.now() - startedAt);

    return anchor;
  }

  public appendMessageAsTurnAnchor(
    message: SequenceMemorySourceMessage,
    vector?: SequenceMemoryVector,
    emotion?: Partial<SequenceMemoryEmotionProfile>,
    relationship?: Partial<SequenceMemoryRelationshipProfile>,
  ): SequenceMemoryAnchor {
    return this.upsertSceneWindow(
      {
        roomId: message.roomId,
        channelId: message.channelId,
        modeId: message.modeId,
        startedAtMs: message.acceptedAtMs,
        endedAtMs: message.acceptedAtMs,
        messages: [message],
        trigger: 'MESSAGE_ACCEPTED',
        sceneIdHint: `turn_${message.messageId}`,
      },
      vector,
    );
  }

  public upsertInferenceAnchor(input: {
    roomId: string;
    channelId: ChatDlChannelId;
    modeId: ChatDlModeId;
    actorIds: readonly string[];
    text: string;
    vector?: SequenceMemoryVector;
    metadata?: Readonly<Record<string, unknown>>;
    salience?: number;
    retrievalWeight?: number;
    continuityWeight?: number;
    callbackWeight?: number;
    pressureWeight?: number;
    emotion?: Partial<SequenceMemoryEmotionProfile>;
    relationship?: Partial<SequenceMemoryRelationshipProfile>;
    visibility?: SequenceMemoryVisibility;
    retentionClass?: SequenceMemoryRetentionClass;
    kind?: SequenceMemoryAnchorKind;
  }): SequenceMemoryAnchor {
    const room = this.ensureRoom(input.roomId);
    const nowMs = this.now();
    const anchor: SequenceMemoryAnchor = {
      anchorId: this.idFactory('seqmem_inf'),
      roomId: input.roomId,
      channelId: input.channelId,
      modeId: input.modeId,
      actorIds: mergeUnique(input.actorIds),
      actorTypes: input.actorIds.map(() => 'SYSTEM'),
      kind: input.kind ?? 'INFERENCE',
      retentionClass: input.retentionClass ?? 'SHORT',
      compressionTier: 'TURN_SUMMARY',
      visibility: input.visibility ?? 'INTERNAL_ONLY',
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
      text: input.text,
      normalizedText: normalizeForSearch(input.text, this.config.lexicalCaseSensitive),
      vector: input.vector,
      salience: clamp01(input.salience ?? 0.4),
      replayWeight: 0,
      retrievalWeight: clamp01(input.retrievalWeight ?? 0.45),
      continuityWeight: clamp01(input.continuityWeight ?? 0.35),
      callbackWeight: clamp01(input.callbackWeight ?? 0.2),
      pressureWeight: clamp01(input.pressureWeight ?? 0.2),
      emotion: { ...DEFAULT_EMOTION, ...(input.emotion ?? {}) },
      relationship: { ...DEFAULT_RELATIONSHIP, ...(input.relationship ?? {}) },
      tags: ['inference'],
      proofHashes: [],
      sourceMessageIds: [],
      sourceEventIds: [],
      shadowOnly: input.visibility === 'SHADOW',
      metadata: input.metadata,
    };

    this.writeAnchor(room, anchor, undefined);
    return anchor;
  }

  public readAnchors(query: SequenceMemoryReadQuery): SequenceMemoryAnchor[] {
    const startedAt = this.now();
    const candidates = this.collectAnchorsForRead(query);
    const filtered = this.filterAnchorsForRead(candidates, query);
    const sorted = this.sortAnchors(filtered, query.sortBy ?? 'updatedAtMs', query.sortDirection ?? 'desc');
    const limit = Math.min(
      query.limit ?? this.config.defaultReadLimit,
      this.config.maxAnchorsReturnedPerRead,
    );

    this.stats.totalReads += 1;
    this.recordLatency('read', this.now() - startedAt);
    return sorted.slice(0, limit);
  }

  public retrieveRelevantAnchors(query: SequenceMemoryRetrievalQuery): SequenceMemoryRetrievalHit[] {
    const startedAt = this.now();
    const room = this.rooms.get(query.roomId);
    if (!room) {
      this.stats.totalRetrievals += 1;
      this.recordLatency('retrieval', this.now() - startedAt);
      return [];
    }

    const limit = Math.min(query.limit, this.config.maxAnchorsReturnedPerRetrieval);
    const excludeSet = new Set(query.excludeAnchorIds ?? []);
    const queryTokens = tokenize(query.queryText ?? '', this.config.lexicalCaseSensitive);
    const hits: SequenceMemoryRetrievalHit[] = [];
    const nowMs = this.now();

    for (const anchorId of room.anchorOrder) {
      if (excludeSet.has(anchorId)) continue;
      const anchor = room.anchorsById.get(anchorId);
      if (!anchor) continue;
      if (!query.includeShadow && anchor.shadowOnly && !this.config.enableShadowReads) continue;
      if (query.desiredKinds?.length && !query.desiredKinds.includes(anchor.kind)) continue;
      if (query.targetActorIds?.length) {
        const overlap = anchor.actorIds.some((actorId) => query.targetActorIds?.includes(actorId));
        if (!overlap) continue;
      }

      const lexicalScore = queryTokens.length
        ? overlapScore(queryTokens, tokenize(anchor.normalizedText, this.config.lexicalCaseSensitive))
        : 0;
      const vectorScore = this.config.enableVectorScoring
        ? cosineSimilarity(query.queryVector, anchor.vector)
        : 0;
      const recency = recencyScore(nowMs, anchor.updatedAtMs, this.config.staleAnchorMs);
      const emotionalFitScore = this.config.enableEmotionalFit
        ? emotionalFit(query.currentEmotion, anchor.emotion)
        : 0;

      const replayBias = this.config.enableReplayBias ? clamp01(query.replayBias ?? 0.5) : 0;
      const continuityBias = this.config.enableContinuityBias ? clamp01(query.continuityBias ?? 0.5) : 0;
      const callbackBias = clamp01(query.callbackBias ?? 0.5);
      const pressureBias = clamp01(query.pressureBias ?? 0.5);
      const recencyBias = clamp01(query.recencyBias ?? 0.5);

      const salienceScore = anchor.salience;
      const continuityScore = anchor.continuityWeight * continuityBias;
      const callbackScore = anchor.callbackWeight * callbackBias;
      const pressureScore = anchor.pressureWeight * pressureBias;

      const combinedScore = clamp01(
        lexicalScore * this.config.lexicalWeight +
          vectorScore * this.config.vectorWeight +
          recency * this.config.recencyWeight * recencyBias +
          salienceScore * this.config.salienceWeight +
          continuityScore * this.config.continuityWeight +
          callbackScore * this.config.callbackWeight +
          pressureScore * this.config.pressureWeight +
          emotionalFitScore * this.config.emotionalFitWeight +
          anchor.replayWeight * 0.1 * replayBias,
      );

      if (combinedScore <= 0) continue;

      const explanation: string[] = [];
      if (lexicalScore > 0.15) explanation.push('lexical overlap');
      if (vectorScore > 0.15) explanation.push('vector proximity');
      if (salienceScore > 0.5) explanation.push('high salience');
      if (continuityScore > 0.15) explanation.push('continuity fit');
      if (callbackScore > 0.15) explanation.push('callback potential');
      if (pressureScore > 0.15) explanation.push('pressure alignment');
      if (emotionalFitScore > 0.15) explanation.push('emotional fit');
      if (anchor.replayWeight > 0.6) explanation.push('replay significance');

      hits.push({
        anchor,
        combinedScore,
        lexicalScore,
        vectorScore,
        recencyScore: recency,
        salienceScore,
        continuityScore,
        callbackScore,
        pressureScore,
        emotionalFitScore,
        explanation,
      });
    }

    hits.sort((a, b) => b.combinedScore - a.combinedScore || b.anchor.updatedAtMs - a.anchor.updatedAtMs);

    this.stats.totalRetrievals += 1;
    this.recordLatency('retrieval', this.now() - startedAt);
    return hits.slice(0, limit);
  }

  public compressAnchors(request: SequenceMemoryCompressionRequest): SequenceMemoryAnchor[] {
    const startedAt = this.now();
    const room = this.rooms.get(request.roomId);
    if (!room) return [];

    const created: SequenceMemoryAnchor[] = [];
    const threshold = request.olderThanMs;
    const preserveKinds = new Set(request.preserveKinds ?? []);
    const eligible = room.anchorOrder
      .map((anchorId) => room.anchorsById.get(anchorId))
      .filter((anchor): anchor is SequenceMemoryAnchor => Boolean(anchor))
      .filter((anchor) => anchor.updatedAtMs < threshold)
      .filter((anchor) => anchor.compressionTier === 'RAW' || anchor.compressionTier === 'TURN_SUMMARY')
      .filter((anchor) => !preserveKinds.has(anchor.kind))
      .slice(0, request.maxAnchorsToProcess);

    const groups = new Map<string, SequenceMemoryAnchor[]>();
    for (const anchor of eligible) {
      const key = `${anchor.channelId}::${anchor.modeId}::${Math.floor(anchor.updatedAtMs / this.config.arcMergeGapMs)}`;
      const list = groups.get(key) ?? [];
      list.push(anchor);
      groups.set(key, list);
    }

    for (const anchors of groups.values()) {
      if (anchors.length < 2) continue;
      const createdAnchor = this.buildCompressedAnchor(request.roomId, anchors, request.targetTier);
      this.writeAnchor(room, createdAnchor, undefined);
      created.push(createdAnchor);
    }

    this.stats.totalCompressions += 1;
    this.recordLatency('compression', this.now() - startedAt);
    return created;
  }

  public pruneRoom(roomId: string): string[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    const removed: string[] = [];
    const nowMs = this.now();

    for (const anchorId of [...room.anchorOrder]) {
      const anchor = room.anchorsById.get(anchorId);
      if (!anchor) continue;
      const old = nowMs - anchor.updatedAtMs > this.config.staleAnchorMs;
      const lowSalience = anchor.salience < this.config.pruneLowSalienceThreshold;
      const protectedAnchor =
        anchor.retentionClass === 'PINNED' ||
        anchor.retentionClass === 'REPLAY_PINNED' ||
        room.replayPinnedAnchorIds.has(anchorId);
      if (protectedAnchor) continue;
      if (!old && !lowSalience) continue;
      removed.push(anchorId);
      this.removeAnchor(room, anchorId);
    }

    this.stats.totalPrunes += removed.length;
    this.recalculateStats();
    return removed;
  }

  public getRoomSnapshot(roomId: string, channelId: ChatDlChannelId, modeId: ChatDlModeId): SequenceMemorySnapshot {
    const room = this.ensureRoom(roomId);
    const anchors = room.anchorOrder
      .map((id) => room.anchorsById.get(id))
      .filter((anchor): anchor is SequenceMemoryAnchor => Boolean(anchor))
      .filter((anchor) => anchor.channelId === channelId && anchor.modeId === modeId);

    const topRetrieval = [...anchors]
      .sort((a, b) => b.retrievalWeight - a.retrievalWeight)
      .slice(0, 10)
      .map((anchor) => anchor.anchorId);
    const topContinuity = [...anchors]
      .sort((a, b) => b.continuityWeight - a.continuityWeight)
      .slice(0, 10)
      .map((anchor) => anchor.anchorId);

    return {
      roomId,
      channelId,
      modeId,
      createdAtMs: this.now(),
      anchorCount: anchors.length,
      arcCount: room.arcsById.size,
      rawAnchorCount: anchors.filter((anchor) => anchor.compressionTier === 'RAW').length,
      pinnedAnchorCount: anchors.filter((anchor) => anchor.retentionClass === 'PINNED').length,
      shadowAnchorCount: anchors.filter((anchor) => anchor.shadowOnly).length,
      recentAnchorIds: anchors.slice(-10).map((anchor) => anchor.anchorId),
      topRetrievalAnchorIds: topRetrieval,
      topContinuityAnchorIds: topContinuity,
      activeArcIds: [...room.arcsById.keys()].slice(-10),
    };
  }

  public getStats(): Readonly<SequenceMemoryStats> {
    return { ...this.stats };
  }

  public resetRoom(roomId: string): void {
    this.rooms.delete(roomId);
    this.recalculateStats();
  }

  public resetAll(): void {
    this.rooms.clear();
    this.recalculateStats();
  }

  private ensureRoom(roomId: string): SequenceMemoryRoomState {
    const existing = this.rooms.get(roomId);
    if (existing) return existing;

    const created: SequenceMemoryRoomState = {
      anchorsById: new Map(),
      arcsById: new Map(),
      anchorOrder: [],
      actorAnchorIndex: new Map(),
      tagAnchorIndex: new Map(),
      kindAnchorIndex: new Map(),
      proofHashIndex: new Map(),
      shadowAnchorIds: new Set(),
      replayPinnedAnchorIds: new Set(),
      lastUpdatedAtMs: this.now(),
    };
    this.rooms.set(roomId, created);
    return created;
  }

  private buildAnchorFromScene(window: SequenceMemorySceneWindow, vector?: SequenceMemoryVector): SequenceMemoryAnchor {
    const nowMs = this.now();
    const allText = window.messages.map((message) => message.body).join(' ');
    const normalizedText = normalizeForSearch(allText, this.config.lexicalCaseSensitive);
    const sourceMessageIds = window.messages.map((message) => message.messageId);
    const sourceEventIds = window.messages.flatMap((message) => (message.eventId ? [message.eventId] : []));
    const proofHashes = window.messages.flatMap((message) => (message.proofHash ? [message.proofHash] : []));
    const actorIds = mergeUnique(window.messages.map((message) => message.authorId));
    const actorTypes = window.messages.map((message) => message.actorType);
    const firstSequence = window.messages[0]?.sequence;
    const lastSequence = window.messages[window.messages.length - 1]?.sequence;
    const inferredKind = window.messages.length === 1 ? 'TURN' : inferKindFromTrigger(window.trigger);
    const inferredVisibility = inferVisibility(window.trigger, window.channelId);

    const emotion = this.inferEmotion(window.messages);
    const relationship = this.inferRelationship(window.messages);
    const salience = this.inferSceneSalience(window.messages, window.trigger, emotion, relationship);
    const replayWeight = this.inferReplayWeight(window.messages, window.trigger);
    const retrievalWeight = this.inferRetrievalWeight(window.messages, window.trigger, salience);
    const continuityWeight = this.inferContinuityWeight(window.messages, window.trigger, relationship);
    const callbackWeight = this.inferCallbackWeight(window.messages, relationship);
    const pressureWeight = this.inferPressureWeight(window.messages, emotion);

    const hintBase = window.sceneIdHint ?? `${window.roomId}_${window.channelId}_${window.startedAtMs}_${window.endedAtMs}_${firstSequence ?? 'na'}_${lastSequence ?? 'na'}`;

    return {
      anchorId: this.idFactory(`seqmem_${hintBase}`),
      roomId: window.roomId,
      channelId: window.channelId,
      modeId: window.modeId,
      actorIds,
      actorTypes,
      kind: inferredKind,
      retentionClass: inferRetentionFromKind(inferredKind),
      compressionTier: window.messages.length <= 1 ? 'RAW' : 'TURN_SUMMARY',
      visibility: inferredVisibility,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
      firstMessageSequence: firstSequence,
      lastMessageSequence: lastSequence,
      firstMessageId: window.messages[0]?.messageId,
      lastMessageId: window.messages[window.messages.length - 1]?.messageId,
      text: normalizeWhitespace(allText),
      normalizedText,
      vector,
      salience,
      replayWeight,
      retrievalWeight,
      continuityWeight,
      callbackWeight,
      pressureWeight,
      emotion,
      relationship,
      tags: mergeUnique(
        window.messages.flatMap((message) => message.tags ?? []),
        [window.trigger, inferredKind, window.channelId, window.modeId],
      ),
      proofHashes,
      sourceMessageIds,
      sourceEventIds,
      shadowOnly: inferredVisibility === 'SHADOW',
      metadata: {
        trigger: window.trigger,
        runId: window.runId,
        battleId: window.battleId,
        economyContextId: window.economyContextId,
        sceneIdHint: window.sceneIdHint,
      },
    };
  }

  private buildCompressedAnchor(
    roomId: string,
    anchors: readonly SequenceMemoryAnchor[],
    targetTier: SequenceMemoryCompressionTier,
  ): SequenceMemoryAnchor {
    const nowMs = this.now();
    const roomAnchor = anchors[0];
    const combinedText = anchors
      .map((anchor) => anchor.text)
      .join(' ')
      .slice(0, 8000);

    const averageEmotion = this.averageEmotion(anchors.map((anchor) => anchor.emotion ?? DEFAULT_EMOTION));
    const averageRelationship = this.averageRelationship(
      anchors.map((anchor) => anchor.relationship ?? DEFAULT_RELATIONSHIP),
    );

    return {
      anchorId: this.idFactory('seqmem_cmp'),
      roomId,
      channelId: roomAnchor.channelId,
      modeId: roomAnchor.modeId,
      actorIds: mergeUnique(...anchors.map((anchor) => anchor.actorIds)),
      actorTypes: mergeUnique(...anchors.map((anchor) => anchor.actorTypes)),
      kind: anchors.some((anchor) => anchor.kind === 'LEGEND') ? 'LEGEND' : 'SCENE',
      retentionClass: anchors.some((anchor) => anchor.retentionClass === 'PINNED') ? 'LONG' : 'MEDIUM',
      compressionTier: targetTier,
      visibility: anchors.some((anchor) => anchor.visibility === 'VISIBLE') ? 'VISIBLE' : 'SHADOW',
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
      firstMessageSequence: anchors[0]?.firstMessageSequence,
      lastMessageSequence: anchors[anchors.length - 1]?.lastMessageSequence,
      firstMessageId: anchors[0]?.firstMessageId,
      lastMessageId: anchors[anchors.length - 1]?.lastMessageId,
      text: combinedText,
      normalizedText: normalizeForSearch(combinedText, this.config.lexicalCaseSensitive),
      vector: undefined,
      salience: clamp01(average(anchors.map((anchor) => anchor.salience)) + 0.04),
      replayWeight: clamp01(average(anchors.map((anchor) => anchor.replayWeight))),
      retrievalWeight: clamp01(average(anchors.map((anchor) => anchor.retrievalWeight))),
      continuityWeight: clamp01(average(anchors.map((anchor) => anchor.continuityWeight)) + 0.05),
      callbackWeight: clamp01(average(anchors.map((anchor) => anchor.callbackWeight))),
      pressureWeight: clamp01(average(anchors.map((anchor) => anchor.pressureWeight))),
      emotion: averageEmotion,
      relationship: averageRelationship,
      tags: mergeUnique(...anchors.map((anchor) => anchor.tags), ['compressed', targetTier]),
      proofHashes: mergeUnique(...anchors.map((anchor) => anchor.proofHashes)),
      sourceMessageIds: mergeUnique(...anchors.map((anchor) => anchor.sourceMessageIds)),
      sourceEventIds: mergeUnique(...anchors.map((anchor) => anchor.sourceEventIds)),
      shadowOnly: anchors.every((anchor) => anchor.shadowOnly),
      metadata: {
        compressedFromAnchorIds: anchors.map((anchor) => anchor.anchorId),
        compressedCount: anchors.length,
      },
    };
  }

  private inferSceneSalience(
    messages: readonly SequenceMemorySourceMessage[],
    trigger: SequenceMemoryTrigger,
    emotion: SequenceMemoryEmotionProfile,
    relationship: SequenceMemoryRelationshipProfile,
  ): number {
    const baseFromCount = clamp01(messages.length / 6);
    const triggerBoost =
      trigger === 'LEGEND_EVENT'
        ? 0.45
        : trigger === 'HELPER_INTERVENTION' || trigger === 'HATER_ESCALATION'
          ? 0.25
          : trigger === 'RUN_END'
            ? 0.2
            : 0.08;
    const proofBoost = clamp01(messages.filter((message) => Boolean(message.proofHash)).length / 4) * 0.1;
    const emotionBoost =
      average([
        emotion.frustration,
        emotion.embarrassment,
        emotion.relief,
        emotion.desperation,
        emotion.dominance,
      ]) * 0.25;
    const relationshipBoost = average([relationship.rivalryIntensity, relationship.rescueDebt, relationship.trust]) * 0.2;
    return clamp01(baseFromCount + triggerBoost + proofBoost + emotionBoost + relationshipBoost);
  }

  private inferReplayWeight(messages: readonly SequenceMemorySourceMessage[], trigger: SequenceMemoryTrigger): number {
    const sequenceSpread =
      messages.length > 1
        ? clamp01(((messages[messages.length - 1]?.sequence ?? 0) - (messages[0]?.sequence ?? 0)) / 10)
        : 0.05;
    const triggerBoost = trigger === 'LEGEND_EVENT' ? 0.5 : trigger === 'RUN_END' ? 0.35 : 0.12;
    return clamp01(sequenceSpread + triggerBoost);
  }

  private inferRetrievalWeight(
    messages: readonly SequenceMemorySourceMessage[],
    trigger: SequenceMemoryTrigger,
    salience: number,
  ): number {
    const tokenRichness = clamp01(
      average(messages.map((message) => tokenize(message.body, this.config.lexicalCaseSensitive).length / 20)),
    );
    const triggerBoost =
      trigger === 'HATER_ESCALATION'
        ? 0.24
        : trigger === 'HELPER_INTERVENTION'
          ? 0.22
          : trigger === 'INFERENCE_SNAPSHOT'
            ? 0.1
            : 0.08;
    return clamp01(tokenRichness * 0.35 + salience * 0.45 + triggerBoost);
  }

  private inferContinuityWeight(
    messages: readonly SequenceMemorySourceMessage[],
    trigger: SequenceMemoryTrigger,
    relationship: SequenceMemoryRelationshipProfile,
  ): number {
    const repeatedActors = new Set(messages.map((message) => message.authorId)).size < messages.length ? 0.12 : 0.02;
    const triggerBoost =
      trigger === 'MODE_TRANSITION'
        ? 0.3
        : trigger === 'CHANNEL_SWITCH'
          ? 0.18
          : trigger === 'RUN_END'
            ? 0.22
            : 0.08;
    return clamp01(repeatedActors + triggerBoost + relationship.familiarity * 0.25 + relationship.trust * 0.12);
  }

  private inferCallbackWeight(
    messages: readonly SequenceMemorySourceMessage[],
    relationship: SequenceMemoryRelationshipProfile,
  ): number {
    const quotedBodyBoost = messages.some((message) => /["'“”‘’]/.test(message.body)) ? 0.18 : 0.04;
    return clamp01(quotedBodyBoost + relationship.rivalryIntensity * 0.28 + relationship.rescueDebt * 0.16);
  }

  private inferPressureWeight(
    messages: readonly SequenceMemorySourceMessage[],
    emotion: SequenceMemoryEmotionProfile,
  ): number {
    const punctuationPressure = clamp01(
      average(
        messages.map((message) => {
          const exclamations = (message.body.match(/!/g) ?? []).length;
          const questionMarks = (message.body.match(/\?/g) ?? []).length;
          return (exclamations + questionMarks) / 6;
        }),
      ),
    );
    return clamp01(
      punctuationPressure * 0.25 +
        emotion.intimidation * 0.2 +
        emotion.frustration * 0.2 +
        emotion.desperation * 0.2 +
        emotion.embarrassment * 0.15,
    );
  }

  private inferEmotion(messages: readonly SequenceMemorySourceMessage[]): SequenceMemoryEmotionProfile {
    const profile = { ...DEFAULT_EMOTION };
    for (const message of messages) {
      const body = message.body.toLowerCase();
      if (/crash|collapse|lost|broke|ruined|dead|wipe/.test(body)) profile.frustration += 0.18;
      if (/save|saved|help|recover|recovering|steady|breathe/.test(body)) profile.relief += 0.15;
      if (/watching|seen|everyone|crowd|laughed|embarrass/.test(body)) profile.embarrassment += 0.16;
      if (/dominate|crush|easy|own|mine|finished/.test(body)) profile.dominance += 0.14;
      if (/trust|listen|follow|with you/.test(body)) profile.trust += 0.14;
      if (/what if|why|how|maybe|curious/.test(body)) profile.curiosity += 0.12;
      if (/scared|fear|afraid|hunt|target|exposed/.test(body)) profile.intimidation += 0.18;
      if (/need|must|now|last chance|hurry/.test(body)) profile.desperation += 0.16;
      if (/good|clean|steady|you can|again/.test(body)) profile.confidence += 0.14;
      if (/stay|remember|always|again|still here/.test(body)) profile.attachment += 0.1;
    }

    const count = Math.max(messages.length, 1);
    return {
      intimidation: clamp01(profile.intimidation / count),
      confidence: clamp01(profile.confidence / count),
      frustration: clamp01(profile.frustration / count),
      curiosity: clamp01(profile.curiosity / count),
      attachment: clamp01(profile.attachment / count),
      embarrassment: clamp01(profile.embarrassment / count),
      relief: clamp01(profile.relief / count),
      dominance: clamp01(profile.dominance / count),
      desperation: clamp01(profile.desperation / count),
      trust: clamp01(profile.trust / count),
    };
  }

  private inferRelationship(messages: readonly SequenceMemorySourceMessage[]): SequenceMemoryRelationshipProfile {
    const profile = { ...DEFAULT_RELATIONSHIP };
    const uniqueActors = new Set(messages.map((message) => message.authorId)).size;
    profile.familiarity = clamp01(messages.length / 10 + (uniqueActors <= 2 ? 0.15 : 0));

    for (const message of messages) {
      switch (message.actorType) {
        case 'HELPER':
          profile.trust += 0.14;
          profile.rescueDebt += /save|recover|exit|steady|listen/i.test(message.body) ? 0.18 : 0.08;
          break;
        case 'HATER':
          profile.rivalryIntensity += 0.18;
          profile.contempt += /fraud|weak|easy|finished|broke/i.test(message.body) ? 0.16 : 0.08;
          profile.fear += /hunt|end|erase|punish|destroy/i.test(message.body) ? 0.14 : 0.04;
          break;
        case 'PLAYER':
          profile.respect += /counter|survive|again|hold|still here/i.test(message.body) ? 0.1 : 0;
          break;
        default:
          break;
      }
      if (/watch|remember|again|still/i.test(message.body)) profile.fascination += 0.06;
    }

    return {
      respect: clamp01(profile.respect),
      fear: clamp01(profile.fear),
      contempt: clamp01(profile.contempt),
      fascination: clamp01(profile.fascination),
      trust: clamp01(profile.trust),
      familiarity: clamp01(profile.familiarity),
      rivalryIntensity: clamp01(profile.rivalryIntensity),
      rescueDebt: clamp01(profile.rescueDebt),
    };
  }

  private averageEmotion(values: readonly SequenceMemoryEmotionProfile[]): SequenceMemoryEmotionProfile {
    const keys = Object.keys(DEFAULT_EMOTION) as Array<keyof SequenceMemoryEmotionProfile>;
    const next = { ...DEFAULT_EMOTION };
    for (const key of keys) {
      next[key] = clamp01(average(values.map((value) => value[key])));
    }
    return next;
  }

  private averageRelationship(values: readonly SequenceMemoryRelationshipProfile[]): SequenceMemoryRelationshipProfile {
    const keys = Object.keys(DEFAULT_RELATIONSHIP) as Array<keyof SequenceMemoryRelationshipProfile>;
    const next = { ...DEFAULT_RELATIONSHIP };
    for (const key of keys) {
      next[key] = clamp01(average(values.map((value) => value[key])));
    }
    return next;
  }

  private writeAnchor(
    room: SequenceMemoryRoomState,
    anchor: SequenceMemoryAnchor,
    existing?: SequenceMemoryAnchor,
  ): void {
    if (!existing) {
      room.anchorOrder.push(anchor.anchorId);
    } else {
      this.removeAnchorIndexes(room, existing);
    }

    room.anchorsById.set(anchor.anchorId, anchor);
    room.lastUpdatedAtMs = this.now();
    room.lastSequence = Math.max(room.lastSequence ?? 0, anchor.lastMessageSequence ?? 0);
    this.addAnchorIndexes(room, anchor);
    this.recalculateStats();
  }

  private removeAnchor(room: SequenceMemoryRoomState, anchorId: string): void {
    const existing = room.anchorsById.get(anchorId);
    if (!existing) return;
    room.anchorsById.delete(anchorId);
    room.anchorOrder = room.anchorOrder.filter((id) => id !== anchorId);
    this.removeAnchorIndexes(room, existing);
  }

  private addAnchorIndexes(room: SequenceMemoryRoomState, anchor: SequenceMemoryAnchor): void {
    for (const actorId of anchor.actorIds) {
      const set = room.actorAnchorIndex.get(actorId) ?? new Set<string>();
      set.add(anchor.anchorId);
      room.actorAnchorIndex.set(actorId, set);
    }
    for (const tag of anchor.tags) {
      const set = room.tagAnchorIndex.get(tag) ?? new Set<string>();
      set.add(anchor.anchorId);
      room.tagAnchorIndex.set(tag, set);
    }
    const kindSet = room.kindAnchorIndex.get(anchor.kind) ?? new Set<string>();
    kindSet.add(anchor.anchorId);
    room.kindAnchorIndex.set(anchor.kind, kindSet);

    for (const proofHash of anchor.proofHashes) {
      const set = room.proofHashIndex.get(proofHash) ?? new Set<string>();
      set.add(anchor.anchorId);
      room.proofHashIndex.set(proofHash, set);
    }

    if (anchor.shadowOnly) room.shadowAnchorIds.add(anchor.anchorId);
    if (anchor.retentionClass === 'REPLAY_PINNED' || anchor.replayWeight >= 0.92) {
      room.replayPinnedAnchorIds.add(anchor.anchorId);
    }
  }

  private removeAnchorIndexes(room: SequenceMemoryRoomState, anchor: SequenceMemoryAnchor): void {
    for (const actorId of anchor.actorIds) {
      const set = room.actorAnchorIndex.get(actorId);
      if (!set) continue;
      set.delete(anchor.anchorId);
      if (!set.size) room.actorAnchorIndex.delete(actorId);
    }
    for (const tag of anchor.tags) {
      const set = room.tagAnchorIndex.get(tag);
      if (!set) continue;
      set.delete(anchor.anchorId);
      if (!set.size) room.tagAnchorIndex.delete(tag);
    }
    const kindSet = room.kindAnchorIndex.get(anchor.kind);
    if (kindSet) {
      kindSet.delete(anchor.anchorId);
      if (!kindSet.size) room.kindAnchorIndex.delete(anchor.kind);
    }
    for (const proofHash of anchor.proofHashes) {
      const set = room.proofHashIndex.get(proofHash);
      if (!set) continue;
      set.delete(anchor.anchorId);
      if (!set.size) room.proofHashIndex.delete(proofHash);
    }
    room.shadowAnchorIds.delete(anchor.anchorId);
    room.replayPinnedAnchorIds.delete(anchor.anchorId);
  }

  private mergeAnchorIntoArc(room: SequenceMemoryRoomState, anchor: SequenceMemoryAnchor): void {
    const existingArc = [...room.arcsById.values()]
      .filter((arc) => arc.channelId === anchor.channelId && arc.modeId === anchor.modeId)
      .filter((arc) => Math.abs(anchor.updatedAtMs - arc.endedAtMs) <= this.config.arcMergeGapMs)
      .filter((arc) => arc.principalActorIds.some((actorId) => anchor.actorIds.includes(actorId)))
      .sort((a, b) => b.endedAtMs - a.endedAtMs)[0];

    if (!existingArc) {
      const arc: SequenceMemoryArcSummary = {
        arcId: this.idFactory('seqarc'),
        roomId: anchor.roomId,
        channelId: anchor.channelId,
        modeId: anchor.modeId,
        startedAtMs: anchor.createdAtMs,
        endedAtMs: anchor.updatedAtMs,
        anchorIds: [anchor.anchorId],
        principalActorIds: anchor.actorIds,
        label: `${anchor.kind}:${anchor.channelId}`,
        synopsis: anchor.text.slice(0, 280),
        confidence: clamp01(0.55 + anchor.salience * 0.25),
        emotionalCenter: this.inferArcEmotionCenter(anchor.emotion),
        tensionDelta: anchor.pressureWeight,
        recoveryDelta: anchor.emotion?.relief ?? 0,
        rivalryDelta: anchor.relationship?.rivalryIntensity ?? 0,
        helperTrustDelta: anchor.relationship?.trust ?? 0,
        retrievalPriority: clamp01(anchor.retrievalWeight * 0.5 + anchor.continuityWeight * 0.5),
      };
      room.arcsById.set(arc.arcId, arc);
      return;
    }

    const updatedArc: SequenceMemoryArcSummary = {
      ...existingArc,
      endedAtMs: anchor.updatedAtMs,
      anchorIds: mergeUnique(existingArc.anchorIds, [anchor.anchorId]),
      principalActorIds: mergeUnique(existingArc.principalActorIds, anchor.actorIds),
      synopsis: `${existingArc.synopsis} ${anchor.text}`.slice(0, 400),
      confidence: clamp01((existingArc.confidence + anchor.salience) / 2),
      emotionalCenter: this.inferArcEmotionCenter(anchor.emotion),
      tensionDelta: clamp01(existingArc.tensionDelta + anchor.pressureWeight * 0.25),
      recoveryDelta: clamp01(existingArc.recoveryDelta + (anchor.emotion?.relief ?? 0) * 0.2),
      rivalryDelta: clamp01(existingArc.rivalryDelta + (anchor.relationship?.rivalryIntensity ?? 0) * 0.2),
      helperTrustDelta: clamp01(existingArc.helperTrustDelta + (anchor.relationship?.trust ?? 0) * 0.2),
      retrievalPriority: clamp01((existingArc.retrievalPriority + anchor.retrievalWeight + anchor.continuityWeight) / 3),
    };

    room.arcsById.set(updatedArc.arcId, updatedArc);
  }

  private inferArcEmotionCenter(
    emotion: SequenceMemoryEmotionProfile | undefined,
  ): keyof SequenceMemoryEmotionProfile | 'mixed' {
    if (!emotion) return 'mixed';
    const entries = Object.entries(emotion) as Array<[keyof SequenceMemoryEmotionProfile, number]>;
    entries.sort((a, b) => b[1] - a[1]);
    if (!entries.length) return 'mixed';
    if ((entries[0]?.[1] ?? 0) < 0.2) return 'mixed';
    return entries[0][0];
  }

  private enforceRoomCapacity(roomId: string, room: SequenceMemoryRoomState): void {
    const visibleLimit = this.config.maxAnchorsPerRoom;
    const shadowLimit = this.config.maxShadowAnchorsPerRoom;

    while (room.anchorOrder.length > visibleLimit) {
      const candidateId = room.anchorOrder[0];
      const candidate = candidateId ? room.anchorsById.get(candidateId) : undefined;
      if (!candidate) {
        room.anchorOrder.shift();
        continue;
      }
      const protectedAnchor =
        candidate.retentionClass === 'PINNED' ||
        candidate.retentionClass === 'REPLAY_PINNED' ||
        room.replayPinnedAnchorIds.has(candidate.anchorId);
      if (protectedAnchor) {
        room.anchorOrder.push(room.anchorOrder.shift() as string);
        break;
      }
      this.removeAnchor(room, candidate.anchorId);
    }

    const shadowIds = [...room.shadowAnchorIds];
    if (shadowIds.length > shadowLimit) {
      for (const anchorId of shadowIds.slice(0, shadowIds.length - shadowLimit)) {
        this.removeAnchor(room, anchorId);
      }
    }

    this.logger.debug('Sequence memory room capacity enforced', {
      roomId,
      anchorCount: room.anchorOrder.length,
      shadowCount: room.shadowAnchorIds.size,
    });
  }

  private collectAnchorsForRead(query: SequenceMemoryReadQuery): SequenceMemoryAnchor[] {
    const rooms = query.roomId ? [this.rooms.get(query.roomId)].filter(Boolean) : [...this.rooms.values()];
    const anchors: SequenceMemoryAnchor[] = [];
    for (const room of rooms) {
      if (!room) continue;
      for (const anchorId of room.anchorOrder) {
        const anchor = room.anchorsById.get(anchorId);
        if (!anchor) continue;
        anchors.push(anchor);
      }
    }
    return anchors;
  }

  private filterAnchorsForRead(
    anchors: readonly SequenceMemoryAnchor[],
    query: SequenceMemoryReadQuery,
  ): SequenceMemoryAnchor[] {
    const textQuery = query.textQuery
      ? normalizeForSearch(query.textQuery, this.config.lexicalCaseSensitive)
      : undefined;
    const textTokens = textQuery ? tokenize(textQuery, this.config.lexicalCaseSensitive) : [];

    return anchors.filter((anchor) => {
      if (query.roomId && anchor.roomId !== query.roomId) return false;
      if (query.channelId && anchor.channelId !== query.channelId) return false;
      if (query.modeId && anchor.modeId !== query.modeId) return false;
      if (query.actorId && !anchor.actorIds.includes(query.actorId)) return false;
      if (query.actorIds?.length && !anchor.actorIds.some((actorId) => query.actorIds?.includes(actorId))) {
        return false;
      }
      if (query.kinds?.length && !query.kinds.includes(anchor.kind)) return false;
      if (typeof query.minSalience === 'number' && anchor.salience < query.minSalience) return false;
      if (
        typeof query.minRetrievalWeight === 'number' &&
        anchor.retrievalWeight < query.minRetrievalWeight
      ) {
        return false;
      }
      if (typeof query.afterMs === 'number' && anchor.updatedAtMs < query.afterMs) return false;
      if (typeof query.beforeMs === 'number' && anchor.updatedAtMs > query.beforeMs) return false;
      if (query.visibility && anchor.visibility !== query.visibility) return false;
      if (
        query.retentionClasses?.length &&
        !query.retentionClasses.includes(anchor.retentionClass)
      ) {
        return false;
      }
      if (!query.includeShadow && anchor.shadowOnly && !this.config.enableShadowReads) return false;
      if (query.tagsAny?.length && !anchor.tags.some((tag) => query.tagsAny?.includes(tag))) return false;
      if (query.tagsAll?.length && !query.tagsAll.every((tag) => anchor.tags.includes(tag))) return false;
      if (textTokens.length) {
        const candidateTokens = tokenize(anchor.normalizedText, this.config.lexicalCaseSensitive);
        if (overlapScore(textTokens, candidateTokens) <= 0) return false;
      }
      return true;
    });
  }

  private sortAnchors(
    anchors: readonly SequenceMemoryAnchor[],
    sortBy: NonNullable<SequenceMemoryReadQuery['sortBy']>,
    direction: NonNullable<SequenceMemoryReadQuery['sortDirection']>,
  ): SequenceMemoryAnchor[] {
    const next = [...anchors];
    next.sort((a, b) => {
      switch (sortBy) {
        case 'createdAtMs':
          return compareNumber(a.createdAtMs, b.createdAtMs, direction);
        case 'updatedAtMs':
          return compareNumber(a.updatedAtMs, b.updatedAtMs, direction);
        case 'salience':
          return compareNumber(a.salience, b.salience, direction);
        case 'retrievalWeight':
          return compareNumber(a.retrievalWeight, b.retrievalWeight, direction);
        case 'continuityWeight':
          return compareNumber(a.continuityWeight, b.continuityWeight, direction);
        default:
          return compareNumber(a.updatedAtMs, b.updatedAtMs, direction);
      }
    });
    return next;
  }

  private recordLatency(kind: 'write' | 'read' | 'retrieval' | 'compression', latencyMs: number): void {
    switch (kind) {
      case 'write': {
        const prior = this.stats.totalWrites;
        this.stats.totalWrites += 1;
        this.stats.averageWriteLatencyMs =
          prior === 0 ? latencyMs : (this.stats.averageWriteLatencyMs * prior + latencyMs) / (prior + 1);
        break;
      }
      case 'read':
        break;
      case 'retrieval': {
        const prior = Math.max(this.stats.totalRetrievals - 1, 0);
        this.stats.averageRetrievalLatencyMs =
          prior === 0
            ? latencyMs
            : (this.stats.averageRetrievalLatencyMs * prior + latencyMs) / (prior + 1);
        break;
      }
      case 'compression': {
        const prior = Math.max(this.stats.totalCompressions - 1, 0);
        this.stats.averageCompressionLatencyMs =
          prior === 0
            ? latencyMs
            : (this.stats.averageCompressionLatencyMs * prior + latencyMs) / (prior + 1);
        break;
      }
      default:
        break;
    }
    this.stats.lastUpdatedAtMs = this.now();
  }

  private recalculateStats(): void {
    let totalAnchors = 0;
    let totalArcs = 0;
    let shadowAnchors = 0;
    let replayPinned = 0;

    for (const room of this.rooms.values()) {
      totalAnchors += room.anchorsById.size;
      totalArcs += room.arcsById.size;
      shadowAnchors += room.shadowAnchorIds.size;
      replayPinned += room.replayPinnedAnchorIds.size;
    }

    this.stats.totalAnchors = totalAnchors;
    this.stats.totalArcs = totalArcs;
    this.stats.shadowAnchors = shadowAnchors;
    this.stats.replayPinnedAnchors = replayPinned;
    this.stats.lastUpdatedAtMs = this.now();
  }
}

export function createSequenceMemoryClient(
  config: Partial<SequenceMemoryClientConfig> = {},
  dependencies: SequenceMemoryClientDependencies = {},
): SequenceMemoryClient {
  return new SequenceMemoryClient(config, dependencies);
}

export default SequenceMemoryClient;
