// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/replay/ChatReplaySerializer.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT REPLAY SERIALIZER
 * FILE: pzo-web/src/engines/chat/replay/ChatReplaySerializer.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Deterministic serialization lane for the frontend replay system.
 *
 * This file does not replace `ChatReplayBuffer.ts`.
 * It consumes replay slices / recap views / transcript export bundles and turns
 * them into stable, transportable, hashable, backend-friendly export payloads.
 *
 * Why this file exists in your architecture
 * ----------------------------------------
 * - `ChatTranscriptBuffer.ts` owns bounded transcript working-set truth.
 * - `ChatReplayBuffer.ts` owns replay sessions, slice assembly, proof windows,
 *   legend extraction, continuity digests, and post-run recap shaping.
 * - This serializer owns deterministic export shape, canonical ordering,
 *   download-safe file generation, replay manifest construction, payload
 *   hashing, serializer-ready indexes, and stable re-hydration entry points.
 *
 * This matters in Point Zero One because replay is not a generic chat log dump.
 * Replay is a proof-bearing, legend-aware, dramaturgical artifact.
 * The serializer must preserve:
 * - channel identity,
 * - visible vs replay-only continuity,
 * - proof chains,
 * - legend moments,
 * - witness lines,
 * - moment / scene anchors,
 * - deterministic ordering,
 * - serializer-ready backend handoff.
 *
 * Permanent doctrine
 * ------------------
 * - Serialization must never invent transcript truth.
 * - Serialization may shape export structure; it may not fabricate lines.
 * - Proof-bearing messages remain immutable in serialized output.
 * - Replays are exported as views over transcript truth plus replay-specific
 *   orchestration metadata.
 * - Every serialized payload must be stable under repeated calls with the same
 *   replay bundle input.
 * - The serializer must support three output intents:
 *   1. human-inspectable JSON bundle,
 *   2. backend / storage oriented serializer-ready payload,
 *   3. compact summary payload for recap and lightweight sharing.
 *
 * Design laws
 * -----------
 * - Deterministic key order.
 * - No UI imports.
 * - No Node-only dependencies.
 * - Hash locally with pure TS utilities.
 * - File names are derived from replay facts, not caller whim.
 * - Every normalized entity gets both readable and index-friendly shape.
 * - Search corpus, proof tables, legend tables, and lookup maps are built once
 *   per serialization pass so downstream UI / backend code does not need to
 *   re-walk the entire slice.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import {
  CHAT_ENGINE_AUTHORITIES,
  CHAT_ENGINE_PUBLIC_API_VERSION,
  CHAT_ENGINE_VERSION,
  isVisibleChatChannel,
  type ChatChannelId,
  type ChatLegendId,
  type ChatMessage,
  type ChatMessageId,
  type ChatMomentId,
  type ChatProofHash,
  type ChatReplayId,
  type ChatVisibleChannel,
  type UnixMs,
} from '../types';

import type {
  ChatTranscriptExportBundle,
  ChatTranscriptRecord,
} from '../ChatTranscriptBuffer';

import {
  ChatReplayBuffer,
  type ChatReplayBufferCallbacks,
  type ChatReplayContinuityDigest,
  type ChatReplayExportBundle,
  type ChatReplayExportFormat,
  type ChatReplayLegendMoment,
  type ChatReplayMomentAnchor,
  type ChatReplayPostRunRecap,
  type ChatReplayProofReference,
  type ChatReplaySession,
  type ChatReplaySlice,
  type ChatReplaySliceRequest,
  type ChatReplaySummary,
  type ChatReplayThreadView,
  type ChatReplayTimelineSegment,
} from './ChatReplayBuffer';

// ============================================================================
// MARK: Public constants
// ============================================================================

export const CHAT_REPLAY_SERIALIZER_VERSION = '2026.03.13' as const;
export const CHAT_REPLAY_SERIALIZER_MODULE_NAME = 'PZO_CHAT_REPLAY_SERIALIZER' as const;

export const CHAT_REPLAY_SERIALIZER_FORMATS = Object.freeze([
  'JSON_PRETTY',
  'JSON_COMPACT',
  'SERIALIZER_READY_PRETTY',
  'SERIALIZER_READY_COMPACT',
  'SUMMARY_PRETTY',
  'SUMMARY_COMPACT',
  'NDJSON',
] as const);

export type ChatReplaySerializerFormat = (typeof CHAT_REPLAY_SERIALIZER_FORMATS)[number];

export type ChatReplaySerializationIntent =
  | 'EXPORT_SESSION'
  | 'EXPORT_BUFFER_REQUEST'
  | 'POST_RUN_RECAP'
  | 'LEGEND_ARCHIVE'
  | 'PROOF_AUDIT'
  | 'DOWNLOAD'
  | 'PERSISTENCE'
  | 'SHARE_CARD'
  | 'DEBUG';

export type ChatReplaySerializerOutputClass =
  | 'FULL_BUNDLE'
  | 'SERIALIZER_READY'
  | 'SUMMARY';

export type ChatReplayDigestAlgorithm =
  | 'FNV1A_32'
  | 'FNV1A_64_COMPAT';

// ============================================================================
// MARK: Public serializer configuration
// ============================================================================

export interface ChatReplaySerializerConfig {
  readonly prettyIndent?: number;
  readonly maxNarrativeLineLength?: number;
  readonly maxSummaryWitnessLines?: number;
  readonly maxSearchTerms?: number;
  readonly includeSearchCorpus?: boolean;
  readonly includeThreadIndexes?: boolean;
  readonly includeProofTables?: boolean;
  readonly includeLegendTables?: boolean;
  readonly includeTranscriptBundle?: boolean;
  readonly includeRawRecords?: boolean;
  readonly includeStableHashes?: boolean;
  readonly includeDerivedMetrics?: boolean;
  readonly includeDownloadHints?: boolean;
  readonly normalizeWhitespace?: boolean;
  readonly redactBodiesForSummary?: boolean;
  readonly digestAlgorithm?: ChatReplayDigestAlgorithm;
  readonly defaultFormat?: ChatReplaySerializerFormat;
  readonly fileNamePrefix?: string;
  readonly log?: (message: string, context?: Record<string, unknown>) => void;
  readonly warn?: (message: string, context?: Record<string, unknown>) => void;
  readonly error?: (message: string, context?: Record<string, unknown>) => void;
}

export interface ChatReplaySerializationOptions {
  readonly intent?: ChatReplaySerializationIntent;
  readonly format?: ChatReplaySerializerFormat;
  readonly includeTranscriptBundle?: boolean;
  readonly includeRawRecords?: boolean;
  readonly includeSearchCorpus?: boolean;
  readonly includeProofTables?: boolean;
  readonly includeLegendTables?: boolean;
  readonly includeThreadIndexes?: boolean;
  readonly includeStableHashes?: boolean;
  readonly includeDerivedMetrics?: boolean;
  readonly includeDownloadHints?: boolean;
  readonly redactBodiesForSummary?: boolean;
  readonly fileName?: string;
  readonly exportFormatOverride?: ChatReplayExportFormat;
}

export interface ChatReplayDownloadArtifact {
  readonly fileName: string;
  readonly mimeType: 'application/json' | 'application/x-ndjson';
  readonly format: ChatReplaySerializerFormat;
  readonly body: string;
  readonly byteLength: number;
  readonly digest: string;
  readonly outputClass: ChatReplaySerializerOutputClass;
}

// ============================================================================
// MARK: Public normalized entity types
// ============================================================================

export interface ChatReplayNormalizedMessage {
  readonly id: ChatMessageId;
  readonly channel: ChatVisibleChannel;
  readonly kind: string;
  readonly senderId?: string;
  readonly senderName?: string;
  readonly senderRank?: string;
  readonly ts: UnixMs;
  readonly immutable: boolean;
  readonly body?: string;
  readonly emoji?: string;
  readonly proofHash?: ChatProofHash;
  readonly replayId?: ChatReplayId;
  readonly sceneId?: string;
  readonly momentId?: ChatMomentId;
  readonly legendId?: ChatLegendId;
  readonly tags: readonly string[];
  readonly pressureTier?: string;
  readonly tickTier?: string;
  readonly runOutcome?: string;
  readonly replayEligible: boolean;
  readonly legendEligible: boolean;
  readonly worldEventEligible: boolean;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly stableBodyDigest: string;
  readonly searchText: string;
}

export interface ChatReplayNormalizedRecord {
  readonly id: ChatMessageId;
  readonly channel: ChatVisibleChannel;
  readonly state?: string;
  readonly ackedServerId?: string;
  readonly insertedAt?: UnixMs;
  readonly authoritativeSequence?: number;
  readonly requestId?: string;
  readonly roomId?: string;
  readonly sessionId?: string;
  readonly body?: string;
  readonly redactedBody?: string;
  readonly immutable: boolean;
  readonly proofHash?: ChatProofHash;
  readonly replayId?: ChatReplayId;
  readonly sceneId?: string;
  readonly momentId?: ChatMomentId;
  readonly legendId?: ChatLegendId;
  readonly tags: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChatReplayNormalizedSegment {
  readonly id: string;
  readonly channel: ChatVisibleChannel;
  readonly timelineClass: string;
  readonly dominantKind: string;
  readonly startTs: UnixMs;
  readonly endTs: UnixMs;
  readonly durationMs: number;
  readonly messageIds: readonly ChatMessageId[];
  readonly messageCount: number;
  readonly witnessCount: number;
  readonly summaryLine: string;
  readonly sceneId?: string;
  readonly momentId?: ChatMomentId;
  readonly anchorMessageId?: ChatMessageId;
  readonly proofHashes: readonly ChatProofHash[];
  readonly legendIds: readonly ChatLegendId[];
  readonly pressureBand?: string;
  readonly tickBand?: string;
}

export interface ChatReplayNormalizedProofReference {
  readonly proofHash: ChatProofHash;
  readonly channel: ChatVisibleChannel;
  readonly proofClass: string;
  readonly firstTs: UnixMs;
  readonly lastTs: UnixMs;
  readonly durationMs: number;
  readonly immutableCount: number;
  readonly messageIds: readonly ChatMessageId[];
  readonly segmentIds: readonly string[];
  readonly lineCount: number;
}

export interface ChatReplayNormalizedLegendMoment {
  readonly legendId: ChatLegendId;
  readonly messageId: ChatMessageId;
  readonly channel: ChatVisibleChannel;
  readonly ts: UnixMs;
  readonly title: string;
  readonly legendClass: string;
  readonly prestigeScore: number;
  readonly proofHash?: ChatProofHash;
  readonly witnessMessageIds: readonly ChatMessageId[];
  readonly replayId?: ChatReplayId;
}

export interface ChatReplayNormalizedMomentAnchor {
  readonly momentId: ChatMomentId;
  readonly channel: ChatVisibleChannel;
  readonly firstMessageId: ChatMessageId;
  readonly lastMessageId: ChatMessageId;
  readonly firstTs: UnixMs;
  readonly lastTs: UnixMs;
  readonly durationMs: number;
  readonly messageIds: readonly ChatMessageId[];
  readonly sceneIds: readonly string[];
}

export interface ChatReplayNormalizedThreadView {
  readonly id: string;
  readonly channel: ChatVisibleChannel;
  readonly label: string;
  readonly firstTs: UnixMs;
  readonly lastTs: UnixMs;
  readonly durationMs: number;
  readonly messageIds: readonly ChatMessageId[];
  readonly counterpartIds: readonly string[];
}

export interface ChatReplayNormalizedContinuityDigest {
  readonly channel: ChatVisibleChannel;
  readonly builtAt: UnixMs;
  readonly unresolvedMomentIds: readonly ChatMomentId[];
  readonly topProofHashes: readonly ChatProofHash[];
  readonly legendIds: readonly ChatLegendId[];
  readonly recurringCounterpartIds: readonly string[];
  readonly callbackCandidateMessageIds: readonly ChatMessageId[];
  readonly summaryLine: string;
  readonly digest: string;
}

export interface ChatReplayNormalizedSummary {
  readonly channel: ChatVisibleChannel;
  readonly totalRecords: number;
  readonly replayEligibleCount: number;
  readonly proofCount: number;
  readonly legendCount: number;
  readonly immutableCount: number;
  readonly playerLines: number;
  readonly helperLines: number;
  readonly haterLines: number;
  readonly ambientLines: number;
  readonly worldEventLines: number;
  readonly startTs?: UnixMs;
  readonly endTs?: UnixMs;
  readonly durationMs?: number;
  readonly turningPointMessageIds: readonly ChatMessageId[];
  readonly dominantPressureTier?: string;
  readonly dominantTickTier?: string;
  readonly lastWordMessageId?: ChatMessageId;
  readonly ratios: Readonly<{
    player: number;
    helper: number;
    hater: number;
    ambient: number;
    worldEvent: number;
    immutable: number;
  }>;
}

export interface ChatReplayIndexTable {
  readonly messageIds: Readonly<Record<string, number>>;
  readonly segmentIds: Readonly<Record<string, number>>;
  readonly proofHashes: Readonly<Record<string, number>>;
  readonly legendIds: Readonly<Record<string, number>>;
  readonly momentIds: Readonly<Record<string, number>>;
  readonly threadIds: Readonly<Record<string, number>>;
  readonly tags: Readonly<Record<string, readonly string[]>>;
}

export interface ChatReplayDerivedMetrics {
  readonly witnessDensity: number;
  readonly proofDensity: number;
  readonly legendDensity: number;
  readonly immutableDensity: number;
  readonly averageSegmentDurationMs: number;
  readonly averageThreadDurationMs: number;
  readonly averageLinesPerSegment: number;
  readonly averageLinesPerThread: number;
  readonly prestigeTotal: number;
  readonly prestigeAverage: number;
  readonly recapLineCount: number;
  readonly counterpartSpread: number;
}

export interface ChatReplaySearchCorpus {
  readonly terms: readonly string[];
  readonly messages: Readonly<Record<string, string>>;
  readonly legends: Readonly<Record<string, string>>;
  readonly proofs: Readonly<Record<string, string>>;
  readonly segments: Readonly<Record<string, string>>;
  readonly continuity: string;
}

export interface ChatReplayDownloadHints {
  readonly suggestedFileName: string;
  readonly prettyFileName: string;
  readonly compactFileName: string;
  readonly ndjsonFileName: string;
  readonly shareSlug: string;
}

export interface ChatReplaySerializedSlice {
  readonly channel: ChatVisibleChannel;
  readonly builtAt: UnixMs;
  readonly reason: string;
  readonly anchorStrategy: string;
  readonly session: ChatReplaySession;
  readonly summary: ChatReplayNormalizedSummary;
  readonly continuity: ChatReplayNormalizedContinuityDigest;
  readonly messages: readonly ChatReplayNormalizedMessage[];
  readonly records?: readonly ChatReplayNormalizedRecord[];
  readonly segments: readonly ChatReplayNormalizedSegment[];
  readonly proofReferences: readonly ChatReplayNormalizedProofReference[];
  readonly legendMoments: readonly ChatReplayNormalizedLegendMoment[];
  readonly momentAnchors: readonly ChatReplayNormalizedMomentAnchor[];
  readonly threadViews: readonly ChatReplayNormalizedThreadView[];
  readonly indexes: ChatReplayIndexTable;
  readonly derivedMetrics?: ChatReplayDerivedMetrics;
}

export interface ChatReplaySerializedRecap {
  readonly channel: ChatVisibleChannel;
  readonly builtAt: UnixMs;
  readonly narrativeLine: string;
  readonly turningPoints: readonly ChatReplayNormalizedLegendMoment[];
  readonly witnessMessageIds: readonly ChatMessageId[];
  readonly proofHighlights: readonly ChatReplayNormalizedProofReference[];
  readonly finalWordMessageId?: ChatMessageId;
}

export interface ChatReplaySerializedPayload {
  readonly outputClass: ChatReplaySerializerOutputClass;
  readonly engineVersion: string;
  readonly serializerVersion: string;
  readonly apiVersion: string;
  readonly authorities: typeof CHAT_ENGINE_AUTHORITIES;
  readonly digest: string;
  readonly digestAlgorithm: ChatReplayDigestAlgorithm;
  readonly manifest: ChatReplaySerializationManifest;
  readonly slice: ChatReplaySerializedSlice;
  readonly recap?: ChatReplaySerializedRecap;
  readonly transcriptBundle?: unknown;
  readonly searchCorpus?: ChatReplaySearchCorpus;
  readonly downloadHints?: ChatReplayDownloadHints;
}

export interface ChatReplaySerializationManifest {
  readonly moduleName: typeof CHAT_REPLAY_SERIALIZER_MODULE_NAME;
  readonly builtAt: UnixMs;
  readonly intent: ChatReplaySerializationIntent;
  readonly format: ChatReplaySerializerFormat;
  readonly replayExportFormat: ChatReplayExportFormat;
  readonly outputClass: ChatReplaySerializerOutputClass;
  readonly channel: ChatVisibleChannel;
  readonly replayId?: ChatReplayId;
  readonly sessionId: string;
  readonly messageCount: number;
  readonly segmentCount: number;
  readonly proofCount: number;
  readonly legendCount: number;
  readonly momentCount: number;
  readonly threadCount: number;
  readonly stableHashReady: boolean;
  readonly transcriptIncluded: boolean;
  readonly rawRecordsIncluded: boolean;
  readonly searchIncluded: boolean;
  readonly derivedMetricsIncluded: boolean;
  readonly fileName: string;
  readonly fileStem: string;
}

export interface ChatReplaySerializedEnvelope {
  readonly manifest: ChatReplaySerializationManifest;
  readonly payload: ChatReplaySerializedPayload;
  readonly text: string;
  readonly byteLength: number;
}

// ============================================================================
// MARK: Default configuration
// ============================================================================

const DEFAULT_CONFIG: Required<
  Pick<
    ChatReplaySerializerConfig,
    | 'prettyIndent'
    | 'maxNarrativeLineLength'
    | 'maxSummaryWitnessLines'
    | 'maxSearchTerms'
    | 'includeSearchCorpus'
    | 'includeThreadIndexes'
    | 'includeProofTables'
    | 'includeLegendTables'
    | 'includeTranscriptBundle'
    | 'includeRawRecords'
    | 'includeStableHashes'
    | 'includeDerivedMetrics'
    | 'includeDownloadHints'
    | 'normalizeWhitespace'
    | 'redactBodiesForSummary'
    | 'digestAlgorithm'
    | 'defaultFormat'
    | 'fileNamePrefix'
  >
> = {
  prettyIndent: 2,
  maxNarrativeLineLength: 260,
  maxSummaryWitnessLines: 8,
  maxSearchTerms: 2048,
  includeSearchCorpus: true,
  includeThreadIndexes: true,
  includeProofTables: true,
  includeLegendTables: true,
  includeTranscriptBundle: true,
  includeRawRecords: true,
  includeStableHashes: true,
  includeDerivedMetrics: true,
  includeDownloadHints: true,
  normalizeWhitespace: true,
  redactBodiesForSummary: false,
  digestAlgorithm: 'FNV1A_64_COMPAT',
  defaultFormat: 'JSON_PRETTY',
  fileNamePrefix: 'pzo-chat-replay',
};

// ============================================================================
// MARK: Utility functions
// ============================================================================

function now(): UnixMs {
  return Date.now() as UnixMs;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeMaybeText(value: unknown, shouldNormalize: boolean): string | undefined {
  if (typeof value !== 'string') return undefined;
  const next = shouldNormalize ? normalizeWhitespace(value) : value.trim();
  return next.length ? next : undefined;
}

function normalizeStringArray(value: unknown, shouldNormalize: boolean): readonly string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const next = shouldNormalize ? normalizeWhitespace(item) : item.trim();
    if (!next) continue;
    if (!out.includes(next)) out.push(next);
  }
  return out;
}

function safeNumber(value: unknown, fallback = 0): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function unixMs(value: unknown): UnixMs | undefined {
  if (!Number.isFinite(value)) return undefined;
  return Number(value) as UnixMs;
}

function compareStringsAsc(a: string, b: string): number {
  return a.localeCompare(b);
}

function compareNumbersAsc(a: number, b: number): number {
  return a - b;
}

function compareUnixAsc(a?: UnixMs, b?: UnixMs): number {
  return safeNumber(a, 0) - safeNumber(b, 0);
}

function sortUniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort(compareStringsAsc);
}

function createError(message: string): Error {
  return new Error(`[ChatReplaySerializer] ${message}`);
}

function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function fnv1a64Compat(input: string): string {
  let hi = 0xcbf29ce4;
  let lo = 0x84222325;
  for (let i = 0; i < input.length; i += 1) {
    lo ^= input.charCodeAt(i);

    const loMul = Math.imul(lo, 0x1b3);
    const cross1 = Math.imul(hi, 0x1b3);
    const cross2 = Math.imul(lo >>> 16, 0x100);

    hi = (cross1 + cross2 + ((loMul / 0x100000000) >>> 0)) >>> 0;
    lo = loMul >>> 0;
  }
  return `${hi.toString(16).padStart(8, '0')}${lo.toString(16).padStart(8, '0')}`;
}

function digestString(input: string, algorithm: ChatReplayDigestAlgorithm): string {
  return algorithm === 'FNV1A_32'
    ? fnv1a32(input)
    : fnv1a64Compat(input);
}

function stableSortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableSortObjectKeys);
  }
  if (!isObject(value)) {
    return value;
  }

  const output: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort(compareStringsAsc)) {
    output[key] = stableSortObjectKeys(value[key]);
  }
  return output;
}

function stableStringify(value: unknown, indent?: number): string {
  return JSON.stringify(stableSortObjectKeys(value), null, indent);
}

function byteLengthOf(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  return value.length;
}

function shorten(value: string | undefined, max: number): string | undefined {
  if (!value) return undefined;
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function joinSearchParts(parts: readonly (string | undefined)[], shouldNormalize: boolean): string {
  const out = parts.filter((value): value is string => typeof value === 'string' && value.trim().length > 0).join(' | ');
  return shouldNormalize ? normalizeWhitespace(out) : out;
}

function asReadonlyRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (!isObject(value)) return Object.freeze({});
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    out[key] = stableSortObjectKeys(inner);
  }
  return Object.freeze(out);
}

function normalizedChannel(channel: unknown): ChatVisibleChannel {
  if (isVisibleChatChannel(channel)) return channel;
  return 'GLOBAL';
}

function ensureArray<T>(value: readonly T[] | undefined | null): readonly T[] {
  return Array.isArray(value) ? value : [];
}

function makeFileStem(input: {
  readonly prefix: string;
  readonly channel: ChatVisibleChannel;
  readonly builtAt: UnixMs;
  readonly replayId?: ChatReplayId;
  readonly sessionId: string;
  readonly outputClass: ChatReplaySerializerOutputClass;
}): string {
  const time = safeNumber(input.builtAt, Date.now());
  const replayStem = input.replayId ? slugify(String(input.replayId)) : slugify(input.sessionId);
  return [
    slugify(input.prefix),
    slugify(input.channel),
    slugify(input.outputClass),
    replayStem || 'session',
    String(time),
  ].filter(Boolean).join('__');
}

// ============================================================================
// MARK: Serializer
// ============================================================================

export class ChatReplaySerializer {
  private readonly config: Required<
    Pick<
      ChatReplaySerializerConfig,
      | 'prettyIndent'
      | 'maxNarrativeLineLength'
      | 'maxSummaryWitnessLines'
      | 'maxSearchTerms'
      | 'includeSearchCorpus'
      | 'includeThreadIndexes'
      | 'includeProofTables'
      | 'includeLegendTables'
      | 'includeTranscriptBundle'
      | 'includeRawRecords'
      | 'includeStableHashes'
      | 'includeDerivedMetrics'
      | 'includeDownloadHints'
      | 'normalizeWhitespace'
      | 'redactBodiesForSummary'
      | 'digestAlgorithm'
      | 'defaultFormat'
      | 'fileNamePrefix'
    >
  >;

  private readonly log?: ChatReplaySerializerConfig['log'];
  private readonly warn?: ChatReplaySerializerConfig['warn'];
  private readonly error?: ChatReplaySerializerConfig['error'];

  public constructor(config: ChatReplaySerializerConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
    this.log = config.log;
    this.warn = config.warn;
    this.error = config.error;
  }

  // -------------------------------------------------------------------------
  // Entry points — buffer integrated
  // -------------------------------------------------------------------------

  public serializeBufferSession(
    buffer: ChatReplayBuffer,
    input: {
      readonly sessionId?: string;
      readonly channel?: ChatVisibleChannel;
      readonly format?: ChatReplaySerializerFormat;
      readonly options?: Omit<ChatReplaySerializationOptions, 'format'>;
    } = {},
  ): ChatReplaySerializedEnvelope {
    const bundle = buffer.exportSession({
      sessionId: input.sessionId,
      channel: input.channel,
    });

    return this.serializeBundle(bundle, {
      ...input.options,
      format: input.format,
      intent: input.options?.intent ?? 'EXPORT_SESSION',
    });
  }

  public serializeBufferRequest(
    buffer: ChatReplayBuffer,
    request: ChatReplaySliceRequest,
    options: ChatReplaySerializationOptions = {},
  ): ChatReplaySerializedEnvelope {
    const slice = buffer.buildSlice(request);
    const bundle: ChatReplayExportBundle = {
      format: options.exportFormatOverride ?? 'JSON_BUNDLE',
      builtAt: now(),
      engineVersion: CHAT_ENGINE_VERSION,
      authorities: CHAT_ENGINE_AUTHORITIES,
      slice,
      serializerHint: {
        pendingFile: '/pzo-web/src/engines/chat/replay/ChatReplaySerializer.ts',
        ready: true,
      },
      transcriptBundle: undefined,
    };

    return this.serializeBundle(bundle, {
      ...options,
      intent: options.intent ?? 'EXPORT_BUFFER_REQUEST',
      includeTranscriptBundle: false,
    });
  }

  // -------------------------------------------------------------------------
  // Entry points — bundle / recap
  // -------------------------------------------------------------------------

  public serializeBundle(
    bundle: ChatReplayExportBundle,
    options: ChatReplaySerializationOptions = {},
  ): ChatReplaySerializedEnvelope {
    const format = options.format ?? this.config.defaultFormat;
    const outputClass = this.resolveOutputClass(format);
    const intent = options.intent ?? 'EXPORT_SESSION';

    const normalizedSlice = this.normalizeSlice(bundle.slice, {
      includeRawRecords: options.includeRawRecords ?? this.config.includeRawRecords,
      includeDerivedMetrics: options.includeDerivedMetrics ?? this.config.includeDerivedMetrics,
      includeProofTables: options.includeProofTables ?? this.config.includeProofTables,
      includeLegendTables: options.includeLegendTables ?? this.config.includeLegendTables,
      includeThreadIndexes: options.includeThreadIndexes ?? this.config.includeThreadIndexes,
      redactBodiesForSummary: options.redactBodiesForSummary ?? this.config.redactBodiesForSummary,
    });

    const manifest = this.buildManifest({
      format,
      intent,
      outputClass,
      bundle,
      slice: normalizedSlice,
      fileName: options.fileName,
    });

    const payload: ChatReplaySerializedPayload = {
      outputClass,
      engineVersion: CHAT_ENGINE_VERSION,
      serializerVersion: CHAT_REPLAY_SERIALIZER_VERSION,
      apiVersion: CHAT_ENGINE_PUBLIC_API_VERSION,
      authorities: CHAT_ENGINE_AUTHORITIES,
      digest: '',
      digestAlgorithm: this.config.digestAlgorithm,
      manifest,
      slice: normalizedSlice,
      recap: undefined,
      transcriptBundle: this.shouldIncludeTranscriptBundle(options)
        ? this.normalizeTranscriptBundle(bundle.transcriptBundle)
        : undefined,
      searchCorpus: this.shouldIncludeSearchCorpus(options)
        ? this.buildSearchCorpus(normalizedSlice)
        : undefined,
      downloadHints: this.shouldIncludeDownloadHints(options)
        ? this.buildDownloadHints(manifest)
        : undefined,
    };

    const digest = this.computePayloadDigest(payload);
    const finalPayload: ChatReplaySerializedPayload = {
      ...payload,
      digest,
    };

    return this.finalizeEnvelope(finalPayload, format);
  }

  public serializeRecap(
    recap: ChatReplayPostRunRecap,
    options: ChatReplaySerializationOptions = {},
  ): ChatReplaySerializedEnvelope {
    const format = options.format ?? this.config.defaultFormat;
    const outputClass = this.resolveOutputClass(format);
    const intent = options.intent ?? 'POST_RUN_RECAP';

    const normalizedSlice = this.normalizeSlice(recap.slice, {
      includeRawRecords: false,
      includeDerivedMetrics: true,
      includeProofTables: true,
      includeLegendTables: true,
      includeThreadIndexes: true,
      redactBodiesForSummary: options.redactBodiesForSummary ?? this.config.redactBodiesForSummary,
    });

    const normalizedRecap = this.normalizeRecap(recap, normalizedSlice);

    const manifest = this.buildManifest({
      format,
      intent,
      outputClass,
      bundle: {
        format: options.exportFormatOverride ?? 'SUMMARY_ONLY',
        builtAt: recap.builtAt,
        engineVersion: CHAT_ENGINE_VERSION,
        authorities: CHAT_ENGINE_AUTHORITIES,
        slice: recap.slice,
        serializerHint: {
          pendingFile: '/pzo-web/src/engines/chat/replay/ChatReplaySerializer.ts',
          ready: true,
        },
        transcriptBundle: undefined,
      },
      slice: normalizedSlice,
      fileName: options.fileName,
    });

    const payload: ChatReplaySerializedPayload = {
      outputClass,
      engineVersion: CHAT_ENGINE_VERSION,
      serializerVersion: CHAT_REPLAY_SERIALIZER_VERSION,
      apiVersion: CHAT_ENGINE_PUBLIC_API_VERSION,
      authorities: CHAT_ENGINE_AUTHORITIES,
      digest: '',
      digestAlgorithm: this.config.digestAlgorithm,
      manifest,
      slice: normalizedSlice,
      recap: normalizedRecap,
      transcriptBundle: undefined,
      searchCorpus: this.shouldIncludeSearchCorpus(options)
        ? this.buildSearchCorpus(normalizedSlice, normalizedRecap)
        : undefined,
      downloadHints: this.shouldIncludeDownloadHints(options)
        ? this.buildDownloadHints(manifest)
        : undefined,
    };

    const digest = this.computePayloadDigest(payload);
    return this.finalizeEnvelope({ ...payload, digest }, format);
  }

  // -------------------------------------------------------------------------
  // Download helpers
  // -------------------------------------------------------------------------

  public buildDownloadArtifact(
    envelope: ChatReplaySerializedEnvelope,
    formatOverride?: ChatReplaySerializerFormat,
  ): ChatReplayDownloadArtifact {
    const format = formatOverride ?? envelope.manifest.format;
    const text = this.reencodeEnvelope(envelope.payload, format);

    return {
      fileName: this.replaceFileExtension(envelope.manifest.fileName, format === 'NDJSON' ? '.ndjson' : '.json'),
      mimeType: format === 'NDJSON' ? 'application/x-ndjson' : 'application/json',
      format,
      body: text,
      byteLength: byteLengthOf(text),
      digest: digestString(text, this.config.digestAlgorithm),
      outputClass: envelope.payload.outputClass,
    };
  }

  public parseEnvelope(raw: string): ChatReplaySerializedEnvelope {
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed)) {
      throw createError('Parsed replay envelope is not an object.');
    }

    const manifest = parsed.manifest;
    const payload = parsed.payload;
    if (!isObject(manifest) || !isObject(payload)) {
      throw createError('Parsed replay envelope is missing manifest or payload.');
    }

    const text = stableStringify(parsed, this.config.prettyIndent);
    const byteLength = byteLengthOf(text);

    return {
      manifest: stableSortObjectKeys(manifest) as ChatReplaySerializationManifest,
      payload: stableSortObjectKeys(payload) as ChatReplaySerializedPayload,
      text,
      byteLength,
    };
  }

  public validateEnvelopeShape(envelope: ChatReplaySerializedEnvelope): boolean {
    return Boolean(
      envelope
      && envelope.manifest
      && envelope.payload
      && envelope.manifest.moduleName === CHAT_REPLAY_SERIALIZER_MODULE_NAME
      && typeof envelope.payload.digest === 'string'
      && envelope.payload.slice
      && Array.isArray(envelope.payload.slice.messages)
      && Array.isArray(envelope.payload.slice.segments),
    );
  }

  // -------------------------------------------------------------------------
  // Normalization — slice
  // -------------------------------------------------------------------------

  private normalizeSlice(
    slice: ChatReplaySlice,
    options: {
      readonly includeRawRecords: boolean;
      readonly includeDerivedMetrics: boolean;
      readonly includeProofTables: boolean;
      readonly includeLegendTables: boolean;
      readonly includeThreadIndexes: boolean;
      readonly redactBodiesForSummary: boolean;
    },
  ): ChatReplaySerializedSlice {
    const messages = [...slice.messages]
      .map((message) => this.normalizeMessage(message, options.redactBodiesForSummary))
      .sort((a, b) => compareUnixAsc(a.ts, b.ts) || compareStringsAsc(String(a.id), String(b.id)));

    const records = options.includeRawRecords
      ? [...slice.records]
        .map((record) => this.normalizeRecord(record))
        .sort((a, b) => compareUnixAsc(a.insertedAt, b.insertedAt) || compareStringsAsc(String(a.id), String(b.id)))
      : undefined;

    const segments = [...slice.segments]
      .map((segment) => this.normalizeSegment(segment))
      .sort((a, b) => compareUnixAsc(a.startTs, b.startTs) || compareStringsAsc(a.id, b.id));

    const proofReferences = options.includeProofTables
      ? [...slice.proofReferences]
        .map((proof) => this.normalizeProofReference(proof))
        .sort((a, b) => compareUnixAsc(a.firstTs, b.firstTs) || compareStringsAsc(String(a.proofHash), String(b.proofHash)))
      : [];

    const legendMoments = options.includeLegendTables
      ? [...slice.legendMoments]
        .map((legend) => this.normalizeLegendMoment(legend))
        .sort((a, b) => compareUnixAsc(a.ts, b.ts) || compareStringsAsc(String(a.legendId), String(b.legendId)))
      : [];

    const momentAnchors = [...slice.momentAnchors]
      .map((moment) => this.normalizeMomentAnchor(moment))
      .sort((a, b) => compareUnixAsc(a.firstTs, b.firstTs) || compareStringsAsc(String(a.momentId), String(b.momentId)));

    const threadViews = options.includeThreadIndexes
      ? [...slice.threadViews]
        .map((thread) => this.normalizeThreadView(thread))
        .sort((a, b) => compareUnixAsc(a.firstTs, b.firstTs) || compareStringsAsc(a.id, b.id))
      : [];

    const summary = this.normalizeSummary(slice.summary);
    const continuity = this.normalizeContinuity(slice.continuity);
    const indexes = this.buildIndexes({
      messages,
      segments,
      proofReferences,
      legendMoments,
      momentAnchors,
      threadViews,
    });

    return {
      channel: slice.channel,
      builtAt: slice.builtAt,
      reason: slice.reason,
      anchorStrategy: slice.anchorStrategy,
      session: slice.session,
      summary,
      continuity,
      messages,
      records,
      segments,
      proofReferences,
      legendMoments,
      momentAnchors,
      threadViews,
      indexes,
      derivedMetrics: options.includeDerivedMetrics
        ? this.buildDerivedMetrics({ summary, segments, threadViews, legendMoments, proofReferences })
        : undefined,
    };
  }

  private normalizeMessage(
    message: ChatMessage,
    redactBodiesForSummary: boolean,
  ): ChatReplayNormalizedMessage {
    const anyMessage = message as unknown as Record<string, unknown>;
    const body = normalizeMaybeText(anyMessage.body, this.config.normalizeWhitespace);
    const tags = normalizeStringArray(anyMessage.tags, this.config.normalizeWhitespace);
    const meta = asReadonlyRecord(anyMessage.meta);
    const legend = isObject(anyMessage.legend) ? anyMessage.legend : undefined;
    const replay = isObject(anyMessage.replay) ? anyMessage.replay : undefined;

    const searchText = joinSearchParts([
      normalizeMaybeText(anyMessage.senderName, this.config.normalizeWhitespace),
      normalizeMaybeText(anyMessage.kind, this.config.normalizeWhitespace),
      body,
      normalizeMaybeText((legend as Record<string, unknown> | undefined)?.title, this.config.normalizeWhitespace),
      ...tags,
    ], this.config.normalizeWhitespace);

    const visibleBody = redactBodiesForSummary && !Boolean(anyMessage.proofHash)
      ? shorten(body, 96)
      : body;

    return {
      id: anyMessage.id as ChatMessageId,
      channel: normalizedChannel(anyMessage.channel),
      kind: String(anyMessage.kind ?? 'UNKNOWN'),
      senderId: normalizeMaybeText(anyMessage.senderId, false),
      senderName: normalizeMaybeText(anyMessage.senderName, this.config.normalizeWhitespace),
      senderRank: normalizeMaybeText(anyMessage.senderRank, this.config.normalizeWhitespace),
      ts: unixMs(anyMessage.ts) ?? (0 as UnixMs),
      immutable: Boolean(anyMessage.immutable),
      body: visibleBody,
      emoji: normalizeMaybeText(anyMessage.emoji, false),
      proofHash: normalizeMaybeText(anyMessage.proofHash, false) as ChatProofHash | undefined,
      replayId: normalizeMaybeText((replay as Record<string, unknown> | undefined)?.replayId, false) as ChatReplayId | undefined,
      sceneId: normalizeMaybeText(anyMessage.sceneId, false),
      momentId: normalizeMaybeText(anyMessage.momentId, false) as ChatMomentId | undefined,
      legendId: normalizeMaybeText((legend as Record<string, unknown> | undefined)?.legendId, false) as ChatLegendId | undefined,
      tags,
      pressureTier: normalizeMaybeText(anyMessage.pressureTier, false),
      tickTier: normalizeMaybeText(anyMessage.tickTier, false),
      runOutcome: normalizeMaybeText(anyMessage.runOutcome, false),
      replayEligible: Boolean((replay as Record<string, unknown> | undefined)?.replayEligible ?? true),
      legendEligible: Boolean((replay as Record<string, unknown> | undefined)?.legendEligible ?? Boolean(legend)),
      worldEventEligible: Boolean((replay as Record<string, unknown> | undefined)?.worldEventEligible ?? false),
      metadata: meta,
      stableBodyDigest: digestString(visibleBody ?? '', this.config.digestAlgorithm),
      searchText,
    };
  }

  private normalizeRecord(record: ChatTranscriptRecord): ChatReplayNormalizedRecord {
    const anyRecord = record as unknown as Record<string, unknown>;
    const metadata = asReadonlyRecord(anyRecord.metadata);

    return {
      id: (anyRecord.ackedServerId ?? anyRecord.messageId) as ChatMessageId,
      channel: normalizedChannel(anyRecord.channel),
      state: normalizeMaybeText(anyRecord.state, false),
      ackedServerId: normalizeMaybeText(anyRecord.ackedServerId, false),
      insertedAt: unixMs(anyRecord.insertedAt),
      authoritativeSequence: Number.isFinite(anyRecord.authoritativeSequence) ? Number(anyRecord.authoritativeSequence) : undefined,
      requestId: normalizeMaybeText(anyRecord.requestId, false),
      roomId: normalizeMaybeText(anyRecord.roomId, false),
      sessionId: normalizeMaybeText(anyRecord.sessionId, false),
      body: normalizeMaybeText(anyRecord.body, this.config.normalizeWhitespace),
      redactedBody: normalizeMaybeText(anyRecord.redactedBody, this.config.normalizeWhitespace),
      immutable: Boolean(anyRecord.immutable),
      proofHash: normalizeMaybeText(anyRecord.proofHash, false) as ChatProofHash | undefined,
      replayId: normalizeMaybeText((metadata as Record<string, unknown>).replayId, false) as ChatReplayId | undefined,
      sceneId: normalizeMaybeText((metadata as Record<string, unknown>).sceneId, false),
      momentId: normalizeMaybeText((metadata as Record<string, unknown>).momentId, false) as ChatMomentId | undefined,
      legendId: normalizeMaybeText((metadata as Record<string, unknown>).legendId, false) as ChatLegendId | undefined,
      tags: normalizeStringArray((metadata as Record<string, unknown>).tags, this.config.normalizeWhitespace),
      metadata,
    };
  }

  private normalizeSegment(segment: ChatReplayTimelineSegment): ChatReplayNormalizedSegment {
    return {
      id: segment.id,
      channel: segment.channel,
      timelineClass: segment.timelineClass,
      dominantKind: segment.dominantKind,
      startTs: segment.startTs,
      endTs: segment.endTs,
      durationMs: Math.max(0, safeNumber(segment.endTs, 0) - safeNumber(segment.startTs, 0)),
      messageIds: sortUniqueStrings(segment.messageIds.map(String)) as readonly ChatMessageId[],
      messageCount: segment.messageIds.length,
      witnessCount: segment.witnessCount,
      summaryLine: normalizeWhitespace(segment.summaryLine),
      sceneId: segment.sceneId,
      momentId: segment.momentId,
      anchorMessageId: segment.anchorMessageId,
      proofHashes: sortUniqueStrings(segment.proofHashes.map(String)) as readonly ChatProofHash[],
      legendIds: sortUniqueStrings(segment.legendIds.map(String)) as readonly ChatLegendId[],
      pressureBand: segment.pressureBand,
      tickBand: segment.tickBand,
    };
  }

  private normalizeProofReference(proof: ChatReplayProofReference): ChatReplayNormalizedProofReference {
    return {
      proofHash: proof.proofHash,
      channel: proof.channel,
      proofClass: proof.proofClass,
      firstTs: proof.firstTs,
      lastTs: proof.lastTs,
      durationMs: Math.max(0, safeNumber(proof.lastTs, 0) - safeNumber(proof.firstTs, 0)),
      immutableCount: proof.immutableCount,
      messageIds: sortUniqueStrings(proof.messageIds.map(String)) as readonly ChatMessageId[],
      segmentIds: sortUniqueStrings(proof.segmentIds),
      lineCount: proof.messageIds.length,
    };
  }

  private normalizeLegendMoment(legend: ChatReplayLegendMoment): ChatReplayNormalizedLegendMoment {
    return {
      legendId: legend.legendId,
      messageId: legend.messageId,
      channel: legend.channel,
      ts: legend.ts,
      title: normalizeWhitespace(legend.title),
      legendClass: legend.legendClass,
      prestigeScore: legend.prestigeScore,
      proofHash: legend.proofHash,
      witnessMessageIds: sortUniqueStrings(legend.witnessMessageIds.map(String)) as readonly ChatMessageId[],
      replayId: legend.replayId,
    };
  }

  private normalizeMomentAnchor(anchor: ChatReplayMomentAnchor): ChatReplayNormalizedMomentAnchor {
    return {
      momentId: anchor.momentId,
      channel: anchor.channel,
      firstMessageId: anchor.firstMessageId,
      lastMessageId: anchor.lastMessageId,
      firstTs: anchor.firstTs,
      lastTs: anchor.lastTs,
      durationMs: Math.max(0, safeNumber(anchor.lastTs, 0) - safeNumber(anchor.firstTs, 0)),
      messageIds: sortUniqueStrings(anchor.messageIds.map(String)) as readonly ChatMessageId[],
      sceneIds: sortUniqueStrings(anchor.sceneIds),
    };
  }

  private normalizeThreadView(thread: ChatReplayThreadView): ChatReplayNormalizedThreadView {
    return {
      id: thread.id,
      channel: thread.channel,
      label: normalizeWhitespace(thread.label),
      firstTs: thread.firstTs,
      lastTs: thread.lastTs,
      durationMs: Math.max(0, safeNumber(thread.lastTs, 0) - safeNumber(thread.firstTs, 0)),
      messageIds: sortUniqueStrings(thread.messageIds.map(String)) as readonly ChatMessageId[],
      counterpartIds: sortUniqueStrings(thread.counterpartIds),
    };
  }

  private normalizeContinuity(digest: ChatReplayContinuityDigest): ChatReplayNormalizedContinuityDigest {
    const summaryLine = shorten(normalizeWhitespace(digest.summaryLine), this.config.maxNarrativeLineLength) ?? '';
    const base = {
      channel: digest.channel,
      builtAt: digest.builtAt,
      unresolvedMomentIds: sortUniqueStrings(digest.unresolvedMomentIds.map(String)) as readonly ChatMomentId[],
      topProofHashes: sortUniqueStrings(digest.topProofHashes.map(String)) as readonly ChatProofHash[],
      legendIds: sortUniqueStrings(digest.legendIds.map(String)) as readonly ChatLegendId[],
      recurringCounterpartIds: sortUniqueStrings(digest.recurringCounterpartIds),
      callbackCandidateMessageIds: sortUniqueStrings(digest.callbackCandidateMessageIds.map(String)) as readonly ChatMessageId[],
      summaryLine,
      digest: '',
    };

    const continuityDigest = digestString(stableStringify(base), this.config.digestAlgorithm);
    return {
      ...base,
      digest: continuityDigest,
    };
  }

  private normalizeSummary(summary: ChatReplaySummary): ChatReplayNormalizedSummary {
    const total = Math.max(summary.totalRecords, 1);
    const startTs = summary.startTs;
    const endTs = summary.endTs;
    const durationMs = startTs && endTs
      ? Math.max(0, safeNumber(endTs, 0) - safeNumber(startTs, 0))
      : undefined;

    return {
      channel: summary.channel,
      totalRecords: summary.totalRecords,
      replayEligibleCount: summary.replayEligibleCount,
      proofCount: summary.proofCount,
      legendCount: summary.legendCount,
      immutableCount: summary.immutableCount,
      playerLines: summary.playerLines,
      helperLines: summary.helperLines,
      haterLines: summary.haterLines,
      ambientLines: summary.ambientLines,
      worldEventLines: summary.worldEventLines,
      startTs,
      endTs,
      durationMs,
      turningPointMessageIds: sortUniqueStrings(summary.turningPointMessageIds.map(String)) as readonly ChatMessageId[],
      dominantPressureTier: summary.dominantPressureTier,
      dominantTickTier: summary.dominantTickTier,
      lastWordMessageId: summary.lastWordMessageId,
      ratios: Object.freeze({
        player: summary.playerLines / total,
        helper: summary.helperLines / total,
        hater: summary.haterLines / total,
        ambient: summary.ambientLines / total,
        worldEvent: summary.worldEventLines / total,
        immutable: summary.immutableCount / total,
      }),
    };
  }

  private normalizeRecap(
    recap: ChatReplayPostRunRecap,
    normalizedSlice: ChatReplaySerializedSlice,
  ): ChatReplaySerializedRecap {
    const witnessMessageIds = normalizedSlice.messages
      .filter((message) => recap.witnessLines.some((line) => String((line as unknown as Record<string, unknown>).id) === String(message.id)))
      .map((message) => message.id)
      .slice(0, this.config.maxSummaryWitnessLines);

    return {
      channel: recap.channel,
      builtAt: recap.builtAt,
      narrativeLine: shorten(normalizeWhitespace(recap.narrativeLine), this.config.maxNarrativeLineLength) ?? '',
      turningPoints: recap.turningPoints
        .map((legend) => this.normalizeLegendMoment(legend))
        .sort((a, b) => compareNumbersAsc(b.prestigeScore, a.prestigeScore) || compareUnixAsc(a.ts, b.ts)),
      witnessMessageIds,
      proofHighlights: recap.proofHighlights
        .map((proof) => this.normalizeProofReference(proof))
        .sort((a, b) => compareUnixAsc(a.firstTs, b.firstTs)),
      finalWordMessageId: recap.finalWord
        ? ((recap.finalWord as unknown as Record<string, unknown>).id as ChatMessageId | undefined)
        : undefined,
    };
  }

  private normalizeTranscriptBundle(bundle: ChatTranscriptExportBundle | undefined): unknown {
    if (!bundle) return undefined;
    return stableSortObjectKeys(bundle);
  }

  // -------------------------------------------------------------------------
  // Indexes, metrics, search
  // -------------------------------------------------------------------------

  private buildIndexes(input: {
    readonly messages: readonly ChatReplayNormalizedMessage[];
    readonly segments: readonly ChatReplayNormalizedSegment[];
    readonly proofReferences: readonly ChatReplayNormalizedProofReference[];
    readonly legendMoments: readonly ChatReplayNormalizedLegendMoment[];
    readonly momentAnchors: readonly ChatReplayNormalizedMomentAnchor[];
    readonly threadViews: readonly ChatReplayNormalizedThreadView[];
  }): ChatReplayIndexTable {
    const messageIds: Record<string, number> = {};
    const segmentIds: Record<string, number> = {};
    const proofHashes: Record<string, number> = {};
    const legendIds: Record<string, number> = {};
    const momentIds: Record<string, number> = {};
    const threadIds: Record<string, number> = {};
    const tags: Record<string, readonly string[]> = {};

    input.messages.forEach((message, index) => {
      messageIds[String(message.id)] = index;
      tags[String(message.id)] = message.tags;
    });

    input.segments.forEach((segment, index) => {
      segmentIds[segment.id] = index;
    });

    input.proofReferences.forEach((proof, index) => {
      proofHashes[String(proof.proofHash)] = index;
    });

    input.legendMoments.forEach((legend, index) => {
      legendIds[String(legend.legendId)] = index;
    });

    input.momentAnchors.forEach((moment, index) => {
      momentIds[String(moment.momentId)] = index;
    });

    input.threadViews.forEach((thread, index) => {
      threadIds[thread.id] = index;
    });

    return Object.freeze({
      messageIds: Object.freeze(messageIds),
      segmentIds: Object.freeze(segmentIds),
      proofHashes: Object.freeze(proofHashes),
      legendIds: Object.freeze(legendIds),
      momentIds: Object.freeze(momentIds),
      threadIds: Object.freeze(threadIds),
      tags: Object.freeze(tags),
    });
  }

  private buildDerivedMetrics(input: {
    readonly summary: ChatReplayNormalizedSummary;
    readonly segments: readonly ChatReplayNormalizedSegment[];
    readonly threadViews: readonly ChatReplayNormalizedThreadView[];
    readonly legendMoments: readonly ChatReplayNormalizedLegendMoment[];
    readonly proofReferences: readonly ChatReplayNormalizedProofReference[];
  }): ChatReplayDerivedMetrics {
    const total = Math.max(input.summary.totalRecords, 1);
    const segmentDurationTotal = input.segments.reduce((sum, segment) => sum + segment.durationMs, 0);
    const threadDurationTotal = input.threadViews.reduce((sum, thread) => sum + thread.durationMs, 0);
    const prestigeTotal = input.legendMoments.reduce((sum, legend) => sum + safeNumber(legend.prestigeScore, 0), 0);

    return {
      witnessDensity: input.segments.reduce((sum, segment) => sum + segment.witnessCount, 0) / total,
      proofDensity: input.summary.proofCount / total,
      legendDensity: input.summary.legendCount / total,
      immutableDensity: input.summary.immutableCount / total,
      averageSegmentDurationMs: input.segments.length ? segmentDurationTotal / input.segments.length : 0,
      averageThreadDurationMs: input.threadViews.length ? threadDurationTotal / input.threadViews.length : 0,
      averageLinesPerSegment: input.segments.length
        ? input.segments.reduce((sum, segment) => sum + segment.messageCount, 0) / input.segments.length
        : 0,
      averageLinesPerThread: input.threadViews.length
        ? input.threadViews.reduce((sum, thread) => sum + thread.messageIds.length, 0) / input.threadViews.length
        : 0,
      prestigeTotal,
      prestigeAverage: input.legendMoments.length ? prestigeTotal / input.legendMoments.length : 0,
      recapLineCount: input.summary.turningPointMessageIds.length,
      counterpartSpread: input.threadViews.reduce((setCount, thread) => setCount + thread.counterpartIds.length, 0),
    };
  }

  private buildSearchCorpus(
    slice: ChatReplaySerializedSlice,
    recap?: ChatReplaySerializedRecap,
  ): ChatReplaySearchCorpus {
    const messages: Record<string, string> = {};
    const legends: Record<string, string> = {};
    const proofs: Record<string, string> = {};
    const segments: Record<string, string> = {};
    const terms = new Set<string>();

    for (const message of slice.messages) {
      messages[String(message.id)] = message.searchText;
      for (const token of this.tokenize(message.searchText)) terms.add(token);
    }

    for (const legend of slice.legendMoments) {
      const line = joinSearchParts([
        legend.title,
        legend.legendClass,
        String(legend.prestigeScore),
        legend.proofHash,
      ], this.config.normalizeWhitespace);
      legends[String(legend.legendId)] = line;
      for (const token of this.tokenize(line)) terms.add(token);
    }

    for (const proof of slice.proofReferences) {
      const line = joinSearchParts([
        String(proof.proofHash),
        proof.proofClass,
        String(proof.lineCount),
        String(proof.immutableCount),
      ], this.config.normalizeWhitespace);
      proofs[String(proof.proofHash)] = line;
      for (const token of this.tokenize(line)) terms.add(token);
    }

    for (const segment of slice.segments) {
      const line = joinSearchParts([
        segment.summaryLine,
        segment.timelineClass,
        segment.dominantKind,
      ], this.config.normalizeWhitespace);
      segments[segment.id] = line;
      for (const token of this.tokenize(line)) terms.add(token);
    }

    const continuity = joinSearchParts([
      slice.continuity.summaryLine,
      recap?.narrativeLine,
      slice.summary.dominantPressureTier,
      slice.summary.dominantTickTier,
    ], this.config.normalizeWhitespace);

    for (const token of this.tokenize(continuity)) terms.add(token);

    return {
      terms: [...terms].sort(compareStringsAsc).slice(0, this.config.maxSearchTerms),
      messages: Object.freeze(messages),
      legends: Object.freeze(legends),
      proofs: Object.freeze(proofs),
      segments: Object.freeze(segments),
      continuity,
    };
  }

  private tokenize(input: string): readonly string[] {
    return input
      .toLowerCase()
      .split(/[^a-z0-9_:-]+/)
      .map((part) => part.trim())
      .filter((part) => part.length > 1);
  }

  // -------------------------------------------------------------------------
  // Manifest / digest / finalization
  // -------------------------------------------------------------------------

  private buildManifest(input: {
    readonly format: ChatReplaySerializerFormat;
    readonly intent: ChatReplaySerializationIntent;
    readonly outputClass: ChatReplaySerializerOutputClass;
    readonly bundle: ChatReplayExportBundle;
    readonly slice: ChatReplaySerializedSlice;
    readonly fileName?: string;
  }): ChatReplaySerializationManifest {
    const fileStem = makeFileStem({
      prefix: this.config.fileNamePrefix,
      channel: input.slice.channel,
      builtAt: input.bundle.builtAt,
      replayId: input.slice.session.replayId,
      sessionId: input.slice.session.id,
      outputClass: input.outputClass,
    });

    const fileName = input.fileName
      ?? `${fileStem}.${input.format === 'NDJSON' ? 'ndjson' : 'json'}`;

    return {
      moduleName: CHAT_REPLAY_SERIALIZER_MODULE_NAME,
      builtAt: input.bundle.builtAt,
      intent: input.intent,
      format: input.format,
      replayExportFormat: input.bundle.format,
      outputClass: input.outputClass,
      channel: input.slice.channel,
      replayId: input.slice.session.replayId,
      sessionId: input.slice.session.id,
      messageCount: input.slice.messages.length,
      segmentCount: input.slice.segments.length,
      proofCount: input.slice.proofReferences.length,
      legendCount: input.slice.legendMoments.length,
      momentCount: input.slice.momentAnchors.length,
      threadCount: input.slice.threadViews.length,
      stableHashReady: true,
      transcriptIncluded: false,
      rawRecordsIncluded: Boolean(input.slice.records),
      searchIncluded: false,
      derivedMetricsIncluded: Boolean(input.slice.derivedMetrics),
      fileName,
      fileStem,
    };
  }

  private computePayloadDigest(payload: ChatReplaySerializedPayload): string {
    const withoutDigest = {
      ...payload,
      digest: '',
      manifest: {
        ...payload.manifest,
        transcriptIncluded: Boolean(payload.transcriptBundle),
        searchIncluded: Boolean(payload.searchCorpus),
      },
    };
    return digestString(stableStringify(withoutDigest), this.config.digestAlgorithm);
  }

  private finalizeEnvelope(
    payload: ChatReplaySerializedPayload,
    format: ChatReplaySerializerFormat,
  ): ChatReplaySerializedEnvelope {
    const manifest: ChatReplaySerializationManifest = {
      ...payload.manifest,
      transcriptIncluded: Boolean(payload.transcriptBundle),
      searchIncluded: Boolean(payload.searchCorpus),
    };

    const finalPayload: ChatReplaySerializedPayload = {
      ...payload,
      manifest,
    };

    const text = this.reencodeEnvelope(finalPayload, format);

    return {
      manifest,
      payload: finalPayload,
      text,
      byteLength: byteLengthOf(text),
    };
  }

  private reencodeEnvelope(
    payload: ChatReplaySerializedPayload,
    format: ChatReplaySerializerFormat,
  ): string {
    switch (format) {
      case 'JSON_PRETTY':
        return stableStringify({ manifest: payload.manifest, payload }, this.config.prettyIndent);
      case 'JSON_COMPACT':
        return stableStringify({ manifest: payload.manifest, payload });
      case 'SERIALIZER_READY_PRETTY':
        return stableStringify({
          manifest: payload.manifest,
          payload: this.toSerializerReadyPayload(payload),
        }, this.config.prettyIndent);
      case 'SERIALIZER_READY_COMPACT':
        return stableStringify({
          manifest: payload.manifest,
          payload: this.toSerializerReadyPayload(payload),
        });
      case 'SUMMARY_PRETTY':
        return stableStringify({
          manifest: payload.manifest,
          payload: this.toSummaryPayload(payload),
        }, this.config.prettyIndent);
      case 'SUMMARY_COMPACT':
        return stableStringify({
          manifest: payload.manifest,
          payload: this.toSummaryPayload(payload),
        });
      case 'NDJSON':
        return this.toNdjson(payload);
      default:
        return stableStringify({ manifest: payload.manifest, payload }, this.config.prettyIndent);
    }
  }

  private toSerializerReadyPayload(payload: ChatReplaySerializedPayload): unknown {
    return {
      engineVersion: payload.engineVersion,
      serializerVersion: payload.serializerVersion,
      apiVersion: payload.apiVersion,
      authorities: payload.authorities,
      digest: payload.digest,
      digestAlgorithm: payload.digestAlgorithm,
      outputClass: 'SERIALIZER_READY',
      manifest: payload.manifest,
      channel: payload.slice.channel,
      session: payload.slice.session,
      summary: payload.slice.summary,
      continuity: payload.slice.continuity,
      indexes: payload.slice.indexes,
      messages: payload.slice.messages,
      records: payload.slice.records,
      segments: payload.slice.segments,
      proofs: payload.slice.proofReferences,
      legends: payload.slice.legendMoments,
      moments: payload.slice.momentAnchors,
      threads: payload.slice.threadViews,
      derivedMetrics: payload.slice.derivedMetrics,
      recap: payload.recap,
      transcriptBundle: payload.transcriptBundle,
      searchCorpus: payload.searchCorpus,
      downloadHints: payload.downloadHints,
    };
  }

  private toSummaryPayload(payload: ChatReplaySerializedPayload): unknown {
    return {
      engineVersion: payload.engineVersion,
      serializerVersion: payload.serializerVersion,
      digest: payload.digest,
      manifest: payload.manifest,
      channel: payload.slice.channel,
      session: {
        id: payload.slice.session.id,
        replayId: payload.slice.session.replayId,
        continuityMode: payload.slice.session.continuityMode,
      },
      summary: payload.slice.summary,
      continuity: {
        summaryLine: payload.slice.continuity.summaryLine,
        digest: payload.slice.continuity.digest,
      },
      legends: payload.slice.legendMoments.map((legend) => ({
        legendId: legend.legendId,
        title: legend.title,
        prestigeScore: legend.prestigeScore,
        ts: legend.ts,
      })),
      proofs: payload.slice.proofReferences.map((proof) => ({
        proofHash: proof.proofHash,
        proofClass: proof.proofClass,
        lineCount: proof.lineCount,
      })),
      recap: payload.recap,
      downloadHints: payload.downloadHints,
    };
  }

  private toNdjson(payload: ChatReplaySerializedPayload): string {
    const lines: string[] = [];

    lines.push(stableStringify({
      type: 'manifest',
      value: payload.manifest,
    }));

    lines.push(stableStringify({
      type: 'summary',
      value: payload.slice.summary,
    }));

    lines.push(stableStringify({
      type: 'continuity',
      value: payload.slice.continuity,
    }));

    for (const segment of payload.slice.segments) {
      lines.push(stableStringify({ type: 'segment', value: segment }));
    }

    for (const message of payload.slice.messages) {
      lines.push(stableStringify({ type: 'message', value: message }));
    }

    for (const proof of payload.slice.proofReferences) {
      lines.push(stableStringify({ type: 'proof', value: proof }));
    }

    for (const legend of payload.slice.legendMoments) {
      lines.push(stableStringify({ type: 'legend', value: legend }));
    }

    for (const moment of payload.slice.momentAnchors) {
      lines.push(stableStringify({ type: 'moment', value: moment }));
    }

    for (const thread of payload.slice.threadViews) {
      lines.push(stableStringify({ type: 'thread', value: thread }));
    }

    if (payload.recap) {
      lines.push(stableStringify({ type: 'recap', value: payload.recap }));
    }

    return `${lines.join('\n')}\n`;
  }

  private buildDownloadHints(manifest: ChatReplaySerializationManifest): ChatReplayDownloadHints {
    const prettyFileName = `${manifest.fileStem}.pretty.json`;
    const compactFileName = `${manifest.fileStem}.compact.json`;
    const ndjsonFileName = `${manifest.fileStem}.ndjson`;
    const shareSlug = slugify([
      manifest.channel,
      manifest.replayId ?? manifest.sessionId,
      manifest.builtAt,
    ].join('-'));

    return {
      suggestedFileName: manifest.fileName,
      prettyFileName,
      compactFileName,
      ndjsonFileName,
      shareSlug,
    };
  }

  private resolveOutputClass(format: ChatReplaySerializerFormat): ChatReplaySerializerOutputClass {
    switch (format) {
      case 'SERIALIZER_READY_PRETTY':
      case 'SERIALIZER_READY_COMPACT':
      case 'NDJSON':
        return 'SERIALIZER_READY';
      case 'SUMMARY_PRETTY':
      case 'SUMMARY_COMPACT':
        return 'SUMMARY';
      case 'JSON_PRETTY':
      case 'JSON_COMPACT':
      default:
        return 'FULL_BUNDLE';
    }
  }

  private shouldIncludeTranscriptBundle(options: ChatReplaySerializationOptions): boolean {
    return options.includeTranscriptBundle ?? this.config.includeTranscriptBundle;
  }

  private shouldIncludeSearchCorpus(options: ChatReplaySerializationOptions): boolean {
    return options.includeSearchCorpus ?? this.config.includeSearchCorpus;
  }

  private shouldIncludeDownloadHints(options: ChatReplaySerializationOptions): boolean {
    return options.includeDownloadHints ?? this.config.includeDownloadHints;
  }

  private replaceFileExtension(fileName: string, extension: '.json' | '.ndjson'): string {
    return fileName.replace(/\.(json|ndjson)$/i, extension);
  }

  // -------------------------------------------------------------------------
  // Static convenience wrappers
  // -------------------------------------------------------------------------

  public static serializeBundle(
    bundle: ChatReplayExportBundle,
    options: ChatReplaySerializationOptions = {},
    config: ChatReplaySerializerConfig = {},
  ): ChatReplaySerializedEnvelope {
    return new ChatReplaySerializer(config).serializeBundle(bundle, options);
  }

  public static serializeRecap(
    recap: ChatReplayPostRunRecap,
    options: ChatReplaySerializationOptions = {},
    config: ChatReplaySerializerConfig = {},
  ): ChatReplaySerializedEnvelope {
    return new ChatReplaySerializer(config).serializeRecap(recap, options);
  }

  public static serializeBufferSession(
    buffer: ChatReplayBuffer,
    input: {
      readonly sessionId?: string;
      readonly channel?: ChatVisibleChannel;
      readonly format?: ChatReplaySerializerFormat;
      readonly options?: Omit<ChatReplaySerializationOptions, 'format'>;
    } = {},
    config: ChatReplaySerializerConfig = {},
  ): ChatReplaySerializedEnvelope {
    return new ChatReplaySerializer(config).serializeBufferSession(buffer, input);
  }

  public static buildDownloadArtifact(
    envelope: ChatReplaySerializedEnvelope,
    formatOverride?: ChatReplaySerializerFormat,
    config: ChatReplaySerializerConfig = {},
  ): ChatReplayDownloadArtifact {
    return new ChatReplaySerializer(config).buildDownloadArtifact(envelope, formatOverride);
  }

  public static parseEnvelope(
    raw: string,
    config: ChatReplaySerializerConfig = {},
  ): ChatReplaySerializedEnvelope {
    return new ChatReplaySerializer(config).parseEnvelope(raw);
  }
}

// ============================================================================
// MARK: Public integration helpers
// ============================================================================

export function createChatReplaySerializer(
  config: ChatReplaySerializerConfig = {},
): ChatReplaySerializer {
  return new ChatReplaySerializer(config);
}

export function serializeReplayBundle(
  bundle: ChatReplayExportBundle,
  options: ChatReplaySerializationOptions = {},
  config: ChatReplaySerializerConfig = {},
): ChatReplaySerializedEnvelope {
  return ChatReplaySerializer.serializeBundle(bundle, options, config);
}

export function serializeReplayRecap(
  recap: ChatReplayPostRunRecap,
  options: ChatReplaySerializationOptions = {},
  config: ChatReplaySerializerConfig = {},
): ChatReplaySerializedEnvelope {
  return ChatReplaySerializer.serializeRecap(recap, options, config);
}

export function serializeReplayBufferSession(
  buffer: ChatReplayBuffer,
  input: {
    readonly sessionId?: string;
    readonly channel?: ChatVisibleChannel;
    readonly format?: ChatReplaySerializerFormat;
    readonly options?: Omit<ChatReplaySerializationOptions, 'format'>;
  } = {},
  config: ChatReplaySerializerConfig = {},
): ChatReplaySerializedEnvelope {
  return ChatReplaySerializer.serializeBufferSession(buffer, input, config);
}

export function buildReplayDownloadArtifact(
  envelope: ChatReplaySerializedEnvelope,
  formatOverride?: ChatReplaySerializerFormat,
  config: ChatReplaySerializerConfig = {},
): ChatReplayDownloadArtifact {
  return ChatReplaySerializer.buildDownloadArtifact(envelope, formatOverride, config);
}

// ============================================================================
// MARK: Replay-aware callback bridge helpers
// ============================================================================

export interface ChatReplaySerializationCallbacks extends ChatReplayBufferCallbacks {
  readonly onSerialized?: (envelope: ChatReplaySerializedEnvelope) => void;
  readonly onRecapSerialized?: (envelope: ChatReplaySerializedEnvelope) => void;
}

export function createReplaySerializationAwareCallbacks(input: {
  readonly serializer?: ChatReplaySerializer;
  readonly callbacks?: ChatReplaySerializationCallbacks;
  readonly defaultBundleOptions?: ChatReplaySerializationOptions;
  readonly defaultRecapOptions?: ChatReplaySerializationOptions;
} = {}): ChatReplayBufferCallbacks {
  const serializer = input.serializer ?? new ChatReplaySerializer();
  const callbacks = input.callbacks;

  return {
    onSessionOpened: callbacks?.onSessionOpened,
    onSessionClosed: callbacks?.onSessionClosed,
    onSliceBuilt: callbacks?.onSliceBuilt,
    onSnapshotChanged: callbacks?.onSnapshotChanged,
    onError: callbacks?.onError,
    onExported(bundle) {
      callbacks?.onExported?.(bundle);
      try {
        const envelope = serializer.serializeBundle(bundle, {
          intent: 'PERSISTENCE',
          ...input.defaultBundleOptions,
        });
        callbacks?.onSerialized?.(envelope);
      } catch (error) {
        callbacks?.onError?.(
          error instanceof Error ? error : createError('Unknown serialization failure.'),
          { phase: 'onExported' },
        );
      }
    },
  };
}

// ============================================================================
// MARK: Public manifest
// ============================================================================

export const CHAT_REPLAY_SERIALIZER_PUBLIC_MANIFEST = Object.freeze({
  moduleName: CHAT_REPLAY_SERIALIZER_MODULE_NAME,
  serializerVersion: CHAT_REPLAY_SERIALIZER_VERSION,
  engineVersion: CHAT_ENGINE_VERSION,
  apiVersion: CHAT_ENGINE_PUBLIC_API_VERSION,
  authorities: CHAT_ENGINE_AUTHORITIES,
  formats: CHAT_REPLAY_SERIALIZER_FORMATS,
  root: '/pzo-web/src/engines/chat/replay',
  owns: Object.freeze([
    'deterministic export shape',
    'serializer-ready payload normalization',
    'stable replay hashing',
    'download artifact generation',
    'summary payload shaping',
    'ndjson export lane',
    'replay recap serialization',
  ] as const),
  dependsOn: Object.freeze([
    '/pzo-web/src/engines/chat/replay/ChatReplayBuffer.ts',
    '/pzo-web/src/engines/chat/ChatTranscriptBuffer.ts',
    '/pzo-web/src/engines/chat/types.ts',
  ] as const),
} as const);
