
/* eslint-disable max-lines */
/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT INTELLIGENCE ENTRYPOINT
 * FILE: backend/src/game/engine/chat/intelligence/index.ts
 * VERSION: 2026.03.21-backend-intelligence-surface.v2
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Unified intelligence barrel + composition surface for the backend chat lane.
 *
 * This file is intentionally more than a passive export list.
 * It is the backend discovery surface, the stable composition root for the
 * learning core, and the typed access map that prevents newer callers from
 * spelunking across the chat intelligence directory tree just to find the
 * right constructor.
 *
 * Design doctrine
 * ---------------
 * - index.ts remains a servant surface. Durable truth stays inside the
 *   underlying authorities that already own it.
 * - The barrel must export 100% of the public functionality of the backend
 *   chat intelligence lane so callers do not fall back to brittle deep paths.
 * - Bundle helpers must stay deterministic and side-effect-light.
 * - Discovery metadata belongs here because it reduces path drift without
 *   changing the authority of the underlying files.
 * - The foundational learning bundle is required; broader intelligence modules
 *   are surfaced here as accessible constructors/classes rather than being
 *   forcibly instantiated with guessed options.
 * ============================================================================
 */

import type {
  ChatEnginePorts,
  ChatLearningProfile,
  ChatRuntimeConfig,
  ChatUserId,
} from '../types';

import { CHAT_RUNTIME_DEFAULTS } from '../types';

// ============================================================================
// MARK: Canonical full-surface re-exports
// ============================================================================

export * from './ColdStartPopulationModel';
export * from './LearningProfileStore';
export * from './ChatLearningCoordinator';
export * from './dl';
export * from './ChatEpisodicMemory';
export * from './ChatNoveltyLedger';
export * from './ChatPlayerFingerprintService';
export * from './ChatRelationshipModel';
export * from './ChatScenePlanner';
export * from './ChatSeasonalLiveOpsOverlayService';
export * from './ChatSemanticSimilarityIndex';
export * from './ChatSurfaceRealizer';
export * from './ml/EmotionModel';
export * from './ml/AttachmentModel';
export * from './ml/PressureAffectModel';

// ============================================================================
// MARK: Private imports for bundle composition and discovery surface
// ============================================================================

import type {
  ChatColdStartPopulationModelApi,
  ChatColdStartPopulationModelOptions,
} from './ColdStartPopulationModel';
import {
  CHAT_COLD_START_POPULATION_MODEL_VERSION,
  createColdStartPopulationModel,
} from './ColdStartPopulationModel';

import type {
  LearningProfileStoreApi,
  LearningProfileStoreFlushResult,
  LearningProfileStoreImportResult,
  LearningProfileStoreOptions,
} from './LearningProfileStore';
import { createLearningProfileStore } from './LearningProfileStore';

import type {
  ChatLearningCoordinatorApi,
  ChatLearningCoordinatorHydrationPayload,
  ChatLearningCoordinatorHydrationResult,
  ChatLearningCoordinatorOptions,
  ChatLearningCoordinatorTrainingSeed,
} from './ChatLearningCoordinator';
import { createChatLearningCoordinator } from './ChatLearningCoordinator';

import { ChatEpisodicMemory, createChatEpisodicMemory } from './ChatEpisodicMemory';
import { ChatNoveltyLedger, createChatNoveltyLedger } from './ChatNoveltyLedger';
import {
  ChatPlayerFingerprintService,
  createChatPlayerFingerprintService,
} from './ChatPlayerFingerprintService';
import { ChatRelationshipModel } from './ChatRelationshipModel';
import { ChatScenePlanner, createChatScenePlanner } from './ChatScenePlanner';
import {
  ChatSeasonalLiveOpsOverlayService,
  createChatSeasonalLiveOpsOverlayService,
} from './ChatSeasonalLiveOpsOverlayService';
import {
  CHAT_SEMANTIC_SIMILARITY_INDEX_VERSION,
  DEFAULT_CHAT_SEMANTIC_SIMILARITY_INDEX_CONFIG,
  ChatSemanticSimilarityIndex,
  createChatSemanticSimilarityIndex,
} from './ChatSemanticSimilarityIndex';
import { ChatSurfaceRealizer, createChatSurfaceRealizer } from './ChatSurfaceRealizer';

import type { EmotionModelApi, EmotionModelOptions } from './ml/EmotionModel';
import { createEmotionModel, evaluateEmotionModel } from './ml/EmotionModel';

import type {
  AttachmentModelApi,
  AttachmentModelOptions,
} from './ml/AttachmentModel';
import { assessAttachment, createAttachmentModel } from './ml/AttachmentModel';

import type {
  PressureAffectModelApi,
  PressureAffectModelOptions,
} from './ml/PressureAffectModel';
import {
  createPressureAffectModel,
  evaluatePressureAffect,
  summarizePressureAffect,
} from './ml/PressureAffectModel';


// ============================================================================
// MARK: Intelligence surface identity and discovery contracts
// ============================================================================

export const BACKEND_CHAT_INTELLIGENCE_ENTRYPOINT_VERSION =
  '2026.03.21-backend-intelligence-surface.v2' as const;

export const BACKEND_CHAT_INTELLIGENCE_AUTHORITIES = Object.freeze([
  '/backend/src/game/engine/chat/intelligence/index.ts',
  '/backend/src/game/engine/chat/intelligence',
  '/backend/src/game/engine/chat',
  '/shared/contracts/chat',
] as const);

export const BACKEND_CHAT_INTELLIGENCE_LAWS = Object.freeze([
  'The backend intelligence barrel must expose the full public surface of the backend intelligence lane.',
  'The bundle factory may compose the learning core once, but it may not become a shadow authority over durable store truth.',
  'Optional modules should stay accessible through typed surface discovery instead of brittle deep imports.',
  'The index may publish discovery metadata and integrity helpers when they reduce construction drift.',
  'Exports should be full-surface and path-stable so callers do not guess which symbols are missing.',
  'Runtime helpers must stay deterministic and side-effect-light.',
] as const);

export const BACKEND_CHAT_INTELLIGENCE_MODULE_CATEGORIES = [
  'FOUNDATION',
  'COMPATIBILITY',
  'ADAPTATION',
  'ORCHESTRATION',
  'SEMANTICS',
  'REALIZATION',
  'ML',
] as const;

export type BackendChatIntelligenceModuleCategory =
  (typeof BACKEND_CHAT_INTELLIGENCE_MODULE_CATEGORIES)[number];

export const BACKEND_CHAT_INTELLIGENCE_FAMILIES = [
  'learning-core',
  'continuity',
  'memory',
  'pacing',
  'player-modeling',
  'relationship',
  'scene',
  'liveops',
  'semantic',
  'surface',
  'affect',
] as const;

export type BackendChatIntelligenceFamily =
  (typeof BACKEND_CHAT_INTELLIGENCE_FAMILIES)[number];

export const BACKEND_CHAT_INTELLIGENCE_BUNDLE_INCLUSIONS = [
  'required',
  'surface-only',
  'export-only',
] as const;

export type BackendChatIntelligenceBundleInclusion =
  (typeof BACKEND_CHAT_INTELLIGENCE_BUNDLE_INCLUSIONS)[number];

export interface BackendChatIntelligenceModuleDescriptor {
  readonly key: BackendChatIntelligenceModuleKey;
  readonly id: BackendChatIntelligenceModuleId;
  readonly category: BackendChatIntelligenceModuleCategory;
  readonly family: BackendChatIntelligenceFamily;
  readonly canonicalPath: string;
  readonly runtimeRole: string;
  readonly authorityLaw: string;
  readonly bundleInclusion: BackendChatIntelligenceBundleInclusion;
  readonly constructors: readonly string[];
  readonly classes: readonly string[];
  readonly primaryExports: readonly string[];
  readonly dependsOn: readonly string[];
  readonly usedBy: readonly string[];
  readonly versionSymbol?: string;
}

export interface BackendChatIntelligenceVersionManifest {
  readonly entrypoint: typeof BACKEND_CHAT_INTELLIGENCE_ENTRYPOINT_VERSION;
  readonly runtime: ChatRuntimeConfig['version'];
  readonly coldStartPopulationModel: typeof CHAT_COLD_START_POPULATION_MODEL_VERSION;
  readonly semanticSimilarityIndex: typeof CHAT_SEMANTIC_SIMILARITY_INDEX_VERSION;
  readonly pressureAffectModel: string;
  readonly attachmentModel: string;
  readonly emotionModel: string;
}

export interface BackendChatIntelligenceCapabilityMatrix {
  readonly hasFoundationalBundle: true;
  readonly exportsFullSurface: true;
  readonly exportsDlCompatibility: true;
  readonly hasColdStartPopulationModel: true;
  readonly hasLearningProfileStore: true;
  readonly hasLearningCoordinator: true;
  readonly hasEpisodicMemorySurface: true;
  readonly hasNoveltyLedgerSurface: true;
  readonly hasPlayerFingerprintSurface: true;
  readonly hasRelationshipSurface: true;
  readonly hasScenePlannerSurface: true;
  readonly hasSeasonalLiveOpsSurface: true;
  readonly hasSemanticSimilaritySurface: true;
  readonly hasSurfaceRealizerSurface: true;
  readonly hasPressureAffectModel: true;
  readonly hasAttachmentModel: true;
  readonly hasEmotionModel: true;
  readonly hasCatalogDiscovery: true;
  readonly hasPortableLoggerAdapter: true;
  readonly hasBundleValidation: true;
  readonly hasRuntimeManifest: true;
  readonly hasSnapshotExport: true;
  readonly hasTrainingSeedHelpers: true;
}

export interface BackendChatIntelligenceSurfaceManifest {
  readonly entrypointVersion: typeof BACKEND_CHAT_INTELLIGENCE_ENTRYPOINT_VERSION;
  readonly authorities: readonly string[];
  readonly laws: readonly string[];
  readonly categories: readonly BackendChatIntelligenceModuleCategory[];
  readonly families: readonly BackendChatIntelligenceFamily[];
  readonly modules: readonly BackendChatIntelligenceModuleDescriptor[];
  readonly capabilityMatrix: BackendChatIntelligenceCapabilityMatrix;
}


export const BACKEND_CHAT_INTELLIGENCE_MODULE_KEYS = [
  'coldStartPopulationModel',
  'learningProfileStore',
  'chatLearningCoordinator',
  'dlCompatibilityLane',
  'episodicMemory',
  'noveltyLedger',
  'playerFingerprintService',
  'relationshipModel',
  'scenePlanner',
  'seasonalLiveOpsOverlayService',
  'semanticSimilarityIndex',
  'surfaceRealizer',
  'emotionModel',
  'attachmentModel',
  'pressureAffectModel',
] as const;

export type BackendChatIntelligenceModuleKey =
  (typeof BACKEND_CHAT_INTELLIGENCE_MODULE_KEYS)[number];

export const BACKEND_CHAT_INTELLIGENCE_MODULE_IDS = [
  'COLD_START_POPULATION_MODEL',
  'LEARNING_PROFILE_STORE',
  'CHAT_LEARNING_COORDINATOR',
  'DL_COMPATIBILITY_LANE',
  'CHAT_EPISODIC_MEMORY',
  'CHAT_NOVELTY_LEDGER',
  'CHAT_PLAYER_FINGERPRINT_SERVICE',
  'CHAT_RELATIONSHIP_MODEL',
  'CHAT_SCENE_PLANNER',
  'CHAT_SEASONAL_LIVEOPS_OVERLAY_SERVICE',
  'CHAT_SEMANTIC_SIMILARITY_INDEX',
  'CHAT_SURFACE_REALIZER',
  'EMOTION_MODEL',
  'ATTACHMENT_MODEL',
  'PRESSURE_AFFECT_MODEL',
] as const;

export type BackendChatIntelligenceModuleId =
  (typeof BACKEND_CHAT_INTELLIGENCE_MODULE_IDS)[number];
export const BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG = Object.freeze([
  Object.freeze({
    key: 'coldStartPopulationModel',
    id: 'COLD_START_POPULATION_MODEL',
    category: 'FOUNDATION',
    family: 'learning-core',
    canonicalPath: './ColdStartPopulationModel',
    runtimeRole: 'Produces deterministic cold-start priors and archetype seed recommendations for new or under-observed chat users.',
    authorityLaw: 'Cold-start may bias initialization, but may not overwrite persisted learning truth once the store has a durable profile.',
    bundleInclusion: 'required',
    constructors: Object.freeze([
      'createColdStartPopulationModel',
    ]),
    classes: Object.freeze([
    ]),
    primaryExports: Object.freeze([
      'createColdStartPopulationModel',
      'CHAT_COLD_START_POPULATION_MODEL_VERSION',
      'all model contracts via export *',
    ]),
    dependsOn: Object.freeze([
      '../types runtime learningPolicy',
    ]),
    usedBy: Object.freeze([
      'LearningProfileStore',
      'ChatLearningCoordinator',
      'bundle factory',
    ]),
    versionSymbol: 'CHAT_COLD_START_POPULATION_MODEL_VERSION',
  }) as BackendChatIntelligenceModuleDescriptor,
  Object.freeze({
    key: 'learningProfileStore',
    id: 'LEARNING_PROFILE_STORE',
    category: 'FOUNDATION',
    family: 'learning-core',
    canonicalPath: './LearningProfileStore',
    runtimeRole: 'Persists and mutates durable learning profiles, import/export NDJSON, and store-governed hydration truth.',
    authorityLaw: 'The store owns durable profile truth and should remain the write gate around long-lived learning state.',
    bundleInclusion: 'required',
    constructors: Object.freeze([
      'createLearningProfileStore',
    ]),
    classes: Object.freeze([
    ]),
    primaryExports: Object.freeze([
      'createLearningProfileStore',
      'all store contracts via export *',
    ]),
    dependsOn: Object.freeze([
      'coldStartPopulationModel',
      '../types runtime/ports',
    ]),
    usedBy: Object.freeze([
      'ChatLearningCoordinator',
      'bundle factory',
    ]),
  }) as BackendChatIntelligenceModuleDescriptor,
  Object.freeze({
    key: 'chatLearningCoordinator',
    id: 'CHAT_LEARNING_COORDINATOR',
    category: 'FOUNDATION',
    family: 'learning-core',
    canonicalPath: './ChatLearningCoordinator',
    runtimeRole: 'Coordinates event normalization, salience, accepted message ingestion, session state, hydration, flushing, and training seed creation.',
    authorityLaw: 'The coordinator may compose other learning primitives, but it should remain servant to runtime policy and store truth.',
    bundleInclusion: 'required',
    constructors: Object.freeze([
      'createChatLearningCoordinator',
    ]),
    classes: Object.freeze([
    ]),
    primaryExports: Object.freeze([
      'createChatLearningCoordinator',
      'all coordinator contracts via export *',
    ]),
    dependsOn: Object.freeze([
      'coldStartPopulationModel',
      'learningProfileStore',
      '../types runtime/ports',
    ]),
    usedBy: Object.freeze([
      'bundle factory',
      'ChatEngine backend callers',
    ]),
  }) as BackendChatIntelligenceModuleDescriptor,
  Object.freeze({
    key: 'dlCompatibilityLane',
    id: 'DL_COMPATIBILITY_LANE',
    category: 'COMPATIBILITY',
    family: 'continuity',
    canonicalPath: './dl',
    runtimeRole: 'Preserves retrieval-backed continuity exports behind the backend intelligence root so new consumers do not depend on the legacy root path.',
    authorityLaw: 'Compatibility exports must remain accessible from the intelligence barrel to prevent path drift during gradual migration.',
    bundleInclusion: 'export-only',
    constructors: Object.freeze([
    ]),
    classes: Object.freeze([
    ]),
    primaryExports: Object.freeze([
      'export * from ./dl',
    ]),
    dependsOn: Object.freeze([
      'legacy continuity surfaces',
    ]),
    usedBy: Object.freeze([
      'newer backend callers that should not reach legacy root directly',
    ]),
  }) as BackendChatIntelligenceModuleDescriptor,
  Object.freeze({
    key: 'episodicMemory',
    id: 'CHAT_EPISODIC_MEMORY',
    category: 'ADAPTATION',
    family: 'memory',
    canonicalPath: './ChatEpisodicMemory',
    runtimeRole: 'Captures callback-capable episodic records and candidate retrieval for continuity-driven line realization and rescue callbacks.',
    authorityLaw: 'Episodic memory is retrieval support, not transcript authority.',
    bundleInclusion: 'surface-only',
    constructors: Object.freeze([
      'createChatEpisodicMemory',
    ]),
    classes: Object.freeze([
      'ChatEpisodicMemory',
    ]),
    primaryExports: Object.freeze([
      'ChatEpisodicMemory',
      'createChatEpisodicMemory',
      'all episodic contracts via export *',
    ]),
    dependsOn: Object.freeze([
      'shared chat memory contracts',
    ]),
    usedBy: Object.freeze([
      'scene planning',
      'callback selection',
      'continuity prompts',
    ]),
  }) as BackendChatIntelligenceModuleDescriptor,
  Object.freeze({
    key: 'noveltyLedger',
    id: 'CHAT_NOVELTY_LEDGER',
    category: 'ADAPTATION',
    family: 'pacing',
    canonicalPath: './ChatNoveltyLedger',
    runtimeRole: 'Tracks anti-repeat pressure, rhetorical fatigue, and candidate novelty so the social stage does not emotionally collapse into echo.',
    authorityLaw: 'Novelty controls pacing and selection pressure; it does not rewrite transcript truth.',
    bundleInclusion: 'surface-only',
    constructors: Object.freeze([
      'createChatNoveltyLedger',
    ]),
    classes: Object.freeze([
      'ChatNoveltyLedger',
    ]),
    primaryExports: Object.freeze([
      'ChatNoveltyLedger',
      'createChatNoveltyLedger',
      'all novelty contracts via export *',
    ]),
    dependsOn: Object.freeze([
      'chat history and candidate metadata',
    ]),
    usedBy: Object.freeze([
      'bot response direction',
      'scene pacing',
      'frontend parity',
    ]),
  }) as BackendChatIntelligenceModuleDescriptor,
  Object.freeze({
    key: 'playerFingerprintService',
    id: 'CHAT_PLAYER_FINGERPRINT_SERVICE',
    category: 'ADAPTATION',
    family: 'player-modeling',
    canonicalPath: './ChatPlayerFingerprintService',
    runtimeRole: 'Maintains backend player behavior fingerprints, archetype hints, and counterplay guidance across observed chat and game events.',
    authorityLaw: 'Fingerprinting is an adaptive interpretation layer; it should explain pressure and style, not silently become hard authority on eligibility.',
    bundleInclusion: 'surface-only',
    constructors: Object.freeze([
      'createChatPlayerFingerprintService',
    ]),
    classes: Object.freeze([
      'ChatPlayerFingerprintService',
    ]),
    primaryExports: Object.freeze([
      'ChatPlayerFingerprintService',
      'createChatPlayerFingerprintService',
      'all fingerprint contracts via export *',
    ]),
    dependsOn: Object.freeze([
      'shared fingerprint contracts',
    ]),
    usedBy: Object.freeze([
      'counterplay selection',
      'player modeling',
      'analytics',
    ]),
  }) as BackendChatIntelligenceModuleDescriptor,
  Object.freeze({
    key: 'relationshipModel',
    id: 'CHAT_RELATIONSHIP_MODEL',
    category: 'ADAPTATION',
    family: 'relationship',
    canonicalPath: './ChatRelationshipModel',
    runtimeRole: 'Tracks dynamic social edges between player, NPC, and witnesses so callbacks, rescue, rivalry, and trust can evolve over time.',
    authorityLaw: 'Relationship state should intensify or soften responses, never collapse distinct counterpart identities into a generic trust score.',
    bundleInclusion: 'surface-only',
    constructors: Object.freeze([
    ]),
    classes: Object.freeze([
      'ChatRelationshipModel',
    ]),
    primaryExports: Object.freeze([
      'ChatRelationshipModel',
      'all relationship contracts via export *',
    ]),
    dependsOn: Object.freeze([
      'shared relationship contracts',
      'chat events',
    ]),
    usedBy: Object.freeze([
      'rescue logic',
      'scene planners',
      'NPC dialogue direction',
    ]),
  }) as BackendChatIntelligenceModuleDescriptor,
  Object.freeze({
    key: 'scenePlanner',
    id: 'CHAT_SCENE_PLANNER',
    category: 'ORCHESTRATION',
    family: 'scene',
    canonicalPath: './ChatScenePlanner',
    runtimeRole: 'Converts game pressure and social state into multi-line scene plans with cast, pacing, and interruption logic.',
    authorityLaw: 'Scene planning decides who should speak and when, not whether the transcript is canon after backend emission.',
    bundleInclusion: 'surface-only',
    constructors: Object.freeze([
      'createChatScenePlanner',
    ]),
    classes: Object.freeze([
      'ChatScenePlanner',
    ]),
    primaryExports: Object.freeze([
      'ChatScenePlanner',
      'createChatScenePlanner',
      'all scene planner contracts via export *',
    ]),
    dependsOn: Object.freeze([
      'chat modes, scene and moment contracts',
    ]),
    usedBy: Object.freeze([
      'backend scene orchestration',
      'response direction',
    ]),
  }) as BackendChatIntelligenceModuleDescriptor,
  Object.freeze({
    key: 'seasonalLiveOpsOverlayService',
    id: 'CHAT_SEASONAL_LIVEOPS_OVERLAY_SERVICE',
    category: 'ORCHESTRATION',
    family: 'liveops',
    canonicalPath: './ChatSeasonalLiveOpsOverlayService',
    runtimeRole: 'Applies season, event, and campaign overlays onto the chat runtime so dialogue and prompts stay liveops-aware.',
    authorityLaw: 'Liveops overlays may color staging and prompts, but must not mutate immutable transcript history after emission.',
    bundleInclusion: 'surface-only',
    constructors: Object.freeze([
      'createChatSeasonalLiveOpsOverlayService',
    ]),
    classes: Object.freeze([
      'ChatSeasonalLiveOpsOverlayService',
    ]),
    primaryExports: Object.freeze([
      'ChatSeasonalLiveOpsOverlayService',
      'createChatSeasonalLiveOpsOverlayService',
      'all liveops overlay contracts via export *',
    ]),
    dependsOn: Object.freeze([
      'shared liveops contracts',
    ]),
    usedBy: Object.freeze([
      'seasonal campaigns',
      'operator tooling',
      'event-aware chat scenes',
    ]),
  }) as BackendChatIntelligenceModuleDescriptor,
  Object.freeze({
    key: 'semanticSimilarityIndex',
    id: 'CHAT_SEMANTIC_SIMILARITY_INDEX',
    category: 'SEMANTICS',
    family: 'semantic',
    canonicalPath: './ChatSemanticSimilarityIndex',
    runtimeRole: 'Indexes authored lines and computed documents to guard novelty, rhetorical repetition, and explainable nearest-neighbor retrieval.',
    authorityLaw: 'Semantic similarity is shared-law driven; backend indexing must emit the richer shared contract shape rather than ad hoc local objects.',
    bundleInclusion: 'surface-only',
    constructors: Object.freeze([
      'createChatSemanticSimilarityIndex',
    ]),
    classes: Object.freeze([
      'ChatSemanticSimilarityIndex',
    ]),
    primaryExports: Object.freeze([
      'ChatSemanticSimilarityIndex',
      'createChatSemanticSimilarityIndex',
      'CHAT_SEMANTIC_SIMILARITY_INDEX_VERSION',
      'DEFAULT_CHAT_SEMANTIC_SIMILARITY_INDEX_CONFIG',
      'all semantic contracts via export *',
    ]),
    dependsOn: Object.freeze([
      'shared semantic-similarity contracts',
    ]),
    usedBy: Object.freeze([
      'anti-repetition guards',
      'training rows',
      'retrieval-backed realization',
    ]),
    versionSymbol: 'CHAT_SEMANTIC_SIMILARITY_INDEX_VERSION',
  }) as BackendChatIntelligenceModuleDescriptor,
  Object.freeze({
    key: 'surfaceRealizer',
    id: 'CHAT_SURFACE_REALIZER',
    category: 'REALIZATION',
    family: 'surface',
    canonicalPath: './ChatSurfaceRealizer',
    runtimeRole: 'Transforms canonical backend chat lines into final shaped surface text, tags, and realization strategy without becoming a UI widget.',
    authorityLaw: 'Surface realization may style delivery and register, but must preserve canonical line intent and contract shape.',
    bundleInclusion: 'surface-only',
    constructors: Object.freeze([
      'createChatSurfaceRealizer',
    ]),
    classes: Object.freeze([
      'ChatSurfaceRealizer',
    ]),
    primaryExports: Object.freeze([
      'ChatSurfaceRealizer',
      'createChatSurfaceRealizer',
      'all surface realization contracts via export *',
    ]),
    dependsOn: Object.freeze([
      'shared surface-realization contracts',
    ]),
    usedBy: Object.freeze([
      'backend response emission',
      'frontend mirroring',
    ]),
  }) as BackendChatIntelligenceModuleDescriptor,
  Object.freeze({
    key: 'emotionModel',
    id: 'EMOTION_MODEL',
    category: 'ML',
    family: 'affect',
    canonicalPath: './ml/EmotionModel',
    runtimeRole: 'Produces normalized emotion recommendations using attachment and pressure affect context for backend learning and line selection.',
    authorityLaw: 'Emotion is recommendation-grade inference; it should remain inspectable, versioned, and subordinate to runtime policy.',
    bundleInclusion: 'required',
    constructors: Object.freeze([
      'createEmotionModel',
    ]),
    classes: Object.freeze([
    ]),
    primaryExports: Object.freeze([
      'createEmotionModel',
      'evaluateEmotionModel',
      'all emotion model contracts via export *',
    ]),
    dependsOn: Object.freeze([
      'PressureAffectModel',
      'AttachmentModel',
    ]),
    usedBy: Object.freeze([
      'bundle factory',
      'learning coordinator support',
    ]),
  }) as BackendChatIntelligenceModuleDescriptor,
  Object.freeze({
    key: 'attachmentModel',
    id: 'ATTACHMENT_MODEL',
    category: 'ML',
    family: 'affect',
    canonicalPath: './ml/AttachmentModel',
    runtimeRole: 'Assesses attachment-style affinities and support vectors that can shape rescue, helper tone, and relationship readings.',
    authorityLaw: 'Attachment inference informs tone and support; it must not silently replace explicit player behavior evidence.',
    bundleInclusion: 'required',
    constructors: Object.freeze([
      'createAttachmentModel',
    ]),
    classes: Object.freeze([
    ]),
    primaryExports: Object.freeze([
      'createAttachmentModel',
      'assessAttachment',
      'all attachment model contracts via export *',
    ]),
    dependsOn: Object.freeze([
      'none beyond runtime input contracts',
    ]),
    usedBy: Object.freeze([
      'EmotionModel',
      'relationship-aware helpers',
    ]),
  }) as BackendChatIntelligenceModuleDescriptor,
  Object.freeze({
    key: 'pressureAffectModel',
    id: 'PRESSURE_AFFECT_MODEL',
    category: 'ML',
    family: 'affect',
    canonicalPath: './ml/PressureAffectModel',
    runtimeRole: 'Maps pressure posture and contextual flags into affect recommendations that the backend learning lane can consume deterministically.',
    authorityLaw: 'Pressure affect is a shaped policy surface, not a free-form narrative generator.',
    bundleInclusion: 'required',
    constructors: Object.freeze([
      'createPressureAffectModel',
    ]),
    classes: Object.freeze([
    ]),
    primaryExports: Object.freeze([
      'createPressureAffectModel',
      'evaluatePressureAffect',
      'summarizePressureAffect',
      'all pressure affect contracts via export *',
    ]),
    dependsOn: Object.freeze([
      'runtime pressure context',
    ]),
    usedBy: Object.freeze([
      'EmotionModel',
      'learning coordination',
    ]),
  }) as BackendChatIntelligenceModuleDescriptor,
]) as readonly BackendChatIntelligenceModuleDescriptor[];


export interface BackendChatIntelligenceModuleSurface<TFactory = unknown, TClass = unknown> {
  readonly descriptor: BackendChatIntelligenceModuleDescriptor;
  readonly factory?: TFactory;
  readonly ctor?: TClass;
  readonly version?: string;
}

export interface BackendChatIntelligenceSurface {
  readonly manifest: BackendChatIntelligenceSurfaceManifest;
  readonly modules: {
    readonly coldStartPopulationModel: BackendChatIntelligenceModuleSurface<
      typeof createColdStartPopulationModel
    >;
    readonly learningProfileStore: BackendChatIntelligenceModuleSurface<
      typeof createLearningProfileStore
    >;
    readonly chatLearningCoordinator: BackendChatIntelligenceModuleSurface<
      typeof createChatLearningCoordinator
    >;
    readonly episodicMemory: BackendChatIntelligenceModuleSurface<
      typeof createChatEpisodicMemory,
      typeof ChatEpisodicMemory
    >;
    readonly noveltyLedger: BackendChatIntelligenceModuleSurface<
      typeof createChatNoveltyLedger,
      typeof ChatNoveltyLedger
    >;
    readonly playerFingerprintService: BackendChatIntelligenceModuleSurface<
      typeof createChatPlayerFingerprintService,
      typeof ChatPlayerFingerprintService
    >;
    readonly relationshipModel: BackendChatIntelligenceModuleSurface<
      undefined,
      typeof ChatRelationshipModel
    >;
    readonly scenePlanner: BackendChatIntelligenceModuleSurface<
      typeof createChatScenePlanner,
      typeof ChatScenePlanner
    >;
    readonly seasonalLiveOpsOverlayService: BackendChatIntelligenceModuleSurface<
      typeof createChatSeasonalLiveOpsOverlayService,
      typeof ChatSeasonalLiveOpsOverlayService
    >;
    readonly semanticSimilarityIndex: BackendChatIntelligenceModuleSurface<
      typeof createChatSemanticSimilarityIndex,
      typeof ChatSemanticSimilarityIndex
    >;
    readonly surfaceRealizer: BackendChatIntelligenceModuleSurface<
      typeof createChatSurfaceRealizer,
      typeof ChatSurfaceRealizer
    >;
    readonly pressureAffectModel: BackendChatIntelligenceModuleSurface<
      typeof createPressureAffectModel
    >;
    readonly attachmentModel: BackendChatIntelligenceModuleSurface<
      typeof createAttachmentModel
    >;
    readonly emotionModel: BackendChatIntelligenceModuleSurface<
      typeof createEmotionModel
    >;
  };
  readonly helpers: {
    readonly evaluateEmotionModel: typeof evaluateEmotionModel;
    readonly assessAttachment: typeof assessAttachment;
    readonly evaluatePressureAffect: typeof evaluatePressureAffect;
    readonly summarizePressureAffect: typeof summarizePressureAffect;
  };
  listModules(): readonly BackendChatIntelligenceModuleDescriptor[];
  listModulesByCategory(
    category: BackendChatIntelligenceModuleCategory,
  ): readonly BackendChatIntelligenceModuleDescriptor[];
  listModulesByFamily(
    family: BackendChatIntelligenceFamily,
  ): readonly BackendChatIntelligenceModuleDescriptor[];
  getModuleDescriptor(
    key: BackendChatIntelligenceModuleKey,
  ): BackendChatIntelligenceModuleDescriptor | undefined;
  hasModule(key: BackendChatIntelligenceModuleKey): boolean;
}

export interface BackendChatIntelligenceBundleValidationIssue {
  readonly code:
    | 'MISSING_CORE_INSTANCE'
    | 'RUNTIME_VERSION_MISMATCH'
    | 'SURFACE_DESCRIPTOR_MISSING'
    | 'SURFACE_FACTORY_MISSING'
    | 'PROFILE_STORE_COORDINATOR_DRIFT';
  readonly severity: 'ERROR' | 'WARN';
  readonly message: string;
  readonly moduleKey?: BackendChatIntelligenceModuleKey;
}

export interface BackendChatIntelligenceBundleValidationReport {
  readonly ok: boolean;
  readonly issues: readonly BackendChatIntelligenceBundleValidationIssue[];
  readonly checkedAt: number;
}


// ============================================================================
// MARK: Public bundle contracts
// ============================================================================

export interface BackendChatIntelligenceBundle {
  readonly runtime: ChatRuntimeConfig;
  readonly surface: BackendChatIntelligenceSurface;
  readonly moduleCatalog: readonly BackendChatIntelligenceModuleDescriptor[];
  readonly coldStartModel: ChatColdStartPopulationModelApi;
  readonly profileStore: LearningProfileStoreApi;
  readonly coordinator: ChatLearningCoordinatorApi;
  readonly pressureAffectModel: PressureAffectModelApi;
  readonly attachmentModel: AttachmentModelApi;
  readonly emotionModel: EmotionModelApi;
  readonly versions: BackendChatIntelligenceVersionManifest;
  readonly capabilities: BackendChatIntelligenceCapabilityMatrix;
  flush(): Promise<LearningProfileStoreFlushResult>;
  hydrate(
    payload: ChatLearningCoordinatorHydrationPayload,
  ): ChatLearningCoordinatorHydrationResult;
  importNdjson(lines: readonly string[]): LearningProfileStoreImportResult;
  exportNdjson(): readonly string[];
  exportRuntimeManifest(): {
    readonly runtimeVersion: string;
    readonly learningPolicy: ChatRuntimeConfig['learningPolicy'];
    readonly totalProfiles: number;
    readonly totalTrackedUsers: number;
    readonly diagnostics: ReturnType<ChatLearningCoordinatorApi['exportDiagnostics']>;
    readonly coldStartManifest: ReturnType<ChatColdStartPopulationModelApi['exportManifest']>;
    readonly emotionModels: {
      readonly pressureAffect: string;
      readonly attachment: string;
      readonly emotion: string;
    };
    readonly entrypointVersion: typeof BACKEND_CHAT_INTELLIGENCE_ENTRYPOINT_VERSION;
    readonly modules: readonly BackendChatIntelligenceModuleDescriptor[];
    readonly capabilities: BackendChatIntelligenceCapabilityMatrix;
  };
  snapshot(): {
    readonly profiles: Readonly<Record<ChatUserId, ChatLearningProfile>>;
    readonly trainingSeeds: readonly ChatLearningCoordinatorTrainingSeed[];
  };
  snapshotProfiles(): Readonly<Record<ChatUserId, ChatLearningProfile>>;
  snapshotTrainingSeeds(): readonly ChatLearningCoordinatorTrainingSeed[];
  createTrainingSeedFor(
    userId: ChatUserId,
  ): ChatLearningCoordinatorTrainingSeed | null;
  listTrackedUsers(): readonly ChatUserId[];
  listModules(): readonly BackendChatIntelligenceModuleDescriptor[];
  getModuleDescriptor(
    key: BackendChatIntelligenceModuleKey,
  ): BackendChatIntelligenceModuleDescriptor | undefined;
  hasModule(key: BackendChatIntelligenceModuleKey): boolean;
  validate(): BackendChatIntelligenceBundleValidationReport;
}

export interface BackendChatIntelligenceBundleOptions {
  readonly runtime?: Partial<ChatRuntimeConfig>;
  readonly ports?: Pick<
    ChatEnginePorts,
    'clock' | 'logger' | 'persistence' | 'learning'
  >;
  readonly coldStart?: ChatColdStartPopulationModelOptions;
  readonly profileStore?: Omit<
    LearningProfileStoreOptions,
    'runtime' | 'ports' | 'coldStartModel'
  >;
  readonly coordinator?: Omit<
    ChatLearningCoordinatorOptions,
    'runtime' | 'ports' | 'coldStartModel' | 'profileStore'
  >;
  readonly pressureAffectModel?: PressureAffectModelOptions;
  readonly attachmentModel?: AttachmentModelOptions;
  readonly emotionModel?: Omit<
    EmotionModelOptions,
    'pressureAffectModel' | 'attachmentModel'
  >;
}


// ============================================================================
// MARK: Bundle factory
// ============================================================================

export function createBackendChatIntelligenceBundle(
  options: BackendChatIntelligenceBundleOptions = {},
): BackendChatIntelligenceBundle {
  const runtime = mergeRuntime(options.runtime);
  const ports = options.ports ?? {};

  const coldStartModel = createColdStartPopulationModel({
    runtime,
    acceptClientHints:
      typeof options.coldStart?.acceptClientHints === 'boolean'
        ? options.coldStart.acceptClientHints
        : runtime.learningPolicy.acceptClientHints,
    logger: options.coldStart?.logger ?? createPortableLogger(ports),
  });

  const profileStore = createLearningProfileStore({
    ...(options.profileStore ?? {}),
    runtime,
    ports,
    coldStartModel,
    acceptClientHints:
      typeof options.profileStore?.acceptClientHints === 'boolean'
        ? options.profileStore.acceptClientHints
        : runtime.learningPolicy.acceptClientHints,
  });

  const coordinator = createChatLearningCoordinator({
    ...(options.coordinator ?? {}),
    runtime,
    ports,
    coldStartModel,
    profileStore,
    acceptClientHints:
      typeof options.coordinator?.acceptClientHints === 'boolean'
        ? options.coordinator.acceptClientHints
        : runtime.learningPolicy.acceptClientHints,
  });

  const pressureAffectModel = createPressureAffectModel({
    ...(options.pressureAffectModel ?? {}),
  });

  const attachmentModel = createAttachmentModel({
    ...(options.attachmentModel ?? {}),
  });

  const emotionModel = createEmotionModel({
    ...(options.emotionModel ?? {}),
    pressureAffectModel,
    attachmentModel,
  });

  const versions = buildVersionManifest({
    runtime,
    pressureAffectModel,
    attachmentModel,
    emotionModel,
  });

  const capabilities = createCapabilityMatrix();
  const surface = createBackendChatIntelligenceSurface();

  async function flush(): Promise<LearningProfileStoreFlushResult> {
    return coordinator.flush();
  }

  function hydrate(
    payload: ChatLearningCoordinatorHydrationPayload,
  ): ChatLearningCoordinatorHydrationResult {
    return coordinator.hydrate(payload);
  }

  function importNdjson(lines: readonly string[]): LearningProfileStoreImportResult {
    return coordinator.importNdjson(lines);
  }

  function exportNdjson(): readonly string[] {
    return coordinator.exportNdjson();
  }

  function snapshotProfiles(): Readonly<Record<ChatUserId, ChatLearningProfile>> {
    return coordinator.snapshotProfiles();
  }

  function createTrainingSeedFor(
    userId: ChatUserId,
  ): ChatLearningCoordinatorTrainingSeed | null {
    return coordinator.createTrainingSeed(userId) ?? null;
  }

  function snapshotTrainingSeeds(): readonly ChatLearningCoordinatorTrainingSeed[] {
    const profiles = snapshotProfiles();
    const trainingSeeds = Object.keys(profiles)
      .map((userId) => createTrainingSeedFor(userId as ChatUserId))
      .filter(
        (value): value is ChatLearningCoordinatorTrainingSeed => Boolean(value),
      );

    return Object.freeze(trainingSeeds);
  }

  function snapshot(): {
    readonly profiles: Readonly<Record<ChatUserId, ChatLearningProfile>>;
    readonly trainingSeeds: readonly ChatLearningCoordinatorTrainingSeed[];
  } {
    return Object.freeze({
      profiles: snapshotProfiles(),
      trainingSeeds: snapshotTrainingSeeds(),
    });
  }

  function listTrackedUsers(): readonly ChatUserId[] {
    return Object.freeze(
      coordinator
        .listSessionStates()
        .map((state) => state.userId),
    );
  }

  function listModules(): readonly BackendChatIntelligenceModuleDescriptor[] {
    return surface.listModules();
  }

  function getModuleDescriptor(
    key: BackendChatIntelligenceModuleKey,
  ): BackendChatIntelligenceModuleDescriptor | undefined {
    return surface.getModuleDescriptor(key);
  }

  function hasModule(key: BackendChatIntelligenceModuleKey): boolean {
    return surface.hasModule(key);
  }

  function validate(): BackendChatIntelligenceBundleValidationReport {
    const issues: BackendChatIntelligenceBundleValidationIssue[] = [];

    if (!coldStartModel) {
      issues.push({
        code: 'MISSING_CORE_INSTANCE',
        severity: 'ERROR',
        moduleKey: 'coldStartPopulationModel',
        message: 'ColdStartPopulationModel instance is missing from the core bundle.',
      });
    }

    if (!profileStore) {
      issues.push({
        code: 'MISSING_CORE_INSTANCE',
        severity: 'ERROR',
        moduleKey: 'learningProfileStore',
        message: 'LearningProfileStore instance is missing from the core bundle.',
      });
    }

    if (!coordinator) {
      issues.push({
        code: 'MISSING_CORE_INSTANCE',
        severity: 'ERROR',
        moduleKey: 'chatLearningCoordinator',
        message: 'ChatLearningCoordinator instance is missing from the core bundle.',
      });
    }

    if (!surface.getModuleDescriptor('coldStartPopulationModel')) {
      issues.push({
        code: 'SURFACE_DESCRIPTOR_MISSING',
        severity: 'ERROR',
        moduleKey: 'coldStartPopulationModel',
        message: 'The surface catalog does not expose the cold-start descriptor.',
      });
    }

    if (!surface.getModuleDescriptor('semanticSimilarityIndex')) {
      issues.push({
        code: 'SURFACE_DESCRIPTOR_MISSING',
        severity: 'WARN',
        moduleKey: 'semanticSimilarityIndex',
        message: 'The surface catalog does not expose the semantic similarity descriptor.',
      });
    }

    if (!surface.modules.episodicMemory.factory) {
      issues.push({
        code: 'SURFACE_FACTORY_MISSING',
        severity: 'WARN',
        moduleKey: 'episodicMemory',
        message: 'The episodic memory factory is not published through the structured surface.',
      });
    }

    if (!surface.modules.noveltyLedger.factory) {
      issues.push({
        code: 'SURFACE_FACTORY_MISSING',
        severity: 'WARN',
        moduleKey: 'noveltyLedger',
        message: 'The novelty ledger factory is not published through the structured surface.',
      });
    }

    if (!surface.modules.playerFingerprintService.factory) {
      issues.push({
        code: 'SURFACE_FACTORY_MISSING',
        severity: 'WARN',
        moduleKey: 'playerFingerprintService',
        message: 'The player fingerprint service factory is not published through the structured surface.',
      });
    }

    if (!surface.modules.scenePlanner.factory) {
      issues.push({
        code: 'SURFACE_FACTORY_MISSING',
        severity: 'WARN',
        moduleKey: 'scenePlanner',
        message: 'The scene planner factory is not published through the structured surface.',
      });
    }

    if (runtime.version !== versions.runtime) {
      issues.push({
        code: 'RUNTIME_VERSION_MISMATCH',
        severity: 'ERROR',
        message: 'The bundle version manifest does not match the runtime version merged for this bundle.',
      });
    }

    if ((coordinator as { profileStore?: LearningProfileStoreApi }).profileStore) {
      const coordinatorStore = (coordinator as { profileStore?: LearningProfileStoreApi }).profileStore;
      if (coordinatorStore && coordinatorStore !== profileStore) {
        issues.push({
          code: 'PROFILE_STORE_COORDINATOR_DRIFT',
          severity: 'WARN',
          moduleKey: 'chatLearningCoordinator',
          message: 'The coordinator appears to expose a profileStore reference that differs from the bundled store instance.',
        });
      }
    }

    return Object.freeze({
      ok: issues.every((issue) => issue.severity !== 'ERROR'),
      issues: Object.freeze(issues),
      checkedAt: Date.now(),
    });
  }

  function exportRuntimeManifest(): {
    readonly runtimeVersion: string;
    readonly learningPolicy: ChatRuntimeConfig['learningPolicy'];
    readonly totalProfiles: number;
    readonly totalTrackedUsers: number;
    readonly diagnostics: ReturnType<ChatLearningCoordinatorApi['exportDiagnostics']>;
    readonly coldStartManifest: ReturnType<ChatColdStartPopulationModelApi['exportManifest']>;
    readonly emotionModels: {
      readonly pressureAffect: string;
      readonly attachment: string;
      readonly emotion: string;
    };
    readonly entrypointVersion: typeof BACKEND_CHAT_INTELLIGENCE_ENTRYPOINT_VERSION;
    readonly modules: readonly BackendChatIntelligenceModuleDescriptor[];
    readonly capabilities: BackendChatIntelligenceCapabilityMatrix;
  } {
    const profiles = snapshotProfiles();
    const diagnostics = coordinator.exportDiagnostics();
    return Object.freeze({
      runtimeVersion: runtime.version,
      learningPolicy: runtime.learningPolicy,
      totalProfiles: Object.keys(profiles).length,
      totalTrackedUsers: listTrackedUsers().length,
      diagnostics,
      coldStartManifest: coldStartModel.exportManifest(),
      emotionModels: Object.freeze({
        pressureAffect: pressureAffectModel.version,
        attachment: attachmentModel.version,
        emotion: emotionModel.version,
      }),
      entrypointVersion: BACKEND_CHAT_INTELLIGENCE_ENTRYPOINT_VERSION,
      modules: listModules(),
      capabilities,
    });
  }

  return Object.freeze({
    runtime,
    surface,
    moduleCatalog: listModules(),
    coldStartModel,
    profileStore,
    coordinator,
    pressureAffectModel,
    attachmentModel,
    emotionModel,
    versions,
    capabilities,
    flush,
    hydrate,
    importNdjson,
    exportNdjson,
    exportRuntimeManifest,
    snapshot,
    snapshotProfiles,
    snapshotTrainingSeeds,
    createTrainingSeedFor,
    listTrackedUsers,
    listModules,
    getModuleDescriptor,
    hasModule,
    validate,
  });
}


// ============================================================================
// MARK: Structured discovery surface
// ============================================================================

export function createBackendChatIntelligenceSurface(): BackendChatIntelligenceSurface {
  const capabilityMatrix = createCapabilityMatrix();
  const manifest = Object.freeze({
    entrypointVersion: BACKEND_CHAT_INTELLIGENCE_ENTRYPOINT_VERSION,
    authorities: Object.freeze([...BACKEND_CHAT_INTELLIGENCE_AUTHORITIES]),
    laws: Object.freeze([...BACKEND_CHAT_INTELLIGENCE_LAWS]),
    categories: Object.freeze([...BACKEND_CHAT_INTELLIGENCE_MODULE_CATEGORIES]),
    families: Object.freeze([...BACKEND_CHAT_INTELLIGENCE_FAMILIES]),
    modules: BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG,
    capabilityMatrix,
  }) as BackendChatIntelligenceSurfaceManifest;

  const modules = Object.freeze({
    coldStartPopulationModel: Object.freeze({
      descriptor: mustGetModuleDescriptor('coldStartPopulationModel'),
      factory: createColdStartPopulationModel,
      version: CHAT_COLD_START_POPULATION_MODEL_VERSION,
    }),
    learningProfileStore: Object.freeze({
      descriptor: mustGetModuleDescriptor('learningProfileStore'),
      factory: createLearningProfileStore,
    }),
    chatLearningCoordinator: Object.freeze({
      descriptor: mustGetModuleDescriptor('chatLearningCoordinator'),
      factory: createChatLearningCoordinator,
    }),
    episodicMemory: Object.freeze({
      descriptor: mustGetModuleDescriptor('episodicMemory'),
      factory: createChatEpisodicMemory,
      ctor: ChatEpisodicMemory,
    }),
    noveltyLedger: Object.freeze({
      descriptor: mustGetModuleDescriptor('noveltyLedger'),
      factory: createChatNoveltyLedger,
      ctor: ChatNoveltyLedger,
    }),
    playerFingerprintService: Object.freeze({
      descriptor: mustGetModuleDescriptor('playerFingerprintService'),
      factory: createChatPlayerFingerprintService,
      ctor: ChatPlayerFingerprintService,
    }),
    relationshipModel: Object.freeze({
      descriptor: mustGetModuleDescriptor('relationshipModel'),
      ctor: ChatRelationshipModel,
    }),
    scenePlanner: Object.freeze({
      descriptor: mustGetModuleDescriptor('scenePlanner'),
      factory: createChatScenePlanner,
      ctor: ChatScenePlanner,
    }),
    seasonalLiveOpsOverlayService: Object.freeze({
      descriptor: mustGetModuleDescriptor('seasonalLiveOpsOverlayService'),
      factory: createChatSeasonalLiveOpsOverlayService,
      ctor: ChatSeasonalLiveOpsOverlayService,
    }),
    semanticSimilarityIndex: Object.freeze({
      descriptor: mustGetModuleDescriptor('semanticSimilarityIndex'),
      factory: createChatSemanticSimilarityIndex,
      ctor: ChatSemanticSimilarityIndex,
      version: CHAT_SEMANTIC_SIMILARITY_INDEX_VERSION,
    }),
    surfaceRealizer: Object.freeze({
      descriptor: mustGetModuleDescriptor('surfaceRealizer'),
      factory: createChatSurfaceRealizer,
      ctor: ChatSurfaceRealizer,
    }),
    pressureAffectModel: Object.freeze({
      descriptor: mustGetModuleDescriptor('pressureAffectModel'),
      factory: createPressureAffectModel,
    }),
    attachmentModel: Object.freeze({
      descriptor: mustGetModuleDescriptor('attachmentModel'),
      factory: createAttachmentModel,
    }),
    emotionModel: Object.freeze({
      descriptor: mustGetModuleDescriptor('emotionModel'),
      factory: createEmotionModel,
    }),
  });

  const helpers = Object.freeze({
    evaluateEmotionModel,
    assessAttachment,
    evaluatePressureAffect,
    summarizePressureAffect,
  });

  function listModules(): readonly BackendChatIntelligenceModuleDescriptor[] {
    return BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG;
  }

  function listModulesByCategory(
    category: BackendChatIntelligenceModuleCategory,
  ): readonly BackendChatIntelligenceModuleDescriptor[] {
    return Object.freeze(
      BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG.filter(
        (descriptor) => descriptor.category === category,
      ),
    );
  }

  function listModulesByFamily(
    family: BackendChatIntelligenceFamily,
  ): readonly BackendChatIntelligenceModuleDescriptor[] {
    return Object.freeze(
      BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG.filter(
        (descriptor) => descriptor.family === family,
      ),
    );
  }

  function getModuleDescriptor(
    key: BackendChatIntelligenceModuleKey,
  ): BackendChatIntelligenceModuleDescriptor | undefined {
    return BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG.find(
      (descriptor) => descriptor.key === key,
    );
  }

  function hasModule(key: BackendChatIntelligenceModuleKey): boolean {
    return Boolean(getModuleDescriptor(key));
  }

  return Object.freeze({
    manifest,
    modules,
    helpers,
    listModules,
    listModulesByCategory,
    listModulesByFamily,
    getModuleDescriptor,
    hasModule,
  });
}


// ============================================================================
// MARK: Convenience helpers
// ============================================================================

export function createBackendChatLearningCoordinator(
  options: BackendChatIntelligenceBundleOptions = {},
): ChatLearningCoordinatorApi {
  return createBackendChatIntelligenceBundle(options).coordinator;
}

export function createBackendChatLearningProfileStore(
  options: BackendChatIntelligenceBundleOptions = {},
): LearningProfileStoreApi {
  return createBackendChatIntelligenceBundle(options).profileStore;
}

export function createBackendChatColdStartModel(
  options: BackendChatIntelligenceBundleOptions = {},
): ChatColdStartPopulationModelApi {
  return createBackendChatIntelligenceBundle(options).coldStartModel;
}

export function createBackendChatPressureAffectModel(
  options: BackendChatIntelligenceBundleOptions = {},
): PressureAffectModelApi {
  return createBackendChatIntelligenceBundle(options).pressureAffectModel;
}

export function createBackendChatAttachmentModel(
  options: BackendChatIntelligenceBundleOptions = {},
): AttachmentModelApi {
  return createBackendChatIntelligenceBundle(options).attachmentModel;
}

export function createBackendChatEmotionModel(
  options: BackendChatIntelligenceBundleOptions = {},
): EmotionModelApi {
  return createBackendChatIntelligenceBundle(options).emotionModel;
}

export function listBackendChatIntelligenceModules(): readonly BackendChatIntelligenceModuleDescriptor[] {
  return BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG;
}

export function listBackendChatIntelligenceModulesByCategory(
  category: BackendChatIntelligenceModuleCategory,
): readonly BackendChatIntelligenceModuleDescriptor[] {
  return createBackendChatIntelligenceSurface().listModulesByCategory(category);
}

export function listBackendChatIntelligenceModulesByFamily(
  family: BackendChatIntelligenceFamily,
): readonly BackendChatIntelligenceModuleDescriptor[] {
  return createBackendChatIntelligenceSurface().listModulesByFamily(family);
}

export function getBackendChatIntelligenceModuleDescriptor(
  key: BackendChatIntelligenceModuleKey,
): BackendChatIntelligenceModuleDescriptor | undefined {
  return createBackendChatIntelligenceSurface().getModuleDescriptor(key);
}

export function hasBackendChatIntelligenceModule(
  key: BackendChatIntelligenceModuleKey,
): boolean {
  return createBackendChatIntelligenceSurface().hasModule(key);
}

export function exportBackendChatIntelligenceSurfaceManifest(): BackendChatIntelligenceSurfaceManifest {
  return createBackendChatIntelligenceSurface().manifest;
}


// ============================================================================
// MARK: Runtime helpers
// ============================================================================

function buildVersionManifest(input: {
  readonly runtime: ChatRuntimeConfig;
  readonly pressureAffectModel: PressureAffectModelApi;
  readonly attachmentModel: AttachmentModelApi;
  readonly emotionModel: EmotionModelApi;
}): BackendChatIntelligenceVersionManifest {
  return Object.freeze({
    entrypoint: BACKEND_CHAT_INTELLIGENCE_ENTRYPOINT_VERSION,
    runtime: input.runtime.version,
    coldStartPopulationModel: CHAT_COLD_START_POPULATION_MODEL_VERSION,
    semanticSimilarityIndex: CHAT_SEMANTIC_SIMILARITY_INDEX_VERSION,
    pressureAffectModel: input.pressureAffectModel.version,
    attachmentModel: input.attachmentModel.version,
    emotionModel: input.emotionModel.version,
  });
}

function createCapabilityMatrix(): BackendChatIntelligenceCapabilityMatrix {
  return Object.freeze({
    hasFoundationalBundle: true,
    exportsFullSurface: true,
    exportsDlCompatibility: true,
    hasColdStartPopulationModel: true,
    hasLearningProfileStore: true,
    hasLearningCoordinator: true,
    hasEpisodicMemorySurface: true,
    hasNoveltyLedgerSurface: true,
    hasPlayerFingerprintSurface: true,
    hasRelationshipSurface: true,
    hasScenePlannerSurface: true,
    hasSeasonalLiveOpsSurface: true,
    hasSemanticSimilaritySurface: true,
    hasSurfaceRealizerSurface: true,
    hasPressureAffectModel: true,
    hasAttachmentModel: true,
    hasEmotionModel: true,
    hasCatalogDiscovery: true,
    hasPortableLoggerAdapter: true,
    hasBundleValidation: true,
    hasRuntimeManifest: true,
    hasSnapshotExport: true,
    hasTrainingSeedHelpers: true,
  });
}

function mustGetModuleDescriptor(
  key: BackendChatIntelligenceModuleKey,
): BackendChatIntelligenceModuleDescriptor {
  const descriptor = BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG.find(
    (candidate) => candidate.key === key,
  );

  if (!descriptor) {
    throw new Error(`Missing backend chat intelligence descriptor: ${key}`);
  }

  return descriptor;
}

function mergeRuntime(runtime?: Partial<ChatRuntimeConfig>): ChatRuntimeConfig {
  return Object.freeze({
    ...CHAT_RUNTIME_DEFAULTS,
    ...(runtime ?? {}),
    learningPolicy: Object.freeze({
      ...CHAT_RUNTIME_DEFAULTS.learningPolicy,
      ...(runtime?.learningPolicy ?? {}),
    }),
  }) as ChatRuntimeConfig;
}

function createPortableLogger(
  ports: Pick<ChatEnginePorts, 'logger'>,
):
  | {
      debug(message: string, context?: Readonly<Record<string, unknown>>): void;
      info(message: string, context?: Readonly<Record<string, unknown>>): void;
      warn(message: string, context?: Readonly<Record<string, unknown>>): void;
    }
  | undefined {
  if (!ports.logger) {
    return undefined;
  }

  return Object.freeze({
    debug: ports.logger.debug.bind(ports.logger),
    info: ports.logger.info.bind(ports.logger),
    warn: ports.logger.warn.bind(ports.logger),
  });
}

// ============================================================================
// MARK: Published convenience constants
// ============================================================================

export const BACKEND_CHAT_INTELLIGENCE_SURFACE = createBackendChatIntelligenceSurface();

export const BACKEND_CHAT_INTELLIGENCE_DEFAULT_SEMANTIC_SIMILARITY_CONFIG =
  DEFAULT_CHAT_SEMANTIC_SIMILARITY_INDEX_CONFIG;

// ============================================================================
// MARK: Module-specific descriptor constants
// ============================================================================


export const BACKEND_CHAT_INTELLIGENCE_COLD_START_POPULATION_MODEL_DESCRIPTOR = mustGetModuleDescriptor('coldStartPopulationModel');
export const BACKEND_CHAT_INTELLIGENCE_LEARNING_PROFILE_STORE_DESCRIPTOR = mustGetModuleDescriptor('learningProfileStore');
export const BACKEND_CHAT_INTELLIGENCE_CHAT_LEARNING_COORDINATOR_DESCRIPTOR = mustGetModuleDescriptor('chatLearningCoordinator');
export const BACKEND_CHAT_INTELLIGENCE_DL_COMPATIBILITY_LANE_DESCRIPTOR = mustGetModuleDescriptor('dlCompatibilityLane');
export const BACKEND_CHAT_INTELLIGENCE_EPISODIC_MEMORY_DESCRIPTOR = mustGetModuleDescriptor('episodicMemory');
export const BACKEND_CHAT_INTELLIGENCE_NOVELTY_LEDGER_DESCRIPTOR = mustGetModuleDescriptor('noveltyLedger');
export const BACKEND_CHAT_INTELLIGENCE_PLAYER_FINGERPRINT_SERVICE_DESCRIPTOR = mustGetModuleDescriptor('playerFingerprintService');
export const BACKEND_CHAT_INTELLIGENCE_RELATIONSHIP_MODEL_DESCRIPTOR = mustGetModuleDescriptor('relationshipModel');
export const BACKEND_CHAT_INTELLIGENCE_SCENE_PLANNER_DESCRIPTOR = mustGetModuleDescriptor('scenePlanner');
export const BACKEND_CHAT_INTELLIGENCE_SEASONAL_LIVE_OPS_OVERLAY_SERVICE_DESCRIPTOR = mustGetModuleDescriptor('seasonalLiveOpsOverlayService');
export const BACKEND_CHAT_INTELLIGENCE_SEMANTIC_SIMILARITY_INDEX_DESCRIPTOR = mustGetModuleDescriptor('semanticSimilarityIndex');
export const BACKEND_CHAT_INTELLIGENCE_SURFACE_REALIZER_DESCRIPTOR = mustGetModuleDescriptor('surfaceRealizer');
export const BACKEND_CHAT_INTELLIGENCE_EMOTION_MODEL_DESCRIPTOR = mustGetModuleDescriptor('emotionModel');
export const BACKEND_CHAT_INTELLIGENCE_ATTACHMENT_MODEL_DESCRIPTOR = mustGetModuleDescriptor('attachmentModel');
export const BACKEND_CHAT_INTELLIGENCE_PRESSURE_AFFECT_MODEL_DESCRIPTOR = mustGetModuleDescriptor('pressureAffectModel');

// ============================================================================
// MARK: Targeted module lookup helpers
// ============================================================================


export function getColdStartPopulationModelModuleDescriptor(): BackendChatIntelligenceModuleDescriptor {
  return mustGetModuleDescriptor('coldStartPopulationModel');
}

export function getLearningProfileStoreModuleDescriptor(): BackendChatIntelligenceModuleDescriptor {
  return mustGetModuleDescriptor('learningProfileStore');
}

export function getChatLearningCoordinatorModuleDescriptor(): BackendChatIntelligenceModuleDescriptor {
  return mustGetModuleDescriptor('chatLearningCoordinator');
}

export function getDlCompatibilityLaneModuleDescriptor(): BackendChatIntelligenceModuleDescriptor {
  return mustGetModuleDescriptor('dlCompatibilityLane');
}

export function getEpisodicMemoryModuleDescriptor(): BackendChatIntelligenceModuleDescriptor {
  return mustGetModuleDescriptor('episodicMemory');
}

export function getNoveltyLedgerModuleDescriptor(): BackendChatIntelligenceModuleDescriptor {
  return mustGetModuleDescriptor('noveltyLedger');
}

export function getPlayerFingerprintServiceModuleDescriptor(): BackendChatIntelligenceModuleDescriptor {
  return mustGetModuleDescriptor('playerFingerprintService');
}

export function getRelationshipModelModuleDescriptor(): BackendChatIntelligenceModuleDescriptor {
  return mustGetModuleDescriptor('relationshipModel');
}

export function getScenePlannerModuleDescriptor(): BackendChatIntelligenceModuleDescriptor {
  return mustGetModuleDescriptor('scenePlanner');
}

export function getSeasonalLiveOpsOverlayServiceModuleDescriptor(): BackendChatIntelligenceModuleDescriptor {
  return mustGetModuleDescriptor('seasonalLiveOpsOverlayService');
}

export function getSemanticSimilarityIndexModuleDescriptor(): BackendChatIntelligenceModuleDescriptor {
  return mustGetModuleDescriptor('semanticSimilarityIndex');
}

export function getSurfaceRealizerModuleDescriptor(): BackendChatIntelligenceModuleDescriptor {
  return mustGetModuleDescriptor('surfaceRealizer');
}

export function getEmotionModelModuleDescriptor(): BackendChatIntelligenceModuleDescriptor {
  return mustGetModuleDescriptor('emotionModel');
}

export function getAttachmentModelModuleDescriptor(): BackendChatIntelligenceModuleDescriptor {
  return mustGetModuleDescriptor('attachmentModel');
}

export function getPressureAffectModelModuleDescriptor(): BackendChatIntelligenceModuleDescriptor {
  return mustGetModuleDescriptor('pressureAffectModel');
}


// ============================================================================
// MARK: Category and inclusion manifests
// ============================================================================

export const BACKEND_CHAT_INTELLIGENCE_REQUIRED_BUNDLE_MODULES = Object.freeze(
  BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG.filter(
    (descriptor) => descriptor.bundleInclusion === 'required',
  ),
);

export const BACKEND_CHAT_INTELLIGENCE_SURFACE_ONLY_MODULES = Object.freeze(
  BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG.filter(
    (descriptor) => descriptor.bundleInclusion === 'surface-only',
  ),
);

export const BACKEND_CHAT_INTELLIGENCE_EXPORT_ONLY_MODULES = Object.freeze(
  BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG.filter(
    (descriptor) => descriptor.bundleInclusion === 'export-only',
  ),
);

export const BACKEND_CHAT_INTELLIGENCE_FOUNDATION_MODULES = Object.freeze(
  BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG.filter(
    (descriptor) => descriptor.category === 'FOUNDATION',
  ),
);

export const BACKEND_CHAT_INTELLIGENCE_COMPATIBILITY_MODULES = Object.freeze(
  BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG.filter(
    (descriptor) => descriptor.category === 'COMPATIBILITY',
  ),
);

export const BACKEND_CHAT_INTELLIGENCE_ADAPTATION_MODULES = Object.freeze(
  BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG.filter(
    (descriptor) => descriptor.category === 'ADAPTATION',
  ),
);

export const BACKEND_CHAT_INTELLIGENCE_ORCHESTRATION_MODULES = Object.freeze(
  BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG.filter(
    (descriptor) => descriptor.category === 'ORCHESTRATION',
  ),
);

export const BACKEND_CHAT_INTELLIGENCE_SEMANTIC_MODULES = Object.freeze(
  BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG.filter(
    (descriptor) => descriptor.category === 'SEMANTICS',
  ),
);

export const BACKEND_CHAT_INTELLIGENCE_REALIZATION_MODULES = Object.freeze(
  BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG.filter(
    (descriptor) => descriptor.category === 'REALIZATION',
  ),
);

export const BACKEND_CHAT_INTELLIGENCE_ML_MODULES = Object.freeze(
  BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG.filter(
    (descriptor) => descriptor.category === 'ML',
  ),
);

export const BACKEND_CHAT_INTELLIGENCE_LEARNING_CORE_FAMILY = Object.freeze(
  BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG.filter(
    (descriptor) => descriptor.family === 'learning-core',
  ),
);

export const BACKEND_CHAT_INTELLIGENCE_CONTINUITY_FAMILY = Object.freeze(
  BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG.filter(
    (descriptor) => descriptor.family === 'continuity',
  ),
);

export const BACKEND_CHAT_INTELLIGENCE_MEMORY_FAMILY = Object.freeze(
  BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG.filter(
    (descriptor) => descriptor.family === 'memory',
  ),
);

export const BACKEND_CHAT_INTELLIGENCE_PACING_FAMILY = Object.freeze(
  BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG.filter(
    (descriptor) => descriptor.family === 'pacing',
  ),
);

export const BACKEND_CHAT_INTELLIGENCE_PLAYER_MODELING_FAMILY = Object.freeze(
  BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG.filter(
    (descriptor) => descriptor.family === 'player-modeling',
  ),
);

export const BACKEND_CHAT_INTELLIGENCE_RELATIONSHIP_FAMILY = Object.freeze(
  BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG.filter(
    (descriptor) => descriptor.family === 'relationship',
  ),
);

export const BACKEND_CHAT_INTELLIGENCE_SCENE_FAMILY = Object.freeze(
  BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG.filter(
    (descriptor) => descriptor.family === 'scene',
  ),
);

export const BACKEND_CHAT_INTELLIGENCE_LIVEOPS_FAMILY = Object.freeze(
  BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG.filter(
    (descriptor) => descriptor.family === 'liveops',
  ),
);

export const BACKEND_CHAT_INTELLIGENCE_SEMANTIC_FAMILY = Object.freeze(
  BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG.filter(
    (descriptor) => descriptor.family === 'semantic',
  ),
);

export const BACKEND_CHAT_INTELLIGENCE_SURFACE_FAMILY = Object.freeze(
  BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG.filter(
    (descriptor) => descriptor.family === 'surface',
  ),
);

export const BACKEND_CHAT_INTELLIGENCE_AFFECT_FAMILY = Object.freeze(
  BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG.filter(
    (descriptor) => descriptor.family === 'affect',
  ),
);

export interface BackendChatIntelligenceGroupedCatalog {
  readonly byCategory: Readonly<Record<BackendChatIntelligenceModuleCategory, readonly BackendChatIntelligenceModuleDescriptor[]>>;
  readonly byFamily: Readonly<Record<BackendChatIntelligenceFamily, readonly BackendChatIntelligenceModuleDescriptor[]>>;
  readonly required: readonly BackendChatIntelligenceModuleDescriptor[];
  readonly surfaceOnly: readonly BackendChatIntelligenceModuleDescriptor[];
  readonly exportOnly: readonly BackendChatIntelligenceModuleDescriptor[];
}

export function groupBackendChatIntelligenceCatalog(): BackendChatIntelligenceGroupedCatalog {
  return Object.freeze({
    byCategory: Object.freeze({
      FOUNDATION: BACKEND_CHAT_INTELLIGENCE_FOUNDATION_MODULES,
      COMPATIBILITY: BACKEND_CHAT_INTELLIGENCE_COMPATIBILITY_MODULES,
      ADAPTATION: BACKEND_CHAT_INTELLIGENCE_ADAPTATION_MODULES,
      ORCHESTRATION: BACKEND_CHAT_INTELLIGENCE_ORCHESTRATION_MODULES,
      SEMANTICS: BACKEND_CHAT_INTELLIGENCE_SEMANTIC_MODULES,
      REALIZATION: BACKEND_CHAT_INTELLIGENCE_REALIZATION_MODULES,
      ML: BACKEND_CHAT_INTELLIGENCE_ML_MODULES,
    }),
    byFamily: Object.freeze({
      'learning-core': BACKEND_CHAT_INTELLIGENCE_LEARNING_CORE_FAMILY,
      continuity: BACKEND_CHAT_INTELLIGENCE_CONTINUITY_FAMILY,
      memory: BACKEND_CHAT_INTELLIGENCE_MEMORY_FAMILY,
      pacing: BACKEND_CHAT_INTELLIGENCE_PACING_FAMILY,
      'player-modeling': BACKEND_CHAT_INTELLIGENCE_PLAYER_MODELING_FAMILY,
      relationship: BACKEND_CHAT_INTELLIGENCE_RELATIONSHIP_FAMILY,
      scene: BACKEND_CHAT_INTELLIGENCE_SCENE_FAMILY,
      liveops: BACKEND_CHAT_INTELLIGENCE_LIVEOPS_FAMILY,
      semantic: BACKEND_CHAT_INTELLIGENCE_SEMANTIC_FAMILY,
      surface: BACKEND_CHAT_INTELLIGENCE_SURFACE_FAMILY,
      affect: BACKEND_CHAT_INTELLIGENCE_AFFECT_FAMILY,
    }),
    required: BACKEND_CHAT_INTELLIGENCE_REQUIRED_BUNDLE_MODULES,
    surfaceOnly: BACKEND_CHAT_INTELLIGENCE_SURFACE_ONLY_MODULES,
    exportOnly: BACKEND_CHAT_INTELLIGENCE_EXPORT_ONLY_MODULES,
  });
}

// ============================================================================
// MARK: Descriptor maps
// ============================================================================

export const BACKEND_CHAT_INTELLIGENCE_DESCRIPTOR_BY_KEY = Object.freeze(
  BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG.reduce(
    (accumulator, descriptor) => {
      accumulator[descriptor.key] = descriptor;
      return accumulator;
    },
    {} as Record<BackendChatIntelligenceModuleKey, BackendChatIntelligenceModuleDescriptor>,
  ),
);

export const BACKEND_CHAT_INTELLIGENCE_DESCRIPTOR_BY_ID = Object.freeze(
  BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG.reduce(
    (accumulator, descriptor) => {
      accumulator[descriptor.id] = descriptor;
      return accumulator;
    },
    {} as Record<BackendChatIntelligenceModuleId, BackendChatIntelligenceModuleDescriptor>,
  ),
);

export function getBackendChatIntelligenceDescriptorById(
  id: BackendChatIntelligenceModuleId,
): BackendChatIntelligenceModuleDescriptor {
  return BACKEND_CHAT_INTELLIGENCE_DESCRIPTOR_BY_ID[id];
}

export function getBackendChatIntelligenceDescriptorByPath(
  canonicalPath: string,
): BackendChatIntelligenceModuleDescriptor | undefined {
  return BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG.find(
    (descriptor) => descriptor.canonicalPath === canonicalPath,
  );
}


// ============================================================================
// MARK: Consumer routing and export manifests
// ============================================================================

export interface BackendChatIntelligenceConsumerRoute {
  readonly consumer:
    | 'backend-chat-engine'
    | 'backend-orchestrators'
    | 'frontend-chat-runtime'
    | 'server-transport'
    | 'operator-tooling'
    | 'tests';
  readonly moduleKeys: readonly BackendChatIntelligenceModuleKey[];
  readonly notes: readonly string[];
}

export const BACKEND_CHAT_INTELLIGENCE_CONSUMER_ROUTES = Object.freeze([
  Object.freeze({
    consumer: 'backend-chat-engine',
    moduleKeys: Object.freeze([
      'coldStartPopulationModel',
      'learningProfileStore',
      'chatLearningCoordinator',
      'playerFingerprintService',
      'relationshipModel',
      'scenePlanner',
      'semanticSimilarityIndex',
      'surfaceRealizer',
      'pressureAffectModel',
      'attachmentModel',
      'emotionModel',
    ]),
    notes: Object.freeze([
      'Primary backend chat authority callers should prefer the structured surface or top-level re-exports instead of deep paths.',
      'The foundational learning trio plus the affect models form the canonical default composition root.',
    ]),
  }),
  Object.freeze({
    consumer: 'backend-orchestrators',
    moduleKeys: Object.freeze([
      'episodicMemory',
      'noveltyLedger',
      'playerFingerprintService',
      'relationshipModel',
      'scenePlanner',
      'seasonalLiveOpsOverlayService',
      'semanticSimilarityIndex',
      'surfaceRealizer',
    ]),
    notes: Object.freeze([
      'Orchestrators should use these modules as authored support surfaces rather than inventing parallel local heuristics.',
    ]),
  }),
  Object.freeze({
    consumer: 'frontend-chat-runtime',
    moduleKeys: Object.freeze([
      'dlCompatibilityLane',
      'episodicMemory',
      'noveltyLedger',
      'scenePlanner',
      'surfaceRealizer',
      'semanticSimilarityIndex',
    ]),
    notes: Object.freeze([
      'Frontend parity and mirror lanes should bind to shared semantic contracts and stable export paths from this root when backend imports are required for tests or tooling.',
    ]),
  }),
  Object.freeze({
    consumer: 'server-transport',
    moduleKeys: Object.freeze([
      'seasonalLiveOpsOverlayService',
      'semanticSimilarityIndex',
      'surfaceRealizer',
      'dlCompatibilityLane',
    ]),
    notes: Object.freeze([
      'Transport-edge novelty guards and liveops overlays should remain path-stable.',
    ]),
  }),
  Object.freeze({
    consumer: 'operator-tooling',
    moduleKeys: Object.freeze([
      'learningProfileStore',
      'chatLearningCoordinator',
      'playerFingerprintService',
      'seasonalLiveOpsOverlayService',
      'semanticSimilarityIndex',
      'emotionModel',
    ]),
    notes: Object.freeze([
      'Diagnostics, manifests, imports, exports, and replay-adjacent tooling should point here first.',
    ]),
  }),
  Object.freeze({
    consumer: 'tests',
    moduleKeys: Object.freeze([
      'coldStartPopulationModel',
      'learningProfileStore',
      'chatLearningCoordinator',
      'episodicMemory',
      'noveltyLedger',
      'playerFingerprintService',
      'relationshipModel',
      'scenePlanner',
      'seasonalLiveOpsOverlayService',
      'semanticSimilarityIndex',
      'surfaceRealizer',
      'pressureAffectModel',
      'attachmentModel',
      'emotionModel',
    ]),
    notes: Object.freeze([
      'Tests should import from the index root whenever possible so export regressions are caught early.',
    ]),
  }),
] as const) as readonly BackendChatIntelligenceConsumerRoute[];

export function listBackendChatIntelligenceRoutes(): readonly BackendChatIntelligenceConsumerRoute[] {
  return BACKEND_CHAT_INTELLIGENCE_CONSUMER_ROUTES;
}

export function getBackendChatIntelligenceRoute(
  consumer: BackendChatIntelligenceConsumerRoute['consumer'],
): BackendChatIntelligenceConsumerRoute | undefined {
  return BACKEND_CHAT_INTELLIGENCE_CONSUMER_ROUTES.find(
    (route) => route.consumer === consumer,
  );
}

export interface BackendChatIntelligenceExportManifestLine {
  readonly moduleKey: BackendChatIntelligenceModuleKey;
  readonly canonicalPath: string;
  readonly constructors: readonly string[];
  readonly classes: readonly string[];
  readonly primaryExports: readonly string[];
}

export function exportBackendChatIntelligenceExportManifest(): readonly BackendChatIntelligenceExportManifestLine[] {
  return Object.freeze(
    BACKEND_CHAT_INTELLIGENCE_MODULE_CATALOG.map((descriptor) =>
      Object.freeze({
        moduleKey: descriptor.key,
        canonicalPath: descriptor.canonicalPath,
        constructors: descriptor.constructors,
        classes: descriptor.classes,
        primaryExports: descriptor.primaryExports,
      }),
    ),
  );
}

export function assertBackendChatIntelligenceSurfaceCoverage(): void {
  const routes = listBackendChatIntelligenceRoutes();
  const knownKeys = new Set(BACKEND_CHAT_INTELLIGENCE_MODULE_KEYS);

  for (const route of routes) {
    for (const key of route.moduleKeys) {
      if (!knownKeys.has(key)) {
        throw new Error(`Unknown backend chat intelligence route key: ${key}`);
      }
    }
  }
}


// ============================================================================
// MARK: Stable module key sets
// ============================================================================

export const BACKEND_CHAT_INTELLIGENCE_CORE_REQUIRED_KEYS = Object.freeze([
  'coldStartPopulationModel',
  'learningProfileStore',
  'chatLearningCoordinator',
  'pressureAffectModel',
  'attachmentModel',
  'emotionModel',
] as const);

export const BACKEND_CHAT_INTELLIGENCE_DISCOVERY_KEYS = Object.freeze([
  'episodicMemory',
  'noveltyLedger',
  'playerFingerprintService',
  'relationshipModel',
  'scenePlanner',
  'seasonalLiveOpsOverlayService',
  'semanticSimilarityIndex',
  'surfaceRealizer',
  'dlCompatibilityLane',
] as const);
