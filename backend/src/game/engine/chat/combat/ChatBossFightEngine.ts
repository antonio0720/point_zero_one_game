/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT BOSS FIGHT ENGINE
 * FILE: backend/src/game/engine/chat/combat/ChatBossFightEngine.ts
 * VERSION: 2026.03.20
 * AUTHORSHIP: Antonio T. Smith Jr.
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
  createBossFightSnapshot,
  createDefaultBossPhases,
  createEmptyBossFightLedger,
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
// MARK: Internal contracts
// ============================================================================

type RescueUrgency = 'NONE' | 'SOFT' | 'MEDIUM' | 'HARD' | 'CRITICAL';

interface DerivedRescueEnvelope {
  readonly decision: ChatCounterSourceContext['rescue'];
  readonly triggered: boolean;
  readonly urgency: RescueUrgency;
  readonly reason: string;
  readonly helperPersonaId: string | null;
  readonly shouldOpenRecoveryWindow: boolean;
}

interface BossFightOpenDecision {
  readonly accepted: boolean;
  readonly reason: string;
  readonly debug: Readonly<Record<string, JsonValue>>;
}

interface LocalCounterWindowEnvelope {
  readonly binding: ChatBossCounterWindowBinding;
  readonly plannedWindow: Nullable<ChatCounterWindow>;
  readonly counterplayPlan: Nullable<ChatCounterplayPlan>;
}

interface LocalRoundResolutionView {
  readonly succeeded: boolean;
  readonly legendQualified: boolean;
  readonly efficacyBand: string;
  readonly resolution: ChatCounterplayResolution;
}

const RESOLUTION_CLASS_WEIGHT: Readonly<Record<ChatBossResolutionClass, number>> = Object.freeze({
  PLAYER_DOMINATES: 100,
  PLAYER_STABILIZES: 82,
  MUTUAL_STANDOFF: 63,
  BOSS_ADVANTAGE: 38,
  BOSS_EXECUTION: 18,
  RESCUE_EXTRACTION: 54,
  SYSTEM_ABORT: 8,
});

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

  public createEmptyLedger(
    roomId: ChatRoomId,
    channelId: ChatChannelId,
    now?: UnixMs,
  ): ChatBossFightLedger {
    return createEmptyBossFightLedger(roomId, channelId, now ?? this.now());
  }

  public open(request: ChatBossFightOpenRequest): ChatBossFightOpenResult {
    const now = this.now();
    const room = request.state.rooms[request.roomId];
    const session = request.state.sessions[request.sessionId];

    if (!room || !session) {
      return rejectOpen('room-or-session-missing');
    }

    const sourceMessage = request.sourceMessage
      ?? selectLatestPlayerMessage(request.state, request.roomId, session.identity.userId);

    const haterPlan = this.planHaterEscalation(
      request.state,
      room,
      sourceMessage,
      request.signal,
      request.causeEventId,
      request.preferredChannelId,
      now,
    );

    const rescueEnvelope = deriveRescueEnvelope(
      selectAffect(request.state, session.identity.userId),
      request.state.learningProfiles[session.identity.userId] ?? null,
      request.signal,
      sourceMessage,
      haterPlan,
    );

    const bossContext = this.buildBossContext(
      request.state,
      room,
      session,
      request.signal,
      sourceMessage,
      haterPlan,
      rescueEnvelope,
      request.notes,
      now,
    );

    const openDecision = this.shouldOpenBossFight(
      request.state,
      room,
      request.signal,
      haterPlan,
      bossContext,
    );

    if (!openDecision.accepted) {
      return rejectOpen(openDecision.reason, openDecision.debug);
    }

    const kind = request.forceKind ?? this.selectFightKind(room, request.signal, haterPlan, bossContext);
    const pattern = this.selectPattern(kind, room, request.signal);
    const bossActor = this.createBossActor(haterPlan, bossContext);
    const playerActor = this.createPlayerActor(session, request.state, room, bossActor.actorId);
    const supportActors = this.createSupportActors(
      request.state,
      room,
      session,
      bossContext,
      rescueEnvelope,
      kind,
    );

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

    const source = this.buildCounterSourceContext(
      request.state,
      room,
      session,
      request.signal,
      request.causeEventId,
      sourceMessage,
      rescueEnvelope,
      now,
    );

    const binding = round.counterWindow ?? this.createFallbackBinding(round, now);

    const counterplay = this.counterResolver.plan({
      fight: plan,
      round,
      binding,
      source,
      playerDraftText: null,
      forceHelperSuggestion: rescueEnvelope.shouldOpenRecoveryWindow,
    });

    const plannedWindow: Nullable<ChatCounterWindow> = counterplay.window ?? null;

    const nextSnapshot = applyBossAttackToSnapshot(
      snapshot,
      round.attack,
      {
        publicExposure01: plan.publicExposure01,
        comebackPotential01: bossContext.comebackPotential01,
      } as any,
    );

    const ledger = this.writeFightToLedger({
      ledger: this.createEmptyLedger(room.roomId, plan.channelId, now),
      plan,
      snapshot: nextSnapshot,
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
      plannedWindow,
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
        breakScore: computeBreakScore(ledger.snapshot!),
        rescueUrgency: rescueEnvelope.urgency,
        relationshipServiceReady: Boolean(this.relationshipService),
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

    const sourceMessage = request.playerMessage
      ?? selectLatestPlayerMessage(request.state, request.roomId, session.identity.userId);

    const rescueEnvelope = deriveRescueEnvelope(
      selectAffect(request.state, session.identity.userId),
      request.state.learningProfiles[session.identity.userId] ?? null,
      null,
      sourceMessage,
      null,
    );

    const binding = round.counterWindow ?? this.createFallbackBinding(round, now);

    const source = this.buildCounterSourceContext(
      request.state,
      room,
      session,
      null,
      null,
      sourceMessage,
      rescueEnvelope,
      now,
    );

    const planForCounter: ChatCounterplayPlan = binding.counterplayPlan
      ?? this.counterResolver.plan({
        ledger: null,
        fight: plan,
        round,
        binding,
        source,
      }).plan;

    const counterLedger: ChatCounterplayLedger = this.counterResolver.createEmptyLedger(
      room.roomId,
      plan.channelId,
      now,
    );

    const counterResolution = this.counterResolver.resolve({
      ledger: counterLedger,
      plan: planForCounter,
      fight: plan,
      round,
      binding,
      source,
      playerMessage: request.playerMessage ?? null,
      selectedCounterplayId: request.selectedCounterplayId ?? null,
      forceCloseReason: request.forceCloseReason ?? null,
    });

    const nextSnapshot = applyCounterResolutionToSnapshot(
      snapshot,
      counterResolution.resolution,
      {
        publicExposure01: plan.publicExposure01,
        comebackPotential01: toBossScore01(Number(snapshot.playerStabilityScore) / 100),
      } as any,
    );

    return this.advanceAfterCounter({
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
  }

  public sweep(
    request: ChatBossFightSweepRequest,
  ): readonly ChatBossFightAdvanceResult[] {
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

        return [
          this.advance({
            state: request.state,
            ledger,
            roomId: room.roomId,
            sessionId: session.identity.sessionId,
            playerMessage: null,
            selectedCounterplayId: null,
            forceCloseReason: 'window_closed',
          }),
        ];
      });
  }

  // ========================================================================
  // MARK: Internal orchestration
  // ========================================================================

  private planHaterEscalation(
    state: ChatState,
    room: ChatRoomState,
    playerMessage: Nullable<ChatMessage>,
    signal: Nullable<ChatSignalEnvelope> | undefined,
    causeEventId: Nullable<ChatEventId> | undefined,
    preferredChannelId: Nullable<ChatChannelId> | undefined,
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
    signal: Nullable<ChatSignalEnvelope> | undefined,
    sourceMessage: Nullable<ChatMessage>,
    haterPlan: HaterResponsePlan,
    rescueEnvelope: DerivedRescueEnvelope,
    notes: readonly string[] | undefined,
    now: UnixMs,
  ): ChatBossFightContext {
    const affect = selectAffect(state, session.identity.userId);
    const learning = state.learningProfiles[session.identity.userId] ?? null;
    const audienceHeat = this.selectAudienceHeat(state, room);
    const publicExposure01 = derivePublicExposure01(state, room, haterPlan, audienceHeat);
    const humiliationRisk01 = deriveBossHumiliationRisk01(
      affect,
      learning,
      haterPlan,
      signal,
      publicExposure01,
    );

    const churnRisk01 = clamp01(
      Number(learning?.churnRisk01 ?? 0.16)
      + Number(affect?.frustration01 ?? 0.12) * 0.18,
    );

    const comebackPotential01 = clamp01(
      Number(affect?.confidence01 ?? 0.5) * 0.44
      + (1 - Number(affect?.intimidation01 ?? 0.2)) * 0.22
      + (sourceMessage ? 0.10 : 0)
      + (rescueEnvelope.triggered ? 0.08 : 0),
    );

    const visibleChannel = resolveVisibleChannel(
      room.activeVisibleChannel,
      room.activeVisibleChannel,
    );

    return {
      roomId: room.roomId as any,
      sessionId: session.identity.sessionId as any,
      requestId: null,
      visibleChannel: visibleChannel as any,
      channelId: (haterPlan.channelId ?? room.activeVisibleChannel) as any,
      audienceProfile: null,
      momentId: null,
      sceneId: null,
      mountKey: null,
      routeKey: null,
      worldEventId: null,
      tick: null,
      pressureTier: normalizePressureTierValue(signal?.battle?.pressureTier) as any,
      outcomeHint: signal?.run?.outcome as any,
      affect: mapAffectToBossContract(affect),
      audienceHeat: mapAudienceHeatToBossContract(audienceHeat),
      reputation: null,
      rescueDecision: rescueEnvelope.decision as any,
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
        `openedAt=${now}`,
      ]),
    };
  }

  private shouldOpenBossFight(
    state: ChatState,
    room: ChatRoomState,
    signal: Nullable<ChatSignalEnvelope> | undefined,
    haterPlan: HaterResponsePlan,
    context: ChatBossFightContext,
  ): BossFightOpenDecision {
    const visibleChannel = resolveVisibleChannel(room.activeVisibleChannel, room.activeVisibleChannel);
    const publicFloor = visibleChannel === 'DEAL_ROOM'
      ? Number(this.policy.dealRoomFightWitnessFloor01)
      : Number(this.policy.publicFightWitnessFloor01);

    const hostility = Number(haterPlan.hostility?.finalHostility01 ?? 0.42);
    const momentum = Number(signal?.battle?.hostileMomentum ?? 50) / 100;
    const crowd = Number(context.publicExposure01);
    const humiliation = Number(context.humiliationRisk01);

    const score = clamp01(
      hostility * 0.34 +
      momentum * 0.18 +
      crowd * 0.24 +
      humiliation * 0.18 +
      Number(visibleChannel === 'GLOBAL' || visibleChannel === 'LOBBY') * 0.04,
    );

    if (crowd < publicFloor && visibleChannel !== 'DEAL_ROOM') {
      return {
        accepted: false,
        reason: 'insufficient-public-witness',
        debug: Object.freeze({
          visibleChannel,
          requiredFloor: publicFloor,
          publicExposure01: context.publicExposure01,
        }),
      };
    }

    if (score < Number(this.policy.bossThreshold01)) {
      return {
        accepted: false,
        reason: 'boss-threshold-not-met',
        debug: Object.freeze({
          score,
          bossThreshold01: this.policy.bossThreshold01,
          hostility01: hostility,
          publicExposure01: context.publicExposure01,
          humiliationRisk01: context.humiliationRisk01,
        }),
      };
    }

    const roomEnvelope: Nullable<ChatBossFightLedgerEnvelope> = null;
    void roomEnvelope;
    void state;

    return {
      accepted: true,
      reason: 'threshold-met',
      debug: Object.freeze({
        score,
        bossThreshold01: this.policy.bossThreshold01,
      }),
    };
  }

  private selectFightKind(
    room: ChatRoomState,
    signal: Nullable<ChatSignalEnvelope> | undefined,
    haterPlan: HaterResponsePlan,
    context: ChatBossFightContext,
  ): ChatBossFightKind {
    if (room.activeVisibleChannel === 'DEAL_ROOM' || signal?.economy?.activeDealCount) {
      return 'DEAL_ROOM_AMBUSH';
    }
    if (signal?.battle?.rescueWindowOpen && Number(context.humiliationRisk01) >= 0.58) {
      return 'SHIELD_SIEGE';
    }
    if (signal?.liveops?.helperBlackout) {
      return 'HELPER_BLACKOUT';
    }
    if (Number(context.publicExposure01) >= Number(this.policy.crowdSwarmBias01)) {
      return 'CROWD_SWARM_HUNT';
    }
    if (haterPlan.hostility?.preferredAttackType === 'SHADOW_LEAK') {
      return 'ARCHIVIST_RECKONING';
    }
    if (haterPlan.hostility?.preferredAttackType === 'LIQUIDATION') {
      return 'PRESSURE_TRIAL';
    }
    if (Number(context.publicExposure01) >= 0.5) {
      return 'PUBLIC_HUMILIATION';
    }
    return 'RIVAL_ASCENSION';
  }

  private selectPattern(
    kind: ChatBossFightKind,
    room: ChatRoomState,
    signal: Nullable<ChatSignalEnvelope> | undefined,
  ): ChatBossPatternDescriptor {
    const visibleChannel: ChatVisibleChannel = resolveVisibleChannel(
      room.activeVisibleChannel,
      room.activeVisibleChannel,
    );

    const candidates = CHAT_BOSS_PATTERNS
      .filter((pattern) => pattern.fightKind === kind)
      .map((pattern) => sanitizePattern(pattern));

    if (candidates.length === 1) {
      return candidates[0]!;
    }

    const matched = candidates.find((pattern) => {
      if (visibleChannel === 'DEAL_ROOM') {
        return Boolean((pattern as any).negotiationEncounter);
      }
      if (visibleChannel === 'GLOBAL' || visibleChannel === 'LOBBY') {
        return Boolean((pattern as any).publicEncounter);
      }
      return false;
    });

    if (matched) return matched;
    if (signal?.battle?.rescueWindowOpen) {
      return candidates.find((pattern) => String((pattern as any).patternId).toLowerCase().includes('rescue'))
        ?? candidates[0]
        ?? sanitizePattern(CHAT_BOSS_PATTERNS[0]!);
    }

    return candidates[0] ?? sanitizePattern(CHAT_BOSS_PATTERNS[0]!);
  }

  private createBossActor(
    plan: HaterResponsePlan,
    context: ChatBossFightContext,
  ): ChatBossFightActor {
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
    const relationshipServiceReady = Boolean(this.relationshipService);

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
        `relationshipServiceReady=${relationshipServiceReady}`,
      ]),
    };
  }

  private createSupportActors(
    state: ChatState,
    room: ChatRoomState,
    session: ChatSessionState,
    context: ChatBossFightContext,
    rescueEnvelope: DerivedRescueEnvelope,
    kind: ChatBossFightKind,
  ): readonly ChatBossFightActor[] {
    if (!rescueEnvelope.triggered && kind !== 'HELPER_BLACKOUT') {
      return [];
    }

    const helperId = rescueEnvelope.helperPersonaId ?? 'npc:helper:anchor';

    void state;
    void context;

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
          `urgency=${rescueEnvelope.urgency}`,
        ]),
      },
    ]);
  }

  private createOpeningRound(
    plan: ChatBossFightPlan,
    snapshot: ChatBossFightSnapshot,
    signal: Nullable<ChatSignalEnvelope> | undefined,
    sourceMessage: Nullable<ChatMessage>,
    now: UnixMs,
  ): ChatBossRound {
    const fallbackPhases = createDefaultBossPhases(plan.pattern);
    const phase = plan.phases[0] ?? fallbackPhases[0]!;
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
          `phase=${(phase as any).phaseKind ?? 'UNKNOWN'}`,
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
    signal: Nullable<ChatSignalEnvelope> | undefined,
    sourceMessage: Nullable<ChatMessage>,
    snapshot: ChatBossFightSnapshot,
    now: UnixMs,
  ): ChatBossAttack {
    const phaseAttack = phase.attacks?.[0];
    if (phaseAttack) {
      return phaseAttack;
    }

    const attackType = selectAttackType(signal, sourceMessage, plan.kind);
    const telegraph = buildTelegraphForAttack(
      attackType,
      plan.pattern.openingMode,
      Number(snapshot.publicExposure01) > 0.52,
      now,
    );

    return buildBossAttackLocally({
      fightId: plan.bossFightId,
      phaseId: phase.phaseId,
      phaseLabel: phase.label,
      patternId: plan.pattern.patternId,
      attackType,
      attackClass: attackClassForType(attackType),
      severity: severityForSignal(signal),
      primaryPunishment: punishmentForAttackType(attackType),
      telegraph,
      publicExposure01: Number(snapshot.publicExposure01),
      bossControlScore: Number(snapshot.bossControlScore ?? 56),
      createdAt: now,
    });
  }

  private createFallbackBinding(
    round: ChatBossRound,
    now: UnixMs,
  ): ChatBossCounterWindowBinding {
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
    signal: Nullable<ChatSignalEnvelope> | undefined,
    causeEventId: Nullable<ChatEventId> | undefined,
    sourceMessage: Nullable<ChatMessage>,
    rescueEnvelope: DerivedRescueEnvelope,
    now: UnixMs,
  ): ChatCounterSourceContext {
    const visibleChannel: ChatVisibleChannel = resolveVisibleChannel(
      room.activeVisibleChannel,
      room.activeVisibleChannel,
    );

    return {
      state,
      room,
      session,
      now,
      causeEventId: causeEventId ?? null,
      signal: signal ?? null,
      sourceMessage: sourceMessage ?? null,
      visibleChannel,
      rescue: rescueEnvelope.decision,
      notes: Object.freeze([
        'Counter source synthesized by ChatBossFightEngine.',
        `visibleChannel=${visibleChannel}`,
      ]),
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
    sourceMessage: Nullable<ChatMessage>;
    counterplay: ChatCounterPlanResult;
    plannedWindow: Nullable<ChatCounterWindow>;
    now: UnixMs;
    causeEventId: Nullable<ChatEventId>;
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
      quotingText: input.sourceMessage?.plainText
        ? input.sourceMessage.plainText.slice(0, 140)
        : null,
    });

    const shadowMessage = factory.createShadowAnnotation({
      state: input.state,
      roomId,
      channelId: 'RIVALRY_SHADOW' as ChatChannelId,
      now: asUnixMs(Number(input.now) + 25),
      text: `Boss fight primed. Pattern=${input.plan.pattern.patternId}. Window=${input.plannedWindow?.windowId ?? input.round.counterWindow?.windowId ?? 'none'}.`,
      actorId: input.plan.boss.actorId,
      displayName: input.plan.boss.displayName,
      shadowTag: 'RIVALRY',
      tags: ['bossfight', 'shadow'],
      causeEventId: input.causeEventId,
    } as any);

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
    sourceMessage: Nullable<ChatMessage>;
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
      computeBreakScore(input.snapshot) >= 0.82 ||
      computeEscalationScore(input.snapshot) >= 0.88 ||
      input.ledger.rounds.length >= this.policy.maxRoundsPerFight;

    if (shouldResolveFightNow) {
      const fightResolution = buildFightResolution(
        input.plan,
        input.snapshot,
        [resolvedRound],
        input.counterResolution,
        input.now,
      );

      const nextLedger = {
        ...input.ledger,
        activeFight: null,
        snapshot: null,
        rounds: Object.freeze([resolvedRound, ...input.ledger.rounds.slice(1)]),
        archivedResolutionIds: Object.freeze([
          fightResolution.resolutionId,
          ...input.ledger.archivedResolutionIds,
        ]),
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
          bossBreakScore: computeBreakScore(input.snapshot),
          legendChargeScore: computeLegendChargeScore(input.snapshot),
          resolutionClass: fightResolution.resolutionClass,
          resolutionWeight: resolutionWeight(fightResolution.resolutionClass),
        }),
      };
    }

    const nextRound = this.openNextRound(
      input.plan,
      input.snapshot,
      resolvedRound,
      input.now,
    );

    const nextSnapshot = applyBossAttackToSnapshot(
      input.snapshot,
      nextRound.attack,
      {
        publicExposure01: input.plan.publicExposure01,
        comebackPotential01: toBossScore01(Number(input.snapshot.playerStabilityScore) / 100),
      } as any,
    );

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
    now: UnixMs,
  ): ChatBossRound {
    const currentPhaseIndex = Math.max(
      0,
      plan.phases.findIndex((phase) => phase.phaseId === previousRound.phaseId),
    );
    const currentPhase = plan.phases[currentPhaseIndex] ?? plan.phases[0]!;
    const advancePhase = shouldAdvancePhaseLocally(currentPhase, snapshot);
    const nextPhase = advancePhase ? plan.phases[currentPhaseIndex + 1] ?? currentPhase : currentPhase;
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
          advancePhase ? 'phase-advanced' : 'phase-held',
          `phase=${(nextPhase as any).phaseKind ?? 'UNKNOWN'}`,
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
      text: materializeEscalationLine(input.nextRound.attack, input.counterResolution),
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
    sourceMessage: Nullable<ChatMessage>;
    now: UnixMs;
  }): readonly ChatMessage[] {
    const factory = createChatMessageFactory();
    const replay = this.replaySeed(input.plan, input.round, input.resolution.replayId ?? null);
    const learning = this.learningSeed(input.state, input.session.identity.userId, input.snapshot);
    const persona = bossPersonaForPlan(input.plan);
    const resolutionClass: ChatBossResolutionClass = input.resolution.resolutionClass as ChatBossResolutionClass;

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
      tags: ['bossfight', 'resolution', resolutionClass],
    });

    const bossMessage = factory.createHaterEscalationMessage({
      state: input.state,
      roomId: input.room.roomId,
      channelId: input.plan.channelId,
      now: asUnixMs(Number(input.now) + 220),
      persona,
      role: 'HATER',
      text: materializeBossResolutionLine(input.resolution, input.counterResolution),
      escalationTier: input.resolution.playerWon ? 'SOFT' : 'BOSS',
      attackWindowOpen: false,
      replay,
      learning,
      tags: ['bossfight', 'boss-resolution'],
      quotingMessageId: input.sourceMessage?.id ?? null,
      quotingText: input.sourceMessage?.plainText
        ? input.sourceMessage.plainText.slice(0, 120)
        : null,
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
          tags: ['bossfight', 'legend'],
        } as any)
      : null;

    return Object.freeze([
      systemMessage,
      bossMessage,
      ...(maybeLegend ? [maybeLegend] : []),
    ]);
  }

  private selectAudienceHeat(
    state: ChatState,
    room: ChatRoomState,
  ): Nullable<ChatAudienceHeat> {
    return state.audienceHeatByRoom[room.roomId] ?? null;
  }

  private replaySeed(
    plan: ChatBossFightPlan,
    round: ChatBossRound,
    replayId: Nullable<string>,
  ): ChatReplaySeed {
    return {
      replayId: replayId as any,
      replayAnchorKey: `boss:${plan.bossFightId}:round:${round.roundId}`,
      sceneId: plan.sceneId ?? null,
      momentId: plan.momentId ?? null,
      legendId: null,
    };
  }

  private learningSeed(
    state: ChatState,
    userId: string,
    snapshot: ChatBossFightSnapshot,
  ): ChatLearningSeed {
    const affect = state.learningProfiles[userId]?.affect ?? null;
    const score100: Score100 = clamp100(Number(snapshot.bossControlScore ?? 0));

    return {
      learningTriggered: true,
      affectAfterMessage: affect,
      inferenceSource: score100 >= clamp100(70) ? 'HEURISTIC' : 'HEURISTIC',
      inferenceId: null,
    };
  }

  private now(): UnixMs {
    return asUnixMs(this.clock.now());
  }
}

export function createChatBossFightEngine(
  options: ChatBossFightEngineOptions = {},
): ChatBossFightEngine {
  return new ChatBossFightEngine(options);
}

// ============================================================================
// MARK: Helper functions
// ============================================================================

function rejectOpen(
  reason: string,
  debug: Readonly<Record<string, JsonValue>> = Object.freeze({}),
): ChatBossFightOpenResult {
  return {
    accepted: false,
    reason,
    messages: [],
    debug,
  };
}

function resolveVisibleChannel(
  preferred: Nullable<string>,
  fallback: Nullable<string>,
): ChatVisibleChannel {
  if (preferred && isVisibleChannelId(preferred)) return preferred;
  if (fallback && isVisibleChannelId(fallback)) return fallback;
  return 'GLOBAL';
}

function normalizePressureTierValue(
  value: Nullable<PressureTier>,
): PressureTier {
  return value ?? 'NONE';
}

function sanitizePattern(
  pattern: (typeof CHAT_BOSS_PATTERNS)[number],
): ChatBossPatternDescriptor {
  return {
    ...pattern,
    momentTypeHint: (pattern as any).momentTypeHint as any,
    preferredSceneArchetype: (pattern as any).preferredSceneArchetype ?? null,
    preferredSceneRole: (pattern as any).preferredSceneRole ?? null,
  } as ChatBossPatternDescriptor;
}

function selectLatestPlayerMessage(
  state: ChatState,
  roomId: ChatRoomId,
  userId: string,
): Nullable<ChatMessage> {
  const entries = state.transcript.byRoom[roomId] ?? [];
  for (const entry of entries) {
    if (entry.message.attribution.authorUserId === userId) {
      return entry.message;
    }
  }
  return null;
}

function selectAffect(
  state: ChatState,
  userId: string,
): Nullable<ChatAffectSnapshot> {
  return state.learningProfiles[userId]?.affect ?? null;
}

function selectRelationship(
  state: ChatState,
  roomId: ChatRoomId,
  userId: string,
  actorId: string,
): Nullable<any> {
  return (Object.values(state.relationships) as any[]).find((relationship) =>
    relationship.roomId === roomId
    && relationship.userId === userId
    && relationship.actorId === actorId,
  ) ?? null;
}

function deriveRescueEnvelope(
  affect: Nullable<ChatAffectSnapshot>,
  learning: Nullable<ChatLearningProfile>,
  signal: Nullable<ChatSignalEnvelope> | undefined,
  sourceMessage: Nullable<ChatMessage>,
  haterPlan: Nullable<HaterResponsePlan>,
): DerivedRescueEnvelope {
  const urgencyScore =
    Number(learning?.churnRisk01 ?? 0.16) * 0.34 +
    Number(affect?.frustration01 ?? 0.12) * 0.22 +
    Number(affect?.embarrassment01 ?? 0.12) * 0.16 +
    Number(signal?.battle?.hostileMomentum ?? 40) / 100 * 0.12 +
    (isExecutionEscalationBand(haterPlan?.hostility?.escalationBand) ? 0.10 : 0) +
    (sourceMessage ? 0.03 : 0);

  const urgency: RescueUrgency =
    urgencyScore >= 0.82 ? 'CRITICAL' :
    urgencyScore >= 0.64 ? 'HARD' :
    urgencyScore >= 0.46 ? 'MEDIUM' :
    urgencyScore >= 0.24 ? 'SOFT' :
    'NONE';

  const helperPersonaId =
    urgency === 'CRITICAL' || urgency === 'HARD'
      ? 'npc:helper:anchor'
      : urgency === 'MEDIUM'
        ? 'npc:helper:mercy'
        : null;

  const triggered = urgency !== 'NONE';
  const shouldOpenRecoveryWindow = urgency === 'CRITICAL' || urgency === 'HARD';

  const decision: ChatCounterSourceContext['rescue'] = {
    triggered,
    urgency,
    reason: triggered
      ? 'player stability trending down under hostile pressure'
      : 'no rescue needed',
    helperPersonaId: helperPersonaId as any,
    shouldOpenRecoveryWindow,
  };

  return Object.freeze({
    decision,
    triggered,
    urgency,
    reason: triggered
      ? 'player stability trending down under hostile pressure'
      : 'no rescue needed',
    helperPersonaId,
    shouldOpenRecoveryWindow,
  });
}

function isExecutionEscalationBand(
  value: unknown,
): boolean {
  if (typeof value !== 'string') return false;
  const normalized = value.toUpperCase();
  return normalized === 'EXECUTION'
    || normalized === 'TERMINAL'
    || normalized === 'MAX'
    || normalized === 'LETHAL';
}

function derivePublicExposure01(
  state: ChatState,
  room: ChatRoomState,
  haterPlan: HaterResponsePlan,
  audienceHeat: Nullable<ChatAudienceHeat>,
): Score01 {
  const occupants = estimateWitnessDensity(state, room.roomId);
  const crowdBonus =
    room.activeVisibleChannel === 'GLOBAL' || room.activeVisibleChannel === 'LOBBY'
      ? 0.18
      : room.activeVisibleChannel === 'DEAL_ROOM'
        ? 0.06
        : 0.03;
  const heat = Number(audienceHeat?.heat01 ?? 0.12) * 0.24;
  const haterPublicBias = Number(haterPlan.personaMatch?.persona.crowdBias01 ?? 0.4) * 0.18;
  return clamp01(occupants * 0.40 + crowdBonus + heat + haterPublicBias);
}

function deriveBossHumiliationRisk01(
  affect: Nullable<ChatAffectSnapshot>,
  learning: Nullable<ChatLearningProfile>,
  haterPlan: HaterResponsePlan,
  signal: Nullable<ChatSignalEnvelope> | undefined,
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

function estimateWitnessDensity(
  state: ChatState,
  roomId: ChatRoomId,
): number {
  const occupants = state.roomSessions.byRoom[roomId] ?? [];
  return Math.max(0, Math.min(1, occupants.length / 10));
}

function mapAffectToBossContract(
  affect: Nullable<ChatAffectSnapshot>,
): any {
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

function mapAudienceHeatToBossContract(
  heat: Nullable<ChatAudienceHeat>,
): any {
  if (!heat) return null;
  const heatScore: Score100 = clamp100(Number(heat.heat01) * 100);
  return {
    heatScore: toBossScore100(Number(heatScore)),
    audienceBias: heat.swarmDirection,
    witnessDensity01: heat.heat01,
  };
}

function mapLearningToBossContract(
  learning: Nullable<ChatLearningProfile>,
): any {
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

function mapRelationshipStance(
  relationship: any,
): any {
  if (Number(relationship.rivalry01 ?? 0) >= 0.72) return 'HUNTING';
  if (Number(relationship.trust01 ?? 0) >= 0.62) return 'PROTECTIVE';
  if (Number(relationship.fear01 ?? 0) >= 0.54) return 'WOUNDED';
  if (Number(relationship.contempt01 ?? 0) >= 0.56) return 'PREDATORY';
  return 'CLINICAL';
}

function mapRelationshipObjective(
  relationship: any,
): any {
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

function helperPersonaFromActor(
  actor: ChatBossFightActor,
): any {
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

function initialStartDelayMs(
  pattern: ChatBossPatternDescriptor,
): number {
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

function deriveRoundDurationMs(
  attack: ChatBossAttack,
): number {
  const base =
    attack.severity === 'EXECUTION' ? 3_800 :
    attack.severity === 'CRITICAL' ? 4_600 :
    attack.severity === 'HEAVY' ? 5_400 :
    6_000;
  return attack.timeboxedMs != null ? Math.min(base, Number(attack.timeboxedMs)) : base;
}

function selectAttackType(
  signal: Nullable<ChatSignalEnvelope> | undefined,
  sourceMessage: Nullable<ChatMessage>,
  kind: ChatBossFightKind,
): AttackType {
  if (kind === 'DEAL_ROOM_AMBUSH') return 'LIQUIDATION';
  if (kind === 'ARCHIVIST_RECKONING') return 'SHADOW_LEAK';
  if (signal?.battle?.activeAttackType) return signal.battle.activeAttackType;
  if (sourceMessage?.plainText.toLowerCase().includes('prove')) return 'COMPLIANCE';
  if (sourceMessage?.plainText.toLowerCase().includes('everyone')) return 'CROWD_SWARM';
  return 'TAUNT';
}

function attackClassForType(
  attackType: AttackType,
): any {
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

function severityForSignal(
  signal: Nullable<ChatSignalEnvelope> | undefined,
): any {
  const momentum = Number(signal?.battle?.hostileMomentum ?? 50);
  if (momentum >= 86) return 'EXECUTION';
  if (momentum >= 68) return 'CRITICAL';
  if (momentum >= 46) return 'HEAVY';
  return 'PROBING';
}

function punishmentForAttackType(
  attackType: AttackType,
): any {
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

function buildTelegraphForAttack(
  attackType: AttackType,
  openingMode: any,
  publicEncounter: boolean,
  now: UnixMs,
): any {
  const revealDelayMs =
    openingMode === 'SILENCE_LURE' ? 950 :
    openingMode === 'NEGOTIATION_READ_DELAYED' ? 800 :
    openingMode === 'CROWD_PRIMED' ? 650 :
    openingMode === 'STAGGERED' ? 420 :
    250;

  const silenceLeadInMs =
    openingMode === 'SILENCE_LURE' ? 380 :
    openingMode === 'NEGOTIATION_READ_DELAYED' ? 220 :
    100;

  const label =
    attackType === 'LIQUIDATION' ? 'Terms tighten.' :
    attackType === 'COMPLIANCE' ? 'Receipts requested.' :
    attackType === 'CROWD_SWARM' ? 'The room turns.' :
    attackType === 'SHADOW_LEAK' ? 'Something private surfaces.' :
    'Pressure rises.';

  return {
    telegraphId: (`telegraph:${String(now)}:${attackType}`) as any,
    label,
    openingMode,
    revealDelayMs,
    silenceLeadInMs,
    canFakeOut: publicEncounter && attackType !== 'COMPLIANCE',
  };
}

function buildBossAttackLocally(input: {
  readonly fightId: string;
  readonly phaseId: string;
  readonly phaseLabel: string;
  readonly patternId: string;
  readonly attackType: AttackType;
  readonly attackClass: string;
  readonly severity: 'PROBING' | 'HEAVY' | 'CRITICAL' | 'EXECUTION';
  readonly primaryPunishment: string;
  readonly telegraph: any;
  readonly publicExposure01: number;
  readonly bossControlScore: number;
  readonly createdAt: UnixMs;
}): ChatBossAttack {
  const counterDemands =
    input.attackType === 'COMPLIANCE'
      ? (['VISIBLE_REPLY', 'PROOF_REPLY'] as const)
      : input.attackType === 'SHADOW_LEAK'
        ? (['QUOTE_REPLY'] as const)
        : input.attackType === 'LIQUIDATION'
          ? (['NEGOTIATION_REPLY', 'TIMED_REPLY'] as const)
          : input.attackType === 'CROWD_SWARM'
            ? (['VISIBLE_REPLY', 'TIMED_REPLY'] as const)
            : (['VISIBLE_REPLY'] as const);

  const preferredCounterTiming =
    input.attackType === 'LIQUIDATION'
      ? 'READ_PRESSURE_DELAYED'
      : input.attackType === 'SHADOW_LEAK'
        ? 'POST_SCENE'
        : input.attackType === 'CROWD_SWARM'
          ? 'FAST'
          : 'BEAT_LOCKED';

  const severityWeight =
    input.severity === 'EXECUTION' ? 1.0 :
    input.severity === 'CRITICAL' ? 0.80 :
    input.severity === 'HEAVY' ? 0.60 :
    0.40;

  return {
    attackId: (`attack:${input.fightId}:${input.phaseId}:${String(input.createdAt)}`) as any,
    patternId: input.patternId as any,
    label: `${input.phaseLabel} — ${input.attackType}`,
    attackType: input.attackType as any,
    attackClass: input.attackClass as any,
    severity: input.severity as any,
    primaryPunishment: input.primaryPunishment as any,
    telegraph: input.telegraph,
    proofWeighted: input.attackType === 'COMPLIANCE',
    quoteWeighted: input.attackType === 'SHADOW_LEAK',
    allowsHelperAssistance: input.severity !== 'EXECUTION',
    allowsSilenceOutplay: input.attackType === 'SHADOW_LEAK',
    allowsNegotiationEscape: input.attackType === 'LIQUIDATION',
    preferredCounterTiming: preferredCounterTiming as any,
    preferredCounterModes: Object.freeze(['PLAYER_TYPED', 'PLAYER_SELECTED'] as const) as any,
    counterDemands: Object.freeze([...counterDemands]) as any,
    opensCounterWindow: input.attackType !== 'SHADOW_LEAK',
    crowdAmplified: input.attackClass === 'PUBLIC_SHAME' || input.attackClass === 'CROWD_SIGNAL',
    timeboxedMs:
      input.severity === 'EXECUTION' ? 3_800 :
      input.severity === 'CRITICAL' ? 4_600 :
      input.severity === 'HEAVY' ? 5_400 :
      6_000,
    leverageScore01: toBossScore01(clamp01(input.publicExposure01 * 0.5 + input.bossControlScore / 200)),
    pressureDeltaScore: toBossScore100(clamp100(severityWeight * 60 * (1 + input.publicExposure01))),
    embarrassmentDeltaScore: toBossScore100(clamp100(severityWeight * 40)),
    dominanceDeltaScore: toBossScore100(clamp100(input.bossControlScore * severityWeight * 0.5)),
    reputationDeltaScore: toBossScore100(clamp100(severityWeight * 30 * input.publicExposure01)),
    notes: Object.freeze([]),
  } as ChatBossAttack;
}

function shouldAdvancePhaseLocally(
  phase: ChatBossFightPlan['phases'][number],
  snapshot: ChatBossFightSnapshot,
): boolean {
  const order = Number((phase as any).order ?? 0);
  if (order >= 3) return false;
  return computeEscalationScore(snapshot) >= 0.66 || computeBreakScore(snapshot) >= 0.61;
}

function computeBreakScore(
  snapshot: ChatBossFightSnapshot,
): number {
  const comebackProxy = Number(snapshot.playerStabilityScore ?? 50) / 100;
  const playerControlProxy = (100 - Number(snapshot.bossControlScore ?? 50)) / 100;
  return clamp01(
    (100 - Number(snapshot.bossControlScore ?? 50)) / 100 * 0.40 +
    comebackProxy * 0.34 +
    Number(snapshot.publicExposure01 ?? 0.25) * 0.18 +
    playerControlProxy * 0.08,
  );
}

function computeEscalationScore(
  snapshot: ChatBossFightSnapshot,
): number {
  const comebackProxy = Number(snapshot.playerStabilityScore ?? 50) / 100;
  const churnProxy = Number(snapshot.rescueUrgencyScore ?? 15) / 100;
  return clamp01(
    Number(snapshot.bossControlScore ?? 50) / 100 * 0.46 +
    (1 - comebackProxy) * 0.22 +
    Number(snapshot.publicExposure01 ?? 0.25) * 0.18 +
    (1 - churnProxy) * 0.14,
  );
}

function computeLegendChargeScore(
  snapshot: ChatBossFightSnapshot,
): number {
  const comebackProxy = Number(snapshot.playerStabilityScore ?? 50) / 100;
  const playerControlProxy = (100 - Number(snapshot.bossControlScore ?? 50)) / 100;
  return clamp01(
    Number(snapshot.publicExposure01 ?? 0.25) * 0.48 +
    comebackProxy * 0.24 +
    playerControlProxy * 0.18 +
    playerControlProxy * 0.10,
  );
}

function buildFightResolution(
  plan: ChatBossFightPlan,
  snapshot: ChatBossFightSnapshot,
  rounds: readonly ChatBossRound[],
  counterResolution: ChatCounterResolveResult,
  now: UnixMs,
): ChatBossFightResolution {
  const breakScore = computeBreakScore(snapshot);
  const escalationScore = computeEscalationScore(snapshot);
  const legendChargeScore = computeLegendChargeScore(snapshot);

  const resolutionClass: ChatBossResolutionClass =
    counterResolution.resolution.legendQualified || legendChargeScore >= 0.72
      ? 'PLAYER_DOMINATES'
      : counterResolution.resolution.succeeded && breakScore >= 0.62
        ? 'PLAYER_STABILIZES'
        : !counterResolution.resolution.succeeded && escalationScore >= 0.82
          ? 'BOSS_EXECUTION'
          : !counterResolution.resolution.succeeded && escalationScore >= 0.62
            ? 'BOSS_ADVANTAGE'
            : counterResolution.forcedClose
              ? 'RESCUE_EXTRACTION'
              : 'MUTUAL_STANDOFF';

  const playerWon =
    resolutionClass === 'PLAYER_DOMINATES'
    || resolutionClass === 'PLAYER_STABILIZES';

  const legendHint =
    playerWon || counterResolution.resolution.legendQualified
      ? {
          legendClass: legendChargeScore >= 0.78 ? 'PUBLIC_REVERSAL' : 'PRECISION_HOLD',
          confidence01: toBossScore01(legendChargeScore),
          notes: Object.freeze([]),
        }
      : null;

  return {
    resolutionId: (`resolution:${plan.bossFightId}:${String(now)}`) as any,
    bossFightId: plan.bossFightId,
    resolvedAt: now,
    resolutionClass,
    playerWon,
    bossBroken: resolutionClass === 'PLAYER_DOMINATES',
    rescued: resolutionClass === 'RESCUE_EXTRACTION',
    aborted: false,
    totalRounds: rounds.length,
    peakPressureScore: snapshot.accumulatedPressureScore,
    peakEmbarrassmentScore: snapshot.accumulatedEmbarrassmentScore,
    finalDominanceScore: snapshot.accumulatedDominanceScore,
    finalReputationSwingScore: snapshot.accumulatedReputationSwingScore,
    replayId: (`replay:${plan.bossFightId}:${String(now)}`) as any,
    legendHint,
    rounds,
    notes: Object.freeze([
      `breakScore=${breakScore.toFixed(3)}`,
      `escalationScore=${escalationScore.toFixed(3)}`,
      `legendChargeScore=${legendChargeScore.toFixed(3)}`,
    ]),
  } as ChatBossFightResolution;
}

function resolutionWeight(
  resolutionClass: ChatBossResolutionClass,
): number {
  return RESOLUTION_CLASS_WEIGHT[resolutionClass];
}

function materializeBossOpeningLine(
  plan: ChatBossFightPlan,
  round: ChatBossRound,
  sourceMessage: Nullable<ChatMessage>,
): string {
  const quote = sourceMessage?.plainText
    ? ` "${sourceMessage.plainText.slice(0, 96)}"`
    : '';

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

function materializeHelperOpeningLine(
  round: ChatBossRound,
  candidate: any,
): string {
  if (candidate?.move?.recommendedReplyText) {
    return `Use this line or shorten it. ${candidate.move.recommendedReplyText}`;
  }
  if (round.attack.attackClass === 'DEAL_ROOM_SQUEEZE') {
    return 'Do not defend everything. Reprice or exit.';
  }
  return 'One clean answer. Do not fight the entire room at once.';
}

function materializeEscalationLine(
  attack: ChatBossAttack,
  counterResolution: ChatCounterResolveResult,
): string {
  if (!counterResolution.resolution.succeeded && attack.attackClass === 'PUBLIC_SHAME') {
    return 'You felt that land, and so did everyone else.';
  }
  if (attack.attackClass === 'DEAL_ROOM_SQUEEZE') {
    return 'You survived the first term. The next one is worse.';
  }
  return `${attack.telegraph.label} The window shifts. The pressure does not.`;
}

function materializeResolutionSystemLine(
  resolution: ChatBossFightResolution,
): string {
  const resolutionClass: ChatBossResolutionClass =
    resolution.resolutionClass as ChatBossResolutionClass;

  switch (resolutionClass) {
    case 'PLAYER_DOMINATES':
      return 'Boss fight closed. Player authority restored.';
    case 'PLAYER_STABILIZES':
      return 'Boss fight closed. Player stabilized the room.';
    case 'RESCUE_EXTRACTION':
      return 'Boss fight closed by extraction.';
    case 'BOSS_EXECUTION':
      return 'Boss fight closed. Hostile side secured the room.';
    default:
      return `Boss fight closed with ${resolutionClass.toLowerCase().replace(/_/g, ' ')}.`;
  }
}

function materializeBossResolutionLine(
  resolution: ChatBossFightResolution,
  counterResolution: ChatCounterResolveResult,
): string {
  if (resolution.playerWon && resolution.legendHint) {
    return 'That one will be replayed later. You earned witnesses.';
  }
  if (resolution.playerWon) {
    return 'You held. Not cleanly maybe, but enough.';
  }
  if (resolution.rescued) {
    return 'You leave because someone pulled you out, not because you won.';
  }
  if (!counterResolution.resolution.succeeded) {
    return 'You missed your window. The room noticed.';
  }
  return 'This ends here, but not between us.';
}

function materializeLegendLine(
  resolution: ChatBossFightResolution,
): string {
  return `Legend moment: ${resolution.legendHint?.legendClass ?? 'PUBLIC_REVERSAL'}.`;
}

function bossPersonaForPlan(
  plan: ChatBossFightPlan,
): any {
  const id = plan.boss.actorId.toLowerCase();
  if (id.includes('compliance') || id.includes('bureaucrat')) {
    return HATER_PERSONAS.compliance;
  }
  if (id.includes('whisper') || id.includes('manipulator')) {
    return HATER_PERSONAS.whisper;
  }
  if (id.includes('butcher')) {
    return HATER_PERSONAS.butcher;
  }
  return HATER_PERSONAS.liquidator;
}

// ============================================================================
// MARK: End
// ============================================================================