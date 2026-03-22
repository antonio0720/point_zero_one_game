/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT LIVEOPS SCHEDULER AUTHORITY
 * FILE: backend/src/game/engine/chat/liveops/GlobalEventScheduler.ts
 * VERSION: 2026.03.19-liveops-world-events
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * This file is the authoritative backend scheduler for chat-wide world events,
 * seasonal overlays, whisper windows, raid bursts, helper blackouts, and other
 * liveops pressure layers that must exist above individual bot reaction logic.
 *
 * The architectural doctrine here is strict:
 * - chat liveops is a simulation lane, not a UI widget;
 * - schedules are deterministic and serializable;
 * - rooms may project the same global event differently without inventing a
 *   second source of truth;
 * - the scheduler mints windows, not chat messages;
 * - downstream planners decide crowd synthesis, faction surges, rescue posture,
 *   and visible/shadow emission cadence using these windows.
 *
 * Why this file is intentionally deep
 * -----------------------------------
 * A tiny cron-like helper would flatten your runtime into generic timers.
 * That would be wrong for Point Zero One. This file needs to do all of the
 * following without collapsing repo-specific intent:
 *
 * 1. preserve a durable world-event library;
 * 2. support fixed, recurring, conditional, and manually-forced windows;
 * 3. emit shared liveops overlays compatible with shared chat contracts;
 * 4. preserve channel-specific priorities instead of broadcasting blindly;
 * 5. maintain dedupe / cooldown / reactivation law;
 * 6. serialize its full state for replay, restart, and test harnesses;
 * 7. support shadow-only events and visible headline events;
 * 8. expose enough explainability for tools, QA, replay, and ops panels.
 */

import type {
  ChatLiveOpsChannelId,
  ChatLiveOpsIntensityBand,
  ChatLiveOpsOverlayDefinition,
  ChatLiveOpsOverlayRule,
  ChatLiveOpsOverlaySnapshot,
} from '../../../../../../shared/contracts/chat/liveops';

export type SchedulerNowProvider = () => number;

export type GlobalEventScheduleKind =
  | 'FIXED_WINDOW'
  | 'RECURRING_INTERVAL'
  | 'RECURRING_DAILY_UTC'
  | 'MANUAL'
  | 'MATCH_STATE_TRIGGER';

export type GlobalEventFamily =
  | 'SEASON'
  | 'WORLD_EVENT'
  | 'HELPER_BLACKOUT'
  | 'CHANNEL_MUTATOR'
  | 'WHISPER_WINDOW'
  | 'FACTION_SURGE'
  | 'COORDINATED_RAID'
  | 'RIVAL_SPOTLIGHT';

export type GlobalEventVisibility = 'VISIBLE' | 'SHADOW_ONLY' | 'HYBRID';

export type GlobalEventRepeatGranularity = 'NONE' | 'MINUTE' | 'HOUR' | 'DAY';

export interface GlobalEventSchedulerRoomContext {
  readonly roomId: string;
  readonly mode?: string | null;
  readonly mountTarget?: string | null;
  readonly playerCount?: number;
  readonly lowShieldPlayerCount?: number;
  readonly activeHelperCount?: number;
  readonly crowdHeat?: number;
  readonly panicLevel?: number;
  readonly factionBalance?: Readonly<Record<string, number>>;
  readonly tags?: readonly string[];
}

export interface GlobalEventSchedulerEvaluationContext {
  readonly now?: number;
  readonly rooms?: readonly GlobalEventSchedulerRoomContext[];
  readonly globalTags?: readonly string[];
}

export interface GlobalEventRecurringDailyUtcRule {
  readonly hourUtc: number;
  readonly minuteUtc: number;
  readonly durationMs: number;
  readonly allowedWeekdays?: readonly number[];
}

export interface GlobalEventRecurringIntervalRule {
  readonly intervalMs: number;
  readonly durationMs: number;
  readonly jitterMs?: number;
  readonly alignToEpochMs?: number;
}

export interface GlobalEventMatchStateRule {
  readonly triggerId: string;
  readonly durationMs: number;
  readonly requiredTags?: readonly string[];
  readonly requiredModeIds?: readonly string[];
  readonly minLowShieldPlayers?: number;
  readonly minPanicLevel?: number;
}

export interface GlobalEventWindowDefinition {
  readonly startsAt?: number;
  readonly endsAt?: number;
  readonly recurringDailyUtc?: GlobalEventRecurringDailyUtcRule;
  readonly recurringInterval?: GlobalEventRecurringIntervalRule;
  readonly matchState?: GlobalEventMatchStateRule;
}

export interface GlobalEventDefinition {
  readonly eventId: string;
  readonly family: GlobalEventFamily;
  readonly displayName: string;
  readonly headline: string;
  readonly summaryLines: readonly string[];
  readonly scheduleKind: GlobalEventScheduleKind;
  readonly visibility: GlobalEventVisibility;
  readonly intensity: ChatLiveOpsIntensityBand;
  readonly tags: readonly string[];
  readonly channels: readonly ChatLiveOpsChannelId[];
  readonly channelPriority: Readonly<Record<ChatLiveOpsChannelId, number>>;
  readonly rules: readonly ChatLiveOpsOverlayRule[];
  readonly cooldownMs: number;
  readonly maxConcurrentGlobalInstances: number;
  readonly maxInstancesPerRoom?: number;
  readonly repeatGranularity: GlobalEventRepeatGranularity;
  readonly priorityWeight: number;
  readonly definitionVersion: string;
  readonly seasonId?: string | null;
  readonly scopeModeIds?: readonly string[];
  readonly requiredTags?: readonly string[];
  readonly excludedTags?: readonly string[];
  readonly windows: readonly GlobalEventWindowDefinition[];
  readonly meta?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface GlobalEventActivation {
  readonly activationId: string;
  readonly eventId: string;
  readonly startsAt: number;
  readonly endsAt: number;
  readonly forced: boolean;
  readonly roomScopedRoomIds?: readonly string[];
  readonly mintedAt: number;
  readonly source:
    | 'FIXED_WINDOW'
    | 'RECURRING_INTERVAL'
    | 'RECURRING_DAILY_UTC'
    | 'MATCH_STATE_TRIGGER'
    | 'MANUAL';
  readonly triggerTag?: string | null;
  readonly notes: readonly string[];
}

export interface GlobalEventProjection {
  readonly activationId: string;
  readonly eventId: string;
  readonly family: GlobalEventFamily;
  readonly displayName: string;
  readonly headline: string;
  readonly summaryLines: readonly string[];
  readonly intensity: ChatLiveOpsIntensityBand;
  readonly visibility: GlobalEventVisibility;
  readonly startsAt: number;
  readonly endsAt: number;
  readonly timeRemainingMs: number;
  readonly tags: readonly string[];
  readonly channels: readonly ChatLiveOpsChannelId[];
  readonly channelPriority: Readonly<Record<ChatLiveOpsChannelId, number>>;
  readonly forced: boolean;
  readonly seasonId?: string | null;
  readonly rules: readonly ChatLiveOpsOverlayRule[];
  readonly notes: readonly string[];
}

export interface GlobalEventSchedulerState {
  readonly version: string;
  readonly definitions: readonly GlobalEventDefinition[];
  readonly activations: readonly GlobalEventActivation[];
  readonly activationCountsByEvent: Readonly<Record<string, number>>;
  readonly cancelledActivationIds: readonly string[];
  readonly lastEvaluatedAt?: number | null;
}

export interface GlobalEventSchedulerSnapshot {
  readonly evaluatedAt: number;
  readonly activeProjections: readonly GlobalEventProjection[];
  readonly upcomingProjections: readonly GlobalEventProjection[];
  readonly overlays: ChatLiveOpsOverlaySnapshot;
  readonly diagnostics: {
    readonly totalDefinitions: number;
    readonly totalActive: number;
    readonly totalUpcoming: number;
    readonly roomCount: number;
    readonly activeFamilies: readonly GlobalEventFamily[];
  };
}

export interface ForceActivationInput {
  readonly eventId: string;
  readonly startsAt?: number;
  readonly endsAt?: number;
  readonly durationMs?: number;
  readonly roomScopedRoomIds?: readonly string[];
  readonly notes?: readonly string[];
}

export interface GlobalEventSchedulerOptions {
  readonly clock?: SchedulerNowProvider;
  readonly definitionVersion?: string;
  readonly seedDefinitions?: readonly GlobalEventDefinition[];
  readonly defaultUpcomingHorizonMs?: number;
  readonly maxProjectedUpcomingPerEvent?: number;
}

const DEFAULT_DEFINITION_VERSION = '2026.03.19-liveops';
const DEFAULT_UPCOMING_HORIZON_MS = 1000 * 60 * 60 * 6;
const DEFAULT_MAX_PROJECTED_UPCOMING_PER_EVENT = 4;
const ONE_MINUTE_MS = 60_000;
const ONE_HOUR_MS = ONE_MINUTE_MS * 60;
const ONE_DAY_MS = ONE_HOUR_MS * 24;

const ALL_VISIBLE_CHANNELS: readonly ChatLiveOpsChannelId[] = [
  'GLOBAL',
  'SYNDICATE',
  'DEAL_ROOM',
  'LOBBY',
] as const;

function systemNow(): number {
  return Date.now();
}

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function cloneStringArray(input?: readonly string[] | null): string[] {
  return input ? [...input] : [];
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

function sortByStartsAtAscending<T extends { readonly startsAt: number }>(values: readonly T[]): T[] {
  return [...values].sort((left, right) => left.startsAt - right.startsAt);
}

function createActivationId(eventId: string, startsAt: number, source: GlobalEventActivation['source']): string {
  return `${eventId}::${source}::${startsAt}`;
}

function inRange(now: number, startsAt: number, endsAt: number): boolean {
  return now >= startsAt && now < endsAt;
}

function clampChannelPriority(
  input: Partial<Record<ChatLiveOpsChannelId, number>> | undefined,
  fallback: number,
): Readonly<Record<ChatLiveOpsChannelId, number>> {
  return freeze({
    GLOBAL: input?.GLOBAL ?? fallback,
    SYNDICATE: input?.SYNDICATE ?? fallback,
    DEAL_ROOM: input?.DEAL_ROOM ?? fallback,
    LOBBY: input?.LOBBY ?? fallback,
  });
}

function asOverlayDefinition(
  definition: GlobalEventDefinition,
  activation: GlobalEventActivation,
): ChatLiveOpsOverlayDefinition {
  return {
    overlayId: activation.activationId,
    seasonId: definition.seasonId ?? null,
    displayName: definition.displayName,
    kind: definition.family === 'SEASON' ? 'SEASON' : 'WORLD_EVENT',
    intensity: definition.intensity,
    startsAt: activation.startsAt,
    endsAt: activation.endsAt,
    headline: definition.headline,
    summaryLines: [...definition.summaryLines],
    tags: [...definition.tags],
    channelPriority: definition.channelPriority,
    rules: [...definition.rules],
  };
}

function matchesTags(
  candidateTags: readonly string[],
  requiredTags?: readonly string[],
  excludedTags?: readonly string[],
): boolean {
  const pool = new Set(candidateTags);
  if (requiredTags) {
    for (const tag of requiredTags) {
      if (!pool.has(tag)) {
        return false;
      }
    }
  }
  if (excludedTags) {
    for (const tag of excludedTags) {
      if (pool.has(tag)) {
        return false;
      }
    }
  }
  return true;
}

function utcDayFloor(timestampMs: number): number {
  const d = new Date(timestampMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function nextDailyWindowStarts(
  now: number,
  horizonEnd: number,
  rule: GlobalEventRecurringDailyUtcRule,
): number[] {
  const starts: number[] = [];
  let cursor = utcDayFloor(now - ONE_DAY_MS);

  while (cursor <= horizonEnd + ONE_DAY_MS) {
    const date = new Date(cursor);
    const weekday = date.getUTCDay();
    const allowed = !rule.allowedWeekdays || rule.allowedWeekdays.includes(weekday);
    if (allowed) {
      const start = Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        rule.hourUtc,
        rule.minuteUtc,
        0,
        0,
      );
      if (start + rule.durationMs >= now && start <= horizonEnd) {
        starts.push(start);
      }
    }
    cursor += ONE_DAY_MS;
  }

  return starts;
}

function nextIntervalWindowStarts(
  now: number,
  horizonEnd: number,
  rule: GlobalEventRecurringIntervalRule,
): number[] {
  const starts: number[] = [];
  const alignTo = rule.alignToEpochMs ?? 0;
  const interval = Math.max(rule.intervalMs, ONE_MINUTE_MS);
  const firstIndex = Math.floor((now - alignTo) / interval) - 1;
  const lastIndex = Math.ceil((horizonEnd - alignTo) / interval) + 1;

  for (let index = firstIndex; index <= lastIndex; index += 1) {
    let start = alignTo + index * interval;
    if (rule.jitterMs && rule.jitterMs > 0) {
      const deterministic = Math.sin(index * 12.9898) * 43758.5453;
      const fractional = deterministic - Math.floor(deterministic);
      const jitter = Math.floor((fractional * 2 - 1) * rule.jitterMs);
      start += jitter;
    }

    if (start + rule.durationMs >= now && start <= horizonEnd) {
      starts.push(start);
    }
  }

  return starts;
}

function createDefaultWorldEventLibrary(version: string): readonly GlobalEventDefinition[] {
  const baseRule = (ruleId: string, tags: readonly string[], pressureDelta: number): ChatLiveOpsOverlayRule => ({
    ruleId,
    appliesToChannels: [...ALL_VISIBLE_CHANNELS],
    addedPlanningTags: [...tags],
    transformBiases: [...tags],
    pressureDelta,
    publicnessDelta: pressureDelta >= 2 ? 2 : 1,
    callbackAggressionDelta: pressureDelta >= 2 ? 2 : 1,
  });

  return freeze([
    freeze({
      eventId: 'world.liquidator.low-shield-hunt',
      family: 'COORDINATED_RAID',
      displayName: 'The Liquidator Hunt',
      headline: 'The Liquidator is hunting low-shield players.',
      summaryLines: freeze([
        'Low-shield rooms are now drawing concentrated witness and hater pressure.',
        'Expect faster crowd pile-ons, sharper callbacks, and more public scrutiny.',
      ]),
      scheduleKind: 'RECURRING_INTERVAL',
      visibility: 'HYBRID',
      intensity: 'WORLD_CLASS',
      tags: freeze(['LIQUIDATOR', 'LOW_SHIELD_HUNT', 'RAID_WINDOW']),
      channels: freeze(['GLOBAL', 'SYNDICATE', 'DEAL_ROOM']),
      channelPriority: clampChannelPriority({ GLOBAL: 100, SYNDICATE: 80, DEAL_ROOM: 70, LOBBY: 30 }, 50),
      rules: freeze([
        baseRule('liquidator.global.swarm', ['LIQUIDATOR_HUNT', 'SWARM_VISIBLE'], 3),
        {
          ruleId: 'liquidator.deal-room.predation',
          appliesToChannels: freeze(['DEAL_ROOM']),
          addedPlanningTags: freeze(['DEAL_ROOM_PREDATION', 'PRICE_STRESS']),
          transformBiases: freeze(['PREDATORY', 'QUICK_CLOSES']),
          pressureDelta: 3,
          publicnessDelta: 1,
          callbackAggressionDelta: 2,
        },
      ]),
      cooldownMs: ONE_HOUR_MS,
      maxConcurrentGlobalInstances: 1,
      repeatGranularity: 'HOUR',
      priorityWeight: 100,
      definitionVersion: version,
      windows: freeze([
        {
          recurringInterval: freeze({
            intervalMs: ONE_HOUR_MS * 6,
            durationMs: ONE_MINUTE_MS * 20,
            alignToEpochMs: 0,
            jitterMs: ONE_MINUTE_MS * 3,
          }),
        },
      ]),
    }),
    freeze({
      eventId: 'world.syndicate.panic',
      family: 'FACTION_SURGE',
      displayName: 'Syndicate Panic',
      headline: 'A syndicate-wide panic wave is distorting private chat pressure.',
      summaryLines: freeze([
        'Private channels become sharper, quieter, and more tactical.',
        'Confidence signaling now matters more than volume.',
      ]),
      scheduleKind: 'RECURRING_DAILY_UTC',
      visibility: 'HYBRID',
      intensity: 'SEVERE',
      tags: freeze(['SYNDICATE_PANIC', 'TACTICAL_FALLOUT']),
      channels: freeze(['SYNDICATE', 'GLOBAL']),
      channelPriority: clampChannelPriority({ SYNDICATE: 100, GLOBAL: 45, DEAL_ROOM: 40, LOBBY: 10 }, 20),
      rules: freeze([
        {
          ruleId: 'panic.private-tightening',
          appliesToChannels: freeze(['SYNDICATE']),
          addedPlanningTags: freeze(['QUIET_TACTICAL', 'PARANOIA_SPIKE']),
          transformBiases: freeze(['QUIET', 'WATCHFUL', 'TRUST_SENSITIVE']),
          pressureDelta: 2,
          publicnessDelta: -1,
          callbackAggressionDelta: 1,
        },
      ]),
      cooldownMs: ONE_HOUR_MS * 8,
      maxConcurrentGlobalInstances: 1,
      repeatGranularity: 'DAY',
      priorityWeight: 82,
      definitionVersion: version,
      windows: freeze([
        {
          recurringDailyUtc: freeze({
            hourUtc: 2,
            minuteUtc: 0,
            durationMs: ONE_MINUTE_MS * 25,
          }),
        },
      ]),
    }),
    freeze({
      eventId: 'world.market-rumor-burst',
      family: 'WORLD_EVENT',
      displayName: 'Market Rumor Burst',
      headline: 'A market rumor burst is destabilizing public witness behavior.',
      summaryLines: freeze([
        'Speculation spreads faster than verification in GLOBAL and LOBBY.',
        'Players can ride the rumor, reject it, or weaponize its uncertainty.',
      ]),
      scheduleKind: 'RECURRING_INTERVAL',
      visibility: 'VISIBLE',
      intensity: 'ACTIVE',
      tags: freeze(['MARKET_RUMOR', 'WITNESS_SWELL']),
      channels: freeze(['GLOBAL', 'LOBBY']),
      channelPriority: clampChannelPriority({ GLOBAL: 90, LOBBY: 85, SYNDICATE: 30, DEAL_ROOM: 35 }, 20),
      rules: freeze([
        baseRule('rumor.public.witness', ['PUBLIC_RUMOR_WAVE', 'WITNESS_SWELL'], 2),
      ]),
      cooldownMs: ONE_HOUR_MS * 2,
      maxConcurrentGlobalInstances: 1,
      repeatGranularity: 'HOUR',
      priorityWeight: 71,
      definitionVersion: version,
      windows: freeze([
        {
          recurringInterval: freeze({
            intervalMs: ONE_HOUR_MS * 3,
            durationMs: ONE_MINUTE_MS * 12,
            jitterMs: ONE_MINUTE_MS * 2,
          }),
        },
      ]),
    }),
    freeze({
      eventId: 'world.helper-blackout',
      family: 'HELPER_BLACKOUT',
      displayName: 'Helper Blackout',
      headline: 'Helper support is partially blacked out.',
      summaryLines: freeze([
        'Rescue pacing slows and blunt interventions become rarer.',
        'Silence becomes part of the authored pressure budget.',
      ]),
      scheduleKind: 'RECURRING_DAILY_UTC',
      visibility: 'SHADOW_ONLY',
      intensity: 'SEVERE',
      tags: freeze(['HELPER_BLACKOUT', 'RESCUE_SILENCE']),
      channels: freeze(['GLOBAL', 'SYNDICATE', 'DEAL_ROOM']),
      channelPriority: clampChannelPriority({ GLOBAL: 40, SYNDICATE: 55, DEAL_ROOM: 60, LOBBY: 10 }, 20),
      rules: freeze([
        {
          ruleId: 'helpers.quiet-down',
          addedPlanningTags: freeze(['HELPER_BLACKOUT', 'DELAY_RESCUE']),
          transformBiases: freeze(['SILENCE', 'WITHHELD_REASSURANCE']),
          pressureDelta: 2,
          publicnessDelta: 0,
          callbackAggressionDelta: 1,
        },
      ]),
      cooldownMs: ONE_HOUR_MS * 10,
      maxConcurrentGlobalInstances: 1,
      repeatGranularity: 'DAY',
      priorityWeight: 88,
      definitionVersion: version,
      windows: freeze([
        {
          recurringDailyUtc: freeze({
            hourUtc: 9,
            minuteUtc: 15,
            durationMs: ONE_MINUTE_MS * 15,
          }),
        },
      ]),
    }),
    freeze({
      eventId: 'world.double-heat-global',
      family: 'CHANNEL_MUTATOR',
      displayName: 'Double Heat',
      headline: 'GLOBAL is running at double heat.',
      summaryLines: freeze([
        'Witness behavior is amplified and crowd pivots happen faster.',
        'Overextensions are remembered more aggressively.',
      ]),
      scheduleKind: 'RECURRING_INTERVAL',
      visibility: 'VISIBLE',
      intensity: 'SEVERE',
      tags: freeze(['DOUBLE_HEAT', 'GLOBAL_STAGE']),
      channels: freeze(['GLOBAL']),
      channelPriority: clampChannelPriority({ GLOBAL: 100, SYNDICATE: 20, DEAL_ROOM: 15, LOBBY: 50 }, 10),
      rules: freeze([
        {
          ruleId: 'double-heat.global-only',
          appliesToChannels: freeze(['GLOBAL']),
          addedPlanningTags: freeze(['GLOBAL_DOUBLE_HEAT', 'FAST_WITNESS_TURNS']),
          transformBiases: freeze(['THEATRICAL', 'PILE_ON_READY']),
          pressureDelta: 3,
          publicnessDelta: 3,
          callbackAggressionDelta: 2,
        },
      ]),
      cooldownMs: ONE_HOUR_MS,
      maxConcurrentGlobalInstances: 1,
      repeatGranularity: 'HOUR',
      priorityWeight: 94,
      definitionVersion: version,
      windows: freeze([
        {
          recurringInterval: freeze({
            intervalMs: ONE_HOUR_MS * 4,
            durationMs: ONE_MINUTE_MS * 10,
            jitterMs: ONE_MINUTE_MS,
          }),
        },
      ]),
    }),
    freeze({
      eventId: 'world.whisper-only-interval',
      family: 'WHISPER_WINDOW',
      displayName: 'Whisper-Only Interval',
      headline: 'The room narrows into a whisper-only interval.',
      summaryLines: freeze([
        'Public surface volume drops while shadow planning density rises.',
        'Interruption law becomes stricter and timing matters more.',
      ]),
      scheduleKind: 'RECURRING_DAILY_UTC',
      visibility: 'HYBRID',
      intensity: 'ACTIVE',
      tags: freeze(['WHISPER_ONLY', 'SHADOW_DENSITY']),
      channels: freeze(['GLOBAL', 'SYNDICATE']),
      channelPriority: clampChannelPriority({ GLOBAL: 55, SYNDICATE: 80, DEAL_ROOM: 50, LOBBY: 30 }, 20),
      rules: freeze([
        {
          ruleId: 'whisper.silence-law',
          addedPlanningTags: freeze(['WHISPER_ONLY', 'INTERRUPTION_TIGHT']),
          transformBiases: freeze(['QUIET', 'PAUSED', 'SUSPECTING']),
          pressureDelta: 1,
          publicnessDelta: -2,
          callbackAggressionDelta: 1,
        },
      ]),
      cooldownMs: ONE_HOUR_MS * 5,
      maxConcurrentGlobalInstances: 1,
      repeatGranularity: 'DAY',
      priorityWeight: 63,
      definitionVersion: version,
      windows: freeze([
        {
          recurringDailyUtc: freeze({
            hourUtc: 5,
            minuteUtc: 45,
            durationMs: ONE_MINUTE_MS * 8,
          }),
        },
      ]),
    }),
    freeze({
      eventId: 'world.faction-debate',
      family: 'FACTION_SURGE',
      displayName: 'Faction Debate',
      headline: 'Faction debate has seized the room.',
      summaryLines: freeze([
        'Competing narratives are colliding in public and private surfaces.',
        'Reputation posture changes how your words are interpreted.',
      ]),
      scheduleKind: 'RECURRING_INTERVAL',
      visibility: 'VISIBLE',
      intensity: 'ACTIVE',
      tags: freeze(['FACTION_DEBATE', 'NARRATIVE_CONTEST']),
      channels: freeze(['GLOBAL', 'SYNDICATE', 'LOBBY']),
      channelPriority: clampChannelPriority({ GLOBAL: 88, SYNDICATE: 80, DEAL_ROOM: 25, LOBBY: 65 }, 20),
      rules: freeze([
        baseRule('debate.public.pressure', ['FACTION_DEBATE', 'WITNESS_ARGUMENT'], 2),
      ]),
      cooldownMs: ONE_HOUR_MS * 3,
      maxConcurrentGlobalInstances: 1,
      repeatGranularity: 'HOUR',
      priorityWeight: 76,
      definitionVersion: version,
      windows: freeze([
        {
          recurringInterval: freeze({
            intervalMs: ONE_HOUR_MS * 8,
            durationMs: ONE_MINUTE_MS * 18,
          }),
        },
      ]),
    }),
    freeze({
      eventId: 'world.coordinated-hater-raid',
      family: 'COORDINATED_RAID',
      displayName: 'Coordinated Hater Raid',
      headline: 'A coordinated hater raid is entering the room.',
      summaryLines: freeze([
        'Interruption order tightens and callback pressure intensifies.',
        'Silence windows shorten while swarm cadence accelerates.',
      ]),
      scheduleKind: 'RECURRING_INTERVAL',
      visibility: 'HYBRID',
      intensity: 'WORLD_CLASS',
      tags: freeze(['HATER_RAID', 'INTERRUPTION_SPIKE']),
      channels: freeze(['GLOBAL', 'SYNDICATE', 'DEAL_ROOM']),
      channelPriority: clampChannelPriority({ GLOBAL: 95, SYNDICATE: 92, DEAL_ROOM: 90, LOBBY: 20 }, 20),
      rules: freeze([
        {
          ruleId: 'raid.interruption-fastlane',
          addedPlanningTags: freeze(['RAID_WINDOW', 'FAST_INTERRUPTION', 'CALLBACK_HARDENED']),
          transformBiases: freeze(['AGGRESSIVE', 'FAST', 'PERSONAL']),
          pressureDelta: 4,
          publicnessDelta: 2,
          callbackAggressionDelta: 4,
        },
      ]),
      cooldownMs: ONE_HOUR_MS * 6,
      maxConcurrentGlobalInstances: 1,
      repeatGranularity: 'HOUR',
      priorityWeight: 99,
      definitionVersion: version,
      windows: freeze([
        {
          recurringInterval: freeze({
            intervalMs: ONE_HOUR_MS * 12,
            durationMs: ONE_MINUTE_MS * 14,
            jitterMs: ONE_MINUTE_MS * 2,
          }),
        },
      ]),
    }),
  ]);
}

export class GlobalEventScheduler {
  private readonly clock: SchedulerNowProvider;
  private readonly definitionVersion: string;
  private readonly defaultUpcomingHorizonMs: number;
  private readonly maxProjectedUpcomingPerEvent: number;

  private readonly definitions = new Map<string, GlobalEventDefinition>();
  private readonly activations = new Map<string, GlobalEventActivation>();
  private readonly cancelledActivationIds = new Set<string>();
  private readonly activationCountsByEvent = new Map<string, number>();

  private lastEvaluatedAt: number | null = null;

  public constructor(options: GlobalEventSchedulerOptions = {}) {
    this.clock = options.clock ?? systemNow;
    this.definitionVersion = options.definitionVersion ?? DEFAULT_DEFINITION_VERSION;
    this.defaultUpcomingHorizonMs = options.defaultUpcomingHorizonMs ?? DEFAULT_UPCOMING_HORIZON_MS;
    this.maxProjectedUpcomingPerEvent =
      options.maxProjectedUpcomingPerEvent ?? DEFAULT_MAX_PROJECTED_UPCOMING_PER_EVENT;

    const seeds = options.seedDefinitions ?? createDefaultWorldEventLibrary(this.definitionVersion);
    this.registerMany(seeds);
  }

  public registerMany(definitions: readonly GlobalEventDefinition[]): void {
    for (const definition of definitions) {
      this.registerDefinition(definition);
    }
  }

  public registerDefinition(input: GlobalEventDefinition): void {
    const normalized = this.normalizeDefinition(input);
    this.definitions.set(normalized.eventId, normalized);
  }

  public removeDefinition(eventId: string): boolean {
    const removed = this.definitions.delete(eventId);
    if (!removed) {
      return false;
    }

    for (const activation of [...this.activations.values()]) {
      if (activation.eventId === eventId) {
        this.activations.delete(activation.activationId);
        this.cancelledActivationIds.add(activation.activationId);
      }
    }

    this.activationCountsByEvent.delete(eventId);
    return true;
  }

  public listDefinitions(): readonly GlobalEventDefinition[] {
    return [...this.definitions.values()].sort((left, right) => {
      if (left.priorityWeight !== right.priorityWeight) {
        return right.priorityWeight - left.priorityWeight;
      }
      return left.eventId.localeCompare(right.eventId);
    });
  }

  public getDefinition(eventId: string): GlobalEventDefinition | null {
    return this.definitions.get(eventId) ?? null;
  }

  public forceActivate(input: ForceActivationInput): GlobalEventActivation {
    const definition = this.requireDefinition(input.eventId);
    const now = this.clock();
    const startsAt = input.startsAt ?? now;
    const endsAt = input.endsAt ?? startsAt + Math.max(input.durationMs ?? ONE_MINUTE_MS * 10, ONE_MINUTE_MS);
    const activation: GlobalEventActivation = freeze({
      activationId: createActivationId(definition.eventId, startsAt, 'MANUAL'),
      eventId: definition.eventId,
      startsAt,
      endsAt,
      forced: true,
      roomScopedRoomIds: input.roomScopedRoomIds ? [...input.roomScopedRoomIds] : undefined,
      mintedAt: now,
      source: 'MANUAL',
      triggerTag: null,
      notes: freeze(uniqueStrings([...(input.notes ?? []), 'FORCED_MANUAL_ACTIVATION'])),
    });

    this.upsertActivation(activation, definition);
    return activation;
  }

  public cancelActivation(activationId: string): boolean {
    const deleted = this.activations.delete(activationId);
    if (deleted) {
      this.cancelledActivationIds.add(activationId);
    }
    return deleted;
  }

  public evaluate(
    context: GlobalEventSchedulerEvaluationContext = {},
  ): GlobalEventSchedulerSnapshot {
    const now = context.now ?? this.clock();
    this.lastEvaluatedAt = now;
    this.pruneExpiredActivations(now);

    const activeProjections: GlobalEventProjection[] = [];
    const upcomingProjections: GlobalEventProjection[] = [];

    for (const definition of this.listDefinitions()) {
      this.mintDeterministicWindows(definition, now, this.defaultUpcomingHorizonMs, context);

      const projections = this.collectProjectionsForDefinition(
        definition,
        now,
        now + this.defaultUpcomingHorizonMs,
      );

      for (const projection of projections.active) {
        activeProjections.push(projection);
      }

      for (const projection of projections.upcoming) {
        upcomingProjections.push(projection);
      }
    }

    const sortedActive = sortByStartsAtAscending(activeProjections);
    const sortedUpcoming = sortByStartsAtAscending(upcomingProjections);
    const activeFamilies = uniqueStrings(sortedActive.map((event) => event.family)) as GlobalEventFamily[];

    return {
      evaluatedAt: now,
      activeProjections: sortedActive,
      upcomingProjections: sortedUpcoming,
      overlays: {
        updatedAt: now,
        activeSeasonId: this.resolveActiveSeasonId(sortedActive),
        activeOverlays: sortedActive.map((projection) =>
          asOverlayDefinition(this.requireDefinition(projection.eventId), this.requireActivation(projection.activationId)),
        ),
        upcomingOverlays: sortedUpcoming.map((projection) =>
          asOverlayDefinition(this.requireDefinition(projection.eventId), this.requireActivation(projection.activationId)),
        ),
      },
      diagnostics: {
        totalDefinitions: this.definitions.size,
        totalActive: sortedActive.length,
        totalUpcoming: sortedUpcoming.length,
        roomCount: context.rooms?.length ?? 0,
        activeFamilies,
      },
    };
  }

  public serialize(): GlobalEventSchedulerState {
    return {
      version: this.definitionVersion,
      definitions: this.listDefinitions(),
      activations: sortByStartsAtAscending([...this.activations.values()]),
      activationCountsByEvent: Object.freeze(Object.fromEntries(this.activationCountsByEvent.entries())),
      cancelledActivationIds: [...this.cancelledActivationIds],
      lastEvaluatedAt: this.lastEvaluatedAt,
    };
  }

  public hydrate(state: GlobalEventSchedulerState): void {
    this.definitions.clear();
    this.activations.clear();
    this.activationCountsByEvent.clear();
    this.cancelledActivationIds.clear();

    this.registerMany(state.definitions);

    for (const activation of state.activations) {
      const definition = this.definitions.get(activation.eventId);
      if (!definition) {
        continue;
      }
      this.activations.set(activation.activationId, activation);
    }

    for (const [eventId, count] of Object.entries(state.activationCountsByEvent)) {
      this.activationCountsByEvent.set(eventId, count);
    }

    for (const activationId of state.cancelledActivationIds) {
      this.cancelledActivationIds.add(activationId);
    }

    this.lastEvaluatedAt = state.lastEvaluatedAt ?? null;
  }

  private normalizeDefinition(input: GlobalEventDefinition): GlobalEventDefinition {
    const channels = input.channels.length > 0 ? [...input.channels] : [...ALL_VISIBLE_CHANNELS];
    const uniqueTags = uniqueStrings(input.tags);

    return freeze({
      ...input,
      tags: freeze(uniqueTags),
      channels: freeze(uniqueStrings(channels as unknown as string[]) as ChatLiveOpsChannelId[]),
      channelPriority: clampChannelPriority(input.channelPriority, input.priorityWeight),
      rules: freeze(input.rules.map((rule) => freeze({
        ...rule,
        appliesToBots: rule.appliesToBots ? freeze([...rule.appliesToBots]) : undefined,
        appliesToChannels: rule.appliesToChannels ? freeze([...rule.appliesToChannels]) : undefined,
        requiredTags: rule.requiredTags ? freeze([...rule.requiredTags]) : undefined,
        addedPlanningTags: freeze(uniqueStrings(rule.addedPlanningTags)),
        transformBiases: freeze(uniqueStrings(rule.transformBiases)),
      }))),
      windows: freeze(input.windows.map((window) => freeze({
        startsAt: window.startsAt,
        endsAt: window.endsAt,
        recurringDailyUtc: window.recurringDailyUtc ? freeze({ ...window.recurringDailyUtc }) : undefined,
        recurringInterval: window.recurringInterval ? freeze({ ...window.recurringInterval }) : undefined,
        matchState: window.matchState ? freeze({
          ...window.matchState,
          requiredTags: window.matchState.requiredTags ? freeze([...window.matchState.requiredTags]) : undefined,
          requiredModeIds: window.matchState.requiredModeIds ? freeze([...window.matchState.requiredModeIds]) : undefined,
        }) : undefined,
      }))),
      scopeModeIds: input.scopeModeIds ? freeze([...input.scopeModeIds]) : undefined,
      requiredTags: input.requiredTags ? freeze([...input.requiredTags]) : undefined,
      excludedTags: input.excludedTags ? freeze([...input.excludedTags]) : undefined,
      summaryLines: freeze(cloneStringArray(input.summaryLines)),
      definitionVersion: input.definitionVersion || this.definitionVersion,
      meta: input.meta ? freeze({ ...input.meta }) : undefined,
    });
  }

  private pruneExpiredActivations(now: number): void {
    for (const [activationId, activation] of this.activations.entries()) {
      if (activation.endsAt <= now) {
        this.activations.delete(activationId);
      }
    }
  }

  private collectProjectionsForDefinition(
    definition: GlobalEventDefinition,
    now: number,
    horizonEnd: number,
  ): { active: GlobalEventProjection[]; upcoming: GlobalEventProjection[] } {
    const matching = [...this.activations.values()]
      .filter((activation) => activation.eventId === definition.eventId)
      .sort((left, right) => left.startsAt - right.startsAt);

    const active: GlobalEventProjection[] = [];
    const upcoming: GlobalEventProjection[] = [];

    for (const activation of matching) {
      const projection = this.toProjection(definition, activation, now);
      if (projection.endsAt <= now || projection.startsAt > horizonEnd) {
        continue;
      }
      if (inRange(now, projection.startsAt, projection.endsAt)) {
        active.push(projection);
      } else if (projection.startsAt > now) {
        upcoming.push(projection);
      }
    }

    return {
      active,
      upcoming: upcoming.slice(0, this.maxProjectedUpcomingPerEvent),
    };
  }

  private toProjection(
    definition: GlobalEventDefinition,
    activation: GlobalEventActivation,
    now: number,
  ): GlobalEventProjection {
    return {
      activationId: activation.activationId,
      eventId: definition.eventId,
      family: definition.family,
      displayName: definition.displayName,
      headline: definition.headline,
      summaryLines: [...definition.summaryLines],
      intensity: definition.intensity,
      visibility: definition.visibility,
      startsAt: activation.startsAt,
      endsAt: activation.endsAt,
      timeRemainingMs: Math.max(activation.endsAt - now, 0),
      tags: [...definition.tags],
      channels: [...definition.channels],
      channelPriority: definition.channelPriority,
      forced: activation.forced,
      seasonId: definition.seasonId ?? null,
      rules: [...definition.rules],
      notes: [...activation.notes],
    };
  }

  private mintDeterministicWindows(
    definition: GlobalEventDefinition,
    now: number,
    horizonMs: number,
    context: GlobalEventSchedulerEvaluationContext,
  ): void {
    const horizonEnd = now + horizonMs;
    const globalTags = context.globalTags ?? [];

    if (!matchesTags(globalTags, definition.requiredTags, definition.excludedTags)) {
      return;
    }

    for (const window of definition.windows) {
      if (window.startsAt != null && window.endsAt != null) {
        this.tryMintActivation(
          definition,
          window.startsAt,
          window.endsAt,
          'FIXED_WINDOW',
          ['FIXED_WINDOW'],
        );
        continue;
      }

      if (window.recurringDailyUtc) {
        for (const start of nextDailyWindowStarts(now, horizonEnd, window.recurringDailyUtc)) {
          this.tryMintActivation(
            definition,
            start,
            start + window.recurringDailyUtc.durationMs,
            'RECURRING_DAILY_UTC',
            ['RECURRING_DAILY_UTC'],
          );
        }
      }

      if (window.recurringInterval) {
        for (const start of nextIntervalWindowStarts(now, horizonEnd, window.recurringInterval)) {
          this.tryMintActivation(
            definition,
            start,
            start + window.recurringInterval.durationMs,
            'RECURRING_INTERVAL',
            ['RECURRING_INTERVAL'],
          );
        }
      }

      if (window.matchState && context.rooms && context.rooms.length > 0) {
        for (const room of context.rooms) {
          if (!this.matchesRoomTrigger(window.matchState, room, definition)) {
            continue;
          }

          const start = now;
          const end = now + window.matchState.durationMs;
          this.tryMintActivation(
            definition,
            start,
            end,
            'MATCH_STATE_TRIGGER',
            [`ROOM_TRIGGER:${room.roomId}`, `TRIGGER_ID:${window.matchState.triggerId}`],
            [room.roomId],
          );
        }
      }
    }
  }

  private matchesRoomTrigger(
    rule: GlobalEventMatchStateRule,
    room: GlobalEventSchedulerRoomContext,
    definition: GlobalEventDefinition,
  ): boolean {
    if (rule.requiredModeIds && !rule.requiredModeIds.includes(room.mode ?? '')) {
      return false;
    }

    if (definition.scopeModeIds && definition.scopeModeIds.length > 0 && !definition.scopeModeIds.includes(room.mode ?? '')) {
      return false;
    }

    if (rule.minLowShieldPlayers != null && (room.lowShieldPlayerCount ?? 0) < rule.minLowShieldPlayers) {
      return false;
    }

    if (rule.minPanicLevel != null && (room.panicLevel ?? 0) < rule.minPanicLevel) {
      return false;
    }

    if (!matchesTags(room.tags ?? [], rule.requiredTags)) {
      return false;
    }

    return true;
  }

  private tryMintActivation(
    definition: GlobalEventDefinition,
    startsAt: number,
    endsAt: number,
    source: GlobalEventActivation['source'],
    notes: readonly string[],
    roomScopedRoomIds?: readonly string[],
  ): void {
    const activationId = createActivationId(definition.eventId, startsAt, source);
    if (this.cancelledActivationIds.has(activationId)) {
      return;
    }

    if (this.activations.has(activationId)) {
      return;
    }

    const existingForEvent = [...this.activations.values()].filter((activation) => activation.eventId === definition.eventId);
    if (existingForEvent.length >= definition.maxConcurrentGlobalInstances && !roomScopedRoomIds) {
      return;
    }

    const lastCount = this.activationCountsByEvent.get(definition.eventId) ?? 0;
    const activation: GlobalEventActivation = freeze({
      activationId,
      eventId: definition.eventId,
      startsAt,
      endsAt,
      forced: false,
      roomScopedRoomIds: roomScopedRoomIds ? [...roomScopedRoomIds] : undefined,
      mintedAt: this.clock(),
      source,
      triggerTag: roomScopedRoomIds?.[0] ?? null,
      notes: freeze(uniqueStrings([...notes, `ACTIVATION_INDEX:${lastCount + 1}`])),
    });

    this.upsertActivation(activation, definition);
  }

  private upsertActivation(activation: GlobalEventActivation, definition: GlobalEventDefinition): void {
    this.activations.set(activation.activationId, activation);
    this.activationCountsByEvent.set(
      definition.eventId,
      (this.activationCountsByEvent.get(definition.eventId) ?? 0) + 1,
    );
  }

  private resolveActiveSeasonId(active: readonly GlobalEventProjection[]): string | null {
    const season = active.find((projection) => projection.family === 'SEASON' && projection.seasonId);
    return season?.seasonId ?? null;
  }

  private requireDefinition(eventId: string): GlobalEventDefinition {
    const definition = this.definitions.get(eventId);
    if (!definition) {
      throw new Error(`GlobalEventScheduler: unknown definition '${eventId}'.`);
    }
    return definition;
  }

  private requireActivation(activationId: string): GlobalEventActivation {
    const activation = this.activations.get(activationId);
    if (!activation) {
      throw new Error(`GlobalEventScheduler: unknown activation '${activationId}'.`);
    }
    return activation;
  }
}

export function createGlobalEventScheduler(
  options: GlobalEventSchedulerOptions = {},
): GlobalEventScheduler {
  return new GlobalEventScheduler(options);
}


/* eslint-disable max-lines */

/**
 * ============================================================================
 * POINT ZERO ONE — GLOBAL EVENT SCHEDULER INSPECTION + CONTROL PLANE
 * ============================================================================
 *
 * This extension layer keeps the canonical scheduler intact while surfacing
 * the deeper operational, QA, replay, planning, and index-accessible helpers
 * that the rest of the liveops lane needs.
 */

export type GlobalEventWindowSourceKind =
  | 'FIXED_WINDOW'
  | 'RECURRING_INTERVAL'
  | 'RECURRING_DAILY_UTC'
  | 'MATCH_STATE_TRIGGER'
  | 'MANUAL';

export type GlobalEventHealthBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type GlobalEventRoomPressureBand = 'CALM' | 'TENSE' | 'HOSTILE' | 'PREDATORY' | 'CEREMONIAL';

export interface GlobalEventWindowPreview {
  readonly eventId: string;
  readonly displayName: string;
  readonly family: GlobalEventFamily;
  readonly visibility: GlobalEventVisibility;
  readonly source: GlobalEventWindowSourceKind;
  readonly startsAt: number;
  readonly endsAt: number;
  readonly durationMs: number;
  readonly projectedForRoomIds?: readonly string[];
  readonly notes: readonly string[];
}

export interface GlobalEventProjectionGroup {
  readonly eventId: string;
  readonly displayName: string;
  readonly family: GlobalEventFamily;
  readonly visibility: GlobalEventVisibility;
  readonly intensity: ChatLiveOpsIntensityBand;
  readonly projectionCount: number;
  readonly earliestStartsAt: number;
  readonly latestEndsAt: number;
  readonly totalRemainingMs: number;
  readonly channels: readonly ChatLiveOpsChannelId[];
  readonly tags: readonly string[];
  readonly notes: readonly string[];
}

export interface GlobalEventChannelLoad {
  readonly channelId: ChatLiveOpsChannelId;
  readonly activeCount: number;
  readonly upcomingCount: number;
  readonly combinedPriority: number;
  readonly averagePriority: number;
  readonly dominantFamilies: readonly GlobalEventFamily[];
  readonly dominantEventIds: readonly string[];
  readonly pressureWeight: number;
  readonly heatBand: GlobalEventHealthBand;
}

export interface GlobalEventFamilyLoad {
  readonly family: GlobalEventFamily;
  readonly activeCount: number;
  readonly upcomingCount: number;
  readonly activeEventIds: readonly string[];
  readonly visibilityMix: Readonly<Record<GlobalEventVisibility, number>>;
  readonly pressureWeight: number;
}

export interface GlobalEventActivationDigest {
  readonly activationId: string;
  readonly eventId: string;
  readonly family: GlobalEventFamily;
  readonly displayName: string;
  readonly source: GlobalEventActivation['source'];
  readonly forced: boolean;
  readonly startsAt: number;
  readonly endsAt: number;
  readonly durationMs: number;
  readonly channels: readonly ChatLiveOpsChannelId[];
  readonly tags: readonly string[];
  readonly roomScopedRoomIds: readonly string[];
  readonly notes: readonly string[];
}

export interface GlobalEventDefinitionAudit {
  readonly eventId: string;
  readonly displayName: string;
  readonly family: GlobalEventFamily;
  readonly definitionVersion: string;
  readonly scheduleKind: GlobalEventScheduleKind;
  readonly visibility: GlobalEventVisibility;
  readonly intensity: ChatLiveOpsIntensityBand;
  readonly channels: readonly ChatLiveOpsChannelId[];
  readonly tags: readonly string[];
  readonly windows: number;
  readonly rules: number;
  readonly requiredTags: readonly string[];
  readonly excludedTags: readonly string[];
  readonly scopeModeIds: readonly string[];
  readonly issues: readonly string[];
  readonly strengths: readonly string[];
  readonly readinessScore: number;
}

export interface GlobalEventRoomProjection {
  readonly roomId: string;
  readonly eventId: string;
  readonly activationId: string;
  readonly displayName: string;
  readonly family: GlobalEventFamily;
  readonly visibility: GlobalEventVisibility;
  readonly intensity: ChatLiveOpsIntensityBand;
  readonly applicable: boolean;
  readonly relevanceScore: number;
  readonly preferredChannels: readonly ChatLiveOpsChannelId[];
  readonly channelPriority: Readonly<Record<ChatLiveOpsChannelId, number>>;
  readonly derivedTags: readonly string[];
  readonly stageMood: GlobalEventRoomPressureBand;
  readonly pressureWeight: number;
  readonly rescueSuppressionWeight: number;
  readonly whisperWeight: number;
  readonly likelyFactionPressure: number;
  readonly notes: readonly string[];
}

export interface GlobalEventRoomProjectionMatrixRow {
  readonly roomId: string;
  readonly mode: string | null;
  readonly mountTarget: string | null;
  readonly activeEventIds: readonly string[];
  readonly upcomingEventIds: readonly string[];
  readonly projectedChannels: readonly ChatLiveOpsChannelId[];
  readonly cumulativePressureWeight: number;
  readonly crowdHeat: number;
  readonly panicLevel: number;
  readonly notes: readonly string[];
}

export interface GlobalEventTimelineSlice {
  readonly startsAt: number;
  readonly endsAt: number;
  readonly eventIds: readonly string[];
  readonly families: readonly GlobalEventFamily[];
  readonly channels: readonly ChatLiveOpsChannelId[];
  readonly visibilityMix: Readonly<Record<GlobalEventVisibility, number>>;
  readonly notes: readonly string[];
}

export interface GlobalEventDetailedDiagnostics {
  readonly activationDigests: readonly GlobalEventActivationDigest[];
  readonly channelLoads: readonly GlobalEventChannelLoad[];
  readonly familyLoads: readonly GlobalEventFamilyLoad[];
  readonly groups: readonly GlobalEventProjectionGroup[];
  readonly healthBand: GlobalEventHealthBand;
  readonly totalProjectedPressure: number;
  readonly cancelledActivationCount: number;
}

export interface GlobalEventSchedulerDetailedSnapshot extends GlobalEventSchedulerSnapshot {
  readonly roomProjections: readonly GlobalEventRoomProjection[];
  readonly roomMatrix: readonly GlobalEventRoomProjectionMatrixRow[];
  readonly timeline: readonly GlobalEventTimelineSlice[];
  readonly audits: readonly GlobalEventDefinitionAudit[];
  readonly detailedDiagnostics: GlobalEventDetailedDiagnostics;
}

export interface GlobalEventSchedulerManifest {
  readonly generatedAt: number;
  readonly version: string;
  readonly definitionIds: readonly string[];
  readonly activationIds: readonly string[];
  readonly cancelledActivationIds: readonly string[];
  readonly families: readonly GlobalEventFamily[];
  readonly channelIds: readonly ChatLiveOpsChannelId[];
  readonly eventCountByFamily: Readonly<Record<GlobalEventFamily, number>>;
  readonly definitionAudits: readonly GlobalEventDefinitionAudit[];
}

export interface GlobalEventLibraryDiffEntry {
  readonly eventId: string;
  readonly status: 'ADDED' | 'REMOVED' | 'CHANGED' | 'UNCHANGED';
  readonly previousVersion?: string | null;
  readonly nextVersion?: string | null;
  readonly changedFields: readonly string[];
}

export interface GlobalEventLibraryDiff {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly changed: readonly GlobalEventLibraryDiffEntry[];
  readonly unchanged: readonly string[];
}

export interface GlobalEventDefinitionBuilderInput {
  readonly eventId: string;
  readonly family: GlobalEventFamily;
  readonly displayName: string;
  readonly headline: string;
  readonly summaryLines: readonly string[];
  readonly scheduleKind: GlobalEventScheduleKind;
  readonly visibility: GlobalEventVisibility;
  readonly intensity: ChatLiveOpsIntensityBand;
  readonly tags?: readonly string[];
  readonly channels?: readonly ChatLiveOpsChannelId[];
  readonly channelPriority?: Partial<Record<ChatLiveOpsChannelId, number>>;
  readonly rules?: readonly ChatLiveOpsOverlayRule[];
  readonly cooldownMs?: number;
  readonly maxConcurrentGlobalInstances?: number;
  readonly maxInstancesPerRoom?: number;
  readonly repeatGranularity?: GlobalEventRepeatGranularity;
  readonly priorityWeight?: number;
  readonly definitionVersion?: string;
  readonly seasonId?: string | null;
  readonly scopeModeIds?: readonly string[];
  readonly requiredTags?: readonly string[];
  readonly excludedTags?: readonly string[];
  readonly windows?: readonly GlobalEventWindowDefinition[];
  readonly meta?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface GlobalEventDefinitionPatch {
  readonly displayName?: string;
  readonly headline?: string;
  readonly summaryLines?: readonly string[];
  readonly scheduleKind?: GlobalEventScheduleKind;
  readonly visibility?: GlobalEventVisibility;
  readonly intensity?: ChatLiveOpsIntensityBand;
  readonly tags?: readonly string[];
  readonly channels?: readonly ChatLiveOpsChannelId[];
  readonly channelPriority?: Partial<Record<ChatLiveOpsChannelId, number>>;
  readonly rules?: readonly ChatLiveOpsOverlayRule[];
  readonly cooldownMs?: number;
  readonly maxConcurrentGlobalInstances?: number;
  readonly maxInstancesPerRoom?: number;
  readonly repeatGranularity?: GlobalEventRepeatGranularity;
  readonly priorityWeight?: number;
  readonly definitionVersion?: string;
  readonly seasonId?: string | null;
  readonly scopeModeIds?: readonly string[];
  readonly requiredTags?: readonly string[];
  readonly excludedTags?: readonly string[];
  readonly windows?: readonly GlobalEventWindowDefinition[];
  readonly meta?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface PreviewWindowsInput {
  readonly now?: number;
  readonly horizonMs?: number;
  readonly rooms?: readonly GlobalEventSchedulerRoomContext[];
  readonly globalTags?: readonly string[];
}

function uniqueChannels(input: readonly ChatLiveOpsChannelId[]): ChatLiveOpsChannelId[] {
  return uniqueStrings(input as readonly string[]) as ChatLiveOpsChannelId[];
}

function buildVisibilityMix(
  projections: readonly GlobalEventProjection[],
): Readonly<Record<GlobalEventVisibility, number>> {
  return freeze({
    VISIBLE: projections.filter((projection) => projection.visibility === 'VISIBLE').length,
    SHADOW_ONLY: projections.filter((projection) => projection.visibility === 'SHADOW_ONLY').length,
    HYBRID: projections.filter((projection) => projection.visibility === 'HYBRID').length,
  });
}

export function computeIntensityWeight(intensity: ChatLiveOpsIntensityBand): number {
  switch (intensity) {
    case 'QUIET':
      return 0.5;
    case 'ACTIVE':
      return 1.25;
    case 'SEVERE':
      return 2.1;
    case 'WORLD_CLASS':
      return 3.2;
    default:
      return 1;
  }
}

export function computeVisibilityWeight(visibility: GlobalEventVisibility): number {
  switch (visibility) {
    case 'VISIBLE':
      return 1.3;
    case 'SHADOW_ONLY':
      return 0.9;
    case 'HYBRID':
      return 1.6;
    default:
      return 1;
  }
}

export function computeFamilyWeight(family: GlobalEventFamily): number {
  switch (family) {
    case 'SEASON':
      return 1.1;
    case 'WORLD_EVENT':
      return 1.3;
    case 'HELPER_BLACKOUT':
      return 1.7;
    case 'CHANNEL_MUTATOR':
      return 1.6;
    case 'WHISPER_WINDOW':
      return 1.25;
    case 'FACTION_SURGE':
      return 1.55;
    case 'COORDINATED_RAID':
      return 2.0;
    case 'RIVAL_SPOTLIGHT':
      return 1.4;
    default:
      return 1;
  }
}

export function computeChannelPriorityAverage(
  channelPriority: Readonly<Record<ChatLiveOpsChannelId, number>>,
): number {
  const values = ALL_VISIBLE_CHANNELS.map((channelId) => channelPriority[channelId] ?? 0);
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function inferPressureBandForRoom(
  room: GlobalEventSchedulerRoomContext,
  projection: GlobalEventProjection,
): GlobalEventRoomPressureBand {
  const panic = room.panicLevel ?? 0;
  const heat = room.crowdHeat ?? 0;
  if (projection.visibility === 'SHADOW_ONLY' && panic >= 4) {
    return 'PREDATORY';
  }
  if (projection.family === 'WHISPER_WINDOW') {
    return 'CEREMONIAL';
  }
  if (projection.family === 'COORDINATED_RAID' || heat >= 7 || panic >= 8) {
    return 'HOSTILE';
  }
  if (projection.family === 'CHANNEL_MUTATOR' && projection.visibility !== 'SHADOW_ONLY') {
    return 'PREDATORY';
  }
  if (panic >= 4 || heat >= 4) {
    return 'TENSE';
  }
  return 'CALM';
}

export function inferPreferredChannelsForRoomProjection(
  room: GlobalEventSchedulerRoomContext,
  projection: GlobalEventProjection,
): readonly ChatLiveOpsChannelId[] {
  const preferred = new Set<ChatLiveOpsChannelId>();
  for (const channelId of projection.channels) {
    preferred.add(channelId);
  }

  const mode = room.mode ?? '';
  if (mode.includes('PREDATOR')) {
    preferred.add('DEAL_ROOM');
  }
  if (mode.includes('SYNDICATE')) {
    preferred.add('SYNDICATE');
  }
  if (mode.includes('LOBBY')) {
    preferred.add('LOBBY');
  }
  if (projection.visibility !== 'SHADOW_ONLY') {
    preferred.add('GLOBAL');
  }
  return uniqueChannels([...preferred]);
}

export function projectChannelPriorityToRoom(
  room: GlobalEventSchedulerRoomContext,
  projection: GlobalEventProjection,
): Readonly<Record<ChatLiveOpsChannelId, number>> {
  const roomBias =
    (room.panicLevel ?? 0) * 3 +
    (room.crowdHeat ?? 0) * 2 +
    Math.max((room.lowShieldPlayerCount ?? 0) - (room.activeHelperCount ?? 0), 0) * 4;

  const dealRoomBias = (room.mode ?? '').includes('PREDATOR') ? 14 : 0;
  const syndicateBias = (room.mode ?? '').includes('SYNDICATE') ? 12 : 0;
  const lobbyBias = (room.mode ?? '').includes('LOBBY') ? 8 : 0;
  const globalBias = projection.visibility === 'VISIBLE' ? 10 : projection.visibility === 'HYBRID' ? 6 : 1;

  return freeze({
    GLOBAL: (projection.channelPriority.GLOBAL ?? 0) + roomBias + globalBias,
    SYNDICATE: (projection.channelPriority.SYNDICATE ?? 0) + roomBias + syndicateBias,
    DEAL_ROOM: (projection.channelPriority.DEAL_ROOM ?? 0) + roomBias + dealRoomBias,
    LOBBY: (projection.channelPriority.LOBBY ?? 0) + roomBias + lobbyBias,
  });
}

export function computeRoomProjectionRelevance(
  room: GlobalEventSchedulerRoomContext,
  projection: GlobalEventProjection,
): number {
  let score = computeIntensityWeight(projection.intensity) * 20;
  score += computeVisibilityWeight(projection.visibility) * 10;
  score += computeFamilyWeight(projection.family) * 12;
  score += (room.crowdHeat ?? 0) * 4;
  score += (room.panicLevel ?? 0) * 5;
  score += (room.lowShieldPlayerCount ?? 0) * 6;
  score += Math.max((room.playerCount ?? 0) - (room.activeHelperCount ?? 0), 0) * 2;

  if ((room.mode ?? '').includes('PREDATOR') && projection.channels.includes('DEAL_ROOM')) {
    score += 18;
  }
  if ((room.mode ?? '').includes('SYNDICATE') && projection.channels.includes('SYNDICATE')) {
    score += 16;
  }
  if ((room.mountTarget ?? '').includes('POST_RUN')) {
    score *= 0.85;
  }

  const roomTags = new Set(room.tags ?? []);
  for (const tag of projection.tags) {
    if (roomTags.has(tag)) {
      score += 5;
    }
  }

  return Math.round(score * 100) / 100;
}

export function computeRoomProjectionPressureWeight(
  room: GlobalEventSchedulerRoomContext,
  projection: GlobalEventProjection,
): number {
  const helperDelta = Math.max((room.lowShieldPlayerCount ?? 0) - (room.activeHelperCount ?? 0), 0);
  const heat = room.crowdHeat ?? 0;
  const panic = room.panicLevel ?? 0;
  return Math.round(
    (computeIntensityWeight(projection.intensity) * 12 +
      computeVisibilityWeight(projection.visibility) * 8 +
      computeFamilyWeight(projection.family) * 10 +
      helperDelta * 7 +
      heat * 3 +
      panic * 4) * 100,
  ) / 100;
}

export function computeRoomProjectionRescueSuppressionWeight(
  room: GlobalEventSchedulerRoomContext,
  projection: GlobalEventProjection,
): number {
  let weight = 0;
  if (projection.family === 'HELPER_BLACKOUT') {
    weight += 40;
  }
  if (projection.family === 'COORDINATED_RAID') {
    weight += 18;
  }
  if (projection.visibility === 'SHADOW_ONLY') {
    weight += 8;
  }
  weight += Math.max((room.lowShieldPlayerCount ?? 0) - (room.activeHelperCount ?? 0), 0) * 6;
  return Math.round(weight * 100) / 100;
}

export function computeRoomProjectionWhisperWeight(
  room: GlobalEventSchedulerRoomContext,
  projection: GlobalEventProjection,
): number {
  let weight = 0;
  if (projection.family === 'WHISPER_WINDOW') {
    weight += 35;
  }
  if (projection.visibility === 'SHADOW_ONLY' || projection.visibility === 'HYBRID') {
    weight += 12;
  }
  if ((room.mode ?? '').includes('PHANTOM')) {
    weight += 14;
  }
  if ((room.mode ?? '').includes('SYNDICATE')) {
    weight += 10;
  }
  return Math.round(weight * 100) / 100;
}

export function computeRoomProjectionLikelyFactionPressure(
  room: GlobalEventSchedulerRoomContext,
  projection: GlobalEventProjection,
): number {
  const base = computeFamilyWeight(projection.family) * 15 + computeIntensityWeight(projection.intensity) * 11;
  const crowd = (room.crowdHeat ?? 0) * 3.5;
  const panic = (room.panicLevel ?? 0) * 4.5;
  const factionBalance =
    room.factionBalance != null
      ? Object.values(room.factionBalance).reduce((sum, value) => sum + Math.abs(value), 0)
      : 0;
  return Math.round((base + crowd + panic + factionBalance) * 100) / 100;
}

export function projectGlobalEventToRoom(
  room: GlobalEventSchedulerRoomContext,
  projection: GlobalEventProjection,
): GlobalEventRoomProjection {
  const applicable =
    projection.visibility !== 'VISIBLE' ||
    projection.channels.some((channelId) => inferPreferredChannelsForRoomProjection(room, projection).includes(channelId));

  const preferredChannels = inferPreferredChannelsForRoomProjection(room, projection);
  const derivedTags = uniqueStrings([
    ...projection.tags,
    ...(room.tags ?? []),
    `MODE:${room.mode ?? 'UNKNOWN'}`,
    `MOUNT:${room.mountTarget ?? 'UNKNOWN'}`,
    `VISIBILITY:${projection.visibility}`,
    `FAMILY:${projection.family}`,
  ]);
  const channelPriority = projectChannelPriorityToRoom(room, projection);
  const stageMood = inferPressureBandForRoom(room, projection);
  const relevanceScore = computeRoomProjectionRelevance(room, projection);
  const pressureWeight = computeRoomProjectionPressureWeight(room, projection);
  const rescueSuppressionWeight = computeRoomProjectionRescueSuppressionWeight(room, projection);
  const whisperWeight = computeRoomProjectionWhisperWeight(room, projection);
  const likelyFactionPressure = computeRoomProjectionLikelyFactionPressure(room, projection);

  const notes = uniqueStrings([
    applicable ? 'ROOM_APPLICABLE' : 'ROOM_LOW_APPLICABILITY',
    stageMood,
    projection.visibility,
    projection.family,
    ...(room.lowShieldPlayerCount ?? 0) > 0 ? ['LOW_SHIELD_ROOM'] : [],
    ...(room.activeHelperCount ?? 0) === 0 ? ['HELPER_THIN'] : [],
  ]);

  return freeze({
    roomId: room.roomId,
    eventId: projection.eventId,
    activationId: projection.activationId,
    displayName: projection.displayName,
    family: projection.family,
    visibility: projection.visibility,
    intensity: projection.intensity,
    applicable,
    relevanceScore,
    preferredChannels,
    channelPriority,
    derivedTags,
    stageMood,
    pressureWeight,
    rescueSuppressionWeight,
    whisperWeight,
    likelyFactionPressure,
    notes,
  });
}

export function projectGlobalEventsToRooms(
  rooms: readonly GlobalEventSchedulerRoomContext[],
  projections: readonly GlobalEventProjection[],
): readonly GlobalEventRoomProjection[] {
  const output: GlobalEventRoomProjection[] = [];
  for (const room of rooms) {
    for (const projection of projections) {
      output.push(projectGlobalEventToRoom(room, projection));
    }
  }
  return output.sort((left, right) => right.relevanceScore - left.relevanceScore);
}

export function buildRoomProjectionMatrix(
  rooms: readonly GlobalEventSchedulerRoomContext[],
  active: readonly GlobalEventProjection[],
  upcoming: readonly GlobalEventProjection[],
): readonly GlobalEventRoomProjectionMatrixRow[] {
  return rooms.map((room) => {
    const activeForRoom = active.map((projection) => projectGlobalEventToRoom(room, projection));
    const upcomingForRoom = upcoming.map((projection) => projectGlobalEventToRoom(room, projection));
    const projectedChannels = uniqueChannels([
      ...activeForRoom.flatMap((projection) => [...projection.preferredChannels]),
      ...upcomingForRoom.flatMap((projection) => [...projection.preferredChannels]),
    ]);
    const notes = uniqueStrings([
      ...(room.playerCount ?? 0) > 6 ? ['HIGH_POP_ROOM'] : [],
      ...(room.crowdHeat ?? 0) > 6 ? ['CROWD_HEATED'] : [],
      ...(room.panicLevel ?? 0) > 6 ? ['PANIC_ELEVATED'] : [],
      ...(projectedChannels.length === 0 ? ['NO_CHANNEL_EXPRESSION'] : []),
    ]);

    return freeze({
      roomId: room.roomId,
      mode: room.mode ?? null,
      mountTarget: room.mountTarget ?? null,
      activeEventIds: uniqueStrings(activeForRoom.map((projection) => projection.eventId)),
      upcomingEventIds: uniqueStrings(upcomingForRoom.map((projection) => projection.eventId)),
      projectedChannels,
      cumulativePressureWeight: Math.round(
        [...activeForRoom, ...upcomingForRoom].reduce(
          (sum, projection) => sum + projection.pressureWeight,
          0,
        ) * 100,
      ) / 100,
      crowdHeat: room.crowdHeat ?? 0,
      panicLevel: room.panicLevel ?? 0,
      notes,
    });
  });
}

export function buildProjectionGroups(
  projections: readonly GlobalEventProjection[],
): readonly GlobalEventProjectionGroup[] {
  const byEventId = new Map<string, GlobalEventProjection[]>();
  for (const projection of projections) {
    const list = byEventId.get(projection.eventId) ?? [];
    list.push(projection);
    byEventId.set(projection.eventId, list);
  }

  const groups: GlobalEventProjectionGroup[] = [];
  for (const [eventId, list] of byEventId.entries()) {
    const first = list[0];
    groups.push(
      freeze({
        eventId,
        displayName: first.displayName,
        family: first.family,
        visibility: first.visibility,
        intensity: first.intensity,
        projectionCount: list.length,
        earliestStartsAt: Math.min(...list.map((item) => item.startsAt)),
        latestEndsAt: Math.max(...list.map((item) => item.endsAt)),
        totalRemainingMs: list.reduce((sum, item) => sum + item.timeRemainingMs, 0),
        channels: uniqueChannels(list.flatMap((item) => [...item.channels])),
        tags: uniqueStrings(list.flatMap((item) => [...item.tags])),
        notes: uniqueStrings(list.flatMap((item) => [...item.notes])),
      }),
    );
  }

  return groups.sort((left, right) => right.totalRemainingMs - left.totalRemainingMs);
}

export function buildActivationDigests(
  state: GlobalEventSchedulerState,
): readonly GlobalEventActivationDigest[] {
  const byEventId = new Map<string, GlobalEventDefinition>();
  for (const definition of state.definitions) {
    byEventId.set(definition.eventId, definition);
  }

  const digests: GlobalEventActivationDigest[] = [];
  for (const activation of state.activations) {
    const definition = byEventId.get(activation.eventId);
    if (!definition) {
      continue;
    }

    digests.push(
      freeze({
        activationId: activation.activationId,
        eventId: definition.eventId,
        family: definition.family,
        displayName: definition.displayName,
        source: activation.source,
        forced: activation.forced,
        startsAt: activation.startsAt,
        endsAt: activation.endsAt,
        durationMs: activation.endsAt - activation.startsAt,
        channels: freeze([...definition.channels]),
        tags: freeze([...definition.tags]),
        roomScopedRoomIds: freeze([...(activation.roomScopedRoomIds ?? [])]),
        notes: freeze([...activation.notes]),
      }),
    );
  }

  return digests.sort((left, right) => left.startsAt - right.startsAt);
}

export function computeChannelLoads(
  active: readonly GlobalEventProjection[],
  upcoming: readonly GlobalEventProjection[],
): readonly GlobalEventChannelLoad[] {
  return ALL_VISIBLE_CHANNELS.map((channelId) => {
    const activeForChannel = active.filter((projection) => projection.channels.includes(channelId));
    const upcomingForChannel = upcoming.filter((projection) => projection.channels.includes(channelId));
    const combinedPriority = [...activeForChannel, ...upcomingForChannel].reduce(
      (sum, projection) => sum + (projection.channelPriority[channelId] ?? 0),
      0,
    );
    const total = activeForChannel.length + upcomingForChannel.length;
    const averagePriority = total > 0 ? combinedPriority / total : 0;
    const dominantFamilies = uniqueStrings(
      [...activeForChannel, ...upcomingForChannel]
        .map((projection) => projection.family)
        .sort(),
    ) as GlobalEventFamily[];
    const dominantEventIds = uniqueStrings(
      [...activeForChannel, ...upcomingForChannel].map((projection) => projection.eventId),
    );
    const pressureWeight = [...activeForChannel, ...upcomingForChannel].reduce(
      (sum, projection) =>
        sum +
        computeIntensityWeight(projection.intensity) * 10 +
        computeVisibilityWeight(projection.visibility) * 5 +
        (projection.channelPriority[channelId] ?? 0) / 5,
      0,
    );

    const heatBand: GlobalEventHealthBand =
      pressureWeight >= 300 ? 'CRITICAL' : pressureWeight >= 180 ? 'HIGH' : pressureWeight >= 80 ? 'MEDIUM' : 'LOW';

    return freeze({
      channelId,
      activeCount: activeForChannel.length,
      upcomingCount: upcomingForChannel.length,
      combinedPriority,
      averagePriority: Math.round(averagePriority * 100) / 100,
      dominantFamilies,
      dominantEventIds,
      pressureWeight: Math.round(pressureWeight * 100) / 100,
      heatBand,
    });
  });
}

export function computeFamilyLoads(
  active: readonly GlobalEventProjection[],
  upcoming: readonly GlobalEventProjection[],
): readonly GlobalEventFamilyLoad[] {
  const families: readonly GlobalEventFamily[] = [
    'SEASON',
    'WORLD_EVENT',
    'HELPER_BLACKOUT',
    'CHANNEL_MUTATOR',
    'WHISPER_WINDOW',
    'FACTION_SURGE',
    'COORDINATED_RAID',
    'RIVAL_SPOTLIGHT',
  ] as const;

  return families
    .map((family) => {
      const activeForFamily = active.filter((projection) => projection.family === family);
      const upcomingForFamily = upcoming.filter((projection) => projection.family === family);
      const all = [...activeForFamily, ...upcomingForFamily];
      const pressureWeight = all.reduce(
        (sum, projection) =>
          sum +
          computeIntensityWeight(projection.intensity) * 14 +
          computeVisibilityWeight(projection.visibility) * 6,
        0,
      );
      return freeze({
        family,
        activeCount: activeForFamily.length,
        upcomingCount: upcomingForFamily.length,
        activeEventIds: uniqueStrings(activeForFamily.map((projection) => projection.eventId)),
        visibilityMix: buildVisibilityMix(all),
        pressureWeight: Math.round(pressureWeight * 100) / 100,
      });
    })
    .filter((entry) => entry.activeCount > 0 || entry.upcomingCount > 0);
}

export function buildTimelineSlices(
  projections: readonly GlobalEventProjection[],
): readonly GlobalEventTimelineSlice[] {
  const markers = uniqueStrings(
    projections.flatMap((projection) => [
      String(projection.startsAt),
      String(projection.endsAt),
    ]),
  )
    .map((value) => Number(value))
    .sort((left, right) => left - right);

  const slices: GlobalEventTimelineSlice[] = [];
  for (let index = 0; index < markers.length - 1; index += 1) {
    const startsAt = markers[index];
    const endsAt = markers[index + 1];
    const overlapping = projections.filter(
      (projection) => projection.startsAt < endsAt && projection.endsAt > startsAt,
    );
    if (overlapping.length === 0) {
      continue;
    }

    slices.push(
      freeze({
        startsAt,
        endsAt,
        eventIds: uniqueStrings(overlapping.map((projection) => projection.eventId)),
        families: uniqueStrings(overlapping.map((projection) => projection.family)) as GlobalEventFamily[],
        channels: uniqueChannels(overlapping.flatMap((projection) => [...projection.channels])),
        visibilityMix: buildVisibilityMix(overlapping),
        notes: uniqueStrings(overlapping.flatMap((projection) => [...projection.notes])),
      }),
    );
  }

  return slices;
}

export function computeSchedulerHealthBand(
  active: readonly GlobalEventProjection[],
  upcoming: readonly GlobalEventProjection[],
  channelLoads: readonly GlobalEventChannelLoad[],
): GlobalEventHealthBand {
  const activePressure = active.reduce(
    (sum, projection) => sum + computeIntensityWeight(projection.intensity) * 10 + computeVisibilityWeight(projection.visibility) * 5,
    0,
  );
  const upcomingPressure = upcoming.reduce(
    (sum, projection) => sum + computeIntensityWeight(projection.intensity) * 6 + computeVisibilityWeight(projection.visibility) * 3,
    0,
  );
  const channelPressure = channelLoads.reduce((sum, load) => sum + load.pressureWeight, 0);
  const total = activePressure + upcomingPressure + channelPressure;

  if (total >= 900) {
    return 'CRITICAL';
  }
  if (total >= 500) {
    return 'HIGH';
  }
  if (total >= 220) {
    return 'MEDIUM';
  }
  return 'LOW';
}

export function auditGlobalEventDefinition(
  definition: GlobalEventDefinition,
): GlobalEventDefinitionAudit {
  const issues: string[] = [];
  const strengths: string[] = [];

  if (definition.summaryLines.length === 0) {
    issues.push('MISSING_SUMMARY_LINES');
  } else {
    strengths.push('SUMMARY_PRESENT');
  }

  if (definition.channels.length === 0) {
    issues.push('NO_CHANNELS');
  } else {
    strengths.push('CHANNELS_DECLARED');
  }

  if (definition.rules.length === 0) {
    issues.push('NO_OVERLAY_RULES');
  } else {
    strengths.push('OVERLAY_RULES_DECLARED');
  }

  if (definition.windows.length === 0 && definition.scheduleKind !== 'MANUAL') {
    issues.push('NO_WINDOWS_FOR_NON_MANUAL_EVENT');
  } else if (definition.windows.length > 0) {
    strengths.push('WINDOWS_DECLARED');
  }

  if (definition.priorityWeight <= 0) {
    issues.push('NON_POSITIVE_PRIORITY_WEIGHT');
  } else {
    strengths.push('PRIORITY_WEIGHT_VALID');
  }

  if (definition.maxConcurrentGlobalInstances < 1) {
    issues.push('INVALID_MAX_CONCURRENCY');
  } else {
    strengths.push('CONCURRENCY_VALID');
  }

  if (definition.visibility === 'SHADOW_ONLY') {
    strengths.push('SHADOW_SUPPORT_PRESENT');
  }
  if (definition.visibility === 'HYBRID') {
    strengths.push('HYBRID_SUPPORT_PRESENT');
  }

  const readinessScore = Math.max(0, Math.min(100, 100 - issues.length * 12 + strengths.length * 4));

  return freeze({
    eventId: definition.eventId,
    displayName: definition.displayName,
    family: definition.family,
    definitionVersion: definition.definitionVersion,
    scheduleKind: definition.scheduleKind,
    visibility: definition.visibility,
    intensity: definition.intensity,
    channels: [...definition.channels],
    tags: [...definition.tags],
    windows: definition.windows.length,
    rules: definition.rules.length,
    requiredTags: [...(definition.requiredTags ?? [])],
    excludedTags: [...(definition.excludedTags ?? [])],
    scopeModeIds: [...(definition.scopeModeIds ?? [])],
    issues,
    strengths,
    readinessScore,
  });
}

export function auditGlobalEventLibrary(
  definitions: readonly GlobalEventDefinition[],
): readonly GlobalEventDefinitionAudit[] {
  return definitions
    .map((definition) => auditGlobalEventDefinition(definition))
    .sort((left, right) => right.readinessScore - left.readinessScore);
}

export function buildGlobalEventSchedulerManifest(
  state: GlobalEventSchedulerState,
  generatedAt: number = systemNow(),
): GlobalEventSchedulerManifest {
  const eventCountByFamily = freeze({
    SEASON: state.definitions.filter((definition) => definition.family === 'SEASON').length,
    WORLD_EVENT: state.definitions.filter((definition) => definition.family === 'WORLD_EVENT').length,
    HELPER_BLACKOUT: state.definitions.filter((definition) => definition.family === 'HELPER_BLACKOUT').length,
    CHANNEL_MUTATOR: state.definitions.filter((definition) => definition.family === 'CHANNEL_MUTATOR').length,
    WHISPER_WINDOW: state.definitions.filter((definition) => definition.family === 'WHISPER_WINDOW').length,
    FACTION_SURGE: state.definitions.filter((definition) => definition.family === 'FACTION_SURGE').length,
    COORDINATED_RAID: state.definitions.filter((definition) => definition.family === 'COORDINATED_RAID').length,
    RIVAL_SPOTLIGHT: state.definitions.filter((definition) => definition.family === 'RIVAL_SPOTLIGHT').length,
  });

  return freeze({
    generatedAt,
    version: state.version,
    definitionIds: state.definitions.map((definition) => definition.eventId),
    activationIds: state.activations.map((activation) => activation.activationId),
    cancelledActivationIds: [...state.cancelledActivationIds],
    families: uniqueStrings(state.definitions.map((definition) => definition.family)) as GlobalEventFamily[],
    channelIds: uniqueChannels(
      state.definitions.flatMap((definition) => [...definition.channels]),
    ),
    eventCountByFamily,
    definitionAudits: auditGlobalEventLibrary(state.definitions),
  });
}

export function diffGlobalEventLibraries(
  previousDefinitions: readonly GlobalEventDefinition[],
  nextDefinitions: readonly GlobalEventDefinition[],
): GlobalEventLibraryDiff {
  const previousMap = new Map(previousDefinitions.map((definition) => [definition.eventId, definition]));
  const nextMap = new Map(nextDefinitions.map((definition) => [definition.eventId, definition]));

  const added: string[] = [];
  const removed: string[] = [];
  const changed: GlobalEventLibraryDiffEntry[] = [];
  const unchanged: string[] = [];

  for (const [eventId, nextDefinition] of nextMap.entries()) {
    const previousDefinition = previousMap.get(eventId);
    if (!previousDefinition) {
      added.push(eventId);
      changed.push(
        freeze({
          eventId,
          status: 'ADDED',
          previousVersion: null,
          nextVersion: nextDefinition.definitionVersion,
          changedFields: ['ALL'],
        }),
      );
      continue;
    }

    const changedFields: string[] = [];
    const pairs: readonly [string, unknown, unknown][] = [
      ['displayName', previousDefinition.displayName, nextDefinition.displayName],
      ['headline', previousDefinition.headline, nextDefinition.headline],
      ['summaryLines', JSON.stringify(previousDefinition.summaryLines), JSON.stringify(nextDefinition.summaryLines)],
      ['visibility', previousDefinition.visibility, nextDefinition.visibility],
      ['intensity', previousDefinition.intensity, nextDefinition.intensity],
      ['tags', JSON.stringify(previousDefinition.tags), JSON.stringify(nextDefinition.tags)],
      ['channels', JSON.stringify(previousDefinition.channels), JSON.stringify(nextDefinition.channels)],
      ['rules', JSON.stringify(previousDefinition.rules), JSON.stringify(nextDefinition.rules)],
      ['windows', JSON.stringify(previousDefinition.windows), JSON.stringify(nextDefinition.windows)],
      ['priorityWeight', previousDefinition.priorityWeight, nextDefinition.priorityWeight],
      ['cooldownMs', previousDefinition.cooldownMs, nextDefinition.cooldownMs],
      ['scopeModeIds', JSON.stringify(previousDefinition.scopeModeIds ?? []), JSON.stringify(nextDefinition.scopeModeIds ?? [])],
    ];

    for (const [field, left, right] of pairs) {
      if (left !== right) {
        changedFields.push(field);
      }
    }

    if (changedFields.length > 0) {
      changed.push(
        freeze({
          eventId,
          status: 'CHANGED',
          previousVersion: previousDefinition.definitionVersion,
          nextVersion: nextDefinition.definitionVersion,
          changedFields,
        }),
      );
    } else {
      unchanged.push(eventId);
    }
  }

  for (const eventId of previousMap.keys()) {
    if (!nextMap.has(eventId)) {
      removed.push(eventId);
      changed.push(
        freeze({
          eventId,
          status: 'REMOVED',
          previousVersion: previousMap.get(eventId)?.definitionVersion ?? null,
          nextVersion: null,
          changedFields: ['ALL'],
        }),
      );
    }
  }

  return freeze({
    added,
    removed,
    changed,
    unchanged,
  });
}

export function createGlobalEventDefinition(
  input: GlobalEventDefinitionBuilderInput,
): GlobalEventDefinition {
  return freeze({
    eventId: input.eventId,
    family: input.family,
    displayName: input.displayName,
    headline: input.headline,
    summaryLines: freeze([...input.summaryLines]),
    scheduleKind: input.scheduleKind,
    visibility: input.visibility,
    intensity: input.intensity,
    tags: freeze(uniqueStrings([...(input.tags ?? [])])),
    channels: freeze(uniqueChannels([...(input.channels ?? ALL_VISIBLE_CHANNELS)])),
    channelPriority: clampChannelPriority(input.channelPriority, input.priorityWeight ?? 50),
    rules: freeze(
      (input.rules ?? []).map((rule) =>
        freeze({
          ...rule,
          appliesToBots: rule.appliesToBots ? freeze([...rule.appliesToBots]) : undefined,
          appliesToChannels: rule.appliesToChannels ? freeze([...rule.appliesToChannels]) : undefined,
          requiredTags: rule.requiredTags ? freeze([...rule.requiredTags]) : undefined,
          addedPlanningTags: freeze(uniqueStrings([...rule.addedPlanningTags])),
          transformBiases: freeze(uniqueStrings([...rule.transformBiases])),
        }),
      ),
    ),
    cooldownMs: input.cooldownMs ?? ONE_HOUR_MS,
    maxConcurrentGlobalInstances: input.maxConcurrentGlobalInstances ?? 1,
    maxInstancesPerRoom: input.maxInstancesPerRoom,
    repeatGranularity: input.repeatGranularity ?? 'NONE',
    priorityWeight: input.priorityWeight ?? 50,
    definitionVersion: input.definitionVersion ?? DEFAULT_DEFINITION_VERSION,
    seasonId: input.seasonId ?? null,
    scopeModeIds: input.scopeModeIds ? freeze([...input.scopeModeIds]) : undefined,
    requiredTags: input.requiredTags ? freeze([...input.requiredTags]) : undefined,
    excludedTags: input.excludedTags ? freeze([...input.excludedTags]) : undefined,
    windows: freeze(
      (input.windows ?? []).map((window) =>
        freeze({
          startsAt: window.startsAt,
          endsAt: window.endsAt,
          recurringDailyUtc: window.recurringDailyUtc ? freeze({ ...window.recurringDailyUtc }) : undefined,
          recurringInterval: window.recurringInterval ? freeze({ ...window.recurringInterval }) : undefined,
          matchState: window.matchState
            ? freeze({
                ...window.matchState,
                requiredTags: window.matchState.requiredTags ? freeze([...window.matchState.requiredTags]) : undefined,
                requiredModeIds: window.matchState.requiredModeIds ? freeze([...window.matchState.requiredModeIds]) : undefined,
              })
            : undefined,
        }),
      ),
    ),
    meta: input.meta ? freeze({ ...input.meta }) : undefined,
  });
}

export function patchGlobalEventDefinition(
  definition: GlobalEventDefinition,
  patch: GlobalEventDefinitionPatch,
): GlobalEventDefinition {
  return createGlobalEventDefinition({
    eventId: definition.eventId,
    family: definition.family,
    displayName: patch.displayName ?? definition.displayName,
    headline: patch.headline ?? definition.headline,
    summaryLines: patch.summaryLines ?? definition.summaryLines,
    scheduleKind: patch.scheduleKind ?? definition.scheduleKind,
    visibility: patch.visibility ?? definition.visibility,
    intensity: patch.intensity ?? definition.intensity,
    tags: patch.tags ?? definition.tags,
    channels: patch.channels ?? definition.channels,
    channelPriority: patch.channelPriority ?? definition.channelPriority,
    rules: patch.rules ?? definition.rules,
    cooldownMs: patch.cooldownMs ?? definition.cooldownMs,
    maxConcurrentGlobalInstances: patch.maxConcurrentGlobalInstances ?? definition.maxConcurrentGlobalInstances,
    maxInstancesPerRoom: patch.maxInstancesPerRoom ?? definition.maxInstancesPerRoom,
    repeatGranularity: patch.repeatGranularity ?? definition.repeatGranularity,
    priorityWeight: patch.priorityWeight ?? definition.priorityWeight,
    definitionVersion: patch.definitionVersion ?? definition.definitionVersion,
    seasonId: patch.seasonId ?? definition.seasonId,
    scopeModeIds: patch.scopeModeIds ?? definition.scopeModeIds,
    requiredTags: patch.requiredTags ?? definition.requiredTags,
    excludedTags: patch.excludedTags ?? definition.excludedTags,
    windows: patch.windows ?? definition.windows,
    meta: patch.meta ?? definition.meta,
  });
}

export function createFixedWindowDefinition(
  input: Omit<GlobalEventDefinitionBuilderInput, 'windows'> & {
    readonly startsAt: number;
    readonly endsAt: number;
  },
): GlobalEventDefinition {
  return createGlobalEventDefinition({
    ...input,
    windows: [
      {
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      },
    ],
  });
}

export function createRecurringIntervalDefinition(
  input: Omit<GlobalEventDefinitionBuilderInput, 'windows'> & {
    readonly recurringInterval: GlobalEventRecurringIntervalRule;
  },
): GlobalEventDefinition {
  return createGlobalEventDefinition({
    ...input,
    windows: [
      {
        recurringInterval: input.recurringInterval,
      },
    ],
  });
}

export function createRecurringDailyDefinition(
  input: Omit<GlobalEventDefinitionBuilderInput, 'windows'> & {
    readonly recurringDailyUtc: GlobalEventRecurringDailyUtcRule;
  },
): GlobalEventDefinition {
  return createGlobalEventDefinition({
    ...input,
    windows: [
      {
        recurringDailyUtc: input.recurringDailyUtc,
      },
    ],
  });
}

export function createMatchStateTriggeredDefinition(
  input: Omit<GlobalEventDefinitionBuilderInput, 'windows'> & {
    readonly matchState: GlobalEventMatchStateRule;
  },
): GlobalEventDefinition {
  return createGlobalEventDefinition({
    ...input,
    windows: [
      {
        matchState: input.matchState,
      },
    ],
  });
}

export function previewDefinitionWindows(
  definition: GlobalEventDefinition,
  input: PreviewWindowsInput = {},
): readonly GlobalEventWindowPreview[] {
  const now = input.now ?? systemNow();
  const horizonMs = input.horizonMs ?? DEFAULT_UPCOMING_HORIZON_MS;
  const horizonEnd = now + horizonMs;
  const previews: GlobalEventWindowPreview[] = [];

  if (!matchesTags(input.globalTags ?? [], definition.requiredTags, definition.excludedTags)) {
    return previews;
  }

  for (const window of definition.windows) {
    if (window.startsAt != null && window.endsAt != null) {
      previews.push(
        freeze({
          eventId: definition.eventId,
          displayName: definition.displayName,
          family: definition.family,
          visibility: definition.visibility,
          source: 'FIXED_WINDOW',
          startsAt: window.startsAt,
          endsAt: window.endsAt,
          durationMs: window.endsAt - window.startsAt,
          notes: freeze(['FIXED_WINDOW']),
        }),
      );
    }

    if (window.recurringDailyUtc) {
      for (const start of nextDailyWindowStarts(now, horizonEnd, window.recurringDailyUtc)) {
        previews.push(
          freeze({
            eventId: definition.eventId,
            displayName: definition.displayName,
            family: definition.family,
            visibility: definition.visibility,
            source: 'RECURRING_DAILY_UTC',
            startsAt: start,
            endsAt: start + window.recurringDailyUtc.durationMs,
            durationMs: window.recurringDailyUtc.durationMs,
            notes: freeze(['RECURRING_DAILY_UTC']),
          }),
        );
      }
    }

    if (window.recurringInterval) {
      for (const start of nextIntervalWindowStarts(now, horizonEnd, window.recurringInterval)) {
        previews.push(
          freeze({
            eventId: definition.eventId,
            displayName: definition.displayName,
            family: definition.family,
            visibility: definition.visibility,
            source: 'RECURRING_INTERVAL',
            startsAt: start,
            endsAt: start + window.recurringInterval.durationMs,
            durationMs: window.recurringInterval.durationMs,
            notes: freeze(['RECURRING_INTERVAL']),
          }),
        );
      }
    }

    if (window.matchState && input.rooms && input.rooms.length > 0) {
      for (const room of input.rooms) {
        const requiredModeIds = window.matchState.requiredModeIds ?? [];
        const requiredTags = window.matchState.requiredTags ?? [];
        const roomTags = room.tags ?? [];
        if (requiredModeIds.length > 0 && !requiredModeIds.includes(room.mode ?? '')) {
          continue;
        }
        if (!matchesTags(roomTags, requiredTags)) {
          continue;
        }
        if (
          window.matchState.minLowShieldPlayers != null &&
          (room.lowShieldPlayerCount ?? 0) < window.matchState.minLowShieldPlayers
        ) {
          continue;
        }
        if (
          window.matchState.minPanicLevel != null &&
          (room.panicLevel ?? 0) < window.matchState.minPanicLevel
        ) {
          continue;
        }

        previews.push(
          freeze({
            eventId: definition.eventId,
            displayName: definition.displayName,
            family: definition.family,
            visibility: definition.visibility,
            source: 'MATCH_STATE_TRIGGER',
            startsAt: now,
            endsAt: now + window.matchState.durationMs,
            durationMs: window.matchState.durationMs,
            projectedForRoomIds: freeze([room.roomId]),
            notes: freeze(['MATCH_STATE_TRIGGER', `ROOM:${room.roomId}`, `TRIGGER:${window.matchState.triggerId}`]),
          }),
        );
      }
    }
  }

  return previews.sort((left, right) => left.startsAt - right.startsAt);
}

export function previewLibraryWindows(
  definitions: readonly GlobalEventDefinition[],
  input: PreviewWindowsInput = {},
): readonly GlobalEventWindowPreview[] {
  return definitions
    .flatMap((definition) => [...previewDefinitionWindows(definition, input)])
    .sort((left, right) => left.startsAt - right.startsAt);
}

export class GlobalEventSchedulerInspector {
  private readonly scheduler: GlobalEventScheduler;

  public constructor(scheduler: GlobalEventScheduler) {
    this.scheduler = scheduler;
  }

  public snapshot(context: GlobalEventSchedulerEvaluationContext = {}): GlobalEventSchedulerSnapshot {
    return this.scheduler.evaluate(context);
  }

  public snapshotDetailed(
    context: GlobalEventSchedulerEvaluationContext = {},
  ): GlobalEventSchedulerDetailedSnapshot {
    const snapshot = this.scheduler.evaluate(context);
    const state = this.scheduler.serialize();
    const roomProjections = projectGlobalEventsToRooms(
      context.rooms ?? [],
      [...snapshot.activeProjections, ...snapshot.upcomingProjections],
    );
    const roomMatrix = buildRoomProjectionMatrix(
      context.rooms ?? [],
      snapshot.activeProjections,
      snapshot.upcomingProjections,
    );
    const channelLoads = computeChannelLoads(snapshot.activeProjections, snapshot.upcomingProjections);
    const familyLoads = computeFamilyLoads(snapshot.activeProjections, snapshot.upcomingProjections);
    const groups = buildProjectionGroups([
      ...snapshot.activeProjections,
      ...snapshot.upcomingProjections,
    ]);
    const audits = auditGlobalEventLibrary(state.definitions);
    const timeline = buildTimelineSlices([
      ...snapshot.activeProjections,
      ...snapshot.upcomingProjections,
    ]);
    const activationDigests = buildActivationDigests(state);
    const healthBand = computeSchedulerHealthBand(
      snapshot.activeProjections,
      snapshot.upcomingProjections,
      channelLoads,
    );
    const totalProjectedPressure = Math.round(
      roomProjections.reduce((sum, projection) => sum + projection.pressureWeight, 0) * 100,
    ) / 100;

    return freeze({
      ...snapshot,
      roomProjections,
      roomMatrix,
      timeline,
      audits,
      detailedDiagnostics: freeze({
        activationDigests,
        channelLoads,
        familyLoads,
        groups,
        healthBand,
        totalProjectedPressure,
        cancelledActivationCount: state.cancelledActivationIds.length,
      }),
    });
  }

  public previewDefinitionWindows(
    eventId: string,
    input: PreviewWindowsInput = {},
  ): readonly GlobalEventWindowPreview[] {
    const definition = this.scheduler.getDefinition(eventId);
    if (!definition) {
      return [];
    }
    return previewDefinitionWindows(definition, input);
  }

  public previewLibraryWindows(
    input: PreviewWindowsInput = {},
  ): readonly GlobalEventWindowPreview[] {
    return previewLibraryWindows(this.scheduler.listDefinitions(), input);
  }

  public auditDefinition(eventId: string): GlobalEventDefinitionAudit | null {
    const definition = this.scheduler.getDefinition(eventId);
    return definition ? auditGlobalEventDefinition(definition) : null;
  }

  public auditLibrary(): readonly GlobalEventDefinitionAudit[] {
    return auditGlobalEventLibrary(this.scheduler.listDefinitions());
  }

  public buildManifest(): GlobalEventSchedulerManifest {
    return buildGlobalEventSchedulerManifest(this.scheduler.serialize(), systemNow());
  }

  public diffManifest(
    manifest: GlobalEventSchedulerManifest,
  ): GlobalEventLibraryDiff {
    const current = this.scheduler.serialize();
    const manifestDefinitions = current.definitions.filter((definition) =>
      manifest.definitionIds.includes(definition.eventId),
    );
    return diffGlobalEventLibraries(manifestDefinitions, current.definitions);
  }

  public listChannelLoads(
    context: GlobalEventSchedulerEvaluationContext = {},
  ): readonly GlobalEventChannelLoad[] {
    const snapshot = this.scheduler.evaluate(context);
    return computeChannelLoads(snapshot.activeProjections, snapshot.upcomingProjections);
  }

  public listFamilyLoads(
    context: GlobalEventSchedulerEvaluationContext = {},
  ): readonly GlobalEventFamilyLoad[] {
    const snapshot = this.scheduler.evaluate(context);
    return computeFamilyLoads(snapshot.activeProjections, snapshot.upcomingProjections);
  }

  public buildTimeline(
    context: GlobalEventSchedulerEvaluationContext = {},
  ): readonly GlobalEventTimelineSlice[] {
    const snapshot = this.scheduler.evaluate(context);
    return buildTimelineSlices([...snapshot.activeProjections, ...snapshot.upcomingProjections]);
  }

  public buildRoomMatrix(
    context: GlobalEventSchedulerEvaluationContext = {},
  ): readonly GlobalEventRoomProjectionMatrixRow[] {
    const snapshot = this.scheduler.evaluate(context);
    return buildRoomProjectionMatrix(
      context.rooms ?? [],
      snapshot.activeProjections,
      snapshot.upcomingProjections,
    );
  }

  public listActivationDigests(): readonly GlobalEventActivationDigest[] {
    return buildActivationDigests(this.scheduler.serialize());
  }

  public cloneScheduler(): GlobalEventScheduler {
    const clone = createGlobalEventScheduler({
      definitionVersion: this.scheduler.serialize().version,
      seedDefinitions: this.scheduler.serialize().definitions,
    });
    clone.hydrate(this.scheduler.serialize());
    return clone;
  }
}

export function createGlobalEventSchedulerInspector(
  scheduler: GlobalEventScheduler,
): GlobalEventSchedulerInspector {
  return new GlobalEventSchedulerInspector(scheduler);
}

export function evaluateGlobalEventSchedulerDetailed(
  scheduler: GlobalEventScheduler,
  context: GlobalEventSchedulerEvaluationContext = {},
): GlobalEventSchedulerDetailedSnapshot {
  return createGlobalEventSchedulerInspector(scheduler).snapshotDetailed(context);
}

export function describeGlobalEventSchedulerState(
  state: GlobalEventSchedulerState,
): {
  readonly version: string;
  readonly definitions: number;
  readonly activations: number;
  readonly cancelledActivations: number;
  readonly activeFamilies: readonly GlobalEventFamily[];
  readonly channels: readonly ChatLiveOpsChannelId[];
} {
  const activeFamilies = uniqueStrings(
    state.definitions.map((definition) => definition.family),
  ) as GlobalEventFamily[];
  const channels = uniqueChannels(state.definitions.flatMap((definition) => [...definition.channels]));
  return freeze({
    version: state.version,
    definitions: state.definitions.length,
    activations: state.activations.length,
    cancelledActivations: state.cancelledActivationIds.length,
    activeFamilies,
    channels,
  });
}

export function summarizeGlobalEventProjection(
  projection: GlobalEventProjection,
): string {
  return `${projection.displayName} [${projection.family}] ${projection.visibility} ${projection.intensity} :: ${projection.startsAt}-${projection.endsAt}`;
}

export function summarizeGlobalEventRoomProjection(
  projection: GlobalEventRoomProjection,
): string {
  return `${projection.roomId} :: ${projection.displayName} :: ${projection.stageMood} :: score=${projection.relevanceScore}`;
}

export function summarizeGlobalEventWindowPreview(
  preview: GlobalEventWindowPreview,
): string {
  return `${preview.eventId}::${preview.source}::${preview.startsAt}->${preview.endsAt}`;
}

export function summarizeGlobalEventChannelLoad(
  load: GlobalEventChannelLoad,
): string {
  return `${load.channelId} active=${load.activeCount} upcoming=${load.upcomingCount} heat=${load.heatBand}`;
}

export function summarizeGlobalEventFamilyLoad(
  load: GlobalEventFamilyLoad,
): string {
  return `${load.family} active=${load.activeCount} upcoming=${load.upcomingCount} pressure=${load.pressureWeight}`;
}

export function summarizeGlobalEventDefinitionAudit(
  audit: GlobalEventDefinitionAudit,
): string {
  return `${audit.eventId} readiness=${audit.readinessScore} issues=${audit.issues.length} strengths=${audit.strengths.length}`;
}

export function summarizeGlobalEventSchedulerDetailedSnapshot(
  snapshot: GlobalEventSchedulerDetailedSnapshot,
): readonly string[] {
  return freeze([
    `active=${snapshot.activeProjections.length}`,
    `upcoming=${snapshot.upcomingProjections.length}`,
    `rooms=${snapshot.roomMatrix.length}`,
    `health=${snapshot.detailedDiagnostics.healthBand}`,
    `pressure=${snapshot.detailedDiagnostics.totalProjectedPressure}`,
  ]);
}
