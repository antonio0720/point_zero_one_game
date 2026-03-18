/**
 * @file backend/src/game/engine/chat/experience/ChatDramaOrchestrator.ts
 * @description
 * Canonical backend drama orchestrator for cinematic chat scenes.
 *
 * This class does four things and only four things:
 * 1) Gather authoritative backend context from existing repo services.
 * 2) Ask ChatScenePlanner for a scene plan using shared contracts.
 * 3) Materialize that plan into canonical backend chat messages using the
 *    repo's ChatMessageFactory and response authorities.
 * 4) Archive the scene so continuity, callbacks, replay, and post-run ritual
 *    systems have durable state to work with later.
 *
 * It does not own transport. It does not own reducers. It does not own frontend
 * dock state. It sits inside backend authority where relationship, memory,
 * player modeling, and hater/helper response logic already live.
 */

import type {
  SharedChatMomentType,
  SharedChatScene,
  SharedChatSceneBeat,
  SharedChatScenePlannerInput,
} from '../../../../../../shared/contracts/chat/scene';

import { ChatSceneArchiveService } from '../ChatSceneArchiveService';
import { ChatRelationshipService } from '../ChatRelationshipService';
import { ChatMemoryService } from '../ChatMemoryService';
import { ChatPlayerModelService } from '../ChatPlayerModelService';
import {
  createHelperInterventionMessage,
  createHaterEscalationMessage,
  createLegendMomentMessage,
  createQuoteCallbackMessage,
  createShadowAnnotation,
  createSystemMessage,
} from '../ChatMessageFactory';
import {
  createHaterResponseAuthority,
  type HaterResponseAuthority,
} from '../HaterResponseOrchestrator';
import {
  createHelperResponseAuthority,
  type HelperResponseAuthority,
} from '../HelperResponseOrchestrator';
import {
  ChatScenePlanner,
  type ChatScenePlannerDecisionWithTelemetry,
  type ChatScenePlannerConfig,
} from './ChatScenePlanner';

/* ========================================================================== *
 * MARK: Loose authority-facing aliases
 * ========================================================================== */

export type AuthoritativeChatState = any;
export type AuthoritativeChatRoom = any;
export type AuthoritativeChatMessage = any;

/* ========================================================================== *
 * MARK: Orchestrator contracts
 * ========================================================================== */

export interface ChatDramaLogger {
  debug(message: string, payload?: Record<string, unknown>): void;
  info(message: string, payload?: Record<string, unknown>): void;
  warn(message: string, payload?: Record<string, unknown>): void;
  error(message: string, payload?: Record<string, unknown>): void;
}

export interface ChatDramaMomentEnvelope {
  readonly playerId: string;
  readonly roomId: string;
  readonly primaryChannelId: string;
  readonly now: string;
  readonly momentId: string;
  readonly momentType: SharedChatMomentType;
  readonly state: AuthoritativeChatState;
  readonly room: AuthoritativeChatRoom;
  readonly causeEventId?: string;
  readonly pressureTier?: string;
  readonly candidateBotIds?: readonly string[];
  readonly helperIds?: readonly string[];
  readonly worldTags?: readonly string[];
  readonly pendingRevealPayloadIds?: readonly string[];
  readonly metadata?: Record<string, unknown>;
}

export interface ChatDramaBeatDescriptor {
  readonly beat: SharedChatSceneBeat;
  readonly message?: AuthoritativeChatMessage;
  readonly shadowMessage?: AuthoritativeChatMessage;
  readonly speakerId?: string;
  readonly callbackAnchorIds: readonly string[];
  readonly tags: readonly string[];
}

export interface ChatDramaMaterialization {
  readonly envelope: ChatDramaMomentEnvelope;
  readonly plannerDecision: ChatScenePlannerDecisionWithTelemetry;
  readonly scene: SharedChatScene;
  readonly archiveRecord: any;
  readonly visibleMessages: readonly AuthoritativeChatMessage[];
  readonly shadowMessages: readonly AuthoritativeChatMessage[];
  readonly beatDescriptors: readonly ChatDramaBeatDescriptor[];
  readonly chosenSpeakerIds: readonly string[];
  readonly chosenCallbackAnchorIds: readonly string[];
  readonly chosenTags: readonly string[];
}

export interface ChatDramaOrchestratorConfig {
  readonly enableLegendPromotion: boolean;
  readonly enableRevealQuotes: boolean;
  readonly enableShadowAnnotations: boolean;
  readonly enableOutcomeArchival: boolean;
  readonly allowCrowdAsVisibleBeat: boolean;
  readonly maxVisibleMessages: number;
  readonly maxShadowMessages: number;
  readonly planner?: Partial<ChatScenePlannerConfig>;
}

const DEFAULT_CHAT_DRAMA_ORCHESTRATOR_CONFIG: ChatDramaOrchestratorConfig = {
  enableLegendPromotion: true,
  enableRevealQuotes: true,
  enableShadowAnnotations: true,
  enableOutcomeArchival: true,
  allowCrowdAsVisibleBeat: true,
  maxVisibleMessages: 8,
  maxShadowMessages: 12,
  planner: {},
};

/* ========================================================================== *
 * MARK: Utility
 * ========================================================================== */

const defaultLogger: ChatDramaLogger = {
  debug(message, payload) {
    void message;
    void payload;
  },
  info(message, payload) {
    void message;
    void payload;
  },
  warn(message, payload) {
    void message;
    void payload;
  },
  error(message, payload) {
    console.error(message, payload);
  },
};

function clamp01(value: number): number {
  if (!isFinite(value) || isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function uniq(values: readonly string[]): string[] {
  const out: string[] = [];
  const seen: Record<string, true> = Object.create(null);
  for (const value of values) {
    if (!value || seen[value]) continue;
    seen[value] = true;
    out.push(value);
  }
  return out;
}

function asVisibleChannel(value: string): string {
  const upper = String(value ?? '').toUpperCase();
  if (['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'DIRECT', 'SPECTATOR'].indexOf(upper) >= 0) {
    return upper;
  }
  return 'GLOBAL';
}

function summarizePressure(pressureTier?: string): number {
  switch (String(pressureTier ?? '').toUpperCase()) {
    case 'CALM':
      return 0.1;
    case 'WATCHFUL':
      return 0.3;
    case 'PRESSURED':
      return 0.55;
    case 'CRITICAL':
      return 0.82;
    case 'BREAKPOINT':
      return 0.97;
    default:
      return 0.42;
  }
}

function sceneReceiptLabel(scene: SharedChatScene): string {
  return `${scene.archetype}:${scene.stageMood}:${scene.momentType}`;
}

function normalizeSharedChannel(value: string): string {
  return asVisibleChannel(value);
}

function dominantWorldTagsFromPlayerModel(snapshot: any): readonly string[] {
  if (!snapshot || typeof snapshot !== 'object') return [];
  const dominantAxes = Array.isArray(snapshot?.dominantAxes) ? snapshot.dominantAxes : [];
  const tags = dominantAxes.slice(0, 4).map((axis: any) => `PLAYER_MODEL:${String(axis?.axis ?? axis)}`);
  return uniq(tags);
}

function relationshipSummaryToSceneState(summary: any): any {
  const primary = Array.isArray(summary?.counterparts) ? summary.counterparts[0] : undefined;
  if (!primary) return undefined;
  return {
    counterpartId: primary.counterpartId,
    stance: primary.stance,
    objective: primary.objective,
    intensity01: primary.intensity01,
    volatility01: primary.volatility01,
    obsession01: primary.obsession01,
    predictiveConfidence01: primary.predictiveConfidence01,
    unfinishedBusiness01: primary.unfinishedBusiness01,
    respect01: primary.respect01,
    fear01: primary.fear01,
    contempt01: primary.contempt01,
    familiarity01: primary.familiarity01,
    callbackHints: primary.callbackCount,
  };
}

function memoryAnchorToSceneAnchor(entry: any): any {
  return {
    anchorId: String(entry?.anchorId ?? entry?.id ?? ''),
    salience01: clamp01(
      typeof entry?.salience01 === 'number'
        ? entry.salience01
        : typeof entry?.score01 === 'number'
          ? entry.score01
          : 0.4,
    ),
    callbackWeight01: clamp01(
      typeof entry?.callbackWeight01 === 'number'
        ? entry.callbackWeight01
        : typeof entry?.salience01 === 'number'
          ? entry.salience01
          : 0.4,
    ),
    unresolved: Boolean(entry?.unresolved),
    tags: Array.isArray(entry?.tags) ? entry.tags : [],
    excerpt: entry?.excerpt,
    counterpartId: entry?.counterpartId,
    sourceMessageId: entry?.sourceMessageId,
  };
}

function candidateText(prefix: string, scene: SharedChatScene, beat: SharedChatSceneBeat, extras?: string): string {
  const base = `${prefix} [${scene.stageMood}] [${scene.momentType}]`;
  return extras ? `${base} ${extras}` : base;
}

function inferSignatureSuffix(speakerId?: string): string | undefined {
  if (!speakerId) return undefined;
  if (speakerId === 'CROWD') return undefined;
  if (speakerId.indexOf('CALLBACK:') === 0) return undefined;
  return undefined;
}

function buildRelationshipInput(relationshipSummary: any): any {
  return relationshipSummaryToSceneState(relationshipSummary);
}

function buildMemoryAnchors(memorySelections: readonly any[]): readonly any[] {
  return memorySelections.map(memoryAnchorToSceneAnchor);
}

function buildPlannerInput(
  envelope: ChatDramaMomentEnvelope,
  relationshipSummary: any,
  memorySelections: readonly any[],
  playerModelSnapshot: any,
  carryoverSummary: any,
): SharedChatScenePlannerInput {
  return {
    playerId: envelope.playerId,
    roomId: envelope.roomId,
    now: envelope.now,
    momentId: envelope.momentId,
    momentType: envelope.momentType,
    primaryChannel: normalizeSharedChannel(envelope.primaryChannelId),
    pressureTier: envelope.pressureTier as any,
    relationshipState: buildRelationshipInput(relationshipSummary),
    memoryAnchors: buildMemoryAnchors(memorySelections),
    unresolvedMomentIds: Array.isArray(carryoverSummary?.unresolvedSceneIds) ? carryoverSummary.unresolvedSceneIds : [],
    carriedPersonaIds: Array.isArray(carryoverSummary?.activeCounterpartIds) ? carryoverSummary.activeCounterpartIds : [],
    pendingRevealPayloadIds: Array.isArray(envelope.pendingRevealPayloadIds) ? envelope.pendingRevealPayloadIds : [],
    candidateBotIds: Array.isArray(envelope.candidateBotIds) ? envelope.candidateBotIds : [],
    helperIds: Array.isArray(envelope.helperIds) ? envelope.helperIds : [],
    worldTags: uniq([
      ...(Array.isArray(envelope.worldTags) ? envelope.worldTags : []),
      ...dominantWorldTagsFromPlayerModel(playerModelSnapshot),
    ]),
  };
}

function systemLineForBeat(scene: SharedChatScene, beat: SharedChatSceneBeat, envelope: ChatDramaMomentEnvelope): string {
  switch (beat.beatType) {
    case 'SYSTEM_NOTICE':
      switch (scene.momentType) {
        case 'RUN_START':
          return 'Run live. The room is watching.';
        case 'PRESSURE_SURGE':
          return 'Pressure rising. Reaction windows narrowing.';
        case 'SHIELD_BREACH':
          return 'Shield breach confirmed. Exposure rising.';
        case 'CASCADE_TRIGGER':
          return 'Cascade vector detected. Stability compromised.';
        case 'BOT_ATTACK':
          return 'Hostile pressure entering the lane.';
        case 'BOT_RETREAT':
          return 'Hostile pressure eased. The room noticed.';
        case 'HELPER_RESCUE':
          return 'Recovery vector opened.';
        case 'DEAL_ROOM_STANDOFF':
          return 'Deal room tone hardening.';
        case 'SOVEREIGN_APPROACH':
          return 'Sovereignty within reach. Margin for error collapsing.';
        case 'SOVEREIGN_ACHIEVED':
          return 'Sovereignty secured.';
        case 'LEGEND_MOMENT':
          return 'Legend condition recognized.';
        case 'RUN_END':
          return 'Run closed. Reckoning in progress.';
        case 'WORLD_EVENT':
          return 'World event intrusion detected.';
        default:
          return 'Moment registered.';
      }
    case 'REVEAL':
      return 'The room remembers.';
    case 'POST_BEAT_ECHO':
      return 'Echo preserved.';
    default:
      return candidateText('SYSTEM', scene, beat);
  }
}

function haterLineForBeat(
  scene: SharedChatScene,
  beat: SharedChatSceneBeat,
  envelope: ChatDramaMomentEnvelope,
  relationshipSummary: any,
): string {
  const counterpart = Array.isArray(relationshipSummary?.counterparts) ? relationshipSummary.counterparts[0] : undefined;
  const unfinished = clamp01(counterpart?.unfinishedBusiness01 ?? 0);
  const contempt = clamp01(counterpart?.contempt01 ?? 0);
  const respect = clamp01(counterpart?.respect01 ?? 0);

  if (scene.momentType === 'SHIELD_BREACH') {
    return unfinished > 0.6
      ? 'There it is. You always crack at the exact second you swear you will not.'
      : 'Shield open. Everyone saw it.';
  }

  if (scene.momentType === 'DEAL_ROOM_STANDOFF') {
    return contempt > 0.5
      ? 'You came in loud and now you are pricing your own panic.'
      : 'Your stall is information.';
  }

  if (scene.momentType === 'SOVEREIGN_APPROACH') {
    return respect > 0.6
      ? 'Do not celebrate early. Earn the last move.'
      : 'So close. This is where you usually blink.';
  }

  if (scene.momentType === 'RUN_END') {
    return unfinished > 0.45
      ? 'You left work unfinished. Again.'
      : 'That ending belongs to the room now.';
  }

  return candidateText('HATER', scene, beat, `moment=${envelope.momentType}`);
}

function helperLineForBeat(
  scene: SharedChatScene,
  beat: SharedChatSceneBeat,
  envelope: ChatDramaMomentEnvelope,
  playerModelSnapshot: any,
): string {
  const dominantAxes = Array.isArray(playerModelSnapshot?.dominantAxes) ? playerModelSnapshot.dominantAxes.map((axis: any) => String(axis?.axis ?? axis)) : [];
  const collapseProne = dominantAxes.indexOf('COLLAPSE_PRONE') >= 0;
  const rescueReliant = dominantAxes.indexOf('RESCUE_RELIANT') >= 0;
  const publicPerformer = dominantAxes.indexOf('PUBLIC_PERFORMER') >= 0;

  if (scene.momentType === 'SHIELD_BREACH') {
    return collapseProne
      ? 'Stop defending your pride. Recover your footing first.'
      : 'Reset one layer at a time. Do not feed the breach.';
  }

  if (scene.momentType === 'DEAL_ROOM_STANDOFF') {
    return publicPerformer
      ? 'Say less. Silence raises their uncertainty.'
      : 'Hold your line and make them price the next move.';
  }

  if (scene.momentType === 'RUN_END') {
    return rescueReliant
      ? 'We keep the receipt, not the shame. Learn the turn and carry it forward.'
      : 'Name the turning point and keep the lesson.';
  }

  return candidateText('HELPER', scene, beat, `moment=${envelope.momentType}`);
}

function crowdLineForBeat(scene: SharedChatScene, beat: SharedChatSceneBeat): string {
  switch (scene.momentType) {
    case 'SHIELD_BREACH':
      return 'The channel tightens. Screenshots energy.';
    case 'SOVEREIGN_ACHIEVED':
      return 'The room flips from doubt to witness.';
    case 'LEGEND_MOMENT':
      return 'This one travels.';
    default:
      return candidateText('CROWD', scene, beat);
  }
}

function revealLineForBeat(scene: SharedChatScene, beat: SharedChatSceneBeat, callbackAnchorIds: readonly string[]): string {
  if (!callbackAnchorIds.length) {
    return 'The callback did not surface cleanly.';
  }
  const anchorId = callbackAnchorIds[0];
  switch (scene.momentType) {
    case 'SHIELD_BREACH':
      return `Receipt loaded from ${anchorId}. The room remembers your earlier confidence.`;
    case 'RUN_END':
      return `Receipt loaded from ${anchorId}. The ending rhymes with what came before.`;
    case 'SOVEREIGN_APPROACH':
      return `Receipt loaded from ${anchorId}. This is not the first time the room has seen this edge.`;
    default:
      return `Receipt loaded from ${anchorId}.`;
  }
}

function createCanonicalDescriptor(
  beat: SharedChatSceneBeat,
  message: AuthoritativeChatMessage | undefined,
  shadowMessage: AuthoritativeChatMessage | undefined,
  callbackAnchorIds: readonly string[],
): ChatDramaBeatDescriptor {
  return {
    beat,
    message,
    shadowMessage,
    speakerId: String(beat.speakerId ?? ''),
    callbackAnchorIds,
    tags: Array.isArray(beat.tags) ? beat.tags : [],
  };
}

/* ========================================================================== *
 * MARK: Message materializers
 * ========================================================================== */

function buildSystemMessage(
  envelope: ChatDramaMomentEnvelope,
  scene: SharedChatScene,
  beat: SharedChatSceneBeat,
): AuthoritativeChatMessage {
  return createSystemMessage({
    roomId: envelope.roomId,
    channelId: beat.channelId ?? envelope.primaryChannelId,
    text: systemLineForBeat(scene, beat, envelope),
    metadata: {
      momentId: envelope.momentId,
      momentType: envelope.momentType,
      sceneId: scene.sceneId,
      archetype: scene.archetype,
      stageMood: scene.stageMood,
      beatId: beat.beatId,
      beatType: beat.beatType,
    },
  } as any);
}

function buildHaterMessage(
  envelope: ChatDramaMomentEnvelope,
  scene: SharedChatScene,
  beat: SharedChatSceneBeat,
  relationshipSummary: any,
): AuthoritativeChatMessage {
  return createHaterEscalationMessage({
    roomId: envelope.roomId,
    channelId: beat.channelId ?? envelope.primaryChannelId,
    persona: {
      personaId: beat.speakerId,
      botId: beat.speakerId,
    },
    text: haterLineForBeat(scene, beat, envelope, relationshipSummary),
    escalationTier:
      scene.archetype === 'PUBLIC_HUMILIATION_SCENE'
        ? 'HARD'
        : scene.archetype === 'TRAP_SCENE'
          ? 'MEDIUM'
          : scene.momentType === 'SOVEREIGN_APPROACH'
            ? 'BOSS'
            : 'SOFT',
    attackWindowOpen: scene.momentType === 'BOT_ATTACK' || scene.momentType === 'DEAL_ROOM_STANDOFF',
    metadata: {
      momentId: envelope.momentId,
      momentType: envelope.momentType,
      sceneId: scene.sceneId,
      beatId: beat.beatId,
      beatType: beat.beatType,
      speakerId: beat.speakerId,
    },
  } as any);
}

function buildHelperMessage(
  envelope: ChatDramaMomentEnvelope,
  scene: SharedChatScene,
  beat: SharedChatSceneBeat,
  playerModelSnapshot: any,
): AuthoritativeChatMessage {
  return createHelperInterventionMessage({
    roomId: envelope.roomId,
    channelId: beat.channelId ?? envelope.primaryChannelId,
    persona: {
      personaId: beat.speakerId,
      botId: beat.speakerId,
    },
    text: helperLineForBeat(scene, beat, envelope, playerModelSnapshot),
    rescueReason:
      scene.momentType === 'SHIELD_BREACH'
        ? 'BREACH_RECOVERY'
        : scene.momentType === 'RUN_END'
          ? 'POST_RUN_DEBRIEF'
          : 'PRESSURE_RELIEF',
    recoveryWindowSuggested: scene.momentType === 'SHIELD_BREACH' || scene.momentType === 'RUN_END',
    metadata: {
      momentId: envelope.momentId,
      momentType: envelope.momentType,
      sceneId: scene.sceneId,
      beatId: beat.beatId,
      beatType: beat.beatType,
      speakerId: beat.speakerId,
    },
  } as any);
}

function buildRevealMessage(
  envelope: ChatDramaMomentEnvelope,
  scene: SharedChatScene,
  beat: SharedChatSceneBeat,
  callbackAnchorIds: readonly string[],
): AuthoritativeChatMessage {
  return createQuoteCallbackMessage({
    roomId: envelope.roomId,
    channelId: beat.channelId ?? envelope.primaryChannelId,
    text: revealLineForBeat(scene, beat, callbackAnchorIds),
    quotingText: callbackAnchorIds[0] ? `Anchor ${callbackAnchorIds[0]}` : 'No anchor',
    metadata: {
      momentId: envelope.momentId,
      momentType: envelope.momentType,
      sceneId: scene.sceneId,
      beatId: beat.beatId,
      beatType: beat.beatType,
      callbackAnchorIds,
    },
  } as any);
}

function buildLegendMessage(
  envelope: ChatDramaMomentEnvelope,
  scene: SharedChatScene,
  beat: SharedChatSceneBeat,
): AuthoritativeChatMessage {
  return createLegendMomentMessage({
    roomId: envelope.roomId,
    channelId: beat.channelId ?? envelope.primaryChannelId,
    text:
      scene.momentType === 'SOVEREIGN_ACHIEVED'
        ? 'Sovereignty under pressure. This run enters legend state.'
        : 'Legend window captured.',
    legendId: `LEGEND:${envelope.momentId}`,
    sceneId: scene.sceneId,
    momentId: envelope.momentId,
    metadata: {
      momentType: envelope.momentType,
      beatId: beat.beatId,
      beatType: beat.beatType,
    },
  } as any);
}

function buildShadowReceipt(
  envelope: ChatDramaMomentEnvelope,
  scene: SharedChatScene,
  beat: SharedChatSceneBeat,
  text: string,
  shadowTag: 'SYSTEM' | 'NPC' | 'RIVALRY' | 'RESCUE' | 'LIVEOPS',
): AuthoritativeChatMessage {
  return createShadowAnnotation({
    roomId: envelope.roomId,
    channelId: beat.channelId ?? envelope.primaryChannelId,
    text,
    shadowTag,
    metadata: {
      momentId: envelope.momentId,
      sceneId: scene.sceneId,
      beatId: beat.beatId,
      beatType: beat.beatType,
      archetype: scene.archetype,
      receipt: sceneReceiptLabel(scene),
    },
  } as any);
}

/* ========================================================================== *
 * MARK: Orchestrator
 * ========================================================================== */

export class ChatDramaOrchestrator {
  private readonly planner: ChatScenePlanner;
  private readonly archiveService: ChatSceneArchiveService;
  private readonly relationshipService: ChatRelationshipService;
  private readonly memoryService: ChatMemoryService;
  private readonly playerModelService: ChatPlayerModelService;
  private readonly haterAuthority: HaterResponseAuthority;
  private readonly helperAuthority: HelperResponseAuthority;
  private readonly logger: ChatDramaLogger;
  private readonly config: ChatDramaOrchestratorConfig;

  public constructor(args?: {
    planner?: ChatScenePlanner;
    archiveService?: ChatSceneArchiveService;
    relationshipService?: ChatRelationshipService;
    memoryService?: ChatMemoryService;
    playerModelService?: ChatPlayerModelService;
    haterAuthority?: HaterResponseAuthority;
    helperAuthority?: HelperResponseAuthority;
    logger?: ChatDramaLogger;
    config?: Partial<ChatDramaOrchestratorConfig>;
  }) {
    this.config = { ...DEFAULT_CHAT_DRAMA_ORCHESTRATOR_CONFIG, ...(args?.config ?? {}) };
    this.planner = args?.planner ?? new ChatScenePlanner(this.config.planner);
    this.archiveService = args?.archiveService ?? new ChatSceneArchiveService();
    this.relationshipService = args?.relationshipService ?? new ChatRelationshipService();
    this.memoryService = args?.memoryService ?? new ChatMemoryService();
    this.playerModelService = args?.playerModelService ?? new ChatPlayerModelService();
    this.haterAuthority = args?.haterAuthority ?? createHaterResponseAuthority();
    this.helperAuthority = args?.helperAuthority ?? createHelperResponseAuthority();
    this.logger = args?.logger ?? defaultLogger;
  }

  public planAndMaterialize(envelope: ChatDramaMomentEnvelope): ChatDramaMaterialization {
    const relationshipSummary = this.relationshipService.summarize(envelope.playerId);
    const playerModelSnapshot = this.playerModelService.getSnapshot(envelope.playerId);
    const carryoverSummary = this.archiveService.buildCarryoverSummary(envelope.playerId);

    const memorySelections = this.memoryService.selectCallbacks({
      playerId: envelope.playerId,
      roomId: envelope.roomId,
      channelId: envelope.primaryChannelId,
      counterpartId: Array.isArray(relationshipSummary?.counterparts)
        ? (relationshipSummary.counterparts[0] ? relationshipSummary.counterparts[0].counterpartId : undefined)
        : undefined,
      limit: 5,
      minSalience01: summarizePressure(envelope.pressureTier) > 0.8 ? 0.25 : 0.4,
    } as any);

    const plannerInput = buildPlannerInput(
      envelope,
      relationshipSummary,
      Array.isArray(memorySelections) ? memorySelections : [],
      playerModelSnapshot,
      carryoverSummary,
    );

    const plannerDecision = this.planner.plan(plannerInput);
    const scene = plannerDecision.plan.scene;

    const beatDescriptors: ChatDramaBeatDescriptor[] = [];
    const visibleMessages: AuthoritativeChatMessage[] = [];
    const shadowMessages: AuthoritativeChatMessage[] = [];

    const haterPlan = this.materializeHaterPlan(envelope, relationshipSummary);
    const helperPlan = this.materializeHelperPlan(envelope, playerModelSnapshot);

    for (const beat of scene.beats) {
      const descriptor = this.materializeBeat(
        envelope,
        plannerDecision,
        beat,
        relationshipSummary,
        playerModelSnapshot,
        haterPlan,
        helperPlan,
      );
      beatDescriptors.push(descriptor);

      if (descriptor.message && visibleMessages.length < this.config.maxVisibleMessages) {
        visibleMessages.push(descriptor.message);
      }
      if (descriptor.shadowMessage && shadowMessages.length < this.config.maxShadowMessages) {
        shadowMessages.push(descriptor.shadowMessage);
      }
    }

    if (
      this.config.enableLegendPromotion &&
      ['SOVEREIGN_ACHIEVED', 'LEGEND_MOMENT'].indexOf(String(envelope.momentType)) >= 0
    ) {
      const legendBeat = scene.beats.find((beat) => beat.beatType === 'POST_BEAT_ECHO') ?? scene.beats[scene.beats.length - 1];
      if (legendBeat) {
        visibleMessages.push(buildLegendMessage(envelope, scene, legendBeat));
      }
    }

    const archiveRecord = this.archiveService.archiveScene(
      envelope.playerId,
      envelope.roomId,
      envelope.primaryChannelId,
      scene,
      {
        counterpartIds: plannerDecision.chosenSpeakerIds.filter(
          (speakerId) => speakerId !== 'CROWD' && String(speakerId).indexOf('CALLBACK:') !== 0,
        ),
        callbackAnchorIds: plannerDecision.chosenCallbackAnchorIds,
        transcriptAnnotationIds: visibleMessages
          .map((message) => message?.messageId ?? message?.id)
          .filter(Boolean),
        tags: plannerDecision.chosenTags,
      } as any,
    );

    const materialization: ChatDramaMaterialization = {
      envelope,
      plannerDecision,
      scene,
      archiveRecord,
      visibleMessages,
      shadowMessages,
      beatDescriptors,
      chosenSpeakerIds: plannerDecision.chosenSpeakerIds,
      chosenCallbackAnchorIds: plannerDecision.chosenCallbackAnchorIds,
      chosenTags: plannerDecision.chosenTags,
    };

    this.logger.info('chat_drama_materialized', {
      playerId: envelope.playerId,
      roomId: envelope.roomId,
      momentId: envelope.momentId,
      momentType: envelope.momentType,
      sceneId: scene.sceneId,
      archetype: scene.archetype,
      stageMood: scene.stageMood,
      visibleMessageCount: visibleMessages.length,
      shadowMessageCount: shadowMessages.length,
    });

    return materialization;
  }

  public appendOutcome(playerId: string, sceneId: string, outcome: string): any {
    if (!this.config.enableOutcomeArchival) return undefined;
    return this.archiveService.appendOutcome(playerId, sceneId, outcome as any);
  }

  public buildCarryoverSummary(playerId: string): any {
    return this.archiveService.buildCarryoverSummary(playerId);
  }

  private materializeHaterPlan(envelope: ChatDramaMomentEnvelope, relationshipSummary: any): any {
    const trigger = this.mapMomentToHaterTrigger(envelope, relationshipSummary);
    return this.haterAuthority.plan(trigger);
  }

  private materializeHelperPlan(envelope: ChatDramaMomentEnvelope, playerModelSnapshot: any): any {
    const trigger = this.mapMomentToHelperTrigger(envelope, playerModelSnapshot);
    return this.helperAuthority.plan(trigger);
  }

  private materializeBeat(
    envelope: ChatDramaMomentEnvelope,
    plannerDecision: ChatScenePlannerDecisionWithTelemetry,
    beat: SharedChatSceneBeat,
    relationshipSummary: any,
    playerModelSnapshot: any,
    haterPlan: any,
    helperPlan: any,
  ): ChatDramaBeatDescriptor {
    const scene = plannerDecision.plan.scene;
    let message: AuthoritativeChatMessage | undefined;
    let shadowMessage: AuthoritativeChatMessage | undefined;
    const callbackAnchorIds = plannerDecision.chosenCallbackAnchorIds;

    switch (beat.beatType) {
      case 'SYSTEM_NOTICE': {
        message = buildSystemMessage(envelope, scene, beat);
        if (this.config.enableShadowAnnotations) {
          shadowMessage = buildShadowReceipt(
            envelope,
            scene,
            beat,
            `System established ${sceneReceiptLabel(scene)}.`,
            'SYSTEM',
          );
        }
        break;
      }

      case 'HATER_ENTRY': {
        if (haterPlan?.accepted !== false) {
          message = buildHaterMessage(envelope, scene, beat, relationshipSummary);
          if (this.config.enableShadowAnnotations) {
            shadowMessage = buildShadowReceipt(
              envelope,
              scene,
              beat,
              `Hater authority accepted with tactic=${String(haterPlan?.tactic ?? 'UNKNOWN')}.`,
              'RIVALRY',
            );
          }
        }
        break;
      }

      case 'CROWD_SWARM': {
        if (this.config.allowCrowdAsVisibleBeat) {
          message = createSystemMessage({
            roomId: envelope.roomId,
            channelId: beat.channelId ?? envelope.primaryChannelId,
            text: crowdLineForBeat(scene, beat),
            metadata: {
              sceneId: scene.sceneId,
              beatId: beat.beatId,
              beatType: beat.beatType,
              crowd: true,
            },
          } as any);
        }
        if (this.config.enableShadowAnnotations) {
          shadowMessage = buildShadowReceipt(
            envelope,
            scene,
            beat,
            `Crowd heat reflected in ${String(beat.channelId)}.`,
            'SYSTEM',
          );
        }
        break;
      }

      case 'HELPER_INTERVENTION': {
        if (helperPlan?.accepted !== false) {
          message = buildHelperMessage(envelope, scene, beat, playerModelSnapshot);
          if (this.config.enableShadowAnnotations) {
            shadowMessage = buildShadowReceipt(
              envelope,
              scene,
              beat,
              `Helper authority accepted with urgency=${String(helperPlan?.urgency ?? 'UNKNOWN')}.`,
              'RESCUE',
            );
          }
        }
        break;
      }

      case 'PLAYER_REPLY_WINDOW': {
        if (this.config.enableShadowAnnotations) {
          shadowMessage = buildShadowReceipt(
            envelope,
            scene,
            beat,
            'Reply window opened for player choice.',
            'SYSTEM',
          );
        }
        break;
      }

      case 'SILENCE': {
        if (this.config.enableShadowAnnotations) {
          shadowMessage = buildShadowReceipt(
            envelope,
            scene,
            beat,
            `Intentional silence held for ${String(beat.delayMs ?? 0)}ms.`,
            'SYSTEM',
          );
        }
        break;
      }

      case 'REVEAL': {
        if (this.config.enableRevealQuotes) {
          message = buildRevealMessage(envelope, scene, beat, callbackAnchorIds);
        }
        if (this.config.enableShadowAnnotations) {
          shadowMessage = buildShadowReceipt(
            envelope,
            scene,
            beat,
            `Reveal attempted with anchors=${callbackAnchorIds.join(',') || 'NONE'}.`,
            'NPC',
          );
        }
        break;
      }

      case 'POST_BEAT_ECHO': {
        if (scene.momentType === 'SOVEREIGN_ACHIEVED' && this.config.enableLegendPromotion) {
          message = buildLegendMessage(envelope, scene, beat);
        } else {
          message = createSystemMessage({
            roomId: envelope.roomId,
            channelId: beat.channelId ?? envelope.primaryChannelId,
            text: systemLineForBeat(scene, beat, envelope),
            metadata: {
              sceneId: scene.sceneId,
              beatId: beat.beatId,
              beatType: beat.beatType,
              echo: true,
            },
          } as any);
        }

        if (this.config.enableShadowAnnotations) {
          shadowMessage = buildShadowReceipt(
            envelope,
            scene,
            beat,
            'Post-beat echo preserved for continuity.',
            'SYSTEM',
          );
        }
        break;
      }

      default: {
        this.logger.warn('chat_drama_unknown_beat', {
          beatType: (beat as any)?.beatType,
          beatId: (beat as any)?.beatId,
        });
        break;
      }
    }

    return createCanonicalDescriptor(beat, message, shadowMessage, callbackAnchorIds);
  }

  private mapMomentToHaterTrigger(envelope: ChatDramaMomentEnvelope, relationshipSummary: any): any {
    const signal = Array.isArray(relationshipSummary?.counterparts) ? relationshipSummary.counterparts[0] : undefined;
    return {
      kind:
        envelope.momentType === 'DEAL_ROOM_STANDOFF'
          ? 'DEAL_ROOM_EVENT'
          : envelope.momentType === 'RUN_END'
            ? 'RUN_EVENT'
            : envelope.momentType === 'BOT_ATTACK'
              ? 'ENGINE_EVENT'
              : 'SYSTEM_EVENT',
      state: envelope.state,
      room: envelope.room,
      now: envelope.now,
      causeEventId: envelope.causeEventId ?? envelope.momentId,
      signal,
      preferredChannelId: envelope.primaryChannelId,
      metadata: {
        momentId: envelope.momentId,
        momentType: envelope.momentType,
        pressureTier: envelope.pressureTier,
        ...envelope.metadata,
      },
    };
  }

  private mapMomentToHelperTrigger(envelope: ChatDramaMomentEnvelope, playerModelSnapshot: any): any {
    return {
      kind:
        envelope.momentType === 'HELPER_RESCUE'
          ? 'RECOVERY_EVENT'
          : envelope.momentType === 'RUN_END'
            ? 'RUN_EVENT'
            : envelope.momentType === 'SHIELD_BREACH'
              ? 'ENGINE_EVENT'
              : 'SYSTEM_EVENT',
      state: envelope.state,
      room: envelope.room,
      now: envelope.now,
      causeEventId: envelope.causeEventId ?? envelope.momentId,
      signal: {
        pressure01: summarizePressure(envelope.pressureTier),
        dominantAxes: playerModelSnapshot?.dominantAxes,
      },
      preferredChannelId: envelope.primaryChannelId,
      metadata: {
        momentId: envelope.momentId,
        momentType: envelope.momentType,
        pressureTier: envelope.pressureTier,
        ...envelope.metadata,
      },
    };
  }
}

/* ========================================================================== *
 * MARK: Factory
 * ========================================================================== */

export function createChatDramaOrchestrator(args?: {
  planner?: ChatScenePlanner;
  archiveService?: ChatSceneArchiveService;
  relationshipService?: ChatRelationshipService;
  memoryService?: ChatMemoryService;
  playerModelService?: ChatPlayerModelService;
  haterAuthority?: HaterResponseAuthority;
  helperAuthority?: HelperResponseAuthority;
  logger?: ChatDramaLogger;
  config?: Partial<ChatDramaOrchestratorConfig>;
}): ChatDramaOrchestrator {
  return new ChatDramaOrchestrator(args);
}
