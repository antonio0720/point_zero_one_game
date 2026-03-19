/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT BOSS FIGHT CONTROLLER
 * FILE: pzo-web/src/engines/chat/combat/ChatBossFightController.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Turns hostile chat pressure into an authored conversational encounter.
 *
 * This module does not replace the rest of the chat engine. It sits inside it.
 * Its job is to:
 * - convert battle/chat signals into a boss-fight scene,
 * - open a counterplay window for the player,
 * - generate telegraph / punishment / retreat / helper beats,
 * - keep the result compatible with ChatState mutation helpers,
 * - preserve the repo's existing message kinds, channel rules, and scene flow.
 *
 * Design doctrine
 * ---------------
 * - Language can be an attack surface.
 * - Not every taunt is cosmetic; some are telegraphs.
 * - A good counter is both a gameplay answer and a social answer.
 * - Helpers should rescue timing, not erase consequence.
 * - The crowd should witness outcomes when the channel allows it.
 *
 * This file remains deterministic and frontend-safe. It plans and scores. It does
 * not claim authoritative transcript ownership; backend combat authority will
 * later finalize outcomes.
 * ============================================================================
 */

import type { BotId } from '../../battle/types';
import {
  type ChatActorKind,
  type ChatAffectSnapshot,
  type ChatAudienceHeat,
  type ChatChannelMood,
  type ChatCounterplayWindow,
  type ChatEngineState,
  type ChatMessage,
  type ChatMessageId,
  type ChatMessageKind,
  type ChatMomentId,
  type ChatRelationshipState,
  type ChatRevealSchedule,
  type ChatSceneBeat,
  type ChatScenePlan,
  type ChatSceneId,
  type ChatSilenceDecision,
  type ChatVisibleChannel,
  type PressureTier,
  type Score100,
  type TickTier,
  type UnixMs,
} from '../types';
import { buildLocalSystemMessage } from '../ChatState';
import {
  createChatBotResponseDirector,
  type BotLineCategory,
  type PersonaPressureBand,
} from '../ChatBotResponseDirector';

// ============================================================================
// MARK: Public contracts
// ============================================================================

export type ChatBossFightPattern =
  | 'OPENING_TELEGRAPH'
  | 'ESCALATION_BAIT'
  | 'DEADLINE_PRESSURE'
  | 'SOCIAL_AMBUSH'
  | 'MIRROR_TRAP'
  | 'CROWD_EXECUTION';

export type ChatBossFightPhase =
  | 'TELEGRAPH'
  | 'WINDOW_OPEN'
  | 'PLAYER_RESPONSE'
  | 'RESOLUTION'
  | 'ENDED';

export type ChatCounterIntent =
  | 'DEFLECT'
  | 'REVERSE'
  | 'CALL_BLUFF'
  | 'STABILIZE'
  | 'WITHDRAW'
  | 'ASSERT';

export type ChatCounterQuality = 'PERFECT' | 'STRONG' | 'WEAK' | 'FAILED' | 'EXPIRED';

export interface ChatBossFightDescriptor {
  readonly fightId: string;
  readonly sceneId: ChatSceneId;
  readonly momentId: ChatMomentId;
  readonly channel: ChatVisibleChannel;
  readonly botId: BotId;
  readonly pattern: ChatBossFightPattern;
  readonly phase: ChatBossFightPhase;
  readonly startedAt: UnixMs;
  readonly threatScore: Score100;
  readonly embarrassmentRisk: Score100;
  readonly helperAllowed: boolean;
  readonly crowdWitness: boolean;
  readonly openingReason: string;
  readonly tags: readonly string[];
}

export interface ChatBossFightSignal {
  readonly channel?: ChatVisibleChannel;
  readonly botId: BotId;
  readonly reason: string;
  readonly bodyHint?: string;
  readonly pressureTier?: PressureTier;
  readonly tickTier?: TickTier;
  readonly proofHash?: string;
  readonly forceCrowdWitness?: boolean;
  readonly forceHelper?: boolean;
  readonly tags?: readonly string[];
}

export interface ChatBossFightPlanningInput {
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
  readonly signal: ChatBossFightSignal;
  readonly now?: UnixMs;
}

export interface ChatBossFightPlan {
  readonly descriptor: ChatBossFightDescriptor;
  readonly scene: ChatScenePlan;
  readonly immediateMessages: readonly ChatMessage[];
  readonly delayedMessages: readonly ChatBossFightDelayedMessage[];
  readonly counterWindow: ChatCounterplayWindow;
  readonly silence?: ChatSilenceDecision;
  readonly audienceHeatPatch?: Partial<Record<ChatVisibleChannel, Partial<ChatAudienceHeat>>>;
  readonly moodPatch?: readonly ChatChannelMood[];
  readonly notes: readonly string[];
}

export interface ChatBossFightDelayedMessage {
  readonly schedule: ChatRevealSchedule;
  readonly message: ChatMessage;
}

export interface ChatBossFightReplyInput {
  readonly descriptor: ChatBossFightDescriptor;
  readonly counterWindow: ChatCounterplayWindow;
  readonly playerMessage: ChatMessage;
  readonly state?: Pick<
    ChatEngineState,
    | 'messagesByChannel'
    | 'audienceHeat'
    | 'channelMoodByChannel'
    | 'relationshipsByCounterpartId'
    | 'affect'
  >;
  readonly now?: UnixMs;
}

export interface ChatBossFightResolution {
  readonly descriptor: ChatBossFightDescriptor;
  readonly quality: ChatCounterQuality;
  readonly intent: ChatCounterIntent;
  readonly score: number;
  readonly phase: ChatBossFightPhase;
  readonly sceneComplete: boolean;
  readonly immediateMessages: readonly ChatMessage[];
  readonly delayedMessages: readonly ChatBossFightDelayedMessage[];
  readonly audienceHeatPatch?: Partial<Record<ChatVisibleChannel, Partial<ChatAudienceHeat>>>;
  readonly moodPatch?: readonly ChatChannelMood[];
  readonly relationshipShift?: readonly ChatRelationshipDelta[];
  readonly notes: readonly string[];
}

export interface ChatRelationshipDelta {
  readonly counterpartId: string;
  readonly respectDelta: number;
  readonly fearDelta: number;
  readonly contemptDelta: number;
  readonly fascinationDelta: number;
  readonly trustDelta: number;
  readonly rivalryDelta: number;
  readonly rescueDebtDelta: number;
}

export interface ChatBossFightExpireInput {
  readonly descriptor: ChatBossFightDescriptor;
  readonly counterWindow: ChatCounterplayWindow;
  readonly state?: Pick<ChatEngineState, 'audienceHeat' | 'channelMoodByChannel'>;
  readonly now?: UnixMs;
}

export interface ChatBossFightControllerOptions {
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

interface PatternDefinition {
  readonly pattern: ChatBossFightPattern;
  readonly windowMs: number;
  readonly preferredCounterIntents: readonly ChatCounterIntent[];
  readonly preferredBotLineCategory: BotLineCategory;
  readonly helperIntent: 'COACH' | 'CALM' | 'WARN' | 'SIMPLIFY';
  readonly crowdEscalation: number;
  readonly ridiculeEscalation: number;
  readonly scrutinyEscalation: number;
  readonly volatilityEscalation: number;
  readonly silenceBeforeWindowMs: number;
}

const DEFAULT_CHANNEL: ChatVisibleChannel = 'GLOBAL';
const CROWD_CHANNELS: readonly ChatVisibleChannel[] = ['GLOBAL', 'SYNDICATE', 'LOBBY'];
const DEAL_ROOM_CHANNEL: ChatVisibleChannel = 'DEAL_ROOM';

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

const PATTERNS: Readonly<Record<ChatBossFightPattern, PatternDefinition>> = Object.freeze({
  OPENING_TELEGRAPH: {
    pattern: 'OPENING_TELEGRAPH',
    windowMs: 7200,
    preferredCounterIntents: ['ASSERT', 'STABILIZE', 'CALL_BLUFF'],
    preferredBotLineCategory: 'telegraph',
    helperIntent: 'COACH',
    crowdEscalation: 8,
    ridiculeEscalation: 3,
    scrutinyEscalation: 9,
    volatilityEscalation: 5,
    silenceBeforeWindowMs: 0,
  },
  ESCALATION_BAIT: {
    pattern: 'ESCALATION_BAIT',
    windowMs: 6800,
    preferredCounterIntents: ['DEFLECT', 'REVERSE', 'STABILIZE'],
    preferredBotLineCategory: 'taunt',
    helperIntent: 'WARN',
    crowdEscalation: 10,
    ridiculeEscalation: 8,
    scrutinyEscalation: 6,
    volatilityEscalation: 7,
    silenceBeforeWindowMs: 500,
  },
  DEADLINE_PRESSURE: {
    pattern: 'DEADLINE_PRESSURE',
    windowMs: 5200,
    preferredCounterIntents: ['STABILIZE', 'WITHDRAW', 'ASSERT'],
    preferredBotLineCategory: 'telegraph',
    helperIntent: 'SIMPLIFY',
    crowdEscalation: 5,
    ridiculeEscalation: 2,
    scrutinyEscalation: 11,
    volatilityEscalation: 4,
    silenceBeforeWindowMs: 900,
  },
  SOCIAL_AMBUSH: {
    pattern: 'SOCIAL_AMBUSH',
    windowMs: 6400,
    preferredCounterIntents: ['DEFLECT', 'REVERSE', 'ASSERT'],
    preferredBotLineCategory: 'taunt',
    helperIntent: 'PROTECT_DIGNITY' as never,
    crowdEscalation: 13,
    ridiculeEscalation: 12,
    scrutinyEscalation: 8,
    volatilityEscalation: 10,
    silenceBeforeWindowMs: 0,
  },
  MIRROR_TRAP: {
    pattern: 'MIRROR_TRAP',
    windowMs: 7600,
    preferredCounterIntents: ['CALL_BLUFF', 'REVERSE', 'WITHDRAW'],
    preferredBotLineCategory: 'telegraph',
    helperIntent: 'WARN',
    crowdEscalation: 6,
    ridiculeEscalation: 7,
    scrutinyEscalation: 10,
    volatilityEscalation: 6,
    silenceBeforeWindowMs: 650,
  },
  CROWD_EXECUTION: {
    pattern: 'CROWD_EXECUTION',
    windowMs: 5800,
    preferredCounterIntents: ['ASSERT', 'REVERSE', 'STABILIZE'],
    preferredBotLineCategory: 'taunt',
    helperIntent: 'CALM',
    crowdEscalation: 16,
    ridiculeEscalation: 14,
    scrutinyEscalation: 12,
    volatilityEscalation: 11,
    silenceBeforeWindowMs: 300,
  },
});

const HELPER_LINES = Object.freeze({
  COACH: Object.freeze([
    'Read the opening as a telegraph, not a verdict.',
    'Do not answer their energy. Answer their structure.',
    'Win the timing window first. The room follows later.',
  ]),
  CALM: Object.freeze([
    'A short pause is still control when you choose it.',
    'Do not let their urgency decide your language.',
    'You still own the next line. Breathe once and take it.',
  ]),
  WARN: Object.freeze([
    'They want emotion on record. Deny them that evidence.',
    'One sloppy sentence turns pressure into humiliation.',
    'Do not decorate your reply. Tight language only.',
  ]),
  SIMPLIFY: Object.freeze([
    'Use one clean sentence. Protect the line.',
    'Counter the claim, not the whole theater around it.',
    'Your best move is smaller than your feelings want.',
  ]),
  PROTECT_DIGNITY: Object.freeze([
    'You do not owe the room a dramatic confession.',
    'Recover without kneeling to spectators.',
    'Hold posture. Let the answer stay lean.',
  ]),
} as const);

const CROWD_LINES = Object.freeze({
  hype: Object.freeze([
    'The room leaned forward on that one.',
    'Witnesses locked in. Nobody is blinking now.',
    'Pressure climbed the moment that line landed.',
  ]),
  ridicule: Object.freeze([
    'The room smelled blood in that pause.',
    'Witnesses heard weakness and moved closer.',
    'The crowd is circling this exchange now.',
  ]),
  respect: Object.freeze([
    'The room noticed the discipline in that answer.',
    'Witnesses did not get the collapse they wanted.',
    'The crowd recalculated after that response.',
  ]),
  quiet: Object.freeze([
    'The room went quiet enough to matter.',
    'Nobody posted. Everyone watched.',
    'The silence landed harder than chatter would have.',
  ]),
} as const);

// ============================================================================
// MARK: Controller
// ============================================================================

export class ChatBossFightController {
  private readonly nowFn: () => number;
  private readonly responseDirector: ReturnType<typeof createChatBotResponseDirector>;
  private readonly ids: IdFactory;
  private idCounter = 0;

  constructor(options: ChatBossFightControllerOptions = {}) {
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

  planEncounter(input: ChatBossFightPlanningInput): ChatBossFightPlan {
    const now = (input.now ?? this.nowFn()) as UnixMs;
    const channel = input.signal.channel ?? input.state?.activeVisibleChannel ?? DEFAULT_CHANNEL;
    const pattern = this.pickPattern(input.signal, channel, input.state?.audienceHeat?.[channel], input.state?.affect);
    const patternDef = PATTERNS[pattern];
    const pressureBand = toPersonaPressureBand(input.signal.pressureTier, input.state?.affect);
    const sceneId = this.ids.nextSceneId('chat-boss-fight');
    const momentId = this.ids.nextMomentId('chat-boss-fight');
    const threatScore = computeThreatScore(input.signal, input.state?.affect, input.state?.channelMoodByChannel?.[channel]);
    const embarrassmentRisk = computeEmbarrassmentRisk(channel, input.state?.audienceHeat?.[channel], input.state?.affect);
    const helperAllowed = input.signal.forceHelper === true || shouldOfferHelper(input.state?.affect, channel, embarrassmentRisk);
    const crowdWitness = input.signal.forceCrowdWitness === true || shouldUseCrowd(channel, input.state?.audienceHeat?.[channel]);

    const descriptor: ChatBossFightDescriptor = {
      fightId: this.ids.next('chat-boss-fight'),
      sceneId,
      momentId,
      channel,
      botId: input.signal.botId,
      pattern,
      phase: 'WINDOW_OPEN',
      startedAt: now,
      threatScore,
      embarrassmentRisk,
      helperAllowed,
      crowdWitness,
      openingReason: input.signal.reason,
      tags: [...(input.signal.tags ?? [])],
    };

    const counterWindow: ChatCounterplayWindow = {
      opensAt: (now + patternDef.silenceBeforeWindowMs) as UnixMs,
      closesAt: (now + patternDef.silenceBeforeWindowMs + patternDef.windowMs) as UnixMs,
      reason: channel === DEAL_ROOM_CHANNEL ? 'DEAL_ROOM_TRAP' : 'HATER_TELEGRAPH',
      playerFacingHint: this.buildPlayerHint(pattern, channel),
    };

    const scene: ChatScenePlan = {
      sceneId,
      momentId,
      momentType: 'BOT_ATTACK',
      primaryChannel: channel,
      beats: this.buildSceneBeats(channel, descriptor, counterWindow),
      startedAt: now,
      expectedDurationMs: patternDef.windowMs + patternDef.silenceBeforeWindowMs + 2000,
      allowPlayerComposerDuringScene: true,
      cancellableByAuthoritativeEvent: true,
    };

    const immediateMessages: ChatMessage[] = [];
    const delayedMessages: ChatBossFightDelayedMessage[] = [];

    immediateMessages.push(
      buildLocalSystemMessage({
        id: this.ids.nextMessageId('bossfight'),
        channel,
        kind: 'SYSTEM',
        body: `CHAT BOSS FIGHT: ${BOT_ACTORS[input.signal.botId].displayName} is probing your line. Counter window opening.`,
        at: now,
        proofHash: input.signal.proofHash,
        pressureTier: input.signal.pressureTier,
        tickTier: input.signal.tickTier,
        tags: ['chat-boss-fight', 'telegraph', pattern],
      }),
    );

    const openerAt = (now + patternDef.silenceBeforeWindowMs) as UnixMs;
    const opener = this.buildBotMessage({
      descriptor,
      category: patternDef.preferredBotLineCategory,
      bodyHint: input.signal.bodyHint,
      at: openerAt,
      pressureBand,
      kind: patternDef.preferredBotLineCategory === 'telegraph' ? 'HATER_TELEGRAPH' : 'BOT_TAUNT',
    });

    if (patternDef.silenceBeforeWindowMs <= 0) {
      immediateMessages.push(opener);
    } else {
      delayedMessages.push({
        schedule: this.buildReveal(openerAt, channel, 'SCENE_STAGING', opener.id),
        message: opener,
      });
    }

    if (crowdWitness) {
      const crowdAt = (counterWindow.opensAt + Math.min(900, Math.floor(patternDef.windowMs * 0.18))) as UnixMs;
      delayedMessages.push({
        schedule: this.buildReveal(crowdAt, channel, 'SCENE_STAGING', this.ids.next('crowd-reveal')),
        message: this.buildCrowdMessage(
          descriptor,
          pattern === 'CROWD_EXECUTION' || pattern === 'SOCIAL_AMBUSH' ? 'ridicule' : 'hype',
          crowdAt,
        ),
      });
    }

    if (helperAllowed) {
      const helperAt = (counterWindow.opensAt + Math.min(1500, Math.floor(patternDef.windowMs * 0.32))) as UnixMs;
      delayedMessages.push({
        schedule: this.buildReveal(helperAt, channel, 'DELAYED_HELPER', this.ids.next('helper-reveal')),
        message: this.buildHelperMessage(descriptor, patternDef.helperIntent, helperAt),
      });
    }

    const silence = patternDef.silenceBeforeWindowMs > 0
      ? {
          enforced: true,
          durationMs: patternDef.silenceBeforeWindowMs,
          reason: channel === DEAL_ROOM_CHANNEL ? 'NEGOTIATION_PRESSURE' : 'SCENE_COMPOSITION',
          breakConditions: ['PLAYER_SEND', 'AUTHORITATIVE_BATTLE_EVENT', 'RESCUE_TRIGGER'],
        } satisfies ChatSilenceDecision
      : undefined;

    return {
      descriptor,
      scene,
      immediateMessages,
      delayedMessages,
      counterWindow,
      silence,
      audienceHeatPatch: {
        [channel]: {
          channelId: channel,
          heat: toScore100(patternDef.crowdEscalation + Number(input.state?.audienceHeat?.[channel]?.heat ?? 0)),
          hype: toScore100(Number(input.state?.audienceHeat?.[channel]?.hype ?? 0) + Math.floor(patternDef.crowdEscalation / 2)),
          ridicule: toScore100(Number(input.state?.audienceHeat?.[channel]?.ridicule ?? 0) + patternDef.ridiculeEscalation),
          scrutiny: toScore100(Number(input.state?.audienceHeat?.[channel]?.scrutiny ?? 0) + patternDef.scrutinyEscalation),
          volatility: toScore100(Number(input.state?.audienceHeat?.[channel]?.volatility ?? 0) + patternDef.volatilityEscalation),
          lastUpdatedAt: now,
        },
      },
      moodPatch: [
        {
          channelId: channel,
          mood: channel === DEAL_ROOM_CHANNEL ? 'PREDATORY' : 'HOSTILE',
          reason: `Chat boss fight opened: ${pattern}`,
          updatedAt: now,
        },
      ],
      notes: [
        `pattern:${pattern}`,
        `helper:${helperAllowed ? 'on' : 'off'}`,
        `crowd:${crowdWitness ? 'on' : 'off'}`,
        `threat:${threatScore}`,
        `embarrassment:${embarrassmentRisk}`,
      ],
    };
  }

  evaluateReply(input: ChatBossFightReplyInput): ChatBossFightResolution {
    const now = (input.now ?? this.nowFn()) as UnixMs;
    const expired = now > input.counterWindow.closesAt;
    if (expired) {
      return this.resolveExpiry({
        descriptor: input.descriptor,
        counterWindow: input.counterWindow,
        state: input.state,
        now,
      });
    }

    const content = normalizeBody(input.playerMessage.body);
    const intent = this.inferIntent(content, input.descriptor.pattern);
    const score = this.scoreReply(content, intent, input.descriptor, input.state?.affect);
    const quality = scoreToQuality(score, input.descriptor.pattern, intent);
    const channel = input.descriptor.channel;
    const immediateMessages: ChatMessage[] = [];
    const delayedMessages: ChatBossFightDelayedMessage[] = [];
    const botActor = BOT_ACTORS[input.descriptor.botId];

    if (quality === 'PERFECT' || quality === 'STRONG') {
      immediateMessages.push(
        this.buildActorMessage({
          actor: botActor,
          channel,
          kind: 'BOT_ATTACK',
          body: this.responseDirector.pick(input.descriptor.botId, 'retreat', {
            now,
            category: 'retreat',
            pressureBand: 'CRITICAL',
            preferredTags: ['withdraw', 'reassess'],
            recentBodies: recentBodiesForChannel(input.state, channel),
          }),
          at: now,
          descriptor: input.descriptor,
          tags: ['boss-fight', 'counter-success', quality.toLowerCase()],
        }),
      );

      if (input.descriptor.crowdWitness) {
        delayedMessages.push({
          schedule: this.buildReveal((now + 420) as UnixMs, channel, 'SCENE_STAGING', this.ids.next('crowd-respect')),
          message: this.buildCrowdMessage(input.descriptor, 'respect', (now + 420) as UnixMs),
        });
      }
    } else {
      immediateMessages.push(
        this.buildActorMessage({
          actor: botActor,
          channel,
          kind: 'HATER_PUNISH',
          body: this.responseDirector.pick(input.descriptor.botId, 'taunt', {
            now,
            category: 'taunt',
            pressureBand: 'CRITICAL',
            preferredTags: ['pressure', 'collapse'],
            recentBodies: recentBodiesForChannel(input.state, channel),
          }),
          at: now,
          descriptor: input.descriptor,
          tags: ['boss-fight', 'counter-failed', quality.toLowerCase()],
        }),
      );

      if (input.descriptor.helperAllowed) {
        delayedMessages.push({
          schedule: this.buildReveal((now + 520) as UnixMs, channel, 'DELAYED_HELPER', this.ids.next('helper-recovery')),
          message: this.buildHelperMessage(
            input.descriptor,
            quality === 'FAILED' ? 'CALM' : 'SIMPLIFY',
            (now + 520) as UnixMs,
          ),
        });
      }
    }

    return {
      descriptor: {
        ...input.descriptor,
        phase: 'RESOLUTION',
      },
      quality,
      intent,
      score,
      phase: 'RESOLUTION',
      sceneComplete: true,
      immediateMessages,
      delayedMessages,
      audienceHeatPatch: {
        [channel]: {
          channelId: channel,
          heat: toScore100(deltaFromQuality(input.state?.audienceHeat?.[channel]?.heat, quality, 0, 6)),
          hype: toScore100(deltaFromQuality(input.state?.audienceHeat?.[channel]?.hype, quality, 6, 2)),
          ridicule: toScore100(deltaFromQuality(input.state?.audienceHeat?.[channel]?.ridicule, quality, -5, 8)),
          scrutiny: toScore100(deltaFromQuality(input.state?.audienceHeat?.[channel]?.scrutiny, quality, -1, 4)),
          volatility: toScore100(deltaFromQuality(input.state?.audienceHeat?.[channel]?.volatility, quality, -2, 6)),
          lastUpdatedAt: now,
        },
      },
      moodPatch: [
        {
          channelId: channel,
          mood: quality === 'PERFECT' || quality === 'STRONG'
            ? 'ECSTATIC'
            : channel === DEAL_ROOM_CHANNEL
              ? 'PREDATORY'
              : 'HOSTILE',
          reason:
            quality === 'PERFECT' || quality === 'STRONG'
              ? `Player counter landed: ${quality}`
              : `Player counter faltered: ${quality}`,
          updatedAt: now,
        },
      ],
      relationshipShift: [
        {
          counterpartId: botActor.actorId,
          respectDelta: quality === 'PERFECT' ? 10 : quality === 'STRONG' ? 5 : -2,
          fearDelta: quality === 'PERFECT' ? -7 : quality === 'STRONG' ? -4 : 5,
          contemptDelta: quality === 'WEAK' || quality === 'FAILED' ? 7 : -3,
          fascinationDelta: quality === 'PERFECT' ? 8 : quality === 'STRONG' ? 4 : 1,
          trustDelta: 0,
          rivalryDelta: 6,
          rescueDebtDelta: 0,
        },
      ],
      notes: [
        `intent:${intent}`,
        `quality:${quality}`,
        `score:${score}`,
      ],
    };
  }

  resolveExpiry(input: ChatBossFightExpireInput): ChatBossFightResolution {
    const now = (input.now ?? this.nowFn()) as UnixMs;
    const channel = input.descriptor.channel;

    return {
      descriptor: {
        ...input.descriptor,
        phase: 'ENDED',
      },
      quality: 'EXPIRED',
      intent: 'WITHDRAW',
      score: 0,
      phase: 'ENDED',
      sceneComplete: true,
      immediateMessages: [
        this.buildActorMessage({
          actor: BOT_ACTORS[input.descriptor.botId],
          channel,
          kind: 'HATER_PUNISH',
          body: 'Window closed. The room recorded the hesitation before it recorded anything else.',
          at: now,
          descriptor: input.descriptor,
          tags: ['boss-fight', 'expired-window'],
        }),
      ],
      delayedMessages: input.descriptor.helperAllowed
        ? [
            {
              schedule: this.buildReveal((now + 700) as UnixMs, channel, 'DELAYED_HELPER', this.ids.next('helper-expired')),
              message: this.buildHelperMessage(input.descriptor, 'PROTECT_DIGNITY' as never, (now + 700) as UnixMs),
            },
          ]
        : [],
      audienceHeatPatch: {
        [channel]: {
          channelId: channel,
          heat: toScore100(Number(input.state?.audienceHeat?.[channel]?.heat ?? 0) + 4),
          hype: toScore100(Number(input.state?.audienceHeat?.[channel]?.hype ?? 0) + 1),
          ridicule: toScore100(Number(input.state?.audienceHeat?.[channel]?.ridicule ?? 0) + 10),
          scrutiny: toScore100(Number(input.state?.audienceHeat?.[channel]?.scrutiny ?? 0) + 7),
          volatility: toScore100(Number(input.state?.audienceHeat?.[channel]?.volatility ?? 0) + 6),
          lastUpdatedAt: now,
        },
      },
      moodPatch: [
        {
          channelId: channel,
          mood: channel === DEAL_ROOM_CHANNEL ? 'PREDATORY' : 'HOSTILE',
          reason: 'Counterplay window expired without response.',
          updatedAt: now,
        },
      ],
      relationshipShift: [
        {
          counterpartId: BOT_ACTORS[input.descriptor.botId].actorId,
          respectDelta: -4,
          fearDelta: 6,
          contemptDelta: 5,
          fascinationDelta: 1,
          trustDelta: 0,
          rivalryDelta: 4,
          rescueDebtDelta: 3,
        },
      ],
      notes: ['intent:WITHDRAW', 'quality:EXPIRED', 'score:0'],
    };
  }

  private buildSceneBeats(
    channel: ChatVisibleChannel,
    descriptor: ChatBossFightDescriptor,
    counterWindow: ChatCounterplayWindow,
  ): readonly ChatSceneBeat[] {
    const patternDef = PATTERNS[descriptor.pattern];
    const beats: ChatSceneBeat[] = [];

    beats.push({
      beatType: 'SYSTEM_NOTICE',
      actorId: 'SYSTEM',
      delayMs: 0,
      requiredChannel: channel,
      skippable: false,
      canInterrupt: true,
      payloadHint: 'Combat notice',
    });

    if (patternDef.silenceBeforeWindowMs > 0) {
      beats.push({
        beatType: 'SILENCE',
        actorId: descriptor.fightId,
        delayMs: patternDef.silenceBeforeWindowMs,
        requiredChannel: channel,
        skippable: true,
        canInterrupt: true,
        payloadHint: 'Silence before telegraph',
      });
    }

    beats.push({
      beatType: 'HATER_ENTRY',
      actorId: BOT_ACTORS[descriptor.botId].actorId,
      delayMs: patternDef.silenceBeforeWindowMs,
      requiredChannel: channel,
      skippable: false,
      canInterrupt: true,
      payloadHint: descriptor.pattern,
    });

    beats.push({
      beatType: 'PLAYER_REPLY_WINDOW',
      actorId: 'player',
      delayMs: Math.max(0, counterWindow.closesAt - counterWindow.opensAt),
      requiredChannel: channel,
      skippable: false,
      canInterrupt: true,
      payloadHint: counterWindow.reason,
    });

    if (descriptor.crowdWitness) {
      beats.push({
        beatType: 'CROWD_SWARM',
        actorId: CROWD_ACTOR.actorId,
        delayMs: Math.min(900, Math.floor(patternDef.windowMs * 0.18)),
        requiredChannel: channel,
        skippable: true,
        canInterrupt: true,
        payloadHint: 'Crowd witness',
      });
    }

    if (descriptor.helperAllowed) {
      beats.push({
        beatType: 'HELPER_INTERVENTION',
        actorId: HELPER_ACTOR.actorId,
        delayMs: Math.min(1500, Math.floor(patternDef.windowMs * 0.32)),
        requiredChannel: channel,
        skippable: true,
        canInterrupt: true,
        payloadHint: 'Counter hint',
      });
    }

    return beats;
  }

  private buildPlayerHint(pattern: ChatBossFightPattern, channel: ChatVisibleChannel): string {
    switch (pattern) {
      case 'DEADLINE_PRESSURE':
        return channel === DEAL_ROOM_CHANNEL
          ? 'Short counter. No urgency leak. Protect leverage.'
          : 'Do not overshare. Answer the clock, not the insult.';
      case 'MIRROR_TRAP':
        return 'They are trying to use your own framing against you. Cut the mirror.';
      case 'SOCIAL_AMBUSH':
        return 'The room is part of the attack. Preserve posture and deny spectacle.';
      case 'CROWD_EXECUTION':
        return 'This is public pressure. One clean line beats emotional volume.';
      case 'ESCALATION_BAIT':
        return 'They want a bigger emotional answer than the board requires.';
      case 'OPENING_TELEGRAPH':
      default:
        return 'Treat the message as a telegraph. Counter the structure, not the sting.';
    }
  }

  private pickPattern(
    signal: ChatBossFightSignal,
    channel: ChatVisibleChannel,
    audienceHeat?: ChatAudienceHeat,
    affect?: ChatAffectSnapshot,
  ): ChatBossFightPattern {
    if (channel === DEAL_ROOM_CHANNEL) return signal.reason.toLowerCase().includes('deadline') ? 'DEADLINE_PRESSURE' : 'MIRROR_TRAP';
    const ridicule = Number(audienceHeat?.ridicule ?? 0);
    const volatility = Number(audienceHeat?.volatility ?? 0);
    const embarrassment = Number(affect?.vector.embarrassment ?? 0);
    const frustration = Number(affect?.vector.frustration ?? 0);

    if (ridicule >= 65 || embarrassment >= 70) return 'CROWD_EXECUTION';
    if (volatility >= 60 && frustration >= 55) return 'SOCIAL_AMBUSH';
    if (/deadline|clock|late|window/i.test(signal.reason)) return 'DEADLINE_PRESSURE';
    if (/bluff|mirror|quote|said/i.test(signal.reason)) return 'MIRROR_TRAP';
    if (/bait|tilt|anger|rage/i.test(signal.reason)) return 'ESCALATION_BAIT';
    return 'OPENING_TELEGRAPH';
  }

  private inferIntent(content: string, pattern: ChatBossFightPattern): ChatCounterIntent {
    if (/(pass|fold|later|not now|walk away)/i.test(content)) return 'WITHDRAW';
    if (/(prove|show|evidence|receipt|quote|you said)/i.test(content)) return 'CALL_BLUFF';
    if (/(actually|instead|reverse|your move|watch this)/i.test(content)) return 'REVERSE';
    if (/(steady|hold|focus|one line|clean|calm)/i.test(content)) return 'STABILIZE';
    if (/(no|wrong|false|cut that|enough)/i.test(content)) return 'ASSERT';
    if (pattern === 'ESCALATION_BAIT' || pattern === 'SOCIAL_AMBUSH') return 'DEFLECT';
    return 'ASSERT';
  }

  private scoreReply(
    content: string,
    intent: ChatCounterIntent,
    descriptor: ChatBossFightDescriptor,
    affect?: ChatAffectSnapshot,
  ): number {
    let score = 50;

    if (content.length >= 18 && content.length <= 180) score += 10;
    if (content.length > 240) score -= 16;
    if ((content.match(/!/g) ?? []).length >= 2) score -= 10;
    if ((content.match(/\?/g) ?? []).length >= 3) score -= 8;
    if (/(please|sorry|i guess|maybe|whatever)/i.test(content)) score -= 12;
    if (/(proof|receipt|clock|window|line|leverage|record)/i.test(content)) score += 9;
    if (/\b(you)\b/i.test(content) && /\b(i)\b/i.test(content)) score += 4;

    const preferred = PATTERNS[descriptor.pattern].preferredCounterIntents;
    if (preferred.includes(intent)) score += 18;
    else score -= 8;

    if (intent === 'WITHDRAW' && descriptor.pattern === 'DEADLINE_PRESSURE') score += 6;
    if (intent === 'REVERSE' && descriptor.pattern === 'MIRROR_TRAP') score += 8;
    if (intent === 'CALL_BLUFF' && descriptor.pattern === 'OPENING_TELEGRAPH') score += 6;
    if (intent === 'DEFLECT' && descriptor.pattern === 'CROWD_EXECUTION') score -= 10;

    const embarrassment = Number(affect?.vector.embarrassment ?? 0);
    const desperation = Number(affect?.vector.desperation ?? 0);
    if (embarrassment >= 70 && intent === 'STABILIZE') score += 8;
    if (desperation >= 70 && content.length > 180) score -= 8;

    return clamp(score, 0, 100);
  }

  private buildBotMessage(input: {
    readonly descriptor: ChatBossFightDescriptor;
    readonly category: BotLineCategory;
    readonly bodyHint?: string;
    readonly at: UnixMs;
    readonly pressureBand: PersonaPressureBand;
    readonly kind: ChatMessageKind;
  }): ChatMessage {
    const actor = BOT_ACTORS[input.descriptor.botId];
    const body = input.bodyHint?.trim().length
      ? input.bodyHint.trim()
      : this.responseDirector.pick(input.descriptor.botId, input.category, {
          now: input.at,
          category: input.category,
          pressureBand: input.pressureBand,
          preferredTags: tagsForPattern(input.descriptor.pattern),
        });

    return this.buildActorMessage({
      actor,
      channel: input.descriptor.channel,
      kind: input.kind,
      body,
      at: input.at,
      descriptor: input.descriptor,
      tags: ['boss-fight', input.category, input.descriptor.pattern],
    });
  }

  private buildHelperMessage(
    descriptor: ChatBossFightDescriptor,
    helperIntent: keyof typeof HELPER_LINES,
    at: UnixMs,
  ): ChatMessage {
    const lines = HELPER_LINES[helperIntent] ?? HELPER_LINES.COACH;
    const body = pickByTime(lines, at);

    return this.buildActorMessage({
      actor: HELPER_ACTOR,
      channel: descriptor.channel,
      kind: 'HELPER_PROMPT',
      body,
      at,
      descriptor,
      tags: ['boss-fight', 'helper', helperIntent.toLowerCase()],
    });
  }

  private buildCrowdMessage(
    descriptor: ChatBossFightDescriptor,
    mode: keyof typeof CROWD_LINES,
    at: UnixMs,
  ): ChatMessage {
    const lines = CROWD_LINES[mode] ?? CROWD_LINES.hype;
    const body = pickByTime(lines, at);
    return this.buildActorMessage({
      actor: CROWD_ACTOR,
      channel: descriptor.channel,
      kind: 'CROWD_REACTION',
      body,
      at,
      descriptor,
      tags: ['boss-fight', 'crowd', mode],
    });
  }

  private buildActorMessage(input: {
    readonly actor: ActorProfile;
    readonly channel: ChatVisibleChannel;
    readonly kind: ChatMessageKind;
    readonly body: string;
    readonly at: UnixMs;
    readonly descriptor: ChatBossFightDescriptor;
    readonly tags?: readonly string[];
  }): ChatMessage {
    return {
      id: this.ids.nextMessageId('bossfight-actor'),
      channel: input.channel,
      kind: input.kind,
      senderId: input.actor.actorId,
      senderName: input.actor.displayName,
      body: input.body,
      ts: input.at,
      immutable: true,
      sceneId: input.descriptor.sceneId,
      momentId: input.descriptor.momentId,
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
        botId: input.actor.actorKind === 'HATER' ? input.descriptor.botId : undefined,
      },
      tags: ['chat-boss-fight', ...new Set([...(input.tags ?? []), ...input.descriptor.tags])],
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

export function createChatBossFightController(
  options: ChatBossFightControllerOptions = {},
): ChatBossFightController {
  return new ChatBossFightController(options);
}

// ============================================================================
// MARK: Utilities
// ============================================================================

function computeThreatScore(
  signal: ChatBossFightSignal,
  affect?: ChatAffectSnapshot,
  mood?: ChatChannelMood,
): Score100 {
  let score = 42;
  if (signal.channel === DEAL_ROOM_CHANNEL) score += 10;
  if (/deadline|collapse|shield|bankrupt|bleed/i.test(signal.reason)) score += 12;
  if (mood?.mood === 'HOSTILE' || mood?.mood === 'PREDATORY') score += 8;
  score += Math.floor(Number(affect?.vector.frustration ?? 0) * 0.12);
  score += Math.floor(Number(affect?.vector.intimidation ?? 0) * 0.1);
  return toScore100(score);
}

function computeEmbarrassmentRisk(
  channel: ChatVisibleChannel,
  audienceHeat?: ChatAudienceHeat,
  affect?: ChatAffectSnapshot,
): Score100 {
  let score = Number(affect?.vector.embarrassment ?? 0) * 0.55;
  score += Number(audienceHeat?.ridicule ?? 0) * 0.25;
  score += Number(audienceHeat?.scrutiny ?? 0) * 0.2;
  if (channel === 'GLOBAL' || channel === 'LOBBY') score += 10;
  return toScore100(score);
}

function toPersonaPressureBand(
  pressureTier?: PressureTier,
  affect?: ChatAffectSnapshot,
): PersonaPressureBand {
  if (pressureTier === 'CRITICAL' || Number(affect?.vector.desperation ?? 0) >= 80) return 'CRITICAL';
  if (pressureTier === 'PRESSURED' || Number(affect?.vector.frustration ?? 0) >= 65) return 'HIGH';
  if (pressureTier === 'WATCHFUL') return 'MEDIUM';
  return 'LOW';
}

function shouldOfferHelper(
  affect: ChatAffectSnapshot | undefined,
  channel: ChatVisibleChannel,
  embarrassmentRisk: Score100,
): boolean {
  if (channel === DEAL_ROOM_CHANNEL) return true;
  return Number(affect?.vector.frustration ?? 0) >= 52 || Number(embarrassmentRisk) >= 58;
}

function shouldUseCrowd(
  channel: ChatVisibleChannel,
  audienceHeat?: ChatAudienceHeat,
): boolean {
  if (!CROWD_CHANNELS.includes(channel)) return false;
  return Number(audienceHeat?.scrutiny ?? 0) >= 30 || Number(audienceHeat?.heat ?? 0) >= 35 || channel === 'GLOBAL';
}

function pickByTime<T>(items: readonly T[], at: number): T {
  return items[Math.abs(at) % items.length] as T;
}

function normalizeBody(body: string): string {
  return body.replace(/\s+/g, ' ').trim();
}

function recentBodiesForChannel(
  state: Pick<ChatEngineState, 'messagesByChannel'> | undefined,
  channel: ChatVisibleChannel,
): readonly string[] {
  return (state?.messagesByChannel[channel] ?? []).slice(-12).map((message) => message.body);
}

function tagsForPattern(pattern: ChatBossFightPattern): readonly string[] {
  switch (pattern) {
    case 'DEADLINE_PRESSURE':
      return ['deadline', 'clock', 'window'];
    case 'MIRROR_TRAP':
      return ['receipt', 'mirror', 'quote'];
    case 'SOCIAL_AMBUSH':
      return ['crowd', 'shame', 'public'];
    case 'CROWD_EXECUTION':
      return ['humiliation', 'stage', 'witness'];
    case 'ESCALATION_BAIT':
      return ['tilt', 'bait', 'anger'];
    case 'OPENING_TELEGRAPH':
    default:
      return ['warning', 'probe', 'setup'];
  }
}

function scoreToQuality(
  score: number,
  pattern: ChatBossFightPattern,
  intent: ChatCounterIntent,
): ChatCounterQuality {
  if (score >= 84) return 'PERFECT';
  if (score >= 68) return 'STRONG';
  if (score >= 46) return 'WEAK';
  if (intent === 'WITHDRAW' && pattern === 'DEADLINE_PRESSURE' && score >= 38) return 'WEAK';
  return 'FAILED';
}

function deltaFromQuality(
  base: number | Score100 | undefined,
  quality: ChatCounterQuality,
  successDelta: number,
  failureDelta: number,
): number {
  const current = Number(base ?? 0);
  const delta = quality === 'PERFECT' || quality === 'STRONG'
    ? successDelta
    : quality === 'WEAK'
      ? Math.floor((successDelta + failureDelta) / 2)
      : failureDelta;
  return current + delta;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toScore100(value: number): Score100 {
  return clamp(Math.round(value), 0, 100) as Score100;
}

export function applyRelationshipDelta(
  relationship: ChatRelationshipState,
  delta: ChatRelationshipDelta,
  now: UnixMs,
): ChatRelationshipState {
  return {
    ...relationship,
    lastMeaningfulShiftAt: now,
    vector: {
      ...relationship.vector,
      respect: toScore100(Number(relationship.vector.respect) + delta.respectDelta),
      fear: toScore100(Number(relationship.vector.fear) + delta.fearDelta),
      contempt: toScore100(Number(relationship.vector.contempt) + delta.contemptDelta),
      fascination: toScore100(Number(relationship.vector.fascination) + delta.fascinationDelta),
      trust: toScore100(Number(relationship.vector.trust) + delta.trustDelta),
      familiarity: relationship.vector.familiarity,
      rivalryIntensity: toScore100(Number(relationship.vector.rivalryIntensity) + delta.rivalryDelta),
      rescueDebt: toScore100(Number(relationship.vector.rescueDebt) + delta.rescueDebtDelta),
      adviceObedience: relationship.vector.adviceObedience,
    },
  };
}

// ============================================================================
// MARK: End
// ============================================================================
