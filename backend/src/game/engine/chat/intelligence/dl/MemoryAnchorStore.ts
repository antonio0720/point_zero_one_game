/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT DURABLE MEMORY ANCHOR STORE
 * FILE: backend/src/game/engine/chat/intelligence/dl/MemoryAnchorStore.ts
 * VERSION: 2026.03.22-sovereign-depth.v3
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Durable, retrieval-backed memory anchor storage for the backend chat runtime.
 * This module owns:
 * - anchor persistence semantics across sessions, runs, scenes, and windows
 * - indexed retrieval candidate gathering ahead of MemoryRankingPolicy scoring
 * - window-scoped social continuity tracking
 * - proof binding continuity across archive / reinstate / merge cycles
 * - shadow-surface indexing for off-screen orchestration systems
 * - salience decay and archival maintenance under large concurrency pressure
 * - explainability receipts for every ranked query
 *
 * Design rules
 * ------------
 * - This store never replaces MemoryRankingPolicy. It prepares candidates and
 *   delegates scoring and projection to the ranking policy.
 * - Querying is index-first. Full scans are only used as the final fallback.
 * - Snapshot export remains deterministic and JSON-serialisable.
 * - All public surfaces remain aligned to shared/contracts/chat/learning/MemoryAnchors.ts.
 * - Barrel compatibility is preserved for backend/src/game/engine/chat/intelligence/dl/index.ts.
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
  type MemoryAnchorRetrievalPriority,
  type MemoryAnchorWindow,
} from '../../../../../../../shared/contracts/chat/learning/MemoryAnchors';

import type {
  EmbeddingDocumentId,
} from '../../../../../../../shared/contracts/chat/learning/ConversationEmbeddings';

import {
  createMemoryRankingPolicy,
  type MemoryRankingCandidate,
  type MemoryRankingContext,
  type MemoryRankingEmbeddingMatch,
  type MemoryRankingPolicyApi,
  type MemoryRankingPolicyOptions,
  type RankedMemoryAnchor,
} from './MemoryRankingPolicy';

// ──────────────────────────────────────────────────────────────────────────────
// VERSION / CONSTANTS
// ──────────────────────────────────────────────────────────────────────────────

export const MEMORY_ANCHOR_STORE_VERSION =
  '2026.03.22-sovereign-depth.v3' as const;

export const MEMORY_ANCHOR_STORE_DEFAULTS = Object.freeze({
  queryCandidateCap: 192,
  maxReceipts: 96,
  maxSnapshots: 8,
  maxWindowsPerRun: 64,
  maxWindowAnchors: 96,
  maxAnchorsPerFamily: 28,
  maxIndexesPerAnchor: 64,
  maxCandidateBuckets: 24,
  maxCandidateExpansion: 384,
  maxRelationshipEdges: 512,
  maxUsedCallbacksPerRun: 512,
  maxProofBindingsPerAnchor: 8,
  maxAuditEntries: 2048,
  maxDebugNotesPerReceipt: 24,
  maxShadowMatchesPerQuery: 64,
  pruneArchivedAfterMs: 1_000 * 60 * 60 * 24 * 14,
  pruneClosedWindowsAfterMs: 1_000 * 60 * 60 * 24 * 7,
  salienceDecayHalfLifeTicks: 48,
  audienceHeatBonusCap: 0.25,
  relationshipEdgeSaturationCount: 10,
  shadowFamilies: Object.freeze([
    'SYSTEM_SHADOW',
    'NPC_SHADOW',
    'RIVALRY_SHADOW',
    'RESCUE_SHADOW',
    'LIVEOPS_SHADOW',
  ] as const),
  decayEligibleStabilityClasses: Object.freeze([
    'VOLATILE',
    'RUN_STABLE',
  ] as const),
});

// ──────────────────────────────────────────────────────────────────────────────
// MODE / POLICY / INTERNAL TYPES
// ──────────────────────────────────────────────────────────────────────────────

export type ChatModeId =
  | 'EMPIRE'
  | 'PREDATOR'
  | 'SYNDICATE'
  | 'PHANTOM'
  | 'LOBBY'
  | 'POST_RUN'
  | 'UNKNOWN';

export type AnchorConflictPolicy = 'MERGE' | 'REPLACE' | 'SKIP';

export interface AnchorProofBinding {
  readonly proofChainId: string;
  readonly proofHash: string;
  readonly verifiedAtMs: number;
  readonly eventType: string;
}

export interface RelationshipEdge {
  readonly anchorIdA: MemoryAnchorId;
  readonly anchorIdB: MemoryAnchorId;
  readonly coAppearances: number;
  readonly strengthScore: number;
  readonly lastSeenAtMs: number;
}

export interface AnchorTelemetryPayload {
  readonly storeVersion: typeof MEMORY_ANCHOR_STORE_VERSION;
  readonly exportedAtMs: number;
  readonly runId?: string;
  readonly userId?: string;
  readonly modeId?: ChatModeId;
  readonly totalAnchors: number;
  readonly archivedCount: number;
  readonly openWindows: number;
  readonly shadowCount: number;
  readonly topKindCounts: Readonly<Record<string, number>>;
  readonly avgSalience: number;
  readonly usedCallbacks: number;
  readonly relationshipEdgeCount: number;
}

export interface BatchUpsertRequest {
  readonly anchors: readonly MemoryAnchor[];
  readonly conflictPolicy: AnchorConflictPolicy;
  readonly proofBindings?: Readonly<Record<MemoryAnchorId, AnchorProofBinding>>;
}

export interface BatchUpsertResult {
  readonly created: number;
  readonly updated: number;
  readonly skipped: number;
  readonly merged: number;
  readonly evicted: number;
  readonly receipts: readonly MemoryAnchorMutationReceipt[];
}

export interface MemoryAnchorWindowSeed {
  readonly runId?: string;
  readonly sceneId?: string;
  readonly momentId?: string;
  readonly roomId?: string;
  readonly channelId?: string;
  readonly modeId?: ChatModeId;
  readonly dominantKinds?: readonly MemoryAnchorKind[];
  readonly audienceHeat?: number;
}

export interface MemoryAnchorMutationReceipt {
  readonly ok: boolean;
  readonly operation:
    | 'UPSERT'
    | 'BATCH_UPSERT'
    | 'MERGE'
    | 'ARCHIVE'
    | 'REINSTATE'
    | 'REAFFIRM'
    | 'LINK_SUCCESSOR'
    | 'WINDOW_OPEN'
    | 'WINDOW_APPEND'
    | 'WINDOW_CLOSE'
    | 'HYDRATE'
    | 'PRUNE'
    | 'TICK_DECAY'
    | 'PROMOTE'
    | 'DEMOTE'
    | 'PROOF_BIND'
    | 'SEED_COLD_START'
    | 'EVICT_LRU';
  readonly anchorId?: MemoryAnchorId;
  readonly windowId?: string;
  readonly created: boolean;
  readonly updated: boolean;
  readonly debugNotes: readonly string[];
}

export interface MemoryAnchorStoreQueryRequest {
  readonly query?: Partial<MemoryAnchorQuery>;
  readonly intent?: MemoryAnchorQueryIntent;
  readonly queryText?: string;
  readonly actorId?: string;
  readonly actorPersonaId?: string;
  readonly relationshipId?: string;
  readonly roomId?: string;
  readonly channelId?: string;
  readonly runId?: string;
  readonly sceneId?: string;
  readonly momentId?: string;
  readonly currentModeId?: ChatModeId;
  readonly currentTags?: readonly string[];
  readonly relationshipSignals?: readonly string[];
  readonly emotionSignals?: readonly string[];
  readonly embeddingMatches?: readonly MemoryRankingEmbeddingMatch[];
  readonly topK?: number;
  readonly minimumScore?: number;
  readonly candidateCap?: number;
  readonly excludedAnchorIds?: readonly MemoryAnchorId[];
  readonly excludedFamilyIds?: readonly string[];
  readonly alreadyUsedCallbackPhrases?: readonly string[];
  readonly includeArchived?: boolean;
  readonly includeShadow?: boolean;
  readonly probeOnly?: boolean;
  readonly audienceHeat?: number;
}

export interface MemoryAnchorQueryResponse {
  readonly query: MemoryAnchorQuery;
  readonly matches: readonly MemoryAnchorMatch[];
  readonly ranked: ReadonlyArray<RankedMemoryAnchor>;
  readonly previews: readonly MemoryAnchorPreview[];
  readonly receipt: MemoryAnchorReceipt;
  readonly candidateIds: readonly MemoryAnchorId[];
  readonly shadowMatches: ReadonlyArray<MemoryAnchorId>;
  readonly debugNotes: readonly string[];
}

export interface MemoryAnchorStoreMetrics {
  readonly totalAnchors: number;
  readonly archivedAnchors: number;
  readonly shadowAnchors: number;
  readonly openWindows: number;
  readonly totalWindows: number;
  readonly totalReceipts: number;
  readonly relationshipEdges: number;
  readonly usedCallbacksCount: number;
  readonly anchorsByKind: Readonly<Record<string, number>>;
  readonly anchorsByRoom: Readonly<Record<string, number>>;
  readonly anchorsByChannel: Readonly<Record<string, number>>;
  readonly anchorsByRun: Readonly<Record<string, number>>;
  readonly anchorsByMode: Readonly<Record<string, number>>;
  readonly avgFinalSalience: number;
  readonly proofBoundAnchors: number;
}

export type MemoryAnchorStoreProofBindingEntry = readonly [
  MemoryAnchorId,
  AnchorProofBinding,
];

export type MemoryAnchorStoreModeAnchorIndexEntry = readonly [
  ChatModeId,
  ReadonlyArray<MemoryAnchorId>,
];

export interface MemoryAnchorStoreSnapshot {
  readonly version: typeof MEMORY_ANCHOR_STORE_VERSION;
  readonly exportedAtMs: number;
  readonly anchors: readonly MemoryAnchor[];
  readonly archivedAnchorIds: readonly MemoryAnchorId[];
  readonly windows: readonly MemoryAnchorWindow[];
  readonly receipts: readonly MemoryAnchorReceipt[];
  readonly proofBindings: ReadonlyArray<MemoryAnchorStoreProofBindingEntry>;
  readonly usedCallbackPhrases: readonly string[];
  readonly shadowAnchorIds: readonly MemoryAnchorId[];
  readonly relationshipEdges: readonly RelationshipEdge[];
  readonly modeAnchorIndex: ReadonlyArray<MemoryAnchorStoreModeAnchorIndexEntry>;
}

export interface MemoryAnchorStorePersistenceAdapter {
  load?():
    | Promise<MemoryAnchorStoreSnapshot | null>
    | MemoryAnchorStoreSnapshot
    | null;
  save?(snapshot: MemoryAnchorStoreSnapshot): Promise<void> | void;
  appendReceipt?(receipt: MemoryAnchorReceipt): Promise<void> | void;
  appendTelemetry?(payload: AnchorTelemetryPayload): Promise<void> | void;
}

export interface MemoryAnchorStoreOptions {
  readonly rankingPolicy?: MemoryRankingPolicyApi;
  readonly rankingPolicyOptions?: MemoryRankingPolicyOptions;
  readonly persistence?: MemoryAnchorStorePersistenceAdapter;
  readonly queryCandidateCap?: number;
  readonly now?: () => number;
  readonly coldStartSeeds?: readonly MemoryAnchor[];
  readonly enableShadowIndex?: boolean;
  readonly salienceDecayEnabled?: boolean;
  readonly runId?: string;
  readonly userId?: string;
  readonly sessionModeId?: ChatModeId;
}

export interface MemoryAnchorStoreApi {
  readonly version: typeof MEMORY_ANCHOR_STORE_VERSION;
  readonly rankingPolicy: MemoryRankingPolicyApi;

  hydrate(snapshot: MemoryAnchorStoreSnapshot): MemoryAnchorMutationReceipt;
  exportSnapshot(): MemoryAnchorStoreSnapshot;
  save(): Promise<void>;

  upsert(
    anchor: MemoryAnchor,
    proofBinding?: AnchorProofBinding,
  ): MemoryAnchorMutationReceipt;

  batchUpsert(request: BatchUpsertRequest): BatchUpsertResult;

  merge(
    anchorIdA: MemoryAnchorId,
    anchorIdB: MemoryAnchorId,
  ): MemoryAnchorMutationReceipt;

  get(anchorId: MemoryAnchorId): MemoryAnchor | null;
  has(anchorId: MemoryAnchorId): boolean;
  list(): readonly MemoryAnchor[];
  listShadow(): readonly MemoryAnchor[];

  archive(anchorId: MemoryAnchorId): MemoryAnchorMutationReceipt;
  reinstate(anchorId: MemoryAnchorId): MemoryAnchorMutationReceipt;
  reaffirm(
    anchorId: MemoryAnchorId,
    nowMs?: number,
  ): MemoryAnchorMutationReceipt;
  promote(anchorId: MemoryAnchorId): MemoryAnchorMutationReceipt;
  demote(anchorId: MemoryAnchorId): MemoryAnchorMutationReceipt;
  linkSuccessor(
    anchorId: MemoryAnchorId,
    successorId: MemoryAnchorId,
  ): MemoryAnchorMutationReceipt;
  bindProof(
    anchorId: MemoryAnchorId,
    binding: AnchorProofBinding,
  ): MemoryAnchorMutationReceipt;

  openWindow(seed?: MemoryAnchorWindowSeed): MemoryAnchorWindow;
  appendToWindow(
    windowId: string,
    anchorId: MemoryAnchorId,
  ): MemoryAnchorMutationReceipt;
  closeWindow(
    windowId: string,
    closedAtMs?: number,
  ): MemoryAnchorMutationReceipt;
  getWindow(windowId: string): MemoryAnchorWindow | null;
  listWindows(): readonly MemoryAnchorWindow[];

  query(request: MemoryAnchorStoreQueryRequest): MemoryAnchorQueryResponse;

  registerUsedCallback(phrase: string): void;
  isCallbackUsed(phrase: string): boolean;
  clearUsedCallbacks(): void;

  tickDecay(tickIndex: number): MemoryAnchorMutationReceipt;

  getRelationshipEdge(
    anchorIdA: MemoryAnchorId,
    anchorIdB: MemoryAnchorId,
  ): RelationshipEdge | null;
  listRelationshipEdges(anchorId: MemoryAnchorId): readonly RelationshipEdge[];

  seedColdStart(seeds: readonly MemoryAnchor[]): MemoryAnchorMutationReceipt;

  exportTelemetry(modeId?: ChatModeId): AnchorTelemetryPayload;

  metrics(): MemoryAnchorStoreMetrics;
  prune(nowMs?: number): MemoryAnchorMutationReceipt;
}

// ──────────────────────────────────────────────────────────────────────────────
// INTERNAL EXPLAINABILITY / AUDIT TYPES
// ──────────────────────────────────────────────────────────────────────────────

interface AnchorAuditState {
  readonly formedAtMs: number;
  readonly lastTouchedAtMs: number;
  readonly lastQueriedAtMs?: number;
  readonly lastReceiptId?: string;
  readonly lastRank?: number;
  readonly lastScore?: number;
  readonly lastWindowId?: string;
  readonly modeId?: ChatModeId;
  readonly audienceHeatAtFormation: number;
  readonly formationTickIndex: number;
  readonly retrievalCount: number;
  readonly decayApplications: number;
}

interface SnapshotRingEntry {
  readonly createdAtMs: number;
  readonly snapshot: MemoryAnchorStoreSnapshot;
}

interface CandidateGatherContext {
  readonly query: MemoryAnchorQuery;
  readonly request: MemoryAnchorStoreQueryRequest;
  readonly normalizedQueryTokens: readonly string[];
  readonly excludedAnchorIds: ReadonlySet<MemoryAnchorId>;
  readonly excludedFamilyIds: ReadonlySet<string>;
}

// ──────────────────────────────────────────────────────────────────────────────
// FACTORY
// ──────────────────────────────────────────────────────────────────────────────

export function createMemoryAnchorStore(
  options: MemoryAnchorStoreOptions = {},
): MemoryAnchorStoreApi {
  const rankingPolicy =
    options.rankingPolicy ??
    createMemoryRankingPolicy(options.rankingPolicyOptions);

  const anchors = new Map<MemoryAnchorId, MemoryAnchor>();
  const archivedIds = new Set<MemoryAnchorId>();
  const shadowIds = new Set<MemoryAnchorId>();

  const windows = new Map<string, MemoryAnchorWindow>();
  const windowRunIndex = new Map<string, Set<string>>();
  const windowRoomIndex = new Map<string, Set<string>>();
  const windowChannelIndex = new Map<string, Set<string>>();

  const receipts: MemoryAnchorReceipt[] = [];
  const mutationReceipts: MemoryAnchorMutationReceipt[] = [];
  const snapshots: SnapshotRingEntry[] = [];

  const proofBindings = new Map<MemoryAnchorId, AnchorProofBinding>();
  const proofHistory = new Map<MemoryAnchorId, AnchorProofBinding[]>();

  const usedCallbackPhrases = new Set<string>();
  const relationshipEdges = new Map<string, RelationshipEdge>();
  const anchorAudit = new Map<MemoryAnchorId, AnchorAuditState>();

  const familyIndex = new Map<string, Set<MemoryAnchorId>>();
  const relationshipIndex = new Map<string, Set<MemoryAnchorId>>();
  const quoteIndex = new Map<string, Set<MemoryAnchorId>>();
  const relationshipRefIndex = new Map<string, Set<MemoryAnchorId>>();
  const roomIndex = new Map<string, Set<MemoryAnchorId>>();
  const channelIndex = new Map<string, Set<MemoryAnchorId>>();
  const runIndex = new Map<string, Set<MemoryAnchorId>>();
  const sceneIndex = new Map<string, Set<MemoryAnchorId>>();
  const momentIndex = new Map<string, Set<MemoryAnchorId>>();
  const actorIndex = new Map<string, Set<MemoryAnchorId>>();
  const personaIndex = new Map<string, Set<MemoryAnchorId>>();
  const kindIndex = new Map<MemoryAnchorKind, Set<MemoryAnchorId>>();
  const tagIndex = new Map<string, Set<MemoryAnchorId>>();
  const callbackPhraseIndex = new Map<string, Set<MemoryAnchorId>>();
  const evidenceDocumentIndex = new Map<string, Set<MemoryAnchorId>>();
  const modeIndex = new Map<ChatModeId, Set<MemoryAnchorId>>();
  const shadowFamilyIndex = new Map<string, Set<MemoryAnchorId>>();

  const enableShadowIndex = options.enableShadowIndex !== false;
  const salienceDecayEnabled = options.salienceDecayEnabled !== false;

  let coldStartSeeded = false;
  let persistenceHydrated = false;

  const now = (): number => normalizeNow(options.now?.());

  if (options.coldStartSeeds?.length) {
    applySeedSet(options.coldStartSeeds, true);
  }

  const api: MemoryAnchorStoreApi = {
    version: MEMORY_ANCHOR_STORE_VERSION,
    rankingPolicy,

    hydrate(snapshot: MemoryAnchorStoreSnapshot): MemoryAnchorMutationReceipt {
      anchors.clear();
      archivedIds.clear();
      shadowIds.clear();
      windows.clear();
      windowRunIndex.clear();
      windowRoomIndex.clear();
      windowChannelIndex.clear();
      receipts.splice(0, receipts.length);
      mutationReceipts.splice(0, mutationReceipts.length);
      snapshots.splice(0, snapshots.length);
      proofBindings.clear();
      proofHistory.clear();
      usedCallbackPhrases.clear();
      relationshipEdges.clear();
      anchorAudit.clear();
      clearAllIndexes();

      for (const anchor of snapshot.anchors) {
        const frozen = freezeAnchor(anchor);
        anchors.set(frozen.id, frozen);
        addToIndexes(frozen);
        classifyShadow(frozen);
        upsertAuditForHydrate(frozen);
      }

      for (const id of snapshot.archivedAnchorIds) {
        if (anchors.has(id)) {
          archivedIds.add(id);
        }
      }

      for (const id of snapshot.shadowAnchorIds) {
        if (anchors.has(id)) {
          shadowIds.add(id);
        }
      }

      for (const window of snapshot.windows) {
        const frozenWindow = freezeWindow(window);
        windows.set(frozenWindow.id, frozenWindow);
        indexWindow(frozenWindow);
      }

      for (const receipt of snapshot.receipts.slice(-MEMORY_ANCHOR_STORE_DEFAULTS.maxReceipts)) {
        receipts.push(freezeReceipt(receipt));
      }

      for (const [anchorId, binding] of snapshot.proofBindings) {
        if (!anchors.has(anchorId)) {
          continue;
        }
        const frozenBinding = freezeProofBinding(binding);
        proofBindings.set(anchorId, frozenBinding);
        proofHistory.set(anchorId, [frozenBinding]);
      }

      for (const phrase of snapshot.usedCallbackPhrases) {
        usedCallbackPhrases.add(normalizeToken(phrase));
      }

      for (const edge of snapshot.relationshipEdges) {
        relationshipEdges.set(
          edgeKey(edge.anchorIdA, edge.anchorIdB),
          freezeRelationshipEdge(edge),
        );
      }

      for (const [modeId, anchorIds] of snapshot.modeAnchorIndex) {
        modeIndex.set(modeId, new Set(anchorIds.filter((id) => anchors.has(id))));
      }

      persistenceHydrated = true;
      pushSnapshot('hydrate');

      const receipt = createMutationReceipt({
        ok: true,
        operation: 'HYDRATE',
        created: false,
        updated: true,
        debugNotes: [
          `anchors=${anchors.size}`,
          `windows=${windows.size}`,
          `archived=${archivedIds.size}`,
          `shadow=${shadowIds.size}`,
          `proofBindings=${proofBindings.size}`,
          `receipts=${receipts.length}`,
        ],
      });
      pushMutationReceipt(receipt);
      return receipt;
    },

    exportSnapshot(): MemoryAnchorStoreSnapshot {
      const proofBindingEntries: MemoryAnchorStoreProofBindingEntry[] = [];
      for (const [anchorId, binding] of proofBindings.entries()) {
        proofBindingEntries.push(
          freezeProofBindingEntry(anchorId, binding),
        );
      }

      const modeAnchorEntries: MemoryAnchorStoreModeAnchorIndexEntry[] = [];
      for (const [modeId, ids] of modeIndex.entries()) {
        modeAnchorEntries.push(
          freezeModeAnchorIndexEntry(modeId, [...ids]),
        );
      }

      return Object.freeze({
        version: MEMORY_ANCHOR_STORE_VERSION,
        exportedAtMs: now(),
        anchors: Object.freeze([...anchors.values()]),
        archivedAnchorIds: Object.freeze([...archivedIds]),
        windows: Object.freeze([...windows.values()]),
        receipts: Object.freeze([...receipts]),
        proofBindings: Object.freeze(proofBindingEntries),
        usedCallbackPhrases: Object.freeze([...usedCallbackPhrases]),
        shadowAnchorIds: Object.freeze([...shadowIds]),
        relationshipEdges: Object.freeze([...relationshipEdges.values()]),
        modeAnchorIndex: Object.freeze(modeAnchorEntries),
      });
    },

    async save(): Promise<void> {
      const snapshot = api.exportSnapshot();
      pushSnapshot('save', snapshot);
      await options.persistence?.save?.(snapshot);
    },

    upsert(
      anchor: MemoryAnchor,
      proofBinding?: AnchorProofBinding,
    ): MemoryAnchorMutationReceipt {
      const normalizedAnchor = freezeAnchor(anchor);
      const existing = anchors.get(normalizedAnchor.id);
      const existed = Boolean(existing);

      if (existing) {
        removeFromIndexes(existing);
      }

      anchors.set(normalizedAnchor.id, normalizedAnchor);
      addToIndexes(normalizedAnchor);
      classifyShadow(normalizedAnchor);
      recordModeForAnchor(normalizedAnchor, options.sessionModeId);

      if (proofBinding) {
        bindProofInternal(normalizedAnchor.id, proofBinding);
      }

      upsertAuditForWrite(normalizedAnchor, options.sessionModeId);

      const evictReceipt = enforcePerFamilyCap(
        normalizedAnchor.continuity.familyId,
      );

      const receipt = createMutationReceipt({
        ok: true,
        operation: 'UPSERT',
        anchorId: normalizedAnchor.id,
        created: !existed,
        updated: existed,
        debugNotes: [
          `kind=${normalizedAnchor.kind}`,
          `priority=${normalizedAnchor.retrieval.priority}`,
          `family=${normalizedAnchor.continuity.familyId ?? 'none'}`,
          `shadow=${shadowIds.has(normalizedAnchor.id)}`,
          `proof=${proofBindings.has(normalizedAnchor.id)}`,
          ...(evictReceipt ? [`evicted=${evictReceipt.anchorId ?? 'none'}`] : []),
        ],
      });

      pushMutationReceipt(receipt);
      if (evictReceipt) {
        pushMutationReceipt(evictReceipt);
      }
      return receipt;
    },

    batchUpsert(request: BatchUpsertRequest): BatchUpsertResult {
      let created = 0;
      let updated = 0;
      let skipped = 0;
      let merged = 0;
      let evicted = 0;
      const resultReceipts: MemoryAnchorMutationReceipt[] = [];

      for (const anchor of request.anchors) {
        const proofBinding = request.proofBindings?.[anchor.id];
        const exists = anchors.has(anchor.id);

        if (exists && request.conflictPolicy === 'SKIP') {
          skipped += 1;
          const receipt = createMutationReceipt({
            ok: true,
            operation: 'BATCH_UPSERT',
            anchorId: anchor.id,
            created: false,
            updated: false,
            debugNotes: ['conflict=SKIP'],
          });
          resultReceipts.push(receipt);
          pushMutationReceipt(receipt);
          continue;
        }

        if (exists && request.conflictPolicy === 'MERGE') {
          const mergedAnchor = mergeAnchorRecords(
            anchors.get(anchor.id)!,
            anchor,
            now(),
          );
          const receipt = api.upsert(
            mergedAnchor,
            proofBinding ?? proofBindings.get(anchor.id),
          );
          merged += 1;
          if (receipt.debugNotes.some((note) => note.startsWith('evicted='))) {
            evicted += 1;
          }
          resultReceipts.push(
            createMutationReceipt({
              ok: true,
              operation: 'BATCH_UPSERT',
              anchorId: anchor.id,
              created: false,
              updated: true,
              debugNotes: ['conflict=MERGE'],
            }),
          );
          continue;
        }

        const receipt = api.upsert(anchor, proofBinding);
        if (receipt.created) {
          created += 1;
        } else {
          updated += 1;
        }
        if (receipt.debugNotes.some((note) => note.startsWith('evicted='))) {
          evicted += 1;
        }
        resultReceipts.push(receipt);
      }

      return Object.freeze({
        created,
        updated,
        skipped,
        merged,
        evicted,
        receipts: Object.freeze(resultReceipts),
      });
    },

    merge(
      anchorIdA: MemoryAnchorId,
      anchorIdB: MemoryAnchorId,
    ): MemoryAnchorMutationReceipt {
      if (anchorIdA === anchorIdB) {
        const receipt = createMutationReceipt({
          ok: false,
          operation: 'MERGE',
          anchorId: anchorIdA,
          created: false,
          updated: false,
          debugNotes: ['sameAnchorId=true'],
        });
        pushMutationReceipt(receipt);
        return receipt;
      }

      const anchorA = anchors.get(anchorIdA);
      const anchorB = anchors.get(anchorIdB);

      if (!anchorA || !anchorB) {
        const receipt = createMutationReceipt({
          ok: false,
          operation: 'MERGE',
          anchorId: anchorIdA,
          created: false,
          updated: false,
          debugNotes: [
            `anchorAExists=${Boolean(anchorA)}`,
            `anchorBExists=${Boolean(anchorB)}`,
          ],
        });
        pushMutationReceipt(receipt);
        return receipt;
      }

      const mergedAnchor = mergeAnchorRecords(anchorA, anchorB, now());

      removeFromIndexes(anchorA);
      removeFromIndexes(anchorB);

      anchors.set(anchorIdA, mergedAnchor);
      addToIndexes(mergedAnchor);
      classifyShadow(mergedAnchor);
      bindProofAfterMerge(anchorIdA, anchorIdB);
      archivedIds.add(anchorIdB);
      recordModeForAnchor(mergedAnchor, modeForAnchor(anchorIdA));

      const auditState = anchorAudit.get(anchorIdA);
      const otherAuditState = anchorAudit.get(anchorIdB);
      anchorAudit.set(anchorIdA, Object.freeze({
        formedAtMs: Math.min(
          auditState?.formedAtMs ?? now(),
          otherAuditState?.formedAtMs ?? now(),
        ),
        lastTouchedAtMs: now(),
        lastQueriedAtMs: auditState?.lastQueriedAtMs ?? otherAuditState?.lastQueriedAtMs,
        lastReceiptId: auditState?.lastReceiptId ?? otherAuditState?.lastReceiptId,
        lastRank: auditState?.lastRank ?? otherAuditState?.lastRank,
        lastScore: maxDefined(auditState?.lastScore, otherAuditState?.lastScore),
        lastWindowId: auditState?.lastWindowId ?? otherAuditState?.lastWindowId,
        modeId: auditState?.modeId ?? otherAuditState?.modeId ?? options.sessionModeId,
        audienceHeatAtFormation: Math.max(
          auditState?.audienceHeatAtFormation ?? 0,
          otherAuditState?.audienceHeatAtFormation ?? 0,
        ),
        formationTickIndex: Math.min(
          auditState?.formationTickIndex ?? 0,
          otherAuditState?.formationTickIndex ?? 0,
        ),
        retrievalCount:
          (auditState?.retrievalCount ?? 0) + (otherAuditState?.retrievalCount ?? 0),
        decayApplications:
          Math.max(auditState?.decayApplications ?? 0, otherAuditState?.decayApplications ?? 0),
      }));
      anchorAudit.delete(anchorIdB);

      const receipt = createMutationReceipt({
        ok: true,
        operation: 'MERGE',
        anchorId: anchorIdA,
        created: false,
        updated: true,
        debugNotes: [
          `mergedFrom=${anchorIdB}`,
          `shadow=${shadowIds.has(anchorIdA)}`,
          `proof=${proofBindings.has(anchorIdA)}`,
          `archived=${archivedIds.has(anchorIdB)}`,
        ],
      });
      pushMutationReceipt(receipt);
      return receipt;
    },

    get(anchorId: MemoryAnchorId): MemoryAnchor | null {
      return anchors.get(anchorId) ?? null;
    },

    has(anchorId: MemoryAnchorId): boolean {
      return anchors.has(anchorId);
    },

    list(): readonly MemoryAnchor[] {
      return Object.freeze([...anchors.values()]);
    },

    listShadow(): readonly MemoryAnchor[] {
      return Object.freeze(
        [...shadowIds]
          .map((id) => anchors.get(id))
          .filter((anchor): anchor is MemoryAnchor => Boolean(anchor)),
      );
    },

    archive(anchorId: MemoryAnchorId): MemoryAnchorMutationReceipt {
      if (!anchors.has(anchorId)) {
        const receipt = missingReceipt('ARCHIVE', anchorId);
        pushMutationReceipt(receipt);
        return receipt;
      }

      archivedIds.add(anchorId);
      touchAudit(anchorId, { lastTouchedAtMs: now() });

      const receipt = createMutationReceipt({
        ok: true,
        operation: 'ARCHIVE',
        anchorId,
        created: false,
        updated: true,
        debugNotes: ['archived=true'],
      });
      pushMutationReceipt(receipt);
      return receipt;
    },

    reinstate(anchorId: MemoryAnchorId): MemoryAnchorMutationReceipt {
      if (!anchors.has(anchorId)) {
        const receipt = missingReceipt('REINSTATE', anchorId);
        pushMutationReceipt(receipt);
        return receipt;
      }

      archivedIds.delete(anchorId);
      touchAudit(anchorId, { lastTouchedAtMs: now() });

      const receipt = createMutationReceipt({
        ok: true,
        operation: 'REINSTATE',
        anchorId,
        created: false,
        updated: true,
        debugNotes: ['archived=false'],
      });
      pushMutationReceipt(receipt);
      return receipt;
    },

    reaffirm(
      anchorId: MemoryAnchorId,
      explicitNowMs?: number,
    ): MemoryAnchorMutationReceipt {
      const existing = anchors.get(anchorId);
      if (!existing) {
        const receipt = missingReceipt('REAFFIRM', anchorId);
        pushMutationReceipt(receipt);
        return receipt;
      }

      const ts = normalizeNow(explicitNowMs ?? now());
      const updatedAnchor = freezeAnchor({
        ...existing,
        formation: Object.freeze({
          ...existing.formation,
          updatedAtMs: ts,
          reaffirmedAtMs: ts,
          hitCount: existing.formation.hitCount + 1,
          reaffirmCount: existing.formation.reaffirmCount + 1,
        }),
      });

      removeFromIndexes(existing);
      anchors.set(anchorId, updatedAnchor);
      addToIndexes(updatedAnchor);

      touchAudit(anchorId, { lastTouchedAtMs: ts });

      const receipt = createMutationReceipt({
        ok: true,
        operation: 'REAFFIRM',
        anchorId,
        created: false,
        updated: true,
        debugNotes: [
          `hitCount=${updatedAnchor.formation.hitCount}`,
          `reaffirmCount=${updatedAnchor.formation.reaffirmCount}`,
        ],
      });
      pushMutationReceipt(receipt);
      return receipt;
    },

    promote(anchorId: MemoryAnchorId): MemoryAnchorMutationReceipt {
      const existing = anchors.get(anchorId);
      if (!existing) {
        const receipt = missingReceipt('PROMOTE', anchorId);
        pushMutationReceipt(receipt);
        return receipt;
      }

      const promotedPriority = promotePriority(existing.retrieval.priority);
      if (promotedPriority === existing.retrieval.priority) {
        const receipt = createMutationReceipt({
          ok: true,
          operation: 'PROMOTE',
          anchorId,
          created: false,
          updated: false,
          debugNotes: ['alreadyMax=true'],
        });
        pushMutationReceipt(receipt);
        return receipt;
      }

      const updatedAnchor = freezeAnchor({
        ...existing,
        retrieval: Object.freeze({
          ...existing.retrieval,
          priority: promotedPriority,
        }),
      });

      removeFromIndexes(existing);
      anchors.set(anchorId, updatedAnchor);
      addToIndexes(updatedAnchor);
      touchAudit(anchorId, { lastTouchedAtMs: now() });

      const receipt = createMutationReceipt({
        ok: true,
        operation: 'PROMOTE',
        anchorId,
        created: false,
        updated: true,
        debugNotes: [`priority=${promotedPriority}`],
      });
      pushMutationReceipt(receipt);
      return receipt;
    },

    demote(anchorId: MemoryAnchorId): MemoryAnchorMutationReceipt {
      const existing = anchors.get(anchorId);
      if (!existing) {
        const receipt = missingReceipt('DEMOTE', anchorId);
        pushMutationReceipt(receipt);
        return receipt;
      }

      const demotedPriority = demotePriority(existing.retrieval.priority);
      if (demotedPriority === existing.retrieval.priority) {
        const receipt = createMutationReceipt({
          ok: true,
          operation: 'DEMOTE',
          anchorId,
          created: false,
          updated: false,
          debugNotes: ['alreadyMin=true'],
        });
        pushMutationReceipt(receipt);
        return receipt;
      }

      const updatedAnchor = freezeAnchor({
        ...existing,
        retrieval: Object.freeze({
          ...existing.retrieval,
          priority: demotedPriority,
        }),
      });

      removeFromIndexes(existing);
      anchors.set(anchorId, updatedAnchor);
      addToIndexes(updatedAnchor);
      touchAudit(anchorId, { lastTouchedAtMs: now() });

      const receipt = createMutationReceipt({
        ok: true,
        operation: 'DEMOTE',
        anchorId,
        created: false,
        updated: true,
        debugNotes: [`priority=${demotedPriority}`],
      });
      pushMutationReceipt(receipt);
      return receipt;
    },

    linkSuccessor(
      anchorId: MemoryAnchorId,
      successorId: MemoryAnchorId,
    ): MemoryAnchorMutationReceipt {
      const current = anchors.get(anchorId);
      const successor = anchors.get(successorId);

      if (!current || !successor) {
        const receipt = createMutationReceipt({
          ok: false,
          operation: 'LINK_SUCCESSOR',
          anchorId,
          created: false,
          updated: false,
          debugNotes: [
            `currentExists=${Boolean(current)}`,
            `successorExists=${Boolean(successor)}`,
          ],
        });
        pushMutationReceipt(receipt);
        return receipt;
      }

      const nextCurrent = freezeAnchor({
        ...current,
        continuity: Object.freeze({
          ...current.continuity,
          successorAnchorIds: mergeUnique(
            current.continuity.successorAnchorIds,
            [successorId],
          ),
        }),
      });

      const nextSuccessor = freezeAnchor({
        ...successor,
        continuity: Object.freeze({
          ...successor.continuity,
          predecessorAnchorIds: mergeUnique(
            successor.continuity.predecessorAnchorIds,
            [anchorId],
          ),
        }),
      });

      removeFromIndexes(current);
      removeFromIndexes(successor);

      anchors.set(anchorId, nextCurrent);
      anchors.set(successorId, nextSuccessor);

      addToIndexes(nextCurrent);
      addToIndexes(nextSuccessor);

      touchAudit(anchorId, { lastTouchedAtMs: now() });
      touchAudit(successorId, { lastTouchedAtMs: now() });

      const receipt = createMutationReceipt({
        ok: true,
        operation: 'LINK_SUCCESSOR',
        anchorId,
        created: false,
        updated: true,
        debugNotes: [`successor=${successorId}`],
      });
      pushMutationReceipt(receipt);
      return receipt;
    },

    bindProof(
      anchorId: MemoryAnchorId,
      binding: AnchorProofBinding,
    ): MemoryAnchorMutationReceipt {
      if (!anchors.has(anchorId)) {
        const receipt = missingReceipt('PROOF_BIND', anchorId);
        pushMutationReceipt(receipt);
        return receipt;
      }

      const existed = proofBindings.has(anchorId);
      bindProofInternal(anchorId, binding);
      touchAudit(anchorId, { lastTouchedAtMs: now() });

      const receipt = createMutationReceipt({
        ok: true,
        operation: 'PROOF_BIND',
        anchorId,
        created: !existed,
        updated: existed,
        debugNotes: [
          `proofHash=${binding.proofHash}`,
          `eventType=${binding.eventType}`,
          `history=${proofHistory.get(anchorId)?.length ?? 0}`,
        ],
      });
      pushMutationReceipt(receipt);
      return receipt;
    },

    openWindow(seed: MemoryAnchorWindowSeed = {}): MemoryAnchorWindow {
      const cappedRunWindows = getRunWindowIds(seed.runId);
      if (seed.runId && cappedRunWindows.length >= MEMORY_ANCHOR_STORE_DEFAULTS.maxWindowsPerRun) {
        evictOldestClosedWindow(seed.runId);
      }

      const window = freezeWindow({
        id: createMemoryAnchorWindowId(
          [
            seed.runId,
            seed.sceneId,
            seed.momentId,
            seed.roomId,
            seed.channelId,
            now(),
          ]
            .filter(Boolean)
            .join('_'),
        ),
        openedAtMs: now(),
        closedAtMs: undefined,
        runId: seed.runId,
        sceneId: seed.sceneId,
        momentId: seed.momentId,
        roomId: seed.roomId,
        channelId: seed.channelId,
        anchorIds: Object.freeze([]),
        dominantKinds: Object.freeze(seed.dominantKinds ?? []),
        totalFinalSalience: 0,
      });

      windows.set(window.id, window);
      indexWindow(window);

      const receipt = createMutationReceipt({
        ok: true,
        operation: 'WINDOW_OPEN',
        windowId: window.id,
        created: true,
        updated: false,
        debugNotes: [
          `runId=${seed.runId ?? 'none'}`,
          `roomId=${seed.roomId ?? 'none'}`,
          `channelId=${seed.channelId ?? 'none'}`,
          `modeId=${seed.modeId ?? 'UNKNOWN'}`,
          `audienceHeat=${round4(clampUnit(seed.audienceHeat ?? 0))}`,
        ],
      });
      pushMutationReceipt(receipt);
      return window;
    },

    appendToWindow(
      windowId: string,
      anchorId: MemoryAnchorId,
    ): MemoryAnchorMutationReceipt {
      const window = windows.get(windowId);
      const anchor = anchors.get(anchorId);

      if (!window || !anchor) {
        const receipt = createMutationReceipt({
          ok: false,
          operation: 'WINDOW_APPEND',
          anchorId,
          windowId,
          created: false,
          updated: false,
          debugNotes: [
            `windowExists=${Boolean(window)}`,
            `anchorExists=${Boolean(anchor)}`,
          ],
        });
        pushMutationReceipt(receipt);
        return receipt;
      }

      const nextAnchorIds = mergeUnique(window.anchorIds, [anchorId]).slice(
        -MEMORY_ANCHOR_STORE_DEFAULTS.maxWindowAnchors,
      );
      const dominantKinds = computeDominantKinds(nextAnchorIds);
      const nextWindow = freezeWindow({
        ...window,
        anchorIds: Object.freeze(nextAnchorIds),
        dominantKinds: Object.freeze(dominantKinds),
        totalFinalSalience: round4(sumWindowSalience(nextAnchorIds)),
      });

      windows.set(windowId, nextWindow);
      indexWindow(nextWindow);
      updateRelationshipGraph(nextAnchorIds);
      touchAudit(anchorId, {
        lastTouchedAtMs: now(),
        lastWindowId: windowId,
      });

      const receipt = createMutationReceipt({
        ok: true,
        operation: 'WINDOW_APPEND',
        anchorId,
        windowId,
        created: false,
        updated: true,
        debugNotes: [
          `windowAnchors=${nextWindow.anchorIds.length}`,
          `dominantKinds=${nextWindow.dominantKinds.join('|') || 'none'}`,
          `totalFinalSalience=${round4(nextWindow.totalFinalSalience)}`,
        ],
      });
      pushMutationReceipt(receipt);
      return receipt;
    },

    closeWindow(
      windowId: string,
      closedAtMs?: number,
    ): MemoryAnchorMutationReceipt {
      const window = windows.get(windowId);
      if (!window) {
        const receipt = createMutationReceipt({
          ok: false,
          operation: 'WINDOW_CLOSE',
          windowId,
          created: false,
          updated: false,
          debugNotes: ['windowMissing=true'],
        });
        pushMutationReceipt(receipt);
        return receipt;
      }

      const nextWindow = freezeWindow({
        ...window,
        closedAtMs: normalizeNow(closedAtMs ?? now()),
      });

      windows.set(windowId, nextWindow);

      const receipt = createMutationReceipt({
        ok: true,
        operation: 'WINDOW_CLOSE',
        windowId,
        created: false,
        updated: true,
        debugNotes: [
          `closedAtMs=${nextWindow.closedAtMs}`,
          `anchors=${nextWindow.anchorIds.length}`,
        ],
      });
      pushMutationReceipt(receipt);
      return receipt;
    },

    getWindow(windowId: string): MemoryAnchorWindow | null {
      return windows.get(windowId) ?? null;
    },

    listWindows(): readonly MemoryAnchorWindow[] {
      return Object.freeze([...windows.values()]);
    },

    query(request: MemoryAnchorStoreQueryRequest): MemoryAnchorQueryResponse {
      ensureColdStartSeeded();

      const query = normalizeQuery(request, now());
      const normalizedQueryTokens = tokenizeForQuery(request.queryText);
      const excludedAnchorIds = new Set(request.excludedAnchorIds ?? []);
      const excludedFamilyIds = new Set(
        normalizeStringList(request.excludedFamilyIds ?? []),
      );

      const candidateContext: CandidateGatherContext = Object.freeze({
        query,
        request,
        normalizedQueryTokens,
        excludedAnchorIds,
        excludedFamilyIds,
      });

      const candidateIds = gatherCandidateIds(candidateContext);
      const candidates = candidateIds.map((anchorId, index) =>
        toCandidate(
          anchorId,
          request.embeddingMatches,
          request.relationshipSignals,
          request.emotionSignals,
          request.currentTags,
          request.currentModeId,
          index,
        ),
      );

      const rankingContext = buildRankingContext(
        query,
        request,
        normalizedQueryTokens,
      );

      const rankedResult = rankingPolicy.rank(candidates, rankingContext);
      const matches = Object.freeze(rankedResult.ranked.map((entry) => entry.projection));
      const previews = Object.freeze(
        rankedResult.ranked.map((entry, index) =>
          toPreview(entry.anchor, entry.score, index + 1),
        ),
      );

      const shadowMatches = Object.freeze(
        request.includeShadow
          ? candidateIds.filter((anchorId) => shadowIds.has(anchorId)).slice(
              0,
              MEMORY_ANCHOR_STORE_DEFAULTS.maxShadowMatchesPerQuery,
            )
          : [],
      );

      const receipt = freezeReceipt({
        id: createMemoryAnchorReceiptId(
          [
            query.id,
            query.intent,
            rankedResult.returnedCount,
            rankedResult.totalCandidates,
          ].join('_'),
        ),
        queryId: query.id,
        createdAtMs: rankedResult.nowMs,
        candidateCount: rankedResult.totalCandidates,
        returnedCount: rankedResult.returnedCount,
        topAnchorIds: Object.freeze(
          rankedResult.ranked.map((entry) => entry.anchor.id),
        ),
        debugNotes: Object.freeze(
          trimDebugNotes([
            `threshold=${round4(rankedResult.thresholdScore)}`,
            `candidates=${rankedResult.totalCandidates}`,
            `returned=${rankedResult.returnedCount}`,
            `intent=${query.intent}`,
            `mode=${request.currentModeId ?? 'UNKNOWN'}`,
            `includeArchived=${Boolean(request.includeArchived)}`,
            `includeShadow=${Boolean(request.includeShadow)}`,
            `probeOnly=${Boolean(request.probeOnly)}`,
            `queryTokens=${normalizedQueryTokens.length}`,
            `shadowMatches=${shadowMatches.length}`,
          ]),
        ),
      });

      if (!request.probeOnly) {
        pushReceipt(receipt);
        updateAuditFromRanked(rankedResult.ranked, receipt.id);
      }

      return Object.freeze({
        query,
        matches,
        ranked: Object.freeze(rankedResult.ranked),
        previews,
        receipt,
        candidateIds: Object.freeze(candidateIds),
        shadowMatches,
        debugNotes: Object.freeze(
          trimDebugNotes([
            `candidateIds=${candidateIds.length}`,
            `ranked=${rankedResult.ranked.length}`,
            `probeOnly=${Boolean(request.probeOnly)}`,
            `coldStartSeeded=${coldStartSeeded}`,
          ]),
        ),
      });
    },

    registerUsedCallback(phrase: string): void {
      const normalized = normalizeToken(phrase);
      if (!normalized) {
        return;
      }

      if (
        usedCallbackPhrases.size >=
        MEMORY_ANCHOR_STORE_DEFAULTS.maxUsedCallbacksPerRun
      ) {
        const first = usedCallbackPhrases.values().next().value;
        if (first) {
          usedCallbackPhrases.delete(first);
        }
      }

      usedCallbackPhrases.add(normalized);
    },

    isCallbackUsed(phrase: string): boolean {
      return usedCallbackPhrases.has(normalizeToken(phrase));
    },

    clearUsedCallbacks(): void {
      usedCallbackPhrases.clear();
    },

    tickDecay(tickIndex: number): MemoryAnchorMutationReceipt {
      if (!salienceDecayEnabled) {
        const receipt = createMutationReceipt({
          ok: true,
          operation: 'TICK_DECAY',
          created: false,
          updated: false,
          debugNotes: ['salienceDecayEnabled=false'],
        });
        pushMutationReceipt(receipt);
        return receipt;
      }

      let decayedCount = 0;
      let autoArchived = 0;

      for (const [anchorId, anchor] of anchors.entries()) {
        if (archivedIds.has(anchorId)) {
          continue;
        }

        if (
          !(MEMORY_ANCHOR_STORE_DEFAULTS.decayEligibleStabilityClasses as readonly string[]).includes(
            anchor.stabilityClass,
          )
        ) {
          continue;
        }

        const audit = anchorAudit.get(anchorId);
        const formationTickIndex = audit?.formationTickIndex ?? 0;
        const ticksElapsed = Math.max(0, tickIndex - formationTickIndex);

        if (ticksElapsed <= 0) {
          continue;
        }

        const halfLifeTicks =
          anchor.retrieval.timeDecayHalfLifeMs && anchor.retrieval.timeDecayHalfLifeMs > 0
            ? Math.max(
                1,
                Math.floor(anchor.retrieval.timeDecayHalfLifeMs / 1_000),
              )
            : MEMORY_ANCHOR_STORE_DEFAULTS.salienceDecayHalfLifeTicks;

        const decayFactor = Math.pow(0.5, ticksElapsed / halfLifeTicks);
        const heatBonus = clampUnit(audit?.audienceHeatAtFormation ?? 0) *
          MEMORY_ANCHOR_STORE_DEFAULTS.audienceHeatBonusCap;
        const nextFinal = round4(
          Math.max(
            0,
            anchor.salience.final * decayFactor - heatBonus * (1 - decayFactor),
          ),
        );

        if (nextFinal === anchor.salience.final) {
          continue;
        }

        const nextAnchor = freezeAnchor({
          ...anchor,
          salience: Object.freeze({
            ...anchor.salience,
            final: nextFinal,
            retrieval: round4(anchor.salience.retrieval * decayFactor),
          }),
        });

        removeFromIndexes(anchor);
        anchors.set(anchorId, nextAnchor);
        addToIndexes(nextAnchor);
        decayedCount += 1;

        touchAudit(anchorId, {
          lastTouchedAtMs: now(),
          decayApplications: (audit?.decayApplications ?? 0) + 1,
        });

        if (nextFinal < MEMORY_ANCHOR_DEFAULT_MINIMUM_FINAL_SALIENCE) {
          archivedIds.add(anchorId);
          autoArchived += 1;
        }
      }

      const receipt = createMutationReceipt({
        ok: true,
        operation: 'TICK_DECAY',
        created: false,
        updated: decayedCount > 0 || autoArchived > 0,
        debugNotes: [
          `tickIndex=${tickIndex}`,
          `decayed=${decayedCount}`,
          `autoArchived=${autoArchived}`,
        ],
      });
      pushMutationReceipt(receipt);
      return receipt;
    },

    getRelationshipEdge(
      anchorIdA: MemoryAnchorId,
      anchorIdB: MemoryAnchorId,
    ): RelationshipEdge | null {
      return relationshipEdges.get(edgeKey(anchorIdA, anchorIdB)) ?? null;
    },

    listRelationshipEdges(anchorId: MemoryAnchorId): readonly RelationshipEdge[] {
      return Object.freeze(
        [...relationshipEdges.values()].filter(
          (edge) => edge.anchorIdA === anchorId || edge.anchorIdB === anchorId,
        ),
      );
    },

    seedColdStart(seeds: readonly MemoryAnchor[]): MemoryAnchorMutationReceipt {
      if (anchors.size > 0) {
        const receipt = createMutationReceipt({
          ok: false,
          operation: 'SEED_COLD_START',
          created: false,
          updated: false,
          debugNotes: ['storeNotEmpty=true'],
        });
        pushMutationReceipt(receipt);
        return receipt;
      }

      applySeedSet(seeds, false);
      coldStartSeeded = true;

      const receipt = createMutationReceipt({
        ok: true,
        operation: 'SEED_COLD_START',
        created: true,
        updated: false,
        debugNotes: [`seeded=${seeds.length}`],
      });
      pushMutationReceipt(receipt);
      return receipt;
    },

    exportTelemetry(modeId?: ChatModeId): AnchorTelemetryPayload {
      const allAnchors = [...anchors.values()];
      const avgSalience = allAnchors.length
        ? round4(
            allAnchors.reduce((sum, anchor) => sum + anchor.salience.final, 0) /
              allAnchors.length,
          )
        : 0;

      const payload: AnchorTelemetryPayload = Object.freeze({
        storeVersion: MEMORY_ANCHOR_STORE_VERSION,
        exportedAtMs: now(),
        runId: options.runId,
        userId: options.userId,
        modeId: modeId ?? options.sessionModeId,
        totalAnchors: anchors.size,
        archivedCount: archivedIds.size,
        openWindows: [...windows.values()].filter((window) => !window.closedAtMs).length,
        shadowCount: shadowIds.size,
        topKindCounts: Object.freeze(countBy(allAnchors, (anchor) => anchor.kind)),
        avgSalience,
        usedCallbacks: usedCallbackPhrases.size,
        relationshipEdgeCount: relationshipEdges.size,
      });

      void options.persistence?.appendTelemetry?.(payload);
      return payload;
    },

    metrics(): MemoryAnchorStoreMetrics {
      const allAnchors = [...anchors.values()];
      const avgFinalSalience = allAnchors.length
        ? round4(
            allAnchors.reduce((sum, anchor) => sum + anchor.salience.final, 0) /
              allAnchors.length,
          )
        : 0;

      return Object.freeze({
        totalAnchors: anchors.size,
        archivedAnchors: archivedIds.size,
        shadowAnchors: shadowIds.size,
        openWindows: [...windows.values()].filter((window) => !window.closedAtMs).length,
        totalWindows: windows.size,
        totalReceipts: receipts.length,
        relationshipEdges: relationshipEdges.size,
        usedCallbacksCount: usedCallbackPhrases.size,
        anchorsByKind: Object.freeze(countBy(allAnchors, (anchor) => anchor.kind)),
        anchorsByRoom: Object.freeze(
          countBy(allAnchors, (anchor) => anchor.subject.roomId ?? 'UNSCOPED'),
        ),
        anchorsByChannel: Object.freeze(
          countBy(allAnchors, (anchor) => anchor.subject.channelId ?? 'UNSCOPED'),
        ),
        anchorsByRun: Object.freeze(
          countBy(allAnchors, (anchor) => anchor.subject.runId ?? 'UNSCOPED'),
        ),
        anchorsByMode: Object.freeze(
          countBy(allAnchors, (anchor) => modeForAnchor(anchor.id) ?? 'UNKNOWN'),
        ),
        avgFinalSalience,
        proofBoundAnchors: proofBindings.size,
      });
    },

    prune(explicitNowMs?: number): MemoryAnchorMutationReceipt {
      const ts = normalizeNow(explicitNowMs ?? now());
      let removedArchived = 0;
      let removedWindows = 0;
      let removedEdges = 0;

      for (const anchorId of [...archivedIds]) {
        const anchor = anchors.get(anchorId);
        if (!anchor) {
          archivedIds.delete(anchorId);
          proofBindings.delete(anchorId);
          proofHistory.delete(anchorId);
          shadowIds.delete(anchorId);
          anchorAudit.delete(anchorId);
          removedArchived += 1;
          continue;
        }

        if (
          ts - anchor.formation.updatedAtMs >
          MEMORY_ANCHOR_STORE_DEFAULTS.pruneArchivedAfterMs
        ) {
          removeFromIndexes(anchor);
          anchors.delete(anchorId);
          archivedIds.delete(anchorId);
          proofBindings.delete(anchorId);
          proofHistory.delete(anchorId);
          shadowIds.delete(anchorId);
          anchorAudit.delete(anchorId);
          removedArchived += 1;
        }
      }

      for (const [windowId, window] of [...windows.entries()]) {
        if (
          window.closedAtMs &&
          ts - window.closedAtMs >
            MEMORY_ANCHOR_STORE_DEFAULTS.pruneClosedWindowsAfterMs
        ) {
          unindexWindow(window);
          windows.delete(windowId);
          removedWindows += 1;
        }
      }

      for (const [key, edge] of [...relationshipEdges.entries()]) {
        if (!anchors.has(edge.anchorIdA) || !anchors.has(edge.anchorIdB)) {
          relationshipEdges.delete(key);
          removedEdges += 1;
        }
      }

      while (receipts.length > MEMORY_ANCHOR_STORE_DEFAULTS.maxReceipts) {
        receipts.shift();
      }

      const receipt = createMutationReceipt({
        ok: true,
        operation: 'PRUNE',
        created: false,
        updated: removedArchived > 0 || removedWindows > 0 || removedEdges > 0,
        debugNotes: [
          `removedArchived=${removedArchived}`,
          `removedWindows=${removedWindows}`,
          `removedEdges=${removedEdges}`,
          `receipts=${receipts.length}`,
        ],
      });
      pushMutationReceipt(receipt);
      pushSnapshot('prune');
      return receipt;
    },
  };

  void hydrateFromPersistence();
  return Object.freeze(api);

  // ────────────────────────────────────────────────────────────────────────────
  // PRIVATE FACTORY HELPERS
  // ────────────────────────────────────────────────────────────────────────────

  async function hydrateFromPersistence(): Promise<void> {
    if (persistenceHydrated) {
      return;
    }
    const snapshot = await options.persistence?.load?.();
    if (snapshot) {
      api.hydrate(snapshot);
    } else {
      persistenceHydrated = true;
    }
  }

  function ensureColdStartSeeded(): void {
    if (coldStartSeeded || anchors.size > 0 || !options.coldStartSeeds?.length) {
      return;
    }
    applySeedSet(options.coldStartSeeds, false);
    coldStartSeeded = true;
  }

  function applySeedSet(
    seeds: readonly MemoryAnchor[],
    markAsBootSeed: boolean,
  ): void {
    for (const seed of seeds) {
      const frozen = freezeAnchor(seed);
      anchors.set(frozen.id, frozen);
      addToIndexes(frozen);
      classifyShadow(frozen);
      recordModeForAnchor(frozen, options.sessionModeId);
      anchorAudit.set(
        frozen.id,
        Object.freeze({
          formedAtMs: frozen.formation.createdAtMs,
          lastTouchedAtMs: frozen.formation.updatedAtMs,
          lastQueriedAtMs: undefined,
          lastReceiptId: undefined,
          lastRank: undefined,
          lastScore: undefined,
          lastWindowId: undefined,
          modeId: options.sessionModeId,
          audienceHeatAtFormation: 0,
          formationTickIndex: 0,
          retrievalCount: 0,
          decayApplications: 0,
        }),
      );
    }

    if (markAsBootSeed) {
      coldStartSeeded = true;
    }
  }

  function bindProofInternal(
    anchorId: MemoryAnchorId,
    binding: AnchorProofBinding,
  ): void {
    const frozenBinding = freezeProofBinding(binding);
    proofBindings.set(anchorId, frozenBinding);
    const history = proofHistory.get(anchorId) ?? [];
    const nextHistory = [...history, frozenBinding].slice(
      -MEMORY_ANCHOR_STORE_DEFAULTS.maxProofBindingsPerAnchor,
    );
    proofHistory.set(anchorId, nextHistory);
  }

  function bindProofAfterMerge(
    anchorIdA: MemoryAnchorId,
    anchorIdB: MemoryAnchorId,
  ): void {
    const mergedHistory = mergeUnique(
      proofHistory.get(anchorIdA) ?? [],
      proofHistory.get(anchorIdB) ?? [],
    ).slice(-MEMORY_ANCHOR_STORE_DEFAULTS.maxProofBindingsPerAnchor);

    if (mergedHistory.length) {
      proofHistory.set(anchorIdA, mergedHistory);
      proofBindings.set(anchorIdA, mergedHistory[mergedHistory.length - 1]);
    }

    proofBindings.delete(anchorIdB);
    proofHistory.delete(anchorIdB);
  }

  function upsertAuditForHydrate(anchor: MemoryAnchor): void {
    anchorAudit.set(
      anchor.id,
      Object.freeze({
        formedAtMs: anchor.formation.createdAtMs,
        lastTouchedAtMs: anchor.formation.updatedAtMs,
        lastQueriedAtMs: undefined,
        lastReceiptId: undefined,
        lastRank: undefined,
        lastScore: undefined,
        lastWindowId: undefined,
        modeId: options.sessionModeId,
        audienceHeatAtFormation: 0,
        formationTickIndex: 0,
        retrievalCount: 0,
        decayApplications: 0,
      }),
    );
  }

  function upsertAuditForWrite(
    anchor: MemoryAnchor,
    modeId?: ChatModeId,
  ): void {
    const existing = anchorAudit.get(anchor.id);
    anchorAudit.set(
      anchor.id,
      Object.freeze({
        formedAtMs: existing?.formedAtMs ?? anchor.formation.createdAtMs,
        lastTouchedAtMs: now(),
        lastQueriedAtMs: existing?.lastQueriedAtMs,
        lastReceiptId: existing?.lastReceiptId,
        lastRank: existing?.lastRank,
        lastScore: existing?.lastScore,
        lastWindowId: existing?.lastWindowId,
        modeId: existing?.modeId ?? modeId,
        audienceHeatAtFormation: existing?.audienceHeatAtFormation ?? 0,
        formationTickIndex: existing?.formationTickIndex ?? 0,
        retrievalCount: existing?.retrievalCount ?? 0,
        decayApplications: existing?.decayApplications ?? 0,
      }),
    );
  }

  function touchAudit(
    anchorId: MemoryAnchorId,
    patch: Partial<AnchorAuditState>,
  ): void {
    const existing = anchorAudit.get(anchorId);
    if (!existing) {
      return;
    }
    anchorAudit.set(
      anchorId,
      Object.freeze({
        ...existing,
        ...patch,
      }),
    );
  }

  function updateAuditFromRanked(
    ranked: readonly RankedMemoryAnchor[],
    receiptId: string,
  ): void {
    const ts = now();
    for (const entry of ranked) {
      const existing = anchorAudit.get(entry.anchor.id);
      if (!existing) {
        continue;
      }
      anchorAudit.set(
        entry.anchor.id,
        Object.freeze({
          ...existing,
          lastTouchedAtMs: ts,
          lastQueriedAtMs: ts,
          lastReceiptId: receiptId,
          lastRank: entry.rank,
          lastScore: round4(entry.finalScore ?? entry.score),
          retrievalCount: existing.retrievalCount + 1,
        }),
      );
    }
  }

  function recordModeForAnchor(
    anchor: MemoryAnchor,
    modeId?: ChatModeId,
  ): void {
    const resolvedModeId = modeId ?? modeForAnchor(anchor.id) ?? options.sessionModeId;
    if (!resolvedModeId) {
      return;
    }
    addIndexed(modeIndex, resolvedModeId, anchor.id);
    touchAudit(anchor.id, { modeId: resolvedModeId });
  }

  function modeForAnchor(anchorId: MemoryAnchorId): ChatModeId | undefined {
    for (const [modeId, ids] of modeIndex.entries()) {
      if (ids.has(anchorId)) {
        return modeId;
      }
    }
    return undefined;
  }

  function classifyShadow(anchor: MemoryAnchor): void {
    if (!enableShadowIndex) {
      shadowIds.delete(anchor.id);
      return;
    }

    const familyId = anchor.continuity.familyId ?? '';
    const tagSet = new Set(collectTags(anchor));
    const shadowFamily = [...MEMORY_ANCHOR_STORE_DEFAULTS.shadowFamilies].find(
      (family) =>
        familyId.includes(family) ||
        tagSet.has(normalizeToken(family)) ||
        tagSet.has(normalizeToken(family.replace('_SHADOW', ''))),
    );

    if (shadowFamily) {
      shadowIds.add(anchor.id);
      addIndexed(shadowFamilyIndex, shadowFamily, anchor.id);
    } else {
      shadowIds.delete(anchor.id);
      for (const family of MEMORY_ANCHOR_STORE_DEFAULTS.shadowFamilies) {
        removeIndexed(shadowFamilyIndex, family, anchor.id);
      }
    }
  }

  function indexWindow(window: MemoryAnchorWindow): void {
    replaceWindowIndex(windowRunIndex, window.runId, window.id);
    replaceWindowIndex(windowRoomIndex, window.roomId, window.id);
    replaceWindowIndex(windowChannelIndex, window.channelId, window.id);
  }

  function unindexWindow(window: MemoryAnchorWindow): void {
    removeWindowIndex(windowRunIndex, window.runId, window.id);
    removeWindowIndex(windowRoomIndex, window.roomId, window.id);
    removeWindowIndex(windowChannelIndex, window.channelId, window.id);
  }

  function getRunWindowIds(runId?: string): readonly string[] {
    if (!runId) {
      return Object.freeze([]);
    }
    return Object.freeze([...(windowRunIndex.get(runId) ?? new Set<string>())]);
  }

  function evictOldestClosedWindow(runId: string): void {
    const windowIds = [...(windowRunIndex.get(runId) ?? new Set<string>())];
    const candidates = windowIds
      .map((windowId) => windows.get(windowId))
      .filter((window): window is MemoryAnchorWindow => Boolean(window))
      .filter((window) => Boolean(window.closedAtMs))
      .sort(
        (left, right) =>
          (left.closedAtMs ?? left.openedAtMs) - (right.closedAtMs ?? right.openedAtMs),
      );

    const oldestClosed = candidates[0];
    if (!oldestClosed) {
      return;
    }

    unindexWindow(oldestClosed);
    windows.delete(oldestClosed.id);
  }

  function enforcePerFamilyCap(
    familyId: string | undefined,
  ): MemoryAnchorMutationReceipt | null {
    if (!familyId) {
      return null;
    }

    const familyAnchors = familyIndex.get(familyId);
    if (
      !familyAnchors ||
      familyAnchors.size <= MEMORY_ANCHOR_STORE_DEFAULTS.maxAnchorsPerFamily
    ) {
      return null;
    }

    const candidates = [...familyAnchors]
      .map((anchorId) => anchors.get(anchorId))
      .filter((anchor): anchor is MemoryAnchor => Boolean(anchor))
      .filter((anchor) => !proofBindings.has(anchor.id))
      .sort((left, right) => {
        if (left.salience.final !== right.salience.final) {
          return left.salience.final - right.salience.final;
        }
        return left.formation.updatedAtMs - right.formation.updatedAtMs;
      });

    const evictedAnchor = candidates[0];
    if (!evictedAnchor) {
      return null;
    }

    removeFromIndexes(evictedAnchor);
    anchors.delete(evictedAnchor.id);
    archivedIds.delete(evictedAnchor.id);
    shadowIds.delete(evictedAnchor.id);
    proofBindings.delete(evictedAnchor.id);
    proofHistory.delete(evictedAnchor.id);
    anchorAudit.delete(evictedAnchor.id);

    return createMutationReceipt({
      ok: true,
      operation: 'EVICT_LRU',
      anchorId: evictedAnchor.id,
      created: false,
      updated: false,
      debugNotes: [
        `family=${familyId}`,
        `finalSalience=${round4(evictedAnchor.salience.final)}`,
        `updatedAtMs=${evictedAnchor.formation.updatedAtMs}`,
      ],
    });
  }

  function addToIndexes(anchor: MemoryAnchor): void {
    addIndexed(familyIndex, anchor.continuity.familyId, anchor.id);
    addIndexed(relationshipIndex, anchor.subject.relationshipId, anchor.id);
    addIndexed(roomIndex, anchor.subject.roomId, anchor.id);
    addIndexed(channelIndex, anchor.subject.channelId, anchor.id);
    addIndexed(runIndex, anchor.subject.runId, anchor.id);
    addIndexed(sceneIndex, anchor.subject.sceneId, anchor.id);
    addIndexed(momentIndex, anchor.subject.momentId, anchor.id);
    addIndexed(actorIndex, anchor.subject.actorId, anchor.id);
    addIndexed(personaIndex, anchor.subject.actorPersonaId, anchor.id);

    if (!kindIndex.has(anchor.kind)) {
      kindIndex.set(anchor.kind, new Set());
    }
    kindIndex.get(anchor.kind)!.add(anchor.id);

    for (const quoteRef of anchor.quoteRefs) {
      addIndexed(quoteIndex, quoteRef, anchor.id);
    }

    for (const relationshipRef of anchor.relationshipRefs) {
      addIndexed(relationshipRefIndex, relationshipRef, anchor.id);
    }

    for (const evidence of anchor.evidence) {
      if (evidence.documentId) {
        addIndexed(evidenceDocumentIndex, evidence.documentId, anchor.id);
      }
    }

    for (const callbackPhrase of anchor.payload.callbackPhrases) {
      addIndexed(callbackPhraseIndex, normalizeToken(callbackPhrase), anchor.id);
    }

    for (const tag of collectTags(anchor).slice(
      0,
      MEMORY_ANCHOR_STORE_DEFAULTS.maxIndexesPerAnchor,
    )) {
      addIndexed(tagIndex, tag, anchor.id);
    }
  }

  function removeFromIndexes(anchor: MemoryAnchor): void {
    removeIndexed(familyIndex, anchor.continuity.familyId, anchor.id);
    removeIndexed(relationshipIndex, anchor.subject.relationshipId, anchor.id);
    removeIndexed(roomIndex, anchor.subject.roomId, anchor.id);
    removeIndexed(channelIndex, anchor.subject.channelId, anchor.id);
    removeIndexed(runIndex, anchor.subject.runId, anchor.id);
    removeIndexed(sceneIndex, anchor.subject.sceneId, anchor.id);
    removeIndexed(momentIndex, anchor.subject.momentId, anchor.id);
    removeIndexed(actorIndex, anchor.subject.actorId, anchor.id);
    removeIndexed(personaIndex, anchor.subject.actorPersonaId, anchor.id);

    kindIndex.get(anchor.kind)?.delete(anchor.id);
    if (!kindIndex.get(anchor.kind)?.size) {
      kindIndex.delete(anchor.kind);
    }

    for (const quoteRef of anchor.quoteRefs) {
      removeIndexed(quoteIndex, quoteRef, anchor.id);
    }

    for (const relationshipRef of anchor.relationshipRefs) {
      removeIndexed(relationshipRefIndex, relationshipRef, anchor.id);
    }

    for (const evidence of anchor.evidence) {
      if (evidence.documentId) {
        removeIndexed(evidenceDocumentIndex, evidence.documentId, anchor.id);
      }
    }

    for (const callbackPhrase of anchor.payload.callbackPhrases) {
      removeIndexed(callbackPhraseIndex, normalizeToken(callbackPhrase), anchor.id);
    }

    for (const tag of collectTags(anchor).slice(
      0,
      MEMORY_ANCHOR_STORE_DEFAULTS.maxIndexesPerAnchor,
    )) {
      removeIndexed(tagIndex, tag, anchor.id);
    }

    for (const modeIds of modeIndex.values()) {
      modeIds.delete(anchor.id);
    }

    for (const family of MEMORY_ANCHOR_STORE_DEFAULTS.shadowFamilies) {
      removeIndexed(shadowFamilyIndex, family, anchor.id);
    }
  }

  function clearAllIndexes(): void {
    clearIndexes([
      familyIndex,
      relationshipIndex,
      quoteIndex,
      relationshipRefIndex,
      roomIndex,
      channelIndex,
      runIndex,
      sceneIndex,
      momentIndex,
      actorIndex,
      personaIndex,
      kindIndex as Map<string, Set<string>>,
      tagIndex,
      callbackPhraseIndex,
      evidenceDocumentIndex,
      modeIndex as Map<string, Set<string>>,
      shadowFamilyIndex,
    ]);
  }

  function updateRelationshipGraph(anchorIds: readonly MemoryAnchorId[]): void {
    if (anchorIds.length < 2) {
      return;
    }

    const ts = now();
    const newestId = anchorIds[anchorIds.length - 1];

    for (let index = 0; index < anchorIds.length - 1; index += 1) {
      const otherId = anchorIds[index];
      const key = edgeKey(newestId, otherId);
      const existing = relationshipEdges.get(key);
      const coAppearances = (existing?.coAppearances ?? 0) + 1;

      const [sortedA, sortedB] = sortIds(newestId, otherId);
      relationshipEdges.set(
        key,
        Object.freeze({
          anchorIdA: sortedA,
          anchorIdB: sortedB,
          coAppearances,
          strengthScore: round4(
            Math.min(
              1,
              coAppearances /
                MEMORY_ANCHOR_STORE_DEFAULTS.relationshipEdgeSaturationCount,
            ),
          ),
          lastSeenAtMs: ts,
        }),
      );
    }

    while (
      relationshipEdges.size > MEMORY_ANCHOR_STORE_DEFAULTS.maxRelationshipEdges
    ) {
      const oldest = [...relationshipEdges.entries()].sort(
        (left, right) => left[1].lastSeenAtMs - right[1].lastSeenAtMs,
      )[0];
      if (!oldest) {
        break;
      }
      relationshipEdges.delete(oldest[0]);
    }
  }

  function gatherCandidateIds(
    context: CandidateGatherContext,
  ): readonly MemoryAnchorId[] {
    const { query, request, normalizedQueryTokens, excludedAnchorIds, excludedFamilyIds } =
      context;

    const candidateSet = new Set<MemoryAnchorId>();
    const buckets: Array<readonly MemoryAnchorId[]> = [];

    pushIndexedBucket(buckets, roomIndex.get(query.roomId ?? ''));
    pushIndexedBucket(buckets, channelIndex.get(query.channelId ?? ''));
    pushIndexedBucket(buckets, runIndex.get(query.runId ?? ''));
    pushIndexedBucket(buckets, sceneIndex.get(query.sceneId ?? ''));
    pushIndexedBucket(buckets, momentIndex.get(query.momentId ?? ''));
    pushIndexedBucket(buckets, actorIndex.get(query.actorId ?? ''));
    pushIndexedBucket(buckets, personaIndex.get(query.actorPersonaId ?? ''));
    pushIndexedBucket(buckets, relationshipIndex.get(query.relationshipId ?? ''));

    for (const kind of query.kinds) {
      pushIndexedBucket(buckets, kindIndex.get(kind));
    }

    for (const token of normalizedQueryTokens) {
      pushIndexedBucket(buckets, tagIndex.get(token));
      pushIndexedBucket(buckets, callbackPhraseIndex.get(token));
      pushIndexedBucket(buckets, quoteIndex.get(token));
      pushIndexedBucket(buckets, relationshipRefIndex.get(token));
      pushIndexedBucket(buckets, evidenceDocumentIndex.get(token));
    }

    for (const tag of [
      ...query.requiredTags,
      ...(request.currentTags ?? []),
      ...(request.emotionSignals ?? []),
      ...(request.relationshipSignals ?? []),
    ]) {
      pushIndexedBucket(buckets, tagIndex.get(normalizeToken(tag)));
    }

    for (const embeddingMatch of request.embeddingMatches ?? []) {
      if (embeddingMatch.documentId) {
        pushIndexedBucket(
          buckets,
          evidenceDocumentIndex.get(normalizeToken(embeddingMatch.documentId)),
        );
      }
      for (const tag of embeddingMatch.tags ?? []) {
        pushIndexedBucket(buckets, tagIndex.get(normalizeToken(tag)));
      }
    }

    if (request.currentModeId) {
      pushIndexedBucket(buckets, modeIndex.get(request.currentModeId));
    }

    if (request.includeShadow) {
      for (const shadowFamily of MEMORY_ANCHOR_STORE_DEFAULTS.shadowFamilies) {
        pushIndexedBucket(buckets, shadowFamilyIndex.get(shadowFamily));
      }
    }

    const maxBuckets = MEMORY_ANCHOR_STORE_DEFAULTS.maxCandidateBuckets;
    for (const bucket of buckets.slice(0, maxBuckets)) {
      for (const anchorId of bucket) {
        if (!passesCandidateFilters(anchorId, request, excludedAnchorIds, excludedFamilyIds)) {
          continue;
        }
        candidateSet.add(anchorId);
        if (
          candidateSet.size >=
          (request.candidateCap ??
            options.queryCandidateCap ??
            MEMORY_ANCHOR_STORE_DEFAULTS.queryCandidateCap)
        ) {
          break;
        }
      }
    }

    if (!candidateSet.size) {
      const fallback = [...anchors.values()]
        .filter((anchor) =>
          passesCandidateFilters(anchor.id, request, excludedAnchorIds, excludedFamilyIds),
        )
        .sort((left, right) => {
          if (left.retrieval.priority !== right.retrieval.priority) {
            return priorityOrdinal(right.retrieval.priority) - priorityOrdinal(left.retrieval.priority);
          }
          if (left.salience.final !== right.salience.final) {
            return right.salience.final - left.salience.final;
          }
          return right.formation.updatedAtMs - left.formation.updatedAtMs;
        })
        .slice(0, MEMORY_ANCHOR_STORE_DEFAULTS.maxCandidateExpansion)
        .map((anchor) => anchor.id);

      for (const anchorId of fallback) {
        candidateSet.add(anchorId);
      }
    }

    const cap = Math.max(
      1,
      Math.floor(
        request.candidateCap ??
          options.queryCandidateCap ??
          MEMORY_ANCHOR_STORE_DEFAULTS.queryCandidateCap,
      ),
    );

    return Object.freeze([...candidateSet].slice(0, cap));
  }

  function passesCandidateFilters(
    anchorId: MemoryAnchorId,
    request: MemoryAnchorStoreQueryRequest,
    excludedAnchorIds: ReadonlySet<MemoryAnchorId>,
    excludedFamilyIds: ReadonlySet<string>,
  ): boolean {
    const anchor = anchors.get(anchorId);
    if (!anchor) {
      return false;
    }

    if (excludedAnchorIds.has(anchorId)) {
      return false;
    }

    if (!request.includeArchived && archivedIds.has(anchorId)) {
      return false;
    }

    if (!request.includeShadow && shadowIds.has(anchorId)) {
      return false;
    }

    const familyId = normalizeToken(anchor.continuity.familyId);
    if (familyId && excludedFamilyIds.has(familyId)) {
      return false;
    }

    return true;
  }

  function buildRankingContext(
    query: MemoryAnchorQuery,
    request: MemoryAnchorStoreQueryRequest,
    normalizedQueryTokens: readonly string[],
  ): MemoryRankingContext {
    return Object.freeze({
      nowMs: now(),
      intent: query.intent,
      queryText: request.queryText,
      requiredTags: query.requiredTags,
      blockedTags: query.blockedTags,
      targetKinds: query.kinds,
      actorId: query.actorId,
      actorPersonaId: query.actorPersonaId,
      relationshipId: query.relationshipId,
      roomId: query.roomId,
      channelId: query.channelId,
      runId: query.runId,
      sceneId: query.sceneId,
      momentId: query.momentId,
      emotionSignals: request.emotionSignals,
      relationshipSignals: request.relationshipSignals,
      currentTags: mergeUnique(request.currentTags ?? [], normalizedQueryTokens),
      currentModeId: request.currentModeId,
      topK: query.topK,
      minimumScore: request.minimumScore ?? query.minimumFinalSalience,
      excludedAnchorIds: request.excludedAnchorIds,
      excludedFamilyIds: request.excludedFamilyIds,
      alreadyUsedCallbackPhrases:
        request.alreadyUsedCallbackPhrases ?? [...usedCallbackPhrases],
    });
  }

  function toCandidate(
    anchorId: MemoryAnchorId,
    embeddingMatches?: readonly MemoryRankingEmbeddingMatch[],
    relationshipSignals?: readonly string[],
    emotionSignals?: readonly string[],
    currentTags?: readonly string[],
    currentModeId?: ChatModeId,
    retrievalOrdinal?: number,
  ): MemoryRankingCandidate {
    const anchor = anchors.get(anchorId);
    if (!anchor) {
      throw new Error(`MemoryAnchorStore: missing candidate anchor ${anchorId}`);
    }

    const hasVectorMatches = Boolean(
      filterEmbeddingMatches(anchor, embeddingMatches).length,
    );

    return Object.freeze({
      anchor,
      embeddingMatches: filterEmbeddingMatches(anchor, embeddingMatches),
      relationshipSignals: relationshipSignals
        ? Object.freeze([...relationshipSignals])
        : undefined,
      emotionSignals: emotionSignals
        ? Object.freeze([...emotionSignals])
        : undefined,
      currentTags: currentTags ? Object.freeze([...currentTags]) : undefined,
      currentModeId,
      retrievalOrdinal,
      retrievalSource: hasVectorMatches ? 'HYBRID' : 'INDEX',
    });
  }

  function filterEmbeddingMatches(
    anchor: MemoryAnchor,
    embeddingMatches?: readonly MemoryRankingEmbeddingMatch[],
  ): readonly MemoryRankingEmbeddingMatch[] {
    if (!embeddingMatches?.length) {
      return Object.freeze([]);
    }

    const documentIds = new Set(
      anchor.embeddingDocumentIds.map((documentId) => normalizeToken(documentId)),
    );

    return Object.freeze(
      embeddingMatches.filter((match) => {
        const normalizedDocumentId = normalizeToken(match.documentId);
        if (normalizedDocumentId && documentIds.has(normalizedDocumentId)) {
          return true;
        }

        return (match.tags ?? []).some((tag) =>
          collectTags(anchor).includes(normalizeToken(tag)),
        );
      }),
    );
  }

  function toPreview(
    anchor: MemoryAnchor,
    score: number,
    rank: number,
  ): MemoryAnchorPreview {
    return Object.freeze({
      id: createMemoryAnchorPreviewId(`${anchor.id}_${rank}_${round4(score)}`),
      anchorId: anchor.id,
      title: anchor.payload.headline,
      subtitle: `${anchor.kind} • ${anchor.retrieval.priority} • ${anchor.stabilityClass}`,
      summary: anchor.payload.summary,
      tags: Object.freeze(collectTags(anchor).slice(0, 8)),
      finalSalience: round4(anchor.salience.final),
      retrievalPriority: anchor.retrieval.priority,
      stabilityClass: anchor.stabilityClass,
    });
  }

  function pushReceipt(receipt: MemoryAnchorReceipt): void {
    receipts.push(freezeReceipt(receipt));
    while (receipts.length > MEMORY_ANCHOR_STORE_DEFAULTS.maxReceipts) {
      receipts.shift();
    }
    void options.persistence?.appendReceipt?.(receipt);
  }

  function pushSnapshot(
    reason: 'hydrate' | 'save' | 'prune',
    providedSnapshot?: MemoryAnchorStoreSnapshot,
  ): void {
    const snapshot = providedSnapshot ?? api.exportSnapshot();
    snapshots.push(
      Object.freeze({
        createdAtMs: now(),
        snapshot,
      }),
    );
    while (snapshots.length > MEMORY_ANCHOR_STORE_DEFAULTS.maxSnapshots) {
      snapshots.shift();
    }

    if (reason === 'prune') {
      // keep snapshot ring warm after maintenance
      void reason;
    }
  }

  function pushMutationReceipt(receipt: MemoryAnchorMutationReceipt): void {
    mutationReceipts.push(receipt);
    while (mutationReceipts.length > MEMORY_ANCHOR_STORE_DEFAULTS.maxAuditEntries) {
      mutationReceipts.shift();
    }
  }

  function createMutationReceipt(
    receipt: Omit<MemoryAnchorMutationReceipt, 'debugNotes'> & {
      readonly debugNotes: readonly string[];
    },
  ): MemoryAnchorMutationReceipt {
    return Object.freeze({
      ...receipt,
      debugNotes: Object.freeze(trimDebugNotes(receipt.debugNotes)),
    });
  }

  function computeDominantKinds(
    anchorIds: readonly MemoryAnchorId[],
  ): readonly MemoryAnchorKind[] {
    const counts = new Map<MemoryAnchorKind, number>();

    for (const anchorId of anchorIds) {
      const anchor = anchors.get(anchorId);
      if (!anchor) {
        continue;
      }
      counts.set(anchor.kind, (counts.get(anchor.kind) ?? 0) + 1);
    }

    return Object.freeze(
      [...counts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 3)
        .map(([kind]) => kind),
    );
  }

  function sumWindowSalience(anchorIds: readonly MemoryAnchorId[]): number {
    return anchorIds.reduce(
      (sum, anchorId) => sum + (anchors.get(anchorId)?.salience.final ?? 0),
      0,
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// PURE HELPERS
// ──────────────────────────────────────────────────────────────────────────────

function normalizeQuery(
  request: MemoryAnchorStoreQueryRequest,
  nowMs: number,
): MemoryAnchorQuery {
  const query = request.query ?? {};

  return Object.freeze({
    id:
      query.id ??
      createMemoryAnchorQueryId(
        [
          request.intent ?? query.intent ?? 'CALLBACK',
          request.runId ?? query.runId,
          request.sceneId ?? query.sceneId,
          request.momentId ?? query.momentId,
          request.roomId ?? query.roomId,
          request.channelId ?? query.channelId,
          request.actorId ?? query.actorId,
          nowMs,
        ]
          .filter(Boolean)
          .join('_'),
      ),
    createdAtMs: query.createdAtMs ?? nowMs,
    intent: request.intent ?? query.intent ?? 'CALLBACK',
    roomId: request.roomId ?? query.roomId,
    channelId: request.channelId ?? query.channelId,
    runId: request.runId ?? query.runId,
    sceneId: request.sceneId ?? query.sceneId,
    momentId: request.momentId ?? query.momentId,
    actorId: request.actorId ?? query.actorId,
    actorPersonaId: request.actorPersonaId ?? query.actorPersonaId,
    relationshipId: request.relationshipId ?? query.relationshipId,
    kinds: Object.freeze(query.kinds ?? []),
    requiredTags: Object.freeze(
      normalizeStringList(query.requiredTags ?? request.currentTags ?? []),
    ),
    blockedTags: Object.freeze(
      normalizeStringList(query.blockedTags ?? []),
    ),
    minimumFinalSalience: clampUnit(
      request.minimumScore ??
        query.minimumFinalSalience ??
        MEMORY_ANCHOR_DEFAULT_MINIMUM_FINAL_SALIENCE,
    ),
    topK: Math.max(
      1,
      Math.floor(request.topK ?? query.topK ?? MEMORY_ANCHOR_DEFAULT_TOP_K),
    ),
  });
}

function freezeAnchor(anchor: MemoryAnchor): MemoryAnchor {
  return Object.freeze({
    ...anchor,
    evidence: Object.freeze(anchor.evidence.map((evidence) => freezeEvidence(evidence))),
    embeddingDocumentIds: Object.freeze([...anchor.embeddingDocumentIds]),
    quoteRefs: Object.freeze([...anchor.quoteRefs]),
    relationshipRefs: Object.freeze([...anchor.relationshipRefs]),
    debugNotes: Object.freeze([...anchor.debugNotes]),
    payload: Object.freeze({
      ...anchor.payload,
      tags: Object.freeze([...anchor.payload.tags]),
      emotions: Object.freeze([...anchor.payload.emotions]),
      relationshipTags: Object.freeze([...anchor.payload.relationshipTags]),
      callbackPhrases: Object.freeze([...anchor.payload.callbackPhrases]),
    }),
    continuity: Object.freeze({
      ...anchor.continuity,
      predecessorAnchorIds: Object.freeze([...anchor.continuity.predecessorAnchorIds]),
      successorAnchorIds: Object.freeze([...anchor.continuity.successorAnchorIds]),
      followPersonaIds: Object.freeze([...anchor.continuity.followPersonaIds]),
    }),
    retrieval: Object.freeze({
      ...anchor.retrieval,
      queryIntents: Object.freeze([...anchor.retrieval.queryIntents]),
      requiredTags: Object.freeze([...anchor.retrieval.requiredTags]),
      blockedTags: Object.freeze([...anchor.retrieval.blockedTags]),
      matchKinds: Object.freeze([...anchor.retrieval.matchKinds]),
    }) as MemoryAnchor['retrieval'],
  });
}

function freezeEvidence(
  evidence: MemoryAnchor['evidence'][number],
): MemoryAnchor['evidence'][number] {
  return Object.freeze({ ...evidence });
}

function freezeWindow(window: MemoryAnchorWindow): MemoryAnchorWindow {
  return Object.freeze({
    ...window,
    anchorIds: Object.freeze([...window.anchorIds]),
    dominantKinds: Object.freeze([...window.dominantKinds]),
  });
}

function freezeReceipt(receipt: MemoryAnchorReceipt): MemoryAnchorReceipt {
  return Object.freeze({
    ...receipt,
    topAnchorIds: Object.freeze([...receipt.topAnchorIds]),
    debugNotes: Object.freeze([...receipt.debugNotes]),
  });
}

function freezeRelationshipEdge(edge: RelationshipEdge): RelationshipEdge {
  return Object.freeze({ ...edge });
}

function freezeProofBinding(binding: AnchorProofBinding): AnchorProofBinding {
  return Object.freeze({ ...binding });
}

function freezeProofBindingEntry(
  anchorId: MemoryAnchorId,
  binding: AnchorProofBinding,
): MemoryAnchorStoreProofBindingEntry {
  return Object.freeze([
    anchorId,
    freezeProofBinding(binding),
  ]) as MemoryAnchorStoreProofBindingEntry;
}

function freezeModeAnchorIndexEntry(
  modeId: ChatModeId,
  anchorIds: readonly MemoryAnchorId[],
): MemoryAnchorStoreModeAnchorIndexEntry {
  return Object.freeze([
    modeId,
    Object.freeze([...anchorIds]),
  ]) as MemoryAnchorStoreModeAnchorIndexEntry;
}

function mergeAnchorRecords(
  primary: MemoryAnchor,
  incoming: MemoryAnchor,
  nowMs: number,
): MemoryAnchor {
  return freezeAnchor({
    ...primary,
    kind: incoming.kind ?? primary.kind,
    purpose: incoming.purpose ?? primary.purpose,
    stabilityClass: incoming.stabilityClass ?? primary.stabilityClass,
    retentionClass: incoming.retentionClass ?? primary.retentionClass,
    subject: Object.freeze({
      ...primary.subject,
      ...incoming.subject,
    }),
    formation: Object.freeze({
      ...primary.formation,
      ...incoming.formation,
      createdAtMs: Math.min(
        primary.formation.createdAtMs,
        incoming.formation.createdAtMs,
      ),
      updatedAtMs: nowMs,
      firstSeenAtMs: Math.min(
        primary.formation.firstSeenAtMs,
        incoming.formation.firstSeenAtMs,
      ),
      reaffirmedAtMs:
        maxDefined(
          primary.formation.reaffirmedAtMs,
          incoming.formation.reaffirmedAtMs,
        ) ?? undefined,
      hitCount: primary.formation.hitCount + incoming.formation.hitCount,
      reaffirmCount:
        primary.formation.reaffirmCount + incoming.formation.reaffirmCount,
    }),
    payload: Object.freeze({
      ...primary.payload,
      ...incoming.payload,
      headline: incoming.payload.headline || primary.payload.headline,
      summary: incoming.payload.summary || primary.payload.summary,
      canonicalText:
        incoming.payload.canonicalText || primary.payload.canonicalText,
      tags: mergeUnique(primary.payload.tags, incoming.payload.tags),
      emotions: mergeUnique(primary.payload.emotions, incoming.payload.emotions),
      relationshipTags: mergeUnique(
        primary.payload.relationshipTags,
        incoming.payload.relationshipTags,
      ),
      callbackPhrases: mergeUnique(
        primary.payload.callbackPhrases,
        incoming.payload.callbackPhrases,
      ),
    }),
    salience: Object.freeze({
      ...primary.salience,
      ...incoming.salience,
      immediate: Math.max(primary.salience.immediate, incoming.salience.immediate),
      emotional: Math.max(primary.salience.emotional, incoming.salience.emotional),
      narrative: Math.max(primary.salience.narrative, incoming.salience.narrative),
      social: Math.max(primary.salience.social, incoming.salience.social),
      relationship: Math.max(primary.salience.relationship, incoming.salience.relationship),
      comeback: Math.max(primary.salience.comeback, incoming.salience.comeback),
      collapse: Math.max(primary.salience.collapse, incoming.salience.collapse),
      rescue: Math.max(primary.salience.rescue, incoming.salience.rescue),
      prestige: Math.max(primary.salience.prestige, incoming.salience.prestige),
      retrieval: Math.max(primary.salience.retrieval, incoming.salience.retrieval),
      final: Math.max(primary.salience.final, incoming.salience.final),
    }),
    evidence: mergeUnique(primary.evidence, incoming.evidence),
    continuity: Object.freeze({
      ...primary.continuity,
      ...incoming.continuity,
      predecessorAnchorIds: mergeUnique(
        primary.continuity.predecessorAnchorIds,
        incoming.continuity.predecessorAnchorIds,
      ),
      successorAnchorIds: mergeUnique(
        primary.continuity.successorAnchorIds,
        incoming.continuity.successorAnchorIds,
      ),
      followPersonaIds: mergeUnique(
        primary.continuity.followPersonaIds,
        incoming.continuity.followPersonaIds,
      ),
      familyId: incoming.continuity.familyId ?? primary.continuity.familyId,
      carriesAcrossModes:
        primary.continuity.carriesAcrossModes ||
        incoming.continuity.carriesAcrossModes,
      carriesAcrossRuns:
        primary.continuity.carriesAcrossRuns ||
        incoming.continuity.carriesAcrossRuns,
      unresolved:
        primary.continuity.unresolved || incoming.continuity.unresolved,
    }),
    retrieval: Object.freeze({
      ...primary.retrieval,
      ...incoming.retrieval,
      queryIntents: mergeUnique(
        primary.retrieval.queryIntents,
        incoming.retrieval.queryIntents,
      ),
      requiredTags: mergeUnique(
        primary.retrieval.requiredTags,
        incoming.retrieval.requiredTags,
      ),
      blockedTags: mergeUnique(
        primary.retrieval.blockedTags,
        incoming.retrieval.blockedTags,
      ),
      matchKinds: mergeUnique(
        primary.retrieval.matchKinds,
        incoming.retrieval.matchKinds,
      ),
      weight: Math.max(primary.retrieval.weight, incoming.retrieval.weight),
      minimumScore: Math.max(
        primary.retrieval.minimumScore,
        incoming.retrieval.minimumScore,
      ),
      timeDecayHalfLifeMs:
        maxDefined(
          primary.retrieval.timeDecayHalfLifeMs,
          incoming.retrieval.timeDecayHalfLifeMs,
        ) ?? undefined,
      relationshipBoost: Math.max(
        primary.retrieval.relationshipBoost,
        incoming.retrieval.relationshipBoost,
      ),
      emotionBoost: Math.max(
        primary.retrieval.emotionBoost,
        incoming.retrieval.emotionBoost,
      ),
      continuityBoost: Math.max(
        primary.retrieval.continuityBoost,
        incoming.retrieval.continuityBoost,
      ),
    }) as MemoryAnchor['retrieval'],
    embeddingDocumentIds: mergeUnique(
      primary.embeddingDocumentIds,
      incoming.embeddingDocumentIds,
    ),
    quoteRefs: mergeUnique(primary.quoteRefs, incoming.quoteRefs),
    relationshipRefs: mergeUnique(
      primary.relationshipRefs,
      incoming.relationshipRefs,
    ),
    debugNotes: mergeUnique(primary.debugNotes, incoming.debugNotes),
  });
}

function collectTags(anchor: MemoryAnchor): readonly string[] {
  return normalizeStringList([
    ...anchor.payload.tags,
    ...anchor.payload.emotions,
    ...anchor.payload.relationshipTags,
    ...anchor.retrieval.requiredTags,
    ...anchor.quoteRefs,
    ...anchor.relationshipRefs,
    ...anchor.payload.callbackPhrases.map((phrase) => normalizeToken(phrase)),
    anchor.kind,
    anchor.retrieval.priority,
    anchor.stabilityClass,
    anchor.subject.sourceKind,
    anchor.subject.sourceId,
    anchor.subject.actorId,
    anchor.subject.actorPersonaId,
    anchor.subject.relationshipId,
    anchor.subject.quoteId,
    anchor.subject.roomId,
    anchor.subject.channelId,
    anchor.subject.runId,
    anchor.subject.sceneId,
    anchor.subject.momentId,
    anchor.continuity.familyId,
  ]);
}

function tokenizeForQuery(queryText?: string): readonly string[] {
  if (!queryText) {
    return Object.freeze([]);
  }

  const tokens = normalizeStringList(
    queryText
      .split(/[\s,.;:!?()[\]{}"']+/g)
      .map((token) => token.trim())
      .filter(Boolean),
  );

  return Object.freeze(tokens);
}

function normalizeStringList(
  values: readonly (string | undefined | null)[],
): readonly string[] {
  return Object.freeze(
    [...new Set(values.map((value) => normalizeToken(value)).filter(Boolean))],
  );
}

function normalizeToken(value: string | undefined | null): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9:_-]/g, '');
}

function mergeUnique<T>(
  left: readonly T[] | undefined,
  right: readonly T[] | undefined,
): readonly T[] {
  return Object.freeze([...(left ?? []), ...(right ?? [])].filter(uniqueFilter));
}

function uniqueFilter<T>(value: T, index: number, array: readonly T[]): boolean {
  return array.findIndex((candidate) => Object.is(candidate, value)) === index;
}

function trimDebugNotes(notes: readonly string[]): readonly string[] {
  return Object.freeze(
    notes
      .map((note) => note.trim())
      .filter(Boolean)
      .slice(0, MEMORY_ANCHOR_STORE_DEFAULTS.maxDebugNotesPerReceipt),
  );
}

function addIndexed<K extends string, V extends string>(
  index: Map<K, Set<V>>,
  key: K | undefined,
  value: V,
): void {
  if (!key) {
    return;
  }
  if (!index.has(key)) {
    index.set(key, new Set());
  }
  index.get(key)!.add(value);
}

function removeIndexed<K extends string, V extends string>(
  index: Map<K, Set<V>>,
  key: K | undefined,
  value: V,
): void {
  if (!key) {
    return;
  }
  const bucket = index.get(key);
  if (!bucket) {
    return;
  }
  bucket.delete(value);
  if (!bucket.size) {
    index.delete(key);
  }
}

function pushIndexedBucket<T extends string>(
  target: Array<readonly T[]>,
  bucket: Set<T> | undefined,
): void {
  if (!bucket?.size) {
    return;
  }
  target.push(Object.freeze([...bucket]));
}

function clearIndexes(
  indexes: readonly Map<string, Set<string>>[],
): void {
  for (const index of indexes) {
    index.clear();
  }
}

function replaceWindowIndex(
  index: Map<string, Set<string>>,
  key: string | undefined,
  windowId: string,
): void {
  if (!key) {
    return;
  }
  if (!index.has(key)) {
    index.set(key, new Set());
  }
  index.get(key)!.add(windowId);
}

function removeWindowIndex(
  index: Map<string, Set<string>>,
  key: string | undefined,
  windowId: string,
): void {
  if (!key) {
    return;
  }
  const bucket = index.get(key);
  if (!bucket) {
    return;
  }
  bucket.delete(windowId);
  if (!bucket.size) {
    index.delete(key);
  }
}

function countBy<T>(
  values: readonly T[],
  projector: (value: T) => string,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    const key = projector(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function edgeKey(
  anchorIdA: MemoryAnchorId,
  anchorIdB: MemoryAnchorId,
): string {
  const [left, right] = sortIds(anchorIdA, anchorIdB);
  return `${left}::${right}`;
}

function sortIds<T extends string>(left: T, right: T): readonly [T, T] {
  return left <= right ? [left, right] : [right, left];
}

function missingReceipt(
  operation: MemoryAnchorMutationReceipt['operation'],
  anchorId?: MemoryAnchorId,
): MemoryAnchorMutationReceipt {
  return Object.freeze({
    ok: false,
    operation,
    anchorId,
    created: false,
    updated: false,
    debugNotes: Object.freeze(['missingAnchor=true']),
  });
}

function priorityOrdinal(priority: string): number {
  switch (priority) {
    case 'CRITICAL':
      return 4;
    case 'HIGH':
      return 3;
    case 'NORMAL':
      return 2;
    case 'LOW':
      return 1;
    default:
      return 0;
  }
}

function promotePriority(priority: MemoryAnchorRetrievalPriority): MemoryAnchorRetrievalPriority {
  switch (priority) {
    case 'LOW':
      return 'MEDIUM';
    case 'MEDIUM':
      return 'HIGH';
    case 'HIGH':
      return 'CRITICAL';
    default:
      return priority;
  }
}

function demotePriority(priority: MemoryAnchorRetrievalPriority): MemoryAnchorRetrievalPriority {
  switch (priority) {
    case 'CRITICAL':
      return 'HIGH';
    case 'HIGH':
      return 'MEDIUM';
    case 'MEDIUM':
      return 'LOW';
    default:
      return priority;
  }
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function round4(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 10_000) / 10_000;
}

function normalizeNow(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return Date.now();
  }
  return Math.max(0, Math.floor(value as number));
}

function maxDefined(
  left: number | undefined,
  right: number | undefined,
): number | undefined {
  if (left === undefined && right === undefined) {
    return undefined;
  }
  return Math.max(left ?? -Infinity, right ?? -Infinity);
}
