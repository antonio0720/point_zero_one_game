// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/intelligence/ChatColdStartProfile.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT COLD-START PROFILE
 * FILE: pzo-web/src/engines/chat/intelligence/ChatColdStartProfile.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Compile-safe constructor, upgrader, normalizer, and scoring surface for the
 * frontend chat cold-start lane.
 *
 * This module turns the contract-only `ChatColdStartProfile` shape from
 * `../types` into a real runtime authority for first-run personalization.
 *
 * It deliberately preserves the best parts of the older donor logic:
 * - conservative first contact,
 * - strong helper presence for uncertain or quiet players,
 * - adaptive hater aggression based on observed tolerance signals,
 * - cautious negotiation risk defaults,
 * - crowd heat tolerance as a real bias axis,
 * - lower-pressure openings when player signals warrant it.
 *
 * Frontend doctrine
 * -----------------
 * - Cold start exists before any durable backend learning profile returns.
 * - The client may seed and personalize immediately.
 * - The backend remains final authority for long-term truth.
 * - This file must remain compile-safe even if future ML/DL files do not exist.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import type {
  ChatAffectSnapshot,
  ChatColdStartProfile as ChatColdStartProfileContract,
  ChatDropOffSignals,
  ChatFeatureSnapshot,
  ChatUserId,
  ChatVisibleChannel,
  JsonObject,
  Score01,
  UnixMs,
} from '../types';

export type ChatColdStartProfile = ChatColdStartProfileContract;

export interface LegacyPlayerLearningProfileCompat {
  readonly playerId: string;
  readonly firstSeenAt?: number;
  readonly totalRuns?: number;
  readonly totalMessages?: number;
  readonly totalBotInteractions?: number;
  readonly angerRate?: number;
  readonly trollRate?: number;
  readonly helpSeekRate?: number;
  readonly flexRate?: number;
  readonly silenceRate?: number;
  readonly avgMessagesPerRun?: number;
  readonly avgResponseTimeMs?: number;
  readonly chatOpenRatio?: number;
  readonly avgSovereigntyRate?: number;
  readonly preferredAggressionLevel?: number;
  readonly churnRiskBaseline?: number;
  readonly updatedAt?: number;
}

export interface ChatColdStartBiasVector {
  readonly helperFrequencyBias: number;
  readonly haterAggressionBias: number;
  readonly negotiationRiskBias: number;
  readonly crowdHeatTolerance: number;
  readonly prefersLowerPressureOpenings: boolean;
}

export interface ChatColdStartSeedContext {
  readonly now?: number;
  readonly version?: string;
  readonly playerId?: ChatUserId | string;
  readonly activeChannel?: ChatVisibleChannel;
  readonly featureSnapshot?: ChatFeatureSnapshot;
  readonly affectSnapshot?: ChatAffectSnapshot;
  readonly dropOffSignals?: ChatDropOffSignals;
  readonly legacyProfile?: Partial<LegacyPlayerLearningProfileCompat>;
  readonly hints?: Partial<ChatColdStartBiasVector>;
}

export interface ChatColdStartHeuristicSnapshot {
  readonly quietRisk01: number;
  readonly frustrationPressure01: number;
  readonly helperNeed01: number;
  readonly haterTolerance01: number;
  readonly negotiationGuard01: number;
  readonly crowdStress01: number;
}

export interface ChatColdStartProfileHydrationResult {
  readonly ok: boolean;
  readonly reason:
    | 'VALID'
    | 'UNPARSABLE'
    | 'MISSING_FIELDS'
    | 'INVALID_BIAS'
    | 'UNSUPPORTED_VERSION';
  readonly profile: ChatColdStartProfile;
}

export interface ChatColdStartRecommendation {
  readonly openingChannel: ChatVisibleChannel;
  readonly helperCadence01: number;
  readonly haterCadence01: number;
  readonly negotiationGuard01: number;
  readonly respectSilenceFirst: boolean;
  readonly explanation: string;
}

export const CHAT_COLD_START_PROFILE_MODULE_NAME =
  'PZO_CHAT_COLD_START_PROFILE' as const;

export const CHAT_COLD_START_PROFILE_VERSION =
  '2026.03.13-cold-start.v1' as const;

export const CHAT_COLD_START_RUNTIME_LAWS = Object.freeze([
  'Cold-start defaults must feel safe, not sterile.',
  'Helper presence rises when player uncertainty rises.',
  'Hater aggression should be earned by tolerance, not assumed by default.',
  'Deal-room risk should be guarded early until behavior proves otherwise.',
  'Crowd heat tolerance is separate from aggression tolerance.',
  'Silence can mean caution, overwhelm, or deliberate observation.',
  'Lower-pressure openings remain valid even for strong players on first contact.',
  'Cold-start profiles must be mergeable with backend authority later.',
] as const);

export const CHAT_COLD_START_DEFAULTS = Object.freeze({
  helperFrequencyBias: 0.64,
  haterAggressionBias: 0.34,
  negotiationRiskBias: 0.48,
  crowdHeatTolerance: 0.42,
  prefersLowerPressureOpenings: true,
} as const);

export const CHAT_COLD_START_MINIMUMS = Object.freeze({
  helperFrequencyBias: 0.12,
  haterAggressionBias: 0.10,
  negotiationRiskBias: 0.10,
  crowdHeatTolerance: 0.08,
} as const);

export const CHAT_COLD_START_MAXIMUMS = Object.freeze({
  helperFrequencyBias: 0.95,
  haterAggressionBias: 0.92,
  negotiationRiskBias: 0.92,
  crowdHeatTolerance: 0.96,
} as const);

export const CHAT_COLD_START_COMPAT_README = Object.freeze({
  donorSignals: Object.freeze([
    'preferredAggressionLevel',
    'helpSeekRate',
    'trollRate',
    'flexRate',
    'angerRate',
    'silenceRate',
    'chatOpenRatio',
    'avgSovereigntyRate',
    'churnRiskBaseline',
  ] as const),
  targetBiases: Object.freeze([
    'helperFrequencyBias',
    'haterAggressionBias',
    'negotiationRiskBias',
    'crowdHeatTolerance',
    'prefersLowerPressureOpenings',
  ] as const),
} as const);

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function asScore01(value: number): Score01 {
  return clamp01(value) as Score01;
}

function asUnixMs(value: number): UnixMs {
  return Math.max(0, Math.floor(value || Date.now())) as UnixMs;
}

function safeNow(now?: number): UnixMs {
  return asUnixMs(now ?? Date.now());
}

function safeRate(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return clamp01(value);
}

function lerp01(current: number, next: number, alpha: number): number {
  return clamp01(current + (next - current) * clamp01(alpha));
}

function channelFromHint(
  channel: ChatVisibleChannel | undefined,
  fallback: ChatVisibleChannel,
): ChatVisibleChannel {
  if (!channel) return fallback;
  if (
    channel === 'GLOBAL' ||
    channel === 'SYNDICATE' ||
    channel === 'DEAL_ROOM' ||
    channel === 'LOBBY'
  ) {
    return channel;
  }

  return fallback;
}

function scorePressureTier(featureSnapshot?: ChatFeatureSnapshot): number {
  const tier = featureSnapshot?.pressureTier;

  switch (tier) {
    case 'CALM':
      return 0.12;
    case 'BUILDING':
      return 0.30;
    case 'ELEVATED':
      return 0.55;
    case 'HIGH':
      return 0.75;
    case 'CRITICAL':
      return 0.92;
    default:
      return 0.28;
  }
}

function scoreTickTier(featureSnapshot?: ChatFeatureSnapshot): number {
  const tier = featureSnapshot?.tickTier;

  switch (tier) {
    case 'SOVEREIGN':
      return 0.12;
    case 'STABLE':
      return 0.28;
    case 'COMPRESSED':
      return 0.54;
    case 'CRISIS':
      return 0.76;
    case 'COLLAPSE_IMMINENT':
      return 0.95;
    default:
      return 0.34;
  }
}

function scoreDropOffSignals(dropOffSignals?: ChatDropOffSignals): number {
  if (!dropOffSignals) return 0;

  const silence = clamp01(dropOffSignals.silenceAfterCollapseMs / 20_000);
  const composerDeletes = clamp01(dropOffSignals.repeatedComposerDeletes / 8);
  const panelCollapse = clamp01(dropOffSignals.panelCollapseCount / 6);
  const channelHop = clamp01(dropOffSignals.channelHopCount / 10);
  const failedInput = clamp01(dropOffSignals.failedInputCount / 5);
  const negativeEmotion = clamp01((dropOffSignals.negativeEmotionScore ?? 0) / 100);

  return clamp01(
    silence * 0.28 +
      composerDeletes * 0.16 +
      panelCollapse * 0.12 +
      channelHop * 0.12 +
      failedInput * 0.18 +
      negativeEmotion * 0.14,
  );
}

function scoreAffect(affectSnapshot?: ChatAffectSnapshot): number {
  if (!affectSnapshot) return 0;

  const vector = affectSnapshot.vector;
  return clamp01(
    (vector.frustration / 100) * 0.28 +
      (vector.intimidation / 100) * 0.22 +
      (vector.embarrassment / 100) * 0.18 +
      (vector.desperation / 100) * 0.18 +
      (vector.relief / 100) * 0.04 +
      (vector.trust / 100) * -0.08,
  );
}

export function computeChatColdStartHeuristics(
  context: ChatColdStartSeedContext = {},
): ChatColdStartHeuristicSnapshot {
  const featureSnapshot = context.featureSnapshot;
  const affectSnapshot = context.affectSnapshot ?? featureSnapshot?.affect;
  const dropOffSignals = context.dropOffSignals ?? featureSnapshot?.dropOffSignals;
  const legacy = context.legacyProfile;

  const quietRisk01 = clamp01(
    safeRate(legacy?.silenceRate, 0.38) * 0.55 +
      safeRate(legacy?.chatOpenRatio ? 1 - legacy.chatOpenRatio : undefined, 0.32) *
        0.25 +
      scoreDropOffSignals(dropOffSignals) * 0.20,
  );

  const frustrationPressure01 = clamp01(
    scoreAffect(affectSnapshot) * 0.42 +
      scorePressureTier(featureSnapshot) * 0.20 +
      scoreTickTier(featureSnapshot) * 0.18 +
      scoreDropOffSignals(dropOffSignals) * 0.20,
  );

  const helperNeed01 = clamp01(
    quietRisk01 * 0.26 +
      frustrationPressure01 * 0.28 +
      safeRate(legacy?.helpSeekRate, 0.18) * 0.22 +
      safeRate(legacy?.churnRiskBaseline, 0.40) * 0.12 +
      safeRate(legacy?.angerRate, 0.10) * 0.12,
  );

  const haterTolerance01 = clamp01(
    safeRate(legacy?.preferredAggressionLevel, 0.40) * 0.40 +
      safeRate(legacy?.trollRate, 0.10) * 0.20 +
      safeRate(legacy?.flexRate, 0.08) * 0.14 +
      safeRate(legacy?.avgSovereigntyRate, 0.10) * 0.16 +
      safeRate(legacy?.angerRate, 0.06) * -0.10,
  );

  const negotiationGuard01 = clamp01(
    scoreDropOffSignals(dropOffSignals) * 0.22 +
      safeRate(legacy?.churnRiskBaseline, 0.40) * 0.18 +
      safeRate(legacy?.helpSeekRate, 0.18) * 0.14 +
      safeRate(legacy?.flexRate, 0.08) * -0.08 +
      safeRate(legacy?.avgSovereigntyRate, 0.10) * -0.08 +
      scorePressureTier(featureSnapshot) * 0.18 +
      scoreTickTier(featureSnapshot) * 0.14 +
      scoreAffect(affectSnapshot) * 0.30,
  );

  const crowdStress01 = clamp01(
    clamp01((featureSnapshot?.haterHeat ?? 0) / 100) * 0.36 +
      scoreAffect(affectSnapshot) * 0.24 +
      scorePressureTier(featureSnapshot) * 0.20 +
      safeRate(legacy?.chatOpenRatio, 0.30) * -0.05 +
      scoreDropOffSignals(dropOffSignals) * 0.25,
  );

  return Object.freeze({
    quietRisk01,
    frustrationPressure01,
    helperNeed01,
    haterTolerance01,
    negotiationGuard01,
    crowdStress01,
  });
}

export function createDefaultChatColdStartBiases(): ChatColdStartBiasVector {
  return Object.freeze({
    helperFrequencyBias: CHAT_COLD_START_DEFAULTS.helperFrequencyBias,
    haterAggressionBias: CHAT_COLD_START_DEFAULTS.haterAggressionBias,
    negotiationRiskBias: CHAT_COLD_START_DEFAULTS.negotiationRiskBias,
    crowdHeatTolerance: CHAT_COLD_START_DEFAULTS.crowdHeatTolerance,
    prefersLowerPressureOpenings:
      CHAT_COLD_START_DEFAULTS.prefersLowerPressureOpenings,
  });
}

export function deriveChatColdStartBiasesFromLegacyProfile(
  legacyProfile?: Partial<LegacyPlayerLearningProfileCompat>,
): ChatColdStartBiasVector {
  if (!legacyProfile) {
    return createDefaultChatColdStartBiases();
  }

  const helpSeekRate = safeRate(legacyProfile.helpSeekRate, 0.18);
  const angerRate = safeRate(legacyProfile.angerRate, 0.10);
  const trollRate = safeRate(legacyProfile.trollRate, 0.10);
  const flexRate = safeRate(legacyProfile.flexRate, 0.08);
  const silenceRate = safeRate(legacyProfile.silenceRate, 0.38);
  const chatOpenRatio = safeRate(legacyProfile.chatOpenRatio, 0.30);
  const avgSovereigntyRate = safeRate(legacyProfile.avgSovereigntyRate, 0.10);
  const preferredAggressionLevel = safeRate(
    legacyProfile.preferredAggressionLevel,
    0.40,
  );
  const churnRiskBaseline = safeRate(legacyProfile.churnRiskBaseline, 0.40);

  const helperFrequencyBias = clamp01(
    0.48 +
      helpSeekRate * 0.22 +
      silenceRate * 0.16 +
      churnRiskBaseline * 0.10 +
      angerRate * 0.08 -
      trollRate * 0.08 -
      flexRate * 0.04,
  );

  const haterAggressionBias = clamp01(
    0.22 +
      preferredAggressionLevel * 0.34 +
      trollRate * 0.18 +
      flexRate * 0.12 +
      avgSovereigntyRate * 0.10 -
      helpSeekRate * 0.08 -
      angerRate * 0.06 -
      silenceRate * 0.04,
  );

  const negotiationRiskBias = clamp01(
    0.40 +
      churnRiskBaseline * 0.16 +
      angerRate * 0.10 +
      silenceRate * 0.08 +
      helpSeekRate * 0.10 -
      avgSovereigntyRate * 0.10 -
      flexRate * 0.04,
  );

  const crowdHeatTolerance = clamp01(
    0.24 +
      preferredAggressionLevel * 0.20 +
      trollRate * 0.12 +
      avgSovereigntyRate * 0.16 +
      chatOpenRatio * 0.12 -
      helpSeekRate * 0.10 -
      silenceRate * 0.08,
  );

  const prefersLowerPressureOpenings =
    silenceRate >= 0.46 ||
    helpSeekRate >= 0.30 ||
    churnRiskBaseline >= 0.58 ||
    preferredAggressionLevel <= 0.35;

  return Object.freeze({
    helperFrequencyBias,
    haterAggressionBias,
    negotiationRiskBias,
    crowdHeatTolerance,
    prefersLowerPressureOpenings,
  });
}

export function deriveChatColdStartBiasesFromFeatureSnapshot(
  featureSnapshot?: ChatFeatureSnapshot,
): ChatColdStartBiasVector {
  if (!featureSnapshot) {
    return createDefaultChatColdStartBiases();
  }

  const affect = scoreAffect(featureSnapshot.affect);
  const dropOff = scoreDropOffSignals(featureSnapshot.dropOffSignals);
  const pressure = scorePressureTier(featureSnapshot);
  const tick = scoreTickTier(featureSnapshot);
  const visibleDensity = clamp01(featureSnapshot.visibleMessageCount / 40);
  const silenceWindow = clamp01(featureSnapshot.silenceWindowMs / 20_000);
  const composerLength = clamp01(featureSnapshot.composerLength / 180);
  const haterHeat = clamp01((featureSnapshot.haterHeat ?? 0) / 100);

  const helperFrequencyBias = clamp01(
    0.46 + affect * 0.16 + dropOff * 0.20 + silenceWindow * 0.08 + pressure * 0.10,
  );

  const haterAggressionBias = clamp01(
    0.18 + visibleDensity * 0.10 + composerLength * 0.06 + haterHeat * 0.18 - dropOff * 0.12,
  );

  const negotiationRiskBias = clamp01(
    0.38 + pressure * 0.10 + tick * 0.10 + dropOff * 0.12 + affect * 0.10,
  );

  const crowdHeatTolerance = clamp01(
    0.30 + visibleDensity * 0.12 + haterHeat * 0.22 - affect * 0.08 - dropOff * 0.06,
  );

  const prefersLowerPressureOpenings =
    pressure >= 0.55 || tick >= 0.55 || dropOff >= 0.42 || affect >= 0.45;

  return Object.freeze({
    helperFrequencyBias,
    haterAggressionBias,
    negotiationRiskBias,
    crowdHeatTolerance,
    prefersLowerPressureOpenings,
  });
}

export function mergeChatColdStartBiasVectors(
  ...vectors: ReadonlyArray<Partial<ChatColdStartBiasVector> | undefined>
): ChatColdStartBiasVector {
  let helperFrequencyBias = CHAT_COLD_START_DEFAULTS.helperFrequencyBias;
  let haterAggressionBias = CHAT_COLD_START_DEFAULTS.haterAggressionBias;
  let negotiationRiskBias = CHAT_COLD_START_DEFAULTS.negotiationRiskBias;
  let crowdHeatTolerance = CHAT_COLD_START_DEFAULTS.crowdHeatTolerance;
  let prefersLowerPressureOpenings =
    CHAT_COLD_START_DEFAULTS.prefersLowerPressureOpenings;

  for (const vector of vectors) {
    if (!vector) continue;

    if (typeof vector.helperFrequencyBias === 'number') {
      helperFrequencyBias = lerp01(helperFrequencyBias, vector.helperFrequencyBias, 0.50);
    }
    if (typeof vector.haterAggressionBias === 'number') {
      haterAggressionBias = lerp01(haterAggressionBias, vector.haterAggressionBias, 0.50);
    }
    if (typeof vector.negotiationRiskBias === 'number') {
      negotiationRiskBias = lerp01(negotiationRiskBias, vector.negotiationRiskBias, 0.50);
    }
    if (typeof vector.crowdHeatTolerance === 'number') {
      crowdHeatTolerance = lerp01(crowdHeatTolerance, vector.crowdHeatTolerance, 0.50);
    }
    if (typeof vector.prefersLowerPressureOpenings === 'boolean') {
      prefersLowerPressureOpenings =
        prefersLowerPressureOpenings || vector.prefersLowerPressureOpenings;
    }
  }

  return Object.freeze({
    helperFrequencyBias: clamp01(helperFrequencyBias),
    haterAggressionBias: clamp01(haterAggressionBias),
    negotiationRiskBias: clamp01(negotiationRiskBias),
    crowdHeatTolerance: clamp01(crowdHeatTolerance),
    prefersLowerPressureOpenings,
  });
}

export function createChatColdStartProfile(
  context: ChatColdStartSeedContext = {},
): ChatColdStartProfile {
  const createdAt = safeNow(context.now);
  const legacyBiases = deriveChatColdStartBiasesFromLegacyProfile(
    context.legacyProfile,
  );
  const featureBiases = deriveChatColdStartBiasesFromFeatureSnapshot(
    context.featureSnapshot,
  );
  const mergedBiases = mergeChatColdStartBiasVectors(
    createDefaultChatColdStartBiases(),
    legacyBiases,
    featureBiases,
    context.hints,
  );

  return Object.freeze({
    version: context.version ?? CHAT_COLD_START_PROFILE_VERSION,
    createdAt,
    playerId:
      typeof context.playerId === 'string' && context.playerId.length > 0
        ? (context.playerId as ChatUserId)
        : undefined,
    helperFrequencyBias: asScore01(
      Math.max(
        CHAT_COLD_START_MINIMUMS.helperFrequencyBias,
        Math.min(
          CHAT_COLD_START_MAXIMUMS.helperFrequencyBias,
          mergedBiases.helperFrequencyBias,
        ),
      ),
    ),
    haterAggressionBias: asScore01(
      Math.max(
        CHAT_COLD_START_MINIMUMS.haterAggressionBias,
        Math.min(
          CHAT_COLD_START_MAXIMUMS.haterAggressionBias,
          mergedBiases.haterAggressionBias,
        ),
      ),
    ),
    negotiationRiskBias: asScore01(
      Math.max(
        CHAT_COLD_START_MINIMUMS.negotiationRiskBias,
        Math.min(
          CHAT_COLD_START_MAXIMUMS.negotiationRiskBias,
          mergedBiases.negotiationRiskBias,
        ),
      ),
    ),
    crowdHeatTolerance: asScore01(
      Math.max(
        CHAT_COLD_START_MINIMUMS.crowdHeatTolerance,
        Math.min(
          CHAT_COLD_START_MAXIMUMS.crowdHeatTolerance,
          mergedBiases.crowdHeatTolerance,
        ),
      ),
    ),
    prefersLowerPressureOpenings: mergedBiases.prefersLowerPressureOpenings,
  });
}

export function cloneChatColdStartProfile(
  profile: ChatColdStartProfile,
): ChatColdStartProfile {
  return Object.freeze({ ...profile });
}

export function serializeChatColdStartProfile(
  profile: ChatColdStartProfile,
): string {
  return JSON.stringify(profile);
}

export function isChatColdStartProfile(value: unknown): value is ChatColdStartProfile {
  const candidate = value as Partial<ChatColdStartProfile> | null;
  return !!candidate &&
    typeof candidate === 'object' &&
    typeof candidate.version === 'string' &&
    typeof candidate.createdAt === 'number' &&
    typeof candidate.helperFrequencyBias === 'number' &&
    typeof candidate.haterAggressionBias === 'number' &&
    typeof candidate.negotiationRiskBias === 'number' &&
    typeof candidate.crowdHeatTolerance === 'number' &&
    typeof candidate.prefersLowerPressureOpenings === 'boolean';
}

export function hydrateChatColdStartProfile(
  raw: string | JsonObject | null | undefined,
  fallbackContext: ChatColdStartSeedContext = {},
): ChatColdStartProfileHydrationResult {
  const fallback = createChatColdStartProfile(fallbackContext);

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

  if (!isChatColdStartProfile(parsed)) {
    return { ok: false, reason: 'MISSING_FIELDS', profile: fallback };
  }

  const candidate = parsed as ChatColdStartProfile;

  if (
    candidate.helperFrequencyBias < 0 ||
    candidate.helperFrequencyBias > 1 ||
    candidate.haterAggressionBias < 0 ||
    candidate.haterAggressionBias > 1 ||
    candidate.negotiationRiskBias < 0 ||
    candidate.negotiationRiskBias > 1 ||
    candidate.crowdHeatTolerance < 0 ||
    candidate.crowdHeatTolerance > 1
  ) {
    return { ok: false, reason: 'INVALID_BIAS', profile: fallback };
  }

  if (typeof candidate.version !== 'string' || candidate.version.length === 0) {
    return { ok: false, reason: 'UNSUPPORTED_VERSION', profile: fallback };
  }

  return {
    ok: true,
    reason: 'VALID',
    profile: Object.freeze({
      ...candidate,
      helperFrequencyBias: asScore01(candidate.helperFrequencyBias),
      haterAggressionBias: asScore01(candidate.haterAggressionBias),
      negotiationRiskBias: asScore01(candidate.negotiationRiskBias),
      crowdHeatTolerance: asScore01(candidate.crowdHeatTolerance),
      createdAt: asUnixMs(candidate.createdAt),
    }),
  };
}

export function upgradeChatColdStartProfileVersion(
  profile: ChatColdStartProfile,
  nextVersion = CHAT_COLD_START_PROFILE_VERSION,
): ChatColdStartProfile {
  return Object.freeze({
    ...profile,
    version: nextVersion,
  });
}

export function mergeChatColdStartProfiles(
  base: ChatColdStartProfile,
  override: Partial<ChatColdStartProfile>,
): ChatColdStartProfile {
  return createChatColdStartProfile({
    now: override.createdAt ?? base.createdAt,
    version: override.version ?? base.version,
    playerId: override.playerId ?? base.playerId,
    hints: {
      helperFrequencyBias:
        typeof override.helperFrequencyBias === 'number'
          ? override.helperFrequencyBias
          : base.helperFrequencyBias,
      haterAggressionBias:
        typeof override.haterAggressionBias === 'number'
          ? override.haterAggressionBias
          : base.haterAggressionBias,
      negotiationRiskBias:
        typeof override.negotiationRiskBias === 'number'
          ? override.negotiationRiskBias
          : base.negotiationRiskBias,
      crowdHeatTolerance:
        typeof override.crowdHeatTolerance === 'number'
          ? override.crowdHeatTolerance
          : base.crowdHeatTolerance,
      prefersLowerPressureOpenings:
        override.prefersLowerPressureOpenings ?? base.prefersLowerPressureOpenings,
    },
  });
}

export function scoreInitialHelperCadence01(
  profile: ChatColdStartProfile,
  context: ChatColdStartSeedContext = {},
): Score01 {
  const heuristics = computeChatColdStartHeuristics(context);
  return asScore01(
    clamp01(
      profile.helperFrequencyBias * 0.56 +
        heuristics.helperNeed01 * 0.22 +
        heuristics.quietRisk01 * 0.10 +
        heuristics.frustrationPressure01 * 0.12,
    ),
  );
}

export function scoreInitialHaterCadence01(
  profile: ChatColdStartProfile,
  context: ChatColdStartSeedContext = {},
): Score01 {
  const heuristics = computeChatColdStartHeuristics(context);
  return asScore01(
    clamp01(
      profile.haterAggressionBias * 0.56 +
        heuristics.haterTolerance01 * 0.18 +
        heuristics.crowdStress01 * 0.10 -
        heuristics.helperNeed01 * 0.08 -
        heuristics.frustrationPressure01 * 0.06,
    ),
  );
}

export function scoreInitialNegotiationGuard01(
  profile: ChatColdStartProfile,
  context: ChatColdStartSeedContext = {},
): Score01 {
  const heuristics = computeChatColdStartHeuristics(context);
  return asScore01(
    clamp01(
      profile.negotiationRiskBias * 0.52 +
        heuristics.negotiationGuard01 * 0.30 +
        heuristics.frustrationPressure01 * 0.10 +
        heuristics.quietRisk01 * 0.08,
    ),
  );
}

export function recommendColdStartOpeningChannel(
  profile: ChatColdStartProfile,
  context: ChatColdStartSeedContext = {},
): ChatVisibleChannel {
  const preferred = channelFromHint(context.activeChannel, 'GLOBAL');

  if (profile.prefersLowerPressureOpenings) {
    if (preferred === 'LOBBY' || preferred === 'SYNDICATE') {
      return preferred;
    }

    return 'LOBBY';
  }

  if (profile.negotiationRiskBias >= 0.60) {
    return preferred === 'DEAL_ROOM' ? 'SYNDICATE' : preferred;
  }

  if (profile.haterAggressionBias >= 0.62 && profile.crowdHeatTolerance >= 0.56) {
    return preferred === 'GLOBAL' ? 'GLOBAL' : 'SYNDICATE';
  }

  return preferred;
}

export function createChatColdStartRecommendation(
  profile: ChatColdStartProfile,
  context: ChatColdStartSeedContext = {},
): ChatColdStartRecommendation {
  const heuristics = computeChatColdStartHeuristics(context);
  const helperCadence01 = scoreInitialHelperCadence01(profile, context);
  const haterCadence01 = scoreInitialHaterCadence01(profile, context);
  const negotiationGuard01 = scoreInitialNegotiationGuard01(profile, context);
  const openingChannel = recommendColdStartOpeningChannel(profile, context);
  const respectSilenceFirst =
    profile.prefersLowerPressureOpenings || heuristics.quietRisk01 >= 0.56;

  const explanation = [
    `open:${openingChannel}`,
    `helper:${helperCadence01.toFixed(2)}`,
    `hater:${haterCadence01.toFixed(2)}`,
    `guard:${negotiationGuard01.toFixed(2)}`,
    respectSilenceFirst ? 'silence:first' : 'silence:reactive',
  ].join(' | ');

  return Object.freeze({
    openingChannel,
    helperCadence01,
    haterCadence01,
    negotiationGuard01,
    respectSilenceFirst,
    explanation,
  });
}

export function createChatColdStartProfileFromLegacyCompat(
  legacyProfile: Partial<LegacyPlayerLearningProfileCompat>,
  context: Omit<ChatColdStartSeedContext, 'legacyProfile'> = {},
): ChatColdStartProfile {
  return createChatColdStartProfile({
    ...context,
    playerId: context.playerId ?? legacyProfile.playerId,
    now: context.now ?? legacyProfile.updatedAt ?? legacyProfile.firstSeenAt,
    legacyProfile,
  });
}

export const CHAT_COLD_START_PROFILE_README = Object.freeze({
  importPath:
    '/pzo-web/src/engines/chat/intelligence/ChatColdStartProfile',
  primaryExports: Object.freeze([
    'createChatColdStartProfile',
    'hydrateChatColdStartProfile',
    'createChatColdStartProfileFromLegacyCompat',
    'computeChatColdStartHeuristics',
    'createChatColdStartRecommendation',
  ] as const),
  compileSafe: true,
  dependsOnFutureMlModules: false,
  dependsOnFutureDlModules: false,
} as const);