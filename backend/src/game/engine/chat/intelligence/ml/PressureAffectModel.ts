/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT PRESSURE AFFECT MODEL
 * FILE: backend/src/game/engine/chat/intelligence/ml/PressureAffectModel.ts
 * VERSION: 2026.03.20-backend-pressure-affect.v1
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative backend pressure/affect scoring for the chat lane.
 *
 * This module isolates the parts of emotional state that should be dominated by
 * gameplay pressure rather than pure social interpretation:
 *
 * - intimidation
 * - frustration
 * - relief
 * - desperation
 * - confidence repair under pressure
 *
 * Why this file exists
 * --------------------
 * Frontend emotion scoring is useful for immediate adaptation, but the backend
 * needs a deterministic pressure-aware model that can:
 *
 * 1. evaluate pressure and exposure from authoritative room state,
 * 2. score affect under different pressure tiers,
 * 3. identify when silence should linger instead of helper spam,
 * 4. identify rescue urgency and comeback windows, and
 * 5. feed the durable emotion model without flattening authored gameplay law.
 *
 * Design doctrine
 * ---------------
 * - Pressure is not sentiment. It is runtime battlefield condition.
 * - Deal-room quiet may be predatory rather than calm.
 * - Global humiliation must score harder than private pressure.
 * - Rescue urgency and comeback readiness can coexist.
 * - Relief must rise slower than panic spikes unless a true stabilizer exists.
 * ============================================================================
 */

import type {
  ChatAudienceHeat,
  ChatFeatureSnapshot,
  ChatInferenceSnapshot,
  ChatLearningProfile,
  ChatRelationshipState,
  ChatRescueDecision,
  ChatRoomId,
  ChatSilenceDecision,
  ChatUserId,
  ChatVisibleChannel,
  JsonObject,
  Score01,
  UnixMs,
} from '../../types';

import type {
  ChatAuthority,
  ChatEmotionConfidenceBand,
  ChatEmotionDriverEvidence,
} from '../../../../../../../shared/contracts/chat/ChatEmotion';

import {
  CHAT_EMOTION_AXES,
  CHAT_EMOTION_OPERATING_STATES,
  clampEmotionScalar,
  computeEmotionConfidenceBand,
  createChatEmotionDriverId,
  describeEmotionVector,
} from '../../../../../../../shared/contracts/chat/ChatEmotion';

/* ========================================================================== *
 * MARK: Module identity
 * ========================================================================== */

export const CHAT_PRESSURE_AFFECT_MODEL_MODULE_NAME =
  'PZO_BACKEND_CHAT_PRESSURE_AFFECT_MODEL' as const;

export const CHAT_PRESSURE_AFFECT_MODEL_VERSION =
  '2026.03.20-backend-pressure-affect.v1' as const;

export const CHAT_PRESSURE_AFFECT_MODEL_RUNTIME_LAWS = Object.freeze([
  'Pressure is authoritative runtime state, not flavor text.',
  'Global stage pressure must score higher than intimate-channel pressure.',
  'Relief should repair slower than intimidation spikes unless a stabilizing event is present.',
  'Predatory quiet in deal room must not be mistaken for safety.',
  'Silence can be correct when authored pressure should linger.',
  'Rescue urgency and comeback readiness can exist at the same time.',
  'Driver evidence must remain explainable for replay, tuning, and training.',
] as const);

export const CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS = Object.freeze({
  pressureTierWeights: Object.freeze({
    NONE: 0.05,
    BUILDING: 0.24,
    ELEVATED: 0.46,
    HIGH: 0.72,
    CRITICAL: 0.94,
  }),
  channelExposureBias: Object.freeze({
    GLOBAL: 0.17,
    SYNDICATE: 0.08,
    DEAL_ROOM: 0.11,
    LOBBY: 0.04,
  }),
  swarmDirectionBias: Object.freeze({
    POSITIVE: -0.08,
    NEGATIVE: 0.18,
    NEUTRAL: 0.03,
  }),
  pressureIntimidationWeight: 0.28,
  hostileMomentumWeight: 0.26,
  roomHeatWeight: 0.17,
  churnPressureWeight: 0.13,
  embarrassmentCarryWeight: 0.11,
  frustrationPressureWeight: 0.24,
  ignoredHelperWeight: 0.18,
  outboundFailureWeight: 0.13,
  desperationChurnWeight: 0.26,
  desperationRescueWeight: 0.19,
  desperationSilenceWeight: 0.12,
  confidenceStabilityWeight: 0.19,
  confidenceRecoveryWeight: 0.15,
  confidenceFearInverseWeight: 0.11,
  reliefStabilizerWeight: 0.22,
  reliefHelperWeight: 0.15,
  reliefPressureInverseWeight: 0.13,
  comebackConfidenceThreshold: 0.54,
  rescueEscalationThreshold: 0.57,
  silenceSuitabilityThreshold: 0.59,
  publicHumiliationEscalationThreshold: 0.62,
  confidenceRepairDampening: 0.61,
  reliefRepairDampening: 0.58,
} as const);

/* ========================================================================== *
 * MARK: Public contracts
 * ========================================================================== */

export type PressureNarrativeState =
  | 'STEADY'
  | 'WATCHED'
  | 'EXPOSED'
  | 'HUNTED'
  | 'WOUNDED'
  | 'CORNERED'
  | 'BREATHING_ROOM'
  | 'COMEBACK_READY';

export interface PressureAffectModelInput {
  readonly userId: ChatUserId;
  readonly roomId: ChatRoomId;
  readonly channel: ChatVisibleChannel;
  readonly evaluatedAt?: UnixMs;
  readonly authority?: ChatAuthority;
  readonly featureSnapshot?: ChatFeatureSnapshot;
  readonly learningProfile?: ChatLearningProfile;
  readonly audienceHeat?: ChatAudienceHeat;
  readonly rescueDecision?: ChatRescueDecision;
  readonly silenceDecision?: ChatSilenceDecision;
  readonly inferenceSnapshot?: ChatInferenceSnapshot;
  readonly relationships?: readonly ChatRelationshipState[];
  readonly eventTags?: readonly string[];
  readonly metadata?: JsonObject;
}

export interface PressureAxisBreakdown {
  readonly intimidation01: Score01;
  readonly frustration01: Score01;
  readonly relief01: Score01;
  readonly desperation01: Score01;
  readonly confidenceRepair01: Score01;
}

export interface PressureAffectPolicyFlags {
  readonly shouldPreferSilence: boolean;
  readonly shouldEscalateRescue: boolean;
  readonly shouldPrimeComebackSpeech: boolean;
  readonly shouldRestrainCelebration: boolean;
  readonly shouldWarnCrowdPileOn: boolean;
}

export interface PressureAffectRecommendation {
  readonly state: PressureNarrativeState;
  readonly confidenceBand: ChatEmotionConfidenceBand;
  readonly policyFlags: PressureAffectPolicyFlags;
  readonly driverSummary: readonly string[];
}

export interface PressureAffectResult {
  readonly model: typeof CHAT_PRESSURE_AFFECT_MODEL_MODULE_NAME;
  readonly version: typeof CHAT_PRESSURE_AFFECT_MODEL_VERSION;
  readonly evaluatedAt: UnixMs;
  readonly authority: ChatAuthority;
  readonly userId: ChatUserId;
  readonly roomId: ChatRoomId;
  readonly channel: ChatVisibleChannel;
  readonly breakdown: PressureAxisBreakdown;
  readonly pressureSeverity01: Score01;
  readonly publicExposure01: Score01;
  readonly stabilizer01: Score01;
  readonly crowdThreat01: Score01;
  readonly confidenceBand: ChatEmotionConfidenceBand;
  readonly narrativeState: PressureNarrativeState;
  readonly drivers: readonly ChatEmotionDriverEvidence[];
  readonly recommendation: PressureAffectRecommendation;
  readonly notes: readonly string[];
  readonly metadata?: JsonObject;
}

export interface PressureAffectModelOptions {
  readonly defaults?: Partial<typeof CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS>;
  readonly authority?: ChatAuthority;
  readonly now?: () => UnixMs;
}

export interface PressureAffectModelApi {
  readonly moduleName: typeof CHAT_PRESSURE_AFFECT_MODEL_MODULE_NAME;
  readonly version: typeof CHAT_PRESSURE_AFFECT_MODEL_VERSION;
  readonly defaults: typeof CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS;
  evaluate(input: PressureAffectModelInput): PressureAffectResult;
  summarize(result: PressureAffectResult): readonly string[];
}

/* ========================================================================== *
 * MARK: Model implementation
 * ========================================================================== */

export class PressureAffectModel implements PressureAffectModelApi {
  public readonly moduleName = CHAT_PRESSURE_AFFECT_MODEL_MODULE_NAME;
  public readonly version = CHAT_PRESSURE_AFFECT_MODEL_VERSION;
  public readonly defaults: typeof CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS;

  private readonly authority: ChatAuthority;
  private readonly now: () => UnixMs;

  public constructor(options: PressureAffectModelOptions = {}) {
    this.defaults = mergeDefaults(options.defaults);
    this.authority = (options.authority ?? 'BACKEND_ENGINE') as ChatAuthority;
    this.now = options.now ?? (() => Date.now() as UnixMs);
  }

  public evaluate(input: PressureAffectModelInput): PressureAffectResult {
    const evaluatedAt = input.evaluatedAt ?? this.now();
    const feature = input.featureSnapshot;
    const profile = input.learningProfile;
    const audienceHeat = input.audienceHeat;
    const rescue = input.rescueDecision;
    const silence = input.silenceDecision;
    const inference = input.inferenceSnapshot;
    const relationships = input.relationships ?? [];

    const pressureSeverity = this.computePressureSeverity(input.channel, feature, audienceHeat);
    const publicExposure = this.computePublicExposure(input.channel, feature, audienceHeat, relationships);
    const stabilizer = this.computeStabilizer(profile, rescue, relationships);
    const crowdThreat = this.computeCrowdThreat(input.channel, feature, audienceHeat, inference);

    const intimidation01 = clampEmotionScalar(
      pressureSeverity * this.defaults.pressureIntimidationWeight +
      safe01(feature?.hostileMomentum01) * this.defaults.hostileMomentumWeight +
      crowdThreat * this.defaults.roomHeatWeight +
      safe01(profile?.affect.embarrassment01) * this.defaults.embarrassmentCarryWeight +
      publicExposure * 0.11,
    );

    const frustration01 = clampEmotionScalar(
      pressureSeverity * this.defaults.frustrationPressureWeight +
      normalizeIgnoredHelperCount(feature?.ignoredHelperCountWindow) * this.defaults.ignoredHelperWeight +
      inferOutboundFailure(feature) * this.defaults.outboundFailureWeight +
      safe01(profile?.affect.frustration01) * 0.18 +
      crowdThreat * 0.11,
    );

    const desperation01 = clampEmotionScalar(
      safe01(profile?.churnRisk01) * this.defaults.desperationChurnWeight +
      normalizeRescueUrgency(rescue) * this.defaults.desperationRescueWeight +
      pressureSeverity * 0.16 +
      (silence?.active ? 0.1 : 0) * this.defaults.desperationSilenceWeight +
      inferTimePressure(feature) * 0.12,
    );

    const confidenceRepairBase = clampEmotionScalar(
      safe01(profile?.affect.confidence01) * this.defaults.confidenceStabilityWeight +
      stabilizer * this.defaults.confidenceRecoveryWeight +
      invert01(intimidation01) * this.defaults.confidenceFearInverseWeight +
      invert01(frustration01) * 0.1 +
      inferComebackSeed(inference, feature) * 0.11,
    );

    const confidenceRepair01 = clampEmotionScalar(
      confidenceRepairBase *
        (pressureSeverity >= 0.72 ? this.defaults.confidenceRepairDampening : 1),
    );

    const reliefBase = clampEmotionScalar(
      stabilizer * this.defaults.reliefStabilizerWeight +
      helperPresenceFromRelationships(relationships) * this.defaults.reliefHelperWeight +
      invert01(pressureSeverity) * this.defaults.reliefPressureInverseWeight +
      inferRecentSurvival(inference) * 0.11,
    );

    const relief01 = clampEmotionScalar(
      reliefBase * (pressureSeverity >= 0.46 ? this.defaults.reliefRepairDampening : 1),
    );

    const drivers = Object.freeze([
      this.driver('intimidation', intimidation01, 'PRESSURE', pressureSeverity, {
        pressureSeverity01: pressureSeverity,
        hostileMomentum01: safe01(feature?.hostileMomentum01),
        crowdThreat01: crowdThreat,
        publicExposure01: publicExposure,
      }),
      this.driver('frustration', frustration01, 'FAILURE_LOOP', inferOutboundFailure(feature), {
        ignoredHelperCountWindow: feature?.ignoredHelperCountWindow ?? 0,
        messageCountWindow: feature?.messageCountWindow ?? 0,
      }),
      this.driver('desperation', desperation01, 'RESCUE_WINDOW', normalizeRescueUrgency(rescue), {
        churnRisk01: safe01(profile?.churnRisk01),
        silenceActive: Boolean(silence?.active),
      }),
      this.driver('relief', relief01, 'STABILIZER', stabilizer, {
        helperPresence01: helperPresenceFromRelationships(relationships),
        rescueTriggered: Boolean(rescue?.triggered),
      }),
      this.driver('confidence', confidenceRepair01, 'COMEBACK_WINDOW', inferComebackSeed(inference, feature), {
        confidenceBaseline01: safe01(profile?.affect.confidence01),
        stabilizer01: stabilizer,
      }),
    ]);

    const confidenceBand = computeEmotionConfidenceBand(
      average([
        invert01(pressureSeverity),
        confidenceRepair01,
        relief01,
        invert01(desperation01),
      ]),
    );

    const narrativeState = this.resolveNarrativeState({
      pressureSeverity,
      intimidation01,
      frustration01,
      relief01,
      desperation01,
      confidenceRepair01,
      publicExposure,
    });

    const policyFlags = Object.freeze({
      shouldPreferSilence:
        pressureSeverity >= this.defaults.silenceSuitabilityThreshold &&
        relief01 < 0.43 &&
        stabilizer < 0.44,
      shouldEscalateRescue:
        desperation01 >= this.defaults.rescueEscalationThreshold ||
        (frustration01 >= 0.66 && pressureSeverity >= 0.72),
      shouldPrimeComebackSpeech:
        confidenceRepair01 >= this.defaults.comebackConfidenceThreshold &&
        intimidation01 <= 0.66,
      shouldRestrainCelebration:
        pressureSeverity >= 0.5 || relief01 < 0.41,
      shouldWarnCrowdPileOn:
        publicExposure >= this.defaults.publicHumiliationEscalationThreshold &&
        crowdThreat >= 0.53,
    } satisfies PressureAffectPolicyFlags);

    const recommendation = Object.freeze({
      state: narrativeState,
      confidenceBand,
      policyFlags,
      driverSummary: Object.freeze(this.summarizeDrivers(drivers)),
    } satisfies PressureAffectRecommendation);

    const notes = Object.freeze(this.buildNotes({
      input,
      pressureSeverity,
      publicExposure,
      stabilizer,
      crowdThreat,
      intimidation01,
      frustration01,
      relief01,
      desperation01,
      confidenceRepair01,
      recommendation,
    }));

    return Object.freeze({
      model: CHAT_PRESSURE_AFFECT_MODEL_MODULE_NAME,
      version: CHAT_PRESSURE_AFFECT_MODEL_VERSION,
      evaluatedAt,
      authority: input.authority ?? this.authority,
      userId: input.userId,
      roomId: input.roomId,
      channel: input.channel,
      breakdown: Object.freeze({
        intimidation01,
        frustration01,
        relief01,
        desperation01,
        confidenceRepair01,
      }),
      pressureSeverity01: pressureSeverity,
      publicExposure01: publicExposure,
      stabilizer01: stabilizer,
      crowdThreat01: crowdThreat,
      confidenceBand,
      narrativeState,
      drivers,
      recommendation,
      notes,
      metadata: input.metadata,
    });
  }

  public summarize(result: PressureAffectResult): readonly string[] {
    return Object.freeze([
      `state=${result.narrativeState}`,
      `pressure=${toPct(result.pressureSeverity01)}`,
      `exposure=${toPct(result.publicExposure01)}`,
      `intimidation=${toPct(result.breakdown.intimidation01)}`,
      `frustration=${toPct(result.breakdown.frustration01)}`,
      `desperation=${toPct(result.breakdown.desperation01)}`,
      `relief=${toPct(result.breakdown.relief01)}`,
      `confidenceRepair=${toPct(result.breakdown.confidenceRepair01)}`,
      ...result.recommendation.driverSummary,
    ]);
  }

  private computePressureSeverity(
    channel: ChatVisibleChannel,
    feature?: ChatFeatureSnapshot,
    audienceHeat?: ChatAudienceHeat,
  ): Score01 {
    const tierWeight = this.defaults.pressureTierWeights[feature?.pressureTier ?? 'NONE'];
    const hostileMomentum = safe01(feature?.hostileMomentum01);
    const heat = safe01(feature?.roomHeat01);
    const crowd = safe01(audienceHeat?.heat01);
    const channelBias = this.defaults.channelExposureBias[channel] ?? 0;

    return clampEmotionScalar(
      tierWeight * 0.46 +
        hostileMomentum * 0.22 +
        heat * 0.17 +
        crowd * 0.1 +
        channelBias,
    );
  }

  private computePublicExposure(
    channel: ChatVisibleChannel,
    feature?: ChatFeatureSnapshot,
    audienceHeat?: ChatAudienceHeat,
    relationships: readonly ChatRelationshipState[] = [],
  ): Score01 {
    const channelBias = this.defaults.channelExposureBias[channel] ?? 0;
    const witnessFactor = normalizeCount(feature?.inboundNpcCountWindow, 0.24);
    const crowd = safe01(audienceHeat?.heat01);
    const rivalryThreat = average(
      relationships.map((value) => safe01(value.rivalry01) * 0.5 + safe01(value.contempt01) * 0.5),
      0,
    );
    return clampEmotionScalar(channelBias + witnessFactor + crowd * 0.26 + rivalryThreat * 0.19);
  }

  private computeStabilizer(
    profile?: ChatLearningProfile,
    rescue?: ChatRescueDecision,
    relationships: readonly ChatRelationshipState[] = [],
  ): Score01 {
    const helperTrust = average(
      relationships.map((value) => safe01(value.trust01) * 0.58 + safe01(value.rescueDebt01) * 0.42),
      0,
    );
    const attachment = safe01(profile?.affect.attachment01);
    const relief = safe01(profile?.affect.relief01);
    const rescueBoost = normalizeRescueUrgencyInverse(rescue);
    return clampEmotionScalar(helperTrust * 0.34 + attachment * 0.22 + relief * 0.16 + rescueBoost * 0.14);
  }

  private computeCrowdThreat(
    channel: ChatVisibleChannel,
    feature?: ChatFeatureSnapshot,
    audienceHeat?: ChatAudienceHeat,
    inference?: ChatInferenceSnapshot,
  ): Score01 {
    const heat = safe01(audienceHeat?.heat01 ?? feature?.roomHeat01);
    const swarmBias = audienceHeat
      ? this.defaults.swarmDirectionBias[audienceHeat.swarmDirection] ?? 0
      : 0;
    const hostility = safe01(feature?.hostileMomentum01);
    const haterTargeting = safe01(inference?.haterTargeting01);
    const channelBias = channel === 'GLOBAL' ? 0.12 : channel === 'DEAL_ROOM' ? 0.07 : 0.03;
    return clampEmotionScalar(heat * 0.31 + hostility * 0.27 + haterTargeting * 0.16 + swarmBias + channelBias);
  }

  private resolveNarrativeState(input: {
    readonly pressureSeverity: Score01;
    readonly intimidation01: Score01;
    readonly frustration01: Score01;
    readonly relief01: Score01;
    readonly desperation01: Score01;
    readonly confidenceRepair01: Score01;
    readonly publicExposure: Score01;
  }): PressureNarrativeState {
    if (input.relief01 >= 0.61 && input.pressureSeverity <= 0.42) return 'BREATHING_ROOM';
    if (
      input.confidenceRepair01 >= this.defaults.comebackConfidenceThreshold &&
      input.intimidation01 <= 0.59 &&
      input.desperation01 <= 0.53
    ) {
      return 'COMEBACK_READY';
    }
    if (input.desperation01 >= 0.76 || (input.pressureSeverity >= 0.84 && input.frustration01 >= 0.66)) {
      return 'CORNERED';
    }
    if (input.intimidation01 >= 0.7 && input.publicExposure >= 0.6) return 'HUNTED';
    if (input.frustration01 >= 0.68) return 'WOUNDED';
    if (input.publicExposure >= 0.52) return 'EXPOSED';
    if (input.pressureSeverity >= 0.46) return 'WATCHED';
    return 'STEADY';
  }

  private driver(
    axis: 'intimidation' | 'frustration' | 'desperation' | 'relief' | 'confidence',
    score: Score01,
    reason: string,
    intensity: number,
    metadata: JsonObject,
  ): ChatEmotionDriverEvidence {
    const kindMap: Record<string, ChatEmotionDriverEvidence['kind']> = {
      intimidation: 'PRESSURE_TIER',
      frustration: 'FAILED_COUNTERPLAY',
      desperation: 'RESCUE_TRIGGER',
      relief: 'HELPER_PRESENCE',
      confidence: 'COMEBACK_WINDOW',
    };

    return Object.freeze({
      driverId: createChatEmotionDriverId(),
      kind: kindMap[axis],
      axis:
        axis === 'confidence'
          ? 'CONFIDENCE'
          : axis === 'frustration'
          ? 'FRUSTRATION'
          : axis === 'relief'
          ? 'RELIEF'
          : axis === 'desperation'
          ? 'DESPERATION'
          : 'INTIMIDATION',
      sourceAuthority: this.authority,
      source: 'SYSTEM_INFERENCE',
      weight01: clampEmotionScalar(intensity),
      signedImpact01: score,
      evidence: reason,
      observedAtUnixMs: this.now(),
      metadata,
    });
  }

  private summarizeDrivers(drivers: readonly ChatEmotionDriverEvidence[]): readonly string[] {
    return drivers.map((driver) => `${driver.axis.toLowerCase()}<=${driver.kind}:${toPct(driver.signedImpact01)}`);
  }

  private buildNotes(input: {
    readonly input: PressureAffectModelInput;
    readonly pressureSeverity: Score01;
    readonly publicExposure: Score01;
    readonly stabilizer: Score01;
    readonly crowdThreat: Score01;
    readonly intimidation01: Score01;
    readonly frustration01: Score01;
    readonly relief01: Score01;
    readonly desperation01: Score01;
    readonly confidenceRepair01: Score01;
    readonly recommendation: PressureAffectRecommendation;
  }): readonly string[] {
    const notes: string[] = [];
    notes.push(`channel=${input.input.channel}`);
    notes.push(`pressureSeverity=${toPct(input.pressureSeverity)}`);
    notes.push(`publicExposure=${toPct(input.publicExposure)}`);
    notes.push(`stabilizer=${toPct(input.stabilizer)}`);
    notes.push(`crowdThreat=${toPct(input.crowdThreat)}`);
    notes.push(`intimidation=${toPct(input.intimidation01)}`);
    notes.push(`frustration=${toPct(input.frustration01)}`);
    notes.push(`relief=${toPct(input.relief01)}`);
    notes.push(`desperation=${toPct(input.desperation01)}`);
    notes.push(`confidenceRepair=${toPct(input.confidenceRepair01)}`);
    notes.push(`narrativeState=${input.recommendation.state}`);
    if (input.recommendation.policyFlags.shouldPreferSilence) notes.push('policy=silence_linger');
    if (input.recommendation.policyFlags.shouldEscalateRescue) notes.push('policy=rescue_escalate');
    if (input.recommendation.policyFlags.shouldPrimeComebackSpeech) notes.push('policy=comeback_prime');
    if (input.recommendation.policyFlags.shouldRestrainCelebration) notes.push('policy=celebration_hold');
    if (input.recommendation.policyFlags.shouldWarnCrowdPileOn) notes.push('policy=crowd_pile_on_warn');
    if (input.input.eventTags?.length) notes.push(`eventTags=${input.input.eventTags.join('|')}`);
    return notes;
  }
}

/* ========================================================================== *
 * MARK: Public helpers
 * ========================================================================== */

export function createPressureAffectModel(
  options: PressureAffectModelOptions = {},
): PressureAffectModel {
  return new PressureAffectModel(options);
}

export function evaluatePressureAffect(
  input: PressureAffectModelInput,
  options: PressureAffectModelOptions = {},
): PressureAffectResult {
  return createPressureAffectModel(options).evaluate(input);
}

export function summarizePressureAffect(
  result: PressureAffectResult,
): readonly string[] {
  return createPressureAffectModel().summarize(result);
}

/* ========================================================================== *
 * MARK: Internal helpers
 * ========================================================================== */

function mergeDefaults(
  overrides?: Partial<typeof CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS>,
): typeof CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS {
  return Object.freeze({
    ...CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS,
    ...(overrides ?? {}),
    pressureTierWeights: Object.freeze({
      ...CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS.pressureTierWeights,
      ...(overrides?.pressureTierWeights ?? {}),
    }),
    channelExposureBias: Object.freeze({
      ...CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS.channelExposureBias,
      ...(overrides?.channelExposureBias ?? {}),
    }),
    swarmDirectionBias: Object.freeze({
      ...CHAT_PRESSURE_AFFECT_MODEL_DEFAULTS.swarmDirectionBias,
      ...(overrides?.swarmDirectionBias ?? {}),
    }),
  });
}

function safe01(value: Score01 | number | undefined | null): Score01 {
  return clampEmotionScalar(Number(value ?? 0));
}

function average(values: readonly (number | undefined)[], fallback = 0): Score01 {
  const filtered = values.filter((value): value is number => Number.isFinite(value as number));
  if (!filtered.length) return clampEmotionScalar(fallback);
  return clampEmotionScalar(filtered.reduce((sum, value) => sum + value, 0) / filtered.length);
}

function invert01(value: Score01 | number | undefined): Score01 {
  return clampEmotionScalar(1 - Number(value ?? 0));
}

function normalizeCount(value: number | undefined, weight = 0.12): Score01 {
  return clampEmotionScalar(Math.min(1, Number(value ?? 0) * weight));
}

function normalizeIgnoredHelperCount(value: number | undefined): Score01 {
  return clampEmotionScalar(Math.min(1, Number(value ?? 0) * 0.19));
}

function normalizeRescueUrgency(value: ChatRescueDecision | undefined): Score01 {
  if (!value?.triggered) return clampEmotionScalar(0);
  switch (value.urgency) {
    case 'CRITICAL':
      return clampEmotionScalar(1);
    case 'HARD':
      return clampEmotionScalar(0.8);
    case 'MEDIUM':
      return clampEmotionScalar(0.56);
    case 'SOFT':
      return clampEmotionScalar(0.34);
    default:
      return clampEmotionScalar(0.14);
  }
}

function normalizeRescueUrgencyInverse(value: ChatRescueDecision | undefined): Score01 {
  return invert01(normalizeRescueUrgency(value));
}

function inferOutboundFailure(feature?: ChatFeatureSnapshot): Score01 {
  if (!feature) return clampEmotionScalar(0);
  const outbound = Math.max(1, feature.outboundPlayerCountWindow);
  const ignored = feature.ignoredHelperCountWindow;
  const silenceTax = feature.messageCountWindow === 0 ? 0.08 : 0;
  return clampEmotionScalar(Math.min(1, ignored / outbound + silenceTax));
}

function inferTimePressure(feature?: ChatFeatureSnapshot): Score01 {
  const map: Record<string, number> = {
    NONE: 0,
    BUILDING: 0.22,
    ELEVATED: 0.46,
    HIGH: 0.71,
    CRITICAL: 0.93,
  };
  return clampEmotionScalar(map[feature?.pressureTier ?? 'NONE'] ?? 0);
}

function inferComebackSeed(
  inference?: ChatInferenceSnapshot,
  feature?: ChatFeatureSnapshot,
): Score01 {
  return clampEmotionScalar(
    safe01(inference?.engagement01) * 0.34 +
      invert01(feature?.churnRisk01) * 0.22 +
      invert01(feature?.hostileMomentum01) * 0.12,
  );
}

function inferRecentSurvival(inference?: ChatInferenceSnapshot): Score01 {
  return clampEmotionScalar(
    safe01(inference?.helperTiming01) * 0.23 +
      invert01(inference?.toxicityRisk01) * 0.11,
  );
}

function helperPresenceFromRelationships(
  relationships: readonly ChatRelationshipState[],
): Score01 {
  return average(
    relationships.map((value) => safe01(value.trust01) * 0.52 + safe01(value.rescueDebt01) * 0.48),
    0,
  );
}

function toPct(value: Score01 | number): string {
  return `${Math.round(Number(value) * 100)}`;
}
