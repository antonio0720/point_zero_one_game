/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT LIVEOPS WORLD EVENT DIRECTOR
 * FILE: backend/src/game/engine/chat/liveops/WorldEventDirector.ts
 * VERSION: 2026.03.19-liveops-world-events
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative orchestration layer that consumes the global event schedule,
 * resolves faction surges, and emits room-local liveops directives for both
 * visible and hidden chat channels.
 *
 * This file is not a transport emitter and not a UI banner controller.
 * It sits in the backend engine lane and answers a more important question:
 *
 *   "Given the active world state, what should chat now feel like for this
 *    room, on which channels, with which witness pressure, silence posture,
 *    helper availability, shadow queue load, and announcement cadence?"
 *
 * Repo-faithful design law
 * ------------------------
 * - The scheduler owns time windows.
 * - The faction surge planner owns pressure blocs.
 * - This director owns room projection and emission planning.
 * - Actual message synthesis remains downstream in message factories,
 *   scene planners, NPC orchestration, or transport fanout.
 *
 * Why this file exists
 * --------------------
 * Without a director, liveops becomes a bag of timers. With a director,
 * liveops becomes authored atmospheric law that can:
 * - stage headlines,
 * - thicken shadow pressure,
 * - mute helpers,
 * - boost raids,
 * - tighten interruptions,
 * - create witness swells,
 * - project different intensity by room and mode,
 * - and remain replay-safe.
 */

import type {
  ChatLiveOpsChannelId,
  ChatLiveOpsOverlayDefinition,
  ChatLiveOpsOverlaySnapshot,
} from '../../../../../../shared/contracts/chat/liveops';

import {
  FactionSurgePlanner,
  type FactionSurgePlan,
} from './FactionSurgePlanner';
import {
  GlobalEventScheduler,
  type GlobalEventProjection,
  type GlobalEventSchedulerEvaluationContext,
  type GlobalEventSchedulerRoomContext,
  type GlobalEventSchedulerSnapshot,
} from './GlobalEventScheduler';

export type WorldEventAnnouncementStyle =
  | 'SYSTEM_NOTICE'
  | 'BREAKING_WORLD_EVENT'
  | 'WHISPER_LOCK'
  | 'PANIC_BANNER'
  | 'RAID_WARNING'
  | 'SEASONAL_HEADER';

export interface WorldEventDirectorOptions {
  readonly scheduler?: GlobalEventScheduler;
  readonly factionPlanner?: FactionSurgePlanner;
  readonly upcomingHorizonMs?: number;
  readonly emissionCooldownMs?: number;
}

export interface WorldEventAnnouncementDirective {
  readonly directiveId: string;
  readonly roomId: string;
  readonly activationId: string;
  readonly eventId: string;
  readonly headline: string;
  readonly summaryLines: readonly string[];
  readonly channels: readonly ChatLiveOpsChannelId[];
  readonly style: WorldEventAnnouncementStyle;
  readonly priority: number;
  readonly tags: readonly string[];
  readonly startsAt: number;
  readonly endsAt: number;
}

export interface WorldEventShadowDirective {
  readonly directiveId: string;
  readonly roomId: string;
  readonly activationId: string;
  readonly shadowChannelId: 'LIVEOPS_SHADOW' | 'SYSTEM_SHADOW' | 'NPC_SHADOW' | 'RIVALRY_SHADOW' | 'RESCUE_SHADOW';
  readonly queuePriority: number;
  readonly pressureDelta: number;
  readonly helperAvailabilityDelta: number;
  readonly interruptionDelta: number;
  readonly witnessDelta: number;
  readonly tags: readonly string[];
  readonly notes: readonly string[];
}

export interface WorldEventOverlayDirective {
  readonly roomId: string;
  readonly overlays: readonly ChatLiveOpsOverlayDefinition[];
  readonly primaryOverlayId?: string | null;
}

export interface WorldEventRoomPlan {
  readonly roomId: string;
  readonly schedulerProjectionIds: readonly string[];
  readonly activeEvents: readonly GlobalEventProjection[];
  readonly factionSurge: FactionSurgePlan;
  readonly overlay: WorldEventOverlayDirective;
  readonly visibleAnnouncements: readonly WorldEventAnnouncementDirective[];
  readonly shadowDirectives: readonly WorldEventShadowDirective[];
  readonly notes: readonly string[];
}

export interface WorldEventDirectorTickResult {
  readonly evaluatedAt: number;
  readonly scheduler: GlobalEventSchedulerSnapshot;
  readonly roomPlans: readonly WorldEventRoomPlan[];
}

interface EmissionLedgerRecord {
  readonly roomId: string;
  readonly activationId: string;
  readonly emittedAt: number;
  readonly kind: 'VISIBLE' | 'SHADOW';
}

const DEFAULT_EMISSION_COOLDOWN_MS = 45_000;
const DEFAULT_UPCOMING_HORIZON_MS = 1000 * 60 * 60 * 6;

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

function systemNow(): number {
  return Date.now();
}

function asAnnouncementStyle(event: GlobalEventProjection): WorldEventAnnouncementStyle {
  if (event.family === 'COORDINATED_RAID') {
    return 'RAID_WARNING';
  }
  if (event.family === 'HELPER_BLACKOUT') {
    return 'PANIC_BANNER';
  }
  if (event.tags.includes('WHISPER_ONLY')) {
    return 'WHISPER_LOCK';
  }
  if (event.family === 'SEASON') {
    return 'SEASONAL_HEADER';
  }
  return 'BREAKING_WORLD_EVENT';
}

function priorityForAnnouncement(event: GlobalEventProjection): number {
  const base = Math.max(...Object.values(event.channelPriority));
  if (event.family === 'COORDINATED_RAID') {
    return base + 20;
  }
  if (event.family === 'HELPER_BLACKOUT') {
    return base + 12;
  }
  return base;
}

export class WorldEventDirector {
  private readonly scheduler: GlobalEventScheduler;
  private readonly factionPlanner: FactionSurgePlanner;
  private readonly upcomingHorizonMs: number;
  private readonly emissionCooldownMs: number;
  private readonly emissionLedger = new Map<string, EmissionLedgerRecord>();

  public constructor(options: WorldEventDirectorOptions = {}) {
    this.scheduler = options.scheduler ?? new GlobalEventScheduler();
    this.factionPlanner = options.factionPlanner ?? new FactionSurgePlanner();
    this.upcomingHorizonMs = options.upcomingHorizonMs ?? DEFAULT_UPCOMING_HORIZON_MS;
    this.emissionCooldownMs = options.emissionCooldownMs ?? DEFAULT_EMISSION_COOLDOWN_MS;
  }

  public getScheduler(): GlobalEventScheduler {
    return this.scheduler;
  }

  public getFactionPlanner(): FactionSurgePlanner {
    return this.factionPlanner;
  }

  public tick(
    context: GlobalEventSchedulerEvaluationContext = {},
  ): WorldEventDirectorTickResult {
    const now = context.now ?? systemNow();
    const scheduler = this.scheduler.evaluate({
      ...context,
      now,
    });

    const roomPlans: WorldEventRoomPlan[] = [];
    const rooms = context.rooms ?? [];
    for (const room of rooms) {
      roomPlans.push(this.planRoom(room, scheduler, now));
    }

    this.pruneEmissionLedger(now);

    return {
      evaluatedAt: now,
      scheduler,
      roomPlans,
    };
  }

  public planRoom(
    room: GlobalEventSchedulerRoomContext,
    scheduler: GlobalEventSchedulerSnapshot,
    now: number = systemNow(),
  ): WorldEventRoomPlan {
    const activeEvents = this.filterEventsForRoom(room, scheduler.activeProjections);
    const factionSurge = this.factionPlanner.plan(room, activeEvents);
    const overlay = this.buildOverlayDirective(room, scheduler.overlays, activeEvents);
    const visibleAnnouncements = this.buildVisibleAnnouncements(room, activeEvents, now);
    const shadowDirectives = this.buildShadowDirectives(room, activeEvents, factionSurge, now);

    return {
      roomId: room.roomId,
      schedulerProjectionIds: activeEvents.map((event) => event.activationId),
      activeEvents,
      factionSurge,
      overlay,
      visibleAnnouncements,
      shadowDirectives,
      notes: freeze([
        `ROOM:${room.roomId}`,
        `ACTIVE_EVENTS:${activeEvents.length}`,
        `PRIMARY_FACTION:${factionSurge.primaryFactionId}`,
        `HELPER_BLACKOUT:${String(factionSurge.helperBlackoutActive)}`,
        `RAID_ACTIVE:${String(factionSurge.coordinatedRaidActive)}`,
      ]),
    };
  }

  public serialize(): {
    readonly emissionLedger: readonly EmissionLedgerRecord[];
    readonly scheduler: ReturnType<GlobalEventScheduler['serialize']>;
  } {
    return {
      emissionLedger: [...this.emissionLedger.values()].sort((left, right) => left.emittedAt - right.emittedAt),
      scheduler: this.scheduler.serialize(),
    };
  }

  public hydrate(state: {
    readonly emissionLedger: readonly EmissionLedgerRecord[];
    readonly scheduler: ReturnType<GlobalEventScheduler['serialize']>;
  }): void {
    this.emissionLedger.clear();
    for (const record of state.emissionLedger) {
      this.emissionLedger.set(this.emissionKey(record.roomId, record.activationId, record.kind), record);
    }
    this.scheduler.hydrate(state.scheduler);
  }

  private filterEventsForRoom(
    room: GlobalEventSchedulerRoomContext,
    activeEvents: readonly GlobalEventProjection[],
  ): readonly GlobalEventProjection[] {
    return activeEvents.filter((event) => {
      if (event.tags.includes('LOW_SHIELD_HUNT') && (room.lowShieldPlayerCount ?? 0) <= 0) {
        return false;
      }
      if (event.tags.includes('SYNDICATE_PANIC') && room.mode && room.mode.toUpperCase().includes('LOBBY')) {
        return false;
      }
      return true;
    });
  }

  private buildOverlayDirective(
    room: GlobalEventSchedulerRoomContext,
    snapshot: ChatLiveOpsOverlaySnapshot,
    activeEvents: readonly GlobalEventProjection[],
  ): WorldEventOverlayDirective {
    const overlays = snapshot.activeOverlays.filter((overlay) =>
      activeEvents.some((event) => event.activationId === overlay.overlayId),
    );

    return {
      roomId: room.roomId,
      overlays,
      primaryOverlayId: overlays[0]?.overlayId ?? null,
    };
  }

  private buildVisibleAnnouncements(
    room: GlobalEventSchedulerRoomContext,
    activeEvents: readonly GlobalEventProjection[],
    now: number,
  ): readonly WorldEventAnnouncementDirective[] {
    const directives: WorldEventAnnouncementDirective[] = [];

    for (const event of activeEvents) {
      const channels = event.visibility === 'SHADOW_ONLY'
        ? []
        : event.channels.filter((channel) => channel !== 'LOBBY' || room.mode?.toUpperCase().includes('LOBBY') || true);

      if (channels.length === 0) {
        continue;
      }

      if (!this.shouldEmit(room.roomId, event.activationId, 'VISIBLE', now)) {
        continue;
      }

      directives.push(
        freeze({
          directiveId: `${room.roomId}::${event.activationId}::VISIBLE`,
          roomId: room.roomId,
          activationId: event.activationId,
          eventId: event.eventId,
          headline: event.headline,
          summaryLines: [...event.summaryLines],
          channels: channels,
          style: asAnnouncementStyle(event),
          priority: priorityForAnnouncement(event),
          tags: freeze(uniqueStrings([...event.tags, 'VISIBLE_LIVEOPS', room.roomId])),
          startsAt: event.startsAt,
          endsAt: event.endsAt,
        }),
      );

      this.markEmitted(room.roomId, event.activationId, 'VISIBLE', now);
    }

    return directives.sort((left, right) => right.priority - left.priority);
  }

  private buildShadowDirectives(
    room: GlobalEventSchedulerRoomContext,
    activeEvents: readonly GlobalEventProjection[],
    factionSurge: FactionSurgePlan,
    now: number,
  ): readonly WorldEventShadowDirective[] {
    const directives: WorldEventShadowDirective[] = [];

    for (const event of activeEvents) {
      if (!this.shouldEmit(room.roomId, event.activationId, 'SHADOW', now)) {
        continue;
      }

      const basePressure = Math.max(1, Math.round(event.timeRemainingMs / 60_000));
      const helperPenalty = factionSurge.helperBlackoutActive ? -4 : 0;

      directives.push(
        freeze({
          directiveId: `${room.roomId}::${event.activationId}::LIVEOPS_SHADOW`,
          roomId: room.roomId,
          activationId: event.activationId,
          shadowChannelId: 'LIVEOPS_SHADOW',
          queuePriority: priorityForAnnouncement(event),
          pressureDelta: basePressure + factionSurge.pressureBiasDelta,
          helperAvailabilityDelta: helperPenalty,
          interruptionDelta:
            factionSurge.channelDirectives.reduce((sum, directive) => sum + directive.interruptionPressureDelta, 0) +
            (factionSurge.coordinatedRaidActive ? 4 : 0),
          witnessDelta: factionSurge.witnessPressureDelta,
          tags: freeze(uniqueStrings([
            ...event.tags,
            ...factionSurge.recommendedTags,
            'LIVEOPS_SHADOW',
          ])),
          notes: freeze([
            `PRIMARY_FACTION:${factionSurge.primaryFactionId}`,
            `INTENSITY:${event.intensity}`,
            `PRESSURE_BASE:${basePressure}`,
          ]),
        }),
      );

      if (factionSurge.helperBlackoutActive) {
        directives.push(
          freeze({
            directiveId: `${room.roomId}::${event.activationId}::RESCUE_SHADOW`,
            roomId: room.roomId,
            activationId: event.activationId,
            shadowChannelId: 'RESCUE_SHADOW',
            queuePriority: priorityForAnnouncement(event) - 10,
            pressureDelta: basePressure,
            helperAvailabilityDelta: -5,
            interruptionDelta: 0,
            witnessDelta: 0,
            tags: freeze(uniqueStrings(['HELPER_BLACKOUT', ...event.tags, room.roomId])),
            notes: freeze(['HELPER_RESCUE_MUTE']),
          }),
        );
      }

      if (factionSurge.coordinatedRaidActive) {
        directives.push(
          freeze({
            directiveId: `${room.roomId}::${event.activationId}::RIVALRY_SHADOW`,
            roomId: room.roomId,
            activationId: event.activationId,
            shadowChannelId: 'RIVALRY_SHADOW',
            queuePriority: priorityForAnnouncement(event) + 5,
            pressureDelta: basePressure + 3,
            helperAvailabilityDelta: 0,
            interruptionDelta: 4,
            witnessDelta: 2,
            tags: freeze(uniqueStrings(['RAID_WINDOW', ...event.tags, ...factionSurge.recommendedTags])),
            notes: freeze(['RIVALRY_FASTLANE_ACTIVE']),
          }),
        );
      }

      this.markEmitted(room.roomId, event.activationId, 'SHADOW', now);
    }

    return directives.sort((left, right) => right.queuePriority - left.queuePriority);
  }

  private shouldEmit(
    roomId: string,
    activationId: string,
    kind: 'VISIBLE' | 'SHADOW',
    now: number,
  ): boolean {
    const record = this.emissionLedger.get(this.emissionKey(roomId, activationId, kind));
    if (!record) {
      return true;
    }
    return now - record.emittedAt >= this.emissionCooldownMs;
  }

  private markEmitted(
    roomId: string,
    activationId: string,
    kind: 'VISIBLE' | 'SHADOW',
    now: number,
  ): void {
    const record: EmissionLedgerRecord = {
      roomId,
      activationId,
      emittedAt: now,
      kind,
    };
    this.emissionLedger.set(this.emissionKey(roomId, activationId, kind), record);
  }

  private emissionKey(
    roomId: string,
    activationId: string,
    kind: 'VISIBLE' | 'SHADOW',
  ): string {
    return `${roomId}::${activationId}::${kind}`;
  }

  private pruneEmissionLedger(now: number): void {
    for (const [key, record] of this.emissionLedger.entries()) {
      if (now - record.emittedAt > this.upcomingHorizonMs) {
        this.emissionLedger.delete(key);
      }
    }
  }
}

export function createWorldEventDirector(
  options: WorldEventDirectorOptions = {},
): WorldEventDirector {
  return new WorldEventDirector(options);
}
