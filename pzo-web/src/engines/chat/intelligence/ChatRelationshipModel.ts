
/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT RELATIONSHIP MODEL
 * FILE: pzo-web/src/engines/chat/intelligence/ChatRelationshipModel.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Persistent, memory-aware rivalry / helper / witness relationship evolution
 * layer for the frontend chat lane.
 *
 * This model is intentionally deterministic and additive:
 * - authored text remains authored
 * - selectors can project relationship state without needing orchestration code
 * - ChatNpcDirector can ask for stance / objective / selection weight
 * - Phase 2 bridges can persist the richer state without breaking legacy views
 *
 * The model does NOT try to be a freeform writer.
 * It computes relationship pressure, callbacks, stance drift, and safe, limited
 * surface modulation around canonical authored lines.
 * ============================================================================
 */

import type { BotId } from '../../battle/types';
import type { ChatFeatureSnapshot, ChatVisibleChannel, UnixMs } from '../types';

import {
  clamp01,
  emptyRelationshipVector,
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
} from '../../../../../shared/contracts/chat/relationship';

export type {
  ChatRelationshipLegacyProjection,
  ChatRelationshipNpcSignal,
  ChatRelationshipSnapshot,
  ChatRelationshipSummaryView,
};

export interface ChatRelationshipModelOptions {
  readonly playerId?: string | null;
  readonly snapshot?: ChatRelationshipSnapshot;
  readonly now?: UnixMs;
}

export interface ChatRelationshipPlayerMessageInput {
  readonly counterpartId?: string | null;
  readonly counterpartKind?: ChatRelationshipCounterpartKind;
  readonly botId?: BotId | string | null;
  readonly channelId?: ChatVisibleChannel | string | null;
  readonly messageId?: string | null;
  readonly body: string;
  readonly responseClass?: 'QUESTION' | 'ANGRY' | 'TROLL' | 'FLEX' | 'CALM' | 'UNKNOWN';
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
  readonly context?: string | null;
  readonly severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly body: string;
  readonly emittedAt?: UnixMs;
}

export interface ChatRelationshipGameEventInput {
  readonly counterpartId?: string | null;
  readonly counterpartKind?: ChatRelationshipCounterpartKind;
  readonly botId?: BotId | string | null;
  readonly channelId?: string | null;
  readonly eventType: string;
  readonly summary?: string;
  readonly pressureBand?: ChatRelationshipPressureBand;
  readonly tags?: readonly string[];
  readonly createdAt?: UnixMs;
}

export interface ChatRelationshipSignalRequest {
  readonly counterpartId: string;
  readonly counterpartKind?: ChatRelationshipCounterpartKind;
  readonly botId?: BotId | string | null;
  readonly actorRole?: string | null;
  readonly context?: string | null;
  readonly channelId?: string | null;
  readonly pressureBand?: ChatRelationshipPressureBand;
  readonly publicWitness01?: number;
  readonly now?: UnixMs;
}

type ResponseClass = NonNullable<ChatRelationshipPlayerMessageInput['responseClass']>;
type MutableRelationshipVector = { -readonly [K in keyof ChatRelationshipVector]: ChatRelationshipVector[K] };
type MutableRelationshipEventDescriptor = { -readonly [K in keyof ChatRelationshipEventDescriptor]: ChatRelationshipEventDescriptor[K] };
type MutableRelationshipCallbackHint = { -readonly [K in keyof ChatRelationshipCallbackHint]: ChatRelationshipCallbackHint[K] };
type DominantAxis = ChatRelationshipCounterpartState['dominantAxes'][number];

type MutableRelationshipCounterpartState = {
  -readonly [K in keyof ChatRelationshipCounterpartState]:
    K extends 'vector'
      ? MutableRelationshipVector
      : K extends 'callbackHints'
        ? MutableRelationshipCallbackHint[]
        : K extends 'eventHistoryTail'
          ? MutableRelationshipEventDescriptor[]
          : K extends 'dominantAxes'
            ? DominantAxis[]
            : ChatRelationshipCounterpartState[K];
};

type MutableRelationshipDelta = { -readonly [K in keyof ChatRelationshipVector]?: number };

const HISTORY_LIMIT = 64;
const CALLBACK_LIMIT = 12;
const MAX_COUNTERPARTS = 96;

export class ChatRelationshipModel {
  private readonly createdAt: UnixMs;
  private updatedAt: UnixMs;
  private playerId?: string | null;
  private totalEventCount = 0;
  private readonly counterparts = new Map<string, MutableRelationshipCounterpartState>();
  private readonly focusedCounterpartByChannel = new Map<string, string>();

  public constructor(options: ChatRelationshipModelOptions = {}) {
    const now = options.now ?? (Date.now() as UnixMs);
    this.createdAt = now;
    this.updatedAt = now;
    this.playerId = options.playerId ?? null;
    if (options.snapshot) this.restore(options.snapshot);
  }

  public restore(snapshot: ChatRelationshipSnapshot): void {
    this.counterparts.clear();
    this.focusedCounterpartByChannel.clear();
    this.updatedAt = snapshot.updatedAt as UnixMs;
    this.playerId = snapshot.playerId ?? null;
    this.totalEventCount = snapshot.totalEventCount;

    for (const state of snapshot.counterparts) {
      this.counterparts.set(state.counterpartId, {
        ...state,
        vector: { ...state.vector },
        callbackHints: state.callbackHints.map((hint) => ({ ...hint })),
        eventHistoryTail: state.eventHistoryTail.map((event) => ({ ...event })),
        dominantAxes: [...state.dominantAxes],
      });
    }

    for (const [channelId, counterpartId] of Object.entries(snapshot.focusedCounterpartByChannel)) {
      if (counterpartId) this.focusedCounterpartByChannel.set(channelId, counterpartId);
    }
  }

  public snapshot(now: UnixMs = Date.now() as UnixMs): ChatRelationshipSnapshot {
    return {
      createdAt: this.createdAt,
      updatedAt: now,
      playerId: this.playerId ?? null,
      counterparts: [...this.counterparts.values()]
        .sort((a, b) => Number(b.lastTouchedAt) - Number(a.lastTouchedAt) || a.counterpartId.localeCompare(b.counterpartId))
        .map((state) => this.cloneState(state)),
      totalEventCount: this.totalEventCount,
      focusedCounterpartByChannel: Object.fromEntries(this.focusedCounterpartByChannel.entries()),
    };
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

  public selectCounterpartFocus(channelId?: string | null, candidateIds?: readonly string[]): string | undefined {
    if (channelId && this.focusedCounterpartByChannel.has(channelId)) {
      const focused = this.focusedCounterpartByChannel.get(channelId);
      if (!candidateIds?.length || (focused && candidateIds.includes(focused))) return focused;
    }

    const candidates = candidateIds?.length
      ? candidateIds
          .map((id) => this.counterparts.get(id))
          .filter((value): value is MutableRelationshipCounterpartState => Boolean(value))
      : [...this.counterparts.values()];

    if (!candidates.length) return undefined;

    const selected = [...candidates].sort((a, b) => {
      const scoreA =
        a.intensity01 * 0.45 +
        a.vector.obsession01 * 0.20 +
        a.vector.unfinishedBusiness01 * 0.20 +
        a.vector.predictiveConfidence01 * 0.15;
      const scoreB =
        b.intensity01 * 0.45 +
        b.vector.obsession01 * 0.20 +
        b.vector.unfinishedBusiness01 * 0.20 +
        b.vector.predictiveConfidence01 * 0.15;
      return scoreB - scoreA || Number(b.lastTouchedAt) - Number(a.lastTouchedAt);
    })[0];

    if (channelId) this.focusedCounterpartByChannel.set(channelId, selected.counterpartId);
    return selected.counterpartId;
  }

  public notePlayerMessage(input: ChatRelationshipPlayerMessageInput): void {
    const now = input.createdAt ?? (Date.now() as UnixMs);
    const counterpartId =
      input.counterpartId ??
      this.selectCounterpartFocus(input.channelId ?? undefined) ??
      'room:general';

    const state = this.ensureCounterpart(
      counterpartId,
      input.counterpartKind ?? 'NPC',
      now,
      input.botId ?? null,
      'PLAYER_TARGET',
    );

    const body = String(input.body ?? '').trim();
    const normalized = body.toLowerCase();
    const responseClass: ResponseClass = input.responseClass ?? inferResponseClass(body);
    const eventType = mapResponseClassToEventType(responseClass, normalized);
    const tags = new Set((input.tags ?? []).map((tag) => String(tag).toLowerCase()));

    const delta = blankDelta();
    if (responseClass === 'QUESTION') {
      delta.fascination01 = (delta.fascination01 ?? 0) + 0.08;
      delta.patience01 = (delta.patience01 ?? 0) + 0.04;
      delta.respect01 = (delta.respect01 ?? 0) + 0.03;
    } else if (responseClass === 'ANGRY') {
      delta.contempt01 = (delta.contempt01 ?? 0) + 0.06;
      delta.fear01 = (delta.fear01 ?? 0) + 0.04;
      delta.unfinishedBusiness01 = (delta.unfinishedBusiness01 ?? 0) + 0.06;
      delta.predictiveConfidence01 = (delta.predictiveConfidence01 ?? 0) + 0.03;
    } else if (responseClass === 'TROLL') {
      delta.contempt01 = (delta.contempt01 ?? 0) + 0.04;
      delta.fascination01 = (delta.fascination01 ?? 0) + 0.03;
      delta.predictiveConfidence01 = (delta.predictiveConfidence01 ?? 0) + 0.05;
    } else if (responseClass === 'FLEX') {
      delta.fear01 = (delta.fear01 ?? 0) + 0.06;
      delta.contempt01 = (delta.contempt01 ?? 0) + 0.03;
      delta.unfinishedBusiness01 = (delta.unfinishedBusiness01 ?? 0) + 0.04;
    } else if (responseClass === 'CALM') {
      delta.respect01 = (delta.respect01 ?? 0) + 0.07;
      delta.patience01 = (delta.patience01 ?? 0) + 0.06;
      delta.predictiveConfidence01 = (delta.predictiveConfidence01 ?? 0) - 0.02;
    }

    if (normalized.length <= 18) {
      delta.predictiveConfidence01 = (delta.predictiveConfidence01 ?? 0) + 0.05;
      delta.familiarity01 = (delta.familiarity01 ?? 0) + 0.02;
    } else if (normalized.length >= 100) {
      delta.patience01 = (delta.patience01 ?? 0) + 0.04;
      delta.fascination01 = (delta.fascination01 ?? 0) + 0.03;
    }

    if (tags.has('shield') || normalized.includes('hold')) {
      delta.respect01 = (delta.respect01 ?? 0) + 0.03;
      delta.patience01 = (delta.patience01 ?? 0) + 0.02;
    }
    if (tags.has('offer') || String(input.channelId) === 'DEAL_ROOM') {
      delta.fear01 = (delta.fear01 ?? 0) + 0.03;
      delta.predictiveConfidence01 = (delta.predictiveConfidence01 ?? 0) + 0.04;
      delta.unfinishedBusiness01 = (delta.unfinishedBusiness01 ?? 0) + 0.05;
    }
    if (normalized.includes('proof') || normalized.includes('show')) {
      delta.respect01 = (delta.respect01 ?? 0) + 0.03;
      delta.predictiveConfidence01 = (delta.predictiveConfidence01 ?? 0) - 0.02;
    }
    if (normalized.includes('sorry') || normalized.includes('my fault')) {
      delta.contempt01 = (delta.contempt01 ?? 0) - 0.03;
      delta.familiarity01 = (delta.familiarity01 ?? 0) + 0.04;
    }
    if (normalized.includes('comeback')) {
      delta.respect01 = (delta.respect01 ?? 0) + 0.06;
      delta.unfinishedBusiness01 = (delta.unfinishedBusiness01 ?? 0) + 0.04;
    }

    this.applyDelta(state, delta, now, 0.85);
    this.recordEvent(state, {
      eventId: randomId('rel_evt', counterpartId, now),
      eventType,
      counterpartId,
      counterpartKind: state.counterpartKind,
      playerId: this.playerId ?? null,
      botId: state.botId ?? null,
      channelId: input.channelId ?? null,
      sourceMessageId: input.messageId ?? null,
      pressureBand: input.pressureBand,
      publicWitness01: isPublicChannel(input.channelId) ? 0.75 : 0.20,
      intensity01: clamp01(0.35 + normalized.length / 240),
      summary: body || responseClass,
      rawText: body || null,
      tags: [...(input.tags ?? []), responseClass.toLowerCase()],
      createdAt: now,
    });

    if (input.channelId) this.focusedCounterpartByChannel.set(String(input.channelId), counterpartId);
    this.recomputeState(state, now);
    this.updatedAt = now;
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
    const delta = blankDelta();

    if (severity === 'CRITICAL') {
      delta.fear01 = (delta.fear01 ?? 0) + 0.08;
      delta.obsession01 = (delta.obsession01 ?? 0) + 0.07;
      delta.unfinishedBusiness01 = (delta.unfinishedBusiness01 ?? 0) + 0.08;
      delta.predictiveConfidence01 = (delta.predictiveConfidence01 ?? 0) + 0.06;
    } else if (severity === 'HIGH') {
      delta.fear01 = (delta.fear01 ?? 0) + 0.06;
      delta.obsession01 = (delta.obsession01 ?? 0) + 0.05;
      delta.predictiveConfidence01 = (delta.predictiveConfidence01 ?? 0) + 0.05;
    } else {
      delta.familiarity01 = (delta.familiarity01 ?? 0) + 0.03;
      delta.predictiveConfidence01 = (delta.predictiveConfidence01 ?? 0) + 0.02;
    }

    const lower = String(input.body ?? '').toLowerCase();
    if (isHelperRole(input.actorRole)) {
      delta.respect01 = (delta.respect01 ?? 0) + 0.06;
      delta.patience01 = (delta.patience01 ?? 0) + 0.05;
      delta.traumaDebt01 = (delta.traumaDebt01 ?? 0) + (severity === 'CRITICAL' ? 0.08 : 0.04);
    } else if (isHaterRole(input.actorRole)) {
      delta.contempt01 = (delta.contempt01 ?? 0) + 0.06;
      delta.fascination01 = (delta.fascination01 ?? 0) + 0.04;
      delta.unfinishedBusiness01 = (delta.unfinishedBusiness01 ?? 0) + 0.07;
    } else if (isRivalRole(input.actorRole)) {
      delta.respect01 = (delta.respect01 ?? 0) + 0.04;
      delta.fear01 = (delta.fear01 ?? 0) + 0.03;
      delta.unfinishedBusiness01 = (delta.unfinishedBusiness01 ?? 0) + 0.05;
    } else if (isArchivistRole(input.actorRole)) {
      delta.familiarity01 = (delta.familiarity01 ?? 0) + 0.05;
      delta.fascination01 = (delta.fascination01 ?? 0) + 0.05;
      delta.patience01 = (delta.patience01 ?? 0) + 0.03;
    }

    if (lower.includes('remember') || lower.includes('again') || lower.includes('last time')) {
      delta.obsession01 = (delta.obsession01 ?? 0) + 0.05;
      delta.familiarity01 = (delta.familiarity01 ?? 0) + 0.05;
      this.addCallbackHint(state, {
        callbackId: randomId('rel_cb', input.counterpartId, now),
        label: 'Callback seeded',
        text: truncateSentence(input.body, 120),
        weight01: 0.58,
      });
    }

    this.applyDelta(state, delta, now, 0.75);
    this.recordEvent(state, {
      eventId: randomId('rel_evt', input.counterpartId, now),
      eventType: eventTypeFromNpcRole(input.actorRole),
      counterpartId: input.counterpartId,
      counterpartKind: state.counterpartKind,
      playerId: this.playerId ?? null,
      botId: state.botId ?? null,
      actorRole: input.actorRole ?? null,
      channelId: input.channelId ?? null,
      pressureBand: severityToPressureBand(severity),
      publicWitness01: isPublicChannel(input.channelId) ? 0.82 : 0.18,
      intensity01:
        severity === 'CRITICAL'
          ? 0.92
          : severity === 'HIGH'
            ? 0.76
            : severity === 'MEDIUM'
              ? 0.54
              : 0.32,
      summary: truncateSentence(input.body, 160),
      rawText: input.body,
      tags: [String(input.actorRole ?? 'NPC').toLowerCase(), String(input.context ?? 'utterance').toLowerCase()],
      createdAt: now,
    });

    if (input.channelId) this.focusedCounterpartByChannel.set(String(input.channelId), input.counterpartId);
    this.recomputeState(state, now);
    this.updatedAt = now;
  }

  public noteGameEvent(input: ChatRelationshipGameEventInput): void {
    const now = input.createdAt ?? (Date.now() as UnixMs);
    const eventType = mapGameEventToRelationshipEvent(input.eventType);
    const counterpartId =
      input.counterpartId ??
      this.selectCounterpartFocus(input.channelId ?? undefined) ??
      'room:general';

    const state = this.ensureCounterpart(
      counterpartId,
      input.counterpartKind ?? 'NPC',
      now,
      input.botId ?? null,
      'EVENT',
    );

    const delta = deltaForGameEvent(eventType);
    this.applyDelta(state, delta, now, 0.90);
    this.recordEvent(state, {
      eventId: randomId('rel_evt', counterpartId, now),
      eventType,
      counterpartId,
      counterpartKind: state.counterpartKind,
      playerId: this.playerId ?? null,
      botId: state.botId ?? null,
      channelId: input.channelId ?? null,
      pressureBand: input.pressureBand,
      publicWitness01: isPublicChannel(input.channelId) ? 0.70 : 0.20,
      intensity01: clamp01(0.40 + (eventType === 'PLAYER_COMEBACK' || eventType === 'PLAYER_COLLAPSE' ? 0.22 : 0.08)),
      summary: input.summary ?? humanizeEventType(eventType),
      rawText: input.summary ?? null,
      tags: [...(input.tags ?? [])],
      createdAt: now,
    });

    if (input.channelId) this.focusedCounterpartByChannel.set(String(input.channelId), counterpartId);
    this.recomputeState(state, now);
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

    const publicBias = clamp01(
      (request.publicWitness01 ?? (isPublicChannel(request.channelId) ? 0.80 : 0.20)) * 0.55 +
      state.publicPressureBias01 * 0.45,
    );
    const privateBias = clamp01(1 - publicBias * 0.72);
    const intensity = clamp01(
      state.intensity01 * 0.68 +
      state.vector.unfinishedBusiness01 * 0.12 +
      state.vector.obsession01 * 0.12 +
      state.vector.predictiveConfidence01 * 0.08,
    );
    const volatility = clamp01(
      state.volatility01 * 0.62 +
      state.vector.fear01 * 0.12 +
      state.vector.contempt01 * 0.10 +
      (request.pressureBand === 'CRITICAL' ? 0.10 : request.pressureBand === 'HIGH' ? 0.06 : 0.02),
    );
    const selectionWeight = clamp01(
      state.intensity01 * 0.32 +
      state.vector.obsession01 * 0.18 +
      state.vector.unfinishedBusiness01 * 0.18 +
      state.vector.predictiveConfidence01 * 0.10 +
      state.vector.fascination01 * 0.08 +
      state.vector.respect01 * (isHelperRole(request.actorRole) ? 0.10 : 0.04) +
      state.vector.contempt01 * (isHaterRole(request.actorRole) ? 0.10 : 0.02) +
      publicBias * (isHaterRole(request.actorRole) ? 0.08 : 0.03),
    );

    const notes: string[] = [];
    if (state.vector.obsession01 >= 0.72) notes.push('obsession_high');
    if (state.vector.unfinishedBusiness01 >= 0.65) notes.push('unfinished_business_high');
    if (state.vector.predictiveConfidence01 >= 0.68) notes.push('predictive_confidence_high');
    if (state.vector.respect01 >= 0.62) notes.push('respect_present');
    if (state.vector.contempt01 >= 0.62) notes.push('contempt_present');
    if (publicBias >= 0.60) notes.push('public_pressure_bias');

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
      readonly pressureBand?: ChatRelationshipPressureBand;
    } = {},
  ): string {
    let line = String(baseLine ?? '').trim();
    if (!line) return line;

    const lower = line.toLowerCase();
    if (
      signal.callbackHint &&
      !lower.includes('again') &&
      !lower.includes('remember') &&
      signal.unfinishedBusiness01 >= 0.68
    ) {
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

    return normalizeSentence(line);
  }

  public projectLegacy(counterpartId: string): ChatRelationshipLegacyProjection {
    const state =
      this.counterparts.get(counterpartId) ??
      this.ensureCounterpart(counterpartId, 'NPC', Date.now() as UnixMs, null, null);

    const trust = clamp01(
      state.vector.respect01 * 0.34 +
      state.vector.familiarity01 * 0.24 +
      state.vector.patience01 * 0.22 +
      (1 - state.vector.contempt01) * 0.20,
    );
    const rivalry = clamp01(
      state.vector.unfinishedBusiness01 * 0.40 +
      state.vector.obsession01 * 0.18 +
      state.vector.contempt01 * 0.24 +
      state.vector.fear01 * 0.18,
    );
    const rescueDebt = clamp01(
      state.vector.traumaDebt01 * 0.70 +
      state.vector.respect01 * 0.15 +
      state.vector.familiarity01 * 0.15,
    );
    const adviceObedience = clamp01(
      state.vector.patience01 * 0.48 +
      state.vector.respect01 * 0.24 +
      (1 - state.vector.contempt01) * 0.14 +
      state.vector.familiarity01 * 0.14,
    );

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
      escalationTier:
        rivalry >= 0.82 || state.vector.obsession01 >= 0.82
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
      return existing;
    }

    if (this.counterparts.size >= MAX_COUNTERPARTS) {
      const oldest = [...this.counterparts.values()].sort(
        (a, b) => Number(a.lastTouchedAt) - Number(b.lastTouchedAt),
      )[0];
      if (oldest) this.counterparts.delete(oldest.counterpartId);
    }

    const created: MutableRelationshipCounterpartState = {
      counterpartId,
      counterpartKind,
      playerId: this.playerId ?? null,
      botId: botId != null ? String(botId) : null,
      actorRole: actorRole != null ? String(actorRole) : null,
      lastChannelId: null,
      vector: { ...emptyRelationshipVector() },
      stance:
        counterpartKind === 'HELPER'
          ? 'PROTECTIVE'
          : counterpartKind === 'ARCHIVIST'
            ? 'CURIOUS'
            : 'PROBING',
      objective:
        counterpartKind === 'HELPER'
          ? 'RESCUE'
          : counterpartKind === 'ARCHIVIST'
            ? 'WITNESS'
            : 'STUDY',
      intensity01: 0.18,
      volatility01: 0.14,
      publicPressureBias01: 0.52,
      privatePressureBias01: 0.48,
      callbackHints: [],
      eventHistoryTail: [],
      dominantAxes: ['FASCINATION', 'PATIENCE'],
      lastTouchedAt: now,
    };

    this.counterparts.set(counterpartId, created);
    return created;
  }

  private applyDelta(
    state: MutableRelationshipCounterpartState,
    delta: MutableRelationshipDelta,
    now: UnixMs,
    weight: number,
  ): void {
    const vector: MutableRelationshipVector = { ...state.vector };
    vector.contempt01 = clamp01(vector.contempt01 + (delta.contempt01 ?? 0) * weight);
    vector.fascination01 = clamp01(vector.fascination01 + (delta.fascination01 ?? 0) * weight);
    vector.respect01 = clamp01(vector.respect01 + (delta.respect01 ?? 0) * weight);
    vector.fear01 = clamp01(vector.fear01 + (delta.fear01 ?? 0) * weight);
    vector.obsession01 = clamp01(vector.obsession01 + (delta.obsession01 ?? 0) * weight);
    vector.patience01 = clamp01(vector.patience01 + (delta.patience01 ?? 0) * weight);
    vector.familiarity01 = clamp01(vector.familiarity01 + (delta.familiarity01 ?? 0) * weight);
    vector.predictiveConfidence01 = clamp01(
      vector.predictiveConfidence01 + (delta.predictiveConfidence01 ?? 0) * weight,
    );
    vector.traumaDebt01 = clamp01(vector.traumaDebt01 + (delta.traumaDebt01 ?? 0) * weight);
    vector.unfinishedBusiness01 = clamp01(
      vector.unfinishedBusiness01 + (delta.unfinishedBusiness01 ?? 0) * weight,
    );
    state.vector = vector;
    state.lastTouchedAt = now;
  }

  private recordEvent(
    state: MutableRelationshipCounterpartState,
    event: ChatRelationshipEventDescriptor,
  ): void {
    state.eventHistoryTail.unshift({ ...event });
    if (state.eventHistoryTail.length > HISTORY_LIMIT) state.eventHistoryTail.length = HISTORY_LIMIT;
    this.totalEventCount += 1;
  }

  private recomputeState(state: MutableRelationshipCounterpartState, now: UnixMs): void {
    state.intensity01 = clamp01(
      state.vector.contempt01 * 0.18 +
      state.vector.fascination01 * 0.08 +
      state.vector.respect01 * 0.08 +
      state.vector.fear01 * 0.10 +
      state.vector.obsession01 * 0.18 +
      state.vector.predictiveConfidence01 * 0.12 +
      state.vector.unfinishedBusiness01 * 0.18 +
      state.vector.traumaDebt01 * 0.08,
    );

    state.volatility01 = clamp01(
      state.vector.contempt01 * 0.20 +
      state.vector.fear01 * 0.16 +
      state.vector.obsession01 * 0.18 +
      (1 - state.vector.patience01) * 0.18 +
      state.vector.unfinishedBusiness01 * 0.16 +
      (1 - state.vector.familiarity01) * 0.12,
    );

    state.publicPressureBias01 = clamp01(
      state.publicPressureBias01 * 0.55 +
      state.vector.contempt01 * 0.18 +
      state.vector.unfinishedBusiness01 * 0.12 +
      state.vector.fear01 * 0.08 +
      state.vector.respect01 * 0.07,
    );
    state.privatePressureBias01 = clamp01(1 - state.publicPressureBias01 * 0.78);
    state.dominantAxes = dominantAxes(state.vector);
    state.stance = deriveStance(state.vector, state.counterpartKind);
    state.objective = deriveObjective(state.vector, state.counterpartKind, state.stance);
    state.lastTouchedAt = now;
  }

  private addCallbackHint(
    state: MutableRelationshipCounterpartState,
    hint: ChatRelationshipCallbackHint,
  ): void {
    state.callbackHints.unshift({ ...hint });
    if (state.callbackHints.length > CALLBACK_LIMIT) state.callbackHints.length = CALLBACK_LIMIT;
  }

  private cloneState(state: MutableRelationshipCounterpartState): ChatRelationshipCounterpartState {
    return {
      ...state,
      vector: { ...state.vector },
      callbackHints: state.callbackHints.map((hint) => ({ ...hint })),
      eventHistoryTail: state.eventHistoryTail.map((event) => ({ ...event })),
      dominantAxes: [...state.dominantAxes],
    };
  }
}

function inferResponseClass(body: string): ResponseClass {
  const text = String(body ?? '').trim().toLowerCase();
  if (!text) return 'UNKNOWN';
  if (text.includes('?')) return 'QUESTION';
  if (/(mad|angry|hate|stupid|trash|idiot|damn)/i.test(text)) return 'ANGRY';
  if (/(lol|lmao|rofl|cope|cry|skill issue)/i.test(text)) return 'TROLL';
  if (/(easy|light work|too easy|i win|i'm him|i am him|built different)/i.test(text)) return 'FLEX';
  if (/(okay|understood|steady|got it|copy|thanks|thank you)/i.test(text)) return 'CALM';
  return 'UNKNOWN';
}

function mapResponseClassToEventType(
  responseClass: ResponseClass,
  normalized: string,
): ChatRelationshipEventType {
  if (responseClass === 'QUESTION') return 'PLAYER_QUESTION';
  if (responseClass === 'ANGRY') return 'PLAYER_ANGER';
  if (responseClass === 'TROLL') return 'PLAYER_TROLL';
  if (responseClass === 'FLEX') return normalized.includes('bluff') ? 'PLAYER_BLUFF' : 'PLAYER_FLEX';
  if (responseClass === 'CALM') return 'PLAYER_CALM';
  if (normalized.includes('wait') || normalized.includes('hold')) return 'PLAYER_HESITATION';
  return 'PLAYER_MESSAGE';
}

function deltaForGameEvent(eventType: ChatRelationshipEventType): MutableRelationshipDelta {
  switch (eventType) {
    case 'PLAYER_COMEBACK':
      return { respect01: 0.10, fear01: 0.06, unfinishedBusiness01: 0.08, fascination01: 0.05 };
    case 'PLAYER_COLLAPSE':
      return { contempt01: 0.07, fear01: 0.05, obsession01: 0.05, unfinishedBusiness01: 0.09, predictiveConfidence01: 0.04 };
    case 'PLAYER_BREACH':
      return { fear01: 0.06, contempt01: 0.04, unfinishedBusiness01: 0.07, traumaDebt01: 0.05 };
    case 'PLAYER_PERFECT_DEFENSE':
      return { respect01: 0.09, fear01: 0.05, predictiveConfidence01: -0.04, familiarity01: 0.03 };
    case 'PLAYER_FAILED_GAMBLE':
      return { contempt01: 0.05, predictiveConfidence01: 0.07, unfinishedBusiness01: 0.06 };
    case 'NEGOTIATION_WINDOW':
      return { fear01: 0.04, fascination01: 0.04, predictiveConfidence01: 0.04, unfinishedBusiness01: 0.03 };
    case 'MARKET_ALERT':
      return { patience01: 0.03, fear01: 0.03, fascination01: 0.03 };
    case 'PLAYER_NEAR_SOVEREIGNTY':
      return { respect01: 0.08, obsession01: 0.06, unfinishedBusiness01: 0.06, fear01: 0.05 };
    case 'RUN_START':
      return { fascination01: 0.03, patience01: 0.03 };
    case 'RUN_END':
      return { familiarity01: 0.04, unfinishedBusiness01: 0.04 };
    default:
      return { familiarity01: 0.02, fascination01: 0.02 };
  }
}

function mapGameEventToRelationshipEvent(eventType: string): ChatRelationshipEventType {
  const normalized = String(eventType ?? '').toUpperCase();
  if (normalized.includes('COMEBACK')) return 'PLAYER_COMEBACK';
  if (normalized.includes('BANKRUPT') || normalized.includes('LOSS') || normalized.includes('LOST') || normalized.includes('COLLAPSE')) return 'PLAYER_COLLAPSE';
  if (normalized.includes('BREACH') || normalized.includes('SHIELD')) return 'PLAYER_BREACH';
  if (normalized.includes('PERFECT') || normalized.includes('FORTIFIED')) return 'PLAYER_PERFECT_DEFENSE';
  if (normalized.includes('GAMBLE')) return 'PLAYER_FAILED_GAMBLE';
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
): ChatRelationshipStance {
  if (kind === 'HELPER') {
    if (vector.traumaDebt01 >= 0.55 || vector.patience01 >= 0.72) return 'PROTECTIVE';
    if (vector.respect01 >= 0.60) return 'RESPECTFUL';
    return 'CURIOUS';
  }
  if (kind === 'ARCHIVIST') return vector.fascination01 >= 0.58 ? 'CURIOUS' : 'CLINICAL';
  if (vector.obsession01 >= 0.74 && vector.unfinishedBusiness01 >= 0.66) return 'OBSESSED';
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
): ChatRelationshipObjective {
  if (kind === 'HELPER') return vector.traumaDebt01 >= 0.48 ? 'RESCUE' : 'TEST';
  if (kind === 'ARCHIVIST') return 'WITNESS';
  if (kind === 'RIVAL' && vector.respect01 >= 0.50) return 'TEST';
  if (stance === 'OBSESSED') return 'STUDY';
  if (stance === 'HUNTING') return 'PRESSURE';
  if (stance === 'PREDATORY') return vector.predictiveConfidence01 >= 0.62 ? 'REPRICE' : 'PROVOKE';
  if (stance === 'CLINICAL') return 'DELAY';
  if (stance === 'RESPECTFUL') return 'NEGOTIATE';
  if (vector.unfinishedBusiness01 >= 0.55) return 'HUMILIATE';
  return 'STUDY';
}

function dominantAxes(vector: ChatRelationshipVector): DominantAxis[] {
  const ranked: Array<readonly [ChatRelationshipAxisId, number]> = [
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

  return [...ranked]
    .sort(
      (a: readonly [ChatRelationshipAxisId, number], b: readonly [ChatRelationshipAxisId, number]) =>
        b[1] - a[1],
    )
    .slice(0, 3)
    .map((item: readonly [ChatRelationshipAxisId, number]) => item[0] as DominantAxis);
}

function blankDelta(): MutableRelationshipDelta {
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

function kindFromActorRole(actorRole?: string | null): ChatRelationshipCounterpartKind {
  const role = String(actorRole ?? '').toUpperCase();
  if (role.includes('HELPER')) return 'HELPER';
  if (role.includes('RIVAL')) return 'RIVAL';
  if (role.includes('ARCHIVIST')) return 'ARCHIVIST';
  if (role.includes('AMBIENT')) return 'AMBIENT';
  if (role.includes('BOT') || role.includes('HATER')) return 'BOT';
  return 'NPC';
}

function eventTypeFromNpcRole(actorRole?: string | null): ChatRelationshipEventType {
  if (isHelperRole(actorRole)) return 'HELPER_RESCUE_EMITTED';
  if (isRivalRole(actorRole)) return 'RIVAL_WITNESS_EMITTED';
  if (isArchivistRole(actorRole)) return 'ARCHIVIST_WITNESS_EMITTED';
  if (isHaterRole(actorRole)) return 'BOT_TAUNT_EMITTED';
  return 'AMBIENT_WITNESS_EMITTED';
}

function isHelperRole(actorRole?: string | null): boolean {
  return String(actorRole ?? '').toUpperCase() === 'HELPER';
}
function isHaterRole(actorRole?: string | null): boolean {
  return String(actorRole ?? '').toUpperCase() === 'HATER';
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
  const suffix = publicBias
    ? ' Everyone in the room can hear the angle now.'
    : ' You are running out of quiet places to hide it.';
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

function randomId(prefix: string, seed: string, now: number): string {
  return `${prefix}_${Math.abs(stableHash(`${prefix}:${seed}:${now}`)).toString(36)}`;
}

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
