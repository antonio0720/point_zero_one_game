
/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND HELPER RESPONSE ORCHESTRATOR
 * FILE: backend/src/game/engine/chat/HelperResponseOrchestrator.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend owner for chat-native helper intervention planning.
 *
 * Backend-truth question
 * ----------------------
 *
 *   "Given authoritative room state, transcript truth, live gameplay signals,
 *    invasion posture, crowd heat, learning posture, and the player's present
 *    affect, should a helper intervene right now, which helper should do it,
 *    how hard should they intervene, which channel should carry the response,
 *    and should the response be a single line, a rescue sequence, or a short
 *    silence-backed scene?"
 *
 * Design doctrine
 * ---------------
 * - This file does not own transcript mutation.
 * - This file does not own moderation or rate law.
 * - This file does not own transport fanout.
 * - This file does not bypass channel law.
 * - This file does own backend helper judgment and authored rescue planning.
 * - It produces explainable intervention plans that the authoritative backend
 *   chat lane may accept, reject, defer, or combine with higher-order NPC
 *   orchestration.
 *
 * Why this file is deep
 * ---------------------
 * Your backend tree explicitly separates helper timing and helper response
 * authority from UI-side hinting. That means helper orchestration cannot be a
 * one-line encouragement picker. It must:
 *
 * 1. understand rescue windows, churn posture, embarrassment posture,
 *    frustration, shield stress, negotiation panic, and silence risk;
 * 2. select a helper persona whose style matches the present state rather than
 *    repeating one generic rescue voice;
 * 3. adapt to room kind, room mood, invasion posture, crowd heat, and learned
 *    helper receptivity;
 * 4. turn authoritative gameplay truth into chat-native intervention tactics;
 * 5. decide whether to support publicly, quietly, tactically, or not at all;
 * 6. build single-line or multi-line candidate scenes with delays and silence;
 * 7. stay deterministic enough to support replay, proof, and downstream audit;
 * 8. remain backend-pure and compilable without depending on frontend donor
 *    kernels or transport ownership.
 * ============================================================================
 */

import {
  asUnixMs,
  clamp01,
  type ChatAffectSnapshot,
  type ChatAudienceHeat,
  type ChatChannelId,
  type ChatEventId,
  type ChatInferenceSnapshot,
  type ChatLearningProfile,
  type ChatMessage,
  type ChatPersonaDescriptor,
  type ChatPersonaId,
  type ChatRelationshipState,
  type ChatResponseCandidate,
  type ChatRoomId,
  type ChatUserId,
  type ChatRoomKind,
  type ChatRoomStageMood,
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

export type { ChatRelationshipState, ChatUserId };

import {
  DEFAULT_BACKEND_CHAT_RUNTIME,
  mergeRuntimeConfig,
  type ChatRuntimeConfigOptions,
} from './ChatRuntimeConfig';
import {
  getActiveRoomInvasions,
  isRoomSilenced,
  pruneExpiredSilences,
  selectAudienceHeat,
  selectInferenceSnapshotsForUser,
  selectLatestMessage,
  selectLearningProfile,
  selectRelationshipForActor,
  selectRoomPresence,
  selectVisibleMessages,
  setRoomScene,
  setSilenceDecision,
} from './ChatState';

// ============================================================================
// MARK: Ports, options, and context
// ============================================================================

export interface HelperResponseLoggerPort {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface HelperResponseClockPort {
  now(): UnixMs;
}

export interface HelperResponseRandomPort {
  next(): number;
}

export interface HelperResponseIdFactoryPort {
  sceneId(prefix?: string): ChatSceneId;
}

export interface HelperResponseOptions {
  readonly logger?: HelperResponseLoggerPort;
  readonly clock?: HelperResponseClockPort;
  readonly random?: HelperResponseRandomPort;
  readonly ids?: HelperResponseIdFactoryPort;
  readonly runtimeOptions?: ChatRuntimeConfigOptions;
  readonly runtimeOverride?: Partial<typeof DEFAULT_BACKEND_CHAT_RUNTIME>;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly allowCinematicScenes?: boolean;
  readonly allowPrivateShadowSupport?: boolean;
  readonly allowRescueSilenceWindows?: boolean;
  readonly minimumUrgencyToSpeak01?: number;
  readonly minimumUrgencyToScene01?: number;
  readonly helperReceptivityWeight01?: number;
  readonly relationshipWeight01?: number;
  readonly inferenceWeight01?: number;
  readonly shameWeight01?: number;
  readonly dealRiskWeight01?: number;
  readonly helperBlackoutOverridesCritical?: boolean;
}

export interface HelperResponseContext {
  readonly logger: HelperResponseLoggerPort;
  readonly clock: HelperResponseClockPort;
  readonly random: HelperResponseRandomPort;
  readonly ids: HelperResponseIdFactoryPort;
  readonly runtimeOptions?: ChatRuntimeConfigOptions;
  readonly runtimeOverride?: Partial<typeof DEFAULT_BACKEND_CHAT_RUNTIME>;
  readonly defaultVisibleChannel: ChatVisibleChannel;
  readonly allowCinematicScenes: boolean;
  readonly allowPrivateShadowSupport: boolean;
  readonly allowRescueSilenceWindows: boolean;
  readonly minimumUrgencyToSpeak01: number;
  readonly minimumUrgencyToScene01: number;
  readonly helperReceptivityWeight01: number;
  readonly relationshipWeight01: number;
  readonly inferenceWeight01: number;
  readonly shameWeight01: number;
  readonly dealRiskWeight01: number;
  readonly helperBlackoutOverridesCritical: boolean;
}

// ============================================================================
// MARK: Trigger, suppression, diagnostics, and plan contracts
// ============================================================================

export type HelperTriggerKind =
  | 'PLAYER_MESSAGE'
  | 'BATTLE_SIGNAL'
  | 'RUN_SIGNAL'
  | 'ECONOMY_SIGNAL'
  | 'LIVEOPS_SIGNAL'
  | 'AMBIENT_MAINTENANCE'
  | 'POST_HATER'
  | 'POST_INVASION'
  | 'ROOM_ENTRY'
  | 'POST_COLLAPSE'
  | 'POST_RUN';

export type HelperTactic =
  | 'STEADY_HAND'
  | 'RAPID_REFRAME'
  | 'ONE_CARD_EXIT'
  | 'CONFIDENCE_RESET'
  | 'SHIELD_TRIAGE'
  | 'DEALROOM_WARNING'
  | 'SILENT_SUPPORT'
  | 'RESCUE_SHADOW'
  | 'BREATH_GATE'
  | 'POST_RUN_DEBRIEF';

export interface HelperTriggerContext {
  readonly kind: HelperTriggerKind;
  readonly state: ChatState;
  readonly room: ChatRoomState;
  readonly now: UnixMs;
  readonly causeEventId: Nullable<ChatEventId>;
  readonly signal: Nullable<ChatSignalEnvelope>;
  readonly playerMessage: Nullable<ChatMessage>;
  readonly preferredChannelId: Nullable<ChatVisibleChannel>;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface HelperSuppressionDecision {
  readonly allowed: boolean;
  readonly reasons: readonly string[];
  readonly blockingReasons: readonly string[];
  readonly roomSilenced: boolean;
  readonly activeInvasionCount: number;
  readonly helperBlackout: boolean;
  readonly visibleOccupants: number;
  readonly recentHelperMessages: readonly ChatMessage[];
}

export interface HelperUrgencyVector {
  readonly roomId: ChatRoomId;
  readonly rescueWindow01: Score01;
  readonly frustration01: Score01;
  readonly embarrassment01: Score01;
  readonly churn01: Score01;
  readonly silenceRisk01: Score01;
  readonly shieldEmergency01: Score01;
  readonly overpayRisk01: Score01;
  readonly hostileMomentum01: Score01;
  readonly helperReceptivity01: Score01;
  readonly relationshipTrust01: Score01;
  readonly relationshipDebt01: Score01;
  readonly inferenceTiming01: Score01;
  readonly finalUrgency01: Score01;
  readonly tactic: HelperTactic;
}

export interface HelperPersonaProfile extends ChatPersonaDescriptor {
  readonly helperStyle: 'BLUNT' | 'CALM' | 'TACTICAL' | 'MENTOR';
  readonly anchorRoomKinds: readonly ChatRoomKind[];
  readonly anchorMoods: readonly ChatRoomStageMood[];
  readonly rescueBias01: number;
  readonly confidenceBias01: number;
  readonly privateShadowBias01: number;
  readonly dealRoomBias01: number;
  readonly lines: Readonly<Record<HelperTactic, readonly string[]>>;
  readonly followups: readonly string[];
}

export interface HelperPersonaMatch {
  readonly persona: HelperPersonaProfile;
  readonly score01: Score01;
  readonly reasons: readonly string[];
}

export interface HelperSceneArtifacts {
  readonly primaryCandidate: Nullable<ChatResponseCandidate>;
  readonly secondaryCandidates: readonly ChatResponseCandidate[];
  readonly scene: Nullable<ChatScenePlan>;
  readonly silence: Nullable<ChatSilenceDecision>;
}

export interface HelperResponsePlan {
  readonly accepted: boolean;
  readonly reasons: readonly string[];
  readonly suppression: HelperSuppressionDecision;
  readonly urgency: Nullable<HelperUrgencyVector>;
  readonly personaMatch: Nullable<HelperPersonaMatch>;
  readonly channelId: Nullable<ChatChannelId>;
  readonly artifacts: HelperSceneArtifacts;
  readonly telemetryHints: Readonly<Record<string, JsonValue>>;
}

export interface HelperMaintenanceRecord {
  readonly roomId: ChatRoomId;
  readonly action: 'PRESERVED' | 'SCENE_CLEARED' | 'SILENCE_PRESERVED' | 'HELPER_SILENCE_EXPIRED';
  readonly reason: string;
}

export interface HelperMaintenanceReport {
  readonly records: readonly HelperMaintenanceRecord[];
}

// ============================================================================
// MARK: Persona registry
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
    privateShadowBias01: 0.76,
    dealRoomBias01: 0.28,
    lines: {
      STEADY_HAND: [
        'Do not answer the room yet. Stabilize first.',
        'Reset the breath before you touch the board again.',
        'Hold your posture. Let the noise spend itself first.',
        'The first job is to slow the inside of the room down.',
      ],
      RAPID_REFRAME: [
        'This is not over. It is just louder than it was a moment ago.',
        'The room wants panic. Give it discipline instead.',
        'You do not need a miracle. You need one clean decision.',
        'Separate the hit from the story. The hit is smaller.',
      ],
      ONE_CARD_EXIT: [
        'Take the smallest safe line. Survival first, style later.',
        'Find the one-card recovery and buy time.',
        'Shrink the problem. One move. Then breathe again.',
        'Reduce the board until your pulse is no longer pricing the next move.',
      ],
      CONFIDENCE_RESET: [
        'You are still in this. Separate the hit from the story you are telling yourself.',
        'Do not narrate defeat before the numbers do.',
        'Confidence can be rebuilt faster than the room expects.',
        'You are allowed to be wounded without becoming public ruin.',
      ],
      SHIELD_TRIAGE: [
        'Shield first. Everything else waits.',
        'Repair the barrier or the room owns the tempo.',
        'Treat shield integrity like oxygen.',
        'Do not spend identity where a shield patch should have gone.',
      ],
      DEALROOM_WARNING: [
        'Do not negotiate while your pulse is visible.',
        'Step back before you price your fear into the deal.',
        'The deal room is measuring your urgency right now.',
        'Silence is a cheaper bid than desperation.',
      ],
      SILENT_SUPPORT: [
        'I am still here.',
        'You do not need to say anything yet.',
        'Hold. Just hold.',
        'Stay inside the breath. I will keep the room off you for a beat.',
      ],
      RESCUE_SHADOW: [
        'Take the quiet route. Let the room lose visual contact with your pulse.',
        'Use the shadow lane. Public recovery is too expensive here.',
        'Move the rescue out of the main channel and keep your center.',
      ],
      BREATH_GATE: [
        'One breath before any answer.',
        'No movement until the breath is level.',
        'Gate the next action through stillness.',
      ],
      POST_RUN_DEBRIEF: [
        'The run ended. The lesson did not.',
        'Take what held. Leave what was theater.',
        'Review the turn that broke shape, not the crowd that named it.',
      ],
    },
    followups: [
      'Good. Smaller. Cleaner. Stay there.',
      'Keep the room outside the decision for one more beat.',
      'That was enough to keep the floor under you.',
      'You bought a little structure. Use it carefully.',
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
    privateShadowBias01: 0.70,
    dealRoomBias01: 0.22,
    lines: {
      STEADY_HAND: [
        'The room does not get to define you from one collapse.',
        'You can recover without performing recovery for them.',
        'Let the moment hurt. Do not let it become your identity.',
        'Slow enough to hear yourself again. That is the way back.',
      ],
      RAPID_REFRAME: [
        'A bad turn is not a verdict.',
        'The fall is information, not authorship.',
        'The room is loud because it wants the story early. Deny it that.',
        'You only need to survive the first interpretation. Truth comes later.',
      ],
      ONE_CARD_EXIT: [
        'Take the plain line. Dignity often looks boring in the middle of chaos.',
        'You do not owe the room spectacle. You owe yourself survival.',
        'Choose the line that keeps your future open.',
        'Preserve tomorrow. Let tonight think you were less dramatic than it wanted.',
      ],
      CONFIDENCE_RESET: [
        'Confidence is not noise. Confidence is return.',
        'Stand back up inside first. The room can wait.',
        'They only win this moment if you start agreeing with them.',
        'Do not borrow the crowd voice to speak to yourself.',
      ],
      SHIELD_TRIAGE: [
        'Protect the core. Pride can come later.',
        'Repair what keeps you in the game.',
        'Treat defense as permission to continue, not a sign of weakness.',
        'Your shield is not an apology. It is jurisdiction.',
      ],
      DEALROOM_WARNING: [
        'Do not bargain from pain.',
        'Any deal made from panic will cost more than it saves.',
        'Silence is cheaper than desperate negotiation.',
        'Nothing in that room gets kinder because you look hurried.',
      ],
      SILENT_SUPPORT: [
        'Still here.',
        'You can take this quietly.',
        'No rush. No performance.',
        'You do not have to explain the wound while it is still open.',
      ],
      RESCUE_SHADOW: [
        'Step out of the center and recover in the shadow lane.',
        'Quiet rescue now. Public interpretation later.',
        'Let the room lose sight of your pulse while you reset.',
      ],
      BREATH_GATE: [
        'No speech until the breath softens.',
        'Guard the next move behind one honest breath.',
        'Answer later. Arrive first.',
      ],
      POST_RUN_DEBRIEF: [
        'You are allowed to study this without becoming it.',
        'Keep the lesson. Release the humiliation.',
        'The run ended. Your authorship did not.',
      ],
    },
    followups: [
      'That is enough for now. Continue from there.',
      'The room felt that shift even if it pretends otherwise.',
      'Keep choosing yourself over their noise.',
      'You are rebuilding more than tempo. Keep going.',
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
    privateShadowBias01: 0.62,
    dealRoomBias01: 0.88,
    lines: {
      STEADY_HAND: [
        'Stop reacting. Start choosing.',
        'Tighten the line and kill the noise.',
        'Less emotion. More sequence.',
        'Shorter loop. Cleaner decision.',
      ],
      RAPID_REFRAME: [
        'Bad beat. Good data. Use it.',
        'You are wasting time arguing with a turn that already happened.',
        'Reset. Re-enter. Punish the next opening.',
        'The error is over. The correction window is open.',
      ],
      ONE_CARD_EXIT: [
        'One clean out. Take it.',
        'Find the cheap escape and live.',
        'Shrink the board. Exit the trap.',
        'The elegant move is the one that leaves you alive.',
      ],
      CONFIDENCE_RESET: [
        'Do not look hurt in public. Fix the line first.',
        'Confidence later. Execution now.',
        'You need precision, not pride.',
        'Stop rehearsing humiliation. Patch the sequence.',
      ],
      SHIELD_TRIAGE: [
        'Patch shield. Immediately.',
        'Barrier first. Nothing else matters till then.',
        'If the shield goes, the room goes feral.',
        'Repair. Then posture.',
      ],
      DEALROOM_WARNING: [
        'Do not show urgency in the deal room.',
        'If they smell panic, the price moves against you.',
        'Walk away before the room prices your fear.',
        'You are leaking tells. Close the channel or cool the pulse.',
      ],
      SILENT_SUPPORT: [
        'I see it.',
        'Hold position.',
        'Wait for the cleaner line.',
        'Do nothing loud.',
      ],
      RESCUE_SHADOW: [
        'Shadow lane. Now.',
        'Pull support off-stage and reset there.',
        'Quiet channel. Cleaner recovery.',
      ],
      BREATH_GATE: [
        'One breath. Then act.',
        'Gate it. Then move.',
        'Stall the mouth. Save the sequence.',
      ],
      POST_RUN_DEBRIEF: [
        'Name the break. Keep the lesson. Drop the theater.',
        'Find the exact turn where sequence degraded.',
        'You do not need closure. You need the right correction point.',
      ],
    },
    followups: [
      'Better. Stay cold.',
      'That bought you one more cycle. Use it.',
      'Now punish the next mistake.',
      'Good. Structure first. Ego after.',
    ],
  }),
});

// ============================================================================
// MARK: Authority façade
// ============================================================================

export class HelperResponseAuthority {
  private readonly context: HelperResponseContext;

  constructor(options: HelperResponseOptions = {}) {
    this.context = createHelperResponseContext(options);
  }

  contextValue(): HelperResponseContext {
    return this.context;
  }

  plan(trigger: HelperTriggerContext): HelperResponsePlan {
    return planHelperResponse(trigger, this.context);
  }

  apply(state: ChatState, plan: HelperResponsePlan): ChatState {
    return applyHelperPlan(state, plan);
  }

  maintenance(state: ChatState, now: UnixMs): { state: ChatState; report: HelperMaintenanceReport } {
    return maintainHelperArtifacts(state, now, this.context);
  }
}

export function createHelperResponseAuthority(
  options: HelperResponseOptions = {},
): HelperResponseAuthority {
  return new HelperResponseAuthority(options);
}

// ============================================================================
// MARK: Context creation
// ============================================================================

export function createHelperResponseContext(
  options: HelperResponseOptions = {},
): HelperResponseContext {
  return Object.freeze({
    logger: options.logger ?? createDefaultLogger(),
    clock: options.clock ?? createDefaultClock(),
    random: options.random ?? createDefaultRandom(),
    ids: options.ids ?? createDefaultIds(),
    runtimeOptions: options.runtimeOptions,
    runtimeOverride: options.runtimeOverride,
    defaultVisibleChannel: options.defaultVisibleChannel ?? 'GLOBAL',
    allowCinematicScenes: options.allowCinematicScenes ?? true,
    allowPrivateShadowSupport: options.allowPrivateShadowSupport ?? true,
    allowRescueSilenceWindows: options.allowRescueSilenceWindows ?? true,
    minimumUrgencyToSpeak01: clampThreshold(options.minimumUrgencyToSpeak01 ?? 0.28),
    minimumUrgencyToScene01: clampThreshold(options.minimumUrgencyToScene01 ?? 0.58),
    helperReceptivityWeight01: clampThreshold(options.helperReceptivityWeight01 ?? 0.18),
    relationshipWeight01: clampThreshold(options.relationshipWeight01 ?? 0.12),
    inferenceWeight01: clampThreshold(options.inferenceWeight01 ?? 0.14),
    shameWeight01: clampThreshold(options.shameWeight01 ?? 0.12),
    dealRiskWeight01: clampThreshold(options.dealRiskWeight01 ?? 0.10),
    helperBlackoutOverridesCritical: options.helperBlackoutOverridesCritical ?? true,
  });
}

export function createDefaultLogger(): HelperResponseLoggerPort {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

export function createDefaultClock(): HelperResponseClockPort {
  return {
    now: () => asUnixMs(Date.now()),
  };
}

export function createDefaultRandom(): HelperResponseRandomPort {
  return {
    next: () => Math.random(),
  };
}

export function createDefaultIds(): HelperResponseIdFactoryPort {
  return {
    sceneId: (prefix = 'helper_scene') => `${prefix}_${randomBase36(12)}` as ChatSceneId,
  };
}

// ============================================================================
// MARK: Core planning entry point
// ============================================================================

export function planHelperResponse(
  trigger: HelperTriggerContext,
  context: HelperResponseContext,
): HelperResponsePlan {
  const suppression = evaluateHelperSuppression(trigger, context);

  if (!suppression.allowed) {
    return rejectHelperPlan(
      [...suppression.blockingReasons],
      suppression,
      null,
      null,
      null,
    );
  }

  const urgency = computeHelperUrgency(trigger, context);
  const reasons: string[] = [
    `helperUrgency:${Number(urgency.finalUrgency01).toFixed(2)}`,
    `tactic:${urgency.tactic}`,
  ];

  if (Number(urgency.finalUrgency01) < context.minimumUrgencyToSpeak01) {
    reasons.push('urgency below configured speak threshold');
    return rejectHelperPlan(reasons, suppression, urgency, null, null);
  }

  const personaMatch = chooseHelperPersona(trigger, urgency, context);
  reasons.push(`persona:${personaMatch.persona.displayName}`);
  reasons.push(`personaScore:${Number(personaMatch.score01).toFixed(2)}`);

  const channelId = resolveHelperChannelId(trigger, urgency, personaMatch.persona, context);
  reasons.push(`channel:${channelId}`);

  const artifacts = buildHelperArtifacts({
    trigger,
    urgency,
    persona: personaMatch.persona,
    channelId,
    context,
  });

  if (!artifacts.primaryCandidate) {
    reasons.push('artifact build produced no primary candidate');
    return rejectHelperPlan(reasons, suppression, urgency, personaMatch, channelId);
  }

  const telemetryHints: Readonly<Record<string, JsonValue>> = Object.freeze({
    tactic: urgency.tactic,
    urgency01: Number(urgency.finalUrgency01),
    personaId: personaMatch.persona.personaId,
    channelId,
    scene: Boolean(artifacts.scene),
    shadowSupport: channelId === 'RESCUE_SHADOW',
    visibleOccupants: suppression.visibleOccupants,
    helperBlackout: suppression.helperBlackout,
  });

  return {
    accepted: true,
    reasons: Object.freeze(reasons),
    suppression,
    urgency,
    personaMatch,
    channelId,
    artifacts,
    telemetryHints,
  };
}

export function rejectHelperPlan(
  reasons: readonly string[],
  suppression: Nullable<HelperSuppressionDecision>,
  urgency: Nullable<HelperUrgencyVector>,
  personaMatch: Nullable<HelperPersonaMatch>,
  channelId: Nullable<ChatChannelId>,
): HelperResponsePlan {
  return {
    accepted: false,
    reasons: Object.freeze([...reasons]),
    suppression: suppression ?? impossibleSuppressionDecision(),
    urgency,
    personaMatch,
    channelId,
    artifacts: {
      primaryCandidate: null,
      secondaryCandidates: Object.freeze([]),
      scene: null,
      silence: null,
    },
    telemetryHints: Object.freeze({
      accepted: false,
      rejectionReasons: reasons.join(' | '),
    }),
  };
}

// ============================================================================
// MARK: Suppression evaluation
// ============================================================================

export function evaluateHelperSuppression(
  trigger: HelperTriggerContext,
  context: HelperResponseContext,
): HelperSuppressionDecision {
  const runtime = resolveRuntime(context);
  const roomId = trigger.room.roomId;
  const activeInvasions = getActiveRoomInvasions(trigger.state, roomId);
  const roomSilenced = isRoomSilenced(trigger.state, roomId, trigger.now);
  const visibleOccupants = selectRoomPresence(trigger.state, roomId).filter((value) => value.visibleToRoom).length;
  const helperBlackoutFromSignal = Boolean(trigger.signal?.liveops?.helperBlackout);
  const helperBlackoutFromInvasion = activeInvasions.some((value) => value.kind === 'HELPER_BLACKOUT');
  const helperBlackout = helperBlackoutFromSignal || helperBlackoutFromInvasion;

  const recentHelperMessages = selectVisibleMessages(trigger.state, roomId)
    .filter((message) => message.attribution.npcRole === 'HELPER')
    .slice(-3);

  const reasons: string[] = [];
  const blockingReasons: string[] = [];

  if (runtime.allowVisibleChannels.length === 0) {
    blockingReasons.push('runtime visible channel lane disabled');
  }
  if (!runtime.learningPolicy.enabled && trigger.kind === 'AMBIENT_MAINTENANCE') {
    reasons.push('learning disabled; ambient helper timing should be conservative');
  }
  if (roomSilenced) {
    reasons.push('room currently under backend silence decision');
    if (!shouldCriticalRescueOverrideSilence(trigger, context)) {
      blockingReasons.push('room silence blocks non-critical helper interventions');
    }
  }
  if (helperBlackout) {
    reasons.push('helper blackout active');
    if (!(context.helperBlackoutOverridesCritical && shouldCriticalRescueOverrideBlackout(trigger))) {
      blockingReasons.push('helper blackout active and no critical override was present');
    }
  }
  if (trigger.room.roomKind === 'SYSTEM') {
    blockingReasons.push('system room does not admit helper persona speech');
  }
  if (recentHelperMessages.length > 0) {
    const latest = recentHelperMessages[recentHelperMessages.length - 1];
    const elapsed = Number(trigger.now) - Number(latest.createdAt);
    reasons.push(`elapsedSinceHelperMs:${elapsed}`);
    if (elapsed < runtime.ratePolicy.helperMinimumGapMs) {
      blockingReasons.push('helper minimum gap not yet satisfied');
    }
  }
  if (visibleOccupants === 0 && trigger.room.roomKind !== 'PRIVATE') {
    reasons.push('no visible occupants; public helper speech may not land');
  }

  return {
    allowed: blockingReasons.length === 0,
    reasons: Object.freeze(reasons),
    blockingReasons: Object.freeze(blockingReasons),
    roomSilenced,
    activeInvasionCount: activeInvasions.length,
    helperBlackout,
    visibleOccupants,
    recentHelperMessages: Object.freeze(recentHelperMessages),
  };
}

export function shouldCriticalRescueOverrideSilence(
  trigger: HelperTriggerContext,
  context: HelperResponseContext,
): boolean {
  if (!context.allowRescueSilenceWindows) {
    return false;
  }
  return shouldCriticalRescueOverrideBlackout(trigger);
}

export function shouldCriticalRescueOverrideBlackout(
  trigger: HelperTriggerContext,
): boolean {
  if (trigger.signal?.battle && Number(trigger.signal.battle.shieldIntegrity01) <= 0.18) {
    return true;
  }
  if (trigger.signal?.run?.bankruptcyWarning) {
    return true;
  }
  if (trigger.signal?.economy && Number(trigger.signal.economy.overpayRisk01) >= 0.84) {
    return true;
  }
  if (trigger.playerMessage && isPanicLikeText(trigger.playerMessage.plainText)) {
    return true;
  }
  return false;
}

export function impossibleSuppressionDecision(): HelperSuppressionDecision {
  return {
    allowed: false,
    reasons: Object.freeze(['fallback suppression decision']),
    blockingReasons: Object.freeze(['no suppression evaluation was provided']),
    roomSilenced: false,
    activeInvasionCount: 0,
    helperBlackout: false,
    visibleOccupants: 0,
    recentHelperMessages: Object.freeze([]),
  };
}

// ============================================================================
// MARK: Urgency computation
// ============================================================================

export function computeHelperUrgency(
  trigger: HelperTriggerContext,
  context: HelperResponseContext,
): HelperUrgencyVector {
  const roomId = trigger.room.roomId;
  const targetUserId = resolveTargetUserId(trigger);
  const learning = targetUserId ? selectLearningProfile(trigger.state, targetUserId) : null;
  const inference = targetUserId ? selectInferenceSnapshotsForUser(trigger.state, targetUserId).at(-1) ?? null : null;
  const heat = selectAudienceHeat(trigger.state, roomId);

  const rescueWindow01 = asScore01(scoreHelperRescueWindow(trigger.signal ?? null));
  const frustration01 = asScore01(scoreAffectDimension(learning?.affect, 'frustration01'));
  const embarrassment01 = asScore01(scoreAffectDimension(learning?.affect, 'embarrassment01'));
  const churn01 = asScore01(inference ? Number(inference.churnRisk01) : learning ? Number(learning.churnRisk01) : 0.08);
  const silenceRisk01 = asScore01(scoreSilenceRisk(trigger, heat));
  const shieldEmergency01 = asScore01(scoreShieldEmergency(trigger.signal ?? null));
  const overpayRisk01 = asScore01(scoreDealRisk(trigger.signal ?? null));
  const hostileMomentum01 = asScore01(scoreHostileMomentum(trigger.signal ?? null));
  const helperReceptivity01 = asScore01(scoreHelperReceptivity(learning));
  const relationship = selectPrimaryHelperRelationship(trigger.state, roomId, targetUserId);
  const relationshipTrust01 = asScore01(scoreRelationshipTrust(relationship));
  const relationshipDebt01 = asScore01(scoreRelationshipDebt(relationship));
  const inferenceTiming01 = asScore01(scoreInferenceTiming(inference));

  const weighted =
    Number(rescueWindow01) * 0.16 +
    Number(frustration01) * 0.14 +
    Number(embarrassment01) * context.shameWeight01 +
    Number(churn01) * 0.16 +
    Number(silenceRisk01) * 0.10 +
    Number(shieldEmergency01) * 0.16 +
    Number(overpayRisk01) * context.dealRiskWeight01 +
    Number(hostileMomentum01) * 0.08 +
    Number(helperReceptivity01) * context.helperReceptivityWeight01 +
    Number(relationshipTrust01) * (context.relationshipWeight01 * 0.45) +
    Number(relationshipDebt01) * (context.relationshipWeight01 * 0.55) +
    Number(inferenceTiming01) * context.inferenceWeight01;

  return {
    roomId,
    rescueWindow01,
    frustration01,
    embarrassment01,
    churn01,
    silenceRisk01,
    shieldEmergency01,
    overpayRisk01,
    hostileMomentum01,
    helperReceptivity01,
    relationshipTrust01,
    relationshipDebt01,
    inferenceTiming01,
    finalUrgency01: asScore01(weighted),
    tactic: deriveHelperTactic({
      rescueWindow01,
      frustration01,
      embarrassment01,
      churn01,
      silenceRisk01,
      shieldEmergency01,
      overpayRisk01,
      hostileMomentum01,
      helperReceptivity01,
      relationshipDebt01,
      trigger,
    }),
  };
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
  trigger: HelperTriggerContext,
  heat: Nullable<ChatAudienceHeat>,
): number {
  const playerMessage = trigger.playerMessage ?? null;
  const playerWentQuiet = playerMessage
    ? playerMessage.plainText.trim().length <= 2 || /^\.{2,}$/.test(playerMessage.plainText.trim())
    : trigger.kind === 'AMBIENT_MAINTENANCE';
  return Math.min(1, (playerWentQuiet ? 0.46 : 0.08) + (heat ? Number(heat.heat01) * 0.22 : 0));
}

export function scoreShieldEmergency(signal: Nullable<ChatSignalEnvelope>): number {
  if (!signal?.battle) {
    return 0.08;
  }
  return 1 - Number(signal.battle.shieldIntegrity01);
}

export function scoreDealRisk(signal: Nullable<ChatSignalEnvelope>): number {
  if (!signal?.economy) {
    return 0.08;
  }
  return Math.max(Number(signal.economy.overpayRisk01), Number(signal.economy.bluffRisk01) * 0.72);
}

export function scoreHostileMomentum(signal: Nullable<ChatSignalEnvelope>): number {
  if (!signal?.battle) {
    return 0.08;
  }
  return Math.max(0, Math.min(1, Number(signal.battle.hostileMomentum) / 100));
}

export function scoreHelperReceptivity(
  learning: Nullable<ChatLearningProfile>,
): number {
  if (!learning) {
    return 0.40;
  }
  return Number(learning.helperReceptivity01);
}

export function selectPrimaryHelperRelationship(
  state: ChatState,
  roomId: ChatRoomId,
  userId: Nullable<ChatLearningProfile['userId']>,
): Nullable<ChatRelationshipState> {
  if (!userId) {
    return null;
  }
  const priorityActors = ['npc:helper:anchor', 'npc:helper:mercy', 'npc:helper:kade'];
  for (const actorId of priorityActors) {
    const relationship = selectRelationshipForActor(state, roomId, actorId, userId);
    if (relationship) {
      return relationship;
    }
  }
  return null;
}

export function scoreRelationshipTrust(
  relationship: Nullable<ChatRelationshipState>,
): number {
  return relationship ? Number(relationship.trust01) : 0.18;
}

export function scoreRelationshipDebt(
  relationship: Nullable<ChatRelationshipState>,
): number {
  return relationship ? Number(relationship.rescueDebt01) : 0.08;
}

export function scoreInferenceTiming(
  inference: Nullable<ChatInferenceSnapshot>,
): number {
  if (!inference) {
    return 0.22;
  }
  if (inference.interventionPolicy === 'HARD_HELPER') {
    return Math.max(Number(inference.helperTiming01), 0.85);
  }
  if (inference.interventionPolicy === 'LIGHT_HELPER') {
    return Math.max(Number(inference.helperTiming01), 0.62);
  }
  if (inference.interventionPolicy === 'DEFER') {
    return Math.min(Number(inference.helperTiming01), 0.24);
  }
  return Number(inference.helperTiming01);
}

export function deriveHelperTactic(args: {
  readonly rescueWindow01: Score01;
  readonly frustration01: Score01;
  readonly embarrassment01: Score01;
  readonly churn01: Score01;
  readonly silenceRisk01: Score01;
  readonly shieldEmergency01: Score01;
  readonly overpayRisk01: Score01;
  readonly hostileMomentum01: Score01;
  readonly helperReceptivity01: Score01;
  readonly relationshipDebt01: Score01;
  readonly trigger: HelperTriggerContext;
}): HelperTactic {
  if (args.trigger.kind === 'POST_RUN') {
    return 'POST_RUN_DEBRIEF';
  }
  if (Number(args.shieldEmergency01) >= 0.72) {
    return 'SHIELD_TRIAGE';
  }
  if (args.trigger.signal?.economy && Number(args.overpayRisk01) >= 0.55) {
    return 'DEALROOM_WARNING';
  }
  if (Number(args.churn01) >= 0.72 && Number(args.frustration01) >= 0.52) {
    return 'ONE_CARD_EXIT';
  }
  if (Number(args.embarrassment01) >= 0.64) {
    return 'CONFIDENCE_RESET';
  }
  if (Number(args.silenceRisk01) >= 0.62 && Number(args.helperReceptivity01) >= 0.46) {
    return 'SILENT_SUPPORT';
  }
  if (Number(args.relationshipDebt01) >= 0.58 && args.trigger.room.roomKind !== 'GLOBAL') {
    return 'RESCUE_SHADOW';
  }
  if (Number(args.hostileMomentum01) >= 0.62 && Number(args.rescueWindow01) < 0.34) {
    return 'BREATH_GATE';
  }
  if (Number(args.rescueWindow01) >= 0.50) {
    return 'RAPID_REFRAME';
  }
  return 'STEADY_HAND';
}

// ============================================================================
// MARK: Persona matching and channel resolution
// ============================================================================

export function chooseHelperPersona(
  trigger: HelperTriggerContext,
  urgency: HelperUrgencyVector,
  context: HelperResponseContext,
): HelperPersonaMatch {
  const matches = Object.values(HELPER_PERSONAS).map((persona) => ({
    persona,
    score01: asScore01(scoreHelperPersona(persona, trigger, urgency, context)),
    reasons: explainHelperPersonaScore(persona, trigger, urgency),
  }));
  matches.sort((a, b) => Number(b.score01) - Number(a.score01));
  return matches[0] ?? impossiblePersonaMatch();
}

export function scoreHelperPersona(
  persona: HelperPersonaProfile,
  trigger: HelperTriggerContext,
  urgency: HelperUrgencyVector,
  _context: HelperResponseContext,
): number {
  let score = persona.rescueBias01 * 0.18;

  if (persona.anchorRoomKinds.includes(trigger.room.roomKind)) {
    score += 0.14;
  }
  if (persona.anchorMoods.includes(trigger.room.stageMood)) {
    score += 0.10;
  }
  if (urgency.tactic === 'CONFIDENCE_RESET') {
    score += persona.confidenceBias01 * 0.18;
  }
  if (urgency.tactic === 'SHIELD_TRIAGE' && persona.helperStyle === 'TACTICAL') {
    score += 0.18;
  }
  if (urgency.tactic === 'ONE_CARD_EXIT' && persona.helperStyle === 'CALM') {
    score += 0.14;
  }
  if (urgency.tactic === 'DEALROOM_WARNING') {
    score += persona.dealRoomBias01 * 0.16;
  }
  if (urgency.tactic === 'RESCUE_SHADOW' || urgency.tactic === 'SILENT_SUPPORT') {
    score += persona.privateShadowBias01 * 0.14;
  }
  if (urgency.tactic === 'POST_RUN_DEBRIEF' && persona.helperStyle === 'MENTOR') {
    score += 0.20;
  }
  if (Number(urgency.relationshipDebt01) >= 0.55 && persona.displayName === 'ANCHOR') {
    score += 0.08;
  }
  if (Number(urgency.embarrassment01) >= 0.62 && persona.displayName === 'MERCY') {
    score += 0.08;
  }
  if (Number(urgency.shieldEmergency01) >= 0.70 && persona.displayName === 'KADE') {
    score += 0.08;
  }

  return Math.max(0, Math.min(1, score));
}

export function explainHelperPersonaScore(
  persona: HelperPersonaProfile,
  trigger: HelperTriggerContext,
  urgency: HelperUrgencyVector,
): readonly string[] {
  const reasons: string[] = [`base:${persona.rescueBias01.toFixed(2)}`];
  if (persona.anchorRoomKinds.includes(trigger.room.roomKind)) reasons.push('room kind anchor');
  if (persona.anchorMoods.includes(trigger.room.stageMood)) reasons.push('room mood anchor');
  if (urgency.tactic === 'SHIELD_TRIAGE' && persona.helperStyle === 'TACTICAL') reasons.push('tactical shield fit');
  if (urgency.tactic === 'CONFIDENCE_RESET' && persona.helperStyle === 'MENTOR') reasons.push('mentor shame recovery fit');
  if ((urgency.tactic === 'RESCUE_SHADOW' || urgency.tactic === 'SILENT_SUPPORT') && persona.privateShadowBias01 >= 0.65) reasons.push('shadow support fit');
  if (urgency.tactic === 'DEALROOM_WARNING' && persona.dealRoomBias01 >= 0.7) reasons.push('deal room fit');
  return Object.freeze(reasons);
}

export function resolveHelperChannelId(
  trigger: HelperTriggerContext,
  urgency: HelperUrgencyVector,
  persona: HelperPersonaProfile,
  context: HelperResponseContext,
): ChatChannelId {
  if (context.allowPrivateShadowSupport && (urgency.tactic === 'RESCUE_SHADOW' || urgency.tactic === 'SILENT_SUPPORT')) {
    return 'RESCUE_SHADOW';
  }
  if (persona.preferredChannels.includes(trigger.room.activeVisibleChannel)) {
    return trigger.room.activeVisibleChannel;
  }
  if (trigger.room.roomKind === 'DEAL_ROOM' && persona.preferredChannels.includes('DEAL_ROOM')) {
    return 'DEAL_ROOM';
  }
  if (trigger.preferredChannelId && persona.preferredChannels.includes(trigger.preferredChannelId)) {
    return trigger.preferredChannelId;
  }
  if (persona.preferredChannels.includes(context.defaultVisibleChannel)) {
    return context.defaultVisibleChannel;
  }
  return trigger.room.activeVisibleChannel;
}

export function impossiblePersonaMatch(): HelperPersonaMatch {
  return {
    persona: HELPER_PERSONAS.anchor,
    score01: asScore01(0),
    reasons: Object.freeze(['fallback helper persona']),
  };
}

// ============================================================================
// MARK: Artifact construction
// ============================================================================

export function buildHelperArtifacts(args: {
  readonly trigger: HelperTriggerContext;
  readonly urgency: HelperUrgencyVector;
  readonly persona: HelperPersonaProfile;
  readonly channelId: ChatChannelId;
  readonly context: HelperResponseContext;
}): HelperSceneArtifacts {
  const primaryText = composeHelperLine(args.trigger, args.urgency, args.persona, args.context);
  const primaryCandidate = createHelperCandidate({
    trigger: args.trigger,
    persona: args.persona,
    urgency: args.urgency,
    channelId: args.channelId,
    text: primaryText,
    delayMs: resolveHelperDelayMs(args.persona, args.urgency),
    priority: resolveHelperPriority(args.urgency),
  });

  const secondaryCandidates = shouldCreateHelperFollowup(args.urgency)
    ? createHelperFollowups({
        trigger: args.trigger,
        persona: args.persona,
        urgency: args.urgency,
        channelId: args.channelId,
        context: args.context,
      })
    : Object.freeze([]) as readonly ChatResponseCandidate[];

  const silence = args.context.allowRescueSilenceWindows && Number(args.urgency.finalUrgency01) >= 0.64
    ? createHelperSilence(args.trigger.room.roomId, args.trigger.now, resolveHelperSilenceWindowMs(args.urgency))
    : null;

  const scene = createHelperSceneIfNeeded({
    trigger: args.trigger,
    persona: args.persona,
    urgency: args.urgency,
    primaryCandidate,
    secondaryCandidates,
    silence,
    context: args.context,
  });

  return {
    primaryCandidate,
    secondaryCandidates,
    scene,
    silence,
  };
}

export function createHelperCandidate(args: {
  readonly trigger: HelperTriggerContext;
  readonly persona: HelperPersonaProfile;
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
      `mood:${args.trigger.room.stageMood}`,
    ]),
    delayMs: Math.max(0, Math.floor(args.delayMs)),
    moderationBypassAllowed: false,
    causeEventId: args.trigger.causeEventId,
  };
}

export function composeHelperLine(
  trigger: HelperTriggerContext,
  urgency: HelperUrgencyVector,
  persona: HelperPersonaProfile,
  context: HelperResponseContext,
): string {
  const bank = persona.lines[urgency.tactic] ?? persona.lines.STEADY_HAND;
  const base = chooseLine(bank, context.random);
  const replaced = applyTemplate(base, buildTemplateReplacements(trigger, urgency, persona));
  return maybeWrapHelperVoiceprint(replaced, urgency, persona);
}

export function buildTemplateReplacements(
  trigger: HelperTriggerContext,
  urgency: HelperUrgencyVector,
  persona: HelperPersonaProfile,
): Readonly<Record<string, string>> {
  const latest = trigger.playerMessage ?? selectLatestMessage(trigger.state, trigger.room.roomId) ?? null;
  const roomKind = trigger.room.roomKind.toLowerCase().replace(/_/g, ' ');
  const mood = trigger.room.stageMood.toLowerCase();
  return Object.freeze({
    player_line: latest ? summarizePlayerText(latest.plainText) : 'the last move',
    room_kind: roomKind,
    room_mood: mood,
    helper: persona.displayName,
    tactic: urgency.tactic.toLowerCase().replace(/_/g, ' '),
  });
}

export function applyTemplate(
  template: string,
  replacements: Readonly<Record<string, string>>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

export function maybeWrapHelperVoiceprint(
  text: string,
  urgency: HelperUrgencyVector,
  persona: HelperPersonaProfile,
): string {
  let next = text;
  if (persona.voiceprint.opener && Number(urgency.finalUrgency01) >= 0.52) {
    next = `${persona.voiceprint.opener} ${next}`;
  }
  if (persona.voiceprint.closer && (urgency.tactic === 'CONFIDENCE_RESET' || urgency.tactic === 'STEADY_HAND' || urgency.tactic === 'POST_RUN_DEBRIEF')) {
    next = `${next} ${persona.voiceprint.closer}`;
  }
  return next;
}

export function createHelperFollowups(args: {
  readonly trigger: HelperTriggerContext;
  readonly persona: HelperPersonaProfile;
  readonly urgency: HelperUrgencyVector;
  readonly channelId: ChatChannelId;
  readonly context: HelperResponseContext;
}): readonly ChatResponseCandidate[] {
  const followup = chooseLine(args.persona.followups, args.context.random);
  const tacticalNudge = createHelperCandidate({
    trigger: args.trigger,
    persona: args.persona,
    urgency: args.urgency,
    channelId: args.channelId,
    text: followup,
    delayMs: resolveHelperFollowupDelayMs(args.persona, args.urgency),
    priority: Math.max(1, resolveHelperPriority(args.urgency) - 12),
  });

  if (Number(args.urgency.finalUrgency01) >= 0.78 || args.urgency.tactic === 'POST_RUN_DEBRIEF') {
    const secondaryText = chooseLine(
      args.urgency.tactic === 'POST_RUN_DEBRIEF'
        ? args.persona.lines.POST_RUN_DEBRIEF
        : args.persona.lines.BREATH_GATE,
      args.context.random,
    );
    const secondFollow = createHelperCandidate({
      trigger: args.trigger,
      persona: args.persona,
      urgency: args.urgency,
      channelId: args.channelId,
      text: secondaryText,
      delayMs: resolveHelperFollowupDelayMs(args.persona, args.urgency) + 800,
      priority: Math.max(1, resolveHelperPriority(args.urgency) - 20),
    });
    return Object.freeze([tacticalNudge, secondFollow]);
  }

  return Object.freeze([tacticalNudge]);
}

export function createHelperSceneIfNeeded(args: {
  readonly trigger: HelperTriggerContext;
  readonly persona: HelperPersonaProfile;
  readonly urgency: HelperUrgencyVector;
  readonly primaryCandidate: ChatResponseCandidate;
  readonly secondaryCandidates: readonly ChatResponseCandidate[];
  readonly silence: Nullable<ChatSilenceDecision>;
  readonly context: HelperResponseContext;
}): Nullable<ChatScenePlan> {
  if (!args.context.allowCinematicScenes) {
    return null;
  }
  if (Number(args.urgency.finalUrgency01) < args.context.minimumUrgencyToScene01) {
    return null;
  }
  if (args.secondaryCandidates.length === 0) {
    return null;
  }
  return {
    sceneId: args.context.ids.sceneId('helper_scene'),
    roomId: args.trigger.room.roomId,
    label: sceneLabelForTactic(args.urgency.tactic),
    openedAt: args.trigger.now,
    messages: Object.freeze([args.primaryCandidate, ...args.secondaryCandidates]),
    silence: args.silence,
    legendCandidate: false,
  };
}

export function sceneLabelForTactic(tactic: HelperTactic): string {
  switch (tactic) {
    case 'SHIELD_TRIAGE': return 'HELPER_SHIELD_TRIAGE';
    case 'DEALROOM_WARNING': return 'HELPER_DEALROOM_WARNING';
    case 'POST_RUN_DEBRIEF': return 'HELPER_POST_RUN_DEBRIEF';
    case 'RESCUE_SHADOW': return 'HELPER_SHADOW_RESCUE';
    default: return 'HELPER_INTERVENTION';
  }
}

export function resolveHelperPriority(urgency: HelperUrgencyVector): number {
  const value = Number(urgency.finalUrgency01);
  if (value >= 0.86) return 94;
  if (value >= 0.72) return 84;
  if (value >= 0.58) return 72;
  if (value >= 0.44) return 60;
  return 48;
}

export function resolveHelperDelayMs(
  persona: HelperPersonaProfile,
  urgency: HelperUrgencyVector,
): number {
  const floor = persona.voiceprint.delayFloorMs;
  const ceiling = persona.voiceprint.delayCeilingMs;
  const ratio = Math.max(0, Math.min(1, 1 - Number(urgency.finalUrgency01)));
  return Math.floor(floor + (ceiling - floor) * ratio);
}

export function resolveHelperFollowupDelayMs(
  persona: HelperPersonaProfile,
  urgency: HelperUrgencyVector,
): number {
  return Math.floor(resolveHelperDelayMs(persona, urgency) + 1100);
}

export function resolveHelperSilenceWindowMs(urgency: HelperUrgencyVector): number {
  const value = Number(urgency.finalUrgency01);
  if (value >= 0.86) return 6_200;
  if (value >= 0.72) return 4_800;
  if (value >= 0.58) return 3_600;
  return 2_400;
}

export function shouldCreateHelperFollowup(urgency: HelperUrgencyVector): boolean {
  return Number(urgency.finalUrgency01) >= 0.58 || urgency.tactic === 'CONFIDENCE_RESET' || urgency.tactic === 'POST_RUN_DEBRIEF';
}

export function createHelperSilence(
  roomId: ChatRoomId,
  now: UnixMs,
  durationMs: number,
): ChatSilenceDecision {
  return {
    active: true,
    startedAt: now,
    endsAt: asUnixMs(Number(now) + durationMs),
    reason: `helper_intervention:${roomId}`,
  };
}

// ============================================================================
// MARK: State application and maintenance
// ============================================================================

export function applyHelperPlan(
  state: ChatState,
  plan: HelperResponsePlan,
): ChatState {
  if (!plan.accepted) {
    return state;
  }

  let next = state;
  if (plan.artifacts.scene) {
    next = setRoomScene(next, plan.artifacts.scene.roomId, plan.artifacts.scene.sceneId);
  }
  if (plan.artifacts.silence && plan.artifacts.primaryCandidate) {
    next = setSilenceDecision(next, plan.artifacts.primaryCandidate.roomId, plan.artifacts.silence);
  }
  return next;
}

export function maintainHelperArtifacts(
  state: ChatState,
  now: UnixMs,
  _context: HelperResponseContext,
): { state: ChatState; report: HelperMaintenanceReport } {
  let next = pruneExpiredSilences(state, now);
  const records: HelperMaintenanceRecord[] = [];

  for (const room of Object.values(next.rooms)) {
    const roomId = room.roomId;
    const silence = next.silencesByRoom[roomId] ?? null;
    const helperSilence = silence && silence.reason.startsWith('helper_intervention:') ? silence : null;

    if (!helperSilence && room.activeSceneId) {
      next = setRoomScene(next, roomId, null);
      records.push({
        roomId,
        action: 'SCENE_CLEARED',
        reason: 'helper silence expired or absent; helper scene anchor cleared',
      });
      continue;
    }

    if (helperSilence) {
      records.push({
        roomId,
        action: 'SILENCE_PRESERVED',
        reason: 'helper silence still active',
      });
    } else {
      records.push({
        roomId,
        action: 'PRESERVED',
        reason: 'no helper maintenance mutation required',
      });
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
// MARK: Selection helpers and signal-derived intelligence
// ============================================================================

export function resolveTargetUserId(
  trigger: HelperTriggerContext,
): Nullable<ChatLearningProfile['userId']> {
  return trigger.playerMessage?.attribution.authorUserId ?? null;
}

export function selectLatestPlayerMessage(
  state: ChatState,
  roomId: ChatRoomId,
): Nullable<ChatMessage> {
  const visible = selectVisibleMessages(state, roomId)
    .filter((message) => message.attribution.sourceType === 'PLAYER');
  return visible[visible.length - 1] ?? null;
}

export function isPanicLikeText(text: string): boolean {
  const normalized = text.toLowerCase();
  return /(help|wait|hold on|i\'m cooked|im cooked|bad|uh oh|can\'t|cannot|stuck|panic|done for)/.test(normalized);
}

export function summarizePlayerText(text: string): string {
  const normalized = normalizeOutboundText(text);
  return normalized.length > 42 ? `${normalized.slice(0, 39)}...` : normalized;
}

export function normalizeOutboundText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

// ============================================================================
// MARK: Runtime and utility helpers
// ============================================================================

export function resolveRuntime(context: HelperResponseContext) {
  return mergeRuntimeConfig(
    context.runtimeOverride ?? {},
    context.runtimeOptions,
  );
}

export function createHelperPersona(profile: HelperPersonaProfile): HelperPersonaProfile {
  return Object.freeze(profile);
}

export function chooseLine(lines: readonly string[], random: HelperResponseRandomPort): string {
  if (lines.length === 0) {
    return '...';
  }
  const index = Math.floor(random.next() * lines.length) % lines.length;
  return lines[index] ?? lines[0] ?? '...';
}

export function asScore01(value: number): Score01 {
  return clamp01(value) as Score01;
}

export function clampThreshold(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function randomBase36(length: number): string {
  return Math.random().toString(36).slice(2, 2 + length).padEnd(length, '0');
}

// ============================================================================
// MARK: Exported diagnostics
// ============================================================================

export function describeHelperUrgency(urgency: HelperUrgencyVector): string {
  return [
    `rescue=${Number(urgency.rescueWindow01).toFixed(2)}`,
    `frustration=${Number(urgency.frustration01).toFixed(2)}`,
    `embarrassment=${Number(urgency.embarrassment01).toFixed(2)}`,
    `churn=${Number(urgency.churn01).toFixed(2)}`,
    `silence=${Number(urgency.silenceRisk01).toFixed(2)}`,
    `shield=${Number(urgency.shieldEmergency01).toFixed(2)}`,
    `deal=${Number(urgency.overpayRisk01).toFixed(2)}`,
    `hostile=${Number(urgency.hostileMomentum01).toFixed(2)}`,
    `receptivity=${Number(urgency.helperReceptivity01).toFixed(2)}`,
    `trust=${Number(urgency.relationshipTrust01).toFixed(2)}`,
    `debt=${Number(urgency.relationshipDebt01).toFixed(2)}`,
    `timing=${Number(urgency.inferenceTiming01).toFixed(2)}`,
    `final=${Number(urgency.finalUrgency01).toFixed(2)}`,
    `tactic=${urgency.tactic}`,
  ].join(' | ');
}

export function describeHelperPlan(plan: HelperResponsePlan): string {
  if (!plan.accepted || !plan.urgency || !plan.personaMatch) {
    return `rejected :: ${plan.reasons.join('; ')}`;
  }
  return [
    `accepted`,
    `persona=${plan.personaMatch.persona.displayName}`,
    `channel=${plan.channelId}`,
    `scene=${Boolean(plan.artifacts.scene)}`,
    describeHelperUrgency(plan.urgency),
  ].join(' :: ');
}

// ============================================================================
// MARK: Watch bus
// ============================================================================

export interface HelperResponseWatchEvent {
  readonly kind: 'plan_accepted' | 'plan_rejected' | 'urgency_computed' | 'persona_selected';
  readonly roomId: ChatRoomId;
  readonly at: UnixMs;
  readonly payload: Readonly<Record<string, JsonValue>>;
}

export type HelperResponseWatchHandler = (event: HelperResponseWatchEvent) => void;

export class HelperResponseWatchBus {
  private readonly handlers: HelperResponseWatchHandler[] = [];

  subscribe(handler: HelperResponseWatchHandler): () => void {
    this.handlers.push(handler);
    return () => {
      const idx = this.handlers.indexOf(handler);
      if (idx >= 0) this.handlers.splice(idx, 1);
    };
  }

  emit(event: HelperResponseWatchEvent): void {
    for (const h of this.handlers) {
      try { h(event); } catch { /* isolated */ }
    }
  }

  get listenerCount(): number {
    return this.handlers.length;
  }
}

// ============================================================================
// MARK: Fingerprint
// ============================================================================

export interface HelperResponseFingerprint {
  readonly roomId: ChatRoomId;
  readonly urgencyHash: string;
  readonly tactic: string;
  readonly accepted: boolean;
  readonly computedAt: UnixMs;
}

export function computeHelperResponseFingerprint(
  roomId: ChatRoomId,
  plan: HelperResponsePlan,
  now: UnixMs,
): HelperResponseFingerprint {
  const urgencyHash = plan.urgency
    ? [
        Number(plan.urgency.finalUrgency01).toFixed(3),
        plan.urgency.tactic,
        Number(plan.urgency.rescueWindow01).toFixed(2),
      ].join(':')
    : 'no-urgency';
  return Object.freeze({
    roomId,
    urgencyHash,
    tactic: plan.urgency?.tactic ?? 'none',
    accepted: plan.accepted,
    computedAt: now,
  });
}

// ============================================================================
// MARK: Epoch tracker
// ============================================================================

export interface HelperResponseEpochEntry {
  readonly roomId: ChatRoomId;
  readonly fingerprint: HelperResponseFingerprint;
  readonly at: UnixMs;
}

export class HelperResponseEpochTracker {
  private readonly epochs = new Map<ChatRoomId, HelperResponseEpochEntry[]>();

  record(roomId: ChatRoomId, fp: HelperResponseFingerprint, at: UnixMs): void {
    if (!this.epochs.has(roomId)) this.epochs.set(roomId, []);
    this.epochs.get(roomId)!.push({ roomId, fingerprint: fp, at });
  }

  getHistory(roomId: ChatRoomId): readonly HelperResponseEpochEntry[] {
    return this.epochs.get(roomId) ?? [];
  }

  getLastEntry(roomId: ChatRoomId): HelperResponseEpochEntry | null {
    const arr = this.epochs.get(roomId);
    return arr?.[arr.length - 1] ?? null;
  }

  listRoomIds(): readonly ChatRoomId[] {
    return Object.freeze([...this.epochs.keys()]);
  }

  clear(roomId: ChatRoomId): void {
    this.epochs.delete(roomId);
  }
}

// ============================================================================
// MARK: Batch planner
// ============================================================================

export interface HelperBatchEntry {
  readonly roomId: ChatRoomId;
  readonly plan: HelperResponsePlan;
  readonly fingerprint: HelperResponseFingerprint;
}

export interface HelperBatchResult {
  readonly entries: readonly HelperBatchEntry[];
  readonly acceptedCount: number;
  readonly rejectedCount: number;
  readonly computedAt: UnixMs;
}

export function runHelperBatchPlanning(
  authority: HelperResponseAuthority,
  contexts: ReadonlyArray<{ roomId: ChatRoomId; state: ChatState; signal: ChatSignalEnvelope; now: UnixMs }>,
  now: UnixMs,
): HelperBatchResult {
  const entries: HelperBatchEntry[] = [];
  let accepted = 0;
  let rejected = 0;
  for (const ctx of contexts) {
    const room = ctx.state.rooms[ctx.roomId];
    if (!room) {
      rejected++;
      continue;
    }
    const triggerCtx: HelperTriggerContext = {
      kind: 'BATTLE_SIGNAL',
      state: ctx.state,
      room,
      now: ctx.now,
      causeEventId: null,
      signal: ctx.signal,
      playerMessage: null,
      preferredChannelId: null,
    };
    const plan = authority.plan(triggerCtx);
    const fingerprint = computeHelperResponseFingerprint(ctx.roomId, plan, now);
    entries.push({ roomId: ctx.roomId, plan, fingerprint });
    if (plan.accepted) accepted++;
    else rejected++;
  }
  return Object.freeze({ entries: Object.freeze(entries), acceptedCount: accepted, rejectedCount: rejected, computedAt: now });
}

// ============================================================================
// MARK: Urgency statistics
// ============================================================================

export interface HelperUrgencyStats {
  readonly roomId: ChatRoomId;
  readonly maxFinalUrgency: number;
  readonly minFinalUrgency: number;
  readonly avgFinalUrgency: number;
  readonly acceptedRatio: number;
  readonly sampleCount: number;
}

export function buildHelperUrgencyStats(
  roomId: ChatRoomId,
  history: readonly HelperResponseEpochEntry[],
): HelperUrgencyStats {
  if (history.length === 0) {
    return Object.freeze({ roomId, maxFinalUrgency: 0, minFinalUrgency: 0, avgFinalUrgency: 0, acceptedRatio: 0, sampleCount: 0 });
  }
  let max = 0, min = 1, sum = 0, acceptedCount = 0;
  for (const entry of history) {
    const u = entry.fingerprint.tactic !== 'none' ? 0.5 : 0;
    if (u > max) max = u;
    if (u < min) min = u;
    sum += u;
    if (entry.fingerprint.accepted) acceptedCount++;
  }
  return Object.freeze({
    roomId,
    maxFinalUrgency: max,
    minFinalUrgency: min,
    avgFinalUrgency: sum / history.length,
    acceptedRatio: acceptedCount / history.length,
    sampleCount: history.length,
  });
}

// ============================================================================
// MARK: Persona frequency counter
// ============================================================================

export interface HelperPersonaFrequencyEntry {
  readonly personaId: ChatPersonaId;
  readonly count: number;
  readonly acceptedCount: number;
}

export function countPersonaFrequency(
  plans: readonly HelperResponsePlan[],
): readonly HelperPersonaFrequencyEntry[] {
  const map = new Map<ChatPersonaId, { count: number; accepted: number }>();
  for (const plan of plans) {
    const id = plan.personaMatch?.persona.personaId;
    if (!id) continue;
    const entry = map.get(id) ?? { count: 0, accepted: 0 };
    map.set(id, { count: entry.count + 1, accepted: entry.accepted + (plan.accepted ? 1 : 0) });
  }
  return Object.freeze(
    [...map.entries()].map(([personaId, { count, accepted }]) =>
      Object.freeze({ personaId, count, acceptedCount: accepted }),
    ),
  );
}

// ============================================================================
// MARK: Room helper pressure report
// ============================================================================

export interface HelperPressureReport {
  readonly roomId: ChatRoomId;
  readonly latestTactic: string;
  readonly consecutiveAccepted: number;
  readonly consecutiveRejected: number;
  readonly lastAcceptedAt: UnixMs | null;
  readonly urgencyTrend: 'rising' | 'falling' | 'stable';
}

export function buildHelperPressureReport(
  roomId: ChatRoomId,
  history: readonly HelperResponseEpochEntry[],
  now: UnixMs,
): HelperPressureReport {
  void now;
  let consecutiveAccepted = 0;
  let consecutiveRejected = 0;
  let lastAcceptedAt: UnixMs | null = null;
  let latestTactic = 'none';

  const reversed = [...history].reverse();
  for (const entry of reversed) {
    if (entry.fingerprint.accepted) {
      if (consecutiveRejected === 0) consecutiveAccepted++;
      if (!lastAcceptedAt) lastAcceptedAt = entry.at;
    } else {
      if (consecutiveAccepted === 0) consecutiveRejected++;
    }
    latestTactic = entry.fingerprint.tactic;
    break;
  }

  const urgencyTrend: 'rising' | 'falling' | 'stable' =
    consecutiveAccepted > 2 ? 'rising' : consecutiveRejected > 2 ? 'falling' : 'stable';

  return Object.freeze({ roomId, latestTactic, consecutiveAccepted, consecutiveRejected, lastAcceptedAt, urgencyTrend });
}

// ============================================================================
// MARK: Module constants and descriptor
// ============================================================================

export const HELPER_RESPONSE_MODULE_ID = 'helper_response_orchestrator' as const;
export const HELPER_RESPONSE_MODULE_VERSION = '2026.03.14' as const;

export interface HelperResponseModuleDescriptor {
  readonly moduleId: typeof HELPER_RESPONSE_MODULE_ID;
  readonly version: typeof HELPER_RESPONSE_MODULE_VERSION;
  readonly capabilities: readonly string[];
}

export const HELPER_RESPONSE_MODULE_DESCRIPTOR: HelperResponseModuleDescriptor = Object.freeze({
  moduleId: HELPER_RESPONSE_MODULE_ID,
  version: HELPER_RESPONSE_MODULE_VERSION,
  capabilities: Object.freeze([
    'urgency_computation',
    'persona_selection',
    'channel_selection',
    'scene_authoring',
    'rescue_planning',
    'batch_planning',
    'epoch_tracking',
    'fingerprinting',
    'watch_bus',
  ]),
});

// ============================================================================
// MARK: Extended module namespace
// ============================================================================

export namespace ChatHelperResponseOrchestratorModuleExtended {
  export type WatchBus = HelperResponseWatchBus;
  export type WatchEvent = HelperResponseWatchEvent;
  export type Fingerprint = HelperResponseFingerprint;
  export type EpochTracker = HelperResponseEpochTracker;
  export type BatchResult = HelperBatchResult;
  export type PressureReport = HelperPressureReport;
  export type UrgencyStats = HelperUrgencyStats;
  export type Descriptor = HelperResponseModuleDescriptor;

  export function createWatchBus(): HelperResponseWatchBus {
    return new HelperResponseWatchBus();
  }

  export function createEpochTracker(): HelperResponseEpochTracker {
    return new HelperResponseEpochTracker();
  }

  export function describe(): string {
    return `${HELPER_RESPONSE_MODULE_ID}@${HELPER_RESPONSE_MODULE_VERSION}`;
  }
}

// ============================================================================
// MARK: Tactic label utilities
// ============================================================================

export function helperTacticLabel(tactic: HelperUrgencyVector['tactic']): string {
  const map: Record<HelperUrgencyVector['tactic'], string> = {
    STEADY_HAND: 'Steady Hand',
    RAPID_REFRAME: 'Rapid Reframe',
    ONE_CARD_EXIT: 'One Card Exit',
    CONFIDENCE_RESET: 'Confidence Reset',
    SHIELD_TRIAGE: 'Shield Triage',
    DEALROOM_WARNING: 'Deal Room Warning',
    SILENT_SUPPORT: 'Silent Support',
    RESCUE_SHADOW: 'Rescue Shadow',
    BREATH_GATE: 'Breath Gate',
    POST_RUN_DEBRIEF: 'Post-Run Debrief',
  };
  return map[tactic] ?? tactic;
}

export function isHighPriorityTactic(tactic: HelperUrgencyVector['tactic']): boolean {
  return tactic === 'RESCUE_SHADOW' || tactic === 'SHIELD_TRIAGE';
}

export function isSilentTactic(tactic: HelperUrgencyVector['tactic']): boolean {
  return tactic === 'SILENT_SUPPORT' || tactic === 'BREATH_GATE';
}

// ============================================================================
// MARK: Relationship helpers
// ============================================================================

export function isHighTrustRelationship(relationship: ChatRelationshipState): boolean {
  return (Number(relationship.trust01) as number) >= 0.7;
}

export function isLowTrustRelationship(relationship: ChatRelationshipState): boolean {
  return (Number(relationship.trust01) as number) <= 0.3;
}

export function hasSignificantDebt(relationship: ChatRelationshipState): boolean {
  return (Number(relationship.rescueDebt01) as number) >= 0.5;
}

// ============================================================================
// MARK: Signal inspection utilities
// ============================================================================

export function signalHasBattleContext(signal: ChatSignalEnvelope): boolean {
  return Boolean(signal.battle);
}

export function signalHasEconomyContext(signal: ChatSignalEnvelope): boolean {
  return Boolean(signal.economy);
}

export function signalHasPresenceContext(signal: ChatSignalEnvelope): boolean {
  return Boolean(signal.multiplayer);
}

export function getSignalRoomId(signal: ChatSignalEnvelope): ChatRoomId | null {
  return signal.roomId ?? null;
}

export function getSignalEventId(signal: ChatSignalEnvelope): ChatEventId | null {
  return (signal.metadata?.['eventId'] as ChatEventId | undefined) ?? null;
}

// ============================================================================
// MARK: Runtime config inspection
// ============================================================================

export function helperChannelIsAllowed(
  config: ReturnType<typeof mergeRuntimeConfig>,
  channel: ChatVisibleChannel,
): boolean {
  return (config.allowVisibleChannels ?? []).includes(channel);
}

export function helperRoomKindIsAllowed(
  config: ReturnType<typeof mergeRuntimeConfig>,
  roomKind: ChatRoomKind,
): boolean {
  // ChatRuntimeConfig does not carry allowRoomKinds; shadow rooms need at
  // least one shadow channel configured, everything else just needs visible channels.
  const shadowOnlyKinds: readonly ChatRoomKind[] = ['DEAL_ROOM', 'PRIVATE', 'SYNDICATE'];
  if (shadowOnlyKinds.includes(roomKind)) {
    return config.allowShadowChannels.length > 0;
  }
  return config.allowVisibleChannels.length > 0;
}

// ============================================================================
// MARK: Affect inspection utilities
// ============================================================================

export function isHighEmbarrassmentAffect(affect: ChatAffectSnapshot): boolean {
  return (Number(affect.embarrassment01) as number) >= 0.65;
}

export function isHighFrustrationAffect(affect: ChatAffectSnapshot): boolean {
  return (Number(affect.frustration01) as number) >= 0.65;
}

export function isHighConfidenceAffect(affect: ChatAffectSnapshot): boolean {
  return (Number(affect.confidence01) as number) >= 0.7;
}

// ============================================================================
// MARK: Audience heat inspection
// ============================================================================

export function audienceIsHot(heat: ChatAudienceHeat): boolean {
  return (Number(heat.heat01) as number) >= 0.75;
}

export function audienceIsVeryHot(heat: ChatAudienceHeat): boolean {
  return (Number(heat.heat01) as number) >= 0.9;
}

export function audienceHeatLabel(heat: ChatAudienceHeat): string {
  const h = Number(heat.heat01) as number;
  if (h >= 0.9) return 'scalding';
  if (h >= 0.75) return 'hot';
  if (h >= 0.5) return 'warm';
  if (h >= 0.25) return 'cool';
  return 'cold';
}

// ============================================================================
// MARK: Learning profile inspection
// ============================================================================

export function hasHighHelperReceptivity(profile: ChatLearningProfile): boolean {
  return (Number(profile.helperReceptivity01) as number) >= 0.6;
}

export function hasLowHelperReceptivity(profile: ChatLearningProfile): boolean {
  return (Number(profile.helperReceptivity01) as number) <= 0.3;
}

// ============================================================================
// MARK: Room state inspection
// ============================================================================

export function roomHasActiveInvasion(state: ChatState, roomId: ChatRoomId): boolean {
  return getActiveRoomInvasions(state, roomId).length > 0;
}

export function roomIsCurrentlySilenced(state: ChatState, roomId: ChatRoomId, now: UnixMs): boolean {
  void pruneExpiredSilences(state, now);
  return isRoomSilenced(state, roomId, now);
}

export function getLatestRoomMessage(state: ChatState, roomId: ChatRoomId): ChatMessage | null {
  return selectLatestMessage(state, roomId);
}

export function getRoomAudienceHeat(state: ChatState, roomId: ChatRoomId): ChatAudienceHeat | null {
  return selectAudienceHeat(state, roomId);
}

export function getRoomLearningProfile(state: ChatState, _roomId: ChatRoomId, userId: ChatUserId): ChatLearningProfile | null {
  return selectLearningProfile(state, userId);
}

export function getRoomInferenceSnapshots(state: ChatState, _roomId: ChatRoomId, userId: ChatUserId): readonly ChatInferenceSnapshot[] {
  return selectInferenceSnapshotsForUser(state, userId);
}

export function getRoomRelationship(state: ChatState, roomId: ChatRoomId, actorId: string, userId: ChatUserId): ChatRelationshipState | null {
  return selectRelationshipForActor(state, roomId, actorId, userId);
}

export function getRoomPresence(state: ChatState, roomId: ChatRoomId): ReturnType<typeof selectRoomPresence> {
  return selectRoomPresence(state, roomId);
}

export function getRoomVisibleMessages(state: ChatState, roomId: ChatRoomId): readonly ChatMessage[] {
  return selectVisibleMessages(state, roomId);
}

export function applyHelperScenePlan(state: ChatState, roomId: ChatRoomId, sceneId: ChatSceneId, _plan: ChatScenePlan): ChatState {
  return setRoomScene(state, roomId, sceneId);
}

export function applyHelperSilenceDecision(state: ChatState, roomId: ChatRoomId, decision: ChatSilenceDecision): ChatState {
  return setSilenceDecision(state, roomId, decision);
}

// ============================================================================
// MARK: Persona utilities
// ============================================================================

export function personaChannelIds(persona: ChatPersonaDescriptor): readonly ChatChannelId[] {
  return persona.preferredChannels ?? [];
}

export function personaSupportsChannel(persona: ChatPersonaDescriptor, channelId: ChatChannelId): boolean {
  return personaChannelIds(persona).includes(channelId);
}

export function personaDisplayLabel(persona: ChatPersonaDescriptor): string {
  return `${persona.displayName} [${persona.personaId}]`;
}

// ============================================================================
// MARK: Inference snapshot helpers
// ============================================================================

export function latestInference(snapshots: readonly ChatInferenceSnapshot[]): ChatInferenceSnapshot | null {
  if (snapshots.length === 0) return null;
  return snapshots.reduce((best, s) => (Number(s.generatedAt) > Number(best.generatedAt) ? s : best));
}

export function inferenceEngagementAbove(snapshot: ChatInferenceSnapshot, threshold: number): boolean {
  return (Number(snapshot.engagement01) as number) >= threshold;
}

// ============================================================================
// MARK: Response candidate utilities
// ============================================================================

export function candidateHasBody(candidate: ChatResponseCandidate): boolean {
  return candidate.text.trim().length > 0;
}

export function candidateBodyLength(candidate: ChatResponseCandidate): number {
  return candidate.text.length;
}

export function sortCandidatesByScore(candidates: readonly ChatResponseCandidate[]): readonly ChatResponseCandidate[] {
  return [...candidates].sort((a, b) => b.priority - a.priority);
}

export function topCandidate(candidates: readonly ChatResponseCandidate[]): ChatResponseCandidate | null {
  return sortCandidatesByScore(candidates)[0] ?? null;
}

// ============================================================================
// MARK: Nullable utilities re-exported for helper consumers
// ============================================================================

export function isNullable<T>(value: Nullable<T>): value is null | undefined {
  return value == null;
}

export function unwrapNullable<T>(value: Nullable<T>, fallback: T): T {
  return value ?? fallback;
}

// ============================================================================
// MARK: Helper module full export
// ============================================================================

export const CHAT_HELPER_RESPONSE_FULL_MODULE = Object.freeze({
  descriptor: HELPER_RESPONSE_MODULE_DESCRIPTOR,
  createWatchBus: () => new HelperResponseWatchBus(),
  createEpochTracker: () => new HelperResponseEpochTracker(),
  runBatch: runHelperBatchPlanning,
  buildPressureReport: buildHelperPressureReport,
  buildUrgencyStats: buildHelperUrgencyStats,
  countPersonaFrequency,
  computeFingerprint: computeHelperResponseFingerprint,
  // tactic utilities
  tacticLabel: helperTacticLabel,
  isHighPriority: isHighPriorityTactic,
  isSilent: isSilentTactic,
  // relationship utilities
  isHighTrust: isHighTrustRelationship,
  isLowTrust: isLowTrustRelationship,
  hasDebt: hasSignificantDebt,
  // signal utilities
  signalHasBattle: signalHasBattleContext,
  signalHasEconomy: signalHasEconomyContext,
  signalHasPresence: signalHasPresenceContext,
  getSignalRoomId,
  getSignalEventId,
  // runtime config
  channelIsAllowed: helperChannelIsAllowed,
  roomKindIsAllowed: helperRoomKindIsAllowed,
  // affect utilities
  isHighEmbarrassment: isHighEmbarrassmentAffect,
  isHighFrustration: isHighFrustrationAffect,
  isHighConfidence: isHighConfidenceAffect,
  // audience heat
  audienceIsHot,
  audienceIsVeryHot,
  audienceHeatLabel,
  // learning profile
  hasHighReceptivity: hasHighHelperReceptivity,
  hasLowReceptivity: hasLowHelperReceptivity,
  // room state
  roomHasInvasion: roomHasActiveInvasion,
  roomIsSilenced: roomIsCurrentlySilenced,
  getLatestMessage: getLatestRoomMessage,
  getAudienceHeat: getRoomAudienceHeat,
  getLearningProfile: getRoomLearningProfile,
  getInferenceSnapshots: getRoomInferenceSnapshots,
  getRelationship: getRoomRelationship,
  getPresence: getRoomPresence,
  getVisibleMessages: getRoomVisibleMessages,
  // state application
  applyScenePlan: applyHelperScenePlan,
  applySilenceDecision: applyHelperSilenceDecision,
  // persona utilities
  personaChannels: personaChannelIds,
  personaSupportsChannel,
  personaLabel: personaDisplayLabel,
  // inference
  latestInference,
  inferenceEngagementAbove,
  // candidates
  candidateHasBody,
  candidateBodyLength,
  sortCandidates: sortCandidatesByScore,
  topCandidate,
  // nullable
  isNullable,
  unwrapNullable,
});

