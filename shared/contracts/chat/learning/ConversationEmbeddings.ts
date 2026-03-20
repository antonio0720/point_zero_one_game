/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT LEARNING CONTRACT
 * FILE: shared/contracts/chat/learning/ConversationEmbeddings.ts
 * VERSION: 2026.03.20-retrieval-continuity.v1
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared contract surface for retrieval-backed continuity embeddings.
 *
 * This file is not a model runner. It defines the stable shared vocabulary,
 * ids, manifests, shapes, math helpers, ranking helpers, receipts, preview
 * surfaces, and feature-pack contracts that frontend, backend, and server lanes
 * can share without importing runtime-specific infrastructure.
 *
 * Why this file exists
 * --------------------
 * Retrieval-backed continuity only works if all lanes agree on:
 * - what a memory document is,
 * - how salience is represented,
 * - what vectors look like,
 * - how windows and anchors attach to turns/scenes/moments,
 * - how ranking receipts are carried across lanes, and
 * - how preview/debug surfaces remain deterministic.
 *
 * Barrel law
 * ----------
 * - This file owns shared retrieval and embedding contract truth.
 * - This file does not own storage adapters, ANN indexes, RPC, or DB schema.
 * - All helpers must remain deterministic and side-effect free.
 * ============================================================================
 */

export const CONVERSATION_EMBEDDINGS_VERSION =
  '2026.03.20-retrieval-continuity.v1' as const;

export const EMBEDDING_VECTOR_PRECISIONS = [
  'FLOAT32',
  'FLOAT16',
  'INT8_QUANTIZED',
  'UINT8_QUANTIZED',
] as const;

export type EmbeddingVectorPrecision =
  (typeof EMBEDDING_VECTOR_PRECISIONS)[number];

export const EMBEDDING_PROVIDERS = [
  'INTERNAL',
  'OPENAI',
  'ANTHROPIC',
  'LOCAL',
  'MOCK',
  'UNKNOWN',
] as const;

export type EmbeddingProvider = (typeof EMBEDDING_PROVIDERS)[number];

export const EMBEDDING_PURPOSES = [
  'CHAT_MEMORY',
  'CHAT_SCENE',
  'CHAT_MOMENT',
  'CHAT_TRANSCRIPT_WINDOW',
  'CHAT_QUOTE',
  'CHAT_RELATIONSHIP',
  'CHAT_PLAYER_STATE',
  'CHAT_EMOTION',
  'CHAT_RETRIEVAL_QUERY',
  'CHAT_RANKING_HINT',
] as const;

export type EmbeddingPurpose = (typeof EMBEDDING_PURPOSES)[number];

export const EMBEDDING_DOCUMENT_KINDS = [
  'TURN',
  'MESSAGE',
  'WINDOW',
  'SCENE',
  'MOMENT',
  'QUOTE',
  'RELATIONSHIP',
  'PROFILE',
  'SUMMARY',
  'ANCHOR',
  'REPLAY',
] as const;

export type EmbeddingDocumentKind =
  (typeof EMBEDDING_DOCUMENT_KINDS)[number];

export const EMBEDDING_SOURCE_KINDS = [
  'PLAYER',
  'HELPER',
  'HATER',
  'NPC',
  'SYSTEM',
  'DEALROOM',
  'CROWD',
  'SHADOW',
  'LIVEOPS',
] as const;

export type EmbeddingSourceKind = (typeof EMBEDDING_SOURCE_KINDS)[number];

export const EMBEDDING_WINDOW_KINDS = [
  'SLIDING',
  'EVENT_BOUNDED',
  'SCENE_BOUNDED',
  'RUN_BOUNDED',
  'RELATIONSHIP_BOUNDED',
  'QUOTE_BOUNDED',
  'POSTRUN_BOUNDED',
] as const;

export type EmbeddingWindowKind = (typeof EMBEDDING_WINDOW_KINDS)[number];

export const EMBEDDING_MATCH_KINDS = [
  'SEMANTIC',
  'EXACT',
  'HYBRID',
  'SALIENT',
  'RECENCY_BOOSTED',
  'RELATIONSHIP_BOOSTED',
  'EMOTION_BOOSTED',
] as const;

export type EmbeddingMatchKind = (typeof EMBEDDING_MATCH_KINDS)[number];

export const EMBEDDING_DISTANCE_METRICS = [
  'COSINE',
  'DOT',
  'L2',
  'ANGULAR',
] as const;

export type EmbeddingDistanceMetric =
  (typeof EMBEDDING_DISTANCE_METRICS)[number];

export const EMBEDDING_RETENTION_CLASSES = [
  'EPHEMERAL',
  'SHORT_RUN',
  'MULTI_RUN',
  'LEGENDARY',
  'FOREVER',
] as const;

export type EmbeddingRetentionClass =
  (typeof EMBEDDING_RETENTION_CLASSES)[number];

export const EMBEDDING_DEBUG_FLAGS = [
  'NORMALIZED',
  'QUANTIZED',
  'TRUNCATED',
  'PADDED',
  'FALLBACK_VECTOR',
  'EMPTY_TEXT',
  'MANUAL_BOOST',
  'MANUAL_SUPPRESS',
] as const;

export type EmbeddingDebugFlag = (typeof EMBEDDING_DEBUG_FLAGS)[number];

export type EmbeddingDocumentId = `ced_${string}`;
export type EmbeddingVectorId = `cev_${string}`;
export type EmbeddingQueryId = `ceq_${string}`;
export type EmbeddingBatchId = `ceb_${string}`;
export type EmbeddingPreviewId = `cep_${string}`;
export type EmbeddingReceiptId = `cer_${string}`;

export interface EmbeddingVectorShape {
  readonly dimensions: number;
  readonly precision: EmbeddingVectorPrecision;
  readonly normalized: boolean;
}

export interface EmbeddingModelDescriptor {
  readonly provider: EmbeddingProvider;
  readonly modelName: string;
  readonly version: string;
  readonly shape: EmbeddingVectorShape;
  readonly distanceMetric: EmbeddingDistanceMetric;
  readonly purpose: EmbeddingPurpose;
}

export interface EmbeddingVectorEnvelope {
  readonly id: EmbeddingVectorId;
  readonly model: EmbeddingModelDescriptor;
  readonly createdAtMs: number;
  readonly values: readonly number[];
  readonly magnitude: number;
  readonly minValue: number;
  readonly maxValue: number;
  readonly precision: EmbeddingVectorPrecision;
  readonly quantizationScale?: number;
  readonly quantizationZeroPoint?: number;
  readonly debugFlags: readonly EmbeddingDebugFlag[];
}

export interface EmbeddingTextSpan {
  readonly startOffset: number;
  readonly endOffset: number;
  readonly label: string;
  readonly text: string;
  readonly weight: number;
}

export interface EmbeddingChannelContext {
  readonly roomId?: string;
  readonly channelId?: string;
  readonly sourceKind: EmbeddingSourceKind;
  readonly sourceId?: string;
  readonly actorId?: string;
  readonly actorPersonaId?: string;
  readonly runId?: string;
  readonly sceneId?: string;
  readonly momentId?: string;
  readonly relationshipId?: string;
  readonly quoteId?: string;
  readonly messageId?: string;
  readonly turnId?: string;
}

export interface EmbeddingDocumentWindow {
  readonly kind: EmbeddingWindowKind;
  readonly startCursor?: string;
  readonly endCursor?: string;
  readonly startAtMs?: number;
  readonly endAtMs?: number;
  readonly turnCount: number;
  readonly messageCount: number;
  readonly sceneIds: readonly string[];
  readonly momentIds: readonly string[];
}

export interface EmbeddingDocumentStats {
  readonly tokenEstimate: number;
  readonly characterCount: number;
  readonly sourceLineCount: number;
  readonly wordCount: number;
  readonly quotedTextCount: number;
  readonly uniqueSpeakerCount: number;
  readonly recencyAgeMs?: number;
}

export interface EmbeddingSalienceProfile {
  readonly baseSalience: number;
  readonly emotionalSalience: number;
  readonly narrativeSalience: number;
  readonly relationshipSalience: number;
  readonly noveltySalience: number;
  readonly prestigeSalience: number;
  readonly comebackSalience: number;
  readonly collapseSalience: number;
  readonly rescueSalience: number;
  readonly conflictSalience: number;
  readonly finalSalience: number;
}

export interface EmbeddingDocumentTags {
  readonly intents: readonly string[];
  readonly emotions: readonly string[];
  readonly pressureTags: readonly string[];
  readonly relationshipTags: readonly string[];
  readonly callbackTags: readonly string[];
  readonly revealTags: readonly string[];
  readonly continuityTags: readonly string[];
  readonly arbitraryTags: readonly string[];
}

export interface ConversationEmbeddingDocument {
  readonly id: EmbeddingDocumentId;
  readonly kind: EmbeddingDocumentKind;
  readonly purpose: EmbeddingPurpose;
  readonly retentionClass: EmbeddingRetentionClass;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  readonly text: string;
  readonly canonicalText: string;
  readonly summary: string;
  readonly spans: readonly EmbeddingTextSpan[];
  readonly channelContext: EmbeddingChannelContext;
  readonly window: EmbeddingDocumentWindow;
  readonly stats: EmbeddingDocumentStats;
  readonly salience: EmbeddingSalienceProfile;
  readonly tags: EmbeddingDocumentTags;
  readonly vector: EmbeddingVectorEnvelope;
  readonly sourceHashes: readonly string[];
  readonly quoteRefs: readonly string[];
  readonly relationshipRefs: readonly string[];
  readonly anchorRefs: readonly string[];
  readonly debugFlags: readonly EmbeddingDebugFlag[];
}

export interface EmbeddingSearchQuery {
  readonly id: EmbeddingQueryId;
  readonly createdAtMs: number;
  readonly purpose: EmbeddingPurpose;
  readonly queryText: string;
  readonly canonicalQueryText: string;
  readonly queryVector?: EmbeddingVectorEnvelope;
  readonly topK: number;
  readonly minimumScore: number;
  readonly matchKind: EmbeddingMatchKind;
  readonly distanceMetric: EmbeddingDistanceMetric;
  readonly includeKinds: readonly EmbeddingDocumentKind[];
  readonly excludeKinds: readonly EmbeddingDocumentKind[];
  readonly includeSourceKinds: readonly EmbeddingSourceKind[];
  readonly excludeSourceKinds: readonly EmbeddingSourceKind[];
  readonly requiredTags: readonly string[];
  readonly blockedTags: readonly string[];
  readonly relationshipRefs: readonly string[];
  readonly anchorRefs: readonly string[];
  readonly roomId?: string;
  readonly channelId?: string;
  readonly runId?: string;
  readonly sceneId?: string;
  readonly momentId?: string;
  readonly timeFloorMs?: number;
  readonly timeCeilingMs?: number;
  readonly recencyHalfLifeMs?: number;
  readonly salienceFloor?: number;
  readonly manualBoostByDocumentId?: Readonly<Record<EmbeddingDocumentId, number>>;
}

export interface EmbeddingScoreBreakdown {
  readonly semanticScore: number;
  readonly lexicalScore: number;
  readonly recencyScore: number;
  readonly salienceScore: number;
  readonly relationshipScore: number;
  readonly emotionScore: number;
  readonly continuityScore: number;
  readonly finalScore: number;
}

export interface EmbeddingSearchMatch {
  readonly rank: number;
  readonly documentId: EmbeddingDocumentId;
  readonly kind: EmbeddingDocumentKind;
  readonly sourceKind: EmbeddingSourceKind;
  readonly summary: string;
  readonly score: EmbeddingScoreBreakdown;
  readonly matchingSpans: readonly EmbeddingTextSpan[];
  readonly quoteRefs: readonly string[];
  readonly relationshipRefs: readonly string[];
  readonly anchorRefs: readonly string[];
  readonly previewText: string;
}

export interface EmbeddingSearchReceipt {
  readonly id: EmbeddingReceiptId;
  readonly queryId: EmbeddingQueryId;
  readonly createdAtMs: number;
  readonly matchKind: EmbeddingMatchKind;
  readonly distanceMetric: EmbeddingDistanceMetric;
  readonly candidateCount: number;
  readonly returnedCount: number;
  readonly topK: number;
  readonly minimumScore: number;
  readonly winnerIds: readonly EmbeddingDocumentId[];
  readonly debugNotes: readonly string[];
}

export interface EmbeddingPreview {
  readonly id: EmbeddingPreviewId;
  readonly documentId: EmbeddingDocumentId;
  readonly purpose: EmbeddingPurpose;
  readonly title: string;
  readonly subtitle: string;
  readonly summary: string;
  readonly topTags: readonly string[];
  readonly sourceKind: EmbeddingSourceKind;
  readonly retentionClass: EmbeddingRetentionClass;
  readonly salience: number;
}

export interface EmbeddingBatchEnvelope {
  readonly id: EmbeddingBatchId;
  readonly createdAtMs: number;
  readonly purpose: EmbeddingPurpose;
  readonly documents: readonly ConversationEmbeddingDocument[];
  readonly vectorModel: EmbeddingModelDescriptor;
  readonly averageDimensions: number;
  readonly averageMagnitude: number;
  readonly averageSalience: number;
  readonly roomIds: readonly string[];
  readonly runIds: readonly string[];
}

export interface EmbeddingNormalizationOptions {
  readonly dimensions?: number;
  readonly normalize?: boolean;
  readonly clampMagnitude?: number;
  readonly precision?: EmbeddingVectorPrecision;
}

export interface EmbeddingSimilarityInput {
  readonly left: readonly number[];
  readonly right: readonly number[];
  readonly metric?: EmbeddingDistanceMetric;
  readonly alreadyNormalized?: boolean;
}

export interface EmbeddingQuantizationEnvelope {
  readonly values: readonly number[];
  readonly precision: EmbeddingVectorPrecision;
  readonly scale: number;
  readonly zeroPoint: number;
}

export const EMBEDDING_VECTOR_DEFAULT_DIMENSIONS = 128 as const;
export const EMBEDDING_QUERY_DEFAULT_TOP_K = 8 as const;
export const EMBEDDING_QUERY_DEFAULT_MINIMUM_SCORE = 0.2 as const;
export const EMBEDDING_RECENCY_DEFAULT_HALF_LIFE_MS =
  1000 * 60 * 60 * 12;

export const CONVERSATION_EMBEDDING_CONTRACT_MANIFEST = Object.freeze({
  version: CONVERSATION_EMBEDDINGS_VERSION,
  purposes: EMBEDDING_PURPOSES,
  providers: EMBEDDING_PROVIDERS,
  documentKinds: EMBEDDING_DOCUMENT_KINDS,
  sourceKinds: EMBEDDING_SOURCE_KINDS,
  windowKinds: EMBEDDING_WINDOW_KINDS,
  matchKinds: EMBEDDING_MATCH_KINDS,
  distanceMetrics: EMBEDDING_DISTANCE_METRICS,
  retentionClasses: EMBEDDING_RETENTION_CLASSES,
  debugFlags: EMBEDDING_DEBUG_FLAGS,
  defaults: Object.freeze({
    dimensions: EMBEDDING_VECTOR_DEFAULT_DIMENSIONS,
    topK: EMBEDDING_QUERY_DEFAULT_TOP_K,
    minimumScore: EMBEDDING_QUERY_DEFAULT_MINIMUM_SCORE,
    recencyHalfLifeMs: EMBEDDING_RECENCY_DEFAULT_HALF_LIFE_MS,
  }),
});

export function createEmbeddingDocumentId(seed: string): EmbeddingDocumentId {
  return `ced_${normalizeEmbeddingIdSeed(seed)}`;
}

export function createEmbeddingVectorId(seed: string): EmbeddingVectorId {
  return `cev_${normalizeEmbeddingIdSeed(seed)}`;
}

export function createEmbeddingQueryId(seed: string): EmbeddingQueryId {
  return `ceq_${normalizeEmbeddingIdSeed(seed)}`;
}

export function createEmbeddingBatchId(seed: string): EmbeddingBatchId {
  return `ceb_${normalizeEmbeddingIdSeed(seed)}`;
}

export function createEmbeddingPreviewId(seed: string): EmbeddingPreviewId {
  return `cep_${normalizeEmbeddingIdSeed(seed)}`;
}

export function createEmbeddingReceiptId(seed: string): EmbeddingReceiptId {
  return `cer_${normalizeEmbeddingIdSeed(seed)}`;
}

export function normalizeEmbeddingIdSeed(seed: string): string {
  const normalized = (seed || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized.length > 0 ? normalized.slice(0, 96) : 'unknown';
}

export function canonicalizeEmbeddingText(value: string): string {
  return (value || '')
    .replace(/\s+/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

export function estimateEmbeddingTokenCount(value: string): number {
  const canonical = canonicalizeEmbeddingText(value);
  if (!canonical) return 0;
  return Math.max(1, Math.ceil(canonical.length / 4));
}

export function buildDefaultEmbeddingStats(text: string): EmbeddingDocumentStats {
  const canonical = canonicalizeEmbeddingText(text);
  const words = canonical ? canonical.split(' ') : [];
  return Object.freeze({
    tokenEstimate: estimateEmbeddingTokenCount(canonical),
    characterCount: canonical.length,
    sourceLineCount: canonical ? canonical.split(/\n+/).length : 0,
    wordCount: words.filter(Boolean).length,
    quotedTextCount: (canonical.match(/"/g) || []).length / 2,
    uniqueSpeakerCount: 1,
  });
}

export function createEmbeddingVectorShape(
  dimensions = EMBEDDING_VECTOR_DEFAULT_DIMENSIONS,
  precision: EmbeddingVectorPrecision = 'FLOAT32',
  normalized = true,
): EmbeddingVectorShape {
  return Object.freeze({
    dimensions: Math.max(1, Math.floor(dimensions)),
    precision,
    normalized,
  });
}

export function createEmbeddingModelDescriptor(
  partial: Partial<EmbeddingModelDescriptor> = {},
): EmbeddingModelDescriptor {
  return Object.freeze({
    provider: partial.provider ?? 'UNKNOWN',
    modelName: partial.modelName ?? 'unset',
    version: partial.version ?? '0',
    shape:
      partial.shape ??
      createEmbeddingVectorShape(
        EMBEDDING_VECTOR_DEFAULT_DIMENSIONS,
        'FLOAT32',
        true,
      ),
    distanceMetric: partial.distanceMetric ?? 'COSINE',
    purpose: partial.purpose ?? 'CHAT_MEMORY',
  });
}

export function normalizeEmbeddingVector(
  values: readonly number[],
  options: EmbeddingNormalizationOptions = {},
): readonly number[] {
  const targetDimensions =
    options.dimensions && options.dimensions > 0
      ? Math.floor(options.dimensions)
      : values.length > 0
      ? values.length
      : EMBEDDING_VECTOR_DEFAULT_DIMENSIONS;

  const next = new Array<number>(targetDimensions).fill(0);
  for (let index = 0; index < Math.min(values.length, targetDimensions); index += 1) {
    const raw = Number.isFinite(values[index]) ? Number(values[index]) : 0;
    next[index] = raw;
  }

  if (options.clampMagnitude && options.clampMagnitude > 0) {
    for (let index = 0; index < next.length; index += 1) {
      if (next[index] > options.clampMagnitude) next[index] = options.clampMagnitude;
      if (next[index] < -options.clampMagnitude) next[index] = -options.clampMagnitude;
    }
  }

  if (options.normalize === false) {
    return Object.freeze(next);
  }

  const magnitude = computeVectorMagnitude(next);
  if (magnitude <= 0) {
    return Object.freeze(next);
  }

  return Object.freeze(next.map((value) => value / magnitude));
}

export function computeVectorMagnitude(values: readonly number[]): number {
  if (!values.length) return 0;
  let sum = 0;
  for (const value of values) {
    const safe = Number.isFinite(value) ? value : 0;
    sum += safe * safe;
  }
  return Math.sqrt(sum);
}

export function computeVectorMin(values: readonly number[]): number {
  if (!values.length) return 0;
  let min = Number.POSITIVE_INFINITY;
  for (const value of values) {
    const safe = Number.isFinite(value) ? value : 0;
    if (safe < min) min = safe;
  }
  return Number.isFinite(min) ? min : 0;
}

export function computeVectorMax(values: readonly number[]): number {
  if (!values.length) return 0;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    const safe = Number.isFinite(value) ? value : 0;
    if (safe > max) max = safe;
  }
  return Number.isFinite(max) ? max : 0;
}

export function quantizeEmbeddingVector(
  values: readonly number[],
  precision: Extract<EmbeddingVectorPrecision, 'INT8_QUANTIZED' | 'UINT8_QUANTIZED'> = 'INT8_QUANTIZED',
): EmbeddingQuantizationEnvelope {
  const min = computeVectorMin(values);
  const max = computeVectorMax(values);
  const signed = precision === 'INT8_QUANTIZED';
  const qMin = signed ? -128 : 0;
  const qMax = signed ? 127 : 255;

  if (max === min) {
    const flat = values.map(() => 0);
    return Object.freeze({
      values: Object.freeze(flat),
      precision,
      scale: 1,
      zeroPoint: 0,
    });
  }

  const scale = (max - min) / (qMax - qMin);
  const zeroPoint = Math.round(qMin - min / scale);
  const quantized = values.map((value) => {
    const raw = Math.round(value / scale + zeroPoint);
    return Math.max(qMin, Math.min(qMax, raw));
  });

  return Object.freeze({
    values: Object.freeze(quantized),
    precision,
    scale,
    zeroPoint,
  });
}

export function dequantizeEmbeddingVector(
  envelope: EmbeddingQuantizationEnvelope,
): readonly number[] {
  return Object.freeze(
    envelope.values.map((value) => (value - envelope.zeroPoint) * envelope.scale),
  );
}

export function buildEmbeddingVectorEnvelope(
  seed: string,
  values: readonly number[],
  model: EmbeddingModelDescriptor,
  options: EmbeddingNormalizationOptions = {},
): EmbeddingVectorEnvelope {
  const normalized = normalizeEmbeddingVector(values, {
    dimensions: model.shape.dimensions,
    normalize: model.shape.normalized && options.normalize !== false,
    clampMagnitude: options.clampMagnitude,
  });

  return Object.freeze({
    id: createEmbeddingVectorId(seed),
    model,
    createdAtMs: Date.now(),
    values: normalized,
    magnitude: computeVectorMagnitude(normalized),
    minValue: computeVectorMin(normalized),
    maxValue: computeVectorMax(normalized),
    precision: model.shape.precision,
    debugFlags: Object.freeze(
      [
        model.shape.normalized ? 'NORMALIZED' : null,
        values.length > model.shape.dimensions ? 'TRUNCATED' : null,
        values.length < model.shape.dimensions ? 'PADDED' : null,
      ].filter((value): value is EmbeddingDebugFlag => Boolean(value)),
    ),
  });
}

export function createDefaultEmbeddingWindow(
  kind: EmbeddingWindowKind = 'SLIDING',
): EmbeddingDocumentWindow {
  return Object.freeze({
    kind,
    turnCount: 0,
    messageCount: 0,
    sceneIds: Object.freeze([]),
    momentIds: Object.freeze([]),
  });
}

export function createDefaultEmbeddingSalienceProfile(
  baseSalience = 0.5,
): EmbeddingSalienceProfile {
  return Object.freeze({
    baseSalience,
    emotionalSalience: baseSalience,
    narrativeSalience: baseSalience,
    relationshipSalience: baseSalience,
    noveltySalience: baseSalience,
    prestigeSalience: 0,
    comebackSalience: 0,
    collapseSalience: 0,
    rescueSalience: 0,
    conflictSalience: 0,
    finalSalience: clampUnit(baseSalience),
  });
}

export function createDefaultEmbeddingTags(): EmbeddingDocumentTags {
  return Object.freeze({
    intents: Object.freeze([]),
    emotions: Object.freeze([]),
    pressureTags: Object.freeze([]),
    relationshipTags: Object.freeze([]),
    callbackTags: Object.freeze([]),
    revealTags: Object.freeze([]),
    continuityTags: Object.freeze([]),
    arbitraryTags: Object.freeze([]),
  });
}

export function createConversationEmbeddingDocument(input: {
  readonly idSeed: string;
  readonly kind: EmbeddingDocumentKind;
  readonly purpose: EmbeddingPurpose;
  readonly retentionClass?: EmbeddingRetentionClass;
  readonly text: string;
  readonly summary?: string;
  readonly canonicalText?: string;
  readonly spans?: readonly EmbeddingTextSpan[];
  readonly channelContext?: Partial<EmbeddingChannelContext>;
  readonly window?: Partial<EmbeddingDocumentWindow>;
  readonly stats?: Partial<EmbeddingDocumentStats>;
  readonly salience?: Partial<EmbeddingSalienceProfile>;
  readonly tags?: Partial<EmbeddingDocumentTags>;
  readonly vector: EmbeddingVectorEnvelope;
  readonly sourceHashes?: readonly string[];
  readonly quoteRefs?: readonly string[];
  readonly relationshipRefs?: readonly string[];
  readonly anchorRefs?: readonly string[];
  readonly debugFlags?: readonly EmbeddingDebugFlag[];
  readonly createdAtMs?: number;
  readonly updatedAtMs?: number;
}): ConversationEmbeddingDocument {
  const createdAtMs = input.createdAtMs ?? Date.now();
  const updatedAtMs = input.updatedAtMs ?? createdAtMs;
  const canonicalText = input.canonicalText ?? canonicalizeEmbeddingText(input.text);
  const statsBase = buildDefaultEmbeddingStats(canonicalText);

  return Object.freeze({
    id: createEmbeddingDocumentId(input.idSeed),
    kind: input.kind,
    purpose: input.purpose,
    retentionClass: input.retentionClass ?? 'SHORT_RUN',
    createdAtMs,
    updatedAtMs,
    text: input.text,
    canonicalText,
    summary: canonicalizeEmbeddingText(input.summary ?? canonicalText.slice(0, 240)),
    spans: Object.freeze([...(input.spans ?? [])]),
    channelContext: Object.freeze({
      sourceKind: input.channelContext?.sourceKind ?? 'SYSTEM',
      roomId: input.channelContext?.roomId,
      channelId: input.channelContext?.channelId,
      sourceId: input.channelContext?.sourceId,
      actorId: input.channelContext?.actorId,
      actorPersonaId: input.channelContext?.actorPersonaId,
      runId: input.channelContext?.runId,
      sceneId: input.channelContext?.sceneId,
      momentId: input.channelContext?.momentId,
      relationshipId: input.channelContext?.relationshipId,
      quoteId: input.channelContext?.quoteId,
      messageId: input.channelContext?.messageId,
      turnId: input.channelContext?.turnId,
    }),
    window: Object.freeze({
      ...createDefaultEmbeddingWindow(),
      ...(input.window ?? {}),
      sceneIds: Object.freeze([...(input.window?.sceneIds ?? [])]),
      momentIds: Object.freeze([...(input.window?.momentIds ?? [])]),
    }),
    stats: Object.freeze({
      ...statsBase,
      ...(input.stats ?? {}),
    }),
    salience: Object.freeze({
      ...createDefaultEmbeddingSalienceProfile(),
      ...(input.salience ?? {}),
      finalSalience: computeFinalSalience({
        ...createDefaultEmbeddingSalienceProfile(),
        ...(input.salience ?? {}),
      }),
    }),
    tags: mergeEmbeddingTags(input.tags),
    vector: input.vector,
    sourceHashes: Object.freeze([...(input.sourceHashes ?? [])]),
    quoteRefs: Object.freeze([...(input.quoteRefs ?? [])]),
    relationshipRefs: Object.freeze([...(input.relationshipRefs ?? [])]),
    anchorRefs: Object.freeze([...(input.anchorRefs ?? [])]),
    debugFlags: Object.freeze([...(input.debugFlags ?? [])]),
  });
}

export function createEmbeddingSearchQuery(
  input: Partial<EmbeddingSearchQuery> & {
    readonly idSeed: string;
    readonly queryText: string;
  },
): EmbeddingSearchQuery {
  return Object.freeze({
    id: createEmbeddingQueryId(input.idSeed),
    createdAtMs: input.createdAtMs ?? Date.now(),
    purpose: input.purpose ?? 'CHAT_RETRIEVAL_QUERY',
    queryText: input.queryText,
    canonicalQueryText:
      input.canonicalQueryText ?? canonicalizeEmbeddingText(input.queryText),
    queryVector: input.queryVector,
    topK: Math.max(1, Math.floor(input.topK ?? EMBEDDING_QUERY_DEFAULT_TOP_K)),
    minimumScore: clampUnit(
      input.minimumScore ?? EMBEDDING_QUERY_DEFAULT_MINIMUM_SCORE,
    ),
    matchKind: input.matchKind ?? 'HYBRID',
    distanceMetric: input.distanceMetric ?? 'COSINE',
    includeKinds: Object.freeze([...(input.includeKinds ?? [])]),
    excludeKinds: Object.freeze([...(input.excludeKinds ?? [])]),
    includeSourceKinds: Object.freeze([...(input.includeSourceKinds ?? [])]),
    excludeSourceKinds: Object.freeze([...(input.excludeSourceKinds ?? [])]),
    requiredTags: Object.freeze([...(input.requiredTags ?? [])]),
    blockedTags: Object.freeze([...(input.blockedTags ?? [])]),
    relationshipRefs: Object.freeze([...(input.relationshipRefs ?? [])]),
    anchorRefs: Object.freeze([...(input.anchorRefs ?? [])]),
    roomId: input.roomId,
    channelId: input.channelId,
    runId: input.runId,
    sceneId: input.sceneId,
    momentId: input.momentId,
    timeFloorMs: input.timeFloorMs,
    timeCeilingMs: input.timeCeilingMs,
    recencyHalfLifeMs:
      input.recencyHalfLifeMs ?? EMBEDDING_RECENCY_DEFAULT_HALF_LIFE_MS,
    salienceFloor: input.salienceFloor,
    manualBoostByDocumentId: input.manualBoostByDocumentId,
  });
}

export function computeCosineSimilarity(
  left: readonly number[],
  right: readonly number[],
): number {
  const dot = computeDotSimilarity(left, right);
  const leftMag = computeVectorMagnitude(left);
  const rightMag = computeVectorMagnitude(right);
  if (leftMag <= 0 || rightMag <= 0) return 0;
  return dot / (leftMag * rightMag);
}

export function computeDotSimilarity(
  left: readonly number[],
  right: readonly number[],
): number {
  const limit = Math.min(left.length, right.length);
  let dot = 0;
  for (let index = 0; index < limit; index += 1) {
    const l = Number.isFinite(left[index]) ? left[index] : 0;
    const r = Number.isFinite(right[index]) ? right[index] : 0;
    dot += l * r;
  }
  return dot;
}

export function computeL2Distance(
  left: readonly number[],
  right: readonly number[],
): number {
  const limit = Math.max(left.length, right.length);
  let sum = 0;
  for (let index = 0; index < limit; index += 1) {
    const l = Number.isFinite(left[index]) ? left[index] : 0;
    const r = Number.isFinite(right[index]) ? right[index] : 0;
    const delta = l - r;
    sum += delta * delta;
  }
  return Math.sqrt(sum);
}

export function computeAngularSimilarity(
  left: readonly number[],
  right: readonly number[],
): number {
  const cosine = clampRange(computeCosineSimilarity(left, right), -1, 1);
  return 1 - Math.acos(cosine) / Math.PI;
}

export function computeEmbeddingSimilarity(
  input: EmbeddingSimilarityInput,
): number {
  switch (input.metric ?? 'COSINE') {
    case 'DOT':
      return computeDotSimilarity(input.left, input.right);
    case 'L2':
      return 1 / (1 + computeL2Distance(input.left, input.right));
    case 'ANGULAR':
      return computeAngularSimilarity(input.left, input.right);
    case 'COSINE':
    default:
      return computeCosineSimilarity(input.left, input.right);
  }
}

export function computeRecencyBoost(
  documentCreatedAtMs: number,
  queryCreatedAtMs: number,
  halfLifeMs = EMBEDDING_RECENCY_DEFAULT_HALF_LIFE_MS,
): number {
  if (halfLifeMs <= 0) return 1;
  const age = Math.max(0, queryCreatedAtMs - documentCreatedAtMs);
  const decay = Math.pow(0.5, age / halfLifeMs);
  return clampUnit(decay);
}

export function scoreEmbeddingDocumentMatch(
  query: EmbeddingSearchQuery,
  document: ConversationEmbeddingDocument,
): EmbeddingScoreBreakdown {
  const semanticScore =
    query.queryVector && document.vector
      ? clampRange(
          computeEmbeddingSimilarity({
            left: query.queryVector.values,
            right: document.vector.values,
            metric: query.distanceMetric,
          }),
          -1,
          1,
        )
      : 0;

  const lexicalScore = computeLexicalOverlap(
    query.canonicalQueryText,
    document.canonicalText,
  );
  const recencyScore = computeRecencyBoost(
    document.createdAtMs,
    query.createdAtMs,
    query.recencyHalfLifeMs ?? EMBEDDING_RECENCY_DEFAULT_HALF_LIFE_MS,
  );
  const salienceScore = clampUnit(document.salience.finalSalience);
  const relationshipScore = computeReferenceOverlapScore(
    query.relationshipRefs,
    document.relationshipRefs,
  );
  const emotionScore = computeTagOverlapScore(
    query.requiredTags,
    document.tags.emotions,
  );
  const continuityScore = computeReferenceOverlapScore(
    query.anchorRefs,
    document.anchorRefs,
  );

  const weighted =
    semanticScore * 0.36 +
    lexicalScore * 0.16 +
    recencyScore * 0.1 +
    salienceScore * 0.14 +
    relationshipScore * 0.1 +
    emotionScore * 0.06 +
    continuityScore * 0.08;

  const manualBoost =
    query.manualBoostByDocumentId?.[document.id] ??
    query.manualBoostByDocumentId?.[document.id as EmbeddingDocumentId] ??
    0;

  return Object.freeze({
    semanticScore,
    lexicalScore,
    recencyScore,
    salienceScore,
    relationshipScore,
    emotionScore,
    continuityScore,
    finalScore: clampRange(weighted + manualBoost, -10, 10),
  });
}

export function createEmbeddingSearchMatch(
  rank: number,
  document: ConversationEmbeddingDocument,
  score: EmbeddingScoreBreakdown,
): EmbeddingSearchMatch {
  return Object.freeze({
    rank,
    documentId: document.id,
    kind: document.kind,
    sourceKind: document.channelContext.sourceKind,
    summary: document.summary,
    score,
    matchingSpans: Object.freeze(document.spans.slice(0, 8)),
    quoteRefs: Object.freeze([...document.quoteRefs]),
    relationshipRefs: Object.freeze([...document.relationshipRefs]),
    anchorRefs: Object.freeze([...document.anchorRefs]),
    previewText: document.canonicalText.slice(0, 280),
  });
}

export function createEmbeddingSearchReceipt(
  query: EmbeddingSearchQuery,
  matches: readonly EmbeddingSearchMatch[],
  candidateCount: number,
  debugNotes: readonly string[] = [],
): EmbeddingSearchReceipt {
  return Object.freeze({
    id: createEmbeddingReceiptId(
      `${query.id}_${matches.length}_${candidateCount}`,
    ),
    queryId: query.id,
    createdAtMs: Date.now(),
    matchKind: query.matchKind,
    distanceMetric: query.distanceMetric,
    candidateCount,
    returnedCount: matches.length,
    topK: query.topK,
    minimumScore: query.minimumScore,
    winnerIds: Object.freeze(matches.map((value) => value.documentId)),
    debugNotes: Object.freeze([...debugNotes]),
  });
}

export function createEmbeddingPreview(
  document: ConversationEmbeddingDocument,
): EmbeddingPreview {
  return Object.freeze({
    id: createEmbeddingPreviewId(document.id),
    documentId: document.id,
    purpose: document.purpose,
    title: `${document.kind}:${document.channelContext.sourceKind}`,
    subtitle:
      document.channelContext.actorPersonaId ??
      document.channelContext.actorId ??
      document.channelContext.sourceId ??
      'unknown',
    summary: document.summary,
    topTags: Object.freeze(
      dedupeStrings([
        ...document.tags.emotions,
        ...document.tags.intents,
        ...document.tags.continuityTags,
      ]).slice(0, 8),
    ),
    sourceKind: document.channelContext.sourceKind,
    retentionClass: document.retentionClass,
    salience: document.salience.finalSalience,
  });
}

export function createEmbeddingBatchEnvelope(
  seed: string,
  purpose: EmbeddingPurpose,
  documents: readonly ConversationEmbeddingDocument[],
): EmbeddingBatchEnvelope {
  const model =
    documents[0]?.vector.model ?? createEmbeddingModelDescriptor({ purpose });
  const magnitudes = documents.map((value) => value.vector.magnitude);
  const saliences = documents.map((value) => value.salience.finalSalience);
  return Object.freeze({
    id: createEmbeddingBatchId(seed),
    createdAtMs: Date.now(),
    purpose,
    documents: Object.freeze([...documents]),
    vectorModel: model,
    averageDimensions:
      documents.length > 0
        ? Math.round(
            documents.reduce(
              (sum, value) => sum + value.vector.model.shape.dimensions,
              0,
            ) / documents.length,
          )
        : model.shape.dimensions,
    averageMagnitude: averageNumbers(magnitudes),
    averageSalience: averageNumbers(saliences),
    roomIds: Object.freeze(
      dedupeStrings(
        documents
          .map((value) => value.channelContext.roomId)
          .filter((value): value is string => Boolean(value)),
      ),
    ),
    runIds: Object.freeze(
      dedupeStrings(
        documents
          .map((value) => value.channelContext.runId)
          .filter((value): value is string => Boolean(value)),
      ),
    ),
  });
}

export function filterEmbeddingDocumentsForQuery(
  query: EmbeddingSearchQuery,
  documents: readonly ConversationEmbeddingDocument[],
): readonly ConversationEmbeddingDocument[] {
  return Object.freeze(
    documents.filter((document) => {
      if (query.includeKinds.length && !query.includeKinds.includes(document.kind)) {
        return false;
      }
      if (query.excludeKinds.includes(document.kind)) {
        return false;
      }
      if (
        query.includeSourceKinds.length &&
        !query.includeSourceKinds.includes(document.channelContext.sourceKind)
      ) {
        return false;
      }
      if (query.excludeSourceKinds.includes(document.channelContext.sourceKind)) {
        return false;
      }
      if (query.roomId && document.channelContext.roomId !== query.roomId) {
        return false;
      }
      if (query.channelId && document.channelContext.channelId !== query.channelId) {
        return false;
      }
      if (query.runId && document.channelContext.runId !== query.runId) {
        return false;
      }
      if (query.sceneId && document.channelContext.sceneId !== query.sceneId) {
        return false;
      }
      if (query.momentId && document.channelContext.momentId !== query.momentId) {
        return false;
      }
      if (query.timeFloorMs && document.createdAtMs < query.timeFloorMs) {
        return false;
      }
      if (query.timeCeilingMs && document.createdAtMs > query.timeCeilingMs) {
        return false;
      }
      if (
        typeof query.salienceFloor === 'number' &&
        document.salience.finalSalience < query.salienceFloor
      ) {
        return false;
      }
      if (
        query.requiredTags.length &&
        !query.requiredTags.every((tag) => embeddingDocumentHasTag(document, tag))
      ) {
        return false;
      }
      if (
        query.blockedTags.length &&
        query.blockedTags.some((tag) => embeddingDocumentHasTag(document, tag))
      ) {
        return false;
      }
      return true;
    }),
  );
}

export function rankEmbeddingDocuments(
  query: EmbeddingSearchQuery,
  documents: readonly ConversationEmbeddingDocument[],
): readonly EmbeddingSearchMatch[] {
  const filtered = filterEmbeddingDocumentsForQuery(query, documents);
  const scored = filtered
    .map((document) => ({
      document,
      score: scoreEmbeddingDocumentMatch(query, document),
    }))
    .filter((value) => value.score.finalScore >= query.minimumScore)
    .sort((left, right) => right.score.finalScore - left.score.finalScore)
    .slice(0, query.topK)
    .map((value, index) =>
      createEmbeddingSearchMatch(index + 1, value.document, value.score),
    );
  return Object.freeze(scored);
}

export function embeddingDocumentHasTag(
  document: ConversationEmbeddingDocument,
  tag: string,
): boolean {
  const allTags = [
    ...document.tags.intents,
    ...document.tags.emotions,
    ...document.tags.pressureTags,
    ...document.tags.relationshipTags,
    ...document.tags.callbackTags,
    ...document.tags.revealTags,
    ...document.tags.continuityTags,
    ...document.tags.arbitraryTags,
  ].map((value) => value.toLowerCase());
  return allTags.includes(tag.toLowerCase());
}

export function summarizeEmbeddingDocument(
  document: ConversationEmbeddingDocument,
): string {
  const parts = [
    document.kind,
    document.channelContext.sourceKind,
    `salience=${document.salience.finalSalience.toFixed(3)}`,
    document.summary,
  ];
  return parts.join(' | ');
}

export function summarizeEmbeddingMatch(
  match: EmbeddingSearchMatch,
): string {
  return [
    `rank=${match.rank}`,
    `id=${match.documentId}`,
    `score=${match.score.finalScore.toFixed(4)}`,
    match.summary,
  ].join(' | ');
}

export function computeLexicalOverlap(left: string, right: string): number {
  const leftTokens = new Set(tokenizeEmbeddingText(left));
  const rightTokens = new Set(tokenizeEmbeddingText(right));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  return intersection / Math.max(leftTokens.size, rightTokens.size);
}

export function tokenizeEmbeddingText(value: string): readonly string[] {
  return Object.freeze(
    canonicalizeEmbeddingText(value)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
}

export function computeReferenceOverlapScore(
  left: readonly string[],
  right: readonly string[],
): number {
  if (!left.length || !right.length) return 0;
  const leftSet = new Set(left);
  let overlap = 0;
  for (const value of right) {
    if (leftSet.has(value)) overlap += 1;
  }
  return overlap / Math.max(left.length, right.length);
}

export function computeTagOverlapScore(
  left: readonly string[],
  right: readonly string[],
): number {
  return computeReferenceOverlapScore(
    left.map((value) => value.toLowerCase()),
    right.map((value) => value.toLowerCase()),
  );
}

export function computeFinalSalience(
  profile: Partial<EmbeddingSalienceProfile>,
): number {
  const weighted =
    (profile.baseSalience ?? 0.5) * 0.16 +
    (profile.emotionalSalience ?? 0.5) * 0.14 +
    (profile.narrativeSalience ?? 0.5) * 0.14 +
    (profile.relationshipSalience ?? 0.5) * 0.14 +
    (profile.noveltySalience ?? 0.5) * 0.08 +
    (profile.prestigeSalience ?? 0) * 0.1 +
    (profile.comebackSalience ?? 0) * 0.08 +
    (profile.collapseSalience ?? 0) * 0.06 +
    (profile.rescueSalience ?? 0) * 0.05 +
    (profile.conflictSalience ?? 0) * 0.05;
  return clampUnit(weighted);
}

export function mergeEmbeddingTags(
  partial?: Partial<EmbeddingDocumentTags>,
): EmbeddingDocumentTags {
  const base = createDefaultEmbeddingTags();
  return Object.freeze({
    intents: Object.freeze(dedupeStrings([...(partial?.intents ?? base.intents)])),
    emotions: Object.freeze(dedupeStrings([...(partial?.emotions ?? base.emotions)])),
    pressureTags: Object.freeze(
      dedupeStrings([...(partial?.pressureTags ?? base.pressureTags)]),
    ),
    relationshipTags: Object.freeze(
      dedupeStrings([
        ...(partial?.relationshipTags ?? base.relationshipTags),
      ]),
    ),
    callbackTags: Object.freeze(
      dedupeStrings([...(partial?.callbackTags ?? base.callbackTags)]),
    ),
    revealTags: Object.freeze(
      dedupeStrings([...(partial?.revealTags ?? base.revealTags)]),
    ),
    continuityTags: Object.freeze(
      dedupeStrings([...(partial?.continuityTags ?? base.continuityTags)]),
    ),
    arbitraryTags: Object.freeze(
      dedupeStrings([...(partial?.arbitraryTags ?? base.arbitraryTags)]),
    ),
  });
}

export function averageNumbers(values: readonly number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function dedupeStrings(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }
  return Object.freeze(output);
}

export function clampUnit(value: number): number {
  return clampRange(value, 0, 1);
}

export function clampRange(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
