/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT ATTACHMENT MODEL
 * FILE: backend/src/game/engine/chat/intelligence/ml/AttachmentModel.ts
 * VERSION: 2026.03.21-backend-attachment-model.v2
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Backend relational-affect scoring for attachment and trust intensity in the
 * authoritative chat lane.
 *
 * This model exists because attachment, trust, familiarity, rivalry memory,
 * rescue debt, and follow-persona bias should not be inferred only from the
 * last few visible messages. They are continuity-bearing signals that need
 * backend durability and lawful evaluation across rooms, scenes, and mode
 * transitions.
 *
 * Core outputs
 * ------------
 * - attachment intensity
 * - trust intensity
 * - rivalry contamination
 * - rescue gravity
 * - helper affinity strength
 * - follow-persona recommendation
 * - explainable emotional drivers aligned to shared contracts
 *
 * Design doctrine
 * ---------------
 * - Attachment is continuity, not softness.
 * - Trust must grow slower than contempt spikes unless rescue debt exists.
 * - Rivalry can coexist with fascination and should not erase recognition.
 * - Helper timing should prefer earned affinity over generic repetition.
 * - Backend attachment truth should be replayable and explainable.
 * - Shared emotion contracts are sovereign; local models must conform.
 * ============================================================================
 */

import type {
  ChatFeatureSnapshot,
  ChatLearningProfile,
  ChatRelationshipState,
  ChatRoomId,
  ChatUserId,
  ChatVisibleChannel,
  JsonObject,
  Score01,
  UnixMs,
} from '../../types';

import type { ChatAuthority } from '../../../../../../../shared/contracts/chat/ChatEvents';

import type {
  ChatEmotionConfidenceBand,
  ChatEmotionDriverEvidence,
  ChatEmotionDriverKind,
  ChatEmotionSourceKind,
} from '../../../../../../../shared/contracts/chat/ChatEmotion';

import {
  clampEmotionScalar,
  computeEmotionConfidenceBand,
  createChatEmotionDriverId,
} from '../../../../../../../shared/contracts/chat/ChatEmotion';

/* ========================================================================== *
 * MARK: Module identity
 * ========================================================================== */

export const CHAT_ATTACHMENT_MODEL_MODULE_NAME =
  'PZO_BACKEND_CHAT_ATTACHMENT_MODEL' as const;

export const CHAT_ATTACHMENT_MODEL_VERSION =
  '2026.03.21-backend-attachment-model.v2' as const;

export const CHAT_ATTACHMENT_MODEL_RUNTIME_LAWS = Object.freeze([
  'Attachment is continuity-bearing recognition, not sentiment garnish.',
  'Trust should rise slower than rivalry unless rescue debt and familiarity support it.',
  'Helper affinity should prefer earned history over generic availability.',
  'Rivalry contamination should inform timing without erasing recognition.',
  'Relationship output must remain deterministic and replayable.',
  'Shared emotional driver evidence must conform to sovereign shared contracts.',
] as const);

export const CHAT_ATTACHMENT_MODEL_DEFAULTS = Object.freeze({
  trustWeight: 0.24,
  rescueDebtWeight: 0.18,
  fascinationWeight: 0.16,
  familiarityWeight: 0.14,
  rivalryPenaltyWeight: 0.17,
  contemptPenaltyWeight: 0.13,
  fearPenaltyWeight: 0.11,
  confidenceBaselineWeight: 0.11,
  helperAffinityThreshold: 0.54,
  followPersonaThreshold: 0.58,
  rivalryOverrideThreshold: 0.72,
  trustRepairDampening: 0.66,
  dealRoomTrustPenalty: 0.08,
  syndicateTrustBonus: 0.06,
  helperExposureBonus: 0.09,
  haterExposurePenalty: 0.08,
  featureHelperBiasWeight: 0.08,
  featurePressurePenaltyWeight: 0.06,
  featureRecoveryBonusWeight: 0.06,
  featureWitnessBoostWeight: 0.05,
  candidateTopWeight: 0.42,
  candidateRemainderWeight: 0.58,
  candidateSoftCap: 8,
} as const);

/* ========================================================================== *
 * MARK: Public contracts
 * ========================================================================== */

export type AttachmentNarrativeState =
  | 'DISCONNECTED'
  | 'CAUTIOUS'
  | 'RECOGNIZED'
  | 'HELPER_LOCK'
  | 'RIVALRY_BIND'
  | 'TRUST_STABLE';

export interface AttachmentModelInput {
  readonly userId: ChatUserId;
  readonly roomId: ChatRoomId;
  readonly channel: ChatVisibleChannel;
  readonly evaluatedAt?: UnixMs;
  readonly authority?: ChatAuthority;
  readonly relationships: readonly ChatRelationshipState[];
  readonly learningProfile?: ChatLearningProfile;
  readonly featureSnapshot?: ChatFeatureSnapshot;
  readonly helperPersonaIds?: readonly string[];
  readonly haterPersonaIds?: readonly string[];
  readonly metadata?: JsonObject;
}

export interface AttachmentAffinityCandidate {
  readonly actorId: string;
  readonly attachment01: Score01;
  readonly trust01: Score01;
  readonly rivalryContamination01: Score01;
  readonly helperAffinity01: Score01;
  readonly rescueGravity01: Score01;
  readonly familiarity01: Score01;
  readonly shouldFollowAcrossModes: boolean;
  readonly reasons: readonly string[];
}

export interface AttachmentAssessment {
  readonly model: typeof CHAT_ATTACHMENT_MODEL_MODULE_NAME;
  readonly version: typeof CHAT_ATTACHMENT_MODEL_VERSION;
  readonly evaluatedAt: UnixMs;
  readonly authority: ChatAuthority;
  readonly userId: ChatUserId;
  readonly roomId: ChatRoomId;
  readonly channel: ChatVisibleChannel;
  readonly attachment01: Score01;
  readonly trust01: Score01;
  readonly rivalryContamination01: Score01;
  readonly rescueGravity01: Score01;
  readonly familiarity01: Score01;
  readonly helperAffinity01: Score01;
  readonly confidenceBand: ChatEmotionConfidenceBand;
  readonly state: AttachmentNarrativeState;
  readonly followPersonaId?: string;
  readonly drivers: readonly ChatEmotionDriverEvidence[];
  readonly candidates: readonly AttachmentAffinityCandidate[];
  readonly notes: readonly string[];
  readonly metadata?: JsonObject;
}

export interface AttachmentModelOptions {
  readonly defaults?: Partial<typeof CHAT_ATTACHMENT_MODEL_DEFAULTS>;
  readonly authority?: ChatAuthority;
  readonly now?: () => UnixMs;
}

export interface AttachmentModelApi {
  readonly moduleName: typeof CHAT_ATTACHMENT_MODEL_MODULE_NAME;
  readonly version: typeof CHAT_ATTACHMENT_MODEL_VERSION;
  readonly defaults: typeof CHAT_ATTACHMENT_MODEL_DEFAULTS;
  assess(input: AttachmentModelInput): AttachmentAssessment;
  summarize(result: AttachmentAssessment): readonly string[];
}

interface AttachmentFeatureBias {
  readonly helperBias01: Score01;
  readonly pressurePenalty01: Score01;
  readonly recoveryBonus01: Score01;
  readonly witnessBoost01: Score01;
  readonly notes: readonly string[];
}

/* ========================================================================== *
 * MARK: Implementation
 * ========================================================================== */

export class AttachmentModel implements AttachmentModelApi {
  public readonly moduleName = CHAT_ATTACHMENT_MODEL_MODULE_NAME;
  public readonly version = CHAT_ATTACHMENT_MODEL_VERSION;
  public readonly defaults: typeof CHAT_ATTACHMENT_MODEL_DEFAULTS;

  private readonly authority: ChatAuthority;
  private readonly now: () => UnixMs;

  public constructor(options: AttachmentModelOptions = {}) {
    this.defaults = Object.freeze({
      ...CHAT_ATTACHMENT_MODEL_DEFAULTS,
      ...(options.defaults ?? {}),
    });
    this.authority = (options.authority ?? 'BACKEND_ENGINE') as ChatAuthority;
    this.now = options.now ?? (() => Date.now() as UnixMs);
  }

  public assess(input: AttachmentModelInput): AttachmentAssessment {
    const evaluatedAt = input.evaluatedAt ?? this.now();
    const profile = input.learningProfile;
    const relationships = limitRelationships(input.relationships, this.defaults.candidateSoftCap);
    const featureBias = this.readFeatureBias(input.featureSnapshot);

    const candidates = Object.freeze(
      relationships
        .map((value) => this.buildCandidate(value, input, profile, featureBias))
        .sort(compareCandidates),
    );

    const top = candidates[0];
    const aggregate = this.aggregateCandidates(candidates, profile, featureBias);

    const confidenceBand = computeEmotionConfidenceBand(
      average([
        aggregate.trust01,
        aggregate.attachment01,
        invert01(aggregate.rivalryContamination01),
        aggregate.helperAffinity01,
        aggregate.familiarity01,
      ]),
    );

    const state = this.resolveState({
      attachment01: aggregate.attachment01,
      trust01: aggregate.trust01,
      helperAffinity01: aggregate.helperAffinity01,
      rivalryContamination01: aggregate.rivalryContamination01,
    });

    const followPersonaId =
      top && top.shouldFollowAcrossModes ? top.actorId : undefined;

    const drivers = Object.freeze([
      this.driver({
        kind: 'attachment',
        roomId: input.roomId,
        channel: input.channel,
        signedImpact01: aggregate.attachment01,
        evidence: 'Attachment intensity derived from continuity-bearing relationship memory.',
        metadata: {
          candidateCount: candidates.length,
          helperAffinity01: aggregate.helperAffinity01,
          rescueGravity01: aggregate.rescueGravity01,
          topCandidateActorId: top?.actorId ?? null,
        },
      }),
      this.driver({
        kind: 'trust',
        roomId: input.roomId,
        channel: input.channel,
        signedImpact01: aggregate.trust01,
        evidence: 'Trust intensity blended from rescue debt, relationship trust, and helper receptivity.',
        metadata: {
          helperAffinity01: aggregate.helperAffinity01,
          profileHelperReceptivity01: safe01(profile?.helperReceptivity01),
          featureHelperBias01: featureBias.helperBias01,
        },
      }),
      this.driver({
        kind: 'rivalry',
        roomId: input.roomId,
        channel: input.channel,
        signedImpact01: aggregate.rivalryContamination01,
        evidence: 'Rivalry contamination retained from contempt, fear, rivalry memory, and hater exposure.',
        metadata: {
          haterSusceptibility01: safe01(profile?.haterSusceptibility01),
          pressurePenalty01: featureBias.pressurePenalty01,
          haterPersonaCount: input.haterPersonaIds?.length ?? 0,
        },
      }),
      this.driver({
        kind: 'rescue',
        roomId: input.roomId,
        channel: input.channel,
        signedImpact01: aggregate.rescueGravity01,
        evidence: 'Rescue gravity retained from rescue debt, helper affinity, and recovery posture.',
        metadata: {
          rescueHistoryCount: profile?.rescueHistoryCount ?? 0,
          recoveryBonus01: featureBias.recoveryBonus01,
        },
      }),
    ]);

    const notes = Object.freeze([
      `candidateCount=${candidates.length}`,
      `attachment=${toPct(aggregate.attachment01)}`,
      `trust=${toPct(aggregate.trust01)}`,
      `helperAffinity=${toPct(aggregate.helperAffinity01)}`,
      `rivalryContamination=${toPct(aggregate.rivalryContamination01)}`,
      `rescueGravity=${toPct(aggregate.rescueGravity01)}`,
      `familiarity=${toPct(aggregate.familiarity01)}`,
      `state=${state}`,
      `confidenceBand=${confidenceBand}`,
      followPersonaId ? `followPersonaId=${followPersonaId}` : 'followPersonaId=none',
      ...featureBias.notes,
      ...(top?.reasons ?? []).map((reason, index) => `topCandidateReason${index + 1}=${reason}`),
    ]);

    return Object.freeze({
      model: CHAT_ATTACHMENT_MODEL_MODULE_NAME,
      version: CHAT_ATTACHMENT_MODEL_VERSION,
      evaluatedAt,
      authority: input.authority ?? this.authority,
      userId: input.userId,
      roomId: input.roomId,
      channel: input.channel,
      attachment01: aggregate.attachment01,
      trust01: aggregate.trust01,
      rivalryContamination01: aggregate.rivalryContamination01,
      rescueGravity01: aggregate.rescueGravity01,
      familiarity01: aggregate.familiarity01,
      helperAffinity01: aggregate.helperAffinity01,
      confidenceBand,
      state,
      followPersonaId,
      drivers,
      candidates,
      notes,
      metadata: input.metadata,
    });
  }

  public summarize(result: AttachmentAssessment): readonly string[] {
    return Object.freeze([
      `state=${result.state}`,
      `attachment=${toPct(result.attachment01)}`,
      `trust=${toPct(result.trust01)}`,
      `helperAffinity=${toPct(result.helperAffinity01)}`,
      `rivalryContamination=${toPct(result.rivalryContamination01)}`,
      `rescueGravity=${toPct(result.rescueGravity01)}`,
      `familiarity=${toPct(result.familiarity01)}`,
      result.followPersonaId ? `follow=${result.followPersonaId}` : 'follow=none',
    ]);
  }

  private buildCandidate(
    relationship: ChatRelationshipState,
    input: AttachmentModelInput,
    profile: ChatLearningProfile | undefined,
    featureBias: AttachmentFeatureBias,
  ): AttachmentAffinityCandidate {
    const trustBase = clampEmotionScalar(
      safe01(relationship.trust01) * this.defaults.trustWeight +
        safe01(relationship.rescueDebt01) * this.defaults.rescueDebtWeight +
        safe01(relationship.fascination01) * 0.08 +
        safe01(profile?.helperReceptivity01) * 0.09 +
        featureBias.helperBias01 * this.defaults.featureHelperBiasWeight +
        channelTrustBias(input.channel, this.defaults),
    );

    const rivalryContamination01 = clampEmotionScalar(
      safe01(relationship.rivalry01) * this.defaults.rivalryPenaltyWeight +
        safe01(relationship.contempt01) * this.defaults.contemptPenaltyWeight +
        safe01(relationship.fear01) * this.defaults.fearPenaltyWeight +
        haterExposurePenalty(input.haterPersonaIds, relationship.actorId, this.defaults) +
        featureBias.pressurePenalty01 * this.defaults.featurePressurePenaltyWeight,
    );

    const familiarity01 = clampEmotionScalar(
      safe01(relationship.fascination01) * this.defaults.familiarityWeight +
        invert01(relationship.contempt01) * 0.15 +
        safe01(profile?.rescueHistoryCount ? Math.min(1, profile.rescueHistoryCount / 8) : 0) * 0.08 +
        featureBias.witnessBoost01 * this.defaults.featureWitnessBoostWeight,
    );

    const rescueGravity01 = clampEmotionScalar(
      safe01(relationship.rescueDebt01) * 0.67 +
        safe01(profile?.helperReceptivity01) * 0.1 +
        featureBias.recoveryBonus01 * this.defaults.featureRecoveryBonusWeight,
    );

    const attachment01 = clampEmotionScalar(
      trustBase +
        safe01(relationship.fascination01) * this.defaults.fascinationWeight +
        rescueGravity01 * 0.12 +
        familiarity01 * 0.14 +
        helperExposureBonus(input.helperPersonaIds, relationship.actorId, this.defaults) +
        safe01(profile?.affect?.attachment01) * 0.12 -
        Number(rivalryContamination01) * 0.27,
    );

    const helperAffinity01 = clampEmotionScalar(
      trustBase * 0.33 +
        attachment01 * 0.29 +
        rescueGravity01 * 0.17 +
        familiarity01 * 0.11 +
        helperExposureBonus(input.helperPersonaIds, relationship.actorId, this.defaults) -
        Number(rivalryContamination01) * 0.14,
    );

    const trust01 = clampEmotionScalar(
      trustBase * this.defaults.trustRepairDampening +
        familiarity01 * 0.09 +
        rescueGravity01 * 0.08 -
        Number(rivalryContamination01) * 0.1,
    );

    const reasons = Object.freeze(
      compactStrings([
        helperPersonaIdsInclude(input.helperPersonaIds, relationship.actorId)
          ? 'actorListedAsHelperPersona'
          : undefined,
        helperPersonaIdsInclude(input.haterPersonaIds, relationship.actorId)
          ? 'actorListedAsHaterPersona'
          : undefined,
        relationship.rescueDebt01 && Number(relationship.rescueDebt01) >= 0.55
          ? 'highRescueDebt'
          : undefined,
        relationship.fascination01 && Number(relationship.fascination01) >= 0.5
          ? 'highFascination'
          : undefined,
        relationship.rivalry01 && Number(relationship.rivalry01) >= 0.5
          ? 'highRivalry'
          : undefined,
        familiarity01 >= 0.5 ? 'highFamiliarity' : undefined,
      ]),
    );

    return Object.freeze({
      actorId: relationship.actorId,
      attachment01,
      trust01,
      rivalryContamination01,
      helperAffinity01,
      rescueGravity01,
      familiarity01,
      shouldFollowAcrossModes:
        attachment01 >= this.defaults.followPersonaThreshold &&
        helperAffinity01 >= this.defaults.helperAffinityThreshold &&
        rivalryContamination01 < this.defaults.rivalryOverrideThreshold,
      reasons,
    });
  }

  private aggregateCandidates(
    candidates: readonly AttachmentAffinityCandidate[],
    profile: ChatLearningProfile | undefined,
    featureBias: AttachmentFeatureBias,
  ): Readonly<{
    attachment01: Score01;
    trust01: Score01;
    rivalryContamination01: Score01;
    rescueGravity01: Score01;
    familiarity01: Score01;
    helperAffinity01: Score01;
  }> {
    if (!candidates.length) {
      return Object.freeze({
        attachment01: clampEmotionScalar(
          safe01(profile?.affect?.attachment01) * 0.52 + featureBias.helperBias01 * 0.04,
        ),
        trust01: clampEmotionScalar(
          safe01(profile?.helperReceptivity01) * 0.36 + featureBias.helperBias01 * 0.03,
        ),
        rivalryContamination01: clampEmotionScalar(
          safe01(profile?.haterSusceptibility01) * 0.31 + featureBias.pressurePenalty01 * 0.04,
        ),
        rescueGravity01: clampEmotionScalar(
          safe01(profile?.rescueHistoryCount ? Math.min(1, profile.rescueHistoryCount / 8) : 0) * 0.33 +
            featureBias.recoveryBonus01 * 0.08,
        ),
        familiarity01: clampEmotionScalar(featureBias.witnessBoost01 * 0.18),
        helperAffinity01: clampEmotionScalar(
          safe01(profile?.helperReceptivity01) * 0.4 + featureBias.helperBias01 * 0.05,
        ),
      });
    }

    const top = candidates[0];
    const rest = candidates.slice(1);

    const topWeight = this.defaults.candidateTopWeight;
    const remainderWeight = this.defaults.candidateRemainderWeight;

    const combine = (selector: (candidate: AttachmentAffinityCandidate) => number): Score01 => {
      const topValue = selector(top) * topWeight;
      if (!rest.length) {
        return clampEmotionScalar(topValue + selector(top) * remainderWeight);
      }
      const restAverage = average(rest.map(selector), selector(top));
      return clampEmotionScalar(topValue + Number(restAverage) * remainderWeight);
    };

    return Object.freeze({
      attachment01: combine((candidate) => candidate.attachment01),
      trust01: combine((candidate) => candidate.trust01),
      rivalryContamination01: combine((candidate) => candidate.rivalryContamination01),
      rescueGravity01: combine((candidate) => candidate.rescueGravity01),
      familiarity01: combine((candidate) => candidate.familiarity01),
      helperAffinity01: combine((candidate) => candidate.helperAffinity01),
    });
  }

  private resolveState(input: {
    readonly attachment01: Score01;
    readonly trust01: Score01;
    readonly helperAffinity01: Score01;
    readonly rivalryContamination01: Score01;
  }): AttachmentNarrativeState {
    if (input.rivalryContamination01 >= this.defaults.rivalryOverrideThreshold) {
      return 'RIVALRY_BIND';
    }
    if (input.trust01 >= 0.64 && input.attachment01 >= 0.58) {
      return 'TRUST_STABLE';
    }
    if (input.helperAffinity01 >= this.defaults.helperAffinityThreshold) {
      return 'HELPER_LOCK';
    }
    if (input.attachment01 >= 0.45) {
      return 'RECOGNIZED';
    }
    if (input.trust01 >= 0.34) {
      return 'CAUTIOUS';
    }
    return 'DISCONNECTED';
  }

  private readFeatureBias(feature: ChatFeatureSnapshot | undefined): AttachmentFeatureBias {
    if (!feature) {
      return Object.freeze({
        helperBias01: 0 as Score01,
        pressurePenalty01: 0 as Score01,
        recoveryBonus01: 0 as Score01,
        witnessBoost01: 0 as Score01,
        notes: Object.freeze(['featureSnapshot=absent']),
      });
    }

    const helperBias01 = firstKnownScore01(feature, [
      'helperAffinity01',
      'helperReceptivity01',
      'supportReadiness01',
      'rescueReadiness01',
    ]);
    const pressurePenalty01 = firstKnownScore01(feature, [
      'pressure01',
      'humiliationPressure01',
      'fear01',
      'hostility01',
    ]);
    const recoveryBonus01 = firstKnownScore01(feature, [
      'recovery01',
      'comebackReadiness01',
      'relief01',
      'stability01',
    ]);
    const witnessBoost01 = firstKnownScore01(feature, [
      'witnessDensity01',
      'audienceHeat01',
      'crowdSupport01',
      'recognition01',
    ]);

    return Object.freeze({
      helperBias01,
      pressurePenalty01,
      recoveryBonus01,
      witnessBoost01,
      notes: Object.freeze([
        `featureSnapshot=present`,
        `featureHelperBias=${toPct(helperBias01)}`,
        `featurePressurePenalty=${toPct(pressurePenalty01)}`,
        `featureRecoveryBonus=${toPct(recoveryBonus01)}`,
        `featureWitnessBoost=${toPct(witnessBoost01)}`,
      ]),
    });
  }

  private driver(input: {
    readonly kind: 'attachment' | 'trust' | 'rivalry' | 'rescue';
    readonly roomId: ChatRoomId;
    readonly channel: ChatVisibleChannel;
    readonly signedImpact01: Score01;
    readonly evidence: string;
    readonly metadata: JsonObject;
  }): ChatEmotionDriverEvidence {
    const driverMap: Record<typeof input.kind, ChatEmotionDriverKind> = {
      attachment: 'MEMORY_CALLBACK',
      trust: 'HELPER_PRESENCE',
      rivalry: 'RIVALRY_TAUNT',
      rescue: 'RESCUE_INTERVENTION',
    };

    const sourceKindMap: Record<typeof input.kind, ChatEmotionSourceKind> = {
      attachment: 'LEARNING',
      trust: 'HELPER_MESSAGE',
      rivalry: 'HATER_MESSAGE',
      rescue: 'RESCUE',
    };

    const labelMap: Record<typeof input.kind, string> = {
      attachment: 'Attachment continuity pressure',
      trust: 'Trust carryover pressure',
      rivalry: 'Rivalry contamination pressure',
      rescue: 'Rescue gravity pressure',
    };

    const salience = clampEmotionScalar(Math.max(Number(input.signedImpact01), 0.14));
    const confidence = clampEmotionScalar(
      salience * 0.72 +
        (input.kind === 'attachment' || input.kind === 'trust' ? 0.16 : 0.1),
    );

    return Object.freeze({
      driverId: createChatEmotionDriverId(),
      driver: driverMap[input.kind],
      sourceKind: sourceKindMap[input.kind],
      sourceAuthority: this.authority,
      sourceWeight: Number(clampEmotionScalar(Number(input.signedImpact01))),
      salience,
      confidence,
      confidenceBand: computeEmotionConfidenceBand(confidence),
      label: labelMap[input.kind],
      reason: input.evidence,
      roomId: input.roomId,
      channelId: input.channel,
      happenedAt: new Date(this.now()).toISOString(),
      metadata: Object.freeze({
        emotionAxis:
          input.kind === 'attachment'
            ? 'ATTACHMENT'
            : input.kind === 'trust'
              ? 'TRUST'
              : input.kind === 'rivalry'
                ? 'INTIMIDATION'
                : 'RELIEF',
        signedImpact01: Number(input.signedImpact01),
        ...input.metadata,
      }),
    });
  }
}

/* ========================================================================== *
 * MARK: Public helpers
 * ========================================================================== */

export function createAttachmentModel(
  options: AttachmentModelOptions = {},
): AttachmentModel {
  return new AttachmentModel(options);
}

export function assessAttachment(
  input: AttachmentModelInput,
  options: AttachmentModelOptions = {},
): AttachmentAssessment {
  return createAttachmentModel(options).assess(input);
}

/* ========================================================================== *
 * MARK: Internal helpers
 * ========================================================================== */

function compareCandidates(
  left: AttachmentAffinityCandidate,
  right: AttachmentAffinityCandidate,
): number {
  const leftScore =
    Number(left.attachment01) * 0.34 +
    Number(left.helperAffinity01) * 0.23 +
    Number(left.trust01) * 0.19 +
    Number(left.familiarity01) * 0.12 +
    Number(left.rescueGravity01) * 0.12 -
    Number(left.rivalryContamination01) * 0.28;

  const rightScore =
    Number(right.attachment01) * 0.34 +
    Number(right.helperAffinity01) * 0.23 +
    Number(right.trust01) * 0.19 +
    Number(right.familiarity01) * 0.12 +
    Number(right.rescueGravity01) * 0.12 -
    Number(right.rivalryContamination01) * 0.28;

  if (rightScore !== leftScore) {
    return rightScore - leftScore;
  }
  if (right.shouldFollowAcrossModes !== left.shouldFollowAcrossModes) {
    return Number(right.shouldFollowAcrossModes) - Number(left.shouldFollowAcrossModes);
  }
  return left.actorId.localeCompare(right.actorId);
}

function limitRelationships(
  relationships: readonly ChatRelationshipState[] | undefined,
  limit: number,
): readonly ChatRelationshipState[] {
  if (!relationships?.length) {
    return Object.freeze([]) as readonly ChatRelationshipState[];
  }
  return Object.freeze([...relationships].slice(0, Math.max(1, limit)));
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

function channelTrustBias(
  channel: ChatVisibleChannel,
  defaults: typeof CHAT_ATTACHMENT_MODEL_DEFAULTS,
): number {
  if (channel === 'SYNDICATE') return defaults.syndicateTrustBonus;
  if (channel === 'DEAL_ROOM') return -defaults.dealRoomTrustPenalty;
  return 0;
}

function helperExposureBonus(
  helperPersonaIds: readonly string[] | undefined,
  actorId: string,
  defaults: typeof CHAT_ATTACHMENT_MODEL_DEFAULTS,
): number {
  if (!helperPersonaIds?.length) return 0;
  return helperPersonaIds.includes(actorId) ? defaults.helperExposureBonus : 0;
}

function haterExposurePenalty(
  haterPersonaIds: readonly string[] | undefined,
  actorId: string,
  defaults: typeof CHAT_ATTACHMENT_MODEL_DEFAULTS,
): number {
  if (!haterPersonaIds?.length) return 0;
  return haterPersonaIds.includes(actorId) ? defaults.haterExposurePenalty : 0;
}

function helperPersonaIdsInclude(ids: readonly string[] | undefined, actorId: string): boolean {
  return !!ids?.includes(actorId);
}

function compactStrings(values: readonly (string | undefined)[]): readonly string[] {
  return values.filter((value): value is string => typeof value === 'string' && value.length > 0);
}

function toPct(value: Score01 | number): string {
  return `${Math.round(Number(value) * 100)}`;
}

function firstKnownScore01(
  source: unknown,
  keys: readonly string[],
): Score01 {
  if (!source || typeof source !== 'object') {
    return 0 as Score01;
  }

  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const direct = record[key];
    if (typeof direct === 'number') {
      return clampEmotionScalar(direct);
    }

    if (direct && typeof direct === 'object') {
      const nestedValue = readNumericFromObject(direct, ['value01', 'score01', 'normalized01', 'score']);
      if (nestedValue != null) {
        return clampEmotionScalar(nestedValue);
      }
    }
  }

  return 0 as Score01;
}

function readNumericFromObject(
  source: unknown,
  keys: readonly string[],
): number | undefined {
  if (!source || typeof source !== 'object') {
    return undefined;
  }
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}
