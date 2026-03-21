/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT DEALROOM NEGOTIATION ENGINE
 * FILE: backend/src/game/engine/chat/dealroom/NegotiationEngine.ts
 * VERSION: 2026.03.19
 * AUTHORSHIP: Antonio T. Smith Jr.
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
  asOfferAmount,
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
  asProbability,
  asScore0To1,
  asScore0To100,
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
  readonly offerBundlesByNegotiation?: Readonly<Record<string, ChatOfferBundle | undefined>>;
  readonly recentOfferPatchesByNegotiation?: Readonly<Record<string, readonly ChatOfferPatch[]>>;
  readonly recentNegotiationPatchesByNegotiation?: Readonly<Record<string, readonly ChatNegotiationPatch[]>>;
  readonly lastUpdatedAt?: UnixMs;
}

export interface NegotiationCounterResult {
  readonly negotiation: ChatNegotiation;
  readonly counter: OfferCounterBuildResult;
  readonly patches: readonly ChatNegotiationPatch[];
  readonly offerPatches?: readonly ChatOfferPatch[];
}

interface NegotiationRecord {
  readonly negotiationId: string;
  negotiation: ChatNegotiation;
  offers: ChatOffer[];
  evaluations: OfferCounterEngineEvaluation[];
  offerBundles: ChatOfferBundle[];
  offerPatches: ChatOfferPatch[];
  negotiationPatches: ChatNegotiationPatch[];
  lastAuditedOfferWindow?: ChatOfferWindow;
  openedAt: UnixMs;
  updatedAt: UnixMs;
}

interface NegotiationRoomState {
  readonly roomId: ChatRoomId;
  active: Map<string, NegotiationRecord>;
  settled: NegotiationRecord[];
  lastUpdatedAt?: UnixMs;
}

interface OfferLifecycleAssessment {
  readonly offer: ChatOffer;
  readonly visibility: ChatOfferVisibilityEnvelope;
  readonly window?: ChatOfferWindow;
  readonly counterRead: ChatOfferCounterRead;
  readonly patches: readonly ChatOfferPatch[];
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
    const providedCounterEngine = options.offerCounterEngine;
    this.offerCounterEngine =
      providedCounterEngine instanceof OfferCounterEngine
        ? providedCounterEngine
        : createOfferCounterEngine({
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

    const openingOfferDraft = request.openingOffer
      ? normalizeDraftToOffer(request.openingOffer, request.threadId, now, scene.sceneId)
      : undefined;
    const openingAssessment = openingOfferDraft
      ? assessOfferLifecycle(openingOfferDraft, request.primaryChannel, now, undefined, this.defaultOpenWindowMs)
      : undefined;
    const openingOffer = openingAssessment?.offer;
    const openingBundle = openingOffer ? createOfferBundleSnapshot(openingOffer, request.threadId, now) : undefined;
    const activeOffer = openingOffer
      ? toNegotiationEnvelope(
          negotiationId,
          request.threadId,
          request.primaryChannel,
          openingOffer,
          request.parties,
          phase,
          undefined,
          now,
        )
      : undefined;
    const activeWindow = openingOffer
      ? toNegotiationWindowFromOffer(openingOffer, request.primaryChannel, 'OPENING_ANCHOR')
      : scene.activeWindow;
    const openingSignals = openingOffer ? buildOfferSignals(openingOffer, now) : [];
    const latestInference = deriveInferenceFromScene(
      negotiationId,
      phase,
      request.initialIntent ?? (openingOffer ? inferIntentFromOffer(openingOffer) : 'FAIR_TRADE'),
      actorStates,
      openingSignals,
      openingOffer ? buildOfferPressureEdges(openingOffer, openingAssessment?.counterRead, now) : [],
      now,
    );

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
      offerBundles: openingBundle ? [openingBundle] : [],
      offerPatches: openingAssessment ? [...openingAssessment.patches] : [],
      negotiationPatches: [],
      lastAuditedOfferWindow: openingAssessment?.window,
      openedAt: now,
      updatedAt: now,
    };

    const maintenance = deriveNegotiationMaintenance(record.negotiation, now);
    const maintenanceBeats = maintenance.hasAudiencePressure || maintenance.hasLeakThreat
      ? [buildMaintenanceBeat(record.negotiation, maintenance, now, 'Opening telemetry projected into scene.')]
      : [];

    record.negotiation = {
      ...record.negotiation,
      latestInference: mergeInference(record.negotiation, record.negotiation.latestInference ?? latestInference, now),
      scene: {
        ...record.negotiation.scene,
        beats: [...record.negotiation.scene.beats, ...maintenanceBeats].slice(-220),
        updatedAt: now,
      },
      updatedAt: now,
    };

    record.negotiationPatches.push(
      buildNegotiationPatchSnapshot(record.negotiation, now, {
        appendedBeats: maintenanceBeats,
        appendedMemories: record.negotiation.memories,
      }),
    );

    room.active.set(negotiationId, record);
    room.lastUpdatedAt = now;
    this.pruneRoom(room);
    this.logger.info('negotiation:open', {
      roomId: String(request.roomId),
      negotiationId,
      channel: request.primaryChannel,
      openingOfferId: openingOffer ? String(openingOffer.offerId) : null,
      openingBundleId: openingBundle ? String(openingBundle.bundleId) : null,
      live: maintenance.isLive,
      audiencePressure: maintenance.hasAudiencePressure,
      leakPressure: maintenance.hasLeakThreat,
    });
    return record.negotiation;
  }

  ingestMessage(request: NegotiationIngestMessageRequest): ChatNegotiation {
    const record = this.requireActiveRecord(request.roomId, request.negotiationId);
    const now = asUnixMs(Number(request.createdAt ?? this.clock.now()));
    const maintenance = deriveNegotiationMaintenance(record.negotiation, now);
    const primaryState = maintenance.primaryActorState;
    const signalFrame = [
      ...deriveSignalsFromMessage(record.negotiation, request.body, request.messageId, now),
      ...buildMaintenanceSignals(record.negotiation, maintenance, now),
      ...buildActorStateSignals(primaryState, now),
    ];
    const inferenceFrame = deriveInferenceFromScene(
      String(record.negotiation.negotiationId),
      record.negotiation.phase,
      record.negotiation.latestInference?.inferredIntent ?? 'FAIR_TRADE',
      record.negotiation.actorStates,
      signalFrame,
      record.negotiation.latestInference?.pressureEdges ?? [],
      now,
    );
    const inference = mergeInference(record.negotiation, inferenceFrame, now);
    const beats = [
      ...buildSceneBeatsFromMessage(record.negotiation, request, now, inference),
      ...(maintenance.inGraceWindow
        ? [buildMaintenanceBeat(record.negotiation, maintenance, now, 'Message arrived during grace window.')]
        : []),
    ];
    const leakThreats = maybeBuildLeakThreats(record.negotiation, request.body, request.actorId, now, inference);
    const memories = maybeBuildMessageMemories(request.body, request.messageId, now);
    const actorStates = patchActorStatesFromMessage(record.negotiation.actorStates, request.body, request.actorId, now, inference);

    record.negotiation = {
      ...record.negotiation,
      actorStates,
      latestInference: inference,
      leakThreats: [...(record.negotiation.leakThreats ?? []), ...leakThreats].slice(-24),
      memories: [...(record.negotiation.memories ?? []), ...memories].slice(-64),
      scene: {
        ...record.negotiation.scene,
        beats: [...record.negotiation.scene.beats, ...beats].slice(-240),
        currentInference: inference,
        leakThreat: leakThreats.at(-1) ?? record.negotiation.scene.leakThreat,
        updatedAt: now,
      },
      updatedAt: now,
    };
    record.negotiationPatches.push(
      buildNegotiationPatchSnapshot(record.negotiation, now, {
        appendedBeats: beats,
        appendedMemories: memories,
        appendedLeakThreats: leakThreats,
      }),
    );
    record.updatedAt = now;
    this.touchRoom(request.roomId, now);
    this.logger.debug('negotiation:message', {
      roomId: String(request.roomId),
      negotiationId: request.negotiationId,
      live: maintenance.isLive,
      inGrace: maintenance.inGraceWindow,
      latestOfferId: maintenance.latestOfferId ? String(maintenance.latestOfferId) : null,
    });
    return record.negotiation;
  }

  postOffer(request: NegotiationPostOfferRequest): ChatNegotiation {
    const record = this.requireActiveRecord(request.roomId, request.negotiationId);
    const now = asUnixMs(Number(request.postedAt ?? this.clock.now()));
    const priorOffer = selectPriorOfferForEvaluation(record.offers, request.priorOffer, now);
    const offerAssessment = assessOfferLifecycle(
      request.offer,
      record.negotiation.primaryChannel,
      now,
      priorOffer,
      this.defaultOpenWindowMs,
    );
    const offer = offerAssessment.offer;
    const evaluation = this.offerCounterEngine.evaluate({
      roomId: request.roomId,
      negotiation: record.negotiation,
      incomingOffer: offer,
      priorOffer,
      now,
      traceLabel: 'NegotiationEngine.postOffer',
    });

    record.offers.push(offer);
    record.evaluations.push(evaluation);
    appendOfferArtifacts(record, offer, offerAssessment.patches, String(record.negotiation.threadId), now);

    const envelope = toNegotiationEnvelope(
      String(record.negotiation.negotiationId),
      String(record.negotiation.threadId),
      record.negotiation.primaryChannel,
      offer,
      record.negotiation.parties,
      'ANCHOR',
      record.negotiation.latestInference,
      now,
      record.negotiation,
    );

    const evaluationInference = buildInferenceFromEvaluation(record.negotiation, offer, evaluation, now);
    const leakThreats = maybeEscalateLeakFromEvaluation(record.negotiation, evaluation, offer, now, request.roomId);
    const activeWindow = toNegotiationWindowFromOffer(offer, record.negotiation.primaryChannel, 'COUNTER_REQUIRED');
    const nextPhase = derivePhaseFromEvaluation(evaluation, false);
    const nextStatus: NegotiationStatus = 'ACTIVE';
    const maintenance = deriveNegotiationMaintenance(record.negotiation, now);
    const beats = [
      buildOfferBeat(offer, evaluation, now),
      ...(maintenance.hasAudiencePressure || maintenance.hasLeakThreat
        ? [buildMaintenanceBeat(record.negotiation, maintenance, now, 'Offer posted under external pressure.')]
        : []),
    ];

    record.negotiation = {
      ...record.negotiation,
      phase: nextPhase,
      status: nextStatus,
      activeOffer: envelope,
      activeWindow,
      latestInference: mergeInference(record.negotiation, evaluationInference, now),
      leakThreats: [...(record.negotiation.leakThreats ?? []), ...leakThreats].slice(-24),
      scene: {
        ...record.negotiation.scene,
        status: nextStatus,
        activeWindow,
        currentOffer: envelope,
        currentInference: evaluationInference,
        beats: [...record.negotiation.scene.beats, ...beats].slice(-260),
        leakThreat: leakThreats.at(-1) ?? record.negotiation.scene.leakThreat,
        updatedAt: now,
      },
      updatedAt: now,
    };

    record.negotiationPatches.push(
      buildNegotiationPatchSnapshot(record.negotiation, now, {
        appendedBeats: beats,
        appendedLeakThreats: leakThreats,
      }),
    );
    record.lastAuditedOfferWindow = offerAssessment.window;
    record.updatedAt = now;
    this.touchRoom(request.roomId, now);
    return record.negotiation;
  }

  counter(request: NegotiationCounterRequest): NegotiationCounterResult {
    const record = this.requireActiveRecord(request.roomId, request.negotiationId);
    const now = asUnixMs(Number(request.postedAt ?? this.clock.now()));
    const priorOffer = selectPriorOfferForEvaluation(record.offers, request.priorOffer, now);
    const incomingAssessment = assessOfferLifecycle(
      request.incomingOffer,
      record.negotiation.primaryChannel,
      now,
      priorOffer,
      this.defaultOpenWindowMs,
    );
    const incomingOffer = incomingAssessment.offer;
    const counter = this.offerCounterEngine.buildCounter({
      roomId: request.roomId,
      negotiation: record.negotiation,
      incomingOffer,
      priorOffer,
      now,
      note: request.note,
    });
    const counterAssessment = assessOfferLifecycle(
      counter.counterOffer,
      record.negotiation.primaryChannel,
      now,
      incomingOffer,
      this.defaultOpenWindowMs,
    );
    const counterOffer = counterAssessment.offer;

    record.offers.push(incomingOffer, counterOffer);
    record.evaluations.push(counter.evaluation);
    appendOfferArtifacts(record, incomingOffer, incomingAssessment.patches, String(record.negotiation.threadId), now);
    appendOfferArtifacts(record, counterOffer, counterAssessment.patches, String(record.negotiation.threadId), now);

    const nextStatus: NegotiationStatus = shouldSoftLock(counter.evaluation) ? 'SOFT_LOCKED' : 'ACTIVE';
    const nextPhase = derivePhaseFromEvaluation(counter.evaluation, true);
    const inference = buildInferenceFromEvaluation(record.negotiation, counterOffer, counter.evaluation, now);
    const leakThreats = maybeEscalateLeakFromEvaluation(record.negotiation, counter.evaluation, counterOffer, now, request.roomId);
    const memories = maybeBuildCounterMemories(counterOffer, counter.evaluation, now);
    const maintenance = deriveNegotiationMaintenance(record.negotiation, now);
    const activeWindow = chooseNegotiationWindow(counter.counterWindow, counterAssessment.window, record.negotiation.primaryChannel, now);
    const activeEnvelope = toNegotiationEnvelope(
      String(record.negotiation.negotiationId),
      String(record.negotiation.threadId),
      record.negotiation.primaryChannel,
      counterOffer,
      record.negotiation.parties,
      nextPhase,
      inference,
      now,
      record.negotiation,
    );
    const beats = [
      buildOfferBeat(counterOffer, counter.evaluation, now),
      ...(maintenance.supportsRescue && Number(counter.evaluation.rescueNeed01) >= this.rescueEscalationThreshold01
        ? [buildMaintenanceBeat(record.negotiation, maintenance, now, 'Counter path entered rescue-aware escalation lane.')]
        : []),
    ];

    record.negotiation = {
      ...record.negotiation,
      status: nextStatus,
      phase: nextPhase,
      activeOffer: activeEnvelope,
      activeWindow,
      latestInference: inference,
      memories: [...(record.negotiation.memories ?? []), ...memories].slice(-72),
      leakThreats: [...(record.negotiation.leakThreats ?? []), ...leakThreats].slice(-28),
      scene: {
        ...record.negotiation.scene,
        status: nextStatus,
        activeWindow,
        currentOffer: activeEnvelope,
        currentInference: inference,
        beats: [...record.negotiation.scene.beats, ...beats].slice(-280),
        leakThreat: leakThreats.at(-1) ?? record.negotiation.scene.leakThreat,
        updatedAt: now,
      },
      updatedAt: now,
    };
    record.updatedAt = now;
    record.lastAuditedOfferWindow = counterAssessment.window;
    this.touchRoom(request.roomId, now);

    const patches: ChatNegotiationPatch[] = [
      buildNegotiationPatchSnapshot(record.negotiation, now, {
        appendedMemories: memories,
        appendedLeakThreats: leakThreats,
        appendedBeats: beats,
      }),
    ];
    record.negotiationPatches.push(...patches);

    return {
      negotiation: record.negotiation,
      counter: {
        ...counter,
        counterOffer,
        counterEnvelope: activeEnvelope,
        counterWindow: activeWindow,
      },
      patches,
      offerPatches: [...incomingAssessment.patches, ...counterAssessment.patches],
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
      const activeWindowExpired = Boolean(record.negotiation.activeWindow && negotiationWindowHasExpired(record.negotiation.activeWindow, now));
      const offerWindowExpired = Boolean(record.lastAuditedOfferWindow && chatOfferWindowExpired(record.lastAuditedOfferWindow, now));
      const inGrace = Boolean(record.negotiation.activeWindow && negotiationWindowIsInGrace(record.negotiation.activeWindow, now));
      if ((activeWindowExpired || offerWindowExpired) && !inGrace) {
        const resolution: NegotiationResolution = {
          negotiationId: record.negotiation.negotiationId,
          outcome: 'TIMED_OUT',
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
    const offerBundlesByNegotiation: Record<string, ChatOfferBundle | undefined> = {};
    const recentOfferPatchesByNegotiation: Record<string, readonly ChatOfferPatch[]> = {};
    const recentNegotiationPatchesByNegotiation: Record<string, readonly ChatNegotiationPatch[]> = {};
    for (const [id, record] of room.active.entries()) {
      offersByNegotiation[id] = [...record.offers];
      offerBundlesByNegotiation[id] = record.offerBundles.at(-1);
      recentOfferPatchesByNegotiation[id] = record.offerPatches.slice(-16);
      recentNegotiationPatchesByNegotiation[id] = record.negotiationPatches.slice(-16);
    }
    for (const record of room.settled) {
      offersByNegotiation[record.negotiationId] = [...record.offers];
      offerBundlesByNegotiation[record.negotiationId] = record.offerBundles.at(-1);
      recentOfferPatchesByNegotiation[record.negotiationId] = record.offerPatches.slice(-16);
      recentNegotiationPatchesByNegotiation[record.negotiationId] = record.negotiationPatches.slice(-16);
    }
    return {
      roomId,
      activeNegotiations: [...room.active.values()].map((record) => record.negotiation),
      settledNegotiations: room.settled.map((record) => record.negotiation),
      offersByNegotiation,
      offerBundlesByNegotiation,
      recentOfferPatchesByNegotiation,
      recentNegotiationPatchesByNegotiation,
      lastUpdatedAt: room.lastUpdatedAt,
    };
  }

  getNegotiation(roomId: ChatRoomId, negotiationId: string): ChatNegotiation | undefined {
    const room = this.getOrCreateRoom(roomId);
    return room.active.get(negotiationId)?.negotiation ?? room.settled.find((record) => record.negotiationId === negotiationId)?.negotiation;
  }

  getLatestOfferBundle(roomId: ChatRoomId, negotiationId: string): ChatOfferBundle | undefined {
    const room = this.getOrCreateRoom(roomId);
    const record = room.active.get(negotiationId) ?? room.settled.find((candidate) => candidate.negotiationId === negotiationId);
    return record?.offerBundles.at(-1);
  }

  getRecentOfferPatches(roomId: ChatRoomId, negotiationId: string): readonly ChatOfferPatch[] {
    const room = this.getOrCreateRoom(roomId);
    const record = room.active.get(negotiationId) ?? room.settled.find((candidate) => candidate.negotiationId === negotiationId);
    return record ? record.offerPatches.slice(-24) : [];
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
    const maintenance = deriveNegotiationMaintenance(record.negotiation, now);
    const closingBeat = buildResolutionBeat(resolution, now);
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
        beats: [...record.negotiation.scene.beats, closingBeat].slice(-300),
        updatedAt: now,
      },
      updatedAt: now,
    };
    record.negotiationPatches.push(
      buildNegotiationPatchSnapshot(record.negotiation, now, {
        appendedBeats: [closingBeat],
        appendedLeakThreats: maintenance.hasLeakThreat ? record.negotiation.leakThreats?.slice(-2) : undefined,
      }),
    );
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
    reputation: createReputationVector(52, 0.47, 0.42, 0.3),
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
    'OPENING_ANCHOR',
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

function normalizeOfferMarketRange(
  marketRange: ChatOffer['currentVersion']['price']['marketRange'] | ChatOfferDraft['price']['marketRange'] | undefined,
): ChatOffer['currentVersion']['price']['marketRange'] | undefined {
  if (!marketRange) {
    return undefined;
  }
  return {
    min: asOfferAmount(Number(marketRange.min)),
    max: asOfferAmount(Number(marketRange.max)),
    expected: marketRange.expected === undefined ? undefined : asOfferAmount(Number(marketRange.expected)),
    fairValue: marketRange.fairValue === undefined ? undefined : asOfferAmount(Number(marketRange.fairValue)),
  };
}

function normalizeDraftToOffer(draft: ChatOfferDraft | ChatOffer, threadId: string, now: UnixMs, sceneId: any): ChatOffer {
  if ('offerId' in draft) {
    return draft;
  }
  const createdAt = asOfferUnixMs(Number(draft.createdAt ?? now));
  const normalizedPrice = createChatOfferPrice(Number(draft.price.amount), String(draft.price.currency), {
    ...draft.price,
    marketRange: normalizeOfferMarketRange(draft.price.marketRange),
  });
  const normalizedVisibility = normalizeOfferVisibilityEnvelope(draft.visibility, 'DEAL_ROOM');
  const normalizedWindow = ensureOfferWindowIntegrity(
    draft.window,
    createdAt,
    draft.kind,
    normalizedVisibility,
    45_000,
  );
  const seededOffer: ChatOffer = {
    offerId: asChatOfferId(`offer:${threadId}:${Number(createdAt)}`),
    threadId: asChatOfferThreadId(threadId),
    roomId: draft.roomId,
    sceneId: sceneId as any,
    kind: draft.kind,
    status: draft.status === 'DRAFT' ? 'STAGED' : 'POSTED',
    offeredBy: draft.offeredBy,
    offeredTo: draft.offeredTo,
    currentVersion: createChatOfferVersion(1, normalizedPrice, draft.paymentTerms, {
      guarantees: draft.guarantees,
      conditions: draft.conditions,
      concessions: draft.concessions,
      analytics: draft.analytics,
      createdAt: Number(createdAt),
      note: 'Negotiation opening draft normalized to offer.',
    }),
    priorVersions: [],
    visibility: normalizedVisibility,
    window: normalizedWindow,
    counterRead: undefined,
    proof: undefined,
    createdAt,
    updatedAt: createdAt,
  };
  return {
    ...seededOffer,
    counterRead: deriveCounterReadFromOfferData(seededOffer, undefined, normalizedVisibility),
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
  negotiation?: ChatNegotiation,
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
            min: Number(offer.currentVersion.price.marketRange.min),
            max: Number(offer.currentVersion.price.marketRange.max),
            preferred: offer.currentVersion.price.marketRange.expected === undefined ? undefined : Number(offer.currentVersion.price.marketRange.expected),
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
          referencesOfferId: safeLatestOfferId(negotiation),
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


interface NegotiationMaintenanceEnvelope {
  readonly isLive: boolean;
  readonly hasAudiencePressure: boolean;
  readonly hasLeakThreat: boolean;
  readonly supportsRescue: boolean;
  readonly inGraceWindow: boolean;
  readonly latestOfferId?: ReturnType<typeof asNegotiationOfferId>;
  readonly primaryActorState?: NegotiationActorState;
}

function normalizeOfferVisibilityEnvelope(
  visibility: ChatOfferVisibilityEnvelope,
  channel: ChatNegotiation['primaryChannel'],
): ChatOfferVisibilityEnvelope {
  const audienceHeat = clamp01(Number(visibility.audienceHeat ?? (channel === 'GLOBAL' ? 0.48 : 0.16)));
  const secrecyPressure = clamp01(Number(visibility.secrecyPressure ?? (channel === 'DEAL_ROOM' ? 0.46 : 0.22)));
  return {
    ...visibility,
    visibility:
      visibility.visibility === 'PRIVATE' && channel === 'GLOBAL'
        ? 'DEAL_ROOM_PLUS_WITNESSES'
        : visibility.visibility,
    revealMode: visibility.revealMode,
    witnessCount: Math.max(0, Number(visibility.witnessCount ?? (channel === 'SPECTATOR' ? 3 : 1))),
    helperVisible: Boolean(visibility.helperVisible),
    audienceHeat: asScore0To1(audienceHeat),
    secrecyPressure: asScore0To1(secrecyPressure),
  };
}

function ensureOfferWindowIntegrity(
  window: ChatOfferWindow | undefined,
  now: UnixMs,
  kind: ChatOffer['kind'],
  visibility: ChatOfferVisibilityEnvelope,
  fallbackWindowMs: number,
): ChatOfferWindow | undefined {
  const windowMs = clampInt(
    fallbackWindowMs + Math.round(Number(visibility.witnessCount ?? 0) * 2_500) + (kind === 'TAKE_IT_OR_LEAVE_IT' ? -8_000 : 0),
    8_000,
    180_000,
  );
  if (!window) {
    return createChatOfferWindow(Number(now), Number(now) + windowMs, {
      graceUntil: asOfferUnixMs(Number(now) + Math.round(windowMs * 1.15)),
      rescueEligibleAt: asOfferUnixMs(Number(now) + Math.round(windowMs * 0.45)),
      leakEligibleAt: asOfferUnixMs(Number(now) + Math.round(windowMs * 0.72)),
      readPreferredBy: asOfferUnixMs(Number(now) + Math.round(windowMs * 0.4)),
    });
  }
  if (!chatOfferWindowExpired(window, now)) {
    return window;
  }
  const reopenedAt = asOfferUnixMs(Number(now));
  return createChatOfferWindow(Number(reopenedAt), Number(reopenedAt) + Math.round(windowMs * 0.6), {
    windowId: String(window.windowId),
    graceUntil: asOfferUnixMs(Number(reopenedAt) + Math.round(windowMs * 0.8)),
    rescueEligibleAt: window.rescueEligibleAt,
    leakEligibleAt: window.leakEligibleAt,
    readPreferredBy: asOfferUnixMs(Number(reopenedAt) + Math.round(windowMs * 0.25)),
  });
}

function deriveCounterReadFromOfferData(
  offer: ChatOffer,
  priorOffer: ChatOffer | null | undefined,
  visibility: ChatOfferVisibilityEnvelope,
): ChatOfferCounterRead {
  const currentAmount = Number(asPricePoints(Number(offer.currentVersion.price.amount)));
  const priorAmount = priorOffer ? Number(asPricePoints(Number(priorOffer.currentVersion.price.amount))) : currentAmount;
  const baseDelta = priorOffer ? Math.abs(currentAmount - priorAmount) / Math.max(1, Math.abs(priorAmount)) : 0.12;
  const urgency = Number(offer.currentVersion.analytics?.urgency.normalized ?? 0.35);
  const leakRisk = clamp01(Number(visibility.audienceHeat ?? 0) * 0.45 + Number(visibility.secrecyPressure ?? 0) * 0.35 + urgency * 0.2);
  const rescueNeed = clamp01(Number(visibility.helperVisible ? 0.14 : 0) + Number(offer.currentVersion.analytics?.desperation ?? 0) * 0.55 + baseDelta * 0.25);
  const stallRisk = clamp01((1 - urgency) * 0.42 + baseDelta * 0.18);
  const rejectionRisk = clamp01(baseDelta * 0.58 + Number(offer.currentVersion.analytics?.aggression.normalized ?? 0) * 0.22);
  return {
    likelyOutcome:
      leakRisk >= 0.72
        ? 'LIKELY_LEAK'
        : rescueNeed >= 0.66
          ? 'LIKELY_RESCUE'
          : rejectionRisk >= 0.58
            ? 'LIKELY_REJECT'
            : stallRisk >= 0.54
              ? 'LIKELY_STALL'
              : baseDelta <= 0.12
                ? 'LIKELY_ACCEPT'
                : 'LIKELY_COUNTER',
    counterDistance: asScore0To1(clamp01(baseDelta)),
    rejectionRisk: asScore0To1(rejectionRisk),
    stallRisk: asScore0To1(stallRisk),
    rescueNeed: asScore0To1(rescueNeed),
    leakRisk: asScore0To1(leakRisk),
  };
}

function buildOfferLifecyclePatches(
  offer: ChatOffer,
  visibility: ChatOfferVisibilityEnvelope,
  window: ChatOfferWindow | undefined,
  counterRead: ChatOfferCounterRead,
  now: UnixMs,
): ChatOfferPatch[] {
  const lifecyclePatch: ChatOfferPatch = {
    offerId: offer.offerId,
    status: offer.status,
    currentVersion: offer.currentVersion,
    visibility,
    window: window ?? null,
    counterRead,
    updatedAt: now,
  };
  return [lifecyclePatch];
}

function applyOfferPatches(offer: ChatOffer, patches: readonly ChatOfferPatch[]): ChatOffer {
  return patches.reduce<ChatOffer>((current, patch) => ({
    ...current,
    status: patch.status ?? current.status,
    currentVersion: patch.currentVersion ?? current.currentVersion,
    visibility: patch.visibility ?? current.visibility,
    window: patch.window === undefined ? current.window : patch.window ?? undefined,
    counterRead: patch.counterRead === undefined ? current.counterRead : patch.counterRead ?? undefined,
    proof: patch.proof === undefined ? current.proof : patch.proof ?? undefined,
    updatedAt: patch.updatedAt ?? current.updatedAt,
  }), offer);
}

function assessOfferLifecycle(
  offer: ChatOffer,
  channel: ChatNegotiation['primaryChannel'],
  now: UnixMs,
  priorOffer: ChatOffer | null | undefined,
  fallbackWindowMs: number,
): OfferLifecycleAssessment {
  const visibility = normalizeOfferVisibilityEnvelope(offer.visibility, channel);
  const window = ensureOfferWindowIntegrity(offer.window, now, offer.kind, visibility, fallbackWindowMs);
  const counterRead = deriveCounterReadFromOfferData(offer, priorOffer, visibility);
  const normalizedPrice = createChatOfferPrice(Number(offer.currentVersion.price.amount), String(offer.currentVersion.price.currency), {
    ...offer.currentVersion.price,
    marketRange: normalizeOfferMarketRange(offer.currentVersion.price.marketRange),
  });
  const currentVersion = createChatOfferVersion(offer.currentVersion.versionNumber, normalizedPrice, offer.currentVersion.paymentTerms, {
    ...offer.currentVersion,
    guarantees: offer.currentVersion.guarantees,
    conditions: offer.currentVersion.conditions,
    concessions: offer.currentVersion.concessions,
    analytics: offer.currentVersion.analytics,
    createdAt: Number(offer.currentVersion.createdAt),
    note: chatOfferHasGuarantee(offer)
      ? `${offer.currentVersion.note ?? ''}`.trim() || 'Guaranteed offer lifecycle audited.'
      : offer.currentVersion.note,
  });
  const patchedOffer = applyOfferPatches(
    {
      ...offer,
      currentVersion,
      visibility,
      window,
      counterRead,
      updatedAt: now,
    },
    buildOfferLifecyclePatches(
      {
        ...offer,
        currentVersion,
        visibility,
        window,
        counterRead,
        updatedAt: now,
      },
      visibility,
      window,
      counterRead,
      now,
    ),
  );
  const patches = buildOfferLifecyclePatches(patchedOffer, visibility, window, counterRead, now);
  return {
    offer: applyOfferPatches(patchedOffer, patches),
    visibility,
    window,
    counterRead,
    patches,
  };
}

function createOfferBundleSnapshot(
  offer: ChatOffer,
  threadId: string,
  now: UnixMs,
  priorBundle?: ChatOfferBundle,
): ChatOfferBundle {
  const offers = priorBundle
    ? [...priorBundle.offers.filter((candidate) => String(candidate.offerId) !== String(offer.offerId)), offer]
    : [offer];
  return {
    bundleId: (priorBundle?.bundleId ?? (`bundle:${threadId}:${String(offer.offerId)}` as any)) as any,
    threadId: asChatOfferThreadId(threadId),
    offers,
    leadOfferId: (priorBundle?.leadOfferId ?? offer.offerId) as any,
    createdAt: priorBundle?.createdAt ?? now,
    updatedAt: now,
  };
}

function appendOfferArtifacts(
  record: NegotiationRecord,
  offer: ChatOffer,
  patches: readonly ChatOfferPatch[],
  threadId: string,
  now: UnixMs,
): void {
  record.offerPatches.push(...patches);
  const priorBundle = record.offerBundles.at(-1);
  const nextBundle = createOfferBundleSnapshot(offer, threadId, now, priorBundle);
  record.offerBundles.push(nextBundle);
}

function selectPriorOfferForEvaluation(
  offers: readonly ChatOffer[],
  explicitPrior: ChatOffer | null | undefined,
  now: UnixMs,
): ChatOffer | null | undefined {
  if (explicitPrior && !chatOfferWindowExpired(explicitPrior.window, now)) {
    return explicitPrior;
  }
  for (let index = offers.length - 1; index >= 0; index -= 1) {
    const candidate = offers[index];
    if (!chatOfferWindowExpired(candidate.window, now)) {
      return candidate;
    }
  }
  return explicitPrior ?? offers.at(-1);
}

function chooseNegotiationWindow(
  engineWindow: NegotiationWindow | undefined,
  offerWindow: ChatOfferWindow | undefined,
  channel: ChatNegotiation['primaryChannel'],
  now: UnixMs,
): NegotiationWindow {
  if (engineWindow) {
    return engineWindow;
  }
  if (offerWindow) {
    return createNegotiationWindow('COUNTER_REQUIRED', channel, Number(offerWindow.opensAt), Number(offerWindow.closesAt), {
      windowId: String(offerWindow.windowId),
      graceUntil: offerWindow.graceUntil,
      helperEligibleAt: offerWindow.rescueEligibleAt,
      rescueEligibleAt: offerWindow.rescueEligibleAt,
      leakEligibleAt: offerWindow.leakEligibleAt,
    });
  }
  return createNegotiationWindow('COUNTER_REQUIRED', channel, Number(now), Number(now) + 30_000, {
    graceUntil: asUnixMs(Number(now) + 42_000),
    helperEligibleAt: asUnixMs(Number(now) + 12_000),
    rescueEligibleAt: asUnixMs(Number(now) + 18_000),
    leakEligibleAt: asUnixMs(Number(now) + 24_000),
  });
}

function safeLatestOfferId(negotiation?: ChatNegotiation): ReturnType<typeof asNegotiationOfferId> | undefined {
  if (!negotiation) {
    return undefined;
  }
  const latest = negotiationLatestOfferId(negotiation as any) as unknown;
  return latest ? (latest as ReturnType<typeof asNegotiationOfferId>) : undefined;
}

function deriveNegotiationMaintenance(negotiation: ChatNegotiation, now: UnixMs): NegotiationMaintenanceEnvelope {
  const primaryActorState = negotiationPrimaryActorState(
    negotiation,
    asNegotiationActorId(String(negotiation.parties.primary.actorId)),
  );
  return {
    isLive: Boolean(negotiationIsLive(negotiation as any)),
    hasAudiencePressure: Boolean(negotiationHasAudiencePressure(negotiation as any)),
    hasLeakThreat: Boolean(negotiationHasLeakThreat(negotiation as any)),
    supportsRescue: Boolean(negotiationSupportsRescue(negotiation as any)),
    inGraceWindow: Boolean(negotiation.activeWindow && negotiationWindowIsInGrace(negotiation.activeWindow, now)),
    latestOfferId: safeLatestOfferId(negotiation),
    primaryActorState,
  };
}

function buildOfferSignals(offer: ChatOffer, now: UnixMs): NegotiationSignalEvidence[] {
  return [
    signal('TRUST_SIGNAL', chatOfferHasGuarantee(offer) ? 0.68 : 0.24, now, 'Offer guarantee posture evaluated from lifecycle contract.'),
    signal('LEAK_RISK', Number(offer.counterRead?.leakRisk ?? 0.18), now, 'Offer visibility and secrecy projected into leak risk.'),
    signal('HELPER_NEED', Number(offer.counterRead?.rescueNeed ?? 0.14), now, 'Offer counter-read projected helper need.'),
  ];
}

function buildOfferPressureEdges(
  offer: ChatOffer,
  counterRead: ChatOfferCounterRead | undefined,
  now: UnixMs,
): NegotiationPressureEdge[] {
  return [
    pressure('PRICE', Number(counterRead?.counterDistance ?? 0.18), `Offer ${String(offer.offerId)} price pressure.`),
    pressure('TIME', Number(offer.currentVersion.analytics?.urgency.normalized ?? 0.22), `Offer ${String(offer.offerId)} urgency pressure.`),
    pressure('LEAK', Number(counterRead?.leakRisk ?? 0.14), `Offer ${String(offer.offerId)} leak pressure.`),
  ];
}

function buildMaintenanceSignals(
  negotiation: ChatNegotiation,
  maintenance: NegotiationMaintenanceEnvelope,
  now: UnixMs,
): NegotiationSignalEvidence[] {
  const signals: NegotiationSignalEvidence[] = [];
  if (maintenance.hasAudiencePressure) {
    signals.push(signal('REPUTATION_RISK', 0.62, now, 'Audience pressure helper flagged the negotiation state.'));
  }
  if (maintenance.hasLeakThreat) {
    signals.push(signal('LEAK_RISK', 0.7, now, 'Negotiation-level leak helper flagged an active leak threat.'));
  }
  if (maintenance.supportsRescue) {
    signals.push(signal('HELPER_NEED', 0.38, now, 'Negotiation supports rescue escalation.'));
  }
  if (!maintenance.isLive) {
    signals.push(signal('PASSIVITY', 0.32, now, 'Negotiation is not considered live by derived helper.'));
  }
  if (maintenance.inGraceWindow) {
    signals.push(signal('URGENCY', 0.54, now, 'Negotiation is operating inside a grace window.'));
  }
  if (maintenance.latestOfferId) {
    signals.push(signal('TRUST_SIGNAL', 0.26, now, `Latest offer tracked as ${String(maintenance.latestOfferId)}.`));
  }
  if (negotiation.activeOffer?.vector.intent === 'RESCUE_OVERRIDE') {
    signals.push(signal('HELPER_NEED', 0.66, now, 'Active offer already implies rescue override posture.'));
  }
  return signals;
}

function buildActorStateSignals(
  primaryActorState: NegotiationActorState | undefined,
  now: UnixMs,
): NegotiationSignalEvidence[] {
  if (!primaryActorState) {
    return [];
  }
  return [
    signal('AGGRESSION', Number(primaryActorState.aggression), now, 'Primary actor aggression projected into inference.'),
    signal('BLUFF', Number(primaryActorState.bluffFrequency), now, 'Primary actor bluff frequency projected into inference.'),
    signal('TRUST_SIGNAL', Number(primaryActorState.honestySignal), now, 'Primary actor honesty projected into inference.'),
  ];
}

function buildMaintenanceBeat(
  negotiation: ChatNegotiation,
  maintenance: NegotiationMaintenanceEnvelope,
  now: UnixMs,
  description: string,
): NegotiationSceneBeat {
  return {
    beatId: `beat:${String(negotiation.negotiationId)}:maintenance:${Number(now)}`,
    phase: negotiation.phase,
    description,
    actorId: maintenance.primaryActorState?.actor.actorId,
    messageId: undefined,
    witnessHeat: asScore0To1(
      clamp01(
        (maintenance.hasAudiencePressure ? 0.42 : 0.12) +
          (maintenance.hasLeakThreat ? 0.24 : 0) +
          (maintenance.inGraceWindow ? 0.14 : 0),
      ),
    ),
    silenceBeforeMs: 30,
    silenceAfterMs: 90,
  };
}

function buildNegotiationPatchSnapshot(
  negotiation: ChatNegotiation,
  now: UnixMs,
  input: {
    appendedBeats?: readonly NegotiationSceneBeat[];
    appendedMemories?: readonly NegotiationMemoryAnchor[];
    appendedLeakThreats?: readonly NegotiationLeakThreat[];
  } = {},
): ChatNegotiationPatch {
  return {
    negotiationId: negotiation.negotiationId,
    phase: negotiation.phase,
    status: negotiation.status,
    activeOffer: negotiation.activeOffer,
    activeWindow: negotiation.activeWindow,
    latestInference: negotiation.latestInference,
    latestResolution: negotiation.latestResolution,
    appendedBeats: input.appendedBeats,
    appendedMemories: input.appendedMemories,
    appendedLeakThreats: input.appendedLeakThreats,
    updatedAt: now,
  } as ChatNegotiationPatch;
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

function toNegotiationConcessions(concessions: ChatOffer['currentVersion']['concessions'] | undefined): NegotiationConcession[] | undefined {
  if (!concessions || concessions.length === 0) return undefined;
  return concessions.map((concession) => ({
    type: 'PROOF' as const,
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
    overpayRisk: asScore0To1(clamp01(pressureIntensity * 0.3)),
    underbidRisk: asScore0To1(clamp01(fear * 0.24 + pressureIntensity * 0.22)),
    churnRisk: asScore0To1(clamp01((1 - pressureIntensity) * 0.22 + helper * 0.1)),
    bluffLikelihood: asProbability(clamp01(reputation)),
    collapseRisk: asScore0To1(clamp01(fear * 0.35 + leak * 0.25 + pressureIntensity * 0.2)),
    leakRisk: asScore0To1(leak),
    rescueNeed: asScore0To1(clamp01(helper * 0.5 + fear * 0.18 + leak * 0.12)),
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
    overpayRisk: asScore0To1((Number(prior.risk.overpayRisk) + Number(frame.risk.overpayRisk)) / 2),
    underbidRisk: asScore0To1((Number(prior.risk.underbidRisk) + Number(frame.risk.underbidRisk)) / 2),
    churnRisk: asScore0To1((Number(prior.risk.churnRisk) + Number(frame.risk.churnRisk)) / 2),
    bluffLikelihood: asProbability((Number(prior.risk.bluffLikelihood) + Number(frame.risk.bluffLikelihood)) / 2),
    collapseRisk: asScore0To1((Number(prior.risk.collapseRisk) + Number(frame.risk.collapseRisk)) / 2),
    leakRisk: asScore0To1((Number(prior.risk.leakRisk) + Number(frame.risk.leakRisk)) / 2),
    rescueNeed: asScore0To1((Number(prior.risk.rescueNeed) + Number(frame.risk.rescueNeed)) / 2),
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
    intimidation: emotion.intimidation,
    confidence: asScore0To1(clamp01((Number(emotion.confidence) + (1 - Number(inference.risk.underbidRisk))) / 2)),
    frustration: asScore0To1(clamp01((Number(emotion.frustration) + Number(inference.risk.churnRisk)) / 2)),
    curiosity: emotion.curiosity,
    attachment: asScore0To1(clamp01((Number(emotion.attachment) + Number(inference.risk.rescueNeed)) / 2)),
    embarrassment: emotion.embarrassment,
    relief: asScore0To1(clamp01((Number(emotion.relief) + (1 - Number(inference.risk.leakRisk))) / 2)),
    dominance: emotion.dominance,
    desperation: asScore0To1(clamp01((Number(emotion.desperation) + Number(inference.risk.collapseRisk)) / 2)),
    trust: emotion.trust,
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
  if (actorStates.length === 0) return createReputationVector(40, 0.4, 0.4, 0.3);
  const acc = actorStates.reduce(
    (memo, state) => {
      memo.current += Number(state.reputation.current);
      memo.leakRisk += Number(state.reputation.leakRisk);
      memo.faceThreat += Number(state.reputation.faceThreat);
      memo.witnessHeat += Number(state.reputation.witnessHeat);
      return memo;
    },
    { current: 0, leakRisk: 0, faceThreat: 0, witnessHeat: 0 },
  );
  const n = actorStates.length;
  return createReputationVector(acc.current / n, acc.leakRisk / n, acc.faceThreat / n, acc.witnessHeat / n);
}

function averageEmotion(actorStates: readonly NegotiationActorState[]): NegotiationEmotionVector {
  if (actorStates.length === 0) return createEmotionVector(0.3, 0.4, 0.3, 0.3, 0.2, 0.3);
  const acc = actorStates.reduce(
    (memo, state) => {
      memo.intimidation += Number(state.emotion.intimidation);
      memo.confidence += Number(state.emotion.confidence);
      memo.frustration += Number(state.emotion.frustration);
      memo.attachment += Number(state.emotion.attachment);
      memo.relief += Number(state.emotion.relief);
      memo.dominance += Number(state.emotion.dominance);
      memo.desperation += Number(state.emotion.desperation);
      return memo;
    },
    { intimidation: 0, confidence: 0, frustration: 0, attachment: 0, relief: 0, dominance: 0, desperation: 0 },
  );
  const n = actorStates.length;
  return createEmotionVector(acc.intimidation / n, acc.confidence / n, acc.frustration / n, acc.attachment / n, acc.relief / n, acc.dominance / n, acc.desperation / n);
}

function createReputationVector(current: number, leakRisk: number, faceThreat: number, witnessHeat: number): NegotiationReputationVector {
  return {
    current: asScore0To100(Math.min(100, Math.max(0, current))),
    projectedDelta: 0,
    leakRisk: asScore0To1(clamp01(leakRisk)),
    faceThreat: asScore0To1(clamp01(faceThreat)),
    witnessHeat: asScore0To1(clamp01(witnessHeat)),
  };
}

function createEmotionVector(intimidation: number, confidence: number, frustration: number, attachment: number, relief: number, dominance: number, desperation: number = 0): NegotiationEmotionVector {
  return {
    intimidation: asScore0To1(clamp01(intimidation)),
    confidence: asScore0To1(clamp01(confidence)),
    frustration: asScore0To1(clamp01(frustration)),
    curiosity: asScore0To1(0),
    attachment: asScore0To1(clamp01(attachment)),
    embarrassment: asScore0To1(0),
    relief: asScore0To1(clamp01(relief)),
    dominance: asScore0To1(clamp01(dominance)),
    desperation: asScore0To1(clamp01(desperation)),
    trust: asScore0To1(0),
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
