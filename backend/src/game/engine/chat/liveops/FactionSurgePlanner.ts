/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT LIVEOPS FACTION SURGE PLANNER
 * FILE: backend/src/game/engine/chat/liveops/FactionSurgePlanner.ts
 * VERSION: 2026.03.22-liveops-faction-pressure-doctrine
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Translates active world-event windows into room-local factional surge plans.
 *
 * The scheduler decides what event windows are alive.
 * This planner decides who seizes the room because of them, how pressure bends
 * by channel and mode, which voices should materialize first, how witness count
 * should swell, where helpers are muted, where shadow pressure should deepen,
 * and how downstream orchestrators should read the social weather.
 *
 * Design law
 * ----------
 * This file stays backend-authoritative. It does not mint events. It interprets
 * authoritative event projections and room state into faction surge doctrine.
 */

import type {
  ChatLiveOpsChannelId,
  ChatLiveOpsIntensityBand,
} from '../../../../../../shared/contracts/chat/liveops';

import type {
  GlobalEventFamily,
  GlobalEventProjection,
  GlobalEventSchedulerRoomContext,
} from './GlobalEventScheduler';

export type FactionAlignment =
  | 'HOSTILE'
  | 'TACTICAL'
  | 'PREDATORY'
  | 'HELPER'
  | 'WITNESS'
  | 'CEREMONIAL'
  | 'DISRUPTIVE';

export type FactionVoiceKind =
  | 'SWARM'
  | 'RINGLEADER'
  | 'WHISPER_NETWORK'
  | 'ENFORCER'
  | 'HELPER_CADRE'
  | 'MARKET_WITNESS'
  | 'TRIBUNAL'
  | 'SPECTATOR_CHOIR';

export type FactionPlannerModeId =
  | 'EMPIRE'
  | 'PREDATOR'
  | 'SYNDICATE'
  | 'PHANTOM'
  | 'LOBBY'
  | 'POST_RUN'
  | 'UNKNOWN';

export type FactionThreatAxis =
  | 'PUBLICNESS'
  | 'WITNESS'
  | 'INTERRUPTION'
  | 'HELPER_SUPPRESSION'
  | 'SHADOW_DENSITY'
  | 'RAID_COORDINATION'
  | 'NEGOTIATION_PREDATION'
  | 'CEREMONY';

export type FactionAggressionBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
export type FactionVisibilityApproach = 'PUBLIC' | 'HYBRID' | 'SHADOW';
export type FactionMomentumClass = 'DORMANT' | 'EMERGING' | 'PRESSING' | 'DOMINANT';

export interface FactionDescriptor {
  readonly factionId: string;
  readonly displayName: string;
  readonly alignment: FactionAlignment;
  readonly preferredChannels: readonly ChatLiveOpsChannelId[];
  readonly defaultVoice: FactionVoiceKind;
  readonly intensityBias: number;
  readonly publicnessBias: number;
  readonly rescueBias: number;
  readonly tags: readonly string[];
  readonly familyBias?: Readonly<Partial<Record<GlobalEventFamily, number>>>;
  readonly modeBias?: Readonly<Partial<Record<FactionPlannerModeId, number>>>;
  readonly channelBias?: Readonly<Partial<Record<ChatLiveOpsChannelId, number>>>;
  readonly aggressionFloor?: number;
  readonly voiceCadenceMs?: number;
  readonly visibilityApproach?: FactionVisibilityApproach;
  readonly helperSuppressionBias?: number;
  readonly witnessBias?: number;
  readonly rumorBias?: number;
  readonly raidBias?: number;
  readonly ceremonyBias?: number;
  readonly shadowBias?: number;
}

export interface FactionSurgePlannerOptions {
  readonly factions?: readonly FactionDescriptor[];
  readonly maxPrimaryFactions?: number;
  readonly maxVoiceDirectives?: number;
  readonly helperBlackoutPenalty?: number;
  readonly roomTagWeight?: number;
  readonly eventTagWeight?: number;
  readonly shadowOnlyPenalty?: number;
  readonly visibleBonus?: number;
  readonly hybridBonus?: number;
}

export interface FactionEventImpact {
  readonly eventId: string;
  readonly family: GlobalEventFamily;
  readonly intensity: ChatLiveOpsIntensityBand;
  readonly visibility: 'VISIBLE' | 'SHADOW_ONLY' | 'HYBRID';
  readonly channels: readonly ChatLiveOpsChannelId[];
  readonly channelPressure: Readonly<Record<ChatLiveOpsChannelId, number>>;
  readonly familyWeight: number;
  readonly intensityWeight: number;
  readonly visibilityWeight: number;
  readonly raidWeight: number;
  readonly witnessWeight: number;
  readonly helperSuppressionWeight: number;
  readonly shadowWeight: number;
  readonly recommendedTags: readonly string[];
  readonly notes: readonly string[];
}

export interface FactionRoomSignalProfile {
  readonly roomId: string;
  readonly modeId: FactionPlannerModeId;
  readonly mountTarget: string | null;
  readonly playerCount: number;
  readonly lowShieldPlayerCount: number;
  readonly activeHelperCount: number;
  readonly crowdHeat: number;
  readonly panicLevel: number;
  readonly lowShieldRatio: number;
  readonly helperCoverageRatio: number;
  readonly publicnessDemand: number;
  readonly shadowDemand: number;
  readonly negotiationDemand: number;
  readonly ceremonyDemand: number;
  readonly raidDemand: number;
  readonly rescueDemand: number;
  readonly tags: readonly string[];
  readonly notes: readonly string[];
}

export interface FactionSurgeScoreBreakdown {
  readonly base: number;
  readonly eventFamily: number;
  readonly eventIntensity: number;
  readonly eventVisibility: number;
  readonly eventTag: number;
  readonly roomTag: number;
  readonly crowdHeat: number;
  readonly panic: number;
  readonly lowShield: number;
  readonly helpers: number;
  readonly modeBias: number;
  readonly channelBias: number;
  readonly factionBalance: number;
  readonly raidBias: number;
  readonly rumorBias: number;
  readonly witnessBias: number;
  readonly ceremonyBias: number;
  readonly shadowBias: number;
  readonly rescueBias: number;
  readonly total: number;
}

export interface FactionScoredDescriptor {
  readonly descriptor: FactionDescriptor;
  readonly totalScore: number;
  readonly momentum: FactionMomentumClass;
  readonly aggressionBand: FactionAggressionBand;
  readonly reasons: readonly string[];
  readonly breakdown: FactionSurgeScoreBreakdown;
  readonly eventImpacts: readonly FactionEventImpact[];
  readonly dominantChannels: readonly ChatLiveOpsChannelId[];
  readonly recommendedTags: readonly string[];
}

export interface FactionSurgeChannelDirective {
  readonly channelId: ChatLiveOpsChannelId;
  readonly dominantFactionId: string;
  readonly witnessCountDelta: number;
  readonly crowdHeatDelta: number;
  readonly interruptionPressureDelta: number;
  readonly helperAvailabilityDelta: number;
  readonly whisperPressureDelta: number;
  readonly rumorPressureDelta: number;
  readonly raidCadenceDeltaMs: number;
  readonly publicnessDelta: number;
  readonly shadowPressureDelta: number;
  readonly secondaryFactionIds: readonly string[];
  readonly styleTags: readonly string[];
  readonly notes: readonly string[];
}

export interface FactionVoiceDirective {
  readonly factionId: string;
  readonly voiceKind: FactionVoiceKind;
  readonly confidence: number;
  readonly targetChannels: readonly ChatLiveOpsChannelId[];
  readonly timingBiasMs: number;
  readonly aggressionBand: FactionAggressionBand;
  readonly publicnessWeight: number;
  readonly shadowWeight: number;
  readonly interruptionWeight: number;
  readonly tags: readonly string[];
  readonly notes: readonly string[];
}

export interface FactionSecondaryFactionVector {
  readonly factionId: string;
  readonly alignment: FactionAlignment;
  readonly score: number;
  readonly momentum: FactionMomentumClass;
  readonly roles: readonly string[];
  readonly channels: readonly ChatLiveOpsChannelId[];
}

export interface FactionSurgePlanAudit {
  readonly roomSignals: FactionRoomSignalProfile;
  readonly scoredFactions: readonly FactionScoredDescriptor[];
  readonly familyHistogram: Readonly<Record<GlobalEventFamily, number>>;
  readonly intensityHistogram: Readonly<Record<ChatLiveOpsIntensityBand, number>>;
  readonly channelHistogram: Readonly<Record<ChatLiveOpsChannelId, number>>;
  readonly debugNotes: readonly string[];
}

export interface FactionSurgeNarrativePacket {
  readonly roomId: string;
  readonly primaryFactionId: string;
  readonly primaryAlignment: FactionAlignment;
  readonly headline: string;
  readonly summaryLines: readonly string[];
  readonly callouts: readonly string[];
  readonly broadcastTags: readonly string[];
}

export interface FactionSurgePlanSummary {
  readonly roomId: string;
  readonly primaryFactionId: string;
  readonly primaryAlignment: FactionAlignment;
  readonly intensity: ChatLiveOpsIntensityBand;
  readonly coordinatedRaidActive: boolean;
  readonly helperBlackoutActive: boolean;
  readonly loudestChannelId: ChatLiveOpsChannelId;
  readonly quietestChannelId: ChatLiveOpsChannelId;
  readonly witnessPressureDelta: number;
  readonly shadowPressureDelta: number;
  readonly helperAvailabilityDelta: number;
  readonly topVoiceFactionIds: readonly string[];
  readonly summaryLines: readonly string[];
}

export interface FactionSurgePlan {
  readonly roomId: string;
  readonly eventIds: readonly string[];
  readonly primaryFactionId: string;
  readonly primaryAlignment: FactionAlignment;
  readonly intensity: ChatLiveOpsIntensityBand;
  readonly channelDirectives: readonly FactionSurgeChannelDirective[];
  readonly voiceDirectives: readonly FactionVoiceDirective[];
  readonly helperBlackoutActive: boolean;
  readonly coordinatedRaidActive: boolean;
  readonly witnessPressureDelta: number;
  readonly pressureBiasDelta: number;
  readonly publicnessBiasDelta: number;
  readonly shadowPressureDelta: number;
  readonly helperAvailabilityDelta: number;
  readonly raidCadenceDeltaMs: number;
  readonly secondaryFactions: readonly FactionSecondaryFactionVector[];
  readonly recommendedTags: readonly string[];
  readonly summary: FactionSurgePlanSummary;
  readonly narrative: FactionSurgeNarrativePacket;
  readonly audit: FactionSurgePlanAudit;
  readonly notes: readonly string[];
}

export interface FactionPlanBatchResult {
  readonly plannedAt: number;
  readonly plans: readonly FactionSurgePlan[];
  readonly notes: readonly string[];
}

const CHANNEL_ORDER: readonly ChatLiveOpsChannelId[] = freeze([
  'GLOBAL',
  'SYNDICATE',
  'DEAL_ROOM',
  'LOBBY',
]);

const INTENSITY_WEIGHT: Readonly<Record<ChatLiveOpsIntensityBand, number>> = freeze({
  QUIET: 1,
  ACTIVE: 2,
  SEVERE: 3,
  WORLD_CLASS: 4,
});

const FAMILY_WEIGHT: Readonly<Record<GlobalEventFamily, number>> = freeze({
  SEASON: 2,
  WORLD_EVENT: 3,
  HELPER_BLACKOUT: 5,
  CHANNEL_MUTATOR: 4,
  WHISPER_WINDOW: 3,
  FACTION_SURGE: 4,
  COORDINATED_RAID: 6,
  RIVAL_SPOTLIGHT: 3,
});

const MODE_ALIASES: Readonly<Record<string, FactionPlannerModeId>> = freeze({
  EMPIRE: 'EMPIRE',
  EMPIRE_GAME_SCREEN: 'EMPIRE',
  PREDATOR: 'PREDATOR',
  PREDATOR_GAME_SCREEN: 'PREDATOR',
  DEAL_ROOM: 'PREDATOR',
  SYNDICATE: 'SYNDICATE',
  SYNDICATE_GAME_SCREEN: 'SYNDICATE',
  PHANTOM: 'PHANTOM',
  PHANTOM_GAME_SCREEN: 'PHANTOM',
  LOBBY: 'LOBBY',
  LOBBY_SCREEN: 'LOBBY',
  POST_RUN: 'POST_RUN',
  POST_RUN_SUMMARY: 'POST_RUN',
});

const DEFAULT_OPTIONS: Required<Pick<
  FactionSurgePlannerOptions,
  | 'maxPrimaryFactions'
  | 'maxVoiceDirectives'
  | 'helperBlackoutPenalty'
  | 'roomTagWeight'
  | 'eventTagWeight'
  | 'shadowOnlyPenalty'
  | 'visibleBonus'
  | 'hybridBonus'
>> = freeze({
  maxPrimaryFactions: 3,
  maxVoiceDirectives: 4,
  helperBlackoutPenalty: 6,
  roomTagWeight: 2,
  eventTagWeight: 4,
  shadowOnlyPenalty: 2,
  visibleBonus: 2,
  hybridBonus: 1,
});

const MODE_PROFILE_TAGS: Readonly<Record<FactionPlannerModeId, readonly string[]>> = freeze({
  EMPIRE: freeze(['STRUCTURAL_PRESSURE', 'NETWORK_VISIBILITY', 'STATUS_COMPETITION']),
  PREDATOR: freeze(['DEAL_PREDATION', 'COUNTERPART_PRESSURE', 'LEVERAGE']),
  SYNDICATE: freeze(['TRUST_ARCHITECTURE', 'GROUP_DISCIPLINE', 'INNER_ROOM']),
  PHANTOM: freeze(['LEGEND', 'HAUNTING_MEMORY', 'MYTHIC_PRESSURE']),
  LOBBY: freeze(['STAGING', 'WARMUP', 'PUBLIC_FLOW']),
  POST_RUN: freeze(['AFTERMATH', 'LEGEND_ACCOUNTING', 'RECAP']),
  UNKNOWN: freeze(['GENERIC_PRESSURE']),
});

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function freezeArray<T>(input: readonly T[]): readonly T[] {
  return Object.freeze([...input]);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function safeNumber(value: number | undefined | null, fallback = 0): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function sum(input: readonly number[]): number {
  let total = 0;
  for (const value of input) {
    total += value;
  }
  return total;
}

function average(input: readonly number[]): number {
  return input.length > 0 ? sum(input) / input.length : 0;
}

function uniqueStrings(input: readonly string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of input) {
    if (!seen.has(item)) {
      seen.add(item);
      output.push(item);
    }
  }
  return output;
}

function uniqueChannels(input: readonly ChatLiveOpsChannelId[]): ChatLiveOpsChannelId[] {
  const seen = new Set<ChatLiveOpsChannelId>();
  const output: ChatLiveOpsChannelId[] = [];
  for (const item of input) {
    if (!seen.has(item)) {
      seen.add(item);
      output.push(item);
    }
  }
  return output;
}

function includesAny(pool: readonly string[], probe: readonly string[]): boolean {
  const set = new Set(pool);
  for (const item of probe) {
    if (set.has(item)) {
      return true;
    }
  }
  return false;
}

function toAggressionBand(score: number): FactionAggressionBand {
  if (score >= 0.85) {
    return 'EXTREME';
  }
  if (score >= 0.6) {
    return 'HIGH';
  }
  if (score >= 0.3) {
    return 'MEDIUM';
  }
  return 'LOW';
}

function toMomentumClass(score: number): FactionMomentumClass {
  if (score >= 32) {
    return 'DOMINANT';
  }
  if (score >= 22) {
    return 'PRESSING';
  }
  if (score >= 12) {
    return 'EMERGING';
  }
  return 'DORMANT';
}

function resolvePlannerModeId(room: GlobalEventSchedulerRoomContext): FactionPlannerModeId {
  const probes = [room.mode ?? '', room.mountTarget ?? ''];
  for (const probe of probes) {
    const normalized = probe.trim().toUpperCase();
    if (!normalized) {
      continue;
    }
    if (MODE_ALIASES[normalized]) {
      return MODE_ALIASES[normalized];
    }
  }
  return 'UNKNOWN';
}

function maxIntensityBand(active: readonly GlobalEventProjection[]): ChatLiveOpsIntensityBand {
  if (active.some((event) => event.intensity === 'WORLD_CLASS')) {
    return 'WORLD_CLASS';
  }
  if (active.some((event) => event.intensity === 'SEVERE')) {
    return 'SEVERE';
  }
  if (active.some((event) => event.intensity === 'ACTIVE')) {
    return 'ACTIVE';
  }
  return 'QUIET';
}

function visibilityWeight(
  visibility: GlobalEventProjection['visibility'],
  options: Required<Pick<FactionSurgePlannerOptions, 'shadowOnlyPenalty' | 'visibleBonus' | 'hybridBonus'>>,
): number {
  switch (visibility) {
    case 'VISIBLE':
      return options.visibleBonus;
    case 'HYBRID':
      return options.hybridBonus;
    case 'SHADOW_ONLY':
      return -options.shadowOnlyPenalty;
    default:
      return 0;
  }
}

function createEmptyChannelHistogram(): Record<ChatLiveOpsChannelId, number> {
  return { GLOBAL: 0, SYNDICATE: 0, DEAL_ROOM: 0, LOBBY: 0 };
}

function createEmptyFamilyHistogram(): Record<GlobalEventFamily, number> {
  return {
    SEASON: 0,
    WORLD_EVENT: 0,
    HELPER_BLACKOUT: 0,
    CHANNEL_MUTATOR: 0,
    WHISPER_WINDOW: 0,
    FACTION_SURGE: 0,
    COORDINATED_RAID: 0,
    RIVAL_SPOTLIGHT: 0,
  };
}

function createEmptyIntensityHistogram(): Record<ChatLiveOpsIntensityBand, number> {
  return { QUIET: 0, ACTIVE: 0, SEVERE: 0, WORLD_CLASS: 0 };
}

function collectEventTags(activeEvents: readonly GlobalEventProjection[]): readonly string[] {
  return freezeArray(uniqueStrings(activeEvents.flatMap((event) => [...event.tags, event.displayName, event.headline])));
}

function createRecommendedModeTags(modeId: FactionPlannerModeId): readonly string[] {
  return MODE_PROFILE_TAGS[modeId] ?? MODE_PROFILE_TAGS.UNKNOWN;
}
const DEFAULT_FACTIONS: readonly FactionDescriptor[] = freeze([
  freeze({
    factionId: 'liquidator-circle',
    displayName: 'Liquidator Circle',
    alignment: 'PREDATORY',
    preferredChannels: freeze(['GLOBAL', 'DEAL_ROOM']),
    defaultVoice: 'ENFORCER',
    intensityBias: 4,
    publicnessBias: 2,
    rescueBias: -3,
    tags: freeze(['LIQUIDATOR', 'LOW_SHIELD_HUNT', 'PREDATION']),
    familyBias: freeze({
      SEASON: 0,
      WORLD_EVENT: 0,
      HELPER_BLACKOUT: 0,
      CHANNEL_MUTATOR: 0,
      WHISPER_WINDOW: 0,
      FACTION_SURGE: 5,
      COORDINATED_RAID: 6,
      RIVAL_SPOTLIGHT: 2,
    }),
    modeBias: freeze({
      EMPIRE: 3,
      PREDATOR: 7,
      SYNDICATE: 1,
      PHANTOM: 2,
      LOBBY: 1,
      POST_RUN: 0,
      UNKNOWN: 0,
    }),
    channelBias: freeze({
      GLOBAL: 3,
      SYNDICATE: -1,
      DEAL_ROOM: 6,
      LOBBY: 1,
    }),
    aggressionFloor: 0.84,
    voiceCadenceMs: 820,
    visibilityApproach: 'HYBRID',
    helperSuppressionBias: 7,
    witnessBias: 2,
    rumorBias: 1,
    raidBias: 6,
    ceremonyBias: 2,
    shadowBias: 0,
  }),
  freeze({
    factionId: 'syndicate-tribunal',
    displayName: 'Syndicate Tribunal',
    alignment: 'TACTICAL',
    preferredChannels: freeze(['SYNDICATE', 'DEAL_ROOM']),
    defaultVoice: 'TRIBUNAL',
    intensityBias: 3,
    publicnessBias: -1,
    rescueBias: -1,
    tags: freeze(['SYNDICATE', 'TRIBUNAL', 'REPUTATION']),
    familyBias: freeze({
      SEASON: 3,
      WORLD_EVENT: 0,
      HELPER_BLACKOUT: 0,
      CHANNEL_MUTATOR: 5,
      WHISPER_WINDOW: 0,
      FACTION_SURGE: 4,
      COORDINATED_RAID: 0,
      RIVAL_SPOTLIGHT: 0,
    }),
    modeBias: freeze({
      EMPIRE: 4,
      PREDATOR: 3,
      SYNDICATE: 8,
      PHANTOM: 1,
      LOBBY: 0,
      POST_RUN: 2,
      UNKNOWN: 0,
    }),
    channelBias: freeze({
      GLOBAL: -1,
      SYNDICATE: 6,
      DEAL_ROOM: 5,
      LOBBY: -2,
    }),
    aggressionFloor: 0.58,
    voiceCadenceMs: 980,
    visibilityApproach: 'SHADOW',
    helperSuppressionBias: 4,
    witnessBias: 0,
    rumorBias: 1,
    raidBias: 0,
    ceremonyBias: 0,
    shadowBias: 1,
  }),
  freeze({
    factionId: 'market-witnesses',
    displayName: 'Market Witnesses',
    alignment: 'WITNESS',
    preferredChannels: freeze(['GLOBAL', 'LOBBY']),
    defaultVoice: 'MARKET_WITNESS',
    intensityBias: 2,
    publicnessBias: 4,
    rescueBias: 0,
    tags: freeze(['MARKET_RUMOR', 'WITNESS_SWELL', 'VOLATILITY']),
    familyBias: freeze({
      SEASON: 2,
      WORLD_EVENT: 5,
      HELPER_BLACKOUT: 0,
      CHANNEL_MUTATOR: 0,
      WHISPER_WINDOW: 0,
      FACTION_SURGE: 0,
      COORDINATED_RAID: 0,
      RIVAL_SPOTLIGHT: 4,
    }),
    modeBias: freeze({
      EMPIRE: 2,
      PREDATOR: 1,
      SYNDICATE: 2,
      PHANTOM: 3,
      LOBBY: 5,
      POST_RUN: 4,
      UNKNOWN: 0,
    }),
    channelBias: freeze({
      GLOBAL: 5,
      SYNDICATE: -1,
      DEAL_ROOM: 1,
      LOBBY: 4,
    }),
    aggressionFloor: 0.29,
    voiceCadenceMs: 1200,
    visibilityApproach: 'PUBLIC',
    helperSuppressionBias: 2,
    witnessBias: 5,
    rumorBias: 2,
    raidBias: 0,
    ceremonyBias: 4,
    shadowBias: 0,
  }),
  freeze({
    factionId: 'helper-cadre',
    displayName: 'Helper Cadre',
    alignment: 'HELPER',
    preferredChannels: freeze(['GLOBAL', 'SYNDICATE', 'DEAL_ROOM']),
    defaultVoice: 'HELPER_CADRE',
    intensityBias: 1,
    publicnessBias: 0,
    rescueBias: 5,
    tags: freeze(['HELPER', 'RECOVERY', 'INTERVENTION']),
    familyBias: freeze({
      SEASON: 2,
      WORLD_EVENT: 1,
      HELPER_BLACKOUT: -7,
      CHANNEL_MUTATOR: 0,
      WHISPER_WINDOW: 0,
      FACTION_SURGE: 0,
      COORDINATED_RAID: 0,
      RIVAL_SPOTLIGHT: 0,
    }),
    modeBias: freeze({
      EMPIRE: 3,
      PREDATOR: 0,
      SYNDICATE: 6,
      PHANTOM: 4,
      LOBBY: 2,
      POST_RUN: 5,
      UNKNOWN: 0,
    }),
    channelBias: freeze({
      GLOBAL: 2,
      SYNDICATE: 5,
      DEAL_ROOM: 2,
      LOBBY: 1,
    }),
    aggressionFloor: 0.12,
    voiceCadenceMs: 1440,
    visibilityApproach: 'HYBRID',
    helperSuppressionBias: 1,
    witnessBias: 0,
    rumorBias: 1,
    raidBias: 0,
    ceremonyBias: 0,
    shadowBias: 0,
  }),
  freeze({
    factionId: 'crowd-conclave',
    displayName: 'Crowd Conclave',
    alignment: 'HOSTILE',
    preferredChannels: freeze(['GLOBAL', 'LOBBY']),
    defaultVoice: 'SWARM',
    intensityBias: 3,
    publicnessBias: 5,
    rescueBias: -2,
    tags: freeze(['CROWD', 'PILE_ON', 'WITNESS']),
    familyBias: freeze({
      SEASON: 0,
      WORLD_EVENT: 3,
      HELPER_BLACKOUT: 0,
      CHANNEL_MUTATOR: 2,
      WHISPER_WINDOW: 0,
      FACTION_SURGE: 0,
      COORDINATED_RAID: 0,
      RIVAL_SPOTLIGHT: 5,
    }),
    modeBias: freeze({
      EMPIRE: 3,
      PREDATOR: 2,
      SYNDICATE: -1,
      PHANTOM: 4,
      LOBBY: 6,
      POST_RUN: 5,
      UNKNOWN: 0,
    }),
    channelBias: freeze({
      GLOBAL: 6,
      SYNDICATE: -2,
      DEAL_ROOM: 2,
      LOBBY: 5,
    }),
    aggressionFloor: 0.77,
    voiceCadenceMs: 700,
    visibilityApproach: 'PUBLIC',
    helperSuppressionBias: 5,
    witnessBias: 5,
    rumorBias: 1,
    raidBias: 0,
    ceremonyBias: 5,
    shadowBias: 0,
  }),
  freeze({
    factionId: 'whisper-network',
    displayName: 'Whisper Network',
    alignment: 'DISRUPTIVE',
    preferredChannels: freeze(['SYNDICATE', 'DEAL_ROOM']),
    defaultVoice: 'WHISPER_NETWORK',
    intensityBias: 2,
    publicnessBias: -3,
    rescueBias: -1,
    tags: freeze(['WHISPER_ONLY', 'SHADOW_DENSITY']),
    familyBias: freeze({
      SEASON: 0,
      WORLD_EVENT: 0,
      HELPER_BLACKOUT: 0,
      CHANNEL_MUTATOR: 4,
      WHISPER_WINDOW: 8,
      FACTION_SURGE: 2,
      COORDINATED_RAID: 0,
      RIVAL_SPOTLIGHT: 0,
    }),
    modeBias: freeze({
      EMPIRE: 1,
      PREDATOR: 4,
      SYNDICATE: 5,
      PHANTOM: 7,
      LOBBY: -2,
      POST_RUN: 1,
      UNKNOWN: 0,
    }),
    channelBias: freeze({
      GLOBAL: -4,
      SYNDICATE: 6,
      DEAL_ROOM: 5,
      LOBBY: -3,
    }),
    aggressionFloor: 0.61,
    voiceCadenceMs: 1160,
    visibilityApproach: 'SHADOW',
    helperSuppressionBias: 3,
    witnessBias: 0,
    rumorBias: 2,
    raidBias: 0,
    ceremonyBias: 0,
    shadowBias: 11,
  }),
  freeze({
    factionId: 'spectator-choir',
    displayName: 'Spectator Choir',
    alignment: 'CEREMONIAL',
    preferredChannels: freeze(['GLOBAL', 'LOBBY']),
    defaultVoice: 'SPECTATOR_CHOIR',
    intensityBias: 1,
    publicnessBias: 3,
    rescueBias: 0,
    tags: freeze(['CEREMONY', 'LEGEND', 'WITNESS']),
    familyBias: freeze({
      SEASON: 4,
      WORLD_EVENT: 3,
      HELPER_BLACKOUT: 0,
      CHANNEL_MUTATOR: 0,
      WHISPER_WINDOW: 0,
      FACTION_SURGE: 0,
      COORDINATED_RAID: 0,
      RIVAL_SPOTLIGHT: 2,
    }),
    modeBias: freeze({
      EMPIRE: 3,
      PREDATOR: 0,
      SYNDICATE: 1,
      PHANTOM: 6,
      LOBBY: 5,
      POST_RUN: 6,
      UNKNOWN: 0,
    }),
    channelBias: freeze({
      GLOBAL: 5,
      SYNDICATE: -1,
      DEAL_ROOM: 0,
      LOBBY: 4,
    }),
    aggressionFloor: 0.18,
    voiceCadenceMs: 1320,
    visibilityApproach: 'PUBLIC',
    helperSuppressionBias: 1,
    witnessBias: 4,
    rumorBias: 1,
    raidBias: 0,
    ceremonyBias: 4,
    shadowBias: 0,
  }),
  freeze({
    factionId: 'raid-marshals',
    displayName: 'Raid Marshals',
    alignment: 'TACTICAL',
    preferredChannels: freeze(['GLOBAL', 'SYNDICATE', 'DEAL_ROOM']),
    defaultVoice: 'RINGLEADER',
    intensityBias: 4,
    publicnessBias: 1,
    rescueBias: -3,
    tags: freeze(['RAID', 'BREACH', 'FORMATION']),
    familyBias: freeze({
      SEASON: 0,
      WORLD_EVENT: 2,
      HELPER_BLACKOUT: 0,
      CHANNEL_MUTATOR: 0,
      WHISPER_WINDOW: 0,
      FACTION_SURGE: 3,
      COORDINATED_RAID: 9,
      RIVAL_SPOTLIGHT: 0,
    }),
    modeBias: freeze({
      EMPIRE: 4,
      PREDATOR: 6,
      SYNDICATE: 5,
      PHANTOM: 2,
      LOBBY: 1,
      POST_RUN: -1,
      UNKNOWN: 0,
    }),
    channelBias: freeze({
      GLOBAL: 4,
      SYNDICATE: 4,
      DEAL_ROOM: 4,
      LOBBY: 0,
    }),
    aggressionFloor: 0.82,
    voiceCadenceMs: 640,
    visibilityApproach: 'HYBRID',
    helperSuppressionBias: 7,
    witnessBias: 1,
    rumorBias: 1,
    raidBias: 9,
    ceremonyBias: 0,
    shadowBias: 0,
  }),
  freeze({
    factionId: 'legend-brokers',
    displayName: 'Legend Brokers',
    alignment: 'CEREMONIAL',
    preferredChannels: freeze(['GLOBAL', 'LOBBY']),
    defaultVoice: 'TRIBUNAL',
    intensityBias: 1,
    publicnessBias: 5,
    rescueBias: -1,
    tags: freeze(['LEGEND', 'POSTURE', 'MYTH']),
    familyBias: freeze({
      SEASON: 3,
      WORLD_EVENT: 2,
      HELPER_BLACKOUT: 0,
      CHANNEL_MUTATOR: 0,
      WHISPER_WINDOW: 0,
      FACTION_SURGE: 0,
      COORDINATED_RAID: 0,
      RIVAL_SPOTLIGHT: 7,
    }),
    modeBias: freeze({
      EMPIRE: 4,
      PREDATOR: 1,
      SYNDICATE: 0,
      PHANTOM: 7,
      LOBBY: 4,
      POST_RUN: 8,
      UNKNOWN: 0,
    }),
    channelBias: freeze({
      GLOBAL: 6,
      SYNDICATE: -3,
      DEAL_ROOM: 1,
      LOBBY: 3,
    }),
    aggressionFloor: 0.25,
    voiceCadenceMs: 1110,
    visibilityApproach: 'PUBLIC',
    helperSuppressionBias: 2,
    witnessBias: 6,
    rumorBias: 1,
    raidBias: 0,
    ceremonyBias: 9,
    shadowBias: 0,
  }),
  freeze({
    factionId: 'recovery-cloister',
    displayName: 'Recovery Cloister',
    alignment: 'HELPER',
    preferredChannels: freeze(['SYNDICATE', 'LOBBY']),
    defaultVoice: 'HELPER_CADRE',
    intensityBias: 0,
    publicnessBias: -1,
    rescueBias: 8,
    tags: freeze(['RECOVERY', 'COOLDOWN', 'REPAIR']),
    familyBias: freeze({
      SEASON: 1,
      WORLD_EVENT: 1,
      HELPER_BLACKOUT: -9,
      CHANNEL_MUTATOR: 0,
      WHISPER_WINDOW: 0,
      FACTION_SURGE: 0,
      COORDINATED_RAID: 0,
      RIVAL_SPOTLIGHT: 0,
    }),
    modeBias: freeze({
      EMPIRE: 3,
      PREDATOR: -2,
      SYNDICATE: 7,
      PHANTOM: 5,
      LOBBY: 4,
      POST_RUN: 5,
      UNKNOWN: 0,
    }),
    channelBias: freeze({
      GLOBAL: -1,
      SYNDICATE: 6,
      DEAL_ROOM: 0,
      LOBBY: 5,
    }),
    aggressionFloor: 0.09,
    voiceCadenceMs: 1600,
    visibilityApproach: 'SHADOW',
    helperSuppressionBias: 0,
    witnessBias: 0,
    rumorBias: 1,
    raidBias: 0,
    ceremonyBias: 0,
    shadowBias: 1,
  }),
]);


export class FactionSurgePlanner {
  private readonly factions: readonly FactionDescriptor[];
  private readonly options: Required<Pick<
    FactionSurgePlannerOptions,
    | 'maxPrimaryFactions'
    | 'maxVoiceDirectives'
    | 'helperBlackoutPenalty'
    | 'roomTagWeight'
    | 'eventTagWeight'
    | 'shadowOnlyPenalty'
    | 'visibleBonus'
    | 'hybridBonus'
  >>;

  public constructor(options: FactionSurgePlannerOptions = {}) {
    this.factions = options.factions?.length ? freezeArray(options.factions) : DEFAULT_FACTIONS;
    this.options = freeze({
      maxPrimaryFactions: options.maxPrimaryFactions ?? DEFAULT_OPTIONS.maxPrimaryFactions,
      maxVoiceDirectives: options.maxVoiceDirectives ?? DEFAULT_OPTIONS.maxVoiceDirectives,
      helperBlackoutPenalty: options.helperBlackoutPenalty ?? DEFAULT_OPTIONS.helperBlackoutPenalty,
      roomTagWeight: options.roomTagWeight ?? DEFAULT_OPTIONS.roomTagWeight,
      eventTagWeight: options.eventTagWeight ?? DEFAULT_OPTIONS.eventTagWeight,
      shadowOnlyPenalty: options.shadowOnlyPenalty ?? DEFAULT_OPTIONS.shadowOnlyPenalty,
      visibleBonus: options.visibleBonus ?? DEFAULT_OPTIONS.visibleBonus,
      hybridBonus: options.hybridBonus ?? DEFAULT_OPTIONS.hybridBonus,
    });
  }

  public getFactions(): readonly FactionDescriptor[] {
    return this.factions;
  }

  public getFactionIds(): readonly string[] {
    return freezeArray(this.factions.map((faction) => faction.factionId));
  }

  public getFactionIndex(): Readonly<Record<string, FactionDescriptor>> {
    const index: Record<string, FactionDescriptor> = {};
    for (const faction of this.factions) {
      index[faction.factionId] = faction;
    }
    return freeze(index);
  }

  public plan(
    room: GlobalEventSchedulerRoomContext,
    activeEvents: readonly GlobalEventProjection[],
  ): FactionSurgePlan {
    const roomSignals = this.deriveRoomSignals(room, activeEvents);
    const scoredFactions = this.scoreFactions(roomSignals, activeEvents);
    const primary = scoredFactions[0] ?? this.scoreFallbackFaction(roomSignals, activeEvents);
    const secondary = scoredFactions.slice(1, this.options.maxPrimaryFactions);
    const helperBlackoutActive = activeEvents.some((event) => event.family === 'HELPER_BLACKOUT');
    const coordinatedRaidActive = activeEvents.some((event) => event.family === 'COORDINATED_RAID');
    const channelDirectives = this.buildChannelDirectives(roomSignals, activeEvents, primary, secondary);
    const voiceDirectives = this.buildVoiceDirectives(roomSignals, activeEvents, scoredFactions);
    const recommendedTags = freezeArray(uniqueStrings([
      ...roomSignals.tags,
      ...activeEvents.flatMap((event) => event.tags),
      ...primary.recommendedTags,
      helperBlackoutActive ? 'HELPER_BLACKOUT_ACTIVE' : 'HELPER_RECOVERY_ONLINE',
      coordinatedRaidActive ? 'RAID_ACTIVE' : 'NO_RAID',
      `MODE:${roomSignals.modeId}`,
      `PRIMARY_FACTION:${primary.descriptor.factionId}`,
    ]));
    const secondaryFactions = this.buildSecondaryFactionVectors(secondary);
    const witnessPressureDelta = this.computeWitnessPressureDelta(channelDirectives);
    const publicnessBiasDelta = this.computePublicnessBiasDelta(channelDirectives);
    const shadowPressureDelta = this.computeShadowPressureDelta(channelDirectives);
    const helperAvailabilityDelta = this.computeHelperAvailabilityDelta(channelDirectives);
    const raidCadenceDeltaMs = this.computeRaidCadenceDeltaMs(channelDirectives);
    const summary = this.buildSummary(
      roomSignals,
      primary,
      channelDirectives,
      voiceDirectives,
      helperBlackoutActive,
      coordinatedRaidActive,
      witnessPressureDelta,
      shadowPressureDelta,
      helperAvailabilityDelta,
      maxIntensityBand(activeEvents),
    );
    const audit = this.buildAudit(roomSignals, scoredFactions, activeEvents, channelDirectives);
    const narrative = this.buildNarrative(roomSignals, primary, summary, channelDirectives, activeEvents);

    return freeze({
      roomId: room.roomId,
      eventIds: freezeArray(activeEvents.map((event) => event.eventId)),
      primaryFactionId: primary.descriptor.factionId,
      primaryAlignment: primary.descriptor.alignment,
      intensity: maxIntensityBand(activeEvents),
      channelDirectives,
      voiceDirectives,
      helperBlackoutActive,
      coordinatedRaidActive,
      witnessPressureDelta,
      pressureBiasDelta: primary.totalScore,
      publicnessBiasDelta,
      shadowPressureDelta,
      helperAvailabilityDelta,
      raidCadenceDeltaMs,
      secondaryFactions,
      recommendedTags,
      summary,
      narrative,
      audit,
      notes: freezeArray(uniqueStrings([
        `ROOM:${room.roomId}`,
        `PRIMARY_FACTION:${primary.descriptor.factionId}`,
        `PRIMARY_ALIGNMENT:${primary.descriptor.alignment}`,
        `INTENSITY:${maxIntensityBand(activeEvents)}`,
        `VOICE_DIRECTIVES:${voiceDirectives.length}`,
        `CHANNEL_DIRECTIVES:${channelDirectives.length}`,
        ...primary.reasons.slice(0, 8),
      ])),
    });
  }

  public planBatch(
    rooms: readonly GlobalEventSchedulerRoomContext[],
    activeEventsByRoomId: Readonly<Record<string, readonly GlobalEventProjection[]>>,
    now = Date.now(),
  ): FactionPlanBatchResult {
    const plans = rooms.map((room) => this.plan(room, activeEventsByRoomId[room.roomId] ?? []));
    return freeze({
      plannedAt: now,
      plans: freezeArray(plans),
      notes: freezeArray([
        `ROOM_COUNT:${rooms.length}`,
        `PLAN_COUNT:${plans.length}`,
      ]),
    });
  }

  public summarizePlan(plan: FactionSurgePlan): FactionSurgePlanSummary {
    return plan.summary;
  }

  public describePlan(plan: FactionSurgePlan): readonly string[] {
    return freezeArray([
      `${plan.primaryFactionId} owns ${plan.roomId}`,
      `alignment:${plan.primaryAlignment}`,
      `intensity:${plan.intensity}`,
      `witness:${plan.witnessPressureDelta}`,
      `shadow:${plan.shadowPressureDelta}`,
      `helper:${plan.helperAvailabilityDelta}`,
      ...plan.summary.summaryLines,
    ]);
  }

  public buildNarrativePacket(plan: FactionSurgePlan): FactionSurgeNarrativePacket {
    return plan.narrative;
  }

  public buildPlanAudit(plan: FactionSurgePlan): FactionSurgePlanAudit {
    return plan.audit;
  }

  public rankFactions(
    room: GlobalEventSchedulerRoomContext,
    activeEvents: readonly GlobalEventProjection[],
  ): readonly FactionScoredDescriptor[] {
    return this.scoreFactions(this.deriveRoomSignals(room, activeEvents), activeEvents);
  }

  private deriveRoomSignals(
    room: GlobalEventSchedulerRoomContext,
    activeEvents: readonly GlobalEventProjection[],
  ): FactionRoomSignalProfile {
    const playerCount = Math.max(1, safeNumber(room.playerCount, 1));
    const lowShieldPlayerCount = clamp(safeNumber(room.lowShieldPlayerCount, 0), 0, playerCount);
    const activeHelperCount = clamp(safeNumber(room.activeHelperCount, 0), 0, playerCount);
    const crowdHeat = clamp(safeNumber(room.crowdHeat, 0), 0, 100);
    const panicLevel = clamp(safeNumber(room.panicLevel, 0), 0, 100);
    const lowShieldRatio = lowShieldPlayerCount / Math.max(playerCount, 1);
    const helperCoverageRatio = activeHelperCount / Math.max(playerCount, 1);
    const modeId = resolvePlannerModeId(room);
    const activeIntensities = activeEvents.map((event) => INTENSITY_WEIGHT[event.intensity]);
    const publicEventCount = activeEvents.filter((event) => event.visibility !== 'SHADOW_ONLY').length;
    const shadowEventCount = activeEvents.filter((event) => event.visibility !== 'VISIBLE').length;
    const dealRoomEvents = activeEvents.filter((event) => event.channels.includes('DEAL_ROOM')).length;
    const spotlightEvents = activeEvents.filter((event) => event.family === 'RIVAL_SPOTLIGHT').length;
    const raidEvents = activeEvents.filter((event) => event.family === 'COORDINATED_RAID').length;
    const helperBlackouts = activeEvents.filter((event) => event.family === 'HELPER_BLACKOUT').length;
    const tags = freezeArray(uniqueStrings([
      ...(room.tags ?? []),
      ...createRecommendedModeTags(modeId),
      ...collectEventTags(activeEvents),
      `MODE:${modeId}`,
      publicEventCount > 0 ? 'PUBLIC_EVENT_PRESENT' : 'NO_PUBLIC_EVENT',
      shadowEventCount > 0 ? 'SHADOW_EVENT_PRESENT' : 'NO_SHADOW_EVENT',
      raidEvents > 0 ? 'RAID_WINDOW_PRESENT' : 'NO_RAID_WINDOW',
      helperBlackouts > 0 ? 'HELPER_BLACKOUT_PRESENT' : 'HELPER_CAPABLE',
    ]));

    return freeze({
      roomId: room.roomId,
      modeId,
      mountTarget: room.mountTarget ?? null,
      playerCount,
      lowShieldPlayerCount,
      activeHelperCount,
      crowdHeat,
      panicLevel,
      lowShieldRatio,
      helperCoverageRatio,
      publicnessDemand: clamp((crowdHeat * 0.55) + (publicEventCount * 7) + (spotlightEvents * 9), 0, 100),
      shadowDemand: clamp((shadowEventCount * 12) + ((100 - helperCoverageRatio * 100) * 0.2), 0, 100),
      negotiationDemand: clamp((dealRoomEvents * 16) + (panicLevel * 0.25), 0, 100),
      ceremonyDemand: clamp((spotlightEvents * 18) + (publicEventCount * 5), 0, 100),
      raidDemand: clamp((raidEvents * 20) + (lowShieldRatio * 45), 0, 100),
      rescueDemand: clamp((lowShieldRatio * 55) + ((1 - helperCoverageRatio) * 20) + (helperBlackouts * 12), 0, 100),
      tags,
      notes: freezeArray([
        `MODE:${modeId}`,
        `PLAYER_COUNT:${playerCount}`,
        `LOW_SHIELD_RATIO:${lowShieldRatio.toFixed(3)}`,
        `HELPER_COVERAGE:${helperCoverageRatio.toFixed(3)}`,
        `CROWD_HEAT:${crowdHeat}`,
        `PANIC:${panicLevel}`,
        `INTENSITY_AVG:${average(activeIntensities).toFixed(2)}`,
      ]),
    });
  }

  private scoreFactions(
    roomSignals: FactionRoomSignalProfile,
    activeEvents: readonly GlobalEventProjection[],
  ): readonly FactionScoredDescriptor[] {
    const scored = this.factions.map((descriptor) => this.scoreSingleFaction(descriptor, roomSignals, activeEvents));
    return freezeArray([...scored].sort((left, right) => right.totalScore - left.totalScore));
  }

  private scoreFallbackFaction(
    roomSignals: FactionRoomSignalProfile,
    activeEvents: readonly GlobalEventProjection[],
  ): FactionScoredDescriptor {
    return this.scoreSingleFaction(this.factions[0] ?? DEFAULT_FACTIONS[0], roomSignals, activeEvents);
  }

  private scoreSingleFaction(
    descriptor: FactionDescriptor,
    roomSignals: FactionRoomSignalProfile,
    activeEvents: readonly GlobalEventProjection[],
  ): FactionScoredDescriptor {
    const eventTags = collectEventTags(activeEvents);
    const roomTags = roomSignals.tags;
    const modeBias = safeNumber(descriptor.modeBias?.[roomSignals.modeId], 0);
    const base = descriptor.intensityBias;
    const eventFamily = sum(activeEvents.map((event) => FAMILY_WEIGHT[event.family] + safeNumber(descriptor.familyBias?.[event.family], 0)));
    const eventIntensity = sum(activeEvents.map((event) => INTENSITY_WEIGHT[event.intensity]));
    const eventVisibility = sum(activeEvents.map((event) => visibilityWeight(event.visibility, this.options)));
    const eventTag = includesAny(eventTags, descriptor.tags) ? this.options.eventTagWeight : 0;
    const roomTag = includesAny(roomTags, descriptor.tags) ? this.options.roomTagWeight : 0;
    const crowdHeat = this.scoreCrowdHeat(descriptor, roomSignals);
    const panic = this.scorePanic(descriptor, roomSignals);
    const lowShield = this.scoreLowShield(descriptor, roomSignals);
    const helpers = this.scoreHelpers(descriptor, roomSignals, activeEvents);
    const channelBias = this.scoreChannelBias(descriptor, activeEvents);
    const factionBalance = this.scoreFactionBalance(descriptor, roomSignals);
    const raidBias = this.scoreRaidBias(descriptor, roomSignals, activeEvents);
    const rumorBias = this.scoreRumorBias(descriptor, roomSignals, activeEvents);
    const witnessBias = this.scoreWitnessBias(descriptor, roomSignals, activeEvents);
    const ceremonyBias = this.scoreCeremonyBias(descriptor, roomSignals, activeEvents);
    const shadowBias = this.scoreShadowBias(descriptor, roomSignals, activeEvents);
    const rescueBias = this.scoreRescueBias(descriptor, roomSignals, activeEvents);
    const total =
      base + eventFamily + eventIntensity + eventVisibility + eventTag + roomTag + crowdHeat + panic + lowShield +
      helpers + modeBias + channelBias + factionBalance + raidBias + rumorBias + witnessBias + ceremonyBias +
      shadowBias + rescueBias;

    const breakdown: FactionSurgeScoreBreakdown = freeze({
      base,
      eventFamily,
      eventIntensity,
      eventVisibility,
      eventTag,
      roomTag,
      crowdHeat,
      panic,
      lowShield,
      helpers,
      modeBias,
      channelBias,
      factionBalance,
      raidBias,
      rumorBias,
      witnessBias,
      ceremonyBias,
      shadowBias,
      rescueBias,
      total,
    });

    const eventImpacts = freezeArray(activeEvents.map((event) => this.describeEventImpact(descriptor, event)));
    const dominantChannels = freezeArray(
      uniqueChannels(
        CHANNEL_ORDER
          .map((channelId) => ({ channelId, score: this.computeChannelDominance(descriptor, roomSignals, activeEvents, channelId) }))
          .sort((left, right) => right.score - left.score)
          .filter((entry) => entry.score >= 0)
          .slice(0, 3)
          .map((entry) => entry.channelId),
      ),
    );

    const recommendedTags = freezeArray(uniqueStrings([
      ...descriptor.tags,
      `ALIGNMENT:${descriptor.alignment}`,
      `MODE:${roomSignals.modeId}`,
      ...eventImpacts.flatMap((impact) => impact.recommendedTags),
      ...dominantChannels.map((channelId) => `CHANNEL:${channelId}`),
    ]));

    const reasons = freezeArray(uniqueStrings([
      `BASE:${base}`,
      `MODE_BIAS:${modeBias}`,
      `EVENT_FAMILY:${eventFamily}`,
      `EVENT_INTENSITY:${eventIntensity}`,
      eventTag ? `EVENT_TAG:+${eventTag}` : 'EVENT_TAG:+0',
      roomTag ? `ROOM_TAG:+${roomTag}` : 'ROOM_TAG:+0',
      `CROWD_HEAT:${crowdHeat}`,
      `PANIC:${panic}`,
      `LOW_SHIELD:${lowShield}`,
      `HELPERS:${helpers}`,
      `CHANNEL_BIAS:${channelBias}`,
      `RAID_BIAS:${raidBias}`,
      `WITNESS_BIAS:${witnessBias}`,
      `SHADOW_BIAS:${shadowBias}`,
      `TOTAL:${total}`,
    ]));

    return freeze({
      descriptor,
      totalScore: total,
      momentum: toMomentumClass(total),
      aggressionBand: toAggressionBand(clamp((descriptor.aggressionFloor ?? 0.25) + (total / 60), 0, 1)),
      reasons,
      breakdown,
      eventImpacts,
      dominantChannels,
      recommendedTags,
    });
  }

  private describeEventImpact(
    descriptor: FactionDescriptor,
    event: GlobalEventProjection,
  ): FactionEventImpact {
    const familyWeight = FAMILY_WEIGHT[event.family] + safeNumber(descriptor.familyBias?.[event.family], 0);
    const intensityWeight = INTENSITY_WEIGHT[event.intensity];
    const visibility = visibilityWeight(event.visibility, this.options);
    const raidWeight = event.family === 'COORDINATED_RAID' ? safeNumber(descriptor.raidBias, 0) : 0;
    const witnessWeight = (event.visibility !== 'SHADOW_ONLY' ? 1 : -1) * safeNumber(descriptor.witnessBias, 0);
    const helperSuppressionWeight = event.family === 'HELPER_BLACKOUT' ? -safeNumber(descriptor.rescueBias, 0) : 0;
    const shadowWeight = event.visibility !== 'VISIBLE' ? safeNumber(descriptor.shadowBias, 0) : 0;
    const channelPressure: Record<ChatLiveOpsChannelId, number> = createEmptyChannelHistogram();
    for (const channelId of CHANNEL_ORDER) {
      channelPressure[channelId] = (event.channels.includes(channelId) ? Math.ceil((event.channelPriority[channelId] ?? 0) / 25) : 0)
        + safeNumber(descriptor.channelBias?.[channelId], 0);
    }
    return freeze({
      eventId: event.eventId,
      family: event.family,
      intensity: event.intensity,
      visibility: event.visibility,
      channels: freezeArray(event.channels),
      channelPressure: freeze(channelPressure),
      familyWeight,
      intensityWeight,
      visibilityWeight: visibility,
      raidWeight,
      witnessWeight,
      helperSuppressionWeight,
      shadowWeight,
      recommendedTags: freezeArray(uniqueStrings([
        ...event.tags,
        `EVENT_FAMILY:${event.family}`,
        `EVENT_INTENSITY:${event.intensity}`,
        `EVENT_VISIBILITY:${event.visibility}`,
      ])),
      notes: freezeArray([
        `EVENT:${event.eventId}`,
        `FAMILY_WEIGHT:${familyWeight}`,
        `INTENSITY_WEIGHT:${intensityWeight}`,
        `VISIBILITY_WEIGHT:${visibility}`,
      ]),
    });
  }

  private scoreCrowdHeat(descriptor: FactionDescriptor, roomSignals: FactionRoomSignalProfile): number {
    if (descriptor.alignment === 'HOSTILE' || descriptor.alignment === 'WITNESS') {
      return Math.round(roomSignals.crowdHeat / 18);
    }
    if (descriptor.alignment === 'CEREMONIAL') {
      return Math.round(roomSignals.publicnessDemand / 30);
    }
    return Math.round(roomSignals.crowdHeat / 45);
  }

  private scorePanic(descriptor: FactionDescriptor, roomSignals: FactionRoomSignalProfile): number {
    if (descriptor.alignment === 'TACTICAL' || descriptor.alignment === 'PREDATORY') {
      return Math.round(roomSignals.panicLevel / 20);
    }
    if (descriptor.alignment === 'HELPER') {
      return Math.round(roomSignals.rescueDemand / 25);
    }
    return Math.round(roomSignals.panicLevel / 40);
  }

  private scoreLowShield(descriptor: FactionDescriptor, roomSignals: FactionRoomSignalProfile): number {
    if (descriptor.tags.includes('LOW_SHIELD_HUNT')) {
      return Math.round(roomSignals.lowShieldRatio * 14);
    }
    if (descriptor.alignment === 'HELPER') {
      return Math.round(roomSignals.rescueDemand / 22);
    }
    return Math.round(roomSignals.lowShieldRatio * 5);
  }

  private scoreHelpers(
    descriptor: FactionDescriptor,
    roomSignals: FactionRoomSignalProfile,
    activeEvents: readonly GlobalEventProjection[],
  ): number {
    const helperBlackoutActive = activeEvents.some((event) => event.family === 'HELPER_BLACKOUT');
    if (helperBlackoutActive && descriptor.alignment === 'HELPER') {
      return -this.options.helperBlackoutPenalty;
    }
    if (descriptor.alignment === 'HELPER') {
      return Math.round(roomSignals.activeHelperCount * 1.5) + Math.round(roomSignals.rescueDemand / 20);
    }
    return roomSignals.activeHelperCount > 0 ? -Math.round(roomSignals.helperCoverageRatio * 4) : 1;
  }

  private scoreChannelBias(
    descriptor: FactionDescriptor,
    activeEvents: readonly GlobalEventProjection[],
  ): number {
    return sum(CHANNEL_ORDER.map((channelId) => {
      const eventSupport = activeEvents.some((event) => event.channels.includes(channelId)) ? 1 : 0;
      return safeNumber(descriptor.channelBias?.[channelId], 0) * eventSupport;
    }));
  }

  private scoreFactionBalance(
    descriptor: FactionDescriptor,
    roomSignals: FactionRoomSignalProfile,
  ): number {
    const dominant = roomSignals.tags.find((tag) => tag.startsWith('FACTION:'));
    if (dominant && dominant.includes(descriptor.factionId)) {
      return 3;
    }
    if (descriptor.alignment === 'TACTICAL' && roomSignals.modeId === 'SYNDICATE') {
      return 2;
    }
    return 0;
  }

  private scoreRaidBias(
    descriptor: FactionDescriptor,
    roomSignals: FactionRoomSignalProfile,
    activeEvents: readonly GlobalEventProjection[],
  ): number {
    const raidEvents = activeEvents.filter((event) => event.family === 'COORDINATED_RAID').length;
    return Math.round((safeNumber(descriptor.raidBias, 0) + roomSignals.raidDemand / 20) * Math.max(raidEvents, 1) / 2);
  }

  private scoreRumorBias(
    descriptor: FactionDescriptor,
    roomSignals: FactionRoomSignalProfile,
    activeEvents: readonly GlobalEventProjection[],
  ): number {
    const rumorEvents = activeEvents.filter((event) => event.visibility !== 'VISIBLE').length;
    return Math.round((safeNumber(descriptor.rumorBias, 0) * rumorEvents) + roomSignals.shadowDemand / 30);
  }

  private scoreWitnessBias(
    descriptor: FactionDescriptor,
    roomSignals: FactionRoomSignalProfile,
    activeEvents: readonly GlobalEventProjection[],
  ): number {
    const publicEvents = activeEvents.filter((event) => event.visibility !== 'SHADOW_ONLY').length;
    return Math.round((safeNumber(descriptor.witnessBias, 0) * publicEvents) + roomSignals.publicnessDemand / 25);
  }

  private scoreCeremonyBias(
    descriptor: FactionDescriptor,
    roomSignals: FactionRoomSignalProfile,
    activeEvents: readonly GlobalEventProjection[],
  ): number {
    const spotlightEvents = activeEvents.filter((event) => event.family === 'RIVAL_SPOTLIGHT').length;
    return Math.round((safeNumber(descriptor.ceremonyBias, 0) * Math.max(spotlightEvents, 1)) / 2 + roomSignals.ceremonyDemand / 30);
  }

  private scoreShadowBias(
    descriptor: FactionDescriptor,
    roomSignals: FactionRoomSignalProfile,
    activeEvents: readonly GlobalEventProjection[],
  ): number {
    const shadowEvents = activeEvents.filter((event) => event.visibility !== 'VISIBLE').length;
    return Math.round((safeNumber(descriptor.shadowBias, 0) * Math.max(shadowEvents, 1)) / 2 + roomSignals.shadowDemand / 24);
  }

  private scoreRescueBias(
    descriptor: FactionDescriptor,
    roomSignals: FactionRoomSignalProfile,
    activeEvents: readonly GlobalEventProjection[],
  ): number {
    const blackoutEvents = activeEvents.filter((event) => event.family === 'HELPER_BLACKOUT').length;
    if (descriptor.alignment === 'HELPER') {
      return Math.round((descriptor.rescueBias * Math.max(1, Math.round(roomSignals.rescueDemand / 25))) - (blackoutEvents * 2));
    }
    return Math.round(-descriptor.rescueBias / 2);
  }

  private computeChannelDominance(
    descriptor: FactionDescriptor,
    roomSignals: FactionRoomSignalProfile,
    activeEvents: readonly GlobalEventProjection[],
    channelId: ChatLiveOpsChannelId,
  ): number {
    const eventWeight = sum(activeEvents.map((event) => {
      if (!event.channels.includes(channelId)) {
        return 0;
      }
      return Math.ceil((event.channelPriority[channelId] ?? 0) / 25) + INTENSITY_WEIGHT[event.intensity];
    }));
    const preferredWeight = descriptor.preferredChannels.includes(channelId) ? 4 : 0;
    const bias = safeNumber(descriptor.channelBias?.[channelId], 0);
    const modeBonus = roomSignals.modeId === 'PREDATOR' && channelId === 'DEAL_ROOM'
      ? 3
      : roomSignals.modeId === 'SYNDICATE' && channelId === 'SYNDICATE'
        ? 3
        : roomSignals.modeId === 'PHANTOM' && channelId === 'GLOBAL'
          ? 2
          : 0;
    return eventWeight + preferredWeight + bias + modeBonus;
  }

  private buildChannelDirectives(
    roomSignals: FactionRoomSignalProfile,
    activeEvents: readonly GlobalEventProjection[],
    primary: FactionScoredDescriptor,
    secondary: readonly FactionScoredDescriptor[],
  ): readonly FactionSurgeChannelDirective[] {
    const channels = uniqueChannels([
      ...CHANNEL_ORDER,
      ...activeEvents.flatMap((event) => event.channels),
      ...primary.dominantChannels,
      ...secondary.flatMap((entry) => entry.dominantChannels),
    ]);

    const directives = channels.map((channelId) => {
      const channelPressure = sum(activeEvents.map((event) => {
        if (!event.channels.includes(channelId)) {
          return 0;
        }
        return Math.ceil((event.channelPriority[channelId] ?? 0) / 20) + INTENSITY_WEIGHT[event.intensity];
      }));
      const dominantScore = this.computeChannelDominance(primary.descriptor, roomSignals, activeEvents, channelId);
      const secondaryFactionIds = freezeArray(
        secondary
          .filter((entry) => this.computeChannelDominance(entry.descriptor, roomSignals, activeEvents, channelId) >= dominantScore - 3)
          .slice(0, 3)
          .map((entry) => entry.descriptor.factionId),
      );
      const witnessCountDelta = Math.max(0, Math.round((roomSignals.playerCount * 0.12) + (roomSignals.publicnessDemand / 20) + channelPressure));
      const crowdHeatDelta = Math.round(channelPressure + (channelId === 'GLOBAL' ? 3 : 1) + (primary.descriptor.alignment === 'HOSTILE' ? 2 : 0));
      const interruptionPressureDelta = Math.round(channelPressure + (channelId === 'DEAL_ROOM' ? roomSignals.negotiationDemand / 22 : roomSignals.panicLevel / 35));
      const helperAvailabilityDelta = Math.round(
        primary.descriptor.alignment === 'HELPER'
          ? primary.descriptor.rescueBias + roomSignals.activeHelperCount
          : -Math.max(0, (roomSignals.rescueDemand / 18) - roomSignals.activeHelperCount),
      );
      const whisperPressureDelta = Math.round(
        channelId === 'SYNDICATE' || channelId === 'DEAL_ROOM'
          ? (roomSignals.shadowDemand / 15) + safeNumber(primary.descriptor.shadowBias, 0)
          : roomSignals.shadowDemand / 30,
      );
      const rumorPressureDelta = Math.round((roomSignals.shadowDemand / 22) + safeNumber(primary.descriptor.rumorBias, 0));
      const raidCadenceDeltaMs = Math.max(150, Math.round((primary.descriptor.voiceCadenceMs ?? 1000) - (roomSignals.raidDemand * 4) - (channelId === 'DEAL_ROOM' ? 110 : 0)));
      const publicnessDelta = Math.round((channelId === 'GLOBAL' || channelId === 'LOBBY' ? roomSignals.publicnessDemand / 14 : roomSignals.publicnessDemand / 26) + primary.descriptor.publicnessBias);
      const shadowPressureDelta = Math.round((channelId === 'SYNDICATE' || channelId === 'DEAL_ROOM' ? roomSignals.shadowDemand / 14 : roomSignals.shadowDemand / 28) + safeNumber(primary.descriptor.shadowBias, 0));
      return freeze({
        channelId,
        dominantFactionId: primary.descriptor.factionId,
        witnessCountDelta,
        crowdHeatDelta,
        interruptionPressureDelta,
        helperAvailabilityDelta,
        whisperPressureDelta,
        rumorPressureDelta,
        raidCadenceDeltaMs,
        publicnessDelta,
        shadowPressureDelta,
        secondaryFactionIds,
        styleTags: freezeArray(uniqueStrings([
          ...primary.recommendedTags,
          `CHANNEL:${channelId}`,
          channelId === 'GLOBAL' ? 'THEATRICAL' : channelId === 'SYNDICATE' ? 'TRUST_ROOM' : channelId === 'DEAL_ROOM' ? 'PREDATORY_CHAMBER' : 'STAGING_ROOM',
        ])),
        notes: freezeArray([
          `CHANNEL:${channelId}`,
          `CHANNEL_PRESSURE:${channelPressure}`,
          `DOMINANT_SCORE:${dominantScore}`,
          `WITNESS_DELTA:${witnessCountDelta}`,
          `SHADOW_DELTA:${shadowPressureDelta}`,
        ]),
      });
    });

    return freezeArray(directives.sort((left, right) => right.crowdHeatDelta - left.crowdHeatDelta));
  }

  private buildVoiceDirectives(
    roomSignals: FactionRoomSignalProfile,
    activeEvents: readonly GlobalEventProjection[],
    scoredFactions: readonly FactionScoredDescriptor[],
  ): readonly FactionVoiceDirective[] {
    const primaryEvents = activeEvents.slice(0, 3);
    const directives = scoredFactions
      .slice(0, this.options.maxVoiceDirectives)
      .map((entry, index) => {
        const targetChannels = freezeArray(uniqueChannels([
          ...entry.dominantChannels,
          ...entry.descriptor.preferredChannels,
        ]).slice(0, 3));
        const confidence = clamp((entry.totalScore / 40) + index * 0.03, 0.2, 1);
        const timingBiasMs = Math.max(
          180,
          Math.round((entry.descriptor.voiceCadenceMs ?? 1000) - (roomSignals.panicLevel * 3) - (roomSignals.raidDemand * 2) + (index * 190)),
        );
        const publicnessWeight = Math.round((roomSignals.publicnessDemand / 18) + entry.descriptor.publicnessBias);
        const shadowWeight = Math.round((roomSignals.shadowDemand / 18) + safeNumber(entry.descriptor.shadowBias, 0));
        const interruptionWeight = Math.round((roomSignals.panicLevel / 18) + (entry.descriptor.alignment === 'PREDATORY' ? 3 : 0));
        return freeze({
          factionId: entry.descriptor.factionId,
          voiceKind: entry.descriptor.defaultVoice,
          confidence,
          targetChannels,
          timingBiasMs,
          aggressionBand: entry.aggressionBand,
          publicnessWeight,
          shadowWeight,
          interruptionWeight,
          tags: freezeArray(uniqueStrings([
            ...entry.recommendedTags,
            ...primaryEvents.flatMap((event) => event.tags.slice(0, 2)),
            `VOICE:${entry.descriptor.defaultVoice}`,
          ])),
          notes: freezeArray([
            `FACTION:${entry.descriptor.factionId}`,
            `CONFIDENCE:${confidence.toFixed(3)}`,
            `TIMING:${timingBiasMs}`,
          ]),
        });
      });

    return freezeArray(directives);
  }

  private buildSecondaryFactionVectors(
    secondary: readonly FactionScoredDescriptor[],
  ): readonly FactionSecondaryFactionVector[] {
    return freezeArray(secondary.map((entry) => freeze({
      factionId: entry.descriptor.factionId,
      alignment: entry.descriptor.alignment,
      score: entry.totalScore,
      momentum: entry.momentum,
      roles: freezeArray(uniqueStrings([
        entry.descriptor.alignment,
        ...entry.descriptor.tags.slice(0, 3),
      ])),
      channels: freezeArray(entry.dominantChannels),
    })));
  }

  private buildSummary(
    roomSignals: FactionRoomSignalProfile,
    primary: FactionScoredDescriptor,
    channelDirectives: readonly FactionSurgeChannelDirective[],
    voiceDirectives: readonly FactionVoiceDirective[],
    helperBlackoutActive: boolean,
    coordinatedRaidActive: boolean,
    witnessPressureDelta: number,
    shadowPressureDelta: number,
    helperAvailabilityDelta: number,
    intensity: ChatLiveOpsIntensityBand,
  ): FactionSurgePlanSummary {
    const loudestChannel = channelDirectives[0]?.channelId ?? 'GLOBAL';
    const quietestChannel = [...channelDirectives].sort((left, right) => left.crowdHeatDelta - right.crowdHeatDelta)[0]?.channelId ?? 'LOBBY';
    return freeze({
      roomId: roomSignals.roomId,
      primaryFactionId: primary.descriptor.factionId,
      primaryAlignment: primary.descriptor.alignment,
      intensity,
      coordinatedRaidActive,
      helperBlackoutActive,
      loudestChannelId: loudestChannel,
      quietestChannelId: quietestChannel,
      witnessPressureDelta,
      shadowPressureDelta,
      helperAvailabilityDelta,
      topVoiceFactionIds: freezeArray(voiceDirectives.map((directive) => directive.factionId)),
      summaryLines: freezeArray([
        `${primary.descriptor.displayName} drives the room through ${loudestChannel}.`,
        `Mode ${roomSignals.modeId} biases pressure toward ${primary.descriptor.alignment.toLowerCase()} behavior.`,
        helperBlackoutActive
          ? 'Helper rescue is partially suppressed by liveops blackout pressure.'
          : 'Helper rescue remains available if the room buckles too far.',
        coordinatedRaidActive
          ? 'Raid cadence is accelerated and interruption order should be treated as coordinated.'
          : 'Raid cadence remains background rather than dominant.',
      ]),
    });
  }

  private buildAudit(
    roomSignals: FactionRoomSignalProfile,
    scoredFactions: readonly FactionScoredDescriptor[],
    activeEvents: readonly GlobalEventProjection[],
    channelDirectives: readonly FactionSurgeChannelDirective[],
  ): FactionSurgePlanAudit {
    const familyHistogram = createEmptyFamilyHistogram();
    const intensityHistogram = createEmptyIntensityHistogram();
    const channelHistogram = createEmptyChannelHistogram();
    for (const event of activeEvents) {
      familyHistogram[event.family] += 1;
      intensityHistogram[event.intensity] += 1;
      for (const channelId of event.channels) {
        channelHistogram[channelId] += 1;
      }
    }
    return freeze({
      roomSignals,
      scoredFactions,
      familyHistogram: freeze(familyHistogram),
      intensityHistogram: freeze(intensityHistogram),
      channelHistogram: freeze(channelHistogram),
      debugNotes: freezeArray([
        `ROOM:${roomSignals.roomId}`,
        `MODE:${roomSignals.modeId}`,
        `EVENT_COUNT:${activeEvents.length}`,
        `CHANNEL_COUNT:${channelDirectives.length}`,
        `TOP_FACTION:${scoredFactions[0]?.descriptor.factionId ?? 'NONE'}`,
      ]),
    });
  }

  private buildNarrative(
    roomSignals: FactionRoomSignalProfile,
    primary: FactionScoredDescriptor,
    summary: FactionSurgePlanSummary,
    channelDirectives: readonly FactionSurgeChannelDirective[],
    activeEvents: readonly GlobalEventProjection[],
  ): FactionSurgeNarrativePacket {
    const loudestChannel = channelDirectives[0]?.channelId ?? 'GLOBAL';
    const activeEventNames = activeEvents.slice(0, 3).map((event) => event.displayName);
    return freeze({
      roomId: roomSignals.roomId,
      primaryFactionId: primary.descriptor.factionId,
      primaryAlignment: primary.descriptor.alignment,
      headline: `${primary.descriptor.displayName} seize ${roomSignals.roomId} via ${loudestChannel}`,
      summaryLines: freezeArray([
        ...summary.summaryLines,
        activeEventNames.length > 0
          ? `Current windows shaping this room: ${activeEventNames.join(', ')}.`
          : 'No explicit world-event banners are active; faction posture is being inferred from room state.',
      ]),
      callouts: freezeArray([
        `Witness delta ${summary.witnessPressureDelta}`,
        `Shadow delta ${summary.shadowPressureDelta}`,
        `Helper delta ${summary.helperAvailabilityDelta}`,
      ]),
      broadcastTags: freezeArray(uniqueStrings([
        ...primary.recommendedTags,
        ...roomSignals.tags,
      ])),
    });
  }

  private computeWitnessPressureDelta(directives: readonly FactionSurgeChannelDirective[]): number {
    return directives.reduce((sum, directive) => sum + directive.witnessCountDelta, 0);
  }

  private computePublicnessBiasDelta(directives: readonly FactionSurgeChannelDirective[]): number {
    return directives.reduce((sum, directive) => sum + directive.publicnessDelta, 0);
  }

  private computeShadowPressureDelta(directives: readonly FactionSurgeChannelDirective[]): number {
    return directives.reduce((sum, directive) => sum + directive.shadowPressureDelta + directive.whisperPressureDelta, 0);
  }

  private computeHelperAvailabilityDelta(directives: readonly FactionSurgeChannelDirective[]): number {
    return directives.reduce((sum, directive) => sum + directive.helperAvailabilityDelta, 0);
  }

  private computeRaidCadenceDeltaMs(directives: readonly FactionSurgeChannelDirective[]): number {
    const cadence = average(directives.map((directive) => directive.raidCadenceDeltaMs));
    return Math.round(cadence);
  }
}

export function createFactionSurgePlanner(options: FactionSurgePlannerOptions = {}): FactionSurgePlanner {
  return new FactionSurgePlanner(options);
}

export function createDefaultFactionDescriptors(): readonly FactionDescriptor[] {
  return DEFAULT_FACTIONS;
}

export function listFactionIdsByAlignment(
  alignment: FactionAlignment,
  factions: readonly FactionDescriptor[] = DEFAULT_FACTIONS,
): readonly string[] {
  return freezeArray(factions.filter((faction) => faction.alignment === alignment).map((faction) => faction.factionId));
}

export function planFactionSurge(
  room: GlobalEventSchedulerRoomContext,
  activeEvents: readonly GlobalEventProjection[],
  options: FactionSurgePlannerOptions = {},
): FactionSurgePlan {
  return createFactionSurgePlanner(options).plan(room, activeEvents);
}

export function summarizeFactionSurgePlan(plan: FactionSurgePlan): FactionSurgePlanSummary {
  return plan.summary;
}

export function buildFactionSurgeNarrativePacket(plan: FactionSurgePlan): FactionSurgeNarrativePacket {
  return plan.narrative;
}

export function buildFactionSurgePlanAudit(plan: FactionSurgePlan): FactionSurgePlanAudit {
  return plan.audit;
}

export function isEmpireMode(room: GlobalEventSchedulerRoomContext): boolean {
  return resolvePlannerModeId(room) === 'EMPIRE';
}

export function isPredatorMode(room: GlobalEventSchedulerRoomContext): boolean {
  return resolvePlannerModeId(room) === 'PREDATOR';
}

export function isSyndicateMode(room: GlobalEventSchedulerRoomContext): boolean {
  return resolvePlannerModeId(room) === 'SYNDICATE';
}

export function isPhantomMode(room: GlobalEventSchedulerRoomContext): boolean {
  return resolvePlannerModeId(room) === 'PHANTOM';
}

export function isLobbyMode(room: GlobalEventSchedulerRoomContext): boolean {
  return resolvePlannerModeId(room) === 'LOBBY';
}

export function isPostRunMode(room: GlobalEventSchedulerRoomContext): boolean {
  return resolvePlannerModeId(room) === 'POST_RUN';
}

export function isUnknownMode(room: GlobalEventSchedulerRoomContext): boolean {
  return resolvePlannerModeId(room) === 'UNKNOWN';
}

export function computeGlobalChannelPriority(
  activeEvents: readonly GlobalEventProjection[],
): number {
  return activeEvents.reduce((sum, event) => {
    if (!event.channels.includes('GLOBAL')) {
      return sum;
    }
    return sum + Math.ceil((event.channelPriority['GLOBAL'] ?? 0) / 10) + INTENSITY_WEIGHT[event.intensity];
  }, 0);
}

export function computeSyndicateChannelPriority(
  activeEvents: readonly GlobalEventProjection[],
): number {
  return activeEvents.reduce((sum, event) => {
    if (!event.channels.includes('SYNDICATE')) {
      return sum;
    }
    return sum + Math.ceil((event.channelPriority['SYNDICATE'] ?? 0) / 10) + INTENSITY_WEIGHT[event.intensity];
  }, 0);
}

export function computeDealRoomChannelPriority(
  activeEvents: readonly GlobalEventProjection[],
): number {
  return activeEvents.reduce((sum, event) => {
    if (!event.channels.includes('DEAL_ROOM')) {
      return sum;
    }
    return sum + Math.ceil((event.channelPriority['DEAL_ROOM'] ?? 0) / 10) + INTENSITY_WEIGHT[event.intensity];
  }, 0);
}

export function computeLobbyChannelPriority(
  activeEvents: readonly GlobalEventProjection[],
): number {
  return activeEvents.reduce((sum, event) => {
    if (!event.channels.includes('LOBBY')) {
      return sum;
    }
    return sum + Math.ceil((event.channelPriority['LOBBY'] ?? 0) / 10) + INTENSITY_WEIGHT[event.intensity];
  }, 0);
}

export function createHostileFactionDescriptors(
  factions: readonly FactionDescriptor[] = DEFAULT_FACTIONS,
): readonly FactionDescriptor[] {
  return freezeArray(factions.filter((faction) => faction.alignment === 'HOSTILE'));
}

export function createTacticalFactionDescriptors(
  factions: readonly FactionDescriptor[] = DEFAULT_FACTIONS,
): readonly FactionDescriptor[] {
  return freezeArray(factions.filter((faction) => faction.alignment === 'TACTICAL'));
}

export function createPredatoryFactionDescriptors(
  factions: readonly FactionDescriptor[] = DEFAULT_FACTIONS,
): readonly FactionDescriptor[] {
  return freezeArray(factions.filter((faction) => faction.alignment === 'PREDATORY'));
}

export function createHelperFactionDescriptors(
  factions: readonly FactionDescriptor[] = DEFAULT_FACTIONS,
): readonly FactionDescriptor[] {
  return freezeArray(factions.filter((faction) => faction.alignment === 'HELPER'));
}

export function createWitnessFactionDescriptors(
  factions: readonly FactionDescriptor[] = DEFAULT_FACTIONS,
): readonly FactionDescriptor[] {
  return freezeArray(factions.filter((faction) => faction.alignment === 'WITNESS'));
}

export function createCeremonialFactionDescriptors(
  factions: readonly FactionDescriptor[] = DEFAULT_FACTIONS,
): readonly FactionDescriptor[] {
  return freezeArray(factions.filter((faction) => faction.alignment === 'CEREMONIAL'));
}

export function createDisruptiveFactionDescriptors(
  factions: readonly FactionDescriptor[] = DEFAULT_FACTIONS,
): readonly FactionDescriptor[] {
  return freezeArray(factions.filter((faction) => faction.alignment === 'DISRUPTIVE'));
}

export function computeSeasonEventCount(
  activeEvents: readonly GlobalEventProjection[],
): number {
  return activeEvents.filter((event) => event.family === 'SEASON').length;
}

export function computeWorldEventEventCount(
  activeEvents: readonly GlobalEventProjection[],
): number {
  return activeEvents.filter((event) => event.family === 'WORLD_EVENT').length;
}

export function computeHelperBlackoutEventCount(
  activeEvents: readonly GlobalEventProjection[],
): number {
  return activeEvents.filter((event) => event.family === 'HELPER_BLACKOUT').length;
}

export function computeChannelMutatorEventCount(
  activeEvents: readonly GlobalEventProjection[],
): number {
  return activeEvents.filter((event) => event.family === 'CHANNEL_MUTATOR').length;
}

export function computeWhisperWindowEventCount(
  activeEvents: readonly GlobalEventProjection[],
): number {
  return activeEvents.filter((event) => event.family === 'WHISPER_WINDOW').length;
}

export function computeFactionSurgeEventCount(
  activeEvents: readonly GlobalEventProjection[],
): number {
  return activeEvents.filter((event) => event.family === 'FACTION_SURGE').length;
}

export function computeCoordinatedRaidEventCount(
  activeEvents: readonly GlobalEventProjection[],
): number {
  return activeEvents.filter((event) => event.family === 'COORDINATED_RAID').length;
}

export function computeRivalSpotlightEventCount(
  activeEvents: readonly GlobalEventProjection[],
): number {
  return activeEvents.filter((event) => event.family === 'RIVAL_SPOTLIGHT').length;
}

export function computeEmpireGlobalReadiness(
  room: GlobalEventSchedulerRoomContext,
  activeEvents: readonly GlobalEventProjection[],
): number {
  const modeMatch = resolvePlannerModeId(room) === 'EMPIRE' ? 6 : 0;
  const channelPriority = activeEvents.reduce((sum, event) => {
    if (!event.channels.includes('GLOBAL')) {
      return sum;
    }
    return sum + Math.ceil((event.channelPriority['GLOBAL'] ?? 0) / 20);
  }, 0);
  const intensity = sum(activeEvents.map((event) => INTENSITY_WEIGHT[event.intensity]));
  return modeMatch + channelPriority + intensity;
}

export function computeEmpireSyndicateReadiness(
  room: GlobalEventSchedulerRoomContext,
  activeEvents: readonly GlobalEventProjection[],
): number {
  const modeMatch = resolvePlannerModeId(room) === 'EMPIRE' ? 6 : 0;
  const channelPriority = activeEvents.reduce((sum, event) => {
    if (!event.channels.includes('SYNDICATE')) {
      return sum;
    }
    return sum + Math.ceil((event.channelPriority['SYNDICATE'] ?? 0) / 20);
  }, 0);
  const intensity = sum(activeEvents.map((event) => INTENSITY_WEIGHT[event.intensity]));
  return modeMatch + channelPriority + intensity;
}

export function computeEmpireDealRoomReadiness(
  room: GlobalEventSchedulerRoomContext,
  activeEvents: readonly GlobalEventProjection[],
): number {
  const modeMatch = resolvePlannerModeId(room) === 'EMPIRE' ? 6 : 0;
  const channelPriority = activeEvents.reduce((sum, event) => {
    if (!event.channels.includes('DEAL_ROOM')) {
      return sum;
    }
    return sum + Math.ceil((event.channelPriority['DEAL_ROOM'] ?? 0) / 20);
  }, 0);
  const intensity = sum(activeEvents.map((event) => INTENSITY_WEIGHT[event.intensity]));
  return modeMatch + channelPriority + intensity;
}

export function computeEmpireLobbyReadiness(
  room: GlobalEventSchedulerRoomContext,
  activeEvents: readonly GlobalEventProjection[],
): number {
  const modeMatch = resolvePlannerModeId(room) === 'EMPIRE' ? 6 : 0;
  const channelPriority = activeEvents.reduce((sum, event) => {
    if (!event.channels.includes('LOBBY')) {
      return sum;
    }
    return sum + Math.ceil((event.channelPriority['LOBBY'] ?? 0) / 20);
  }, 0);
  const intensity = sum(activeEvents.map((event) => INTENSITY_WEIGHT[event.intensity]));
  return modeMatch + channelPriority + intensity;
}

export function computePredatorGlobalReadiness(
  room: GlobalEventSchedulerRoomContext,
  activeEvents: readonly GlobalEventProjection[],
): number {
  const modeMatch = resolvePlannerModeId(room) === 'PREDATOR' ? 6 : 0;
  const channelPriority = activeEvents.reduce((sum, event) => {
    if (!event.channels.includes('GLOBAL')) {
      return sum;
    }
    return sum + Math.ceil((event.channelPriority['GLOBAL'] ?? 0) / 20);
  }, 0);
  const intensity = sum(activeEvents.map((event) => INTENSITY_WEIGHT[event.intensity]));
  return modeMatch + channelPriority + intensity;
}

export function computePredatorSyndicateReadiness(
  room: GlobalEventSchedulerRoomContext,
  activeEvents: readonly GlobalEventProjection[],
): number {
  const modeMatch = resolvePlannerModeId(room) === 'PREDATOR' ? 6 : 0;
  const channelPriority = activeEvents.reduce((sum, event) => {
    if (!event.channels.includes('SYNDICATE')) {
      return sum;
    }
    return sum + Math.ceil((event.channelPriority['SYNDICATE'] ?? 0) / 20);
  }, 0);
  const intensity = sum(activeEvents.map((event) => INTENSITY_WEIGHT[event.intensity]));
  return modeMatch + channelPriority + intensity;
}

export function computePredatorDealRoomReadiness(
  room: GlobalEventSchedulerRoomContext,
  activeEvents: readonly GlobalEventProjection[],
): number {
  const modeMatch = resolvePlannerModeId(room) === 'PREDATOR' ? 6 : 0;
  const channelPriority = activeEvents.reduce((sum, event) => {
    if (!event.channels.includes('DEAL_ROOM')) {
      return sum;
    }
    return sum + Math.ceil((event.channelPriority['DEAL_ROOM'] ?? 0) / 20);
  }, 0);
  const intensity = sum(activeEvents.map((event) => INTENSITY_WEIGHT[event.intensity]));
  return modeMatch + channelPriority + intensity;
}

export function computePredatorLobbyReadiness(
  room: GlobalEventSchedulerRoomContext,
  activeEvents: readonly GlobalEventProjection[],
): number {
  const modeMatch = resolvePlannerModeId(room) === 'PREDATOR' ? 6 : 0;
  const channelPriority = activeEvents.reduce((sum, event) => {
    if (!event.channels.includes('LOBBY')) {
      return sum;
    }
    return sum + Math.ceil((event.channelPriority['LOBBY'] ?? 0) / 20);
  }, 0);
  const intensity = sum(activeEvents.map((event) => INTENSITY_WEIGHT[event.intensity]));
  return modeMatch + channelPriority + intensity;
}

export function computeSyndicateGlobalReadiness(
  room: GlobalEventSchedulerRoomContext,
  activeEvents: readonly GlobalEventProjection[],
): number {
  const modeMatch = resolvePlannerModeId(room) === 'SYNDICATE' ? 6 : 0;
  const channelPriority = activeEvents.reduce((sum, event) => {
    if (!event.channels.includes('GLOBAL')) {
      return sum;
    }
    return sum + Math.ceil((event.channelPriority['GLOBAL'] ?? 0) / 20);
  }, 0);
  const intensity = sum(activeEvents.map((event) => INTENSITY_WEIGHT[event.intensity]));
  return modeMatch + channelPriority + intensity;
}

export function computeSyndicateSyndicateReadiness(
  room: GlobalEventSchedulerRoomContext,
  activeEvents: readonly GlobalEventProjection[],
): number {
  const modeMatch = resolvePlannerModeId(room) === 'SYNDICATE' ? 6 : 0;
  const channelPriority = activeEvents.reduce((sum, event) => {
    if (!event.channels.includes('SYNDICATE')) {
      return sum;
    }
    return sum + Math.ceil((event.channelPriority['SYNDICATE'] ?? 0) / 20);
  }, 0);
  const intensity = sum(activeEvents.map((event) => INTENSITY_WEIGHT[event.intensity]));
  return modeMatch + channelPriority + intensity;
}

export function computeSyndicateDealRoomReadiness(
  room: GlobalEventSchedulerRoomContext,
  activeEvents: readonly GlobalEventProjection[],
): number {
  const modeMatch = resolvePlannerModeId(room) === 'SYNDICATE' ? 6 : 0;
  const channelPriority = activeEvents.reduce((sum, event) => {
    if (!event.channels.includes('DEAL_ROOM')) {
      return sum;
    }
    return sum + Math.ceil((event.channelPriority['DEAL_ROOM'] ?? 0) / 20);
  }, 0);
  const intensity = sum(activeEvents.map((event) => INTENSITY_WEIGHT[event.intensity]));
  return modeMatch + channelPriority + intensity;
}

export function computeSyndicateLobbyReadiness(
  room: GlobalEventSchedulerRoomContext,
  activeEvents: readonly GlobalEventProjection[],
): number {
  const modeMatch = resolvePlannerModeId(room) === 'SYNDICATE' ? 6 : 0;
  const channelPriority = activeEvents.reduce((sum, event) => {
    if (!event.channels.includes('LOBBY')) {
      return sum;
    }
    return sum + Math.ceil((event.channelPriority['LOBBY'] ?? 0) / 20);
  }, 0);
  const intensity = sum(activeEvents.map((event) => INTENSITY_WEIGHT[event.intensity]));
  return modeMatch + channelPriority + intensity;
}

export function computePhantomGlobalReadiness(
  room: GlobalEventSchedulerRoomContext,
  activeEvents: readonly GlobalEventProjection[],
): number {
  const modeMatch = resolvePlannerModeId(room) === 'PHANTOM' ? 6 : 0;
  const channelPriority = activeEvents.reduce((sum, event) => {
    if (!event.channels.includes('GLOBAL')) {
      return sum;
    }
    return sum + Math.ceil((event.channelPriority['GLOBAL'] ?? 0) / 20);
  }, 0);
  const intensity = sum(activeEvents.map((event) => INTENSITY_WEIGHT[event.intensity]));
  return modeMatch + channelPriority + intensity;
}

export function computePhantomSyndicateReadiness(
  room: GlobalEventSchedulerRoomContext,
  activeEvents: readonly GlobalEventProjection[],
): number {
  const modeMatch = resolvePlannerModeId(room) === 'PHANTOM' ? 6 : 0;
  const channelPriority = activeEvents.reduce((sum, event) => {
    if (!event.channels.includes('SYNDICATE')) {
      return sum;
    }
    return sum + Math.ceil((event.channelPriority['SYNDICATE'] ?? 0) / 20);
  }, 0);
  const intensity = sum(activeEvents.map((event) => INTENSITY_WEIGHT[event.intensity]));
  return modeMatch + channelPriority + intensity;
}

export function computePhantomDealRoomReadiness(
  room: GlobalEventSchedulerRoomContext,
  activeEvents: readonly GlobalEventProjection[],
): number {
  const modeMatch = resolvePlannerModeId(room) === 'PHANTOM' ? 6 : 0;
  const channelPriority = activeEvents.reduce((sum, event) => {
    if (!event.channels.includes('DEAL_ROOM')) {
      return sum;
    }
    return sum + Math.ceil((event.channelPriority['DEAL_ROOM'] ?? 0) / 20);
  }, 0);
  const intensity = sum(activeEvents.map((event) => INTENSITY_WEIGHT[event.intensity]));
  return modeMatch + channelPriority + intensity;
}

export function computePhantomLobbyReadiness(
  room: GlobalEventSchedulerRoomContext,
  activeEvents: readonly GlobalEventProjection[],
): number {
  const modeMatch = resolvePlannerModeId(room) === 'PHANTOM' ? 6 : 0;
  const channelPriority = activeEvents.reduce((sum, event) => {
    if (!event.channels.includes('LOBBY')) {
      return sum;
    }
    return sum + Math.ceil((event.channelPriority['LOBBY'] ?? 0) / 20);
  }, 0);
  const intensity = sum(activeEvents.map((event) => INTENSITY_WEIGHT[event.intensity]));
  return modeMatch + channelPriority + intensity;
}

export function computeLobbyGlobalReadiness(
  room: GlobalEventSchedulerRoomContext,
  activeEvents: readonly GlobalEventProjection[],
): number {
  const modeMatch = resolvePlannerModeId(room) === 'LOBBY' ? 6 : 0;
  const channelPriority = activeEvents.reduce((sum, event) => {
    if (!event.channels.includes('GLOBAL')) {
      return sum;
    }
    return sum + Math.ceil((event.channelPriority['GLOBAL'] ?? 0) / 20);
  }, 0);
  const intensity = sum(activeEvents.map((event) => INTENSITY_WEIGHT[event.intensity]));
  return modeMatch + channelPriority + intensity;
}

export function computeLobbySyndicateReadiness(
  room: GlobalEventSchedulerRoomContext,
  activeEvents: readonly GlobalEventProjection[],
): number {
  const modeMatch = resolvePlannerModeId(room) === 'LOBBY' ? 6 : 0;
  const channelPriority = activeEvents.reduce((sum, event) => {
    if (!event.channels.includes('SYNDICATE')) {
      return sum;
    }
    return sum + Math.ceil((event.channelPriority['SYNDICATE'] ?? 0) / 20);
  }, 0);
  const intensity = sum(activeEvents.map((event) => INTENSITY_WEIGHT[event.intensity]));
  return modeMatch + channelPriority + intensity;
}

export function computeLobbyDealRoomReadiness(
  room: GlobalEventSchedulerRoomContext,
  activeEvents: readonly GlobalEventProjection[],
): number {
  const modeMatch = resolvePlannerModeId(room) === 'LOBBY' ? 6 : 0;
  const channelPriority = activeEvents.reduce((sum, event) => {
    if (!event.channels.includes('DEAL_ROOM')) {
      return sum;
    }
    return sum + Math.ceil((event.channelPriority['DEAL_ROOM'] ?? 0) / 20);
  }, 0);
  const intensity = sum(activeEvents.map((event) => INTENSITY_WEIGHT[event.intensity]));
  return modeMatch + channelPriority + intensity;
}

export function computeLobbyLobbyReadiness(
  room: GlobalEventSchedulerRoomContext,
  activeEvents: readonly GlobalEventProjection[],
): number {
  const modeMatch = resolvePlannerModeId(room) === 'LOBBY' ? 6 : 0;
  const channelPriority = activeEvents.reduce((sum, event) => {
    if (!event.channels.includes('LOBBY')) {
      return sum;
    }
    return sum + Math.ceil((event.channelPriority['LOBBY'] ?? 0) / 20);
  }, 0);
  const intensity = sum(activeEvents.map((event) => INTENSITY_WEIGHT[event.intensity]));
  return modeMatch + channelPriority + intensity;
}

export function computePostRunGlobalReadiness(
  room: GlobalEventSchedulerRoomContext,
  activeEvents: readonly GlobalEventProjection[],
): number {
  const modeMatch = resolvePlannerModeId(room) === 'POST_RUN' ? 6 : 0;
  const channelPriority = activeEvents.reduce((sum, event) => {
    if (!event.channels.includes('GLOBAL')) {
      return sum;
    }
    return sum + Math.ceil((event.channelPriority['GLOBAL'] ?? 0) / 20);
  }, 0);
  const intensity = sum(activeEvents.map((event) => INTENSITY_WEIGHT[event.intensity]));
  return modeMatch + channelPriority + intensity;
}

export function computePostRunSyndicateReadiness(
  room: GlobalEventSchedulerRoomContext,
  activeEvents: readonly GlobalEventProjection[],
): number {
  const modeMatch = resolvePlannerModeId(room) === 'POST_RUN' ? 6 : 0;
  const channelPriority = activeEvents.reduce((sum, event) => {
    if (!event.channels.includes('SYNDICATE')) {
      return sum;
    }
    return sum + Math.ceil((event.channelPriority['SYNDICATE'] ?? 0) / 20);
  }, 0);
  const intensity = sum(activeEvents.map((event) => INTENSITY_WEIGHT[event.intensity]));
  return modeMatch + channelPriority + intensity;
}

export function computePostRunDealRoomReadiness(
  room: GlobalEventSchedulerRoomContext,
  activeEvents: readonly GlobalEventProjection[],
): number {
  const modeMatch = resolvePlannerModeId(room) === 'POST_RUN' ? 6 : 0;
  const channelPriority = activeEvents.reduce((sum, event) => {
    if (!event.channels.includes('DEAL_ROOM')) {
      return sum;
    }
    return sum + Math.ceil((event.channelPriority['DEAL_ROOM'] ?? 0) / 20);
  }, 0);
  const intensity = sum(activeEvents.map((event) => INTENSITY_WEIGHT[event.intensity]));
  return modeMatch + channelPriority + intensity;
}

export function computePostRunLobbyReadiness(
  room: GlobalEventSchedulerRoomContext,
  activeEvents: readonly GlobalEventProjection[],
): number {
  const modeMatch = resolvePlannerModeId(room) === 'POST_RUN' ? 6 : 0;
  const channelPriority = activeEvents.reduce((sum, event) => {
    if (!event.channels.includes('LOBBY')) {
      return sum;
    }
    return sum + Math.ceil((event.channelPriority['LOBBY'] ?? 0) / 20);
  }, 0);
  const intensity = sum(activeEvents.map((event) => INTENSITY_WEIGHT[event.intensity]));
  return modeMatch + channelPriority + intensity;
}

export function createLiquidatorCirclePreset(): FactionDescriptor {
  return DEFAULT_FACTIONS.find((faction) => faction.factionId === 'liquidator-circle') ?? DEFAULT_FACTIONS[0];
}

export function isLiquidatorCircleFaction(factionId: string): boolean {
  return factionId === 'liquidator-circle';
}

export function createSyndicateTribunalPreset(): FactionDescriptor {
  return DEFAULT_FACTIONS.find((faction) => faction.factionId === 'syndicate-tribunal') ?? DEFAULT_FACTIONS[0];
}

export function isSyndicateTribunalFaction(factionId: string): boolean {
  return factionId === 'syndicate-tribunal';
}

export function createMarketWitnessesPreset(): FactionDescriptor {
  return DEFAULT_FACTIONS.find((faction) => faction.factionId === 'market-witnesses') ?? DEFAULT_FACTIONS[0];
}

export function isMarketWitnessesFaction(factionId: string): boolean {
  return factionId === 'market-witnesses';
}

export function createHelperCadrePreset(): FactionDescriptor {
  return DEFAULT_FACTIONS.find((faction) => faction.factionId === 'helper-cadre') ?? DEFAULT_FACTIONS[0];
}

export function isHelperCadreFaction(factionId: string): boolean {
  return factionId === 'helper-cadre';
}

export function createCrowdConclavePreset(): FactionDescriptor {
  return DEFAULT_FACTIONS.find((faction) => faction.factionId === 'crowd-conclave') ?? DEFAULT_FACTIONS[0];
}

export function isCrowdConclaveFaction(factionId: string): boolean {
  return factionId === 'crowd-conclave';
}

export function createWhisperNetworkPreset(): FactionDescriptor {
  return DEFAULT_FACTIONS.find((faction) => faction.factionId === 'whisper-network') ?? DEFAULT_FACTIONS[0];
}

export function isWhisperNetworkFaction(factionId: string): boolean {
  return factionId === 'whisper-network';
}

export function createSpectatorChoirPreset(): FactionDescriptor {
  return DEFAULT_FACTIONS.find((faction) => faction.factionId === 'spectator-choir') ?? DEFAULT_FACTIONS[0];
}

export function isSpectatorChoirFaction(factionId: string): boolean {
  return factionId === 'spectator-choir';
}

export function createRaidMarshalsPreset(): FactionDescriptor {
  return DEFAULT_FACTIONS.find((faction) => faction.factionId === 'raid-marshals') ?? DEFAULT_FACTIONS[0];
}

export function isRaidMarshalsFaction(factionId: string): boolean {
  return factionId === 'raid-marshals';
}

export function createLegendBrokersPreset(): FactionDescriptor {
  return DEFAULT_FACTIONS.find((faction) => faction.factionId === 'legend-brokers') ?? DEFAULT_FACTIONS[0];
}

export function isLegendBrokersFaction(factionId: string): boolean {
  return factionId === 'legend-brokers';
}

export function createRecoveryCloisterPreset(): FactionDescriptor {
  return DEFAULT_FACTIONS.find((faction) => faction.factionId === 'recovery-cloister') ?? DEFAULT_FACTIONS[0];
}

export function isRecoveryCloisterFaction(factionId: string): boolean {
  return factionId === 'recovery-cloister';
}
