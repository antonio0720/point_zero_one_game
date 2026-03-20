/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT WORLD EVENT CONTRACT
 * FILE: shared/contracts/chat/ChatWorldEvent.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared law for scheduled and triggered world-scale chat events.
 *
 * These contracts promote world events from ad-hoc overlay metadata into a
 * first-class, replayable, targetable, and transport-safe runtime surface.
 * A world event is not just a banner. It is an authored operational condition
 * that can alter:
 *
 * 1. who gets targeted,
 * 2. which channels become louder or quieter,
 * 3. how crowd heat changes,
 * 4. whether helpers are suppressed or pushed,
 * 5. whether rivals coordinate,
 * 6. whether whispers replace public speech,
 * 7. whether the system announces, shadows, or reveals the event,
 * 8. and how the event becomes part of the run legend.
 *
 * Design doctrine
 * ---------------
 * 1. Shared contracts define law and structure, never runtime side effects.
 * 2. A world event must be serializable, schedulable, and replay-safe.
 * 3. Public effects and shadow effects must be modeled separately.
 * 4. Channel pressure and target selection are explicit, never implied.
 * 5. Events may be player-centric, faction-centric, room-centric, or global.
 * 6. Triggered and scheduled events share one canonical state model.
 * 7. Event resolution must support frontend, backend, and transport lanes.
 * 8. This file must remain additive to existing repo authorities, including the
 *    legacy shared/contracts/chat/liveops.ts overlay model.
 *
 * Canonical authority roots
 * -------------------------
 * - /shared/contracts/chat
 * - /pzo-web/src/engines/chat
 * - /pzo-web/src/components/chat
 * - /backend/src/game/engine/chat
 * - /pzo-server/src/chat
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import {
  CHAT_ALL_CHANNELS,
  CHAT_SHADOW_CHANNELS,
  CHAT_VISIBLE_CHANNELS,
  type ChatChannelId,
  type ChatLegendId,
  type ChatMessageId,
  type ChatMomentId,
  type ChatNpcId,
  type ChatReplayId,
  type ChatRoomId,
  type ChatSceneId,
  type ChatUserId,
  type ChatWorldEventId,
  type JsonObject,
  type JsonValue,
  type UnixMs,
} from './ChatChannels';
import type {
  ChatLiveOpsChannelId,
  ChatLiveOpsIntensityBand,
  ChatLiveOpsOverlayDefinition,
  ChatLiveOpsOverlayKind,
  ChatLiveOpsOverlayRule,
} from './liveops';

export type ChatWorldEventVersion = 1;
export const CHAT_WORLD_EVENT_VERSION: ChatWorldEventVersion = 1;

export const CHAT_WORLD_EVENT_KINDS = [
  'PREDATOR_SWEEP',
  'SYNDICATE_PANIC',
  'MARKET_RUMOR_BURST',
  'HELPER_BLACKOUT',
  'DOUBLE_HEAT',
  'WHISPER_ONLY',
  'FACTION_DEBATE',
  'COORDINATED_HATER_RAID',
  'LOW_SHIELD_HUNT',
  'LEGEND_SPOTLIGHT',
  'RIVALRY_ESCALATION',
  'CUSTOM',
] as const;
export type ChatWorldEventKind = (typeof CHAT_WORLD_EVENT_KINDS)[number];

export const CHAT_WORLD_EVENT_STATES = [
  'DRAFT',
  'SCHEDULED',
  'ARMED',
  'PRELIVE',
  'LIVE',
  'COOLDOWN',
  'ENDED',
  'CANCELLED',
  'ARCHIVED',
] as const;
export type ChatWorldEventState = (typeof CHAT_WORLD_EVENT_STATES)[number];

export const CHAT_WORLD_EVENT_SCOPE_KINDS = [
  'GLOBAL',
  'CHANNEL_SET',
  'ROOM_SET',
  'PLAYER_SET',
  'NPC_SET',
  'FACTION_SET',
  'MATCH_LOCAL',
  'RUN_LOCAL',
  'LEGEND_CALLBACK',
] as const;
export type ChatWorldEventScopeKind = (typeof CHAT_WORLD_EVENT_SCOPE_KINDS)[number];

export const CHAT_WORLD_EVENT_VISIBILITY_MODES = [
  'PUBLIC',
  'SHADOW_ONLY',
  'PUBLIC_WITH_SHADOW',
  'REVEAL_LATER',
  'OPERATOR_HIDDEN',
] as const;
export type ChatWorldEventVisibilityMode = (typeof CHAT_WORLD_EVENT_VISIBILITY_MODES)[number];

export const CHAT_WORLD_EVENT_PRESSURE_BANDS = [
  'NONE',
  'LIGHT',
  'MODERATE',
  'HEAVY',
  'SEVERE',
  'WORLD_CLASS',
] as const;
export type ChatWorldEventPressureBand = (typeof CHAT_WORLD_EVENT_PRESSURE_BANDS)[number];

export const CHAT_WORLD_EVENT_ANNOUNCEMENT_MODES = [
  'NONE',
  'HEADLINE',
  'BANNER',
  'SYSTEM_NOTICE',
  'INTERRUPTION',
  'SCENE',
] as const;
export type ChatWorldEventAnnouncementMode = (typeof CHAT_WORLD_EVENT_ANNOUNCEMENT_MODES)[number];

export const CHAT_WORLD_EVENT_TRIGGER_KINDS = [
  'SCHEDULED',
  'MANUAL',
  'PLAYER_THRESHOLD',
  'ROOM_THRESHOLD',
  'RIVALRY_THRESHOLD',
  'LEGEND_THRESHOLD',
  'LIVEOPS_CHAIN',
  'SYSTEM_FAILSAFE',
] as const;
export type ChatWorldEventTriggerKind = (typeof CHAT_WORLD_EVENT_TRIGGER_KINDS)[number];

export const CHAT_WORLD_EVENT_REACTION_MODES = [
  'QUIET_SURGE',
  'LOUD_SURGE',
  'HUNTER_PATTERN',
  'PANIC_PATTERN',
  'RUMOR_PATTERN',
  'DEBATE_PATTERN',
  'BLACKOUT_PATTERN',
  'WHISPER_PATTERN',
  'SPECTACLE_PATTERN',
] as const;
export type ChatWorldEventReactionMode = (typeof CHAT_WORLD_EVENT_REACTION_MODES)[number];

export interface ChatWorldEventScheduleWindow {
  readonly startsAt: UnixMs;
  readonly endsAt: UnixMs;
  readonly warmupMs: number;
  readonly cooldownMs: number;
}

export interface ChatWorldEventPhase {
  readonly phaseId: string;
  readonly label: string;
  readonly startsOffsetMs: number;
  readonly endsOffsetMs: number;
  readonly reactionMode: ChatWorldEventReactionMode;
  readonly pressureMultiplier: number;
  readonly helperSuppressionMultiplier: number;
  readonly crowdHeatMultiplier: number;
  readonly whisperOnly: boolean;
  readonly hidden: boolean;
  readonly notes?: readonly string[];
}

export interface ChatWorldEventTargetFilter {
  readonly minShield?: number;
  readonly maxShield?: number;
  readonly minPressure?: number;
  readonly maxPressure?: number;
  readonly minThreat?: number;
  readonly maxThreat?: number;
  readonly requiresTags?: readonly string[];
  readonly excludesTags?: readonly string[];
  readonly requiresLegendIds?: readonly ChatLegendId[];
  readonly excludesLegendIds?: readonly ChatLegendId[];
  readonly requiresReplayIds?: readonly ChatReplayId[];
  readonly playerIds?: readonly ChatUserId[];
  readonly npcIds?: readonly ChatNpcId[];
  readonly roomIds?: readonly ChatRoomId[];
  readonly includeChannels?: readonly ChatChannelId[];
  readonly excludeChannels?: readonly ChatChannelId[];
  readonly lowShieldOnly?: boolean;
  readonly rivalryOnly?: boolean;
  readonly helperEligibleOnly?: boolean;
}

export interface ChatWorldEventScope {
  readonly kind: ChatWorldEventScopeKind;
  readonly channels: readonly ChatChannelId[];
  readonly roomIds?: readonly ChatRoomId[];
  readonly playerIds?: readonly ChatUserId[];
  readonly npcIds?: readonly ChatNpcId[];
  readonly factionIds?: readonly string[];
  readonly filter?: ChatWorldEventTargetFilter;
}

export interface ChatWorldEventPressureVector {
  readonly audienceHeatDelta: number;
  readonly visibleHeatDelta: number;
  readonly shadowHeatDelta: number;
  readonly intimidationDelta: number;
  readonly hostilityDelta: number;
  readonly judgmentDelta: number;
  readonly whisperDelta: number;
  readonly helperSuppressionDelta: number;
  readonly rivalAggressionDelta: number;
  readonly legendChargeDelta: number;
}

export interface ChatWorldEventAnnouncementPlan {
  readonly mode: ChatWorldEventAnnouncementMode;
  readonly headline: string;
  readonly shortBody: string;
  readonly detailLines: readonly string[];
  readonly publishChannels: readonly ChatChannelId[];
  readonly shadowChannels: readonly ChatChannelId[];
  readonly systemOnly: boolean;
  readonly suppressIfQuiet: boolean;
}

export interface ChatWorldEventRevealRule {
  readonly revealId: string;
  readonly revealAfterMs: number;
  readonly revealChannels: readonly ChatChannelId[];
  readonly revealHeadline: string;
  readonly revealBody: string;
  readonly revealIfCounteredOnly?: boolean;
  readonly revealIfLegendOnly?: boolean;
}

export interface ChatWorldEventTrigger {
  readonly kind: ChatWorldEventTriggerKind;
  readonly triggerId: string;
  readonly label: string;
  readonly armAt?: UnixMs;
  readonly notes?: readonly string[];
  readonly requiredTags?: readonly string[];
  readonly thresholdValue?: number;
  readonly sourceChannel?: ChatChannelId;
  readonly sourcePlayerId?: ChatUserId;
  readonly sourceNpcId?: ChatNpcId;
}

export interface ChatWorldEventDefinition {
  readonly version: ChatWorldEventVersion;
  readonly eventId: ChatWorldEventId;
  readonly slug: string;
  readonly displayName: string;
  readonly description: string;
  readonly kind: ChatWorldEventKind;
  readonly overlayKind: ChatLiveOpsOverlayKind;
  readonly intensity: ChatLiveOpsIntensityBand;
  readonly state: ChatWorldEventState;
  readonly visibility: ChatWorldEventVisibilityMode;
  readonly pressureBand: ChatWorldEventPressureBand;
  readonly authoredAt: UnixMs;
  readonly authoredBy: string;
  readonly schedule: ChatWorldEventScheduleWindow;
  readonly scope: ChatWorldEventScope;
  readonly trigger: ChatWorldEventTrigger;
  readonly announcement: ChatWorldEventAnnouncementPlan;
  readonly pressure: ChatWorldEventPressureVector;
  readonly phases: readonly ChatWorldEventPhase[];
  readonly revealRules: readonly ChatWorldEventRevealRule[];
  readonly tags: readonly string[];
  readonly callbackAnchors?: readonly string[];
  readonly notes?: readonly string[];
  readonly metadata?: JsonObject;
}

export interface ChatWorldEventActivation {
  readonly activationId: string;
  readonly eventId: ChatWorldEventId;
  readonly state: ChatWorldEventState;
  readonly activatedAt: UnixMs;
  readonly armedAt?: UnixMs;
  readonly liveAt?: UnixMs;
  readonly cooldownAt?: UnixMs;
  readonly endedAt?: UnixMs;
  readonly cancellationReason?: string;
  readonly triggeredBy?: ChatWorldEventTrigger;
  readonly targetedRoomIds: readonly ChatRoomId[];
  readonly targetedPlayerIds: readonly ChatUserId[];
  readonly targetedNpcIds: readonly ChatNpcId[];
  readonly targetedChannels: readonly ChatChannelId[];
}

export interface ChatWorldEventLedgerEntry {
  readonly ledgerId: string;
  readonly eventId: ChatWorldEventId;
  readonly timestamp: UnixMs;
  readonly fromState?: ChatWorldEventState;
  readonly toState: ChatWorldEventState;
  readonly reason: string;
  readonly visible: boolean;
  readonly channelId?: ChatChannelId;
  readonly roomId?: ChatRoomId;
  readonly messageId?: ChatMessageId;
  readonly momentId?: ChatMomentId;
  readonly sceneId?: ChatSceneId;
  readonly metadata?: JsonObject;
}

export interface ChatWorldEventFanoutEnvelope {
  readonly envelopeId: string;
  readonly eventId: ChatWorldEventId;
  readonly createdAt: UnixMs;
  readonly channels: readonly ChatChannelId[];
  readonly roomIds: readonly ChatRoomId[];
  readonly headline: string;
  readonly body: string;
  readonly detailLines: readonly string[];
  readonly visibility: ChatWorldEventVisibilityMode;
  readonly shadowOnly: boolean;
  readonly tags: readonly string[];
}

export interface ChatWorldEventSummary {
  readonly eventId: ChatWorldEventId;
  readonly displayName: string;
  readonly kind: ChatWorldEventKind;
  readonly state: ChatWorldEventState;
  readonly intensity: ChatLiveOpsIntensityBand;
  readonly pressureBand: ChatWorldEventPressureBand;
  readonly headline: string;
  readonly targetChannelCount: number;
  readonly targetRoomCount: number;
  readonly live: boolean;
  readonly warmup: boolean;
  readonly cooldown: boolean;
  readonly shadowOnly: boolean;
  readonly startedAt?: UnixMs;
  readonly endsAt: UnixMs;
}

export interface ChatWorldEventPreview {
  readonly eventId: ChatWorldEventId;
  readonly label: string;
  readonly kind: ChatWorldEventKind;
  readonly channels: readonly ChatChannelId[];
  readonly announcementMode: ChatWorldEventAnnouncementMode;
  readonly headline: string;
  readonly visible: boolean;
  readonly shadowChannels: readonly ChatChannelId[];
}

export interface ChatWorldEventRegistryManifest {
  readonly version: ChatWorldEventVersion;
  readonly kinds: readonly ChatWorldEventKind[];
  readonly states: readonly ChatWorldEventState[];
  readonly scopeKinds: readonly ChatWorldEventScopeKind[];
  readonly visibilityModes: readonly ChatWorldEventVisibilityMode[];
  readonly pressureBands: readonly ChatWorldEventPressureBand[];
  readonly announcementModes: readonly ChatWorldEventAnnouncementMode[];
  readonly triggerKinds: readonly ChatWorldEventTriggerKind[];
  readonly reactionModes: readonly ChatWorldEventReactionMode[];
  readonly visibleChannels: readonly ChatChannelId[];
  readonly shadowChannels: readonly ChatChannelId[];
}

export const CHAT_WORLD_EVENT_REGISTRY_MANIFEST: ChatWorldEventRegistryManifest = Object.freeze({
  version: CHAT_WORLD_EVENT_VERSION,
  kinds: CHAT_WORLD_EVENT_KINDS,
  states: CHAT_WORLD_EVENT_STATES,
  scopeKinds: CHAT_WORLD_EVENT_SCOPE_KINDS,
  visibilityModes: CHAT_WORLD_EVENT_VISIBILITY_MODES,
  pressureBands: CHAT_WORLD_EVENT_PRESSURE_BANDS,
  announcementModes: CHAT_WORLD_EVENT_ANNOUNCEMENT_MODES,
  triggerKinds: CHAT_WORLD_EVENT_TRIGGER_KINDS,
  reactionModes: CHAT_WORLD_EVENT_REACTION_MODES,
  visibleChannels: CHAT_VISIBLE_CHANNELS,
  shadowChannels: CHAT_SHADOW_CHANNELS,
});

export const DEFAULT_CHAT_WORLD_EVENT_PRESSURE: ChatWorldEventPressureVector = Object.freeze({
  audienceHeatDelta: 0,
  visibleHeatDelta: 0,
  shadowHeatDelta: 0,
  intimidationDelta: 0,
  hostilityDelta: 0,
  judgmentDelta: 0,
  whisperDelta: 0,
  helperSuppressionDelta: 0,
  rivalAggressionDelta: 0,
  legendChargeDelta: 0,
});

export function isChatWorldEventKind(value: string): value is ChatWorldEventKind {
  return (CHAT_WORLD_EVENT_KINDS as readonly string[]).includes(value);
}

export function isChatWorldEventState(value: string): value is ChatWorldEventState {
  return (CHAT_WORLD_EVENT_STATES as readonly string[]).includes(value);
}

export function isChatWorldEventLive(state: ChatWorldEventState, now: UnixMs, schedule: ChatWorldEventScheduleWindow): boolean {
  return state === 'LIVE' && now >= schedule.startsAt && now < schedule.endsAt;
}

export function isChatWorldEventWarmup(now: UnixMs, schedule: ChatWorldEventScheduleWindow): boolean {
  return now >= (schedule.startsAt - schedule.warmupMs) && now < schedule.startsAt;
}

export function isChatWorldEventCooldown(now: UnixMs, schedule: ChatWorldEventScheduleWindow): boolean {
  return now >= schedule.endsAt && now < (schedule.endsAt + schedule.cooldownMs);
}

export function collectWorldEventTargetChannels(event: Pick<ChatWorldEventDefinition, 'scope' | 'visibility' | 'announcement'>): readonly ChatChannelId[] {
  const collected = new Set<ChatChannelId>();

  for (const channel of event.scope.channels) {
    if ((CHAT_ALL_CHANNELS as readonly string[]).includes(channel)) {
      collected.add(channel);
    }
  }

  for (const channel of event.announcement.publishChannels) {
    if ((CHAT_ALL_CHANNELS as readonly string[]).includes(channel)) {
      collected.add(channel);
    }
  }

  if (event.visibility === 'SHADOW_ONLY' || event.visibility === 'PUBLIC_WITH_SHADOW' || event.visibility === 'REVEAL_LATER') {
    for (const channel of event.announcement.shadowChannels) {
      if ((CHAT_ALL_CHANNELS as readonly string[]).includes(channel)) {
        collected.add(channel);
      }
    }
  }

  return Array.from(collected);
}

export function summarizeChatWorldEvent(
  event: ChatWorldEventDefinition,
  activation?: Pick<ChatWorldEventActivation, 'targetedChannels' | 'targetedRoomIds'>,
): ChatWorldEventSummary {
  const targetedChannels = activation?.targetedChannels ?? collectWorldEventTargetChannels(event);
  const targetedRoomIds = activation?.targetedRoomIds ?? event.scope.roomIds ?? [];

  return {
    eventId: event.eventId,
    displayName: event.displayName,
    kind: event.kind,
    state: event.state,
    intensity: event.intensity,
    pressureBand: event.pressureBand,
    headline: event.announcement.headline,
    targetChannelCount: targetedChannels.length,
    targetRoomCount: targetedRoomIds.length,
    live: event.state === 'LIVE',
    warmup: false,
    cooldown: false,
    shadowOnly: event.visibility === 'SHADOW_ONLY',
    startedAt: event.schedule.startsAt,
    endsAt: event.schedule.endsAt,
  };
}

export function previewChatWorldEvent(event: ChatWorldEventDefinition): ChatWorldEventPreview {
  return {
    eventId: event.eventId,
    label: event.displayName,
    kind: event.kind,
    channels: collectWorldEventTargetChannels(event),
    announcementMode: event.announcement.mode,
    headline: event.announcement.headline,
    visible: event.visibility !== 'SHADOW_ONLY',
    shadowChannels: event.announcement.shadowChannels,
  };
}

export function normalizeChatWorldEvent(event: ChatWorldEventDefinition): ChatWorldEventDefinition {
  const phases = [...event.phases]
    .map((phase) => ({
      ...phase,
      pressureMultiplier: finiteOrFallback(phase.pressureMultiplier, 1),
      helperSuppressionMultiplier: finiteOrFallback(phase.helperSuppressionMultiplier, 1),
      crowdHeatMultiplier: finiteOrFallback(phase.crowdHeatMultiplier, 1),
    }))
    .sort((left, right) => left.startsOffsetMs - right.startsOffsetMs);

  const scopeChannels = uniqueChannels(event.scope.channels);
  const publishChannels = uniqueChannels(event.announcement.publishChannels);
  const shadowChannels = uniqueChannels(event.announcement.shadowChannels);

  return {
    ...event,
    schedule: {
      startsAt: event.schedule.startsAt,
      endsAt: maxUnixMs(event.schedule.endsAt, event.schedule.startsAt),
      warmupMs: Math.max(0, event.schedule.warmupMs),
      cooldownMs: Math.max(0, event.schedule.cooldownMs),
    },
    scope: {
      ...event.scope,
      channels: scopeChannels,
      roomIds: uniqueStrings(event.scope.roomIds),
      playerIds: uniqueStrings(event.scope.playerIds),
      npcIds: uniqueStrings(event.scope.npcIds),
      factionIds: uniqueStrings(event.scope.factionIds),
      filter: event.scope.filter
        ? {
            ...event.scope.filter,
            requiresTags: uniqueStrings(event.scope.filter.requiresTags),
            excludesTags: uniqueStrings(event.scope.filter.excludesTags),
            requiresLegendIds: uniqueStrings(event.scope.filter.requiresLegendIds),
            excludesLegendIds: uniqueStrings(event.scope.filter.excludesLegendIds),
            requiresReplayIds: uniqueStrings(event.scope.filter.requiresReplayIds),
            playerIds: uniqueStrings(event.scope.filter.playerIds),
            npcIds: uniqueStrings(event.scope.filter.npcIds),
            roomIds: uniqueStrings(event.scope.filter.roomIds),
            includeChannels: uniqueChannels(event.scope.filter.includeChannels),
            excludeChannels: uniqueChannels(event.scope.filter.excludeChannels),
          }
        : undefined,
    },
    announcement: {
      ...event.announcement,
      publishChannels,
      shadowChannels,
      detailLines: uniqueStrings(event.announcement.detailLines),
    },
    pressure: {
      audienceHeatDelta: finiteOrFallback(event.pressure.audienceHeatDelta, 0),
      visibleHeatDelta: finiteOrFallback(event.pressure.visibleHeatDelta, 0),
      shadowHeatDelta: finiteOrFallback(event.pressure.shadowHeatDelta, 0),
      intimidationDelta: finiteOrFallback(event.pressure.intimidationDelta, 0),
      hostilityDelta: finiteOrFallback(event.pressure.hostilityDelta, 0),
      judgmentDelta: finiteOrFallback(event.pressure.judgmentDelta, 0),
      whisperDelta: finiteOrFallback(event.pressure.whisperDelta, 0),
      helperSuppressionDelta: finiteOrFallback(event.pressure.helperSuppressionDelta, 0),
      rivalAggressionDelta: finiteOrFallback(event.pressure.rivalAggressionDelta, 0),
      legendChargeDelta: finiteOrFallback(event.pressure.legendChargeDelta, 0),
    },
    phases,
    revealRules: [...event.revealRules].map((rule) => ({
      ...rule,
      revealAfterMs: Math.max(0, rule.revealAfterMs),
      revealChannels: uniqueChannels(rule.revealChannels),
    })),
    tags: uniqueStrings(event.tags),
    callbackAnchors: uniqueStrings(event.callbackAnchors),
    notes: uniqueStrings(event.notes),
    metadata: event.metadata ?? undefined,
  };
}

export function projectChatWorldEventToLegacyOverlayDefinition(
  event: ChatWorldEventDefinition,
): ChatLiveOpsOverlayDefinition {
  const overlayChannels = collectLegacyLiveOpsChannels(event.scope.channels, event.announcement.publishChannels);
  const pressureDelta = event.pressure.audienceHeatDelta;
  const publicnessDelta = event.pressure.visibleHeatDelta;
  const callbackAggressionDelta = event.pressure.rivalAggressionDelta;

  const rules: readonly ChatLiveOpsOverlayRule[] = [
    {
      ruleId: `${String(event.eventId)}::legacy-rule`,
      appliesToChannels: overlayChannels,
      requiredTags: event.scope.filter?.requiresTags,
      addedPlanningTags: event.tags,
      transformBiases: deriveLegacyTransformBiases(event),
      pressureDelta,
      publicnessDelta,
      callbackAggressionDelta,
    },
  ];

  return {
    overlayId: String(event.eventId),
    seasonId: null,
    displayName: event.displayName,
    kind: event.overlayKind,
    intensity: event.intensity,
    startsAt: event.schedule.startsAt,
    endsAt: event.schedule.endsAt,
    headline: event.announcement.headline,
    summaryLines: event.announcement.detailLines,
    tags: event.tags,
    channelPriority: buildLegacyChannelPriority(overlayChannels),
    rules,
  };
}

function deriveLegacyTransformBiases(event: ChatWorldEventDefinition): readonly string[] {
  const biases = new Set<string>();
  biases.add(event.kind.toLowerCase());
  biases.add(event.intensity.toLowerCase());
  if (event.visibility === 'SHADOW_ONLY') biases.add('shadow-only');
  if (event.announcement.mode === 'SYSTEM_NOTICE') biases.add('system-notice');
  if (event.pressure.whisperDelta > 0) biases.add('whisper-pressure');
  if (event.pressure.helperSuppressionDelta > 0) biases.add('helper-suppressed');
  if (event.pressure.legendChargeDelta > 0) biases.add('legend-charged');
  return Array.from(biases);
}

function buildLegacyChannelPriority(
  channels: readonly ChatLiveOpsChannelId[],
): Readonly<Record<ChatLiveOpsChannelId, number>> {
  return {
    GLOBAL: channels.includes('GLOBAL') ? 100 : 0,
    SYNDICATE: channels.includes('SYNDICATE') ? 100 : 0,
    DEAL_ROOM: channels.includes('DEAL_ROOM') ? 100 : 0,
    LOBBY: channels.includes('LOBBY') ? 100 : 0,
  };
}

function collectLegacyLiveOpsChannels(...channelSets: (readonly ChatChannelId[] | undefined)[]): readonly ChatLiveOpsChannelId[] {
  const allowed = new Set<ChatLiveOpsChannelId>();
  for (const channelSet of channelSets) {
    for (const channel of channelSet ?? []) {
      if (channel === 'GLOBAL' || channel === 'SYNDICATE' || channel === 'DEAL_ROOM' || channel === 'LOBBY') {
        allowed.add(channel);
      }
    }
  }
  return Array.from(allowed);
}

function uniqueStrings<T extends string>(values: readonly T[] | undefined): readonly T[] | undefined {
  if (!values || values.length === 0) return values;
  return Array.from(new Set(values));
}

function uniqueChannels(values: readonly ChatChannelId[] | undefined): readonly ChatChannelId[] {
  return Array.from(new Set((values ?? []).filter((value): value is ChatChannelId => (CHAT_ALL_CHANNELS as readonly string[]).includes(value))));
}

function finiteOrFallback(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function maxUnixMs(left: UnixMs, right: UnixMs): UnixMs {
  return (Math.max(left as unknown as number, right as unknown as number) as unknown) as UnixMs;
}
