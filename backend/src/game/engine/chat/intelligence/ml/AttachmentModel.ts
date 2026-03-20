/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT ATTACHMENT MODEL
 * FILE: backend/src/game/engine/chat/intelligence/ml/AttachmentModel.ts
 * VERSION: 2026.03.20-backend-attachment-model.v1
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Backend relational-affect scoring for attachment and trust intensity in the
 * authoritative chat lane.
 *
 * This model exists because attachment, trust, familiarity, rivalry memory, and
 * rescue debt should not be inferred only from the last few visible messages.
 * They are continuity-bearing signals that need backend durability and lawful
 * evaluation across rooms, scenes, and mode transitions.
 *
 * Core outputs
 * ------------
 * - attachment intensity
 * - trust intensity
 * - rivalry contamination
 * - rescue gravity
 * - helper affinity strength
 * - follow-persona recommendation
 *
 * Design doctrine
 * ---------------
 * - Attachment is continuity, not softness.
 * - Trust must grow slower than contempt spikes unless rescue debt exists.
 * - Rivalry can coexist with fascination and should not erase recognition.
 * - Helper timing should prefer earned affinity over generic repetition.
 * - Backend attachment truth should be replayable and explainable.
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

import type {
  ChatAuthority,
  ChatEmotionConfidenceBand,
  ChatEmotionDriverEvidence,
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
  '2026.03.20-backend-attachment-model.v1' as const;

export const CHAT_ATTACHMENT_MODEL_RUNTIME_LAWS = Object.freeze([
  'Attachment is continuity-bearing recognition, not sentiment garnish.',
  'Trust should rise slower than rivalry unless rescue debt and familiarity support it.',
  'Helper affinity should prefer earned history over generic availability.',
  'Rivalry contamination should inform timing without erasing recognition.',
  'Relationship output must remain deterministic and replayable.',
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
  readonly shouldFollowAcrossModes: boolean;
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
    const relationships = input.relationships ?? [];
    const feature = input.featureSnapshot;

    const candidates = Object.freeze(
      relationships.map((value) => this.buildCandidate(value, input, profile)).sort((a, b) => {
        const left = Number(a.attachment01) + Number(a.helperAffinity01) - Number(a.rivalryContamination01) * 0.4;
        const right = Number(b.attachment01) + Number(b.helperAffinity01) - Number(b.rivalryContamination01) * 0.4;
        return right - left;
      }),
    );

    const top = candidates[0];
    const helperAffinity01 = candidates.length
      ? average(candidates.map((value) => value.helperAffinity01), 0)
      : clampEmotionScalar(safe01(profile?.helperReceptivity01) * 0.4);

    const trust01 = candidates.length
      ? average(candidates.map((value) => value.trust01), 0)
      : clampEmotionScalar(safe01(profile?.helperReceptivity01) * 0.36);

    const attachment01 = candidates.length
      ? average(candidates.map((value) => value.attachment01), 0)
      : clampEmotionScalar(safe01(profile?.affect.attachment01) * 0.52);

    const rivalryContamination01 = candidates.length
      ? average(candidates.map((value) => value.rivalryContamination01), 0)
      : clampEmotionScalar(safe01(profile?.haterSusceptibility01) * 0.31);

    const rescueGravity01 = clampEmotionScalar(
      average(relationships.map((value) => safe01(value.rescueDebt01)), 0) * 0.68 +
        helperAffinity01 * 0.19,
    );

    const familiarity01 = clampEmotionScalar(
      average(relationships.map((value) => safe01(value.fascination01)), 0) * 0.28 +
        average(relationships.map((value) => invert01(value.contempt01)), 0) * 0.19 +
        safe01(profile?.rescueHistoryCount ? Math.min(1, profile.rescueHistoryCount / 8) : 0) * 0.12,
    );

    const confidenceBand = computeEmotionConfidenceBand(
      average([
        trust01,
        attachment01,
        invert01(rivalryContamination01),
        helperAffinity01,
      ]),
    );

    const state = this.resolveState({
      attachment01,
      trust01,
      helperAffinity01,
      rivalryContamination01,
    });

    const followPersonaId =
      top && top.shouldFollowAcrossModes ? top.actorId : undefined;

    const drivers = Object.freeze([
      this.driver('attachment', attachment01, 'RELATIONSHIP_MEMORY', {
        candidateCount: candidates.length,
        helperAffinity01,
        rescueGravity01,
      }),
      this.driver('trust', trust01, 'HELPER_TRUST', {
        helperAffinity01,
        profileHelperReceptivity01: safe01(profile?.helperReceptivity01),
      }),
      this.driver('rivalry', rivalryContamination01, 'RIVALRY_INTENSITY', {
        haterSusceptibility01: safe01(profile?.haterSusceptibility01),
        channel: input.channel,
      }),
      this.driver('rescue', rescueGravity01, 'RESCUE_MEMORY', {
        rescueHistoryCount: profile?.rescueHistoryCount ?? 0,
      }),
    ]);

    const notes = Object.freeze([
      `candidateCount=${candidates.length}`,
      `attachment=${toPct(attachment01)}`,
      `trust=${toPct(trust01)}`,
      `helperAffinity=${toPct(helperAffinity01)}`,
      `rivalryContamination=${toPct(rivalryContamination01)}`,
      `rescueGravity=${toPct(rescueGravity01)}`,
      `familiarity=${toPct(familiarity01)}`,
      `state=${state}`,
      followPersonaId ? `followPersonaId=${followPersonaId}` : 'followPersonaId=none',
    ]);

    return Object.freeze({
      model: CHAT_ATTACHMENT_MODEL_MODULE_NAME,
      version: CHAT_ATTACHMENT_MODEL_VERSION,
      evaluatedAt,
      authority: input.authority ?? this.authority,
      userId: input.userId,
      roomId: input.roomId,
      channel: input.channel,
      attachment01,
      trust01,
      rivalryContamination01,
      rescueGravity01,
      familiarity01,
      helperAffinity01,
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
      result.followPersonaId ? `follow=${result.followPersonaId}` : 'follow=none',
    ]);
  }

  private buildCandidate(
    relationship: ChatRelationshipState,
    input: AttachmentModelInput,
    profile?: ChatLearningProfile,
  ): AttachmentAffinityCandidate {
    const trustBase = clampEmotionScalar(
      safe01(relationship.trust01) * this.defaults.trustWeight +
        safe01(relationship.rescueDebt01) * this.defaults.rescueDebtWeight +
        safe01(relationship.fascination01) * 0.08 +
        safe01(profile?.helperReceptivity01) * 0.09 +
        channelTrustBias(input.channel, this.defaults),
    );

    const rivalryContamination01 = clampEmotionScalar(
      safe01(relationship.rivalry01) * this.defaults.rivalryPenaltyWeight +
        safe01(relationship.contempt01) * this.defaults.contemptPenaltyWeight +
        safe01(relationship.fear01) * this.defaults.fearPenaltyWeight,
    );

    const attachment01 = clampEmotionScalar(
      trustBase +
        safe01(relationship.fascination01) * this.defaults.fascinationWeight +
        safe01(relationship.rescueDebt01) * 0.11 +
        safe01(profile?.affect.attachment01) * 0.12 -
        Number(rivalryContamination01) * 0.27,
    );

    const helperAffinity01 = clampEmotionScalar(
      trustBase * 0.41 +
        attachment01 * 0.28 +
        helperExposureBonus(input.helperPersonaIds, relationship.actorId, this.defaults) -
        Number(rivalryContamination01) * 0.14,
    );

    return Object.freeze({
      actorId: relationship.actorId,
      attachment01,
      trust01: clampEmotionScalar(trustBase * this.defaults.trustRepairDampening),
      rivalryContamination01,
      helperAffinity01,
      shouldFollowAcrossModes:
        attachment01 >= this.defaults.followPersonaThreshold &&
        rivalryContamination01 < this.defaults.rivalryOverrideThreshold,
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

  private driver(
    kind: 'attachment' | 'trust' | 'rivalry' | 'rescue',
    signedImpact01: Score01,
    evidence: string,
    metadata: JsonObject,
  ): ChatEmotionDriverEvidence {
    const axisMap: Record<string, ChatEmotionDriverEvidence['axis']> = {
      attachment: 'ATTACHMENT',
      trust: 'TRUST',
      rivalry: 'INTIMIDATION',
      rescue: 'RELIEF',
    };
    const kindMap: Record<string, ChatEmotionDriverEvidence['kind']> = {
      attachment: 'HELPER_PRESENCE',
      trust: 'RELATIONSHIP_MEMORY',
      rivalry: 'RIVALRY_MEMORY',
      rescue: 'RESCUE_TRIGGER',
    };

    return Object.freeze({
      driverId: createChatEmotionDriverId(),
      kind: kindMap[kind],
      axis: axisMap[kind],
      sourceAuthority: this.authority,
      source: 'SYSTEM_INFERENCE',
      weight01: clampEmotionScalar(signedImpact01),
      signedImpact01,
      evidence,
      observedAtUnixMs: this.now(),
      metadata,
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

function toPct(value: Score01 | number): string {
  return `${Math.round(Number(value) * 100)}`;
}
