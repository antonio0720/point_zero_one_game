/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT LIVEOPS PROGRAM CONTRACT
 * FILE: shared/contracts/chat/ChatLiveOps.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared law for world-scale liveops orchestration inside the chat
 * universe.
 *
 * The legacy shared/contracts/chat/liveops.ts file already defines a compact
 * overlay model. This file does not replace that authority. It widens it into a
 * full program, season, scheduling, activation, health, and registry surface so
 * frontend, backend, and transport layers can all reason from the same law.
 *
 * A chat liveops program is responsible for:
 *
 * 1. owning active seasons and campaign windows,
 * 2. activating world events and overlays,
 * 3. publishing compatible legacy overlay projections,
 * 4. tracking operational state, fanout, and health,
 * 5. summarizing what the world currently feels like,
 * 6. preserving shadow-vs-visible distinctions,
 * 7. enabling deterministic inspection and replay,
 * 8. and keeping the world alive even when a single player is not the center.
 *
 * Design doctrine
 * ---------------
 * 1. Shared contracts define law and deterministic helpers only.
 * 2. Legacy overlay compatibility must be preserved during expansion.
 * 3. Programs, seasons, campaigns, and world events are related, not merged.
 * 4. Runtime health must be represented explicitly for operator safety.
 * 5. The same liveops estate must serve frontend, backend, and transport.
 * 6. Visible announcements and shadow pressure are always modeled separately.
 * 7. Scheduling, activation, and summaries must remain transport-safe.
 * 8. This file stays additive to repo authorities already present in the chat
 *    contract lane.
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
  type ChatReplayId,
  type ChatRoomId,
  type ChatUserId,
  type JsonObject,
  type UnixMs,
} from './ChatChannels';
import {
  type ChatLiveOpsChannelId,
  type ChatLiveOpsIntensityBand,
  type ChatLiveOpsOverlayContext,
  type ChatLiveOpsOverlayDefinition,
  type ChatLiveOpsOverlaySnapshot,
  type ChatLiveOpsOverlayKind,
} from './liveops';
import {
  CHAT_WORLD_EVENT_VERSION,
  collectWorldEventTargetChannels,
  previewChatWorldEvent,
  projectChatWorldEventToLegacyOverlayDefinition,
  summarizeChatWorldEvent,
  type ChatWorldEventActivation,
  type ChatWorldEventDefinition,
  type ChatWorldEventPreview,
  type ChatWorldEventSummary,
  type ChatWorldEventVersion,
} from './ChatWorldEvent';

export type ChatLiveOpsVersion = 1;
export const CHAT_LIVEOPS_VERSION: ChatLiveOpsVersion = 1;

export const CHAT_LIVEOPS_PROGRAM_KINDS = [
  'GLOBAL_SEASON',
  'LIMITED_EVENT_RUN',
  'FACTION_PROGRAM',
  'ALERT_MODE',
  'EXPERIMENT',
  'NARRATIVE_ARC',
] as const;
export type ChatLiveOpsProgramKind = (typeof CHAT_LIVEOPS_PROGRAM_KINDS)[number];

export const CHAT_LIVEOPS_SEASON_PHASES = [
  'PRESEASON',
  'OPENING',
  'ACTIVE',
  'PEAK',
  'CLOSING',
  'AFTERMATH',
  'ARCHIVED',
] as const;
export type ChatLiveOpsSeasonPhase = (typeof CHAT_LIVEOPS_SEASON_PHASES)[number];

export const CHAT_LIVEOPS_PROGRAM_STATES = [
  'DRAFT',
  'PLANNED',
  'ARMED',
  'LIVE',
  'PAUSED',
  'DEGRADED',
  'ENDED',
  'ARCHIVED',
] as const;
export type ChatLiveOpsProgramState = (typeof CHAT_LIVEOPS_PROGRAM_STATES)[number];

export const CHAT_LIVEOPS_HEALTH_STATES = [
  'HEALTHY',
  'WATCH',
  'DEGRADED',
  'FAILING',
  'SAFE_MODE',
] as const;
export type ChatLiveOpsHealthState = (typeof CHAT_LIVEOPS_HEALTH_STATES)[number];

export const CHAT_LIVEOPS_ANNOUNCEMENT_MODES = [
  'NONE',
  'PASSIVE',
  'STANDARD',
  'CEREMONIAL',
  'ALARM',
  'SHADOW',
] as const;
export type ChatLiveOpsAnnouncementMode = (typeof CHAT_LIVEOPS_ANNOUNCEMENT_MODES)[number];

export interface ChatLiveOpsSeasonTheme {
  readonly seasonId: string;
  readonly displayName: string;
  readonly codename: string;
  readonly phase: ChatLiveOpsSeasonPhase;
  readonly intensity: ChatLiveOpsIntensityBand;
  readonly opensAt: UnixMs;
  readonly closesAt: UnixMs;
  readonly keyArtLabel?: string;
  readonly headline: string;
  readonly premise: string;
  readonly tags: readonly string[];
  readonly narrativeGoals: readonly string[];
}

export interface ChatLiveOpsCampaignWindow {
  readonly windowId: string;
  readonly startsAt: UnixMs;
  readonly endsAt: UnixMs;
  readonly warmupMs: number;
  readonly cooldownMs: number;
}

export interface ChatLiveOpsCampaign {
  readonly campaignId: string;
  readonly displayName: string;
  readonly kind: ChatLiveOpsProgramKind;
  readonly state: ChatLiveOpsProgramState;
  readonly seasonId?: string | null;
  readonly priority: number;
  readonly channels: readonly ChatChannelId[];
  readonly announcementMode: ChatLiveOpsAnnouncementMode;
  readonly window: ChatLiveOpsCampaignWindow;
  readonly worldEvents: readonly ChatWorldEventDefinition[];
  readonly legendBias: number;
  readonly pressureBias: number;
  readonly witnessBias: number;
  readonly tags: readonly string[];
}

export interface ChatLiveOpsOperatorDirective {
  readonly directiveId: string;
  readonly label: string;
  readonly createdAt: UnixMs;
  readonly createdBy: string;
  readonly programId: string;
  readonly channels?: readonly ChatChannelId[];
  readonly roomIds?: readonly ChatRoomId[];
  readonly playerIds?: readonly ChatUserId[];
  readonly forceAnnouncementMode?: ChatLiveOpsAnnouncementMode;
  readonly forceIntensity?: ChatLiveOpsIntensityBand;
  readonly pauseProgram?: boolean;
  readonly notes?: readonly string[];
}

export interface ChatLiveOpsActivationRecord {
  readonly activationId: string;
  readonly programId: string;
  readonly campaignId: string;
  readonly eventId: string;
  readonly activatedAt: UnixMs;
  readonly visibleChannels: readonly ChatChannelId[];
  readonly shadowChannels: readonly ChatChannelId[];
  readonly targetedRooms: readonly ChatRoomId[];
  readonly targetedPlayers: readonly ChatUserId[];
  readonly generatedOverlayId: string;
}

export interface ChatLiveOpsRuntimeChannelState {
  readonly channelId: ChatChannelId;
  readonly activeProgramIds: readonly string[];
  readonly activeCampaignIds: readonly string[];
  readonly activeEventIds: readonly string[];
  readonly visiblePressure: number;
  readonly latentPressure: number;
  readonly helperSuppression: number;
  readonly whisperOnly: boolean;
  readonly doubleHeat: boolean;
  readonly systemNoticeBias: number;
}

export interface ChatLiveOpsHealthSnapshot {
  readonly state: ChatLiveOpsHealthState;
  readonly checkedAt: UnixMs;
  readonly activeProgramCount: number;
  readonly activeCampaignCount: number;
  readonly activeEventCount: number;
  readonly degradedProgramIds: readonly string[];
  readonly failingEventIds: readonly string[];
  readonly safeModeReason?: string;
  readonly notes?: readonly string[];
}

export interface ChatLiveOpsSummary {
  readonly programCount: number;
  readonly campaignCount: number;
  readonly eventCount: number;
  readonly visibleEventCount: number;
  readonly shadowEventCount: number;
  readonly activeSeasonId?: string | null;
  readonly dominantIntensity: ChatLiveOpsIntensityBand | 'NONE';
  readonly whisperOnlyChannels: readonly ChatChannelId[];
  readonly doubleHeatChannels: readonly ChatChannelId[];
  readonly headline: string;
}

export interface ChatLiveOpsSnapshot {
  readonly version: ChatLiveOpsVersion;
  readonly worldEventVersion: ChatWorldEventVersion;
  readonly updatedAt: UnixMs;
  readonly state: ChatLiveOpsProgramState;
  readonly activeSeason?: ChatLiveOpsSeasonTheme | null;
  readonly programs: readonly ChatLiveOpsProgram[];
  readonly activeCampaigns: readonly ChatLiveOpsCampaign[];
  readonly activeEvents: readonly ChatWorldEventDefinition[];
  readonly activations: readonly ChatLiveOpsActivationRecord[];
  readonly channelState: readonly ChatLiveOpsRuntimeChannelState[];
  readonly legacyOverlaySnapshot: ChatLiveOpsOverlaySnapshot;
  readonly health: ChatLiveOpsHealthSnapshot;
  readonly summary: ChatLiveOpsSummary;
}

export interface ChatLiveOpsProgram {
  readonly programId: string;
  readonly displayName: string;
  readonly kind: ChatLiveOpsProgramKind;
  readonly state: ChatLiveOpsProgramState;
  readonly season?: ChatLiveOpsSeasonTheme | null;
  readonly campaigns: readonly ChatLiveOpsCampaign[];
  readonly tags: readonly string[];
  readonly legendIds?: readonly ChatLegendId[];
  readonly replayIds?: readonly ChatReplayId[];
  readonly metadata?: JsonObject;
}

export interface ChatLiveOpsManifest {
  readonly version: ChatLiveOpsVersion;
  readonly worldEventVersion: ChatWorldEventVersion;
  readonly programKinds: readonly ChatLiveOpsProgramKind[];
  readonly seasonPhases: readonly ChatLiveOpsSeasonPhase[];
  readonly states: readonly ChatLiveOpsProgramState[];
  readonly healthStates: readonly ChatLiveOpsHealthState[];
  readonly announcementModes: readonly ChatLiveOpsAnnouncementMode[];
  readonly visibleChannels: readonly ChatChannelId[];
  readonly shadowChannels: readonly ChatChannelId[];
}

export const CHAT_LIVEOPS_MANIFEST: ChatLiveOpsManifest = Object.freeze({
  version: CHAT_LIVEOPS_VERSION,
  worldEventVersion: CHAT_WORLD_EVENT_VERSION,
  programKinds: CHAT_LIVEOPS_PROGRAM_KINDS,
  seasonPhases: CHAT_LIVEOPS_SEASON_PHASES,
  states: CHAT_LIVEOPS_PROGRAM_STATES,
  healthStates: CHAT_LIVEOPS_HEALTH_STATES,
  announcementModes: CHAT_LIVEOPS_ANNOUNCEMENT_MODES,
  visibleChannels: CHAT_VISIBLE_CHANNELS,
  shadowChannels: CHAT_SHADOW_CHANNELS,
});

export function createEmptyChatLiveOpsSnapshot(updatedAt: UnixMs): ChatLiveOpsSnapshot {
  return {
    version: CHAT_LIVEOPS_VERSION,
    worldEventVersion: CHAT_WORLD_EVENT_VERSION,
    updatedAt,
    state: 'PLANNED',
    activeSeason: null,
    programs: [],
    activeCampaigns: [],
    activeEvents: [],
    activations: [],
    channelState: CHAT_ALL_CHANNELS.map((channelId) => ({
      channelId,
      activeProgramIds: [],
      activeCampaignIds: [],
      activeEventIds: [],
      visiblePressure: 0,
      latentPressure: 0,
      helperSuppression: 0,
      whisperOnly: false,
      doubleHeat: false,
      systemNoticeBias: 0,
    })),
    legacyOverlaySnapshot: {
      updatedAt: updatedAt as unknown as number,
      activeSeasonId: null,
      activeOverlays: [],
      upcomingOverlays: [],
    },
    health: {
      state: 'HEALTHY',
      checkedAt: updatedAt,
      activeProgramCount: 0,
      activeCampaignCount: 0,
      activeEventCount: 0,
      degradedProgramIds: [],
      failingEventIds: [],
    },
    summary: {
      programCount: 0,
      campaignCount: 0,
      eventCount: 0,
      visibleEventCount: 0,
      shadowEventCount: 0,
      activeSeasonId: null,
      dominantIntensity: 'NONE',
      whisperOnlyChannels: [],
      doubleHeatChannels: [],
      headline: 'No active chat liveops programs.',
    },
  };
}

export function normalizeChatLiveOpsProgram(program: ChatLiveOpsProgram): ChatLiveOpsProgram {
  const campaigns = [...program.campaigns]
    .map((campaign) => ({
      ...campaign,
      channels: uniqueChannels(campaign.channels),
      tags: uniqueStrings(campaign.tags) ?? [],
      worldEvents: campaign.worldEvents.map(normalizeEventForProgram),
      priority: finiteOrFallback(campaign.priority, 0),
      legendBias: finiteOrFallback(campaign.legendBias, 0),
      pressureBias: finiteOrFallback(campaign.pressureBias, 0),
      witnessBias: finiteOrFallback(campaign.witnessBias, 0),
      window: {
        ...campaign.window,
        warmupMs: Math.max(0, campaign.window.warmupMs),
        cooldownMs: Math.max(0, campaign.window.cooldownMs),
      },
    }))
    .sort((left, right) => right.priority - left.priority || (left.window.startsAt as unknown as number) - (right.window.startsAt as unknown as number));

  return {
    ...program,
    campaigns,
    tags: uniqueStrings(program.tags) ?? [],
    legendIds: uniqueStrings(program.legendIds),
    replayIds: uniqueStrings(program.replayIds),
    season: program.season
      ? {
          ...program.season,
          tags: uniqueStrings(program.season.tags) ?? [],
          narrativeGoals: uniqueStrings(program.season.narrativeGoals) ?? [],
        }
      : program.season,
  };
}

export function summarizeChatLiveOpsSnapshot(snapshot: ChatLiveOpsSnapshot): ChatLiveOpsSummary {
  const visibleEventCount = snapshot.activeEvents.filter((event) => event.visibility !== 'SHADOW_ONLY').length;
  const shadowEventCount = snapshot.activeEvents.length - visibleEventCount;
  const whisperOnlyChannels = snapshot.channelState.filter((state) => state.whisperOnly).map((state) => state.channelId);
  const doubleHeatChannels = snapshot.channelState.filter((state) => state.doubleHeat).map((state) => state.channelId);
  const dominantIntensity = deriveDominantIntensity(snapshot.activeEvents);

  return {
    programCount: snapshot.programs.length,
    campaignCount: snapshot.activeCampaigns.length,
    eventCount: snapshot.activeEvents.length,
    visibleEventCount,
    shadowEventCount,
    activeSeasonId: snapshot.activeSeason?.seasonId ?? null,
    dominantIntensity,
    whisperOnlyChannels,
    doubleHeatChannels,
    headline:
      snapshot.activeEvents.length === 0
        ? 'No active chat liveops programs.'
        : `${snapshot.activeEvents.length} liveops event${snapshot.activeEvents.length === 1 ? '' : 's'} shaping the chat world.`,
  };
}

export function collectChatLiveOpsChannels(program: ChatLiveOpsProgram): readonly ChatChannelId[] {
  const collected = new Set<ChatChannelId>();
  for (const campaign of program.campaigns) {
    for (const channel of campaign.channels) collected.add(channel);
    for (const event of campaign.worldEvents) {
      for (const channel of collectWorldEventTargetChannels(event)) collected.add(channel);
    }
  }
  return Array.from(collected);
}

export function buildLegacyOverlaySnapshot(
  updatedAt: UnixMs,
  programs: readonly ChatLiveOpsProgram[],
): ChatLiveOpsOverlaySnapshot {
  const activeOverlays: ChatLiveOpsOverlayDefinition[] = [];
  const upcomingOverlays: ChatLiveOpsOverlayDefinition[] = [];
  let activeSeasonId: string | null | undefined = null;

  for (const program of programs) {
    if (program.season?.phase && program.season.phase !== 'ARCHIVED') {
      activeSeasonId ??= program.season.seasonId;
    }

    for (const campaign of program.campaigns) {
      for (const event of campaign.worldEvents) {
        const overlay = projectWorldEventToLegacyOverlayDefinition(event);
        if (event.state === 'LIVE' || event.state === 'PRELIVE' || event.state === 'ARMED') {
          activeOverlays.push(overlay);
        } else if (event.state === 'SCHEDULED' || event.state === 'DRAFT') {
          upcomingOverlays.push(overlay);
        }
      }
    }
  }

  return {
    updatedAt: updatedAt as unknown as number,
    activeSeasonId,
    activeOverlays,
    upcomingOverlays,
  };
}

export function projectWorldEventToLegacyOverlayDefinition(event: ChatWorldEventDefinition): ChatLiveOpsOverlayDefinition {
  return projectChatWorldEventToLegacyOverlayDefinition(event);
}

export function buildOverlayContextsFromEvents(
  now: UnixMs,
  events: readonly ChatWorldEventDefinition[],
): readonly ChatLiveOpsOverlayContext[] {
  return events.map((event) => ({
    now: now as unknown as number,
    overlayId: String(event.eventId),
    displayName: event.displayName,
    kind: event.overlayKind,
    intensity: event.intensity,
    seasonId: null,
    headline: event.announcement.headline,
    tags: event.tags,
    transformBiases: deriveOverlayBiases(event),
    pressureDelta: event.pressure.audienceHeatDelta,
    publicnessDelta: event.pressure.visibleHeatDelta,
    callbackAggressionDelta: event.pressure.rivalAggressionDelta,
    notes: event.notes ?? [],
  }));
}

export function buildChatLiveOpsHealthSnapshot(
  checkedAt: UnixMs,
  programs: readonly ChatLiveOpsProgram[],
  activeCampaigns: readonly ChatLiveOpsCampaign[],
  activeEvents: readonly ChatWorldEventDefinition[],
): ChatLiveOpsHealthSnapshot {
  const degradedProgramIds = programs.filter((program) => program.state === 'DEGRADED').map((program) => program.programId);
  const failingEventIds = activeEvents.filter((event) => event.state === 'CANCELLED').map((event) => String(event.eventId));

  const state: ChatLiveOpsHealthState = failingEventIds.length > 0
    ? 'FAILING'
    : degradedProgramIds.length > 0
      ? 'DEGRADED'
      : activeEvents.length === 0
        ? 'WATCH'
        : 'HEALTHY';

  return {
    state,
    checkedAt,
    activeProgramCount: programs.length,
    activeCampaignCount: activeCampaigns.length,
    activeEventCount: activeEvents.length,
    degradedProgramIds,
    failingEventIds,
    safeModeReason: state === 'FAILING' ? 'One or more active liveops events entered a cancelled/failing state.' : undefined,
  };
}

export function buildChatLiveOpsSnapshot(
  updatedAt: UnixMs,
  state: ChatLiveOpsProgramState,
  programs: readonly ChatLiveOpsProgram[],
  activeCampaigns: readonly ChatLiveOpsCampaign[],
  activeEvents: readonly ChatWorldEventDefinition[],
  activations: readonly ChatLiveOpsActivationRecord[],
  activeSeason?: ChatLiveOpsSeasonTheme | null,
): ChatLiveOpsSnapshot {
  const legacyOverlaySnapshot = buildLegacyOverlaySnapshot(updatedAt, programs);
  const channelState = buildRuntimeChannelState(programs, activeEvents);
  const health = buildChatLiveOpsHealthSnapshot(updatedAt, programs, activeCampaigns, activeEvents);

  const base: ChatLiveOpsSnapshot = {
    version: CHAT_LIVEOPS_VERSION,
    worldEventVersion: CHAT_WORLD_EVENT_VERSION,
    updatedAt,
    state,
    activeSeason: activeSeason ?? null,
    programs,
    activeCampaigns,
    activeEvents,
    activations,
    channelState,
    legacyOverlaySnapshot,
    health,
    summary: {
      programCount: 0,
      campaignCount: 0,
      eventCount: 0,
      visibleEventCount: 0,
      shadowEventCount: 0,
      activeSeasonId: activeSeason?.seasonId ?? null,
      dominantIntensity: 'NONE',
      whisperOnlyChannels: [],
      doubleHeatChannels: [],
      headline: '',
    },
  };

  return {
    ...base,
    summary: summarizeChatLiveOpsSnapshot(base),
  };
}

export function summarizeWorldEventsForLiveOps(
  events: readonly ChatWorldEventDefinition[],
): readonly ChatWorldEventSummary[] {
  return events.map((event) => summarizeChatWorldEvent(event));
}

export function previewWorldEventsForLiveOps(
  events: readonly ChatWorldEventDefinition[],
): readonly ChatWorldEventPreview[] {
  return events.map(previewChatWorldEvent);
}

function buildRuntimeChannelState(
  programs: readonly ChatLiveOpsProgram[],
  activeEvents: readonly ChatWorldEventDefinition[],
): readonly ChatLiveOpsRuntimeChannelState[] {
  return CHAT_ALL_CHANNELS.map((channelId) => {
    const activeProgramIds = new Set<string>();
    const activeCampaignIds = new Set<string>();
    const activeEventIds = new Set<string>();

    let visiblePressure = 0;
    let latentPressure = 0;
    let helperSuppression = 0;
    let whisperOnly = false;
    let doubleHeat = false;
    let systemNoticeBias = 0;

    for (const program of programs) {
      for (const campaign of program.campaigns) {
        if (campaign.channels.includes(channelId)) {
          activeProgramIds.add(program.programId);
          activeCampaignIds.add(campaign.campaignId);
        }
      }
    }

    for (const event of activeEvents) {
      const targets = collectWorldEventTargetChannels(event);
      if (!targets.includes(channelId)) continue;

      activeEventIds.add(String(event.eventId));
      visiblePressure += event.pressure.visibleHeatDelta;
      latentPressure += event.pressure.shadowHeatDelta;
      helperSuppression += event.pressure.helperSuppressionDelta;
      whisperOnly ||= event.pressure.whisperDelta > 0 || event.kind === 'WHISPER_ONLY';
      doubleHeat ||= event.kind === 'DOUBLE_HEAT';
      systemNoticeBias += event.announcement.mode === 'SYSTEM_NOTICE' ? 1 : 0;
    }

    return {
      channelId,
      activeProgramIds: Array.from(activeProgramIds),
      activeCampaignIds: Array.from(activeCampaignIds),
      activeEventIds: Array.from(activeEventIds),
      visiblePressure,
      latentPressure,
      helperSuppression,
      whisperOnly,
      doubleHeat,
      systemNoticeBias,
    };
  });
}

function normalizeEventForProgram(event: ChatWorldEventDefinition): ChatWorldEventDefinition {
  return {
    ...event,
    scope: {
      ...event.scope,
      channels: uniqueChannels(event.scope.channels),
    },
    tags: uniqueStrings(event.tags) ?? [],
  };
}

function deriveDominantIntensity(
  events: readonly ChatWorldEventDefinition[],
): ChatLiveOpsIntensityBand | 'NONE' {
  const scores: Record<ChatLiveOpsIntensityBand, number> = {
    QUIET: 0,
    ACTIVE: 0,
    SEVERE: 0,
    WORLD_CLASS: 0,
  };

  for (const event of events) {
    scores[event.intensity] += 1;
  }

  const ordered: readonly ChatLiveOpsIntensityBand[] = ['WORLD_CLASS', 'SEVERE', 'ACTIVE', 'QUIET'];
  for (const intensity of ordered) {
    if (scores[intensity] > 0) return intensity;
  }
  return 'NONE';
}

function deriveOverlayBiases(event: ChatWorldEventDefinition): readonly string[] {
  const biases = new Set<string>();
  biases.add(event.kind.toLowerCase());
  biases.add(event.intensity.toLowerCase());
  if (event.visibility === 'SHADOW_ONLY') biases.add('shadow');
  if (event.kind === 'DOUBLE_HEAT') biases.add('double-heat');
  if (event.kind === 'WHISPER_ONLY') biases.add('whisper');
  if (event.kind === 'HELPER_BLACKOUT') biases.add('helper-blackout');
  return Array.from(biases);
}

function uniqueStrings<T extends string>(values: readonly T[] | undefined): readonly T[] | undefined {
  if (!values) return values;
  return Array.from(new Set(values));
}

function uniqueChannels(values: readonly ChatChannelId[] | undefined): readonly ChatChannelId[] {
  return Array.from(new Set((values ?? []).filter((value): value is ChatChannelId => (CHAT_ALL_CHANNELS as readonly string[]).includes(value))));
}

function finiteOrFallback(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}
