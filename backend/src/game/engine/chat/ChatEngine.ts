
/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT ENGINE
 * FILE: backend/src/game/engine/chat/ChatEngine.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * This file is the authoritative backend chat runtime.
 *
 * It is intentionally self-sufficient in phase one because the full backend
 * chat tree is being established now. The permanent architecture extracts
 * reducer, message factory, transcript ledger, proof chain, replay writer,
 * moderation policy, rate policy, channel policy, command parser, NPC
 * orchestrators, and learning coordination into dedicated files.
 *
 * Today, however, this file lands the authoritative center of gravity so the
 * repo stops treating chat as a frontend-owned behavior shell. The design is:
 *
 * - transport forwards intent
 * - backend chat normalizes it
 * - policy gates it
 * - reducer mutates truth
 * - orchestrators decide helper / hater / ambient / invasion behavior
 * - transcript, proof, replay, telemetry, and learning updates are emitted
 *
 * Permanent extraction targets
 * ----------------------------
 * The internal sections in this file map one-to-one with the canonical tree:
 *
 * - message creation logic        -> ChatMessageFactory.ts
 * - transcript writes            -> ChatTranscriptLedger.ts
 * - proof linking                -> ChatProofChain.ts
 * - rate policy                  -> ChatRatePolicy.ts
 * - moderation policy            -> ChatModerationPolicy.ts
 * - channel policy               -> ChatChannelPolicy.ts
 * - command parsing              -> ChatCommandParser.ts
 * - room/session/presence state  -> ChatState.ts / ChatPresenceState.ts /
 *                                   ChatSessionState.ts
 * - orchestration                -> ChatNpcOrchestrator.ts /
 *                                   HaterResponseOrchestrator.ts /
 *                                   HelperResponseOrchestrator.ts /
 *                                   ChatInvasionOrchestrator.ts
 *
 * The engine is authoritative now and extractable later.
 * ============================================================================
 */

import {
  BACKEND_CHAT_ENGINE_VERSION,
  CHAT_CHANNEL_DESCRIPTORS,
  CHAT_MOUNT_POLICIES,
  CHAT_RUNTIME_DEFAULTS,
  asSequenceNumber,
  asUnixMs,
  clamp01,
  clamp100,
  isVisibleChannelId,
  type AttackType,
  type BotId,
  type ChatAffectSnapshot,
  type ChatAudienceHeat,
  type ChatChannelDecision,
  type ChatChannelId,
  type ChatClockPort,
  type ChatEngineObserver,
  type ChatEngineOptions,
  type ChatEnginePorts,
  type ChatEnginePublicApi,
  type ChatEngineTransaction,
  type ChatEventId,
  type ChatEventObserver,
  type ChatFanoutPacket,
  type ChatHashPort,
  type ChatIdFactoryPort,
  type ChatInferenceSnapshot,
  type ChatInputEnvelope,
  type ChatInvasionId,
  type ChatInvasionState,
  type ChatJoinRequest,
  type ChatLearningProfile,
  type ChatLeaveRequest,
  type ChatLoggerPort,
  type ChatMessage,
  type ChatMessageBodyPart,
  type ChatModerationDecision,
  type ChatModerationOutcome,
  type ChatNormalizedEvent,
  type ChatNormalizedInput,
  type ChatNpcRole,
  type ChatPendingReveal,
  type ChatPendingRequestState,
  type ChatPersonaDescriptor,
  type ChatPersonaId,
  type ChatPlayerMessageSubmitRequest,
  type ChatPolicyBundle,
  type ChatPresenceMode,
  type ChatPresenceSnapshot,
  type ChatPresenceState,
  type ChatPresenceUpdateRequest,
  type ChatProofChain,
  type ChatProofEdge,
  type ChatProofHash,
  type ChatRateDecision,
  type ChatRateOutcome,
  type ChatRelationshipId,
  type ChatRelationshipState,
  type ChatReplayArtifact,
  type ChatReplayId,
  type ChatReplayIndex,
  type ChatRescueDecision,
  type ChatRoomId,
  type ChatRoomKind,
  type ChatRoomSessionIndex,
  type ChatRoomStageMood,
  type ChatRoomState,
  type ChatRuntimeConfig,
  type ChatScenePlan,
  type ChatSessionId,
  type ChatSessionIdentity,
  type ChatSessionState,
  type ChatSignalEnvelope,
  type ChatSilenceDecision,
  type ChatState,
  type ChatStateDelta,
  type ChatTelemetryEnvelope,
  type ChatTelemetryId,
  type ChatTranscriptEntry,
  type ChatTranscriptLedger,
  type ChatTypingMode,
  type ChatTypingSnapshot,
  type ChatTypingState,
  type ChatTypingUpdateRequest,
  type ChatVisibleChannel,
  type JsonValue,
  type PressureTier,
  type Score01,
  type Score100,
  type SequenceNumber,
  type UnixMs,
} from './types';

// ============================================================================
// MARK: Defaults and no-op ports
// ============================================================================

const DEFAULT_CLOCK: ChatClockPort = {
  now: () => Date.now(),
  setTimeout: (handler, ms) => globalThis.setTimeout(handler, ms),
  clearTimeout: (token) => globalThis.clearTimeout(token as number),
};

const DEFAULT_IDS: ChatIdFactoryPort = {
  eventId: (prefix = 'evt') => `${prefix}_${Date.now()}_${randomBase36(8)}` as ChatEventId,
  messageId: (prefix = 'msg') => `${prefix}_${Date.now()}_${randomBase36(8)}` as any,
  replayId: (prefix = 'rpl') => `${prefix}_${Date.now()}_${randomBase36(8)}` as ChatReplayId,
  telemetryId: (prefix = 'tel') => `${prefix}_${Date.now()}_${randomBase36(8)}` as ChatTelemetryId,
  proofEdgeId: (prefix = 'prf') => `${prefix}_${Date.now()}_${randomBase36(8)}` as any,
  inferenceId: (prefix = 'inf') => `${prefix}_${Date.now()}_${randomBase36(8)}` as any,
  invasionId: (prefix = 'inv') => `${prefix}_${Date.now()}_${randomBase36(8)}` as ChatInvasionId,
  relationshipId: (prefix = 'rel') => `${prefix}_${Date.now()}_${randomBase36(8)}` as ChatRelationshipId,
};

const DEFAULT_HASH: ChatHashPort = {
  hash: (input: string) => fnv1a32(input) as ChatProofHash,
};

const DEFAULT_LOGGER: ChatLoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const DEFAULT_RANDOM = {
  next: () => Math.random(),
};

const NOOP_PORTS: Required<ChatEnginePorts> = {
  clock: DEFAULT_CLOCK,
  ids: DEFAULT_IDS,
  hash: DEFAULT_HASH,
  logger: DEFAULT_LOGGER,
  persistence: {},
  fanout: { publish: async () => undefined },
  telemetry: { emit: async () => undefined },
  replay: { publish: async () => undefined },
  learning: {},
  random: DEFAULT_RANDOM,
};

// ============================================================================
// MARK: Local donor registries and authored personas
// ============================================================================

interface LocalNpcRegistryEntry extends ChatPersonaDescriptor {
  readonly preferredPressure: readonly PressureTier[];
  readonly preferredMood: readonly ChatRoomStageMood[];
  readonly telegraphs: readonly string[];
  readonly taunts: readonly string[];
  readonly retreats: readonly string[];
  readonly rescues: readonly string[];
  readonly ambient: readonly string[];
}

const PERSONAS: Readonly<Record<string, LocalNpcRegistryEntry>> = Object.freeze({
  hater_liquidator: {
    personaId: 'persona:hater:liquidator' as ChatPersonaId,
    actorId: 'npc:hater:liquidator',
    role: 'HATER',
    displayName: 'THE LIQUIDATOR',
    botId: 'BOT_01' as BotId,
    voiceprint: {
      punctuationStyle: 'HARD',
      avgSentenceLength: 10,
      delayFloorMs: 650,
      delayCeilingMs: 1450,
      opener: 'Listen carefully.',
      closer: 'You have less room than you think.',
      lexicon: ['floor', 'clearance', 'liquidity', 'fragility', 'window'],
    },
    preferredChannels: ['GLOBAL', 'DEAL_ROOM', 'RIVALRY_SHADOW'],
    tags: ['hater', 'liquidity', 'public-pressure'],
    preferredPressure: ['HIGH', 'CRITICAL'],
    preferredMood: ['HOSTILE', 'PREDATORY'],
    telegraphs: [
      'The floor is visible from here.',
      'Stress reprices confidence faster than confidence can defend itself.',
      'You are one weak layer away from a clearance event.',
    ],
    taunts: [
      'Your assets are priced for distress.',
      'You built momentum. I built a window to extract it.',
      'Public confidence drops first. Then numbers follow.',
    ],
    retreats: [
      'This window closes. Another opens.',
      'You absorbed this round. The market keeps memory.',
    ],
    rescues: [],
    ambient: [
      'The room can smell thinning liquidity.',
    ],
  },
  hater_bureaucrat: {
    personaId: 'persona:hater:bureaucrat' as ChatPersonaId,
    actorId: 'npc:hater:bureaucrat',
    role: 'HATER',
    displayName: 'THE BUREAUCRAT',
    botId: 'BOT_02' as BotId,
    voiceprint: {
      punctuationStyle: 'FORMAL',
      avgSentenceLength: 14,
      delayFloorMs: 850,
      delayCeilingMs: 1900,
      opener: 'For the record.',
      closer: 'This remains under review.',
      lexicon: ['review', 'forms', 'compliance', 'verification', 'provisional'],
    },
    preferredChannels: ['GLOBAL', 'SYNDICATE', 'RIVALRY_SHADOW'],
    tags: ['hater', 'compliance', 'systems'],
    preferredPressure: ['ELEVATED', 'HIGH', 'CRITICAL'],
    preferredMood: ['TENSE', 'HOSTILE'],
    telegraphs: [
      'A filing issue has entered review.',
      'Compliance friction is still friction, even when it smiles.',
      'Everything is provisionally approved until it is not.',
    ],
    taunts: [
      'Every income stream requires verification. There are forms.',
      'The system requires reserves. You appear to prefer improvisation.',
      'Please hold while your optimism is processed.',
    ],
    retreats: [
      'Your paperwork appears to be in order. For now.',
      'We will revisit your compliance posture.',
    ],
    rescues: [],
    ambient: [
      'A process somewhere has already noticed you.',
    ],
  },
  hater_manipulator: {
    personaId: 'persona:hater:manipulator' as ChatPersonaId,
    actorId: 'npc:hater:manipulator',
    role: 'HATER',
    displayName: 'THE MANIPULATOR',
    botId: 'BOT_03' as BotId,
    voiceprint: {
      punctuationStyle: 'SOFT',
      avgSentenceLength: 13,
      delayFloorMs: 550,
      delayCeilingMs: 1300,
      opener: 'Pattern check.',
      closer: 'Predictability is a tax.',
      lexicon: ['pattern', 'readability', 'cadence', 'trap', 'behavior'],
    },
    preferredChannels: ['GLOBAL', 'DEAL_ROOM', 'RIVALRY_SHADOW'],
    tags: ['hater', 'behavioral', 'mindgames'],
    preferredPressure: ['BUILDING', 'ELEVATED', 'HIGH', 'CRITICAL'],
    preferredMood: ['TENSE', 'HOSTILE', 'PREDATORY'],
    telegraphs: [
      'Predictable players become readable players.',
      'You left a pattern. I left a trap inside it.',
      'Behavior is inventory to the prepared mind.',
    ],
    taunts: [
      'You did not lose to chance. You lost to readability.',
      'Your panic cadence is a better signal than any chart.',
      'I have been studying your moves before you made them.',
    ],
    retreats: [
      'You changed your pattern. Interesting.',
      'I will need to recalibrate the model.',
    ],
    rescues: [],
    ambient: [
      'Someone in the room is learning your rhythm.',
    ],
  },
  helper_anchor: {
    personaId: 'persona:helper:anchor' as ChatPersonaId,
    actorId: 'npc:helper:anchor',
    role: 'HELPER',
    displayName: 'Kade Anchor',
    botId: null,
    voiceprint: {
      punctuationStyle: 'HARD',
      avgSentenceLength: 9,
      delayFloorMs: 400,
      delayCeilingMs: 1100,
      opener: 'Breathe.',
      closer: 'Take the clean line.',
      lexicon: ['clean', 'line', 'window', 'steady', 'breath'],
    },
    preferredChannels: ['SYNDICATE', 'GLOBAL', 'RESCUE_SHADOW'],
    tags: ['helper', 'stabilizer', 'rescue'],
    preferredPressure: ['HIGH', 'CRITICAL'],
    preferredMood: ['HOSTILE', 'MOURNFUL', 'TENSE'],
    telegraphs: [],
    taunts: [],
    retreats: [],
    rescues: [
      'Take the clean line. Do not answer the whole room.',
      'One move. Stabilize first. Style can wait.',
      'Mute the crowd in your head. Solve the next thing only.',
    ],
    ambient: [
      'You still have a narrow exit.',
    ],
  },
  helper_mercy: {
    personaId: 'persona:helper:mercy' as ChatPersonaId,
    actorId: 'npc:helper:mercy',
    role: 'HELPER',
    displayName: 'Mercy Vale',
    botId: null,
    voiceprint: {
      punctuationStyle: 'SOFT',
      avgSentenceLength: 12,
      delayFloorMs: 700,
      delayCeilingMs: 1600,
      opener: 'Stay with me.',
      closer: 'You are not out yet.',
      lexicon: ['steady', 'stay', 'soft', 'recover', 'window'],
    },
    preferredChannels: ['SYNDICATE', 'GLOBAL', 'RESCUE_SHADOW'],
    tags: ['helper', 'calm', 'recovery'],
    preferredPressure: ['BUILDING', 'ELEVATED', 'HIGH', 'CRITICAL'],
    preferredMood: ['MOURNFUL', 'TENSE', 'CALM'],
    telegraphs: [],
    taunts: [],
    retreats: [],
    rescues: [
      'You do not need brilliance here. You need sequence.',
      'Let the hit land without giving it your identity.',
      'The room is loud. Your next move should be quiet.',
    ],
    ambient: [
      'There is still a recoverable line.',
    ],
  },
  ambient_floor: {
    personaId: 'persona:ambient:floor' as ChatPersonaId,
    actorId: 'npc:ambient:floor',
    role: 'AMBIENT',
    displayName: 'Floor Chorus',
    botId: null,
    voiceprint: {
      punctuationStyle: 'ERRATIC',
      avgSentenceLength: 6,
      delayFloorMs: 900,
      delayCeilingMs: 2200,
      opener: null,
      closer: null,
      lexicon: ['room', 'heat', 'watching', 'crowd', 'saw that'],
    },
    preferredChannels: ['GLOBAL', 'LOBBY', 'LIVEOPS_SHADOW'],
    tags: ['ambient', 'crowd', 'stage'],
    preferredPressure: ['NONE', 'BUILDING', 'ELEVATED', 'HIGH', 'CRITICAL'],
    preferredMood: ['CALM', 'TENSE', 'HOSTILE', 'ECSTATIC', 'MOURNFUL'],
    telegraphs: [],
    taunts: [],
    retreats: [],
    rescues: [],
    ambient: [
      'The room saw that.',
      'Crowd heat just moved.',
      'That changed the temperature.',
      'The stage got smaller.',
      'Everyone felt that hesitation.',
    ],
  },
});

// ============================================================================
// MARK: Internal helper types
// ============================================================================

interface InternalPorts {
  readonly clock: ChatClockPort;
  readonly ids: ChatIdFactoryPort;
  readonly hash: ChatHashPort;
  readonly logger: ChatLoggerPort;
  readonly persistence: Required<ChatEnginePorts>['persistence'];
  readonly fanout: Required<ChatEnginePorts>['fanout'];
  readonly telemetry: Required<ChatEnginePorts>['telemetry'];
  readonly replay: Required<ChatEnginePorts>['replay'];
  readonly learning: Required<ChatEnginePorts>['learning'];
  readonly random: Required<ChatEnginePorts>['random'];
}

interface EventContext {
  readonly event: ChatNormalizedInput;
  readonly room: ChatRoomState | null;
  readonly session: ChatSessionState | null;
  readonly now: UnixMs;
}

interface DerivedReactionPlan {
  readonly helperCandidates: readonly ChatPersonaId[];
  readonly haterCandidates: readonly ChatPersonaId[];
  readonly ambientCandidates: readonly ChatPersonaId[];
  readonly rescue: ChatRescueDecision | null;
  readonly silence: ChatSilenceDecision | null;
  readonly invasion: ChatInvasionState | null;
  readonly roomMood: ChatRoomStageMood | null;
  readonly heatDelta: number;
}

interface ProcessResult {
  readonly state: ChatState;
  readonly appendedMessages: readonly ChatMessage[];
  readonly redactedMessageIds: readonly any[];
  readonly replayArtifacts: readonly ChatReplayArtifact[];
  readonly proofEdges: readonly ChatProofEdge[];
  readonly telemetry: readonly ChatTelemetryEnvelope[];
  readonly learningProfilesTouched: readonly any[];
  readonly inferenceSnapshots: readonly ChatInferenceSnapshot[];
  readonly touchedRoomIds: readonly ChatRoomId[];
  readonly touchedSessionIds: readonly ChatSessionId[];
  readonly rejectionReasons: readonly string[];
  readonly policy: ChatPolicyBundle | null;
}


type Mutable<T> = { -readonly [K in keyof T]: T[K] };

const EMPTY_AFFECT: ChatAffectSnapshot = Object.freeze({
  confidence01: clamp01(0.55),
  frustration01: clamp01(0.15),
  intimidation01: clamp01(0.10),
  attachment01: clamp01(0.20),
  curiosity01: clamp01(0.35),
  embarrassment01: clamp01(0.05),
  relief01: clamp01(0.05),
});

const EMPTY_TELEMETRY: readonly ChatTelemetryEnvelope[] = Object.freeze([]);
const EMPTY_PROOF_EDGES: readonly ChatProofEdge[] = Object.freeze([]);
const EMPTY_REPLAY: readonly ChatReplayArtifact[] = Object.freeze([]);
const EMPTY_MESSAGES: readonly ChatMessage[] = Object.freeze([]);
const EMPTY_SESSION_IDS: readonly ChatSessionId[] = Object.freeze([]);
const EMPTY_ROOM_IDS: readonly ChatRoomId[] = Object.freeze([]);
const EMPTY_INFERENCE: readonly ChatInferenceSnapshot[] = Object.freeze([]);

const HATER_PERSONA_IDS = [
  PERSONAS.hater_liquidator.personaId,
  PERSONAS.hater_bureaucrat.personaId,
  PERSONAS.hater_manipulator.personaId,
] as const;

const HELPER_PERSONA_IDS = [
  PERSONAS.helper_anchor.personaId,
  PERSONAS.helper_mercy.personaId,
] as const;

const AMBIENT_PERSONA_IDS = [
  PERSONAS.ambient_floor.personaId,
] as const;

// ============================================================================
// MARK: Engine implementation
// ============================================================================

export class ChatEngine implements ChatEnginePublicApi {
  private state: ChatState;
  private readonly observers = new Set<ChatEngineObserver>();
  private readonly eventObservers = new Set<ChatEventObserver>();
  private readonly ports: InternalPorts;
  private maintenanceTimer: unknown = null;
  private readonly runtime: ChatRuntimeConfig;

  public constructor(options: ChatEngineOptions = {}) {
    this.runtime = mergeRuntimeConfig(options.runtime);
    this.ports = createPorts(options.ports);
    this.state = createInitialState({
      runtime: this.runtime,
      now: asUnixMs(options.now ?? this.ports.clock.now()),
    });

    this.ports.logger.info('chat.engine.boot', {
      version: BACKEND_CHAT_ENGINE_VERSION,
      allowVisibleChannels: this.runtime.allowVisibleChannels.join(','),
    });

    this.startMaintenanceLoop();
  }

  public getState(): Readonly<ChatState> {
    return deepFreeze(cloneState(this.state));
  }

  public subscribeState(observer: ChatEngineObserver): () => void {
    this.observers.add(observer);
    return () => {
      this.observers.delete(observer);
    };
  }

  public subscribeEvents(observer: ChatEventObserver): () => void {
    this.eventObservers.add(observer);
    return () => {
      this.eventObservers.delete(observer);
    };
  }

  public async ingest(input: ChatInputEnvelope): Promise<ChatEngineTransaction> {
    const normalized = this.normalizeInput(input);
    const tx = await this.process(normalized);
    return tx;
  }

  public async tick(reason: string): Promise<ChatEngineTransaction> {
    return this.ingest({
      kind: 'MAINTENANCE_TICK',
      emittedAt: asUnixMs(this.ports.clock.now()),
      payload: { reason },
    });
  }

  public async shutdown(): Promise<void> {
    if (this.maintenanceTimer !== null) {
      this.ports.clock.clearTimeout(this.maintenanceTimer);
      this.maintenanceTimer = null;
    }

    this.ports.logger.info('chat.engine.shutdown', {
      rooms: Object.keys(this.state.rooms).length,
      sessions: Object.keys(this.state.sessions).length,
    });

    if (this.ports.persistence.saveState) {
      await this.ports.persistence.saveState(this.state);
    }
  }

  // ==========================================================================
  // MARK: Input normalization
  // ==========================================================================

  private normalizeInput(input: ChatInputEnvelope): ChatNormalizedInput {
    const ids = this.ports.ids;

    switch (input.kind) {
      case 'SESSION_JOIN_REQUEST': {
        return {
          eventId: ids.eventId('join'),
          kind: 'SESSION_JOIN_REQUEST',
          emittedAt: input.emittedAt,
          roomId: input.payload.roomId,
          sessionId: input.payload.session.sessionId,
          userId: input.payload.session.userId,
          payload: input.payload,
          metadata: { roomKind: input.payload.roomKind },
        } as ChatNormalizedInput;
      }

      case 'SESSION_LEAVE': {
        return {
          eventId: ids.eventId('leave'),
          kind: 'SESSION_LEAVE',
          emittedAt: input.emittedAt,
          roomId: input.payload.roomId,
          sessionId: input.payload.sessionId,
          userId: this.state.sessions[input.payload.sessionId]?.identity.userId ?? null,
          payload: input.payload,
          metadata: { reason: input.payload.reason },
        } as ChatNormalizedInput;
      }

      case 'PRESENCE_UPDATED': {
        return {
          eventId: ids.eventId('prs'),
          kind: 'PRESENCE_UPDATED',
          emittedAt: input.emittedAt,
          roomId: input.payload.roomId,
          sessionId: input.payload.sessionId,
          userId: this.state.sessions[input.payload.sessionId]?.identity.userId ?? null,
          payload: input.payload,
          metadata: { mode: input.payload.mode },
        } as ChatNormalizedInput;
      }

      case 'TYPING_UPDATED': {
        return {
          eventId: ids.eventId('typ'),
          kind: 'TYPING_UPDATED',
          emittedAt: input.emittedAt,
          roomId: input.payload.roomId,
          sessionId: input.payload.sessionId,
          userId: this.state.sessions[input.payload.sessionId]?.identity.userId ?? null,
          payload: input.payload,
          metadata: {
            channelId: input.payload.channelId,
            mode: input.payload.mode,
          },
        } as ChatNormalizedInput;
      }

      case 'PLAYER_MESSAGE_SUBMIT': {
        return {
          eventId: ids.eventId('msg'),
          kind: 'PLAYER_MESSAGE_SUBMIT',
          emittedAt: input.emittedAt,
          roomId: input.payload.roomId,
          sessionId: input.payload.sessionId,
          userId: this.state.sessions[input.payload.sessionId]?.identity.userId ?? null,
          payload: input.payload,
          metadata: {
            channelId: input.payload.channelId,
            requestId: input.payload.requestId,
          },
        } as ChatNormalizedInput;
      }

      case 'BATTLE_SIGNAL':
      case 'RUN_SIGNAL':
      case 'MULTIPLAYER_SIGNAL':
      case 'ECONOMY_SIGNAL':
      case 'LIVEOPS_SIGNAL': {
        return {
          eventId: ids.eventId('sig'),
          kind: input.kind,
          emittedAt: input.emittedAt,
          roomId: input.payload.roomId ?? null,
          sessionId: null,
          userId: null,
          payload: input.payload,
          metadata: { type: input.payload.type },
        } as ChatNormalizedInput;
      }

      case 'MAINTENANCE_TICK': {
        return {
          eventId: ids.eventId('tick'),
          kind: 'MAINTENANCE_TICK',
          emittedAt: input.emittedAt,
          roomId: null,
          sessionId: null,
          userId: null,
          payload: input.payload,
          metadata: { reason: input.payload.reason },
        } as ChatNormalizedInput;
      }
    }
  }

  // ==========================================================================
  // MARK: Processing pipeline
  // ==========================================================================

  private async process(event: ChatNormalizedInput): Promise<ChatEngineTransaction> {
    const context = this.createContext(event);
    const result = this.applyEvent(context);

    this.state = result.state;

    await this.flushSideEffects(result);

    const delta: ChatStateDelta | null = result.rejectionReasons.length > 0 && result.appendedMessages.length === 0
      ? null
      : {
          acceptedEventId: event.eventId,
          touchedRoomIds: result.touchedRoomIds,
          touchedSessionIds: result.touchedSessionIds,
          appendedMessages: result.appendedMessages,
          redactedMessageIds: result.redactedMessageIds,
          replayArtifacts: result.replayArtifacts,
          proofEdges: result.proofEdges,
          telemetry: result.telemetry,
          learningProfilesTouched: result.learningProfilesTouched,
          inferenceSnapshots: result.inferenceSnapshots,
        };

    const fanout = buildFanoutPackets(this.state, result.touchedRoomIds, result.telemetry);

    const tx: ChatEngineTransaction = {
      accepted: result.rejectionReasons.length === 0,
      rejected: result.rejectionReasons.length > 0,
      event,
      rejectionReasons: result.rejectionReasons,
      policy: result.policy,
      delta,
      fanout,
      state: this.state,
    };

    this.notify(tx);
    return tx;
  }

  private createContext(event: ChatNormalizedInput): EventContext {
    const room = event.roomId ? this.state.rooms[event.roomId] ?? null : null;
    const session = event.sessionId ? this.state.sessions[event.sessionId] ?? null : null;

    return {
      event,
      room,
      session,
      now: event.emittedAt,
    };
  }

  private applyEvent(context: EventContext): ProcessResult {
    switch (context.event.kind) {
      case 'SESSION_JOIN_REQUEST':
        return this.handleJoin(context, context.event.payload as ChatJoinRequest);
      case 'SESSION_LEAVE':
        return this.handleLeave(context, context.event.payload as ChatLeaveRequest);
      case 'PRESENCE_UPDATED':
        return this.handlePresenceUpdate(context, context.event.payload as ChatPresenceUpdateRequest);
      case 'TYPING_UPDATED':
        return this.handleTypingUpdate(context, context.event.payload as ChatTypingUpdateRequest);
      case 'PLAYER_MESSAGE_SUBMIT':
        return this.handlePlayerMessage(context, context.event.payload as ChatPlayerMessageSubmitRequest);
      case 'BATTLE_SIGNAL':
      case 'RUN_SIGNAL':
      case 'MULTIPLAYER_SIGNAL':
      case 'ECONOMY_SIGNAL':
      case 'LIVEOPS_SIGNAL':
        return this.handleSignal(context, context.event.payload as ChatSignalEnvelope);
      case 'MAINTENANCE_TICK':
        return this.handleMaintenanceTick(context, String((context.event.payload as { reason: string }).reason));
      default:
        return {
          state: this.state,
          appendedMessages: EMPTY_MESSAGES,
          redactedMessageIds: [],
          replayArtifacts: EMPTY_REPLAY,
          proofEdges: EMPTY_PROOF_EDGES,
          telemetry: EMPTY_TELEMETRY,
          learningProfilesTouched: [],
          inferenceSnapshots: EMPTY_INFERENCE,
          touchedRoomIds: EMPTY_ROOM_IDS,
          touchedSessionIds: EMPTY_SESSION_IDS,
          rejectionReasons: [`Unhandled event kind: ${context.event.kind}`],
          policy: null,
        };
    }
  }

  // ==========================================================================
  // MARK: Session and room admission
  // ==========================================================================

  private handleJoin(context: EventContext, request: ChatJoinRequest): ProcessResult {
    const now = context.now;
    const roomId = request.roomId;
    const sessionId = request.session.sessionId;

    let nextState = cloneState(this.state) as Mutable<ChatState>;
    const room = nextState.rooms[roomId] ?? createRoomState({
      roomId,
      roomKind: request.roomKind,
      title: request.title,
      mountTarget: request.mountTarget,
      requestedVisibleChannel: request.requestedVisibleChannel,
      now,
    });

    const requestedVisibleChannel =
      request.requestedVisibleChannel && room.allowedVisibleChannels.includes(request.requestedVisibleChannel)
        ? request.requestedVisibleChannel
        : room.activeVisibleChannel;

    const session: ChatSessionState = {
      identity: request.session,
      roomIds: uniqueIds([...(nextState.roomSessions.bySession[sessionId] ?? []), roomId]),
      connectionState: 'ATTACHED',
      joinedAt: now,
      lastSeenAt: now,
      mutedUntil: null,
      shadowMuted: false,
      invisible: false,
      transportMetadata: request.transportMetadata ?? {},
    };

    nextState.rooms = {
      ...nextState.rooms,
      [roomId]: {
        ...room,
        activeVisibleChannel: requestedVisibleChannel,
        lastActivityAt: now,
      },
    };

    nextState.sessions = {
      ...nextState.sessions,
      [sessionId]: session,
    };

    nextState.roomSessions = {
      byRoom: {
        ...nextState.roomSessions.byRoom,
        [roomId]: uniqueIds([...(nextState.roomSessions.byRoom[roomId] ?? []), sessionId]),
      },
      bySession: {
        ...nextState.roomSessions.bySession,
        [sessionId]: session.roomIds,
      },
    };

    nextState = upsertPresence(nextState, {
      roomId,
      sessionId,
      mode: 'ONLINE',
      spectating: request.session.role === 'SPECTATOR',
      visibleToRoom: request.session.role !== 'SYSTEM',
    }, now);

    nextState.lastEventByRoom = {
      ...nextState.lastEventByRoom,
      [roomId]: context.event.eventId,
    };

    nextState.lastEventAtByRoom = {
      ...nextState.lastEventAtByRoom,
      [roomId]: now,
    };

    const telemetry = [
      createTelemetry(this.ports, {
        eventName: 'presence_updated',
        roomId,
        sessionId,
        userId: request.session.userId,
        createdAt: now,
        payload: { kind: 'join', role: request.session.role },
      }),
    ];

    const systemMessage = this.createSystemMessage({
      roomId,
      channelId: room.activeVisibleChannel,
      text: `${request.session.displayName} entered ${room.title}.`,
      now,
      tags: ['session', 'join'],
      causeEventId: context.event.eventId,
    });

    nextState = appendMessage(nextState, systemMessage);

    const proofEdges = [
      createProofEdge(this.ports, {
        roomId,
        fromEventId: context.event.eventId,
        toMessageId: systemMessage.id,
        edgeType: 'EVENT_TO_MESSAGE',
        metadata: { action: 'join' },
      }),
    ];

    return {
      state: nextState,
      appendedMessages: [systemMessage],
      redactedMessageIds: [],
      replayArtifacts: [],
      proofEdges,
      telemetry,
      learningProfilesTouched: [],
      inferenceSnapshots: [],
      touchedRoomIds: [roomId],
      touchedSessionIds: [sessionId],
      rejectionReasons: [],
      policy: null,
    };
  }

  private handleLeave(context: EventContext, request: ChatLeaveRequest): ProcessResult {
    const roomId = request.roomId;
    const sessionId = request.sessionId;
    const now = context.now;

    const existingSession = this.state.sessions[sessionId];
    if (!existingSession) {
      return rejectResult(this.state, ['Session not found for leave request.']);
    }

    let nextState = cloneState(this.state) as Mutable<ChatState>;
    const currentRooms = nextState.roomSessions.bySession[sessionId] ?? [];
    const nextRooms = currentRooms.filter((id) => id !== roomId);

    nextState.roomSessions = {
      byRoom: {
        ...nextState.roomSessions.byRoom,
        [roomId]: (nextState.roomSessions.byRoom[roomId] ?? []).filter((id: ChatSessionId) => id !== sessionId),
      },
      bySession: {
        ...nextState.roomSessions.bySession,
        [sessionId]: nextRooms,
      },
    };

    nextState.sessions = {
      ...nextState.sessions,
      [sessionId]: {
        ...existingSession,
        roomIds: nextRooms,
        connectionState: nextRooms.length > 0 ? 'ATTACHED' : 'DETACHED',
        lastSeenAt: now,
      },
    };

    nextState = clearPresenceForRoom(nextState, roomId, sessionId);
    nextState = clearTypingForRoom(nextState, roomId, sessionId);

    nextState.lastEventByRoom = {
      ...nextState.lastEventByRoom,
      [roomId]: context.event.eventId,
    };

    nextState.lastEventAtByRoom = {
      ...nextState.lastEventAtByRoom,
      [roomId]: now,
    };

    const room = nextState.rooms[roomId];
    const farewell = room
      ? this.createSystemMessage({
          roomId,
          channelId: room.activeVisibleChannel,
          text: `${existingSession.identity.displayName} left ${room.title}.`,
          now,
          tags: ['session', 'leave'],
          causeEventId: context.event.eventId,
        })
      : null;

    if (farewell) {
      nextState = appendMessage(nextState, farewell);
    }

    const telemetry = [
      createTelemetry(this.ports, {
        eventName: 'presence_updated',
        roomId,
        sessionId,
        userId: existingSession.identity.userId,
        createdAt: now,
        payload: { kind: 'leave', reason: request.reason },
      }),
    ];

    const proofEdges = farewell
      ? [
          createProofEdge(this.ports, {
            roomId,
            fromEventId: context.event.eventId,
            toMessageId: farewell.id,
            edgeType: 'EVENT_TO_MESSAGE',
            metadata: { action: 'leave', reason: request.reason },
          }),
        ]
      : [];

    return {
      state: nextState,
      appendedMessages: farewell ? [farewell] : [],
      redactedMessageIds: [],
      replayArtifacts: [],
      proofEdges,
      telemetry,
      learningProfilesTouched: [],
      inferenceSnapshots: [],
      touchedRoomIds: [roomId],
      touchedSessionIds: [sessionId],
      rejectionReasons: [],
      policy: null,
    };
  }

  // ==========================================================================
  // MARK: Presence and typing
  // ==========================================================================

  private handlePresenceUpdate(context: EventContext, request: ChatPresenceUpdateRequest): ProcessResult {
    if (!this.state.sessions[request.sessionId]) {
      return rejectResult(this.state, ['Session not found for presence update.']);
    }

    const now = context.now;
    let nextState = cloneState(this.state) as Mutable<ChatState>;

    nextState = upsertPresence(nextState, request, now);

    const telemetry = [
      createTelemetry(this.ports, {
        eventName: 'presence_updated',
        roomId: request.roomId,
        sessionId: request.sessionId,
        userId: this.state.sessions[request.sessionId]?.identity.userId ?? null,
        createdAt: now,
        payload: {
          mode: request.mode,
          spectating: request.spectating,
          visibleToRoom: request.visibleToRoom,
        },
      }),
    ];

    return {
      state: nextState,
      appendedMessages: [],
      redactedMessageIds: [],
      replayArtifacts: [],
      proofEdges: [],
      telemetry,
      learningProfilesTouched: [],
      inferenceSnapshots: [],
      touchedRoomIds: [request.roomId],
      touchedSessionIds: [request.sessionId],
      rejectionReasons: [],
      policy: null,
    };
  }

  private handleTypingUpdate(context: EventContext, request: ChatTypingUpdateRequest): ProcessResult {
    const room = this.state.rooms[request.roomId];
    const session = this.state.sessions[request.sessionId];

    if (!room) {
      return rejectResult(this.state, ['Room not found for typing update.']);
    }

    if (!session) {
      return rejectResult(this.state, ['Session not found for typing update.']);
    }

    if (!room.allowedVisibleChannels.includes(request.channelId)) {
      return rejectResult(this.state, ['Channel is not allowed in this room.']);
    }

    const now = context.now;
    let nextState = cloneState(this.state) as Mutable<ChatState>;
    nextState = pruneExpiredTyping(nextState, now);
    nextState = upsertTyping(nextState, request, now, this.runtime.ratePolicy.typingHeartbeatWindowMs);

    const telemetry = [
      createTelemetry(this.ports, {
        eventName: 'typing_updated',
        roomId: request.roomId,
        sessionId: request.sessionId,
        userId: session.identity.userId,
        createdAt: now,
        payload: {
          channelId: request.channelId,
          mode: request.mode,
        },
      }),
    ];

    return {
      state: nextState,
      appendedMessages: [],
      redactedMessageIds: [],
      replayArtifacts: [],
      proofEdges: [],
      telemetry,
      learningProfilesTouched: [],
      inferenceSnapshots: [],
      touchedRoomIds: [request.roomId],
      touchedSessionIds: [request.sessionId],
      rejectionReasons: [],
      policy: null,
    };
  }

  // ==========================================================================
  // MARK: Player message submission and authoritative mutation
  // ==========================================================================

  private handlePlayerMessage(
    context: EventContext,
    request: ChatPlayerMessageSubmitRequest,
  ): ProcessResult {
    const room = this.state.rooms[request.roomId];
    const session = this.state.sessions[request.sessionId];

    if (!room) {
      return rejectResult(this.state, ['Room does not exist.']);
    }

    if (!session) {
      return rejectResult(this.state, ['Session does not exist.']);
    }

    const policy = this.evaluatePolicy({
      room,
      session,
      event: context.event,
      request,
      now: context.now,
    });

    if (
      policy.channel.allowed === false ||
      policy.rate.outcome === 'LOCK' ||
      policy.moderation.outcome === 'REJECT' ||
      policy.command.accepted === false && policy.command.commandName !== null
    ) {
      const rejectionReasons = [
        ...policy.channel.reasons,
        ...policy.rate.reasons,
        ...policy.moderation.reasons,
        ...policy.command.reasons,
      ].filter(Boolean);

      const telemetry = [
        createTelemetry(this.ports, {
          eventName: 'message_rejected',
          roomId: request.roomId,
          sessionId: request.sessionId,
          userId: session.identity.userId,
          createdAt: context.now,
          payload: {
            channelId: request.channelId,
            reasons: rejectionReasons,
          },
        }),
      ];

      let rejectedState = cloneState(this.state);
      rejectedState = setPendingRequestRejected(rejectedState, request, context.now);

      return {
        state: rejectedState,
        appendedMessages: [],
        redactedMessageIds: [],
        replayArtifacts: [],
        proofEdges: [],
        telemetry,
        learningProfilesTouched: [],
        inferenceSnapshots: [],
        touchedRoomIds: [request.roomId],
        touchedSessionIds: [request.sessionId],
        rejectionReasons,
        policy,
      };
    }

    let nextState = cloneState(this.state) as Mutable<ChatState>;
    nextState = pruneExpiredTyping(nextState, context.now);

    const effectiveText = policy.moderation.rewrittenText ?? request.text;
    const playerMessage = this.createPlayerMessage({
      room,
      session,
      channelId: policy.channel.effectiveChannelId,
      requestId: request.requestId,
      text: effectiveText,
      moderationOutcome: policy.moderation.outcome,
      moderationReasons: policy.moderation.reasons,
      rateOutcome: policy.rate.outcome,
      commandName: policy.command.commandName,
      shadowOnly: policy.moderation.shadowOnly,
      wasMasked: policy.moderation.outcome === 'MASK',
      wasRewritten: policy.moderation.outcome === 'REWRITE',
      now: context.now,
      causeEventId: context.event.eventId,
    });

    nextState = appendMessage(nextState, playerMessage);
    nextState = clearTypingForRoom(nextState, request.roomId, request.sessionId);
    nextState = storePendingRequest(nextState, {
      request,
      messageId: playerMessage.id,
      now: context.now,
    });

    const replayArtifacts = this.createReplayArtifacts({
      room,
      eventId: context.event.eventId,
      now: context.now,
      label: 'Player message accepted',
    }, nextState);

    const proofEdges: ChatProofEdge[] = [
      createProofEdge(this.ports, {
        roomId: room.roomId,
        fromEventId: context.event.eventId,
        toMessageId: playerMessage.id,
        edgeType: 'EVENT_TO_MESSAGE',
        metadata: {
          requestId: request.requestId,
          channelId: policy.channel.effectiveChannelId,
        },
      }),
    ];

    const telemetry: ChatTelemetryEnvelope[] = [
      createTelemetry(this.ports, {
        eventName: policy.moderation.outcome === 'SHADOW_ONLY'
          ? 'message_suppressed'
          : 'message_sent',
        roomId: room.roomId,
        sessionId: session.identity.sessionId,
        userId: session.identity.userId,
        createdAt: context.now,
        payload: {
          channelId: request.channelId,
          effectiveChannelId: policy.channel.effectiveChannelId,
          moderationOutcome: policy.moderation.outcome,
          textLength: effectiveText.length,
        },
      }),
    ];

    const learning = this.updateLearningForPlayerMessage(nextState, room, session, playerMessage, context.now);
    nextState = learning.state;

    if (learning.inference) {
      proofEdges.push(
        createProofEdge(this.ports, {
          roomId: room.roomId,
          fromMessageId: playerMessage.id,
          toInferenceId: learning.inference.inferenceId,
          edgeType: 'MESSAGE_TO_INFERENCE',
          metadata: { source: learning.inference.source },
        }),
      );
    }

    const reactionPlan = this.deriveReactionPlan({
      room,
      session,
      state: nextState,
      now: context.now,
      acceptedMessage: playerMessage,
    });

    const reaction = this.applyReactionPlan({
      room,
      state: nextState,
      plan: reactionPlan,
      now: context.now,
      causeEventId: context.event.eventId,
      parentMessageId: playerMessage.id,
    });

    nextState = reaction.state;

    for (const artifact of replayArtifacts) {
      proofEdges.push(
        createProofEdge(this.ports, {
          roomId: room.roomId,
          fromMessageId: playerMessage.id,
          toReplayId: artifact.id,
          edgeType: 'MESSAGE_TO_REPLAY',
          metadata: { label: artifact.label },
        }),
      );
    }

    const allAppended = [
      playerMessage,
      ...reaction.appendedMessages,
    ];

    return {
      state: nextState,
      appendedMessages: allAppended,
      redactedMessageIds: [],
      replayArtifacts: [
        ...replayArtifacts,
        ...reaction.replayArtifacts,
      ],
      proofEdges: [
        ...proofEdges,
        ...reaction.proofEdges,
      ],
      telemetry: [
        ...telemetry,
        ...learning.telemetry,
        ...reaction.telemetry,
      ],
      learningProfilesTouched: learning.learningProfilesTouched,
      inferenceSnapshots: learning.inference ? [learning.inference] : [],
      touchedRoomIds: [room.roomId],
      touchedSessionIds: [session.identity.sessionId],
      rejectionReasons: [],
      policy,
    };
  }

  // ==========================================================================
  // MARK: External signal ingestion and orchestration
  // ==========================================================================

  private handleSignal(context: EventContext, signal: ChatSignalEnvelope): ProcessResult {
    if (!signal.roomId) {
      return rejectResult(this.state, ['Signal arrived without room id.']);
    }

    const room = this.state.rooms[signal.roomId];
    if (!room) {
      return rejectResult(this.state, ['Signal target room does not exist.']);
    }

    let nextState = cloneState(this.state) as Mutable<ChatState>;
    const telemetry: ChatTelemetryEnvelope[] = [];
    const proofEdges: ChatProofEdge[] = [];
    const replayArtifacts: ChatReplayArtifact[] = [];
    const appendedMessages: ChatMessage[] = [];
    const learningProfilesTouched: any[] = [];
    const inferenceSnapshots: ChatInferenceSnapshot[] = [];

    const signalSummary = describeSignal(signal);

    if (signalSummary.visibleSystemLine) {
      const systemMessage = this.createSystemMessage({
        roomId: room.roomId,
        channelId: signalSummary.channelId,
        text: signalSummary.visibleSystemLine,
        now: context.now,
        tags: ['signal', signal.type.toLowerCase()],
        causeEventId: context.event.eventId,
      });

      nextState = appendMessage(nextState, systemMessage);
      appendedMessages.push(systemMessage);

      proofEdges.push(
        createProofEdge(this.ports, {
          roomId: room.roomId,
          fromEventId: context.event.eventId,
          toMessageId: systemMessage.id,
          edgeType: 'EVENT_TO_MESSAGE',
          metadata: { signalType: signal.type },
        }),
      );

      replayArtifacts.push(
        ...this.createReplayArtifacts({
          room,
          eventId: context.event.eventId,
          now: context.now,
          label: `${signal.type} signal`,
        }, nextState),
      );
    }

    telemetry.push(
      createTelemetry(this.ports, {
        eventName: signalSummary.telemetryName,
        roomId: room.roomId,
        sessionId: null,
        userId: null,
        createdAt: context.now,
        payload: {
          signalType: signal.type,
          channelId: signalSummary.channelId,
        },
      }),
    );

    const derivedPlan = this.deriveSignalReactionPlan({
      room,
      state: nextState,
      signal,
      now: context.now,
    });

    const reaction = this.applyReactionPlan({
      room,
      state: nextState,
      plan: derivedPlan,
      now: context.now,
      causeEventId: context.event.eventId,
      parentMessageId: appendedMessages[0]?.id ?? null,
    });

    nextState = reaction.state;

    return {
      state: nextState,
      appendedMessages: [...appendedMessages, ...reaction.appendedMessages],
      redactedMessageIds: [],
      replayArtifacts: [...replayArtifacts, ...reaction.replayArtifacts],
      proofEdges: [...proofEdges, ...reaction.proofEdges],
      telemetry: [...telemetry, ...reaction.telemetry],
      learningProfilesTouched,
      inferenceSnapshots,
      touchedRoomIds: [room.roomId],
      touchedSessionIds: [],
      rejectionReasons: [],
      policy: null,
    };
  }

  // ==========================================================================
  // MARK: Maintenance loop
  // ==========================================================================

  private handleMaintenanceTick(context: EventContext, reason: string): ProcessResult {
    const now = context.now;
    let nextState = cloneState(this.state) as Mutable<ChatState>;

    nextState = pruneExpiredTyping(nextState, now);
    nextState = resolveExpiredSilences(nextState, now);
    nextState = resolveExpiredInvasions(nextState, now);
    nextState = flushDueReveals(nextState, now);

    const touchedRoomIds = collectTouchedRooms(nextState);

    const telemetry = touchedRoomIds.length
      ? [
          createTelemetry(this.ports, {
            eventName: 'learning_updated',
            roomId: null,
            sessionId: null,
            userId: null,
            createdAt: now,
            payload: { reason },
          }),
        ]
      : [];

    return {
      state: nextState,
      appendedMessages: [],
      redactedMessageIds: [],
      replayArtifacts: [],
      proofEdges: [],
      telemetry,
      learningProfilesTouched: [],
      inferenceSnapshots: [],
      touchedRoomIds,
      touchedSessionIds: [],
      rejectionReasons: [],
      policy: null,
    };
  }

  private startMaintenanceLoop(): void {
    const schedule = () => {
      this.maintenanceTimer = this.ports.clock.setTimeout(async () => {
        try {
          await this.tick('scheduled_maintenance');
        } catch (error) {
          this.ports.logger.error('chat.engine.maintenance_failed', {
            error: error instanceof Error ? error.message : 'unknown',
          });
        } finally {
          schedule();
        }
      }, 2_000);
    };

    schedule();
  }

  // ==========================================================================
  // MARK: Policy evaluation
  // ==========================================================================

  private evaluatePolicy(args: {
    room: ChatRoomState;
    session: ChatSessionState;
    event: ChatNormalizedInput;
    request: ChatPlayerMessageSubmitRequest;
    now: UnixMs;
  }): ChatPolicyBundle {
    return {
      rate: this.evaluateRatePolicy(args),
      moderation: this.evaluateModerationPolicy(args),
      channel: this.evaluateChannelPolicy(args),
      command: this.evaluateCommand(args),
    };
  }

  private evaluateRatePolicy(args: {
    room: ChatRoomState;
    session: ChatSessionState;
    request: ChatPlayerMessageSubmitRequest;
    now: UnixMs;
  }): ChatRateDecision {
    const { request, room, session, now } = args;
    const transcript = this.state.transcript.byRoom[room.roomId] ?? [];

    if (session.mutedUntil && session.mutedUntil > now) {
      return {
        outcome: 'LOCK',
        retryAfterMs: Number(session.mutedUntil) - Number(now),
        reasons: ['Session is muted.'],
      };
    }

    const recentBySession = transcript.filter((entry) => {
      return (
        entry.message.attribution.authorSessionId === session.identity.sessionId &&
        Number(now) - Number(entry.message.createdAt) <= 60_000
      );
    });

    const recentBySecond = recentBySession.filter((entry) => {
      return Number(now) - Number(entry.message.createdAt) <= 1_000;
    });

    if (recentBySecond.length >= this.runtime.ratePolicy.perSecondBurstLimit) {
      return {
        outcome: 'THROTTLE',
        retryAfterMs: 1_000,
        reasons: ['Per-second burst limit exceeded.'],
      };
    }

    if (recentBySession.length >= this.runtime.ratePolicy.perMinuteLimit) {
      return {
        outcome: 'THROTTLE',
        retryAfterMs: 15_000,
        reasons: ['Per-minute message limit exceeded.'],
      };
    }

    const duplicateCount = recentBySession.filter((entry) => {
      return sanitizeText(entry.message.plainText) === sanitizeText(request.text);
    }).length;

    if (duplicateCount >= this.runtime.ratePolicy.identicalMessageMaxCount) {
      return {
        outcome: 'DEFER',
        retryAfterMs: this.runtime.ratePolicy.identicalMessageWindowMs,
        reasons: ['Identical message repetition exceeded.'],
      };
    }

    return {
      outcome: 'ALLOW',
      retryAfterMs: 0,
      reasons: [],
    };
  }

  private evaluateModerationPolicy(args: {
    request: ChatPlayerMessageSubmitRequest;
    now: UnixMs;
  }): ChatModerationDecision {
    const { request } = args;
    let text = request.text.trim();
    const reasons: string[] = [];
    const maskedLexemes: string[] = [];

    if (text.length === 0) {
      return {
        outcome: 'REJECT',
        reasons: ['Message is empty.'],
        rewrittenText: null,
        maskedLexemes,
        shadowOnly: false,
      };
    }

    if (text.length > this.runtime.moderationPolicy.maxCharactersPerMessage) {
      return {
        outcome: 'REJECT',
        reasons: ['Message exceeds maximum character limit.'],
        rewrittenText: null,
        maskedLexemes,
        shadowOnly: false,
      };
    }

    const lineCount = text.split(/\r?\n/g).length;
    if (lineCount > this.runtime.moderationPolicy.maxLinesPerMessage) {
      return {
        outcome: 'REJECT',
        reasons: ['Message exceeds maximum line count.'],
        rewrittenText: null,
        maskedLexemes,
        shadowOnly: false,
      };
    }

    const lowered = text.toLowerCase();
    for (const banned of this.runtime.moderationPolicy.rejectBannedLexemes) {
      if (lowered.includes(banned.toLowerCase())) {
        return {
          outcome: 'REJECT',
          reasons: [`Rejected lexeme detected: ${banned}`],
          rewrittenText: null,
          maskedLexemes,
          shadowOnly: false,
        };
      }
    }

    for (const masked of this.runtime.moderationPolicy.maskBannedLexemes) {
      if (lowered.includes(masked.toLowerCase())) {
        text = replaceCaseInsensitiveWord(text, masked, '█'.repeat(masked.length));
        maskedLexemes.push(masked);
      }
    }

    const emojiRun = longestEmojiLikeRun(text);
    if (emojiRun > this.runtime.moderationPolicy.maxConsecutiveEmojiRuns) {
      reasons.push('Emoji run normalized.');
      text = normalizeEmojiRun(text);
    }

    const suspiciousUrlCount = (text.match(/https?:\/\//g) ?? []).length;
    if (suspiciousUrlCount > this.runtime.moderationPolicy.maxSuspiciousUrlCount) {
      return {
        outcome: 'SHADOW_ONLY',
        reasons: ['Suspicious link count exceeded.'],
        rewrittenText: text,
        maskedLexemes,
        shadowOnly: true,
      };
    }

    const upperRatio = text.length > 0 ? countUppercase(text) / Math.max(1, countLetters(text)) : 0;
    if (upperRatio >= this.runtime.moderationPolicy.rewriteAllCapsThreshold && countLetters(text) >= 8) {
      reasons.push('All-caps normalized.');
      text = normalizeSentenceCase(text);
      return {
        outcome: maskedLexemes.length > 0 ? 'REWRITE' : 'REWRITE',
        reasons,
        rewrittenText: text,
        maskedLexemes,
        shadowOnly: false,
      };
    }

    if (maskedLexemes.length > 0) {
      reasons.push('Masked unsafe lexemes.');
      return {
        outcome: 'MASK',
        reasons,
        rewrittenText: text,
        maskedLexemes,
        shadowOnly: false,
      };
    }

    return {
      outcome: 'ALLOW',
      reasons,
      rewrittenText: text,
      maskedLexemes,
      shadowOnly: false,
    };
  }

  private evaluateChannelPolicy(args: {
    room: ChatRoomState;
    request: ChatPlayerMessageSubmitRequest;
  }): ChatChannelDecision {
    const { room, request } = args;

    if (!room.allowedVisibleChannels.includes(request.channelId)) {
      return {
        allowed: false,
        reasons: ['Requested channel is not enabled for this room.'],
        effectiveChannelId: room.activeVisibleChannel,
      };
    }

    const descriptor = CHAT_CHANNEL_DESCRIPTORS[request.channelId];
    if (!descriptor.supportsComposer) {
      return {
        allowed: false,
        reasons: ['Requested channel does not support player composition.'],
        effectiveChannelId: room.activeVisibleChannel,
      };
    }

    return {
      allowed: true,
      reasons: [],
      effectiveChannelId: request.channelId,
    };
  }

  private evaluateCommand(args: {
    request: ChatPlayerMessageSubmitRequest;
    room: ChatRoomState;
  }): ChatPolicyBundle['command'] {
    const text = args.request.text.trim();

    if (!text.startsWith('/')) {
      return {
        accepted: true,
        commandName: null,
        reasons: [],
        generatedSystemMessages: [],
        shadowWrites: [],
      };
    }

    if (!this.runtime.moderationPolicy.allowSlashCommands) {
      return {
        accepted: false,
        commandName: 'disabled',
        reasons: ['Slash commands are disabled.'],
        generatedSystemMessages: [],
        shadowWrites: [],
      };
    }

    const [commandNameRaw, ...rest] = text.slice(1).split(/\s+/g);
    const commandName = commandNameRaw.toLowerCase();
    const argText = rest.join(' ');

    switch (commandName) {
      case 'help':
        return {
          accepted: true,
          commandName,
          reasons: [],
          generatedSystemMessages: [
            'Available commands: /help, /clear, /mood, /focus',
          ],
          shadowWrites: [],
        };

      case 'clear':
        return {
          accepted: true,
          commandName,
          reasons: [],
          generatedSystemMessages: [
            `Transcript drawer can clear local mirrors. Backend transcript remains authoritative for ${args.room.title}.`,
          ],
          shadowWrites: [],
        };

      case 'mood':
        return {
          accepted: true,
          commandName,
          reasons: [],
          generatedSystemMessages: [
            `Current room mood: ${args.room.stageMood}.`,
          ],
          shadowWrites: [`mood:${args.room.stageMood}`],
        };

      case 'focus':
        return {
          accepted: true,
          commandName,
          reasons: [],
          generatedSystemMessages: [
            argText.length > 0
              ? `Focus intent recorded: ${argText}.`
              : 'Focus intent recorded.',
          ],
          shadowWrites: [argText.length > 0 ? `focus:${argText}` : 'focus:default'],
        };

      default:
        return {
          accepted: false,
          commandName,
          reasons: [`Unknown command: /${commandName}`],
          generatedSystemMessages: [],
          shadowWrites: [],
        };
    }
  }

  // ==========================================================================
  // MARK: Learning and inference
  // ==========================================================================

  private updateLearningForPlayerMessage(
    state: ChatState,
    room: ChatRoomState,
    session: ChatSessionState,
    message: ChatMessage,
    now: UnixMs,
  ): {
    readonly state: ChatState;
    readonly telemetry: readonly ChatTelemetryEnvelope[];
    readonly learningProfilesTouched: readonly any[];
    readonly inference: ChatInferenceSnapshot | null;
  } {
    if (!this.runtime.learningPolicy.enabled) {
      return {
        state,
        telemetry: [],
        learningProfilesTouched: [],
        inference: null,
      };
    }

    const userId = session.identity.userId;
    const existing = state.learningProfiles[userId] ?? createColdStartProfile(userId, now);

    const roomEntries = state.transcript.byRoom[room.roomId] ?? [];
    const outboundCount = roomEntries.filter((entry) => entry.message.attribution.authorUserId === userId).length;
    const inboundHaters = roomEntries.filter((entry) => entry.message.attribution.npcRole === 'HATER').length;
    const inboundHelpers = roomEntries.filter((entry) => entry.message.attribution.npcRole === 'HELPER').length;

    const confidenceDelta = Math.min(0.06, Math.max(-0.04, 0.02 + (message.policy.shadowOnly ? -0.03 : 0.01)));
    const frustrationDelta = message.policy.shadowOnly ? 0.05 : -0.01;
    const embarrassmentDelta = room.stageMood === 'HOSTILE' ? 0.02 : 0.0;

    const updated: ChatLearningProfile = {
      ...existing,
      updatedAt: now,
      coldStart: false,
      engagementBaseline01: clamp01(Number(existing.engagementBaseline01) * 0.84 + 0.16),
      helperReceptivity01: clamp01(Number(existing.helperReceptivity01) * 0.92 + (inboundHelpers > 0 ? 0.05 : 0.02)),
      haterSusceptibility01: clamp01(Number(existing.haterSusceptibility01) * 0.90 + (inboundHaters > outboundCount ? 0.05 : 0.01)),
      negotiationAggression01: clamp01(
        Number(existing.negotiationAggression01) * 0.9 + (room.roomKind === 'DEAL_ROOM' ? 0.08 : 0.02),
      ),
      channelAffinity: {
        ...existing.channelAffinity,
        [room.activeVisibleChannel]: clamp01(
          Number(existing.channelAffinity[room.activeVisibleChannel]) * 0.82 + 0.18,
        ),
      },
      affect: {
        confidence01: clamp01(Number(existing.affect.confidence01) + confidenceDelta),
        frustration01: clamp01(Number(existing.affect.frustration01) + frustrationDelta),
        intimidation01: clamp01(
          Number(existing.affect.intimidation01) + (room.stageMood === 'HOSTILE' ? 0.03 : 0.00),
        ),
        attachment01: clamp01(Number(existing.affect.attachment01) + 0.01),
        curiosity01: clamp01(Number(existing.affect.curiosity01) + 0.01),
        embarrassment01: clamp01(Number(existing.affect.embarrassment01) + embarrassmentDelta),
        relief01: clamp01(Number(existing.affect.relief01) + (message.policy.shadowOnly ? -0.01 : 0.02)),
      },
      churnRisk01: clamp01(
        0.18
          + Number(existing.affect.frustration01) * 0.28
          + Number(existing.affect.embarrassment01) * 0.16
          + (message.policy.shadowOnly ? 0.08 : 0.0),
      ),
      rescueHistoryCount: existing.rescueHistoryCount,
      salienceAnchorIds: uniqueIds([
        ...existing.salienceAnchorIds,
        createSalienceAnchorId(this.ports, room.roomId, message.id),
      ]),
    };

    const inference: ChatInferenceSnapshot = {
      inferenceId: this.ports.ids.inferenceId('inf'),
      source: 'HEURISTIC',
      generatedAt: now,
      userId,
      roomId: room.roomId,
      engagement01: clamp01(Number(updated.engagementBaseline01) + 0.05),
      helperTiming01: clamp01(
        Number(updated.affect.frustration01) * 0.45 +
          Number(updated.affect.intimidation01) * 0.25 +
          Number(updated.churnRisk01) * 0.30,
      ),
      haterTargeting01: clamp01(
        Number(updated.affect.confidence01) * 0.20 +
          Number(updated.affect.embarrassment01) * 0.20 +
          Number(updated.haterSusceptibility01) * 0.60,
      ),
      channelAffinity: updated.channelAffinity,
      toxicityRisk01: clamp01(message.policy.shadowOnly ? 0.65 : 0.12),
      churnRisk01: updated.churnRisk01,
      interventionPolicy: deriveInterventionPolicy(updated),
    };

    const nextState: ChatState = {
      ...state,
      learningProfiles: {
        ...state.learningProfiles,
        [userId]: updated,
      },
      inferenceSnapshots: {
        ...state.inferenceSnapshots,
        [inference.inferenceId]: inference,
      },
    };

    const telemetry = [
      createTelemetry(this.ports, {
        eventName: 'learning_updated',
        roomId: room.roomId,
        sessionId: session.identity.sessionId,
        userId,
        createdAt: now,
        payload: {
          churnRisk01: Number(updated.churnRisk01),
          helperTiming01: Number(inference.helperTiming01),
          haterTargeting01: Number(inference.haterTargeting01),
        },
      }),
    ];

    return {
      state: nextState,
      telemetry,
      learningProfilesTouched: [userId],
      inference,
    };
  }

  // ==========================================================================
  // MARK: Reaction planning and application
  // ==========================================================================

  private deriveReactionPlan(args: {
    room: ChatRoomState;
    session: ChatSessionState;
    state: ChatState;
    now: UnixMs;
    acceptedMessage: ChatMessage;
  }): DerivedReactionPlan {
    const { room, state, now, acceptedMessage } = args;

    const entries = state.transcript.byRoom[room.roomId] ?? [];
    const profile = acceptedMessage.attribution.authorUserId
      ? state.learningProfiles[acceptedMessage.attribution.authorUserId]
      : null;

    const recentHostility = entries.slice(-10).filter((entry) => entry.message.attribution.npcRole === 'HATER').length;
    const currentHeat = Number(state.audienceHeatByRoom[room.roomId]?.heat01 ?? clamp01(0.25));

    const helperNeeded = profile
      ? Number(profile.affect.frustration01) > 0.38 || Number(profile.churnRisk01) > 0.46
      : false;

    const haterWindow = room.stageMood === 'HOSTILE' || currentHeat > 0.55 || recentHostility === 0;
    const helperCandidates = helperNeeded ? pickHelperCandidates(profile) : [];
    const haterCandidates = haterWindow ? pickHaterCandidates(room.stageMood) : [];
    const ambientCandidates = currentHeat > 0.4 || room.roomKind === 'GLOBAL'
      ? [PERSONAS.ambient_floor.personaId]
      : [];

    const rescue: ChatRescueDecision | null = helperNeeded
      ? {
          triggered: true,
          urgency: Number(profile?.churnRisk01 ?? 0) > 0.6 ? 'HARD' : 'MEDIUM',
          reason: 'Player profile crossed rescue threshold.',
          helperPersonaId: helperCandidates[0] ?? null,
          shouldOpenRecoveryWindow: Number(profile?.churnRisk01 ?? 0) > 0.54,
        }
      : null;

    const silence: ChatSilenceDecision | null = helperNeeded && Number(profile?.affect.embarrassment01 ?? 0) > 0.3
      ? {
          active: true,
          startedAt: now,
          endsAt: asUnixMs(Number(now) + 1_800),
          reason: 'Allow message landing before helper interruption.',
        }
      : null;

    const invasion: ChatInvasionState | null = haterCandidates.length > 0 && currentHeat > 0.62 && canOpenInvasion(state, room.roomId, now, this.runtime)
      ? {
          invasionId: this.ports.ids.invasionId('inv'),
          roomId: room.roomId,
          channelId: 'GLOBAL' as ChatChannelId,
          status: 'ACTIVE' as const,
          kind: 'HATER_RAID' as const,
          openedAt: now,
          closesAt: asUnixMs(Number(now) + this.runtime.invasionPolicy.defaultDurationMs),
          primedInShadow: false,
        }
      : null;

    return {
      helperCandidates,
      haterCandidates,
      ambientCandidates,
      rescue,
      silence,
      invasion,
      roomMood: deriveMoodFromMessage(acceptedMessage),
      heatDelta: messageHeatDelta(acceptedMessage),
    };
  }

  private deriveSignalReactionPlan(args: {
    room: ChatRoomState;
    state: ChatState;
    signal: ChatSignalEnvelope;
    now: UnixMs;
  }): DerivedReactionPlan {
    const { room, state, signal, now } = args;

    let helperCandidates: ChatPersonaId[] = [];
    let haterCandidates: ChatPersonaId[] = [];
    let ambientCandidates: ChatPersonaId[] = [];
    let rescue: ChatRescueDecision | null = null;
    let silence: ChatSilenceDecision | null = null;
    let invasion: ChatInvasionState | null = null;
    let roomMood: ChatRoomStageMood | null = null;
    let heatDelta = 0;

    if (signal.type === 'BATTLE' && signal.battle) {
      const battle = signal.battle;
      heatDelta += Number(battle.hostileMomentum) / 160;
      roomMood = battle.pressureTier === 'CRITICAL' ? 'HOSTILE' : battle.pressureTier === 'HIGH' ? 'TENSE' : null;

      if (battle.rescueWindowOpen || Number(battle.shieldIntegrity01) < 0.28) {
        helperCandidates = pickHelperCandidates(null);
        rescue = {
          triggered: true,
          urgency: battle.pressureTier === 'CRITICAL' ? 'CRITICAL' : 'MEDIUM',
          reason: 'Battle rescue window opened.',
          helperPersonaId: helperCandidates[0] ?? null,
          shouldOpenRecoveryWindow: battle.pressureTier === 'CRITICAL',
        };
      }

      if (battle.activeBotId) {
        haterCandidates = mapBotToPersonaIds(battle.activeBotId);
      }

      if (battle.pressureTier === 'CRITICAL' && canOpenInvasion(state, room.roomId, now, this.runtime)) {
        invasion = {
          invasionId: this.ports.ids.invasionId('inv'),
          roomId: room.roomId,
          channelId: 'GLOBAL',
          status: 'ACTIVE',
          kind: 'LIQUIDATOR_SWEEP',
          openedAt: now,
          closesAt: asUnixMs(Number(now) + this.runtime.invasionPolicy.defaultDurationMs),
          primedInShadow: false,
        };
      }

      ambientCandidates = [PERSONAS.ambient_floor.personaId];
    }

    if (signal.type === 'RUN' && signal.run) {
      if (signal.run.bankruptcyWarning) {
        roomMood = 'MOURNFUL';
        helperCandidates = pickHelperCandidates(null);
        rescue = {
          triggered: true,
          urgency: 'HARD',
          reason: 'Run broadcast bankruptcy warning.',
          helperPersonaId: helperCandidates[0] ?? null,
          shouldOpenRecoveryWindow: true,
        };
        silence = {
          active: true,
          startedAt: now,
          endsAt: asUnixMs(Number(now) + 1200),
          reason: 'Hold the room before rescue messaging.',
        };
      }

      if (signal.run.nearSovereignty) {
        ambientCandidates = [PERSONAS.ambient_floor.personaId];
        heatDelta += 0.18;
        roomMood = 'CEREMONIAL';
      }
    }

    if (signal.type === 'ECONOMY' && signal.economy) {
      if (Number(signal.economy.overpayRisk01) > 0.62 || Number(signal.economy.bluffRisk01) > 0.62) {
        haterCandidates = [PERSONAS.hater_manipulator.personaId];
        roomMood = 'PREDATORY';
      }
      if (Number(signal.economy.liquidityStress01) > 0.55) {
        haterCandidates = uniqueIds<ChatPersonaId>([...haterCandidates, PERSONAS.hater_liquidator.personaId]) as ChatPersonaId[];
      }
      ambientCandidates = [PERSONAS.ambient_floor.personaId];
    }

    if (signal.type === 'LIVEOPS' && signal.liveops) {
      heatDelta += Number(signal.liveops.heatMultiplier01) * 0.25;
      if (signal.liveops.haterRaidActive && canOpenInvasion(state, room.roomId, now, this.runtime)) {
        invasion = {
          invasionId: this.ports.ids.invasionId('inv'),
          roomId: room.roomId,
          channelId: 'GLOBAL',
          status: 'ACTIVE',
          kind: 'HATER_RAID',
          openedAt: now,
          closesAt: asUnixMs(Number(now) + this.runtime.invasionPolicy.defaultDurationMs),
          primedInShadow: false,
        };
      }
      if (signal.liveops.helperBlackout) {
        silence = {
          active: true,
          startedAt: now,
          endsAt: asUnixMs(Number(now) + 3_500),
          reason: 'LiveOps helper blackout.',
        };
      }
      ambientCandidates = [PERSONAS.ambient_floor.personaId];
    }

    if (signal.type === 'MULTIPLAYER' && signal.multiplayer) {
      if (signal.multiplayer.roomMemberCount > 3) {
        heatDelta += 0.08;
        ambientCandidates = [PERSONAS.ambient_floor.personaId];
      }
    }

    return {
      helperCandidates,
      haterCandidates,
      ambientCandidates,
      rescue,
      silence,
      invasion,
      roomMood,
      heatDelta,
    };
  }

  private applyReactionPlan(args: {
    room: ChatRoomState;
    state: ChatState;
    plan: DerivedReactionPlan;
    now: UnixMs;
    causeEventId: ChatEventId;
    parentMessageId: any | null;
  }): {
    readonly state: ChatState;
    readonly appendedMessages: readonly ChatMessage[];
    readonly replayArtifacts: readonly ChatReplayArtifact[];
    readonly proofEdges: readonly ChatProofEdge[];
    readonly telemetry: readonly ChatTelemetryEnvelope[];
  } {
    const { room, now, causeEventId, parentMessageId, plan } = args;
    let nextState = cloneState(args.state) as Mutable<ChatState>;

    const appendedMessages: ChatMessage[] = [];
    const replayArtifacts: ChatReplayArtifact[] = [];
    const proofEdges: ChatProofEdge[] = [];
    const telemetry: ChatTelemetryEnvelope[] = [];

    if (plan.roomMood) {
      nextState.rooms = {
        ...nextState.rooms,
        [room.roomId]: {
          ...nextState.rooms[room.roomId],
          stageMood: plan.roomMood,
          lastActivityAt: now,
        },
      };
    }

    if (plan.heatDelta !== 0) {
      nextState = applyHeatDelta(nextState, room.roomId, room.activeVisibleChannel, plan.heatDelta, now);
    }

    if (plan.silence?.active) {
      nextState.silencesByRoom = {
        ...nextState.silencesByRoom,
        [room.roomId]: plan.silence,
      };
    }

    if (plan.invasion) {
      nextState.activeInvasions = {
        ...nextState.activeInvasions,
        [plan.invasion.invasionId]: plan.invasion,
      };

      telemetry.push(
        createTelemetry(this.ports, {
          eventName: 'invasion_opened',
          roomId: room.roomId,
          sessionId: null,
          userId: null,
          createdAt: now,
          payload: {
            kind: plan.invasion.kind,
            channelId: plan.invasion.channelId,
          },
        }),
      );

      const invasionMessage = this.createSystemMessage({
        roomId: room.roomId,
        channelId: 'GLOBAL',
        text: invasionAnnouncement(plan.invasion.kind),
        now,
        tags: ['invasion', plan.invasion.kind.toLowerCase()],
        causeEventId,
      });

      nextState = appendMessage(nextState, invasionMessage);
      appendedMessages.push(invasionMessage);

      proofEdges.push(
        createProofEdge(this.ports, {
          roomId: room.roomId,
          fromEventId: causeEventId,
          toMessageId: invasionMessage.id,
          edgeType: 'EVENT_TO_MESSAGE',
          metadata: { invasionId: plan.invasion.invasionId, kind: plan.invasion.kind },
        }),
      );
    }

    const silenceActive = nextState.silencesByRoom[room.roomId];
    const suppressImmediateNpc = silenceActive && Number(silenceActive.endsAt) > Number(now);

    const helperPersonaId = plan.helperCandidates[0];
    if (!suppressImmediateNpc && helperPersonaId && plan.rescue?.triggered) {
      const helperMessage = this.createNpcMessage({
        room,
        personaId: helperPersonaId,
        channelId: 'SYNDICATE',
        now: asUnixMs(Number(now) + 350),
        causeEventId,
        parentMessageId,
        text: pickHelperLine(helperPersonaId, plan.rescue.reason),
        tags: ['helper', 'rescue'],
      });

      nextState = appendMessage(nextState, helperMessage);
      appendedMessages.push(helperMessage);

      telemetry.push(
        createTelemetry(this.ports, {
          eventName: 'helper_fired',
          roomId: room.roomId,
          sessionId: null,
          userId: null,
          createdAt: now,
          payload: {
            helperPersonaId,
            urgency: plan.rescue.urgency,
            channelId: 'SYNDICATE',
          },
        }),
      );

      proofEdges.push(
        createProofEdge(this.ports, {
          roomId: room.roomId,
          fromEventId: causeEventId,
          fromMessageId: parentMessageId,
          toMessageId: helperMessage.id,
          edgeType: 'MESSAGE_TO_MESSAGE',
          metadata: {
            npcRole: 'HELPER',
            personaId: helperPersonaId,
          },
        }),
      );
    }

    const haterPersonaId = plan.haterCandidates[0];
    if (!suppressImmediateNpc && haterPersonaId) {
      const channelId: ChatChannelId = room.roomKind === 'DEAL_ROOM' ? 'DEAL_ROOM' : 'GLOBAL';
      const haterMessage = this.createNpcMessage({
        room,
        personaId: haterPersonaId,
        channelId,
        now: asUnixMs(Number(now) + 650),
        causeEventId,
        parentMessageId,
        text: pickHaterLine(haterPersonaId, room.stageMood),
        tags: ['hater', 'escalation'],
      });

      nextState = appendMessage(nextState, haterMessage);
      appendedMessages.push(haterMessage);

      telemetry.push(
        createTelemetry(this.ports, {
          eventName: 'hater_escalated',
          roomId: room.roomId,
          sessionId: null,
          userId: null,
          createdAt: now,
          payload: {
            personaId: haterPersonaId,
            channelId,
          },
        }),
      );

      proofEdges.push(
        createProofEdge(this.ports, {
          roomId: room.roomId,
          fromEventId: causeEventId,
          fromMessageId: parentMessageId,
          toMessageId: haterMessage.id,
          edgeType: 'MESSAGE_TO_MESSAGE',
          metadata: {
            npcRole: 'HATER',
            personaId: haterPersonaId,
          },
        }),
      );
    }

    const ambientPersonaId = plan.ambientCandidates[0];
    if (!suppressImmediateNpc && ambientPersonaId) {
      const ambientMessage = this.createNpcMessage({
        room,
        personaId: ambientPersonaId,
        channelId: room.activeVisibleChannel,
        now: asUnixMs(Number(now) + 900),
        causeEventId,
        parentMessageId,
        text: pickAmbientLine(ambientPersonaId),
        tags: ['ambient', 'crowd'],
      });

      nextState = appendMessage(nextState, ambientMessage);
      appendedMessages.push(ambientMessage);

      proofEdges.push(
        createProofEdge(this.ports, {
          roomId: room.roomId,
          fromEventId: causeEventId,
          fromMessageId: parentMessageId,
          toMessageId: ambientMessage.id,
          edgeType: 'MESSAGE_TO_MESSAGE',
          metadata: {
            npcRole: 'AMBIENT',
            personaId: ambientPersonaId,
          },
        }),
      );
    }

    if (appendedMessages.length > 0) {
      replayArtifacts.push(
        ...this.createReplayArtifacts({
          room,
          eventId: causeEventId,
          now,
          label: 'Reaction sequence',
        }, nextState),
      );
    }

    return {
      state: nextState,
      appendedMessages,
      replayArtifacts,
      proofEdges,
      telemetry,
    };
  }

  // ==========================================================================
  // MARK: Message creation
  // ==========================================================================

  private createPlayerMessage(args: {
    room: ChatRoomState;
    session: ChatSessionState;
    channelId: ChatChannelId;
    requestId: any;
    text: string;
    moderationOutcome: ChatModerationOutcome;
    moderationReasons: readonly string[];
    rateOutcome: ChatRateOutcome;
    commandName: string | null;
    shadowOnly: boolean;
    wasMasked: boolean;
    wasRewritten: boolean;
    now: UnixMs;
    causeEventId: ChatEventId;
  }): ChatMessage {
    const sequenceNumber = nextSequenceForRoom(this.state, args.room.roomId);
    const id = this.ports.ids.messageId('msg');

    return {
      id,
      roomId: args.room.roomId,
      channelId: args.shadowOnly ? 'SYSTEM_SHADOW' : args.channelId,
      sequenceNumber,
      createdAt: args.now,
      editedAt: null,
      deletedAt: null,
      redactedAt: null,
      bodyParts: [{ type: 'TEXT', text: args.text }],
      plainText: args.text,
      attribution: {
        sourceType: 'PLAYER',
        authorSessionId: args.session.identity.sessionId,
        authorUserId: args.session.identity.userId,
        actorId: `user:${args.session.identity.userId}`,
        displayName: args.session.identity.displayName,
        npcRole: null,
        botId: null,
      },
      policy: {
        moderationOutcome: args.moderationOutcome,
        moderationReasons: args.moderationReasons,
        rateOutcome: args.rateOutcome,
        commandName: args.commandName,
        shadowOnly: args.shadowOnly,
        wasRewritten: args.wasRewritten,
        wasMasked: args.wasMasked,
      },
      replay: {
        replayId: null,
        replayAnchorKey: null,
        sceneId: null,
        momentId: null,
        legendId: null,
      },
      learning: {
        learningTriggered: this.runtime.learningPolicy.enabled,
        affectAfterMessage: null,
        inferenceSource: 'HEURISTIC',
        inferenceId: null,
      },
      proof: {
        proofHash: this.ports.hash.hash(
          `${args.room.roomId}|${String(sequenceNumber)}|${args.session.identity.sessionId}|${args.text}|${args.causeEventId}`,
        ),
        causalParentMessageIds: [],
        causalParentEventIds: [args.causeEventId],
      },
      tags: buildTags(args.text),
      metadata: {
        requestId: args.requestId,
      },
    };
  }

  private createSystemMessage(args: {
    roomId: ChatRoomId;
    channelId: ChatChannelId;
    text: string;
    now: UnixMs;
    tags: readonly string[];
    causeEventId: ChatEventId;
  }): ChatMessage {
    const sequenceNumber = nextSequenceForRoom(this.state, args.roomId);

    return {
      id: this.ports.ids.messageId('sys'),
      roomId: args.roomId,
      channelId: args.channelId,
      sequenceNumber,
      createdAt: args.now,
      editedAt: null,
      deletedAt: null,
      redactedAt: null,
      bodyParts: [{ type: 'TEXT', text: args.text }],
      plainText: args.text,
      attribution: {
        sourceType: 'SYSTEM',
        authorSessionId: null,
        authorUserId: null,
        actorId: 'system:chat',
        displayName: 'SYSTEM',
        npcRole: null,
        botId: null,
      },
      policy: {
        moderationOutcome: 'ALLOW',
        moderationReasons: [],
        rateOutcome: 'ALLOW',
        commandName: null,
        shadowOnly: false,
        wasRewritten: false,
        wasMasked: false,
      },
      replay: {
        replayId: null,
        replayAnchorKey: null,
        sceneId: null,
        momentId: null,
        legendId: null,
      },
      learning: {
        learningTriggered: false,
        affectAfterMessage: null,
        inferenceSource: 'NONE',
        inferenceId: null,
      },
      proof: {
        proofHash: this.ports.hash.hash(
          `${args.roomId}|${String(sequenceNumber)}|system|${args.text}|${args.causeEventId}`,
        ),
        causalParentMessageIds: [],
        causalParentEventIds: [args.causeEventId],
      },
      tags: args.tags,
      metadata: {},
    };
  }

  private createNpcMessage(args: {
    room: ChatRoomState;
    personaId: ChatPersonaId;
    channelId: ChatChannelId;
    now: UnixMs;
    causeEventId: ChatEventId;
    parentMessageId: any | null;
    text: string;
    tags: readonly string[];
  }): ChatMessage {
    const persona = getPersona(args.personaId);
    const sequenceNumber = nextSequenceForRoom(this.state, args.room.roomId);
    const id = this.ports.ids.messageId('npc');

    return {
      id,
      roomId: args.room.roomId,
      channelId: args.channelId,
      sequenceNumber,
      createdAt: args.now,
      editedAt: null,
      deletedAt: null,
      redactedAt: null,
      bodyParts: [{ type: 'TEXT', text: args.text }],
      plainText: args.text,
      attribution: {
        sourceType:
          persona.role === 'HATER'
            ? 'NPC_HATER'
            : persona.role === 'HELPER'
              ? 'NPC_HELPER'
              : 'NPC_AMBIENT',
        authorSessionId: null,
        authorUserId: null,
        actorId: persona.actorId,
        displayName: persona.displayName,
        npcRole: persona.role,
        botId: persona.botId,
      },
      policy: {
        moderationOutcome: 'ALLOW',
        moderationReasons: [],
        rateOutcome: 'ALLOW',
        commandName: null,
        shadowOnly: CHAT_CHANNEL_DESCRIPTORS[args.channelId].visibleToPlayer === false,
        wasRewritten: false,
        wasMasked: false,
      },
      replay: {
        replayId: null,
        replayAnchorKey: null,
        sceneId: null,
        momentId: null,
        legendId: null,
      },
      learning: {
        learningTriggered: this.runtime.learningPolicy.enabled,
        affectAfterMessage: null,
        inferenceSource: 'HEURISTIC',
        inferenceId: null,
      },
      proof: {
        proofHash: this.ports.hash.hash(
          `${args.room.roomId}|${String(sequenceNumber)}|${persona.actorId}|${args.text}|${args.causeEventId}`,
        ),
        causalParentMessageIds: args.parentMessageId ? [args.parentMessageId] : [],
        causalParentEventIds: [args.causeEventId],
      },
      tags: args.tags,
      metadata: {
        personaId: args.personaId,
      },
    };
  }

  private createReplayArtifacts(
    args: {
      room: ChatRoomState;
      eventId: ChatEventId;
      now: UnixMs;
      label: string;
    },
    state: ChatState,
  ): readonly ChatReplayArtifact[] {
    if (!this.runtime.replayPolicy.enabled) {
      return [];
    }

    const entries = state.transcript.byRoom[args.room.roomId] ?? [];
    const start = Math.max(0, entries.length - 6);
    const end = Math.max(start, entries.length - 1);

    return [
      {
        id: this.ports.ids.replayId('rpl'),
        roomId: args.room.roomId,
        createdAt: args.now,
        eventId: args.eventId,
        range: { start, end },
        anchorKey: `${args.room.roomId}:${start}-${end}`,
        label: args.label,
        metadata: {
          stageMood: args.room.stageMood,
          activeChannel: args.room.activeVisibleChannel,
        },
      },
    ];
  }

  // ==========================================================================
  // MARK: Flushing
  // ==========================================================================

  private async flushSideEffects(result: ProcessResult): Promise<void> {
    if (result.telemetry.length > 0) {
      await this.ports.telemetry.emit(result.telemetry);
      if (this.ports.persistence.saveTelemetry) {
        await this.ports.persistence.saveTelemetry(result.telemetry);
      }
    }

    if (result.replayArtifacts.length > 0) {
      await this.ports.replay.publish(result.replayArtifacts);
      if (this.ports.persistence.saveReplay) {
        await this.ports.persistence.saveReplay(result.replayArtifacts);
      }
    }

    if (result.learningProfilesTouched.length > 0 && this.ports.learning.publishProfiles) {
      const profiles = result.learningProfilesTouched
        .map((userId) => this.state.learningProfiles[userId])
        .filter(Boolean) as ChatLearningProfile[];
      if (profiles.length > 0) {
        await this.ports.learning.publishProfiles(profiles);
        if (this.ports.persistence.saveLearningProfiles) {
          await this.ports.persistence.saveLearningProfiles(profiles);
        }
      }
    }

    if (result.inferenceSnapshots.length > 0 && this.ports.learning.publishInference) {
      await this.ports.learning.publishInference(result.inferenceSnapshots);
    }

    if (this.ports.persistence.saveState) {
      await this.ports.persistence.saveState(this.state);
    }

    const fanoutPackets = buildFanoutPackets(this.state, result.touchedRoomIds, result.telemetry);
    for (const packet of fanoutPackets) {
      await this.ports.fanout.publish(packet);
    }
  }

  private notify(tx: ChatEngineTransaction): void {
    for (const observer of this.observers) {
      observer(this.getState(), deepFreeze(tx));
    }
    for (const observer of this.eventObservers) {
      observer(deepFreeze(tx));
    }
  }
}

// ============================================================================
// MARK: State creation and cloning
// ============================================================================

function createInitialState(args: {
  runtime: ChatRuntimeConfig;
  now: UnixMs;
}): ChatState {
  return {
    version: BACKEND_CHAT_ENGINE_VERSION,
    bootedAt: args.now,
    runtime: args.runtime,
    rooms: {},
    sessions: {},
    roomSessions: {
      byRoom: {},
      bySession: {},
    },
    presence: {
      byRoom: {},
      bySession: {},
    },
    typing: {
      byRoom: {},
      bySession: {},
    },
    transcript: {
      byRoom: {},
      byMessageId: {},
      lastSequenceByRoom: {},
    },
    proofChain: {
      byRoom: {},
      byEdgeId: {},
    },
    replay: {
      byRoom: {},
      byReplayId: {},
    },
    relationships: {},
    learningProfiles: {},
    inferenceSnapshots: {},
    audienceHeatByRoom: {},
    activeInvasions: {},
    silencesByRoom: {},
    pendingReveals: [],
    pendingRequests: {},
    telemetryQueue: [],
    lastEventByRoom: {},
    lastEventAtByRoom: {},
  };
}

function cloneState(state: ChatState): ChatState {
  return {
    ...state,
    rooms: { ...state.rooms },
    sessions: { ...state.sessions },
    roomSessions: {
      byRoom: cloneReadonlyRecordOfArrays(state.roomSessions.byRoom),
      bySession: cloneReadonlyRecordOfArrays(state.roomSessions.bySession),
    },
    presence: {
      byRoom: cloneNestedPresence(state.presence.byRoom),
      bySession: cloneReadonlyRecordOfArrays(state.presence.bySession),
    },
    typing: {
      byRoom: cloneReadonlyRecordOfArrays(state.typing.byRoom),
      bySession: cloneReadonlyRecordOfArrays(state.typing.bySession),
    },
    transcript: {
      byRoom: cloneReadonlyRecordOfArrays(state.transcript.byRoom),
      byMessageId: { ...state.transcript.byMessageId },
      lastSequenceByRoom: { ...state.transcript.lastSequenceByRoom },
    },
    proofChain: {
      byRoom: cloneReadonlyRecordOfArrays(state.proofChain.byRoom),
      byEdgeId: { ...state.proofChain.byEdgeId },
    },
    replay: {
      byRoom: cloneReadonlyRecordOfArrays(state.replay.byRoom),
      byReplayId: { ...state.replay.byReplayId },
    },
    relationships: { ...state.relationships },
    learningProfiles: { ...state.learningProfiles },
    inferenceSnapshots: { ...state.inferenceSnapshots },
    audienceHeatByRoom: { ...state.audienceHeatByRoom },
    activeInvasions: { ...state.activeInvasions },
    silencesByRoom: { ...state.silencesByRoom },
    pendingReveals: [...state.pendingReveals],
    pendingRequests: { ...state.pendingRequests },
    telemetryQueue: [...state.telemetryQueue],
    lastEventByRoom: { ...state.lastEventByRoom },
    lastEventAtByRoom: { ...state.lastEventAtByRoom },
  };
}

// ============================================================================
// MARK: Room/session/presence/typing helpers
// ============================================================================

function createRoomState(args: {
  roomId: ChatRoomId;
  roomKind: ChatRoomKind;
  title: string;
  mountTarget?: string;
  requestedVisibleChannel?: ChatVisibleChannel;
  now: UnixMs;
}): ChatRoomState {
  const preset =
    args.mountTarget && args.mountTarget in CHAT_MOUNT_POLICIES
      ? CHAT_MOUNT_POLICIES[args.mountTarget as keyof typeof CHAT_MOUNT_POLICIES]
      : CHAT_MOUNT_POLICIES.BATTLE_HUD;

  const channel = args.requestedVisibleChannel && preset.allowedVisibleChannels.includes(args.requestedVisibleChannel)
    ? args.requestedVisibleChannel
    : preset.defaultVisibleChannel;

  return {
    roomId: args.roomId,
    roomKind: args.roomKind,
    title: args.title,
    createdAt: args.now,
    lastActivityAt: args.now,
    activeVisibleChannel: channel,
    allowedVisibleChannels: preset.allowedVisibleChannels,
    stageMood: preset.stageMood,
    collapsed: preset.defaultCollapsed,
    unreadByChannel: {
      GLOBAL: 0,
      SYNDICATE: 0,
      DEAL_ROOM: 0,
      LOBBY: 0,
    },
    activeSceneId: null,
    activeMomentId: null,
    activeLegendId: null,
  };
}

function upsertPresence(
  state: ChatState,
  request: ChatPresenceUpdateRequest,
  now: UnixMs,
): ChatState {
  const session = state.sessions[request.sessionId];
  const snapshot: ChatPresenceSnapshot = {
    roomId: request.roomId,
    sessionId: request.sessionId,
    mode: request.mode,
    visibleToRoom: request.visibleToRoom,
    updatedAt: now,
    spectating: request.spectating,
    actorLabel: session?.identity.displayName ?? 'UNKNOWN',
  };

  const roomPresence = {
    ...(state.presence.byRoom[request.roomId] ?? {}),
    [request.sessionId]: snapshot,
  };

  const sessionPresence = uniqueSnapshots([
    ...(state.presence.bySession[request.sessionId] ?? []),
    snapshot,
  ], (value) => `${value.roomId}:${value.sessionId}`);

  return {
    ...state,
    presence: {
      byRoom: {
        ...state.presence.byRoom,
        [request.roomId]: roomPresence,
      },
      bySession: {
        ...state.presence.bySession,
        [request.sessionId]: sessionPresence,
      },
    },
  };
}

function clearPresenceForRoom(
  state: ChatState,
  roomId: ChatRoomId,
  sessionId: ChatSessionId,
): ChatState {
  const byRoomEntry = { ...(state.presence.byRoom[roomId] ?? {}) };
  delete byRoomEntry[sessionId];

  const bySessionEntry = (state.presence.bySession[sessionId] ?? []).filter((snapshot) => snapshot.roomId !== roomId);

  return {
    ...state,
    presence: {
      byRoom: {
        ...state.presence.byRoom,
        [roomId]: byRoomEntry,
      },
      bySession: {
        ...state.presence.bySession,
        [sessionId]: bySessionEntry,
      },
    },
  };
}

function upsertTyping(
  state: ChatState,
  request: ChatTypingUpdateRequest,
  now: UnixMs,
  windowMs: number,
): ChatState {
  const token = `${request.sessionId}:${request.channelId}` as any;
  const snapshot: ChatTypingSnapshot = {
    roomId: request.roomId,
    channelId: request.channelId,
    sessionId: request.sessionId,
    token,
    mode: request.mode,
    startedAt: now,
    expiresAt: asUnixMs(Number(now) + windowMs),
  };

  const roomItems = uniqueSnapshots(
    [
      ...(state.typing.byRoom[request.roomId] ?? []).filter((item) => item.sessionId !== request.sessionId),
      snapshot,
    ],
    (value) => `${value.roomId}:${value.sessionId}:${value.channelId}`,
  );

  const sessionItems = uniqueSnapshots(
    [
      ...(state.typing.bySession[request.sessionId] ?? []).filter((item) => item.roomId !== request.roomId),
      snapshot,
    ],
    (value) => `${value.roomId}:${value.sessionId}:${value.channelId}`,
  );

  return {
    ...state,
    typing: {
      byRoom: {
        ...state.typing.byRoom,
        [request.roomId]: roomItems,
      },
      bySession: {
        ...state.typing.bySession,
        [request.sessionId]: sessionItems,
      },
    },
  };
}

function clearTypingForRoom(
  state: ChatState,
  roomId: ChatRoomId,
  sessionId: ChatSessionId,
): ChatState {
  return {
    ...state,
    typing: {
      byRoom: {
        ...state.typing.byRoom,
        [roomId]: (state.typing.byRoom[roomId] ?? []).filter((item) => item.sessionId !== sessionId),
      },
      bySession: {
        ...state.typing.bySession,
        [sessionId]: (state.typing.bySession[sessionId] ?? []).filter((item) => item.roomId !== roomId),
      },
    },
  };
}

function pruneExpiredTyping(state: ChatState, now: UnixMs): ChatState {
  const byRoom: Record<ChatRoomId, readonly ChatTypingSnapshot[]> = {};
  const bySession: Record<ChatSessionId, readonly ChatTypingSnapshot[]> = {};

  for (const [roomId, items] of Object.entries(state.typing.byRoom) as [ChatRoomId, readonly ChatTypingSnapshot[]][]) {
    byRoom[roomId] = items.filter((item) => Number(item.expiresAt) > Number(now));
  }

  for (const [sessionId, items] of Object.entries(state.typing.bySession) as [ChatSessionId, readonly ChatTypingSnapshot[]][]) {
    bySession[sessionId] = items.filter((item) => Number(item.expiresAt) > Number(now));
  }

  return {
    ...state,
    typing: {
      byRoom,
      bySession,
    },
  };
}

// ============================================================================
// MARK: Transcript, proof, replay, and heat helpers
// ============================================================================

function appendMessage(state: ChatState, message: ChatMessage): ChatState {
  const roomEntries = state.transcript.byRoom[message.roomId] ?? [];
  const entry: ChatTranscriptEntry = {
    message,
    appendedAt: message.createdAt,
    visibility: CHAT_CHANNEL_DESCRIPTORS[message.channelId].visibleToPlayer ? 'VISIBLE' : 'SHADOW',
  };

  return {
    ...state,
    transcript: {
      byRoom: {
        ...state.transcript.byRoom,
        [message.roomId]: [...roomEntries, entry].slice(-state.runtime.replayPolicy.maxMessagesPerRoom),
      },
      byMessageId: {
        ...state.transcript.byMessageId,
        [message.id]: entry,
      },
      lastSequenceByRoom: {
        ...state.transcript.lastSequenceByRoom,
        [message.roomId]: message.sequenceNumber,
      },
    },
    rooms: {
      ...state.rooms,
      [message.roomId]: {
        ...state.rooms[message.roomId],
        lastActivityAt: message.createdAt,
        unreadByChannel: incrementUnread(state.rooms[message.roomId].unreadByChannel, message.channelId),
      },
    },
  };
}

function nextSequenceForRoom(state: ChatState, roomId: ChatRoomId): SequenceNumber {
  return asSequenceNumber(Number(state.transcript.lastSequenceByRoom[roomId] ?? asSequenceNumber(0)) + 1);
}

function createProofEdge(
  ports: InternalPorts,
  args: {
    roomId: ChatRoomId;
    fromMessageId?: any | null;
    fromEventId?: ChatEventId | null;
    toMessageId?: any | null;
    toReplayId?: ChatReplayId | null;
    toTelemetryId?: ChatTelemetryId | null;
    toInferenceId?: any | null;
    edgeType: ChatProofEdge['edgeType'];
    metadata?: Readonly<Record<string, JsonValue>>;
  },
): ChatProofEdge {
  const id = ports.ids.proofEdgeId('prf');
  const hash = ports.hash.hash(
    `${args.roomId}|${args.fromMessageId ?? ''}|${args.fromEventId ?? ''}|${args.toMessageId ?? ''}|${args.toReplayId ?? ''}|${args.toTelemetryId ?? ''}|${args.toInferenceId ?? ''}|${args.edgeType}`,
  );

  return {
    id,
    roomId: args.roomId,
    createdAt: asUnixMs(ports.clock.now()),
    fromMessageId: args.fromMessageId ?? null,
    fromEventId: args.fromEventId ?? null,
    toMessageId: args.toMessageId ?? null,
    toReplayId: args.toReplayId ?? null,
    toTelemetryId: args.toTelemetryId ?? null,
    toInferenceId: args.toInferenceId ?? null,
    edgeType: args.edgeType,
    hash,
    metadata: args.metadata ?? {},
  };
}

function createTelemetry(
  ports: InternalPorts,
  args: Omit<ChatTelemetryEnvelope, 'telemetryId'>,
): ChatTelemetryEnvelope {
  return {
    telemetryId: ports.ids.telemetryId('tel'),
    ...args,
  };
}

function applyHeatDelta(
  state: ChatState,
  roomId: ChatRoomId,
  channelId: ChatVisibleChannel,
  delta: number,
  now: UnixMs,
): ChatState {
  const current = state.audienceHeatByRoom[roomId] ?? {
    roomId,
    channelId,
    heat01: clamp01(0.25),
    swarmDirection: 'NEUTRAL' as const,
    updatedAt: now,
  };

  const nextHeat = clamp01(Number(current.heat01) + delta);
  const swarmDirection =
    delta > 0.02
      ? 'NEGATIVE'
      : delta < -0.02
        ? 'POSITIVE'
        : current.swarmDirection;

  const next: ChatAudienceHeat = {
    roomId,
    channelId,
    heat01: nextHeat,
    swarmDirection,
    updatedAt: now,
  };

  return {
    ...state,
    audienceHeatByRoom: {
      ...state.audienceHeatByRoom,
      [roomId]: next,
    },
  };
}

function storePendingRequest(
  state: ChatState,
  args: {
    request: ChatPlayerMessageSubmitRequest;
    messageId: any;
    now: UnixMs;
  },
): ChatState {
  const pending: ChatPendingRequestState = {
    requestId: args.request.requestId,
    roomId: args.request.roomId,
    sessionId: args.request.sessionId,
    messageId: args.messageId,
    createdAt: args.now,
  };

  return {
    ...state,
    pendingRequests: {
      ...state.pendingRequests,
      [args.request.requestId]: pending,
    },
  };
}

function setPendingRequestRejected(
  state: ChatState,
  request: ChatPlayerMessageSubmitRequest,
  now: UnixMs,
): ChatState {
  return {
    ...state,
    pendingRequests: {
      ...state.pendingRequests,
      [request.requestId]: {
        requestId: request.requestId,
        roomId: request.roomId,
        sessionId: request.sessionId,
        messageId: `rejected_${String(request.requestId)}` as any,
        createdAt: now,
      },
    },
  };
}

// ============================================================================
// MARK: Maintenance resolution helpers
// ============================================================================

function resolveExpiredSilences(state: ChatState, now: UnixMs): ChatState {
  const next: Record<ChatRoomId, ChatSilenceDecision> = {};
  for (const [roomId, silence] of Object.entries(state.silencesByRoom) as [ChatRoomId, ChatSilenceDecision][]) {
    if (Number(silence.endsAt) > Number(now)) {
      next[roomId] = silence;
    }
  }
  return {
    ...state,
    silencesByRoom: next,
  };
}

function resolveExpiredInvasions(state: ChatState, now: UnixMs): ChatState {
  const next: Record<ChatInvasionId, ChatInvasionState> = {};
  for (const [id, invasion] of Object.entries(state.activeInvasions) as [ChatInvasionId, ChatInvasionState][]) {
    if (Number(invasion.closesAt) > Number(now)) {
      next[id] = invasion;
    }
  }
  return {
    ...state,
    activeInvasions: next,
  };
}

function flushDueReveals(state: ChatState, now: UnixMs): ChatState {
  if (state.pendingReveals.length === 0) {
    return state;
  }

  const due = state.pendingReveals.filter((item) => Number(item.revealAt) <= Number(now));
  const future = state.pendingReveals.filter((item) => Number(item.revealAt) > Number(now));

  let nextState: ChatState = {
    ...state,
    pendingReveals: future,
  };

  for (const reveal of due) {
    nextState = appendMessage(nextState, reveal.message);
  }

  return nextState;
}

function collectTouchedRooms(state: ChatState): readonly ChatRoomId[] {
  return Object.keys(state.rooms) as ChatRoomId[];
}

// ============================================================================
// MARK: Fanout helpers
// ============================================================================

function buildFanoutPackets(
  state: ChatState,
  touchedRoomIds: readonly ChatRoomId[],
  telemetry: readonly ChatTelemetryEnvelope[],
): readonly ChatFanoutPacket[] {
  return touchedRoomIds.map((roomId) => {
    const roomState = state.rooms[roomId];
    const visibleMessages = (state.transcript.byRoom[roomId] ?? [])
      .map((entry) => entry.message)
      .filter((message) => CHAT_CHANNEL_DESCRIPTORS[message.channelId].visibleToPlayer)
      .slice(-50);

    const shadowMessages = (state.transcript.byRoom[roomId] ?? [])
      .map((entry) => entry.message)
      .filter((message) => CHAT_CHANNEL_DESCRIPTORS[message.channelId].visibleToPlayer === false)
      .slice(-25);

    const presence = Object.values(state.presence.byRoom[roomId] ?? {});
    const typing = state.typing.byRoom[roomId] ?? [];

    return {
      roomId,
      visibleMessages,
      shadowMessages,
      presence,
      typing,
      roomState,
      telemetryIds: telemetry
        .filter((item) => item.roomId === roomId)
        .map((item) => item.telemetryId),
    };
  });
}

// ============================================================================
// MARK: Runtime/ports builders
// ============================================================================

function mergeRuntimeConfig(runtime?: Partial<ChatRuntimeConfig>): ChatRuntimeConfig {
  if (!runtime) {
    return CHAT_RUNTIME_DEFAULTS;
  }

  return {
    ...CHAT_RUNTIME_DEFAULTS,
    ...runtime,
    allowVisibleChannels: runtime.allowVisibleChannels ?? CHAT_RUNTIME_DEFAULTS.allowVisibleChannels,
    allowShadowChannels: runtime.allowShadowChannels ?? CHAT_RUNTIME_DEFAULTS.allowShadowChannels,
    ratePolicy: {
      ...CHAT_RUNTIME_DEFAULTS.ratePolicy,
      ...(runtime.ratePolicy ?? {}),
    },
    moderationPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.moderationPolicy,
      ...(runtime.moderationPolicy ?? {}),
    },
    replayPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.replayPolicy,
      ...(runtime.replayPolicy ?? {}),
    },
    learningPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.learningPolicy,
      ...(runtime.learningPolicy ?? {}),
    },
    proofPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.proofPolicy,
      ...(runtime.proofPolicy ?? {}),
    },
    invasionPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.invasionPolicy,
      ...(runtime.invasionPolicy ?? {}),
    },
  };
}

function createPorts(ports?: ChatEnginePorts): InternalPorts {
  return {
    clock: ports?.clock ?? NOOP_PORTS.clock,
    ids: ports?.ids ?? NOOP_PORTS.ids,
    hash: ports?.hash ?? NOOP_PORTS.hash,
    logger: ports?.logger ?? NOOP_PORTS.logger,
    persistence: ports?.persistence ?? NOOP_PORTS.persistence,
    fanout: ports?.fanout ?? NOOP_PORTS.fanout,
    telemetry: ports?.telemetry ?? NOOP_PORTS.telemetry,
    replay: ports?.replay ?? NOOP_PORTS.replay,
    learning: ports?.learning ?? NOOP_PORTS.learning,
    random: ports?.random ?? NOOP_PORTS.random,
  };
}

// ============================================================================
// MARK: Persona line selection
// ============================================================================

function getPersona(personaId: ChatPersonaId): LocalNpcRegistryEntry {
  const value = Object.values(PERSONAS).find((entry) => entry.personaId === personaId);
  if (!value) {
    throw new Error(`Unknown persona id: ${String(personaId)}`);
  }
  return value;
}

function pickHelperCandidates(profile: ChatLearningProfile | null): ChatPersonaId[] {
  if (!profile) {
    return [...HELPER_PERSONA_IDS];
  }

  return Number(profile.affect.embarrassment01) > 0.25
    ? [PERSONAS.helper_mercy.personaId, PERSONAS.helper_anchor.personaId]
    : [PERSONAS.helper_anchor.personaId, PERSONAS.helper_mercy.personaId];
}

function pickHaterCandidates(mood: ChatRoomStageMood): ChatPersonaId[] {
  switch (mood) {
    case 'PREDATORY':
      return [PERSONAS.hater_manipulator.personaId, PERSONAS.hater_liquidator.personaId];
    case 'HOSTILE':
      return [PERSONAS.hater_liquidator.personaId, PERSONAS.hater_bureaucrat.personaId];
    case 'TENSE':
      return [PERSONAS.hater_bureaucrat.personaId, PERSONAS.hater_manipulator.personaId];
    default:
      return [PERSONAS.hater_manipulator.personaId];
  }
}

function mapBotToPersonaIds(botId: BotId): ChatPersonaId[] {
  const normalized = String(botId);
  if (normalized === 'BOT_01') {
    return [PERSONAS.hater_liquidator.personaId];
  }
  if (normalized === 'BOT_02') {
    return [PERSONAS.hater_bureaucrat.personaId];
  }
  if (normalized === 'BOT_03') {
    return [PERSONAS.hater_manipulator.personaId];
  }
  return [PERSONAS.hater_manipulator.personaId];
}

function pickHelperLine(personaId: ChatPersonaId, reason: string): string {
  const persona = getPersona(personaId);
  const line = pickOne(persona.rescues);
  return composeWithVoiceprint(persona, `${line} ${reason}`);
}

function pickHaterLine(personaId: ChatPersonaId, mood: ChatRoomStageMood): string {
  const persona = getPersona(personaId);
  const line = mood === 'HOSTILE' || mood === 'PREDATORY'
    ? pickOne(persona.taunts)
    : pickOne(persona.telegraphs);
  return composeWithVoiceprint(persona, line);
}

function pickAmbientLine(personaId: ChatPersonaId): string {
  const persona = getPersona(personaId);
  return composeWithVoiceprint(persona, pickOne(persona.ambient));
}

function composeWithVoiceprint(persona: LocalNpcRegistryEntry, body: string): string {
  const prefix = persona.voiceprint.opener ? `${persona.voiceprint.opener} ` : '';
  const suffix = persona.voiceprint.closer ? ` ${persona.voiceprint.closer}` : '';
  return `${prefix}${body}${suffix}`.trim();
}

// ============================================================================
// MARK: Signal description and invasion announcements
// ============================================================================

function describeSignal(signal: ChatSignalEnvelope): {
  readonly visibleSystemLine: string | null;
  readonly channelId: ChatVisibleChannel;
  readonly telemetryName: ChatTelemetryEnvelope['eventName'];
} {
  switch (signal.type) {
    case 'BATTLE': {
      const pressure = signal.battle?.pressureTier ?? 'NONE';
      if (pressure === 'CRITICAL') {
        return {
          visibleSystemLine: 'SYSTEM: battle pressure just crossed critical.',
          channelId: 'GLOBAL',
          telemetryName: 'dropoff_warning',
        };
      }
      if (signal.battle?.rescueWindowOpen) {
        return {
          visibleSystemLine: 'SYSTEM: rescue window opened.',
          channelId: 'SYNDICATE',
          telemetryName: 'dropoff_warning',
        };
      }
      return {
        visibleSystemLine: null,
        channelId: 'GLOBAL',
        telemetryName: 'chat_opened',
      };
    }

    case 'RUN': {
      if (signal.run?.bankruptcyWarning) {
        return {
          visibleSystemLine: 'SYSTEM: bankruptcy warning broadcast to the room.',
          channelId: 'GLOBAL',
          telemetryName: 'dropoff_warning',
        };
      }
      if (signal.run?.nearSovereignty) {
        return {
          visibleSystemLine: 'SYSTEM: sovereignty threshold is near.',
          channelId: 'GLOBAL',
          telemetryName: 'chat_opened',
        };
      }
      return {
        visibleSystemLine: null,
        channelId: 'GLOBAL',
        telemetryName: 'chat_opened',
      };
    }

    case 'ECONOMY': {
      return {
        visibleSystemLine:
          Number(signal.economy?.overpayRisk01 ?? 0) > 0.65
            ? 'SYSTEM: deal-room overpay risk spiked.'
            : null,
        channelId: 'DEAL_ROOM',
        telemetryName: 'chat_opened',
      };
    }

    case 'MULTIPLAYER': {
      return {
        visibleSystemLine:
          (signal.multiplayer?.roomMemberCount ?? 0) >= 4
            ? 'SYSTEM: room traffic just surged.'
            : null,
        channelId: 'GLOBAL',
        telemetryName: 'chat_opened',
      };
    }

    case 'LIVEOPS': {
      return {
        visibleSystemLine:
          signal.liveops?.haterRaidActive
            ? 'SYSTEM: a hostile world event just entered the room.'
            : null,
        channelId: 'GLOBAL',
        telemetryName: 'chat_opened',
      };
    }
  }
}

function invasionAnnouncement(kind: ChatInvasionState['kind']): string {
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

// ============================================================================
// MARK: Learning policy helpers
// ============================================================================

function createColdStartProfile(userId: any, now: UnixMs): ChatLearningProfile {
  return {
    userId,
    createdAt: now,
    updatedAt: now,
    coldStart: true,
    engagementBaseline01: clamp01(0.35),
    helperReceptivity01: clamp01(0.55),
    haterSusceptibility01: clamp01(0.30),
    negotiationAggression01: clamp01(0.45),
    channelAffinity: {
      GLOBAL: clamp01(0.50),
      SYNDICATE: clamp01(0.55),
      DEAL_ROOM: clamp01(0.35),
      LOBBY: clamp01(0.40),
    },
    rescueHistoryCount: 0,
    churnRisk01: clamp01(0.18),
    salienceAnchorIds: [],
    affect: EMPTY_AFFECT,
  };
}

function deriveInterventionPolicy(profile: ChatLearningProfile): ChatInferenceSnapshot['interventionPolicy'] {
  if (Number(profile.churnRisk01) > 0.68) {
    return 'HARD_HELPER';
  }
  if (Number(profile.affect.frustration01) > 0.36 || Number(profile.affect.intimidation01) > 0.33) {
    return 'LIGHT_HELPER';
  }
  if (Number(profile.haterSusceptibility01) > 0.66 && Number(profile.affect.confidence01) > 0.52) {
    return 'HATER_ESCALATE';
  }
  if (Number(profile.affect.curiosity01) > 0.52) {
    return 'AMBIENT';
  }
  return 'DEFER';
}

function createSalienceAnchorId(ports: InternalPorts, roomId: ChatRoomId, messageId: any): any {
  return ports.hash.hash(`${roomId}:${messageId}:salience`) as any;
}

// ============================================================================
// MARK: Misc domain derivation helpers
// ============================================================================

function deriveMoodFromMessage(message: ChatMessage): ChatRoomStageMood {
  const text = message.plainText.toLowerCase();
  if (text.includes('deal') || text.includes('offer') || text.includes('price')) {
    return 'PREDATORY';
  }
  if (text.includes('help') || text.includes('stuck') || text.includes('lost')) {
    return 'MOURNFUL';
  }
  if (text.includes('win') || text.includes('sovereign') || text.includes('ready')) {
    return 'CEREMONIAL';
  }
  if (message.attribution.sourceType === 'PLAYER') {
    return 'TENSE';
  }
  return 'CALM';
}

function messageHeatDelta(message: ChatMessage): number {
  const lengthDelta = Math.min(0.07, message.plainText.length / 500);
  const exclamations = (message.plainText.match(/!/g) ?? []).length;
  const caps = countUppercase(message.plainText);
  return Math.max(-0.02, Math.min(0.14, lengthDelta + exclamations * 0.01 + Math.min(0.03, caps * 0.002)));
}

function canOpenInvasion(
  state: ChatState,
  roomId: ChatRoomId,
  now: UnixMs,
  runtime: ChatRuntimeConfig,
): boolean {
  const existing = Object.values(state.activeInvasions).filter((value) => value.roomId === roomId);
  if (existing.length >= runtime.invasionPolicy.maxActivePerRoom) {
    return false;
  }

  const lastActivity = state.lastEventAtByRoom[roomId];
  if (!lastActivity) {
    return true;
  }

  return Number(now) - Number(lastActivity) >= runtime.invasionPolicy.minimumGapMs;
}

function rejectResult(state: ChatState, reasons: readonly string[]): ProcessResult {
  return {
    state,
    appendedMessages: [],
    redactedMessageIds: [],
    replayArtifacts: [],
    proofEdges: [],
    telemetry: [],
    learningProfilesTouched: [],
    inferenceSnapshots: [],
    touchedRoomIds: [],
    touchedSessionIds: [],
    rejectionReasons: [...reasons],
    policy: null,
  };
}

// ============================================================================
// MARK: Small utilities
// ============================================================================

function cloneReadonlyRecordOfArrays<T>(value: Readonly<Record<string, readonly T[]>>): Record<string, readonly T[]> {
  const next: Record<string, readonly T[]> = {};
  for (const [key, items] of Object.entries(value)) {
    next[key] = [...items];
  }
  return next;
}

function cloneNestedPresence(
  value: ChatPresenceState['byRoom'],
): ChatPresenceState['byRoom'] {
  const next: Record<ChatRoomId, Record<ChatSessionId, ChatPresenceSnapshot>> = {};
  for (const [roomId, roomPresence] of Object.entries(value) as [ChatRoomId, Record<ChatSessionId, ChatPresenceSnapshot>][]) {
    next[roomId] = { ...roomPresence };
  }
  return next;
}

function uniqueIds<T>(input: readonly T[]): readonly T[] {
  return Array.from(new Set(input));
}

export function uniqueStrings(input: readonly string[]): string[] {
  return Array.from(new Set(input));
}

function uniqueSnapshots<T>(input: readonly T[], keyOf: (value: T) => string): readonly T[] {
  const map = new Map<string, T>();
  for (const item of input) {
    map.set(keyOf(item), item);
  }
  return Array.from(map.values());
}

function incrementUnread(
  unread: ChatRoomState['unreadByChannel'],
  channelId: ChatChannelId,
): ChatRoomState['unreadByChannel'] {
  if (!isVisibleChannelId(channelId)) {
    return unread;
  }

  return {
    ...unread,
    [channelId]: (unread[channelId] ?? 0) + 1,
  };
}

function buildTags(text: string): readonly string[] {
  const tags = new Set<string>();

  if (text.includes('?')) tags.add('question');
  if (text.includes('!')) tags.add('emphasis');
  if (/offer|deal|price|sell|buy/i.test(text)) tags.add('deal');
  if (/help|stuck|lost|rescue|recover/i.test(text)) tags.add('rescue');
  if (/win|dominate|own|control|crush/i.test(text)) tags.add('dominance');

  return Array.from(tags);
}

function replaceCaseInsensitiveWord(text: string, search: string, replacement: string): string {
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(escaped, 'gi'), replacement);
}

function normalizeSentenceCase(text: string): string {
  const lowered = text.toLowerCase();
  return lowered.replace(/(^\w|[.!?]\s+\w)/g, (match) => match.toUpperCase());
}

function sanitizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

function countUppercase(text: string): number {
  return (text.match(/[A-Z]/g) ?? []).length;
}

function countLetters(text: string): number {
  return (text.match(/[A-Za-z]/g) ?? []).length;
}

function longestEmojiLikeRun(text: string): number {
  let longest = 0;
  let current = 0;

  for (const char of text) {
    if (/[\p{Extended_Pictographic}!?.]/u.test(char)) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }

  return longest;
}

function normalizeEmojiRun(text: string): string {
  return text.replace(/([!?.\p{Extended_Pictographic}]){4,}/gu, (value) => value.slice(0, 3));
}

function deepFreeze<T>(value: T): T {
  return value;
}

function randomBase36(length: number): string {
  let value = '';
  while (value.length < length) {
    value += Math.random().toString(36).slice(2);
  }
  return value.slice(0, length);
}

function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function pickOne<T>(input: readonly T[]): T {
  return input[Math.floor(Math.random() * input.length)];
}

// ============================================================================
// MARK: Exported accessors and type wiring
// ============================================================================

export function toScore01(raw: number): Score01 {
  return clamp01(raw);
}

export function toScore100(raw: number): Score100 {
  return clamp100(raw);
}

export function buildTextBodyPart(text: string): ChatMessageBodyPart {
  return { type: 'TEXT', text };
}

export function getPresenceMode(snapshot: ChatPresenceSnapshot): ChatPresenceMode {
  return snapshot.mode;
}

export function getNpcRole(message: ChatMessage): ChatNpcRole | null {
  return message.attribution.npcRole;
}

export function isTypingActive(mode: ChatTypingMode): boolean {
  return mode === 'TYPING';
}

export function isDueReveal(reveal: ChatPendingReveal, now: UnixMs): boolean {
  return Number(reveal.revealAt) <= Number(now);
}

export function getSessionIdentity(session: ChatSessionState): ChatSessionIdentity {
  return session.identity;
}

export function listRelationships(state: ChatState): readonly ChatRelationshipState[] {
  return Object.values(state.relationships);
}

export function describeAttackType(type: AttackType): string {
  return String(type);
}

export function asNormalizedEvent(event: ChatNormalizedEvent): ChatNormalizedEvent {
  return event;
}

export function readProofChain(state: ChatState): ChatProofChain {
  return state.proofChain;
}

export function readTranscriptLedger(state: ChatState): ChatTranscriptLedger {
  return state.transcript;
}

export function readTypingState(state: ChatState): ChatTypingState {
  return state.typing;
}

export function readReplayIndex(state: ChatState): ChatReplayIndex {
  return state.replay;
}

export function readRoomSessionIndex(state: ChatState): ChatRoomSessionIndex {
  return state.roomSessions;
}

export function asScenePlan(plan: ChatScenePlan): ChatScenePlan {
  return plan;
}

// ============================================================================
// MARK: Module authority object
// ============================================================================

export const ChatEngineModule = Object.freeze({
  // Core engine class
  ChatEngine,

  // Score utilities
  toScore01,
  toScore100,

  // Message body
  buildTextBodyPart,

  // Presence
  getPresenceMode,

  // NPC role
  getNpcRole,

  // Typing
  isTypingActive,

  // Pending reveal
  isDueReveal,

  // Session identity
  getSessionIdentity,

  // Relationships
  listRelationships,

  // Attack type
  describeAttackType,

  // Normalized event
  asNormalizedEvent,

  // State sub-structure readers
  readProofChain,
  readTranscriptLedger,
  readTypingState,
  readReplayIndex,
  readRoomSessionIndex,

  // Scene plan
  asScenePlan,

  // String utilities
  uniqueStrings,
} as const);
