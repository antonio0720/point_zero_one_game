// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/intelligence/dl/MemoryRetrievalClient.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT DL MEMORY RETRIEVAL CLIENT
 * FILE: pzo-web/src/engines/chat/intelligence/dl/MemoryRetrievalClient.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Frontend advisory retrieval-backed continuity for the canonical chat
 * intelligence lane.
 *
 * This module exists because the repo has already moved beyond “one reply in,
 * one reply out” chat. The game has recurring rivals, helpers, witnesses,
 * callbacks, post-event residue, and cross-mode continuity. The frontend needs
 * a deterministic retrieval surface that can:
 *
 * - ingest meaningful moments immediately,
 * - materialize local embedding documents and memory anchors,
 * - retrieve top-salience memories before the backend roundtrip completes,
 * - feed ranking, preview, and scene-planning lanes,
 * - stay merge-friendly with backend authority later.
 *
 * Frontend doctrine
 * -----------------
 * - The frontend may remember fast, but not durably own truth.
 * - Retrieval is advisory, not authoritative.
 * - Every local memory artifact must be explainable, bounded, and mergeable.
 * - Salience should be derived from game reality, not prompt vibes.
 * - Retrieval should reward callbacks, unresolved pressure, rescue debt,
 *   humiliation witnesses, comeback proofs, and narrative residue.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import type { ChatLearningBridgePublicSnapshot } from '../ChatLearningBridge';

import type {
  ChatFeatureSnapshot,
  ChatLearningProfile,
  ChatMessage,
  ChatVisibleChannel,
  JsonObject,
  Nullable,
  Score01,
  UnixMs,
} from '../../types';

import {
  buildEmbeddingVectorEnvelope,
  canonicalizeEmbeddingText,
  computeLexicalOverlap,
  createConversationEmbeddingDocument,
  createDefaultEmbeddingWindow,
  createEmbeddingBatchEnvelope,
  createEmbeddingModelDescriptor,
  createEmbeddingPreview,
  createEmbeddingSearchQuery,
  createEmbeddingSearchReceipt,
  createEmbeddingVectorShape,
  dedupeStrings as dedupeEmbeddingStrings,
  estimateEmbeddingTokenCount,
  rankEmbeddingDocuments,
  summarizeEmbeddingDocument,
  summarizeEmbeddingMatch,
  type ConversationEmbeddingDocument,
  type EmbeddingBatchEnvelope,
  type EmbeddingDocumentKind,
  type EmbeddingPreview,
  type EmbeddingPurpose,
  type EmbeddingSearchMatch,
  type EmbeddingSearchQuery,
  type EmbeddingSearchReceipt,
  type EmbeddingSourceKind,
  type EmbeddingVectorEnvelope,
} from '../../../../../../shared/contracts/chat/learning/ConversationEmbeddings';

import {
  convertMemoryAnchorMatchToEmbeddingPreview,
  createAnchorLinksFromMatches,
  createMemoryAnchorFromEmbeddingDocument,
  createMemoryAnchorPreview,
  createMemoryAnchorQuery,
  createMemoryAnchorReceipt,
  groupMemoryAnchorsIntoWindow,
  rankMemoryAnchors,
  summarizeMemoryAnchor,
  summarizeMemoryAnchorMatch,
  type MemoryAnchor,
  type MemoryAnchorKind,
  type MemoryAnchorMatch,
  type MemoryAnchorPreview,
  type MemoryAnchorQuery,
  type MemoryAnchorQueryIntent,
  type MemoryAnchorReceipt,
  type MemoryAnchorWindow,
} from '../../../../../../shared/contracts/chat/learning/MemoryAnchors';

/* ========================================================================== */
/* MARK: Module constants                                                     */
/* ========================================================================== */

export const CHAT_MEMORY_RETRIEVAL_CLIENT_MODULE_NAME =
  'PZO_CHAT_MEMORY_RETRIEVAL_CLIENT' as const;

export const CHAT_MEMORY_RETRIEVAL_CLIENT_VERSION =
  '2026.03.20-memory-retrieval-client.v1' as const;

export const CHAT_MEMORY_RETRIEVAL_CLIENT_RUNTIME_LAWS = Object.freeze([
  'Frontend retrieval is advisory and latency-first.',
  'Local memory artifacts must stay bounded and merge-safe.',
  'Embeddings and anchors must be derivable from explicit game evidence.',
  'Unresolved pressure should remain retrievable across mode transitions.',
  'Recent events matter, but prestige and callback value can outrank recency.',
  'Learning-profile anchor hints should bias retrieval, never hard-lock it.',
  'Helper saves, humiliations, reversals, and comeback proofs must be retrievable.',
  'The retrieval lane prepares continuity context; backend truth remains authoritative.',
] as const);

export const CHAT_MEMORY_RETRIEVAL_CLIENT_DEFAULTS = Object.freeze({
  model: 'pzo-chat-memory-frontline-v1',
  dimensions: 192,
  maxDocuments: 1_024,
  maxAnchors: 512,
  maxWindows: 192,
  maxRecentMessages: 18,
  maxPreviewTags: 10,
  maxAnchorLinks: 8,
  maxSummaryChars: 220,
  maxCanonicalChars: 4_000,
  maxDebugNotes: 24,
  defaultDocumentKind: 'CHAT_MOMENT' as EmbeddingDocumentKind,
  defaultAnchorKind: 'GENERAL_CALLBACK' as MemoryAnchorKind,
  defaultPurpose: 'CHAT_MEMORY' as EmbeddingPurpose,
  defaultIntent: 'CALLBACK' as MemoryAnchorQueryIntent,
  defaultTopKDocuments: 8,
  defaultTopKAnchors: 6,
  defaultMinimumDocumentScore: 0.18,
  defaultMinimumAnchorSalience: 0.26,
  defaultWindowAnchorCount: 6,
  manualBoostFromLearningProfile: 0.16,
  unresolvedAnchorBoost: 0.12,
  directRelationshipBoost: 0.14,
  samePersonaBoost: 0.12,
  dealRoomBoost: 0.06,
  rescueBoost: 0.08,
  comebackBoost: 0.08,
  collapseBoost: 0.08,
  confidenceHalfLifeMs: 7 * 60 * 1_000,
  recencyHalfLifeMs: 18 * 60 * 1_000,
} as const);

/* ========================================================================== */
/* MARK: Public contracts                                                     */
/* ========================================================================== */

export type ChatMemoryRetrievalReason =
  | 'MESSAGE_INGEST'
  | 'EVENT_INGEST'
  | 'SCENE_TRANSITION'
  | 'MODE_TRANSITION'
  | 'CALLBACK_LOOKUP'
  | 'RESCUE_LOOKUP'
  | 'RANKING_LOOKUP'
  | 'PREVIEW_LOOKUP'
  | 'DEBUG_LOOKUP'
  | 'OTHER';

export type ChatMemoryRetrievalSource =
  | 'LOCAL_ONLY'
  | 'LOCAL_WITH_PROFILE_HINTS'
  | 'LOCAL_WITH_QUERY_VECTOR'
  | 'LOCAL_WITH_MANUAL_BOOSTS';

export interface ChatMemoryRetrievalClockPort {
  now(): number;
}

export interface ChatMemoryRetrievalTelemetryPort {
  captureRetrievalRequested?(
    reason: ChatMemoryRetrievalReason,
    requestId: string,
    summary?: string,
  ): unknown;
  captureRetrievalCompleted?(
    reason: ChatMemoryRetrievalReason,
    requestId: string,
    durationMs: number,
    summary?: string,
  ): unknown;
  captureRetrievalFailed?(
    reason: ChatMemoryRetrievalReason,
    requestId: string,
    durationMs: number,
    failureCode: string,
  ): unknown;
}

export interface ChatMemoryRetrievalPersistencePort {
  save?(snapshot: ChatMemoryRetrievalClientSerializedState): void;
  load?(): ChatMemoryRetrievalClientSerializedState | null | undefined;
}

export interface ChatMemoryRetrievalIngestInput {
  readonly idSeed?: string;
  readonly reason?: ChatMemoryRetrievalReason;
  readonly text?: string | null;
  readonly summary?: string | null;
  readonly canonicalText?: string | null;
  readonly message?: Partial<ChatMessage> | null;
  readonly recentMessages?: readonly Partial<ChatMessage>[];
  readonly learningProfile?: Nullable<ChatLearningProfile>;
  readonly featureSnapshot?: Nullable<ChatFeatureSnapshot>;
  readonly bridgeSnapshot?: Nullable<ChatLearningBridgePublicSnapshot>;
  readonly roomId?: string | null;
  readonly channelId?: ChatVisibleChannel | string | null;
  readonly runId?: string | null;
  readonly sceneId?: string | null;
  readonly momentId?: string | null;
  readonly actorId?: string | null;
  readonly actorPersonaId?: string | null;
  readonly sourceId?: string | null;
  readonly relationshipId?: string | null;
  readonly quoteId?: string | null;
  readonly sourceKind?: EmbeddingSourceKind;
  readonly documentKind?: EmbeddingDocumentKind;
  readonly anchorKind?: MemoryAnchorKind | null;
  readonly purpose?: EmbeddingPurpose;
  readonly createdAtMs?: UnixMs;
  readonly updatedAtMs?: UnixMs;
  readonly unresolved?: boolean;
  readonly sourceHashes?: readonly string[];
  readonly relationshipRefs?: readonly string[];
  readonly quoteRefs?: readonly string[];
  readonly anchorRefs?: readonly string[];
  readonly tags?: readonly string[];
  readonly emotionTags?: readonly string[];
  readonly relationshipTags?: readonly string[];
  readonly callbackTags?: readonly string[];
  readonly pressureTags?: readonly string[];
  readonly continuityTags?: readonly string[];
  readonly revealTags?: readonly string[];
  readonly debugNotes?: readonly string[];
  readonly manualSalienceBoost01?: number;
}

export interface ChatMemoryIngestedRecord {
  readonly requestId: string;
  readonly createdAtMs: UnixMs;
  readonly document: ConversationEmbeddingDocument;
  readonly anchor: MemoryAnchor | null;
  readonly debugNotes: readonly string[];
}

export interface ChatMemoryRetrievalInput {
  readonly requestId?: string;
  readonly reason?: ChatMemoryRetrievalReason;
  readonly intent?: MemoryAnchorQueryIntent;
  readonly queryText?: string | null;
  readonly message?: Partial<ChatMessage> | null;
  readonly recentMessages?: readonly Partial<ChatMessage>[];
  readonly learningProfile?: Nullable<ChatLearningProfile>;
  readonly featureSnapshot?: Nullable<ChatFeatureSnapshot>;
  readonly bridgeSnapshot?: Nullable<ChatLearningBridgePublicSnapshot>;
  readonly roomId?: string | null;
  readonly channelId?: ChatVisibleChannel | string | null;
  readonly runId?: string | null;
  readonly sceneId?: string | null;
  readonly momentId?: string | null;
  readonly actorId?: string | null;
  readonly actorPersonaId?: string | null;
  readonly relationshipId?: string | null;
  readonly requiredTags?: readonly string[];
  readonly blockedTags?: readonly string[];
  readonly includeDocumentKinds?: readonly EmbeddingDocumentKind[];
  readonly anchorKinds?: readonly MemoryAnchorKind[];
  readonly topKDocuments?: number;
  readonly topKAnchors?: number;
  readonly minimumDocumentScore?: number;
  readonly minimumAnchorSalience?: number;
  readonly queryVector?: readonly number[] | null;
  readonly metadata?: JsonObject;
}

export interface ChatMemoryRetrievalResult {
  readonly requestId: string;
  readonly createdAtMs: UnixMs;
  readonly source: ChatMemoryRetrievalSource;
  readonly reason: ChatMemoryRetrievalReason;
  readonly intent: MemoryAnchorQueryIntent;
  readonly queryText: string;
  readonly documentQuery: EmbeddingSearchQuery;
  readonly anchorQuery: MemoryAnchorQuery;
  readonly documentMatches: readonly EmbeddingSearchMatch[];
  readonly anchorMatches: readonly MemoryAnchorMatch[];
  readonly documentReceipt: EmbeddingSearchReceipt;
  readonly anchorReceipt: MemoryAnchorReceipt;
  readonly documentPreviews: readonly EmbeddingPreview[];
  readonly anchorPreviews: readonly MemoryAnchorPreview[];
  readonly blendedPreviews: readonly EmbeddingPreview[];
  readonly selectedDocuments: readonly ConversationEmbeddingDocument[];
  readonly selectedAnchors: readonly MemoryAnchor[];
  readonly carryoverWindow: MemoryAnchorWindow | null;
  readonly continuityLinks: readonly string[];
  readonly summary: string;
  readonly debugNotes: readonly string[];
}

export interface ChatMemoryRetrievalClientPublicSnapshot {
  readonly moduleName: typeof CHAT_MEMORY_RETRIEVAL_CLIENT_MODULE_NAME;
  readonly moduleVersion: typeof CHAT_MEMORY_RETRIEVAL_CLIENT_VERSION;
  readonly model: string;
  readonly documentCount: number;
  readonly anchorCount: number;
  readonly windowCount: number;
  readonly totals: Readonly<{
    ingests: number;
    retrievals: number;
    anchorHits: number;
    documentHits: number;
    prunes: number;
  }>;
}

export interface ChatMemoryRetrievalClientSerializedState {
  readonly createdAtMs: UnixMs;
  readonly updatedAtMs: UnixMs;
  readonly documents: readonly ConversationEmbeddingDocument[];
  readonly anchors: readonly MemoryAnchor[];
  readonly windows: readonly MemoryAnchorWindow[];
}

export interface ChatMemoryRetrievalClientOptions {
  readonly clock?: Partial<ChatMemoryRetrievalClockPort>;
  readonly telemetry?: Nullable<ChatMemoryRetrievalTelemetryPort>;
  readonly persistence?: Nullable<ChatMemoryRetrievalPersistencePort>;
  readonly defaults?: Partial<typeof CHAT_MEMORY_RETRIEVAL_CLIENT_DEFAULTS>;
  readonly model?: string;
  readonly dimensions?: number;
  readonly requestPrefix?: string;
}

export interface ChatMemoryRetrievalClientPort {
  ingest(input: ChatMemoryRetrievalIngestInput): ChatMemoryIngestedRecord;
  ingestBatch(inputs: readonly ChatMemoryRetrievalIngestInput[]): readonly ChatMemoryIngestedRecord[];
  retrieve(input: ChatMemoryRetrievalInput): ChatMemoryRetrievalResult;
  preview(input: ChatMemoryRetrievalInput): readonly EmbeddingPreview[];
  listDocuments(): readonly ConversationEmbeddingDocument[];
  listAnchors(): readonly MemoryAnchor[];
  listWindows(): readonly MemoryAnchorWindow[];
  getPublicSnapshot(): ChatMemoryRetrievalClientPublicSnapshot;
  serialize(): ChatMemoryRetrievalClientSerializedState;
  hydrate(snapshot: ChatMemoryRetrievalClientSerializedState): void;
  clear(): void;
  prune(nowMs?: number): void;
}

/* ========================================================================== */
/* MARK: Internal types                                                       */
/* ========================================================================== */

interface RuntimeDefaults {
  readonly model: string;
  readonly dimensions: number;
  readonly maxDocuments: number;
  readonly maxAnchors: number;
  readonly maxWindows: number;
  readonly maxRecentMessages: number;
  readonly maxPreviewTags: number;
  readonly maxAnchorLinks: number;
  readonly maxSummaryChars: number;
  readonly maxCanonicalChars: number;
  readonly maxDebugNotes: number;
  readonly defaultDocumentKind: EmbeddingDocumentKind;
  readonly defaultAnchorKind: MemoryAnchorKind;
  readonly defaultPurpose: EmbeddingPurpose;
  readonly defaultIntent: MemoryAnchorQueryIntent;
  readonly defaultTopKDocuments: number;
  readonly defaultTopKAnchors: number;
  readonly defaultMinimumDocumentScore: number;
  readonly defaultMinimumAnchorSalience: number;
  readonly defaultWindowAnchorCount: number;
  readonly manualBoostFromLearningProfile: number;
  readonly unresolvedAnchorBoost: number;
  readonly directRelationshipBoost: number;
  readonly samePersonaBoost: number;
  readonly dealRoomBoost: number;
  readonly rescueBoost: number;
  readonly comebackBoost: number;
  readonly collapseBoost: number;
  readonly confidenceHalfLifeMs: number;
  readonly recencyHalfLifeMs: number;
}

interface MutableTotals {
  ingests: number;
  retrievals: number;
  anchorHits: number;
  documentHits: number;
  prunes: number;
}

interface StableFeatureSummary {
  readonly pressureTag: string;
  readonly activeChannel: string;
  readonly preferredChannel: string;
  readonly dropRisk01: number;
  readonly helperNeed01: number;
  readonly rescueNeed01: number;
  readonly audienceHeat01: number;
  readonly affectLabel: string;
}

interface StableProfileSummary {
  readonly playerId: string;
  readonly strongestEmotion: string;
  readonly preferredHelper: string;
  readonly preferredHater: string;
  readonly memoryAnchorIds: readonly string[];
}

const DEFAULT_CLOCK: ChatMemoryRetrievalClockPort = Object.freeze({
  now: () => Date.now(),
});

const NOOP_TELEMETRY: ChatMemoryRetrievalTelemetryPort = Object.freeze({});

/* ========================================================================== */
/* MARK: Utility helpers                                                      */
/* ========================================================================== */

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

function ensureArray<T>(value: readonly T[] | null | undefined): readonly T[] {
  return Array.isArray(value) ? Object.freeze([...value]) : Object.freeze([]);
}

function dedupeStrings(values: readonly (string | null | undefined)[]): readonly string[] {
  return Object.freeze(
    Array.from(
      new Set(
        values
          .map((value) => (value ?? '').trim())
          .filter(Boolean),
      ),
    ),
  );
}

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(0, maxChars - 1))}…`;
}

function toUnixMs(value: number | undefined | null, fallback: number): UnixMs {
  return Number.isFinite(value) ? Number(value) as UnixMs : fallback as UnixMs;
}

function stableRequestId(prefix: string, reason: string, clock: ChatMemoryRetrievalClockPort): string {
  return `${prefix}:${reason}:${clock.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

function lower(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function toVisibleChannel(value: string | ChatVisibleChannel | null | undefined): string {
  return (value ?? 'GLOBAL').toString().trim() || 'GLOBAL';
}

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function extractNumber(value: unknown, fallback = 0): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function extractString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function extractNestedNumber(root: unknown, path: readonly string[], fallback = 0): number {
  let current: unknown = root;
  for (const segment of path) {
    const record = safeRecord(current);
    current = record[segment];
  }
  return extractNumber(current, fallback);
}

function extractNestedString(root: unknown, path: readonly string[], fallback = ''): string {
  let current: unknown = root;
  for (const segment of path) {
    const record = safeRecord(current);
    current = record[segment];
  }
  return extractString(current, fallback);
}

function inferFeatureSummary(
  featureSnapshot: Nullable<ChatFeatureSnapshot>,
  activeChannel: string,
): StableFeatureSummary {
  const root = safeRecord(featureSnapshot);
  const affectLabel =
    extractNestedString(root, ['affect', 'label']) ||
    extractNestedString(root, ['emotion', 'dominant']) ||
    'steady';
  return Object.freeze({
    pressureTag:
      extractNestedString(root, ['pressure', 'band']) ||
      extractNestedString(root, ['pressureBand']) ||
      'MEDIUM',
    activeChannel,
    preferredChannel:
      extractNestedString(root, ['channel', 'recommended']) ||
      extractNestedString(root, ['recommendedChannel']) ||
      activeChannel,
    dropRisk01: clamp01(
      extractNestedNumber(root, ['dropOff', 'risk01']) ||
        extractNestedNumber(root, ['dropRisk01']) ||
        extractNestedNumber(root, ['risk', 'dropOff01']),
    ),
    helperNeed01: clamp01(
      extractNestedNumber(root, ['helper', 'need01']) ||
        extractNestedNumber(root, ['helperNeed01']),
    ),
    rescueNeed01: clamp01(
      extractNestedNumber(root, ['rescue', 'need01']) ||
        extractNestedNumber(root, ['rescueNeed01']),
    ),
    audienceHeat01: clamp01(
      extractNestedNumber(root, ['audience', 'heat01']) ||
        extractNestedNumber(root, ['audienceHeat01']) ||
        extractNestedNumber(root, ['crowd', 'heat01']),
    ),
    affectLabel,
  });
}

function inferProfileSummary(
  learningProfile: Nullable<ChatLearningProfile>,
): StableProfileSummary {
  const root = safeRecord(learningProfile);
  const anchors = Array.isArray(root.lastTopMemoryAnchors)
    ? root.lastTopMemoryAnchors.map((value) => String(value))
    : [];
  return Object.freeze({
    playerId:
      extractString(root.playerId) ||
      extractString(root.profileId) ||
      extractString(root.userId) ||
      'player',
    strongestEmotion:
      extractNestedString(root, ['emotionBaseline', 'dominant']) ||
      extractNestedString(root, ['emotionBaseline', 'label']) ||
      'steady',
    preferredHelper:
      extractNestedString(root, ['helperTrust', 'topHelperPersonaId']) ||
      extractNestedString(root, ['helper', 'topHelperPersonaId']) ||
      'helper.default',
    preferredHater:
      extractNestedString(root, ['haterTargeting', 'topHaterPersonaId']) ||
      extractNestedString(root, ['hater', 'topHaterPersonaId']) ||
      'hater.default',
    memoryAnchorIds: Object.freeze(anchors),
  });
}

function canonicalizeQueryText(
  queryText: string | null | undefined,
  message: Partial<ChatMessage> | null | undefined,
  recentMessages: readonly Partial<ChatMessage>[] | null | undefined,
): string {
  const explicit = canonicalizeEmbeddingText(queryText ?? '');
  if (explicit.length) return explicit;
  const messageBody = canonicalizeEmbeddingText(extractString(message?.body));
  if (messageBody.length) return messageBody;
  const joinedRecent = (recentMessages ?? [])
    .slice(-3)
    .map((value) => canonicalizeEmbeddingText(extractString(value.body)))
    .filter(Boolean)
    .join(' ');
  return canonicalizeEmbeddingText(joinedRecent || 'memory continuity query');
}

function inferPurpose(intent: MemoryAnchorQueryIntent): EmbeddingPurpose {
  switch (intent) {
    case 'CALLBACK':
    case 'TAUNT':
    case 'PREEMPT':
      return 'CHAT_RETRIEVAL_QUERY';
    case 'RESCUE':
      return 'HELPER_MATCH';
    case 'NARRATE':
      return 'CHAT_MEMORY';
    case 'COUNTERPLAY':
      return 'RESPONSE_RANKING';
    case 'NEGOTIATE':
      return 'CHANNEL_ROUTING';
    default:
      return 'CHAT_MEMORY';
  }
}

function inferAnchorKind(input: ChatMemoryRetrievalIngestInput): MemoryAnchorKind {
  if (input.anchorKind) return input.anchorKind;
  const text = lower(input.text) || lower(input.message?.body);
  const reason = input.reason ?? 'OTHER';
  if (reason === 'SCENE_TRANSITION' || reason === 'MODE_TRANSITION') {
    return 'SCENE_RESIDUE';
  }
  if (text.includes('save') || text.includes('rescue')) return 'HELPER_SAVE';
  if (text.includes('humiliat') || text.includes('embarrass')) return 'PUBLIC_HUMILIATION';
  if (text.includes('comeback')) return 'COMEBACK_PROOF';
  if (text.includes('collapse') || text.includes('broke')) return 'COLLAPSE_MARK';
  if (text.includes('bluff') || text.includes('deal')) return 'NEGOTIATION_SCAR';
  if (text.includes('witness') || text.includes('everyone saw')) return 'PUBLIC_WITNESS';
  return CHAT_MEMORY_RETRIEVAL_CLIENT_DEFAULTS.defaultAnchorKind;
}

function inferDocumentKind(input: ChatMemoryRetrievalIngestInput): EmbeddingDocumentKind {
  if (input.documentKind) return input.documentKind;
  const text = lower(input.text) || lower(input.message?.body);
  if (text.includes('deal')) return 'NEGOTIATION_CONTEXT';
  if (text.includes('rescue') || text.includes('save')) return 'HELPER_COACHING';
  if (text.includes('taunt') || text.includes('humiliat')) return 'PUBLIC_WITNESS';
  if (text.includes('comeback') || text.includes('collapse') || text.includes('broke')) {
    return 'SCENE_BEAT';
  }
  return CHAT_MEMORY_RETRIEVAL_CLIENT_DEFAULTS.defaultDocumentKind;
}

function inferSourceKind(input: ChatMemoryRetrievalIngestInput): EmbeddingSourceKind {
  if (input.sourceKind) return input.sourceKind;
  const body = lower(input.message?.body) || lower(input.text);
  if (body.includes('system')) return 'SYSTEM';
  if (body.includes('helper')) return 'HELPER';
  if (body.includes('crowd') || body.includes('spectator')) return 'CROWD';
  if (body.includes('deal')) return 'DEAL_ROOM';
  return 'PLAYER';
}

function joinRecentMessages(
  recentMessages: readonly Partial<ChatMessage>[] | null | undefined,
  limit: number,
): string {
  return (recentMessages ?? [])
    .slice(-limit)
    .map((value) => canonicalizeEmbeddingText(extractString(value.body)))
    .filter(Boolean)
    .join(' ');
}

function hashToken(token: string, dimensions: number): number {
  let hash = 0;
  for (let index = 0; index < token.length; index += 1) {
    hash = (hash * 31 + token.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % Math.max(1, dimensions);
}

function tokenize(text: string): readonly string[] {
  return Object.freeze(
    canonicalizeEmbeddingText(text)
      .toLowerCase()
      .split(/[^a-z0-9_]+/g)
      .filter(Boolean),
  );
}

function buildDeterministicVector(
  text: string,
  dimensions: number,
  extraTokens: readonly string[] = [],
): readonly number[] {
  const vector = new Array<number>(dimensions).fill(0);
  const tokens = [...tokenize(text), ...extraTokens];
  if (!tokens.length) {
    vector[0] = 1;
    return Object.freeze(vector);
  }
  for (const token of tokens) {
    const slot = hashToken(token, dimensions);
    const weight = 1 + Math.min(3, token.length / 8);
    vector[slot] += weight;
  }
  return Object.freeze(vector);
}

function inferPressureTags(
  input: ChatMemoryRetrievalIngestInput,
  featureSummary: StableFeatureSummary,
): readonly string[] {
  const tags = [...(input.pressureTags ?? [])];
  if (featureSummary.pressureTag) tags.push(featureSummary.pressureTag.toLowerCase());
  const body = lower(input.text) || lower(input.message?.body);
  if (body.includes('critical')) tags.push('critical');
  if (body.includes('break')) tags.push('break');
  if (body.includes('shield')) tags.push('shield');
  return dedupeStrings(tags);
}

function inferEmotionTags(
  input: ChatMemoryRetrievalIngestInput,
  featureSummary: StableFeatureSummary,
  profileSummary: StableProfileSummary,
): readonly string[] {
  const tags = [
    ...(input.emotionTags ?? []),
    featureSummary.affectLabel,
    profileSummary.strongestEmotion,
  ];
  const body = lower(input.text) || lower(input.message?.body);
  if (body.includes('panic')) tags.push('panic');
  if (body.includes('shame') || body.includes('embarrass')) tags.push('shame');
  if (body.includes('relief')) tags.push('relief');
  if (body.includes('dominant')) tags.push('dominance');
  if (body.includes('trust')) tags.push('trust');
  return dedupeStrings(tags);
}

function inferRelationshipTags(input: ChatMemoryRetrievalIngestInput): readonly string[] {
  const body = lower(input.text) || lower(input.message?.body);
  const tags = [...(input.relationshipTags ?? [])];
  if (body.includes('helper')) tags.push('helper');
  if (body.includes('rival') || body.includes('hater')) tags.push('rival');
  if (body.includes('crowd')) tags.push('crowd');
  if (body.includes('deal')) tags.push('dealroom');
  if (input.relationshipId) tags.push(`relationship:${input.relationshipId}`);
  return dedupeStrings(tags);
}

function inferContinuityTags(input: ChatMemoryRetrievalIngestInput): readonly string[] {
  return dedupeStrings([
    ...(input.continuityTags ?? []),
    input.sceneId ? `scene:${input.sceneId}` : undefined,
    input.momentId ? `moment:${input.momentId}` : undefined,
    input.runId ? `run:${input.runId}` : undefined,
    input.roomId ? `room:${input.roomId}` : undefined,
  ]);
}

function inferCallbackTags(input: ChatMemoryRetrievalIngestInput): readonly string[] {
  const body = lower(input.text) || lower(input.message?.body);
  const tags = [...(input.callbackTags ?? [])];
  if (body.includes('remember')) tags.push('remember');
  if (body.includes('last time')) tags.push('last_time');
  if (body.includes('you said')) tags.push('quoted_boast');
  if (body.includes('everyone saw')) tags.push('public_witness');
  return dedupeStrings(tags);
}

function inferRevealTags(input: ChatMemoryRetrievalIngestInput): readonly string[] {
  const body = lower(input.text) || lower(input.message?.body);
  const tags = [...(input.revealTags ?? [])];
  if (body.includes('later')) tags.push('deferred');
  if (body.includes('unread')) tags.push('unread_pressure');
  if (body.includes('lurking')) tags.push('lurking');
  return dedupeStrings(tags);
}

function inferBaseSalience(
  input: ChatMemoryRetrievalIngestInput,
  featureSummary: StableFeatureSummary,
): number {
  const body = lower(input.text) || lower(input.message?.body);
  let value = 0.42;
  if (body.includes('comeback')) value += 0.2;
  if (body.includes('collapse') || body.includes('shield broke')) value += 0.18;
  if (body.includes('rescue')) value += 0.16;
  if (body.includes('humiliat') || body.includes('embarrass')) value += 0.14;
  if (body.includes('deal')) value += 0.08;
  if (featureSummary.audienceHeat01 > 0.7) value += 0.06;
  if (featureSummary.rescueNeed01 > 0.65) value += 0.05;
  value += clamp01(input.manualSalienceBoost01 ?? 0) * 0.3;
  return clamp01(value);
}

function inferSummaryText(
  input: ChatMemoryRetrievalIngestInput,
  featureSummary: StableFeatureSummary,
  maxChars: number,
): string {
  const explicit = canonicalizeEmbeddingText(input.summary ?? '');
  if (explicit.length) return truncate(explicit, maxChars);
  const body = canonicalizeEmbeddingText(input.text ?? extractString(input.message?.body));
  if (body.length) return truncate(body, maxChars);
  return truncate(
    `memory event in ${featureSummary.activeChannel.toLowerCase()} during ${featureSummary.pressureTag.toLowerCase()} pressure`,
    maxChars,
  );
}

function buildContextSummary(
  featureSummary: StableFeatureSummary,
  profileSummary: StableProfileSummary,
  recentMessageSummary: string,
): string {
  return canonicalizeEmbeddingText(
    [
      `channel ${featureSummary.activeChannel}`,
      `preferred ${featureSummary.preferredChannel}`,
      `pressure ${featureSummary.pressureTag}`,
      `affect ${featureSummary.affectLabel}`,
      `drop risk ${featureSummary.dropRisk01.toFixed(2)}`,
      `helper need ${featureSummary.helperNeed01.toFixed(2)}`,
      `rescue need ${featureSummary.rescueNeed01.toFixed(2)}`,
      `audience heat ${featureSummary.audienceHeat01.toFixed(2)}`,
      `player ${profileSummary.playerId}`,
      `helper ${profileSummary.preferredHelper}`,
      `hater ${profileSummary.preferredHater}`,
      recentMessageSummary ? `recent ${recentMessageSummary}` : '',
    ]
      .filter(Boolean)
      .join(' | '),
  );
}

/* ========================================================================== */
/* MARK: Client                                                               */
/* ========================================================================== */

export class MemoryRetrievalClient implements ChatMemoryRetrievalClientPort {
  private readonly clock: ChatMemoryRetrievalClockPort;
  private readonly telemetry: ChatMemoryRetrievalTelemetryPort;
  private readonly persistence: ChatMemoryRetrievalPersistencePort | null;
  private readonly defaults: RuntimeDefaults;
  private readonly modelDescriptor;
  private readonly requestPrefix: string;
  private readonly createdAtMs: UnixMs;
  private readonly totals: MutableTotals = {
    ingests: 0,
    retrievals: 0,
    anchorHits: 0,
    documentHits: 0,
    prunes: 0,
  };
  private readonly documents = new Map<string, ConversationEmbeddingDocument>();
  private readonly anchors = new Map<string, MemoryAnchor>();
  private readonly windows = new Map<string, MemoryAnchorWindow>();
  private updatedAtMs: UnixMs;

  constructor(options: ChatMemoryRetrievalClientOptions = {}) {
    this.clock = Object.freeze({
      ...DEFAULT_CLOCK,
      ...(options.clock ?? {}),
    });
    this.telemetry = options.telemetry ?? NOOP_TELEMETRY;
    this.persistence = options.persistence ?? null;
    this.defaults = Object.freeze({
      ...CHAT_MEMORY_RETRIEVAL_CLIENT_DEFAULTS,
      ...(options.defaults ?? {}),
      model: options.model ?? options.defaults?.model ?? CHAT_MEMORY_RETRIEVAL_CLIENT_DEFAULTS.model,
      dimensions:
        Math.max(
          32,
          Math.floor(
            options.dimensions ??
              options.defaults?.dimensions ??
              CHAT_MEMORY_RETRIEVAL_CLIENT_DEFAULTS.dimensions,
          ),
        ),
    });
    this.modelDescriptor = createEmbeddingModelDescriptor({
      provider: 'UNKNOWN',
      modelName: this.defaults.model,
      version: CHAT_MEMORY_RETRIEVAL_CLIENT_VERSION,
      purpose: 'CHAT_MEMORY',
      shape: createEmbeddingVectorShape(this.defaults.dimensions, 'FLOAT32', true),
      distanceMetric: 'COSINE',
    });
    this.requestPrefix = (options.requestPrefix ?? 'memory').trim() || 'memory';
    const now = this.clock.now();
    this.createdAtMs = now as UnixMs;
    this.updatedAtMs = now as UnixMs;
    const persisted = this.persistence?.load?.();
    if (persisted) {
      this.hydrate(persisted);
    }
  }

  public ingest(input: ChatMemoryRetrievalIngestInput): ChatMemoryIngestedRecord {
    const now = this.clock.now();
    const requestId = stableRequestId(
      this.requestPrefix,
      input.reason ?? 'MESSAGE_INGEST',
      this.clock,
    );
    const activeChannel = toVisibleChannel(input.channelId);
    const featureSummary = inferFeatureSummary(input.featureSnapshot ?? null, activeChannel);
    const profileSummary = inferProfileSummary(input.learningProfile ?? null);
    const recentMessageSummary = truncate(
      joinRecentMessages(input.recentMessages, this.defaults.maxRecentMessages),
      this.defaults.maxSummaryChars,
    );
    const summary = inferSummaryText(input, featureSummary, this.defaults.maxSummaryChars);
    const primaryText = canonicalizeEmbeddingText(
      input.canonicalText ??
        input.text ??
        extractString(input.message?.body) ??
        summary,
    ).slice(0, this.defaults.maxCanonicalChars);
    const sourceKind = inferSourceKind(input);
    const documentKind = inferDocumentKind(input);
    const purpose = input.purpose ?? this.defaults.defaultPurpose;
    const emotionTags = inferEmotionTags(input, featureSummary, profileSummary);
    const relationshipTags = inferRelationshipTags(input);
    const callbackTags = inferCallbackTags(input);
    const continuityTags = inferContinuityTags(input);
    const pressureTags = inferPressureTags(input, featureSummary);
    const revealTags = inferRevealTags(input);
    const vectorTokens = dedupeStrings([
      ...emotionTags,
      ...relationshipTags,
      ...callbackTags,
      ...continuityTags,
      ...pressureTags,
      ...revealTags,
      featureSummary.activeChannel,
      featureSummary.preferredChannel,
      profileSummary.preferredHelper,
      profileSummary.preferredHater,
    ]);
    const vector = buildEmbeddingVectorEnvelope(
      requestId,
      buildDeterministicVector(primaryText, this.defaults.dimensions, vectorTokens),
      this.modelDescriptor,
      { dimensions: this.defaults.dimensions, normalize: true, clampMagnitude: 6 },
    );
    const contextSummary = buildContextSummary(
      featureSummary,
      profileSummary,
      recentMessageSummary,
    );
    const baseSalience = inferBaseSalience(input, featureSummary);
    const document = createConversationEmbeddingDocument({
      idSeed: input.idSeed ?? requestId,
      kind: documentKind,
      purpose,
      text: primaryText,
      summary,
      canonicalText: primaryText,
      channelContext: {
        sourceKind,
        sourceId: input.sourceId ?? input.actorId ?? input.roomId ?? undefined,
        actorId: input.actorId ?? undefined,
        actorPersonaId: input.actorPersonaId ?? undefined,
        relationshipId: input.relationshipId ?? undefined,
        quoteId: input.quoteId ?? undefined,
        roomId: input.roomId ?? undefined,
        channelId: activeChannel,
        runId: input.runId ?? undefined,
        sceneId: input.sceneId ?? undefined,
        momentId: input.momentId ?? undefined,
        messageId: extractString(input.message?.id) || undefined,
      },
      window: {
        ...createDefaultEmbeddingWindow('SCENE'),
        turnCount: Math.max(1, (input.recentMessages?.length ?? 0) + (input.message ? 1 : 0)),
        messageCount: Math.max(1, (input.recentMessages?.length ?? 0) + (input.message ? 1 : 0)),
        sceneIds: input.sceneId ? [input.sceneId] : [],
        momentIds: input.momentId ? [input.momentId] : [],
      },
      stats: {
        tokenCount: estimateEmbeddingTokenCount(primaryText),
        characterCount: primaryText.length,
        sentenceCount: Math.max(1, primaryText.split(/[.!?]+/).filter(Boolean).length),
      },
      salience: {
        baseSalience,
        emotionalSalience: clamp01(baseSalience + emotionTags.length * 0.025),
        narrativeSalience: clamp01(baseSalience + continuityTags.length * 0.02),
        relationshipSalience: clamp01(baseSalience + relationshipTags.length * 0.03),
        noveltySalience: clamp01(0.35 + callbackTags.length * 0.04 + revealTags.length * 0.02),
        conflictSalience: clamp01(baseSalience + pressureTags.length * 0.03),
        prestigeSalience: clamp01(baseSalience + (primaryText.includes('legend') ? 0.15 : 0)),
        comebackSalience: clamp01(baseSalience + (lower(primaryText).includes('comeback') ? 0.16 : 0)),
        collapseSalience: clamp01(baseSalience + (lower(primaryText).includes('collapse') ? 0.16 : 0)),
        rescueSalience: clamp01(baseSalience + ((lower(primaryText).includes('rescue') || lower(primaryText).includes('save')) ? 0.16 : 0)),
      },
      tags: {
        intents: dedupeEmbeddingStrings([
          input.reason?.toLowerCase(),
          input.anchorKind ? `anchor:${input.anchorKind.toLowerCase()}` : undefined,
          `purpose:${purpose.toLowerCase()}`,
        ]),
        emotions: emotionTags,
        pressureTags,
        relationshipTags,
        callbackTags,
        revealTags,
        continuityTags,
        arbitraryTags: dedupeEmbeddingStrings([...(input.tags ?? []), sourceKind.toLowerCase()]),
      },
      vector,
      sourceHashes: ensureArray(input.sourceHashes),
      quoteRefs: ensureArray(input.quoteRefs),
      relationshipRefs: dedupeStrings([
        ...(input.relationshipRefs ?? []),
        input.relationshipId ?? undefined,
      ]),
      anchorRefs: ensureArray(input.anchorRefs),
      createdAtMs: toUnixMs(input.createdAtMs, now),
      updatedAtMs: toUnixMs(input.updatedAtMs, now),
    });

    this.documents.set(document.id, document);
    this.enforceDocumentCap();

    let anchor: MemoryAnchor | null = null;
    if (input.anchorKind !== null) {
      anchor = createMemoryAnchorFromEmbeddingDocument(document, inferAnchorKind(input), {
        idSeed: `${document.id}:${inferAnchorKind(input)}`,
        triggerReason: input.reason ?? 'MESSAGE_INGEST',
        unresolved: Boolean(input.unresolved),
      });
      this.anchors.set(anchor.id, anchor);
      this.enforceAnchorCap();
    }

    this.writeWindow(document, anchor);
    this.updatedAtMs = now as UnixMs;
    this.totals.ingests += 1;
    this.persist();

    const debugNotes = Object.freeze(
      dedupeStrings([
        ...(input.debugNotes ?? []),
        `document=${document.id}`,
        anchor ? `anchor=${anchor.id}` : 'anchor=none',
        `kind=${document.kind}`,
        `salience=${document.salience.finalSalience.toFixed(3)}`,
        `source=${document.channelContext.sourceKind}`,
      ]).slice(0, this.defaults.maxDebugNotes),
    );

    return Object.freeze({
      requestId,
      createdAtMs: now as UnixMs,
      document,
      anchor,
      debugNotes,
    });
  }

  public ingestBatch(
    inputs: readonly ChatMemoryRetrievalIngestInput[],
  ): readonly ChatMemoryIngestedRecord[] {
    return Object.freeze(inputs.map((value) => this.ingest(value)));
  }

  public retrieve(input: ChatMemoryRetrievalInput): ChatMemoryRetrievalResult {
    const startedAt = this.clock.now();
    const requestId = input.requestId ?? stableRequestId(this.requestPrefix, input.reason ?? 'CALLBACK_LOOKUP', this.clock);
    const reason = input.reason ?? 'CALLBACK_LOOKUP';
    const intent = input.intent ?? this.defaults.defaultIntent;
    const activeChannel = toVisibleChannel(input.channelId);
    const featureSummary = inferFeatureSummary(input.featureSnapshot ?? null, activeChannel);
    const profileSummary = inferProfileSummary(input.learningProfile ?? null);
    const queryText = canonicalizeQueryText(input.queryText, input.message, input.recentMessages);
    const queryPurpose = inferPurpose(intent);
    const queryVector = input.queryVector?.length
      ? buildEmbeddingVectorEnvelope(
          `${requestId}:query`,
          input.queryVector,
          this.modelDescriptor,
          { dimensions: this.defaults.dimensions, normalize: true, clampMagnitude: 6 },
        )
      : buildEmbeddingVectorEnvelope(
          `${requestId}:query`,
          buildDeterministicVector(
            queryText,
            this.defaults.dimensions,
            dedupeStrings([
              intent,
              featureSummary.affectLabel,
              featureSummary.pressureTag,
              activeChannel,
              profileSummary.strongestEmotion,
            ]),
          ),
          this.modelDescriptor,
          { dimensions: this.defaults.dimensions, normalize: true, clampMagnitude: 6 },
        );

    this.telemetry.captureRetrievalRequested?.(reason, requestId, truncate(queryText, 120));

    const requiredTags = dedupeStrings([
      ...(input.requiredTags ?? []),
      featureSummary.affectLabel,
    ]);
    const blockedTags = dedupeStrings(input.blockedTags ?? []);
    const manualBoostByDocumentId = this.buildDocumentBoostMap(input, profileSummary, featureSummary);
    const documentQuery = createEmbeddingSearchQuery({
      idSeed: requestId,
      purpose: queryPurpose,
      queryText,
      queryVector,
      topK: Math.max(1, input.topKDocuments ?? this.defaults.defaultTopKDocuments),
      minimumScore: clamp01(input.minimumDocumentScore ?? this.defaults.defaultMinimumDocumentScore),
      includeKinds: ensureArray(input.includeDocumentKinds),
      requiredTags,
      blockedTags,
      roomId: input.roomId ?? undefined,
      channelId: activeChannel,
      runId: input.runId ?? undefined,
      sceneId: input.sceneId ?? undefined,
      momentId: input.momentId ?? undefined,
      recencyHalfLifeMs: this.defaults.recencyHalfLifeMs,
      anchorRefs: profileSummary.memoryAnchorIds,
      relationshipRefs: input.relationshipId ? [input.relationshipId] : [],
      manualBoostByDocumentId,
    });

    const allDocuments = this.listDocuments();
    const documentMatches = rankEmbeddingDocuments(documentQuery, allDocuments);
    const documentReceipt = createEmbeddingSearchReceipt(
      documentQuery,
      documentMatches,
      allDocuments.length,
      [
        `intent=${intent}`,
        `reason=${reason}`,
        `channel=${activeChannel}`,
        `profileAnchors=${profileSummary.memoryAnchorIds.length}`,
      ],
    );

    const anchorQuery = createMemoryAnchorQuery({
      idSeed: `${requestId}:anchors`,
      intent,
      roomId: input.roomId ?? undefined,
      channelId: activeChannel,
      runId: input.runId ?? undefined,
      sceneId: input.sceneId ?? undefined,
      momentId: input.momentId ?? undefined,
      actorId: input.actorId ?? undefined,
      actorPersonaId: input.actorPersonaId ?? undefined,
      relationshipId: input.relationshipId ?? undefined,
      kinds: ensureArray(input.anchorKinds),
      requiredTags,
      blockedTags,
      minimumFinalSalience: clamp01(input.minimumAnchorSalience ?? this.defaults.defaultMinimumAnchorSalience),
      topK: Math.max(1, input.topKAnchors ?? this.defaults.defaultTopKAnchors),
    });
    const allAnchors = this.listAnchors();
    const anchorMatches = rankMemoryAnchors(anchorQuery, allAnchors)
      .map((match) => ({
        ...match,
        retrievalScore: clamp01(match.retrievalScore + this.computeAnchorContextBoost(match.anchorId, input, featureSummary, profileSummary)),
      }))
      .sort((left, right) => right.retrievalScore - left.retrievalScore)
      .slice(0, anchorQuery.topK)
      .map((match, index) => Object.freeze({ ...match, rank: index + 1 }));
    const anchorReceipt = createMemoryAnchorReceipt(
      anchorQuery,
      anchorMatches,
      allAnchors.length,
      [
        `intent=${intent}`,
        `reason=${reason}`,
        `required=${requiredTags.join(',') || 'none'}`,
      ],
    );

    const selectedDocuments = Object.freeze(
      documentMatches
        .map((match) => this.documents.get(match.documentId))
        .filter((value): value is ConversationEmbeddingDocument => Boolean(value)),
    );
    const selectedAnchors = Object.freeze(
      anchorMatches
        .map((match) => this.anchors.get(match.anchorId))
        .filter((value): value is MemoryAnchor => Boolean(value)),
    );

    const documentPreviews = Object.freeze(selectedDocuments.map((value) => createEmbeddingPreview(value)));
    const anchorPreviews = Object.freeze(selectedAnchors.map((value) => createMemoryAnchorPreview(value)));
    const blendedPreviews = Object.freeze(
      dedupePreviewIds([
        ...documentPreviews,
        ...anchorMatches.map((value) => convertMemoryAnchorMatchToEmbeddingPreview(value)),
      ]).slice(0, Math.max(documentQuery.topK, anchorQuery.topK)),
    );

    const carryoverWindow = this.buildCarryoverWindow(requestId, input, selectedAnchors);
    const continuityLinks = Object.freeze(
      createAnchorLinksFromMatches(anchorMatches).slice(0, this.defaults.maxAnchorLinks),
    );
    this.totals.retrievals += 1;
    this.totals.documentHits += documentMatches.length;
    this.totals.anchorHits += anchorMatches.length;
    const durationMs = Math.max(0, this.clock.now() - startedAt);
    const summary = this.buildResultSummary(queryText, documentMatches, anchorMatches);
    const debugNotes = Object.freeze(
      dedupeStrings([
        `query=${truncate(queryText, 96)}`,
        `documents=${documentMatches.length}`,
        `anchors=${anchorMatches.length}`,
        `window=${carryoverWindow?.id ?? 'none'}`,
        ...documentMatches.slice(0, 3).map((value) => summarizeEmbeddingMatch(value)),
        ...anchorMatches.slice(0, 3).map((value) => summarizeMemoryAnchorMatch(value)),
      ]).slice(0, this.defaults.maxDebugNotes),
    );
    this.telemetry.captureRetrievalCompleted?.(reason, requestId, durationMs, summary);

    return Object.freeze({
      requestId,
      createdAtMs: startedAt as UnixMs,
      source:
        input.queryVector?.length || profileSummary.memoryAnchorIds.length
          ? 'LOCAL_WITH_PROFILE_HINTS'
          : 'LOCAL_ONLY',
      reason,
      intent,
      queryText,
      documentQuery,
      anchorQuery,
      documentMatches: Object.freeze(documentMatches),
      anchorMatches: Object.freeze(anchorMatches),
      documentReceipt,
      anchorReceipt,
      documentPreviews,
      anchorPreviews,
      blendedPreviews,
      selectedDocuments,
      selectedAnchors,
      carryoverWindow,
      continuityLinks,
      summary,
      debugNotes,
    });
  }

  public preview(input: ChatMemoryRetrievalInput): readonly EmbeddingPreview[] {
    return this.retrieve({
      ...input,
      reason: input.reason ?? 'PREVIEW_LOOKUP',
    }).blendedPreviews;
  }

  public listDocuments(): readonly ConversationEmbeddingDocument[] {
    return Object.freeze(
      [...this.documents.values()].sort((left, right) => right.createdAtMs - left.createdAtMs),
    );
  }

  public listAnchors(): readonly MemoryAnchor[] {
    return Object.freeze(
      [...this.anchors.values()].sort((left, right) => right.salience.final - left.salience.final),
    );
  }

  public listWindows(): readonly MemoryAnchorWindow[] {
    return Object.freeze(
      [...this.windows.values()].sort((left, right) => right.openedAtMs - left.openedAtMs),
    );
  }

  public getPublicSnapshot(): ChatMemoryRetrievalClientPublicSnapshot {
    return Object.freeze({
      moduleName: CHAT_MEMORY_RETRIEVAL_CLIENT_MODULE_NAME,
      moduleVersion: CHAT_MEMORY_RETRIEVAL_CLIENT_VERSION,
      model: this.defaults.model,
      documentCount: this.documents.size,
      anchorCount: this.anchors.size,
      windowCount: this.windows.size,
      totals: Object.freeze({ ...this.totals }),
    });
  }

  public serialize(): ChatMemoryRetrievalClientSerializedState {
    return Object.freeze({
      createdAtMs: this.createdAtMs,
      updatedAtMs: this.updatedAtMs,
      documents: this.listDocuments(),
      anchors: this.listAnchors(),
      windows: this.listWindows(),
    });
  }

  public hydrate(snapshot: ChatMemoryRetrievalClientSerializedState): void {
    this.documents.clear();
    this.anchors.clear();
    this.windows.clear();
    for (const document of snapshot.documents ?? []) this.documents.set(document.id, document);
    for (const anchor of snapshot.anchors ?? []) this.anchors.set(anchor.id, anchor);
    for (const window of snapshot.windows ?? []) this.windows.set(window.id, window);
    this.updatedAtMs = snapshot.updatedAtMs;
  }

  public clear(): void {
    this.documents.clear();
    this.anchors.clear();
    this.windows.clear();
    this.updatedAtMs = this.clock.now() as UnixMs;
    this.persist();
  }

  public prune(nowMs = this.clock.now()): void {
    const documents = this.listDocuments();
    const keptDocuments = documents.slice(0, this.defaults.maxDocuments);
    this.documents.clear();
    for (const document of keptDocuments) this.documents.set(document.id, document);

    const anchors = this.listAnchors().filter((anchor) => {
      const ageMs = Math.max(0, nowMs - anchor.formation.updatedAtMs);
      const decayBoost = ageMs > this.defaults.confidenceHalfLifeMs * 6 ? -0.08 : 0;
      return clamp01(anchor.salience.final + decayBoost) >= this.defaults.defaultMinimumAnchorSalience * 0.5;
    }).slice(0, this.defaults.maxAnchors);
    this.anchors.clear();
    for (const anchor of anchors) this.anchors.set(anchor.id, anchor);

    const validAnchorIds = new Set(anchors.map((value) => value.id));
    const windows = this.listWindows()
      .map((window) => ({
        ...window,
        anchorIds: Object.freeze(window.anchorIds.filter((value) => validAnchorIds.has(value))),
      }))
      .filter((window) => window.anchorIds.length)
      .slice(0, this.defaults.maxWindows);
    this.windows.clear();
    for (const window of windows) this.windows.set(window.id, window);
    this.updatedAtMs = nowMs as UnixMs;
    this.totals.prunes += 1;
    this.persist();
  }

  private enforceDocumentCap(): void {
    if (this.documents.size <= this.defaults.maxDocuments) return;
    const ordered = this.listDocuments();
    const keep = ordered.slice(0, this.defaults.maxDocuments);
    this.documents.clear();
    for (const document of keep) this.documents.set(document.id, document);
  }

  private enforceAnchorCap(): void {
    if (this.anchors.size <= this.defaults.maxAnchors) return;
    const ordered = this.listAnchors();
    const keep = ordered.slice(0, this.defaults.maxAnchors);
    this.anchors.clear();
    for (const anchor of keep) this.anchors.set(anchor.id, anchor);
  }

  private writeWindow(
    document: ConversationEmbeddingDocument,
    anchor: MemoryAnchor | null,
  ): void {
    const windowSeed = `${document.channelContext.runId ?? 'run'}:${document.channelContext.sceneId ?? 'scene'}:${document.channelContext.momentId ?? 'moment'}:${document.channelContext.channelId ?? 'GLOBAL'}`;
    const relatedAnchors = anchor ? [anchor] : [];
    const existing = [...this.windows.values()].find(
      (value) =>
        value.runId === document.channelContext.runId &&
        value.sceneId === document.channelContext.sceneId &&
        value.momentId === document.channelContext.momentId &&
        value.channelId === document.channelContext.channelId,
    );
    const anchorIds = dedupeStrings([
      ...(existing?.anchorIds ?? []),
      ...relatedAnchors.map((value) => value.id),
    ]);
    const anchorObjects = anchorIds
      .map((value) => this.anchors.get(value))
      .filter((value): value is MemoryAnchor => Boolean(value));
    const next = groupMemoryAnchorsIntoWindow(
      windowSeed,
      anchorObjects.slice(0, this.defaults.defaultWindowAnchorCount),
      {
        openedAtMs: existing?.openedAtMs ?? document.createdAtMs,
        closedAtMs: document.updatedAtMs,
        runId: document.channelContext.runId,
        sceneId: document.channelContext.sceneId,
        momentId: document.channelContext.momentId,
        roomId: document.channelContext.roomId,
        channelId: document.channelContext.channelId,
      },
    );
    this.windows.set(next.id, next);
    if (this.windows.size > this.defaults.maxWindows) {
      const keep = this.listWindows().slice(0, this.defaults.maxWindows);
      this.windows.clear();
      for (const window of keep) this.windows.set(window.id, window);
    }
  }

  private buildDocumentBoostMap(
    input: ChatMemoryRetrievalInput,
    profileSummary: StableProfileSummary,
    featureSummary: StableFeatureSummary,
  ): Record<string, number> {
    const boost: Record<string, number> = {};
    const activeDocs = this.listDocuments();
    const anchorHintIds = new Set(profileSummary.memoryAnchorIds);
    for (const document of activeDocs) {
      let score = 0;
      if (document.channelContext.relationshipId && document.channelContext.relationshipId === input.relationshipId) {
        score += this.defaults.directRelationshipBoost;
      }
      if (
        document.channelContext.actorPersonaId &&
        input.actorPersonaId &&
        document.channelContext.actorPersonaId === input.actorPersonaId
      ) {
        score += this.defaults.samePersonaBoost;
      }
      if (document.channelContext.channelId === 'DEAL_ROOM' && toVisibleChannel(input.channelId) === 'DEAL_ROOM') {
        score += this.defaults.dealRoomBoost;
      }
      if (featureSummary.rescueNeed01 > 0.6 && document.tags.relationshipTags.includes('helper')) {
        score += this.defaults.rescueBoost;
      }
      if (document.tags.continuityTags.some((value) => value.includes('comeback'))) {
        score += this.defaults.comebackBoost;
      }
      if (document.tags.continuityTags.some((value) => value.includes('collapse'))) {
        score += this.defaults.collapseBoost;
      }
      if (document.anchorRefs.some((value) => anchorHintIds.has(value))) {
        score += this.defaults.manualBoostFromLearningProfile;
      }
      if (score > 0) {
        boost[document.id] = Number(score.toFixed(6));
      }
    }
    return boost;
  }

  private computeAnchorContextBoost(
    anchorId: string,
    input: ChatMemoryRetrievalInput,
    featureSummary: StableFeatureSummary,
    profileSummary: StableProfileSummary,
  ): number {
    const anchor = this.anchors.get(anchorId);
    if (!anchor) return 0;
    let boost = 0;
    if (anchor.continuity.unresolved) boost += this.defaults.unresolvedAnchorBoost;
    if (input.relationshipId && anchor.relationshipRefs.includes(input.relationshipId)) {
      boost += this.defaults.directRelationshipBoost;
    }
    if (input.actorPersonaId && anchor.subject.actorPersonaId === input.actorPersonaId) {
      boost += this.defaults.samePersonaBoost;
    }
    if (profileSummary.memoryAnchorIds.includes(anchor.id)) {
      boost += this.defaults.manualBoostFromLearningProfile;
    }
    if (featureSummary.rescueNeed01 > 0.6 && anchor.kind === 'HELPER_SAVE') {
      boost += this.defaults.rescueBoost;
    }
    return boost;
  }

  private buildCarryoverWindow(
    seed: string,
    input: ChatMemoryRetrievalInput,
    anchors: readonly MemoryAnchor[],
  ): MemoryAnchorWindow | null {
    if (!anchors.length) return null;
    return groupMemoryAnchorsIntoWindow(
      `${seed}:carryover`,
      anchors.slice(0, this.defaults.defaultWindowAnchorCount),
      {
        openedAtMs: this.clock.now(),
        runId: input.runId ?? undefined,
        sceneId: input.sceneId ?? undefined,
        momentId: input.momentId ?? undefined,
        roomId: input.roomId ?? undefined,
        channelId: toVisibleChannel(input.channelId),
      },
    );
  }

  private buildResultSummary(
    queryText: string,
    documentMatches: readonly EmbeddingSearchMatch[],
    anchorMatches: readonly MemoryAnchorMatch[],
  ): string {
    const topDocument = documentMatches[0];
    const topAnchor = anchorMatches[0];
    return truncate(
      [
        `query ${queryText}`,
        topAnchor ? `anchor ${topAnchor.headline}` : 'anchor none',
        topDocument ? `document ${topDocument.summary}` : 'document none',
      ].join(' | '),
      220,
    );
  }

  private persist(): void {
    this.persistence?.save?.(this.serialize());
  }
}

function dedupePreviewIds(
  values: readonly EmbeddingPreview[],
): readonly EmbeddingPreview[] {
  const seen = new Set<string>();
  const next: EmbeddingPreview[] = [];
  for (const value of values) {
    if (seen.has(value.id)) continue;
    seen.add(value.id);
    next.push(value);
  }
  return Object.freeze(next);
}

/* ========================================================================== */
/* MARK: Public helpers                                                       */
/* ========================================================================== */

export function createMemoryRetrievalClient(
  options: ChatMemoryRetrievalClientOptions = {},
): MemoryRetrievalClient {
  return new MemoryRetrievalClient(options);
}

export function retrieveChatMemory(
  client: ChatMemoryRetrievalClientPort,
  input: ChatMemoryRetrievalInput,
): ChatMemoryRetrievalResult {
  return client.retrieve(input);
}

export function previewChatMemory(
  client: ChatMemoryRetrievalClientPort,
  input: ChatMemoryRetrievalInput,
): readonly EmbeddingPreview[] {
  return client.preview(input);
}
