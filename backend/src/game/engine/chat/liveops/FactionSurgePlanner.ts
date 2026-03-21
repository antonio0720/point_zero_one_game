/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT LIVEOPS FACTION SURGE PLANNER
 * FILE: backend/src/game/engine/chat/liveops/FactionSurgePlanner.ts
 * VERSION: 2026.03.19-liveops-world-events
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Translates active world-event windows into factional pressure plans.
 *
 * The scheduler decides *what* global event is alive.
 * This planner decides *who* seizes the room because of it.
 *
 * In Point Zero One, a world event should never feel like a flat banner.
 * It should feel like power blocs, witnesses, helper cadres, rumors, raiders,
 * and faction narratives all bending the room in different ways depending on:
 *
 * - channel,
 * - mode,
 * - current panic,
 * - low-shield density,
 * - crowd heat,
 * - reputation imbalance,
 * - whether the event is public, shadow-only, or hybrid.
 *
 * This module therefore emits a room-local faction surge plan that downstream
 * orchestration can use for:
 * - crowd synthesis,
 * - interruption ordering,
 * - helper muting / boosting,
 * - raid cadence,
 * - debate posture,
 * - whisper pressure,
 * - witness count,
 * - hidden channel queue pressure.
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
}

export interface FactionSurgePlannerOptions {
  readonly factions?: readonly FactionDescriptor[];
}

export interface FactionSurgeChannelDirective {
  readonly channelId: ChatLiveOpsChannelId;
  readonly dominantFactionId: string;
  readonly witnessCountDelta: number;
  readonly crowdHeatDelta: number;
  readonly interruptionPressureDelta: number;
  readonly helperAvailabilityDelta: number;
  readonly styleTags: readonly string[];
}

export interface FactionVoiceDirective {
  readonly factionId: string;
  readonly voiceKind: FactionVoiceKind;
  readonly confidence: number;
  readonly targetChannels: readonly ChatLiveOpsChannelId[];
  readonly timingBiasMs: number;
  readonly tags: readonly string[];
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
  readonly recommendedTags: readonly string[];
  readonly notes: readonly string[];
}

const DEFAULT_FACTIONS: readonly FactionDescriptor[] = Object.freeze([
  Object.freeze({
    factionId: 'liquidator-circle',
    displayName: 'Liquidator Circle',
    alignment: 'PREDATORY',
    preferredChannels: Object.freeze(['GLOBAL', 'DEAL_ROOM']),
    defaultVoice: 'ENFORCER',
    intensityBias: 4,
    publicnessBias: 2,
    rescueBias: -3,
    tags: Object.freeze(['LIQUIDATOR', 'LOW_SHIELD_HUNT', 'PREDATION']),
  }),
  Object.freeze({
    factionId: 'syndicate-tribunal',
    displayName: 'Syndicate Tribunal',
    alignment: 'TACTICAL',
    preferredChannels: Object.freeze(['SYNDICATE', 'DEAL_ROOM']),
    defaultVoice: 'TRIBUNAL',
    intensityBias: 3,
    publicnessBias: -1,
    rescueBias: -1,
    tags: Object.freeze(['SYNDICATE', 'TRIBUNAL', 'REPUTATION']),
  }),
  Object.freeze({
    factionId: 'market-witnesses',
    displayName: 'Market Witnesses',
    alignment: 'WITNESS',
    preferredChannels: Object.freeze(['GLOBAL', 'LOBBY']),
    defaultVoice: 'MARKET_WITNESS',
    intensityBias: 2,
    publicnessBias: 4,
    rescueBias: 0,
    tags: Object.freeze(['MARKET_RUMOR', 'WITNESS_SWELL', 'VOLATILITY']),
  }),
  Object.freeze({
    factionId: 'helper-cadre',
    displayName: 'Helper Cadre',
    alignment: 'HELPER',
    preferredChannels: Object.freeze(['GLOBAL', 'SYNDICATE', 'DEAL_ROOM']),
    defaultVoice: 'HELPER_CADRE',
    intensityBias: 1,
    publicnessBias: 0,
    rescueBias: 5,
    tags: Object.freeze(['HELPER', 'RECOVERY', 'INTERVENTION']),
  }),
  Object.freeze({
    factionId: 'crowd-conclave',
    displayName: 'Crowd Conclave',
    alignment: 'HOSTILE',
    preferredChannels: Object.freeze(['GLOBAL', 'LOBBY']),
    defaultVoice: 'SWARM',
    intensityBias: 3,
    publicnessBias: 5,
    rescueBias: -2,
    tags: Object.freeze(['CROWD', 'PILE_ON', 'WITNESS']),
  }),
  Object.freeze({
    factionId: 'whisper-network',
    displayName: 'Whisper Network',
    alignment: 'DISRUPTIVE',
    preferredChannels: Object.freeze(['SYNDICATE', 'DEAL_ROOM']),
    defaultVoice: 'WHISPER_NETWORK',
    intensityBias: 2,
    publicnessBias: -3,
    rescueBias: -1,
    tags: Object.freeze(['WHISPER_ONLY', 'SHADOW_DENSITY']),
  }),
  Object.freeze({
    factionId: 'spectator-choir',
    displayName: 'Spectator Choir',
    alignment: 'CEREMONIAL',
    preferredChannels: Object.freeze(['GLOBAL', 'LOBBY']),
    defaultVoice: 'SPECTATOR_CHOIR',
    intensityBias: 1,
    publicnessBias: 3,
    rescueBias: 0,
    tags: Object.freeze(['CEREMONY', 'LEGEND', 'WITNESS']),
  }),
]);

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
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

function includesAny(pool: readonly string[], probe: readonly string[]): boolean {
  const set = new Set(pool);
  for (const item of probe) {
    if (set.has(item)) {
      return true;
    }
  }
  return false;
}

function maxIntensityBand(
  active: readonly GlobalEventProjection[],
): ChatLiveOpsIntensityBand {
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

function intensityScore(band: ChatLiveOpsIntensityBand): number {
  switch (band) {
    case 'WORLD_CLASS':
      return 4;
    case 'SEVERE':
      return 3;
    case 'ACTIVE':
      return 2;
    case 'QUIET':
    default:
      return 1;
  }
}

function familyWeight(family: GlobalEventFamily): number {
  switch (family) {
    case 'COORDINATED_RAID':
      return 6;
    case 'HELPER_BLACKOUT':
      return 5;
    case 'FACTION_SURGE':
      return 4;
    case 'CHANNEL_MUTATOR':
      return 4;
    case 'WHISPER_WINDOW':
      return 3;
    case 'RIVAL_SPOTLIGHT':
      return 3;
    case 'WORLD_EVENT':
      return 3;
    case 'SEASON':
      return 2;
    default:
      return 1;
  }
}

export class FactionSurgePlanner {
  private readonly factions: readonly FactionDescriptor[];

  public constructor(options: FactionSurgePlannerOptions = {}) {
    this.factions = options.factions?.length ? options.factions : DEFAULT_FACTIONS;
  }

  public getFactions(): readonly FactionDescriptor[] {
    return this.factions;
  }

  public plan(
    room: GlobalEventSchedulerRoomContext,
    activeEvents: readonly GlobalEventProjection[],
  ): FactionSurgePlan {
    const intensity = maxIntensityBand(activeEvents);
    const scored = this.scoreFactions(room, activeEvents);
    const primary = scored[0] ?? this.toDefaultScore(this.factions[0], room, activeEvents);
    const helperBlackoutActive = activeEvents.some((event) => event.family === 'HELPER_BLACKOUT');
    const coordinatedRaidActive = activeEvents.some((event) => event.family === 'COORDINATED_RAID');

    const channelDirectives = this.buildChannelDirectives(room, activeEvents, primary);
    const voiceDirectives = this.buildVoiceDirectives(activeEvents, scored, intensity);
    const recommendedTags = uniqueStrings([
      ...activeEvents.flatMap((event) => event.tags),
      ...primary.descriptor.tags,
      helperBlackoutActive ? 'HELPER_BLACKOUT_ACTIVE' : 'HELPER_RECOVERY_ONLINE',
      coordinatedRaidActive ? 'RAID_ACTIVE' : 'NO_RAID',
    ]);

    return {
      roomId: room.roomId,
      eventIds: activeEvents.map((event) => event.eventId),
      primaryFactionId: primary.descriptor.factionId,
      primaryAlignment: primary.descriptor.alignment,
      intensity,
      channelDirectives,
      voiceDirectives,
      helperBlackoutActive,
      coordinatedRaidActive,
      witnessPressureDelta: this.computeWitnessPressureDelta(channelDirectives),
      pressureBiasDelta: primary.totalScore,
      publicnessBiasDelta: this.computePublicnessBiasDelta(channelDirectives),
      recommendedTags,
      notes: freeze([
        `PRIMARY_FACTION:${primary.descriptor.factionId}`,
        `INTENSITY:${intensity}`,
        `EVENT_COUNT:${activeEvents.length}`,
      ]),
    };
  }

  private scoreFactions(
    room: GlobalEventSchedulerRoomContext,
    activeEvents: readonly GlobalEventProjection[],
  ): readonly Array<{
    readonly descriptor: FactionDescriptor;
    readonly totalScore: number;
    readonly reasons: readonly string[];
  }> {
    const scores = this.factions.map((descriptor) => this.toDefaultScore(descriptor, room, activeEvents));
    return scores.sort((left, right) => right.totalScore - left.totalScore);
  }

  private toDefaultScore(
    descriptor: FactionDescriptor,
    room: GlobalEventSchedulerRoomContext,
    activeEvents: readonly GlobalEventProjection[],
  ): {
    readonly descriptor: FactionDescriptor;
    readonly totalScore: number;
    readonly reasons: readonly string[];
  } {
    let totalScore = descriptor.intensityBias;
    const reasons: string[] = [`BASE:${descriptor.intensityBias}`];

    if (includesAny(activeEvents.flatMap((event) => event.tags), descriptor.tags)) {
      totalScore += 4;
      reasons.push('TAG_MATCH:+4');
    }

    for (const event of activeEvents) {
      totalScore += familyWeight(event.family);
      reasons.push(`FAMILY:${event.family}:+${familyWeight(event.family)}`);
      totalScore += intensityScore(event.intensity);
      reasons.push(`INTENSITY:${event.intensity}:+${intensityScore(event.intensity)}`);
    }

    if ((room.crowdHeat ?? 0) >= 70 && descriptor.alignment === 'HOSTILE') {
      totalScore += 3;
      reasons.push('CROWD_HEAT_HOSTILE:+3');
    }

    if ((room.lowShieldPlayerCount ?? 0) > 0 && descriptor.tags.includes('LOW_SHIELD_HUNT')) {
      totalScore += 4;
      reasons.push('LOW_SHIELD_TRIGGER:+4');
    }

    if ((room.panicLevel ?? 0) >= 60 && descriptor.alignment === 'TACTICAL') {
      totalScore += 2;
      reasons.push('PANIC_TACTICAL:+2');
    }

    if ((room.activeHelperCount ?? 0) === 0 && descriptor.alignment === 'HELPER') {
      totalScore -= 4;
      reasons.push('NO_HELPERS:-4');
    }

    if ((room.activeHelperCount ?? 0) > 0 && descriptor.alignment === 'HELPER') {
      totalScore += 3;
      reasons.push('HELPERS_PRESENT:+3');
    }

    if (room.tags && includesAny(room.tags, descriptor.tags)) {
      totalScore += 2;
      reasons.push('ROOM_TAG_MATCH:+2');
    }

    return freeze({
      descriptor,
      totalScore,
      reasons: freeze(reasons),
    });
  }

  private buildChannelDirectives(
    room: GlobalEventSchedulerRoomContext,
    activeEvents: readonly GlobalEventProjection[],
    primary: {
      readonly descriptor: FactionDescriptor;
      readonly totalScore: number;
    },
  ): readonly FactionSurgeChannelDirective[] {
    const channels = new Set<ChatLiveOpsChannelId>();
    for (const event of activeEvents) {
      for (const channel of event.channels) {
        channels.add(channel);
      }
    }

    if (channels.size === 0) {
      channels.add('GLOBAL');
    }

    const directives: FactionSurgeChannelDirective[] = [];
    for (const channelId of channels) {
      const eventPressure = activeEvents.reduce((sum, event) => {
        if (!event.channels.includes(channelId)) {
          return sum;
        }
        const priority = event.channelPriority[channelId] ?? 0;
        return sum + Math.ceil(priority / 25) + intensityScore(event.intensity);
      }, 0);

      const prefersChannel = primary.descriptor.preferredChannels.includes(channelId);
      const witnessCountDelta = Math.max(
        0,
        Math.round((room.playerCount ?? 1) * 0.15) + (channelId === 'GLOBAL' ? 3 : 1) + (prefersChannel ? 1 : 0),
      );

      const crowdHeatDelta = eventPressure + (channelId === 'GLOBAL' ? 2 : 0) + (prefersChannel ? 1 : 0);
      const interruptionPressureDelta =
        eventPressure + (primary.descriptor.alignment === 'PREDATORY' ? 2 : 0) + (channelId === 'DEAL_ROOM' ? 1 : 0);
      const helperAvailabilityDelta =
        primary.descriptor.alignment === 'HELPER'
          ? primary.descriptor.rescueBias
          : -Math.max(0, Math.floor(eventPressure / 3));

      directives.push(
        freeze({
          channelId,
          dominantFactionId: primary.descriptor.factionId,
          witnessCountDelta,
          crowdHeatDelta,
          interruptionPressureDelta,
          helperAvailabilityDelta,
          styleTags: freeze(uniqueStrings([
            ...primary.descriptor.tags,
            channelId,
            prefersChannel ? 'PREFERRED_CHANNEL' : 'SECONDARY_CHANNEL',
            channelId === 'GLOBAL' ? 'THEATRICAL' : channelId === 'SYNDICATE' ? 'INTIMATE' : channelId === 'DEAL_ROOM' ? 'PREDATORY' : 'STAGING',
          ])),
        }),
      );
    }

    return directives;
  }

  private buildVoiceDirectives(
    activeEvents: readonly GlobalEventProjection[],
    scored: readonly Array<{
      readonly descriptor: FactionDescriptor;
      readonly totalScore: number;
    }>,
    intensity: ChatLiveOpsIntensityBand,
  ): readonly FactionVoiceDirective[] {
    const top = scored.slice(0, Math.min(scored.length, 3));
    const directives: FactionVoiceDirective[] = [];
    const baseTiming = intensity === 'WORLD_CLASS' ? 400 : intensity === 'SEVERE' ? 700 : 1100;

    top.forEach((entry, index) => {
      directives.push(
        freeze({
          factionId: entry.descriptor.factionId,
          voiceKind: entry.descriptor.defaultVoice,
          confidence: Math.max(0.25, Math.min(1, entry.totalScore / 20)),
          targetChannels: freeze([...entry.descriptor.preferredChannels]),
          timingBiasMs: baseTiming + index * 250,
          tags: freeze(uniqueStrings([
            ...entry.descriptor.tags,
            ...activeEvents.flatMap((event) => event.tags.slice(0, 2)),
          ])),
        }),
      );
    });

    return directives;
  }

  private computeWitnessPressureDelta(
    directives: readonly FactionSurgeChannelDirective[],
  ): number {
    return directives.reduce((sum, directive) => sum + directive.witnessCountDelta, 0);
  }

  private computePublicnessBiasDelta(
    directives: readonly FactionSurgeChannelDirective[],
  ): number {
    return directives.reduce((sum, directive) => {
      if (directive.channelId === 'GLOBAL' || directive.channelId === 'LOBBY') {
        return sum + directive.crowdHeatDelta;
      }
      return sum;
    }, 0);
  }
}

export function createFactionSurgePlanner(
  options: FactionSurgePlannerOptions = {},
): FactionSurgePlanner {
  return new FactionSurgePlanner(options);
}
