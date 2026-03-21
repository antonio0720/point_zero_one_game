/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT LEARNING PROFILE STORE
 * FILE: backend/src/game/engine/chat/intelligence/LearningProfileStore.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Durable backend truth store for chat learning profiles.
 *
 * This file is not a passive map wrapper.
 * It is the backend learning memory authority for:
 *
 * - cold-start profile creation,
 * - profile hydration and normalization,
 * - authoritative local cache + dirty tracking,
 * - profile mutation from accepted events and snapshots,
 * - affect blending over time,
 * - channel affinity drift,
 * - helper/hater/negotiation/churn adjustments,
 * - salience anchor attachment,
 * - persistence batching,
 * - NDJSON import/export,
 * - reconciliation with server-authoritative state.
 *
 * Why the backend needs its own store
 * -----------------------------------
 * The frontend donor lane already proved that second-one learning changes chat
 * quality immediately. But localStorage or a UI-side mirror cannot own durable
 * truth. The backend store has to remember:
 *
 * 1. what first-contact prior was assigned,
 * 2. how the player reacted to helpers, haters, and channel pressure,
 * 3. what salience anchors matter across rooms and runs,
 * 4. what risk posture is currently active,
 * 5. what should be persisted, replay-correlated, and eventually trained on.
 *
 * Design doctrine
 * ---------------
 * - Store truth is immutable at API boundaries.
 * - Profile mutation is deterministic from inputs.
 * - Every persisted profile is normalized before leaving the module.
 * - Cold-start lives here as a dependency, not as scattered heuristics.
 * - The store can accept hints, but only when runtime policy allows it.
 * - No message enters durable learning state without backend acceptance.
 *
 * What this file owns
 * -------------------
 * - creation and hydration of ChatLearningProfile records,
 * - profile normalization and repair,
 * - mutation helpers for accepted chat lifecycle events,
 * - dirty profile tracking and persistence flushes,
 * - recommendation summaries for adjacent orchestrators,
 * - import/export for diagnostics and migration,
 * - in-memory snapshotting for coordinator/replay/telemetry consumers.
 *
 * What this file does not own
 * ---------------------------
 * - transcript mutation,
 * - moderation,
 * - replay assembly,
 * - online model inference,
 * - training datasets,
 * - websocket fanout.
 * ============================================================================
 */

import type {
  ChatAffectSnapshot,
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
  ChatColdStartProfileSeed,
  ChatColdStartRecommendation,
} from './ColdStartPopulationModel';

import { createColdStartPopulationModel } from './ColdStartPopulationModel';

// ============================================================================
// MARK: Public contracts
// ============================================================================

export interface LearningProfileStoreOptions {
  readonly runtime?: Partial<ChatRuntimeConfig>;
  readonly ports?: Pick<ChatEnginePorts, 'clock' | 'logger' | 'persistence' | 'learning'>;
  readonly coldStartModel?: ChatColdStartPopulationModelApi;
  readonly acceptClientHints?: boolean;
  readonly maxSalienceAnchorsPerProfile?: number;
  readonly emitProfileRecommendations?: boolean;
}

export interface LearningProfileStoreContext {
  readonly userId: ChatUserId;
  readonly roomId?: ChatRoomId | null;
  readonly now?: number;
  readonly roomKind?: ChatColdStartPopulationContext['roomKind'];
  readonly stageMood?: ChatColdStartPopulationContext['stageMood'];
  readonly requestedChannel?: ChatVisibleChannel | null;
  readonly featureSnapshot?: ChatFeatureSnapshot | null;
  readonly inferenceSnapshot?: ChatInferenceSnapshot | null;
  readonly legacyHints?: Partial<ChatColdStartLegacyCompat> | null;
  readonly clientHints?: Partial<ChatColdStartClientHints> | null;
}

export interface LearningProfileStoreHydrationResult {
  readonly ok: boolean;
  readonly reason:
    | 'VALID'
    | 'UNPARSABLE'
    | 'INVALID_USER'
    | 'INVALID_AFFECT'
    | 'INVALID_CHANNEL_AFFINITY'
    | 'MISSING_CORE_FIELDS';
  readonly profile: ChatLearningProfile | null;
}

export interface LearningProfileStoreMutationMeta {
  readonly now?: number;
  readonly roomId?: ChatRoomId | null;
  readonly reason?: string;
  readonly channelId?: ChatVisibleChannel | null;
  readonly intensity01?: number;
}

export interface LearningProfileStoreUpsertResult {
  readonly profile: ChatLearningProfile;
  readonly previous: ChatLearningProfile | null;
  readonly created: boolean;
  readonly changed: boolean;
  readonly dirty: boolean;
}

export interface LearningProfileStoreFlushResult {
  readonly flushedProfiles: readonly ChatLearningProfile[];
  readonly persisted: boolean;
}

export interface LearningProfileStoreRecommendation {
  readonly userId: ChatUserId;
  readonly recommendedVisibleChannel: ChatVisibleChannel;
  readonly helperUrgency01: Score01;
  readonly haterEligibility01: Score01;
  readonly ambientCadence01: Score01;
  readonly explanation: string;
}

export interface LearningProfileStoreExportLine {
  readonly userId: ChatUserId;
  readonly profile: ChatLearningProfile;
}

export interface LearningProfileStoreImportResult {
  readonly imported: readonly ChatLearningProfile[];
  readonly rejected: readonly {
    readonly raw: string;
    readonly reason: string;
  }[];
}

export interface LearningProfileStoreQuery {
  readonly userId?: ChatUserId | null;
  readonly roomId?: ChatRoomId | null;
  readonly coldStartOnly?: boolean;
  readonly limit?: number;
}

export interface LearningProfileStoreApi {
  readonly runtime: ChatRuntimeConfig;
  readonly coldStartModel: ChatColdStartPopulationModelApi;
  has(userId: ChatUserId): boolean;
  get(userId: ChatUserId): ChatLearningProfile | null;
  ensure(
    context: LearningProfileStoreContext,
  ): LearningProfileStoreUpsertResult & {
    readonly prior: ChatColdStartPopulationPrior;
    readonly recommendation: ChatColdStartRecommendation;
  };
  upsert(profile: ChatLearningProfile): LearningProfileStoreUpsertResult;
  remove(userId: ChatUserId): boolean;
  list(query?: LearningProfileStoreQuery): readonly ChatLearningProfile[];
  getDirtyProfiles(): readonly ChatLearningProfile[];
  clearDirtyProfiles(userIds?: readonly ChatUserId[]): void;
  flush(): Promise<LearningProfileStoreFlushResult>;
  hydrate(value: unknown): LearningProfileStoreHydrationResult;
  importNdjson(lines: readonly string[]): LearningProfileStoreImportResult;
  exportNdjson(query?: LearningProfileStoreQuery): readonly string[];
  snapshot(): Readonly<Record<ChatUserId, ChatLearningProfile>>;
  mergeAuthoritativeProfiles(
    profiles: readonly ChatLearningProfile[],
  ): readonly LearningProfileStoreUpsertResult[];
  applyFeatureSnapshot(
    userId: ChatUserId,
    snapshot: ChatFeatureSnapshot,
    meta?: LearningProfileStoreMutationMeta,
  ): LearningProfileStoreUpsertResult | null;
  applyInferenceSnapshot(
    snapshot: ChatInferenceSnapshot,
    meta?: LearningProfileStoreMutationMeta,
  ): LearningProfileStoreUpsertResult | null;
  applyAcceptedMessage(
    userId: ChatUserId,
    payload: {
      readonly text: string;
      readonly channelId: ChatVisibleChannel;
      readonly helperInvolved?: boolean;
      readonly haterInvolved?: boolean;
      readonly messageLength?: number;
    },
    meta?: LearningProfileStoreMutationMeta,
  ): LearningProfileStoreUpsertResult | null;
  applyChannelSwitch(
    userId: ChatUserId,
    channelId: ChatVisibleChannel,
    meta?: LearningProfileStoreMutationMeta,
  ): LearningProfileStoreUpsertResult | null;
  applyRescueOutcome(
    userId: ChatUserId,
    payload: {
      readonly accepted: boolean;
      readonly urgency:
        | 'NONE'
        | 'SOFT'
        | 'MEDIUM'
        | 'HARD'
        | 'CRITICAL';
    },
    meta?: LearningProfileStoreMutationMeta,
  ): LearningProfileStoreUpsertResult | null;
  attachSalienceAnchor(
    userId: ChatUserId,
    anchorId: ChatLearningProfile['salienceAnchorIds'][number],
    meta?: LearningProfileStoreMutationMeta,
  ): LearningProfileStoreUpsertResult | null;
  applyNormalizedEvent(
    event: ChatNormalizedEvent,
  ): LearningProfileStoreUpsertResult | null;
  createRecommendation(
    userId: ChatUserId,
    roomId?: ChatRoomId | null,
  ): LearningProfileStoreRecommendation | null;
}

// ============================================================================
// MARK: Module defaults
// ============================================================================

const PROFILE_STORE_DEFAULTS = Object.freeze({
  maxSalienceAnchorsPerProfile: 24,
  affectHalfLife: Object.freeze({
    confidence01: 0.82,
    frustration01: 0.74,
    intimidation01: 0.76,
    attachment01: 0.88,
    curiosity01: 0.86,
    embarrassment01: 0.72,
    relief01: 0.70,
  }),
  channelDriftWeights: Object.freeze({
    switchPrimary: 0.10,
    acceptedMessage: 0.08,
    helperAcceptedBoost: 0.04,
    haterAcceptedBoost: 0.04,
    backgroundDecay: 0.02,
  }),
  recommendationWeights: Object.freeze({
    helperUrgency_churn: 0.42,
    helperUrgency_frustration: 0.22,
    helperUrgency_intimidation: 0.16,
    helperUrgency_lowConfidence: 0.10,
    helperUrgency_lowAttachment: 0.10,
    haterEligibility_confidence: 0.26,
    haterEligibility_lowSusceptibility: 0.36,
    haterEligibility_globalAffinity: 0.10,
    haterEligibility_negotiationAggression: 0.12,
    haterEligibility_lowChurn: 0.16,
    ambient_curiosity: 0.34,
    ambient_attachment: 0.18,
    ambient_lobby: 0.18,
    ambient_syndicate: 0.12,
    ambient_relief: 0.18,
  }),
});

// ============================================================================
// MARK: Bootstrap
// ============================================================================

export function createLearningProfileStore(
  options: LearningProfileStoreOptions = {},
): LearningProfileStoreApi {
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
      logger: ports.logger
        ? {
            debug: ports.logger.debug.bind(ports.logger),
            info: ports.logger.info.bind(ports.logger),
            warn: ports.logger.warn.bind(ports.logger),
          }
        : undefined,
    });

  const profileCache = new Map<ChatUserId, ChatLearningProfile>();
  const dirty = new Set<ChatUserId>();

  function now(metaNow?: number): number {
    if (typeof metaNow === 'number' && Number.isFinite(metaNow)) {
      return Math.max(0, metaNow);
    }
    if (ports.clock) {
      return Math.max(0, ports.clock.now());
    }
    return Date.now();
  }

  function loggerContext(
    extra?: Readonly<Record<string, JsonValue>>,
  ): Readonly<Record<string, JsonValue>> {
    return Object.freeze({
      runtimeVersion: runtime.version,
      ...extra,
    });
  }

  function markDirty(userId: ChatUserId): void {
    dirty.add(userId);
  }

  function maybePublishProfiles(
    profiles: readonly ChatLearningProfile[],
  ): Promise<void> {
    if (profiles.length === 0) {
      return Promise.resolve();
    }

    const work: Array<void | Promise<void>> = [];

    if (runtime.learningPolicy.persistProfiles) {
      work.push(ports.persistence?.saveLearningProfiles?.(profiles));
    }

    work.push(ports.learning?.publishProfiles?.(profiles));

    return Promise.all(work).then(() => undefined);
  }

  function ensureProfile(
    context: LearningProfileStoreContext,
  ): LearningProfileStoreUpsertResult & {
    readonly prior: ChatColdStartPopulationPrior;
    readonly recommendation: ChatColdStartRecommendation;
  } {
    const existing = profileCache.get(context.userId) ?? null;
    const seeded = coldStartModel.seedLearningProfile({
      userId: context.userId,
      now: context.now,
      roomKind: context.roomKind,
      stageMood: context.stageMood,
      requestedChannel: context.requestedChannel,
      featureSnapshot: context.featureSnapshot ?? null,
      legacyHints: context.legacyHints ?? null,
      clientHints:
        runtime.learningPolicy.acceptClientHints
          ? context.clientHints ?? null
          : null,
      existingProfile: existing,
    });

    if (!existing && seeded.created) {
      profileCache.set(context.userId, seeded.profile);
      markDirty(context.userId);
    }

    return Object.freeze({
      profile: seeded.profile,
      previous: existing,
      created: seeded.created,
      changed: seeded.created,
      dirty: seeded.created,
      prior: seeded.prior,
      recommendation: seeded.recommendation,
    });
  }

  function getProfile(userId: ChatUserId): ChatLearningProfile | null {
    return profileCache.get(userId) ?? null;
  }

  function setProfile(
    profile: ChatLearningProfile,
    previous: ChatLearningProfile | null,
  ): LearningProfileStoreUpsertResult {
    const normalized = normalizeProfile(profile);
    const changed = !profilesEqual(previous, normalized);
    profileCache.set(normalized.userId, normalized);

    if (changed) {
      markDirty(normalized.userId);
    }

    return Object.freeze({
      profile: normalized,
      previous,
      created: previous === null,
      changed,
      dirty: changed,
    });
  }

  function mutateProfile(
    userId: ChatUserId,
    mutator: (profile: ChatLearningProfile) => ChatLearningProfile,
  ): LearningProfileStoreUpsertResult | null {
    const current = getProfile(userId);
    if (!current) {
      return null;
    }
    const next = normalizeProfile(mutator(current));
    return setProfile(next, current);
  }

  async function flush(): Promise<LearningProfileStoreFlushResult> {
    const profiles = Array.from(dirty)
      .map((userId) => profileCache.get(userId))
      .filter((value): value is ChatLearningProfile => Boolean(value));

    if (profiles.length === 0) {
      return Object.freeze({
        flushedProfiles: Object.freeze([]),
        persisted: true,
      });
    }

    await maybePublishProfiles(profiles);
    dirty.clear();

    return Object.freeze({
      flushedProfiles: Object.freeze([...profiles]),
      persisted: true,
    });
  }

  function hydrate(value: unknown): LearningProfileStoreHydrationResult {
    if (!value || typeof value !== 'object') {
      return Object.freeze({
        ok: false,
        reason: 'UNPARSABLE',
        profile: null,
      });
    }

    const candidate = value as Partial<Record<keyof ChatLearningProfile, unknown>>;

    if (!candidate.userId) {
      return Object.freeze({
        ok: false,
        reason: 'INVALID_USER',
        profile: null,
      });
    }

    try {
      const profile = normalizeProfile(candidate as ChatLearningProfile);
      return Object.freeze({
        ok: true,
        reason: 'VALID',
        profile,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown hydration error.';
      if (message.includes('affect')) {
        return Object.freeze({
          ok: false,
          reason: 'INVALID_AFFECT',
          profile: null,
        });
      }
      if (message.includes('channelAffinity')) {
        return Object.freeze({
          ok: false,
          reason: 'INVALID_CHANNEL_AFFINITY',
          profile: null,
        });
      }
      return Object.freeze({
        ok: false,
        reason: 'MISSING_CORE_FIELDS',
        profile: null,
      });
    }
  }

  function importNdjson(lines: readonly string[]): LearningProfileStoreImportResult {
    const imported: ChatLearningProfile[] = [];
    const rejected: Array<{ raw: string; reason: string }> = [];

    for (const raw of lines) {
      const trimmed = raw.trim();
      if (!trimmed) {
        continue;
      }

      try {
        const parsed = JSON.parse(trimmed) as unknown;
        const hydration = hydrate(parsed);
        if (!hydration.ok || !hydration.profile) {
          rejected.push({
            raw,
            reason: hydration.reason,
          });
          continue;
        }

        setProfile(hydration.profile, getProfile(hydration.profile.userId));
        imported.push(hydration.profile);
      } catch (error) {
        rejected.push({
          raw,
          reason: error instanceof Error ? error.message : 'JSON parse failure.',
        });
      }
    }

    return Object.freeze({
      imported: Object.freeze(imported),
      rejected: Object.freeze(rejected),
    });
  }

  function exportNdjson(query?: LearningProfileStoreQuery): readonly string[] {
    return list(query).map((profile) => JSON.stringify(profile));
  }

  function list(query: LearningProfileStoreQuery = {}): readonly ChatLearningProfile[] {
    let values = Array.from(profileCache.values());

    if (query.userId) {
      values = values.filter((profile) => profile.userId === query.userId);
    }

    if (query.coldStartOnly) {
      values = values.filter((profile) => profile.coldStart);
    }

    values.sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt));

    const limit =
      typeof query.limit === 'number' && Number.isFinite(query.limit)
        ? Math.max(0, Math.floor(query.limit))
        : values.length;

    return Object.freeze(values.slice(0, limit));
  }

  function snapshot(): Readonly<Record<ChatUserId, ChatLearningProfile>> {
    const record = {} as Record<ChatUserId, ChatLearningProfile>;
    for (const [userId, profile] of profileCache.entries()) {
      record[userId] = profile;
    }
    return Object.freeze(record);
  }

  function clearDirtyProfiles(userIds?: readonly ChatUserId[]): void {
    if (!userIds) {
      dirty.clear();
      return;
    }
    for (const userId of userIds) {
      dirty.delete(userId);
    }
  }

  function getDirtyProfiles(): readonly ChatLearningProfile[] {
    return Object.freeze(
      Array.from(dirty)
        .map((userId) => profileCache.get(userId))
        .filter((value): value is ChatLearningProfile => Boolean(value)),
    );
  }

  function mergeAuthoritativeProfiles(
    profiles: readonly ChatLearningProfile[],
  ): readonly LearningProfileStoreUpsertResult[] {
    const results: LearningProfileStoreUpsertResult[] = [];
    for (const profile of profiles) {
      results.push(setProfile(profile, getProfile(profile.userId)));
    }
    return Object.freeze(results);
  }

  function applyFeatureSnapshot(
    userId: ChatUserId,
    featureSnapshot: ChatFeatureSnapshot,
    meta: LearningProfileStoreMutationMeta = {},
  ): LearningProfileStoreUpsertResult | null {
    return mutateProfile(userId, (profile) =>
      applyFeatureSnapshotToProfile(profile, featureSnapshot, meta, now(meta.now)),
    );
  }

  function applyInferenceSnapshot(
    inferenceSnapshot: ChatInferenceSnapshot,
    meta: LearningProfileStoreMutationMeta = {},
  ): LearningProfileStoreUpsertResult | null {
    return mutateProfile(inferenceSnapshot.userId, (profile) =>
      applyInferenceSnapshotToProfile(
        profile,
        inferenceSnapshot,
        meta,
        now(meta.now),
      ),
    );
  }

  function applyAcceptedMessage(
    userId: ChatUserId,
    payload: {
      readonly text: string;
      readonly channelId: ChatVisibleChannel;
      readonly helperInvolved?: boolean;
      readonly haterInvolved?: boolean;
      readonly messageLength?: number;
    },
    meta: LearningProfileStoreMutationMeta = {},
  ): LearningProfileStoreUpsertResult | null {
    return mutateProfile(userId, (profile) =>
      applyAcceptedMessageToProfile(profile, payload, meta, now(meta.now)),
    );
  }

  function applyChannelSwitch(
    userId: ChatUserId,
    channelId: ChatVisibleChannel,
    meta: LearningProfileStoreMutationMeta = {},
  ): LearningProfileStoreUpsertResult | null {
    return mutateProfile(userId, (profile) =>
      applyChannelSwitchToProfile(profile, channelId, meta, now(meta.now)),
    );
  }

  function applyRescueOutcome(
    userId: ChatUserId,
    payload: {
      readonly accepted: boolean;
      readonly urgency:
        | 'NONE'
        | 'SOFT'
        | 'MEDIUM'
        | 'HARD'
        | 'CRITICAL';
    },
    meta: LearningProfileStoreMutationMeta = {},
  ): LearningProfileStoreUpsertResult | null {
    return mutateProfile(userId, (profile) =>
      applyRescueOutcomeToProfile(profile, payload, meta, now(meta.now)),
    );
  }

  function attachSalienceAnchor(
    userId: ChatUserId,
    anchorId: ChatLearningProfile['salienceAnchorIds'][number],
    meta: LearningProfileStoreMutationMeta = {},
  ): LearningProfileStoreUpsertResult | null {
    return mutateProfile(userId, (profile) =>
      attachSalienceAnchorToProfile(profile, anchorId, meta, now(meta.now)),
    );
  }

  function applyNormalizedEvent(
    event: ChatNormalizedEvent,
  ): LearningProfileStoreUpsertResult | null {
    if (!event.userId) {
      return null;
    }

    switch (event.kind) {
      case 'PLAYER_MESSAGE_ACCEPTED': {
        const payload = event.payload as Partial<{
          text: string;
          channelId: ChatVisibleChannel;
        }>;
        if (
          typeof payload.text !== 'string' ||
          !isVisibleChannel(payload.channelId)
        ) {
          return null;
        }
        return applyAcceptedMessage(
          event.userId,
          {
            text: payload.text,
            channelId: payload.channelId,
          },
          {
            now: Number(event.emittedAt),
            roomId: event.roomId ?? null,
            reason: 'normalized-event',
          },
        );
      }

      case 'HELPER_INTERVENTION': {
        return applyRescueOutcome(
          event.userId,
          {
            accepted: true,
            urgency: 'MEDIUM',
          },
          {
            now: Number(event.emittedAt),
            roomId: event.roomId ?? null,
            reason: 'helper-intervention',
          },
        );
      }

      case 'HATER_ESCALATION': {
        return mutateProfile(event.userId, (profile) =>
          withAffectAndScalars(
            profile,
            {
              intimidation01: Number(profile.affect.intimidation01) + 0.08,
              frustration01: Number(profile.affect.frustration01) + 0.04,
              confidence01: Number(profile.affect.confidence01) - 0.02,
            },
            {
              haterSusceptibility01:
                Number(profile.haterSusceptibility01) + 0.04,
              churnRisk01: Number(profile.churnRisk01) + 0.03,
            },
            now(Number(event.emittedAt)),
          ),
        );
      }

      case 'SESSION_JOIN_ACCEPTED': {
        const ensured = ensureProfile({
          userId: event.userId,
          roomId: event.roomId ?? null,
          now: Number(event.emittedAt),
        });
        return Object.freeze({
          profile: ensured.profile,
          previous: ensured.previous,
          created: ensured.created,
          changed: ensured.changed,
          dirty: ensured.dirty,
        });
      }

      default:
        return null;
    }
  }

  function createRecommendation(
    userId: ChatUserId,
    roomId: ChatRoomId | null = null,
  ): LearningProfileStoreRecommendation | null {
    const profile = getProfile(userId);
    if (!profile) {
      return null;
    }

    const recommendedVisibleChannel = selectDominantChannel(profile.channelAffinity);
    const helperUrgency01 = clamp01(
      Number(profile.churnRisk01) *
        PROFILE_STORE_DEFAULTS.recommendationWeights.helperUrgency_churn +
        Number(profile.affect.frustration01) *
          PROFILE_STORE_DEFAULTS.recommendationWeights.helperUrgency_frustration +
        Number(profile.affect.intimidation01) *
          PROFILE_STORE_DEFAULTS.recommendationWeights.helperUrgency_intimidation +
        (1 - Number(profile.affect.confidence01)) *
          PROFILE_STORE_DEFAULTS.recommendationWeights.helperUrgency_lowConfidence +
        (1 - Number(profile.affect.attachment01)) *
          PROFILE_STORE_DEFAULTS.recommendationWeights.helperUrgency_lowAttachment,
    );

    const haterEligibility01 = clamp01(
      Number(profile.affect.confidence01) *
        PROFILE_STORE_DEFAULTS.recommendationWeights.haterEligibility_confidence +
        (1 - Number(profile.haterSusceptibility01)) *
          PROFILE_STORE_DEFAULTS.recommendationWeights.haterEligibility_lowSusceptibility +
        Number(profile.channelAffinity.GLOBAL) *
          PROFILE_STORE_DEFAULTS.recommendationWeights.haterEligibility_globalAffinity +
        Number(profile.negotiationAggression01) *
          PROFILE_STORE_DEFAULTS.recommendationWeights.haterEligibility_negotiationAggression +
        (1 - Number(profile.churnRisk01)) *
          PROFILE_STORE_DEFAULTS.recommendationWeights.haterEligibility_lowChurn,
    );

    const ambientCadence01 = clamp01(
      Number(profile.affect.curiosity01) *
        PROFILE_STORE_DEFAULTS.recommendationWeights.ambient_curiosity +
        Number(profile.affect.attachment01) *
          PROFILE_STORE_DEFAULTS.recommendationWeights.ambient_attachment +
        Number(profile.channelAffinity.LOBBY) *
          PROFILE_STORE_DEFAULTS.recommendationWeights.ambient_lobby +
        Number(profile.channelAffinity.SYNDICATE) *
          PROFILE_STORE_DEFAULTS.recommendationWeights.ambient_syndicate +
        Number(profile.affect.relief01) *
          PROFILE_STORE_DEFAULTS.recommendationWeights.ambient_relief,
    );

    return Object.freeze({
      userId,
      recommendedVisibleChannel,
      helperUrgency01,
      haterEligibility01,
      ambientCadence01,
      explanation: [
        `channel=${recommendedVisibleChannel}`,
        `helper=${helperUrgency01.toFixed(2)}`,
        `hater=${haterEligibility01.toFixed(2)}`,
        `ambient=${ambientCadence01.toFixed(2)}`,
        ...(roomId ? [`room=${String(roomId)}`] : []),
      ].join(' '),
    });
  }

  return Object.freeze({
    runtime,
    coldStartModel,
    has(userId: ChatUserId): boolean {
      return profileCache.has(userId);
    },
    get(userId: ChatUserId): ChatLearningProfile | null {
      return getProfile(userId);
    },
    ensure(context: LearningProfileStoreContext) {
      return ensureProfile(context);
    },
    upsert(profile: ChatLearningProfile) {
      return setProfile(profile, getProfile(profile.userId));
    },
    remove(userId: ChatUserId): boolean {
      dirty.delete(userId);
      return profileCache.delete(userId);
    },
    list,
    getDirtyProfiles,
    clearDirtyProfiles,
    flush,
    hydrate,
    importNdjson,
    exportNdjson,
    snapshot,
    mergeAuthoritativeProfiles,
    applyFeatureSnapshot,
    applyInferenceSnapshot,
    applyAcceptedMessage,
    applyChannelSwitch,
    applyRescueOutcome,
    attachSalienceAnchor,
    applyNormalizedEvent,
    createRecommendation,
  });
}

// ============================================================================
// MARK: Profile mutation helpers
// ============================================================================

function applyFeatureSnapshotToProfile(
  profile: ChatLearningProfile,
  snapshot: ChatFeatureSnapshot,
  meta: LearningProfileStoreMutationMeta,
  updatedAtMs: number,
): ChatLearningProfile {
  const nowMs = asUnixMs(updatedAtMs);
  const messageIntensity = clamp01(snapshot.messageCountWindow / 24);
  const helperIgnoredPenalty = clamp01(snapshot.ignoredHelperCountWindow / 6);
  const outboundSignal = clamp01(snapshot.outboundPlayerCountWindow / 16);
  const inboundNpcDensity = clamp01(snapshot.inboundNpcCountWindow / 18);

  const channelAffinity = blendAffinityTowardActivity(
    profile.channelAffinity,
    inferChannelFromMeta(meta.channelId, selectDominantChannel(profile.channelAffinity)),
    PROFILE_STORE_DEFAULTS.channelDriftWeights.acceptedMessage * (0.6 + Number(outboundSignal) * 0.4),
  );

  const affect = decayAndBlendAffect(
    profile.affect,
    snapshot.affect,
    PROFILE_STORE_DEFAULTS.affectHalfLife,
    0.42,
  );

  return normalizeProfile({
    ...profile,
    updatedAt: nowMs,
    coldStart: false,
    engagementBaseline01: clamp01(
      lerp(
        Number(profile.engagementBaseline01),
        clamp01(
          messageIntensity * 0.28 +
            outboundSignal * 0.32 +
            (1 - helperIgnoredPenalty) * 0.10 +
            (1 - Number(snapshot.churnRisk01)) * 0.12 +
            Number(snapshot.roomHeat01) * 0.08 +
            Number(snapshot.affect.curiosity01) * 0.10,
        ),
        0.34,
      ),
    ),
    helperReceptivity01: clamp01(
      lerp(
        Number(profile.helperReceptivity01),
        clamp01(
          Number(profile.helperReceptivity01) +
            (1 - helperIgnoredPenalty) * 0.08 +
            Number(snapshot.affect.relief01) * 0.05 -
            Number(snapshot.affect.confidence01) * 0.03,
        ),
        0.22,
      ),
    ),
    haterSusceptibility01: clamp01(
      lerp(
        Number(profile.haterSusceptibility01),
        clamp01(
          Number(snapshot.hostileMomentum01) * 0.14 +
            Number(snapshot.roomHeat01) * 0.10 +
            Number(snapshot.affect.intimidation01) * 0.10 +
            Number(profile.haterSusceptibility01) * 0.66,
        ),
        0.24,
      ),
    ),
    negotiationAggression01: clamp01(
      lerp(
        Number(profile.negotiationAggression01),
        clamp01(
          Number(profile.negotiationAggression01) * 0.78 +
            Number(snapshot.affect.confidence01) * 0.10 -
            Number(snapshot.affect.frustration01) * 0.04 +
            Number(snapshot.roomHeat01) * 0.04,
        ),
        0.18,
      ),
    ),
    channelAffinity,
    churnRisk01: clamp01(
      lerp(
        Number(profile.churnRisk01),
        clamp01(
          Number(snapshot.churnRisk01) * 0.44 +
            Number(snapshot.affect.frustration01) * 0.20 +
            Number(snapshot.affect.intimidation01) * 0.10 +
            helperIgnoredPenalty * 0.12 -
            Number(snapshot.affect.relief01) * 0.10 -
            outboundSignal * 0.08,
        ),
        0.34,
      ),
    ),
    affect,
  });
}

function applyInferenceSnapshotToProfile(
  profile: ChatLearningProfile,
  inference: ChatInferenceSnapshot,
  meta: LearningProfileStoreMutationMeta,
  updatedAtMs: number,
): ChatLearningProfile {
  const recommendedChannel = selectDominantChannel(inference.channelAffinity);

  const affinity = normalizeAffinityRecord({
    GLOBAL: lerp(
      Number(profile.channelAffinity.GLOBAL),
      Number(inference.channelAffinity.GLOBAL),
      0.28,
    ),
    SYNDICATE: lerp(
      Number(profile.channelAffinity.SYNDICATE),
      Number(inference.channelAffinity.SYNDICATE),
      0.28,
    ),
    DEAL_ROOM: lerp(
      Number(profile.channelAffinity.DEAL_ROOM),
      Number(inference.channelAffinity.DEAL_ROOM),
      0.28,
    ),
    LOBBY: lerp(
      Number(profile.channelAffinity.LOBBY),
      Number(inference.channelAffinity.LOBBY),
      0.28,
    ),
  });

  return normalizeProfile({
    ...profile,
    updatedAt: asUnixMs(updatedAtMs),
    coldStart: false,
    engagementBaseline01: clamp01(
      lerp(
        Number(profile.engagementBaseline01),
        Number(inference.engagement01),
        0.20,
      ),
    ),
    helperReceptivity01: clamp01(
      lerp(
        Number(profile.helperReceptivity01),
        Number(inference.helperTiming01),
        0.16,
      ),
    ),
    haterSusceptibility01: clamp01(
      lerp(
        Number(profile.haterSusceptibility01),
        Number(inference.haterTargeting01),
        0.16,
      ),
    ),
    channelAffinity: blendAffinityTowardActivity(
      affinity,
      recommendedChannel,
      PROFILE_STORE_DEFAULTS.channelDriftWeights.switchPrimary,
    ),
    churnRisk01: clamp01(
      lerp(Number(profile.churnRisk01), Number(inference.churnRisk01), 0.24),
    ),
  });
}

function applyAcceptedMessageToProfile(
  profile: ChatLearningProfile,
  payload: {
    readonly text: string;
    readonly channelId: ChatVisibleChannel;
    readonly helperInvolved?: boolean;
    readonly haterInvolved?: boolean;
    readonly messageLength?: number;
  },
  meta: LearningProfileStoreMutationMeta,
  updatedAtMs: number,
): ChatLearningProfile {
  const text = payload.text.trim();
  const messageLength = Math.max(
    0,
    payload.messageLength ?? text.length,
  );
  const expressiveWeight = clamp01(messageLength / 320);
  const capsRate = computeCapsRate(text);
  const questionRate = computeQuestionRate(text);
  const exclamationRate = computeExclamationRate(text);

  let next = normalizeProfile({
    ...profile,
    updatedAt: asUnixMs(updatedAtMs),
    coldStart: false,
    engagementBaseline01: clamp01(
      lerp(
        Number(profile.engagementBaseline01),
        clamp01(
          Number(profile.engagementBaseline01) * 0.70 +
            expressiveWeight * 0.18 +
            questionRate * 0.06 +
            (payload.helperInvolved ? 0.03 : 0) +
            (payload.haterInvolved ? 0.03 : 0),
        ),
        0.30,
      ),
    ),
    helperReceptivity01: clamp01(
      lerp(
        Number(profile.helperReceptivity01),
        clamp01(
          Number(profile.helperReceptivity01) +
            (payload.helperInvolved ? 0.06 : 0) +
            questionRate * 0.03 -
            capsRate * 0.02,
        ),
        0.18,
      ),
    ),
    haterSusceptibility01: clamp01(
      lerp(
        Number(profile.haterSusceptibility01),
        clamp01(
          Number(profile.haterSusceptibility01) +
            (payload.haterInvolved ? 0.06 : 0) +
            exclamationRate * 0.04 +
            capsRate * 0.03,
        ),
        0.18,
      ),
    ),
    negotiationAggression01: clamp01(
      lerp(
        Number(profile.negotiationAggression01),
        clamp01(
          Number(profile.negotiationAggression01) +
            (payload.channelId === 'DEAL_ROOM' ? 0.08 : 0) +
            capsRate * 0.03 +
            exclamationRate * 0.02,
        ),
        0.16,
      ),
    ),
    channelAffinity: blendAffinityTowardActivity(
      profile.channelAffinity,
      payload.channelId,
      PROFILE_STORE_DEFAULTS.channelDriftWeights.acceptedMessage +
        (payload.helperInvolved
          ? PROFILE_STORE_DEFAULTS.channelDriftWeights.helperAcceptedBoost
          : 0) +
        (payload.haterInvolved
          ? PROFILE_STORE_DEFAULTS.channelDriftWeights.haterAcceptedBoost
          : 0),
    ),
    churnRisk01: clamp01(
      lerp(
        Number(profile.churnRisk01),
        clamp01(
          Number(profile.churnRisk01) -
            expressiveWeight * 0.04 -
            questionRate * 0.02 -
            (payload.helperInvolved ? 0.02 : 0),
        ),
        0.12,
      ),
    ),
    affect: Object.freeze({
      confidence01: clamp01(
        lerp(
          Number(profile.affect.confidence01),
          clamp01(
            Number(profile.affect.confidence01) +
              expressiveWeight * 0.06 -
              questionRate * 0.02 +
              (payload.haterInvolved ? 0.02 : 0),
          ),
          0.20,
        ),
      ),
      frustration01: clamp01(
        lerp(
          Number(profile.affect.frustration01),
          clamp01(
            Number(profile.affect.frustration01) +
              capsRate * 0.05 +
              exclamationRate * 0.03 -
              (payload.helperInvolved ? 0.03 : 0),
          ),
          0.18,
        ),
      ),
      intimidation01: clamp01(
        lerp(
          Number(profile.affect.intimidation01),
          clamp01(
            Number(profile.affect.intimidation01) +
              (payload.haterInvolved ? 0.05 : 0) -
              expressiveWeight * 0.02,
          ),
          0.16,
        ),
      ),
      attachment01: clamp01(
        lerp(
          Number(profile.affect.attachment01),
          clamp01(
            Number(profile.affect.attachment01) +
              (payload.helperInvolved ? 0.04 : 0) +
              (payload.channelId === 'SYNDICATE' ? 0.03 : 0),
          ),
          0.16,
        ),
      ),
      curiosity01: clamp01(
        lerp(
          Number(profile.affect.curiosity01),
          clamp01(
            Number(profile.affect.curiosity01) +
              questionRate * 0.08 +
              (payload.channelId === 'LOBBY' ? 0.03 : 0),
          ),
          0.18,
        ),
      ),
      embarrassment01: clamp01(
        lerp(
          Number(profile.affect.embarrassment01),
          clamp01(
            Number(profile.affect.embarrassment01) +
              (capsRate > 0.35 ? 0.03 : 0) +
              (payload.channelId === 'GLOBAL' && payload.haterInvolved ? 0.04 : 0),
          ),
          0.16,
        ),
      ),
      relief01: clamp01(
        lerp(
          Number(profile.affect.relief01),
          clamp01(
            Number(profile.affect.relief01) +
              (payload.helperInvolved ? 0.05 : 0) -
              (payload.haterInvolved ? 0.02 : 0),
          ),
          0.16,
        ),
      ),
    }),
  });

  if (payload.helperInvolved) {
    next = applyRescueOutcomeToProfile(
      next,
      {
        accepted: true,
        urgency: 'SOFT',
      },
      meta,
      updatedAtMs,
    );
  }

  return next;
}

function applyChannelSwitchToProfile(
  profile: ChatLearningProfile,
  channelId: ChatVisibleChannel,
  meta: LearningProfileStoreMutationMeta,
  updatedAtMs: number,
): ChatLearningProfile {
  return normalizeProfile({
    ...profile,
    updatedAt: asUnixMs(updatedAtMs),
    channelAffinity: blendAffinityTowardActivity(
      profile.channelAffinity,
      channelId,
      PROFILE_STORE_DEFAULTS.channelDriftWeights.switchPrimary,
    ),
    affect: Object.freeze({
      ...profile.affect,
      curiosity01: clamp01(
        lerp(
          Number(profile.affect.curiosity01),
          clamp01(
            Number(profile.affect.curiosity01) +
              (channelId === 'LOBBY' ? 0.04 : 0.01),
          ),
          0.14,
        ),
      ),
    }),
  });
}

function applyRescueOutcomeToProfile(
  profile: ChatLearningProfile,
  payload: {
    readonly accepted: boolean;
    readonly urgency:
      | 'NONE'
      | 'SOFT'
      | 'MEDIUM'
      | 'HARD'
      | 'CRITICAL';
  },
  meta: LearningProfileStoreMutationMeta,
  updatedAtMs: number,
): ChatLearningProfile {
  const urgency01 = rescueUrgencyAsRate(payload.urgency);
  const acceptedBoost = payload.accepted ? 1 : -0.5;

  return normalizeProfile({
    ...profile,
    updatedAt: asUnixMs(updatedAtMs),
    rescueHistoryCount: Math.max(
      0,
      profile.rescueHistoryCount + (payload.accepted ? 1 : 0),
    ),
    helperReceptivity01: clamp01(
      lerp(
        Number(profile.helperReceptivity01),
        clamp01(
          Number(profile.helperReceptivity01) +
            urgency01 * 0.10 * acceptedBoost,
        ),
        0.20,
      ),
    ),
    churnRisk01: clamp01(
      lerp(
        Number(profile.churnRisk01),
        clamp01(
          Number(profile.churnRisk01) -
            (payload.accepted ? urgency01 * 0.14 : -urgency01 * 0.04),
        ),
        0.22,
      ),
    ),
    affect: Object.freeze({
      confidence01: clamp01(
        lerp(
          Number(profile.affect.confidence01),
          clamp01(
            Number(profile.affect.confidence01) + (payload.accepted ? 0.06 : -0.03),
          ),
          0.18,
        ),
      ),
      frustration01: clamp01(
        lerp(
          Number(profile.affect.frustration01),
          clamp01(
            Number(profile.affect.frustration01) -
              (payload.accepted ? urgency01 * 0.16 : -urgency01 * 0.04),
          ),
          0.18,
        ),
      ),
      intimidation01: clamp01(
        lerp(
          Number(profile.affect.intimidation01),
          clamp01(
            Number(profile.affect.intimidation01) -
              (payload.accepted ? urgency01 * 0.08 : -urgency01 * 0.02),
          ),
          0.16,
        ),
      ),
      attachment01: clamp01(
        lerp(
          Number(profile.affect.attachment01),
          clamp01(
            Number(profile.affect.attachment01) +
              (payload.accepted ? urgency01 * 0.06 : 0),
          ),
          0.16,
        ),
      ),
      curiosity01: profile.affect.curiosity01,
      embarrassment01: clamp01(
        lerp(
          Number(profile.affect.embarrassment01),
          clamp01(
            Number(profile.affect.embarrassment01) -
              (payload.accepted ? 0.03 : 0),
          ),
          0.16,
        ),
      ),
      relief01: clamp01(
        lerp(
          Number(profile.affect.relief01),
          clamp01(
            Number(profile.affect.relief01) +
              (payload.accepted ? urgency01 * 0.18 : -0.02),
          ),
          0.18,
        ),
      ),
    }),
  });
}

function attachSalienceAnchorToProfile(
  profile: ChatLearningProfile,
  anchorId: ChatLearningProfile['salienceAnchorIds'][number],
  meta: LearningProfileStoreMutationMeta,
  updatedAtMs: number,
): ChatLearningProfile {
  const existing = profile.salienceAnchorIds.filter((value) => value !== anchorId);
  const limited = [anchorId, ...existing].slice(
    0,
    PROFILE_STORE_DEFAULTS.maxSalienceAnchorsPerProfile,
  );

  return normalizeProfile({
    ...profile,
    updatedAt: asUnixMs(updatedAtMs),
    salienceAnchorIds: Object.freeze(limited),
    affect: Object.freeze({
      ...profile.affect,
      attachment01: clamp01(
        lerp(Number(profile.affect.attachment01), Number(profile.affect.attachment01) + 0.02, 0.20),
      ),
    }),
  });
}

function withAffectAndScalars(
  profile: ChatLearningProfile,
  affectPatch: Partial<Record<keyof ChatAffectSnapshot, number>>,
  scalarPatch: Partial<{
    engagementBaseline01: number;
    helperReceptivity01: number;
    haterSusceptibility01: number;
    negotiationAggression01: number;
    churnRisk01: number;
  }>,
  updatedAtMs: number,
): ChatLearningProfile {
  return normalizeProfile({
    ...profile,
    updatedAt: asUnixMs(updatedAtMs),
    engagementBaseline01: clamp01(
      scalarPatch.engagementBaseline01 ?? Number(profile.engagementBaseline01),
    ),
    helperReceptivity01: clamp01(
      scalarPatch.helperReceptivity01 ?? Number(profile.helperReceptivity01),
    ),
    haterSusceptibility01: clamp01(
      scalarPatch.haterSusceptibility01 ?? Number(profile.haterSusceptibility01),
    ),
    negotiationAggression01: clamp01(
      scalarPatch.negotiationAggression01 ?? Number(profile.negotiationAggression01),
    ),
    churnRisk01: clamp01(
      scalarPatch.churnRisk01 ?? Number(profile.churnRisk01),
    ),
    affect: Object.freeze({
      confidence01: clamp01(
        affectPatch.confidence01 ?? Number(profile.affect.confidence01),
      ),
      frustration01: clamp01(
        affectPatch.frustration01 ?? Number(profile.affect.frustration01),
      ),
      intimidation01: clamp01(
        affectPatch.intimidation01 ?? Number(profile.affect.intimidation01),
      ),
      attachment01: clamp01(
        affectPatch.attachment01 ?? Number(profile.affect.attachment01),
      ),
      curiosity01: clamp01(
        affectPatch.curiosity01 ?? Number(profile.affect.curiosity01),
      ),
      embarrassment01: clamp01(
        affectPatch.embarrassment01 ?? Number(profile.affect.embarrassment01),
      ),
      relief01: clamp01(
        affectPatch.relief01 ?? Number(profile.affect.relief01),
      ),
    }),
  });
}

// ============================================================================
// MARK: Normalization and equality
// ============================================================================

function normalizeProfile(profile: ChatLearningProfile): ChatLearningProfile {
  if (!profile.userId) {
    throw new Error('LearningProfileStore.normalizeProfile missing userId.');
  }

  const createdAt = normalizeUnixMs(profile.createdAt);
  const updatedAt = normalizeUnixMs(profile.updatedAt);

  const affect = normalizeAffect(profile.affect);
  const channelAffinity = normalizeAffinityRecord({
    GLOBAL: Number(profile.channelAffinity?.GLOBAL ?? 0.25),
    SYNDICATE: Number(profile.channelAffinity?.SYNDICATE ?? 0.25),
    DEAL_ROOM: Number(profile.channelAffinity?.DEAL_ROOM ?? 0.25),
    LOBBY: Number(profile.channelAffinity?.LOBBY ?? 0.25),
  });

  return Object.freeze({
    userId: profile.userId,
    createdAt,
    updatedAt,
    coldStart: Boolean(profile.coldStart),
    engagementBaseline01: clamp01(Number(profile.engagementBaseline01)),
    helperReceptivity01: clamp01(Number(profile.helperReceptivity01)),
    haterSusceptibility01: clamp01(Number(profile.haterSusceptibility01)),
    negotiationAggression01: clamp01(Number(profile.negotiationAggression01)),
    channelAffinity,
    rescueHistoryCount: Math.max(
      0,
      Math.floor(Number(profile.rescueHistoryCount ?? 0)),
    ),
    churnRisk01: clamp01(Number(profile.churnRisk01)),
    salienceAnchorIds: Object.freeze(dedupeAnchors(profile.salienceAnchorIds ?? [])),
    affect,
  });
}

function normalizeAffect(affect: ChatAffectSnapshot | undefined): ChatAffectSnapshot {
  if (!affect) {
    throw new Error('LearningProfileStore.normalizeProfile invalid affect.');
  }

  return Object.freeze({
    confidence01: clamp01(Number(affect.confidence01)),
    frustration01: clamp01(Number(affect.frustration01)),
    intimidation01: clamp01(Number(affect.intimidation01)),
    attachment01: clamp01(Number(affect.attachment01)),
    curiosity01: clamp01(Number(affect.curiosity01)),
    embarrassment01: clamp01(Number(affect.embarrassment01)),
    relief01: clamp01(Number(affect.relief01)),
  });
}

function profilesEqual(
  left: ChatLearningProfile | null,
  right: ChatLearningProfile,
): boolean {
  if (!left) {
    return false;
  }
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeUnixMs(value: UnixMs | number): UnixMs {
  return asUnixMs(Math.max(0, Number(value)));
}

function dedupeAnchors(
  anchors: readonly ChatLearningProfile['salienceAnchorIds'][number][],
): readonly ChatLearningProfile['salienceAnchorIds'][number][] {
  const seen = new Set<string>();
  const result: ChatLearningProfile['salienceAnchorIds'][number][] = [];
  for (const anchor of anchors) {
    const key = String(anchor);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(anchor);
  }
  return Object.freeze(result);
}

// ============================================================================
// MARK: Affinity / affect helpers
// ============================================================================

function decayAndBlendAffect(
  current: ChatAffectSnapshot,
  incoming: ChatAffectSnapshot,
  halfLife: typeof PROFILE_STORE_DEFAULTS.affectHalfLife,
  strength: number,
): ChatAffectSnapshot {
  return Object.freeze({
    confidence01: clamp01(
      lerp(
        Number(current.confidence01) * halfLife.confidence01,
        Number(incoming.confidence01),
        strength,
      ),
    ),
    frustration01: clamp01(
      lerp(
        Number(current.frustration01) * halfLife.frustration01,
        Number(incoming.frustration01),
        strength,
      ),
    ),
    intimidation01: clamp01(
      lerp(
        Number(current.intimidation01) * halfLife.intimidation01,
        Number(incoming.intimidation01),
        strength,
      ),
    ),
    attachment01: clamp01(
      lerp(
        Number(current.attachment01) * halfLife.attachment01,
        Number(incoming.attachment01),
        strength,
      ),
    ),
    curiosity01: clamp01(
      lerp(
        Number(current.curiosity01) * halfLife.curiosity01,
        Number(incoming.curiosity01),
        strength,
      ),
    ),
    embarrassment01: clamp01(
      lerp(
        Number(current.embarrassment01) * halfLife.embarrassment01,
        Number(incoming.embarrassment01),
        strength,
      ),
    ),
    relief01: clamp01(
      lerp(
        Number(current.relief01) * halfLife.relief01,
        Number(incoming.relief01),
        strength,
      ),
    ),
  });
}

function blendAffinityTowardActivity(
  current: Readonly<Record<ChatVisibleChannel, Score01>>,
  primary: ChatVisibleChannel,
  primaryWeight: number,
): Readonly<Record<ChatVisibleChannel, Score01>> {
  const weight = clamp01(primaryWeight);
  return normalizeAffinityRecord({
    GLOBAL:
      Number(current.GLOBAL) *
      (primary === 'GLOBAL' ? 1 + weight : 1 - weight * PROFILE_STORE_DEFAULTS.channelDriftWeights.backgroundDecay),
    SYNDICATE:
      Number(current.SYNDICATE) *
      (primary === 'SYNDICATE' ? 1 + weight : 1 - weight * PROFILE_STORE_DEFAULTS.channelDriftWeights.backgroundDecay),
    DEAL_ROOM:
      Number(current.DEAL_ROOM) *
      (primary === 'DEAL_ROOM' ? 1 + weight : 1 - weight * PROFILE_STORE_DEFAULTS.channelDriftWeights.backgroundDecay),
    LOBBY:
      Number(current.LOBBY) *
      (primary === 'LOBBY' ? 1 + weight : 1 - weight * PROFILE_STORE_DEFAULTS.channelDriftWeights.backgroundDecay),
  });
}

function normalizeAffinityRecord(
  input: Readonly<Record<ChatVisibleChannel, number>>,
): Readonly<Record<ChatVisibleChannel, Score01>> {
  const sanitized: Readonly<Record<ChatVisibleChannel, number>> = Object.freeze({
    GLOBAL: Math.max(0.01, input.GLOBAL),
    SYNDICATE: Math.max(0.01, input.SYNDICATE),
    DEAL_ROOM: Math.max(0.01, input.DEAL_ROOM),
    LOBBY: Math.max(0.01, input.LOBBY),
  });

  const total =
    sanitized.GLOBAL +
    sanitized.SYNDICATE +
    sanitized.DEAL_ROOM +
    sanitized.LOBBY ||
    1;

  return Object.freeze({
    GLOBAL: clamp01(sanitized.GLOBAL / total),
    SYNDICATE: clamp01(sanitized.SYNDICATE / total),
    DEAL_ROOM: clamp01(sanitized.DEAL_ROOM / total),
    LOBBY: clamp01(sanitized.LOBBY / total),
  });
}

// ============================================================================
// MARK: Interpretation helpers
// ============================================================================

function selectDominantChannel(
  affinity: Readonly<Record<ChatVisibleChannel, Score01>>,
): ChatVisibleChannel {
  const channels: readonly ChatVisibleChannel[] = [
    'GLOBAL',
    'SYNDICATE',
    'DEAL_ROOM',
    'LOBBY',
  ];

  let winner: ChatVisibleChannel = 'LOBBY';
  let winnerScore = -1;
  for (const channel of channels) {
    const score = Number(affinity[channel]);
    if (score > winnerScore) {
      winner = channel;
      winnerScore = score;
    }
  }
  return winner;
}

function inferChannelFromMeta(
  channelId: ChatVisibleChannel | null | undefined,
  fallback: ChatVisibleChannel,
): ChatVisibleChannel {
  return isVisibleChannel(channelId) ? channelId : fallback;
}

function rescueUrgencyAsRate(
  urgency:
    | 'NONE'
    | 'SOFT'
    | 'MEDIUM'
    | 'HARD'
    | 'CRITICAL',
): number {
  switch (urgency) {
    case 'CRITICAL':
      return 1.0;
    case 'HARD':
      return 0.78;
    case 'MEDIUM':
      return 0.56;
    case 'SOFT':
      return 0.34;
    case 'NONE':
    default:
      return 0;
  }
}

function computeCapsRate(text: string): number {
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (!letters) {
    return 0;
  }
  const caps = letters.replace(/[^A-Z]/g, '').length;
  return caps / letters.length;
}

function computeQuestionRate(text: string): number {
  if (!text) {
    return 0;
  }
  return Math.min(1, (text.match(/\?/g) ?? []).length / 3);
}

function computeExclamationRate(text: string): number {
  if (!text) {
    return 0;
  }
  return Math.min(1, (text.match(/!/g) ?? []).length / 4);
}

function isVisibleChannel(
  value: unknown,
): value is ChatVisibleChannel {
  return (
    value === 'GLOBAL' ||
    value === 'SYNDICATE' ||
    value === 'DEAL_ROOM' ||
    value === 'LOBBY'
  );
}

// ============================================================================
// MARK: Generic math / runtime helpers
// ============================================================================

function mergeRuntime(
  runtime: Partial<ChatRuntimeConfig> | undefined,
): ChatRuntimeConfig {
  if (!runtime) {
    return CHAT_RUNTIME_DEFAULTS;
  }

  return Object.freeze({
    ...CHAT_RUNTIME_DEFAULTS,
    ...runtime,
    ratePolicy: {
      ...CHAT_RUNTIME_DEFAULTS.ratePolicy,
      ...(runtime.ratePolicy ?? {}),
    },
    moderationPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.moderationPolicy,
      ...(runtime.moderationPolicy ?? {}),
    },
    replayPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.replayPolicy,
      ...(runtime.replayPolicy ?? {}),
    },
    learningPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.learningPolicy,
      ...(runtime.learningPolicy ?? {}),
    },
    proofPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.proofPolicy,
      ...(runtime.proofPolicy ?? {}),
    },
    invasionPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.invasionPolicy,
      ...(runtime.invasionPolicy ?? {}),
    },
  });
}

function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * clamp01(alpha);
}

// ============================================================================
// MARK: Named exports for downstream coordinator lane
// ============================================================================

export {
  PROFILE_STORE_DEFAULTS as CHAT_LEARNING_PROFILE_STORE_DEFAULTS,
};
