/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT DURABLE MEMORY ANCHOR STORE
 * FILE: backend/src/game/engine/chat/intelligence/dl/MemoryAnchorStore.ts
 * VERSION: 2026.03.20-retrieval-continuity.v1
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative backend store for retrieval-backed memory anchors.
 *
 * This file owns durable anchor persistence semantics for:
 * - memorable collapses / comebacks / rescues,
 * - rivalry and relationship continuity,
 * - callback-ready quotes,
 * - emotional / social / prestige memory,
 * - run / scene / moment windows,
 * - deterministic query retrieval over stored anchors.
 *
 * It does not require a vector database.
 * It does not hard-code external infrastructure.
 * It can run in-memory, under a persistence adapter, or as a hybrid.
 *
 * Design doctrine
 * ---------------
 * - The store is truth for durable anchor state, not a speculative cache.
 * - Ranking stays delegated to MemoryRankingPolicy.
 * - Query receipts are first-class for explainability.
 * - Snapshot / restore remains deterministic for tests and migrations.
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

export const MEMORY_ANCHOR_STORE_VERSION =
  '2026.03.20-retrieval-continuity.v1' as const;

export const MEMORY_ANCHOR_STORE_DEFAULTS = Object.freeze({
  queryCandidateCap: 160,
  maxReceipts: 64,
  maxSnapshots: 8,
  maxWindowsPerRun: 64,
  maxWindowAnchors: 64,
  maxAnchorsPerFamily: 24,
  maxIndexesPerAnchor: 48,
  pruneArchivedAfterMs: 1000 * 60 * 60 * 24 * 14,
});

export interface MemoryAnchorWindowSeed {
  readonly runId?: string;
  readonly sceneId?: string;
  readonly momentId?: string;
  readonly roomId?: string;
  readonly channelId?: string;
  readonly dominantKinds?: readonly MemoryAnchorKind[];
}

export interface MemoryAnchorMutationReceipt {
  readonly ok: boolean;
  readonly operation:
    | 'UPSERT'
    | 'ARCHIVE'
    | 'REINSTATE'
    | 'REAFFIRM'
    | 'LINK_SUCCESSOR'
    | 'WINDOW_OPEN'
    | 'WINDOW_APPEND'
    | 'WINDOW_CLOSE'
    | 'HYDRATE'
    | 'PRUNE';
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
  readonly currentModeId?: string;
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
}

export interface MemoryAnchorQueryResponse {
  readonly query: MemoryAnchorQuery;
  readonly matches: readonly MemoryAnchorMatch[];
  readonly ranked: readonly RankedMemoryAnchor[];
  readonly previews: readonly MemoryAnchorPreview[];
  readonly receipt: MemoryAnchorReceipt;
  readonly candidateIds: readonly MemoryAnchorId[];
  readonly debugNotes: readonly string[];
}

export interface MemoryAnchorStoreMetrics {
  readonly totalAnchors: number;
  readonly archivedAnchors: number;
  readonly openWindows: number;
  readonly totalWindows: number;
  readonly totalReceipts: number;
  readonly anchorsByKind: Readonly<Record<string, number>>;
  readonly anchorsByRoom: Readonly<Record<string, number>>;
  readonly anchorsByChannel: Readonly<Record<string, number>>;
  readonly anchorsByRun: Readonly<Record<string, number>>;
}

export interface MemoryAnchorStoreSnapshot {
  readonly version: typeof MEMORY_ANCHOR_STORE_VERSION;
  readonly exportedAtMs: number;
  readonly anchors: readonly MemoryAnchor[];
  readonly archivedAnchorIds: readonly MemoryAnchorId[];
  readonly windows: readonly MemoryAnchorWindow[];
  readonly receipts: readonly MemoryAnchorReceipt[];
}

export interface MemoryAnchorStorePersistenceAdapter {
  load?(): Promise<MemoryAnchorStoreSnapshot | null> | MemoryAnchorStoreSnapshot | null;
  save?(snapshot: MemoryAnchorStoreSnapshot): Promise<void> | void;
  appendReceipt?(receipt: MemoryAnchorReceipt): Promise<void> | void;
}

export interface MemoryAnchorStoreOptions {
  readonly rankingPolicy?: MemoryRankingPolicyApi;
  readonly rankingPolicyOptions?: MemoryRankingPolicyOptions;
  readonly persistence?: MemoryAnchorStorePersistenceAdapter;
  readonly queryCandidateCap?: number;
  readonly now?: () => number;
}

export interface MemoryAnchorStoreApi {
  readonly version: typeof MEMORY_ANCHOR_STORE_VERSION;
  readonly rankingPolicy: MemoryRankingPolicyApi;
  hydrate(snapshot: MemoryAnchorStoreSnapshot): MemoryAnchorMutationReceipt;
  exportSnapshot(): MemoryAnchorStoreSnapshot;
  save(): Promise<void>;
  upsert(anchor: MemoryAnchor): MemoryAnchorMutationReceipt;
  get(anchorId: MemoryAnchorId): MemoryAnchor | null;
  has(anchorId: MemoryAnchorId): boolean;
  list(): readonly MemoryAnchor[];
  archive(anchorId: MemoryAnchorId): MemoryAnchorMutationReceipt;
  reinstate(anchorId: MemoryAnchorId): MemoryAnchorMutationReceipt;
  reaffirm(anchorId: MemoryAnchorId, nowMs?: number): MemoryAnchorMutationReceipt;
  linkSuccessor(
    anchorId: MemoryAnchorId,
    successorAnchorId: MemoryAnchorId,
  ): MemoryAnchorMutationReceipt;
  openWindow(seed?: MemoryAnchorWindowSeed): MemoryAnchorWindow;
  appendToWindow(windowId: string, anchorId: MemoryAnchorId): MemoryAnchorMutationReceipt;
  closeWindow(windowId: string, closedAtMs?: number): MemoryAnchorMutationReceipt;
  getWindow(windowId: string): MemoryAnchorWindow | null;
  listWindows(): readonly MemoryAnchorWindow[];
  query(request: MemoryAnchorStoreQueryRequest): MemoryAnchorQueryResponse;
  metrics(): MemoryAnchorStoreMetrics;
  prune(nowMs?: number): MemoryAnchorMutationReceipt;
}

export function createMemoryAnchorStore(
  options: MemoryAnchorStoreOptions = {},
): MemoryAnchorStoreApi {
  const rankingPolicy =
    options.rankingPolicy ??
    createMemoryRankingPolicy(options.rankingPolicyOptions);

  const anchors = new Map<MemoryAnchorId, MemoryAnchor>();
  const archivedAnchorIds = new Set<MemoryAnchorId>();
  const windows = new Map<string, MemoryAnchorWindow>();
  const receipts: MemoryAnchorReceipt[] = [];

  const familyIndex = new Map<string, Set<MemoryAnchorId>>();
  const relationshipIndex = new Map<string, Set<MemoryAnchorId>>();
  const quoteIndex = new Map<string, Set<MemoryAnchorId>>();
  const roomIndex = new Map<string, Set<MemoryAnchorId>>();
  const channelIndex = new Map<string, Set<MemoryAnchorId>>();
  const runIndex = new Map<string, Set<MemoryAnchorId>>();
  const sceneIndex = new Map<string, Set<MemoryAnchorId>>();
  const momentIndex = new Map<string, Set<MemoryAnchorId>>();
  const actorIndex = new Map<string, Set<MemoryAnchorId>>();
  const personaIndex = new Map<string, Set<MemoryAnchorId>>();
  const kindIndex = new Map<MemoryAnchorKind, Set<MemoryAnchorId>>();
  const tagIndex = new Map<string, Set<MemoryAnchorId>>();

  const now = (): number => normalizeNow(options.now?.());

  const api: MemoryAnchorStoreApi = {
    version: MEMORY_ANCHOR_STORE_VERSION,
    rankingPolicy,

    hydrate(snapshot: MemoryAnchorStoreSnapshot): MemoryAnchorMutationReceipt {
      anchors.clear();
      archivedAnchorIds.clear();
      windows.clear();
      receipts.splice(0, receipts.length);
      clearIndexes([
        familyIndex,
        relationshipIndex,
        quoteIndex,
        roomIndex,
        channelIndex,
        runIndex,
        sceneIndex,
        momentIndex,
        actorIndex,
        personaIndex,
        kindIndex,
        tagIndex,
      ]);

      for (const anchor of snapshot.anchors) {
        anchors.set(anchor.id, freezeAnchor(anchor));
        addAnchorToIndexes(anchor);
      }

      for (const archivedId of snapshot.archivedAnchorIds) {
        if (anchors.has(archivedId)) {
          archivedAnchorIds.add(archivedId);
        }
      }

      for (const window of snapshot.windows) {
        windows.set(window.id, freezeWindow(window));
      }

      for (const receipt of snapshot.receipts.slice(-MEMORY_ANCHOR_STORE_DEFAULTS.maxReceipts)) {
        receipts.push(freezeReceipt(receipt));
      }

      return Object.freeze({
        ok: true,
        operation: 'HYDRATE',
        created: false,
        updated: true,
        debugNotes: Object.freeze([
          `anchors=${snapshot.anchors.length}`,
          `windows=${snapshot.windows.length}`,
          `receipts=${snapshot.receipts.length}`,
        ]),
      });
    },

    exportSnapshot(): MemoryAnchorStoreSnapshot {
      return Object.freeze({
        version: MEMORY_ANCHOR_STORE_VERSION,
        exportedAtMs: now(),
        anchors: Object.freeze([...anchors.values()]),
        archivedAnchorIds: Object.freeze([...archivedAnchorIds.values()]),
        windows: Object.freeze([...windows.values()]),
        receipts: Object.freeze([...receipts]),
      });
    },

    async save(): Promise<void> {
      await options.persistence?.save?.(api.exportSnapshot());
    },

    upsert(anchor: MemoryAnchor): MemoryAnchorMutationReceipt {
      const normalized = freezeAnchor(anchor);
      const existed = anchors.has(anchor.id);

      if (existed) {
        removeAnchorFromIndexes(anchors.get(anchor.id)!);
      }

      anchors.set(normalized.id, normalized);
      addAnchorToIndexes(normalized);

      return Object.freeze({
        ok: true,
        operation: 'UPSERT',
        anchorId: normalized.id,
        created: !existed,
        updated: existed,
        debugNotes: Object.freeze([
          `kind=${normalized.kind}`,
          `priority=${normalized.retrieval.priority}`,
          `family=${normalized.continuity.familyId ?? 'none'}`,
        ]),
      });
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

    archive(anchorId: MemoryAnchorId): MemoryAnchorMutationReceipt {
      if (!anchors.has(anchorId)) {
        return missingReceipt('ARCHIVE', anchorId);
      }

      archivedAnchorIds.add(anchorId);
      return Object.freeze({
        ok: true,
        operation: 'ARCHIVE',
        anchorId,
        created: false,
        updated: true,
        debugNotes: Object.freeze(['archived=true']),
      });
    },

    reinstate(anchorId: MemoryAnchorId): MemoryAnchorMutationReceipt {
      if (!anchors.has(anchorId)) {
        return missingReceipt('REINSTATE', anchorId);
      }

      archivedAnchorIds.delete(anchorId);
      return Object.freeze({
        ok: true,
        operation: 'REINSTATE',
        anchorId,
        created: false,
        updated: true,
        debugNotes: Object.freeze(['archived=false']),
      });
    },

    reaffirm(anchorId: MemoryAnchorId, explicitNowMs?: number): MemoryAnchorMutationReceipt {
      const current = anchors.get(anchorId);
      if (!current) {
        return missingReceipt('REAFFIRM', anchorId);
      }

      const reaffirmed = freezeAnchor({
        ...current,
        formation: Object.freeze({
          ...current.formation,
          updatedAtMs: normalizeNow(explicitNowMs ?? now()),
          reaffirmedAtMs: normalizeNow(explicitNowMs ?? now()),
          hitCount: current.formation.hitCount + 1,
          reaffirmCount: current.formation.reaffirmCount + 1,
        }),
      });

      removeAnchorFromIndexes(current);
      anchors.set(anchorId, reaffirmed);
      addAnchorToIndexes(reaffirmed);

      return Object.freeze({
        ok: true,
        operation: 'REAFFIRM',
        anchorId,
        created: false,
        updated: true,
        debugNotes: Object.freeze([
          `reaffirmCount=${reaffirmed.formation.reaffirmCount}`,
          `hitCount=${reaffirmed.formation.hitCount}`,
        ]),
      });
    },

    linkSuccessor(
      anchorId: MemoryAnchorId,
      successorAnchorId: MemoryAnchorId,
    ): MemoryAnchorMutationReceipt {
      const current = anchors.get(anchorId);
      const successor = anchors.get(successorAnchorId);

      if (!current || !successor) {
        return Object.freeze({
          ok: false,
          operation: 'LINK_SUCCESSOR',
          anchorId,
          created: false,
          updated: false,
          debugNotes: Object.freeze([
            `anchorExists=${Boolean(current)}`,
            `successorExists=${Boolean(successor)}`,
          ]),
        });
      }

      const nextAnchor = freezeAnchor({
        ...current,
        continuity: Object.freeze({
          ...current.continuity,
          successorAnchorIds: Object.freeze(
            mergeUnique(current.continuity.successorAnchorIds, [successorAnchorId]),
          ),
        }),
      });

      const nextSuccessor = freezeAnchor({
        ...successor,
        continuity: Object.freeze({
          ...successor.continuity,
          predecessorAnchorIds: Object.freeze(
            mergeUnique(successor.continuity.predecessorAnchorIds, [anchorId]),
          ),
        }),
      });

      removeAnchorFromIndexes(current);
      removeAnchorFromIndexes(successor);
      anchors.set(nextAnchor.id, nextAnchor);
      anchors.set(nextSuccessor.id, nextSuccessor);
      addAnchorToIndexes(nextAnchor);
      addAnchorToIndexes(nextSuccessor);

      return Object.freeze({
        ok: true,
        operation: 'LINK_SUCCESSOR',
        anchorId,
        created: false,
        updated: true,
        debugNotes: Object.freeze([
          `successor=${successorAnchorId}`,
        ]),
      });
    },

    openWindow(seed: MemoryAnchorWindowSeed = {}): MemoryAnchorWindow {
      const id = createMemoryAnchorWindowId(
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
      );

      const window = freezeWindow({
        id,
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
      return window;
    },

    appendToWindow(windowId: string, anchorId: MemoryAnchorId): MemoryAnchorMutationReceipt {
      const window = windows.get(windowId);
      const anchor = anchors.get(anchorId);
      if (!window || !anchor) {
        return Object.freeze({
          ok: false,
          operation: 'WINDOW_APPEND',
          anchorId,
          windowId,
          created: false,
          updated: false,
          debugNotes: Object.freeze([
            `windowExists=${Boolean(window)}`,
            `anchorExists=${Boolean(anchor)}`,
          ]),
        });
      }

      const anchorIds = mergeUnique(window.anchorIds, [anchorId]).slice(
        -MEMORY_ANCHOR_STORE_DEFAULTS.maxWindowAnchors,
      );
      const dominantKinds = computeDominantKinds(anchorIds);
      const updated = freezeWindow({
        ...window,
        anchorIds: Object.freeze(anchorIds),
        dominantKinds: Object.freeze(dominantKinds),
        totalFinalSalience: round4(sumWindowSalience(anchorIds)),
      });

      windows.set(windowId, updated);

      return Object.freeze({
        ok: true,
        operation: 'WINDOW_APPEND',
        anchorId,
        windowId,
        created: false,
        updated: true,
        debugNotes: Object.freeze([
          `windowAnchors=${updated.anchorIds.length}`,
          `dominantKinds=${updated.dominantKinds.join('|') || 'none'}`,
        ]),
      });
    },

    closeWindow(windowId: string, explicitClosedAtMs?: number): MemoryAnchorMutationReceipt {
      const window = windows.get(windowId);
      if (!window) {
        return Object.freeze({
          ok: false,
          operation: 'WINDOW_CLOSE',
          windowId,
          created: false,
          updated: false,
          debugNotes: Object.freeze(['windowMissing']),
        });
      }

      const closed = freezeWindow({
        ...window,
        closedAtMs: normalizeNow(explicitClosedAtMs ?? now()),
      });
      windows.set(windowId, closed);

      return Object.freeze({
        ok: true,
        operation: 'WINDOW_CLOSE',
        windowId,
        created: false,
        updated: true,
        debugNotes: Object.freeze([`closedAtMs=${closed.closedAtMs}`]),
      });
    },

    getWindow(windowId: string): MemoryAnchorWindow | null {
      return windows.get(windowId) ?? null;
    },

    listWindows(): readonly MemoryAnchorWindow[] {
      return Object.freeze([...windows.values()]);
    },

    query(request: MemoryAnchorStoreQueryRequest): MemoryAnchorQueryResponse {
      const query = normalizeQuery(request, now());
      const candidateIds = gatherCandidateIds(query, request);
      const ranked = rankingPolicy.rank(
        candidateIds.map((anchorId) => toCandidate(anchorId, request.embeddingMatches)),
        createRankingContext(query, request),
      );

      const matches = Object.freeze(ranked.ranked.map((entry) => entry.projection));
      const previews = Object.freeze(
        ranked.ranked.map((entry, index) => toPreview(entry.anchor, entry.score, index + 1)),
      );
      const receipt = freezeReceipt({
        id: createMemoryAnchorReceiptId(
          `${query.id}_${query.intent}_${ranked.returnedCount}_${ranked.totalCandidates}`,
        ),
        queryId: query.id,
        createdAtMs: ranked.nowMs,
        candidateCount: ranked.totalCandidates,
        returnedCount: ranked.returnedCount,
        topAnchorIds: Object.freeze(ranked.ranked.map((entry) => entry.anchor.id)),
        debugNotes: Object.freeze([
          `threshold=${round4(ranked.thresholdScore)}`,
          `matches=${ranked.returnedCount}`,
          `intent=${query.intent}`,
        ]),
      });

      pushReceipt(receipt);

      return Object.freeze({
        query,
        matches,
        ranked: Object.freeze(ranked.ranked),
        previews,
        receipt,
        candidateIds: Object.freeze(candidateIds),
        debugNotes: Object.freeze([
          `candidateIds=${candidateIds.length}`,
          `returned=${ranked.returnedCount}`,
        ]),
      });
    },

    metrics(): MemoryAnchorStoreMetrics {
      return Object.freeze({
        totalAnchors: anchors.size,
        archivedAnchors: archivedAnchorIds.size,
        openWindows: [...windows.values()].filter((window) => !window.closedAtMs).length,
        totalWindows: windows.size,
        totalReceipts: receipts.length,
        anchorsByKind: Object.freeze(countBy([...anchors.values()], (anchor) => anchor.kind)),
        anchorsByRoom: Object.freeze(
          countBy([...anchors.values()], (anchor) => anchor.subject.roomId ?? 'UNSCOPED'),
        ),
        anchorsByChannel: Object.freeze(
          countBy([...anchors.values()], (anchor) => anchor.subject.channelId ?? 'UNSCOPED'),
        ),
        anchorsByRun: Object.freeze(
          countBy([...anchors.values()], (anchor) => anchor.subject.runId ?? 'UNSCOPED'),
        ),
      });
    },

    prune(explicitNowMs?: number): MemoryAnchorMutationReceipt {
      const currentNow = normalizeNow(explicitNowMs ?? now());
      let removedArchived = 0;

      for (const anchorId of [...archivedAnchorIds]) {
        const anchor = anchors.get(anchorId);
        if (!anchor) {
          archivedAnchorIds.delete(anchorId);
          removedArchived += 1;
          continue;
        }

        if (
          currentNow - anchor.formation.updatedAtMs >
          MEMORY_ANCHOR_STORE_DEFAULTS.pruneArchivedAfterMs
        ) {
          removeAnchorFromIndexes(anchor);
          anchors.delete(anchorId);
          archivedAnchorIds.delete(anchorId);
          removedArchived += 1;
        }
      }

      while (receipts.length > MEMORY_ANCHOR_STORE_DEFAULTS.maxReceipts) {
        receipts.shift();
      }

      return Object.freeze({
        ok: true,
        operation: 'PRUNE',
        created: false,
        updated: removedArchived > 0,
        debugNotes: Object.freeze([
          `removedArchived=${removedArchived}`,
          `receipts=${receipts.length}`,
        ]),
      });
    },
  };

  void hydrateFromPersistence();

  return Object.freeze(api);

  async function hydrateFromPersistence(): Promise<void> {
    const snapshot = await options.persistence?.load?.();
    if (snapshot) {
      api.hydrate(snapshot);
    }
  }

  function addAnchorToIndexes(anchor: MemoryAnchor): void {
    addIndexed(familyIndex, anchor.continuity.familyId, anchor.id);
    addIndexed(relationshipIndex, anchor.subject.relationshipId, anchor.id);
    addIndexed(roomIndex, anchor.subject.roomId, anchor.id);
    addIndexed(channelIndex, anchor.subject.channelId, anchor.id);
    addIndexed(runIndex, anchor.subject.runId, anchor.id);
    addIndexed(sceneIndex, anchor.subject.sceneId, anchor.id);
    addIndexed(momentIndex, anchor.subject.momentId, anchor.id);
    addIndexed(actorIndex, anchor.subject.actorId, anchor.id);
    addIndexed(personaIndex, anchor.subject.actorPersonaId, anchor.id);

    for (const quote of anchor.quoteRefs) {
      addIndexed(quoteIndex, quote, anchor.id);
    }

    if (!kindIndex.has(anchor.kind)) {
      kindIndex.set(anchor.kind, new Set());
    }
    kindIndex.get(anchor.kind)!.add(anchor.id);

    for (const tag of collectTags(anchor).slice(0, MEMORY_ANCHOR_STORE_DEFAULTS.maxIndexesPerAnchor)) {
      addIndexed(tagIndex, tag, anchor.id);
    }
  }

  function removeAnchorFromIndexes(anchor: MemoryAnchor): void {
    removeIndexed(familyIndex, anchor.continuity.familyId, anchor.id);
    removeIndexed(relationshipIndex, anchor.subject.relationshipId, anchor.id);
    removeIndexed(roomIndex, anchor.subject.roomId, anchor.id);
    removeIndexed(channelIndex, anchor.subject.channelId, anchor.id);
    removeIndexed(runIndex, anchor.subject.runId, anchor.id);
    removeIndexed(sceneIndex, anchor.subject.sceneId, anchor.id);
    removeIndexed(momentIndex, anchor.subject.momentId, anchor.id);
    removeIndexed(actorIndex, anchor.subject.actorId, anchor.id);
    removeIndexed(personaIndex, anchor.subject.actorPersonaId, anchor.id);

    for (const quote of anchor.quoteRefs) {
      removeIndexed(quoteIndex, quote, anchor.id);
    }

    kindIndex.get(anchor.kind)?.delete(anchor.id);

    for (const tag of collectTags(anchor).slice(0, MEMORY_ANCHOR_STORE_DEFAULTS.maxIndexesPerAnchor)) {
      removeIndexed(tagIndex, tag, anchor.id);
    }
  }

  function gatherCandidateIds(
    query: MemoryAnchorQuery,
    request: MemoryAnchorStoreQueryRequest,
  ): readonly MemoryAnchorId[] {
    const candidateSet = new Set<MemoryAnchorId>();
    const indexedKeys: Array<readonly MemoryAnchorId[]> = [];

    pushIndexed(indexedKeys, roomIndex.get(query.roomId ?? ''));
    pushIndexed(indexedKeys, channelIndex.get(query.channelId ?? ''));
    pushIndexed(indexedKeys, runIndex.get(query.runId ?? ''));
    pushIndexed(indexedKeys, sceneIndex.get(query.sceneId ?? ''));
    pushIndexed(indexedKeys, momentIndex.get(query.momentId ?? ''));
    pushIndexed(indexedKeys, actorIndex.get(query.actorId ?? ''));
    pushIndexed(indexedKeys, personaIndex.get(request.actorPersonaId ?? ''));
    pushIndexed(indexedKeys, relationshipIndex.get(request.relationshipId ?? ''));

    for (const kind of query.kinds) {
      pushIndexed(indexedKeys, kindIndex.get(kind));
    }

    for (const tag of [...query.requiredTags, ...(request.currentTags ?? []), ...(request.emotionSignals ?? [])]) {
      pushIndexed(indexedKeys, tagIndex.get(normalizeToken(tag)));
    }

    for (const bucket of indexedKeys) {
      for (const anchorId of bucket) {
        if (!request.includeArchived && archivedAnchorIds.has(anchorId)) {
          continue;
        }

        candidateSet.add(anchorId);
      }
    }

    if (!candidateSet.size) {
      for (const anchorId of anchors.keys()) {
        if (!request.includeArchived && archivedAnchorIds.has(anchorId)) {
          continue;
        }

        candidateSet.add(anchorId);
      }
    }

    const candidateCap = Math.max(
      1,
      Math.floor(request.candidateCap ?? options.queryCandidateCap ?? MEMORY_ANCHOR_STORE_DEFAULTS.queryCandidateCap),
    );

    return Object.freeze([...candidateSet].slice(0, candidateCap));
  }

  function createRankingContext(
    query: MemoryAnchorQuery,
    request: MemoryAnchorStoreQueryRequest,
  ): MemoryRankingContext {
    return Object.freeze({
      nowMs: now(),
      intent: query.intent,
      queryText: request.queryText,
      requiredTags: query.requiredTags,
      blockedTags: query.blockedTags,
      targetKinds: query.kinds,
      actorId: query.actorId,
      actorPersonaId: request.actorPersonaId,
      relationshipId: request.relationshipId,
      roomId: query.roomId,
      channelId: query.channelId,
      runId: query.runId,
      sceneId: query.sceneId,
      momentId: query.momentId,
      emotionSignals: request.emotionSignals,
      relationshipSignals: request.relationshipSignals,
      currentTags: request.currentTags,
      currentModeId: request.currentModeId,
      topK: query.topK,
      minimumScore: request.minimumScore ?? query.minimumFinalSalience,
      excludedAnchorIds: request.excludedAnchorIds,
      excludedFamilyIds: request.excludedFamilyIds,
      alreadyUsedCallbackPhrases: request.alreadyUsedCallbackPhrases,
    });
  }

  function toCandidate(
    anchorId: MemoryAnchorId,
    embeddingMatches?: readonly MemoryRankingEmbeddingMatch[],
  ): MemoryRankingCandidate {
    const anchor = anchors.get(anchorId);
    if (!anchor) {
      throw new Error(`MemoryAnchorStore candidate missing anchor: ${anchorId}`);
    }

    return Object.freeze({
      anchor,
      embeddingMatches: embeddingMatchesForAnchor(anchor, embeddingMatches),
      retrievalSource: embeddingMatches?.length ? 'HYBRID' : 'INDEX',
    });
  }

  function embeddingMatchesForAnchor(
    anchor: MemoryAnchor,
    embeddingMatches?: readonly MemoryRankingEmbeddingMatch[],
  ): readonly MemoryRankingEmbeddingMatch[] {
    if (!embeddingMatches?.length) {
      return Object.freeze([]);
    }

    const filtered = embeddingMatches.filter((match) => {
      if (!match.documentId) {
        return false;
      }

      return anchor.embeddingDocumentIds.includes(match.documentId);
    });

    return Object.freeze(filtered);
  }

  function toPreview(
    anchor: MemoryAnchor,
    score: number,
    rank: number,
  ): MemoryAnchorPreview {
    return Object.freeze({
      id: createMemoryAnchorPreviewId(`${anchor.id}_${rank}`),
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
    receipts.push(receipt);
    while (receipts.length > MEMORY_ANCHOR_STORE_DEFAULTS.maxReceipts) {
      receipts.shift();
    }
    void options.persistence?.appendReceipt?.(receipt);
  }

  function computeDominantKinds(anchorIds: readonly MemoryAnchorId[]): readonly MemoryAnchorKind[] {
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
    return anchorIds.reduce((sum, anchorId) => {
      const anchor = anchors.get(anchorId);
      return sum + (anchor?.salience.final ?? 0);
    }, 0);
  }
}

function normalizeQuery(
  request: MemoryAnchorStoreQueryRequest,
  nowMs: number,
): MemoryAnchorQuery {
  const base = request.query ?? {};
  return Object.freeze({
    id:
      base.id ??
      createMemoryAnchorQueryId(
        [
          request.intent ?? base.intent ?? 'CALLBACK',
          request.runId ?? base.runId,
          request.sceneId ?? base.sceneId,
          request.momentId ?? base.momentId,
          request.roomId ?? base.roomId,
          request.channelId ?? base.channelId,
          request.actorId ?? base.actorId,
          nowMs,
        ]
          .filter(Boolean)
          .join('_'),
      ),
    createdAtMs: base.createdAtMs ?? nowMs,
    intent: request.intent ?? base.intent ?? 'CALLBACK',
    roomId: request.roomId ?? base.roomId,
    channelId: request.channelId ?? base.channelId,
    runId: request.runId ?? base.runId,
    sceneId: request.sceneId ?? base.sceneId,
    momentId: request.momentId ?? base.momentId,
    actorId: request.actorId ?? base.actorId,
    actorPersonaId: request.actorPersonaId ?? base.actorPersonaId,
    relationshipId: request.relationshipId ?? base.relationshipId,
    kinds: Object.freeze(base.kinds ?? []),
    requiredTags: Object.freeze(normalizeStringList(base.requiredTags ?? request.currentTags ?? [])),
    blockedTags: Object.freeze(normalizeStringList(base.blockedTags ?? [])),
    minimumFinalSalience: clampUnit(
      request.minimumScore ??
        base.minimumFinalSalience ??
        MEMORY_ANCHOR_DEFAULT_MINIMUM_FINAL_SALIENCE,
    ),
    topK: Math.max(1, Math.floor(request.topK ?? base.topK ?? MEMORY_ANCHOR_DEFAULT_TOP_K)),
  });
}

function freezeAnchor(anchor: MemoryAnchor): MemoryAnchor {
  return Object.freeze({
    ...anchor,
    evidence: Object.freeze([...anchor.evidence]),
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
    }),
  });
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

function collectTags(anchor: MemoryAnchor): readonly string[] {
  return normalizeStringList([
    ...anchor.payload.tags,
    ...anchor.payload.emotions,
    ...anchor.payload.relationshipTags,
    ...anchor.retrieval.requiredTags,
    ...anchor.quoteRefs,
    ...anchor.relationshipRefs,
    anchor.kind,
    anchor.retrieval.priority,
    anchor.stabilityClass,
    anchor.subject.roomId,
    anchor.subject.channelId,
    anchor.subject.runId,
    anchor.subject.sceneId,
    anchor.subject.momentId,
    anchor.subject.actorId,
    anchor.subject.actorPersonaId,
    anchor.subject.relationshipId,
    anchor.continuity.familyId,
  ]);
}

function normalizeStringList(values: readonly (string | undefined | null)[]): readonly string[] {
  return Object.freeze(
    Array.from(
      new Set(
        values
          .map((value) => normalizeToken(value))
          .filter((value): value is string => Boolean(value)),
      ),
    ),
  );
}

function normalizeToken(value: string | undefined | null): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9:_-]/g, '');
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

function pushIndexed<T extends string>(
  target: Array<readonly T[]>,
  bucket: Set<T> | undefined,
): void {
  if (!bucket?.size) {
    return;
  }

  target.push(Object.freeze([...bucket.values()]));
}

function countBy<T>(values: readonly T[], projector: (value: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    const key = projector(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function clearIndexes(indexes: readonly Map<any, Set<any>>[]): void {
  for (const index of indexes) {
    index.clear();
  }
}

function normalizeNow(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value as number)) : Date.now();
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
    debugNotes: Object.freeze(['anchorMissing']),
  });
}

function mergeUnique<T>(existing: readonly T[], next: readonly T[]): readonly T[] {
  return Object.freeze(Array.from(new Set([...existing, ...next])));
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
