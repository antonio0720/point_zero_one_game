/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT DRAMA DIRECTOR
 * FILE: pzo-web/src/engines/chat/experience/ChatDramaDirector.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Converts a meaningful chat/game moment into a directed micro-scene.
 *
 * This module is the missing orchestration layer between:
 * - raw upstream signals,
 * - the existing ChatBotResponseDirector persona corpora,
 * - local affect / relationship / learning state,
 * - scene beats,
 * - silence,
 * - rescue timing,
 * - audience heat,
 * - delayed reveals.
 *
 * Design law
 * ----------
 * - One event can produce a scene, not just one line.
 * - Silence is an authored beat, not an absence of logic.
 * - Haters pressure; helpers rescue; crowd witnesses.
 * - The room should react differently based on channel, pressure, and history.
 * - This file stays pure enough for deterministic tests and thin engine usage.
 * ============================================================================
 */

import type { BotId } from '../../battle/types';
import {
  type ChatActorKind,
  type ChatAudienceHeat,
  type ChatChannelMood,
  type ChatEngineState,
  type ChatFeatureSnapshot,
  type ChatInterruptionRule,
  type ChatInterventionId,
  type ChatLearningProfile,
  type ChatMessage,
  type ChatMessageId,
  type ChatMessageKind,
  type ChatMomentId,
  type ChatMomentType,
  type ChatRelationshipId,
  type ChatRelationshipState,
  type ChatRescueDecision,
  type ChatRevealSchedule,
  type ChatSceneBeat,
  type ChatScenePlan,
  type ChatSceneId,
  type ChatSilenceDecision,
  type ChatVisibleChannel,
  type GameChatContext,
  type PressureTier,
  type Score100,
  type UnixMs,
} from '../types';
import { buildLocalSystemMessage } from '../ChatState';
import {
  createChatBotResponseDirector,
  type PersonaPressureBand,
} from '../ChatBotResponseDirector';

// ============================================================================
// MARK: Public planning contracts
// ============================================================================

export interface ChatDramaMomentSignal {
  readonly momentType?: ChatMomentType;
  readonly requestedChannel?: ChatVisibleChannel;
  readonly botId?: BotId;
  readonly reason?: string;
  readonly bodyHint?: string;
  readonly proofHash?: string;
  readonly forcedSpeakerActorId?: string;
  readonly forcedSpeakerKind?: ChatActorKind;
  readonly forceCrowdWitness?: boolean;
  readonly forceHelper?: boolean;
  readonly forceSilence?: boolean;
  readonly allowComposerDuringScene?: boolean;
  readonly tags?: readonly string[];
}

export interface ChatDramaPlanningInput {
  readonly state?: Pick<
    ChatEngineState,
    | 'activeVisibleChannel'
    | 'messagesByChannel'
    | 'audienceHeat'
    | 'channelMoodByChannel'
    | 'affect'
    | 'relationshipsByCounterpartId'
    | 'learningProfile'
  >;
  readonly context?: GameChatContext;
  readonly featureSnapshot?: ChatFeatureSnapshot;
  readonly learningProfile?: ChatLearningProfile;
  readonly relationships?: readonly ChatRelationshipState[];
  readonly signal: ChatDramaMomentSignal;
  readonly now?: UnixMs;
}

export interface ChatDramaDelayedMessage {
  readonly schedule: ChatRevealSchedule;
  readonly message: ChatMessage;
}

export interface ChatDramaPlan {
  readonly scene: ChatScenePlan;
  readonly immediateMessages: readonly ChatMessage[];
  readonly delayedMessages: readonly ChatDramaDelayedMessage[];
  readonly silence?: ChatSilenceDecision;
  readonly rescue?: ChatRescueDecision;
  readonly audienceHeatPatch?: Partial<Record<ChatVisibleChannel, ChatAudienceHeat>>;
  readonly moodPatch?: readonly ChatChannelMood[];
  readonly interruptionRules: readonly ChatInterruptionRule[];
  readonly notes: readonly string[];
  readonly dominantBotId?: BotId;
  readonly selectedHelperPersonaId?: string;
}

// ============================================================================
// MARK: Internal registries
// ============================================================================

interface ChatDramaClock {
  now(): number;
}

interface ChatDramaIdFactory {
  nextMessageId(prefix: string): ChatMessageId;
  nextSceneId(prefix: string): ChatSceneId;
  nextMomentId(prefix: string): ChatMomentId;
}

interface HelperPersonaDefinition {
  readonly personaId: string;
  readonly actorId: string;
  readonly displayName: string;
  readonly warmth01: number;
  readonly directness01: number;
  readonly rescueBias01: number;
  readonly linesByIntent: Readonly<
    Record<'COACH' | 'CALM' | 'WARN' | 'SIMPLIFY' | 'OFFER_EXIT' | 'PROTECT_DIGNITY', readonly string[]>
  >;
}

interface CrowdVoiceDefinition {
  readonly channel: ChatVisibleChannel;
  readonly calm: readonly string[];
  readonly hostile: readonly string[];
  readonly ecstasy: readonly string[];
  readonly mournful: readonly string[];
}

export interface ChatDramaDirectorOptions {
  readonly clock?: ChatDramaClock;
  readonly idFactory?: ChatDramaIdFactory;
}

const DEFAULT_CLOCK: ChatDramaClock = {
  now: () => Date.now(),
};

class MonotonicDramaIdFactory implements ChatDramaIdFactory {
  private messageCounter = 0;
  private sceneCounter = 0;
  private momentCounter = 0;

  constructor(private readonly clock: ChatDramaClock) {}

  nextMessageId(prefix: string): ChatMessageId {
    this.messageCounter += 1;
    return `${prefix}:msg:${this.clock.now()}:${this.messageCounter}` as ChatMessageId;
  }

  nextSceneId(prefix: string): ChatSceneId {
    this.sceneCounter += 1;
    return `${prefix}:scene:${this.clock.now()}:${this.sceneCounter}` as ChatSceneId;
  }

  nextMomentId(prefix: string): ChatMomentId {
    this.momentCounter += 1;
    return `${prefix}:moment:${this.clock.now()}:${this.momentCounter}` as ChatMomentId;
  }
}

const HELPER_PERSONAS: readonly HelperPersonaDefinition[] = [
  {
    personaId: 'MENTOR',
    actorId: 'npc:helper:mentor',
    displayName: 'THE MENTOR',
    warmth01: 0.84,
    directness01: 0.78,
    rescueBias01: 0.74,
    linesByIntent: {
      COACH: [
        'Read the state. Then act. Panic does not improve any line.',
        'One disciplined move changes the room faster than five emotional ones.',
        'Let the noise be noise. Your job is sequence.',
      ],
      CALM: [
        'Breathe once before you answer the room.',
        'You are allowed to pause without surrendering.',
        'Silence can still be control when you choose it.',
      ],
      WARN: [
        'The next careless line becomes evidence.',
        'Do not give the crowd a confession disguised as honesty.',
        'Your urgency is visible. Hide it or convert it.',
      ],
      SIMPLIFY: [
        'Protect the line. Ignore the theater.',
        'One clean reply. No over-explaining.',
        'Cut the choice set down to one winning action.',
      ],
      OFFER_EXIT: [
        'Take the smaller safe line if it preserves the run.',
        'You do not owe the room a dramatic finish.',
        'Stability first. Pride later.',
      ],
      PROTECT_DIGNITY: [
        'You can recover without performing for witnesses.',
        'Do not narrate collapse for people who came to watch it.',
        'Hold posture. The room reads posture before numbers.',
      ],
    },
  },
  {
    personaId: 'INSIDER',
    actorId: 'npc:helper:insider',
    displayName: 'THE INSIDER',
    warmth01: 0.42,
    directness01: 0.91,
    rescueBias01: 0.48,
    linesByIntent: {
      COACH: [
        'Watch the timing window, not the sentiment wave.',
        'The trap is usually one beat earlier than your emotion thinks.',
        'You do not need courage here. You need a cleaner read.',
      ],
      CALM: [
        'You are still inside the window. Act like it.',
        'The room is loud because timing matters right now.',
        'You still have agency if you stop leaking it.',
      ],
      WARN: [
        'Every extra sentence helps the other side price you.',
        'Do not volunteer urgency inside a predatory channel.',
        'The worst tell in the room is unnecessary detail.',
      ],
      SIMPLIFY: [
        'Short answer. Preserve leverage.',
        'Delay, counter, or fold. Those are the only honest branches.',
        'Reduce the surface area of your mistake potential.',
      ],
      OFFER_EXIT: [
        'Take the line that preserves optionality.',
        'Leave the room before the room finishes describing you.',
        'A smaller surviving position still wins over a public collapse.',
      ],
      PROTECT_DIGNITY: [
        'Never let a hostile room decide your internal state.',
        'You do not need to sound wounded to be honest.',
        'Keep your cadence clean. The rest can follow.',
      ],
    },
  },
  {
    personaId: 'SURVIVOR',
    actorId: 'npc:helper:survivor',
    displayName: 'THE SURVIVOR',
    warmth01: 1,
    directness01: 0.55,
    rescueBias01: 0.95,
    linesByIntent: {
      COACH: [
        'You are not finished. Make the next line prove it.',
        'A clean breath still counts as strategy when collapse is loud.',
        'I have seen uglier states recover.',
      ],
      CALM: [
        'Slow your hands. The spiral feeds on speed.',
        'You are allowed to regroup in public without apologizing for it.',
        'Nothing about this moment is final yet.',
      ],
      WARN: [
        'If you speak from shame, the room will keep you there.',
        'Do not let embarrassment choose your reply.',
        'The hater wants you fast and sloppy.',
      ],
      SIMPLIFY: [
        'Stabilize. Then answer.',
        'One card. One move. One clean intention.',
        'Survival is still a valid line.',
      ],
      OFFER_EXIT: [
        'Take the one-card recovery if the alternative is a public spiral.',
        'A graceful retreat is still a form of power.',
        'Live to punish the room later.',
      ],
      PROTECT_DIGNITY: [
        'They do not get to author your ending just because they arrived early.',
        'Hold your name above the moment.',
        'You can be under pressure without becoming small.',
      ],
    },
  },
  {
    personaId: 'RIVAL',
    actorId: 'npc:helper:rival',
    displayName: 'THE RIVAL',
    warmth01: 0.52,
    directness01: 0.88,
    rescueBias01: 0.28,
    linesByIntent: {
      COACH: [
        'If you are close, act like you expected to be here.',
        'Finish this like the room owes you silence.',
        'Pressure is where separation becomes visible.',
      ],
      CALM: [
        'Stop apologizing to hostile air.',
        'You are still in it. Sound like it.',
        'The room is not your conscience.',
      ],
      WARN: [
        'Timid replies teach the crowd the wrong lesson.',
        'Do not negotiate with mockery. Outlast it.',
        'The next weak line invites another attack.',
      ],
      SIMPLIFY: [
        'One sharp answer beats four defensive ones.',
        'Decide. Then make the room carry your decision.',
        'You do not need elegance. You need finish.',
      ],
      OFFER_EXIT: [
        'If you leave, leave like it was strategic.',
        'Withdraw cleanly or strike cleanly. No middle.',
        'Make retreat look chosen, not forced.',
      ],
      PROTECT_DIGNITY: [
        'Do not bow to spectators.',
        'Hold your edge even when you step back.',
        'The room can watch. It does not get your spine.',
      ],
    },
  },
];

const CROWD_VOICES: readonly CrowdVoiceDefinition[] = [
  {
    channel: 'GLOBAL',
    calm: [
      'global feels too quiet for what just happened',
      'somebody in here is one disciplined move away from changing the room',
      'the silence after that line says more than the line did',
    ],
    hostile: [
      'GLOBAL smells panic now',
      'the room saw that crack immediately',
      'that was not a stumble. that was a public opening',
    ],
    ecstasy: [
      'GLOBAL just witnessed a real reversal',
      'that comeback landed clean',
      'the room felt that one',
    ],
    mournful: [
      'GLOBAL watched the floor give way',
      'some runs announce their pain before the numbers do',
      'that collapse had witnesses',
    ],
  },
  {
    channel: 'SYNDICATE',
    calm: [
      'hold posture. no free tells',
      'syndicate chat should sound calmer than the battlefield looks',
      'we do not leak urgency unless it pays',
    ],
    hostile: [
      'tighten the line. pressure is visible',
      'someone is leaking fear into syndicate',
      'hostile air. clean decisions only',
    ],
    ecstasy: [
      'syndicate just got proof of life',
      'that recovery bought credibility',
      'clean swing. remember it',
    ],
    mournful: [
      'syndicate watched that one hurt',
      'the room got smaller after that beat',
      'do not let shame start speaking for you',
    ],
  },
  {
    channel: 'DEAL_ROOM',
    calm: [
      'silence is leverage in here',
      'read delay is still a sentence',
      'the room is pricing cadence now',
    ],
    hostile: [
      'deal room can smell urgency',
      'too much explanation. price just moved',
      'someone blinked first',
    ],
    ecstasy: [
      'that counter landed',
      'deal room just respected the posture shift',
      'the table moved after that',
    ],
    mournful: [
      'the room is repricing weakness',
      'that sounded expensive',
      'deal room heard the urgency crack',
    ],
  },
  {
    channel: 'LOBBY',
    calm: [
      'lobby always notices the warmup tells',
      'some players sound nervous before the first real pressure window',
      'the room is reading posture already',
    ],
    hostile: [
      'lobby is getting sharp early',
      'that warmup line invited company',
      'pre-run air just changed',
    ],
    ecstasy: [
      'lobby felt the confidence swing',
      'that was a clean opening note',
      'warmup turned into signal fast',
    ],
    mournful: [
      'lobby saw the nerves',
      'the room got sad quiet there',
      'the warmup slipped into warning',
    ],
  },
];

// ============================================================================
// MARK: Director
// ============================================================================

export class ChatDramaDirector {
  private readonly clock: ChatDramaClock;
  private readonly idFactory: ChatDramaIdFactory;
  private readonly botDirector = createChatBotResponseDirector();

  constructor(options: ChatDramaDirectorOptions = {}) {
    this.clock = options.clock ?? DEFAULT_CLOCK;
    this.idFactory = options.idFactory ?? new MonotonicDramaIdFactory(this.clock);
  }

  plan(input: ChatDramaPlanningInput): ChatDramaPlan {
    const now = input.now ?? (this.clock.now() as UnixMs);
    const momentType = this.resolveMomentType(input);
    const channel = this.resolveChannel(input, momentType);
    const notes: string[] = [];
    const pressureBand = this.toPersonaPressureBand(input.context?.pressureTier);
    const dominantBotId = this.selectDominantBotId(input, momentType);
    const helperPersona = this.selectHelperPersona(input, momentType);
    const relationships = this.collectRelationships(input);
    const rescue = this.buildRescueDecision({
      now,
      channel,
      input,
      momentType,
      helperPersonaId: helperPersona?.personaId,
    });

    const silence = this.buildSilenceDecision({
      now,
      channel,
      input,
      momentType,
      rescuePlanned: Boolean(rescue),
    });

    const sceneId = this.idFactory.nextSceneId(`chat-drama:${channel}`);
    const momentId =
      input.signal.momentType != null
        ? this.idFactory.nextMomentId(`chat-moment:${input.signal.momentType}`)
        : this.idFactory.nextMomentId(`chat-moment:${momentType}`);

    const beats = this.buildBeats({
      input,
      channel,
      momentType,
      rescue,
      helperPersonaId: helperPersona?.personaId,
      silencePlanned: Boolean(silence?.enforced),
    });

    const scene = this.buildScene({
      sceneId,
      momentId,
      channel,
      momentType,
      beats,
      now,
      allowComposerDuringScene:
        input.signal.allowComposerDuringScene ?? this.defaultComposerRule(momentType),
    });

    const immediateMessages: ChatMessage[] = [];
    const delayedMessages: ChatDramaDelayedMessage[] = [];

    const systemNotice = this.buildSystemNotice({
      input,
      channel,
      sceneId,
      momentId,
      now,
      momentType,
    });
    if (systemNotice) {
      immediateMessages.push(systemNotice);
      notes.push('system-notice');
    }

    const haterMessage = dominantBotId
      ? this.buildHaterMessage({
          input,
          channel,
          sceneId,
          momentId,
          now,
          momentType,
          botId: dominantBotId,
          pressureBand,
          relationships,
        })
      : undefined;

    if (haterMessage?.immediate) {
      immediateMessages.push(haterMessage.immediate);
      notes.push(`hater:${dominantBotId}`);
    }
    if (haterMessage?.delayed) {
      delayedMessages.push(haterMessage.delayed);
      notes.push('hater-delayed');
    }

    const crowdMessage = this.buildCrowdWitness({
      input,
      channel,
      sceneId,
      momentId,
      now,
      momentType,
      relationships,
      afterSilence: Boolean(silence?.enforced),
    });

    if (crowdMessage?.immediate) {
      immediateMessages.push(crowdMessage.immediate);
      notes.push('crowd-immediate');
    }
    if (crowdMessage?.delayed) {
      delayedMessages.push(crowdMessage.delayed);
      notes.push('crowd-delayed');
    }

    const helperMessage = helperPersona
      ? this.buildHelperMessage({
          input,
          channel,
          sceneId,
          momentId,
          now,
          momentType,
          helperPersona,
          rescue,
        })
      : undefined;

    if (helperMessage?.immediate) {
      immediateMessages.push(helperMessage.immediate);
      notes.push(`helper:${helperPersona.personaId}`);
    }
    if (helperMessage?.delayed) {
      delayedMessages.push(helperMessage.delayed);
      notes.push('helper-delayed');
    }

    const audienceHeatPatch = this.buildAudienceHeatPatch({
      input,
      channel,
      now,
      momentType,
      rescue,
      haterPresent: Boolean(dominantBotId),
      crowdPresent: Boolean(crowdMessage),
    });

    const moodPatch = this.buildMoodPatch({
      input,
      channel,
      now,
      momentType,
      rescue,
      haterPresent: Boolean(dominantBotId),
    });

    const interruptionRules = this.buildInterruptionRules({
      channel,
      momentType,
      rescue,
    });

    return {
      scene,
      immediateMessages,
      delayedMessages: delayedMessages.sort(
        (left, right) => Number(left.schedule.revealAt) - Number(right.schedule.revealAt),
      ),
      silence,
      rescue,
      audienceHeatPatch,
      moodPatch,
      interruptionRules,
      notes,
      dominantBotId,
      selectedHelperPersonaId: helperPersona?.personaId,
    };
  }

  private resolveMomentType(input: ChatDramaPlanningInput): ChatMomentType {
    if (input.signal.momentType) {
      return input.signal.momentType;
    }

    const pressure = input.context?.pressureTier;
    const events = input.context?.events ?? [];
    const tags = new Set(input.signal.tags ?? []);
    const lower = `${input.signal.reason ?? ''} ${input.signal.bodyHint ?? ''}`.toLowerCase();

    if (tags.has('run-start') || events.includes('RUN_START')) return 'RUN_START';
    if (tags.has('run-end') || events.includes('RUN_END')) return 'RUN_END';
    if (tags.has('world-event')) return 'WORLD_EVENT';
    if (tags.has('helper-rescue')) return 'HELPER_RESCUE';
    if (tags.has('deal')) return 'DEAL_ROOM_STANDOFF';
    if (tags.has('legend')) return 'LEGEND_MOMENT';
    if (lower.includes('sovereign')) return 'SOVEREIGN_ACHIEVED';
    if (lower.includes('comeback')) return 'COMEBACK';
    if (lower.includes('breach') || lower.includes('shield')) return 'SHIELD_BREACH';
    if (lower.includes('attack') || lower.includes('swarm')) return 'BOT_ATTACK';
    if (pressure === 'BREAKPOINT' || pressure === 'CRITICAL') return 'PRESSURE_SURGE';
    return 'RUN_START';
  }

  private resolveChannel(
    input: ChatDramaPlanningInput,
    momentType: ChatMomentType,
  ): ChatVisibleChannel {
    if (input.signal.requestedChannel) return input.signal.requestedChannel;
    if (momentType === 'DEAL_ROOM_STANDOFF') return 'DEAL_ROOM';
    if (momentType === 'RUN_START' && input.state?.activeVisibleChannel === 'LOBBY') {
      return 'LOBBY';
    }
    if (input.featureSnapshot?.activeVisibleChannel) {
      return input.featureSnapshot.activeVisibleChannel;
    }
    return input.state?.activeVisibleChannel ?? 'GLOBAL';
  }

  private defaultComposerRule(momentType: ChatMomentType): boolean {
    switch (momentType) {
      case 'DEAL_ROOM_STANDOFF':
      case 'HELPER_RESCUE':
      case 'COMEBACK':
        return true;
      case 'SHIELD_BREACH':
      case 'BOT_ATTACK':
      case 'PRESSURE_SURGE':
        return false;
      default:
        return true;
    }
  }

  private buildBeats(input: {
    readonly input: ChatDramaPlanningInput;
    readonly channel: ChatVisibleChannel;
    readonly momentType: ChatMomentType;
    readonly rescue?: ChatRescueDecision;
    readonly helperPersonaId?: string;
    readonly silencePlanned: boolean;
  }): readonly ChatSceneBeat[] {
    const beats: ChatSceneBeat[] = [
      {
        beatType: 'SYSTEM_NOTICE',
        delayMs: 0,
        requiredChannel: input.channel,
        skippable: false,
        canInterrupt: true,
        payloadHint: input.input.signal.reason ?? input.momentType,
      },
    ];

    if (this.shouldOpenWithHater(input.momentType, input.channel)) {
      beats.push({
        beatType: 'HATER_ENTRY',
        delayMs: input.silencePlanned ? 900 : 240,
        requiredChannel: input.channel,
        skippable: false,
        canInterrupt: true,
        payloadHint: 'hater-pressure',
      });
    }

    if (this.shouldCrowdWitness(input.input, input.channel, input.momentType)) {
      beats.push({
        beatType: 'CROWD_SWARM',
        delayMs: input.silencePlanned ? 1350 : 480,
        requiredChannel: input.channel,
        skippable: true,
        canInterrupt: true,
        payloadHint: 'crowd-witness',
      });
    }

    if (input.rescue) {
      beats.push({
        beatType: 'HELPER_INTERVENTION',
        delayMs: input.silencePlanned ? 1800 : 620,
        requiredChannel: input.channel,
        skippable: false,
        canInterrupt: true,
        payloadHint: input.helperPersonaId ?? 'helper',
      });
    } else if (this.shouldOfferHelperPresence(input.input, input.momentType)) {
      beats.push({
        beatType: 'HELPER_INTERVENTION',
        delayMs: input.silencePlanned ? 1900 : 880,
        requiredChannel: input.channel,
        skippable: true,
        canInterrupt: true,
        payloadHint: input.helperPersonaId ?? 'helper',
      });
    }

    beats.push({
      beatType: 'PLAYER_REPLY_WINDOW',
      delayMs: input.silencePlanned ? 2000 : 1100,
      requiredChannel: input.channel,
      skippable: false,
      canInterrupt: false,
      payloadHint: 'player-reply',
    });

    if (input.momentType === 'COMEBACK' || input.momentType === 'LEGEND_MOMENT') {
      beats.push({
        beatType: 'POST_BEAT_ECHO',
        delayMs: 1650,
        requiredChannel: input.channel,
        skippable: true,
        canInterrupt: true,
        payloadHint: 'echo',
      });
    }

    return beats;
  }

  private buildScene(input: {
    readonly sceneId: ChatSceneId;
    readonly momentId: ChatMomentId;
    readonly channel: ChatVisibleChannel;
    readonly momentType: ChatMomentType;
    readonly beats: readonly ChatSceneBeat[];
    readonly now: UnixMs;
    readonly allowComposerDuringScene: boolean;
  }): ChatScenePlan {
    return {
      sceneId: input.sceneId,
      momentId: input.momentId,
      momentType: input.momentType,
      primaryChannel: input.channel,
      beats: input.beats,
      startedAt: input.now,
      expectedDurationMs: this.estimateDurationMs(input.beats),
      allowPlayerComposerDuringScene: input.allowComposerDuringScene,
      cancellableByAuthoritativeEvent: true,
    };
  }

  private estimateDurationMs(beats: readonly ChatSceneBeat[]): number {
    return beats.reduce((sum, beat) => sum + Math.max(beat.delayMs, 0), 0) + 1500;
  }

  private buildSystemNotice(input: {
    readonly input: ChatDramaPlanningInput;
    readonly channel: ChatVisibleChannel;
    readonly sceneId: ChatSceneId;
    readonly momentId: ChatMomentId;
    readonly now: UnixMs;
    readonly momentType: ChatMomentType;
  }): ChatMessage | undefined {
    const body = this.systemNoticeLine(input.input, input.momentType, input.channel);
    if (!body) return undefined;

    return {
      ...buildLocalSystemMessage({
        id: this.idFactory.nextMessageId('chat-drama'),
        channel: input.channel,
        kind: this.mapSystemKind(input.momentType),
        body,
        at: input.now,
        proofHash: input.input.signal.proofHash,
        pressureTier: input.input.context?.pressureTier,
        tickTier: input.input.context?.tickTier,
        tags: [
          'drama-director',
          'system-notice',
          input.momentType,
          ...(input.input.signal.tags ?? []),
        ],
      }),
      sceneId: input.sceneId,
      momentId: input.momentId,
    };
  }

  private buildHaterMessage(input: {
    readonly input: ChatDramaPlanningInput;
    readonly channel: ChatVisibleChannel;
    readonly sceneId: ChatSceneId;
    readonly momentId: ChatMomentId;
    readonly now: UnixMs;
    readonly momentType: ChatMomentType;
    readonly botId: BotId;
    readonly pressureBand: PersonaPressureBand;
    readonly relationships: readonly ChatRelationshipState[];
  }): { immediate?: ChatMessage; delayed?: ChatDramaDelayedMessage } | undefined {
    const recentBodies = this.collectRecentBodies(input.input.state, input.channel);

    const category =
      input.momentType === 'COMEBACK' || input.momentType === 'LEGEND_MOMENT'
        ? 'taunt'
        : input.momentType === 'RUN_END'
          ? 'retreat'
          : 'telegraph';

    const detailed = this.botDirector.pickDetailed(input.botId, category, {
      now: Number(input.now),
      category,
      pressureBand: input.pressureBand,
      signalType: input.momentType,
      recentBodies,
      preferredTags: input.momentType === 'DEAL_ROOM_STANDOFF' ? ['deal'] : undefined,
    });

    const message = this.buildNpcMessage({
      id: this.idFactory.nextMessageId('chat-hater'),
      channel: input.channel,
      kind: category === 'telegraph' ? 'HATER_TELEGRAPH' : 'HATER_PUNISH',
      actorKind: 'HATER',
      senderId: `bot:${input.botId}`,
      senderName: this.haterDisplayName(input.botId),
      body: detailed.line.text,
      at: input.now,
      sceneId: input.sceneId,
      momentId: input.momentId,
      emoji: this.haterEmoji(input.botId),
      relationshipIds: this.matchRelationshipIds(input.relationships, input.botId),
      tags: [
        'drama-director',
        'hater',
        input.botId,
        input.momentType,
        category,
        detailed.strategy,
      ],
      pressureTier: input.input.context?.pressureTier,
      tickTier: input.input.context?.tickTier,
    });

    if (this.shouldDelayHater(input.momentType, input.input.signal.forceSilence)) {
      return {
        delayed: {
          schedule: {
            revealAt: (Number(input.now) + this.haterDelayMs(input.momentType)) as UnixMs,
            revealChannel: input.channel,
            revealReason:
              input.momentType === 'COMEBACK' ? 'SCENE_STAGING' : 'DELAYED_HATER',
            payloadRef: message.id,
          },
          message,
        },
      };
    }

    return {
      immediate: message,
    };
  }

  private buildCrowdWitness(input: {
    readonly input: ChatDramaPlanningInput;
    readonly channel: ChatVisibleChannel;
    readonly sceneId: ChatSceneId;
    readonly momentId: ChatMomentId;
    readonly now: UnixMs;
    readonly momentType: ChatMomentType;
    readonly relationships: readonly ChatRelationshipState[];
    readonly afterSilence: boolean;
  }): { immediate?: ChatMessage; delayed?: ChatDramaDelayedMessage } | undefined {
    if (!this.shouldCrowdWitness(input.input, input.channel, input.momentType)) {
      return undefined;
    }

    const mood = this.deriveCrowdMood(input.input, input.channel, input.momentType);
    const body = this.pickCrowdLine(input.channel, mood, Number(input.now));

    const message = this.buildNpcMessage({
      id: this.idFactory.nextMessageId('chat-crowd'),
      channel: input.channel,
      kind: 'CROWD_REACTION',
      actorKind: 'CROWD',
      senderId: `crowd:${input.channel.toLowerCase()}`,
      senderName: this.crowdDisplayName(input.channel),
      body,
      at: input.now,
      sceneId: input.sceneId,
      momentId: input.momentId,
      relationshipIds: this.collectCrowdRelationshipIds(input.relationships),
      tags: ['drama-director', 'crowd', mood, input.momentType],
      pressureTier: input.input.context?.pressureTier,
      tickTier: input.input.context?.tickTier,
    });

    if (input.afterSilence || input.momentType === 'LEGEND_MOMENT') {
      return {
        delayed: {
          schedule: {
            revealAt: (Number(input.now) + 1150) as UnixMs,
            revealChannel: input.channel,
            revealReason: 'SCENE_STAGING',
            payloadRef: message.id,
          },
          message,
        },
      };
    }

    return {
      immediate: message,
    };
  }

  private buildHelperMessage(input: {
    readonly input: ChatDramaPlanningInput;
    readonly channel: ChatVisibleChannel;
    readonly sceneId: ChatSceneId;
    readonly momentId: ChatMomentId;
    readonly now: UnixMs;
    readonly momentType: ChatMomentType;
    readonly helperPersona: HelperPersonaDefinition;
    readonly rescue?: ChatRescueDecision;
  }): { immediate?: ChatMessage; delayed?: ChatDramaDelayedMessage } | undefined {
    const intent = this.helperIntent(input.momentType, input.rescue);
    const body = this.pickHelperLine(input.helperPersona, intent, Number(input.now));
    const message = this.buildNpcMessage({
      id: this.idFactory.nextMessageId('chat-helper'),
      channel: input.channel,
      kind: input.rescue ? 'HELPER_RESCUE' : 'HELPER_PROMPT',
      actorKind: 'HELPER',
      senderId: input.helperPersona.actorId,
      senderName: input.helperPersona.displayName,
      body,
      at: input.now,
      sceneId: input.sceneId,
      momentId: input.momentId,
      tags: [
        'drama-director',
        'helper',
        input.helperPersona.personaId,
        intent,
        input.momentType,
      ],
      pressureTier: input.input.context?.pressureTier,
      tickTier: input.input.context?.tickTier,
    });

    const delayMs = input.rescue
      ? (input.rescue.respectSilenceFirst ? 1500 : 420)
      : this.helperDelayMs(input.momentType, input.helperPersona);

    if (delayMs > 0) {
      return {
        delayed: {
          schedule: {
            revealAt: (Number(input.now) + delayMs) as UnixMs,
            revealChannel: input.channel,
            revealReason: 'DELAYED_HELPER',
            payloadRef: message.id,
          },
          message,
        },
      };
    }

    return {
      immediate: message,
    };
  }

  private buildNpcMessage(input: {
    readonly id: ChatMessageId;
    readonly channel: ChatVisibleChannel;
    readonly kind: ChatMessageKind;
    readonly actorKind: ChatActorKind;
    readonly senderId: string;
    readonly senderName: string;
    readonly body: string;
    readonly at: UnixMs;
    readonly sceneId: ChatSceneId;
    readonly momentId: ChatMomentId;
    readonly emoji?: string;
    readonly relationshipIds?: readonly ChatRelationshipId[];
    readonly tags?: readonly string[];
    readonly pressureTier?: PressureTier;
    readonly tickTier?: PressureTier | undefined;
  }): ChatMessage {
    return {
      id: input.id,
      channel: input.channel,
      kind: input.kind,
      senderId: input.senderId,
      senderName: input.senderName,
      body: input.body,
      emoji: input.emoji,
      ts: Number(input.at),
      immutable: true,
      deliveryState: 'AUTHORITATIVE',
      pressureTier: input.pressureTier,
      tickTier: input.tickTier as any,
      sceneId: input.sceneId,
      momentId: input.momentId,
      relationshipIds: input.relationshipIds,
      tags: input.tags,
    };
  }

  private buildSilenceDecision(input: {
    readonly now: UnixMs;
    readonly channel: ChatVisibleChannel;
    readonly input: ChatDramaPlanningInput;
    readonly momentType: ChatMomentType;
    readonly rescuePlanned: boolean;
  }): ChatSilenceDecision | undefined {
    const force = input.input.signal.forceSilence === true;
    const pressure = input.input.context?.pressureTier;
    const embarrassment = this.score100(input.input.state?.affect?.socialEmbarrassment);
    const frustration = this.score100(input.input.state?.affect?.frustration);

    const shouldSilence =
      force ||
      input.momentType === 'DEAL_ROOM_STANDOFF' ||
      input.momentType === 'SHIELD_BREACH' ||
      (pressure === 'CRITICAL' || pressure === 'BREAKPOINT') ||
      embarrassment >= 72 ||
      frustration >= 76;

    if (!shouldSilence) return undefined;

    const reason: ChatSilenceDecision['reason'] =
      input.momentType === 'DEAL_ROOM_STANDOFF'
        ? 'NEGOTIATION_PRESSURE'
        : input.rescuePlanned
          ? 'RESCUE_WAIT'
          : input.momentType === 'SHIELD_BREACH'
            ? 'DREAD'
            : 'SCENE_COMPOSITION';

    return {
      enforced: true,
      durationMs: this.silenceDurationMs(input.momentType, input.channel, input.rescuePlanned),
      reason,
      breakConditions: [
        'authoritative-sync',
        'player-reply',
        'rescue-window',
        'world-event-override',
      ],
    };
  }

  private buildRescueDecision(input: {
    readonly now: UnixMs;
    readonly channel: ChatVisibleChannel;
    readonly input: ChatDramaPlanningInput;
    readonly momentType: ChatMomentType;
    readonly helperPersonaId?: string;
  }): ChatRescueDecision | undefined {
    const affect = input.input.state?.affect;
    const frustration = this.score100(affect?.frustration);
    const embarrassment = this.score100(affect?.socialEmbarrassment);
    const desperation = this.score100(affect?.desperation);
    const helperReceptivity = this.score100(
      input.input.learningProfile?.helperReceptivity ??
        input.input.state?.learningProfile?.helperReceptivity,
    );

    const forced = input.input.signal.forceHelper === true;
    const severeMoment =
      input.momentType === 'SHIELD_BREACH' ||
      input.momentType === 'PRESSURE_SURGE' ||
      input.momentType === 'RUN_END';

    if (!forced && !severeMoment && frustration < 70 && embarrassment < 68 && desperation < 74) {
      return undefined;
    }

    return {
      interventionId: (`intervention:${input.channel}:${Number(input.now)}`) as ChatInterventionId,
      intent:
        helperReceptivity >= 66
          ? 'COACH'
          : embarrassment >= 72
            ? 'PROTECT_DIGNITY'
            : desperation >= 80
              ? 'OFFER_EXIT'
              : 'SIMPLIFY',
      urgency: this.toScore100(Math.max(frustration, embarrassment, desperation, severeMoment ? 76 : 0)),
      helperPersonaId: input.helperPersonaId,
      deliverInChannel: input.channel,
      respectSilenceFirst: input.channel === 'DEAL_ROOM' || embarrassment >= 78,
      triggerAt: input.now,
    };
  }

  private buildAudienceHeatPatch(input: {
    readonly input: ChatDramaPlanningInput;
    readonly channel: ChatVisibleChannel;
    readonly now: UnixMs;
    readonly momentType: ChatMomentType;
    readonly rescue?: ChatRescueDecision;
    readonly haterPresent: boolean;
    readonly crowdPresent: boolean;
  }): Partial<Record<ChatVisibleChannel, ChatAudienceHeat>> | undefined {
    const base = input.input.state?.audienceHeat?.[input.channel];
    const currentHeat = this.score100(base?.heat);
    const currentHype = this.score100(base?.hype);
    const currentRidicule = this.score100(base?.ridicule);
    const currentScrutiny = this.score100(base?.scrutiny);
    const currentVolatility = this.score100(base?.volatility);

    const delta = this.heatDelta(input.momentType, input.haterPresent, input.rescue);
    if (delta === 0 && !input.crowdPresent) return undefined;

    return {
      [input.channel]: {
        channelId: input.channel,
        heat: this.toScore100(currentHeat + delta),
        hype: this.toScore100(
          currentHype +
            (input.momentType === 'COMEBACK' || input.momentType === 'LEGEND_MOMENT' ? 16 : 2),
        ),
        ridicule: this.toScore100(
          currentRidicule +
            (input.momentType === 'SHIELD_BREACH' || input.momentType === 'PRESSURE_SURGE' ? 12 : 1),
        ),
        scrutiny: this.toScore100(currentScrutiny + (input.haterPresent ? 10 : 4)),
        volatility: this.toScore100(currentVolatility + (input.crowdPresent ? 8 : 3)),
        lastUpdatedAt: input.now,
      },
    };
  }

  private buildMoodPatch(input: {
    readonly input: ChatDramaPlanningInput;
    readonly channel: ChatVisibleChannel;
    readonly now: UnixMs;
    readonly momentType: ChatMomentType;
    readonly rescue?: ChatRescueDecision;
    readonly haterPresent: boolean;
  }): readonly ChatChannelMood[] {
    const mood: ChatChannelMood['mood'] =
      input.channel === 'DEAL_ROOM'
        ? 'PREDATORY'
        : input.momentType === 'COMEBACK' || input.momentType === 'LEGEND_MOMENT'
          ? 'ECSTATIC'
          : input.momentType === 'RUN_END'
            ? 'MOURNFUL'
            : input.haterPresent
              ? 'HOSTILE'
              : input.rescue
                ? 'SUSPICIOUS'
                : 'CALM';

    const reason =
      input.channel === 'DEAL_ROOM'
        ? 'Negotiation pressure now dominates the room.'
        : input.momentType === 'COMEBACK'
          ? 'The room recognized a reversal.'
          : input.momentType === 'RUN_END'
            ? 'The moment settled into aftermath.'
            : input.haterPresent
              ? 'Predatory pressure entered the channel.'
              : input.rescue
                ? 'The room paused to watch whether the player stabilizes.'
                : 'No dominant pressure vector displaced normal channel posture.';

    return [
      {
        channelId: input.channel,
        mood,
        reason,
        updatedAt: input.now,
      },
    ];
  }

  private buildInterruptionRules(input: {
    readonly channel: ChatVisibleChannel;
    readonly momentType: ChatMomentType;
    readonly rescue?: ChatRescueDecision;
  }): readonly ChatInterruptionRule[] {
    const inDealRoom = input.channel === 'DEAL_ROOM';
    const rescueNow = Boolean(input.rescue);

    return [
      {
        interrupterActorKind: 'SYSTEM',
        priority: 'ABSOLUTE',
        canBreakSilence: true,
        canPreemptCrowd: true,
        canPreemptHelper: true,
        canPreemptDealRoom: true,
      },
      {
        interrupterActorKind: 'HELPER',
        priority: rescueNow ? 'ABSOLUTE' : 'HIGH',
        canBreakSilence: rescueNow || inDealRoom,
        canPreemptCrowd: true,
        canPreemptHelper: false,
        canPreemptDealRoom: false,
      },
      {
        interrupterActorKind: 'DEAL_AGENT',
        priority: inDealRoom ? 'ABSOLUTE' : 'HIGH',
        canBreakSilence: inDealRoom,
        canPreemptCrowd: true,
        canPreemptHelper: false,
        canPreemptDealRoom: inDealRoom,
      },
      {
        interrupterActorKind: 'HATER',
        priority:
          input.momentType === 'SHIELD_BREACH' || input.momentType === 'PRESSURE_SURGE'
            ? 'CRITICAL'
            : 'HIGH',
        canBreakSilence: false,
        canPreemptCrowd: true,
        canPreemptHelper: false,
        canPreemptDealRoom: false,
      },
      {
        interrupterActorKind: 'CROWD',
        priority:
          input.momentType === 'LEGEND_MOMENT' || input.momentType === 'COMEBACK'
            ? 'HIGH'
            : 'LOW',
        canBreakSilence: false,
        canPreemptCrowd: false,
        canPreemptHelper: false,
        canPreemptDealRoom: false,
      },
    ];
  }

  private collectRelationships(input: ChatDramaPlanningInput): readonly ChatRelationshipState[] {
    if (input.relationships?.length) return input.relationships;
    return Object.values(input.state?.relationshipsByCounterpartId ?? {});
  }

  private selectDominantBotId(
    input: ChatDramaPlanningInput,
    momentType: ChatMomentType,
  ): BotId | undefined {
    if (input.signal.botId) return input.signal.botId;

    const relationships = this.collectRelationships(input);
    const mostIntense = [...relationships]
      .sort((left, right) => {
        const leftScore =
          this.score100(left.vector.rivalryIntensity) +
          this.score100(left.vector.contempt) +
          this.score100(left.vector.fear);
        const rightScore =
          this.score100(right.vector.rivalryIntensity) +
          this.score100(right.vector.contempt) +
          this.score100(right.vector.fear);
        return rightScore - leftScore;
      })
      .find((entry) => entry.counterpartId.startsWith('BOT_'));

    if (mostIntense?.counterpartId) {
      return mostIntense.counterpartId as BotId;
    }

    switch (momentType) {
      case 'DEAL_ROOM_STANDOFF':
        return 'BOT_01' as BotId;
      case 'PRESSURE_SURGE':
      case 'SHIELD_BREACH':
        return 'BOT_04' as BotId;
      case 'COMEBACK':
      case 'LEGEND_MOMENT':
        return 'BOT_05' as BotId;
      default:
        return 'BOT_03' as BotId;
    }
  }

  private selectHelperPersona(
    input: ChatDramaPlanningInput,
    momentType: ChatMomentType,
  ): HelperPersonaDefinition | undefined {
    const affect = input.state?.affect;
    const embarrassment = this.score100(affect?.socialEmbarrassment);
    const desperation = this.score100(affect?.desperation);
    const confidence = this.score100(affect?.confidence);
    const helperReceptivity = this.score100(
      input.learningProfile?.helperReceptivity ?? input.state?.learningProfile?.helperReceptivity,
    );

    if (
      !input.signal.forceHelper &&
      momentType !== 'HELPER_RESCUE' &&
      helperReceptivity < 35 &&
      confidence > 62
    ) {
      return undefined;
    }

    if (embarrassment >= 72 || desperation >= 80 || momentType === 'HELPER_RESCUE') {
      return HELPER_PERSONAS.find((persona) => persona.personaId === 'SURVIVOR');
    }

    if (momentType === 'DEAL_ROOM_STANDOFF') {
      return HELPER_PERSONAS.find((persona) => persona.personaId === 'INSIDER');
    }

    if (confidence >= 65 && momentType === 'COMEBACK') {
      return HELPER_PERSONAS.find((persona) => persona.personaId === 'RIVAL');
    }

    return HELPER_PERSONAS.find((persona) => persona.personaId === 'MENTOR');
  }

  private systemNoticeLine(
    input: ChatDramaPlanningInput,
    momentType: ChatMomentType,
    channel: ChatVisibleChannel,
  ): string | undefined {
    const reason = input.signal.reason?.trim();
    switch (momentType) {
      case 'RUN_START':
        return reason ?? 'Run live. The room is now watching.';
      case 'RUN_END':
        return reason ?? 'Run closed. Witness remains.';
      case 'PRESSURE_SURGE':
        return reason ?? 'Pressure rising. Emotional leakage now costs more.';
      case 'SHIELD_BREACH':
        return reason ?? 'Shield breach visible. The room now has a witness point.';
      case 'DEAL_ROOM_STANDOFF':
        return reason ?? 'Deal room tension elevated. Delay and cadence now carry price.';
      case 'COMEBACK':
        return reason ?? 'Momentum reversal detected. The room noticed.';
      case 'LEGEND_MOMENT':
        return reason ?? 'Legend candidate detected. The room is marking this line.';
      case 'WORLD_EVENT':
        return reason ?? 'World event pressure injected into chat.';
      default:
        return channel === 'GLOBAL'
          ? 'The room has updated its posture.'
          : undefined;
    }
  }

  private mapSystemKind(momentType: ChatMomentType): ChatMessageKind {
    switch (momentType) {
      case 'WORLD_EVENT':
        return 'WORLD_EVENT';
      case 'LEGEND_MOMENT':
        return 'LEGEND_MOMENT';
      case 'RUN_END':
        return 'POST_RUN_RITUAL';
      case 'SHIELD_BREACH':
        return 'SHIELD_EVENT';
      default:
        return 'SYSTEM';
    }
  }

  private haterDisplayName(botId: BotId): string {
    switch (botId) {
      case 'BOT_01':
        return 'THE LIQUIDATOR';
      case 'BOT_02':
        return 'THE BUREAUCRAT';
      case 'BOT_03':
        return 'THE MANIPULATOR';
      case 'BOT_04':
        return 'THE CRASH PROPHET';
      case 'BOT_05':
        return 'THE LEGACY HEIR';
      default:
        return 'HATER';
    }
  }

  private haterEmoji(botId: BotId): string | undefined {
    switch (botId) {
      case 'BOT_01':
        return '⚔️';
      case 'BOT_02':
        return '📑';
      case 'BOT_03':
        return '🪤';
      case 'BOT_04':
        return '☠️';
      case 'BOT_05':
        return '👑';
      default:
        return undefined;
    }
  }

  private crowdDisplayName(channel: ChatVisibleChannel): string {
    switch (channel) {
      case 'SYNDICATE':
        return 'SYNDICATE';
      case 'DEAL_ROOM':
        return 'THE TABLE';
      case 'LOBBY':
        return 'LOBBY';
      default:
        return 'THE ROOM';
    }
  }

  private collectRecentBodies(
    state: ChatDramaPlanningInput['state'],
    channel: ChatVisibleChannel,
  ): readonly string[] {
    return (state?.messagesByChannel?.[channel] ?? [])
      .slice(-16)
      .map((message) => message.body);
  }

  private matchRelationshipIds(
    relationships: readonly ChatRelationshipState[],
    botId: BotId,
  ): readonly ChatRelationshipId[] | undefined {
    const ids = relationships
      .filter((entry) => entry.counterpartId === botId)
      .map((entry) => entry.relationshipId);

    return ids.length > 0 ? ids : undefined;
  }

  private collectCrowdRelationshipIds(
    relationships: readonly ChatRelationshipState[],
  ): readonly ChatRelationshipId[] | undefined {
    const ids = relationships
      .filter((entry) => entry.counterpartKind === 'CROWD')
      .slice(0, 3)
      .map((entry) => entry.relationshipId);

    return ids.length > 0 ? ids : undefined;
  }

  private toPersonaPressureBand(pressureTier: PressureTier | undefined): PersonaPressureBand {
    switch (pressureTier) {
      case 'CALM':
        return 'LOW';
      case 'WATCHFUL':
        return 'MEDIUM';
      case 'PRESSURED':
        return 'HIGH';
      case 'CRITICAL':
      case 'BREAKPOINT':
        return 'CRITICAL';
      default:
        return 'MEDIUM';
    }
  }

  private shouldOpenWithHater(momentType: ChatMomentType, channel: ChatVisibleChannel): boolean {
    if (channel === 'DEAL_ROOM') return true;
    return (
      momentType === 'PRESSURE_SURGE' ||
      momentType === 'SHIELD_BREACH' ||
      momentType === 'BOT_ATTACK' ||
      momentType === 'DEAL_ROOM_STANDOFF'
    );
  }

  private shouldCrowdWitness(
    input: ChatDramaPlanningInput,
    channel: ChatVisibleChannel,
    momentType: ChatMomentType,
  ): boolean {
    if (input.signal.forceCrowdWitness) return true;
    if (channel === 'SYNDICATE' && momentType === 'DEAL_ROOM_STANDOFF') return false;
    if (channel === 'DEAL_ROOM') return true;
    return (
      channel === 'GLOBAL' ||
      momentType === 'COMEBACK' ||
      momentType === 'LEGEND_MOMENT' ||
      momentType === 'RUN_END'
    );
  }

  private shouldOfferHelperPresence(
    input: ChatDramaPlanningInput,
    momentType: ChatMomentType,
  ): boolean {
    if (input.signal.forceHelper) return true;
    if (momentType === 'RUN_START' || momentType === 'COMEBACK') return true;
    return this.score100(input.state?.affect?.frustration) >= 58;
  }

  private shouldDelayHater(
    momentType: ChatMomentType,
    forceSilence: boolean | undefined,
  ): boolean {
    return forceSilence === true || momentType === 'SHIELD_BREACH' || momentType === 'DEAL_ROOM_STANDOFF';
  }

  private haterDelayMs(momentType: ChatMomentType): number {
    switch (momentType) {
      case 'DEAL_ROOM_STANDOFF':
        return 950;
      case 'SHIELD_BREACH':
        return 820;
      case 'COMEBACK':
        return 300;
      default:
        return 240;
    }
  }

  private helperDelayMs(
    momentType: ChatMomentType,
    helperPersona: HelperPersonaDefinition,
  ): number {
    if (momentType === 'HELPER_RESCUE') return 0;
    if (momentType === 'DEAL_ROOM_STANDOFF') return 1200;
    if (helperPersona.personaId === 'SURVIVOR') return 920;
    if (helperPersona.personaId === 'RIVAL') return 460;
    return 700;
  }

  private silenceDurationMs(
    momentType: ChatMomentType,
    channel: ChatVisibleChannel,
    rescuePlanned: boolean,
  ): number {
    if (channel === 'DEAL_ROOM') return 1600;
    if (rescuePlanned) return 1450;
    if (momentType === 'SHIELD_BREACH') return 1350;
    if (momentType === 'RUN_END') return 1800;
    return 900;
  }

  private helperIntent(
    momentType: ChatMomentType,
    rescue?: ChatRescueDecision,
  ): keyof HelperPersonaDefinition['linesByIntent'] {
    if (rescue?.intent === 'PROTECT_DIGNITY') return 'PROTECT_DIGNITY';
    if (rescue?.intent === 'OFFER_EXIT') return 'OFFER_EXIT';
    if (momentType === 'DEAL_ROOM_STANDOFF') return 'WARN';
    if (momentType === 'COMEBACK' || momentType === 'LEGEND_MOMENT') return 'COACH';
    if (momentType === 'RUN_END') return 'CALM';
    return 'SIMPLIFY';
  }

  private pickCrowdLine(
    channel: ChatVisibleChannel,
    mood: 'CALM' | 'HOSTILE' | 'ECSTATIC' | 'MOURNFUL',
    now: number,
  ): string {
    const voice = CROWD_VOICES.find((entry) => entry.channel === channel) ?? CROWD_VOICES[0];
    const pool =
      mood === 'HOSTILE'
        ? voice.hostile
        : mood === 'ECSTATIC'
          ? voice.ecstasy
          : mood === 'MOURNFUL'
            ? voice.mournful
            : voice.calm;
    return pool[Math.abs(now) % pool.length];
  }

  private pickHelperLine(
    helperPersona: HelperPersonaDefinition,
    intent: keyof HelperPersonaDefinition['linesByIntent'],
    now: number,
  ): string {
    const pool = helperPersona.linesByIntent[intent];
    return pool[Math.abs(now + helperPersona.personaId.length) % pool.length];
  }

  private deriveCrowdMood(
    input: ChatDramaPlanningInput,
    channel: ChatVisibleChannel,
    momentType: ChatMomentType,
  ): 'CALM' | 'HOSTILE' | 'ECSTATIC' | 'MOURNFUL' {
    if (channel === 'DEAL_ROOM') return 'HOSTILE';
    if (momentType === 'COMEBACK' || momentType === 'LEGEND_MOMENT') return 'ECSTATIC';
    if (momentType === 'RUN_END') return 'MOURNFUL';
    if (
      momentType === 'SHIELD_BREACH' ||
      momentType === 'PRESSURE_SURGE' ||
      this.score100(input.state?.affect?.socialEmbarrassment) >= 72
    ) {
      return 'HOSTILE';
    }
    return 'CALM';
  }

  private heatDelta(
    momentType: ChatMomentType,
    haterPresent: boolean,
    rescue?: ChatRescueDecision,
  ): number {
    let delta = 0;
    switch (momentType) {
      case 'PRESSURE_SURGE':
      case 'SHIELD_BREACH':
        delta += 18;
        break;
      case 'COMEBACK':
        delta += 14;
        break;
      case 'DEAL_ROOM_STANDOFF':
        delta += 12;
        break;
      case 'LEGEND_MOMENT':
        delta += 22;
        break;
      case 'RUN_END':
        delta += 8;
        break;
      default:
        delta += 4;
        break;
    }

    if (haterPresent) delta += 6;
    if (rescue) delta += 3;
    return delta;
  }

  private score100(value: Score100 | undefined): number {
    if (value == null || Number.isNaN(Number(value))) return 0;
    const numeric = Number(value);
    if (numeric <= 0) return 0;
    if (numeric >= 100) return 100;
    return Math.round(numeric);
  }

  private toScore100(value: number): Score100 {
    if (Number.isNaN(value) || value <= 0) return 0 as Score100;
    if (value >= 100) return 100 as Score100;
    return Math.round(value) as Score100;
  }
}

export function createChatDramaDirector(
  options?: ChatDramaDirectorOptions,
): ChatDramaDirector {
  return new ChatDramaDirector(options);
}
