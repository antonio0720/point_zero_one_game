/**
 * POINT ZERO ONE — FRONTEND CHAT TRUST GRAPH
 * FILE: pzo-web/src/engines/chat/memory/TrustGraph.ts
 */
import type {
  ChatActorKind,
  ChatAffectSnapshot,
  ChatChannelId,
  ChatEngineState,
  ChatMessage,
  ChatMountTarget,
  ChatRelationshipState,
  ChatRelationshipVector,
  ChatVisibleChannel,
  ChatWorldEventDescriptor,
  Score100,
} from '../types';

export type TrustGraphNodeId = string;
export type TrustGraphEdgeId = string;
export type TrustGraphNodeKind = 'PLAYER_CORE' | 'COUNTERPART' | 'CHANNEL' | 'MOUNT' | 'WORLD_EVENT' | 'SCENE' | 'AFFECT';
export type TrustGraphEdgeKind = 'TRUST' | 'RIVALRY' | 'RESCUE' | 'ADVICE' | 'PRESSURE' | 'NEGOTIATION' | 'CHANNEL_RESONANCE' | 'CARRYOVER' | 'WORLD_EVENT' | 'SCENE_OWNERSHIP' | 'AFFECT';
export type TrustGraphDisposition = 'ESCALATE_RIVAL' | 'TRIGGER_RESCUE' | 'AMPLIFY_CROWD' | 'SHIFT_PRIVATE' | 'NEGOTIATION_PRESSURE' | 'HOLD_SILENCE' | 'CEREMONIAL_WITNESS';

export interface TrustGraphConfig {
  readonly transcriptLookbackLimit: number;
  readonly rivalryDominanceThreshold: number;
  readonly rescueThreshold: number;
  readonly trustThreshold: number;
  readonly negotiationThreshold: number;
  readonly worldEventAmplifier: number;
  readonly channelBias: Readonly<Record<ChatVisibleChannel, number>>;
}

export const DEFAULT_TRUST_GRAPH_CONFIG: TrustGraphConfig = Object.freeze({
  transcriptLookbackLimit: 240,
  rivalryDominanceThreshold: 0.72,
  rescueThreshold: 0.58,
  trustThreshold: 0.62,
  negotiationThreshold: 0.66,
  worldEventAmplifier: 1.15,
  channelBias: Object.freeze({
    GLOBAL: 1.0,
    SYNDICATE: 0.92,
    DEAL_ROOM: 1.16,
    LOBBY: 0.76,
  }),
});

export interface TrustGraphNodeMetrics {
  readonly trust01: number;
  readonly rivalry01: number;
  readonly rescue01: number;
  readonly familiarity01: number;
  readonly dominance01: number;
  readonly embarrassmentRisk01: number;
  readonly callbackReadiness01: number;
  readonly channelResonance01: number;
  readonly continuityWeight01: number;
  readonly witnessHeat01: number;
}

export interface TrustGraphNode {
  readonly nodeId: TrustGraphNodeId;
  readonly kind: TrustGraphNodeKind;
  readonly label: string;
  readonly actorKind?: ChatActorKind;
  readonly counterpartId?: string;
  readonly channelId?: ChatChannelId;
  readonly mountTarget?: ChatMountTarget;
  readonly worldEventId?: string;
  readonly sceneId?: string;
  readonly metrics: TrustGraphNodeMetrics;
  readonly tags: readonly string[];
  readonly lastObservedAt: number;
}

export interface TrustGraphEdgeMetrics {
  readonly weight01: number;
  readonly urgency01: number;
  readonly volatility01: number;
  readonly theatricality01: number;
  readonly confidence01: number;
}

export interface TrustGraphEdge {
  readonly edgeId: TrustGraphEdgeId;
  readonly kind: TrustGraphEdgeKind;
  readonly fromNodeId: TrustGraphNodeId;
  readonly toNodeId: TrustGraphNodeId;
  readonly metrics: TrustGraphEdgeMetrics;
  readonly reasons: readonly string[];
  readonly lastObservedAt: number;
}

export interface TrustGraphHotCounterpart {
  readonly counterpartId: string;
  readonly trust01: number;
  readonly rivalry01: number;
  readonly rescue01: number;
  readonly callbackReadiness01: number;
  readonly continuityWeight01: number;
  readonly recommendedDisposition: TrustGraphDisposition;
  readonly reasons: readonly string[];
}

export interface TrustGraphChannelProfile {
  readonly channelId: ChatChannelId;
  readonly resonance01: number;
  readonly witnessHeat01: number;
  readonly embarrassmentRisk01: number;
  readonly pressureBias01: number;
  readonly negotiationPredation01: number;
  readonly trustBias01: number;
  readonly rivalBias01: number;
  readonly rescueBias01: number;
}

export interface TrustGraphCarryoverSeed {
  readonly mountTarget: ChatMountTarget;
  readonly primaryCounterpartId?: string;
  readonly supportingCounterpartIds: readonly string[];
  readonly preferredChannel: ChatVisibleChannel;
  readonly suggestedDisposition: TrustGraphDisposition;
  readonly tension01: number;
  readonly rescue01: number;
  readonly rivalry01: number;
  readonly trust01: number;
  readonly reasons: readonly string[];
}

export interface TrustGraphSnapshot {
  readonly createdAt: number;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly dominantCounterpartId?: string;
  readonly rescueLeaderCounterpartId?: string;
  readonly rivalryLeaderCounterpartId?: string;
  readonly hotCounterparts: readonly TrustGraphHotCounterpart[];
  readonly channelProfiles: Readonly<Record<ChatChannelId, TrustGraphChannelProfile>>;
  readonly carryoverByMount: Readonly<Record<ChatMountTarget, TrustGraphCarryoverSeed>>;
  readonly recommendedPrimaryChannel: ChatVisibleChannel;
  readonly graphStress01: number;
  readonly graphTrust01: number;
  readonly graphRivalry01: number;
}

export interface TrustGraphRecommendations {
  readonly rescueCandidate?: TrustGraphHotCounterpart;
  readonly rivalryCandidate?: TrustGraphHotCounterpart;
  readonly trustCandidate?: TrustGraphHotCounterpart;
  readonly negotiationCandidate?: TrustGraphHotCounterpart;
  readonly dominantChannel: ChatVisibleChannel;
  readonly shouldHoldSilence: boolean;
  readonly shouldEscalateCrowd: boolean;
  readonly shouldShiftPrivate: boolean;
  readonly shouldCarryOverScene: boolean;
  readonly reasons: readonly string[];
}

interface MutableNode {
  nodeId: string;
  kind: TrustGraphNodeKind;
  label: string;
  actorKind?: ChatActorKind;
  counterpartId?: string;
  channelId?: ChatChannelId;
  mountTarget?: ChatMountTarget;
  worldEventId?: string;
  sceneId?: string;
  metrics: TrustGraphNodeMetrics;
  tags: string[];
  lastObservedAt: number;
}

interface MutableEdge {
  edgeId: string;
  kind: TrustGraphEdgeKind;
  fromNodeId: string;
  toNodeId: string;
  metrics: TrustGraphEdgeMetrics;
  reasons: string[];
  lastObservedAt: number;
}

interface MaterializedRelationship {
  readonly state: ChatRelationshipState;
  readonly trust01: number;
  readonly rivalry01: number;
  readonly rescue01: number;
  readonly familiarity01: number;
  readonly callbackReadiness01: number;
  readonly dominance01: number;
}

interface ChannelAccumulator {
  witnessHeat01: number;
  embarrassmentRisk01: number;
  pressureBias01: number;
  negotiationPredation01: number;
  trustBias01: number;
  rivalBias01: number;
  rescueBias01: number;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

function score100To01(value: number | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return clamp01(value / 100);
}

function asScore100(value01: number): Score100 {
  return Math.round(clamp01(value01) * 100) as Score100;
}

function average(values: readonly number[]): number {
  if (!values.length) return 0;
  return clamp01(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function maximum(values: readonly number[]): number {
  if (!values.length) return 0;
  return clamp01(Math.max(...values));
}

function now(): number {
  return Date.now();
}

function playerNodeId(): string { return 'player::core'; }
function affectNodeId(): string { return 'affect::player'; }
function counterpartNodeId(counterpartId: string): string { return `counterpart::${counterpartId}`; }
function channelNodeId(channelId: ChatChannelId): string { return `channel::${channelId}`; }
function mountNodeId(mountTarget: ChatMountTarget): string { return `mount::${mountTarget}`; }
function sceneNodeId(sceneId: string): string { return `scene::${sceneId}`; }
function worldEventNodeId(eventId: string): string { return `world-event::${eventId}`; }
function edgeId(kind: TrustGraphEdgeKind, fromNodeId: string, toNodeId: string): string { return `${kind}::${fromNodeId}::${toNodeId}`; }

function relationshipTrust01(vector: ChatRelationshipVector): number {
  return average([
    score100To01(vector.trust),
    score100To01(vector.adviceObedience),
    score100To01(vector.respect) * 0.85,
    score100To01(vector.familiarity) * 0.65,
  ]);
}

function relationshipRivalry01(vector: ChatRelationshipVector): number {
  return average([
    score100To01(vector.rivalryIntensity),
    score100To01(vector.contempt) * 0.95,
    score100To01(vector.fear) * 0.35,
    score100To01(vector.fascination) * 0.30,
  ]);
}

function relationshipRescue01(vector: ChatRelationshipVector): number {
  return average([
    score100To01(vector.rescueDebt) * 0.92,
    score100To01(vector.trust) * 0.50,
    score100To01(vector.familiarity) * 0.58,
    score100To01(vector.adviceObedience) * 0.55,
  ]);
}

function callbackReadiness01(state: ChatRelationshipState): number {
  const callbackCount = clamp01(state.callbacksAvailable.length / 8);
  const escalation =
    state.escalationTier === 'OBSESSIVE' ? 1 :
    state.escalationTier === 'ACTIVE' ? 0.72 :
    state.escalationTier === 'MILD' ? 0.42 : 0.18;
  return clamp01(callbackCount * 0.55 + escalation * 0.25 + relationshipRivalry01(state.vector) * 0.20);
}

function relationshipDominance01(state: ChatRelationshipState): number {
  return clamp01(
    relationshipRivalry01(state.vector) * 0.38 +
    relationshipTrust01(state.vector) * 0.18 +
    relationshipRescue01(state.vector) * 0.16 +
    callbackReadiness01(state) * 0.14 +
    score100To01(state.vector.familiarity) * 0.14
  );
}

function materializeRelationship(state: ChatRelationshipState): MaterializedRelationship {
  return {
    state,
    trust01: relationshipTrust01(state.vector),
    rivalry01: relationshipRivalry01(state.vector),
    rescue01: relationshipRescue01(state.vector),
    familiarity01: score100To01(state.vector.familiarity),
    callbackReadiness01: callbackReadiness01(state),
    dominance01: relationshipDominance01(state),
  };
}

function affectTrust01(affect: ChatAffectSnapshot): number {
  return score100To01(affect.vector.trust);
}

function affectPressure01(affect: ChatAffectSnapshot): number {
  return average([
    score100To01(affect.vector.intimidation),
    score100To01(affect.vector.frustration),
    score100To01(affect.vector.desperation),
    score100To01(affect.vector.embarrassment),
  ]);
}

function affectDominance01(affect: ChatAffectSnapshot): number {
  return average([
    score100To01(affect.vector.confidence),
    score100To01(affect.vector.dominance),
    1 - score100To01(affect.vector.intimidation),
  ]);
}

function messageWeight(message: ChatMessage): number {
  switch (message.kind) {
    case 'RELATIONSHIP_CALLBACK': return 0.98;
    case 'BOT_TAUNT':
    case 'BOT_ATTACK':
    case 'HATER_TELEGRAPH':
    case 'HATER_PUNISH':
      return 0.92;
    case 'HELPER_PROMPT':
    case 'HELPER_RESCUE':
      return 0.78;
    case 'DEAL_RECAP':
      return 0.88;
    case 'CROWD_REACTION':
    case 'ACHIEVEMENT':
    case 'MARKET_ALERT':
    case 'SYSTEM':
      return 0.52;
    default:
      return 0.28;
  }
}

function embarrassmentWeight(message: ChatMessage): number {
  const body = message.body.toLowerCase();
  const hits = ['everyone saw','you folded','you choked','exposed','humiliated','you said','collapse','broke']
    .filter((term) => body.includes(term)).length;
  return clamp01(hits * 0.13 + (message.kind === 'RELATIONSHIP_CALLBACK' ? 0.22 : 0) + messageWeight(message) * 0.18);
}

function negotiationWeight(message: ChatMessage): number {
  const body = message.body.toLowerCase();
  const hits = ['offer expires','price just moved','counter','hold or sell','panic','late','take the deal']
    .filter((term) => body.includes(term)).length;
  return clamp01(hits * 0.12 + (message.channel === 'DEAL_ROOM' ? 0.18 : 0) + (message.kind === 'DEAL_RECAP' ? 0.25 : 0));
}

function dispositionForHotCounterpart(hot: TrustGraphHotCounterpart): TrustGraphDisposition {
  if (hot.rescue01 >= 0.70 && hot.trust01 >= 0.44) return 'TRIGGER_RESCUE';
  if (hot.rivalry01 >= 0.76) return 'ESCALATE_RIVAL';
  if (hot.callbackReadiness01 >= 0.72 && hot.rivalry01 >= 0.54) return 'AMPLIFY_CROWD';
  if (hot.trust01 >= 0.68 && hot.rescue01 < 0.42) return 'SHIFT_PRIVATE';
  return 'CEREMONIAL_WITNESS';
}


export class TrustGraph {
  private readonly config: TrustGraphConfig;
  private readonly nodes = new Map<string, MutableNode>();
  private readonly edges = new Map<string, MutableEdge>();
  private lastSnapshot?: TrustGraphSnapshot;
  private lastRecommendations?: TrustGraphRecommendations;

  public constructor(config: Partial<TrustGraphConfig> = {}) {
    this.config = Object.freeze({
      ...DEFAULT_TRUST_GRAPH_CONFIG,
      ...config,
      channelBias: Object.freeze({
        ...DEFAULT_TRUST_GRAPH_CONFIG.channelBias,
        ...(config.channelBias ?? {}),
      }),
    });
  }

  public static fromEngineState(state: ChatEngineState, config: Partial<TrustGraphConfig> = {}): TrustGraph {
    const graph = new TrustGraph(config);
    graph.rebuildFromEngineState(state);
    return graph;
  }

  public rebuildFromEngineState(state: ChatEngineState): TrustGraphSnapshot {
    this.nodes.clear();
    this.edges.clear();
    const materialized = Object.values(state.relationshipsByCounterpartId).map(materializeRelationship);
    const channelAccumulators = this.buildChannelAccumulators(state, materialized);
    this.seedBaseNodes(state);
    this.buildCounterpartNodes(state, materialized, channelAccumulators);
    this.buildChannelNodes(channelAccumulators);
    this.buildWorldEventNodes(state.liveOps.activeWorldEvents);
    this.buildEdges(state, materialized, channelAccumulators);
    const snapshot = this.buildSnapshot(state, materialized, channelAccumulators);
    const recommendations = this.buildRecommendations(snapshot, state);
    this.lastSnapshot = snapshot;
    this.lastRecommendations = recommendations;
    return snapshot;
  }

  public getSnapshot(): TrustGraphSnapshot | undefined {
    return this.lastSnapshot;
  }

  public getRecommendations(): TrustGraphRecommendations | undefined {
    return this.lastRecommendations;
  }

  public listNodes(): readonly TrustGraphNode[] {
    return [...this.nodes.values()].map((node) => Object.freeze({ ...node, tags: Object.freeze([...node.tags]) }));
  }

  public listEdges(): readonly TrustGraphEdge[] {
    return [...this.edges.values()].map((edge) => Object.freeze({ ...edge, reasons: Object.freeze([...edge.reasons]) }));
  }


  private buildChannelAccumulators(
    state: ChatEngineState,
    materialized: readonly MaterializedRelationship[],
  ): Readonly<Record<ChatChannelId, ChannelAccumulator>> {
    const accumulators: Record<ChatChannelId, ChannelAccumulator> = {
      GLOBAL: { witnessHeat01: 0, embarrassmentRisk01: 0, pressureBias01: 0, negotiationPredation01: 0, trustBias01: 0, rivalBias01: 0, rescueBias01: 0 },
      SYNDICATE: { witnessHeat01: 0, embarrassmentRisk01: 0, pressureBias01: 0, negotiationPredation01: 0, trustBias01: 0, rivalBias01: 0, rescueBias01: 0 },
      DEAL_ROOM: { witnessHeat01: 0, embarrassmentRisk01: 0, pressureBias01: 0, negotiationPredation01: 0, trustBias01: 0, rivalBias01: 0, rescueBias01: 0 },
      LOBBY: { witnessHeat01: 0, embarrassmentRisk01: 0, pressureBias01: 0, negotiationPredation01: 0, trustBias01: 0, rivalBias01: 0, rescueBias01: 0 },
      SYSTEM_SHADOW: { witnessHeat01: 0, embarrassmentRisk01: 0, pressureBias01: 0, negotiationPredation01: 0, trustBias01: 0, rivalBias01: 0, rescueBias01: 0 },
      NPC_SHADOW: { witnessHeat01: 0, embarrassmentRisk01: 0, pressureBias01: 0, negotiationPredation01: 0, trustBias01: 0, rivalBias01: 0, rescueBias01: 0 },
      RIVALRY_SHADOW: { witnessHeat01: 0, embarrassmentRisk01: 0, pressureBias01: 0, negotiationPredation01: 0, trustBias01: 0, rivalBias01: 0, rescueBias01: 0 },
      RESCUE_SHADOW: { witnessHeat01: 0, embarrassmentRisk01: 0, pressureBias01: 0, negotiationPredation01: 0, trustBias01: 0, rivalBias01: 0, rescueBias01: 0 },
      LIVEOPS_SHADOW: { witnessHeat01: 0, embarrassmentRisk01: 0, pressureBias01: 0, negotiationPredation01: 0, trustBias01: 0, rivalBias01: 0, rescueBias01: 0 },
    };

    for (const channelId of ['GLOBAL','SYNDICATE','DEAL_ROOM','LOBBY'] as const) {
      const messages = [...state.messagesByChannel[channelId]].slice(-this.config.transcriptLookbackLimit);
      accumulators[channelId].pressureBias01 = clamp01(affectPressure01(state.affect) * 0.40 + this.config.channelBias[channelId] * 0.18);
      accumulators[channelId].trustBias01 = clamp01(affectTrust01(state.affect) * 0.38 + score100To01(state.learningProfile?.channelAffinity[channelId]) * 0.32);

      for (const message of messages) {
        accumulators[channelId].witnessHeat01 = clamp01(accumulators[channelId].witnessHeat01 + messageWeight(message) * 0.035);
        accumulators[channelId].embarrassmentRisk01 = clamp01(accumulators[channelId].embarrassmentRisk01 + embarrassmentWeight(message) * 0.12);
        accumulators[channelId].negotiationPredation01 = clamp01(accumulators[channelId].negotiationPredation01 + negotiationWeight(message) * 0.14);
      }
    }

    for (const entry of materialized) {
      const relationship = entry.state;
      const likelyChannel =
        relationship.counterpartKind === 'HELPER' ? 'SYNDICATE' :
        relationship.counterpartKind === 'RIVAL' || relationship.counterpartKind === 'BOT' ? 'GLOBAL' :
        relationship.counterpartKind === 'SYSTEM' ? 'GLOBAL' :
        relationship.counterpartKind === 'NPC' ? 'GLOBAL' :
        relationship.counterpartKind === 'AMBIENT' ? 'GLOBAL' :
        'DEAL_ROOM';

      accumulators[likelyChannel].trustBias01 = clamp01(accumulators[likelyChannel].trustBias01 + entry.trust01 * 0.08);
      accumulators[likelyChannel].rivalBias01 = clamp01(accumulators[likelyChannel].rivalBias01 + entry.rivalry01 * 0.08);
      accumulators[likelyChannel].rescueBias01 = clamp01(accumulators[likelyChannel].rescueBias01 + entry.rescue01 * 0.08);
    }

    accumulators['RIVALRY_SHADOW'].rivalBias01 = maximum(materialized.map((entry) => entry.rivalry01));
    accumulators['RESCUE_SHADOW'].rescueBias01 = maximum(materialized.map((entry) => entry.rescue01));
    accumulators['NPC_SHADOW'].trustBias01 = average(materialized.map((entry) => entry.trust01));
    accumulators['SYSTEM_SHADOW'].pressureBias01 = affectPressure01(state.affect);
    accumulators['LIVEOPS_SHADOW'].witnessHeat01 = maximum([affectPressure01(state.affect), ...(['GLOBAL','SYNDICATE','DEAL_ROOM','LOBBY'] as const).map((channelId) => accumulators[channelId].witnessHeat01)]);

    return accumulators;
  }

  private seedBaseNodes(state: ChatEngineState): void {
    this.upsertNode({
      nodeId: playerNodeId(),
      kind: 'PLAYER_CORE',
      label: 'Player Core',
      actorKind: 'PLAYER',
      metrics: {
        trust01: affectTrust01(state.affect),
        rivalry01: affectPressure01(state.affect) * 0.45,
        rescue01: clamp01(affectPressure01(state.affect) * 0.55 - affectDominance01(state.affect) * 0.20),
        familiarity01: 1,
        dominance01: affectDominance01(state.affect),
        embarrassmentRisk01: score100To01(state.affect.vector.embarrassment),
        callbackReadiness01: 0,
        channelResonance01: 1,
        continuityWeight01: 1,
        witnessHeat01: 0,
      },
      tags: ['player','core'],
      lastObservedAt: now(),
    });

    this.upsertNode({
      nodeId: affectNodeId(),
      kind: 'AFFECT',
      label: `Affect:${state.affect.dominantEmotion}`,
      metrics: {
        trust01: affectTrust01(state.affect),
        rivalry01: affectPressure01(state.affect) * 0.48,
        rescue01: clamp01(score100To01(state.affect.vector.desperation) * 0.60 + score100To01(state.affect.vector.relief) * 0.15),
        familiarity01: 1,
        dominance01: affectDominance01(state.affect),
        embarrassmentRisk01: score100To01(state.affect.vector.embarrassment),
        callbackReadiness01: clamp01(Math.abs(state.affect.confidenceSwingDelta) / 100),
        channelResonance01: 1,
        continuityWeight01: 0.88,
        witnessHeat01: 0,
      },
      tags: ['affect', state.affect.dominantEmotion.toLowerCase()],
      lastObservedAt: state.affect.lastUpdatedAt,
    });

    this.upsertNode({
      nodeId: mountNodeId(state.activeMountTarget),
      kind: 'MOUNT',
      label: state.activeMountTarget,
      mountTarget: state.activeMountTarget,
      metrics: {
        trust01: 0.5,
        rivalry01: 0.5,
        rescue01: 0.5,
        familiarity01: state.continuity.lastMountTarget === state.activeMountTarget ? 1 : 0.45,
        dominance01: 0.32,
        embarrassmentRisk01: 0.15,
        callbackReadiness01: 0.10,
        channelResonance01: 1,
        continuityWeight01: state.continuity.lastMountTarget === state.activeMountTarget ? 1 : 0.55,
        witnessHeat01: 0,
      },
      tags: ['mount'],
      lastObservedAt: now(),
    });

    if (state.activeScene?.sceneId) {
      this.upsertNode({
        nodeId: sceneNodeId(state.activeScene.sceneId),
        kind: 'SCENE',
        label: state.activeScene.sceneId,
        sceneId: state.activeScene.sceneId,
        metrics: {
          trust01: 0.45,
          rivalry01: 0.55,
          rescue01: 0.42,
          familiarity01: 0.5,
          dominance01: 0.66,
          embarrassmentRisk01: 0.25,
          callbackReadiness01: 0.35,
          channelResonance01: 1,
          continuityWeight01: 0.72,
          witnessHeat01: 0.18,
        },
        tags: ['scene','active'],
        lastObservedAt: now(),
      });
    }
  }


  private buildCounterpartNodes(state: ChatEngineState, materialized: readonly MaterializedRelationship[], channelAccumulators: Readonly<Record<ChatChannelId, ChannelAccumulator>>): void {
    for (const entry of materialized) {
      const relationship = entry.state;
      const likelyChannel =
        relationship.counterpartKind === 'HELPER' ? 'SYNDICATE' :
        relationship.counterpartKind === 'RIVAL' || relationship.counterpartKind === 'BOT' ? 'GLOBAL' :
        relationship.counterpartKind === 'SYSTEM' ? 'GLOBAL' :
        relationship.counterpartKind === 'NPC' ? 'GLOBAL' :
        relationship.counterpartKind === 'AMBIENT' ? 'GLOBAL' :
        'DEAL_ROOM';

      const witnessHeat01 = channelAccumulators[likelyChannel].witnessHeat01 * 0.75;
      const embarrassmentRisk01 = channelAccumulators[likelyChannel].embarrassmentRisk01 * 0.65;
      const continuityWeight01 = clamp01(entry.dominance01 * 0.42 + entry.callbackReadiness01 * 0.16 + entry.familiarity01 * 0.18 + witnessHeat01 * 0.12 + (state.continuity.lastMountTarget === state.activeMountTarget ? 0.12 : 0));

      this.upsertNode({
        nodeId: counterpartNodeId(relationship.counterpartId),
        kind: 'COUNTERPART',
        label: relationship.counterpartId,
        counterpartId: relationship.counterpartId,
        actorKind:
          relationship.counterpartKind === 'HELPER' ? 'HELPER' :
          relationship.counterpartKind === 'RIVAL' || relationship.counterpartKind === 'BOT' ? 'HATER' :
          relationship.counterpartKind === 'SYSTEM' || relationship.counterpartKind === 'ARCHIVIST' ? 'SYSTEM' :
          relationship.counterpartKind === 'AMBIENT' || relationship.counterpartKind === 'NPC' ? 'AMBIENT_NPC' :
          'DEAL_AGENT',
        metrics: {
          trust01: entry.trust01,
          rivalry01: entry.rivalry01,
          rescue01: entry.rescue01,
          familiarity01: entry.familiarity01,
          dominance01: entry.dominance01,
          embarrassmentRisk01,
          callbackReadiness01: entry.callbackReadiness01,
          channelResonance01: channelAccumulators[likelyChannel].witnessHeat01,
          continuityWeight01,
          witnessHeat01,
        },
        tags: [`counterpart-kind:${relationship.counterpartKind}`, `escalation:${relationship.escalationTier}`],
        lastObservedAt: relationship.lastMeaningfulShiftAt,
      });
    }
  }

  private buildChannelNodes(channelAccumulators: Readonly<Record<ChatChannelId, ChannelAccumulator>>): void {
    for (const [channelId, profile] of Object.entries(channelAccumulators) as [ChatChannelId, ChannelAccumulator][]) {
      this.upsertNode({
        nodeId: channelNodeId(channelId),
        kind: 'CHANNEL',
        label: channelId,
        channelId,
        metrics: {
          trust01: profile.trustBias01,
          rivalry01: profile.rivalBias01,
          rescue01: profile.rescueBias01,
          familiarity01: 0.5,
          dominance01: maximum([profile.witnessHeat01, profile.negotiationPredation01, profile.rivalBias01, profile.rescueBias01]),
          embarrassmentRisk01: profile.embarrassmentRisk01,
          callbackReadiness01: 0,
          channelResonance01: maximum([profile.witnessHeat01, profile.pressureBias01, profile.trustBias01, profile.rivalBias01, profile.rescueBias01]),
          continuityWeight01: 0.5,
          witnessHeat01: profile.witnessHeat01,
        },
        tags: ['channel'],
        lastObservedAt: now(),
      });
    }
  }

  private buildWorldEventNodes(events: readonly ChatWorldEventDescriptor[]): void {
    for (const event of events) {
      this.upsertNode({
        nodeId: worldEventNodeId(event.eventId),
        kind: 'WORLD_EVENT',
        label: event.title,
        worldEventId: event.eventId,
        metrics: {
          trust01: 0.18,
          rivalry01: 0.52,
          rescue01: 0.26,
          familiarity01: 0.32,
          dominance01: clamp01(0.54 * this.config.worldEventAmplifier),
          embarrassmentRisk01: 0.18,
          callbackReadiness01: 0.10,
          channelResonance01: 1,
          continuityWeight01: 0.65,
          witnessHeat01: 0.45,
        },
        tags: ['world-event', event.category.toLowerCase()],
        lastObservedAt: event.startsAt,
      });
    }
  }

  private buildEdges(state: ChatEngineState, materialized: readonly MaterializedRelationship[], channelAccumulators: Readonly<Record<ChatChannelId, ChannelAccumulator>>): void {
    this.upsertEdge({
      edgeId: edgeId('AFFECT', affectNodeId(), playerNodeId()),
      kind: 'AFFECT',
      fromNodeId: affectNodeId(),
      toNodeId: playerNodeId(),
      metrics: {
        weight01: affectPressure01(state.affect),
        urgency01: clamp01(Math.abs(state.affect.confidenceSwingDelta) / 100),
        volatility01: clamp01(Math.abs(state.affect.confidenceSwingDelta) / 100),
        theatricality01: clamp01(score100To01(state.affect.vector.embarrassment) * 0.55),
        confidence01: affectDominance01(state.affect),
      },
      reasons: [`dominant:${state.affect.dominantEmotion}`],
      lastObservedAt: state.affect.lastUpdatedAt,
    });

    for (const entry of materialized) {
      const relationship = entry.state;
      const nodeId = counterpartNodeId(relationship.counterpartId);
      this.upsertEdge({
        edgeId: edgeId('TRUST', playerNodeId(), nodeId),
        kind: 'TRUST',
        fromNodeId: playerNodeId(),
        toNodeId: nodeId,
        metrics: { weight01: entry.trust01, urgency01: entry.rescue01, volatility01: entry.rivalry01, theatricality01: entry.callbackReadiness01, confidence01: entry.familiarity01 },
        reasons: ['relationship-trust'],
        lastObservedAt: relationship.lastMeaningfulShiftAt,
      });
      this.upsertEdge({
        edgeId: edgeId('RIVALRY', playerNodeId(), nodeId),
        kind: 'RIVALRY',
        fromNodeId: playerNodeId(),
        toNodeId: nodeId,
        metrics: { weight01: entry.rivalry01, urgency01: entry.callbackReadiness01, volatility01: entry.rivalry01, theatricality01: entry.rivalry01, confidence01: clamp01(1 - entry.trust01) },
        reasons: ['relationship-rivalry'],
        lastObservedAt: relationship.lastMeaningfulShiftAt,
      });
      this.upsertEdge({
        edgeId: edgeId('RESCUE', nodeId, playerNodeId()),
        kind: 'RESCUE',
        fromNodeId: nodeId,
        toNodeId: playerNodeId(),
        metrics: { weight01: entry.rescue01, urgency01: entry.rescue01, volatility01: 0.25, theatricality01: 0.20, confidence01: entry.trust01 },
        reasons: ['relationship-rescue'],
        lastObservedAt: relationship.lastMeaningfulShiftAt,
      });
    }
  }

  private buildSnapshot(state: ChatEngineState, materialized: readonly MaterializedRelationship[], channelAccumulators: Readonly<Record<ChatChannelId, ChannelAccumulator>>): TrustGraphSnapshot {
    const hotCounterparts = materialized.map((entry) => ({
      counterpartId: entry.state.counterpartId,
      trust01: entry.trust01,
      rivalry01: entry.rivalry01,
      rescue01: entry.rescue01,
      callbackReadiness01: entry.callbackReadiness01,
      continuityWeight01: entry.dominance01,
      recommendedDisposition: dispositionForHotCounterpart({
        counterpartId: entry.state.counterpartId,
        trust01: entry.trust01,
        rivalry01: entry.rivalry01,
        rescue01: entry.rescue01,
        callbackReadiness01: entry.callbackReadiness01,
        continuityWeight01: entry.dominance01,
        recommendedDisposition: 'CEREMONIAL_WITNESS',
        reasons: [],
      }),
      reasons: [],
    } satisfies TrustGraphHotCounterpart)).sort((a, b) => (b.rivalry01 + b.rescue01 + b.trust01 + b.callbackReadiness01 + b.continuityWeight01) - (a.rivalry01 + a.rescue01 + a.trust01 + a.callbackReadiness01 + a.continuityWeight01));

    const channelProfiles = Object.freeze(Object.fromEntries(
      Object.entries(channelAccumulators).map(([channelId, profile]) => [channelId, {
        channelId: channelId as ChatChannelId,
        resonance01: maximum([profile.witnessHeat01, profile.pressureBias01, profile.trustBias01, profile.rivalBias01, profile.rescueBias01, profile.negotiationPredation01]),
        witnessHeat01: profile.witnessHeat01,
        embarrassmentRisk01: profile.embarrassmentRisk01,
        pressureBias01: profile.pressureBias01,
        negotiationPredation01: profile.negotiationPredation01,
        trustBias01: profile.trustBias01,
        rivalBias01: profile.rivalBias01,
        rescueBias01: profile.rescueBias01,
      } satisfies TrustGraphChannelProfile])
    )) as Readonly<Record<ChatChannelId, TrustGraphChannelProfile>>;

    const carryoverByMount = Object.freeze(Object.fromEntries(
      ['BATTLE_HUD','CLUB_UI','EMPIRE_GAME_SCREEN','GAME_BOARD','LEAGUE_UI','LOBBY_SCREEN','PHANTOM_GAME_SCREEN','PREDATOR_GAME_SCREEN','SYNDICATE_GAME_SCREEN','POST_RUN_SUMMARY'] .map((mountTarget) => {
        const primary = hotCounterparts[0];
        const supporting = hotCounterparts.slice(1, 4);
        const disposition = primary ? dispositionForHotCounterpart(primary) : 'CEREMONIAL_WITNESS';
        const preferredChannel: ChatVisibleChannel =
          disposition === 'TRIGGER_RESCUE' ? 'SYNDICATE' :
          disposition === 'NEGOTIATION_PRESSURE' ? 'DEAL_ROOM' :
          disposition === 'SHIFT_PRIVATE' ? 'SYNDICATE' :
          disposition === 'HOLD_SILENCE' ? state.activeVisibleChannel :
          'GLOBAL';

        return [mountTarget, {
          mountTarget: mountTarget as ChatMountTarget,
          primaryCounterpartId: primary?.counterpartId,
          supportingCounterpartIds: supporting.map((entry) => entry.counterpartId),
          preferredChannel,
          suggestedDisposition: disposition,
          tension01: maximum([primary?.rivalry01 ?? 0, channelProfiles[preferredChannel].pressureBias01, channelProfiles[preferredChannel].witnessHeat01]),
          rescue01: primary?.rescue01 ?? 0,
          rivalry01: primary?.rivalry01 ?? 0,
          trust01: primary?.trust01 ?? 0,
          reasons: primary ? [`primary:${primary.counterpartId}`, `disposition:${disposition}`, `channel:${preferredChannel}`] : ['no-primary-counterpart'],
        } satisfies TrustGraphCarryoverSeed];
      })
    )) as Readonly<Record<ChatMountTarget, TrustGraphCarryoverSeed>>;

    const graphTrust01 = average(materialized.map((entry) => entry.trust01));
    const graphRivalry01 = average(materialized.map((entry) => entry.rivalry01));
    const graphStress01 = clamp01(affectPressure01(state.affect) * 0.34 + maximum(Object.values(channelProfiles).map((profile) => profile.witnessHeat01)) * 0.24 + graphRivalry01 * 0.24 + maximum(hotCounterparts.map((entry) => entry.callbackReadiness01)) * 0.18);
    const recommendedPrimaryChannel = (['GLOBAL','SYNDICATE','DEAL_ROOM','LOBBY'] as const)
      .map((channelId) => channelProfiles[channelId])
      .sort((a, b) => (b.resonance01 + b.witnessHeat01 + b.rivalBias01 + b.rescueBias01) - (a.resonance01 + a.witnessHeat01 + a.rivalBias01 + a.rescueBias01))[0]?.channelId as ChatVisibleChannel | undefined;

    return {
      createdAt: now(),
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      dominantCounterpartId: hotCounterparts[0]?.counterpartId,
      rescueLeaderCounterpartId: [...hotCounterparts].sort((a, b) => b.rescue01 - a.rescue01)[0]?.counterpartId,
      rivalryLeaderCounterpartId: [...hotCounterparts].sort((a, b) => b.rivalry01 - a.rivalry01)[0]?.counterpartId,
      hotCounterparts,
      channelProfiles,
      carryoverByMount,
      recommendedPrimaryChannel: recommendedPrimaryChannel ?? state.activeVisibleChannel,
      graphStress01,
      graphTrust01,
      graphRivalry01,
    };
  }

  private buildRecommendations(snapshot: TrustGraphSnapshot, state: ChatEngineState): TrustGraphRecommendations {
    const rescueCandidate = snapshot.hotCounterparts.find((entry) => entry.rescue01 >= this.config.rescueThreshold);
    const rivalryCandidate = snapshot.hotCounterparts.find((entry) => entry.rivalry01 >= this.config.rivalryDominanceThreshold);
    const trustCandidate = snapshot.hotCounterparts.find((entry) => entry.trust01 >= this.config.trustThreshold);
    const negotiationCandidate = snapshot.hotCounterparts.find((entry) => entry.recommendedDisposition === 'NEGOTIATION_PRESSURE' || snapshot.channelProfiles.DEAL_ROOM.negotiationPredation01 >= this.config.negotiationThreshold);

    const shouldHoldSilence = state.affect.dominantEmotion === 'FRUSTRATION' && snapshot.graphStress01 >= 0.62 && !rescueCandidate;
    const shouldEscalateCrowd = snapshot.graphRivalry01 >= 0.58 && snapshot.channelProfiles.GLOBAL.witnessHeat01 >= 0.34;
    const shouldShiftPrivate = !!trustCandidate && trustCandidate.trust01 >= trustCandidate.rivalry01 && snapshot.channelProfiles.SYNDICATE.trustBias01 > snapshot.channelProfiles.GLOBAL.trustBias01;
    const shouldCarryOverScene = !!snapshot.carryoverByMount[state.activeMountTarget].primaryCounterpartId && snapshot.carryoverByMount[state.activeMountTarget].tension01 >= 0.34;
    const reasons = [
      ...(rescueCandidate ? [`rescue:${rescueCandidate.counterpartId}`] : []),
      ...(rivalryCandidate ? [`rival:${rivalryCandidate.counterpartId}`] : []),
      ...(trustCandidate ? [`trust:${trustCandidate.counterpartId}`] : []),
      ...(negotiationCandidate ? [`negotiation:${negotiationCandidate.counterpartId}`] : []),
      ...(shouldHoldSilence ? ['silence:protective'] : []),
      ...(shouldEscalateCrowd ? ['crowd:global-theatrical'] : []),
      ...(shouldShiftPrivate ? ['shift:syndicate-private'] : []),
      ...(shouldCarryOverScene ? ['carryover:scene-continuity'] : []),
    ];

    return {
      rescueCandidate,
      rivalryCandidate,
      trustCandidate,
      negotiationCandidate,
      dominantChannel: snapshot.recommendedPrimaryChannel,
      shouldHoldSilence,
      shouldEscalateCrowd,
      shouldShiftPrivate,
      shouldCarryOverScene,
      reasons,
    };
  }

  private upsertNode(node: MutableNode): void {
    const existing = this.nodes.get(node.nodeId);
    if (!existing) {
      this.nodes.set(node.nodeId, node);
      return;
    }
    existing.metrics = {
      trust01: maximum([existing.metrics.trust01, node.metrics.trust01]),
      rivalry01: maximum([existing.metrics.rivalry01, node.metrics.rivalry01]),
      rescue01: maximum([existing.metrics.rescue01, node.metrics.rescue01]),
      familiarity01: maximum([existing.metrics.familiarity01, node.metrics.familiarity01]),
      dominance01: maximum([existing.metrics.dominance01, node.metrics.dominance01]),
      embarrassmentRisk01: maximum([existing.metrics.embarrassmentRisk01, node.metrics.embarrassmentRisk01]),
      callbackReadiness01: maximum([existing.metrics.callbackReadiness01, node.metrics.callbackReadiness01]),
      channelResonance01: maximum([existing.metrics.channelResonance01, node.metrics.channelResonance01]),
      continuityWeight01: maximum([existing.metrics.continuityWeight01, node.metrics.continuityWeight01]),
      witnessHeat01: maximum([existing.metrics.witnessHeat01, node.metrics.witnessHeat01]),
    };
    existing.tags = [...new Set([...existing.tags, ...node.tags])];
    existing.lastObservedAt = Math.max(existing.lastObservedAt, node.lastObservedAt);
  }

  private upsertEdge(edge: MutableEdge): void {
    const existing = this.edges.get(edge.edgeId);
    if (!existing) {
      this.edges.set(edge.edgeId, edge);
      return;
    }
    existing.metrics = {
      weight01: maximum([existing.metrics.weight01, edge.metrics.weight01]),
      urgency01: maximum([existing.metrics.urgency01, edge.metrics.urgency01]),
      volatility01: maximum([existing.metrics.volatility01, edge.metrics.volatility01]),
      theatricality01: maximum([existing.metrics.theatricality01, edge.metrics.theatricality01]),
      confidence01: maximum([existing.metrics.confidence01, edge.metrics.confidence01]),
    };
    existing.reasons = [...new Set([...existing.reasons, ...edge.reasons])];
    existing.lastObservedAt = Math.max(existing.lastObservedAt, edge.lastObservedAt);
  }


  public getTrustByCounterpart(counterpartId: string): Score100 {
    const node = this.nodes.get(counterpartNodeId(counterpartId));
    return asScore100(node?.metrics.trust01 ?? 0);
  }

  public getTrustByChannel(channelId: ChatChannelId): Score100 {
    const node = this.nodes.get(channelNodeId(channelId));
    return asScore100(node?.metrics.trust01 ?? 0);
  }

  public listCounterpartsByTrust(): readonly Readonly<{ counterpartId: string; trust01: Score100 }>[] {
    return [...this.nodes.values()]
      .filter((node) => node.kind === 'COUNTERPART' && typeof node.counterpartId === 'string')
      .sort((a, b) => b.metrics.trust01 - a.metrics.trust01)
      .map((node) => Object.freeze({
        counterpartId: node.counterpartId as string,
        trust01: asScore100(node.metrics.trust01),
      }));
  }


  public getRivalryByCounterpart(counterpartId: string): Score100 {
    const node = this.nodes.get(counterpartNodeId(counterpartId));
    return asScore100(node?.metrics.rivalry01 ?? 0);
  }

  public getRivalryByChannel(channelId: ChatChannelId): Score100 {
    const node = this.nodes.get(channelNodeId(channelId));
    return asScore100(node?.metrics.rivalry01 ?? 0);
  }

  public listCounterpartsByRivalry(): readonly Readonly<{ counterpartId: string; rivalry01: Score100 }>[] {
    return [...this.nodes.values()]
      .filter((node) => node.kind === 'COUNTERPART' && typeof node.counterpartId === 'string')
      .sort((a, b) => b.metrics.rivalry01 - a.metrics.rivalry01)
      .map((node) => Object.freeze({
        counterpartId: node.counterpartId as string,
        rivalry01: asScore100(node.metrics.rivalry01),
      }));
  }


  public getRescueByCounterpart(counterpartId: string): Score100 {
    const node = this.nodes.get(counterpartNodeId(counterpartId));
    return asScore100(node?.metrics.rescue01 ?? 0);
  }

  public getRescueByChannel(channelId: ChatChannelId): Score100 {
    const node = this.nodes.get(channelNodeId(channelId));
    return asScore100(node?.metrics.rescue01 ?? 0);
  }

  public listCounterpartsByRescue(): readonly Readonly<{ counterpartId: string; rescue01: Score100 }>[] {
    return [...this.nodes.values()]
      .filter((node) => node.kind === 'COUNTERPART' && typeof node.counterpartId === 'string')
      .sort((a, b) => b.metrics.rescue01 - a.metrics.rescue01)
      .map((node) => Object.freeze({
        counterpartId: node.counterpartId as string,
        rescue01: asScore100(node.metrics.rescue01),
      }));
  }


  public getFamiliarityByCounterpart(counterpartId: string): Score100 {
    const node = this.nodes.get(counterpartNodeId(counterpartId));
    return asScore100(node?.metrics.familiarity01 ?? 0);
  }

  public getFamiliarityByChannel(channelId: ChatChannelId): Score100 {
    const node = this.nodes.get(channelNodeId(channelId));
    return asScore100(node?.metrics.familiarity01 ?? 0);
  }

  public listCounterpartsByFamiliarity(): readonly Readonly<{ counterpartId: string; familiarity01: Score100 }>[] {
    return [...this.nodes.values()]
      .filter((node) => node.kind === 'COUNTERPART' && typeof node.counterpartId === 'string')
      .sort((a, b) => b.metrics.familiarity01 - a.metrics.familiarity01)
      .map((node) => Object.freeze({
        counterpartId: node.counterpartId as string,
        familiarity01: asScore100(node.metrics.familiarity01),
      }));
  }


  public getDominanceByCounterpart(counterpartId: string): Score100 {
    const node = this.nodes.get(counterpartNodeId(counterpartId));
    return asScore100(node?.metrics.dominance01 ?? 0);
  }

  public getDominanceByChannel(channelId: ChatChannelId): Score100 {
    const node = this.nodes.get(channelNodeId(channelId));
    return asScore100(node?.metrics.dominance01 ?? 0);
  }

  public listCounterpartsByDominance(): readonly Readonly<{ counterpartId: string; dominance01: Score100 }>[] {
    return [...this.nodes.values()]
      .filter((node) => node.kind === 'COUNTERPART' && typeof node.counterpartId === 'string')
      .sort((a, b) => b.metrics.dominance01 - a.metrics.dominance01)
      .map((node) => Object.freeze({
        counterpartId: node.counterpartId as string,
        dominance01: asScore100(node.metrics.dominance01),
      }));
  }


  public getEmbarrassmentRiskByCounterpart(counterpartId: string): Score100 {
    const node = this.nodes.get(counterpartNodeId(counterpartId));
    return asScore100(node?.metrics.embarrassmentRisk01 ?? 0);
  }

  public getEmbarrassmentRiskByChannel(channelId: ChatChannelId): Score100 {
    const node = this.nodes.get(channelNodeId(channelId));
    return asScore100(node?.metrics.embarrassmentRisk01 ?? 0);
  }

  public listCounterpartsByEmbarrassmentRisk(): readonly Readonly<{ counterpartId: string; embarrassmentRisk01: Score100 }>[] {
    return [...this.nodes.values()]
      .filter((node) => node.kind === 'COUNTERPART' && typeof node.counterpartId === 'string')
      .sort((a, b) => b.metrics.embarrassmentRisk01 - a.metrics.embarrassmentRisk01)
      .map((node) => Object.freeze({
        counterpartId: node.counterpartId as string,
        embarrassmentRisk01: asScore100(node.metrics.embarrassmentRisk01),
      }));
  }


  public getCallbackReadinessByCounterpart(counterpartId: string): Score100 {
    const node = this.nodes.get(counterpartNodeId(counterpartId));
    return asScore100(node?.metrics.callbackReadiness01 ?? 0);
  }

  public getCallbackReadinessByChannel(channelId: ChatChannelId): Score100 {
    const node = this.nodes.get(channelNodeId(channelId));
    return asScore100(node?.metrics.callbackReadiness01 ?? 0);
  }

  public listCounterpartsByCallbackReadiness(): readonly Readonly<{ counterpartId: string; callbackReadiness01: Score100 }>[] {
    return [...this.nodes.values()]
      .filter((node) => node.kind === 'COUNTERPART' && typeof node.counterpartId === 'string')
      .sort((a, b) => b.metrics.callbackReadiness01 - a.metrics.callbackReadiness01)
      .map((node) => Object.freeze({
        counterpartId: node.counterpartId as string,
        callbackReadiness01: asScore100(node.metrics.callbackReadiness01),
      }));
  }


  public getChannelResonanceByCounterpart(counterpartId: string): Score100 {
    const node = this.nodes.get(counterpartNodeId(counterpartId));
    return asScore100(node?.metrics.channelResonance01 ?? 0);
  }

  public getChannelResonanceByChannel(channelId: ChatChannelId): Score100 {
    const node = this.nodes.get(channelNodeId(channelId));
    return asScore100(node?.metrics.channelResonance01 ?? 0);
  }

  public listCounterpartsByChannelResonance(): readonly Readonly<{ counterpartId: string; channelResonance01: Score100 }>[] {
    return [...this.nodes.values()]
      .filter((node) => node.kind === 'COUNTERPART' && typeof node.counterpartId === 'string')
      .sort((a, b) => b.metrics.channelResonance01 - a.metrics.channelResonance01)
      .map((node) => Object.freeze({
        counterpartId: node.counterpartId as string,
        channelResonance01: asScore100(node.metrics.channelResonance01),
      }));
  }


  public getContinuityWeightByCounterpart(counterpartId: string): Score100 {
    const node = this.nodes.get(counterpartNodeId(counterpartId));
    return asScore100(node?.metrics.continuityWeight01 ?? 0);
  }

  public getContinuityWeightByChannel(channelId: ChatChannelId): Score100 {
    const node = this.nodes.get(channelNodeId(channelId));
    return asScore100(node?.metrics.continuityWeight01 ?? 0);
  }

  public listCounterpartsByContinuityWeight(): readonly Readonly<{ counterpartId: string; continuityWeight01: Score100 }>[] {
    return [...this.nodes.values()]
      .filter((node) => node.kind === 'COUNTERPART' && typeof node.counterpartId === 'string')
      .sort((a, b) => b.metrics.continuityWeight01 - a.metrics.continuityWeight01)
      .map((node) => Object.freeze({
        counterpartId: node.counterpartId as string,
        continuityWeight01: asScore100(node.metrics.continuityWeight01),
      }));
  }


  public getWitnessHeatByCounterpart(counterpartId: string): Score100 {
    const node = this.nodes.get(counterpartNodeId(counterpartId));
    return asScore100(node?.metrics.witnessHeat01 ?? 0);
  }

  public getWitnessHeatByChannel(channelId: ChatChannelId): Score100 {
    const node = this.nodes.get(channelNodeId(channelId));
    return asScore100(node?.metrics.witnessHeat01 ?? 0);
  }

  public listCounterpartsByWitnessHeat(): readonly Readonly<{ counterpartId: string; witnessHeat01: Score100 }>[] {
    return [...this.nodes.values()]
      .filter((node) => node.kind === 'COUNTERPART' && typeof node.counterpartId === 'string')
      .sort((a, b) => b.metrics.witnessHeat01 - a.metrics.witnessHeat01)
      .map((node) => Object.freeze({
        counterpartId: node.counterpartId as string,
        witnessHeat01: asScore100(node.metrics.witnessHeat01),
      }));
  }


  public projectPrimaryCounterpartForGLOBAL(): TrustGraphHotCounterpart | undefined {
    const snapshot = this.lastSnapshot;
    if (!snapshot) return undefined;
    const profile = snapshot.channelProfiles['GLOBAL'];

    return [...snapshot.hotCounterparts]
      .sort((a, b) => {
        const scoreA = a.rivalry01 * profile.rivalBias01 * 0.35 + a.rescue01 * profile.rescueBias01 * 0.25 + a.trust01 * profile.trustBias01 * 0.20 + a.callbackReadiness01 * profile.resonance01 * 0.20;
        const scoreB = b.rivalry01 * profile.rivalBias01 * 0.35 + b.rescue01 * profile.rescueBias01 * 0.25 + b.trust01 * profile.trustBias01 * 0.20 + b.callbackReadiness01 * profile.resonance01 * 0.20;
        return scoreB - scoreA;
      })[0];
  }


  public projectPrimaryCounterpartForSYNDICATE(): TrustGraphHotCounterpart | undefined {
    const snapshot = this.lastSnapshot;
    if (!snapshot) return undefined;
    const profile = snapshot.channelProfiles['SYNDICATE'];

    return [...snapshot.hotCounterparts]
      .sort((a, b) => {
        const scoreA = a.rivalry01 * profile.rivalBias01 * 0.35 + a.rescue01 * profile.rescueBias01 * 0.25 + a.trust01 * profile.trustBias01 * 0.20 + a.callbackReadiness01 * profile.resonance01 * 0.20;
        const scoreB = b.rivalry01 * profile.rivalBias01 * 0.35 + b.rescue01 * profile.rescueBias01 * 0.25 + b.trust01 * profile.trustBias01 * 0.20 + b.callbackReadiness01 * profile.resonance01 * 0.20;
        return scoreB - scoreA;
      })[0];
  }


  public projectPrimaryCounterpartForDEAL_ROOM(): TrustGraphHotCounterpart | undefined {
    const snapshot = this.lastSnapshot;
    if (!snapshot) return undefined;
    const profile = snapshot.channelProfiles['DEAL_ROOM'];

    return [...snapshot.hotCounterparts]
      .sort((a, b) => {
        const scoreA = a.rivalry01 * profile.rivalBias01 * 0.35 + a.rescue01 * profile.rescueBias01 * 0.25 + a.trust01 * profile.trustBias01 * 0.20 + a.callbackReadiness01 * profile.resonance01 * 0.20;
        const scoreB = b.rivalry01 * profile.rivalBias01 * 0.35 + b.rescue01 * profile.rescueBias01 * 0.25 + b.trust01 * profile.trustBias01 * 0.20 + b.callbackReadiness01 * profile.resonance01 * 0.20;
        return scoreB - scoreA;
      })[0];
  }


  public projectPrimaryCounterpartForLOBBY(): TrustGraphHotCounterpart | undefined {
    const snapshot = this.lastSnapshot;
    if (!snapshot) return undefined;
    const profile = snapshot.channelProfiles['LOBBY'];

    return [...snapshot.hotCounterparts]
      .sort((a, b) => {
        const scoreA = a.rivalry01 * profile.rivalBias01 * 0.35 + a.rescue01 * profile.rescueBias01 * 0.25 + a.trust01 * profile.trustBias01 * 0.20 + a.callbackReadiness01 * profile.resonance01 * 0.20;
        const scoreB = b.rivalry01 * profile.rivalBias01 * 0.35 + b.rescue01 * profile.rescueBias01 * 0.25 + b.trust01 * profile.trustBias01 * 0.20 + b.callbackReadiness01 * profile.resonance01 * 0.20;
        return scoreB - scoreA;
      })[0];
  }


  public projectCarryoverForBattleHud(): TrustGraphCarryoverSeed | undefined {
    return this.lastSnapshot?.carryoverByMount['BATTLE_HUD'];
  }


  public projectCarryoverForClubUi(): TrustGraphCarryoverSeed | undefined {
    return this.lastSnapshot?.carryoverByMount['CLUB_UI'];
  }


  public projectCarryoverForEmpireGameScreen(): TrustGraphCarryoverSeed | undefined {
    return this.lastSnapshot?.carryoverByMount['EMPIRE_GAME_SCREEN'];
  }


  public projectCarryoverForGameBoard(): TrustGraphCarryoverSeed | undefined {
    return this.lastSnapshot?.carryoverByMount['GAME_BOARD'];
  }


  public projectCarryoverForLeagueUi(): TrustGraphCarryoverSeed | undefined {
    return this.lastSnapshot?.carryoverByMount['LEAGUE_UI'];
  }


  public projectCarryoverForLobbyScreen(): TrustGraphCarryoverSeed | undefined {
    return this.lastSnapshot?.carryoverByMount['LOBBY_SCREEN'];
  }


  public projectCarryoverForPhantomGameScreen(): TrustGraphCarryoverSeed | undefined {
    return this.lastSnapshot?.carryoverByMount['PHANTOM_GAME_SCREEN'];
  }


  public projectCarryoverForPredatorGameScreen(): TrustGraphCarryoverSeed | undefined {
    return this.lastSnapshot?.carryoverByMount['PREDATOR_GAME_SCREEN'];
  }


  public projectCarryoverForSyndicateGameScreen(): TrustGraphCarryoverSeed | undefined {
    return this.lastSnapshot?.carryoverByMount['SYNDICATE_GAME_SCREEN'];
  }


  public projectCarryoverForPostRunSummary(): TrustGraphCarryoverSeed | undefined {
    return this.lastSnapshot?.carryoverByMount['POST_RUN_SUMMARY'];
  }


  public exportDebugReport(): Readonly<{ snapshot?: TrustGraphSnapshot; recommendations?: TrustGraphRecommendations; nodes: readonly TrustGraphNode[]; edges: readonly TrustGraphEdge[]; }> {
    return Object.freeze({
      snapshot: this.lastSnapshot,
      recommendations: this.lastRecommendations,
      nodes: this.listNodes(),
      edges: this.listEdges(),
    });
  }
}

export function buildTrustGraphSnapshot(state: ChatEngineState, config: Partial<TrustGraphConfig> = {}): TrustGraphSnapshot {
  return TrustGraph.fromEngineState(state, config).getSnapshot() as TrustGraphSnapshot;
}

export function buildTrustGraphRecommendations(state: ChatEngineState, config: Partial<TrustGraphConfig> = {}): TrustGraphRecommendations {
  return TrustGraph.fromEngineState(state, config).getRecommendations() as TrustGraphRecommendations;
}

export function relationshipStateToScoreCard(
  relationship: ChatRelationshipState,
): Readonly<{ readonly counterpartId: string; readonly trust: Score100; readonly rivalry: Score100; readonly rescue: Score100; readonly continuity: Score100; readonly callbackReadiness: Score100; }> {
  return Object.freeze({
    counterpartId: relationship.counterpartId,
    trust: asScore100(relationshipTrust01(relationship.vector)),
    rivalry: asScore100(relationshipRivalry01(relationship.vector)),
    rescue: asScore100(relationshipRescue01(relationship.vector)),
    continuity: asScore100(relationshipDominance01(relationship)),
    callbackReadiness: asScore100(callbackReadiness01(relationship)),
  });
}

export function projectCounterpartDisposition(relationship: ChatRelationshipState): TrustGraphDisposition {
  return dispositionForHotCounterpart({
    counterpartId: relationship.counterpartId,
    trust01: relationshipTrust01(relationship.vector),
    rivalry01: relationshipRivalry01(relationship.vector),
    rescue01: relationshipRescue01(relationship.vector),
    callbackReadiness01: callbackReadiness01(relationship),
    continuityWeight01: relationshipDominance01(relationship),
    recommendedDisposition: 'CEREMONIAL_WITNESS',
    reasons: [],
  });
}
