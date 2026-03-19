/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ATTACK TELEGRAPH ENGINE
 * FILE: pzo-web/src/engines/chat/combat/ChatAttackTelegraph.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Computes the authored warning layer that sits between raw hostile pressure
 * and a fully opened conversational boss fight.
 *
 * This module is the frontend pre-resolution intelligence lane for language as
 * attack. It does not replace the controller. It gives the controller a richer,
 * repo-shaped read of what is forming in the room:
 *
 * - what kind of social attack is coming,
 * - how severe it is,
 * - whether the room or deal surface should witness it,
 * - whether timed silence sharpens the threat,
 * - what counter intents should be offered,
 * - what UI surfaces should light up,
 * - and whether the signal is only a telegraph or should escalate into a full
 *   conversational boss fight.
 *
 * Architectural doctrine
 * ----------------------
 * - frontend chat lane owns anticipation, staging, readability, and immediate
 *   player-facing clarity;
 * - backend chat/battle lane will later own authoritative resolution;
 * - this file remains deterministic, serializable, and side-effect free except
 *   for the creation of local preview transcript messages and reveal payloads;
 * - this file must honor the repo's current runtime patterns: channels,
 *   moments, scenes, reveal schedules, helper timing, crowd timing, proof
 *   visibility, and the existing ChatBotResponseDirector voice lane.
 *
 * Core law
 * --------
 * A telegraph is not flavor text. It is the readable geometry of an incoming
 * attack.
 *
 * Premium behaviors in this file
 * ------------------------------
 * - threat radar scoring for public embarrassment, proof exposure, rescue need,
 *   leverage danger, and likely dominance swing;
 * - authored telegraph copy that still routes through your live bot persona
 *   corpus when possible;
 * - counterplay modal view models shaped by channel, pressure, and witness risk;
 * - moment-flash payloads for cinematic warning beats;
 * - reveal schedules for delayed telegraph, crowd murmur, helper whisper, and
 *   rescue intercept cues;
 * - explicit escalation decisions so callers can choose between:
 *   stage-only, wait-for-second-signal, open-boss-fight, or drop;
 * - transcript-safe preview messages that reuse existing ChatState-compatible
 *   message fields instead of inventing a parallel message grammar.
 * ============================================================================
 */

import type { BotId } from '../../battle/types';
import { buildLocalSystemMessage } from '../ChatState';
import {
  createChatBotResponseDirector,
  type BotLineCategory,
  type PersonaPressureBand,
} from '../ChatBotResponseDirector';
import type {
  ChatActorKind,
  ChatAffectSnapshot,
  ChatAudienceHeat,
  ChatChannelMood,
  ChatCounterplayWindow,
  ChatEngineState,
  ChatMessage,
  ChatMessageId,
  ChatMessageKind,
  ChatMomentId,
  ChatRelationshipState,
  ChatRevealSchedule,
  ChatSceneId,
  ChatVisibleChannel,
  PressureTier,
  Score100,
  TickTier,
  UnixMs,
} from '../types';

// ============================================================================
// MARK: Public contracts
// ============================================================================

export type ChatAttackTelegraphFamily =
  | 'MARGIN_SNAP'
  | 'QUOTE_TRAP'
  | 'DEADLINE_PIN'
  | 'CROWD_BAIT'
  | 'DEAL_ROOM_SQUEEZE'
  | 'FALSE_MERCY'
  | 'HELPER_DENIAL'
  | 'SILENCE_LURE'
  | 'SHIELD_SHATTER'
  | 'REPUTATION_STRIKE'
  | 'BLUFF_EXTRACTION'
  | 'FINAL_WORD_DUEL';

export type ChatAttackTelegraphSeverity = 'WATCH' | 'HOT' | 'SEVERE' | 'EXECUTION';

export type ChatAttackTelegraphTimingClass =
  | 'INSTANT'
  | 'READ_DELAYED'
  | 'SILENCE_PRIMED'
  | 'CROWD_STAGGERED'
  | 'HELPER_STAGGERED';

export type ChatAttackTelegraphDecision =
  | 'DROP_SIGNAL'
  | 'STAGE_ONLY'
  | 'WAIT_FOR_SECOND_SIGNAL'
  | 'OPEN_COUNTER_WINDOW'
  | 'OPEN_BOSS_FIGHT';

export type ChatAttackTelegraphSurface =
  | 'COUNTERPLAY_MODAL'
  | 'THREAT_RADAR_PANEL'
  | 'MOMENT_FLASH'
  | 'PROOF_CARD'
  | 'RESCUE_WINDOW_BANNER'
  | 'SABOTAGE_IMPACT_PANEL'
  | 'THREAT_BADGE';

export type ChatAttackTelegraphIntent =
  | 'ASSERT'
  | 'STABILIZE'
  | 'DEFLECT'
  | 'REVERSE'
  | 'CALL_BLUFF'
  | 'WITHDRAW'
  | 'SILENT_HOLD'
  | 'PROTECT_DIGNITY';

export type ChatAttackTelegraphCueKind =
  | 'SYSTEM_NOTICE'
  | 'PRIMARY_TELEGRAPH'
  | 'AMBIENT_CROWD'
  | 'HELPER_WHISPER'
  | 'READ_PRESSURE'
  | 'MOMENT_FLASH'
  | 'PROOF_EXPOSURE'
  | 'RESCUE_INTERCEPT';

export interface ChatAttackTelegraphSignal {
  readonly channel?: ChatVisibleChannel;
  readonly botId: BotId;
  readonly reason: string;
  readonly bodyHint?: string;
  readonly sourceMessageId?: string;
  readonly sourceMomentId?: ChatMomentId;
  readonly sourceSceneId?: ChatSceneId;
  readonly pressureTier?: PressureTier;
  readonly tickTier?: TickTier;
  readonly proofHash?: string;
  readonly quoteAnchor?: string;
  readonly forcePublic?: boolean;
  readonly forceRescue?: boolean;
  readonly forceDecision?: ChatAttackTelegraphDecision;
  readonly tags?: readonly string[];
}

export interface ChatAttackTelegraphInput {
  readonly state?: Pick<
    ChatEngineState,
    | 'activeVisibleChannel'
    | 'messagesByChannel'
    | 'audienceHeat'
    | 'channelMoodByChannel'
    | 'relationshipsByCounterpartId'
    | 'affect'
    | 'currentSilence'
  >;
  readonly signal: ChatAttackTelegraphSignal;
  readonly now?: UnixMs;
}

export interface ChatAttackTelegraphVector {
  readonly dominanceSwing: Score100;
  readonly embarrassmentRisk: Score100;
  readonly leverageDanger: Score100;
  readonly proofExposure: Score100;
  readonly rescueNeed: Score100;
  readonly spectacleRisk: Score100;
  readonly bluffProbability: Score100;
  readonly silenceValue: Score100;
}

export interface ChatAttackTelegraphNeedle {
  readonly key:
    | 'dominance'
    | 'embarrassment'
    | 'leverage'
    | 'proof'
    | 'rescue'
    | 'spectacle'
    | 'bluff'
    | 'silence';
  readonly label: string;
  readonly value: Score100;
  readonly band: 'LOW' | 'ELEVATED' | 'HIGH' | 'MAX';
  readonly explanation: string;
}

export interface ChatAttackTelegraphCounterOption {
  readonly intent: ChatAttackTelegraphIntent;
  readonly label: string;
  readonly prompt: string;
  readonly why: string;
  readonly risk: Score100;
  readonly reward: Score100;
  readonly recommended: boolean;
  readonly tags: readonly string[];
}

export interface ChatAttackTelegraphThreatRadarModel {
  readonly title: string;
  readonly subtitle: string;
  readonly severity: ChatAttackTelegraphSeverity;
  readonly family: ChatAttackTelegraphFamily;
  readonly primaryColorToken: 'danger' | 'warning' | 'heat' | 'quiet';
  readonly needles: readonly ChatAttackTelegraphNeedle[];
  readonly headline: string;
  readonly footer: string;
}

export interface ChatAttackTelegraphCounterplayModalModel {
  readonly title: string;
  readonly subtitle: string;
  readonly timerMs: number;
  readonly threatSummary: string;
  readonly openingLine: string;
  readonly recommendedOptions: readonly ChatAttackTelegraphCounterOption[];
  readonly avoidMoves: readonly string[];
  readonly witnessMode: 'PRIVATE' | 'ROOM' | 'CROWD' | 'DEAL_ROOM';
}

export interface ChatAttackTelegraphMomentFlashModel {
  readonly title: string;
  readonly subtitle: string;
  readonly emphasis: 'warning' | 'danger' | 'critical';
  readonly family: ChatAttackTelegraphFamily;
  readonly severity: ChatAttackTelegraphSeverity;
  readonly actorName: string;
}

export interface ChatAttackTelegraphProofCardModel {
  readonly visible: boolean;
  readonly title: string;
  readonly proofHash?: string;
  readonly quoteAnchor?: string;
  readonly exposureRisk: Score100;
  readonly note: string;
}

export interface ChatAttackTelegraphRescueBannerModel {
  readonly visible: boolean;
  readonly title: string;
  readonly body: string;
  readonly urgency: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ChatAttackTelegraphPresenceBeat {
  readonly cue: ChatAttackTelegraphCueKind;
  readonly actorId: string;
  readonly actorName: string;
  readonly actorKind: ChatActorKind;
  readonly delayMs: number;
  readonly typingMs?: number;
  readonly readDelayMs?: number;
  readonly note: string;
}

export interface ChatAttackTelegraphCue {
  readonly cueKind: ChatAttackTelegraphCueKind;
  readonly channel: ChatVisibleChannel;
  readonly when: UnixMs;
  readonly message?: ChatMessage;
  readonly reveal?: ChatRevealSchedule;
  readonly surface?: ChatAttackTelegraphSurface;
  readonly note: string;
}

export interface ChatAttackTelegraphPlan {
  readonly telegraphId: string;
  readonly sceneId: ChatSceneId;
  readonly momentId: ChatMomentId;
  readonly channel: ChatVisibleChannel;
  readonly botId: BotId;
  readonly family: ChatAttackTelegraphFamily;
  readonly severity: ChatAttackTelegraphSeverity;
  readonly timingClass: ChatAttackTelegraphTimingClass;
  readonly decision: ChatAttackTelegraphDecision;
  readonly publicWitness: boolean;
  readonly rescueAllowed: boolean;
  readonly vector: ChatAttackTelegraphVector;
  readonly counterWindow: ChatCounterplayWindow;
  readonly telegraphLine: string;
  readonly summaryLine: string;
  readonly transcriptMessages: readonly ChatMessage[];
  readonly delayedMessages: readonly { schedule: ChatRevealSchedule; message: ChatMessage }[];
  readonly cues: readonly ChatAttackTelegraphCue[];
  readonly presence: readonly ChatAttackTelegraphPresenceBeat[];
  readonly counterOptions: readonly ChatAttackTelegraphCounterOption[];
  readonly threatRadar: ChatAttackTelegraphThreatRadarModel;
  readonly counterplayModal: ChatAttackTelegraphCounterplayModalModel;
  readonly momentFlash: ChatAttackTelegraphMomentFlashModel;
  readonly proofCard: ChatAttackTelegraphProofCardModel;
  readonly rescueBanner: ChatAttackTelegraphRescueBannerModel;
  readonly tags: readonly string[];
  readonly notes: readonly string[];
}

export interface ChatAttackTelegraphOptions {
  readonly now?: () => number;
  readonly responseDirector?: ReturnType<typeof createChatBotResponseDirector>;
}

// ============================================================================
// MARK: Internal registries
// ============================================================================

interface IdFactory {
  next(prefix: string): string;
  nextMessageId(prefix: string): ChatMessageId;
  nextSceneId(prefix: string): ChatSceneId;
  nextMomentId(prefix: string): ChatMomentId;
}

interface ActorProfile {
  readonly actorKind: ChatActorKind;
  readonly actorId: string;
  readonly displayName: string;
  readonly senderRole:
    | 'SYSTEM_NOTICE'
    | 'HATER_BOT'
    | 'HELPER_GUIDE'
    | 'CROWD_VOICE';
}

interface TelegraphDefinition {
  readonly family: ChatAttackTelegraphFamily;
  readonly category: BotLineCategory;
  readonly defaultTimingClass: ChatAttackTelegraphTimingClass;
  readonly silenceBeforeOpenMs: number;
  readonly baseWindowMs: number;
  readonly crowdDelayMs: number;
  readonly helperDelayMs: number;
  readonly counterIntents: readonly ChatAttackTelegraphIntent[];
  readonly preferredTags: readonly string[];
  readonly fallbackOpeners: readonly string[];
  readonly systemPrefix: string;
  readonly threatLine: string;
  readonly avoidMoves: readonly string[];
  readonly witnessBias: number;
  readonly rescueBias: number;
  readonly explanation: string;
}

const DEFAULT_CHANNEL: ChatVisibleChannel = 'GLOBAL';
const DEAL_ROOM_CHANNEL: ChatVisibleChannel = 'DEAL_ROOM';
const CROWD_CHANNELS: readonly ChatVisibleChannel[] = ['GLOBAL', 'SYNDICATE', 'LOBBY'];

const BOT_ACTORS: Readonly<Record<BotId, ActorProfile>> = Object.freeze({
  BOT_01: {
    actorKind: 'HATER',
    actorId: 'npc:hater:bot_01',
    displayName: 'THE LIQUIDATOR',
    senderRole: 'HATER_BOT',
  },
  BOT_02: {
    actorKind: 'HATER',
    actorId: 'npc:hater:bot_02',
    displayName: 'THE BUREAUCRAT',
    senderRole: 'HATER_BOT',
  },
  BOT_03: {
    actorKind: 'HATER',
    actorId: 'npc:hater:bot_03',
    displayName: 'THE MANIPULATOR',
    senderRole: 'HATER_BOT',
  },
  BOT_04: {
    actorKind: 'HATER',
    actorId: 'npc:hater:bot_04',
    displayName: 'THE CRASH PROPHET',
    senderRole: 'HATER_BOT',
  },
  BOT_05: {
    actorKind: 'HATER',
    actorId: 'npc:hater:bot_05',
    displayName: 'THE LEGACY HEIR',
    senderRole: 'HATER_BOT',
  },
});

const HELPER_ACTOR: ActorProfile = Object.freeze({
  actorKind: 'HELPER',
  actorId: 'npc:helper:counterplay',
  displayName: 'COUNTERPLAY',
  senderRole: 'HELPER_GUIDE',
});

const CROWD_ACTOR: ActorProfile = Object.freeze({
  actorKind: 'CROWD',
  actorId: 'crowd:arena',
  displayName: 'THE ROOM',
  senderRole: 'CROWD_VOICE',
});

const TELEGRAPH_DEFINITIONS: Readonly<Record<ChatAttackTelegraphFamily, TelegraphDefinition>> =
  Object.freeze({
    MARGIN_SNAP: {
      family: 'MARGIN_SNAP',
      category: 'telegraph',
      defaultTimingClass: 'INSTANT',
      silenceBeforeOpenMs: 0,
      baseWindowMs: 6800,
      crowdDelayMs: 740,
      helperDelayMs: 1220,
      counterIntents: ['ASSERT', 'STABILIZE', 'CALL_BLUFF'],
      preferredTags: ['pressure', 'collapse', 'margin', 'breach'],
      fallbackOpeners: [
        'The structure is thinner than the posture holding it.',
        'Pressure is about to price your confidence in public.',
        'This line is one bad beat away from becoming evidence.',
      ],
      systemPrefix: 'Pressure telegraph',
      threatLine: 'A structural pressure line is forming.',
      avoidMoves: [
        'Do not overshare your panic.',
        'Do not type three lines when one line is enough.',
      ],
      witnessBias: 28,
      rescueBias: 22,
      explanation: 'A stress event is becoming legible before it fully lands.',
    },
    QUOTE_TRAP: {
      family: 'QUOTE_TRAP',
      category: 'telegraph',
      defaultTimingClass: 'READ_DELAYED',
      silenceBeforeOpenMs: 620,
      baseWindowMs: 7400,
      crowdDelayMs: 880,
      helperDelayMs: 1560,
      counterIntents: ['CALL_BLUFF', 'REVERSE', 'WITHDRAW'],
      preferredTags: ['quote', 'receipt', 'record', 'mirror'],
      fallbackOpeners: [
        'They are reaching for your earlier words, not your present position.',
        'This attack wants your quote to do the damage for them.',
        'A mirror trap is forming. Break the frame before you answer the room.',
      ],
      systemPrefix: 'Quote trap',
      threatLine: 'Your own record is being positioned as a weapon.',
      avoidMoves: [
        'Do not defend every word you ever typed.',
        'Do not accept their framing of your earlier line.',
      ],
      witnessBias: 34,
      rescueBias: 18,
      explanation: 'The incoming attack is built around memory, receipts, or your own boast.',
    },
    DEADLINE_PIN: {
      family: 'DEADLINE_PIN',
      category: 'telegraph',
      defaultTimingClass: 'SILENCE_PRIMED',
      silenceBeforeOpenMs: 960,
      baseWindowMs: 5200,
      crowdDelayMs: 1100,
      helperDelayMs: 1280,
      counterIntents: ['STABILIZE', 'WITHDRAW', 'ASSERT'],
      preferredTags: ['deadline', 'clock', 'window', 'late'],
      fallbackOpeners: [
        'The clock is being weaponized more than the language.',
        'This is a timing attack disguised as commentary.',
        'They want urgency to choose the sentence for you.',
      ],
      systemPrefix: 'Deadline pressure',
      threatLine: 'A clock-based pressure pin is closing.',
      avoidMoves: [
        'Do not leak urgency.',
        'Do not answer the speed of the attack with loose language.',
      ],
      witnessBias: 16,
      rescueBias: 24,
      explanation: 'The opponent is trying to let the timer land the hit for them.',
    },
    CROWD_BAIT: {
      family: 'CROWD_BAIT',
      category: 'taunt',
      defaultTimingClass: 'CROWD_STAGGERED',
      silenceBeforeOpenMs: 0,
      baseWindowMs: 6100,
      crowdDelayMs: 340,
      helperDelayMs: 1400,
      counterIntents: ['ASSERT', 'DEFLECT', 'PROTECT_DIGNITY'],
      preferredTags: ['crowd', 'laugh', 'public', 'swarm'],
      fallbackOpeners: [
        'This attack is trying to recruit the room faster than it beats you.',
        'A crowd-first strike is forming. The spectacle is part of the weapon.',
        'They are trying to make witnesses before they make a point.',
      ],
      systemPrefix: 'Crowd bait',
      threatLine: 'Public ridicule is being staged as momentum.',
      avoidMoves: [
        'Do not perform for the room.',
        'Do not reward spectacle with spectacle.',
      ],
      witnessBias: 48,
      rescueBias: 14,
      explanation: 'The real target is your social posture in front of witnesses.',
    },
    DEAL_ROOM_SQUEEZE: {
      family: 'DEAL_ROOM_SQUEEZE',
      category: 'telegraph',
      defaultTimingClass: 'READ_DELAYED',
      silenceBeforeOpenMs: 780,
      baseWindowMs: 5600,
      crowdDelayMs: 0,
      helperDelayMs: 1180,
      counterIntents: ['WITHDRAW', 'STABILIZE', 'CALL_BLUFF'],
      preferredTags: ['deal', 'price', 'offer', 'reprice', 'bluff'],
      fallbackOpeners: [
        'This negotiation line is trying to force a bad price through tempo.',
        'A squeeze is forming in the deal surface. Protect leverage first.',
        'They are trying to make your next sentence expensive.',
      ],
      systemPrefix: 'Deal squeeze',
      threatLine: 'Negotiation leverage is being compressed.',
      avoidMoves: [
        'Do not justify your price emotionally.',
        'Do not over-negotiate against yourself.',
      ],
      witnessBias: 6,
      rescueBias: 18,
      explanation: 'The pressure is economic, not theatrical, even if the language is sharp.',
    },
    FALSE_MERCY: {
      family: 'FALSE_MERCY',
      category: 'taunt',
      defaultTimingClass: 'HELPER_STAGGERED',
      silenceBeforeOpenMs: 220,
      baseWindowMs: 6500,
      crowdDelayMs: 980,
      helperDelayMs: 980,
      counterIntents: ['REVERSE', 'DEFLECT', 'ASSERT'],
      preferredTags: ['mercy', 'offer', 'last chance', 'soft'],
      fallbackOpeners: [
        'The softness is part of the blade.',
        'A false mercy line is opening. They want gratitude to weaken posture.',
        'This offer is trying to turn relief into compliance.',
      ],
      systemPrefix: 'False mercy',
      threatLine: 'An apparently soft line is hiding a control move.',
      avoidMoves: [
        'Do not thank the attack for arriving politely.',
        'Do not confuse softness with safety.',
      ],
      witnessBias: 22,
      rescueBias: 20,
      explanation: 'The attack is using warmth or generosity as a disguise for control.',
    },
    HELPER_DENIAL: {
      family: 'HELPER_DENIAL',
      category: 'taunt',
      defaultTimingClass: 'INSTANT',
      silenceBeforeOpenMs: 0,
      baseWindowMs: 5700,
      crowdDelayMs: 640,
      helperDelayMs: 1860,
      counterIntents: ['STABILIZE', 'SILENT_HOLD', 'ASSERT'],
      preferredTags: ['alone', 'nobody', 'helper', 'rescue'],
      fallbackOpeners: [
        'This line is trying to separate you from your support timing.',
        'A helper denial attack is forming. Isolation is the point.',
        'They want you to feel unattended before the actual hit lands.',
      ],
      systemPrefix: 'Helper denial',
      threatLine: 'Support timing is being attacked to induce panic.',
      avoidMoves: [
        'Do not spam for rescue.',
        'Do not let isolation become a visible tell.',
      ],
      witnessBias: 26,
      rescueBias: 42,
      explanation: 'The attack is trying to make the player feel unsupported or stranded.',
    },
    SILENCE_LURE: {
      family: 'SILENCE_LURE',
      category: 'telegraph',
      defaultTimingClass: 'SILENCE_PRIMED',
      silenceBeforeOpenMs: 1320,
      baseWindowMs: 7200,
      crowdDelayMs: 0,
      helperDelayMs: 1640,
      counterIntents: ['SILENT_HOLD', 'CALL_BLUFF', 'WITHDRAW'],
      preferredTags: ['silence', 'wait', 'seen', 'read'],
      fallbackOpeners: [
        'The delay is part of the attack. They want your imagination to swing first.',
        'A silence lure is forming. Your urge to fill space is being measured.',
        'The empty beat is the telegraph here, not the line after it.',
      ],
      systemPrefix: 'Silence lure',
      threatLine: 'Silence itself is being used as pressure.',
      avoidMoves: [
        'Do not confess into the silence.',
        'Do not convert uncertainty into overexplaining.',
      ],
      witnessBias: 10,
      rescueBias: 26,
      explanation: 'The opponent is weaponizing delay and read-pressure, not just speech.',
    },
    SHIELD_SHATTER: {
      family: 'SHIELD_SHATTER',
      category: 'telegraph',
      defaultTimingClass: 'INSTANT',
      silenceBeforeOpenMs: 0,
      baseWindowMs: 5000,
      crowdDelayMs: 520,
      helperDelayMs: 1340,
      counterIntents: ['STABILIZE', 'ASSERT', 'WITHDRAW'],
      preferredTags: ['shield', 'break', 'breach', 'exposed'],
      fallbackOpeners: [
        'A shield-state line is forming. The attack smells exposed infrastructure.',
        'They think the defense layer is visible from where they are standing.',
        'This is the kind of telegraph that believes it has seen the seam.',
      ],
      systemPrefix: 'Shield breach',
      threatLine: 'Defensive integrity is being targeted explicitly.',
      avoidMoves: [
        'Do not deny obvious damage.',
        'Do not posture as fully stable if the shield is visibly cracked.',
      ],
      witnessBias: 30,
      rescueBias: 30,
      explanation: 'The attack is anchored to perceived weakness in the player’s shield or board state.',
    },
    REPUTATION_STRIKE: {
      family: 'REPUTATION_STRIKE',
      category: 'taunt',
      defaultTimingClass: 'CROWD_STAGGERED',
      silenceBeforeOpenMs: 180,
      baseWindowMs: 6400,
      crowdDelayMs: 280,
      helperDelayMs: 1280,
      counterIntents: ['PROTECT_DIGNITY', 'ASSERT', 'DEFLECT'],
      preferredTags: ['respect', 'legacy', 'fraud', 'title', 'status'],
      fallbackOpeners: [
        'The line is aimed at your standing, not the current board alone.',
        'A reputation strike is forming. They want the room to remember the insult longer than the move.',
        'This attack wants to stain identity, not just win the beat.',
      ],
      systemPrefix: 'Reputation strike',
      threatLine: 'Standing and credibility are being targeted.',
      avoidMoves: [
        'Do not turn the whole room into your jury.',
        'Do not defend your entire legacy inside one beat.',
      ],
      witnessBias: 44,
      rescueBias: 12,
      explanation: 'The attack is designed to alter how the room reads the player’s status.',
    },
    BLUFF_EXTRACTION: {
      family: 'BLUFF_EXTRACTION',
      category: 'telegraph',
      defaultTimingClass: 'READ_DELAYED',
      silenceBeforeOpenMs: 560,
      baseWindowMs: 6000,
      crowdDelayMs: 720,
      helperDelayMs: 1180,
      counterIntents: ['CALL_BLUFF', 'WITHDRAW', 'STABILIZE'],
      preferredTags: ['bluff', 'show', 'prove', 'receipt', 'price'],
      fallbackOpeners: [
        'They are trying to force disclosure before they force defeat.',
        'A bluff extraction line is forming. Your confidence is being audited.',
        'This is not curiosity. This is a demand for visible weakness.',
      ],
      systemPrefix: 'Bluff extraction',
      threatLine: 'The attack is trying to force a reveal.',
      avoidMoves: [
        'Do not show proof you do not need to show.',
        'Do not escalate into a receipt war by reflex.',
      ],
      witnessBias: 24,
      rescueBias: 16,
      explanation: 'The opponent is testing whether the player will leak information under pressure.',
    },
    FINAL_WORD_DUEL: {
      family: 'FINAL_WORD_DUEL',
      category: 'taunt',
      defaultTimingClass: 'INSTANT',
      silenceBeforeOpenMs: 0,
      baseWindowMs: 5800,
      crowdDelayMs: 480,
      helperDelayMs: 1420,
      counterIntents: ['REVERSE', 'ASSERT', 'SILENT_HOLD'],
      preferredTags: ['last', 'final', 'end', 'finish', 'close'],
      fallbackOpeners: [
        'The line is trying to close the scene before you choose the ending.',
        'A final-word duel is forming. Closure itself is being contested.',
        'They are racing to author the last memory of this beat.',
      ],
      systemPrefix: 'Final-word duel',
      threatLine: 'The scene’s closing authority is under challenge.',
      avoidMoves: [
        'Do not throw a messy final line just to avoid being second.',
        'Do not chase the last word if silence wins the ending.',
      ],
      witnessBias: 32,
      rescueBias: 10,
      explanation: 'The opponent is fighting over authorship of the closing beat.',
    },
  });

const HELPER_WHISPERS = Object.freeze({
  ASSERT: Object.freeze([
    'Short line. Stable spine. Make them do the reaching.',
    'Answer the structure. Do not answer the performance.',
    'One clean sentence beats visible panic every time.',
  ]),
  STABILIZE: Object.freeze([
    'Lower the temperature before you choose the wording.',
    'Breathe once. Protect leverage first. Language second.',
    'You do not need a dramatic answer to survive a dramatic beat.',
  ]),
  DEFLECT: Object.freeze([
    'Do not let them decide where your attention lands.',
    'Shift the frame without sounding evasive.',
    'Move the spotlight. Do not fight inside it.',
  ]),
  REVERSE: Object.freeze([
    'Turn the geometry, not the volume.',
    'A reversal works when it exposes their dependency on spectacle.',
    'Make their setup look expensive.',
  ]),
  CALL_BLUFF: Object.freeze([
    'Ask for the proof they are hoping you volunteer.',
    'Expose the demand, not your nerves.',
    'Receipts should move toward them, not out of you.',
  ]),
  WITHDRAW: Object.freeze([
    'A disciplined exit is still a win if it denies the feed.',
    'Leave clean. No apology tax.',
    'Refusing a bad window is not surrender.',
  ]),
  SILENT_HOLD: Object.freeze([
    'Silence can be control when you choose it early enough.',
    'Do not leak fear into the empty beat.',
    'Let the room wonder, not you.',
  ]),
  PROTECT_DIGNITY: Object.freeze([
    'Protect posture before persuasion.',
    'Dignity first. Explanation second, if at all.',
    'They want spectacle. Give them less surface.',
  ]),
});

const CROWD_LINES = Object.freeze({
  heat: Object.freeze([
    'The room can feel the line tightening.',
    'Something just became public even before the answer did.',
    'Everybody read that the same way.',
  ]),
  ridicule: Object.freeze([
    'The room smells panic faster than it smells nuance.',
    'That line landed in public before the defense arrived.',
    'Witnesses are starting to choose sides.',
  ]),
  respect: Object.freeze([
    'That was cleaner than the attack deserved.',
    'The room felt the pivot.',
    'Posture held. Witnesses noticed.',
  ]),
  hush: Object.freeze([
    'The silence is doing as much work as the language.',
    'Nobody wants to move first now.',
    'The room just got careful.',
  ]),
});

const FAMILY_KEYWORDS: ReadonlyArray<readonly [ChatAttackTelegraphFamily, readonly RegExp[]]> = [
  ['QUOTE_TRAP', [/quote/i, /receipt/i, /you said/i, /record/i, /mirror/i]],
  ['DEADLINE_PIN', [/deadline/i, /clock/i, /window/i, /late/i, /timer/i]],
  ['CROWD_BAIT', [/crowd/i, /laugh/i, /public/i, /everyone/i, /spectator/i]],
  ['DEAL_ROOM_SQUEEZE', [/deal/i, /price/i, /offer/i, /counteroffer/i, /overpay/i]],
  ['FALSE_MERCY', [/chance/i, /mercy/i, /be kind/i, /help you/i, /last offer/i]],
  ['HELPER_DENIAL', [/alone/i, /nobody/i, /helper/i, /save you/i, /rescue/i]],
  ['SILENCE_LURE', [/seen/i, /read/i, /waiting/i, /silence/i, /pause/i]],
  ['SHIELD_SHATTER', [/shield/i, /break/i, /breach/i, /crack/i, /exposed/i]],
  ['REPUTATION_STRIKE', [/legacy/i, /fraud/i, /status/i, /respect/i, /title/i]],
  ['BLUFF_EXTRACTION', [/prove/i, /show/i, /evidence/i, /proof/i, /bluff/i]],
  ['FINAL_WORD_DUEL', [/final/i, /last word/i, /finish/i, /ending/i, /close/i]],
  ['MARGIN_SNAP', [/pressure/i, /margin/i, /collapse/i, /thin/i, /breathing harder/i]],
];

// ============================================================================
// MARK: Engine
// ============================================================================

export class ChatAttackTelegraph {
  private readonly nowFn: () => number;
  private readonly responseDirector: ReturnType<typeof createChatBotResponseDirector>;
  private readonly ids: IdFactory;
  private idCounter = 0;

  constructor(options: ChatAttackTelegraphOptions = {}) {
    this.nowFn = options.now ?? (() => Date.now());
    this.responseDirector = options.responseDirector ?? createChatBotResponseDirector();
    this.ids = {
      next: (prefix: string) => {
        this.idCounter += 1;
        return `${prefix}:${this.nowFn()}:${this.idCounter}`;
      },
      nextMessageId: (prefix: string) => this.ids.next(`${prefix}:msg`) as ChatMessageId,
      nextSceneId: (prefix: string) => this.ids.next(`${prefix}:scene`) as ChatSceneId,
      nextMomentId: (prefix: string) => this.ids.next(`${prefix}:moment`) as ChatMomentId,
    };
  }

  analyze(input: ChatAttackTelegraphInput): ChatAttackTelegraphPlan {
    const now = (input.now ?? this.nowFn()) as UnixMs;
    const channel = input.signal.channel ?? input.state?.activeVisibleChannel ?? DEFAULT_CHANNEL;
    const actor = BOT_ACTORS[input.signal.botId];
    const family = this.inferFamily(input.signal, channel, input.state?.affect, input.state?.audienceHeat?.[channel]);
    const definition = TELEGRAPH_DEFINITIONS[family];
    const vector = this.computeVector({
      signal: input.signal,
      family,
      channel,
      affect: input.state?.affect,
      audience: input.state?.audienceHeat?.[channel],
      mood: input.state?.channelMoodByChannel?.[channel],
      relationship: relationForBot(input.state?.relationshipsByCounterpartId, actor.actorId),
    });
    const severity = this.inferSeverity(vector, definition, channel, input.state?.currentSilence != null);
    const timingClass = this.inferTimingClass(definition, channel, vector, input.state?.currentSilence != null);
    const publicWitness = this.shouldUsePublicWitness(channel, vector, definition, input.signal.forcePublic === true);
    const rescueAllowed = this.shouldOfferRescue(vector, definition, input.signal.forceRescue === true);
    const sceneId = input.signal.sourceSceneId ?? this.ids.nextSceneId('chat-telegraph');
    const momentId = input.signal.sourceMomentId ?? this.ids.nextMomentId('chat-telegraph');
    const counterWindow = this.buildCounterWindow(now, definition, timingClass, vector, channel);
    const telegraphLine = this.composeTelegraphLine({
      botId: input.signal.botId,
      signal: input.signal,
      family,
      definition,
      vector,
      severity,
      now,
      channel,
      recentBodies: recentBodiesForChannel(input.state, channel),
    });
    const summaryLine = this.buildSummaryLine(family, severity, vector, channel);
    const counterOptions = this.buildCounterOptions(family, severity, vector, channel);
    const decision = input.signal.forceDecision ?? this.decideEscalation(family, severity, vector, channel, publicWitness);
    const tags = this.buildTags(input.signal, family, severity, channel, publicWitness, rescueAllowed);
    const transcriptMessages: ChatMessage[] = [];
    const delayedMessages: { schedule: ChatRevealSchedule; message: ChatMessage }[] = [];
    const cues: ChatAttackTelegraphCue[] = [];
    const presence = this.buildPresence(family, timingClass, definition, actor, publicWitness, rescueAllowed);

    const systemNotice = buildLocalSystemMessage({
      id: this.ids.nextMessageId('telegraph-system'),
      channel,
      kind: 'SYSTEM',
      body: `${definition.systemPrefix}: ${summaryLine}`,
      at: now,
      proofHash: input.signal.proofHash,
      pressureTier: input.signal.pressureTier,
      tickTier: input.signal.tickTier,
      tags: ['chat-telegraph', family.toLowerCase(), severity.toLowerCase()],
    });

    transcriptMessages.push(systemNotice);
    cues.push({
      cueKind: 'SYSTEM_NOTICE',
      channel,
      when: now,
      message: systemNotice,
      surface: 'THREAT_BADGE',
      note: 'Local system warning created immediately so the player can read the shape early.',
    });

    const telegraphAt = (now + delayFromTimingClass(timingClass, definition.silenceBeforeOpenMs)) as UnixMs;
    const telegraphMessage = this.buildActorMessage({
      actor,
      channel,
      kind: definition.category === 'telegraph' ? 'HATER_TELEGRAPH' : 'BOT_TAUNT',
      body: telegraphLine,
      at: telegraphAt,
      sceneId,
      momentId,
      botId: input.signal.botId,
      tags,
    });

    if (telegraphAt <= now) {
      transcriptMessages.push(telegraphMessage);
      cues.push({
        cueKind: 'PRIMARY_TELEGRAPH',
        channel,
        when: telegraphAt,
        message: telegraphMessage,
        surface: 'MOMENT_FLASH',
        note: 'Primary attack telegraph is immediate.',
      });
    } else {
      const reveal = this.buildReveal(telegraphAt, channel, 'SCENE_STAGING', telegraphMessage.id);
      delayedMessages.push({ schedule: reveal, message: telegraphMessage });
      cues.push({
        cueKind: 'PRIMARY_TELEGRAPH',
        channel,
        when: telegraphAt,
        message: telegraphMessage,
        reveal,
        surface: 'MOMENT_FLASH',
        note: 'Primary attack telegraph is deliberately delayed to let pressure breathe.',
      });
    }

    if (publicWitness && channel !== DEAL_ROOM_CHANNEL) {
      const crowdWhen = (counterWindow.opensAt + definition.crowdDelayMs) as UnixMs;
      const crowdMode = vector.embarrassmentRisk >= 70 || vector.spectacleRisk >= 70 ? 'ridicule' : 'heat';
      const crowdMessage = this.buildActorMessage({
        actor: CROWD_ACTOR,
        channel,
        kind: 'CROWD_REACTION',
        body: pickByTime(CROWD_LINES[crowdMode], crowdWhen),
        at: crowdWhen,
        sceneId,
        momentId,
        tags: [...tags, 'crowd'],
      });
      const reveal = this.buildReveal(crowdWhen, channel, 'SCENE_STAGING', crowdMessage.id);
      delayedMessages.push({ schedule: reveal, message: crowdMessage });
      cues.push({
        cueKind: 'AMBIENT_CROWD',
        channel,
        when: crowdWhen,
        message: crowdMessage,
        reveal,
        surface: 'THREAT_RADAR_PANEL',
        note: 'Crowd heat enters as a secondary witness beat.',
      });
    }

    if (rescueAllowed) {
      const intent = counterOptions[0]?.intent ?? 'STABILIZE';
      const helperWhen = (counterWindow.opensAt + definition.helperDelayMs) as UnixMs;
      const helperMessage = this.buildActorMessage({
        actor: HELPER_ACTOR,
        channel,
        kind: 'HELPER_PROMPT',
        body: pickByTime(HELPER_WHISPERS[intent], helperWhen),
        at: helperWhen,
        sceneId,
        momentId,
        tags: [...tags, 'helper', intent.toLowerCase()],
      });
      const reveal = this.buildReveal(helperWhen, channel, 'DELAYED_HELPER', helperMessage.id);
      delayedMessages.push({ schedule: reveal, message: helperMessage });
      cues.push({
        cueKind: vector.rescueNeed >= 80 ? 'RESCUE_INTERCEPT' : 'HELPER_WHISPER',
        channel,
        when: helperWhen,
        message: helperMessage,
        reveal,
        surface: vector.rescueNeed >= 80 ? 'RESCUE_WINDOW_BANNER' : 'COUNTERPLAY_MODAL',
        note: 'Helper intervention is delayed so pressure remains legible before rescue arrives.',
      });
    }

    if (input.signal.proofHash || input.signal.quoteAnchor) {
      cues.push({
        cueKind: 'PROOF_EXPOSURE',
        channel,
        when: now,
        surface: 'PROOF_CARD',
        note: 'Proof and quote exposure surfaces should light up for this telegraph.',
      });
    }

    const threatRadar = this.buildThreatRadar({
      family,
      severity,
      vector,
      summaryLine,
      channel,
    });
    const counterplayModal = this.buildCounterplayModal({
      family,
      severity,
      vector,
      telegraphLine,
      counterOptions,
      definition,
      counterWindow,
      channel,
      publicWitness,
    });
    const momentFlash = this.buildMomentFlash(actor.displayName, family, severity, summaryLine);
    const proofCard = this.buildProofCard(input.signal, vector, family);
    const rescueBanner = this.buildRescueBanner(rescueAllowed, severity, family, counterOptions[0]);

    if (timingClass === 'READ_DELAYED' || timingClass === 'SILENCE_PRIMED') {
      cues.push({
        cueKind: 'READ_PRESSURE',
        channel,
        when: now,
        surface: 'MOMENT_FLASH',
        note: 'Read/typing theater should be activated before the line resolves.',
      });
    }

    cues.push({
      cueKind: 'MOMENT_FLASH',
      channel,
      when: now,
      surface: 'MOMENT_FLASH',
      note: 'Moment flash surface carries the cinematic warning beat.',
    });

    return {
      telegraphId: this.ids.next('chat-telegraph'),
      sceneId,
      momentId,
      channel,
      botId: input.signal.botId,
      family,
      severity,
      timingClass,
      decision,
      publicWitness,
      rescueAllowed,
      vector,
      counterWindow,
      telegraphLine,
      summaryLine,
      transcriptMessages,
      delayedMessages,
      cues,
      presence,
      counterOptions,
      threatRadar,
      counterplayModal,
      momentFlash,
      proofCard,
      rescueBanner,
      tags,
      notes: [
        `family:${family}`,
        `severity:${severity}`,
        `decision:${decision}`,
        `public:${publicWitness ? 'on' : 'off'}`,
        `rescue:${rescueAllowed ? 'on' : 'off'}`,
        `dominance:${vector.dominanceSwing}`,
        `embarrassment:${vector.embarrassmentRisk}`,
        `proof:${vector.proofExposure}`,
      ],
    };
  }

  explain(plan: ChatAttackTelegraphPlan): string {
    const witness = plan.publicWitness
      ? plan.channel === DEAL_ROOM_CHANNEL
        ? 'deal surface watching'
        : 'room watching'
      : 'limited witnesses';
    const rescue = plan.rescueAllowed ? 'rescue eligible' : 'rescue withheld';
    return `${plan.family} / ${plan.severity} / ${witness} / ${rescue} / decision=${plan.decision}`;
  }

  private inferFamily(
    signal: ChatAttackTelegraphSignal,
    channel: ChatVisibleChannel,
    affect?: ChatAffectSnapshot,
    audience?: ChatAudienceHeat,
  ): ChatAttackTelegraphFamily {
    const haystack = `${signal.reason} ${signal.bodyHint ?? ''} ${signal.quoteAnchor ?? ''}`;
    for (const [family, patterns] of FAMILY_KEYWORDS) {
      if (patterns.some((pattern) => pattern.test(haystack))) {
        return family;
      }
    }

    if (channel === DEAL_ROOM_CHANNEL) return 'DEAL_ROOM_SQUEEZE';
    if (Number(audience?.ridicule ?? 0) >= 65 || Number(affect?.vector.embarrassment ?? 0) >= 68) {
      return 'CROWD_BAIT';
    }
    if (Number(affect?.vector.frustration ?? 0) >= 72) return 'HELPER_DENIAL';
    if (signal.proofHash) return 'BLUFF_EXTRACTION';
    return 'MARGIN_SNAP';
  }

  private computeVector(input: {
    readonly signal: ChatAttackTelegraphSignal;
    readonly family: ChatAttackTelegraphFamily;
    readonly channel: ChatVisibleChannel;
    readonly affect?: ChatAffectSnapshot;
    readonly audience?: ChatAudienceHeat;
    readonly mood?: ChatChannelMood;
    readonly relationship?: ChatRelationshipState;
  }): ChatAttackTelegraphVector {
    const pressure = pressureTierWeight(input.signal.pressureTier);
    const tick = tickTierWeight(input.signal.tickTier);
    const affect = input.affect?.vector;
    const audience = input.audience;
    const mood = input.mood?.mood ?? 'NEUTRAL';
    const relationRespect = Number(input.relationship?.respect ?? 0);
    const relationContempt = Number(input.relationship?.contempt ?? 0);
    const relationRivalry = Number(input.relationship?.rivalryIntensity ?? 0);

    let dominance = 20 + pressure + tick;
    let embarrassment = 16 + Math.floor(Number(audience?.ridicule ?? 0) * 0.55) + Math.floor(Number(affect?.socialEmbarrassment ?? affect?.embarrassment ?? 0) * 0.35);
    let leverage = 14 + pressure + Math.floor(Number(affect?.desperation ?? 0) * 0.25);
    let proof = input.signal.proofHash ? 72 : 12;
    let rescue = 8 + Math.floor(Number(affect?.frustration ?? 0) * 0.45) + Math.floor(Number(affect?.relief ?? 0) * -0.12);
    let spectacle = Math.floor(Number(audience?.heat ?? 0) * 0.42) + Math.floor(Number(audience?.volatility ?? 0) * 0.38);
    let bluff = /bluff|prove|show|receipt|quote/i.test(`${input.signal.reason} ${input.signal.bodyHint ?? ''}`) ? 64 : 18;
    let silence = Number(affect?.curiosity ?? 0) > Number(affect?.frustration ?? 0) ? 54 : 24;

    switch (input.family) {
      case 'QUOTE_TRAP':
        proof += 18;
        bluff += 12;
        dominance += 8;
        break;
      case 'DEADLINE_PIN':
        leverage += 18;
        silence += 10;
        break;
      case 'CROWD_BAIT':
        embarrassment += 18;
        spectacle += 18;
        dominance += 6;
        break;
      case 'DEAL_ROOM_SQUEEZE':
        leverage += 20;
        proof += 8;
        spectacle -= 12;
        break;
      case 'FALSE_MERCY':
        dominance += 10;
        bluff += 16;
        rescue += 6;
        break;
      case 'HELPER_DENIAL':
        rescue += 24;
        dominance += 6;
        break;
      case 'SILENCE_LURE':
        silence += 28;
        proof -= 8;
        break;
      case 'SHIELD_SHATTER':
        leverage += 14;
        dominance += 10;
        rescue += 10;
        break;
      case 'REPUTATION_STRIKE':
        embarrassment += 16;
        spectacle += 14;
        break;
      case 'BLUFF_EXTRACTION':
        proof += 20;
        bluff += 24;
        break;
      case 'FINAL_WORD_DUEL':
        dominance += 14;
        silence += 10;
        spectacle += 8;
        break;
      case 'MARGIN_SNAP':
      default:
        leverage += 14;
        dominance += 12;
        break;
    }

    if (input.channel === DEAL_ROOM_CHANNEL) {
      leverage += 12;
      proof += 6;
      spectacle = Math.max(0, spectacle - 16);
      embarrassment += 4;
    }

    if (mood === 'PREDATORY') {
      leverage += 10;
      dominance += 8;
    } else if (mood === 'HOSTILE') {
      spectacle += 8;
      embarrassment += 6;
    } else if (mood === 'ECSTATIC') {
      spectacle += 10;
      dominance += 6;
    }

    dominance += Math.floor(relationContempt * 0.15) + Math.floor(relationRivalry * 0.12) - Math.floor(relationRespect * 0.08);
    embarrassment += Math.floor(relationContempt * 0.1);
    bluff += Math.floor(relationRespect * -0.05) + Math.floor(relationContempt * 0.08);
    rescue += Math.floor(Number(affect?.trust ?? 0) * -0.15);

    return {
      dominanceSwing: toScore100(dominance),
      embarrassmentRisk: toScore100(embarrassment),
      leverageDanger: toScore100(leverage),
      proofExposure: toScore100(proof),
      rescueNeed: toScore100(rescue),
      spectacleRisk: toScore100(spectacle),
      bluffProbability: toScore100(bluff),
      silenceValue: toScore100(silence),
    };
  }

  private inferSeverity(
    vector: ChatAttackTelegraphVector,
    definition: TelegraphDefinition,
    channel: ChatVisibleChannel,
    silenceAlreadyActive: boolean,
  ): ChatAttackTelegraphSeverity {
    let score =
      Number(vector.dominanceSwing) * 0.22 +
      Number(vector.embarrassmentRisk) * 0.16 +
      Number(vector.leverageDanger) * 0.18 +
      Number(vector.proofExposure) * 0.12 +
      Number(vector.spectacleRisk) * 0.12 +
      Number(vector.rescueNeed) * 0.1 +
      Number(vector.bluffProbability) * 0.1;

    score += definition.witnessBias * 0.18;
    score += definition.rescueBias * 0.12;
    if (channel === DEAL_ROOM_CHANNEL) score += 4;
    if (silenceAlreadyActive) score += 3;

    if (score >= 76) return 'EXECUTION';
    if (score >= 58) return 'SEVERE';
    if (score >= 38) return 'HOT';
    return 'WATCH';
  }

  private inferTimingClass(
    definition: TelegraphDefinition,
    channel: ChatVisibleChannel,
    vector: ChatAttackTelegraphVector,
    silenceAlreadyActive: boolean,
  ): ChatAttackTelegraphTimingClass {
    if (silenceAlreadyActive || Number(vector.silenceValue) >= 72) return 'SILENCE_PRIMED';
    if (channel === DEAL_ROOM_CHANNEL && Number(vector.proofExposure) >= 48) return 'READ_DELAYED';
    if (Number(vector.spectacleRisk) >= 62 && CROWD_CHANNELS.includes(channel)) return 'CROWD_STAGGERED';
    if (Number(vector.rescueNeed) >= 72) return 'HELPER_STAGGERED';
    return definition.defaultTimingClass;
  }

  private buildCounterWindow(
    now: UnixMs,
    definition: TelegraphDefinition,
    timingClass: ChatAttackTelegraphTimingClass,
    vector: ChatAttackTelegraphVector,
    channel: ChatVisibleChannel,
  ): ChatCounterplayWindow {
    const openDelay = delayFromTimingClass(timingClass, definition.silenceBeforeOpenMs);
    let windowMs = definition.baseWindowMs;
    if (Number(vector.embarrassmentRisk) >= 70) windowMs -= 420;
    if (Number(vector.leverageDanger) >= 72) windowMs -= 300;
    if (Number(vector.rescueNeed) >= 72) windowMs += 260;
    if (channel === DEAL_ROOM_CHANNEL && Number(vector.proofExposure) >= 60) windowMs -= 240;

    windowMs = Math.max(4200, windowMs);

    return {
      opensAt: (now + openDelay) as UnixMs,
      closesAt: (now + openDelay + windowMs) as UnixMs,
      reason: channel === DEAL_ROOM_CHANNEL ? 'DEAL_ROOM_TRAP' : 'HATER_TELEGRAPH',
      playerFacingHint: counterHintFromVector(vector, channel),
    };
  }

  private shouldUsePublicWitness(
    channel: ChatVisibleChannel,
    vector: ChatAttackTelegraphVector,
    definition: TelegraphDefinition,
    forced: boolean,
  ): boolean {
    if (forced) return true;
    if (channel === DEAL_ROOM_CHANNEL) return false;
    if (!CROWD_CHANNELS.includes(channel)) return false;
    return Number(vector.spectacleRisk) + definition.witnessBias >= 70 || Number(vector.embarrassmentRisk) >= 64;
  }

  private shouldOfferRescue(
    vector: ChatAttackTelegraphVector,
    definition: TelegraphDefinition,
    forced: boolean,
  ): boolean {
    if (forced) return true;
    return Number(vector.rescueNeed) + definition.rescueBias >= 58;
  }

  private composeTelegraphLine(input: {
    readonly botId: BotId;
    readonly signal: ChatAttackTelegraphSignal;
    readonly family: ChatAttackTelegraphFamily;
    readonly definition: TelegraphDefinition;
    readonly vector: ChatAttackTelegraphVector;
    readonly severity: ChatAttackTelegraphSeverity;
    readonly now: UnixMs;
    readonly channel: ChatVisibleChannel;
    readonly recentBodies: readonly string[];
  }): string {
    const preferredTags = [...input.definition.preferredTags];
    if (input.signal.quoteAnchor) preferredTags.push('quote');
    if (input.signal.proofHash) preferredTags.push('receipt');
    if (input.channel === DEAL_ROOM_CHANNEL) preferredTags.push('deal');
    if (input.severity === 'EXECUTION') preferredTags.push('collapse');

    const pressureBand = toPersonaPressureBand(input.signal.pressureTier, input.vector);
    const picked = this.responseDirector.pick(input.botId, input.definition.category, {
      now: input.now,
      category: input.definition.category,
      pressureBand,
      signalType: input.family,
      recentBodies: input.recentBodies,
      preferredTags,
      excludeTags: input.channel === DEAL_ROOM_CHANNEL ? ['crowd'] : undefined,
    });

    if (picked.trim().length > 0) return picked;

    const fallbackSeed = `${input.signal.reason} ${input.signal.bodyHint ?? ''}`.length + preferredTags.length;
    return input.definition.fallbackOpeners[fallbackSeed % input.definition.fallbackOpeners.length];
  }

  private buildCounterOptions(
    family: ChatAttackTelegraphFamily,
    severity: ChatAttackTelegraphSeverity,
    vector: ChatAttackTelegraphVector,
    channel: ChatVisibleChannel,
  ): readonly ChatAttackTelegraphCounterOption[] {
    const definition = TELEGRAPH_DEFINITIONS[family];
    const primary = definition.counterIntents;
    const rewardBase = severity === 'EXECUTION' ? 82 : severity === 'SEVERE' ? 70 : severity === 'HOT' ? 58 : 46;
    const riskBase = channel === DEAL_ROOM_CHANNEL ? 22 : 30;

    return primary.map((intent, index) => {
      const reward = toScore100(
        rewardBase +
          (intent === 'CALL_BLUFF' ? Number(vector.proofExposure) * 0.18 : 0) +
          (intent === 'PROTECT_DIGNITY' ? Number(vector.embarrassmentRisk) * 0.12 : 0) +
          (intent === 'STABILIZE' ? Number(vector.leverageDanger) * 0.1 : 0) +
          (intent === 'SILENT_HOLD' ? Number(vector.silenceValue) * 0.12 : 0) -
          index * 6,
      );
      const risk = toScore100(
        riskBase +
          (intent === 'REVERSE' ? 18 : 0) +
          (intent === 'ASSERT' ? 10 : 0) +
          (intent === 'WITHDRAW' ? -8 : 0) +
          (intent === 'SILENT_HOLD' ? Number(vector.embarrassmentRisk) >= 72 ? 16 : -10 : 0) +
          (severity === 'EXECUTION' ? 10 : 0),
      );

      return {
        intent,
        label: intentLabel(intent),
        prompt: intentPrompt(intent, family, channel),
        why: intentReason(intent, vector, channel),
        risk,
        reward,
        recommended: index === 0 || reward >= 70,
        tags: [family.toLowerCase(), severity.toLowerCase(), intent.toLowerCase()],
      };
    });
  }

  private decideEscalation(
    family: ChatAttackTelegraphFamily,
    severity: ChatAttackTelegraphSeverity,
    vector: ChatAttackTelegraphVector,
    channel: ChatVisibleChannel,
    publicWitness: boolean,
  ): ChatAttackTelegraphDecision {
    if (severity === 'WATCH' && Number(vector.proofExposure) < 36 && Number(vector.spectacleRisk) < 34) {
      return 'STAGE_ONLY';
    }
    if (severity === 'HOT' && Number(vector.bluffProbability) < 50 && !publicWitness) {
      return 'WAIT_FOR_SECOND_SIGNAL';
    }
    if (severity === 'EXECUTION') return 'OPEN_BOSS_FIGHT';
    if (channel === DEAL_ROOM_CHANNEL && Number(vector.leverageDanger) >= 68) return 'OPEN_COUNTER_WINDOW';
    if (publicWitness && Number(vector.embarrassmentRisk) >= 68) return 'OPEN_BOSS_FIGHT';
    if (Number(vector.proofExposure) >= 74 || Number(vector.leverageDanger) >= 74) return 'OPEN_COUNTER_WINDOW';
    if (family === 'HELPER_DENIAL' && Number(vector.rescueNeed) >= 78) return 'OPEN_COUNTER_WINDOW';
    return 'STAGE_ONLY';
  }

  private buildThreatRadar(input: {
    readonly family: ChatAttackTelegraphFamily;
    readonly severity: ChatAttackTelegraphSeverity;
    readonly vector: ChatAttackTelegraphVector;
    readonly summaryLine: string;
    readonly channel: ChatVisibleChannel;
  }): ChatAttackTelegraphThreatRadarModel {
    const needles: ChatAttackTelegraphNeedle[] = [
      {
        key: 'dominance',
        label: 'Dominance swing',
        value: input.vector.dominanceSwing,
        band: bandForScore(input.vector.dominanceSwing),
        explanation: 'How much social momentum the attacker is trying to seize with the beat.',
      },
      {
        key: 'embarrassment',
        label: 'Embarrassment risk',
        value: input.vector.embarrassmentRisk,
        band: bandForScore(input.vector.embarrassmentRisk),
        explanation: 'How likely the beat is to become public discomfort instead of merely hostile language.',
      },
      {
        key: 'leverage',
        label: 'Leverage danger',
        value: input.vector.leverageDanger,
        band: bandForScore(input.vector.leverageDanger),
        explanation: 'How much real negotiating or board leverage may be lost if the next answer is sloppy.',
      },
      {
        key: 'proof',
        label: 'Proof exposure',
        value: input.vector.proofExposure,
        band: bandForScore(input.vector.proofExposure),
        explanation: 'How much the current beat is trying to force receipts, evidence, or involuntary disclosure.',
      },
      {
        key: 'rescue',
        label: 'Rescue need',
        value: input.vector.rescueNeed,
        band: bandForScore(input.vector.rescueNeed),
        explanation: 'How likely the player is to benefit from helper timing instead of solo answering.',
      },
      {
        key: 'spectacle',
        label: 'Spectacle risk',
        value: input.vector.spectacleRisk,
        band: bandForScore(input.vector.spectacleRisk),
        explanation: 'How much the attack depends on witnesses, swarm energy, or the room becoming part of the weapon.',
      },
      {
        key: 'bluff',
        label: 'Bluff probability',
        value: input.vector.bluffProbability,
        band: bandForScore(input.vector.bluffProbability),
        explanation: 'How likely the attack depends on the player revealing too much rather than the attacker proving too much.',
      },
      {
        key: 'silence',
        label: 'Silence value',
        value: input.vector.silenceValue,
        band: bandForScore(input.vector.silenceValue),
        explanation: 'How valuable a controlled pause would be relative to an immediate visible answer.',
      },
    ];

    return {
      title: 'Threat Radar',
      subtitle: input.channel === DEAL_ROOM_CHANNEL ? 'Negotiation pressure read' : 'Live hostility read',
      severity: input.severity,
      family: input.family,
      primaryColorToken:
        input.severity === 'EXECUTION'
          ? 'danger'
          : input.severity === 'SEVERE'
            ? 'heat'
            : input.severity === 'HOT'
              ? 'warning'
              : 'quiet',
      needles,
      headline: input.summaryLine,
      footer: TELEGRAPH_DEFINITIONS[input.family].explanation,
    };
  }

  private buildCounterplayModal(input: {
    readonly family: ChatAttackTelegraphFamily;
    readonly severity: ChatAttackTelegraphSeverity;
    readonly vector: ChatAttackTelegraphVector;
    readonly telegraphLine: string;
    readonly counterOptions: readonly ChatAttackTelegraphCounterOption[];
    readonly definition: TelegraphDefinition;
    readonly counterWindow: ChatCounterplayWindow;
    readonly channel: ChatVisibleChannel;
    readonly publicWitness: boolean;
  }): ChatAttackTelegraphCounterplayModalModel {
    return {
      title: modalTitleForFamily(input.family),
      subtitle: input.definition.threatLine,
      timerMs: Math.max(0, Number(input.counterWindow.closesAt) - Number(input.counterWindow.opensAt)),
      threatSummary: `Severity ${input.severity} · leverage ${input.vector.leverageDanger} · embarrassment ${input.vector.embarrassmentRisk}`,
      openingLine: input.telegraphLine,
      recommendedOptions: input.counterOptions,
      avoidMoves: input.definition.avoidMoves,
      witnessMode:
        input.channel === DEAL_ROOM_CHANNEL
          ? 'DEAL_ROOM'
          : input.publicWitness
            ? input.channel === 'GLOBAL'
              ? 'CROWD'
              : 'ROOM'
            : 'PRIVATE',
    };
  }

  private buildMomentFlash(
    actorName: string,
    family: ChatAttackTelegraphFamily,
    severity: ChatAttackTelegraphSeverity,
    summaryLine: string,
  ): ChatAttackTelegraphMomentFlashModel {
    return {
      title: actorName,
      subtitle: summaryLine,
      emphasis:
        severity === 'EXECUTION' ? 'critical' : severity === 'SEVERE' ? 'danger' : 'warning',
      family,
      severity,
      actorName,
    };
  }

  private buildProofCard(
    signal: ChatAttackTelegraphSignal,
    vector: ChatAttackTelegraphVector,
    family: ChatAttackTelegraphFamily,
  ): ChatAttackTelegraphProofCardModel {
    return {
      visible: Boolean(signal.proofHash || signal.quoteAnchor || Number(vector.proofExposure) >= 60),
      title: proofCardTitle(family, signal),
      proofHash: signal.proofHash,
      quoteAnchor: signal.quoteAnchor,
      exposureRisk: vector.proofExposure,
      note:
        signal.proofHash || signal.quoteAnchor
          ? 'Receipts or quoted language are likely part of this attack surface.'
          : 'No direct proof reference provided, but the signal shape suggests disclosure pressure.',
    };
  }

  private buildRescueBanner(
    visible: boolean,
    severity: ChatAttackTelegraphSeverity,
    family: ChatAttackTelegraphFamily,
    leadOption?: ChatAttackTelegraphCounterOption,
  ): ChatAttackTelegraphRescueBannerModel {
    return {
      visible,
      title: visible ? 'Counterplay assistance ready' : 'No rescue intervention staged',
      body: visible
        ? `Lead with ${leadOption?.label ?? 'a short stabilizing reply'} if the window starts slipping under pressure.`
        : `${family} remains player-solo unless the next signal materially escalates.`,
      urgency:
        severity === 'EXECUTION' ? 'HIGH' : severity === 'SEVERE' ? 'MEDIUM' : 'LOW',
    };
  }

  private buildPresence(
    family: ChatAttackTelegraphFamily,
    timingClass: ChatAttackTelegraphTimingClass,
    definition: TelegraphDefinition,
    actor: ActorProfile,
    publicWitness: boolean,
    rescueAllowed: boolean,
  ): readonly ChatAttackTelegraphPresenceBeat[] {
    const beats: ChatAttackTelegraphPresenceBeat[] = [];

    beats.push({
      cue: 'PRIMARY_TELEGRAPH',
      actorId: actor.actorId,
      actorName: actor.displayName,
      actorKind: actor.actorKind,
      delayMs: delayFromTimingClass(timingClass, definition.silenceBeforeOpenMs),
      typingMs: timingClass === 'READ_DELAYED' ? 1200 : timingClass === 'SILENCE_PRIMED' ? 0 : 620,
      readDelayMs: timingClass === 'READ_DELAYED' ? 540 : undefined,
      note: 'Bot presence read for the telegraph lane.',
    });

    if (publicWitness) {
      beats.push({
        cue: 'AMBIENT_CROWD',
        actorId: CROWD_ACTOR.actorId,
        actorName: CROWD_ACTOR.displayName,
        actorKind: CROWD_ACTOR.actorKind,
        delayMs: definition.crowdDelayMs,
        typingMs: 0,
        readDelayMs: 0,
        note: 'Crowd witness enters after the primary line becomes legible.',
      });
    }

    if (rescueAllowed) {
      beats.push({
        cue: 'HELPER_WHISPER',
        actorId: HELPER_ACTOR.actorId,
        actorName: HELPER_ACTOR.displayName,
        actorKind: HELPER_ACTOR.actorKind,
        delayMs: definition.helperDelayMs,
        typingMs: 520,
        readDelayMs: 240,
        note: 'Helper waits for pressure to become readable before intervening.',
      });
    }

    if (family === 'SILENCE_LURE') {
      beats.push({
        cue: 'READ_PRESSURE',
        actorId: actor.actorId,
        actorName: actor.displayName,
        actorKind: actor.actorKind,
        delayMs: definition.silenceBeforeOpenMs,
        typingMs: 0,
        readDelayMs: 960,
        note: 'Silence lure uses seen/read timing as visible theater.',
      });
    }

    return beats;
  }

  private buildSummaryLine(
    family: ChatAttackTelegraphFamily,
    severity: ChatAttackTelegraphSeverity,
    vector: ChatAttackTelegraphVector,
    channel: ChatVisibleChannel,
  ): string {
    const familyName = family.replace(/_/g, ' ').toLowerCase();
    if (channel === DEAL_ROOM_CHANNEL) {
      return `${severity.toLowerCase()} ${familyName}; leverage ${vector.leverageDanger}, proof ${vector.proofExposure}.`;
    }
    return `${severity.toLowerCase()} ${familyName}; embarrassment ${vector.embarrassmentRisk}, spectacle ${vector.spectacleRisk}.`;
  }

  private buildTags(
    signal: ChatAttackTelegraphSignal,
    family: ChatAttackTelegraphFamily,
    severity: ChatAttackTelegraphSeverity,
    channel: ChatVisibleChannel,
    publicWitness: boolean,
    rescueAllowed: boolean,
  ): readonly string[] {
    return [
      'chat-telegraph',
      family.toLowerCase(),
      severity.toLowerCase(),
      channel.toLowerCase(),
      publicWitness ? 'witnessed' : 'private',
      rescueAllowed ? 'rescue-on' : 'rescue-off',
      ...(signal.tags ?? []),
    ];
  }

  private buildActorMessage(input: {
    readonly actor: ActorProfile;
    readonly channel: ChatVisibleChannel;
    readonly kind: ChatMessageKind;
    readonly body: string;
    readonly at: UnixMs;
    readonly sceneId: ChatSceneId;
    readonly momentId: ChatMomentId;
    readonly botId?: BotId;
    readonly tags?: readonly string[];
  }): ChatMessage {
    return {
      id: this.ids.nextMessageId('telegraph-actor'),
      channel: input.channel,
      kind: input.kind,
      senderId: input.actor.actorId,
      senderName: input.actor.displayName,
      body: input.body,
      ts: input.at,
      immutable: true,
      sceneId: input.sceneId,
      momentId: input.momentId,
      deliveryState: 'AUTHORITATIVE',
      moderation: {
        state: 'ALLOWED',
        playerVisible: true,
      },
      sender: {
        actorKind: input.actor.actorKind,
        senderRole: input.actor.senderRole,
        senderId: input.actor.actorId,
        senderName: input.actor.displayName,
        isHuman: false,
        isNpc: true,
        isVerifiedSystemVoice: false,
        botId: input.actor.actorKind === 'HATER' ? input.botId : undefined,
      },
      tags: ['chat-telegraph', ...new Set(input.tags ?? [])],
    };
  }

  private buildReveal(
    revealAt: UnixMs,
    revealChannel: ChatVisibleChannel,
    revealReason: ChatRevealSchedule['revealReason'],
    payloadRef: string,
  ): ChatRevealSchedule {
    return {
      revealAt,
      revealChannel,
      revealReason,
      payloadRef,
    };
  }
}

export function createChatAttackTelegraph(
  options: ChatAttackTelegraphOptions = {},
): ChatAttackTelegraph {
  return new ChatAttackTelegraph(options);
}

// ============================================================================
// MARK: Utilities
// ============================================================================

function relationForBot(
  relationshipsByCounterpartId: ChatEngineState['relationshipsByCounterpartId'] | undefined,
  counterpartId: string,
): ChatRelationshipState | undefined {
  if (!relationshipsByCounterpartId) return undefined;
  return relationshipsByCounterpartId[counterpartId];
}

function recentBodiesForChannel(
  state: Pick<ChatEngineState, 'messagesByChannel'> | undefined,
  channel: ChatVisibleChannel,
): readonly string[] {
  const bucket = state?.messagesByChannel?.[channel] ?? [];
  const out: string[] = [];
  for (let i = bucket.length - 1; i >= 0 && out.length < 18; i -= 1) {
    const body = typeof bucket[i]?.body === 'string' ? bucket[i].body.trim() : '';
    if (body.length > 0) out.push(body);
  }
  return out;
}

function pressureTierWeight(tier: PressureTier | undefined): number {
  switch (tier) {
    case 'BREAKPOINT':
      return 32;
    case 'CRITICAL':
      return 24;
    case 'PRESSURED':
      return 16;
    case 'WATCHFUL':
      return 8;
    case 'CALM':
    default:
      return 0;
  }
}

function tickTierWeight(tier: TickTier | undefined): number {
  switch (tier) {
    case 'FINAL':
      return 18;
    case 'LATE':
      return 12;
    case 'MID':
      return 6;
    case 'EARLY':
    default:
      return 0;
  }
}

function toPersonaPressureBand(
  pressureTier: PressureTier | undefined,
  vector: ChatAttackTelegraphVector,
): PersonaPressureBand {
  if (pressureTier === 'BREAKPOINT' || pressureTier === 'CRITICAL' || Number(vector.leverageDanger) >= 76) {
    return 'CRITICAL';
  }
  if (pressureTier === 'PRESSURED' || Number(vector.dominanceSwing) >= 60) return 'HIGH';
  if (pressureTier === 'WATCHFUL' || Number(vector.embarrassmentRisk) >= 42) return 'MEDIUM';
  return 'LOW';
}

function delayFromTimingClass(
  timingClass: ChatAttackTelegraphTimingClass,
  baseSilenceMs: number,
): number {
  switch (timingClass) {
    case 'SILENCE_PRIMED':
      return Math.max(baseSilenceMs, 920);
    case 'READ_DELAYED':
      return Math.max(baseSilenceMs, 620);
    case 'CROWD_STAGGERED':
      return Math.max(baseSilenceMs, 180);
    case 'HELPER_STAGGERED':
      return Math.max(baseSilenceMs, 220);
    case 'INSTANT':
    default:
      return Math.max(0, baseSilenceMs);
  }
}

function counterHintFromVector(
  vector: ChatAttackTelegraphVector,
  channel: ChatVisibleChannel,
): string {
  if (channel === DEAL_ROOM_CHANNEL) {
    if (Number(vector.proofExposure) >= 68) return 'Protect leverage. Do not volunteer receipts by reflex.';
    if (Number(vector.leverageDanger) >= 72) return 'Short answer or disciplined exit. Do not leak urgency.';
    return 'Keep negotiation language colder than the attack wants.';
  }
  if (Number(vector.embarrassmentRisk) >= 72) return 'Protect posture first. The room is part of the attack.';
  if (Number(vector.silenceValue) >= 72) return 'A controlled pause may beat an immediate visible answer.';
  if (Number(vector.bluffProbability) >= 68) return 'Ask them to show more than they want you to show.';
  return 'Counter the structure of the line, not the sting of the wording.';
}

function intentLabel(intent: ChatAttackTelegraphIntent): string {
  switch (intent) {
    case 'ASSERT':
      return 'Hold posture';
    case 'STABILIZE':
      return 'Stabilize';
    case 'DEFLECT':
      return 'Shift frame';
    case 'REVERSE':
      return 'Reverse pressure';
    case 'CALL_BLUFF':
      return 'Call bluff';
    case 'WITHDRAW':
      return 'Exit clean';
    case 'SILENT_HOLD':
      return 'Use silence';
    case 'PROTECT_DIGNITY':
      return 'Protect dignity';
    default:
      return intent;
  }
}

function intentPrompt(
  intent: ChatAttackTelegraphIntent,
  family: ChatAttackTelegraphFamily,
  channel: ChatVisibleChannel,
): string {
  switch (intent) {
    case 'ASSERT':
      return channel === DEAL_ROOM_CHANNEL
        ? 'Not moving on that framing. Keep the line narrower.'
        : 'That read is weak. Stay on the actual board.';
    case 'STABILIZE':
      return 'Short answer. No panic leak. No extra surface.';
    case 'DEFLECT':
      return 'That is spectacle, not substance. Pick a cleaner angle.';
    case 'REVERSE':
      return family === 'QUOTE_TRAP'
        ? 'Interesting. You needed my old line because your current one cannot carry itself.'
        : 'You are leaning harder on theater than leverage.';
    case 'CALL_BLUFF':
      return 'Then show the proof you are hoping I volunteer for you.';
    case 'WITHDRAW':
      return channel === DEAL_ROOM_CHANNEL
        ? 'Bad window. Not pricing this under your tempo.'
        : 'Not feeding this beat. Continue.';
    case 'SILENT_HOLD':
      return '...';
    case 'PROTECT_DIGNITY':
      return 'You can keep the noise. I am keeping posture.';
    default:
      return 'Hold structure.';
  }
}

function intentReason(
  intent: ChatAttackTelegraphIntent,
  vector: ChatAttackTelegraphVector,
  channel: ChatVisibleChannel,
): string {
  switch (intent) {
    case 'ASSERT':
      return Number(vector.dominanceSwing) >= 60
        ? 'Useful when the attack is trying to seize visible social authority.'
        : 'Useful for denying the attacker a clean read of instability.';
    case 'STABILIZE':
      return Number(vector.leverageDanger) >= 60 || channel === DEAL_ROOM_CHANNEL
        ? 'Best when leverage matters more than spectacle.'
        : 'Best when you need the next line to reduce volatility instead of winning applause.';
    case 'DEFLECT':
      return Number(vector.spectacleRisk) >= 58
        ? 'Useful when the attack depends on keeping you inside its frame.'
        : 'Useful when the room is being recruited into the attack.';
    case 'REVERSE':
      return Number(vector.bluffProbability) >= 56
        ? 'Useful when the attacker is leaning on setup more than substance.'
        : 'Useful when you can make their own geometry look expensive.';
    case 'CALL_BLUFF':
      return Number(vector.proofExposure) >= 52
        ? 'Useful when disclosure pressure is the real weapon.'
        : 'Useful when the opponent is implying more proof than they want to show.';
    case 'WITHDRAW':
      return Number(vector.leverageDanger) >= 68
        ? 'Useful when the window itself is bad and the cleanest move is refusal.'
        : 'Useful when continuing only rewards spectacle.';
    case 'SILENT_HOLD':
      return Number(vector.silenceValue) >= 64
        ? 'Useful when silence is more legible than any hurried visible answer.'
        : 'Useful only if your posture can survive the empty beat.';
    case 'PROTECT_DIGNITY':
      return Number(vector.embarrassmentRisk) >= 60
        ? 'Useful when the true target is visible humiliation, not strategic substance.'
        : 'Useful when the room is trying to convert posture into spectacle.';
    default:
      return 'Contextual use.';
  }
}

function modalTitleForFamily(family: ChatAttackTelegraphFamily): string {
  switch (family) {
    case 'QUOTE_TRAP':
      return 'Quote trap detected';
    case 'DEADLINE_PIN':
      return 'Clock pressure detected';
    case 'CROWD_BAIT':
      return 'Crowd bait forming';
    case 'DEAL_ROOM_SQUEEZE':
      return 'Deal squeeze detected';
    case 'FALSE_MERCY':
      return 'False mercy line';
    case 'HELPER_DENIAL':
      return 'Support disruption detected';
    case 'SILENCE_LURE':
      return 'Silence lure detected';
    case 'SHIELD_SHATTER':
      return 'Shield-state pressure';
    case 'REPUTATION_STRIKE':
      return 'Reputation strike forming';
    case 'BLUFF_EXTRACTION':
      return 'Bluff extraction attempt';
    case 'FINAL_WORD_DUEL':
      return 'Closing authority contested';
    case 'MARGIN_SNAP':
    default:
      return 'Pressure telegraph detected';
  }
}

function proofCardTitle(
  family: ChatAttackTelegraphFamily,
  signal: ChatAttackTelegraphSignal,
): string {
  if (signal.proofHash) return 'Proof exposure live';
  if (signal.quoteAnchor) return 'Quote anchor live';
  return `${family.replace(/_/g, ' ')} evidence pressure`;
}

function pickByTime(values: readonly string[], now: number): string {
  if (values.length === 0) return '';
  return values[Math.abs(Math.floor(now)) % values.length];
}

function bandForScore(value: Score100): 'LOW' | 'ELEVATED' | 'HIGH' | 'MAX' {
  const n = Number(value);
  if (n >= 85) return 'MAX';
  if (n >= 65) return 'HIGH';
  if (n >= 40) return 'ELEVATED';
  return 'LOW';
}

function toScore100(value: number): Score100 {
  if (!Number.isFinite(value)) return 0 as Score100;
  return Math.max(0, Math.min(100, Math.round(value))) as Score100;
}
