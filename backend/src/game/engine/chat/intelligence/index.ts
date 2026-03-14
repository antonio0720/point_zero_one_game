/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT INTELLIGENCE ENTRYPOINT
 * FILE: backend/src/game/engine/chat/intelligence/index.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Unified intelligence barrel + construction surface for the backend chat lane.
 *
 * This file is intentionally more than a passive export list.
 * It is the composition entrypoint for the three foundational backend chat
 * intelligence authorities in this batch:
 *
 * - ColdStartPopulationModel.ts
 * - LearningProfileStore.ts
 * - ChatLearningCoordinator.ts
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
  ChatLearningCoordinatorDecisionSnapshot,
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

// ============================================================================
// MARK: Public bundle contracts
// ============================================================================

export interface BackendChatIntelligenceBundle {
  readonly runtime: ChatRuntimeConfig;
  readonly coldStartModel: ChatColdStartPopulationModelApi;
  readonly profileStore: LearningProfileStoreApi;
  readonly coordinator: ChatLearningCoordinatorApi;
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

