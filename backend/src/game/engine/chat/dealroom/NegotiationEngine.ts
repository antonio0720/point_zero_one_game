/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT DEALROOM NEGOTIATION ENGINE
 * FILE: backend/src/game/engine/chat/dealroom/NegotiationEngine.ts
 * VERSION: 2026.03.19
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Backend orchestration authority for deal-room negotiation lifecycle.
 *
 * This engine owns:
 * - opening negotiation threads
 * - constructing actor state truth
 * - staging scene / beat / window state
 * - ingesting offer and transcript signals
 * - routing offer evaluation through OfferCounterEngine
 * - opening counter windows
 * - tracking leak / rescue / audience pressure
 * - settling negotiation resolution
 * - maintaining replay-safe room ledgers
 *
 * This engine does not own UI rendering.
 * This engine does not own websocket fanout.
 * This engine does not replace transcript or proof systems.
 * ============================================================================
 */

import type {
  ChatOffer,
  ChatOfferActorRef,
  ChatOfferCounterRead,
  ChatOfferDraft,
  ChatOfferVisibilityEnvelope,
  ChatOfferWindow,
  ChatOfferBundle,
  ChatOfferPatch,
  UnixMs,
} from '../../../../../../shared/contracts/chat/ChatOffer';
import {
  asChatOfferId,
  asChatOfferThreadId,
  asUnixMs as asOfferUnixMs,
  chatOfferHasGuarantee,
  chatOfferSupportsRescue,
  chatOfferWindowExpired,
  createChatOfferVersion,
  createChatOfferWindow,
  createChatOfferPrice,
} from '../../../../../../shared/contracts/chat/ChatOffer';
import type {
  ChatNegotiation,
  ChatNegotiationPatch,
  NegotiationActorRef,
  NegotiationActorState,
  NegotiationChannelContext,
  NegotiationConcession,
  NegotiationInferenceFrame,
  NegotiationIntent,
  NegotiationLeakThreat,
  NegotiationMemoryAnchor,
  NegotiationOfferEnvelope,
  NegotiationPartyPair,
  NegotiationPhase,
  NegotiationPressureEdge,
  NegotiationResolution,
  NegotiationRiskVector,
  NegotiationSceneBeat,
  NegotiationSceneState,
  NegotiationSignalEvidence,
  NegotiationStance,
  NegotiationStatus,
  NegotiationWindow,
  NegotiationWindowReason,
  NegotiationOutcome,
  NegotiationEmotionVector,
  NegotiationReputationVector,
} from '../../../../../../shared/contracts/chat/ChatNegotiation';
import {
  asNegotiationActorId,
  asNegotiationId,
  asNegotiationOfferId,
  asNegotiationThreadId,
  asNegotiationWindowId,
  asPricePoints,
  asScore0To1,
  asUnixMs,
  createNegotiationPriceVector,
  createNegotiationScoreBand,
  createNegotiationWindow,
  negotiationHasAudiencePressure,
  negotiationHasLeakThreat,
  negotiationIsLive,
  negotiationLatestOfferId,
  negotiationPrimaryActorState,
  negotiationSupportsRescue,
  negotiationWindowHasExpired,
  negotiationWindowIsInGrace,
} from '../../../../../../shared/contracts/chat/ChatNegotiation';
import type { ChatRoomId, JsonValue } from '../types';
import { clamp01 } from '../types';
import {
  OfferCounterEngine,
  createOfferCounterEngine,
  type OfferCounterBuildResult,
  type OfferCounterEngineEvaluation,
  type OfferCounterEngineOptions,
  type OfferCounterEngineLogger,
  type OfferCounterEngineClock,
} from './OfferCounterEngine';

// ============================================================================
// MARK: Public contracts
// ============================================================================

export interface NegotiationEngineClock {
  now(): number;
}

export interface NegotiationEngineLogger {
  debug(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface NegotiationEngineOptions {
  readonly clock?: NegotiationEngineClock;
  readonly logger?: NegotiationEngineLogger;
  readonly offerCounterEngine?: OfferCounterEngine;
  readonly offerCounterOptions?: OfferCounterEngineOptions;
  readonly retainSettledNegotiationsPerRoom?: number;
  readonly retainOpenNegotiationsPerRoom?: number;
  readonly defaultOpenWindowMs?: number;
  readonly leakEscalationThreshold01?: number;
  readonly rescueEscalationThreshold01?: number;
}

export interface NegotiationOpenRequest {
  readonly roomId: ChatRoomId;
  readonly threadId: string;
  readonly primaryChannel: 'DEAL_ROOM' | 'DIRECT' | 'GLOBAL' | 'SYNDICATE' | 'SPECTATOR' | 'RESCUE_SHADOW';
  readonly parties: NegotiationPartyPair;
  readonly openingOffer?: ChatOfferDraft | ChatOffer | null;
  readonly initialIntent?: NegotiationIntent;
  readonly openingStatus?: NegotiationStatus;
  readonly createdAt?: UnixMs;
  readonly note?: string;
}

export interface NegotiationIngestMessageRequest {
  readonly roomId: ChatRoomId;
  readonly negotiationId: string;
  readonly actorId?: string | null;
  readonly messageId?: string | null;
  readonly body: string;
  readonly channel?: string | null;
  readonly createdAt?: UnixMs;
}

export interface NegotiationPostOfferRequest {
  readonly roomId: ChatRoomId;
  readonly negotiationId: string;
  readonly offer: ChatOffer;
  readonly priorOffer?: ChatOffer | null;
  readonly postedAt?: UnixMs;
  readonly note?: string;
}

export interface NegotiationCounterRequest {
  readonly roomId: ChatRoomId;
  readonly negotiationId: string;
  readonly incomingOffer: ChatOffer;
  readonly priorOffer?: ChatOffer | null;
  readonly postedAt?: UnixMs;
  readonly note?: string;
}

export interface NegotiationAcceptRequest {
  readonly roomId: ChatRoomId;
  readonly negotiationId: string;
  readonly acceptedOfferId: string;
  readonly acceptedAt?: UnixMs;
}

export interface NegotiationRejectRequest {
  readonly roomId: ChatRoomId;
  readonly negotiationId: string;
  readonly rejectedOfferId?: string | null;
  readonly rejectedAt?: UnixMs;
  readonly note?: string;
}

export interface NegotiationExpireRequest {
  readonly roomId: ChatRoomId;
  readonly now?: UnixMs;
}

export interface NegotiationResolveRequest {
  readonly roomId: ChatRoomId;
  readonly negotiationId: string;
  readonly outcome: NegotiationOutcome;
  readonly winningActorId?: string | null;
  readonly acceptedOfferId?: string | null;
  readonly leakOccurred?: boolean;
  readonly rescueOccurred?: boolean;
  readonly resolvedAt?: UnixMs;
}

export interface NegotiationEngineRoomLedger {
  readonly roomId: ChatRoomId;
  readonly activeNegotiations: readonly ChatNegotiation[];
  readonly settledNegotiations: readonly ChatNegotiation[];
  readonly offersByNegotiation: Readonly<Record<string, readonly ChatOffer[]>>;
  readonly lastUpdatedAt?: UnixMs;
}

export interface NegotiationCounterResult {
  readonly negotiation: ChatNegotiation;
  readonly counter: OfferCounterBuildResult;
  readonly patches: readonly ChatNegotiationPatch[];
}

interface NegotiationRecord {
  readonly negotiationId: string;
  negotiation: ChatNegotiation;
  offers: ChatOffer[];
  evaluations: OfferCounterEngineEvaluation[];
  openedAt: UnixMs;
  updatedAt: UnixMs;
}

interface NegotiationRoomState {
  readonly roomId: ChatRoomId;
  active: Map<string, NegotiationRecord>;
  settled: NegotiationRecord[];
  lastUpdatedAt?: UnixMs;
}

// ============================================================================
// MARK: Defaults
// ============================================================================

const DEFAULT_CLOCK: NegotiationEngineClock = {
  now: () => Date.now(),
};

const DEFAULT_LOGGER: NegotiationEngineLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
};

// ============================================================================
// MARK: Engine implementation
// ============================================================================

export class NegotiationEngine {
  private readonly clock: NegotiationEngineClock;
  private readonly logger: NegotiationEngineLogger;
  private readonly offerCounterEngine: OfferCounterEngine;
  private readonly retainSettledNegotiationsPerRoom: number;
  private readonly retainOpenNegotiationsPerRoom: number;
  private readonly defaultOpenWindowMs: number;
  private readonly leakEscalationThreshold01: number;
  private readonly rescueEscalationThreshold01: number;
  private readonly rooms = new Map<string, NegotiationRoomState>();

  constructor(options: NegotiationEngineOptions = {}) {
    this.clock = options.clock ?? DEFAULT_CLOCK;
    this.logger = options.logger ?? DEFAULT_LOGGER;
    this.offerCounterEngine =
      options.offerCounterEngine ??
      createOfferCounterEngine({
        ...(options.offerCounterOptions ?? {}),
        clock: options.offerCounterOptions?.clock ?? (this.clock as OfferCounterEngineClock),
        logger: options.offerCounterOptions?.logger ?? (this.logger as OfferCounterEngineLogger),
      });
    this.retainSettledNegotiationsPerRoom = clampInt(options.retainSettledNegotiationsPerRoom ?? 300, 25, 5_000);
    this.retainOpenNegotiationsPerRoom = clampInt(options.retainOpenNegotiationsPerRoom ?? 100, 10, 2_000);
    this.defaultOpenWindowMs = clampInt(options.defaultOpenWindowMs ?? 60_000, 8_000, 300_000);
    this.leakEscalationThreshold01 = clamp01(options.leakEscalationThreshold01 ?? 0.61);
    this.rescueEscalationThreshold01 = clamp01(options.rescueEscalationThreshold01 ?? 0.69);
  }

  open(request: NegotiationOpenRequest): ChatNegotiation {
    const now = asUnixMs(Number(request.createdAt ?? this.clock.now()));
    const room = this.getOrCreateRoom(request.roomId);
    const negotiationId = `neg:${String(request.roomId)}:${request.threadId}:${Number(now)}`;
    const status = request.openingStatus ?? 'OPEN';
    const phase: NegotiationPhase = request.openingOffer ? 'ANCHOR' : 'ENTRY';
    const actorStates = createInitialActorStates(request.parties, now, request.initialIntent);
    const scene = createInitialScene({
      negotiationId,
      threadId: request.threadId,
      primaryChannel: request.primaryChannel,
      parties: request.parties,
      openedAt: now,
      note: request.note,
      actorStates,
      defaultOpenWindowMs: this.defaultOpenWindowMs,
    });

    const openingOffer = request.openingOffer ? normalizeDraftToOffer(request.openingOffer, request.threadId, now, scene.sceneId) : undefined;
    const activeOffer = openingOffer ? toNegotiationEnvelope(negotiationId, request.threadId, request.primaryChannel, openingOffer, request.parties, phase, undefined, now) : undefined;
    const activeWindow = openingOffer ? toNegotiationWindowFromOffer(openingOffer, request.primaryChannel, 'OPEN_RESPONSE') : scene.activeWindow;
    const latestInference = deriveInferenceFromScene(negotiationId, phase, request.initialIntent ?? (openingOffer ? 'PRICE_DISCOVERY' : 'FAIR_TRADE'), actorStates, [], [], now);

    const negotiation: ChatNegotiation = {
      negotiationId: asNegotiationId(negotiationId),
      threadId: asNegotiationThreadId(request.threadId),
      status,
      phase,
      parties: request.parties,
      primaryChannel: request.primaryChannel,
      actorStates,
      scene: {
        ...scene,
        activeWindow,
        currentOffer: activeOffer,
        currentInference: latestInference,
        updatedAt: now,
      },
      activeOffer,
      activeWindow,
      latestInference,
      latestResolution: undefined,
      memories: openingOffer ? deriveOpeningMemories(openingOffer, now) : [],
      leakThreats: [],
      createdAt: now,
      updatedAt: now,
    };

    const record: NegotiationRecord = {
      negotiationId,
      negotiation,
      offers: openingOffer ? [openingOffer] : [],
      evaluations: [],
      openedAt: now,
      updatedAt: now,
    };

    room.active.set(negotiationId, record);
    room.lastUpdatedAt = now;
    this.pruneRoom(room);
    this.logger.info('negotiation:open', {
      roomId: String(request.roomId),
      negotiationId,
      channel: request.primaryChannel,
      openingOfferId: openingOffer ? String(openingOffer.offerId) : null,
    });
    return negotiation;
  }

  ingestMessage(request: NegotiationIngestMessageRequest): ChatNegotiation {
    const record = this.requireActiveRecord(request.roomId, request.negotiationId);
    const now = asUnixMs(Number(request.createdAt ?? this.clock.now()));
    const signalFrame = deriveSignalsFromMessage(record.negotiation, request.body, request.messageId, now);
    const inference = mergeInference(record.negotiation, signalFrame, now);
    const beats = buildSceneBeatsFromMessage(record.negotiation, request, now, inference);
    const leakThreats = maybeBuildLeakThreats(record.negotiation, request.body, request.actorId, now, inference);
    const memories = maybeBuildMessageMemories(request.body, request.messageId, now);
    const actorStates = patchActorStatesFromMessage(record.negotiation.actorStates, request.body, request.actorId, now, inference);

    record.negotiation = {
      ...record.negotiation,
      actorStates,
      latestInference: inference,
      leakThreats: [...(record.negotiation.leakThreats ?? []), ...leakThreats],
      memories: [...(record.negotiation.memories ?? []), ...memories].slice(-50),
      scene: {
        ...record.negotiation.scene,
        beats: [...record.negotiation.scene.beats, ...beats].slice(-200),
        currentInference: inference,
        leakThreat: leakThreats.at(-1) ?? record.negotiation.scene.leakThreat,
        updatedAt: now,
      },
      updatedAt: now,
    };
    record.updatedAt = now;
    this.touchRoom(request.roomId, now);
    return record.negotiation;
  }

  postOffer(request: NegotiationPostOfferRequest): ChatNegotiation {
    const record = this.requireActiveRecord(request.roomId, request.negotiationId);
    const now = asUnixMs(Number(request.postedAt ?? this.clock.now()));
    const evaluation = this.offerCounterEngine.evaluate({
      roomId: request.roomId,
      negotiation: record.negotiation,
      incomingOffer: request.offer,
      priorOffer: request.priorOffer ?? record.offers.at(-1),
      now,
      traceLabel: 'NegotiationEngine.postOffer',
    });

    record.offers.push(request.offer);
    record.evaluations.push(evaluation);

    const envelope = toNegotiationEnvelope(
      String(record.negotiation.negotiationId),
      String(record.negotiation.threadId),
      record.negotiation.primaryChannel,
      request.offer,
      record.negotiation.parties,
      'ANCHOR',
      record.negotiation.latestInference,
      now,
    );

    const leakThreats = maybeEscalateLeakFromEvaluation(record.negotiation, evaluation, request.offer, now, request.roomId);
    const activeWindow = toNegotiationWindowFromOffer(request.offer, record.negotiation.primaryChannel, 'COUNTERPLAY');
    const nextPhase = derivePhaseFromEvaluation(evaluation, false);
    const nextStatus: NegotiationStatus = 'ACTIVE';

    record.negotiation = {
      ...record.negotiation,
      phase: nextPhase,
      status: nextStatus,
      activeOffer: envelope,
      activeWindow,
      latestInference: mergeInference(record.negotiation, buildInferenceFromEvaluation(record.negotiation, request.offer, evaluation, now), now),
      leakThreats: [...(record.negotiation.leakThreats ?? []), ...leakThreats].slice(-20),
      scene: {
        ...record.negotiation.scene,
        status: nextStatus,
        activeWindow,
        currentOffer: envelope,
        currentInference: buildInferenceFromEvaluation(record.negotiation, request.offer, evaluation, now),
        beats: [...record.negotiation.scene.beats, buildOfferBeat(request.offer, evaluation, now)].slice(-220),
        leakThreat: leakThreats.at(-1) ?? record.negotiation.scene.leakThreat,
        updatedAt: now,
      },
      updatedAt: now,
    };

    record.updatedAt = now;
    this.touchRoom(request.roomId, now);
    return record.negotiation;
  }

  counter(request: NegotiationCounterRequest): NegotiationCounterResult {
    const record = this.requireActiveRecord(request.roomId, request.negotiationId);
    const now = asUnixMs(Number(request.postedAt ?? this.clock.now()));
    const counter = this.offerCounterEngine.buildCounter({
      roomId: request.roomId,
      negotiation: record.negotiation,
      incomingOffer: request.incomingOffer,
      priorOffer: request.priorOffer ?? record.offers.at(-1),
      now,
      note: request.note,
    });

    record.offers.push(request.incomingOffer, counter.counterOffer);
    record.evaluations.push(counter.evaluation);

    const nextStatus: NegotiationStatus = shouldSoftLock(counter.evaluation) ? 'SOFT_LOCKED' : 'ACTIVE';
    const nextPhase = derivePhaseFromEvaluation(counter.evaluation, true);
    const inference = buildInferenceFromEvaluation(record.negotiation, counter.counterOffer, counter.evaluation, now);
    const leakThreats = maybeEscalateLeakFromEvaluation(record.negotiation, counter.evaluation, counter.counterOffer, now, request.roomId);
    const memories = maybeBuildCounterMemories(counter.counterOffer, counter.evaluation, now);

    record.negotiation = {
      ...record.negotiation,
      status: nextStatus,
      phase: nextPhase,
      activeOffer: counter.counterEnvelope,
      activeWindow: counter.counterWindow,
      latestInference: inference,
      memories: [...(record.negotiation.memories ?? []), ...memories].slice(-60),
      leakThreats: [...(record.negotiation.leakThreats ?? []), ...leakThreats].slice(-24),
      scene: {
        ...record.negotiation.scene,
        status: nextStatus,
        activeWindow: counter.counterWindow,
        currentOffer: counter.counterEnvelope,
        currentInference: inference,
        beats: [...record.negotiation.scene.beats, buildOfferBeat(counter.counterOffer, counter.evaluation, now)].slice(-240),
        leakThreat: leakThreats.at(-1) ?? record.negotiation.scene.leakThreat,
        updatedAt: now,
      },
      updatedAt: now,
    };
    record.updatedAt = now;
    this.touchRoom(request.roomId, now);

    const patches: ChatNegotiationPatch[] = [
      {
        negotiationId: record.negotiation.negotiationId,
        phase: nextPhase,
        status: nextStatus,
        activeOffer: counter.counterEnvelope,
        activeWindow: counter.counterWindow,
        latestInference: inference,
        appendedMemories: memories,
        appendedLeakThreats: leakThreats,
        appendedBeats: [buildOfferBeat(counter.counterOffer, counter.evaluation, now)],
        updatedAt: now,
      },
    ];

    return {
      negotiation: record.negotiation,
      counter,
      patches,
    };
  }

  accept(request: NegotiationAcceptRequest): ChatNegotiation {
    const record = this.requireActiveRecord(request.roomId, request.negotiationId);
    const now = asUnixMs(Number(request.acceptedAt ?? this.clock.now()));
    const acceptedOffer = record.offers.find((offer) => String(offer.offerId) === request.acceptedOfferId) ?? record.offers.at(-1);
    const finalPrice = acceptedOffer
      ? createNegotiationPriceVector(Number(acceptedOffer.currentVersion.price.amount), String(acceptedOffer.currentVersion.price.currency))
      : undefined;
    const resolution: NegotiationResolution = {
      negotiationId: record.negotiation.negotiationId,
      outcome: 'ACCEPTED',
      winningActorId: acceptedOffer ? (acceptedOffer.offeredBy.actorId as unknown as any) : undefined,
      acceptedOfferId: acceptedOffer ? asNegotiationOfferId(String(acceptedOffer.offerId)) : undefined,
      finalPrice,
      finalConcessions: acceptedOffer ? toNegotiationConcessions(acceptedOffer.currentVersion.concessions) : undefined,
      reputationDeltaByActor: buildAcceptanceReputationMap(record.negotiation, acceptedOffer),
      pressureRelief: asScore0To1(0.82),
      leakOccurred: false,
      rescueOccurred: Boolean(acceptedOffer && chatOfferSupportsRescue(acceptedOffer)),
      proofId: undefined,
      rewardProjection: undefined,
      resolvedAt: now,
    };
    return this.settle(record, request.roomId, 'RESOLVED', 'CLOSE', resolution, now);
  }

  reject(request: NegotiationRejectRequest): ChatNegotiation {
    const record = this.requireActiveRecord(request.roomId, request.negotiationId);
    const now = asUnixMs(Number(request.rejectedAt ?? this.clock.now()));
    const rejectedOffer = request.rejectedOfferId ? record.offers.find((offer) => String(offer.offerId) == request.rejectedOfferId) : record.offers.at(-1);
    const resolution: NegotiationResolution = {
      negotiationId: record.negotiation.negotiationId,
      outcome: 'REJECTED',
      winningActorId: undefined,
      acceptedOfferId: undefined,
      finalPrice: undefined,
      finalConcessions: undefined,
      reputationDeltaByActor: buildRejectionReputationMap(record.negotiation, rejectedOffer),
      pressureRelief: asScore0To1(0.26),
      leakOccurred: false,
      rescueOccurred: false,
      proofId: undefined,
      rewardProjection: undefined,
      resolvedAt: now,
    };
    return this.settle(record, request.roomId, 'FAILED', 'POSTMORTEM', resolution, now);
  }

  resolve(request: NegotiationResolveRequest): ChatNegotiation {
    const record = this.requireActiveRecord(request.roomId, request.negotiationId);
    const now = asUnixMs(Number(request.resolvedAt ?? this.clock.now()));
    const offer = request.acceptedOfferId ? record.offers.find((candidate) => String(candidate.offerId) === request.acceptedOfferId) : record.offers.at(-1);
    const resolution: NegotiationResolution = {
      negotiationId: record.negotiation.negotiationId,
      outcome: request.outcome,
      winningActorId: request.winningActorId ? asNegotiationActorId(request.winningActorId) : undefined,
      acceptedOfferId: request.acceptedOfferId ? asNegotiationOfferId(request.acceptedOfferId) : undefined,
      finalPrice: offer ? createNegotiationPriceVector(Number(offer.currentVersion.price.amount), String(offer.currentVersion.price.currency)) : undefined,
      finalConcessions: offer ? toNegotiationConcessions(offer.currentVersion.concessions) : undefined,
      reputationDeltaByActor: buildOutcomeReputationMap(record.negotiation, request.outcome, offer, Boolean(request.leakOccurred), Boolean(request.rescueOccurred)),
      pressureRelief: asScore0To1(request.outcome === 'ACCEPTED' ? 0.8 : request.outcome === 'LEAKED' ? 0.1 : 0.34),
      leakOccurred: Boolean(request.leakOccurred),
      rescueOccurred: Boolean(request.rescueOccurred),
      proofId: undefined,
      rewardProjection: undefined,
      resolvedAt: now,
    };
    const status: NegotiationStatus = request.outcome === 'ACCEPTED' ? 'RESOLVED' : request.outcome === 'LEAKED' ? 'LEAKED' : 'FAILED';
    return this.settle(record, request.roomId, status, 'POSTMORTEM', resolution, now);
  }

  expire(request: NegotiationExpireRequest): ChatNegotiation[] {
    const room = this.getOrCreateRoom(request.roomId);
    const now = asUnixMs(Number(request.now ?? this.clock.now()));
    const expired: ChatNegotiation[] = [];
    for (const record of room.active.values()) {
      if (record.negotiation.activeWindow && negotiationWindowHasExpired(record.negotiation.activeWindow, now)) {
        const resolution: NegotiationResolution = {
          negotiationId: record.negotiation.negotiationId,
          outcome: 'EXPIRED',
          winningActorId: undefined,
          acceptedOfferId: undefined,
          finalPrice: undefined,
          finalConcessions: undefined,
          reputationDeltaByActor: buildExpiryReputationMap(record.negotiation),
          pressureRelief: asScore0To1(0.2),
          leakOccurred: false,
          rescueOccurred: false,
          proofId: undefined,
          rewardProjection: undefined,
          resolvedAt: now,
        };
        expired.push(this.settle(record, request.roomId, 'EXPIRED', 'POSTMORTEM', resolution, now));
      }
    }
    return expired;
  }

  getRoomLedger(roomId: ChatRoomId): NegotiationEngineRoomLedger {
    const room = this.getOrCreateRoom(roomId);
    const offersByNegotiation: Record<string, readonly ChatOffer[]> = {};
    for (const [id, record] of room.active.entries()) {
      offersByNegotiation[id] = [...record.offers];
    }
    for (const record of room.settled) {
      offersByNegotiation[record.negotiationId] = [...record.offers];
    }
    return {
      roomId,
      activeNegotiations: [...room.active.values()].map((record) => record.negotiation),
      settledNegotiations: room.settled.map((record) => record.negotiation),
      offersByNegotiation,
      lastUpdatedAt: room.lastUpdatedAt,
    };
  }

  private settle(
    record: NegotiationRecord,
    roomId: ChatRoomId,
    status: NegotiationStatus,
    phase: NegotiationPhase,
    resolution: NegotiationResolution,
    now: UnixMs,
  ): ChatNegotiation {
    const room = this.getOrCreateRoom(roomId);
    record.negotiation = {
      ...record.negotiation,
      status,
      phase,
      activeWindow: undefined,
      latestResolution: resolution,
      scene: {
        ...record.negotiation.scene,
        status,
        activeWindow: undefined,
        currentInference: record.negotiation.latestInference,
        beats: [...record.negotiation.scene.beats, buildResolutionBeat(resolution, now)].slice(-260),
        updatedAt: now,
      },
      updatedAt: now,
    };
    record.updatedAt = now;
    room.active.delete(record.negotiationId);
    room.settled.push(record);
    if (room.settled.length > this.retainSettledNegotiationsPerRoom) {
      room.settled.splice(0, room.settled.length - this.retainSettledNegotiationsPerRoom);
    }
    room.lastUpdatedAt = now;
    return record.negotiation;
  }

  private getOrCreateRoom(roomId: ChatRoomId): NegotiationRoomState {
    const key = String(roomId);
    const existing = this.rooms.get(key);
    if (existing) return existing;
    const created: NegotiationRoomState = {
      roomId,
      active: new Map(),
      settled: [],
      lastUpdatedAt: undefined,
    };
    this.rooms.set(key, created);
    return created;
  }

  private requireActiveRecord(roomId: ChatRoomId, negotiationId: string): NegotiationRecord {
    const room = this.getOrCreateRoom(roomId);
    const record = room.active.get(negotiationId);
    if (!record) {
      throw new Error(`Negotiation ${negotiationId} is not active in room ${String(roomId)}.`);
    }
    return record;
  }

  private touchRoom(roomId: ChatRoomId, now: UnixMs): void {
    const room = this.getOrCreateRoom(roomId);
    room.lastUpdatedAt = now;
    this.pruneRoom(room);
  }

  private pruneRoom(room: NegotiationRoomState): void {
    if (room.active.size <= this.retainOpenNegotiationsPerRoom) {
      return;
    }
    const sorted = [...room.active.values()].sort((a, b) => Number(a.updatedAt) - Number(b.updatedAt));
    while (sorted.length > this.retainOpenNegotiationsPerRoom) {
      const victim = sorted.shift();
      if (!victim) break;
      room.active.delete(victim.negotiationId);
      room.settled.push(victim);
    }
  }
}

// ============================================================================
// MARK: Opening helpers
// ============================================================================

function createInitialActorStates(
  parties: NegotiationPartyPair,
  now: UnixMs,
  initialIntent?: NegotiationIntent,
): NegotiationActorState[] {
  const seedStance = initialIntent === 'LIQUIDATION' ? 'PRESSURING' : initialIntent === 'FAIR_TRADE' ? 'OPENING' : 'TESTING';
  return [
    createActorState(parties.primary, seedStance, now, 0.62, 0.58, 0.46, 0.55, 0.34, 0.4, 0.52, 0.3),
    createActorState(parties.counterparty, 'TESTING', now, 0.58, 0.64, 0.39, 0.51, 0.29, 0.35, 0.43, 0.33),
    ...(parties.helper ? [createActorState(parties.helper, 'PROBING', now, 0.44, 0.72, 0.18, 0.61, 0.1, 0.24, 0.2, 0.15)] : []),
    ...(parties.rivalWitness ? [createActorState(parties.rivalWitness, 'PRESSURING', now, 0.35, 0.61, 0.57, 0.22, 0.63, 0.21, 0.12, 0.48)] : []),
  ];
}

function createActorState(
  actor: NegotiationActorRef,
  stance: NegotiationStance,
  now: UnixMs,
  leverage: number,
  patience: number,
  aggression: number,
  honestySignal: number,
  bluffFrequency: number,
  urgencySignal: number,
  attachmentToOutcome: number,
  walkAwayLikelihood: number,
): NegotiationActorState {
  return {
    actor,
    stance,
    leverage: asScore0To1(leverage),
    patience: asScore0To1(patience),
    aggression: asScore0To1(aggression),
    honestySignal: asScore0To1(honestySignal),
    bluffFrequency: asScore0To1(bluffFrequency),
    urgencySignal: asScore0To1(urgencySignal),
    attachmentToOutcome: asScore0To1(attachmentToOutcome),
    walkAwayLikelihood: asScore0To1(walkAwayLikelihood),
    reputation: createReputationVector(0.52, 0.47, 0.42, 0.3),
    emotion: createEmotionVector(0.32, 0.41, 0.28, 0.35, 0.2, 0.22),
    updatedAt: now,
  };
}

function createInitialScene(input: {
  negotiationId: string;
  threadId: string;
  primaryChannel: ChatNegotiation['primaryChannel'];
  parties: NegotiationPartyPair;
  openedAt: UnixMs;
  note?: string;
  actorStates: readonly NegotiationActorState[];
  defaultOpenWindowMs: number;
}): NegotiationSceneState {
  const channelContext: NegotiationChannelContext = {
    channel: input.primaryChannel,
    roomId: undefined,
    threadId: asNegotiationThreadId(input.threadId),
    visibleToPlayer: true,
    visibleToAudience: input.primaryChannel === 'GLOBAL' || input.primaryChannel === 'SPECTATOR',
    witnessPressure: asScore0To1(input.parties.audienceWitnessCount ? clamp01(input.parties.audienceWitnessCount / 10) : 0.2),
    secrecyPressure: asScore0To1(input.primaryChannel === 'DEAL_ROOM' ? 0.48 : input.primaryChannel === 'DIRECT' ? 0.36 : 0.18),
    crowdHeat: asScore0To1(input.primaryChannel === 'GLOBAL' ? 0.56 : 0.22),
  };

  const openWindow = createNegotiationWindow(
    'OPEN_RESPONSE',
    input.primaryChannel,
    Number(input.openedAt),
    Number(input.openedAt) + input.defaultOpenWindowMs,
    {
      windowId: `neg-open-window:${input.negotiationId}`,
      permitsSilence: false,
      helperEligibleAt: asUnixMs(Number(input.openedAt) + Math.round(input.defaultOpenWindowMs * 0.45)),
      rescueEligibleAt: asUnixMs(Number(input.openedAt) + Math.round(input.defaultOpenWindowMs * 0.55)),
      leakEligibleAt: asUnixMs(Number(input.openedAt) + Math.round(input.defaultOpenWindowMs * 0.72)),
    },
  );

  const beat: NegotiationSceneBeat = {
    beatId: `beat:${input.negotiationId}:open`,
    phase: 'ENTRY',
    description: input.note ?? 'Negotiation thread opened.',
    witnessHeat: channelContext.crowdHeat,
    silenceBeforeMs: 0,
    silenceAfterMs: 350,
  };

  return {
    sceneId: `scene:${input.negotiationId}` as any,
    negotiationId: asNegotiationId(input.negotiationId),
    status: 'OPEN',
    activeWindow: openWindow,
    partyPair: input.parties,
    channelContext,
    beats: [beat],
    currentOffer: undefined,
    currentInference: undefined,
    memoryAnchors: [],
    leakThreat: undefined,
    openedAt: input.openedAt,
    updatedAt: input.openedAt,
  };
}

// ============================================================================
// MARK: Offer normalization + conversion
// ============================================================================

function normalizeDraftToOffer(draft: ChatOfferDraft | ChatOffer, threadId: string, now: UnixMs, sceneId: any): ChatOffer {
  if ('offerId' in draft) {
    return draft;
  }
  return {
    offerId: asChatOfferId(`offer:${threadId}:${Number(now)}`),
    threadId: asChatOfferThreadId(threadId),
    roomId: draft.roomId,
    sceneId: sceneId as any,
    kind: draft.kind,
    status: draft.status === 'DRAFT' ? 'STAGED' : 'POSTED',
    offeredBy: draft.offeredBy,
    offeredTo: draft.offeredTo,
    currentVersion: createChatOfferVersion(1, draft.price, draft.paymentTerms, {
      guarantees: draft.guarantees,
      conditions: draft.conditions,
      concessions: draft.concessions,
      analytics: draft.analytics,
      createdAt: Number(draft.createdAt),
      note: 'Negotiation opening draft normalized to offer.',
    }),
    priorVersions: [],
    visibility: draft.visibility,
    window: draft.window,
    counterRead: undefined,
    proof: undefined,
    createdAt: draft.createdAt,
    updatedAt: draft.createdAt,
  };
}

function toNegotiationEnvelope(
  negotiationId: string,
  threadId: string,
  channel: ChatNegotiation['primaryChannel'],
  offer: ChatOffer,
  parties: NegotiationPartyPair,
  phase: NegotiationPhase,
  inference: NegotiationInferenceFrame | undefined,
  now: UnixMs,
): NegotiationOfferEnvelope {
  return {
    negotiationId: asNegotiationId(negotiationId),
    sceneId: `scene:${negotiationId}` as any,
    threadId: asNegotiationThreadId(threadId),
    offeredBy: toNegotiationActor(offer.offeredBy, parties),
    offeredTo: toNegotiationActor(offer.offeredTo, parties),
    vector: {
      offerId: asNegotiationOfferId(String(offer.offerId)),
      label: `${offer.kind} @ ${Number(offer.currentVersion.price.amount)}`,
      price: createNegotiationPriceVector(Number(offer.currentVersion.price.amount), String(offer.currentVersion.price.currency)),
      valueEstimate: offer.currentVersion.price.marketRange
        ? {
            low: asPricePoints(Number(offer.currentVersion.price.marketRange.min)),
            high: asPricePoints(Number(offer.currentVersion.price.marketRange.max)),
            midpoint: offer.currentVersion.price.marketRange.expected === undefined ? undefined : asPricePoints(Number(offer.currentVersion.price.marketRange.expected)),
          }
        : undefined,
      riskAdjustmentBps: offer.currentVersion.price.feeBps,
      urgencyBps: offer.currentVersion.price.discountBps,
      concessions: toNegotiationConcessions(offer.currentVersion.concessions),
      intent: inferIntentFromOffer(offer),
      phase,
      windowId: offer.window ? asNegotiationWindowId(String(offer.window.windowId)) : undefined,
    },
    counterShape: offer.kind === 'COUNTER'
      ? {
          isCounter: true,
          referencesOfferId: negotiationLatestOfferId as any,
          counterDistance: asScore0To1(Number(offer.counterRead?.counterDistance ?? 0.4)),
          hardReversal: Number(offer.currentVersion.analytics?.aggression.normalized ?? 0) > 0.62,
          softLanding: Number(offer.currentVersion.analytics?.fairness.normalized ?? 0) > 0.55,
          faceSaving: offer.visibility.visibility !== 'PUBLIC',
        }
      : undefined,
    channelContext: {
      channel,
      roomId: undefined,
      threadId: asNegotiationThreadId(threadId),
      visibleToPlayer: true,
      visibleToAudience: offer.visibility.visibility === 'PUBLIC' || offer.visibility.visibility === 'DEAL_ROOM_PLUS_WITNESSES',
      witnessPressure: asScore0To1(Number(offer.visibility.audienceHeat ?? 0.2)),
      secrecyPressure: asScore0To1(Number(offer.visibility.secrecyPressure ?? 0.25)),
      crowdHeat: asScore0To1(Number(offer.visibility.audienceHeat ?? 0.15)),
    },
    inference,
    createdAt: now,
  };
}

function toNegotiationActor(actor: ChatOfferActorRef, parties: NegotiationPartyPair): NegotiationActorRef {
  const matchPrimary = String(actor.actorId) === String(parties.primary.actorId);
  const matchCounter = String(actor.actorId) === String(parties.counterparty.actorId);
  const matchHelper = parties.helper && String(actor.actorId) === String(parties.helper.actorId);
  const matched = matchPrimary ? parties.primary : matchCounter ? parties.counterparty : matchHelper ? parties.helper! : parties.counterparty;
  return matched;
}

function toNegotiationWindowFromOffer(offer: ChatOffer, channel: ChatNegotiation['primaryChannel'], reason: NegotiationWindowReason): NegotiationWindow | undefined {
  if (!offer.window) return undefined;
  return createNegotiationWindow(reason, channel, Number(offer.window.opensAt), Number(offer.window.closesAt), {
    windowId: String(offer.window.windowId),
    permitsSilence: false,
    graceUntil: offer.window.graceUntil === undefined ? undefined : asUnixMs(Number(offer.window.graceUntil)),
    helperEligibleAt: offer.window.rescueEligibleAt === undefined ? undefined : asUnixMs(Number(offer.window.rescueEligibleAt)),
    rescueEligibleAt: offer.window.rescueEligibleAt === undefined ? undefined : asUnixMs(Number(offer.window.rescueEligibleAt)),
    leakEligibleAt: offer.window.leakEligibleAt === undefined ? undefined : asUnixMs(Number(offer.window.leakEligibleAt)),
  });
}

function inferIntentFromOffer(offer: ChatOffer): NegotiationIntent {
  switch (offer.kind) {
    case 'LIQUIDATION':
      return 'LIQUIDATION';
    case 'BLUFF':
      return 'BLUFF';
    case 'RESCUE_OVERRIDE':
      return 'RESCUE_OVERRIDE';
    case 'TAKE_IT_OR_LEAVE_IT':
      return 'VALUE_EXTRACT';
    case 'COUNTER':
      return 'PRICE_DISCOVERY';
    case 'LIVEOPS_BONUS':
      return 'REPUTATION_SIGNAL';
    case 'HELPER_GUIDED':
      return 'HELPER_INTERVENTION';
    case 'OPENING':
    default:
      return 'FAIR_TRADE';
  }
}

function toNegotiationConcessions(concessions: readonly ChatOffer['currentVersion']['concessions'] | undefined): NegotiationConcession[] | undefined {
  if (!concessions || concessions.length === 0) return undefined;
  return concessions.map((concession) => ({
    type: 'SOFTENER',
    magnitude: Number(concession.valueDelta ?? 0),
    describedAs: concession.label,
    reversible: false,
    costsReputation: (concession.reputationCost ?? 0) > 0,
    costsUrgency: (concession.urgencyCost ?? 0) > 0,
    costsLeverage: false,
  }));
}

// ============================================================================
// MARK: Inference + signal logic
// ============================================================================

function deriveInferenceFromScene(
  negotiationId: string,
  phase: NegotiationPhase,
  intent: NegotiationIntent,
  actorStates: readonly NegotiationActorState[],
  signals: readonly NegotiationSignalEvidence[],
  edges: readonly NegotiationPressureEdge[],
  now: UnixMs,
): NegotiationInferenceFrame {
  return {
    negotiationId: asNegotiationId(negotiationId),
    phase,
    inferredIntent: intent,
    alternativeIntents: deriveAlternativeIntents(intent),
    signals,
    pressureEdges: edges,
    risk: createRiskVector(signals, edges),
    reputation: averageReputation(actorStates),
    emotionProjection: averageEmotion(actorStates),
    createdAt: now,
  };
}

function deriveAlternativeIntents(intent: NegotiationIntent): NegotiationIntent[] {
  switch (intent) {
    case 'BLUFF':
      return ['TRAP', 'DELAY', 'VALUE_EXTRACT'];
    case 'LIQUIDATION':
      return ['PANIC_EXIT', 'FACE_SAVE', 'PRICE_DISCOVERY'];
    case 'RESCUE_OVERRIDE':
      return ['HELPER_INTERVENTION', 'FAIR_TRADE', 'DELAY'];
    case 'VALUE_EXTRACT':
      return ['PRICE_DISCOVERY', 'TRAP', 'BLUFF'];
    default:
      return ['FAIR_TRADE', 'PRICE_DISCOVERY', 'VALUE_EXTRACT'];
  }
}

function createRiskVector(signals: readonly NegotiationSignalEvidence[], edges: readonly NegotiationPressureEdge[]): NegotiationRiskVector {
  const leak = maxSignal(signals, 'LEAK_RISK');
  const fear = maxSignal(signals, 'FEAR');
  const reputation = maxSignal(signals, 'REPUTATION_RISK');
  const helper = maxSignal(signals, 'HELPER_NEED');
  const pressureIntensity = Math.max(...edges.map((edge) => Number(edge.intensity.normalized)), 0.2);
  return {
    collapseRisk: asScore0To1(clamp01(fear * 0.35 + leak * 0.25 + pressureIntensity * 0.2)),
    leakRisk: asScore0To1(leak),
    rejectionRisk: asScore0To1(clamp01(fear * 0.24 + pressureIntensity * 0.22)),
    stallRisk: asScore0To1(clamp01((1 - pressureIntensity) * 0.22 + helper * 0.1)),
    rescueNeed: asScore0To1(clamp01(helper * 0.5 + fear * 0.18 + leak * 0.12)),
    reputationRisk: asScore0To1(reputation),
  };
}

function maxSignal(signals: readonly NegotiationSignalEvidence[], kind: string): number {
  return signals
    .filter((signal) => signal.kind === kind)
    .reduce((max, signal) => Math.max(max, Number(signal.score.normalized)), 0);
}

function buildInferenceFromEvaluation(
  negotiation: ChatNegotiation,
  offer: ChatOffer,
  evaluation: OfferCounterEngineEvaluation,
  now: UnixMs,
): NegotiationInferenceFrame {
  const signals: NegotiationSignalEvidence[] = [
    signal('URGENCY', Number(evaluation.urgency01), now, `Offer urgency ${Number(evaluation.urgency01).toFixed(2)}`),
    signal('BLUFF', Number(evaluation.leakRisk01) * 0.5 + Number(evaluation.aggression01) * 0.25, now, `Bluff projection via leak/aggression model.`),
    signal('OVERPAY_RISK', Math.max(0, 1 - Number(evaluation.fairness01)), now, 'Fairness under safe band.'),
    signal('LEAK_RISK', Number(evaluation.leakRisk01), now, 'Leak risk from visibility/secrecy/witness state.'),
    signal('HELPER_NEED', Number(evaluation.rescueNeed01), now, 'Rescue/helper review demand.'),
  ];
  const edges: NegotiationPressureEdge[] = [
    pressure('PRICE', Number(evaluation.counterDistance01), 'Counter distance shaping response.'),
    pressure('TIME', Number(evaluation.urgency01), 'Window/urgency pressure active.'),
    pressure('LEAK', Number(evaluation.leakRisk01), 'Leak containment pressure active.'),
    pressure('RESCUE', Number(evaluation.rescueNeed01), 'Rescue fallback pressure active.'),
  ];
  return deriveInferenceFromScene(
    String(negotiation.negotiationId),
    derivePhaseFromEvaluation(evaluation, offer.kind === 'COUNTER'),
    inferIntentFromOffer(offer),
    negotiation.actorStates,
    signals,
    edges,
    now,
  );
}

function deriveSignalsFromMessage(
  negotiation: ChatNegotiation,
  body: string,
  messageId: string | null | undefined,
  now: UnixMs,
): NegotiationSignalEvidence[] {
  const text = body.toLowerCase();
  const signals: NegotiationSignalEvidence[] = [];
  if (/(now|today|immediately|right now|hurry|final hour)/.test(text)) {
    signals.push(signal('URGENCY', 0.74, now, 'Detected direct deadline language.', messageId));
  }
  if (/(trust me|promise|guarantee|swear|proof)/.test(text)) {
    signals.push(signal('TRUST_SIGNAL', 0.58, now, 'Detected explicit trust / proof language.', messageId));
  }
  if (/(leak|everyone will know|public|witness|screenshot)/.test(text)) {
    signals.push(signal('LEAK_RISK', 0.67, now, 'Detected public exposure / leak language.', messageId));
  }
  if (/(help|i can.t do this|stuck|save me|need guidance)/.test(text)) {
    signals.push(signal('HELPER_NEED', 0.72, now, 'Detected helper / rescue language.', messageId));
  }
  if (/(final|take it or leave it|last chance|done talking)/.test(text)) {
    signals.push(signal('AGGRESSION', 0.64, now, 'Detected hardline close language.', messageId));
  }
  if (/(panic|desperate|dump it|need out|must sell)/.test(text)) {
    signals.push(signal('FEAR', 0.7, now, 'Detected collapse / desperation language.', messageId));
  }
  if (signals.length === 0) {
    signals.push(signal('PASSIVITY', 0.22, now, 'No dominant message signal exceeded threshold.', messageId));
  }
  return signals;
}

function mergeInference(negotiation: ChatNegotiation, frame: NegotiationInferenceFrame, now: UnixMs): NegotiationInferenceFrame {
  const prior = negotiation.latestInference;
  if (!prior) return frame;
  const mergedSignals = [...prior.signals, ...frame.signals].slice(-24);
  const mergedEdges = [...prior.pressureEdges, ...frame.pressureEdges].slice(-24);
  const averagedRisk: NegotiationRiskVector = {
    collapseRisk: asScore0To1((Number(prior.risk.collapseRisk) + Number(frame.risk.collapseRisk)) / 2),
    leakRisk: asScore0To1((Number(prior.risk.leakRisk) + Number(frame.risk.leakRisk)) / 2),
    rejectionRisk: asScore0To1((Number(prior.risk.rejectionRisk) + Number(frame.risk.rejectionRisk)) / 2),
    stallRisk: asScore0To1((Number(prior.risk.stallRisk) + Number(frame.risk.stallRisk)) / 2),
    rescueNeed: asScore0To1((Number(prior.risk.rescueNeed) + Number(frame.risk.rescueNeed)) / 2),
    reputationRisk: asScore0To1((Number(prior.risk.reputationRisk) + Number(frame.risk.reputationRisk)) / 2),
  };
  return {
    ...frame,
    signals: mergedSignals,
    pressureEdges: mergedEdges,
    risk: averagedRisk,
    createdAt: now,
  };
}

function signal(kind: any, normalized: number, now: UnixMs, note: string, messageId?: string | null): NegotiationSignalEvidence {
  return {
    signalId: `signal:${kind}:${Number(now)}:${Math.round(normalized * 1000)}` as any,
    kind,
    score: createNegotiationScoreBand(normalized, clamp01(normalized), `signal:${kind}`, Number(now), clamp01(normalized) * 100),
    confidence: createNegotiationScoreBand(Math.max(0.25, normalized), Math.max(0.25, clamp01(normalized)), `signal:${kind}:confidence`, Number(now), Math.max(0.25, clamp01(normalized)) * 100),
    extractedFromMessageId: messageId ? (messageId as any) : undefined,
    note,
    tags: [kind],
  };
}

function pressure(source: any, normalized: number, note: string): NegotiationPressureEdge {
  return {
    source,
    intensity: createNegotiationScoreBand(normalized, clamp01(normalized), `pressure:${source}`, Date.now(), clamp01(normalized) * 100),
    note,
  };
}

// ============================================================================
// MARK: Scene, leak, memory, actor patch helpers
// ============================================================================

function buildSceneBeatsFromMessage(
  negotiation: ChatNegotiation,
  request: NegotiationIngestMessageRequest,
  now: UnixMs,
  inference: NegotiationInferenceFrame,
): NegotiationSceneBeat[] {
  return [
    {
      beatId: `beat:${String(negotiation.negotiationId)}:${Number(now)}`,
      phase: inference.phase,
      description: `Message ingested into negotiation scene: ${truncate(request.body, 72)}`,
      actorId: request.actorId ? asNegotiationActorId(request.actorId) : undefined,
      messageId: request.messageId ? (request.messageId as any) : undefined,
      witnessHeat: negotiation.scene.channelContext.crowdHeat,
      silenceBeforeMs: 0,
      silenceAfterMs: 120,
    },
  ];
}

function maybeBuildLeakThreats(
  negotiation: ChatNegotiation,
  body: string,
  actorId: string | null | undefined,
  now: UnixMs,
  inference: NegotiationInferenceFrame,
): NegotiationLeakThreat[] {
  const text = body.toLowerCase();
  const threats: NegotiationLeakThreat[] = [];
  if (/(screenshot|leak|public|everyone|show this|expose)/.test(text)) {
    threats.push({
      leakId: `leak:${String(negotiation.negotiationId)}:${Number(now)}` as any,
      sourceActorId: asNegotiationActorId(actorId ?? String(negotiation.parties.counterparty.actorId)),
      targetChannel: 'GLOBAL',
      severity: createNegotiationScoreBand(0.7, 0.7, 'message:leak', Number(now), 70),
      predictedWitnessHeat: asScore0To1(0.68),
      canBeContained: true,
      note: 'Message contains explicit leak/exposure language.',
    });
  }
  if (Number(inference.risk.leakRisk) > 0.68) {
    threats.push({
      leakId: `leak:${String(negotiation.negotiationId)}:risk:${Number(now)}` as any,
      sourceActorId: asNegotiationActorId(actorId ?? String(negotiation.parties.primary.actorId)),
      targetChannel: 'GLOBAL',
      severity: createNegotiationScoreBand(Number(inference.risk.leakRisk), Number(inference.risk.leakRisk), 'inference:leak-risk', Number(now), Number(inference.risk.leakRisk) * 100),
      predictedWitnessHeat: asScore0To1(Math.max(0.52, Number(negotiation.scene.channelContext.crowdHeat ?? 0))),
      canBeContained: Number(inference.risk.leakRisk) < 0.84,
      note: 'Leak threat projected from aggregate inference risk.',
    });
  }
  return threats;
}

function maybeBuildMessageMemories(body: string, messageId: string | null | undefined, now: UnixMs): NegotiationMemoryAnchor[] {
  const text = body.toLowerCase();
  const anchors: NegotiationMemoryAnchor[] = [];
  if (/(last time|again|before|remember)/.test(text)) {
    anchors.push({
      memoryId: `memory:${Number(now)}:callback` as any,
      anchorId: `anchor:${Number(now)}:callback` as any,
      kind: 'PAST_BLUFF',
      salience: asScore0To1(0.63),
      messageId: messageId ? (messageId as any) : undefined,
      note: 'Message references prior negotiation behavior.',
    });
  }
  if (/(save|rescue|help me)/.test(text)) {
    anchors.push({
      memoryId: `memory:${Number(now)}:rescue` as any,
      anchorId: `anchor:${Number(now)}:rescue` as any,
      kind: 'PAST_RESCUE',
      salience: asScore0To1(0.66),
      messageId: messageId ? (messageId as any) : undefined,
      note: 'Message may need to trigger or remember rescue support.',
    });
  }
  return anchors;
}

function maybeBuildCounterMemories(offer: ChatOffer, evaluation: OfferCounterEngineEvaluation, now: UnixMs): NegotiationMemoryAnchor[] {
  const anchors: NegotiationMemoryAnchor[] = [];
  if (Number(evaluation.leakRisk01) > 0.55) {
    anchors.push({
      memoryId: `memory:${String(offer.offerId)}:leak` as any,
      anchorId: `anchor:${String(offer.offerId)}:leak` as any,
      kind: 'PAST_LEAK',
      salience: asScore0To1(Number(evaluation.leakRisk01)),
      messageId: offer.sourceMessageId as any,
      note: 'Counter offer carried significant leak pressure.',
    });
  }
  if (Number(evaluation.rescueNeed01) > this_rescue_threshold()) {
    anchors.push({
      memoryId: `memory:${String(offer.offerId)}:rescue` as any,
      anchorId: `anchor:${String(offer.offerId)}:rescue` as any,
      kind: 'PAST_RESCUE',
      salience: asScore0To1(Number(evaluation.rescueNeed01)),
      messageId: offer.sourceMessageId as any,
      note: 'Counter offer required rescue-aware handling.',
    });
  }
  return anchors;
}

function patchActorStatesFromMessage(
  actorStates: readonly NegotiationActorState[],
  body: string,
  actorId: string | null | undefined,
  now: UnixMs,
  inference: NegotiationInferenceFrame,
): NegotiationActorState[] {
  return actorStates.map((state) => {
    if (actorId && String(state.actor.actorId) !== actorId) {
      return state;
    }
    const text = body.toLowerCase();
    let aggression = Number(state.aggression);
    let honesty = Number(state.honestySignal);
    let urgency = Number(state.urgencySignal);
    let bluff = Number(state.bluffFrequency);
    let stance: NegotiationStance = state.stance;

    if (/(final|take it or leave it|done talking)/.test(text)) {
      aggression += 0.12;
      urgency += 0.08;
      stance = 'PRESSURING';
    }
    if (/(trust|proof|guarantee)/.test(text)) {
      honesty += 0.09;
      stance = 'PROBING';
    }
    if (/(bluff|maybe|perhaps|not sure|might)/.test(text)) {
      bluff += 0.12;
      stance = 'STALLING';
    }

    return {
      ...state,
      stance,
      aggression: asScore0To1(clamp01(aggression)),
      honestySignal: asScore0To1(clamp01(honesty)),
      urgencySignal: asScore0To1(clamp01(urgency)),
      bluffFrequency: asScore0To1(clamp01(bluff)),
      reputation: state.reputation,
      emotion: patchEmotionFromInference(state.emotion, inference),
      updatedAt: now,
    };
  });
}

function patchEmotionFromInference(emotion: NegotiationEmotionVector, inference: NegotiationInferenceFrame): NegotiationEmotionVector {
  return {
    fear: asScore0To1(clamp01((Number(emotion.fear) + Number(inference.risk.collapseRisk)) / 2)),
    confidence: asScore0To1(clamp01((Number(emotion.confidence) + (1 - Number(inference.risk.rejectionRisk))) / 2)),
    frustration: asScore0To1(clamp01((Number(emotion.frustration) + Number(inference.risk.stallRisk)) / 2)),
    attachment: asScore0To1(clamp01((Number(emotion.attachment) + Number(inference.risk.rescueNeed)) / 2)),
    relief: asScore0To1(clamp01((Number(emotion.relief) + (1 - Number(inference.risk.leakRisk))) / 2)),
    dominance: asScore0To1(clamp01((Number(emotion.dominance) + Number(inference.reputation.dominance)) / 2)),
  };
}

function maybeEscalateLeakFromEvaluation(
  negotiation: ChatNegotiation,
  evaluation: OfferCounterEngineEvaluation,
  offer: ChatOffer,
  now: UnixMs,
  roomId: ChatRoomId,
): NegotiationLeakThreat[] {
  if (Number(evaluation.leakRisk01) < 0.61) return [];
  return [
    {
      leakId: `leak:${String(roomId)}:${String(offer.offerId)}:${Number(now)}` as any,
      sourceActorId: asNegotiationActorId(String(offer.offeredBy.actorId)),
      targetChannel: Number(evaluation.leakRisk01) > 0.75 ? 'GLOBAL' : 'SPECTATOR',
      severity: createNegotiationScoreBand(Number(evaluation.leakRisk01), Number(evaluation.leakRisk01), 'evaluation:leak', Number(now), Number(evaluation.leakRisk01) * 100),
      predictedWitnessHeat: asScore0To1(Math.max(0.32, Number(offer.visibility.audienceHeat ?? 0))),
      canBeContained: Number(evaluation.leakRisk01) < 0.82,
      note: `Leak escalation created from evaluation strategy ${evaluation.recommendedStrategy}.`,
    },
  ];
}

function deriveOpeningMemories(openingOffer: ChatOffer, now: UnixMs): NegotiationMemoryAnchor[] {
  return [
    {
      memoryId: `memory:${String(openingOffer.offerId)}:opening` as any,
      anchorId: `anchor:${String(openingOffer.offerId)}:opening` as any,
      kind: 'PAST_OFFER',
      salience: asScore0To1(0.42),
      messageId: openingOffer.sourceMessageId as any,
      note: 'Opening offer established the first anchor of the negotiation thread.',
    },
  ];
}

// ============================================================================
// MARK: Resolution + reputation helpers
// ============================================================================

function buildOfferBeat(offer: ChatOffer, evaluation: OfferCounterEngineEvaluation, now: UnixMs): NegotiationSceneBeat {
  return {
    beatId: `beat:${String(offer.offerId)}:${Number(now)}`,
    phase: derivePhaseFromEvaluation(evaluation, offer.kind === 'COUNTER'),
    description: `Offer ${offer.kind} posted @ ${Number(offer.currentVersion.price.amount)} with projected ${evaluation.projectedOutcome}.`,
    actorId: asNegotiationActorId(String(offer.offeredBy.actorId)),
    messageId: offer.sourceMessageId as any,
    witnessHeat: asScore0To1(Number(offer.visibility.audienceHeat ?? 0.18)),
    silenceBeforeMs: 60,
    silenceAfterMs: 140,
  };
}

function buildResolutionBeat(resolution: NegotiationResolution, now: UnixMs): NegotiationSceneBeat {
  return {
    beatId: `beat:${String(resolution.negotiationId)}:resolution:${Number(now)}`,
    phase: 'POSTMORTEM',
    description: `Negotiation resolved as ${resolution.outcome}.`,
    actorId: resolution.winningActorId,
    messageId: undefined,
    witnessHeat: asScore0To1(resolution.leakOccurred ? 0.75 : resolution.rescueOccurred ? 0.42 : 0.3),
    silenceBeforeMs: 120,
    silenceAfterMs: 300,
  };
}

function buildAcceptanceReputationMap(negotiation: ChatNegotiation, acceptedOffer: ChatOffer | undefined): Record<string, number> {
  const map: Record<string, number> = {};
  map[String(negotiation.parties.primary.actorId)] = acceptedOffer && String(acceptedOffer.offeredBy.actorId) === String(negotiation.parties.primary.actorId) ? 4 : 2;
  map[String(negotiation.parties.counterparty.actorId)] = acceptedOffer && String(acceptedOffer.offeredBy.actorId) === String(negotiation.parties.counterparty.actorId) ? 4 : 2;
  if (negotiation.parties.helper) map[String(negotiation.parties.helper.actorId)] = chatOfferSupportsRescue(acceptedOffer ?? ({} as any)) ? 1 : 0;
  return map;
}

function buildRejectionReputationMap(negotiation: ChatNegotiation, rejectedOffer: ChatOffer | undefined): Record<string, number> {
  const map: Record<string, number> = {};
  map[String(negotiation.parties.primary.actorId)] = -1;
  map[String(negotiation.parties.counterparty.actorId)] = -1;
  if (rejectedOffer && rejectedOffer.kind === 'LIQUIDATION') {
    map[String(rejectedOffer.offeredBy.actorId)] = -3;
  }
  return map;
}

function buildOutcomeReputationMap(
  negotiation: ChatNegotiation,
  outcome: NegotiationOutcome,
  offer: ChatOffer | undefined,
  leakOccurred: boolean,
  rescueOccurred: boolean,
): Record<string, number> {
  const map: Record<string, number> = {};
  const base = outcome === 'ACCEPTED' ? 3 : outcome === 'LEAKED' ? -4 : -2;
  map[String(negotiation.parties.primary.actorId)] = base;
  map[String(negotiation.parties.counterparty.actorId)] = base;
  if (offer) map[String(offer.offeredBy.actorId)] += outcome === 'ACCEPTED' ? 1 : outcome === 'LEAKED' ? -2 : 0;
  if (leakOccurred && negotiation.parties.rivalWitness) map[String(negotiation.parties.rivalWitness.actorId)] = 2;
  if (rescueOccurred && negotiation.parties.helper) map[String(negotiation.parties.helper.actorId)] = 2;
  return map;
}

function buildExpiryReputationMap(negotiation: ChatNegotiation): Record<string, number> {
  return {
    [String(negotiation.parties.primary.actorId)]: -1,
    [String(negotiation.parties.counterparty.actorId)]: -1,
  };
}

function derivePhaseFromEvaluation(evaluation: OfferCounterEngineEvaluation, isCounter: boolean): NegotiationPhase {
  if (evaluation.projectedOutcome === 'LIKELY_LEAK') return 'WITNESS';
  if (evaluation.projectedOutcome === 'LIKELY_RESCUE') return 'PRESSURE';
  if (evaluation.projectedOutcome === 'LIKELY_STALL') return 'WINDOW';
  if (isCounter) return 'COUNTER';
  return 'PRESSURE';
}

function shouldSoftLock(evaluation: OfferCounterEngineEvaluation): boolean {
  return evaluation.projectedOutcome === 'LIKELY_ACCEPT' || Number(evaluation.counterDistance01) <= 0.12;
}

// ============================================================================
// MARK: Aggregate vector helpers
// ============================================================================

function averageReputation(actorStates: readonly NegotiationActorState[]): NegotiationReputationVector {
  if (actorStates.length === 0) return createReputationVector(0.4, 0.4, 0.4, 0.3);
  const acc = actorStates.reduce(
    (memo, state) => {
      memo.respect += Number(state.reputation.respect);
      memo.trust += Number(state.reputation.trust);
      memo.embarrassment += Number(state.reputation.embarrassment);
      memo.dominance += Number(state.reputation.dominance);
      return memo;
    },
    { respect: 0, trust: 0, embarrassment: 0, dominance: 0 },
  );
  return createReputationVector(acc.respect / actorStates.length, acc.trust / actorStates.length, acc.embarrassment / actorStates.length, acc.dominance / actorStates.length);
}

function averageEmotion(actorStates: readonly NegotiationActorState[]): NegotiationEmotionVector {
  if (actorStates.length === 0) return createEmotionVector(0.3, 0.4, 0.3, 0.3, 0.2, 0.3);
  const acc = actorStates.reduce(
    (memo, state) => {
      memo.fear += Number(state.emotion.fear);
      memo.confidence += Number(state.emotion.confidence);
      memo.frustration += Number(state.emotion.frustration);
      memo.attachment += Number(state.emotion.attachment);
      memo.relief += Number(state.emotion.relief);
      memo.dominance += Number(state.emotion.dominance);
      return memo;
    },
    { fear: 0, confidence: 0, frustration: 0, attachment: 0, relief: 0, dominance: 0 },
  );
  return createEmotionVector(acc.fear / actorStates.length, acc.confidence / actorStates.length, acc.frustration / actorStates.length, acc.attachment / actorStates.length, acc.relief / actorStates.length, acc.dominance / actorStates.length);
}

function createReputationVector(respect: number, trust: number, embarrassment: number, dominance: number): NegotiationReputationVector {
  return {
    respect: asScore0To1(clamp01(respect)),
    trust: asScore0To1(clamp01(trust)),
    embarrassment: asScore0To1(clamp01(embarrassment)),
    dominance: asScore0To1(clamp01(dominance)),
  };
}

function createEmotionVector(fear: number, confidence: number, frustration: number, attachment: number, relief: number, dominance: number): NegotiationEmotionVector {
  return {
    fear: asScore0To1(clamp01(fear)),
    confidence: asScore0To1(clamp01(confidence)),
    frustration: asScore0To1(clamp01(frustration)),
    attachment: asScore0To1(clamp01(attachment)),
    relief: asScore0To1(clamp01(relief)),
    dominance: asScore0To1(clamp01(dominance)),
  };
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function this_rescue_threshold(): number {
  return 0.69;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function createNegotiationEngine(options: NegotiationEngineOptions = {}): NegotiationEngine {
  return new NegotiationEngine(options);
}

export const ChatNegotiationEngineModule = {
  moduleId: 'backend.chat.dealroom.negotiation-engine',
  file: 'backend/src/game/engine/chat/dealroom/NegotiationEngine.ts',
  version: '2026.03.19',
  create: createNegotiationEngine,
  NegotiationEngine,
} as const;
