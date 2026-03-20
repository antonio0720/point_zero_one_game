/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT LIVEOPS SCHEDULER AUTHORITY
 * FILE: backend/src/game/engine/chat/liveops/GlobalEventScheduler.ts
 * VERSION: 2026.03.19-liveops-world-events
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
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
