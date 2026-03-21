/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT DEALROOM NEGOTIATION REPUTATION POLICY
 * FILE: backend/src/game/engine/chat/dealroom/NegotiationReputationPolicy.ts
 * VERSION: 2026.03.19
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Backend reputation policy for Deal Room negotiation outcomes.
 *
 * Negotiation does not stop at price.
 * It spills into:
 * - global witness memory
 * - syndicate trust
 * - helper posture
 * - rival attention
 * - audience theater
 * - future willingness to transact
 * - rescue eligibility
 * - face loss and face recovery
 *
 * This file converts negotiation moves and outcomes into backend-truth
 * reputation deltas and policy actions that other systems can narrate, persist,
 * replay, and use when composing future scene pressure.
 * ============================================================================
 */

import type {
  ChatOffer,
  ChatOfferCounterOutcome,
  Score0To1,
  Score0To100,
  UnixMs,
} from '../../../../../../shared/contracts/chat/ChatOffer';
import {
  asScore0To1,
  asScore0To100,
  chatOfferCanLeak,
  chatOfferConcessionCount,
  chatOfferProjectedHostility,
  chatOfferProjectedSoftness,
  chatOfferProjectedTrustworthiness,
  chatOfferShouldTriggerHelperReview,
} from '../../../../../../shared/contracts/chat/ChatOffer';
import type {
  ChatNegotiation,
  NegotiationActorState,
  NegotiationInferenceFrame,
  NegotiationLeakThreat,
  NegotiationOfferEnvelope,
  NegotiationOutcome,
  NegotiationResolution,
  NegotiationSignalEvidence,
  NegotiationStatus,
  UnixMs as NegotiationUnixMs,
} from '../../../../../../shared/contracts/chat/ChatNegotiation';
import {
  asUnixMs,
  negotiationHasAudiencePressure,
  negotiationHasLeakThreat,
  negotiationInferDominantPressure,
  negotiationLatestOfferId,
  negotiationPrimaryActorState,
  negotiationSupportsRescue,
} from '../../../../../../shared/contracts/chat/ChatNegotiation';
import type { ChatRoomId, JsonValue } from '../types';
import { clamp01 } from '../types';

// ============================================================================
// MARK: Public contracts
// ============================================================================

export interface NegotiationReputationPolicyClock {
  now(): number;
}

export interface NegotiationReputationPolicyLogger {
  debug(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface NegotiationReputationPolicyOptions {
  readonly clock?: NegotiationReputationPolicyClock;
  readonly logger?: NegotiationReputationPolicyLogger;
  readonly retainEventsPerRoom?: number;
  readonly trustDamageMultiplier?: number;
  readonly leakDamageMultiplier?: number;
  readonly rescueGraceMultiplier?: number;
  readonly audienceAmplifier?: number;
  readonly syndicateAmplifier?: number;
  readonly helperAmplifier?: number;
}

export type ReputationSurface =
  | 'DEAL_ROOM'
  | 'GLOBAL'
  | 'SYNDICATE'
  | 'HELPER_NETWORK'
  | 'RIVAL_NETWORK'
  | 'AUDIENCE_MEMORY'
  | 'RESCUE_ELIGIBILITY';

export type ReputationEventKind =
  | 'OPENED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'ABANDONED'
  | 'LEAKED'
  | 'RESCUED'
  | 'PRESSURED'
  | 'BLUFF_EXPOSED'
  | 'BLUFF_HELD'
  | 'FAIR_CLOSE'
  | 'PREDATORY_CLOSE'
  | 'HELPER_VALIDATED'
  | 'HELPER_IGNORED'
  | 'COUNTERPUNCHED'
  | 'FACE_SAVED'
  | 'FACE_LOST';

export interface ReputationDelta {
  readonly surface: ReputationSurface;
  readonly trustDelta: number;
  readonly fearDelta: number;
  readonly prestigeDelta: number;
  readonly reliabilityDelta: number;
  readonly rescueEligibilityDelta: number;
  readonly reason: string;
  readonly weight01: Score0To1;
}

export interface ReputationPolicyAction {
  readonly kind:
    | 'OPEN_WITNESS_THREAD'
    | 'SUPPRESS_GLOBAL_LEAK'
    | 'BOOST_HELPER_ATTENTION'
    | 'DECREASE_HELPER_ATTENTION'
    | 'ENABLE_RESCUE_PRIORITY'
    | 'REDUCE_RESCUE_PRIORITY'
    | 'INCREASE_RIVAL_FOCUS'
    | 'REDUCE_RIVAL_FOCUS'
    | 'ARCHIVE_FACE_LOSS'
    | 'ARCHIVE_FACE_RECOVERY';
  readonly priority01: Score0To1;
  readonly detail: string;
  readonly metadata?: JsonValue;
}

export interface NegotiationReputationRequest {
  readonly roomId: ChatRoomId;
  readonly negotiation: ChatNegotiation;
  readonly offer?: ChatOffer | null;
  readonly priorOffer?: ChatOffer | null;
  readonly resolution?: NegotiationResolution | null;
  readonly outcome?: NegotiationOutcome | null;
  readonly latestInference?: NegotiationInferenceFrame | null;
  readonly latestLeakThreat?: NegotiationLeakThreat | null;
  readonly evidence?: readonly NegotiationSignalEvidence[];
  readonly now?: NegotiationUnixMs;
  readonly traceLabel?: string;
}


export interface NegotiationReputationEvidenceSummary {
  readonly totalSignals: number;
  readonly highConfidenceSignals: number;
  readonly dominantSignalKind: string;
  readonly leakSignal01: Score0To1;
  readonly trustSignal01: Score0To1;
  readonly aggressionSignal01: Score0To1;
  readonly helperNeedSignal01: Score0To1;
  readonly faceThreatSignal01: Score0To1;
}

export interface NegotiationReputationScorecard {
  readonly trustLift100: Score0To100;
  readonly trustDamage100: Score0To100;
  readonly prestigeSwing100: Score0To100;
  readonly rescuePriorityShift100: Score0To100;
  readonly leakSeverity100: Score0To100;
  readonly faceLoss100: Score0To100;
  readonly faceRecovery100: Score0To100;
  readonly stability100: Score0To100;
  readonly socialVolatility100: Score0To100;
}

export interface NegotiationReputationOfferContext {
  readonly counterOutcome: ChatOfferCounterOutcome;
  readonly status: NegotiationStatus;
  readonly offerCreatedAt?: UnixMs;
  readonly offerUpdatedAt?: UnixMs;
  readonly versionCreatedAt?: UnixMs;
  readonly envelopeCreatedAt?: NegotiationUnixMs;
  readonly offerAgeMs: number;
  readonly visibleToAudience: boolean;
  readonly visibleToPlayer: boolean;
  readonly witnessPressure01: Score0To1;
  readonly secrecyPressure01: Score0To1;
  readonly envelopeCrowdHeat01: Score0To1;
}

export interface NegotiationReputationProjection {
  readonly projectionId: string;
  readonly roomId: ChatRoomId;
  readonly negotiationId: string;
  readonly projectedAt: NegotiationUnixMs;
  readonly eventKind: ReputationEventKind;
  readonly negotiationStatus: NegotiationStatus;
  readonly counterOutcome: ChatOfferCounterOutcome;
  readonly deltas: readonly ReputationDelta[];
  readonly actions: readonly ReputationPolicyAction[];
  readonly trustLift01: Score0To1;
  readonly trustDamage01: Score0To1;
  readonly prestigeSwing01: Score0To1;
  readonly rescuePriorityShift01: Score0To1;
  readonly leakSeverity01: Score0To1;
  readonly faceLoss01: Score0To1;
  readonly faceRecovery01: Score0To1;
  readonly dominantPressure: string;
  readonly scorecard: NegotiationReputationScorecard;
  readonly offerContext: NegotiationReputationOfferContext;
  readonly evidenceSummary: NegotiationReputationEvidenceSummary;
  readonly debug: JsonValue;
}

export interface NegotiationReputationLedger {
  readonly roomId: ChatRoomId;
  readonly projections: readonly NegotiationReputationProjection[];
  readonly byNegotiation: Readonly<Record<string, readonly NegotiationReputationProjection[]>>;
  readonly lastUpdatedAt?: NegotiationUnixMs;
}

// ============================================================================
// MARK: Defaults
// ============================================================================

const DEFAULT_OPTIONS: Required<Omit<NegotiationReputationPolicyOptions, 'clock' | 'logger'>> = {
  retainEventsPerRoom: 250,
  trustDamageMultiplier: 1,
  leakDamageMultiplier: 1.15,
  rescueGraceMultiplier: 0.82,
  audienceAmplifier: 1.08,
  syndicateAmplifier: 1.12,
  helperAmplifier: 1.05,
};

const DEFAULT_CLOCK: NegotiationReputationPolicyClock = {
  now: () => Date.now(),
};

const NOOP_LOGGER: NegotiationReputationPolicyLogger = {
  debug() {},
  info() {},
  warn() {},
};

// ============================================================================
// MARK: Policy
// ============================================================================

export class NegotiationReputationPolicy {
  private readonly options: Required<Omit<NegotiationReputationPolicyOptions, 'clock' | 'logger'>>;
  private readonly clock: NegotiationReputationPolicyClock;
  private readonly logger: NegotiationReputationPolicyLogger;
  private readonly roomLedgers = new Map<string, MutableReputationLedger>();

  public constructor(options: NegotiationReputationPolicyOptions = {}) {
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

  public project(request: NegotiationReputationRequest): NegotiationReputationProjection {
    const now = request.now ?? asUnixMs(this.clock.now());
    const negotiation = request.negotiation;
    const offer = request.offer ?? null;
    const priorOffer = request.priorOffer ?? null;
    const negotiationStatus: NegotiationStatus = negotiation.status;
    const offerEnvelope = resolveOfferEnvelope(negotiation);
    const counterOutcome = resolveCounterOutcome(offer);
    const evidenceSummary = summarizeEvidence(request.evidence);
    const offerContext = createOfferContext({
      now,
      negotiation,
      offer,
      envelope: offerEnvelope,
      counterOutcome,
      status: negotiationStatus,
    });
    const outcome = request.outcome ?? inferOutcomeFromResolution(request.resolution);
    const eventKind = determineEventKind(
      negotiation,
      negotiationStatus,
      outcome,
      request.resolution,
      offer,
      counterOutcome,
      request.latestLeakThreat,
    );
    const dominantPressure =
      negotiationInferDominantPressure(request.latestInference) ??
      inferDominantPressureFromEvidence(request.evidence) ??
      'SYSTEM';
    const actorState = negotiationPrimaryActorState(negotiation, negotiation.parties.primary.actorId);
    const deltas: ReputationDelta[] = [];
    const actions: ReputationPolicyAction[] = [];

    const trustDamage01 = computeTrustDamage01({
      negotiation,
      offer,
      priorOffer,
      outcome,
      negotiationStatus,
      counterOutcome,
      offerEnvelope,
      evidenceSummary,
      latestLeakThreat: request.latestLeakThreat,
      latestInference: request.latestInference,
      options: this.options,
    });

    const trustLift01 = computeTrustLift01({
      negotiation,
      offer,
      priorOffer,
      outcome,
      negotiationStatus,
      counterOutcome,
      offerEnvelope,
      evidenceSummary,
      options: this.options,
    });

    const prestigeSwing01 = computePrestigeSwing01({
      negotiation,
      offer,
      priorOffer,
      outcome,
      eventKind,
      counterOutcome,
      negotiationStatus,
      offerEnvelope,
      evidenceSummary,
    });

    const rescuePriorityShift01 = computeRescueShift01({
      negotiation,
      offer,
      outcome,
      negotiationStatus,
      counterOutcome,
      offerEnvelope,
      evidenceSummary,
      latestInference: request.latestInference,
      options: this.options,
    });

    const leakSeverity01 = computeLeakSeverity01({
      negotiation,
      offer,
      negotiationStatus,
      counterOutcome,
      offerEnvelope,
      evidenceSummary,
      latestLeakThreat: request.latestLeakThreat,
      options: this.options,
    });

    const faceLoss01 = computeFaceLoss01({
      negotiation,
      offer,
      priorOffer,
      outcome,
      eventKind,
      negotiationStatus,
      counterOutcome,
      offerEnvelope,
      evidenceSummary,
      actorState,
    });

    const faceRecovery01 = computeFaceRecovery01({
      negotiation,
      offer,
      priorOffer,
      outcome,
      eventKind,
      negotiationStatus,
      counterOutcome,
      offerEnvelope,
      evidenceSummary,
      actorState,
    });

    const scorecard = createScorecard({
      trustLift01,
      trustDamage01,
      prestigeSwing01,
      rescuePriorityShift01,
      leakSeverity01,
      faceLoss01,
      faceRecovery01,
      evidenceSummary,
    });

    deltas.push(...this.buildDealRoomDeltas({
      negotiation,
      eventKind,
      trustDamage01,
      trustLift01,
      prestigeSwing01,
      faceLoss01,
      faceRecovery01,
      rescuePriorityShift01,
    }));

    deltas.push(...this.buildGlobalDeltas({
      negotiation,
      eventKind,
      leakSeverity01,
      faceLoss01,
      faceRecovery01,
      prestigeSwing01,
    }));

    deltas.push(...this.buildSyndicateDeltas({
      negotiation,
      eventKind,
      trustDamage01,
      trustLift01,
      leakSeverity01,
      prestigeSwing01,
    }));

    deltas.push(...this.buildHelperDeltas({
      negotiation,
      eventKind,
      rescuePriorityShift01,
      trustDamage01,
      trustLift01,
    }));

    deltas.push(...this.buildRivalDeltas({
      negotiation,
      eventKind,
      faceLoss01,
      faceRecovery01,
      leakSeverity01,
      prestigeSwing01,
    }));

    deltas.push(...this.buildAudienceDeltas({
      negotiation,
      eventKind,
      faceLoss01,
      faceRecovery01,
      prestigeSwing01,
      leakSeverity01,
    }));

    deltas.push(...this.buildRescueEligibilityDeltas({
      negotiation,
      eventKind,
      rescuePriorityShift01,
      trustDamage01,
      trustLift01,
    }));

    actions.push(...this.buildActions({
      negotiation,
      eventKind,
      trustDamage01,
      trustLift01,
      prestigeSwing01,
      rescuePriorityShift01,
      leakSeverity01,
      faceLoss01,
      faceRecovery01,
      offer,
      outcome,
      negotiationStatus,
      counterOutcome,
      offerContext,
      evidenceSummary,
    }));

    const projection: NegotiationReputationProjection = {
      projectionId: createProjectionId(negotiation.negotiationId, eventKind, now),
      roomId: request.roomId,
      negotiationId: String(negotiation.negotiationId),
      projectedAt: now,
      eventKind,
      negotiationStatus,
      counterOutcome,
      deltas,
      actions,
      trustLift01: asScore0To1(trustLift01),
      trustDamage01: asScore0To1(trustDamage01),
      prestigeSwing01: asScore0To1(prestigeSwing01),
      rescuePriorityShift01: asScore0To1(rescuePriorityShift01),
      leakSeverity01: asScore0To1(leakSeverity01),
      faceLoss01: asScore0To1(faceLoss01),
      faceRecovery01: asScore0To1(faceRecovery01),
      dominantPressure,
      scorecard,
      offerContext,
      evidenceSummary,
      debug: {
        outcome: outcome ?? null,
        latestOfferId: negotiationLatestOfferId(negotiation) ?? null,
        hasOffer: Boolean(offer),
        hasPriorOffer: Boolean(priorOffer),
        negotiationSupportsRescue: negotiationSupportsRescue(negotiation),
        negotiationHasLeakThreat: negotiationHasLeakThreat(negotiation),
        audiencePressure: negotiationHasAudiencePressure(negotiation),
        envelopeVisibleToAudience: offerContext.visibleToAudience,
        envelopeVisibleToPlayer: offerContext.visibleToPlayer,
        counterOutcome,
        negotiationStatus,
        scorecard: serializeScorecard(scorecard),
        offerContext: serializeOfferContext(offerContext),
        evidenceSummary: serializeEvidenceSummary(evidenceSummary),
        traceLabel: request.traceLabel ?? null,
      },
    };

    this.recordProjection(projection);

    this.logger.debug('chat.dealroom.reputation.projected', {
      roomId: request.roomId as unknown as string,
      negotiationId: String(negotiation.negotiationId),
      eventKind,
      negotiationStatus,
      counterOutcome,
      trustDamage01,
      trustLift01,
      prestigeSwing01,
      rescuePriorityShift01,
      leakSeverity01,
      faceLoss01,
      faceRecovery01,
      dominantPressure,
    });

    return projection;
  }

  public getRoomLedger(roomId: ChatRoomId): NegotiationReputationLedger {
    const ledger = this.roomLedgers.get(String(roomId));
    if (!ledger) {
      return {
        roomId,
        projections: [],
        byNegotiation: {},
        lastUpdatedAt: undefined,
      };
    }
    return freezeReputationLedger(roomId, ledger);
  }

  public clearRoom(roomId: ChatRoomId): void {
    this.roomLedgers.delete(String(roomId));
  }

  public reset(): void {
    this.roomLedgers.clear();
  }

  private buildDealRoomDeltas(input: {
    readonly negotiation: ChatNegotiation;
    readonly eventKind: ReputationEventKind;
    readonly trustDamage01: number;
    readonly trustLift01: number;
    readonly prestigeSwing01: number;
    readonly faceLoss01: number;
    readonly faceRecovery01: number;
    readonly rescuePriorityShift01: number;
  }): readonly ReputationDelta[] {
    const deltas: ReputationDelta[] = [];
    const trustDelta = input.trustLift01 - input.trustDamage01;
    deltas.push(delta(
      'DEAL_ROOM',
      trustDelta,
      input.faceLoss01 * 0.2,
      prestigeSigned(input.eventKind, input.prestigeSwing01),
      clampSigned(trustDelta * 0.84),
      clampSigned(input.rescuePriorityShift01 * 0.6),
      'Direct deal-room standing adjusted from negotiation outcome.',
      Math.max(input.trustLift01, input.trustDamage01, input.prestigeSwing01),
    ));
    return deltas;
  }

  private buildGlobalDeltas(input: {
    readonly negotiation: ChatNegotiation;
    readonly eventKind: ReputationEventKind;
    readonly leakSeverity01: number;
    readonly faceLoss01: number;
    readonly faceRecovery01: number;
    readonly prestigeSwing01: number;
  }): readonly ReputationDelta[] {
    const deltas: ReputationDelta[] = [];
    if (!negotiationHasAudiencePressure(input.negotiation) && input.leakSeverity01 < 0.2 && input.faceLoss01 < 0.2 && input.faceRecovery01 < 0.2) {
      return deltas;
    }
    deltas.push(delta(
      'GLOBAL',
      clampSigned(-input.leakSeverity01 * 0.38 + input.faceRecovery01 * 0.12),
      input.leakSeverity01 * 0.42,
      prestigeSigned(input.eventKind, input.prestigeSwing01 * this.options.audienceAmplifier),
      clampSigned(-input.leakSeverity01 * 0.44),
      0,
      'Global witness memory reacts to leak pressure and face swings.',
      Math.max(input.leakSeverity01, input.faceLoss01, input.faceRecovery01),
    ));
    return deltas;
  }

  private buildSyndicateDeltas(input: {
    readonly negotiation: ChatNegotiation;
    readonly eventKind: ReputationEventKind;
    readonly trustDamage01: number;
    readonly trustLift01: number;
    readonly leakSeverity01: number;
    readonly prestigeSwing01: number;
  }): readonly ReputationDelta[] {
    const trustDelta = input.trustLift01 * this.options.syndicateAmplifier - input.trustDamage01 * this.options.syndicateAmplifier;
    return [
      delta(
        'SYNDICATE',
        clampSigned(trustDelta),
        input.leakSeverity01 * 0.2,
        prestigeSigned(input.eventKind, input.prestigeSwing01 * this.options.syndicateAmplifier),
        clampSigned(trustDelta * 0.95),
        0,
        'Syndicate trust reacts heavily to negotiation discipline.',
        Math.max(input.trustLift01, input.trustDamage01, input.leakSeverity01),
      ),
    ];
  }

  private buildHelperDeltas(input: {
    readonly negotiation: ChatNegotiation;
    readonly eventKind: ReputationEventKind;
    readonly rescuePriorityShift01: number;
    readonly trustDamage01: number;
    readonly trustLift01: number;
  }): readonly ReputationDelta[] {
    const multiplier = this.options.helperAmplifier;
    const trustSignedDelta = clampSigned(input.trustLift01 * multiplier - input.trustDamage01 * multiplier * 0.75);
    return [
      delta(
        'HELPER_NETWORK',
        trustSignedDelta,
        0,
        clampSigned(input.rescuePriorityShift01 * 0.1),
        trustSignedDelta,
        clampSigned(input.rescuePriorityShift01 * multiplier),
        'Helper network adjusts availability and patience from the negotiation.',
        Math.max(input.rescuePriorityShift01, input.trustLift01, input.trustDamage01),
      ),
    ];
  }

  private buildRivalDeltas(input: {
    readonly negotiation: ChatNegotiation;
    readonly eventKind: ReputationEventKind;
    readonly faceLoss01: number;
    readonly faceRecovery01: number;
    readonly leakSeverity01: number;
    readonly prestigeSwing01: number;
  }): readonly ReputationDelta[] {
    const fearDelta = clampSigned(input.faceRecovery01 * 0.42 - input.faceLoss01 * 0.1 + input.prestigeSwing01 * 0.22);
    return [
      delta(
        'RIVAL_NETWORK',
        clampSigned(-input.leakSeverity01 * 0.12),
        fearDelta,
        prestigeSigned(input.eventKind, input.prestigeSwing01 * 0.72),
        clampSigned(-input.faceLoss01 * 0.15 + input.faceRecovery01 * 0.18),
        0,
        'Rivals react to face swings, leak exposure, and close strength.',
        Math.max(input.faceLoss01, input.faceRecovery01, input.prestigeSwing01),
      ),
    ];
  }

  private buildAudienceDeltas(input: {
    readonly negotiation: ChatNegotiation;
    readonly eventKind: ReputationEventKind;
    readonly faceLoss01: number;
    readonly faceRecovery01: number;
    readonly prestigeSwing01: number;
    readonly leakSeverity01: number;
  }): readonly ReputationDelta[] {
    return [
      delta(
        'AUDIENCE_MEMORY',
        clampSigned(-input.leakSeverity01 * 0.2 + input.faceRecovery01 * 0.08),
        input.faceRecovery01 * 0.12,
        prestigeSigned(input.eventKind, input.prestigeSwing01),
        clampSigned(-input.faceLoss01 * 0.32 + input.faceRecovery01 * 0.26),
        0,
        'Audience memory stores humiliation, comeback, and witness drama.',
        Math.max(input.faceLoss01, input.faceRecovery01, input.prestigeSwing01),
      ),
    ];
  }

  private buildRescueEligibilityDeltas(input: {
    readonly negotiation: ChatNegotiation;
    readonly eventKind: ReputationEventKind;
    readonly rescuePriorityShift01: number;
    readonly trustDamage01: number;
    readonly trustLift01: number;
  }): readonly ReputationDelta[] {
    const rescueDelta = clampSigned(input.rescuePriorityShift01 - input.trustLift01 * 0.18 + input.trustDamage01 * 0.22);
    return [
      delta(
        'RESCUE_ELIGIBILITY',
        0,
        0,
        0,
        clampSigned(-input.trustDamage01 * 0.08 + input.trustLift01 * 0.03),
        rescueDelta,
        'Rescue priority shifts with negotiation stability and visible strain.',
        Math.max(input.rescuePriorityShift01, input.trustDamage01, input.trustLift01),
      ),
    ];
  }

  private buildActions(input: {
    readonly negotiation: ChatNegotiation;
    readonly eventKind: ReputationEventKind;
    readonly trustDamage01: number;
    readonly trustLift01: number;
    readonly prestigeSwing01: number;
    readonly rescuePriorityShift01: number;
    readonly leakSeverity01: number;
    readonly faceLoss01: number;
    readonly faceRecovery01: number;
    readonly offer: ChatOffer | null;
    readonly outcome: NegotiationOutcome | null | undefined;
    readonly negotiationStatus: NegotiationStatus;
    readonly counterOutcome: ChatOfferCounterOutcome;
    readonly offerContext: NegotiationReputationOfferContext;
    readonly evidenceSummary: NegotiationReputationEvidenceSummary;
  }): readonly ReputationPolicyAction[] {
    const actions: ReputationPolicyAction[] = [];

    if (input.leakSeverity01 > 0.42 || input.counterOutcome === 'LIKELY_LEAK' || input.negotiationStatus === 'LEAKED') {
      actions.push(action(
        'OPEN_WITNESS_THREAD',
        Math.max(input.leakSeverity01, Number(input.evidenceSummary.leakSignal01)),
        'Leak pressure is high enough to justify witness-thread follow-up.',
        {
          leakSeverity01: input.leakSeverity01,
          counterOutcome: input.counterOutcome,
          status: input.negotiationStatus,
        },
      ));
    } else {
      actions.push(action(
        'SUPPRESS_GLOBAL_LEAK',
        clamp01(1 - input.leakSeverity01),
        'Leak pressure is low enough to suppress unnecessary global spill.',
        {
          counterOutcome: input.counterOutcome,
          visibleToAudience: input.offerContext.visibleToAudience,
        },
      ));
    }

    if (
      input.rescuePriorityShift01 > 0.34 ||
      input.faceLoss01 > 0.5 ||
      input.counterOutcome === 'LIKELY_RESCUE' ||
      Number(input.evidenceSummary.helperNeedSignal01) > 0.44
    ) {
      actions.push(action(
        'ENABLE_RESCUE_PRIORITY',
        Math.max(input.rescuePriorityShift01, input.faceLoss01, Number(input.evidenceSummary.helperNeedSignal01)),
        'Negotiation outcome indicates rescue priority should increase.',
        {
          status: input.negotiationStatus,
          counterOutcome: input.counterOutcome,
        },
      ));
      actions.push(action(
        'BOOST_HELPER_ATTENTION',
        Math.max(input.rescuePriorityShift01, input.faceLoss01, Number(input.evidenceSummary.helperNeedSignal01)),
        'Helper network should track this actor more aggressively.',
        {
          helperNeedSignal01: Number(input.evidenceSummary.helperNeedSignal01),
        },
      ));
    } else if (input.faceRecovery01 > 0.44 && input.trustLift01 > 0.38) {
      actions.push(action(
        'REDUCE_RESCUE_PRIORITY',
        Math.max(input.faceRecovery01, input.trustLift01),
        'Recent recovery reduces immediate rescue urgency.',
        {
          negotiationStatus: input.negotiationStatus,
        },
      ));
      actions.push(action(
        'DECREASE_HELPER_ATTENTION',
        clamp01(input.faceRecovery01 * 0.7),
        'Helper attention can relax after a strong recovery.',
      ));
    }

    if (
      input.faceLoss01 > 0.48 ||
      input.leakSeverity01 > 0.44 ||
      input.counterOutcome === 'LIKELY_REJECT' ||
      input.counterOutcome === 'LIKELY_COUNTER'
    ) {
      actions.push(action(
        'INCREASE_RIVAL_FOCUS',
        Math.max(input.faceLoss01, input.leakSeverity01, Number(input.evidenceSummary.aggressionSignal01)),
        'Rivals are likely to press further after visible weakness or a hard counter posture.',
        {
          counterOutcome: input.counterOutcome,
          aggressionSignal01: Number(input.evidenceSummary.aggressionSignal01),
        },
      ));
      actions.push(action(
        'ARCHIVE_FACE_LOSS',
        Math.max(input.faceLoss01, Number(input.evidenceSummary.faceThreatSignal01)),
        'Archive face-loss memory for future callbacks.',
      ));
    }

    if (
      input.faceRecovery01 > 0.42 ||
      (input.outcome === 'ACCEPTED' && input.trustLift01 > 0.36) ||
      input.counterOutcome === 'LIKELY_ACCEPT'
    ) {
      actions.push(action(
        'REDUCE_RIVAL_FOCUS',
        Math.max(input.faceRecovery01, input.trustLift01),
        'Rival focus can soften after a strong, witnessed recovery.',
      ));
      actions.push(action(
        'ARCHIVE_FACE_RECOVERY',
        Math.max(input.faceRecovery01, input.trustLift01),
        'Archive face-recovery memory for later prestige callbacks.',
        {
          visibleToAudience: input.offerContext.visibleToAudience,
          trustSignal01: Number(input.evidenceSummary.trustSignal01),
        },
      ));
    }

    if (
      input.offer &&
      chatOfferShouldTriggerHelperReview(input.offer) &&
      input.counterOutcome !== 'LIKELY_ACCEPT'
    ) {
      actions.push(action(
        'BOOST_HELPER_ATTENTION',
        Math.max(input.rescuePriorityShift01, Number(input.evidenceSummary.helperNeedSignal01), 0.28),
        'Offer semantics suggest helper review should remain hot.',
        {
          helperReview: true,
          status: input.negotiationStatus,
        },
      ));
    }

    return dedupeActions(actions);
  }

  private recordProjection(projection: NegotiationReputationProjection): void {
    const roomKey = String(projection.roomId);
    const ledger = this.ensureRoomLedger(roomKey);
    ledger.projections.push(projection);
    trimMutable(ledger.projections, this.options.retainEventsPerRoom);

    const existing = ledger.byNegotiation.get(projection.negotiationId) ?? [];
    existing.push(projection);
    trimMutable(existing, this.options.retainEventsPerRoom);
    ledger.byNegotiation.set(projection.negotiationId, existing);

    ledger.lastUpdatedAt = projection.projectedAt;
  }

  private ensureRoomLedger(roomKey: string): MutableReputationLedger {
    let ledger = this.roomLedgers.get(roomKey);
    if (!ledger) {
      ledger = {
        projections: [],
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

export function createNegotiationReputationPolicy(
  options: NegotiationReputationPolicyOptions = {},
): NegotiationReputationPolicy {
  return new NegotiationReputationPolicy(options);
}

export const ChatNegotiationReputationPolicyModule = {
  moduleId: 'backend.chat.dealroom.NegotiationReputationPolicy',
  create: createNegotiationReputationPolicy,
  NegotiationReputationPolicy,
} as const;

// ============================================================================
// MARK: Mutable ledger
// ============================================================================

interface MutableReputationLedger {
  projections: NegotiationReputationProjection[];
  byNegotiation: Map<string, NegotiationReputationProjection[]>;
  lastUpdatedAt?: NegotiationUnixMs;
}

// ============================================================================
// MARK: Core computations
// ============================================================================

function computeTrustDamage01(input: {
  readonly negotiation: ChatNegotiation;
  readonly offer: ChatOffer | null;
  readonly priorOffer: ChatOffer | null;
  readonly outcome: NegotiationOutcome | null | undefined;
  readonly negotiationStatus: NegotiationStatus;
  readonly counterOutcome: ChatOfferCounterOutcome;
  readonly offerEnvelope: NegotiationOfferEnvelope | null;
  readonly evidenceSummary: NegotiationReputationEvidenceSummary;
  readonly latestLeakThreat?: NegotiationLeakThreat | null;
  readonly latestInference?: NegotiationInferenceFrame | null;
  readonly options: Required<Omit<NegotiationReputationPolicyOptions, 'clock' | 'logger'>>;
}): number {
  const leakPressure = input.latestLeakThreat ? Number(input.latestLeakThreat.severity.normalized) : (negotiationHasLeakThreat(input.negotiation) ? 0.42 : 0);
  const offerTrust = input.offer ? Number(chatOfferProjectedTrustworthiness(input.offer)) : 0.5;
  const hostility = input.offer ? Number(chatOfferProjectedHostility(input.offer)) : 0.35;
  const inferenceTrustBreak = input.latestInference ? Number(input.latestInference.risk.collapseRisk ?? asScore0To1(0)) : 0;
  const abandonment = input.outcome === 'WITHDRAWN' ? 0.34 : 0;
  const rejection = input.outcome === 'REJECTED' ? 0.2 : 0;
  const leak = input.outcome === 'LEAKED' ? 0.36 : 0;
  const counterPenalty = counterOutcomeDamageModifier(input.counterOutcome);
  const statusPenalty = statusInstabilityModifier(input.negotiationStatus);
  const envelopeExposure = computeEnvelopeExposure01(input.offerEnvelope);
  const evidencePenalty =
    Number(input.evidenceSummary.leakSignal01) * 0.18 +
    Number(input.evidenceSummary.faceThreatSignal01) * 0.12 +
    Number(input.evidenceSummary.aggressionSignal01) * 0.08;
  return clamp01(
    (1 - offerTrust) * 0.34 * input.options.trustDamageMultiplier +
      hostility * 0.14 +
      leakPressure * 0.23 * input.options.leakDamageMultiplier +
      inferenceTrustBreak * 0.17 +
      envelopeExposure * 0.11 +
      evidencePenalty +
      counterPenalty +
      statusPenalty +
      abandonment +
      rejection +
      leak,
  );
}

function computeTrustLift01(input: {
  readonly negotiation: ChatNegotiation;
  readonly offer: ChatOffer | null;
  readonly priorOffer: ChatOffer | null;
  readonly outcome: NegotiationOutcome | null | undefined;
  readonly negotiationStatus: NegotiationStatus;
  readonly counterOutcome: ChatOfferCounterOutcome;
  readonly offerEnvelope: NegotiationOfferEnvelope | null;
  readonly evidenceSummary: NegotiationReputationEvidenceSummary;
  readonly options: Required<Omit<NegotiationReputationPolicyOptions, 'clock' | 'logger'>>;
}): number {
  const trustProjection = input.offer ? Number(chatOfferProjectedTrustworthiness(input.offer)) : 0.48;
  const softness = input.offer ? Number(chatOfferProjectedSoftness(input.offer)) : 0.4;
  const concessions = input.offer ? chatOfferConcessionCount(input.offer) : 0;
  const acceptance = input.outcome === 'ACCEPTED' ? 0.18 : 0;
  const fairClose = input.outcome === 'ACCEPTED' ? 0.14 : 0;
  const helper = input.offer && chatOfferShouldTriggerHelperReview(input.offer) ? 0.06 : 0;
  const counterSupport = counterOutcomeLiftModifier(input.counterOutcome);
  const statusSupport = statusStabilityModifier(input.negotiationStatus);
  const envelopeDiscipline = input.offerEnvelope && !input.offerEnvelope.channelContext.visibleToAudience ? 0.04 : 0;
  const evidenceTrust = Number(input.evidenceSummary.trustSignal01) * 0.16;
  return clamp01(
    trustProjection * 0.38 +
      softness * 0.12 +
      clamp01(concessions / 4) * 0.16 +
      counterSupport +
      statusSupport +
      envelopeDiscipline +
      evidenceTrust +
      acceptance +
      fairClose +
      helper,
  );
}

function computePrestigeSwing01(input: {
  readonly negotiation: ChatNegotiation;
  readonly offer: ChatOffer | null;
  readonly priorOffer: ChatOffer | null;
  readonly outcome: NegotiationOutcome | null | undefined;
  readonly eventKind: ReputationEventKind;
  readonly counterOutcome: ChatOfferCounterOutcome;
  readonly negotiationStatus: NegotiationStatus;
  readonly offerEnvelope: NegotiationOfferEnvelope | null;
  readonly evidenceSummary: NegotiationReputationEvidenceSummary;
}): number {
  const hostility = input.offer ? Number(chatOfferProjectedHostility(input.offer)) : 0.3;
  const witness = negotiationHasAudiencePressure(input.negotiation) ? 0.18 : 0.06;
  const accepted = input.outcome === 'ACCEPTED' ? 0.18 : 0;
  const leak = input.outcome === 'LEAKED' ? -0.22 : 0;
  const faceLoss = input.eventKind === 'FACE_LOST' ? -0.18 : 0;
  const faceSave = input.eventKind === 'FACE_SAVED' ? 0.14 : 0;
  const counterPrestige = counterOutcomePrestigeModifier(input.counterOutcome);
  const statusPrestige = input.negotiationStatus === 'RESOLVED' ? 0.08 : input.negotiationStatus === 'LEAKED' ? -0.12 : 0;
  const envelopeAudience = computeEnvelopeAudienceAmplifier(input.offerEnvelope) * 0.12;
  const evidencePrestige = Number(input.evidenceSummary.aggressionSignal01) * 0.06 + Number(input.evidenceSummary.trustSignal01) * 0.04;
  return clamp01(Math.abs(hostility * 0.32 + witness + accepted + leak + faceLoss + faceSave + counterPrestige + statusPrestige + envelopeAudience + evidencePrestige));
}

function computeRescueShift01(input: {
  readonly negotiation: ChatNegotiation;
  readonly offer: ChatOffer | null;
  readonly outcome: NegotiationOutcome | null | undefined;
  readonly negotiationStatus: NegotiationStatus;
  readonly counterOutcome: ChatOfferCounterOutcome;
  readonly offerEnvelope: NegotiationOfferEnvelope | null;
  readonly evidenceSummary: NegotiationReputationEvidenceSummary;
  readonly latestInference?: NegotiationInferenceFrame | null;
  readonly options: Required<Omit<NegotiationReputationPolicyOptions, 'clock' | 'logger'>>;
}): number {
  const rescueSupport = negotiationSupportsRescue(input.negotiation) ? 0.22 : 0;
  const helperReview = input.offer && chatOfferShouldTriggerHelperReview(input.offer) ? 0.12 : 0;
  const inference = input.latestInference ? Number(input.latestInference.risk.rescueNeed ?? asScore0To1(0)) : 0;
  const collapse = input.outcome === 'COLLAPSED' || input.outcome === 'WITHDRAWN' ? 0.18 : 0;
  const counterRescue = counterOutcomeRescueModifier(input.counterOutcome);
  const statusRescue = input.negotiationStatus === 'FAILED' || input.negotiationStatus === 'ABANDONED' ? 0.12 : 0;
  const evidenceRescue = Number(input.evidenceSummary.helperNeedSignal01) * 0.18;
  const envelopeRescue = computeEnvelopeExposure01(input.offerEnvelope) * 0.08;
  return clamp01((rescueSupport + helperReview + inference + collapse + counterRescue + statusRescue + evidenceRescue + envelopeRescue) * input.options.rescueGraceMultiplier);
}

function computeLeakSeverity01(input: {
  readonly negotiation: ChatNegotiation;
  readonly offer: ChatOffer | null;
  readonly negotiationStatus: NegotiationStatus;
  readonly counterOutcome: ChatOfferCounterOutcome;
  readonly offerEnvelope: NegotiationOfferEnvelope | null;
  readonly evidenceSummary: NegotiationReputationEvidenceSummary;
  readonly latestLeakThreat?: NegotiationLeakThreat | null;
  readonly options: Required<Omit<NegotiationReputationPolicyOptions, 'clock' | 'logger'>>;
}): number {
  const leakThreat = input.latestLeakThreat ? Number(input.latestLeakThreat.severity.normalized) : (negotiationHasLeakThreat(input.negotiation) ? 0.34 : 0);
  const leakableOffer = input.offer && chatOfferCanLeak(input.offer) ? 0.24 : 0;
  const witness = negotiationHasAudiencePressure(input.negotiation) ? 0.12 : 0;
  const counterLeak = counterOutcomeLeakModifier(input.counterOutcome);
  const statusLeak = input.negotiationStatus === 'LEAKED' ? 0.22 : input.negotiationStatus === 'EXPIRED' ? 0.04 : 0;
  const envelopeLeak = computeEnvelopeAudienceAmplifier(input.offerEnvelope) * 0.16;
  const evidenceLeak = Number(input.evidenceSummary.leakSignal01) * 0.24;
  return clamp01((leakThreat + leakableOffer + witness + counterLeak + statusLeak + envelopeLeak + evidenceLeak) * input.options.leakDamageMultiplier);
}

function computeFaceLoss01(input: {
  readonly negotiation: ChatNegotiation;
  readonly offer: ChatOffer | null;
  readonly priorOffer: ChatOffer | null;
  readonly outcome: NegotiationOutcome | null | undefined;
  readonly eventKind: ReputationEventKind;
  readonly negotiationStatus: NegotiationStatus;
  readonly counterOutcome: ChatOfferCounterOutcome;
  readonly offerEnvelope: NegotiationOfferEnvelope | null;
  readonly evidenceSummary: NegotiationReputationEvidenceSummary;
  readonly actorState: NegotiationActorState | null | undefined;
}): number {
  const hostility = input.offer ? Number(chatOfferProjectedHostility(input.offer)) : 0.25;
  const rejection = input.outcome === 'REJECTED' ? 0.24 : 0;
  const leak = input.outcome === 'LEAKED' ? 0.3 : 0;
  const abandonment = input.outcome === 'WITHDRAWN' ? 0.26 : 0;
  const panic = input.actorState ? Number(input.actorState.emotion.frustration ?? asScore0To1(0)) * 0.18 : 0;
  const witness = negotiationHasAudiencePressure(input.negotiation) ? 0.18 : 0.08;
  const faceKind = input.eventKind === 'FACE_LOST' ? 0.22 : 0;
  const counterLoss = counterOutcomeFaceLossModifier(input.counterOutcome);
  const statusLoss = statusInstabilityModifier(input.negotiationStatus) * 0.35;
  const evidenceLoss = Number(input.evidenceSummary.faceThreatSignal01) * 0.18 + Number(input.evidenceSummary.aggressionSignal01) * 0.06;
  const envelopeLoss = computeEnvelopeAudienceAmplifier(input.offerEnvelope) * 0.08;
  return clamp01(hostility * 0.14 + rejection + leak + abandonment + panic + witness + faceKind + counterLoss + statusLoss + evidenceLoss + envelopeLoss);
}

function computeFaceRecovery01(input: {
  readonly negotiation: ChatNegotiation;
  readonly offer: ChatOffer | null;
  readonly priorOffer: ChatOffer | null;
  readonly outcome: NegotiationOutcome | null | undefined;
  readonly eventKind: ReputationEventKind;
  readonly negotiationStatus: NegotiationStatus;
  readonly counterOutcome: ChatOfferCounterOutcome;
  readonly offerEnvelope: NegotiationOfferEnvelope | null;
  readonly evidenceSummary: NegotiationReputationEvidenceSummary;
  readonly actorState: NegotiationActorState | null | undefined;
}): number {
  const trust = input.offer ? Number(chatOfferProjectedTrustworthiness(input.offer)) : 0.42;
  const softness = input.offer ? Number(chatOfferProjectedSoftness(input.offer)) : 0.33;
  const accepted = input.outcome === 'ACCEPTED' ? 0.26 : 0;
  const settled = input.outcome === 'ACCEPTED' ? 0.18 : 0;
  const faceKind = input.eventKind === 'FACE_SAVED' ? 0.18 : 0;
  const confidence = input.actorState ? Number(input.actorState.emotion.confidence ?? asScore0To1(0)) * 0.12 : 0;
  const counterRecovery = counterOutcomeFaceRecoveryModifier(input.counterOutcome);
  const statusRecovery = statusStabilityModifier(input.negotiationStatus) * 0.5;
  const evidenceRecovery = Number(input.evidenceSummary.trustSignal01) * 0.14 + Number(input.evidenceSummary.helperNeedSignal01) * 0.04;
  const envelopeRecovery = input.offerEnvelope && !input.offerEnvelope.channelContext.visibleToAudience ? 0.04 : 0;
  return clamp01(trust * 0.18 + softness * 0.1 + accepted + settled + faceKind + confidence + counterRecovery + statusRecovery + evidenceRecovery + envelopeRecovery);
}

function determineEventKind(
  negotiation: ChatNegotiation,
  negotiationStatus: NegotiationStatus,
  outcome: NegotiationOutcome | null | undefined,
  resolution: NegotiationResolution | null | undefined,
  offer: ChatOffer | null,
  counterOutcome: ChatOfferCounterOutcome,
  latestLeakThreat?: NegotiationLeakThreat | null,
): ReputationEventKind {
  if (resolution?.leakOccurred || negotiationStatus === 'LEAKED' || outcome === 'LEAKED') return 'LEAKED';
  if (resolution?.rescueOccurred || outcome === 'RESCUED') return 'RESCUED';
  if (negotiationStatus === 'EXPIRED' || outcome === 'TIMED_OUT') return 'EXPIRED';
  if (negotiationStatus === 'ABANDONED' || outcome === 'WITHDRAWN') return 'ABANDONED';
  if (outcome === 'REJECTED') return 'REJECTED';
  if (outcome === 'ACCEPTED' && counterOutcome === 'LIKELY_ACCEPT') return 'FAIR_CLOSE';
  if (outcome === 'ACCEPTED') return 'ACCEPTED';
  if (outcome === 'FACE_SAVED') return 'FACE_SAVED';
  if (counterOutcome === 'LIKELY_COUNTER') return 'COUNTERPUNCHED';
  if (counterOutcome === 'LIKELY_RESCUE') return offer && chatOfferShouldTriggerHelperReview(offer) ? 'HELPER_VALIDATED' : 'HELPER_IGNORED';
  if (offer && chatOfferShouldTriggerHelperReview(offer)) return 'HELPER_VALIDATED';
  if (counterOutcome === 'LIKELY_LEAK') return 'PRESSURED';
  if (latestLeakThreat && Number(latestLeakThreat.severity.normalized) > 0.44) return 'PRESSURED';
  if (negotiationHasLeakThreat(negotiation)) return 'PRESSURED';
  return 'OPENED';
}

function resolveOfferEnvelope(negotiation: ChatNegotiation): NegotiationOfferEnvelope | null {
  return negotiation.activeOffer ?? negotiation.scene.currentOffer ?? null;
}

function resolveCounterOutcome(offer: ChatOffer | null): ChatOfferCounterOutcome {
  return offer?.counterRead?.likelyOutcome ?? 'NONE';
}

function summarizeEvidence(
  evidence?: readonly NegotiationSignalEvidence[] | null,
): NegotiationReputationEvidenceSummary {
  const signals = evidence ?? [];
  let leakSignal = 0;
  let trustSignal = 0;
  let aggressionSignal = 0;
  let helperNeedSignal = 0;
  let faceThreatSignal = 0;
  let highConfidenceSignals = 0;
  let dominantSignalKind = 'NONE';
  let dominantSignalScore = -1;

  for (const signal of signals) {
    const score = Number(signal.score.normalized);
    const confidence = Number(signal.confidence.normalized);
    if (confidence >= 0.66) {
      highConfidenceSignals += 1;
    }
    if (score > dominantSignalScore) {
      dominantSignalScore = score;
      dominantSignalKind = signal.kind;
    }
    switch (signal.kind) {
      case 'LEAK_RISK':
        leakSignal = Math.max(leakSignal, score);
        break;
      case 'TRUST_SIGNAL':
        trustSignal = Math.max(trustSignal, score);
        break;
      case 'AGGRESSION':
      case 'DOMINANCE_PLAY':
        aggressionSignal = Math.max(aggressionSignal, score);
        break;
      case 'HELPER_NEED':
      case 'CHURN_RISK':
        helperNeedSignal = Math.max(helperNeedSignal, score);
        break;
      case 'FACE_THREAT':
      case 'REPUTATION_RISK':
        faceThreatSignal = Math.max(faceThreatSignal, score);
        break;
      default:
        break;
    }
  }

  return {
    totalSignals: signals.length,
    highConfidenceSignals,
    dominantSignalKind,
    leakSignal01: asScore0To1(clamp01(leakSignal)),
    trustSignal01: asScore0To1(clamp01(trustSignal)),
    aggressionSignal01: asScore0To1(clamp01(aggressionSignal)),
    helperNeedSignal01: asScore0To1(clamp01(helperNeedSignal)),
    faceThreatSignal01: asScore0To1(clamp01(faceThreatSignal)),
  };
}

function createOfferContext(input: {
  readonly now: NegotiationUnixMs;
  readonly negotiation: ChatNegotiation;
  readonly offer: ChatOffer | null;
  readonly envelope: NegotiationOfferEnvelope | null;
  readonly counterOutcome: ChatOfferCounterOutcome;
  readonly status: NegotiationStatus;
}): NegotiationReputationOfferContext {
  const witnessPressure = input.envelope ? Number(input.envelope.channelContext.witnessPressure) : (negotiationHasAudiencePressure(input.negotiation) ? 0.6 : 0);
  const secrecyPressure = input.envelope ? Number(input.envelope.channelContext.secrecyPressure) : 0;
  const crowdHeat = input.envelope ? Number(input.envelope.channelContext.crowdHeat ?? asScore0To1(0)) : 0;
  const latestOfferAt = input.offer ? latestOfferTimestamp(input.offer) : undefined;
  return {
    counterOutcome: input.counterOutcome,
    status: input.status,
    offerCreatedAt: input.offer?.createdAt,
    offerUpdatedAt: input.offer?.updatedAt,
    versionCreatedAt: input.offer?.currentVersion.createdAt,
    envelopeCreatedAt: input.envelope?.createdAt,
    offerAgeMs: computeOfferAgeMs(input.now, latestOfferAt),
    visibleToAudience: input.envelope?.channelContext.visibleToAudience ?? negotiationHasAudiencePressure(input.negotiation),
    visibleToPlayer: input.envelope?.channelContext.visibleToPlayer ?? true,
    witnessPressure01: asScore0To1(clamp01(witnessPressure)),
    secrecyPressure01: asScore0To1(clamp01(secrecyPressure)),
    envelopeCrowdHeat01: asScore0To1(clamp01(crowdHeat)),
  };
}

function createScorecard(input: {
  readonly trustLift01: number;
  readonly trustDamage01: number;
  readonly prestigeSwing01: number;
  readonly rescuePriorityShift01: number;
  readonly leakSeverity01: number;
  readonly faceLoss01: number;
  readonly faceRecovery01: number;
  readonly evidenceSummary: NegotiationReputationEvidenceSummary;
}): NegotiationReputationScorecard {
  const socialVolatility01 = Math.max(
    input.leakSeverity01,
    input.faceLoss01,
    Number(input.evidenceSummary.faceThreatSignal01),
    Number(input.evidenceSummary.aggressionSignal01),
  );
  const stability01 = clamp01(1 - Math.max(input.trustDamage01, input.leakSeverity01, input.faceLoss01));
  return {
    trustLift100: percentageFrom01(input.trustLift01),
    trustDamage100: percentageFrom01(input.trustDamage01),
    prestigeSwing100: percentageFrom01(input.prestigeSwing01),
    rescuePriorityShift100: percentageFrom01(input.rescuePriorityShift01),
    leakSeverity100: percentageFrom01(input.leakSeverity01),
    faceLoss100: percentageFrom01(input.faceLoss01),
    faceRecovery100: percentageFrom01(input.faceRecovery01),
    stability100: percentageFrom01(stability01),
    socialVolatility100: percentageFrom01(socialVolatility01),
  };
}

function inferDominantPressureFromEvidence(
  evidence?: readonly NegotiationSignalEvidence[] | null,
): string | undefined {
  const dominantSignalKind = summarizeEvidence(evidence).dominantSignalKind;
  switch (dominantSignalKind) {
    case 'LEAK_RISK':
      return 'LEAK';
    case 'HELPER_NEED':
    case 'CHURN_RISK':
      return 'RESCUE';
    case 'URGENCY':
    case 'STALL':
      return 'TIME';
    case 'ANCHOR_FORCE':
    case 'OVERPAY_RISK':
    case 'UNDERBID_RISK':
      return 'PRICE';
    case 'TRUST_SIGNAL':
      return 'MEMORY';
    case 'AGGRESSION':
    case 'DOMINANCE_PLAY':
      return 'RIVAL';
    case 'FACE_THREAT':
    case 'REPUTATION_RISK':
      return 'AUDIENCE';
    default:
      return undefined;
  }
}

function counterOutcomeDamageModifier(counterOutcome: ChatOfferCounterOutcome): number {
  switch (counterOutcome) {
    case 'LIKELY_REJECT':
      return 0.14;
    case 'LIKELY_STALL':
      return 0.08;
    case 'LIKELY_LEAK':
      return 0.18;
    case 'LIKELY_RESCUE':
      return 0.06;
    default:
      return 0;
  }
}

function counterOutcomeLiftModifier(counterOutcome: ChatOfferCounterOutcome): number {
  switch (counterOutcome) {
    case 'LIKELY_ACCEPT':
      return 0.18;
    case 'LIKELY_COUNTER':
      return 0.07;
    case 'LIKELY_RESCUE':
      return 0.03;
    default:
      return 0;
  }
}

function counterOutcomePrestigeModifier(counterOutcome: ChatOfferCounterOutcome): number {
  switch (counterOutcome) {
    case 'LIKELY_ACCEPT':
      return 0.12;
    case 'LIKELY_COUNTER':
      return 0.08;
    case 'LIKELY_REJECT':
      return -0.06;
    case 'LIKELY_LEAK':
      return -0.16;
    case 'LIKELY_RESCUE':
      return 0.04;
    case 'LIKELY_STALL':
      return -0.04;
    default:
      return 0;
  }
}

function counterOutcomeRescueModifier(counterOutcome: ChatOfferCounterOutcome): number {
  switch (counterOutcome) {
    case 'LIKELY_RESCUE':
      return 0.18;
    case 'LIKELY_LEAK':
      return 0.06;
    default:
      return 0;
  }
}

function counterOutcomeLeakModifier(counterOutcome: ChatOfferCounterOutcome): number {
  switch (counterOutcome) {
    case 'LIKELY_LEAK':
      return 0.2;
    case 'LIKELY_STALL':
      return 0.05;
    default:
      return 0;
  }
}

function counterOutcomeFaceLossModifier(counterOutcome: ChatOfferCounterOutcome): number {
  switch (counterOutcome) {
    case 'LIKELY_REJECT':
      return 0.18;
    case 'LIKELY_LEAK':
      return 0.22;
    case 'LIKELY_COUNTER':
      return 0.1;
    default:
      return 0;
  }
}

function counterOutcomeFaceRecoveryModifier(counterOutcome: ChatOfferCounterOutcome): number {
  switch (counterOutcome) {
    case 'LIKELY_ACCEPT':
      return 0.18;
    case 'LIKELY_COUNTER':
      return 0.08;
    case 'LIKELY_RESCUE':
      return 0.06;
    default:
      return 0;
  }
}

function statusInstabilityModifier(status: NegotiationStatus): number {
  switch (status) {
    case 'FAILED':
      return 0.18;
    case 'ABANDONED':
      return 0.16;
    case 'EXPIRED':
      return 0.12;
    case 'LEAKED':
      return 0.22;
    case 'HARD_LOCKED':
      return 0.08;
    case 'SOFT_LOCKED':
      return 0.05;
    default:
      return 0;
  }
}

function statusStabilityModifier(status: NegotiationStatus): number {
  switch (status) {
    case 'RESOLVED':
      return 0.12;
    case 'ACTIVE':
      return 0.04;
    case 'OPEN':
      return 0.02;
    default:
      return 0;
  }
}

function computeEnvelopeExposure01(envelope: NegotiationOfferEnvelope | null): number {
  if (!envelope) {
    return 0;
  }
  return clamp01(
    Number(envelope.channelContext.witnessPressure) * 0.45 +
      Number(envelope.channelContext.secrecyPressure) * 0.2 +
      Number(envelope.channelContext.crowdHeat ?? asScore0To1(0)) * 0.2 +
      (envelope.channelContext.visibleToAudience ? 0.15 : 0),
  );
}

function computeEnvelopeAudienceAmplifier(envelope: NegotiationOfferEnvelope | null): number {
  if (!envelope) {
    return 0;
  }
  return clamp01(
    Number(envelope.channelContext.witnessPressure) * 0.5 +
      Number(envelope.channelContext.crowdHeat ?? asScore0To1(0)) * 0.35 +
      (envelope.channelContext.visibleToAudience ? 0.15 : 0),
  );
}

function latestOfferTimestamp(offer: ChatOffer): UnixMs {
  return offer.updatedAt ?? offer.createdAt;
}

function computeOfferAgeMs(now: NegotiationUnixMs, createdAt?: UnixMs): number {
  if (!createdAt) {
    return 0;
  }
  return Math.max(0, Number(now) - Number(createdAt));
}

function percentageFrom01(value: number): Score0To100 {
  return asScore0To100(Math.round(clamp01(value) * 100));
}


function serializeScorecard(scorecard: NegotiationReputationScorecard): JsonValue {
  return {
    trustLift100: Number(scorecard.trustLift100),
    trustDamage100: Number(scorecard.trustDamage100),
    prestigeSwing100: Number(scorecard.prestigeSwing100),
    rescuePriorityShift100: Number(scorecard.rescuePriorityShift100),
    leakSeverity100: Number(scorecard.leakSeverity100),
    faceLoss100: Number(scorecard.faceLoss100),
    faceRecovery100: Number(scorecard.faceRecovery100),
    stability100: Number(scorecard.stability100),
    socialVolatility100: Number(scorecard.socialVolatility100),
  };
}

function serializeOfferContext(context: NegotiationReputationOfferContext): JsonValue {
  return {
    counterOutcome: context.counterOutcome,
    status: context.status,
    offerCreatedAt: context.offerCreatedAt === undefined ? null : Number(context.offerCreatedAt),
    offerUpdatedAt: context.offerUpdatedAt === undefined ? null : Number(context.offerUpdatedAt),
    versionCreatedAt: context.versionCreatedAt === undefined ? null : Number(context.versionCreatedAt),
    envelopeCreatedAt: context.envelopeCreatedAt === undefined ? null : Number(context.envelopeCreatedAt),
    offerAgeMs: context.offerAgeMs,
    visibleToAudience: context.visibleToAudience,
    visibleToPlayer: context.visibleToPlayer,
    witnessPressure01: Number(context.witnessPressure01),
    secrecyPressure01: Number(context.secrecyPressure01),
    envelopeCrowdHeat01: Number(context.envelopeCrowdHeat01),
  };
}

function serializeEvidenceSummary(summary: NegotiationReputationEvidenceSummary): JsonValue {
  return {
    totalSignals: summary.totalSignals,
    highConfidenceSignals: summary.highConfidenceSignals,
    dominantSignalKind: summary.dominantSignalKind,
    leakSignal01: Number(summary.leakSignal01),
    trustSignal01: Number(summary.trustSignal01),
    aggressionSignal01: Number(summary.aggressionSignal01),
    helperNeedSignal01: Number(summary.helperNeedSignal01),
    faceThreatSignal01: Number(summary.faceThreatSignal01),
  };
}

function inferOutcomeFromResolution(

  resolution?: NegotiationResolution | null,
): NegotiationOutcome | null {
  if (!resolution) return null;
  return resolution.outcome ?? null;
}

function delta(
  surface: ReputationSurface,
  trustDelta: number,
  fearDelta: number,
  prestigeDelta: number,
  reliabilityDelta: number,
  rescueEligibilityDelta: number,
  reason: string,
  weight01: number,
): ReputationDelta {
  return {
    surface,
    trustDelta: clampSigned(trustDelta),
    fearDelta: clampSigned(fearDelta),
    prestigeDelta: clampSigned(prestigeDelta),
    reliabilityDelta: clampSigned(reliabilityDelta),
    rescueEligibilityDelta: clampSigned(rescueEligibilityDelta),
    reason,
    weight01: asScore0To1(clamp01(weight01)),
  };
}

function action(
  kind: ReputationPolicyAction['kind'],
  priority01: number,
  detail: string,
  metadata?: JsonValue,
): ReputationPolicyAction {
  return {
    kind,
    priority01: asScore0To1(clamp01(priority01)),
    detail,
    metadata,
  };
}

function prestigeSigned(eventKind: ReputationEventKind, magnitude: number): number {
  switch (eventKind) {
    case 'ACCEPTED':
    case 'FAIR_CLOSE':
    case 'FACE_SAVED':
    case 'COUNTERPUNCHED':
      return clampSigned(magnitude);
    case 'LEAKED':
    case 'ABANDONED':
    case 'FACE_LOST':
    case 'PREDATORY_CLOSE':
      return clampSigned(-magnitude);
    default:
      return clampSigned(magnitude * 0.2);
  }
}

function clampSigned(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

function createProjectionId(
  negotiationId: unknown,
  eventKind: ReputationEventKind,
  now: NegotiationUnixMs,
): string {
  return `neg-rep:${String(negotiationId)}:${eventKind}:${String(now)}`;
}

function trimMutable<T>(list: T[], max: number): void {
  if (list.length <= max) return;
  list.splice(0, list.length - max);
}

function dedupeActions(actions: readonly ReputationPolicyAction[]): readonly ReputationPolicyAction[] {
  const seen = new Set<string>();
  const result: ReputationPolicyAction[] = [];
  for (const actionItem of actions) {
    const key = `${actionItem.kind}|${Math.round(Number(actionItem.priority01) * 100)}|${actionItem.detail}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(actionItem);
    }
  }
  return result.sort((a, b) => Number(b.priority01) - Number(a.priority01));
}

function freezeReputationLedger(
  roomId: ChatRoomId,
  ledger: MutableReputationLedger,
): NegotiationReputationLedger {
  const byNegotiation: Record<string, readonly NegotiationReputationProjection[]> = {};
  for (const [key, value] of ledger.byNegotiation.entries()) {
    byNegotiation[key] = [...value];
  }
  return {
    roomId,
    projections: [...ledger.projections],
    byNegotiation,
    lastUpdatedAt: ledger.lastUpdatedAt,
  };
}





