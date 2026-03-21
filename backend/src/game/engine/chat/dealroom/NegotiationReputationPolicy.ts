
/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT DEALROOM NEGOTIATION REPUTATION POLICY
 * FILE: backend/src/game/engine/chat/dealroom/NegotiationReputationPolicy.ts
 * VERSION: 2026.03.19
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
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

export interface NegotiationReputationProjection {
  readonly projectionId: string;
  readonly roomId: ChatRoomId;
  readonly negotiationId: string;
  readonly projectedAt: NegotiationUnixMs;
  readonly eventKind: ReputationEventKind;
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
    const outcome = request.outcome ?? inferOutcomeFromResolution(request.resolution);
    const eventKind = determineEventKind(negotiation, outcome, request.resolution, offer, request.latestLeakThreat);
    const dominantPressure = negotiationInferDominantPressure(request.latestInference);
    const actorState = negotiationPrimaryActorState(negotiation, negotiation.parties.primary.actorId);
    const deltas: ReputationDelta[] = [];
    const actions: ReputationPolicyAction[] = [];

    const trustDamage01 = computeTrustDamage01({
      negotiation,
      offer,
      priorOffer,
      outcome,
      latestLeakThreat: request.latestLeakThreat,
      latestInference: request.latestInference,
      options: this.options,
    });

    const trustLift01 = computeTrustLift01({
      negotiation,
      offer,
      priorOffer,
      outcome,
      options: this.options,
    });

    const prestigeSwing01 = computePrestigeSwing01({
      negotiation,
      offer,
      priorOffer,
      outcome,
      eventKind,
    });

    const rescuePriorityShift01 = computeRescueShift01({
      negotiation,
      offer,
      outcome,
      latestInference: request.latestInference,
      options: this.options,
    });

    const leakSeverity01 = computeLeakSeverity01({
      negotiation,
      offer,
      latestLeakThreat: request.latestLeakThreat,
      options: this.options,
    });

    const faceLoss01 = computeFaceLoss01({
      negotiation,
      offer,
      priorOffer,
      outcome,
      eventKind,
      actorState,
    });

    const faceRecovery01 = computeFaceRecovery01({
      negotiation,
      offer,
      priorOffer,
      outcome,
      eventKind,
      actorState,
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
    }));

    const projection: NegotiationReputationProjection = {
      projectionId: createProjectionId(negotiation.negotiationId, eventKind, now),
      roomId: request.roomId,
      negotiationId: String(negotiation.negotiationId),
      projectedAt: now,
      eventKind,
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
      debug: {
        outcome: outcome ?? null,
        latestOfferId: negotiationLatestOfferId(negotiation) ?? null,
        hasOffer: Boolean(offer),
        hasPriorOffer: Boolean(priorOffer),
        negotiationSupportsRescue: negotiationSupportsRescue(negotiation),
        negotiationHasLeakThreat: negotiationHasLeakThreat(negotiation),
        audiencePressure: negotiationHasAudiencePressure(negotiation),
        traceLabel: request.traceLabel ?? null,
      },
    };

    this.recordProjection(projection);

    this.logger.debug('chat.dealroom.reputation.projected', {
      roomId: request.roomId as unknown as string,
      negotiationId: String(negotiation.negotiationId),
      eventKind,
      trustDamage01,
      trustLift01,
      prestigeSwing01,
      rescuePriorityShift01,
      leakSeverity01,
      faceLoss01,
      faceRecovery01,
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
  }): readonly ReputationPolicyAction[] {
    const actions: ReputationPolicyAction[] = [];

    if (input.leakSeverity01 > 0.42) {
      actions.push(action(
        'OPEN_WITNESS_THREAD',
        input.leakSeverity01,
        'Leak pressure is high enough to justify witness-thread follow-up.',
        { leakSeverity01: input.leakSeverity01 },
      ));
    } else {
      actions.push(action(
        'SUPPRESS_GLOBAL_LEAK',
        clamp01(1 - input.leakSeverity01),
        'Leak pressure is low enough to suppress unnecessary global spill.',
      ));
    }

    if (input.rescuePriorityShift01 > 0.34 || input.faceLoss01 > 0.5) {
      actions.push(action(
        'ENABLE_RESCUE_PRIORITY',
        Math.max(input.rescuePriorityShift01, input.faceLoss01),
        'Negotiation outcome indicates rescue priority should increase.',
      ));
      actions.push(action(
        'BOOST_HELPER_ATTENTION',
        Math.max(input.rescuePriorityShift01, input.faceLoss01),
        'Helper network should track this actor more aggressively.',
      ));
    } else if (input.faceRecovery01 > 0.44 && input.trustLift01 > 0.38) {
      actions.push(action(
        'REDUCE_RESCUE_PRIORITY',
        Math.max(input.faceRecovery01, input.trustLift01),
        'Recent recovery reduces immediate rescue urgency.',
      ));
      actions.push(action(
        'DECREASE_HELPER_ATTENTION',
        clamp01(input.faceRecovery01 * 0.7),
        'Helper attention can relax after a strong recovery.',
      ));
    }

    if (input.faceLoss01 > 0.48 || input.leakSeverity01 > 0.44) {
      actions.push(action(
        'INCREASE_RIVAL_FOCUS',
        Math.max(input.faceLoss01, input.leakSeverity01),
        'Rivals are likely to press further after visible weakness.',
      ));
      actions.push(action(
        'ARCHIVE_FACE_LOSS',
        input.faceLoss01,
        'Archive face-loss memory for future callbacks.',
      ));
    }

    if (input.faceRecovery01 > 0.42 || (input.outcome === 'ACCEPTED' && input.trustLift01 > 0.36)) {
      actions.push(action(
        'REDUCE_RIVAL_FOCUS',
        Math.max(input.faceRecovery01, input.trustLift01),
        'Rival focus can soften after a strong, witnessed recovery.',
      ));
      actions.push(action(
        'ARCHIVE_FACE_RECOVERY',
        input.faceRecovery01,
        'Archive face-recovery memory for later prestige callbacks.',
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
  return clamp01(
    (1 - offerTrust) * 0.34 * input.options.trustDamageMultiplier +
      hostility * 0.14 +
      leakPressure * 0.23 * input.options.leakDamageMultiplier +
      inferenceTrustBreak * 0.17 +
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
  readonly options: Required<Omit<NegotiationReputationPolicyOptions, 'clock' | 'logger'>>;
}): number {
  const trustProjection = input.offer ? Number(chatOfferProjectedTrustworthiness(input.offer)) : 0.48;
  const softness = input.offer ? Number(chatOfferProjectedSoftness(input.offer)) : 0.4;
  const concessions = input.offer ? chatOfferConcessionCount(input.offer) : 0;
  const acceptance = input.outcome === 'ACCEPTED' ? 0.18 : 0;
  const fairClose = input.outcome === 'ACCEPTED' ? 0.14 : 0;
  const helper = input.offer && chatOfferShouldTriggerHelperReview(input.offer) ? 0.06 : 0;
  return clamp01(
    trustProjection * 0.38 +
      softness * 0.12 +
      clamp01(concessions / 4) * 0.16 +
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
}): number {
  const hostility = input.offer ? Number(chatOfferProjectedHostility(input.offer)) : 0.3;
  const witness = negotiationHasAudiencePressure(input.negotiation) ? 0.18 : 0.06;
  const accepted = input.outcome === 'ACCEPTED' ? 0.18 : 0;
  const leak = input.outcome === 'LEAKED' ? -0.22 : 0;
  const faceLoss = input.eventKind === 'FACE_LOST' ? -0.18 : 0;
  const faceSave = input.eventKind === 'FACE_SAVED' ? 0.14 : 0;
  return clamp01(Math.abs(hostility * 0.32 + witness + accepted + leak + faceLoss + faceSave));
}

function computeRescueShift01(input: {
  readonly negotiation: ChatNegotiation;
  readonly offer: ChatOffer | null;
  readonly outcome: NegotiationOutcome | null | undefined;
  readonly latestInference?: NegotiationInferenceFrame | null;
  readonly options: Required<Omit<NegotiationReputationPolicyOptions, 'clock' | 'logger'>>;
}): number {
  const rescueSupport = negotiationSupportsRescue(input.negotiation) ? 0.22 : 0;
  const helperReview = input.offer && chatOfferShouldTriggerHelperReview(input.offer) ? 0.12 : 0;
  const inference = input.latestInference ? Number(input.latestInference.risk.rescueNeed ?? asScore0To1(0)) : 0;
  const collapse = input.outcome === 'COLLAPSED' || input.outcome === 'WITHDRAWN' ? 0.18 : 0;
  return clamp01((rescueSupport + helperReview + inference + collapse) * input.options.rescueGraceMultiplier);
}

function computeLeakSeverity01(input: {
  readonly negotiation: ChatNegotiation;
  readonly offer: ChatOffer | null;
  readonly latestLeakThreat?: NegotiationLeakThreat | null;
  readonly options: Required<Omit<NegotiationReputationPolicyOptions, 'clock' | 'logger'>>;
}): number {
  const leakThreat = input.latestLeakThreat ? Number(input.latestLeakThreat.severity.normalized) : (negotiationHasLeakThreat(input.negotiation) ? 0.34 : 0);
  const leakableOffer = input.offer && chatOfferCanLeak(input.offer) ? 0.24 : 0;
  const witness = negotiationHasAudiencePressure(input.negotiation) ? 0.12 : 0;
  return clamp01((leakThreat + leakableOffer + witness) * input.options.leakDamageMultiplier);
}

function computeFaceLoss01(input: {
  readonly negotiation: ChatNegotiation;
  readonly offer: ChatOffer | null;
  readonly priorOffer: ChatOffer | null;
  readonly outcome: NegotiationOutcome | null | undefined;
  readonly eventKind: ReputationEventKind;
  readonly actorState: NegotiationActorState | null | undefined;
}): number {
  const hostility = input.offer ? Number(chatOfferProjectedHostility(input.offer)) : 0.25;
  const rejection = input.outcome === 'REJECTED' ? 0.24 : 0;
  const leak = input.outcome === 'LEAKED' ? 0.3 : 0;
  const abandonment = input.outcome === 'WITHDRAWN' ? 0.26 : 0;
  const panic = input.actorState ? Number(input.actorState.emotion.frustration ?? asScore0To1(0)) * 0.18 : 0;
  const witness = negotiationHasAudiencePressure(input.negotiation) ? 0.18 : 0.08;
  const faceKind = input.eventKind === 'FACE_LOST' ? 0.22 : 0;
  return clamp01(hostility * 0.14 + rejection + leak + abandonment + panic + witness + faceKind);
}

function computeFaceRecovery01(input: {
  readonly negotiation: ChatNegotiation;
  readonly offer: ChatOffer | null;
  readonly priorOffer: ChatOffer | null;
  readonly outcome: NegotiationOutcome | null | undefined;
  readonly eventKind: ReputationEventKind;
  readonly actorState: NegotiationActorState | null | undefined;
}): number {
  const trust = input.offer ? Number(chatOfferProjectedTrustworthiness(input.offer)) : 0.42;
  const softness = input.offer ? Number(chatOfferProjectedSoftness(input.offer)) : 0.33;
  const accepted = input.outcome === 'ACCEPTED' ? 0.26 : 0;
  const settled = input.outcome === 'ACCEPTED' ? 0.18 : 0;
  const faceKind = input.eventKind === 'FACE_SAVED' ? 0.18 : 0;
  const confidence = input.actorState ? Number(input.actorState.emotion.confidence ?? asScore0To1(0)) * 0.12 : 0;
  return clamp01(trust * 0.18 + softness * 0.1 + accepted + settled + faceKind + confidence);
}

function determineEventKind(
  negotiation: ChatNegotiation,
  outcome: NegotiationOutcome | null | undefined,
  resolution: NegotiationResolution | null | undefined,
  offer: ChatOffer | null,
  latestLeakThreat?: NegotiationLeakThreat | null,
): ReputationEventKind {
  if (outcome === 'LEAKED') return 'LEAKED';
  if (outcome === 'WITHDRAWN') return 'ABANDONED';
  if (outcome === 'REJECTED') return 'REJECTED';
  if (outcome === 'ACCEPTED') return 'ACCEPTED';
  if (outcome === 'FACE_SAVED') return 'FAIR_CLOSE';
  if (offer && chatOfferShouldTriggerHelperReview(offer)) return 'HELPER_VALIDATED';
  if (latestLeakThreat && Number(latestLeakThreat.severity.normalized) > 0.44) return 'PRESSURED';
  if (negotiationHasLeakThreat(negotiation)) return 'PRESSURED';
  return 'OPENED';
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
