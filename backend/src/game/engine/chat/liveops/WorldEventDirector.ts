
/* eslint-disable max-lines */
/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT LIVEOPS WORLD EVENT DIRECTOR
 * FILE: backend/src/game/engine/chat/liveops/WorldEventDirector.ts
 * VERSION: 2026.03.22-liveops-world-event-director-control-plane
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
 * This file remains downstream of the scheduler and the faction surge planner.
 * It does not mint windows. It does not synthesize final chat messages. It
 * projects world pressure into room-local directive packets that the rest of
 * the backend chat engine can safely consume.
 * ============================================================================
 */

import type {
  ChatLiveOpsChannelId,
  ChatLiveOpsIntensityBand,
  ChatLiveOpsOverlayDefinition,
  ChatLiveOpsOverlaySnapshot,
} from '../../../../../../shared/contracts/chat/liveops';

import {
  FactionSurgePlanner,
  createFactionSurgePlanner,
  type FactionPlanBatchResult,
  type FactionRoomSignalProfile,
  type FactionScoredDescriptor,
  type FactionSurgePlan,
  type FactionSurgePlanAudit,
  type FactionSurgePlanSummary,
  type FactionSurgeNarrativePacket,
} from './FactionSurgePlanner';

import {
  GlobalEventScheduler,
  GlobalEventSchedulerInspector,
  createGlobalEventScheduler,
  createGlobalEventSchedulerInspector,
  type ForceActivationInput,
  type GlobalEventActivationDigest,
  type GlobalEventChannelLoad,
  type GlobalEventDefinition,
  type GlobalEventDefinitionAudit,
  type GlobalEventFamily,
  type GlobalEventFamilyLoad,
  type GlobalEventLibraryDiff,
  type GlobalEventProjection,
  type GlobalEventRoomProjectionMatrixRow,
  type GlobalEventScheduleKind,
  type GlobalEventSchedulerEvaluationContext,
  type GlobalEventSchedulerDetailedSnapshot,
  type GlobalEventSchedulerManifest,
  type GlobalEventSchedulerOptions,
  type GlobalEventSchedulerRoomContext,
  type GlobalEventSchedulerSnapshot,
  type GlobalEventTimelineSlice,
  type GlobalEventVisibility,
  type GlobalEventWindowPreview,
  type PreviewWindowsInput,
} from './GlobalEventScheduler';

export type WorldEventAnnouncementStyle =
  | 'SYSTEM_NOTICE'
  | 'BREAKING_WORLD_EVENT'
  | 'WHISPER_LOCK'
  | 'PANIC_BANNER'
  | 'RAID_WARNING'
  | 'SEASONAL_HEADER'
  | 'RIVAL_SPOTLIGHT'
  | 'FACTION_PULSE'
  | 'BLACKOUT_ALERT'
  | 'TRUST_CALL';

export type WorldEventEmissionKind = 'VISIBLE' | 'SHADOW' | 'OVERLAY' | 'VOICE' | 'SYSTEM';

export type WorldEventShadowChannelId =
  | 'LIVEOPS_SHADOW'
  | 'SYSTEM_SHADOW'
  | 'NPC_SHADOW'
  | 'RIVALRY_SHADOW'
  | 'RESCUE_SHADOW';

export type WorldEventPressureBand =
  | 'CALM'
  | 'TENSE'
  | 'HOSTILE'
  | 'PREDATORY'
  | 'CEREMONIAL'
  | 'WORLD_CLASS';

export type WorldEventVoicePosture =
  | 'SILENT'
  | 'RESTRICTED'
  | 'AWARE'
  | 'LOUD'
  | 'PREDATORY'
  | 'CEREMONIAL';

export type WorldEventEmissionDisposition =
  | 'READY'
  | 'COOLDOWN'
  | 'SUPPRESSED'
  | 'SHADOW_ONLY'
  | 'VISIBLE_ONLY';

export interface WorldEventDirectorOptions {
  readonly scheduler?: GlobalEventScheduler;
  readonly factionPlanner?: FactionSurgePlanner;
  readonly schedulerOptions?: GlobalEventSchedulerOptions;
  readonly upcomingHorizonMs?: number;
  readonly emissionCooldownMs?: number;
  readonly nowProvider?: () => number;
  readonly enableSchedulerCloneOnInspect?: boolean;
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

export interface WorldEventVisibleChannelDirective {
  readonly directiveId: string;
  readonly roomId: string;
  readonly channelId: ChatLiveOpsChannelId;
  readonly dominantFactionId: string;
  readonly climate: WorldEventPressureBand;
  readonly emissionDisposition: WorldEventEmissionDisposition;
  readonly pressureDelta: number;
  readonly witnessDelta: number;
  readonly publicnessDelta: number;
  readonly helperAvailabilityDelta: number;
  readonly announcementStyle: WorldEventAnnouncementStyle;
  readonly secondaryFactionIds: readonly string[];
  readonly tags: readonly string[];
  readonly notes: readonly string[];
}

export interface WorldEventShadowDirective {
  readonly directiveId: string;
  readonly roomId: string;
  readonly activationId: string;
  readonly shadowChannelId: WorldEventShadowChannelId;
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

export interface WorldEventRoomClimate {
  readonly roomId: string;
  readonly modeId: string;
  readonly pressureBand: WorldEventPressureBand;
  readonly visiblePressure: number;
  readonly shadowPressure: number;
  readonly witnessPressure: number;
  readonly helperAvailabilityBias: number;
  readonly interruptionBias: number;
  readonly publicnessBias: number;
  readonly raidCadenceDeltaMs: number;
  readonly voicePosture: WorldEventVoicePosture;
  readonly dominantChannels: readonly ChatLiveOpsChannelId[];
  readonly tags: readonly string[];
  readonly notes: readonly string[];
}

export interface WorldEventNarrativePacket {
  readonly roomId: string;
  readonly primaryFactionId: string;
  readonly headline: string;
  readonly summaryLines: readonly string[];
  readonly callouts: readonly string[];
  readonly broadcastTags: readonly string[];
  readonly visibleChannels: readonly ChatLiveOpsChannelId[];
  readonly climate: WorldEventPressureBand;
  readonly voicePosture: WorldEventVoicePosture;
}

export interface WorldEventEmissionDecision {
  readonly activationId: string;
  readonly eventId: string;
  readonly kind: WorldEventEmissionKind;
  readonly disposition: WorldEventEmissionDisposition;
  readonly reason: string;
  readonly eligibleChannels: readonly ChatLiveOpsChannelId[];
  readonly priority: number;
  readonly tags: readonly string[];
}

export interface WorldEventEmissionAuditRecord {
  readonly roomId: string;
  readonly activationId: string;
  readonly eventId: string;
  readonly visibleDisposition: WorldEventEmissionDisposition;
  readonly shadowDisposition: WorldEventEmissionDisposition;
  readonly visibleLastEmittedAt?: number | null;
  readonly shadowLastEmittedAt?: number | null;
  readonly tags: readonly string[];
  readonly notes: readonly string[];
}

export interface WorldEventRoomPlanSummary {
  readonly roomId: string;
  readonly primaryFactionId: string;
  readonly primaryAlignment: string;
  readonly activeEventCount: number;
  readonly visibleAnnouncementCount: number;
  readonly shadowDirectiveCount: number;
  readonly dominantChannels: readonly ChatLiveOpsChannelId[];
  readonly climate: WorldEventPressureBand;
  readonly helperBlackoutActive: boolean;
  readonly coordinatedRaidActive: boolean;
  readonly quietestChannelId: ChatLiveOpsChannelId | null;
  readonly loudestChannelId: ChatLiveOpsChannelId | null;
  readonly summaryLines: readonly string[];
}

export interface WorldEventRoomPlanDiagnostics {
  readonly roomSignals: FactionRoomSignalProfile;
  readonly rankedFactions: readonly FactionScoredDescriptor[];
  readonly emissionAudit: readonly WorldEventEmissionAuditRecord[];
  readonly visibleDecisions: readonly WorldEventEmissionDecision[];
  readonly shadowDecisions: readonly WorldEventEmissionDecision[];
  readonly notes: readonly string[];
}

export interface WorldEventRoomPlan {
  readonly roomId: string;
  readonly schedulerProjectionIds: readonly string[];
  readonly activeEvents: readonly GlobalEventProjection[];
  readonly factionSurge: FactionSurgePlan;
  readonly overlay: WorldEventOverlayDirective;
  readonly visibleChannels: readonly WorldEventVisibleChannelDirective[];
  readonly roomClimate: WorldEventRoomClimate;
  readonly narrative: WorldEventNarrativePacket;
  readonly visibleAnnouncements: readonly WorldEventAnnouncementDirective[];
  readonly shadowDirectives: readonly WorldEventShadowDirective[];
  readonly summary: WorldEventRoomPlanSummary;
  readonly notes: readonly string[];
}

export interface WorldEventRoomPlanDetailed extends WorldEventRoomPlan {
  readonly diagnostics: WorldEventRoomPlanDiagnostics;
}

export interface WorldEventDirectorTickResult {
  readonly evaluatedAt: number;
  readonly scheduler: GlobalEventSchedulerSnapshot;
  readonly roomPlans: readonly WorldEventRoomPlan[];
}

export interface WorldEventDirectorDetailedTickResult extends WorldEventDirectorTickResult {
  readonly schedulerDetailed: GlobalEventSchedulerDetailedSnapshot;
  readonly roomPlansDetailed: readonly WorldEventRoomPlanDetailed[];
  readonly channelLoads: readonly GlobalEventChannelLoad[];
  readonly familyLoads: readonly GlobalEventFamilyLoad[];
  readonly timeline: readonly GlobalEventTimelineSlice[];
  readonly roomMatrix: readonly GlobalEventRoomProjectionMatrixRow[];
  readonly activationDigests: readonly GlobalEventActivationDigest[];
  readonly notes: readonly string[];
}

export interface WorldEventDirectorState {
  readonly version: string;
  readonly emissionLedger: readonly EmissionLedgerRecord[];
  readonly scheduler: ReturnType<GlobalEventScheduler['serialize']>;
}

export interface WorldEventDirectorManifest {
  readonly builtAt: number;
  readonly scheduler: GlobalEventSchedulerManifest;
  readonly definitionIds: readonly string[];
  readonly familyIds: readonly GlobalEventFamily[];
  readonly visibleFamilies: readonly GlobalEventFamily[];
  readonly shadowFamilies: readonly GlobalEventFamily[];
  readonly notes: readonly string[];
}

export interface WorldEventDirectorLibraryDiff {
  readonly comparedAt: number;
  readonly scheduler: GlobalEventLibraryDiff;
  readonly changedDefinitionIds: readonly string[];
  readonly notes: readonly string[];
}

export interface WorldEventDirectorBatchResult {
  readonly evaluatedAt: number;
  readonly results: readonly WorldEventDirectorTickResult[];
  readonly notes: readonly string[];
}

export interface WorldEventRoomPlanMatrixRow {
  readonly roomId: string;
  readonly modeId: string;
  readonly primaryFactionId: string;
  readonly climate: WorldEventPressureBand;
  readonly activeEventCount: number;
  readonly visibleAnnouncementCount: number;
  readonly shadowDirectiveCount: number;
  readonly dominantChannels: readonly ChatLiveOpsChannelId[];
  readonly tags: readonly string[];
}

interface EmissionLedgerRecord {
  readonly roomId: string;
  readonly activationId: string;
  readonly emittedAt: number;
  readonly kind: 'VISIBLE' | 'SHADOW';
}

interface ModeProfile {
  readonly modeId: string;
  readonly preferredChannels: readonly ChatLiveOpsChannelId[];
  readonly climateBias: number;
  readonly witnessBias: number;
  readonly publicnessBias: number;
  readonly shadowBias: number;
  readonly ceremonyBias: number;
  readonly voicePosture: WorldEventVoicePosture;
  readonly styleBias: WorldEventAnnouncementStyle;
  readonly tags: readonly string[];
}

interface FamilyProfile {
  readonly family: GlobalEventFamily;
  readonly pressureBase: number;
  readonly shadowBase: number;
  readonly publicnessBase: number;
  readonly witnessBase: number;
  readonly helperDelta: number;
  readonly style: WorldEventAnnouncementStyle;
  readonly voicePosture: WorldEventVoicePosture;
  readonly priorityBonus: number;
  readonly tags: readonly string[];
}

const DEFAULT_EMISSION_COOLDOWN_MS = 45_000;
const DEFAULT_UPCOMING_HORIZON_MS = 1000 * 60 * 60 * 6;
const DIRECTOR_VERSION = '2026.03.22-liveops-world-event-director-control-plane';

const CHANNEL_ORDER: readonly ChatLiveOpsChannelId[] = freezeArray([
  'GLOBAL',
  'SYNDICATE',
  'DEAL_ROOM',
  'LOBBY',
]);

const SHADOW_CHANNEL_ORDER: readonly WorldEventShadowChannelId[] = freezeArray([
  'LIVEOPS_SHADOW',
  'SYSTEM_SHADOW',
  'NPC_SHADOW',
  'RIVALRY_SHADOW',
  'RESCUE_SHADOW',
]);

const INTENSITY_WEIGHT: Readonly<Record<ChatLiveOpsIntensityBand, number>> = freeze({
  QUIET: 1,
  ACTIVE: 2,
  SEVERE: 3,
  WORLD_CLASS: 4,
});

const ANNOUNCEMENT_STYLE_WEIGHT: Readonly<Record<WorldEventAnnouncementStyle, number>> = freeze({
  SYSTEM_NOTICE: 2,
  BREAKING_WORLD_EVENT: 3,
  WHISPER_LOCK: 3,
  PANIC_BANNER: 4,
  RAID_WARNING: 5,
  SEASONAL_HEADER: 2,
  RIVAL_SPOTLIGHT: 3,
  FACTION_PULSE: 3,
  BLACKOUT_ALERT: 5,
  TRUST_CALL: 3,
});

const MODE_PROFILES: Readonly<Record<string, ModeProfile>> = freeze({
  EMPIRE: freeze({
    modeId: 'EMPIRE',
    preferredChannels: freezeArray(['GLOBAL', 'SYNDICATE', 'LOBBY']),
    climateBias: 1,
    witnessBias: 2,
    publicnessBias: 2,
    shadowBias: 0,
    ceremonyBias: 1,
    voicePosture: 'LOUD',
    styleBias: 'FACTION_PULSE',
    tags: freezeArray(['MODE:EMPIRE', 'CROWN_PRESSURE']),
  }),
  PREDATOR: freeze({
    modeId: 'PREDATOR',
    preferredChannels: freezeArray(['DEAL_ROOM', 'GLOBAL', 'SYNDICATE']),
    climateBias: 3,
    witnessBias: 1,
    publicnessBias: 0,
    shadowBias: 3,
    ceremonyBias: -1,
    voicePosture: 'PREDATORY',
    styleBias: 'RAID_WARNING',
    tags: freezeArray(['MODE:PREDATOR', 'LEVERAGE_CHAMBER']),
  }),
  SYNDICATE: freeze({
    modeId: 'SYNDICATE',
    preferredChannels: freezeArray(['SYNDICATE', 'GLOBAL', 'LOBBY']),
    climateBias: 2,
    witnessBias: 1,
    publicnessBias: 1,
    shadowBias: 2,
    ceremonyBias: 0,
    voicePosture: 'AWARE',
    styleBias: 'TRUST_CALL',
    tags: freezeArray(['MODE:SYNDICATE', 'TRUST_TOPOLOGY']),
  }),
  PHANTOM: freeze({
    modeId: 'PHANTOM',
    preferredChannels: freezeArray(['GLOBAL', 'LOBBY', 'DEAL_ROOM']),
    climateBias: 2,
    witnessBias: 0,
    publicnessBias: -1,
    shadowBias: 4,
    ceremonyBias: 2,
    voicePosture: 'CEREMONIAL',
    styleBias: 'SEASONAL_HEADER',
    tags: freezeArray(['MODE:PHANTOM', 'LEGEND_ECHO']),
  }),
  LOBBY: freeze({
    modeId: 'LOBBY',
    preferredChannels: freezeArray(['LOBBY', 'GLOBAL', 'SYNDICATE']),
    climateBias: 0,
    witnessBias: 1,
    publicnessBias: 2,
    shadowBias: -1,
    ceremonyBias: 0,
    voicePosture: 'AWARE',
    styleBias: 'SYSTEM_NOTICE',
    tags: freezeArray(['MODE:LOBBY', 'STAGING_FIELD']),
  }),
  POST_RUN: freeze({
    modeId: 'POST_RUN',
    preferredChannels: freezeArray(['GLOBAL', 'LOBBY', 'SYNDICATE']),
    climateBias: 0,
    witnessBias: 2,
    publicnessBias: 2,
    shadowBias: 0,
    ceremonyBias: 3,
    voicePosture: 'CEREMONIAL',
    styleBias: 'SEASONAL_HEADER',
    tags: freezeArray(['MODE:POST_RUN', 'AFTERMATH']),
  }),
  UNKNOWN: freeze({
    modeId: 'UNKNOWN',
    preferredChannels: freezeArray(['GLOBAL', 'SYNDICATE', 'LOBBY']),
    climateBias: 1,
    witnessBias: 1,
    publicnessBias: 1,
    shadowBias: 1,
    ceremonyBias: 0,
    voicePosture: 'AWARE',
    styleBias: 'BREAKING_WORLD_EVENT',
    tags: freezeArray(['MODE:UNKNOWN']),
  }),
});

const FAMILY_PROFILES: Readonly<Record<GlobalEventFamily, FamilyProfile>> = freeze({
  SEASON: freeze({
    family: 'SEASON',
    pressureBase: 1,
    shadowBase: 0,
    publicnessBase: 2,
    witnessBase: 1,
    helperDelta: 0,
    style: 'SEASONAL_HEADER',
    voicePosture: 'CEREMONIAL',
    priorityBonus: 4,
    tags: freezeArray(['FAMILY:SEASON', 'WORLD_FRAME']),
  }),
  WORLD_EVENT: freeze({
    family: 'WORLD_EVENT',
    pressureBase: 2,
    shadowBase: 1,
    publicnessBase: 2,
    witnessBase: 2,
    helperDelta: 0,
    style: 'BREAKING_WORLD_EVENT',
    voicePosture: 'LOUD',
    priorityBonus: 5,
    tags: freezeArray(['FAMILY:WORLD_EVENT', 'PUBLIC_NEWS']),
  }),
  HELPER_BLACKOUT: freeze({
    family: 'HELPER_BLACKOUT',
    pressureBase: 4,
    shadowBase: 3,
    publicnessBase: 1,
    witnessBase: 1,
    helperDelta: -5,
    style: 'BLACKOUT_ALERT',
    voicePosture: 'RESTRICTED',
    priorityBonus: 8,
    tags: freezeArray(['FAMILY:HELPER_BLACKOUT', 'SUPPORT_CUT']),
  }),
  CHANNEL_MUTATOR: freeze({
    family: 'CHANNEL_MUTATOR',
    pressureBase: 2,
    shadowBase: 2,
    publicnessBase: 2,
    witnessBase: 0,
    helperDelta: 0,
    style: 'SYSTEM_NOTICE',
    voicePosture: 'AWARE',
    priorityBonus: 4,
    tags: freezeArray(['FAMILY:CHANNEL_MUTATOR', 'ROUTE_SHIFT']),
  }),
  WHISPER_WINDOW: freeze({
    family: 'WHISPER_WINDOW',
    pressureBase: 2,
    shadowBase: 3,
    publicnessBase: -1,
    witnessBase: 0,
    helperDelta: 0,
    style: 'WHISPER_LOCK',
    voicePosture: 'RESTRICTED',
    priorityBonus: 5,
    tags: freezeArray(['FAMILY:WHISPER_WINDOW', 'PRIVATE_HEAT']),
  }),
  FACTION_SURGE: freeze({
    family: 'FACTION_SURGE',
    pressureBase: 3,
    shadowBase: 2,
    publicnessBase: 1,
    witnessBase: 2,
    helperDelta: 0,
    style: 'FACTION_PULSE',
    voicePosture: 'LOUD',
    priorityBonus: 6,
    tags: freezeArray(['FAMILY:FACTION_SURGE', 'BLOC_SHIFT']),
  }),
  COORDINATED_RAID: freeze({
    family: 'COORDINATED_RAID',
    pressureBase: 5,
    shadowBase: 3,
    publicnessBase: 2,
    witnessBase: 3,
    helperDelta: -1,
    style: 'RAID_WARNING',
    voicePosture: 'PREDATORY',
    priorityBonus: 10,
    tags: freezeArray(['FAMILY:COORDINATED_RAID', 'FASTLANE']),
  }),
  RIVAL_SPOTLIGHT: freeze({
    family: 'RIVAL_SPOTLIGHT',
    pressureBase: 3,
    shadowBase: 2,
    publicnessBase: 1,
    witnessBase: 2,
    helperDelta: 0,
    style: 'RIVAL_SPOTLIGHT',
    voicePosture: 'LOUD',
    priorityBonus: 6,
    tags: freezeArray(['FAMILY:RIVAL_SPOTLIGHT', 'NAME_LOCK']),
  }),
});

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function safeNumber(input: number | null | undefined, fallback = 0): number {
  return Number.isFinite(input) ? Number(input) : fallback;
}

function systemNow(): number {
  return Date.now();
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

function maxIntensityWeight(events: readonly GlobalEventProjection[]): number {
  if (events.length === 0) {
    return 0;
  }
  return Math.max(...events.map((event) => INTENSITY_WEIGHT[event.intensity]));
}

function resolveModeId(room: GlobalEventSchedulerRoomContext): string {
  const raw = `${room.mode ?? room.mountTarget ?? 'UNKNOWN'}`.toUpperCase();
  if (raw.includes('EMPIRE')) {
    return 'EMPIRE';
  }
  if (raw.includes('PREDATOR') || raw.includes('DEAL_ROOM')) {
    return 'PREDATOR';
  }
  if (raw.includes('SYNDICATE')) {
    return 'SYNDICATE';
  }
  if (raw.includes('PHANTOM')) {
    return 'PHANTOM';
  }
  if (raw.includes('POST')) {
    return 'POST_RUN';
  }
  if (raw.includes('LOBBY')) {
    return 'LOBBY';
  }
  return 'UNKNOWN';
}

function resolveModeProfile(room: GlobalEventSchedulerRoomContext): ModeProfile {
  return MODE_PROFILES[resolveModeId(room)] ?? MODE_PROFILES.UNKNOWN;
}

function familyProfile(event: GlobalEventProjection): FamilyProfile {
  return FAMILY_PROFILES[event.family];
}

function eventPriorityBase(event: GlobalEventProjection): number {
  const channelPeak = Math.max(...CHANNEL_ORDER.map((channel) => safeNumber(event.channelPriority[channel], 0)));
  return channelPeak + familyProfile(event).priorityBonus + INTENSITY_WEIGHT[event.intensity];
}

function eventAnnouncementStyle(event: GlobalEventProjection, room: GlobalEventSchedulerRoomContext): WorldEventAnnouncementStyle {
  const modeProfile = resolveModeProfile(room);
  if (event.family === 'SEASON' && event.tags.includes('CEREMONIAL')) {
    return 'SEASONAL_HEADER';
  }
  if (event.family === 'HELPER_BLACKOUT') {
    return 'BLACKOUT_ALERT';
  }
  if (event.family === 'COORDINATED_RAID') {
    return 'RAID_WARNING';
  }
  if (event.family === 'RIVAL_SPOTLIGHT') {
    return 'RIVAL_SPOTLIGHT';
  }
  if (event.tags.includes('WHISPER_ONLY')) {
    return 'WHISPER_LOCK';
  }
  return familyProfile(event).style ?? modeProfile.styleBias;
}

function sortAnnouncements(
  directives: readonly WorldEventAnnouncementDirective[],
): readonly WorldEventAnnouncementDirective[] {
  return freezeArray(
    [...directives].sort((left, right) => right.priority - left.priority || left.startsAt - right.startsAt),
  );
}

function sortVisibleChannels(
  directives: readonly WorldEventVisibleChannelDirective[],
): readonly WorldEventVisibleChannelDirective[] {
  return freezeArray(
    [...directives].sort((left, right) => {
      const priorityDelta = right.pressureDelta - left.pressureDelta;
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return CHANNEL_ORDER.indexOf(left.channelId) - CHANNEL_ORDER.indexOf(right.channelId);
    }),
  );
}

function sortShadowDirectives(
  directives: readonly WorldEventShadowDirective[],
): readonly WorldEventShadowDirective[] {
  return freezeArray(
    [...directives].sort((left, right) => {
      const queueDelta = right.queuePriority - left.queuePriority;
      if (queueDelta !== 0) {
        return queueDelta;
      }
      return SHADOW_CHANNEL_ORDER.indexOf(left.shadowChannelId) - SHADOW_CHANNEL_ORDER.indexOf(right.shadowChannelId);
    }),
  );
}

function toPressureBand(score: number, modeProfile: ModeProfile, ceremonyWeight: number): WorldEventPressureBand {
  const total = score + modeProfile.climateBias + ceremonyWeight;
  if (total >= 18) {
    return 'WORLD_CLASS';
  }
  if (total >= 13) {
    return 'PREDATORY';
  }
  if (total >= 9) {
    return 'HOSTILE';
  }
  if (total >= 5) {
    return 'TENSE';
  }
  if (modeProfile.voicePosture === 'CEREMONIAL') {
    return 'CEREMONIAL';
  }
  return 'CALM';
}

function dominantChannelsFromSurge(
  surge: FactionSurgePlan,
  modeProfile: ModeProfile,
): readonly ChatLiveOpsChannelId[] {
  const ranked = [...surge.channelDirectives]
    .sort((left, right) => {
      const leftScore = left.crowdHeatDelta + left.interruptionPressureDelta + left.shadowPressureDelta;
      const rightScore = right.crowdHeatDelta + right.interruptionPressureDelta + right.shadowPressureDelta;
      return rightScore - leftScore;
    })
    .map((directive) => directive.channelId);

  const merged = uniqueStrings([...ranked, ...modeProfile.preferredChannels]);
  return freezeArray(merged.slice(0, 4) as ChatLiveOpsChannelId[]);
}

function quietestChannelFromSurge(surge: FactionSurgePlan): ChatLiveOpsChannelId | null {
  if (surge.channelDirectives.length === 0) {
    return null;
  }
  const sorted = [...surge.channelDirectives].sort((left, right) => {
    const leftScore = left.crowdHeatDelta + left.witnessCountDelta + left.publicnessDelta;
    const rightScore = right.crowdHeatDelta + right.witnessCountDelta + right.publicnessDelta;
    return leftScore - rightScore;
  });
  return sorted[0]?.channelId ?? null;
}

function loudestChannelFromSurge(surge: FactionSurgePlan): ChatLiveOpsChannelId | null {
  if (surge.channelDirectives.length === 0) {
    return null;
  }
  const sorted = [...surge.channelDirectives].sort((left, right) => {
    const leftScore = left.crowdHeatDelta + left.witnessCountDelta + left.publicnessDelta;
    const rightScore = right.crowdHeatDelta + right.witnessCountDelta + right.publicnessDelta;
    return rightScore - leftScore;
  });
  return sorted[0]?.channelId ?? null;
}

function overlayForEvents(
  room: GlobalEventSchedulerRoomContext,
  snapshot: ChatLiveOpsOverlaySnapshot,
  activeEvents: readonly GlobalEventProjection[],
): WorldEventOverlayDirective {
  const overlays = snapshot.activeOverlays.filter((overlay) =>
    activeEvents.some((event) => event.activationId === overlay.overlayId),
  );
  return freeze({
    roomId: room.roomId,
    overlays: freezeArray(overlays),
    primaryOverlayId: overlays[0]?.overlayId ?? null,
  });
}

function baseVisibleChannels(
  room: GlobalEventSchedulerRoomContext,
  event: GlobalEventProjection,
): readonly ChatLiveOpsChannelId[] {
  const modeProfile = resolveModeProfile(room);
  const fromEvent = event.channels.filter((channel) => {
    if (channel === 'LOBBY' && resolveModeId(room) !== 'LOBBY') {
      return false;
    }
    return true;
  });
  const merged = uniqueStrings([...fromEvent, ...modeProfile.preferredChannels.filter((channel) => fromEvent.includes(channel))]);
  return freezeArray(merged as ChatLiveOpsChannelId[]);
}

function eventSuppressedForRoom(
  room: GlobalEventSchedulerRoomContext,
  event: GlobalEventProjection,
): boolean {
  if (event.tags.includes('LOW_SHIELD_HUNT') && safeNumber(room.lowShieldPlayerCount, 0) <= 0) {
    return true;
  }
  if (event.tags.includes('SYNDICATE_PANIC') && resolveModeId(room) === 'LOBBY') {
    return true;
  }
  return false;
}

function coerceDisposition(
  event: GlobalEventProjection,
  eligibleChannels: readonly ChatLiveOpsChannelId[],
): WorldEventEmissionDisposition {
  if (event.visibility === 'SHADOW_ONLY') {
    return 'SHADOW_ONLY';
  }
  if (event.visibility === 'VISIBLE' && eligibleChannels.length === 0) {
    return 'SUPPRESSED';
  }
  if (event.visibility === 'VISIBLE') {
    return 'VISIBLE_ONLY';
  }
  if (eligibleChannels.length === 0) {
    return 'SHADOW_ONLY';
  }
  return 'READY';
}

function visibilityAllowsAnnouncements(event: GlobalEventProjection): boolean {
  return event.visibility !== 'SHADOW_ONLY';
}

function computeVisiblePressure(
  activeEvents: readonly GlobalEventProjection[],
  surge: FactionSurgePlan,
  room: GlobalEventSchedulerRoomContext,
): number {
  const modeProfile = resolveModeProfile(room);
  const eventSum = activeEvents.reduce((sum, event) => {
    const profile = familyProfile(event);
    return sum + profile.pressureBase + profile.publicnessBase + INTENSITY_WEIGHT[event.intensity];
  }, 0);
  return eventSum + surge.witnessPressureDelta + surge.publicnessBiasDelta + modeProfile.publicnessBias;
}

function computeShadowPressure(
  activeEvents: readonly GlobalEventProjection[],
  surge: FactionSurgePlan,
  room: GlobalEventSchedulerRoomContext,
): number {
  const modeProfile = resolveModeProfile(room);
  const eventSum = activeEvents.reduce((sum, event) => {
    const profile = familyProfile(event);
    return sum + profile.shadowBase + INTENSITY_WEIGHT[event.intensity];
  }, 0);
  return eventSum + surge.shadowPressureDelta + modeProfile.shadowBias;
}

function computeCeremonyWeight(
  activeEvents: readonly GlobalEventProjection[],
  room: GlobalEventSchedulerRoomContext,
): number {
  const modeProfile = resolveModeProfile(room);
  const ceremonyEventWeight = activeEvents.reduce((sum, event) => {
    if (event.family === 'SEASON') {
      return sum + 2;
    }
    if (event.tags.includes('CEREMONIAL')) {
      return sum + 1;
    }
    return sum;
  }, 0);
  return ceremonyEventWeight + modeProfile.ceremonyBias;
}

function describeEventCompact(event: GlobalEventProjection): string {
  return `${event.eventId}:${event.family}:${event.intensity}:${event.visibility}`;
}

function buildControlTags(
  room: GlobalEventSchedulerRoomContext,
  activeEvents: readonly GlobalEventProjection[],
  surge: FactionSurgePlan,
): readonly string[] {
  const modeProfile = resolveModeProfile(room);
  return freezeArray(uniqueStrings([
    ...modeProfile.tags,
    ...(room.tags ?? []),
    ...activeEvents.flatMap((event) => event.tags),
    ...surge.recommendedTags,
    `ROOM:${room.roomId}`,
    `MODE:${resolveModeId(room)}`,
    `PRIMARY_FACTION:${surge.primaryFactionId}`,
    surge.helperBlackoutActive ? 'HELPER_BLACKOUT_ACTIVE' : 'HELPER_SUPPORT_AVAILABLE',
    surge.coordinatedRaidActive ? 'COORDINATED_RAID_ACTIVE' : 'RAID_IDLE',
  ]));
}

function buildCallouts(
  room: GlobalEventSchedulerRoomContext,
  activeEvents: readonly GlobalEventProjection[],
  surge: FactionSurgePlan,
): readonly string[] {
  const callouts: string[] = [];
  if (surge.helperBlackoutActive) {
    callouts.push('Helpers are muted or constrained across active pressure lanes.');
  }
  if (surge.coordinatedRaidActive) {
    callouts.push('Raid cadence is elevated and rivalry pressure is moving faster than normal.');
  }
  if (safeNumber(room.lowShieldPlayerCount, 0) > 0) {
    callouts.push('Low-shield players are turning the room into a witness-sensitive target field.');
  }
  if (activeEvents.some((event) => event.family === 'WHISPER_WINDOW')) {
    callouts.push('Whisper law is compressing publicness and pushing meaning into hidden lanes.');
  }
  if (activeEvents.some((event) => event.family === 'RIVAL_SPOTLIGHT')) {
    callouts.push('A rival focus window is narrowing the room’s attention around named conflict.');
  }
  if (callouts.length === 0) {
    callouts.push('World pressure is present but not yet overwhelming this room.');
  }
  return freezeArray(callouts);
}

function visibleDecision(
  room: GlobalEventSchedulerRoomContext,
  event: GlobalEventProjection,
  channels: readonly ChatLiveOpsChannelId[],
  allowed: boolean,
  inCooldown: boolean,
): WorldEventEmissionDecision {
  const disposition: WorldEventEmissionDisposition = !visibilityAllowsAnnouncements(event)
    ? 'SHADOW_ONLY'
    : !allowed
      ? 'SUPPRESSED'
      : inCooldown
        ? 'COOLDOWN'
        : 'READY';
  return freeze({
    activationId: event.activationId,
    eventId: event.eventId,
    kind: 'VISIBLE',
    disposition,
    reason: disposition === 'READY'
      ? 'Eligible for visible emission.'
      : disposition === 'COOLDOWN'
        ? 'Visible emission cooling down.'
        : disposition === 'SHADOW_ONLY'
          ? 'Event visibility forbids visible emission.'
          : 'Visible emission suppressed for this room.',
    eligibleChannels: freezeArray(channels),
    priority: eventPriorityBase(event),
    tags: freezeArray(uniqueStrings([...event.tags, `VISIBLE_DECISION:${disposition}`])),
  });
}

function shadowDecision(
  event: GlobalEventProjection,
  inCooldown: boolean,
): WorldEventEmissionDecision {
  const disposition: WorldEventEmissionDisposition = inCooldown ? 'COOLDOWN' : 'READY';
  return freeze({
    activationId: event.activationId,
    eventId: event.eventId,
    kind: 'SHADOW',
    disposition,
    reason: disposition === 'READY' ? 'Shadow emission path is active.' : 'Shadow emission cooling down.',
    eligibleChannels: freezeArray(event.channels),
    priority: eventPriorityBase(event),
    tags: freezeArray(uniqueStrings([...event.tags, `SHADOW_DECISION:${disposition}`])),
  });
}

function buildSummaryLinesForRoomPlan(
  room: GlobalEventSchedulerRoomContext,
  activeEvents: readonly GlobalEventProjection[],
  climate: WorldEventRoomClimate,
  surge: FactionSurgePlan,
): readonly string[] {
  return freezeArray([
    `mode:${resolveModeId(room)}`,
    `primary:${surge.primaryFactionId}`,
    `events:${activeEvents.length}`,
    `visible-pressure:${climate.visiblePressure}`,
    `shadow-pressure:${climate.shadowPressure}`,
    `witness:${climate.witnessPressure}`,
    `helpers:${climate.helperAvailabilityBias}`,
    `voice:${climate.voicePosture}`,
  ]);
}


export class WorldEventDirector {
  private readonly scheduler: GlobalEventScheduler;
  private readonly schedulerInspector: GlobalEventSchedulerInspector;
  private readonly factionPlanner: FactionSurgePlanner;
  private readonly upcomingHorizonMs: number;
  private readonly emissionCooldownMs: number;
  private readonly nowProvider: () => number;
  private readonly enableSchedulerCloneOnInspect: boolean;
  private readonly emissionLedger = new Map<string, EmissionLedgerRecord>();

  public constructor(options: WorldEventDirectorOptions = {}) {
    this.scheduler = options.scheduler ?? createGlobalEventScheduler(options.schedulerOptions ?? {});
    this.schedulerInspector = createGlobalEventSchedulerInspector(this.scheduler);
    this.factionPlanner = options.factionPlanner ?? createFactionSurgePlanner();
    this.upcomingHorizonMs = options.upcomingHorizonMs ?? DEFAULT_UPCOMING_HORIZON_MS;
    this.emissionCooldownMs = options.emissionCooldownMs ?? DEFAULT_EMISSION_COOLDOWN_MS;
    this.nowProvider = options.nowProvider ?? systemNow;
    this.enableSchedulerCloneOnInspect = options.enableSchedulerCloneOnInspect ?? true;
  }

  public getScheduler(): GlobalEventScheduler {
    return this.scheduler;
  }

  public getSchedulerInspector(): GlobalEventSchedulerInspector {
    return this.schedulerInspector;
  }

  public getFactionPlanner(): FactionSurgePlanner {
    return this.factionPlanner;
  }

  public registerMany(definitions: readonly GlobalEventDefinition[]): void {
    this.scheduler.registerMany(definitions);
  }

  public registerDefinition(definition: GlobalEventDefinition): void {
    this.scheduler.registerDefinition(definition);
  }

  public removeDefinition(eventId: string): boolean {
    return this.scheduler.removeDefinition(eventId);
  }

  public listDefinitions(): readonly GlobalEventDefinition[] {
    return this.scheduler.listDefinitions();
  }

  public getDefinition(eventId: string): GlobalEventDefinition | null {
    return this.scheduler.getDefinition(eventId);
  }

  public forceActivate(input: ForceActivationInput) {
    return this.scheduler.forceActivate(input);
  }

  public cancelActivation(activationId: string): boolean {
    return this.scheduler.cancelActivation(activationId);
  }

  public previewDefinitionWindows(
    eventId: string,
    input: PreviewWindowsInput = {},
  ): readonly GlobalEventWindowPreview[] {
    return this.schedulerInspector.previewDefinitionWindows(eventId, input);
  }

  public previewLibraryWindows(
    input: PreviewWindowsInput = {},
  ): readonly GlobalEventWindowPreview[] {
    return this.schedulerInspector.previewLibraryWindows(input);
  }

  public auditDefinition(eventId: string): GlobalEventDefinitionAudit | null {
    return this.schedulerInspector.auditDefinition(eventId);
  }

  public auditLibrary(): readonly GlobalEventDefinitionAudit[] {
    return this.schedulerInspector.auditLibrary();
  }

  public buildManifest(): WorldEventDirectorManifest {
    const schedulerManifest = this.schedulerInspector.buildManifest();
    const definitions = this.scheduler.listDefinitions();
    const visibleFamilies = freezeArray(uniqueStrings(
      definitions.filter((definition) => definition.visibility !== 'SHADOW_ONLY').map((definition) => definition.family),
    ) as GlobalEventFamily[]);
    const shadowFamilies = freezeArray(uniqueStrings(
      definitions.filter((definition) => definition.visibility !== 'VISIBLE').map((definition) => definition.family),
    ) as GlobalEventFamily[]);
    return freeze({
      builtAt: this.nowProvider(),
      scheduler: schedulerManifest,
      definitionIds: freezeArray(definitions.map((definition) => definition.eventId)),
      familyIds: freezeArray(uniqueStrings(definitions.map((definition) => definition.family)) as GlobalEventFamily[]),
      visibleFamilies,
      shadowFamilies,
      notes: freezeArray([
        `DEFINITION_COUNT:${definitions.length}`,
        `VISIBLE_FAMILY_COUNT:${visibleFamilies.length}`,
        `SHADOW_FAMILY_COUNT:${shadowFamilies.length}`,
      ]),
    });
  }

  public diffManifest(
    manifest: WorldEventDirectorManifest,
  ): WorldEventDirectorLibraryDiff {
    const schedulerDiff = this.schedulerInspector.diffManifest(manifest.scheduler);
    return freeze({
      comparedAt: this.nowProvider(),
      scheduler: schedulerDiff,
      changedDefinitionIds: freezeArray(uniqueStrings([
        ...schedulerDiff.added,
        ...schedulerDiff.removed,
        ...schedulerDiff.changed.map((entry) => entry.eventId),
      ])),
      notes: freezeArray([
        `ADDED:${schedulerDiff.added.length}`,
        `REMOVED:${schedulerDiff.removed.length}`,
        `CHANGED:${schedulerDiff.changed.length}`,
      ]),
    });
  }

  public listChannelLoads(
    context: GlobalEventSchedulerEvaluationContext = {},
  ): readonly GlobalEventChannelLoad[] {
    return this.schedulerInspector.listChannelLoads(context);
  }

  public listFamilyLoads(
    context: GlobalEventSchedulerEvaluationContext = {},
  ): readonly GlobalEventFamilyLoad[] {
    return this.schedulerInspector.listFamilyLoads(context);
  }

  public buildTimeline(
    context: GlobalEventSchedulerEvaluationContext = {},
  ): readonly GlobalEventTimelineSlice[] {
    return this.schedulerInspector.buildTimeline(context);
  }

  public buildSchedulerRoomMatrix(
    context: GlobalEventSchedulerEvaluationContext = {},
  ): readonly GlobalEventRoomProjectionMatrixRow[] {
    return this.schedulerInspector.buildRoomMatrix(context);
  }

  public listActivationDigests(): readonly GlobalEventActivationDigest[] {
    return this.schedulerInspector.listActivationDigests();
  }

  public tick(
    context: GlobalEventSchedulerEvaluationContext = {},
  ): WorldEventDirectorTickResult {
    const now = context.now ?? this.nowProvider();
    const scheduler = this.scheduler.evaluate({
      ...context,
      now,
    });
    const roomPlans = this.planRooms(context.rooms ?? [], scheduler, now);

    this.pruneEmissionLedger(now);

    return freeze({
      evaluatedAt: now,
      scheduler,
      roomPlans,
    });
  }

  public tickDetailed(
    context: GlobalEventSchedulerEvaluationContext = {},
  ): WorldEventDirectorDetailedTickResult {
    const now = context.now ?? this.nowProvider();
    const schedulerDetailed = this.schedulerInspector.snapshotDetailed({
      ...context,
      now,
    });
    const roomPlansDetailed = freezeArray(
      (context.rooms ?? []).map((room) => this.planRoomDetailed(room, schedulerDetailed, now)),
    );
    this.pruneEmissionLedger(now);

    return freeze({
      evaluatedAt: now,
      scheduler: schedulerDetailed,
      schedulerDetailed,
      roomPlans: roomPlansDetailed,
      roomPlansDetailed,
      channelLoads: schedulerDetailed.detailedDiagnostics.channelLoads,
      familyLoads: schedulerDetailed.detailedDiagnostics.familyLoads,
      timeline: schedulerDetailed.timeline,
      roomMatrix: schedulerDetailed.roomMatrix,
      activationDigests: schedulerDetailed.detailedDiagnostics.activationDigests,
      notes: freezeArray([
        `ROOM_COUNT:${roomPlansDetailed.length}`,
        `ACTIVE_EVENTS:${schedulerDetailed.activeProjections.length}`,
        `UPCOMING_EVENTS:${schedulerDetailed.upcomingProjections.length}`,
      ]),
    });
  }

  public tickBatch(
    contexts: readonly GlobalEventSchedulerEvaluationContext[],
  ): WorldEventDirectorBatchResult {
    const evaluatedAt = this.nowProvider();
    const results = contexts.map((context) => this.tick({
      ...context,
      now: context.now ?? evaluatedAt,
    }));
    return freeze({
      evaluatedAt,
      results: freezeArray(results),
      notes: freezeArray([
        `BATCH_COUNT:${results.length}`,
      ]),
    });
  }

  public planRooms(
    rooms: readonly GlobalEventSchedulerRoomContext[],
    scheduler: GlobalEventSchedulerSnapshot,
    now = this.nowProvider(),
  ): readonly WorldEventRoomPlan[] {
    return freezeArray(rooms.map((room) => this.planRoom(room, scheduler, now)));
  }

  public planRoom(
    room: GlobalEventSchedulerRoomContext,
    scheduler: GlobalEventSchedulerSnapshot,
    now: number = this.nowProvider(),
  ): WorldEventRoomPlan {
    const activeEvents = this.filterEventsForRoom(room, scheduler.activeProjections);
    const factionSurge = this.factionPlanner.plan(room, activeEvents);
    const overlay = overlayForEvents(room, scheduler.overlays, activeEvents);
    const visibleChannels = this.buildVisibleChannelDirectives(room, activeEvents, factionSurge, now);
    const roomClimate = this.buildRoomClimate(room, activeEvents, factionSurge, visibleChannels);
    const narrative = this.buildNarrativePacket(room, activeEvents, factionSurge, roomClimate, visibleChannels);
    const visibleAnnouncements = this.buildVisibleAnnouncements(room, activeEvents, factionSurge, now);
    const shadowDirectives = this.buildShadowDirectives(room, activeEvents, factionSurge, roomClimate, now);
    const summary = this.buildSummary(room, activeEvents, factionSurge, roomClimate, visibleAnnouncements, shadowDirectives);
    const notes = freezeArray(uniqueStrings([
      `ROOM:${room.roomId}`,
      `ACTIVE_EVENTS:${activeEvents.length}`,
      `PRIMARY_FACTION:${factionSurge.primaryFactionId}`,
      `HELPER_BLACKOUT:${String(factionSurge.helperBlackoutActive)}`,
      `RAID_ACTIVE:${String(factionSurge.coordinatedRaidActive)}`,
      ...buildSummaryLinesForRoomPlan(room, activeEvents, roomClimate, factionSurge),
    ]));

    return freeze({
      roomId: room.roomId,
      schedulerProjectionIds: freezeArray(activeEvents.map((event) => event.activationId)),
      activeEvents,
      factionSurge,
      overlay,
      visibleChannels,
      roomClimate,
      narrative,
      visibleAnnouncements,
      shadowDirectives,
      summary,
      notes,
    });
  }

  public planRoomDetailed(
    room: GlobalEventSchedulerRoomContext,
    scheduler: GlobalEventSchedulerSnapshot,
    now: number = this.nowProvider(),
  ): WorldEventRoomPlanDetailed {
    const base = this.planRoom(room, scheduler, now);
    const diagnostics = this.buildDiagnostics(room, base.activeEvents, base.factionSurge, now);

    return freeze({
      ...base,
      diagnostics,
    });
  }

  public buildRoomPlanMatrix(
    context: GlobalEventSchedulerEvaluationContext = {},
  ): readonly WorldEventRoomPlanMatrixRow[] {
    const tick = this.tick(context);
    return freezeArray(tick.roomPlans.map((plan) => freeze({
      roomId: plan.roomId,
      modeId: plan.roomClimate.modeId,
      primaryFactionId: plan.factionSurge.primaryFactionId,
      climate: plan.roomClimate.pressureBand,
      activeEventCount: plan.activeEvents.length,
      visibleAnnouncementCount: plan.visibleAnnouncements.length,
      shadowDirectiveCount: plan.shadowDirectives.length,
      dominantChannels: plan.roomClimate.dominantChannels,
      tags: plan.roomClimate.tags,
    })));
  }

  public summarizeRoomPlan(plan: WorldEventRoomPlan): WorldEventRoomPlanSummary {
    return plan.summary;
  }

  public describeRoomPlan(plan: WorldEventRoomPlan): readonly string[] {
    return freezeArray([
      `${plan.summary.primaryFactionId} controls ${plan.roomId}`,
      `climate:${plan.roomClimate.pressureBand}`,
      `events:${plan.activeEvents.length}`,
      `visible:${plan.visibleAnnouncements.length}`,
      `shadow:${plan.shadowDirectives.length}`,
      ...plan.summary.summaryLines,
    ]);
  }

  public buildNarrative(plan: WorldEventRoomPlan): WorldEventNarrativePacket {
    return plan.narrative;
  }

  public rankFactionsForRoom(
    room: GlobalEventSchedulerRoomContext,
    scheduler: GlobalEventSchedulerSnapshot,
  ): readonly FactionScoredDescriptor[] {
    return this.factionPlanner.rankFactions(room, this.filterEventsForRoom(room, scheduler.activeProjections));
  }

  public serialize(): WorldEventDirectorState {
    return freeze({
      version: DIRECTOR_VERSION,
      emissionLedger: freezeArray(
        [...this.emissionLedger.values()].sort((left, right) => left.emittedAt - right.emittedAt),
      ),
      scheduler: this.scheduler.serialize(),
    });
  }

  public hydrate(state: WorldEventDirectorState): void {
    this.emissionLedger.clear();
    for (const record of state.emissionLedger) {
      this.emissionLedger.set(this.emissionKey(record.roomId, record.activationId, record.kind), record);
    }
    this.scheduler.hydrate(state.scheduler);
  }

  public reset(): void {
    this.emissionLedger.clear();
  }

  public cloneDirector(): WorldEventDirector {
    const scheduler = this.enableSchedulerCloneOnInspect
      ? this.schedulerInspector.cloneScheduler()
      : createGlobalEventScheduler({
          definitionVersion: this.scheduler.serialize().version,
          seedDefinitions: this.scheduler.serialize().definitions,
        });

    if (!this.enableSchedulerCloneOnInspect) {
      scheduler.hydrate(this.scheduler.serialize());
    }

    const clone = createWorldEventDirector({
      scheduler,
      factionPlanner: this.factionPlanner,
      upcomingHorizonMs: this.upcomingHorizonMs,
      emissionCooldownMs: this.emissionCooldownMs,
      nowProvider: this.nowProvider,
      enableSchedulerCloneOnInspect: this.enableSchedulerCloneOnInspect,
    });
    clone.hydrate(this.serialize());
    return clone;
  }

  public buildFactionBatch(
    context: GlobalEventSchedulerEvaluationContext = {},
  ): FactionPlanBatchResult {
    const scheduler = this.scheduler.evaluate(context);
    const rooms = context.rooms ?? [];
    const byRoomId: Record<string, readonly GlobalEventProjection[]> = {};
    for (const room of rooms) {
      byRoomId[room.roomId] = this.filterEventsForRoom(room, scheduler.activeProjections);
    }
    return this.factionPlanner.planBatch(rooms, byRoomId, context.now ?? this.nowProvider());
  }

  private filterEventsForRoom(
    room: GlobalEventSchedulerRoomContext,
    activeEvents: readonly GlobalEventProjection[],
  ): readonly GlobalEventProjection[] {
    return freezeArray(activeEvents.filter((event) => !eventSuppressedForRoom(room, event)));
  }

  private buildVisibleChannelDirectives(
    room: GlobalEventSchedulerRoomContext,
    activeEvents: readonly GlobalEventProjection[],
    factionSurge: FactionSurgePlan,
    now: number,
  ): readonly WorldEventVisibleChannelDirective[] {
    const modeProfile = resolveModeProfile(room);
    const channelMap = new Map<ChatLiveOpsChannelId, WorldEventVisibleChannelDirective>();

    for (const directive of factionSurge.channelDirectives) {
      const climate = toPressureBand(
        directive.crowdHeatDelta + directive.interruptionPressureDelta + directive.shadowPressureDelta,
        modeProfile,
        activeEvents.filter((event) => event.family === 'SEASON').length,
      );
      const inCooldown = activeEvents.some((event) => !this.shouldEmit(room.roomId, event.activationId, 'VISIBLE', now));
      const eligibleChannels = directive.channelId === 'LOBBY' && resolveModeId(room) !== 'LOBBY'
        ? freezeArray([] as ChatLiveOpsChannelId[])
        : freezeArray([directive.channelId]);
      channelMap.set(directive.channelId, freeze({
        directiveId: `${room.roomId}::${directive.channelId}::VISIBLE_CHANNEL`,
        roomId: room.roomId,
        channelId: directive.channelId,
        dominantFactionId: directive.dominantFactionId,
        climate,
        emissionDisposition: eligibleChannels.length === 0
          ? 'SUPPRESSED'
          : inCooldown
            ? 'COOLDOWN'
            : 'READY',
        pressureDelta: directive.crowdHeatDelta + directive.interruptionPressureDelta + Math.max(0, factionSurge.pressureBiasDelta),
        witnessDelta: directive.witnessCountDelta,
        publicnessDelta: directive.publicnessDelta,
        helperAvailabilityDelta: directive.helperAvailabilityDelta,
        announcementStyle: modeProfile.styleBias,
        secondaryFactionIds: directive.secondaryFactionIds,
        tags: freezeArray(uniqueStrings([
          ...directive.styleTags,
          ...modeProfile.tags,
          `DOMINANT_FACTION:${directive.dominantFactionId}`,
        ])),
        notes: freezeArray([
          ...directive.notes,
          `CHANNEL:${directive.channelId}`,
          `EMISSION:${eligibleChannels.length === 0 ? 'SUPPRESSED' : inCooldown ? 'COOLDOWN' : 'READY'}`,
        ]),
      }));
    }

    for (const channel of modeProfile.preferredChannels) {
      if (!channelMap.has(channel)) {
        channelMap.set(channel, freeze({
          directiveId: `${room.roomId}::${channel}::VISIBLE_CHANNEL`,
          roomId: room.roomId,
          channelId: channel,
          dominantFactionId: factionSurge.primaryFactionId,
          climate: toPressureBand(maxIntensityWeight(activeEvents), modeProfile, 0),
          emissionDisposition: channel === 'LOBBY' && resolveModeId(room) !== 'LOBBY'
            ? 'SUPPRESSED'
            : 'READY',
          pressureDelta: Math.max(0, factionSurge.witnessPressureDelta + factionSurge.publicnessBiasDelta),
          witnessDelta: factionSurge.witnessPressureDelta,
          publicnessDelta: factionSurge.publicnessBiasDelta,
          helperAvailabilityDelta: factionSurge.helperAvailabilityDelta,
          announcementStyle: modeProfile.styleBias,
          secondaryFactionIds: factionSurge.secondaryFactions.map((entry) => entry.factionId),
          tags: freezeArray(uniqueStrings([
            ...modeProfile.tags,
            ...factionSurge.recommendedTags,
            `CHANNEL:${channel}`,
          ])),
          notes: freezeArray([
            'Mode-preferred visible channel inserted by director.',
          ]),
        }));
      }
    }

    return sortVisibleChannels([...channelMap.values()]);
  }

  private buildRoomClimate(
    room: GlobalEventSchedulerRoomContext,
    activeEvents: readonly GlobalEventProjection[],
    factionSurge: FactionSurgePlan,
    visibleChannels: readonly WorldEventVisibleChannelDirective[],
  ): WorldEventRoomClimate {
    const modeProfile = resolveModeProfile(room);
    const visiblePressure = computeVisiblePressure(activeEvents, factionSurge, room);
    const shadowPressure = computeShadowPressure(activeEvents, factionSurge, room);
    const witnessPressure = factionSurge.witnessPressureDelta + safeNumber(room.crowdHeat, 0);
    const interruptionBias = factionSurge.channelDirectives.reduce(
      (sum, directive) => sum + directive.interruptionPressureDelta,
      0,
    );
    const publicnessBias = factionSurge.publicnessBiasDelta + modeProfile.publicnessBias;
    const ceremonyWeight = computeCeremonyWeight(activeEvents, room);
    const pressureBand = toPressureBand(
      visiblePressure + shadowPressure + Math.round(witnessPressure / 25),
      modeProfile,
      ceremonyWeight,
    );
    const dominantChannels = visibleChannels.length > 0
      ? freezeArray(visibleChannels.map((directive) => directive.channelId))
      : dominantChannelsFromSurge(factionSurge, modeProfile);

    return freeze({
      roomId: room.roomId,
      modeId: resolveModeId(room),
      pressureBand,
      visiblePressure,
      shadowPressure,
      witnessPressure,
      helperAvailabilityBias: factionSurge.helperAvailabilityDelta,
      interruptionBias,
      publicnessBias,
      raidCadenceDeltaMs: factionSurge.raidCadenceDeltaMs,
      voicePosture: pressureBand === 'WORLD_CLASS'
        ? 'LOUD'
        : factionSurge.helperBlackoutActive
          ? 'RESTRICTED'
          : factionSurge.coordinatedRaidActive
            ? 'PREDATORY'
            : modeProfile.voicePosture,
      dominantChannels,
      tags: buildControlTags(room, activeEvents, factionSurge),
      notes: freezeArray([
        `PRESSURE_BAND:${pressureBand}`,
        `VISIBLE_PRESSURE:${visiblePressure}`,
        `SHADOW_PRESSURE:${shadowPressure}`,
        `WITNESS_PRESSURE:${witnessPressure}`,
        `PUBLICNESS:${publicnessBias}`,
      ]),
    });
  }

  private buildNarrativePacket(
    room: GlobalEventSchedulerRoomContext,
    activeEvents: readonly GlobalEventProjection[],
    factionSurge: FactionSurgePlan,
    roomClimate: WorldEventRoomClimate,
    visibleChannels: readonly WorldEventVisibleChannelDirective[],
  ): WorldEventNarrativePacket {
    const factionNarrative: FactionSurgeNarrativePacket = this.factionPlanner.buildNarrativePacket(factionSurge);
    const headline = activeEvents[0]?.headline
      ?? factionNarrative.headline
      ?? `${factionSurge.primaryFactionId} is shaping ${room.roomId}`;
    const summaryLines = freezeArray(uniqueStrings([
      ...activeEvents.flatMap((event) => event.summaryLines.slice(0, 2)),
      ...factionNarrative.summaryLines,
      ...buildSummaryLinesForRoomPlan(room, activeEvents, roomClimate, factionSurge),
    ]).slice(0, 10));

    return freeze({
      roomId: room.roomId,
      primaryFactionId: factionSurge.primaryFactionId,
      headline,
      summaryLines,
      callouts: buildCallouts(room, activeEvents, factionSurge),
      broadcastTags: buildControlTags(room, activeEvents, factionSurge),
      visibleChannels: freezeArray(visibleChannels.map((directive) => directive.channelId)),
      climate: roomClimate.pressureBand,
      voicePosture: roomClimate.voicePosture,
    });
  }

  private buildVisibleAnnouncements(
    room: GlobalEventSchedulerRoomContext,
    activeEvents: readonly GlobalEventProjection[],
    factionSurge: FactionSurgePlan,
    now: number,
  ): readonly WorldEventAnnouncementDirective[] {
    const directives: WorldEventAnnouncementDirective[] = [];

    for (const event of activeEvents) {
      const channels = baseVisibleChannels(room, event);
      const allowed = channels.length > 0 && visibilityAllowsAnnouncements(event);
      const inCooldown = !this.shouldEmit(room.roomId, event.activationId, 'VISIBLE', now);
      const decision = visibleDecision(room, event, channels, allowed, inCooldown);

      if (decision.disposition !== 'READY') {
        continue;
      }

      const style = eventAnnouncementStyle(event, room);
      directives.push(
        freeze({
          directiveId: `${room.roomId}::${event.activationId}::VISIBLE`,
          roomId: room.roomId,
          activationId: event.activationId,
          eventId: event.eventId,
          headline: event.headline,
          summaryLines: freezeArray(uniqueStrings([
            ...event.summaryLines,
            ...factionSurge.summary.summaryLines,
          ]).slice(0, 6)),
          channels,
          style,
          priority: eventPriorityBase(event) + ANNOUNCEMENT_STYLE_WEIGHT[style],
          tags: freezeArray(uniqueStrings([
            ...event.tags,
            ...factionSurge.recommendedTags,
            'VISIBLE_LIVEOPS',
            room.roomId,
          ])),
          startsAt: event.startsAt,
          endsAt: event.endsAt,
        }),
      );

      this.markEmitted(room.roomId, event.activationId, 'VISIBLE', now);
    }

    return sortAnnouncements(directives);
  }

  private buildShadowDirectives(
    room: GlobalEventSchedulerRoomContext,
    activeEvents: readonly GlobalEventProjection[],
    factionSurge: FactionSurgePlan,
    roomClimate: WorldEventRoomClimate,
    now: number,
  ): readonly WorldEventShadowDirective[] {
    const directives: WorldEventShadowDirective[] = [];

    for (const event of activeEvents) {
      const inCooldown = !this.shouldEmit(room.roomId, event.activationId, 'SHADOW', now);
      const decision = shadowDecision(event, inCooldown);

      if (decision.disposition !== 'READY') {
        continue;
      }

      const family = familyProfile(event);
      const basePressure = Math.max(1, Math.round(event.timeRemainingMs / 60_000));
      const primaryInterruptionDelta =
        factionSurge.channelDirectives.reduce((sum, directive) => sum + directive.interruptionPressureDelta, 0) +
        (factionSurge.coordinatedRaidActive ? 4 : 0);

      directives.push(
        freeze({
          directiveId: `${room.roomId}::${event.activationId}::LIVEOPS_SHADOW`,
          roomId: room.roomId,
          activationId: event.activationId,
          shadowChannelId: 'LIVEOPS_SHADOW',
          queuePriority: eventPriorityBase(event),
          pressureDelta: basePressure + factionSurge.pressureBiasDelta + family.shadowBase,
          helperAvailabilityDelta: family.helperDelta + (factionSurge.helperBlackoutActive ? -4 : 0),
          interruptionDelta: primaryInterruptionDelta,
          witnessDelta: Math.round(roomClimate.witnessPressure / 10),
          tags: freezeArray(uniqueStrings([
            ...event.tags,
            ...factionSurge.recommendedTags,
            ...family.tags,
            'LIVEOPS_SHADOW',
          ])),
          notes: freezeArray([
            `PRIMARY_FACTION:${factionSurge.primaryFactionId}`,
            `INTENSITY:${event.intensity}`,
            `PRESSURE_BASE:${basePressure}`,
            `VOICE:${roomClimate.voicePosture}`,
          ]),
        }),
      );

      if (factionSurge.helperBlackoutActive || event.family === 'HELPER_BLACKOUT') {
        directives.push(
          freeze({
            directiveId: `${room.roomId}::${event.activationId}::RESCUE_SHADOW`,
            roomId: room.roomId,
            activationId: event.activationId,
            shadowChannelId: 'RESCUE_SHADOW',
            queuePriority: eventPriorityBase(event) - 10,
            pressureDelta: basePressure + 1,
            helperAvailabilityDelta: -5,
            interruptionDelta: 0,
            witnessDelta: 0,
            tags: freezeArray(uniqueStrings(['HELPER_BLACKOUT', ...event.tags, room.roomId])),
            notes: freezeArray(['HELPER_RESCUE_MUTE']),
          }),
        );
      }

      if (factionSurge.coordinatedRaidActive || event.family === 'COORDINATED_RAID') {
        directives.push(
          freeze({
            directiveId: `${room.roomId}::${event.activationId}::RIVALRY_SHADOW`,
            roomId: room.roomId,
            activationId: event.activationId,
            shadowChannelId: 'RIVALRY_SHADOW',
            queuePriority: eventPriorityBase(event) + 5,
            pressureDelta: basePressure + 3,
            helperAvailabilityDelta: 0,
            interruptionDelta: 4,
            witnessDelta: 2,
            tags: freezeArray(uniqueStrings(['RAID_WINDOW', ...event.tags, ...factionSurge.recommendedTags])),
            notes: freezeArray(['RIVALRY_FASTLANE_ACTIVE']),
          }),
        );
      }

      if (event.visibility !== 'VISIBLE') {
        directives.push(
          freeze({
            directiveId: `${room.roomId}::${event.activationId}::NPC_SHADOW`,
            roomId: room.roomId,
            activationId: event.activationId,
            shadowChannelId: 'NPC_SHADOW',
            queuePriority: eventPriorityBase(event) - 2,
            pressureDelta: family.shadowBase + INTENSITY_WEIGHT[event.intensity],
            helperAvailabilityDelta: 0,
            interruptionDelta: 1,
            witnessDelta: 0,
            tags: freezeArray(uniqueStrings(['NPC_SHADOW', ...family.tags, ...event.tags])),
            notes: freezeArray(['Shadow-only or hybrid event contributes latent NPC pressure.']),
          }),
        );
      }

      this.markEmitted(room.roomId, event.activationId, 'SHADOW', now);
    }

    return sortShadowDirectives(directives);
  }

  private buildSummary(
    room: GlobalEventSchedulerRoomContext,
    activeEvents: readonly GlobalEventProjection[],
    factionSurge: FactionSurgePlan,
    roomClimate: WorldEventRoomClimate,
    visibleAnnouncements: readonly WorldEventAnnouncementDirective[],
    shadowDirectives: readonly WorldEventShadowDirective[],
  ): WorldEventRoomPlanSummary {
    return freeze({
      roomId: room.roomId,
      primaryFactionId: factionSurge.primaryFactionId,
      primaryAlignment: factionSurge.primaryAlignment,
      activeEventCount: activeEvents.length,
      visibleAnnouncementCount: visibleAnnouncements.length,
      shadowDirectiveCount: shadowDirectives.length,
      dominantChannels: roomClimate.dominantChannels,
      climate: roomClimate.pressureBand,
      helperBlackoutActive: factionSurge.helperBlackoutActive,
      coordinatedRaidActive: factionSurge.coordinatedRaidActive,
      quietestChannelId: quietestChannelFromSurge(factionSurge),
      loudestChannelId: loudestChannelFromSurge(factionSurge),
      summaryLines: freezeArray(uniqueStrings([
        ...factionSurge.summary.summaryLines,
        ...buildSummaryLinesForRoomPlan(room, activeEvents, roomClimate, factionSurge),
      ]).slice(0, 8)),
    });
  }

  private buildDiagnostics(
    room: GlobalEventSchedulerRoomContext,
    activeEvents: readonly GlobalEventProjection[],
    factionSurge: FactionSurgePlan,
    now: number,
  ): WorldEventRoomPlanDiagnostics {
    const rankedFactions = this.factionPlanner.rankFactions(room, activeEvents);
    const roomSignals = factionSurge.audit.roomSignals;
    const visibleDecisions = freezeArray(activeEvents.map((event) => visibleDecision(
      room,
      event,
      baseVisibleChannels(room, event),
      baseVisibleChannels(room, event).length > 0,
      !this.shouldEmit(room.roomId, event.activationId, 'VISIBLE', now),
    )));
    const shadowDecisions = freezeArray(activeEvents.map((event) => shadowDecision(
      event,
      !this.shouldEmit(room.roomId, event.activationId, 'SHADOW', now),
    )));
    const emissionAudit = freezeArray(activeEvents.map((event) => freeze({
      roomId: room.roomId,
      activationId: event.activationId,
      eventId: event.eventId,
      visibleDisposition: visibleDecision(
        room,
        event,
        baseVisibleChannels(room, event),
        baseVisibleChannels(room, event).length > 0,
        !this.shouldEmit(room.roomId, event.activationId, 'VISIBLE', now),
      ).disposition,
      shadowDisposition: shadowDecision(
        event,
        !this.shouldEmit(room.roomId, event.activationId, 'SHADOW', now),
      ).disposition,
      visibleLastEmittedAt: this.emissionLedger.get(this.emissionKey(room.roomId, event.activationId, 'VISIBLE'))?.emittedAt ?? null,
      shadowLastEmittedAt: this.emissionLedger.get(this.emissionKey(room.roomId, event.activationId, 'SHADOW'))?.emittedAt ?? null,
      tags: freezeArray(uniqueStrings([...event.tags, ...factionSurge.recommendedTags])),
      notes: freezeArray([
        ...event.notes,
        describeEventCompact(event),
      ]),
    })));

    return freeze({
      roomSignals,
      rankedFactions,
      emissionAudit,
      visibleDecisions,
      shadowDecisions,
      notes: freezeArray(uniqueStrings([
        `RANKED_FACTIONS:${rankedFactions.length}`,
        `VISIBLE_DECISIONS:${visibleDecisions.length}`,
        `SHADOW_DECISIONS:${shadowDecisions.length}`,
        ...factionSurge.audit.debugNotes,
      ])),
    });
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

export class WorldEventDirectorInspector {
  private readonly director: WorldEventDirector;

  public constructor(director: WorldEventDirector) {
    this.director = director;
  }

  public snapshot(
    context: GlobalEventSchedulerEvaluationContext = {},
  ): WorldEventDirectorTickResult {
    return this.director.tick(context);
  }

  public snapshotDetailed(
    context: GlobalEventSchedulerEvaluationContext = {},
  ): WorldEventDirectorDetailedTickResult {
    return this.director.tickDetailed(context);
  }

  public buildManifest(): WorldEventDirectorManifest {
    return this.director.buildManifest();
  }

  public diffManifest(
    manifest: WorldEventDirectorManifest,
  ): WorldEventDirectorLibraryDiff {
    return this.director.diffManifest(manifest);
  }

  public listChannelLoads(
    context: GlobalEventSchedulerEvaluationContext = {},
  ): readonly GlobalEventChannelLoad[] {
    return this.director.listChannelLoads(context);
  }

  public listFamilyLoads(
    context: GlobalEventSchedulerEvaluationContext = {},
  ): readonly GlobalEventFamilyLoad[] {
    return this.director.listFamilyLoads(context);
  }

  public buildTimeline(
    context: GlobalEventSchedulerEvaluationContext = {},
  ): readonly GlobalEventTimelineSlice[] {
    return this.director.buildTimeline(context);
  }

  public buildSchedulerRoomMatrix(
    context: GlobalEventSchedulerEvaluationContext = {},
  ): readonly GlobalEventRoomProjectionMatrixRow[] {
    return this.director.buildSchedulerRoomMatrix(context);
  }

  public buildRoomPlanMatrix(
    context: GlobalEventSchedulerEvaluationContext = {},
  ): readonly WorldEventRoomPlanMatrixRow[] {
    return this.director.buildRoomPlanMatrix(context);
  }

  public previewDefinitionWindows(
    eventId: string,
    input: PreviewWindowsInput = {},
  ): readonly GlobalEventWindowPreview[] {
    return this.director.previewDefinitionWindows(eventId, input);
  }

  public previewLibraryWindows(
    input: PreviewWindowsInput = {},
  ): readonly GlobalEventWindowPreview[] {
    return this.director.previewLibraryWindows(input);
  }

  public auditDefinition(
    eventId: string,
  ): GlobalEventDefinitionAudit | null {
    return this.director.auditDefinition(eventId);
  }

  public auditLibrary(): readonly GlobalEventDefinitionAudit[] {
    return this.director.auditLibrary();
  }

  public listActivationDigests(): readonly GlobalEventActivationDigest[] {
    return this.director.listActivationDigests();
  }

  public cloneDirector(): WorldEventDirector {
    return this.director.cloneDirector();
  }
}

export function createWorldEventDirector(
  options: WorldEventDirectorOptions = {},
): WorldEventDirector {
  return new WorldEventDirector(options);
}

export function createWorldEventDirectorInspector(
  director: WorldEventDirector,
): WorldEventDirectorInspector {
  return new WorldEventDirectorInspector(director);
}


export interface WorldEventAnnouncementDigest {
  readonly directiveId: string;
  readonly roomId: string;
  readonly eventId: string;
  readonly style: WorldEventAnnouncementStyle;
  readonly channelCount: number;
  readonly priority: number;
  readonly tags: readonly string[];
}

export interface WorldEventShadowDigest {
  readonly directiveId: string;
  readonly roomId: string;
  readonly activationId: string;
  readonly shadowChannelId: WorldEventShadowChannelId;
  readonly queuePriority: number;
  readonly pressureDelta: number;
  readonly helperAvailabilityDelta: number;
  readonly interruptionDelta: number;
  readonly witnessDelta: number;
  readonly tags: readonly string[];
}

export interface WorldEventVisibleChannelDigest {
  readonly directiveId: string;
  readonly roomId: string;
  readonly channelId: ChatLiveOpsChannelId;
  readonly dominantFactionId: string;
  readonly climate: WorldEventPressureBand;
  readonly emissionDisposition: WorldEventEmissionDisposition;
  readonly pressureDelta: number;
  readonly witnessDelta: number;
  readonly publicnessDelta: number;
}

export interface WorldEventPlanDigest {
  readonly roomId: string;
  readonly climate: WorldEventPressureBand;
  readonly primaryFactionId: string;
  readonly announcementCount: number;
  readonly shadowCount: number;
  readonly dominantChannels: readonly ChatLiveOpsChannelId[];
  readonly tags: readonly string[];
}

export interface WorldEventNarrativeScorecard {
  readonly roomId: string;
  readonly headlineWeight: number;
  readonly calloutCount: number;
  readonly visibleChannelCount: number;
  readonly climateWeight: number;
  readonly aggregateScore: number;
  readonly notes: readonly string[];
}

export function summarizeWorldEventAnnouncementDirective(
  directive: WorldEventAnnouncementDirective,
): WorldEventAnnouncementDigest {
  return freeze({
    directiveId: directive.directiveId,
    roomId: directive.roomId,
    eventId: directive.eventId,
    style: directive.style,
    channelCount: directive.channels.length,
    priority: directive.priority,
    tags: directive.tags,
  });
}

export function summarizeWorldEventShadowDirective(
  directive: WorldEventShadowDirective,
): WorldEventShadowDigest {
  return freeze({
    directiveId: directive.directiveId,
    roomId: directive.roomId,
    activationId: directive.activationId,
    shadowChannelId: directive.shadowChannelId,
    queuePriority: directive.queuePriority,
    pressureDelta: directive.pressureDelta,
    helperAvailabilityDelta: directive.helperAvailabilityDelta,
    interruptionDelta: directive.interruptionDelta,
    witnessDelta: directive.witnessDelta,
    tags: directive.tags,
  });
}

export function summarizeWorldEventVisibleChannelDirective(
  directive: WorldEventVisibleChannelDirective,
): WorldEventVisibleChannelDigest {
  return freeze({
    directiveId: directive.directiveId,
    roomId: directive.roomId,
    channelId: directive.channelId,
    dominantFactionId: directive.dominantFactionId,
    climate: directive.climate,
    emissionDisposition: directive.emissionDisposition,
    pressureDelta: directive.pressureDelta,
    witnessDelta: directive.witnessDelta,
    publicnessDelta: directive.publicnessDelta,
  });
}

export function summarizeWorldEventRoomPlan(
  plan: WorldEventRoomPlan,
): WorldEventPlanDigest {
  return freeze({
    roomId: plan.roomId,
    climate: plan.roomClimate.pressureBand,
    primaryFactionId: plan.factionSurge.primaryFactionId,
    announcementCount: plan.visibleAnnouncements.length,
    shadowCount: plan.shadowDirectives.length,
    dominantChannels: plan.roomClimate.dominantChannels,
    tags: plan.roomClimate.tags,
  });
}

export function scoreWorldEventNarrativePacket(
  packet: WorldEventNarrativePacket,
): WorldEventNarrativeScorecard {
  const climateWeight = packet.climate === 'WORLD_CLASS'
    ? 6
    : packet.climate === 'PREDATORY'
      ? 5
      : packet.climate === 'HOSTILE'
        ? 4
        : packet.climate === 'TENSE'
          ? 3
          : packet.climate === 'CEREMONIAL'
            ? 2
            : 1;
  const headlineWeight = clamp(packet.headline.length / 32, 1, 5);
  const aggregateScore = Math.round(
    (headlineWeight * 2) +
    (packet.callouts.length * 1.5) +
    (packet.visibleChannels.length * 1.25) +
    climateWeight,
  );

  return freeze({
    roomId: packet.roomId,
    headlineWeight,
    calloutCount: packet.callouts.length,
    visibleChannelCount: packet.visibleChannels.length,
    climateWeight,
    aggregateScore,
    notes: freezeArray([
      `VOICE:${packet.voicePosture}`,
      `CLIMATE:${packet.climate}`,
      `CHANNELS:${packet.visibleChannels.length}`,
    ]),
  });
}

export function listWorldEventAnnouncementDigests(
  plans: readonly WorldEventRoomPlan[],
): readonly WorldEventAnnouncementDigest[] {
  return freezeArray(plans.flatMap((plan) => plan.visibleAnnouncements.map(summarizeWorldEventAnnouncementDirective)));
}

export function listWorldEventShadowDigests(
  plans: readonly WorldEventRoomPlan[],
): readonly WorldEventShadowDigest[] {
  return freezeArray(plans.flatMap((plan) => plan.shadowDirectives.map(summarizeWorldEventShadowDirective)));
}

export function listWorldEventVisibleChannelDigests(
  plans: readonly WorldEventRoomPlan[],
): readonly WorldEventVisibleChannelDigest[] {
  return freezeArray(plans.flatMap((plan) => plan.visibleChannels.map(summarizeWorldEventVisibleChannelDirective)));
}

export function listWorldEventPlanDigests(
  plans: readonly WorldEventRoomPlan[],
): readonly WorldEventPlanDigest[] {
  return freezeArray(plans.map(summarizeWorldEventRoomPlan));
}

export function listWorldEventNarrativeScorecards(
  plans: readonly WorldEventRoomPlan[],
): readonly WorldEventNarrativeScorecard[] {
  return freezeArray(plans.map((plan) => scoreWorldEventNarrativePacket(plan.narrative)));
}

export function collectWorldEventRoomIds(
  plans: readonly WorldEventRoomPlan[],
): readonly string[] {
  return freezeArray(uniqueStrings(plans.map((plan) => plan.roomId)));
}

export function collectWorldEventPrimaryFactionIds(
  plans: readonly WorldEventRoomPlan[],
): readonly string[] {
  return freezeArray(uniqueStrings(plans.map((plan) => plan.factionSurge.primaryFactionId)));
}

export function collectWorldEventActiveEventIds(
  plans: readonly WorldEventRoomPlan[],
): readonly string[] {
  return freezeArray(uniqueStrings(plans.flatMap((plan) => plan.activeEvents.map((event) => event.eventId))));
}

export function collectWorldEventActivationIds(
  plans: readonly WorldEventRoomPlan[],
): readonly string[] {
  return freezeArray(uniqueStrings(plans.flatMap((plan) => plan.activeEvents.map((event) => event.activationId))));
}

export function collectWorldEventDominantChannels(
  plans: readonly WorldEventRoomPlan[],
): readonly ChatLiveOpsChannelId[] {
  return freezeArray(uniqueStrings(plans.flatMap((plan) => plan.roomClimate.dominantChannels)) as ChatLiveOpsChannelId[]);
}

export function countWorldEventPressureBands(
  plans: readonly WorldEventRoomPlan[],
): Readonly<Record<WorldEventPressureBand, number>> {
  const histogram: Record<WorldEventPressureBand, number> = {
    CALM: 0,
    TENSE: 0,
    HOSTILE: 0,
    PREDATORY: 0,
    CEREMONIAL: 0,
    WORLD_CLASS: 0,
  };
  for (const plan of plans) {
    histogram[plan.roomClimate.pressureBand] += 1;
  }
  return freeze(histogram);
}

export function countWorldEventAnnouncementStyles(
  plans: readonly WorldEventRoomPlan[],
): Readonly<Record<WorldEventAnnouncementStyle, number>> {
  const histogram: Record<WorldEventAnnouncementStyle, number> = {
    SYSTEM_NOTICE: 0,
    BREAKING_WORLD_EVENT: 0,
    WHISPER_LOCK: 0,
    PANIC_BANNER: 0,
    RAID_WARNING: 0,
    SEASONAL_HEADER: 0,
    RIVAL_SPOTLIGHT: 0,
    FACTION_PULSE: 0,
    BLACKOUT_ALERT: 0,
    TRUST_CALL: 0,
  };
  for (const plan of plans) {
    for (const directive of plan.visibleAnnouncements) {
      histogram[directive.style] += 1;
    }
  }
  return freeze(histogram);
}

export function countWorldEventVisibleDisposition(
  plans: readonly WorldEventRoomPlanDetailed[],
): Readonly<Record<WorldEventEmissionDisposition, number>> {
  const histogram: Record<WorldEventEmissionDisposition, number> = {
    READY: 0,
    COOLDOWN: 0,
    SUPPRESSED: 0,
    SHADOW_ONLY: 0,
    VISIBLE_ONLY: 0,
  };
  for (const plan of plans) {
    for (const decision of plan.diagnostics.visibleDecisions) {
      histogram[decision.disposition] += 1;
    }
  }
  return freeze(histogram);
}

export function countWorldEventShadowDisposition(
  plans: readonly WorldEventRoomPlanDetailed[],
): Readonly<Record<WorldEventEmissionDisposition, number>> {
  const histogram: Record<WorldEventEmissionDisposition, number> = {
    READY: 0,
    COOLDOWN: 0,
    SUPPRESSED: 0,
    SHADOW_ONLY: 0,
    VISIBLE_ONLY: 0,
  };
  for (const plan of plans) {
    for (const decision of plan.diagnostics.shadowDecisions) {
      histogram[decision.disposition] += 1;
    }
  }
  return freeze(histogram);
}

export function buildWorldEventPressureRanking(
  plans: readonly WorldEventRoomPlan[],
): readonly WorldEventPlanDigest[] {
  return freezeArray(
    [...plans]
      .sort((left, right) => {
        const leftScore = left.roomClimate.visiblePressure + left.roomClimate.shadowPressure + left.roomClimate.witnessPressure;
        const rightScore = right.roomClimate.visiblePressure + right.roomClimate.shadowPressure + right.roomClimate.witnessPressure;
        return rightScore - leftScore;
      })
      .map(summarizeWorldEventRoomPlan),
  );
}

export function buildWorldEventAnnouncementRanking(
  plans: readonly WorldEventRoomPlan[],
): readonly WorldEventAnnouncementDigest[] {
  return freezeArray(
    plans
      .flatMap((plan) => plan.visibleAnnouncements)
      .sort((left, right) => right.priority - left.priority)
      .map(summarizeWorldEventAnnouncementDirective),
  );
}

export function buildWorldEventShadowRanking(
  plans: readonly WorldEventRoomPlan[],
): readonly WorldEventShadowDigest[] {
  return freezeArray(
    plans
      .flatMap((plan) => plan.shadowDirectives)
      .sort((left, right) => right.queuePriority - left.queuePriority)
      .map(summarizeWorldEventShadowDirective),
  );
}

export function buildWorldEventVisibleChannelRanking(
  plans: readonly WorldEventRoomPlan[],
): readonly WorldEventVisibleChannelDigest[] {
  return freezeArray(
    plans
      .flatMap((plan) => plan.visibleChannels)
      .sort((left, right) => right.pressureDelta - left.pressureDelta)
      .map(summarizeWorldEventVisibleChannelDirective),
  );
}

export function collectWorldEventTags(
  plans: readonly WorldEventRoomPlan[],
): readonly string[] {
  return freezeArray(uniqueStrings(plans.flatMap((plan) => [
    ...plan.roomClimate.tags,
    ...plan.narrative.broadcastTags,
    ...plan.visibleAnnouncements.flatMap((directive) => directive.tags),
    ...plan.shadowDirectives.flatMap((directive) => directive.tags),
  ])));
}

export function buildWorldEventNarrativeHeadlines(
  plans: readonly WorldEventRoomPlan[],
): readonly string[] {
  return freezeArray(plans.map((plan) => plan.narrative.headline));
}

export function buildWorldEventSummaryLedger(
  plans: readonly WorldEventRoomPlan[],
): readonly string[] {
  return freezeArray(plans.flatMap((plan) => [
    `ROOM:${plan.roomId}`,
    `PRIMARY:${plan.factionSurge.primaryFactionId}`,
    `CLIMATE:${plan.roomClimate.pressureBand}`,
    `ANNOUNCEMENTS:${plan.visibleAnnouncements.length}`,
    `SHADOW:${plan.shadowDirectives.length}`,
  ]));
}

export function buildWorldEventModeHistogram(
  plans: readonly WorldEventRoomPlan[],
): Readonly<Record<string, number>> {
  const histogram: Record<string, number> = {};
  for (const plan of plans) {
    histogram[plan.roomClimate.modeId] = (histogram[plan.roomClimate.modeId] ?? 0) + 1;
  }
  return freeze(histogram);
}

export function buildWorldEventFactionHistogram(
  plans: readonly WorldEventRoomPlan[],
): Readonly<Record<string, number>> {
  const histogram: Record<string, number> = {};
  for (const plan of plans) {
    histogram[plan.factionSurge.primaryFactionId] = (histogram[plan.factionSurge.primaryFactionId] ?? 0) + 1;
  }
  return freeze(histogram);
}

export function buildWorldEventClimateHistogram(
  plans: readonly WorldEventRoomPlan[],
): Readonly<Record<WorldEventPressureBand, number>> {
  return countWorldEventPressureBands(plans);
}

export function buildWorldEventAnnouncementStyleHistogram(
  plans: readonly WorldEventRoomPlan[],
): Readonly<Record<WorldEventAnnouncementStyle, number>> {
  return countWorldEventAnnouncementStyles(plans);
}

export function buildWorldEventDigestStrings(
  plans: readonly WorldEventRoomPlan[],
): readonly string[] {
  return freezeArray(
    buildWorldEventPressureRanking(plans).map((digest) =>
      `${digest.roomId}:${digest.primaryFactionId}:${digest.climate}:${digest.announcementCount}:${digest.shadowCount}`,
    ),
  );
}

export function buildWorldEventNarrativeDigestStrings(
  plans: readonly WorldEventRoomPlan[],
): readonly string[] {
  return freezeArray(
    listWorldEventNarrativeScorecards(plans).map((scorecard) =>
      `${scorecard.roomId}:${scorecard.aggregateScore}:${scorecard.climateWeight}:${scorecard.calloutCount}`,
    ),
  );
}
