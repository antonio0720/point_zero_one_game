/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT SEMANTIC SIMILARITY INDEX
 * FILE: backend/src/game/engine/chat/intelligence/ChatSemanticSimilarityIndex.ts
 * VERSION: 2026.03.17-phase4
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Deterministic semantic repetition control for authored chat lines.
 *
 * The backend copy is authoritative. It exists so persistence services and server guards can make durable anti-repetition decisions without relying on client state.
 * ============================================================================
 */

import type {
  ChatSemanticDocumentInput,
  ChatSemanticIndexedDocument,
  ChatSemanticNeighbor,
  ChatSemanticNoveltyDecision,
  ChatSemanticNoveltyGuardRequest,
  ChatSemanticPressureBand,
  ChatSemanticQuery,
  ChatSemanticQueryResult,
  ChatSemanticRhetoricalForm,
  ChatSemanticSparseVectorEntry,
  ChatSemanticIndexSnapshot,
} from '../../../../../../shared/contracts/chat/semantic-similarity';

import {
  DEFAULT_CHAT_SEMANTIC_NOVELTY_GUARD,
  clamp01,
} from '../../../../../../shared/contracts/chat/semantic-similarity';

export const CHAT_SEMANTIC_SIMILARITY_INDEX_VERSION =
  '2026.03.17-phase4.semantic-index.v1' as const;

export interface ChatSemanticSimilarityIndexConfig {
  readonly dimensions: number;
  readonly maxNeighbors: number;
  readonly maxTokenCount: number;
  readonly topTermsForCluster: number;
  readonly charGramSize: number;
}

export const DEFAULT_CHAT_SEMANTIC_SIMILARITY_INDEX_CONFIG: ChatSemanticSimilarityIndexConfig = Object.freeze({
  dimensions: 192,
  maxNeighbors: 12,
  maxTokenCount: 72,
  topTermsForCluster: 6,
  charGramSize: 3,
});

interface DenseVectorBuild {
  readonly weightedTerms: Readonly<Record<string, number>>;
  readonly sparseVector: readonly ChatSemanticSparseVectorEntry[];
  readonly norm: number;
  readonly tokens: readonly string[];
  readonly rhetoricalForm: ChatSemanticRhetoricalForm;
  readonly rhetoricalFingerprint: string;
  readonly semanticClusterId: string;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9\s'\-.,!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitSentences(value: string): string[] {
  return normalizeText(value)
    .split(/[.!?]+/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function tokenizeWords(value: string): string[] {
  return normalizeText(value)
    .split(/\s+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function tokenizeBigrams(tokens: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    out.push(`${tokens[i]}~${tokens[i + 1]}`);
  }
  return out;
}

function tokenizeCharGrams(value: string, gramSize: number): string[] {
  const normalized = normalizeText(value).replace(/\s+/g, '_');
  if (normalized.length <= gramSize) return [normalized];
  const out: string[] = [];
  for (let i = 0; i <= normalized.length - gramSize; i += 1) {
    out.push(normalized.slice(i, i + gramSize));
  }
  return out;
}

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function inferRhetoricalForm(text: string): ChatSemanticRhetoricalForm {
  const normalized = normalizeText(text);
  if (!normalized) return 'UNKNOWN';
  if (/you thought .* i .*|you still think|you are not/i.test(normalized)) return 'THREAT_DECLARATIVE';
  if (/market|price|repric|liquid|asset|runway|leverage|distress/i.test(normalized)) return 'REPRICING_DECLARATIVE';
  if (/system|queue|review|compliance|file|procedure|department|approval/i.test(normalized)) return 'PROCEDURAL_DELAY';
  if (/pattern|predict|cadence|model|readable|trap|hesitat/i.test(normalized)) return 'PREDICTIVE_PROFILE';
  if (/macro|cycle|weather|storm|correction|regime|volatility/i.test(normalized)) return 'SYSTEMIC_INEVITABILITY';
  if (/inherit|structure|lineage|cushion|legacy|privilege/i.test(normalized)) return 'STRUCTURAL_ASYMMETRY';
  if (/remember|again|last time|still|callback|before/i.test(normalized)) return 'CALLBACK_WOUND';
  if (/breathe|steady|clean line|stabilize|hold|one move/i.test(normalized)) return 'RESCUE_STABILIZER';
  if (/everyone|room|witness|public|saw/i.test(normalized)) return 'WITNESS_JUDGMENT';
  if (normalized.length <= 8) return 'SILENCE_MARKER';
  return 'UNKNOWN';
}

function buildRhetoricalFingerprint(text: string): string {
  const normalized = normalizeText(text);
  const tokens = tokenizeWords(normalized);
  const sentenceCount = splitSentences(normalized).length;
  const startsWithYou = normalized.startsWith('you ');
  const containsI = /\bi\b/.test(normalized);
  const containsSystem = /system|market|room|queue|history|cycle/.test(normalized);
  const questionLike = normalized.includes('?');
  const imperativeLike = /^(breathe|hold|look|listen|remember|take|wait)\b/.test(normalized);
  return [
    inferRhetoricalForm(normalized),
    startsWithYou ? 'YOU_OPEN' : 'OTHER_OPEN',
    containsI ? 'HAS_I' : 'NO_I',
    containsSystem ? 'SYSTEMIC' : 'LOCAL',
    questionLike ? 'QUESTION' : 'STATEMENT',
    imperativeLike ? 'IMPERATIVE' : 'NON_IMPERATIVE',
    sentenceCount > 1 ? 'MULTI' : 'SINGLE',
    tokens.length > 14 ? 'LONG' : tokens.length > 7 ? 'MEDIUM' : 'SHORT',
  ].join('|');
}

function sortEntries(entries: Map<number, number>): readonly ChatSemanticSparseVectorEntry[] {
  return [...entries.entries()]
    .filter(([, value]) => value !== 0)
    .sort((a, b) => a[0] - b[0])
    .map(([dimension, value]) => ({ dimension, value: Number(value.toFixed(6)) }));
}

function cosineSimilarity(
  left: readonly ChatSemanticSparseVectorEntry[],
  leftNorm: number,
  right: readonly ChatSemanticSparseVectorEntry[],
  rightNorm: number,
): number {
  if (leftNorm <= 0 || rightNorm <= 0) return 0;
  let i = 0;
  let j = 0;
  let dot = 0;
  while (i < left.length && j < right.length) {
    const li = left[i];
    const rj = right[j];
    if (li.dimension === rj.dimension) {
      dot += li.value * rj.value;
      i += 1;
      j += 1;
      continue;
    }
    if (li.dimension < rj.dimension) i += 1;
    else j += 1;
  }
  return clamp01(dot / (leftNorm * rightNorm));
}

function overlapTokens(left: readonly string[], right: readonly string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((token) => rightSet.has(token)).slice(0, 12);
}

function buildDenseVector(
  text: string,
  tags: readonly string[],
  motifIds: readonly string[],
  sceneRoles: readonly string[],
  callbackSourceIds: readonly string[],
  config: ChatSemanticSimilarityIndexConfig,
): DenseVectorBuild {
  const tokens = tokenizeWords(text).slice(0, config.maxTokenCount);
  const bigrams = tokenizeBigrams(tokens).slice(0, config.maxTokenCount);
  const charGrams = tokenizeCharGrams(text, config.charGramSize).slice(0, config.maxTokenCount * 2);
  const weightedTerms = new Map<string, number>();

  const bump = (key: string, amount: number) => {
    const safeKey = key.trim();
    if (!safeKey) return;
    weightedTerms.set(safeKey, Number(((weightedTerms.get(safeKey) ?? 0) + amount).toFixed(6)));
  };

  for (const token of tokens) bump(`w:${token}`, 1.0);
  for (const bigram of bigrams) bump(`b:${bigram}`, 1.25);
  for (const gram of charGrams) bump(`c:${gram}`, 0.28);
  for (const tag of tags) bump(`t:${normalizeText(tag)}`, 0.35);
  for (const motif of motifIds) bump(`m:${normalizeText(motif)}`, 0.55);
  for (const role of sceneRoles) bump(`s:${normalizeText(role)}`, 0.32);
  for (const callbackId of callbackSourceIds) bump(`cb:${normalizeText(callbackId)}`, 0.25);

  const entries = new Map<number, number>();
  for (const [term, weight] of weightedTerms.entries()) {
    const dimension = stableHash(term) % config.dimensions;
    entries.set(dimension, (entries.get(dimension) ?? 0) + weight);
  }

  const sparseVector = sortEntries(entries);
  const norm = Math.sqrt(sparseVector.reduce((sum, entry) => sum + entry.value * entry.value, 0));

  const topTerms = [...weightedTerms.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, config.topTermsForCluster)
    .map(([term]) => term.replace(/^[a-z]+:/, ''));

  const rhetoricalForm = inferRhetoricalForm(text);
  const rhetoricalFingerprint = buildRhetoricalFingerprint(text);
  const semanticClusterId = `cluster:${stableHash(`${rhetoricalForm}|${topTerms.join('|')}`).toString(36)}`;

  return {
    weightedTerms: Object.freeze(Object.fromEntries(weightedTerms.entries())),
    sparseVector,
    norm,
    tokens: Object.freeze(tokens),
    rhetoricalForm,
    rhetoricalFingerprint,
    semanticClusterId,
  };
}

function createDocument(
  input: ChatSemanticDocumentInput,
  config: ChatSemanticSimilarityIndexConfig,
): ChatSemanticIndexedDocument {
  const tags = Object.freeze([...(input.tags ?? [])]);
  const motifIds = Object.freeze([...(input.motifIds ?? [])]);
  const sceneRoles = Object.freeze([...(input.sceneRoles ?? [])]);
  const callbackSourceIds = Object.freeze([...(input.callbackSourceIds ?? [])]);
  const normalizedText = normalizeText(input.text);
  const dense = buildDenseVector(normalizedText, tags, motifIds, sceneRoles, callbackSourceIds, config);
  return {
    documentId: input.documentId,
    canonicalLineId: input.canonicalLineId,
    actorId: input.actorId ?? null,
    botId: input.botId ?? null,
    text: input.text,
    normalizedText,
    tokens: dense.tokens,
    weightedTerms: dense.weightedTerms,
    rhetoricalForm: dense.rhetoricalForm,
    rhetoricalFingerprint: dense.rhetoricalFingerprint,
    semanticClusterId: dense.semanticClusterId,
    sparseVector: dense.sparseVector,
    vectorNorm: Number(dense.norm.toFixed(6)),
    tags,
    motifIds,
    sceneRoles,
    callbackSourceIds,
    pressureBand: input.pressureBand,
    createdAt: input.createdAt,
  };
}

function neighborFromDocuments(
  candidate: ChatSemanticIndexedDocument,
  against: ChatSemanticIndexedDocument,
): ChatSemanticNeighbor {
  return {
    documentId: against.documentId,
    canonicalLineId: against.canonicalLineId,
    similarity01: cosineSimilarity(candidate.sparseVector, candidate.vectorNorm, against.sparseVector, against.vectorNorm),
    semanticClusterId: against.semanticClusterId,
    rhetoricalForm: against.rhetoricalForm,
    overlapTokens: overlapTokens(candidate.tokens, against.tokens),
    tags: against.tags,
    notes: Object.freeze([
      candidate.semanticClusterId === against.semanticClusterId ? 'same_cluster' : 'different_cluster',
      candidate.rhetoricalFingerprint === against.rhetoricalFingerprint ? 'same_rhetorical_shape' : 'different_rhetorical_shape',
    ]),
  };
}

export class ChatSemanticSimilarityIndex {
  private readonly documents = new Map<string, ChatSemanticIndexedDocument>();
  private readonly clusterMembership = new Map<string, Set<string>>();
  private readonly config: ChatSemanticSimilarityIndexConfig;

  public constructor(config: Partial<ChatSemanticSimilarityIndexConfig> = {}) {
    this.config = Object.freeze({ ...DEFAULT_CHAT_SEMANTIC_SIMILARITY_INDEX_CONFIG, ...config });
  }

  public getConfig(): Readonly<ChatSemanticSimilarityIndexConfig> {
    return this.config;
  }

  public indexDocument(input: ChatSemanticDocumentInput): ChatSemanticIndexedDocument {
    const next = createDocument(input, this.config);
    this.upsert(next);
    return next;
  }

  public indexDocuments(inputs: readonly ChatSemanticDocumentInput[]): readonly ChatSemanticIndexedDocument[] {
    return inputs.map((input) => this.indexDocument(input));
  }

  public upsert(document: ChatSemanticIndexedDocument): void {
    const prior = this.documents.get(document.documentId);
    if (prior) {
      const priorMembers = this.clusterMembership.get(prior.semanticClusterId);
      priorMembers?.delete(prior.documentId);
      if (priorMembers && priorMembers.size === 0) this.clusterMembership.delete(prior.semanticClusterId);
    }
    this.documents.set(document.documentId, document);
    const members = this.clusterMembership.get(document.semanticClusterId) ?? new Set<string>();
    members.add(document.documentId);
    this.clusterMembership.set(document.semanticClusterId, members);
  }

  public removeDocument(documentId: string): boolean {
    const current = this.documents.get(documentId);
    if (!current) return false;
    this.documents.delete(documentId);
    const members = this.clusterMembership.get(current.semanticClusterId);
    members?.delete(documentId);
    if (members && members.size === 0) this.clusterMembership.delete(current.semanticClusterId);
    return true;
  }

  public getDocument(documentId: string): ChatSemanticIndexedDocument | undefined {
    return this.documents.get(documentId);
  }

  public listDocuments(): readonly ChatSemanticIndexedDocument[] {
    return [...this.documents.values()].sort((a, b) => a.createdAt - b.createdAt || a.documentId.localeCompare(b.documentId));
  }

  public listClusterMembers(clusterId: string): readonly ChatSemanticIndexedDocument[] {
    const ids = [...(this.clusterMembership.get(clusterId) ?? new Set<string>())];
    return ids
      .map((id) => this.documents.get(id))
      .filter((value): value is ChatSemanticIndexedDocument => Boolean(value));
  }

  public queryNearest(query: ChatSemanticQuery): ChatSemanticQueryResult {
    const candidate = createDocument(
      {
        documentId: `query:${query.queryId}`,
        text: query.text,
        createdAt: query.now,
        sceneRoles: query.sceneRoles,
        pressureBand: query.pressureBand,
        tags: query.preferredTags,
      },
      this.config,
    );

    const excluded = new Set(query.excludedDocumentIds ?? []);
    const minSimilarity01 = query.minSimilarity01 ?? 0;
    const maxResults = Math.min(query.maxResults ?? this.config.maxNeighbors, this.config.maxNeighbors);

    const neighbors = this.listDocuments()
      .filter((document) => !excluded.has(document.documentId))
      .map((document) => neighborFromDocuments(candidate, document))
      .filter((neighbor) => neighbor.similarity01 >= minSimilarity01)
      .sort((a, b) => b.similarity01 - a.similarity01 || a.documentId.localeCompare(b.documentId))
      .slice(0, maxResults);

    return {
      queryId: query.queryId,
      computedAt: query.now,
      queryDocument: candidate,
      neighbors,
    };
  }

  public guardNovelty(request: ChatSemanticNoveltyGuardRequest): ChatSemanticNoveltyDecision {
    const config = { ...DEFAULT_CHAT_SEMANTIC_NOVELTY_GUARD, ...(request.config ?? {}) };
    const candidateDocument = createDocument(request.candidate, this.config);
    const neighbors = request.recentDocuments
      .map((document) => neighborFromDocuments(candidateDocument, document))
      .sort((a, b) => b.similarity01 - a.similarity01 || a.documentId.localeCompare(b.documentId))
      .slice(0, this.config.maxNeighbors);

    const highestSimilarity01 = neighbors[0]?.similarity01 ?? 0;
    const repeatedClusterCount = request.recentDocuments.filter((document) => document.semanticClusterId === candidateDocument.semanticClusterId).length;
    const repeatedRhetoricalCount = request.recentDocuments.filter((document) => document.rhetoricalFingerprint === candidateDocument.rhetoricalFingerprint).length;
    const exactTextRepeat = request.recentDocuments.some((document) => document.normalizedText === candidateDocument.normalizedText);

    let noveltyScore01 = 1;
    const blockedReasons: string[] = [];

    if (exactTextRepeat) {
      noveltyScore01 -= config.exactTextPenalty01;
      blockedReasons.push('exact_text_repeat');
    }
    if (highestSimilarity01 > config.maxSimilarityToRecent01) {
      noveltyScore01 -= Math.max(config.clusterPenalty01, highestSimilarity01 - config.maxSimilarityToRecent01);
      blockedReasons.push('semantic_similarity_too_high');
    }
    if (repeatedClusterCount > config.maxRecentClusterReuses) {
      noveltyScore01 -= config.clusterPenalty01;
      blockedReasons.push('cluster_reused_too_often');
    }
    if (repeatedRhetoricalCount > 0) {
      noveltyScore01 -= config.rhetoricalPenalty01 * Math.min(repeatedRhetoricalCount, 3);
      if (repeatedRhetoricalCount > 1) blockedReasons.push('rhetorical_shape_fatigue');
    }

    const fatigueScore01 = clamp01(
      repeatedClusterCount * 0.18 +
      repeatedRhetoricalCount * 0.16 +
      highestSimilarity01 * 0.52 +
      (exactTextRepeat ? 0.28 : 0),
    );

    const allowed =
      !exactTextRepeat &&
      highestSimilarity01 <= config.maxSimilarityToRecent01 &&
      repeatedClusterCount <= config.maxRecentClusterReuses &&
      fatigueScore01 <= 0.98;

    return {
      requestId: request.requestId,
      computedAt: request.now,
      candidateDocument,
      allowed,
      noveltyScore01: clamp01(noveltyScore01),
      fatigueScore01,
      highestSimilarity01,
      repeatedClusterCount,
      repeatedRhetoricalCount,
      nearestNeighbors: neighbors,
      blockedReasons: Object.freeze(blockedReasons),
    };
  }

  public createSnapshot(now: number = Date.now()): ChatSemanticIndexSnapshot {
    return {
      createdAt: now,
      updatedAt: now,
      dimensions: this.config.dimensions,
      documents: this.listDocuments(),
      clusterMembership: Object.freeze(
        Object.fromEntries(
          [...this.clusterMembership.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([clusterId, ids]) => [clusterId, Object.freeze([...ids].sort())]),
        ),
      ),
    };
  }

  public hydrate(snapshot: ChatSemanticIndexSnapshot): void {
    this.documents.clear();
    this.clusterMembership.clear();
    for (const document of snapshot.documents) this.upsert(document);
  }
}

export function createChatSemanticSimilarityIndex(
  config: Partial<ChatSemanticSimilarityIndexConfig> = {},
): ChatSemanticSimilarityIndex {
  return new ChatSemanticSimilarityIndex(config);
}
