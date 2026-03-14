/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT LEARNING COORDINATOR
 * FILE: backend/src/game/engine/chat/intelligence/ChatLearningCoordinator.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Central orchestration authority for backend chat learning.
 *
 * This file coordinates the durable learning lane sitting between:
 *
 * - canonical normalized chat events,
 * - accepted transcript mutations,
 * - feature snapshots,
 * - inference snapshots,
 * - cold-start population priors,
 * - durable learning profile storage,
 * - telemetry-worthy learning facts,
 * - engine-facing cadence / intervention recommendations.
 *
 * Why this file exists
 * --------------------
 * The profile store and cold-start model are necessary primitives, but neither
 * is sufficient to run the authoritative learning path by itself.
 *
 * The backend still needs one coordinator that:
 *
 * 1. accepts engine-side learning inputs in authoritative order,
 * 2. makes profile-creation timing deterministic,
 * 3. normalizes second-one hints into backend-owned decisions,
 * 4. prevents telemetry / profile / recommendation drift,
 * 5. emits consistent engine-facing decision snapshots,
 * 6. tracks per-user learning session state across rooms and events,
 * 7. stages replay / diagnostics / training-adjacent artifacts,
 * 8. keeps the learning lane as a servant of truth, not a parallel authority.
 *
 * Design doctrine
 * ---------------
 * - The coordinator never writes transcript truth.
 * - The coordinator never overrides moderation or channel law.
 * - The coordinator only mutates durable learning through backend acceptance.
 * - The coordinator may accept feature and inference hints, but runtime policy
 *   still determines whether those hints are allowed to matter.
 * - The coordinator emits recommendations, not direct transcript entries.
 * - The coordinator is deterministic from the same runtime + inputs.
 *
 * What this file owns
 * -------------------
 * - composition of cold-start model + durable profile store,
 * - authoritative learning session lifecycle,
 * - event-to-profile mutation orchestration,
 * - decision snapshot generation,
 * - telemetry-worthy learning records,
 * - in-memory diagnostics for current runtime,
 * - import / export / hydration helpers spanning multiple intelligence files,
 * - engine-facing cadence, channel, and intervention recommendations.
 *
 * What this file does not own
 * ---------------------------
 * - transcript append / redaction,
 * - replay indexing,
 * - moderation and rate law,
 * - websocket fanout,
 * - ML model execution outside the current deterministic heuristics,
 * - offline training jobs.
 * ============================================================================
 */

import type {
  ChatEnginePorts,
  ChatFeatureSnapshot,
  ChatInferenceSnapshot,
  ChatLearningProfile,
  ChatNormalizedEvent,
  ChatRoomId,
  ChatRuntimeConfig,
  ChatTelemetryEnvelope,
  ChatUserId,
  ChatVisibleChannel,
  JsonValue,
  Score01,
  UnixMs,
} from '../types';

import {
  CHAT_RUNTIME_DEFAULTS,
  asUnixMs,
  clamp01,
} from '../types';

import type {
  ChatColdStartClientHints,
  ChatColdStartLegacyCompat,
  ChatColdStartPopulationContext,
  ChatColdStartPopulationModelApi,
  ChatColdStartPopulationPrior,
  ChatColdStartRecommendation,
  ChatColdStartProfileSeed,
} from './ColdStartPopulationModel';

import {
  CHAT_COLD_START_POPULATION_MODEL_VERSION,
  createColdStartPopulationModel,
} from './ColdStartPopulationModel';

import type {
  LearningProfileStoreApi,
  LearningProfileStoreContext,
  LearningProfileStoreFlushResult,
  LearningProfileStoreHydrationResult,
  LearningProfileStoreImportResult,
  LearningProfileStoreMutationMeta,
  LearningProfileStoreRecommendation,
  LearningProfileStoreUpsertResult,
} from './LearningProfileStore';

import { createLearningProfileStore } from './LearningProfileStore';

// ============================================================================
// MARK: Public contracts
// ============================================================================

export interface ChatLearningCoordinatorTelemetryRecord {
  readonly at: UnixMs;
  readonly kind:
    | 'COORDINATOR_BOOT'
    | 'PROFILE_ENSURED'
    | 'PROFILE_MUTATED'
    | 'PROFILE_FLUSHED'
    | 'PROFILE_IMPORTED'
    | 'PROFILE_HYDRATED'
    | 'FEATURE_SNAPSHOT_ACCEPTED'
    | 'FEATURE_SNAPSHOT_REJECTED'
    | 'INFERENCE_SNAPSHOT_ACCEPTED'
    | 'INFERENCE_SNAPSHOT_REJECTED'
    | 'NORMALIZED_EVENT_APPLIED'
    | 'NORMALIZED_EVENT_IGNORED'
    | 'CHANNEL_SWITCH_APPLIED'
    | 'RESCUE_OUTCOME_APPLIED'
    | 'SALIENCE_ANCHOR_ATTACHED'
    | 'CHAT_OPENED'
    | 'DECISION_SNAPSHOT_GENERATED'
    | 'AUTHORITATIVE_PROFILES_MERGED'
    | 'DIAGNOSTIC_EXPORT_CREATED';
  readonly userId?: ChatUserId | null;
  readonly roomId?: ChatRoomId | null;
  readonly reason?: string;
  readonly payload?: Readonly<Record<string, JsonValue>>;
}

export interface ChatLearningDecisionSnapshot {
  readonly generatedAt: UnixMs;
  readonly userId: ChatUserId;
  readonly roomId: ChatRoomId | null;
  readonly coldStart: boolean;
  readonly recommendedVisibleChannel: ChatVisibleChannel;
  readonly helperCadence01: Score01;
  readonly haterCadence01: Score01;
  readonly ambientCadence01: Score01;
  readonly helperUrgency01: Score01;
  readonly haterEligibility01: Score01;
  readonly churnRisk01: Score01;
  readonly confidence01: Score01;
  readonly frustration01: Score01;
  readonly intimidation01: Score01;
  readonly attachment01: Score01;
  readonly curiosity01: Score01;
  readonly embarrassment01: Score01;
  readonly relief01: Score01;
  readonly helperUrgencyTier:
    | 'NONE'
    | 'SOFT'
    | 'MEDIUM'
    | 'HARD'
    | 'CRITICAL';
  readonly haterAggressionTier:
    | 'NONE'
    | 'SOFT'
    | 'MEDIUM'
    | 'HARD'
    | 'PUBLIC';
  readonly ambientTier:
    | 'QUIET'
    | 'LOW'
    | 'MEDIUM'
    | 'HIGH'
    | 'CINEMATIC';
  readonly profile: ChatLearningProfile;
  readonly storeRecommendation: LearningProfileStoreRecommendation;
  readonly coldStartPrior: ChatColdStartPopulationPrior;
  readonly coldStartRecommendation: ChatColdStartRecommendation;
  readonly explanation: string;
}

export interface ChatLearningCoordinatorSessionState {
  readonly userId: ChatUserId;
  readonly activeRoomId: ChatRoomId | null;
  readonly openedAt: UnixMs | null;
  readonly lastActivityAt: UnixMs | null;
  readonly lastFeatureSnapshotAt: UnixMs | null;
  readonly lastInferenceSnapshotAt: UnixMs | null;
  readonly lastDecisionAt: UnixMs | null;
  readonly lastEventKind: string | null;
  readonly acceptedMessageCount: number;
  readonly channelSwitchCount: number;
  readonly rescueCount: number;
  readonly normalizedEventCount: number;
  readonly telemetryCount: number;
  readonly lastRecommendedVisibleChannel: ChatVisibleChannel | null;
  readonly lastSalienceAnchorId: string | null;
  readonly lastReason: string | null;
}

export interface ChatLearningCoordinatorDiagnostics {
  readonly runtimeVersion: string;
  readonly totalTrackedUsers: number;
  readonly bufferedTelemetryRecords: number;
  readonly totalAcceptedMessages: number;
  readonly totalChannelSwitches: number;
  readonly totalRescueOutcomes: number;
  readonly totalFeatureSnapshotsAccepted: number;
  readonly totalInferenceSnapshotsAccepted: number;
  readonly totalNormalizedEventsApplied: number;
  readonly ignoredNormalizedEvents: number;
  readonly decisionsGenerated: number;
  readonly coldStartModelVersion: typeof CHAT_COLD_START_POPULATION_MODEL_VERSION;
}

export interface ChatLearningCoordinatorHydrationPayload {
  readonly profiles?: unknown;
  readonly sessionState?: unknown;
  readonly bufferedTelemetry?: unknown;
}

export interface ChatLearningCoordinatorHydrationResult {
  readonly profiles: LearningProfileStoreHydrationResult;
  readonly hydratedUsers: readonly ChatUserId[];
  readonly rejectedSessionRecords: readonly {
    readonly raw: JsonValue;
    readonly reason: string;
  }[];
  readonly telemetryAccepted: number;
  readonly telemetryRejected: number;
}

export interface ChatLearningCoordinatorOpenContext {
  readonly userId: ChatUserId;
  readonly roomId?: ChatRoomId | null;
  readonly roomKind?: ChatColdStartPopulationContext['roomKind'];
  readonly stageMood?: ChatColdStartPopulationContext['stageMood'];
  readonly requestedChannel?: ChatVisibleChannel | null;
  readonly featureSnapshot?: ChatFeatureSnapshot | null;
  readonly legacyHints?: Partial<ChatColdStartLegacyCompat> | null;
  readonly clientHints?: Partial<ChatColdStartClientHints> | null;
  readonly now?: UnixMs | number;
  readonly reason?: string;
}

export interface ChatLearningCoordinatorAcceptedMessageContext {
  readonly userId: ChatUserId;
  readonly roomId?: ChatRoomId | null;
  readonly text: string;
  readonly channelId: ChatVisibleChannel;
  readonly helperInvolved?: boolean;
  readonly haterInvolved?: boolean;
  readonly messageLength?: number;
  readonly salienceAnchorId?: string | null;
  readonly now?: UnixMs | number;
  readonly reason?: string;
}

export interface ChatLearningCoordinatorFeatureContext {
  readonly userId: ChatUserId;
  readonly roomId?: ChatRoomId | null;
  readonly snapshot: ChatFeatureSnapshot;
  readonly now?: UnixMs | number;
  readonly reason?: string;
}

export interface ChatLearningCoordinatorInferenceContext {
  readonly snapshot: ChatInferenceSnapshot;
  readonly roomId?: ChatRoomId | null;
  readonly now?: UnixMs | number;
  readonly reason?: string;
}

export interface ChatLearningCoordinatorChannelSwitchContext {
  readonly userId: ChatUserId;
  readonly roomId?: ChatRoomId | null;
  readonly channelId: ChatVisibleChannel;
  readonly now?: UnixMs | number;
  readonly reason?: string;
}

export interface ChatLearningCoordinatorRescueContext {
  readonly userId: ChatUserId;
  readonly roomId?: ChatRoomId | null;
  readonly accepted: boolean;
  readonly urgency:
    | 'NONE'
    | 'SOFT'
    | 'MEDIUM'
    | 'HARD'
    | 'CRITICAL';
  readonly now?: UnixMs | number;
  readonly reason?: string;
}

export interface ChatLearningCoordinatorSalienceContext {
  readonly userId: ChatUserId;
  readonly roomId?: ChatRoomId | null;
  readonly anchorId: string;
  readonly now?: UnixMs | number;
  readonly reason?: string;
}

export interface ChatLearningCoordinatorNormalizedEventResult {
  readonly applied: boolean;
  readonly event: ChatNormalizedEvent;
  readonly mutation: LearningProfileStoreUpsertResult | null;
  readonly decision: ChatLearningDecisionSnapshot | null;
  readonly reason: string;
}

export interface ChatLearningCoordinatorTrainingSeed {
  readonly userId: ChatUserId;
  readonly exportedAt: UnixMs;
  readonly roomId: ChatRoomId | null;
  readonly decision: ChatLearningDecisionSnapshot | null;
  readonly profile: ChatLearningProfile | null;
  readonly session: ChatLearningCoordinatorSessionState | null;
  readonly telemetry: readonly ChatLearningCoordinatorTelemetryRecord[];
}

export interface ChatLearningCoordinatorObservers {
  readonly onTelemetryRecord?: (
    record: ChatLearningCoordinatorTelemetryRecord,
  ) => void | Promise<void>;
  readonly onDecisionSnapshot?: (
    snapshot: ChatLearningDecisionSnapshot,
  ) => void | Promise<void>;
  readonly onProfileMutation?: (
    mutation: LearningProfileStoreUpsertResult,
  ) => void | Promise<void>;
}

export interface ChatLearningCoordinatorOptions {
  readonly runtime?: Partial<ChatRuntimeConfig>;
  readonly ports?: Pick<
    ChatEnginePorts,
    'clock' | 'logger' | 'persistence' | 'learning'
  >;
  readonly coldStartModel?: ChatColdStartPopulationModelApi;
  readonly profileStore?: LearningProfileStoreApi;
  readonly acceptClientHints?: boolean;
  readonly emitTelemetryRecords?: boolean;
  readonly observers?: ChatLearningCoordinatorObservers;
  readonly maxBufferedTelemetry?: number;
  readonly keepLastDecisionPerUser?: boolean;
  readonly maxTrainingSeedTelemetry?: number;
}

export interface ChatLearningCoordinatorApi {
  readonly runtime: ChatRuntimeConfig;
  readonly coldStartModel: ChatColdStartPopulationModelApi;
  readonly profileStore: LearningProfileStoreApi;
  open(context: ChatLearningCoordinatorOpenContext): {
    readonly ensure: LearningProfileStoreUpsertResult & {
      readonly prior: ChatColdStartPopulationPrior;
      readonly recommendation: ChatColdStartRecommendation;
    };
    readonly decision: ChatLearningDecisionSnapshot;
  };
  applyAcceptedMessage(
    context: ChatLearningCoordinatorAcceptedMessageContext,
  ): {
    readonly mutation: LearningProfileStoreUpsertResult | null;
    readonly decision: ChatLearningDecisionSnapshot | null;
  };
  applyFeatureSnapshot(
    context: ChatLearningCoordinatorFeatureContext,
  ): {
    readonly accepted: boolean;
    readonly mutation: LearningProfileStoreUpsertResult | null;
    readonly decision: ChatLearningDecisionSnapshot | null;
    readonly reason: string;
  };
  applyInferenceSnapshot(
    context: ChatLearningCoordinatorInferenceContext,
  ): {
    readonly accepted: boolean;
    readonly mutation: LearningProfileStoreUpsertResult | null;
    readonly decision: ChatLearningDecisionSnapshot | null;
    readonly reason: string;
  };
  applyChannelSwitch(
    context: ChatLearningCoordinatorChannelSwitchContext,
  ): {
    readonly mutation: LearningProfileStoreUpsertResult | null;
    readonly decision: ChatLearningDecisionSnapshot | null;
  };
  applyRescueOutcome(
    context: ChatLearningCoordinatorRescueContext,
  ): {
    readonly mutation: LearningProfileStoreUpsertResult | null;
    readonly decision: ChatLearningDecisionSnapshot | null;
  };
  attachSalienceAnchor(
    context: ChatLearningCoordinatorSalienceContext,
  ): {
    readonly mutation: LearningProfileStoreUpsertResult | null;
    readonly decision: ChatLearningDecisionSnapshot | null;
  };
  applyNormalizedEvent(
    event: ChatNormalizedEvent,
  ): ChatLearningCoordinatorNormalizedEventResult;
  mergeAuthoritativeProfiles(
    profiles: readonly ChatLearningProfile[],
  ): readonly LearningProfileStoreUpsertResult[];
  createDecisionSnapshot(
    userId: ChatUserId,
    roomId?: ChatRoomId | null,
    reason?: string,
  ): ChatLearningDecisionSnapshot | null;
  getDecisionSnapshot(
    userId: ChatUserId,
  ): ChatLearningDecisionSnapshot | null;
  getSessionState(
    userId: ChatUserId,
  ): ChatLearningCoordinatorSessionState | null;
  listSessionStates(): readonly ChatLearningCoordinatorSessionState[];
  listBufferedTelemetry(): readonly ChatLearningCoordinatorTelemetryRecord[];
  clearBufferedTelemetry(): void;
  createTrainingSeed(
    userId: ChatUserId,
  ): ChatLearningCoordinatorTrainingSeed | null;
  hydrate(
    value: ChatLearningCoordinatorHydrationPayload,
  ): ChatLearningCoordinatorHydrationResult;
  exportDiagnostics(): ChatLearningCoordinatorDiagnostics;
  exportNdjson(): readonly string[];
  importNdjson(lines: readonly string[]): LearningProfileStoreImportResult;
  flush(): Promise<LearningProfileStoreFlushResult>;
  snapshotProfiles(): Readonly<Record<ChatUserId, ChatLearningProfile>>;
}

// ============================================================================
// MARK: Defaults
// ============================================================================

const COORDINATOR_DEFAULTS = Object.freeze({
  maxBufferedTelemetry: 512,
  maxTrainingSeedTelemetry: 64,
  keepLastDecisionPerUser: true,
  emitTelemetryRecords: true,
  cadenceBlendWeights: Object.freeze({
    helper_profile: 0.44,
    helper_coldStart: 0.30,
    helper_frustration: 0.12,
    helper_intimidation: 0.08,
    helper_lowConfidence: 0.06,
    hater_profile: 0.48,
    hater_coldStart: 0.26,
    hater_confidence: 0.08,
    hater_curiosity: 0.08,
    hater_lowChurn: 0.10,
    ambient_profile: 0.40,
    ambient_coldStart: 0.28,
    ambient_attachment: 0.12,
    ambient_curiosity: 0.12,
    ambient_relief: 0.08,
  }),
  tierThresholds: Object.freeze({
    helper: Object.freeze({
      SOFT: 0.18,
      MEDIUM: 0.34,
      HARD: 0.52,
      CRITICAL: 0.72,
    }),
    hater: Object.freeze({
      SOFT: 0.20,
      MEDIUM: 0.38,
      HARD: 0.56,
      PUBLIC: 0.76,
    }),
    ambient: Object.freeze({
      LOW: 0.20,
      MEDIUM: 0.40,
      HIGH: 0.62,
      CINEMATIC: 0.80,
    }),
  }),
});

// ============================================================================
// MARK: Coordinator factory
// ============================================================================

export function createChatLearningCoordinator(
  options: ChatLearningCoordinatorOptions = {},
): ChatLearningCoordinatorApi {
  const runtime = mergeRuntime(options.runtime);
  const ports = options.ports ?? {};
  const coldStartModel =
    options.coldStartModel ??
    createColdStartPopulationModel({
      runtime,
      acceptClientHints:
        typeof options.acceptClientHints === 'boolean'
          ? options.acceptClientHints
          : runtime.learningPolicy.acceptClientHints,
      logger: createPortableLogger(ports),
    });

  const profileStore =
    options.profileStore ??
    createLearningProfileStore({
      runtime,
      ports,
      coldStartModel,
      acceptClientHints:
        typeof options.acceptClientHints === 'boolean'
          ? options.acceptClientHints
          : runtime.learningPolicy.acceptClientHints,
    });

  const observers = options.observers ?? {};
  const emitTelemetryRecords =
    typeof options.emitTelemetryRecords === 'boolean'
      ? options.emitTelemetryRecords
      : COORDINATOR_DEFAULTS.emitTelemetryRecords;
  const maxBufferedTelemetry = Math.max(
    16,
    Math.floor(
      Number(options.maxBufferedTelemetry ?? COORDINATOR_DEFAULTS.maxBufferedTelemetry),
    ),
  );
  const maxTrainingSeedTelemetry = Math.max(
    8,
    Math.floor(
      Number(
        options.maxTrainingSeedTelemetry ??
          COORDINATOR_DEFAULTS.maxTrainingSeedTelemetry,
      ),
    ),
  );
  const keepLastDecisionPerUser =
    typeof options.keepLastDecisionPerUser === 'boolean'
      ? options.keepLastDecisionPerUser
      : COORDINATOR_DEFAULTS.keepLastDecisionPerUser;

  const sessionState = new Map<ChatUserId, MutableSessionState>();
  const decisionCache = new Map<ChatUserId, ChatLearningDecisionSnapshot>();
  const telemetryBuffer: ChatLearningCoordinatorTelemetryRecord[] = [];

  const counters = {
    totalAcceptedMessages: 0,
    totalChannelSwitches: 0,
    totalRescueOutcomes: 0,
    totalFeatureSnapshotsAccepted: 0,
    totalInferenceSnapshotsAccepted: 0,
    totalNormalizedEventsApplied: 0,
    ignoredNormalizedEvents: 0,
    decisionsGenerated: 0,
  };

  emitTelemetry('COORDINATOR_BOOT', {
    at: now(),
    reason: 'coordinator-created',
    payload: Object.freeze({
      runtimeVersion: runtime.version,
      acceptClientHints: runtime.learningPolicy.acceptClientHints,
    }),
  });

  function now(value?: UnixMs | number): UnixMs {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return asUnixMs(Math.max(0, value));
    }
    if (ports.clock) {
      return asUnixMs(Math.max(0, ports.clock.now()));
    }
    return asUnixMs(Date.now());
  }

  function loggerDebug(
    message: string,
    context?: Readonly<Record<string, JsonValue>>,
  ): void {
    ports.logger?.debug?.(message, baseLogContext(context));
  }

  function loggerInfo(
    message: string,
    context?: Readonly<Record<string, JsonValue>>,
  ): void {
    ports.logger?.info?.(message, baseLogContext(context));
  }

  function loggerWarn(
    message: string,
    context?: Readonly<Record<string, JsonValue>>,
  ): void {
    ports.logger?.warn?.(message, baseLogContext(context));
  }

  function baseLogContext(
    extra?: Readonly<Record<string, JsonValue>>,
  ): Readonly<Record<string, JsonValue>> {
    return Object.freeze({
      runtimeVersion: runtime.version,
      coldStartModelVersion: CHAT_COLD_START_POPULATION_MODEL_VERSION,
      ...extra,
    });
  }

  function emitTelemetry(
    kind: ChatLearningCoordinatorTelemetryRecord['kind'],
    input: Omit<ChatLearningCoordinatorTelemetryRecord, 'kind'>,
  ): ChatLearningCoordinatorTelemetryRecord | null {
    if (!emitTelemetryRecords) {
      return null;
    }

    const record = Object.freeze({
      kind,
      at: input.at,
      userId: input.userId ?? null,
      roomId: input.roomId ?? null,
      reason: input.reason,
      payload: input.payload,
    }) satisfies ChatLearningCoordinatorTelemetryRecord;

    telemetryBuffer.push(record);
    while (telemetryBuffer.length > maxBufferedTelemetry) {
      telemetryBuffer.shift();
    }

    if (record.userId) {
      const mutable = getOrCreateSession(record.userId);
      mutable.telemetryCount += 1;
      mutable.lastReason = record.reason ?? mutable.lastReason;
      mutable.activeRoomId = record.roomId ?? mutable.activeRoomId;
      mutable.lastActivityAt = record.at;
    }

    void observers.onTelemetryRecord?.(record);
    return record;
  }

  function getOrCreateSession(userId: ChatUserId): MutableSessionState {
    const existing = sessionState.get(userId);
    if (existing) {
      return existing;
    }
    const created: MutableSessionState = {
      userId,
      activeRoomId: null,
      openedAt: null,
      lastActivityAt: null,
      lastFeatureSnapshotAt: null,
      lastInferenceSnapshotAt: null,
      lastDecisionAt: null,
      lastEventKind: null,
      acceptedMessageCount: 0,
      channelSwitchCount: 0,
      rescueCount: 0,
      normalizedEventCount: 0,
      telemetryCount: 0,
      lastRecommendedVisibleChannel: null,
      lastSalienceAnchorId: null,
      lastReason: null,
    };
    sessionState.set(userId, created);
    return created;
  }

  function freezeSession(
    value: MutableSessionState,
  ): ChatLearningCoordinatorSessionState {
    return Object.freeze({
      userId: value.userId,
      activeRoomId: value.activeRoomId,
      openedAt: value.openedAt,
      lastActivityAt: value.lastActivityAt,
      lastFeatureSnapshotAt: value.lastFeatureSnapshotAt,
      lastInferenceSnapshotAt: value.lastInferenceSnapshotAt,
      lastDecisionAt: value.lastDecisionAt,
      lastEventKind: value.lastEventKind,
      acceptedMessageCount: value.acceptedMessageCount,
      channelSwitchCount: value.channelSwitchCount,
      rescueCount: value.rescueCount,
      normalizedEventCount: value.normalizedEventCount,
      telemetryCount: value.telemetryCount,
      lastRecommendedVisibleChannel: value.lastRecommendedVisibleChannel,
      lastSalienceAnchorId: value.lastSalienceAnchorId,
      lastReason: value.lastReason,
    });
  }

  function mutationMeta(
    context:
      | {
          readonly roomId?: ChatRoomId | null;
          readonly now?: UnixMs | number;
          readonly reason?: string;
        }
      | undefined,
  ): LearningProfileStoreMutationMeta {
    return Object.freeze({
      roomId: context?.roomId ?? null,
      now: Number(now(context?.now)),
      reason: context?.reason,
    });
  }

  function ensureProfile(
    context: ChatLearningCoordinatorOpenContext,
  ): LearningProfileStoreUpsertResult & {
    readonly prior: ChatColdStartPopulationPrior;
    readonly recommendation: ChatColdStartRecommendation;
  } {
    const ensured = profileStore.ensure({
      userId: context.userId,
      roomId: context.roomId ?? null,
      roomKind: context.roomKind,
      stageMood: context.stageMood,
      requestedChannel: context.requestedChannel ?? undefined,
      featureSnapshot: context.featureSnapshot ?? undefined,
      legacyHints: context.legacyHints ?? undefined,
      clientHints:
        runtime.learningPolicy.acceptClientHints
          ? context.clientHints ?? undefined
          : undefined,
      now: Number(now(context.now)),
    } satisfies LearningProfileStoreContext);

    const mutable = getOrCreateSession(context.userId);
    mutable.activeRoomId = context.roomId ?? mutable.activeRoomId;
    mutable.lastActivityAt = now(context.now);
    mutable.lastReason = context.reason ?? mutable.lastReason;

    emitTelemetry('PROFILE_ENSURED', {
      at: now(context.now),
      userId: context.userId,
      roomId: context.roomId ?? null,
      reason: context.reason ?? (ensured.created ? 'cold-start-created' : 'profile-reused'),
      payload: Object.freeze({
        created: ensured.created,
        changed: ensured.changed,
        archetypeId: ensured.prior.archetypeId,
      }),
    });

    return ensured;
  }

  function observeMutation(
    mutation: LearningProfileStoreUpsertResult | null,
  ): LearningProfileStoreUpsertResult | null {
    if (!mutation) {
      return null;
    }
    coldStartModel.observeProfile(mutation.profile);
    void observers.onProfileMutation?.(mutation);
    return mutation;
  }

  function selectColdStartContextFromProfile(
    userId: ChatUserId,
    roomId: ChatRoomId | null,
    profile: ChatLearningProfile,
  ): ChatColdStartPopulationContext {
    const session = sessionState.get(userId);
    return Object.freeze({
      userId,
      roomId,
      now: Number(now()),
      requestedChannel: dominantChannel(profile.channelAffinity),
      existingProfile: profile,
    });
  }

  function createDecisionSnapshot(
    userId: ChatUserId,
    roomId: ChatRoomId | null = null,
    reason = 'decision-snapshot',
  ): ChatLearningDecisionSnapshot | null {
    const profile = profileStore.get(userId);
    if (!profile) {
      return null;
    }

    const coldStartContext = selectColdStartContextFromProfile(userId, roomId, profile);
    const coldStartPrior = coldStartModel.resolvePrior(coldStartContext);
    const coldStartRecommendation = coldStartModel.recommend(coldStartContext);
    const storeRecommendation = profileStore.createRecommendation(userId, roomId);

    if (!storeRecommendation) {
      return null;
    }

    const recommendedVisibleChannel = selectRecommendedVisibleChannel(
      storeRecommendation.recommendedVisibleChannel,
      coldStartRecommendation.recommendedVisibleChannel,
      profile.channelAffinity,
    );

    const helperCadence01 = clamp01(
      Number(storeRecommendation.helperUrgency01) *
        COORDINATOR_DEFAULTS.cadenceBlendWeights.helper_profile +
        Number(coldStartRecommendation.helperCadence01) *
        COORDINATOR_DEFAULTS.cadenceBlendWeights.helper_coldStart +
        Number(profile.affect.frustration01) *
        COORDINATOR_DEFAULTS.cadenceBlendWeights.helper_frustration +
        Number(profile.affect.intimidation01) *
        COORDINATOR_DEFAULTS.cadenceBlendWeights.helper_intimidation +
        (1 - Number(profile.affect.confidence01)) *
          COORDINATOR_DEFAULTS.cadenceBlendWeights.helper_lowConfidence,
    );

    const haterCadence01 = clamp01(
      Number(storeRecommendation.haterEligibility01) *
        COORDINATOR_DEFAULTS.cadenceBlendWeights.hater_profile +
        Number(coldStartRecommendation.haterCadence01) *
        COORDINATOR_DEFAULTS.cadenceBlendWeights.hater_coldStart +
        Number(profile.affect.confidence01) *
        COORDINATOR_DEFAULTS.cadenceBlendWeights.hater_confidence +
        Number(profile.affect.curiosity01) *
        COORDINATOR_DEFAULTS.cadenceBlendWeights.hater_curiosity +
        (1 - Number(profile.churnRisk01)) *
          COORDINATOR_DEFAULTS.cadenceBlendWeights.hater_lowChurn,
    );

    const ambientCadence01 = clamp01(
      Number(storeRecommendation.ambientCadence01) *
        COORDINATOR_DEFAULTS.cadenceBlendWeights.ambient_profile +
        Number(coldStartRecommendation.ambientCadence01) *
        COORDINATOR_DEFAULTS.cadenceBlendWeights.ambient_coldStart +
        Number(profile.affect.attachment01) *
        COORDINATOR_DEFAULTS.cadenceBlendWeights.ambient_attachment +
        Number(profile.affect.curiosity01) *
        COORDINATOR_DEFAULTS.cadenceBlendWeights.ambient_curiosity +
        Number(profile.affect.relief01) *
        COORDINATOR_DEFAULTS.cadenceBlendWeights.ambient_relief,
    );

    const decision = Object.freeze({
      generatedAt: now(),
      userId,
      roomId,
      coldStart: profile.coldStart,
      recommendedVisibleChannel,
      helperCadence01,
      haterCadence01,
      ambientCadence01,
      helperUrgency01: storeRecommendation.helperUrgency01,
      haterEligibility01: storeRecommendation.haterEligibility01,
      churnRisk01: profile.churnRisk01,
      confidence01: profile.affect.confidence01,
      frustration01: profile.affect.frustration01,
      intimidation01: profile.affect.intimidation01,
      attachment01: profile.affect.attachment01,
      curiosity01: profile.affect.curiosity01,
      embarrassment01: profile.affect.embarrassment01,
      relief01: profile.affect.relief01,
      helperUrgencyTier: helperTier(storeRecommendation.helperUrgency01),
      haterAggressionTier: haterTier(storeRecommendation.haterEligibility01),
      ambientTier: ambientTier(ambientCadence01),
      profile,
      storeRecommendation,
      coldStartPrior,
      coldStartRecommendation,
      explanation: [
        `reason=${reason}`,
        `channel=${recommendedVisibleChannel}`,
        `helper=${storeRecommendation.helperUrgency01.toFixed(3)}`,
        `hater=${storeRecommendation.haterEligibility01.toFixed(3)}`,
        `ambient=${ambientCadence01.toFixed(3)}`,
        `archetype=${coldStartPrior.archetypeId}`,
      ].join(' | '),
    }) satisfies ChatLearningDecisionSnapshot;

    const mutable = getOrCreateSession(userId);
    mutable.lastDecisionAt = decision.generatedAt;
    mutable.lastRecommendedVisibleChannel = recommendedVisibleChannel;
    mutable.lastReason = reason;

    counters.decisionsGenerated += 1;

    if (keepLastDecisionPerUser) {
      decisionCache.set(userId, decision);
    }

    emitTelemetry('DECISION_SNAPSHOT_GENERATED', {
      at: decision.generatedAt,
      userId,
      roomId,
      reason,
      payload: Object.freeze({
        recommendedVisibleChannel,
        helperUrgencyTier: decision.helperUrgencyTier,
        haterAggressionTier: decision.haterAggressionTier,
        ambientTier: decision.ambientTier,
      }),
    });

    void observers.onDecisionSnapshot?.(decision);
    return decision;
  }

  function maybeAttachSalienceAnchor(
    context: ChatLearningCoordinatorAcceptedMessageContext,
  ): LearningProfileStoreUpsertResult | null {
    if (!context.salienceAnchorId || !context.salienceAnchorId.trim()) {
      return null;
    }
    const anchorMutation = observeMutation(
      profileStore.attachSalienceAnchor(
        context.userId,
        context.salienceAnchorId,
        mutationMeta(context),
      ),
    );
    if (anchorMutation) {
      const mutable = getOrCreateSession(context.userId);
      mutable.lastSalienceAnchorId = context.salienceAnchorId;
      emitTelemetry('SALIENCE_ANCHOR_ATTACHED', {
        at: now(context.now),
        userId: context.userId,
        roomId: context.roomId ?? null,
        reason: context.reason ?? 'accepted-message-anchor',
        payload: Object.freeze({ anchorId: context.salienceAnchorId }),
      });
    }
    return anchorMutation;
  }

  function open(context: ChatLearningCoordinatorOpenContext): {
    readonly ensure: LearningProfileStoreUpsertResult & {
      readonly prior: ChatColdStartPopulationPrior;
      readonly recommendation: ChatColdStartRecommendation;
    };
    readonly decision: ChatLearningDecisionSnapshot;
  } {
    const ensured = ensureProfile(context);
    const mutable = getOrCreateSession(context.userId);
    const openedAt = now(context.now);
    mutable.activeRoomId = context.roomId ?? mutable.activeRoomId;
    mutable.openedAt = mutable.openedAt ?? openedAt;
    mutable.lastActivityAt = openedAt;
    mutable.lastEventKind = 'CHAT_OPENED';
    mutable.lastReason = context.reason ?? 'chat-opened';

    emitTelemetry('CHAT_OPENED', {
      at: openedAt,
      userId: context.userId,
      roomId: context.roomId ?? null,
      reason: context.reason ?? 'chat-opened',
      payload: Object.freeze({
        coldStart: ensured.profile.coldStart,
        archetypeId: ensured.prior.archetypeId,
      }),
    });

    const decision =
      createDecisionSnapshot(
        context.userId,
        context.roomId ?? null,
        context.reason ?? 'chat-opened',
      ) ??
      fail('ChatLearningCoordinator.open expected decision snapshot.');

    return Object.freeze({
      ensure: ensured,
      decision,
    });
  }

  function applyAcceptedMessage(
    context: ChatLearningCoordinatorAcceptedMessageContext,
  ): {
    readonly mutation: LearningProfileStoreUpsertResult | null;
    readonly decision: ChatLearningDecisionSnapshot | null;
  } {
    ensureProfile({
      userId: context.userId,
      roomId: context.roomId ?? null,
      requestedChannel: context.channelId,
      now: context.now,
      reason: context.reason ?? 'accepted-message-ensure',
    });

    const mutation = observeMutation(
      profileStore.applyAcceptedMessage(
        context.userId,
        {
          text: context.text,
          channelId: context.channelId,
          helperInvolved: context.helperInvolved,
          haterInvolved: context.haterInvolved,
          messageLength: context.messageLength,
        },
        mutationMeta(context),
      ),
    );

    maybeAttachSalienceAnchor(context);

    if (mutation) {
      const mutable = getOrCreateSession(context.userId);
      mutable.activeRoomId = context.roomId ?? mutable.activeRoomId;
      mutable.lastActivityAt = now(context.now);
      mutable.lastEventKind = 'PLAYER_MESSAGE_ACCEPTED';
      mutable.acceptedMessageCount += 1;
      mutable.lastReason = context.reason ?? 'accepted-message';
      counters.totalAcceptedMessages += 1;

      emitTelemetry('PROFILE_MUTATED', {
        at: now(context.now),
        userId: context.userId,
        roomId: context.roomId ?? null,
        reason: context.reason ?? 'accepted-message',
        payload: Object.freeze({
          mutation: 'accepted-message',
          channelId: context.channelId,
          helperInvolved: Boolean(context.helperInvolved),
          haterInvolved: Boolean(context.haterInvolved),
        }),
      });
    }

    return Object.freeze({
      mutation,
      decision: createDecisionSnapshot(
        context.userId,
        context.roomId ?? null,
        context.reason ?? 'accepted-message',
      ),
    });
  }

  function applyFeatureSnapshot(
    context: ChatLearningCoordinatorFeatureContext,
  ): {
    readonly accepted: boolean;
    readonly mutation: LearningProfileStoreUpsertResult | null;
    readonly decision: ChatLearningDecisionSnapshot | null;
    readonly reason: string;
  } {
    if (!context.snapshot || typeof context.snapshot !== 'object') {
      emitTelemetry('FEATURE_SNAPSHOT_REJECTED', {
        at: now(context.now),
        userId: context.userId,
        roomId: context.roomId ?? null,
        reason: 'invalid-snapshot',
      });
      return Object.freeze({
        accepted: false,
        mutation: null,
        decision: null,
        reason: 'invalid-snapshot',
      });
    }

    ensureProfile({
      userId: context.userId,
      roomId: context.roomId ?? null,
      featureSnapshot: context.snapshot,
      now: context.now,
      reason: context.reason ?? 'feature-snapshot-ensure',
    });

    const mutation = observeMutation(
      profileStore.applyFeatureSnapshot(
        context.userId,
        context.snapshot,
        mutationMeta(context),
      ),
    );

    const accepted = Boolean(mutation);
    const reason = accepted ? 'feature-snapshot-accepted' : 'feature-snapshot-noop';

    if (accepted) {
      counters.totalFeatureSnapshotsAccepted += 1;
      const mutable = getOrCreateSession(context.userId);
      mutable.activeRoomId = context.roomId ?? mutable.activeRoomId;
      mutable.lastFeatureSnapshotAt = now(context.now);
      mutable.lastActivityAt = now(context.now);
      mutable.lastEventKind = 'FEATURE_SNAPSHOT';
      mutable.lastReason = context.reason ?? reason;
      emitTelemetry('FEATURE_SNAPSHOT_ACCEPTED', {
        at: now(context.now),
        userId: context.userId,
        roomId: context.roomId ?? null,
        reason,
      });
    } else {
      emitTelemetry('FEATURE_SNAPSHOT_REJECTED', {
        at: now(context.now),
        userId: context.userId,
        roomId: context.roomId ?? null,
        reason,
      });
    }

    return Object.freeze({
      accepted,
      mutation,
      decision: accepted
        ? createDecisionSnapshot(
            context.userId,
            context.roomId ?? null,
            context.reason ?? reason,
          )
        : null,
      reason,
    });
  }

  function applyInferenceSnapshot(
    context: ChatLearningCoordinatorInferenceContext,
  ): {
    readonly accepted: boolean;
    readonly mutation: LearningProfileStoreUpsertResult | null;
    readonly decision: ChatLearningDecisionSnapshot | null;
    readonly reason: string;
  } {
    const userId = extractInferenceUserId(context.snapshot);
    if (!userId) {
      emitTelemetry('INFERENCE_SNAPSHOT_REJECTED', {
        at: now(context.now),
        roomId: context.roomId ?? null,
        reason: 'missing-user-id',
      });
      return Object.freeze({
        accepted: false,
        mutation: null,
        decision: null,
        reason: 'missing-user-id',
      });
    }

    if (!runtime.learningPolicy.acceptClientHints) {
      emitTelemetry('INFERENCE_SNAPSHOT_REJECTED', {
        at: now(context.now),
        userId,
        roomId: context.roomId ?? null,
        reason: 'runtime-policy-blocked',
      });
      return Object.freeze({
        accepted: false,
        mutation: null,
        decision: null,
        reason: 'runtime-policy-blocked',
      });
    }

    ensureProfile({
      userId,
      roomId: context.roomId ?? null,
      now: context.now,
      reason: context.reason ?? 'inference-snapshot-ensure',
    });

    const mutation = observeMutation(
      profileStore.applyInferenceSnapshot(
        context.snapshot,
        mutationMeta({
          roomId: context.roomId,
          now: context.now,
          reason: context.reason ?? 'inference-snapshot',
        }),
      ),
    );

    const accepted = Boolean(mutation);
    const reason = accepted ? 'inference-snapshot-accepted' : 'inference-snapshot-noop';

    if (accepted) {
      counters.totalInferenceSnapshotsAccepted += 1;
      const mutable = getOrCreateSession(userId);
      mutable.activeRoomId = context.roomId ?? mutable.activeRoomId;
      mutable.lastInferenceSnapshotAt = now(context.now);
      mutable.lastActivityAt = now(context.now);
      mutable.lastEventKind = 'INFERENCE_SNAPSHOT';
      mutable.lastReason = context.reason ?? reason;
      emitTelemetry('INFERENCE_SNAPSHOT_ACCEPTED', {
        at: now(context.now),
        userId,
        roomId: context.roomId ?? null,
        reason,
      });
    } else {
      emitTelemetry('INFERENCE_SNAPSHOT_REJECTED', {
        at: now(context.now),
        userId,
        roomId: context.roomId ?? null,
        reason,
      });
    }

    return Object.freeze({
      accepted,
      mutation,
      decision: accepted
        ? createDecisionSnapshot(
            userId,
            context.roomId ?? null,
            context.reason ?? reason,
          )
        : null,
      reason,
    });
  }

  function applyChannelSwitch(
    context: ChatLearningCoordinatorChannelSwitchContext,
  ): {
    readonly mutation: LearningProfileStoreUpsertResult | null;
    readonly decision: ChatLearningDecisionSnapshot | null;
  } {
    ensureProfile({
      userId: context.userId,
      roomId: context.roomId ?? null,
      requestedChannel: context.channelId,
      now: context.now,
      reason: context.reason ?? 'channel-switch-ensure',
    });

    const mutation = observeMutation(
      profileStore.applyChannelSwitch(
        context.userId,
        context.channelId,
        mutationMeta(context),
      ),
    );

    if (mutation) {
      counters.totalChannelSwitches += 1;
      const mutable = getOrCreateSession(context.userId);
      mutable.activeRoomId = context.roomId ?? mutable.activeRoomId;
      mutable.lastActivityAt = now(context.now);
      mutable.lastEventKind = 'CHANNEL_SWITCH';
      mutable.channelSwitchCount += 1;
      mutable.lastReason = context.reason ?? 'channel-switch';
      emitTelemetry('CHANNEL_SWITCH_APPLIED', {
        at: now(context.now),
        userId: context.userId,
        roomId: context.roomId ?? null,
        reason: context.reason ?? 'channel-switch',
        payload: Object.freeze({ channelId: context.channelId }),
      });
    }

    return Object.freeze({
      mutation,
      decision: createDecisionSnapshot(
        context.userId,
        context.roomId ?? null,
        context.reason ?? 'channel-switch',
      ),
    });
  }

  function applyRescueOutcome(
    context: ChatLearningCoordinatorRescueContext,
  ): {
    readonly mutation: LearningProfileStoreUpsertResult | null;
    readonly decision: ChatLearningDecisionSnapshot | null;
  } {
    ensureProfile({
      userId: context.userId,
      roomId: context.roomId ?? null,
      now: context.now,
      reason: context.reason ?? 'rescue-outcome-ensure',
    });

    const mutation = observeMutation(
      profileStore.applyRescueOutcome(
        context.userId,
        {
          accepted: context.accepted,
          urgency: context.urgency,
        },
        mutationMeta(context),
      ),
    );

    if (mutation) {
      counters.totalRescueOutcomes += 1;
      const mutable = getOrCreateSession(context.userId);
      mutable.activeRoomId = context.roomId ?? mutable.activeRoomId;
      mutable.lastActivityAt = now(context.now);
      mutable.lastEventKind = 'RESCUE_OUTCOME';
      mutable.rescueCount += 1;
      mutable.lastReason = context.reason ?? 'rescue-outcome';
      emitTelemetry('RESCUE_OUTCOME_APPLIED', {
        at: now(context.now),
        userId: context.userId,
        roomId: context.roomId ?? null,
        reason: context.reason ?? 'rescue-outcome',
        payload: Object.freeze({
          accepted: context.accepted,
          urgency: context.urgency,
        }),
      });
    }

    return Object.freeze({
      mutation,
      decision: createDecisionSnapshot(
        context.userId,
        context.roomId ?? null,
        context.reason ?? 'rescue-outcome',
      ),
    });
  }

  function attachSalienceAnchor(
    context: ChatLearningCoordinatorSalienceContext,
  ): {
    readonly mutation: LearningProfileStoreUpsertResult | null;
    readonly decision: ChatLearningDecisionSnapshot | null;
  } {
    ensureProfile({
      userId: context.userId,
      roomId: context.roomId ?? null,
      now: context.now,
      reason: context.reason ?? 'salience-anchor-ensure',
    });

    const mutation = observeMutation(
      profileStore.attachSalienceAnchor(
        context.userId,
        context.anchorId as ChatLearningProfile['salienceAnchorIds'][number],
        mutationMeta(context),
      ),
    );

    if (mutation) {
      const mutable = getOrCreateSession(context.userId);
      mutable.activeRoomId = context.roomId ?? mutable.activeRoomId;
      mutable.lastActivityAt = now(context.now);
      mutable.lastEventKind = 'SALIENCE_ANCHOR';
      mutable.lastSalienceAnchorId = context.anchorId;
      mutable.lastReason = context.reason ?? 'salience-anchor';
      emitTelemetry('SALIENCE_ANCHOR_ATTACHED', {
        at: now(context.now),
        userId: context.userId,
        roomId: context.roomId ?? null,
        reason: context.reason ?? 'salience-anchor',
        payload: Object.freeze({ anchorId: context.anchorId }),
      });
    }

    return Object.freeze({
      mutation,
      decision: createDecisionSnapshot(
        context.userId,
        context.roomId ?? null,
        context.reason ?? 'salience-anchor',
      ),
    });
  }

  function applyNormalizedEvent(
    event: ChatNormalizedEvent,
  ): ChatLearningCoordinatorNormalizedEventResult {
    const eventUserId = event.userId ?? null;
    const eventRoomId = event.roomId ?? null;
    const eventAt = now(Number(event.emittedAt));

    if (eventUserId) {
      ensureProfile({
        userId: eventUserId,
        roomId: eventRoomId,
        now: eventAt,
        reason: `normalized-event:${event.kind}`,
      });
    }

    const mutation = observeMutation(profileStore.applyNormalizedEvent(event));
    const applied = Boolean(mutation);
    const reason = applied
      ? `normalized-event-applied:${event.kind}`
      : `normalized-event-ignored:${event.kind}`;

    if (eventUserId) {
      const mutable = getOrCreateSession(eventUserId);
      mutable.activeRoomId = eventRoomId ?? mutable.activeRoomId;
      mutable.lastActivityAt = eventAt;
      mutable.lastEventKind = event.kind;
      mutable.lastReason = reason;
      mutable.normalizedEventCount += 1;
    }

    if (applied) {
      counters.totalNormalizedEventsApplied += 1;
      emitTelemetry('NORMALIZED_EVENT_APPLIED', {
        at: eventAt,
        userId: eventUserId,
        roomId: eventRoomId,
        reason,
        payload: normalizedEventSummary(event),
      });
    } else {
      counters.ignoredNormalizedEvents += 1;
      emitTelemetry('NORMALIZED_EVENT_IGNORED', {
        at: eventAt,
        userId: eventUserId,
        roomId: eventRoomId,
        reason,
        payload: normalizedEventSummary(event),
      });
    }

    const decision = eventUserId
      ? createDecisionSnapshot(eventUserId, eventRoomId, reason)
      : null;

    return Object.freeze({
      applied,
      event,
      mutation,
      decision,
      reason,
    });
  }

  function mergeAuthoritativeProfiles(
    profiles: readonly ChatLearningProfile[],
  ): readonly LearningProfileStoreUpsertResult[] {
    const results = profileStore.mergeAuthoritativeProfiles(profiles);

    for (const result of results) {
      coldStartModel.observeProfile(result.profile);
      const mutable = getOrCreateSession(result.profile.userId);
      mutable.lastActivityAt = now();
      mutable.lastEventKind = 'AUTHORITATIVE_PROFILE_MERGE';
      mutable.lastReason = 'authoritative-profile-merge';
    }

    emitTelemetry('AUTHORITATIVE_PROFILES_MERGED', {
      at: now(),
      reason: 'authoritative-profile-merge',
      payload: Object.freeze({ total: results.length }),
    });

    return Object.freeze(results.slice());
  }

  function getDecisionSnapshot(userId: ChatUserId): ChatLearningDecisionSnapshot | null {
    return decisionCache.get(userId) ?? null;
  }

  function getSessionState(userId: ChatUserId): ChatLearningCoordinatorSessionState | null {
    const value = sessionState.get(userId);
    return value ? freezeSession(value) : null;
  }

  function listSessionStates(): readonly ChatLearningCoordinatorSessionState[] {
    return Object.freeze(
      Array.from(sessionState.values(), freezeSession).sort((left, right) =>
        String(left.userId).localeCompare(String(right.userId)),
      ),
    );
  }

  function listBufferedTelemetry(): readonly ChatLearningCoordinatorTelemetryRecord[] {
    return Object.freeze(telemetryBuffer.slice());
  }

  function clearBufferedTelemetry(): void {
    telemetryBuffer.length = 0;
  }

  function createTrainingSeed(
    userId: ChatUserId,
  ): ChatLearningCoordinatorTrainingSeed | null {
    const profile = profileStore.get(userId);
    const session = sessionState.get(userId) ?? null;
    const decision = getDecisionSnapshot(userId);
    if (!profile && !session && !decision) {
      return null;
    }

    const roomId = session?.activeRoomId ?? null;
    const telemetry = telemetryBuffer
      .filter((record) => record.userId === userId)
      .slice(-maxTrainingSeedTelemetry);

    return Object.freeze({
      userId,
      exportedAt: now(),
      roomId,
      decision,
      profile,
      session: session ? freezeSession(session) : null,
      telemetry: Object.freeze(telemetry),
    });
  }

  function hydrate(
    value: ChatLearningCoordinatorHydrationPayload,
  ): ChatLearningCoordinatorHydrationResult {
    const profileHydration = profileStore.hydrate(value.profiles ?? null);

    const hydratedUsers: ChatUserId[] = [];
    const rejectedSessionRecords: Array<{
      readonly raw: JsonValue;
      readonly reason: string;
    }> = [];

    for (const profile of profileHydration.hydratedProfiles) {
      hydratedUsers.push(profile.userId);
      const mutable = getOrCreateSession(profile.userId);
      mutable.lastActivityAt = profile.updatedAt;
      mutable.lastEventKind = 'HYDRATED_PROFILE';
      mutable.lastReason = 'hydrate-profile';
      coldStartModel.observeProfile(profile);
    }

    const rawSessions = Array.isArray(value.sessionState)
      ? value.sessionState
      : [];
    for (const raw of rawSessions) {
      const normalized = parseSessionStateRecord(raw as JsonValue);
      if (!normalized.ok) {
        rejectedSessionRecords.push(
          Object.freeze({ raw: raw as JsonValue, reason: normalized.reason }),
        );
        continue;
      }
      sessionState.set(normalized.value.userId, normalized.value);
    }

    let telemetryAccepted = 0;
    let telemetryRejected = 0;
    const rawTelemetry = Array.isArray(value.bufferedTelemetry)
      ? value.bufferedTelemetry
      : [];
    for (const raw of rawTelemetry) {
      const normalized = parseTelemetryRecord(raw as JsonValue);
      if (!normalized.ok) {
        telemetryRejected += 1;
        continue;
      }
      telemetryBuffer.push(normalized.value);
      telemetryAccepted += 1;
    }
    while (telemetryBuffer.length > maxBufferedTelemetry) {
      telemetryBuffer.shift();
    }

    emitTelemetry('PROFILE_HYDRATED', {
      at: now(),
      reason: 'hydrate',
      payload: Object.freeze({
        hydratedProfiles: profileHydration.hydratedProfiles.length,
        rejectedProfiles: profileHydration.rejected.length,
        telemetryAccepted,
        telemetryRejected,
      }),
    });

    return Object.freeze({
      profiles: profileHydration,
      hydratedUsers: Object.freeze(hydratedUsers),
      rejectedSessionRecords: Object.freeze(rejectedSessionRecords),
      telemetryAccepted,
      telemetryRejected,
    });
  }

  function exportDiagnostics(): ChatLearningCoordinatorDiagnostics {
    const diagnostics = Object.freeze({
      runtimeVersion: runtime.version,
      totalTrackedUsers: sessionState.size,
      bufferedTelemetryRecords: telemetryBuffer.length,
      totalAcceptedMessages: counters.totalAcceptedMessages,
      totalChannelSwitches: counters.totalChannelSwitches,
      totalRescueOutcomes: counters.totalRescueOutcomes,
      totalFeatureSnapshotsAccepted: counters.totalFeatureSnapshotsAccepted,
      totalInferenceSnapshotsAccepted: counters.totalInferenceSnapshotsAccepted,
      totalNormalizedEventsApplied: counters.totalNormalizedEventsApplied,
      ignoredNormalizedEvents: counters.ignoredNormalizedEvents,
      decisionsGenerated: counters.decisionsGenerated,
      coldStartModelVersion: CHAT_COLD_START_POPULATION_MODEL_VERSION,
    }) satisfies ChatLearningCoordinatorDiagnostics;

    emitTelemetry('DIAGNOSTIC_EXPORT_CREATED', {
      at: now(),
      reason: 'diagnostics-export',
      payload: Object.freeze({
        totalTrackedUsers: diagnostics.totalTrackedUsers,
        decisionsGenerated: diagnostics.decisionsGenerated,
      }),
    });

    return diagnostics;
  }

  function exportNdjson(): readonly string[] {
    const lines: string[] = [];
    for (const line of profileStore.exportNdjson()) {
      lines.push(line);
    }

    for (const value of sessionState.values()) {
      lines.push(
        JSON.stringify({
          type: 'CHAT_LEARNING_COORDINATOR_SESSION',
          payload: freezeSession(value),
        }),
      );
    }

    for (const record of telemetryBuffer) {
      lines.push(
        JSON.stringify({
          type: 'CHAT_LEARNING_COORDINATOR_TELEMETRY',
          payload: record,
        }),
      );
    }

    return Object.freeze(lines);
  }

  function importNdjson(lines: readonly string[]): LearningProfileStoreImportResult {
    const profileLines: string[] = [];
    const acceptedSessionRecords: MutableSessionState[] = [];
    const acceptedTelemetryRecords: ChatLearningCoordinatorTelemetryRecord[] = [];

    for (const rawLine of lines) {
      const trimmed = String(rawLine ?? '').trim();
      if (!trimmed) {
        continue;
      }
      const parsed = safeJsonParse(trimmed);
      if (!parsed.ok || !parsed.value || typeof parsed.value !== 'object') {
        profileLines.push(trimmed);
        continue;
      }
      const type = String((parsed.value as { type?: unknown }).type ?? '');
      if (type === 'CHAT_LEARNING_COORDINATOR_SESSION') {
        const normalized = parseSessionStateRecord(
          ((parsed.value as { payload?: unknown }).payload ?? null) as JsonValue,
        );
        if (normalized.ok) {
          acceptedSessionRecords.push(normalized.value);
        }
        continue;
      }
      if (type === 'CHAT_LEARNING_COORDINATOR_TELEMETRY') {
        const normalized = parseTelemetryRecord(
          ((parsed.value as { payload?: unknown }).payload ?? null) as JsonValue,
        );
        if (normalized.ok) {
          acceptedTelemetryRecords.push(normalized.value);
        }
        continue;
      }
      profileLines.push(trimmed);
    }

    const profileImport = profileStore.importNdjson(profileLines);
    for (const profile of profileImport.imported) {
      coldStartModel.observeProfile(profile);
    }

    for (const state of acceptedSessionRecords) {
      sessionState.set(state.userId, state);
    }

    telemetryBuffer.push(...acceptedTelemetryRecords);
    while (telemetryBuffer.length > maxBufferedTelemetry) {
      telemetryBuffer.shift();
    }

    emitTelemetry('PROFILE_IMPORTED', {
      at: now(),
      reason: 'import-ndjson',
      payload: Object.freeze({
        importedProfiles: profileImport.imported.length,
        acceptedSessions: acceptedSessionRecords.length,
        acceptedTelemetry: acceptedTelemetryRecords.length,
      }),
    });

    return profileImport;
  }

  async function flush(): Promise<LearningProfileStoreFlushResult> {
    const result = await profileStore.flush();
    emitTelemetry('PROFILE_FLUSHED', {
      at: now(),
      reason: 'flush',
      payload: Object.freeze({
        flushedProfiles: result.flushedProfiles.length,
        persisted: result.persisted,
      }),
    });
    return result;
  }

  function snapshotProfiles(): Readonly<Record<ChatUserId, ChatLearningProfile>> {
    return profileStore.snapshot();
  }

  return Object.freeze({
    runtime,
    coldStartModel,
    profileStore,
    open,
    applyAcceptedMessage,
    applyFeatureSnapshot,
    applyInferenceSnapshot,
    applyChannelSwitch,
    applyRescueOutcome,
    attachSalienceAnchor,
    applyNormalizedEvent,
    mergeAuthoritativeProfiles,
    createDecisionSnapshot,
    getDecisionSnapshot,
    getSessionState,
    listSessionStates,
    listBufferedTelemetry,
    clearBufferedTelemetry,
    createTrainingSeed,
    hydrate,
    exportDiagnostics,
    exportNdjson,
    importNdjson,
    flush,
    snapshotProfiles,
  }) satisfies ChatLearningCoordinatorApi;
}

// ============================================================================
// MARK: Internal mutable session state
// ============================================================================

interface MutableSessionState {
  userId: ChatUserId;
  activeRoomId: ChatRoomId | null;
  openedAt: UnixMs | null;
  lastActivityAt: UnixMs | null;
  lastFeatureSnapshotAt: UnixMs | null;
  lastInferenceSnapshotAt: UnixMs | null;
  lastDecisionAt: UnixMs | null;
  lastEventKind: string | null;
  acceptedMessageCount: number;
  channelSwitchCount: number;
  rescueCount: number;
  normalizedEventCount: number;
  telemetryCount: number;
  lastRecommendedVisibleChannel: ChatVisibleChannel | null;
  lastSalienceAnchorId: string | null;
  lastReason: string | null;
}

// ============================================================================
// MARK: Runtime / logger helpers
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
      debug(message: string, context?: Readonly<Record<string, JsonValue>>): void;
      info(message: string, context?: Readonly<Record<string, JsonValue>>): void;
      warn(message: string, context?: Readonly<Record<string, JsonValue>>): void;
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
// MARK: Recommendation helpers
// ============================================================================

function dominantChannel(
  affinity: Readonly<Record<ChatVisibleChannel, Score01>>,
): ChatVisibleChannel {
  const ordered = [
    ['GLOBAL', Number(affinity.GLOBAL)],
    ['SYNDICATE', Number(affinity.SYNDICATE)],
    ['DEAL_ROOM', Number(affinity.DEAL_ROOM)],
    ['LOBBY', Number(affinity.LOBBY)],
  ] as const;
  ordered.sort((left, right) => right[1] - left[1]);
  return ordered[0]?.[0] ?? 'GLOBAL';
}

function selectRecommendedVisibleChannel(
  storeChannel: ChatVisibleChannel,
  coldStartChannel: ChatVisibleChannel,
  affinity: Readonly<Record<ChatVisibleChannel, Score01>>,
): ChatVisibleChannel {
  const scores: Record<ChatVisibleChannel, number> = {
    GLOBAL: Number(affinity.GLOBAL),
    SYNDICATE: Number(affinity.SYNDICATE),
    DEAL_ROOM: Number(affinity.DEAL_ROOM),
    LOBBY: Number(affinity.LOBBY),
  };
  scores[storeChannel] += 0.16;
  scores[coldStartChannel] += 0.12;

  let best: ChatVisibleChannel = 'GLOBAL';
  let bestScore = -1;
  for (const channel of visibleChannels()) {
    const score = scores[channel];
    if (score > bestScore) {
      best = channel;
      bestScore = score;
    }
  }
  return best;
}

function visibleChannels(): readonly ChatVisibleChannel[] {
  return ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY'] as const;
}

function helperTier(
  value: Score01,
): ChatLearningDecisionSnapshot['helperUrgencyTier'] {
  const numeric = Number(value);
  if (numeric >= COORDINATOR_DEFAULTS.tierThresholds.helper.CRITICAL) {
    return 'CRITICAL';
  }
  if (numeric >= COORDINATOR_DEFAULTS.tierThresholds.helper.HARD) {
    return 'HARD';
  }
  if (numeric >= COORDINATOR_DEFAULTS.tierThresholds.helper.MEDIUM) {
    return 'MEDIUM';
  }
  if (numeric >= COORDINATOR_DEFAULTS.tierThresholds.helper.SOFT) {
    return 'SOFT';
  }
  return 'NONE';
}

function haterTier(
  value: Score01,
): ChatLearningDecisionSnapshot['haterAggressionTier'] {
  const numeric = Number(value);
  if (numeric >= COORDINATOR_DEFAULTS.tierThresholds.hater.PUBLIC) {
    return 'PUBLIC';
  }
  if (numeric >= COORDINATOR_DEFAULTS.tierThresholds.hater.HARD) {
    return 'HARD';
  }
  if (numeric >= COORDINATOR_DEFAULTS.tierThresholds.hater.MEDIUM) {
    return 'MEDIUM';
  }
  if (numeric >= COORDINATOR_DEFAULTS.tierThresholds.hater.SOFT) {
    return 'SOFT';
  }
  return 'NONE';
}

function ambientTier(
  value: Score01,
): ChatLearningDecisionSnapshot['ambientTier'] {
  const numeric = Number(value);
  if (numeric >= COORDINATOR_DEFAULTS.tierThresholds.ambient.CINEMATIC) {
    return 'CINEMATIC';
  }
  if (numeric >= COORDINATOR_DEFAULTS.tierThresholds.ambient.HIGH) {
    return 'HIGH';
  }
  if (numeric >= COORDINATOR_DEFAULTS.tierThresholds.ambient.MEDIUM) {
    return 'MEDIUM';
  }
  if (numeric >= COORDINATOR_DEFAULTS.tierThresholds.ambient.LOW) {
    return 'LOW';
  }
  return 'QUIET';
}

// ============================================================================
// MARK: Parsing / diagnostics helpers
// ============================================================================

function extractInferenceUserId(
  snapshot: ChatInferenceSnapshot,
): ChatUserId | null {
  const candidate = (snapshot as { userId?: unknown }).userId;
  if (typeof candidate !== 'string' || !candidate.trim()) {
    return null;
  }
  return candidate as ChatUserId;
}

function normalizedEventSummary(
  event: ChatNormalizedEvent,
): Readonly<Record<string, JsonValue>> {
  return Object.freeze({
    kind: String(event.kind),
    roomId: event.roomId ?? null,
    hasUserId: Boolean(event.userId),
    hasPayload: Boolean(event.payload && typeof event.payload === 'object'),
  });
}

function parseSessionStateRecord(
  raw: JsonValue,
):
  | { readonly ok: true; readonly value: MutableSessionState }
  | { readonly ok: false; readonly reason: string } {
  if (!raw || typeof raw !== 'object') {
    return Object.freeze({ ok: false, reason: 'session-record-not-object' });
  }
  const source = raw as Record<string, unknown>;
  if (typeof source.userId !== 'string' || !source.userId.trim()) {
    return Object.freeze({ ok: false, reason: 'session-record-missing-userId' });
  }
  return Object.freeze({
    ok: true,
    value: {
      userId: source.userId as ChatUserId,
      activeRoomId:
        typeof source.activeRoomId === 'string'
          ? (source.activeRoomId as ChatRoomId)
          : null,
      openedAt: parseUnixMsOrNull(source.openedAt),
      lastActivityAt: parseUnixMsOrNull(source.lastActivityAt),
      lastFeatureSnapshotAt: parseUnixMsOrNull(source.lastFeatureSnapshotAt),
      lastInferenceSnapshotAt: parseUnixMsOrNull(source.lastInferenceSnapshotAt),
      lastDecisionAt: parseUnixMsOrNull(source.lastDecisionAt),
      lastEventKind:
        typeof source.lastEventKind === 'string' ? source.lastEventKind : null,
      acceptedMessageCount: nonNegativeInt(source.acceptedMessageCount),
      channelSwitchCount: nonNegativeInt(source.channelSwitchCount),
      rescueCount: nonNegativeInt(source.rescueCount),
      normalizedEventCount: nonNegativeInt(source.normalizedEventCount),
      telemetryCount: nonNegativeInt(source.telemetryCount),
      lastRecommendedVisibleChannel: isVisibleChannel(source.lastRecommendedVisibleChannel)
        ? source.lastRecommendedVisibleChannel
        : null,
      lastSalienceAnchorId:
        typeof source.lastSalienceAnchorId === 'string'
          ? source.lastSalienceAnchorId
          : null,
      lastReason: typeof source.lastReason === 'string' ? source.lastReason : null,
    },
  });
}

function parseTelemetryRecord(
  raw: JsonValue,
):
  | { readonly ok: true; readonly value: ChatLearningCoordinatorTelemetryRecord }
  | { readonly ok: false; readonly reason: string } {
  if (!raw || typeof raw !== 'object') {
    return Object.freeze({ ok: false, reason: 'telemetry-record-not-object' });
  }
  const source = raw as Record<string, unknown>;
  if (typeof source.kind !== 'string' || !source.kind.trim()) {
    return Object.freeze({ ok: false, reason: 'telemetry-record-missing-kind' });
  }
  const kind = source.kind as ChatLearningCoordinatorTelemetryRecord['kind'];
  const value = Object.freeze({
    kind,
    at: asUnixMs(Math.max(0, Number(source.at ?? Date.now()))),
    userId:
      typeof source.userId === 'string' ? (source.userId as ChatUserId) : null,
    roomId:
      typeof source.roomId === 'string' ? (source.roomId as ChatRoomId) : null,
    reason: typeof source.reason === 'string' ? source.reason : undefined,
    payload:
      source.payload && typeof source.payload === 'object'
        ? (source.payload as Readonly<Record<string, JsonValue>>)
        : undefined,
  }) satisfies ChatLearningCoordinatorTelemetryRecord;
  return Object.freeze({ ok: true, value });
}

function parseUnixMsOrNull(value: unknown): UnixMs | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return asUnixMs(Math.max(0, value));
}

function nonNegativeInt(value: unknown): number {
  return Math.max(0, Math.floor(Number(value ?? 0)));
}

function isVisibleChannel(value: unknown): value is ChatVisibleChannel {
  return (
    value === 'GLOBAL' ||
    value === 'SYNDICATE' ||
    value === 'DEAL_ROOM' ||
    value === 'LOBBY'
  );
}

function safeJsonParse(
  value: string,
): { readonly ok: true; readonly value: unknown } | { readonly ok: false } {
  try {
    return Object.freeze({ ok: true, value: JSON.parse(value) });
  } catch {
    return Object.freeze({ ok: false });
  }
}

function fail(message: string): never {
  throw new Error(message);
}

