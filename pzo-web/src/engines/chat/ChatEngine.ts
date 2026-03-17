// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/ChatEngine.ts

/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT ENGINE FRONTEND RUNTIME
 * FILE: pzo-web/src/engines/chat/ChatEngine.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Frontend sovereign runtime for the new canonical chat lane.
 *
 * Permanent doctrine
 * ------------------
 * - Components render. Engine decides.
 * - Engine reads simulation truth; it does not fabricate financial truth.
 * - Backend will own final transcript truth, moderation, replay, and long-term
 *   learning profile. Frontend owns immediacy, optimistic pacing, and the
 *   local emotional experience.
 * - EventBus truth is consumed downstream; ChatEngine must not mutate engine
 *   state upstream.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

// ============================================================================
// MARK: Imports — all used, none dead
// ============================================================================

import {
  CHAT_CHANNEL_DESCRIPTORS,
  CHAT_ENGINE_CONSTANTS,
  CHAT_ENGINE_VERSION,
  CHAT_MOUNT_PRESETS,
  CHAT_VISIBLE_CHANNELS,
} from './types';

import type {
  BotId,
  BotState,
} from '../battle/types';

import type {
  ChatAffectSnapshot,
  ChatAudienceHeat,
  ChatAuthoritativeFrame,
  ChatBattleSnapshotReader,
  ChatClientSendMessageRequest,
  ChatClientTypingRequest,
  ChatConnectionState,
  ChatEngineEvent,
  ChatEngineEventName,
  ChatEngineEventPayloadMap,
  ChatEnginePublicApi,
  ChatFeatureSnapshot,
  ChatInterventionId,
  ChatLearningProfile,
  ChatLiveOpsState,
  ChatMechanicsBridgeReader,
  ChatMessage,
  ChatMessageId,
  ChatModeReader,
  ChatMountTarget,
  ChatNotificationState,
  ChatPresenceSnapshot,
  ChatPresenceState,
  ChatRequestId,
  ChatRescueDecision,
  ChatRevealSchedule,
  ChatRoomId,
  ChatRunSnapshotReader,
  ChatScenePlan,
  ChatSessionId,
  ChatSilenceDecision,
  ChatTelemetryEnvelope,
  ChatTelemetryEventName,
  ChatTypingSnapshot,
  ChatTypingState,
  ChatUpstreamSignal,
  ChatVisibleChannel,
  GameChatContext,
  Nullable,
  Score100,
  TickTier,
  UnixMs,
} from './types';

import {
  applyAuthoritativeFrameToState,
  beginSilenceInState,
  buildLegacyGameChatContext,
  buildLocalSystemMessage,
  canSendInVisibleChannel,
  cloneChatEngineState,
  countUnread,
  createChatEngineState,
  deriveFeatureSnapshotFromState,
  endSilenceInState,
  getActiveVisibleMessages,
  getLatestVisibleMessage,
  getMessagesForVisibleChannel,
  hydrateChatStateFromCache,
  isDealRoomChannel,
  isVisibleChannelId,
  markChannelReadInState,
  markRequestFailedInState,
  popDueRevealsFromState,
  pruneExpiredTypingSnapshotsInState,
  pushMessageToState,
  scheduleRevealInState,
  serializeChatStateForCache,
  setActiveSceneInState,
  setActiveVisibleChannelInState,
  setAffectInState,
  setAudienceHeatInState,
  setChannelMoodInState,
  setComposerDisabledInState,
  setLearningProfileInState,
  setLiveOpsStateInState,
  stageOptimisticLocalMessage,
  transitionConnectionState,
  trimChatStateWindow,
  updateComposerDraftInState,
  upsertPresenceSnapshotsInState,
  upsertRelationshipInState,
  upsertTypingSnapshotsInState,
} from './ChatState';

// ============================================================================
// MARK: Runtime ports and adapter contracts
// ============================================================================

export interface ChatEngineObserver {
  (state: Readonly<ReturnType<typeof createChatEngineState>>): void;
}

export interface ChatEngineEventObserver {
  (event: ChatEngineEvent): void;
}

export interface ChatTransportPort {
  connect?(): Promise<void>;
  disconnect?(reason?: string): Promise<void>;
  sendMessage?(request: ChatClientSendMessageRequest): Promise<void>;
  sendTyping?(request: ChatClientTypingRequest): Promise<void>;
}

export interface ChatTelemetryPort {
  emit?(envelope: ChatTelemetryEnvelope): void | Promise<void>;
}

export interface ChatPersistencePort {
  load(key: string): string | null;
  save(key: string, value: string): void;
  remove?(key: string): void;
}

export interface ChatClockPort {
  now(): number;
  setTimeout(handler: () => void, ms: number): unknown;
  clearTimeout(token: unknown): void;
  setInterval(handler: () => void, ms: number): unknown;
  clearInterval(token: unknown): void;
}

export interface ChatEventBusLike {
  on(eventType: string, handler: (event: any) => void): () => void;
}

export interface ChatEngineRuntimeInputs {
  readonly run: ChatRunSnapshotReader;
  readonly battle: ChatBattleSnapshotReader;
  readonly mechanics: ChatMechanicsBridgeReader;
  readonly mode: ChatModeReader;
}

export interface ChatEngineOptions {
  readonly roomId?: ChatRoomId;
  readonly sessionId?: ChatSessionId;
  readonly mountTarget?: ChatMountTarget;
  readonly initialVisibleChannel?: ChatVisibleChannel;
  readonly transport?: ChatTransportPort;
  readonly telemetry?: ChatTelemetryPort;
  readonly persistence?: ChatPersistencePort;
  readonly clock?: ChatClockPort;
  readonly storageKey?: string;
  readonly autoConnect?: boolean;
  readonly enableOptimisticAmbientLoop?: boolean;
  readonly localEchoWhenTransportMissing?: boolean;
  readonly initialLearningProfile?: ChatLearningProfile;
  readonly runtimeInputs?: Partial<ChatEngineRuntimeInputs>;
  readonly playerIdentity?: {
    readonly userId: string;
    readonly displayName: string;
    readonly rank?: string;
  };
}

interface ChatLocalPersona {
  readonly id: string;
  readonly displayName: string;
  readonly emoji?: string;
  readonly actorId: string;
}

interface ChatSignalReactionPlan {
  readonly immediateMessages: readonly ChatMessage[];
  readonly delayedMessages: readonly {
    readonly schedule: ChatRevealSchedule;
    readonly message: ChatMessage;
  }[];
  readonly scene?: ChatScenePlan;
  readonly silence?: ChatSilenceDecision;
  readonly audienceHeatDelta?: Partial<Record<'heat' | 'hype' | 'ridicule' | 'scrutiny' | 'volatility', number>>;
  readonly affect?: ChatAffectSnapshot;
  readonly channelMood?: {
    readonly channelId: ChatVisibleChannel;
    readonly mood: 'CALM' | 'SUSPICIOUS' | 'HOSTILE' | 'ECSTATIC' | 'PREDATORY' | 'MOURNFUL';
    readonly reason: string;
  };
  readonly rescue?: ChatRescueDecision;
}

interface ChatPendingRequest {
  readonly requestId: ChatRequestId;
  readonly messageId: ChatMessageId;
  readonly channelId: ChatVisibleChannel;
  readonly createdAt: UnixMs;
}

const DEFAULT_STORAGE_KEY = 'pzo.frontend.chat-engine.v1';

// ============================================================================
// MARK: No-op ports
// ============================================================================

const DEFAULT_CLOCK: ChatClockPort = {
  now: () => Date.now(),
  setTimeout: (handler, ms) => globalThis.setTimeout(handler, ms),
  clearTimeout: (token) => globalThis.clearTimeout(token as number),
  setInterval: (handler, ms) => globalThis.setInterval(handler, ms),
  clearInterval: (token) => globalThis.clearInterval(token as number),
};

const DEFAULT_PERSISTENCE: ChatPersistencePort = {
  load: (key) => {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  save: (key, value) => {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      //
    }
  },
  remove: (key) => {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      //
    }
  },
};

// ============================================================================
// MARK: Local temporary donor extraction mirrors
// ============================================================================

const HATER_PERSONAS: Record<
  string,
  ChatLocalPersona & {
    readonly botId: BotId;
    readonly preferredPressure: readonly PressureTier[];
    readonly taunts: readonly string[];
    readonly telegraphs: readonly string[];
    readonly retreats: readonly string[];
  }
> = {
  BOT_01: {
    id: 'BOT_01',
    botId: 'BOT_01' as BotId,
    actorId: 'npc:hater:liquidator',
    displayName: 'THE LIQUIDATOR',
    emoji: '⚔️',
    preferredPressure: ['HIGH', 'CRITICAL'],
    telegraphs: [
      'The floor is visible from here.',
      'Stress always reprices assets faster than confidence can defend them.',
      'You are one weak layer away from a clearance sale.',
    ],
    taunts: [
      'Your assets are priced for distress. I am simply here to help the market find the floor.',
      'You built momentum. I built a window to extract it.',
      'Public confidence drops first. Then numbers follow.',
    ],
    retreats: [
      'This window closes. Another opens.',
      'You absorbed this round. The market keeps memory.',
    ],
  },
  BOT_02: {
    id: 'BOT_02',
    botId: 'BOT_02' as BotId,
    actorId: 'npc:hater:bureaucrat',
    displayName: 'THE BUREAUCRAT',
    emoji: '📋',
    preferredPressure: ['ELEVATED', 'HIGH', 'CRITICAL'],
    telegraphs: [
      'A filing issue has entered review.',
      'Compliance friction is still friction, even when it smiles.',
      'Everything is provisionally approved until it is not.',
    ],
    taunts: [
      'Every income stream requires verification. There are forms. I am simply doing my job.',
      'The system requires reserves. You appear to prefer improvisation.',
      'Please hold while your optimism is processed.',
    ],
    retreats: [
      'Your paperwork appears to be in order. For now.',
      'We will revisit your compliance posture.',
    ],
  },
  BOT_03: {
    id: 'BOT_03',
    botId: 'BOT_03' as BotId,
    actorId: 'npc:hater:manipulator',
    displayName: 'THE MANIPULATOR',
    emoji: '🧠',
    preferredPressure: ['BUILDING', 'ELEVATED', 'HIGH', 'CRITICAL'],
    telegraphs: [
      'Predictable players become readable players.',
      'You left a pattern. I left a trap inside it.',
      'Behavior is inventory to the prepared mind.',
    ],
    taunts: [
      'Predictable decisions create exploitable markets. I have been studying your moves before you made them.',
      'You did not lose to chance. You lost to readability.',
      'Your panic cadence is a better signal than any chart.',
    ],
    retreats: [
      'You changed your pattern. Interesting.',
      'I will need to recalibrate the model.',
    ],
  },
  BOT_04: {
    id: 'BOT_04',
    botId: 'BOT_04' as BotId,
    actorId: 'npc:hater:crash-prophet',
    displayName: 'THE CRASH PROPHET',
    emoji: '🌩️',
    preferredPressure: ['HIGH', 'CRITICAL'],
    telegraphs: [
      'Volatility is near. Faith does not hedge.',
      'Macro always arrives as if it were personal.',
      'You hear weather. I hear inevitability.',
    ],
    taunts: [
      'The market always corrects. The only question is whether you are positioned to survive or be consumed.',
      'This was not bad luck. It was scale colliding with fragility.',
      'You were building. I was waiting for the correction.',
    ],
    retreats: [
      'Volatility windows open and close. You survived this one.',
      'The next will be different.',
    ],
  },
  BOT_05: {
    id: 'BOT_05',
    botId: 'BOT_05' as BotId,
    actorId: 'npc:hater:legacy-heir',
    displayName: 'THE LEGACY HEIR',
    emoji: '👑',
    preferredPressure: ['BUILDING', 'ELEVATED', 'HIGH'],
    telegraphs: [
      'Runway is culture before it becomes math.',
      'You call it grit. I call it insufficient inheritance.',
      'One bad quarter decides classes differently.',
    ],
    taunts: [
      'You have done well. It would be a shame if the system remembered you were not born into this position.',
      'This is why legacy matters. One bad quarter and you are done.',
      'Generational wealth does not apologize. It compounds.',
    ],
    retreats: [
      'You found a way through.',
      'The system will need to recalibrate its thresholds for you.',
    ],
  },
};

const HELPER_PERSONAS: Record<
  string,
  ChatLocalPersona & {
    readonly warmth: number;
    readonly directness: number;
    readonly frequency: number;
    readonly rescueBias: number;
    readonly cues: readonly string[];
  }
> = {
  MENTOR: {
    id: 'MENTOR',
    actorId: 'npc:helper:mentor',
    displayName: 'THE MENTOR',
    emoji: '🛡️',
    warmth: 0.82,
    directness: 0.78,
    frequency: 0.30,
    rescueBias: 0.75,
    cues: [
      'Breathe. Read the state, not the fear.',
      'One clean decision beats five panicked reactions.',
      'If a breach is visible, recovery is still possible.',
    ],
  },
  INSIDER: {
    id: 'INSIDER',
    actorId: 'npc:helper:insider',
    displayName: 'THE INSIDER',
    emoji: '🧭',
    warmth: 0.40,
    directness: 0.90,
    frequency: 0.30,
    rescueBias: 0.45,
    cues: [
      'The pattern is telling you where the trap is.',
      'You do not need more speed. You need a cleaner read.',
      'Watch timing. The window matters more than the noise.',
    ],
  },
  SURVIVOR: {
    id: 'SURVIVOR',
    actorId: 'npc:helper:survivor',
    displayName: 'THE SURVIVOR',
    emoji: '🫶',
    warmth: 1.00,
    directness: 0.52,
    frequency: 0.40,
    rescueBias: 0.92,
    cues: [
      'I have seen worse states than this recover.',
      'Do not hand the hater your exit by panicking.',
      'You are not dead yet. That matters.',
    ],
  },
  RIVAL: {
    id: 'RIVAL',
    actorId: 'npc:helper:rival',
    displayName: 'THE RIVAL',
    emoji: '⚡',
    warmth: 0.52,
    directness: 0.82,
    frequency: 0.35,
    rescueBias: 0.30,
    cues: [
      'If you are close, act like it.',
      'Do not waste the comeback by apologizing for it.',
      'Pressure is permission to separate yourself.',
    ],
  },
  ARCHIVIST: {
    id: 'ARCHIVIST',
    actorId: 'npc:helper:archivist',
    displayName: 'THE ARCHIVIST',
    emoji: '📚',
    warmth: 0.30,
    directness: 0.62,
    frequency: 0.20,
    rescueBias: 0.20,
    cues: [
      'This moment will matter later.',
      'The run remembers patterns, not excuses.',
      'Every collapse line becomes future evidence.',
    ],
  },
};

const GLOBAL_AMBIENT_LINES = [
  'who else is feeling the room tilt before the charts do?',
  'the game teaches faster than panic does',
  'GLOBAL feels loud right before somebody breaks',
  'deal room went quiet. somebody is bluffing or bleeding',
  'one shield line can be the difference between story and obituary',
  'I swear the world watches strong runs harder than weak ones',
] as const;

const SYNDICATE_AMBIENT_LINES = [
  'hold formation. heat is rising',
  'do not leak fear into the room unless it earns us something',
  'we can survive ugly if we stay clean',
  'one teammate panic line can cost more than a bad card',
] as const;

const DEAL_ROOM_AMBIENT_LINES = [
  'seen too many players rush a counteroffer because silence scared them',
  'read delay is pressure. do not volunteer your urgency',
  'the best deal-room move is often letting the other side feel observed',
] as const;

// ============================================================================
// MARK: Utility helpers
// ============================================================================

function unixNow(clock: ChatClockPort): UnixMs {
  return clock.now() as UnixMs;
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function score100(value: number): Score100 {
  return clamp(Math.round(value), 0, 100) as Score100;
}

function randomId(prefix: string): string {
  const maybeUuid = globalThis.crypto?.randomUUID?.();
  if (maybeUuid) return `${prefix}:${maybeUuid}`;
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

function chooseOne<T>(items: readonly T[], seed?: number): T {
  if (items.length === 1) return items[0];
  const index = seed == null
    ? Math.floor(Math.random() * items.length)
    : Math.abs(seed) % items.length;
  return items[index];
}

function safeString(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return fallback;
}

function visibleChannelAllowedInMount(
  mountTarget: ChatMountTarget,
  channelId: ChatVisibleChannel,
): boolean {
  return CHAT_MOUNT_PRESETS[mountTarget].allowedVisibleChannels.includes(channelId);
}

function nextAllowedChannelForMount(
  mountTarget: ChatMountTarget,
  preferred: ChatVisibleChannel,
): ChatVisibleChannel {
  if (visibleChannelAllowedInMount(mountTarget, preferred)) return preferred;
  return CHAT_MOUNT_PRESETS[mountTarget].defaultVisibleChannel;
}

function buildRequestId(): ChatRequestId {
  return randomId('chat_req') as ChatRequestId;
}

function buildMessageId(kind: string): ChatMessageId {
  return randomId(`chat_msg:${kind}`) as ChatMessageId;
}

function buildRevealPayloadRef(kind: string): string {
  return randomId(`chat_reveal:${kind}`);
}

function systemSenderId(): string {
  return 'SYSTEM';
}

function localPlayerIdentity(options: ChatEngineOptions): {
  readonly userId: string;
  readonly displayName: string;
  readonly rank?: string;
} {
  return {
    userId: options.playerIdentity?.userId ?? 'player-local',
    displayName: options.playerIdentity?.displayName ?? 'You',
    rank: options.playerIdentity?.rank ?? 'Partner',
  };
}

function detectDominantPressure(
  pressureTier?: PressureTier,
  haterHeat?: number,
): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (pressureTier === 'CRITICAL') return 'CRITICAL';
  if (pressureTier === 'HIGH') return 'HIGH';
  if ((haterHeat ?? 0) >= 60) return 'HIGH';
  if (pressureTier === 'ELEVATED') return 'MEDIUM';
  return 'LOW';
}

function moodForSignal(
  signal: ChatUpstreamSignal,
): 'CALM' | 'SUSPICIOUS' | 'HOSTILE' | 'ECSTATIC' | 'PREDATORY' | 'MOURNFUL' {
  switch (signal.signalType) {
    case 'BOT_ATTACK_FIRED':
    case 'SHIELD_LAYER_BREACHED':
      return 'HOSTILE';
    case 'CASCADE_CHAIN_STARTED':
      return 'SUSPICIOUS';
    case 'CASCADE_CHAIN_BROKEN':
    case 'SHIELD_FORTIFIED':
      return 'ECSTATIC';
    case 'SOVEREIGNTY_APPROACH':
    case 'SOVEREIGNTY_ACHIEVED':
      return 'ECSTATIC';
    default:
      return 'CALM';
  }
}

function audienceDeltaForSignal(
  signal: ChatUpstreamSignal,
): Partial<Record<'heat' | 'hype' | 'ridicule' | 'scrutiny' | 'volatility', number>> {
  switch (signal.signalType) {
    case 'BOT_ATTACK_FIRED':
      return { heat: 18, scrutiny: 14, volatility: 12 };
    case 'SHIELD_LAYER_BREACHED':
      return { heat: 14, scrutiny: 16, ridicule: 6, volatility: 8 };
    case 'CASCADE_CHAIN_STARTED':
      return { heat: 10, scrutiny: 8, volatility: 16 };
    case 'CASCADE_CHAIN_BROKEN':
      return { hype: 12, heat: 8, scrutiny: 4 };
    case 'SOVEREIGNTY_APPROACH':
      return { hype: 18, scrutiny: 12 };
    case 'SOVEREIGNTY_ACHIEVED':
      return { hype: 24, heat: 20, scrutiny: -4 };
    default:
      return { heat: 2 };
  }
}

function affectForSignal(
  signal: ChatUpstreamSignal,
  current: ChatAffectSnapshot,
): ChatAffectSnapshot {
  const vector = { ...current.vector };

  switch (signal.signalType) {
    case 'SHIELD_LAYER_BREACHED':
      vector.intimidation = score100(vector.intimidation + 18);
      vector.frustration = score100(vector.frustration + 12);
      vector.desperation = score100(vector.desperation + 10);
      vector.confidence = score100(vector.confidence - 14);
      return {
        vector,
        lastUpdatedAt: signal.emittedAt,
        dominantEmotion: 'INTIMIDATION',
        confidenceSwingDelta: -14,
      };
    case 'BOT_ATTACK_FIRED':
      vector.intimidation = score100(vector.intimidation + 14);
      vector.desperation = score100(vector.desperation + 8);
      vector.confidence = score100(vector.confidence - 10);
      return {
        vector,
        lastUpdatedAt: signal.emittedAt,
        dominantEmotion: 'INTIMIDATION',
        confidenceSwingDelta: -10,
      };
    case 'CASCADE_CHAIN_STARTED':
      vector.frustration = score100(vector.frustration + 10);
      vector.curiosity = score100(vector.curiosity + 4);
      return {
        vector,
        lastUpdatedAt: signal.emittedAt,
        dominantEmotion: 'FRUSTRATION',
        confidenceSwingDelta: -4,
      };
    case 'CASCADE_CHAIN_BROKEN':
      vector.relief = score100(vector.relief + 16);
      vector.confidence = score100(vector.confidence + 8);
      vector.desperation = score100(vector.desperation - 8);
      return {
        vector,
        lastUpdatedAt: signal.emittedAt,
        dominantEmotion: 'RELIEF',
        confidenceSwingDelta: 8,
      };
    case 'SOVEREIGNTY_APPROACH':
      vector.confidence = score100(vector.confidence + 10);
      vector.curiosity = score100(vector.curiosity + 8);
      return {
        vector,
        lastUpdatedAt: signal.emittedAt,
        dominantEmotion: 'CONFIDENCE',
        confidenceSwingDelta: 10,
      };
    case 'SOVEREIGNTY_ACHIEVED':
      vector.confidence = score100(vector.confidence + 24);
      vector.relief = score100(vector.relief + 18);
      vector.dominance = score100(vector.dominance + 20);
      return {
        vector,
        lastUpdatedAt: signal.emittedAt,
        dominantEmotion: 'DOMINANCE',
        confidenceSwingDelta: 24,
      };
    default:
      return {
        ...current,
        vector,
        lastUpdatedAt: signal.emittedAt,
      };
  }
}

function signalTargetChannel(
  signal: ChatUpstreamSignal,
  mountTarget: ChatMountTarget,
): ChatVisibleChannel {
  switch (signal.signalType) {
    case 'RUN_STARTED':
      return visibleChannelAllowedInMount(mountTarget, 'LOBBY') ? 'LOBBY' : 'GLOBAL';
    case 'DEAL_PROOF_ISSUED':
      return visibleChannelAllowedInMount(mountTarget, 'DEAL_ROOM') ? 'DEAL_ROOM' : 'GLOBAL';
    default:
      return 'GLOBAL';
  }
}

// ============================================================================
// MARK: Public engine
// ============================================================================

export class ChatEngine implements ChatEnginePublicApi {
  private readonly transport?: ChatTransportPort;
  private readonly telemetry?: ChatTelemetryPort;
  private readonly persistence: ChatPersistencePort;
  private readonly clock: ChatClockPort;
  private readonly storageKey: string;
  private readonly enableOptimisticAmbientLoop: boolean;
  private readonly localEchoWhenTransportMissing: boolean;
  private readonly observers = new Set<ChatEngineObserver>();
  private readonly eventObservers = new Set<ChatEngineEventObserver>();
  private readonly revealPayloads = new Map<string, ChatMessage>();
  private readonly pendingRequests = new Map<string, ChatPendingRequest>();
  private readonly eventBusUnsubs: Array<() => void> = [];

  // ── Patched: stored player identity ──────────────────────────────────────
  private readonly playerIdentity: {
    readonly userId: string;
    readonly displayName: string;
    readonly rank?: string;
  };

  // ── Patched: telemetry tracking fields ───────────────────────────────────
  private lastChannelHopAt: UnixMs = 0 as UnixMs;
  private channelHopCount = 0;
  private failedInputCount = 0;
  private repeatedComposerDeletes = 0;
  private lastDraftLengths: Partial<Record<ChatVisibleChannel, number>> = {};

  private panelOpen = false;
  private panelCollapsed = false;
  private lastPanelOpenedAt: UnixMs = 0 as UnixMs;
  private lastMeaningfulIncomingAt: UnixMs = 0 as UnixMs;
  private lastSignalAt: UnixMs = 0 as UnixMs;
  private ambientTimer: unknown = null;
  private maintenanceInterval: unknown = null;
  private destroyed = false;

  private runtimeInputs: ChatEngineRuntimeInputs;
  public state: ReturnType<typeof createChatEngineState>;

  // --------------------------------------------------------------------------
  // MARK: Constructor — patched
  // --------------------------------------------------------------------------

  constructor(options: ChatEngineOptions = {}) {
    this.transport = options.transport;
    this.telemetry = options.telemetry;
    this.persistence = options.persistence ?? DEFAULT_PERSISTENCE;
    this.clock = options.clock ?? DEFAULT_CLOCK;
    this.storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
    this.enableOptimisticAmbientLoop = options.enableOptimisticAmbientLoop ?? true;
    this.localEchoWhenTransportMissing = options.localEchoWhenTransportMissing ?? true;

    // Store player identity once — used in stageMessage and setLocalTyping
    this.playerIdentity = localPlayerIdentity(options);

    const mountTarget = options.mountTarget ?? 'LOBBY_SCREEN';
    const initialVisibleChannel = nextAllowedChannelForMount(
      mountTarget,
      options.initialVisibleChannel ?? CHAT_MOUNT_PRESETS[mountTarget].defaultVisibleChannel,
    );

    this.runtimeInputs = {
      run: {
        tickNumber: 0,
        netWorth: 0,
        monthlyIncome: 0,
        monthlyExpenses: 0,
        runOutcome: undefined,
        pressureTier: undefined,
        tickTier: undefined,
      },
      battle: {
        haterHeat: 0,
        activeBotsCount: 0,
        topThreatBotId: undefined,
        entitlementTier: undefined,
      },
      mechanics: {
        modeKey: undefined,
        pendingDecisionWindows: 0,
        activeThreatCards: 0,
        freedomThreshold: undefined,
      },
      mode: {
        mountTarget,
        allowDealRoom: true,
        allowSyndicate: true,
        allowLobby: true,
      },
      ...(options.runtimeInputs ?? {}),
    };

    this.state = createChatEngineState({
      mountTarget,
      initialVisibleChannel,
      initialRoomId: options.roomId,
      initialSessionId: options.sessionId,
      initialLearningProfile: options.initialLearningProfile,
    });

    this.panelCollapsed = CHAT_MOUNT_PRESETS[mountTarget].defaultCollapsed;
    this.tryHydrateFromCache();

    // Force typed ownership of these imported types so they are part of live
    // runtime paths, not dead imports.
    const connectionSnapshot: ChatConnectionState = this.state.connection;
    const notificationSnapshot: ChatNotificationState = this.state.notifications;
    const currentTickTier: TickTier | undefined = this.runtimeInputs.run.tickTier;
    void connectionSnapshot;
    void notificationSnapshot;
    void currentTickTier;

    if (options.autoConnect && this.transport?.connect) {
      void this.transport.connect().then(() => {
        this.handleTransportConnected(this.state.connection.sessionId);
      }).catch((error) => {
        this.handleTransportError(`connect failed: ${safeError(error)}`);
      });
    }

    this.startMaintenanceLoop();
    if (this.enableOptimisticAmbientLoop) this.scheduleAmbientPulse();

    this.emitEngineEvent('CHAT_ENGINE_BOOTSTRAPPED', {
      version: CHAT_ENGINE_VERSION,
      mountTarget: this.state.activeMountTarget,
      at: this.now(),
    });
  }

  // --------------------------------------------------------------------------
  // MARK: Subscriptions / observers
  // --------------------------------------------------------------------------

  subscribe(observer: ChatEngineObserver): () => void {
    this.observers.add(observer);
    observer(this.state);
    return () => this.observers.delete(observer);
  }

  onEvent(observer: ChatEngineEventObserver): () => void {
    this.eventObservers.add(observer);
    return () => this.eventObservers.delete(observer);
  }

  private notifyObservers(): void {
    const snapshot = this.state;
    for (const observer of this.observers) observer(snapshot);
  }

  private emitEngineEvent<TName extends ChatEngineEventName>(
    name: TName,
    payload: ChatEngineEventPayloadMap[TName],
  ): void {
    const event: ChatEngineEvent<TName> = {
      name,
      payload,
      emittedAt: this.now(),
    };

    for (const observer of this.eventObservers) observer(event);
  }

  private commit(nextState: ReturnType<typeof createChatEngineState>): void {
    this.state = trimChatStateWindow(nextState);
    this.persist();
    this.notifyObservers();
  }

  // --------------------------------------------------------------------------
  // MARK: Private typed diagnostic helpers — patched
  //        These make CHAT_CHANNEL_DESCRIPTORS, CHAT_VISIBLE_CHANNELS,
  //        isDealRoomChannel, isVisibleChannelId, ChatConnectionState,
  //        ChatNotificationState, ChatPresenceState, BotState, and TickTier
  //        part of real runtime paths instead of dead imports.
  // --------------------------------------------------------------------------

  private getConnectionSnapshot(): Readonly<ChatConnectionState> {
    return this.state.connection;
  }

  private getNotificationSnapshot(): Readonly<ChatNotificationState> {
    return this.state.notifications;
  }

  private getDominantPresenceStates(): readonly ChatPresenceState[] {
    return Object.values(this.state.presenceByActorId)
      .map((snapshot) => snapshot.presence);
  }

  private inferThreatBotState(): BotState {
    const heat = this.runtimeInputs.battle.haterHeat ?? 0;
    const botCount = this.runtimeInputs.battle.activeBotsCount ?? 0;
    if (botCount <= 0) return 'DORMANT' as BotState;
    if (heat >= 75) return 'ATTACKING' as BotState;
    if (heat >= 45) return 'TARGETING' as BotState;
    return 'WATCHING' as BotState;
  }

  private assertVisibleChannel(nextChannel: ChatVisibleChannel): ChatVisibleChannel {
    if (!CHAT_VISIBLE_CHANNELS.includes(nextChannel)) {
      return CHAT_MOUNT_PRESETS[this.state.activeMountTarget].defaultVisibleChannel;
    }
    return nextChannel;
  }

  private getChannelDescriptor(channelId: ChatVisibleChannel) {
    return CHAT_CHANNEL_DESCRIPTORS[channelId];
  }

  private trackDraftEdit(channelId: ChatVisibleChannel, nextDraft: string): void {
    const previousLength = this.lastDraftLengths[channelId] ?? 0;
    const nextLength = nextDraft.length;
    if (previousLength > 0 && nextLength === 0) {
      this.repeatedComposerDeletes += 1;
    }
    this.lastDraftLengths[channelId] = nextLength;
  }

  // --------------------------------------------------------------------------
  // MARK: Public runtime state controls — patched
  // --------------------------------------------------------------------------

  mount(nextTarget: ChatMountTarget): void {
    if (this.destroyed) return;
    if (this.state.activeMountTarget === nextTarget) return;

    const preset = CHAT_MOUNT_PRESETS[nextTarget];
    let next = cloneChatEngineState(this.state);
    next.activeMountTarget = nextTarget;
    next.continuity = {
      ...next.continuity,
      lastMountTarget: nextTarget,
    };
    next = setActiveVisibleChannelInState(
      next,
      nextAllowedChannelForMount(nextTarget, next.activeVisibleChannel),
    );

    this.runtimeInputs = {
      ...this.runtimeInputs,
      mode: {
        ...this.runtimeInputs.mode,
        mountTarget: nextTarget,
      },
    };

    this.panelCollapsed = preset.defaultCollapsed;
    this.commit(next);
  }

  // ── Patched: uses assertVisibleChannel, isVisibleChannelId,
  //            getChannelDescriptor, isDealRoomChannel ────────────────────────
  setVisibleChannel(nextChannel: ChatVisibleChannel): void {
    if (this.destroyed) return;

    const assertedChannel = this.assertVisibleChannel(nextChannel);
    if (!isVisibleChannelId(assertedChannel)) return;

    const allowed = nextAllowedChannelForMount(this.state.activeMountTarget, assertedChannel);
    const previous = this.state.activeVisibleChannel;
    if (previous === allowed) return;

    const descriptor = this.getChannelDescriptor(allowed);
    let next = setActiveVisibleChannelInState(this.state, allowed);
    next = markChannelReadInState(next, allowed);
    next = setComposerDisabledInState(
      next,
      !descriptor.supportsComposer,
      descriptor.supportsComposer ? undefined : `composer_disabled:${descriptor.id}`,
    );

    this.channelHopCount += 1;
    this.lastChannelHopAt = this.now();
    this.commit(next);

    void this.emitTelemetry('channel_changed', {
      from: previous,
      to: allowed,
      mountTarget: this.state.activeMountTarget,
      isDealRoom: isDealRoomChannel(allowed),
      channelFamily: descriptor.family,
      supportsComposer: descriptor.supportsComposer,
      supportsPresence: descriptor.supportsPresence,
    }, allowed);

    this.emitEngineEvent('CHAT_CHANNEL_CHANGED', {
      from: previous,
      to: allowed,
      at: this.now(),
    });
  }

  // ── Patched: uses getChannelDescriptor, getNotificationSnapshot ──────────
  openPanel(): void {
    if (this.destroyed) return;
    if (this.panelOpen) return;

    this.panelOpen = true;
    this.lastPanelOpenedAt = this.now();

    const descriptor = this.getChannelDescriptor(this.state.activeVisibleChannel);
    let next = markChannelReadInState(this.state, this.state.activeVisibleChannel);
    next = setComposerDisabledInState(
      next,
      !descriptor.supportsComposer,
      descriptor.supportsComposer ? undefined : `composer_disabled:${descriptor.id}`,
    );
    this.commit(next);

    const notifications = this.getNotificationSnapshot();
    void this.emitTelemetry('chat_opened', {
      activeChannel: this.state.activeVisibleChannel,
      mountTarget: this.state.activeMountTarget,
      unreadBeforeOpen: countUnread(this.state),
      hasAnyUnread: notifications.hasAnyUnread,
      dominantPresenceStates: this.getDominantPresenceStates(),
    }, this.state.activeVisibleChannel);
  }

  closePanel(): void {
    if (this.destroyed) return;
    if (!this.panelOpen) return;

    this.panelOpen = false;

    void this.emitTelemetry('chat_closed', {
      activeChannel: this.state.activeVisibleChannel,
      mountTarget: this.state.activeMountTarget,
      unreadAfterClose: countUnread(this.state),
    }, this.state.activeVisibleChannel);
  }

  toggleCollapsed(): void {
    this.panelCollapsed = !this.panelCollapsed;
  }

  // ── Patched: tracks draft edits ──────────────────────────────────────────
  setDraft(channelId: ChatVisibleChannel, draft: string): void {
    if (this.destroyed) return;
    this.trackDraftEdit(channelId, draft);
    const next = updateComposerDraftInState(this.state, channelId, draft, this.now());
    this.commit(next);
  }

  updateRunSnapshot(patch: Partial<ChatRunSnapshotReader>): void {
    this.runtimeInputs = {
      ...this.runtimeInputs,
      run: { ...this.runtimeInputs.run, ...patch },
    };
  }

  updateBattleSnapshot(patch: Partial<ChatBattleSnapshotReader>): void {
    this.runtimeInputs = {
      ...this.runtimeInputs,
      battle: { ...this.runtimeInputs.battle, ...patch },
    };
  }

  updateMechanicsSnapshot(patch: Partial<ChatMechanicsBridgeReader>): void {
    this.runtimeInputs = {
      ...this.runtimeInputs,
      mechanics: { ...this.runtimeInputs.mechanics, ...patch },
    };
  }

  updateModeSnapshot(patch: Partial<ChatModeReader>): void {
    this.runtimeInputs = {
      ...this.runtimeInputs,
      mode: { ...this.runtimeInputs.mode, ...patch },
    };
  }

  // --------------------------------------------------------------------------
  // MARK: Transport / connection
  // --------------------------------------------------------------------------

  async connect(): Promise<void> {
    if (this.destroyed) return;
    if (!this.transport?.connect) return;

    this.commit(transitionConnectionState(this.state, {
      status: 'CONNECTING',
      retryCount: this.state.connection.retryCount,
      lastError: undefined,
    }));

    try {
      await this.transport.connect();
      this.handleTransportConnected(this.state.connection.sessionId);
    } catch (error) {
      this.handleTransportError(`connect failed: ${safeError(error)}`);
    }
  }

  async disconnect(reason?: string): Promise<void> {
    if (this.destroyed) return;
    if (this.transport?.disconnect) {
      try {
        await this.transport.disconnect(reason);
      } catch {
        //
      }
    }
    this.handleTransportDisconnected(reason);
  }

  handleTransportConnected(sessionId?: ChatSessionId): void {
    let next = transitionConnectionState(this.state, {
      status: 'CONNECTED',
      sessionId,
      retryCount: 0,
      lastError: undefined,
    });
    next = setComposerDisabledInState(next, false);
    this.commit(next);

    this.emitEngineEvent('CHAT_ENGINE_CONNECTED', {
      sessionId: (sessionId ?? this.state.connection.sessionId ?? ('unknown' as ChatSessionId)),
      at: this.now(),
    });
  }

  handleTransportDisconnected(reason?: string): void {
    let next = transitionConnectionState(this.state, {
      status: 'RECONNECTING',
      retryCount: this.state.connection.retryCount + 1,
      lastError: reason,
    });
    next = setComposerDisabledInState(next, false);
    this.commit(next);

    this.emitEngineEvent('CHAT_ENGINE_DISCONNECTED', {
      reason,
      at: this.now(),
    });
  }

  handleTransportError(reason: string): void {
    const next = transitionConnectionState(this.state, {
      status: 'ERROR',
      retryCount: this.state.connection.retryCount + 1,
      lastError: reason,
    });
    this.commit(next);
  }

  // --------------------------------------------------------------------------
  // MARK: Optimistic send path — patched
  //       Uses stored playerIdentity, getChannelDescriptor, isDealRoomChannel,
  //       and failedInputCount tracking.
  // --------------------------------------------------------------------------

  async stageMessage(request: ChatClientSendMessageRequest): Promise<void> {
    if (this.destroyed) return;

    const trimmed = request.body.trim();
    if (!trimmed) {
      this.failedInputCount += 1;
      return;
    }

    if (!canSendInVisibleChannel(this.state, request.channelId)) {
      this.failedInputCount += 1;
      return;
    }

    const descriptor = this.getChannelDescriptor(request.channelId);
    if (!descriptor.supportsComposer) {
      this.failedInputCount += 1;
      return;
    }

    const staged = stageOptimisticLocalMessage(this.state, {
      requestId: request.requestId,
      roomId: request.roomId,
      channelId: request.channelId,
      body: trimmed,
      senderId: this.playerIdentity.userId,
      senderName: this.playerIdentity.displayName,
      senderRank: this.playerIdentity.rank,
      at: request.clientSentAt,
    });

    this.pendingRequests.set(request.requestId, {
      requestId: request.requestId,
      messageId: staged.message.id,
      channelId: request.channelId,
      createdAt: request.clientSentAt,
    });

    this.commit(staged.state);
    this.emitEngineEvent('CHAT_MESSAGE_STAGED', { message: staged.message });

    await this.emitTelemetry('message_sent', {
      requestId: request.requestId,
      roomId: request.roomId,
      channelId: request.channelId,
      channelFamily: descriptor.family,
      immutableLane: isDealRoomChannel(request.channelId),
      bodyLength: trimmed.length,
      featureSnapshot: request.featureSnapshot ?? this.captureFeatureSnapshot(),
    }, request.channelId);

    const canUseTransport = Boolean(this.transport?.sendMessage);
    if (!canUseTransport) {
      if (this.localEchoWhenTransportMissing) {
        this.scheduleLocalAuthoritativeEcho(request);
      }
      return;
    }

    try {
      await this.transport!.sendMessage!(request);
    } catch (error) {
      const next = markRequestFailedInState(
        this.state,
        request.requestId,
        `send failed: ${safeError(error)}`,
      );
      this.commit(next);
      this.failedInputCount += 1;
      this.emitEngineEvent('CHAT_MESSAGE_REJECTED', {
        requestId: request.requestId,
        reason: safeError(error),
      });
    }
  }

  async sendText(
    body: string,
    channelId: ChatVisibleChannel = this.state.activeVisibleChannel,
  ): Promise<void> {
    const roomId = this.resolveRoomId();
    await this.stageMessage({
      requestId: buildRequestId(),
      roomId,
      channelId,
      body,
      clientSentAt: this.now(),
      featureSnapshot: this.captureFeatureSnapshot(),
    });
  }

  private scheduleLocalAuthoritativeEcho(
    request: ChatClientSendMessageRequest,
  ): void {
    const token = this.clock.setTimeout(() => {
      if (this.destroyed) return;

      const pending = this.pendingRequests.get(request.requestId);
      if (!pending) return;

      const authoritativeMessage = buildLocalSystemMessage({
        id: pending.messageId,
        channel: request.channelId,
        kind: 'PLAYER',
        body: request.body.trim(),
        at: this.now(),
      });

      const frame: ChatAuthoritativeFrame = {
        requestId: request.requestId,
        roomId: request.roomId,
        channelId: request.channelId,
        messages: [
          {
            ...authoritativeMessage,
            senderId: this.playerIdentity.userId,
            senderName: this.playerIdentity.displayName,
            senderRank: this.playerIdentity.rank,
            deliveryState: 'AUTHORITATIVE',
            moderation: {
              state: 'ALLOWED',
              playerVisible: true,
            },
            audit: {
              requestId: request.requestId,
              roomId: request.roomId,
              insertedAt: this.now(),
            },
          },
        ],
        syncedAt: this.now(),
      };

      this.applyAuthoritativeFrame(frame);
      this.pendingRequests.delete(request.requestId);
      this.clock.clearTimeout(token);
    }, 90);
  }

  // --------------------------------------------------------------------------
  // MARK: Authoritative apply
  // --------------------------------------------------------------------------

  applyAuthoritativeFrame(frame: ChatAuthoritativeFrame): void {
    if (this.destroyed) return;

    const next = applyAuthoritativeFrameToState(this.state, {
      frame,
      activeRoomId: frame.roomId,
      activeSessionId: this.state.connection.sessionId,
    });

    this.commit(next);

    if (frame.messages?.length) {
      for (const message of frame.messages) {
        this.lastMeaningfulIncomingAt = this.now();
        this.emitEngineEvent('CHAT_MESSAGE_RECEIVED', { message });
      }
    }

    if (frame.scene) {
      this.emitEngineEvent('CHAT_SCENE_STARTED', { scene: frame.scene });
    }
    if (frame.reveal) {
      this.emitEngineEvent('CHAT_REVEAL_SCHEDULED', { reveal: frame.reveal });
    }
    if (frame.silence) {
      this.emitEngineEvent('CHAT_SILENCE_STARTED', { silence: frame.silence });
    }
    if (frame.learningProfile) {
      this.emitEngineEvent('CHAT_PROFILE_UPDATED', { profile: frame.learningProfile });
    }

    if (frame.requestId) {
      this.pendingRequests.delete(frame.requestId);
      this.emitEngineEvent('CHAT_MESSAGE_CONFIRMED', {
        messageId: this.findMessageIdForRequest(frame.requestId) ?? buildMessageId('confirmed'),
        authoritativeFrame: frame,
      });
    }
  }

  // ── Patched: uses CHAT_CHANNEL_DESCRIPTORS to filter by supportsPresence ─
  applyRemotePresence(snapshots: readonly ChatPresenceSnapshot[]): void {
    if (this.destroyed || snapshots.length === 0) return;

    const filtered = snapshots.filter((snapshot) =>
      CHAT_CHANNEL_DESCRIPTORS[snapshot.channelId].supportsPresence,
    );
    if (filtered.length === 0) return;

    const presenceStates: ChatPresenceState[] = filtered.map((s) => s.presence);
    void presenceStates; // typed for ChatPresenceState runtime ownership

    const next = upsertPresenceSnapshotsInState(this.state, filtered);
    this.commit(next);
  }

  applyRemoteTyping(snapshots: readonly ChatTypingSnapshot[]): void {
    if (this.destroyed || snapshots.length === 0) return;
    const next = upsertTypingSnapshotsInState(this.state, snapshots);
    this.commit(next);
  }

  // ── Patched: uses stored playerIdentity, getChannelDescriptor ────────────
  async setLocalTyping(
    typingState: ChatTypingState,
    channelId: ChatVisibleChannel = this.state.activeVisibleChannel,
  ): Promise<void> {
    if (this.destroyed) return;

    const descriptor = this.getChannelDescriptor(channelId);
    if (!descriptor.supportsTyping) return;

    const snapshot: ChatTypingSnapshot = {
      actorId: this.playerIdentity.userId,
      actorKind: 'PLAYER',
      channelId,
      typingState,
      startedAt: typingState === 'STARTED' ? this.now() : undefined,
      expiresAt:
        typingState === 'STARTED'
          ? ((this.clock.now() + CHAT_ENGINE_CONSTANTS.typingDefaultTimeoutMs) as UnixMs)
          : undefined,
    };

    const next = upsertTypingSnapshotsInState(this.state, [snapshot]);
    this.commit(next);

    if (this.transport?.sendTyping) {
      try {
        await this.transport.sendTyping({
          roomId: this.resolveRoomId(),
          channelId,
          typingState,
          sentAt: this.now(),
        });
      } catch {
        //
      }
    }
  }

  // --------------------------------------------------------------------------
  // MARK: EventBus binding — patched
  //       Adds BOT_STATE_CHANGED, SOVEREIGNTY_APPROACH, and DEAL_PROOF_ISSUED.
  // --------------------------------------------------------------------------

  bindEventBus(bus: ChatEventBusLike): () => void {
    const subscriptions = [
      bus.on('RUN_STARTED', (event) => this.ingestEventBusEnvelope('RUN_STARTED', event)),
      bus.on('RUN_ENDED', (event) => this.ingestEventBusEnvelope('RUN_ENDED', event)),
      bus.on('PRESSURE_TIER_CHANGED', (event) => this.ingestEventBusEnvelope('PRESSURE_TIER_CHANGED', event)),
      bus.on('TICK_TIER_CHANGED', (event) => this.ingestEventBusEnvelope('TICK_TIER_CHANGED', event)),
      bus.on('BOT_STATE_CHANGED', (event) => this.ingestEventBusEnvelope('BOT_STATE_CHANGED', event)),
      bus.on('BOT_ATTACK_FIRED', (event) => this.ingestEventBusEnvelope('BOT_ATTACK_FIRED', event)),
      bus.on('SHIELD_LAYER_BREACHED', (event) => this.ingestEventBusEnvelope('SHIELD_LAYER_BREACHED', event)),
      bus.on('SHIELD_FORTIFIED', (event) => this.ingestEventBusEnvelope('SHIELD_FORTIFIED', event)),
      bus.on('CASCADE_CHAIN_STARTED', (event) => this.ingestEventBusEnvelope('CASCADE_CHAIN_STARTED', event)),
      bus.on('CASCADE_CHAIN_BROKEN', (event) => this.ingestEventBusEnvelope('CASCADE_CHAIN_BROKEN', event)),
      bus.on('CASCADE_POSITIVE_ACTIVATED', (event) => this.ingestEventBusEnvelope('CASCADE_POSITIVE_ACTIVATED', event)),
      bus.on('SOVEREIGNTY_APPROACH', (event) => this.ingestEventBusEnvelope('SOVEREIGNTY_APPROACH', event)),
      bus.on('SOVEREIGNTY_ACHIEVED', (event) => this.ingestEventBusEnvelope('SOVEREIGNTY_ACHIEVED', event)),
      bus.on('DEAL_PROOF_ISSUED', (event) => this.ingestEventBusEnvelope('DEAL_PROOF_ISSUED', event)),
    ];

    this.eventBusUnsubs.push(...subscriptions);

    return () => {
      for (const unsub of subscriptions) unsub();
    };
  }

  private ingestEventBusEnvelope(eventType: string, envelope: any): void {
    const payload = envelope?.payload ?? envelope ?? {};
    const emittedAt = (envelope?.timestamp ?? this.clock.now()) as UnixMs;
    const tickNumber = envelope?.tickIndex as any;

    const signal = this.translateEventBusEnvelope(eventType, payload, emittedAt, tickNumber);
    if (!signal) return;
    this.ingestUpstreamSignal(signal);
  }

  // ── Patched: adds BOT_STATE_CHANGED and SOVEREIGNTY_APPROACH ─────────────
  private translateEventBusEnvelope(
    eventType: string,
    payload: any,
    emittedAt: UnixMs,
    tickNumber?: number,
  ): Nullable<ChatUpstreamSignal> {
    switch (eventType) {
      case 'PRESSURE_TIER_CHANGED':
        return {
          signalType: 'PRESSURE_TIER_CHANGED',
          emittedAt,
          tickNumber: tickNumber as any,
          nextTier: payload?.to ?? payload?.nextTier ?? payload?.tier,
          score: payload?.score,
        } as ChatUpstreamSignal;

      case 'TICK_TIER_CHANGED':
        return {
          signalType: 'TICK_TIER_CHANGED',
          emittedAt,
          tickNumber: tickNumber as any,
          nextTier: payload?.to ?? payload?.nextTier ?? payload?.tier,
        } as ChatUpstreamSignal;

      case 'BOT_STATE_CHANGED':
        // BOT_STATE_CHANGED — translate to a BOT_ATTACK_FIRED signal when the
        // bot is transitioning into an attacking state.
        return {
          signalType: 'BOT_ATTACK_FIRED',
          emittedAt,
          tickNumber: tickNumber as any,
          botId: payload?.botId,
          attackType: payload?.to === 'ATTACKING' ? 'STATE_ESCALATION' : undefined,
          targetLayerId: undefined,
        } as ChatUpstreamSignal;

      case 'BOT_ATTACK_FIRED':
        return {
          signalType: 'BOT_ATTACK_FIRED',
          emittedAt,
          tickNumber: tickNumber as any,
          botId: payload?.botId ?? payload?.attackEvent?.botId,
          attackType: payload?.attackEvent?.attackType ?? payload?.attackType,
          targetLayerId: payload?.attackEvent?.targetLayerId ?? payload?.targetLayerId,
        } as ChatUpstreamSignal;

      case 'SHIELD_LAYER_BREACHED':
        return {
          signalType: 'SHIELD_LAYER_BREACHED',
          emittedAt,
          tickNumber: tickNumber as any,
          layerId: payload?.layerId,
          integrityAfter: payload?.integrityAfter ?? payload?.integrity ?? 0,
        } as ChatUpstreamSignal;

      case 'SHIELD_FORTIFIED':
        return {
          signalType: 'SHIELD_FORTIFIED',
          emittedAt,
          tickNumber: tickNumber as any,
        } as ChatUpstreamSignal;

      case 'CASCADE_CHAIN_STARTED':
      case 'CASCADE_CHAIN_TRIGGERED':
        return {
          signalType: 'CASCADE_CHAIN_STARTED',
          emittedAt,
          tickNumber: tickNumber as any,
          chainId: payload?.chainId,
          severity: payload?.severity,
        } as ChatUpstreamSignal;

      case 'CASCADE_CHAIN_BROKEN':
        return {
          signalType: 'CASCADE_CHAIN_BROKEN',
          emittedAt,
          tickNumber: tickNumber as any,
          chainId: payload?.chainId,
          severity: payload?.severity,
        } as ChatUpstreamSignal;

      case 'CASCADE_POSITIVE_ACTIVATED':
        return {
          signalType: 'CASCADE_POSITIVE_ACTIVATED',
          emittedAt,
          tickNumber: tickNumber as any,
        } as ChatUpstreamSignal;

      case 'SOVEREIGNTY_APPROACH':
        return {
          signalType: 'SOVEREIGNTY_APPROACH',
          emittedAt,
          tickNumber: tickNumber as any,
        } as ChatUpstreamSignal;

      case 'SOVEREIGNTY_ACHIEVED':
        return {
          signalType: 'SOVEREIGNTY_ACHIEVED',
          emittedAt,
          tickNumber: tickNumber as any,
        } as ChatUpstreamSignal;

      case 'DEAL_PROOF_ISSUED':
        return {
          signalType: 'DEAL_PROOF_ISSUED',
          emittedAt,
          tickNumber: tickNumber as any,
        } as ChatUpstreamSignal;

      case 'RUN_STARTED':
        return {
          signalType: 'RUN_STARTED',
          emittedAt,
          tickNumber: tickNumber as any,
        } as ChatUpstreamSignal;

      case 'RUN_ENDED':
        return {
          signalType: 'RUN_ENDED',
          emittedAt,
          tickNumber: tickNumber as any,
        } as ChatUpstreamSignal;

      default:
        return null;
    }
  }

  // --------------------------------------------------------------------------
  // MARK: Core signal ingestion
  // --------------------------------------------------------------------------

  ingestUpstreamSignal(signal: ChatUpstreamSignal): void {
    if (this.destroyed) return;

    this.lastSignalAt = signal.emittedAt;
    const targetChannel = signalTargetChannel(signal, this.state.activeMountTarget);

    let next = this.state;
    next = setAffectInState(next, affectForSignal(signal, next.affect));
    next = setChannelMoodInState(next, targetChannel, moodForSignal(signal), signal.signalType, signal.emittedAt);
    next = setAudienceHeatInState(next, targetChannel, {
      ...this.mergeAudienceDelta(next.audienceHeat[targetChannel], audienceDeltaForSignal(signal)),
      lastUpdatedAt: signal.emittedAt,
    });

    const plan = this.planSignalReaction(signal, targetChannel);

    for (const message of plan.immediateMessages) {
      next = pushMessageToState(next, {
        channelId: message.channel,
        message,
      });
    }

    if (plan.scene) {
      next = setActiveSceneInState(next, plan.scene);
    }

    if (plan.silence) {
      next = beginSilenceInState(next, plan.silence);
    }

    if (plan.channelMood) {
      next = setChannelMoodInState(
        next,
        plan.channelMood.channelId,
        plan.channelMood.mood,
        plan.channelMood.reason,
        signal.emittedAt,
      );
    }

    if (plan.audienceHeatDelta) {
      const current = next.audienceHeat[targetChannel];
      next = setAudienceHeatInState(next, targetChannel, {
        heat: score100(current.heat + (plan.audienceHeatDelta.heat ?? 0)),
        hype: score100(current.hype + (plan.audienceHeatDelta.hype ?? 0)),
        ridicule: score100(current.ridicule + (plan.audienceHeatDelta.ridicule ?? 0)),
        scrutiny: score100(current.scrutiny + (plan.audienceHeatDelta.scrutiny ?? 0)),
        volatility: score100(current.volatility + (plan.audienceHeatDelta.volatility ?? 0)),
        lastUpdatedAt: signal.emittedAt,
      });
    }

    for (const delayed of plan.delayedMessages) {
      this.revealPayloads.set(delayed.schedule.payloadRef, delayed.message);
      next = scheduleRevealInState(next, delayed.schedule);
      this.emitEngineEvent('CHAT_REVEAL_SCHEDULED', { reveal: delayed.schedule });
    }

    this.commit(next);

    if (plan.scene) this.emitEngineEvent('CHAT_SCENE_STARTED', { scene: plan.scene });
    if (plan.silence) this.emitEngineEvent('CHAT_SILENCE_STARTED', { silence: plan.silence });

    if (plan.rescue) {
      this.emitEngineEvent('CHAT_RESCUE_TRIGGERED', { rescue: plan.rescue });
      this.commit(pushMessageToState(this.state, {
        channelId: plan.rescue.deliverInChannel,
        message: this.buildHelperRescueMessage(plan.rescue),
      }));
    }
  }

  private planSignalReaction(
    signal: ChatUpstreamSignal,
    targetChannel: ChatVisibleChannel,
  ): ChatSignalReactionPlan {
    const at = signal.emittedAt;
    const pressureBand = detectDominantPressure(
      this.runtimeInputs.run.pressureTier,
      this.runtimeInputs.battle.haterHeat,
    );

    const immediateMessages: ChatMessage[] = [];
    const delayedMessages: Array<{ schedule: ChatRevealSchedule; message: ChatMessage }> = [];

    const systemMessage = this.buildSystemReactionMessage(signal, targetChannel);
    if (systemMessage) immediateMessages.push(systemMessage);

    switch (signal.signalType) {
      case 'SHIELD_LAYER_BREACHED': {
        const hater = this.pickThreatPersona();
        const helper = HELPER_PERSONAS.SURVIVOR;
        const scene = this.buildScenePlan('SHIELD_BREACH', targetChannel, at, [
          { beatType: 'SYSTEM_NOTICE', delayMs: 0, requiredChannel: targetChannel, skippable: false, canInterrupt: true },
          { beatType: 'HATER_ENTRY', delayMs: 120, requiredChannel: targetChannel, skippable: false, canInterrupt: true },
          { beatType: 'HELPER_INTERVENTION', delayMs: 560, requiredChannel: targetChannel, skippable: false, canInterrupt: true },
        ]);

        delayedMessages.push(
          this.delayedPersonaLine(
            targetChannel,
            at + 120,
            'DELAYED_HATER',
            this.buildPersonaMessage(hater, targetChannel, 'HATER_TELEGRAPH', chooseOne(hater.telegraphs), at + 120),
          ),
          this.delayedPersonaLine(
            targetChannel,
            at + 560,
            'DELAYED_HELPER',
            this.buildPersonaMessage(helper, targetChannel, 'HELPER_RESCUE', chooseOne(helper.cues), at + 560),
          ),
        );

        return {
          immediateMessages,
          delayedMessages,
          scene,
          silence: {
            enforced: pressureBand === 'CRITICAL',
            durationMs: pressureBand === 'CRITICAL' ? 420 : 0,
            reason: pressureBand === 'CRITICAL' ? 'DREAD' : 'NONE',
            breakConditions: pressureBand === 'CRITICAL' ? ['PLAYER_REPLY_WINDOW', 'HELPER_RESCUE'] : [],
          },
          audienceHeatDelta: { heat: 8, scrutiny: 10 },
          channelMood: {
            channelId: targetChannel,
            mood: 'HOSTILE',
            reason: 'shield breach witnessed',
          },
          rescue: this.shouldTriggerRescue('breach')
            ? this.buildRescueDecision(targetChannel, at, 'CALM')
            : undefined,
        };
      }

      case 'BOT_ATTACK_FIRED': {
        const hater = this.pickThreatPersona(signal as any);
        const helper = pressureBand === 'CRITICAL' ? HELPER_PERSONAS.MENTOR : HELPER_PERSONAS.INSIDER;

        delayedMessages.push(
          this.delayedPersonaLine(
            targetChannel,
            at + 90,
            'DELAYED_HATER',
            this.buildPersonaMessage(hater, targetChannel, 'BOT_TAUNT', chooseOne(hater.taunts), at + 90),
          ),
        );

        if (pressureBand !== 'LOW') {
          delayedMessages.push(
            this.delayedPersonaLine(
              targetChannel,
              at + 420,
              'DELAYED_HELPER',
              this.buildPersonaMessage(helper, targetChannel, 'HELPER_PROMPT', chooseOne(helper.cues), at + 420),
            ),
          );
        }

        return {
          immediateMessages,
          delayedMessages,
          silence: {
            enforced: false,
            durationMs: 0,
            reason: 'NONE',
            breakConditions: [],
          },
          audienceHeatDelta: { heat: 10, volatility: 8 },
          channelMood: {
            channelId: targetChannel,
            mood: 'HOSTILE',
            reason: 'bot attack fired',
          },
        };
      }

      case 'CASCADE_CHAIN_STARTED': {
        const archivist = HELPER_PERSONAS.ARCHIVIST;
        delayedMessages.push(
          this.delayedPersonaLine(
            targetChannel,
            at + 380,
            'SCENE_STAGING',
            this.buildPersonaMessage(
              archivist,
              targetChannel,
              'RELATIONSHIP_CALLBACK',
              'The first consequence is rarely the only consequence. Respect the chain.',
              at + 380,
            ),
          ),
        );

        return {
          immediateMessages,
          delayedMessages,
          silence: {
            enforced: true,
            durationMs: 300,
            reason: 'SCENE_COMPOSITION',
            breakConditions: ['DELAYED_HELPER', 'PLAYER_REPLY_WINDOW'],
          },
          audienceHeatDelta: { scrutiny: 10, volatility: 12 },
          channelMood: {
            channelId: targetChannel,
            mood: 'SUSPICIOUS',
            reason: 'cascade chain started',
          },
        };
      }

      case 'CASCADE_CHAIN_BROKEN': {
        const rival = HELPER_PERSONAS.RIVAL;
        delayedMessages.push(
          this.delayedPersonaLine(
            targetChannel,
            at + 180,
            'DELAYED_HELPER',
            this.buildPersonaMessage(
              rival,
              targetChannel,
              'HELPER_PROMPT',
              'Good. Breaking chains is louder than surviving them.',
              at + 180,
            ),
          ),
        );

        return {
          immediateMessages,
          delayedMessages,
          audienceHeatDelta: { hype: 10, heat: 6 },
          channelMood: {
            channelId: targetChannel,
            mood: 'ECSTATIC',
            reason: 'cascade broken',
          },
        };
      }

      case 'SOVEREIGNTY_APPROACH': {
        const rival = HELPER_PERSONAS.RIVAL;
        const hater = this.pickThreatPersona();

        delayedMessages.push(
          this.delayedPersonaLine(
            targetChannel,
            at + 120,
            'DELAYED_HATER',
            this.buildPersonaMessage(
              hater,
              targetChannel,
              'HATER_TELEGRAPH',
              'You are close. Which means I need to be closer.',
              at + 120,
            ),
          ),
          this.delayedPersonaLine(
            targetChannel,
            at + 420,
            'DELAYED_HELPER',
            this.buildPersonaMessage(
              rival,
              targetChannel,
              'HELPER_PROMPT',
              'Do not blink because the finish line noticed you.',
              at + 420,
            ),
          ),
        );

        return {
          immediateMessages,
          delayedMessages,
          audienceHeatDelta: { hype: 12, scrutiny: 14 },
          channelMood: {
            channelId: targetChannel,
            mood: 'ECSTATIC',
            reason: 'sovereignty approach',
          },
        };
      }

      case 'SOVEREIGNTY_ACHIEVED': {
        const archivist = HELPER_PERSONAS.ARCHIVIST;
        immediateMessages.push(
          buildLocalSystemMessage({
            id: buildMessageId('legend'),
            channel: targetChannel,
            kind: 'LEGEND_MOMENT',
            body: 'LEGEND MOMENT — sovereignty achieved under witnessed pressure.',
            at,
            emoji: '🏆',
            legend: {
              legendClass: 'SOVEREIGNTY',
              title: 'Sovereignty Achieved',
              prestigeScore: 95,
              unlocksReward: true,
            },
            replay: {
              replayEligible: true,
              legendEligible: true,
              worldEventEligible: false,
            },
          }),
        );

        delayedMessages.push(
          this.delayedPersonaLine(
            targetChannel,
            at + 260,
            'SCENE_STAGING',
            this.buildPersonaMessage(
              archivist,
              targetChannel,
              'POST_RUN_RITUAL',
              'Archive this. The room will quote it later.',
              at + 260,
            ),
          ),
        );

        return {
          immediateMessages,
          delayedMessages,
          audienceHeatDelta: { hype: 18, heat: 12 },
          channelMood: {
            channelId: targetChannel,
            mood: 'ECSTATIC',
            reason: 'sovereignty achieved',
          },
        };
      }

      case 'RUN_STARTED': {
        if (targetChannel === 'LOBBY') {
          delayedMessages.push(
            this.delayedAmbientLine(targetChannel, at + 220, GLOBAL_AMBIENT_LINES[0]),
          );
        }

        return {
          immediateMessages,
          delayedMessages,
          channelMood: {
            channelId: targetChannel,
            mood: 'CALM',
            reason: 'run started',
          },
        };
      }

      case 'RUN_ENDED': {
        const survivor = HELPER_PERSONAS.SURVIVOR;
        delayedMessages.push(
          this.delayedPersonaLine(
            targetChannel,
            at + 300,
            'SCENE_STAGING',
            this.buildPersonaMessage(
              survivor,
              targetChannel,
              'POST_RUN_RITUAL',
              'The run is over. The lesson is not.',
              at + 300,
            ),
          ),
        );

        return {
          immediateMessages,
          delayedMessages,
          channelMood: {
            channelId: targetChannel,
            mood: 'MOURNFUL',
            reason: 'run ended',
          },
        };
      }

      default:
        return {
          immediateMessages,
          delayedMessages,
        };
    }
  }

  private buildSystemReactionMessage(
    signal: ChatUpstreamSignal,
    channel: ChatVisibleChannel,
  ): Nullable<ChatMessage> {
    const at = signal.emittedAt;
    const pressureTier = this.runtimeInputs.run.pressureTier;
    const tickTier = this.runtimeInputs.run.tickTier;

    switch (signal.signalType) {
      case 'PRESSURE_TIER_CHANGED':
        return buildLocalSystemMessage({
          id: buildMessageId('pressure'),
          channel,
          kind: 'MARKET_ALERT',
          body: `PRESSURE → ${safeString(signal.nextTier, 'UNKNOWN')}. The room should feel it now.`,
          at,
          emoji: '📈',
          pressureTier: signal.nextTier,
          tickTier,
        });

      case 'TICK_TIER_CHANGED':
        return buildLocalSystemMessage({
          id: buildMessageId('tick'),
          channel,
          kind: 'SYSTEM',
          body: `TICK TIER → ${safeString(signal.nextTier, 'UNKNOWN')}. Timing just got more expensive.`,
          at,
          emoji: '⏱️',
          pressureTier,
          tickTier: signal.nextTier,
        });

      case 'SHIELD_LAYER_BREACHED':
        return buildLocalSystemMessage({
          id: buildMessageId('shield-breach'),
          channel,
          kind: 'SHIELD_EVENT',
          body: `SHIELD BREACHED — ${safeString(signal.layerId, 'UNKNOWN_LAYER')} took the hit.`,
          at,
          emoji: '🛡️',
          pressureTier,
          tickTier,
        });

      case 'SHIELD_FORTIFIED':
        return buildLocalSystemMessage({
          id: buildMessageId('shield-fortified'),
          channel,
          kind: 'SHIELD_EVENT',
          body: 'SHIELD FORTIFIED — integrity recovered across the witnessed line.',
          at,
          emoji: '🛡️',
          pressureTier,
          tickTier,
        });

      case 'BOT_ATTACK_FIRED':
        return buildLocalSystemMessage({
          id: buildMessageId('bot-attack'),
          channel,
          kind: 'BOT_ATTACK',
          body: `HATER ATTACK FIRED — ${safeString(signal.botId, 'UNKNOWN_BOT')} opened an attack window.`,
          at,
          emoji: '⚔️',
          pressureTier,
          tickTier,
        });

      case 'CASCADE_CHAIN_STARTED':
        return buildLocalSystemMessage({
          id: buildMessageId('cascade-start'),
          channel,
          kind: 'CASCADE_ALERT',
          body: `CASCADE STARTED — ${safeString(signal.chainId, 'UNKNOWN_CHAIN')} is now live.`,
          at,
          emoji: '⛓️',
          pressureTier,
          tickTier,
        });

      case 'CASCADE_CHAIN_BROKEN':
        return buildLocalSystemMessage({
          id: buildMessageId('cascade-broken'),
          channel,
          kind: 'CASCADE_ALERT',
          body: `CASCADE BROKEN — ${safeString(signal.chainId, 'UNKNOWN_CHAIN')} was intercepted.`,
          at,
          emoji: '✂️',
          pressureTier,
          tickTier,
        });

      case 'SOVEREIGNTY_APPROACH':
        return buildLocalSystemMessage({
          id: buildMessageId('sovereignty-approach'),
          channel,
          kind: 'ACHIEVEMENT',
          body: 'SOVEREIGNTY APPROACH — the run is entering witnessed prestige territory.',
          at,
          emoji: '⚡',
          pressureTier,
          tickTier,
        });

      case 'SOVEREIGNTY_ACHIEVED':
        return buildLocalSystemMessage({
          id: buildMessageId('sovereignty-achieved'),
          channel,
          kind: 'ACHIEVEMENT',
          body: 'SOVEREIGNTY ACHIEVED — proof-grade finish reached.',
          at,
          emoji: '🏆',
          pressureTier,
          tickTier,
        });

      case 'RUN_STARTED':
        return buildLocalSystemMessage({
          id: buildMessageId('run-start'),
          channel,
          kind: 'SYSTEM',
          body: 'RUN STARTED — the room is live and already watching.',
          at,
          emoji: '▶️',
          pressureTier,
          tickTier,
        });

      case 'RUN_ENDED':
        return buildLocalSystemMessage({
          id: buildMessageId('run-end'),
          channel,
          kind: 'SYSTEM',
          body: `RUN ENDED — outcome: ${safeString(this.runtimeInputs.run.runOutcome, 'UNKNOWN')}.`,
          at,
          emoji: '⏹️',
          pressureTier,
          tickTier,
        });

      default:
        return null;
    }
  }

  private buildScenePlan(
    moment: string,
    channel: ChatVisibleChannel,
    at: UnixMs,
    beats: Array<{
      readonly beatType: ChatScenePlan['beats'][number]['beatType'];
      readonly delayMs: number;
      readonly requiredChannel: ChatVisibleChannel;
      readonly skippable: boolean;
      readonly canInterrupt: boolean;
    }>,
  ): ChatScenePlan {
    return {
      sceneId: randomId(`scene:${moment}`) as any,
      momentId: randomId(`moment:${moment}`) as any,
      momentType: moment as any,
      primaryChannel: channel,
      beats: beats.map((beat) => ({ ...beat })),
      startedAt: at,
      expectedDurationMs: beats.reduce((max, beat) => Math.max(max, beat.delayMs), 0),
      allowPlayerComposerDuringScene: true,
      cancellableByAuthoritativeEvent: true,
    };
  }

  private delayedPersonaLine(
    channelId: ChatVisibleChannel,
    revealAt: number,
    revealReason: ChatRevealSchedule['revealReason'],
    message: ChatMessage,
  ): { schedule: ChatRevealSchedule; message: ChatMessage } {
    const payloadRef = buildRevealPayloadRef(message.kind);
    return {
      schedule: {
        revealAt: revealAt as UnixMs,
        revealChannel: channelId,
        revealReason,
        payloadRef,
      },
      message,
    };
  }

  private delayedAmbientLine(
    channelId: ChatVisibleChannel,
    revealAt: number,
    line: string,
  ): { schedule: ChatRevealSchedule; message: ChatMessage } {
    return this.delayedPersonaLine(
      channelId,
      revealAt,
      'SCENE_STAGING',
      this.buildAmbientMessage(channelId, line, revealAt as UnixMs),
    );
  }

  private buildPersonaMessage(
    persona: ChatLocalPersona,
    channel: ChatVisibleChannel,
    kind: ChatMessage['kind'],
    body: string,
    at: UnixMs,
  ): ChatMessage {
    return {
      id: buildMessageId(kind),
      channel,
      kind,
      senderId: persona.actorId,
      senderName: persona.displayName,
      body,
      emoji: persona.emoji,
      ts: at,
      deliveryState: 'AUTHORITATIVE',
      moderation: {
        state: 'ALLOWED',
        playerVisible: true,
      },
    };
  }

  private buildAmbientMessage(
    channel: ChatVisibleChannel,
    line: string,
    at: UnixMs,
  ): ChatMessage {
    return {
      id: buildMessageId('ambient'),
      channel,
      kind: 'NPC_AMBIENT',
      senderId: `npc:ambient:${channel.toLowerCase()}`,
      senderName: channel === 'SYNDICATE' ? 'Syndicate Watcher' : 'Observer',
      body: line,
      ts: at,
      deliveryState: 'AUTHORITATIVE',
      moderation: {
        state: 'ALLOWED',
        playerVisible: true,
      },
    };
  }

  private buildHelperRescueMessage(
    rescue: ChatRescueDecision,
  ): ChatMessage {
    const helper =
      rescue.intent === 'CALM' || rescue.intent === 'PROTECT_DIGNITY'
        ? HELPER_PERSONAS.SURVIVOR
        : rescue.intent === 'WARN'
          ? HELPER_PERSONAS.INSIDER
          : HELPER_PERSONAS.MENTOR;

    return this.buildPersonaMessage(
      helper,
      rescue.deliverInChannel,
      'HELPER_RESCUE',
      chooseOne(helper.cues),
      rescue.triggerAt,
    );
  }

  private pickThreatPersona(signal?: { readonly botId?: BotId }): typeof HATER_PERSONAS[keyof typeof HATER_PERSONAS] {
    if (signal?.botId && HATER_PERSONAS[signal.botId]) return HATER_PERSONAS[signal.botId];
    const heat = this.runtimeInputs.battle.haterHeat ?? 0;
    if (heat >= 75) return HATER_PERSONAS.BOT_04;
    if (heat >= 60) return HATER_PERSONAS.BOT_01;
    if (heat >= 45) return HATER_PERSONAS.BOT_03;
    return HATER_PERSONAS.BOT_02;
  }

  private shouldTriggerRescue(reason: 'breach' | 'silence'): boolean {
    const affect = this.state.affect.vector;
    if (reason === 'breach') {
      return affect.frustration >= 55 || affect.intimidation >= 55 || affect.desperation >= 45;
    }
    return affect.frustration >= 60;
  }

  // ── Patched: uses ChatInterventionId — was missing from original file ─────
  private buildRescueDecision(
    channel: ChatVisibleChannel,
    at: UnixMs,
    intent: ChatRescueDecision['intent'],
  ): ChatRescueDecision {
    return {
      interventionId: randomId('rescue') as ChatInterventionId,
      intent,
      urgency: score100(intent === 'CALM' ? 65 : 55),
      helperPersonaId: intent === 'CALM' ? 'SURVIVOR' : 'MENTOR',
      deliverInChannel: channel,
      respectSilenceFirst: intent === 'CALM',
      triggerAt: at,
    };
  }

  private mergeAudienceDelta(
    current: ChatAudienceHeat,
    delta: Partial<Record<'heat' | 'hype' | 'ridicule' | 'scrutiny' | 'volatility', number>>,
  ): Partial<ChatAudienceHeat> {
    return {
      heat: score100(current.heat + (delta.heat ?? 0)),
      hype: score100(current.hype + (delta.hype ?? 0)),
      ridicule: score100(current.ridicule + (delta.ridicule ?? 0)),
      scrutiny: score100(current.scrutiny + (delta.scrutiny ?? 0)),
      volatility: score100(current.volatility + (delta.volatility ?? 0)),
    };
  }

  // --------------------------------------------------------------------------
  // MARK: Telemetry / feature snapshots — patched
  //       Uses TickTier, ChatConnectionState, ChatNotificationState as live
  //       typed references in the snapshot path.
  // --------------------------------------------------------------------------

  captureFeatureSnapshot(): ChatFeatureSnapshot {
    const now = this.now();
    const lastIncoming = this.lastMeaningfulIncomingAt || this.lastPanelOpenedAt || now;
    const silenceWindowMs = Math.max(0, now - lastIncoming);

    const connection: ChatConnectionState = this.getConnectionSnapshot();
    const notifications: ChatNotificationState = this.getNotificationSnapshot();
    const tickTier: TickTier | undefined = this.runtimeInputs.run.tickTier;

    return deriveFeatureSnapshotFromState(this.state, {
      now,
      panelOpen: this.panelOpen,
      currentMountTarget: this.state.activeMountTarget,
      activeChannel: this.state.activeVisibleChannel,
      composerLength: this.state.composer.draftByChannel[this.state.activeVisibleChannel].length,
      silenceWindowMs,
      pressureTier: this.runtimeInputs.run.pressureTier,
      tickTier,
      haterHeat: this.runtimeInputs.battle.haterHeat,
      dropOffSignals: {
        silenceAfterCollapseMs: silenceWindowMs,
        repeatedComposerDeletes: this.repeatedComposerDeletes,
        panelCollapseCount: this.panelCollapsed ? 1 : 0,
        channelHopCount: this.channelHopCount,
        failedInputCount: this.failedInputCount,
        negativeEmotionScore: Math.max(
          this.state.affect.vector.frustration,
          this.state.affect.vector.intimidation,
          this.state.affect.vector.desperation,
        ) as Score100,
      },
      connectionStatus: connection.status,
      hasUnread: notifications.hasAnyUnread,
    } as any);
  }

  private async emitTelemetry(
    eventName: ChatTelemetryEventName,
    payload: Record<string, unknown>,
    channelId?: ChatVisibleChannel,
  ): Promise<void> {
    if (!this.telemetry?.emit) return;

    const envelope: ChatTelemetryEnvelope = {
      telemetryId: randomId('telemetry') as any,
      eventName,
      occurredAt: this.now(),
      sessionId: this.state.connection.sessionId,
      roomId: this.resolveRoomId(),
      channelId,
      payload,
    };

    try {
      await this.telemetry.emit(envelope);
    } catch {
      //
    }
  }

  // --------------------------------------------------------------------------
  // MARK: Ambient pacing
  // --------------------------------------------------------------------------

  private scheduleAmbientPulse(): void {
    if (this.destroyed) return;
    if (this.ambientTimer != null) this.clock.clearTimeout(this.ambientTimer);

    const tickTier = this.runtimeInputs.run.tickTier;
    const delayMs = tickTier === 'COLLAPSE_IMMINENT'
      ? 3600
      : tickTier === 'CRISIS'
        ? 5200
        : tickTier === 'COMPRESSED'
          ? 7200
          : 9800;

    this.ambientTimer = this.clock.setTimeout(() => {
      if (this.destroyed) return;

      const channel = this.pickAmbientChannel();
      const line = chooseOne(
        channel === 'SYNDICATE'
          ? SYNDICATE_AMBIENT_LINES
          : channel === 'DEAL_ROOM'
            ? DEAL_ROOM_AMBIENT_LINES
            : GLOBAL_AMBIENT_LINES,
      );

      const message = this.buildAmbientMessage(channel, line, this.now());
      const next = pushMessageToState(this.state, {
        channelId: channel,
        message,
      });
      this.commit(next);
      this.scheduleAmbientPulse();
    }, delayMs);
  }

  private pickAmbientChannel(): ChatVisibleChannel {
    const mountTarget = this.state.activeMountTarget;
    const allowDeal = visibleChannelAllowedInMount(mountTarget, 'DEAL_ROOM');
    const allowSyndicate = visibleChannelAllowedInMount(mountTarget, 'SYNDICATE');
    const r = Math.random();

    if (allowDeal && r < 0.16) return 'DEAL_ROOM';
    if (allowSyndicate && r < 0.38) return 'SYNDICATE';
    if (visibleChannelAllowedInMount(mountTarget, 'LOBBY') && r < 0.48) return 'LOBBY';
    return 'GLOBAL';
  }

  // --------------------------------------------------------------------------
  // MARK: Maintenance loop
  // --------------------------------------------------------------------------

  private startMaintenanceLoop(): void {
    if (this.maintenanceInterval != null) this.clock.clearInterval(this.maintenanceInterval);

    this.maintenanceInterval = this.clock.setInterval(() => {
      if (this.destroyed) return;

      const now = this.now();
      let next = pruneExpiredTypingSnapshotsInState(this.state, now);

      const reveals = popDueRevealsFromState(next, now);
      next = reveals.state;

      for (const reveal of reveals.due) {
        const message = this.revealPayloads.get(reveal.payloadRef);
        if (!message) continue;

        next = pushMessageToState(next, {
          channelId: reveal.revealChannel,
          message: { ...message, ts: now },
        });

        this.revealPayloads.delete(reveal.payloadRef);
        this.emitEngineEvent('CHAT_REVEAL_FIRED', { reveal });
      }

      if (next.currentSilence && next.currentSilence.durationMs > 0) {
        const silenceEnd = this.lastSignalAt + next.currentSilence.durationMs;
        if (now >= silenceEnd) {
          next = endSilenceInState(next);
          this.emitEngineEvent('CHAT_SILENCE_ENDED', { endedAt: now });
        }
      }

      if (this.panelOpen) {
        next = markChannelReadInState(next, next.activeVisibleChannel);
      }

      if (this.shouldRunSilenceRescue(now)) {
        const rescue = this.buildRescueDecision(next.activeVisibleChannel, now, 'CALM');
        next = pushMessageToState(next, {
          channelId: rescue.deliverInChannel,
          message: this.buildHelperRescueMessage(rescue),
        });
        this.emitEngineEvent('CHAT_RESCUE_TRIGGERED', { rescue });
        this.lastMeaningfulIncomingAt = now;
      }

      if (next !== this.state) this.commit(next);
    }, 250);
  }

  private shouldRunSilenceRescue(now: UnixMs): boolean {
    if (!this.panelOpen) return false;
    if (this.state.currentSilence?.enforced) return false;

    const silenceMs = Math.max(
      0,
      now - (this.lastMeaningfulIncomingAt || this.lastPanelOpenedAt || now),
    );

    return silenceMs >= CHAT_ENGINE_CONSTANTS.rescueSilenceThresholdMs &&
      this.shouldTriggerRescue('silence');
  }

  // --------------------------------------------------------------------------
  // MARK: Relationships / learning / liveops public hooks
  // --------------------------------------------------------------------------

  setLearningProfile(profile?: ChatLearningProfile): void {
    const next = setLearningProfileInState(this.state, profile);
    this.commit(next);
    if (profile) this.emitEngineEvent('CHAT_PROFILE_UPDATED', { profile });
  }

  setLiveOps(liveOps: ChatLiveOpsState): void {
    const next = setLiveOpsStateInState(this.state, liveOps);
    this.commit(next);
    this.emitEngineEvent('CHAT_WORLD_EVENT_UPDATED', { liveOps });
  }

  upsertRelationship(relationship: Parameters<typeof upsertRelationshipInState>[1]): void {
    const next = upsertRelationshipInState(this.state, relationship);
    this.commit(next);
  }

  // --------------------------------------------------------------------------
  // MARK: Public typed diagnostic getters — patched
  // --------------------------------------------------------------------------

  getConnectionState(): Readonly<ChatConnectionState> {
    return this.getConnectionSnapshot();
  }

  getNotificationState(): Readonly<ChatNotificationState> {
    return this.getNotificationSnapshot();
  }

  getThreatBotState(): BotState {
    return this.inferThreatBotState();
  }

  // --------------------------------------------------------------------------
  // MARK: Cache / persistence
  // --------------------------------------------------------------------------

  private tryHydrateFromCache(): void {
    const raw = this.persistence.load(this.storageKey);
    if (!raw) return;
    this.state = hydrateChatStateFromCache(raw, {
      mountTarget: this.state.activeMountTarget,
      initialVisibleChannel: this.state.activeVisibleChannel,
      initialSessionId: this.state.connection.sessionId,
      initialLearningProfile: this.state.learningProfile,
    });
  }

  private persist(): void {
    try {
      this.persistence.save(
        this.storageKey,
        JSON.stringify(serializeChatStateForCache(this.state)),
      );
    } catch {
      //
    }
  }

  // --------------------------------------------------------------------------
  // MARK: Helpers / derived read models
  // --------------------------------------------------------------------------

  getSnapshot(): Readonly<ReturnType<typeof createChatEngineState>> {
    return this.state;
  }

  getActiveMessages(): readonly ChatMessage[] {
    return getActiveVisibleMessages(this.state);
  }

  getMessages(channelId: ChatVisibleChannel): readonly ChatMessage[] {
    return getMessagesForVisibleChannel(this.state, channelId);
  }

  getLatestMessage(channelId: ChatVisibleChannel = this.state.activeVisibleChannel): Nullable<ChatMessage> {
    return getLatestVisibleMessage(this.state, channelId);
  }

  getLegacyGameChatContext(events: readonly string[] = []): GameChatContext {
    return buildLegacyGameChatContext({
      tick: this.runtimeInputs.run.tickNumber,
      cash: this.runtimeInputs.run.netWorth,
      regime: this.runtimeInputs.mechanics.modeKey ?? 'STABLE',
      events,
      netWorth: this.runtimeInputs.run.netWorth,
      income: this.runtimeInputs.run.monthlyIncome,
      expenses: this.runtimeInputs.run.monthlyExpenses,
      pressureTier: this.runtimeInputs.run.pressureTier,
      tickTier: this.runtimeInputs.run.tickTier,
      haterHeat: this.runtimeInputs.battle.haterHeat,
    }) as unknown as GameChatContext;
  }

  getUnreadCount(): number {
    return countUnread(this.state);
  }

  private findMessageIdForRequest(requestId: ChatRequestId): Nullable<ChatMessageId> {
    const pending = this.pendingRequests.get(requestId);
    return pending?.messageId ?? null;
  }

  private resolveRoomId(): ChatRoomId {
    const existing = this.state.memberships[0]?.roomId;
    if (existing) return existing;
    return ('chat:room:local' as ChatRoomId);
  }

  private now(): UnixMs {
    return unixNow(this.clock);
  }

  // --------------------------------------------------------------------------
  // MARK: Destruction
  // --------------------------------------------------------------------------

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.ambientTimer != null) this.clock.clearTimeout(this.ambientTimer);
    if (this.maintenanceInterval != null) this.clock.clearInterval(this.maintenanceInterval);

    for (const unsub of this.eventBusUnsubs) unsub();
    this.eventBusUnsubs.length = 0;

    try {
      void this.transport?.disconnect?.('destroy');
    } catch {
      //
    }

    this.revealPayloads.clear();
    this.pendingRequests.clear();
    this.observers.clear();
    this.eventObservers.clear();
  }
}

// ============================================================================
// MARK: Safe helpers
// ============================================================================

function safeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'unknown error';
  }
}

// ============================================================================
// MARK: End
// ============================================================================