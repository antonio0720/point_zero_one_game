
// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/intelligence/dl/SequenceMemoryClient.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT DL SEQUENCE MEMORY CLIENT
 * FILE: pzo-web/src/engines/chat/intelligence/dl/SequenceMemoryClient.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * This module is the frontend advisory sequence-memory lane for the unified
 * chat intelligence stack.
 *
 * It exists because the current Point Zero One chat doctrine is already moving
 * beyond "messages in a feed" and toward:
 * - remembered rivalry,
 * - helper continuity,
 * - negotiation callbacks,
 * - comeback / collapse memory,
 * - scene carryover between channels and modes,
 * - retrieval-backed local ranking while backend truth is still in flight.
 *
 * This is intentionally NOT a generic vector database wrapper.
 *
 * The client preserves the architecture split already locked for this repo:
 * - frontend chat brain lives in /pzo-web/src/engines/chat,
 * - frontend UI shell lives in /pzo-web/src/components/chat,
 * - backend truth lives in /backend/src/game/engine/chat,
 * - server transport lives in /pzo-server/src/chat,
 * - shared learning contracts live under /shared/contracts/chat/learning.
 *
 * Frontend sequence memory therefore owns:
 * - fast, local, replay-safe advisory memory anchors,
 * - rolling sequence windows,
 * - semantic retrieval during transport delay,
 * - helper / hater / negotiation callback support,
 * - continuity hints for ranking and scene planning,
 * - deterministic fallback memory behavior when remote inference is absent.
 *
 * It does NOT own:
 * - transcript truth,
 * - permanent authoritative memory,
 * - moderation truth,
 * - backend retrieval ranking,
 * - cross-session durable policy decisions.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import type {
  ChatLearningBridgePublicSnapshot,
} from '../ChatLearningBridge';

import type {
  ChatAffectSnapshot,
  ChatFeatureSnapshot,
  ChatLearningProfile,
  ChatMessage,
  ChatMemoryAnchorId,
  ChatVisibleChannel,
  JsonObject,
  Nullable,
  Score01,
  UnixMs,
} from '../../types';

import {
  type ChatEmbeddingClientPort,
  type ChatEmbeddingInput,
  type ChatEmbeddingTelemetryPort,
  type ChatEmbeddingVectorRecord,
  buildDeterministicMessageEmbedding,
  compareEmbeddingVectors,
  createMessageEmbeddingClient,
} from './MessageEmbeddingClient';

import {
  type ChatDialogueIntent,
  type ChatDialogueIntentEncoderPort,
  type ChatDialogueIntentEncodingInput,
  type ChatDialogueIntentEncodingResult,
  createDialogueIntentEncoder,
} from './DialogueIntentEncoder';

import {
  type ChatConversationPhase,
  type ChatConversationStateEncoderPort,
  type ChatConversationStateEncodingInput,
  type ChatConversationStateEncodingResult,
  createConversationStateEncoder,
} from './ConversationStateEncoder';

/* ========================================================================== */
/* MARK: Module constants                                                     */
/* ========================================================================== */

export const CHAT_SEQUENCE_MEMORY_CLIENT_MODULE_NAME =
  'PZO_CHAT_SEQUENCE_MEMORY_CLIENT' as const;

export const CHAT_SEQUENCE_MEMORY_CLIENT_VERSION =
  '2026.03.13-sequence-memory-client.v1' as const;

export const CHAT_SEQUENCE_MEMORY_CLIENT_RUNTIME_LAWS = Object.freeze([
  'Sequence memory is advisory, local-first, and replay-safe.',
  'Frontend memory preserves continuity quickly; backend memory preserves truth durably.',
  'Not every message deserves a durable anchor; salience is mandatory.',
  'Helper, hater, negotiation, rescue, and legend moments must remain distinguishable.',
  'Semantic retrieval must degrade gracefully during transport loss.',
  'Memory recall must remain explainable enough to debug.',
  'Sequence windows matter more than isolated messages when continuity is the goal.',
  'Recall may influence ranking and pacing, but it may not invent transcript truth.',
] as const);

export const CHAT_SEQUENCE_MEMORY_CLIENT_DEFAULTS = Object.freeze({
  maxEntries: 768,
  maxEntriesPerSequence: 48,
  maxEntriesPerAnchorFamily: 16,
  maxRecentMessagesForWrite: 12,
  maxRecentMessagesForRecallState: 14,
  maxRecallResults: 8,
  maxNeighborResults: 4,
  maxTagCount: 18,
  maxTokenCount: 96,
  maxSummaryChars: 260,
  maxPreviewChars: 160,
  maxSequenceSummaryChars: 420,
  maxRelatedAnchorIds: 8,
  maxEventNames: 10,
  writeDedupeWindowMs: 8_000,
  writeRepeatPenaltyHalfLifeMs: 90_000,
  recallTimeDecayHalfLifeMs: 7 * 60 * 1_000,
  touchDecayHalfLifeMs: 2 * 60 * 1_000,
  sequenceContinuityHalfLifeMs: 10 * 60 * 1_000,
  hardPruneAgeMs: 45 * 60 * 1_000,
  staleSequenceAgeMs: 15 * 60 * 1_000,
  minAnchorSalience01: 0.46,
  strongAnchorSalience01: 0.68,
  legendAnchorSalience01: 0.82,
  semanticWeight: 0.29,
  salienceWeight: 0.16,
  recencyWeight: 0.12,
  continuityWeight: 0.10,
  roleWeight: 0.06,
  channelWeight: 0.06,
  purposeWeight: 0.06,
  eventWeight: 0.05,
  sequenceWeight: 0.05,
  emotionalWeight: 0.05,
  intentWeight: 0.05,
  phaseWeight: 0.05,
  repetitionPenaltyWeight: 0.10,
  helperCallbackBoost: 0.15,
  haterCallbackBoost: 0.15,
  negotiationCallbackBoost: 0.16,
  rescueCallbackBoost: 0.18,
  legendCallbackBoost: 0.18,
  postRunReflectionBoost: 0.14,
  sequenceNeighborBoost: 0.10,
  crossChannelPenalty: 0.06,
  deterministicVectorDimensions: 192,
  enableIntentEncodingOnWrite: true,
  enableConversationStateOnWrite: true,
  enableSemanticRecall: true,
  enableNeighborExpansion: true,
  enableHardPrune: true,
  enableCompression: true,
  requestPrefix: 'chat-sequence-memory',
} as const);

const DEFAULT_CHANNEL: ChatVisibleChannel = 'GLOBAL';
const NO_CHANNELS: readonly ChatVisibleChannel[] = Object.freeze([
  'GLOBAL',
  'SYNDICATE',
  'DEAL_ROOM',
  'LOBBY',
] as const);

const HATER_ROLE_KEYS = Object.freeze([
  'HATER',
  'BOT',
  'ENEMY',
  'RIVAL',
  'LIQUIDATOR',
  'PREDATOR',
] as const);

const HELPER_ROLE_KEYS = Object.freeze([
  'HELPER',
  'ALLY',
  'GUIDE',
  'MENTOR',
  'RESCUE',
] as const);

const SYSTEM_ROLE_KEYS = Object.freeze([
  'SYSTEM',
  'GAME',
  'ADMIN',
  'MODERATOR',
  'NARRATOR',
] as const);

const DEAL_ROLE_KEYS = Object.freeze([
  'DEALMAKER',
  'BROKER',
  'NEGOTIATOR',
  'TRADER',
] as const);

const LEGEND_EVENT_KEYS = Object.freeze([
  'legend',
  'sovereignty',
  'perfect_counter',
  'miracle_rescue',
  'last_second',
] as const);

const RESCUE_EVENT_KEYS = Object.freeze([
  'rescue',
  'save',
  'assist',
  'helper',
  'recovery',
] as const);

const NEGOTIATION_EVENT_KEYS = Object.freeze([
  'deal',
  'offer',
  'counter',
  'negotiation',
  'bluff',
] as const);

/* ========================================================================== */
/* MARK: Public contracts                                                     */
/* ========================================================================== */

export type ChatSequenceMemoryRole =
  | 'PLAYER'
  | 'HELPER'
  | 'HATER'
  | 'SYSTEM'
  | 'AMBIENT'
  | 'ALLY'
  | 'RIVAL'
  | 'DEALMAKER'
  | 'NARRATOR'
  | 'UNKNOWN';

export type ChatSequenceMemoryKind =
  | 'MESSAGE'
  | 'EVENT'
  | 'STATE'
  | 'RESCUE'
  | 'NEGOTIATION'
  | 'RIVALRY'
  | 'LEGEND'
  | 'POST_RUN'
  | 'SCENE'
  | 'OTHER';

export type ChatSequenceMemoryScope =
  | 'LOCAL'
  | 'ROOM'
  | 'RUN'
  | 'MODE'
  | 'PLAYER'
  | 'GLOBAL';

export type ChatSequenceMemoryProvenance =
  | 'LIVE_WRITE'
  | 'REPLAY_IMPORT'
  | 'LEGACY_IMPORT'
  | 'STATE_COMPRESSION'
  | 'RANKER_FEEDBACK'
  | 'SYSTEM_SYNTHESIS';

export type ChatSequenceSalienceBand =
  | 'TRACE'
  | 'LIGHT'
  | 'MEDIUM'
  | 'HEAVY'
  | 'LEGEND';

export type ChatSequenceCompressionReason =
  | 'PRUNE'
  | 'DEDUPE'
  | 'SEQUENCE_COMPRESSION'
  | 'AGE_OUT'
  | 'CAP_ENFORCEMENT';

export type ChatSequenceRecallPurpose =
  | 'RANKING'
  | 'HELPER'
  | 'HATER'
  | 'RESCUE'
  | 'NEGOTIATION'
  | 'POST_RUN'
  | 'REPLAY'
  | 'UI_PREVIEW'
  | 'DEBUG'
  | 'OTHER';

export interface ChatSequenceMemoryTelemetryPort
  extends ChatEmbeddingTelemetryPort {
  emit?(event: string, payload: JsonObject): unknown;
}

export interface ChatSequenceMemoryEntry {
  readonly entryId: string;
  readonly anchorId: ChatMemoryAnchorId;
  readonly sequenceId: string;
  readonly sequenceIndex: number;
  readonly role: ChatSequenceMemoryRole;
  readonly kind: ChatSequenceMemoryKind;
  readonly scope: ChatSequenceMemoryScope;
  readonly provenance: ChatSequenceMemoryProvenance;
  readonly activeChannel: ChatVisibleChannel;
  readonly channels: readonly ChatVisibleChannel[];
  readonly textPreview: string;
  readonly summary: string;
  readonly normalizedText: string;
  readonly semanticVector: readonly number[];
  readonly semanticVectorRecord: ChatEmbeddingVectorRecord;
  readonly intent: Nullable<ChatDialogueIntentEncodingResult>;
  readonly state: Nullable<ChatConversationStateEncodingResult>;
  readonly tokens: readonly string[];
  readonly tags: readonly string[];
  readonly eventNames: readonly string[];
  readonly relatedAnchorIds: readonly ChatMemoryAnchorId[];
  readonly salience01: Score01;
  readonly salienceBand: ChatSequenceSalienceBand;
  readonly emotionalWeight01: Score01;
  readonly sequenceWeight01: Score01;
  readonly continuityWeight01: Score01;
  readonly repeatPenalty01: Score01;
  readonly createdAtMs: UnixMs;
  readonly lastTouchedAtMs: UnixMs;
  readonly useCount: number;
  readonly roomId?: string;
  readonly runId?: string;
  readonly modeId?: string;
  readonly playerUserId?: string;
  readonly senderUserId?: string;
  readonly metadata?: JsonObject;
}

export interface ChatSequenceMemoryWriteInput {
  readonly requestId?: string;
  readonly now?: UnixMs | number;
  readonly message?: Partial<ChatMessage> | null;
  readonly text?: string | null;
  readonly summary?: string | null;
  readonly role?: ChatSequenceMemoryRole | string | null;
  readonly kind?: ChatSequenceMemoryKind | string | null;
  readonly scope?: ChatSequenceMemoryScope | string | null;
  readonly activeChannel?: ChatVisibleChannel | null;
  readonly channels?: readonly ChatVisibleChannel[];
  readonly recentMessages?: readonly ChatMessage[];
  readonly recentEventNames?: readonly string[];
  readonly featureSnapshot?: Nullable<ChatFeatureSnapshot>;
  readonly learningProfile?: Nullable<ChatLearningProfile>;
  readonly bridgeSnapshot?: Nullable<ChatLearningBridgePublicSnapshot>;
  readonly affectSnapshot?: Nullable<ChatAffectSnapshot>;
  readonly roomId?: string;
  readonly runId?: string;
  readonly modeId?: string;
  readonly playerUserId?: string;
  readonly senderUserId?: string;
  readonly sequenceIdHint?: string;
  readonly relatedAnchorIds?: readonly (ChatMemoryAnchorId | string)[];
  readonly metadata?: JsonObject;
  readonly provenance?: ChatSequenceMemoryProvenance;
  readonly skipIntentEncode?: boolean;
  readonly skipStateEncode?: boolean;
}

export interface ChatSequenceMemoryStoreSnapshot {
  readonly moduleName: typeof CHAT_SEQUENCE_MEMORY_CLIENT_MODULE_NAME;
  readonly moduleVersion: typeof CHAT_SEQUENCE_MEMORY_CLIENT_VERSION;
  readonly exportedAtMs: UnixMs;
  readonly entries: readonly ChatSequenceMemoryEntry[];
}

export interface ChatSequenceMemoryMatchBreakdown {
  readonly semantic01: Score01;
  readonly salience01: Score01;
  readonly recency01: Score01;
  readonly continuity01: Score01;
  readonly roleFit01: Score01;
  readonly channelFit01: Score01;
  readonly purposeFit01: Score01;
  readonly phaseFit01: Score01;
  readonly intentFit01: Score01;
  readonly eventFit01: Score01;
  readonly sequenceFit01: Score01;
  readonly emotionalFit01: Score01;
  readonly repetitionPenalty01: Score01;
  readonly explanation: string;
}

export interface ChatSequenceMemoryMatch {
  readonly entry: ChatSequenceMemoryEntry;
  readonly score01: Score01;
  readonly similarity01: Score01;
  readonly breakdown: ChatSequenceMemoryMatchBreakdown;
  readonly neighborEntries: readonly ChatSequenceMemoryEntry[];
}

export interface ChatSequenceMemoryRecallInput {
  readonly requestId?: string;
  readonly now?: UnixMs | number;
  readonly purpose?: ChatSequenceRecallPurpose;
  readonly queryText?: string | null;
  readonly queryMessage?: Partial<ChatMessage> | null;
  readonly currentIntent?: Nullable<ChatDialogueIntentEncodingResult>;
  readonly currentState?: Nullable<ChatConversationStateEncodingResult>;
  readonly activeChannel?: ChatVisibleChannel | null;
  readonly visibleChannel?: ChatVisibleChannel | null;
  readonly recentMessages?: readonly ChatMessage[];
  readonly featureSnapshot?: Nullable<ChatFeatureSnapshot>;
  readonly learningProfile?: Nullable<ChatLearningProfile>;
  readonly bridgeSnapshot?: Nullable<ChatLearningBridgePublicSnapshot>;
  readonly affectSnapshot?: Nullable<ChatAffectSnapshot>;
  readonly desiredRoles?: readonly ChatSequenceMemoryRole[];
  readonly desiredKinds?: readonly ChatSequenceMemoryKind[];
  readonly requiredTags?: readonly string[];
  readonly recentEventNames?: readonly string[];
  readonly roomId?: string;
  readonly runId?: string;
  readonly modeId?: string;
  readonly playerUserId?: string;
  readonly limit?: number;
  readonly minSalience01?: Score01 | number;
  readonly includeNeighbors?: boolean;
  readonly metadata?: JsonObject;
}

export interface ChatSequenceMemoryRecallResult {
  readonly requestId: string;
  readonly recalledAtMs: UnixMs;
  readonly purpose: ChatSequenceRecallPurpose;
  readonly querySummary: string;
  readonly queryVector: readonly number[];
  readonly matches: readonly ChatSequenceMemoryMatch[];
  readonly diagnostics: Readonly<{
    candidateCount: number;
    filteredCount: number;
    prunedBySalience: number;
    prunedByScope: number;
    prunedByRole: number;
    prunedByKind: number;
    storeSize: number;
    activeChannel: ChatVisibleChannel;
  }>;
}

export interface ChatSequenceMemoryPublicSnapshot {
  readonly moduleName: typeof CHAT_SEQUENCE_MEMORY_CLIENT_MODULE_NAME;
  readonly moduleVersion: typeof CHAT_SEQUENCE_MEMORY_CLIENT_VERSION;
  readonly totals: Readonly<{
    writes: number;
    recalls: number;
    prunes: number;
    compressions: number;
    hardPrunes: number;
    touchUpdates: number;
  }>;
  readonly storeSize: number;
  readonly sequenceCount: number;
  readonly anchorCount: number;
}

export interface ChatSequenceMemoryClientOptions {
  readonly defaults?: Partial<typeof CHAT_SEQUENCE_MEMORY_CLIENT_DEFAULTS>;
  readonly embeddingClient?: Nullable<ChatEmbeddingClientPort>;
  readonly intentEncoder?: Nullable<ChatDialogueIntentEncoderPort>;
  readonly conversationStateEncoder?: Nullable<ChatConversationStateEncoderPort>;
  readonly telemetry?: Nullable<ChatSequenceMemoryTelemetryPort>;
  readonly requestPrefix?: string;
  readonly initialSnapshot?: Nullable<ChatSequenceMemoryStoreSnapshot>;
}

export interface ChatSequenceMemoryClientPort {
  remember(
    input: ChatSequenceMemoryWriteInput,
  ): Promise<ChatSequenceMemoryEntry>;
  rememberMany(
    inputs: readonly ChatSequenceMemoryWriteInput[],
  ): Promise<readonly ChatSequenceMemoryEntry[]>;
  recall(
    input: ChatSequenceMemoryRecallInput,
  ): Promise<ChatSequenceMemoryRecallResult>;
  touch(anchorId: ChatMemoryAnchorId | string, now?: UnixMs | number): Nullable<ChatSequenceMemoryEntry>;
  get(anchorId: ChatMemoryAnchorId | string): Nullable<ChatSequenceMemoryEntry>;
  getPublicSnapshot(): ChatSequenceMemoryPublicSnapshot;
  exportSnapshot(now?: UnixMs | number): ChatSequenceMemoryStoreSnapshot;
  importSnapshot(snapshot: ChatSequenceMemoryStoreSnapshot): void;
  prune(now?: UnixMs | number): Readonly<{
    removedEntryIds: readonly string[];
    reason: ChatSequenceCompressionReason;
  }>;
  clear(): void;
}

/* ========================================================================== */
/* MARK: Internal contracts                                                   */
/* ========================================================================== */

interface PreparedWriteInput {
  readonly requestId: string;
  readonly now: UnixMs;
  readonly text: string;
  readonly summary: string;
  readonly role: ChatSequenceMemoryRole;
  readonly kind: ChatSequenceMemoryKind;
  readonly scope: ChatSequenceMemoryScope;
  readonly activeChannel: ChatVisibleChannel;
  readonly channels: readonly ChatVisibleChannel[];
  readonly recentMessages: readonly ChatMessage[];
  readonly recentEventNames: readonly string[];
  readonly roomId?: string;
  readonly runId?: string;
  readonly modeId?: string;
  readonly playerUserId?: string;
  readonly senderUserId?: string;
  readonly featureSnapshot: Nullable<ChatFeatureSnapshot>;
  readonly learningProfile: Nullable<ChatLearningProfile>;
  readonly bridgeSnapshot: Nullable<ChatLearningBridgePublicSnapshot>;
  readonly affectSnapshot: Nullable<ChatAffectSnapshot>;
  readonly relatedAnchorIds: readonly ChatMemoryAnchorId[];
  readonly provenance: ChatSequenceMemoryProvenance;
  readonly metadata?: JsonObject;
  readonly sequenceIdHint?: string;
  readonly skipIntentEncode: boolean;
  readonly skipStateEncode: boolean;
  readonly message: Nullable<Partial<ChatMessage>>;
}

interface PreparedRecallInput {
  readonly requestId: string;
  readonly now: UnixMs;
  readonly purpose: ChatSequenceRecallPurpose;
  readonly queryText: string;
  readonly activeChannel: ChatVisibleChannel;
  readonly recentMessages: readonly ChatMessage[];
  readonly currentIntent: Nullable<ChatDialogueIntentEncodingResult>;
  readonly currentState: Nullable<ChatConversationStateEncodingResult>;
  readonly featureSnapshot: Nullable<ChatFeatureSnapshot>;
  readonly learningProfile: Nullable<ChatLearningProfile>;
  readonly bridgeSnapshot: Nullable<ChatLearningBridgePublicSnapshot>;
  readonly affectSnapshot: Nullable<ChatAffectSnapshot>;
  readonly desiredRoles: readonly ChatSequenceMemoryRole[];
  readonly desiredKinds: readonly ChatSequenceMemoryKind[];
  readonly requiredTags: readonly string[];
  readonly recentEventNames: readonly string[];
  readonly roomId?: string;
  readonly runId?: string;
  readonly modeId?: string;
  readonly playerUserId?: string;
  readonly limit: number;
  readonly minSalience01: Score01;
  readonly includeNeighbors: boolean;
  readonly metadata?: JsonObject;
  readonly queryMessage: Nullable<Partial<ChatMessage>>;
}

interface MutableTotals {
  writes: number;
  recalls: number;
  prunes: number;
  compressions: number;
  hardPrunes: number;
  touchUpdates: number;
}

interface CandidateFilterDiagnostics {
  prunedBySalience: number;
  prunedByScope: number;
  prunedByRole: number;
  prunedByKind: number;
}

interface SequenceWindow {
  readonly sequenceId: string;
  readonly entryIds: readonly string[];
  readonly createdAtMs: UnixMs;
  readonly updatedAtMs: UnixMs;
  readonly channel: ChatVisibleChannel;
  readonly roleHints: readonly ChatSequenceMemoryRole[];
  readonly tagHints: readonly string[];
}

/* ========================================================================== */
/* MARK: Utility helpers                                                      */
/* ========================================================================== */

function asUnixMs(value: number): UnixMs {
  return Math.round(value) as UnixMs;
}

function clamp01(value: number): Score01 {
  if (!Number.isFinite(value)) return 0 as Score01;
  if (value <= 0) return 0 as Score01;
  if (value >= 1) return 1 as Score01;
  return value as Score01;
}

function normalizeScore01(value: number | undefined | null): Score01 {
  return clamp01(Number(value ?? 0));
}

function safeArray<T>(value: Nullable<readonly T[]>): readonly T[] {
  if (!Array.isArray(value)) return Object.freeze([]) as readonly T[];
  return value;
}

function normalizeText(value: Nullable<string>): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\s+/g, ' ')
    .replace(/\u0000/g, '')
    .trim();
}

function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  if (maxChars <= 1) return value.slice(0, Math.max(0, maxChars));
  return `${value.slice(0, maxChars - 1)}…`;
}

function uniqueStrings(values: readonly string[], limit = Number.MAX_SAFE_INTEGER): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = normalizeText(raw);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= limit) break;
  }
  return Object.freeze(out);
}

function toVisibleChannel(value: unknown): ChatVisibleChannel {
  const normalized = normalizeText(String(value ?? '')).toUpperCase();
  switch (normalized) {
    case 'GLOBAL':
      return 'GLOBAL';
    case 'SYNDICATE':
      return 'SYNDICATE';
    case 'DEAL_ROOM':
    case 'DEALROOM':
    case 'DEAL ROOM':
      return 'DEAL_ROOM';
    case 'LOBBY':
      return 'LOBBY';
    default:
      return DEFAULT_CHANNEL;
  }
}

function normalizeRole(value: unknown): ChatSequenceMemoryRole {
  const normalized = normalizeText(String(value ?? '')).toUpperCase();
  if (!normalized) return 'UNKNOWN';
  if (normalized === 'PLAYER' || normalized === 'USER' || normalized === 'SELF') return 'PLAYER';
  if (HELPER_ROLE_KEYS.includes(normalized as any)) return normalized === 'ALLY' ? 'ALLY' : 'HELPER';
  if (HATER_ROLE_KEYS.includes(normalized as any)) return normalized === 'RIVAL' ? 'RIVAL' : 'HATER';
  if (SYSTEM_ROLE_KEYS.includes(normalized as any)) return normalized === 'NARRATOR' ? 'NARRATOR' : 'SYSTEM';
  if (DEAL_ROLE_KEYS.includes(normalized as any)) return 'DEALMAKER';
  if (normalized === 'AMBIENT' || normalized === 'CROWD') return 'AMBIENT';
  if (normalized === 'ALLY') return 'ALLY';
  if (normalized === 'RIVAL') return 'RIVAL';
  if (normalized === 'DEALMAKER') return 'DEALMAKER';
  if (normalized === 'NARRATOR') return 'NARRATOR';
  return 'UNKNOWN';
}

function normalizeKind(value: unknown): ChatSequenceMemoryKind {
  const normalized = normalizeText(String(value ?? '')).toUpperCase().replace(/\s+/g, '_');
  switch (normalized) {
    case 'MESSAGE':
    case 'EVENT':
    case 'STATE':
    case 'RESCUE':
    case 'NEGOTIATION':
    case 'RIVALRY':
    case 'LEGEND':
    case 'POST_RUN':
    case 'SCENE':
      return normalized as ChatSequenceMemoryKind;
    default:
      return 'MESSAGE';
  }
}

function normalizeScope(value: unknown): ChatSequenceMemoryScope {
  const normalized = normalizeText(String(value ?? '')).toUpperCase();
  switch (normalized) {
    case 'LOCAL':
    case 'ROOM':
    case 'RUN':
    case 'MODE':
    case 'PLAYER':
    case 'GLOBAL':
      return normalized as ChatSequenceMemoryScope;
    default:
      return 'LOCAL';
  }
}

function normalizeProvenance(value: unknown): ChatSequenceMemoryProvenance {
  const normalized = normalizeText(String(value ?? '')).toUpperCase().replace(/\s+/g, '_');
  switch (normalized) {
    case 'LIVE_WRITE':
    case 'REPLAY_IMPORT':
    case 'LEGACY_IMPORT':
    case 'STATE_COMPRESSION':
    case 'RANKER_FEEDBACK':
    case 'SYSTEM_SYNTHESIS':
      return normalized as ChatSequenceMemoryProvenance;
    default:
      return 'LIVE_WRITE';
  }
}

function normalizePurpose(value: unknown): ChatSequenceRecallPurpose {
  const normalized = normalizeText(String(value ?? '')).toUpperCase().replace(/\s+/g, '_');
  switch (normalized) {
    case 'RANKING':
    case 'HELPER':
    case 'HATER':
    case 'RESCUE':
    case 'NEGOTIATION':
    case 'POST_RUN':
    case 'REPLAY':
    case 'UI_PREVIEW':
    case 'DEBUG':
      return normalized as ChatSequenceRecallPurpose;
    default:
      return 'OTHER';
  }
}

function nowOr(value: UnixMs | number | undefined | null): UnixMs {
  return asUnixMs(Number.isFinite(Number(value)) ? Number(value) : Date.now());
}

function topN<T>(values: readonly T[], limit: number): readonly T[] {
  if (limit <= 0) return Object.freeze([]) as readonly T[];
  return Object.freeze(values.slice(0, limit));
}

function stableHash(input: string): string {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(index);
  }
  return Math.abs(hash >>> 0).toString(36);
}

function tokenizeText(value: string, limit: number): readonly string[] {
  const parts = value
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]/g, ' ')
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return uniqueStrings(parts, limit);
}

function extractStringField(source: unknown, ...keys: readonly string[]): string {
  const obj = source as Record<string, unknown> | null | undefined;
  if (!obj || typeof obj !== 'object') return '';
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && normalizeText(value)) {
      return normalizeText(value);
    }
  }
  return '';
}

function extractArrayField(source: unknown, ...keys: readonly string[]): readonly string[] {
  const obj = source as Record<string, unknown> | null | undefined;
  if (!obj || typeof obj !== 'object') return Object.freeze([]);
  for (const key of keys) {
    const value = obj[key];
    if (Array.isArray(value)) {
      return uniqueStrings(
        value
          .filter((item): item is string => typeof item === 'string')
          .map((item) => normalizeText(item)),
      );
    }
  }
  return Object.freeze([]);
}

function buildTextPreview(text: string, fallbackSummary: string, maxChars: number): string {
  const preferred = normalizeText(text) || normalizeText(fallbackSummary);
  return truncateText(preferred, maxChars);
}

function inferMessageRole(message: Nullable<Partial<ChatMessage>>): ChatSequenceMemoryRole {
  const role = normalizeRole(
    extractStringField(message, 'role', 'senderRole', 'sourceRole', 'authorRole'),
  );
  if (role !== 'UNKNOWN') return role;

  const senderId = extractStringField(message, 'senderId', 'userId', 'authorId');
  const normalized = senderId.toLowerCase();
  if (normalized.includes('helper')) return 'HELPER';
  if (normalized.includes('hater') || normalized.includes('enemy') || normalized.includes('bot')) return 'HATER';
  if (normalized.includes('system') || normalized.includes('game')) return 'SYSTEM';
  return 'UNKNOWN';
}

function inferMessageChannel(
  message: Nullable<Partial<ChatMessage>>,
  fallback: ChatVisibleChannel,
): ChatVisibleChannel {
  const raw = extractStringField(message, 'channel', 'channelId', 'roomChannel');
  return raw ? toVisibleChannel(raw) : fallback;
}

function inferMessageText(message: Nullable<Partial<ChatMessage>>): string {
  return normalizeText(
    extractStringField(message, 'text', 'content', 'body', 'message'),
  );
}

function inferMessageEventNames(
  message: Nullable<Partial<ChatMessage>>,
): readonly string[] {
  const fromArrays = extractArrayField(message, 'eventNames', 'events', 'tags');
  const single = extractStringField(message, 'eventName');
  return uniqueStrings([
    ...fromArrays,
    ...(single ? [single] : []),
  ]);
}

function inferPhaseWeight(
  phase: Nullable<ChatConversationPhase>,
): Score01 {
  switch (phase) {
    case 'CLIMAX':
      return 1 as Score01;
    case 'RESCUE':
    case 'NEGOTIATION':
    case 'POST_RUN':
      return 0.82 as Score01;
    case 'ESCALATING':
      return 0.78 as Score01;
    case 'BUILDING':
      return 0.62 as Score01;
    case 'COOLDOWN':
    case 'SETTLING':
      return 0.44 as Score01;
    case 'OPENING':
      return 0.36 as Score01;
    case 'DORMANT':
      return 0.18 as Score01;
    default:
      return 0.32 as Score01;
  }
}

function inferSalienceBand(value: Score01): ChatSequenceSalienceBand {
  if (value >= 0.82) return 'LEGEND';
  if (value >= 0.68) return 'HEAVY';
  if (value >= 0.46) return 'MEDIUM';
  if (value >= 0.24) return 'LIGHT';
  return 'TRACE';
}

function decay01(ageMs: number, halfLifeMs: number): Score01 {
  if (ageMs <= 0) return 1 as Score01;
  if (halfLifeMs <= 1) return 0 as Score01;
  return clamp01(Math.pow(0.5, ageMs / halfLifeMs));
}

function shallowFreeze<T extends object>(value: T): T {
  return Object.freeze(value);
}

function toAnchorId(value: string): ChatMemoryAnchorId {
  return normalizeText(value) as ChatMemoryAnchorId;
}

function makeAnchorId(
  role: ChatSequenceMemoryRole,
  channel: ChatVisibleChannel,
  text: string,
  now: UnixMs,
): ChatMemoryAnchorId {
  const key = `${role}|${channel}|${text.slice(0, 120)}|${now}`;
  return toAnchorId(`anchor_${stableHash(key)}`);
}

function makeEntryId(anchorId: ChatMemoryAnchorId, now: UnixMs): string {
  return `entry_${stableHash(`${anchorId}:${now}`)}`;
}

function makeSequenceId(
  channel: ChatVisibleChannel,
  role: ChatSequenceMemoryRole,
  text: string,
  eventNames: readonly string[],
  now: UnixMs,
): string {
  const hint = eventNames[0] ?? text.slice(0, 64);
  return `seq_${stableHash(`${channel}:${role}:${hint}:${Math.floor(Number(now) / 30_000)}`)}`;
}

function cosineSimilarityFromVectors(
  lhs: readonly number[],
  rhs: readonly number[],
): Score01 {
  return compareEmbeddingVectors(lhs, rhs).similarity01;
}

function isHaterRole(role: ChatSequenceMemoryRole): boolean {
  return role === 'HATER' || role === 'RIVAL';
}

function isHelperRole(role: ChatSequenceMemoryRole): boolean {
  return role === 'HELPER' || role === 'ALLY';
}

function isSystemRole(role: ChatSequenceMemoryRole): boolean {
  return role === 'SYSTEM' || role === 'NARRATOR';
}

function isDealRole(role: ChatSequenceMemoryRole): boolean {
  return role === 'DEALMAKER';
}

function scoreRoleFit(
  desiredRoles: readonly ChatSequenceMemoryRole[],
  role: ChatSequenceMemoryRole,
): Score01 {
  if (desiredRoles.length === 0) return 0.5 as Score01;
  return desiredRoles.includes(role) ? 1 as Score01 : 0.08 as Score01;
}

function scoreKindFit(
  desiredKinds: readonly ChatSequenceMemoryKind[],
  kind: ChatSequenceMemoryKind,
): Score01 {
  if (desiredKinds.length === 0) return 0.5 as Score01;
  return desiredKinds.includes(kind) ? 1 as Score01 : 0.08 as Score01;
}

function scoreChannelFit(
  queryChannel: ChatVisibleChannel,
  entryChannels: readonly ChatVisibleChannel[],
): Score01 {
  if (entryChannels.includes(queryChannel)) return 1 as Score01;
  if (entryChannels.includes('GLOBAL')) return 0.54 as Score01;
  return 0.18 as Score01;
}

function summarizeEventNames(eventNames: readonly string[]): string {
  return truncateText(eventNames.join(', '), 120);
}

function safeJsonObject(value: unknown): JsonObject | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as JsonObject;
}

function extractFeatureScore(
  snapshot: Nullable<ChatFeatureSnapshot>,
  candidates: readonly string[],
  fallback = 0,
): Score01 {
  if (!snapshot || typeof snapshot !== 'object') return clamp01(fallback);
  const obj = snapshot as Record<string, unknown>;
  for (const key of candidates) {
    const direct = obj[key];
    if (typeof direct === 'number') return clamp01(direct);
  }
  return clamp01(fallback);
}

function extractAffectScore(
  snapshot: Nullable<ChatAffectSnapshot>,
  candidates: readonly string[],
  fallback = 0,
): Score01 {
  if (!snapshot || typeof snapshot !== 'object') return clamp01(fallback);
  const obj = snapshot as Record<string, unknown>;
  for (const key of candidates) {
    const direct = obj[key];
    if (typeof direct === 'number') return clamp01(Number(direct) / 100);
  }
  return clamp01(fallback);
}

function extractProfileEmotionScore(
  profile: Nullable<ChatLearningProfile>,
  key: string,
  fallback = 0,
): Score01 {
  if (!profile || typeof profile !== 'object') return clamp01(fallback);
  const baseline = (profile as Record<string, unknown>).emotionBaseline;
  if (!baseline || typeof baseline !== 'object') return clamp01(fallback);
  const value = (baseline as Record<string, unknown>)[key];
  if (typeof value === 'number') return clamp01(value / 100);
  return clamp01(fallback);
}

function extractPreferredChannel(profile: Nullable<ChatLearningProfile>): ChatVisibleChannel {
  if (!profile || typeof profile !== 'object') return DEFAULT_CHANNEL;
  const affinity = (profile as Record<string, unknown>).channelAffinity;
  if (!affinity || typeof affinity !== 'object') return DEFAULT_CHANNEL;
  const scores = affinity as Record<string, unknown>;
  const ranked = NO_CHANNELS.map((channel) => ({
    channel,
    score: typeof scores[channel] === 'number' ? Number(scores[channel]) : 0,
  })).sort((a, b) => b.score - a.score);
  return ranked[0]?.channel ?? DEFAULT_CHANNEL;
}

function summarizeChannels(channels: readonly ChatVisibleChannel[]): string {
  return channels.join('|') || DEFAULT_CHANNEL;
}

function explainRole(role: ChatSequenceMemoryRole): string {
  switch (role) {
    case 'PLAYER':
      return 'player-authored memory';
    case 'HELPER':
    case 'ALLY':
      return 'helper continuity';
    case 'HATER':
    case 'RIVAL':
      return 'rivalry escalation';
    case 'DEALMAKER':
      return 'negotiation callback';
    case 'SYSTEM':
    case 'NARRATOR':
      return 'system witness';
    case 'AMBIENT':
      return 'crowd atmosphere';
    default:
      return 'uncategorized actor';
  }
}

function buildDefaultEmbeddingRecord(
  requestId: string,
  text: string,
  summary: string,
  vector: readonly number[],
  purpose: ChatEmbeddingInput['purpose'],
  now: UnixMs,
): ChatEmbeddingVectorRecord {
  return Object.freeze({
    requestId,
    cacheKey: `deterministic:${stableHash(text)}`,
    source: 'LOCAL_DETERMINISTIC',
    model: 'pzo-chat-sequence-memory-deterministic-v1',
    purpose,
    dimensions: vector.length,
    vector,
    magnitude: 1,
    normalized: true,
    createdAtMs: now,
    durationMs: 0,
    previewText: truncateText(text, 140),
    contextSummary: truncateText(summary, 200),
    diagnostics: Object.freeze({
      path: 'sequence-memory-deterministic',
    }),
  });
}

function mergeTagSets(
  ...sources: readonly (readonly string[])[]
): readonly string[] {
  const merged: string[] = [];
  for (const source of sources) {
    merged.push(...source);
  }
  return uniqueStrings(merged);
}

function buildTagsFromRoleKindChannel(
  role: ChatSequenceMemoryRole,
  kind: ChatSequenceMemoryKind,
  channel: ChatVisibleChannel,
): readonly string[] {
  return uniqueStrings([
    `role:${role.toLowerCase()}`,
    `kind:${kind.toLowerCase()}`,
    `channel:${channel.toLowerCase()}`,
  ]);
}

function collectTextSignals(text: string): Readonly<{
  taunt01: Score01;
  rescue01: Score01;
  negotiation01: Score01;
  brag01: Score01;
  threat01: Score01;
  collapse01: Score01;
  comeback01: Score01;
}> {
  const lower = text.toLowerCase();

  const tauntTerms = ['easy', 'trash', 'weak', 'fold', 'choke', 'broke'];
  const rescueTerms = ['help', 'save', 'assist', 'rescue', 'stuck', 'please'];
  const negotiationTerms = ['offer', 'deal', 'counter', 'price', 'trade', 'take'];
  const bragTerms = ['win', 'dominate', 'rich', 'clean', 'perfect', 'legend'];
  const threatTerms = ['end', 'crush', 'destroy', 'hunt', 'ruin', 'bleed'];
  const collapseTerms = ['broke', 'lost', 'dead', 'bankrupt', 'fail', 'done'];
  const comebackTerms = ['back', 'recover', 'save', 'survive', 'reclaim', 'return'];

  const scoreTerms = (terms: readonly string[]): Score01 => {
    let count = 0;
    for (const term of terms) {
      if (lower.includes(term)) count += 1;
    }
    return clamp01(count / Math.max(1, terms.length / 2));
  };

  return Object.freeze({
    taunt01: scoreTerms(tauntTerms),
    rescue01: scoreTerms(rescueTerms),
    negotiation01: scoreTerms(negotiationTerms),
    brag01: scoreTerms(bragTerms),
    threat01: scoreTerms(threatTerms),
    collapse01: scoreTerms(collapseTerms),
    comeback01: scoreTerms(comebackTerms),
  });
}

function scoreTextLengthImpact(text: string): Score01 {
  const length = text.length;
  if (length <= 12) return 0.14 as Score01;
  if (length <= 28) return 0.22 as Score01;
  if (length <= 64) return 0.42 as Score01;
  if (length <= 180) return 0.66 as Score01;
  if (length <= 420) return 0.82 as Score01;
  return 0.74 as Score01;
}

function scoreRoleBaseSalience(role: ChatSequenceMemoryRole): Score01 {
  switch (role) {
    case 'HATER':
    case 'RIVAL':
      return 0.68 as Score01;
    case 'HELPER':
    case 'ALLY':
      return 0.66 as Score01;
    case 'DEALMAKER':
      return 0.62 as Score01;
    case 'SYSTEM':
    case 'NARRATOR':
      return 0.56 as Score01;
    case 'PLAYER':
      return 0.48 as Score01;
    case 'AMBIENT':
      return 0.24 as Score01;
    default:
      return 0.32 as Score01;
  }
}

function scoreKindBaseSalience(kind: ChatSequenceMemoryKind): Score01 {
  switch (kind) {
    case 'LEGEND':
      return 1 as Score01;
    case 'RESCUE':
    case 'NEGOTIATION':
    case 'RIVALRY':
    case 'POST_RUN':
      return 0.82 as Score01;
    case 'SCENE':
    case 'EVENT':
      return 0.66 as Score01;
    case 'STATE':
      return 0.54 as Score01;
    case 'MESSAGE':
      return 0.46 as Score01;
    default:
      return 0.32 as Score01;
  }
}

function scoreChannelBaseSalience(channel: ChatVisibleChannel): Score01 {
  switch (channel) {
    case 'DEAL_ROOM':
      return 0.64 as Score01;
    case 'SYNDICATE':
      return 0.58 as Score01;
    case 'GLOBAL':
      return 0.52 as Score01;
    case 'LOBBY':
      return 0.38 as Score01;
    default:
      return 0.46 as Score01;
  }
}

function buildSummaryFromText(
  text: string,
  role: ChatSequenceMemoryRole,
  kind: ChatSequenceMemoryKind,
  eventNames: readonly string[],
  maxChars: number,
): string {
  const eventSummary = summarizeEventNames(eventNames);
  const roleLabel = role.toLowerCase();
  const kindLabel = kind.toLowerCase();
  const base = [
    `${roleLabel} ${kindLabel}`,
    text ? `"${truncateText(text, Math.max(80, maxChars - 40))}"` : '',
    eventSummary ? `events:${eventSummary}` : '',
  ].filter(Boolean).join(' · ');
  return truncateText(base, maxChars);
}

function buildSequenceSummary(
  entries: readonly ChatSequenceMemoryEntry[],
  maxChars: number,
): string {
  if (entries.length === 0) return '';
  const head = entries[0];
  const tail = entries[entries.length - 1];
  const tags = uniqueStrings(entries.flatMap((entry) => entry.tags), 8).join(', ');
  const summary = [
    `sequence:${head.sequenceId}`,
    `${head.role.toLowerCase()}→${tail.role.toLowerCase()}`,
    `channel:${head.activeChannel.toLowerCase()}`,
    tags ? `tags:${tags}` : '',
    `span:${entries.length}`,
  ].filter(Boolean).join(' · ');
  return truncateText(summary, maxChars);
}

function scoreSequenceWeight(
  textSignals: ReturnType<typeof collectTextSignals>,
  phaseWeight01: Score01,
  eventNames: readonly string[],
): Score01 {
  const eventBias = eventNames.length ? clamp01(eventNames.length / 6) : 0;
  return clamp01(
    textSignals.taunt01 * 0.14 +
    textSignals.rescue01 * 0.18 +
    textSignals.negotiation01 * 0.16 +
    textSignals.brag01 * 0.14 +
    textSignals.threat01 * 0.16 +
    textSignals.collapse01 * 0.14 +
    textSignals.comeback01 * 0.12 +
    eventBias * 0.18 +
    phaseWeight01 * 0.24,
  );
}

function scoreEmotionalWeight(
  affectSnapshot: Nullable<ChatAffectSnapshot>,
  profile: Nullable<ChatLearningProfile>,
  featureSnapshot: Nullable<ChatFeatureSnapshot>,
): Score01 {
  const embarrassment01 = Math.max(
    extractAffectScore(affectSnapshot, ['embarrassment', 'socialEmbarrassment'], 0),
    extractProfileEmotionScore(profile, 'socialEmbarrassment', 0),
    extractFeatureScore(featureSnapshot, ['socialEmbarrassment01', 'embarrassment01'], 0),
  );

  const confidence01 = Math.max(
    extractAffectScore(affectSnapshot, ['confidence'], 0),
    extractProfileEmotionScore(profile, 'confidence', 0),
    extractFeatureScore(featureSnapshot, ['confidence01'], 0),
  );

  const desperation01 = Math.max(
    extractAffectScore(affectSnapshot, ['desperation'], 0),
    extractProfileEmotionScore(profile, 'desperation', 0),
    extractFeatureScore(featureSnapshot, ['rescueNeed01', 'dropOffRisk01'], 0),
  );

  const intimidation01 = Math.max(
    extractAffectScore(affectSnapshot, ['intimidation'], 0),
    extractProfileEmotionScore(profile, 'intimidation', 0),
    extractFeatureScore(featureSnapshot, ['haterBait01', 'toxicityRisk01'], 0),
  );

  return clamp01(
    embarrassment01 * 0.28 +
    desperation01 * 0.28 +
    intimidation01 * 0.24 +
    confidence01 * 0.20,
  );
}

function describeSalience(
  salienceBand: ChatSequenceSalienceBand,
  role: ChatSequenceMemoryRole,
  kind: ChatSequenceMemoryKind,
): string {
  switch (salienceBand) {
    case 'LEGEND':
      return `${kind.toLowerCase()} kept as legend memory for ${role.toLowerCase()} continuity`;
    case 'HEAVY':
      return `${kind.toLowerCase()} kept as strong continuity anchor`;
    case 'MEDIUM':
      return `${kind.toLowerCase()} kept as active callback memory`;
    case 'LIGHT':
      return `${kind.toLowerCase()} kept as light advisory memory`;
    default:
      return `${kind.toLowerCase()} stored as trace memory`;
  }
}

function scoreEventFit(
  recentEventNames: readonly string[],
  entryEventNames: readonly string[],
): Score01 {
  if (recentEventNames.length === 0 && entryEventNames.length === 0) return 0.5 as Score01;
  if (recentEventNames.length === 0 || entryEventNames.length === 0) return 0.14 as Score01;

  const recent = new Set(recentEventNames.map((value) => value.toLowerCase()));
  let hits = 0;
  for (const eventName of entryEventNames) {
    if (recent.has(eventName.toLowerCase())) hits += 1;
  }

  return clamp01(hits / Math.max(1, Math.min(recentEventNames.length, entryEventNames.length)));
}

function scoreRequiredTags(
  requiredTags: readonly string[],
  entryTags: readonly string[],
): Score01 {
  if (requiredTags.length === 0) return 0.5 as Score01;
  const tagSet = new Set(entryTags.map((tag) => tag.toLowerCase()));
  let hits = 0;
  for (const tag of requiredTags) {
    if (tagSet.has(tag.toLowerCase())) hits += 1;
  }
  return clamp01(hits / requiredTags.length);
}

function scorePurposeFit(
  purpose: ChatSequenceRecallPurpose,
  entry: ChatSequenceMemoryEntry,
): Score01 {
  switch (purpose) {
    case 'HELPER':
      return isHelperRole(entry.role)
        ? clamp01(0.72 + entry.emotionalWeight01 * 0.18 + (entry.kind === 'RESCUE' ? 0.14 : 0))
        : 0.1 as Score01;
    case 'HATER':
      return isHaterRole(entry.role)
        ? clamp01(0.72 + entry.sequenceWeight01 * 0.18 + (entry.kind === 'RIVALRY' ? 0.14 : 0))
        : 0.1 as Score01;
    case 'NEGOTIATION':
      return (isDealRole(entry.role) || entry.kind === 'NEGOTIATION')
        ? clamp01(0.76 + entry.sequenceWeight01 * 0.10)
        : 0.08 as Score01;
    case 'RESCUE':
      return (isHelperRole(entry.role) || entry.kind === 'RESCUE')
        ? clamp01(0.76 + entry.emotionalWeight01 * 0.16)
        : 0.06 as Score01;
    case 'POST_RUN':
      return entry.kind === 'POST_RUN' || entry.kind === 'LEGEND'
        ? 1 as Score01
        : 0.18 as Score01;
    case 'REPLAY':
      return clamp01(entry.salience01 * 0.7 + entry.sequenceWeight01 * 0.3);
    case 'UI_PREVIEW':
      return clamp01(entry.salience01 * 0.6 + entry.continuityWeight01 * 0.4);
    case 'DEBUG':
      return 0.8 as Score01;
    case 'RANKING':
      return clamp01(entry.salience01 * 0.5 + entry.continuityWeight01 * 0.3 + entry.sequenceWeight01 * 0.2);
    default:
      return 0.4 as Score01;
  }
}

function scorePhaseFit(
  currentState: Nullable<ChatConversationStateEncodingResult>,
  entry: ChatSequenceMemoryEntry,
): Score01 {
  if (!currentState && !entry.state) return 0.5 as Score01;
  if (!currentState || !entry.state) return 0.16 as Score01;

  const samePhase = currentState.phase === entry.state.phase ? 1 : 0;
  const sameTemperature = currentState.temperature === entry.state.temperature ? 1 : 0;
  const sameChannel = currentState.activeChannel === entry.state.activeChannel ? 1 : 0;
  const sameIntent = currentState.dominantIntent === entry.state.dominantIntent ? 1 : 0;

  return clamp01(
    samePhase * 0.45 +
    sameTemperature * 0.18 +
    sameChannel * 0.18 +
    sameIntent * 0.19,
  );
}

function scoreIntentFit(
  currentIntent: Nullable<ChatDialogueIntentEncodingResult>,
  entryIntent: Nullable<ChatDialogueIntentEncodingResult>,
): Score01 {
  if (!currentIntent && !entryIntent) return 0.5 as Score01;
  if (!currentIntent || !entryIntent) return 0.18 as Score01;
  const primary = currentIntent.primaryIntent === entryIntent.primaryIntent ? 1 : 0;
  const secondaryOverlap = entryIntent.secondaryIntents.some((intent) =>
    currentIntent.secondaryIntents.includes(intent),
  ) ? 1 : 0;
  const stance = currentIntent.stance === entryIntent.stance ? 1 : 0;
  return clamp01(primary * 0.56 + secondaryOverlap * 0.22 + stance * 0.22);
}

function buildExplanation(parts: readonly string[]): string {
  return truncateText(parts.filter(Boolean).join(' · '), 260);
}

function cloneEntry(entry: ChatSequenceMemoryEntry): ChatSequenceMemoryEntry {
  return Object.freeze({
    ...entry,
    channels: Object.freeze([...entry.channels]),
    tokens: Object.freeze([...entry.tokens]),
    tags: Object.freeze([...entry.tags]),
    eventNames: Object.freeze([...entry.eventNames]),
    relatedAnchorIds: Object.freeze([...entry.relatedAnchorIds]),
    semanticVector: Object.freeze([...entry.semanticVector]),
    metadata: entry.metadata ? Object.freeze({ ...entry.metadata }) : undefined,
  });
}

/* ========================================================================== */
/* MARK: In-memory store                                                      */
/* ========================================================================== */

class InMemorySequenceMemoryStore {
  private readonly entriesByAnchor = new Map<string, ChatSequenceMemoryEntry>();
  private readonly anchorsBySequence = new Map<string, string[]>();
  private readonly order: string[] = [];

  public clear(): void {
    this.entriesByAnchor.clear();
    this.anchorsBySequence.clear();
    this.order.length = 0;
  }

  public size(): number {
    return this.order.length;
  }

  public sequenceCount(): number {
    return this.anchorsBySequence.size;
  }

  public anchorCount(): number {
    return this.entriesByAnchor.size;
  }

  public get(anchorId: string): Nullable<ChatSequenceMemoryEntry> {
    const entry = this.entriesByAnchor.get(anchorId);
    return entry ? cloneEntry(entry) : null;
  }

  public list(): readonly ChatSequenceMemoryEntry[] {
    return Object.freeze(
      this.order
        .map((anchorId) => this.entriesByAnchor.get(anchorId))
        .filter((entry): entry is ChatSequenceMemoryEntry => Boolean(entry))
        .map(cloneEntry),
    );
  }

  public listBySequence(sequenceId: string): readonly ChatSequenceMemoryEntry[] {
    const anchors = this.anchorsBySequence.get(sequenceId) ?? [];
    return Object.freeze(
      anchors
        .map((anchorId) => this.entriesByAnchor.get(anchorId))
        .filter((entry): entry is ChatSequenceMemoryEntry => Boolean(entry))
        .map(cloneEntry),
    );
  }

  public put(entry: ChatSequenceMemoryEntry): void {
    const anchorKey = String(entry.anchorId);
    const existing = this.entriesByAnchor.get(anchorKey);

    if (!existing) {
      this.order.unshift(anchorKey);
    }

    this.entriesByAnchor.set(anchorKey, cloneEntry(entry));

    const current = this.anchorsBySequence.get(entry.sequenceId) ?? [];
    const next = current.filter((anchorId) => anchorId !== anchorKey);
    next.push(anchorKey);
    this.anchorsBySequence.set(entry.sequenceId, next);
  }

  public delete(anchorId: string): Nullable<ChatSequenceMemoryEntry> {
    const existing = this.entriesByAnchor.get(anchorId);
    if (!existing) return null;

    this.entriesByAnchor.delete(anchorId);

    const orderIndex = this.order.indexOf(anchorId);
    if (orderIndex >= 0) {
      this.order.splice(orderIndex, 1);
    }

    const sequenceAnchors = this.anchorsBySequence.get(existing.sequenceId) ?? [];
    const nextSequenceAnchors = sequenceAnchors.filter((value) => value !== anchorId);
    if (nextSequenceAnchors.length > 0) {
      this.anchorsBySequence.set(existing.sequenceId, nextSequenceAnchors);
    } else {
      this.anchorsBySequence.delete(existing.sequenceId);
    }

    return cloneEntry(existing);
  }

  public snapshot(now: UnixMs): ChatSequenceMemoryStoreSnapshot {
    return Object.freeze({
      moduleName: CHAT_SEQUENCE_MEMORY_CLIENT_MODULE_NAME,
      moduleVersion: CHAT_SEQUENCE_MEMORY_CLIENT_VERSION,
      exportedAtMs: now,
      entries: this.list(),
    });
  }

  public hydrate(snapshot: ChatSequenceMemoryStoreSnapshot): void {
    this.clear();
    const entries = safeArray(snapshot.entries);
    for (const entry of entries) {
      this.put(entry);
    }
  }
}

/* ========================================================================== */
/* MARK: Sequence memory client                                               */
/* ========================================================================== */

export class SequenceMemoryClient implements ChatSequenceMemoryClientPort {
  private readonly defaults: typeof CHAT_SEQUENCE_MEMORY_CLIENT_DEFAULTS;
  private readonly telemetry: Nullable<ChatSequenceMemoryTelemetryPort>;
  private readonly store = new InMemorySequenceMemoryStore();
  private readonly embeddingClient: ChatEmbeddingClientPort;
  private readonly intentEncoder: ChatDialogueIntentEncoderPort;
  private readonly conversationStateEncoder: ChatConversationStateEncoderPort;
  private readonly requestPrefix: string;
  private readonly totals: MutableTotals = {
    writes: 0,
    recalls: 0,
    prunes: 0,
    compressions: 0,
    hardPrunes: 0,
    touchUpdates: 0,
  };

  private requestCounter = 0;

  public constructor(
    options: ChatSequenceMemoryClientOptions = {},
  ) {
    this.defaults = Object.freeze({
      ...CHAT_SEQUENCE_MEMORY_CLIENT_DEFAULTS,
      ...options.defaults,
      requestPrefix: normalizeText(options.requestPrefix) || CHAT_SEQUENCE_MEMORY_CLIENT_DEFAULTS.requestPrefix,
    });

    this.telemetry = options.telemetry ?? null;
    this.requestPrefix = this.defaults.requestPrefix;

    this.embeddingClient =
      options.embeddingClient ??
      createMessageEmbeddingClient({
        telemetry: this.telemetry ?? undefined,
        requestPrefix: `${this.requestPrefix}:embed`,
      });

    this.intentEncoder =
      options.intentEncoder ??
      createDialogueIntentEncoder({
        embeddingClient: this.embeddingClient,
        telemetry: this.telemetry ?? undefined,
      });

    this.conversationStateEncoder =
      options.conversationStateEncoder ??
      createConversationStateEncoder({
        embeddingClient: this.embeddingClient,
        intentEncoder: this.intentEncoder as any,
        telemetry: this.telemetry ?? undefined,
        embeddingTelemetry: this.telemetry ?? undefined,
      });

    if (options.initialSnapshot) {
      this.importSnapshot(options.initialSnapshot);
    }
  }

  public async remember(
    input: ChatSequenceMemoryWriteInput,
  ): Promise<ChatSequenceMemoryEntry> {
    const prepared = this.prepareWriteInput(input);
    const deduped = this.findDedupeCandidate(prepared);

    if (deduped) {
      const touched = this.touch(deduped.anchorId, prepared.now);
      if (touched) return touched;
    }

    const intent = prepared.skipIntentEncode
      ? null
      : await this.maybeEncodeIntent(prepared);

    const state = prepared.skipStateEncode
      ? null
      : await this.maybeEncodeState(prepared, intent);

    const entry = await this.createEntry(prepared, intent, state);
    this.store.put(entry);
    this.enforceCaps(prepared.now);

    this.totals.writes += 1;
    this.emit('sequence_memory.write', {
      requestId: prepared.requestId,
      anchorId: entry.anchorId,
      sequenceId: entry.sequenceId,
      role: entry.role,
      kind: entry.kind,
      channel: entry.activeChannel,
      salience01: entry.salience01,
      salienceBand: entry.salienceBand,
    });

    return cloneEntry(entry);
  }

  public async rememberMany(
    inputs: readonly ChatSequenceMemoryWriteInput[],
  ): Promise<readonly ChatSequenceMemoryEntry[]> {
    const results: ChatSequenceMemoryEntry[] = [];
    for (const input of inputs) {
      results.push(await this.remember(input));
    }
    return Object.freeze(results);
  }

  public async recall(
    input: ChatSequenceMemoryRecallInput,
  ): Promise<ChatSequenceMemoryRecallResult> {
    const prepared = await this.prepareRecallInput(input);
    const queryVectorRecord = await this.buildRecallQueryVector(prepared);
    const diagnostics: CandidateFilterDiagnostics = {
      prunedBySalience: 0,
      prunedByScope: 0,
      prunedByRole: 0,
      prunedByKind: 0,
    };

    const allEntries = this.store.list();
    const filtered: ChatSequenceMemoryEntry[] = [];
    for (const entry of allEntries) {
      if (entry.salience01 < prepared.minSalience01) {
        diagnostics.prunedBySalience += 1;
        continue;
      }

      if (!this.scopeAllowsRecall(entry, prepared)) {
        diagnostics.prunedByScope += 1;
        continue;
      }

      if (prepared.desiredRoles.length > 0 && !prepared.desiredRoles.includes(entry.role)) {
        diagnostics.prunedByRole += 1;
        continue;
      }

      if (prepared.desiredKinds.length > 0 && !prepared.desiredKinds.includes(entry.kind)) {
        diagnostics.prunedByKind += 1;
        continue;
      }

      filtered.push(entry);
    }

    const matches = filtered
      .map((entry) => this.scoreRecallCandidate(entry, prepared, queryVectorRecord.vector))
      .sort((lhs, rhs) => Number(rhs.score01) - Number(lhs.score01));

    const limited = topN(matches, prepared.limit);
    const finalMatches = prepared.includeNeighbors
      ? this.expandNeighborMatches(limited)
      : limited;

    this.bumpUsage(finalMatches, prepared.now);
    this.totals.recalls += 1;

    const result: ChatSequenceMemoryRecallResult = Object.freeze({
      requestId: prepared.requestId,
      recalledAtMs: prepared.now,
      purpose: prepared.purpose,
      querySummary: truncateText(prepared.queryText || '[state-driven recall]', 160),
      queryVector: Object.freeze([...queryVectorRecord.vector]),
      matches: Object.freeze(finalMatches.map((match) => Object.freeze(match))),
      diagnostics: Object.freeze({
        candidateCount: allEntries.length,
        filteredCount: filtered.length,
        prunedBySalience: diagnostics.prunedBySalience,
        prunedByScope: diagnostics.prunedByScope,
        prunedByRole: diagnostics.prunedByRole,
        prunedByKind: diagnostics.prunedByKind,
        storeSize: this.store.size(),
        activeChannel: prepared.activeChannel,
      }),
    });

    this.emit('sequence_memory.recall', {
      requestId: prepared.requestId,
      purpose: prepared.purpose,
      matches: result.matches.length,
      activeChannel: prepared.activeChannel,
      storeSize: this.store.size(),
    });

    return result;
  }

  public touch(
    anchorId: ChatMemoryAnchorId | string,
    now?: UnixMs | number,
  ): Nullable<ChatSequenceMemoryEntry> {
    const existing = this.store.get(String(anchorId));
    if (!existing) return null;

    const touchedAt = nowOr(now);
    const next: ChatSequenceMemoryEntry = Object.freeze({
      ...existing,
      useCount: existing.useCount + 1,
      lastTouchedAtMs: touchedAt,
    });

    this.store.put(next);
    this.totals.touchUpdates += 1;
    return cloneEntry(next);
  }

  public get(
    anchorId: ChatMemoryAnchorId | string,
  ): Nullable<ChatSequenceMemoryEntry> {
    return this.store.get(String(anchorId));
  }

  public exportSnapshot(
    now?: UnixMs | number,
  ): ChatSequenceMemoryStoreSnapshot {
    return this.store.snapshot(nowOr(now));
  }

  public importSnapshot(
    snapshot: ChatSequenceMemoryStoreSnapshot,
  ): void {
    this.store.hydrate(snapshot);
  }

  public prune(
    now?: UnixMs | number,
  ): Readonly<{
    removedEntryIds: readonly string[];
    reason: ChatSequenceCompressionReason;
  }> {
    const effectiveNow = nowOr(now);
    const removedEntryIds: string[] = [];

    const entries = this.store.list();
    for (const entry of entries) {
      const ageMs = Number(effectiveNow) - Number(entry.createdAtMs);
      if (this.defaults.enableHardPrune && ageMs > this.defaults.hardPruneAgeMs) {
        this.store.delete(String(entry.anchorId));
        removedEntryIds.push(entry.entryId);
      }
    }

    this.totals.prunes += 1;
    if (removedEntryIds.length > 0) {
      this.totals.hardPrunes += removedEntryIds.length;
    }

    return Object.freeze({
      removedEntryIds: Object.freeze(removedEntryIds),
      reason: 'AGE_OUT',
    });
  }

  public clear(): void {
    this.store.clear();
  }

  public getPublicSnapshot(): ChatSequenceMemoryPublicSnapshot {
    return Object.freeze({
      moduleName: CHAT_SEQUENCE_MEMORY_CLIENT_MODULE_NAME,
      moduleVersion: CHAT_SEQUENCE_MEMORY_CLIENT_VERSION,
      totals: Object.freeze({
        writes: this.totals.writes,
        recalls: this.totals.recalls,
        prunes: this.totals.prunes,
        compressions: this.totals.compressions,
        hardPrunes: this.totals.hardPrunes,
        touchUpdates: this.totals.touchUpdates,
      }),
      storeSize: this.store.size(),
      sequenceCount: this.store.sequenceCount(),
      anchorCount: this.store.anchorCount(),
    });
  }

  private prepareWriteInput(
    input: ChatSequenceMemoryWriteInput,
  ): PreparedWriteInput {
    const now = nowOr(input.now);
    const message = input.message ?? null;
    const text = normalizeText(input.text) || inferMessageText(message);
    const role = normalizeRole(input.role ?? inferMessageRole(message));
    const activeChannel = input.activeChannel
      ? toVisibleChannel(input.activeChannel)
      : inferMessageChannel(message, DEFAULT_CHANNEL);

    const recentMessages = safeArray(input.recentMessages).slice(
      -this.defaults.maxRecentMessagesForWrite,
    ) as readonly ChatMessage[];

    const recentEventNames = uniqueStrings([
      ...safeArray(input.recentEventNames),
      ...inferMessageEventNames(message),
    ], this.defaults.maxEventNames);

    const kind =
      normalizeKind(input.kind) ||
      inferKindFromSignals(text, role, activeChannel, recentEventNames);

    const channels = uniqueStrings(
      [
        activeChannel,
        ...safeArray(input.channels).map((channel) => toVisibleChannel(channel)),
      ],
      NO_CHANNELS.length,
    ).map((channel) => toVisibleChannel(channel));

    const summary =
      normalizeText(input.summary) ||
      buildSummaryFromText(
        text,
        role,
        kind,
        recentEventNames,
        this.defaults.maxSummaryChars,
      );

    const relatedAnchorIds = uniqueStrings(
      safeArray(input.relatedAnchorIds).map((value) => String(value)),
      this.defaults.maxRelatedAnchorIds,
    ).map((value) => toAnchorId(value));

    return Object.freeze({
      requestId: normalizeText(input.requestId) || this.nextRequestId(),
      now,
      text,
      summary,
      role,
      kind,
      scope: normalizeScope(input.scope),
      activeChannel,
      channels: Object.freeze(channels as ChatVisibleChannel[]),
      recentMessages,
      recentEventNames,
      roomId: normalizeText(input.roomId) || extractStringField(message, 'roomId'),
      runId: normalizeText(input.runId) || extractStringField(message, 'runId'),
      modeId: normalizeText(input.modeId) || extractStringField(message, 'modeId'),
      playerUserId: normalizeText(input.playerUserId),
      senderUserId: normalizeText(input.senderUserId) || extractStringField(message, 'senderId', 'userId'),
      featureSnapshot: input.featureSnapshot ?? null,
      learningProfile: input.learningProfile ?? null,
      bridgeSnapshot: input.bridgeSnapshot ?? null,
      affectSnapshot: input.affectSnapshot ?? null,
      relatedAnchorIds: Object.freeze(relatedAnchorIds),
      provenance: normalizeProvenance(input.provenance),
      metadata: safeJsonObject(input.metadata),
      sequenceIdHint: normalizeText(input.sequenceIdHint) || undefined,
      skipIntentEncode: Boolean(input.skipIntentEncode),
      skipStateEncode: Boolean(input.skipStateEncode),
      message,
    });
  }

  private async prepareRecallInput(
    input: ChatSequenceMemoryRecallInput,
  ): Promise<PreparedRecallInput> {
    const now = nowOr(input.now);
    const queryMessage = input.queryMessage ?? null;
    const queryText = normalizeText(input.queryText) || inferMessageText(queryMessage);
    const activeChannel = toVisibleChannel(
      input.activeChannel ??
      input.visibleChannel ??
      queryMessage?.channel ??
      extractPreferredChannel(input.learningProfile ?? null),
    );

    return Object.freeze({
      requestId: normalizeText(input.requestId) || this.nextRequestId(),
      now,
      purpose: normalizePurpose(input.purpose),
      queryText,
      activeChannel,
      recentMessages: safeArray(input.recentMessages).slice(
        -this.defaults.maxRecentMessagesForRecallState,
      ) as readonly ChatMessage[],
      currentIntent: input.currentIntent ?? null,
      currentState: input.currentState ?? null,
      featureSnapshot: input.featureSnapshot ?? null,
      learningProfile: input.learningProfile ?? null,
      bridgeSnapshot: input.bridgeSnapshot ?? null,
      affectSnapshot: input.affectSnapshot ?? null,
      desiredRoles: Object.freeze(
        safeArray(input.desiredRoles).map((role) => normalizeRole(role)),
      ),
      desiredKinds: Object.freeze(
        safeArray(input.desiredKinds).map((kind) => normalizeKind(kind)),
      ),
      requiredTags: Object.freeze(
        safeArray(input.requiredTags).map((tag) => normalizeText(tag.toLowerCase())),
      ),
      recentEventNames: uniqueStrings(
        safeArray(input.recentEventNames).map((eventName) => eventName.toLowerCase()),
        this.defaults.maxEventNames,
      ),
      roomId: normalizeText(input.roomId) || undefined,
      runId: normalizeText(input.runId) || undefined,
      modeId: normalizeText(input.modeId) || undefined,
      playerUserId: normalizeText(input.playerUserId) || undefined,
      limit: Math.max(1, Math.min(Number(input.limit ?? this.defaults.maxRecallResults), this.defaults.maxRecallResults)),
      minSalience01: normalizeScore01(input.minSalience01 ?? 0),
      includeNeighbors: input.includeNeighbors ?? this.defaults.enableNeighborExpansion,
      metadata: safeJsonObject(input.metadata),
      queryMessage,
    });
  }

  private async maybeEncodeIntent(
    prepared: PreparedWriteInput,
  ): Promise<Nullable<ChatDialogueIntentEncodingResult>> {
    if (!this.defaults.enableIntentEncodingOnWrite) return null;
    if (!prepared.text) return null;

    const input: ChatDialogueIntentEncodingInput = Object.freeze({
      requestId: `${prepared.requestId}:intent`,
      text: prepared.text,
      message: prepared.message ?? undefined,
      recentMessages: prepared.recentMessages,
      featureSnapshot: prepared.featureSnapshot,
      learningProfile: prepared.learningProfile,
      bridgeSnapshot: prepared.bridgeSnapshot,
      activeChannel: prepared.activeChannel,
      eventName: prepared.recentEventNames[0] ?? null,
      senderRole: prepared.role,
      senderId: prepared.senderUserId ?? null,
      roomId: prepared.roomId,
      modeId: prepared.modeId,
      metadata: prepared.metadata,
    });

    try {
      return await this.intentEncoder.encode(input);
    } catch (error) {
      this.emit('sequence_memory.intent_encode_failed', {
        requestId: prepared.requestId,
        reason: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
  }

  private async maybeEncodeState(
    prepared: PreparedWriteInput,
    currentIntent: Nullable<ChatDialogueIntentEncodingResult>,
  ): Promise<Nullable<ChatConversationStateEncodingResult>> {
    if (!this.defaults.enableConversationStateOnWrite) return null;

    const input: ChatConversationStateEncodingInput = Object.freeze({
      requestId: `${prepared.requestId}:state`,
      now: prepared.now,
      activeChannel: prepared.activeChannel,
      visibleChannel: prepared.activeChannel,
      messages: prepared.recentMessages,
      recentMessages: prepared.recentMessages,
      featureSnapshot: prepared.featureSnapshot,
      learningProfile: prepared.learningProfile,
      bridgeSnapshot: prepared.bridgeSnapshot,
      affectSnapshot: prepared.affectSnapshot,
      currentIntent,
      recentEventNames: prepared.recentEventNames,
      currentModeId: prepared.modeId,
      sessionId: prepared.roomId,
      runId: prepared.runId,
      roomId: prepared.roomId,
      playerUserId: prepared.playerUserId,
      metadata: prepared.metadata,
      source: 'LIVE',
    });

    try {
      return await this.conversationStateEncoder.encode(input);
    } catch (error) {
      this.emit('sequence_memory.state_encode_failed', {
        requestId: prepared.requestId,
        reason: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
  }

  private async buildRecallQueryVector(
    prepared: PreparedRecallInput,
  ): Promise<ChatEmbeddingVectorRecord> {
    const state = prepared.currentState ??
      await this.buildFallbackStateForRecall(prepared);

    if (state?.semanticVectorRecord) {
      return state.semanticVectorRecord;
    }

    const text = prepared.queryText || '[state-driven recall]';
    const summary = state?.stateSummary || text;
    const vector = buildDeterministicMessageEmbedding({
      purpose: 'MEMORY_ANCHOR',
      text,
      activeChannel: prepared.activeChannel,
      metadata: prepared.metadata,
    }, this.defaults.deterministicVectorDimensions);

    return buildDefaultEmbeddingRecord(
      `${prepared.requestId}:query`,
      text,
      summary,
      vector,
      'MEMORY_ANCHOR',
      prepared.now,
    );
  }

  private async buildFallbackStateForRecall(
    prepared: PreparedRecallInput,
  ): Promise<Nullable<ChatConversationStateEncodingResult>> {
    try {
      return await this.conversationStateEncoder.encode({
        requestId: `${prepared.requestId}:recall-state`,
        now: prepared.now,
        activeChannel: prepared.activeChannel,
        visibleChannel: prepared.activeChannel,
        messages: prepared.recentMessages,
        recentMessages: prepared.recentMessages,
        featureSnapshot: prepared.featureSnapshot,
        learningProfile: prepared.learningProfile,
        bridgeSnapshot: prepared.bridgeSnapshot,
        affectSnapshot: prepared.affectSnapshot,
        currentIntent: prepared.currentIntent,
        recentEventNames: prepared.recentEventNames,
        roomId: prepared.roomId,
        runId: prepared.runId,
        currentModeId: prepared.modeId,
        playerUserId: prepared.playerUserId,
        source: 'PREVIEW',
        metadata: prepared.metadata,
      });
    } catch {
      return null;
    }
  }

  private findDedupeCandidate(
    prepared: PreparedWriteInput,
  ): Nullable<ChatSequenceMemoryEntry> {
    const entries = this.store.list();
    for (const entry of entries) {
      const withinWindow =
        Math.abs(Number(prepared.now) - Number(entry.createdAtMs)) <=
        this.defaults.writeDedupeWindowMs;

      if (!withinWindow) continue;
      if (entry.role !== prepared.role) continue;
      if (entry.activeChannel !== prepared.activeChannel) continue;
      if (entry.normalizedText !== prepared.text) continue;
      if (entry.kind !== prepared.kind) continue;
      return entry;
    }
    return null;
  }

  private async createEntry(
    prepared: PreparedWriteInput,
    intent: Nullable<ChatDialogueIntentEncodingResult>,
    state: Nullable<ChatConversationStateEncodingResult>,
  ): Promise<ChatSequenceMemoryEntry> {
    const textSignals = collectTextSignals(prepared.text);
    const phaseWeight01 = inferPhaseWeight(state?.phase ?? null);

    const tokens = tokenizeText(prepared.text, this.defaults.maxTokenCount);
    const roleTags = buildTagsFromRoleKindChannel(
      prepared.role,
      prepared.kind,
      prepared.activeChannel,
    );

    const intentTags = intent
      ? uniqueStrings(
          [
            `intent:${intent.primaryIntent.toLowerCase()}`,
            ...intent.secondaryIntents.map((value) => `intent:${value.toLowerCase()}`),
            `stance:${intent.stance.toLowerCase()}`,
            `urgency:${intent.urgency.toLowerCase()}`,
          ],
          8,
        )
      : Object.freeze([]);

    const stateTags = state
      ? uniqueStrings(
          [
            `phase:${state.phase.toLowerCase()}`,
            ...state.tags.map((tag) => tag.toLowerCase()),
          ],
          10,
        )
      : Object.freeze([]);

    const signalTags = uniqueStrings([
      ...(textSignals.taunt01 >= 0.5 ? ['taunt'] : []),
      ...(textSignals.rescue01 >= 0.5 ? ['rescue'] : []),
      ...(textSignals.negotiation01 >= 0.5 ? ['negotiation'] : []),
      ...(textSignals.brag01 >= 0.5 ? ['brag'] : []),
      ...(textSignals.threat01 >= 0.5 ? ['threat'] : []),
      ...(textSignals.collapse01 >= 0.5 ? ['collapse'] : []),
      ...(textSignals.comeback01 >= 0.5 ? ['comeback'] : []),
      ...prepared.recentEventNames.map((value) => value.toLowerCase()),
    ]);

    const tags = mergeTagSets(roleTags, intentTags, stateTags, signalTags).slice(
      0,
      this.defaults.maxTagCount,
    );

    const sequenceWeight01 = scoreSequenceWeight(
      textSignals,
      phaseWeight01,
      prepared.recentEventNames,
    );

    const emotionalWeight01 = scoreEmotionalWeight(
      prepared.affectSnapshot,
      prepared.learningProfile,
      prepared.featureSnapshot,
    );

    const salience01 = clamp01(
      scoreRoleBaseSalience(prepared.role) * 0.18 +
      scoreKindBaseSalience(prepared.kind) * 0.18 +
      scoreChannelBaseSalience(prepared.activeChannel) * 0.08 +
      scoreTextLengthImpact(prepared.text) * 0.10 +
      sequenceWeight01 * 0.17 +
      emotionalWeight01 * 0.11 +
      textSignals.threat01 * 0.06 +
      textSignals.rescue01 * 0.06 +
      textSignals.negotiation01 * 0.06 +
      textSignals.comeback01 * 0.05 +
      phaseWeight01 * 0.10,
    );

    const salienceBand = inferSalienceBand(salience01);
    const sequenceId =
      prepared.sequenceIdHint ||
      makeSequenceId(
        prepared.activeChannel,
        prepared.role,
        prepared.text,
        prepared.recentEventNames,
        prepared.now,
      );

    const existingSequenceEntries = this.store.listBySequence(sequenceId);
    const sequenceIndex = existingSequenceEntries.length;
    const continuityWeight01 = clamp01(
      sequenceIndex > 0 ? 0.42 + Math.min(sequenceIndex, 6) * 0.08 : 0.18,
    );

    const summary = prepared.summary ||
      buildSummaryFromText(
        prepared.text,
        prepared.role,
        prepared.kind,
        prepared.recentEventNames,
        this.defaults.maxSummaryChars,
      );

    const embeddingInput: ChatEmbeddingInput = Object.freeze({
      purpose: 'MEMORY_ANCHOR',
      text: prepared.text || summary,
      activeChannel: prepared.activeChannel,
      featureSnapshot: prepared.featureSnapshot ?? undefined,
      learningProfile: prepared.learningProfile ?? undefined,
      metadata: Object.freeze({
        role: prepared.role,
        kind: prepared.kind,
        channel: prepared.activeChannel,
        sequenceId,
        tags,
        events: prepared.recentEventNames,
        roomId: prepared.roomId,
        runId: prepared.runId,
        modeId: prepared.modeId,
      }),
    });

    const semanticVectorRecord = await this.buildEntryEmbedding(
      prepared.requestId,
      embeddingInput,
      summary,
      prepared.now,
    );

    const anchorId = makeAnchorId(
      prepared.role,
      prepared.activeChannel,
      summary,
      prepared.now,
    );

    const entry: ChatSequenceMemoryEntry = Object.freeze({
      entryId: makeEntryId(anchorId, prepared.now),
      anchorId,
      sequenceId,
      sequenceIndex,
      role: prepared.role,
      kind: prepared.kind,
      scope: prepared.scope,
      provenance: prepared.provenance,
      activeChannel: prepared.activeChannel,
      channels: Object.freeze(prepared.channels),
      textPreview: buildTextPreview(prepared.text, summary, this.defaults.maxPreviewChars),
      summary,
      normalizedText: prepared.text,
      semanticVector: Object.freeze([...semanticVectorRecord.vector]),
      semanticVectorRecord,
      intent,
      state,
      tokens: Object.freeze(tokens),
      tags: Object.freeze(tags),
      eventNames: Object.freeze(prepared.recentEventNames),
      relatedAnchorIds: Object.freeze([
        ...prepared.relatedAnchorIds,
        ...existingSequenceEntries
          .slice(-2)
          .map((existing) => existing.anchorId),
      ].slice(0, this.defaults.maxRelatedAnchorIds)),
      salience01,
      salienceBand,
      emotionalWeight01,
      sequenceWeight01,
      continuityWeight01,
      repeatPenalty01: 0 as Score01,
      createdAtMs: prepared.now,
      lastTouchedAtMs: prepared.now,
      useCount: 0,
      roomId: prepared.roomId,
      runId: prepared.runId,
      modeId: prepared.modeId,
      playerUserId: prepared.playerUserId,
      senderUserId: prepared.senderUserId,
      metadata: safeJsonObject({
        ...(prepared.metadata ?? {}),
        explanation: describeSalience(salienceBand, prepared.role, prepared.kind),
      }),
    });

    return entry;
  }

  private async buildEntryEmbedding(
    requestId: string,
    embeddingInput: ChatEmbeddingInput,
    summary: string,
    now: UnixMs,
  ): Promise<ChatEmbeddingVectorRecord> {
    try {
      return await this.embeddingClient.embed({
        ...embeddingInput,
        requestId: `${requestId}:embedding`,
      } as any);
    } catch (error) {
      this.emit('sequence_memory.embedding_failed', {
        requestId,
        reason: error instanceof Error ? error.message : 'unknown',
      });

      const vector = buildDeterministicMessageEmbedding(
        embeddingInput,
        this.defaults.deterministicVectorDimensions,
      );

      return buildDefaultEmbeddingRecord(
        `${requestId}:embedding-fallback`,
        normalizeText(embeddingInput.text ?? ''),
        summary,
        vector,
        'MEMORY_ANCHOR',
        now,
      );
    }
  }

  private scopeAllowsRecall(
    entry: ChatSequenceMemoryEntry,
    prepared: PreparedRecallInput,
  ): boolean {
    if (entry.scope === 'GLOBAL') return true;
    if (entry.scope === 'PLAYER' && prepared.playerUserId && entry.playerUserId) {
      return prepared.playerUserId === entry.playerUserId;
    }
    if (entry.scope === 'RUN' && prepared.runId && entry.runId) {
      return prepared.runId === entry.runId;
    }
    if (entry.scope === 'ROOM' && prepared.roomId && entry.roomId) {
      return prepared.roomId === entry.roomId;
    }
    if (entry.scope === 'MODE' && prepared.modeId && entry.modeId) {
      return prepared.modeId === entry.modeId;
    }
    return entry.scope === 'LOCAL' || entry.scope === 'GLOBAL';
  }

  private scoreRecallCandidate(
    entry: ChatSequenceMemoryEntry,
    prepared: PreparedRecallInput,
    queryVector: readonly number[],
  ): ChatSequenceMemoryMatch {
    const ageMs = Number(prepared.now) - Number(entry.createdAtMs);
    const touchAgeMs = Number(prepared.now) - Number(entry.lastTouchedAtMs);

    const semantic01 = this.defaults.enableSemanticRecall
      ? cosineSimilarityFromVectors(queryVector, entry.semanticVector)
      : 0.5 as Score01;

    const salience01 = entry.salience01;
    const recency01 = decay01(ageMs, this.defaults.recallTimeDecayHalfLifeMs);
    const continuity01 = clamp01(
      entry.continuityWeight01 * 0.58 +
      decay01(touchAgeMs, this.defaults.touchDecayHalfLifeMs) * 0.42,
    );
    const roleFit01 = scoreRoleFit(prepared.desiredRoles, entry.role);
    const channelFit01 = scoreChannelFit(prepared.activeChannel, entry.channels);
    const purposeFit01 = scorePurposeFit(prepared.purpose, entry);
    const phaseFit01 = scorePhaseFit(prepared.currentState, entry);
    const intentFit01 = scoreIntentFit(prepared.currentIntent, entry.intent);
    const eventFit01 = scoreEventFit(prepared.recentEventNames, entry.eventNames);
    const sequenceFit01 = clamp01(entry.sequenceWeight01);
    const emotionalFit01 = clamp01(entry.emotionalWeight01);
    const repetitionPenalty01 = clamp01(
      scoreRequiredTags(prepared.requiredTags, entry.tags) < 0.4
        ? this.defaults.crossChannelPenalty
        : entry.repeatPenalty01 * 0.5,
    );

    const roleBoost =
      prepared.purpose === 'HELPER' && isHelperRole(entry.role)
        ? this.defaults.helperCallbackBoost
        : prepared.purpose === 'HATER' && isHaterRole(entry.role)
          ? this.defaults.haterCallbackBoost
          : prepared.purpose === 'NEGOTIATION' && isDealRole(entry.role)
            ? this.defaults.negotiationCallbackBoost
            : prepared.purpose === 'RESCUE' && (entry.kind === 'RESCUE' || isHelperRole(entry.role))
              ? this.defaults.rescueCallbackBoost
              : prepared.purpose === 'POST_RUN' && entry.kind === 'POST_RUN'
                ? this.defaults.postRunReflectionBoost
                : entry.salienceBand === 'LEGEND'
                  ? this.defaults.legendCallbackBoost
                  : 0;

    const score01 = clamp01(
      semantic01 * this.defaults.semanticWeight +
      salience01 * this.defaults.salienceWeight +
      recency01 * this.defaults.recencyWeight +
      continuity01 * this.defaults.continuityWeight +
      roleFit01 * this.defaults.roleWeight +
      channelFit01 * this.defaults.channelWeight +
      purposeFit01 * this.defaults.purposeWeight +
      phaseFit01 * this.defaults.phaseWeight +
      intentFit01 * this.defaults.intentWeight +
      eventFit01 * this.defaults.eventWeight +
      sequenceFit01 * this.defaults.sequenceWeight +
      emotionalFit01 * this.defaults.emotionalWeight +
      roleBoost -
      repetitionPenalty01 * this.defaults.repetitionPenaltyWeight,
    );

    const neighbors = this.collectNeighbors(entry);

    const explanation = buildExplanation([
      `${entry.role.toLowerCase()} ${entry.kind.toLowerCase()} (${entry.activeChannel.toLowerCase()})`,
      `sem:${semantic01.toFixed(2)}`,
      `purpose:${purposeFit01.toFixed(2)}`,
      `phase:${phaseFit01.toFixed(2)}`,
      `intent:${intentFit01.toFixed(2)}`,
      `events:${eventFit01.toFixed(2)}`,
      `recency:${recency01.toFixed(2)}`,
      roleBoost > 0 ? `boost:+${roleBoost.toFixed(2)}` : '',
      repetitionPenalty01 > 0 ? `repeat:-${repetitionPenalty01.toFixed(2)}` : '',
    ]);

    return Object.freeze({
      entry,
      score01,
      similarity01: semantic01,
      breakdown: Object.freeze({
        semantic01,
        salience01,
        recency01,
        continuity01,
        roleFit01,
        channelFit01,
        purposeFit01,
        phaseFit01,
        intentFit01,
        eventFit01,
        sequenceFit01,
        emotionalFit01,
        repetitionPenalty01,
        explanation,
      }),
      neighborEntries: Object.freeze(neighbors),
    });
  }

  private collectNeighbors(
    entry: ChatSequenceMemoryEntry,
  ): readonly ChatSequenceMemoryEntry[] {
    const sequenceEntries = this.store.listBySequence(entry.sequenceId);
    const neighbors = sequenceEntries
      .filter((candidate) => candidate.anchorId !== entry.anchorId)
      .filter((candidate) =>
        Math.abs(candidate.sequenceIndex - entry.sequenceIndex) <= 1,
      )
      .slice(0, this.defaults.maxNeighborResults);

    return Object.freeze(neighbors);
  }

  private expandNeighborMatches(
    matches: readonly ChatSequenceMemoryMatch[],
  ): readonly ChatSequenceMemoryMatch[] {
    const seen = new Set<string>();
    const out: ChatSequenceMemoryMatch[] = [];

    for (const match of matches) {
      const anchorKey = String(match.entry.anchorId);
      if (!seen.has(anchorKey)) {
        seen.add(anchorKey);
        out.push(match);
      }

      for (const neighbor of match.neighborEntries) {
        const neighborKey = String(neighbor.anchorId);
        if (seen.has(neighborKey)) continue;

        seen.add(neighborKey);
        out.push(Object.freeze({
          entry: neighbor,
          score01: clamp01(match.score01 - (1 - this.defaults.sequenceNeighborBoost)),
          similarity01: match.similarity01,
          breakdown: Object.freeze({
            ...match.breakdown,
            explanation: buildExplanation([
              match.breakdown.explanation,
              'sequence-neighbor expansion',
            ]),
          }),
          neighborEntries: Object.freeze([]),
        }));
      }
    }

    return Object.freeze(
      out
        .sort((lhs, rhs) => Number(rhs.score01) - Number(lhs.score01))
        .slice(0, this.defaults.maxRecallResults),
    );
  }

  private bumpUsage(
    matches: readonly ChatSequenceMemoryMatch[],
    now: UnixMs,
  ): void {
    for (const match of matches) {
      this.touch(match.entry.anchorId, now);
    }
  }

  private enforceCaps(now: UnixMs): void {
    const currentSize = this.store.size();
    if (currentSize <= this.defaults.maxEntries) return;

    const entries = this.store.list()
      .sort((lhs, rhs) => {
        const lhsScore = Number(lhs.salience01) * 0.7 + Number(decay01(Number(now) - Number(lhs.lastTouchedAtMs), this.defaults.touchDecayHalfLifeMs)) * 0.3;
        const rhsScore = Number(rhs.salience01) * 0.7 + Number(decay01(Number(now) - Number(rhs.lastTouchedAtMs), this.defaults.touchDecayHalfLifeMs)) * 0.3;
        return lhsScore - rhsScore;
      });

    while (this.store.size() > this.defaults.maxEntries && entries.length > 0) {
      const candidate = entries.shift();
      if (!candidate) break;
      this.store.delete(String(candidate.anchorId));
      this.totals.compressions += 1;
    }
  }

  private emit(event: string, payload: JsonObject): void {
    this.telemetry?.emit?.(event, payload);
  }

  private nextRequestId(): string {
    this.requestCounter += 1;
    return `${this.requestPrefix}:${this.requestCounter}`;
  }
}

/* ========================================================================== */
/* MARK: Salience and inference helpers                                       */
/* ========================================================================== */

function inferKindFromSignals(
  text: string,
  role: ChatSequenceMemoryRole,
  channel: ChatVisibleChannel,
  eventNames: readonly string[],
): ChatSequenceMemoryKind {
  const lowerEvents = eventNames.map((value) => value.toLowerCase());
  if (lowerEvents.some((value) => LEGEND_EVENT_KEYS.some((key) => value.includes(key)))) {
    return 'LEGEND';
  }
  if (lowerEvents.some((value) => RESCUE_EVENT_KEYS.some((key) => value.includes(key)))) {
    return 'RESCUE';
  }
  if (lowerEvents.some((value) => NEGOTIATION_EVENT_KEYS.some((key) => value.includes(key)))) {
    return 'NEGOTIATION';
  }

  if (channel === 'DEAL_ROOM' || isDealRole(role)) return 'NEGOTIATION';
  if (isHelperRole(role) && /\b(help|save|assist|recover|breathe)\b/i.test(text)) return 'RESCUE';
  if (isHaterRole(role) && /\b(end|crush|hunt|bleed|fold|dead)\b/i.test(text)) return 'RIVALRY';
  if (/\b(post[- ]?run|debrief|turning point|what happened)\b/i.test(text)) return 'POST_RUN';
  return 'MESSAGE';
}

/* ========================================================================== */
/* MARK: Free helpers                                                         */
/* ========================================================================== */

export function createSequenceMemoryClient(
  options: ChatSequenceMemoryClientOptions = {},
): SequenceMemoryClient {
  return new SequenceMemoryClient(options);
}

export function createSequenceMemoryWriteInput(
  input: ChatSequenceMemoryWriteInput,
): ChatSequenceMemoryWriteInput {
  return Object.freeze({ ...input });
}

export function createSequenceMemoryRecallInput(
  input: ChatSequenceMemoryRecallInput,
): ChatSequenceMemoryRecallInput {
  return Object.freeze({ ...input });
}

export function buildSequenceMemorySummary(
  entries: readonly ChatSequenceMemoryEntry[],
): string {
  return buildSequenceSummary(entries, CHAT_SEQUENCE_MEMORY_CLIENT_DEFAULTS.maxSequenceSummaryChars);
}

export function compareSequenceMemoryEntries(
  lhs: ChatSequenceMemoryEntry,
  rhs: ChatSequenceMemoryEntry,
): Readonly<{
  similarity01: Score01;
  roleAgreement01: Score01;
  channelAgreement01: Score01;
  sequenceAgreement01: Score01;
}> {
  return Object.freeze({
    similarity01: cosineSimilarityFromVectors(lhs.semanticVector, rhs.semanticVector),
    roleAgreement01: lhs.role === rhs.role ? (1 as Score01) : (0 as Score01),
    channelAgreement01: lhs.activeChannel === rhs.activeChannel ? (1 as Score01) : (0 as Score01),
    sequenceAgreement01: lhs.sequenceId === rhs.sequenceId ? (1 as Score01) : (0 as Score01),
  });
}

export async function recallSequenceMemoryDeterministically(
  snapshot: ChatSequenceMemoryStoreSnapshot,
  input: ChatSequenceMemoryRecallInput,
  options: Partial<ChatSequenceMemoryClientOptions> = {},
): Promise<ChatSequenceMemoryRecallResult> {
  const client = createSequenceMemoryClient({
    ...options,
    initialSnapshot: snapshot,
  });

  return client.recall(input);
}

/* ========================================================================== */
/* MARK: Manifest                                                             */
/* ========================================================================== */

export const CHAT_SEQUENCE_MEMORY_CLIENT_MANIFEST = Object.freeze({
  moduleName: CHAT_SEQUENCE_MEMORY_CLIENT_MODULE_NAME,
  version: CHAT_SEQUENCE_MEMORY_CLIENT_VERSION,
  defaults: CHAT_SEQUENCE_MEMORY_CLIENT_DEFAULTS,
  runtimeLaws: CHAT_SEQUENCE_MEMORY_CLIENT_RUNTIME_LAWS,
  capabilities: Object.freeze({
    localSequenceAnchors: true,
    deterministicFallbackEmbeddings: true,
    advisorySemanticRecall: true,
    helperContinuity: true,
    haterContinuity: true,
    negotiationContinuity: true,
    neighborExpansion: true,
    replaySafeSnapshotting: true,
  }),
} as const);

export const ChatSequenceMemory = Object.freeze({
  SequenceMemoryClient,
  createSequenceMemoryClient,
  createSequenceMemoryWriteInput,
  createSequenceMemoryRecallInput,
  buildSequenceMemorySummary,
  compareSequenceMemoryEntries,
  recallSequenceMemoryDeterministically,
  manifest: CHAT_SEQUENCE_MEMORY_CLIENT_MANIFEST,
} as const);

export type ChatSequenceMemoryClientManifest =
  typeof CHAT_SEQUENCE_MEMORY_CLIENT_MANIFEST;
