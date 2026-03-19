/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT SHADOW DEFERRED REACTION PLANNER
 * FILE: backend/src/game/engine/chat/shadow/DeferredReactionPlanner.ts
 * VERSION: 2026.03.19
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 */

import * as ShadowContract from '../../../../../../shared/contracts/chat/ChatShadowState';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type ChatRoomId = string;
export type UnixMs = number;

export interface DeferredReactionPlannerClock { now(): number; }
export interface DeferredReactionPlannerLogger {
  debug(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface DeferredReactionPlannerOptions {
  readonly clock?: DeferredReactionPlannerClock;
  readonly logger?: DeferredReactionPlannerLogger;
  readonly revealDelayMs?: number;
  readonly rescueDelayMs?: number;
  readonly rivalryDelayMs?: number;
  readonly crowdDelayMs?: number;
  readonly witnessDelayMs?: number;
  readonly liveOpsDelayMs?: number;
}

export type DeferredReactionScenario =
  | 'PLAYER_COLLAPSE'
  | 'PLAYER_COMEBACK'
  | 'SHIELD_BREAK'
  | 'PRESSURE_SPIKE'
  | 'HELPER_WITHHELD'
  | 'RESCUE_WINDOW'
  | 'RIVALRY_ESCALATION'
  | 'LIVEOPS_SURGE'
  | 'NEGOTIATION_TRAP'
  | 'BOSS_FIGHT_OPEN'
  | 'PROOF_CONFIRMED'
  | 'BLUFF_EXPOSED';

export interface DeferredReactionContext {
  readonly roomId: ChatRoomId;
  readonly runId?: string;
  readonly sceneId?: string;
  readonly momentId?: string;
  readonly eventId?: string;
  readonly now?: UnixMs;
  readonly sourceKind?: ShadowContract.ChatShadowSourceKind;
  readonly sourceId?: string;
  readonly actorId?: string;
  readonly visibleChannelId?: string;
}

export interface DeferredReactionPlan {
  readonly roomId: ChatRoomId;
  readonly scenario: DeferredReactionScenario;
  readonly delta: ShadowContract.ChatShadowDelta;
  readonly hiddenThreatScore: number;
  readonly revealableCount: number;
  readonly callbackSeeded: boolean;
  readonly rescueSeeded: boolean;
}

const DEFAULT_OPTIONS: Required<DeferredReactionPlannerOptions> = Object.freeze({
  clock: { now: () => Date.now() },
  logger: { debug: () => undefined, info: () => undefined, warn: () => undefined },
  revealDelayMs: 1_200,
  rescueDelayMs: 900,
  rivalryDelayMs: 1_600,
  crowdDelayMs: 1_400,
  witnessDelayMs: 1_100,
  liveOpsDelayMs: 1_750,
});

function nowMs(clock: DeferredReactionPlannerClock): UnixMs { return clock.now() as UnixMs; }
function asUnixMs(value: number): UnixMs { return value as UnixMs; }
function iso(ms: UnixMs): string { return new Date(Number(ms)).toISOString(); }
function clamp(value: number, min = 0, max = 100): number { return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min)); }

export class DeferredReactionPlanner {
  private readonly options: Required<DeferredReactionPlannerOptions>;
  constructor(options: DeferredReactionPlannerOptions = {}) { this.options = { ...DEFAULT_OPTIONS, ...options }; }
  private get clock(): DeferredReactionPlannerClock { return this.options.clock; }
  private stamp(context?: DeferredReactionContext): UnixMs { return (context?.now ?? nowMs(this.clock)) as UnixMs; }

  private makePressure(context: DeferredReactionContext, lane: ShadowContract.ChatShadowLane, purpose: ShadowContract.ChatShadowPurpose, pressureKind: ShadowContract.ChatShadowPressureKind, pressure: Partial<ShadowContract.ChatShadowPressureVector>): ShadowContract.ChatShadowPressureAnchor {
    return ShadowContract.createShadowPressureAnchor({
      roomId: context.roomId,
      runId: context.runId,
      sceneId: context.sceneId,
      momentId: context.momentId,
      lane,
      purpose,
      pressureKind,
      pressure,
      sourceKind: context.sourceKind ?? 'SYSTEM',
      sourceId: context.sourceId ?? 'deferred-reaction-planner',
      actorId: context.actorId,
      priority: ShadowContract.inferShadowPriorityFromLane(lane),
      visibility: ShadowContract.inferShadowVisibilityFromLane(lane),
      eventId: context.eventId,
      notes: [],
    });
  }

  private makeSuppressed(context: DeferredReactionContext, lane: ShadowContract.ChatShadowLane, reason: ShadowContract.ChatShadowSuppressionReason, body: string, readyAt: UnixMs, revealAt: UnixMs): ShadowContract.ChatShadowSuppressedReply {
    return ShadowContract.createShadowSuppressedReply({
      roomId: context.roomId,
      runId: context.runId,
      sceneId: context.sceneId,
      momentId: context.momentId,
      lane,
      purpose: ShadowContract.inferShadowPurposeFromLane(lane),
      channelId: context.visibleChannelId,
      sourceKind: context.sourceKind ?? 'SYSTEM',
      sourceId: context.sourceId ?? 'deferred-reaction-planner',
      actorId: context.actorId,
      body,
      reason,
      priority: ShadowContract.inferShadowPriorityFromLane(lane),
      readyAt,
      revealAt,
      eventId: context.eventId,
      notes: [],
    });
  }

  private makeReveal(context: DeferredReactionContext, lane: ShadowContract.ChatShadowLane, sourceAtomKind: ShadowContract.ChatShadowRevealQueueItem['sourceAtomKind'], sourceAtomId: string, trigger: ShadowContract.ChatShadowRevealTrigger, deliverAt: UnixMs): ShadowContract.ChatShadowRevealQueueItem {
    return ShadowContract.createShadowRevealQueueItem({
      roomId: context.roomId,
      runId: context.runId,
      sceneId: context.sceneId,
      momentId: context.momentId,
      lane,
      purpose: ShadowContract.inferShadowPurposeFromLane(lane),
      sourceKind: context.sourceKind ?? 'SYSTEM',
      sourceId: context.sourceId ?? 'deferred-reaction-planner',
      actorId: context.actorId,
      sourceAtomKind,
      sourceAtomId,
      trigger,
      status: 'PENDING',
      priority: ShadowContract.inferShadowPriorityFromLane(lane),
      channelId: context.visibleChannelId,
      deliverAt,
      armAt: asUnixMs(Number(deliverAt) - 700),
      readyAt: asUnixMs(Number(deliverAt) - 150),
      eventId: context.eventId,
      notes: [],
    });
  }

  private makeMarker(context: DeferredReactionContext, lane: ShadowContract.ChatShadowLane, kind: ShadowContract.ChatShadowMarkerKind, payload?: Readonly<Record<string, JsonValue>>): ShadowContract.ChatShadowMemoryMarker {
    return ShadowContract.createShadowMemoryMarker({
      roomId: context.roomId,
      runId: context.runId,
      sceneId: context.sceneId,
      momentId: context.momentId,
      lane,
      purpose: ShadowContract.inferShadowPurposeFromLane(lane),
      sourceKind: context.sourceKind ?? 'SYSTEM',
      sourceId: context.sourceId ?? 'deferred-reaction-planner',
      actorId: context.actorId,
      kind,
      payload,
      priority: ShadowContract.inferShadowPriorityFromLane(lane),
      visibility: ShadowContract.inferShadowVisibilityFromLane(lane),
      eventId: context.eventId,
      notes: [],
    });
  }

  plan(scenario: DeferredReactionScenario, context: DeferredReactionContext): DeferredReactionPlan {
    const now = this.stamp(context);
    const anchors: ShadowContract.ChatShadowPressureAnchor[] = [];
    const suppressedReplies: ShadowContract.ChatShadowSuppressedReply[] = [];
    const revealQueue: ShadowContract.ChatShadowRevealQueueItem[] = [];
    const memoryMarkers: ShadowContract.ChatShadowMemoryMarker[] = [];

    if (scenario === 'PLAYER_COLLAPSE') {
      const anchor = this.makePressure(context, 'RESCUE_SHADOW', 'RESCUE_PRESSURE', 'RESCUE_PULL', { rescuePull: 82, panic: 64, hostility: 12 });
      anchors.push(anchor);
      const suppressed = this.makeSuppressed(context, 'RESCUE_SHADOW', 'WAIT_FOR_RESCUE', 'Hold. One clean exit is still possible.', asUnixMs(Number(now) + 500), asUnixMs(Number(now) + this.options.rescueDelayMs));
      suppressedReplies.push(suppressed);
      revealQueue.push(this.makeReveal(context, 'RESCUE_SHADOW', 'SUPPRESSED_REPLY', suppressed.id, 'PLAYER_COLLAPSE', asUnixMs(Number(now) + this.options.rescueDelayMs)));
      memoryMarkers.push(this.makeMarker(context, 'RESCUE_SHADOW', 'CALLBACK_ANCHOR', { scenario }));
    }

    if (scenario === 'PLAYER_COMEBACK') {
      const anchor = this.makePressure(context, 'WITNESS_SHADOW', 'DELAYED_WITNESS', 'WITNESS', { witness: 76, crowdHeat: 42, rivalry: 28 });
      anchors.push(anchor);
      const suppressed = this.makeSuppressed(context, 'WITNESS_SHADOW', 'WAIT_FOR_WITNESS', 'They saw that. Wait for the room to turn.', asUnixMs(Number(now) + 400), asUnixMs(Number(now) + this.options.witnessDelayMs));
      suppressedReplies.push(suppressed);
      revealQueue.push(this.makeReveal(context, 'WITNESS_SHADOW', 'SUPPRESSED_REPLY', suppressed.id, 'PLAYER_COMEBACK', asUnixMs(Number(now) + this.options.witnessDelayMs)));
      memoryMarkers.push(this.makeMarker(context, 'WITNESS_SHADOW', 'CALLBACK_ANCHOR', { scenario }));
    }

    if (scenario === 'RIVALRY_ESCALATION' || scenario === 'SHIELD_BREAK' || scenario === 'PRESSURE_SPIKE') {
      const anchor = this.makePressure(context, 'RIVALRY_SHADOW', 'RIVALRY_ESCALATION', 'RIVALRY', { hostility: 58, intimidation: 49, rivalry: 74, ridicule: 41 });
      anchors.push(anchor);
      const suppressed = this.makeSuppressed(context, 'RIVALRY_SHADOW', 'WAIT_FOR_BETTER_MOMENT', 'Not yet. Let them feel it first.', asUnixMs(Number(now) + 600), asUnixMs(Number(now) + this.options.rivalryDelayMs));
      suppressedReplies.push(suppressed);
      revealQueue.push(this.makeReveal(context, 'RIVALRY_SHADOW', 'SUPPRESSED_REPLY', suppressed.id, scenario === 'SHIELD_BREAK' ? 'EVENT' : 'PRESSURE_THRESHOLD', asUnixMs(Number(now) + this.options.rivalryDelayMs)));
      memoryMarkers.push(this.makeMarker(context, 'RIVALRY_SHADOW', 'CALLBACK_ANCHOR', { scenario }));
    }

    if (scenario === 'LIVEOPS_SURGE') {
      const anchor = this.makePressure(context, 'LIVEOPS_SHADOW', 'LIVEOPS_STAGING', 'LIVEOPS', { liveOps: 81, crowdHeat: 54, panic: 26 });
      anchors.push(anchor);
      memoryMarkers.push(this.makeMarker(context, 'LIVEOPS_SHADOW', 'LIVEOPS_BEAT', { scenario }));
    }

    if (scenario === 'NEGOTIATION_TRAP' || scenario === 'BLUFF_EXPOSED') {
      const anchor = this.makePressure(context, 'NEGOTIATION_SHADOW', 'NEGOTIATION_TRAP', 'NEGOTIATION', { negotiation: 78, hostility: 18, intimidation: 21 });
      anchors.push(anchor);
      const suppressed = this.makeSuppressed(context, 'NEGOTIATION_SHADOW', 'NEGOTIATION_POSITIONING', 'Do not leak the counter yet.', asUnixMs(Number(now) + 650), asUnixMs(Number(now) + this.options.revealDelayMs));
      suppressedReplies.push(suppressed);
      revealQueue.push(this.makeReveal(context, 'NEGOTIATION_SHADOW', 'SUPPRESSED_REPLY', suppressed.id, scenario === 'BLUFF_EXPOSED' ? 'BLUFF_EXPOSED' : 'NEGOTIATION_RESPONSE', asUnixMs(Number(now) + this.options.revealDelayMs)));
      memoryMarkers.push(this.makeMarker(context, 'NEGOTIATION_SHADOW', 'CALLBACK_ANCHOR', { scenario }));
    }

    if (scenario === 'BOSS_FIGHT_OPEN' || scenario === 'PROOF_CONFIRMED') {
      const lane = scenario === 'BOSS_FIGHT_OPEN' ? 'SYSTEM_SHADOW' : 'MEMORY_SHADOW';
      const purpose = scenario === 'BOSS_FIGHT_OPEN' ? 'SCENE_CONTINUITY' : 'PROOF_HOLD';
      const kind = scenario === 'BOSS_FIGHT_OPEN' ? 'LATENT_HOSTILITY' : 'DELAYED_WITNESS';
      anchors.push(this.makePressure(context, lane, purpose, kind === 'LATENT_HOSTILITY' ? 'HOSTILITY' : 'WITNESS', { hostility: 44, witness: 48, crowdHeat: 20 }));
      memoryMarkers.push(this.makeMarker(context, lane, scenario === 'PROOF_CONFIRMED' ? 'PROOF_LINK' : 'WITNESS_SEED', { scenario }));
    }

    const delta: ShadowContract.ChatShadowDelta = {
      roomId: context.roomId,
      addAtoms: [...anchors, ...suppressedReplies, ...revealQueue, ...memoryMarkers],
    };

    const fakeSnapshot = ShadowContract.foldShadowDelta(ShadowContract.createEmptyShadowRoomSnapshot({ roomId: context.roomId }), delta);
    return {
      roomId: context.roomId,
      scenario,
      delta,
      hiddenThreatScore: ShadowContract.countHiddenThreatAnchors(fakeSnapshot),
      revealableCount: ShadowContract.countRevealableSuppressedReplies(fakeSnapshot),
      callbackSeeded: ShadowContract.countCallbackAnchors(fakeSnapshot) > 0,
      rescueSeeded: ShadowContract.hasShadowRescuePressure(fakeSnapshot),
    };
  }
}

export function createDeferredReactionPlanner(options: DeferredReactionPlannerOptions = {}): DeferredReactionPlanner {
  return new DeferredReactionPlanner(options);
}

export const ChatDeferredReactionPlannerModule = Object.freeze({ createDeferredReactionPlanner, DeferredReactionPlanner });

export function deferredReactionPlannerHeuristic_1(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 1 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 1 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 1 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 1 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 1 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 1 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 1 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 1 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 1 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 1 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 1 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 1 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_2(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 2 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 2 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 2 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 2 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 2 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 2 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 2 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 2 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 2 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 2 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 2 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 2 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_3(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 3 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 3 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 3 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 3 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 3 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 3 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 3 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 3 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 3 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 3 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 3 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 3 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_4(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 4 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 4 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 4 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 4 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 4 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 4 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 4 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 4 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 4 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 4 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 4 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 4 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_5(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 5 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 5 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 5 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 5 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 5 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 5 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 5 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 5 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 5 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 5 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 5 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 5 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_6(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 6 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 6 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 6 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 6 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 6 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 6 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 6 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 6 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 6 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 6 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 6 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 6 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_7(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 7 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 7 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 7 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 7 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 7 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 7 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 7 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 7 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 7 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 7 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 7 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 7 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_8(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 8 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 8 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 8 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 8 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 8 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 8 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 8 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 8 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 8 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 8 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 8 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 8 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_9(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 9 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 9 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 9 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 9 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 9 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 9 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 9 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 9 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 9 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 9 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 9 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 9 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_10(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 10 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 10 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 10 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 10 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 10 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 10 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 10 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 10 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 10 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 10 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 10 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 10 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_11(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 11 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 11 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 11 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 11 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 11 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 11 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 11 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 11 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 11 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 11 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 11 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 11 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_12(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 12 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 12 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 12 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 12 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 12 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 12 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 12 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 12 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 12 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 12 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 12 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 12 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_13(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 13 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 13 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 13 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 13 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 13 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 13 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 13 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 13 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 13 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 13 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 13 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 13 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_14(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 14 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 14 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 14 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 14 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 14 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 14 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 14 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 14 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 14 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 14 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 14 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 14 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_15(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 15 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 15 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 15 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 15 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 15 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 15 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 15 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 15 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 15 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 15 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 15 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 15 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_16(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 16 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 16 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 16 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 16 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 16 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 16 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 16 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 16 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 16 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 16 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 16 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 16 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_17(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 17 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 17 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 17 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 17 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 17 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 17 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 17 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 17 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 17 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 17 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 17 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 17 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_18(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 18 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 18 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 18 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 18 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 18 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 18 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 18 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 18 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 18 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 18 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 18 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 18 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_19(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 19 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 19 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 19 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 19 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 19 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 19 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 19 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 19 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 19 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 19 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 19 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 19 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_20(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 20 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 20 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 20 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 20 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 20 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 20 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 20 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 20 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 20 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 20 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 20 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 20 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_21(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 21 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 21 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 21 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 21 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 21 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 21 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 21 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 21 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 21 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 21 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 21 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 21 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_22(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 22 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 22 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 22 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 22 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 22 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 22 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 22 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 22 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 22 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 22 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 22 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 22 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_23(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 23 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 23 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 23 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 23 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 23 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 23 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 23 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 23 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 23 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 23 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 23 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 23 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_24(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 24 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 24 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 24 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 24 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 24 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 24 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 24 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 24 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 24 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 24 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 24 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 24 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_25(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 25 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 25 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 25 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 25 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 25 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 25 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 25 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 25 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 25 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 25 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 25 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 25 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_26(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 26 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 26 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 26 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 26 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 26 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 26 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 26 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 26 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 26 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 26 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 26 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 26 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_27(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 27 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 27 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 27 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 27 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 27 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 27 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 27 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 27 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 27 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 27 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 27 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 27 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_28(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 28 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 28 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 28 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 28 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 28 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 28 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 28 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 28 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 28 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 28 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 28 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 28 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_29(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 29 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 29 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 29 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 29 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 29 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 29 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 29 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 29 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 29 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 29 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 29 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 29 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_30(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 30 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 30 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 30 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 30 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 30 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 30 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 30 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 30 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 30 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 30 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 30 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 30 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_31(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 31 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 31 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 31 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 31 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 31 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 31 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 31 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 31 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 31 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 31 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 31 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 31 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_32(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 32 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 32 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 32 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 32 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 32 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 32 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 32 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 32 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 32 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 32 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 32 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 32 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_33(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 33 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 33 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 33 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 33 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 33 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 33 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 33 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 33 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 33 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 33 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 33 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 33 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_34(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 34 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 34 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 34 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 34 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 34 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 34 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 34 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 34 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 34 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 34 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 34 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 34 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_35(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 35 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 35 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 35 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 35 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 35 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 35 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 35 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 35 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 35 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 35 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 35 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 35 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_36(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 36 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 36 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 36 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 36 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 36 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 36 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 36 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 36 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 36 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 36 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 36 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 36 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_37(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 37 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 37 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 37 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 37 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 37 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 37 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 37 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 37 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 37 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 37 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 37 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 37 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_38(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 38 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 38 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 38 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 38 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 38 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 38 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 38 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 38 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 38 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 38 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 38 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 38 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_39(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 39 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 39 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 39 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 39 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 39 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 39 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 39 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 39 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 39 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 39 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 39 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 39 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_40(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 40 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 40 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 40 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 40 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 40 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 40 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 40 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 40 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 40 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 40 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 40 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 40 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_41(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 41 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 41 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 41 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 41 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 41 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 41 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 41 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 41 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 41 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 41 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 41 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 41 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_42(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 42 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 42 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 42 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 42 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 42 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 42 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 42 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 42 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 42 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 42 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 42 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 42 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_43(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 43 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 43 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 43 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 43 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 43 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 43 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 43 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 43 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 43 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 43 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 43 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 43 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_44(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 44 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 44 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 44 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 44 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 44 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 44 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 44 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 44 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 44 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 44 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 44 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 44 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_45(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 45 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 45 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 45 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 45 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 45 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 45 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 45 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 45 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 45 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 45 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 45 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 45 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_46(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 46 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 46 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 46 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 46 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 46 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 46 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 46 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 46 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 46 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 46 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 46 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 46 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_47(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 47 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 47 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 47 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 47 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 47 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 47 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 47 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 47 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 47 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 47 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 47 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 47 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_48(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 48 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 48 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 48 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 48 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 48 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 48 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 48 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 48 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 48 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 48 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 48 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 48 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_49(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 49 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 49 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 49 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 49 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 49 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 49 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 49 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 49 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 49 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 49 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 49 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 49 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_50(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 50 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 50 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 50 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 50 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 50 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 50 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 50 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 50 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 50 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 50 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 50 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 50 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_51(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 51 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 51 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 51 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 51 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 51 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 51 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 51 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 51 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 51 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 51 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 51 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 51 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_52(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 52 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 52 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 52 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 52 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 52 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 52 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 52 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 52 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 52 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 52 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 52 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 52 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_53(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 53 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 53 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 53 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 53 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 53 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 53 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 53 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 53 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 53 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 53 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 53 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 53 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_54(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 54 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 54 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 54 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 54 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 54 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 54 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 54 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 54 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 54 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 54 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 54 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 54 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_55(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 55 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 55 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 55 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 55 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 55 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 55 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 55 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 55 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 55 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 55 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 55 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 55 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_56(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 56 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 56 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 56 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 56 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 56 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 56 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 56 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 56 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 56 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 56 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 56 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 56 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_57(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 57 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 57 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 57 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 57 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 57 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 57 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 57 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 57 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 57 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 57 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 57 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 57 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_58(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 58 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 58 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 58 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 58 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 58 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 58 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 58 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 58 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 58 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 58 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 58 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 58 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_59(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 59 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 59 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 59 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 59 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 59 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 59 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 59 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 59 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 59 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 59 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 59 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 59 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_60(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 60 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 60 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 60 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 60 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 60 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 60 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 60 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 60 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 60 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 60 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 60 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 60 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_61(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 61 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 61 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 61 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 61 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 61 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 61 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 61 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 61 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 61 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 61 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 61 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 61 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_62(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 62 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 62 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 62 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 62 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 62 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 62 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 62 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 62 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 62 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 62 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 62 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 62 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_63(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 63 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 63 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 63 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 63 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 63 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 63 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 63 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 63 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 63 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 63 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 63 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 63 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_64(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 64 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 64 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 64 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 64 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 64 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 64 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 64 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 64 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 64 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 64 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 64 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 64 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_65(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 65 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 65 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 65 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 65 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 65 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 65 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 65 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 65 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 65 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 65 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 65 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 65 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_66(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 66 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 66 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 66 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 66 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 66 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 66 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 66 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 66 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 66 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 66 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 66 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 66 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_67(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 67 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 67 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 67 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 67 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 67 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 67 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 67 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 67 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 67 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 67 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 67 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 67 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_68(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 68 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 68 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 68 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 68 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 68 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 68 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 68 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 68 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 68 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 68 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 68 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 68 * 0.01, 0, 100);
  }
}

export function deferredReactionPlannerHeuristic_69(scenario: DeferredReactionScenario): number {
  switch (scenario) {
    case 'PLAYER_COLLAPSE': return clamp(80 + 69 * 0.01, 0, 100);
    case 'PLAYER_COMEBACK': return clamp(76 + 69 * 0.01, 0, 100);
    case 'SHIELD_BREAK': return clamp(71 + 69 * 0.01, 0, 100);
    case 'PRESSURE_SPIKE': return clamp(68 + 69 * 0.01, 0, 100);
    case 'HELPER_WITHHELD': return clamp(63 + 69 * 0.01, 0, 100);
    case 'RESCUE_WINDOW': return clamp(78 + 69 * 0.01, 0, 100);
    case 'RIVALRY_ESCALATION': return clamp(74 + 69 * 0.01, 0, 100);
    case 'LIVEOPS_SURGE': return clamp(66 + 69 * 0.01, 0, 100);
    case 'NEGOTIATION_TRAP': return clamp(72 + 69 * 0.01, 0, 100);
    case 'BOSS_FIGHT_OPEN': return clamp(70 + 69 * 0.01, 0, 100);
    case 'PROOF_CONFIRMED': return clamp(64 + 69 * 0.01, 0, 100);
    case 'BLUFF_EXPOSED': return clamp(73 + 69 * 0.01, 0, 100);
  }
}
