/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT BOSS FIGHT ENGINE
 * FILE: backend/src/game/engine/chat/combat/ChatBossFightEngine.ts
 * VERSION: 2026.03.19
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Backend authority for conversational boss fights.
 *
 * This module promotes select hostile chat escalations into structured,
 * stateful, authoritative language combat. It sits above hater-response
 * planning and above raw counter scoring, but below transcript mutation and
 * transport fanout. It is the backend orchestrator that decides:
 *
 * - whether an incoming signal should become a boss fight at all,
 * - what fight archetype and pattern best matches the room truth,
 * - which boss persona owns the attack lane,
 * - how opening / telegraph / crowd / helper beats should be authored,
 * - when a counter window opens and which counter plan is legal,
 * - when a round escalates, breaks, expires, or resolves,
 * - and how the fight should close into a stable, explainable resolution.
 *
 * Design doctrine
 * ---------------
 * - Backend owns authority; frontend may preview but not finalize outcomes.
 * - This file consumes existing room/session/transcript/hater truth rather than
 *   replacing those systems.
 * - Every opened boss fight must be replayable from the returned ledger.
 * - Counter windows are not flavor; they are part of the fight state.
 * - Rescue is allowed, but it must stay visible in the authored record.
 * - Public witness and relationship continuity are first-class fight inputs.
 * ============================================================================
 */

import type {
  ChatBossAttack,
  ChatBossFightActor,
  ChatBossFightContext,
  ChatBossFightKind,
  ChatBossFightLedger,
  ChatBossFightPlan,
  ChatBossFightResolution,
  ChatBossFightSnapshot,
  ChatBossPatternDescriptor,
  ChatBossRound,
  ChatBossResolutionClass,
  ChatBossCounterWindowBinding,
} from '../../../../../../shared/contracts/chat/ChatBossFight';
import {
  CHAT_BOSS_PATTERNS,
  applyBossAttackToSnapshot,
  applyCounterResolutionToSnapshot,
  buildBossFightPlan,
  createBossAttack,
  createBossFightSnapshot,
  createDefaultBossPhases,
  createEmptyBossFightLedger,
  deriveBossFightBreakScore,
  deriveBossFightEscalationScore,
  deriveBossLegendChargeScore,
  deriveBossTelegraph,
  inferBossLegendClass,
  resolveBossFight,
  shouldAdvanceBossPhase,
  shouldStartBossFight,
  toScore01 as toBossScore01,
  toScore100 as toBossScore100,
} from '../../../../../../shared/contracts/chat/ChatBossFight';
import type {
  ChatCounterplayLedger,
  ChatCounterplayPlan,
  ChatCounterplayResolution,
  ChatCounterWindow,
} from '../../../../../../shared/contracts/chat/ChatCounterplay';

import type {
  AttackType,
  ChatAffectSnapshot,
  ChatAudienceHeat,
  ChatChannelId,
  ChatEventId,
  ChatLearningProfile,
  ChatMessage,
  ChatRoomId,
  ChatRoomState,
  ChatSessionId,
  ChatSessionState,
  ChatSignalEnvelope,
  ChatState,
  ChatVisibleChannel,
  JsonValue,
  Nullable,
  PressureTier,
  Score01,
  Score100,
  UnixMs,
} from '../types';
import {
  asUnixMs,
  clamp01,
  clamp100,
  isVisibleChannelId,
} from '../types';
import {
  createChatMessageFactory,
  type ChatLearningSeed,
  type ChatReplaySeed,
} from '../ChatMessageFactory';
import {
  createHaterResponseAuthority,
  HATER_PERSONAS,
  type HaterResponseAuthority,
  type HaterResponsePlan,
  type HaterTriggerContext,
} from '../HaterResponseOrchestrator';
import { ChatRelationshipService } from '../ChatRelationshipService';
import {
  ChatCounterResolver,
  createChatCounterResolver,
  type ChatCounterPlanResult,
  type ChatCounterResolveResult,
  type ChatCounterSourceContext,
} from './ChatCounterResolver';

// ============================================================================
// MARK: Public contracts
// ============================================================================

export interface ChatBossFightEngineClock {
  now(): number;
}

export interface ChatBossFightEngineLogger {
  debug(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface ChatBossFightEnginePolicy {
  readonly minimumSecondsBetweenFightsPerRoom: number;
  readonly maxRoundsPerFight: number;
  readonly helperRescueBias01: Score01;
  readonly bossThreshold01: Score01;
  readonly publicFightWitnessFloor01: Score01;
  readonly dealRoomFightWitnessFloor01: Score01;
  readonly crowdSwarmBias01: Score01;
}

export interface ChatBossFightEngineOptions {
  readonly clock?: ChatBossFightEngineClock;
  readonly logger?: ChatBossFightEngineLogger;
  readonly policy?: Partial<ChatBossFightEnginePolicy>;
  readonly counterResolver?: ChatCounterResolver;
  readonly haterAuthority?: HaterResponseAuthority;
  readonly relationshipService?: ChatRelationshipService;
}

export interface ChatBossFightOpenRequest {
  readonly state: ChatState;
  readonly roomId: ChatRoomId;
  readonly sessionId: ChatSessionId;
  readonly signal?: ChatSignalEnvelope | null;
  readonly causeEventId?: ChatEventId | null;
  readonly sourceMessage?: ChatMessage | null;
  readonly preferredChannelId?: ChatChannelId | null;
  readonly forceKind?: ChatBossFightKind | null;
  readonly notes?: readonly string[];
}

export interface ChatBossFightAdvanceRequest {
  readonly state: ChatState;
  readonly ledger: ChatBossFightLedger;
  readonly roomId: ChatRoomId;
  readonly sessionId: ChatSessionId;
  readonly playerMessage?: ChatMessage | null;
  readonly selectedCounterplayId?: string | null;
  readonly forceCloseReason?: string | null;
}

export interface ChatBossFightSweepRequest {
  readonly state: ChatState;
  readonly ledgers: readonly ChatBossFightLedger[];
  readonly now?: UnixMs;
}

export interface ChatBossFightOpenResult {
  readonly accepted: boolean;
  readonly reason: string;
  readonly ledger?: ChatBossFightLedger | null;
  readonly plan?: ChatBossFightPlan | null;
  readonly snapshot?: ChatBossFightSnapshot | null;
  readonly round?: ChatBossRound | null;
  readonly counterplay?: ChatCounterPlanResult | null;
  readonly messages: readonly ChatMessage[];
  readonly debug: Readonly<Record<string, JsonValue>>;
}

export interface ChatBossFightAdvanceResult {
  readonly accepted: boolean;
  readonly ledger: ChatBossFightLedger;
  readonly snapshot?: ChatBossFightSnapshot | null;
  readonly round?: ChatBossRound | null;
  readonly counterResolution?: ChatCounterResolveResult | null;
  readonly fightResolution?: ChatBossFightResolution | null;
  readonly messages: readonly ChatMessage[];
  readonly debug: Readonly<Record<string, JsonValue>>;
}

export interface ChatBossFightLedgerEnvelope {
  readonly ledger: ChatBossFightLedger;
  readonly roomId: ChatRoomId;
  readonly active: boolean;
  readonly lastUpdatedAt: UnixMs;
}

// ============================================================================
// MARK: Defaults
// ============================================================================

const DEFAULT_CLOCK: ChatBossFightEngineClock = Object.freeze({
  now: () => Date.now(),
});

const DEFAULT_LOGGER: ChatBossFightEngineLogger = Object.freeze({
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
});

export const DEFAULT_CHAT_BOSS_FIGHT_ENGINE_POLICY: ChatBossFightEnginePolicy = Object.freeze({
  minimumSecondsBetweenFightsPerRoom: 18,
  maxRoundsPerFight: 8,
  helperRescueBias01: clamp01(0.62),
  bossThreshold01: clamp01(0.56),
  publicFightWitnessFloor01: clamp01(0.38),
  dealRoomFightWitnessFloor01: clamp01(0.18),
  crowdSwarmBias01: clamp01(0.68),
});

// ============================================================================
// MARK: ChatBossFightEngine
// ============================================================================

export class ChatBossFightEngine {
  private readonly clock: ChatBossFightEngineClock;
  private readonly logger: ChatBossFightEngineLogger;
  private readonly policy: ChatBossFightEnginePolicy;
  private readonly counterResolver: ChatCounterResolver;
  private readonly haterAuthority: HaterResponseAuthority;
  private readonly relationshipService: ChatRelationshipService;

  public constructor(options: ChatBossFightEngineOptions = {}) {
    this.clock = options.clock ?? DEFAULT_CLOCK;
    this.logger = options.logger ?? DEFAULT_LOGGER;
    this.policy = Object.freeze({
      ...DEFAULT_CHAT_BOSS_FIGHT_ENGINE_POLICY,
      ...(options.policy ?? {}),
    });
    this.counterResolver = options.counterResolver ?? createChatCounterResolver({
      clock: { now: () => this.now() },
      logger: this.logger,
    });
    this.haterAuthority = options.haterAuthority ?? createHaterResponseAuthority();
    this.relationshipService = options.relationshipService ?? new ChatRelationshipService();
  }

  public createEmptyLedger(roomId: ChatRoomId, channelId: ChatChannelId, now?: UnixMs): ChatBossFightLedger {
    return createEmptyBossFightLedger(roomId, channelId, now ?? this.now());
  }

  public open(request: ChatBossFightOpenRequest): ChatBossFightOpenResult {
    const now = this.now();
    const room = request.state.rooms[request.roomId];
    const session = request.state.sessions[request.sessionId];

    if (!room || !session) {
      return rejectOpen('room-or-session-missing');
    }

    const sourceMessage = request.sourceMessage ?? selectLatestPlayerMessage(request.state, request.roomId, session.identity.userId);
    const haterPlan = this.planHaterEscalation(request.state, room, sourceMessage, request.signal, request.causeEventId, request.preferredChannelId, now);
    const bossContext = this.buildBossContext(request.state, room, session, request.signal, sourceMessage, haterPlan, request.notes, now);

    if (!shouldStartBossFight(bossContext as any)) {
      return rejectOpen('shared-contract-start-threshold-blocked', {
        publicExposure01: bossContext.publicExposure01,
        humiliationRisk01: bossContext.humiliationRisk01,
      });
    }

    const kind = request.forceKind ?? this.selectFightKind(room, request.signal, haterPlan, bossContext);
    const pattern = this.selectPattern(kind, room, request.signal);
    const bossActor = this.createBossActor(haterPlan, bossContext);
    const playerActor = this.createPlayerActor(session, request.state, room, bossActor.actorId);
    const supportActors = this.createSupportActors(request.state, room, session, bossContext, kind);
    const plannedAt = now;
    const startsAt = asUnixMs(Number(now) + initialStartDelayMs(pattern));

    const plan = buildBossFightPlan(
      (`fight:${room.roomId}:${plannedAt}`) as any,
      kind,
      bossActor,
      playerActor,
      bossContext,
      pattern,
      plannedAt,
      startsAt,
      supportActors,
    );

    const snapshot = createBossFightSnapshot(plan, bossContext);
    const round = this.createOpeningRound(plan, snapshot, request.signal, sourceMessage, now);
    const source = this.buildCounterSourceContext(request.state, room, session, request.signal, request.causeEventId, sourceMessage, now);
    const binding = round.counterWindow ?? this.createFallbackBinding(round, now);
    const counterplay = this.counterResolver.plan({
      fight: plan,
      round,
      binding,
      source,
      playerDraftText: null,
      forceHelperSuggestion: Boolean(bossContext.rescueDecision?.triggered),
    });

    const ledger = this.writeFightToLedger({
      ledger: this.createEmptyLedger(room.roomId, plan.channelId, now),
      plan,
      snapshot: applyBossAttackToSnapshot(snapshot, round.attack, {
        audienceHeat: bossContext.audienceHeat as any,
        publicExposure01: plan.publicExposure01,
      }),
      round: {
        ...round,
        counterWindow: {
          ...binding,
          counterplayPlan: counterplay.plan,
        },
      },
      now,
    });

    const messages = this.buildOpeningMessages({
      state: request.state,
      room,
      session,
      plan,
      round: ledger.rounds[0]!,
      snapshot: ledger.snapshot!,
      haterPlan,
      sourceMessage,
      counterplay,
      now,
      causeEventId: request.causeEventId ?? null,
    });

    this.logger.info('chat.boss.open', {
      roomId: room.roomId,
      kind,
      patternId: pattern.patternId,
      bossFightId: plan.bossFightId,
      roundId: round.roundId,
      counterWindowId: binding.windowId,
    });

    return {
      accepted: true,
      reason: 'opened',
      ledger,
      plan,
      snapshot: ledger.snapshot!,
      round: ledger.rounds[0]!,
      counterplay,
      messages,
      debug: Object.freeze({
        kind,
        patternId: pattern.patternId,
        publicExposure01: plan.publicExposure01,
        breakScore: deriveBossFightBreakScore(ledger.snapshot!),
      }),
    };
  }

  public advance(request: ChatBossFightAdvanceRequest): ChatBossFightAdvanceResult {
    const now = this.now();
    const room = request.state.rooms[request.roomId];
    const session = request.state.sessions[request.sessionId];
    const ledger = request.ledger;
    const plan = ledger.activeFight;
    const snapshot = ledger.snapshot;
    const round = ledger.rounds[ledger.rounds.length - 1] ?? null;

    if (!room || !session || !plan || !snapshot || !round) {
      return {
        accepted: false,
        ledger,
        messages: [],
        debug: Object.freeze({ reason: 'missing-room-session-or-active-fight' }),
      };
    }

    const sourceMessage = request.playerMessage ?? selectLatestPlayerMessage(request.state, request.roomId, session.identity.userId);
    const binding = round.counterWindow ?? this.createFallbackBinding(round, now);
    const source = this.buildCounterSourceContext(request.state, room, session, null, null, sourceMessage, now);
    const planForCounter = binding.counterplayPlan ?? this.counterResolver.plan({
      ledger: null,
      fight: plan,
      round,
      binding,
      source,
    }).plan;

    const counterResolution = this.counterResolver.resolve({
      ledger: this.counterResolver.createEmptyLedger(room.roomId, plan.channelId, now),
      plan: planForCounter,
      fight: plan,
      round,
      binding,
      source,
      playerMessage: request.playerMessage ?? null,
      selectedCounterplayId: request.selectedCounterplayId ?? null,
      forceCloseReason: request.forceCloseReason ?? null,
    });

    const nextSnapshot = applyCounterResolutionToSnapshot(snapshot, counterResolution.resolution, {
      audienceHeat: this.selectAudienceHeat(request.state, room) as any,
      publicExposure01: plan.publicExposure01,
    });

    const advanced = this.advanceAfterCounter({
      state: request.state,
      room,
      session,
      ledger,
      plan,
      snapshot: nextSnapshot,
      round,
      counterResolution,
      sourceMessage,
      now,
    });

    return advanced;
  }

  public sweep(request: ChatBossFightSweepRequest): readonly ChatBossFightAdvanceResult[] {
    const now = request.now ?? this.now();
    return request.ledgers
      .filter((ledger) => ledger.activeFight != null && ledger.snapshot != null)
      .flatMap((ledger) => {
        const active = ledger.activeFight!;
        const room = request.state.rooms[ledger.roomId];
        const sessionId = active.sessionId as ChatSessionId | null;
        if (!room || !sessionId) return [];
        const session = request.state.sessions[sessionId];
        if (!session) return [];
        const round = ledger.rounds[ledger.rounds.length - 1];
        if (!round || Number(round.closesAt) > Number(now)) return [];
        return [this.advance({
          state: request.state,
          ledger,
          roomId: room.roomId,
          sessionId: session.identity.sessionId,
          playerMessage: null,
          selectedCounterplayId: null,
          forceCloseReason: 'window_closed',
        })];
      });
  }

  // ========================================================================
  // MARK: Internal orchestration
  // ========================================================================

  private planHaterEscalation(
    state: ChatState,
    room: ChatRoomState,
    playerMessage: ChatMessage | null,
    signal: ChatSignalEnvelope | null | undefined,
    causeEventId: ChatEventId | null | undefined,
    preferredChannelId: ChatChannelId | null | undefined,
    now: UnixMs,
  ): HaterResponsePlan {
    const trigger: HaterTriggerContext = {
      kind: playerMessage ? 'PLAYER_MESSAGE' as any : 'SIGNAL' as any,
      state,
      room,
      now,
      causeEventId: causeEventId ?? null,
      signal: signal ?? null,
      playerMessage: playerMessage ?? null,
      preferredChannelId: preferredChannelId ?? null,
      metadata: Object.freeze({ source: 'ChatBossFightEngine' }),
    };
    return this.haterAuthority.plan(trigger);
  }

  private buildBossContext(
    state: ChatState,
    room: ChatRoomState,
    session: ChatSessionState,
    signal: ChatSignalEnvelope | null | undefined,
    sourceMessage: ChatMessage | null,
    haterPlan: HaterResponsePlan,
    notes: readonly string[] | undefined,
    now: UnixMs,
  ): ChatBossFightContext {
    const affect = selectAffect(state, session.identity.userId);
    const learning = state.learningProfiles[session.identity.userId] ?? null;
    const audienceHeat = this.selectAudienceHeat(state, room);
    const rescueDecision = deriveRescueDecision(affect, learning, signal, sourceMessage, haterPlan);
    const publicExposure01 = derivePublicExposure01(state, room, haterPlan, audienceHeat);
    const humiliationRisk01 = deriveBossHumiliationRisk01(affect, learning, haterPlan, signal, publicExposure01);
    const churnRisk01 = clamp01(Number(learning?.churnRisk01 ?? 0.16) + Number(affect?.frustration01 ?? 0.12) * 0.18);
    const comebackPotential01 = clamp01(
      Number(affect?.confidence01 ?? 0.5) * 0.44 +
      (1 - Number(affect?.intimidation01 ?? 0.2)) * 0.22 +
      (sourceMessage ? 0.10 : 0) +
      (rescueDecision.triggered ? 0.08 : 0),
    );

    return {
      roomId: room.roomId as any,
      sessionId: session.identity.sessionId as any,
      requestId: null,
      visibleChannel: room.activeVisibleChannel as any,
      channelId: (haterPlan.channelId ?? room.activeVisibleChannel) as any,
      audienceProfile: null,
      momentId: null,
      sceneId: null,
      mountKey: null,
      routeKey: null,
      worldEventId: null,
      tick: null,
      pressureTier: signal?.battle?.pressureTier as any,
      outcomeHint: signal?.run?.outcome as any,
      affect: mapAffectToBossContract(affect),
      audienceHeat: mapAudienceHeatToBossContract(audienceHeat),
      reputation: null,
      rescueDecision: rescueDecision as any,
      learningProfile: mapLearningToBossContract(learning),
      stageMood: room.stageMood as any,
      witnessDensity: estimateWitnessDensity(state, room.roomId),
      publicExposure01: toBossScore01(Number(publicExposure01)),
      humiliationRisk01: toBossScore01(Number(humiliationRisk01)),
      churnRisk01: toBossScore01(Number(churnRisk01)),
      comebackPotential01: toBossScore01(Number(comebackPotential01)),
      notes: Object.freeze([
        ...(notes ?? []),
        `roomMood=${room.stageMood}`,
        `publicExposure=${Number(publicExposure01).toFixed(3)}`,
        `humiliationRisk=${Number(humiliationRisk01).toFixed(3)}`,
      ]),
    };
  }

  private selectFightKind(
    room: ChatRoomState,
    signal: ChatSignalEnvelope | null | undefined,
    haterPlan: HaterResponsePlan,
    context: ChatBossFightContext,
  ): ChatBossFightKind {
    if (room.activeVisibleChannel === 'DEAL_ROOM' || signal?.economy?.activeDealCount) return 'DEAL_ROOM_AMBUSH';
    if (signal?.battle?.rescueWindowOpen && Number(context.humiliationRisk01) >= 0.58) return 'SHIELD_SIEGE';
    if (signal?.liveops?.helperBlackout) return 'HELPER_BLACKOUT';
    if (Number(context.publicExposure01) >= Number(this.policy.crowdSwarmBias01)) return 'CROWD_SWARM_HUNT';
    if (haterPlan.hostility?.preferredAttackType === 'SHADOW_LEAK') return 'ARCHIVIST_RECKONING';
    if (haterPlan.hostility?.preferredAttackType === 'LIQUIDATION') return 'PRESSURE_TRIAL';
    if (Number(context.publicExposure01) >= 0.5) return 'PUBLIC_HUMILIATION';
    return 'RIVAL_ASCENSION';
  }

  private selectPattern(kind: ChatBossFightKind, room: ChatRoomState, signal: ChatSignalEnvelope | null | undefined): ChatBossPatternDescriptor {
    const candidates = CHAT_BOSS_PATTERNS.filter((pattern) => pattern.fightKind === kind);
    if (candidates.length === 1) return candidates[0]!;
    const matched = candidates.find((pattern) =>
      pattern.negotiationEncounter === (room.activeVisibleChannel === 'DEAL_ROOM') ||
      pattern.publicEncounter === (room.activeVisibleChannel === 'GLOBAL' || room.activeVisibleChannel === 'LOBBY'),
    );
    return matched ?? candidates[0] ?? CHAT_BOSS_PATTERNS[0]!;
  }

  private createBossActor(plan: HaterResponsePlan, context: ChatBossFightContext): ChatBossFightActor {
    const persona = plan.personaMatch?.persona ?? HATER_PERSONAS.liquidator;
    return {
      actorId: persona.actorId,
      actorKind: 'NPC' as any,
      userId: null,
      npcId: persona.actorId as any,
      relationshipId: null,
      counterpartKind: 'HATER' as any,
      displayName: persona.displayName,
      handle: persona.displayName,
      stance: 'PREDATORY' as any,
      objective: 'PRESSURE' as any,
      toneBand: 'SEVERE' as any,
      pressureBias01: toBossScore01(plan.hostility?.finalHostility01 ?? persona.baselineBias01),
      crowdBias01: toBossScore01(plan.hostility ? Number(plan.hostility.audienceHeat01) : persona.crowdBias01),
      proofBias01: toBossScore01(plan.hostility?.preferredAttackType === 'SHADOW_LEAK' ? 0.72 : 0.44),
      quoteBias01: toBossScore01(context.publicExposure01),
      silenceBias01: toBossScore01(context.humiliationRisk01),
      rescueBias01: toBossScore01(0),
      legendBias01: toBossScore01(Math.max(Number(context.publicExposure01), 0.28)),
      notes: Object.freeze([
        `persona=${persona.personaId}`,
        `hostility=${plan.hostility?.finalHostility01 ?? 'n/a'}`,
      ]),
    };
  }

  private createPlayerActor(
    session: ChatSessionState,
    state: ChatState,
    room: ChatRoomState,
    bossActorId: string,
  ): ChatBossFightActor {
    const affect = selectAffect(state, session.identity.userId);
    const relationship = selectRelationship(state, room.roomId, session.identity.userId, bossActorId);
    return {
      actorId: session.identity.userId,
      actorKind: 'PLAYER' as any,
      userId: session.identity.userId as any,
      npcId: null,
      relationshipId: relationship?.id as any,
      counterpartKind: null,
      displayName: session.identity.displayName,
      handle: session.identity.displayName,
      stance: relationship ? mapRelationshipStance(relationship) : 'CLINICAL' as any,
      objective: relationship ? mapRelationshipObjective(relationship) : 'PRESSURE' as any,
      toneBand: 'FIRM' as any,
      pressureBias01: toBossScore01(Number(affect?.confidence01 ?? 0.52)),
      crowdBias01: toBossScore01(Number(affect?.embarrassment01 ?? 0.24)),
      proofBias01: toBossScore01(0.52),
      quoteBias01: toBossScore01(0.48),
      silenceBias01: toBossScore01(Number(affect?.frustration01 ?? 0.18)),
      rescueBias01: toBossScore01(Number(relationship?.rescueDebt01 ?? 0.04)),
      legendBias01: toBossScore01(Number(affect?.confidence01 ?? 0.52) * 0.68),
      notes: Object.freeze([
        `user=${session.identity.userId}`,
        `role=${session.identity.role}`,
      ]),
    };
  }

  private createSupportActors(
    state: ChatState,
    room: ChatRoomState,
    session: ChatSessionState,
    context: ChatBossFightContext,
    kind: ChatBossFightKind,
  ): readonly ChatBossFightActor[] {
    if (!context.rescueDecision?.triggered && kind !== 'HELPER_BLACKOUT') return [];
    const helperId = context.rescueDecision?.helperPersonaId ?? ('npc:helper:anchor' as any);
    return Object.freeze([
      {
        actorId: String(helperId),
        actorKind: 'NPC' as any,
        userId: null,
        npcId: String(helperId) as any,
        relationshipId: null,
        counterpartKind: 'HELPER' as any,
        displayName: helperDisplayName(helperId),
        handle: helperDisplayName(helperId),
        stance: 'PROTECTIVE' as any,
        objective: 'RESCUE' as any,
        toneBand: 'CALM' as any,
        pressureBias01: toBossScore01(0.12),
        crowdBias01: toBossScore01(0.08),
        proofBias01: toBossScore01(0.24),
        quoteBias01: toBossScore01(0.10),
        silenceBias01: toBossScore01(0.18),
        rescueBias01: toBossScore01(0.86),
        legendBias01: toBossScore01(0.18),
        notes: Object.freeze([
          `room=${room.roomId}`,
          `player=${session.identity.userId}`,
        ]),
      },
    ]);
  }

  private createOpeningRound(
    plan: ChatBossFightPlan,
    snapshot: ChatBossFightSnapshot,
    signal: ChatSignalEnvelope | null | undefined,
    sourceMessage: ChatMessage | null,
    now: UnixMs,
  ): ChatBossRound {
    const phase = plan.phases[0] ?? createDefaultBossPhases(plan.pattern)[0]!;
    const attack = this.selectAttackForPhase(plan, phase, signal, sourceMessage, snapshot, now);
    const windowId = (`window:${plan.bossFightId}:${phase.phaseId}:0`) as any;
    const closesAt = asUnixMs(Number(now) + deriveRoundDurationMs(attack));
    return {
      roundId: (`round:${plan.bossFightId}:${phase.phaseId}:0`) as any,
      bossFightId: plan.bossFightId,
      phaseId: phase.phaseId,
      order: 0,
      attack,
      stateAtOpen: plan.initialState,
      openedAt: now,
      closesAt,
      counterWindow: {
        windowId,
        attackId: attack.attackId,
        createdAt: now,
        expiresAt: closesAt,
        requiredDemands: attack.counterDemands,
        idealTiming: attack.preferredCounterTiming,
        primaryPunishment: attack.primaryPunishment,
        counterplayPlan: null,
        notes: Object.freeze([
          `phase=${phase.phaseKind}`,
          `attackClass=${attack.attackClass}`,
        ]),
      },
      resolvedAt: null,
      counterResolution: null,
      punishmentApplied: false,
      notes: Object.freeze([`telegraph=${attack.telegraph.label}`]),
    };
  }

  private selectAttackForPhase(
    plan: ChatBossFightPlan,
    phase: ChatBossFightPlan['phases'][number],
    signal: ChatSignalEnvelope | null | undefined,
    sourceMessage: ChatMessage | null,
    snapshot: ChatBossFightSnapshot,
    now: UnixMs,
  ): ChatBossAttack {
    const phaseAttack = phase.attacks[0];
    if (phaseAttack) return phaseAttack;

    const attackType = selectAttackType(signal, sourceMessage, plan.pattern.fightKind);
    const telegraph = deriveBossTelegraph(
      attackType as any,
      plan.pattern.openingMode,
      Number(snapshot.publicExposure01) > 0.52,
      plan.pattern.notes,
    );

    return createBossAttack(
      (`attack:${plan.bossFightId}:${phase.phaseId}:${now}`) as any,
      plan.pattern.patternId,
      `${phase.label} — ${attackType}`,
      attackType as any,
      attackClassForType(attackType),
      severityForSignal(signal),
      punishmentForAttackType(attackType),
      telegraph,
      Number(snapshot.publicExposure01) > 0.46,
      Number(snapshot.bossControlScore) > 56,
      null,
    );
  }

  private createFallbackBinding(round: ChatBossRound, now: UnixMs): ChatBossCounterWindowBinding {
    return {
      windowId: (`window:fallback:${round.roundId}`) as any,
      attackId: round.attack.attackId,
      createdAt: now,
      expiresAt: round.closesAt,
      requiredDemands: round.attack.counterDemands,
      idealTiming: round.attack.preferredCounterTiming,
      primaryPunishment: round.attack.primaryPunishment,
      counterplayPlan: null,
      notes: Object.freeze(['Fallback binding synthesized by backend boss engine.']),
    };
  }

  private buildCounterSourceContext(
    state: ChatState,
    room: ChatRoomState,
    session: ChatSessionState,
    signal: ChatSignalEnvelope | null | undefined,
    causeEventId: ChatEventId | null | undefined,
    sourceMessage: ChatMessage | null,
    now: UnixMs,
  ): ChatCounterSourceContext {
    return {
      state,
      room,
      session,
      now,
      causeEventId: causeEventId ?? null,
      signal: signal ?? null,
      sourceMessage,
      visibleChannel: room.activeVisibleChannel,
      rescue: deriveRescueDecision(selectAffect(state, session.identity.userId), state.learningProfiles[session.identity.userId] ?? null, signal, sourceMessage, null),
      notes: Object.freeze(['Counter source synthesized by ChatBossFightEngine.']),
    };
  }

  private writeFightToLedger(input: {
    ledger: ChatBossFightLedger;
    plan: ChatBossFightPlan;
    snapshot: ChatBossFightSnapshot;
    round: ChatBossRound;
    now: UnixMs;
  }): ChatBossFightLedger {
    return {
      ...input.ledger,
      activeFight: input.plan,
      snapshot: input.snapshot,
      rounds: Object.freeze([input.round, ...input.ledger.rounds]),
      lastUpdatedAt: input.now,
    };
  }

  private buildOpeningMessages(input: {
    state: ChatState;
    room: ChatRoomState;
    session: ChatSessionState;
    plan: ChatBossFightPlan;
    round: ChatBossRound;
    snapshot: ChatBossFightSnapshot;
    haterPlan: HaterResponsePlan;
    sourceMessage: ChatMessage | null;
    counterplay: ChatCounterPlanResult;
    now: UnixMs;
    causeEventId: ChatEventId | null;
  }): readonly ChatMessage[] {
    const factory = createChatMessageFactory();
    const roomId = input.room.roomId;
    const channelId = input.plan.channelId;
    const replay = this.replaySeed(input.plan, input.round, null);
    const learning = this.learningSeed(input.state, input.session.identity.userId, input.snapshot);
    const persona = input.haterPlan.personaMatch?.persona ?? HATER_PERSONAS.liquidator;

    const systemMessage = factory.createSystemMessage({
      state: input.state,
      roomId,
      channelId,
      now: input.now,
      causeEventId: input.causeEventId,
      text: `${input.plan.boss.displayName} enters a pressure window. Witnesses lock in.`,
      sourceType: 'SYSTEM',
      actorId: 'system:bossfight',
      displayName: 'SYSTEM',
      replay,
      learning,
      tags: ['bossfight', 'opening', input.plan.kind],
    });

    const haterMessage = factory.createHaterEscalationMessage({
      state: input.state,
      roomId,
      channelId,
      now: asUnixMs(Number(input.now) + Math.max(350, input.round.attack.telegraph.revealDelayMs)),
      causeEventId: input.causeEventId,
      persona,
      role: 'HATER',
      text: materializeBossOpeningLine(input.plan, input.round, input.sourceMessage),
      escalationTier: 'BOSS',
      attackWindowOpen: true,
      replay,
      learning,
      tags: ['bossfight', 'hater', input.round.attack.attackClass],
      quotingMessageId: input.sourceMessage?.id ?? null,
      quotingText: input.sourceMessage?.plainText ? input.sourceMessage.plainText.slice(0, 140) : null,
    });

    const shadowMessage = factory.createShadowAnnotation({
      state: input.state,
      roomId,
      channelId: 'RIVALRY_SHADOW' as ChatChannelId,
      now: asUnixMs(Number(input.now) + 25),
      text: `Boss fight primed. Pattern=${input.plan.pattern.patternId}. Window=${input.counterplay.window.windowId}.`,
      actorId: input.plan.boss.actorId,
      displayName: input.plan.boss.displayName,
      shadowTag: 'RIVALRY',
      replay,
      learning,
      tags: ['bossfight', 'shadow'],
      causeEventId: input.causeEventId,
    });

    const helperMessage = input.counterplay.helperSuggested && input.plan.supportActors[0]
      ? factory.createHelperInterventionMessage({
          state: input.state,
          roomId,
          channelId,
          now: asUnixMs(Number(input.now) + Math.max(800, input.round.attack.telegraph.revealDelayMs + 200)),
          causeEventId: input.causeEventId,
          persona: helperPersonaFromActor(input.plan.supportActors[0]),
          role: 'HELPER',
          text: materializeHelperOpeningLine(input.round, input.counterplay.bestCandidate ?? null),
          rescueReason: 'boss-fight-open',
          recoveryWindowSuggested: true,
          replay,
          learning,
          tags: ['bossfight', 'helper', 'rescue-window'],
        })
      : null;

    return Object.freeze([
      systemMessage,
      haterMessage,
      shadowMessage,
      ...(helperMessage ? [helperMessage] : []),
    ]);
  }

  private advanceAfterCounter(input: {
    state: ChatState;
    room: ChatRoomState;
    session: ChatSessionState;
    ledger: ChatBossFightLedger;
    plan: ChatBossFightPlan;
    snapshot: ChatBossFightSnapshot;
    round: ChatBossRound;
    counterResolution: ChatCounterResolveResult;
    sourceMessage: ChatMessage | null;
    now: UnixMs;
  }): ChatBossFightAdvanceResult {
    const resolvedRound: ChatBossRound = {
      ...input.round,
      resolvedAt: input.now,
      counterResolution: input.counterResolution.resolution,
      punishmentApplied: !input.counterResolution.resolution.succeeded,
      notes: Object.freeze([
        ...input.round.notes,
        `resolution=${input.counterResolution.resolution.efficacyBand}`,
      ]),
    };

    const shouldResolveFightNow =
      input.counterResolution.resolution.legendQualified ||
      Number(deriveBossFightBreakScore(input.snapshot)) >= 0.82 ||
      Number(deriveBossFightEscalationScore(input.snapshot)) >= 0.88 ||
      input.ledger.rounds.length >= this.policy.maxRoundsPerFight;

    if (shouldResolveFightNow) {
      const fightResolution = resolveBossFight(
        input.plan,
        input.snapshot,
        [resolvedRound],
        input.now,
        null,
      );
      const nextLedger = {
        ...input.ledger,
        activeFight: null,
        snapshot: null,
        rounds: Object.freeze([resolvedRound, ...input.ledger.rounds.slice(1)]),
        archivedResolutionIds: Object.freeze([fightResolution.resolutionId, ...input.ledger.archivedResolutionIds]),
        lastUpdatedAt: input.now,
      };

      const messages = this.buildResolutionMessages({
        state: input.state,
        room: input.room,
        session: input.session,
        plan: input.plan,
        snapshot: input.snapshot,
        round: resolvedRound,
        resolution: fightResolution,
        counterResolution: input.counterResolution,
        sourceMessage: input.sourceMessage,
        now: input.now,
      });

      return {
        accepted: true,
        ledger: nextLedger,
        snapshot: null,
        round: resolvedRound,
        counterResolution: input.counterResolution,
        fightResolution,
        messages,
        debug: Object.freeze({
          resolveNow: true,
          bossBreakScore: deriveBossFightBreakScore(input.snapshot),
          legendChargeScore: deriveBossLegendChargeScore(input.snapshot),
        }),
      };
    }

    const nextRound = this.openNextRound(input.plan, input.snapshot, resolvedRound, input.state, input.room, input.session, input.now);
    const nextSnapshot = applyBossAttackToSnapshot(input.snapshot, nextRound.attack, {
      audienceHeat: this.selectAudienceHeat(input.state, input.room) as any,
      publicExposure01: input.plan.publicExposure01,
    });

    const nextLedger = {
      ...input.ledger,
      activeFight: input.plan,
      snapshot: nextSnapshot,
      rounds: Object.freeze([nextRound, resolvedRound, ...input.ledger.rounds.slice(1)]),
      lastUpdatedAt: input.now,
    };

    const messages = this.buildTransitionMessages({
      state: input.state,
      room: input.room,
      session: input.session,
      plan: input.plan,
      previousRound: resolvedRound,
      nextRound,
      snapshot: nextSnapshot,
      counterResolution: input.counterResolution,
      now: input.now,
    });

    return {
      accepted: true,
      ledger: nextLedger,
      snapshot: nextSnapshot,
      round: nextRound,
      counterResolution: input.counterResolution,
      fightResolution: null,
      messages,
      debug: Object.freeze({
        resolveNow: false,
        nextRoundId: nextRound.roundId,
        nextAttackClass: nextRound.attack.attackClass,
      }),
    };
  }

  private openNextRound(
    plan: ChatBossFightPlan,
    snapshot: ChatBossFightSnapshot,
    previousRound: ChatBossRound,
    state: ChatState,
    room: ChatRoomState,
    session: ChatSessionState,
    now: UnixMs,
  ): ChatBossRound {
    const currentPhaseIndex = Math.max(0, plan.phases.findIndex((phase) => phase.phaseId === previousRound.phaseId));
    const currentPhase = plan.phases[currentPhaseIndex] ?? plan.phases[0]!;
    const shouldAdvance = shouldAdvanceBossPhase(currentPhase as any, snapshot);
    const nextPhase = shouldAdvance ? plan.phases[currentPhaseIndex + 1] ?? currentPhase : currentPhase;
    const attack = this.selectAttackForPhase(plan, nextPhase, null, null, snapshot, now);
    const closesAt = asUnixMs(Number(now) + deriveRoundDurationMs(attack));
    return {
      roundId: (`round:${plan.bossFightId}:${nextPhase.phaseId}:${previousRound.order + 1}`) as any,
      bossFightId: plan.bossFightId,
      phaseId: nextPhase.phaseId,
      order: previousRound.order + 1,
      attack,
      stateAtOpen: snapshot.state,
      openedAt: now,
      closesAt,
      counterWindow: {
        windowId: (`window:${plan.bossFightId}:${nextPhase.phaseId}:${previousRound.order + 1}`) as any,
        attackId: attack.attackId,
        createdAt: now,
        expiresAt: closesAt,
        requiredDemands: attack.counterDemands,
        idealTiming: attack.preferredCounterTiming,
        primaryPunishment: attack.primaryPunishment,
        counterplayPlan: null,
        notes: Object.freeze([
          shouldAdvance ? 'phase-advanced' : 'phase-held',
          `phase=${nextPhase.phaseKind}`,
        ]),
      },
      resolvedAt: null,
      counterResolution: null,
      punishmentApplied: false,
      notes: Object.freeze([
        `bossControl=${snapshot.bossControlScore}`,
      ]),
    };
  }

  private buildTransitionMessages(input: {
    state: ChatState;
    room: ChatRoomState;
    session: ChatSessionState;
    plan: ChatBossFightPlan;
    previousRound: ChatBossRound;
    nextRound: ChatBossRound;
    snapshot: ChatBossFightSnapshot;
    counterResolution: ChatCounterResolveResult;
    now: UnixMs;
  }): readonly ChatMessage[] {
    const factory = createChatMessageFactory();
    const replay = this.replaySeed(input.plan, input.nextRound, null);
    const learning = this.learningSeed(input.state, input.session.identity.userId, input.snapshot);
    const persona = bossPersonaForPlan(input.plan);

    const systemMessage = factory.createSystemMessage({
      state: input.state,
      roomId: input.room.roomId,
      channelId: input.plan.channelId,
      now: input.now,
      text: `Round ${input.previousRound.order + 1} closed. ${input.nextRound.attack.label} is already forming.`,
      sourceType: 'SYSTEM',
      actorId: 'system:bossfight',
      displayName: 'SYSTEM',
      replay,
      learning,
      tags: ['bossfight', 'round-transition'],
    });

    const haterMessage = factory.createHaterEscalationMessage({
      state: input.state,
      roomId: input.room.roomId,
      channelId: input.plan.channelId,
      now: asUnixMs(Number(input.now) + 250),
      persona,
      role: 'HATER',
      text: materializeEscalationLine(input.nextRound.attack, input.counterResolution.resolution),
      escalationTier: 'BOSS',
      attackWindowOpen: true,
      replay,
      learning,
      tags: ['bossfight', 'escalation', input.nextRound.attack.attackClass],
    });

    return Object.freeze([systemMessage, haterMessage]);
  }

  private buildResolutionMessages(input: {
    state: ChatState;
    room: ChatRoomState;
    session: ChatSessionState;
    plan: ChatBossFightPlan;
    snapshot: ChatBossFightSnapshot;
    round: ChatBossRound;
    resolution: ChatBossFightResolution;
    counterResolution: ChatCounterResolveResult;
    sourceMessage: ChatMessage | null;
    now: UnixMs;
  }): readonly ChatMessage[] {
    const factory = createChatMessageFactory();
    const replay = this.replaySeed(input.plan, input.round, input.resolution.replayId ?? null);
    const learning = this.learningSeed(input.state, input.session.identity.userId, input.snapshot);
    const persona = bossPersonaForPlan(input.plan);

    const systemMessage = factory.createSystemMessage({
      state: input.state,
      roomId: input.room.roomId,
      channelId: input.plan.channelId,
      now: input.now,
      text: materializeResolutionSystemLine(input.resolution),
      sourceType: 'SYSTEM',
      actorId: 'system:bossfight',
      displayName: 'SYSTEM',
      replay,
      learning,
      tags: ['bossfight', 'resolution', input.resolution.resolutionClass],
    });

    const bossMessage = factory.createHaterEscalationMessage({
      state: input.state,
      roomId: input.room.roomId,
      channelId: input.plan.channelId,
      now: asUnixMs(Number(input.now) + 220),
      persona,
      role: 'HATER',
      text: materializeBossResolutionLine(input.resolution, input.counterResolution.resolution),
      escalationTier: input.resolution.playerWon ? 'SOFT' : 'BOSS',
      attackWindowOpen: false,
      replay,
      learning,
      tags: ['bossfight', 'boss-resolution'],
      quotingMessageId: input.sourceMessage?.id ?? null,
      quotingText: input.sourceMessage?.plainText ? input.sourceMessage.plainText.slice(0, 120) : null,
    });

    const maybeLegend = input.resolution.legendHint
      ? factory.createLegendMomentMessage({
          state: input.state,
          roomId: input.room.roomId,
          channelId: input.plan.channelId,
          now: asUnixMs(Number(input.now) + 420),
          text: materializeLegendLine(input.resolution),
          legendId: (`legend:${input.plan.bossFightId}`) as any,
          sceneId: input.plan.sceneId ?? null,
          momentId: input.plan.momentId ?? null,
          replay,
          learning,
          tags: ['bossfight', 'legend'],
        })
      : null;

    return Object.freeze([
      systemMessage,
      bossMessage,
      ...(maybeLegend ? [maybeLegend] : []),
    ]);
  }

  private selectAudienceHeat(state: ChatState, room: ChatRoomState): ChatAudienceHeat | null {
    return state.audienceHeatByRoom[room.roomId] ?? null;
  }

  private replaySeed(plan: ChatBossFightPlan, round: ChatBossRound, replayId: string | null): ChatReplaySeed {
    return {
      replayId: replayId as any,
      replayAnchorKey: `boss:${plan.bossFightId}:round:${round.roundId}`,
      sceneId: plan.sceneId ?? null,
      momentId: plan.momentId ?? null,
      legendId: null,
    };
  }

  private learningSeed(state: ChatState, userId: string, snapshot: ChatBossFightSnapshot): ChatLearningSeed {
    const affect = state.learningProfiles[userId]?.affect ?? null;
    return {
      learningTriggered: true,
      affectAfterMessage: affect,
      inferenceSource: 'HEURISTIC',
      inferenceId: null,
    };
  }

  private now(): UnixMs {
    return asUnixMs(this.clock.now());
  }
}

export function createChatBossFightEngine(options: ChatBossFightEngineOptions = {}): ChatBossFightEngine {
  return new ChatBossFightEngine(options);
}

// ============================================================================
// MARK: Helper functions
// ============================================================================

function rejectOpen(reason: string, debug: Readonly<Record<string, JsonValue>> = Object.freeze({})): ChatBossFightOpenResult {
  return {
    accepted: false,
    reason,
    messages: [],
    debug,
  };
}

function selectLatestPlayerMessage(state: ChatState, roomId: ChatRoomId, userId: string): ChatMessage | null {
  const entries = state.transcript.byRoom[roomId] ?? [];
  for (const entry of entries) {
    if (entry.message.attribution.authorUserId === userId) return entry.message;
  }
  return null;
}

function selectAffect(state: ChatState, userId: string): ChatAffectSnapshot | null {
  return state.learningProfiles[userId]?.affect ?? null;
}

function selectRelationship(state: ChatState, roomId: ChatRoomId, userId: string, actorId: string) {
  return (Object.values(state.relationships) as any[]).find((relationship) =>
    relationship.roomId === roomId && relationship.userId === userId && relationship.actorId === actorId,
  ) ?? null;
}

function deriveRescueDecision(
  affect: ChatAffectSnapshot | null,
  learning: ChatLearningProfile | null,
  signal: ChatSignalEnvelope | null | undefined,
  sourceMessage: ChatMessage | null,
  haterPlan: HaterResponsePlan | null,
) {
  const urgencyScore =
    Number(learning?.churnRisk01 ?? 0.16) * 0.34 +
    Number(affect?.frustration01 ?? 0.12) * 0.22 +
    Number(affect?.embarrassment01 ?? 0.12) * 0.16 +
    Number(signal?.battle?.hostileMomentum ?? 40) / 100 * 0.12 +
    (haterPlan?.hostility?.escalationBand === 'EXECUTION' ? 0.10 : 0);
  const urgency =
    urgencyScore >= 0.82 ? 'CRITICAL' :
    urgencyScore >= 0.64 ? 'HARD' :
    urgencyScore >= 0.46 ? 'MEDIUM' :
    urgencyScore >= 0.24 ? 'SOFT' : 'NONE';
  return {
    triggered: urgency !== 'NONE',
    urgency,
    reason: urgency === 'NONE' ? 'no rescue needed' : 'player stability trending down under hostile pressure',
    helperPersonaId: urgency === 'CRITICAL' || urgency === 'HARD' ? ('npc:helper:anchor' as any) : ('npc:helper:mercy' as any),
    shouldOpenRecoveryWindow: urgency === 'CRITICAL' || urgency === 'HARD',
  };
}

function derivePublicExposure01(
  state: ChatState,
  room: ChatRoomState,
  haterPlan: HaterResponsePlan,
  audienceHeat: ChatAudienceHeat | null,
): Score01 {
  const occupants = estimateWitnessDensity(state, room.roomId);
  const crowdBonus = room.activeVisibleChannel === 'GLOBAL' || room.activeVisibleChannel === 'LOBBY' ? 0.18 : room.activeVisibleChannel === 'DEAL_ROOM' ? 0.06 : 0.03;
  const heat = Number(audienceHeat?.heat01 ?? 0.12) * 0.24;
  const haterPublicBias = Number(haterPlan.personaMatch?.persona.crowdBias01 ?? 0.4) * 0.18;
  return clamp01(occupants * 0.40 + crowdBonus + heat + haterPublicBias);
}

function deriveBossHumiliationRisk01(
  affect: ChatAffectSnapshot | null,
  learning: ChatLearningProfile | null,
  haterPlan: HaterResponsePlan,
  signal: ChatSignalEnvelope | null | undefined,
  publicExposure01: Score01,
): Score01 {
  return clamp01(
    Number(publicExposure01) * 0.34 +
    Number(affect?.embarrassment01 ?? 0.18) * 0.20 +
    Number(affect?.intimidation01 ?? 0.16) * 0.14 +
    Number(learning?.haterSusceptibility01 ?? 0.22) * 0.12 +
    Number(haterPlan.hostility?.finalHostility01 ?? 0.42) * 0.12 +
    Number(signal?.battle?.hostileMomentum ?? 50) / 100 * 0.08,
  );
}

function estimateWitnessDensity(state: ChatState, roomId: ChatRoomId): number {
  const occupants = state.roomSessions.byRoom[roomId] ?? [];
  return Math.max(0, Math.min(1, occupants.length / 10));
}

function mapAffectToBossContract(affect: ChatAffectSnapshot | null): any {
  if (!affect) return null;
  return {
    confidence01: affect.confidence01,
    frustration01: affect.frustration01,
    intimidation01: affect.intimidation01,
    attachment01: affect.attachment01,
    curiosity01: affect.curiosity01,
    embarrassment01: affect.embarrassment01,
    relief01: affect.relief01,
  };
}

function mapAudienceHeatToBossContract(heat: ChatAudienceHeat | null): any {
  if (!heat) return null;
  return {
    heatScore: toBossScore100(Number(heat.heat01) * 100),
    audienceBias: heat.swarmDirection,
    witnessDensity01: heat.heat01,
  };
}

function mapLearningToBossContract(learning: ChatLearningProfile | null): any {
  if (!learning) return null;
  return {
    userId: learning.userId,
    createdAt: learning.createdAt,
    updatedAt: learning.updatedAt,
    coldStart: learning.coldStart,
    helperReceptivity01: learning.helperReceptivity01,
    haterSusceptibility01: learning.haterSusceptibility01,
    negotiationAggression01: learning.negotiationAggression01,
    churnRisk01: learning.churnRisk01,
  };
}

function mapRelationshipStance(relationship: any): any {
  if (Number(relationship.rivalry01 ?? 0) >= 0.72) return 'HUNTING';
  if (Number(relationship.trust01 ?? 0) >= 0.62) return 'PROTECTIVE';
  if (Number(relationship.fear01 ?? 0) >= 0.54) return 'WOUNDED';
  if (Number(relationship.contempt01 ?? 0) >= 0.56) return 'PREDATORY';
  return 'CLINICAL';
}

function mapRelationshipObjective(relationship: any): any {
  if (Number(relationship.rescueDebt01 ?? 0) >= 0.55) return 'RESCUE';
  if (Number(relationship.contempt01 ?? 0) >= 0.56) return 'HUMILIATE';
  if (Number(relationship.fear01 ?? 0) >= 0.52) return 'CONTAIN';
  return 'PRESSURE';
}

function helperDisplayName(helperId: unknown): string {
  const id = String(helperId);
  if (id.includes('anchor')) return 'Kade Anchor';
  if (id.includes('mercy')) return 'Mercy Vale';
  return 'Syndicate Helper';
}

function helperPersonaFromActor(actor: ChatBossFightActor): any {
  return {
    personaId: (`persona:${actor.actorId}`) as any,
    actorId: actor.actorId,
    role: 'HELPER',
    displayName: actor.displayName,
    botId: null,
    voiceprint: {
      punctuationStyle: 'HARD',
      avgSentenceLength: 9,
      delayFloorMs: 350,
      delayCeilingMs: 900,
      opener: 'Breathe.',
      closer: 'Take the clean line.',
      lexicon: ['clean', 'line', 'steady', 'window'],
    },
    preferredChannels: ['SYNDICATE', 'GLOBAL', 'RESCUE_SHADOW'],
    tags: ['helper', 'bossfight', 'rescue'],
  };
}

function initialStartDelayMs(pattern: ChatBossPatternDescriptor): number {
  switch (pattern.openingMode) {
    case 'IMMEDIATE':
      return 0;
    case 'STAGGERED':
      return 420;
    case 'CROWD_PRIMED':
      return 650;
    case 'NEGOTIATION_READ_DELAYED':
      return 800;
    case 'SILENCE_LURE':
      return 950;
    default:
      return 300;
  }
}

function deriveRoundDurationMs(attack: ChatBossAttack): number {
  const base =
    attack.severity === 'EXECUTION' ? 3_800 :
    attack.severity === 'CRITICAL' ? 4_600 :
    attack.severity === 'HEAVY' ? 5_400 : 6_000;
  return attack.timeboxedMs != null ? Math.min(base, Number(attack.timeboxedMs)) : base;
}

function selectAttackType(
  signal: ChatSignalEnvelope | null | undefined,
  sourceMessage: ChatMessage | null,
  kind: ChatBossFightKind,
): AttackType {
  if (kind === 'DEAL_ROOM_AMBUSH') return 'LIQUIDATION';
  if (kind === 'ARCHIVIST_RECKONING') return 'SHADOW_LEAK';
  if (signal?.battle?.activeAttackType) return signal.battle.activeAttackType;
  if (sourceMessage?.plainText.toLowerCase().includes('prove')) return 'COMPLIANCE';
  if (sourceMessage?.plainText.toLowerCase().includes('everyone')) return 'CROWD_SWARM';
  return 'TAUNT';
}

function attackClassForType(attackType: AttackType): any {
  switch (attackType) {
    case 'LIQUIDATION':
      return 'DEAL_ROOM_SQUEEZE';
    case 'COMPLIANCE':
      return 'PROOF_CHALLENGE';
    case 'CROWD_SWARM':
      return 'CROWD_SIGNAL';
    case 'SHADOW_LEAK':
      return 'QUOTE_TRAP';
    case 'SABOTAGE':
      return 'CASCADE_TRIGGER';
    case 'TAUNT':
    default:
      return 'PUBLIC_SHAME';
  }
}

function severityForSignal(signal: ChatSignalEnvelope | null | undefined): any {
  const momentum = Number(signal?.battle?.hostileMomentum ?? 50);
  if (momentum >= 86) return 'EXECUTION';
  if (momentum >= 68) return 'CRITICAL';
  if (momentum >= 46) return 'HEAVY';
  return 'PROBING';
}

function punishmentForAttackType(attackType: AttackType): any {
  switch (attackType) {
    case 'LIQUIDATION':
      return 'DEAL_REPRICE';
    case 'COMPLIANCE':
      return 'REPUTATION_HIT';
    case 'CROWD_SWARM':
      return 'CROWD_SWARM';
    case 'SHADOW_LEAK':
      return 'EMBARRASSMENT_SPIKE';
    case 'SABOTAGE':
      return 'PRESSURE_SPIKE';
    case 'TAUNT':
    default:
      return 'EMBARRASSMENT_SPIKE';
  }
}

function materializeBossOpeningLine(
  plan: ChatBossFightPlan,
  round: ChatBossRound,
  sourceMessage: ChatMessage | null,
): string {
  const quote = sourceMessage?.plainText ? ` "${sourceMessage.plainText.slice(0, 96)}"` : '';
  switch (plan.kind) {
    case 'PUBLIC_HUMILIATION':
      return `Everyone heard you.${quote} Good. Public memory is live now.`;
    case 'DEAL_ROOM_AMBUSH':
      return `Terms changed.${quote} Your urgency is being priced in real time.`;
    case 'HELPER_BLACKOUT':
      return `No one is stepping in to soften this. You answer alone.`;
    case 'SHIELD_SIEGE':
      return `Your shield is already thin. I only need the room to notice.`;
    default:
      return `${round.attack.telegraph.label} The room is watching how you answer.`;
  }
}

function materializeHelperOpeningLine(round: ChatBossRound, candidate: any): string {
  if (candidate?.move?.recommendedReplyText) return `Use this line or shorten it. ${candidate.move.recommendedReplyText}`;
  if (round.attack.attackClass === 'DEAL_ROOM_SQUEEZE') return 'Do not defend everything. Reprice or exit.';
  return 'One clean answer. Do not fight the entire room at once.';
}

function materializeEscalationLine(attack: ChatBossAttack, counterResolution: ChatCounterplayResolution): string {
  if (!counterResolution.resolution.succeeded && attack.attackClass === 'PUBLIC_SHAME') return 'You felt that land, and so did everyone else.';
  if (attack.attackClass === 'DEAL_ROOM_SQUEEZE') return 'You survived the first term. The next one is worse.';
  return `${attack.telegraph.label} The window shifts. The pressure does not.`;
}

function materializeResolutionSystemLine(resolution: ChatBossFightResolution): string {
  switch (resolution.resolutionClass) {
    case 'PLAYER_DOMINATES':
      return 'Boss fight closed. Player authority restored.';
    case 'PLAYER_STABILIZES':
      return 'Boss fight closed. Player stabilized the room.';
    case 'RESCUE_EXTRACTION':
      return 'Boss fight closed by extraction.';
    case 'BOSS_EXECUTION':
      return 'Boss fight closed. Hostile side secured the room.';
    default:
      return `Boss fight closed with ${resolution.resolutionClass.toLowerCase().replace(/_/g, ' ')}.`;
  }
}

function materializeBossResolutionLine(
  resolution: ChatBossFightResolution,
  counterResolution: ChatCounterplayResolution,
): string {
  if (resolution.playerWon && resolution.legendHint) return 'That one will be replayed later. You earned witnesses.';
  if (resolution.playerWon) return 'You held. Not cleanly maybe, but enough.';
  if (resolution.rescued) return 'You leave because someone pulled you out, not because you won.';
  if (!counterResolution.succeeded) return 'You missed your window. The room noticed.';
  return 'This ends here, but not between us.';
}

function materializeLegendLine(resolution: ChatBossFightResolution): string {
  return `Legend moment: ${resolution.legendHint?.legendClass ?? 'PUBLIC_REVERSAL'}.`;
}

function bossPersonaForPlan(plan: ChatBossFightPlan): any {
  const id = plan.boss.actorId.toLowerCase();
  if (id.includes('bureaucrat')) return HATER_PERSONAS.bureaucrat;
  if (id.includes('manipulator')) return HATER_PERSONAS.manipulator;
  return HATER_PERSONAS.liquidator;
}

// ============================================================================
// MARK: End
// ============================================================================
