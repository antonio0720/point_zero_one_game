/* eslint-disable max-lines */
/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT LIVEOPS SEASONAL EVENT DIRECTOR
 * FILE: pzo-web/src/engines/chat/liveops/SeasonalChatEventDirector.ts
 * VERSION: 2026.03.21-seasonal-liveops-director.v2
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Frontend orchestration layer that keeps the chat world feeling alive even
 * when the local player is not the only axis of importance.
 *
 * This upgrade keeps the original authority split intact while deepening the
 * local runtime into a real seasonal sequencing brain: queueing, dedupe,
 * acknowledgement, dismissal, diagnostics, planning projections, mount advice,
 * audit trails, import/export helpers, and replay-safe recovery.
 *
 * Design laws
 * -----------
 * 1. Backend remains authoritative for persistent truth.
 * 2. Frontend stages timing, banners, mount hints, and felt pressure.
 * 3. Visible reactions and shadow pressure are modeled separately.
 * 4. Trigger chains stay deterministic, explicit, and replay-safe.
 * 5. Contract objects are never mutated in place.
 * 6. Severe events surface fast without spamming every mount.
 * 7. Every activation can be explained after the fact.
 * 8. Local convenience never rewrites backend truth.
 * ============================================================================
 */

import type {
  ChatBridgeBatch,
  ChatBridgeChannel,
  ChatBridgeMountHint,
  ChatBridgeNotification,
  ChatBridgeRuntimeSnapshot,
  ChatBridgeSeverity,
} from '../ChatEventBridge';
import type {
  ChatChannelId,
  ChatRoomId,
  ChatUserId,
  UnixMs,
} from '../../../../../shared/contracts/chat/ChatChannels';
import type {
  ChatLiveOpsActivationRecord,
  ChatLiveOpsCampaign,
  ChatLiveOpsHealthSnapshot,
  ChatLiveOpsOperatorDirective,
  ChatLiveOpsProgram,
  ChatLiveOpsRuntimeChannelState,
  ChatLiveOpsSnapshot,
  ChatLiveOpsSummary,
} from '../../../../../shared/contracts/chat/ChatLiveOps';
import {
  buildChatLiveOpsHealthSnapshot,
  buildChatLiveOpsSnapshot,
  buildLegacyOverlaySnapshot,
  collectChatLiveOpsChannels,
  createEmptyChatLiveOpsSnapshot,
  normalizeChatLiveOpsProgram,
  summarizeChatLiveOpsSnapshot,
} from '../../../../../shared/contracts/chat/ChatLiveOps';
import type {
  ChatWorldEventDefinition,
  ChatWorldEventFanoutEnvelope,
  ChatWorldEventPreview,
  ChatWorldEventSummary,
} from '../../../../../shared/contracts/chat/ChatWorldEvent';
import {
  collectWorldEventTargetChannels,
  isChatWorldEventCooldown,
  isChatWorldEventLive,
  isChatWorldEventWarmup,
  normalizeChatWorldEvent,
  previewChatWorldEvent,
  summarizeChatWorldEvent,
} from '../../../../../shared/contracts/chat/ChatWorldEvent';

export type SeasonalLiveOpsListener = (snapshot: SeasonalChatEventDirectorSnapshot) => void;
export type SeasonalTransitionListener = (transition: SeasonalChatEventTransition) => void;
export type SeasonalAuditListener = (record: SeasonalChatEventAuditRecord) => void;
export type SeasonalLiveOpsClock = () => number;
export type SeasonalChatEventLifecycleState = 'IDLE' | 'WARMUP' | 'LIVE' | 'COOLDOWN';
export type SeasonalEventSource = 'PROGRAM' | 'BATCH_TRIGGER' | 'DIRECTIVE' | 'RECOVERY';
export type SeasonalMountTarget =
  | 'PRIMARY_DOCK'
  | 'MOMENT_FLASH'
  | 'HUD_RAIL'
  | 'CHANNEL_HEADER'
  | 'TRANSCRIPT_DRAWER'
  | 'COLLAPSED_PILL';
export type SeasonalAuditKind =
  | 'PROGRAM_REPLACED'
  | 'PROGRAM_INDEXED'
  | 'PROGRAM_ARMED'
  | 'PROGRAM_DISARMED'
  | 'DIRECTIVE_UPSERTED'
  | 'DIRECTIVE_CLEARED'
  | 'BATCH_INGESTED'
  | 'EVENT_ARMED'
  | 'EVENT_ACKED'
  | 'EVENT_DISMISSED'
  | 'EVENT_RESTORED'
  | 'EVENT_EXPIRED'
  | 'SNAPSHOT_EVALUATED'
  | 'STATE_IMPORTED'
  | 'STATE_EXPORTED'
  | 'RECOVERY_APPLIED';
export type SeasonalDismissReason =
  | 'USER_DISMISS'
  | 'PROGRAM_REPLACED'
  | 'PROGRAM_PAUSED'
  | 'MANUAL_CLEAR'
  | 'DEDUPE_SUPPRESSED'
  | 'EXPIRED'
  | 'SHADOW_ONLY'
  | 'LOW_PRIORITY';
export type SeasonalNotificationDisposition = 'VISIBLE' | 'SHADOW' | 'SUPPRESSED';
export type SeasonalPressureBand = 'QUIET' | 'RISING' | 'HOT' | 'SEVERE' | 'CRITICAL';

export interface SeasonalChatEventRuntimeTargeting {
  readonly roomIds: readonly ChatRoomId[];
  readonly playerIds: readonly ChatUserId[];
  readonly visibleChannels: readonly ChatChannelId[];
  readonly shadowChannels: readonly ChatChannelId[];
}

export interface SeasonalChatEventAudienceVector {
  readonly visiblePressure: number;
  readonly shadowPressure: number;
  readonly helperSuppression: number;
  readonly crowdHeat: number;
  readonly noveltyBias: number;
  readonly urgencyBias: number;
  readonly attentionWeight: number;
  readonly pressureBand: SeasonalPressureBand;
}

export interface SeasonalChatEventRuntimeState {
  readonly eventId: string;
  readonly source: SeasonalEventSource;
  readonly programId: string;
  readonly campaignId: string;
  readonly lifecycle: SeasonalChatEventLifecycleState;
  readonly activatedAt: UnixMs;
  readonly deactivatesAt: UnixMs;
  readonly preview: ChatWorldEventPreview;
  readonly summary: ChatWorldEventSummary;
  readonly targeting: SeasonalChatEventRuntimeTargeting;
  readonly audience: SeasonalChatEventAudienceVector;
  readonly pressureScore: number;
  readonly visiblePriority: number;
  readonly shadowPriority: number;
  readonly helperSuppressionScore: number;
  readonly crowdHeatScore: number;
  readonly noveltyScore: number;
  readonly urgencyScore: number;
  readonly dedupeKey: string;
  readonly visibilityDisposition: SeasonalNotificationDisposition;
  readonly batchTriggerEventType?: string;
  readonly notes: readonly string[];
}

export interface SeasonalChatEventTransition {
  readonly transitionId: string;
  readonly at: UnixMs;
  readonly kind:
    | 'PROGRAM_ARMED'
    | 'PROGRAM_DISARMED'
    | 'EVENT_WARMUP'
    | 'EVENT_LIVE'
    | 'EVENT_COOLDOWN'
    | 'EVENT_ENDED'
    | 'EVENT_ACKED'
    | 'EVENT_DISMISSED'
    | 'DIRECTIVE_APPLIED';
  readonly programId?: string;
  readonly campaignId?: string;
  readonly eventId?: string;
  readonly headline: string;
  readonly body: string;
  readonly severity: ChatBridgeSeverity;
}

export interface SeasonalChatEventAuditRecord {
  readonly auditId: string;
  readonly at: UnixMs;
  readonly kind: SeasonalAuditKind;
  readonly programId?: string;
  readonly campaignId?: string;
  readonly eventId?: string;
  readonly dedupeKey?: string;
  readonly headline: string;
  readonly details: readonly string[];
}

export interface SeasonalChatEventAcknowledgement {
  readonly eventId: string;
  readonly at: UnixMs;
  readonly byPlayerId?: ChatUserId;
  readonly channelId?: ChatChannelId;
}

export interface SeasonalChatEventDismissal {
  readonly eventId: string;
  readonly at: UnixMs;
  readonly reason: SeasonalDismissReason;
  readonly channelId?: ChatChannelId;
}

export interface SeasonalChatEventQueueEntry {
  readonly queueId: string;
  readonly eventId: string;
  readonly programId: string;
  readonly campaignId: string;
  readonly priority: number;
  readonly mountTarget: SeasonalMountTarget;
  readonly severity: ChatBridgeSeverity;
  readonly disposition: SeasonalNotificationDisposition;
  readonly insertedAt: UnixMs;
  readonly visibleChannels: readonly ChatChannelId[];
  readonly shadowChannels: readonly ChatChannelId[];
  readonly notes: readonly string[];
}

export interface SeasonalChatEventChannelProjection {
  readonly channelId: ChatChannelId;
  readonly activeEventIds: readonly string[];
  readonly visiblePressure: number;
  readonly shadowPressure: number;
  readonly helperSuppression: number;
  readonly crowdHeat: number;
  readonly programIds: readonly string[];
  readonly campaignIds: readonly string[];
  readonly mountBias: SeasonalMountTarget;
  readonly noticeBias: number;
  readonly pressureBand: SeasonalPressureBand;
}

export interface SeasonalChatEventProgramProjection {
  readonly programId: string;
  readonly campaignIds: readonly string[];
  readonly activeEventIds: readonly string[];
  readonly visiblePressure: number;
  readonly shadowPressure: number;
  readonly dominantBand: SeasonalPressureBand;
  readonly activeChannels: readonly ChatChannelId[];
}

export interface SeasonalChatEventCampaignProjection {
  readonly programId: string;
  readonly campaignId: string;
  readonly activeEventIds: readonly string[];
  readonly visiblePressure: number;
  readonly shadowPressure: number;
  readonly dominantBand: SeasonalPressureBand;
}

export interface SeasonalChatEventMountProjection {
  readonly target: SeasonalMountTarget;
  readonly severity: ChatBridgeSeverity;
  readonly eventIds: readonly string[];
  readonly headline: string;
  readonly body: string;
  readonly channelIds: readonly ChatChannelId[];
  readonly pressureBand: SeasonalPressureBand;
}

export interface SeasonalChatEventMetrics {
  readonly totalPrograms: number;
  readonly totalCampaigns: number;
  readonly totalIndexedEvents: number;
  readonly activeEvents: number;
  readonly warmupEvents: number;
  readonly liveEvents: number;
  readonly cooldownEvents: number;
  readonly visibleEvents: number;
  readonly shadowOnlyEvents: number;
  readonly dismissedEvents: number;
  readonly acknowledgedEvents: number;
  readonly queuedEffects: number;
  readonly channelsUnderPressure: number;
  readonly highestVisiblePressure: number;
  readonly highestShadowPressure: number;
}

export interface SeasonalChatEventQueryIndex {
  readonly programIds: readonly string[];
  readonly campaignIds: readonly string[];
  readonly eventIds: readonly string[];
  readonly channelIds: readonly ChatChannelId[];
  readonly roomIds: readonly ChatRoomId[];
  readonly playerIds: readonly ChatUserId[];
}

export interface SeasonalChatEventDiagnostics {
  readonly generatedAt: UnixMs;
  readonly metrics: SeasonalChatEventMetrics;
  readonly queryIndex: SeasonalChatEventQueryIndex;
  readonly channelProjections: readonly SeasonalChatEventChannelProjection[];
  readonly programProjections: readonly SeasonalChatEventProgramProjection[];
  readonly campaignProjections: readonly SeasonalChatEventCampaignProjection[];
  readonly mountProjections: readonly SeasonalChatEventMountProjection[];
  readonly queue: readonly SeasonalChatEventQueueEntry[];
  readonly acknowledgements: readonly SeasonalChatEventAcknowledgement[];
  readonly dismissals: readonly SeasonalChatEventDismissal[];
  readonly auditTrail: readonly SeasonalChatEventAuditRecord[];
}

export interface SeasonalChatEventManifest {
  readonly exportedAt: UnixMs;
  readonly runtime: ChatBridgeRuntimeSnapshot;
  readonly programs: readonly ChatLiveOpsProgram[];
  readonly directives: readonly ChatLiveOpsOperatorDirective[];
  readonly activeEvents: readonly SeasonalChatEventRuntimeState[];
  readonly transitions: readonly SeasonalChatEventTransition[];
  readonly queue: readonly SeasonalChatEventQueueEntry[];
  readonly acknowledgements: readonly SeasonalChatEventAcknowledgement[];
  readonly dismissals: readonly SeasonalChatEventDismissal[];
  readonly auditTrail: readonly SeasonalChatEventAuditRecord[];
}

export interface SeasonalChatEventDerivedBatchEffects {
  readonly notifications: readonly ChatBridgeNotification[];
  readonly mountHints: readonly ChatBridgeMountHint[];
  readonly fanout: readonly ChatWorldEventFanoutEnvelope[];
}

export interface SeasonalChatEventDirectorSnapshot {
  readonly now: UnixMs;
  readonly runtime: ChatBridgeRuntimeSnapshot;
  readonly health: ChatLiveOpsHealthSnapshot;
  readonly summary: ChatLiveOpsSummary;
  readonly liveops: ChatLiveOpsSnapshot;
  readonly activeEvents: readonly SeasonalChatEventRuntimeState[];
  readonly transitions: readonly SeasonalChatEventTransition[];
  readonly derivedBatchEffects: SeasonalChatEventDerivedBatchEffects;
  readonly legacyOverlaySnapshot: ReturnType<typeof buildLegacyOverlaySnapshot>;
  readonly diagnostics: SeasonalChatEventDiagnostics;
}

export interface SeasonalChatEventDirectorOptions {
  readonly clock?: SeasonalLiveOpsClock;
  readonly dedupeWindowMs?: number;
  readonly maxTransitionHistory?: number;
  readonly maxActiveEvents?: number;
  readonly maxDerivedNotificationsPerTick?: number;
  readonly maxAuditHistory?: number;
  readonly maxQueueEntries?: number;
  readonly lowShieldThreshold?: number;
  readonly highPressureThreshold?: number;
  readonly severeThreatThreshold?: number;
  readonly shadowPromotionThreshold?: number;
  readonly restoreDismissedAfterMs?: number;
  readonly defaultRoomScope?: readonly ChatRoomId[];
  readonly defaultPlayerScope?: readonly ChatUserId[];
}

const DEFAULT_OPTIONS: Required<Omit<
  SeasonalChatEventDirectorOptions,
  'defaultRoomScope' | 'defaultPlayerScope'
>> = {
  clock: () => Date.now(),
  dedupeWindowMs: 45_000,
  maxTransitionHistory: 128,
  maxActiveEvents: 48,
  maxDerivedNotificationsPerTick: 8,
  maxAuditHistory: 256,
  maxQueueEntries: 96,
  lowShieldThreshold: 1,
  highPressureThreshold: 0.74,
  severeThreatThreshold: 0.8,
  shadowPromotionThreshold: 0.67,
  restoreDismissedAfterMs: 120_000,
};

const PROGRAM_DISABLED_STATES = new Set<string>(['ENDED', 'ARCHIVED', 'PAUSED']);
const COOL_LIFECYCLES = new Set<SeasonalChatEventLifecycleState>(['COOLDOWN', 'IDLE']);
const SHADOW_ONLY_VISIBILITY = 'SHADOW_ONLY';
const EVENT_KIND_PRIORITY_BIAS: Readonly<Record<string, number>> = {
  COORDINATED_HATER_RAID: 0.95,
  LOW_SHIELD_HUNT: 0.92,
  MARKET_RUMOR_BURST: 0.63,
  FACTION_DEBATE: 0.58,
  DOUBLE_HEAT: 0.71,
};
const MOUNT_SEVERITY_WEIGHT: Readonly<Record<SeasonalMountTarget, number>> = {
  PRIMARY_DOCK: 0.75,
  MOMENT_FLASH: 1.0,
  HUD_RAIL: 0.72,
  CHANNEL_HEADER: 0.61,
  TRANSCRIPT_DRAWER: 0.55,
  COLLAPSED_PILL: 0.43,
};
const CHANNEL_MOUNT_PREFERENCE: Readonly<Record<string, SeasonalMountTarget>> = {
  GLOBAL: 'PRIMARY_DOCK',
  SYNDICATE: 'CHANNEL_HEADER',
  DEAL_ROOM: 'CHANNEL_HEADER',
  DIRECT: 'TRANSCRIPT_DRAWER',
  LOBBY: 'PRIMARY_DOCK',
  SPECTATOR: 'HUD_RAIL',
};

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

function stableNumber(value: number | undefined, fallback = 0): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return fallback;
  }
  return value;
}

function asUnixMs(value: number): UnixMs {
  return value as UnixMs;
}

function uniquePush<T>(current: readonly T[], value: T): readonly T[] {
  return current.includes(value) ? current : [...current, value];
}

function normalizeSeverity(score: number): ChatBridgeSeverity {
  if (score >= 0.85) {
    return 'CRITICAL';
  }
  if (score >= 0.55) {
    return 'WARNING';
  }
  if (score <= 0.2) {
    return 'SUCCESS';
  }
  return 'INFO';
}

function pressureBandFromScore(score: number): SeasonalPressureBand {
  if (score >= 0.92) {
    return 'CRITICAL';
  }
  if (score >= 0.75) {
    return 'SEVERE';
  }
  if (score >= 0.52) {
    return 'HOT';
  }
  if (score >= 0.25) {
    return 'RISING';
  }
  return 'QUIET';
}

function eventLifecycle(now: UnixMs, event: ChatWorldEventDefinition): SeasonalChatEventLifecycleState {
  if (isChatWorldEventWarmup(now, event.schedule)) {
    return 'WARMUP';
  }
  if (isChatWorldEventLive(event.state, now, event.schedule)) {
    return 'LIVE';
  }
  if (isChatWorldEventCooldown(now, event.schedule)) {
    return 'COOLDOWN';
  }
  return 'IDLE';
}

function buildDedupeKey(programId: string, campaignId: string, eventId: string, source: SeasonalEventSource): string {
  return `${source}:${programId}:${campaignId}:${eventId}`;
}

function buildQueueId(eventId: string, target: SeasonalMountTarget, insertedAt: UnixMs): string {
  return `${eventId}:${target}:${insertedAt}`;
}

function buildAuditId(kind: SeasonalAuditKind, at: UnixMs, eventId = 'none'): string {
  return `${kind}:${eventId}:${at}`;
}

function buildTransitionId(kind: SeasonalChatEventTransition['kind'], at: UnixMs, eventId = 'none'): string {
  return `${kind}:${eventId}:${at}`;
}

function toReadonlyChannels(channels: readonly ChatChannelId[]): readonly ChatChannelId[] {
  const seen = new Set<ChatChannelId>();
  const ordered: ChatChannelId[] = [];
  for (const channel of channels) {
    if (!seen.has(channel)) {
      seen.add(channel);
      ordered.push(channel);
    }
  }
  return ordered;
}

function toReadonlyRooms(rooms: readonly ChatRoomId[]): readonly ChatRoomId[] {
  const seen = new Set<ChatRoomId>();
  const ordered: ChatRoomId[] = [];
  for (const roomId of rooms) {
    if (!seen.has(roomId)) {
      seen.add(roomId);
      ordered.push(roomId);
    }
  }
  return ordered;
}

function toReadonlyPlayers(players: readonly ChatUserId[]): readonly ChatUserId[] {
  const seen = new Set<ChatUserId>();
  const ordered: ChatUserId[] = [];
  for (const playerId of players) {
    if (!seen.has(playerId)) {
      seen.add(playerId);
      ordered.push(playerId);
    }
  }
  return ordered;
}

function splitVisibleAndShadowChannels(
  channels: readonly ChatChannelId[],
): { visible: readonly ChatChannelId[]; shadow: readonly ChatChannelId[] } {
  const visible: ChatChannelId[] = [];
  const shadow: ChatChannelId[] = [];
  for (const channel of channels) {
    if (String(channel).endsWith('_SHADOW')) {
      shadow.push(channel);
      continue;
    }
    visible.push(channel);
  }
  return {
    visible: toReadonlyChannels(visible),
    shadow: toReadonlyChannels(shadow),
  };
}

function pickMountTarget(
  visibleChannels: readonly ChatChannelId[],
  visiblePriority: number,
  lifecycle: SeasonalChatEventLifecycleState,
): SeasonalMountTarget {
  if (visiblePriority >= 0.92) {
    return 'MOMENT_FLASH';
  }
  const dominant = visibleChannels[0];
  if (dominant) {
    return CHANNEL_MOUNT_PREFERENCE[String(dominant)] ?? 'PRIMARY_DOCK';
  }
  if (lifecycle === 'COOLDOWN') {
    return 'COLLAPSED_PILL';
  }
  if (lifecycle === 'WARMUP') {
    return 'HUD_RAIL';
  }
  return 'PRIMARY_DOCK';
}

function readRuntimeNumber(runtime: ChatBridgeRuntimeSnapshot, key: keyof ChatBridgeRuntimeSnapshot): number {
  const value = (runtime as unknown as Record<string, unknown>)[String(key)];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function buildEventBodyText(event: SeasonalChatEventRuntimeState): string {
  return event.notes[0] ?? event.summary.headline ?? event.preview.headline;
}

function deriveWorldEventVisibility(event: SeasonalChatEventRuntimeState): 'PUBLIC' | 'SHADOW_ONLY' | 'PUBLIC_WITH_SHADOW' {
  if (event.summary.shadowOnly) {
    return SHADOW_ONLY_VISIBILITY;
  }
  if (event.targeting.shadowChannels.length > 0) {
    return 'PUBLIC_WITH_SHADOW';
  }
  return 'PUBLIC';
}

function toChatBridgeMountTarget(target: SeasonalMountTarget): ChatBridgeNotification['target'] {
  switch (target) {
    case 'PRIMARY_DOCK':
      return 'PRIMARY_DOCK';
    case 'MOMENT_FLASH':
      return 'MOMENT_FLASH';
    case 'HUD_RAIL':
      return 'THREAT_RADAR_PANEL';
    case 'CHANNEL_HEADER':
      return 'PROOF_CARD';
    case 'TRANSCRIPT_DRAWER':
      return 'PROOF_CARD_V2';
    case 'COLLAPSED_PILL':
      return 'COUNTERPLAY_MODAL';
    default:
      return 'PRIMARY_DOCK';
  }
}

function derivePressureScore(event: ChatWorldEventDefinition, runtime: ChatBridgeRuntimeSnapshot): number {
  const pressureSignal = clamp01(
    (
      stableNumber(event.pressure.legendChargeDelta) +
      stableNumber(event.pressure.hostilityDelta) +
      stableNumber(event.pressure.intimidationDelta)
    ) / 300,
  );
  const roomSignal = clamp01(stableNumber(readRuntimeNumber(runtime, 'haterHeat')) / 100);
  const activeThreatSignal = clamp01(stableNumber(readRuntimeNumber(runtime, 'activeThreatCardCount')) / 8);
  return clamp01((pressureSignal * 0.45) + (roomSignal * 0.35) + (activeThreatSignal * 0.20));
}

function deriveHelperSuppressionScore(event: ChatWorldEventDefinition): number {
  return clamp01(stableNumber(event.pressure.helperSuppressionDelta) / 100);
}

function deriveCrowdHeatScore(event: ChatWorldEventDefinition): number {
  return clamp01(
    (stableNumber(event.pressure.audienceHeatDelta) + stableNumber(event.pressure.visibleHeatDelta)) / 200,
  );
}

function deriveNoveltyScore(event: ChatWorldEventDefinition): number {
  const bias = EVENT_KIND_PRIORITY_BIAS[event.kind] ?? 0.5;
  return clamp01((bias * 0.6) + (stableNumber(event.schedule.startsAt) > 0 ? 0.2 : 0) + 0.2);
}

function deriveUrgencyScore(
  now: UnixMs,
  lifecycle: SeasonalChatEventLifecycleState,
  event: ChatWorldEventDefinition,
): number {
  if (lifecycle === 'LIVE') {
    return 1;
  }
  const warmupRemaining = Math.max(0, stableNumber(event.schedule.startsAt) - now);
  if (lifecycle === 'WARMUP') {
    return clamp01(1 - (warmupRemaining / 120_000));
  }
  if (lifecycle === 'COOLDOWN') {
    return 0.25;
  }
  return 0;
}

function deriveVisibilityDisposition(
  event: ChatWorldEventDefinition,
  visiblePriority: number,
): SeasonalNotificationDisposition {
  const shadowOnly = (event.announcement.publishChannels?.length ?? 0) === 0
    && (event.announcement.shadowChannels?.length ?? 0) > 0;
  if (shadowOnly || (SHADOW_ONLY_VISIBILITY === 'SHADOW_ONLY' && shadowOnly)) {
    return 'SHADOW';
  }
  if (visiblePriority <= 0.1) {
    return 'SUPPRESSED';
  }
  return 'VISIBLE';
}

function deriveAudienceVector(
  visiblePriority: number,
  shadowPriority: number,
  helperSuppression: number,
  crowdHeat: number,
  novelty: number,
  urgency: number,
): SeasonalChatEventAudienceVector {
  const attentionWeight = clamp01(
    (visiblePriority * 0.4) +
    (shadowPriority * 0.15) +
    (crowdHeat * 0.15) +
    (urgency * 0.2) +
    (novelty * 0.1),
  );
  return {
    visiblePressure: visiblePriority,
    shadowPressure: shadowPriority,
    helperSuppression,
    crowdHeat,
    noveltyBias: novelty,
    urgencyBias: urgency,
    attentionWeight,
    pressureBand: pressureBandFromScore(Math.max(visiblePriority, shadowPriority)),
  };
}

function deriveTargeting(
  event: ChatWorldEventDefinition,
  options: SeasonalChatEventDirectorOptions,
): SeasonalChatEventRuntimeTargeting {
  const rawChannels = collectWorldEventTargetChannels(event);
  const split = splitVisibleAndShadowChannels(rawChannels);
  return {
    roomIds: toReadonlyRooms(event.scope.roomIds ?? options.defaultRoomScope ?? ([] as const)),
    playerIds: toReadonlyPlayers(event.scope.playerIds ?? options.defaultPlayerScope ?? ([] as const)),
    visibleChannels: split.visible,
    shadowChannels: split.shadow,
  };
}

function buildProgramIndex(programs: readonly ChatLiveOpsProgram[]): Map<string, ChatLiveOpsProgram> {
  const index = new Map<string, ChatLiveOpsProgram>();
  for (const program of programs) {
    index.set(program.programId, program);
  }
  return index;
}

function buildCampaignIndex(programs: readonly ChatLiveOpsProgram[]): Map<string, ChatLiveOpsCampaign> {
  const index = new Map<string, ChatLiveOpsCampaign>();
  for (const program of programs) {
    for (const campaign of program.campaigns) {
      index.set(`${program.programId}::${campaign.campaignId}`, campaign);
    }
  }
  return index;
}

function buildWorldEventIndex(
  programs: readonly ChatLiveOpsProgram[],
): Map<string, ChatWorldEventDefinition> {
  const index = new Map<string, ChatWorldEventDefinition>();
  for (const program of programs) {
    for (const campaign of program.campaigns) {
      for (const event of campaign.worldEvents) {
        index.set(`${program.programId}::${campaign.campaignId}::${event.eventId}`, event);
      }
    }
  }
  return index;
}

function createActivationRecord(event: SeasonalChatEventRuntimeState): ChatLiveOpsActivationRecord {
  return {
    activationId: `activation:${event.eventId}:${event.activatedAt}`,
    programId: event.programId,
    campaignId: event.campaignId,
    eventId: event.eventId,
    activatedAt: event.activatedAt,
    visibleChannels: event.targeting.visibleChannels,
    shadowChannels: event.targeting.shadowChannels,
    targetedRooms: event.targeting.roomIds,
    targetedPlayers: event.targeting.playerIds,
    generatedOverlayId: `overlay:${event.eventId}`,
  };
}

function buildQueueEntry(event: SeasonalChatEventRuntimeState, now: UnixMs): SeasonalChatEventQueueEntry {
  const mountTarget = pickMountTarget(event.targeting.visibleChannels, event.visiblePriority, event.lifecycle);
  return {
    queueId: buildQueueId(event.eventId, mountTarget, now),
    eventId: event.eventId,
    programId: event.programId,
    campaignId: event.campaignId,
    priority: clamp01(
      (event.visiblePriority * 0.55) +
      (event.shadowPriority * 0.1) +
      (event.noveltyScore * 0.15) +
      (event.urgencyScore * 0.2),
    ),
    mountTarget,
    severity: normalizeSeverity(event.visiblePriority),
    disposition: event.visibilityDisposition,
    insertedAt: now,
    visibleChannels: event.targeting.visibleChannels,
    shadowChannels: event.targeting.shadowChannels,
    notes: event.notes,
  };
}

function rankQueueEntries(
  entries: readonly SeasonalChatEventQueueEntry[],
): readonly SeasonalChatEventQueueEntry[] {
  return [...entries].sort((left, right) => {
    const score =
      (right.priority - left.priority) ||
      (MOUNT_SEVERITY_WEIGHT[right.mountTarget] - MOUNT_SEVERITY_WEIGHT[left.mountTarget]) ||
      (right.insertedAt - left.insertedAt);
    return score;
  });
}

function summarizeQueueHeadline(
  activeEvents: readonly SeasonalChatEventRuntimeState[],
): { headline: string; body: string } {
  if (activeEvents.length === 0) {
    return {
      headline: 'World pressure stable',
      body: 'No active seasonal disturbances are currently demanding front-stage attention.',
    };
  }
  const ranked = [...activeEvents].sort((left, right) => right.visiblePriority - left.visiblePriority);
  const top = ranked[0];
  if (!top) {
    return {
      headline: 'World pressure stable',
      body: 'No active seasonal disturbances are currently demanding front-stage attention.',
    };
  }
  return {
    headline: top.preview.headline,
    body: buildEventBodyText(top),
  };
}

function buildNotificationTitle(event: SeasonalChatEventRuntimeState): string {
  if (event.lifecycle === 'WARMUP') {
    return `Incoming: ${event.preview.headline}`;
  }
  if (event.lifecycle === 'COOLDOWN') {
    return `Cooling: ${event.preview.headline}`;
  }
  return event.preview.headline;
}

function buildDerivedNotifications(
  activeEvents: readonly SeasonalChatEventRuntimeState[],
  maxNotifications: number,
  now: UnixMs,
): SeasonalChatEventDerivedBatchEffects {
  const topEvents = [...activeEvents]
    .filter((event) => event.lifecycle === 'LIVE' || event.lifecycle === 'WARMUP')
    .sort((left, right) => (right.visiblePriority - left.visiblePriority) || (right.activatedAt - left.activatedAt))
    .slice(0, maxNotifications);

  const notifications: ChatBridgeNotification[] = topEvents.map((event, index) => ({
    id: `liveops:notice:${event.eventId}:${now}:${index}`,
    title: buildNotificationTitle(event),
    body: buildEventBodyText(event),
    severity: normalizeSeverity(event.visiblePriority),
    target: toChatBridgeMountTarget(pickMountTarget(event.targeting.visibleChannels, event.visiblePriority, event.lifecycle)),
    ts: now,
  }));

  const mountHints: ChatBridgeMountHint[] = topEvents.map((event) => ({
    target: toChatBridgeMountTarget(pickMountTarget(event.targeting.visibleChannels, event.visiblePriority, event.lifecycle)),
    severity: normalizeSeverity(event.visiblePriority),
    reason: `liveops:${event.eventId}`,
  }));

  const fanout: ChatWorldEventFanoutEnvelope[] = topEvents.map((event) => ({
    envelopeId: `fanout:${event.eventId}:${now}`,
    eventId: event.eventId as unknown as ChatWorldEventFanoutEnvelope['eventId'],
    createdAt: now,
    channels: event.preview.channels,
    roomIds: event.targeting.roomIds,
    headline: event.preview.headline,
    body: buildEventBodyText(event),
    detailLines: event.notes,
    visibility: deriveWorldEventVisibility(event),
    shadowOnly: event.summary.shadowOnly,
    tags: [],
  }));

  return {
    notifications,
    mountHints,
    fanout,
  };
}

function inferBatchTriggeredKinds(batch: ChatBridgeBatch, runtime: ChatBridgeRuntimeSnapshot): readonly string[] {
  const sourceEventType = batch.sourceEventType.toUpperCase();
  const isThreatening = batch.messages.some(
    (message: ChatBridgeBatch['messages'][number]) =>
      message.severity === 'CRITICAL' || message.kind === 'BOT_ATTACK',
  );
  const lowShieldCondition = batch.messages.some(
    (message: ChatBridgeBatch['messages'][number]) =>
      Boolean(message.targetLayerId) && sourceEventType.includes('SHIELD'),
  ) || (
    stableNumber(readRuntimeNumber(runtime, 'activeThreatCardCount')) > 0 &&
    stableNumber(readRuntimeNumber(runtime, 'cashflow')) < 0 &&
    stableNumber(readRuntimeNumber(runtime, 'tick')) > 0
  );

  const triggeredKinds = new Set<string>();
  if (sourceEventType.includes('RUMOR')) {
    triggeredKinds.add('MARKET_RUMOR_BURST');
  }
  if (sourceEventType.includes('DEBATE')) {
    triggeredKinds.add('FACTION_DEBATE');
  }
  if (sourceEventType.includes('PRESSURE') || isThreatening) {
    triggeredKinds.add('COORDINATED_HATER_RAID');
  }
  if (lowShieldCondition) {
    triggeredKinds.add('LOW_SHIELD_HUNT');
  }
  return [...triggeredKinds.values()];
}

function extractVisibleBridgeChannels(runtime: ChatBridgeRuntimeSnapshot): readonly ChatBridgeChannel[] {
  return Array.isArray(runtime.activeChannels) ? runtime.activeChannels : ([] as const);
}

function createEmptyRuntimeSnapshot(): ChatBridgeRuntimeSnapshot {
  return {
    mode: 'SURVIVAL' as never,
    activeChannels: [] as const,
  };
}

export class SeasonalChatEventDirector {
  private readonly options: SeasonalChatEventDirectorOptions;
  private readonly clock: SeasonalLiveOpsClock;
  private readonly listeners = new Set<SeasonalLiveOpsListener>();
  private readonly transitionListeners = new Set<SeasonalTransitionListener>();
  private readonly auditListeners = new Set<SeasonalAuditListener>();

  private programs: ChatLiveOpsProgram[] = [];
  private directives: ChatLiveOpsOperatorDirective[] = [];
  private runtime: ChatBridgeRuntimeSnapshot = createEmptyRuntimeSnapshot();

  private transitions: SeasonalChatEventTransition[] = [];
  private auditTrail: SeasonalChatEventAuditRecord[] = [];
  private queue: SeasonalChatEventQueueEntry[] = [];
  private acknowledgements = new Map<string, SeasonalChatEventAcknowledgement>();
  private dismissals = new Map<string, SeasonalChatEventDismissal>();

  private programIndex = new Map<string, ChatLiveOpsProgram>();
  private campaignIndex = new Map<string, ChatLiveOpsCampaign>();
  private worldEventIndex = new Map<string, ChatWorldEventDefinition>();

  private activeEventsByKey = new Map<string, SeasonalChatEventRuntimeState>();
  private activeEventsById = new Map<string, SeasonalChatEventRuntimeState>();
  private programProjections = new Map<string, SeasonalChatEventProgramProjection>();
  private campaignProjections = new Map<string, SeasonalChatEventCampaignProjection>();
  private channelProjections = new Map<ChatChannelId, SeasonalChatEventChannelProjection>();
  private mountProjections = new Map<SeasonalMountTarget, SeasonalChatEventMountProjection>();
  private batchHistory: ChatBridgeBatch[] = [];

  private snapshot: SeasonalChatEventDirectorSnapshot;

  public constructor(
    programs: readonly ChatLiveOpsProgram[] = [],
    options: SeasonalChatEventDirectorOptions = {},
  ) {
    this.options = options;
    this.clock = options.clock ?? DEFAULT_OPTIONS.clock;
    this.programs = programs.map(normalizeChatLiveOpsProgram);
    this.rebuildProgramIndexes();
    const now = asUnixMs(this.clock());
    const emptyLiveops = createEmptyChatLiveOpsSnapshot(now);
    this.snapshot = {
      now,
      runtime: this.runtime,
      health: buildChatLiveOpsHealthSnapshot(now, this.programs, [], []),
      summary: summarizeChatLiveOpsSnapshot(emptyLiveops),
      liveops: emptyLiveops,
      activeEvents: [],
      transitions: [],
      derivedBatchEffects: {
        notifications: [],
        mountHints: [],
        fanout: [],
      },
      legacyOverlaySnapshot: buildLegacyOverlaySnapshot(now, this.programs),
      diagnostics: this.createEmptyDiagnostics(now),
    };
    this.pushAudit({
      auditId: buildAuditId('PROGRAM_REPLACED', now),
      at: now,
      kind: 'PROGRAM_REPLACED',
      headline: 'Seasonal programs initialized',
      details: [`Program count: ${this.programs.length}`],
    });
    this.evaluate(now);
  }

  public subscribe(listener: SeasonalLiveOpsListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public subscribeTransitions(listener: SeasonalTransitionListener): () => void {
    this.transitionListeners.add(listener);
    return () => {
      this.transitionListeners.delete(listener);
    };
  }

  public subscribeAudit(listener: SeasonalAuditListener): () => void {
    this.auditListeners.add(listener);
    return () => {
      this.auditListeners.delete(listener);
    };
  }

  public replacePrograms(programs: readonly ChatLiveOpsProgram[]): SeasonalChatEventDirectorSnapshot {
    this.programs = programs.map(normalizeChatLiveOpsProgram);
    this.rebuildProgramIndexes();
    const now = asUnixMs(this.clock());
    this.pushAudit({
      auditId: buildAuditId('PROGRAM_REPLACED', now),
      at: now,
      kind: 'PROGRAM_REPLACED',
      headline: 'Seasonal programs replaced',
      details: [`Program count: ${this.programs.length}`],
    });
    return this.evaluate(now);
  }

  public appendPrograms(programs: readonly ChatLiveOpsProgram[]): SeasonalChatEventDirectorSnapshot {
    this.programs = [
      ...this.programs,
      ...programs.map(normalizeChatLiveOpsProgram),
    ];
    this.rebuildProgramIndexes();
    const now = asUnixMs(this.clock());
    this.pushAudit({
      auditId: buildAuditId('PROGRAM_ARMED', now),
      at: now,
      kind: 'PROGRAM_ARMED',
      headline: 'Seasonal programs appended',
      details: [`Appended: ${programs.length}`, `Total: ${this.programs.length}`],
    });
    return this.evaluate(now);
  }

  public upsertDirective(directive: ChatLiveOpsOperatorDirective): SeasonalChatEventDirectorSnapshot {
    const filtered = this.directives.filter((entry) => entry.directiveId !== directive.directiveId);
    filtered.push(directive);
    this.directives = filtered.sort((left, right) => right.createdAt - left.createdAt);
    const now = asUnixMs(this.clock());
    this.pushAudit({
      auditId: buildAuditId('DIRECTIVE_UPSERTED', now),
      at: now,
      kind: 'DIRECTIVE_UPSERTED',
      headline: `Directive upserted: ${directive.directiveId}`,
      details: [`Total directives: ${this.directives.length}`],
    });
    this.pushTransition({
      transitionId: buildTransitionId('DIRECTIVE_APPLIED', now),
      at: now,
      kind: 'DIRECTIVE_APPLIED',
      headline: `Directive applied`,
      body: directive.directiveId,
      severity: 'INFO',
    });
    return this.evaluate(now);
  }

  public clearDirective(directiveId: string): SeasonalChatEventDirectorSnapshot {
    this.directives = this.directives.filter((entry) => entry.directiveId !== directiveId);
    const now = asUnixMs(this.clock());
    this.pushAudit({
      auditId: buildAuditId('DIRECTIVE_CLEARED', now),
      at: now,
      kind: 'DIRECTIVE_CLEARED',
      headline: `Directive cleared: ${directiveId}`,
      details: [`Remaining directives: ${this.directives.length}`],
    });
    return this.evaluate(now);
  }

  public ingestBatch(batch: ChatBridgeBatch): SeasonalChatEventDirectorSnapshot {
    this.runtime = batch.snapshot;
    this.batchHistory = [batch, ...this.batchHistory].slice(0, 32);
    const now = asUnixMs(this.clock());
    const triggered = this.inferBatchTriggeredEvents(batch, now);

    for (const state of triggered) {
      const previous = this.activeEventsByKey.get(state.dedupeKey);
      const dismissed = this.dismissals.get(state.eventId);
      if (previous && (now - previous.activatedAt) < (this.options.dedupeWindowMs ?? DEFAULT_OPTIONS.dedupeWindowMs)) {
        this.pushAudit({
          auditId: buildAuditId('EVENT_DISMISSED', now, state.eventId),
          at: now,
          kind: 'EVENT_DISMISSED',
          eventId: state.eventId,
          programId: state.programId,
          campaignId: state.campaignId,
          dedupeKey: state.dedupeKey,
          headline: `Dedupe suppressed ${state.eventId}`,
          details: [`Source event type: ${batch.sourceEventType}`],
        });
        continue;
      }
      if (dismissed && (now - dismissed.at) < (this.options.restoreDismissedAfterMs ?? DEFAULT_OPTIONS.restoreDismissedAfterMs)) {
        continue;
      }
      this.activateEvent({
        ...state,
        batchTriggerEventType: batch.sourceEventType,
      }, now);
    }

    this.pushAudit({
      auditId: buildAuditId('BATCH_INGESTED', now),
      at: now,
      kind: 'BATCH_INGESTED',
      headline: `Batch ingested: ${batch.sourceEventType}`,
      details: [
        `Messages: ${batch.messages.length}`,
        `Active bridge channels: ${extractVisibleBridgeChannels(batch.snapshot).length}`,
      ],
    });

    return this.evaluate(now);
  }

  public acknowledgeEvent(
    eventId: string,
    byPlayerId?: ChatUserId,
    channelId?: ChatChannelId,
  ): SeasonalChatEventDirectorSnapshot {
    const now = asUnixMs(this.clock());
    const acknowledgement: SeasonalChatEventAcknowledgement = {
      eventId,
      at: now,
      ...(byPlayerId ? { byPlayerId } : {}),
      ...(channelId ? { channelId } : {}),
    };
    this.acknowledgements.set(eventId, acknowledgement);
    this.pushTransition({
      transitionId: buildTransitionId('EVENT_ACKED', now, eventId),
      at: now,
      kind: 'EVENT_ACKED',
      eventId,
      headline: `Event acknowledged`,
      body: eventId,
      severity: 'INFO',
    });
    this.pushAudit({
      auditId: buildAuditId('EVENT_ACKED', now, eventId),
      at: now,
      kind: 'EVENT_ACKED',
      eventId,
      headline: `Acknowledged ${eventId}`,
      details: [
        byPlayerId ? `Player: ${byPlayerId}` : 'Player: system',
        channelId ? `Channel: ${channelId}` : 'Channel: none',
      ],
    });
    return this.evaluate(now);
  }

  public dismissEvent(
    eventId: string,
    reason: SeasonalDismissReason,
    channelId?: ChatChannelId,
  ): SeasonalChatEventDirectorSnapshot {
    const now = asUnixMs(this.clock());
    this.dismissals.set(eventId, {
      eventId,
      at: now,
      reason,
      ...(channelId ? { channelId } : {}),
    });
    this.activeEventsById.delete(eventId);
    for (const [key, value] of this.activeEventsByKey.entries()) {
      if (value.eventId === eventId) {
        this.activeEventsByKey.delete(key);
      }
    }
    this.pushTransition({
      transitionId: buildTransitionId('EVENT_DISMISSED', now, eventId),
      at: now,
      kind: 'EVENT_DISMISSED',
      eventId,
      headline: `Event dismissed`,
      body: `${eventId} (${reason})`,
      severity: 'INFO',
    });
    this.pushAudit({
      auditId: buildAuditId('EVENT_DISMISSED', now, eventId),
      at: now,
      kind: 'EVENT_DISMISSED',
      eventId,
      headline: `Dismissed ${eventId}`,
      details: [reason, channelId ? `Channel: ${channelId}` : 'Channel: none'],
    });
    return this.evaluate(now);
  }

  public restoreDismissedEvent(eventId: string): SeasonalChatEventDirectorSnapshot {
    const dismissal = this.dismissals.get(eventId);
    if (!dismissal) {
      return this.snapshot;
    }
    this.dismissals.delete(eventId);
    const now = asUnixMs(this.clock());
    this.pushAudit({
      auditId: buildAuditId('EVENT_RESTORED', now, eventId),
      at: now,
      kind: 'EVENT_RESTORED',
      eventId,
      headline: `Dismissed event restored`,
      details: [`Previous reason: ${dismissal.reason}`],
    });
    return this.evaluate(now);
  }

  public getSnapshot(): SeasonalChatEventDirectorSnapshot {
    return this.snapshot;
  }

  public getPrograms(): readonly ChatLiveOpsProgram[] {
    return [...this.programs];
  }

  public getDirectives(): readonly ChatLiveOpsOperatorDirective[] {
    return [...this.directives];
  }

  public getQueue(): readonly SeasonalChatEventQueueEntry[] {
    return [...this.queue];
  }

  public getTransitions(): readonly SeasonalChatEventTransition[] {
    return [...this.transitions];
  }

  public getAuditTrail(): readonly SeasonalChatEventAuditRecord[] {
    return [...this.auditTrail];
  }

  public getActiveEvents(): readonly SeasonalChatEventRuntimeState[] {
    return [...this.activeEventsById.values()].sort(
      (left, right) => (right.visiblePriority - left.visiblePriority) || (right.shadowPriority - left.shadowPriority),
    );
  }

  public getEventById(eventId: string): SeasonalChatEventRuntimeState | null {
    return this.activeEventsById.get(eventId) ?? null;
  }

  public getProgramProjection(programId: string): SeasonalChatEventProgramProjection | null {
    return this.programProjections.get(programId) ?? null;
  }

  public getCampaignProjection(programId: string, campaignId: string): SeasonalChatEventCampaignProjection | null {
    return this.campaignProjections.get(`${programId}::${campaignId}`) ?? null;
  }

  public getChannelProjection(channelId: ChatChannelId): SeasonalChatEventChannelProjection | null {
    return this.channelProjections.get(channelId) ?? null;
  }

  public getMountProjection(target: SeasonalMountTarget): SeasonalChatEventMountProjection | null {
    return this.mountProjections.get(target) ?? null;
  }

  public getDiagnostics(): SeasonalChatEventDiagnostics {
    return this.snapshot.diagnostics;
  }

  public exportManifest(): SeasonalChatEventManifest {
    const now = asUnixMs(this.clock());
    this.pushAudit({
      auditId: buildAuditId('STATE_EXPORTED', now),
      at: now,
      kind: 'STATE_EXPORTED',
      headline: 'Director state exported',
      details: [`Events: ${this.activeEventsById.size}`],
    });
    return {
      exportedAt: now,
      runtime: this.runtime,
      programs: [...this.programs],
      directives: [...this.directives],
      activeEvents: this.getActiveEvents(),
      transitions: this.getTransitions(),
      queue: this.getQueue(),
      acknowledgements: [...this.acknowledgements.values()],
      dismissals: [...this.dismissals.values()],
      auditTrail: this.getAuditTrail(),
    };
  }

  public exportNdjson(): string {
    const manifest = this.exportManifest();
    const lines = [
      JSON.stringify({ kind: 'runtime', value: manifest.runtime }),
      ...manifest.programs.map((program) => JSON.stringify({ kind: 'program', value: program })),
      ...manifest.directives.map((directive) => JSON.stringify({ kind: 'directive', value: directive })),
      ...manifest.activeEvents.map((event) => JSON.stringify({ kind: 'activeEvent', value: event })),
      ...manifest.transitions.map((transition) => JSON.stringify({ kind: 'transition', value: transition })),
      ...manifest.queue.map((entry) => JSON.stringify({ kind: 'queueEntry', value: entry })),
      ...manifest.acknowledgements.map((ack) => JSON.stringify({ kind: 'ack', value: ack })),
      ...manifest.dismissals.map((dismissal) => JSON.stringify({ kind: 'dismissal', value: dismissal })),
      ...manifest.auditTrail.map((audit) => JSON.stringify({ kind: 'audit', value: audit })),
    ];
    return lines.join('\n');
  }

  public importManifest(manifest: SeasonalChatEventManifest): SeasonalChatEventDirectorSnapshot {
    this.runtime = manifest.runtime;
    this.programs = manifest.programs.map(normalizeChatLiveOpsProgram);
    this.directives = [...manifest.directives];
    this.transitions = [...manifest.transitions];
    this.queue = [...manifest.queue];
    this.auditTrail = [...manifest.auditTrail];
    this.acknowledgements = new Map(
      manifest.acknowledgements.map((ack) => [ack.eventId, ack]),
    );
    this.dismissals = new Map(
      manifest.dismissals.map((dismissal) => [dismissal.eventId, dismissal]),
    );
    this.rebuildProgramIndexes();
    this.activeEventsById.clear();
    this.activeEventsByKey.clear();
    for (const event of manifest.activeEvents) {
      this.activeEventsById.set(event.eventId, event);
      this.activeEventsByKey.set(event.dedupeKey, event);
    }
    const now = asUnixMs(this.clock());
    this.pushAudit({
      auditId: buildAuditId('STATE_IMPORTED', now),
      at: now,
      kind: 'STATE_IMPORTED',
      headline: 'Director state imported',
      details: [`Imported active events: ${manifest.activeEvents.length}`],
    });
    return this.evaluate(now);
  }

  public evaluate(nowArg?: UnixMs): SeasonalChatEventDirectorSnapshot {
    const now = nowArg ?? asUnixMs(this.clock());
    const generatedEvents = this.collectProgramEvents(now);
    const retainedEvents = this.collectRetainedTriggeredEvents(now);
    const allActive = this.mergeActiveEvents(generatedEvents, retainedEvents, now);

    this.activeEventsById = new Map(allActive.map((event) => [event.eventId, event]));
    this.activeEventsByKey = new Map(allActive.map((event) => [event.dedupeKey, event]));

    this.queue = this.buildQueue(allActive, now);
    this.rebuildProjections(allActive);
    const activations = allActive.map(createActivationRecord);

    const resolvedEvents = allActive
      .map((event) => this.findWorldEvent(event.programId, event.campaignId, event.eventId))
      .filter((event): event is ChatWorldEventDefinition => Boolean(event))
      .map((event) => normalizeChatWorldEvent(event));

    const activeCampaigns = this.collectActiveCampaigns(allActive);
    const liveopsState = this.deriveLiveOpsState(allActive);
    const activeSeason = this.deriveActiveSeason();
    const liveops = buildChatLiveOpsSnapshot(
      now,
      liveopsState,
      this.programs,
      activeCampaigns,
      resolvedEvents,
      activations,
      activeSeason,
    );
    const health = buildChatLiveOpsHealthSnapshot(now, this.programs, activeCampaigns, resolvedEvents);
    const summary = summarizeChatLiveOpsSnapshot(liveops);

    const derivedBatchEffects = buildDerivedNotifications(
      allActive,
      this.options.maxDerivedNotificationsPerTick ?? DEFAULT_OPTIONS.maxDerivedNotificationsPerTick,
      now,
    );

    const diagnostics = this.buildDiagnostics(now, allActive);

    this.snapshot = {
      now,
      runtime: this.runtime,
      health,
      summary,
      liveops,
      activeEvents: allActive,
      transitions: [...this.transitions],
      derivedBatchEffects,
      legacyOverlaySnapshot: buildLegacyOverlaySnapshot(now, this.programs),
      diagnostics,
    };

    this.pushAudit({
      auditId: buildAuditId('SNAPSHOT_EVALUATED', now),
      at: now,
      kind: 'SNAPSHOT_EVALUATED',
      headline: 'Snapshot evaluated',
      details: [
        `Active events: ${allActive.length}`,
        `Notifications: ${derivedBatchEffects.notifications.length}`,
        `Queue: ${this.queue.length}`,
      ],
    });

    this.emit();
    return this.snapshot;
  }

  public listByProgram(value: string): readonly SeasonalChatEventRuntimeState[] {
    return this.getActiveEvents().filter((event) => event.programId === value);
  }

  public countByProgram(value: string): number {
    return this.listByProgram(value).length;
  }

  public hasProgram(value: string): boolean {
    return this.countByProgram(value) > 0;
  }


  public listByCampaign(value: string): readonly SeasonalChatEventRuntimeState[] {
    return this.getActiveEvents().filter((event) => event.campaignId === value);
  }

  public countByCampaign(value: string): number {
    return this.listByCampaign(value).length;
  }

  public hasCampaign(value: string): boolean {
    return this.countByCampaign(value) > 0;
  }


  public listByEvent(value: string): readonly SeasonalChatEventRuntimeState[] {
    return this.getActiveEvents().filter((event) => event.eventId === value);
  }

  public countByEvent(value: string): number {
    return this.listByEvent(value).length;
  }

  public hasEvent(value: string): boolean {
    return this.countByEvent(value) > 0;
  }

  public listByChannel(channelId: ChatChannelId): readonly SeasonalChatEventRuntimeState[] {
    return this.getActiveEvents().filter(
      (event) =>
        event.targeting.visibleChannels.includes(channelId) ||
        event.targeting.shadowChannels.includes(channelId),
    );
  }

  public listVisibleByChannel(channelId: ChatChannelId): readonly SeasonalChatEventRuntimeState[] {
    return this.getActiveEvents().filter((event) => event.targeting.visibleChannels.includes(channelId));
  }

  public listShadowByChannel(channelId: ChatChannelId): readonly SeasonalChatEventRuntimeState[] {
    return this.getActiveEvents().filter((event) => event.targeting.shadowChannels.includes(channelId));
  }

  public listByRoom(roomId: ChatRoomId): readonly SeasonalChatEventRuntimeState[] {
    return this.getActiveEvents().filter((event) => event.targeting.roomIds.includes(roomId));
  }

  public listByPlayer(playerId: ChatUserId): readonly SeasonalChatEventRuntimeState[] {
    return this.getActiveEvents().filter((event) => event.targeting.playerIds.includes(playerId));
  }

  public listWarmupEvents(): readonly SeasonalChatEventRuntimeState[] {
    return this.getActiveEvents().filter((event) => event.lifecycle === 'WARMUP');
  }

  public listLiveEvents(): readonly SeasonalChatEventRuntimeState[] {
    return this.getActiveEvents().filter((event) => event.lifecycle === 'LIVE');
  }

  public listCooldownEvents(): readonly SeasonalChatEventRuntimeState[] {
    return this.getActiveEvents().filter((event) => event.lifecycle === 'COOLDOWN');
  }

  public listVisibleEvents(): readonly SeasonalChatEventRuntimeState[] {
    return this.getActiveEvents().filter((event) => event.visibilityDisposition === 'VISIBLE');
  }

  public listShadowOnlyEvents(): readonly SeasonalChatEventRuntimeState[] {
    return this.getActiveEvents().filter((event) => event.visibilityDisposition === 'SHADOW');
  }

  public listSuppressedEvents(): readonly SeasonalChatEventRuntimeState[] {
    return this.getActiveEvents().filter((event) => event.visibilityDisposition === 'SUPPRESSED');
  }

  public listAcknowledgedEvents(): readonly SeasonalChatEventRuntimeState[] {
    return this.getActiveEvents().filter((event) => this.acknowledgements.has(event.eventId));
  }

  public listDismissedEventIds(): readonly string[] {
    return [...this.dismissals.keys()].sort();
  }

  public getAcknowledgement(eventId: string): SeasonalChatEventAcknowledgement | null {
    return this.acknowledgements.get(eventId) ?? null;
  }

  public getDismissal(eventId: string): SeasonalChatEventDismissal | null {
    return this.dismissals.get(eventId) ?? null;
  }

  public getRuntimeChannels(): readonly ChatBridgeChannel[] {
    return extractVisibleBridgeChannels(this.runtime);
  }

  public getMountTargets(): readonly SeasonalMountTarget[] {
    return [...this.mountProjections.keys()];
  }

  public getMetrics(): SeasonalChatEventMetrics {
    return this.snapshot.diagnostics.metrics;
  }

  public findEventsByHeadlineFragment(fragment: string): readonly SeasonalChatEventRuntimeState[] {
    const lowered = fragment.trim().toLowerCase();
    if (!lowered) {
      return [];
    }
    return this.getActiveEvents().filter(
      (event) =>
        event.preview.headline.toLowerCase().includes(lowered) ||
        buildEventBodyText(event).toLowerCase().includes(lowered) ||
        event.notes.some((note) => note.toLowerCase().includes(lowered)),
    );
  }

  public getTopVisibleEvents(limit = 5): readonly SeasonalChatEventRuntimeState[] {
    return this.getActiveEvents()
      .slice()
      .sort((left, right) => right.visiblePriority - left.visiblePriority)
      .slice(0, Math.max(0, limit));
  }

  public getTopShadowEvents(limit = 5): readonly SeasonalChatEventRuntimeState[] {
    return this.getActiveEvents()
      .slice()
      .sort((left, right) => right.shadowPriority - left.shadowPriority)
      .slice(0, Math.max(0, limit));
  }

  public getTopQueueEntries(limit = 5): readonly SeasonalChatEventQueueEntry[] {
    return this.getQueue().slice(0, Math.max(0, limit));
  }

  private createEmptyDiagnostics(now: UnixMs): SeasonalChatEventDiagnostics {
    return {
      generatedAt: now,
      metrics: {
        totalPrograms: this.programs.length,
        totalCampaigns: 0,
        totalIndexedEvents: 0,
        activeEvents: 0,
        warmupEvents: 0,
        liveEvents: 0,
        cooldownEvents: 0,
        visibleEvents: 0,
        shadowOnlyEvents: 0,
        dismissedEvents: 0,
        acknowledgedEvents: 0,
        queuedEffects: 0,
        channelsUnderPressure: 0,
        highestVisiblePressure: 0,
        highestShadowPressure: 0,
      },
      queryIndex: {
        programIds: [],
        campaignIds: [],
        eventIds: [],
        channelIds: [],
        roomIds: [],
        playerIds: [],
      },
      channelProjections: [],
      programProjections: [],
      campaignProjections: [],
      mountProjections: [],
      queue: [],
      acknowledgements: [],
      dismissals: [],
      auditTrail: [],
    };
  }

  private rebuildProgramIndexes(): void {
    this.programIndex = buildProgramIndex(this.programs);
    this.campaignIndex = buildCampaignIndex(this.programs);
    this.worldEventIndex = buildWorldEventIndex(this.programs);
    const now = asUnixMs(this.clock());
    this.pushAudit({
      auditId: buildAuditId('PROGRAM_INDEXED', now),
      at: now,
      kind: 'PROGRAM_INDEXED',
      headline: 'Program indexes rebuilt',
      details: [
        `Programs: ${this.programIndex.size}`,
        `Campaigns: ${this.campaignIndex.size}`,
        `Events: ${this.worldEventIndex.size}`,
      ],
    });
  }

  private collectActiveCampaigns(
    activeEvents: readonly SeasonalChatEventRuntimeState[],
  ): readonly ChatLiveOpsCampaign[] {
    const keys = new Set(activeEvents.map((event) => `${event.programId}::${event.campaignId}`));
    return [...keys]
      .map((key) => this.campaignIndex.get(key))
      .filter((campaign): campaign is ChatLiveOpsCampaign => Boolean(campaign));
  }

  private deriveLiveOpsState(
    activeEvents: readonly SeasonalChatEventRuntimeState[],
  ): 'PLANNED' | 'ARMED' | 'LIVE' {
    if (activeEvents.some((event) => event.lifecycle === 'LIVE')) {
      return 'LIVE';
    }
    if (activeEvents.some((event) => event.lifecycle === 'WARMUP')) {
      return 'ARMED';
    }
    return 'PLANNED';
  }

  private deriveActiveSeason() {
    return this.programs.find((program) => program.season && program.season.phase !== 'ARCHIVED')?.season ?? null;
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.snapshot);
    }
  }

  private emitTransition(transition: SeasonalChatEventTransition): void {
    for (const listener of this.transitionListeners) {
      listener(transition);
    }
  }

  private emitAudit(record: SeasonalChatEventAuditRecord): void {
    for (const listener of this.auditListeners) {
      listener(record);
    }
  }

  private pushTransition(transition: SeasonalChatEventTransition): void {
    this.transitions = [transition, ...this.transitions].slice(
      0,
      this.options.maxTransitionHistory ?? DEFAULT_OPTIONS.maxTransitionHistory,
    );
    this.emitTransition(transition);
  }

  private pushAudit(record: SeasonalChatEventAuditRecord): void {
    this.auditTrail = [record, ...this.auditTrail].slice(
      0,
      this.options.maxAuditHistory ?? DEFAULT_OPTIONS.maxAuditHistory,
    );
    this.emitAudit(record);
  }

  private activateEvent(state: SeasonalChatEventRuntimeState, now: UnixMs): void {
    this.activeEventsByKey.set(state.dedupeKey, state);
    this.activeEventsById.set(state.eventId, state);
    this.pushTransition({
      transitionId: buildTransitionId(
        state.lifecycle === 'WARMUP' ? 'EVENT_WARMUP' : 'EVENT_LIVE',
        now,
        state.eventId,
      ),
      at: now,
      kind: state.lifecycle === 'WARMUP' ? 'EVENT_WARMUP' : 'EVENT_LIVE',
      programId: state.programId,
      campaignId: state.campaignId,
      eventId: state.eventId,
      headline: state.preview.headline,
      body: buildEventBodyText(state),
      severity: normalizeSeverity(state.visiblePriority),
    });
    this.pushAudit({
      auditId: buildAuditId('EVENT_ARMED', now, state.eventId),
      at: now,
      kind: 'EVENT_ARMED',
      eventId: state.eventId,
      programId: state.programId,
      campaignId: state.campaignId,
      dedupeKey: state.dedupeKey,
      headline: `Event armed`,
      details: [
        `Lifecycle: ${state.lifecycle}`,
        `Visible priority: ${state.visiblePriority.toFixed(3)}`,
        `Shadow priority: ${state.shadowPriority.toFixed(3)}`,
      ],
    });
  }

  private inferBatchTriggeredEvents(
    batch: ChatBridgeBatch,
    now: UnixMs,
  ): readonly SeasonalChatEventRuntimeState[] {
    const triggeredKinds = inferBatchTriggeredKinds(batch, this.runtime);
    const states: SeasonalChatEventRuntimeState[] = [];

    for (const program of this.programs) {
      for (const campaign of program.campaigns) {
        for (const event of campaign.worldEvents) {
          if (!triggeredKinds.includes(event.kind)) {
            continue;
          }
          states.push(
            this.deriveRuntimeEventState(
              event,
              'BATCH_TRIGGER',
              program.programId,
              campaign.campaignId,
              now,
            ),
          );
        }
      }
    }

    return states;
  }

  private deriveRuntimeEventState(
    event: ChatWorldEventDefinition,
    source: SeasonalEventSource,
    programId: string,
    campaignId: string,
    now: UnixMs,
  ): SeasonalChatEventRuntimeState {
    const normalizedEvent = normalizeChatWorldEvent(event);
    const lifecycle = eventLifecycle(now, normalizedEvent);
    const targeting = deriveTargeting(normalizedEvent, this.options);
    const preview = previewChatWorldEvent(normalizedEvent);
    const summary = summarizeChatWorldEvent(normalizedEvent);
    const pressureScore = derivePressureScore(normalizedEvent, this.runtime);
    const helperSuppressionScore = deriveHelperSuppressionScore(normalizedEvent);
    const crowdHeatScore = deriveCrowdHeatScore(normalizedEvent);
    const noveltyScore = deriveNoveltyScore(normalizedEvent);
    const urgencyScore = deriveUrgencyScore(now, lifecycle, normalizedEvent);
    const visiblePriority = clamp01(
      (pressureScore * 0.52) + (crowdHeatScore * 0.18) + (noveltyScore * 0.12) + (urgencyScore * 0.18),
    );
    const shadowPriority = clamp01(
      (pressureScore * 0.38) + (helperSuppressionScore * 0.28) + (urgencyScore * 0.16) + (noveltyScore * 0.18),
    );
    const disposition = deriveVisibilityDisposition(normalizedEvent, visiblePriority);

    return {
      eventId: normalizedEvent.eventId,
      source,
      programId,
      campaignId,
      lifecycle,
      activatedAt: now,
      deactivatesAt: normalizedEvent.schedule.endsAt,
      preview,
      summary,
      targeting,
      audience: deriveAudienceVector(
        visiblePriority,
        shadowPriority,
        helperSuppressionScore,
        crowdHeatScore,
        noveltyScore,
        urgencyScore,
      ),
      pressureScore,
      visiblePriority,
      shadowPriority,
      helperSuppressionScore,
      crowdHeatScore,
      noveltyScore,
      urgencyScore,
      dedupeKey: buildDedupeKey(programId, campaignId, normalizedEvent.eventId, source),
      visibilityDisposition: disposition,
      notes: normalizedEvent.announcement.detailLines,
    };
  }

  private collectProgramEvents(now: UnixMs): SeasonalChatEventRuntimeState[] {
    const collected: SeasonalChatEventRuntimeState[] = [];

    for (const program of this.programs) {
      for (const campaign of program.campaigns) {
        if (PROGRAM_DISABLED_STATES.has(campaign.state)) {
          continue;
        }
        for (const event of campaign.worldEvents) {
          const state = this.deriveRuntimeEventState(
            event,
            'PROGRAM',
            program.programId,
            campaign.campaignId,
            now,
          );
          if (state.lifecycle === 'IDLE') {
            continue;
          }
          collected.push(state);
        }
      }
    }

    return collected;
  }

  private collectRetainedTriggeredEvents(now: UnixMs): SeasonalChatEventRuntimeState[] {
    const retained: SeasonalChatEventRuntimeState[] = [];
    for (const [key, state] of this.activeEventsByKey.entries()) {
      const dismissal = this.dismissals.get(state.eventId);
      if (dismissal && (now - dismissal.at) < (this.options.restoreDismissedAfterMs ?? DEFAULT_OPTIONS.restoreDismissedAfterMs)) {
        continue;
      }
      if (state.deactivatesAt <= now) {
        this.activeEventsByKey.delete(key);
        this.activeEventsById.delete(state.eventId);
        this.pushTransition({
          transitionId: buildTransitionId('EVENT_ENDED', now, state.eventId),
          at: now,
          kind: 'EVENT_ENDED',
          programId: state.programId,
          campaignId: state.campaignId,
          eventId: state.eventId,
          headline: `${state.preview.headline} ended`,
          body: buildEventBodyText(state),
          severity: 'INFO',
        });
        this.pushAudit({
          auditId: buildAuditId('EVENT_EXPIRED', now, state.eventId),
          at: now,
          kind: 'EVENT_EXPIRED',
          eventId: state.eventId,
          programId: state.programId,
          campaignId: state.campaignId,
          headline: `Event expired`,
          details: [`Dedupe key: ${state.dedupeKey}`],
        });
        continue;
      }
      retained.push(state);
    }
    return retained;
  }

  private mergeActiveEvents(
    generatedEvents: readonly SeasonalChatEventRuntimeState[],
    retainedEvents: readonly SeasonalChatEventRuntimeState[],
    now: UnixMs,
  ): readonly SeasonalChatEventRuntimeState[] {
    const byId = new Map<string, SeasonalChatEventRuntimeState>();

    for (const state of [...generatedEvents, ...retainedEvents]) {
      const dismissed = this.dismissals.get(state.eventId);
      if (dismissed && (now - dismissed.at) < (this.options.restoreDismissedAfterMs ?? DEFAULT_OPTIONS.restoreDismissedAfterMs)) {
        continue;
      }
      const existing = byId.get(state.eventId);
      if (!existing) {
        byId.set(state.eventId, state);
        continue;
      }
      if (state.visiblePriority > existing.visiblePriority) {
        byId.set(state.eventId, state);
      }
    }

    const active = [...byId.values()]
      .sort(
        (left, right) =>
          (right.visiblePriority - left.visiblePriority) ||
          (right.shadowPriority - left.shadowPriority) ||
          (right.activatedAt - left.activatedAt),
      )
      .slice(0, this.options.maxActiveEvents ?? DEFAULT_OPTIONS.maxActiveEvents);

    return active;
  }

  private buildQueue(
    activeEvents: readonly SeasonalChatEventRuntimeState[],
    now: UnixMs,
  ): SeasonalChatEventQueueEntry[] {
    const entries = activeEvents.map((event) => buildQueueEntry(event, now));
    return rankQueueEntries(entries).slice(
      0,
      this.options.maxQueueEntries ?? DEFAULT_OPTIONS.maxQueueEntries,
    );
  }

  private buildChannelRuntimeStates(
    activeEvents: readonly SeasonalChatEventRuntimeState[],
  ): readonly ChatLiveOpsRuntimeChannelState[] {
    const channelMap = new Map<ChatChannelId, ChatLiveOpsRuntimeChannelState>();

    for (const program of this.programs) {
      for (const channel of collectChatLiveOpsChannels(program)) {
        const current = channelMap.get(channel) ?? {
          channelId: channel,
          activeProgramIds: [],
          activeCampaignIds: [],
          activeEventIds: [],
          visiblePressure: 0,
          latentPressure: 0,
          helperSuppression: 0,
          whisperOnly: false,
          doubleHeat: false,
          systemNoticeBias: 0,
        };
        channelMap.set(channel, current);
      }
    }

    for (const event of activeEvents) {
      for (const channel of event.targeting.visibleChannels) {
        const current = channelMap.get(channel) ?? {
          channelId: channel,
          activeProgramIds: [],
          activeCampaignIds: [],
          activeEventIds: [],
          visiblePressure: 0,
          latentPressure: 0,
          helperSuppression: 0,
          whisperOnly: false,
          doubleHeat: false,
          systemNoticeBias: 0,
        };
        channelMap.set(channel, {
          ...current,
          activeProgramIds: Array.from(new Set([...current.activeProgramIds, event.programId])),
          activeCampaignIds: [...current.activeCampaignIds, event.campaignId],
          activeEventIds: [...current.activeEventIds, event.eventId],
          visiblePressure: clamp01(current.visiblePressure + event.visiblePriority),
          latentPressure: clamp01(current.latentPressure + (event.shadowPriority * 0.35)),
          helperSuppression: clamp01(current.helperSuppression + event.helperSuppressionScore),
          whisperOnly: current.whisperOnly || event.summary.shadowOnly,
          doubleHeat: current.doubleHeat || event.summary.kind === 'DOUBLE_HEAT',
          systemNoticeBias: clamp01(current.systemNoticeBias + (event.visiblePriority * 0.5)),
        });
      }

      for (const channel of event.targeting.shadowChannels) {
        const current = channelMap.get(channel) ?? {
          channelId: channel,
          activeProgramIds: [],
          activeCampaignIds: [],
          activeEventIds: [],
          visiblePressure: 0,
          latentPressure: 0,
          helperSuppression: 0,
          whisperOnly: false,
          doubleHeat: false,
          systemNoticeBias: 0,
        };
        channelMap.set(channel, {
          ...current,
          activeCampaignIds: [...current.activeCampaignIds, event.campaignId],
          activeEventIds: [...current.activeEventIds, event.eventId],
          latentPressure: clamp01(current.latentPressure + event.shadowPriority),
          helperSuppression: clamp01(current.helperSuppression + event.helperSuppressionScore),
        });
      }
    }

    return [...channelMap.values()].sort((left, right) => right.visiblePressure - left.visiblePressure);
  }

  private rebuildProjections(activeEvents: readonly SeasonalChatEventRuntimeState[]): void {
    this.channelProjections.clear();
    this.programProjections.clear();
    this.campaignProjections.clear();
    this.mountProjections.clear();

    for (const event of activeEvents) {
      this.absorbEventIntoProgramProjection(event);
      this.absorbEventIntoCampaignProjection(event);
      this.absorbEventIntoChannelProjection(event);
      this.absorbEventIntoMountProjection(event);
    }
  }

  private absorbEventIntoProgramProjection(event: SeasonalChatEventRuntimeState): void {
    const current = this.programProjections.get(event.programId) ?? {
      programId: event.programId,
      campaignIds: [] as readonly string[],
      activeEventIds: [] as readonly string[],
      visiblePressure: 0,
      shadowPressure: 0,
      dominantBand: 'QUIET' as SeasonalPressureBand,
      activeChannels: [] as readonly ChatChannelId[],
    };
    this.programProjections.set(event.programId, {
      programId: event.programId,
      campaignIds: uniquePush(current.campaignIds, event.campaignId),
      activeEventIds: uniquePush(current.activeEventIds, event.eventId),
      visiblePressure: clamp01(current.visiblePressure + event.visiblePriority),
      shadowPressure: clamp01(current.shadowPressure + event.shadowPriority),
      dominantBand: pressureBandFromScore(
        Math.max(current.visiblePressure + event.visiblePriority, current.shadowPressure + event.shadowPriority),
      ),
      activeChannels: toReadonlyChannels([
        ...current.activeChannels,
        ...event.targeting.visibleChannels,
        ...event.targeting.shadowChannels,
      ]),
    });
  }

  private absorbEventIntoCampaignProjection(event: SeasonalChatEventRuntimeState): void {
    const key = `${event.programId}::${event.campaignId}`;
    const current = this.campaignProjections.get(key) ?? {
      programId: event.programId,
      campaignId: event.campaignId,
      activeEventIds: [] as readonly string[],
      visiblePressure: 0,
      shadowPressure: 0,
      dominantBand: 'QUIET' as SeasonalPressureBand,
    };
    this.campaignProjections.set(key, {
      programId: event.programId,
      campaignId: event.campaignId,
      activeEventIds: uniquePush(current.activeEventIds, event.eventId),
      visiblePressure: clamp01(current.visiblePressure + event.visiblePriority),
      shadowPressure: clamp01(current.shadowPressure + event.shadowPriority),
      dominantBand: pressureBandFromScore(
        Math.max(current.visiblePressure + event.visiblePriority, current.shadowPressure + event.shadowPriority),
      ),
    });
  }

  private absorbEventIntoChannelProjection(event: SeasonalChatEventRuntimeState): void {
    const channels = [
      ...event.targeting.visibleChannels,
      ...event.targeting.shadowChannels,
    ];
    for (const channelId of channels) {
      const current = this.channelProjections.get(channelId) ?? {
        channelId,
        activeEventIds: [] as readonly string[],
        visiblePressure: 0,
        shadowPressure: 0,
        helperSuppression: 0,
        crowdHeat: 0,
        programIds: [] as readonly string[],
        campaignIds: [] as readonly string[],
        mountBias: 'PRIMARY_DOCK' as SeasonalMountTarget,
        noticeBias: 0,
        pressureBand: 'QUIET' as SeasonalPressureBand,
      };
      const visibleContribution = event.targeting.visibleChannels.includes(channelId)
        ? event.visiblePriority
        : 0;
      const shadowContribution = event.targeting.shadowChannels.includes(channelId)
        ? event.shadowPriority
        : event.shadowPriority * 0.35;
      const newVisible = clamp01(current.visiblePressure + visibleContribution);
      const newShadow = clamp01(current.shadowPressure + shadowContribution);
      const mountBias = pickMountTarget([channelId], visibleContribution, event.lifecycle);
      this.channelProjections.set(channelId, {
        channelId,
        activeEventIds: uniquePush(current.activeEventIds, event.eventId),
        visiblePressure: newVisible,
        shadowPressure: newShadow,
        helperSuppression: clamp01(current.helperSuppression + event.helperSuppressionScore),
        crowdHeat: clamp01(current.crowdHeat + event.crowdHeatScore),
        programIds: uniquePush(current.programIds, event.programId),
        campaignIds: uniquePush(current.campaignIds, event.campaignId),
        mountBias,
        noticeBias: clamp01(current.noticeBias + event.visiblePriority),
        pressureBand: pressureBandFromScore(Math.max(newVisible, newShadow)),
      });
    }
  }

  private absorbEventIntoMountProjection(event: SeasonalChatEventRuntimeState): void {
    const target = pickMountTarget(event.targeting.visibleChannels, event.visiblePriority, event.lifecycle);
    const current = this.mountProjections.get(target) ?? {
      target,
      severity: 'INFO' as ChatBridgeSeverity,
      eventIds: [] as readonly string[],
      headline: '',
      body: '',
      channelIds: [] as readonly ChatChannelId[],
      pressureBand: 'QUIET' as SeasonalPressureBand,
    };
    const bestHeadline = current.headline && current.pressureBand !== 'QUIET'
      ? current.headline
      : event.preview.headline;
    const bestBody = current.body && current.pressureBand !== 'QUIET'
      ? current.body
      : buildEventBodyText(event);
    this.mountProjections.set(target, {
      target,
      severity: normalizeSeverity(Math.max(
        event.visiblePriority,
        current.severity === 'CRITICAL' ? 0.9 : current.severity === 'WARNING' ? 0.6 : current.severity === 'SUCCESS' ? 0.1 : 0.3,
      )),
      eventIds: uniquePush(current.eventIds, event.eventId),
      headline: bestHeadline,
      body: bestBody,
      channelIds: toReadonlyChannels([
        ...current.channelIds,
        ...event.targeting.visibleChannels,
      ]),
      pressureBand: pressureBandFromScore(Math.max(event.visiblePriority, event.shadowPriority)),
    });
  }

  private buildDiagnostics(
    now: UnixMs,
    activeEvents: readonly SeasonalChatEventRuntimeState[],
  ): SeasonalChatEventDiagnostics {
    const queryIndex = this.buildQueryIndex(activeEvents);
    const channelProjections = [...this.channelProjections.values()].sort(
      (left, right) => right.visiblePressure - left.visiblePressure,
    );
    const programProjections = [...this.programProjections.values()].sort(
      (left, right) => right.visiblePressure - left.visiblePressure,
    );
    const campaignProjections = [...this.campaignProjections.values()].sort(
      (left, right) => right.visiblePressure - left.visiblePressure,
    );
    const mountProjections = [...this.mountProjections.values()].sort((left, right) => {
      const lv = MOUNT_SEVERITY_WEIGHT[left.target];
      const rv = MOUNT_SEVERITY_WEIGHT[right.target];
      return rv - lv;
    });

    const metrics: SeasonalChatEventMetrics = {
      totalPrograms: this.programs.length,
      totalCampaigns: [...this.campaignIndex.keys()].length,
      totalIndexedEvents: [...this.worldEventIndex.keys()].length,
      activeEvents: activeEvents.length,
      warmupEvents: activeEvents.filter((event) => event.lifecycle === 'WARMUP').length,
      liveEvents: activeEvents.filter((event) => event.lifecycle === 'LIVE').length,
      cooldownEvents: activeEvents.filter((event) => event.lifecycle === 'COOLDOWN').length,
      visibleEvents: activeEvents.filter((event) => event.visibilityDisposition === 'VISIBLE').length,
      shadowOnlyEvents: activeEvents.filter((event) => event.visibilityDisposition === 'SHADOW').length,
      dismissedEvents: this.dismissals.size,
      acknowledgedEvents: this.acknowledgements.size,
      queuedEffects: this.queue.length,
      channelsUnderPressure: channelProjections.filter((entry) => entry.pressureBand !== 'QUIET').length,
      highestVisiblePressure: channelProjections[0]?.visiblePressure ?? 0,
      highestShadowPressure: channelProjections[0]?.shadowPressure ?? 0,
    };

    return {
      generatedAt: now,
      metrics,
      queryIndex,
      channelProjections,
      programProjections,
      campaignProjections,
      mountProjections,
      queue: [...this.queue],
      acknowledgements: [...this.acknowledgements.values()],
      dismissals: [...this.dismissals.values()],
      auditTrail: [...this.auditTrail],
    };
  }

  private buildQueryIndex(
    activeEvents: readonly SeasonalChatEventRuntimeState[],
  ): SeasonalChatEventQueryIndex {
    const programIds = new Set<string>();
    const campaignIds = new Set<string>();
    const eventIds = new Set<string>();
    const channelIds = new Set<ChatChannelId>();
    const roomIds = new Set<ChatRoomId>();
    const playerIds = new Set<ChatUserId>();

    for (const event of activeEvents) {
      programIds.add(event.programId);
      campaignIds.add(event.campaignId);
      eventIds.add(event.eventId);
      for (const channel of event.targeting.visibleChannels) {
        channelIds.add(channel);
      }
      for (const channel of event.targeting.shadowChannels) {
        channelIds.add(channel);
      }
      for (const roomId of event.targeting.roomIds) {
        roomIds.add(roomId);
      }
      for (const playerId of event.targeting.playerIds) {
        playerIds.add(playerId);
      }
    }

    return {
      programIds: [...programIds.values()].sort(),
      campaignIds: [...campaignIds.values()].sort(),
      eventIds: [...eventIds.values()].sort(),
      channelIds: [...channelIds.values()].sort(),
      roomIds: [...roomIds.values()].sort(),
      playerIds: [...playerIds.values()].sort(),
    };
  }

  private findWorldEvent(
    programId: string,
    campaignId: string,
    eventId: string,
  ): ChatWorldEventDefinition | null {
    return this.worldEventIndex.get(`${programId}::${campaignId}::${eventId}`) ?? null;
  }
}

export function createSeasonalChatEventDirector(
  programs: readonly ChatLiveOpsProgram[] = [],
  options: SeasonalChatEventDirectorOptions = {},
): SeasonalChatEventDirector {
  return new SeasonalChatEventDirector(programs, options);
}


/**
 * Returns active events in current priority order.
 */
export function selectSeasonalActiveEvents(snapshot: SeasonalChatEventDirectorSnapshot): readonly SeasonalChatEventRuntimeState[] {
  return snapshot.activeEvents;
}


/**
 * Returns transition history.
 */
export function selectSeasonalTransitions(snapshot: SeasonalChatEventDirectorSnapshot): readonly SeasonalChatEventTransition[] {
  return snapshot.transitions;
}


/**
 * Returns queued mount effects.
 */
export function selectSeasonalQueue(snapshot: SeasonalChatEventDirectorSnapshot): readonly SeasonalChatEventQueueEntry[] {
  return snapshot.diagnostics.queue;
}


/**
 * Returns mount projections.
 */
export function selectSeasonalMountProjections(snapshot: SeasonalChatEventDirectorSnapshot): readonly SeasonalChatEventMountProjection[] {
  return snapshot.diagnostics.mountProjections;
}


/**
 * Returns channel projections.
 */
export function selectSeasonalChannelProjections(snapshot: SeasonalChatEventDirectorSnapshot): readonly SeasonalChatEventChannelProjection[] {
  return snapshot.diagnostics.channelProjections;
}


/**
 * Returns program projections.
 */
export function selectSeasonalProgramProjections(snapshot: SeasonalChatEventDirectorSnapshot): readonly SeasonalChatEventProgramProjection[] {
  return snapshot.diagnostics.programProjections;
}


/**
 * Returns campaign projections.
 */
export function selectSeasonalCampaignProjections(snapshot: SeasonalChatEventDirectorSnapshot): readonly SeasonalChatEventCampaignProjection[] {
  return snapshot.diagnostics.campaignProjections;
}


export function selectSeasonalWarmupEvents(
  snapshot: SeasonalChatEventDirectorSnapshot,
): readonly SeasonalChatEventRuntimeState[] {
  return snapshot.activeEvents.filter((event) => event.lifecycle === 'WARMUP');
}

export function countSeasonalWarmupEvents(snapshot: SeasonalChatEventDirectorSnapshot): number {
  return selectSeasonalWarmupEvents(snapshot).length;
}


export function selectSeasonalLiveEvents(
  snapshot: SeasonalChatEventDirectorSnapshot,
): readonly SeasonalChatEventRuntimeState[] {
  return snapshot.activeEvents.filter((event) => event.lifecycle === 'LIVE');
}

export function countSeasonalLiveEvents(snapshot: SeasonalChatEventDirectorSnapshot): number {
  return selectSeasonalLiveEvents(snapshot).length;
}


export function selectSeasonalCooldownEvents(
  snapshot: SeasonalChatEventDirectorSnapshot,
): readonly SeasonalChatEventRuntimeState[] {
  return snapshot.activeEvents.filter((event) => event.lifecycle === 'COOLDOWN');
}

export function countSeasonalCooldownEvents(snapshot: SeasonalChatEventDirectorSnapshot): number {
  return selectSeasonalCooldownEvents(snapshot).length;
}


export function selectSeasonalVisibleEvents(
  snapshot: SeasonalChatEventDirectorSnapshot,
): readonly SeasonalChatEventRuntimeState[] {
  return snapshot.activeEvents.filter((event) => event.visibilityDisposition === 'VISIBLE');
}

export function countSeasonalVisibleEvents(snapshot: SeasonalChatEventDirectorSnapshot): number {
  return selectSeasonalVisibleEvents(snapshot).length;
}


export function selectSeasonalShadowOnlyEvents(
  snapshot: SeasonalChatEventDirectorSnapshot,
): readonly SeasonalChatEventRuntimeState[] {
  return snapshot.activeEvents.filter((event) => event.visibilityDisposition === 'SHADOW');
}

export function countSeasonalShadowOnlyEvents(snapshot: SeasonalChatEventDirectorSnapshot): number {
  return selectSeasonalShadowOnlyEvents(snapshot).length;
}


export function selectSeasonalSuppressedEvents(
  snapshot: SeasonalChatEventDirectorSnapshot,
): readonly SeasonalChatEventRuntimeState[] {
  return snapshot.activeEvents.filter((event) => event.visibilityDisposition === 'SUPPRESSED');
}

export function countSeasonalSuppressedEvents(snapshot: SeasonalChatEventDirectorSnapshot): number {
  return selectSeasonalSuppressedEvents(snapshot).length;
}


export function selectSeasonalEventsByProgram(
  snapshot: SeasonalChatEventDirectorSnapshot,
  programId: string,
): readonly SeasonalChatEventRuntimeState[] {
  return snapshot.activeEvents.filter((event) => event.programId === programId);
}

export function countSeasonalEventsByProgram(
  snapshot: SeasonalChatEventDirectorSnapshot,
  programId: string,
): number {
  return selectSeasonalEventsByProgram(snapshot, programId).length;
}

export function hasSeasonalEventsByProgram(
  snapshot: SeasonalChatEventDirectorSnapshot,
  programId: string,
): boolean {
  return countSeasonalEventsByProgram(snapshot, programId) > 0;
}


export function selectSeasonalEventsByCampaign(
  snapshot: SeasonalChatEventDirectorSnapshot,
  campaignId: string,
): readonly SeasonalChatEventRuntimeState[] {
  return snapshot.activeEvents.filter((event) => event.campaignId === campaignId);
}

export function countSeasonalEventsByCampaign(
  snapshot: SeasonalChatEventDirectorSnapshot,
  campaignId: string,
): number {
  return selectSeasonalEventsByCampaign(snapshot, campaignId).length;
}

export function hasSeasonalEventsByCampaign(
  snapshot: SeasonalChatEventDirectorSnapshot,
  campaignId: string,
): boolean {
  return countSeasonalEventsByCampaign(snapshot, campaignId) > 0;
}


export function selectSeasonalEventsByEvent(
  snapshot: SeasonalChatEventDirectorSnapshot,
  eventId: string,
): readonly SeasonalChatEventRuntimeState[] {
  return snapshot.activeEvents.filter((event) => event.eventId === eventId);
}

export function countSeasonalEventsByEvent(
  snapshot: SeasonalChatEventDirectorSnapshot,
  eventId: string,
): number {
  return selectSeasonalEventsByEvent(snapshot, eventId).length;
}

export function hasSeasonalEventsByEvent(
  snapshot: SeasonalChatEventDirectorSnapshot,
  eventId: string,
): boolean {
  return countSeasonalEventsByEvent(snapshot, eventId) > 0;
}


export function selectSeasonalEventsByChannel(
  snapshot: SeasonalChatEventDirectorSnapshot,
  channelId: ChatChannelId,
): readonly SeasonalChatEventRuntimeState[] {
  return snapshot.activeEvents.filter((event) => event.targeting.visibleChannels.includes(channelId) || event.targeting.shadowChannels.includes(channelId));
}

export function countSeasonalEventsByChannel(
  snapshot: SeasonalChatEventDirectorSnapshot,
  channelId: ChatChannelId,
): number {
  return selectSeasonalEventsByChannel(snapshot, channelId).length;
}

export function hasSeasonalEventsByChannel(
  snapshot: SeasonalChatEventDirectorSnapshot,
  channelId: ChatChannelId,
): boolean {
  return countSeasonalEventsByChannel(snapshot, channelId) > 0;
}


export function selectSeasonalEventsByRoom(
  snapshot: SeasonalChatEventDirectorSnapshot,
  roomId: ChatRoomId,
): readonly SeasonalChatEventRuntimeState[] {
  return snapshot.activeEvents.filter((event) => event.targeting.roomIds.includes(roomId));
}

export function countSeasonalEventsByRoom(
  snapshot: SeasonalChatEventDirectorSnapshot,
  roomId: ChatRoomId,
): number {
  return selectSeasonalEventsByRoom(snapshot, roomId).length;
}

export function hasSeasonalEventsByRoom(
  snapshot: SeasonalChatEventDirectorSnapshot,
  roomId: ChatRoomId,
): boolean {
  return countSeasonalEventsByRoom(snapshot, roomId) > 0;
}


export function selectSeasonalEventsByPlayer(
  snapshot: SeasonalChatEventDirectorSnapshot,
  playerId: ChatUserId,
): readonly SeasonalChatEventRuntimeState[] {
  return snapshot.activeEvents.filter((event) => event.targeting.playerIds.includes(playerId));
}

export function countSeasonalEventsByPlayer(
  snapshot: SeasonalChatEventDirectorSnapshot,
  playerId: ChatUserId,
): number {
  return selectSeasonalEventsByPlayer(snapshot, playerId).length;
}

export function hasSeasonalEventsByPlayer(
  snapshot: SeasonalChatEventDirectorSnapshot,
  playerId: ChatUserId,
): boolean {
  return countSeasonalEventsByPlayer(snapshot, playerId) > 0;
}


export function selectTopSeasonalEventsByVisiblePriority(
  snapshot: SeasonalChatEventDirectorSnapshot,
  limit = 5,
): readonly SeasonalChatEventRuntimeState[] {
  return snapshot.activeEvents
    .slice()
    .sort((left, right) => right.visiblePriority - left.visiblePriority)
    .slice(0, Math.max(0, limit));
}

export function selectHighestSeasonalVisiblePriority(
  snapshot: SeasonalChatEventDirectorSnapshot,
): SeasonalChatEventRuntimeState | null {
  return selectTopSeasonalEventsByVisiblePriority(snapshot, 1)[0] ?? null;
}


export function selectTopSeasonalEventsByShadowPriority(
  snapshot: SeasonalChatEventDirectorSnapshot,
  limit = 5,
): readonly SeasonalChatEventRuntimeState[] {
  return snapshot.activeEvents
    .slice()
    .sort((left, right) => right.shadowPriority - left.shadowPriority)
    .slice(0, Math.max(0, limit));
}

export function selectHighestSeasonalShadowPriority(
  snapshot: SeasonalChatEventDirectorSnapshot,
): SeasonalChatEventRuntimeState | null {
  return selectTopSeasonalEventsByShadowPriority(snapshot, 1)[0] ?? null;
}


export function selectTopSeasonalEventsByPressure(
  snapshot: SeasonalChatEventDirectorSnapshot,
  limit = 5,
): readonly SeasonalChatEventRuntimeState[] {
  return snapshot.activeEvents
    .slice()
    .sort((left, right) => right.pressureScore - left.pressureScore)
    .slice(0, Math.max(0, limit));
}

export function selectHighestSeasonalPressure(
  snapshot: SeasonalChatEventDirectorSnapshot,
): SeasonalChatEventRuntimeState | null {
  return selectTopSeasonalEventsByPressure(snapshot, 1)[0] ?? null;
}


export function selectTopSeasonalEventsByCrowdHeat(
  snapshot: SeasonalChatEventDirectorSnapshot,
  limit = 5,
): readonly SeasonalChatEventRuntimeState[] {
  return snapshot.activeEvents
    .slice()
    .sort((left, right) => right.crowdHeatScore - left.crowdHeatScore)
    .slice(0, Math.max(0, limit));
}

export function selectHighestSeasonalCrowdHeat(
  snapshot: SeasonalChatEventDirectorSnapshot,
): SeasonalChatEventRuntimeState | null {
  return selectTopSeasonalEventsByCrowdHeat(snapshot, 1)[0] ?? null;
}


export function selectTopSeasonalEventsByHelperSuppression(
  snapshot: SeasonalChatEventDirectorSnapshot,
  limit = 5,
): readonly SeasonalChatEventRuntimeState[] {
  return snapshot.activeEvents
    .slice()
    .sort((left, right) => right.helperSuppressionScore - left.helperSuppressionScore)
    .slice(0, Math.max(0, limit));
}

export function selectHighestSeasonalHelperSuppression(
  snapshot: SeasonalChatEventDirectorSnapshot,
): SeasonalChatEventRuntimeState | null {
  return selectTopSeasonalEventsByHelperSuppression(snapshot, 1)[0] ?? null;
}


export function selectTopSeasonalEventsByNovelty(
  snapshot: SeasonalChatEventDirectorSnapshot,
  limit = 5,
): readonly SeasonalChatEventRuntimeState[] {
  return snapshot.activeEvents
    .slice()
    .sort((left, right) => right.noveltyScore - left.noveltyScore)
    .slice(0, Math.max(0, limit));
}

export function selectHighestSeasonalNovelty(
  snapshot: SeasonalChatEventDirectorSnapshot,
): SeasonalChatEventRuntimeState | null {
  return selectTopSeasonalEventsByNovelty(snapshot, 1)[0] ?? null;
}


export function selectTopSeasonalEventsByUrgency(
  snapshot: SeasonalChatEventDirectorSnapshot,
  limit = 5,
): readonly SeasonalChatEventRuntimeState[] {
  return snapshot.activeEvents
    .slice()
    .sort((left, right) => right.urgencyScore - left.urgencyScore)
    .slice(0, Math.max(0, limit));
}

export function selectHighestSeasonalUrgency(
  snapshot: SeasonalChatEventDirectorSnapshot,
): SeasonalChatEventRuntimeState | null {
  return selectTopSeasonalEventsByUrgency(snapshot, 1)[0] ?? null;
}


export function selectSeasonalMountProjectionPrimaryDock(
  snapshot: SeasonalChatEventDirectorSnapshot,
): SeasonalChatEventMountProjection | null {
  return snapshot.diagnostics.mountProjections.find((entry) => entry.target === 'PRIMARY_DOCK') ?? null;
}


export function selectSeasonalMountProjectionMomentFlash(
  snapshot: SeasonalChatEventDirectorSnapshot,
): SeasonalChatEventMountProjection | null {
  return snapshot.diagnostics.mountProjections.find((entry) => entry.target === 'MOMENT_FLASH') ?? null;
}


export function selectSeasonalMountProjectionHudRail(
  snapshot: SeasonalChatEventDirectorSnapshot,
): SeasonalChatEventMountProjection | null {
  return snapshot.diagnostics.mountProjections.find((entry) => entry.target === 'HUD_RAIL') ?? null;
}


export function selectSeasonalMountProjectionChannelHeader(
  snapshot: SeasonalChatEventDirectorSnapshot,
): SeasonalChatEventMountProjection | null {
  return snapshot.diagnostics.mountProjections.find((entry) => entry.target === 'CHANNEL_HEADER') ?? null;
}


export function selectSeasonalMountProjectionTranscriptDrawer(
  snapshot: SeasonalChatEventDirectorSnapshot,
): SeasonalChatEventMountProjection | null {
  return snapshot.diagnostics.mountProjections.find((entry) => entry.target === 'TRANSCRIPT_DRAWER') ?? null;
}


export function selectSeasonalMountProjectionCollapsedPill(
  snapshot: SeasonalChatEventDirectorSnapshot,
): SeasonalChatEventMountProjection | null {
  return snapshot.diagnostics.mountProjections.find((entry) => entry.target === 'COLLAPSED_PILL') ?? null;
}

export function summarizeSeasonalHeadline(
  snapshot: SeasonalChatEventDirectorSnapshot,
): { headline: string; body: string } {
  return summarizeQueueHeadline(snapshot.activeEvents);
}

export function selectSeasonalDominantPressureBand(
  snapshot: SeasonalChatEventDirectorSnapshot,
): SeasonalPressureBand {
  return pressureBandFromScore(
    Math.max(
      snapshot.diagnostics.metrics.highestVisiblePressure,
      snapshot.diagnostics.metrics.highestShadowPressure,
    ),
  );
}

export function selectSeasonalRuntimeChannels(
  snapshot: SeasonalChatEventDirectorSnapshot,
): readonly ChatBridgeChannel[] {
  return extractVisibleBridgeChannels(snapshot.runtime);
}

export function selectSeasonalAcknowledgedEventIds(
  snapshot: SeasonalChatEventDirectorSnapshot,
): readonly string[] {
  return snapshot.diagnostics.acknowledgements.map((entry) => entry.eventId);
}

export function selectSeasonalDismissedEventIds(
  snapshot: SeasonalChatEventDirectorSnapshot,
): readonly string[] {
  return snapshot.diagnostics.dismissals.map((entry) => entry.eventId);
}

export function selectSeasonalAuditByKind(
  snapshot: SeasonalChatEventDirectorSnapshot,
  kind: SeasonalAuditKind,
): readonly SeasonalChatEventAuditRecord[] {
  return snapshot.diagnostics.auditTrail.filter((entry) => entry.kind === kind);
}

export function selectSeasonalTransitionsByKind(
  snapshot: SeasonalChatEventDirectorSnapshot,
  kind: SeasonalChatEventTransition['kind'],
): readonly SeasonalChatEventTransition[] {
  return snapshot.transitions.filter((entry) => entry.kind === kind);
}

export function selectSeasonalDerivedNotifications(
  snapshot: SeasonalChatEventDirectorSnapshot,
): readonly ChatBridgeNotification[] {
  return snapshot.derivedBatchEffects.notifications;
}

export function selectSeasonalMountHints(
  snapshot: SeasonalChatEventDirectorSnapshot,
): readonly ChatBridgeMountHint[] {
  return snapshot.derivedBatchEffects.mountHints;
}

export function selectSeasonalFanout(
  snapshot: SeasonalChatEventDirectorSnapshot,
): readonly ChatWorldEventFanoutEnvelope[] {
  return snapshot.derivedBatchEffects.fanout;
}

export function isSeasonalQuiet(snapshot: SeasonalChatEventDirectorSnapshot): boolean {
  return snapshot.activeEvents.length === 0;
}

export function isSeasonalHot(snapshot: SeasonalChatEventDirectorSnapshot): boolean {
  return selectSeasonalDominantPressureBand(snapshot) === 'HOT';
}

export function isSeasonalSevere(snapshot: SeasonalChatEventDirectorSnapshot): boolean {
  const band = selectSeasonalDominantPressureBand(snapshot);
  return band === 'SEVERE' || band === 'CRITICAL';
}

export function selectSeasonalMountTargetForEvent(
  event: SeasonalChatEventRuntimeState,
): SeasonalMountTarget {
  return pickMountTarget(event.targeting.visibleChannels, event.visiblePriority, event.lifecycle);
}

export function selectSeasonalSeverityForEvent(
  event: SeasonalChatEventRuntimeState,
): ChatBridgeSeverity {
  return normalizeSeverity(event.visiblePriority);
}
