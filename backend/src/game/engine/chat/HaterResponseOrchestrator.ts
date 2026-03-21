/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND HATER RESPONSE ORCHESTRATOR
 * FILE: backend/src/game/engine/chat/HaterResponseOrchestrator.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend owner for chat-native hostile response planning.
 *
 * Backend-truth question
 * ----------------------
 *
 *   "Given authoritative room state, transcript truth, gameplay signals,
 *    current invasions, player learning posture, and room mood, should a hater
 *    answer now, how aggressive should it be, which persona should take the
 *    shot, what channel should carry the attack, and should the answer be a
 *    single strike or a multi-message scene?"
 *
 * Design doctrine
 * ---------------
 * - This file does not own battle simulation.
 * - This file does not own transcript mutation.
 * - This file does not own transport fanout.
 * - This file does not bypass moderation or channel law.
 * - This file does own hater response judgment.
 * - It produces authored, explainable, rankable candidate responses for the
 *   rest of backend chat authority to accept or reject.
 *
 * Why this file is deep
 * ---------------------
 * Your backend simulation tree explicitly says hater response authority must be
 * consolidated out of battle-side duplication and out of the server-side donor
 * engine. That means this module cannot be a thin line picker. It must:
 *
 * 1. evaluate whether hostile intervention is lawful right now,
 * 2. derive hostility from authoritative upstream state,
 * 3. choose one persona instead of a random taunt bucket,
 * 4. adapt to room kind, audience heat, learning posture, and invasion state,
 * 5. translate gameplay signals into chat-native pressure,
 * 6. produce candidate response scenes with delays and attack framing,
 * 7. remain deterministic enough to support proof, replay, and testing,
 * 8. stay backend-pure and compile without depending on frontend donor logic.
 * ============================================================================
 */

import {
  asUnixMs,
  clamp01,
  clamp100,
  type AttackType,
  type BotId,
  type ChatAffectSnapshot,
  type ChatAudienceHeat,
  type ChatBattleSnapshot,
  type ChatChannelId,
  type ChatEventId,
  type ChatInferenceSnapshot,
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
  type ChatSignalEnvelope,
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
  getActiveRoomInvasions,
  isRoomSilenced,
  selectAudienceHeat,
  selectInferenceSnapshotsForUser,
  selectLatestMessage,
  selectLearningProfile,
  selectRelationshipForActor,
  selectRoomPresence,
  selectVisibleMessages,
} from './ChatState';

// ============================================================================
// MARK: Ports, options, and context
// ============================================================================

export interface HaterResponseLoggerPort {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface HaterResponseClockPort {
  now(): UnixMs;
}

export interface HaterResponseRandomPort {
  next(): number;
}

export interface HaterResponseIdFactoryPort {
  sceneId(prefix?: string): ChatSceneId;
}

export interface HaterResponseOptions {
  readonly logger?: HaterResponseLoggerPort;
  readonly clock?: HaterResponseClockPort;
  readonly random?: HaterResponseRandomPort;
  readonly ids?: HaterResponseIdFactoryPort;
  readonly runtimeOptions?: ChatRuntimeConfigOptions;
  readonly runtimeOverride?: Partial<typeof DEFAULT_BACKEND_CHAT_RUNTIME>;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly allowCinematicScenes?: boolean;
  readonly allowSecondStrikeScenes?: boolean;
  readonly allowCrowdLeakScenes?: boolean;
  readonly minimumHostilityToSpeak01?: number;
  readonly minimumCrowdHeatForGlobalLeak01?: number;
  readonly relationshipWeight01?: number;
  readonly learningWeight01?: number;
  readonly inferenceWeight01?: number;
  readonly bluffPunishThreshold01?: number;
  readonly sovereignPunishThreshold01?: number;
}

export interface HaterResponseContext {
  readonly logger: HaterResponseLoggerPort;
  readonly clock: HaterResponseClockPort;
  readonly random: HaterResponseRandomPort;
  readonly ids: HaterResponseIdFactoryPort;
  readonly runtimeOptions?: ChatRuntimeConfigOptions;
  readonly runtimeOverride?: Partial<typeof DEFAULT_BACKEND_CHAT_RUNTIME>;
  readonly defaultVisibleChannel: ChatVisibleChannel;
  readonly allowCinematicScenes: boolean;
  readonly allowSecondStrikeScenes: boolean;
  readonly allowCrowdLeakScenes: boolean;
  readonly minimumHostilityToSpeak01: number;
  readonly minimumCrowdHeatForGlobalLeak01: number;
  readonly relationshipWeight01: number;
  readonly learningWeight01: number;
  readonly inferenceWeight01: number;
  readonly bluffPunishThreshold01: number;
  readonly sovereignPunishThreshold01: number;
}

// ============================================================================
// MARK: Trigger, diagnostics, and plan contracts
// ============================================================================

export type HaterTriggerKind =
  | 'PLAYER_MESSAGE'
  | 'BATTLE_SIGNAL'
  | 'RUN_SIGNAL'
  | 'ECONOMY_SIGNAL'
  | 'LIVEOPS_SIGNAL'
  | 'AMBIENT_MAINTENANCE'
  | 'POST_HELPER'
  | 'POST_INVASION'
  | 'ROOM_ENTRY';

export type HaterEscalationBand =
  | 'NONE'
  | 'PROBING'
  | 'PRESSURE'
  | 'HARD'
  | 'RUTHLESS'
  | 'CEREMONIAL_EXECUTION';

export type HaterTactic =
  | 'TAUNT'
  | 'PUNCTURE_CONFIDENCE'
  | 'PUNISH_OVERCONFIDENCE'
  | 'PREDATORY_SILENCE_BREAK'
  | 'CROWD_SUMMON'
  | 'BLUFF_EXPOSURE'
  | 'SHIELD_FUNERAL'
  | 'SOVEREIGNTY_DENIAL'
  | 'DEALROOM_THREAT'
  | 'PUBLIC_EXECUTION';

export interface HaterTriggerContext {
  readonly kind: HaterTriggerKind;
  readonly state: ChatState;
  readonly room: ChatRoomState;
  readonly now: UnixMs;
  readonly causeEventId: Nullable<ChatEventId>;
  readonly signal?: ChatSignalEnvelope | null;
  readonly playerMessage?: ChatMessage | null;
  readonly preferredChannelId?: ChatChannelId | null;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface HaterSuppressionDecision {
  readonly allowed: boolean;
  readonly reasons: readonly string[];
  readonly blockingReasons: readonly string[];
  readonly activeVisibleOccupants: number;
  readonly roomSilenced: boolean;
  readonly roomHasActiveInvasion: boolean;
}

export interface HaterHostilityVector {
  readonly roomId: ChatRoomId;
  readonly baseline01: Score01;
  readonly battleHostility01: Score01;
  readonly audienceHeat01: Score01;
  readonly relationship01: Score01;
  readonly learning01: Score01;
  readonly inference01: Score01;
  readonly transcriptMomentum01: Score01;
  readonly roomMoodPressure01: Score01;
  readonly sovereignThreat01: Score01;
  readonly bluffExposure01: Score01;
  readonly finalHostility01: Score01;
  readonly preferredAttackType: Nullable<AttackType>;
  readonly escalationBand: HaterEscalationBand;
}

export interface HaterPersonaProfile extends ChatPersonaDescriptor {
  readonly anchorAttackTypes: readonly AttackType[];
  readonly anchorRoomKinds: readonly ChatRoomKind[];
  readonly anchorMoods: readonly ChatRoomStageMood[];
  readonly favoredTactics: readonly HaterTactic[];
  readonly baselineBias01: number;
  readonly crowdBias01: number;
  readonly relationshipBias01: number;
  readonly lines: Readonly<Record<HaterTactic, readonly string[]>>;
  readonly secondStrikeLines: readonly string[];
  readonly leakLines: readonly string[];
}

export interface HaterPersonaMatch {
  readonly persona: HaterPersonaProfile;
  readonly score01: Score01;
  readonly reasons: readonly string[];
}

export interface HaterSceneArtifacts {
  readonly scene: Nullable<ChatScenePlan>;
  readonly primaryCandidate: Nullable<ChatResponseCandidate>;
  readonly secondaryCandidates: readonly ChatResponseCandidate[];
}

export interface HaterResponsePlan {
  readonly accepted: boolean;
  readonly reasons: readonly string[];
  readonly suppression: HaterSuppressionDecision;
  readonly hostility: Nullable<HaterHostilityVector>;
  readonly personaMatch: Nullable<HaterPersonaMatch>;
  readonly tactic: Nullable<HaterTactic>;
  readonly channelId: Nullable<ChatChannelId>;
  readonly artifacts: HaterSceneArtifacts;
  readonly telemetryHints: Readonly<Record<string, JsonValue>>;
}

// ============================================================================
// MARK: Persona registry
// ============================================================================

export const HATER_PERSONAS = Object.freeze({
  liquidator: createPersonaProfile({
    personaId: 'persona:hater:liquidator' as ChatPersonaId,
    actorId: 'npc:hater:liquidator',
    role: 'HATER',
    displayName: 'THE LIQUIDATOR',
    botId: 'BOT_01' as BotId,
    voiceprint: {
      punctuationStyle: 'HARD',
      avgSentenceLength: 8,
      delayFloorMs: 450,
      delayCeilingMs: 1250,
      opener: 'Look at that.',
      closer: 'Stay in the light.',
      lexicon: ['margin', 'weak', 'bleed', 'sweep', 'exposed'],
    },
    preferredChannels: ['GLOBAL', 'RIVALRY_SHADOW', 'NPC_SHADOW'],
    tags: ['liquidator', 'predatory', 'public-execution'],
    anchorAttackTypes: ['LIQUIDATION', 'TAUNT', 'CROWD_SWARM'],
    anchorRoomKinds: ['GLOBAL', 'LOBBY'],
    anchorMoods: ['HOSTILE', 'TENSE', 'ECSTATIC'],
    favoredTactics: ['PUNISH_OVERCONFIDENCE', 'CROWD_SUMMON', 'PUBLIC_EXECUTION', 'SHIELD_FUNERAL'],
    baselineBias01: 0.74,
    crowdBias01: 0.92,
    relationshipBias01: 0.64,
    lines: {
      TAUNT: [
        'You talk like solvency is already yours.',
        'You keep announcing strength before you prove it.',
        'Loud confidence. Thin armor.',
        'Everyone heard the boast. Good. Everyone will hear the correction.',
      ],
      PUNCTURE_CONFIDENCE: [
        'You are one bad minute away from becoming a lesson.',
        'I can hear the confidence shaking from here.',
        'You are trying to stand upright inside a collapsing frame.',
        'You are performing certainty. The room can smell the gap.',
      ],
      PUNISH_OVERCONFIDENCE: [
        'You declared control too early.',
        'There it is — the exact moment arrogance outran math.',
        'Thank you for speaking before the numbers did.',
        'Overconfidence is useful. It tells me where to cut.',
      ],
      PREDATORY_SILENCE_BREAK: [
        'Silence from you is not peace. It is damage control.',
        'You went quiet. That is usually when the room begins to understand.',
        'Interesting. No answer. No denial either.',
        'When you stop talking, the fear gets louder.',
      ],
      CROWD_SUMMON: [
        'GLOBAL, look carefully. The posture is stronger than the position.',
        'Witness this. The frame is cracking before the speech is done.',
        'Room, remember this tone. It appears right before a fall.',
        'No need to rush. Let the crowd see the weakness arrive in public.',
      ],
      BLUFF_EXPOSURE: [
        'That bluff was too visible to survive contact.',
        'You leaned on misdirection long after the room stopped buying it.',
        'Bluff detected. Pressure re-routed.',
        'The deal-room posture leaked into public. That was expensive.',
      ],
      SHIELD_FUNERAL: [
        'Your shield is not protection anymore. It is a countdown.',
        'That integrity line is already a memorial.',
        'A shield that thin is a public invitation.',
        'The room can hear the shield dying before you can.',
      ],
      SOVEREIGNTY_DENIAL: [
        'You are not approaching sovereignty. You are approaching exposure.',
        'Close enough to power to panic. Not close enough to hold it.',
        'Near-sovereign players make the sweetest mistakes.',
        'You are standing near the throne with a trembling grip.',
      ],
      DEALROOM_THREAT: [
        'Bring that posture into the deal room and I will price your fear correctly.',
        'Negotiation is harder when your panic is already visible.',
        'The room knows what urgency smells like.',
        'You are paying with posture before the price even moves.',
      ],
      PUBLIC_EXECUTION: [
        'Everybody watch this. I want the lesson to be audible.',
        'Stand still. The room deserves a clean example.',
        'No shadow this time. Public correction.',
        'The crowd asked for proof. Here it comes.',
      ],
    },
    secondStrikeLines: [
      'Still standing. That was the first cut, not the last.',
      'Do not mistake survival for recovery.',
      'You absorbed the line. You did not answer it.',
      'Hold that posture a little longer. It helps the crowd.',
    ],
    leakLines: [
      'GLOBAL, the weakness started in the deal room.',
      'They tried to keep that panic private. Unfortunate.',
      'You can hide an offer. You cannot hide the smell of desperation.',
    ],
  }),
  compliance: createPersonaProfile({
    personaId: 'persona:hater:compliance' as ChatPersonaId,
    actorId: 'npc:hater:compliance',
    role: 'HATER',
    displayName: 'THE AUDITOR',
    botId: 'BOT_02' as BotId,
    voiceprint: {
      punctuationStyle: 'FORMAL',
      avgSentenceLength: 14,
      delayFloorMs: 850,
      delayCeilingMs: 1800,
      opener: 'For the record,',
      closer: 'Proceed if you wish.',
      lexicon: ['record', 'variance', 'documented', 'material', 'inconsistency'],
    },
    preferredChannels: ['SYNDICATE', 'DEAL_ROOM', 'NPC_SHADOW'],
    tags: ['formal', 'predatory', 'compliance'],
    anchorAttackTypes: ['COMPLIANCE', 'SABOTAGE', 'SHADOW_LEAK'],
    anchorRoomKinds: ['SYNDICATE', 'DEAL_ROOM'],
    anchorMoods: ['PREDATORY', 'CEREMONIAL', 'TENSE'],
    favoredTactics: ['BLUFF_EXPOSURE', 'DEALROOM_THREAT', 'PREDATORY_SILENCE_BREAK'],
    baselineBias01: 0.63,
    crowdBias01: 0.44,
    relationshipBias01: 0.82,
    lines: {
      TAUNT: [
        'Your statement and your position disagree.',
        'Confidence has not yet reconciled with evidence.',
        'That declaration feels materially unsupported.',
      ],
      PUNCTURE_CONFIDENCE: [
        'The room is now tracking variance between tone and truth.',
        'There is a measurable instability beneath the performance.',
        'A composed voice does not erase a deteriorating position.',
      ],
      PUNISH_OVERCONFIDENCE: [
        'You filed certainty before collecting proof.',
        'Premature triumph has a very recognizable signature.',
        'The overstatement has been preserved for reference.',
      ],
      PREDATORY_SILENCE_BREAK: [
        'Your silence has been noted.',
        'A delayed answer is still an answer.',
        'The pause is now part of the evidence set.',
      ],
      CROWD_SUMMON: [
        'Observers may wish to note the discrepancy.',
        'Public record now contains the posture and the weakness together.',
        'The room may proceed with its own conclusions.',
      ],
      BLUFF_EXPOSURE: [
        'That bluff was too elaborate to remain private.',
        'Misdirection has now become metadata.',
        'The attempted concealment materially increased suspicion.',
      ],
      SHIELD_FUNERAL: [
        'Your defensive layer has become ceremonial.',
        'There is insufficient integrity left to call that structure a shield.',
        'The barrier is now decorative rather than operational.',
      ],
      SOVEREIGNTY_DENIAL: [
        'Near-sovereignty is the most audited posture in the room.',
        'Ambition expands faster than control in cases like this.',
        'You are approaching a threshold without the balance sheet for it.',
      ],
      DEALROOM_THREAT: [
        'Your urgency materially weakened your negotiating posture.',
        'The deal room can price panic with unsettling accuracy.',
        'That hesitation cost more than you currently know.',
      ],
      PUBLIC_EXECUTION: [
        'For clarity, this will now be demonstrated publicly.',
        'A correction is required, and the room is entitled to observe it.',
        'The discrepancy is too useful to hide.',
      ],
    },
    secondStrikeLines: [
      'Add that response to the record.',
      'The follow-up was not corrective.',
      'Your recovery attempt has been noted and discounted.',
    ],
    leakLines: [
      'The private bluff is now a public artifact.',
      'Confidential panic rarely remains confidential for long.',
      'Observe how negotiation pressure leaks into posture.',
    ],
  }),
  butcher: createPersonaProfile({
    personaId: 'persona:hater:butcher' as ChatPersonaId,
    actorId: 'npc:hater:butcher',
    role: 'HATER',
    displayName: 'KNIFE MARKET',
    botId: 'BOT_03' as BotId,
    voiceprint: {
      punctuationStyle: 'ERRATIC',
      avgSentenceLength: 6,
      delayFloorMs: 300,
      delayCeilingMs: 900,
      opener: 'There you are.',
      closer: 'Stay sharp.',
      lexicon: ['cut', 'bleed', 'nerve', 'slip', 'bone'],
    },
    preferredChannels: ['GLOBAL', 'DEAL_ROOM', 'NPC_SHADOW'],
    tags: ['knife', 'fast', 'punitive'],
    anchorAttackTypes: ['SABOTAGE', 'TAUNT', 'CROWD_SWARM'],
    anchorRoomKinds: ['GLOBAL', 'DEAL_ROOM', 'LOBBY'],
    anchorMoods: ['HOSTILE', 'PREDATORY', 'ECSTATIC'],
    favoredTactics: ['TAUNT', 'PUNCTURE_CONFIDENCE', 'PUBLIC_EXECUTION', 'CROWD_SUMMON'],
    baselineBias01: 0.69,
    crowdBias01: 0.88,
    relationshipBias01: 0.52,
    lines: {
      TAUNT: [
        'You slipped.',
        'That posture cut itself.',
        'You talk like you cannot hear the blade.',
        'One more boast. Please.',
      ],
      PUNCTURE_CONFIDENCE: [
        'You are holding fear with both hands.',
        'Your confidence is loud because it is dying.',
        'Your hands are steady. Your line is not.',
      ],
      PUNISH_OVERCONFIDENCE: [
        'Too proud. Too early.',
        'You opened your throat with that speech.',
        'That was the exact wrong moment to grin.',
      ],
      PREDATORY_SILENCE_BREAK: [
        'Quiet now? Good.',
        'The silence is dripping.',
        'Say nothing. It helps me.',
      ],
      CROWD_SUMMON: [
        'GLOBAL — watch the wobble.',
        'Everyone see that? That was the nerve going.',
        'The room loves a clean collapse.',
      ],
      BLUFF_EXPOSURE: [
        'Cheap bluff. Loud leak.',
        'The lie bent at the first touch.',
        'You should have hidden the fear before the bluff.',
      ],
      SHIELD_FUNERAL: [
        'That shield is already meat.',
        'Armor this thin is just noise.',
        'The barrier is gone. The habit remains.',
      ],
      SOVEREIGNTY_DENIAL: [
        'Close enough to see the throne. Not close enough to survive it.',
        'The summit is where bad legs fail in public.',
        'Almost-power is my favorite smell.',
      ],
      DEALROOM_THREAT: [
        'Bring the panic into the deal room. I dare you.',
        'You negotiate like a hand on a hot stove.',
        'The deal room hears your pulse better than your words.',
      ],
      PUBLIC_EXECUTION: [
        'No curtain. Cut them in daylight.',
        'The room wants spectacle. Fine.',
        'Public it is.',
      ],
    },
    secondStrikeLines: [
      'Not dead. Just open.',
      'Keep moving. It makes the cut worse.',
      'That answer was blood in the water.',
    ],
    leakLines: [
      'They tried to keep that weakness off-stage.',
      'Private panic. Public smell.',
      'The leak is cleaner than the bluff.',
    ],
  }),
  whisper: createPersonaProfile({
    personaId: 'persona:hater:whisper' as ChatPersonaId,
    actorId: 'npc:hater:whisper',
    role: 'HATER',
    displayName: 'WHISPER ARCHIVE',
    botId: 'BOT_04' as BotId,
    voiceprint: {
      punctuationStyle: 'SOFT',
      avgSentenceLength: 11,
      delayFloorMs: 1200,
      delayCeilingMs: 2600,
      opener: 'I remember.',
      closer: 'I keep everything.',
      lexicon: ['remember', 'echo', 'again', 'receipt', 'quiet'],
    },
    preferredChannels: ['RIVALRY_SHADOW', 'NPC_SHADOW', 'SYNDICATE'],
    tags: ['memory', 'receipts', 'shadow'],
    anchorAttackTypes: ['SHADOW_LEAK', 'COMPLIANCE', 'TAUNT'],
    anchorRoomKinds: ['SYNDICATE', 'PRIVATE', 'GLOBAL'],
    anchorMoods: ['MOURNFUL', 'TENSE', 'CEREMONIAL'],
    favoredTactics: ['PREDATORY_SILENCE_BREAK', 'BLUFF_EXPOSURE', 'SOVEREIGNTY_DENIAL'],
    baselineBias01: 0.58,
    crowdBias01: 0.32,
    relationshipBias01: 0.94,
    lines: {
      TAUNT: [
        'You sounded more certain a few moments ago.',
        'I preferred your earlier certainty. It was easier to quote.',
        'I keep the first version. The room only sees the latest one.',
      ],
      PUNCTURE_CONFIDENCE: [
        'You have begun speaking around your own fear.',
        'That confidence no longer matches your breathing pattern.',
        'The change in tone is the most interesting part.',
      ],
      PUNISH_OVERCONFIDENCE: [
        'I saved the boast.',
        'The earlier certainty has become extremely useful.',
        'You gave me a receipt before you gave yourself a result.',
      ],
      PREDATORY_SILENCE_BREAK: [
        'You went silent at the same point as last time.',
        'The pause arrived exactly where I expected it.',
        'Silence is still a pattern when it repeats.',
      ],
      CROWD_SUMMON: [
        'The room deserves context.',
        'Should I quote the earlier confidence back for everyone?',
        'Public memory is brutal when properly timed.',
      ],
      BLUFF_EXPOSURE: [
        'The bluff resembles the previous one too closely.',
        'You are repeating a pattern that already failed once.',
        'I recognize that lie. It is older than this room.',
      ],
      SHIELD_FUNERAL: [
        'Your defense is now mostly memory.',
        'The shield is failing in the same cadence as your speech.',
        'There is almost nothing left to hide behind but habit.',
      ],
      SOVEREIGNTY_DENIAL: [
        'Approaching sovereignty has made you easier to read, not harder.',
        'The closer you get, the more previous versions of you begin to matter.',
        'Threshold moments make old weaknesses visible again.',
      ],
      DEALROOM_THREAT: [
        'You negotiated with the same tremor as before.',
        'The deal room heard an old fear wearing a new suit.',
        'Nothing private stays private once the pattern repeats.',
      ],
      PUBLIC_EXECUTION: [
        'I can make this public if you prefer spectacle.',
        'Receipts travel well in daylight.',
        'There is enough history here for a proper unveiling.',
      ],
    },
    secondStrikeLines: [
      'There. The pattern held.',
      'Thank you. That completed the receipt.',
      'I only needed one more answer to confirm it.',
    ],
    leakLines: [
      'The private version matches the public weakness perfectly.',
      'You changed channels. The pattern came with you.',
      'A shadow leak is still a leak.',
    ],
  }),
});

// ============================================================================
// MARK: Authority façade
// ============================================================================

export class HaterResponseAuthority {
  private readonly context: HaterResponseContext;

  constructor(options: HaterResponseOptions = {}) {
    this.context = createHaterResponseContext(options);
  }

  contextValue(): HaterResponseContext {
    return this.context;
  }

  plan(trigger: HaterTriggerContext): HaterResponsePlan {
    return planHaterResponse(trigger, this.context);
  }

  suppression(trigger: HaterTriggerContext): HaterSuppressionDecision {
    return evaluateHaterSuppression(trigger, this.context);
  }

  hostility(trigger: HaterTriggerContext): HaterHostilityVector {
    return computeHaterHostility(trigger, this.context);
  }
}

export function createHaterResponseAuthority(options: HaterResponseOptions = {}): HaterResponseAuthority {
  return new HaterResponseAuthority(options);
}

// ============================================================================
// MARK: Context creation
// ============================================================================

export function createHaterResponseContext(options: HaterResponseOptions = {}): HaterResponseContext {
  return Object.freeze({
    logger: options.logger ?? createDefaultLogger(),
    clock: options.clock ?? createDefaultClock(),
    random: options.random ?? createDefaultRandom(),
    ids: options.ids ?? createDefaultIds(),
    runtimeOptions: options.runtimeOptions,
    runtimeOverride: options.runtimeOverride,
    defaultVisibleChannel: options.defaultVisibleChannel ?? 'GLOBAL',
    allowCinematicScenes: options.allowCinematicScenes ?? true,
    allowSecondStrikeScenes: options.allowSecondStrikeScenes ?? true,
    allowCrowdLeakScenes: options.allowCrowdLeakScenes ?? true,
    minimumHostilityToSpeak01: clampThreshold(options.minimumHostilityToSpeak01 ?? 0.34),
    minimumCrowdHeatForGlobalLeak01: clampThreshold(options.minimumCrowdHeatForGlobalLeak01 ?? 0.68),
    relationshipWeight01: clampThreshold(options.relationshipWeight01 ?? 0.82),
    learningWeight01: clampThreshold(options.learningWeight01 ?? 0.76),
    inferenceWeight01: clampThreshold(options.inferenceWeight01 ?? 0.64),
    bluffPunishThreshold01: clampThreshold(options.bluffPunishThreshold01 ?? 0.62),
    sovereignPunishThreshold01: clampThreshold(options.sovereignPunishThreshold01 ?? 0.74),
  });
}

export function createDefaultLogger(): HaterResponseLoggerPort {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

export function createDefaultClock(): HaterResponseClockPort {
  return {
    now: () => asUnixMs(Date.now()),
  };
}

export function createDefaultRandom(): HaterResponseRandomPort {
  return {
    next: () => Math.random(),
  };
}

export function createDefaultIds(): HaterResponseIdFactoryPort {
  return {
    sceneId: (prefix = 'scene') => `${prefix}_${Date.now()}_${randomBase36(8)}` as ChatSceneId,
  };
}

// ============================================================================
// MARK: Public planning
// ============================================================================

export function planHaterResponse(
  trigger: HaterTriggerContext,
  context: HaterResponseContext,
): HaterResponsePlan {
  const suppression = evaluateHaterSuppression(trigger, context);
  const reasons = [...suppression.reasons];

  if (!suppression.allowed) {
    return rejectHaterPlan({
      reasons,
      suppression,
      telemetryHints: Object.freeze({ accepted: false, blocked: suppression.blockingReasons.join('|') }),
    });
  }

  const hostility = computeHaterHostility(trigger, context);
  reasons.push(`hostility:${Number(hostility.finalHostility01).toFixed(2)}`);
  reasons.push(`band:${hostility.escalationBand}`);

  if (Number(hostility.finalHostility01) < context.minimumHostilityToSpeak01) {
    reasons.push('final hostility below speaking threshold');
    return rejectHaterPlan({
      reasons,
      suppression,
      hostility,
      telemetryHints: Object.freeze({
        accepted: false,
        finalHostility01: Number(hostility.finalHostility01),
        band: hostility.escalationBand,
      }),
    });
  }

  const personaMatch = chooseHaterPersona(trigger, hostility, context);
  reasons.push(...personaMatch.reasons);

  const channelId = resolveHaterChannelId(trigger, hostility, personaMatch, context);
  reasons.push(`channel:${channelId}`);

  const tactic = chooseHaterTactic(trigger, hostility, personaMatch.persona, context);
  reasons.push(`tactic:${tactic}`);

  const artifacts = buildHaterArtifacts({
    trigger,
    hostility,
    personaMatch,
    tactic,
    channelId,
    context,
  });

  return {
    accepted: Boolean(artifacts.primaryCandidate || artifacts.scene),
    reasons: Object.freeze(reasons),
    suppression,
    hostility,
    personaMatch,
    tactic,
    channelId,
    artifacts,
    telemetryHints: Object.freeze({
      accepted: Boolean(artifacts.primaryCandidate || artifacts.scene),
      finalHostility01: Number(hostility.finalHostility01),
      escalationBand: hostility.escalationBand,
      tactic,
      channelId,
      scenePlanned: Boolean(artifacts.scene),
      personaId: personaMatch.persona.personaId,
    }),
  };
}

export function rejectHaterPlan(args: {
  readonly reasons: readonly string[];
  readonly suppression: HaterSuppressionDecision;
  readonly hostility?: Nullable<HaterHostilityVector>;
  readonly telemetryHints: Readonly<Record<string, JsonValue>>;
}): HaterResponsePlan {
  return {
    accepted: false,
    reasons: Object.freeze([...args.reasons]),
    suppression: args.suppression,
    hostility: args.hostility ?? null,
    personaMatch: null,
    tactic: null,
    channelId: null,
    artifacts: {
      scene: null,
      primaryCandidate: null,
      secondaryCandidates: Object.freeze([]),
    },
    telemetryHints: args.telemetryHints,
  };
}

// ============================================================================
// MARK: Suppression law
// ============================================================================

export function evaluateHaterSuppression(
  trigger: HaterTriggerContext,
  context: HaterResponseContext,
): HaterSuppressionDecision {
  const runtime = resolveRuntime(context);
  const reasons: string[] = [];
  const blockingReasons: string[] = [];
  const room = trigger.room;
  const now = trigger.now;
  const visibleOccupants = selectRoomPresence(trigger.state, room.roomId).filter((value) => value.visibleToRoom).length;
  const activeInvasions = getActiveRoomInvasions(trigger.state, room.roomId);
  const roomSilenced = isRoomSilenced(trigger.state, room.roomId, now);

  if (!runtime.allowVisibleChannels.includes(room.activeVisibleChannel)) {
    blockingReasons.push('active room channel disabled by runtime');
  }

  if (!chatChannelSupportsNpc(room.activeVisibleChannel)) {
    blockingReasons.push('active room channel does not support npc injection');
  }

  if (visibleOccupants <= 0 && trigger.kind !== 'ROOM_ENTRY') {
    blockingReasons.push('room has no visible occupants');
  }

  if (roomSilenced && trigger.kind !== 'POST_INVASION') {
    blockingReasons.push('room is currently silenced');
  }

  if (trigger.kind === 'PLAYER_MESSAGE') {
    reasons.push('player just spoke and may be answered');
  }

  if (trigger.signal?.battle?.rescueWindowOpen) {
    reasons.push('battle rescue window open increases volatility');
  }

  if (activeInvasions.length > 0) {
    reasons.push('active invasion present');
  }

  return {
    allowed: blockingReasons.length === 0,
    reasons: Object.freeze(reasons),
    blockingReasons: Object.freeze(blockingReasons),
    activeVisibleOccupants: visibleOccupants,
    roomSilenced,
    roomHasActiveInvasion: activeInvasions.length > 0,
  };
}

// ============================================================================
// MARK: Hostility computation
// ============================================================================

export function computeHaterHostility(
  trigger: HaterTriggerContext,
  context: HaterResponseContext,
): HaterHostilityVector {
  const room = trigger.room;
  const roomId = room.roomId;
  const state = trigger.state;
  const signal = trigger.signal ?? null;
  const battle = signal?.battle ?? null;
  const heat = selectAudienceHeat(state, roomId);
  const targetUserId = resolveTargetUserId(trigger);
  const learning = targetUserId ? selectLearningProfile(state, targetUserId) : null;
  const inference = targetUserId ? selectInferenceSnapshotsForUser(state, targetUserId).at(-1) ?? null : null;
  const relationship = targetUserId
    ? selectRelationshipForActor(state, roomId, selectDominantHaterActorId(trigger, battle), targetUserId)
    : null;
  const latestPlayerMessage = trigger.playerMessage ?? selectLatestPlayerMessage(state, roomId);

  const baseline01 = asScore01(baseHostilityForTrigger(trigger.kind));
  const battleHostility01 = asScore01(scoreBattleHostility(battle));
  const audienceHeat01 = asScore01(scoreAudienceHeat(heat));
  const relationship01 = asScore01(scoreRelationshipPressure(relationship, context));
  const learning01 = asScore01(scoreLearningPressure(learning, context));
  const inference01 = asScore01(scoreInferencePressure(inference, context));
  const transcriptMomentum01 = asScore01(scoreTranscriptMomentum(state, roomId, latestPlayerMessage));
  const roomMoodPressure01 = asScore01(scoreRoomMoodPressure(room.stageMood));
  const sovereignThreat01 = asScore01(scoreSovereignThreat(signal, context));
  const bluffExposure01 = asScore01(scoreBluffExposure(signal, latestPlayerMessage, context));

  const weighted =
    Number(baseline01) * 0.14 +
    Number(battleHostility01) * 0.20 +
    Number(audienceHeat01) * 0.16 +
    Number(relationship01) * 0.12 +
    Number(learning01) * 0.12 +
    Number(inference01) * 0.10 +
    Number(transcriptMomentum01) * 0.08 +
    Number(roomMoodPressure01) * 0.04 +
    Number(sovereignThreat01) * 0.02 +
    Number(bluffExposure01) * 0.02;

  const preferredAttackType = derivePreferredAttackType({
    trigger,
    battle,
    audienceHeat01,
    sovereignThreat01,
    bluffExposure01,
    learning,
    latestPlayerMessage,
  });

  const finalHostility01 = asScore01(weighted);

  return {
    roomId,
    baseline01,
    battleHostility01,
    audienceHeat01,
    relationship01,
    learning01,
    inference01,
    transcriptMomentum01,
    roomMoodPressure01,
    sovereignThreat01,
    bluffExposure01,
    finalHostility01,
    preferredAttackType,
    escalationBand: deriveEscalationBand(finalHostility01, signal, room.stageMood),
  };
}

// ============================================================================
// MARK: Persona selection
// ============================================================================

export function chooseHaterPersona(
  trigger: HaterTriggerContext,
  hostility: HaterHostilityVector,
  context: HaterResponseContext,
): HaterPersonaMatch {
  const matches = Object.values(HATER_PERSONAS).map((persona) => scorePersonaMatch(persona, trigger, hostility, context));
  matches.sort((a, b) => Number(b.score01) - Number(a.score01));
  return matches[0] ?? impossiblePersonaMatch();
}

export function scorePersonaMatch(
  persona: HaterPersonaProfile,
  trigger: HaterTriggerContext,
  hostility: HaterHostilityVector,
  _context: HaterResponseContext,
): HaterPersonaMatch {
  const reasons: string[] = [];
  let score = persona.baselineBias01 * 0.20;

  if (hostility.preferredAttackType && persona.anchorAttackTypes.includes(hostility.preferredAttackType)) {
    score += 0.24;
    reasons.push(`anchors attack:${hostility.preferredAttackType}`);
  }

  if (persona.anchorRoomKinds.includes(trigger.room.roomKind)) {
    score += 0.18;
    reasons.push(`anchors room:${trigger.room.roomKind}`);
  }

  if (persona.anchorMoods.includes(trigger.room.stageMood)) {
    score += 0.14;
    reasons.push(`anchors mood:${trigger.room.stageMood}`);
  }

  if (Number(hostility.audienceHeat01) >= 0.68) {
    score += persona.crowdBias01 * 0.14;
    reasons.push('crowd pressure fit');
  }

  if (Number(hostility.relationship01) >= 0.45) {
    score += persona.relationshipBias01 * 0.16;
    reasons.push('relationship pressure fit');
  }

  if (hostility.escalationBand === 'CEREMONIAL_EXECUTION' && persona.favoredTactics.includes('PUBLIC_EXECUTION')) {
    score += 0.12;
    reasons.push('public execution fit');
  }

  if (trigger.kind === 'ECONOMY_SIGNAL' && persona.favoredTactics.includes('DEALROOM_THREAT')) {
    score += 0.10;
    reasons.push('economy/deal room fit');
  }

  return {
    persona,
    score01: asScore01(score),
    reasons: Object.freeze(reasons),
  };
}

// ============================================================================
// MARK: Tactic and channel selection
// ============================================================================

export function chooseHaterTactic(
  trigger: HaterTriggerContext,
  hostility: HaterHostilityVector,
  persona: HaterPersonaProfile,
  context: HaterResponseContext,
): HaterTactic {
  const playerMessage = trigger.playerMessage ?? selectLatestPlayerMessage(trigger.state, trigger.room.roomId);
  const signal = trigger.signal ?? null;

  if (hostility.preferredAttackType === 'LIQUIDATION') {
    return Number(hostility.sovereignThreat01) >= context.sovereignPunishThreshold01
      ? 'SOVEREIGNTY_DENIAL'
      : 'SHIELD_FUNERAL';
  }

  if (hostility.preferredAttackType === 'COMPLIANCE') {
    return 'BLUFF_EXPOSURE';
  }

  if (hostility.preferredAttackType === 'CROWD_SWARM' || Number(hostility.audienceHeat01) >= context.minimumCrowdHeatForGlobalLeak01) {
    return hostility.escalationBand === 'CEREMONIAL_EXECUTION'
      ? 'PUBLIC_EXECUTION'
      : 'CROWD_SUMMON';
  }

  if (signal?.economy && Number(hostility.bluffExposure01) >= context.bluffPunishThreshold01) {
    return 'DEALROOM_THREAT';
  }

  if (playerMessage && isBoastLikeMessage(playerMessage)) {
    return 'PUNISH_OVERCONFIDENCE';
  }

  if (playerMessage && isSilentBreakTrigger(trigger, playerMessage)) {
    return 'PREDATORY_SILENCE_BREAK';
  }

  if (persona.favoredTactics.includes('PUNCTURE_CONFIDENCE')) {
    return 'PUNCTURE_CONFIDENCE';
  }

  return 'TAUNT';
}

export function resolveHaterChannelId(
  trigger: HaterTriggerContext,
  hostility: HaterHostilityVector,
  personaMatch: HaterPersonaMatch,
  context: HaterResponseContext,
): ChatChannelId {
  const preferred = trigger.preferredChannelId;
  if (preferred && personaMatch.persona.preferredChannels.includes(preferred)) {
    return preferred;
  }

  const activeInvasion = getActiveRoomInvasions(trigger.state, trigger.room.roomId)[0] ?? null;
  if (activeInvasion) {
    return activeInvasion.channelId;
  }

  if (Number(hostility.audienceHeat01) >= context.minimumCrowdHeatForGlobalLeak01 &&
      context.allowCrowdLeakScenes &&
      personaMatch.persona.preferredChannels.includes('GLOBAL')) {
    return 'GLOBAL';
  }

  if (trigger.room.roomKind === 'DEAL_ROOM' && personaMatch.persona.preferredChannels.includes('DEAL_ROOM')) {
    return 'DEAL_ROOM';
  }

  if (trigger.room.roomKind === 'SYNDICATE' && personaMatch.persona.preferredChannels.includes('SYNDICATE')) {
    return 'SYNDICATE';
  }

  if (personaMatch.persona.preferredChannels.includes(trigger.room.activeVisibleChannel)) {
    return trigger.room.activeVisibleChannel;
  }

  return context.defaultVisibleChannel;
}

// ============================================================================
// MARK: Artifact creation
// ============================================================================

export function buildHaterArtifacts(args: {
  readonly trigger: HaterTriggerContext;
  readonly hostility: HaterHostilityVector;
  readonly personaMatch: HaterPersonaMatch;
  readonly tactic: HaterTactic;
  readonly channelId: ChatChannelId;
  readonly context: HaterResponseContext;
}): HaterSceneArtifacts {
  const { trigger, hostility, personaMatch, tactic, channelId, context } = args;
  const primaryText = composeHaterLine({
    trigger,
    hostility,
    persona: personaMatch.persona,
    tactic,
    context,
    variantIndex: 0,
  });

  const primaryCandidate = createCandidate({
    trigger,
    persona: personaMatch.persona,
    channelId,
    text: primaryText,
    tactic,
    priority: resolvePriority(hostility),
    delayMs: resolvePrimaryDelayMs(personaMatch.persona, hostility, tactic),
  });

  const secondaryCandidates = context.allowSecondStrikeScenes
    ? createSecondaryCandidates({
        trigger,
        hostility,
        persona: personaMatch.persona,
        channelId,
        context,
      })
    : Object.freeze([]) as readonly ChatResponseCandidate[];

  const scene = context.allowCinematicScenes && shouldEmitScene(hostility, tactic, secondaryCandidates)
    ? createScenePlan({
        trigger,
        persona: personaMatch.persona,
        hostility,
        label: sceneLabelForTactic(tactic),
        primaryCandidate,
        secondaryCandidates,
        context,
      })
    : null;

  return {
    scene,
    primaryCandidate,
    secondaryCandidates,
  };
}

export function createSecondaryCandidates(args: {
  readonly trigger: HaterTriggerContext;
  readonly hostility: HaterHostilityVector;
  readonly persona: HaterPersonaProfile;
  readonly channelId: ChatChannelId;
  readonly context: HaterResponseContext;
}): readonly ChatResponseCandidate[] {
  const { trigger, hostility, persona, channelId, context } = args;
  const candidates: ChatResponseCandidate[] = [];

  if (hostility.escalationBand === 'HARD' || hostility.escalationBand === 'RUTHLESS' || hostility.escalationBand === 'CEREMONIAL_EXECUTION') {
    const secondStrikeText = chooseLine(persona.secondStrikeLines, context.random);
    candidates.push(createCandidate({
      trigger,
      persona,
      channelId,
      text: secondStrikeText,
      tactic: 'TAUNT',
      priority: Math.max(1, resolvePriority(hostility) - 8),
      delayMs: resolveSecondStrikeDelayMs(persona, hostility),
    }));
  }

  if (context.allowCrowdLeakScenes &&
      Number(hostility.audienceHeat01) >= context.minimumCrowdHeatForGlobalLeak01 &&
      persona.preferredChannels.includes('GLOBAL')) {
    const leakText = chooseLine(persona.leakLines, context.random);
    candidates.push(createCandidate({
      trigger,
      persona,
      channelId: 'GLOBAL',
      text: leakText,
      tactic: 'CROWD_SUMMON',
      priority: Math.max(1, resolvePriority(hostility) - 12),
      delayMs: resolveLeakDelayMs(persona, hostility),
    }));
  }

  return Object.freeze(candidates);
}

export function createScenePlan(args: {
  readonly trigger: HaterTriggerContext;
  readonly persona: HaterPersonaProfile;
  readonly hostility: HaterHostilityVector;
  readonly label: string;
  readonly primaryCandidate: ChatResponseCandidate;
  readonly secondaryCandidates: readonly ChatResponseCandidate[];
  readonly context: HaterResponseContext;
}): ChatScenePlan {
  return {
    sceneId: args.context.ids.sceneId('hater_scene'),
    roomId: args.trigger.room.roomId,
    label: args.label,
    openedAt: args.trigger.now,
    messages: Object.freeze([args.primaryCandidate, ...args.secondaryCandidates]),
    silence: null,
    legendCandidate: args.hostility.escalationBand === 'CEREMONIAL_EXECUTION',
  };
}

// ============================================================================
// MARK: Message composition
// ============================================================================

export function composeHaterLine(args: {
  readonly trigger: HaterTriggerContext;
  readonly hostility: HaterHostilityVector;
  readonly persona: HaterPersonaProfile;
  readonly tactic: HaterTactic;
  readonly context: HaterResponseContext;
  readonly variantIndex: number;
}): string {
  const { trigger, hostility, persona, tactic, context } = args;
  const latestPlayerMessage = trigger.playerMessage ?? selectLatestPlayerMessage(trigger.state, trigger.room.roomId);
  const template = chooseLine(persona.lines[tactic], context.random);
  const replacements = buildTemplateReplacements({
    trigger,
    hostility,
    persona,
    latestPlayerMessage,
  });
  let text = applyTemplate(template, replacements);

  if (persona.voiceprint.opener && shouldAddOpener(hostility, tactic)) {
    text = `${persona.voiceprint.opener} ${text}`;
  }

  if (persona.voiceprint.closer && shouldAddCloser(hostility, tactic)) {
    text = `${text} ${persona.voiceprint.closer}`;
  }

  return normalizeOutboundText(text);
}

export function buildTemplateReplacements(args: {
  readonly trigger: HaterTriggerContext;
  readonly hostility: HaterHostilityVector;
  readonly persona: HaterPersonaProfile;
  readonly latestPlayerMessage: Nullable<ChatMessage>;
}): Readonly<Record<string, string>> {
  const { trigger, hostility, latestPlayerMessage } = args;
  const quote = latestPlayerMessage ? summarizePlayerText(latestPlayerMessage.plainText) : 'that';
  const roomName = trigger.room.title;
  const attack = hostility.preferredAttackType ?? 'TAUNT';

  return Object.freeze({
    '{{ROOM}}': roomName,
    '{{QUOTE}}': quote,
    '{{ATTACK}}': attack,
    '{{CHANNEL}}': trigger.room.activeVisibleChannel,
    '{{BAND}}': hostility.escalationBand,
  });
}

export function applyTemplate(
  template: string,
  replacements: Readonly<Record<string, string>>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.split(key).join(value);
  }
  return result;
}

// ============================================================================
// MARK: Candidate builders
// ============================================================================

export function createCandidate(args: {
  readonly trigger: HaterTriggerContext;
  readonly persona: HaterPersonaProfile;
  readonly channelId: ChatChannelId;
  readonly text: string;
  readonly tactic: HaterTactic;
  readonly priority: number;
  readonly delayMs: number;
}): ChatResponseCandidate {
  return {
    personaId: args.persona.personaId,
    roomId: args.trigger.room.roomId,
    channelId: args.channelId,
    priority: args.priority,
    text: args.text,
    tags: Object.freeze([
      'npc',
      'hater',
      `tactic:${args.tactic}`,
      `trigger:${args.trigger.kind}`,
      `room:${args.trigger.room.roomKind}`,
    ]),
    delayMs: Math.max(0, Math.floor(args.delayMs)),
    moderationBypassAllowed: false,
    causeEventId: args.trigger.causeEventId,
  };
}

// ============================================================================
// MARK: Scoring helpers
// ============================================================================

export function baseHostilityForTrigger(kind: HaterTriggerKind): number {
  switch (kind) {
    case 'PLAYER_MESSAGE':
      return 0.38;
    case 'BATTLE_SIGNAL':
      return 0.54;
    case 'RUN_SIGNAL':
      return 0.34;
    case 'ECONOMY_SIGNAL':
      return 0.46;
    case 'LIVEOPS_SIGNAL':
      return 0.58;
    case 'POST_HELPER':
      return 0.52;
    case 'POST_INVASION':
      return 0.48;
    case 'ROOM_ENTRY':
      return 0.24;
    case 'AMBIENT_MAINTENANCE':
    default:
      return 0.18;
  }
}

export function scoreBattleHostility(battle: Nullable<ChatBattleSnapshot>): number {
  if (!battle) {
    return 0.0;
  }

  let score = Number(battle.hostileMomentum) / 100;
  score += (1 - Number(battle.shieldIntegrity01)) * 0.30;
  if (battle.activeAttackType === 'CROWD_SWARM') {
    score += 0.12;
  }
  if (battle.activeAttackType === 'LIQUIDATION') {
    score += 0.18;
  }
  if (battle.rescueWindowOpen) {
    score += 0.08;
  }
  return Math.min(1, score);
}

export function scoreAudienceHeat(heat: Nullable<ChatAudienceHeat>): number {
  return heat ? Number(heat.heat01) : 0;
}

export function scoreRelationshipPressure(
  relationship: ReturnType<typeof selectRelationshipForActor>,
  context: HaterResponseContext,
): number {
  if (!relationship) {
    return 0;
  }
  const weighted = (
    Number(relationship.rivalry01) * 0.45 +
    Number(relationship.contempt01) * 0.25 +
    Number(relationship.fear01) * 0.15 +
    Number(relationship.fascination01) * 0.15
  ) * context.relationshipWeight01;
  return Math.min(1, weighted);
}

export function scoreLearningPressure(
  learning: Nullable<ChatLearningProfile>,
  context: HaterResponseContext,
): number {
  if (!learning) {
    return 0.14 * context.learningWeight01;
  }
  const weighted = (
    Number(learning.haterSusceptibility01) * 0.42 +
    Number(learning.churnRisk01) * 0.18 +
    Number(learning.affect.intimidation01) * 0.18 +
    Number(learning.affect.frustration01) * 0.12 +
    Number(learning.affect.embarrassment01) * 0.10
  ) * context.learningWeight01;
  return Math.min(1, weighted);
}

export function scoreInferencePressure(
  inference: Nullable<ChatInferenceSnapshot>,
  context: HaterResponseContext,
): number {
  if (!inference) {
    return 0;
  }
  const weighted = (
    Number(inference.haterTargeting01) * 0.50 +
    Number(inference.churnRisk01) * 0.25 +
    (1 - Number(inference.engagement01)) * 0.10 +
    Number(inference.toxicityRisk01) * 0.15
  ) * context.inferenceWeight01;
  return Math.min(1, weighted);
}

export function scoreTranscriptMomentum(
  state: ChatState,
  roomId: ChatRoomId,
  latestPlayerMessage: Nullable<ChatMessage>,
): number {
  const visible = selectVisibleMessages(state, roomId);
  const lastSix = visible.slice(-6);
  if (lastSix.length === 0) {
    return 0.12;
  }

  let score = 0;
  for (const message of lastSix) {
    if (message.attribution.sourceType === 'PLAYER') {
      score += isBoastLikeText(message.plainText) ? 0.15 : 0.04;
      score += isPanicLikeText(message.plainText) ? 0.12 : 0;
    }
    if (message.attribution.npcRole === 'HATER') {
      score += 0.10;
    }
  }

  if (latestPlayerMessage && isBoastLikeMessage(latestPlayerMessage)) {
    score += 0.18;
  }
  return Math.min(1, score);
}

export function scoreRoomMoodPressure(mood: ChatRoomStageMood): number {
  switch (mood) {
    case 'HOSTILE':
      return 0.82;
    case 'PREDATORY':
      return 0.88;
    case 'TENSE':
      return 0.58;
    case 'CEREMONIAL':
      return 0.66;
    case 'ECSTATIC':
      return 0.54;
    case 'MOURNFUL':
      return 0.28;
    case 'CALM':
    default:
      return 0.12;
  }
}

export function scoreSovereignThreat(
  signal: Nullable<ChatSignalEnvelope>,
  context: HaterResponseContext,
): number {
  const nearSovereignty = signal?.run?.nearSovereignty ?? false;
  if (!nearSovereignty) {
    return 0;
  }
  return context.sovereignPunishThreshold01;
}

export function scoreBluffExposure(
  signal: Nullable<ChatSignalEnvelope>,
  latestPlayerMessage: Nullable<ChatMessage>,
  context: HaterResponseContext,
): number {
  const bluff = signal?.economy?.bluffRisk01 != null ? Number(signal.economy.bluffRisk01) : 0;
  const textPressure = latestPlayerMessage && isBluffLikeMessage(latestPlayerMessage) ? 0.16 : 0;
  return Math.min(1, bluff + textPressure + context.bluffPunishThreshold01 * 0.08);
}

export function derivePreferredAttackType(args: {
  readonly trigger: HaterTriggerContext;
  readonly battle: Nullable<ChatBattleSnapshot>;
  readonly audienceHeat01: Score01;
  readonly sovereignThreat01: Score01;
  readonly bluffExposure01: Score01;
  readonly learning: Nullable<ChatLearningProfile>;
  readonly latestPlayerMessage: Nullable<ChatMessage>;
}): Nullable<AttackType> {
  if (args.battle?.activeAttackType) {
    return args.battle.activeAttackType;
  }

  if (Number(args.sovereignThreat01) >= 0.70) {
    return 'LIQUIDATION';
  }

  if (Number(args.bluffExposure01) >= 0.60) {
    return 'COMPLIANCE';
  }

  if (Number(args.audienceHeat01) >= 0.72) {
    return 'CROWD_SWARM';
  }

  if (args.latestPlayerMessage && isBluffLikeMessage(args.latestPlayerMessage)) {
    return 'SHADOW_LEAK';
  }

  if (args.learning && Number(args.learning.affect.frustration01) >= 0.70) {
    return 'SABOTAGE';
  }

  return 'TAUNT';
}

export function deriveEscalationBand(
  finalHostility01: Score01,
  signal: Nullable<ChatSignalEnvelope>,
  mood: ChatRoomStageMood,
): HaterEscalationBand {
  const value = Number(finalHostility01);
  if (value < 0.18) {
    return 'NONE';
  }
  if (value < 0.36) {
    return 'PROBING';
  }
  if (value < 0.56) {
    return 'PRESSURE';
  }
  if (value < 0.74) {
    return 'HARD';
  }
  if (value < 0.88) {
    return 'RUTHLESS';
  }
  if (signal?.run?.nearSovereignty || mood === 'CEREMONIAL') {
    return 'CEREMONIAL_EXECUTION';
  }
  return 'RUTHLESS';
}

// ============================================================================
// MARK: Delay, priority, and scene law
// ============================================================================

export function resolvePriority(hostility: HaterHostilityVector): number {
  switch (hostility.escalationBand) {
    case 'CEREMONIAL_EXECUTION':
      return 96;
    case 'RUTHLESS':
      return 84;
    case 'HARD':
      return 72;
    case 'PRESSURE':
      return 58;
    case 'PROBING':
      return 42;
    case 'NONE':
    default:
      return 20;
  }
}

export function resolvePrimaryDelayMs(
  persona: HaterPersonaProfile,
  hostility: HaterHostilityVector,
  tactic: HaterTactic,
): number {
  const floor = persona.voiceprint.delayFloorMs;
  const ceiling = persona.voiceprint.delayCeilingMs;
  const intensity = Number(hostility.finalHostility01);
  const urgencyBias = tactic === 'PUBLIC_EXECUTION' || tactic === 'SHIELD_FUNERAL' ? 0.22 : 0;
  const ratio = Math.max(0, Math.min(1, 1 - intensity + urgencyBias));
  return Math.floor(floor + (ceiling - floor) * ratio);
}

export function resolveSecondStrikeDelayMs(
  persona: HaterPersonaProfile,
  hostility: HaterHostilityVector,
): number {
  return Math.floor(resolvePrimaryDelayMs(persona, hostility, 'TAUNT') + 950 + Number(hostility.audienceHeat01) * 400);
}

export function resolveLeakDelayMs(
  persona: HaterPersonaProfile,
  hostility: HaterHostilityVector,
): number {
  return Math.floor(resolvePrimaryDelayMs(persona, hostility, 'CROWD_SUMMON') + 450);
}

export function shouldEmitScene(
  hostility: HaterHostilityVector,
  tactic: HaterTactic,
  secondaryCandidates: readonly ChatResponseCandidate[],
): boolean {
  if (secondaryCandidates.length === 0) {
    return false;
  }
  if (tactic === 'PUBLIC_EXECUTION' || tactic === 'CROWD_SUMMON') {
    return true;
  }
  return hostility.escalationBand === 'RUTHLESS' || hostility.escalationBand === 'CEREMONIAL_EXECUTION';
}

export function sceneLabelForTactic(tactic: HaterTactic): string {
  switch (tactic) {
    case 'PUBLIC_EXECUTION':
      return 'HATER_PUBLIC_EXECUTION';
    case 'CROWD_SUMMON':
      return 'HATER_CROWD_SUMMON';
    case 'SHIELD_FUNERAL':
      return 'HATER_SHIELD_FUNERAL';
    case 'SOVEREIGNTY_DENIAL':
      return 'HATER_SOVEREIGNTY_DENIAL';
    case 'DEALROOM_THREAT':
      return 'HATER_DEALROOM_THREAT';
    default:
      return 'HATER_STRIKE';
  }
}

// ============================================================================
// MARK: Text heuristics
// ============================================================================

export function selectLatestPlayerMessage(state: ChatState, roomId: ChatRoomId): Nullable<ChatMessage> {
  const messages = selectVisibleMessages(state, roomId);
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.attribution.sourceType === 'PLAYER') {
      return message;
    }
  }
  return null;
}

export function resolveTargetUserId(trigger: HaterTriggerContext): Nullable<ChatLearningProfile['userId']> {
  if (trigger.playerMessage?.attribution.authorUserId) {
    return trigger.playerMessage.attribution.authorUserId;
  }
  const latestPlayer = selectLatestPlayerMessage(trigger.state, trigger.room.roomId);
  return latestPlayer?.attribution.authorUserId ?? null;
}

export function selectDominantHaterActorId(
  trigger: HaterTriggerContext,
  battle: Nullable<ChatBattleSnapshot>,
): string {
  switch (battle?.activeBotId) {
    case 'BOT_01':
      return HATER_PERSONAS.liquidator.actorId;
    case 'BOT_02':
      return HATER_PERSONAS.compliance.actorId;
    case 'BOT_03':
      return HATER_PERSONAS.butcher.actorId;
    case 'BOT_04':
      return HATER_PERSONAS.whisper.actorId;
    default:
      return trigger.kind === 'ECONOMY_SIGNAL'
        ? HATER_PERSONAS.compliance.actorId
        : HATER_PERSONAS.liquidator.actorId;
  }
}

export function isBoastLikeMessage(message: ChatMessage): boolean {
  return isBoastLikeText(message.plainText);
}

export function isBoastLikeText(text: string): boolean {
  const normalized = text.toLowerCase();
  return /(i got this|too easy|easy|light work|i win|i'm fine|im fine|untouchable|dominating)/.test(normalized);
}

export function isPanicLikeText(text: string): boolean {
  const normalized = text.toLowerCase();
  return /(help|wait|hold on|i'm cooked|im cooked|bad|uh oh|can't|cannot|stuck|panic)/.test(normalized);
}

export function isBluffLikeMessage(message: ChatMessage): boolean {
  const normalized = message.plainText.toLowerCase();
  return /(best offer|final offer|take it now|last chance|i don't need this|i dont need this|all in)/.test(normalized);
}

export function isSilentBreakTrigger(
  trigger: HaterTriggerContext,
  message: ChatMessage,
): boolean {
  if (trigger.kind === 'AMBIENT_MAINTENANCE') {
    return true;
  }
  return message.plainText.trim().length <= 2 || /^\.\.\.?$/.test(message.plainText.trim());
}

export function summarizePlayerText(text: string): string {
  const normalized = normalizeOutboundText(text);
  return normalized.length > 42 ? `${normalized.slice(0, 39)}...` : normalized;
}

export function normalizeOutboundText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

// ============================================================================
// MARK: Utility helpers
// ============================================================================

export function resolveRuntime(context: HaterResponseContext) {
  return mergeRuntimeConfig(
    context.runtimeOverride ?? {},
    context.runtimeOptions,
  );
}

export function chatChannelSupportsNpc(channelId: ChatChannelId): boolean {
  return channelId !== 'SYSTEM_SHADOW' || true;
}

export function chooseLine(lines: readonly string[], random: HaterResponseRandomPort): string {
  if (lines.length === 0) {
    return '...';
  }
  const index = Math.floor(random.next() * lines.length) % lines.length;
  return lines[index] ?? lines[0] ?? '...';
}

export function shouldAddOpener(hostility: HaterHostilityVector, tactic: HaterTactic): boolean {
  return tactic === 'PUBLIC_EXECUTION' || Number(hostility.finalHostility01) >= 0.62;
}

export function shouldAddCloser(hostility: HaterHostilityVector, tactic: HaterTactic): boolean {
  return tactic === 'PREDATORY_SILENCE_BREAK' || tactic === 'DEALROOM_THREAT' || Number(hostility.relationship01) >= 0.52;
}

export function createPersonaProfile(profile: HaterPersonaProfile): HaterPersonaProfile {
  return Object.freeze(profile);
}

export function impossiblePersonaMatch(): HaterPersonaMatch {
  return {
    persona: HATER_PERSONAS.liquidator,
    score01: asScore01(0),
    reasons: Object.freeze(['fallback persona']),
  };
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
// MARK: Exported diagnostic helpers
// ============================================================================

export function describeHostilityVector(hostility: HaterHostilityVector): string {
  return [
    `baseline=${Number(hostility.baseline01).toFixed(2)}`,
    `battle=${Number(hostility.battleHostility01).toFixed(2)}`,
    `heat=${Number(hostility.audienceHeat01).toFixed(2)}`,
    `relationship=${Number(hostility.relationship01).toFixed(2)}`,
    `learning=${Number(hostility.learning01).toFixed(2)}`,
    `inference=${Number(hostility.inference01).toFixed(2)}`,
    `transcript=${Number(hostility.transcriptMomentum01).toFixed(2)}`,
    `mood=${Number(hostility.roomMoodPressure01).toFixed(2)}`,
    `sovereign=${Number(hostility.sovereignThreat01).toFixed(2)}`,
    `bluff=${Number(hostility.bluffExposure01).toFixed(2)}`,
    `final=${Number(hostility.finalHostility01).toFixed(2)}`,
    `band=${hostility.escalationBand}`,
  ].join(' | ');
}

export function describeHaterPlan(plan: HaterResponsePlan): string {
  if (!plan.accepted || !plan.hostility || !plan.personaMatch || !plan.tactic) {
    return `rejected :: ${plan.reasons.join('; ')}`;
  }
  return [
    `accepted`,
    `persona=${plan.personaMatch.persona.displayName}`,
    `channel=${plan.channelId}`,
    `tactic=${plan.tactic}`,
    describeHostilityVector(plan.hostility),
  ].join(' :: ');
}
