/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT LIVEOPS SEASONAL EVENT DIRECTOR
 * FILE: pzo-web/src/engines/chat/liveops/SeasonalChatEventDirector.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Frontend orchestration layer that keeps the chat world feeling alive even
 * when the local player is not the only axis of importance.
 *
 * This file is deliberately repo-faithful:
 * - it does not attempt to replace backend authority,
 * - it consumes shared liveops contracts instead of inventing local DTOs,
 * - it stages world pressure on the client for responsiveness,
 * - it preserves visible vs shadow effects,
 * - it speaks in the same pressure / channel / mount language as the rest of
 *   the chat engine lane.
 *
 * Why this file exists
 * --------------------
 * The current frontend chat lane already has:
 * - a deterministic Event Bridge,
 * - a runtime config authority,
 * - channel policy,
 * - presence / typing / notification controllers,
 * - invasion / NPC direction,
 * - transcript shaping,
 * - selector-driven presentation.
 *
 * What it does not yet have is a dedicated runtime brain for world-scale event
 * sequencing. This file fills that gap.
 *
 * Design laws
 * -----------
 * 1. Backend remains authoritative for persistent truth.
 * 2. Frontend stages liveops transitions for timing, banners, and mount hints.
 * 3. World events are replay-safe, deterministic, and dedupe-aware.
 * 4. Seasonal pressure modifies planning, not transcript truth.
 * 5. Visible reactions and shadow pressure are tracked separately.
 * 6. The director never mutates shared contract objects in place.
 * 7. Trigger chains are explicit and testable.
 * 8. A severe world event should surface fast, but not spam every mount.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
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
import type { ChatChannelId, ChatRoomId, ChatUserId, UnixMs } from '../../../../../shared/contracts/chat/ChatChannels';
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
  buildOverlayContextsFromEvents,
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
export type SeasonalLiveOpsClock = () => number;
export type SeasonalChatEventLifecycleState = 'IDLE' | 'WARMUP' | 'LIVE' | 'COOLDOWN';
export type SeasonalEventSource = 'PROGRAM' | 'BATCH_TRIGGER' | 'DIRECTIVE' | 'RECOVERY';

export interface SeasonalChatEventRuntimeTargeting {
  readonly roomIds: readonly ChatRoomId[];
  readonly playerIds: readonly ChatUserId[];
  readonly visibleChannels: readonly ChatChannelId[];
  readonly shadowChannels: readonly ChatChannelId[];
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
  readonly pressureScore: number;
  readonly visiblePriority: number;
  readonly shadowPriority: number;
  readonly helperSuppressionScore: number;
  readonly crowdHeatScore: number;
  readonly dedupeKey: string;
  readonly batchTriggerEventType?: string;
  readonly notes: readonly string[];
}

export interface SeasonalChatEventTransition {
  readonly transitionId: string;
  readonly at: UnixMs;
  readonly kind: 'PROGRAM_ARMED' | 'EVENT_WARMUP' | 'EVENT_LIVE' | 'EVENT_COOLDOWN' | 'EVENT_ENDED' | 'DIRECTIVE_APPLIED';
  readonly programId?: string;
  readonly campaignId?: string;
  readonly eventId?: string;
  readonly headline: string;
  readonly body: string;
  readonly severity: ChatBridgeSeverity;
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
}

export interface SeasonalChatEventDirectorOptions {
  readonly clock?: SeasonalLiveOpsClock;
  readonly dedupeWindowMs?: number;
  readonly maxTransitionHistory?: number;
  readonly maxActiveEvents?: number;
  readonly maxDerivedNotificationsPerTick?: number;
  readonly lowShieldThreshold?: number;
  readonly highPressureThreshold?: number;
  readonly severeThreatThreshold?: number;
  readonly defaultRoomScope?: readonly ChatRoomId[];
  readonly defaultPlayerScope?: readonly ChatUserId[];
}

const DEFAULT_OPTIONS: Required<Omit<SeasonalChatEventDirectorOptions, 'defaultRoomScope' | 'defaultPlayerScope'>> = {
  clock: () => Date.now(),
  dedupeWindowMs: 45_000,
  maxTransitionHistory: 96,
  maxActiveEvents: 24,
  maxDerivedNotificationsPerTick: 6,
  lowShieldThreshold: 1,
  highPressureThreshold: 0.74,
  severeThreatThreshold: 0.8,
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

function eventLifecycle(now: number, event: ChatWorldEventDefinition): SeasonalChatEventLifecycleState {
  if (isChatWorldEventWarmup(now as UnixMs, event.schedule)) {
    return 'WARMUP';
  }
  if (isChatWorldEventLive(event.state, now as UnixMs, event.schedule)) {
    return 'LIVE';
  }
  if (isChatWorldEventCooldown(now as UnixMs, event.schedule)) {
    return 'COOLDOWN';
  }
  return 'IDLE';
}

function buildDedupeKey(programId: string, campaignId: string, eventId: string, source: SeasonalEventSource): string {
  return `${source}:${programId}:${campaignId}:${eventId}`;
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

function splitVisibleAndShadowChannels(channels: readonly ChatChannelId[]): { visible: readonly ChatChannelId[]; shadow: readonly ChatChannelId[] } {
  const visible: ChatChannelId[] = [];
  const shadow: ChatChannelId[] = [];
  for (const channel of channels) {
    if (channel.endsWith('_SHADOW')) {
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

function derivePressureScore(event: ChatWorldEventDefinition, runtime: ChatBridgeRuntimeSnapshot): number {
  const pressureSignal = clamp01((event.pressure.legendChargeDelta + event.pressure.hostilityDelta + event.pressure.intimidationDelta) / 300);
  const roomSignal = clamp01((runtime.haterHeat ?? 0) / 100);
  const activeThreatSignal = clamp01((runtime.activeThreatCardCount ?? 0) / 8);
  return clamp01((pressureSignal * 0.45) + (roomSignal * 0.35) + (activeThreatSignal * 0.20));
}

function deriveHelperSuppressionScore(event: ChatWorldEventDefinition): number {
  return clamp01(event.pressure.helperSuppressionDelta / 100);
}

function deriveCrowdHeatScore(event: ChatWorldEventDefinition): number {
  return clamp01((event.pressure.audienceHeatDelta + event.pressure.visibleHeatDelta) / 200);
}

function deriveTargeting(
  event: ChatWorldEventDefinition,
  runtime: ChatBridgeRuntimeSnapshot,
  options: SeasonalChatEventDirectorOptions,
): SeasonalChatEventRuntimeTargeting {
  const rawChannels = collectWorldEventTargetChannels(event);
  const split = splitVisibleAndShadowChannels(rawChannels);
  return {
    roomIds: event.scope.roomIds ?? options.defaultRoomScope ?? ([] as const),
    playerIds: event.scope.playerIds ?? options.defaultPlayerScope ?? ([] as const),
    visibleChannels: split.visible,
    shadowChannels: split.shadow,
  };
}

function deriveRuntimeEventState(
  event: ChatWorldEventDefinition,
  source: SeasonalEventSource,
  programId: string,
  campaignId: string,
  now: UnixMs,
  runtime: ChatBridgeRuntimeSnapshot,
  options: SeasonalChatEventDirectorOptions,
): SeasonalChatEventRuntimeState {
  const normalizedEvent = normalizeChatWorldEvent(event);
  const lifecycle = eventLifecycle(now, normalizedEvent);
  const targeting = deriveTargeting(normalizedEvent, runtime, options);
  const preview = previewChatWorldEvent(normalizedEvent);
  const summary = summarizeChatWorldEvent(normalizedEvent);
  const pressureScore = derivePressureScore(normalizedEvent, runtime);
  const helperSuppressionScore = deriveHelperSuppressionScore(normalizedEvent);
  const crowdHeatScore = deriveCrowdHeatScore(normalizedEvent);

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
    pressureScore,
    visiblePriority: clamp01((pressureScore * 0.7) + (crowdHeatScore * 0.3)),
    shadowPriority: clamp01((pressureScore * 0.55) + (helperSuppressionScore * 0.45)),
    helperSuppressionScore,
    crowdHeatScore,
    dedupeKey: buildDedupeKey(programId, campaignId, normalizedEvent.eventId, source),
    notes: normalizedEvent.announcement.detailLines,
  };
}

function buildChannelRuntimeState(
  programs: readonly ChatLiveOpsProgram[],
  activeEvents: readonly SeasonalChatEventRuntimeState[],
): readonly ChatLiveOpsRuntimeChannelState[] {
  const channelMap = new Map<ChatChannelId, ChatLiveOpsRuntimeChannelState>();

  for (const program of programs) {
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
        whisperOnly: current.whisperOnly || event.preview.visibilityMode === 'SHADOW_ONLY',
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
    title: event.preview.headline,
    body: event.summary.summaryLine,
    severity: normalizeSeverity(event.visiblePriority),
    target: event.visiblePriority >= 0.8 ? 'MOMENT_FLASH' : 'PRIMARY_DOCK',
    ts: now,
  }));

  const mountHints: ChatBridgeMountHint[] = topEvents.map((event) => ({
    target: event.visiblePriority >= 0.85 ? 'MOMENT_FLASH' : 'PRIMARY_DOCK',
    severity: normalizeSeverity(event.visiblePriority),
    reason: `liveops:${event.eventId}`,
  }));

  const fanout: ChatWorldEventFanoutEnvelope[] = topEvents.map((event) => ({
    envelopeId: `fanout:${event.eventId}:${now}`,
    eventId: event.eventId,
    messageIds: [] as const,
    targetRooms: event.targeting.roomIds,
    targetPlayers: event.targeting.playerIds,
    visibleChannels: event.targeting.visibleChannels,
    shadowChannels: event.targeting.shadowChannels,
    createdAt: now,
    visibilityMode: event.preview.visibilityMode,
    pressureBand: event.preview.pressureBand,
  }));

  return {
    notifications,
    mountHints,
    fanout,
  };
}

function inferBatchTriggeredEvents(
  programs: readonly ChatLiveOpsProgram[],
  batch: ChatBridgeBatch,
  now: UnixMs,
  runtime: ChatBridgeRuntimeSnapshot,
  options: SeasonalChatEventDirectorOptions,
): readonly SeasonalChatEventRuntimeState[] {
  const sourceEventType = batch.sourceEventType.toUpperCase();
  const isThreatening = batch.messages.some((message: ChatBridgeBatch['messages'][number]) => message.severity === 'CRITICAL' || message.kind === 'BOT_ATTACK');
  const lowShieldCondition = batch.messages.some((message: ChatBridgeBatch['messages'][number]) => Boolean(message.targetLayerId) && sourceEventType.includes('SHIELD'))
    || ((runtime.activeThreatCardCount ?? 0) > 0 && (runtime.cashflow ?? 0) < 0 && (runtime.tick ?? 0) > 0);

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

  const states: SeasonalChatEventRuntimeState[] = [];
  for (const program of programs) {
    for (const campaign of program.campaigns) {
      for (const event of campaign.worldEvents) {
        if (!triggeredKinds.has(event.kind)) {
          continue;
        }
        states.push(deriveRuntimeEventState(event, 'BATCH_TRIGGER', program.programId, campaign.campaignId, now, runtime, options));
      }
    }
  }

  return states;
}

export class SeasonalChatEventDirector {
  private readonly options: SeasonalChatEventDirectorOptions;
  private readonly clock: SeasonalLiveOpsClock;
  private readonly listeners = new Set<SeasonalLiveOpsListener>();
  private programs: ChatLiveOpsProgram[] = [];
  private directives: ChatLiveOpsOperatorDirective[] = [];
  private runtime: ChatBridgeRuntimeSnapshot = { mode: 'SURVIVAL' as never, activeChannels: [] };
  private transitions: SeasonalChatEventTransition[] = [];
  private activeEventsByKey = new Map<string, SeasonalChatEventRuntimeState>();
  private snapshot: SeasonalChatEventDirectorSnapshot;

  public constructor(programs: readonly ChatLiveOpsProgram[] = [], options: SeasonalChatEventDirectorOptions = {}) {
    this.options = options;
    this.clock = options.clock ?? DEFAULT_OPTIONS.clock;
    this.programs = programs.map(normalizeChatLiveOpsProgram);
    const now = this.clock() as UnixMs;
    const emptyLiveops = createEmptyChatLiveOpsSnapshot(now);
    this.snapshot = {
      now,
      runtime: this.runtime,
      health: buildChatLiveOpsHealthSnapshot([], []),
      summary: summarizeChatLiveOpsSnapshot(emptyLiveops),
      liveops: emptyLiveops,
      activeEvents: [],
      transitions: [],
      derivedBatchEffects: {
        notifications: [],
        mountHints: [],
        fanout: [],
      },
      legacyOverlaySnapshot: buildLegacyOverlaySnapshot(now, [], []),
    };
    this.evaluate();
  }

  public subscribe(listener: SeasonalLiveOpsListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public replacePrograms(programs: readonly ChatLiveOpsProgram[]): SeasonalChatEventDirectorSnapshot {
    this.programs = programs.map(normalizeChatLiveOpsProgram);
    return this.evaluate();
  }

  public upsertDirective(directive: ChatLiveOpsOperatorDirective): SeasonalChatEventDirectorSnapshot {
    const filtered = this.directives.filter((entry) => entry.directiveId !== directive.directiveId);
    filtered.push(directive);
    this.directives = filtered.sort((left, right) => right.createdAt - left.createdAt);
    return this.evaluate();
  }

  public clearDirective(directiveId: string): SeasonalChatEventDirectorSnapshot {
    this.directives = this.directives.filter((entry) => entry.directiveId !== directiveId);
    return this.evaluate();
  }

  public ingestBatch(batch: ChatBridgeBatch): SeasonalChatEventDirectorSnapshot {
    this.runtime = batch.snapshot;
    const now = this.clock() as UnixMs;
    const triggered = inferBatchTriggeredEvents(this.programs, batch, now, this.runtime, this.options);

    for (const state of triggered) {
      const previous = this.activeEventsByKey.get(state.dedupeKey);
      if (previous && (now - previous.activatedAt) < (this.options.dedupeWindowMs ?? DEFAULT_OPTIONS.dedupeWindowMs)) {
        continue;
      }
      this.activeEventsByKey.set(state.dedupeKey, {
        ...state,
        batchTriggerEventType: batch.sourceEventType,
      });
      this.pushTransition({
        transitionId: `transition:${state.eventId}:${now}`,
        at: now,
        kind: state.lifecycle === 'WARMUP' ? 'EVENT_WARMUP' : 'EVENT_LIVE',
        programId: state.programId,
        campaignId: state.campaignId,
        eventId: state.eventId,
        headline: state.preview.headline,
        body: state.summary.summaryLine,
        severity: normalizeSeverity(state.visiblePriority),
      });
    }

    return this.evaluate();
  }

  public getSnapshot(): SeasonalChatEventDirectorSnapshot {
    return this.snapshot;
  }

  public evaluate(nowArg?: UnixMs): SeasonalChatEventDirectorSnapshot {
    const now = nowArg ?? (this.clock() as UnixMs);
    const generatedEvents = this.collectProgramEvents(now);
    const retainedEvents = this.collectRetainedTriggeredEvents(now);
    const activeEvents = [...generatedEvents, ...retainedEvents]
      .sort((left, right) => (right.visiblePriority - left.visiblePriority) || (right.shadowPriority - left.shadowPriority))
      .slice(0, this.options.maxActiveEvents ?? DEFAULT_OPTIONS.maxActiveEvents);

    const liveops = buildChatLiveOpsSnapshot(
      now,
      this.programs,
      activeEvents.map((event) => ({
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
      })),
      buildChannelRuntimeState(this.programs, activeEvents),
    );

    const health = buildChatLiveOpsHealthSnapshot(this.programs, activeEvents.map((event) => ({
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
    })));

    const summary = summarizeChatLiveOpsSnapshot(liveops);
    const overlayContexts = buildOverlayContextsFromEvents(activeEvents.map((event) => normalizeChatWorldEvent(this.findWorldEvent(event.programId, event.campaignId, event.eventId)!)));
    const derivedBatchEffects = buildDerivedNotifications(activeEvents, this.options.maxDerivedNotificationsPerTick ?? DEFAULT_OPTIONS.maxDerivedNotificationsPerTick, now);

    this.snapshot = {
      now,
      runtime: this.runtime,
      health,
      summary,
      liveops,
      activeEvents,
      transitions: [...this.transitions],
      derivedBatchEffects,
      legacyOverlaySnapshot: buildLegacyOverlaySnapshot(now, overlayContexts, activeEvents.map((event) => normalizeChatWorldEvent(this.findWorldEvent(event.programId, event.campaignId, event.eventId)!))),
    };

    this.emit();
    return this.snapshot;
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.snapshot);
    }
  }

  private collectProgramEvents(now: UnixMs): SeasonalChatEventRuntimeState[] {
    const collected: SeasonalChatEventRuntimeState[] = [];

    for (const program of this.programs) {
      for (const campaign of program.campaigns) {
        if (campaign.state === 'ENDED' || campaign.state === 'ARCHIVED' || campaign.state === 'PAUSED') {
          continue;
        }
        for (const event of campaign.worldEvents) {
          const state = deriveRuntimeEventState(event, 'PROGRAM', program.programId, campaign.campaignId, now, this.runtime, this.options);
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
      if (state.deactivatesAt <= now) {
        this.activeEventsByKey.delete(key);
        this.pushTransition({
          transitionId: `transition:end:${state.eventId}:${now}`,
          at: now,
          kind: 'EVENT_ENDED',
          programId: state.programId,
          campaignId: state.campaignId,
          eventId: state.eventId,
          headline: `${state.preview.headline} ended`,
          body: state.summary.summaryLine,
          severity: 'INFO',
        });
        continue;
      }
      retained.push(state);
    }
    return retained;
  }

  private pushTransition(transition: SeasonalChatEventTransition): void {
    this.transitions = [transition, ...this.transitions].slice(0, this.options.maxTransitionHistory ?? DEFAULT_OPTIONS.maxTransitionHistory);
  }

  private findWorldEvent(programId: string, campaignId: string, eventId: string): ChatWorldEventDefinition | null {
    for (const program of this.programs) {
      if (program.programId !== programId) {
        continue;
      }
      for (const campaign of program.campaigns) {
        if (campaign.campaignId !== campaignId) {
          continue;
        }
        for (const event of campaign.worldEvents) {
          if (event.eventId === eventId) {
            return event;
          }
        }
      }
    }
    return null;
  }
}

export function createSeasonalChatEventDirector(
  programs: readonly ChatLiveOpsProgram[] = [],
  options: SeasonalChatEventDirectorOptions = {},
): SeasonalChatEventDirector {
  return new SeasonalChatEventDirector(programs, options);
}
