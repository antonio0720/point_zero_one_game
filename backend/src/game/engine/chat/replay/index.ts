/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT REPLAY ROOT BARREL + AUTHORITY
 * FILE: backend/src/game/engine/chat/replay/index.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Public backend replay authority surface for the authoritative chat lane.
 *
 * Why this file is intentionally large
 * -----------------------------------
 * In a normal codebase, replay/index.ts might be a 10-line export barrel.
 * That is not sufficient for Point Zero One.
 *
 * In this architecture, backend chat replay is not a convenience layer. It is
 * a first-class authoritative subsystem that must coordinate:
 *
 * - durable replay artifact assembly,
 * - room rebuild / repair / compaction flows,
 * - index construction for audit, transport, and after-action lookup,
 * - replay bundle recovery for witness / legend / helper / hater scenes,
 * - deterministic querying across message, event, sequence, and timestamp
 *   domains,
 * - lane readiness and manifest truth for the exact replay subtree you locked,
 * - a backend-safe surface that pzo-server and sibling backend engines can use
 *   without importing replay donor zones directly.
 *
 * This means the replay root cannot merely re-export symbols. It must also act
 * as:
 *
 * 1. the canonical backend replay manifest for the replay subtree,
 * 2. the coordinated authority bundle for assembler + index behavior,
 * 3. the integrated construction surface for “assemble + append + index”,
 * 4. the integrated repair / rebuild / compaction surface,
 * 5. the backend-safe lookup plane that transport and audit flows can consume.
 *
 * Design law
 * ----------
 * - No UI ownership.
 * - No socket ownership.
 * - No transcript invention.
 * - No donor-zone dependency hiding.
 * - No replay truth separate from transcript truth.
 * - No index truth separate from replay truth.
 * - No online intelligence bypassing proof / transcript law.
 *
 * Canonical fit in the tree you locked
 * ------------------------------------
 * backend/src/game/engine/chat/replay/
 *   index.ts
 *   ChatReplayAssembler.ts
 *   ChatReplayIndex.ts
 *
 * Replay doctrine in this lane
 * ----------------------------
 * - ChatReplayAssembler.ts authors replay artifacts from authoritative chat
 *   transcript + proof truth.
 * - ChatReplayIndex.ts builds deterministic lookup material over those
 *   artifacts.
 * - This file binds the two together into one backend/public replay surface.
 *
 * What this file does not do
 * --------------------------
 * - It does not own sockets.
 * - It does not own transport fanout.
 * - It does not decide moderation.
 * - It does not mutate transcript text directly.
 * - It does not supersede ChatEngine.ts.
 *
 * What this file does do
 * ----------------------
 * - It exports the paired replay modules.
 * - It declares the replay lane manifest and readiness surface.
 * - It provides a combined replay authority runtime.
 * - It exposes integrated convenience flows that remain faithful to the paired
 *   replay modules rather than flattening them into generic helpers.
 * ============================================================================
 */

import {
  batchAssembleAndAppend,
  batchMultiRoom,
  buildAssemblerAuditReport,
  buildAssemblerStatsSummary,
  buildSceneBeats,
  buildWitnessLines,
  bundleContainsLegendMoment,
  bundleExposureClass,
  classifyAnchorQuality,
  computeAssemblerDiff,
  createChatReplayAssembler,
  createChatReplayAssemblerFromProfile,
  createReplayArtifact,
  estimateBundleDensity,
  scoreBundleRelevance,
  summarizeBundleWitnesses,
  ChatReplayAssemblerModule,
  type ChatReplayAppendResult,
  type ChatReplayArtifactEnvelope,
  type ChatReplayAssemblerApi,
  type ChatReplayAssemblerDiff,
  type ChatReplayAssemblerOptions,
  type ChatReplayAssemblerProfile,
  type ChatReplayAssemblerStatsSummary,
  type ChatReplayAssemblyReason,
  type ChatReplayAssemblyRequest,
  type ChatReplayBatchAssemblyRequest,
  type ChatReplayBatchAssemblyResult,
  type ChatReplayBundle,
  type ChatReplayBundleScore,
  type ChatReplayCoverageReport,
  type ChatReplayMultiRoomBatchRequest,
  type ChatReplayMultiRoomBatchResult,
  type ChatReplayResolvedAnchor,
  type ChatReplayRoomCompactionResult,
  type ChatReplayRoomRebuildResult,
  type ChatReplaySceneBeat,
  type ChatReplayWitnessLine,
} from './ChatReplayAssembler';
import {
  batchSearchReplayIndex,
  buildIndexAuditReport,
  buildIndexStatsSummary,
  buildReplayDiagnostics,
  buildReplayGlobalIndex,
  buildReplayLabelTaxonomy,
  buildReplayRoomIndex,
  buildSceneFrequencyReport,
  computeIndexDiff,
  createChatReplayIndex,
  createChatReplayIndexFromProfile,
  filterIndexByLegend,
  filterIndexByProofCoverage,
  filterIndexBySceneClass,
  scoreRoomProofCoverage,
  sortIndexByRelevance,
  ChatReplayIndexModule,
  type ChatReplayBatchSearchRequest,
  type ChatReplayBatchSearchResult,
  type ChatReplayGlobalIndex,
  type ChatReplayIndexApi,
  type ChatReplayIndexAuditReport,
  type ChatReplayIndexBuildOptions,
  type ChatReplayIndexConfig,
  type ChatReplayIndexDiagnostics,
  type ChatReplayIndexDiff,
  type ChatReplayIndexProfile,
  type ChatReplayIndexStatsSummary,
  type ChatReplayLabelTaxonomy,
  type ChatReplayProofCoverageScore,
  type ChatReplayRangeQuery,
  type ChatReplayRoomIndex,
  type ChatReplayRoomIndexEntry,
  type ChatReplaySceneFrequency,
  type ChatReplaySearchHit,
  type ChatReplaySearchRequest,
} from './ChatReplayIndex';

export * from './ChatReplayAssembler';
export * from './ChatReplayIndex';

// ============================================================================
// MARK: Lane manifest + readiness
// ============================================================================

export type ChatReplayLaneModuleId =
  | 'backend/src/game/engine/chat/replay/index.ts'
  | 'backend/src/game/engine/chat/replay/ChatReplayAssembler.ts'
  | 'backend/src/game/engine/chat/replay/ChatReplayIndex.ts';

export type ChatReplayLaneModuleRole =
  | 'ROOT_AUTHORITY'
  | 'ASSEMBLY_AUTHORITY'
  | 'INDEX_AUTHORITY';

export type ChatReplayLaneReadiness =
  | 'GENERATED'
  | 'PENDING'
  | 'DONOR_REFERENCE'
  | 'PHASE_2'
  | 'PHASE_3';

export interface ChatReplayLaneModuleManifest {
  readonly id: ChatReplayLaneModuleId;
  readonly role: ChatReplayLaneModuleRole;
  readonly readiness: ChatReplayLaneReadiness;
  readonly owner: 'BACKEND_CHAT_REPLAY';
  readonly description: string;
  readonly dependsOn: readonly ChatReplayLaneModuleId[];
}

export interface ChatReplayLaneManifest {
  readonly lane: 'backend/src/game/engine/chat/replay';
  readonly canonicalTree: readonly ChatReplayLaneModuleId[];
  readonly modules: readonly ChatReplayLaneModuleManifest[];
  readonly doctrine: readonly string[];
}

export const CHAT_REPLAY_LANE_CANONICAL_TREE = [
  'backend/src/game/engine/chat/replay/index.ts',
  'backend/src/game/engine/chat/replay/ChatReplayAssembler.ts',
  'backend/src/game/engine/chat/replay/ChatReplayIndex.ts',
] as const satisfies readonly ChatReplayLaneModuleId[];

export const CHAT_REPLAY_LANE_MODULES = [
  {
    id: 'backend/src/game/engine/chat/replay/index.ts',
    role: 'ROOT_AUTHORITY',
    readiness: 'GENERATED',
    owner: 'BACKEND_CHAT_REPLAY',
    description:
      'Canonical backend replay root barrel + authority bundle that composes assembler and index behavior without flattening replay law.',
    dependsOn: [
      'backend/src/game/engine/chat/replay/ChatReplayAssembler.ts',
      'backend/src/game/engine/chat/replay/ChatReplayIndex.ts',
    ],
  },
  {
    id: 'backend/src/game/engine/chat/replay/ChatReplayAssembler.ts',
    role: 'ASSEMBLY_AUTHORITY',
    readiness: 'GENERATED',
    owner: 'BACKEND_CHAT_REPLAY',
    description:
      'Replay artifact assembly, append, repair, rebuild, compaction, witness, scene-beat, and coverage authority over authoritative backend chat truth.',
    dependsOn: [
      'backend/src/game/engine/chat/replay/ChatReplayAssembler.ts',
    ],
  },
  {
    id: 'backend/src/game/engine/chat/replay/ChatReplayIndex.ts',
    role: 'INDEX_AUTHORITY',
    readiness: 'GENERATED',
    owner: 'BACKEND_CHAT_REPLAY',
    description:
      'Replay lookup, room/global indexing, search, range query, nearest-sequence, and diagnostics authority over replay artifacts.',
    dependsOn: [
      'backend/src/game/engine/chat/replay/ChatReplayAssembler.ts',
      'backend/src/game/engine/chat/replay/ChatReplayIndex.ts',
    ],
  },
] as const satisfies readonly ChatReplayLaneModuleManifest[];

export const CHAT_REPLAY_LANE_DOCTRINE = [
  'Replay is a backend product built from authoritative transcript and proof truth.',
  'Replay index is a deterministic view over replay artifacts, not a second truth store.',
  'This root surface may compose flows, but it must not invent transcript or proof material.',
  'Server transport may consume this lane, but socket ownership remains outside the replay subtree.',
  'Frontend replay may mirror later, but backend replay artifact identity remains authoritative here.',
] as const;

export const CHAT_REPLAY_LANE_MANIFEST: ChatReplayLaneManifest = {
  lane: 'backend/src/game/engine/chat/replay',
  canonicalTree: CHAT_REPLAY_LANE_CANONICAL_TREE,
  modules: CHAT_REPLAY_LANE_MODULES,
  doctrine: CHAT_REPLAY_LANE_DOCTRINE,
};

export function getChatReplayLaneManifest(): ChatReplayLaneManifest {
  return CHAT_REPLAY_LANE_MANIFEST;
}

export function getChatReplayLaneModule(
  id: ChatReplayLaneModuleId,
): ChatReplayLaneModuleManifest {
  const found = CHAT_REPLAY_LANE_MODULES.find((module) => module.id === id);
  if (!found) {
    throw new Error(`Unknown chat replay lane module: ${String(id)}`);
  }
  return found;
}

// ============================================================================
// MARK: Derived lane types
// ============================================================================

export type ChatReplayLaneState = Parameters<
  ChatReplayAssemblerApi['assemble']
>[0];

export type ChatReplayLaneRoomId = Parameters<
  ChatReplayAssemblerApi['assembleBundleByReplayId']
>[1];

export type ChatReplayLaneReplayId = Parameters<
  ChatReplayAssemblerApi['assembleBundleByReplayId']
>[2];

export type ChatReplayLaneMessageId = Parameters<
  ChatReplayAssemblerApi['assembleBundleAroundMessage']
>[2];

export type ChatReplayLaneSequenceNumber = Parameters<
  ChatReplayAssemblerApi['assembleBundleAroundSequence']
>[2];

export type ChatReplayLaneEventId = Parameters<
  ChatReplayIndexApi['findByEventId']
>[2];

export type ChatReplayLaneAnchorKey = Parameters<
  ChatReplayIndexApi['findByAnchorKey']
>[2];

// ============================================================================
// MARK: Lane config + snapshots
// ============================================================================

export interface ChatReplayLaneConfig {
  readonly assembler?: ChatReplayAssemblerOptions;
  readonly index?: ChatReplayIndexConfig;
  readonly defaultBuildOptions?: ChatReplayIndexBuildOptions;
  readonly includeTranscriptMaterialByDefault?: boolean;
  readonly includeProofMaterialByDefault?: boolean;
  readonly eagerGlobalDiagnostics?: boolean;
  readonly eagerRoomIndexes?: readonly ChatReplayLaneRoomId[];
}

export interface ChatReplayLaneStateSummary {
  readonly roomCount: number;
  readonly replayArtifactCount: number;
  readonly replayRoomCount: number;
}

export interface ChatReplayLaneSnapshot {
  readonly manifest: ChatReplayLaneManifest;
  readonly stateSummary: ChatReplayLaneStateSummary;
  readonly globalIndex: ChatReplayGlobalIndex;
  readonly diagnostics: ChatReplayIndexDiagnostics;
}

export interface ChatReplayAssemblyAndIndexResult {
  readonly append: ChatReplayAppendResult | null;
  readonly roomIndex: ChatReplayRoomIndex | null;
  readonly globalIndex: ChatReplayGlobalIndex;
}

export interface ChatReplayRepairAndIndexResult {
  readonly rebuild: ChatReplayRoomRebuildResult;
  readonly roomIndex: ChatReplayRoomIndex | null;
  readonly globalIndex: ChatReplayGlobalIndex;
}

export interface ChatReplayCompactionAndIndexResult {
  readonly compaction: ChatReplayRoomCompactionResult;
  readonly roomIndex: ChatReplayRoomIndex | null;
  readonly globalIndex: ChatReplayGlobalIndex;
}

export interface ChatReplayLaneApi {
  readonly manifest: ChatReplayLaneManifest;
  readonly assembler: ChatReplayAssemblerApi;
  readonly index: ChatReplayIndexApi;
  readonly config: Readonly<Required<Pick<ChatReplayLaneConfig, 'includeTranscriptMaterialByDefault' | 'includeProofMaterialByDefault' | 'eagerGlobalDiagnostics'>>> & {
    readonly defaultBuildOptions: ChatReplayIndexBuildOptions;
    readonly indexConfig: ChatReplayIndexConfig;
  };

  summarizeState(state: ChatReplayLaneState): ChatReplayLaneStateSummary;
  snapshot(state: ChatReplayLaneState): ChatReplayLaneSnapshot;

  buildGlobalIndex(
    state: ChatReplayLaneState,
    options?: ChatReplayIndexBuildOptions,
  ): ChatReplayGlobalIndex;
  buildRoomIndex(
    state: ChatReplayLaneState,
    roomId: ChatReplayLaneRoomId,
    options?: ChatReplayIndexBuildOptions,
  ): ChatReplayRoomIndex;
  diagnostics(state: ChatReplayLaneState): ChatReplayIndexDiagnostics;

  resolveAnchor(
    state: ChatReplayLaneState,
    request: ChatReplayAssemblyRequest,
  ): ChatReplayResolvedAnchor;
  assemble(
    state: ChatReplayLaneState,
    request: ChatReplayAssemblyRequest,
  ): ChatReplayArtifactEnvelope | null;
  append(
    state: ChatReplayLaneState,
    envelope: ChatReplayArtifactEnvelope,
  ): ChatReplayAppendResult;
  assembleAndAppend(
    state: ChatReplayLaneState,
    request: ChatReplayAssemblyRequest,
  ): ChatReplayAppendResult | null;
  assembleAppendAndIndex(
    state: ChatReplayLaneState,
    request: ChatReplayAssemblyRequest,
  ): ChatReplayAssemblyAndIndexResult;

  assembleBundleByReplayId(
    state: ChatReplayLaneState,
    roomId: ChatReplayLaneRoomId,
    replayId: ChatReplayLaneReplayId,
  ): ChatReplayBundle | null;
  assembleBundleAroundMessage(
    state: ChatReplayLaneState,
    roomId: ChatReplayLaneRoomId,
    messageId: ChatReplayLaneMessageId,
    label?: string,
  ): ChatReplayBundle | null;
  assembleBundleAroundSequence(
    state: ChatReplayLaneState,
    roomId: ChatReplayLaneRoomId,
    sequenceNumber: ChatReplayLaneSequenceNumber,
    label?: string,
  ): ChatReplayBundle | null;

  createArtifact(
    state: ChatReplayLaneState,
    request: ChatReplayAssemblyRequest,
  ): ReturnType<typeof createReplayArtifact> | null;
  buildSceneBeatsForBundle(bundle: ChatReplayBundle): readonly ChatReplaySceneBeat[];
  buildWitnessLinesForBundle(
    bundle: ChatReplayBundle,
  ): readonly ChatReplayWitnessLine[];

  verifyRoom(
    state: ChatReplayLaneState,
    roomId: ChatReplayLaneRoomId,
  ): ChatReplayCoverageReport;
  repairRoom(
    state: ChatReplayLaneState,
    roomId: ChatReplayLaneRoomId,
  ): ChatReplayRoomRebuildResult;
  rebuildRoom(
    state: ChatReplayLaneState,
    roomId: ChatReplayLaneRoomId,
  ): ChatReplayRoomRebuildResult;
  compactRoom(
    state: ChatReplayLaneState,
    roomId: ChatReplayLaneRoomId,
  ): ChatReplayRoomCompactionResult;
  repairRoomAndIndex(
    state: ChatReplayLaneState,
    roomId: ChatReplayLaneRoomId,
  ): ChatReplayRepairAndIndexResult;
  rebuildRoomAndIndex(
    state: ChatReplayLaneState,
    roomId: ChatReplayLaneRoomId,
  ): ChatReplayRepairAndIndexResult;
  compactRoomAndIndex(
    state: ChatReplayLaneState,
    roomId: ChatReplayLaneRoomId,
  ): ChatReplayCompactionAndIndexResult;

  findReplay(
    state: ChatReplayLaneState,
    roomId: ChatReplayLaneRoomId,
    replayId: ChatReplayLaneReplayId,
  ): ChatReplayRoomIndexEntry | null;
  findByAnchorKey(
    state: ChatReplayLaneState,
    roomId: ChatReplayLaneRoomId,
    anchorKey: ChatReplayLaneAnchorKey,
  ): readonly ChatReplayRoomIndexEntry[];
  findByEventId(
    state: ChatReplayLaneState,
    roomId: ChatReplayLaneRoomId,
    eventId: ChatReplayLaneEventId,
  ): readonly ChatReplayRoomIndexEntry[];
  findContainingMessage(
    state: ChatReplayLaneState,
    roomId: ChatReplayLaneRoomId,
    messageId: ChatReplayLaneMessageId,
  ): readonly ChatReplayRoomIndexEntry[];
  findNearestSequence(
    state: ChatReplayLaneState,
    roomId: ChatReplayLaneRoomId,
    sequenceNumber: ChatReplayLaneSequenceNumber,
  ): ChatReplayRoomIndexEntry | null;
  queryRange(
    state: ChatReplayLaneState,
    request: ChatReplayRangeQuery,
  ): readonly ChatReplayRoomIndexEntry[];
  search(
    state: ChatReplayLaneState,
    request: ChatReplaySearchRequest,
  ): readonly ChatReplaySearchHit[];
}

// ============================================================================
// MARK: Internal helpers
// ============================================================================

const DEFAULT_LANE_BUILD_OPTIONS: ChatReplayIndexBuildOptions = {
  includeTranscriptMaterial: true,
  includeProofMaterial: true,
};

function mergeReplayLaneBuildOptions(
  lane: ChatReplayLaneConfig,
  options: ChatReplayIndexBuildOptions | undefined,
): ChatReplayIndexBuildOptions {
  const defaults = lane.defaultBuildOptions ?? DEFAULT_LANE_BUILD_OPTIONS;
  const includeTranscriptMaterial =
    options?.includeTranscriptMaterial ??
    defaults.includeTranscriptMaterial ??
    lane.includeTranscriptMaterialByDefault ??
    true;
  const includeProofMaterial =
    options?.includeProofMaterial ??
    defaults.includeProofMaterial ??
    lane.includeProofMaterialByDefault ??
    true;

  return {
    ...defaults,
    ...options,
    includeTranscriptMaterial,
    includeProofMaterial,
  };
}

function summarizeReplayState(
  state: ChatReplayLaneState,
): ChatReplayLaneStateSummary {
  const roomIds = Object.keys((state as any).rooms ?? {});
  const replayByReplayId = (state as any).replay?.byReplayId ?? {};
  const replayArtifacts = Object.keys(replayByReplayId);
  const replayRoomIds = new Set<string>();

  for (const replayId of replayArtifacts) {
    const artifact = replayByReplayId[replayId];
    if (artifact?.roomId) {
      replayRoomIds.add(String(artifact.roomId));
    }
  }

  return {
    roomCount: roomIds.length,
    replayArtifactCount: replayArtifacts.length,
    replayRoomCount: replayRoomIds.size,
  };
}

function getStateRoomIds(
  state: ChatReplayLaneState,
): readonly ChatReplayLaneRoomId[] {
  return Object.keys((state as any).rooms ?? {}).map((roomId) => roomId as ChatReplayLaneRoomId);
}

function buildLaneGlobalIndex(
  lane: ChatReplayLaneConfig,
  assembler: ChatReplayAssemblerApi,
  index: ChatReplayIndexApi,
  state: ChatReplayLaneState,
  options?: ChatReplayIndexBuildOptions,
): ChatReplayGlobalIndex {
  const merged = mergeReplayLaneBuildOptions(lane, options);
  return buildReplayGlobalIndex(index.config, assembler, state, merged);
}

function buildLaneRoomIndex(
  lane: ChatReplayLaneConfig,
  assembler: ChatReplayAssemblerApi,
  index: ChatReplayIndexApi,
  state: ChatReplayLaneState,
  roomId: ChatReplayLaneRoomId,
  options?: ChatReplayIndexBuildOptions,
): ChatReplayRoomIndex {
  const merged = mergeReplayLaneBuildOptions(lane, options);
  return buildReplayRoomIndex(index.config, assembler, state, roomId, merged);
}

function rebuildGlobalIndexAfterStateMutation(
  lane: ChatReplayLaneConfig,
  assembler: ChatReplayAssemblerApi,
  index: ChatReplayIndexApi,
  state: ChatReplayLaneState,
  roomId?: ChatReplayLaneRoomId,
): ChatReplayGlobalIndex {
  if (!roomId) {
    return buildLaneGlobalIndex(lane, assembler, index, state);
  }
  const roomIds = getStateRoomIds(state);
  if (!roomIds.includes(roomId)) {
    return buildLaneGlobalIndex(lane, assembler, index, state);
  }
  return buildLaneGlobalIndex(lane, assembler, index, state, {
    roomIds,
    includeTranscriptMaterial:
      lane.defaultBuildOptions?.includeTranscriptMaterial ??
      lane.includeTranscriptMaterialByDefault ??
      true,
    includeProofMaterial:
      lane.defaultBuildOptions?.includeProofMaterial ??
      lane.includeProofMaterialByDefault ??
      true,
  });
}

function makeSyntheticAssemblyRequestFromBundle(
  bundle: ChatReplayBundle,
  reason: ChatReplayAssemblyReason = 'MANUAL_REQUEST',
): ChatReplayAssemblyRequest {
  const shadowCount = Number(bundle.artifact.metadata.shadowCount ?? bundle.shadowEntries.length);
  const strategy: ChatReplayAssemblyRequest['strategy'] =
    bundle.anchor.anchorMessageId ? 'MESSAGE_ID' : 'EXPLICIT_RANGE';

  return {
    roomId: bundle.artifact.roomId,
    label: bundle.artifact.label,
    reason,
    strategy,
    eventId: bundle.anchor.eventId ?? null,
    anchorMessageId: bundle.anchor.anchorMessageId ?? null,
    anchorSequence: bundle.anchor.anchorSequence ?? null,
    anchorTimestamp: bundle.anchor.anchorTimestamp ?? null,
    explicitRange: bundle.artifact.range,
    includeShadow: shadowCount > 0,
    dedupeByAnchorKey: false,
    metadata: {
      syntheticReassembly: true,
      originalReplayId: String(bundle.artifact.id),
      originalAnchorKey: bundle.artifact.anchorKey,
    },
  };
}

function buildSnapshot(
  manifest: ChatReplayLaneManifest,
  lane: ChatReplayLaneConfig,
  assembler: ChatReplayAssemblerApi,
  index: ChatReplayIndexApi,
  state: ChatReplayLaneState,
): ChatReplayLaneSnapshot {
  const globalIndex = buildLaneGlobalIndex(lane, assembler, index, state);
  const diagnostics = buildReplayDiagnostics(index.config, assembler, state);
  return {
    manifest,
    stateSummary: summarizeReplayState(state),
    globalIndex,
    diagnostics,
  };
}

function maybeBuildEagerRoomIndexes(
  lane: ChatReplayLaneConfig,
  assembler: ChatReplayAssemblerApi,
  index: ChatReplayIndexApi,
  state: ChatReplayLaneState,
): void {
  const eagerRoomIds = lane.eagerRoomIndexes ?? [];
  for (const roomId of eagerRoomIds) {
    buildLaneRoomIndex(lane, assembler, index, state, roomId);
  }
}

// ============================================================================
// MARK: Root lane factory
// ============================================================================

export function createChatReplayLane(
  config: ChatReplayLaneConfig = {},
): ChatReplayLaneApi {
  const assembler = createChatReplayAssembler(config.assembler ?? {});
  const index = createChatReplayIndex(config.index ?? {}, assembler);

  const runtimeConfig = {
    includeTranscriptMaterialByDefault:
      config.includeTranscriptMaterialByDefault ??
      config.defaultBuildOptions?.includeTranscriptMaterial ??
      true,
    includeProofMaterialByDefault:
      config.includeProofMaterialByDefault ??
      config.defaultBuildOptions?.includeProofMaterial ??
      true,
    eagerGlobalDiagnostics: config.eagerGlobalDiagnostics ?? false,
    defaultBuildOptions: mergeReplayLaneBuildOptions(config, undefined),
    indexConfig: config.index ?? {},
  } as const;

  return {
    manifest: CHAT_REPLAY_LANE_MANIFEST,
    assembler,
    index,
    config: runtimeConfig,

    summarizeState(state: ChatReplayLaneState): ChatReplayLaneStateSummary {
      return summarizeReplayState(state);
    },

    snapshot(state: ChatReplayLaneState): ChatReplayLaneSnapshot {
      const snapshot = buildSnapshot(
        CHAT_REPLAY_LANE_MANIFEST,
        config,
        assembler,
        index,
        state,
      );

      if (runtimeConfig.eagerGlobalDiagnostics) {
        maybeBuildEagerRoomIndexes(config, assembler, index, state);
      }

      return snapshot;
    },

    buildGlobalIndex(
      state: ChatReplayLaneState,
      options: ChatReplayIndexBuildOptions = {},
    ): ChatReplayGlobalIndex {
      return buildLaneGlobalIndex(config, assembler, index, state, options);
    },

    buildRoomIndex(
      state: ChatReplayLaneState,
      roomId: ChatReplayLaneRoomId,
      options: ChatReplayIndexBuildOptions = {},
    ): ChatReplayRoomIndex {
      return buildLaneRoomIndex(config, assembler, index, state, roomId, options);
    },

    diagnostics(state: ChatReplayLaneState): ChatReplayIndexDiagnostics {
      return buildReplayDiagnostics(index.config, assembler, state);
    },

    resolveAnchor(
      state: ChatReplayLaneState,
      request: ChatReplayAssemblyRequest,
    ): ChatReplayResolvedAnchor {
      return assembler.resolveAnchor(state, request);
    },

    assemble(
      state: ChatReplayLaneState,
      request: ChatReplayAssemblyRequest,
    ): ChatReplayArtifactEnvelope | null {
      return assembler.assemble(state, request);
    },

    append(
      state: ChatReplayLaneState,
      envelope: ChatReplayArtifactEnvelope,
    ): ChatReplayAppendResult {
      return assembler.append(state, envelope);
    },

    assembleAndAppend(
      state: ChatReplayLaneState,
      request: ChatReplayAssemblyRequest,
    ): ChatReplayAppendResult | null {
      return assembler.assembleAndAppend(state, request);
    },

    assembleAppendAndIndex(
      state: ChatReplayLaneState,
      request: ChatReplayAssemblyRequest,
    ): ChatReplayAssemblyAndIndexResult {
      const append = assembler.assembleAndAppend(state, request);
      const nextState = append?.state ?? state;
      const roomIndex = append?.artifact?.roomId
        ? buildLaneRoomIndex(config, assembler, index, nextState, append.artifact.roomId)
        : null;
      const globalIndex = rebuildGlobalIndexAfterStateMutation(
        config,
        assembler,
        index,
        nextState,
        append?.artifact?.roomId,
      );
      return {
        append,
        roomIndex,
        globalIndex,
      };
    },

    assembleBundleByReplayId(
      state: ChatReplayLaneState,
      roomId: ChatReplayLaneRoomId,
      replayId: ChatReplayLaneReplayId,
    ): ChatReplayBundle | null {
      return assembler.assembleBundleByReplayId(state, roomId, replayId);
    },

    assembleBundleAroundMessage(
      state: ChatReplayLaneState,
      roomId: ChatReplayLaneRoomId,
      messageId: ChatReplayLaneMessageId,
      label = 'Replay Window',
    ): ChatReplayBundle | null {
      return assembler.assembleBundleAroundMessage(state, roomId, messageId, label);
    },

    assembleBundleAroundSequence(
      state: ChatReplayLaneState,
      roomId: ChatReplayLaneRoomId,
      sequenceNumber: ChatReplayLaneSequenceNumber,
      label = 'Replay Window',
    ): ChatReplayBundle | null {
      return assembler.assembleBundleAroundSequence(state, roomId, sequenceNumber, label);
    },

    createArtifact(
      state: ChatReplayLaneState,
      request: ChatReplayAssemblyRequest,
    ): ReturnType<typeof createReplayArtifact> | null {
      const envelope = assembler.assemble(state, request);
      if (!envelope) {
        return null;
      }
      return envelope.artifact;
    },

    buildSceneBeatsForBundle(bundle: ChatReplayBundle): readonly ChatReplaySceneBeat[] {
      return buildSceneBeats(bundle.artifact.roomId, bundle.entries);
    },

    buildWitnessLinesForBundle(
      bundle: ChatReplayBundle,
    ): readonly ChatReplayWitnessLine[] {
      return buildWitnessLines(bundle.entries, bundle.anchor.anchorMessageId ?? null);
    },

    verifyRoom(
      state: ChatReplayLaneState,
      roomId: ChatReplayLaneRoomId,
    ): ChatReplayCoverageReport {
      return assembler.verifyRoom(state, roomId);
    },

    repairRoom(
      state: ChatReplayLaneState,
      roomId: ChatReplayLaneRoomId,
    ): ChatReplayRoomRebuildResult {
      return assembler.repairRoom(state, roomId);
    },

    rebuildRoom(
      state: ChatReplayLaneState,
      roomId: ChatReplayLaneRoomId,
    ): ChatReplayRoomRebuildResult {
      return assembler.rebuildRoom(state, roomId);
    },

    compactRoom(
      state: ChatReplayLaneState,
      roomId: ChatReplayLaneRoomId,
    ): ChatReplayRoomCompactionResult {
      return assembler.compactRoom(state, roomId);
    },

    repairRoomAndIndex(
      state: ChatReplayLaneState,
      roomId: ChatReplayLaneRoomId,
    ): ChatReplayRepairAndIndexResult {
      const rebuild = assembler.repairRoom(state, roomId);
      const roomIndex = buildLaneRoomIndex(config, assembler, index, rebuild.state, roomId);
      const globalIndex = rebuildGlobalIndexAfterStateMutation(
        config,
        assembler,
        index,
        rebuild.state,
        roomId,
      );
      return {
        rebuild,
        roomIndex,
        globalIndex,
      };
    },

    rebuildRoomAndIndex(
      state: ChatReplayLaneState,
      roomId: ChatReplayLaneRoomId,
    ): ChatReplayRepairAndIndexResult {
      const rebuild = assembler.rebuildRoom(state, roomId);
      const roomIndex = buildLaneRoomIndex(config, assembler, index, rebuild.state, roomId);
      const globalIndex = rebuildGlobalIndexAfterStateMutation(
        config,
        assembler,
        index,
        rebuild.state,
        roomId,
      );
      return {
        rebuild,
        roomIndex,
        globalIndex,
      };
    },

    compactRoomAndIndex(
      state: ChatReplayLaneState,
      roomId: ChatReplayLaneRoomId,
    ): ChatReplayCompactionAndIndexResult {
      const compaction = assembler.compactRoom(state, roomId);
      const roomIndex = buildLaneRoomIndex(config, assembler, index, compaction.state, roomId);
      const globalIndex = rebuildGlobalIndexAfterStateMutation(
        config,
        assembler,
        index,
        compaction.state,
        roomId,
      );
      return {
        compaction,
        roomIndex,
        globalIndex,
      };
    },

    findReplay(
      state: ChatReplayLaneState,
      roomId: ChatReplayLaneRoomId,
      replayId: ChatReplayLaneReplayId,
    ): ChatReplayRoomIndexEntry | null {
      return index.findReplay(state, roomId, replayId);
    },

    findByAnchorKey(
      state: ChatReplayLaneState,
      roomId: ChatReplayLaneRoomId,
      anchorKey: ChatReplayLaneAnchorKey,
    ): readonly ChatReplayRoomIndexEntry[] {
      return index.findByAnchorKey(state, roomId, anchorKey);
    },

    findByEventId(
      state: ChatReplayLaneState,
      roomId: ChatReplayLaneRoomId,
      eventId: ChatReplayLaneEventId,
    ): readonly ChatReplayRoomIndexEntry[] {
      return index.findByEventId(state, roomId, eventId);
    },

    findContainingMessage(
      state: ChatReplayLaneState,
      roomId: ChatReplayLaneRoomId,
      messageId: ChatReplayLaneMessageId,
    ): readonly ChatReplayRoomIndexEntry[] {
      return index.findContainingMessage(state, roomId, messageId);
    },

    findNearestSequence(
      state: ChatReplayLaneState,
      roomId: ChatReplayLaneRoomId,
      sequenceNumber: ChatReplayLaneSequenceNumber,
    ): ChatReplayRoomIndexEntry | null {
      return index.findNearestSequence(state, roomId, sequenceNumber);
    },

    queryRange(
      state: ChatReplayLaneState,
      request: ChatReplayRangeQuery,
    ): readonly ChatReplayRoomIndexEntry[] {
      return index.queryRange(state, request);
    },

    search(
      state: ChatReplayLaneState,
      request: ChatReplaySearchRequest,
    ): readonly ChatReplaySearchHit[] {
      return index.search(state, request);
    },
  };
}

export type ChatReplayLaneRuntime = ReturnType<typeof createChatReplayLane>;

// ============================================================================
// MARK: Stateful convenience runtime
// ============================================================================

export interface ChatReplayAuthorityStore {
  getState(): ChatReplayLaneState;
  setState(state: ChatReplayLaneState): void;
}

export interface ChatReplayAuthorityMutationResult {
  readonly state: ChatReplayLaneState;
  readonly snapshot: ChatReplayLaneSnapshot;
}

export class ChatReplayAuthorityRuntime {
  public readonly lane: ChatReplayLaneApi;
  private readonly store: ChatReplayAuthorityStore;

  public constructor(
    store: ChatReplayAuthorityStore,
    config: ChatReplayLaneConfig = {},
  ) {
    this.store = store;
    this.lane = createChatReplayLane(config);
  }

  public manifest(): ChatReplayLaneManifest {
    return this.lane.manifest;
  }

  public getState(): ChatReplayLaneState {
    return this.store.getState();
  }

  public setState(state: ChatReplayLaneState): void {
    this.store.setState(state);
  }

  public snapshot(): ChatReplayLaneSnapshot {
    return this.lane.snapshot(this.store.getState());
  }

  public summarizeState(): ChatReplayLaneStateSummary {
    return this.lane.summarizeState(this.store.getState());
  }

  public buildGlobalIndex(
    options: ChatReplayIndexBuildOptions = {},
  ): ChatReplayGlobalIndex {
    return this.lane.buildGlobalIndex(this.store.getState(), options);
  }

  public buildRoomIndex(
    roomId: ChatReplayLaneRoomId,
    options: ChatReplayIndexBuildOptions = {},
  ): ChatReplayRoomIndex {
    return this.lane.buildRoomIndex(this.store.getState(), roomId, options);
  }

  public diagnostics(): ChatReplayIndexDiagnostics {
    return this.lane.diagnostics(this.store.getState());
  }

  public resolveAnchor(
    request: ChatReplayAssemblyRequest,
  ): ChatReplayResolvedAnchor {
    return this.lane.resolveAnchor(this.store.getState(), request);
  }

  public assemble(
    request: ChatReplayAssemblyRequest,
  ): ChatReplayArtifactEnvelope | null {
    return this.lane.assemble(this.store.getState(), request);
  }

  public append(
    envelope: ChatReplayArtifactEnvelope,
  ): ChatReplayAuthorityMutationResult {
    const append = this.lane.append(this.store.getState(), envelope);
    this.store.setState(append.state);
    return {
      state: append.state,
      snapshot: this.lane.snapshot(append.state),
    };
  }

  public assembleAndAppend(
    request: ChatReplayAssemblyRequest,
  ): ChatReplayAuthorityMutationResult | null {
    const append = this.lane.assembleAndAppend(this.store.getState(), request);
    if (!append) {
      return null;
    }
    this.store.setState(append.state);
    return {
      state: append.state,
      snapshot: this.lane.snapshot(append.state),
    };
  }

  public assembleAppendAndIndex(
    request: ChatReplayAssemblyRequest,
  ): ChatReplayAssemblyAndIndexResult {
    const result = this.lane.assembleAppendAndIndex(this.store.getState(), request);
    if (result.append) {
      this.store.setState(result.append.state);
    }
    return result;
  }

  public assembleBundleByReplayId(
    roomId: ChatReplayLaneRoomId,
    replayId: ChatReplayLaneReplayId,
  ): ChatReplayBundle | null {
    return this.lane.assembleBundleByReplayId(this.store.getState(), roomId, replayId);
  }

  public assembleBundleAroundMessage(
    roomId: ChatReplayLaneRoomId,
    messageId: ChatReplayLaneMessageId,
    label = 'Replay Window',
  ): ChatReplayBundle | null {
    return this.lane.assembleBundleAroundMessage(
      this.store.getState(),
      roomId,
      messageId,
      label,
    );
  }

  public assembleBundleAroundSequence(
    roomId: ChatReplayLaneRoomId,
    sequenceNumber: ChatReplayLaneSequenceNumber,
    label = 'Replay Window',
  ): ChatReplayBundle | null {
    return this.lane.assembleBundleAroundSequence(
      this.store.getState(),
      roomId,
      sequenceNumber,
      label,
    );
  }

  public createArtifact(
    request: ChatReplayAssemblyRequest,
  ): ReturnType<typeof createReplayArtifact> | null {
    return this.lane.createArtifact(this.store.getState(), request);
  }

  public buildSceneBeatsForBundle(
    bundle: ChatReplayBundle,
  ): readonly ChatReplaySceneBeat[] {
    return this.lane.buildSceneBeatsForBundle(bundle);
  }

  public buildWitnessLinesForBundle(
    bundle: ChatReplayBundle,
  ): readonly ChatReplayWitnessLine[] {
    return this.lane.buildWitnessLinesForBundle(bundle);
  }

  public verifyRoom(
    roomId: ChatReplayLaneRoomId,
  ): ChatReplayCoverageReport {
    return this.lane.verifyRoom(this.store.getState(), roomId);
  }

  public repairRoom(
    roomId: ChatReplayLaneRoomId,
  ): ChatReplayAuthorityMutationResult {
    const result = this.lane.repairRoomAndIndex(this.store.getState(), roomId);
    this.store.setState(result.rebuild.state);
    return {
      state: result.rebuild.state,
      snapshot: this.lane.snapshot(result.rebuild.state),
    };
  }

  public rebuildRoom(
    roomId: ChatReplayLaneRoomId,
  ): ChatReplayAuthorityMutationResult {
    const result = this.lane.rebuildRoomAndIndex(this.store.getState(), roomId);
    this.store.setState(result.rebuild.state);
    return {
      state: result.rebuild.state,
      snapshot: this.lane.snapshot(result.rebuild.state),
    };
  }

  public compactRoom(
    roomId: ChatReplayLaneRoomId,
  ): ChatReplayAuthorityMutationResult {
    const result = this.lane.compactRoomAndIndex(this.store.getState(), roomId);
    this.store.setState(result.compaction.state);
    return {
      state: result.compaction.state,
      snapshot: this.lane.snapshot(result.compaction.state),
    };
  }

  public findReplay(
    roomId: ChatReplayLaneRoomId,
    replayId: ChatReplayLaneReplayId,
  ): ChatReplayRoomIndexEntry | null {
    return this.lane.findReplay(this.store.getState(), roomId, replayId);
  }

  public findByAnchorKey(
    roomId: ChatReplayLaneRoomId,
    anchorKey: ChatReplayLaneAnchorKey,
  ): readonly ChatReplayRoomIndexEntry[] {
    return this.lane.findByAnchorKey(this.store.getState(), roomId, anchorKey);
  }

  public findByEventId(
    roomId: ChatReplayLaneRoomId,
    eventId: ChatReplayLaneEventId,
  ): readonly ChatReplayRoomIndexEntry[] {
    return this.lane.findByEventId(this.store.getState(), roomId, eventId);
  }

  public findContainingMessage(
    roomId: ChatReplayLaneRoomId,
    messageId: ChatReplayLaneMessageId,
  ): readonly ChatReplayRoomIndexEntry[] {
    return this.lane.findContainingMessage(this.store.getState(), roomId, messageId);
  }

  public findNearestSequence(
    roomId: ChatReplayLaneRoomId,
    sequenceNumber: ChatReplayLaneSequenceNumber,
  ): ChatReplayRoomIndexEntry | null {
    return this.lane.findNearestSequence(this.store.getState(), roomId, sequenceNumber);
  }

  public queryRange(
    request: ChatReplayRangeQuery,
  ): readonly ChatReplayRoomIndexEntry[] {
    return this.lane.queryRange(this.store.getState(), request);
  }

  public search(
    request: ChatReplaySearchRequest,
  ): readonly ChatReplaySearchHit[] {
    return this.lane.search(this.store.getState(), request);
  }
}

// ============================================================================
// MARK: Barrel-level direct helpers
// ============================================================================

export function buildChatReplayLaneSnapshot(
  state: ChatReplayLaneState,
  config: ChatReplayLaneConfig = {},
): ChatReplayLaneSnapshot {
  return createChatReplayLane(config).snapshot(state);
}

export function buildChatReplayLaneDiagnostics(
  state: ChatReplayLaneState,
  config: ChatReplayLaneConfig = {},
): ChatReplayIndexDiagnostics {
  return createChatReplayLane(config).diagnostics(state);
}

export function assembleReplayAndBuildRoomIndex(
  state: ChatReplayLaneState,
  request: ChatReplayAssemblyRequest,
  config: ChatReplayLaneConfig = {},
): {
  readonly envelope: ChatReplayArtifactEnvelope | null;
  readonly roomIndex: ChatReplayRoomIndex | null;
} {
  const lane = createChatReplayLane(config);
  const envelope = lane.assemble(state, request);
  if (!envelope) {
    return {
      envelope: null,
      roomIndex: null,
    };
  }
  return {
    envelope,
    roomIndex: lane.buildRoomIndex(state, request.roomId),
  };
}

export function appendReplayAndBuildRoomIndex(
  state: ChatReplayLaneState,
  envelope: ChatReplayArtifactEnvelope,
  config: ChatReplayLaneConfig = {},
): {
  readonly append: ChatReplayAppendResult;
  readonly roomIndex: ChatReplayRoomIndex;
} {
  const lane = createChatReplayLane(config);
  const append = lane.append(state, envelope);
  const roomIndex = lane.buildRoomIndex(append.state, envelope.artifact.roomId);
  return {
    append,
    roomIndex,
  };
}

export function assembleAppendRepairAndSearch(
  state: ChatReplayLaneState,
  request: ChatReplayAssemblyRequest,
  searchRequest: ChatReplaySearchRequest,
  config: ChatReplayLaneConfig = {},
): {
  readonly append: ChatReplayAppendResult | null;
  readonly repaired: ChatReplayRoomRebuildResult | null;
  readonly hits: readonly ChatReplaySearchHit[];
} {
  const lane = createChatReplayLane(config);
  const append = lane.assembleAndAppend(state, request);
  const nextState = append?.state ?? state;
  const repaired = append
    ? lane.repairRoom(nextState, request.roomId)
    : null;
  const finalState = repaired?.state ?? nextState;
  return {
    append,
    repaired,
    hits: lane.search(finalState, searchRequest),
  };
}

export function recoverReplayBundleFromSearchHit(
  state: ChatReplayLaneState,
  hit: ChatReplaySearchHit,
  config: ChatReplayLaneConfig = {},
): ChatReplayBundle | null {
  const lane = createChatReplayLane(config);
  return lane.assembleBundleByReplayId(state, hit.roomId, hit.replayId);
}

export function recoverReplayBundleFromIndexEntry(
  state: ChatReplayLaneState,
  entry: ChatReplayRoomIndexEntry,
  config: ChatReplayLaneConfig = {},
): ChatReplayBundle | null {
  const lane = createChatReplayLane(config);
  return lane.assembleBundleByReplayId(state, entry.roomId, entry.replayId);
}

export function buildReplayRoomIndexFromBundle(
  state: ChatReplayLaneState,
  bundle: ChatReplayBundle,
  config: ChatReplayLaneConfig = {},
): ChatReplayRoomIndex {
  const lane = createChatReplayLane(config);
  return lane.buildRoomIndex(state, bundle.artifact.roomId);
}

export function rebuildReplayRoomFromBundle(
  state: ChatReplayLaneState,
  bundle: ChatReplayBundle,
  config: ChatReplayLaneConfig = {},
): ChatReplayRoomRebuildResult {
  const lane = createChatReplayLane(config);
  return lane.rebuildRoom(state, bundle.artifact.roomId);
}

export function compactReplayRoomFromBundle(
  state: ChatReplayLaneState,
  bundle: ChatReplayBundle,
  config: ChatReplayLaneConfig = {},
): ChatReplayRoomCompactionResult {
  const lane = createChatReplayLane(config);
  return lane.compactRoom(state, bundle.artifact.roomId);
}

export function reassembleBundleWithSyntheticRequest(
  state: ChatReplayLaneState,
  bundle: ChatReplayBundle,
  config: ChatReplayLaneConfig = {},
): ChatReplayBundle | null {
  const lane = createChatReplayLane(config);
  return lane.assemble(state, makeSyntheticAssemblyRequestFromBundle(bundle))?.bundle ?? null;
}

// ============================================================================
// MARK: Integrated direct-flow helpers
// ============================================================================

export function createReplayArtifactEnvelopeWithIndex(
  state: ChatReplayLaneState,
  request: ChatReplayAssemblyRequest,
  config: ChatReplayLaneConfig = {},
): {
  readonly envelope: ChatReplayArtifactEnvelope | null;
  readonly roomIndex: ChatReplayRoomIndex | null;
  readonly globalIndex: ChatReplayGlobalIndex;
} {
  const lane = createChatReplayLane(config);
  const envelope = lane.assemble(state, request);
  const roomIndex = envelope
    ? lane.buildRoomIndex(state, request.roomId)
    : null;
  const globalIndex = lane.buildGlobalIndex(state, {
    roomIds: envelope ? [request.roomId] : undefined,
  });
  return {
    envelope,
    roomIndex,
    globalIndex,
  };
}

export function repairReplayRoomCoverageWithIndex(
  state: ChatReplayLaneState,
  roomId: ChatReplayLaneRoomId,
  config: ChatReplayLaneConfig = {},
): ChatReplayRepairAndIndexResult {
  return createChatReplayLane(config).repairRoomAndIndex(state, roomId);
}

export function rebuildReplayRoomWithIndex(
  state: ChatReplayLaneState,
  roomId: ChatReplayLaneRoomId,
  config: ChatReplayLaneConfig = {},
): ChatReplayRepairAndIndexResult {
  return createChatReplayLane(config).rebuildRoomAndIndex(state, roomId);
}

export function compactReplayRoomWithIndex(
  state: ChatReplayLaneState,
  roomId: ChatReplayLaneRoomId,
  config: ChatReplayLaneConfig = {},
): ChatReplayCompactionAndIndexResult {
  return createChatReplayLane(config).compactRoomAndIndex(state, roomId);
}

export function verifyReplayRoomCoverageWithDiagnostics(
  state: ChatReplayLaneState,
  roomId: ChatReplayLaneRoomId,
  config: ChatReplayLaneConfig = {},
): {
  readonly coverage: ChatReplayCoverageReport;
  readonly diagnostics: ChatReplayIndexDiagnostics;
} {
  const lane = createChatReplayLane(config);
  return {
    coverage: lane.verifyRoom(state, roomId),
    diagnostics: lane.diagnostics(state),
  };
}

export function searchReplayRoomAfterRepair(
  state: ChatReplayLaneState,
  roomId: ChatReplayLaneRoomId,
  query: string,
  config: ChatReplayLaneConfig = {},
): {
  readonly rebuild: ChatReplayRoomRebuildResult;
  readonly hits: readonly ChatReplaySearchHit[];
} {
  const lane = createChatReplayLane(config);
  const rebuild = lane.repairRoom(state, roomId);
  const hits = lane.search(rebuild.state, {
    query,
    roomId,
  });
  return {
    rebuild,
    hits,
  };
}

export function findReplayNearSequenceAfterAppend(
  state: ChatReplayLaneState,
  request: ChatReplayAssemblyRequest,
  sequenceNumber: ChatReplayLaneSequenceNumber,
  config: ChatReplayLaneConfig = {},
): {
  readonly append: ChatReplayAppendResult | null;
  readonly nearest: ChatReplayRoomIndexEntry | null;
} {
  const lane = createChatReplayLane(config);
  const append = lane.assembleAndAppend(state, request);
  const nextState = append?.state ?? state;
  return {
    append,
    nearest: lane.findNearestSequence(nextState, request.roomId, sequenceNumber),
  };
}

// ============================================================================
// MARK: Explicit function-alias exports for downstream clarity
// ============================================================================

export const createBackendChatReplayLane = createChatReplayLane;
export const createBackendChatReplayAuthorityRuntime = ChatReplayAuthorityRuntime;
export const createBackendChatReplayAssembler = createChatReplayAssembler;
export const createBackendChatReplayIndex = createChatReplayIndex;
export const createBackendChatReplayLaneSnapshot = buildChatReplayLaneSnapshot;
export const createBackendChatReplayLaneDiagnostics = buildChatReplayLaneDiagnostics;

export const backendChatReplayManifest = CHAT_REPLAY_LANE_MANIFEST;
export const backendChatReplayModules = CHAT_REPLAY_LANE_MODULES;
export const backendChatReplayDoctrine = CHAT_REPLAY_LANE_DOCTRINE;
export const backendChatReplayCanonicalTree = CHAT_REPLAY_LANE_CANONICAL_TREE;

// ============================================================================
// MARK: Barrel surface assertion helpers
// ============================================================================

export function assertChatReplayLaneModuleGenerated(
  id: ChatReplayLaneModuleId,
): ChatReplayLaneModuleManifest {
  const module = getChatReplayLaneModule(id);
  if (module.readiness !== 'GENERATED') {
    throw new Error(
      `Replay lane module is not generated: ${String(id)} (${module.readiness})`,
    );
  }
  return module;
}

export function assertChatReplayLaneReady(): ChatReplayLaneManifest {
  for (const module of CHAT_REPLAY_LANE_MODULES) {
    assertChatReplayLaneModuleGenerated(module.id);
  }
  return CHAT_REPLAY_LANE_MANIFEST;
}

// ============================================================================
// MARK: Profile-driven lane construction
// ============================================================================

export interface ChatReplayProfileLaneConfig {
  readonly assemblerProfile?: ChatReplayAssemblerProfile;
  readonly indexProfile?: ChatReplayIndexProfile;
  readonly laneConfig?: ChatReplayLaneConfig;
}

export function createProfiledChatReplayLane(
  profileConfig: ChatReplayProfileLaneConfig = {},
): ChatReplayLaneApi {
  const assemblerProfile = profileConfig.assemblerProfile ?? 'STANDARD';
  const indexProfile = profileConfig.indexProfile ?? 'STANDARD';
  const laneConfig = profileConfig.laneConfig ?? {};

  const assembler = createChatReplayAssemblerFromProfile(assemblerProfile, laneConfig.assembler ?? {});
  const indexApi = createChatReplayIndexFromProfile(indexProfile, assembler);

  const runtimeConfig = {
    includeTranscriptMaterialByDefault:
      laneConfig.includeTranscriptMaterialByDefault ??
      laneConfig.defaultBuildOptions?.includeTranscriptMaterial ??
      true,
    includeProofMaterialByDefault:
      laneConfig.includeProofMaterialByDefault ??
      laneConfig.defaultBuildOptions?.includeProofMaterial ??
      true,
    eagerGlobalDiagnostics: laneConfig.eagerGlobalDiagnostics ?? false,
    defaultBuildOptions: mergeReplayLaneBuildOptions(laneConfig, undefined),
    indexConfig: laneConfig.index ?? {},
  } as const;

  return {
    manifest: CHAT_REPLAY_LANE_MANIFEST,
    assembler,
    index: indexApi,
    config: runtimeConfig,

    summarizeState(state: ChatReplayLaneState): ChatReplayLaneStateSummary {
      return summarizeReplayState(state);
    },
    snapshot(state: ChatReplayLaneState): ChatReplayLaneSnapshot {
      return buildSnapshot(CHAT_REPLAY_LANE_MANIFEST, laneConfig, assembler, indexApi, state);
    },
    buildGlobalIndex(state: ChatReplayLaneState, options: ChatReplayIndexBuildOptions = {}): ChatReplayGlobalIndex {
      return buildLaneGlobalIndex(laneConfig, assembler, indexApi, state, options);
    },
    buildRoomIndex(state: ChatReplayLaneState, roomId: ChatReplayLaneRoomId, options: ChatReplayIndexBuildOptions = {}): ChatReplayRoomIndex {
      return buildLaneRoomIndex(laneConfig, assembler, indexApi, state, roomId, options);
    },
    diagnostics(state: ChatReplayLaneState): ChatReplayIndexDiagnostics {
      return buildReplayDiagnostics(indexApi.config, assembler, state);
    },
    resolveAnchor(state: ChatReplayLaneState, request: ChatReplayAssemblyRequest): ChatReplayResolvedAnchor {
      return assembler.resolveAnchor(state, request);
    },
    assemble(state: ChatReplayLaneState, request: ChatReplayAssemblyRequest): ChatReplayArtifactEnvelope | null {
      return assembler.assemble(state, request);
    },
    append(state: ChatReplayLaneState, envelope: ChatReplayArtifactEnvelope): ChatReplayAppendResult {
      return assembler.append(state, envelope);
    },
    assembleAndAppend(state: ChatReplayLaneState, request: ChatReplayAssemblyRequest): ChatReplayAppendResult | null {
      return assembler.assembleAndAppend(state, request);
    },
    assembleAppendAndIndex(state: ChatReplayLaneState, request: ChatReplayAssemblyRequest): ChatReplayAssemblyAndIndexResult {
      const append = assembler.assembleAndAppend(state, request);
      const nextState = append?.state ?? state;
      const roomIndex = append?.artifact?.roomId
        ? buildLaneRoomIndex(laneConfig, assembler, indexApi, nextState, append.artifact.roomId)
        : null;
      const globalIndex = rebuildGlobalIndexAfterStateMutation(laneConfig, assembler, indexApi, nextState, append?.artifact?.roomId);
      return { append, roomIndex, globalIndex };
    },
    assembleBundleByReplayId(state: ChatReplayLaneState, roomId: ChatReplayLaneRoomId, replayId: ChatReplayLaneReplayId): ChatReplayBundle | null {
      return assembler.assembleBundleByReplayId(state, roomId, replayId);
    },
    assembleBundleAroundMessage(state: ChatReplayLaneState, roomId: ChatReplayLaneRoomId, messageId: ChatReplayLaneMessageId, label = 'Replay Window'): ChatReplayBundle | null {
      return assembler.assembleBundleAroundMessage(state, roomId, messageId, label);
    },
    assembleBundleAroundSequence(state: ChatReplayLaneState, roomId: ChatReplayLaneRoomId, sequenceNumber: ChatReplayLaneSequenceNumber, label = 'Replay Window'): ChatReplayBundle | null {
      return assembler.assembleBundleAroundSequence(state, roomId, sequenceNumber, label);
    },
    createArtifact(state: ChatReplayLaneState, request: ChatReplayAssemblyRequest): ReturnType<typeof createReplayArtifact> | null {
      return assembler.assemble(state, request)?.artifact ?? null;
    },
    buildSceneBeatsForBundle(bundle: ChatReplayBundle): readonly ChatReplaySceneBeat[] {
      return buildSceneBeats(bundle.artifact.roomId, bundle.entries);
    },
    buildWitnessLinesForBundle(bundle: ChatReplayBundle): readonly ChatReplayWitnessLine[] {
      return buildWitnessLines(bundle.entries, bundle.anchor.anchorMessageId ?? null);
    },
    verifyRoom(state: ChatReplayLaneState, roomId: ChatReplayLaneRoomId): ChatReplayCoverageReport {
      return assembler.verifyRoom(state, roomId);
    },
    repairRoom(state: ChatReplayLaneState, roomId: ChatReplayLaneRoomId): ChatReplayRoomRebuildResult {
      return assembler.repairRoom(state, roomId);
    },
    rebuildRoom(state: ChatReplayLaneState, roomId: ChatReplayLaneRoomId): ChatReplayRoomRebuildResult {
      return assembler.rebuildRoom(state, roomId);
    },
    compactRoom(state: ChatReplayLaneState, roomId: ChatReplayLaneRoomId): ChatReplayRoomCompactionResult {
      return assembler.compactRoom(state, roomId);
    },
    repairRoomAndIndex(state: ChatReplayLaneState, roomId: ChatReplayLaneRoomId): ChatReplayRepairAndIndexResult {
      const rebuild = assembler.repairRoom(state, roomId);
      const roomIndex = buildLaneRoomIndex(laneConfig, assembler, indexApi, rebuild.state, roomId);
      const globalIndex = rebuildGlobalIndexAfterStateMutation(laneConfig, assembler, indexApi, rebuild.state, roomId);
      return { rebuild, roomIndex, globalIndex };
    },
    rebuildRoomAndIndex(state: ChatReplayLaneState, roomId: ChatReplayLaneRoomId): ChatReplayRepairAndIndexResult {
      const rebuild = assembler.rebuildRoom(state, roomId);
      const roomIndex = buildLaneRoomIndex(laneConfig, assembler, indexApi, rebuild.state, roomId);
      const globalIndex = rebuildGlobalIndexAfterStateMutation(laneConfig, assembler, indexApi, rebuild.state, roomId);
      return { rebuild, roomIndex, globalIndex };
    },
    compactRoomAndIndex(state: ChatReplayLaneState, roomId: ChatReplayLaneRoomId): ChatReplayCompactionAndIndexResult {
      const compaction = assembler.compactRoom(state, roomId);
      const roomIndex = buildLaneRoomIndex(laneConfig, assembler, indexApi, compaction.state, roomId);
      const globalIndex = rebuildGlobalIndexAfterStateMutation(laneConfig, assembler, indexApi, compaction.state, roomId);
      return { compaction, roomIndex, globalIndex };
    },
    findReplay(state: ChatReplayLaneState, roomId: ChatReplayLaneRoomId, replayId: ChatReplayLaneReplayId): ChatReplayRoomIndexEntry | null {
      return indexApi.findReplay(state, roomId, replayId);
    },
    findByAnchorKey(state: ChatReplayLaneState, roomId: ChatReplayLaneRoomId, anchorKey: ChatReplayLaneAnchorKey): readonly ChatReplayRoomIndexEntry[] {
      return indexApi.findByAnchorKey(state, roomId, anchorKey);
    },
    findByEventId(state: ChatReplayLaneState, roomId: ChatReplayLaneRoomId, eventId: ChatReplayLaneEventId): readonly ChatReplayRoomIndexEntry[] {
      return indexApi.findByEventId(state, roomId, eventId);
    },
    findContainingMessage(state: ChatReplayLaneState, roomId: ChatReplayLaneRoomId, messageId: ChatReplayLaneMessageId): readonly ChatReplayRoomIndexEntry[] {
      return indexApi.findContainingMessage(state, roomId, messageId);
    },
    findNearestSequence(state: ChatReplayLaneState, roomId: ChatReplayLaneRoomId, sequenceNumber: ChatReplayLaneSequenceNumber): ChatReplayRoomIndexEntry | null {
      return indexApi.findNearestSequence(state, roomId, sequenceNumber);
    },
    queryRange(state: ChatReplayLaneState, request: ChatReplayRangeQuery): readonly ChatReplayRoomIndexEntry[] {
      return indexApi.queryRange(state, request);
    },
    search(state: ChatReplayLaneState, request: ChatReplaySearchRequest): readonly ChatReplaySearchHit[] {
      return indexApi.search(state, request);
    },
  };
}

// ============================================================================
// MARK: Extended batch flows
// ============================================================================

export function batchAssembleAndAppendWithLane(
  state: ChatReplayLaneState,
  batch: ChatReplayBatchAssemblyRequest,
  config: ChatReplayLaneConfig = {},
): ChatReplayBatchAssemblyResult {
  const lane = createChatReplayLane(config);
  return batchAssembleAndAppend(lane.assembler.ports, lane.assembler.proofContext, state, batch);
}

export function batchMultiRoomWithLane(
  state: ChatReplayLaneState,
  batch: ChatReplayMultiRoomBatchRequest,
  config: ChatReplayLaneConfig = {},
): ChatReplayMultiRoomBatchResult {
  const lane = createChatReplayLane(config);
  return batchMultiRoom(lane.assembler.ports, lane.assembler.proofContext, state, batch);
}

export function batchSearchWithLane(
  state: ChatReplayLaneState,
  batch: ChatReplayBatchSearchRequest,
  config: ChatReplayLaneConfig = {},
): ChatReplayBatchSearchResult {
  const lane = createChatReplayLane(config);
  return batchSearchReplayIndex(lane.index.config, lane.assembler, state, batch);
}

// ============================================================================
// MARK: Extended diagnostic flows
// ============================================================================

export function buildLaneAssemblerAuditReport(
  state: ChatReplayLaneState,
  roomId: ChatReplayLaneRoomId,
  config: ChatReplayLaneConfig = {},
) {
  const lane = createChatReplayLane(config);
  return buildAssemblerAuditReport(lane.assembler.ports, lane.assembler.proofContext, state, roomId);
}

export function buildLaneIndexAuditReport(
  state: ChatReplayLaneState,
  config: ChatReplayLaneConfig = {},
): ChatReplayIndexAuditReport {
  const lane = createChatReplayLane(config);
  return buildIndexAuditReport(lane.index.config, lane.assembler, state);
}

export function buildLaneAssemblerStats(
  state: ChatReplayLaneState,
  roomId: ChatReplayLaneRoomId,
  config: ChatReplayLaneConfig = {},
): ChatReplayAssemblerStatsSummary {
  const lane = createChatReplayLane(config);
  return buildAssemblerStatsSummary(lane.assembler.ports, lane.assembler.proofContext, state, roomId);
}

export function buildLaneIndexStats(
  state: ChatReplayLaneState,
  config: ChatReplayLaneConfig = {},
): ChatReplayIndexStatsSummary {
  const lane = createChatReplayLane(config);
  return buildIndexStatsSummary(lane.index.config, lane.assembler, state);
}

export function computeLaneAssemblerDiff(
  stateBefore: ChatReplayLaneState,
  stateAfter: ChatReplayLaneState,
  roomId: ChatReplayLaneRoomId,
  _config: ChatReplayLaneConfig = {},
): ChatReplayAssemblerDiff {
  return computeAssemblerDiff(stateBefore, stateAfter, roomId);
}

export function computeLaneIndexDiff(
  stateBefore: ChatReplayLaneState,
  stateAfter: ChatReplayLaneState,
  config: ChatReplayLaneConfig = {},
): ChatReplayIndexDiff {
  const lane = createChatReplayLane(config);
  return computeIndexDiff(lane.index.config, lane.assembler, stateBefore, stateAfter);
}

export function scoreBundleWithLane(
  bundle: ChatReplayBundle,
  _config: ChatReplayLaneConfig = {},
): ChatReplayBundleScore {
  return scoreBundleRelevance(bundle);
}

export function buildLaneSceneFrequency(
  state: ChatReplayLaneState,
  config: ChatReplayLaneConfig = {},
): readonly ChatReplaySceneFrequency[] {
  const lane = createChatReplayLane(config);
  return buildSceneFrequencyReport(lane.index.config, lane.assembler, state);
}

export function buildLaneLabelTaxonomy(
  state: ChatReplayLaneState,
  config: ChatReplayLaneConfig = {},
): ChatReplayLabelTaxonomy {
  const lane = createChatReplayLane(config);
  return buildReplayLabelTaxonomy(lane.index.config, lane.assembler, state);
}

export function scoreLaneProofCoverage(
  state: ChatReplayLaneState,
  roomId: ChatReplayLaneRoomId,
  config: ChatReplayLaneConfig = {},
): readonly ChatReplayProofCoverageScore[] {
  const lane = createChatReplayLane(config);
  return scoreRoomProofCoverage(lane.index.config, lane.assembler, state, roomId);
}

// ============================================================================
// MARK: Bundle analysis helpers
// ============================================================================

export function bundleAnalysis(bundle: ChatReplayBundle): Readonly<{
  containsLegend: boolean;
  exposureClass: ReturnType<typeof bundleExposureClass>;
  anchorQuality: ReturnType<typeof classifyAnchorQuality>;
  density: number;
  score: ChatReplayBundleScore;
  witnesses: readonly string[];
}> {
  return Object.freeze({
    containsLegend: bundleContainsLegendMoment(bundle),
    exposureClass: bundleExposureClass(bundle),
    anchorQuality: classifyAnchorQuality(bundle),
    density: estimateBundleDensity(bundle),
    score: scoreBundleRelevance(bundle),
    witnesses: summarizeBundleWitnesses(bundle),
  });
}

export function filterBundlesByLegend(
  bundles: readonly ChatReplayBundle[],
): readonly ChatReplayBundle[] {
  return bundles.filter((bundle) => bundleContainsLegendMoment(bundle));
}

export function sortBundlesByRelevance(
  bundles: readonly ChatReplayBundle[],
): readonly ChatReplayBundle[] {
  return [...bundles].sort((left, right) => {
    const leftScore = scoreBundleRelevance(left).compositeScore;
    const rightScore = scoreBundleRelevance(right).compositeScore;
    return rightScore - leftScore;
  });
}

export function groupBundlesByExposure(
  bundles: readonly ChatReplayBundle[],
): Readonly<{
  visibleOnly: readonly ChatReplayBundle[];
  shadowHeavy: readonly ChatReplayBundle[];
  mixed: readonly ChatReplayBundle[];
  empty: readonly ChatReplayBundle[];
}> {
  return Object.freeze({
    visibleOnly: bundles.filter((b) => bundleExposureClass(b) === 'VISIBLE_ONLY'),
    shadowHeavy: bundles.filter((b) => bundleExposureClass(b) === 'SHADOW_HEAVY'),
    mixed: bundles.filter((b) => bundleExposureClass(b) === 'MIXED'),
    empty: bundles.filter((b) => bundleExposureClass(b) === 'EMPTY'),
  });
}

// ============================================================================
// MARK: Index filtering re-exports (lane-scoped)
// ============================================================================

export function filterRoomIndexBySceneClass(
  state: ChatReplayLaneState,
  roomId: ChatReplayLaneRoomId,
  sceneClass: string,
  config: ChatReplayLaneConfig = {},
): readonly ChatReplayRoomIndexEntry[] {
  const lane = createChatReplayLane(config);
  const roomIndex = lane.buildRoomIndex(state, roomId);
  return filterIndexBySceneClass(roomIndex, sceneClass);
}

export function filterRoomIndexByLegend(
  state: ChatReplayLaneState,
  roomId: ChatReplayLaneRoomId,
  config: ChatReplayLaneConfig = {},
): readonly ChatReplayRoomIndexEntry[] {
  const lane = createChatReplayLane(config);
  const roomIndex = lane.buildRoomIndex(state, roomId);
  return filterIndexByLegend(roomIndex);
}

export function filterRoomIndexByProofCoverage(
  state: ChatReplayLaneState,
  roomId: ChatReplayLaneRoomId,
  minEdges = 1,
  config: ChatReplayLaneConfig = {},
): readonly ChatReplayRoomIndexEntry[] {
  const lane = createChatReplayLane(config);
  const roomIndex = lane.buildRoomIndex(state, roomId);
  return filterIndexByProofCoverage(roomIndex, minEdges);
}

export function sortRoomIndexByRelevance(
  state: ChatReplayLaneState,
  roomId: ChatReplayLaneRoomId,
  config: ChatReplayLaneConfig = {},
): readonly ChatReplayRoomIndexEntry[] {
  const lane = createChatReplayLane(config);
  const roomIndex = lane.buildRoomIndex(state, roomId);
  return sortIndexByRelevance(roomIndex.entries);
}

// ============================================================================
// MARK: Named factory aliases for downstream clarity
// ============================================================================

export const createCinematicReplayLane = (config?: ChatReplayLaneConfig) =>
  createProfiledChatReplayLane({ assemblerProfile: 'CINEMATIC', indexProfile: 'EXHAUSTIVE', laneConfig: config });

export const createRapidReplayLane = (config?: ChatReplayLaneConfig) =>
  createProfiledChatReplayLane({ assemblerProfile: 'RAPID', indexProfile: 'RAPID', laneConfig: config });

export const createForensicReplayLane = (config?: ChatReplayLaneConfig) =>
  createProfiledChatReplayLane({ assemblerProfile: 'FORENSIC', indexProfile: 'FORENSIC', laneConfig: config });

export const createLegendReplayLane = (config?: ChatReplayLaneConfig) =>
  createProfiledChatReplayLane({ assemblerProfile: 'LEGEND_FOCUS', indexProfile: 'LEGEND_AUDIT', laneConfig: config });

export const createShadowAwareReplayLane = (config?: ChatReplayLaneConfig) =>
  createProfiledChatReplayLane({ assemblerProfile: 'SHADOW_AWARE', indexProfile: 'PROOF_FOCUS', laneConfig: config });

// ============================================================================
// MARK: Combined module object
// ============================================================================

/**
 * Combined namespace object for the full backend chat replay lane:
 *
 *   import { ChatReplayModule } from './replay';
 *   ChatReplayModule.createLane();
 *   ChatReplayModule.createLegendLane();
 *   ChatReplayModule.assembler.createCinematic();
 *   ChatReplayModule.index.createLegendAudit();
 */
export const ChatReplayModule = Object.freeze({
  // Lane construction
  createLane: createChatReplayLane,
  createProfiledLane: createProfiledChatReplayLane,
  createCinematicLane: createCinematicReplayLane,
  createRapidLane: createRapidReplayLane,
  createForensicLane: createForensicReplayLane,
  createLegendLane: createLegendReplayLane,
  createShadowAwareLane: createShadowAwareReplayLane,

  // Assembler subsystem
  assembler: ChatReplayAssemblerModule,

  // Index subsystem
  index: ChatReplayIndexModule,

  // Manifest
  manifest: CHAT_REPLAY_LANE_MANIFEST,
  canonicalTree: CHAT_REPLAY_LANE_CANONICAL_TREE,
  modules: CHAT_REPLAY_LANE_MODULES,
  doctrine: CHAT_REPLAY_LANE_DOCTRINE,

  // Convenience flows
  buildSnapshot: buildChatReplayLaneSnapshot,
  buildDiagnostics: buildChatReplayLaneDiagnostics,
  assembleAndBuildRoomIndex: assembleReplayAndBuildRoomIndex,
  appendAndBuildRoomIndex: appendReplayAndBuildRoomIndex,
  assembleAppendRepairAndSearch,
  recoverBundleFromSearchHit: recoverReplayBundleFromSearchHit,
  recoverBundleFromIndexEntry: recoverReplayBundleFromIndexEntry,
  buildRoomIndexFromBundle: buildReplayRoomIndexFromBundle,
  rebuildRoomFromBundle: rebuildReplayRoomFromBundle,
  compactRoomFromBundle: compactReplayRoomFromBundle,
  reassembleBundle: reassembleBundleWithSyntheticRequest,

  // Integrated with index
  createEnvelopeWithIndex: createReplayArtifactEnvelopeWithIndex,
  repairWithIndex: repairReplayRoomCoverageWithIndex,
  rebuildWithIndex: rebuildReplayRoomWithIndex,
  compactWithIndex: compactReplayRoomWithIndex,
  verifyWithDiagnostics: verifyReplayRoomCoverageWithDiagnostics,
  searchAfterRepair: searchReplayRoomAfterRepair,
  findNearestAfterAppend: findReplayNearSequenceAfterAppend,

  // Batch flows
  batchAssemble: batchAssembleAndAppendWithLane,
  batchMultiRoom: batchMultiRoomWithLane,
  batchSearch: batchSearchWithLane,

  // Audit and diagnostic flows
  buildAssemblerAudit: buildLaneAssemblerAuditReport,
  buildIndexAudit: buildLaneIndexAuditReport,
  buildAssemblerStats: buildLaneAssemblerStats,
  buildIndexStats: buildLaneIndexStats,
  computeAssemblerDiff: computeLaneAssemblerDiff,
  computeIndexDiff: computeLaneIndexDiff,
  scoreBundle: scoreBundleWithLane,
  buildSceneFrequency: buildLaneSceneFrequency,
  buildLabelTaxonomy: buildLaneLabelTaxonomy,
  scoreProofCoverage: scoreLaneProofCoverage,

  // Bundle analysis
  analyzBundle: bundleAnalysis,
  filterByLegend: filterBundlesByLegend,
  sortByRelevance: sortBundlesByRelevance,
  groupByExposure: groupBundlesByExposure,

  // Room index filtering
  filterRoomBySceneClass: filterRoomIndexBySceneClass,
  filterRoomByLegend: filterRoomIndexByLegend,
  filterRoomByProofCoverage: filterRoomIndexByProofCoverage,
  sortRoomByRelevance: sortRoomIndexByRelevance,

  // Assertion helpers
  assertModuleGenerated: assertChatReplayLaneModuleGenerated,
  assertLaneReady: assertChatReplayLaneReady,
  getManifest: getChatReplayLaneManifest,
  getModule: getChatReplayLaneModule,
} as const);
