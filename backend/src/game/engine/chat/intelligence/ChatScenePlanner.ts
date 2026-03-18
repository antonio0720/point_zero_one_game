/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT SCENE PLANNER
 * FILE: backend/src/game/engine/chat/intelligence/ChatScenePlanner.ts
 * ============================================================================
 *
 * Authoritative mirror of frontend scene planning. The backend can use this
 * planner to stamp scene archives, replay payloads, and anti-repeat telemetry.
 * ============================================================================
 */

import type {
  SharedChatMemoryAnchor,
  SharedChatRelationshipState,
  SharedChatSceneBeat,
  SharedChatSceneBeatType,
  SharedChatScenePlannerInput,
  SharedChatScenePlannerDecision,
  SharedChatScenePlan,
  SharedChatSceneArchetype,
  SharedChatSceneRole,
  SharedPressureTier,
} from '../../../../../../shared/contracts/chat/scene';

interface SharedSceneSpeakerCandidate {
  readonly actorId: string;
  readonly actorKind: 'BOT' | 'HELPER' | 'SYSTEM' | 'CROWD';
  readonly weight: number;
  readonly preferredChannel?: SharedChatScenePlan['primaryChannel'];
  readonly tags?: readonly string[];
}

const DEFAULT_BOTS: readonly SharedSceneSpeakerCandidate[] = [
  { actorId: 'BOT_01', actorKind: 'BOT', weight: 92, preferredChannel: 'DEAL_ROOM', tags: ['liquidity', 'acquisition'] },
  { actorId: 'BOT_02', actorKind: 'BOT', weight: 88, preferredChannel: 'SYNDICATE', tags: ['procedure', 'delay'] },
  { actorId: 'BOT_03', actorKind: 'BOT', weight: 94, preferredChannel: 'GLOBAL', tags: ['profiling', 'trap'] },
  { actorId: 'BOT_04', actorKind: 'BOT', weight: 90, preferredChannel: 'GLOBAL', tags: ['macro', 'regime'] },
  { actorId: 'BOT_05', actorKind: 'BOT', weight: 86, preferredChannel: 'LOBBY', tags: ['class', 'legacy'] },
];

const DEFAULT_HELPERS: readonly SharedSceneSpeakerCandidate[] = [
  { actorId: 'HELPER_01', actorKind: 'HELPER', weight: 70, preferredChannel: 'SYNDICATE', tags: ['rescue', 'warmth'] },
  { actorId: 'HELPER_02', actorKind: 'HELPER', weight: 66, preferredChannel: 'LOBBY', tags: ['calm', 'repair'] },
];

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

function chooseArchetype(momentType: SharedChatScenePlannerInput['momentType']): SharedChatSceneArchetype {
  switch (momentType) {
    case 'SHIELD_BREACH': return 'BREACH_SCENE';
    case 'CASCADE_TRIGGER': return 'TRAP_SCENE';
    case 'HELPER_RESCUE': return 'RESCUE_SCENE';
    case 'DEAL_ROOM_STANDOFF': return 'DEAL_ROOM_PRESSURE_SCENE';
    case 'CASCADE_BREAK': return 'COMEBACK_WITNESS_SCENE';
    case 'RUN_END': return 'END_OF_RUN_RECKONING_SCENE';
    case 'WORLD_EVENT': return 'SEASON_EVENT_INTRUSION_SCENE';
    case 'SOVEREIGN_APPROACH':
    case 'SOVEREIGN_ACHIEVED': return 'LONG_ARC_CALLBACK_SCENE';
    case 'RUN_START': return 'FALSE_CALM_SCENE';
    default: return 'PUBLIC_HUMILIATION_SCENE';
  }
}

function buildBeatId(sceneId: string, index: number): string {
  return `${sceneId}:beat:${index + 1}`;
}

function bestRelationship(
  relationships: readonly SharedChatRelationshipState[] | undefined,
): SharedChatRelationshipState | undefined {
  if (!relationships?.length) return undefined;
  return [...relationships].sort((a, b) => {
    const aScore = a.vector.rivalryIntensity + a.vector.fascination + a.vector.contempt + a.vector.fear;
    const bScore = b.vector.rivalryIntensity + b.vector.fascination + b.vector.contempt + b.vector.fear;
    return bScore - aScore;
  })[0];
}

function topAnchors(
  anchors: readonly SharedChatMemoryAnchor[] | undefined,
  count: number,
): readonly SharedChatMemoryAnchor[] {
  if (!anchors?.length) return [];
  return [...anchors].sort((a, b) => b.salience - a.salience || b.createdAt - a.createdAt).slice(0, count);
}

export class ChatScenePlanner {
  plan(input: SharedChatScenePlannerInput): SharedChatScenePlannerDecision {
    const archetype = chooseArchetype(input.momentType);
    const relation = bestRelationship(input.relationshipState);
    const seed = hashSeed(`${input.playerId}|${input.roomId}|${input.momentId}|${input.momentType}|${archetype}`);

    const leadBot = [...DEFAULT_BOTS]
      .map((candidate) => {
        let weight = candidate.weight;
        if (relation && relation.counterpartId === candidate.actorId) {
          weight += Math.round(relation.vector.rivalryIntensity * 0.4);
          weight += Math.round(relation.vector.fascination * 0.25);
        }
        if (candidate.preferredChannel === input.primaryChannel) weight += 10;
        return { ...candidate, weight };
      })
      .sort((a, b) => b.weight - a.weight || a.actorId.localeCompare(b.actorId))[stablePickIndex(seed, DEFAULT_BOTS.length)];

    const supportBot =
      DEFAULT_BOTS.find((candidate) => candidate.actorId !== leadBot.actorId)
      ?? leadBot;

    const helper = DEFAULT_HELPERS[stablePickIndex(seed >> 1, DEFAULT_HELPERS.length)];
    const callbackAnchors = topAnchors(input.memoryAnchors, 3).map((anchor) => anchor.anchorId);
    const sceneId = `scene:${input.roomId}:${input.momentId}:${hashSeed(`${input.playerId}|${input.now}`).toString(16)}`;
    const beats: SharedChatSceneBeat[] = [
      {
        beatId: buildBeatId(sceneId, 0),
        beatType: 'HATER_ENTRY',
        sceneRole: 'OPEN',
        actorId: leadBot.actorId,
        actorKind: leadBot.actorKind,
        delayMs: 0,
        requiredChannel: leadBot.preferredChannel ?? input.primaryChannel,
        skippable: false,
        canInterrupt: true,
        payloadHint: `${archetype.toLowerCase()}:entry`,
        targetPressure: input.pressureTier,
        callbackAnchorIds: callbackAnchors,
        rhetoricalTemplateIds: ['scene-open'],
        semanticClusterIds: [archetype.toLowerCase()],
      } as SharedChatSceneBeat,
      {
        beatId: buildBeatId(sceneId, 1),
        beatType: archetype === 'RESCUE_SCENE' ? 'HELPER_INTERVENTION' : 'PLAYER_REPLY_WINDOW',
        sceneRole: archetype === 'RESCUE_SCENE' ? 'DEFEND' : 'DEFEND',
        actorId: archetype === 'RESCUE_SCENE' ? helper.actorId : undefined,
        actorKind: archetype === 'RESCUE_SCENE' ? helper.actorKind : undefined,
        delayMs: 1100,
        requiredChannel: (archetype === 'RESCUE_SCENE' ? helper.preferredChannel : input.primaryChannel) ?? input.primaryChannel,
        skippable: false,
        canInterrupt: false,
        payloadHint: 'response-window',
        targetPressure: input.pressureTier,
        rhetoricalTemplateIds: ['player-window'],
        semanticClusterIds: ['response-branch'],
      } as SharedChatSceneBeat,
      {
        beatId: buildBeatId(sceneId, 2),
        beatType: 'REVEAL',
        sceneRole: 'CALLBACK',
        actorId: supportBot.actorId,
        actorKind: supportBot.actorKind,
        delayMs: 850,
        requiredChannel: supportBot.preferredChannel ?? input.primaryChannel,
        skippable: false,
        canInterrupt: true,
        payloadHint: 'callback-reveal',
        targetPressure: input.pressureTier,
        callbackAnchorIds: callbackAnchors,
        rhetoricalTemplateIds: ['callback-weaponization'],
        semanticClusterIds: ['continuity', 'memory'],
      } as SharedChatSceneBeat,
    ];

    const plan: SharedChatScenePlan = {
      sceneId,
      momentId: input.momentId,
      momentType: input.momentType,
      archetype,
      primaryChannel: input.primaryChannel,
      beats,
      startedAt: input.now,
      expectedDurationMs: beats.reduce((sum, beat) => sum + beat.delayMs, 0) + 2500,
      allowPlayerComposerDuringScene: archetype !== 'DEAL_ROOM_PRESSURE_SCENE',
      cancellableByAuthoritativeEvent: archetype !== 'END_OF_RUN_RECKONING_SCENE',
      speakerOrder: [leadBot.actorId, supportBot.actorId, helper.actorId],
      escalationPoints: [0, 2],
      silenceWindowsMs: archetype === 'FALSE_CALM_SCENE' ? [700] : [],
      callbackAnchorIds: callbackAnchors,
      possibleBranchPoints: [`${sceneId}:branch:1`],
      planningTags: [archetype, input.momentType, input.primaryChannel],
    };

    return {
      plan,
      chosenSpeakerIds: plan.speakerOrder,
      chosenCallbackAnchorIds: plan.callbackAnchorIds,
      chosenTags: plan.planningTags,
    };
  }
}

export function createChatScenePlanner(): ChatScenePlanner {
  return new ChatScenePlanner();
}
