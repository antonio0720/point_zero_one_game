/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT RELATIONSHIP MODEL
 * FILE: backend/src/game/engine/chat/intelligence/ChatRelationshipModel.ts
 * VERSION: 2026.03.21-relationship-depth.v2
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Persistent, memory-aware rivalry / helper / witness relationship evolution
 * layer for the backend chat lane.
 *
 * This file remains deterministic and additive:
 * - authored text remains authored
 * - selectors can project relationship state without orchestration sprawl
 * - ChatNpcDirector / orchestrators can ask for stance, objective, heat, and
 *   selection weight without recomputing the full history every time
 * - authoritative ChatMessage ingestion is now supported directly so backend
 *   transcript truth can feed the relationship lane without a frontend bridge
 * - diagnostics and query surfaces make the model operationally useful instead
 *   of a write-only score accumulator
 *
 * Design doctrine
 * ---------------
 * - Relationship state is not a freeform writer and not a replacement for scene
 *   planning.
 * - Relationship state transforms witnessed events into deterministic pressure,
 *   rescue readiness, rivalry depth, callback density, and selection gravity.
 * - The backend lane owns authoritative ingestion, replay-safe snapshotting,
 *   and durability-friendly projection helpers.
 * ============================================================================
 */

import type { BotId, ChatMessage, ChatVisibleChannel, UnixMs } from '../types';

import {
  clamp01,
  emptyRelationshipVector,
  weightedBlend,
  type ChatRelationshipAxisId,
  type ChatRelationshipCallbackHint,
  type ChatRelationshipCounterpartKind,
  type ChatRelationshipCounterpartState,
  type ChatRelationshipEventDescriptor,
  type ChatRelationshipEventType,
  type ChatRelationshipLegacyProjection,
  type ChatRelationshipNpcSignal,
  type ChatRelationshipObjective,
  type ChatRelationshipPressureBand,
  type ChatRelationshipSnapshot,
  type ChatRelationshipStance,
  type ChatRelationshipSummaryView,
  type ChatRelationshipVector,
} from '../../../../../../shared/contracts/chat/relationship';

export type ChatFeatureSnapshot = {
  readonly createdAt: UnixMs;
};

export type ChatRelationshipResponseClass =
  | 'QUESTION'
  | 'ANGRY'
  | 'TROLL'
  | 'FLEX'
  | 'CALM'
  | 'DISCIPLINED'
  | 'GREEDY'
  | 'FEARFUL'
  | 'NEGOTIATION'
  | 'WITNESS'
  | 'UNKNOWN';

export type ChatRelationshipMomentumBand = 'QUIET' | 'WARM' | 'HOT' | 'FEVER';

export interface ChatRelationshipModelOptions {
  readonly playerId?: string | null;
  readonly snapshot?: ChatRelationshipSnapshot;
  readonly now?: UnixMs;
  readonly maxCounterparts?: number;
  readonly historyLimit?: number;
  readonly callbackLimit?: number;
  readonly messageDedupLimit?: number;
}

export interface ChatRelationshipPlayerMessageInput {
  readonly counterpartId?: string | null;
  readonly counterpartKind?: ChatRelationshipCounterpartKind;
  readonly botId?: BotId | string | null;
  readonly channelId?: ChatVisibleChannel | string | null;
  readonly roomId?: string | null;
  readonly messageId?: string | null;
  readonly body: string;
  readonly responseClass?: ChatRelationshipResponseClass;
  readonly pressureBand?: ChatRelationshipPressureBand;
  readonly featureSnapshot?: ChatFeatureSnapshot;
  readonly tags?: readonly string[];
  readonly createdAt?: UnixMs;
}

export interface ChatRelationshipNpcUtteranceInput {
  readonly counterpartId: string;
  readonly counterpartKind?: ChatRelationshipCounterpartKind;
  readonly botId?: BotId | string | null;
  readonly actorRole?: string | null;
  readonly channelId?: ChatVisibleChannel | string | null;
  readonly roomId?: string | null;
  readonly context?: string | null;
  readonly severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly body: string;
  readonly emittedAt?: UnixMs;
  readonly tags?: readonly string[];
}

export interface ChatRelationshipGameEventInput {
  readonly counterpartId?: string | null;
  readonly counterpartKind?: ChatRelationshipCounterpartKind;
  readonly botId?: BotId | string | null;
  readonly channelId?: string | null;
  readonly roomId?: string | null;
  readonly eventType: string;
  readonly summary?: string;
  readonly pressureBand?: ChatRelationshipPressureBand;
  readonly tags?: readonly string[];
  readonly createdAt?: UnixMs;
  readonly sourceMessageId?: string | null;
  readonly sourcePlanId?: string | null;
  readonly sceneId?: string | null;
}

export interface ChatRelationshipSignalRequest {
  readonly counterpartId: string;
  readonly counterpartKind?: ChatRelationshipCounterpartKind;
  readonly botId?: BotId | string | null;
  readonly actorRole?: string | null;
  readonly context?: string | null;
  readonly channelId?: string | null;
  readonly roomId?: string | null;
  readonly pressureBand?: ChatRelationshipPressureBand;
  readonly publicWitness01?: number;
  readonly now?: UnixMs;
}

export interface ChatRelationshipAuthoritativeMessageOptions {
  readonly counterpartId?: string | null;
  readonly counterpartKind?: ChatRelationshipCounterpartKind;
  readonly actorRole?: string | null;
  readonly responseClass?: ChatRelationshipResponseClass;
  readonly pressureBand?: ChatRelationshipPressureBand;
  readonly publicWitness01?: number;
  readonly roomId?: string | null;
  readonly sourcePlanId?: string | null;
  readonly sceneId?: string | null;
  readonly extraTags?: readonly string[];
  readonly trustReplayMetadata?: boolean;
}

export interface ChatRelationshipEventQuery {
  readonly counterpartId?: string;
  readonly eventTypes?: readonly ChatRelationshipEventType[];
  readonly channelId?: string;
  readonly roomId?: string;
  readonly actorRole?: string;
  readonly tag?: string;
  readonly since?: number;
  readonly until?: number;
  readonly limit?: number;
}

export interface ChatRelationshipCounterpartDigest {
  readonly counterpartId: string;
  readonly counterpartKind: ChatRelationshipCounterpartKind;
  readonly stance: ChatRelationshipStance;
  readonly objective: ChatRelationshipObjective;
  readonly momentumBand: ChatRelationshipMomentumBand;
  readonly selectionScore01: number;
  readonly intensity01: number;
  readonly volatility01: number;
  readonly witnessHeat01: number;
  readonly rescueReadiness01: number;
  readonly escalationRisk01: number;
  readonly disciplineSignal01: number;
  readonly greedSignal01: number;
  readonly callbackCount: number;
  readonly lastSummary?: string | null;
  readonly lastEventType?: ChatRelationshipEventType | null;
  readonly lastChannelId?: string | null;
  readonly lastRoomId?: string | null;
  readonly dominantAxes: readonly ChatRelationshipAxisId[];
}

export interface ChatRelationshipChannelHeat {
  readonly channelId: string;
  readonly heat01: number;
  readonly focusCounterpartId?: string;
  readonly topCounterpartIds: readonly string[];
  readonly eventCount: number;
}

export interface ChatRelationshipRoomHeat {
  readonly roomId: string;
  readonly heat01: number;
  readonly eventCount: number;
  readonly topCounterpartIds: readonly string[];
}

export interface ChatRelationshipFocusSnapshot {
  readonly focusedCounterpartByChannel: Readonly<Record<string, string | undefined>>;
  readonly rankedCounterpartIds: readonly string[];
}

export interface ChatRelationshipDiagnostics {
  readonly createdAt: UnixMs;
  readonly updatedAt: UnixMs;
  readonly playerId?: string | null;
  readonly counterpartCount: number;
  readonly totalEventCount: number;
  readonly eventTypeCounts: Readonly<Record<ChatRelationshipEventType, number>>;
  readonly actorRoleCounts: Readonly<Record<string, number>>;
  readonly channelInteractionCounts: Readonly<Record<string, number>>;
  readonly roomInteractionCounts: Readonly<Record<string, number>>;
  readonly topCounterparts: readonly ChatRelationshipCounterpartDigest[];
  readonly channelHeat: readonly ChatRelationshipChannelHeat[];
  readonly roomHeat: readonly ChatRelationshipRoomHeat[];
  readonly focus: ChatRelationshipFocusSnapshot;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

type RelationshipDelta = { -readonly [K in keyof ChatRelationshipVector]: number };
type MutableRelationshipVector = Mutable<ChatRelationshipVector>;
type MutableRelationshipEventDescriptor = Mutable<ChatRelationshipEventDescriptor> & {
  tags?: readonly string[];
};

interface MutableRelationshipCounterpartState
  extends Omit<Mutable<ChatRelationshipCounterpartState>, 'vector' | 'callbackHints' | 'eventHistoryTail' | 'dominantAxes'> {
  vector: MutableRelationshipVector;
  callbackHints: ChatRelationshipCallbackHint[];
  eventHistoryTail: MutableRelationshipEventDescriptor[];
  dominantAxes: readonly ChatRelationshipAxisId[];
  touchCount: number;
  lastRoomId: string | null;
  lastSummary: string | null;
  lastEventType: ChatRelationshipEventType | null;
  lastResponseClass: ChatRelationshipResponseClass | null;
  witnessHeat01: number;
  rescueReadiness01: number;
  escalationRisk01: number;
  disciplineSignal01: number;
  greedSignal01: number;
  dealVolatility01: number;
  selectionScore01: number;
}

const HISTORY_LIMIT = 96;
const CALLBACK_LIMIT = 16;
const MAX_COUNTERPARTS = 128;
const MESSAGE_DEDUP_LIMIT = 256;
const CHANNEL_HEAT_DECAY = 0.965;
const ROOM_HEAT_DECAY = 0.972;
const QUIET_DORMANCY_MS = 1000 * 60 * 18;
const HARD_DORMANCY_MS = 1000 * 60 * 60 * 6;

export class ChatRelationshipModel {
  private readonly createdAt: UnixMs;
  private updatedAt: UnixMs;
  private playerId?: string | null;
  private totalEventCount = 0;
  private readonly maxCounterparts: number;
  private readonly historyLimit: number;
  private readonly callbackLimit: number;
  private readonly messageDedupLimit: number;
  private readonly counterparts = new Map<string, MutableRelationshipCounterpartState>();
  private readonly focusedCounterpartByChannel = new Map<string, string>();
  private readonly channelWitnessHeat = new Map<string, number>();
  private readonly roomWitnessHeat = new Map<string, number>();
  private readonly channelInteractionCounts = new Map<string, number>();
  private readonly roomInteractionCounts = new Map<string, number>();
  private readonly actorRoleCounts = new Map<string, number>();
  private readonly eventTypeCounts = new Map<ChatRelationshipEventType, number>();
  private readonly recentlySeenMessageIds: string[] = [];
  private readonly recentlySeenMessageIdSet = new Set<string>();

  public constructor(options: ChatRelationshipModelOptions = {}) {
    const now = options.now ?? (Date.now() as UnixMs);
    this.createdAt = now;
    this.updatedAt = now;
    this.playerId = options.playerId ?? null;
    this.maxCounterparts = clampCount(options.maxCounterparts, MAX_COUNTERPARTS);
    this.historyLimit = clampCount(options.historyLimit, HISTORY_LIMIT);
    this.callbackLimit = clampCount(options.callbackLimit, CALLBACK_LIMIT);
    this.messageDedupLimit = clampCount(options.messageDedupLimit, MESSAGE_DEDUP_LIMIT);
    if (options.snapshot) this.restore(options.snapshot);
  }

  public setPlayerId(playerId?: string | null): void {
    this.playerId = playerId ?? null;
  }

  public restore(snapshot: ChatRelationshipSnapshot): void {
    this.counterparts.clear();
    this.focusedCounterpartByChannel.clear();
    this.channelWitnessHeat.clear();
    this.roomWitnessHeat.clear();
    this.channelInteractionCounts.clear();
    this.roomInteractionCounts.clear();
    this.actorRoleCounts.clear();
    this.eventTypeCounts.clear();
    this.recentlySeenMessageIds.length = 0;
    this.recentlySeenMessageIdSet.clear();

    this.updatedAt = snapshot.updatedAt as UnixMs;
    this.playerId = snapshot.playerId ?? null;
    this.totalEventCount = snapshot.totalEventCount;

    for (const state of snapshot.counterparts) {
      const mutable = this.hydrateMutableState(state);
      this.counterparts.set(state.counterpartId, mutable);
      for (const event of state.eventHistoryTail) {
        this.recountEvent(event, mutable.counterpartId);
      }
    }

    for (const [channelId, counterpartId] of Object.entries(snapshot.focusedCounterpartByChannel)) {
      if (counterpartId) this.focusedCounterpartByChannel.set(channelId, counterpartId);
    }

    this.rebuildDerivedHeat();
    this.rebuildSelectionScores(snapshot.updatedAt as UnixMs);
  }

  public reset(now: UnixMs = Date.now() as UnixMs): void {
    this.counterparts.clear();
    this.focusedCounterpartByChannel.clear();
    this.channelWitnessHeat.clear();
    this.roomWitnessHeat.clear();
    this.channelInteractionCounts.clear();
    this.roomInteractionCounts.clear();
    this.actorRoleCounts.clear();
    this.eventTypeCounts.clear();
    this.recentlySeenMessageIds.length = 0;
    this.recentlySeenMessageIdSet.clear();
    this.totalEventCount = 0;
    this.updatedAt = now;
  }

  public snapshot(now: UnixMs = Date.now() as UnixMs): ChatRelationshipSnapshot {
    this.settle(now);
    return {
      createdAt: this.createdAt,
      updatedAt: now,
      playerId: this.playerId ?? null,
      counterparts: [...this.counterparts.values()]
        .sort((a, b) => Number(b.lastTouchedAt) - Number(a.lastTouchedAt) || a.counterpartId.localeCompare(b.counterpartId))
        .map((state) => this.toSnapshotState(state)),
      totalEventCount: this.totalEventCount,
      focusedCounterpartByChannel: Object.fromEntries(this.focusedCounterpartByChannel.entries()),
    };
  }

  public counterpartIds(): readonly string[] {
    return [...this.counterparts.keys()].sort();
  }

  public hasCounterpart(counterpartId: string): boolean {
    return this.counterparts.has(counterpartId);
  }

  public summaries(): readonly ChatRelationshipSummaryView[] {
    return [...this.counterparts.values()]
      .map((state) => ({
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
        legacy: this.projectLegacy(state.counterpartId),
      }))
      .sort((a, b) => b.intensity01 - a.intensity01 || a.counterpartId.localeCompare(b.counterpartId));
  }

  public getCounterpart(counterpartId: string): ChatRelationshipCounterpartState | null {
    const state = this.counterparts.get(counterpartId);
    return state ? this.cloneState(state) : null;
  }

  public getCounterpartDigest(counterpartId: string): ChatRelationshipCounterpartDigest | null {
    const state = this.counterparts.get(counterpartId);
    return state ? this.buildDigest(state) : null;
  }

  public topCounterparts(limit = 12): readonly ChatRelationshipCounterpartDigest[] {
    return [...this.counterparts.values()]
      .sort((a, b) => b.selectionScore01 - a.selectionScore01 || Number(b.lastTouchedAt) - Number(a.lastTouchedAt))
      .slice(0, Math.max(1, limit))
      .map((state) => this.buildDigest(state));
  }

  public getFocusSnapshot(): ChatRelationshipFocusSnapshot {
    return {
      focusedCounterpartByChannel: Object.fromEntries(this.focusedCounterpartByChannel.entries()),
      rankedCounterpartIds: [...this.counterparts.values()]
        .sort((a, b) => b.selectionScore01 - a.selectionScore01 || Number(b.lastTouchedAt) - Number(a.lastTouchedAt))
        .map((state) => state.counterpartId),
    };
  }

  public getChannelHeat(channelId?: string | null): readonly ChatRelationshipChannelHeat[] | ChatRelationshipChannelHeat | null {
    const rows = this.buildChannelHeatRows();
    if (channelId == null) return rows;
    return rows.find((row) => row.channelId === channelId) ?? null;
  }

  public getRoomHeat(roomId?: string | null): readonly ChatRelationshipRoomHeat[] | ChatRelationshipRoomHeat | null {
    const rows = this.buildRoomHeatRows();
    if (roomId == null) return rows;
    return rows.find((row) => row.roomId === roomId) ?? null;
  }

  public getDiagnostics(limit = 12): ChatRelationshipDiagnostics {
    return {
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      playerId: this.playerId ?? null,
      counterpartCount: this.counterparts.size,
      totalEventCount: this.totalEventCount,
      eventTypeCounts: Object.fromEntries(this.eventTypeCounts.entries()) as Readonly<Record<ChatRelationshipEventType, number>>,
      actorRoleCounts: Object.fromEntries(this.actorRoleCounts.entries()),
      channelInteractionCounts: Object.fromEntries(this.channelInteractionCounts.entries()),
      roomInteractionCounts: Object.fromEntries(this.roomInteractionCounts.entries()),
      topCounterparts: this.topCounterparts(limit),
      channelHeat: this.buildChannelHeatRows(),
      roomHeat: this.buildRoomHeatRows(),
      focus: this.getFocusSnapshot(),
    };
  }

  public queryEvents(query: ChatRelationshipEventQuery = {}): readonly ChatRelationshipEventDescriptor[] {
    const events = new Map<string, ChatRelationshipEventDescriptor>();
    const counterparts = query.counterpartId
      ? [this.counterparts.get(query.counterpartId)].filter(Boolean) as MutableRelationshipCounterpartState[]
      : [...this.counterparts.values()];

    for (const state of counterparts) {
      for (const event of state.eventHistoryTail) {
        if (matchesEventQuery(event, query)) {
          events.set(event.eventId, event);
        }
      }
    }

    return [...events.values()]
      .sort((a, b) => Number(b.createdAt) - Number(a.createdAt) || a.eventId.localeCompare(b.eventId))
      .slice(0, Math.max(1, query.limit ?? 64));
  }

  public primeCounterpart(options: {
    readonly counterpartId: string;
    readonly counterpartKind?: ChatRelationshipCounterpartKind;
    readonly botId?: BotId | string | null;
    readonly actorRole?: string | null;
    readonly channelId?: string | null;
    readonly roomId?: string | null;
    readonly tags?: readonly string[];
    readonly now?: UnixMs;
  }): ChatRelationshipCounterpartState {
    const now = options.now ?? (Date.now() as UnixMs);
    const state = this.ensureCounterpart(
      options.counterpartId,
      options.counterpartKind ?? kindFromActorRole(options.actorRole),
      now,
      options.botId ?? null,
      options.actorRole ?? null,
    );

    if (options.channelId) {
      state.lastChannelId = options.channelId;
      this.focusedCounterpartByChannel.set(options.channelId, options.counterpartId);
      incrementMap(this.channelInteractionCounts, options.channelId, 1);
    }
    if (options.roomId) {
      state.lastRoomId = options.roomId;
      incrementMap(this.roomInteractionCounts, options.roomId, 1);
    }
    if (options.tags?.length) {
      const delta = blankDelta();
      applyTagDelta(delta, options.tags);
      this.applyDelta(state, delta, now, 0.42);
      this.recomputeState(state, now);
    }

    this.updatedAt = now;
    return this.cloneState(state);
  }

  public forgetCounterpart(counterpartId: string): boolean {
    const removed = this.counterparts.delete(counterpartId);
    if (!removed) return false;

    for (const [channelId, focusedId] of [...this.focusedCounterpartByChannel.entries()]) {
      if (focusedId === counterpartId) this.focusedCounterpartByChannel.delete(channelId);
    }
    this.rebuildDerivedHeat();
    this.rebuildSelectionScores(this.updatedAt);
    return true;
  }

  public selectCounterpartFocus(channelId?: string | null, candidateIds?: readonly string[]): string | undefined {
    if (channelId && this.focusedCounterpartByChannel.has(channelId)) {
      const focused = this.focusedCounterpartByChannel.get(channelId);
      if (!candidateIds?.length || (focused && candidateIds.includes(focused))) return focused;
    }

    const candidates = candidateIds?.length
      ? candidateIds.map((id) => this.counterparts.get(id)).filter(Boolean) as MutableRelationshipCounterpartState[]
      : [...this.counterparts.values()];

    if (!candidates.length) return undefined;

    const selected = [...candidates].sort((a, b) => {
      const scoreA = this.computeFocusScore(a, channelId ?? null);
      const scoreB = this.computeFocusScore(b, channelId ?? null);
      return scoreB - scoreA || Number(b.lastTouchedAt) - Number(a.lastTouchedAt);
    })[0];

    if (channelId) this.focusedCounterpartByChannel.set(channelId, selected.counterpartId);
    return selected.counterpartId;
  }

  public notePlayerMessage(input: ChatRelationshipPlayerMessageInput): void {
    const now = input.createdAt ?? input.featureSnapshot?.createdAt ?? (Date.now() as UnixMs);
    const counterpartId = input.counterpartId ?? this.selectCounterpartFocus(input.channelId ?? undefined) ?? 'room:general';
    const state = this.ensureCounterpart(counterpartId, input.counterpartKind ?? 'NPC', now, input.botId ?? null, 'PLAYER_TARGET');

    const body = String(input.body ?? '').trim();
    const normalized = body.toLowerCase();
    const responseClass = normalizeResponseClass(input.responseClass ?? inferResponseClass(body, input.tags));
    const pressureBand = input.pressureBand ?? derivePressureBandFromBody(body, input.channelId);
    const eventType = mapResponseClassToEventType(responseClass, normalized, input.channelId);
    const tags = new Set((input.tags ?? []).map((tag) => String(tag).toLowerCase()));
    const delta = blankDelta();

    applyResponseClassDelta(delta, responseClass);
    applyTagDelta(delta, tags);
    applyNarrativeCueDelta(delta, normalized, input.channelId);

    const disciplineBoost = scoreDisciplineSignal(normalized, tags);
    const greedBoost = scoreGreedSignal(normalized, tags, input.channelId);
    const fearBoost = scoreFearSignal(normalized, pressureBand);
    const publicWitness01 = scorePublicWitness(input.channelId, input.roomId, responseClass, pressureBand);
    const intensity01 = scoreBodyIntensity(body, responseClass, pressureBand);

    if (disciplineBoost > 0) {
      delta.predictiveConfidence01 -= 0.025;
      delta.respect01 += disciplineBoost * 0.22;
      delta.patience01 += disciplineBoost * 0.20;
      delta.unfinishedBusiness01 += disciplineBoost * 0.08;
    }
    if (greedBoost > 0) {
      delta.contempt01 += greedBoost * 0.18;
      delta.fear01 += greedBoost * 0.10;
      delta.predictiveConfidence01 += greedBoost * 0.18;
      delta.unfinishedBusiness01 += greedBoost * 0.12;
    }
    if (fearBoost > 0) {
      delta.predictiveConfidence01 += fearBoost * 0.14;
      delta.fear01 += fearBoost * 0.18;
      delta.respect01 -= fearBoost * 0.06;
    }

    this.applyDelta(state, delta, now, 0.85);
    state.disciplineSignal01 = weightedBlend(state.disciplineSignal01, disciplineBoost, 0.42);
    state.greedSignal01 = weightedBlend(state.greedSignal01, greedBoost, 0.46);
    state.witnessHeat01 = weightedBlend(state.witnessHeat01, publicWitness01 * intensity01, 0.38);

    const event = this.createEventDescriptor({
      counterpartId,
      counterpartKind: state.counterpartKind,
      playerId: this.playerId ?? null,
      botId: state.botId ?? null,
      actorRole: 'PLAYER_TARGET',
      channelId: input.channelId ?? null,
      roomId: input.roomId ?? null,
      sourceMessageId: input.messageId ?? null,
      pressureBand,
      publicWitness01,
      intensity01,
      summary: body || responseClass,
      rawText: body || null,
      tags: [...tags, responseClass.toLowerCase()],
      eventType,
      createdAt: now,
    });

    this.recordEvent(state, event);
    if (disciplineBoost >= 0.54 && eventType !== 'PLAYER_DISCIPLINE') {
      this.recordEvent(state, this.createSyntheticEchoEvent(event, 'PLAYER_DISCIPLINE', now, 'Discipline pattern inferred'));
    }
    if (greedBoost >= 0.58 && eventType !== 'PLAYER_GREED') {
      this.recordEvent(state, this.createSyntheticEchoEvent(event, 'PLAYER_GREED', now, 'Greed pattern inferred'));
    }

    if (responseClass === 'QUESTION' || normalized.includes('remember') || normalized.includes('last time')) {
      this.addCallbackHint(state, {
        callbackId: randomId('rel_cb', counterpartId, now),
        label: responseClass === 'QUESTION' ? 'Open loop created' : 'Callback seeded',
        text: truncateSentence(body, 120),
        weight01: clamp01(0.46 + intensity01 * 0.20 + disciplineBoost * 0.12),
      });
    }

    if (input.channelId) {
      state.lastChannelId = String(input.channelId);
      this.focusedCounterpartByChannel.set(String(input.channelId), counterpartId);
    }
    if (input.roomId) state.lastRoomId = String(input.roomId);

    state.lastSummary = truncateSentence(body || responseClass, 180);
    state.lastEventType = eventType;
    state.lastResponseClass = responseClass;
    this.recomputeState(state, now);
    this.ingestExternalities(state, event);
    this.updatedAt = now;
  }

  public noteAuthoritativeMessage(message: ChatMessage, options: ChatRelationshipAuthoritativeMessageOptions = {}): void {
    const messageId = String(message.id);
    if (this.hasSeenMessage(messageId)) return;
    this.rememberMessageId(messageId);

    const body = normalizeSentence(stringifyMessageBody(message));
    const roomId = options.roomId ?? String(message.roomId);
    const channelId = String(message.channelId);
    const responseClass = normalizeResponseClass(options.responseClass ?? inferMessageResponseClass(message));
    const pressureBand = options.pressureBand ?? derivePressureBandFromMessage(message);
    const counterpartId = options.counterpartId ?? inferCounterpartIdFromMessage(message, channelId);
    const counterpartKind = options.counterpartKind ?? inferCounterpartKindFromMessage(message);
    const actorRole = options.actorRole ?? inferActorRoleFromMessage(message);
    const tags = new Set<string>([
      ...message.tags.map((tag) => String(tag).toLowerCase()),
      ...(options.extraTags ?? []).map((tag) => String(tag).toLowerCase()),
      ...extractStringArrayMetadata(message.metadata, 'relationshipTags'),
    ]);

    if (message.attribution.sourceType === 'PLAYER') {
      this.notePlayerMessage({
        counterpartId,
        counterpartKind,
        botId: message.attribution.botId,
        channelId,
        roomId,
        messageId,
        body,
        responseClass,
        pressureBand,
        tags: [...tags],
        createdAt: message.createdAt,
      });
      return;
    }

    const severity = pressureBandToSeverity(pressureBand);
    this.noteNpcUtterance({
      counterpartId,
      counterpartKind,
      botId: message.attribution.botId,
      actorRole,
      channelId,
      roomId,
      context: inferNpcContextFromMessage(message),
      severity,
      body,
      emittedAt: message.createdAt,
      tags: [...tags],
    });

    const state = this.counterparts.get(counterpartId);
    if (!state) return;

    const latest = state.eventHistoryTail[0];
    if (!latest) return;

    if (options.trustReplayMetadata !== false) {
      const replayTags = extractReplayAndProofTags(message);
      if (replayTags.length) {
        latest.tags = [...new Set([...(latest.tags ?? []), ...replayTags])];
      }
    }

    if (message.replay.sceneId) latest.sceneId = String(message.replay.sceneId);
    if (options.sceneId) latest.sceneId = options.sceneId;
    if (options.sourcePlanId) latest.sourcePlanId = options.sourcePlanId;
    latest.roomId = roomId;
    latest.sourceMessageId = messageId;
    latest.summary = truncateSentence(body || latest.summary || message.attribution.displayName, 180);
    latest.rawText = body || latest.rawText || null;

    if (message.attribution.sourceType === 'NPC_HELPER') {
      state.rescueReadiness01 = weightedBlend(state.rescueReadiness01, 0.82, 0.24);
    } else if (message.attribution.sourceType === 'NPC_HATER') {
      state.escalationRisk01 = weightedBlend(state.escalationRisk01, 0.84, 0.28);
    }

    this.recomputeState(state, message.createdAt);
  }

  public noteAuthoritativeMessages(messages: readonly ChatMessage[], options: ChatRelationshipAuthoritativeMessageOptions = {}): void {
    for (const message of messages) this.noteAuthoritativeMessage(message, options);
  }

  public noteNpcUtterance(input: ChatRelationshipNpcUtteranceInput): void {
    const now = input.emittedAt ?? (Date.now() as UnixMs);
    const state = this.ensureCounterpart(
      input.counterpartId,
      input.counterpartKind ?? kindFromActorRole(input.actorRole),
      now,
      input.botId ?? null,
      input.actorRole ?? null,
    );

    const severity = input.severity ?? 'MEDIUM';
    const lower = String(input.body ?? '').toLowerCase();
    const tags = new Set((input.tags ?? []).map((tag) => String(tag).toLowerCase()));
    const delta = blankDelta();

    applyNpcSeverityDelta(delta, severity);
    applyRoleDelta(delta, input.actorRole);
    applyTagDelta(delta, tags);
    applyNarrativeCueDelta(delta, lower, input.channelId);

    const publicWitness01 = scorePublicWitness(input.channelId, input.roomId, 'WITNESS', severityToPressureBand(severity));
    const intensity01 = scoreNpcIntensity(input.body, severity, input.actorRole, input.channelId);

    if (lower.includes('remember') || lower.includes('again') || lower.includes('last time') || lower.includes('as always')) {
      delta.obsession01 += 0.05;
      delta.familiarity01 += 0.05;
      this.addCallbackHint(state, {
        callbackId: randomId('rel_cb', input.counterpartId, now),
        label: 'Callback seeded',
        text: truncateSentence(input.body, 120),
        weight01: clamp01(0.58 + intensity01 * 0.12),
      });
    }

    if (lower.includes('breathe') || lower.includes('steady') || lower.includes('keep the sequence')) {
      state.rescueReadiness01 = weightedBlend(state.rescueReadiness01, 0.86, 0.22);
    }
    if (lower.includes('watch') || lower.includes('everyone') || lower.includes('room')) {
      state.witnessHeat01 = weightedBlend(state.witnessHeat01, publicWitness01, 0.26);
    }

    this.applyDelta(state, delta, now, 0.75);
    const eventType = eventTypeFromNpcRole(input.actorRole, lower);
    const event = this.createEventDescriptor({
      counterpartId: input.counterpartId,
      counterpartKind: state.counterpartKind,
      playerId: this.playerId ?? null,
      botId: state.botId ?? null,
      actorRole: input.actorRole ?? null,
      channelId: input.channelId ?? null,
      roomId: input.roomId ?? null,
      pressureBand: severityToPressureBand(severity),
      publicWitness01,
      intensity01,
      summary: truncateSentence(input.body, 160),
      rawText: input.body,
      tags: [...new Set([String(input.actorRole ?? 'NPC').toLowerCase(), String(input.context ?? 'utterance').toLowerCase(), ...tags])],
      eventType,
      createdAt: now,
    });

    this.recordEvent(state, event);

    if (input.channelId) {
      state.lastChannelId = String(input.channelId);
      this.focusedCounterpartByChannel.set(String(input.channelId), input.counterpartId);
    }
    if (input.roomId) state.lastRoomId = String(input.roomId);
    state.lastSummary = truncateSentence(input.body, 180);
    state.lastEventType = eventType;
    state.lastResponseClass = 'WITNESS';

    this.recomputeState(state, now);
    this.ingestExternalities(state, event);
    this.updatedAt = now;
  }

  public noteGameEvent(input: ChatRelationshipGameEventInput): void {
    const now = input.createdAt ?? (Date.now() as UnixMs);
    const eventType = mapGameEventToRelationshipEvent(input.eventType);
    const counterpartId = input.counterpartId ?? this.selectCounterpartFocus(input.channelId ?? undefined) ?? 'room:general';
    const state = this.ensureCounterpart(counterpartId, input.counterpartKind ?? 'NPC', now, input.botId ?? null, 'EVENT');
    const tags = new Set((input.tags ?? []).map((tag) => String(tag).toLowerCase()));

    const delta = deltaForGameEvent(eventType);
    applyTagDelta(delta, tags);
    const publicWitness01 = scorePublicWitness(input.channelId, input.roomId, 'WITNESS', input.pressureBand ?? inferPressureBandFromEventType(eventType));
    const intensity01 = clamp01(0.40 + (eventType === 'PLAYER_COMEBACK' || eventType === 'PLAYER_COLLAPSE' ? 0.22 : 0.08));

    if (eventType === 'PLAYER_COMEBACK') {
      state.disciplineSignal01 = weightedBlend(state.disciplineSignal01, 0.66, 0.16);
    }
    if (eventType === 'PLAYER_FAILED_GAMBLE') {
      state.greedSignal01 = weightedBlend(state.greedSignal01, 0.72, 0.18);
    }
    if (eventType === 'PLAYER_COLLAPSE') {
      state.rescueReadiness01 = weightedBlend(state.rescueReadiness01, 0.78, 0.24);
      state.escalationRisk01 = weightedBlend(state.escalationRisk01, 0.74, 0.20);
    }

    this.applyDelta(state, delta, now, 0.90);
    const event = this.createEventDescriptor({
      counterpartId,
      counterpartKind: state.counterpartKind,
      playerId: this.playerId ?? null,
      botId: state.botId ?? null,
      actorRole: 'EVENT',
      channelId: input.channelId ?? null,
      roomId: input.roomId ?? null,
      sourceMessageId: input.sourceMessageId ?? null,
      sourcePlanId: input.sourcePlanId ?? null,
      sceneId: input.sceneId ?? null,
      pressureBand: input.pressureBand,
      publicWitness01,
      intensity01,
      summary: input.summary ?? humanizeEventType(eventType),
      rawText: input.summary ?? null,
      tags: [...tags],
      eventType,
      createdAt: now,
    });

    this.recordEvent(state, event);
    if (input.channelId) {
      state.lastChannelId = String(input.channelId);
      this.focusedCounterpartByChannel.set(String(input.channelId), counterpartId);
    }
    if (input.roomId) state.lastRoomId = String(input.roomId);
    state.lastSummary = truncateSentence(input.summary ?? humanizeEventType(eventType), 180);
    state.lastEventType = eventType;

    this.recomputeState(state, now);
    this.ingestExternalities(state, event);
    this.updatedAt = now;
  }

  public buildNpcSignal(request: ChatRelationshipSignalRequest): ChatRelationshipNpcSignal {
    const now = request.now ?? (Date.now() as UnixMs);
    const state = this.ensureCounterpart(
      request.counterpartId,
      request.counterpartKind ?? kindFromActorRole(request.actorRole),
      now,
      request.botId ?? null,
      request.actorRole ?? null,
    );

    if (request.channelId) {
      state.lastChannelId = request.channelId;
      this.focusedCounterpartByChannel.set(request.channelId, request.counterpartId);
    }
    if (request.roomId) state.lastRoomId = request.roomId;

    const publicBias = clamp01(
      (request.publicWitness01 ?? scorePublicWitness(request.channelId, request.roomId, 'WITNESS', request.pressureBand)) * 0.44 +
      state.publicPressureBias01 * 0.34 +
      state.witnessHeat01 * 0.22,
    );
    const privateBias = clamp01(1 - publicBias * 0.72);
    const intensity = clamp01(
      state.intensity01 * 0.52 +
      state.vector.unfinishedBusiness01 * 0.11 +
      state.vector.obsession01 * 0.10 +
      state.vector.predictiveConfidence01 * 0.08 +
      state.witnessHeat01 * 0.10 +
      state.escalationRisk01 * 0.09,
    );
    const volatility = clamp01(
      state.volatility01 * 0.54 +
      state.vector.fear01 * 0.09 +
      state.vector.contempt01 * 0.09 +
      state.greedSignal01 * 0.08 +
      state.dealVolatility01 * 0.10 +
      (request.pressureBand === 'CRITICAL' ? 0.10 : request.pressureBand === 'HIGH' ? 0.06 : 0.02),
    );

    const selectionWeight = clamp01(
      state.selectionScore01 * 0.54 +
      state.intensity01 * 0.10 +
      state.vector.obsession01 * 0.08 +
      state.vector.unfinishedBusiness01 * 0.08 +
      state.vector.predictiveConfidence01 * 0.05 +
      state.rescueReadiness01 * (isHelperRole(request.actorRole) ? 0.10 : 0.03) +
      state.escalationRisk01 * (isHaterRole(request.actorRole) ? 0.10 : 0.03) +
      publicBias * (isHaterRole(request.actorRole) ? 0.08 : 0.03),
    );

    const notes: string[] = [];
    if (state.vector.obsession01 >= 0.72) notes.push('obsession_high');
    if (state.vector.unfinishedBusiness01 >= 0.65) notes.push('unfinished_business_high');
    if (state.vector.predictiveConfidence01 >= 0.68) notes.push('predictive_confidence_high');
    if (state.vector.respect01 >= 0.62) notes.push('respect_present');
    if (state.vector.contempt01 >= 0.62) notes.push('contempt_present');
    if (publicBias >= 0.60) notes.push('public_pressure_bias');
    if (state.rescueReadiness01 >= 0.64) notes.push('rescue_ready');
    if (state.escalationRisk01 >= 0.66) notes.push('escalation_risk_high');
    if (state.disciplineSignal01 >= 0.60) notes.push('discipline_detected');
    if (state.greedSignal01 >= 0.60) notes.push('greed_detected');

    return {
      counterpartId: state.counterpartId,
      stance: state.stance,
      objective: state.objective,
      intensity01: intensity,
      volatility01: volatility,
      selectionWeight01: selectionWeight,
      publicPressureBias01: publicBias,
      privatePressureBias01: privateBias,
      predictiveConfidence01: state.vector.predictiveConfidence01,
      obsession01: state.vector.obsession01,
      unfinishedBusiness01: state.vector.unfinishedBusiness01,
      respect01: state.vector.respect01,
      fear01: state.vector.fear01,
      contempt01: state.vector.contempt01,
      familiarity01: state.vector.familiarity01,
      callbackHint: state.callbackHints[0],
      notes,
    };
  }

  public realizeNpcLine(
    baseLine: string,
    signal: ChatRelationshipNpcSignal,
    options: {
      readonly actorRole?: string | null;
      readonly context?: string | null;
      readonly channelId?: string | null;
      readonly roomId?: string | null;
      readonly pressureBand?: ChatRelationshipPressureBand;
    } = {},
  ): string {
    let line = String(baseLine ?? '').trim();
    if (!line) return line;

    const lower = line.toLowerCase();
    if (signal.callbackHint && !lower.includes('again') && !lower.includes('remember') && signal.unfinishedBusiness01 >= 0.68) {
      line = `${line} ${callbackTail(signal, options.actorRole)}`.trim();
    }

    if (signal.stance === 'RESPECTFUL' && isHaterRole(options.actorRole)) {
      line = softenForRespect(line);
    } else if (signal.stance === 'PREDATORY' || signal.stance === 'HUNTING') {
      line = sharpenForPressure(line, signal.publicPressureBias01 >= 0.60);
    } else if (signal.stance === 'OBSESSED') {
      line = makeObsessive(line);
    } else if (signal.stance === 'PROTECTIVE') {
      line = stabilizeHelperLine(line);
    } else if (signal.stance === 'CLINICAL') {
      line = makeClinical(line);
    } else if (signal.stance === 'WOUNDED') {
      line = makeWounded(line);
    }

    if (signal.objective === 'REPRICE' && !/price|floor|cost|value/i.test(line)) {
      line = `${line} The cost of this round is already changing.`;
    }
    if (signal.objective === 'DELAY' && !/wait|review|queue|later/i.test(line)) {
      line = `${line} Delay is part of the mechanism now.`;
    }
    if (signal.objective === 'RESCUE' && !/breathe|steady|sequence|clean/i.test(line)) {
      line = `${line} Take the clean sequence next.`;
    }
    if (signal.objective === 'CONTAIN' && !/contain|small|tight|narrow/i.test(line)) {
      line = `${line} Keep this lane tight.`;
    }
    if (options.context && /deal|offer|counter/i.test(options.context) && !/offer|terms|price/i.test(line)) {
      line = `${line} State your terms cleanly.`;
    }

    return normalizeSentence(line);
  }

  public settle(now: UnixMs = Date.now() as UnixMs): void {
    const prunable: string[] = [];

    for (const state of this.counterparts.values()) {
      this.applyDormancyDecay(state, now);
      this.recomputeState(state, now, false);
      if (Number(now) - Number(state.lastTouchedAt) >= HARD_DORMANCY_MS && state.intensity01 < 0.12 && state.callbackHints.length === 0) {
        prunable.push(state.counterpartId);
      }
    }

    for (const counterpartId of prunable) this.counterparts.delete(counterpartId);

    for (const [channelId, value] of [...this.channelWitnessHeat.entries()]) {
      const next = clamp01(value * CHANNEL_HEAT_DECAY);
      if (next <= 0.01) this.channelWitnessHeat.delete(channelId);
      else this.channelWitnessHeat.set(channelId, next);
    }
    for (const [roomId, value] of [...this.roomWitnessHeat.entries()]) {
      const next = clamp01(value * ROOM_HEAT_DECAY);
      if (next <= 0.01) this.roomWitnessHeat.delete(roomId);
      else this.roomWitnessHeat.set(roomId, next);
    }

    this.rebuildSelectionScores(now);
    this.updatedAt = now;
  }

  public projectLegacy(counterpartId: string): ChatRelationshipLegacyProjection {
    const state = this.counterparts.get(counterpartId) ?? this.ensureCounterpart(counterpartId, 'NPC', Date.now() as UnixMs, null, null);
    const trust = clamp01(state.vector.respect01 * 0.34 + state.vector.familiarity01 * 0.24 + state.vector.patience01 * 0.22 + (1 - state.vector.contempt01) * 0.20);
    const rivalry = clamp01(state.vector.unfinishedBusiness01 * 0.34 + state.vector.obsession01 * 0.18 + state.vector.contempt01 * 0.22 + state.vector.fear01 * 0.10 + state.escalationRisk01 * 0.16);
    const rescueDebt = clamp01(state.vector.traumaDebt01 * 0.56 + state.vector.respect01 * 0.12 + state.vector.familiarity01 * 0.10 + state.rescueReadiness01 * 0.22);
    const adviceObedience = clamp01(state.vector.patience01 * 0.40 + state.vector.respect01 * 0.18 + (1 - state.vector.contempt01) * 0.12 + state.vector.familiarity01 * 0.12 + state.disciplineSignal01 * 0.18);

    return {
      counterpartId,
      respect: Math.round(state.vector.respect01 * 100),
      fear: Math.round(state.vector.fear01 * 100),
      contempt: Math.round(state.vector.contempt01 * 100),
      fascination: Math.round(state.vector.fascination01 * 100),
      trust: Math.round(trust * 100),
      familiarity: Math.round(state.vector.familiarity01 * 100),
      rivalryIntensity: Math.round(rivalry * 100),
      rescueDebt: Math.round(rescueDebt * 100),
      adviceObedience: Math.round(adviceObedience * 100),
      escalationTier: rivalry >= 0.82 || state.vector.obsession01 >= 0.82
        ? 'OBSESSIVE'
        : rivalry >= 0.60 || state.intensity01 >= 0.72
          ? 'ACTIVE'
          : rivalry >= 0.34
            ? 'MILD'
            : 'NONE',
    };
  }

  private ensureCounterpart(
    counterpartId: string,
    counterpartKind: ChatRelationshipCounterpartKind,
    now: UnixMs,
    botId?: BotId | string | null,
    actorRole?: string | null,
  ): MutableRelationshipCounterpartState {
    const existing = this.counterparts.get(counterpartId);
    if (existing) {
      if (botId != null) existing.botId = String(botId);
      if (actorRole != null) existing.actorRole = String(actorRole);
      existing.touchCount += 1;
      return existing;
    }

    if (this.counterparts.size >= this.maxCounterparts) {
      const oldest = [...this.counterparts.values()].sort((a, b) => Number(a.lastTouchedAt) - Number(b.lastTouchedAt))[0];
      if (oldest) this.counterparts.delete(oldest.counterpartId);
    }

    const initialVector = seedVectorForCounterpartKind(counterpartKind);
    const created: MutableRelationshipCounterpartState = {
      counterpartId,
      counterpartKind,
      playerId: this.playerId ?? null,
      botId: botId != null ? String(botId) : null,
      actorRole: actorRole != null ? String(actorRole) : null,
      lastChannelId: null,
      vector: initialVector,
      stance: counterpartKind === 'HELPER' ? 'PROTECTIVE' : counterpartKind === 'ARCHIVIST' ? 'CURIOUS' : 'PROBING',
      objective: counterpartKind === 'HELPER' ? 'RESCUE' : counterpartKind === 'ARCHIVIST' ? 'WITNESS' : 'STUDY',
      intensity01: 0.18,
      volatility01: 0.14,
      publicPressureBias01: 0.52,
      privatePressureBias01: 0.48,
      callbackHints: [],
      eventHistoryTail: [],
      dominantAxes: dominantAxes(initialVector),
      lastTouchedAt: now,
      touchCount: 1,
      lastRoomId: null,
      lastSummary: null,
      lastEventType: null,
      lastResponseClass: null,
      witnessHeat01: kindToWitnessSeed(counterpartKind),
      rescueReadiness01: counterpartKind === 'HELPER' ? 0.44 : 0.08,
      escalationRisk01: counterpartKind === 'BOT' || counterpartKind === 'RIVAL' ? 0.34 : 0.08,
      disciplineSignal01: 0.18,
      greedSignal01: 0.14,
      dealVolatility01: 0.12,
      selectionScore01: 0.18,
    };

    this.counterparts.set(counterpartId, created);
    return created;
  }

  private hydrateMutableState(state: ChatRelationshipCounterpartState): MutableRelationshipCounterpartState {
    const latestEvent = state.eventHistoryTail[0] ?? null;
    return {
      ...state,
      vector: { ...state.vector },
      callbackHints: [...state.callbackHints],
      eventHistoryTail: [...state.eventHistoryTail],
      dominantAxes: [...state.dominantAxes],
      touchCount: Math.max(1, state.eventHistoryTail.length),
      lastRoomId: latestEvent?.roomId ?? null,
      lastSummary: latestEvent?.summary ?? null,
      lastEventType: latestEvent?.eventType ?? null,
      lastResponseClass: inferResponseClass(latestEvent?.rawText ?? latestEvent?.summary ?? ''),
      witnessHeat01: clamp01((latestEvent?.publicWitness01 ?? 0.10) * 0.50 + state.intensity01 * 0.16),
      rescueReadiness01: clamp01(state.counterpartKind === 'HELPER' ? 0.34 + state.vector.traumaDebt01 * 0.28 + state.vector.respect01 * 0.14 : state.vector.traumaDebt01 * 0.18),
      escalationRisk01: clamp01(state.vector.contempt01 * 0.28 + state.vector.fear01 * 0.16 + state.vector.unfinishedBusiness01 * 0.22),
      disciplineSignal01: clamp01(state.vector.patience01 * 0.34 + state.vector.respect01 * 0.18),
      greedSignal01: clamp01(state.vector.contempt01 * 0.16 + state.vector.predictiveConfidence01 * 0.22),
      dealVolatility01: clamp01(state.vector.fear01 * 0.18 + state.vector.unfinishedBusiness01 * 0.18),
      selectionScore01: clamp01(state.intensity01 * 0.40 + state.vector.obsession01 * 0.18 + state.vector.unfinishedBusiness01 * 0.18 + state.vector.predictiveConfidence01 * 0.10),
    };
  }

  private toSnapshotState(state: MutableRelationshipCounterpartState): ChatRelationshipCounterpartState {
    return {
      counterpartId: state.counterpartId,
      counterpartKind: state.counterpartKind,
      playerId: state.playerId ?? null,
      botId: state.botId ?? null,
      actorRole: state.actorRole ?? null,
      lastChannelId: state.lastChannelId ?? null,
      vector: { ...state.vector },
      stance: state.stance,
      objective: state.objective,
      intensity01: state.intensity01,
      volatility01: state.volatility01,
      publicPressureBias01: state.publicPressureBias01,
      privatePressureBias01: state.privatePressureBias01,
      callbackHints: [...state.callbackHints],
      eventHistoryTail: [...state.eventHistoryTail],
      dominantAxes: [...state.dominantAxes],
      lastTouchedAt: state.lastTouchedAt,
    };
  }

  private applyDelta(state: MutableRelationshipCounterpartState, delta: Partial<ChatRelationshipVector>, now: UnixMs, weight: number): void {
    const vector = { ...state.vector } as { -readonly [K in keyof ChatRelationshipVector]: number };
    vector.contempt01 = weightedBlend(vector.contempt01, delta.contempt01 ?? 0, weight);
    vector.fascination01 = weightedBlend(vector.fascination01, delta.fascination01 ?? 0, weight);
    vector.respect01 = weightedBlend(vector.respect01, delta.respect01 ?? 0, weight);
    vector.fear01 = weightedBlend(vector.fear01, delta.fear01 ?? 0, weight);
    vector.obsession01 = weightedBlend(vector.obsession01, delta.obsession01 ?? 0, weight);
    vector.patience01 = weightedBlend(vector.patience01, delta.patience01 ?? 0, weight);
    vector.familiarity01 = weightedBlend(vector.familiarity01, delta.familiarity01 ?? 0, weight);
    vector.predictiveConfidence01 = weightedBlend(vector.predictiveConfidence01, delta.predictiveConfidence01 ?? 0, weight);
    vector.traumaDebt01 = weightedBlend(vector.traumaDebt01, delta.traumaDebt01 ?? 0, weight);
    vector.unfinishedBusiness01 = weightedBlend(vector.unfinishedBusiness01, delta.unfinishedBusiness01 ?? 0, weight);
    state.vector = vector;
    state.lastTouchedAt = now;
  }

  private recordEvent(state: MutableRelationshipCounterpartState, event: MutableRelationshipEventDescriptor): void {
    state.eventHistoryTail.unshift(event);
    if (state.eventHistoryTail.length > this.historyLimit) state.eventHistoryTail.length = this.historyLimit;
    this.totalEventCount += 1;
    state.touchCount += 1;
    state.lastTouchedAt = event.createdAt as UnixMs;
    state.lastSummary = event.summary ?? state.lastSummary;
    state.lastEventType = event.eventType;
    incrementMap(this.eventTypeCounts, event.eventType, 1);
    if (event.channelId) incrementMap(this.channelInteractionCounts, event.channelId, 1);
    if (event.roomId) incrementMap(this.roomInteractionCounts, event.roomId, 1);
    if (event.actorRole) incrementMap(this.actorRoleCounts, event.actorRole, 1);
  }

  private recountEvent(event: MutableRelationshipEventDescriptor | ChatRelationshipEventDescriptor, counterpartId: string): void {
    incrementMap(this.eventTypeCounts, event.eventType, 1);
    if (event.channelId) incrementMap(this.channelInteractionCounts, event.channelId, 1);
    if (event.roomId) incrementMap(this.roomInteractionCounts, event.roomId, 1);
    if (event.actorRole) incrementMap(this.actorRoleCounts, event.actorRole, 1);

    if (event.channelId) {
      const existing = this.channelWitnessHeat.get(event.channelId) ?? 0;
      this.channelWitnessHeat.set(event.channelId, clamp01(existing + (event.publicWitness01 ?? 0.08) * 0.12));
    }
    if (event.roomId) {
      const existing = this.roomWitnessHeat.get(event.roomId) ?? 0;
      this.roomWitnessHeat.set(event.roomId, clamp01(existing + (event.publicWitness01 ?? 0.08) * 0.10));
    }

    if (!this.counterparts.has(counterpartId) && event.channelId) {
      this.focusedCounterpartByChannel.set(event.channelId, counterpartId);
    }
  }

  private ingestExternalities(state: MutableRelationshipCounterpartState, event: MutableRelationshipEventDescriptor | ChatRelationshipEventDescriptor): void {
    if (event.channelId) {
      const next = clamp01((this.channelWitnessHeat.get(event.channelId) ?? 0) * CHANNEL_HEAT_DECAY + (event.publicWitness01 ?? 0.10) * 0.40 + (event.intensity01 ?? 0.20) * 0.10);
      this.channelWitnessHeat.set(event.channelId, next);
      this.focusedCounterpartByChannel.set(event.channelId, state.counterpartId);
    }
    if (event.roomId) {
      const next = clamp01((this.roomWitnessHeat.get(event.roomId) ?? 0) * ROOM_HEAT_DECAY + (event.publicWitness01 ?? 0.08) * 0.32 + (event.intensity01 ?? 0.20) * 0.08);
      this.roomWitnessHeat.set(event.roomId, next);
    }
  }

  private rebuildDerivedHeat(): void {
    this.channelWitnessHeat.clear();
    this.roomWitnessHeat.clear();

    for (const state of this.counterparts.values()) {
      for (const event of state.eventHistoryTail) {
        if (event.channelId) {
          const current = this.channelWitnessHeat.get(event.channelId) ?? 0;
          this.channelWitnessHeat.set(event.channelId, clamp01(current + (event.publicWitness01 ?? 0.08) * 0.08));
        }
        if (event.roomId) {
          const current = this.roomWitnessHeat.get(event.roomId) ?? 0;
          this.roomWitnessHeat.set(event.roomId, clamp01(current + (event.publicWitness01 ?? 0.08) * 0.06));
        }
      }
    }
  }

  private rebuildSelectionScores(now: UnixMs): void {
    for (const state of this.counterparts.values()) {
      this.recomputeState(state, now, false);
    }
  }

  private recomputeState(state: MutableRelationshipCounterpartState, now: UnixMs, touchUpdatedAt = true): void {
    state.intensity01 = clamp01(
      state.vector.contempt01 * 0.14 +
      state.vector.fascination01 * 0.07 +
      state.vector.respect01 * 0.05 +
      state.vector.fear01 * 0.08 +
      state.vector.obsession01 * 0.15 +
      state.vector.predictiveConfidence01 * 0.10 +
      state.vector.unfinishedBusiness01 * 0.15 +
      state.vector.traumaDebt01 * 0.06 +
      state.witnessHeat01 * 0.10 +
      state.escalationRisk01 * 0.10,
    );

    state.volatility01 = clamp01(
      state.vector.contempt01 * 0.14 +
      state.vector.fear01 * 0.12 +
      state.vector.obsession01 * 0.12 +
      (1 - state.vector.patience01) * 0.12 +
      state.vector.unfinishedBusiness01 * 0.12 +
      (1 - state.vector.familiarity01) * 0.08 +
      state.greedSignal01 * 0.10 +
      state.dealVolatility01 * 0.10 +
      state.escalationRisk01 * 0.10,
    );

    state.publicPressureBias01 = clamp01(
      state.publicPressureBias01 * 0.40 +
      state.vector.contempt01 * 0.10 +
      state.vector.unfinishedBusiness01 * 0.10 +
      state.vector.fear01 * 0.06 +
      state.vector.respect01 * 0.04 +
      state.witnessHeat01 * 0.16 +
      scoreChannelWitnessHeat(this.channelWitnessHeat.get(state.lastChannelId ?? '') ?? 0) * 0.14,
    );
    state.privatePressureBias01 = clamp01(1 - state.publicPressureBias01 * 0.78);
    state.rescueReadiness01 = clamp01(
      state.rescueReadiness01 * 0.46 +
      state.vector.traumaDebt01 * 0.20 +
      state.vector.respect01 * 0.08 +
      (1 - state.vector.contempt01) * 0.06 +
      state.disciplineSignal01 * 0.10 +
      (state.counterpartKind === 'HELPER' ? 0.10 : 0),
    );
    state.escalationRisk01 = clamp01(
      state.escalationRisk01 * 0.48 +
      state.vector.contempt01 * 0.16 +
      state.vector.fear01 * 0.10 +
      state.vector.unfinishedBusiness01 * 0.14 +
      state.witnessHeat01 * 0.06 +
      state.greedSignal01 * 0.06,
    );
    state.dealVolatility01 = clamp01(
      state.dealVolatility01 * 0.44 +
      state.vector.fear01 * 0.10 +
      state.vector.predictiveConfidence01 * 0.12 +
      state.vector.unfinishedBusiness01 * 0.10 +
      state.greedSignal01 * 0.14 +
      state.witnessHeat01 * 0.10,
    );
    state.selectionScore01 = clamp01(this.computeFocusScore(state, state.lastChannelId));
    state.dominantAxes = dominantAxes(state.vector);
    state.stance = deriveStance(state.vector, state.counterpartKind, state);
    state.objective = deriveObjective(state.vector, state.counterpartKind, state.stance, state);
    if (touchUpdatedAt) {
      state.lastTouchedAt = now;
      this.updatedAt = now;
    }
  }

  private applyDormancyDecay(state: MutableRelationshipCounterpartState, now: UnixMs): void {
    const ageMs = Math.max(0, Number(now) - Number(state.lastTouchedAt));
    if (ageMs < QUIET_DORMANCY_MS) return;

    const softSteps = Math.min(12, Math.floor(ageMs / QUIET_DORMANCY_MS));
    if (softSteps <= 0) return;

    for (let index = 0; index < softSteps; index += 1) {
      state.vector.fear01 = clamp01(state.vector.fear01 * 0.985);
      state.vector.contempt01 = clamp01(state.vector.contempt01 * 0.988);
      state.vector.obsession01 = clamp01(state.vector.obsession01 * 0.987);
      state.vector.unfinishedBusiness01 = clamp01(state.vector.unfinishedBusiness01 * 0.989);
      state.vector.predictiveConfidence01 = clamp01(state.vector.predictiveConfidence01 * 0.992 + 0.001);
      state.vector.familiarity01 = clamp01(state.vector.familiarity01 * 0.994);
      state.witnessHeat01 = clamp01(state.witnessHeat01 * 0.980);
      state.rescueReadiness01 = clamp01(state.rescueReadiness01 * 0.992);
      state.escalationRisk01 = clamp01(state.escalationRisk01 * 0.988);
      state.dealVolatility01 = clamp01(state.dealVolatility01 * 0.986);
      state.disciplineSignal01 = clamp01(state.disciplineSignal01 * 0.996);
      state.greedSignal01 = clamp01(state.greedSignal01 * 0.992);
    }

    while (state.callbackHints.length > 0 && ageMs > HARD_DORMANCY_MS) {
      state.callbackHints.pop();
      if (state.callbackHints.length <= Math.ceil(this.callbackLimit / 3)) break;
    }
  }

  private addCallbackHint(state: MutableRelationshipCounterpartState, hint: ChatRelationshipCallbackHint): void {
    state.callbackHints.unshift(hint);
    if (state.callbackHints.length > this.callbackLimit) state.callbackHints.length = this.callbackLimit;
  }

  private cloneState(state: MutableRelationshipCounterpartState): ChatRelationshipCounterpartState {
    return {
      counterpartId: state.counterpartId,
      counterpartKind: state.counterpartKind,
      playerId: state.playerId ?? null,
      botId: state.botId ?? null,
      actorRole: state.actorRole ?? null,
      lastChannelId: state.lastChannelId ?? null,
      vector: { ...state.vector },
      stance: state.stance,
      objective: state.objective,
      intensity01: state.intensity01,
      volatility01: state.volatility01,
      publicPressureBias01: state.publicPressureBias01,
      privatePressureBias01: state.privatePressureBias01,
      callbackHints: [...state.callbackHints],
      eventHistoryTail: [...state.eventHistoryTail],
      dominantAxes: [...state.dominantAxes],
      lastTouchedAt: state.lastTouchedAt,
    };
  }

  private buildDigest(state: MutableRelationshipCounterpartState): ChatRelationshipCounterpartDigest {
    return {
      counterpartId: state.counterpartId,
      counterpartKind: state.counterpartKind,
      stance: state.stance,
      objective: state.objective,
      momentumBand: classifyMomentumBand(state),
      selectionScore01: state.selectionScore01,
      intensity01: state.intensity01,
      volatility01: state.volatility01,
      witnessHeat01: state.witnessHeat01,
      rescueReadiness01: state.rescueReadiness01,
      escalationRisk01: state.escalationRisk01,
      disciplineSignal01: state.disciplineSignal01,
      greedSignal01: state.greedSignal01,
      callbackCount: state.callbackHints.length,
      lastSummary: state.lastSummary,
      lastEventType: state.lastEventType,
      lastChannelId: state.lastChannelId,
      lastRoomId: state.lastRoomId,
      dominantAxes: [...state.dominantAxes],
    };
  }

  private buildChannelHeatRows(): readonly ChatRelationshipChannelHeat[] {
    const allChannelIds = new Set<string>([
      ...this.channelWitnessHeat.keys(),
      ...this.channelInteractionCounts.keys(),
      ...this.focusedCounterpartByChannel.keys(),
      ...[...this.counterparts.values()].map((state) => state.lastChannelId).filter(Boolean) as string[],
    ]);

    return [...allChannelIds]
      .map((channelId) => {
        const related = [...this.counterparts.values()]
          .filter((state) => state.lastChannelId === channelId || state.eventHistoryTail.some((event) => event.channelId === channelId))
          .sort((a, b) => this.computeFocusScore(b, channelId) - this.computeFocusScore(a, channelId))
          .slice(0, 5)
          .map((state) => state.counterpartId);

        return {
          channelId,
          heat01: clamp01(this.channelWitnessHeat.get(channelId) ?? 0),
          focusCounterpartId: this.focusedCounterpartByChannel.get(channelId),
          topCounterpartIds: related,
          eventCount: this.channelInteractionCounts.get(channelId) ?? 0,
        };
      })
      .sort((a, b) => b.heat01 - a.heat01 || b.eventCount - a.eventCount || a.channelId.localeCompare(b.channelId));
  }

  private buildRoomHeatRows(): readonly ChatRelationshipRoomHeat[] {
    const allRoomIds = new Set<string>([
      ...this.roomWitnessHeat.keys(),
      ...this.roomInteractionCounts.keys(),
      ...[...this.counterparts.values()].map((state) => state.lastRoomId).filter(Boolean) as string[],
    ]);

    return [...allRoomIds]
      .map((roomId) => ({
        roomId,
        heat01: clamp01(this.roomWitnessHeat.get(roomId) ?? 0),
        eventCount: this.roomInteractionCounts.get(roomId) ?? 0,
        topCounterpartIds: [...this.counterparts.values()]
          .filter((state) => state.lastRoomId === roomId || state.eventHistoryTail.some((event) => event.roomId === roomId))
          .sort((a, b) => b.selectionScore01 - a.selectionScore01)
          .slice(0, 5)
          .map((state) => state.counterpartId),
      }))
      .sort((a, b) => b.heat01 - a.heat01 || b.eventCount - a.eventCount || a.roomId.localeCompare(b.roomId));
  }

  private computeFocusScore(state: MutableRelationshipCounterpartState, channelId?: string | null): number {
    const channelHeat = scoreChannelWitnessHeat(channelId ? this.channelWitnessHeat.get(channelId) ?? 0 : 0);
    const channelAffinity = channelId && state.lastChannelId === channelId ? 0.08 : 0;
    const roomHeat = scoreRoomWitnessHeat(state.lastRoomId ? this.roomWitnessHeat.get(state.lastRoomId) ?? 0 : 0);
    const callbackBias = Math.min(0.10, state.callbackHints.length * 0.012);
    const recencyBias = clamp01(1 - Math.min(1, (Date.now() - Number(state.lastTouchedAt)) / HARD_DORMANCY_MS)) * 0.06;

    return clamp01(
      state.intensity01 * 0.26 +
      state.vector.obsession01 * 0.12 +
      state.vector.unfinishedBusiness01 * 0.12 +
      state.vector.predictiveConfidence01 * 0.07 +
      state.witnessHeat01 * 0.10 +
      state.rescueReadiness01 * (state.counterpartKind === 'HELPER' ? 0.08 : 0.02) +
      state.escalationRisk01 * (state.counterpartKind === 'BOT' || state.counterpartKind === 'RIVAL' ? 0.10 : 0.03) +
      state.disciplineSignal01 * 0.04 +
      state.greedSignal01 * 0.04 +
      channelHeat * 0.05 +
      roomHeat * 0.03 +
      channelAffinity +
      callbackBias +
      recencyBias,
    );
  }

  private createEventDescriptor(input: {
    readonly counterpartId: string;
    readonly counterpartKind: ChatRelationshipCounterpartKind;
    readonly playerId?: string | null;
    readonly botId?: string | null;
    readonly actorRole?: string | null;
    readonly channelId?: string | null;
    readonly roomId?: string | null;
    readonly sourceMessageId?: string | null;
    readonly sourcePlanId?: string | null;
    readonly sceneId?: string | null;
    readonly pressureBand?: ChatRelationshipPressureBand;
    readonly publicWitness01?: number;
    readonly intensity01?: number;
    readonly summary?: string;
    readonly rawText?: string | null;
    readonly tags?: readonly string[];
    readonly eventType: ChatRelationshipEventType;
    readonly createdAt: UnixMs;
  }): MutableRelationshipEventDescriptor {
    return {
      eventId: randomId('rel_evt', `${input.counterpartId}:${input.eventType}`, input.createdAt),
      eventType: input.eventType,
      counterpartId: input.counterpartId,
      counterpartKind: input.counterpartKind,
      playerId: input.playerId ?? null,
      botId: input.botId ?? null,
      actorRole: input.actorRole ?? null,
      channelId: input.channelId ?? null,
      roomId: input.roomId ?? null,
      sourceMessageId: input.sourceMessageId ?? null,
      sourcePlanId: input.sourcePlanId ?? null,
      sceneId: input.sceneId ?? null,
      pressureBand: input.pressureBand,
      publicWitness01: clamp01(input.publicWitness01 ?? 0),
      intensity01: clamp01(input.intensity01 ?? 0.2),
      summary: input.summary,
      rawText: input.rawText ?? null,
      tags: [...new Set((input.tags ?? []).map((tag) => String(tag).toLowerCase()))],
      createdAt: input.createdAt,
    };
  }

  private createSyntheticEchoEvent(
    source: MutableRelationshipEventDescriptor | ChatRelationshipEventDescriptor,
    eventType: ChatRelationshipEventType,
    now: UnixMs,
    summary: string,
  ): ChatRelationshipEventDescriptor {
    return {
      ...source,
      eventId: randomId('rel_evt', `${source.counterpartId}:${eventType}:${source.eventId}`, now),
      eventType,
      summary,
      rawText: source.rawText,
      createdAt: now,
      tags: [...new Set([...(source.tags ?? []), 'synthetic'])],
    };
  }

  private hasSeenMessage(messageId: string): boolean {
    return this.recentlySeenMessageIdSet.has(messageId);
  }

  private rememberMessageId(messageId: string): void {
    if (this.recentlySeenMessageIdSet.has(messageId)) return;
    this.recentlySeenMessageIdSet.add(messageId);
    this.recentlySeenMessageIds.push(messageId);
    if (this.recentlySeenMessageIds.length > this.messageDedupLimit) {
      const removed = this.recentlySeenMessageIds.shift();
      if (removed) this.recentlySeenMessageIdSet.delete(removed);
    }
  }
}

function normalizeResponseClass(responseClass?: ChatRelationshipResponseClass | null): ChatRelationshipResponseClass {
  return responseClass ?? 'UNKNOWN';
}

function inferResponseClass(body: string, tags?: Iterable<string>): ChatRelationshipResponseClass {
  const text = String(body ?? '').trim().toLowerCase();
  const tagSet = new Set<string>([...(tags ?? [])].map((tag) => String(tag).toLowerCase()));
  if (!text) return 'UNKNOWN';
  if (tagSet.has('discipline') || /steady|patient|disciplined|i will wait|sequence|clean|measured|hold the line|stay small/.test(text)) return 'DISCIPLINED';
  if (tagSet.has('greed') || /all in|double down|max it|maxing|max out|run it up|juice it|press harder|squeeze more/.test(text)) return 'GREEDY';
  if (/(panic|i can't|cant do this|i am cooked|i'm cooked|i’m cooked|i'm done|im done)/.test(text)) return 'FEARFUL';
  if (/(offer|counter|terms|deal|price|floor|bid|ask)/.test(text)) return 'NEGOTIATION';
  if (text.includes('?')) return 'QUESTION';
  if (/(mad|angry|hate|stupid|trash|idiot|damn|fraud|bum|loser)/.test(text)) return 'ANGRY';
  if (/(lol|lmao|rofl|cope|cry|skill issue|ratio|cooked)/.test(text)) return 'TROLL';
  if (/(easy|light work|too easy|i win|i'm him|i am him|built different|unstoppable|can't touch me|cannot touch me)/.test(text)) return 'FLEX';
  if (/(okay|understood|steady|got it|copy|thanks|thank you|respect|fair)/.test(text)) return 'CALM';
  if (/(watch this|look at that|remember this)/.test(text)) return 'WITNESS';
  return 'UNKNOWN';
}

function inferMessageResponseClass(message: ChatMessage): ChatRelationshipResponseClass {
  const metadataClass = readStringMetadata(message.metadata, 'responseClass');
  if (metadataClass) return normalizeRelationshipResponseClass(metadataClass);
  return inferResponseClass(stringifyMessageBody(message), message.tags);
}

function normalizeRelationshipResponseClass(value: string): ChatRelationshipResponseClass {
  const normalized = String(value ?? '').trim().toUpperCase();
  switch (normalized) {
    case 'QUESTION':
    case 'ANGRY':
    case 'TROLL':
    case 'FLEX':
    case 'CALM':
    case 'DISCIPLINED':
    case 'GREEDY':
    case 'FEARFUL':
    case 'NEGOTIATION':
    case 'WITNESS':
      return normalized;
    default:
      return 'UNKNOWN';
  }
}

function mapResponseClassToEventType(
  responseClass: ChatRelationshipResponseClass,
  normalized: string,
  channelId?: string | null,
): ChatRelationshipEventType {
  if (responseClass === 'QUESTION') return 'PLAYER_QUESTION';
  if (responseClass === 'ANGRY') return 'PLAYER_ANGER';
  if (responseClass === 'TROLL') return 'PLAYER_TROLL';
  if (responseClass === 'DISCIPLINED') return 'PLAYER_DISCIPLINE';
  if (responseClass === 'GREEDY') return 'PLAYER_GREED';
  if (responseClass === 'FLEX') return normalized.includes('bluff') ? 'PLAYER_BLUFF' : /unstoppable|can't touch me|cannot touch me|built different/.test(normalized) ? 'PLAYER_OVERCONFIDENCE' : 'PLAYER_FLEX';
  if (responseClass === 'CALM') return 'PLAYER_CALM';
  if (responseClass === 'NEGOTIATION') return 'NEGOTIATION_WINDOW';
  if (normalized.includes('wait') || normalized.includes('hold')) return 'PLAYER_HESITATION';
  if (String(channelId ?? '').toUpperCase() === 'DEAL_ROOM') return 'NEGOTIATION_WINDOW';
  return 'PLAYER_MESSAGE';
}

function deltaForGameEvent(eventType: ChatRelationshipEventType): RelationshipDelta {
  const delta = blankDelta();
  switch (eventType) {
    case 'PLAYER_COMEBACK':
      delta.respect01 += 0.10;
      delta.fear01 += 0.06;
      delta.unfinishedBusiness01 += 0.08;
      delta.fascination01 += 0.05;
      break;
    case 'PLAYER_COLLAPSE':
      delta.contempt01 += 0.07;
      delta.fear01 += 0.05;
      delta.obsession01 += 0.05;
      delta.unfinishedBusiness01 += 0.09;
      delta.predictiveConfidence01 += 0.04;
      break;
    case 'PLAYER_BREACH':
      delta.fear01 += 0.06;
      delta.contempt01 += 0.04;
      delta.unfinishedBusiness01 += 0.07;
      delta.traumaDebt01 += 0.05;
      break;
    case 'PLAYER_PERFECT_DEFENSE':
      delta.respect01 += 0.09;
      delta.fear01 += 0.05;
      delta.predictiveConfidence01 -= 0.04;
      delta.familiarity01 += 0.03;
      break;
    case 'PLAYER_FAILED_GAMBLE':
      delta.contempt01 += 0.05;
      delta.predictiveConfidence01 += 0.07;
      delta.unfinishedBusiness01 += 0.06;
      break;
    case 'PLAYER_DISCIPLINE':
      delta.respect01 += 0.08;
      delta.patience01 += 0.09;
      delta.predictiveConfidence01 -= 0.04;
      delta.unfinishedBusiness01 += 0.03;
      break;
    case 'PLAYER_GREED':
      delta.contempt01 += 0.06;
      delta.fear01 += 0.03;
      delta.predictiveConfidence01 += 0.08;
      delta.unfinishedBusiness01 += 0.05;
      break;
    case 'PLAYER_OVERCONFIDENCE':
      delta.contempt01 += 0.04;
      delta.fear01 += 0.03;
      delta.predictiveConfidence01 += 0.07;
      break;
    case 'NEGOTIATION_WINDOW':
      delta.fear01 += 0.04;
      delta.fascination01 += 0.04;
      delta.predictiveConfidence01 += 0.04;
      delta.unfinishedBusiness01 += 0.03;
      break;
    case 'MARKET_ALERT':
      delta.patience01 += 0.03;
      delta.fear01 += 0.03;
      delta.fascination01 += 0.03;
      break;
    case 'PLAYER_NEAR_SOVEREIGNTY':
      delta.respect01 += 0.08;
      delta.obsession01 += 0.06;
      delta.unfinishedBusiness01 += 0.06;
      delta.fear01 += 0.05;
      break;
    case 'RUN_START':
      delta.fascination01 += 0.03;
      delta.patience01 += 0.03;
      break;
    case 'RUN_END':
      delta.familiarity01 += 0.04;
      delta.unfinishedBusiness01 += 0.04;
      break;
    default:
      delta.familiarity01 += 0.02;
      delta.fascination01 += 0.02;
      break;
  }
  return delta;
}

function mapGameEventToRelationshipEvent(eventType: string): ChatRelationshipEventType {
  const normalized = String(eventType ?? '').toUpperCase();
  if (normalized.includes('COMEBACK')) return 'PLAYER_COMEBACK';
  if (normalized.includes('BANKRUPT') || normalized.includes('LOSS') || normalized.includes('LOST') || normalized.includes('COLLAPSE')) return 'PLAYER_COLLAPSE';
  if (normalized.includes('BREACH') || normalized.includes('SHIELD')) return 'PLAYER_BREACH';
  if (normalized.includes('PERFECT') || normalized.includes('FORTIFIED')) return 'PLAYER_PERFECT_DEFENSE';
  if (normalized.includes('GAMBLE')) return 'PLAYER_FAILED_GAMBLE';
  if (normalized.includes('DISCIPLINE') || normalized.includes('STEADY')) return 'PLAYER_DISCIPLINE';
  if (normalized.includes('GREED') || normalized.includes('OVERLEVERAGE') || normalized.includes('CHASE')) return 'PLAYER_GREED';
  if (normalized.includes('OVERCONFIDENT') || normalized.includes('ARROGANT')) return 'PLAYER_OVERCONFIDENCE';
  if (normalized.includes('SOVEREIGN')) return 'PLAYER_NEAR_SOVEREIGNTY';
  if (normalized.includes('NEGOTIATION') || normalized.includes('DEAL')) return 'NEGOTIATION_WINDOW';
  if (normalized.includes('MARKET')) return 'MARKET_ALERT';
  if (normalized.includes('START')) return 'RUN_START';
  if (normalized.includes('END') || normalized.includes('DEBRIEF')) return 'RUN_END';
  return 'PUBLIC_WITNESS';
}

function deriveStance(
  vector: ChatRelationshipVector,
  kind: ChatRelationshipCounterpartKind,
  state?: MutableRelationshipCounterpartState,
): ChatRelationshipStance {
  if (kind === 'HELPER') {
    if (vector.traumaDebt01 >= 0.55 || vector.patience01 >= 0.72 || (state?.rescueReadiness01 ?? 0) >= 0.64) return 'PROTECTIVE';
    if (vector.respect01 >= 0.60) return 'RESPECTFUL';
    return 'CURIOUS';
  }
  if (kind === 'ARCHIVIST') return vector.fascination01 >= 0.58 ? 'CURIOUS' : 'CLINICAL';
  if (vector.obsession01 >= 0.74 && vector.unfinishedBusiness01 >= 0.66) return 'OBSESSED';
  if (vector.traumaDebt01 >= 0.62 && vector.respect01 >= 0.38 && vector.contempt01 < 0.40) return 'WOUNDED';
  if (vector.contempt01 >= 0.62 && vector.fear01 >= 0.36) return 'HUNTING';
  if (vector.contempt01 >= 0.58) return 'PREDATORY';
  if (vector.respect01 >= 0.62 && vector.contempt01 < 0.40) return 'RESPECTFUL';
  if (vector.predictiveConfidence01 >= 0.66) return 'CLINICAL';
  if (vector.unfinishedBusiness01 >= 0.52) return 'PROBING';
  return kind === 'RIVAL' ? 'CURIOUS' : 'DISMISSIVE';
}

function deriveObjective(
  vector: ChatRelationshipVector,
  kind: ChatRelationshipCounterpartKind,
  stance: ChatRelationshipStance,
  state?: MutableRelationshipCounterpartState,
): ChatRelationshipObjective {
  if (kind === 'HELPER') return vector.traumaDebt01 >= 0.48 || (state?.rescueReadiness01 ?? 0) >= 0.56 ? 'RESCUE' : 'TEST';
  if (kind === 'ARCHIVIST') return 'WITNESS';
  if (kind === 'RIVAL' && vector.respect01 >= 0.50) return 'TEST';
  if (stance === 'OBSESSED') return 'STUDY';
  if (stance === 'WOUNDED') return 'CONTAIN';
  if (stance === 'HUNTING') return 'PRESSURE';
  if (stance === 'PREDATORY') return vector.predictiveConfidence01 >= 0.62 ? 'REPRICE' : 'PROVOKE';
  if (stance === 'CLINICAL') return 'DELAY';
  if (stance === 'RESPECTFUL') return 'NEGOTIATE';
  if ((state?.greedSignal01 ?? 0) >= 0.62) return 'REPRICE';
  if (vector.unfinishedBusiness01 >= 0.55) return 'HUMILIATE';
  return 'STUDY';
}

function dominantAxes(vector: ChatRelationshipVector): readonly ChatRelationshipAxisId[] {
  const ranked: readonly (readonly [ChatRelationshipAxisId, number])[] = [
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
  ];

  return [...ranked].sort((a, b) => b[1] - a[1]).slice(0, 3).map((item) => item[0]);
}

function blankDelta(): RelationshipDelta {
  return {
    contempt01: 0,
    fascination01: 0,
    respect01: 0,
    fear01: 0,
    obsession01: 0,
    patience01: 0,
    familiarity01: 0,
    predictiveConfidence01: 0,
    traumaDebt01: 0,
    unfinishedBusiness01: 0,
  };
}

function applyResponseClassDelta(delta: RelationshipDelta, responseClass: ChatRelationshipResponseClass): void {
  if (responseClass === 'QUESTION') {
    delta.fascination01 += 0.08;
    delta.patience01 += 0.04;
    delta.respect01 += 0.03;
  } else if (responseClass === 'ANGRY') {
    delta.contempt01 += 0.06;
    delta.fear01 += 0.04;
    delta.unfinishedBusiness01 += 0.06;
    delta.predictiveConfidence01 += 0.03;
  } else if (responseClass === 'TROLL') {
    delta.contempt01 += 0.04;
    delta.fascination01 += 0.03;
    delta.predictiveConfidence01 += 0.05;
  } else if (responseClass === 'FLEX') {
    delta.fear01 += 0.06;
    delta.contempt01 += 0.03;
    delta.unfinishedBusiness01 += 0.04;
  } else if (responseClass === 'CALM') {
    delta.respect01 += 0.07;
    delta.patience01 += 0.06;
    delta.predictiveConfidence01 -= 0.02;
  } else if (responseClass === 'DISCIPLINED') {
    delta.respect01 += 0.08;
    delta.patience01 += 0.10;
    delta.predictiveConfidence01 -= 0.04;
    delta.unfinishedBusiness01 += 0.03;
  } else if (responseClass === 'GREEDY') {
    delta.contempt01 += 0.05;
    delta.fear01 += 0.04;
    delta.predictiveConfidence01 += 0.06;
    delta.unfinishedBusiness01 += 0.05;
  } else if (responseClass === 'FEARFUL') {
    delta.predictiveConfidence01 += 0.05;
    delta.fear01 += 0.08;
    delta.respect01 -= 0.03;
  } else if (responseClass === 'NEGOTIATION') {
    delta.fear01 += 0.03;
    delta.fascination01 += 0.04;
    delta.predictiveConfidence01 += 0.04;
    delta.unfinishedBusiness01 += 0.04;
  } else if (responseClass === 'WITNESS') {
    delta.fascination01 += 0.03;
    delta.unfinishedBusiness01 += 0.03;
  }
}

function applyTagDelta(delta: RelationshipDelta, tags: Iterable<string>): void {
  const tagSet = new Set([...tags].map((tag) => String(tag).toLowerCase()));
  if (tagSet.has('shield') || tagSet.has('hold') || tagSet.has('discipline')) {
    delta.respect01 += 0.03;
    delta.patience01 += 0.02;
  }
  if (tagSet.has('offer') || tagSet.has('deal') || tagSet.has('negotiation')) {
    delta.fear01 += 0.03;
    delta.predictiveConfidence01 += 0.04;
    delta.unfinishedBusiness01 += 0.05;
  }
  if (tagSet.has('proof') || tagSet.has('receipt')) {
    delta.respect01 += 0.02;
    delta.predictiveConfidence01 -= 0.02;
  }
  if (tagSet.has('greed') || tagSet.has('overleverage')) {
    delta.contempt01 += 0.03;
    delta.predictiveConfidence01 += 0.05;
  }
  if (tagSet.has('rescue') || tagSet.has('helper')) {
    delta.traumaDebt01 += 0.04;
    delta.familiarity01 += 0.04;
  }
}

function applyNarrativeCueDelta(
  delta: RelationshipDelta,
  normalized: string,
  channelId?: string | null,
): void {
  if (normalized.length <= 18) {
    delta.predictiveConfidence01 += 0.05;
    delta.familiarity01 += 0.02;
  } else if (normalized.length >= 100) {
    delta.patience01 += 0.04;
    delta.fascination01 += 0.03;
  }

  if (normalized.includes('proof') || normalized.includes('show')) {
    delta.respect01 += 0.03;
    delta.predictiveConfidence01 -= 0.02;
  }
  if (normalized.includes('sorry') || normalized.includes('my fault')) {
    delta.contempt01 -= 0.03;
    delta.familiarity01 += 0.04;
  }
  if (normalized.includes('comeback') || normalized.includes('still here')) {
    delta.respect01 += 0.06;
    delta.unfinishedBusiness01 += 0.04;
  }
  if (normalized.includes('remember') || normalized.includes('last time') || normalized.includes('again')) {
    delta.obsession01 += 0.04;
    delta.familiarity01 += 0.05;
  }
  if (normalized.includes('wait') || normalized.includes('hold')) {
    delta.patience01 += 0.03;
    delta.unfinishedBusiness01 += 0.03;
  }
  if (String(channelId ?? '').toUpperCase() === 'DEAL_ROOM') {
    delta.predictiveConfidence01 += 0.03;
    delta.fear01 += 0.02;
  }
}

function applyNpcSeverityDelta(
  delta: RelationshipDelta,
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
): void {
  if (severity === 'CRITICAL') {
    delta.fear01 += 0.08;
    delta.obsession01 += 0.07;
    delta.unfinishedBusiness01 += 0.08;
    delta.predictiveConfidence01 += 0.06;
  } else if (severity === 'HIGH') {
    delta.fear01 += 0.06;
    delta.obsession01 += 0.05;
    delta.predictiveConfidence01 += 0.05;
  } else {
    delta.familiarity01 += 0.03;
    delta.predictiveConfidence01 += 0.02;
  }
}

function applyRoleDelta(
  delta: RelationshipDelta,
  actorRole?: string | null,
): void {
  if (isHelperRole(actorRole)) {
    delta.respect01 += 0.06;
    delta.patience01 += 0.05;
    delta.traumaDebt01 += 0.04;
  } else if (isHaterRole(actorRole)) {
    delta.contempt01 += 0.06;
    delta.fascination01 += 0.04;
    delta.unfinishedBusiness01 += 0.07;
  } else if (isRivalRole(actorRole)) {
    delta.respect01 += 0.04;
    delta.fear01 += 0.03;
    delta.unfinishedBusiness01 += 0.05;
  } else if (isArchivistRole(actorRole)) {
    delta.familiarity01 += 0.05;
    delta.fascination01 += 0.05;
    delta.patience01 += 0.03;
  }
}

function scoreDisciplineSignal(normalized: string, tags: Iterable<string>): number {
  const tagSet = new Set([...tags].map((tag) => String(tag).toLowerCase()));
  let score = 0;
  if (tagSet.has('discipline') || tagSet.has('shield')) score += 0.34;
  if (/steady|patience|patient|clean sequence|hold the line|small size|measured/.test(normalized)) score += 0.36;
  if (/wait|review|breathe|discipline|contained|not yet/.test(normalized)) score += 0.22;
  return clamp01(score);
}

function scoreGreedSignal(normalized: string, tags: Iterable<string>, channelId?: string | null): number {
  const tagSet = new Set([...tags].map((tag) => String(tag).toLowerCase()));
  let score = 0;
  if (tagSet.has('greed') || tagSet.has('offer')) score += 0.18;
  if (/all in|double down|max it|max out|juice|squeeze|push harder|take more|bigger/.test(normalized)) score += 0.38;
  if (String(channelId ?? '').toUpperCase() === 'DEAL_ROOM') score += 0.08;
  return clamp01(score);
}

function scoreFearSignal(normalized: string, pressureBand?: ChatRelationshipPressureBand): number {
  let score = 0;
  if (/panic|cooked|done|can't|cannot|stuck|trapped|scared/.test(normalized)) score += 0.42;
  if (pressureBand === 'HIGH') score += 0.08;
  if (pressureBand === 'CRITICAL') score += 0.14;
  return clamp01(score);
}

function scorePublicWitness(
  channelId?: string | null,
  roomId?: string | null,
  responseClass?: ChatRelationshipResponseClass,
  pressureBand?: ChatRelationshipPressureBand,
): number {
  let score = isPublicChannel(channelId) ? 0.74 : 0.22;
  if (roomId && /global|lobby|public/i.test(roomId)) score += 0.06;
  if (responseClass === 'FLEX' || responseClass === 'ANGRY' || responseClass === 'WITNESS') score += 0.06;
  if (pressureBand === 'HIGH') score += 0.04;
  if (pressureBand === 'CRITICAL') score += 0.08;
  return clamp01(score);
}

function scoreBodyIntensity(
  body: string,
  responseClass: ChatRelationshipResponseClass,
  pressureBand?: ChatRelationshipPressureBand,
): number {
  const normalized = String(body ?? '').trim().toLowerCase();
  let score = clamp01(0.22 + normalized.length / 280);
  if (responseClass === 'ANGRY' || responseClass === 'FLEX') score += 0.12;
  if (responseClass === 'GREEDY' || responseClass === 'NEGOTIATION') score += 0.08;
  if (pressureBand === 'HIGH') score += 0.08;
  if (pressureBand === 'CRITICAL') score += 0.14;
  if (/!{2,}|\bnever\b|\balways\b/.test(normalized)) score += 0.06;
  return clamp01(score);
}

function scoreNpcIntensity(
  body: string,
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  actorRole?: string | null,
  channelId?: string | null,
): number {
  let score = clamp01(0.18 + String(body ?? '').trim().length / 320);
  if (severity === 'MEDIUM') score += 0.08;
  if (severity === 'HIGH') score += 0.18;
  if (severity === 'CRITICAL') score += 0.28;
  if (isHaterRole(actorRole) || isRivalRole(actorRole)) score += 0.06;
  if (String(channelId ?? '').toUpperCase() === 'GLOBAL') score += 0.04;
  return clamp01(score);
}

function derivePressureBandFromBody(body: string, channelId?: string | null): ChatRelationshipPressureBand {
  const normalized = String(body ?? '').trim().toLowerCase();
  if (/panic|collapse|destroy|end you|everyone can see|all in|finish this/.test(normalized)) return 'CRITICAL';
  if (/watch this|prove it|show me|deal now|price|counter|exposed/.test(normalized)) return 'HIGH';
  if (String(channelId ?? '').toUpperCase() === 'DEAL_ROOM') return 'MEDIUM';
  return 'LOW';
}

function derivePressureBandFromMessage(message: ChatMessage): ChatRelationshipPressureBand {
  const metadata = readStringMetadata(message.metadata, 'pressureBand');
  if (metadata) {
    const normalized = metadata.toUpperCase();
    if (normalized === 'LOW' || normalized === 'MEDIUM' || normalized === 'HIGH' || normalized === 'CRITICAL') return normalized;
  }
  return derivePressureBandFromBody(stringifyMessageBody(message), String(message.channelId));
}

function inferPressureBandFromEventType(eventType: ChatRelationshipEventType): ChatRelationshipPressureBand {
  if (eventType === 'PLAYER_COLLAPSE' || eventType === 'PLAYER_BREACH') return 'CRITICAL';
  if (eventType === 'PLAYER_FAILED_GAMBLE' || eventType === 'PLAYER_COMEBACK' || eventType === 'NEGOTIATION_WINDOW') return 'HIGH';
  if (eventType === 'MARKET_ALERT' || eventType === 'PLAYER_DISCIPLINE') return 'MEDIUM';
  return 'LOW';
}

function inferCounterpartKindFromMessage(message: ChatMessage): ChatRelationshipCounterpartKind {
  if (message.attribution.sourceType === 'PLAYER') return 'NPC';
  if (message.attribution.sourceType === 'NPC_HELPER') return 'HELPER';
  if (message.attribution.sourceType === 'NPC_HATER') return inferActorRoleFromMessage(message) === 'RIVAL' ? 'RIVAL' : 'BOT';
  if (message.attribution.sourceType === 'NPC_AMBIENT') return 'AMBIENT';
  if (message.attribution.sourceType === 'LIVEOPS' || message.attribution.sourceType === 'SYSTEM') return 'SYSTEM';
  return kindFromActorRole(message.attribution.npcRole);
}

function inferCounterpartIdFromMessage(message: ChatMessage, channelId?: string | null): string {
  const metadataTargetId = readStringMetadata(message.metadata, 'relationshipTargetId')
    ?? readStringMetadata(message.metadata, 'counterpartId')
    ?? readStringMetadata(message.metadata, 'relationshipAnchorId');

  if (metadataTargetId) return metadataTargetId;
  if (message.attribution.botId) return String(message.attribution.botId);
  if (message.attribution.sourceType === 'PLAYER') {
    const quotedMessageId = message.bodyParts.find((part) => part.type === 'QUOTE');
    if (quotedMessageId?.type === 'QUOTE') return `quoted:${String(quotedMessageId.messageId)}`;
    return `focus:${String(channelId ?? message.channelId)}`;
  }
  if (message.attribution.actorId) return String(message.attribution.actorId);
  return `${String(message.attribution.sourceType).toLowerCase()}:${String(channelId ?? message.channelId).toLowerCase()}`;
}

function inferActorRoleFromMessage(message: ChatMessage): string | null {
  const metadataRole = readStringMetadata(message.metadata, 'actorRole') ?? readStringMetadata(message.metadata, 'npcRole');
  if (metadataRole) return metadataRole;
  if (message.attribution.npcRole) return String(message.attribution.npcRole);
  if (message.attribution.sourceType === 'NPC_HELPER') return 'HELPER';
  if (message.attribution.sourceType === 'NPC_HATER') return 'HATER';
  if (message.attribution.sourceType === 'NPC_AMBIENT') return 'AMBIENT';
  if (message.attribution.sourceType === 'LIVEOPS') return 'LIVEOPS';
  return null;
}

function inferNpcContextFromMessage(message: ChatMessage): string | null {
  return readStringMetadata(message.metadata, 'sceneLabel')
    ?? readStringMetadata(message.metadata, 'context')
    ?? readStringMetadata(message.metadata, 'momentLabel')
    ?? null;
}

function extractReplayAndProofTags(message: ChatMessage): readonly string[] {
  const tags: string[] = [];
  if (message.replay.replayId) tags.push('replay');
  if (message.replay.sceneId) tags.push('scene');
  if (message.replay.momentId) tags.push('moment');
  if (message.proof.proofHash) tags.push('proof');
  if (message.learning.learningTriggered) tags.push('learning');
  return tags;
}

function extractStringArrayMetadata(metadata: ChatMessage['metadata'], key: string): string[] {
  const value = metadata[key];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.toLowerCase());
}

function kindFromActorRole(actorRole?: string | null): ChatRelationshipCounterpartKind {
  const role = String(actorRole ?? '').toUpperCase();
  if (role.includes('HELPER')) return 'HELPER';
  if (role.includes('RIVAL')) return 'RIVAL';
  if (role.includes('ARCHIVIST')) return 'ARCHIVIST';
  if (role.includes('AMBIENT')) return 'AMBIENT';
  if (role.includes('SYSTEM') || role.includes('LIVEOPS')) return 'SYSTEM';
  if (role.includes('BOT') || role.includes('HATER')) return 'BOT';
  return 'NPC';
}

function eventTypeFromNpcRole(actorRole?: string | null, lowerBody = ''): ChatRelationshipEventType {
  if (isHelperRole(actorRole)) return 'HELPER_RESCUE_EMITTED';
  if (isRivalRole(actorRole)) return 'RIVAL_WITNESS_EMITTED';
  if (isArchivistRole(actorRole)) return 'ARCHIVIST_WITNESS_EMITTED';
  if (isHaterRole(actorRole) && /retreat|withdraw|enough/.test(lowerBody)) return 'BOT_RETREAT_EMITTED';
  if (isHaterRole(actorRole)) return 'BOT_TAUNT_EMITTED';
  return 'AMBIENT_WITNESS_EMITTED';
}

function isHelperRole(actorRole?: string | null): boolean {
  return String(actorRole ?? '').toUpperCase() === 'HELPER';
}

function isHaterRole(actorRole?: string | null): boolean {
  return String(actorRole ?? '').toUpperCase() === 'HATER' || String(actorRole ?? '').toUpperCase() === 'NPC_HATER';
}

function isRivalRole(actorRole?: string | null): boolean {
  return String(actorRole ?? '').toUpperCase() === 'RIVAL';
}

function isArchivistRole(actorRole?: string | null): boolean {
  return String(actorRole ?? '').toUpperCase() === 'ARCHIVIST';
}

function severityToPressureBand(severity?: string | null): ChatRelationshipPressureBand {
  const value = String(severity ?? '').toUpperCase();
  if (value === 'CRITICAL') return 'CRITICAL';
  if (value === 'HIGH') return 'HIGH';
  if (value === 'MEDIUM') return 'MEDIUM';
  return 'LOW';
}

function pressureBandToSeverity(pressureBand?: ChatRelationshipPressureBand): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (pressureBand === 'CRITICAL') return 'CRITICAL';
  if (pressureBand === 'HIGH') return 'HIGH';
  if (pressureBand === 'MEDIUM') return 'MEDIUM';
  return 'LOW';
}

function callbackTail(signal: ChatRelationshipNpcSignal, actorRole?: string | null): string {
  if (isHelperRole(actorRole)) return 'You have already survived worse than this window.';
  if (signal.publicPressureBias01 >= 0.60) return 'The room remembers how this usually goes.';
  if (signal.predictiveConfidence01 >= 0.68) return 'I know this version of you already.';
  return 'We have unfinished business here.';
}

function softenForRespect(line: string): string {
  return line
    .replace(/You are /g, 'You may be ')
    .replace(/You still think/g, 'You may still think')
    .replace(/I am /g, 'I remain ');
}

function sharpenForPressure(line: string, publicBias: boolean): string {
  const suffix = publicBias ? ' Everyone in the room can hear the angle now.' : ' You are running out of quiet places to hide it.';
  return /\.$/.test(line) ? `${line.slice(0, -1)}.${suffix}` : `${line} ${suffix}`;
}

function makeObsessive(line: string): string {
  if (/again|remember|last time/i.test(line)) return line;
  return `${line} I have been tracking this pattern longer than you think.`;
}

function stabilizeHelperLine(line: string): string {
  if (/steady|breathe|sequence|clean/i.test(line)) return line;
  return `${line} Breathe and keep the sequence clean.`;
}

function makeClinical(line: string): string {
  if (/review|model|sequence|pattern|data/i.test(line)) return line;
  return `${line} The pattern is measurable now.`;
}

function makeWounded(line: string): string {
  if (/after|because|scar|cost/i.test(line)) return line;
  return `${line} The cost of this is not abstract anymore.`;
}

function normalizeSentence(line: string): string {
  return line.replace(/\s+/g, ' ').replace(/\s+([.,!?;:])/g, '$1').trim();
}

function isPublicChannel(channelId?: string | null): boolean {
  const normalized = String(channelId ?? '').toUpperCase();
  return normalized === 'GLOBAL' || normalized === 'LOBBY';
}

function truncateSentence(value: string, max: number): string {
  const text = String(value ?? '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3)).trim()}...`;
}

function humanizeEventType(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function stringifyMessageBody(message: ChatMessage): string {
  if (message.plainText && message.plainText.trim()) return normalizeSentence(message.plainText);
  return normalizeSentence(message.bodyParts.map((part) => {
    switch (part.type) {
      case 'TEXT':
        return part.text;
      case 'SYSTEM_TAG':
        return part.value ? `${part.tag}:${part.value}` : part.tag;
      case 'QUOTE':
        return part.text;
      case 'OFFER':
        return part.summary;
      case 'EMOTE':
        return part.name;
      default:
        return '';
    }
  }).filter(Boolean).join(' '));
}

function readStringMetadata(metadata: ChatMessage['metadata'], key: string): string | undefined {
  const value = metadata[key];
  return typeof value === 'string' ? value : undefined;
}

function seedVectorForCounterpartKind(kind: ChatRelationshipCounterpartKind): ChatRelationshipVector {
  const vector = { ...emptyRelationshipVector() };
  if (kind === 'HELPER') {
    vector.respect01 = 0.26;
    vector.patience01 = 0.56;
    vector.traumaDebt01 = 0.14;
  } else if (kind === 'RIVAL') {
    vector.respect01 = 0.24;
    vector.fear01 = 0.16;
    vector.unfinishedBusiness01 = 0.22;
  } else if (kind === 'BOT') {
    vector.contempt01 = 0.26;
    vector.predictiveConfidence01 = 0.28;
    vector.unfinishedBusiness01 = 0.18;
  } else if (kind === 'ARCHIVIST') {
    vector.fascination01 = 0.32;
    vector.patience01 = 0.52;
    vector.familiarity01 = 0.18;
  } else if (kind === 'SYSTEM') {
    vector.predictiveConfidence01 = 0.34;
    vector.patience01 = 0.36;
  }
  return vector;
}

function kindToWitnessSeed(kind: ChatRelationshipCounterpartKind): number {
  if (kind === 'AMBIENT' || kind === 'ARCHIVIST') return 0.26;
  if (kind === 'RIVAL' || kind === 'BOT') return 0.18;
  if (kind === 'HELPER') return 0.16;
  return 0.12;
}

function classifyMomentumBand(state: MutableRelationshipCounterpartState): ChatRelationshipMomentumBand {
  const score = clamp01(state.intensity01 * 0.44 + state.witnessHeat01 * 0.24 + state.selectionScore01 * 0.20 + state.escalationRisk01 * 0.12);
  if (score >= 0.82) return 'FEVER';
  if (score >= 0.60) return 'HOT';
  if (score >= 0.34) return 'WARM';
  return 'QUIET';
}

function scoreChannelWitnessHeat(value: number): number {
  return clamp01(value);
}

function scoreRoomWitnessHeat(value: number): number {
  return clamp01(value);
}

function randomId(prefix: string, seed: string, now: number): string {
  return `${prefix}_${Math.abs(stableHash(`${prefix}:${seed}:${now}`)).toString(36)}`;
}

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function incrementMap<TKey extends string>(map: Map<TKey, number>, key: TKey | string, amount: number): void {
  const normalized = String(key) as TKey;
  map.set(normalized, (map.get(normalized) ?? 0) + amount);
}

function clampCount(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value as number));
}

function matchesEventQuery(event: ChatRelationshipEventDescriptor, query: ChatRelationshipEventQuery): boolean {
  if (query.counterpartId && event.counterpartId !== query.counterpartId) return false;
  if (query.eventTypes?.length && !query.eventTypes.includes(event.eventType)) return false;
  if (query.channelId && event.channelId !== query.channelId) return false;
  if (query.roomId && event.roomId !== query.roomId) return false;
  if (query.actorRole && event.actorRole !== query.actorRole) return false;
  if (query.tag && !(event.tags ?? []).includes(query.tag.toLowerCase())) return false;
  if (query.since != null && Number(event.createdAt) < query.since) return false;
  if (query.until != null && Number(event.createdAt) > query.until) return false;
  return true;
}
