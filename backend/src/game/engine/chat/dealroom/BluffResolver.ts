
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
  | 'RIVAL_WITNESS_PLAY';

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
  readonly truthfulnessProjection01: Score0To1;
  readonly exploitability01: Score0To1;
  readonly dominantPressure: string;
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
    const actorState = request.actorState ?? resolveActorState(negotiation, request.actorId);
    const body = normalizeBody(request.body);
    const offer = request.offer ?? null;
    const priorOffer = request.priorOffer ?? null;
    const signals: BluffSignal[] = [];

    const pressure = scoreDominantPressure(negotiation, actorState, offer, priorOffer);
    const textSignals = this.scoreTextSignals(body, negotiation, actorState, priorOffer, request.priorBodies);
    const offerSignals = this.scoreOfferSignals(offer, priorOffer, negotiation, actorState);
    const stateSignals = this.scoreStateSignals(negotiation, actorState, request.latestInference, request.latestLeakThreat);
    const evidenceSignals = this.scoreEvidenceSignals(request.evidence ?? [], negotiation, actorState);

    signals.push(...textSignals, ...offerSignals, ...stateSignals, ...evidenceSignals);

    const contradiction01 = weightedAverage01(
      signals.filter((signal) =>
        signal.code === 'SECRECY_CONTRADICTION' ||
        signal.code === 'PUBLIC_CONFIDENCE_PRIVATE_FEAR' ||
        signal.code === 'TRUST_LANGUAGE_LOW_TRUST_OFFER' ||
        signal.code === 'PROOF_LANGUAGE_LOW_PROOF_STATE' ||
        signal.code === 'GUARANTEE_LANGUAGE_WEAK_GUARANTEE' ||
        signal.code === 'DOMINANCE_LANGUAGE_SOFT_TERMS' ||
        signal.code === 'SOFT_LANGUAGE_PREDATORY_TERMS',
      ),
    );

    const urgencyMask01 = weightedAverage01(
      signals.filter((signal) =>
        signal.code === 'MESSAGE_URGENCY_SPIKE' ||
        signal.code === 'DEADLINE_LANGUAGE_NO_DEADLINE' ||
        signal.code === 'WINDOW_MISMATCH',
      ),
    );

    const rescueMask01 = weightedAverage01(
      signals.filter((signal) =>
        signal.code === 'RESCUE_SIGNAL_OVERPLAY' ||
        signal.code === 'HELPER_SHIELDING',
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
        signal.code === 'PUBLIC_CONFIDENCE_PRIVATE_FEAR',
      ),
    );

    const anchorManipulation01 = weightedAverage01(
      signals.filter((signal) =>
        signal.code === 'ANCHOR_SHOCK' || signal.code === 'REVISION_BACKTRACK',
      ),
    );

    const helperBait01 = weightedAverage01(
      signals.filter((signal) =>
        signal.code === 'HELPER_SHIELDING' || signal.code === 'RESCUE_SIGNAL_OVERPLAY',
      ),
    );

    const proofMask01 = weightedAverage01(
      signals.filter((signal) =>
        signal.code === 'PROOF_LANGUAGE_LOW_PROOF_STATE' ||
        signal.code === 'GUARANTEE_LANGUAGE_WEAK_GUARANTEE',
      ),
    );

    const bluffConfidence01 = asScore0To1(
      clamp01(
        contradiction01 * 0.18 +
          urgencyMask01 * 0.13 +
          rescueMask01 * 0.11 +
          leakTheater01 * 0.12 +
          confidenceMask01 * 0.1 +
          anchorManipulation01 * 0.13 +
          helperBait01 * 0.08 +
          proofMask01 * 0.08 +
          normalizedSignalDensity(signals) * 0.07,
      ),
    );

    const truthfulnessProjection01 = asScore0To1(clamp01(1 - bluffConfidence01));
    const exploitability01 = asScore0To1(
      clamp01(
        contradiction01 * 0.24 +
          anchorManipulation01 * 0.17 +
          leakTheater01 * 0.14 +
          urgencyMask01 * 0.15 +
          helperBait01 * 0.07 +
          proofMask01 * 0.08 +
          softFailureSignal01(actorState) * 0.15,
      ),
    );

    const family = determineBluffFamily({
      contradiction01,
      urgencyMask01,
      rescueMask01,
      leakTheater01,
      confidenceMask01,
      anchorManipulation01,
      helperBait01,
      proofMask01,
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
      negotiation,
      actorState,
      offer,
      priorOffer,
    });

    const analysis: BluffAnalysis = {
      analysisId: createAnalysisId(negotiation.negotiationId, actorState?.actor.actorId, now),
      roomId: request.roomId,
      negotiationId: String(negotiation.negotiationId),
      actorId: actorState?.actor.actorId ? String(actorState.actor.actorId) : request.actorId ?? undefined,
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
      truthfulnessProjection01,
      exploitability01,
      dominantPressure: pressure,
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
      contradiction01,
      urgencyMask01,
      leakTheater01,
      rescueMask01,
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

  private buildExploitWindows(input: {
    readonly family: BluffFamily;
    readonly bluffConfidence01: Score0To1;
    readonly contradiction01: number;
    readonly urgencyMask01: number;
    readonly rescueMask01: number;
    readonly leakTheater01: number;
    readonly exploitability01: Score0To1;
    readonly negotiation: ChatNegotiation;
    readonly actorState: NegotiationActorState | null;
    readonly offer: ChatOffer | null;
    readonly priorOffer: ChatOffer | null;
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
  if (!actorId) {
    return negotiation.actorStates[0] ?? null;
  }
  const states: readonly NegotiationActorState[] = negotiation.actorStates;
  return states.find((state) => String(state.actor.actorId) === String(actorId)) ?? negotiation.actorStates[0] ?? null;
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
): string {
  const enginePressure = negotiationInferDominantPressure(negotiation.latestInference);
  const delta = offer ? Math.abs(Number(chatOfferPriceDeltaFromPrior(offer))) : 0;
  if (delta > 0.18) return 'PRICE';
  if (negotiationHasAudiencePressure(negotiation)) return 'AUDIENCE';
  if (negotiationHasLeakThreat(negotiation)) return 'LEAK';
  if (actorState && Number((actorState as any).helpSeeking01 ?? asScore0To1(0)) > 0.45) return 'RESCUE';
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

function projectedGuaranteeMask01(offer: ChatOffer): number {
  const strength = Number(chatOfferGuaranteeStrength(offer));
  const guaranteeCount = Array.isArray((offer as { guarantees?: unknown }).guarantees)
    ? ((offer as { guarantees?: ChatOfferGuarantee[] }).guarantees ?? []).length
    : 0;
  return clamp01((guaranteeCount / 4) * 0.55 + (1 - strength) * 0.45);
}

function hasActiveDeadlineWindow(negotiation: ChatNegotiation, priorOffer: ChatOffer | null): boolean {
  const windows = Array.isArray((negotiation as { windows?: unknown }).windows)
    ? ((negotiation as { windows?: NegotiationWindowLike[] }).windows ?? [])
    : [];
  const offerWindows = priorOffer && Array.isArray((priorOffer as { windows?: unknown }).windows)
    ? ((priorOffer as { windows?: ChatOfferWindow[] }).windows ?? [])
    : [];
  return windows.some((window) => !window.expired && !window.closed) ||
    offerWindows.some((window) => Number(window.closesAt ?? asOfferUnixMs(0)) > Date.now());
}

function supportsScarcityClaim(
  negotiation: ChatNegotiation,
  actorState: NegotiationActorState | null,
): boolean {
  if (negotiationHasAudiencePressure(negotiation)) return true;
  if (negotiationHasLeakThreat(negotiation)) return true;
  if (actorState && Number((actorState as any).inventoryTightness01 ?? asScore0To1(0)) > 0.58) return true;
  return false;
}

function hasEvidenceBackfill(negotiation: ChatNegotiation): boolean {
  const evidence = Array.isArray((negotiation as { evidence?: unknown }).evidence)
    ? ((negotiation as { evidence?: NegotiationSignalEvidence[] }).evidence ?? [])
    : [];
  return evidence.length > 0;
}

function actorCanCarryGuarantee(actorState: NegotiationActorState | null): boolean {
  if (!actorState) return false;
  return Number(actorState.emotion.trust ?? asScore0To1(0)) > 0.52 ||
    Number(actorState.reputation.current ?? asScore0To1(0)) > 58;
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
  );
  if (maxSignal < 0.24) return 'NONE';
  if (input.leakTheater01 >= maxSignal && input.leakTheater01 > 0.42) return 'LEAK_BAIT';
  if (input.rescueMask01 >= maxSignal && input.helperBait01 > 0.32) return 'RESCUE_BAIT';
  if (input.helperBait01 >= maxSignal) return 'HELPER_BAIT';
  if (input.anchorManipulation01 >= maxSignal) return 'ANCHOR_TRAP';
  if (input.urgencyMask01 >= maxSignal) return 'URGENCY_FAKE';
  if (input.proofMask01 >= maxSignal) return 'PROOF_MASK';
  if (input.confidenceMask01 >= maxSignal) return 'CONFIDENCE_MASK';
  if (input.contradiction01 > 0.55 && input.urgencyMask01 > 0.45) return 'MULTI_LAYER';
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
