/**
 * Durable relationship evolution persistence and NPC signal projection.
 */
import type {
  ChatRelationshipAxisId,
  ChatRelationshipCounterpartKind,
  ChatRelationshipCounterpartState,
  ChatRelationshipEventDescriptor,
  ChatRelationshipLegacyProjection,
  ChatRelationshipNpcSignal,
  ChatRelationshipObjective,
  ChatRelationshipSnapshot,
  ChatRelationshipStance,
  ChatRelationshipSummaryView,
  ChatRelationshipVector,
} from '../../../../../shared/contracts/chat/relationship';
import { clamp01, emptyRelationshipVector, weightedBlend } from '../../../../../shared/contracts/chat/relationship';

export interface ChatRelationshipServiceConfig {
  readonly maxEventTail: number;
}

export const DEFAULT_CHAT_RELATIONSHIP_SERVICE_CONFIG: ChatRelationshipServiceConfig = Object.freeze({
  maxEventTail: 64,
});

interface PlayerRelationshipBucket {
  playerId: string;
  updatedAt: number;
  focusedCounterpartByChannel: Record<string, string | undefined>;
  counterparts: Map<string, ChatRelationshipCounterpartState>;
  totalEventCount: number;
}

function now(): number { return Date.now(); }
function dominantAxes(vector: ChatRelationshipVector): readonly ChatRelationshipAxisId[] {
  return [
    ['CONTEMPT', vector.contempt01],
    ['FASCINATION', vector.fascination01],
    ['RESPECT', vector.respect01],
    ['FEAR', vector.fear01],
    ['OBSESSION', vector.obsession01],
    ['PATIENCE', vector.patience01],
    ['FAMILIARITY', vector.familiarity01],
    ['PREDICTIVE_CONFIDENCE', vector.predictiveConfidence01],
    ['TRAUMA_DEBT', vector.traumaDebt01],
    ['UNFINISHED_BUSINESS', vector.unfinishedBusiness01],
  ]
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 3)
    .map(([axis]) => axis as ChatRelationshipAxisId);
}

function inferStance(vector: ChatRelationshipVector): ChatRelationshipStance {
  if (vector.obsession01 > 0.72) return 'OBSESSED';
  if (vector.contempt01 > 0.68 && vector.predictiveConfidence01 > 0.55) return 'HUNTING';
  if (vector.contempt01 > 0.58) return 'PREDATORY';
  if (vector.respect01 > 0.65 && vector.familiarity01 > 0.48) return 'RESPECTFUL';
  if (vector.familiarity01 > 0.68 && vector.respect01 > 0.52) return 'PROTECTIVE';
  if (vector.fascination01 > 0.58) return 'PROBING';
  if (vector.fear01 > 0.58) return 'WOUNDED';
  if (vector.familiarity01 > 0.45) return 'CURIOUS';
  return 'CLINICAL';
}

function inferObjective(vector: ChatRelationshipVector): ChatRelationshipObjective {
  if (vector.familiarity01 > 0.62 && vector.respect01 > 0.40) return 'RESCUE';
  if (vector.contempt01 > 0.65) return 'HUMILIATE';
  if (vector.predictiveConfidence01 > 0.60) return 'STUDY';
  if (vector.fear01 > 0.55) return 'CONTAIN';
  if (vector.fascination01 > 0.56) return 'TEST';
  return 'PRESSURE';
}

function intensity(vector: ChatRelationshipVector): number {
  return clamp01(
    vector.contempt01 * 0.22 +
    vector.respect01 * 0.16 +
    vector.fear01 * 0.12 +
    vector.fascination01 * 0.14 +
    vector.obsession01 * 0.18 +
    vector.unfinishedBusiness01 * 0.18,
  );
}

function legacyProjection(counterpartId: string, vector: ChatRelationshipVector): ChatRelationshipLegacyProjection {
  return {
    counterpartId,
    respect: Math.round(vector.respect01 * 100),
    fear: Math.round(vector.fear01 * 100),
    contempt: Math.round(vector.contempt01 * 100),
    fascination: Math.round(vector.fascination01 * 100),
    trust: Math.round((vector.familiarity01 * 0.55 + vector.patience01 * 0.45) * 100),
    familiarity: Math.round(vector.familiarity01 * 100),
    rivalryIntensity: Math.round((vector.contempt01 * 0.55 + vector.unfinishedBusiness01 * 0.45) * 100),
    rescueDebt: Math.round(vector.traumaDebt01 * 100),
    adviceObedience: Math.round((vector.respect01 * 0.65 + vector.familiarity01 * 0.35) * 100),
    escalationTier:
      intensity(vector) > 0.82 ? 'OBSESSIVE' :
      intensity(vector) > 0.62 ? 'ACTIVE' :
      intensity(vector) > 0.34 ? 'MILD' : 'NONE',
  };
}

function applyDelta(current: ChatRelationshipVector, event: ChatRelationshipEventDescriptor): ChatRelationshipVector {
  let next = { ...current };
  const add = (key: keyof ChatRelationshipVector, delta: number, weight = 0.55) => {
    next[key] = clamp01(weightedBlend(next[key], clamp01(next[key] + delta), weight));
  };

  switch (event.eventType) {
    case 'PLAYER_DISCIPLINE': add('respect01', 0.18); add('predictiveConfidence01', 0.10); break;
    case 'PLAYER_GREED': add('contempt01', 0.15); add('predictiveConfidence01', 0.08); break;
    case 'PLAYER_BLUFF': add('fascination01', 0.12); add('predictiveConfidence01', 0.12); break;
    case 'PLAYER_OVERCONFIDENCE': add('contempt01', 0.16); add('unfinishedBusiness01', 0.08); break;
    case 'PLAYER_COMEBACK': add('respect01', 0.18); add('fascination01', 0.14); break;
    case 'PLAYER_COLLAPSE': add('contempt01', 0.12); add('fear01', 0.05); break;
    case 'PLAYER_BREACH': add('fear01', 0.12); add('unfinishedBusiness01', 0.10); break;
    case 'PLAYER_PERFECT_DEFENSE': add('respect01', 0.20); add('fascination01', 0.10); break;
    case 'HELPER_RESCUE_EMITTED': add('familiarity01', 0.18); add('traumaDebt01', 0.12); break;
    case 'BOT_TAUNT_EMITTED': add('contempt01', 0.06); add('familiarity01', 0.03); break;
    case 'BOT_RETREAT_EMITTED': add('respect01', 0.05); add('familiarity01', 0.04); break;
    case 'PUBLIC_WITNESS': add('unfinishedBusiness01', 0.12); add('fascination01', 0.06); break;
    case 'PRIVATE_WITNESS': add('familiarity01', 0.12); add('patience01', 0.05); break;
    default: add('familiarity01', 0.02, 0.35); break;
  }

  if (event.pressureBand === 'HIGH' || event.pressureBand === 'CRITICAL') {
    add('obsession01', 0.04, 0.40);
    add('patience01', -0.02, 0.40);
  } else {
    add('patience01', 0.03, 0.35);
  }

  return next;
}

export class ChatRelationshipService {
  private readonly config: ChatRelationshipServiceConfig;
  private readonly players = new Map<string, PlayerRelationshipBucket>();

  public constructor(config: Partial<ChatRelationshipServiceConfig> = {}) {
    this.config = Object.freeze({ ...DEFAULT_CHAT_RELATIONSHIP_SERVICE_CONFIG, ...config });
  }

  private ensure(playerId: string): PlayerRelationshipBucket {
    const bucket = this.players.get(playerId);
    if (bucket) return bucket;
    const next: PlayerRelationshipBucket = {
      playerId,
      updatedAt: now(),
      focusedCounterpartByChannel: {},
      counterparts: new Map(),
      totalEventCount: 0,
    };
    this.players.set(playerId, next);
    return next;
  }

  public applyEvent(event: ChatRelationshipEventDescriptor): ChatRelationshipCounterpartState {
    const playerId = event.playerId ?? 'GLOBAL';
    const bucket = this.ensure(playerId);
    const current = bucket.counterparts.get(event.counterpartId) ?? {
      counterpartId: event.counterpartId,
      counterpartKind: event.counterpartKind,
      playerId,
      botId: event.botId ?? null,
      actorRole: event.actorRole ?? null,
      lastChannelId: event.channelId ?? null,
      vector: emptyRelationshipVector(),
      stance: 'CLINICAL' as ChatRelationshipStance,
      objective: 'PRESSURE' as ChatRelationshipObjective,
      intensity01: 0,
      volatility01: 0.2,
      publicPressureBias01: 0.5,
      privatePressureBias01: 0.5,
      callbackHints: [],
      eventHistoryTail: [],
      dominantAxes: [],
      lastTouchedAt: event.createdAt,
    };

    const vector = applyDelta(current.vector, event);
    const next: ChatRelationshipCounterpartState = {
      ...current,
      botId: event.botId ?? current.botId ?? null,
      actorRole: event.actorRole ?? current.actorRole ?? null,
      lastChannelId: event.channelId ?? current.lastChannelId ?? null,
      vector,
      stance: inferStance(vector),
      objective: inferObjective(vector),
      intensity01: intensity(vector),
      volatility01: clamp01(current.volatility01 * 0.65 + Math.abs(intensity(vector) - current.intensity01) * 0.35),
      publicPressureBias01: clamp01(vector.contempt01 * 0.45 + vector.obsession01 * 0.25 + vector.unfinishedBusiness01 * 0.20),
      privatePressureBias01: clamp01(vector.familiarity01 * 0.40 + vector.patience01 * 0.20 + vector.fascination01 * 0.20),
      callbackHints: [
        { callbackId: `${event.counterpartId}:latest`, label: event.eventType, text: event.summary ?? event.rawText ?? event.eventType, weight01: clamp01(intensity(vector)) },
        ...current.callbackHints,
      ].slice(0, 12),
      eventHistoryTail: [event, ...current.eventHistoryTail].slice(0, this.config.maxEventTail),
      dominantAxes: dominantAxes(vector),
      lastTouchedAt: event.createdAt,
    };

    bucket.counterparts.set(event.counterpartId, next);
    if (event.channelId) bucket.focusedCounterpartByChannel[event.channelId] = event.counterpartId;
    bucket.updatedAt = event.createdAt;
    bucket.totalEventCount += 1;
    return next;
  }

  public projectNpcSignal(playerId: string, counterpartId: string): ChatRelationshipNpcSignal | undefined {
    const bucket = this.ensure(playerId);
    const state = bucket.counterparts.get(counterpartId);
    if (!state) return undefined;
    return {
      counterpartId,
      stance: state.stance,
      objective: state.objective,
      intensity01: state.intensity01,
      volatility01: state.volatility01,
      selectionWeight01: clamp01(state.intensity01 * 0.55 + state.vector.fascination01 * 0.20 + state.vector.unfinishedBusiness01 * 0.25),
      publicPressureBias01: state.publicPressureBias01,
      privatePressureBias01: state.privatePressureBias01,
      predictiveConfidence01: state.vector.predictiveConfidence01,
      obsession01: state.vector.obsession01,
      unfinishedBusiness01: state.vector.unfinishedBusiness01,
      respect01: state.vector.respect01,
      fear01: state.vector.fear01,
      contempt01: state.vector.contempt01,
      familiarity01: state.vector.familiarity01,
      callbackHint: state.callbackHints[0],
      notes: state.dominantAxes,
    };
  }

  public summarize(playerId: string): readonly ChatRelationshipSummaryView[] {
    const bucket = this.ensure(playerId);
    return [...bucket.counterparts.values()].map((state) => ({
      counterpartId: state.counterpartId,
      stance: state.stance,
      objective: state.objective,
      intensity01: state.intensity01,
      volatility01: state.volatility01,
      obsession01: state.vector.obsession01,
      predictiveConfidence01: state.vector.predictiveConfidence01,
      unfinishedBusiness01: state.vector.unfinishedBusiness01,
      respect01: state.vector.respect01,
      fear01: state.vector.fear01,
      contempt01: state.vector.contempt01,
      familiarity01: state.vector.familiarity01,
      callbackCount: state.callbackHints.length,
      legacy: legacyProjection(state.counterpartId, state.vector),
    })).sort((a, b) => b.intensity01 - a.intensity01 || a.counterpartId.localeCompare(b.counterpartId));
  }

  public getSnapshot(playerId: string): ChatRelationshipSnapshot {
    const bucket = this.ensure(playerId);
    return {
      createdAt: now(),
      updatedAt: bucket.updatedAt,
      playerId,
      counterparts: [...bucket.counterparts.values()].sort((a, b) => b.lastTouchedAt - a.lastTouchedAt),
      totalEventCount: bucket.totalEventCount,
      focusedCounterpartByChannel: bucket.focusedCounterpartByChannel,
    };
  }

  public getLegacyProjection(playerId: string, counterpartId: string): ChatRelationshipLegacyProjection | undefined {
    const bucket = this.ensure(playerId);
    const state = bucket.counterparts.get(counterpartId);
    return state ? legacyProjection(counterpartId, state.vector) : undefined;
  }
}
