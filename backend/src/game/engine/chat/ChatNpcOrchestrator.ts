/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT NPC ORCHESTRATOR
 * FILE: backend/src/game/engine/chat/ChatNpcOrchestrator.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * High-level backend owner for NPC scheduling across ambient, helper, and hater
 * lanes. This module decides whether the room should receive NPC pressure,
 * support, atmosphere, or silence — and if so, which authored scene should be
 * proposed to downstream transcript ownership.
 *
 * Backend-truth question
 * ----------------------
 *
 *   "At this exact authoritative moment, should any non-player voice be allowed
 *    to enter the room, which class of NPC should speak first, should the room
 *    be held in silence instead, and should the result be a single line or a
 *    multi-message authored scene?"
 *
 * Design law
 * ----------
 * - message stamping is not owned here;
 * - moderation is not owned here;
 * - channel legality is not owned here;
 * - transcript mutation is not owned here;
 * - this file owns ordering, cadence, suppression, and authored scene choice;
 * - helper / ambient planning lives here directly;
 * - hater planning is delegated to HaterResponseOrchestrator.ts;
 * - invasion ownership remains in ChatInvasionOrchestrator.ts;
 * - reducer and engine consume this file as an orchestration authority.
 *
 * Why this file is large
 * ----------------------
 * Your locked backend tree explicitly separates ChatNpcOrchestrator,
 * HaterResponseOrchestrator, HelperResponseOrchestrator, and
 * ChatInvasionOrchestrator. Until all files land, this one must still do real
 * backend work rather than act as a placeholder. That means it has to:
 *
 * 1. evaluate NPC suppression law,
 * 2. understand room mood, channel posture, and occupancy,
 * 3. evaluate helper urgency from authoritative learning + gameplay state,
 * 4. decide whether ambient texture is better than direct pressure,
 * 5. delegate hostile judgment to the dedicated hater authority,
 * 6. rank multiple candidate scenes without flattening authored intent,
 * 7. optionally apply room-scene / silence side effects,
 * 8. remain deterministic enough for proof, replay, and testing.
 * ============================================================================
 */

import {
  asUnixMs,
  clamp01,
  type AttackType,
  type ChatAffectSnapshot,
  type ChatAudienceHeat,
  type ChatChannelId,
  type ChatEventId,
  type ChatLearningProfile,
  type ChatMessage,
  type ChatPersonaDescriptor,
  type ChatPersonaId,
  type ChatResponseCandidate,
  type ChatRoomId,
  type ChatRoomKind,
  type ChatRoomStageMood,
  type ChatRoomState,
  type ChatSceneId,
  type ChatScenePlan,
  type ChatSessionId,
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
  getActiveRoomInvasions,
  isRoomSilenced,
  pruneExpiredSilences,
  selectAudienceHeat,
  selectInferenceSnapshotsForUser,
  selectLearningProfile,
  selectRoomPresence,
  selectVisibleMessages,
  setRoomScene,
  setSilenceDecision,
} from './ChatState';
import {
  createHaterResponseAuthority,
  type HaterResponseAuthority,
  type HaterResponseOptions,
  type HaterResponsePlan,
  type HaterTriggerContext,
} from './HaterResponseOrchestrator';

// ============================================================================
// MARK: Ports, options, and context
// ============================================================================

export interface ChatNpcLoggerPort {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface ChatNpcClockPort {
  now(): UnixMs;
}

export interface ChatNpcRandomPort {
  next(): number;
}

export interface ChatNpcIdFactoryPort {
  sceneId(prefix?: string): ChatSceneId;
}

export interface ChatNpcOrchestratorOptions {
  readonly logger?: ChatNpcLoggerPort;
  readonly clock?: ChatNpcClockPort;
  readonly random?: ChatNpcRandomPort;
  readonly ids?: ChatNpcIdFactoryPort;
  readonly runtimeOptions?: ChatRuntimeConfigOptions;
  readonly runtimeOverride?: Partial<typeof DEFAULT_BACKEND_CHAT_RUNTIME>;
  readonly haterOptions?: HaterResponseOptions;
  readonly allowAmbientScenes?: boolean;
  readonly allowHelperScenes?: boolean;
  readonly allowSilenceWindows?: boolean;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly helperCooldownFloorMs?: number;
  readonly ambientCooldownFloorMs?: number;
  readonly silenceAfterHardHelperMs?: number;
  readonly silenceAfterRuthlessHaterMs?: number;
  readonly lowOccupancyAmbientBlock?: number;
}

export interface ChatNpcContext {
  readonly logger: ChatNpcLoggerPort;
  readonly clock: ChatNpcClockPort;
  readonly random: ChatNpcRandomPort;
  readonly ids: ChatNpcIdFactoryPort;
  readonly runtimeOptions?: ChatRuntimeConfigOptions;
  readonly runtimeOverride?: Partial<typeof DEFAULT_BACKEND_CHAT_RUNTIME>;
  readonly haterAuthority: HaterResponseAuthority;
  readonly allowAmbientScenes: boolean;
  readonly allowHelperScenes: boolean;
  readonly allowSilenceWindows: boolean;
  readonly defaultVisibleChannel: ChatVisibleChannel;
  readonly helperCooldownFloorMs: number;
  readonly ambientCooldownFloorMs: number;
  readonly silenceAfterHardHelperMs: number;
  readonly silenceAfterRuthlessHaterMs: number;
  readonly lowOccupancyAmbientBlock: number;
}

// ============================================================================
// MARK: Trigger, suppression, and plan contracts
// ============================================================================

export type ChatNpcTriggerKind =
  | 'MAINTENANCE_TICK'
  | 'PLAYER_ACCEPTED_MESSAGE'
  | 'SIGNAL'
  | 'SESSION_JOIN_ACCEPTED'
  | 'INVASION_STATE_CHANGED'
  | 'POST_HELPER'
  | 'POST_HATER'
  | 'POST_RUN';

export interface ChatNpcTriggerContext {
  readonly kind: ChatNpcTriggerKind;
  readonly state: ChatState;
  readonly room: ChatRoomState;
  readonly now: UnixMs;
  readonly causeEventId: Nullable<ChatEventId>;
  readonly signal?: ChatSignalEnvelope | null;
  readonly acceptedPlayerMessage?: ChatMessage | null;
  readonly preferredVisibleChannel?: ChatVisibleChannel | null;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface ChatNpcSuppressionDecision {
  readonly allowed: boolean;
  readonly reasons: readonly string[];
  readonly blockingReasons: readonly string[];
  readonly activeVisibleOccupants: number;
  readonly roomSilenced: boolean;
  readonly activeInvasionCount: number;
  readonly currentMood: ChatRoomStageMood;
}

export interface ChatHelperPersonaProfile extends ChatPersonaDescriptor {
  readonly helperStyle: 'BLUNT' | 'CALM' | 'TACTICAL' | 'MENTOR';
  readonly anchorRoomKinds: readonly ChatRoomKind[];
  readonly anchorMoods: readonly ChatRoomStageMood[];
  readonly rescueBias01: number;
  readonly confidenceBias01: number;
  readonly lines: Readonly<Record<HelperTactic, readonly string[]>>;
  readonly followups: readonly string[];
}

export interface ChatAmbientPersonaProfile extends ChatPersonaDescriptor {
  readonly ambientStyle: 'CROWD' | 'ROOM' | 'NARRATOR';
  readonly anchorRoomKinds: readonly ChatRoomKind[];
  readonly anchorMoods: readonly ChatRoomStageMood[];
  readonly quietBias01: number;
  readonly lines: Readonly<Record<AmbientTactic, readonly string[]>>;
}

export type HelperTactic =
  | 'STEADY_HAND'
  | 'RAPID_REFRAME'
  | 'ONE_CARD_EXIT'
  | 'CONFIDENCE_RESET'
  | 'SHIELD_TRIAGE'
  | 'DEALROOM_WARNING'
  | 'SILENT_SUPPORT';

export type AmbientTactic =
  | 'ROOM_WITNESS'
  | 'CROWD_MURMUR'
  | 'BREATH_AFTER_CHAOS'
  | 'WATCHFUL_SILENCE'
  | 'LATE_ECHO';

export interface HelperUrgencyVector {
  readonly roomId: ChatRoomId;
  readonly rescueWindow01: Score01;
  readonly frustration01: Score01;
  readonly embarrassment01: Score01;
  readonly churn01: Score01;
  readonly silenceRisk01: Score01;
  readonly shieldEmergency01: Score01;
  readonly finalUrgency01: Score01;
  readonly tactic: HelperTactic;
}

export interface HelperPlan {
  readonly accepted: boolean;
  readonly reasons: readonly string[];
  readonly urgency: Nullable<HelperUrgencyVector>;
  readonly persona: Nullable<ChatHelperPersonaProfile>;
  readonly scene: Nullable<ChatScenePlan>;
  readonly primaryCandidate: Nullable<ChatResponseCandidate>;
  readonly secondaryCandidates: readonly ChatResponseCandidate[];
}

export interface AmbientPlan {
  readonly accepted: boolean;
  readonly reasons: readonly string[];
  readonly persona: Nullable<ChatAmbientPersonaProfile>;
  readonly tactic: Nullable<AmbientTactic>;
  readonly scene: Nullable<ChatScenePlan>;
  readonly primaryCandidate: Nullable<ChatResponseCandidate>;
}

export type ChatNpcSelectionRole = 'HATER' | 'HELPER' | 'AMBIENT' | 'NONE';

export interface ChatNpcSelection {
  readonly role: ChatNpcSelectionRole;
  readonly reasons: readonly string[];
  readonly scene: Nullable<ChatScenePlan>;
  readonly primaryCandidate: Nullable<ChatResponseCandidate>;
  readonly secondaryCandidates: readonly ChatResponseCandidate[];
  readonly silence: Nullable<ChatSilenceDecision>;
}

export interface ChatNpcOrchestrationPlan {
  readonly accepted: boolean;
  readonly reasons: readonly string[];
  readonly suppression: ChatNpcSuppressionDecision;
  readonly helper: HelperPlan;
  readonly ambient: AmbientPlan;
  readonly hater: HaterResponsePlan;
  readonly selected: ChatNpcSelection;
  readonly telemetryHints: Readonly<Record<string, JsonValue>>;
}

export interface ChatNpcMaintenanceRecord {
  readonly roomId: ChatRoomId;
  readonly action: 'PRESERVED' | 'SCENE_CLEARED' | 'SILENCE_CLEARED' | 'SILENCE_PRESERVED';
  readonly reason: string;
}

export interface ChatNpcMaintenanceReport {
  readonly records: readonly ChatNpcMaintenanceRecord[];
}

// ============================================================================
// MARK: Persona registries
// ============================================================================

export const HELPER_PERSONAS = Object.freeze({
  anchor: createHelperPersona({
    personaId: 'persona:helper:anchor' as ChatPersonaId,
    actorId: 'npc:helper:anchor',
    role: 'HELPER',
    displayName: 'ANCHOR',
    botId: null,
    voiceprint: {
      punctuationStyle: 'SOFT',
      avgSentenceLength: 12,
      delayFloorMs: 550,
      delayCeilingMs: 1600,
      opener: 'Breathe.',
      closer: 'Stay with the line.',
      lexicon: ['steady', 'hold', 'line', 'breathe', 'recover'],
    },
    preferredChannels: ['GLOBAL', 'SYNDICATE', 'RESCUE_SHADOW'],
    tags: ['helper', 'calm', 'stability'],
    helperStyle: 'CALM',
    anchorRoomKinds: ['GLOBAL', 'SYNDICATE', 'LOBBY'],
    anchorMoods: ['TENSE', 'MOURNFUL', 'HOSTILE'],
    rescueBias01: 0.92,
    confidenceBias01: 0.68,
    lines: {
      STEADY_HAND: [
        'Do not answer the room yet. Stabilize first.',
        'Reset the breath before you touch the board again.',
        'Hold your posture. Let the noise spend itself first.',
      ],
      RAPID_REFRAME: [
        'This is not over. It is just louder than it was a moment ago.',
        'The room wants panic. Give it discipline instead.',
        'You do not need a miracle. You need one clean decision.',
      ],
      ONE_CARD_EXIT: [
        'Take the smallest safe line. Survival first, style later.',
        'Find the one-card recovery and buy time.',
        'Shrink the problem. One move. Then breathe again.',
      ],
      CONFIDENCE_RESET: [
        'You are still in this. Separate the hit from the story you are telling yourself.',
        'Do not narrate defeat before the numbers do.',
        'Confidence can be rebuilt faster than the room expects.',
      ],
      SHIELD_TRIAGE: [
        'Shield first. Everything else waits.',
        'Repair the barrier or the room owns the tempo.',
        'Treat shield integrity like oxygen.',
      ],
      DEALROOM_WARNING: [
        'Do not negotiate while your pulse is visible.',
        'Step back before you price your fear into the deal.',
        'The deal room is measuring your urgency right now.',
      ],
      SILENT_SUPPORT: [
        'I am still here.',
        'You do not need to say anything yet.',
        'Hold. Just hold.',
      ],
    },
    followups: [
      'Good. Smaller. Cleaner. Stay there.',
      'Keep the room outside the decision for one more beat.',
      'That was enough to keep the floor under you.',
    ],
  }),
  mercy: createHelperPersona({
    personaId: 'persona:helper:mercy' as ChatPersonaId,
    actorId: 'npc:helper:mercy',
    role: 'HELPER',
    displayName: 'MERCY',
    botId: null,
    voiceprint: {
      punctuationStyle: 'SOFT',
      avgSentenceLength: 14,
      delayFloorMs: 750,
      delayCeilingMs: 1800,
      opener: 'Listen.',
      closer: 'You are not done.',
      lexicon: ['grace', 'again', 'still', 'rise', 'gentle'],
    },
    preferredChannels: ['GLOBAL', 'SYNDICATE', 'LOBBY', 'RESCUE_SHADOW'],
    tags: ['helper', 'recovery', 'mercy'],
    helperStyle: 'MENTOR',
    anchorRoomKinds: ['GLOBAL', 'LOBBY', 'SYNDICATE'],
    anchorMoods: ['MOURNFUL', 'TENSE', 'CEREMONIAL'],
    rescueBias01: 0.88,
    confidenceBias01: 0.90,
    lines: {
      STEADY_HAND: [
        'The room does not get to define you from one collapse.',
        'You can recover without performing recovery for them.',
        'Let the moment hurt. Do not let it become your identity.',
      ],
      RAPID_REFRAME: [
        'A bad turn is not a verdict.',
        'The fall is information, not authorship.',
        'The room is loud because it wants the story early. Deny it that.',
      ],
      ONE_CARD_EXIT: [
        'Take the plain line. Dignity often looks boring in the middle of chaos.',
        'You do not owe the room spectacle. You owe yourself survival.',
        'Choose the line that keeps your future open.',
      ],
      CONFIDENCE_RESET: [
        'Confidence is not noise. Confidence is return.',
        'Stand back up inside first. The room can wait.',
        'They only win this moment if you start agreeing with them.',
      ],
      SHIELD_TRIAGE: [
        'Protect the core. Pride can come later.',
        'Repair what keeps you in the game.',
        'Treat defense as permission to continue, not a sign of weakness.',
      ],
      DEALROOM_WARNING: [
        'Do not bargain from pain.',
        'Any deal made from panic will cost more than it saves.',
        'Silence is cheaper than desperate negotiation.',
      ],
      SILENT_SUPPORT: [
        'Still here.',
        'You can take this quietly.',
        'No rush. No performance.',
      ],
    },
    followups: [
      'That is enough for now. Continue from there.',
      'The room felt that shift even if it pretends otherwise.',
      'Keep choosing yourself over their noise.',
    ],
  }),
  kade: createHelperPersona({
    personaId: 'persona:helper:kade' as ChatPersonaId,
    actorId: 'npc:helper:kade',
    role: 'HELPER',
    displayName: 'KADE',
    botId: null,
    voiceprint: {
      punctuationStyle: 'HARD',
      avgSentenceLength: 7,
      delayFloorMs: 300,
      delayCeilingMs: 900,
      opener: 'Fast.',
      closer: 'Move.',
      lexicon: ['cut', 'clean', 'now', 'line', 'tight'],
    },
    preferredChannels: ['GLOBAL', 'DEAL_ROOM', 'RESCUE_SHADOW'],
    tags: ['helper', 'tactical', 'blunt'],
    helperStyle: 'TACTICAL',
    anchorRoomKinds: ['GLOBAL', 'DEAL_ROOM', 'LOBBY'],
    anchorMoods: ['HOSTILE', 'PREDATORY', 'TENSE'],
    rescueBias01: 0.82,
    confidenceBias01: 0.54,
    lines: {
      STEADY_HAND: [
        'Stop reacting. Start choosing.',
        'Tighten the line and kill the noise.',
        'Less emotion. More sequence.',
      ],
      RAPID_REFRAME: [
        'Bad beat. Good data. Use it.',
        'You are wasting time arguing with a turn that already happened.',
        'Reset. Re-enter. Punish the next opening.',
      ],
      ONE_CARD_EXIT: [
        'One clean out. Take it.',
        'Find the cheap escape and live.',
        'Shrink the board. Exit the trap.',
      ],
      CONFIDENCE_RESET: [
        'Do not look hurt in public. Fix the line first.',
        'Confidence later. Execution now.',
        'You need precision, not pride.',
      ],
      SHIELD_TRIAGE: [
        'Patch shield. Immediately.',
        'Barrier first. Nothing else matters till then.',
        'If the shield goes, the room goes feral.',
      ],
      DEALROOM_WARNING: [
        'Do not show urgency in the deal room.',
        'If they smell panic, the price moves against you.',
        'Walk away before the room prices your fear.',
      ],
      SILENT_SUPPORT: [
        'I see it.',
        'Hold position.',
        'Wait for the cleaner line.',
      ],
    },
    followups: [
      'Better. Stay cold.',
      'That bought you one more cycle. Use it.',
      'Now punish the next mistake.',
    ],
  }),
});

export const AMBIENT_PERSONAS = Object.freeze({
  floor: createAmbientPersona({
    personaId: 'persona:ambient:floor' as ChatPersonaId,
    actorId: 'npc:ambient:floor',
    role: 'AMBIENT',
    displayName: 'THE FLOOR',
    botId: null,
    voiceprint: {
      punctuationStyle: 'SOFT',
      avgSentenceLength: 9,
      delayFloorMs: 1300,
      delayCeilingMs: 2800,
      opener: null,
      closer: null,
      lexicon: ['room', 'watching', 'still', 'hush', 'echo'],
    },
    preferredChannels: ['GLOBAL', 'SYNDICATE', 'LOBBY', 'NPC_SHADOW'],
    tags: ['ambient', 'room', 'witness'],
    ambientStyle: 'ROOM',
    anchorRoomKinds: ['GLOBAL', 'SYNDICATE', 'LOBBY'],
    anchorMoods: ['CALM', 'TENSE', 'MOURNFUL', 'CEREMONIAL'],
    quietBias01: 0.92,
    lines: {
      ROOM_WITNESS: [
        'The room is still watching the last exchange settle.',
        'Nobody is moving fast. That usually means the moment mattered.',
        'Even the quiet in here has an opinion now.',
      ],
      CROWD_MURMUR: [
        'A low murmur drifts across the room.',
        'Someone laughs under their breath. Someone else stops.',
        'The crowd does not erupt. It leans in.',
      ],
      BREATH_AFTER_CHAOS: [
        'For a second, the room remembers how to breathe.',
        'The noise thins, but it does not leave.',
        'There is a brief pocket of air after the hit.',
      ],
      WATCHFUL_SILENCE: [
        'No one speaks. That says enough.',
        'The silence is not empty. It is loaded.',
        'The room is waiting to see who moves first.',
      ],
      LATE_ECHO: [
        'The earlier line comes back around the room a little quieter, a little sharper.',
        'What was said before is still moving through the walls.',
        'A delayed echo touches the room and leaves everyone slightly more still.',
      ],
    },
  }),
  crowd: createAmbientPersona({
    personaId: 'persona:ambient:crowd' as ChatPersonaId,
    actorId: 'npc:ambient:crowd',
    role: 'AMBIENT',
    displayName: 'THE CROWD',
    botId: null,
    voiceprint: {
      punctuationStyle: 'ERRATIC',
      avgSentenceLength: 5,
      delayFloorMs: 900,
      delayCeilingMs: 1900,
      opener: null,
      closer: null,
      lexicon: ['ooo', 'look', 'huh', 'damn', 'watch'],
    },
    preferredChannels: ['GLOBAL', 'LOBBY'],
    tags: ['ambient', 'crowd', 'stage'],
    ambientStyle: 'CROWD',
    anchorRoomKinds: ['GLOBAL', 'LOBBY'],
    anchorMoods: ['HOSTILE', 'ECSTATIC', 'TENSE'],
    quietBias01: 0.28,
    lines: {
      ROOM_WITNESS: [
        'The crowd clocks it instantly.',
        'A few people stop typing just to watch.',
        'The room feels a little tighter now.',
      ],
      CROWD_MURMUR: [
        'A ripple moves across the channel.',
        'The crowd starts talking at once, then almost stops.',
        'A laugh, a hiss, a held breath.',
      ],
      BREATH_AFTER_CHAOS: [
        'The crowd exhales in pieces.',
        'The noise drops half a step.',
        'Even hype has to blink sometimes.',
      ],
      WATCHFUL_SILENCE: [
        'For once, the crowd knows when to shut up.',
        'A rare hush spreads across the channel.',
        'The room goes strangely disciplined for a beat.',
      ],
      LATE_ECHO: [
        'Somebody repeats the earlier line. Nobody laughs this time.',
        'The room keeps chewing on what just happened.',
        'The echo lands late and somehow harder.',
      ],
    },
  }),
  witness: createAmbientPersona({
    personaId: 'persona:ambient:witness' as ChatPersonaId,
    actorId: 'npc:ambient:witness',
    role: 'NARRATOR',
    displayName: 'THE WITNESS',
    botId: null,
    voiceprint: {
      punctuationStyle: 'FORMAL',
      avgSentenceLength: 13,
      delayFloorMs: 1600,
      delayCeilingMs: 3200,
      opener: null,
      closer: null,
      lexicon: ['observed', 'moment', 'record', 'room', 'threshold'],
    },
    preferredChannels: ['GLOBAL', 'SYNDICATE', 'NPC_SHADOW'],
    tags: ['ambient', 'narrator', 'ritual'],
    ambientStyle: 'NARRATOR',
    anchorRoomKinds: ['GLOBAL', 'SYNDICATE', 'SYSTEM'],
    anchorMoods: ['CEREMONIAL', 'MOURNFUL', 'CALM'],
    quietBias01: 0.86,
    lines: {
      ROOM_WITNESS: [
        'The room records the moment before deciding what it means.',
        'A threshold has been crossed, though the room has not yet named it.',
        'Everyone present understands something shifted, even if nobody says it cleanly.',
      ],
      CROWD_MURMUR: [
        'The reaction does not crest. It gathers.',
        'The room refrains from spectacle and becomes more dangerous for it.',
        'What moves through the channel now is not noise but interpretation.',
      ],
      BREATH_AFTER_CHAOS: [
        'In the aftermath, the room becomes briefly honest.',
        'For a second, the channel belongs to aftermath instead of appetite.',
        'The room gives the event enough air to become memory.',
      ],
      WATCHFUL_SILENCE: [
        'Silence settles over the room like formal observation.',
        'No one interrupts. Even that feels authored.',
        'The channel enters a witness posture.',
      ],
      LATE_ECHO: [
        'The earlier line returns as context rather than drama.',
        'What was spoken before now arrives as a quiet verdict.',
        'The room rediscovers the prior moment with greater precision.',
      ],
    },
  }),
});

// ============================================================================
// MARK: Authority façade
// ============================================================================

export class ChatNpcAuthority {
  private readonly context: ChatNpcContext;

  constructor(options: ChatNpcOrchestratorOptions = {}) {
    this.context = createNpcContext(options);
  }

  contextValue(): ChatNpcContext {
    return this.context;
  }

  plan(trigger: ChatNpcTriggerContext): ChatNpcOrchestrationPlan {
    return planNpcTurn(trigger, this.context);
  }

  apply(state: ChatState, plan: ChatNpcOrchestrationPlan): ChatState {
    return applyNpcPlan(state, plan);
  }

  maintenance(state: ChatState, now: UnixMs): { state: ChatState; report: ChatNpcMaintenanceReport } {
    return maintainNpcArtifacts(state, now, this.context);
  }
}

export function createNpcAuthority(options: ChatNpcOrchestratorOptions = {}): ChatNpcAuthority {
  return new ChatNpcAuthority(options);
}

// ============================================================================
// MARK: Context creation
// ============================================================================

export function createNpcContext(options: ChatNpcOrchestratorOptions = {}): ChatNpcContext {
  return Object.freeze({
    logger: options.logger ?? createDefaultNpcLogger(),
    clock: options.clock ?? createDefaultNpcClock(),
    random: options.random ?? createDefaultNpcRandom(),
    ids: options.ids ?? createDefaultNpcIds(),
    runtimeOptions: options.runtimeOptions,
    runtimeOverride: options.runtimeOverride,
    haterAuthority: createHaterResponseAuthority({
      ...options.haterOptions,
      runtimeOptions: options.haterOptions?.runtimeOptions ?? options.runtimeOptions,
      runtimeOverride: options.haterOptions?.runtimeOverride ?? options.runtimeOverride,
    }),
    allowAmbientScenes: options.allowAmbientScenes ?? true,
    allowHelperScenes: options.allowHelperScenes ?? true,
    allowSilenceWindows: options.allowSilenceWindows ?? true,
    defaultVisibleChannel: options.defaultVisibleChannel ?? 'GLOBAL',
    helperCooldownFloorMs: Math.max(1_000, options.helperCooldownFloorMs ?? 7_500),
    ambientCooldownFloorMs: Math.max(1_000, options.ambientCooldownFloorMs ?? 5_500),
    silenceAfterHardHelperMs: Math.max(500, options.silenceAfterHardHelperMs ?? 2_200),
    silenceAfterRuthlessHaterMs: Math.max(500, options.silenceAfterRuthlessHaterMs ?? 1_500),
    lowOccupancyAmbientBlock: Math.max(0, options.lowOccupancyAmbientBlock ?? 1),
  });
}

export function createDefaultNpcLogger(): ChatNpcLoggerPort {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

export function createDefaultNpcClock(): ChatNpcClockPort {
  return {
    now: () => asUnixMs(Date.now()),
  };
}

export function createDefaultNpcRandom(): ChatNpcRandomPort {
  return {
    next: () => Math.random(),
  };
}

export function createDefaultNpcIds(): ChatNpcIdFactoryPort {
  return {
    sceneId: (prefix = 'scene') => `${prefix}_${Date.now()}_${randomBase36(8)}` as ChatSceneId,
  };
}

// ============================================================================
// MARK: Public planning
// ============================================================================

export function planNpcTurn(
  trigger: ChatNpcTriggerContext,
  context: ChatNpcContext,
): ChatNpcOrchestrationPlan {
  const suppression = evaluateNpcSuppression(trigger, context);
  const reasons = [...suppression.reasons];

  if (!suppression.allowed) {
    return {
      accepted: false,
      reasons: Object.freeze([...reasons, ...suppression.blockingReasons]),
      suppression,
      helper: rejectHelperPlan('npc suppression blocked helper'),
      ambient: rejectAmbientPlan('npc suppression blocked ambient'),
      hater: context.haterAuthority.plan(toHaterTrigger(trigger, null)),
      selected: rejectNpcSelection('npc suppressed'),
      telemetryHints: Object.freeze({ accepted: false, blocked: suppression.blockingReasons.join('|') }),
    };
  }

  const helper = planHelperResponse(trigger, context);
  const ambient = planAmbientResponse(trigger, context);
  const hater = context.haterAuthority.plan(toHaterTrigger(trigger, trigger.acceptedPlayerMessage ?? null));

  const selected = selectNpcWinner({ trigger, helper, ambient, hater, context });
  reasons.push(...selected.reasons);

  return {
    accepted: selected.role !== 'NONE' && Boolean(selected.primaryCandidate || selected.scene),
    reasons: Object.freeze(reasons),
    suppression,
    helper,
    ambient,
    hater,
    selected,
    telemetryHints: Object.freeze({
      accepted: selected.role !== 'NONE',
      selectedRole: selected.role,
      selectedScene: selected.scene?.label ?? null,
      helperAccepted: helper.accepted,
      ambientAccepted: ambient.accepted,
      haterAccepted: hater.accepted,
    }),
  };
}

// ============================================================================
// MARK: Suppression law
// ============================================================================

export function evaluateNpcSuppression(
  trigger: ChatNpcTriggerContext,
  context: ChatNpcContext,
): ChatNpcSuppressionDecision {
  const runtime = resolveNpcRuntime(context);
  const reasons: string[] = [];
  const blockingReasons: string[] = [];
  const room = trigger.room;
  const state = trigger.state;
  const now = trigger.now;
  const visibleOccupants = selectRoomPresence(state, room.roomId).filter((value) => value.visibleToRoom).length;
  const invasions = getActiveRoomInvasions(state, room.roomId);
  const silenced = isRoomSilenced(state, room.roomId, now);

  if (!runtime.allowVisibleChannels.includes(room.activeVisibleChannel)) {
    blockingReasons.push('runtime disallows room active visible channel');
  }

  if (visibleOccupants === 0 && trigger.kind !== 'SESSION_JOIN_ACCEPTED') {
    blockingReasons.push('room has no visible occupants');
  }

  if (silenced && trigger.kind !== 'POST_HATER' && trigger.kind !== 'POST_HELPER') {
    blockingReasons.push('room currently inside backend silence window');
  }

  if (trigger.kind === 'SIGNAL') {
    reasons.push(`signal:${trigger.signal?.type ?? 'unknown'}`);
  }

  if (invasions.length > 0) {
    reasons.push('room under invasion posture');
  }

  return {
    allowed: blockingReasons.length === 0,
    reasons: Object.freeze(reasons),
    blockingReasons: Object.freeze(blockingReasons),
    activeVisibleOccupants: visibleOccupants,
    roomSilenced: silenced,
    activeInvasionCount: invasions.length,
    currentMood: room.stageMood,
  };
}

// ============================================================================
// MARK: Helper planning
// ============================================================================

export function planHelperResponse(
  trigger: ChatNpcTriggerContext,
  context: ChatNpcContext,
): HelperPlan {
  if (!context.allowHelperScenes) {
    return rejectHelperPlan('helper scenes disabled');
  }

  const urgency = computeHelperUrgency(trigger, context);
  const reasons = [`helperUrgency:${Number(urgency.finalUrgency01).toFixed(2)}`, `tactic:${urgency.tactic}`];

  if (Number(urgency.finalUrgency01) < 0.28) {
    return rejectHelperPlan('helper urgency below threshold', urgency);
  }

  const persona = chooseHelperPersona(trigger, urgency, context);
  reasons.push(`persona:${persona.displayName}`);

  const channelId = resolveHelperChannelId(trigger, persona, context);
  reasons.push(`channel:${channelId}`);

  const primaryCandidate = createHelperCandidate({
    trigger,
    persona,
    urgency,
    channelId,
    text: composeHelperLine(trigger, urgency, persona, context),
    delayMs: resolveHelperDelayMs(persona, urgency),
    priority: resolveHelperPriority(urgency),
  });

  const secondaryCandidates = shouldCreateHelperFollowup(urgency)
    ? createHelperFollowups({ trigger, persona, urgency, channelId, context })
    : Object.freeze([]) as readonly ChatResponseCandidate[];

  const scene = createHelperSceneIfNeeded({
    trigger,
    persona,
    urgency,
    primaryCandidate,
    secondaryCandidates,
    context,
  });

  return {
    accepted: true,
    reasons: Object.freeze(reasons),
    urgency,
    persona,
    scene,
    primaryCandidate,
    secondaryCandidates,
  };
}

export function computeHelperUrgency(
  trigger: ChatNpcTriggerContext,
  context: ChatNpcContext,
): HelperUrgencyVector {
  const roomId = trigger.room.roomId;
  const targetUserId = resolveCurrentTargetUserId(trigger);
  const learning = targetUserId ? selectLearningProfile(trigger.state, targetUserId) : null;
  const inference = targetUserId ? selectInferenceSnapshotsForUser(trigger.state, targetUserId).at(-1) ?? null : null;
  const heat = selectAudienceHeat(trigger.state, roomId);
  const rescueWindow01 = asScore01(scoreHelperRescueWindow(trigger.signal ?? null));
  const frustration01 = asScore01(scoreAffectDimension(learning?.affect, 'frustration01'));
  const embarrassment01 = asScore01(scoreAffectDimension(learning?.affect, 'embarrassment01'));
  const churn01 = asScore01(inference ? Number(inference.churnRisk01) : learning ? Number(learning.churnRisk01) : 0.08);
  const silenceRisk01 = asScore01(scoreSilenceRisk(trigger, heat));
  const shieldEmergency01 = asScore01(scoreShieldEmergency(trigger.signal ?? null));

  const weighted =
    Number(rescueWindow01) * 0.22 +
    Number(frustration01) * 0.20 +
    Number(embarrassment01) * 0.12 +
    Number(churn01) * 0.18 +
    Number(silenceRisk01) * 0.12 +
    Number(shieldEmergency01) * 0.16;

  return {
    roomId,
    rescueWindow01,
    frustration01,
    embarrassment01,
    churn01,
    silenceRisk01,
    shieldEmergency01,
    finalUrgency01: asScore01(weighted),
    tactic: deriveHelperTactic({
      rescueWindow01,
      frustration01,
      embarrassment01,
      churn01,
      silenceRisk01,
      shieldEmergency01,
      trigger,
    }),
  };
}

export function chooseHelperPersona(
  trigger: ChatNpcTriggerContext,
  urgency: HelperUrgencyVector,
  context: ChatNpcContext,
): ChatHelperPersonaProfile {
  const candidates = Object.values(HELPER_PERSONAS).map((persona) => ({
    persona,
    score: scoreHelperPersona(persona, trigger, urgency, context),
  }));
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.persona ?? HELPER_PERSONAS.anchor;
}

export function scoreHelperPersona(
  persona: ChatHelperPersonaProfile,
  trigger: ChatNpcTriggerContext,
  urgency: HelperUrgencyVector,
  _context: ChatNpcContext,
): number {
  let score = persona.rescueBias01 * 0.25;
  if (persona.anchorRoomKinds.includes(trigger.room.roomKind)) {
    score += 0.18;
  }
  if (persona.anchorMoods.includes(trigger.room.stageMood)) {
    score += 0.14;
  }
  if (urgency.tactic === 'CONFIDENCE_RESET') {
    score += persona.confidenceBias01 * 0.18;
  }
  if (urgency.tactic === 'SHIELD_TRIAGE' && persona.helperStyle === 'TACTICAL') {
    score += 0.18;
  }
  if (urgency.tactic === 'ONE_CARD_EXIT' && persona.helperStyle === 'CALM') {
    score += 0.12;
  }
  if (urgency.tactic === 'DEALROOM_WARNING' && persona.helperStyle !== 'MENTOR') {
    score += 0.08;
  }
  return score;
}

export function resolveHelperChannelId(
  trigger: ChatNpcTriggerContext,
  persona: ChatHelperPersonaProfile,
  context: ChatNpcContext,
): ChatChannelId {
  if (persona.preferredChannels.includes(trigger.room.activeVisibleChannel)) {
    return trigger.room.activeVisibleChannel;
  }
  if (trigger.room.roomKind === 'DEAL_ROOM' && persona.preferredChannels.includes('DEAL_ROOM')) {
    return 'DEAL_ROOM';
  }
  if (persona.preferredChannels.includes(context.defaultVisibleChannel)) {
    return context.defaultVisibleChannel;
  }
  return trigger.room.activeVisibleChannel;
}

export function createHelperCandidate(args: {
  readonly trigger: ChatNpcTriggerContext;
  readonly persona: ChatHelperPersonaProfile;
  readonly urgency: HelperUrgencyVector;
  readonly channelId: ChatChannelId;
  readonly text: string;
  readonly delayMs: number;
  readonly priority: number;
}): ChatResponseCandidate {
  return {
    personaId: args.persona.personaId,
    roomId: args.trigger.room.roomId,
    channelId: args.channelId,
    priority: args.priority,
    text: normalizeOutboundText(args.text),
    tags: Object.freeze([
      'npc',
      'helper',
      `tactic:${args.urgency.tactic}`,
      `trigger:${args.trigger.kind}`,
      `room:${args.trigger.room.roomKind}`,
    ]),
    delayMs: Math.max(0, Math.floor(args.delayMs)),
    moderationBypassAllowed: false,
    causeEventId: args.trigger.causeEventId,
  };
}

export function composeHelperLine(
  trigger: ChatNpcTriggerContext,
  urgency: HelperUrgencyVector,
  persona: ChatHelperPersonaProfile,
  context: ChatNpcContext,
): string {
  const bank = persona.lines[urgency.tactic];
  const base = chooseLine(bank, context.random);
  return maybeWrapHelperVoiceprint(base, urgency, persona);
}

export function maybeWrapHelperVoiceprint(
  text: string,
  urgency: HelperUrgencyVector,
  persona: ChatHelperPersonaProfile,
): string {
  let next = text;
  if (persona.voiceprint.opener && Number(urgency.finalUrgency01) >= 0.52) {
    next = `${persona.voiceprint.opener} ${next}`;
  }
  if (persona.voiceprint.closer && (urgency.tactic === 'CONFIDENCE_RESET' || urgency.tactic === 'STEADY_HAND')) {
    next = `${next} ${persona.voiceprint.closer}`;
  }
  return next;
}

export function createHelperFollowups(args: {
  readonly trigger: ChatNpcTriggerContext;
  readonly persona: ChatHelperPersonaProfile;
  readonly urgency: HelperUrgencyVector;
  readonly channelId: ChatChannelId;
  readonly context: ChatNpcContext;
}): readonly ChatResponseCandidate[] {
  const follow = chooseLine(args.persona.followups, args.context.random);
  return Object.freeze([
    createHelperCandidate({
      trigger: args.trigger,
      persona: args.persona,
      urgency: args.urgency,
      channelId: args.channelId,
      text: follow,
      delayMs: resolveHelperFollowupDelayMs(args.persona, args.urgency),
      priority: Math.max(1, resolveHelperPriority(args.urgency) - 10),
    }),
  ]);
}

export function createHelperSceneIfNeeded(args: {
  readonly trigger: ChatNpcTriggerContext;
  readonly persona: ChatHelperPersonaProfile;
  readonly urgency: HelperUrgencyVector;
  readonly primaryCandidate: ChatResponseCandidate;
  readonly secondaryCandidates: readonly ChatResponseCandidate[];
  readonly context: ChatNpcContext;
}): Nullable<ChatScenePlan> {
  if (args.secondaryCandidates.length === 0) {
    return null;
  }
  if (Number(args.urgency.finalUrgency01) < 0.56) {
    return null;
  }
  return {
    sceneId: args.context.ids.sceneId('helper_scene'),
    roomId: args.trigger.room.roomId,
    label: 'HELPER_INTERVENTION',
    openedAt: args.trigger.now,
    messages: Object.freeze([args.primaryCandidate, ...args.secondaryCandidates]),
    silence: args.context.allowSilenceWindows
      ? createHelperSilence(args.trigger.room.roomId, args.trigger.now, args.context.silenceAfterHardHelperMs)
      : null,
    legendCandidate: false,
  };
}

export function resolveHelperPriority(urgency: HelperUrgencyVector): number {
  const value = Number(urgency.finalUrgency01);
  if (value >= 0.82) {
    return 90;
  }
  if (value >= 0.64) {
    return 78;
  }
  if (value >= 0.48) {
    return 66;
  }
  return 52;
}

export function resolveHelperDelayMs(
  persona: ChatHelperPersonaProfile,
  urgency: HelperUrgencyVector,
): number {
  const floor = persona.voiceprint.delayFloorMs;
  const ceiling = persona.voiceprint.delayCeilingMs;
  const ratio = Math.max(0, Math.min(1, 1 - Number(urgency.finalUrgency01)));
  return Math.floor(floor + (ceiling - floor) * ratio);
}

export function resolveHelperFollowupDelayMs(
  persona: ChatHelperPersonaProfile,
  urgency: HelperUrgencyVector,
): number {
  return Math.floor(resolveHelperDelayMs(persona, urgency) + 1200);
}

export function shouldCreateHelperFollowup(urgency: HelperUrgencyVector): boolean {
  return Number(urgency.finalUrgency01) >= 0.58 || urgency.tactic === 'CONFIDENCE_RESET';
}

export function scoreHelperRescueWindow(signal: Nullable<ChatSignalEnvelope>): number {
  return signal?.battle?.rescueWindowOpen ? 1 : 0.08;
}

export function scoreAffectDimension(
  affect: Nullable<ChatAffectSnapshot> | undefined,
  key: keyof ChatAffectSnapshot,
): number {
  return affect ? Number(affect[key]) : 0.1;
}

export function scoreSilenceRisk(
  trigger: ChatNpcTriggerContext,
  heat: Nullable<ChatAudienceHeat>,
): number {
  const latestPlayer = trigger.acceptedPlayerMessage ?? null;
  const playerWentQuiet = latestPlayer ? latestPlayer.plainText.trim().length <= 2 : trigger.kind === 'MAINTENANCE_TICK';
  return Math.min(1, (playerWentQuiet ? 0.46 : 0.08) + (heat ? Number(heat.heat01) * 0.22 : 0));
}

export function scoreShieldEmergency(signal: Nullable<ChatSignalEnvelope>): number {
  if (!signal?.battle) {
    return 0.08;
  }
  return 1 - Number(signal.battle.shieldIntegrity01);
}

export function deriveHelperTactic(args: {
  readonly rescueWindow01: Score01;
  readonly frustration01: Score01;
  readonly embarrassment01: Score01;
  readonly churn01: Score01;
  readonly silenceRisk01: Score01;
  readonly shieldEmergency01: Score01;
  readonly trigger: ChatNpcTriggerContext;
}): HelperTactic {
  if (Number(args.shieldEmergency01) >= 0.72) {
    return 'SHIELD_TRIAGE';
  }
  if (args.trigger.signal?.economy && Number(args.trigger.signal.economy.overpayRisk01) >= 0.55) {
    return 'DEALROOM_WARNING';
  }
  if (Number(args.churn01) >= 0.70 && Number(args.frustration01) >= 0.55) {
    return 'ONE_CARD_EXIT';
  }
  if (Number(args.embarrassment01) >= 0.62) {
    return 'CONFIDENCE_RESET';
  }
  if (Number(args.silenceRisk01) >= 0.58) {
    return 'SILENT_SUPPORT';
  }
  if (Number(args.rescueWindow01) >= 0.5) {
    return 'RAPID_REFRAME';
  }
  return 'STEADY_HAND';
}

export function rejectHelperPlan(reason: string, urgency: Nullable<HelperUrgencyVector> = null): HelperPlan {
  return {
    accepted: false,
    reasons: Object.freeze([reason]),
    urgency,
    persona: null,
    scene: null,
    primaryCandidate: null,
    secondaryCandidates: Object.freeze([]),
  };
}

// ============================================================================
// MARK: Ambient planning
// ============================================================================

export function planAmbientResponse(
  trigger: ChatNpcTriggerContext,
  context: ChatNpcContext,
): AmbientPlan {
  if (!context.allowAmbientScenes) {
    return rejectAmbientPlan('ambient scenes disabled');
  }

  const visibleOccupants = selectRoomPresence(trigger.state, trigger.room.roomId).filter((value) => value.visibleToRoom).length;
  if (visibleOccupants <= context.lowOccupancyAmbientBlock) {
    return rejectAmbientPlan('ambient blocked by low occupancy');
  }

  const heat = selectAudienceHeat(trigger.state, trigger.room.roomId);
  const tactic = chooseAmbientTactic(trigger, heat);
  const persona = chooseAmbientPersona(trigger, tactic, context);
  const reasons = [`ambientTactic:${tactic}`, `persona:${persona.displayName}`];
  const channelId = resolveAmbientChannelId(trigger, persona, context);
  reasons.push(`channel:${channelId}`);

  const primaryCandidate = createAmbientCandidate({
    trigger,
    persona,
    tactic,
    channelId,
    text: composeAmbientLine(tactic, persona, context),
    priority: resolveAmbientPriority(trigger.room.stageMood, heat),
    delayMs: resolveAmbientDelayMs(persona, heat),
  });

  const scene = shouldAmbientBecomeScene(trigger, tactic, heat)
    ? createAmbientScene({ trigger, persona, primaryCandidate, context })
    : null;

  return {
    accepted: true,
    reasons: Object.freeze(reasons),
    persona,
    tactic,
    scene,
    primaryCandidate,
  };
}

export function chooseAmbientTactic(
  trigger: ChatNpcTriggerContext,
  heat: Nullable<ChatAudienceHeat>,
): AmbientTactic {
  if (trigger.kind === 'POST_RUN') {
    return 'LATE_ECHO';
  }
  if (trigger.kind === 'MAINTENANCE_TICK' && (!heat || Number(heat.heat01) < 0.34)) {
    return 'WATCHFUL_SILENCE';
  }
  if (trigger.room.stageMood === 'CALM' || trigger.room.stageMood === 'MOURNFUL') {
    return 'BREATH_AFTER_CHAOS';
  }
  if (heat && Number(heat.heat01) >= 0.60) {
    return 'CROWD_MURMUR';
  }
  return 'ROOM_WITNESS';
}

export function chooseAmbientPersona(
  trigger: ChatNpcTriggerContext,
  tactic: AmbientTactic,
  _context: ChatNpcContext,
): ChatAmbientPersonaProfile {
  const candidates = Object.values(AMBIENT_PERSONAS).map((persona) => ({
    persona,
    score: scoreAmbientPersona(persona, trigger, tactic),
  }));
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.persona ?? AMBIENT_PERSONAS.floor;
}

export function scoreAmbientPersona(
  persona: ChatAmbientPersonaProfile,
  trigger: ChatNpcTriggerContext,
  tactic: AmbientTactic,
): number {
  let score = persona.quietBias01 * 0.20;
  if (persona.anchorRoomKinds.includes(trigger.room.roomKind)) {
    score += 0.24;
  }
  if (persona.anchorMoods.includes(trigger.room.stageMood)) {
    score += 0.20;
  }
  if (tactic === 'CROWD_MURMUR' && persona.ambientStyle === 'CROWD') {
    score += 0.26;
  }
  if (tactic === 'WATCHFUL_SILENCE' && persona.ambientStyle === 'ROOM') {
    score += 0.20;
  }
  if (tactic === 'LATE_ECHO' && persona.ambientStyle === 'NARRATOR') {
    score += 0.22;
  }
  return score;
}

export function resolveAmbientChannelId(
  trigger: ChatNpcTriggerContext,
  persona: ChatAmbientPersonaProfile,
  context: ChatNpcContext,
): ChatChannelId {
  if (persona.preferredChannels.includes(trigger.room.activeVisibleChannel)) {
    return trigger.room.activeVisibleChannel;
  }
  if (persona.preferredChannels.includes(context.defaultVisibleChannel)) {
    return context.defaultVisibleChannel;
  }
  return trigger.room.activeVisibleChannel;
}

export function createAmbientCandidate(args: {
  readonly trigger: ChatNpcTriggerContext;
  readonly persona: ChatAmbientPersonaProfile;
  readonly tactic: AmbientTactic;
  readonly channelId: ChatChannelId;
  readonly text: string;
  readonly priority: number;
  readonly delayMs: number;
}): ChatResponseCandidate {
  return {
    personaId: args.persona.personaId,
    roomId: args.trigger.room.roomId,
    channelId: args.channelId,
    priority: args.priority,
    text: normalizeOutboundText(args.text),
    tags: Object.freeze([
      'npc',
      'ambient',
      `tactic:${args.tactic}`,
      `room:${args.trigger.room.roomKind}`,
    ]),
    delayMs: Math.max(0, Math.floor(args.delayMs)),
    moderationBypassAllowed: false,
    causeEventId: args.trigger.causeEventId,
  };
}

export function composeAmbientLine(
  tactic: AmbientTactic,
  persona: ChatAmbientPersonaProfile,
  context: ChatNpcContext,
): string {
  return chooseLine(persona.lines[tactic], context.random);
}

export function resolveAmbientPriority(
  mood: ChatRoomStageMood,
  heat: Nullable<ChatAudienceHeat>,
): number {
  const base = mood === 'CALM' || mood === 'MOURNFUL' ? 38 : 30;
  const heatPenalty = heat ? Number(heat.heat01) * 10 : 0;
  return Math.max(14, Math.floor(base - heatPenalty));
}

export function resolveAmbientDelayMs(
  persona: ChatAmbientPersonaProfile,
  heat: Nullable<ChatAudienceHeat>,
): number {
  const floor = persona.voiceprint.delayFloorMs;
  const ceiling = persona.voiceprint.delayCeilingMs;
  const ratio = heat ? Number(heat.heat01) : 0.18;
  return Math.floor(floor + (ceiling - floor) * Math.max(0, Math.min(1, ratio)));
}

export function shouldAmbientBecomeScene(
  trigger: ChatNpcTriggerContext,
  tactic: AmbientTactic,
  heat: Nullable<ChatAudienceHeat>,
): boolean {
  return trigger.kind === 'POST_RUN' || tactic === 'LATE_ECHO' || Boolean(heat && Number(heat.heat01) < 0.22);
}

export function createAmbientScene(args: {
  readonly trigger: ChatNpcTriggerContext;
  readonly persona: ChatAmbientPersonaProfile;
  readonly primaryCandidate: ChatResponseCandidate;
  readonly context: ChatNpcContext;
}): ChatScenePlan {
  return {
    sceneId: args.context.ids.sceneId('ambient_scene'),
    roomId: args.trigger.room.roomId,
    label: 'AMBIENT_ROOM_BEAT',
    openedAt: args.trigger.now,
    messages: Object.freeze([args.primaryCandidate]),
    silence: null,
    legendCandidate: false,
  };
}

export function rejectAmbientPlan(reason: string): AmbientPlan {
  return {
    accepted: false,
    reasons: Object.freeze([reason]),
    persona: null,
    tactic: null,
    scene: null,
    primaryCandidate: null,
  };
}

// ============================================================================
// MARK: Winner selection
// ============================================================================

export function selectNpcWinner(args: {
  readonly trigger: ChatNpcTriggerContext;
  readonly helper: HelperPlan;
  readonly ambient: AmbientPlan;
  readonly hater: HaterResponsePlan;
  readonly context: ChatNpcContext;
}): ChatNpcSelection {
  const reasons: string[] = [];

  const haterPriority = args.hater.accepted
    ? args.hater.artifacts.primaryCandidate?.priority ?? 0
    : 0;
  const helperPriority = args.helper.accepted
    ? args.helper.primaryCandidate?.priority ?? 0
    : 0;
  const ambientPriority = args.ambient.accepted
    ? args.ambient.primaryCandidate?.priority ?? 0
    : 0;

  if (args.helper.accepted && helperPriority >= haterPriority && helperPriority >= ambientPriority) {
    reasons.push('helper outranked all other npc plans');
    const silence = args.context.allowSilenceWindows && args.helper.urgency && Number(args.helper.urgency.finalUrgency01) >= 0.64
      ? createHelperSilence(args.trigger.room.roomId, args.trigger.now, args.context.silenceAfterHardHelperMs)
      : null;
    return {
      role: 'HELPER',
      reasons: Object.freeze(reasons),
      scene: args.helper.scene,
      primaryCandidate: args.helper.primaryCandidate,
      secondaryCandidates: args.helper.secondaryCandidates,
      silence,
    };
  }

  if (args.hater.accepted && haterPriority >= ambientPriority) {
    reasons.push('hater outranked ambient and helper did not override');
    const ruthless = args.hater.hostility?.escalationBand === 'RUTHLESS' ||
      args.hater.hostility?.escalationBand === 'CEREMONIAL_EXECUTION';
    const silence = args.context.allowSilenceWindows && ruthless
      ? createHaterSilence(args.trigger.room.roomId, args.trigger.now, args.context.silenceAfterRuthlessHaterMs)
      : null;
    return {
      role: 'HATER',
      reasons: Object.freeze(reasons),
      scene: args.hater.artifacts.scene,
      primaryCandidate: args.hater.artifacts.primaryCandidate,
      secondaryCandidates: args.hater.artifacts.secondaryCandidates,
      silence,
    };
  }

  if (args.ambient.accepted) {
    reasons.push('ambient won because no stronger helper/hater scene was selected');
    return {
      role: 'AMBIENT',
      reasons: Object.freeze(reasons),
      scene: args.ambient.scene,
      primaryCandidate: args.ambient.primaryCandidate,
      secondaryCandidates: Object.freeze([]),
      silence: null,
    };
  }

  return rejectNpcSelection('no accepted npc candidate won selection');
}

export function rejectNpcSelection(reason: string): ChatNpcSelection {
  return {
    role: 'NONE',
    reasons: Object.freeze([reason]),
    scene: null,
    primaryCandidate: null,
    secondaryCandidates: Object.freeze([]),
    silence: null,
  };
}

// ============================================================================
// MARK: State application and maintenance
// ============================================================================

export function applyNpcPlan(state: ChatState, plan: ChatNpcOrchestrationPlan): ChatState {
  let next = state;
  if (plan.selected.scene) {
    next = setRoomScene(next, plan.selected.scene.roomId, plan.selected.scene.sceneId);
  }
  if (plan.selected.silence) {
    const silenceRoomId = plan.selected.scene?.roomId ?? plan.selected.primaryCandidate?.roomId ?? null;
    if (silenceRoomId) {
      next = setSilenceDecision(next, silenceRoomId, plan.selected.silence);
    }
  }
  return next;
}

export function maintainNpcArtifacts(
  state: ChatState,
  now: UnixMs,
  _context: ChatNpcContext,
): { state: ChatState; report: ChatNpcMaintenanceReport } {
  let next = pruneExpiredSilences(state, now);
  const records: ChatNpcMaintenanceRecord[] = [];

  for (const room of Object.values(next.rooms)) {
    const roomId = room.roomId;
    const silence = next.silencesByRoom[roomId] ?? null;
    if (!silence && room.activeSceneId) {
      next = setRoomScene(next, roomId, null);
      records.push({ roomId, action: 'SCENE_CLEARED', reason: 'no active silence retained; scene anchor cleared' });
      continue;
    }

    if (silence) {
      records.push({ roomId, action: 'SILENCE_PRESERVED', reason: 'silence still active' });
    } else {
      records.push({ roomId, action: 'PRESERVED', reason: 'no npc maintenance changes required' });
    }
  }

  return {
    state: next,
    report: {
      records: Object.freeze(records),
    },
  };
}

// ============================================================================
// MARK: Shared helpers
// ============================================================================

export function toHaterTrigger(
  trigger: ChatNpcTriggerContext,
  playerMessage: Nullable<ChatMessage>,
): HaterTriggerContext {
  return {
    kind:
      trigger.kind === 'PLAYER_ACCEPTED_MESSAGE' ? 'PLAYER_MESSAGE' :
      trigger.kind === 'SIGNAL' && trigger.signal?.type === 'BATTLE' ? 'BATTLE_SIGNAL' :
      trigger.kind === 'SIGNAL' && trigger.signal?.type === 'ECONOMY' ? 'ECONOMY_SIGNAL' :
      trigger.kind === 'SIGNAL' && trigger.signal?.type === 'LIVEOPS' ? 'LIVEOPS_SIGNAL' :
      trigger.kind === 'INVASION_STATE_CHANGED' ? 'POST_INVASION' :
      trigger.kind === 'POST_HELPER' ? 'POST_HELPER' :
      trigger.kind === 'SESSION_JOIN_ACCEPTED' ? 'ROOM_ENTRY' :
      'AMBIENT_MAINTENANCE',
    state: trigger.state,
    room: trigger.room,
    now: trigger.now,
    causeEventId: trigger.causeEventId,
    signal: trigger.signal ?? null,
    playerMessage,
    preferredChannelId: trigger.preferredVisibleChannel ?? null,
    metadata: trigger.metadata,
  };
}

export function resolveNpcRuntime(context: ChatNpcContext) {
  return mergeRuntimeConfig(context.runtimeOverride ?? {}, context.runtimeOptions);
}

export function resolveCurrentTargetUserId(
  trigger: ChatNpcTriggerContext,
): Nullable<ChatLearningProfile['userId']> {
  return trigger.acceptedPlayerMessage?.attribution.authorUserId ?? null;
}

export function createHelperSilence(roomId: ChatRoomId, now: UnixMs, durationMs: number): ChatSilenceDecision {
  return {
    active: true,
    startedAt: now,
    endsAt: asUnixMs(Number(now) + durationMs),
    reason: `helper_intervention:${roomId}`,
  };
}

export function createHaterSilence(roomId: ChatRoomId, now: UnixMs, durationMs: number): ChatSilenceDecision {
  return {
    active: true,
    startedAt: now,
    endsAt: asUnixMs(Number(now) + durationMs),
    reason: `hater_aftershock:${roomId}`,
  };
}

export function chooseLine(lines: readonly string[], random: ChatNpcRandomPort): string {
  if (lines.length === 0) {
    return '...';
  }
  const index = Math.floor(random.next() * lines.length) % lines.length;
  return lines[index] ?? lines[0] ?? '...';
}

export function createHelperPersona(profile: ChatHelperPersonaProfile): ChatHelperPersonaProfile {
  return Object.freeze(profile);
}

export function createAmbientPersona(profile: ChatAmbientPersonaProfile): ChatAmbientPersonaProfile {
  return Object.freeze(profile);
}

export function asScore01(value: number): Score01 {
  return clamp01(value) as Score01;
}

export function normalizeOutboundText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function randomBase36(length: number): string {
  return Math.random().toString(36).slice(2, 2 + length).padEnd(length, '0');
}

// ============================================================================
// MARK: Diagnostics
// ============================================================================

export function describeNpcPlan(plan: ChatNpcOrchestrationPlan): string {
  return [
    `accepted=${plan.accepted}`,
    `selected=${plan.selected.role}`,
    `helper=${plan.helper.accepted}`,
    `ambient=${plan.ambient.accepted}`,
    `hater=${plan.hater.accepted}`,
    `reasons=${plan.reasons.join('|')}`,
  ].join(' :: ');
}
