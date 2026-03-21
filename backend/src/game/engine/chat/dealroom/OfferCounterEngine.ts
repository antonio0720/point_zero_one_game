/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT DEALROOM OFFER COUNTER ENGINE
 * FILE: backend/src/game/engine/chat/dealroom/OfferCounterEngine.ts
 * VERSION: 2026.03.19
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Backend offer-counter authority for Deal Room negotiations.
 *
 * This engine does not own UI.
 * This engine does not own socket fanout.
 * This engine does not pretend offers are only numbers.
 *
 * It exists to turn a posted or drafted offer into backend-truth analysis:
 * - fairness
 * - aggression
 * - urgency
 * - desperation
 * - trust signaling
 * - leak risk
 * - rescue demand
 * - likely outcome band
 * - counter distance
 * - counter-offer recommendation
 * - concession stack
 * - proof / witness / helper sensitivity
 *
 * The rest of the runtime can then narrate, score, archive, or render those
 * projections without re-deriving them from frontend heuristics.
 * ============================================================================
 */

import type {
  ChatOffer,
  ChatOfferActorRef,
  ChatOfferAnalytics,
  ChatOfferConcession,
  ChatOfferCounterOutcome,
  ChatOfferCounterRead,
  ChatOfferDraft,
  ChatOfferGuarantee,
  ChatOfferKind,
  ChatOfferPatch,
  ChatOfferPrice,
  ChatOfferStatus,
  ChatOfferVersion,
  ChatOfferVisibilityEnvelope,
  ChatOfferWindow,
  OfferAmount,
  Probability,
  Score0To1,
  Score0To100,
  UnixMs,
} from '../../../../../../shared/contracts/chat/ChatOffer';
import {
  asChatOfferId,
  asChatOfferThreadId,
  asCurrencyCode,
  asOfferAmount,
  asProbability,
  asScore0To1,
  asScore0To100,
  asUnixMs as asOfferUnixMs,
  chatOfferCanLeak,
  chatOfferConcessionCount,
  chatOfferSupportsRescue,
  chatOfferConditionCount,
  chatOfferGuaranteeStrength,
  chatOfferHasConditions,
  chatOfferHasConcessions,
  chatOfferHasGuarantee,
  chatOfferProjectedHostility,
  chatOfferProjectedOutcomeBand,
  chatOfferProjectedSoftness,
  chatOfferProjectedTrustworthiness,
  chatOfferPriceDeltaFromPrior,
  chatOfferPriceWithinRange,
  chatOfferShouldTriggerHelperReview,
  createChatOfferPrice,
  createChatOfferScore,
  createChatOfferStressProjection,
  createChatOfferVersion,
  createChatOfferWindow,
} from '../../../../../../shared/contracts/chat/ChatOffer';
import type {
  ChatNegotiation,
  NegotiationActorRef,
  NegotiationActorState,
  NegotiationConcession,
  NegotiationInferenceFrame,
  NegotiationIntent,
  NegotiationLeakThreat,
  NegotiationOfferEnvelope,
  NegotiationPartyPair,
  NegotiationPhase,
  NegotiationPriceVector,
  NegotiationResolution,
  NegotiationSignalEvidence,
  NegotiationStatus,
  NegotiationWindow,
} from '../../../../../../shared/contracts/chat/ChatNegotiation';
import {
  asNegotiationOfferId,
  asNegotiationWindowId,
  asPricePoints,
  asScore0To1 as asNegotiationScore0To1,
  asUnixMs,
  createNegotiationPriceVector,
  createNegotiationScoreBand,
  createNegotiationWindow,
  negotiationHasAudiencePressure,
  negotiationHasLeakThreat,
  negotiationInferDominantPressure,
  negotiationLatestOfferId,
  negotiationPrimaryActorState,
  negotiationSupportsRescue,
  negotiationWindowHasExpired,
  negotiationWindowIsInGrace,
} from '../../../../../../shared/contracts/chat/ChatNegotiation';
import type { ChatRoomId, JsonValue } from '../types';
import { clamp01 } from '../types';

// ============================================================================
// MARK: Public contracts
// ============================================================================

export interface OfferCounterEngineClock {
  now(): number;
}

export interface OfferCounterEngineLogger {
  debug(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface OfferCounterEngineOptions {
  readonly clock?: OfferCounterEngineClock;
  readonly logger?: OfferCounterEngineLogger;
  readonly defaultCounterWindowMs?: number;
  readonly minCounterWindowMs?: number;
  readonly maxCounterWindowMs?: number;
  readonly retainEvaluationsPerRoom?: number;
  readonly helperAssistThreshold01?: number;
  readonly rescueThreshold01?: number;
  readonly leakThreshold01?: number;
  readonly volatilityThreshold01?: number;
}

export interface OfferCounterEvaluationRequest {
  readonly roomId: ChatRoomId;
  readonly negotiation: ChatNegotiation;
  readonly incomingOffer: ChatOffer;
  readonly priorOffer?: ChatOffer | null;
  readonly now?: UnixMs;
  readonly traceLabel?: string;
}

export interface OfferCounterBuildRequest {
  readonly roomId: ChatRoomId;
  readonly negotiation: ChatNegotiation;
  readonly incomingOffer: ChatOffer;
  readonly priorOffer?: ChatOffer | null;
  readonly now?: UnixMs;
  readonly requestedKind?: ChatOfferKind;
  readonly note?: string;
}

export interface OfferCounterProbabilityVector {
  readonly accepted: Probability;
  readonly counter: Probability;
  readonly reject: Probability;
  readonly leak: Probability;
  readonly rescue: Probability;
}

export interface OfferCounterScoreCard {
  readonly fairness100: Score0To100;
  readonly trust100: Score0To100;
  readonly pressure100: Score0To100;
  readonly volatility100: Score0To100;
}

export interface OfferCounterActorLens {
  readonly parties: NegotiationPartyPair;
  readonly offeredByState?: NegotiationActorState;
  readonly offeredToState?: NegotiationActorState;
  readonly leverageGap01: Score0To1;
  readonly patienceGap01: Score0To1;
  readonly honestyGap01: Score0To1;
  readonly reputationGap: number;
}

export interface OfferCounterInferenceSummary {
  readonly inference?: NegotiationInferenceFrame;
  readonly signalCount: number;
  readonly bluffSignals: number;
  readonly rescueSignals: number;
  readonly pressureSignals: number;
  readonly strongestSignals: readonly NegotiationSignalEvidence[];
  readonly confidenceBand: ReturnType<typeof createNegotiationScoreBand>;
}

export interface OfferCounterLeakProfile {
  readonly threats: readonly NegotiationLeakThreat[];
  readonly peakSeverity01: Score0To1;
  readonly predictedWitnessHeat01: Score0To1;
  readonly containableCount: number;
}

export interface OfferCounterResolutionProfile {
  readonly resolution?: NegotiationResolution;
  readonly recentOutcome?: NegotiationResolution['outcome'];
  readonly leakOccurred: boolean;
  readonly rescueOccurred: boolean;
  readonly winningActorId?: string;
}

export interface OfferCounterWindowDiagnostics {
  readonly offerWindowExpired: boolean;
  readonly activeWindowExpired: boolean;
  readonly activeWindowGrace: boolean;
  readonly activeWindowId?: string;
  readonly latestOfferId?: string;
}

export interface OfferCounterEngineEvaluation {
  readonly evaluationId: string;
  readonly roomId: ChatRoomId;
  readonly negotiationId: string;
  readonly offerId: string;
  readonly evaluatedAt: UnixMs;
  readonly fairness01: Score0To1;
  readonly aggression01: Score0To1;
  readonly urgency01: Score0To1;
  readonly desperation01: Score0To1;
  readonly trust01: Score0To1;
  readonly softness01: Score0To1;
  readonly leakRisk01: Score0To1;
  readonly rescueNeed01: Score0To1;
  readonly rejectionRisk01: Score0To1;
  readonly stallRisk01: Score0To1;
  readonly counterDistance01: Score0To1;
  readonly scoreCard: OfferCounterScoreCard;
  readonly projectedProbabilities: OfferCounterProbabilityVector;
  readonly projectedOutcome: ChatOfferCounterOutcome;
  readonly baselineBand: 'SAFE' | 'RISKY' | 'VOLATILE' | 'COLLAPSE';
  readonly projectedBand: 'SAFE' | 'RISKY' | 'VOLATILE' | 'COLLAPSE';
  readonly helperReviewSuggested: boolean;
  readonly actorLens: OfferCounterActorLens;
  readonly inferenceSummary: OfferCounterInferenceSummary;
  readonly leakProfile: OfferCounterLeakProfile;
  readonly resolutionProfile: OfferCounterResolutionProfile;
  readonly windowDiagnostics: OfferCounterWindowDiagnostics;
  readonly pressureSummary: readonly string[];
  readonly reasons: readonly OfferCounterReason[];
  readonly recommendedStrategy: CounterStrategy;
  readonly debug: JsonValue;
}

export interface OfferCounterReason {
  readonly code: OfferCounterReasonCode;
  readonly weight: number;
  readonly detail: string;
  readonly evidence?: JsonValue;
}

export type OfferCounterReasonCode =
  | 'NO_PRIOR_OFFER'
  | 'PRICE_OVER_FAIR_VALUE'
  | 'PRICE_UNDER_FAIR_VALUE'
  | 'AGGRESSIVE_VISIBILITY'
  | 'TRAP_REVEAL_MODE'
  | 'WEAK_GUARANTEE'
  | 'STRONG_GUARANTEE'
  | 'CONCESSION_STACK'
  | 'HELPER_RECOMMENDED_CONCESSION'
  | 'AUDIENCE_HEAT'
  | 'SECRECY_PRESSURE'
  | 'LEAK_THREAT_PRESENT'
  | 'RESCUE_ELIGIBLE'
  | 'EXPIRING_WINDOW'
  | 'PAST_COUNTER_DELTA'
  | 'DOMINANT_PRICE_PRESSURE'
  | 'DOMINANT_TIME_PRESSURE'
  | 'DOMINANT_MEMORY_PRESSURE'
  | 'DOMINANT_AUDIENCE_PRESSURE'
  | 'DOMINANT_RESCUE_PRESSURE'
  | 'DESPERATION_SIGNAL'
  | 'TRUST_SIGNAL'
  | 'FAKEOUT_SIGNAL'
  | 'PUBLIC_WITNESS'
  | 'SOFTNESS_SIGNAL'
  | 'ACTOR_LEVERAGE_GAP'
  | 'WINDOW_IN_GRACE'
  | 'WINDOW_EXPIRED'
  | 'SIGNAL_STACK'
  | 'BASELINE_BAND_MISMATCH'
  | 'RECENT_LEAK_MEMORY'
  | 'RECENT_RESCUE_MEMORY'
  | 'STATUS_LOCK'
  | 'UNKNOWN';

export type CounterStrategy =
  | 'HOLD'
  | 'SOFT_COUNTER'
  | 'HARD_COUNTER'
  | 'STALL'
  | 'WITHDRAW'
  | 'HELPER_REVIEW'
  | 'RESCUE_ESCALATE'
  | 'LEAK_CONTAINMENT';

export interface OfferCounterBuildResult {
  readonly evaluation: OfferCounterEngineEvaluation;
  readonly counterOffer: ChatOffer;
  readonly counterDraft: ChatOfferDraft;
  readonly counterPatch: ChatOfferPatch;
  readonly counterStatus: ChatOfferStatus;
  readonly counterVersion: ChatOfferVersion;
  readonly counterEnvelope: NegotiationOfferEnvelope;
  readonly counterWindow: NegotiationWindow;
  readonly counterStressProjection: ReturnType<typeof createChatOfferStressProjection>;
  readonly reasons: readonly OfferCounterReason[];
}

export interface OfferCounterRoomLedger {
  readonly roomId: ChatRoomId;
  readonly evaluations: readonly OfferCounterEngineEvaluation[];
  readonly lastUpdatedAt?: UnixMs;
}

interface OfferCounterInternalState {
  readonly roomId: ChatRoomId;
  readonly evaluations: OfferCounterEngineEvaluation[];
  readonly lastUpdatedAt?: UnixMs;
}

// ============================================================================
// MARK: Logger / clock defaults
// ============================================================================

const DEFAULT_CLOCK: OfferCounterEngineClock = {
  now: () => Date.now(),
};

const DEFAULT_LOGGER: OfferCounterEngineLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
};

// ============================================================================
// MARK: Engine implementation
// ============================================================================

export class OfferCounterEngine {
  private readonly clock: OfferCounterEngineClock;
  private readonly logger: OfferCounterEngineLogger;
  private readonly defaultCounterWindowMs: number;
  private readonly minCounterWindowMs: number;
  private readonly maxCounterWindowMs: number;
  private readonly retainEvaluationsPerRoom: number;
  private readonly helperAssistThreshold01: number;
  private readonly rescueThreshold01: number;
  private readonly leakThreshold01: number;
  private readonly volatilityThreshold01: number;
  private readonly state = new Map<string, OfferCounterInternalState>();

  constructor(options: OfferCounterEngineOptions = {}) {
    this.clock = options.clock ?? DEFAULT_CLOCK;
    this.logger = options.logger ?? DEFAULT_LOGGER;
    this.defaultCounterWindowMs = clampInt(options.defaultCounterWindowMs ?? 45_000, 5_000, 180_000);
    this.minCounterWindowMs = clampInt(options.minCounterWindowMs ?? 10_000, 3_000, 180_000);
    this.maxCounterWindowMs = clampInt(options.maxCounterWindowMs ?? 120_000, this.minCounterWindowMs, 300_000);
    this.retainEvaluationsPerRoom = clampInt(options.retainEvaluationsPerRoom ?? 300, 50, 5_000);
    this.helperAssistThreshold01 = clamp01(options.helperAssistThreshold01 ?? 0.66);
    this.rescueThreshold01 = clamp01(options.rescueThreshold01 ?? 0.72);
    this.leakThreshold01 = clamp01(options.leakThreshold01 ?? 0.61);
    this.volatilityThreshold01 = clamp01(options.volatilityThreshold01 ?? 0.58);
  }

  evaluate(request: OfferCounterEvaluationRequest): OfferCounterEngineEvaluation {
    const now = asOfferUnixMs(Number(request.now ?? asUnixMs(this.clock.now())));
    const priorOffer = request.priorOffer ?? derivePriorOfferFromNegotiation(request.negotiation, request.incomingOffer);
    const actorLens = deriveActorLens(request.negotiation, request.incomingOffer);
    const inferenceSummary = deriveInferenceSummary(request.negotiation.latestInference);
    const leakProfile = deriveLeakProfile(request.negotiation);
    const resolutionProfile = deriveResolutionProfile(request.negotiation.latestResolution);
    const windowDiagnostics = deriveWindowDiagnostics(
      request.incomingOffer.window,
      request.negotiation.activeWindow,
      now,
      negotiationLatestOfferId(request.negotiation),
    );

    const softness01 = asScore0To1(chatOfferProjectedSoftness(request.incomingOffer));
    const baselineBand = chatOfferProjectedOutcomeBand(request.incomingOffer);
    const statusPressure = statusVolatilityModifier(request.negotiation.status);

    const fairness01 = asScore0To1(
      clamp01(
        scoreFairness(request.incomingOffer, priorOffer, request.negotiation) +
          Number(actorLens.honestyGap01) * 0.05 +
          Number(softness01) * 0.05 -
          statusPressure * 0.04 -
          Number(inferenceSummary.confidenceBand.normalized) * 0.03,
      ),
    );

    const aggression01 = asScore0To1(
      clamp01(
        scoreAggression(request.incomingOffer, request.negotiation) +
          Number(actorLens.offeredByState?.aggression ?? 0) * 0.06 +
          signalPressureWeight(inferenceSummary.strongestSignals, ['THREAT', 'ULTIMATUM', 'FACE_THREAT']) * 0.1 +
          statusPressure * 0.03,
      ),
    );

    const urgency01 = asScore0To1(
      clamp01(
        scoreUrgency(request.incomingOffer, request.negotiation, now) +
          (windowDiagnostics.offerWindowExpired ? 0.16 : 0) +
          (windowDiagnostics.activeWindowExpired ? 0.18 : 0) +
          (windowDiagnostics.activeWindowGrace ? 0.08 : 0) +
          Number(actorLens.offeredByState?.urgencySignal ?? 0) * 0.08,
      ),
    );

    const desperation01 = asScore0To1(
      clamp01(
        scoreDesperation(request.incomingOffer, request.negotiation) +
          Number(actorLens.offeredByState?.emotion.desperation ?? 0) * 0.09 +
          (resolutionProfile.recentOutcome === 'COLLAPSED' ? 0.08 : 0) +
          signalPressureWeight(inferenceSummary.strongestSignals, ['RESCUE_PRESSURE', 'WALK_AWAY', 'EMBARRASSMENT']) * 0.08,
      ),
    );

    const trust01 = asScore0To1(
      clamp01(
        scoreTrust(request.incomingOffer, request.negotiation) +
          Number(actorLens.offeredByState?.honestySignal ?? 0) * 0.08 -
          Number(leakProfile.peakSeverity01) * 0.05 -
          (resolutionProfile.leakOccurred ? 0.05 : 0),
      ),
    );

    const leakRisk01 = asScore0To1(
      clamp01(
        scoreLeakRisk(request.incomingOffer, request.negotiation) +
          Number(leakProfile.peakSeverity01) * 0.18 +
          Number(leakProfile.predictedWitnessHeat01) * 0.12 +
          signalPressureWeight(inferenceSummary.strongestSignals, ['LEAK', 'WITNESS', 'EXPOSURE']) * 0.1,
      ),
    );

    const rescueNeed01 = asScore0To1(
      clamp01(
        scoreRescueNeed(request.incomingOffer, request.negotiation, desperation01, leakRisk01) +
          Number(actorLens.offeredByState?.walkAwayLikelihood ?? 0) * 0.08 +
          signalPressureWeight(inferenceSummary.strongestSignals, ['HELPER', 'RESCUE_PRESSURE', 'COLLAPSE']) * 0.1 +
          (resolutionProfile.rescueOccurred ? 0.06 : 0),
      ),
    );

    const rejectionRisk01 = asScore0To1(
      clamp01(scoreRejectionRisk(fairness01, aggression01, trust01) + Number(actorLens.leverageGap01) * 0.08),
    );

    const stallRisk01 = asScore0To1(
      clamp01(
        scoreStallRisk(urgency01, aggression01, request.incomingOffer) +
          Number(actorLens.patienceGap01) * 0.09 +
          (windowDiagnostics.activeWindowGrace ? 0.06 : 0),
      ),
    );

    const counterDistance01 = asScore0To1(
      clamp01(
        scoreCounterDistance(request.incomingOffer, priorOffer, request.negotiation) +
          Math.abs(actorLens.reputationGap) / 200 +
          signalPressureWeight(inferenceSummary.strongestSignals, ['PRICE', 'VALUE', 'ANCHOR']) * 0.05,
      ),
    );

    const scoreCard = createEvaluationScoreCard({
      fairness01,
      trust01,
      aggression01,
      urgency01,
      leakRisk01,
      rescueNeed01,
      rejectionRisk01,
      stallRisk01,
    });

    const projectedProbabilities = createProjectedProbabilities({
      fairness01,
      aggression01,
      trust01,
      softness01,
      leakRisk01,
      rescueNeed01,
      rejectionRisk01,
      stallRisk01,
      counterDistance01,
    });

    const reasons = buildReasons({
      now,
      negotiation: request.negotiation,
      incomingOffer: request.incomingOffer,
      priorOffer,
      fairness01,
      aggression01,
      urgency01,
      desperation01,
      trust01,
      softness01,
      leakRisk01,
      rescueNeed01,
      rejectionRisk01,
      stallRisk01,
      counterDistance01,
      actorLens,
      inferenceSummary,
      leakProfile,
      resolutionProfile,
      windowDiagnostics,
      baselineBand,
    });

    const projectedOutcome = chooseProjectedOutcome({
      fairness01,
      aggression01,
      urgency01,
      desperation01,
      trust01,
      leakRisk01,
      rescueNeed01,
      rejectionRisk01,
      stallRisk01,
      counterDistance01,
    });

    const projectedBand = reconcileProjectedBand(
      baselineBand,
      chooseProjectedBand({
        leakRisk01,
        rescueNeed01,
        rejectionRisk01,
        stallRisk01,
        aggression01,
        volatilityThreshold01: this.volatilityThreshold01 + statusPressure * 0.1,
      }),
      request.negotiation.status,
      windowDiagnostics,
      leakProfile,
    );

    const helperReviewSuggested =
      Number(rescueNeed01) >= this.helperAssistThreshold01 ||
      Number(rescueNeed01) >= this.rescueThreshold01 ||
      Number(leakRisk01) >= this.leakThreshold01 ||
      chatOfferShouldTriggerHelperReview(request.incomingOffer) ||
      resolutionProfile.leakOccurred ||
      (request.negotiation.status === 'SOFT_LOCKED' || request.negotiation.status === 'HARD_LOCKED');

    const recommendedStrategy = chooseCounterStrategy({
      projectedOutcome,
      projectedBand,
      helperReviewSuggested,
      leakRisk01,
      rescueNeed01,
      aggression01,
      trust01,
      fairness01,
    });

    const evaluation: OfferCounterEngineEvaluation = {
      evaluationId: `offer-counter:${String(request.roomId)}:${String(request.incomingOffer.offerId)}:${Number(now)}`,
      roomId: request.roomId,
      negotiationId: String(request.negotiation.negotiationId),
      offerId: String(request.incomingOffer.offerId),
      evaluatedAt: now,
      fairness01,
      aggression01,
      urgency01,
      desperation01,
      trust01,
      softness01,
      leakRisk01,
      rescueNeed01,
      rejectionRisk01,
      stallRisk01,
      counterDistance01,
      scoreCard,
      projectedProbabilities,
      projectedOutcome,
      baselineBand,
      projectedBand,
      helperReviewSuggested,
      actorLens,
      inferenceSummary,
      leakProfile,
      resolutionProfile,
      windowDiagnostics,
      pressureSummary: buildPressureSummary(request.negotiation),
      reasons,
      recommendedStrategy,
      debug: {
        traceLabel: request.traceLabel ?? null,
        priorOfferId: priorOffer ? String(priorOffer.offerId) : null,
        latestOfferId: windowDiagnostics.latestOfferId ?? null,
        activeWindowId: windowDiagnostics.activeWindowId ?? null,
        negotiationStatus: request.negotiation.status,
        negotiationPhase: request.negotiation.phase,
        dominantPressure: negotiationInferDominantPressure(request.negotiation.latestInference) ?? null,
        actorLens: {
          reputationGap: actorLens.reputationGap,
          leverageGap01: Number(actorLens.leverageGap01),
          patienceGap01: Number(actorLens.patienceGap01),
          honestyGap01: Number(actorLens.honestyGap01),
        },
        inferenceSummary: {
          signalCount: inferenceSummary.signalCount,
          bluffSignals: inferenceSummary.bluffSignals,
          rescueSignals: inferenceSummary.rescueSignals,
          pressureSignals: inferenceSummary.pressureSignals,
          confidence: Number(inferenceSummary.confidenceBand.normalized),
        },
        projectedProbabilities: {
          accepted: Number(projectedProbabilities.accepted),
          counter: Number(projectedProbabilities.counter),
          reject: Number(projectedProbabilities.reject),
          leak: Number(projectedProbabilities.leak),
          rescue: Number(projectedProbabilities.rescue),
        },
      },
    };

    this.recordEvaluation(evaluation);
    this.logger.debug('offer-counter:evaluated', {
      roomId: String(request.roomId),
      negotiationId: String(request.negotiation.negotiationId),
      offerId: String(request.incomingOffer.offerId),
      projectedOutcome,
      projectedBand,
      strategy: recommendedStrategy,
      fairness100: Number(scoreCard.fairness100),
      trust100: Number(scoreCard.trust100),
    });
    return evaluation;
  }

  buildCounter(request: OfferCounterBuildRequest): OfferCounterBuildResult {
    const evaluation = this.evaluate({
      roomId: request.roomId,
      negotiation: request.negotiation,
      incomingOffer: request.incomingOffer,
      priorOffer: request.priorOffer,
      now: request.now,
      traceLabel: 'buildCounter',
    });

    const now = Number(request.now ?? this.clock.now());
    const priorOffer = request.priorOffer ?? derivePriorOfferFromNegotiation(request.negotiation, request.incomingOffer);
    const strategy = evaluation.recommendedStrategy;
    const counterStatus: ChatOfferStatus = deriveCounterStatus(strategy, evaluation, request.negotiation.status);
    const counterPrice = deriveCounterPrice(request.incomingOffer, priorOffer, request.negotiation, evaluation, strategy);
    const counterWindow = deriveCounterWindow(
      request.incomingOffer,
      request.negotiation,
      evaluation,
      now,
      this.defaultCounterWindowMs,
      this.minCounterWindowMs,
      this.maxCounterWindowMs,
    );
    const counterAnalytics = deriveCounterAnalytics(evaluation, strategy, now);
    const counterConcessions = deriveCounterConcessions(request.incomingOffer, strategy, evaluation, now);
    const counterGuarantees = deriveCounterGuarantees(
      request.incomingOffer.currentVersion.guarantees,
      strategy,
      evaluation,
      request.negotiation,
      now,
    );
    const visibility = deriveCounterVisibility(request.incomingOffer.visibility, strategy, evaluation);
    const counterStressProjection = deriveCounterStressProjection(request.incomingOffer, request.negotiation, evaluation);

    const counterDraft: ChatOfferDraft = createCounterDraft({
      incomingOffer: request.incomingOffer,
      negotiation: request.negotiation,
      status: counterStatus,
      strategy,
      price: counterPrice,
      guarantees: counterGuarantees,
      concessions: counterConcessions,
      visibility,
      window: counterWindow,
      analytics: counterAnalytics,
      now,
      note: request.note,
    });

    const version: ChatOfferVersion = createChatOfferVersion(
      inferNextVersionNumber(request.incomingOffer),
      counterDraft.price,
      counterDraft.paymentTerms,
      {
        guarantees: counterDraft.guarantees,
        conditions: request.incomingOffer.currentVersion.conditions,
        concessions: counterDraft.concessions,
        analytics: counterDraft.analytics,
        note: request.note ?? `Counter generated via ${strategy}`,
        createdAt: now,
        versionId: `counter-version:${String(request.incomingOffer.offerId)}:${now}`,
      },
    );

    const counterRead = createCounterReadFromEvaluation(evaluation);

    const counterOffer: ChatOffer = materializeCounterOffer({
      incomingOffer: request.incomingOffer,
      draft: counterDraft,
      version,
      status: counterStatus,
      counterRead,
      now,
      requestedKind: request.requestedKind,
      strategy,
    });

    const counterPatch: ChatOfferPatch = createCounterOfferPatch(counterOffer, version, visibility, counterWindow, counterRead, now);

    const normalizedCurrency = asCurrencyCode(String(counterPrice.currency));
    const negotiationPrice: NegotiationPriceVector = createNegotiationPriceVector(
      Number(counterPrice.amount),
      String(normalizedCurrency),
      {
        listedAmount: asPricePoints(Number(request.incomingOffer.currentVersion.price.amount)),
        floorAmount: counterPrice.marketRange?.min === undefined ? undefined : asPricePoints(Number(counterPrice.marketRange.min)),
        ceilingAmount: counterPrice.marketRange?.max === undefined ? undefined : asPricePoints(Number(counterPrice.marketRange.max)),
        reserveAmount: counterPrice.marketRange?.fairValue === undefined ? undefined : asPricePoints(Number(counterPrice.marketRange.fairValue)),
        confidence: createNegotiationScoreBand(
          Number(evaluation.scoreCard.fairness100),
          Number(evaluation.fairness01),
          'offer-counter:counter-price-confidence',
          now,
          Number(evaluation.scoreCard.fairness100),
        ),
      },
    );

    const counterWindowProjection = createNegotiationWindow(
      strategy === 'STALL' ? 'TIME_PRESSURE' : 'COUNTER_REQUIRED',
      request.negotiation.primaryChannel,
      Number(counterWindow.opensAt),
      Number(counterWindow.closesAt),
      {
        windowId: String(counterWindow.windowId),
        graceUntil: counterWindow.graceUntil === undefined ? undefined : asUnixMs(Number(counterWindow.graceUntil)),
        preferredResponseBand: counterPrice.marketRange
          ? {
              min: Number(counterPrice.marketRange.min),
              max: Number(counterPrice.marketRange.max),
              preferred: counterPrice.marketRange.expected === undefined ? undefined : Number(counterPrice.marketRange.expected),
            }
          : undefined,
        permitsSilence: strategy === 'STALL',
        helperEligibleAt: counterWindow.rescueEligibleAt === undefined ? undefined : asUnixMs(Number(counterWindow.rescueEligibleAt)),
        rescueEligibleAt: counterWindow.rescueEligibleAt === undefined ? undefined : asUnixMs(Number(counterWindow.rescueEligibleAt)),
        leakEligibleAt: counterWindow.leakEligibleAt === undefined ? undefined : asUnixMs(Number(counterWindow.leakEligibleAt)),
      },
    );

    const counterEnvelope: NegotiationOfferEnvelope = {
      negotiationId: request.negotiation.negotiationId,
      sceneId: request.negotiation.scene.sceneId,
      threadId: request.negotiation.threadId,
      offeredBy: toNegotiationActorRef(counterOffer.offeredBy, 'SELLER'),
      offeredTo: toNegotiationActorRef(counterOffer.offeredTo, 'BUYER'),
      vector: {
        offerId: asNegotiationOfferId(String(counterOffer.offerId)),
        label: `Counter ${strategy} • against ${negotiationLatestOfferId(request.negotiation) ?? 'opening-offer'}`,
        price: negotiationPrice,
        valueEstimate: counterPrice.marketRange
          ? {
              min: Number(counterPrice.marketRange.min),
              max: Number(counterPrice.marketRange.max),
              preferred: counterPrice.marketRange.expected === undefined ? undefined : Number(counterPrice.marketRange.expected),
            }
          : undefined,
        riskAdjustmentBps: counterPrice.feeBps,
        urgencyBps: counterPrice.discountBps,
        concessions: toNegotiationConcessions(counterConcessions),
        intent: deriveNegotiationIntent(strategy, evaluation),
        phase: deriveNegotiationPhase(strategy),
        windowId: asNegotiationWindowId(String(counterWindow.windowId)),
      },
      counterShape: {
        isCounter: true,
        referencesOfferId: asNegotiationOfferId(String(request.incomingOffer.offerId)),
        counterDistance: asNegotiationScore0To1(Number(evaluation.counterDistance01)),
        hardReversal: strategy === 'HARD_COUNTER',
        softLanding: strategy === 'SOFT_COUNTER' || strategy === 'STALL',
        faceSaving: strategy === 'STALL' || strategy === 'HELPER_REVIEW' || strategy === 'LEAK_CONTAINMENT',
      },
      channelContext: request.negotiation.scene.channelContext,
      inference: request.negotiation.latestInference,
      createdAt: asUnixMs(now),
    };

    this.logger.info('offer-counter:built', {
      roomId: String(request.roomId),
      negotiationId: String(request.negotiation.negotiationId),
      sourceOfferId: String(request.incomingOffer.offerId),
      counterOfferId: String(counterOffer.offerId),
      strategy,
      counterStatus,
      fairness100: Number(evaluation.scoreCard.fairness100),
      volatility100: Number(evaluation.scoreCard.volatility100),
    });

    return {
      evaluation,
      counterOffer,
      counterDraft,
      counterPatch,
      counterStatus,
      counterVersion: version,
      counterEnvelope,
      counterWindow: counterWindowProjection,
      counterStressProjection,
      reasons: evaluation.reasons,
    };
  }
  getRoomLedger(roomId: ChatRoomId): OfferCounterRoomLedger {
    const state = this.state.get(String(roomId));
    return {
      roomId,
      evaluations: state ? [...state.evaluations] : [],
      lastUpdatedAt: state?.lastUpdatedAt,
    };
  }

  clearRoom(roomId: ChatRoomId): void {
    this.state.delete(String(roomId));
  }

  private recordEvaluation(evaluation: OfferCounterEngineEvaluation): void {
    const key = String(evaluation.roomId);
    const state = this.state.get(key) ?? {
      roomId: evaluation.roomId,
      evaluations: [],
      lastUpdatedAt: evaluation.evaluatedAt,
    };
    state.evaluations.push(evaluation);
    if (state.evaluations.length > this.retainEvaluationsPerRoom) {
      state.evaluations.splice(0, state.evaluations.length - this.retainEvaluationsPerRoom);
    }
    (state as any).lastUpdatedAt = evaluation.evaluatedAt;
    this.state.set(key, state);
  }
}

// ============================================================================
// MARK: Evaluation lenses + build helpers
// ============================================================================

function statusVolatilityModifier(status: NegotiationStatus): number {
  switch (status) {
    case 'HARD_LOCKED':
      return 0.4;
    case 'SOFT_LOCKED':
      return 0.28;
    case 'ACTIVE':
      return 0.16;
    case 'RESOLVED':
      return 0.22;
    case 'FAILED':
    case 'ABANDONED':
    case 'EXPIRED':
    case 'LEAKED':
      return 0.32;
    case 'OPEN':
    default:
      return 0.08;
  }
}

function deriveActorLens(negotiation: ChatNegotiation, incomingOffer: ChatOffer): OfferCounterActorLens {
  const parties: NegotiationPartyPair = negotiation.parties;
  const offeredByState = negotiationPrimaryActorState(negotiation, incomingOffer.offeredBy.actorId as unknown as any);
  const offeredToState = negotiationPrimaryActorState(negotiation, incomingOffer.offeredTo.actorId as unknown as any);

  return {
    parties,
    offeredByState,
    offeredToState,
    leverageGap01: asScore0To1(Math.abs(Number(offeredByState?.leverage ?? 0) - Number(offeredToState?.leverage ?? 0))),
    patienceGap01: asScore0To1(Math.abs(Number(offeredByState?.patience ?? 0) - Number(offeredToState?.patience ?? 0))),
    honestyGap01: asScore0To1(Math.max(0, Number(offeredByState?.honestySignal ?? 0) - Number(offeredToState?.honestySignal ?? 0))),
    reputationGap:
      (offeredByState?.reputation.current === undefined ? 0 : Number(offeredByState.reputation.current)) -
      (offeredToState?.reputation.current === undefined ? 0 : Number(offeredToState.reputation.current)),
  };
}

function deriveInferenceSummary(inference?: NegotiationInferenceFrame): OfferCounterInferenceSummary {
  const strongestSignals = [...(inference?.signals ?? [])]
    .sort((a, b) => Number(b.score.normalized) - Number(a.score.normalized))
    .slice(0, 5);
  const bluffSignals = strongestSignals.filter((signal) => hasSignalTag(signal, ['BLUFF', 'THREAT', 'FAKEOUT'])).length;
  const rescueSignals = strongestSignals.filter((signal) => hasSignalTag(signal, ['HELPER', 'RESCUE', 'COLLAPSE'])).length;
  const pressureSignals = strongestSignals.filter((signal) => hasSignalTag(signal, ['PRICE', 'VALUE', 'ANCHOR', 'TIME'])).length;
  const normalized = strongestSignals.length === 0
    ? 0.2
    : strongestSignals.reduce((sum, signal) => sum + Number(signal.confidence.normalized), 0) / strongestSignals.length;

  return {
    inference,
    signalCount: inference?.signals.length ?? 0,
    bluffSignals,
    rescueSignals,
    pressureSignals,
    strongestSignals,
    confidenceBand: createNegotiationScoreBand(
      strongestSignals.length,
      normalized,
      'offer-counter:inference-confidence',
      Date.now(),
      normalized * 100,
    ),
  };
}

function deriveLeakProfile(negotiation: ChatNegotiation): OfferCounterLeakProfile {
  const threats: readonly NegotiationLeakThreat[] = negotiation.leakThreats ?? [];
  const peakSeverity = threats.length === 0
    ? 0
    : Math.max(...threats.map((threat) => Number(threat.severity.normalized)));
  const predictedWitnessHeat = threats.length === 0
    ? 0
    : threats.reduce((sum, threat) => sum + Number(threat.predictedWitnessHeat), 0) / threats.length;

  return {
    threats,
    peakSeverity01: asScore0To1(peakSeverity),
    predictedWitnessHeat01: asScore0To1(predictedWitnessHeat),
    containableCount: threats.filter((threat) => threat.canBeContained).length,
  };
}

function deriveResolutionProfile(resolution?: NegotiationResolution): OfferCounterResolutionProfile {
  return {
    resolution,
    recentOutcome: resolution?.outcome,
    leakOccurred: Boolean(resolution?.leakOccurred),
    rescueOccurred: Boolean(resolution?.rescueOccurred),
    winningActorId: resolution?.winningActorId === undefined ? undefined : String(resolution.winningActorId),
  };
}

function deriveWindowDiagnostics(
  offerWindow: ChatOfferWindow | undefined,
  activeWindow: NegotiationWindow | undefined,
  now: UnixMs,
  latestOfferId?: string,
): OfferCounterWindowDiagnostics {
  return {
    offerWindowExpired: Boolean(offerWindow && Number(now) > Number(offerWindow.closesAt)),
    activeWindowExpired: Boolean(activeWindow && negotiationWindowHasExpired(activeWindow, asUnixMs(Number(now)))),
    activeWindowGrace: Boolean(activeWindow && negotiationWindowIsInGrace(activeWindow, asUnixMs(Number(now)))),
    activeWindowId: activeWindow ? String(activeWindow.windowId) : undefined,
    latestOfferId,
  };
}

function createEvaluationScoreCard(input: {
  fairness01: Score0To1;
  trust01: Score0To1;
  aggression01: Score0To1;
  urgency01: Score0To1;
  leakRisk01: Score0To1;
  rescueNeed01: Score0To1;
  rejectionRisk01: Score0To1;
  stallRisk01: Score0To1;
}): OfferCounterScoreCard {
  return {
    fairness100: asScore0To100(Number(input.fairness01) * 100),
    trust100: asScore0To100(Number(input.trust01) * 100),
    pressure100: asScore0To100(
      clamp01(
        Number(input.urgency01) * 0.35 +
          Number(input.leakRisk01) * 0.25 +
          Number(input.rescueNeed01) * 0.2 +
          Number(input.aggression01) * 0.2,
      ) * 100,
    ),
    volatility100: asScore0To100(
      clamp01(
        Number(input.rejectionRisk01) * 0.4 +
          Number(input.stallRisk01) * 0.25 +
          Number(input.leakRisk01) * 0.2 +
          Number(input.aggression01) * 0.15,
      ) * 100,
    ),
  };
}

function createProjectedProbabilities(input: {
  fairness01: Score0To1;
  aggression01: Score0To1;
  trust01: Score0To1;
  softness01: Score0To1;
  leakRisk01: Score0To1;
  rescueNeed01: Score0To1;
  rejectionRisk01: Score0To1;
  stallRisk01: Score0To1;
  counterDistance01: Score0To1;
}): OfferCounterProbabilityVector {
  const accepted: Probability = asProbability(
    clamp01(Number(input.fairness01) * 0.33 + Number(input.trust01) * 0.27 + Number(input.softness01) * 0.16 + (1 - Number(input.counterDistance01)) * 0.24),
  );
  const counter: Probability = asProbability(
    clamp01((1 - Number(accepted)) * 0.45 + Number(input.counterDistance01) * 0.35 + Number(input.stallRisk01) * 0.2),
  );
  const reject: Probability = asProbability(clamp01(Number(input.rejectionRisk01) * 0.72 + Number(input.aggression01) * 0.18));
  const leak: Probability = asProbability(clamp01(Number(input.leakRisk01) * 0.86 + Number(input.aggression01) * 0.08));
  const rescue: Probability = asProbability(clamp01(Number(input.rescueNeed01) * 0.83 + Number(input.stallRisk01) * 0.07));
  return { accepted, counter, reject, leak, rescue };
}

function reconcileProjectedBand(
  baselineBand: 'SAFE' | 'RISKY' | 'VOLATILE' | 'COLLAPSE',
  computedBand: 'SAFE' | 'RISKY' | 'VOLATILE' | 'COLLAPSE',
  status: NegotiationStatus,
  diagnostics: OfferCounterWindowDiagnostics,
  leakProfile: OfferCounterLeakProfile,
): 'SAFE' | 'RISKY' | 'VOLATILE' | 'COLLAPSE' {
  const order = ['SAFE', 'RISKY', 'VOLATILE', 'COLLAPSE'] as const;
  let idx = Math.max(order.indexOf(baselineBand), order.indexOf(computedBand));
  if (status === 'HARD_LOCKED' || diagnostics.activeWindowExpired || Number(leakProfile.peakSeverity01) >= 0.85) {
    idx = Math.max(idx, order.indexOf('COLLAPSE'));
  } else if (status === 'SOFT_LOCKED' || diagnostics.activeWindowGrace) {
    idx = Math.max(idx, order.indexOf('VOLATILE'));
  }
  return order[idx];
}

function signalPressureWeight(
  signals: readonly NegotiationSignalEvidence[],
  tags: readonly string[],
): number {
  const matches = signals.filter((signal) => hasSignalTag(signal, tags));
  if (matches.length === 0) {
    return 0;
  }
  return clamp01(matches.reduce((sum, signal) => sum + Number(signal.score.normalized), 0) / matches.length);
}

function hasSignalTag(signal: NegotiationSignalEvidence, tags: readonly string[]): boolean {
  const haystack = [signal.kind, ...(signal.tags ?? [])].map((value) => String(value).toUpperCase());
  return tags.some((tag) => haystack.some((candidate) => candidate.includes(tag)));
}

function deriveCounterStatus(
  strategy: CounterStrategy,
  evaluation: OfferCounterEngineEvaluation,
  negotiationStatus: NegotiationStatus,
): ChatOfferStatus {
  if (strategy === 'LEAK_CONTAINMENT') return 'UNDER_REVIEW';
  if (strategy === 'WITHDRAW') return 'WITHDRAWN';
  if (strategy === 'HELPER_REVIEW') return 'UNDER_REVIEW';
  if (negotiationStatus === 'HARD_LOCKED') return 'UNDER_REVIEW';
  if (evaluation.windowDiagnostics.offerWindowExpired || evaluation.windowDiagnostics.activeWindowExpired) return 'EXPIRED';
  return 'POSTED';
}

function deriveCounterGuarantees(
  guarantees: readonly ChatOfferGuarantee[] | undefined,
  strategy: CounterStrategy,
  evaluation: OfferCounterEngineEvaluation,
  negotiation: ChatNegotiation,
  now: number,
): readonly ChatOfferGuarantee[] | undefined {
  if (!guarantees || guarantees.length === 0) {
    if (strategy === 'HELPER_REVIEW' || strategy === 'RESCUE_ESCALATE') {
      return [
        {
          type: 'ESCALATION_RIGHT',
          strength: createChatOfferScore(0.72, 0.72, 'offer-counter:synthetic-escalation-right', now, 72),
          describedAs: 'Counter auto-attaches an escalation right to preserve trust under pressure.',
        },
      ];
    }
    return undefined;
  }

  return guarantees.map((guarantee, index) => ({
    ...guarantee,
    strength: createChatOfferScore(
      guarantee.strength.raw,
      clamp01(Number(guarantee.strength.normalized) + guaranteeStrategyLift(strategy) + Number(evaluation.trust01) * 0.04 - statusVolatilityModifier(negotiation.status) * 0.03),
      `offer-counter:guarantee:${index}:${strategy}`,
      now,
      clamp01(Number(guarantee.strength.normalized) + guaranteeStrategyLift(strategy)) * 100,
    ),
  }));
}

function guaranteeStrategyLift(strategy: CounterStrategy): number {
  switch (strategy) {
    case 'SOFT_COUNTER':
      return 0.06;
    case 'HELPER_REVIEW':
    case 'RESCUE_ESCALATE':
      return 0.1;
    case 'LEAK_CONTAINMENT':
      return 0.08;
    default:
      return 0;
  }
}

function createCounterDraft(input: {
  incomingOffer: ChatOffer;
  negotiation: ChatNegotiation;
  status: ChatOfferStatus;
  strategy: CounterStrategy;
  price: ChatOfferPrice;
  guarantees?: readonly ChatOfferGuarantee[];
  concessions?: readonly ChatOfferConcession[];
  visibility: ChatOfferVisibilityEnvelope;
  window?: ChatOfferWindow;
  analytics: ChatOfferAnalytics;
  now: number;
  note?: string;
}): ChatOfferDraft {
  return {
    kind: deriveCounterKind(input.strategy),
    status: input.status === 'UNDER_REVIEW' ? 'STAGED' : 'DRAFT',
    threadId: input.incomingOffer.threadId,
    roomId: input.incomingOffer.roomId,
    sceneId: input.incomingOffer.sceneId,
    offeredBy: input.incomingOffer.offeredTo,
    offeredTo: input.incomingOffer.offeredBy,
    price: input.price,
    paymentTerms: input.incomingOffer.currentVersion.paymentTerms,
    guarantees: input.guarantees,
    conditions: input.incomingOffer.currentVersion.conditions,
    concessions: input.concessions,
    visibility: input.visibility,
    window: input.window,
    analytics: input.analytics,
    memoryHooks: input.incomingOffer.currentVersion.note
      ? [{
          anchorId: `counter-anchor:${String(input.incomingOffer.offerId)}:${input.now}` as any,
          kind: 'PAST_COUNTER',
          salience: asScore0To1(Math.max(0.4, Number(input.analytics.fairness.normalized))),
          note: input.note ?? `Counter generated from ${String(input.incomingOffer.offerId)} under ${input.strategy}.`,
        }]
      : undefined,
    createdAt: asOfferUnixMs(input.now),
  };
}

function materializeCounterOffer(input: {
  incomingOffer: ChatOffer;
  draft: ChatOfferDraft;
  version: ChatOfferVersion;
  status: ChatOfferStatus;
  counterRead: ChatOfferCounterRead;
  now: number;
  requestedKind?: ChatOfferKind;
  strategy: CounterStrategy;
}): ChatOffer {
  return {
    offerId: asChatOfferId(`counter:${String(input.incomingOffer.offerId)}:${input.now}`),
    threadId: input.draft.threadId,
    roomId: input.draft.roomId,
    runId: input.incomingOffer.runId,
    sourceMessageId: input.incomingOffer.sourceMessageId,
    sceneId: input.draft.sceneId,
    kind: input.requestedKind ?? input.draft.kind,
    status: input.status,
    offeredBy: input.draft.offeredBy,
    offeredTo: input.draft.offeredTo,
    currentVersion: input.version,
    priorVersions: [
      ...(input.incomingOffer.priorVersions ?? []),
      input.incomingOffer.currentVersion,
    ],
    visibility: input.draft.visibility,
    window: input.draft.window,
    counterRead: input.counterRead,
    proof: input.incomingOffer.proof,
    createdAt: asOfferUnixMs(input.now),
    updatedAt: asOfferUnixMs(input.now),
  };
}

function createCounterOfferPatch(
  counterOffer: ChatOffer,
  version: ChatOfferVersion,
  visibility: ChatOfferVisibilityEnvelope,
  window: ChatOfferWindow | undefined,
  counterRead: ChatOfferCounterRead,
  now: number,
): ChatOfferPatch {
  return {
    offerId: counterOffer.offerId,
    status: counterOffer.status,
    currentVersion: version,
    appendedVersions: [version],
    visibility,
    window: window ?? null,
    counterRead,
    proof: counterOffer.proof ?? null,
    updatedAt: asOfferUnixMs(now),
  };
}

function deriveCounterStressProjection(
  incomingOffer: ChatOffer,
  negotiation: ChatNegotiation,
  evaluation: OfferCounterEngineEvaluation,
) {
  const hostility = Number(chatOfferProjectedHostility(incomingOffer));
  return createChatOfferStressProjection(
    clamp01(Number(evaluation.rejectionRisk01) * 0.7 + hostility * 0.15),
    clamp01(Number(evaluation.aggression01) * 0.45 + Math.max(0, -evaluation.actorLens.reputationGap) / 150),
    clamp01(Number(evaluation.rescueNeed01) * 0.75 + (negotiationSupportsRescue(negotiation) ? 0.1 : 0)),
    clamp01(Number(evaluation.leakRisk01) * 0.6 + Number(incomingOffer.visibility.audienceHeat ?? 0) * 0.2),
    clamp01(Number(evaluation.aggression01) * 0.5 + Number(evaluation.urgency01) * 0.2),
    clamp01(Number(evaluation.leakRisk01) * 0.68 + Number(incomingOffer.visibility.secrecyPressure ?? 0) * 0.16),
  );
}

function inferNextVersionNumber(offer: ChatOffer): number {
  return (offer.priorVersions?.length ?? 0) + 2;
}

// ============================================================================
// MARK: Primary scorers
// ============================================================================

function scoreFairness(incomingOffer: ChatOffer, priorOffer: ChatOffer | null | undefined, negotiation: ChatNegotiation): number {
  const price = Number(incomingOffer.currentVersion.price.amount);
  const marketExpected = Number(incomingOffer.currentVersion.price.marketRange?.expected ?? incomingOffer.currentVersion.price.marketRange?.fairValue ?? price);
  const marketMin = Number(incomingOffer.currentVersion.price.marketRange?.min ?? marketExpected);
  const marketMax = Number(incomingOffer.currentVersion.price.marketRange?.max ?? marketExpected);

  let score = 0.5;

  if (chatOfferPriceWithinRange(incomingOffer, marketMin, marketMax)) {
    score += 0.14;
  }

  if (marketMax > marketMin) {
    const center = marketExpected || (marketMin + marketMax) / 2;
    const deviation = Math.abs(price - center) / Math.max(1, marketMax - marketMin);
    score += 0.22 * (1 - clamp01(deviation));
  }

  if (priorOffer) {
    const delta = Math.abs(chatOfferPriceDeltaFromPrior({ ...incomingOffer, priorVersions: [priorOffer.currentVersion] }) ?? 0);
    const relative = delta / Math.max(1, Number(priorOffer.currentVersion.price.amount));
    score -= 0.18 * clamp01(relative * 2);
  }

  if (negotiationHasAudiencePressure(negotiation)) {
    score -= 0.03;
  }

  if (chatOfferHasGuarantee(incomingOffer)) {
    score += 0.08 * clamp01(chatOfferGuaranteeStrength(incomingOffer));
  }

  if (chatOfferHasConditions(incomingOffer)) {
    score -= 0.04 * clamp01(chatOfferConditionCount(incomingOffer) / 6);
  }

  return clamp01(score);
}

function scoreAggression(incomingOffer: ChatOffer, negotiation: ChatNegotiation): number {
  let score: number = clamp01(chatOfferProjectedHostility(incomingOffer));

  if (incomingOffer.visibility.revealMode === 'TRAP' || incomingOffer.visibility.revealMode === 'FAKEOUT') {
    score += 0.12;
  }

  if (incomingOffer.kind === 'TAKE_IT_OR_LEAVE_IT' || incomingOffer.kind === 'LIQUIDATION') {
    score += 0.15;
  }

  if (incomingOffer.visibility.visibility === 'PUBLIC' || incomingOffer.visibility.visibility === 'DEAL_ROOM_PLUS_WITNESSES') {
    score += 0.05;
  }

  if (negotiationHasLeakThreat(negotiation)) {
    score += 0.04;
  }

  return clamp01(score);
}

function scoreUrgency(incomingOffer: ChatOffer, negotiation: ChatNegotiation, now: UnixMs): number {
  let score: number = clamp01(Number(incomingOffer.currentVersion.analytics?.urgency.normalized ?? 0.35));

  if (incomingOffer.window) {
    const span = Math.max(1, Number(incomingOffer.window.closesAt) - Number(incomingOffer.window.opensAt));
    const remaining = Math.max(0, Number(incomingOffer.window.closesAt) - Number(now));
    const pressure = 1 - remaining / span;
    score += 0.4 * clamp01(pressure);

    if (incomingOffer.window.readPreferredBy !== undefined && Number(now) > Number(incomingOffer.window.readPreferredBy)) {
      score += 0.08;
    }
  }

  const dominant = negotiationInferDominantPressure(negotiation.latestInference);
  if (dominant === 'TIME') {
    score += 0.1;
  }
  if (dominant === 'RESCUE') {
    score += 0.05;
  }

  return clamp01(score);
}

function scoreDesperation(incomingOffer: ChatOffer, negotiation: ChatNegotiation): number {
  let score: number = clamp01(Number(incomingOffer.currentVersion.analytics?.desperation ?? 0.25));
  if (incomingOffer.kind === 'LIQUIDATION' || incomingOffer.kind === 'RESCUE_OVERRIDE') {
    score += 0.22;
  }
  if (negotiationSupportsRescue(negotiation)) {
    score += 0.05;
  }
  if (chatOfferHasConcessions(incomingOffer)) {
    score += 0.08 * clamp01(chatOfferConcessionCount(incomingOffer) / 5);
  }
  return clamp01(score);
}

function scoreTrust(incomingOffer: ChatOffer, negotiation: ChatNegotiation): number {
  let score: number = clamp01(chatOfferProjectedTrustworthiness(incomingOffer));
  if (chatOfferHasGuarantee(incomingOffer)) {
    score += 0.12 * clamp01(chatOfferGuaranteeStrength(incomingOffer));
  }
  if (incomingOffer.visibility.visibility === 'PRIVATE' || incomingOffer.visibility.visibility === 'DEAL_ROOM_ONLY') {
    score += 0.03;
  }
  if (negotiationHasLeakThreat(negotiation)) {
    score -= 0.08;
  }
  return clamp01(score);
}

function scoreLeakRisk(incomingOffer: ChatOffer, negotiation: ChatNegotiation): number {
  let score = 0;
  score += chatOfferCanLeak(incomingOffer) ? 0.25 : 0.06;
  score += Number(incomingOffer.visibility.audienceHeat ?? 0) * 0.18;
  score += Number(incomingOffer.visibility.secrecyPressure ?? 0) * 0.25;
  if (incomingOffer.visibility.visibility === 'PUBLIC' || incomingOffer.visibility.visibility === 'DEAL_ROOM_PLUS_WITNESSES') {
    score += 0.2;
  }
  if (negotiationHasLeakThreat(negotiation)) {
    score += 0.18;
  }
  if (incomingOffer.kind === 'BLUFF') {
    score += 0.08;
  }
  return clamp01(score);
}

function scoreRescueNeed(
  incomingOffer: ChatOffer,
  negotiation: ChatNegotiation,
  desperation01: Score0To1,
  leakRisk01: Score0To1,
): number {
  let score = 0;
  score += Number(desperation01) * 0.4;
  score += Number(leakRisk01) * 0.22;
  score += Number(incomingOffer.counterRead?.rescueNeed ?? 0) * 0.2;
  if (chatOfferSupportsRescue(incomingOffer)) {
    score += 0.08;
  }
  if (negotiationSupportsRescue(negotiation)) {
    score += 0.07;
  }
  return clamp01(score);
}

function scoreRejectionRisk(fairness01: Score0To1, aggression01: Score0To1, trust01: Score0To1): number {
  const score = 0.48 * (1 - Number(fairness01)) + 0.34 * Number(aggression01) + 0.18 * (1 - Number(trust01));
  return clamp01(score);
}

function scoreStallRisk(urgency01: Score0To1, aggression01: Score0To1, incomingOffer: ChatOffer): number {
  let score = 0.2 + Number(aggression01) * 0.2;
  score += (1 - Number(urgency01)) * 0.3;
  if (incomingOffer.visibility.revealMode === 'STAGED' || incomingOffer.visibility.revealMode === 'DELAYED_FULL') {
    score += 0.15;
  }
  return clamp01(score);
}

function scoreCounterDistance(incomingOffer: ChatOffer, priorOffer: ChatOffer | null | undefined, negotiation: ChatNegotiation): number {
  if (!priorOffer) {
    return 0.45;
  }
  const delta = Math.abs(Number(incomingOffer.currentVersion.price.amount) - Number(priorOffer.currentVersion.price.amount));
  const relative = delta / Math.max(1, Number(priorOffer.currentVersion.price.amount));
  let score: number = clamp01(relative);
  if (negotiation.phase === 'COUNTER' || negotiation.phase === 'PRESSURE') {
    score += 0.08;
  }
  if (incomingOffer.kind === 'COUNTER') {
    score += 0.04;
  }
  return clamp01(score);
}

// ============================================================================
// MARK: Reasons + projection helpers
// ============================================================================

function buildReasons(input: {
  now: UnixMs;
  negotiation: ChatNegotiation;
  incomingOffer: ChatOffer;
  priorOffer?: ChatOffer | null;
  fairness01: Score0To1;
  aggression01: Score0To1;
  urgency01: Score0To1;
  desperation01: Score0To1;
  trust01: Score0To1;
  softness01: Score0To1;
  leakRisk01: Score0To1;
  rescueNeed01: Score0To1;
  rejectionRisk01: Score0To1;
  stallRisk01: Score0To1;
  counterDistance01: Score0To1;
  actorLens: OfferCounterActorLens;
  inferenceSummary: OfferCounterInferenceSummary;
  leakProfile: OfferCounterLeakProfile;
  resolutionProfile: OfferCounterResolutionProfile;
  windowDiagnostics: OfferCounterWindowDiagnostics;
  baselineBand: 'SAFE' | 'RISKY' | 'VOLATILE' | 'COLLAPSE';
}): OfferCounterReason[] {
  const reasons: OfferCounterReason[] = [];
  const { incomingOffer, priorOffer, negotiation, now } = input;

  if (!priorOffer) {
    reasons.push({ code: 'NO_PRIOR_OFFER', weight: 0.2, detail: 'No prior offer exists, so counter distance is inferred from market range.' });
  } else {
    const delta = chatOfferPriceDeltaFromPrior({ ...incomingOffer, priorVersions: [priorOffer.currentVersion] });
    if (delta !== undefined && delta > 0) {
      reasons.push({ code: 'PAST_COUNTER_DELTA', weight: clamp01(delta / Math.max(1, Number(priorOffer.currentVersion.price.amount))), detail: `Offer price moved by ${delta} from prior anchor.` });
    }
  }

  if (Number(input.fairness01) < 0.45) {
    reasons.push({ code: 'PRICE_OVER_FAIR_VALUE', weight: 1 - Number(input.fairness01), detail: 'Offer fairness fell below safe band.' });
  }
  if (Number(input.fairness01) > 0.68) {
    reasons.push({ code: 'PRICE_UNDER_FAIR_VALUE', weight: Number(input.fairness01) - 0.68, detail: 'Offer may be generous or strategically soft.' });
  }
  if (Number(input.softness01) > 0.55) {
    reasons.push({ code: 'SOFTNESS_SIGNAL', weight: Number(input.softness01), detail: 'Softness profile indicates room for a relationship-preserving counter.' });
  }
  if (incomingOffer.visibility.visibility === 'PUBLIC' || incomingOffer.visibility.visibility === 'DEAL_ROOM_PLUS_WITNESSES') {
    reasons.push({ code: 'PUBLIC_WITNESS', weight: 0.42, detail: 'Offer is exposed to witnesses, raising face and leak pressure.' });
  }
  if (incomingOffer.visibility.revealMode === 'TRAP' || incomingOffer.visibility.revealMode === 'FAKEOUT') {
    reasons.push({ code: 'TRAP_REVEAL_MODE', weight: 0.52, detail: `Reveal mode ${incomingOffer.visibility.revealMode} suggests tactical deception.` });
  }
  if (chatOfferHasGuarantee(incomingOffer)) {
    reasons.push({ code: 'STRONG_GUARANTEE', weight: clamp01(chatOfferGuaranteeStrength(incomingOffer)), detail: 'Guarantee stack improves trust projection.', evidence: serializeGuarantees(incomingOffer.currentVersion.guarantees) });
  } else {
    reasons.push({ code: 'WEAK_GUARANTEE', weight: 0.28, detail: 'Offer carries no guarantee support.' });
  }
  if (chatOfferHasConcessions(incomingOffer)) {
    reasons.push({ code: 'CONCESSION_STACK', weight: clamp01(chatOfferConcessionCount(incomingOffer) / 4), detail: 'Concession stack changes softness and desperation read.' });
    if (incomingOffer.currentVersion.concessions?.some((c) => c.helperRecommended)) {
      reasons.push({ code: 'HELPER_RECOMMENDED_CONCESSION', weight: 0.24, detail: 'At least one concession is helper-guided.' });
    }
  }
  if (Number(incomingOffer.visibility.audienceHeat ?? 0) > 0.45) {
    reasons.push({ code: 'AUDIENCE_HEAT', weight: Number(incomingOffer.visibility.audienceHeat ?? 0), detail: 'Audience heat increases face and leak sensitivity.' });
  }
  if (Number(incomingOffer.visibility.secrecyPressure ?? 0) > 0.4) {
    reasons.push({ code: 'SECRECY_PRESSURE', weight: Number(incomingOffer.visibility.secrecyPressure ?? 0), detail: 'Secrecy pressure raises leak fragility.' });
  }
  if (negotiationHasLeakThreat(negotiation)) {
    reasons.push({ code: 'LEAK_THREAT_PRESENT', weight: 0.44, detail: 'Negotiation already contains an active leak threat.', evidence: { containableCount: input.leakProfile.containableCount } });
  }
  if (input.windowDiagnostics.offerWindowExpired || input.windowDiagnostics.activeWindowExpired) {
    reasons.push({ code: 'WINDOW_EXPIRED', weight: 0.5, detail: 'Either the offer window or active negotiation window has already expired.' });
  }
  if (input.windowDiagnostics.activeWindowGrace) {
    reasons.push({ code: 'WINDOW_IN_GRACE', weight: 0.22, detail: 'Negotiation is inside grace territory, which changes urgency and posture.' });
  }
  if (incomingOffer.window && Number(now) >= Number(incomingOffer.window.closesAt) - 10_000) {
    reasons.push({ code: 'EXPIRING_WINDOW', weight: 0.36, detail: 'Offer window is nearing expiry.' });
  }
  if (Number(input.actorLens.leverageGap01) > 0.3) {
    reasons.push({ code: 'ACTOR_LEVERAGE_GAP', weight: Number(input.actorLens.leverageGap01), detail: 'Actor leverage asymmetry is shaping counter distance and rejection pressure.' });
  }
  const dominant = negotiationInferDominantPressure(negotiation.latestInference);
  if (dominant === 'PRICE') reasons.push({ code: 'DOMINANT_PRICE_PRESSURE', weight: 0.31, detail: 'Price is dominant pressure in latest inference.' });
  if (dominant === 'TIME') reasons.push({ code: 'DOMINANT_TIME_PRESSURE', weight: 0.31, detail: 'Time is dominant pressure in latest inference.' });
  if (dominant === 'MEMORY') reasons.push({ code: 'DOMINANT_MEMORY_PRESSURE', weight: 0.25, detail: 'Memory callbacks are shaping current negotiation posture.' });
  if (dominant === 'AUDIENCE') reasons.push({ code: 'DOMINANT_AUDIENCE_PRESSURE', weight: 0.33, detail: 'Audience witnesses are shaping decisions.' });
  if (dominant === 'RESCUE') reasons.push({ code: 'DOMINANT_RESCUE_PRESSURE', weight: 0.29, detail: 'Rescue pressure is already affecting the deal room.' });
  if (input.inferenceSummary.strongestSignals.length > 0) {
    reasons.push({
      code: 'SIGNAL_STACK',
      weight: clamp01(Number(input.inferenceSummary.confidenceBand.normalized)),
      detail: 'Signal stack from negotiation inference is materially affecting the read.',
      evidence: serializeSignals(input.inferenceSummary.strongestSignals),
    });
  }
  if (Number(input.desperation01) > 0.58) {
    reasons.push({ code: 'DESPERATION_SIGNAL', weight: Number(input.desperation01), detail: 'Offer projects desperation above stable band.' });
  }
  if (Number(input.trust01) > 0.62) {
    reasons.push({ code: 'TRUST_SIGNAL', weight: Number(input.trust01), detail: 'Offer contains enough trust signal to support a soft counter.' });
  }
  if (Number(input.leakRisk01) > 0.55) {
    reasons.push({ code: 'FAKEOUT_SIGNAL', weight: Number(input.leakRisk01), detail: 'Leak risk implies possible decoy or containment tactics.' });
  }
  if (Number(input.rescueNeed01) > 0.55) {
    reasons.push({ code: 'RESCUE_ELIGIBLE', weight: Number(input.rescueNeed01), detail: 'Offer is close enough to failure to justify rescue-aware review.' });
  }
  const directBand = chooseProjectedBand({
    leakRisk01: input.leakRisk01,
    rescueNeed01: input.rescueNeed01,
    rejectionRisk01: input.rejectionRisk01,
    stallRisk01: input.stallRisk01,
    aggression01: input.aggression01,
    volatilityThreshold01: 0.58,
  });
  if (input.baselineBand !== directBand) {
    reasons.push({ code: 'BASELINE_BAND_MISMATCH', weight: 0.2, detail: `Incoming projected band (${input.baselineBand}) diverges from recalculated band (${directBand}).` });
  }
  if (input.resolutionProfile.leakOccurred) {
    reasons.push({ code: 'RECENT_LEAK_MEMORY', weight: 0.3, detail: 'Recent negotiation memory includes an actual leak, raising reputational fragility.' });
  }
  if (input.resolutionProfile.rescueOccurred) {
    reasons.push({ code: 'RECENT_RESCUE_MEMORY', weight: 0.28, detail: 'Recent negotiation memory includes a rescue event, biasing intervention expectations.' });
  }
  if (negotiation.status === 'SOFT_LOCKED' || negotiation.status === 'HARD_LOCKED') {
    reasons.push({ code: 'STATUS_LOCK', weight: 0.34, detail: `Negotiation status ${negotiation.status} constrains the counter lane.` });
  }

  if (reasons.length === 0) {
    reasons.push({ code: 'UNKNOWN', weight: 0.1, detail: 'No dominant negotiation feature exceeded the minimum explanation threshold.' });
  }

  return reasons.sort((a, b) => b.weight - a.weight);
}

function serializeSignals(signals: readonly NegotiationSignalEvidence[]): JsonValue {
  return signals.map((signal) => ({
    signalId: String(signal.signalId),
    kind: signal.kind,
    score: Number(signal.score.normalized),
    confidence: Number(signal.confidence.normalized),
    tags: signal.tags ? [...signal.tags] : null,
  }));
}

function serializeGuarantees(guarantees: readonly ChatOfferGuarantee[] | undefined): JsonValue {
  return (guarantees ?? []).map((guarantee) => ({
    type: guarantee.type,
    strength: Number(guarantee.strength.normalized),
    describedAs: guarantee.describedAs ?? null,
  }));
}

function chooseProjectedOutcome(input: {
  fairness01: Score0To1;
  aggression01: Score0To1;
  urgency01: Score0To1;
  desperation01: Score0To1;
  trust01: Score0To1;
  leakRisk01: Score0To1;
  rescueNeed01: Score0To1;
  rejectionRisk01: Score0To1;
  stallRisk01: Score0To1;
  counterDistance01: Score0To1;
}): ChatOfferCounterOutcome {
  if (Number(input.leakRisk01) >= 0.72) return 'LIKELY_LEAK';
  if (Number(input.rescueNeed01) >= 0.74) return 'LIKELY_RESCUE';
  if (Number(input.rejectionRisk01) >= 0.68) return 'LIKELY_REJECT';
  if (Number(input.stallRisk01) >= 0.62) return 'LIKELY_STALL';
  if (Number(input.fairness01) >= 0.62 && Number(input.trust01) >= 0.55 && Number(input.counterDistance01) <= 0.4) {
    return 'LIKELY_ACCEPT';
  }
  return 'LIKELY_COUNTER';
}

function chooseProjectedBand(input: {
  leakRisk01: Score0To1;
  rescueNeed01: Score0To1;
  rejectionRisk01: Score0To1;
  stallRisk01: Score0To1;
  aggression01: Score0To1;
  volatilityThreshold01: number;
}): 'SAFE' | 'RISKY' | 'VOLATILE' | 'COLLAPSE' {
  if (Number(input.leakRisk01) >= 0.78 || Number(input.rescueNeed01) >= 0.8) return 'COLLAPSE';
  if (Math.max(Number(input.leakRisk01), Number(input.rejectionRisk01), Number(input.stallRisk01), Number(input.aggression01)) >= input.volatilityThreshold01) {
    return 'VOLATILE';
  }
  if (Math.max(Number(input.leakRisk01), Number(input.rejectionRisk01), Number(input.stallRisk01)) >= 0.48) {
    return 'RISKY';
  }
  return 'SAFE';
}

function chooseCounterStrategy(input: {
  projectedOutcome: ChatOfferCounterOutcome;
  projectedBand: 'SAFE' | 'RISKY' | 'VOLATILE' | 'COLLAPSE';
  helperReviewSuggested: boolean;
  leakRisk01: Score0To1;
  rescueNeed01: Score0To1;
  aggression01: Score0To1;
  trust01: Score0To1;
  fairness01: Score0To1;
}): CounterStrategy {
  if (Number(input.leakRisk01) >= 0.68) return 'LEAK_CONTAINMENT';
  if (Number(input.rescueNeed01) >= 0.74) return 'RESCUE_ESCALATE';
  if (input.helperReviewSuggested) return 'HELPER_REVIEW';
  if (input.projectedOutcome === 'LIKELY_REJECT' && Number(input.aggression01) >= 0.6) return 'HARD_COUNTER';
  if (input.projectedOutcome === 'LIKELY_STALL') return 'STALL';
  if (input.projectedBand === 'SAFE' && Number(input.fairness01) >= 0.6 && Number(input.trust01) >= 0.52) return 'SOFT_COUNTER';
  if (input.projectedBand === 'VOLATILE') return 'HARD_COUNTER';
  return 'HOLD';
}

function buildPressureSummary(negotiation: ChatNegotiation): string[] {
  const summary: string[] = [];
  if (negotiationHasAudiencePressure(negotiation)) summary.push('AUDIENCE_PRESSURE');
  if (negotiationHasLeakThreat(negotiation)) summary.push('LEAK_THREAT');
  const dominant = negotiationInferDominantPressure(negotiation.latestInference);
  if (dominant) summary.push(`DOMINANT_${dominant}`);
  if (negotiationSupportsRescue(negotiation)) summary.push('RESCUE_SUPPORTED');
  if (summary.length === 0) summary.push('BASELINE');
  return summary;
}

// ============================================================================
// MARK: Counter offer derivation
// ============================================================================

function deriveCounterPrice(
  incomingOffer: ChatOffer,
  priorOffer: ChatOffer | null | undefined,
  negotiation: ChatNegotiation,
  evaluation: OfferCounterEngineEvaluation,
  strategy: CounterStrategy,
): ChatOfferPrice {
  const incomingAmount = Number(incomingOffer.currentVersion.price.amount);
  const priorAmount = priorOffer ? Number(priorOffer.currentVersion.price.amount) : incomingAmount;
  const marketExpected = Number(incomingOffer.currentVersion.price.marketRange?.expected ?? incomingOffer.currentVersion.price.marketRange?.fairValue ?? incomingAmount);
  const marketMin = Number(incomingOffer.currentVersion.price.marketRange?.min ?? Math.min(incomingAmount, marketExpected));
  const marketMax = Number(incomingOffer.currentVersion.price.marketRange?.max ?? Math.max(incomingAmount, marketExpected));

  let target = incomingAmount;
  const direction = inferCounterDirection(incomingOffer, negotiation);
  const softnessBias = 1 - Number(evaluation.softness01) * 0.35;
  const softDistance = Math.max(0.015, Number(evaluation.counterDistance01) * 0.06 * softnessBias);
  const hardDistance = Math.max(0.04, Number(evaluation.counterDistance01) * 0.12 + Number(evaluation.aggression01) * 0.03);

  switch (strategy) {
    case 'SOFT_COUNTER':
      target = direction === 'UP' ? incomingAmount + incomingAmount * softDistance : incomingAmount - incomingAmount * softDistance;
      break;
    case 'HARD_COUNTER':
      target = direction === 'UP' ? incomingAmount + incomingAmount * hardDistance : incomingAmount - incomingAmount * hardDistance;
      break;
    case 'STALL':
      target = (incomingAmount + priorAmount) / 2;
      break;
    case 'HELPER_REVIEW':
      target = (incomingAmount + marketExpected) / 2;
      break;
    case 'LEAK_CONTAINMENT':
      target = marketExpected;
      break;
    case 'RESCUE_ESCALATE':
      target = direction === 'UP' ? incomingAmount + incomingAmount * 0.025 : incomingAmount - incomingAmount * 0.025;
      break;
    case 'WITHDRAW':
      target = priorAmount;
      break;
    case 'HOLD':
    default:
      target = incomingAmount;
      break;
  }

  const boundedTarget = Math.max(marketMin, Math.min(marketMax, target));
  const targetAmount: OfferAmount = asOfferAmount(Math.round(boundedTarget));
  const minAmount: OfferAmount = asOfferAmount(Math.round(marketMin));
  const maxAmount: OfferAmount = asOfferAmount(Math.round(marketMax));
  const expectedAmount: OfferAmount = asOfferAmount(Math.round(marketExpected));
  const normalizedCurrency = asCurrencyCode(String(incomingOffer.currentVersion.price.currency));

  return createChatOfferPrice(Number(targetAmount), String(normalizedCurrency), {
    taxBps: incomingOffer.currentVersion.price.taxBps,
    feeBps: incomingOffer.currentVersion.price.feeBps,
    rebateBps: incomingOffer.currentVersion.price.rebateBps,
    discountBps: incomingOffer.currentVersion.price.discountBps,
    marketRange: {
      min: minAmount,
      max: maxAmount,
      expected: expectedAmount,
      fairValue: expectedAmount,
    },
  });
}

function deriveCounterWindow(
  incomingOffer: ChatOffer,
  negotiation: ChatNegotiation,
  evaluation: OfferCounterEngineEvaluation,
  now: number,
  defaultCounterWindowMs: number,
  minCounterWindowMs: number,
  maxCounterWindowMs: number,
): ChatOfferWindow {
  const incomingWindowMs = incomingOffer.window ? Math.max(0, Number(incomingOffer.window.closesAt) - Number(incomingOffer.window.opensAt)) : defaultCounterWindowMs;
  const urgencyCompression = 1 - Number(evaluation.urgency01) * 0.45;
  const leakCompression = 1 - Number(evaluation.leakRisk01) * 0.25;
  const rescueExtension = negotiationSupportsRescue(negotiation) ? Number(evaluation.rescueNeed01) * 20_000 : 0;
  const duration = clampInt(Math.round(incomingWindowMs * urgencyCompression * leakCompression + rescueExtension), minCounterWindowMs, maxCounterWindowMs);
  const opensAt = now;
  const closesAt = now + duration;
  const rescueEligibleAt = now + Math.round(duration * 0.45);
  const leakEligibleAt = now + Math.round(duration * 0.7);
  const readPreferredBy = now + Math.round(duration * 0.35);
  const graceUntil = closesAt + Math.round(duration * 0.15);

  return createChatOfferWindow(opensAt, closesAt, {
    windowId: `counter-window:${String(negotiation.negotiationId)}:${opensAt}`,
    rescueEligibleAt: asOfferUnixMs(rescueEligibleAt),
    leakEligibleAt: asOfferUnixMs(leakEligibleAt),
    readPreferredBy: asOfferUnixMs(readPreferredBy),
    graceUntil: asOfferUnixMs(graceUntil),
  });
}

function deriveCounterAnalytics(
  evaluation: OfferCounterEngineEvaluation,
  strategy: CounterStrategy,
  now: number,
): ChatOfferAnalytics {
  return {
    fairness: createChatOfferScore(Number(evaluation.fairness01), Number(evaluation.fairness01), `counter:${strategy}:fairness`, now, Number(evaluation.fairness01) * 100),
    aggression: createChatOfferScore(Number(evaluation.aggression01), Number(evaluation.aggression01), `counter:${strategy}:aggression`, now, Number(evaluation.aggression01) * 100),
    urgency: createChatOfferScore(Number(evaluation.urgency01), Number(evaluation.urgency01), `counter:${strategy}:urgency`, now, Number(evaluation.urgency01) * 100),
    bluffLikelihood: asProbability(clamp01(Number(evaluation.leakRisk01) * 0.35 + Number(evaluation.aggression01) * 0.25)),
    desperation: asScore0To1(clamp01(Number(evaluation.rescueNeed01) * 0.7 + Number(evaluation.urgency01) * 0.2)),
    trustSignal: asScore0To1(Number(evaluation.trust01)),
    reputationImpact: Math.round((Number(evaluation.fairness01) - Number(evaluation.aggression01)) * 10),
    crowdImpact: Math.round((Number(evaluation.leakRisk01) + Number(evaluation.aggression01)) * 10),
  };
}

function deriveCounterConcessions(
  incomingOffer: ChatOffer,
  strategy: CounterStrategy,
  evaluation: OfferCounterEngineEvaluation,
  now: number,
): ChatOfferConcession[] {
  const concessions: ChatOfferConcession[] = [];

  if (strategy === 'SOFT_COUNTER' || strategy === 'HELPER_REVIEW') {
    concessions.push({
      label: 'Narrow spread to preserve momentum',
      valueDelta: asOfferAmount(Math.round(Number(incomingOffer.currentVersion.price.amount) * 0.015)),
      reputationCost: 1,
      urgencyCost: 0,
      helperRecommended: strategy === 'HELPER_REVIEW',
    });
  }

  if (strategy === 'STALL') {
    concessions.push({
      label: 'Delay final close while maintaining channel',
      valueDelta: asOfferAmount(0),
      reputationCost: 0,
      urgencyCost: 2,
    });
  }

  if (strategy === 'LEAK_CONTAINMENT') {
    concessions.push({
      label: 'Reduce exposure in exchange for privacy compliance',
      valueDelta: asOfferAmount(Math.round(Number(incomingOffer.currentVersion.price.amount) * 0.01)),
      reputationCost: 2,
      urgencyCost: 1,
    });
  }

  if (Number(evaluation.rescueNeed01) >= 0.65) {
    concessions.push({
      label: 'Rescue-safe softener to prevent abandonment',
      valueDelta: asOfferAmount(Math.round(Number(incomingOffer.currentVersion.price.amount) * 0.02)),
      reputationCost: 0,
      urgencyCost: 1,
      helperRecommended: true,
    });
  }

  if (concessions.length === 0) {
    concessions.push({
      label: `Counter posture maintained @ ${now}`,
      valueDelta: asOfferAmount(0),
      reputationCost: 0,
      urgencyCost: 0,
    });
  }

  return concessions;
}

function deriveCounterVisibility(
  incomingVisibility: ChatOfferVisibilityEnvelope,
  strategy: CounterStrategy,
  evaluation: OfferCounterEngineEvaluation,
): ChatOfferVisibilityEnvelope {
  if (strategy === 'LEAK_CONTAINMENT') {
    return {
      ...incomingVisibility,
      visibility: 'DEAL_ROOM_ONLY',
      revealMode: 'PARTIAL',
      audienceHeat: asScore0To1(Math.max(0, Number(incomingVisibility.audienceHeat ?? 0) - 0.18)),
      secrecyPressure: asScore0To1(Math.min(1, Number(incomingVisibility.secrecyPressure ?? 0) + 0.15)),
    };
  }

  if (strategy === 'STALL') {
    return {
      ...incomingVisibility,
      revealMode: 'DELAYED_FULL',
    };
  }

  if (Number(evaluation.leakRisk01) > 0.65) {
    return {
      ...incomingVisibility,
      visibility: 'DEAL_ROOM_PLUS_HELPER',
      helperVisible: true,
    };
  }

  return incomingVisibility;
}

function createCounterReadFromEvaluation(evaluation: OfferCounterEngineEvaluation): ChatOfferCounterRead {
  return {
    likelyOutcome: evaluation.projectedOutcome,
    counterDistance: evaluation.counterDistance01,
    rejectionRisk: evaluation.rejectionRisk01,
    stallRisk: evaluation.stallRisk01,
    rescueNeed: evaluation.rescueNeed01,
    leakRisk: evaluation.leakRisk01,
  };
}

// ============================================================================
// MARK: Negotiation envelope conversion
// ============================================================================

function toNegotiationActorRef(actor: ChatOfferActorRef, role: 'BUYER' | 'SELLER'): NegotiationActorRef {
  return {
    actorId: actor.actorId as unknown as any,
    actorKind: actor.actorKind,
    role,
    displayName: actor.displayName,
    factionId: actor.factionId,
    personaKey: actor.personaKey,
    voiceprintKey: actor.voiceprintKey,
  };
}

function toNegotiationConcessions(concessions: readonly ChatOfferConcession[] | undefined): NegotiationConcession[] | undefined {
  if (!concessions || concessions.length === 0) return undefined;
  return concessions.map((concession) => ({
    type: 'PRICE',
    magnitude: Number(concession.valueDelta ?? 0),
    describedAs: concession.label,
    reversible: false,
    costsReputation: (concession.reputationCost ?? 0) > 0,
    costsUrgency: (concession.urgencyCost ?? 0) > 0,
    costsLeverage: false,
  }));
}

function deriveNegotiationIntent(strategy: CounterStrategy, evaluation: OfferCounterEngineEvaluation): NegotiationIntent {
  switch (strategy) {
    case 'HARD_COUNTER':
      return 'VALUE_EXTRACT';
    case 'SOFT_COUNTER':
      return 'PRICE_DISCOVERY';
    case 'STALL':
      return 'DELAY';
    case 'HELPER_REVIEW':
      return 'HELPER_INTERVENTION';
    case 'RESCUE_ESCALATE':
      return 'RESCUE_OVERRIDE';
    case 'LEAK_CONTAINMENT':
      return 'FACE_SAVE';
    case 'WITHDRAW':
      return 'PANIC_EXIT';
    case 'HOLD':
    default:
      return Number(evaluation.fairness01) >= 0.58 ? 'FAIR_TRADE' : 'VALUE_EXTRACT';
  }
}

function deriveNegotiationPhase(strategy: CounterStrategy): NegotiationPhase {
  switch (strategy) {
    case 'STALL':
      return 'WINDOW';
    case 'LEAK_CONTAINMENT':
      return 'WITNESS';
    case 'RESCUE_ESCALATE':
      return 'PRESSURE';
    case 'SOFT_COUNTER':
    case 'HARD_COUNTER':
      return 'COUNTER';
    case 'HOLD':
    case 'WITHDRAW':
    case 'HELPER_REVIEW':
    default:
      return 'SIGNAL_READ';
  }
}

function deriveCounterKind(strategy: CounterStrategy): ChatOfferKind {
  switch (strategy) {
    case 'HARD_COUNTER':
    case 'SOFT_COUNTER':
      return 'COUNTER';
    case 'STALL':
      return 'BLUFF';
    case 'LEAK_CONTAINMENT':
      return 'HELPER_GUIDED';
    case 'RESCUE_ESCALATE':
      return 'RESCUE_OVERRIDE';
    case 'WITHDRAW':
      return 'LIQUIDATION';
    case 'HELPER_REVIEW':
      return 'HELPER_GUIDED';
    case 'HOLD':
    default:
      return 'COUNTER';
  }
}

function inferCounterDirection(incomingOffer: ChatOffer, negotiation: ChatNegotiation): 'UP' | 'DOWN' {
  const buyer = negotiation.parties.primary.role === 'BUYER' ? negotiation.parties.primary.actorId : negotiation.parties.counterparty.actorId;
  const offeredByBuyer = String(incomingOffer.offeredBy.actorId) === String(buyer);
  return offeredByBuyer ? 'UP' : 'DOWN';
}

function derivePriorOfferFromNegotiation(negotiation: ChatNegotiation, incomingOffer: ChatOffer): ChatOffer | undefined {
  if (!negotiation.activeOffer || String(negotiation.activeOffer.vector.offerId) === String(incomingOffer.offerId)) {
    return undefined;
  }
  const active = negotiation.activeOffer;
  const version = createChatOfferVersion(
    1,
    createChatOfferPrice(Number(active.vector.price.amount), String(active.vector.price.currency)),
    incomingOffer.currentVersion.paymentTerms,
    { createdAt: Number(active.createdAt) },
  );
  return {
    offerId: asChatOfferId(String(active.vector.offerId)),
    threadId: asChatOfferThreadId(String(active.threadId)),
    kind: 'COUNTER',
    status: 'POSTED',
    offeredBy: toChatOfferActor(active.offeredBy),
    offeredTo: toChatOfferActor(active.offeredTo),
    currentVersion: version,
    visibility: incomingOffer.visibility,
    createdAt: asOfferUnixMs(Number(active.createdAt)),
    updatedAt: asOfferUnixMs(Number(active.createdAt)),
  };
}

function toChatOfferActor(actor: NegotiationActorRef): ChatOfferActorRef {
  const actorKind: ChatOfferActorRef['actorKind'] =
    actor.actorKind === 'OBSERVER' ? 'SYSTEM' : actor.actorKind;
  return {
    actorId: actor.actorId as unknown as any,
    displayName: actor.displayName,
    actorKind,
    factionId: actor.factionId,
    personaKey: actor.personaKey,
    voiceprintKey: actor.voiceprintKey,
  };
}

// ============================================================================
// MARK: Utility helpers
// ============================================================================

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function createOfferCounterEngine(options: OfferCounterEngineOptions = {}): OfferCounterEngine {
  return new OfferCounterEngine(options);
}

export const ChatOfferCounterEngineModule = {
  moduleId: 'backend.chat.dealroom.offer-counter-engine',
  file: 'backend/src/game/engine/chat/dealroom/OfferCounterEngine.ts',
  version: '2026.03.19',
  create: createOfferCounterEngine,
  OfferCounterEngine,
} as const;
