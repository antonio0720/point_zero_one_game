/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT PHASE-4 + EXPERIENCE BARREL
 * FILE: backend/src/game/engine/chat/phase4_index.ts
 * VERSION: 2026.03.18-experience-upgrade
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Curated export surface for the backend chat services that hold durable state,
 * continuity, novelty suppression, relationship truth, semantic repetition
 * control, and now cinematic experience direction.
 *
 * Doctrine
 * --------
 * This barrel exists so downstream backend lanes and server transport do not
 * reach through the root barrel when they only need the continuity/dramaturgy
 * layer. It keeps the import surface explicit and stable.
 */

import * as Memory from './ChatMemoryService';
import * as Novelty from './ChatNoveltyService';
import * as Relationship from './ChatRelationshipService';
import * as SceneArchive from './ChatSceneArchiveService';
import * as PlayerModel from './ChatPlayerModelService';
import * as SemanticSimilarity from './intelligence/ChatSemanticSimilarityIndex';
import * as RetrievalMemory from './intelligence/dl/MemoryAnchorStore';
import * as RetrievalContext from './intelligence/dl/RetrievalContextBuilder';
import * as RetrievalRanking from './intelligence/dl/MemoryRankingPolicy';

import * as DramaOrchestrator from './experience/ChatDramaOrchestrator';
import * as ScenePlanner from './experience/ChatScenePlanner';
import * as MomentLedger from './experience/ChatMomentLedger';
import * as SilencePolicy from './experience/ChatSilencePolicy';
import * as PostRunNarrativeEngine from './postrun/PostRunNarrativeEngine';
import * as TurningPointResolver from './postrun/TurningPointResolver';
import * as ForeshadowPlanner from './postrun/ForeshadowPlanner';

export * from './ChatMemoryService';
export * from './ChatNoveltyService';
export * from './ChatRelationshipService';
export * from './ChatSceneArchiveService';
export * from './ChatPlayerModelService';
export * from './intelligence/ChatSemanticSimilarityIndex';
export * from './intelligence/dl';
export * from './experience/ChatDramaOrchestrator';
export * from './experience/ChatScenePlanner';
export * from './experience/ChatMomentLedger';
export * from './experience/ChatSilencePolicy';
export * from './postrun/PostRunNarrativeEngine';
export * from './postrun/TurningPointResolver';
export * from './postrun/ForeshadowPlanner';

export {
  Memory as ChatMemoryServiceModule,
  Novelty as ChatNoveltyServiceModule,
  Relationship as ChatRelationshipServiceModule,
  SceneArchive as ChatSceneArchiveServiceModule,
  PlayerModel as ChatPlayerModelServiceModule,
  SemanticSimilarity as ChatSemanticSimilarityIndexModule,
  DramaOrchestrator as ChatDramaOrchestratorModule,
  ScenePlanner as ChatScenePlannerModule,
  MomentLedger as ChatMomentLedgerModule,
  SilencePolicy as ChatSilencePolicyModule,
  PostRunNarrativeEngine as ChatPostRunNarrativeEngineModule,
  TurningPointResolver as ChatTurningPointResolverModule,
  ForeshadowPlanner as ChatForeshadowPlannerModule,
};

export const BACKEND_CHAT_PHASE4_MODULES = Object.freeze({
  ChatMemoryServiceModule: Memory,
  ChatNoveltyServiceModule: Novelty,
  ChatRelationshipServiceModule: Relationship,
  ChatSceneArchiveServiceModule: SceneArchive,
  ChatPlayerModelServiceModule: PlayerModel,
  ChatSemanticSimilarityIndexModule: SemanticSimilarity,
  ChatMemoryAnchorStoreModule: RetrievalMemory,
  ChatRetrievalContextBuilderModule: RetrievalContext,
  ChatMemoryRankingPolicyModule: RetrievalRanking,
  ChatDramaOrchestratorModule: DramaOrchestrator,
  ChatScenePlannerModule: ScenePlanner,
  ChatMomentLedgerModule: MomentLedger,
  ChatSilencePolicyModule: SilencePolicy,
  ChatPostRunNarrativeEngineModule: PostRunNarrativeEngine,
  ChatTurningPointResolverModule: TurningPointResolver,
  ChatForeshadowPlannerModule: ForeshadowPlanner,
} as const);

export type BackendChatPhase4ModuleKey = keyof typeof BACKEND_CHAT_PHASE4_MODULES;

export interface BackendChatPhase4SurfaceDescriptor {
  readonly id: BackendChatPhase4SurfaceId;
  readonly relativePath: string;
  readonly concern: BackendChatPhase4Concern;
  readonly generated: boolean;
  readonly ownsTruth: boolean;
  readonly description: string;
}

export type BackendChatPhase4Concern =
  | 'MEMORY'
  | 'NOVELTY'
  | 'RELATIONSHIP'
  | 'SCENE_ARCHIVE'
  | 'PLAYER_MODEL'
  | 'SEMANTIC_SIMILARITY'
  | 'RETRIEVAL_MEMORY'
  | 'RETRIEVAL_CONTEXT'
  | 'RETRIEVAL_RANKING'
  | 'DRAMA'
  | 'SCENE_PLANNING'
  | 'MOMENT_LEDGER'
  | 'SILENCE_POLICY'
  | 'POSTRUN_NARRATIVE'
  | 'TURNING_POINT'
  | 'FORESHADOW';

export type BackendChatPhase4SurfaceId =
  | 'ChatMemoryService'
  | 'ChatNoveltyService'
  | 'ChatRelationshipService'
  | 'ChatSceneArchiveService'
  | 'ChatPlayerModelService'
  | 'ChatSemanticSimilarityIndex'
  | 'intelligence.dl.MemoryAnchorStore'
  | 'intelligence.dl.RetrievalContextBuilder'
  | 'intelligence.dl.MemoryRankingPolicy'
  | 'experience.ChatDramaOrchestrator'
  | 'experience.ChatScenePlanner'
  | 'experience.ChatMomentLedger'
  | 'experience.ChatSilencePolicy'
  | 'postrun.PostRunNarrativeEngine'
  | 'postrun.TurningPointResolver'
  | 'postrun.ForeshadowPlanner';

export const BACKEND_CHAT_PHASE4_SURFACE = Object.freeze([
  phase4Surface(
    'ChatMemoryService',
    './ChatMemoryService',
    'MEMORY',
    true,
    true,
    'Durable episodic memory persistence and callback selection.',
  ),
  phase4Surface(
    'ChatNoveltyService',
    './ChatNoveltyService',
    'NOVELTY',
    true,
    true,
    'Novelty suppression and repetition pressure control.',
  ),
  phase4Surface(
    'ChatRelationshipService',
    './ChatRelationshipService',
    'RELATIONSHIP',
    true,
    true,
    'Durable relationship-state persistence and lookup.',
  ),
  phase4Surface(
    'ChatSceneArchiveService',
    './ChatSceneArchiveService',
    'SCENE_ARCHIVE',
    true,
    true,
    'Scene persistence for recall, replay, and continuity.',
  ),
  phase4Surface(
    'ChatPlayerModelService',
    './ChatPlayerModelService',
    'PLAYER_MODEL',
    true,
    true,
    'Durable player modeling for adaptation and continuity.',
  ),
  phase4Surface(
    'ChatSemanticSimilarityIndex',
    './intelligence/ChatSemanticSimilarityIndex',
    'SEMANTIC_SIMILARITY',
    true,
    true,
    'Deterministic semantic repetition control for authored chat lines.',
  ),
  phase4Surface(
    'intelligence.dl.MemoryAnchorStore',
    './intelligence/dl/MemoryAnchorStore',
    'RETRIEVAL_MEMORY',
    true,
    true,
    'Authoritative durable store for retrieval-backed continuity anchors, windows, and receipts.',
  ),
  phase4Surface(
    'intelligence.dl.RetrievalContextBuilder',
    './intelligence/dl/RetrievalContextBuilder',
    'RETRIEVAL_CONTEXT',
    true,
    true,
    'Deterministic continuity packet builder for callback, rescue, post-run, and liveops authoring.',
  ),
  phase4Surface(
    'intelligence.dl.MemoryRankingPolicy',
    './intelligence/dl/MemoryRankingPolicy',
    'RETRIEVAL_RANKING',
    true,
    true,
    'Explainable ranking policy for durable memory-anchor retrieval.',
  ),
  phase4Surface(
    'experience.ChatDramaOrchestrator',
    './experience/ChatDramaOrchestrator',
    'DRAMA',
    true,
    true,
    'Cinematic scene orchestration over authoritative backend services.',
  ),
  phase4Surface(
    'experience.ChatScenePlanner',
    './experience/ChatScenePlanner',
    'SCENE_PLANNING',
    true,
    true,
    'Moment-to-scene planning and beat sequencing.',
  ),
  phase4Surface(
    'experience.ChatMomentLedger',
    './experience/ChatMomentLedger',
    'MOMENT_LEDGER',
    true,
    true,
    'Durable moment, reveal, carryover, and witness state.',
  ),
  phase4Surface(
    'experience.ChatSilencePolicy',
    './experience/ChatSilencePolicy',
    'SILENCE_POLICY',
    true,
    true,
    'Silence, interruption, delayed reveal, and timing law.',
  ),
  phase4Surface(
    'postrun.PostRunNarrativeEngine',
    './postrun/PostRunNarrativeEngine',
    'POSTRUN_NARRATIVE',
    true,
    true,
    'Authoritative post-run ritual composition, archive shaping, and bundle authoring.',
  ),
  phase4Surface(
    'postrun.TurningPointResolver',
    './postrun/TurningPointResolver',
    'TURNING_POINT',
    true,
    true,
    'Deterministic turning-point synthesis and selection.',
  ),
  phase4Surface(
    'postrun.ForeshadowPlanner',
    './postrun/ForeshadowPlanner',
    'FORESHADOW',
    true,
    true,
    'Future-pressure, directive, and witness-seed planning for post-run ritual.',
  ),
] as const satisfies readonly BackendChatPhase4SurfaceDescriptor[]);

export interface BackendChatPhase4ConcernGroup {
  readonly concern: BackendChatPhase4Concern;
  readonly modules: readonly BackendChatPhase4SurfaceDescriptor[];
}

export const BACKEND_CHAT_PHASE4_GROUPS = Object.freeze(
  uniqueConcerns(BACKEND_CHAT_PHASE4_SURFACE).map((concern) =>
    Object.freeze({
      concern,
      modules: Object.freeze(BACKEND_CHAT_PHASE4_SURFACE.filter((value) => value.concern === concern)),
    }),
  ),
);

export const BACKEND_CHAT_PHASE4_IMPORTABLE_PATHS = Object.freeze(
  BACKEND_CHAT_PHASE4_SURFACE.map((value) => value.relativePath),
);

export const BACKEND_CHAT_PHASE4_EXPERIENCE_PATHS = Object.freeze([
  './experience/ChatDramaOrchestrator',
  './experience/ChatScenePlanner',
  './experience/ChatMomentLedger',
  './experience/ChatSilencePolicy',
  './postrun/PostRunNarrativeEngine',
  './postrun/TurningPointResolver',
  './postrun/ForeshadowPlanner',
] as const);

export interface BackendChatPhase4Bundle {
  readonly modules: {
    readonly memory: typeof Memory;
    readonly novelty: typeof Novelty;
    readonly relationship: typeof Relationship;
    readonly sceneArchive: typeof SceneArchive;
    readonly playerModel: typeof PlayerModel;
    readonly semanticSimilarity: typeof SemanticSimilarity;
    readonly retrievalMemory: typeof RetrievalMemory;
    readonly retrievalContext: typeof RetrievalContext;
    readonly retrievalRanking: typeof RetrievalRanking;
    readonly experience: {
      readonly dramaOrchestrator: typeof DramaOrchestrator;
      readonly scenePlanner: typeof ScenePlanner;
      readonly momentLedger: typeof MomentLedger;
      readonly silencePolicy: typeof SilencePolicy;
    };
    readonly postrun: {
      readonly narrativeEngine: typeof PostRunNarrativeEngine;
      readonly turningPointResolver: typeof TurningPointResolver;
      readonly foreshadowPlanner: typeof ForeshadowPlanner;
    };
  };
  readonly surface: readonly BackendChatPhase4SurfaceDescriptor[];
}

export function createBackendChatPhase4Bundle(): BackendChatPhase4Bundle {
  return Object.freeze({
    modules: Object.freeze({
      memory: Memory,
      novelty: Novelty,
      relationship: Relationship,
      sceneArchive: SceneArchive,
      playerModel: PlayerModel,
      semanticSimilarity: SemanticSimilarity,
      retrievalMemory: RetrievalMemory,
      retrievalContext: RetrievalContext,
      retrievalRanking: RetrievalRanking,
      experience: Object.freeze({
        dramaOrchestrator: DramaOrchestrator,
        scenePlanner: ScenePlanner,
        momentLedger: MomentLedger,
        silencePolicy: SilencePolicy,
      }),
      postrun: Object.freeze({
        narrativeEngine: PostRunNarrativeEngine,
        turningPointResolver: TurningPointResolver,
        foreshadowPlanner: ForeshadowPlanner,
      }),
    }),
    surface: BACKEND_CHAT_PHASE4_SURFACE,
  });
}

export const BACKEND_CHAT_PHASE4_BUNDLE = createBackendChatPhase4Bundle();

export function listBackendChatPhase4Surface(): readonly BackendChatPhase4SurfaceDescriptor[] {
  return BACKEND_CHAT_PHASE4_SURFACE;
}

export function listBackendChatPhase4Groups(): readonly BackendChatPhase4ConcernGroup[] {
  return BACKEND_CHAT_PHASE4_GROUPS;
}

export function getBackendChatPhase4Descriptor(
  id: BackendChatPhase4SurfaceId,
): BackendChatPhase4SurfaceDescriptor | null {
  return BACKEND_CHAT_PHASE4_SURFACE.find((value) => value.id === id) ?? null;
}

export function listBackendChatPhase4ByConcern(
  concern: BackendChatPhase4Concern,
): readonly BackendChatPhase4SurfaceDescriptor[] {
  return Object.freeze(BACKEND_CHAT_PHASE4_SURFACE.filter((value) => value.concern === concern));
}

export function listBackendChatPhase4ExperienceDescriptors(): readonly BackendChatPhase4SurfaceDescriptor[] {
  return Object.freeze(
    BACKEND_CHAT_PHASE4_SURFACE.filter(
      (value) =>
        value.concern === 'DRAMA' ||
        value.concern === 'SCENE_PLANNING' ||
        value.concern === 'MOMENT_LEDGER' ||
        value.concern === 'SILENCE_POLICY' ||
        value.concern === 'POSTRUN_NARRATIVE' ||
        value.concern === 'TURNING_POINT' ||
        value.concern === 'FORESHADOW',
    ),
  );
}

export function listBackendChatPhase4ImportablePaths(): readonly string[] {
  return BACKEND_CHAT_PHASE4_IMPORTABLE_PATHS;
}

export function assertBackendChatPhase4SurfaceIntegrity(): readonly string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  const paths = new Set<string>();

  for (const descriptor of BACKEND_CHAT_PHASE4_SURFACE) {
    if (ids.has(descriptor.id)) issues.push(`duplicate_phase4_id:${descriptor.id}`);
    if (paths.has(descriptor.relativePath)) issues.push(`duplicate_phase4_path:${descriptor.relativePath}`);
    ids.add(descriptor.id);
    paths.add(descriptor.relativePath);

    if (descriptor.concern === 'DRAMA' || descriptor.concern === 'SCENE_PLANNING' || descriptor.concern === 'MOMENT_LEDGER' || descriptor.concern === 'SILENCE_POLICY') {
      if (!descriptor.relativePath.startsWith('./experience/')) {
        issues.push(`phase4_experience_path_mismatch:${descriptor.id}`);
      }
    }
  }

  return Object.freeze(issues);
}

export function createBackendChatPhase4Diagnostics(): Readonly<Record<string, unknown>> {
  return Object.freeze({
    total: BACKEND_CHAT_PHASE4_SURFACE.length,
    concerns: BACKEND_CHAT_PHASE4_GROUPS.map((group) => ({
      concern: group.concern,
      count: group.modules.length,
    })),
    importablePaths: [...BACKEND_CHAT_PHASE4_IMPORTABLE_PATHS],
    experiencePaths: [...BACKEND_CHAT_PHASE4_EXPERIENCE_PATHS],
    integrityIssues: [...assertBackendChatPhase4SurfaceIntegrity()],
  });
}

function phase4Surface(
  id: BackendChatPhase4SurfaceId,
  relativePath: string,
  concern: BackendChatPhase4Concern,
  generated: boolean,
  ownsTruth: boolean,
  description: string,
): BackendChatPhase4SurfaceDescriptor {
  return Object.freeze({
    id,
    relativePath,
    concern,
    generated,
    ownsTruth,
    description,
  });
}

function uniqueConcerns(
  descriptors: readonly BackendChatPhase4SurfaceDescriptor[],
): readonly BackendChatPhase4Concern[] {
  const seen = new Set<BackendChatPhase4Concern>();
  const concerns: BackendChatPhase4Concern[] = [];

  for (const descriptor of descriptors) {
    if (seen.has(descriptor.concern)) continue;
    seen.add(descriptor.concern);
    concerns.push(descriptor.concern);
  }

  return Object.freeze(concerns);
}