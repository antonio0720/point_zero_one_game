/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT PHASE-4 + EXPERIENCE BARREL
 * FILE: backend/src/game/engine/chat/phase4_index.ts
 * VERSION: 2026.03.18-experience-upgrade
 * AUTHORSHIP: Antonio T. Smith Jr.
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

// Explicit disambiguation: `now` and `dominantAxes` exist in multiple service
// modules. ChatRelationshipService owns the canonical barrel-level versions.
export { now, dominantAxes } from './ChatRelationshipService';
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

// ============================================================================
// MARK: Cross-module experience health types
// ============================================================================

export type Phase4ModuleHealthStatus = 'HEALTHY' | 'DEGRADED' | 'STALE' | 'OFFLINE';

export interface Phase4ModuleHealthEntry {
  readonly surfaceId: BackendChatPhase4SurfaceId;
  readonly concern: BackendChatPhase4Concern;
  readonly status: Phase4ModuleHealthStatus;
  readonly description: string;
  readonly checkedAt: number;
}

export interface Phase4HealthReport {
  readonly generatedAt: number;
  readonly modules: readonly Phase4ModuleHealthEntry[];
  readonly healthyCount: number;
  readonly degradedCount: number;
  readonly offlineCount: number;
  readonly staleCount: number;
  readonly overallStatus: Phase4ModuleHealthStatus;
  readonly criticalIssues: readonly string[];
}

export interface Phase4ModuleVersionMap {
  readonly memory: string;
  readonly novelty: string;
  readonly relationship: string;
  readonly sceneArchive: string;
  readonly playerModel: string;
  readonly semanticSimilarity: string;
  readonly retrievalMemory: string;
  readonly retrievalContext: string;
  readonly retrievalRanking: string;
  readonly dramaOrchestrator: string;
  readonly scenePlanner: string;
  readonly momentLedger: string;
  readonly silencePolicy: string;
  readonly postRunNarrative: string;
  readonly turningPointResolver: string;
  readonly foreshadowPlanner: string;
}

export interface Phase4ConcernHealthSummary {
  readonly concern: BackendChatPhase4Concern;
  readonly status: Phase4ModuleHealthStatus;
  readonly moduleCount: number;
  readonly issueCount: number;
}

// ============================================================================
// MARK: Cross-module experience event system
// ============================================================================

export type Phase4ExperienceEventKind =
  | 'PLAYER_MODEL_UPDATED'
  | 'RELATIONSHIP_CHANGED'
  | 'SCENE_ARCHIVED'
  | 'MEMORY_STORED'
  | 'NOVELTY_SUPPRESSED'
  | 'DRAMA_TRIGGERED'
  | 'SCENE_PLANNED'
  | 'MOMENT_RECORDED'
  | 'SILENCE_APPLIED'
  | 'POST_RUN_COMPOSED'
  | 'TURNING_POINT_DETECTED'
  | 'FORESHADOW_SEEDED'
  | 'RETRIEVAL_RANKED'
  | 'SEMANTIC_MATCH_FOUND';

export interface Phase4ExperienceEvent {
  readonly kind: Phase4ExperienceEventKind;
  readonly roomId: string;
  readonly userId?: string;
  readonly at: number;
  readonly surfaceId: BackendChatPhase4SurfaceId;
  readonly payload: Readonly<Record<string, unknown>>;
}

export type Phase4ExperienceEventHandler = (event: Phase4ExperienceEvent) => void;

export class Phase4ExperienceEventBus {
  private readonly handlers = new Map<Phase4ExperienceEventKind, Phase4ExperienceEventHandler[]>();
  private readonly wildcardHandlers: Phase4ExperienceEventHandler[] = [];

  subscribe(
    kind: Phase4ExperienceEventKind | '*',
    handler: Phase4ExperienceEventHandler,
  ): () => void {
    if (kind === '*') {
      this.wildcardHandlers.push(handler);
      return () => {
        const idx = this.wildcardHandlers.indexOf(handler);
        if (idx >= 0) this.wildcardHandlers.splice(idx, 1);
      };
    }
    if (!this.handlers.has(kind)) this.handlers.set(kind, []);
    this.handlers.get(kind)!.push(handler);
    return () => {
      const list = this.handlers.get(kind);
      if (!list) return;
      const idx = list.indexOf(handler);
      if (idx >= 0) list.splice(idx, 1);
    };
  }

  emit(event: Phase4ExperienceEvent): void {
    const specific = this.handlers.get(event.kind) ?? [];
    for (const h of specific) {
      try { h(event); } catch { /* isolated */ }
    }
    for (const h of this.wildcardHandlers) {
      try { h(event); } catch { /* isolated */ }
    }
  }

  emitMany(events: readonly Phase4ExperienceEvent[]): void {
    for (const e of events) this.emit(e);
  }

  listenerCount(kind?: Phase4ExperienceEventKind): number {
    if (kind) return this.handlers.get(kind)?.length ?? 0;
    return this.wildcardHandlers.length +
      [...this.handlers.values()].reduce((sum, list) => sum + list.length, 0);
  }

  clear(): void {
    this.handlers.clear();
    this.wildcardHandlers.length = 0;
  }
}

export function createPhase4ExperienceEventBus(): Phase4ExperienceEventBus {
  return new Phase4ExperienceEventBus();
}

// ============================================================================
// MARK: Cross-module experience pressure types
// ============================================================================

export type Phase4ExperiencePressureTier =
  | 'DORMANT'
  | 'AMBIENT'
  | 'BUILDING'
  | 'ELEVATED'
  | 'CRITICAL'
  | 'CEREMONIAL';

export interface Phase4ExperiencePressureVector {
  readonly roomId: string;
  readonly noveltyPressure01: number;
  readonly relationshipPressure01: number;
  readonly dramaPressure01: number;
  readonly silencePressure01: number;
  readonly postRunPressure01: number;
  readonly foreshadowPressure01: number;
  readonly semanticPressure01: number;
  readonly retrievalPressure01: number;
  readonly compositePressure01: number;
  readonly tier: Phase4ExperiencePressureTier;
  readonly computedAt: number;
}

export interface Phase4ExperiencePressureArgs {
  readonly roomId: string;
  readonly noveltyPressure01?: number;
  readonly relationshipPressure01?: number;
  readonly dramaPressure01?: number;
  readonly silencePressure01?: number;
  readonly postRunPressure01?: number;
  readonly foreshadowPressure01?: number;
  readonly semanticPressure01?: number;
  readonly retrievalPressure01?: number;
}

export function computePhase4ExperiencePressure(
  args: Phase4ExperiencePressureArgs,
  nowMs?: number,
): Phase4ExperiencePressureVector {
  const n01 = clamp01f(args.noveltyPressure01 ?? 0);
  const r01 = clamp01f(args.relationshipPressure01 ?? 0);
  const d01 = clamp01f(args.dramaPressure01 ?? 0);
  const s01 = clamp01f(args.silencePressure01 ?? 0);
  const pr01 = clamp01f(args.postRunPressure01 ?? 0);
  const f01 = clamp01f(args.foreshadowPressure01 ?? 0);
  const sem01 = clamp01f(args.semanticPressure01 ?? 0);
  const ret01 = clamp01f(args.retrievalPressure01 ?? 0);

  const composite = clamp01f(
    n01 * 0.14 +
    r01 * 0.18 +
    d01 * 0.20 +
    s01 * 0.10 +
    pr01 * 0.12 +
    f01 * 0.12 +
    sem01 * 0.08 +
    ret01 * 0.06,
  );

  return Object.freeze({
    roomId: args.roomId,
    noveltyPressure01: n01,
    relationshipPressure01: r01,
    dramaPressure01: d01,
    silencePressure01: s01,
    postRunPressure01: pr01,
    foreshadowPressure01: f01,
    semanticPressure01: sem01,
    retrievalPressure01: ret01,
    compositePressure01: composite,
    tier: derivePressureTier(composite),
    computedAt: nowMs ?? Date.now(),
  });
}

export function derivePressureTier(composite01: number): Phase4ExperiencePressureTier {
  if (composite01 < 0.08) return 'DORMANT';
  if (composite01 < 0.24) return 'AMBIENT';
  if (composite01 < 0.44) return 'BUILDING';
  if (composite01 < 0.62) return 'ELEVATED';
  if (composite01 < 0.82) return 'CRITICAL';
  return 'CEREMONIAL';
}

export function describeExperiencePressureTier(tier: Phase4ExperiencePressureTier): string {
  switch (tier) {
    case 'DORMANT': return 'Room is quiet. Continuity pressure is low. Haters and helpers are conserving.';
    case 'AMBIENT': return 'Low background pressure. Foreshadowing and relationship cues are accumulating.';
    case 'BUILDING': return 'Pressure is rising. Drama layer is waking up. Silence windows may activate soon.';
    case 'ELEVATED': return 'Significant pressure. Scene planning is active. Post-run narrative is primed.';
    case 'CRITICAL': return 'High pressure. All layers active. Turning points and foreshadow seeds are firing.';
    case 'CEREMONIAL': return 'Peak experience pressure. Maximum cinematic intensity. Narrative authority is fully engaged.';
  }
}

// ============================================================================
// MARK: Cross-module experience continuity
// ============================================================================

export interface Phase4ContinuityGapKind {
  readonly kind:
    | 'MEMORY_NOT_SEEDED'
    | 'RELATIONSHIP_COLD'
    | 'SCENE_ARCHIVE_EMPTY'
    | 'PLAYER_MODEL_STALE'
    | 'NOVELTY_WINDOW_EXPIRED'
    | 'DRAMA_LAYER_INACTIVE'
    | 'MOMENT_LEDGER_EMPTY'
    | 'FORESHADOW_NOT_SEEDED'
    | 'RETRIEVAL_INDEX_COLD';
  readonly severity: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly description: string;
  readonly remediation: string;
}

export interface Phase4ContinuityAssessment {
  readonly roomId: string;
  readonly userId?: string;
  readonly gaps: readonly Phase4ContinuityGapKind[];
  readonly continuityScore01: number;
  readonly isReadyForCinematicExperience: boolean;
  readonly isReadyForPostRun: boolean;
  readonly isReadyForForeshadow: boolean;
  readonly assessedAt: number;
}

export interface Phase4ContinuityAssessmentArgs {
  readonly roomId: string;
  readonly userId?: string;
  readonly hasMemorySeeds: boolean;
  readonly hasRelationshipState: boolean;
  readonly hasSceneArchiveEntries: boolean;
  readonly hasPlayerModelSnapshot: boolean;
  readonly noveltyWindowActive: boolean;
  readonly dramaLayerActive: boolean;
  readonly momentLedgerHasEntries: boolean;
  readonly hasForeshadowSeeds: boolean;
  readonly retrievalIndexWarm: boolean;
  readonly nowMs?: number;
}

export function assessPhase4Continuity(
  args: Phase4ContinuityAssessmentArgs,
): Phase4ContinuityAssessment {
  const gaps: Phase4ContinuityGapKind[] = [];

  if (!args.hasMemorySeeds) {
    gaps.push({
      kind: 'MEMORY_NOT_SEEDED',
      severity: 'MEDIUM',
      description: 'No episodic memory anchors have been established for this player.',
      remediation: 'Trigger an initial memory seed pass via ChatMemoryService on first meaningful interaction.',
    });
  }

  if (!args.hasRelationshipState) {
    gaps.push({
      kind: 'RELATIONSHIP_COLD',
      severity: 'HIGH',
      description: 'No relationship state is tracked for this player and room combination.',
      remediation: 'Initialize relationship vector via ChatRelationshipService at session open.',
    });
  }

  if (!args.hasSceneArchiveEntries) {
    gaps.push({
      kind: 'SCENE_ARCHIVE_EMPTY',
      severity: 'LOW',
      description: 'The scene archive is empty for this player. No recall scenes are available.',
      remediation: 'Allow the first scene to complete before expecting archive-backed continuity.',
    });
  }

  if (!args.hasPlayerModelSnapshot) {
    gaps.push({
      kind: 'PLAYER_MODEL_STALE',
      severity: 'HIGH',
      description: 'No player model snapshot is available. Adaptive NPC behavior will use flat defaults.',
      remediation: 'Write a baseline player model snapshot via ChatPlayerModelService at session start.',
    });
  }

  if (!args.noveltyWindowActive) {
    gaps.push({
      kind: 'NOVELTY_WINDOW_EXPIRED',
      severity: 'LOW',
      description: 'Novelty suppression windows have expired or were never initialized.',
      remediation: 'Prime the novelty index when the room boots to prevent repetition from frame one.',
    });
  }

  if (!args.dramaLayerActive) {
    gaps.push({
      kind: 'DRAMA_LAYER_INACTIVE',
      severity: 'MEDIUM',
      description: 'The drama orchestrator has no active scene arc. Cinematic moments will be flat.',
      remediation: 'Boot the drama orchestrator with room state and initial pressure assessment.',
    });
  }

  if (!args.momentLedgerHasEntries) {
    gaps.push({
      kind: 'MOMENT_LEDGER_EMPTY',
      severity: 'LOW',
      description: 'Moment ledger has no recorded entries for this session.',
      remediation: 'Moment ledger builds passively; allow one full NPC exchange to initialize it.',
    });
  }

  if (!args.hasForeshadowSeeds) {
    gaps.push({
      kind: 'FORESHADOW_NOT_SEEDED',
      severity: 'MEDIUM',
      description: 'No foreshadow directives are queued for this player.',
      remediation: 'Run ForeshadowPlanner after the first post-run summary is available.',
    });
  }

  if (!args.retrievalIndexWarm) {
    gaps.push({
      kind: 'RETRIEVAL_INDEX_COLD',
      severity: 'MEDIUM',
      description: 'The retrieval memory index has no anchors. Callback and continuity authoring will be generic.',
      remediation: 'Index the first run summary into MemoryAnchorStore after run completion.',
    });
  }

  const highCount = gaps.filter((g) => g.severity === 'HIGH').length;
  const medCount = gaps.filter((g) => g.severity === 'MEDIUM').length;
  const totalPenalty = highCount * 0.22 + medCount * 0.10 + (gaps.length - highCount - medCount) * 0.04;
  const score = clamp01f(1 - totalPenalty);

  return Object.freeze({
    roomId: args.roomId,
    userId: args.userId,
    gaps: Object.freeze(gaps),
    continuityScore01: score,
    isReadyForCinematicExperience: !args.dramaLayerActive === false && score >= 0.5,
    isReadyForPostRun: args.hasSceneArchiveEntries && args.hasPlayerModelSnapshot,
    isReadyForForeshadow: args.hasPlayerModelSnapshot && args.retrievalIndexWarm,
    assessedAt: args.nowMs ?? Date.now(),
  });
}

export function describeContinuityAssessment(assessment: Phase4ContinuityAssessment): string {
  const lines: string[] = [
    `continuity_score=${assessment.continuityScore01.toFixed(2)}`,
    `gaps=${assessment.gaps.length}`,
    `cinematic_ready=${assessment.isReadyForCinematicExperience}`,
    `postrun_ready=${assessment.isReadyForPostRun}`,
    `foreshadow_ready=${assessment.isReadyForForeshadow}`,
  ];
  if (assessment.gaps.length > 0) {
    lines.push(`critical_gaps=[${assessment.gaps.filter((g) => g.severity === 'HIGH').map((g) => g.kind).join(',')}]`);
  }
  return lines.join(' | ');
}

// ============================================================================
// MARK: Cross-module health probe
// ============================================================================

export function buildPhase4HealthReport(
  modulePing: Readonly<Record<BackendChatPhase4SurfaceId, boolean>>,
  nowMs?: number,
): Phase4HealthReport {
  const at = nowMs ?? Date.now();
  const entries: Phase4ModuleHealthEntry[] = [];

  for (const descriptor of BACKEND_CHAT_PHASE4_SURFACE) {
    const alive = modulePing[descriptor.id] ?? false;
    const status: Phase4ModuleHealthStatus = alive ? 'HEALTHY' : 'OFFLINE';
    entries.push(Object.freeze({
      surfaceId: descriptor.id,
      concern: descriptor.concern,
      status,
      description: alive ? `${descriptor.id} responded to ping.` : `${descriptor.id} did not respond.`,
      checkedAt: at,
    }));
  }

  const healthy = entries.filter((e) => e.status === 'HEALTHY').length;
  const degraded = entries.filter((e) => e.status === 'DEGRADED').length;
  const offline = entries.filter((e) => e.status === 'OFFLINE').length;
  const stale = entries.filter((e) => e.status === 'STALE').length;
  const criticalIssues = entries
    .filter((e) => e.status === 'OFFLINE')
    .map((e) => `offline:${e.surfaceId}`);

  let overallStatus: Phase4ModuleHealthStatus = 'HEALTHY';
  if (offline > 0) overallStatus = 'OFFLINE';
  else if (degraded > 2) overallStatus = 'DEGRADED';
  else if (stale > 0) overallStatus = 'STALE';

  return Object.freeze({
    generatedAt: at,
    modules: Object.freeze(entries),
    healthyCount: healthy,
    degradedCount: degraded,
    offlineCount: offline,
    staleCount: stale,
    overallStatus,
    criticalIssues: Object.freeze(criticalIssues),
  });
}

export function summarizePhase4HealthReport(report: Phase4HealthReport): string {
  return [
    `overall=${report.overallStatus}`,
    `healthy=${report.healthyCount}`,
    `degraded=${report.degradedCount}`,
    `offline=${report.offlineCount}`,
    `stale=${report.staleCount}`,
    report.criticalIssues.length > 0 ? `critical=[${report.criticalIssues.join(',')}]` : '',
  ].filter(Boolean).join(' | ');
}

export function getPhase4HealthByConcern(report: Phase4HealthReport): readonly Phase4ConcernHealthSummary[] {
  const map = new Map<BackendChatPhase4Concern, { count: number; issues: number; worst: Phase4ModuleHealthStatus }>();

  for (const entry of report.modules) {
    const existing = map.get(entry.concern) ?? { count: 0, issues: 0, worst: 'HEALTHY' };
    const issueCount = entry.status !== 'HEALTHY' ? existing.issues + 1 : existing.issues;
    const worst = phase4HealthWorst(existing.worst, entry.status);
    map.set(entry.concern, { count: existing.count + 1, issues: issueCount, worst });
  }

  return Object.freeze(
    [...map.entries()].map(([concern, { count, issues, worst }]) =>
      Object.freeze({ concern, status: worst, moduleCount: count, issueCount: issues }),
    ),
  );
}

function phase4HealthWorst(
  a: Phase4ModuleHealthStatus,
  b: Phase4ModuleHealthStatus,
): Phase4ModuleHealthStatus {
  const rank: Record<Phase4ModuleHealthStatus, number> = { HEALTHY: 0, STALE: 1, DEGRADED: 2, OFFLINE: 3 };
  return rank[a] >= rank[b] ? a : b;
}

// ============================================================================
// MARK: Module version map
// ============================================================================

export function buildPhase4ModuleVersionMap(): Phase4ModuleVersionMap {
  // Only SceneArchive and PlayerModel expose a module-version constant at the
  // top level of their namespace. All other modules are tagged 'installed' —
  // their version is not exported as a standalone constant from the individual
  // service files. Use BACKEND_CHAT_PHASE4_MODULES for namespace access.
  return Object.freeze({
    memory: 'installed',
    novelty: 'installed',
    relationship: 'installed',
    sceneArchive: SceneArchive.CHAT_SCENE_ARCHIVE_MODULE_VERSION,
    playerModel: PlayerModel.CHAT_PLAYER_MODEL_MODULE_VERSION,
    semanticSimilarity: 'installed',
    retrievalMemory: 'installed',
    retrievalContext: 'installed',
    retrievalRanking: 'installed',
    dramaOrchestrator: 'installed',
    scenePlanner: 'installed',
    momentLedger: 'installed',
    silencePolicy: 'installed',
    postRunNarrative: 'installed',
    turningPointResolver: 'installed',
    foreshadowPlanner: 'installed',
  });
}

// ============================================================================
// MARK: Experience pressure epoch tracker
// ============================================================================

export interface Phase4PressureEpochEntry {
  readonly roomId: string;
  readonly pressure: Phase4ExperiencePressureVector;
  readonly at: number;
}

export class Phase4PressureEpochTracker {
  private readonly epochs = new Map<string, Phase4PressureEpochEntry[]>();
  private readonly maxEntriesPerRoom: number;

  constructor(maxEntriesPerRoom = 128) {
    this.maxEntriesPerRoom = maxEntriesPerRoom;
  }

  record(roomId: string, pressure: Phase4ExperiencePressureVector): void {
    if (!this.epochs.has(roomId)) this.epochs.set(roomId, []);
    const list = this.epochs.get(roomId)!;
    list.push(Object.freeze({ roomId, pressure, at: pressure.computedAt }));
    if (list.length > this.maxEntriesPerRoom) list.splice(0, list.length - this.maxEntriesPerRoom);
  }

  getHistory(roomId: string): readonly Phase4PressureEpochEntry[] {
    return Object.freeze(this.epochs.get(roomId) ?? []);
  }

  getLatest(roomId: string): Phase4PressureEpochEntry | null {
    const list = this.epochs.get(roomId);
    return list?.[list.length - 1] ?? null;
  }

  listRooms(): readonly string[] {
    return Object.freeze([...this.epochs.keys()]);
  }

  computeTrend(roomId: string, windowSize = 5): 'RISING' | 'FALLING' | 'STABLE' {
    const history = this.getHistory(roomId);
    if (history.length < 2) return 'STABLE';
    const window = history.slice(-Math.min(windowSize, history.length));
    const first = window[0]?.pressure.compositePressure01 ?? 0;
    const last = window[window.length - 1]?.pressure.compositePressure01 ?? 0;
    const delta = last - first;
    if (delta > 0.06) return 'RISING';
    if (delta < -0.06) return 'FALLING';
    return 'STABLE';
  }

  clear(roomId: string): void {
    this.epochs.delete(roomId);
  }

  clearAll(): void {
    this.epochs.clear();
  }
}

export function createPhase4PressureEpochTracker(
  maxEntriesPerRoom?: number,
): Phase4PressureEpochTracker {
  return new Phase4PressureEpochTracker(maxEntriesPerRoom);
}

// ============================================================================
// MARK: Experience pressure statistics
// ============================================================================

export interface Phase4PressureStats {
  readonly roomId: string;
  readonly sampleCount: number;
  readonly maxComposite: number;
  readonly minComposite: number;
  readonly avgComposite: number;
  readonly peakTier: Phase4ExperiencePressureTier;
  readonly predominantTier: Phase4ExperiencePressureTier;
}

export function buildPhase4PressureStats(
  roomId: string,
  history: readonly Phase4PressureEpochEntry[],
): Phase4PressureStats {
  if (history.length === 0) {
    return Object.freeze({
      roomId,
      sampleCount: 0,
      maxComposite: 0,
      minComposite: 0,
      avgComposite: 0,
      peakTier: 'DORMANT',
      predominantTier: 'DORMANT',
    });
  }

  let max = 0;
  let min = 1;
  let sum = 0;
  const tierCounts = new Map<Phase4ExperiencePressureTier, number>();

  for (const entry of history) {
    const c = entry.pressure.compositePressure01;
    if (c > max) max = c;
    if (c < min) min = c;
    sum += c;
    const t = entry.pressure.tier;
    tierCounts.set(t, (tierCounts.get(t) ?? 0) + 1);
  }

  const predominantTier = [...tierCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'DORMANT';

  return Object.freeze({
    roomId,
    sampleCount: history.length,
    maxComposite: max,
    minComposite: min,
    avgComposite: sum / history.length,
    peakTier: derivePressureTier(max),
    predominantTier,
  });
}

// ============================================================================
// MARK: Concern surface analytics
// ============================================================================

export interface Phase4ConcernSurfaceEntry {
  readonly concern: BackendChatPhase4Concern;
  readonly surfaceCount: number;
  readonly surfaceIds: readonly BackendChatPhase4SurfaceId[];
  readonly experienceFocused: boolean;
  readonly ownsTruthCount: number;
}

export function buildConcernSurfaceAnalytics(): readonly Phase4ConcernSurfaceEntry[] {
  const map = new Map<BackendChatPhase4Concern, BackendChatPhase4SurfaceDescriptor[]>();

  for (const descriptor of BACKEND_CHAT_PHASE4_SURFACE) {
    if (!map.has(descriptor.concern)) map.set(descriptor.concern, []);
    map.get(descriptor.concern)!.push(descriptor);
  }

  const experienceConcerns = new Set<BackendChatPhase4Concern>([
    'DRAMA', 'SCENE_PLANNING', 'MOMENT_LEDGER', 'SILENCE_POLICY',
    'POSTRUN_NARRATIVE', 'TURNING_POINT', 'FORESHADOW',
  ]);

  return Object.freeze(
    [...map.entries()].map(([concern, descriptors]) =>
      Object.freeze({
        concern,
        surfaceCount: descriptors.length,
        surfaceIds: Object.freeze(descriptors.map((d) => d.id)),
        experienceFocused: experienceConcerns.has(concern),
        ownsTruthCount: descriptors.filter((d) => d.ownsTruth).length,
      }),
    ),
  );
}

export function getConcernSurfaceEntry(
  concern: BackendChatPhase4Concern,
): Phase4ConcernSurfaceEntry | null {
  return buildConcernSurfaceAnalytics().find((e) => e.concern === concern) ?? null;
}

export function listExperienceFocusedConcerns(): readonly BackendChatPhase4Concern[] {
  return Object.freeze(
    buildConcernSurfaceAnalytics()
      .filter((e) => e.experienceFocused)
      .map((e) => e.concern),
  );
}

// ============================================================================
// MARK: Module integrity assertion
// ============================================================================

export interface Phase4IntegrityReport {
  readonly totalSurfaces: number;
  readonly uniqueConcernCount: number;
  readonly experienceSurfaceCount: number;
  readonly retrievalSurfaceCount: number;
  readonly memoryLayerSurfaceCount: number;
  readonly issues: readonly string[];
  readonly integrityScore01: number;
}

export function buildPhase4IntegrityReport(): Phase4IntegrityReport {
  const issues = [...assertBackendChatPhase4SurfaceIntegrity()];

  const experienceConcerns = new Set<BackendChatPhase4Concern>([
    'DRAMA', 'SCENE_PLANNING', 'MOMENT_LEDGER', 'SILENCE_POLICY',
    'POSTRUN_NARRATIVE', 'TURNING_POINT', 'FORESHADOW',
  ]);
  const retrievalConcerns = new Set<BackendChatPhase4Concern>([
    'RETRIEVAL_MEMORY', 'RETRIEVAL_CONTEXT', 'RETRIEVAL_RANKING', 'SEMANTIC_SIMILARITY',
  ]);
  const memoryLayerConcerns = new Set<BackendChatPhase4Concern>([
    'MEMORY', 'NOVELTY', 'RELATIONSHIP',
  ]);

  const experienceCount = BACKEND_CHAT_PHASE4_SURFACE.filter((s) => experienceConcerns.has(s.concern)).length;
  const retrievalCount = BACKEND_CHAT_PHASE4_SURFACE.filter((s) => retrievalConcerns.has(s.concern)).length;
  const memoryCount = BACKEND_CHAT_PHASE4_SURFACE.filter((s) => memoryLayerConcerns.has(s.concern)).length;

  const integrityScore = clamp01f(1 - issues.length * 0.12);

  return Object.freeze({
    totalSurfaces: BACKEND_CHAT_PHASE4_SURFACE.length,
    uniqueConcernCount: BACKEND_CHAT_PHASE4_GROUPS.length,
    experienceSurfaceCount: experienceCount,
    retrievalSurfaceCount: retrievalCount,
    memoryLayerSurfaceCount: memoryCount,
    issues: Object.freeze(issues),
    integrityScore01: integrityScore,
  });
}

export function assertPhase4Integrity(): void {
  const report = buildPhase4IntegrityReport();
  if (report.issues.length > 0) {
    throw new Error(
      `BackendChatPhase4 integrity violation(s): ${report.issues.join('; ')}`,
    );
  }
}

// ============================================================================
// MARK: Experience readiness gate
// ============================================================================

export type Phase4ExperienceReadinessKind =
  | 'MEMORY_LAYER'
  | 'RELATIONSHIP_LAYER'
  | 'SCENE_ARCHIVE_LAYER'
  | 'PLAYER_MODEL_LAYER'
  | 'SEMANTIC_LAYER'
  | 'RETRIEVAL_LAYER'
  | 'DRAMA_LAYER'
  | 'SCENE_PLANNING_LAYER'
  | 'MOMENT_LEDGER_LAYER'
  | 'SILENCE_LAYER'
  | 'POSTRUN_LAYER'
  | 'FORESHADOW_LAYER';

export interface Phase4ExperienceReadinessEntry {
  readonly kind: Phase4ExperienceReadinessKind;
  readonly ready: boolean;
  readonly reason: string;
}

export interface Phase4ExperienceReadinessGate {
  readonly entries: readonly Phase4ExperienceReadinessEntry[];
  readonly allReady: boolean;
  readonly readyCount: number;
  readonly notReadyCount: number;
  readonly readinessScore01: number;
}

export function buildPhase4ExperienceReadinessGate(
  readiness: Partial<Record<Phase4ExperienceReadinessKind, boolean>>,
): Phase4ExperienceReadinessGate {
  const ALL_KINDS: readonly Phase4ExperienceReadinessKind[] = [
    'MEMORY_LAYER',
    'RELATIONSHIP_LAYER',
    'SCENE_ARCHIVE_LAYER',
    'PLAYER_MODEL_LAYER',
    'SEMANTIC_LAYER',
    'RETRIEVAL_LAYER',
    'DRAMA_LAYER',
    'SCENE_PLANNING_LAYER',
    'MOMENT_LEDGER_LAYER',
    'SILENCE_LAYER',
    'POSTRUN_LAYER',
    'FORESHADOW_LAYER',
  ];

  const DESCRIPTIONS: Record<Phase4ExperienceReadinessKind, string> = {
    MEMORY_LAYER: 'Episodic memory anchors seeded and indexed',
    RELATIONSHIP_LAYER: 'Relationship state initialized for player/room',
    SCENE_ARCHIVE_LAYER: 'At least one archived scene available for recall',
    PLAYER_MODEL_LAYER: 'Player model snapshot current and actionable',
    SEMANTIC_LAYER: 'Semantic similarity index warm',
    RETRIEVAL_LAYER: 'Retrieval anchor store has indexed entries',
    DRAMA_LAYER: 'Drama orchestrator has active scene arc',
    SCENE_PLANNING_LAYER: 'Scene planner has queued a moment sequence',
    MOMENT_LEDGER_LAYER: 'Moment ledger has at least one recorded entry',
    SILENCE_LAYER: 'Silence policy has evaluated at least once',
    POSTRUN_LAYER: 'Post-run narrative is primed or has completed at least once',
    FORESHADOW_LAYER: 'Foreshadow planner has seeded at least one directive',
  };

  const entries: Phase4ExperienceReadinessEntry[] = ALL_KINDS.map((kind) => {
    const ready = readiness[kind] ?? false;
    return Object.freeze({
      kind,
      ready,
      reason: ready ? DESCRIPTIONS[kind] : `Not ready: ${DESCRIPTIONS[kind]}`,
    });
  });

  const readyCount = entries.filter((e) => e.ready).length;
  const notReadyCount = entries.length - readyCount;

  return Object.freeze({
    entries: Object.freeze(entries),
    allReady: notReadyCount === 0,
    readyCount,
    notReadyCount,
    readinessScore01: clamp01f(readyCount / entries.length),
  });
}

export function describeReadinessGate(gate: Phase4ExperienceReadinessGate): string {
  const notReady = gate.entries.filter((e) => !e.ready).map((e) => e.kind);
  return gate.allReady
    ? `all_layers_ready score=1.00`
    : `score=${gate.readinessScore01.toFixed(2)} not_ready=[${notReady.join(',')}]`;
}

// ============================================================================
// MARK: Batch room pressure scan
// ============================================================================

export interface Phase4BatchRoomPressureScanResult {
  readonly results: readonly { readonly roomId: string; readonly pressure: Phase4ExperiencePressureVector }[];
  readonly highPressureRoomIds: readonly string[];
  readonly criticalRoomIds: readonly string[];
  readonly scannedAt: number;
}

export function runPhase4BatchRoomPressureScan(
  rooms: readonly Phase4ExperiencePressureArgs[],
  nowMs?: number,
): Phase4BatchRoomPressureScanResult {
  const at = nowMs ?? Date.now();
  const results = rooms.map((args) => ({
    roomId: args.roomId,
    pressure: computePhase4ExperiencePressure(args, at),
  }));

  const highPressureRoomIds = results
    .filter((r) => r.pressure.compositePressure01 >= 0.62)
    .map((r) => r.roomId);

  const criticalRoomIds = results
    .filter((r) => r.pressure.tier === 'CRITICAL' || r.pressure.tier === 'CEREMONIAL')
    .map((r) => r.roomId);

  return Object.freeze({
    results: Object.freeze(results.map((r) => Object.freeze(r))),
    highPressureRoomIds: Object.freeze(highPressureRoomIds),
    criticalRoomIds: Object.freeze(criticalRoomIds),
    scannedAt: at,
  });
}

// ============================================================================
// MARK: Experience layer fingerprint
// ============================================================================

export interface Phase4ExperienceLayerFingerprint {
  readonly surfaceCount: number;
  readonly concernCount: number;
  readonly experienceSurfaceCount: number;
  readonly retrievalSurfaceCount: number;
  readonly moduleVersion: string;
  readonly integrityScore01: number;
  readonly generatedAt: number;
}

export function computePhase4ExperienceLayerFingerprint(
  nowMs?: number,
): Phase4ExperienceLayerFingerprint {
  const integrity = buildPhase4IntegrityReport();
  return Object.freeze({
    surfaceCount: integrity.totalSurfaces,
    concernCount: integrity.uniqueConcernCount,
    experienceSurfaceCount: integrity.experienceSurfaceCount,
    retrievalSurfaceCount: integrity.retrievalSurfaceCount,
    moduleVersion: BACKEND_CHAT_PHASE4_BUNDLE.modules.sceneArchive.CHAT_SCENE_ARCHIVE_MODULE_VERSION ?? 'unknown',
    integrityScore01: integrity.integrityScore01,
    generatedAt: nowMs ?? Date.now(),
  });
}

// ============================================================================
// MARK: Cross-module diagnostics payload
// ============================================================================

export interface Phase4FullDiagnosticsPayload {
  readonly phase4Diagnostics: Readonly<Record<string, unknown>>;
  readonly integrityReport: Phase4IntegrityReport;
  readonly concernSurfaces: readonly Phase4ConcernSurfaceEntry[];
  readonly experienceLayerFingerprint: Phase4ExperienceLayerFingerprint;
  readonly moduleCount: number;
  readonly generatedAt: number;
}

export function buildPhase4FullDiagnosticsPayload(
  nowMs?: number,
): Phase4FullDiagnosticsPayload {
  const at = nowMs ?? Date.now();
  return Object.freeze({
    phase4Diagnostics: createBackendChatPhase4Diagnostics(),
    integrityReport: buildPhase4IntegrityReport(),
    concernSurfaces: buildConcernSurfaceAnalytics(),
    experienceLayerFingerprint: computePhase4ExperienceLayerFingerprint(at),
    moduleCount: BACKEND_CHAT_PHASE4_SURFACE.length,
    generatedAt: at,
  });
}

// ============================================================================
// MARK: Surface lookup utilities
// ============================================================================

export function listSurfacesByTruthOwnership(): readonly BackendChatPhase4SurfaceDescriptor[] {
  return Object.freeze(BACKEND_CHAT_PHASE4_SURFACE.filter((s) => s.ownsTruth));
}

export function listSurfacesByGeneratedStatus(generated: boolean): readonly BackendChatPhase4SurfaceDescriptor[] {
  return Object.freeze(BACKEND_CHAT_PHASE4_SURFACE.filter((s) => s.generated === generated));
}

export function findSurfacesByRelativePath(pathFragment: string): readonly BackendChatPhase4SurfaceDescriptor[] {
  return Object.freeze(
    BACKEND_CHAT_PHASE4_SURFACE.filter((s) => s.relativePath.includes(pathFragment)),
  );
}

export function describeSurface(descriptor: BackendChatPhase4SurfaceDescriptor): string {
  return [
    `id=${descriptor.id}`,
    `concern=${descriptor.concern}`,
    `path=${descriptor.relativePath}`,
    `ownsTruth=${descriptor.ownsTruth}`,
    descriptor.description,
  ].join(' | ');
}

export function describeSurfaceShort(descriptor: BackendChatPhase4SurfaceDescriptor): string {
  return `[${descriptor.concern}] ${descriptor.id} — ${descriptor.description}`;
}

// ============================================================================
// MARK: Retrieval module surface utilities
// ============================================================================

export interface Phase4RetrievalSurfaceSummary {
  readonly memoryAnchorSurfaceId: BackendChatPhase4SurfaceId;
  readonly retrievalContextSurfaceId: BackendChatPhase4SurfaceId;
  readonly retrievalRankingSurfaceId: BackendChatPhase4SurfaceId;
  readonly semanticSimilaritySurfaceId: BackendChatPhase4SurfaceId;
  readonly allPresent: boolean;
}

export function buildRetrievalSurfaceSummary(): Phase4RetrievalSurfaceSummary {
  const ids = new Set(BACKEND_CHAT_PHASE4_SURFACE.map((s) => s.id));
  return Object.freeze({
    memoryAnchorSurfaceId: 'intelligence.dl.MemoryAnchorStore',
    retrievalContextSurfaceId: 'intelligence.dl.RetrievalContextBuilder',
    retrievalRankingSurfaceId: 'intelligence.dl.MemoryRankingPolicy',
    semanticSimilaritySurfaceId: 'ChatSemanticSimilarityIndex',
    allPresent:
      ids.has('intelligence.dl.MemoryAnchorStore') &&
      ids.has('intelligence.dl.RetrievalContextBuilder') &&
      ids.has('intelligence.dl.MemoryRankingPolicy') &&
      ids.has('ChatSemanticSimilarityIndex'),
  });
}

export function isRetrievalLayerComplete(): boolean {
  return buildRetrievalSurfaceSummary().allPresent;
}

// ============================================================================
// MARK: Post-run surface utilities
// ============================================================================

export interface Phase4PostRunSurfaceSummary {
  readonly narrativeEngineSurfaceId: BackendChatPhase4SurfaceId;
  readonly turningPointSurfaceId: BackendChatPhase4SurfaceId;
  readonly foreshadowSurfaceId: BackendChatPhase4SurfaceId;
  readonly allPresent: boolean;
}

export function buildPostRunSurfaceSummary(): Phase4PostRunSurfaceSummary {
  const ids = new Set(BACKEND_CHAT_PHASE4_SURFACE.map((s) => s.id));
  return Object.freeze({
    narrativeEngineSurfaceId: 'postrun.PostRunNarrativeEngine',
    turningPointSurfaceId: 'postrun.TurningPointResolver',
    foreshadowSurfaceId: 'postrun.ForeshadowPlanner',
    allPresent:
      ids.has('postrun.PostRunNarrativeEngine') &&
      ids.has('postrun.TurningPointResolver') &&
      ids.has('postrun.ForeshadowPlanner'),
  });
}

export function isPostRunLayerComplete(): boolean {
  return buildPostRunSurfaceSummary().allPresent;
}

// ============================================================================
// MARK: Cross-module deep concern report
// ============================================================================

export interface Phase4DeepConcernReport {
  readonly concern: BackendChatPhase4Concern;
  readonly surfaces: readonly BackendChatPhase4SurfaceDescriptor[];
  readonly truthOwnerCount: number;
  readonly hasExperienceFocus: boolean;
  readonly importablePaths: readonly string[];
  readonly description: string;
}

export function buildDeepConcernReport(concern: BackendChatPhase4Concern): Phase4DeepConcernReport {
  const surfaces = listBackendChatPhase4ByConcern(concern);
  const experienceConcerns = new Set<BackendChatPhase4Concern>([
    'DRAMA', 'SCENE_PLANNING', 'MOMENT_LEDGER', 'SILENCE_POLICY',
    'POSTRUN_NARRATIVE', 'TURNING_POINT', 'FORESHADOW',
  ]);

  return Object.freeze({
    concern,
    surfaces,
    truthOwnerCount: surfaces.filter((s) => s.ownsTruth).length,
    hasExperienceFocus: experienceConcerns.has(concern),
    importablePaths: Object.freeze(surfaces.map((s) => s.relativePath)),
    description: surfaces.map((s) => s.description).join('; '),
  });
}

export function buildAllDeepConcernReports(): readonly Phase4DeepConcernReport[] {
  const concerns = BACKEND_CHAT_PHASE4_GROUPS.map((g) => g.concern);
  return Object.freeze(concerns.map(buildDeepConcernReport));
}

// ============================================================================
// MARK: Experience pressure watch bus
// ============================================================================

export type Phase4PressureWatchEventKind =
  | 'PRESSURE_TIER_CHANGED'
  | 'PRESSURE_CRITICAL'
  | 'PRESSURE_DORMANT'
  | 'PRESSURE_RECORDED';

export interface Phase4PressureWatchEvent {
  readonly kind: Phase4PressureWatchEventKind;
  readonly roomId: string;
  readonly tier: Phase4ExperiencePressureTier;
  readonly compositePressure01: number;
  readonly at: number;
}

export type Phase4PressureWatchHandler = (event: Phase4PressureWatchEvent) => void;

export class Phase4PressureWatchBus {
  private readonly handlers: Phase4PressureWatchHandler[] = [];

  subscribe(handler: Phase4PressureWatchHandler): () => void {
    this.handlers.push(handler);
    return () => {
      const idx = this.handlers.indexOf(handler);
      if (idx >= 0) this.handlers.splice(idx, 1);
    };
  }

  emit(event: Phase4PressureWatchEvent): void {
    for (const h of this.handlers) {
      try { h(event); } catch { /* isolated */ }
    }
  }

  emitFromPressure(pressure: Phase4ExperiencePressureVector, prevTier?: Phase4ExperiencePressureTier): void {
    const kind: Phase4PressureWatchEventKind =
      pressure.tier === 'CRITICAL' || pressure.tier === 'CEREMONIAL'
        ? 'PRESSURE_CRITICAL'
        : pressure.tier === 'DORMANT'
        ? 'PRESSURE_DORMANT'
        : prevTier && prevTier !== pressure.tier
        ? 'PRESSURE_TIER_CHANGED'
        : 'PRESSURE_RECORDED';

    this.emit(Object.freeze({
      kind,
      roomId: pressure.roomId,
      tier: pressure.tier,
      compositePressure01: pressure.compositePressure01,
      at: pressure.computedAt,
    }));
  }

  get listenerCount(): number {
    return this.handlers.length;
  }
}

export function createPhase4PressureWatchBus(): Phase4PressureWatchBus {
  return new Phase4PressureWatchBus();
}

// ============================================================================
// MARK: Global phase-4 experience summary
// ============================================================================

export interface Phase4GlobalExperienceSummary {
  readonly totalSurfaces: number;
  readonly totalConcerns: number;
  readonly experienceSurfaces: readonly BackendChatPhase4SurfaceDescriptor[];
  readonly retrievalSurfaces: readonly BackendChatPhase4SurfaceDescriptor[];
  readonly memoryLayerSurfaces: readonly BackendChatPhase4SurfaceDescriptor[];
  readonly retrievalLayerComplete: boolean;
  readonly postRunLayerComplete: boolean;
  readonly integrityScore01: number;
  readonly moduleDescriptorVersion: string;
}

export function buildPhase4GlobalExperienceSummary(): Phase4GlobalExperienceSummary {
  const integrity = buildPhase4IntegrityReport();
  const experienceConcerns = new Set<BackendChatPhase4Concern>([
    'DRAMA', 'SCENE_PLANNING', 'MOMENT_LEDGER', 'SILENCE_POLICY',
    'POSTRUN_NARRATIVE', 'TURNING_POINT', 'FORESHADOW',
  ]);
  const retrievalConcerns = new Set<BackendChatPhase4Concern>([
    'RETRIEVAL_MEMORY', 'RETRIEVAL_CONTEXT', 'RETRIEVAL_RANKING', 'SEMANTIC_SIMILARITY',
  ]);
  const memoryLayerConcerns = new Set<BackendChatPhase4Concern>([
    'MEMORY', 'NOVELTY', 'RELATIONSHIP',
  ]);

  return Object.freeze({
    totalSurfaces: BACKEND_CHAT_PHASE4_SURFACE.length,
    totalConcerns: BACKEND_CHAT_PHASE4_GROUPS.length,
    experienceSurfaces: Object.freeze(BACKEND_CHAT_PHASE4_SURFACE.filter((s) => experienceConcerns.has(s.concern))),
    retrievalSurfaces: Object.freeze(BACKEND_CHAT_PHASE4_SURFACE.filter((s) => retrievalConcerns.has(s.concern))),
    memoryLayerSurfaces: Object.freeze(BACKEND_CHAT_PHASE4_SURFACE.filter((s) => memoryLayerConcerns.has(s.concern))),
    retrievalLayerComplete: isRetrievalLayerComplete(),
    postRunLayerComplete: isPostRunLayerComplete(),
    integrityScore01: integrity.integrityScore01,
    moduleDescriptorVersion: BACKEND_CHAT_PHASE4_BUNDLE.modules.sceneArchive.CHAT_SCENE_ARCHIVE_MODULE_VERSION ?? 'unknown',
  });
}

// ============================================================================
// MARK: Module authority object
// ============================================================================

export const BACKEND_CHAT_PHASE4_AUTHORITY = Object.freeze({
  // module registry
  modules: BACKEND_CHAT_PHASE4_MODULES,
  bundle: BACKEND_CHAT_PHASE4_BUNDLE,
  surface: BACKEND_CHAT_PHASE4_SURFACE,
  groups: BACKEND_CHAT_PHASE4_GROUPS,
  importablePaths: BACKEND_CHAT_PHASE4_IMPORTABLE_PATHS,
  experiencePaths: BACKEND_CHAT_PHASE4_EXPERIENCE_PATHS,
  // factory
  createBundle: createBackendChatPhase4Bundle,
  // discovery
  listSurface: listBackendChatPhase4Surface,
  listGroups: listBackendChatPhase4Groups,
  listByConcern: listBackendChatPhase4ByConcern,
  listExperienceDescriptors: listBackendChatPhase4ExperienceDescriptors,
  listImportablePaths: listBackendChatPhase4ImportablePaths,
  getDescriptor: getBackendChatPhase4Descriptor,
  // integrity
  assertIntegrity: assertBackendChatPhase4SurfaceIntegrity,
  assertPhase4Integrity,
  buildIntegrityReport: buildPhase4IntegrityReport,
  // diagnostics
  createDiagnostics: createBackendChatPhase4Diagnostics,
  buildFullDiagnostics: buildPhase4FullDiagnosticsPayload,
  buildGlobalSummary: buildPhase4GlobalExperienceSummary,
  // experience pressure
  computePressure: computePhase4ExperiencePressure,
  derivePressureTier,
  describePressureTier: describeExperiencePressureTier,
  runBatchPressureScan: runPhase4BatchRoomPressureScan,
  buildPressureStats: buildPhase4PressureStats,
  createPressureEpochTracker: createPhase4PressureEpochTracker,
  createPressureWatchBus: createPhase4PressureWatchBus,
  // continuity
  assessContinuity: assessPhase4Continuity,
  describeContinuityAssessment,
  // health
  buildHealthReport: buildPhase4HealthReport,
  summarizeHealthReport: summarizePhase4HealthReport,
  getHealthByConcern: getPhase4HealthByConcern,
  // readiness gate
  buildReadinessGate: buildPhase4ExperienceReadinessGate,
  describeReadinessGate,
  // surface analytics
  buildConcernSurfaceAnalytics,
  getConcernSurfaceEntry,
  listExperienceFocusedConcerns,
  buildDeepConcernReport,
  buildAllDeepConcernReports,
  // retrieval layer
  buildRetrievalSurfaceSummary,
  isRetrievalLayerComplete,
  // post-run layer
  buildPostRunSurfaceSummary,
  isPostRunLayerComplete,
  // surface utilities
  listByTruthOwnership: listSurfacesByTruthOwnership,
  listByGeneratedStatus: listSurfacesByGeneratedStatus,
  findByRelativePath: findSurfacesByRelativePath,
  describeSurface,
  describeSurfaceShort,
  // fingerprint
  computeLayerFingerprint: computePhase4ExperienceLayerFingerprint,
  buildVersionMap: buildPhase4ModuleVersionMap,
  // event bus
  createEventBus: createPhase4ExperienceEventBus,
} as const);

// ============================================================================
// MARK: Private helpers
// ============================================================================

function clamp01f(value: number): number {
  return Math.max(0, Math.min(1, value));
}