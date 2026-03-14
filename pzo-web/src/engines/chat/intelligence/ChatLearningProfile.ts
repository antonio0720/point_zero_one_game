// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/intelligence/ChatLearningProfile.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT LEARNING PROFILE
 * FILE: pzo-web/src/engines/chat/intelligence/ChatLearningProfile.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Runtime constructor, normalizer, mutator, serializer, recommender, and
 * merge surface for the frontend learning profile lane.
 *
 * This module operationalizes the `ChatLearningProfile` contract from
 * `../types` while preserving the behavioral intent of the older donor lane:
 * - first-contact conservatism,
 * - channel preference accumulation,
 * - helper trust growth,
 * - hater targeting adaptation,
 * - emotion baseline drift,
 * - memory anchor carry-forward,
 * - merge-safe upgrades when authoritative backend state arrives.
 *
 * Frontend doctrine
 * -----------------
 * - The frontend owns immediacy and local continuity.
 * - The backend owns durable truth.
 * - This profile is allowed to move fast locally, but it must stay mergeable.
 * - All mutation helpers in this file return new immutable profile objects.
 * - No runtime dependency on future ML/DL modules is allowed here.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import type {
  ChatAffectSnapshot,
  ChatChannelId,
  ChatColdStartProfile as ChatColdStartProfileContract,
  ChatFeatureSnapshot,
  ChatLearningProfile as ChatLearningProfileContract,
  ChatMemoryAnchorId,
  ChatTelemetryEnvelope,
  ChatUserId,
  ChatVisibleChannel,
  JsonObject,
  Score100,
  UnixMs,
  ChatEmotionVector,
} from '../types';

import {
  CHAT_COLD_START_PROFILE_VERSION,
  createChatColdStartProfile,
  createChatColdStartProfileFromLegacyCompat,
  createChatColdStartRecommendation,
  hydrateChatColdStartProfile,
  isChatColdStartProfile,
  mergeChatColdStartProfiles,
  type ChatColdStartProfile,
  type ChatColdStartRecommendation,
  type ChatColdStartSeedContext,
  type LegacyPlayerLearningProfileCompat,
} from './ChatColdStartProfile';

export type ChatLearningProfile = ChatLearningProfileContract;

export interface ChatLearningProfileCreateContext {
  readonly now?: number;
  readonly profileId?: string;
  readonly playerId?: ChatUserId | string;
  readonly coldStart?: ChatColdStartProfileContract;
  readonly legacyProfile?: Partial<LegacyPlayerLearningProfileCompat>;
  readonly featureSnapshot?: ChatFeatureSnapshot;
  readonly initialMemoryAnchors?: readonly (ChatMemoryAnchorId | string)[];
  readonly helperPersonaSeeds?: Readonly<Record<string, number>>;
  readonly haterPersonaSeeds?: Readonly<Record<string, number>>;
}

export interface ChatLearningProfileHydrationResult {
  readonly ok: boolean;
  readonly reason:
    | 'VALID'
    | 'UNPARSABLE'
    | 'MISSING_FIELDS'
    | 'INVALID_CHANNEL_AFFINITY'
    | 'INVALID_EMOTION_BASELINE';
  readonly profile: ChatLearningProfile;
}

export interface ChatLearningProfileMutationMeta {
  readonly now?: number;
  readonly reason?: string;
}

export interface ChatLearningProfileRecommendation {
  readonly recommendedChannel: ChatVisibleChannel;
  readonly helperPersonaId?: string;
  readonly helperTrustScore: Score100;
  readonly haterPersonaId?: string;
  readonly haterTargetScore: Score100;
  readonly strongestEmotion:
    | 'INTIMIDATION'
    | 'CONFIDENCE'
    | 'FRUSTRATION'
    | 'CURIOSITY'
    | 'ATTACHMENT'
    | 'EMBARRASSMENT'
    | 'RELIEF'
    | 'DOMINANCE'
    | 'DESPERATION'
    | 'TRUST';
  readonly coldStartRecommendation: ChatColdStartRecommendation;
  readonly explanation: string;
}

export const CHAT_LEARNING_PROFILE_MODULE_NAME =
  'PZO_CHAT_LEARNING_PROFILE' as const;

export const CHAT_LEARNING_PROFILE_VERSION =
  '2026.03.13-learning-profile.v1' as const;

export const CHAT_LEARNING_PROFILE_RUNTIME_LAWS = Object.freeze([
  'Profiles mutate locally but remain merge-safe.',
  'Cold-start seeding is mandatory when no durable profile exists.',
  'Channel affinity is visible-channel only.',
  'Helper trust and hater targeting are actor-memory lanes, not transcript truth.',
  'Emotion baselines move gradually; they do not snap wildly.',
  'Memory anchors are bounded and salience-first.',
  'Server authority can override values but should preserve useful local carry-forward.',
  'No future ML/DL runtime import is required to use this file today.',
] as const);

export const CHAT_LEARNING_PROFILE_HELPER_SEED_IDS = Object.freeze([
  'MENTOR',
  'INSIDER',
  'SURVIVOR',
  'RIVAL',
  'ARCHIVIST',
] as const);

export const CHAT_LEARNING_PROFILE_HATER_SEED_IDS = Object.freeze([
  'BOT_01_LIQUIDATOR',
  'BOT_02_BUREAUCRAT',
  'BOT_03_MANIPULATOR',
  'BOT_04_CRASH_PROPHET',
  'BOT_05_LEGACY_HEIR',
] as const);

export const CHAT_LEARNING_PROFILE_DEFAULTS = Object.freeze({
  maxMemoryAnchors: 24,
  helperTrustFloor: 32,
  helperTrustCeiling: 96,
  haterTargetFloor: 20,
  haterTargetCeiling: 98,
  channelAffinityFloor: 18,
  channelAffinityCeiling: 96,
  helperTrustStep: 6,
  haterTargetStep: 5,
  affinityStepMinor: 4,
  affinityStepMajor: 8,
  emotionStepMinor: 4,
  emotionStepMajor: 8,
} as const);

function clamp100(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 100) return 100;
  return value;
}

function asScore100(value: number): Score100 {
  return clamp100(value) as Score100;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function asUnixMs(value: number): UnixMs {
  return Math.max(0, Math.floor(value || Date.now())) as UnixMs;
}

function nowAsUnixMs(now?: number): UnixMs {
  return asUnixMs(now ?? Date.now());
}

function createId(prefix: string): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return `${prefix}_${globalThis.crypto.randomUUID().replace(/-/g, '')}`;
    }
  } catch {
    // ignore
  }

  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function normalizeVisibleChannel(
  channel: ChatVisibleChannel | string | undefined,
  fallback: ChatVisibleChannel,
): ChatVisibleChannel {
  switch (channel) {
    case 'GLOBAL':
    case 'SYNDICATE':
    case 'DEAL_ROOM':
    case 'LOBBY':
      return channel;
    default:
      return fallback;
  }
}

function normalizeChannelFromUnknown(
  channel: ChatChannelId | string | undefined,
  fallback: ChatVisibleChannel,
): ChatVisibleChannel {
  if (channel === 'GLOBAL' || channel === 'SYNDICATE' || channel === 'DEAL_ROOM' || channel === 'LOBBY') {
    return channel;
  }

  return fallback;
}

function toAnchorId(value: ChatMemoryAnchorId | string): ChatMemoryAnchorId {
  return String(value) as ChatMemoryAnchorId;
}

function uniqAnchors(
  anchors: readonly (ChatMemoryAnchorId | string)[],
  limit = CHAT_LEARNING_PROFILE_DEFAULTS.maxMemoryAnchors,
): readonly ChatMemoryAnchorId[] {
  const seen = new Set<string>();
  const next: ChatMemoryAnchorId[] = [];

  for (let index = anchors.length - 1; index >= 0; index -= 1) {
    const raw = String(anchors[index]);
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    next.unshift(raw as ChatMemoryAnchorId);
    if (next.length >= limit) break;
  }

  return Object.freeze(next);
}

function average(values: readonly number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getDominantEmotion(
  vector: ChatEmotionVector,
): ChatLearningProfileRecommendation['strongestEmotion'] {
  const entries = [
    ['INTIMIDATION', vector.intimidation],
    ['CONFIDENCE', vector.confidence],
    ['FRUSTRATION', vector.frustration],
    ['CURIOSITY', vector.curiosity],
    ['ATTACHMENT', vector.attachment],
    ['EMBARRASSMENT', vector.embarrassment],
    ['RELIEF', vector.relief],
    ['DOMINANCE', vector.dominance],
    ['DESPERATION', vector.desperation],
    ['TRUST', vector.trust],
  ] as const;

  let winner = entries[0];

  for (const entry of entries) {
    if (entry[1] > winner[1]) {
      winner = entry;
    }
  }

  return winner[0];
}

function safePersonaScoreRecord(
  source: Readonly<Record<string, number>> | undefined,
  floor: number,
  ceiling: number,
  fallbackIds: readonly string[],
): Readonly<Record<string, Score100>> {
  const next: Record<string, Score100> = {};

  for (const id of fallbackIds) {
    const raw = source?.[id];
    const score = typeof raw === 'number' ? raw : (floor + ceiling) / 2;
    next[id] = asScore100(Math.max(floor, Math.min(ceiling, score)));
  }

  if (source) {
    for (const [key, value] of Object.entries(source)) {
      next[key] = asScore100(Math.max(floor, Math.min(ceiling, value)));
    }
  }

  return Object.freeze(next);
}

function safeChannelAffinityRecord(
  source?: Partial<Record<ChatVisibleChannel, number>>,
): Readonly<Record<ChatVisibleChannel, Score100>> {
  const next: Record<ChatVisibleChannel, Score100> = {
    GLOBAL: asScore100(source?.GLOBAL ?? 50),
    SYNDICATE: asScore100(source?.SYNDICATE ?? 50),
    DEAL_ROOM: asScore100(source?.DEAL_ROOM ?? 50),
    LOBBY: asScore100(source?.LOBBY ?? 50),
  };

  return Object.freeze(next);
}

function createNeutralEmotionBaseline(): ChatEmotionVector {
  return Object.freeze({
    intimidation: asScore100(40),
    confidence: asScore100(48),
    frustration: asScore100(28),
    curiosity: asScore100(56),
    attachment: asScore100(34),
    embarrassment: asScore100(24),
    relief: asScore100(40),
    dominance: asScore100(38),
    desperation: asScore100(18),
    trust: asScore100(46),
  });
}

function createEmotionBaselineFromColdStart(
  coldStart: ChatColdStartProfile,
): ChatEmotionVector {
  const helperBias = coldStart.helperFrequencyBias * 100;
  const haterBias = coldStart.haterAggressionBias * 100;
  const negotiationBias = coldStart.negotiationRiskBias * 100;
  const crowdTolerance = coldStart.crowdHeatTolerance * 100;

  return Object.freeze({
    intimidation: asScore100(24 + haterBias * 0.28 + (100 - crowdTolerance) * 0.08),
    confidence: asScore100(42 + haterBias * 0.16 + crowdTolerance * 0.10),
    frustration: asScore100(18 + negotiationBias * 0.14 + (100 - helperBias) * 0.06),
    curiosity: asScore100(48 + crowdTolerance * 0.10 + (100 - negotiationBias) * 0.06),
    attachment: asScore100(24 + helperBias * 0.24),
    embarrassment: asScore100(16 + (100 - crowdTolerance) * 0.12),
    relief: asScore100(30 + helperBias * 0.18),
    dominance: asScore100(28 + haterBias * 0.20),
    desperation: asScore100(12 + negotiationBias * 0.12),
    trust: asScore100(34 + helperBias * 0.26),
  });
}

function createChannelAffinityFromColdStart(
  coldStart: ChatColdStartProfile,
): Readonly<Record<ChatVisibleChannel, Score100>> {
  const helper = coldStart.helperFrequencyBias * 100;
  const hater = coldStart.haterAggressionBias * 100;
  const negotiation = coldStart.negotiationRiskBias * 100;
  const prefersLowerPressure = coldStart.prefersLowerPressureOpenings;

  return Object.freeze({
    GLOBAL: asScore100(46 + hater * 0.12 - negotiation * 0.06),
    SYNDICATE: asScore100(48 + helper * 0.06 + hater * 0.04),
    DEAL_ROOM: asScore100(38 + negotiation * 0.18 - helper * 0.04),
    LOBBY: asScore100(prefersLowerPressure ? 62 : 48),
  });
}

function createColdStartFromContext(
  context: ChatLearningProfileCreateContext,
): ChatColdStartProfile {
  const provided = context.coldStart;
  if (provided && isChatColdStartProfile(provided)) {
    return provided;
  }

  if (context.legacyProfile) {
    return createChatColdStartProfileFromLegacyCompat(context.legacyProfile, {
      now: context.now,
      playerId: context.playerId,
      featureSnapshot: context.featureSnapshot,
    });
  }

  return createChatColdStartProfile({
    now: context.now,
    playerId: context.playerId,
    featureSnapshot: context.featureSnapshot,
  });
}

export function createChatLearningProfile(
  context: ChatLearningProfileCreateContext = {},
): ChatLearningProfile {
  const createdAt = nowAsUnixMs(context.now);
  const coldStart = createColdStartFromContext(context);
  const emotionBaseline = createEmotionBaselineFromColdStart(coldStart);
  const channelAffinity = createChannelAffinityFromColdStart(coldStart);

  return Object.freeze({
    profileId: context.profileId ?? createId('chat_profile'),
    createdAt,
    updatedAt: createdAt,
    playerId:
      typeof context.playerId === 'string' && context.playerId.length > 0
        ? (context.playerId as ChatUserId)
        : coldStart.playerId,
    coldStart,
    channelAffinity,
    helperTrustByPersona: safePersonaScoreRecord(
      context.helperPersonaSeeds,
      CHAT_LEARNING_PROFILE_DEFAULTS.helperTrustFloor,
      CHAT_LEARNING_PROFILE_DEFAULTS.helperTrustCeiling,
      CHAT_LEARNING_PROFILE_HELPER_SEED_IDS,
    ),
    haterTargetingByPersona: safePersonaScoreRecord(
      context.haterPersonaSeeds,
      CHAT_LEARNING_PROFILE_DEFAULTS.haterTargetFloor,
      CHAT_LEARNING_PROFILE_DEFAULTS.haterTargetCeiling,
      CHAT_LEARNING_PROFILE_HATER_SEED_IDS,
    ),
    emotionBaseline,
    lastTopMemoryAnchors: uniqAnchors(context.initialMemoryAnchors ?? []),
  });
}

export function cloneChatLearningProfile(
  profile: ChatLearningProfile,
): ChatLearningProfile {
  return Object.freeze({
    ...profile,
    coldStart: { ...profile.coldStart },
    channelAffinity: { ...profile.channelAffinity },
    helperTrustByPersona: { ...profile.helperTrustByPersona },
    haterTargetingByPersona: { ...profile.haterTargetingByPersona },
    emotionBaseline: { ...profile.emotionBaseline },
    lastTopMemoryAnchors: [...profile.lastTopMemoryAnchors],
  });
}

export function serializeChatLearningProfile(
  profile: ChatLearningProfile,
): string {
  return JSON.stringify(profile);
}

export function isChatLearningProfile(value: unknown): value is ChatLearningProfile {
  const candidate = value as Partial<ChatLearningProfile> | null;
  return !!candidate &&
    typeof candidate === 'object' &&
    typeof candidate.profileId === 'string' &&
    typeof candidate.createdAt === 'number' &&
    typeof candidate.updatedAt === 'number' &&
    !!candidate.coldStart &&
    isChatColdStartProfile(candidate.coldStart) &&
    !!candidate.channelAffinity &&
    !!candidate.helperTrustByPersona &&
    !!candidate.haterTargetingByPersona &&
    !!candidate.emotionBaseline &&
    Array.isArray(candidate.lastTopMemoryAnchors);
}

export function hydrateChatLearningProfile(
  raw: string | JsonObject | null | undefined,
  context: ChatLearningProfileCreateContext = {},
): ChatLearningProfileHydrationResult {
  const fallback = createChatLearningProfile(context);

  if (raw == null) {
    return { ok: false, reason: 'MISSING_FIELDS', profile: fallback };
  }

  let parsed: unknown = raw;

  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, reason: 'UNPARSABLE', profile: fallback };
    }
  }

  if (!isChatLearningProfile(parsed)) {
    return { ok: false, reason: 'MISSING_FIELDS', profile: fallback };
  }

  const candidate = parsed as ChatLearningProfile;
  const hydratedColdStart = hydrateChatColdStartProfile(candidate.coldStart, {
    now: context.now ?? candidate.createdAt,
    playerId: context.playerId ?? candidate.playerId,
    legacyProfile: context.legacyProfile,
  });

  const channelAffinity = safeChannelAffinityRecord(candidate.channelAffinity);
  const emotionBaseline = normalizeEmotionBaseline(candidate.emotionBaseline);

  if (!emotionBaseline) {
    return { ok: false, reason: 'INVALID_EMOTION_BASELINE', profile: fallback };
  }

  return {
    ok: true,
    reason: 'VALID',
    profile: Object.freeze({
      ...candidate,
      createdAt: asUnixMs(candidate.createdAt),
      updatedAt: asUnixMs(candidate.updatedAt),
      coldStart: hydratedColdStart.profile,
      channelAffinity,
      helperTrustByPersona: safePersonaScoreRecord(
        candidate.helperTrustByPersona,
        CHAT_LEARNING_PROFILE_DEFAULTS.helperTrustFloor,
        CHAT_LEARNING_PROFILE_DEFAULTS.helperTrustCeiling,
        CHAT_LEARNING_PROFILE_HELPER_SEED_IDS,
      ),
      haterTargetingByPersona: safePersonaScoreRecord(
        candidate.haterTargetingByPersona,
        CHAT_LEARNING_PROFILE_DEFAULTS.haterTargetFloor,
        CHAT_LEARNING_PROFILE_DEFAULTS.haterTargetCeiling,
        CHAT_LEARNING_PROFILE_HATER_SEED_IDS,
      ),
      emotionBaseline,
      lastTopMemoryAnchors: uniqAnchors(candidate.lastTopMemoryAnchors),
    }),
  };
}

function normalizeEmotionBaseline(
  value: ChatEmotionVector | null | undefined,
): ChatEmotionVector | null {
  if (!value) return null;

  const keys: Array<keyof ChatEmotionVector> = [
    'intimidation',
    'confidence',
    'frustration',
    'curiosity',
    'attachment',
    'embarrassment',
    'relief',
    'dominance',
    'desperation',
    'trust',
  ];

  for (const key of keys) {
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) {
      return null;
    }
  }

  return Object.freeze({
    intimidation: asScore100(value.intimidation),
    confidence: asScore100(value.confidence),
    frustration: asScore100(value.frustration),
    curiosity: asScore100(value.curiosity),
    attachment: asScore100(value.attachment),
    embarrassment: asScore100(value.embarrassment),
    relief: asScore100(value.relief),
    dominance: asScore100(value.dominance),
    desperation: asScore100(value.desperation),
    trust: asScore100(value.trust),
  });
}

function mapEmotionBaseline(
  current: ChatEmotionVector,
  mapper: (vector: ChatEmotionVector) => ChatEmotionVector,
): ChatEmotionVector {
  return normalizeEmotionBaseline(mapper(current)) ?? current;
}

function incrementRecordScore(
  source: Readonly<Record<string, Score100>>,
  key: string,
  delta: number,
  floor: number,
  ceiling: number,
): Readonly<Record<string, Score100>> {
  const current = source[key] ?? asScore100((floor + ceiling) / 2);
  const next = Math.max(floor, Math.min(ceiling, Number(current) + delta));

  return Object.freeze({
    ...source,
    [key]: asScore100(next),
  });
}

function patchChannelAffinity(
  source: Readonly<Record<ChatVisibleChannel, Score100>>,
  channel: ChatVisibleChannel,
  delta: number,
): Readonly<Record<ChatVisibleChannel, Score100>> {
  const current = source[channel] ?? asScore100(50);
  return Object.freeze({
    ...source,
    [channel]: asScore100(
      Math.max(
        CHAT_LEARNING_PROFILE_DEFAULTS.channelAffinityFloor,
        Math.min(
          CHAT_LEARNING_PROFILE_DEFAULTS.channelAffinityCeiling,
          Number(current) + delta,
        ),
      ),
    ),
  });
}

export function withTouchedChatLearningProfile(
  profile: ChatLearningProfile,
  meta: ChatLearningProfileMutationMeta = {},
): ChatLearningProfile {
  return Object.freeze({
    ...profile,
    updatedAt: nowAsUnixMs(meta.now),
  });
}

export function withChatLearningProfileMemoryAnchors(
  profile: ChatLearningProfile,
  anchors: readonly (ChatMemoryAnchorId | string)[],
  meta: ChatLearningProfileMutationMeta = {},
): ChatLearningProfile {
  return Object.freeze({
    ...profile,
    updatedAt: nowAsUnixMs(meta.now),
    lastTopMemoryAnchors: uniqAnchors([
      ...profile.lastTopMemoryAnchors,
      ...anchors,
    ]),
  });
}

export function withChatLearningProfileEmotionBaseline(
  profile: ChatLearningProfile,
  patch: Partial<Record<keyof ChatEmotionVector, number>>,
  meta: ChatLearningProfileMutationMeta = {},
): ChatLearningProfile {
  const current = profile.emotionBaseline;

  return Object.freeze({
    ...profile,
    updatedAt: nowAsUnixMs(meta.now),
    emotionBaseline: normalizeEmotionBaseline({
      intimidation: patch.intimidation ?? current.intimidation,
      confidence: patch.confidence ?? current.confidence,
      frustration: patch.frustration ?? current.frustration,
      curiosity: patch.curiosity ?? current.curiosity,
      attachment: patch.attachment ?? current.attachment,
      embarrassment: patch.embarrassment ?? current.embarrassment,
      relief: patch.relief ?? current.relief,
      dominance: patch.dominance ?? current.dominance,
      desperation: patch.desperation ?? current.desperation,
      trust: patch.trust ?? current.trust,
    }) ?? current,
  });
}

export function withChatLearningProfileHelperTrust(
  profile: ChatLearningProfile,
  helperPersonaId: string,
  delta = CHAT_LEARNING_PROFILE_DEFAULTS.helperTrustStep,
  meta: ChatLearningProfileMutationMeta = {},
): ChatLearningProfile {
  return Object.freeze({
    ...profile,
    updatedAt: nowAsUnixMs(meta.now),
    helperTrustByPersona: incrementRecordScore(
      profile.helperTrustByPersona,
      helperPersonaId,
      delta,
      CHAT_LEARNING_PROFILE_DEFAULTS.helperTrustFloor,
      CHAT_LEARNING_PROFILE_DEFAULTS.helperTrustCeiling,
    ),
  });
}

export function withChatLearningProfileHaterTargeting(
  profile: ChatLearningProfile,
  haterPersonaId: string,
  delta = CHAT_LEARNING_PROFILE_DEFAULTS.haterTargetStep,
  meta: ChatLearningProfileMutationMeta = {},
): ChatLearningProfile {
  return Object.freeze({
    ...profile,
    updatedAt: nowAsUnixMs(meta.now),
    haterTargetingByPersona: incrementRecordScore(
      profile.haterTargetingByPersona,
      haterPersonaId,
      delta,
      CHAT_LEARNING_PROFILE_DEFAULTS.haterTargetFloor,
      CHAT_LEARNING_PROFILE_DEFAULTS.haterTargetCeiling,
    ),
  });
}

export function withChatLearningProfileChannelAffinity(
  profile: ChatLearningProfile,
  channel: ChatVisibleChannel,
  delta = CHAT_LEARNING_PROFILE_DEFAULTS.affinityStepMinor,
  meta: ChatLearningProfileMutationMeta = {},
): ChatLearningProfile {
  return Object.freeze({
    ...profile,
    updatedAt: nowAsUnixMs(meta.now),
    channelAffinity: patchChannelAffinity(profile.channelAffinity, channel, delta),
  });
}

export function applyFeatureSnapshotToChatLearningProfile(
  profile: ChatLearningProfile,
  featureSnapshot: ChatFeatureSnapshot,
  meta: ChatLearningProfileMutationMeta = {},
): ChatLearningProfile {
  let next = withTouchedChatLearningProfile(profile, meta);

  const activeChannel = normalizeChannelFromUnknown(
    featureSnapshot.activeChannel,
    profile.coldStart.prefersLowerPressureOpenings ? 'LOBBY' : 'GLOBAL',
  );

  next = withChatLearningProfileChannelAffinity(
    next,
    activeChannel,
    featureSnapshot.panelOpen
      ? CHAT_LEARNING_PROFILE_DEFAULTS.affinityStepMajor
      : CHAT_LEARNING_PROFILE_DEFAULTS.affinityStepMinor,
    meta,
  );

  const pressureWeight = clamp100((featureSnapshot.haterHeat ?? 0) * 0.5);
  const silencePenalty = clamp100(featureSnapshot.silenceWindowMs / 200);
  const composerConfidence = clamp100(featureSnapshot.composerLength / 2);

  next = withChatLearningProfileEmotionBaseline(
    next,
    {
      intimidation: clamp100(
        next.emotionBaseline.intimidation + pressureWeight * 0.12,
      ),
      frustration: clamp100(
        next.emotionBaseline.frustration + silencePenalty * 0.10,
      ),
      curiosity: clamp100(
        next.emotionBaseline.curiosity + composerConfidence * 0.08,
      ),
      confidence: clamp100(
        next.emotionBaseline.confidence + composerConfidence * 0.06,
      ),
    },
    meta,
  );

  next = applyAffectSnapshotToChatLearningProfile(next, featureSnapshot.affect, meta);
  next = applyFeatureDropOffSignalsToChatLearningProfile(
    next,
    featureSnapshot.dropOffSignals,
    meta,
  );

  return next;
}

export function applyAffectSnapshotToChatLearningProfile(
  profile: ChatLearningProfile,
  affectSnapshot: ChatAffectSnapshot,
  meta: ChatLearningProfileMutationMeta = {},
): ChatLearningProfile {
  const vector = affectSnapshot.vector;

  return withChatLearningProfileEmotionBaseline(
    profile,
    {
      intimidation: average([profile.emotionBaseline.intimidation, vector.intimidation]),
      confidence: average([profile.emotionBaseline.confidence, vector.confidence]),
      frustration: average([profile.emotionBaseline.frustration, vector.frustration]),
      curiosity: average([profile.emotionBaseline.curiosity, vector.curiosity]),
      attachment: average([profile.emotionBaseline.attachment, vector.attachment]),
      embarrassment: average([
        profile.emotionBaseline.embarrassment,
        vector.embarrassment,
      ]),
      relief: average([profile.emotionBaseline.relief, vector.relief]),
      dominance: average([profile.emotionBaseline.dominance, vector.dominance]),
      desperation: average([
        profile.emotionBaseline.desperation,
        vector.desperation,
      ]),
      trust: average([profile.emotionBaseline.trust, vector.trust]),
    },
    meta,
  );
}

export function applyFeatureDropOffSignalsToChatLearningProfile(
  profile: ChatLearningProfile,
  dropOffSignals: ChatFeatureSnapshot['dropOffSignals'],
  meta: ChatLearningProfileMutationMeta = {},
): ChatLearningProfile {
  const stressPenalty = clamp100(
    dropOffSignals.failedInputCount * 10 +
      dropOffSignals.panelCollapseCount * 8 +
      dropOffSignals.repeatedComposerDeletes * 6 +
      dropOffSignals.channelHopCount * 4 +
      dropOffSignals.negativeEmotionScore * 0.18,
  );

  return withChatLearningProfileEmotionBaseline(
    profile,
    {
      frustration: clamp100(profile.emotionBaseline.frustration + stressPenalty * 0.10),
      intimidation: clamp100(profile.emotionBaseline.intimidation + stressPenalty * 0.06),
      confidence: clamp100(profile.emotionBaseline.confidence - stressPenalty * 0.07),
      trust: clamp100(profile.emotionBaseline.trust + stressPenalty * 0.03),
      desperation: clamp100(profile.emotionBaseline.desperation + stressPenalty * 0.08),
    },
    meta,
  );
}

function extractPayloadString(
  envelope: ChatTelemetryEnvelope,
  key: string,
): string | undefined {
  const value = (envelope.payload as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function extractPayloadNumber(
  envelope: ChatTelemetryEnvelope,
  key: string,
): number | undefined {
  const value = (envelope.payload as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function applyTelemetryEnvelopeToChatLearningProfile(
  profile: ChatLearningProfile,
  envelope: ChatTelemetryEnvelope,
  meta: ChatLearningProfileMutationMeta = {},
): ChatLearningProfile {
  const now = meta.now ?? envelope.occurredAt;
  let next = withTouchedChatLearningProfile(profile, { ...meta, now });

  const explicitChannel = normalizeChannelFromUnknown(
    envelope.channelId,
    next.coldStart.prefersLowerPressureOpenings ? 'LOBBY' : 'GLOBAL',
  );

  switch (envelope.eventName) {
    case 'chat_opened': {
      next = withChatLearningProfileChannelAffinity(
        next,
        explicitChannel,
        CHAT_LEARNING_PROFILE_DEFAULTS.affinityStepMajor,
        { ...meta, now },
      );
      next = withChatLearningProfileEmotionBaseline(
        next,
        {
          curiosity: clamp100(next.emotionBaseline.curiosity + 4),
          trust: clamp100(next.emotionBaseline.trust + 2),
        },
        { ...meta, now },
      );
      break;
    }

    case 'chat_closed': {
      next = withChatLearningProfileEmotionBaseline(
        next,
        {
          relief: clamp100(next.emotionBaseline.relief + 3),
        },
        { ...meta, now },
      );
      break;
    }

    case 'channel_changed': {
      const targetChannel = normalizeChannelFromUnknown(
        extractPayloadString(envelope, 'channelId') ?? envelope.channelId,
        explicitChannel,
      );
      next = withChatLearningProfileChannelAffinity(
        next,
        targetChannel,
        CHAT_LEARNING_PROFILE_DEFAULTS.affinityStepMajor,
        { ...meta, now },
      );
      break;
    }

    case 'message_composed': {
      const composerLength = extractPayloadNumber(envelope, 'composerLength') ?? 0;
      next = withChatLearningProfileEmotionBaseline(
        next,
        {
          curiosity: clamp100(next.emotionBaseline.curiosity + composerLength * 0.03),
          confidence: clamp100(next.emotionBaseline.confidence + composerLength * 0.02),
        },
        { ...meta, now },
      );
      break;
    }

    case 'message_sent': {
      const helperPersonaId = extractPayloadString(envelope, 'helperPersonaId');
      const haterPersonaId = extractPayloadString(envelope, 'haterPersonaId');

      next = withChatLearningProfileChannelAffinity(
        next,
        explicitChannel,
        CHAT_LEARNING_PROFILE_DEFAULTS.affinityStepMinor,
        { ...meta, now },
      );

      next = withChatLearningProfileEmotionBaseline(
        next,
        {
          confidence: clamp100(next.emotionBaseline.confidence + 5),
          dominance: clamp100(next.emotionBaseline.dominance + 3),
          curiosity: clamp100(next.emotionBaseline.curiosity + 2),
        },
        { ...meta, now },
      );

      if (helperPersonaId) {
        next = withChatLearningProfileHelperTrust(next, helperPersonaId, 3, {
          ...meta,
          now,
        });
      }

      if (haterPersonaId) {
        next = withChatLearningProfileHaterTargeting(next, haterPersonaId, 2, {
          ...meta,
          now,
        });
      }
      break;
    }

    case 'message_failed': {
      next = withChatLearningProfileEmotionBaseline(
        next,
        {
          frustration: clamp100(next.emotionBaseline.frustration + 8),
          desperation: clamp100(next.emotionBaseline.desperation + 6),
          confidence: clamp100(next.emotionBaseline.confidence - 7),
        },
        { ...meta, now },
      );
      break;
    }

    case 'message_received': {
      const actorRole = (extractPayloadString(envelope, 'actorRole') ?? '').toUpperCase();
      const actorId = extractPayloadString(envelope, 'actorId');

      if (actorRole.includes('HELPER') && actorId) {
        next = withChatLearningProfileHelperTrust(next, actorId, 5, {
          ...meta,
          now,
        });
        next = withChatLearningProfileEmotionBaseline(
          next,
          {
            trust: clamp100(next.emotionBaseline.trust + 6),
            relief: clamp100(next.emotionBaseline.relief + 4),
            attachment: clamp100(next.emotionBaseline.attachment + 4),
          },
          { ...meta, now },
        );
      } else if (actorRole.includes('HATER') && actorId) {
        next = withChatLearningProfileHaterTargeting(next, actorId, 4, {
          ...meta,
          now,
        });
        next = withChatLearningProfileEmotionBaseline(
          next,
          {
            intimidation: clamp100(next.emotionBaseline.intimidation + 6),
            embarrassment: clamp100(next.emotionBaseline.embarrassment + 4),
          },
          { ...meta, now },
        );
      } else {
        next = withChatLearningProfileEmotionBaseline(
          next,
          {
            curiosity: clamp100(next.emotionBaseline.curiosity + 2),
          },
          { ...meta, now },
        );
      }
      break;
    }

    case 'presence_seen':
    case 'typing_seen': {
      next = withChatLearningProfileEmotionBaseline(
        next,
        {
          curiosity: clamp100(next.emotionBaseline.curiosity + 3),
          intimidation: clamp100(next.emotionBaseline.intimidation + 2),
        },
        { ...meta, now },
      );
      break;
    }

    case 'scene_started': {
      next = withChatLearningProfileEmotionBaseline(
        next,
        {
          curiosity: clamp100(next.emotionBaseline.curiosity + 5),
          trust: clamp100(next.emotionBaseline.trust + 1),
        },
        { ...meta, now },
      );
      break;
    }

    case 'scene_completed': {
      next = withChatLearningProfileEmotionBaseline(
        next,
        {
          relief: clamp100(next.emotionBaseline.relief + 5),
          confidence: clamp100(next.emotionBaseline.confidence + 4),
        },
        { ...meta, now },
      );
      break;
    }

    case 'rescue_prompted': {
      const helperPersonaId = extractPayloadString(envelope, 'helperPersonaId');
      if (helperPersonaId) {
        next = withChatLearningProfileHelperTrust(next, helperPersonaId, 7, {
          ...meta,
          now,
        });
      }
      next = withChatLearningProfileEmotionBaseline(
        next,
        {
          trust: clamp100(next.emotionBaseline.trust + 7),
          attachment: clamp100(next.emotionBaseline.attachment + 5),
          desperation: clamp100(next.emotionBaseline.desperation + 2),
        },
        { ...meta, now },
      );
      break;
    }

    case 'negotiation_offer_seen': {
      next = withChatLearningProfileChannelAffinity(
        next,
        'DEAL_ROOM',
        CHAT_LEARNING_PROFILE_DEFAULTS.affinityStepMinor,
        { ...meta, now },
      );
      next = withChatLearningProfileEmotionBaseline(
        next,
        {
          curiosity: clamp100(next.emotionBaseline.curiosity + 4),
          intimidation: clamp100(next.emotionBaseline.intimidation + 2),
        },
        { ...meta, now },
      );
      break;
    }

    case 'legend_moment_seen': {
      const anchorId = extractPayloadString(envelope, 'memoryAnchorId');
      if (anchorId) {
        next = withChatLearningProfileMemoryAnchors(next, [anchorId], {
          ...meta,
          now,
        });
      }
      next = withChatLearningProfileEmotionBaseline(
        next,
        {
          confidence: clamp100(next.emotionBaseline.confidence + 9),
          dominance: clamp100(next.emotionBaseline.dominance + 6),
          relief: clamp100(next.emotionBaseline.relief + 4),
        },
        { ...meta, now },
      );
      break;
    }

    case 'world_event_seen': {
      next = withChatLearningProfileEmotionBaseline(
        next,
        {
          curiosity: clamp100(next.emotionBaseline.curiosity + 5),
          intimidation: clamp100(next.emotionBaseline.intimidation + 3),
        },
        { ...meta, now },
      );
      break;
    }

    default:
      break;
  }

  return next;
}

export function createChatLearningProfileFromLegacyCompat(
  legacyProfile: Partial<LegacyPlayerLearningProfileCompat>,
  context: Omit<ChatLearningProfileCreateContext, 'legacyProfile' | 'coldStart'> = {},
): ChatLearningProfile {
  const coldStart = createChatColdStartProfileFromLegacyCompat(legacyProfile, {
    now: context.now ?? legacyProfile.updatedAt ?? legacyProfile.firstSeenAt,
    playerId: context.playerId ?? legacyProfile.playerId,
    featureSnapshot: context.featureSnapshot,
  });

  let profile = createChatLearningProfile({
    ...context,
    playerId: context.playerId ?? legacyProfile.playerId,
    coldStart,
  });

  const avgSovereigntyRate = clamp01(legacyProfile.avgSovereigntyRate ?? 0.10);
  const preferredAggressionLevel = clamp01(
    legacyProfile.preferredAggressionLevel ?? 0.40,
  );
  const helpSeekRate = clamp01(legacyProfile.helpSeekRate ?? 0.18);
  const silenceRate = clamp01(legacyProfile.silenceRate ?? 0.38);

  profile = withChatLearningProfileEmotionBaseline(
    profile,
    {
      confidence: clamp100(42 + avgSovereigntyRate * 40),
      intimidation: clamp100(22 + preferredAggressionLevel * 26),
      trust: clamp100(36 + helpSeekRate * 34),
      frustration: clamp100(20 + silenceRate * 24),
    },
    { now: context.now },
  );

  profile = Object.freeze({
    ...profile,
    helperTrustByPersona: safePersonaScoreRecord(
      {
        MENTOR: 60 + helpSeekRate * 20,
        INSIDER: 50 + avgSovereigntyRate * 10,
        SURVIVOR: 52 + silenceRate * 12,
        RIVAL: 45 + (legacyProfile.flexRate ?? 0.08) * 16,
        ARCHIVIST: 42 + (legacyProfile.chatOpenRatio ?? 0.30) * 12,
      },
      CHAT_LEARNING_PROFILE_DEFAULTS.helperTrustFloor,
      CHAT_LEARNING_PROFILE_DEFAULTS.helperTrustCeiling,
      CHAT_LEARNING_PROFILE_HELPER_SEED_IDS,
    ),
    haterTargetingByPersona: safePersonaScoreRecord(
      {
        BOT_01_LIQUIDATOR: 48 + (legacyProfile.angerRate ?? 0.10) * 18,
        BOT_02_BUREAUCRAT: 44 + (legacyProfile.helpSeekRate ?? 0.18) * 10,
        BOT_03_MANIPULATOR: 50 + (legacyProfile.trollRate ?? 0.10) * 20,
        BOT_04_CRASH_PROPHET: 46 + (legacyProfile.silenceRate ?? 0.38) * 10,
        BOT_05_LEGACY_HEIR: 42 + (legacyProfile.flexRate ?? 0.08) * 18,
      },
      CHAT_LEARNING_PROFILE_DEFAULTS.haterTargetFloor,
      CHAT_LEARNING_PROFILE_DEFAULTS.haterTargetCeiling,
      CHAT_LEARNING_PROFILE_HATER_SEED_IDS,
    ),
  });

  return profile;
}

export function mergeAuthoritativeChatLearningProfile(
  localProfile: ChatLearningProfile,
  authoritativeProfile: Partial<ChatLearningProfile>,
  meta: ChatLearningProfileMutationMeta = {},
): ChatLearningProfile {
  const now = nowAsUnixMs(meta.now);

  const authoritativeColdStart = authoritativeProfile.coldStart
    ? hydrateChatColdStartProfile(authoritativeProfile.coldStart, {
        now,
        playerId: authoritativeProfile.playerId ?? localProfile.playerId,
      }).profile
    : localProfile.coldStart;

  const merged = {
    ...localProfile,
    ...authoritativeProfile,
    updatedAt: now,
    createdAt: authoritativeProfile.createdAt
      ? asUnixMs(authoritativeProfile.createdAt)
      : localProfile.createdAt,
    coldStart: mergeChatColdStartProfiles(
      localProfile.coldStart,
      authoritativeColdStart,
    ),
    channelAffinity: safeChannelAffinityRecord({
      GLOBAL:
        (authoritativeProfile.channelAffinity?.GLOBAL as number | undefined) ??
        localProfile.channelAffinity.GLOBAL,
      SYNDICATE:
        (authoritativeProfile.channelAffinity?.SYNDICATE as number | undefined) ??
        localProfile.channelAffinity.SYNDICATE,
      DEAL_ROOM:
        (authoritativeProfile.channelAffinity?.DEAL_ROOM as number | undefined) ??
        localProfile.channelAffinity.DEAL_ROOM,
      LOBBY:
        (authoritativeProfile.channelAffinity?.LOBBY as number | undefined) ??
        localProfile.channelAffinity.LOBBY,
    }),
    helperTrustByPersona: safePersonaScoreRecord(
      {
        ...localProfile.helperTrustByPersona,
        ...authoritativeProfile.helperTrustByPersona,
      },
      CHAT_LEARNING_PROFILE_DEFAULTS.helperTrustFloor,
      CHAT_LEARNING_PROFILE_DEFAULTS.helperTrustCeiling,
      CHAT_LEARNING_PROFILE_HELPER_SEED_IDS,
    ),
    haterTargetingByPersona: safePersonaScoreRecord(
      {
        ...localProfile.haterTargetingByPersona,
        ...authoritativeProfile.haterTargetingByPersona,
      },
      CHAT_LEARNING_PROFILE_DEFAULTS.haterTargetFloor,
      CHAT_LEARNING_PROFILE_DEFAULTS.haterTargetCeiling,
      CHAT_LEARNING_PROFILE_HATER_SEED_IDS,
    ),
    emotionBaseline:
      normalizeEmotionBaseline(authoritativeProfile.emotionBaseline) ??
      localProfile.emotionBaseline,
    lastTopMemoryAnchors: uniqAnchors([
      ...localProfile.lastTopMemoryAnchors,
      ...(authoritativeProfile.lastTopMemoryAnchors ?? []),
    ]),
  } satisfies ChatLearningProfile;

  return Object.freeze(merged);
}

export function createChatLearningProfileRecommendation(
  profile: ChatLearningProfile,
): ChatLearningProfileRecommendation {
  const channelEntries = Object.entries(profile.channelAffinity) as Array<
    [ChatVisibleChannel, Score100]
  >;

  let recommendedChannel: ChatVisibleChannel = channelEntries[0][0];
  let recommendedChannelScore = Number(channelEntries[0][1]);

  for (const [channel, score] of channelEntries) {
    if (Number(score) > recommendedChannelScore) {
      recommendedChannel = channel;
      recommendedChannelScore = Number(score);
    }
  }

  const helperEntries = Object.entries(profile.helperTrustByPersona);
  const haterEntries = Object.entries(profile.haterTargetingByPersona);

  const [helperPersonaId = '', helperTrustRaw = asScore100(50)] = helperEntries.sort(
    (a, b) => Number(b[1]) - Number(a[1]),
  )[0] ?? [];

  const [haterPersonaId = '', haterTargetRaw = asScore100(50)] = haterEntries.sort(
    (a, b) => Number(b[1]) - Number(a[1]),
  )[0] ?? [];

  const strongestEmotion = getDominantEmotion(profile.emotionBaseline);
  const coldStartRecommendation = createChatColdStartRecommendation(profile.coldStart, {
    playerId: profile.playerId,
  });

  const explanation = [
    `channel:${recommendedChannel}`,
    `helper:${helperPersonaId || 'none'}:${Number(helperTrustRaw).toFixed(0)}`,
    `hater:${haterPersonaId || 'none'}:${Number(haterTargetRaw).toFixed(0)}`,
    `emotion:${strongestEmotion}`,
    `cold:${coldStartRecommendation.explanation}`,
  ].join(' | ');

  return Object.freeze({
    recommendedChannel,
    helperPersonaId: helperPersonaId || undefined,
    helperTrustScore: asScore100(Number(helperTrustRaw)),
    haterPersonaId: haterPersonaId || undefined,
    haterTargetScore: asScore100(Number(haterTargetRaw)),
    strongestEmotion,
    coldStartRecommendation,
    explanation,
  });
}

export const CHAT_LEARNING_PROFILE_README = Object.freeze({
  importPath: '/pzo-web/src/engines/chat/intelligence/ChatLearningProfile',
  primaryExports: Object.freeze([
    'createChatLearningProfile',
    'hydrateChatLearningProfile',
    'applyFeatureSnapshotToChatLearningProfile',
    'applyTelemetryEnvelopeToChatLearningProfile',
    'createChatLearningProfileFromLegacyCompat',
    'mergeAuthoritativeChatLearningProfile',
    'createChatLearningProfileRecommendation',
  ] as const),
  compileSafe: true,
  dependsOnFutureMlModules: false,
  dependsOnFutureDlModules: false,
  coldStartDependencyVersion: CHAT_COLD_START_PROFILE_VERSION,
} as const);