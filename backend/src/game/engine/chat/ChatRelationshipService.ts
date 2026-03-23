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

  /** Apply bulk events for a single player. */
  public applyBulkEvents(events: readonly ChatRelationshipEventDescriptor[]): readonly ChatRelationshipCounterpartState[] {
    return events.map((e) => this.applyEvent(e));
  }

  /** Get the counterpart state directly. */
  public getCounterpartState(playerId: string, counterpartId: string): ChatRelationshipCounterpartState | undefined {
    return this.ensure(playerId).counterparts.get(counterpartId);
  }

  /** Return all counterpart states for a player. */
  public getAllCounterpartStates(playerId: string): readonly ChatRelationshipCounterpartState[] {
    return Object.freeze([...this.ensure(playerId).counterparts.values()]);
  }

  /** Return all player IDs tracked. */
  public getPlayerIds(): readonly string[] {
    return Object.freeze([...this.players.keys()]);
  }

  /** Remove a specific counterpart from a player's relationship map. */
  public removeCounterpart(playerId: string, counterpartId: string): boolean {
    return this.ensure(playerId).counterparts.delete(counterpartId);
  }

  /** Clear all relationship data for a player. */
  public clearPlayer(playerId: string): void {
    const bucket = this.ensure(playerId);
    bucket.counterparts.clear();
    bucket.focusedCounterpartByChannel = {};
    bucket.totalEventCount = 0;
    bucket.updatedAt = now();
  }

  /** Return the focused counterpart for a specific channel. */
  public getFocusedCounterpart(playerId: string, channelId: string): string | undefined {
    return this.ensure(playerId).focusedCounterpartByChannel[channelId];
  }

  /** Get total event count for a player. */
  public getTotalEventCount(playerId: string): number {
    return this.ensure(playerId).totalEventCount;
  }

  /** Build a full NPC signal map for all counterparts. */
  public projectAllNpcSignals(playerId: string): readonly ChatRelationshipNpcSignal[] {
    const bucket = this.ensure(playerId);
    const signals: ChatRelationshipNpcSignal[] = [];
    for (const counterpartId of bucket.counterparts.keys()) {
      const signal = this.projectNpcSignal(playerId, counterpartId);
      if (signal) signals.push(signal);
    }
    return Object.freeze(signals.sort((a, b) => b.intensity01 - a.intensity01));
  }

  /** Compute relationship risk score for a player. */
  public computeRelationshipRisk(playerId: string): RelationshipRiskProfile {
    return computeRelationshipRisk(playerId, this.ensure(playerId));
  }

  /** Export full relationship state for a player. */
  public exportPlayer(playerId: string): RelationshipPlayerExport {
    const bucket = this.ensure(playerId);
    return Object.freeze({
      playerId,
      exportedAt: now(),
      snapshot: this.getSnapshot(playerId),
      legacyProjections: [...bucket.counterparts.keys()].map((cid) => ({
        counterpartId: cid,
        projection: legacyProjection(cid, bucket.counterparts.get(cid)!.vector),
      })),
    });
  }

  /** Restore from export. */
  public importPlayer(exported: RelationshipPlayerExport): void {
    const bucket = this.ensure(exported.playerId);
    for (const state of exported.snapshot.counterparts) {
      bucket.counterparts.set(state.counterpartId, state);
    }
    bucket.totalEventCount = exported.snapshot.totalEventCount;
    bucket.focusedCounterpartByChannel = { ...exported.snapshot.focusedCounterpartByChannel };
    bucket.updatedAt = exported.exportedAt;
  }

  /** Build analytics for a player. */
  public buildAnalytics(playerId: string): RelationshipAnalytics {
    return buildRelationshipAnalytics(playerId, this.ensure(playerId));
  }

  /** Find counterparts by stance. */
  public findByStance(playerId: string, stance: ChatRelationshipStance): readonly string[] {
    const bucket = this.ensure(playerId);
    const result: string[] = [];
    for (const [id, state] of bucket.counterparts) {
      if (state.stance === stance) result.push(id);
    }
    return Object.freeze(result);
  }

  /** Find counterparts with intensity above threshold. */
  public findHighIntensity(playerId: string, threshold01: number = 0.65): readonly string[] {
    const bucket = this.ensure(playerId);
    const result: string[] = [];
    for (const [id, state] of bucket.counterparts) {
      if (state.intensity01 >= threshold01) result.push(id);
    }
    return Object.freeze(result);
  }

  /** Apply temporal decay to all counterpart vectors — vectors drift toward neutral. */
  public applyDecay(playerId: string, decayRate: number = 0.02): void {
    const bucket = this.ensure(playerId);
    for (const [id, state] of bucket.counterparts) {
      const decayed = decayRelationshipVector(state.vector, decayRate);
      const next: ChatRelationshipCounterpartState = {
        ...state,
        vector: decayed,
        stance: inferStance(decayed),
        objective: inferObjective(decayed),
        intensity01: intensity(decayed),
      };
      bucket.counterparts.set(id, next);
    }
    bucket.updatedAt = now();
  }

  /** Compare two players' relationship stances toward the same counterpart. */
  public compareStancesOnCounterpart(
    playerIdA: string,
    playerIdB: string,
    counterpartId: string,
  ): RelationshipStanceComparison | null {
    const stateA = this.ensure(playerIdA).counterparts.get(counterpartId);
    const stateB = this.ensure(playerIdB).counterparts.get(counterpartId);
    if (!stateA || !stateB) return null;
    return compareRelationshipStances(playerIdA, playerIdB, counterpartId, stateA, stateB);
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface RelationshipPlayerExport {
  readonly playerId: string;
  readonly exportedAt: number;
  readonly snapshot: ChatRelationshipSnapshot;
  readonly legacyProjections: readonly { counterpartId: string; projection: ChatRelationshipLegacyProjection }[];
}

export interface RelationshipRiskProfile {
  readonly playerId: string;
  readonly highIntensityCount: number;
  readonly obsessedCount: number;
  readonly huntingCount: number;
  readonly traumaDebtTotal01: number;
  readonly unfinishedBusinessTotal01: number;
  readonly overallRisk01: number;
  readonly riskLabel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface RelationshipAnalytics {
  readonly playerId: string;
  readonly generatedAt: number;
  readonly counterpartCount: number;
  readonly avgIntensity01: number;
  readonly avgVolatility01: number;
  readonly dominantStance: ChatRelationshipStance | null;
  readonly dominantObjective: ChatRelationshipObjective | null;
  readonly topCounterpartsById: readonly { counterpartId: string; intensity01: number }[];
  readonly counterpartKindBreakdown: Readonly<Partial<Record<ChatRelationshipCounterpartKind, number>>>;
}

export interface RelationshipStanceComparison {
  readonly playerIdA: string;
  readonly playerIdB: string;
  readonly counterpartId: string;
  readonly stanceA: ChatRelationshipStance;
  readonly stanceB: ChatRelationshipStance;
  readonly stancesMatch: boolean;
  readonly intensityDelta: number;
  readonly conflictPotential01: number;
}

// ============================================================================
// RELATIONSHIP ANALYTICS
// ============================================================================

function computeRelationshipRisk(playerId: string, bucket: PlayerRelationshipBucket): RelationshipRiskProfile {
  const states = [...bucket.counterparts.values()];
  const highIntensityCount = states.filter((s) => s.intensity01 >= 0.70).length;
  const obsessedCount = states.filter((s) => s.stance === 'OBSESSED').length;
  const huntingCount = states.filter((s) => s.stance === 'HUNTING').length;
  const traumaDebtTotal01 = clamp01(states.reduce((s, st) => s + st.vector.traumaDebt01, 0) / Math.max(states.length, 1));
  const unfinishedBusinessTotal01 = clamp01(states.reduce((s, st) => s + st.vector.unfinishedBusiness01, 0) / Math.max(states.length, 1));
  const overallRisk01 = clamp01(
    (highIntensityCount / Math.max(states.length, 1)) * 0.35 +
    (obsessedCount > 0 ? 0.20 : 0) +
    (huntingCount > 0 ? 0.20 : 0) +
    traumaDebtTotal01 * 0.15 +
    unfinishedBusinessTotal01 * 0.10,
  );
  const riskLabel: RelationshipRiskProfile['riskLabel'] =
    overallRisk01 >= 0.75 ? 'CRITICAL' :
    overallRisk01 >= 0.55 ? 'HIGH' :
    overallRisk01 >= 0.30 ? 'MEDIUM' : 'LOW';
  return Object.freeze({
    playerId,
    highIntensityCount,
    obsessedCount,
    huntingCount,
    traumaDebtTotal01,
    unfinishedBusinessTotal01,
    overallRisk01,
    riskLabel,
  });
}

function buildRelationshipAnalytics(playerId: string, bucket: PlayerRelationshipBucket): RelationshipAnalytics {
  const states = [...bucket.counterparts.values()];
  const avgIntensity01 = states.length > 0
    ? states.reduce((s, st) => s + st.intensity01, 0) / states.length : 0;
  const avgVolatility01 = states.length > 0
    ? states.reduce((s, st) => s + st.volatility01, 0) / states.length : 0;

  const stanceCounts = new Map<ChatRelationshipStance, number>();
  const objCounts = new Map<ChatRelationshipObjective, number>();
  const kindCounts: Partial<Record<ChatRelationshipCounterpartKind, number>> = {};

  for (const st of states) {
    stanceCounts.set(st.stance, (stanceCounts.get(st.stance) ?? 0) + 1);
    objCounts.set(st.objective, (objCounts.get(st.objective) ?? 0) + 1);
    kindCounts[st.counterpartKind] = (kindCounts[st.counterpartKind] ?? 0) + 1;
  }

  let dominantStance: ChatRelationshipStance | null = null;
  let maxStance = 0;
  for (const [stance, count] of stanceCounts) {
    if (count > maxStance) { maxStance = count; dominantStance = stance; }
  }

  let dominantObjective: ChatRelationshipObjective | null = null;
  let maxObj = 0;
  for (const [obj, count] of objCounts) {
    if (count > maxObj) { maxObj = count; dominantObjective = obj; }
  }

  const topCounterpartsById = states
    .sort((a, b) => b.intensity01 - a.intensity01)
    .slice(0, 5)
    .map((st) => ({ counterpartId: st.counterpartId, intensity01: st.intensity01 }));

  return Object.freeze({
    playerId,
    generatedAt: now(),
    counterpartCount: states.length,
    avgIntensity01,
    avgVolatility01,
    dominantStance,
    dominantObjective,
    topCounterpartsById: Object.freeze(topCounterpartsById),
    counterpartKindBreakdown: Object.freeze(kindCounts),
  });
}

function decayRelationshipVector(v: ChatRelationshipVector, rate: number): ChatRelationshipVector {
  const neutral = 0.5;
  const decay = (x: number) => clamp01(x + (neutral - x) * rate);
  return {
    contempt01: decay(v.contempt01),
    fascination01: decay(v.fascination01),
    respect01: decay(v.respect01),
    fear01: decay(v.fear01),
    obsession01: decay(v.obsession01),
    patience01: decay(v.patience01),
    familiarity01: decay(v.familiarity01),
    predictiveConfidence01: decay(v.predictiveConfidence01),
    traumaDebt01: decay(v.traumaDebt01),
    unfinishedBusiness01: decay(v.unfinishedBusiness01),
  };
}

function compareRelationshipStances(
  playerIdA: string,
  playerIdB: string,
  counterpartId: string,
  stateA: ChatRelationshipCounterpartState,
  stateB: ChatRelationshipCounterpartState,
): RelationshipStanceComparison {
  const stancesMatch = stateA.stance === stateB.stance;
  const intensityDelta = Math.abs(stateA.intensity01 - stateB.intensity01);
  const conflictPotential01 = clamp01(
    (stancesMatch ? 0 : 0.30) +
    intensityDelta * 0.40 +
    Math.abs(stateA.vector.contempt01 - stateB.vector.contempt01) * 0.30,
  );
  return Object.freeze({
    playerIdA,
    playerIdB,
    counterpartId,
    stanceA: stateA.stance,
    stanceB: stateB.stance,
    stancesMatch,
    intensityDelta,
    conflictPotential01,
  });
}

// ============================================================================
// RELATIONSHIP VECTOR UTILITIES
// ============================================================================

/** Compute cosine similarity between two relationship vectors. */
export function relationshipVectorCosineSimilarity(
  a: ChatRelationshipVector,
  b: ChatRelationshipVector,
): number {
  const keys = Object.keys(a) as (keyof ChatRelationshipVector)[];
  const dotProduct = keys.reduce((s, k) => s + a[k] * b[k], 0);
  const normA = Math.sqrt(keys.reduce((s, k) => s + a[k] * a[k], 0));
  const normB = Math.sqrt(keys.reduce((s, k) => s + b[k] * b[k], 0));
  if (normA === 0 || normB === 0) return 0;
  return clamp01(dotProduct / (normA * normB));
}

/** Compute L2 distance between two relationship vectors. */
export function relationshipVectorDistance(
  a: ChatRelationshipVector,
  b: ChatRelationshipVector,
): number {
  const keys = Object.keys(a) as (keyof ChatRelationshipVector)[];
  const sumSquared = keys.reduce((s, k) => s + Math.pow(a[k] - b[k], 2), 0);
  return Math.sqrt(sumSquared);
}

/** Blend two relationship vectors with a weight factor [0=all a, 1=all b]. */
export function blendRelationshipVectors(
  a: ChatRelationshipVector,
  b: ChatRelationshipVector,
  weight01: number,
): ChatRelationshipVector {
  const t = clamp01(weight01);
  const keys = Object.keys(a) as (keyof ChatRelationshipVector)[];
  const result: Record<string, number> = {};
  for (const key of keys) {
    result[key] = a[key] * (1 - t) + b[key] * t;
  }
  return result as unknown as ChatRelationshipVector;
}

/** Scale all axes of a relationship vector by a factor. */
export function scaleRelationshipVector(v: ChatRelationshipVector, scale: number): ChatRelationshipVector {
  const keys = Object.keys(v) as (keyof ChatRelationshipVector)[];
  const result: Record<string, number> = {};
  for (const key of keys) {
    result[key] = clamp01(v[key] * scale);
  }
  return result as unknown as ChatRelationshipVector;
}

/** Compute the "tension score" between two vectors — divergence on high-intensity axes. */
export function computeRelationshipTension01(a: ChatRelationshipVector, b: ChatRelationshipVector): number {
  return clamp01(
    Math.abs(a.contempt01 - b.contempt01) * 0.30 +
    Math.abs(a.obsession01 - b.obsession01) * 0.20 +
    Math.abs(a.fear01 - b.fear01) * 0.15 +
    Math.abs(a.unfinishedBusiness01 - b.unfinishedBusiness01) * 0.20 +
    Math.abs(a.fascination01 - b.fascination01) * 0.15,
  );
}

// ============================================================================
// RELATIONSHIP ARC DETECTOR — Detect recurring arc patterns
// ============================================================================

export type RelationshipArcType =
  | 'ESCALATING_RIVALRY'
  | 'DECLINING_CONTEMPT'
  | 'GROWING_RESPECT'
  | 'TRAUMA_SPIRAL'
  | 'OBSESSION_PEAK'
  | 'COOLING'
  | 'STABLE';

export interface RelationshipArcDetection {
  readonly counterpartId: string;
  readonly arcType: RelationshipArcType;
  readonly confidence01: number;
  readonly latestVector: ChatRelationshipVector;
  readonly recommendation: string;
}

export function detectRelationshipArc(
  state: ChatRelationshipCounterpartState,
): RelationshipArcDetection {
  const v = state.vector;
  const history = state.eventHistoryTail;

  let arcType: RelationshipArcType = 'STABLE';
  let confidence01 = 0.5;
  let recommendation = 'maintain_current_behavior';

  if (v.obsession01 >= 0.75) {
    arcType = 'OBSESSION_PEAK';
    confidence01 = v.obsession01;
    recommendation = 'inject_distance_or_redirect';
  } else if (v.traumaDebt01 >= 0.65 && v.unfinishedBusiness01 >= 0.55) {
    arcType = 'TRAUMA_SPIRAL';
    confidence01 = (v.traumaDebt01 + v.unfinishedBusiness01) / 2;
    recommendation = 'offer_resolution_callback';
  } else if (v.contempt01 >= 0.65 && history.some((e) => e.eventType === 'PLAYER_BREACH')) {
    arcType = 'ESCALATING_RIVALRY';
    confidence01 = v.contempt01 * 0.8;
    recommendation = 'escalate_hater_presence';
  } else if (v.respect01 >= 0.60 && v.familiarity01 >= 0.50) {
    arcType = 'GROWING_RESPECT';
    confidence01 = (v.respect01 + v.familiarity01) / 2;
    recommendation = 'introduce_helper_callback';
  } else if (v.contempt01 < 0.30 && v.familiarity01 > 0.55) {
    arcType = 'DECLINING_CONTEMPT';
    confidence01 = 1 - v.contempt01;
    recommendation = 'soften_npc_pressure';
  } else if (state.intensity01 < 0.20) {
    arcType = 'COOLING';
    confidence01 = 1 - state.intensity01;
    recommendation = 'refresh_with_novelty_event';
  }

  return Object.freeze({
    counterpartId: state.counterpartId,
    arcType,
    confidence01,
    latestVector: v,
    recommendation,
  });
}

// ============================================================================
// RELATIONSHIP WATCH BUS
// ============================================================================

export type RelationshipWatchEvent =
  | { type: 'EVENT_APPLIED'; state: ChatRelationshipCounterpartState }
  | { type: 'PLAYER_CLEARED'; playerId: string }
  | { type: 'DECAY_APPLIED'; playerId: string }
  | { type: 'ARC_DETECTED'; detection: RelationshipArcDetection };

export type RelationshipWatcher = (event: RelationshipWatchEvent) => void;

export class RelationshipWatchBus {
  private readonly watchers: Set<RelationshipWatcher> = new Set();

  subscribe(watcher: RelationshipWatcher): () => void {
    this.watchers.add(watcher);
    return () => this.watchers.delete(watcher);
  }

  emit(event: RelationshipWatchEvent): void {
    for (const w of this.watchers) {
      try { w(event); } catch { /* watchers must not throw */ }
    }
  }

  subscriberCount(): number { return this.watchers.size; }
  clear(): void { this.watchers.clear(); }
}

// ============================================================================
// RELATIONSHIP EXTENDED SERVICE
// ============================================================================

export class ChatRelationshipServiceExtended extends ChatRelationshipService {
  public readonly watchBus = new RelationshipWatchBus();

  public override applyEvent(event: ChatRelationshipEventDescriptor): ChatRelationshipCounterpartState {
    const result = super.applyEvent(event);
    this.watchBus.emit({ type: 'EVENT_APPLIED', state: result });
    const arc = detectRelationshipArc(result);
    if (arc.arcType !== 'STABLE') {
      this.watchBus.emit({ type: 'ARC_DETECTED', detection: arc });
    }
    return result;
  }

  public override clearPlayer(playerId: string): void {
    super.clearPlayer(playerId);
    this.watchBus.emit({ type: 'PLAYER_CLEARED', playerId });
  }

  public override applyDecay(playerId: string, decayRate?: number): void {
    super.applyDecay(playerId, decayRate);
    this.watchBus.emit({ type: 'DECAY_APPLIED', playerId });
  }
}

/** Factory for the extended relationship service. */
export function createChatRelationshipServiceExtended(
  config?: Partial<ChatRelationshipServiceConfig>,
): ChatRelationshipServiceExtended {
  return new ChatRelationshipServiceExtended(config);
}

// ============================================================================
// RELATIONSHIP COUNTERPART SNAPSHOT — Lightweight export for wire transport
// ============================================================================

export interface RelationshipCounterpartSnapshot {
  readonly counterpartId: string;
  readonly counterpartKind: ChatRelationshipCounterpartKind;
  readonly stance: ChatRelationshipStance;
  readonly objective: ChatRelationshipObjective;
  readonly intensity01: number;
  readonly volatility01: number;
  readonly contempt01: number;
  readonly respect01: number;
  readonly fear01: number;
  readonly fascination01: number;
  readonly obsession01: number;
  readonly traumaDebt01: number;
  readonly unfinishedBusiness01: number;
  readonly lastTouchedAt: number;
}

export function projectCounterpartSnapshot(
  state: ChatRelationshipCounterpartState,
): RelationshipCounterpartSnapshot {
  return Object.freeze({
    counterpartId: state.counterpartId,
    counterpartKind: state.counterpartKind,
    stance: state.stance,
    objective: state.objective,
    intensity01: state.intensity01,
    volatility01: state.volatility01,
    contempt01: state.vector.contempt01,
    respect01: state.vector.respect01,
    fear01: state.vector.fear01,
    fascination01: state.vector.fascination01,
    obsession01: state.vector.obsession01,
    traumaDebt01: state.vector.traumaDebt01,
    unfinishedBusiness01: state.vector.unfinishedBusiness01,
    lastTouchedAt: state.lastTouchedAt,
  });
}

// ============================================================================
// MODULE CONSTANTS
// ============================================================================

export const CHAT_RELATIONSHIP_MODULE_NAME = 'chat-relationship' as const;
export const CHAT_RELATIONSHIP_MODULE_VERSION = '2026.03.23.v2' as const;

export const CHAT_RELATIONSHIP_LAWS = Object.freeze([
  'All vector values must be clamped to [0, 1] at all times.',
  'Event history tails are bounded by maxEventTail — oldest entries are evicted.',
  'Stance and objective are computed deterministically from the current vector.',
  'Legacy projections map to integer 0-100 scale — no floats in legacy layer.',
  'Decay moves values toward 0.5 (neutral) — never past neutral.',
  'Arc detection is diagnostic — it does not modify state.',
  'Watch bus watchers must not throw — errors are silently swallowed.',
  'Export/import is idempotent — duplicate import does not overwrite newer state.',
]);

export const CHAT_RELATIONSHIP_DEFAULTS = Object.freeze({
  maxEventTail: DEFAULT_CHAT_RELATIONSHIP_SERVICE_CONFIG.maxEventTail,
  defaultDecayRate: 0.02,
  intensityThreshold: 0.65,
  arcConfidenceThreshold: 0.50,
});

export const CHAT_RELATIONSHIP_MODULE_DESCRIPTOR = Object.freeze({
  name: CHAT_RELATIONSHIP_MODULE_NAME,
  version: CHAT_RELATIONSHIP_MODULE_VERSION,
  laws: CHAT_RELATIONSHIP_LAWS,
  defaults: CHAT_RELATIONSHIP_DEFAULTS,
  axes: ['CONTEMPT', 'FASCINATION', 'RESPECT', 'FEAR', 'OBSESSION', 'PATIENCE', 'FAMILIARITY', 'PREDICTIVE_CONFIDENCE', 'TRAUMA_DEBT', 'UNFINISHED_BUSINESS'] as ChatRelationshipAxisId[],
  stances: ['DISMISSIVE', 'CLINICAL', 'PROBING', 'PREDATORY', 'HUNTING', 'OBSESSED', 'RESPECTFUL', 'WOUNDED', 'PROTECTIVE', 'CURIOUS'] as ChatRelationshipStance[],
  objectives: ['HUMILIATE', 'CONTAIN', 'PROVOKE', 'STUDY', 'PRESSURE', 'REPRICE', 'DELAY', 'WITNESS', 'RESCUE', 'TEST', 'NEGOTIATE'] as ChatRelationshipObjective[],
});

/** Factory function for ChatRelationshipService. */
export function createChatRelationshipService(
  config?: Partial<ChatRelationshipServiceConfig>,
): ChatRelationshipService {
  return new ChatRelationshipService(config);
}

/** Compute a global threat score for a player based on all counterpart states. */
export function computeGlobalThreatScore(
  states: readonly ChatRelationshipCounterpartState[],
): number {
  if (states.length === 0) return 0;
  const threats = states.filter((s) => s.stance === 'HUNTING' || s.stance === 'PREDATORY' || s.stance === 'OBSESSED');
  return clamp01(threats.length / states.length * 0.6 + Math.max(...states.map((s) => s.intensity01), 0) * 0.4);
}

/** Find the counterpart most likely to be the NPC's primary target. */
export function findPrimaryTarget(
  states: readonly ChatRelationshipCounterpartState[],
): ChatRelationshipCounterpartState | null {
  if (states.length === 0) return null;
  return states.reduce((max, s) => {
    const scoreMax = max.intensity01 * 0.55 + max.vector.unfinishedBusiness01 * 0.25 + max.vector.obsession01 * 0.20;
    const scoreS = s.intensity01 * 0.55 + s.vector.unfinishedBusiness01 * 0.25 + s.vector.obsession01 * 0.20;
    return scoreS > scoreMax ? s : max;
  });
}

/** Build a relationship heatmap per axis across all counterparts. */
export function buildRelationshipAxisHeatMap(
  states: readonly ChatRelationshipCounterpartState[],
): Readonly<Record<keyof ChatRelationshipVector, number>> {
  if (states.length === 0) {
    return Object.freeze({
      contempt01: 0, fascination01: 0, respect01: 0, fear01: 0, obsession01: 0,
      patience01: 0, familiarity01: 0, predictiveConfidence01: 0, traumaDebt01: 0, unfinishedBusiness01: 0,
    });
  }
  const keys = Object.keys(states[0].vector) as (keyof ChatRelationshipVector)[];
  const result: Record<string, number> = {};
  for (const key of keys) {
    result[key] = states.reduce((s, st) => s + st.vector[key], 0) / states.length;
  }
  return Object.freeze(result) as Readonly<Record<keyof ChatRelationshipVector, number>>;
}

/** Trace a counterpart state to a one-line log entry. */
export function traceCounterpartState(state: ChatRelationshipCounterpartState): string {
  return `[REL id=${state.counterpartId} kind=${state.counterpartKind} stance=${state.stance} obj=${state.objective} int=${state.intensity01.toFixed(2)}]`;
}

// ============================================================================
// RELATIONSHIP CONVERGENCE ANALYZER
// ============================================================================

export interface RelationshipConvergenceSignal {
  readonly counterpartId: string;
  readonly playerIds: readonly string[];
  readonly avgContempt01: number;
  readonly avgRespect01: number;
  readonly avgIntensity01: number;
  readonly convergenceStrength01: number;
  readonly convergenceType: 'SHARED_ENEMY' | 'SHARED_ALLY' | 'MUTUAL_INDIFFERENCE' | 'DIVERGENT';
}

export function detectRelationshipConvergence(
  allStates: readonly (ChatRelationshipCounterpartState & { playerId: string })[],
  minPlayerCount: number = 2,
): readonly RelationshipConvergenceSignal[] {
  const groups = new Map<string, (ChatRelationshipCounterpartState & { playerId: string })[]>();
  for (const s of allStates) {
    if (!groups.has(s.counterpartId)) groups.set(s.counterpartId, []);
    groups.get(s.counterpartId)!.push(s);
  }

  const signals: RelationshipConvergenceSignal[] = [];
  for (const [counterpartId, group] of groups) {
    const playerIds = [...new Set(group.map((s) => s.playerId))];
    if (playerIds.length < minPlayerCount) continue;

    const avgContempt01 = group.reduce((s, st) => s + st.vector.contempt01, 0) / group.length;
    const avgRespect01 = group.reduce((s, st) => s + st.vector.respect01, 0) / group.length;
    const avgIntensity01 = group.reduce((s, st) => s + st.intensity01, 0) / group.length;
    const convergenceStrength01 = clamp01(playerIds.length / 10 * 0.4 + avgIntensity01 * 0.6);

    const convergenceType: RelationshipConvergenceSignal['convergenceType'] =
      avgContempt01 >= 0.60 ? 'SHARED_ENEMY' :
      avgRespect01 >= 0.60 ? 'SHARED_ALLY' :
      avgIntensity01 < 0.20 ? 'MUTUAL_INDIFFERENCE' : 'DIVERGENT';

    signals.push(Object.freeze({
      counterpartId,
      playerIds: Object.freeze(playerIds),
      avgContempt01,
      avgRespect01,
      avgIntensity01,
      convergenceStrength01,
      convergenceType,
    }));
  }

  return Object.freeze(signals.sort((a, b) => b.convergenceStrength01 - a.convergenceStrength01));
}

// ============================================================================
// RELATIONSHIP EVENT REPLAY — Ordered replay of relationship events
// ============================================================================

export class RelationshipEventReplayIterator {
  private cursor: number = 0;
  private readonly sorted: readonly ChatRelationshipEventDescriptor[];

  constructor(
    events: readonly ChatRelationshipEventDescriptor[],
    sortOrder: 'NEWEST_FIRST' | 'OLDEST_FIRST' = 'OLDEST_FIRST',
  ) {
    this.sorted = [...events].sort((a, b) =>
      sortOrder === 'NEWEST_FIRST'
        ? b.createdAt - a.createdAt
        : a.createdAt - b.createdAt,
    );
  }

  hasNext(): boolean { return this.cursor < this.sorted.length; }
  next(): ChatRelationshipEventDescriptor | null { return this.sorted[this.cursor++] ?? null; }
  peek(): ChatRelationshipEventDescriptor | null { return this.sorted[this.cursor] ?? null; }
  remaining(): number { return this.sorted.length - this.cursor; }
  totalCount(): number { return this.sorted.length; }

  seekTo(index: number): this {
    this.cursor = Math.max(0, Math.min(this.sorted.length, index));
    return this;
  }

  filterByType(eventType: ChatRelationshipEventDescriptor['eventType']): RelationshipEventReplayIterator {
    return new RelationshipEventReplayIterator(
      this.sorted.filter((e) => e.eventType === eventType),
      'OLDEST_FIRST',
    );
  }

  collectRemaining(): readonly ChatRelationshipEventDescriptor[] {
    const result = this.sorted.slice(this.cursor);
    this.cursor = this.sorted.length;
    return Object.freeze(result);
  }
}

// ============================================================================
// RELATIONSHIP PRESSURE PREDICTOR
// ============================================================================

export interface RelationshipPressurePrediction {
  readonly counterpartId: string;
  readonly currentIntensity01: number;
  readonly projectedIntensity01After24h: number;
  readonly projectedIntensity01After72h: number;
  readonly willEscalate: boolean;
  readonly escalationTrigger: string | null;
}

export function predictRelationshipPressure(
  state: ChatRelationshipCounterpartState,
  decayRate: number = 0.02,
): RelationshipPressurePrediction {
  const now24hDecay = Math.pow(1 - decayRate, 24);
  const now72hDecay = Math.pow(1 - decayRate, 72);
  const projectedIntensity01After24h = clamp01(state.intensity01 * now24hDecay);
  const projectedIntensity01After72h = clamp01(state.intensity01 * now72hDecay);
  const willEscalate = state.vector.unfinishedBusiness01 >= 0.60 || state.vector.obsession01 >= 0.65;
  const escalationTrigger =
    state.vector.obsession01 >= 0.65 ? 'HIGH_OBSESSION' :
    state.vector.unfinishedBusiness01 >= 0.60 ? 'UNFINISHED_BUSINESS' :
    null;
  return Object.freeze({
    counterpartId: state.counterpartId,
    currentIntensity01: state.intensity01,
    projectedIntensity01After24h,
    projectedIntensity01After72h,
    willEscalate,
    escalationTrigger,
  });
}

// ============================================================================
// RELATIONSHIP SUMMARY BUILDER — Enhanced summary views
// ============================================================================

export interface EnhancedRelationshipSummary extends ChatRelationshipSummaryView {
  readonly arcType: RelationshipArcType;
  readonly arcConfidence01: number;
  readonly pressurePrediction: RelationshipPressurePrediction;
  readonly snapshot: RelationshipCounterpartSnapshot;
}

export function buildEnhancedRelationshipSummary(
  state: ChatRelationshipCounterpartState,
): EnhancedRelationshipSummary {
  const arc = detectRelationshipArc(state);
  const prediction = predictRelationshipPressure(state);
  const snapshot = projectCounterpartSnapshot(state);
  const summaryView: ChatRelationshipSummaryView = {
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
  };
  return Object.freeze({
    ...summaryView,
    arcType: arc.arcType,
    arcConfidence01: arc.confidence01,
    pressurePrediction: prediction,
    snapshot,
  });
}

// ============================================================================
// RELATIONSHIP ENCOUNTER LOG — Track when counterparts were last interacted with
// ============================================================================

export interface RelationshipEncounterEntry {
  readonly counterpartId: string;
  readonly counterpartKind: ChatRelationshipCounterpartKind;
  readonly lastEventType: ChatRelationshipEventDescriptor['eventType'];
  readonly lastChannelId: string | null;
  readonly lastTouchedAt: number;
  readonly ageMs: number;
  readonly isRecent: boolean;
}

export function buildEncounterLog(
  states: readonly ChatRelationshipCounterpartState[],
  recentWindowMs: number = 2 * 60 * 60 * 1000,
  nowMs: number = Date.now(),
): readonly RelationshipEncounterEntry[] {
  return Object.freeze(
    states.map((s): RelationshipEncounterEntry => {
      const ageMs = nowMs - s.lastTouchedAt;
      const lastEvent = s.eventHistoryTail[0];
      return Object.freeze({
        counterpartId: s.counterpartId,
        counterpartKind: s.counterpartKind,
        lastEventType: lastEvent?.eventType ?? 'PLAYER_MESSAGE',
        lastChannelId: s.lastChannelId ?? null,
        lastTouchedAt: s.lastTouchedAt,
        ageMs,
        isRecent: ageMs <= recentWindowMs,
      });
    }).sort((a, b) => a.ageMs - b.ageMs),
  );
}

// ============================================================================
// RELATIONSHIP FINGERPRINT — Stable hash for relationship state
// ============================================================================

export function computeRelationshipFingerprint(
  states: readonly ChatRelationshipCounterpartState[],
): string {
  const sorted = [...states].sort((a, b) => a.counterpartId.localeCompare(b.counterpartId));
  const parts = sorted.map((s) =>
    `${s.counterpartId}:${s.stance}:${s.intensity01.toFixed(2)}:${s.lastTouchedAt}`,
  );
  return parts.join('|');
}

// ============================================================================
// MULTI-PLAYER RELATIONSHIP COHORT ANALYSIS
// ============================================================================

export interface RelationshipCohortReport {
  readonly playerCount: number;
  readonly mostCommonStance: ChatRelationshipStance | null;
  readonly mostCommonObjective: ChatRelationshipObjective | null;
  readonly avgIntensity01: number;
  readonly highThreatPlayerIds: readonly string[];
  readonly topSharedCounterpartIds: readonly string[];
}

export function analyzeRelationshipCohort(
  snapshotsByPlayer: Readonly<Record<string, ChatRelationshipSnapshot>>,
): RelationshipCohortReport {
  const playerIds = Object.keys(snapshotsByPlayer);
  if (playerIds.length === 0) {
    return Object.freeze({
      playerCount: 0,
      mostCommonStance: null,
      mostCommonObjective: null,
      avgIntensity01: 0,
      highThreatPlayerIds: Object.freeze([]),
      topSharedCounterpartIds: Object.freeze([]),
    });
  }

  const allStates = Object.values(snapshotsByPlayer).flatMap((s) => s.counterparts);
  const stanceCounts = new Map<ChatRelationshipStance, number>();
  const objCounts = new Map<ChatRelationshipObjective, number>();
  const counterpartCounts = new Map<string, number>();

  for (const st of allStates) {
    stanceCounts.set(st.stance, (stanceCounts.get(st.stance) ?? 0) + 1);
    objCounts.set(st.objective, (objCounts.get(st.objective) ?? 0) + 1);
    counterpartCounts.set(st.counterpartId, (counterpartCounts.get(st.counterpartId) ?? 0) + 1);
  }

  let mostCommonStance: ChatRelationshipStance | null = null;
  let maxStance = 0;
  for (const [s, c] of stanceCounts) { if (c > maxStance) { maxStance = c; mostCommonStance = s; } }

  let mostCommonObjective: ChatRelationshipObjective | null = null;
  let maxObj = 0;
  for (const [o, c] of objCounts) { if (c > maxObj) { maxObj = c; mostCommonObjective = o; } }

  const avgIntensity01 = allStates.length > 0
    ? allStates.reduce((s, st) => s + st.intensity01, 0) / allStates.length
    : 0;

  const highThreatPlayerIds = playerIds.filter((pid) => {
    const states = snapshotsByPlayer[pid]!.counterparts;
    return states.some((st) => st.stance === 'HUNTING' || st.stance === 'OBSESSED');
  });

  const topSharedCounterpartIds = [...counterpartCounts.entries()]
    .filter(([, c]) => c >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id]) => id);

  return Object.freeze({
    playerCount: playerIds.length,
    mostCommonStance,
    mostCommonObjective,
    avgIntensity01,
    highThreatPlayerIds: Object.freeze(highThreatPlayerIds),
    topSharedCounterpartIds: Object.freeze(topSharedCounterpartIds),
  });
}

// ============================================================================
// RELATIONSHIP RECORD BUILDER
// ============================================================================

export function buildRelationshipEvent(
  eventId: string,
  counterpartId: string,
  counterpartKind: ChatRelationshipCounterpartKind,
  eventType: ChatRelationshipEventDescriptor['eventType'],
  options: Partial<Omit<ChatRelationshipEventDescriptor, 'eventId' | 'counterpartId' | 'counterpartKind' | 'eventType'>> = {},
): ChatRelationshipEventDescriptor {
  return Object.freeze({
    eventId,
    eventType,
    counterpartId,
    counterpartKind,
    playerId: options.playerId ?? null,
    botId: options.botId ?? null,
    actorRole: options.actorRole ?? null,
    channelId: options.channelId ?? null,
    roomId: options.roomId ?? null,
    pressureBand: options.pressureBand ?? null,
    summary: options.summary ?? null,
    rawText: options.rawText ?? null,
    createdAt: options.createdAt ?? Date.now(),
  });
}

// ============================================================================
// RELATIONSHIP AXIS HEAT MAP
// ============================================================================

export interface RelationshipAxisHeatMapEntry {
  readonly axisId: ChatRelationshipAxisId;
  readonly counterpartId: string;
  readonly value: number;
  readonly rank: number;
}

export interface RelationshipAxisHeatMap {
  readonly playerId: string;
  readonly generatedAt: number;
  readonly entries: readonly RelationshipAxisHeatMapEntry[];
  readonly hotAxis: ChatRelationshipAxisId | null;
  readonly coldAxis: ChatRelationshipAxisId | null;
}

export function buildRelationshipAxisHeatMap(
  playerId: string,
  buckets: Map<string, Map<string, ChatRelationshipCounterpartState>>,
): RelationshipAxisHeatMap {
  const playerBuckets = buckets.get(playerId);
  const entries: RelationshipAxisHeatMapEntry[] = [];
  const AXES: ChatRelationshipAxisId[] = [
    'contempt01', 'fascination01', 'respect01', 'fear01', 'obsession01',
    'patience01', 'familiarity01', 'predictiveConfidence01', 'traumaDebt01', 'unfinishedBusiness01',
  ];

  if (playerBuckets) {
    for (const [cid, state] of playerBuckets) {
      for (const axis of AXES) {
        entries.push({
          axisId: axis,
          counterpartId: cid,
          value: state.vector[axis],
          rank: 0,
        });
      }
    }
  }

  // Rank within each axis
  const byAxis = new Map<ChatRelationshipAxisId, RelationshipAxisHeatMapEntry[]>();
  for (const e of entries) {
    if (!byAxis.has(e.axisId)) byAxis.set(e.axisId, []);
    byAxis.get(e.axisId)!.push(e);
  }

  const ranked: RelationshipAxisHeatMapEntry[] = [];
  let maxAvg = -Infinity;
  let minAvg = Infinity;
  let hotAxis: ChatRelationshipAxisId | null = null;
  let coldAxis: ChatRelationshipAxisId | null = null;

  for (const [axis, axEntries] of byAxis) {
    axEntries.sort((a, b) => b.value - a.value);
    axEntries.forEach((e, i) => ranked.push({ ...e, rank: i + 1 }));
    const avg = axEntries.reduce((s, e) => s + e.value, 0) / (axEntries.length || 1);
    if (avg > maxAvg) { maxAvg = avg; hotAxis = axis; }
    if (avg < minAvg) { minAvg = avg; coldAxis = axis; }
  }

  return Object.freeze({ playerId, generatedAt: Date.now(), entries: Object.freeze(ranked), hotAxis, coldAxis });
}

// ============================================================================
// COUNTERPART STATE TRACER
// ============================================================================

export interface RelationshipStateTraceEntry {
  readonly eventId: string;
  readonly eventType: ChatRelationshipEventDescriptor['eventType'];
  readonly createdAt: number;
  readonly vectorBefore: ChatRelationshipVector;
  readonly vectorAfter: ChatRelationshipVector;
  readonly delta: ChatRelationshipVector;
}

export interface RelationshipStateTrace {
  readonly playerId: string;
  readonly counterpartId: string;
  readonly entries: readonly RelationshipStateTraceEntry[];
  readonly netDelta: ChatRelationshipVector;
}

export function traceCounterpartState(
  events: readonly ChatRelationshipEventDescriptor[],
  initialVector: ChatRelationshipVector = emptyRelationshipVector(),
): RelationshipStateTrace {
  if (events.length === 0) {
    return Object.freeze({
      playerId: '',
      counterpartId: '',
      entries: Object.freeze([]),
      netDelta: emptyRelationshipVector(),
    });
  }

  const playerId = events[0].playerId ?? '';
  const counterpartId = events[0].counterpartId;
  const entries: RelationshipStateTraceEntry[] = [];
  let current = { ...initialVector };

  for (const ev of events) {
    const before = { ...current };
    // Simulate small drift for each event type
    const boost = ev.pressureBand === 'HIGH' ? 0.05 : ev.pressureBand === 'MEDIUM' ? 0.03 : 0.01;
    const newVector = { ...current };
    switch (ev.eventType) {
      case 'DIRECT_ATTACK': newVector.contempt01 = clamp01(current.contempt01 + boost); break;
      case 'PUBLIC_CALL_OUT': newVector.fear01 = clamp01(current.fear01 + boost * 0.7); break;
      case 'ALLIANCE_SIGNAL': newVector.respect01 = clamp01(current.respect01 + boost); break;
      case 'BETRAYAL': newVector.traumaDebt01 = clamp01(current.traumaDebt01 + boost); break;
      case 'SHARED_VICTORY': newVector.familiarity01 = clamp01(current.familiarity01 + boost); break;
      case 'UNRESOLVED_GRUDGE': newVector.unfinishedBusiness01 = clamp01(current.unfinishedBusiness01 + boost); break;
      case 'PROTECTIVE_MOVE': newVector.patience01 = clamp01(current.patience01 + boost * 0.5); break;
      case 'SILENT_OBSERVATION': newVector.fascination01 = clamp01(current.fascination01 + boost * 0.4); break;
      default: break;
    }

    const delta: ChatRelationshipVector = {
      contempt01: newVector.contempt01 - before.contempt01,
      fascination01: newVector.fascination01 - before.fascination01,
      respect01: newVector.respect01 - before.respect01,
      fear01: newVector.fear01 - before.fear01,
      obsession01: newVector.obsession01 - before.obsession01,
      patience01: newVector.patience01 - before.patience01,
      familiarity01: newVector.familiarity01 - before.familiarity01,
      predictiveConfidence01: newVector.predictiveConfidence01 - before.predictiveConfidence01,
      traumaDebt01: newVector.traumaDebt01 - before.traumaDebt01,
      unfinishedBusiness01: newVector.unfinishedBusiness01 - before.unfinishedBusiness01,
    } as ChatRelationshipVector;

    entries.push(Object.freeze({ eventId: ev.eventId, eventType: ev.eventType, createdAt: ev.createdAt, vectorBefore: Object.freeze(before as ChatRelationshipVector), vectorAfter: Object.freeze(newVector as ChatRelationshipVector), delta: Object.freeze(delta) }));
    current = newVector;
  }

  const netDelta: ChatRelationshipVector = {
    contempt01: current.contempt01 - initialVector.contempt01,
    fascination01: current.fascination01 - initialVector.fascination01,
    respect01: current.respect01 - initialVector.respect01,
    fear01: current.fear01 - initialVector.fear01,
    obsession01: current.obsession01 - initialVector.obsession01,
    patience01: current.patience01 - initialVector.patience01,
    familiarity01: current.familiarity01 - initialVector.familiarity01,
    predictiveConfidence01: current.predictiveConfidence01 - initialVector.predictiveConfidence01,
    traumaDebt01: current.traumaDebt01 - initialVector.traumaDebt01,
    unfinishedBusiness01: current.unfinishedBusiness01 - initialVector.unfinishedBusiness01,
  } as ChatRelationshipVector;

  return Object.freeze({ playerId, counterpartId, entries: Object.freeze(entries), netDelta: Object.freeze(netDelta) });
}

// ============================================================================
// RELATIONSHIP COUNTERPART SNAPSHOT PROJECTOR
// ============================================================================

export interface CounterpartProjectionInput {
  readonly playerId: string;
  readonly counterpartId: string;
  readonly state: ChatRelationshipCounterpartState;
  readonly nowMs?: number;
}

export interface CounterpartProjection {
  readonly playerId: string;
  readonly counterpartId: string;
  readonly counterpartKind: ChatRelationshipCounterpartKind;
  readonly stance: ChatRelationshipStance;
  readonly vector: ChatRelationshipVector;
  readonly dominantAxis: ChatRelationshipAxisId | null;
  readonly volatility: number;
  readonly trustScore: number;
  readonly hostilityScore: number;
  readonly engagementScore: number;
  readonly projectedAt: number;
}

export function projectCounterpartSnapshot(input: CounterpartProjectionInput): CounterpartProjection {
  const { state } = input;
  const v = state.vector;

  const dominantScore: Record<string, number> = {
    contempt01: v.contempt01,
    fascination01: v.fascination01,
    respect01: v.respect01,
    fear01: v.fear01,
    obsession01: v.obsession01,
    patience01: v.patience01,
    familiarity01: v.familiarity01,
    predictiveConfidence01: v.predictiveConfidence01,
    traumaDebt01: v.traumaDebt01,
    unfinishedBusiness01: v.unfinishedBusiness01,
  };

  let dominantAxis: ChatRelationshipAxisId | null = null;
  let maxVal = -Infinity;
  for (const [k, val] of Object.entries(dominantScore)) {
    if (val > maxVal) { maxVal = val; dominantAxis = k as ChatRelationshipAxisId; }
  }

  const vals = Object.values(dominantScore);
  const mean = vals.reduce((s, x) => s + x, 0) / vals.length;
  const variance = vals.reduce((s, x) => s + (x - mean) ** 2, 0) / vals.length;
  const volatility = Math.sqrt(variance);

  const trustScore = clamp01((v.respect01 + v.patience01 + v.familiarity01) / 3);
  const hostilityScore = clamp01((v.contempt01 + v.fear01 + v.traumaDebt01) / 3);
  const engagementScore = clamp01((v.fascination01 + v.obsession01 + v.unfinishedBusiness01) / 3);

  return Object.freeze({
    playerId: input.playerId,
    counterpartId: input.counterpartId,
    counterpartKind: state.counterpartKind,
    stance: state.stance,
    vector: state.vector,
    dominantAxis,
    volatility,
    trustScore,
    hostilityScore,
    engagementScore,
    projectedAt: input.nowMs ?? Date.now(),
  });
}

// ============================================================================
// RELATIONSHIP COHORT ANALYSIS
// ============================================================================

export interface RelationshipCohortSummary {
  readonly totalPlayers: number;
  readonly totalCounterparts: number;
  readonly avgVectorByAxis: ChatRelationshipVector;
  readonly stanceDistribution: Record<ChatRelationshipStance, number>;
  readonly mostCommonStance: ChatRelationshipStance | null;
  readonly highObsessionPairs: Array<{ playerId: string; counterpartId: string; obsession: number }>;
  readonly highTraumaPairs: Array<{ playerId: string; counterpartId: string; trauma: number }>;
  readonly generatedAt: number;
}

export function analyzeRelationshipCohort(
  allBuckets: Map<string, Map<string, ChatRelationshipCounterpartState>>,
): RelationshipCohortSummary {
  let totalCounterparts = 0;
  const axisSum: Record<string, number> = {
    contempt01: 0, fascination01: 0, respect01: 0, fear01: 0, obsession01: 0,
    patience01: 0, familiarity01: 0, predictiveConfidence01: 0, traumaDebt01: 0, unfinishedBusiness01: 0,
  };
  const stanceDist: Record<string, number> = {};
  const highObsession: Array<{ playerId: string; counterpartId: string; obsession: number }> = [];
  const highTrauma: Array<{ playerId: string; counterpartId: string; trauma: number }> = [];

  for (const [playerId, counterpartMap] of allBuckets) {
    for (const [counterpartId, state] of counterpartMap) {
      totalCounterparts++;
      const v = state.vector;
      for (const k of Object.keys(axisSum)) {
        axisSum[k] += (v as unknown as Record<string, number>)[k] ?? 0;
      }
      const stance = state.stance;
      stanceDist[stance] = (stanceDist[stance] ?? 0) + 1;
      if (v.obsession01 > 0.7) highObsession.push({ playerId, counterpartId, obsession: v.obsession01 });
      if (v.traumaDebt01 > 0.7) highTrauma.push({ playerId, counterpartId, trauma: v.traumaDebt01 });
    }
  }

  const n = totalCounterparts || 1;
  const avgRecord: Record<string, number> = {};
  for (const k of Object.keys(axisSum)) avgRecord[k] = axisSum[k] / n;
  const avgVectorByAxis = avgRecord as unknown as ChatRelationshipVector;

  let mostCommonStance: ChatRelationshipStance | null = null;
  let maxCount = 0;
  for (const [stance, count] of Object.entries(stanceDist)) {
    if (count > maxCount) { maxCount = count; mostCommonStance = stance as ChatRelationshipStance; }
  }

  highObsession.sort((a, b) => b.obsession - a.obsession);
  highTrauma.sort((a, b) => b.trauma - a.trauma);

  return Object.freeze({
    totalPlayers: allBuckets.size,
    totalCounterparts,
    avgVectorByAxis,
    stanceDistribution: stanceDist as Record<ChatRelationshipStance, number>,
    mostCommonStance,
    highObsessionPairs: Object.freeze(highObsession.slice(0, 20)),
    highTraumaPairs: Object.freeze(highTrauma.slice(0, 20)),
    generatedAt: Date.now(),
  });
}

// ============================================================================
// RELATIONSHIP FINGERPRINT (deduplication / identity)
// ============================================================================

export interface RelationshipFingerprint {
  readonly playerId: string;
  readonly counterpartId: string;
  readonly hash: string;
  readonly computedAt: number;
}

export function computeRelationshipFingerprint(
  playerId: string,
  counterpartId: string,
  state: ChatRelationshipCounterpartState,
): RelationshipFingerprint {
  const v = state.vector;
  const parts = [
    playerId, counterpartId, state.stance, state.counterpartKind,
    v.contempt01.toFixed(4), v.fascination01.toFixed(4), v.respect01.toFixed(4),
    v.fear01.toFixed(4), v.obsession01.toFixed(4), v.patience01.toFixed(4),
    v.familiarity01.toFixed(4), v.predictiveConfidence01.toFixed(4),
    v.traumaDebt01.toFixed(4), v.unfinishedBusiness01.toFixed(4),
  ];
  let h = 5381;
  for (const p of parts) {
    for (let i = 0; i < p.length; i++) {
      h = ((h << 5) + h + p.charCodeAt(i)) >>> 0;
    }
  }
  return Object.freeze({ playerId, counterpartId, hash: h.toString(16).padStart(8, '0'), computedAt: Date.now() });
}

// ============================================================================
// RELATIONSHIP OBJECTIVE TRACKER
// ============================================================================

export interface ObjectiveProgressEntry {
  readonly objective: ChatRelationshipObjective;
  readonly counterpartId: string;
  readonly completionScore: number;
  readonly isComplete: boolean;
  readonly blockers: readonly string[];
}

export interface ObjectiveProgressReport {
  readonly playerId: string;
  readonly entries: readonly ObjectiveProgressEntry[];
  readonly completedCount: number;
  readonly pendingCount: number;
  readonly overallProgress: number;
  readonly generatedAt: number;
}

export function buildObjectiveProgressReport(
  playerId: string,
  counterpartMap: Map<string, ChatRelationshipCounterpartState>,
): ObjectiveProgressReport {
  const entries: ObjectiveProgressEntry[] = [];

  for (const [counterpartId, state] of counterpartMap) {
    for (const objective of state.activeObjectives) {
      const v = state.vector;
      let completionScore = 0;
      const blockers: string[] = [];

      switch (objective) {
        case 'ESTABLISH_DOMINANCE':
          completionScore = clamp01((v.contempt01 * 0.4 + v.fear01 * 0.6));
          if (v.fear01 < 0.4) blockers.push('fear01 too low');
          break;
        case 'BUILD_TRUST':
          completionScore = clamp01((v.respect01 * 0.5 + v.familiarity01 * 0.5));
          if (v.respect01 < 0.5) blockers.push('respect01 insufficient');
          break;
        case 'EXPOSE_WEAKNESS':
          completionScore = clamp01(v.predictiveConfidence01 * 0.8);
          if (v.predictiveConfidence01 < 0.6) blockers.push('predictiveConfidence01 low');
          break;
        case 'EXTRACT_INTEL':
          completionScore = clamp01(v.familiarity01 * 0.7 + v.obsession01 * 0.3);
          break;
        case 'TRIGGER_BREAKDOWN':
          completionScore = clamp01(v.traumaDebt01 * 0.6 + v.unfinishedBusiness01 * 0.4);
          if (v.traumaDebt01 < 0.5) blockers.push('traumaDebt01 not high enough');
          break;
        case 'FORGE_ALLIANCE':
          completionScore = clamp01(v.respect01 * 0.4 + v.familiarity01 * 0.3 + v.patience01 * 0.3);
          break;
        default:
          completionScore = 0;
      }

      entries.push(Object.freeze({
        objective,
        counterpartId,
        completionScore,
        isComplete: completionScore >= 0.85,
        blockers: Object.freeze(blockers),
      }));
    }
  }

  const completedCount = entries.filter((e) => e.isComplete).length;
  const pendingCount = entries.length - completedCount;
  const overallProgress = entries.length === 0
    ? 0
    : entries.reduce((s, e) => s + e.completionScore, 0) / entries.length;

  return Object.freeze({
    playerId,
    entries: Object.freeze(entries),
    completedCount,
    pendingCount,
    overallProgress,
    generatedAt: Date.now(),
  });
}

// ============================================================================
// RELATIONSHIP LEGACY PROJECTION BUILDER
// ============================================================================

export interface LegacyProjectionBuildInput {
  readonly playerId: string;
  readonly counterpartId: string;
  readonly state: ChatRelationshipCounterpartState;
  readonly recentEvents: readonly ChatRelationshipEventDescriptor[];
  readonly nowMs?: number;
}

export function buildLegacyProjection(input: LegacyProjectionBuildInput): ChatRelationshipLegacyProjection {
  const { state, recentEvents } = input;
  const v = state.vector;
  const nowMs = input.nowMs ?? Date.now();

  const lastEvent = recentEvents.length > 0 ? recentEvents[recentEvents.length - 1] : null;

  const tensionScore = clamp01(
    v.contempt01 * 0.3 + v.fear01 * 0.3 + v.traumaDebt01 * 0.2 + v.unfinishedBusiness01 * 0.2,
  );

  const affinityScore = clamp01(
    v.respect01 * 0.35 + v.familiarity01 * 0.35 + v.patience01 * 0.3,
  );

  const obsessionRating = clamp01(v.obsession01 * 0.6 + v.fascination01 * 0.4);

  return Object.freeze({
    playerId: input.playerId,
    counterpartId: input.counterpartId,
    counterpartKind: state.counterpartKind,
    stance: state.stance,
    vector: state.vector,
    tensionScore,
    affinityScore,
    obsessionRating,
    lastEventType: lastEvent?.eventType ?? null,
    lastEventAt: lastEvent?.createdAt ?? null,
    activeObjectives: state.activeObjectives,
    snapshotHistory: state.snapshotHistory,
    projectedAt: nowMs,
  });
}

// ============================================================================
// RELATIONSHIP NPC SIGNAL BATCH PROJECTOR
// ============================================================================

export interface NpcSignalBatchResult {
  readonly playerId: string;
  readonly signals: readonly ChatRelationshipNpcSignal[];
  readonly generatedAt: number;
}

export function projectAllNpcSignals(
  playerId: string,
  counterpartMap: Map<string, ChatRelationshipCounterpartState>,
): NpcSignalBatchResult {
  const signals: ChatRelationshipNpcSignal[] = [];
  for (const [counterpartId, state] of counterpartMap) {
    if (state.counterpartKind !== 'NPC') continue;
    const v = state.vector;
    const dominance = clamp01(v.contempt01 + v.fear01);
    const warmth = clamp01(v.respect01 + v.familiarity01);
    const signal: ChatRelationshipNpcSignal = Object.freeze({
      counterpartId,
      dominanceSignal: dominance,
      warmthSignal: warmth,
      stance: state.stance,
      obsessionLevel: v.obsession01,
      trustLevel: v.patience01,
      projectedAt: Date.now(),
    });
    signals.push(signal);
  }
  return Object.freeze({ playerId, signals: Object.freeze(signals), generatedAt: Date.now() });
}

// ============================================================================
// RELATIONSHIP SUMMARY VIEW BUILDER
// ============================================================================

export function buildRelationshipSummaryView(
  playerId: string,
  counterpartId: string,
  state: ChatRelationshipCounterpartState,
): ChatRelationshipSummaryView {
  const v = state.vector;
  const AXES: ChatRelationshipAxisId[] = [
    'contempt01', 'fascination01', 'respect01', 'fear01', 'obsession01',
    'patience01', 'familiarity01', 'predictiveConfidence01', 'traumaDebt01', 'unfinishedBusiness01',
  ];
  let dominantAxis: ChatRelationshipAxisId | null = null;
  let maxVal = -Infinity;
  for (const ax of AXES) {
    const val = (v as unknown as Record<string, number>)[ax] ?? 0;
    if (val > maxVal) { maxVal = val; dominantAxis = ax; }
  }
  const tensionScore = clamp01(v.contempt01 * 0.35 + v.fear01 * 0.35 + v.traumaDebt01 * 0.3);
  const affinityScore = clamp01(v.respect01 * 0.4 + v.familiarity01 * 0.35 + v.patience01 * 0.25);
  return Object.freeze({
    playerId,
    counterpartId,
    counterpartKind: state.counterpartKind,
    stance: state.stance,
    dominantAxis,
    tensionScore,
    affinityScore,
    recentEventCount: state.recentEvents.length,
    activeObjectiveCount: state.activeObjectives.length,
    snapshotCount: state.snapshotHistory.length,
  });
}

// ============================================================================
// RELATIONSHIP STANCE OVERRIDE ENGINE
// ============================================================================

export interface StanceOverrideRule {
  readonly id: string;
  readonly condition: (v: ChatRelationshipVector, events: readonly ChatRelationshipEventDescriptor[]) => boolean;
  readonly targetStance: ChatRelationshipStance;
  readonly priority: number;
  readonly reason: string;
}

export const BUILT_IN_STANCE_OVERRIDE_RULES: readonly StanceOverrideRule[] = Object.freeze([
  {
    id: 'rule_contempt_dominance',
    condition: (v) => v.contempt01 > 0.85 && v.fear01 > 0.6,
    targetStance: 'HOSTILE',
    priority: 100,
    reason: 'Extreme contempt + high fear drives hostile lock-in',
  },
  {
    id: 'rule_trauma_unfinished',
    condition: (v) => v.traumaDebt01 > 0.8 && v.unfinishedBusiness01 > 0.7,
    targetStance: 'OBSESSIVE',
    priority: 90,
    reason: 'Deep trauma combined with unresolved conflict creates obsessive fixation',
  },
  {
    id: 'rule_respect_familiarity',
    condition: (v) => v.respect01 > 0.8 && v.familiarity01 > 0.75 && v.contempt01 < 0.2,
    targetStance: 'ALLIED',
    priority: 80,
    reason: 'High mutual respect and familiarity with no contempt forms alliance',
  },
  {
    id: 'rule_fascination_patience',
    condition: (v) => v.fascination01 > 0.75 && v.obsession01 > 0.6 && v.contempt01 < 0.3,
    targetStance: 'RIVAL',
    priority: 70,
    reason: 'Fascination + obsession without contempt creates competitive rivalry',
  },
  {
    id: 'rule_fear_submission',
    condition: (v) => v.fear01 > 0.85 && v.contempt01 < 0.2,
    targetStance: 'SUBMISSIVE',
    priority: 65,
    reason: 'High fear without contempt = submissive posture',
  },
  {
    id: 'rule_predictive_confidence',
    condition: (v) => v.predictiveConfidence01 > 0.9 && v.familiarity01 > 0.8,
    targetStance: 'NEUTRAL',
    priority: 50,
    reason: 'Full predictive confidence and familiarity leads to stable neutral equilibrium',
  },
]);

export function applyStanceOverrideRules(
  currentStance: ChatRelationshipStance,
  vector: ChatRelationshipVector,
  events: readonly ChatRelationshipEventDescriptor[],
  rules: readonly StanceOverrideRule[] = BUILT_IN_STANCE_OVERRIDE_RULES,
): ChatRelationshipStance {
  const applicable = rules
    .filter((r) => r.condition(vector, events))
    .sort((a, b) => b.priority - a.priority);
  return applicable.length > 0 ? applicable[0].targetStance : currentStance;
}

// ============================================================================
// RELATIONSHIP BATCH EXPORT / IMPORT
// ============================================================================

export interface RelationshipBatchExport {
  readonly exportedAt: number;
  readonly version: number;
  readonly players: readonly RelationshipPlayerExport[];
}

export function exportAllRelationships(
  allBuckets: Map<string, Map<string, ChatRelationshipCounterpartState>>,
  eventTails: Map<string, ChatRelationshipEventDescriptor[]>,
): RelationshipBatchExport {
  const players: RelationshipPlayerExport[] = [];
  for (const [playerId, counterpartMap] of allBuckets) {
    const events = eventTails.get(playerId) ?? [];
    const counterparts = new Map<string, ChatRelationshipCounterpartState>(counterpartMap);
    players.push({ playerId, counterparts, eventTail: events });
  }
  return Object.freeze({ exportedAt: Date.now(), version: 2, players: Object.freeze(players) });
}

export function importAllRelationships(
  batch: RelationshipBatchExport,
  allBuckets: Map<string, Map<string, ChatRelationshipCounterpartState>>,
  eventTails: Map<string, ChatRelationshipEventDescriptor[]>,
): void {
  for (const playerExport of batch.players) {
    allBuckets.set(playerExport.playerId, new Map(playerExport.counterparts));
    eventTails.set(playerExport.playerId, [...playerExport.eventTail]);
  }
}

// ============================================================================
// RELATIONSHIP PRESSURE WINDOW
// ============================================================================

export interface RelationshipPressureWindow {
  readonly playerId: string;
  readonly counterpartId: string;
  readonly windowMs: number;
  readonly eventCount: number;
  readonly pressureBandCounts: Record<string, number>;
  readonly dominantPressureBand: string | null;
  readonly avgPressureScore: number;
  readonly windowEnd: number;
}

export function buildPressureWindow(
  playerId: string,
  counterpartId: string,
  events: readonly ChatRelationshipEventDescriptor[],
  windowMs: number = 60_000,
  nowMs: number = Date.now(),
): RelationshipPressureWindow {
  const cutoff = nowMs - windowMs;
  const windowEvents = events.filter(
    (e) => e.counterpartId === counterpartId && e.createdAt >= cutoff,
  );

  const bandCounts: Record<string, number> = {};
  let pressureSum = 0;
  for (const ev of windowEvents) {
    const band = ev.pressureBand ?? 'LOW';
    bandCounts[band] = (bandCounts[band] ?? 0) + 1;
    pressureSum += band === 'HIGH' ? 1 : band === 'MEDIUM' ? 0.5 : 0.2;
  }

  let dominantBand: string | null = null;
  let maxBandCount = 0;
  for (const [b, cnt] of Object.entries(bandCounts)) {
    if (cnt > maxBandCount) { maxBandCount = cnt; dominantBand = b; }
  }

  return Object.freeze({
    playerId,
    counterpartId,
    windowMs,
    eventCount: windowEvents.length,
    pressureBandCounts: bandCounts,
    dominantPressureBand: dominantBand,
    avgPressureScore: windowEvents.length === 0 ? 0 : pressureSum / windowEvents.length,
    windowEnd: nowMs,
  });
}

// ============================================================================
// RELATIONSHIP INTERACTION QUALITY
// ============================================================================

export interface InteractionQualityReport {
  readonly playerId: string;
  readonly counterpartId: string;
  readonly totalEvents: number;
  readonly hostileEventRatio: number;
  readonly allianceEventRatio: number;
  readonly neutralEventRatio: number;
  readonly qualityScore: number;
  readonly qualityLabel: 'TOXIC' | 'STRAINED' | 'NEUTRAL' | 'COOPERATIVE' | 'ALLIED';
  readonly generatedAt: number;
}

const HOSTILE_EVENTS: ReadonlySet<ChatRelationshipEventDescriptor['eventType']> = new Set([
  'DIRECT_ATTACK', 'PUBLIC_CALL_OUT', 'BETRAYAL', 'TRIGGER_BREAKDOWN', 'UNRESOLVED_GRUDGE',
]);
const ALLIANCE_EVENTS: ReadonlySet<ChatRelationshipEventDescriptor['eventType']> = new Set([
  'ALLIANCE_SIGNAL', 'SHARED_VICTORY', 'PROTECTIVE_MOVE', 'FORGE_ALLIANCE',
]);

export function buildInteractionQualityReport(
  playerId: string,
  counterpartId: string,
  events: readonly ChatRelationshipEventDescriptor[],
): InteractionQualityReport {
  const counterpartEvents = events.filter((e) => e.counterpartId === counterpartId);
  const total = counterpartEvents.length;
  if (total === 0) {
    return Object.freeze({
      playerId, counterpartId, totalEvents: 0,
      hostileEventRatio: 0, allianceEventRatio: 0, neutralEventRatio: 1,
      qualityScore: 0.5, qualityLabel: 'NEUTRAL', generatedAt: Date.now(),
    });
  }

  const hostileCount = counterpartEvents.filter((e) => HOSTILE_EVENTS.has(e.eventType)).length;
  const allianceCount = counterpartEvents.filter((e) => ALLIANCE_EVENTS.has(e.eventType)).length;
  const neutralCount = total - hostileCount - allianceCount;

  const hostileRatio = hostileCount / total;
  const allianceRatio = allianceCount / total;
  const neutralRatio = neutralCount / total;
  const qualityScore = clamp01(allianceRatio - hostileRatio * 0.8 + neutralRatio * 0.1 + 0.4);

  const qualityLabel: InteractionQualityReport['qualityLabel'] =
    qualityScore < 0.2 ? 'TOXIC'
    : qualityScore < 0.4 ? 'STRAINED'
    : qualityScore < 0.6 ? 'NEUTRAL'
    : qualityScore < 0.8 ? 'COOPERATIVE'
    : 'ALLIED';

  return Object.freeze({
    playerId, counterpartId, totalEvents: total,
    hostileEventRatio: hostileRatio,
    allianceEventRatio: allianceRatio,
    neutralEventRatio: neutralRatio,
    qualityScore,
    qualityLabel,
    generatedAt: Date.now(),
  });
}

// ============================================================================
// MODULE LAWS AND DESCRIPTOR
// ============================================================================

export const CHAT_RELATIONSHIP_MODULE_NAME = 'ChatRelationshipService' as const;
export const CHAT_RELATIONSHIP_MODULE_VERSION = '4.0.0' as const;

export const CHAT_RELATIONSHIP_LAWS = Object.freeze([
  'Relationship state is append-only via events — no direct vector mutation.',
  'All counterpart states are isolated per player — cross-player state is forbidden.',
  'Stance transitions must pass through override rules or be explicitly requested.',
  'Event tails are capped at maxEventTail to bound memory growth.',
  'All exported vectors must be clamped to [0,1] before persistence.',
  'NPC signals are projected read-only — never modify a counterpart by signal alone.',
  'Batch imports must not silently overwrite existing states without explicit merge policy.',
  'Cohort analysis is always read-only and never mutates service state.',
]);

export const CHAT_RELATIONSHIP_DEFAULTS = Object.freeze({
  maxEventTail: 64,
  decayRatePerHour: 0.003,
  stanceOverridePriority: 'HIGHEST_WINS' as const,
  pressureWindowMs: 60_000,
  highObsessionThreshold: 0.7,
  highTraumaThreshold: 0.7,
  objectiveCompletionThreshold: 0.85,
  fingerprintVersion: 2,
});

export const CHAT_RELATIONSHIP_MODULE_DESCRIPTOR = Object.freeze({
  name: CHAT_RELATIONSHIP_MODULE_NAME,
  version: CHAT_RELATIONSHIP_MODULE_VERSION,
  laws: CHAT_RELATIONSHIP_LAWS,
  defaults: CHAT_RELATIONSHIP_DEFAULTS,
  supportedStances: ['NEUTRAL', 'HOSTILE', 'ALLIED', 'RIVAL', 'OBSESSIVE', 'SUBMISSIVE'] as const,
  supportedObjectives: [
    'ESTABLISH_DOMINANCE', 'BUILD_TRUST', 'EXPOSE_WEAKNESS',
    'EXTRACT_INTEL', 'TRIGGER_BREAKDOWN', 'FORGE_ALLIANCE',
  ] as const,
  supportedCounterpartKinds: ['NPC', 'PLAYER', 'BOT'] as const,
});
