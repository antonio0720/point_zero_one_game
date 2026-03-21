/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT COLD-START POPULATION MODEL
 * FILE: backend/src/game/engine/chat/intelligence/ColdStartPopulationModel.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Cold-start seeding, population priors, archetype scoring, and first-contact
 * learning profile generation for the authoritative backend chat lane.
 *
 * Why this file exists
 * --------------------
 * The frontend donor lane already proved the value of second-one learning:
 * cold-start biasing, helper timing, hater tone shaping, and channel preference
 * seeding. The backend version cannot simply mirror that logic. It must:
 *
 * 1. own authoritative first-contact profile generation,
 * 2. seed durable learning truth for new or low-history users,
 * 3. reconcile room/mode/channel context before the first accepted message,
 * 4. provide consistent priors across replay, telemetry, and training,
 * 5. adapt population-wide priors without letting local heuristics drift.
 *
 * Design doctrine
 * ---------------
 * - Cold-start is not random.
 * - First-contact must feel intentional even before history exists.
 * - Population priors may guide, but they never bypass backend policy.
 * - The model may recommend hater/helper cadence posture, but orchestrators,
 *   moderation, and rate policy still make final decisions.
 * - The output of this file must be deterministic from the same inputs.
 *
 * What this file owns
 * -------------------
 * - population archetype catalog,
 * - room-kind and stage-mood adjustments,
 * - first-contact affect seeding,
 * - initial channel affinity distribution,
 * - helper/hater/negotiation/churn priors,
 * - legacy hint normalization,
 * - population observation and adaptive rebalancing,
 * - exportable cold-start manifests for diagnostics.
 *
 * What this file does not own
 * ---------------------------
 * - live profile mutation after durable history exists,
 * - telemetry streaming,
 * - replay assembly,
 * - ML online inference,
 * - transcript mutation,
 * - policy enforcement.
 * ============================================================================
 */

import type {
  ChatAffectSnapshot,
  ChatFeatureSnapshot,
  ChatLearningProfile,
  ChatRoomKind,
  ChatRoomStageMood,
  ChatRuntimeConfig,
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
  type Brand,
} from '../types';

// ============================================================================
// MARK: Public contracts
// ============================================================================

export type ColdStartArchetypeId =
  | 'SILENT_OBSERVER'
  | 'WOUNDED_SURVIVOR'
  | 'TACTICAL_CLIMBER'
  | 'PREDATORY_DEALMAKER'
  | 'ARENA_PROVOCATEUR'
  | 'LOYAL_SYNDICATE_OPERATOR'
  | 'CEREMONIAL_LEGEND_CHASER'
  | 'CURIOUS_LOBBY_EXPLORER';

export type ColdStartPressurePosture =
  | 'STABLE'
  | 'UNEASY'
  | 'FRAGILE'
  | 'COMBATIVE'
  | 'PREDATORY';

export interface ChatColdStartLegacyCompat {
  readonly helpSeekRate?: number;
  readonly angerRate?: number;
  readonly trollRate?: number;
  readonly flexRate?: number;
  readonly silenceRate?: number;
  readonly chatOpenRatio?: number;
  readonly avgSovereigntyRate?: number;
  readonly preferredAggressionLevel?: number;
  readonly churnRiskBaseline?: number;
  readonly dealAggressionRate?: number;
  readonly loyaltyRate?: number;
  readonly lobbyLingerRate?: number;
}

export interface ChatColdStartClientHints {
  readonly preferredVisibleChannel?: ChatVisibleChannel;
  readonly helperBias01?: number;
  readonly haterTolerance01?: number;
  readonly negotiationAggression01?: number;
  readonly curiosity01?: number;
  readonly confidence01?: number;
  readonly frustration01?: number;
}

export interface ChatColdStartPopulationContext {
  readonly userId: ChatUserId;
  readonly now?: number;
  readonly runtime?: Partial<ChatRuntimeConfig>;
  readonly roomKind?: ChatRoomKind | null;
  readonly stageMood?: ChatRoomStageMood | null;
  readonly requestedChannel?: ChatVisibleChannel | null;
  readonly featureSnapshot?: ChatFeatureSnapshot | null;
  readonly legacyHints?: Partial<ChatColdStartLegacyCompat> | null;
  readonly clientHints?: Partial<ChatColdStartClientHints> | null;
  readonly existingProfile?: ChatLearningProfile | null;
  readonly acceptClientHints?: boolean;
}

export interface ChatColdStartArchetypeVector {
  readonly engagementBaseline01: Score01;
  readonly helperReceptivity01: Score01;
  readonly haterSusceptibility01: Score01;
  readonly negotiationAggression01: Score01;
  readonly churnRisk01: Score01;
  readonly affect: ChatAffectSnapshot;
  readonly channelAffinity: Readonly<Record<ChatVisibleChannel, Score01>>;
}

export interface ChatColdStartArchetypeDescriptor {
  readonly id: ColdStartArchetypeId;
  readonly title: string;
  readonly summary: string;
  readonly biasTags: readonly string[];
  readonly defaultPressurePosture: ColdStartPressurePosture;
  readonly vector: ChatColdStartArchetypeVector;
}

export interface ChatColdStartArchetypeScore {
  readonly archetypeId: ColdStartArchetypeId;
  readonly score01: Score01;
  readonly reasons: readonly string[];
}

export interface ChatColdStartPopulationPrior {
  readonly generatedAt: UnixMs;
  readonly userId: ChatUserId;
  readonly archetypeId: ColdStartArchetypeId;
  readonly pressurePosture: ColdStartPressurePosture;
  readonly confidence01: Score01;
  readonly helperNeed01: Score01;
  readonly haterTolerance01: Score01;
  readonly negotiationAggression01: Score01;
  readonly churnRisk01: Score01;
  readonly affect: ChatAffectSnapshot;
  readonly channelAffinity: Readonly<Record<ChatVisibleChannel, Score01>>;
  readonly reasons: readonly string[];
}

export interface ChatColdStartRecommendation {
  readonly archetypeId: ColdStartArchetypeId;
  readonly helperCadence01: Score01;
  readonly haterCadence01: Score01;
  readonly ambientCadence01: Score01;
  readonly recommendedVisibleChannel: ChatVisibleChannel;
  readonly explanation: string;
}

export interface ChatColdStartPopulationStats {
  readonly totalSeeds: number;
  readonly countsByArchetype: Readonly<Record<ColdStartArchetypeId, number>>;
  readonly runningConfidence01: Score01;
  readonly runningHelperNeed01: Score01;
  readonly runningHaterTolerance01: Score01;
  readonly runningNegotiationAggression01: Score01;
}

export interface ChatColdStartPopulationModelOptions {
  readonly runtime?: Partial<ChatRuntimeConfig>;
  readonly acceptClientHints?: boolean;
  readonly logger?: {
    debug(message: string, context?: Readonly<Record<string, JsonValue>>): void;
    info(message: string, context?: Readonly<Record<string, JsonValue>>): void;
    warn(message: string, context?: Readonly<Record<string, JsonValue>>): void;
  };
}

export interface ChatColdStartProfileSeed {
  readonly profile: ChatLearningProfile;
  readonly prior: ChatColdStartPopulationPrior;
  readonly recommendation: ChatColdStartRecommendation;
  readonly created: boolean;
}

export interface ChatColdStartPopulationModelApi {
  readonly runtime: ChatRuntimeConfig;
  listArchetypes(): readonly ChatColdStartArchetypeDescriptor[];
  getPopulationStats(): ChatColdStartPopulationStats;
  scoreArchetypes(
    context: ChatColdStartPopulationContext,
  ): readonly ChatColdStartArchetypeScore[];
  resolvePrior(
    context: ChatColdStartPopulationContext,
  ): ChatColdStartPopulationPrior;
  recommend(
    context: ChatColdStartPopulationContext,
  ): ChatColdStartRecommendation;
  seedLearningProfile(
    context: ChatColdStartPopulationContext,
  ): ChatColdStartProfileSeed;
  observeProfile(profile: ChatLearningProfile): ChatColdStartPopulationStats;
  mergeLegacyHints(
    base: Partial<ChatColdStartLegacyCompat> | null | undefined,
    override: Partial<ChatColdStartLegacyCompat> | null | undefined,
  ): Partial<ChatColdStartLegacyCompat>;
  mergeClientHints(
    base: Partial<ChatColdStartClientHints> | null | undefined,
    override: Partial<ChatColdStartClientHints> | null | undefined,
  ): Partial<ChatColdStartClientHints>;
  exportManifest(): {
    readonly runtimeVersion: string;
    readonly totalArchetypes: number;
    readonly archetypes: readonly ChatColdStartArchetypeDescriptor[];
    readonly stats: ChatColdStartPopulationStats;
  };
}

// ============================================================================
// MARK: Module constants
// ============================================================================

export const CHAT_COLD_START_POPULATION_MODEL_VERSION =
  'PZO_BACKEND_CHAT_COLD_START_POPULATION_MODEL_2026_03_14' as const;

const COLD_START_CHANNELS = [
  'GLOBAL',
  'SYNDICATE',
  'DEAL_ROOM',
  'LOBBY',
] as const satisfies readonly ChatVisibleChannel[];

const DEFAULT_AFFECT: ChatAffectSnapshot = Object.freeze({
  confidence01: clamp01(0.50),
  frustration01: clamp01(0.22),
  intimidation01: clamp01(0.18),
  attachment01: clamp01(0.16),
  curiosity01: clamp01(0.54),
  embarrassment01: clamp01(0.12),
  relief01: clamp01(0.20),
});

function channelRecord(
  global: number,
  syndicate: number,
  dealRoom: number,
  lobby: number,
): Readonly<Record<ChatVisibleChannel, Score01>> {
  return Object.freeze({
    GLOBAL: clamp01(global),
    SYNDICATE: clamp01(syndicate),
    DEAL_ROOM: clamp01(dealRoom),
    LOBBY: clamp01(lobby),
  });
}

function affect(
  confidence01: number,
  frustration01: number,
  intimidation01: number,
  attachment01: number,
  curiosity01: number,
  embarrassment01: number,
  relief01: number,
): ChatAffectSnapshot {
  return Object.freeze({
    confidence01: clamp01(confidence01),
    frustration01: clamp01(frustration01),
    intimidation01: clamp01(intimidation01),
    attachment01: clamp01(attachment01),
    curiosity01: clamp01(curiosity01),
    embarrassment01: clamp01(embarrassment01),
    relief01: clamp01(relief01),
  });
}

const ARCHETYPE_CATALOG: readonly ChatColdStartArchetypeDescriptor[] =
  Object.freeze([
    Object.freeze({
      id: 'SILENT_OBSERVER',
      title: 'Silent Observer',
      summary:
        'Low-volatility first-contact player who opens chat cautiously, watches before responding, and benefits from measured ambient context.',
      biasTags: Object.freeze([
        'quiet',
        'observant',
        'low-noise',
        'helper-friendly',
      ]),
      defaultPressurePosture: 'UNEASY',
      vector: Object.freeze({
        engagementBaseline01: clamp01(0.31),
        helperReceptivity01: clamp01(0.78),
        haterSusceptibility01: clamp01(0.34),
        negotiationAggression01: clamp01(0.24),
        churnRisk01: clamp01(0.45),
        affect: affect(0.42, 0.28, 0.20, 0.18, 0.72, 0.16, 0.24),
        channelAffinity: channelRecord(0.22, 0.28, 0.10, 0.80),
      }),
    }),
    Object.freeze({
      id: 'WOUNDED_SURVIVOR',
      title: 'Wounded Survivor',
      summary:
        'Player profile predisposed toward recovery support, lower hater tolerance, and elevated churn risk after negative sequences.',
      biasTags: Object.freeze([
        'fragile',
        'rescue-sensitive',
        'loss-reactive',
        'high-retention-risk',
      ]),
      defaultPressurePosture: 'FRAGILE',
      vector: Object.freeze({
        engagementBaseline01: clamp01(0.27),
        helperReceptivity01: clamp01(0.92),
        haterSusceptibility01: clamp01(0.26),
        negotiationAggression01: clamp01(0.22),
        churnRisk01: clamp01(0.67),
        affect: affect(0.24, 0.54, 0.44, 0.22, 0.46, 0.34, 0.18),
        channelAffinity: channelRecord(0.14, 0.34, 0.06, 0.76),
      }),
    }),
    Object.freeze({
      id: 'TACTICAL_CLIMBER',
      title: 'Tactical Climber',
      summary:
        'Strategic player archetype with resilient confidence, moderate helper usage, and a strong affinity for channels where status and calculated gains matter.',
      biasTags: Object.freeze([
        'strategic',
        'resilient',
        'status-aware',
        'calculated',
      ]),
      defaultPressurePosture: 'STABLE',
      vector: Object.freeze({
        engagementBaseline01: clamp01(0.58),
        helperReceptivity01: clamp01(0.52),
        haterSusceptibility01: clamp01(0.60),
        negotiationAggression01: clamp01(0.48),
        churnRisk01: clamp01(0.26),
        affect: affect(0.66, 0.18, 0.24, 0.18, 0.42, 0.10, 0.22),
        channelAffinity: channelRecord(0.44, 0.58, 0.34, 0.26),
      }),
    }),
    Object.freeze({
      id: 'PREDATORY_DEALMAKER',
      title: 'Predatory Dealmaker',
      summary:
        'Negotiation-first archetype that treats deal-room exchanges as leverage arenas and tolerates psychological pressure if upside is present.',
      biasTags: Object.freeze([
        'negotiation',
        'predatory',
        'composed',
        'opportunistic',
      ]),
      defaultPressurePosture: 'PREDATORY',
      vector: Object.freeze({
        engagementBaseline01: clamp01(0.62),
        helperReceptivity01: clamp01(0.28),
        haterSusceptibility01: clamp01(0.68),
        negotiationAggression01: clamp01(0.86),
        churnRisk01: clamp01(0.20),
        affect: affect(0.70, 0.16, 0.18, 0.10, 0.34, 0.06, 0.18),
        channelAffinity: channelRecord(0.18, 0.24, 0.92, 0.14),
      }),
    }),
    Object.freeze({
      id: 'ARENA_PROVOCATEUR',
      title: 'Arena Provocateur',
      summary:
        'High-exposure archetype that tolerates crowd heat, invites escalation, and often reads public friction as content rather than danger.',
      biasTags: Object.freeze([
        'showman',
        'heat-tolerant',
        'public-facing',
        'aggressive',
      ]),
      defaultPressurePosture: 'COMBATIVE',
      vector: Object.freeze({
        engagementBaseline01: clamp01(0.74),
        helperReceptivity01: clamp01(0.20),
        haterSusceptibility01: clamp01(0.82),
        negotiationAggression01: clamp01(0.42),
        churnRisk01: clamp01(0.24),
        affect: affect(0.76, 0.22, 0.18, 0.08, 0.30, 0.08, 0.12),
        channelAffinity: channelRecord(0.94, 0.22, 0.18, 0.12),
      }),
    }),
    Object.freeze({
      id: 'LOYAL_SYNDICATE_OPERATOR',
      title: 'Loyal Syndicate Operator',
      summary:
        'Trust-centered player likely to prefer quieter collective channels, respond to insider tone, and devalue public spectacle.',
      biasTags: Object.freeze([
        'tribal',
        'private',
        'reputation-aware',
        'loyalist',
      ]),
      defaultPressurePosture: 'STABLE',
      vector: Object.freeze({
        engagementBaseline01: clamp01(0.52),
        helperReceptivity01: clamp01(0.48),
        haterSusceptibility01: clamp01(0.46),
        negotiationAggression01: clamp01(0.36),
        churnRisk01: clamp01(0.28),
        affect: affect(0.58, 0.18, 0.20, 0.42, 0.34, 0.10, 0.24),
        channelAffinity: channelRecord(0.16, 0.94, 0.22, 0.18),
      }),
    }),
    Object.freeze({
      id: 'CEREMONIAL_LEGEND_CHASER',
      title: 'Ceremonial Legend Chaser',
      summary:
        'Prestige-seeking first-contact profile drawn to dramatic proof, remembered moments, and authored atmospheres instead of pure efficiency.',
      biasTags: Object.freeze([
        'legend-seeking',
        'prestige',
        'ceremonial',
        'memory-sensitive',
      ]),
      defaultPressurePosture: 'STABLE',
      vector: Object.freeze({
        engagementBaseline01: clamp01(0.60),
        helperReceptivity01: clamp01(0.40),
        haterSusceptibility01: clamp01(0.56),
        negotiationAggression01: clamp01(0.38),
        churnRisk01: clamp01(0.22),
        affect: affect(0.62, 0.16, 0.20, 0.26, 0.58, 0.12, 0.24),
        channelAffinity: channelRecord(0.52, 0.30, 0.18, 0.34),
      }),
    }),
    Object.freeze({
      id: 'CURIOUS_LOBBY_EXPLORER',
      title: 'Curious Lobby Explorer',
      summary:
        'Onboarding-adjacent archetype that benefits from explanatory ambient chatter, low threat posture, and structured helper cues.',
      biasTags: Object.freeze([
        'explorer',
        'onboarding',
        'curious',
        'context-hungry',
      ]),
      defaultPressurePosture: 'UNEASY',
      vector: Object.freeze({
        engagementBaseline01: clamp01(0.40),
        helperReceptivity01: clamp01(0.72),
        haterSusceptibility01: clamp01(0.28),
        negotiationAggression01: clamp01(0.18),
        churnRisk01: clamp01(0.38),
        affect: affect(0.38, 0.24, 0.16, 0.18, 0.82, 0.14, 0.20),
        channelAffinity: channelRecord(0.18, 0.22, 0.08, 0.96),
      }),
    }),
  ]);

// ============================================================================
// MARK: Bootstrap
// ============================================================================

export function createColdStartPopulationModel(
  options: ChatColdStartPopulationModelOptions = {},
): ChatColdStartPopulationModelApi {
  const runtime = mergeRuntime(options.runtime);
  const logger = options.logger ?? null;
  const acceptClientHints =
    typeof options.acceptClientHints === 'boolean'
      ? options.acceptClientHints
      : runtime.learningPolicy.acceptClientHints;

  let totalSeeds = 0;
  const countsByArchetype = createArchetypeCountRecord();
  let runningConfidence = 0.50;
  let runningHelperNeed = 0.50;
  let runningHaterTolerance = 0.50;
  let runningNegotiationAggression = 0.50;

  function maybeDebug(
    message: string,
    context?: Readonly<Record<string, JsonValue>>,
  ): void {
    logger?.debug?.(message, context);
  }

  function observe(prior: ChatColdStartPopulationPrior): ChatColdStartPopulationStats {
    totalSeeds += 1;
    countsByArchetype[prior.archetypeId] += 1;
    runningConfidence = runningAverage(
      runningConfidence,
      totalSeeds - 1,
      Number(prior.confidence01),
    );
    runningHelperNeed = runningAverage(
      runningHelperNeed,
      totalSeeds - 1,
      Number(prior.helperNeed01),
    );
    runningHaterTolerance = runningAverage(
      runningHaterTolerance,
      totalSeeds - 1,
      Number(prior.haterTolerance01),
    );
    runningNegotiationAggression = runningAverage(
      runningNegotiationAggression,
      totalSeeds - 1,
      Number(prior.negotiationAggression01),
    );
    return getStats();
  }

  function getStats(): ChatColdStartPopulationStats {
    return Object.freeze({
      totalSeeds,
      countsByArchetype: Object.freeze({ ...countsByArchetype }),
      runningConfidence01: clamp01(runningConfidence),
      runningHelperNeed01: clamp01(runningHelperNeed),
      runningHaterTolerance01: clamp01(runningHaterTolerance),
      runningNegotiationAggression01: clamp01(runningNegotiationAggression),
    });
  }

  function scoreArchetypesInternal(
    context: ChatColdStartPopulationContext,
  ): readonly ChatColdStartArchetypeScore[] {
    const normalized = normalizeContext(context, runtime, acceptClientHints);
    const scores = ARCHETYPE_CATALOG.map((descriptor) =>
      scoreArchetypeDescriptor(descriptor, normalized, getStats()),
    ).sort((a, b) => Number(b.score01) - Number(a.score01));

    maybeDebug('Cold-start archetypes scored.', {
      userId: normalized.userId as unknown as string,
      topArchetype: scores[0]?.archetypeId ?? 'none',
      topScore01: scores[0]?.score01 ?? 0,
    });

    return Object.freeze(scores);
  }

  function resolvePriorInternal(
    context: ChatColdStartPopulationContext,
  ): ChatColdStartPopulationPrior {
    const normalized = normalizeContext(context, runtime, acceptClientHints);
    const scored = scoreArchetypesInternal(normalized);
    const winner = scored[0];
    const archetype = requireArchetype(winner.archetypeId);
    const blendedVector = applyContextToArchetypeVector(
      archetype.vector,
      normalized,
      getStats(),
    );
    const reasons = dedupeStrings([
      ...winner.reasons,
      ...contextualReasonTags(normalized),
      `pressure:${selectPressurePosture(archetype, normalized)}`,
    ]);

    return Object.freeze({
      generatedAt: asUnixMs(normalized.now),
      userId: normalized.userId,
      archetypeId: archetype.id,
      pressurePosture: selectPressurePosture(archetype, normalized),
      confidence01: blendedVector.affect.confidence01,
      helperNeed01: invert(blendedVector.helperReceptivity01),
      haterTolerance01: invert(blendedVector.haterSusceptibility01),
      negotiationAggression01: blendedVector.negotiationAggression01,
      churnRisk01: blendedVector.churnRisk01,
      affect: blendedVector.affect,
      channelAffinity: blendedVector.channelAffinity,
      reasons: Object.freeze(reasons),
    });
  }

  function recommendInternal(
    context: ChatColdStartPopulationContext,
  ): ChatColdStartRecommendation {
    const prior = resolvePriorInternal(context);
    const recommendedVisibleChannel = selectPrimaryChannel(
      prior.channelAffinity,
      context.requestedChannel ?? null,
    );

    const helperCadence01 = clamp01(
      Number(prior.helperNeed01) * 0.62 +
        Number(prior.churnRisk01) * 0.22 +
        Number(prior.affect.frustration01) * 0.10 +
        Number(prior.affect.intimidation01) * 0.06,
    );

    const haterCadence01 = clamp01(
      Number(prior.confidence01) * 0.26 +
        Number(prior.haterTolerance01) * 0.44 +
        Number(prior.negotiationAggression01) * 0.16 +
        Number(prior.channelAffinity.GLOBAL) * 0.08 +
        Number(prior.channelAffinity.DEAL_ROOM) * 0.06 -
        Number(prior.churnRisk01) * 0.10,
    );

    const ambientCadence01 = clamp01(
      Number(prior.affect.curiosity01) * 0.36 +
        Number(prior.channelAffinity.LOBBY) * 0.18 +
        Number(prior.channelAffinity.SYNDICATE) * 0.14 +
        Number(prior.affect.attachment01) * 0.10 +
        0.18,
    );

    const explanation = [
      `Archetype ${prior.archetypeId} seeded for ${String(prior.userId)}.`,
      `Channel bias resolved to ${recommendedVisibleChannel}.`,
      `Helper:${helperCadence01.toFixed(2)} Hater:${haterCadence01.toFixed(2)} Ambient:${ambientCadence01.toFixed(2)}.`,
    ].join(' ');

    return Object.freeze({
      archetypeId: prior.archetypeId,
      helperCadence01,
      haterCadence01,
      ambientCadence01,
      recommendedVisibleChannel,
      explanation,
    });
  }

  function seedLearningProfileInternal(
    context: ChatColdStartPopulationContext,
  ): ChatColdStartProfileSeed {
    const normalized = normalizeContext(context, runtime, acceptClientHints);
    if (normalized.existingProfile) {
      const prior = resolvePriorInternal(normalized);
      const recommendation = recommendInternal(normalized);
      return Object.freeze({
        profile: normalized.existingProfile,
        prior,
        recommendation,
        created: false,
      });
    }

    const prior = resolvePriorInternal(normalized);
    const recommendation = recommendInternal(normalized);
    const createdAt = asUnixMs(normalized.now);
    const profile = Object.freeze({
      userId: normalized.userId,
      createdAt,
      updatedAt: createdAt,
      coldStart: true,
      engagementBaseline01: clamp01(
        selectArchetypeVector(prior.archetypeId, normalized).engagementBaseline01,
      ),
      helperReceptivity01: invert(prior.helperNeed01),
      haterSusceptibility01: invert(prior.haterTolerance01),
      negotiationAggression01: prior.negotiationAggression01,
      channelAffinity: prior.channelAffinity,
      rescueHistoryCount: 0,
      churnRisk01: prior.churnRisk01,
      salienceAnchorIds: Object.freeze([]),
      affect: prior.affect,
    }) satisfies ChatLearningProfile;

    observe(prior);

    return Object.freeze({
      profile,
      prior,
      recommendation,
      created: true,
    });
  }

  return Object.freeze({
    runtime,
    listArchetypes(): readonly ChatColdStartArchetypeDescriptor[] {
      return ARCHETYPE_CATALOG;
    },
    getPopulationStats(): ChatColdStartPopulationStats {
      return getStats();
    },
    scoreArchetypes(
      context: ChatColdStartPopulationContext,
    ): readonly ChatColdStartArchetypeScore[] {
      return scoreArchetypesInternal(context);
    },
    resolvePrior(
      context: ChatColdStartPopulationContext,
    ): ChatColdStartPopulationPrior {
      return resolvePriorInternal(context);
    },
    recommend(
      context: ChatColdStartPopulationContext,
    ): ChatColdStartRecommendation {
      return recommendInternal(context);
    },
    seedLearningProfile(
      context: ChatColdStartPopulationContext,
    ): ChatColdStartProfileSeed {
      return seedLearningProfileInternal(context);
    },
    observeProfile(profile: ChatLearningProfile): ChatColdStartPopulationStats {
      const prior = profileToPopulationPrior(profile, runtime);
      return observe(prior);
    },
    mergeLegacyHints(
      base: Partial<ChatColdStartLegacyCompat> | null | undefined,
      override: Partial<ChatColdStartLegacyCompat> | null | undefined,
    ): Partial<ChatColdStartLegacyCompat> {
      return mergeLegacyCompat(base, override);
    },
    mergeClientHints(
      base: Partial<ChatColdStartClientHints> | null | undefined,
      override: Partial<ChatColdStartClientHints> | null | undefined,
    ): Partial<ChatColdStartClientHints> {
      return mergeClientHintsInternal(base, override);
    },
    exportManifest() {
      return Object.freeze({
        runtimeVersion: runtime.version,
        totalArchetypes: ARCHETYPE_CATALOG.length,
        archetypes: ARCHETYPE_CATALOG,
        stats: getStats(),
      });
    },
  });
}

// ============================================================================
// MARK: Context normalization
// ============================================================================

interface NormalizedContext {
  readonly userId: ChatUserId;
  readonly now: number;
  readonly roomKind: ChatRoomKind;
  readonly stageMood: ChatRoomStageMood;
  readonly requestedChannel: ChatVisibleChannel | null;
  readonly featureSnapshot: ChatFeatureSnapshot | null;
  readonly legacyHints: Partial<ChatColdStartLegacyCompat>;
  readonly clientHints: Partial<ChatColdStartClientHints>;
  readonly existingProfile: ChatLearningProfile | null;
  readonly acceptClientHints: boolean;
}

function normalizeContext(
  context: ChatColdStartPopulationContext,
  runtime: ChatRuntimeConfig,
  defaultAcceptClientHints: boolean,
): NormalizedContext {
  const roomKind = normalizeRoomKind(context.roomKind);
  const stageMood = normalizeStageMood(context.stageMood, roomKind);
  const requestedChannel = normalizeVisibleChannel(context.requestedChannel);
  const acceptClientHints =
    typeof context.acceptClientHints === 'boolean'
      ? context.acceptClientHints
      : defaultAcceptClientHints;

  return Object.freeze({
    userId: context.userId,
    now: Number.isFinite(context.now) ? Math.max(0, Number(context.now)) : Date.now(),
    roomKind,
    stageMood,
    requestedChannel,
    featureSnapshot: context.featureSnapshot ?? null,
    legacyHints: mergeLegacyCompat(null, context.legacyHints ?? null),
    clientHints: acceptClientHints
      ? mergeClientHintsInternal(null, context.clientHints ?? null)
      : Object.freeze({}),
    existingProfile: context.existingProfile ?? null,
    acceptClientHints,
  });
}

function normalizeRoomKind(value: ChatRoomKind | null | undefined): ChatRoomKind {
  switch (value) {
    case 'GLOBAL':
    case 'SYNDICATE':
    case 'DEAL_ROOM':
    case 'LOBBY':
    case 'PRIVATE':
    case 'SYSTEM':
      return value;
    default:
      return 'LOBBY';
  }
}

function normalizeStageMood(
  value: ChatRoomStageMood | null | undefined,
  roomKind: ChatRoomKind,
): ChatRoomStageMood {
  switch (value) {
    case 'CALM':
    case 'TENSE':
    case 'HOSTILE':
    case 'PREDATORY':
    case 'CEREMONIAL':
    case 'MOURNFUL':
    case 'ECSTATIC':
      return value;
    default:
      if (roomKind === 'DEAL_ROOM') {
        return 'PREDATORY';
      }
      if (roomKind === 'GLOBAL') {
        return 'TENSE';
      }
      return 'CALM';
  }
}

function normalizeVisibleChannel(
  value: ChatVisibleChannel | null | undefined,
): ChatVisibleChannel | null {
  switch (value) {
    case 'GLOBAL':
    case 'SYNDICATE':
    case 'DEAL_ROOM':
    case 'LOBBY':
      return value;
    default:
      return null;
  }
}

// ============================================================================
// MARK: Scoring
// ============================================================================

function scoreArchetypeDescriptor(
  descriptor: ChatColdStartArchetypeDescriptor,
  context: NormalizedContext,
  stats: ChatColdStartPopulationStats,
): ChatColdStartArchetypeScore {
  let score = 0.40;
  const reasons: string[] = [];

  score += scoreRoomKindAlignment(descriptor.id, context.roomKind, reasons);
  score += scoreStageMoodAlignment(descriptor.id, context.stageMood, reasons);
  score += scoreRequestedChannelAlignment(
    descriptor.vector.channelAffinity,
    context.requestedChannel,
    reasons,
  );
  score += scoreLegacyHints(descriptor.id, context.legacyHints, reasons);
  score += scoreClientHints(descriptor.id, context.clientHints, reasons);
  score += scoreFeatureSnapshot(descriptor.id, context.featureSnapshot, reasons);
  score += scorePopulationBalance(descriptor.id, stats, reasons);

  return Object.freeze({
    archetypeId: descriptor.id,
    score01: clamp01(score),
    reasons: Object.freeze(reasons),
  });
}

function scoreRoomKindAlignment(
  archetypeId: ColdStartArchetypeId,
  roomKind: ChatRoomKind,
  reasons: string[],
): number {
  switch (roomKind) {
    case 'GLOBAL':
      if (archetypeId === 'ARENA_PROVOCATEUR') {
        reasons.push('global-amplifies-provocateur');
        return 0.28;
      }
      if (archetypeId === 'CEREMONIAL_LEGEND_CHASER') {
        reasons.push('global-supports-legend');
        return 0.12;
      }
      return 0;
    case 'SYNDICATE':
      if (archetypeId === 'LOYAL_SYNDICATE_OPERATOR') {
        reasons.push('syndicate-favors-loyalist');
        return 0.30;
      }
      if (archetypeId === 'TACTICAL_CLIMBER') {
        reasons.push('syndicate-favors-strategist');
        return 0.10;
      }
      return 0;
    case 'DEAL_ROOM':
      if (archetypeId === 'PREDATORY_DEALMAKER') {
        reasons.push('deal-room-favors-negotiator');
        return 0.34;
      }
      if (archetypeId === 'TACTICAL_CLIMBER') {
        reasons.push('deal-room-rewards-calculation');
        return 0.12;
      }
      return 0;
    case 'LOBBY':
      if (archetypeId === 'CURIOUS_LOBBY_EXPLORER') {
        reasons.push('lobby-favors-explorer');
        return 0.26;
      }
      if (archetypeId === 'SILENT_OBSERVER') {
        reasons.push('lobby-favors-observer');
        return 0.10;
      }
      return 0;
    case 'PRIVATE':
      if (archetypeId === 'LOYAL_SYNDICATE_OPERATOR') {
        reasons.push('private-favors-trust');
        return 0.14;
      }
      if (archetypeId === 'WOUNDED_SURVIVOR') {
        reasons.push('private-can-protect-fragile-profile');
        return 0.10;
      }
      return 0;
    case 'SYSTEM':
      if (archetypeId === 'CEREMONIAL_LEGEND_CHASER') {
        reasons.push('system-moments-favor-prestige');
        return 0.14;
      }
      return 0;
    default:
      return 0;
  }
}

function scoreStageMoodAlignment(
  archetypeId: ColdStartArchetypeId,
  stageMood: ChatRoomStageMood,
  reasons: string[],
): number {
  switch (stageMood) {
    case 'HOSTILE':
      if (archetypeId === 'ARENA_PROVOCATEUR') {
        reasons.push('hostility-favors-provocateur');
        return 0.18;
      }
      if (archetypeId === 'WOUNDED_SURVIVOR') {
        reasons.push('hostility-can-fragilize-survivor');
        return 0.10;
      }
      return 0;
    case 'PREDATORY':
      if (archetypeId === 'PREDATORY_DEALMAKER') {
        reasons.push('predatory-mood-favors-dealmaker');
        return 0.22;
      }
      return 0;
    case 'CEREMONIAL':
      if (archetypeId === 'CEREMONIAL_LEGEND_CHASER') {
        reasons.push('ceremonial-mood-favors-legend');
        return 0.20;
      }
      return 0;
    case 'MOURNFUL':
      if (archetypeId === 'WOUNDED_SURVIVOR') {
        reasons.push('mournful-mood-favors-rescue-oriented-prior');
        return 0.16;
      }
      if (archetypeId === 'SILENT_OBSERVER') {
        reasons.push('mournful-mood-favors-quiet-observer');
        return 0.08;
      }
      return 0;
    case 'ECSTATIC':
      if (archetypeId === 'CEREMONIAL_LEGEND_CHASER') {
        reasons.push('ecstatic-mood-favors-legend');
        return 0.10;
      }
      if (archetypeId === 'ARENA_PROVOCATEUR') {
        reasons.push('ecstatic-mood-favors-exposure');
        return 0.08;
      }
      return 0;
    case 'TENSE':
      if (archetypeId === 'TACTICAL_CLIMBER') {
        reasons.push('tense-mood-favors-calculated-climber');
        return 0.12;
      }
      if (archetypeId === 'SILENT_OBSERVER') {
        reasons.push('tense-mood-favors-watchful-entry');
        return 0.08;
      }
      return 0;
    case 'CALM':
    default:
      if (archetypeId === 'CURIOUS_LOBBY_EXPLORER') {
        reasons.push('calm-mood-favors-explorer');
        return 0.08;
      }
      return 0;
  }
}

function scoreRequestedChannelAlignment(
  affinity: Readonly<Record<ChatVisibleChannel, Score01>>,
  requestedChannel: ChatVisibleChannel | null,
  reasons: string[],
): number {
  if (!requestedChannel) {
    return 0;
  }
  reasons.push(`requested:${requestedChannel}`);
  return Number(affinity[requestedChannel]) * 0.18;
}

function scoreLegacyHints(
  archetypeId: ColdStartArchetypeId,
  hints: Partial<ChatColdStartLegacyCompat>,
  reasons: string[],
): number {
  const helpSeek = safeRate(hints.helpSeekRate, 0.18);
  const anger = safeRate(hints.angerRate, 0.10);
  const troll = safeRate(hints.trollRate, 0.08);
  const flex = safeRate(hints.flexRate, 0.10);
  const silence = safeRate(hints.silenceRate, 0.30);
  const dealAggression = safeRate(hints.dealAggressionRate, 0.18);
  const loyalty = safeRate(hints.loyaltyRate, 0.12);
  const lobbyLinger = safeRate(hints.lobbyLingerRate, 0.18);
  const prestige = safeRate(hints.avgSovereigntyRate, 0.08);

  let score = 0;

  if (archetypeId === 'WOUNDED_SURVIVOR') {
    score += helpSeek * 0.14 + silence * 0.06 + anger * 0.05;
  }
  if (archetypeId === 'SILENT_OBSERVER') {
    score += silence * 0.16 + helpSeek * 0.04;
  }
  if (archetypeId === 'ARENA_PROVOCATEUR') {
    score += troll * 0.16 + flex * 0.12 + anger * 0.06;
  }
  if (archetypeId === 'PREDATORY_DEALMAKER') {
    score += dealAggression * 0.20 + flex * 0.05;
  }
  if (archetypeId === 'LOYAL_SYNDICATE_OPERATOR') {
    score += loyalty * 0.18;
  }
  if (archetypeId === 'CURIOUS_LOBBY_EXPLORER') {
    score += lobbyLinger * 0.20 + silence * 0.04;
  }
  if (archetypeId === 'CEREMONIAL_LEGEND_CHASER') {
    score += prestige * 0.18 + flex * 0.05;
  }
  if (archetypeId === 'TACTICAL_CLIMBER') {
    score += flex * 0.08 + prestige * 0.06 + loyalty * 0.04;
  }

  if (score > 0) {
    reasons.push('legacy-hints');
  }

  return score;
}

function scoreClientHints(
  archetypeId: ColdStartArchetypeId,
  hints: Partial<ChatColdStartClientHints>,
  reasons: string[],
): number {
  if (Object.keys(hints).length === 0) {
    return 0;
  }

  const helperBias = safeRate(hints.helperBias01, 0.50);
  const haterTolerance = safeRate(hints.haterTolerance01, 0.50);
  const negotiationAggression = safeRate(hints.negotiationAggression01, 0.50);
  const curiosity = safeRate(hints.curiosity01, 0.50);
  const confidence = safeRate(hints.confidence01, 0.50);
  const frustration = safeRate(hints.frustration01, 0.20);

  let score = 0;

  if (archetypeId === 'WOUNDED_SURVIVOR') {
    score += helperBias * 0.12 + frustration * 0.06;
  }
  if (archetypeId === 'SILENT_OBSERVER') {
    score += curiosity * 0.06 + helperBias * 0.04;
  }
  if (archetypeId === 'ARENA_PROVOCATEUR') {
    score += confidence * 0.08 + haterTolerance * 0.12;
  }
  if (archetypeId === 'PREDATORY_DEALMAKER') {
    score += negotiationAggression * 0.16 + confidence * 0.06;
  }
  if (archetypeId === 'TACTICAL_CLIMBER') {
    score += confidence * 0.10 + curiosity * 0.04;
  }
  if (archetypeId === 'CURIOUS_LOBBY_EXPLORER') {
    score += curiosity * 0.14;
  }

  if (score > 0) {
    reasons.push('client-hints');
  }

  return score;
}

function scoreFeatureSnapshot(
  archetypeId: ColdStartArchetypeId,
  snapshot: ChatFeatureSnapshot | null,
  reasons: string[],
): number {
  if (!snapshot) {
    return 0;
  }

  const hostile = Number(snapshot.hostileMomentum01);
  const heat = Number(snapshot.roomHeat01);
  const churn = Number(snapshot.churnRisk01);
  const affectConfidence = Number(snapshot.affect.confidence01);
  const affectFrustration = Number(snapshot.affect.frustration01);

  let score = 0;

  if (archetypeId === 'ARENA_PROVOCATEUR') {
    score += hostile * 0.10 + heat * 0.08 + affectConfidence * 0.06;
  }
  if (archetypeId === 'WOUNDED_SURVIVOR') {
    score += churn * 0.10 + affectFrustration * 0.10;
  }
  if (archetypeId === 'TACTICAL_CLIMBER') {
    score += affectConfidence * 0.08 + hostile * 0.03;
  }
  if (archetypeId === 'PREDATORY_DEALMAKER') {
    score += heat * 0.04 + affectConfidence * 0.05;
  }
  if (archetypeId === 'SILENT_OBSERVER') {
    score += churn * 0.04 + affectFrustration * 0.04;
  }

  if (score > 0) {
    reasons.push('feature-snapshot');
  }

  return score;
}

function scorePopulationBalance(
  archetypeId: ColdStartArchetypeId,
  stats: ChatColdStartPopulationStats,
  reasons: string[],
): number {
  if (stats.totalSeeds < 8) {
    return 0;
  }
  const count = stats.countsByArchetype[archetypeId];
  const average = stats.totalSeeds / ARCHETYPE_CATALOG.length;
  if (count < average * 0.75) {
    reasons.push('population-underrepresented');
    return 0.04;
  }
  if (count > average * 1.50) {
    reasons.push('population-overrepresented');
    return -0.05;
  }
  return 0;
}

// ============================================================================
// MARK: Prior construction
// ============================================================================

function applyContextToArchetypeVector(
  base: ChatColdStartArchetypeVector,
  context: NormalizedContext,
  stats: ChatColdStartPopulationStats,
): ChatColdStartArchetypeVector {
  const moodBias = stageMoodBias(context.stageMood);
  const roomBias = roomKindBias(context.roomKind);
  const feature = context.featureSnapshot;

  const confidence = clamp01(
    Number(base.affect.confidence01) +
      moodBias.confidence +
      roomBias.confidence +
      safeFeature(feature?.affect.confidence01, 0) * 0.08 +
      Number(stats.runningConfidence01) * 0.02 -
      0.01,
  );

  const frustration = clamp01(
    Number(base.affect.frustration01) +
      moodBias.frustration +
      safeFeature(feature?.affect.frustration01, 0) * 0.10 +
      safeFeature(feature?.churnRisk01, 0) * 0.05,
  );

  const intimidation = clamp01(
    Number(base.affect.intimidation01) +
      moodBias.intimidation +
      safeFeature(feature?.hostileMomentum01, 0) * 0.08,
  );

  const attachment = clamp01(
    Number(base.affect.attachment01) +
      roomBias.attachment +
      safeFeature(feature?.affect.attachment01, 0) * 0.06,
  );

  const curiosity = clamp01(
    Number(base.affect.curiosity01) +
      roomBias.curiosity +
      safeFeature(feature?.affect.curiosity01, 0) * 0.06,
  );

  const embarrassment = clamp01(
    Number(base.affect.embarrassment01) +
      moodBias.embarrassment +
      safeFeature(feature?.affect.embarrassment01, 0) * 0.06,
  );

  const relief = clamp01(
    Number(base.affect.relief01) +
      moodBias.relief +
      safeFeature(feature?.affect.relief01, 0) * 0.05,
  );

  const channelAffinity = applyChannelContext(
    base.channelAffinity,
    context,
    stats,
  );

  return Object.freeze({
    engagementBaseline01: clamp01(
      Number(base.engagementBaseline01) +
        roomBias.engagement +
        safeFeature(feature?.messageCountWindow, 0) / 500 +
        Number(context.clientHints.confidence01 ?? 0) * 0.04 -
        Number(context.legacyHints.silenceRate ?? 0) * 0.04,
    ),
    helperReceptivity01: clamp01(
      Number(base.helperReceptivity01) +
        Number(context.clientHints.helperBias01 ?? 0) * 0.10 +
        Number(context.legacyHints.helpSeekRate ?? 0) * 0.14 +
        frustration * 0.06 +
        intimidation * 0.04 -
        confidence * 0.04,
    ),
    haterSusceptibility01: clamp01(
      Number(base.haterSusceptibility01) +
        Number(context.clientHints.haterTolerance01 ?? 0) * -0.08 +
        safeFeature(feature?.hostileMomentum01, 0) * 0.05 -
        confidence * 0.03 +
        Number(context.legacyHints.trollRate ?? 0) * 0.10,
    ),
    negotiationAggression01: clamp01(
      Number(base.negotiationAggression01) +
        Number(context.clientHints.negotiationAggression01 ?? 0) * 0.12 +
        Number(context.legacyHints.dealAggressionRate ?? 0) * 0.16 +
        roomBias.negotiation +
        confidence * 0.04 -
        frustration * 0.02,
    ),
    churnRisk01: clamp01(
      Number(base.churnRisk01) +
        safeFeature(feature?.churnRisk01, 0) * 0.14 +
        frustration * 0.10 +
        intimidation * 0.06 -
        relief * 0.04 -
        confidence * 0.04,
    ),
    affect: Object.freeze({
      confidence01: confidence,
      frustration01: frustration,
      intimidation01: intimidation,
      attachment01: attachment,
      curiosity01: curiosity,
      embarrassment01: embarrassment,
      relief01: relief,
    }),
    channelAffinity,
  });
}

function stageMoodBias(stageMood: ChatRoomStageMood): Record<string, number> {
  switch (stageMood) {
    case 'HOSTILE':
      return {
        confidence: -0.04,
        frustration: 0.10,
        intimidation: 0.12,
        embarrassment: 0.04,
        relief: -0.02,
      };
    case 'PREDATORY':
      return {
        confidence: 0.04,
        frustration: 0.02,
        intimidation: 0.06,
        embarrassment: -0.02,
        relief: -0.02,
      };
    case 'CEREMONIAL':
      return {
        confidence: 0.06,
        frustration: -0.02,
        intimidation: 0.00,
        embarrassment: 0.02,
        relief: 0.04,
      };
    case 'MOURNFUL':
      return {
        confidence: -0.06,
        frustration: 0.08,
        intimidation: 0.04,
        embarrassment: 0.04,
        relief: -0.04,
      };
    case 'ECSTATIC':
      return {
        confidence: 0.08,
        frustration: -0.04,
        intimidation: -0.02,
        embarrassment: -0.02,
        relief: 0.06,
      };
    case 'TENSE':
      return {
        confidence: -0.02,
        frustration: 0.04,
        intimidation: 0.04,
        embarrassment: 0.02,
        relief: -0.01,
      };
    case 'CALM':
    default:
      return {
        confidence: 0.00,
        frustration: 0.00,
        intimidation: 0.00,
        embarrassment: 0.00,
        relief: 0.00,
      };
  }
}

function roomKindBias(roomKind: ChatRoomKind): Record<string, number> {
  switch (roomKind) {
    case 'GLOBAL':
      return {
        confidence: 0.02,
        attachment: -0.02,
        curiosity: 0.02,
        engagement: 0.04,
        negotiation: -0.02,
      };
    case 'SYNDICATE':
      return {
        confidence: 0.00,
        attachment: 0.10,
        curiosity: -0.02,
        engagement: 0.02,
        negotiation: 0.00,
      };
    case 'DEAL_ROOM':
      return {
        confidence: 0.04,
        attachment: -0.02,
        curiosity: -0.02,
        engagement: 0.02,
        negotiation: 0.10,
      };
    case 'LOBBY':
      return {
        confidence: -0.02,
        attachment: 0.02,
        curiosity: 0.10,
        engagement: 0.01,
        negotiation: -0.04,
      };
    case 'PRIVATE':
      return {
        confidence: 0.00,
        attachment: 0.06,
        curiosity: 0.02,
        engagement: -0.01,
        negotiation: -0.02,
      };
    case 'SYSTEM':
    default:
      return {
        confidence: 0.00,
        attachment: 0.00,
        curiosity: 0.00,
        engagement: 0.00,
        negotiation: 0.00,
      };
  }
}

function applyChannelContext(
  base: Readonly<Record<ChatVisibleChannel, Score01>>,
  context: NormalizedContext,
  stats: ChatColdStartPopulationStats,
): Readonly<Record<ChatVisibleChannel, Score01>> {
  let global = Number(base.GLOBAL);
  let syndicate = Number(base.SYNDICATE);
  let dealRoom = Number(base.DEAL_ROOM);
  let lobby = Number(base.LOBBY);

  switch (context.roomKind) {
    case 'GLOBAL':
      global += 0.08;
      break;
    case 'SYNDICATE':
      syndicate += 0.10;
      break;
    case 'DEAL_ROOM':
      dealRoom += 0.14;
      break;
    case 'LOBBY':
      lobby += 0.12;
      break;
    case 'PRIVATE':
      syndicate += 0.04;
      lobby += 0.02;
      break;
    case 'SYSTEM':
      global += 0.02;
      break;
  }

  if (context.requestedChannel) {
    switch (context.requestedChannel) {
      case 'GLOBAL':
        global += 0.18;
        break;
      case 'SYNDICATE':
        syndicate += 0.18;
        break;
      case 'DEAL_ROOM':
        dealRoom += 0.18;
        break;
      case 'LOBBY':
        lobby += 0.18;
        break;
    }
  }

  if (context.clientHints.preferredVisibleChannel) {
    switch (context.clientHints.preferredVisibleChannel) {
      case 'GLOBAL':
        global += 0.12;
        break;
      case 'SYNDICATE':
        syndicate += 0.12;
        break;
      case 'DEAL_ROOM':
        dealRoom += 0.12;
        break;
      case 'LOBBY':
        lobby += 0.12;
        break;
    }
  }

  if (context.legacyHints.loyaltyRate) {
    syndicate += Number(context.legacyHints.loyaltyRate) * 0.12;
  }
  if (context.legacyHints.dealAggressionRate) {
    dealRoom += Number(context.legacyHints.dealAggressionRate) * 0.16;
  }
  if (context.legacyHints.lobbyLingerRate) {
    lobby += Number(context.legacyHints.lobbyLingerRate) * 0.16;
  }
  if (context.legacyHints.flexRate) {
    global += Number(context.legacyHints.flexRate) * 0.08;
  }

  global += Number(stats.runningConfidence01) * 0.01;
  syndicate += Number(stats.runningHelperNeed01) * 0.01;
  dealRoom += Number(stats.runningNegotiationAggression01) * 0.01;
  lobby += (1 - Number(stats.runningHaterTolerance01)) * 0.01;

  return normalizeAffinityRecord({ GLOBAL: global, SYNDICATE: syndicate, DEAL_ROOM: dealRoom, LOBBY: lobby });
}

function normalizeAffinityRecord(
  input: Readonly<Record<ChatVisibleChannel, number>>,
): Readonly<Record<ChatVisibleChannel, Score01>> {
  const entries = Object.entries(input) as Array<[ChatVisibleChannel, number]>;
  const sanitized = entries.map(([channel, value]) => [channel, Math.max(0.01, value)] as const);
  const total = sanitized.reduce((sum, [, value]) => sum + value, 0) || 1;

  return Object.freeze({
    GLOBAL: clamp01(sanitized.find(([channel]) => channel === 'GLOBAL')![1] / total),
    SYNDICATE: clamp01(sanitized.find(([channel]) => channel === 'SYNDICATE')![1] / total),
    DEAL_ROOM: clamp01(sanitized.find(([channel]) => channel === 'DEAL_ROOM')![1] / total),
    LOBBY: clamp01(sanitized.find(([channel]) => channel === 'LOBBY')![1] / total),
  });
}

function selectPressurePosture(
  archetype: ChatColdStartArchetypeDescriptor,
  context: NormalizedContext,
): ColdStartPressurePosture {
  const churn = safeRate(context.featureSnapshot?.churnRisk01, 0.0);
  const hostility = safeRate(context.featureSnapshot?.hostileMomentum01, 0.0);

  if (
    archetype.id === 'WOUNDED_SURVIVOR' ||
    context.stageMood === 'MOURNFUL' ||
    churn > 0.64
  ) {
    return 'FRAGILE';
  }
  if (
    archetype.id === 'PREDATORY_DEALMAKER' ||
    context.roomKind === 'DEAL_ROOM' ||
    context.stageMood === 'PREDATORY'
  ) {
    return 'PREDATORY';
  }
  if (
    archetype.id === 'ARENA_PROVOCATEUR' ||
    context.stageMood === 'HOSTILE' ||
    hostility > 0.58
  ) {
    return 'COMBATIVE';
  }
  if (context.stageMood === 'TENSE') {
    return 'UNEASY';
  }
  return archetype.defaultPressurePosture;
}

function contextualReasonTags(context: NormalizedContext): readonly string[] {
  return Object.freeze([
    `room:${context.roomKind}`,
    `mood:${context.stageMood}`,
    ...(context.requestedChannel ? [`requested-channel:${context.requestedChannel}`] : []),
    ...(context.acceptClientHints && Object.keys(context.clientHints).length > 0
      ? ['client-hints-applied']
      : []),
  ]);
}

function selectPrimaryChannel(
  affinity: Readonly<Record<ChatVisibleChannel, Score01>>,
  requested: ChatVisibleChannel | null,
): ChatVisibleChannel {
  if (requested && Number(affinity[requested]) >= 0.18) {
    return requested;
  }

  let winner: ChatVisibleChannel = 'LOBBY';
  let winnerScore = -1;

  for (const channel of COLD_START_CHANNELS) {
    const score = Number(affinity[channel]);
    if (score > winnerScore) {
      winner = channel;
      winnerScore = score;
    }
  }

  return winner;
}

function selectArchetypeVector(
  archetypeId: ColdStartArchetypeId,
  context: NormalizedContext,
): ChatColdStartArchetypeVector {
  const archetype = requireArchetype(archetypeId);
  return applyContextToArchetypeVector(
    archetype.vector,
    context,
    createEmptyStats(),
  );
}

// ============================================================================
// MARK: Observation / profile conversion
// ============================================================================

function profileToPopulationPrior(
  profile: ChatLearningProfile,
  runtime: ChatRuntimeConfig,
): ChatColdStartPopulationPrior {
  const archetypeId = inferArchetypeFromProfile(profile);
  return Object.freeze({
    generatedAt: profile.updatedAt,
    userId: profile.userId,
    archetypeId,
    pressurePosture: inferPressurePostureFromProfile(profile),
    confidence01: profile.affect.confidence01,
    helperNeed01: invert(profile.helperReceptivity01),
    haterTolerance01: invert(profile.haterSusceptibility01),
    negotiationAggression01: profile.negotiationAggression01,
    churnRisk01: profile.churnRisk01,
    affect: profile.affect,
    channelAffinity: normalizeAffinityRecord({
      GLOBAL: Number(profile.channelAffinity.GLOBAL),
      SYNDICATE: Number(profile.channelAffinity.SYNDICATE),
      DEAL_ROOM: Number(profile.channelAffinity.DEAL_ROOM),
      LOBBY: Number(profile.channelAffinity.LOBBY),
    }),
    reasons: Object.freeze([
      'observed-profile',
      `runtime:${runtime.version}`,
      `coldStart:${profile.coldStart ? 'yes' : 'no'}`,
    ]),
  });
}

function inferArchetypeFromProfile(profile: ChatLearningProfile): ColdStartArchetypeId {
  const channel = selectPrimaryChannel(profile.channelAffinity, null);
  const confidence = Number(profile.affect.confidence01);
  const frustration = Number(profile.affect.frustration01);
  const helperNeed = 1 - Number(profile.helperReceptivity01);
  const haterTolerance = 1 - Number(profile.haterSusceptibility01);
  const negotiation = Number(profile.negotiationAggression01);

  if (channel === 'DEAL_ROOM' && negotiation >= 0.62) {
    return 'PREDATORY_DEALMAKER';
  }
  if (channel === 'SYNDICATE' && Number(profile.affect.attachment01) >= 0.28) {
    return 'LOYAL_SYNDICATE_OPERATOR';
  }
  if (channel === 'GLOBAL' && confidence >= 0.62 && haterTolerance >= 0.54) {
    return 'ARENA_PROVOCATEUR';
  }
  if (frustration >= 0.48 || helperNeed >= 0.68) {
    return 'WOUNDED_SURVIVOR';
  }
  if (channel === 'LOBBY' && Number(profile.affect.curiosity01) >= 0.66) {
    return 'CURIOUS_LOBBY_EXPLORER';
  }
  if (confidence >= 0.58) {
    return 'TACTICAL_CLIMBER';
  }
  return 'SILENT_OBSERVER';
}

function inferPressurePostureFromProfile(
  profile: ChatLearningProfile,
): ColdStartPressurePosture {
  if (Number(profile.churnRisk01) >= 0.60) {
    return 'FRAGILE';
  }
  if (Number(profile.negotiationAggression01) >= 0.76) {
    return 'PREDATORY';
  }
  if (
    Number(profile.affect.confidence01) >= 0.64 &&
    Number(profile.haterSusceptibility01) <= 0.42
  ) {
    return 'COMBATIVE';
  }
  if (Number(profile.affect.frustration01) >= 0.34) {
    return 'UNEASY';
  }
  return 'STABLE';
}

// ============================================================================
// MARK: Hint merges
// ============================================================================

function mergeLegacyCompat(
  base: Partial<ChatColdStartLegacyCompat> | null | undefined,
  override: Partial<ChatColdStartLegacyCompat> | null | undefined,
): Partial<ChatColdStartLegacyCompat> {
  return Object.freeze({
    helpSeekRate: pickNumeric(override?.helpSeekRate, base?.helpSeekRate),
    angerRate: pickNumeric(override?.angerRate, base?.angerRate),
    trollRate: pickNumeric(override?.trollRate, base?.trollRate),
    flexRate: pickNumeric(override?.flexRate, base?.flexRate),
    silenceRate: pickNumeric(override?.silenceRate, base?.silenceRate),
    chatOpenRatio: pickNumeric(override?.chatOpenRatio, base?.chatOpenRatio),
    avgSovereigntyRate: pickNumeric(
      override?.avgSovereigntyRate,
      base?.avgSovereigntyRate,
    ),
    preferredAggressionLevel: pickNumeric(
      override?.preferredAggressionLevel,
      base?.preferredAggressionLevel,
    ),
    churnRiskBaseline: pickNumeric(
      override?.churnRiskBaseline,
      base?.churnRiskBaseline,
    ),
    dealAggressionRate: pickNumeric(
      override?.dealAggressionRate,
      base?.dealAggressionRate,
    ),
    loyaltyRate: pickNumeric(override?.loyaltyRate, base?.loyaltyRate),
    lobbyLingerRate: pickNumeric(
      override?.lobbyLingerRate,
      base?.lobbyLingerRate,
    ),
  });
}

function mergeClientHintsInternal(
  base: Partial<ChatColdStartClientHints> | null | undefined,
  override: Partial<ChatColdStartClientHints> | null | undefined,
): Partial<ChatColdStartClientHints> {
  return Object.freeze({
    preferredVisibleChannel:
      normalizeVisibleChannel(override?.preferredVisibleChannel) ??
      normalizeVisibleChannel(base?.preferredVisibleChannel) ??
      undefined,
    helperBias01: pickNumeric(override?.helperBias01, base?.helperBias01),
    haterTolerance01: pickNumeric(
      override?.haterTolerance01,
      base?.haterTolerance01,
    ),
    negotiationAggression01: pickNumeric(
      override?.negotiationAggression01,
      base?.negotiationAggression01,
    ),
    curiosity01: pickNumeric(override?.curiosity01, base?.curiosity01),
    confidence01: pickNumeric(override?.confidence01, base?.confidence01),
    frustration01: pickNumeric(override?.frustration01, base?.frustration01),
  });
}

// ============================================================================
// MARK: Utility helpers
// ============================================================================

function requireArchetype(
  archetypeId: ColdStartArchetypeId,
): ChatColdStartArchetypeDescriptor {
  const match = ARCHETYPE_CATALOG.find((descriptor) => descriptor.id === archetypeId);
  if (!match) {
    throw new Error(`Unknown cold-start archetype: ${String(archetypeId)}`);
  }
  return match;
}

function createArchetypeCountRecord(): Record<ColdStartArchetypeId, number> {
  return {
    SILENT_OBSERVER: 0,
    WOUNDED_SURVIVOR: 0,
    TACTICAL_CLIMBER: 0,
    PREDATORY_DEALMAKER: 0,
    ARENA_PROVOCATEUR: 0,
    LOYAL_SYNDICATE_OPERATOR: 0,
    CEREMONIAL_LEGEND_CHASER: 0,
    CURIOUS_LOBBY_EXPLORER: 0,
  };
}

function createEmptyStats(): ChatColdStartPopulationStats {
  return Object.freeze({
    totalSeeds: 0,
    countsByArchetype: Object.freeze(createArchetypeCountRecord()),
    runningConfidence01: clamp01(0.50),
    runningHelperNeed01: clamp01(0.50),
    runningHaterTolerance01: clamp01(0.50),
    runningNegotiationAggression01: clamp01(0.50),
  });
}

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

function runningAverage(current: number, count: number, value: number): number {
  if (count <= 0) {
    return value;
  }
  return (current * count + value) / (count + 1);
}

function safeRate(
  value: number | Score01 | null | undefined,
  fallback: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, value));
}

function safeFeature(
  value: number | Score01 | null | undefined,
  fallback: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return value;
}

function pickNumeric(
  preferred: number | undefined,
  fallback: number | undefined,
): number | undefined {
  if (typeof preferred === 'number' && Number.isFinite(preferred)) {
    return preferred;
  }
  if (typeof fallback === 'number' && Number.isFinite(fallback)) {
    return fallback;
  }
  return undefined;
}

function invert(value: Score01): Score01 {
  return clamp01(1 - Number(value));
}

function dedupeStrings(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return Object.freeze(result);
}

// ============================================================================
// MARK: Exports used by adjacent backend learning lane
// ============================================================================

export {
  ARCHETYPE_CATALOG as CHAT_COLD_START_ARCHETYPE_CATALOG,
  DEFAULT_AFFECT as CHAT_COLD_START_DEFAULT_AFFECT,
};
