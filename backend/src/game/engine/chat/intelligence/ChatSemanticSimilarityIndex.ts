/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT SEMANTIC SIMILARITY INDEX
 * FILE: backend/src/game/engine/chat/intelligence/ChatSemanticSimilarityIndex.ts
 * VERSION: 2026.03.21-sovereign-depth.v2
 * AUTHORSHIP: Antonio T. Smith Jr. — Density6 LLC
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * AUTHORITY
 * ---------
 * The backend copy is canonical. It is the only copy that:
 *   - makes durable anti-repetition decisions persisted to the transcript
 *   - gates novelty at the server before transcript write
 *   - produces training data rows for the ML similarity model
 *   - federates across global, room, actor, and channel scopes
 *   - participates in the ProofChain for transcript integrity
 *
 * WHAT THIS FILE IS
 * -----------------
 * A deterministic semantic repetition-control engine that prevents the PZO
 * chat system from firing the same emotional move twice in the same window.
 * It is not a fuzzy match engine. It is not a search engine. It is an
 * anti-fatigue governor with full awareness of:
 *
 *   - Per-NPC semantic cluster spaces (LIQUIDATOR clusters ≠ MENTOR clusters)
 *   - Game pressure tiers (CRITICAL requires more novelty than CALM)
 *   - Game mode policies (Predator deal-room requires maximum variety)
 *   - Channel behavioral zones (GLOBAL ≠ DEAL_ROOM ≠ SYNDICATE)
 *   - Rhetorical form taxonomy (30+ forms mapped to game's emotional grammar)
 *   - Decay curves (recent lines penalize more than old ones)
 *   - Motif continuity (callback lines exempt from some novelty rules)
 *   - Audience heat (high heat can relax repetition so crowd reacts naturally)
 *   - Federation (global + room + actor + channel index slots run in parallel)
 *
 * SCALE REQUIREMENT
 * -----------------
 * Designed for 20 million concurrent users. Every public method must:
 *   - Execute in O(n) or better for the hot path
 *   - Support per-room isolation (no shared mutable state between rooms)
 *   - Support hydration from a Postgres snapshot in < 50ms
 *   - Support batch indexing of 600+ NPC lines at startup
 *
 * IMPORT DISCIPLINE
 * -----------------
 * This file imports ONLY from:
 *   1. shared/contracts/chat/semantic-similarity (shared types + constants)
 *   2. ../types (backend chat types)
 *   Nothing else. No circular engine imports. No React. No server transports.
 *
 * ============================================================================
 */

// ── MARK: Shared contract imports ────────────────────────────────────────────

import type {
  ChatSemanticActorClass,
  ChatSemanticChannelPolicy,
  ChatSemanticDecayCurve,
  ChatSemanticDocumentFlags,
  ChatSemanticDocumentInput,
  ChatSemanticExplainabilityTerm,
  ChatSemanticFederationScope,
  ChatSemanticIndexedDocument,
  ChatSemanticIndexSnapshot,
  ChatSemanticModePolicy,
  ChatSemanticModeScope,
  ChatSemanticNeighbor,
  ChatSemanticNoveltyDecision,
  ChatSemanticNoveltyGuardConfig,
  ChatSemanticNoveltyGuardRequest,
  ChatSemanticNoveltyWindowStats,
  ChatSemanticPressureBand,
  ChatSemanticPressureThresholds,
  ChatSemanticProvenance,
  ChatSemanticQuery,
  ChatSemanticQueryResult,
  ChatSemanticQueryStrategy,
  ChatSemanticRhetoricalFamily,
  ChatSemanticRhetoricalForm,
  ChatSemanticSparseVectorEntry,
  ChatSemanticTelemetryRecord,
  ChatSemanticTextRegister,
  ChatSemanticCadenceClass,
  ChatSemanticSourceKind,
  ChatSemanticActorIndexSlot,
  ChatSemanticTrainingRow,
} from '../../../../../../shared/contracts/chat/semantic-similarity';

import {
  DEFAULT_CHAT_SEMANTIC_NOVELTY_GUARD,
  DEFAULT_CHAT_SEMANTIC_DECAY_CURVE,
  buildExplainabilityTermsForForm,
  clamp01,
  createDefaultDocumentFlags,
  createDefaultProvenance,
  deriveRhetoricalFamily,
  resolveChannelPolicy,
  resolveModePolicy,
  resolvePressureThresholds,
} from '../../../../../../shared/contracts/chat/semantic-similarity';

// ── MARK: Backend types ────────────────────────────────────────────────────

import type {
  ChatChannelId,
  Score01,
  UnixMs,
} from '../types';

// ============================================================================
// MARK: Version constant
// ============================================================================

export const CHAT_SEMANTIC_SIMILARITY_INDEX_VERSION =
  '2026.03.21-sovereign-depth.v2' as const;

// Local semantic mode scope is intentionally string-backed.
// The semantic policy lane and backend mode lane are currently evolving at different speeds.
// This index treats mode scope as an authored token, not a closed enum.
type SemanticModeScope = ChatSemanticModeScope;

function asDocumentModeScope(
  value: SemanticModeScope | undefined,
): ChatSemanticDocumentInput['modeScope'] {
  return value as ChatSemanticDocumentInput['modeScope'];
}

function modeScopeEquals(
  value: ChatSemanticDocumentInput['modeScope'] | ChatSemanticIndexedDocument['modeScope'] | undefined,
  expected: string,
): boolean {
  return String(value ?? '') === expected;
}

// ============================================================================
// MARK: Config interface and defaults
// ============================================================================

export interface ChatSemanticSimilarityIndexConfig {
  /** Sparse vector dimension count. Higher = better discrimination. */
  readonly dimensions: number;
  /** Maximum nearest-neighbor results returned per query. */
  readonly maxNeighbors: number;
  /** Maximum tokens extracted per document. */
  readonly maxTokenCount: number;
  /** Number of top-weighted terms used to compute cluster ID. */
  readonly topTermsForCluster: number;
  /** Character n-gram size for sub-word representation. */
  readonly charGramSize: number;
  /** Maximum documents in the rolling recent-window. */
  readonly recentWindowMaxSize: number;
  /** Whether per-actor federated index slots are enabled. */
  readonly actorFederationEnabled: boolean;
  /** Whether decay curves are applied to novelty scores. */
  readonly decayEnabled: boolean;
  /** Max training rows buffered in memory before flush. */
  readonly trainingBufferMaxSize: number;
  /** Max telemetry records buffered in memory before flush. */
  readonly telemetryBufferMaxSize: number;
  /** Whether audience heat integration modifies novelty thresholds. */
  readonly audienceHeatIntegrationEnabled: boolean;
  /** Snapshot version tag for migration safety. */
  readonly snapshotVersion: string;
}

export const DEFAULT_CHAT_SEMANTIC_SIMILARITY_INDEX_CONFIG: ChatSemanticSimilarityIndexConfig =
  Object.freeze({
    dimensions: 192,
    maxNeighbors: 12,
    maxTokenCount: 72,
    topTermsForCluster: 6,
    charGramSize: 3,
    recentWindowMaxSize: 60,
    actorFederationEnabled: true,
    decayEnabled: true,
    trainingBufferMaxSize: 512,
    telemetryBufferMaxSize: 256,
    audienceHeatIntegrationEnabled: true,
    snapshotVersion: CHAT_SEMANTIC_SIMILARITY_INDEX_VERSION,
  });

// ============================================================================
// MARK: Internal dense vector build result
// ============================================================================

interface DenseVectorBuild {
  readonly weightedTerms: Readonly<Record<string, number>>;
  readonly sparseVector: readonly ChatSemanticSparseVectorEntry[];
  readonly norm: number;
  readonly tokens: readonly string[];
  readonly rhetoricalForm: ChatSemanticRhetoricalForm;
  readonly rhetoricalFingerprint: string;
  readonly semanticClusterId: string;
}

// ============================================================================
// MARK: Text normalization utilities
// ============================================================================

function normalizeText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
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

// ============================================================================
// MARK: FNV-1a stable hash (deterministic across runs)
// ============================================================================

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableHashPair(a: string, b: string): string {
  return `${stableHash(a).toString(36)}:${stableHash(b).toString(36)}`;
}

// ============================================================================
// MARK: Rhetorical form inference
// ============================================================================

/**
 * inferRhetoricalForm
 *
 * Classifies the structural intent of a text string using the 30+ form
 * taxonomy defined in the shared contract. Classification is rule-based and
 * deterministic — the same text always produces the same form. No LLM calls.
 *
 * Rules are ordered by specificity. Later rules act as fallbacks.
 * The taxonomy covers all five NPC classes plus system and negotiation forms.
 */
function inferRhetoricalForm(text: string): ChatSemanticRhetoricalForm {
  const n = normalizeText(text);
  if (!n) return 'UNKNOWN';

  // ── Silence / system markers (highest priority — short or structured)
  if (n.length <= 5 || /^\.{1,3}$|^\.\.\.$/.test(n)) return 'SILENCE_MARKER';
  if (/^\[.*\]$/.test(n.trim())) return 'SYSTEM_NOTICE';
  if (/proof|hash|verified|run #/i.test(n)) return 'PROOF_STAMP';
  if (/season event|liveops|special round/i.test(n)) return 'LIVEOPS_SIGNAL';

  // ── Hater archetypes — LIQUIDATOR (liquidity/financial threat)
  if (/you thought .* i .*|you still think|you are not ready|tick tock|expose/i.test(n))
    return 'THREAT_DECLARATIVE';
  if (/market|price|repric|liquid|asset|runway|leverage|distress|cashflow|bankruptcy/i.test(n))
    return 'REPRICING_DECLARATIVE';
  if (/extract|redirecting|siphon|taking your/i.test(n))
    return 'EXTRACTION_NOTICE';

  // ── Hater archetypes — BUREAUCRAT (procedural obstruction)
  if (/system|queue|review|compliance|file|procedure|department|approval|processing|audit|form/i.test(n))
    return 'PROCEDURAL_DELAY';

  // ── Hater archetypes — MANIPULATOR (pattern / prediction)
  if (/pattern|predict|cadence|model|readable|trap|hesitat|correlated|probability/i.test(n))
    return 'PREDICTIVE_PROFILE';
  if (/surveillance|watching|studying|noticed|already know/i.test(n))
    return 'SURVEILLANCE_SIGNAL';
  if (/bluff|that card doesn|that play|calling you/i.test(n))
    return 'BLUFF_EXPOSURE';

  // ── Hater archetypes — CRASH PROPHET (systemic/macro)
  if (/macro|cycle|weather|storm|correction|regime|volatility|historically|crash|contagion/i.test(n))
    return 'SYSTEMIC_INEVITABILITY';

  // ── Hater archetypes — LEGACY HEIR (structural advantage)
  if (/inherit|structure|lineage|cushion|legacy|privilege|generational|born with|trust fund/i.test(n))
    return 'STRUCTURAL_ASYMMETRY';

  // ── Memory / callback forms
  if (/remember|again|last time|still|callback|before|that move|back when/i.test(n))
    return 'CALLBACK_WOUND';

  // ── Witness forms
  if (/everyone|room|witness|public|saw|floor sees|crowd|the room|logged/i.test(n)) {
    if (/logged|ledger|offer|counter/i.test(n)) return 'DEAL_ROOM_LOG';
    if (/lobby|heard|rumor/i.test(n)) return 'LOBBY_RUMOR';
    if (/archive|record|marked/i.test(n)) return 'MARKET_WITNESS_NOTE';
    if (/humiliat|embarrass/i.test(n)) return 'HUMILIATION_RECEIPT';
    return 'WITNESS_JUDGMENT';
  }

  // ── Rivalry form
  if (/i'm ahead|stay ahead|beat you|faster than|ahead of/i.test(n))
    return 'RIVALRY_PRESSURE';

  // ── Helper archetypes — RESCUE / MENTOR forms
  if (/breathe|steady|clean line|stabilize|hold|one move|focus|anchor|fundamentals/i.test(n))
    return 'RESCUE_STABILIZER';
  if (/here's why|cut expenses|rebuild|here's a hint|suggestion|next move|try this/i.test(n))
    return 'TACTICAL_REDIRECT';
  if (/i've been there|where you are|been exactly|I know this|I lost|I failed/i.test(n))
    return 'SURVIVOR_TESTIMONY';
  if (/tip:|heads up:|that card has|synergy|mechanic|hidden|window closes|listen carefully/i.test(n))
    return 'INSIDER_SIGNAL';
  if (/historically|archive|data|percent|rate|analyzed|across.*runs|recorded/i.test(n))
    return 'ARCHIVIST_RECORD';
  if (/you've earned|you can do this|stay disciplined|keep pushing|you still have/i.test(n))
    return 'MENTOR_ANCHOR';
  if (/I hit that|30 ticks ago|i'm still ahead|prove it|step it up|you're catching up/i.test(n))
    return 'RIVAL_DARE';

  // ── Ambient forms
  if (/quietly|between us|whisper|keep that private/i.test(n))
    return 'CROWD_REACTION';

  // ── Negotiation forms (Predator / DEAL_ROOM)
  if (/i have what you need|leverage|what i'm offering/i.test(n))
    return 'LEVERAGE_CLAIM';
  if (/here's what i'm proposing|proposal|my offer|terms are/i.test(n))
    return 'OFFER_FRAME';
  if (/you hesitated|what's the real|why are you|real number|blinking/i.test(n))
    return 'COUNTER_PROBE';
  if (/already talking|someone else|another offer|walk away/i.test(n))
    return 'BLUFF_DEPLOY';
  if (/^\.{1,4}$|^… ?$|^\-+$/.test(n.trim()))
    return 'SILENCE_WEAPON';

  return 'UNKNOWN';
}

// ============================================================================
// MARK: Rhetorical fingerprint
// ============================================================================

/**
 * buildRhetoricalFingerprint
 *
 * A structural fingerprint combining rhetorical form with grammatical and
 * pragmatic features. Two lines with the same fingerprint fire the same
 * emotional move even if their words are completely different.
 *
 * This is the core anti-fatigue mechanism — fingerprint collisions trigger
 * the rhetoricalPenalty regardless of cosine similarity.
 */
function buildRhetoricalFingerprint(text: string): string {
  const normalized = normalizeText(text);
  const tokens = tokenizeWords(normalized);
  const sentenceCount = splitSentences(normalized).length;
  const startsWithYou = normalized.startsWith('you ');
  const startsWithI = /^i\b/.test(normalized);
  const containsI = /\bi\b/.test(normalized);
  const containsSystem = /system|market|room|queue|history|cycle|floor|lobby/.test(normalized);
  const questionLike = normalized.includes('?');
  const imperativeLike = /^(breathe|hold|look|listen|remember|take|wait|cut|check|play|rebuild|focus)\b/.test(normalized);
  const containsNumbers = /\d{1,3}%|\d+ ticks|\$\d|\d+\.?\d*/.test(normalized);
  const lengthBand =
    tokens.length > 18 ? 'X-LONG'
    : tokens.length > 12 ? 'LONG'
    : tokens.length > 6 ? 'MEDIUM'
    : tokens.length > 2 ? 'SHORT'
    : 'MICRO';

  return [
    inferRhetoricalForm(normalized),
    startsWithYou ? 'YOU_OPEN' : startsWithI ? 'I_OPEN' : 'OTHER_OPEN',
    containsI ? 'HAS_I' : 'NO_I',
    containsSystem ? 'SYSTEMIC' : 'LOCAL',
    questionLike ? 'QUESTION' : 'STATEMENT',
    imperativeLike ? 'IMPERATIVE' : 'NON_IMPERATIVE',
    sentenceCount > 2 ? 'MULTI' : sentenceCount > 1 ? 'DUAL' : 'SINGLE',
    containsNumbers ? 'HAS_NUMBERS' : 'NO_NUMBERS',
    lengthBand,
  ].join('|');
}

// ============================================================================
// MARK: Sparse vector math
// ============================================================================

function sortEntries(
  entries: Map<number, number>,
): readonly ChatSemanticSparseVectorEntry[] {
  return [...entries.entries()]
    .filter(([, value]) => value !== 0)
    .sort((a, b) => a[0] - b[0])
    .map(([dimension, value]) => ({
      dimension,
      value: Number(value.toFixed(6)),
    }));
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
    const li = left[i]!;
    const rj = right[j]!;
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

function overlapTokens(
  left: readonly string[],
  right: readonly string[],
): string[] {
  const rightSet = new Set(right);
  return left.filter((token) => rightSet.has(token)).slice(0, 12);
}

// ============================================================================
// MARK: Dense vector builder
// ============================================================================

/**
 * buildDenseVector
 *
 * Projects text + metadata into a sparse vector in R^dimensions.
 * Uses FNV-1a hash bucketing. Weights:
 *
 *   word unigram          1.00   (semantic core)
 *   word bigram           1.25   (phrase-level discrimination)
 *   char n-gram           0.28   (sub-word anchoring, handles typos/abbreviation)
 *   content tags          0.35   (authored tag enrichment)
 *   motif IDs             0.55   (cross-run narrative continuity)
 *   scene roles           0.32   (staged position: OPENER vs CLOSER)
 *   callback source IDs   0.25   (callback detection signal)
 *   channel bias          0.45   (DEAL_ROOM lines cluster differently than GLOBAL)
 *   mode scope bias       0.40   (Predator lines cluster differently than Empire)
 *   pressure band bias    0.30   (CRITICAL lines use tighter cluster spaces)
 *
 * The hash space is 192-dimensional by default. Collision probability is
 * low enough for the vocabulary sizes in PZO's NPC corpus (~600–2000 lines).
 * Increase to 256+ for corpora > 10,000 lines.
 */
function buildDenseVector(
  text: string,
  tags: readonly string[],
  motifIds: readonly string[],
  sceneRoles: readonly string[],
  callbackSourceIds: readonly string[],
  channelId: ChatChannelId | undefined,
  modeScope: SemanticModeScope | undefined,
  pressureBand: ChatSemanticPressureBand | undefined,
  config: ChatSemanticSimilarityIndexConfig,
): DenseVectorBuild {
  const tokens = tokenizeWords(text).slice(0, config.maxTokenCount);
  const bigrams = tokenizeBigrams(tokens).slice(0, config.maxTokenCount);
  const charGrams = tokenizeCharGrams(text, config.charGramSize).slice(
    0,
    config.maxTokenCount * 2,
  );
  const weightedTerms = new Map<string, number>();

  const bump = (key: string, amount: number): void => {
    const safeKey = key.trim();
    if (!safeKey) return;
    weightedTerms.set(
      safeKey,
      Number(((weightedTerms.get(safeKey) ?? 0) + amount).toFixed(6)),
    );
  };

  // ── Core text features
  for (const token of tokens) bump(`w:${token}`, 1.0);
  for (const bigram of bigrams) bump(`b:${bigram}`, 1.25);
  for (const gram of charGrams) bump(`c:${gram}`, 0.28);

  // ── Authored metadata features
  for (const tag of tags) bump(`t:${normalizeText(tag)}`, 0.35);
  for (const motif of motifIds) bump(`m:${normalizeText(motif)}`, 0.55);
  for (const role of sceneRoles) bump(`s:${normalizeText(role)}`, 0.32);
  for (const callbackId of callbackSourceIds)
    bump(`cb:${normalizeText(callbackId)}`, 0.25);

  // ── Context features
  if (channelId) bump(`ch:${normalizeText(channelId)}`, 0.45);
  if (modeScope) bump(`ms:${normalizeText(modeScope)}`, 0.40);
  if (pressureBand) bump(`pb:${pressureBand}`, 0.30);

  // ── Hash projection into dimension space
  const entries = new Map<number, number>();
  for (const [term, weight] of weightedTerms.entries()) {
    const dimension = stableHash(term) % config.dimensions;
    entries.set(dimension, (entries.get(dimension) ?? 0) + weight);
  }

  const sparseVector = sortEntries(entries);
  const norm = Math.sqrt(
    sparseVector.reduce((sum, entry) => sum + entry.value * entry.value, 0),
  );

  const topTerms = [...weightedTerms.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, config.topTermsForCluster)
    .map(([term]) => term.replace(/^[a-z]+:/, ''));

  const rhetoricalForm = inferRhetoricalForm(text);
  const rhetoricalFingerprint = buildRhetoricalFingerprint(text);

  // Cluster ID encodes rhetorical form + top terms so that semantically
  // similar lines from different NPC archetypes still share a cluster when
  // they fire the same emotional move.
  const semanticClusterId = `cluster:${stableHash(
    `${rhetoricalForm}|${topTerms.join('|')}`,
  ).toString(36)}`;

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

function inferActorClass(
  input: ChatSemanticDocumentInput,
  rhetoricalForm: ChatSemanticRhetoricalForm,
): ChatSemanticActorClass {
  if (input.actorClass) return input.actorClass;
  if (input.sourceKind === 'PLAYER_QUOTE') return 'PLAYER';
  if (input.sourceKind === 'LIVEOPS_OVERLAY') return 'LIVEOPS';
  if (
    rhetoricalForm === 'SYSTEM_NOTICE' ||
    rhetoricalForm === 'PROOF_STAMP'
  ) {
    return 'SYSTEM';
  }
  if (
    rhetoricalForm === 'RESCUE_STABILIZER' ||
    rhetoricalForm === 'TACTICAL_REDIRECT' ||
    rhetoricalForm === 'SURVIVOR_TESTIMONY' ||
    rhetoricalForm === 'INSIDER_SIGNAL' ||
    rhetoricalForm === 'ARCHIVIST_RECORD' ||
    rhetoricalForm === 'MENTOR_ANCHOR'
  ) {
    return 'HELPER';
  }
  if (
    rhetoricalForm === 'CROWD_REACTION' ||
    rhetoricalForm === 'LOBBY_RUMOR' ||
    rhetoricalForm === 'MARKET_WITNESS_NOTE' ||
    rhetoricalForm === 'WITNESS_JUDGMENT'
  ) {
    return 'AMBIENT';
  }
  if (input.actorId || input.npcId) return 'HATER';
  return 'UNKNOWN';
}

function inferTextRegister(
  input: ChatSemanticDocumentInput,
  rhetoricalForm: ChatSemanticRhetoricalForm,
): ChatSemanticTextRegister {
  if (input.textRegister) return input.textRegister;
  switch (rhetoricalForm) {
    case 'PROCEDURAL_DELAY':
      return 'BUREAUCRATIC';
    case 'LEVERAGE_CLAIM':
    case 'BLUFF_DEPLOY':
    case 'THREAT_DECLARATIVE':
    case 'REPRICING_DECLARATIVE':
    case 'EXTRACTION_NOTICE':
      return 'PREDATORY';
    case 'DEAL_ROOM_LOG':
    case 'PROOF_STAMP':
    case 'MARKET_WITNESS_NOTE':
    case 'ARCHIVIST_RECORD':
      return 'LEDGER';
    case 'RESCUE_STABILIZER':
    case 'TACTICAL_REDIRECT':
    case 'SURVIVOR_TESTIMONY':
    case 'MENTOR_ANCHOR':
      return 'MENTORIAL';
    case 'CROWD_REACTION':
    case 'LOBBY_RUMOR':
    case 'WITNESS_JUDGMENT':
      return 'SPECTATOR';
    case 'SYSTEM_NOTICE':
    case 'LIVEOPS_SIGNAL':
      return 'SYSTEM';
    default:
      return 'UNKNOWN';
  }
}

function inferCadenceClass(
  input: ChatSemanticDocumentInput,
  rhetoricalForm: ChatSemanticRhetoricalForm,
): ChatSemanticCadenceClass {
  if (input.cadenceClass) return input.cadenceClass;
  switch (rhetoricalForm) {
    case 'SILENCE_MARKER':
    case 'SILENCE_WEAPON':
      return 'DELAYED';
    case 'CROWD_REACTION':
    case 'LOBBY_RUMOR':
      return 'RUMOR';
    case 'RESCUE_STABILIZER':
    case 'TACTICAL_REDIRECT':
    case 'SURVIVOR_TESTIMONY':
    case 'MENTOR_ANCHOR':
      return 'RECOVERY';
    case 'THREAT_DECLARATIVE':
    case 'BLUFF_EXPOSURE':
    case 'RIVALRY_PRESSURE':
    case 'BLUFF_DEPLOY':
      return 'CUTTING';
    case 'LIVEOPS_SIGNAL':
    case 'SYSTEM_NOTICE':
    case 'PROOF_STAMP':
      return 'SYSTEMIC';
    default:
      return 'MEASURED';
  }
}

function explainabilityTermsFromNeighbor(
  candidate: ChatSemanticIndexedDocument,
  against: ChatSemanticIndexedDocument,
  similarity01: Score01,
): readonly ChatSemanticExplainabilityTerm[] {
  return Object.freeze([
    ...against.explainabilityTerms.slice(0, 2),
    Object.freeze({
      signal: 'TOKEN_OVERLAP',
      label: 'semantic-overlap',
      score01: similarity01,
      supportingTokens: overlapTokens(candidate.tokens, against.tokens).slice(0, 6),
      notes: Object.freeze([
        candidate.semanticClusterId === against.semanticClusterId
          ? 'same-cluster'
          : 'cross-cluster',
      ]),
    }),
  ]);
}

function buildDecisionExplainability(
  candidate: ChatSemanticIndexedDocument,
  neighbors: readonly ChatSemanticNeighbor[],
  blockedReasons: readonly string[],
  noveltyScore01: Score01,
  fatigueScore01: Score01,
): readonly ChatSemanticExplainabilityTerm[] {
  const out: ChatSemanticExplainabilityTerm[] = [
    ...candidate.explainabilityTerms.slice(0, 2),
    Object.freeze({
      signal: 'CLUSTER_COLLISION',
      label: blockedReasons.length > 0 ? blockedReasons[0]! : 'novelty-clear',
      score01: blockedReasons.length > 0 ? fatigueScore01 : noveltyScore01,
      supportingTokens: neighbors[0]?.overlapTokens.slice(0, 6) ?? [],
      notes: Object.freeze(blockedReasons.length > 0 ? [...blockedReasons] : ['allowed']),
    }),
  ];
  if (neighbors[0]) {
    out.push(...neighbors[0].explainability.slice(0, 2));
  }
  return Object.freeze(out);
}

// ============================================================================
// MARK: Document factory
// ============================================================================

function createDocument(
  input: ChatSemanticDocumentInput,
  config: ChatSemanticSimilarityIndexConfig,
): ChatSemanticIndexedDocument {
  const tags = Object.freeze([...(input.tags ?? [])]);
  const motifIds = Object.freeze([...(input.motifIds ?? [])]);
  const sceneRoles = Object.freeze([...(input.sceneRoles ?? [])]);
  const callbackSourceIds = Object.freeze([...(input.callbackSourceIds ?? [])]);
  const normalizedText = normalizeText(input.text);
  const tokens = Object.freeze(tokenizeWords(normalizedText).slice(0, config.maxTokenCount));
  const bigrams = Object.freeze(tokenizeBigrams(tokens).slice(0, config.maxTokenCount));
  const charGrams = Object.freeze(
    tokenizeCharGrams(normalizedText, config.charGramSize).slice(0, config.maxTokenCount * 2),
  );

  const dense = buildDenseVector(
    normalizedText,
    tags,
    motifIds,
    sceneRoles,
    callbackSourceIds,
    input.channelId,
    input.modeScope,
    input.pressureBand,
    config,
  );

  const rhetoricalForm = dense.rhetoricalForm;
  const rhetoricalFamily = deriveRhetoricalFamily(rhetoricalForm);
  const sourceKind: ChatSemanticSourceKind =
    input.sourceKind ?? input.provenance?.sourceKind ?? 'AUTHORED_CANONICAL';
  const actorClass = inferActorClass(input, rhetoricalForm);
  const textRegister = inferTextRegister(input, rhetoricalForm);
  const cadenceClass = inferCadenceClass(input, rhetoricalForm);
  const flags: ChatSemanticDocumentFlags = createDefaultDocumentFlags(
    input.flags,
    input.channelId,
    sourceKind,
    rhetoricalForm,
  );
  const provenance: Readonly<ChatSemanticProvenance> = createDefaultProvenance(
    input.provenance ?? { sourceKind },
  );
  const explainabilityTerms = buildExplainabilityTermsForForm(rhetoricalForm);

  return Object.freeze({
    documentId: input.documentId,
    canonicalLineId: input.canonicalLineId,
    actorId: input.actorId ?? null,
    npcId: input.npcId,
    botId: input.botId ?? null,
    actorClass,
    text: input.text,
    normalizedText,
    tokens,
    bigrams,
    charGrams,
    weightedTerms: dense.weightedTerms,
    rhetoricalForm,
    rhetoricalFamily,
    rhetoricalFingerprint: dense.rhetoricalFingerprint,
    semanticClusterId: dense.semanticClusterId,
    sparseVector: dense.sparseVector,
    vectorNorm: Number(dense.norm.toFixed(6)),
    tags,
    motifIds,
    sceneRoles,
    callbackSourceIds,
    pressureBand: input.pressureBand,
    channelId: input.channelId,
    modeScope: input.modeScope,
    sourceKind,
    cadenceClass,
    textRegister,
    flags,
    provenance,
    audienceHeat01: input.audienceHeat01,
    trustScore01: input.trustScore01,
    leverageScore01: input.leverageScore01,
    proofWeight01: input.proofWeight01,
    negotiationRisk01: input.negotiationRisk01,
    lineageId: input.lineageId,
    roomScopeId: input.roomScopeId,
    channelScopeId: input.channelScopeId,
    explainabilityTerms,
    createdAt: input.createdAt,
  });
}

// ============================================================================
// MARK: Neighbor builder
// ============================================================================

function neighborFromDocuments(
  candidate: ChatSemanticIndexedDocument,
  against: ChatSemanticIndexedDocument,
): ChatSemanticNeighbor {
  const sim = clamp01(
    cosineSimilarity(
      candidate.sparseVector,
      candidate.vectorNorm,
      against.sparseVector,
      against.vectorNorm,
    ),
  );
  const notes: string[] = [];
  if (candidate.semanticClusterId === against.semanticClusterId)
    notes.push('same_cluster');
  else notes.push('different_cluster');
  if (candidate.rhetoricalFingerprint === against.rhetoricalFingerprint)
    notes.push('same_rhetorical_shape');
  else notes.push('different_rhetorical_shape');
  if (candidate.actorId !== null && candidate.actorId === against.actorId)
    notes.push('same_actor');
  if (candidate.botId !== null && candidate.botId === against.botId)
    notes.push('same_bot');
  if (candidate.pressureBand !== undefined && candidate.pressureBand === against.pressureBand)
    notes.push('same_pressure_band');

  return Object.freeze({
    documentId: against.documentId,
    canonicalLineId: against.canonicalLineId,
    similarity01: sim,
    semanticClusterId: against.semanticClusterId,
    rhetoricalForm: against.rhetoricalForm,
    rhetoricalFamily: against.rhetoricalFamily,
    overlapTokens: overlapTokens(candidate.tokens, against.tokens),
    tags: against.tags,
    notes: Object.freeze(notes),
    explainability: explainabilityTermsFromNeighbor(candidate, against, sim),
  });
}

// ============================================================================
// MARK: Decay curve computation
// ============================================================================

/**
 * computeDecayFactor
 *
 * Computes how much to attenuate a similarity score based on the age of the
 * document in ticks. Recent documents penalize more. Pressure amplifies decay.
 *
 * Factor = max(floor, ceil * exp(-ln(2) * ageTicks / halfLifeTicks * accelerator))
 */
function computeDecayFactor(
  ageTicks: number,
  pressureBand: ChatSemanticPressureBand | undefined,
  curve: ChatSemanticDecayCurve,
): number {
  if (ageTicks <= 0) return curve.ceilDecayFactor01;
  const accelerator =
    pressureBand !== undefined
      ? (curve.pressureBandAccelerator[pressureBand] ?? 1.0)
      : 1.0;
  const exponent = (-Math.LN2 * ageTicks * accelerator) / curve.halfLifeTicks;
  const raw = curve.ceilDecayFactor01 * Math.exp(exponent);
  return Math.max(curve.floorDecayFactor01, Math.min(curve.ceilDecayFactor01, raw));
}

// ============================================================================
// MARK: Exact-text bloom approximation (fast-path dedup)
// ============================================================================

/**
 * ExactTextSet
 *
 * Approximate deduplication using a Set of normalized-text hashes.
 * False positive rate: effectively zero for PZO corpus sizes.
 * O(1) lookup, O(1) insert, O(1) evict via LRU ring.
 */
class ExactTextSet {
  private readonly ring: string[];
  private readonly set: Set<string>;
  private head: number = 0;
  private readonly maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
    this.ring = new Array<string>(maxSize).fill('');
    this.set = new Set<string>();
  }

  public add(normalizedText: string): void {
    const key = stableHash(normalizedText).toString(36);
    if (this.set.has(key)) return;
    const evicted = this.ring[this.head % this.maxSize];
    if (evicted) this.set.delete(evicted);
    this.ring[this.head % this.maxSize] = key;
    this.head = (this.head + 1) % this.maxSize;
    this.set.add(key);
  }

  public has(normalizedText: string): boolean {
    return this.set.has(stableHash(normalizedText).toString(36));
  }

  public clear(): void {
    this.set.clear();
    this.ring.fill('');
    this.head = 0;
  }

  public get size(): number {
    return this.set.size;
  }
}

// ============================================================================
// MARK: Per-actor federated index slot
// ============================================================================

/**
 * ActorFederatedSlot
 *
 * An isolated document + cluster space for a single NPC actor. Prevents the
 * LIQUIDATOR's dense pressure vocabulary from suppressing MENTOR's warm rescue
 * vocabulary because they share tokens like "you," "the," or "I."
 *
 * Each slot maintains its own recent window so novelty is actor-local.
 */
class ActorFederatedSlot {
  public readonly actorId: string;
  private readonly documents = new Map<string, ChatSemanticIndexedDocument>();
  private readonly clusterMembership = new Map<string, Set<string>>();
  private readonly recentWindow: ChatSemanticIndexedDocument[] = [];
  private readonly exactTextSet: ExactTextSet;
  private readonly recentWindowMaxSize: number;

  constructor(actorId: string, recentWindowMaxSize: number) {
    this.actorId = actorId;
    this.recentWindowMaxSize = recentWindowMaxSize;
    this.exactTextSet = new ExactTextSet(recentWindowMaxSize);
  }

  public upsert(document: ChatSemanticIndexedDocument): void {
    const prior = this.documents.get(document.documentId);
    if (prior) {
      const priorMembers = this.clusterMembership.get(prior.semanticClusterId);
      priorMembers?.delete(prior.documentId);
      if (priorMembers?.size === 0)
        this.clusterMembership.delete(prior.semanticClusterId);
    }
    this.documents.set(document.documentId, document);
    if (!this.clusterMembership.has(document.semanticClusterId))
      this.clusterMembership.set(document.semanticClusterId, new Set());
    this.clusterMembership.get(document.semanticClusterId)!.add(document.documentId);
    this.exactTextSet.add(document.normalizedText);
  }

  public addToRecentWindow(document: ChatSemanticIndexedDocument): void {
    this.recentWindow.unshift(document);
    if (this.recentWindow.length > this.recentWindowMaxSize) {
      this.recentWindow.pop();
    }
  }

  public getRecentWindow(): readonly ChatSemanticIndexedDocument[] {
    return this.recentWindow;
  }

  public hasExactText(normalizedText: string): boolean {
    return this.exactTextSet.has(normalizedText);
  }

  public getDocument(
    documentId: string,
  ): ChatSemanticIndexedDocument | undefined {
    return this.documents.get(documentId);
  }

  public listDocuments(): readonly ChatSemanticIndexedDocument[] {
    return [...this.documents.values()].sort(
      (a, b) => a.createdAt - b.createdAt || a.documentId.localeCompare(b.documentId),
    );
  }

  public getSlotDescriptor(): ChatSemanticActorIndexSlot {
    return {
      actorId: this.actorId,
      npcId: undefined,
      npcClass: 'UNKNOWN',
      documentCount: this.documents.size,
      clusterCount: this.clusterMembership.size,
      lastIndexedAt: [...this.documents.values()].reduce(
        (max, doc) => Math.max(max, doc.createdAt),
        0,
      ),
    };
  }

  public reset(): void {
    this.documents.clear();
    this.clusterMembership.clear();
    this.recentWindow.length = 0;
    this.exactTextSet.clear();
  }
}

// ============================================================================
// MARK: Channel index slot (per-channel novelty window)
// ============================================================================

class ChannelFederatedSlot {
  public readonly channelId: ChatChannelId | string;
  private readonly recentWindow: ChatSemanticIndexedDocument[] = [];
  private readonly recentWindowMaxSize: number;

  constructor(channelId: ChatChannelId | string, recentWindowMaxSize: number) {
    this.channelId = channelId;
    this.recentWindowMaxSize = recentWindowMaxSize;
  }

  public addToRecentWindow(document: ChatSemanticIndexedDocument): void {
    this.recentWindow.unshift(document);
    if (this.recentWindow.length > this.recentWindowMaxSize) {
      this.recentWindow.pop();
    }
  }

  public getRecentWindow(): readonly ChatSemanticIndexedDocument[] {
    return this.recentWindow;
  }

  public reset(): void {
    this.recentWindow.length = 0;
  }
}

// ============================================================================
// MARK: ChatSemanticSimilarityIndex — primary class
// ============================================================================

/**
 * ChatSemanticSimilarityIndex
 *
 * The backend-authoritative semantic index for the PZO chat system.
 *
 * Architecture:
 *   - Primary document store: Map<documentId, IndexedDocument>
 *   - Cluster membership: Map<clusterId, Set<documentId>>
 *   - Global recent window: rolling ring of last N documents
 *   - Actor federated slots: per-NPC isolated indexes
 *   - Channel federated slots: per-channel recent windows
 *   - Exact-text bloom: O(1) exact duplicate detection
 *   - Training buffer: lazy-flushed ML training rows
 *   - Telemetry buffer: lazy-flushed observability records
 *
 * Thread safety: Single-threaded (Node.js event loop). No locking needed.
 * Persistence: Snapshot/hydrate for PostgreSQL-backed session reload.
 */
export class ChatSemanticSimilarityIndex {
  // ── MARK: Primary store
  private readonly documents = new Map<string, ChatSemanticIndexedDocument>();
  private readonly clusterMembership = new Map<string, Set<string>>();

  // ── MARK: Global recent window (all actors / all channels)
  private readonly globalRecentWindow: ChatSemanticIndexedDocument[] = [];

  // ── MARK: Per-actor federated slots
  private readonly actorSlots = new Map<string, ActorFederatedSlot>();

  // ── MARK: Per-channel federated slots
  private readonly channelSlots = new Map<string, ChannelFederatedSlot>();

  // ── MARK: Exact-text deduplication (fast path)
  private readonly exactTextSet: ExactTextSet;

  // ── MARK: Configuration
  private readonly config: ChatSemanticSimilarityIndexConfig;

  // ── MARK: Decay curve
  private readonly decayCurve: ChatSemanticDecayCurve;

  // ── MARK: Telemetry / training buffers
  private readonly trainingBuffer: ChatSemanticTrainingRow[] = [];
  private readonly telemetryBuffer: ChatSemanticTelemetryRecord[] = [];

  // ── MARK: Audience heat (0.0–1.0, optional runtime integration)
  private audienceHeat01: number = 0;

  // ── MARK: Current tick for decay computation
  private currentTick: number = 0;

  // ── MARK: Index statistics
  private batchIndexCount: number = 0;
  private noveltyBlockCount: number = 0;
  private noveltyAllowCount: number = 0;

  public constructor(
    config: Partial<ChatSemanticSimilarityIndexConfig> = {},
    decayCurve: Partial<ChatSemanticDecayCurve> = {},
  ) {
    this.config = Object.freeze({
      ...DEFAULT_CHAT_SEMANTIC_SIMILARITY_INDEX_CONFIG,
      ...config,
    });
    this.decayCurve = Object.freeze({
      ...DEFAULT_CHAT_SEMANTIC_DECAY_CURVE,
      ...decayCurve,
    });
    this.exactTextSet = new ExactTextSet(this.config.recentWindowMaxSize * 2);
  }

  // ============================================================================
  // MARK: Configuration + read-only accessors
  // ============================================================================

  public getConfig(): Readonly<ChatSemanticSimilarityIndexConfig> {
    return this.config;
  }

  public getIndexVersion(): string {
    return CHAT_SEMANTIC_SIMILARITY_INDEX_VERSION;
  }

  public getDocumentCount(): number {
    return this.documents.size;
  }

  public getClusterCount(): number {
    return this.clusterMembership.size;
  }

  public getActorSlotCount(): number {
    return this.actorSlots.size;
  }

  public getChannelSlotCount(): number {
    return this.channelSlots.size;
  }

  public getStatistics(): Readonly<{
    documentCount: number;
    clusterCount: number;
    actorSlotCount: number;
    channelSlotCount: number;
    globalRecentWindowSize: number;
    batchIndexCount: number;
    noveltyBlockCount: number;
    noveltyAllowCount: number;
    trainingBufferSize: number;
    telemetryBufferSize: number;
    audienceHeat01: number;
    currentTick: number;
  }> {
    return Object.freeze({
      documentCount: this.documents.size,
      clusterCount: this.clusterMembership.size,
      actorSlotCount: this.actorSlots.size,
      channelSlotCount: this.channelSlots.size,
      globalRecentWindowSize: this.globalRecentWindow.length,
      batchIndexCount: this.batchIndexCount,
      noveltyBlockCount: this.noveltyBlockCount,
      noveltyAllowCount: this.noveltyAllowCount,
      trainingBufferSize: this.trainingBuffer.length,
      telemetryBufferSize: this.telemetryBuffer.length,
      audienceHeat01: this.audienceHeat01,
      currentTick: this.currentTick,
    });
  }

  // ============================================================================
  // MARK: Runtime state updates
  // ============================================================================

  /**
   * setAudienceHeat
   *
   * Updates the ambient audience heat score. When heat is high, the index
   * relaxes novelty thresholds slightly so crowd reactions can echo and
   * amplify naturally without triggering fatigue penalties.
   *
   * Called by ChatEngine when ChatAudienceHeat.heatScore updates.
   */
  public setAudienceHeat(heat01: number): void {
    this.audienceHeat01 = clamp01(heat01);
  }

  /**
   * advanceTick
   *
   * Advances the internal tick counter. Used for decay computation.
   * Called by the backend engine each game tick when the room is active.
   */
  public advanceTick(tick: number): void {
    this.currentTick = tick;
  }

  // ============================================================================
  // MARK: Document indexing
  // ============================================================================

  /**
   * indexDocument
   *
   * Index a single authored line. Computes vector, rhetorical fingerprint,
   * cluster ID, and upserts into the primary store and all applicable
   * federated slots. Updates the global recent window and exact-text set.
   *
   * @returns The fully indexed document.
   */
  public indexDocument(
    input: ChatSemanticDocumentInput,
  ): ChatSemanticIndexedDocument {
    const doc = createDocument(input, this.config);
    this.upsert(doc);
    this.emitTelemetry({
      telemetryId: `tel:${stableHashPair(doc.documentId, String(doc.createdAt))}`,
      eventType: 'DOCUMENT_INDEXED',
      documentId: doc.documentId,
      clusterId: doc.semanticClusterId,
      actorId: doc.actorId ?? undefined,
      pressureBand: doc.pressureBand,
      modeScope: doc.modeScope,
      channelId: doc.channelId,
      capturedAt: Date.now(),
    });
    return doc;
  }

  /**
   * indexDocuments
   *
   * Batch-index a corpus of authored lines. This is the primary startup path
   * when loading 600+ NPC lines into the index. Telemetry emits one BATCH_INDEXED
   * record rather than N individual DOCUMENT_INDEXED records for throughput.
   */
  public indexDocuments(
    inputs: readonly ChatSemanticDocumentInput[],
  ): readonly ChatSemanticIndexedDocument[] {
    const start = Date.now();
    const results: ChatSemanticIndexedDocument[] = [];
    for (const input of inputs) {
      const doc = createDocument(input, this.config);
      this.upsert(doc);
      results.push(doc);
    }
    this.batchIndexCount += inputs.length;
    this.emitTelemetry({
      telemetryId: `tel:batch:${this.batchIndexCount}`,
      eventType: 'BATCH_INDEXED',
      durationMs: Date.now() - start,
      capturedAt: Date.now(),
    });
    return Object.freeze(results);
  }

  /**
   * upsert
   *
   * Upsert a pre-built indexed document. Handles:
   *   - Primary store + cluster membership
   *   - Per-actor federated slot (if actorFederationEnabled)
   *   - Per-channel federated slot
   *   - Global recent window (prepend, ring-evict old entries)
   *   - Exact-text set
   */
  public upsert(document: ChatSemanticIndexedDocument): void {
    // ── Remove prior version from cluster membership
    const prior = this.documents.get(document.documentId);
    if (prior) {
      const priorMembers = this.clusterMembership.get(prior.semanticClusterId);
      priorMembers?.delete(prior.documentId);
      if (priorMembers?.size === 0)
        this.clusterMembership.delete(prior.semanticClusterId);
    }

    // ── Primary store
    this.documents.set(document.documentId, document);
    if (!this.clusterMembership.has(document.semanticClusterId))
      this.clusterMembership.set(document.semanticClusterId, new Set());
    this.clusterMembership
      .get(document.semanticClusterId)!
      .add(document.documentId);

    // ── Global recent window
    this.globalRecentWindow.unshift(document);
    if (this.globalRecentWindow.length > this.config.recentWindowMaxSize) {
      this.globalRecentWindow.pop();
    }

    // ── Exact-text fast path
    this.exactTextSet.add(document.normalizedText);

    // ── Actor federated slot
    if (this.config.actorFederationEnabled && document.actorId) {
      let slot = this.actorSlots.get(document.actorId);
      if (!slot) {
        slot = new ActorFederatedSlot(
          document.actorId,
          this.config.recentWindowMaxSize,
        );
        this.actorSlots.set(document.actorId, slot);
        this.emitTelemetry({
          telemetryId: `tel:actor:${document.actorId}`,
          eventType: 'ACTOR_SLOT_CREATED',
          actorId: document.actorId,
          capturedAt: Date.now(),
        });
      }
      slot.upsert(document);
    }

    // ── Channel federated slot
    if (document.channelId) {
      let chanSlot = this.channelSlots.get(document.channelId);
      if (!chanSlot) {
        chanSlot = new ChannelFederatedSlot(
          document.channelId,
          this.config.recentWindowMaxSize,
        );
        this.channelSlots.set(document.channelId, chanSlot);
      }
      chanSlot.addToRecentWindow(document);
    }
  }

  /**
   * addToRecentWindow
   *
   * Marks a document as "recently shown." Separate from upsert so the full
   * corpus can be pre-loaded but the recent window only reflects lines that
   * actually fired in the session.
   */
  public addToRecentWindow(
    document: ChatSemanticIndexedDocument,
    scope: ChatSemanticFederationScope = 'GLOBAL',
  ): void {
    if (scope === 'GLOBAL' || scope === 'ROOM') {
      this.globalRecentWindow.unshift(document);
      if (this.globalRecentWindow.length > this.config.recentWindowMaxSize) {
        this.globalRecentWindow.pop();
      }
    }
    if (
      scope === 'ACTOR' &&
      this.config.actorFederationEnabled &&
      document.actorId
    ) {
      this.actorSlots.get(document.actorId)?.addToRecentWindow(document);
    }
    if (scope === 'CHANNEL' && document.channelId) {
      this.channelSlots.get(document.channelId)?.addToRecentWindow(document);
    }
  }

  // ============================================================================
  // MARK: Document removal
  // ============================================================================

  public removeDocument(documentId: string): boolean {
    const current = this.documents.get(documentId);
    if (!current) return false;
    this.documents.delete(documentId);
    const members = this.clusterMembership.get(current.semanticClusterId);
    members?.delete(documentId);
    if (members?.size === 0) {
      this.clusterMembership.delete(current.semanticClusterId);
      this.emitTelemetry({
        telemetryId: `tel:evict:${current.semanticClusterId}`,
        eventType: 'CLUSTER_EVICTED',
        clusterId: current.semanticClusterId,
        capturedAt: Date.now(),
      });
    }
    if (current.actorId) {
      this.actorSlots.get(current.actorId)?.reset();
    }
    return true;
  }

  // ============================================================================
  // MARK: Document retrieval
  // ============================================================================

  public getDocument(
    documentId: string,
  ): ChatSemanticIndexedDocument | undefined {
    return this.documents.get(documentId);
  }

  public listDocuments(): readonly ChatSemanticIndexedDocument[] {
    return [...this.documents.values()].sort(
      (a, b) =>
        a.createdAt - b.createdAt ||
        a.documentId.localeCompare(b.documentId),
    );
  }

  public listClusterMembers(
    clusterId: string,
  ): readonly ChatSemanticIndexedDocument[] {
    const ids = [...(this.clusterMembership.get(clusterId) ?? new Set())];
    return ids
      .map((id) => this.documents.get(id))
      .filter((v): v is ChatSemanticIndexedDocument => Boolean(v));
  }

  public listActorDocuments(
    actorId: string,
  ): readonly ChatSemanticIndexedDocument[] {
    return this.actorSlots.get(actorId)?.listDocuments() ?? [];
  }

  public getActorSlotDescriptor(
    actorId: string,
  ): ChatSemanticActorIndexSlot | undefined {
    return this.actorSlots.get(actorId)?.getSlotDescriptor();
  }

  // ============================================================================
  // MARK: Recent window access
  // ============================================================================

  public getGlobalRecentWindow(): readonly ChatSemanticIndexedDocument[] {
    return this.globalRecentWindow;
  }

  public getActorRecentWindow(
    actorId: string,
  ): readonly ChatSemanticIndexedDocument[] {
    return this.actorSlots.get(actorId)?.getRecentWindow() ?? [];
  }

  public getChannelRecentWindow(
    channelId: ChatChannelId | string,
  ): readonly ChatSemanticIndexedDocument[] {
    return this.channelSlots.get(channelId)?.getRecentWindow() ?? [];
  }

  // ============================================================================
  // MARK: Nearest-neighbor query
  // ============================================================================

  /**
   * queryNearest
   *
   * Returns the nearest neighbors in the full corpus for a query text.
   * Supports actor filtering, channel filtering, tag preference, and
   * pressure-band-aware minimum similarity thresholds.
   *
   * O(n) over the full corpus. For large corpora (>10,000 docs), callers
   * should constrain via actorFilter or maxResults. PZO NPC corpus is ~600–2000
   * lines so brute-force is fast enough.
   */
  public queryNearest(query: ChatSemanticQuery): ChatSemanticQueryResult {
    const start = Date.now();
    const queryDoc = createDocument(
      {
        documentId: `query:${query.queryId}`,
        text: query.text,
        createdAt: query.now,
        sceneRoles: query.sceneRoles,
        pressureBand: query.pressureBand,
        channelId: query.channelId,
        modeScope: query.modeScope,
        tags: query.preferredTags,
      },
      this.config,
    );

    const excluded = new Set(query.excludedDocumentIds ?? []);
    const minSim = query.minSimilarity01 ?? 0;
    const maxResults = Math.min(
      query.maxResults ?? this.config.maxNeighbors,
      this.config.maxNeighbors,
    );

    let corpus = this.listDocuments();
    if (query.actorFilter)
      corpus = corpus.filter((d) => d.actorId === query.actorFilter);
    if (query.botIdFilter)
      corpus = corpus.filter((d) => d.botId === query.botIdFilter);

    const neighbors = corpus
      .filter((d) => !excluded.has(d.documentId))
      .map((d) => neighborFromDocuments(queryDoc, d))
      .filter((n) => n.similarity01 >= minSim)
      .sort(
        (a, b) =>
          b.similarity01 - a.similarity01 ||
          a.documentId.localeCompare(b.documentId),
      )
      .slice(0, maxResults);

    this.emitTelemetry({
      telemetryId: `tel:query:${query.queryId}`,
      eventType: 'QUERY_EXECUTED',
      pressureBand: query.pressureBand,
      modeScope: query.modeScope,
      channelId: query.channelId,
      durationMs: Date.now() - start,
      capturedAt: query.now,
    });

    return {
      queryId: query.queryId,
      computedAt: query.now,
      strategy: query.strategy ?? 'NEAREST_NEIGHBOR',
      queryDocument: queryDoc,
      neighbors,
      explainability: Object.freeze([
        ...queryDoc.explainabilityTerms.slice(0, 2),
        ...(neighbors[0]?.explainability.slice(0, 2) ?? []),
      ]),
    };
  }

  // ============================================================================
  // MARK: Novelty guard — core anti-repetition decision
  // ============================================================================

  /**
   * guardNovelty
   *
   * The primary anti-repetition gate. Determines whether a candidate line
   * should be allowed given the recent message history.
   *
   * Decision factors (in order of weight):
   *   1. Exact text repeat — hard block
   *   2. Cosine similarity to recent docs — threshold varies by pressure + mode
   *   3. Cluster reuse count — prevents the same emotional frame from recurring
   *   4. Rhetorical form fatigue — prevents the same speech act shape
   *   5. Audience heat relaxation — high heat allows some repetition for realism
   *   6. Decay factor — old repetitions penalize less than recent ones
   *   7. Callback immunity — callback lines are exempt from some penalties
   *
   * All thresholds respect the pressure-band policy and mode policy from the
   * shared contract.
   */
  public guardNovelty(
    request: ChatSemanticNoveltyGuardRequest,
  ): ChatSemanticNoveltyDecision {
    const start = Date.now();

    // ── Resolve policy
    const baseConfig: ChatSemanticNoveltyGuardConfig = {
      ...DEFAULT_CHAT_SEMANTIC_NOVELTY_GUARD,
      ...(request.config ?? {}),
    };
    const pressureThresholds = resolvePressureThresholds(
      request.pressureBand ?? request.candidate.pressureBand,
    );
    const modePolicy = resolveModePolicy(
      request.modeScope ?? request.candidate.modeScope,
    );

    // ── Effective thresholds (mode policy takes precedence over pressure for
    //    maxSimilarity and recentWindowSize; pressure wins on exact window counts)
    const effectiveMaxSimilarity01 = clamp01(
      Math.min(
        modePolicy.maxSimilarityToRecent01,
        pressureThresholds.maxSimilarityToRecent01,
      ),
    );
    const effectiveMaxClusterReuses = Math.min(
      modePolicy.maxRecentClusterReuses,
      pressureThresholds.maxRecentClusterReuses,
    );
    const effectiveRhetoricalPenalty = clamp01(
      baseConfig.rhetoricalPenalty01 * modePolicy.rhetoricalPenaltyMultiplier,
    );
    const channelPolicy = resolveChannelPolicy(
      request.channelId ?? request.candidate.channelId,
    );

    // ── Build candidate document
    const candidateDoc = createDocument(request.candidate, this.config);

    // ── Resolve the correct recent-window scope
    let recentDocs: readonly ChatSemanticIndexedDocument[];
    if (
      this.config.actorFederationEnabled &&
      request.candidate.actorId &&
      this.actorSlots.has(request.candidate.actorId)
    ) {
      // Actor-scoped window — prevents cross-NPC suppression
      recentDocs = this.actorSlots
        .get(request.candidate.actorId)!
        .getRecentWindow();
    } else if (
      request.candidate.channelId &&
      this.channelSlots.has(request.candidate.channelId) &&
      modePolicy.dealRoomPressureAmplified
    ) {
      // Channel-scoped window for deal-room / Predator
      recentDocs =
        this.channelSlots.get(request.candidate.channelId)!.getRecentWindow();
    } else {
      // Global window — default
      recentDocs = request.recentDocuments.length > 0
        ? request.recentDocuments
        : this.globalRecentWindow;
    }

    // ── Exact text repeat — fast path O(1)
    const exactTextRepeat =
      this.exactTextSet.has(candidateDoc.normalizedText) ||
      recentDocs.some(
        (d) => d.normalizedText === candidateDoc.normalizedText,
      );

    // ── Compute neighbors and similarity
    const neighbors = recentDocs
      .map((d) => neighborFromDocuments(candidateDoc, d))
      .sort(
        (a, b) =>
          b.similarity01 - a.similarity01 ||
          a.documentId.localeCompare(b.documentId),
      )
      .slice(0, this.config.maxNeighbors);

    // ── Apply decay to similarity scores
    let highestSimilarity01: number = 0;
    if (this.config.decayEnabled) {
      for (const neighbor of neighbors) {
        const matchDoc = recentDocs.find(
          (d) => d.documentId === neighbor.documentId,
        );
        if (!matchDoc) continue;
        const ageTicks = Math.max(0, this.currentTick - Math.floor(matchDoc.createdAt / 1000));
        const decay = computeDecayFactor(
          ageTicks,
          request.pressureBand,
          this.decayCurve,
        );
        const decayedSim = clamp01(neighbor.similarity01 * decay);
        if (decayedSim > highestSimilarity01) highestSimilarity01 = decayedSim;
      }
    } else {
      highestSimilarity01 = neighbors[0]?.similarity01 ?? 0;
    }
    highestSimilarity01 = clamp01(highestSimilarity01);

    // ── Cluster and rhetorical reuse counts
    const repeatedClusterCount = recentDocs.filter(
      (d) => d.semanticClusterId === candidateDoc.semanticClusterId,
    ).length;
    const repeatedRhetoricalCount = recentDocs.filter(
      (d) => d.rhetoricalFingerprint === candidateDoc.rhetoricalFingerprint,
    ).length;
    const repeatedActorCount = recentDocs.filter(
      (d) => candidateDoc.actorId !== null && d.actorId === candidateDoc.actorId,
    ).length;
    const repeatedChannelCount = recentDocs.filter(
      (d) => candidateDoc.channelId !== undefined && d.channelId === candidateDoc.channelId,
    ).length;

    // ── Callback immunity: callback lines bypass cluster + rhetorical penalties
    const isCallbackLine =
      modePolicy.callbackBoostAllowed &&
      candidateDoc.callbackSourceIds.length > 0;
    const isSilenceMarker =
      modePolicy.silenceMarkerPassthrough &&
      candidateDoc.rhetoricalForm === 'SILENCE_MARKER';

    // ── Novelty score computation
    let noveltyScore01: number = 1.0;
    const blockedReasons: string[] = [];

    // Exact text repeat — terminal block
    if (exactTextRepeat) {
      noveltyScore01 -= baseConfig.exactTextPenalty01;
      blockedReasons.push('exact_text_repeat');
    }

    // Semantic similarity — main gate
    if (highestSimilarity01 > effectiveMaxSimilarity01) {
      const overrun = clamp01(highestSimilarity01 - effectiveMaxSimilarity01);
      noveltyScore01 -= Math.max(baseConfig.clusterPenalty01, overrun);
      blockedReasons.push('semantic_similarity_too_high');
    }

    // Cluster reuse — only if not a callback or silence marker
    if (!isCallbackLine && !isSilenceMarker) {
      if (repeatedClusterCount > effectiveMaxClusterReuses) {
        noveltyScore01 -= baseConfig.clusterPenalty01;
        blockedReasons.push('cluster_reused_too_often');
      }

      // Rhetorical form fatigue
      if (repeatedRhetoricalCount > 0) {
        noveltyScore01 -= effectiveRhetoricalPenalty * Math.min(repeatedRhetoricalCount, 3);
        if (repeatedRhetoricalCount > 1)
          blockedReasons.push('rhetorical_shape_fatigue');
      }
    }

    // ── Audience heat relaxation
    // High audience heat (e.g., comeback moment) lets crowd reactions echo
    // naturally. Relaxes novelty by up to 0.12 at max heat.
    if (
      this.config.audienceHeatIntegrationEnabled &&
      this.audienceHeat01 > 0.6
    ) {
      const heatBoost = clamp01((this.audienceHeat01 - 0.6) * 0.3);
      noveltyScore01 = clamp01(noveltyScore01 + heatBoost);
    }

    // ── Fatigue score (composite measure of repetition pressure)
    const fatigueScore01 = clamp01(
      repeatedClusterCount * 0.18 +
        repeatedRhetoricalCount * 0.16 +
        repeatedActorCount * Number(baseConfig.actorMonotonyPenalty01) +
        repeatedChannelCount * Number(baseConfig.channelMonotonyPenalty01) +
        highestSimilarity01 * 0.52 +
        (exactTextRepeat ? 0.28 : 0),
    );

    const windowStats: ChatSemanticNoveltyWindowStats = Object.freeze({
      recentDocumentCount: recentDocs.length,
      exactRepeatHits: exactTextRepeat ? 1 : 0,
      clusterRepeatHits: repeatedClusterCount,
      rhetoricalRepeatHits: repeatedRhetoricalCount,
      actorRepeatHits: repeatedActorCount,
      channelRepeatHits: repeatedChannelCount,
      silenceRepeatHits: recentDocs.filter((d) => d.flags.isSilenceMove).length,
      witnessRepeatHits: recentDocs.filter((d) => d.flags.isWitnessLine).length,
      negotiationRepeatHits: recentDocs.filter((d) => d.flags.isNegotiationCritical).length,
    });

    // ── Final decision
    const allowed =
      !exactTextRepeat &&
      highestSimilarity01 <= effectiveMaxSimilarity01 &&
      (isCallbackLine || isSilenceMarker || repeatedClusterCount <= effectiveMaxClusterReuses) &&
      fatigueScore01 <= pressureThresholds.fatigueScoreCap01;

    // ── Update counters
    if (allowed) this.noveltyAllowCount++;
    else this.noveltyBlockCount++;

    // ── Emit telemetry
    const eventType = allowed ? 'NOVELTY_GUARD_ALLOWED' : 'NOVELTY_GUARD_BLOCKED';
    this.emitTelemetry({
      telemetryId: `tel:novelty:${request.requestId}`,
      eventType,
      documentId: candidateDoc.documentId,
      clusterId: candidateDoc.semanticClusterId,
      actorId: candidateDoc.actorId ?? undefined,
      noveltyScore01: clamp01(noveltyScore01),
      fatigueScore01,
      pressureBand: request.pressureBand,
      modeScope: request.modeScope,
      channelId: request.channelId,
      durationMs: Date.now() - start,
      capturedAt: request.now,
    });

    // ── Emit training row (only if blocked — labeling signal)
    if (!allowed && neighbors.length > 0) {
      this.emitTrainingRow({
        rowId: `train:${request.requestId}`,
        candidateDocumentId: candidateDoc.documentId,
        nearestNeighborId: neighbors[0]!.documentId,
        similarity01: clamp01(highestSimilarity01),
        noveltyScore01: clamp01(noveltyScore01),
        fatigueScore01,
        allowed,
        blockedReasons: Object.freeze(blockedReasons),
        pressureBand: request.pressureBand,
        modeScope: request.modeScope,
        channelId: request.channelId,
        tickNumber: this.currentTick || undefined,
        actorClass: candidateDoc.actorClass,
        rhetoricalForm: candidateDoc.rhetoricalForm,
        capturedAt: request.now,
      });
    }

    return {
      requestId: request.requestId,
      computedAt: request.now,
      candidateDocument: candidateDoc,
      allowed,
      noveltyScore01: clamp01(noveltyScore01),
      fatigueScore01,
      highestSimilarity01: clamp01(highestSimilarity01),
      repeatedClusterCount,
      repeatedRhetoricalCount,
      repeatedActorCount,
      repeatedChannelCount,
      nearestNeighbors: neighbors,
      blockedReasons: Object.freeze(blockedReasons),
      explainability: buildDecisionExplainability(
        candidateDoc,
        neighbors,
        blockedReasons,
        clamp01(noveltyScore01),
        fatigueScore01,
      ),
      windowStats,
      appliedPressureThreshold: pressureThresholds,
      appliedModePolicy: modePolicy,
      appliedChannelPolicy: channelPolicy,
    };
  }

  // ============================================================================
  // MARK: Probe-only mode (no state mutation)
  // ============================================================================

  /**
   * planProbeOnly
   *
   * Runs the full novelty guard decision without mutating cooldowns, recent
   * windows, training buffers, or telemetry buffers. Safe for lookahead
   * planning by the scene planner or NPC selection layer.
   */
  public planProbeOnly(
    request: ChatSemanticNoveltyGuardRequest,
  ): ChatSemanticNoveltyDecision {
    // Temporarily suppress buffer emission by storing then restoring lengths
    const trainingLen = this.trainingBuffer.length;
    const telemetryLen = this.telemetryBuffer.length;
    const allowCount = this.noveltyAllowCount;
    const blockCount = this.noveltyBlockCount;

    const result = this.guardNovelty(request);

    // Restore buffers — rollback any emissions from probe
    this.trainingBuffer.length = trainingLen;
    this.telemetryBuffer.length = telemetryLen;
    this.noveltyAllowCount = allowCount;
    this.noveltyBlockCount = blockCount;

    return result;
  }

  // ============================================================================
  // MARK: Batch novelty evaluation (NPC line selection)
  // ============================================================================

  /**
   * rankCandidatesByNovelty
   *
   * Given a set of candidate documents, ranks them by novelty score descending.
   * Returns only documents that pass the novelty gate. Used by
   * HaterResponseOrchestrator and HelperResponseOrchestrator to select the
   * freshest eligible line from a dialogue tree.
   *
   * Uses planProbeOnly so ranking does not pollute the actual recent window.
   */
  public rankCandidatesByNovelty(
    candidates: readonly ChatSemanticDocumentInput[],
    context: {
      pressureBand?: ChatSemanticPressureBand;
      modeScope?: SemanticModeScope;
      channelId?: ChatChannelId;
      now: number;
    },
  ): readonly {
    document: ChatSemanticIndexedDocument;
    noveltyScore01: number;
    fatigueScore01: number;
  }[] {
    const results: {
      document: ChatSemanticIndexedDocument;
      noveltyScore01: number;
      fatigueScore01: number;
    }[] = [];

    for (const candidate of candidates) {
      const decision = this.planProbeOnly({
        requestId: `rank:${candidate.documentId}`,
        candidate,
        recentDocuments: [],
        pressureBand: context.pressureBand,
        modeScope: asDocumentModeScope(context.modeScope),
        channelId: context.channelId,
        now: context.now,
      });
      if (decision.allowed) {
        results.push({
          document: decision.candidateDocument,
          noveltyScore01: decision.noveltyScore01,
          fatigueScore01: decision.fatigueScore01,
        });
      }
    }

    return results
      .sort((a, b) => b.noveltyScore01 - a.noveltyScore01)
      .map((r) => Object.freeze(r));
  }

  // ============================================================================
  // MARK: Audience heat + pressure combined threshold query
  // ============================================================================

  /**
   * queryFreshestLineForActor
   *
   * Returns the freshest (highest novelty) document for a given NPC actor
   * that passes the current pressure + mode novelty gate. This is the primary
   * entry point for the HaterResponseOrchestrator and HelperResponseOrchestrator
   * when selecting a line to fire.
   */
  public queryFreshestLineForActor(
    actorId: string,
    context: {
      pressureBand?: ChatSemanticPressureBand;
      modeScope?: SemanticModeScope;
      channelId?: ChatChannelId;
      sceneRoles?: readonly string[];
      now: number;
    },
  ): {
    document: ChatSemanticIndexedDocument;
    noveltyScore01: number;
  } | null {
    const actorDocs = this.listActorDocuments(actorId);
    if (actorDocs.length === 0) return null;

    const filtered =
      context.sceneRoles && context.sceneRoles.length > 0
        ? actorDocs.filter(
            (d) =>
              d.sceneRoles.length === 0 ||
              d.sceneRoles.some((r) => context.sceneRoles!.includes(r)),
          )
        : actorDocs;

    if (filtered.length === 0) return null;

    const ranked = this.rankCandidatesByNovelty(
      filtered.map((d) => ({
        documentId: d.documentId,
        text: d.text,
        actorId: d.actorId ?? undefined,
        botId: d.botId ?? undefined,
        tags: d.tags,
        motifIds: d.motifIds,
        sceneRoles: d.sceneRoles,
        callbackSourceIds: d.callbackSourceIds,
        pressureBand: context.pressureBand,
        channelId: context.channelId,
        modeScope: asDocumentModeScope(context.modeScope),
        createdAt: d.createdAt,
      })),
      context,
    );

    if (ranked.length === 0) return null;
    const top = ranked[0]!;
    return { document: top.document, noveltyScore01: top.noveltyScore01 };
  }

  // ============================================================================
  // MARK: Ghost-aware divergence query (Phantom mode)
  // ============================================================================

  /**
   * queryGhostDivergenceLines
   *
   * For CHASE_A_LEGEND mode: returns lines that are maximally different from
   * what the ghost Legend produced in the same context. This surfaces dialogue
   * that feels historically haunted rather than predictable.
   *
   * Ghost documents should be indexed with `modeScope: 'CHASE_A_LEGEND'` and
   * tagged with `ghost_reference` to activate this path.
   */
  public queryGhostDivergenceLines(
    ghostReferenceLine: ChatSemanticDocumentInput,
    context: {
      actorId?: string;
      channelId?: ChatChannelId;
      now: number;
    },
  ): readonly ChatSemanticIndexedDocument[] {
    const ghostDoc = createDocument(ghostReferenceLine, this.config);
    const candidates = context.actorId
      ? this.listActorDocuments(context.actorId)
      : this.listDocuments().filter(
          (d) => modeScopeEquals(d.modeScope, 'CHASE_A_LEGEND'),
        );

    return candidates
      .map((d) => ({
        document: d,
        sim: cosineSimilarity(
          ghostDoc.sparseVector,
          ghostDoc.vectorNorm,
          d.sparseVector,
          d.vectorNorm,
        ),
      }))
      .sort((a, b) => a.sim - b.sim) // ascending — most divergent first
      .slice(0, this.config.maxNeighbors)
      .map((r) => r.document);
  }

  // ============================================================================
  // MARK: Syndicate trust-weighted diversity query (Syndicate mode)
  // ============================================================================

  /**
   * queryTrustWeightedDiversity
   *
   * For TEAM_UP mode: returns lines from helper NPCs weighted toward actors
   * that haven't spoken recently, promoting trust-building through diverse
   * voice representation. Higher trustScore01 → higher selection probability.
   */
  public queryTrustWeightedDiversity(
    actorTrustScores: Readonly<Record<string, number>>,
    context: {
      channelId?: ChatChannelId;
      pressureBand?: ChatSemanticPressureBand;
      now: number;
    },
  ): readonly {
    actorId: string;
    trustScore01: number;
    freshestDocument: ChatSemanticIndexedDocument | null;
  }[] {
    return Object.entries(actorTrustScores)
      .map(([actorId, trust]) => {
        const freshest = this.queryFreshestLineForActor(actorId, {
          pressureBand: context.pressureBand,
          modeScope: asDocumentModeScope('TEAM_UP'),
          channelId: context.channelId,
          now: context.now,
        });
        return {
          actorId,
          trustScore01: clamp01(trust),
          freshestDocument: freshest?.document ?? null,
        };
      })
      .sort((a, b) => b.trustScore01 - a.trustScore01);
  }

  // ============================================================================
  // MARK: Motif continuity check
  // ============================================================================

  /**
   * findCallbackOpportunities
   *
   * Scans recent windows for moments that should be called back in the current
   * scene. Returns candidate lines whose callbackSourceIds reference a recently
   * indexed document — enabling the NPC to "remember" a previous boast or
   * hesitation.
   */
  public findCallbackOpportunities(
    recentSourceIds: readonly string[],
    actorId?: string,
  ): readonly ChatSemanticIndexedDocument[] {
    const sourceSet = new Set(recentSourceIds);
    const corpus = actorId
      ? this.listActorDocuments(actorId)
      : this.listDocuments();
    return corpus.filter((d) =>
      d.callbackSourceIds.some((id) => sourceSet.has(id)),
    );
  }

  // ============================================================================
  // MARK: Snapshot / hydration
  // ============================================================================

  /**
   * createSnapshot
   *
   * Serializes the full index state to a PostgreSQL-safe JSON snapshot.
   * Called by ChatSceneArchiveService when persisting run-end state.
   */
  public createSnapshot(now: number = Date.now()): ChatSemanticIndexSnapshot {
    this.emitTelemetry({
      telemetryId: `tel:snapshot:${now}`,
      eventType: 'SNAPSHOT_CREATED',
      capturedAt: now,
    });

    const actorSlots: Record<string, ChatSemanticActorIndexSlot> = {};
    for (const [actorId, slot] of this.actorSlots.entries()) {
      actorSlots[actorId] = slot.getSlotDescriptor();
    }

    return {
      createdAt: now,
      updatedAt: now,
      dimensions: this.config.dimensions,
      documents: this.listDocuments(),
      clusterMembership: Object.freeze(
        Object.fromEntries(
          [...this.clusterMembership.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([clusterId, ids]) => [
              clusterId,
              Object.freeze([...ids].sort()),
            ]),
        ),
      ),
      actorSlots: Object.freeze(actorSlots),
      snapshotVersion: this.config.snapshotVersion,
    };
  }

  /**
   * hydrate
   *
   * Restores index state from a persisted snapshot. Handles version migration
   * by rebuilding vector representations if the snapshot version mismatches.
   * Called by ChatEngine on session resumption.
   */
  public hydrate(snapshot: ChatSemanticIndexSnapshot): void {
    const start = Date.now();
    this.documents.clear();
    this.clusterMembership.clear();
    this.globalRecentWindow.length = 0;
    this.exactTextSet.clear();
    for (const [, slot] of this.actorSlots.entries()) slot.reset();
    this.actorSlots.clear();
    this.channelSlots.clear();

    const needsRebuild =
      snapshot.snapshotVersion !== this.config.snapshotVersion;

    for (const document of snapshot.documents) {
      if (needsRebuild) {
        // Rebuild vector representation from text (version mismatch)
        const rebuilt = createDocument(
          {
            documentId: document.documentId,
            canonicalLineId: document.canonicalLineId,
            text: document.text,
            actorId: document.actorId ?? undefined,
            npcId: document.npcId,
            botId: document.botId ?? undefined,
            tags: document.tags,
            motifIds: document.motifIds,
            sceneRoles: document.sceneRoles,
            callbackSourceIds: document.callbackSourceIds,
            pressureBand: document.pressureBand,
            channelId: document.channelId,
            modeScope: document.modeScope,
            actorClass: document.actorClass,
            sourceKind: document.sourceKind,
            cadenceClass: document.cadenceClass,
            textRegister: document.textRegister,
            audienceHeat01: document.audienceHeat01,
            trustScore01: document.trustScore01,
            leverageScore01: document.leverageScore01,
            proofWeight01: document.proofWeight01,
            negotiationRisk01: document.negotiationRisk01,
            flags: document.flags,
            provenance: document.provenance,
            lineageId: document.lineageId,
            roomScopeId: document.roomScopeId,
            channelScopeId: document.channelScopeId,
            createdAt: document.createdAt,
          },
          this.config,
        );
        this.upsert(rebuilt);
      } else {
        this.upsert(document);
      }
    }

    this.emitTelemetry({
      telemetryId: `tel:hydrate:${start}`,
      eventType: 'HYDRATION_COMPLETED',
      durationMs: Date.now() - start,
      capturedAt: Date.now(),
    });
  }

  // ============================================================================
  // MARK: Cold-start seeding
  // ============================================================================

  /**
   * seedFromNpcCorpus
   *
   * Seeds the index with the full NPC dialogue corpus at room creation.
   * Accepts a flat list of inputs and bulk-indexes them. Returns the count
   * of documents successfully indexed.
   *
   * This is called at startup — the 600+ authored lines per room are indexed
   * in a single batch, typically completing in < 30ms on modern hardware.
   */
  public seedFromNpcCorpus(
    inputs: readonly ChatSemanticDocumentInput[],
  ): number {
    const docs = this.indexDocuments(inputs);
    return docs.length;
  }

  // ============================================================================
  // MARK: Training data export
  // ============================================================================

  /**
   * flushTrainingBuffer
   *
   * Returns and clears the accumulated training rows. Called by
   * DatasetBuilder when writing to the training data store.
   */
  public flushTrainingBuffer(): readonly ChatSemanticTrainingRow[] {
    const rows = [...this.trainingBuffer];
    this.trainingBuffer.length = 0;
    return Object.freeze(rows);
  }

  /**
   * flushTelemetryBuffer
   *
   * Returns and clears accumulated telemetry records. Called by
   * ChatTelemetrySink.
   */
  public flushTelemetryBuffer(): readonly ChatSemanticTelemetryRecord[] {
    const records = [...this.telemetryBuffer];
    this.telemetryBuffer.length = 0;
    return Object.freeze(records);
  }

  // ============================================================================
  // MARK: Diagnostics and health check
  // ============================================================================

  /**
   * buildDiagnosticReport
   *
   * Returns a structured diagnostic snapshot for ops monitoring.
   * Does not mutate any index state.
   */
  public buildDiagnosticReport(): Readonly<{
    version: string;
    stats: ReturnType<ChatSemanticSimilarityIndex['getStatistics']>;
    topClusters: readonly { clusterId: string; memberCount: number }[];
    topActors: readonly { actorId: string; documentCount: number }[];
    recentWindowDepth: number;
    exactTextSetSize: number;
  }> {
    const topClusters = [...this.clusterMembership.entries()]
      .map(([clusterId, members]) => ({
        clusterId,
        memberCount: members.size,
      }))
      .sort((a, b) => b.memberCount - a.memberCount)
      .slice(0, 10);

    const topActors = [...this.actorSlots.entries()]
      .map(([actorId, slot]) => ({
        actorId,
        documentCount: slot.getSlotDescriptor().documentCount,
      }))
      .sort((a, b) => b.documentCount - a.documentCount)
      .slice(0, 10);

    return Object.freeze({
      version: CHAT_SEMANTIC_SIMILARITY_INDEX_VERSION,
      stats: this.getStatistics(),
      topClusters: Object.freeze(topClusters),
      topActors: Object.freeze(topActors),
      recentWindowDepth: this.globalRecentWindow.length,
      exactTextSetSize: this.exactTextSet.size,
    });
  }

  /**
   * healthCheck
   *
   * Returns true if the index is in a consistent state. Checks that:
   *   - All cluster members exist in the document store
   *   - No actor slot references non-existent documents
   */
  public healthCheck(): {
    healthy: boolean;
    orphanedClusterRefs: number;
    missingDocuments: readonly string[];
  } {
    let orphanedClusterRefs = 0;
    const missingDocuments: string[] = [];

    for (const [clusterId, members] of this.clusterMembership.entries()) {
      for (const docId of members) {
        if (!this.documents.has(docId)) {
          orphanedClusterRefs += 1;
          missingDocuments.push(`${clusterId}:${docId}`);
        }
      }
    }

    return {
      healthy: orphanedClusterRefs === 0,
      orphanedClusterRefs,
      missingDocuments: Object.freeze(missingDocuments),
    };
  }

  // ============================================================================
  // MARK: Reset
  // ============================================================================

  /**
   * reset
   *
   * Clears all index state. Called between runs to prevent cross-run semantic
   * contamination. Preserves config and curve settings.
   */
  public reset(): void {
    this.documents.clear();
    this.clusterMembership.clear();
    this.globalRecentWindow.length = 0;
    this.exactTextSet.clear();
    for (const [, slot] of this.actorSlots.entries()) slot.reset();
    this.actorSlots.clear();
    this.channelSlots.clear();
    this.trainingBuffer.length = 0;
    this.telemetryBuffer.length = 0;
    this.audienceHeat01 = 0;
    this.currentTick = 0;
    this.batchIndexCount = 0;
    this.noveltyBlockCount = 0;
    this.noveltyAllowCount = 0;
  }

  // ============================================================================
  // MARK: Private telemetry / training emission helpers
  // ============================================================================

  private emitTelemetry(record: ChatSemanticTelemetryRecord): void {
    this.telemetryBuffer.push(Object.freeze(record));
    if (this.telemetryBuffer.length > this.config.telemetryBufferMaxSize) {
      // Evict oldest half — prevent unbounded growth in long sessions
      this.telemetryBuffer.splice(0, Math.floor(this.config.telemetryBufferMaxSize / 2));
    }
  }

  private emitTrainingRow(row: ChatSemanticTrainingRow): void {
    this.trainingBuffer.push(Object.freeze(row));
    if (this.trainingBuffer.length > this.config.trainingBufferMaxSize) {
      this.trainingBuffer.splice(0, Math.floor(this.config.trainingBufferMaxSize / 2));
    }
  }
}

// ============================================================================
// MARK: Factory function
// ============================================================================

/**
 * createChatSemanticSimilarityIndex
 *
 * Factory for the backend-authoritative semantic index. Accepts optional
 * config overrides for test harnesses and per-room customization.
 *
 * Typical usage:
 *   const index = createChatSemanticSimilarityIndex();
 *   index.seedFromNpcCorpus(allNpcLines);
 *   const decision = index.guardNovelty({ ... });
 */
export function createChatSemanticSimilarityIndex(
  config: Partial<ChatSemanticSimilarityIndexConfig> = {},
  decayCurve: Partial<ChatSemanticDecayCurve> = {},
): ChatSemanticSimilarityIndex {
  return new ChatSemanticSimilarityIndex(config, decayCurve);
}

// ============================================================================
// MARK: Standalone utility exports
// ============================================================================

/**
 * deriveSemanticClusterId
 *
 * Computes the cluster ID for a line without constructing a full index.
 * Used by telemetry systems and test harnesses.
 */
export function deriveSemanticClusterId(
  text: string,
  config: Partial<ChatSemanticSimilarityIndexConfig> = {},
): string {
  const merged = {
    ...DEFAULT_CHAT_SEMANTIC_SIMILARITY_INDEX_CONFIG,
    ...config,
  };
  const normalized = normalizeText(text);
  const tokens = tokenizeWords(normalized).slice(0, merged.maxTokenCount);
  const weightedTerms = new Map<string, number>();
  for (const token of tokens)
    weightedTerms.set(`w:${token}`, (weightedTerms.get(`w:${token}`) ?? 0) + 1.0);
  const topTerms = [...weightedTerms.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, merged.topTermsForCluster)
    .map(([term]) => term.replace(/^w:/, ''));
  const form = inferRhetoricalForm(normalized);
  return `cluster:${stableHash(`${form}|${topTerms.join('|')}`).toString(36)}`;
}

/**
 * inferLineRhetoricalForm
 *
 * Exposes the rhetorical form inference for external callers (NPC director,
 * scene planner, training pipeline).
 */
export function inferLineRhetoricalForm(text: string): ChatSemanticRhetoricalForm {
  return inferRhetoricalForm(text);
}

/**
 * buildLineRhetoricalFingerprint
 *
 * Exposes the fingerprint builder for external callers (novelty pre-check,
 * training labeler).
 */
export function buildLineRhetoricalFingerprint(text: string): string {
  return buildRhetoricalFingerprint(text);
}

/**
 * computeCosineSimilarity
 *
 * Exposes cosine similarity for external evaluation and test harnesses.
 */
export function computeCosineSimilarity(
  left: readonly ChatSemanticSparseVectorEntry[],
  leftNorm: number,
  right: readonly ChatSemanticSparseVectorEntry[],
  rightNorm: number,
): number {
  return cosineSimilarity(left, leftNorm, right, rightNorm);
}

/**
 * buildDocumentVector
 *
 * Builds a full indexed document without registering it in an index.
 * Used by evaluation harnesses and pre-flight novelty checks.
 */
export function buildDocumentVector(
  input: ChatSemanticDocumentInput,
  config: Partial<ChatSemanticSimilarityIndexConfig> = {},
): ChatSemanticIndexedDocument {
  const merged = {
    ...DEFAULT_CHAT_SEMANTIC_SIMILARITY_INDEX_CONFIG,
    ...config,
  };
  return createDocument(input, merged);
}

// ── MARK: Re-export shared contract helpers for callers that only import
//   from this file
// ─────────────────────────────────────────────────────────────────────────────
export const inferRhetoricalFormFromText = inferLineRhetoricalForm;

export {
  clamp01,
  resolvePressureThresholds,
  resolveModePolicy,
  CHAT_SEMANTIC_PRESSURE_THRESHOLDS,
  CHAT_SEMANTIC_MODE_POLICIES,
  DEFAULT_CHAT_SEMANTIC_NOVELTY_GUARD,
  DEFAULT_CHAT_SEMANTIC_DECAY_CURVE,
  CHAT_SEMANTIC_RHETORICAL_FORMS,
} from '../../../../../../shared/contracts/chat/semantic-similarity';