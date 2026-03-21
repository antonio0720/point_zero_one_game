/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT DEALROOM BLUFF RESOLVER
 * FILE: backend/src/game/engine/chat/dealroom/BluffResolver.ts
 * VERSION: 2026.03.19
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Backend bluff authority for Deal Room negotiations.
 *
 * This resolver exists to turn transcript fragments, offer revisions, timing
 * behavior, visibility posture, proof posture, audience pressure, rescue
 * markers, and prior memory into backend-truth bluff reads.
 *
 * It is not a UI helper.
 * It is not a moderation filter.
 * It is not a toy classifier.
 *
 * It produces:
 * - bluff confidence
 * - bluff family
 * - dominant evidence
 * - contradiction bands
 * - urgency distortion
 * - anchor manipulation
 * - leak theater
 * - helper baiting
 * - rescue-demand interpretation
 * - exploit windows for counter engines and scene directors
 * ============================================================================
 */

import type {
  ChatOffer,
  ChatOfferConcession,
  ChatOfferGuarantee,
  ChatOfferVisibilityEnvelope,
  ChatOfferWindow,
  Probability,
  Score0To1,
  Score0To100,
  UnixMs,
} from '../../../../../../shared/contracts/chat/ChatOffer';
import {
  asProbability,
  asScore0To1,
  asScore0To100,
  asUnixMs as asOfferUnixMs,
  chatOfferCanLeak,
  chatOfferConcessionCount,
  chatOfferGuaranteeStrength,
  chatOfferProjectedHostility,
  chatOfferProjectedSoftness,
  chatOfferProjectedTrustworthiness,
  chatOfferPriceDeltaFromPrior,
  chatOfferShouldTriggerHelperReview,
} from '../../../../../../shared/contracts/chat/ChatOffer';
import type {
  ChatNegotiation,
  NegotiationActorRef,
  NegotiationActorState,
  NegotiationInferenceFrame,
  NegotiationIntent,
  NegotiationLeakThreat,
  NegotiationOfferEnvelope,
  NegotiationSignalEvidence,
} from '../../../../../../shared/contracts/chat/ChatNegotiation';
import {
  asUnixMs,
  negotiationHasAudiencePressure,
  negotiationHasLeakThreat,
  negotiationInferDominantPressure,
  negotiationPrimaryActorState,
  negotiationSupportsRescue,
} from '../../../../../../shared/contracts/chat/ChatNegotiation';
import type { ChatRoomId, JsonValue } from '../types';
import { clamp01 } from '../types';

// ============================================================================
// MARK: Public contracts
// ============================================================================

export interface BluffResolverClock {
  now(): number;
}

export interface BluffResolverLogger {
  debug(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface BluffResolverOptions {
  readonly clock?: BluffResolverClock;
  readonly logger?: BluffResolverLogger;
  readonly retainAnalysesPerRoom?: number;
  readonly minimumMessageLengthForTextRead?: number;
  readonly strongBluffThreshold01?: number;
  readonly leakTheaterThreshold01?: number;
  readonly rescueMaskThreshold01?: number;
  readonly urgencyMaskThreshold01?: number;
}

export type BluffFamily =
  | 'NONE'
  | 'PRICE_FAKE'
  | 'URGENCY_FAKE'
  | 'SCARCITY_FAKE'
  | 'AUTHORITY_FAKE'
  | 'VISIBILITY_FAKE'
  | 'CONFIDENCE_MASK'
  | 'COLLAPSE_MASK'
  | 'LEAK_BAIT'
  | 'HELPER_BAIT'
  | 'RESCUE_BAIT'
  | 'ANCHOR_TRAP'
  | 'FACE_SAVE_MASK'
  | 'PROOF_MASK'
  | 'MULTI_LAYER';

export type BluffSignalCode =
  | 'PRICE_DELTA_SPIKE'
  | 'MESSAGE_URGENCY_SPIKE'
  | 'SECRECY_CONTRADICTION'
  | 'PUBLIC_CONFIDENCE_PRIVATE_FEAR'
  | 'CONCESSION_COUNT_OUT_OF_CHARACTER'
  | 'WINDOW_MISMATCH'
  | 'LEAK_POSTURE_OVERPLAY'
  | 'RESCUE_SIGNAL_OVERPLAY'
  | 'TRUST_LANGUAGE_LOW_TRUST_OFFER'
  | 'PROOF_LANGUAGE_LOW_PROOF_STATE'
  | 'SCARCITY_LANGUAGE_NO_SCARCITY'
  | 'DEADLINE_LANGUAGE_NO_DEADLINE'
  | 'DOMINANCE_LANGUAGE_SOFT_TERMS'
  | 'SOFT_LANGUAGE_PREDATORY_TERMS'
  | 'GUARANTEE_LANGUAGE_WEAK_GUARANTEE'
  | 'AUDIENCE_HEAT_PERFORMANCE'
  | 'REPEATED_NONANSWER'
  | 'REVISION_BACKTRACK'
  | 'ANCHOR_SHOCK'
  | 'COUNTERFEIT_CALM'
  | 'COUNTERFEIT_PANIC'
  | 'MEMORY_EVASION'
  | 'HELPER_SHIELDING'
  | 'RIVAL_WITNESS_PLAY'
  | 'VISIBILITY_POSTURE_OVERPLAY'
  | 'HELPER_VISIBLE_SECRECY_CONTRADICTION'
  | 'CONCESSION_STACK_PRESSURE'
  | 'CONCESSION_REPUTATION_BLEED'
  | 'CONCESSION_URGENCY_BLEED'
  | 'CONCESSION_HELPER_CRUTCH'
  | 'INTENT_STATE_MISMATCH'
  | 'ACTIVE_ENVELOPE_COUNTER_STRESS'
  | 'FACE_SAVE_COUNTER_MASK'
  | 'ROLE_POSTURE_CONTRADICTION'
  | 'AUTHORITY_POSTURE_OVERPLAY';

export interface BluffResolverRequest {
  readonly roomId: ChatRoomId;
  readonly negotiation: ChatNegotiation;
  readonly actorId?: string | null;
  readonly body?: string | null;
  readonly offer?: ChatOffer | null;
  readonly priorOffer?: ChatOffer | null;
  readonly priorBodies?: readonly string[];
  readonly actorState?: NegotiationActorState | null;
  readonly latestInference?: NegotiationInferenceFrame | null;
  readonly latestLeakThreat?: NegotiationLeakThreat | null;
  readonly evidence?: readonly NegotiationSignalEvidence[];
  readonly now?: UnixMs;
  readonly traceLabel?: string;
}

export interface BluffSignal {
  readonly code: BluffSignalCode;
  readonly weight01: Score0To1;
  readonly detail: string;
  readonly evidence?: JsonValue;
}

export interface BluffExploitWindow {
  readonly kind:
    | 'HARD_COUNTER'
    | 'SOFT_COUNTER'
    | 'WAIT_AND_WITNESS'
    | 'LEAK_PUNISH'
    | 'HELPER_INTERCEPT'
    | 'RESCUE_DEESCALATE'
    | 'ANCHOR_RESET'
    | 'PROOF_CHALLENGE';
  readonly confidence01: Score0To1;
  readonly recommendedDelayMs: number;
  readonly rationale: string;
}

export interface BluffActorRead {
  readonly actor: NegotiationActorRef | null;
  readonly role: string;
  readonly actorKind: string;
  readonly authorityMask01: Score0To1;
  readonly reputation100: Score0To100;
  readonly leverage01: Score0To1;
  readonly patience01: Score0To1;
}

export interface BluffVisibilityRead {
  readonly envelope: ChatOfferVisibilityEnvelope | null;
  readonly visibility: string;
  readonly revealMode: string;
  readonly witnessCount: number;
  readonly helperVisible: boolean;
  readonly visibilityMask01: Score0To1;
}

export interface BluffConcessionRead {
  readonly concessions: readonly ChatOfferConcession[];
  readonly count: number;
  readonly helperRecommendedCount: number;
  readonly totalUrgencyCost: number;
  readonly totalReputationCost: number;
  readonly aggregateValueDelta: number;
  readonly concessionMask01: Score0To1;
}

export interface BluffIntentRead {
  readonly intent: NegotiationIntent | null;
  readonly envelope: NegotiationOfferEnvelope | null;
  readonly mismatch01: Score0To1;
  readonly faceSavePressure01: Score0To1;
  readonly counterStress01: Score0To1;
}

export interface BluffAnalysis {
  readonly analysisId: string;
  readonly roomId: ChatRoomId;
  readonly negotiationId: string;
  readonly actorId?: string;
  readonly analyzedAt: UnixMs;
  readonly family: BluffFamily;
  readonly bluffConfidence01: Score0To1;
  readonly contradiction01: Score0To1;
  readonly urgencyMask01: Score0To1;
  readonly confidenceMask01: Score0To1;
  readonly rescueMask01: Score0To1;
  readonly leakTheater01: Score0To1;
  readonly anchorManipulation01: Score0To1;
  readonly helperBait01: Score0To1;
  readonly proofMask01: Score0To1;
  readonly visibilityMask01: Score0To1;
  readonly concessionMask01: Score0To1;
  readonly intentMismatch01: Score0To1;
  readonly truthfulnessProjection01: Score0To1;
  readonly exploitability01: Score0To1;
  readonly probableBluff: Probability;
  readonly bluffConfidence100: Score0To100;
  readonly truthfulnessProjection100: Score0To100;
  readonly exploitability100: Score0To100;
  readonly dominantPressure: string;
  readonly actorRead: BluffActorRead;
  readonly visibilityRead: BluffVisibilityRead;
  readonly concessionRead: BluffConcessionRead;
  readonly intentRead: BluffIntentRead;
  readonly signals: readonly BluffSignal[];
  readonly exploitWindows: readonly BluffExploitWindow[];
  readonly debug: JsonValue;
}

export interface BluffResolverLedger {
  readonly roomId: ChatRoomId;
  readonly analyses: readonly BluffAnalysis[];
  readonly byNegotiation: Readonly<Record<string, readonly BluffAnalysis[]>>;
  readonly lastUpdatedAt?: UnixMs;
}

// ============================================================================
// MARK: Defaults
// ============================================================================

const DEFAULT_OPTIONS: Required<Omit<BluffResolverOptions, 'clock' | 'logger'>> = {
  retainAnalysesPerRoom: 200,
  minimumMessageLengthForTextRead: 8,
  strongBluffThreshold01: 0.66,
  leakTheaterThreshold01: 0.58,
  rescueMaskThreshold01: 0.54,
  urgencyMaskThreshold01: 0.57,
};

const NOOP_LOGGER: BluffResolverLogger = {
  debug() {},
  info() {},
  warn() {},
};

const DEFAULT_CLOCK: BluffResolverClock = {
  now: () => Date.now(),
};

// ============================================================================
// MARK: Resolver
// ============================================================================

export class BluffResolver {
  private readonly options: Required<Omit<BluffResolverOptions, 'clock' | 'logger'>>;
  private readonly logger: BluffResolverLogger;
  private readonly clock: BluffResolverClock;
  private readonly roomLedgers = new Map<string, MutableBluffLedger>();

  public constructor(options: BluffResolverOptions = {}) {
    const {
      clock = DEFAULT_CLOCK,
      logger = NOOP_LOGGER,
      ...rest
    } = options;

    this.clock = clock;
    this.logger = logger;
    this.options = {
      ...DEFAULT_OPTIONS,
      ...rest,
    };
  }

  public analyze(request: BluffResolverRequest): BluffAnalysis {
    const now = request.now ?? asUnixMs(this.clock.now());
    const negotiation = request.negotiation;
    const activeEnvelope = resolveNegotiationOfferEnvelope(negotiation);
    const actorState = request.actorState ?? resolveActorState(
      negotiation,
      request.actorId ?? activeEnvelope?.offeredBy.actorId ?? null,
    );
    const actorRef = resolveAnalysisActorRef(negotiation, actorState, activeEnvelope, request.actorId);
    const body = normalizeBody(request.body);
    const offer = request.offer ?? null;
    const priorOffer = request.priorOffer ?? null;
    const signals: BluffSignal[] = [];

    const pressure = scoreDominantPressure(negotiation, actorState, offer, priorOffer, activeEnvelope);
    const actorRead = buildActorRead(actorRef, actorState);
    const visibilityRead = buildVisibilityRead(offer, negotiation, actorState);
    const concessionRead = buildConcessionRead(offer, negotiation, actorState);
    const intentRead = buildIntentRead(negotiation, activeEnvelope, actorState, offer);

    const textSignals = this.scoreTextSignals(body, negotiation, actorState, priorOffer, request.priorBodies);
    const offerSignals = this.scoreOfferSignals(offer, priorOffer, negotiation, actorState);
    const stateSignals = this.scoreStateSignals(negotiation, actorState, request.latestInference, request.latestLeakThreat);
    const evidenceSignals = this.scoreEvidenceSignals(request.evidence ?? [], negotiation, actorState);
    const visibilitySignals = this.scoreVisibilitySignals(visibilityRead, negotiation, actorState);
    const concessionSignals = this.scoreConcessionSignals(concessionRead, negotiation, actorState, offer);
    const intentSignals = this.scoreIntentSignals(intentRead, negotiation, actorState, offer);

    signals.push(
      ...textSignals,
      ...offerSignals,
      ...stateSignals,
      ...evidenceSignals,
      ...visibilitySignals,
      ...concessionSignals,
      ...intentSignals,
    );

    const contradiction01 = weightedAverage01(
      signals.filter((signal) =>
        signal.code === 'SECRECY_CONTRADICTION' ||
        signal.code === 'PUBLIC_CONFIDENCE_PRIVATE_FEAR' ||
        signal.code === 'TRUST_LANGUAGE_LOW_TRUST_OFFER' ||
        signal.code === 'PROOF_LANGUAGE_LOW_PROOF_STATE' ||
        signal.code === 'GUARANTEE_LANGUAGE_WEAK_GUARANTEE' ||
        signal.code === 'DOMINANCE_LANGUAGE_SOFT_TERMS' ||
        signal.code === 'SOFT_LANGUAGE_PREDATORY_TERMS' ||
        signal.code === 'ROLE_POSTURE_CONTRADICTION',
      ),
    );

    const urgencyMask01 = weightedAverage01(
      signals.filter((signal) =>
        signal.code === 'MESSAGE_URGENCY_SPIKE' ||
        signal.code === 'DEADLINE_LANGUAGE_NO_DEADLINE' ||
        signal.code === 'WINDOW_MISMATCH' ||
        signal.code === 'CONCESSION_URGENCY_BLEED',
      ),
    );

    const rescueMask01 = weightedAverage01(
      signals.filter((signal) =>
        signal.code === 'RESCUE_SIGNAL_OVERPLAY' ||
        signal.code === 'HELPER_SHIELDING' ||
        signal.code === 'CONCESSION_HELPER_CRUTCH',
      ),
    );

    const leakTheater01 = weightedAverage01(
      signals.filter((signal) =>
        signal.code === 'LEAK_POSTURE_OVERPLAY' ||
        signal.code === 'RIVAL_WITNESS_PLAY',
      ),
    );

    const confidenceMask01 = weightedAverage01(
      signals.filter((signal) =>
        signal.code === 'COUNTERFEIT_CALM' ||
        signal.code === 'COUNTERFEIT_PANIC' ||
        signal.code === 'PUBLIC_CONFIDENCE_PRIVATE_FEAR' ||
        signal.code === 'AUTHORITY_POSTURE_OVERPLAY',
      ),
    );

    const anchorManipulation01 = weightedAverage01(
      signals.filter((signal) =>
        signal.code === 'ANCHOR_SHOCK' ||
        signal.code === 'REVISION_BACKTRACK' ||
        signal.code === 'ACTIVE_ENVELOPE_COUNTER_STRESS',
      ),
    );

    const helperBait01 = weightedAverage01(
      signals.filter((signal) =>
        signal.code === 'HELPER_SHIELDING' ||
        signal.code === 'RESCUE_SIGNAL_OVERPLAY' ||
        signal.code === 'CONCESSION_HELPER_CRUTCH' ||
        signal.code === 'HELPER_VISIBLE_SECRECY_CONTRADICTION',
      ),
    );

    const proofMask01 = weightedAverage01(
      signals.filter((signal) =>
        signal.code === 'PROOF_LANGUAGE_LOW_PROOF_STATE' ||
        signal.code === 'GUARANTEE_LANGUAGE_WEAK_GUARANTEE',
      ),
    );

    const visibilityMask01 = weightedAverage01(
      signals.filter((signal) =>
        signal.code === 'VISIBILITY_POSTURE_OVERPLAY' ||
        signal.code === 'HELPER_VISIBLE_SECRECY_CONTRADICTION',
      ),
    );

    const concessionMask01 = weightedAverage01(
      signals.filter((signal) =>
        signal.code === 'CONCESSION_STACK_PRESSURE' ||
        signal.code === 'CONCESSION_REPUTATION_BLEED' ||
        signal.code === 'CONCESSION_URGENCY_BLEED' ||
        signal.code === 'CONCESSION_HELPER_CRUTCH',
      ),
    );

    const intentMismatch01 = weightedAverage01(
      signals.filter((signal) =>
        signal.code === 'INTENT_STATE_MISMATCH' ||
        signal.code === 'FACE_SAVE_COUNTER_MASK' ||
        signal.code === 'ACTIVE_ENVELOPE_COUNTER_STRESS',
      ),
    );

    const bluffConfidence01 = asScore0To1(
      clamp01(
        contradiction01 * 0.16 +
          urgencyMask01 * 0.1 +
          rescueMask01 * 0.08 +
          leakTheater01 * 0.1 +
          confidenceMask01 * 0.09 +
          anchorManipulation01 * 0.1 +
          helperBait01 * 0.06 +
          proofMask01 * 0.07 +
          visibilityMask01 * 0.08 +
          concessionMask01 * 0.08 +
          intentMismatch01 * 0.08 +
          actorRead.authorityMask01 * 0.04 +
          normalizedSignalDensity(signals) * 0.06,
      ),
    );

    const truthfulnessProjection01 = asScore0To1(clamp01(1 - Number(bluffConfidence01)));
    const exploitability01 = asScore0To1(
      clamp01(
        contradiction01 * 0.2 +
          anchorManipulation01 * 0.15 +
          leakTheater01 * 0.11 +
          urgencyMask01 * 0.1 +
          helperBait01 * 0.06 +
          proofMask01 * 0.07 +
          visibilityMask01 * 0.07 +
          concessionMask01 * 0.09 +
          intentMismatch01 * 0.08 +
          softFailureSignal01(actorState) * 0.07,
      ),
    );

    const probableBluff = deriveProbableBluff(bluffConfidence01, offer, negotiation, activeEnvelope, intentRead);
    const bluffConfidence100 = score01To100(bluffConfidence01);
    const truthfulnessProjection100 = score01To100(truthfulnessProjection01);
    const exploitability100 = score01To100(exploitability01);

    const family = determineBluffFamily({
      contradiction01,
      urgencyMask01,
      rescueMask01,
      leakTheater01,
      confidenceMask01,
      anchorManipulation01,
      helperBait01,
      proofMask01,
      visibilityMask01,
      concessionMask01,
      intentMismatch01,
      actorAuthorityMask01: Number(actorRead.authorityMask01),
      intentRead,
      signals,
    });

    const exploitWindows = this.buildExploitWindows({
      family,
      bluffConfidence01,
      contradiction01,
      urgencyMask01,
      rescueMask01,
      leakTheater01,
      exploitability01,
      visibilityMask01,
      concessionMask01,
      intentMismatch01,
      negotiation,
      actorState,
      offer,
      priorOffer,
      intentRead,
    });

    const analysis: BluffAnalysis = {
      analysisId: createAnalysisId(negotiation.negotiationId, actorRef?.actorId ?? actorState?.actor.actorId, now),
      roomId: request.roomId,
      negotiationId: String(negotiation.negotiationId),
      actorId: actorRef?.actorId ? String(actorRef.actorId) : request.actorId ?? undefined,
      analyzedAt: now,
      family,
      bluffConfidence01,
      contradiction01: asScore0To1(contradiction01),
      urgencyMask01: asScore0To1(urgencyMask01),
      confidenceMask01: asScore0To1(confidenceMask01),
      rescueMask01: asScore0To1(rescueMask01),
      leakTheater01: asScore0To1(leakTheater01),
      anchorManipulation01: asScore0To1(anchorManipulation01),
      helperBait01: asScore0To1(helperBait01),
      proofMask01: asScore0To1(proofMask01),
      visibilityMask01: asScore0To1(visibilityMask01),
      concessionMask01: asScore0To1(concessionMask01),
      intentMismatch01: asScore0To1(intentMismatch01),
      truthfulnessProjection01,
      exploitability01,
      probableBluff,
      bluffConfidence100,
      truthfulnessProjection100,
      exploitability100,
      dominantPressure: pressure,
      actorRead,
      visibilityRead,
      concessionRead,
      intentRead,
      signals,
      exploitWindows,
      debug: {
        bodyLength: body.length,
        hasOffer: Boolean(offer),
        hasPriorOffer: Boolean(priorOffer),
        negotiationSupportsRescue: negotiationSupportsRescue(negotiation),
        negotiationHasLeakThreat: negotiationHasLeakThreat(negotiation),
        dominantPressure: pressure,
        signalCount: signals.length,
        primaryIntent: intentRead.intent,
        probableBluff: Number(probableBluff),
        actorRole: actorRead.role,
        actorKind: actorRead.actorKind,
        witnessCount: visibilityRead.witnessCount,
        helperVisible: visibilityRead.helperVisible,
        concessionCount: concessionRead.count,
        activeEnvelopeOfferId: intentRead.envelope?.vector.offerId ?? null,
        traceLabel: request.traceLabel ?? null,
      },
    };

    this.recordAnalysis(analysis);

    this.logger.debug('chat.dealroom.bluff.analyzed', {
      roomId: request.roomId as unknown as string,
      negotiationId: String(negotiation.negotiationId),
      actorId: analysis.actorId ?? null,
      family,
      bluffConfidence01,
      probableBluff: Number(probableBluff),
      contradiction01,
      urgencyMask01,
      leakTheater01,
      rescueMask01,
      visibilityMask01,
      concessionMask01,
      intentMismatch01,
    });

    return analysis;
  }

  public getRoomLedger(roomId: ChatRoomId): BluffResolverLedger {
    const ledger = this.roomLedgers.get(String(roomId));
    if (!ledger) {
      return {
        roomId,
        analyses: [],
        byNegotiation: {},
        lastUpdatedAt: undefined,
      };
    }
    return freezeBluffLedger(ledger);
  }

  public clearRoom(roomId: ChatRoomId): void {
    this.roomLedgers.delete(String(roomId));
  }

  public reset(): void {
    this.roomLedgers.clear();
  }

  private scoreTextSignals(
    body: string,
    negotiation: ChatNegotiation,
    actorState: NegotiationActorState | null,
    priorOffer: ChatOffer | null,
    priorBodies?: readonly string[],
  ): BluffSignal[] {
    if (body.length < this.options.minimumMessageLengthForTextRead) {
      return [];
    }

    const tokens = tokenize(body);
    const urgencyHits = countUrgencyLexicon(tokens);
    const scarcityHits = countScarcityLexicon(tokens);
    const dominanceHits = countDominanceLexicon(tokens);
    const trustHits = countTrustLexicon(tokens);
    const proofHits = countProofLexicon(tokens);
    const panicHits = countPanicLexicon(tokens);
    const calmHits = countCalmLexicon(tokens);
    const secrecyHits = countSecrecyLexicon(tokens);
    const guaranteeHits = countGuaranteeLexicon(tokens);

    const signals: BluffSignal[] = [];

    if (urgencyHits > 0 && !hasActiveDeadlineWindow(negotiation, priorOffer)) {
      signals.push(signal(
        'MESSAGE_URGENCY_SPIKE',
        scaledHitWeight(urgencyHits, 4),
        'Urgency language exceeds backend-observed deadline pressure.',
        { urgencyHits, tokens: sampleMatchingTokens(tokens, URGENCY_WORDS) },
      ));
      signals.push(signal(
        'DEADLINE_LANGUAGE_NO_DEADLINE',
        scaledHitWeight(urgencyHits, 5),
        'Deadline rhetoric appears without supporting timing state.',
      ));
    }

    if (scarcityHits > 0 && !supportsScarcityClaim(negotiation, actorState)) {
      signals.push(signal(
        'SCARCITY_LANGUAGE_NO_SCARCITY',
        scaledHitWeight(scarcityHits, 4),
        'Scarcity language appears stronger than observed market pressure.',
      ));
    }

    if (dominanceHits > 0 && panicHits > 0) {
      signals.push(signal(
        'PUBLIC_CONFIDENCE_PRIVATE_FEAR',
        scaledHitWeight(min(dominanceHits, panicHits), 3),
        'Dominance language is mixed with panic language in the same move.',
      ));
    }

    if (dominanceHits > 0 && softFailureSignal01(actorState) > 0.45) {
      signals.push(signal(
        'COUNTERFEIT_CALM',
        asScore0To1(clamp01(softFailureSignal01(actorState) * 0.72)),
        'Actor projects command language while state markers imply strain.',
      ));
    }

    if (panicHits > 0 && actorState && actorState.emotion.confidence > 0.72) {
      signals.push(signal(
        'COUNTERFEIT_PANIC',
        asScore0To1(clamp01((panicHits / 5) * 0.55 + Number(actorState.emotion.confidence) * 0.25)),
        'Panic language may be theatrical relative to observed confidence.',
      ));
    }

    if (secrecyHits > 0 && negotiationHasAudiencePressure(negotiation)) {
      signals.push(signal(
        'SECRECY_CONTRADICTION',
        scaledHitWeight(secrecyHits, 4),
        'Secrecy language conflicts with audience-shaped negotiation state.',
      ));
    }

    if (trustHits > 0 && actorState && actorState.emotion.trust < 0.35) {
      signals.push(signal(
        'TRUST_LANGUAGE_LOW_TRUST_OFFER',
        asScore0To1(clamp01(Number(actorState.emotion.trust) * -0.4 + 0.58)),
        'Trust rhetoric exceeds recorded trust posture.',
      ));
    }

    if (proofHits > 0 && !hasEvidenceBackfill(negotiation)) {
      signals.push(signal(
        'PROOF_LANGUAGE_LOW_PROOF_STATE',
        scaledHitWeight(proofHits, 5),
        'Proof language appears stronger than the current proof state.',
      ));
    }

    if (guaranteeHits > 0 && !actorCanCarryGuarantee(actorState)) {
      signals.push(signal(
        'GUARANTEE_LANGUAGE_WEAK_GUARANTEE',
        scaledHitWeight(guaranteeHits, 5),
        'Guarantee rhetoric is stronger than the actor state supports.',
      ));
    }

    if (priorBodies && priorBodies.length > 1 && repeatedNonAnswer(body, priorBodies)) {
      signals.push(signal(
        'REPEATED_NONANSWER',
        asScore0To1(0.54),
        'Current body echoes evasive behavior across recent transcript turns.',
      ));
    }

    if (priorBodies && priorBodies.length > 0 && memoryEvasion(body, priorBodies)) {
      signals.push(signal(
        'MEMORY_EVASION',
        asScore0To1(0.49),
        'Current body avoids previously asserted anchors or commitments.',
      ));
    }

    return signals;
  }

  private scoreOfferSignals(
    offer: ChatOffer | null,
    priorOffer: ChatOffer | null,
    negotiation: ChatNegotiation,
    actorState: NegotiationActorState | null,
  ): BluffSignal[] {
    if (!offer) {
      return [];
    }

    const signals: BluffSignal[] = [];
    const delta = priorOffer ? Math.abs(Number(chatOfferPriceDeltaFromPrior(offer))) : 0;
    const guaranteeStrength = Number(chatOfferGuaranteeStrength(offer));
    const trustProjection = Number(chatOfferProjectedTrustworthiness(offer));
    const hostilityProjection = Number(chatOfferProjectedHostility(offer));
    const softnessProjection = Number(chatOfferProjectedSoftness(offer));
    const concessionCount = chatOfferConcessionCount(offer);

    if (delta > 0.18) {
      signals.push(signal(
        'PRICE_DELTA_SPIKE',
        asScore0To1(clamp01(delta)),
        'Offer price delta exceeds steady negotiation drift.',
        { delta },
      ));
    }

    if (delta > 0.32) {
      signals.push(signal(
        'ANCHOR_SHOCK',
        asScore0To1(clamp01(delta * 0.92)),
        'Offer attempts to shock the anchor with a wide valuation shift.',
      ));
    }

    if (priorOffer && reviseDirectionFlipped(offer, priorOffer)) {
      signals.push(signal(
        'REVISION_BACKTRACK',
        asScore0To1(0.57),
        'Offer path appears to reverse its own declared direction.',
      ));
    }

    if (chatOfferCanLeak(offer) && !negotiationHasLeakThreat(negotiation)) {
      signals.push(signal(
        'LEAK_POSTURE_OVERPLAY',
        asScore0To1(0.51),
        'Leak-ready posture appears stronger than backend leak pressure.',
      ));
    }

    if (chatOfferShouldTriggerHelperReview(offer) && !negotiationSupportsRescue(negotiation)) {
      signals.push(signal(
        'HELPER_SHIELDING',
        asScore0To1(0.43),
        'Offer structure appears to hide behind helper-validation language.',
      ));
    }

    if (trustProjection < 0.35 && concessionCount === 0 && softnessProjection > 0.65) {
      signals.push(signal(
        'SOFT_LANGUAGE_PREDATORY_TERMS',
        asScore0To1(0.52),
        'Soft presentation masks economically predatory underlying terms.',
      ));
    }

    if (hostilityProjection > 0.72 && softnessProjection > 0.6) {
      signals.push(signal(
        'DOMINANCE_LANGUAGE_SOFT_TERMS',
        asScore0To1(0.46),
        'Offer uses soft surface language while projecting hostile outcomes.',
      ));
    }

    if (guaranteeStrength < 0.24 && projectedGuaranteeMask01(offer) > 0.42) {
      signals.push(signal(
        'GUARANTEE_LANGUAGE_WEAK_GUARANTEE',
        asScore0To1(0.58),
        'Offer guarantee presentation exceeds guarantee substance.',
      ));
    }

    if (actorState && actorState.emotion.confidence < 0.28 && hostilityProjection > 0.72) {
      signals.push(signal(
        'COUNTERFEIT_CALM',
        asScore0To1(0.55),
        'Offer hostility exceeds the actor’s backend confidence state.',
      ));
    }

    return signals;
  }

  private scoreStateSignals(
    negotiation: ChatNegotiation,
    actorState: NegotiationActorState | null,
    latestInference?: NegotiationInferenceFrame | null,
    latestLeakThreat?: NegotiationLeakThreat | null,
  ): BluffSignal[] {
    const signals: BluffSignal[] = [];
    const dominantPressure = negotiationInferDominantPressure(latestInference ?? negotiation.latestInference);
    const failure01 = softFailureSignal01(actorState);

    if (negotiationHasAudiencePressure(negotiation) && actorState && (actorState as any).visibilityPreference === 'PRIVATE') {
      signals.push(signal(
        'AUDIENCE_HEAT_PERFORMANCE',
        asScore0To1(0.44),
        'Private preference collides with audience-pressured negotiation state.',
        { dominantPressure },
      ));
    }

    if (latestLeakThreat && Number(latestLeakThreat.severity.normalized) > 0.62 && !negotiationHasLeakThreat(negotiation)) {
      signals.push(signal(
        'LEAK_POSTURE_OVERPLAY',
        asScore0To1(0.48),
        'Transient leak fear appears overstaged relative to ledger leak state.',
      ));
    }

    if (latestInference && Number((latestInference as any).urgency01) > 0.68 && dominantPressure !== 'TIME') {
      signals.push(signal(
        'WINDOW_MISMATCH',
        asScore0To1(0.53),
        'Urgency inference exceeds timing-backed dominant pressure.',
      ));
    }

    if (latestInference && Number(latestInference.risk.rescueNeed) > 0.63 && !negotiationSupportsRescue(negotiation)) {
      signals.push(signal(
        'RESCUE_SIGNAL_OVERPLAY',
        asScore0To1(0.56),
        'Rescue pressure is projected above the negotiation’s rescue support state.',
      ));
    }

    if (failure01 > 0.6 && actorState?.emotion.confidence && Number(actorState.emotion.confidence) > 0.7) {
      signals.push(signal(
        'PUBLIC_CONFIDENCE_PRIVATE_FEAR',
        asScore0To1(0.59),
        'Actor state shows high confidence but broader failure posture suggests strain.',
      ));
    }

    if (failure01 > 0.72 && (actorState as any)?.helpSeeking01 && Number((actorState as any).helpSeeking01) < 0.22) {
      signals.push(signal(
        'COUNTERFEIT_CALM',
        asScore0To1(0.51),
        'Suppressed help-seeking under high strain may represent calm theater.',
      ));
    }

    return signals;
  }

  private scoreEvidenceSignals(
    evidence: readonly NegotiationSignalEvidence[],
    negotiation: ChatNegotiation,
    actorState: NegotiationActorState | null,
  ): BluffSignal[] {
    const signals: BluffSignal[] = [];
    if (!evidence.length) {
      return signals;
    }

    const urgencyEvidence = evidence.filter((item) => String(item.kind).includes('URGENCY')).length;
    const leakEvidence = evidence.filter((item) => String(item.kind).includes('LEAK')).length;
    const rescueEvidence = evidence.filter((item) => String(item.kind).includes('HELPER') || String(item.kind).includes('CHURN')).length;
    const trustEvidence = evidence.filter((item) => String(item.kind).includes('TRUST')).length;

    if (urgencyEvidence > 2 && negotiationInferDominantPressure(negotiation.latestInference) !== 'TIME') {
      signals.push(signal(
        'WINDOW_MISMATCH',
        scaledHitWeight(urgencyEvidence, 6),
        'Signal evidence over-indexes urgency relative to dominant pressure.',
      ));
    }

    if (leakEvidence > 1 && !negotiationHasLeakThreat(negotiation)) {
      signals.push(signal(
        'LEAK_POSTURE_OVERPLAY',
        scaledHitWeight(leakEvidence, 5),
        'Leak evidence is louder than the actual leak-threat ledger.',
      ));
    }

    if (rescueEvidence > 1 && !negotiationSupportsRescue(negotiation)) {
      signals.push(signal(
        'RESCUE_SIGNAL_OVERPLAY',
        scaledHitWeight(rescueEvidence, 5),
        'Rescue-linked evidence exceeds rescue support in the negotiation.',
      ));
    }

    if (trustEvidence > 1 && actorState && actorState.emotion.trust < 0.28) {
      signals.push(signal(
        'TRUST_LANGUAGE_LOW_TRUST_OFFER',
        scaledHitWeight(trustEvidence, 5),
        'Trust-facing evidence conflicts with the actor’s trust posture.',
      ));
    }

    return signals;
  }

  private scoreVisibilitySignals(
    visibilityRead: BluffVisibilityRead,
    negotiation: ChatNegotiation,
    actorState: NegotiationActorState | null,
  ): BluffSignal[] {
    const signals: BluffSignal[] = [];
    const envelope = visibilityRead.envelope;
    if (!envelope) {
      return signals;
    }

    const secrecyPressure = Number(envelope.secrecyPressure ?? asScore0To1(0));
    const audienceHeat = Number(envelope.audienceHeat ?? asScore0To1(0));
    const visibility = visibilityRead.visibility;
    const revealMode = visibilityRead.revealMode;
    const isPrivate = visibility.includes('PRIVATE') || visibility.includes('DIRECT') || visibility.includes('SECRET');
    const isPublic = visibility.includes('PUBLIC') || visibility.includes('GLOBAL') || visibility.includes('ROOM');
    const isHiddenReveal = revealMode.includes('HIDDEN') || revealMode.includes('DELAY') || revealMode.includes('MASK');

    if (isPrivate && negotiationHasAudiencePressure(negotiation) && visibilityRead.witnessCount > 1) {
      signals.push(signal(
        'VISIBILITY_POSTURE_OVERPLAY',
        asScore0To1(clamp01(0.42 + secrecyPressure * 0.3 + audienceHeat * 0.2)),
        'Offer posture claims privacy while witness geometry implies broader observation.',
        {
          visibility,
          revealMode,
          witnessCount: visibilityRead.witnessCount,
        },
      ));
    }

    if (visibilityRead.helperVisible && secrecyPressure > 0.52) {
      signals.push(signal(
        'HELPER_VISIBLE_SECRECY_CONTRADICTION',
        asScore0To1(clamp01(0.36 + secrecyPressure * 0.5)),
        'Helper visibility collides with a secrecy-heavy offer posture.',
      ));
    }

    if (isPublic && isHiddenReveal && negotiationHasAudiencePressure(negotiation)) {
      signals.push(signal(
        'VISIBILITY_POSTURE_OVERPLAY',
        asScore0To1(clamp01(0.38 + audienceHeat * 0.4)),
        'Offer attempts a hidden reveal inside an audience-heated context.',
      ));
    }

    if (actorState && isPrivate && Number(actorState.reputation.witnessHeat) > 0.65) {
      signals.push(signal(
        'ROLE_POSTURE_CONTRADICTION',
        asScore0To1(clamp01(0.31 + Number(actorState.reputation.witnessHeat) * 0.4)),
        'Actor is under strong witness heat while the offer posture insists on privacy.',
      ));
    }

    return signals;
  }

  private scoreConcessionSignals(
    concessionRead: BluffConcessionRead,
    negotiation: ChatNegotiation,
    actorState: NegotiationActorState | null,
    offer: ChatOffer | null,
  ): BluffSignal[] {
    const signals: BluffSignal[] = [];
    if (!concessionRead.count) {
      return signals;
    }

    const trustProjection = offer ? Number(chatOfferProjectedTrustworthiness(offer)) : 0.5;
    const urgencyProjection = offer?.currentVersion?.analytics?.urgency
      ? normalizedOfferScore(offer.currentVersion.analytics.urgency)
      : 0;

    if (concessionRead.count >= 3 && trustProjection < 0.5) {
      signals.push(signal(
        'CONCESSION_STACK_PRESSURE',
        asScore0To1(clamp01(0.34 + concessionRead.count / 8)),
        'Concession count is high enough to resemble pressure theater rather than fair trade.',
        {
          count: concessionRead.count,
          helperRecommendedCount: concessionRead.helperRecommendedCount,
        },
      ));
    }

    if (concessionRead.totalReputationCost >= 12) {
      signals.push(signal(
        'CONCESSION_REPUTATION_BLEED',
        asScore0To1(clamp01(concessionRead.totalReputationCost / 30)),
        'Concessions extract unusual reputation cost for the current move.',
      ));
    }

    if (concessionRead.totalUrgencyCost >= 8 || urgencyProjection > 0.62) {
      signals.push(signal(
        'CONCESSION_URGENCY_BLEED',
        asScore0To1(clamp01(Math.max(concessionRead.totalUrgencyCost / 20, urgencyProjection * 0.8))),
        'Concessions are carrying hidden urgency pressure.',
      ));
    }

    if (concessionRead.helperRecommendedCount > 0 && !negotiationSupportsRescue(negotiation)) {
      signals.push(signal(
        'CONCESSION_HELPER_CRUTCH',
        asScore0To1(clamp01(0.28 + concessionRead.helperRecommendedCount * 0.18)),
        'Offer concessions lean on helper framing without rescue support from the negotiation.',
      ));
    }

    if (
      actorState &&
      concessionRead.totalReputationCost > 0 &&
      Number(actorState.reputation.current) < 40
    ) {
      signals.push(signal(
        'CONCESSION_REPUTATION_BLEED',
        asScore0To1(clamp01(0.3 + concessionRead.totalReputationCost / 24)),
        'Low-reputation actor is spending further reputation inside the concession stack.',
      ));
    }

    return signals;
  }

  private scoreIntentSignals(
    intentRead: BluffIntentRead,
    negotiation: ChatNegotiation,
    actorState: NegotiationActorState | null,
    offer: ChatOffer | null,
  ): BluffSignal[] {
    const signals: BluffSignal[] = [];
    const intent = intentRead.intent;
    if (!intent) {
      return signals;
    }

    const intentKey = String(intent);
    const hostilityProjection = offer ? Number(chatOfferProjectedHostility(offer)) : 0;
    const softnessProjection = offer ? Number(chatOfferProjectedSoftness(offer)) : 0;
    const trustProjection = offer ? Number(chatOfferProjectedTrustworthiness(offer)) : 0;

    if (intentRead.mismatch01 > 0.28) {
      signals.push(signal(
        'INTENT_STATE_MISMATCH',
        intentRead.mismatch01,
        'Negotiation intent and observed state are drifting apart.',
        {
          intent,
          role: actorState?.actor.role ?? null,
        },
      ));
    }

    if (intentRead.counterStress01 > 0.35) {
      signals.push(signal(
        'ACTIVE_ENVELOPE_COUNTER_STRESS',
        intentRead.counterStress01,
        'Active negotiation envelope projects counter-pressure instability.',
      ));
    }

    if (intentRead.faceSavePressure01 > 0.35) {
      signals.push(signal(
        'FACE_SAVE_COUNTER_MASK',
        intentRead.faceSavePressure01,
        'Counter-shape implies face-saving theater rather than transparent bargaining.',
      ));
    }

    if (intentKey === 'FAIR_TRADE' && hostilityProjection > 0.65) {
      signals.push(signal(
        'INTENT_STATE_MISMATCH',
        asScore0To1(clamp01(0.36 + hostilityProjection * 0.4)),
        'Fair-trade intent is contradicted by hostile economic projection.',
      ));
    }

    if (intentKey === 'PRICE_DISCOVERY' && softnessProjection > 0.68 && trustProjection < 0.32) {
      signals.push(signal(
        'INTENT_STATE_MISMATCH',
        asScore0To1(0.49),
        'Price-discovery language may be masking manipulative softness.',
      ));
    }

    if ((intentKey === 'REPUTATION_SIGNAL' || intentKey === 'FACE_SAVE') && actorState) {
      const faceThreat = Number(actorState.reputation.faceThreat ?? asScore0To1(0));
      if (faceThreat < 0.25 && Number(actorState.emotion.confidence) > 0.7) {
        signals.push(signal(
          'AUTHORITY_POSTURE_OVERPLAY',
          asScore0To1(clamp01(0.31 + Number(actorState.emotion.confidence) * 0.4)),
          'Authority/reputation framing appears stronger than the actor’s face-threat reality.',
        ));
      }
    }

    if ((intentKey === 'HELPER_INTERVENTION' || intentKey === 'RESCUE_OVERRIDE') && !negotiationSupportsRescue(negotiation)) {
      signals.push(signal(
        'RESCUE_SIGNAL_OVERPLAY',
        asScore0To1(0.58),
        'Rescue-linked intent appears without backend rescue support.',
      ));
    }

    return signals;
  }

  private buildExploitWindows(input: {
    readonly family: BluffFamily;
    readonly bluffConfidence01: Score0To1;
    readonly contradiction01: number;
    readonly urgencyMask01: number;
    readonly rescueMask01: number;
    readonly leakTheater01: number;
    readonly exploitability01: Score0To1;
    readonly visibilityMask01: number;
    readonly concessionMask01: number;
    readonly intentMismatch01: number;
    readonly negotiation: ChatNegotiation;
    readonly actorState: NegotiationActorState | null;
    readonly offer: ChatOffer | null;
    readonly priorOffer: ChatOffer | null;
    readonly intentRead: BluffIntentRead;
  }): readonly BluffExploitWindow[] {
    const windows: BluffExploitWindow[] = [];
    const exploitability = Number(input.exploitability01);
    const bluff = Number(input.bluffConfidence01);

    if (bluff > this.options.strongBluffThreshold01 && input.contradiction01 > 0.45) {
      windows.push(exploitWindow(
        'HARD_COUNTER',
        clamp01(bluff * 0.92),
        0,
        'Contradictions are strong enough for immediate hard counterplay.',
      ));
    }

    if (input.family === 'LEAK_BAIT' || input.leakTheater01 > this.options.leakTheaterThreshold01) {
      windows.push(exploitWindow(
        'LEAK_PUNISH',
        clamp01(input.leakTheater01 * 0.88),
        350,
        'Leak theater is visible; punish by controlled witness exposure.',
      ));
    }

    if (input.family === 'HELPER_BAIT' || input.family === 'RESCUE_BAIT' || input.rescueMask01 > this.options.rescueMaskThreshold01) {
      windows.push(exploitWindow(
        'RESCUE_DEESCALATE',
        clamp01(input.rescueMask01 * 0.9 + 0.08),
        500,
        'Rescue-signaling appears overstaged; de-escalation may collapse the bluff.',
      ));
      windows.push(exploitWindow(
        'HELPER_INTERCEPT',
        clamp01(input.rescueMask01 * 0.73 + 0.12),
        0,
        'Helper intervention can strip cover from a rescue-linked bluff.',
      ));
    }

    if (input.urgencyMask01 > this.options.urgencyMaskThreshold01) {
      windows.push(exploitWindow(
        'WAIT_AND_WITNESS',
        clamp01(input.urgencyMask01 * 0.87),
        900,
        'Urgency theater becomes easier to punish if the actor is forced to wait.',
      ));
    }

    if (input.visibilityMask01 > 0.42) {
      windows.push(exploitWindow(
        'WAIT_AND_WITNESS',
        clamp01(input.visibilityMask01 * 0.82),
        650,
        'Visibility posture can be stress-tested by forcing additional witnesses or time.',
      ));
    }

    if (input.concessionMask01 > 0.4) {
      windows.push(exploitWindow(
        'SOFT_COUNTER',
        clamp01(input.concessionMask01 * 0.84),
        250,
        'Counter the concession stack by isolating hidden urgency and reputation costs.',
      ));
    }

    if (input.intentMismatch01 > 0.4 || Number(input.intentRead.faceSavePressure01) > 0.4) {
      windows.push(exploitWindow(
        'PROOF_CHALLENGE',
        clamp01(Math.max(input.intentMismatch01, Number(input.intentRead.faceSavePressure01)) * 0.9),
        0,
        'Intent drift is high enough to challenge with role, proof, or face-saving pressure.',
      ));
    }

    if (input.family === 'ANCHOR_TRAP' || Number(input.offer ? chatOfferPriceDeltaFromPrior(input.offer) : 0) > 0.2) {
      windows.push(exploitWindow(
        'ANCHOR_RESET',
        clamp01(exploitability * 0.82 + 0.05),
        0,
        'Anchor can be reset because price movement appears performative.',
      ));
    }

    if (input.offer && projectedGuaranteeMask01(input.offer) > 0.38) {
      windows.push(exploitWindow(
        'PROOF_CHALLENGE',
        clamp01(projectedGuaranteeMask01(input.offer) * 0.95),
        0,
        'Guarantee/proof posture is challengeable without taking the bait.',
      ));
    }

    if (!windows.length) {
      windows.push(exploitWindow(
        'SOFT_COUNTER',
        clamp01(exploitability * 0.68 + 0.1),
        250,
        'Use a measured counter while preserving optionality.',
      ));
    }

    return dedupeExploitWindows(windows);
  }

  private recordAnalysis(analysis: BluffAnalysis): void {
    const roomKey = String(analysis.roomId);
    const ledger = this.ensureRoomLedger(roomKey);

    ledger.analyses.push(analysis);
    trimMutableList(ledger.analyses, this.options.retainAnalysesPerRoom);

    const bucket = ledger.byNegotiation.get(analysis.negotiationId) ?? [];
    bucket.push(analysis);
    trimMutableList(bucket, this.options.retainAnalysesPerRoom);
    ledger.byNegotiation.set(analysis.negotiationId, bucket);

    ledger.lastUpdatedAt = analysis.analyzedAt;
  }

  private ensureRoomLedger(roomKey: string): MutableBluffLedger {
    let ledger = this.roomLedgers.get(roomKey);
    if (!ledger) {
      ledger = {
        analyses: [],
        byNegotiation: new Map(),
        lastUpdatedAt: undefined,
      };
      this.roomLedgers.set(roomKey, ledger);
    }
    return ledger;
  }
}

// ============================================================================
// MARK: Factory + module
// ============================================================================

export function createBluffResolver(options: BluffResolverOptions = {}): BluffResolver {
  return new BluffResolver(options);
}

export const ChatBluffResolverModule = {
  moduleId: 'backend.chat.dealroom.BluffResolver',
  create: createBluffResolver,
  BluffResolver,
} as const;

// ============================================================================
// MARK: Mutable ledgers
// ============================================================================

interface MutableBluffLedger {
  analyses: BluffAnalysis[];
  byNegotiation: Map<string, BluffAnalysis[]>;
  lastUpdatedAt?: UnixMs;
}

// ============================================================================
// MARK: Helper scoring
// ============================================================================

const URGENCY_WORDS = new Set([
  'now', 'immediately', 'today', 'urgent', 'quick', 'asap', 'deadline',
  'final', 'last', 'expires', 'closing', 'ending', 'window',
]);
const SCARCITY_WORDS = new Set([
  'only', 'rare', 'limited', 'last', 'one', 'single', 'exclusive', 'gone',
  'disappear', 'scarce', 'shortage',
]);
const DOMINANCE_WORDS = new Set([
  'control', 'own', 'dominate', 'command', 'nonnegotiable', 'final',
  'take', 'leave', 'must', 'decide', 'power',
]);
const TRUST_WORDS = new Set([
  'trust', 'honest', 'fair', 'straight', 'solid', 'good-faith', 'clean',
  'promise', 'reliable',
]);
const PROOF_WORDS = new Set([
  'proof', 'receipt', 'verify', 'hash', 'ledger', 'guarantee', 'trace',
  'audit', 'record',
]);
const PANIC_WORDS = new Set([
  'need', 'desperate', 'please', 'cannot', 'stuck', 'must', 'forced',
  'panic', 'crash', 'save',
]);
const CALM_WORDS = new Set([
  'calm', 'relaxed', 'easy', 'simple', 'nothing', 'fine', 'steady',
  'comfortable',
]);
const SECRECY_WORDS = new Set([
  'private', 'quiet', 'between', 'us', 'off-record', 'hidden', 'secret',
  'whisper',
]);
const GUARANTEE_WORDS = new Set([
  'guarantee', 'assure', 'promise', 'locked', 'certain', 'secured',
  'insured',
]);

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]/g, ' ')
    .split(/\s+/g)
    .filter(Boolean);
}

function normalizeBody(body?: string | null): string {
  return String(body ?? '').trim();
}

function countUrgencyLexicon(tokens: readonly string[]): number {
  return countHits(tokens, URGENCY_WORDS);
}

function countScarcityLexicon(tokens: readonly string[]): number {
  return countHits(tokens, SCARCITY_WORDS);
}

function countDominanceLexicon(tokens: readonly string[]): number {
  return countHits(tokens, DOMINANCE_WORDS);
}

function countTrustLexicon(tokens: readonly string[]): number {
  return countHits(tokens, TRUST_WORDS);
}

function countProofLexicon(tokens: readonly string[]): number {
  return countHits(tokens, PROOF_WORDS);
}

function countPanicLexicon(tokens: readonly string[]): number {
  return countHits(tokens, PANIC_WORDS);
}

function countCalmLexicon(tokens: readonly string[]): number {
  return countHits(tokens, CALM_WORDS);
}

function countSecrecyLexicon(tokens: readonly string[]): number {
  return countHits(tokens, SECRECY_WORDS);
}

function countGuaranteeLexicon(tokens: readonly string[]): number {
  return countHits(tokens, GUARANTEE_WORDS);
}

function countHits(tokens: readonly string[], lexicon: ReadonlySet<string>): number {
  let hits = 0;
  for (const token of tokens) {
    if (lexicon.has(token)) hits += 1;
  }
  return hits;
}

function sampleMatchingTokens(tokens: readonly string[], lexicon: ReadonlySet<string>): readonly string[] {
  const result: string[] = [];
  for (const token of tokens) {
    if (lexicon.has(token) && !result.includes(token)) {
      result.push(token);
      if (result.length >= 6) break;
    }
  }
  return result;
}

function scaledHitWeight(hits: number, divisor: number): Score0To1 {
  return asScore0To1(clamp01(hits / Math.max(1, divisor)));
}

function signal(
  code: BluffSignalCode,
  weight01: Score0To1,
  detail: string,
  evidence?: JsonValue,
): BluffSignal {
  return {
    code,
    weight01,
    detail,
    evidence,
  };
}

function exploitWindow(
  kind: BluffExploitWindow['kind'],
  confidence01: number,
  recommendedDelayMs: number,
  rationale: string,
): BluffExploitWindow {
  return {
    kind,
    confidence01: asScore0To1(clamp01(confidence01)),
    recommendedDelayMs,
    rationale,
  };
}

function resolveActorState(
  negotiation: ChatNegotiation,
  actorId?: string | null,
): NegotiationActorState | null {
  const primaryResolved = resolvePrimaryActorStateFromNegotiation(negotiation, actorId);
  if (primaryResolved) {
    return primaryResolved;
  }
  if (!actorId) {
    return resolvePrimaryActorStateFromNegotiation(
      negotiation,
      negotiation.parties.primary.actorId as unknown as string,
    ) ?? negotiation.actorStates[0] ?? null;
  }
  const states: readonly NegotiationActorState[] = negotiation.actorStates;
  return states.find((state) => String(state.actor.actorId) === String(actorId)) ?? negotiation.actorStates[0] ?? null;
}

function resolvePrimaryActorStateFromNegotiation(
  negotiation: ChatNegotiation,
  actorId?: string | null,
): NegotiationActorState | undefined {
  if (!actorId) {
    return undefined;
  }
  return negotiationPrimaryActorState(
    negotiation,
    actorId as Parameters<typeof negotiationPrimaryActorState>[1],
  );
}

function resolveNegotiationOfferEnvelope(
  negotiation: ChatNegotiation,
): NegotiationOfferEnvelope | null {
  return negotiation.activeOffer ?? negotiation.scene.currentOffer ?? null;
}

function resolveAnalysisActorRef(
  negotiation: ChatNegotiation,
  actorState: NegotiationActorState | null,
  envelope: NegotiationOfferEnvelope | null,
  requestedActorId?: string | null,
): NegotiationActorRef | null {
  if (actorState?.actor) {
    return actorState.actor;
  }
  if (requestedActorId) {
    if (String(negotiation.parties.primary.actorId) === String(requestedActorId)) {
      return negotiation.parties.primary;
    }
    if (String(negotiation.parties.counterparty.actorId) === String(requestedActorId)) {
      return negotiation.parties.counterparty;
    }
    if (envelope?.offeredBy && String(envelope.offeredBy.actorId) === String(requestedActorId)) {
      return envelope.offeredBy;
    }
    if (envelope?.offeredTo && String(envelope.offeredTo.actorId) === String(requestedActorId)) {
      return envelope.offeredTo;
    }
  }
  return envelope?.offeredBy ?? negotiation.parties.primary ?? negotiation.parties.counterparty ?? null;
}

function buildActorRead(
  actorRef: NegotiationActorRef | null,
  actorState: NegotiationActorState | null,
): BluffActorRead {
  const authorityMask01 = actorRef
    ? clamp01(
      roleAuthorityBias(actorRef) * 0.45 +
      Number(actorState?.leverage ?? asScore0To1(0.45)) * 0.2 +
      Number(actorState?.emotion.confidence ?? asScore0To1(0.45)) * 0.15 +
      Number(actorState?.reputation.current ?? asScore0To100(45)) / 100 * 0.2,
    )
    : 0.22;

  return {
    actor: actorRef,
    role: actorRef ? String(actorRef.role) : 'UNKNOWN',
    actorKind: actorRef ? String(actorRef.actorKind) : 'UNKNOWN',
    authorityMask01: asScore0To1(authorityMask01),
    reputation100: actorState
      ? asScore0To100(clamp100(Number(actorState.reputation.current)))
      : asScore0To100(45),
    leverage01: actorState?.leverage ?? asScore0To1(0.45),
    patience01: actorState?.patience ?? asScore0To1(0.45),
  };
}

function buildVisibilityRead(
  offer: ChatOffer | null,
  negotiation: ChatNegotiation,
  actorState: NegotiationActorState | null,
): BluffVisibilityRead {
  const envelope = resolveOfferVisibilityEnvelope(offer);
  if (!envelope) {
    return {
      envelope: null,
      visibility: 'UNKNOWN',
      revealMode: 'UNKNOWN',
      witnessCount: 0,
      helperVisible: false,
      visibilityMask01: asScore0To1(0),
    };
  }

  const witnessCount = envelope.witnessCount ?? 0;
  const secrecyPressure = Number(envelope.secrecyPressure ?? asScore0To1(0));
  const audienceHeat = Number(envelope.audienceHeat ?? asScore0To1(0));
  const visibility = String(envelope.visibility).toUpperCase();
  const revealMode = String(envelope.revealMode).toUpperCase();
  const visibilityMask01 = clamp01(
    (visibility.includes('PRIVATE') && negotiationHasAudiencePressure(negotiation) ? 0.26 : 0) +
    (envelope.helperVisible && secrecyPressure > 0.5 ? 0.24 : 0) +
    (witnessCount >= 3 ? 0.1 : 0) +
    audienceHeat * 0.2 +
    secrecyPressure * 0.2 +
    (actorState && Number(actorState.reputation.witnessHeat) > 0.65 && visibility.includes('PRIVATE') ? 0.12 : 0),
  );

  return {
    envelope,
    visibility,
    revealMode,
    witnessCount,
    helperVisible: envelope.helperVisible,
    visibilityMask01: asScore0To1(visibilityMask01),
  };
}

function buildConcessionRead(
  offer: ChatOffer | null,
  negotiation: ChatNegotiation,
  actorState: NegotiationActorState | null,
): BluffConcessionRead {
  const concessions = extractOfferConcessions(offer);
  const helperRecommendedCount = concessions.filter((entry) => Boolean(entry.helperRecommended)).length;
  const totalUrgencyCost = concessions.reduce((sum, entry) => sum + Number(entry.urgencyCost ?? 0), 0);
  const totalReputationCost = concessions.reduce((sum, entry) => sum + Number(entry.reputationCost ?? 0), 0);
  const aggregateValueDelta = concessions.reduce((sum, entry) => sum + Math.abs(Number(entry.valueDelta ?? 0)), 0);
  const rescueBias = negotiationSupportsRescue(negotiation) ? 0.05 : 0;
  const concessionMask01 = clamp01(
    (concessions.length >= 3 ? 0.25 : concessions.length * 0.06) +
    clamp01(totalUrgencyCost / 20) * 0.25 +
    clamp01(totalReputationCost / 25) * 0.25 +
    clamp01(aggregateValueDelta / 1000) * 0.1 +
    clamp01(helperRecommendedCount / 3) * 0.1 -
    rescueBias +
    (actorState && Number(actorState.reputation.current) < 40 ? 0.05 : 0),
  );

  return {
    concessions,
    count: concessions.length,
    helperRecommendedCount,
    totalUrgencyCost,
    totalReputationCost,
    aggregateValueDelta,
    concessionMask01: asScore0To1(concessionMask01),
  };
}

function buildIntentRead(
  negotiation: ChatNegotiation,
  envelope: NegotiationOfferEnvelope | null,
  actorState: NegotiationActorState | null,
  offer: ChatOffer | null,
): BluffIntentRead {
  const intent: NegotiationIntent | null = envelope?.vector.intent ?? negotiation.latestInference?.inferredIntent ?? null;
  const counterStress01 = envelope?.counterShape
    ? clamp01(
      Number(envelope.counterShape.counterDistance) * 0.6 +
      (envelope.counterShape.hardReversal ? 0.24 : 0) +
      (envelope.counterShape.softLanding ? 0.06 : 0) +
      (envelope.counterShape.faceSaving ? 0.1 : 0),
    )
    : 0;
  const faceSavePressure01 = envelope?.counterShape?.faceSaving
    ? clamp01(counterStress01 * 0.72 + Number(actorState?.reputation.faceThreat ?? asScore0To1(0.15)) * 0.28)
    : 0;

  let mismatch01 = 0;
  if (intent) {
    mismatch01 = inferIntentMismatch01(intent, actorState, offer, envelope, negotiation);
  }

  return {
    intent,
    envelope,
    mismatch01: asScore0To1(mismatch01),
    faceSavePressure01: asScore0To1(faceSavePressure01),
    counterStress01: asScore0To1(counterStress01),
  };
}

function resolveOfferVisibilityEnvelope(
  offer: ChatOffer | null,
): ChatOfferVisibilityEnvelope | null {
  return offer?.visibility ?? null;
}

function extractOfferConcessions(
  offer: ChatOffer | null,
): readonly ChatOfferConcession[] {
  return offer?.currentVersion?.concessions ?? [];
}

function roleAuthorityBias(actorRef: NegotiationActorRef): number {
  const role = String(actorRef.role).toUpperCase();
  if (role.includes('PRIMARY')) return 0.88;
  if (role.includes('SELLER') || role.includes('BUYER')) return 0.72;
  if (role.includes('BROKER') || role.includes('MEDIATOR')) return 0.64;
  if (role.includes('WITNESS') || role.includes('AUDIENCE')) return 0.38;
  return 0.5;
}

function inferIntentMismatch01(
  intent: NegotiationIntent,
  actorState: NegotiationActorState | null,
  offer: ChatOffer | null,
  envelope: NegotiationOfferEnvelope | null,
  negotiation: ChatNegotiation,
): number {
  const intentKey = String(intent);
  const hostility = offer ? Number(chatOfferProjectedHostility(offer)) : 0;
  const softness = offer ? Number(chatOfferProjectedSoftness(offer)) : 0;
  const trust = offer ? Number(chatOfferProjectedTrustworthiness(offer)) : 0;
  const confidence = Number(actorState?.emotion.confidence ?? asScore0To1(0.45));
  const urgency = Number(actorState?.urgencySignal ?? asScore0To1(0.25));
  const bluffFrequency = Number(actorState?.bluffFrequency ?? asScore0To1(0.2));
  const leakRisk = Number(actorState?.reputation.leakRisk ?? asScore0To1(0.15));
  const faceThreat = Number(actorState?.reputation.faceThreat ?? asScore0To1(0.15));

  if (intentKey === 'FAIR_TRADE') {
    return clamp01(hostility * 0.45 + (1 - trust) * 0.35 + bluffFrequency * 0.2);
  }
  if (intentKey === 'VALUE_EXTRACT') {
    return clamp01(softness * 0.25 + trust * 0.15);
  }
  if (intentKey === 'PRICE_DISCOVERY') {
    return clamp01((softness > 0.68 && trust < 0.35 ? 0.42 : 0.1) + bluffFrequency * 0.25);
  }
  if (intentKey === 'LIQUIDATION' || intentKey === 'PANIC_EXIT') {
    return clamp01(confidence * 0.35 + (1 - urgency) * 0.25 + Number(actorState?.walkAwayLikelihood ?? asScore0To1(0.2)) * 0.2);
  }
  if (intentKey === 'DELAY') {
    return clamp01(urgency * 0.45 + hostility * 0.15 + (envelope?.counterShape?.hardReversal ? 0.18 : 0));
  }
  if (intentKey === 'FACE_SAVE') {
    return clamp01((1 - faceThreat) * 0.4 + confidence * 0.2 + (envelope?.counterShape?.faceSaving ? 0 : 0.2));
  }
  if (intentKey === 'REPUTATION_SIGNAL') {
    return clamp01((1 - faceThreat) * 0.35 + trust * 0.1 + confidence * 0.2);
  }
  if (intentKey === 'HELPER_INTERVENTION' || intentKey === 'RESCUE_OVERRIDE') {
    return clamp01((negotiationSupportsRescue(negotiation) ? 0.05 : 0.4) + confidence * 0.1);
  }
  if (intentKey === 'BLUFF' || intentKey === 'BAIT' || intentKey === 'TRAP') {
    return clamp01((1 - bluffFrequency) * 0.2 + trust * 0.15 + softness * 0.15);
  }
  if (intentKey === 'REPUTATION_SIGNAL') {
    return clamp01((1 - faceThreat) * 0.35 + confidence * 0.2);
  }
  if (intentKey === 'HELPER_INTERVENTION') {
    return clamp01((negotiationSupportsRescue(negotiation) ? 0.05 : 0.4) + leakRisk * 0.15);
  }
  return clamp01(bluffFrequency * 0.2 + hostility * 0.12 + leakRisk * 0.1);
}

function deriveProbableBluff(
  bluffConfidence01: Score0To1,
  offer: ChatOffer | null,
  negotiation: ChatNegotiation,
  envelope: NegotiationOfferEnvelope | null,
  intentRead: BluffIntentRead,
): Probability {
  const offerAnalyticsLikelihood = offer?.currentVersion?.analytics?.bluffLikelihood;
  const inferenceLikelihood = negotiation.latestInference?.risk?.bluffLikelihood;
  const offerProbability = offerAnalyticsLikelihood != null ? Number(offerAnalyticsLikelihood) : Number(bluffConfidence01);
  const inferenceProbability = inferenceLikelihood != null ? Number(inferenceLikelihood) : Number(bluffConfidence01);
  const intentBias = intentRead.intent && ['BLUFF', 'BAIT', 'TRAP', 'PRICE_DISCOVERY'].includes(String(intentRead.intent))
    ? 0.08
    : 0;
  const counterBias = envelope?.counterShape
    ? Number(intentRead.counterStress01) * 0.12
    : 0;

  return asProbability(
    clamp01(
      Number(bluffConfidence01) * 0.54 +
      offerProbability * 0.2 +
      inferenceProbability * 0.18 +
      intentBias +
      counterBias,
    ),
  );
}

function score01To100(value: Score0To1): Score0To100 {
  return asScore0To100(clamp100(Number(value) * 100));
}

function softFailureSignal01(actorState: NegotiationActorState | null): number {
  if (!actorState) return 0.25;
  return clamp01(
    (1 - Number(actorState.emotion.confidence ?? asScore0To1(0.5))) * 0.42 +
      Number((actorState as any).fatigue01 ?? asScore0To1(0.2)) * 0.28 +
      Number((actorState as any).helpSeeking01 ?? asScore0To1(0.1)) * 0.18 +
      Number(actorState.emotion.frustration ?? asScore0To1(0.1)) * 0.12,
  );
}

function scoreDominantPressure(
  negotiation: ChatNegotiation,
  actorState: NegotiationActorState | null,
  offer: ChatOffer | null,
  priorOffer: ChatOffer | null,
  envelope?: NegotiationOfferEnvelope | null,
): string {
  const enginePressure = negotiationInferDominantPressure(negotiation.latestInference);
  const delta = offer ? Math.abs(Number(chatOfferPriceDeltaFromPrior(offer))) : 0;
  const intent = envelope?.vector.intent ? String(envelope.vector.intent) : '';
  if (delta > 0.18) return 'PRICE';
  if (intent === 'LIQUIDATION' || intent === 'PANIC_EXIT') return 'EXIT';
  if (intent === 'HELPER_INTERVENTION' || intent === 'RESCUE_OVERRIDE') return 'RESCUE';
  if (negotiationHasAudiencePressure(negotiation)) return 'AUDIENCE';
  if (negotiationHasLeakThreat(negotiation)) return 'LEAK';
  if (actorState && Number((actorState as any).helpSeeking01 ?? asScore0To1(0)) > 0.45) return 'RESCUE';
  if (priorOffer && reviseDirectionFlipped(offer ?? priorOffer, priorOffer)) return 'REVERSAL';
  return enginePressure;
}

function weightedAverage01(signals: readonly BluffSignal[]): number {
  if (!signals.length) return 0;
  let total = 0;
  for (const entry of signals) total += Number(entry.weight01);
  return clamp01(total / signals.length);
}

function normalizedSignalDensity(signals: readonly BluffSignal[]): number {
  return clamp01(signals.length / 10);
}

function normalizedOfferScore(
  value?: { readonly normalized?: Score0To1 } | null,
): number {
  return clamp01(Number(value?.normalized ?? asScore0To1(0)));
}

function clamp100(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function projectedGuaranteeMask01(offer: ChatOffer): number {
  const guarantees = offer.currentVersion?.guarantees ?? [];
  const guaranteeCount = guarantees.length;
  const guaranteeStrengthAverage = guaranteeCount
    ? guarantees.reduce((sum, entry) => sum + normalizedOfferScore(entry.strength), 0) / guaranteeCount
    : Number(chatOfferGuaranteeStrength(offer));
  return clamp01((guaranteeCount / 4) * 0.45 + (1 - guaranteeStrengthAverage) * 0.55);
}

function hasActiveDeadlineWindow(negotiation: ChatNegotiation, priorOffer: ChatOffer | null): boolean {
  const now = Date.now();
  const activeWindow = negotiation.activeWindow ?? negotiation.scene.activeWindow;
  const priorWindow = priorOffer?.window ?? null;
  return Boolean(
    (activeWindow && Number(activeWindow.closesAt ?? asOfferUnixMs(0)) > now) ||
    (priorWindow && Number(priorWindow.closesAt ?? asOfferUnixMs(0)) > now),
  );
}

function supportsScarcityClaim(
  negotiation: ChatNegotiation,
  actorState: NegotiationActorState | null,
): boolean {
  if (negotiationHasAudiencePressure(negotiation)) return true;
  if (negotiationHasLeakThreat(negotiation)) return true;
  if (actorState && Number((actorState as any).inventoryTightness01 ?? asScore0To1(0)) > 0.58) return true;
  if (actorState && Number(actorState.walkAwayLikelihood ?? asScore0To1(0)) > 0.62) return true;
  return false;
}

function hasEvidenceBackfill(negotiation: ChatNegotiation): boolean {
  const sceneBeats = negotiation.scene?.beats ?? [];
  const inferenceSignals = negotiation.latestInference?.signals ?? [];
  return sceneBeats.length > 0 || inferenceSignals.length > 0;
}

function actorCanCarryGuarantee(actorState: NegotiationActorState | null): boolean {
  if (!actorState) return false;
  return Number(actorState.emotion.trust ?? asScore0To1(0)) > 0.52 ||
    Number(actorState.reputation.current ?? asScore0To100(0)) > 58;
}

function repeatedNonAnswer(currentBody: string, priorBodies: readonly string[]): boolean {
  const key = signature(currentBody);
  let repeats = 0;
  for (const body of priorBodies) {
    if (signature(body) === key) repeats += 1;
  }
  return repeats >= 2;
}

function memoryEvasion(currentBody: string, priorBodies: readonly string[]): boolean {
  const currentTokens = new Set(tokenize(currentBody));
  const priorAnchorWords = new Set<string>();
  for (const body of priorBodies.slice(-3)) {
    for (const token of tokenize(body)) {
      if (token.length >= 6) priorAnchorWords.add(token);
    }
  }
  let overlap = 0;
  for (const token of currentTokens) {
    if (priorAnchorWords.has(token)) overlap += 1;
  }
  return priorAnchorWords.size > 0 && overlap / priorAnchorWords.size < 0.1;
}

function signature(value: string): string {
  return tokenize(value).slice(0, 12).join('|');
}

function reviseDirectionFlipped(current: ChatOffer, prior: ChatOffer): boolean {
  const currentProjection = Number(chatOfferProjectedHostility(current)) - Number(chatOfferProjectedSoftness(current));
  const priorProjection = Number(chatOfferProjectedHostility(prior)) - Number(chatOfferProjectedSoftness(prior));
  return Math.sign(currentProjection || 0) !== Math.sign(priorProjection || 0);
}

function determineBluffFamily(input: {
  readonly contradiction01: number;
  readonly urgencyMask01: number;
  readonly rescueMask01: number;
  readonly leakTheater01: number;
  readonly confidenceMask01: number;
  readonly anchorManipulation01: number;
  readonly helperBait01: number;
  readonly proofMask01: number;
  readonly visibilityMask01: number;
  readonly concessionMask01: number;
  readonly intentMismatch01: number;
  readonly actorAuthorityMask01: number;
  readonly intentRead: BluffIntentRead;
  readonly signals: readonly BluffSignal[];
}): BluffFamily {
  const maxSignal = Math.max(
    input.contradiction01,
    input.urgencyMask01,
    input.rescueMask01,
    input.leakTheater01,
    input.confidenceMask01,
    input.anchorManipulation01,
    input.helperBait01,
    input.proofMask01,
    input.visibilityMask01,
    input.concessionMask01,
    input.intentMismatch01,
    input.actorAuthorityMask01,
  );
  if (maxSignal < 0.24) return 'NONE';
  if (input.visibilityMask01 >= maxSignal && input.visibilityMask01 > 0.38) return 'VISIBILITY_FAKE';
  if (input.leakTheater01 >= maxSignal && input.leakTheater01 > 0.42) return 'LEAK_BAIT';
  if (input.rescueMask01 >= maxSignal && input.helperBait01 > 0.32) return 'RESCUE_BAIT';
  if (input.helperBait01 >= maxSignal) return 'HELPER_BAIT';
  if (input.anchorManipulation01 >= maxSignal) return 'ANCHOR_TRAP';
  if (input.intentMismatch01 >= maxSignal && String(input.intentRead.intent ?? '') === 'FACE_SAVE') return 'FACE_SAVE_MASK';
  if (input.intentMismatch01 >= maxSignal && input.actorAuthorityMask01 > 0.42) return 'AUTHORITY_FAKE';
  if (input.concessionMask01 >= maxSignal && input.concessionMask01 > 0.45) return 'COLLAPSE_MASK';
  if (input.urgencyMask01 >= maxSignal) return 'URGENCY_FAKE';
  if (input.proofMask01 >= maxSignal) return 'PROOF_MASK';
  if (input.confidenceMask01 >= maxSignal) return 'CONFIDENCE_MASK';
  if (input.contradiction01 > 0.55 && (input.urgencyMask01 > 0.45 || input.visibilityMask01 > 0.35 || input.intentMismatch01 > 0.35)) {
    return 'MULTI_LAYER';
  }
  return 'PRICE_FAKE';
}

function dedupeExploitWindows(windows: readonly BluffExploitWindow[]): readonly BluffExploitWindow[] {
  const seen = new Set<string>();
  const result: BluffExploitWindow[] = [];
  for (const item of windows) {
    const key = `${item.kind}|${Math.round(Number(item.confidence01) * 100)}|${item.recommendedDelayMs}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result.sort((a, b) => Number(b.confidence01) - Number(a.confidence01));
}

function createAnalysisId(negotiationId: unknown, actorId: unknown, now: UnixMs): string {
  return `bluff:${String(negotiationId)}:${String(actorId ?? 'unknown')}:${String(now)}`;
}

interface NegotiationWindowLike {
  readonly expired?: boolean;
  readonly closed?: boolean;
}

function trimMutableList<T>(list: T[], max: number): void {
  if (list.length <= max) return;
  list.splice(0, list.length - max);
}

function freezeBluffLedger(ledger: MutableBluffLedger): BluffResolverLedger {
  const byNegotiation: Record<string, readonly BluffAnalysis[]> = {};
  for (const [key, value] of ledger.byNegotiation.entries()) {
    byNegotiation[key] = [...value];
  }
  return {
    roomId: String((ledger.analyses[0]?.roomId ?? '')) as ChatRoomId,
    analyses: [...ledger.analyses],
    byNegotiation,
    lastUpdatedAt: ledger.lastUpdatedAt,
  };
}

function min(a: number, b: number): number {
  return a < b ? a : b;
}
