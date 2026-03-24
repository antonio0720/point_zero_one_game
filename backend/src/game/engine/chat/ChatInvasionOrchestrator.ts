
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

// ============================================================================
// MARK: Invasion watch bus
// ============================================================================

export type InvasionWatchEventKind =
  | 'INVASION_OPENED'
  | 'INVASION_PRIMED'
  | 'INVASION_CLOSED'
  | 'INVASION_EXPIRED'
  | 'SILENCE_SET'
  | 'SILENCE_CLEARED'
  | 'COOLDOWN_STARTED'
  | 'CANDIDATE_RANKED';

export interface InvasionWatchEvent {
  readonly kind: InvasionWatchEventKind;
  readonly roomId: ChatRoomId;
  readonly invasionId: ChatInvasionId | null;
  readonly detail: string;
  readonly occurredAt: UnixMs;
}

export class InvasionWatchBus {
  private readonly handlers: Array<(evt: InvasionWatchEvent) => void> = [];

  subscribe(handler: (evt: InvasionWatchEvent) => void): () => void {
    this.handlers.push(handler);
    return () => {
      const idx = this.handlers.indexOf(handler);
      if (idx !== -1) this.handlers.splice(idx, 1);
    };
  }

  emit(evt: InvasionWatchEvent): void {
    for (const h of this.handlers) {
      try { h(evt); } catch { /* noop */ }
    }
  }

  emitOpen(roomId: ChatRoomId, invasionId: ChatInvasionId): void {
    this.emit({ kind: 'INVASION_OPENED', roomId, invasionId, detail: `invasion ${invasionId} opened`, occurredAt: asUnixMs(Date.now()) });
  }

  emitClose(roomId: ChatRoomId, invasionId: ChatInvasionId): void {
    this.emit({ kind: 'INVASION_CLOSED', roomId, invasionId, detail: `invasion ${invasionId} closed`, occurredAt: asUnixMs(Date.now()) });
  }

  emitSilenceSet(roomId: ChatRoomId, reason: string): void {
    this.emit({ kind: 'SILENCE_SET', roomId, invasionId: null, detail: `silence set: ${reason}`, occurredAt: asUnixMs(Date.now()) });
  }

  emitCooldownStarted(roomId: ChatRoomId): void {
    this.emit({ kind: 'COOLDOWN_STARTED', roomId, invasionId: null, detail: 'cooldown started', occurredAt: asUnixMs(Date.now()) });
  }
}

// ============================================================================
// MARK: Invasion analytics
// ============================================================================

export interface InvasionRecord {
  readonly invasionId: ChatInvasionId;
  readonly roomId: ChatRoomId;
  readonly kind: ChatInvasionState['kind'];
  readonly openedAt: UnixMs;
  readonly closedAt: UnixMs | null;
  readonly durationMs: number | null;
  readonly primedInShadow: boolean;
}

export interface InvasionAnalytics {
  readonly totalInvasions: number;
  readonly byKind: Record<string, number>;
  readonly avgDurationMs: number;
  readonly shadowPrimedRatio: number;
  readonly roomInvasionCounts: Record<string, number>;
  readonly generatedAt: UnixMs;
}

export function buildInvasionAnalytics(records: readonly InvasionRecord[]): InvasionAnalytics {
  const byKind: Record<string, number> = {};
  const roomCounts: Record<string, number> = {};
  let totalDuration = 0;
  let durationCount = 0;
  let shadowPrimedCount = 0;

  for (const rec of records) {
    byKind[rec.kind] = (byKind[rec.kind] ?? 0) + 1;
    roomCounts[rec.roomId] = (roomCounts[rec.roomId] ?? 0) + 1;
    if (rec.primedInShadow) shadowPrimedCount++;
    if (rec.durationMs !== null) { totalDuration += rec.durationMs; durationCount++; }
  }

  return Object.freeze({
    totalInvasions: records.length,
    byKind,
    avgDurationMs: durationCount > 0 ? totalDuration / durationCount : 0,
    shadowPrimedRatio: records.length > 0 ? shadowPrimedCount / records.length : 0,
    roomInvasionCounts: roomCounts,
    generatedAt: asUnixMs(Date.now()),
  });
}

// ============================================================================
// MARK: Invasion fingerprint
// ============================================================================

export interface InvasionFingerprint {
  readonly invasionId: ChatInvasionId;
  readonly hash: string;
  readonly computedAt: UnixMs;
}

export function computeInvasionFingerprint(invasion: ChatInvasionState): InvasionFingerprint {
  const parts = [invasion.invasionId, invasion.roomId, invasion.channelId, invasion.status, invasion.kind, String(invasion.openedAt)];
  let h = 5381;
  for (const p of parts) {
    for (let i = 0; i < p.length; i++) {
      h = ((h << 5) + h + p.charCodeAt(i)) >>> 0;
    }
  }
  return Object.freeze({ invasionId: invasion.invasionId, hash: h.toString(16).padStart(8, '0'), computedAt: asUnixMs(Date.now()) });
}

// ============================================================================
// MARK: Invasion severity scorer
// ============================================================================

export interface InvasionSeverityScore {
  readonly invasionId: ChatInvasionId;
  readonly severityScore: number;
  readonly severityBand: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly factors: readonly string[];
}

export function scoreInvasionSeverity(
  invasion: ChatInvasionState,
  heat: ChatAudienceHeat | null,
): InvasionSeverityScore {
  let score = 0;
  const factors: string[] = [];

  if (invasion.kind === 'HATER_RAID') { score += 0.4; factors.push('hater_raid_base'); }
  else if (invasion.kind === 'LIQUIDATOR_SWEEP') { score += 0.5; factors.push('liquidator_base'); }
  else if (invasion.kind === 'SYSTEM_SHOCK') { score += 0.6; factors.push('system_shock_base'); }
  else if (invasion.kind === 'HELPER_BLACKOUT') { score += 0.3; factors.push('helper_blackout_base'); }
  else { score += 0.2; factors.push('rumor_burst_base'); }

  if (!invasion.primedInShadow) { score += 0.2; factors.push('no_shadow_prime'); }

  if (heat) {
    const heatVal = heat.heat01 as unknown as number;
    if (heatVal > 0.7) { score += 0.2; factors.push('high_audience_heat'); }
  }

  const severityScore = clamp01(score);
  const band: InvasionSeverityScore['severityBand'] =
    severityScore >= 0.8 ? 'CRITICAL'
    : severityScore >= 0.6 ? 'HIGH'
    : severityScore >= 0.4 ? 'MEDIUM'
    : 'LOW';

  return Object.freeze({ invasionId: invasion.invasionId, severityScore, severityBand: band, factors: Object.freeze(factors) });
}

// ============================================================================
// MARK: Invasion timing policy
// ============================================================================

export interface InvasionTimingPolicy {
  readonly kind: ChatInvasionState['kind'];
  readonly minDurationMs: number;
  readonly maxDurationMs: number;
  readonly cooldownMs: number;
  readonly shadowPrimeDurationMs: number;
}

export const INVASION_TIMING_POLICIES: Record<ChatInvasionState['kind'], InvasionTimingPolicy> = Object.freeze({
  HATER_RAID: Object.freeze({ kind: 'HATER_RAID', minDurationMs: 30_000, maxDurationMs: 120_000, cooldownMs: 300_000, shadowPrimeDurationMs: 5_000 }),
  RUMOR_BURST: Object.freeze({ kind: 'RUMOR_BURST', minDurationMs: 15_000, maxDurationMs: 60_000, cooldownMs: 180_000, shadowPrimeDurationMs: 3_000 }),
  HELPER_BLACKOUT: Object.freeze({ kind: 'HELPER_BLACKOUT', minDurationMs: 20_000, maxDurationMs: 90_000, cooldownMs: 240_000, shadowPrimeDurationMs: 4_000 }),
  LIQUIDATOR_SWEEP: Object.freeze({ kind: 'LIQUIDATOR_SWEEP', minDurationMs: 45_000, maxDurationMs: 180_000, cooldownMs: 360_000, shadowPrimeDurationMs: 8_000 }),
  SYSTEM_SHOCK: Object.freeze({ kind: 'SYSTEM_SHOCK', minDurationMs: 10_000, maxDurationMs: 30_000, cooldownMs: 600_000, shadowPrimeDurationMs: 2_000 }),
}) as Record<ChatInvasionState['kind'], InvasionTimingPolicy>;

export function getInvasionTimingPolicy(kind: ChatInvasionState['kind']): InvasionTimingPolicy {
  return INVASION_TIMING_POLICIES[kind];
}

// ============================================================================
// MARK: Invasion channel validator
// ============================================================================

export interface InvasionChannelValidation {
  readonly channelId: ChatChannelId;
  readonly isValid: boolean;
  readonly reason: string;
}

export function validateInvasionChannel(channelId: ChatChannelId): InvasionChannelValidation {
  const desc = CHAT_CHANNEL_DESCRIPTORS[channelId];
  if (!desc) return Object.freeze({ channelId, isValid: false, reason: 'unknown_channel' });
  if (!desc.supportsNpcInjection) return Object.freeze({ channelId, isValid: false, reason: 'no_npc_injection' });
  return Object.freeze({ channelId, isValid: true, reason: 'valid_for_invasion' });
}

// ============================================================================
// MARK: Invasion room state snapshot
// ============================================================================

export interface InvasionRoomSnapshot {
  readonly roomId: ChatRoomId;
  readonly roomKind: ChatRoomKind;
  readonly activeInvasionIds: readonly ChatInvasionId[];
  readonly hasSilence: boolean;
  readonly audienceHeat01: number;
  readonly snapshotAt: UnixMs;
}

export function buildInvasionRoomSnapshot(
  room: ChatRoomState,
  state: ChatState,
  heat: ChatAudienceHeat | null,
): InvasionRoomSnapshot {
  const activeInvasions = getActiveRoomInvasions(state, room.roomId);
  const hasSilence = !!(state as unknown as { silenceByRoom?: Record<string, unknown> }).silenceByRoom?.[room.roomId];
  const heatVal = heat ? (heat.heat01 as unknown as number) : 0;

  return Object.freeze({
    roomId: room.roomId,
    roomKind: room.roomKind,
    activeInvasionIds: Object.freeze(activeInvasions.map((inv) => inv.invasionId)),
    hasSilence,
    audienceHeat01: heatVal,
    snapshotAt: asUnixMs(Date.now()),
  });
}

// ============================================================================
// MARK: Invasion eligibility matrix
// ============================================================================

export interface InvasionEligibilityMatrix {
  readonly roomId: ChatRoomId;
  readonly eligibleKinds: readonly ChatInvasionState['kind'][];
  readonly ineligibleKinds: readonly ChatInvasionState['kind'][];
  readonly blockingReasons: Record<string, string>;
  readonly generatedAt: UnixMs;
}

export function buildInvasionEligibilityMatrix(
  roomId: ChatRoomId,
  state: ChatState,
  heat: ChatAudienceHeat | null,
): InvasionEligibilityMatrix {
  const ALL_KINDS: ChatInvasionState['kind'][] = ['HATER_RAID', 'RUMOR_BURST', 'HELPER_BLACKOUT', 'LIQUIDATOR_SWEEP', 'SYSTEM_SHOCK'];
  const eligible: ChatInvasionState['kind'][] = [];
  const ineligible: ChatInvasionState['kind'][] = [];
  const blockingReasons: Record<string, string> = {};
  const hasActive = hasActiveInvasion(state, roomId);
  const heatVal = heat ? (heat.heat01 as unknown as number) : 0;

  for (const kind of ALL_KINDS) {
    if (hasActive) {
      ineligible.push(kind);
      blockingReasons[kind] = 'invasion_already_active';
      continue;
    }
    if (kind === 'LIQUIDATOR_SWEEP' && heatVal < 0.4) {
      ineligible.push(kind);
      blockingReasons[kind] = 'liquidator_requires_heat_above_0.4';
      continue;
    }
    if (kind === 'SYSTEM_SHOCK' && heatVal > 0.8) {
      ineligible.push(kind);
      blockingReasons[kind] = 'system_shock_blocked_at_high_heat';
      continue;
    }
    eligible.push(kind);
  }

  return Object.freeze({ roomId, eligibleKinds: Object.freeze(eligible), ineligibleKinds: Object.freeze(ineligible), blockingReasons, generatedAt: asUnixMs(Date.now()) });
}

// ============================================================================
// MARK: Invasion silence policy
// ============================================================================

export interface InvasionSilencePolicy {
  readonly shouldSilence: boolean;
  readonly silenceDurationMs: number;
  readonly reason: string;
}

export function computeInvasionSilencePolicy(
  kind: ChatInvasionState['kind'],
  heat: ChatAudienceHeat | null,
): InvasionSilencePolicy {
  const heatVal = heat ? (heat.heat01 as unknown as number) : 0;

  if (kind === 'HELPER_BLACKOUT') {
    return Object.freeze({ shouldSilence: true, silenceDurationMs: 30_000, reason: 'helper_blackout_requires_silence' });
  }
  if (kind === 'SYSTEM_SHOCK' && heatVal > 0.6) {
    return Object.freeze({ shouldSilence: true, silenceDurationMs: 10_000, reason: 'system_shock_high_heat_silence' });
  }
  return Object.freeze({ shouldSilence: false, silenceDurationMs: 0, reason: 'no_silence_required' });
}

// ============================================================================
// MARK: Invasion module constants
// ============================================================================

export const CHAT_INVASION_MODULE_NAME = 'ChatInvasionOrchestrator' as const;
export const CHAT_INVASION_MODULE_VERSION = '3.0.0' as const;

export const CHAT_INVASION_LAWS = Object.freeze([
  'Invasions are backend orchestration — no direct client trigger.',
  'Only one active invasion per room at a time.',
  'Shadow-primed invasions must complete priming before going active.',
  'Cooldown periods are strictly enforced after invasion close.',
  'Silence decisions follow invasion kind rules — not configurable at runtime.',
  'All invasion IDs are generated server-side and are non-predictable.',
  'Invasion analytics are read-only and never mutate state.',
]);

export const CHAT_INVASION_MODULE_DESCRIPTOR = Object.freeze({
  name: CHAT_INVASION_MODULE_NAME,
  version: CHAT_INVASION_MODULE_VERSION,
  laws: CHAT_INVASION_LAWS,
  supportedKinds: ['HATER_RAID', 'RUMOR_BURST', 'HELPER_BLACKOUT', 'LIQUIDATOR_SWEEP', 'SYSTEM_SHOCK'] as const,
  timingPolicies: INVASION_TIMING_POLICIES,
});

// ============================================================================
// MARK: Invasion exported utilities
// ============================================================================

export { clampThreshold, uniqueInvasionIds, randomBase36 };

// ============================================================================
// MARK: Invasion decision trace
// ============================================================================

/** Full record of the decision trail that led to opening (or refusing) an invasion. */
export interface InvasionDecisionTrace {
  readonly traceId: string;
  readonly roomId: ChatRoomId;
  readonly evaluatedAt: UnixMs;
  readonly signalType: ChatSignalEnvelope['type'];
  readonly eligibilityResult: ChatInvasionEligibility;
  readonly derivedKind: Nullable<ChatInvasionState['kind']>;
  readonly derivedChannelId: Nullable<ChatChannelId>;
  readonly silencePolicy: InvasionSilencePolicy;
  readonly severityScore: InvasionSeverityScore;
  readonly opened: boolean;
  readonly openedInvasionId: Nullable<ChatInvasionId>;
  readonly refusalReasons: readonly string[];
}

export function buildInvasionDecisionTrace(
  roomId: ChatRoomId,
  signal: ChatSignalEnvelope,
  eligibility: ChatInvasionEligibility,
  severityScore: InvasionSeverityScore,
  silencePolicy: InvasionSilencePolicy,
  opened: boolean,
  openedInvasionId: Nullable<ChatInvasionId>,
  now: UnixMs,
): InvasionDecisionTrace {
  return Object.freeze({
    traceId: `trace:${roomId}:${now}`,
    roomId,
    evaluatedAt: now,
    signalType: signal.type,
    eligibilityResult: eligibility,
    derivedKind: eligibility.derivedKind,
    derivedChannelId: eligibility.derivedChannelId,
    silencePolicy,
    severityScore,
    opened,
    openedInvasionId: opened ? openedInvasionId : null,
    refusalReasons: opened ? [] : eligibility.blockingReasons,
  });
}

// ============================================================================
// MARK: Invasion batch statistics
// ============================================================================

/** Aggregate statistics computed across multiple invasions in a room or session. */
export interface InvasionBatchReport {
  readonly roomId: ChatRoomId;
  readonly computedAt: UnixMs;
  readonly totalInvasions: number;
  readonly activeCount: number;
  readonly primingCount: number;
  readonly resolvedCount: number;
  readonly byKind: Readonly<Record<string, number>>;
  readonly averageSeverity01: number;
  readonly maxSeverity01: number;
  readonly averageDurationMs: number;
  readonly maxDurationMs: number;
  readonly invasionIds: readonly ChatInvasionId[];
}

export function buildInvasionBatchReport(
  roomId: ChatRoomId,
  invasions: readonly ChatInvasionState[],
  now: UnixMs,
): InvasionBatchReport {
  const byKind: Record<string, number> = {};
  let totalSeverity = 0;
  let maxSeverity = 0;
  let totalDuration = 0;
  let maxDuration = 0;
  let active = 0;
  let priming = 0;
  let resolved = 0;

  for (const inv of invasions) {
    byKind[inv.kind] = (byKind[inv.kind] ?? 0) + 1;
    const sev = scoreInvasionSeverity(inv, null).severityScore as unknown as number;
    totalSeverity += sev;
    if (sev > maxSeverity) maxSeverity = sev;
    const dur = ((inv.closesAt as unknown as number) - (inv.openedAt as unknown as number)) || 0;
    totalDuration += dur;
    if (dur > maxDuration) maxDuration = dur;
    if (inv.status === 'ACTIVE') active++;
    else if (inv.status === 'PRIMING') priming++;
    else resolved++;
  }

  const n = invasions.length || 1;
  return Object.freeze({
    roomId,
    computedAt: now,
    totalInvasions: invasions.length,
    activeCount: active,
    primingCount: priming,
    resolvedCount: resolved,
    byKind: Object.freeze(byKind),
    averageSeverity01: totalSeverity / n,
    maxSeverity01: maxSeverity,
    averageDurationMs: totalDuration / n,
    maxDurationMs: maxDuration,
    invasionIds: Object.freeze(invasions.map((i) => i.invasionId)),
  });
}

// ============================================================================
// MARK: Invasion cooldown tracker
// ============================================================================

export interface InvasionCooldownEntry {
  readonly roomId: ChatRoomId;
  readonly kind: ChatInvasionState['kind'];
  readonly closedAt: UnixMs;
  readonly cooldownMs: number;
  readonly expiresAt: UnixMs;
}

export function isInvasionCooldown(entry: InvasionCooldownEntry, now: UnixMs): boolean {
  return (now as unknown as number) < (entry.expiresAt as unknown as number);
}

export function remainingCooldownMs(entry: InvasionCooldownEntry, now: UnixMs): number {
  const remaining = (entry.expiresAt as unknown as number) - (now as unknown as number);
  return remaining > 0 ? remaining : 0;
}

/** In-memory per-room cooldown tracker. Does not persist across restarts. */
export class InvasionCooldownTracker {
  private readonly entries: Map<string, InvasionCooldownEntry> = new Map();

  key(roomId: ChatRoomId, kind: ChatInvasionState['kind']): string {
    return `${roomId}:${kind}`;
  }

  record(
    roomId: ChatRoomId,
    kind: ChatInvasionState['kind'],
    closedAt: UnixMs,
    cooldownMs: number,
  ): void {
    const entry: InvasionCooldownEntry = {
      roomId,
      kind,
      closedAt,
      cooldownMs,
      expiresAt: asUnixMs((closedAt as unknown as number) + cooldownMs),
    };
    this.entries.set(this.key(roomId, kind), entry);
  }

  check(roomId: ChatRoomId, kind: ChatInvasionState['kind'], now: UnixMs): boolean {
    const entry = this.entries.get(this.key(roomId, kind));
    if (!entry) return false;
    return isInvasionCooldown(entry, now);
  }

  remaining(roomId: ChatRoomId, kind: ChatInvasionState['kind'], now: UnixMs): number {
    const entry = this.entries.get(this.key(roomId, kind));
    if (!entry) return 0;
    return remainingCooldownMs(entry, now);
  }

  purgeExpired(now: UnixMs): void {
    for (const [k, entry] of this.entries) {
      if (!isInvasionCooldown(entry, now)) this.entries.delete(k);
    }
  }

  allEntries(): readonly InvasionCooldownEntry[] {
    return Array.from(this.entries.values());
  }

  size(): number {
    return this.entries.size;
  }
}

// ============================================================================
// MARK: Room invasion history summary
// ============================================================================

export interface RoomInvasionHistorySummary {
  readonly roomId: ChatRoomId;
  readonly computedAt: UnixMs;
  readonly totalEverSeen: number;
  readonly kindsEverSeen: readonly ChatInvasionState['kind'][];
  readonly lastInvasionAt: Nullable<UnixMs>;
  readonly lastKind: Nullable<ChatInvasionState['kind']>;
  readonly lastChannelId: Nullable<ChatChannelId>;
  readonly peakSeverity01: number;
  readonly avgSeverity01: number;
}

export function buildRoomInvasionHistorySummary(
  roomId: ChatRoomId,
  invasions: readonly ChatInvasionState[],
  now: UnixMs,
): RoomInvasionHistorySummary {
  const kindsSet = new Set<ChatInvasionState['kind']>();
  let peakSev = 0;
  let totalSev = 0;
  let lastAt: Nullable<UnixMs> = null;
  let lastKind: Nullable<ChatInvasionState['kind']> = null;
  let lastChannel: Nullable<ChatChannelId> = null;

  for (const inv of invasions) {
    kindsSet.add(inv.kind);
    const sev = scoreInvasionSeverity(inv, null).severityScore as unknown as number;
    if (sev > peakSev) peakSev = sev;
    totalSev += sev;
    const openedAt = inv.openedAt as unknown as number;
    if (lastAt === null || openedAt > (lastAt as unknown as number)) {
      lastAt = inv.openedAt;
      lastKind = inv.kind;
      lastChannel = inv.channelId;
    }
  }

  const n = invasions.length || 1;
  return Object.freeze({
    roomId,
    computedAt: now,
    totalEverSeen: invasions.length,
    kindsEverSeen: Object.freeze(Array.from(kindsSet)),
    lastInvasionAt: lastAt,
    lastKind,
    lastChannelId: lastChannel,
    peakSeverity01: peakSev,
    avgSeverity01: totalSev / n,
  });
}

// ============================================================================
// MARK: Invasion phase report
// ============================================================================

export type InvasionPhase = 'PRE_INVASION' | 'PRIMING' | 'ACTIVE' | 'COOLDOWN' | 'IDLE';

export interface InvasionPhaseReport {
  readonly roomId: ChatRoomId;
  readonly phase: InvasionPhase;
  readonly activeInvasionId: Nullable<ChatInvasionId>;
  readonly activeKind: Nullable<ChatInvasionState['kind']>;
  readonly activeChannelId: Nullable<ChatChannelId>;
  readonly primingCount: number;
  readonly remainingCooldownMs: number;
  readonly computedAt: UnixMs;
}

export function computeInvasionPhaseReport(
  roomId: ChatRoomId,
  state: ChatState,
  cooldownTracker: InvasionCooldownTracker,
  now: UnixMs,
): InvasionPhaseReport {
  const active = getActiveRoomInvasions(state, roomId);
  const priming = active.filter((i) => i.status === 'PRIMING');
  const running = active.filter((i) => i.status === 'ACTIVE');

  if (running.length > 0) {
    const inv = running[0]!;
    return Object.freeze({
      roomId,
      phase: 'ACTIVE',
      activeInvasionId: inv.invasionId,
      activeKind: inv.kind,
      activeChannelId: inv.channelId,
      primingCount: priming.length,
      remainingCooldownMs: 0,
      computedAt: now,
    });
  }

  if (priming.length > 0) {
    const inv = priming[0]!;
    return Object.freeze({
      roomId,
      phase: 'PRIMING',
      activeInvasionId: inv.invasionId,
      activeKind: inv.kind,
      activeChannelId: inv.channelId,
      primingCount: priming.length,
      remainingCooldownMs: 0,
      computedAt: now,
    });
  }

  // Check cooldown for any kind
  const allEntries = cooldownTracker.allEntries().filter((e) => e.roomId === roomId);
  const maxRemaining = allEntries.reduce(
    (acc, e) => Math.max(acc, remainingCooldownMs(e, now)),
    0,
  );

  if (maxRemaining > 0) {
    return Object.freeze({
      roomId,
      phase: 'COOLDOWN',
      activeInvasionId: null,
      activeKind: null,
      activeChannelId: null,
      primingCount: 0,
      remainingCooldownMs: maxRemaining,
      computedAt: now,
    });
  }

  return Object.freeze({
    roomId,
    phase: 'IDLE',
    activeInvasionId: null,
    activeKind: null,
    activeChannelId: null,
    primingCount: 0,
    remainingCooldownMs: 0,
    computedAt: now,
  });
}

// ============================================================================
// MARK: Invasion quality grader
// ============================================================================

export type InvasionQualityGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface InvasionQualityReport {
  readonly invasionId: ChatInvasionId;
  readonly grade: InvasionQualityGrade;
  readonly score01: number;
  readonly reasons: readonly string[];
}

export function gradeInvasionQuality(
  invasion: ChatInvasionState,
  heat: ChatAudienceHeat | null,
): InvasionQualityReport {
  const sev = scoreInvasionSeverity(invasion, heat);
  const sevNum = sev.severityScore as unknown as number;
  const reasons: string[] = [];

  let score = sevNum;

  // Penalize PRIMING state that never went active
  if (invasion.status === 'PRIMING') {
    score -= 0.2;
    reasons.push('invasion_never_activated');
  }

  // Reward channel match
  const desc = CHAT_CHANNEL_DESCRIPTORS[invasion.channelId];
  if (desc && desc.supportsNpcInjection) {
    score += 0.05;
    reasons.push('channel_supports_npc_injection');
  }
  if (desc && desc.supportsNegotiation) {
    score += 0.03;
    reasons.push('channel_supports_negotiation');
  }

  // Clamp
  score = clamp01(score as unknown as Score01) as unknown as number;

  let grade: InvasionQualityGrade;
  if (score >= 0.9) grade = 'S';
  else if (score >= 0.75) grade = 'A';
  else if (score >= 0.6) grade = 'B';
  else if (score >= 0.45) grade = 'C';
  else if (score >= 0.3) grade = 'D';
  else grade = 'F';

  return Object.freeze({
    invasionId: invasion.invasionId,
    grade,
    score01: score,
    reasons: Object.freeze(reasons),
  });
}

// ============================================================================
// MARK: Invasion signal classifier
// ============================================================================

export type InvasionSignalClass =
  | 'BATTLE_TRIGGER'
  | 'ECONOMY_TRIGGER'
  | 'LIVEOPS_TRIGGER'
  | 'MULTIPLAYER_TRIGGER'
  | 'RUN_TRIGGER'
  | 'UNKNOWN';

export function classifyInvasionSignal(signal: ChatSignalEnvelope): InvasionSignalClass {
  if (signal.battle) return 'BATTLE_TRIGGER';
  if (signal.economy) return 'ECONOMY_TRIGGER';
  if (signal.liveops) return 'LIVEOPS_TRIGGER';
  if (signal.multiplayer) return 'MULTIPLAYER_TRIGGER';
  if (signal.run) return 'RUN_TRIGGER';
  return 'UNKNOWN';
}

// ============================================================================
// MARK: Invasion batch decision runner
// ============================================================================

export interface InvasionBatchDecision {
  readonly roomId: ChatRoomId;
  readonly eligible: boolean;
  readonly trace: InvasionDecisionTrace;
}

export function runInvasionBatchDecisions(
  rooms: readonly ChatRoomState[],
  signal: ChatSignalEnvelope,
  state: ChatState,
  heat: ChatAudienceHeat | null,
  now: UnixMs,
): readonly InvasionBatchDecision[] {
  return rooms.map((room) => {
    const elig = buildInvasionEligibilityMatrix(room.roomId, state, heat);
    const kind = elig.eligibleKinds[0] ?? null;
    const silPolicy = kind ? computeInvasionSilencePolicy(kind, heat) : { shouldSilence: false, silenceDurationMs: 0, reason: 'no_kind' };
    const activeInvasions = getActiveRoomInvasions(state, room.roomId);
    const hasActive = activeInvasions.some((i) => i.status === 'ACTIVE');
    const firstActive = activeInvasions.find((i) => i.status === 'ACTIVE') ?? null;
    const sevScore: InvasionSeverityScore = firstActive
      ? scoreInvasionSeverity(firstActive, heat)
      : { invasionId: 'none' as ChatInvasionId, severityScore: 0, severityBand: 'LOW', factors: [] };

    const trace = buildInvasionDecisionTrace(
      room.roomId,
      signal,
      {
        eligible: !hasActive && kind !== null,
        reasons: [],
        blockingReasons: hasActive ? ['already_active'] : [],
        derivedKind: kind,
        derivedChannelId: elig.eligibleKinds.length > 0
          ? (Object.keys(CHAT_CHANNEL_DESCRIPTORS).find((ch) => CHAT_CHANNEL_DESCRIPTORS[ch as ChatChannelId]?.supportsNpcInjection) as ChatChannelId ?? null)
          : null,
      },
      sevScore,
      silPolicy as InvasionSilencePolicy,
      false,
      null,
      now,
    );

    return Object.freeze({
      roomId: room.roomId,
      eligible: trace.eligibilityResult.eligible,
      trace,
    });
  });
}

// ============================================================================
// MARK: Invasion room comparison
// ============================================================================

export interface InvasionRoomComparison {
  readonly roomA: ChatRoomId;
  readonly roomB: ChatRoomId;
  readonly roomAHasActive: boolean;
  readonly roomBHasActive: boolean;
  readonly roomASeverity01: number;
  readonly roomBSeverity01: number;
  readonly higherSeverityRoom: ChatRoomId | null;
  readonly computedAt: UnixMs;
}

export function compareInvasionRooms(
  roomAId: ChatRoomId,
  roomBId: ChatRoomId,
  state: ChatState,
  heat: ChatAudienceHeat | null,
  now: UnixMs,
): InvasionRoomComparison {
  const aInvasions = getActiveRoomInvasions(state, roomAId);
  const bInvasions = getActiveRoomInvasions(state, roomBId);

  const aActive = aInvasions.some((i) => i.status === 'ACTIVE');
  const bActive = bInvasions.some((i) => i.status === 'ACTIVE');

  const aRunning = aInvasions.find((i) => i.status === 'ACTIVE');
  const bRunning = bInvasions.find((i) => i.status === 'ACTIVE');

  const aSev = aRunning ? (scoreInvasionSeverity(aRunning, heat).severityScore as unknown as number) : 0;
  const bSev = bRunning ? (scoreInvasionSeverity(bRunning, heat).severityScore as unknown as number) : 0;

  const higherSeverityRoom: ChatRoomId | null =
    aSev > bSev ? roomAId : bSev > aSev ? roomBId : null;

  return Object.freeze({
    roomA: roomAId,
    roomB: roomBId,
    roomAHasActive: aActive,
    roomBHasActive: bActive,
    roomASeverity01: aSev,
    roomBSeverity01: bSev,
    higherSeverityRoom,
    computedAt: now,
  });
}

// ============================================================================
// MARK: Invasion kind transition validator
// ============================================================================

/** Rules for which invasion kinds may follow each other without cooldown violation. */
export const INVASION_KIND_TRANSITION_RULES: Readonly<
  Record<ChatInvasionState['kind'], readonly ChatInvasionState['kind'][]>
> = Object.freeze({
  HATER_RAID: ['RUMOR_BURST', 'SYSTEM_SHOCK'],
  RUMOR_BURST: ['HATER_RAID', 'LIQUIDATOR_SWEEP'],
  HELPER_BLACKOUT: ['SYSTEM_SHOCK'],
  LIQUIDATOR_SWEEP: ['RUMOR_BURST', 'HATER_RAID'],
  SYSTEM_SHOCK: ['HELPER_BLACKOUT', 'LIQUIDATOR_SWEEP'],
});

export function isInvasionKindTransitionAllowed(
  fromKind: ChatInvasionState['kind'],
  toKind: ChatInvasionState['kind'],
): boolean {
  const allowed = INVASION_KIND_TRANSITION_RULES[fromKind];
  return allowed ? allowed.includes(toKind) : false;
}

// ============================================================================
// MARK: Export global invasion cooldown tracker singleton factory
// ============================================================================

export function createInvasionCooldownTracker(): InvasionCooldownTracker {
  return new InvasionCooldownTracker();
}

export function createInvasionWatchBus(): InvasionWatchBus {
  return new InvasionWatchBus();
}

// ============================================================================
// MARK: Score and identity wiring
// ============================================================================

export function toInvasionScore100(raw: number): ReturnType<typeof clamp100> {
  return clamp100(raw);
}

export function getActiveBotId(signal: ChatSignalEnvelope): BotId | null {
  return (signal.battle?.activeBotId ?? null) as BotId | null;
}

// ============================================================================
// MARK: Module authority object
// ============================================================================

export const ChatInvasionOrchestratorModule = Object.freeze({
  name: CHAT_INVASION_MODULE_NAME,
  version: CHAT_INVASION_MODULE_VERSION,
  laws: CHAT_INVASION_LAWS,
  descriptor: CHAT_INVASION_MODULE_DESCRIPTOR,
  INVASION_PERSONAS,
  INVASION_TIMING_POLICIES,
  INVASION_KIND_TRANSITION_RULES,
  ChatInvasionAuthority,
  createInvasionAuthority,
  createInvasionContext,
  createDefaultInvasionLogger,
  createDefaultInvasionClock,
  createDefaultInvasionIds,
  createDefaultInvasionRandom,
  resolveInvasionRuntime,
  planInvasionFromSignal,
  rejectInvasionPlan,
  evaluateInvasionEligibility,
  deriveInvasionKind,
  deriveInvasionChannelId,
  describeEligibility,
  createInvasionState,
  applyInvasionPlan,
  createInvasionSceneArtifacts,
  createInvasionScenePlan,
  createInvasionResponseCandidates,
  createInvasionSilence,
  shouldPlanSilence,
  resolveSilenceMs,
  invasionAnnouncement,
  invasionShadowAnnouncement,
  resolveInvasionDurationMs,
  resolveShadowPriming,
  collectClosureCandidates,
  maintainInvasions,
  computeTimeSinceLastRoomActivity,
  getRoomHeat,
  describeInvasionState,
  invasionMaintenanceReportToJson,
  invasionPlanToJson,
  createResponseCandidate,
  resolvePersonaDelayMs,
  pickRaidLine,
  pickLiquidatorLine,
  toVisibleChannel,
  deriveAttackPressureLabel,
  describeSignalEnvelope,
  InvasionWatchBus,
  createInvasionWatchBus,
  buildInvasionAnalytics,
  computeInvasionFingerprint,
  scoreInvasionSeverity,
  getInvasionTimingPolicy,
  validateInvasionChannel,
  buildInvasionRoomSnapshot,
  buildInvasionEligibilityMatrix,
  computeInvasionSilencePolicy,
  buildInvasionDecisionTrace,
  buildInvasionBatchReport,
  isInvasionCooldown,
  remainingCooldownMs,
  InvasionCooldownTracker,
  createInvasionCooldownTracker,
  buildRoomInvasionHistorySummary,
  computeInvasionPhaseReport,
  gradeInvasionQuality,
  classifyInvasionSignal,
  runInvasionBatchDecisions,
  compareInvasionRooms,
  isInvasionKindTransitionAllowed,
  clampThreshold,
  uniqueInvasionIds,
  randomBase36,
  toInvasionScore100,
  getActiveBotId,
} as const);
