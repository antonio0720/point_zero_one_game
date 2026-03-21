/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT INTELLIGENCE ENTRYPOINT
 * FILE: backend/src/game/engine/chat/intelligence/index.ts
 * VERSION: 2026.03.20-backend-intelligence-emotion.v1
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Unified intelligence barrel + construction surface for the backend chat lane.
 *
 * This file is intentionally more than a passive export list.
 * It is the composition entrypoint for the foundational backend chat
 * intelligence authorities in this batch:
 *
 * - ColdStartPopulationModel.ts
 * - LearningProfileStore.ts
 * - ChatLearningCoordinator.ts
 * - ml/EmotionModel.ts
 * - ml/PressureAffectModel.ts
 * - ml/AttachmentModel.ts
 *
 * Why this file exists
 * --------------------
 * The backend chat lane needs a single intelligence entrypoint that can:
 *
 * 1. construct the cold-start model once,
 * 2. compose the profile store around that model,
 * 3. compose the coordinator around both,
 * 4. expose a stable public surface to ChatEngine.ts and adjacent callers,
 * 5. support hydration / snapshot / flush without re-wiring every caller.
 *
 * Design doctrine
 * ---------------
 * - index.ts is still a backend servant, not a second authority lane.
 * - durable learning truth remains inside the store and coordinator.
 * - index.ts exists to eliminate repetitive construction drift.
 * - bundle helpers must remain deterministic and side-effect-light.
 * ============================================================================
 */

import type { ChatEnginePorts, ChatLearningProfile, ChatRuntimeConfig, ChatUserId } from '../types';

import { CHAT_RUNTIME_DEFAULTS } from '../types';

// ── Core intelligence exports ─────────────────────────────────────────────────

export type {
  ColdStartArchetypeId,
  ColdStartPressurePosture,
  ChatColdStartArchetypeDescriptor,
  ChatColdStartArchetypeScore,
  ChatColdStartClientHints,
  ChatColdStartLegacyCompat,
  ChatColdStartPopulationContext,
  ChatColdStartPopulationModelApi,
  ChatColdStartPopulationModelOptions,
  ChatColdStartPopulationPrior,
  ChatColdStartPopulationStats,
  ChatColdStartProfileSeed,
  ChatColdStartRecommendation,
} from './ColdStartPopulationModel';

export {
  CHAT_COLD_START_POPULATION_MODEL_VERSION,
  createColdStartPopulationModel,
} from './ColdStartPopulationModel';

export type {
  LearningProfileStoreApi,
  LearningProfileStoreContext,
  LearningProfileStoreExportLine,
  LearningProfileStoreFlushResult,
  LearningProfileStoreHydrationResult,
  LearningProfileStoreImportResult,
  LearningProfileStoreMutationMeta,
  LearningProfileStoreOptions,
  LearningProfileStoreQuery,
  LearningProfileStoreRecommendation,
  LearningProfileStoreUpsertResult,
} from './LearningProfileStore';

export { createLearningProfileStore } from './LearningProfileStore';

export type {
  ChatLearningCoordinatorAcceptedMessageContext,
  ChatLearningCoordinatorApi,
  ChatLearningCoordinatorChannelSwitchContext,
  ChatLearningDecisionSnapshot,
  ChatLearningCoordinatorDiagnostics,
  ChatLearningCoordinatorFeatureContext,
  ChatLearningCoordinatorHydrationPayload,
  ChatLearningCoordinatorHydrationResult,
  ChatLearningCoordinatorInferenceContext,
  ChatLearningCoordinatorNormalizedEventResult,
  ChatLearningCoordinatorObservers,
  ChatLearningCoordinatorOpenContext,
  ChatLearningCoordinatorOptions,
  ChatLearningCoordinatorRescueContext,
  ChatLearningCoordinatorSalienceContext,
  ChatLearningCoordinatorSessionState,
  ChatLearningCoordinatorTelemetryRecord,
  ChatLearningCoordinatorTrainingSeed,
} from './ChatLearningCoordinator';

export { createChatLearningCoordinator } from './ChatLearningCoordinator';

// Canonical retrieval-backed continuity lane.
// Keep this inside intelligence/ so newer backend surfaces do not have to reach
// back through the legacy root dl/ compatibility barrel.
export * from './dl';

// ── 8 additional intelligence modules ─────────────────────────────────────────

export type {
  ChatEpisodicTriggerContext,
  ChatEpisodicCallbackVariant,
  ChatEpisodicMemoryRecord,
  ChatEpisodicCallbackCandidate,
  ChatEpisodicMemorySnapshot,
  ChatEpisodicMemoryQuery,
  ChatEpisodicMemoryOptions,
} from './ChatEpisodicMemory';

export { ChatEpisodicMemory, createChatEpisodicMemory } from './ChatEpisodicMemory';

export type {
  ChatNoveltyLedgerCandidate,
  ChatNoveltyLedgerEvent,
  ChatNoveltyLedgerCounter,
  ChatNoveltyLedgerFatigue,
  ChatNoveltyLedgerScore,
  ChatNoveltyLedgerSnapshot,
  ChatNoveltyLedgerOptions,
} from './ChatNoveltyLedger';

export { ChatNoveltyLedger, createChatNoveltyLedger } from './ChatNoveltyLedger';

export { ChatPlayerFingerprintService, createChatPlayerFingerprintService } from './ChatPlayerFingerprintService';

export type {
  ChatRelationshipModelOptions,
  ChatRelationshipPlayerMessageInput,
  ChatRelationshipNpcUtteranceInput,
  ChatRelationshipGameEventInput,
  ChatRelationshipSignalRequest,
} from './ChatRelationshipModel';

export { ChatRelationshipModel } from './ChatRelationshipModel';

export { ChatScenePlanner, createChatScenePlanner } from './ChatScenePlanner';

export {
  ChatSeasonalLiveOpsOverlayService,
  createChatSeasonalLiveOpsOverlayService,
} from './ChatSeasonalLiveOpsOverlayService';

export type {
  ChatSemanticSimilarityIndexConfig,
} from './ChatSemanticSimilarityIndex';

export {
  CHAT_SEMANTIC_SIMILARITY_INDEX_VERSION,
  DEFAULT_CHAT_SEMANTIC_SIMILARITY_INDEX_CONFIG,
  ChatSemanticSimilarityIndex,
  createChatSemanticSimilarityIndex,
} from './ChatSemanticSimilarityIndex';

export { ChatSurfaceRealizer, createChatSurfaceRealizer } from './ChatSurfaceRealizer';

// ── Emotion ML exports (patch addition) ───────────────────────────────────────

export type {
  EmotionModelApi,
  EmotionModelInput,
  EmotionModelOptions,
  EmotionModelRecommendation,
  EmotionModelResult,
} from './ml/EmotionModel';

export { createEmotionModel, evaluateEmotionModel } from './ml/EmotionModel';

export type {
  AttachmentAssessment,
  AttachmentAffinityCandidate,
  AttachmentModelApi,
  AttachmentModelInput,
  AttachmentModelOptions,
} from './ml/AttachmentModel';

export { createAttachmentModel, assessAttachment } from './ml/AttachmentModel';

export type {
  PressureAffectModelApi,
  PressureAffectModelInput,
  PressureAffectModelOptions,
  PressureAffectPolicyFlags,
  PressureAffectRecommendation,
  PressureAffectResult,
} from './ml/PressureAffectModel';

export {
  createPressureAffectModel,
  evaluatePressureAffect,
  summarizePressureAffect,
} from './ml/PressureAffectModel';

// ── Private imports for bundle factory ────────────────────────────────────────

import type {
  ChatColdStartPopulationModelApi,
  ChatColdStartPopulationModelOptions,
} from './ColdStartPopulationModel';

import { createColdStartPopulationModel } from './ColdStartPopulationModel';

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

import type {
  EmotionModelApi,
  EmotionModelOptions,
} from './ml/EmotionModel';

import { createEmotionModel } from './ml/EmotionModel';

import type {
  AttachmentModelApi,
  AttachmentModelOptions,
} from './ml/AttachmentModel';

import { createAttachmentModel } from './ml/AttachmentModel';

import type {
  PressureAffectModelApi,
  PressureAffectModelOptions,
} from './ml/PressureAffectModel';

import { createPressureAffectModel } from './ml/PressureAffectModel';

// ============================================================================
// MARK: Public bundle contracts
// ============================================================================

export interface BackendChatIntelligenceBundle {
  readonly runtime: ChatRuntimeConfig;
  readonly coldStartModel: ChatColdStartPopulationModelApi;
  readonly profileStore: LearningProfileStoreApi;
  readonly coordinator: ChatLearningCoordinatorApi;
  readonly pressureAffectModel: PressureAffectModelApi;
  readonly attachmentModel: AttachmentModelApi;
  readonly emotionModel: EmotionModelApi;
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
  };
  snapshot(): {
    readonly profiles: Readonly<Record<ChatUserId, ChatLearningProfile>>;
    readonly trainingSeeds: readonly ChatLearningCoordinatorTrainingSeed[];
  };
}

export interface BackendChatIntelligenceBundleOptions {
  readonly runtime?: Partial<ChatRuntimeConfig>;
  readonly ports?: Pick<
    ChatEnginePorts,
    'clock' | 'logger' | 'persistence' | 'learning'
  >;
  readonly coldStart?: ChatColdStartPopulationModelOptions;
  readonly profileStore?: Omit<LearningProfileStoreOptions, 'runtime' | 'ports' | 'coldStartModel'>;
  readonly coordinator?: Omit<
    ChatLearningCoordinatorOptions,
    'runtime' | 'ports' | 'coldStartModel' | 'profileStore'
  >;
  readonly pressureAffectModel?: PressureAffectModelOptions;
  readonly attachmentModel?: AttachmentModelOptions;
  readonly emotionModel?: Omit<EmotionModelOptions, 'pressureAffectModel' | 'attachmentModel'>;
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
  } {
    const profiles = coordinator.snapshotProfiles();
    const diagnostics = coordinator.exportDiagnostics();
    return Object.freeze({
      runtimeVersion: runtime.version,
      learningPolicy: runtime.learningPolicy,
      totalProfiles: Object.keys(profiles).length,
      totalTrackedUsers: coordinator.listSessionStates().length,
      diagnostics,
      coldStartManifest: coldStartModel.exportManifest(),
      emotionModels: Object.freeze({
        pressureAffect: pressureAffectModel.version,
        attachment: attachmentModel.version,
        emotion: emotionModel.version,
      }),
    });
  }

  function snapshot(): {
    readonly profiles: Readonly<Record<ChatUserId, ChatLearningProfile>>;
    readonly trainingSeeds: readonly ChatLearningCoordinatorTrainingSeed[];
  } {
    const profiles = coordinator.snapshotProfiles();
    const trainingSeeds = Object.keys(profiles)
      .map((userId) => coordinator.createTrainingSeed(userId as ChatUserId))
      .filter((value): value is ChatLearningCoordinatorTrainingSeed => Boolean(value));

    return Object.freeze({
      profiles,
      trainingSeeds: Object.freeze(trainingSeeds),
    });
  }

  return Object.freeze({
    runtime,
    coldStartModel,
    profileStore,
    coordinator,
    pressureAffectModel,
    attachmentModel,
    emotionModel,
    flush,
    hydrate,
    importNdjson,
    exportNdjson,
    exportRuntimeManifest,
    snapshot,
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

// ============================================================================
// MARK: Runtime helpers
// ============================================================================

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