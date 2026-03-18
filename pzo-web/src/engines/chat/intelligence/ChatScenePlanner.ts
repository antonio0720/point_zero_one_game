/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT SCENE PLANNER
 * FILE: pzo-web/src/engines/chat/intelligence/ChatScenePlanner.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Compose chat as authored scenes instead of isolated bark picks.
 *
 * This planner sits between:
 * - moment detection,
 * - relationship drift,
 * - episodic memory,
 * - reveal / silence orchestration,
 * - and surface realization.
 *
 * It does not emit final lines.
 * It emits the *shape* of the moment so later layers can choose the right
 * canonical line, callback, silence window, and variant transform.
 * ============================================================================
 */

import type {
  ChatChannelId,
  ChatMemoryAnchor,
  ChatMomentType,
  ChatRelationshipState,
  ChatSceneBeat,
  ChatSceneBeatType,
  ChatScenePlan,
  PressureTier,
  UnixMs,
} from '../types';

export type ChatSceneArchetype =
  | 'BREACH_SCENE'
  | 'TRAP_SCENE'
  | 'RESCUE_SCENE'
  | 'PUBLIC_HUMILIATION_SCENE'
  | 'COMEBACK_WITNESS_SCENE'
  | 'DEAL_ROOM_PRESSURE_SCENE'
  | 'FALSE_CALM_SCENE'
  | 'END_OF_RUN_RECKONING_SCENE'
  | 'LONG_ARC_CALLBACK_SCENE'
  | 'SEASON_EVENT_INTRUSION_SCENE';

export type ChatSceneRole =
  | 'OPEN'
  | 'PRESSURE'
  | 'MOCK'
  | 'DEFEND'
  | 'WITNESS'
  | 'CALLBACK'
  | 'REVEAL'
  | 'SILENCE'
  | 'ECHO'
  | 'CLOSE';

export interface ChatSceneSpeakerCandidate {
  readonly actorId: string;
  readonly actorKind: 'BOT' | 'HELPER' | 'SYSTEM' | 'CROWD';
  readonly weight: number;
  readonly preferredChannel?: ChatChannelId;
  readonly tags?: readonly string[];
}

export interface ChatScenePlannerInput {
  readonly playerId: string;
  readonly roomId: string;
  readonly now: UnixMs;
  readonly momentId: string;
  readonly momentType: ChatMomentType;
  readonly primaryChannel: ChatChannelId;
  readonly pressureTier?: PressureTier;
  readonly relationshipState?: readonly ChatRelationshipState[];
  readonly memoryAnchors?: readonly ChatMemoryAnchor[];
  readonly unresolvedMomentIds?: readonly string[];
  readonly carriedPersonaIds?: readonly string[];
  readonly pendingRevealPayloadIds?: readonly string[];
  readonly candidateBots?: readonly ChatSceneSpeakerCandidate[];
  readonly candidateHelpers?: readonly ChatSceneSpeakerCandidate[];
  readonly worldTags?: readonly string[];
  readonly allowPlayerComposerOverride?: boolean;
}

export interface ChatPlannedSceneBeat extends ChatSceneBeat {
  readonly beatId: string;
  readonly sceneRole: ChatSceneRole;
  readonly actorKind?: 'BOT' | 'HELPER' | 'SYSTEM' | 'CROWD';
  readonly targetPressure?: PressureTier;
  readonly callbackAnchorIds?: readonly string[];
  readonly rhetoricalTemplateIds?: readonly string[];
  readonly semanticClusterIds?: readonly string[];
}

export interface ChatPlannedScene extends ChatScenePlan {
  readonly archetype: ChatSceneArchetype;
  readonly beats: readonly ChatPlannedSceneBeat[];
  readonly speakerOrder: readonly string[];
  readonly escalationPoints: readonly number[];
  readonly silenceWindowsMs: readonly number[];
  readonly callbackAnchorIds: readonly string[];
  readonly possibleBranchPoints: readonly string[];
  readonly planningTags: readonly string[];
}

const DEFAULT_BOTS: readonly ChatSceneSpeakerCandidate[] = [
  { actorId: 'BOT_01', actorKind: 'BOT', weight: 92, preferredChannel: 'DEAL_ROOM', tags: ['liquidity', 'acquisition'] },
  { actorId: 'BOT_02', actorKind: 'BOT', weight: 88, preferredChannel: 'SYNDICATE', tags: ['procedure', 'delay'] },
  { actorId: 'BOT_03', actorKind: 'BOT', weight: 94, preferredChannel: 'GLOBAL', tags: ['profiling', 'trap'] },
  { actorId: 'BOT_04', actorKind: 'BOT', weight: 90, preferredChannel: 'GLOBAL', tags: ['macro', 'regime'] },
  { actorId: 'BOT_05', actorKind: 'BOT', weight: 86, preferredChannel: 'LOBBY', tags: ['class', 'legacy'] },
];

const DEFAULT_HELPERS: readonly ChatSceneSpeakerCandidate[] = [
  { actorId: 'HELPER_01', actorKind: 'HELPER', weight: 70, preferredChannel: 'SYNDICATE', tags: ['rescue', 'warmth'] },
  { actorId: 'HELPER_02', actorKind: 'HELPER', weight: 66, preferredChannel: 'LOBBY', tags: ['calm', 'repair'] },
];

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stablePickIndex(seed: number, length: number): number {
  if (length <= 0) return 0;
  return Math.abs(seed) % length;
}

function uniqueStrings(values: readonly string[] | undefined): string[] {
  if (!values?.length) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function chooseArchetype(input: ChatScenePlannerInput): ChatSceneArchetype {
  switch (input.momentType) {
    case 'SHIELD_BREACH':
      return 'BREACH_SCENE';
    case 'CASCADE_TRIGGER':
      return 'TRAP_SCENE';
    case 'HELPER_RESCUE':
      return 'RESCUE_SCENE';
    case 'DEAL_ROOM_STANDOFF':
      return 'DEAL_ROOM_PRESSURE_SCENE';
    case 'CASCADE_BREAK':
      return 'COMEBACK_WITNESS_SCENE';
    case 'RUN_END':
      return 'END_OF_RUN_RECKONING_SCENE';
    case 'WORLD_EVENT':
      return 'SEASON_EVENT_INTRUSION_SCENE';
    case 'SOVEREIGN_APPROACH':
    case 'SOVEREIGN_ACHIEVED':
      return 'LONG_ARC_CALLBACK_SCENE';
    case 'RUN_START':
      return 'FALSE_CALM_SCENE';
    default:
      return 'PUBLIC_HUMILIATION_SCENE';
  }
}

function buildBeatId(sceneId: string, index: number): string {
  return `${sceneId}:beat:${index + 1}`;
}

function bestRelationship(
  relationships: readonly ChatRelationshipState[] | undefined,
): ChatRelationshipState | undefined {
  if (!relationships?.length) return undefined;
  return [...relationships].sort((a, b) => {
    const aScore =
      a.vector.rivalryIntensity +
      a.vector.fascination +
      a.vector.contempt +
      a.vector.fear;
    const bScore =
      b.vector.rivalryIntensity +
      b.vector.fascination +
      b.vector.contempt +
      b.vector.fear;
    return bScore - aScore;
  })[0];
}

function highSalienceAnchors(
  anchors: readonly ChatMemoryAnchor[] | undefined,
  maxCount: number,
): readonly ChatMemoryAnchor[] {
  if (!anchors?.length) return [];
  return [...anchors]
    .sort((a, b) => b.salience - a.salience || b.createdAt - a.createdAt)
    .slice(0, maxCount);
}

function selectSpeakerOrder(
  input: ChatScenePlannerInput,
  archetype: ChatSceneArchetype,
): readonly ChatSceneSpeakerCandidate[] {
  const seed = hashSeed([
    input.playerId,
    input.roomId,
    input.momentId,
    input.momentType,
    archetype,
  ].join('|'));

  const rel = bestRelationship(input.relationshipState);
  const bots = input.candidateBots?.length ? [...input.candidateBots] : [...DEFAULT_BOTS];
  const helpers = input.candidateHelpers?.length ? [...input.candidateHelpers] : [...DEFAULT_HELPERS];

  const botWeighted = bots
    .map((candidate) => {
      let weight = candidate.weight;
      if (rel && candidate.actorId === rel.counterpartId) {
        weight += Math.round(rel.vector.rivalryIntensity * 0.40);
        weight += Math.round(rel.vector.fascination * 0.25);
        weight += Math.round(rel.vector.contempt * 0.20);
      }
      if (candidate.preferredChannel === input.primaryChannel) weight += 14;
      if (archetype === 'DEAL_ROOM_PRESSURE_SCENE' && candidate.actorId === 'BOT_01') weight += 18;
      if (archetype === 'TRAP_SCENE' && candidate.actorId === 'BOT_03') weight += 18;
      if (archetype === 'SEASON_EVENT_INTRUSION_SCENE' && candidate.actorId === 'BOT_04') weight += 16;
      if (archetype === 'PUBLIC_HUMILIATION_SCENE' && candidate.actorId === 'BOT_05') weight += 10;
      return { ...candidate, weight };
    })
    .sort((a, b) => b.weight - a.weight || a.actorId.localeCompare(b.actorId));

  const helperWeighted = helpers
    .map((candidate) => {
      let weight = candidate.weight;
      if (archetype === 'RESCUE_SCENE') weight += 25;
      if (input.primaryChannel === candidate.preferredChannel) weight += 8;
      return { ...candidate, weight };
    })
    .sort((a, b) => b.weight - a.weight || a.actorId.localeCompare(b.actorId));

  const leadBot = botWeighted[stablePickIndex(seed, botWeighted.length)];
  const supportBot = botWeighted.find((candidate) => candidate.actorId !== leadBot?.actorId) ?? leadBot;
  const leadHelper = helperWeighted[stablePickIndex(seed >> 1, helperWeighted.length)];

  switch (archetype) {
    case 'RESCUE_SCENE':
      return [leadHelper, leadBot, supportBot].filter(Boolean);
    case 'FALSE_CALM_SCENE':
      return [supportBot, leadBot].filter(Boolean);
    default:
      return [leadBot, supportBot, leadHelper].filter(Boolean);
  }
}

function beat(
  sceneId: string,
  index: number,
  beatType: ChatSceneBeatType,
  sceneRole: ChatSceneRole,
  channel: ChatChannelId,
  actor?: ChatSceneSpeakerCandidate,
  delayMs: number = 0,
  payloadHint?: string,
  options?: {
    readonly skippable?: boolean;
    readonly canInterrupt?: boolean;
    readonly targetPressure?: PressureTier;
    readonly callbackAnchorIds?: readonly string[];
    readonly rhetoricalTemplateIds?: readonly string[];
    readonly semanticClusterIds?: readonly string[];
  },
): ChatPlannedSceneBeat {
  return {
    beatId: buildBeatId(sceneId, index),
    beatType,
    sceneRole,
    actorId: actor?.actorId,
    actorKind: actor?.actorKind,
    delayMs,
    requiredChannel: channel,
    skippable: options?.skippable ?? false,
    canInterrupt: options?.canInterrupt ?? true,
    payloadHint,
    targetPressure: options?.targetPressure,
    callbackAnchorIds: options?.callbackAnchorIds,
    rhetoricalTemplateIds: options?.rhetoricalTemplateIds,
    semanticClusterIds: options?.semanticClusterIds,
  };
}

export class ChatScenePlanner {
  plan(input: ChatScenePlannerInput): ChatPlannedScene {
    const archetype = chooseArchetype(input);
    const speakers = selectSpeakerOrder(input, archetype);
    const lead = speakers[0];
    const support = speakers[1];
    const helper = speakers.find((candidate) => candidate.actorKind === 'HELPER');

    const callbackAnchors = highSalienceAnchors(input.memoryAnchors, 3);
    const callbackAnchorIds = callbackAnchors.map((anchor) => anchor.anchorId);
    const speakerOrder = speakers.map((speaker) => speaker.actorId);
    const planningTags = uniqueStrings([
      archetype,
      input.momentType,
      input.primaryChannel,
      ...(input.worldTags ?? []),
      ...(callbackAnchors.map((anchor) => anchor.anchorType)),
    ]);

    const sceneId = `scene:${input.roomId}:${input.momentId}:${hashSeed(`${input.playerId}|${input.now}|${archetype}`).toString(16)}`;

    const beats = this.composeBeats({
      input,
      archetype,
      sceneId,
      lead,
      support,
      helper,
      callbackAnchorIds,
    });

    const expectedDurationMs = beats.reduce((sum, item) => sum + item.delayMs, 0) + 2_500;
    const silenceWindowsMs = beats
      .filter((item) => item.sceneRole === 'SILENCE')
      .map((item) => item.delayMs);
    const escalationPoints = beats
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.sceneRole === 'PRESSURE' || item.sceneRole === 'REVEAL')
      .map(({ index }) => index);
    const possibleBranchPoints = beats
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.beatType === 'PLAYER_REPLY_WINDOW')
      .map(({ index }) => `${sceneId}:branch:${index + 1}`);

    return {
      sceneId,
      momentId: input.momentId,
      momentType: input.momentType,
      archetype,
      primaryChannel: input.primaryChannel,
      beats,
      startedAt: input.now,
      expectedDurationMs,
      allowPlayerComposerDuringScene:
        input.allowPlayerComposerOverride ??
        archetype !== 'DEAL_ROOM_PRESSURE_SCENE',
      cancellableByAuthoritativeEvent: archetype !== 'END_OF_RUN_RECKONING_SCENE',
      speakerOrder,
      escalationPoints,
      silenceWindowsMs,
      callbackAnchorIds,
      possibleBranchPoints,
      planningTags,
    };
  }

  private composeBeats(args: {
    readonly input: ChatScenePlannerInput;
    readonly archetype: ChatSceneArchetype;
    readonly sceneId: string;
    readonly lead?: ChatSceneSpeakerCandidate;
    readonly support?: ChatSceneSpeakerCandidate;
    readonly helper?: ChatSceneSpeakerCandidate;
    readonly callbackAnchorIds: readonly string[];
  }): readonly ChatPlannedSceneBeat[] {
    const { input, archetype, sceneId, lead, support, helper, callbackAnchorIds } = args;
    const pressure = input.pressureTier;
    const beats: ChatPlannedSceneBeat[] = [];

    const push = (
      beatType: ChatSceneBeatType,
      sceneRole: ChatSceneRole,
      actor: ChatSceneSpeakerCandidate | undefined,
      delayMs: number,
      payloadHint: string,
      options?: {
        readonly skippable?: boolean;
        readonly canInterrupt?: boolean;
        readonly targetPressure?: PressureTier;
        readonly callbackAnchorIds?: readonly string[];
        readonly rhetoricalTemplateIds?: readonly string[];
        readonly semanticClusterIds?: readonly string[];
      },
    ) => {
      beats.push(
        beat(
          sceneId,
          beats.length,
          beatType,
          sceneRole,
          actor?.preferredChannel ?? input.primaryChannel,
          actor,
          delayMs,
          payloadHint,
          options,
        ),
      );
    };

    switch (archetype) {
      case 'BREACH_SCENE':
        push('SYSTEM_NOTICE', 'OPEN', undefined, 0, 'breach_warning', {
          targetPressure: pressure,
          semanticClusterIds: ['shield-breach', 'public-risk'],
        });
        push('HATER_ENTRY', 'PRESSURE', lead, 750, 'lead_breach_entry', {
          targetPressure: pressure,
          rhetoricalTemplateIds: ['you-thought-x-i-was-y'],
          semanticClusterIds: ['liquidity-collapse', 'structural-predation'],
        });
        push('CROWD_SWARM', 'MOCK', support, 650, 'crowd_swarm', {
          skippable: true,
          semanticClusterIds: ['public-humiliation', 'audience-heat'],
        });
        push('PLAYER_REPLY_WINDOW', 'DEFEND', undefined, 1_250, 'player_response_window', {
          canInterrupt: false,
          skippable: false,
        });
        push('REVEAL', 'CALLBACK', lead, 900, 'breach_callback', {
          callbackAnchorIds,
          rhetoricalTemplateIds: ['callback-weaponization'],
          semanticClusterIds: ['memory-reuse', 'unfinished-business'],
        });
        push('POST_BEAT_ECHO', 'ECHO', support, 600, 'post_breach_echo', {
          skippable: true,
        });
        break;

      case 'TRAP_SCENE':
        push('HATER_ENTRY', 'OPEN', lead, 0, 'trap_probe', {
          semanticClusterIds: ['pattern-reading', 'behavioral-forecast'],
          rhetoricalTemplateIds: ['the-trap-was-never-the-move'],
        });
        push('SILENCE', 'SILENCE', undefined, 800, 'false_gap_before_snap', {
          skippable: false,
          canInterrupt: false,
        });
        push('REVEAL', 'REVEAL', support ?? lead, 700, 'trap_reveal', {
          callbackAnchorIds,
          semanticClusterIds: ['assembled-choice', 'forced-safe-move'],
        });
        push('PLAYER_REPLY_WINDOW', 'DEFEND', undefined, 1_300, 'player_counter_window', {
          canInterrupt: false,
        });
        push('POST_BEAT_ECHO', 'ECHO', lead, 650, 'trap_echo');
        break;

      case 'RESCUE_SCENE':
        push('HELPER_INTERVENTION', 'OPEN', helper, 0, 'helper_open_rescue', {
          semanticClusterIds: ['rescue-debt', 'discipline-under-fire'],
        });
        push('HATER_ENTRY', 'PRESSURE', lead, 700, 'hater_push_through_rescue', {
          semanticClusterIds: ['rescue-disruption'],
        });
        push('PLAYER_REPLY_WINDOW', 'DEFEND', undefined, 1_200, 'player_accept_or_reject_help', {
          canInterrupt: false,
        });
        push('REVEAL', 'CALLBACK', helper, 900, 'helper_callback', {
          callbackAnchorIds,
          rhetoricalTemplateIds: ['i-remember-what-you-did'],
        });
        push('POST_BEAT_ECHO', 'CLOSE', lead, 650, 'hater_exit_grudge');
        break;

      case 'DEAL_ROOM_PRESSURE_SCENE':
        push('SYSTEM_NOTICE', 'OPEN', undefined, 0, 'deal_room_attention');
        push('HATER_ENTRY', 'PRESSURE', lead, 500, 'term_sheet_pressure', {
          semanticClusterIds: ['deal-room', 'liquidity-collapse'],
          rhetoricalTemplateIds: ['you-are-becoming-the-deal'],
        });
        push('SILENCE', 'SILENCE', undefined, 1_050, 'negotiation_hold', {
          canInterrupt: false,
        });
        push('PLAYER_REPLY_WINDOW', 'DEFEND', undefined, 1_400, 'player_counteroffer_window', {
          canInterrupt: false,
        });
        push('REVEAL', 'REVEAL', support ?? lead, 850, 'secondary_clause_reveal', {
          callbackAnchorIds,
        });
        push('POST_BEAT_ECHO', 'ECHO', lead, 700, 'deal_room_echoline');
        break;

      case 'COMEBACK_WITNESS_SCENE':
        push('CROWD_SWARM', 'WITNESS', support ?? lead, 0, 'crowd_notices_shift', {
          semanticClusterIds: ['comeback', 'witness'],
        });
        push('HATER_ENTRY', 'MOCK', lead, 550, 'hater_denial');
        push('PLAYER_REPLY_WINDOW', 'DEFEND', undefined, 1_100, 'player_hold_comeback', {
          canInterrupt: false,
        });
        push('HELPER_INTERVENTION', 'CALLBACK', helper, 900, 'helper_validates_shift', {
          callbackAnchorIds,
        });
        push('POST_BEAT_ECHO', 'CLOSE', support ?? lead, 650, 'room_rewrites_narrative');
        break;

      case 'END_OF_RUN_RECKONING_SCENE':
        push('SYSTEM_NOTICE', 'OPEN', undefined, 0, 'run_end_notice');
        push('HATER_ENTRY', 'CALLBACK', lead, 650, 'reckoning_entry', {
          callbackAnchorIds,
          semanticClusterIds: ['long-horizon-memory', 'score-settlement'],
        });
        push('REVEAL', 'REVEAL', support ?? lead, 900, 'final_reveal', {
          callbackAnchorIds,
          rhetoricalTemplateIds: ['the-room-remembers'],
        });
        push('POST_BEAT_ECHO', 'CLOSE', helper, 800, 'helper_postmortem');
        break;

      case 'SEASON_EVENT_INTRUSION_SCENE':
        push('SYSTEM_NOTICE', 'OPEN', undefined, 0, 'world_event_notice');
        push('REVEAL', 'REVEAL', lead, 700, 'world_event_personalized', {
          semanticClusterIds: ['season-overlay', 'macro-inevitability'],
        });
        push('CROWD_SWARM', 'WITNESS', support ?? lead, 700, 'crowd_reacts_to_world_event', {
          skippable: true,
        });
        push('PLAYER_REPLY_WINDOW', 'DEFEND', undefined, 1_150, 'player_process_world_event');
        push('POST_BEAT_ECHO', 'ECHO', helper, 650, 'helper_grounding_echo');
        break;

      case 'FALSE_CALM_SCENE':
        push('CROWD_SWARM', 'OPEN', support ?? lead, 0, 'ambient_false_calm', {
          skippable: true,
          semanticClusterIds: ['false-calm', 'breathing-room'],
        });
        push('SILENCE', 'SILENCE', undefined, 700, 'quiet_before_pressure', {
          canInterrupt: false,
        });
        push('HATER_ENTRY', 'PRESSURE', lead, 650, 'quiet_predator_line', {
          skippable: true,
        });
        break;

      case 'LONG_ARC_CALLBACK_SCENE':
      case 'PUBLIC_HUMILIATION_SCENE':
      default:
        push('HATER_ENTRY', 'OPEN', lead, 0, 'public_opening', {
          semanticClusterIds: ['public-humiliation', 'continuity'],
        });
        push('CROWD_SWARM', 'MOCK', support ?? lead, 650, 'crowd_pile_on');
        push('PLAYER_REPLY_WINDOW', 'DEFEND', undefined, 1_250, 'player_window');
        push('REVEAL', 'CALLBACK', lead, 850, 'long_arc_callback', {
          callbackAnchorIds,
        });
        push('POST_BEAT_ECHO', 'CLOSE', helper, 700, 'aftershock');
        break;
    }

    return beats;
  }
}

export function createChatScenePlanner(): ChatScenePlanner {
  return new ChatScenePlanner();
}
