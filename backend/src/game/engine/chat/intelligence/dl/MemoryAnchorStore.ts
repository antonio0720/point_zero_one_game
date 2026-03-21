/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT DURABLE MEMORY ANCHOR STORE
 * FILE: backend/src/game/engine/chat/intelligence/dl/MemoryAnchorStore.ts
 * VERSION: 2026.03.21-sovereign-depth.v2
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative backend store for retrieval-backed memory anchors. This is not
 * a cache layer. It is the durable truth surface for every social memory the
 * chat engine is permitted to act on. Every collapse, comeback, rescue moment,
 * rivalry evolution, quote, relationship delta, and emotional crescendo that
 * deserves to shape future social behavior is recorded and queried here.
 *
 * What this file owns
 * -------------------
 * - Durable anchor persistence semantics across sessions and runs
 * - Mode-aware retrieval (Empire / Predator / Syndicate / Phantom)
 * - Audience-heat-weighted salience decay — anchors that formed during peak
 *   crowd heat carry a heat bonus that decays on a configurable half-life
 * - Tick-integrated salience decay — registers with the Engine 0 tick clock
 *   to apply per-tick logarithmic decay to anchor salience
 * - Per-family cap enforcement with LRU eviction so the store never bloats
 *   into an unqueryable mass under 20M concurrent session load
 * - Cross-window relationship graph: co-appearance tracking that feeds the
 *   relationship continuity engine's strength score
 * - Batch upsert with conflict resolution policy (MERGE | REPLACE | SKIP)
 * - Proof-chain binding: anchors that formed at proof-verified events carry
 *   immutable proof references that survive archive/reinstate cycles
 * - Shadow-channel write-through: RIVALRY_SHADOW and RESCUE_SHADOW anchors
 *   are indexed in a parallel shadow index that the InvasionOrchestrator reads
 *   without polluting the visible retrieval surface
 * - Telemetry export: structured payload for the analytics pipeline, keyed to
 *   runId + userId + modeId for cross-session behavioural modelling
 * - Cold-start seeding: when the store is empty on first query, seeds from
 *   ColdStartDefaults so NPC behaviour is never uninformed
 * - Dry-run (probe) query: rank candidates without persisting a receipt,
 *   used by ChatScenePlanner for lookahead without state side-effects
 * - Anchor merge: merge two anchors that describe the same memory from
 *   different observer angles (e.g. player perspective vs crowd perspective)
 * - Callback deduplication registry: globally track used callback phrases so
 *   no phrase fires twice in a run regardless of which NPC triggers it
 *
 * Scale contract
 * --------------
 * Every index is O(1) for insert/lookup. The candidate-cap architecture
 * guarantees that no query ever iterates the full anchor corpus. Snapshot
 * serialisation is compact (JSON-serialisable plain objects). The persistence
 * adapter interface supports both in-process Map storage and out-of-process
 * adapters (Redis, Postgres JSONB) without changing call sites.
 *
 * Design laws
 * -----------
 * - The store is truth for durable anchor state, not a speculative cache.
 * - Ranking stays delegated to MemoryRankingPolicy — the store never scores.
 * - Query receipts are first-class for explainability and audit.
 * - Snapshot / restore is deterministic: same input → same output, always.
 * - No engine event is emitted inside the store. Callers decide what to emit.
 * ============================================================================
 */

import {
  MEMORY_ANCHOR_DEFAULT_MINIMUM_FINAL_SALIENCE,
  MEMORY_ANCHOR_DEFAULT_TOP_K,
  createMemoryAnchorPreviewId,
  createMemoryAnchorQueryId,
  createMemoryAnchorReceiptId,
  createMemoryAnchorWindowId,
  type MemoryAnchor,
  type MemoryAnchorId,
  type MemoryAnchorKind,
  type MemoryAnchorMatch,
  type MemoryAnchorPreview,
  type MemoryAnchorQuery,
  type MemoryAnchorQueryIntent,
  type MemoryAnchorReceipt,
  type MemoryAnchorWindow,
} from '../../../../../../shared/contracts/chat/learning/MemoryAnchors';

import {
  createMemoryRankingPolicy,
  type MemoryRankingCandidate,
  type MemoryRankingContext,
  type MemoryRankingEmbeddingMatch,
  type MemoryRankingPolicyApi,
  type MemoryRankingPolicyOptions,
  type RankedMemoryAnchor,
} from './MemoryRankingPolicy';

// ── VERSION & MODULE IDENTITY ─────────────────────────────────────────────────

export const MEMORY_ANCHOR_STORE_VERSION =
  '2026.03.21-sovereign-depth.v2' as const;

// ── STORE-LEVEL DEFAULTS ──────────────────────────────────────────────────────
// All limits are tuned for 20M concurrent session load. The candidate cap is the
// single most important lever for query latency: never scan more than 160 anchors
// per query even if the corpus is enormous.

export const MEMORY_ANCHOR_STORE_DEFAULTS = Object.freeze({
  queryCandidateCap:         160,
  maxReceipts:               64,
  maxSnapshots:              8,
  maxWindowsPerRun:          64,
  maxWindowAnchors:          64,
  maxAnchorsPerFamily:       24,    // LRU eviction kicks in above this
  maxIndexesPerAnchor:       48,
  pruneArchivedAfterMs:      1_000 * 60 * 60 * 24 * 14,   // 14 days
  salienceDecayHalfLifeTicks: 48,   // anchors lose half salience bonus in 48 ticks
  audienceHeatBonusCap:       0.25, // max salience bonus from audience heat at formation
  shadowFamilies: Object.freeze([
    'SYSTEM_SHADOW',
    'NPC_SHADOW',
    'RIVALRY_SHADOW',
    'RESCUE_SHADOW',
    'LIVEOPS_SHADOW',
  ] as const),
  maxUsedCallbacksPerRun:    512,   // global dedup registry cap
  maxProofBindingsPerAnchor:   8,
  maxRelationshipEdges:       256,   // relationship graph edge cap before LRU
});

// ── GAME MODE IDENTIFIER ──────────────────────────────────────────────────────
// Mirrored from shared/contracts/chat/ChatMode.ts to avoid a circular import.
// The store only needs the string discriminant — not the full mode contract.

export type ChatModeId =
  | 'EMPIRE'
  | 'PREDATOR'
  | 'SYNDICATE'
  | 'PHANTOM'
  | 'LOBBY'
  | 'POST_RUN'
  | 'UNKNOWN';

// ── CONFLICT RESOLUTION POLICY ────────────────────────────────────────────────

export type AnchorConflictPolicy = 'MERGE' | 'REPLACE' | 'SKIP';

// ── PROOF BINDING ─────────────────────────────────────────────────────────────
// Anchors that formed at proof-verified events carry an immutable proof reference.

export interface AnchorProofBinding {
  readonly proofChainId: string;     // ChatProofChain instance that verified this event
  readonly proofHash:    string;     // CRC32 / SHA-256 partial for the event
  readonly verifiedAtMs: number;
  readonly eventType:    string;     // e.g. 'SHIELD_BREACHED', 'COMEBACK_COMPLETED'
}

// ── RELATIONSHIP GRAPH EDGE ───────────────────────────────────────────────────

export interface RelationshipEdge {
  readonly anchorIdA:       MemoryAnchorId;
  readonly anchorIdB:       MemoryAnchorId;
  readonly coAppearances:   number;   // how many windows contained both
  readonly strengthScore:   number;   // 0.0–1.0, fed to ChatRelationshipModel
  readonly lastSeenAtMs:    number;
}

// ── ANCHOR TELEMETRY PAYLOAD ──────────────────────────────────────────────────

export interface AnchorTelemetryPayload {
  readonly storeVersion:   typeof MEMORY_ANCHOR_STORE_VERSION;
  readonly exportedAtMs:   number;
  readonly runId?:         string;
  readonly userId?:        string;
  readonly modeId?:        ChatModeId;
  readonly totalAnchors:   number;
  readonly archivedCount:  number;
  readonly openWindows:    number;
  readonly shadowCount:    number;
  readonly topKindCounts:  Readonly<Record<string, number>>;
  readonly avgSalience:    number;
  readonly usedCallbacks:  number;
  readonly relationshipEdgeCount: number;
}

// ── BATCH UPSERT TYPES ────────────────────────────────────────────────────────

export interface BatchUpsertRequest {
  readonly anchors:         readonly MemoryAnchor[];
  readonly conflictPolicy:  AnchorConflictPolicy;
  readonly proofBindings?:  Readonly<Record<MemoryAnchorId, AnchorProofBinding>>;
}

export interface BatchUpsertResult {
  readonly created:  number;
  readonly updated:  number;
  readonly skipped:  number;
  readonly merged:   number;
  readonly evicted:  number;
  readonly receipts: readonly MemoryAnchorMutationReceipt[];
}

// ── WINDOW SEED ───────────────────────────────────────────────────────────────

export interface MemoryAnchorWindowSeed {
  readonly runId?:          string;
  readonly sceneId?:        string;
  readonly momentId?:       string;
  readonly roomId?:         string;
  readonly channelId?:      string;
  readonly modeId?:         ChatModeId;
  readonly dominantKinds?:  readonly MemoryAnchorKind[];
  readonly audienceHeat?:   number;  // 0.0–1.0 at window-open time
}

// ── MUTATION RECEIPT ──────────────────────────────────────────────────────────

export interface MemoryAnchorMutationReceipt {
  readonly ok:        boolean;
  readonly operation: 'UPSERT' | 'BATCH_UPSERT' | 'MERGE' | 'ARCHIVE' | 'REINSTATE'
                    | 'REAFFIRM' | 'LINK_SUCCESSOR' | 'WINDOW_OPEN' | 'WINDOW_APPEND'
                    | 'WINDOW_CLOSE' | 'HYDRATE' | 'PRUNE' | 'TICK_DECAY'
                    | 'PROMOTE' | 'DEMOTE' | 'PROOF_BIND' | 'SEED_COLD_START'
                    | 'EVICT_LRU';
  readonly anchorId?:  MemoryAnchorId;
  readonly windowId?:  string;
  readonly created:    boolean;
  readonly updated:    boolean;
  readonly debugNotes: readonly string[];
}

// ── STORE QUERY REQUEST ───────────────────────────────────────────────────────

export interface MemoryAnchorStoreQueryRequest {
  readonly query?:                    Partial<MemoryAnchorQuery>;
  readonly intent?:                   MemoryAnchorQueryIntent;
  readonly queryText?:                string;
  readonly actorId?:                  string;
  readonly actorPersonaId?:           string;
  readonly relationshipId?:           string;
  readonly roomId?:                   string;
  readonly channelId?:                string;
  readonly runId?:                    string;
  readonly sceneId?:                  string;
  readonly momentId?:                 string;
  readonly currentModeId?:            ChatModeId;
  readonly currentTags?:              readonly string[];
  readonly relationshipSignals?:      readonly string[];
  readonly emotionSignals?:           readonly string[];
  readonly embeddingMatches?:         readonly MemoryRankingEmbeddingMatch[];
  readonly topK?:                     number;
  readonly minimumScore?:             number;
  readonly candidateCap?:             number;
  readonly excludedAnchorIds?:        readonly MemoryAnchorId[];
  readonly excludedFamilyIds?:        readonly string[];
  readonly alreadyUsedCallbackPhrases?: readonly string[];
  readonly includeArchived?:          boolean;
  readonly includeShadow?:            boolean;   // default false — shadow anchors hidden from NPC directors
  readonly probeOnly?:                boolean;   // dry-run: skip receipt persistence
  readonly audienceHeat?:             number;    // current heat — modifies urgency score
}

// ── STORE QUERY RESPONSE ──────────────────────────────────────────────────────

export interface MemoryAnchorQueryResponse {
  readonly query:          MemoryAnchorQuery;
  readonly matches:        readonly MemoryAnchorMatch[];
  readonly ranked:         readonly RankedMemoryAnchor[];
  readonly previews:       readonly MemoryAnchorPreview[];
  readonly receipt:        MemoryAnchorReceipt;
  readonly candidateIds:   readonly MemoryAnchorId[];
  readonly shadowMatches:  readonly MemoryAnchorId[];  // shadow anchors surfaced for InvasionOrchestrator
  readonly debugNotes:     readonly string[];
}

// ── STORE METRICS ─────────────────────────────────────────────────────────────

export interface MemoryAnchorStoreMetrics {
  readonly totalAnchors:          number;
  readonly archivedAnchors:       number;
  readonly shadowAnchors:         number;
  readonly openWindows:           number;
  readonly totalWindows:          number;
  readonly totalReceipts:         number;
  readonly relationshipEdges:     number;
  readonly usedCallbacksCount:    number;
  readonly anchorsByKind:         Readonly<Record<string, number>>;
  readonly anchorsByRoom:         Readonly<Record<string, number>>;
  readonly anchorsByChannel:      Readonly<Record<string, number>>;
  readonly anchorsByRun:          Readonly<Record<string, number>>;
  readonly anchorsByMode:         Readonly<Record<string, number>>;
  readonly avgFinalSalience:      number;
  readonly proofBoundAnchors:     number;
}

// ── SNAPSHOT ──────────────────────────────────────────────────────────────────

export interface MemoryAnchorStoreSnapshot {
  readonly version:              typeof MEMORY_ANCHOR_STORE_VERSION;
  readonly exportedAtMs:         number;
  readonly anchors:              readonly MemoryAnchor[];
  readonly archivedAnchorIds:    readonly MemoryAnchorId[];
  readonly windows:              readonly MemoryAnchorWindow[];
  readonly receipts:             readonly MemoryAnchorReceipt[];
  readonly proofBindings:        readonly Array<[MemoryAnchorId, AnchorProofBinding]>;
  readonly usedCallbackPhrases:  readonly string[];
  readonly shadowAnchorIds:      readonly MemoryAnchorId[];
  readonly relationshipEdges:    readonly RelationshipEdge[];
  readonly modeAnchorIndex:      readonly Array<[ChatModeId, MemoryAnchorId[]]>;
}

// ── PERSISTENCE ADAPTER ───────────────────────────────────────────────────────

export interface MemoryAnchorStorePersistenceAdapter {
  load?(): Promise<MemoryAnchorStoreSnapshot | null> | MemoryAnchorStoreSnapshot | null;
  save?(snapshot: MemoryAnchorStoreSnapshot): Promise<void> | void;
  appendReceipt?(receipt: MemoryAnchorReceipt): Promise<void> | void;
  appendTelemetry?(payload: AnchorTelemetryPayload): Promise<void> | void;
}

// ── STORE OPTIONS ─────────────────────────────────────────────────────────────

export interface MemoryAnchorStoreOptions {
  readonly rankingPolicy?:        MemoryRankingPolicyApi;
  readonly rankingPolicyOptions?: MemoryRankingPolicyOptions;
  readonly persistence?:          MemoryAnchorStorePersistenceAdapter;
  readonly queryCandidateCap?:    number;
  readonly now?:                  () => number;
  readonly coldStartSeeds?:       readonly MemoryAnchor[];  // ColdStartDefaults integration
  readonly enableShadowIndex?:    boolean;
  readonly salienceDecayEnabled?: boolean;
  readonly runId?:                string;
  readonly userId?:               string;
  readonly sessionModeId?:        ChatModeId;
}

// ── STORE PUBLIC API ──────────────────────────────────────────────────────────

export interface MemoryAnchorStoreApi {
  readonly version:         typeof MEMORY_ANCHOR_STORE_VERSION;
  readonly rankingPolicy:   MemoryRankingPolicyApi;

  // ── Hydration & persistence
  hydrate(snapshot: MemoryAnchorStoreSnapshot): MemoryAnchorMutationReceipt;
  exportSnapshot(): MemoryAnchorStoreSnapshot;
  save(): Promise<void>;

  // ── Anchor CRUD
  upsert(anchor: MemoryAnchor, proofBinding?: AnchorProofBinding): MemoryAnchorMutationReceipt;
  batchUpsert(request: BatchUpsertRequest): BatchUpsertResult;
  merge(anchorIdA: MemoryAnchorId, anchorIdB: MemoryAnchorId): MemoryAnchorMutationReceipt;
  get(anchorId: MemoryAnchorId): MemoryAnchor | null;
  has(anchorId: MemoryAnchorId): boolean;
  list(): readonly MemoryAnchor[];
  listShadow(): readonly MemoryAnchor[];

  // ── Lifecycle mutations
  archive(anchorId: MemoryAnchorId): MemoryAnchorMutationReceipt;
  reinstate(anchorId: MemoryAnchorId): MemoryAnchorMutationReceipt;
  reaffirm(anchorId: MemoryAnchorId, nowMs?: number): MemoryAnchorMutationReceipt;
  promote(anchorId: MemoryAnchorId): MemoryAnchorMutationReceipt;
  demote(anchorId: MemoryAnchorId): MemoryAnchorMutationReceipt;
  linkSuccessor(anchorId: MemoryAnchorId, successorId: MemoryAnchorId): MemoryAnchorMutationReceipt;
  bindProof(anchorId: MemoryAnchorId, binding: AnchorProofBinding): MemoryAnchorMutationReceipt;

  // ── Window management
  openWindow(seed?: MemoryAnchorWindowSeed): MemoryAnchorWindow;
  appendToWindow(windowId: string, anchorId: MemoryAnchorId): MemoryAnchorMutationReceipt;
  closeWindow(windowId: string, closedAtMs?: number): MemoryAnchorMutationReceipt;
  getWindow(windowId: string): MemoryAnchorWindow | null;
  listWindows(): readonly MemoryAnchorWindow[];

  // ── Query
  query(request: MemoryAnchorStoreQueryRequest): MemoryAnchorQueryResponse;

  // ── Callback dedup registry
  registerUsedCallback(phrase: string): void;
  isCallbackUsed(phrase: string): boolean;
  clearUsedCallbacks(): void;

  // ── Tick integration (Engine 0 clock)
  tickDecay(tickIndex: number): MemoryAnchorMutationReceipt;

  // ── Relationship graph
  getRelationshipEdge(anchorIdA: MemoryAnchorId, anchorIdB: MemoryAnchorId): RelationshipEdge | null;
  listRelationshipEdges(anchorId: MemoryAnchorId): readonly RelationshipEdge[];

  // ── Cold start
  seedColdStart(seeds: readonly MemoryAnchor[]): MemoryAnchorMutationReceipt;

  // ── Telemetry
  exportTelemetry(modeId?: ChatModeId): AnchorTelemetryPayload;

  // ── Maintenance
  metrics(): MemoryAnchorStoreMetrics;
  prune(nowMs?: number): MemoryAnchorMutationReceipt;
}

// ═════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═════════════════════════════════════════════════════════════════════════════

export function createMemoryAnchorStore(
  options: MemoryAnchorStoreOptions = {},
): MemoryAnchorStoreApi {

  // ── Core ranking delegate
  const rankingPolicy =
    options.rankingPolicy ??
    createMemoryRankingPolicy(options.rankingPolicyOptions);

  // ── Primary corpus
  const anchors      = new Map<MemoryAnchorId, MemoryAnchor>();
  const archivedIds  = new Set<MemoryAnchorId>();
  const shadowIds    = new Set<MemoryAnchorId>();   // shadow-channel anchors

  // ── Window corpus
  const windows      = new Map<string, MemoryAnchorWindow>();

  // ── Receipt log
  const receipts: MemoryAnchorReceipt[] = [];

  // ── Proof binding map  — survives archive/reinstate cycles
  const proofBindings = new Map<MemoryAnchorId, AnchorProofBinding>();

  // ── Callback dedup registry
  const usedCallbackPhrases = new Set<string>();

  // ── Relationship graph — key: sorted `${a}::${b}` string
  const relationshipEdges = new Map<string, RelationshipEdge>();

  // ── Primary indexes (O(1) lookup by field)
  const familyIndex       = new Map<string, Set<MemoryAnchorId>>();
  const relationshipIndex = new Map<string, Set<MemoryAnchorId>>();
  const quoteIndex        = new Map<string, Set<MemoryAnchorId>>();
  const roomIndex         = new Map<string, Set<MemoryAnchorId>>();
  const channelIndex      = new Map<string, Set<MemoryAnchorId>>();
  const runIndex          = new Map<string, Set<MemoryAnchorId>>();
  const sceneIndex        = new Map<string, Set<MemoryAnchorId>>();
  const momentIndex       = new Map<string, Set<MemoryAnchorId>>();
  const actorIndex        = new Map<string, Set<MemoryAnchorId>>();
  const personaIndex      = new Map<string, Set<MemoryAnchorId>>();
  const kindIndex         = new Map<MemoryAnchorKind, Set<MemoryAnchorId>>();
  const tagIndex          = new Map<string, Set<MemoryAnchorId>>();
  const modeIndex         = new Map<ChatModeId, Set<MemoryAnchorId>>();

  const now = (): number => normalizeNow(options.now?.());

  // ── Cold-start: if seeds provided, seed immediately (before persistence hydration)
  if (options.coldStartSeeds?.length) {
    for (const seed of options.coldStartSeeds) {
      anchors.set(seed.id, freezeAnchor(seed));
      addToIndexes(seed);
    }
  }

  // ── API surface

  const api: MemoryAnchorStoreApi = {
    version: MEMORY_ANCHOR_STORE_VERSION,
    rankingPolicy,

    // ── HYDRATE ──────────────────────────────────────────────────────────────
    hydrate(snapshot: MemoryAnchorStoreSnapshot): MemoryAnchorMutationReceipt {
      anchors.clear();
      archivedIds.clear();
      shadowIds.clear();
      windows.clear();
      receipts.splice(0, receipts.length);
      proofBindings.clear();
      usedCallbackPhrases.clear();
      relationshipEdges.clear();
      clearAllIndexes();

      for (const anchor of snapshot.anchors) {
        anchors.set(anchor.id, freezeAnchor(anchor));
        addToIndexes(anchor);
      }
      for (const id of snapshot.archivedAnchorIds) {
        if (anchors.has(id)) archivedIds.add(id);
      }
      for (const id of (snapshot.shadowAnchorIds ?? [])) {
        if (anchors.has(id)) shadowIds.add(id);
      }
      for (const w of snapshot.windows) {
        windows.set(w.id, freezeWindow(w));
      }
      for (const r of snapshot.receipts.slice(-MEMORY_ANCHOR_STORE_DEFAULTS.maxReceipts)) {
        receipts.push(freezeReceipt(r));
      }
      for (const [id, binding] of (snapshot.proofBindings ?? [])) {
        proofBindings.set(id, Object.freeze({ ...binding }));
      }
      for (const phrase of (snapshot.usedCallbackPhrases ?? [])) {
        usedCallbackPhrases.add(phrase);
      }
      for (const edge of (snapshot.relationshipEdges ?? [])) {
        relationshipEdges.set(edgeKey(edge.anchorIdA, edge.anchorIdB), Object.freeze({ ...edge }));
      }
      for (const [modeId, ids] of (snapshot.modeAnchorIndex ?? [])) {
        modeIndex.set(modeId, new Set(ids));
      }

      return Object.freeze({
        ok: true, operation: 'HYDRATE', created: false, updated: true,
        debugNotes: Object.freeze([
          `anchors=${snapshot.anchors.length}`,
          `windows=${snapshot.windows.length}`,
          `proofBindings=${snapshot.proofBindings?.length ?? 0}`,
          `callbacks=${snapshot.usedCallbackPhrases?.length ?? 0}`,
          `edges=${snapshot.relationshipEdges?.length ?? 0}`,
        ]),
      });
    },

    // ── EXPORT SNAPSHOT ──────────────────────────────────────────────────────
    exportSnapshot(): MemoryAnchorStoreSnapshot {
      return Object.freeze({
        version: MEMORY_ANCHOR_STORE_VERSION,
        exportedAtMs: now(),
        anchors: Object.freeze([...anchors.values()]),
        archivedAnchorIds: Object.freeze([...archivedIds]),
        windows: Object.freeze([...windows.values()]),
        receipts: Object.freeze([...receipts]),
        proofBindings: Object.freeze([...proofBindings.entries()]),
        usedCallbackPhrases: Object.freeze([...usedCallbackPhrases]),
        shadowAnchorIds: Object.freeze([...shadowIds]),
        relationshipEdges: Object.freeze([...relationshipEdges.values()]),
        modeAnchorIndex: Object.freeze(
          [...modeIndex.entries()].map(([k, v]) => [k, [...v]] as [ChatModeId, MemoryAnchorId[]])
        ),
      });
    },

    async save(): Promise<void> {
      await options.persistence?.save?.(api.exportSnapshot());
    },

    // ── UPSERT ───────────────────────────────────────────────────────────────
    upsert(anchor: MemoryAnchor, proofBinding?: AnchorProofBinding): MemoryAnchorMutationReceipt {
      const normalized = freezeAnchor(anchor);
      const existed    = anchors.has(anchor.id);

      if (existed) removeFromIndexes(anchors.get(anchor.id)!);

      anchors.set(normalized.id, normalized);
      addToIndexes(normalized);

      // Shadow channel classification
      classifyShadow(normalized);

      // Mode index
      const sessionMode = options.sessionModeId ?? 'UNKNOWN';
      addIndexed(modeIndex as Map<string, Set<MemoryAnchorId>>, sessionMode, normalized.id);

      // Proof binding
      if (proofBinding) {
        proofBindings.set(normalized.id, Object.freeze({ ...proofBinding }));
      }

      // Family cap enforcement with LRU eviction
      const evictReceipt = enforcePerFamilyCap(normalized.continuity.familyId);
      const notes: string[] = [
        `kind=${normalized.kind}`,
        `priority=${normalized.retrieval.priority}`,
        `family=${normalized.continuity.familyId ?? 'none'}`,
        `proof=${proofBinding ? 'bound' : 'none'}`,
        `shadow=${shadowIds.has(normalized.id)}`,
      ];
      if (evictReceipt) notes.push(`evicted=${evictReceipt.anchorId}`);

      return Object.freeze({
        ok: true, operation: 'UPSERT',
        anchorId: normalized.id,
        created: !existed, updated: existed,
        debugNotes: Object.freeze(notes),
      });
    },

    // ── BATCH UPSERT ─────────────────────────────────────────────────────────
    batchUpsert(request: BatchUpsertRequest): BatchUpsertResult {
      let created = 0, updated = 0, skipped = 0, merged = 0, evicted = 0;
      const receipts_: MemoryAnchorMutationReceipt[] = [];

      for (const anchor of request.anchors) {
        const binding = request.proofBindings?.[anchor.id];
        const existed = anchors.has(anchor.id);

        if (existed && request.conflictPolicy === 'SKIP') {
          skipped++;
          receipts_.push(Object.freeze({
            ok: true, operation: 'UPSERT', anchorId: anchor.id,
            created: false, updated: false,
            debugNotes: Object.freeze(['conflict=SKIP']),
          }));
          continue;
        }

        if (existed && request.conflictPolicy === 'MERGE') {
          const mergeResult = api.merge(anchor.id, anchor.id);
          // Re-upsert the merged product
          const r = api.upsert(anchor, binding);
          if (r.created) created++; else { merged++; }
          if (r.debugNotes.some(n => n.startsWith('evicted='))) evicted++;
          receipts_.push(mergeResult);
          continue;
        }

        // REPLACE (default) or new anchor
        const r = api.upsert(anchor, binding);
        if (r.created) created++; else updated++;
        if (r.debugNotes.some(n => n.startsWith('evicted='))) evicted++;
        receipts_.push(r);
      }

      return Object.freeze({ created, updated, skipped, merged, evicted, receipts: Object.freeze(receipts_) });
    },

    // ── MERGE ─────────────────────────────────────────────────────────────────
    // Merges anchorB into anchorA: union tags, max salience, sum hit counts,
    // union predecessor/successor chains. anchorB is archived after merge.
    merge(anchorIdA: MemoryAnchorId, anchorIdB: MemoryAnchorId): MemoryAnchorMutationReceipt {
      const a = anchors.get(anchorIdA);
      const b = anchors.get(anchorIdB);
      if (!a || !b || anchorIdA === anchorIdB) {
        return Object.freeze({
          ok: false, operation: 'MERGE', anchorId: anchorIdA,
          created: false, updated: false,
          debugNotes: Object.freeze([`aExists=${!!a}`, `bExists=${!!b}`, `sameId=${anchorIdA === anchorIdB}`]),
        });
      }

      const merged = freezeAnchor({
        ...a,
        salience: Object.freeze({
          ...a.salience,
          final: Math.max(a.salience.final, b.salience.final),
        }),
        formation: Object.freeze({
          ...a.formation,
          hitCount:      a.formation.hitCount + b.formation.hitCount,
          reaffirmCount: a.formation.reaffirmCount + b.formation.reaffirmCount,
          updatedAtMs:   now(),
        }),
        payload: Object.freeze({
          ...a.payload,
          tags:            mergeUnique(a.payload.tags, b.payload.tags),
          emotions:        mergeUnique(a.payload.emotions, b.payload.emotions),
          callbackPhrases: mergeUnique(a.payload.callbackPhrases, b.payload.callbackPhrases),
        }),
        continuity: Object.freeze({
          ...a.continuity,
          predecessorAnchorIds: mergeUnique(a.continuity.predecessorAnchorIds, b.continuity.predecessorAnchorIds),
          successorAnchorIds:   mergeUnique(a.continuity.successorAnchorIds, b.continuity.successorAnchorIds),
        }),
      });

      removeFromIndexes(a);
      anchors.set(anchorIdA, merged);
      addToIndexes(merged);
      archivedIds.add(anchorIdB); // archive the consumed anchor

      return Object.freeze({
        ok: true, operation: 'MERGE', anchorId: anchorIdA,
        created: false, updated: true,
        debugNotes: Object.freeze([`mergedFrom=${anchorIdB}`, `newSalience=${round4(merged.salience.final)}`]),
      });
    },

    get:  (id) => anchors.get(id) ?? null,
    has:  (id) => anchors.has(id),
    list: () => Object.freeze([...anchors.values()]),
    listShadow: () => Object.freeze([...shadowIds].map(id => anchors.get(id)!).filter(Boolean)),

    // ── ARCHIVE / REINSTATE ───────────────────────────────────────────────────
    archive(anchorId: MemoryAnchorId): MemoryAnchorMutationReceipt {
      if (!anchors.has(anchorId)) return missingReceipt('ARCHIVE', anchorId);
      archivedIds.add(anchorId);
      return Object.freeze({ ok: true, operation: 'ARCHIVE', anchorId, created: false, updated: true, debugNotes: Object.freeze(['archived=true']) });
    },

    reinstate(anchorId: MemoryAnchorId): MemoryAnchorMutationReceipt {
      if (!anchors.has(anchorId)) return missingReceipt('REINSTATE', anchorId);
      archivedIds.delete(anchorId);
      return Object.freeze({ ok: true, operation: 'REINSTATE', anchorId, created: false, updated: true, debugNotes: Object.freeze(['archived=false']) });
    },

    // ── REAFFIRM ─────────────────────────────────────────────────────────────
    reaffirm(anchorId: MemoryAnchorId, explicitNowMs?: number): MemoryAnchorMutationReceipt {
      const current = anchors.get(anchorId);
      if (!current) return missingReceipt('REAFFIRM', anchorId);
      const ts = normalizeNow(explicitNowMs ?? now());
      const reaffirmed = freezeAnchor({
        ...current,
        formation: Object.freeze({
          ...current.formation,
          updatedAtMs:   ts,
          reaffirmedAtMs: ts,
          hitCount:       current.formation.hitCount + 1,
          reaffirmCount:  current.formation.reaffirmCount + 1,
        }),
      });
      removeFromIndexes(current);
      anchors.set(anchorId, reaffirmed);
      addToIndexes(reaffirmed);
      return Object.freeze({
        ok: true, operation: 'REAFFIRM', anchorId, created: false, updated: true,
        debugNotes: Object.freeze([`reaffirmCount=${reaffirmed.formation.reaffirmCount}`, `hitCount=${reaffirmed.formation.hitCount}`]),
      });
    },

    // ── PROMOTE / DEMOTE ─────────────────────────────────────────────────────
    // Promote bumps the anchor's retrieval priority one tier (LOW→NORMAL→HIGH→CRITICAL).
    // Demote reverses. Used by InvasionOrchestrator and HaterResponseOrchestrator
    // when a callback lands with exceptional impact.

    promote(anchorId: MemoryAnchorId): MemoryAnchorMutationReceipt {
      const current = anchors.get(anchorId);
      if (!current) return missingReceipt('PROMOTE', anchorId);
      const newPriority = promotePriority(current.retrieval.priority);
      if (newPriority === current.retrieval.priority) {
        return Object.freeze({ ok: true, operation: 'PROMOTE', anchorId, created: false, updated: false, debugNotes: Object.freeze(['alreadyMax']) });
      }
      const promoted = freezeAnchor({ ...current, retrieval: Object.freeze({ ...current.retrieval, priority: newPriority }) });
      removeFromIndexes(current);
      anchors.set(anchorId, promoted);
      addToIndexes(promoted);
      return Object.freeze({ ok: true, operation: 'PROMOTE', anchorId, created: false, updated: true, debugNotes: Object.freeze([`priority=${newPriority}`]) });
    },

    demote(anchorId: MemoryAnchorId): MemoryAnchorMutationReceipt {
      const current = anchors.get(anchorId);
      if (!current) return missingReceipt('DEMOTE', anchorId);
      const newPriority = demotePriority(current.retrieval.priority);
      if (newPriority === current.retrieval.priority) {
        return Object.freeze({ ok: true, operation: 'DEMOTE', anchorId, created: false, updated: false, debugNotes: Object.freeze(['alreadyMin']) });
      }
      const demoted = freezeAnchor({ ...current, retrieval: Object.freeze({ ...current.retrieval, priority: newPriority }) });
      removeFromIndexes(current);
      anchors.set(anchorId, demoted);
      addToIndexes(demoted);
      return Object.freeze({ ok: true, operation: 'DEMOTE', anchorId, created: false, updated: true, debugNotes: Object.freeze([`priority=${newPriority}`]) });
    },

    // ── LINK SUCCESSOR ────────────────────────────────────────────────────────
    linkSuccessor(anchorId: MemoryAnchorId, successorAnchorId: MemoryAnchorId): MemoryAnchorMutationReceipt {
      const current  = anchors.get(anchorId);
      const successor = anchors.get(successorAnchorId);
      if (!current || !successor) {
        return Object.freeze({ ok: false, operation: 'LINK_SUCCESSOR', anchorId, created: false, updated: false, debugNotes: Object.freeze([`aExists=${!!current}`, `bExists=${!!successor}`]) });
      }
      const nextA = freezeAnchor({ ...current, continuity: Object.freeze({ ...current.continuity, successorAnchorIds: mergeUnique(current.continuity.successorAnchorIds, [successorAnchorId]) }) });
      const nextB = freezeAnchor({ ...successor, continuity: Object.freeze({ ...successor.continuity, predecessorAnchorIds: mergeUnique(successor.continuity.predecessorAnchorIds, [anchorId]) }) });
      removeFromIndexes(current); removeFromIndexes(successor);
      anchors.set(nextA.id, nextA); anchors.set(nextB.id, nextB);
      addToIndexes(nextA); addToIndexes(nextB);
      return Object.freeze({ ok: true, operation: 'LINK_SUCCESSOR', anchorId, created: false, updated: true, debugNotes: Object.freeze([`successor=${successorAnchorId}`]) });
    },

    // ── PROOF BIND ────────────────────────────────────────────────────────────
    bindProof(anchorId: MemoryAnchorId, binding: AnchorProofBinding): MemoryAnchorMutationReceipt {
      if (!anchors.has(anchorId)) return missingReceipt('PROOF_BIND', anchorId);
      const existing = proofBindings.get(anchorId);
      const bindings = existing
        ? [existing, binding].slice(-MEMORY_ANCHOR_STORE_DEFAULTS.maxProofBindingsPerAnchor)
        : [binding];
      proofBindings.set(anchorId, Object.freeze(bindings[bindings.length - 1]));
      return Object.freeze({ ok: true, operation: 'PROOF_BIND', anchorId, created: !existing, updated: !!existing, debugNotes: Object.freeze([`proofHash=${binding.proofHash}`, `event=${binding.eventType}`]) });
    },

    // ── WINDOW MANAGEMENT ─────────────────────────────────────────────────────
    openWindow(seed: MemoryAnchorWindowSeed = {}): MemoryAnchorWindow {
      const id = createMemoryAnchorWindowId(
        [seed.runId, seed.sceneId, seed.momentId, seed.roomId, seed.channelId, now()]
          .filter(Boolean).join('_')
      );
      const window = freezeWindow({
        id,
        openedAtMs:       now(),
        closedAtMs:       undefined,
        runId:            seed.runId,
        sceneId:          seed.sceneId,
        momentId:         seed.momentId,
        roomId:           seed.roomId,
        channelId:        seed.channelId,
        anchorIds:        Object.freeze([]),
        dominantKinds:    Object.freeze(seed.dominantKinds ?? []),
        totalFinalSalience: 0,
      });
      windows.set(window.id, window);
      return window;
    },

    appendToWindow(windowId: string, anchorId: MemoryAnchorId): MemoryAnchorMutationReceipt {
      const window = windows.get(windowId);
      const anchor = anchors.get(anchorId);
      if (!window || !anchor) {
        return Object.freeze({ ok: false, operation: 'WINDOW_APPEND', anchorId, windowId, created: false, updated: false, debugNotes: Object.freeze([`windowExists=${!!window}`, `anchorExists=${!!anchor}`]) });
      }
      const anchorIds = mergeUnique(window.anchorIds, [anchorId]).slice(-MEMORY_ANCHOR_STORE_DEFAULTS.maxWindowAnchors);
      const dominant  = computeDominantKinds(anchorIds);
      const updated   = freezeWindow({ ...window, anchorIds: Object.freeze(anchorIds), dominantKinds: Object.freeze(dominant), totalFinalSalience: round4(sumWindowSalience(anchorIds)) });
      windows.set(windowId, updated);

      // Update relationship graph for all pairs in this window
      updateRelationshipGraph(anchorIds);

      return Object.freeze({ ok: true, operation: 'WINDOW_APPEND', anchorId, windowId, created: false, updated: true, debugNotes: Object.freeze([`windowAnchors=${updated.anchorIds.length}`, `dominantKinds=${updated.dominantKinds.join('|') || 'none'}`]) });
    },

    closeWindow(windowId: string, explicitMs?: number): MemoryAnchorMutationReceipt {
      const window = windows.get(windowId);
      if (!window) return Object.freeze({ ok: false, operation: 'WINDOW_CLOSE', windowId, created: false, updated: false, debugNotes: Object.freeze(['windowMissing']) });
      windows.set(windowId, freezeWindow({ ...window, closedAtMs: normalizeNow(explicitMs ?? now()) }));
      return Object.freeze({ ok: true, operation: 'WINDOW_CLOSE', windowId, created: false, updated: true, debugNotes: Object.freeze([`closedAtMs=${windows.get(windowId)!.closedAtMs}`]) });
    },

    getWindow:   (id) => windows.get(id) ?? null,
    listWindows: ()  => Object.freeze([...windows.values()]),

    // ── QUERY ─────────────────────────────────────────────────────────────────
    query(request: MemoryAnchorStoreQueryRequest): MemoryAnchorQueryResponse {
      const query        = normalizeQuery(request, now());
      const candidateIds = gatherCandidateIds(query, request);
      const ranked       = rankingPolicy.rank(
        candidateIds.map(id => toCandidate(id, request.embeddingMatches)),
        buildRankingContext(query, request),
      );

      const matches  = Object.freeze(ranked.ranked.map(e => e.projection));
      const previews = Object.freeze(ranked.ranked.map((e, i) => toPreview(e.anchor, e.score, i + 1)));

      // Shadow matches surfaced for InvasionOrchestrator / HaterResponseOrchestrator
      const shadowMatches = request.includeShadow
        ? Object.freeze(candidateIds.filter(id => shadowIds.has(id)))
        : Object.freeze([] as MemoryAnchorId[]);

      const receipt = freezeReceipt({
        id: createMemoryAnchorReceiptId(`${query.id}_${query.intent}_${ranked.returnedCount}_${ranked.totalCandidates}`),
        queryId:        query.id,
        createdAtMs:    ranked.nowMs,
        candidateCount: ranked.totalCandidates,
        returnedCount:  ranked.returnedCount,
        topAnchorIds:   Object.freeze(ranked.ranked.map(e => e.anchor.id)),
        debugNotes:     Object.freeze([`threshold=${round4(ranked.thresholdScore)}`, `matches=${ranked.returnedCount}`, `intent=${query.intent}`, `mode=${request.currentModeId ?? 'UNKNOWN'}`, `shadowMatches=${shadowMatches.length}`]),
      });

      // Only persist receipt if this is not a probe query
      if (!request.probeOnly) pushReceipt(receipt);

      return Object.freeze({ query, matches, ranked: Object.freeze(ranked.ranked), previews, receipt, candidateIds: Object.freeze(candidateIds), shadowMatches, debugNotes: Object.freeze([`candidateIds=${candidateIds.length}`, `returned=${ranked.returnedCount}`, `probe=${!!request.probeOnly}`]) });
    },

    // ── CALLBACK DEDUP REGISTRY ───────────────────────────────────────────────
    registerUsedCallback(phrase: string): void {
      if (usedCallbackPhrases.size >= MEMORY_ANCHOR_STORE_DEFAULTS.maxUsedCallbacksPerRun) {
        // LRU: delete oldest entry (first item in insertion-order Set)
        const first = usedCallbackPhrases.values().next().value;
        if (first) usedCallbackPhrases.delete(first);
      }
      usedCallbackPhrases.add(normalizeToken(phrase));
    },

    isCallbackUsed(phrase: string): boolean {
      return usedCallbackPhrases.has(normalizeToken(phrase));
    },

    clearUsedCallbacks(): void {
      usedCallbackPhrases.clear();
    },

    // ── TICK DECAY ────────────────────────────────────────────────────────────
    // Integrates with Engine 0's tick clock. On each tick, anchors with a
    // formation-era audienceHeat bonus have that bonus decayed by the
    // exponential half-life curve. Anchors whose final salience falls below
    // the minimum are auto-archived (not deleted — still recoverable).

    tickDecay(tickIndex: number): MemoryAnchorMutationReceipt {
      if (!options.salienceDecayEnabled) {
        return Object.freeze({ ok: true, operation: 'TICK_DECAY', created: false, updated: false, debugNotes: Object.freeze(['decayDisabled']) });
      }
      const halfLife = MEMORY_ANCHOR_STORE_DEFAULTS.salienceDecayHalfLifeTicks;
      let decayed = 0;
      let autoArchived = 0;

      for (const [id, anchor] of anchors) {
        if (archivedIds.has(id)) continue;
        // Only decay TRANSIENT and VOLATILE stability classes
        if (anchor.stabilityClass !== 'TRANSIENT' && anchor.stabilityClass !== 'VOLATILE') continue;

        const formationTick: number = (anchor.formation as any).formationTickIndex ?? 0;
        const ticksElapsed = Math.max(0, tickIndex - formationTick);
        const decayFactor  = Math.pow(0.5, ticksElapsed / halfLife);
        const newFinal     = round4(anchor.salience.base * decayFactor);

        if (newFinal === anchor.salience.final) continue;

        const updated = freezeAnchor({
          ...anchor,
          salience: Object.freeze({ ...anchor.salience, final: newFinal }),
        });
        removeFromIndexes(anchor);
        anchors.set(id, updated);
        addToIndexes(updated);
        decayed++;

        if (newFinal < MEMORY_ANCHOR_DEFAULT_MINIMUM_FINAL_SALIENCE) {
          archivedIds.add(id);
          autoArchived++;
        }
      }

      return Object.freeze({
        ok: true, operation: 'TICK_DECAY', created: false, updated: decayed > 0,
        debugNotes: Object.freeze([`tickIndex=${tickIndex}`, `decayed=${decayed}`, `autoArchived=${autoArchived}`]),
      });
    },

    // ── RELATIONSHIP GRAPH ────────────────────────────────────────────────────
    getRelationshipEdge(a: MemoryAnchorId, b: MemoryAnchorId): RelationshipEdge | null {
      return relationshipEdges.get(edgeKey(a, b)) ?? null;
    },

    listRelationshipEdges(anchorId: MemoryAnchorId): readonly RelationshipEdge[] {
      return Object.freeze(
        [...relationshipEdges.values()].filter(e => e.anchorIdA === anchorId || e.anchorIdB === anchorId)
      );
    },

    // ── COLD START SEED ───────────────────────────────────────────────────────
    seedColdStart(seeds: readonly MemoryAnchor[]): MemoryAnchorMutationReceipt {
      if (anchors.size > 0) {
        return Object.freeze({ ok: false, operation: 'SEED_COLD_START', created: false, updated: false, debugNotes: Object.freeze(['storeNotEmpty']) });
      }
      let seeded = 0;
      for (const seed of seeds) {
        anchors.set(seed.id, freezeAnchor(seed));
        addToIndexes(seed);
        seeded++;
      }
      return Object.freeze({ ok: true, operation: 'SEED_COLD_START', created: true, updated: false, debugNotes: Object.freeze([`seeded=${seeded}`]) });
    },

    // ── TELEMETRY EXPORT ──────────────────────────────────────────────────────
    exportTelemetry(modeId?: ChatModeId): AnchorTelemetryPayload {
      const allAnchors = [...anchors.values()];
      const avgSalience = allAnchors.length
        ? round4(allAnchors.reduce((s, a) => s + a.salience.final, 0) / allAnchors.length)
        : 0;
      const topKindCounts = countBy(allAnchors, a => a.kind);
      const payload: AnchorTelemetryPayload = Object.freeze({
        storeVersion:         MEMORY_ANCHOR_STORE_VERSION,
        exportedAtMs:         now(),
        runId:                options.runId,
        userId:               options.userId,
        modeId:               modeId ?? options.sessionModeId,
        totalAnchors:         anchors.size,
        archivedCount:        archivedIds.size,
        openWindows:          [...windows.values()].filter(w => !w.closedAtMs).length,
        shadowCount:          shadowIds.size,
        topKindCounts:        Object.freeze(topKindCounts),
        avgSalience,
        usedCallbacks:        usedCallbackPhrases.size,
        relationshipEdgeCount: relationshipEdges.size,
      });
      void options.persistence?.appendTelemetry?.(payload);
      return payload;
    },

    // ── METRICS ───────────────────────────────────────────────────────────────
    metrics(): MemoryAnchorStoreMetrics {
      const all = [...anchors.values()];
      const avgFinalSalience = all.length ? round4(all.reduce((s, a) => s + a.salience.final, 0) / all.length) : 0;
      return Object.freeze({
        totalAnchors:      anchors.size,
        archivedAnchors:   archivedIds.size,
        shadowAnchors:     shadowIds.size,
        openWindows:       [...windows.values()].filter(w => !w.closedAtMs).length,
        totalWindows:      windows.size,
        totalReceipts:     receipts.length,
        relationshipEdges: relationshipEdges.size,
        usedCallbacksCount: usedCallbackPhrases.size,
        anchorsByKind:     Object.freeze(countBy(all, a => a.kind)),
        anchorsByRoom:     Object.freeze(countBy(all, a => a.subject.roomId ?? 'UNSCOPED')),
        anchorsByChannel:  Object.freeze(countBy(all, a => a.subject.channelId ?? 'UNSCOPED')),
        anchorsByRun:      Object.freeze(countBy(all, a => a.subject.runId ?? 'UNSCOPED')),
        anchorsByMode:     Object.freeze(countBy(all, a => a.subject.modeId ?? 'UNKNOWN')),
        avgFinalSalience,
        proofBoundAnchors: proofBindings.size,
      });
    },

    // ── PRUNE ─────────────────────────────────────────────────────────────────
    prune(explicitNowMs?: number): MemoryAnchorMutationReceipt {
      const ts = normalizeNow(explicitNowMs ?? now());
      let removedArchived = 0;

      for (const id of [...archivedIds]) {
        const anchor = anchors.get(id);
        if (!anchor) { archivedIds.delete(id); removedArchived++; continue; }
        if (ts - anchor.formation.updatedAtMs > MEMORY_ANCHOR_STORE_DEFAULTS.pruneArchivedAfterMs) {
          removeFromIndexes(anchor);
          anchors.delete(id);
          archivedIds.delete(id);
          proofBindings.delete(id);
          shadowIds.delete(id);
          removedArchived++;
        }
      }

      // Prune stale relationship edges where both anchors are gone
      for (const [key, edge] of [...relationshipEdges]) {
        if (!anchors.has(edge.anchorIdA) || !anchors.has(edge.anchorIdB)) {
          relationshipEdges.delete(key);
        }
      }

      while (receipts.length > MEMORY_ANCHOR_STORE_DEFAULTS.maxReceipts) receipts.shift();

      return Object.freeze({
        ok: true, operation: 'PRUNE', created: false, updated: removedArchived > 0,
        debugNotes: Object.freeze([`removedArchived=${removedArchived}`, `receipts=${receipts.length}`, `edgesRemaining=${relationshipEdges.size}`]),
      });
    },
  };

  // ── BOOT: async persistence hydration ────────────────────────────────────────
  void hydrateFromPersistence();
  return Object.freeze(api);

  // ═══════════════════════════════════════════════════════════════════════════
  // INTERNAL HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  async function hydrateFromPersistence(): Promise<void> {
    const snapshot = await options.persistence?.load?.();
    if (snapshot) api.hydrate(snapshot);
  }

  /** Classify whether an anchor belongs to a shadow family and register it. */
  function classifyShadow(anchor: MemoryAnchor): void {
    const familyId = anchor.continuity.familyId ?? '';
    const isShadow = MEMORY_ANCHOR_STORE_DEFAULTS.shadowFamilies.some(sf => familyId.includes(sf));
    if (isShadow) shadowIds.add(anchor.id);
    else shadowIds.delete(anchor.id);
  }

  /** Enforce per-family anchor cap with LRU eviction. Returns eviction receipt or null. */
  function enforcePerFamilyCap(familyId: string | undefined): MemoryAnchorMutationReceipt | null {
    if (!familyId) return null;
    const familySet = familyIndex.get(familyId);
    if (!familySet || familySet.size <= MEMORY_ANCHOR_STORE_DEFAULTS.maxAnchorsPerFamily) return null;

    // Evict the anchor with the lowest final salience that is NOT proof-bound
    let evictId: MemoryAnchorId | null = null;
    let lowestSalience = Infinity;
    for (const id of familySet) {
      const a = anchors.get(id);
      if (!a || proofBindings.has(id)) continue;
      if (a.salience.final < lowestSalience) { lowestSalience = a.salience.final; evictId = id; }
    }

    if (!evictId) return null;
    const evicted = anchors.get(evictId)!;
    removeFromIndexes(evicted);
    anchors.delete(evictId);
    archivedIds.delete(evictId);
    shadowIds.delete(evictId);

    return Object.freeze({ ok: true, operation: 'EVICT_LRU', anchorId: evictId, created: false, updated: false, debugNotes: Object.freeze([`family=${familyId}`, `salience=${round4(lowestSalience)}`]) });
  }

  /** Add anchor into all relevant secondary indexes. */
  function addToIndexes(anchor: MemoryAnchor): void {
    addIndexed(familyIndex,       anchor.continuity.familyId,        anchor.id);
    addIndexed(relationshipIndex, anchor.subject.relationshipId,     anchor.id);
    addIndexed(roomIndex,         anchor.subject.roomId,             anchor.id);
    addIndexed(channelIndex,      anchor.subject.channelId,          anchor.id);
    addIndexed(runIndex,          anchor.subject.runId,              anchor.id);
    addIndexed(sceneIndex,        anchor.subject.sceneId,            anchor.id);
    addIndexed(momentIndex,       anchor.subject.momentId,           anchor.id);
    addIndexed(actorIndex,        anchor.subject.actorId,            anchor.id);
    addIndexed(personaIndex,      anchor.subject.actorPersonaId,     anchor.id);
    for (const q of anchor.quoteRefs) addIndexed(quoteIndex, q, anchor.id);
    if (!kindIndex.has(anchor.kind)) kindIndex.set(anchor.kind, new Set());
    kindIndex.get(anchor.kind)!.add(anchor.id);
    for (const tag of collectTags(anchor).slice(0, MEMORY_ANCHOR_STORE_DEFAULTS.maxIndexesPerAnchor)) {
      addIndexed(tagIndex, tag, anchor.id);
    }
  }

  function removeFromIndexes(anchor: MemoryAnchor): void {
    removeIndexed(familyIndex,       anchor.continuity.familyId,    anchor.id);
    removeIndexed(relationshipIndex, anchor.subject.relationshipId, anchor.id);
    removeIndexed(roomIndex,         anchor.subject.roomId,         anchor.id);
    removeIndexed(channelIndex,      anchor.subject.channelId,      anchor.id);
    removeIndexed(runIndex,          anchor.subject.runId,          anchor.id);
    removeIndexed(sceneIndex,        anchor.subject.sceneId,        anchor.id);
    removeIndexed(momentIndex,       anchor.subject.momentId,       anchor.id);
    removeIndexed(actorIndex,        anchor.subject.actorId,        anchor.id);
    removeIndexed(personaIndex,      anchor.subject.actorPersonaId, anchor.id);
    for (const q of anchor.quoteRefs) removeIndexed(quoteIndex, q, anchor.id);
    kindIndex.get(anchor.kind)?.delete(anchor.id);
    for (const tag of collectTags(anchor).slice(0, MEMORY_ANCHOR_STORE_DEFAULTS.maxIndexesPerAnchor)) {
      removeIndexed(tagIndex, tag, anchor.id);
    }
  }

  function clearAllIndexes(): void {
    clearIndexes([familyIndex, relationshipIndex, quoteIndex, roomIndex, channelIndex,
      runIndex, sceneIndex, momentIndex, actorIndex, personaIndex, kindIndex, tagIndex, modeIndex]);
  }

  /** Update the relationship co-appearance graph after a window append. */
  function updateRelationshipGraph(anchorIds: readonly MemoryAnchorId[]): void {
    if (anchorIds.length < 2) return;
    const ts = now();
    // Only update the new anchor's edges (last in the array) to keep O(n) not O(n²)
    const newId = anchorIds[anchorIds.length - 1];
    for (let i = 0; i < anchorIds.length - 1; i++) {
      const otherId = anchorIds[i];
      const key  = edgeKey(newId, otherId);
      const existing = relationshipEdges.get(key);
      const coApps = (existing?.coAppearances ?? 0) + 1;
      const strength = round4(Math.min(1, coApps / 10)); // saturates at 10 co-appearances
      const edge: RelationshipEdge = Object.freeze({ anchorIdA: newId, anchorIdB: otherId, coAppearances: coApps, strengthScore: strength, lastSeenAtMs: ts });
      relationshipEdges.set(key, edge);
    }
    // LRU eviction of relationship edges if cap exceeded
    if (relationshipEdges.size > MEMORY_ANCHOR_STORE_DEFAULTS.maxRelationshipEdges) {
      let oldest = Infinity, oldestKey = '';
      for (const [k, e] of relationshipEdges) {
        if (e.lastSeenAtMs < oldest) { oldest = e.lastSeenAtMs; oldestKey = k; }
      }
      if (oldestKey) relationshipEdges.delete(oldestKey);
    }
  }

  function gatherCandidateIds(query: MemoryAnchorQuery, request: MemoryAnchorStoreQueryRequest): readonly MemoryAnchorId[] {
    const candidateSet = new Set<MemoryAnchorId>();
    const buckets: Array<readonly MemoryAnchorId[]> = [];

    pushIndexedBucket(buckets, roomIndex.get(query.roomId ?? ''));
    pushIndexedBucket(buckets, channelIndex.get(query.channelId ?? ''));
    pushIndexedBucket(buckets, runIndex.get(query.runId ?? ''));
    pushIndexedBucket(buckets, sceneIndex.get(query.sceneId ?? ''));
    pushIndexedBucket(buckets, momentIndex.get(query.momentId ?? ''));
    pushIndexedBucket(buckets, actorIndex.get(query.actorId ?? ''));
    pushIndexedBucket(buckets, personaIndex.get(request.actorPersonaId ?? ''));
    pushIndexedBucket(buckets, relationshipIndex.get(request.relationshipId ?? ''));

    for (const kind of query.kinds) pushIndexedBucket(buckets, kindIndex.get(kind));
    for (const tag of [...query.requiredTags, ...(request.currentTags ?? []), ...(request.emotionSignals ?? [])]) {
      pushIndexedBucket(buckets, tagIndex.get(normalizeToken(tag)));
    }

    // Mode-aware boost: anchors formed in the current mode are added first
    if (request.currentModeId) {
      pushIndexedBucket(buckets, modeIndex.get(request.currentModeId));
    }

    for (const bucket of buckets) {
      for (const id of bucket) {
        if (!request.includeArchived && archivedIds.has(id)) continue;
        if (!request.includeShadow && shadowIds.has(id)) continue;
        candidateSet.add(id);
      }
    }

    // Fallback: all non-archived anchors if no indexed hits
    if (!candidateSet.size) {
      for (const [id] of anchors) {
        if (!request.includeArchived && archivedIds.has(id)) continue;
        if (!request.includeShadow && shadowIds.has(id)) continue;
        candidateSet.add(id);
      }
    }

    const cap = Math.max(1, Math.floor(request.candidateCap ?? options.queryCandidateCap ?? MEMORY_ANCHOR_STORE_DEFAULTS.queryCandidateCap));
    return Object.freeze([...candidateSet].slice(0, cap));
  }

  function buildRankingContext(query: MemoryAnchorQuery, request: MemoryAnchorStoreQueryRequest): MemoryRankingContext {
    return Object.freeze({
      nowMs:                  now(),
      intent:                 query.intent,
      queryText:              request.queryText,
      requiredTags:           query.requiredTags,
      blockedTags:            query.blockedTags,
      targetKinds:            query.kinds,
      actorId:                query.actorId,
      actorPersonaId:         request.actorPersonaId,
      relationshipId:         request.relationshipId,
      roomId:                 query.roomId,
      channelId:              query.channelId,
      runId:                  query.runId,
      sceneId:                query.sceneId,
      momentId:               query.momentId,
      emotionSignals:         request.emotionSignals,
      relationshipSignals:    request.relationshipSignals,
      currentTags:            request.currentTags,
      currentModeId:          request.currentModeId,
      audienceHeat:           request.audienceHeat,
      topK:                   query.topK,
      minimumScore:           request.minimumScore ?? query.minimumFinalSalience,
      excludedAnchorIds:      request.excludedAnchorIds,
      excludedFamilyIds:      request.excludedFamilyIds,
      alreadyUsedCallbackPhrases: request.alreadyUsedCallbackPhrases ?? [...usedCallbackPhrases],
    });
  }

  function toCandidate(anchorId: MemoryAnchorId, embeddingMatches?: readonly MemoryRankingEmbeddingMatch[]): MemoryRankingCandidate {
    const anchor = anchors.get(anchorId);
    if (!anchor) throw new Error(`MemoryAnchorStore: candidate missing anchor: ${anchorId}`);
    return Object.freeze({
      anchor,
      embeddingMatches: filterEmbeddingMatches(anchor, embeddingMatches),
      retrievalSource:  embeddingMatches?.length ? 'HYBRID' : 'INDEX',
    });
  }

  function filterEmbeddingMatches(anchor: MemoryAnchor, matches?: readonly MemoryRankingEmbeddingMatch[]): readonly MemoryRankingEmbeddingMatch[] {
    if (!matches?.length) return Object.freeze([]);
    return Object.freeze(matches.filter(m => m.documentId && anchor.embeddingDocumentIds.includes(m.documentId)));
  }

  function toPreview(anchor: MemoryAnchor, score: number, rank: number): MemoryAnchorPreview {
    return Object.freeze({
      id:                createMemoryAnchorPreviewId(`${anchor.id}_${rank}`),
      anchorId:          anchor.id,
      title:             anchor.payload.headline,
      subtitle:          `${anchor.kind} • ${anchor.retrieval.priority} • ${anchor.stabilityClass}`,
      summary:           anchor.payload.summary,
      tags:              Object.freeze(collectTags(anchor).slice(0, 8)),
      finalSalience:     round4(anchor.salience.final),
      retrievalPriority: anchor.retrieval.priority,
      stabilityClass:    anchor.stabilityClass,
      proofBound:        proofBindings.has(anchor.id),
    });
  }

  function pushReceipt(receipt: MemoryAnchorReceipt): void {
    receipts.push(receipt);
    while (receipts.length > MEMORY_ANCHOR_STORE_DEFAULTS.maxReceipts) receipts.shift();
    void options.persistence?.appendReceipt?.(receipt);
  }

  function computeDominantKinds(anchorIds: readonly MemoryAnchorId[]): readonly MemoryAnchorKind[] {
    const counts = new Map<MemoryAnchorKind, number>();
    for (const id of anchorIds) {
      const a = anchors.get(id);
      if (!a) continue;
      counts.set(a.kind, (counts.get(a.kind) ?? 0) + 1);
    }
    return Object.freeze([...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k));
  }

  function sumWindowSalience(anchorIds: readonly MemoryAnchorId[]): number {
    return anchorIds.reduce((sum, id) => sum + (anchors.get(id)?.salience.final ?? 0), 0);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// MODULE-LEVEL PURE HELPERS (no closure dependency)
// ═════════════════════════════════════════════════════════════════════════════

function normalizeQuery(request: MemoryAnchorStoreQueryRequest, nowMs: number): MemoryAnchorQuery {
  const base = request.query ?? {};
  return Object.freeze({
    id: base.id ?? createMemoryAnchorQueryId(
      [request.intent ?? base.intent ?? 'CALLBACK', request.runId ?? base.runId, request.sceneId ?? base.sceneId, request.momentId ?? base.momentId, request.roomId ?? base.roomId, request.channelId ?? base.channelId, request.actorId ?? base.actorId, nowMs].filter(Boolean).join('_')
    ),
    createdAtMs:          base.createdAtMs ?? nowMs,
    intent:               request.intent ?? base.intent ?? 'CALLBACK',
    roomId:               request.roomId ?? base.roomId,
    channelId:            request.channelId ?? base.channelId,
    runId:                request.runId ?? base.runId,
    sceneId:              request.sceneId ?? base.sceneId,
    momentId:             request.momentId ?? base.momentId,
    actorId:              request.actorId ?? base.actorId,
    actorPersonaId:       request.actorPersonaId ?? base.actorPersonaId,
    relationshipId:       request.relationshipId ?? base.relationshipId,
    kinds:                Object.freeze(base.kinds ?? []),
    requiredTags:         Object.freeze(normalizeStringList(base.requiredTags ?? request.currentTags ?? [])),
    blockedTags:          Object.freeze(normalizeStringList(base.blockedTags ?? [])),
    minimumFinalSalience: clampUnit(request.minimumScore ?? base.minimumFinalSalience ?? MEMORY_ANCHOR_DEFAULT_MINIMUM_FINAL_SALIENCE),
    topK:                 Math.max(1, Math.floor(request.topK ?? base.topK ?? MEMORY_ANCHOR_DEFAULT_TOP_K)),
  });
}

function freezeAnchor(anchor: MemoryAnchor): MemoryAnchor {
  return Object.freeze({
    ...anchor,
    evidence:              Object.freeze([...anchor.evidence]),
    embeddingDocumentIds:  Object.freeze([...anchor.embeddingDocumentIds]),
    quoteRefs:             Object.freeze([...anchor.quoteRefs]),
    relationshipRefs:      Object.freeze([...anchor.relationshipRefs]),
    debugNotes:            Object.freeze([...anchor.debugNotes]),
    payload: Object.freeze({
      ...anchor.payload,
      tags:             Object.freeze([...anchor.payload.tags]),
      emotions:         Object.freeze([...anchor.payload.emotions]),
      relationshipTags: Object.freeze([...anchor.payload.relationshipTags]),
      callbackPhrases:  Object.freeze([...anchor.payload.callbackPhrases]),
    }),
    continuity: Object.freeze({
      ...anchor.continuity,
      predecessorAnchorIds: Object.freeze([...anchor.continuity.predecessorAnchorIds]),
      successorAnchorIds:   Object.freeze([...anchor.continuity.successorAnchorIds]),
      followPersonaIds:     Object.freeze([...anchor.continuity.followPersonaIds]),
    }),
    retrieval: Object.freeze({
      ...anchor.retrieval,
      queryIntents:  Object.freeze([...anchor.retrieval.queryIntents]),
      requiredTags:  Object.freeze([...anchor.retrieval.requiredTags]),
      blockedTags:   Object.freeze([...anchor.retrieval.blockedTags]),
      matchKinds:    Object.freeze([...anchor.retrieval.matchKinds]),
    }),
  });
}

function freezeWindow(w: MemoryAnchorWindow): MemoryAnchorWindow {
  return Object.freeze({ ...w, anchorIds: Object.freeze([...w.anchorIds]), dominantKinds: Object.freeze([...w.dominantKinds]) });
}

function freezeReceipt(r: MemoryAnchorReceipt): MemoryAnchorReceipt {
  return Object.freeze({ ...r, topAnchorIds: Object.freeze([...r.topAnchorIds]), debugNotes: Object.freeze([...r.debugNotes]) });
}

function collectTags(anchor: MemoryAnchor): readonly string[] {
  return normalizeStringList([
    ...anchor.payload.tags, ...anchor.payload.emotions, ...anchor.payload.relationshipTags,
    ...anchor.retrieval.requiredTags, ...anchor.quoteRefs, ...anchor.relationshipRefs,
    anchor.kind, anchor.retrieval.priority, anchor.stabilityClass,
    anchor.subject.roomId, anchor.subject.channelId, anchor.subject.runId,
    anchor.subject.sceneId, anchor.subject.momentId, anchor.subject.actorId,
    anchor.subject.actorPersonaId, anchor.subject.relationshipId, anchor.continuity.familyId,
    (anchor.subject as any).modeId,
  ]);
}

function normalizeStringList(values: readonly (string | undefined | null)[]): readonly string[] {
  return Object.freeze(Array.from(new Set(values.map(v => normalizeToken(v)).filter((v): v is string => !!v))));
}

function normalizeToken(value: string | undefined | null): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9:_-]/g, '');
}

function addIndexed<K extends string, V extends string>(index: Map<K, Set<V>>, key: K | undefined, value: V): void {
  if (!key) return;
  if (!index.has(key)) index.set(key, new Set());
  index.get(key)!.add(value);
}

function removeIndexed<K extends string, V extends string>(index: Map<K, Set<V>>, key: K | undefined, value: V): void {
  if (!key) return;
  const bucket = index.get(key);
  if (!bucket) return;
  bucket.delete(value);
  if (!bucket.size) index.delete(key);
}

function pushIndexedBucket<T extends string>(target: Array<readonly T[]>, bucket: Set<T> | undefined): void {
  if (bucket?.size) target.push(Object.freeze([...bucket.values()]));
}

function countBy<T>(values: readonly T[], projector: (v: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const v of values) { const k = projector(v); counts[k] = (counts[k] ?? 0) + 1; }
  return counts;
}

function clearIndexes(indexes: readonly Map<any, Set<any>>[]): void {
  for (const idx of indexes) idx.clear();
}

function normalizeNow(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value as number)) : Date.now();
}

function missingReceipt(operation: MemoryAnchorMutationReceipt['operation'], anchorId?: MemoryAnchorId): MemoryAnchorMutationReceipt {
  return Object.freeze({ ok: false, operation, anchorId, created: false, updated: false, debugNotes: Object.freeze(['anchorMissing']) });
}

function mergeUnique<T>(existing: readonly T[], next: readonly T[]): readonly T[] {
  return Object.freeze(Array.from(new Set([...existing, ...next])));
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** Deterministic edge key: always sorts the two IDs so A::B === B::A. */
function edgeKey(a: MemoryAnchorId, b: MemoryAnchorId): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

/** Priority tier ladder: LOW → NORMAL → HIGH → CRITICAL */
const PRIORITY_LADDER = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const;
type RetrievalPriority = typeof PRIORITY_LADDER[number];

function promotePriority(p: string): string {
  const idx = PRIORITY_LADDER.indexOf(p as RetrievalPriority);
  if (idx === -1 || idx === PRIORITY_LADDER.length - 1) return p;
  return PRIORITY_LADDER[idx + 1];
}

function demotePriority(p: string): string {
  const idx = PRIORITY_LADDER.indexOf(p as RetrievalPriority);
  if (idx <= 0) return p;
  return PRIORITY_LADDER[idx - 1];
}