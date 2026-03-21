
/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT INVASION ORCHESTRATOR
 * FILE: backend/src/game/engine/chat/ChatInvasionOrchestrator.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend owner for invasion planning, opening, closing, silent
 * priming, announcement planning, cooldown law, and maintenance around
 * room-scale hostile or world-event chat surges.
 *
 * Backend-truth question
 * ----------------------
 *
 *   "When should a room enter an invasion state, what kind should it be, how
 *    long should it persist, which channel should own it, whether should it be
 *    shadow-primed, and what authored scene / silence payload should the rest
 *    of the backend chat lane consume?"
 *
 * Design doctrine
 * ---------------
 * - invasions are backend orchestration, not UI timing;
 * - battle, run, economy, multiplayer, and liveops remain sovereign upstream;
 * - this file translates those truths into invasion decisions;
 * - it does not mutate transcript history directly;
 * - it may open / close invasion state and propose scene / silence plans;
 * - message creation remains downstream;
 * - proof, replay, and telemetry remain downstream;
 * - online inference may influence future versions, but runtime law and state
 *   gating remain final here.
 *
 * This file therefore owns:
 * - invasion eligibility,
 * - minimum gap and max-active law,
 * - invasion kind derivation,
 * - channel selection,
 * - shadow priming decisions,
 * - duration resolution,
 * - silence policy during invasion onset,
 * - authored announcement and response-candidate scene plans,
 * - maintenance and forced closure,
 * - explainable diagnostics.
 * ============================================================================
 */

import {
  CHAT_CHANNEL_DESCRIPTORS,
  asUnixMs,
  clamp01,
  clamp100,
  type AttackType,
  type BotId,
  type ChatAudienceHeat,
  type ChatBattleSnapshot,
  type ChatChannelId,
  type ChatEventId,
  type ChatInvasionId,
  type ChatInvasionState,
  type ChatLiveOpsSnapshot,
  type ChatPersonaId,
  type ChatResponseCandidate,
  type ChatRoomId,
  type ChatRoomKind,
  type ChatRoomState,
  type ChatSceneId,
  type ChatScenePlan,
  type ChatSignalEnvelope,
  type ChatSilenceDecision,
  type ChatState,
  type ChatVisibleChannel,
  type JsonValue,
  type Nullable,
  type Score01,
  type UnixMs,
} from './types';
import {
  DEFAULT_BACKEND_CHAT_RUNTIME,
  mergeRuntimeConfig,
  type ChatRuntimeConfigOptions,
} from './ChatRuntimeConfig';
import {
  clearSilenceDecision,
  closeInvasion,
  getActiveRoomInvasions,
  hasActiveInvasion,
  openInvasion,
  pruneExpiredInvasions,
  pruneExpiredSilences,
  setSilenceDecision,
} from './ChatState';

// ============================================================================
// MARK: Ports, options, context
// ============================================================================

export interface ChatInvasionLoggerPort {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface ChatInvasionClockPort {
  now(): UnixMs;
}

export interface ChatInvasionIdFactoryPort {
  invasionId(prefix?: string): ChatInvasionId;
  sceneId(prefix?: string): ChatSceneId;
}

export interface ChatInvasionRandomPort {
  next(): number;
}

export interface ChatInvasionOptions {
  readonly logger?: ChatInvasionLoggerPort;
  readonly clock?: ChatInvasionClockPort;
  readonly ids?: ChatInvasionIdFactoryPort;
  readonly random?: ChatInvasionRandomPort;
  readonly runtimeOptions?: ChatRuntimeConfigOptions;
  readonly runtimeOverride?: Partial<typeof DEFAULT_BACKEND_CHAT_RUNTIME>;
  readonly defaultAnnouncementChannel?: ChatVisibleChannel;
  readonly allowAnnouncementScenes?: boolean;
  readonly allowSilenceDuringPrime?: boolean;
  readonly systemShockHeatThreshold?: number;
  readonly liquidatorShieldThreshold01?: number;
  readonly rumorBurstBluffThreshold01?: number;
  readonly raidHostilityThreshold100?: number;
  readonly blackoutHelperThreshold?: boolean;
}

export interface ChatInvasionContext {
  readonly logger: ChatInvasionLoggerPort;
  readonly clock: ChatInvasionClockPort;
  readonly ids: ChatInvasionIdFactoryPort;
  readonly random: ChatInvasionRandomPort;
  readonly runtimeOptions?: ChatRuntimeConfigOptions;
  readonly runtimeOverride?: Partial<typeof DEFAULT_BACKEND_CHAT_RUNTIME>;
  readonly defaultAnnouncementChannel: ChatVisibleChannel;
  readonly allowAnnouncementScenes: boolean;
  readonly allowSilenceDuringPrime: boolean;
  readonly systemShockHeatThreshold: number;
  readonly liquidatorShieldThreshold01: number;
  readonly rumorBurstBluffThreshold01: number;
  readonly raidHostilityThreshold100: number;
  readonly blackoutHelperThreshold: boolean;
}

// ============================================================================
// MARK: Personas, plans, reasons, and reports
// ============================================================================

export const INVASION_PERSONAS = Object.freeze({
  liquidator: 'persona:hater:liquidator' as ChatPersonaId,
  manipulator: 'persona:hater:manipulator' as ChatPersonaId,
  bureaucrat: 'persona:hater:bureaucrat' as ChatPersonaId,
  mercy: 'persona:helper:mercy' as ChatPersonaId,
  anchor: 'persona:helper:anchor' as ChatPersonaId,
  floor: 'persona:ambient:floor' as ChatPersonaId,
  liveops: 'persona:system:liveops' as ChatPersonaId,
});

export interface ChatInvasionEligibility {
  readonly eligible: boolean;
  readonly reasons: readonly string[];
  readonly blockingReasons: readonly string[];
  readonly derivedKind: Nullable<ChatInvasionState['kind']>;
  readonly derivedChannelId: Nullable<ChatChannelId>;
}

export interface ChatInvasionTriggerContext {
  readonly room: ChatRoomState;
  readonly signal: ChatSignalEnvelope;
  readonly state: ChatState;
  readonly now: UnixMs;
  readonly causeEventId: Nullable<ChatEventId>;
}

export interface ChatInvasionSceneArtifacts {
  readonly scene: Nullable<ChatScenePlan>;
  readonly silence: Nullable<ChatSilenceDecision>;
  readonly visibleAnnouncement: Nullable<string>;
  readonly shadowAnnouncement: Nullable<string>;
}

export interface ChatInvasionPlan {
  readonly accepted: boolean;
  readonly reasons: readonly string[];
  readonly invasion: Nullable<ChatInvasionState>;
  readonly sceneArtifacts: ChatInvasionSceneArtifacts;
  readonly closeInvasionIds: readonly ChatInvasionId[];
  readonly telemetryHints: Readonly<Record<string, JsonValue>>;
}

export interface ChatInvasionMaintenanceRecord {
  readonly invasionId: ChatInvasionId;
  readonly action:
    | 'PRESERVED'
    | 'CLOSED_EXPIRED'
    | 'CLOSED_FOR_ROOM_REMOVAL'
    | 'CLOSED_FOR_DISABLED_RUNTIME'
    | 'PROMOTED_FROM_PRIMING'
    | 'CLEARED_SILENCE';
  readonly reason: string;
  readonly roomId: Nullable<ChatRoomId>;
}

export interface ChatInvasionMaintenanceReport {
  readonly records: readonly ChatInvasionMaintenanceRecord[];
  readonly closedInvasionIds: readonly ChatInvasionId[];
  readonly preservedInvasionIds: readonly ChatInvasionId[];
  readonly promotedInvasionIds: readonly ChatInvasionId[];
}

export interface CreateInvasionArgs {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly kind: ChatInvasionState['kind'];
  readonly now: UnixMs;
  readonly primedInShadow: boolean;
  readonly durationMs: number;
}

// ============================================================================
// MARK: Authority façade
// ============================================================================

export class ChatInvasionAuthority {
  private readonly context: ChatInvasionContext;

  constructor(options: ChatInvasionOptions = {}) {
    this.context = createInvasionContext(options);
  }

  contextValue(): ChatInvasionContext {
    return this.context;
  }

  eligibility(trigger: ChatInvasionTriggerContext): ChatInvasionEligibility {
    return evaluateInvasionEligibility(trigger, this.context);
  }

  plan(trigger: ChatInvasionTriggerContext): ChatInvasionPlan {
    return planInvasionFromSignal(trigger, this.context);
  }

  apply(state: ChatState, plan: ChatInvasionPlan): ChatState {
    return applyInvasionPlan(state, plan);
  }

  maintenance(state: ChatState, now: UnixMs): { state: ChatState; report: ChatInvasionMaintenanceReport } {
    return maintainInvasions(state, now, this.context);
  }

  create(args: CreateInvasionArgs): ChatInvasionState {
    return createInvasionState(args, this.context);
  }
}

export function createInvasionAuthority(options: ChatInvasionOptions = {}): ChatInvasionAuthority {
  return new ChatInvasionAuthority(options);
}

// ============================================================================
// MARK: Context and defaults
// ============================================================================

export function createInvasionContext(options: ChatInvasionOptions = {}): ChatInvasionContext {
  return Object.freeze({
    logger: options.logger ?? createDefaultInvasionLogger(),
    clock: options.clock ?? createDefaultInvasionClock(),
    ids: options.ids ?? createDefaultInvasionIds(),
    random: options.random ?? createDefaultInvasionRandom(),
    runtimeOptions: options.runtimeOptions,
    runtimeOverride: options.runtimeOverride,
    defaultAnnouncementChannel: options.defaultAnnouncementChannel ?? 'GLOBAL',
    allowAnnouncementScenes: options.allowAnnouncementScenes ?? true,
    allowSilenceDuringPrime: options.allowSilenceDuringPrime ?? true,
    systemShockHeatThreshold: clampThreshold(options.systemShockHeatThreshold ?? 0.84),
    liquidatorShieldThreshold01: clampThreshold(options.liquidatorShieldThreshold01 ?? 0.34),
    rumorBurstBluffThreshold01: clampThreshold(options.rumorBurstBluffThreshold01 ?? 0.62),
    raidHostilityThreshold100: Math.max(1, Math.min(100, Math.floor(options.raidHostilityThreshold100 ?? 68))),
    blackoutHelperThreshold: options.blackoutHelperThreshold ?? true,
  });
}

export function createDefaultInvasionLogger(): ChatInvasionLoggerPort {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

export function createDefaultInvasionClock(): ChatInvasionClockPort {
  return {
    now: () => asUnixMs(Date.now()),
  };
}

export function createDefaultInvasionIds(): ChatInvasionIdFactoryPort {
  return {
    invasionId: (prefix = 'inv') => `${prefix}_${Date.now()}_${randomBase36(8)}` as ChatInvasionId,
    sceneId: (prefix = 'scene') => `${prefix}_${Date.now()}_${randomBase36(8)}` as ChatSceneId,
  };
}

export function createDefaultInvasionRandom(): ChatInvasionRandomPort {
  return {
    next: () => Math.random(),
  };
}

// ============================================================================
// MARK: Runtime helpers
// ============================================================================

export function resolveInvasionRuntime(context: ChatInvasionContext) {
  return mergeRuntimeConfig(
    context.runtimeOverride ?? {},
    context.runtimeOptions,
  );
}

// ============================================================================
// MARK: Public planning entry points
// ============================================================================

export function planInvasionFromSignal(
  trigger: ChatInvasionTriggerContext,
  context: ChatInvasionContext,
): ChatInvasionPlan {
  const runtime = resolveInvasionRuntime(context);
  const eligibility = evaluateInvasionEligibility(trigger, context);
  const closeInvasionIds = collectClosureCandidates(trigger.state, trigger.room.roomId, trigger.signal, runtime);
  const reasons = [...eligibility.reasons];

  if (!runtime.invasionPolicy.enabled) {
    reasons.push('runtime invasion policy disabled');
    return rejectInvasionPlan(reasons, closeInvasionIds);
  }

  if (!eligibility.eligible || !eligibility.derivedKind || !eligibility.derivedChannelId) {
    return rejectInvasionPlan(reasons, closeInvasionIds);
  }

  const durationMs = resolveInvasionDurationMs(trigger, runtime);
  const primedInShadow = resolveShadowPriming(trigger, eligibility.derivedKind, runtime, context);

  const invasion = createInvasionState({
    roomId: trigger.room.roomId,
    channelId: eligibility.derivedChannelId,
    kind: eligibility.derivedKind,
    now: trigger.now,
    primedInShadow,
    durationMs,
  }, context);

  const sceneArtifacts = context.allowAnnouncementScenes
    ? createInvasionSceneArtifacts({
        invasion,
        room: trigger.room,
        signal: trigger.signal,
        state: trigger.state,
        now: trigger.now,
        causeEventId: trigger.causeEventId,
        context,
      })
    : {
        scene: null,
        silence: null,
        visibleAnnouncement: invasionAnnouncement(invasion.kind),
        shadowAnnouncement: invasionShadowAnnouncement(invasion.kind),
      } satisfies ChatInvasionSceneArtifacts;

  return {
    accepted: true,
    reasons: Object.freeze(reasons),
    invasion,
    sceneArtifacts,
    closeInvasionIds: Object.freeze(closeInvasionIds),
    telemetryHints: Object.freeze({
      kind: invasion.kind,
      channelId: invasion.channelId,
      primedInShadow: invasion.primedInShadow,
      durationMs,
      scenePlanned: Boolean(sceneArtifacts.scene),
    }),
  };
}

export function rejectInvasionPlan(
  reasons: readonly string[],
  closeInvasionIds: readonly ChatInvasionId[] = [],
): ChatInvasionPlan {
  return {
    accepted: false,
    reasons: Object.freeze([...reasons]),
    invasion: null,
    sceneArtifacts: {
      scene: null,
      silence: null,
      visibleAnnouncement: null,
      shadowAnnouncement: null,
    },
    closeInvasionIds: Object.freeze([...closeInvasionIds]),
    telemetryHints: Object.freeze({ accepted: false }),
  };
}

// ============================================================================
// MARK: Eligibility and derivation
// ============================================================================

export function evaluateInvasionEligibility(
  trigger: ChatInvasionTriggerContext,
  context: ChatInvasionContext,
): ChatInvasionEligibility {
  const runtime = resolveInvasionRuntime(context);
  const reasons: string[] = [];
  const blockingReasons: string[] = [];
  const roomId = trigger.room.roomId;
  const active = getActiveRoomInvasions(trigger.state, roomId);

  if (!runtime.invasionPolicy.enabled) {
    blockingReasons.push('invasion policy disabled');
  }

  if (active.length >= runtime.invasionPolicy.maxActivePerRoom) {
    blockingReasons.push('room reached max active invasions');
  }

  const timeSinceLastActivity = computeTimeSinceLastRoomActivity(trigger.state, roomId, trigger.now);
  if (timeSinceLastActivity != null && timeSinceLastActivity < runtime.invasionPolicy.minimumGapMs) {
    blockingReasons.push('room is still inside minimum invasion gap');
  }

  const derivedKind = deriveInvasionKind(trigger, context);
  if (!derivedKind) {
    blockingReasons.push('signal does not justify invasion kind');
  }

  const derivedChannelId = derivedKind
    ? deriveInvasionChannelId(trigger.room, trigger.signal, derivedKind, context)
    : null;

  if (!derivedChannelId) {
    blockingReasons.push('no legal invasion channel resolved');
  }

  reasons.push(...describeEligibility(trigger, derivedKind, derivedChannelId));

  return {
    eligible: blockingReasons.length === 0,
    reasons: Object.freeze(reasons),
    blockingReasons: Object.freeze(blockingReasons),
    derivedKind,
    derivedChannelId,
  };
}

export function deriveInvasionKind(
  trigger: ChatInvasionTriggerContext,
  context: ChatInvasionContext,
): Nullable<ChatInvasionState['kind']> {
  const signal = trigger.signal;
  const room = trigger.room;
  const heat = getRoomHeat(trigger.state, room.roomId);
  const battle = signal.battle;
  const economy = signal.economy;
  const liveops = signal.liveops;

  if (liveops?.helperBlackout && context.blackoutHelperThreshold) {
    return 'HELPER_BLACKOUT';
  }

  if ((liveops?.heatMultiplier01 != null && Number(liveops.heatMultiplier01) >= context.systemShockHeatThreshold) ||
      (heat && Number(heat.heat01) >= context.systemShockHeatThreshold && signal.type === 'LIVEOPS')) {
    return 'SYSTEM_SHOCK';
  }

  if (battle?.shieldIntegrity01 != null && Number(battle.shieldIntegrity01) <= context.liquidatorShieldThreshold01) {
    return 'LIQUIDATOR_SWEEP';
  }

  if (economy?.bluffRisk01 != null && Number(economy.bluffRisk01) >= context.rumorBurstBluffThreshold01) {
    return 'RUMOR_BURST';
  }

  if (battle?.hostileMomentum != null && Number(battle.hostileMomentum) >= context.raidHostilityThreshold100) {
    return 'HATER_RAID';
  }

  if (signal.type === 'LIVEOPS' && liveops?.haterRaidActive) {
    return 'HATER_RAID';
  }

  if (signal.type === 'LIVEOPS' && liveops?.worldEventName) {
    return 'SYSTEM_SHOCK';
  }

  if (room.roomKind === 'GLOBAL' && heat && Number(heat.heat01) >= 0.73 && battle?.activeAttackType === 'CROWD_SWARM') {
    return 'HATER_RAID';
  }

  return null;
}

export function deriveInvasionChannelId(
  room: ChatRoomState,
  signal: ChatSignalEnvelope,
  kind: ChatInvasionState['kind'],
  context: ChatInvasionContext,
): Nullable<ChatChannelId> {
  switch (kind) {
    case 'HATER_RAID':
      return room.roomKind === 'GLOBAL' ? 'GLOBAL' : room.activeVisibleChannel;
    case 'RUMOR_BURST':
      return room.roomKind === 'DEAL_ROOM' ? 'DEAL_ROOM' : 'GLOBAL';
    case 'HELPER_BLACKOUT':
      return room.roomKind === 'SYNDICATE' ? 'SYNDICATE' : 'GLOBAL';
    case 'LIQUIDATOR_SWEEP':
      return room.roomKind === 'DEAL_ROOM' ? 'DEAL_ROOM' : 'GLOBAL';
    case 'SYSTEM_SHOCK':
      if (signal.liveops?.helperBlackout) {
        return 'LIVEOPS_SHADOW';
      }
      return context.defaultAnnouncementChannel;
  }
}

export function describeEligibility(
  trigger: ChatInvasionTriggerContext,
  kind: Nullable<ChatInvasionState['kind']>,
  channelId: Nullable<ChatChannelId>,
): readonly string[] {
  const reasons: string[] = [];
  const signal = trigger.signal;
  const battle = signal.battle;
  const economy = signal.economy;
  const liveops = signal.liveops;
  const heat = getRoomHeat(trigger.state, trigger.room.roomId);

  reasons.push(`signal=${signal.type}`);
  reasons.push(`roomKind=${trigger.room.roomKind}`);
  if (kind) reasons.push(`kind=${kind}`);
  if (channelId) reasons.push(`channel=${channelId}`);
  if (battle?.hostileMomentum != null) reasons.push(`hostileMomentum=${Number(battle.hostileMomentum)}`);
  if (battle?.shieldIntegrity01 != null) reasons.push(`shield=${Number(battle.shieldIntegrity01).toFixed(2)}`);
  if (economy?.bluffRisk01 != null) reasons.push(`bluffRisk=${Number(economy.bluffRisk01).toFixed(2)}`);
  if (liveops?.worldEventName) reasons.push(`worldEvent=${liveops.worldEventName}`);
  if (heat) reasons.push(`heat=${Number(heat.heat01).toFixed(2)}`);

  return Object.freeze(reasons);
}

// ============================================================================
// MARK: State creation and apply helpers
// ============================================================================

export function createInvasionState(
  args: CreateInvasionArgs,
  context: ChatInvasionContext,
): ChatInvasionState {
  return {
    invasionId: context.ids.invasionId('inv'),
    roomId: args.roomId,
    channelId: args.channelId,
    status: args.primedInShadow ? 'PRIMING' : 'ACTIVE',
    kind: args.kind,
    openedAt: args.now,
    closesAt: asUnixMs(Number(args.now) + Math.max(1_000, args.durationMs)),
    primedInShadow: args.primedInShadow,
  };
}

export function applyInvasionPlan(
  state: ChatState,
  plan: ChatInvasionPlan,
): ChatState {
  let next = state;

  for (const invasionId of plan.closeInvasionIds) {
    next = closeInvasion(next, invasionId);
  }

  if (!plan.accepted || !plan.invasion) {
    return next;
  }

  next = openInvasion(next, plan.invasion);

  if (plan.sceneArtifacts.silence) {
    next = setSilenceDecision(next, plan.invasion.roomId, plan.sceneArtifacts.silence);
  }

  return next;
}

// ============================================================================
// MARK: Scene, silence, and announcement planning
// ============================================================================

export function createInvasionSceneArtifacts(args: {
  readonly invasion: ChatInvasionState;
  readonly room: ChatRoomState;
  readonly signal: ChatSignalEnvelope;
  readonly state: ChatState;
  readonly now: UnixMs;
  readonly causeEventId: Nullable<ChatEventId>;
  readonly context: ChatInvasionContext;
}): ChatInvasionSceneArtifacts {
  const silence = shouldPlanSilence(args.invasion, args.signal, args.context)
    ? createInvasionSilence(args.invasion, args.signal, args.now)
    : null;

  const scene = createInvasionScenePlan({
    invasion: args.invasion,
    room: args.room,
    signal: args.signal,
    state: args.state,
    now: args.now,
    causeEventId: args.causeEventId,
    context: args.context,
    silence,
  });

  return {
    scene,
    silence,
    visibleAnnouncement: invasionAnnouncement(args.invasion.kind),
    shadowAnnouncement: invasionShadowAnnouncement(args.invasion.kind),
  };
}

export function createInvasionScenePlan(args: {
  readonly invasion: ChatInvasionState;
  readonly room: ChatRoomState;
  readonly signal: ChatSignalEnvelope;
  readonly state: ChatState;
  readonly now: UnixMs;
  readonly causeEventId: Nullable<ChatEventId>;
  readonly context: ChatInvasionContext;
  readonly silence: Nullable<ChatSilenceDecision>;
}): ChatScenePlan {
  const messages = createInvasionResponseCandidates({
    invasion: args.invasion,
    room: args.room,
    signal: args.signal,
    state: args.state,
    now: args.now,
    causeEventId: args.causeEventId,
    context: args.context,
  });

  return {
    sceneId: args.context.ids.sceneId('scene:inv'),
    roomId: args.room.roomId,
    label: `INVASION:${args.invasion.kind}`,
    openedAt: args.now,
    messages,
    silence: args.silence,
    legendCandidate: args.invasion.kind === 'LIQUIDATOR_SWEEP' || args.invasion.kind === 'SYSTEM_SHOCK',
  };
}

export function createInvasionResponseCandidates(args: {
  readonly invasion: ChatInvasionState;
  readonly room: ChatRoomState;
  readonly signal: ChatSignalEnvelope;
  readonly state: ChatState;
  readonly now: UnixMs;
  readonly causeEventId: Nullable<ChatEventId>;
  readonly context: ChatInvasionContext;
}): readonly ChatResponseCandidate[] {
  const result: ChatResponseCandidate[] = [];

  const visibleChannel = toVisibleChannel(args.invasion.channelId) ?? args.room.activeVisibleChannel;

  result.push(
    createResponseCandidate({
      personaId: INVASION_PERSONAS.liveops,
      roomId: args.room.roomId,
      channelId: args.invasion.channelId,
      priority: 100,
      text: invasionAnnouncement(args.invasion.kind),
      tags: ['invasion', 'system', args.invasion.kind.toLowerCase()],
      delayMs: 0,
      causeEventId: args.causeEventId,
    }),
  );

  switch (args.invasion.kind) {
    case 'HATER_RAID':
      result.push(
        createResponseCandidate({
          personaId: INVASION_PERSONAS.manipulator,
          roomId: args.room.roomId,
          channelId: visibleChannel,
          priority: 92,
          text: pickRaidLine(args.signal.battle),
          tags: ['invasion', 'hater', 'raid'],
          delayMs: resolvePersonaDelayMs(INVASION_PERSONAS.manipulator, args.context, 900, 1800),
          causeEventId: args.causeEventId,
        }),
      );
      result.push(
        createResponseCandidate({
          personaId: INVASION_PERSONAS.floor,
          roomId: args.room.roomId,
          channelId: visibleChannel,
          priority: 64,
          text: 'Crowd pulse rising. The room is watching.',
          tags: ['invasion', 'ambient', 'crowd'],
          delayMs: resolvePersonaDelayMs(INVASION_PERSONAS.floor, args.context, 1200, 2500),
          causeEventId: args.causeEventId,
        }),
      );
      break;

    case 'RUMOR_BURST':
      result.push(
        createResponseCandidate({
          personaId: INVASION_PERSONAS.bureaucrat,
          roomId: args.room.roomId,
          channelId: visibleChannel,
          priority: 90,
          text: 'Rumor velocity spiking. Bluff integrity is collapsing.',
          tags: ['invasion', 'rumor', 'deal-room'],
          delayMs: resolvePersonaDelayMs(INVASION_PERSONAS.bureaucrat, args.context, 800, 1600),
          causeEventId: args.causeEventId,
        }),
      );
      break;

    case 'HELPER_BLACKOUT':
      result.push(
        createResponseCandidate({
          personaId: INVASION_PERSONAS.liveops,
          roomId: args.room.roomId,
          channelId: 'LIVEOPS_SHADOW',
          priority: 88,
          text: 'Helper lanes suppressed. Autonomous survival only.',
          tags: ['invasion', 'blackout', 'shadow'],
          delayMs: 0,
          causeEventId: args.causeEventId,
        }),
      );
      break;

    case 'LIQUIDATOR_SWEEP':
      result.push(
        createResponseCandidate({
          personaId: INVASION_PERSONAS.liquidator,
          roomId: args.room.roomId,
          channelId: visibleChannel,
          priority: 95,
          text: pickLiquidatorLine(args.signal.battle),
          tags: ['invasion', 'liquidator', 'hater'],
          delayMs: resolvePersonaDelayMs(INVASION_PERSONAS.liquidator, args.context, 300, 900),
          causeEventId: args.causeEventId,
        }),
      );
      if (!args.signal.liveops?.helperBlackout) {
        result.push(
          createResponseCandidate({
            personaId: INVASION_PERSONAS.anchor,
            roomId: args.room.roomId,
            channelId: visibleChannel,
            priority: 72,
            text: 'Stay clean. One correct move beats panic.',
            tags: ['invasion', 'helper', 'rescue'],
            delayMs: resolvePersonaDelayMs(INVASION_PERSONAS.anchor, args.context, 1400, 2600),
            causeEventId: args.causeEventId,
          }),
        );
      }
      break;

    case 'SYSTEM_SHOCK':
      result.push(
        createResponseCandidate({
          personaId: INVASION_PERSONAS.liveops,
          roomId: args.room.roomId,
          channelId: visibleChannel,
          priority: 91,
          text: 'System shock registered. Channel entropy rising.',
          tags: ['invasion', 'system-shock', 'liveops'],
          delayMs: 250,
          causeEventId: args.causeEventId,
        }),
      );
      result.push(
        createResponseCandidate({
          personaId: INVASION_PERSONAS.floor,
          roomId: args.room.roomId,
          channelId: visibleChannel,
          priority: 61,
          text: 'Everyone felt that. The room shifted.',
          tags: ['invasion', 'ambient', 'shift'],
          delayMs: resolvePersonaDelayMs(INVASION_PERSONAS.floor, args.context, 1100, 2200),
          causeEventId: args.causeEventId,
        }),
      );
      break;
  }

  return Object.freeze(result.sort((left, right) => right.priority - left.priority));
}

export function createInvasionSilence(
  invasion: ChatInvasionState,
  signal: ChatSignalEnvelope,
  now: UnixMs,
): ChatSilenceDecision {
  const silenceMs = resolveSilenceMs(invasion.kind, signal);
  return {
    active: true,
    startedAt: now,
    endsAt: asUnixMs(Number(now) + silenceMs),
    reason: `invasion:${invasion.kind.toLowerCase()}`,
  };
}

export function shouldPlanSilence(
  invasion: ChatInvasionState,
  signal: ChatSignalEnvelope,
  context: ChatInvasionContext,
): boolean {
  if (!context.allowSilenceDuringPrime) {
    return false;
  }

  if (invasion.primedInShadow) {
    return true;
  }

  switch (invasion.kind) {
    case 'HATER_RAID':
      return Boolean(signal.battle?.activeAttackType === 'CROWD_SWARM');
    case 'RUMOR_BURST':
      return Boolean(signal.economy?.bluffRisk01 && Number(signal.economy.bluffRisk01) > 0.75);
    case 'HELPER_BLACKOUT':
      return true;
    case 'LIQUIDATOR_SWEEP':
      return Boolean(signal.battle?.shieldIntegrity01 && Number(signal.battle.shieldIntegrity01) < 0.22);
    case 'SYSTEM_SHOCK':
      return true;
  }
}

export function resolveSilenceMs(
  kind: ChatInvasionState['kind'],
  signal: ChatSignalEnvelope,
): number {
  switch (kind) {
    case 'HATER_RAID':
      return signal.battle?.activeAttackType === 'CROWD_SWARM' ? 1_200 : 700;
    case 'RUMOR_BURST':
      return 600;
    case 'HELPER_BLACKOUT':
      return 1_500;
    case 'LIQUIDATOR_SWEEP':
      return 900;
    case 'SYSTEM_SHOCK':
      return 1_100;
  }
}

export function invasionAnnouncement(kind: ChatInvasionState['kind']): string {
  switch (kind) {
    case 'HATER_RAID':
      return 'LIVEOPS: coordinated hater raid detected.';
    case 'RUMOR_BURST':
      return 'LIVEOPS: rumor burst has entered the room.';
    case 'HELPER_BLACKOUT':
      return 'LIVEOPS: helper blackout in effect.';
    case 'LIQUIDATOR_SWEEP':
      return 'LIVEOPS: liquidator sweep targeting low-shield players.';
    case 'SYSTEM_SHOCK':
      return 'LIVEOPS: system shock rippling through all channels.';
  }
}

export function invasionShadowAnnouncement(kind: ChatInvasionState['kind']): string {
  switch (kind) {
    case 'HATER_RAID':
      return 'SHADOW: hostility surging before visible detonation.';
    case 'RUMOR_BURST':
      return 'SHADOW: narrative contamination now propagating.';
    case 'HELPER_BLACKOUT':
      return 'SHADOW: rescue lanes intentionally suppressed.';
    case 'LIQUIDATOR_SWEEP':
      return 'SHADOW: low-shield predation window open.';
    case 'SYSTEM_SHOCK':
      return 'SHADOW: system instability now precedes public awareness.';
  }
}

// ============================================================================
// MARK: Duration, priming, and closure law
// ============================================================================

export function resolveInvasionDurationMs(
  trigger: ChatInvasionTriggerContext,
  runtime: ReturnType<typeof resolveInvasionRuntime>,
): number {
  const base = runtime.invasionPolicy.defaultDurationMs;
  const heat = getRoomHeat(trigger.state, trigger.room.roomId);
  const multiplier =
    trigger.signal.liveops?.heatMultiplier01
      ? Math.max(1, Number(trigger.signal.liveops.heatMultiplier01))
      : heat
        ? 0.85 + Number(heat.heat01)
        : 1;

  const hostilityFactor =
    trigger.signal.battle?.hostileMomentum != null
      ? 0.85 + Number(trigger.signal.battle.hostileMomentum) / 120
      : 1;

  return Math.max(4_000, Math.floor(base * multiplier * hostilityFactor));
}

export function resolveShadowPriming(
  trigger: ChatInvasionTriggerContext,
  kind: ChatInvasionState['kind'],
  runtime: ReturnType<typeof resolveInvasionRuntime>,
  context: ChatInvasionContext,
): boolean {
  if (!runtime.invasionPolicy.allowShadowPriming) {
    return false;
  }

  if (kind === 'HELPER_BLACKOUT' || kind === 'SYSTEM_SHOCK') {
    return true;
  }

  if (kind === 'RUMOR_BURST') {
    return Boolean(trigger.signal.economy?.bluffRisk01 && Number(trigger.signal.economy.bluffRisk01) > 0.78);
  }

  if (kind === 'HATER_RAID') {
    return Boolean(trigger.signal.battle?.activeAttackType === 'SHADOW_LEAK');
  }

  if (kind === 'LIQUIDATOR_SWEEP') {
    return Boolean(trigger.signal.battle?.shieldIntegrity01 && Number(trigger.signal.battle.shieldIntegrity01) < 0.20);
  }

  return context.random.next() < 0.15;
}

export function collectClosureCandidates(
  state: ChatState,
  roomId: ChatRoomId,
  signal: ChatSignalEnvelope,
  runtime: ReturnType<typeof resolveInvasionRuntime>,
): readonly ChatInvasionId[] {
  const active = getActiveRoomInvasions(state, roomId);
  const closeIds: ChatInvasionId[] = [];

  for (const invasion of active) {
    if (!runtime.invasionPolicy.enabled) {
      closeIds.push(invasion.invasionId);
      continue;
    }

    if (signal.type === 'RUN' && signal.run?.outcome && signal.run.outcome !== 'UNRESOLVED') {
      closeIds.push(invasion.invasionId);
      continue;
    }

    if (signal.type === 'LIVEOPS' && signal.liveops && !signal.liveops.haterRaidActive && invasion.kind === 'HATER_RAID') {
      closeIds.push(invasion.invasionId);
      continue;
    }

    if (
      invasion.kind === 'LIQUIDATOR_SWEEP' &&
      signal.battle?.shieldIntegrity01 != null &&
      Number(signal.battle.shieldIntegrity01) > 0.62
    ) {
      closeIds.push(invasion.invasionId);
      continue;
    }
  }

  return Object.freeze(uniqueInvasionIds(closeIds));
}

// ============================================================================
// MARK: Maintenance
// ============================================================================

export function maintainInvasions(
  state: ChatState,
  now: UnixMs,
  context: ChatInvasionContext,
): { state: ChatState; report: ChatInvasionMaintenanceReport } {
  const runtime = resolveInvasionRuntime(context);
  let nextState = pruneExpiredInvasions(state, now);
  nextState = pruneExpiredSilences(nextState, now);

  const closed = new Set<ChatInvasionId>();
  const preserved = new Set<ChatInvasionId>();
  const promoted = new Set<ChatInvasionId>();
  const records: ChatInvasionMaintenanceRecord[] = [];

  for (const [invasionId, invasion] of Object.entries(state.activeInvasions) as [ChatInvasionId, ChatInvasionState][]) {
    const roomExists = Boolean(state.rooms[invasion.roomId]);

    if (!roomExists) {
      nextState = closeInvasion(nextState, invasionId);
      records.push({
        invasionId,
        action: 'CLOSED_FOR_ROOM_REMOVAL',
        reason: 'room no longer exists',
        roomId: invasion.roomId,
      });
      closed.add(invasionId);
      continue;
    }

    if (!runtime.invasionPolicy.enabled) {
      nextState = closeInvasion(nextState, invasionId);
      records.push({
        invasionId,
        action: 'CLOSED_FOR_DISABLED_RUNTIME',
        reason: 'runtime invasion policy disabled during maintenance',
        roomId: invasion.roomId,
      });
      closed.add(invasionId);
      continue;
    }

    if (Number(invasion.closesAt) <= Number(now)) {
      nextState = closeInvasion(nextState, invasionId);
      records.push({
        invasionId,
        action: 'CLOSED_EXPIRED',
        reason: 'invasion duration elapsed',
        roomId: invasion.roomId,
      });
      closed.add(invasionId);

      if (nextState.silencesByRoom[invasion.roomId]) {
        nextState = clearSilenceDecision(nextState, invasion.roomId);
        records.push({
          invasionId,
          action: 'CLEARED_SILENCE',
          reason: 'expired invasion cleared room silence',
          roomId: invasion.roomId,
        });
      }
      continue;
    }

    const current = nextState.activeInvasions[invasionId] ?? invasion;
    if (current.status === 'PRIMING' && Number(now) - Number(current.openedAt) >= 1_500) {
      const promotedState: ChatInvasionState = {
        ...current,
        status: 'ACTIVE',
      };

      nextState = openInvasion(nextState, promotedState);
      records.push({
        invasionId,
        action: 'PROMOTED_FROM_PRIMING',
        reason: 'shadow priming window elapsed into active state',
        roomId: current.roomId,
      });
      promoted.add(invasionId);
    } else {
      records.push({
        invasionId,
        action: 'PRESERVED',
        reason: 'invasion remains active',
        roomId: invasion.roomId,
      });
      preserved.add(invasionId);
    }
  }

  return {
    state: nextState,
    report: {
      records: Object.freeze(records),
      closedInvasionIds: Object.freeze([...closed]),
      preservedInvasionIds: Object.freeze([...preserved]),
      promotedInvasionIds: Object.freeze([...promoted]),
    },
  };
}

// ============================================================================
// MARK: Metrics, derivation, and diagnostics
// ============================================================================

export function computeTimeSinceLastRoomActivity(
  state: ChatState,
  roomId: ChatRoomId,
  now: UnixMs,
): Nullable<number> {
  const last = state.lastEventAtByRoom[roomId];
  if (!last) {
    return null;
  }
  return Math.max(0, Number(now) - Number(last));
}

export function getRoomHeat(state: ChatState, roomId: ChatRoomId): Nullable<ChatAudienceHeat> {
  return state.audienceHeatByRoom[roomId] ?? null;
}

export function describeInvasionState(invasion: ChatInvasionState): string {
  return [
    String(invasion.invasionId),
    invasion.kind,
    invasion.status,
    `room=${String(invasion.roomId)}`,
    `channel=${String(invasion.channelId)}`,
    `shadow=${invasion.primedInShadow ? 'yes' : 'no'}`,
  ].join(' | ');
}

export function invasionMaintenanceReportToJson(
  report: ChatInvasionMaintenanceReport,
): Readonly<Record<string, JsonValue>> {
  return Object.freeze({
    closedInvasionIds: report.closedInvasionIds.map((id) => String(id)),
    preservedInvasionIds: report.preservedInvasionIds.map((id) => String(id)),
    promotedInvasionIds: report.promotedInvasionIds.map((id) => String(id)),
    records: report.records.map((record) =>
      Object.freeze({
        invasionId: String(record.invasionId),
        action: record.action,
        reason: record.reason,
        roomId: record.roomId ? String(record.roomId) : null,
      }),
    ),
  });
}

export function invasionPlanToJson(
  plan: ChatInvasionPlan,
): Readonly<Record<string, JsonValue>> {
  return Object.freeze({
    accepted: plan.accepted,
    reasons: plan.reasons,
    closeInvasionIds: plan.closeInvasionIds.map((id) => String(id)),
    invasionId: plan.invasion ? String(plan.invasion.invasionId) : null,
    kind: plan.invasion?.kind ?? null,
    channelId: plan.invasion?.channelId ?? null,
    primedInShadow: plan.invasion?.primedInShadow ?? null,
    telemetryHints: plan.telemetryHints,
    scenePlanned: Boolean(plan.sceneArtifacts.scene),
    silencePlanned: Boolean(plan.sceneArtifacts.silence),
  });
}

// ============================================================================
// MARK: Candidate builders and authored copy
// ============================================================================

export function createResponseCandidate(args: {
  readonly personaId: ChatPersonaId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly priority: number;
  readonly text: string;
  readonly tags: readonly string[];
  readonly delayMs: number;
  readonly causeEventId: Nullable<ChatEventId>;
}): ChatResponseCandidate {
  return {
    personaId: args.personaId,
    roomId: args.roomId,
    channelId: args.channelId,
    priority: args.priority,
    text: args.text,
    tags: Object.freeze([...args.tags]),
    delayMs: Math.max(0, Math.floor(args.delayMs)),
    moderationBypassAllowed: args.channelId === 'LIVEOPS_SHADOW' || args.channelId === 'SYSTEM_SHADOW',
    causeEventId: args.causeEventId,
  };
}

export function resolvePersonaDelayMs(
  personaId: ChatPersonaId,
  context: ChatInvasionContext,
  floorMs: number,
  ceilingMs: number,
): number {
  const base = floorMs + Math.floor((ceilingMs - floorMs) * context.random.next());

  if (personaId === INVASION_PERSONAS.liquidator) {
    return Math.max(0, base - 300);
  }
  if (personaId === INVASION_PERSONAS.anchor || personaId === INVASION_PERSONAS.mercy) {
    return base + 350;
  }
  return base;
}

export function pickRaidLine(battle: Nullable<ChatBattleSnapshot | undefined>): string {
  if (battle?.activeAttackType === 'CROWD_SWARM') {
    return 'The room chose blood. You made yourself a target.';
  }
  if (battle?.activeAttackType === 'SABOTAGE') {
    return 'Sabotage pressure is live. Hold the line or get folded.';
  }
  return 'Raid posture confirmed. Every loose edge is visible now.';
}

export function pickLiquidatorLine(battle: Nullable<ChatBattleSnapshot | undefined>): string {
  if (battle?.shieldIntegrity01 != null && Number(battle.shieldIntegrity01) < 0.18) {
    return 'Your shield is paper. One clean hit and the room takes you apart.';
  }
  if (battle?.rescueWindowOpen) {
    return 'Rescue windows tempt the weak. I prefer collectors.';
  }
  return 'Low-shield signature acquired. Liquidation protocol engaged.';
}

// ============================================================================
// MARK: Misc channel and signal helpers
// ============================================================================

export function toVisibleChannel(channelId: ChatChannelId): Nullable<ChatVisibleChannel> {
  return CHAT_CHANNEL_DESCRIPTORS[channelId]?.visibleToPlayer ? (channelId as ChatVisibleChannel) : null;
}

export function deriveAttackPressureLabel(attackType: Nullable<AttackType | undefined>): string {
  switch (attackType) {
    case 'TAUNT':
      return 'taunt pressure';
    case 'LIQUIDATION':
      return 'liquidation pressure';
    case 'SABOTAGE':
      return 'sabotage pressure';
    case 'COMPLIANCE':
      return 'compliance pressure';
    case 'CROWD_SWARM':
      return 'crowd pressure';
    case 'SHADOW_LEAK':
      return 'shadow pressure';
    default:
      return 'ambient pressure';
  }
}

export function describeSignalEnvelope(signal: ChatSignalEnvelope): string {
  const fragments: string[] = [signal.type];
  if (signal.battle?.activeAttackType) fragments.push(`attack=${signal.battle.activeAttackType}`);
  if (signal.battle?.activeBotId) fragments.push(`bot=${String(signal.battle.activeBotId)}`);
  if (signal.run?.outcome) fragments.push(`outcome=${signal.run.outcome}`);
  if (signal.liveops?.worldEventName) fragments.push(`world=${signal.liveops.worldEventName}`);
  return fragments.join(' ');
}

// ============================================================================
// MARK: Internal helpers
// ============================================================================

function clampThreshold(value: number): number {
  return Math.max(0.01, Math.min(0.99, value));
}

function uniqueInvasionIds(values: readonly ChatInvasionId[]): readonly ChatInvasionId[] {
  return Object.freeze([...new Set(values)]);
}

function randomBase36(length: number): string {
  let output = '';
  while (output.length < length) {
    output += Math.random().toString(36).slice(2);
  }
  return output.slice(0, length);
}
