/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT ATTACHMENT MODEL
 * FILE: backend/src/game/engine/chat/intelligence/ml/AttachmentModel.ts
 * VERSION: 2026.03.22-backend-attachment-model.v3
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
 * rescue debt, follow-persona bias, witness pressure, and continuity recall
 * should not be inferred only from the last few visible messages. They are
 * continuity-bearing signals that need backend durability and lawful evaluation
 * across rooms, scenes, channels, and mode transitions.
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
 * - batch and diagnostic surfaces for replay, orchestration, and training
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
  '2026.03.22-backend-attachment-model.v3' as const;

export const CHAT_ATTACHMENT_MODEL_RUNTIME_LAWS = Object.freeze([
  'Attachment is continuity-bearing recognition, not sentiment garnish.',
  'Trust should rise slower than rivalry unless rescue debt and familiarity support it.',
  'Helper affinity should prefer earned history over generic availability.',
  'Rivalry contamination should inform timing without erasing recognition.',
  'Relationship output must remain deterministic and replayable.',
  'Shared emotional driver evidence must conform to sovereign shared contracts.',
  'Public pressure can increase attachment salience without increasing trust.',
  'Predatory silence is a valid social force and should be scored explicitly.',
  'Batch analysis must preserve per-candidate explainability.',
  'Diagnostic surfaces must remain derivable from authoritative model state.',
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
  lobbyNeutralityDampening: 0.04,
  publicExposureBonus: 0.06,
  predatoryQuietPenalty: 0.08,
  continuityMemoryBonus: 0.07,
  proofExposurePenalty: 0.06,
  betrayalPenaltyWeight: 0.09,
  admirationLiftWeight: 0.07,
  stabilityReserveWeight: 0.08,
  comebackReadinessWeight: 0.06,
  silenceReadinessWeight: 0.05,
  exhaustionPenaltyWeight: 0.06,
  witnessDensityWeight: 0.05,
  supportEchoWeight: 0.05,
  negotiationStrainPenalty: 0.07,
  helperExposureBonus: 0.09,
  haterExposurePenalty: 0.08,
  featureHelperBiasWeight: 0.08,
  featurePressurePenaltyWeight: 0.06,
  featureRecoveryBonusWeight: 0.06,
  featureWitnessBoostWeight: 0.05,
  candidateTopWeight: 0.42,
  candidateRemainderWeight: 0.58,
  candidateSoftCap: 8,
  relationshipDecayFloor: 0.18,
  relationshipDecayCeiling: 0.92,
  crowdWitnessThreshold: 0.61,
  rescuePriorityThreshold: 0.64,
  isolationRiskThreshold: 0.59,
  silenceRecommendationThreshold: 0.66,
  helperLockFloor: 0.57,
  trustStableFloor: 0.64,
  attachmentStableFloor: 0.58,
  diagnosticTopCandidateLimit: 5,
  batchSoftCap: 24,
} as const);

export const CHAT_ATTACHMENT_CHANNEL_ARCHETYPES = Object.freeze({
  GLOBAL: 'PUBLIC_ARENA',
  SYNDICATE: 'TRUST_RING',
  DEAL_ROOM: 'PREDATORY_CHAMBER',
  LOBBY: 'LOW_HEAT_STAGING',
  DIRECT: 'PRIVATE_BOND',
  SPECTATOR: 'WITNESS_GALLERY',
} as const satisfies Readonly<Record<ChatVisibleChannel | 'DIRECT' | 'SPECTATOR', string>>);

export const CHAT_ATTACHMENT_STATE_ORDER = Object.freeze([
  'DISCONNECTED',
  'CAUTIOUS',
  'RECOGNIZED',
  'HELPER_LOCK',
  'TRUST_STABLE',
  'RIVALRY_BIND',
] as const);

export const CHAT_ATTACHMENT_RISK_LABELS = Object.freeze([
  'ISOLATION_RISK',
  'BETRAYAL_RISK',
  'PREDATORY_SILENCE',
  'PUBLIC_SWARM',
  'RIVALRY_OVERRIDE',
  'HELPER_DEPENDENCY',
  'WITNESS_LOCK',
] as const);

export const CHAT_ATTACHMENT_BATCH_VERSION =
  '2026.03.22-backend-attachment-model-batch.v1' as const;

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

export type AttachmentRiskLabel = (typeof CHAT_ATTACHMENT_RISK_LABELS)[number];

export type AttachmentChannelArchetype =
  | 'PUBLIC_ARENA'
  | 'TRUST_RING'
  | 'PREDATORY_CHAMBER'
  | 'LOW_HEAT_STAGING'
  | 'PRIVATE_BOND'
  | 'WITNESS_GALLERY'
  | 'UNKNOWN';

export type AttachmentTrend =
  | 'ASCENDING'
  | 'STABLE'
  | 'CONTESTED'
  | 'DESCENDING'
  | 'RIVALRY_HEAVY';

export type AttachmentCandidateGrade =
  | 'SOVEREIGN'
  | 'STRONG'
  | 'VIABLE'
  | 'FRINGE'
  | 'UNSAFE';

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

export interface AttachmentSignalProfile {
  readonly publicExposure01: Score01;
  readonly negotiationStrain01: Score01;
  readonly betrayalRisk01: Score01;
  readonly stabilityReserve01: Score01;
  readonly admirationField01: Score01;
  readonly contemptField01: Score01;
  readonly fearField01: Score01;
  readonly silenceReadiness01: Score01;
  readonly comebackReadiness01: Score01;
  readonly exhaustionDrag01: Score01;
  readonly witnessDensity01: Score01;
  readonly supportEcho01: Score01;
  readonly predatoryQuiet01: Score01;
  readonly continuityHeat01: Score01;
  readonly proofExposure01: Score01;
  readonly notes: readonly string[];
}

export interface AttachmentLearningBias {
  readonly attachmentBaseline01: Score01;
  readonly trustBaseline01: Score01;
  readonly rivalryBaseline01: Score01;
  readonly rescueSeeking01: Score01;
  readonly helperPreference01: Score01;
  readonly haterSusceptibility01: Score01;
  readonly memoryWeight01: Score01;
  readonly followThrough01: Score01;
  readonly socialRiskTolerance01: Score01;
  readonly negotiationDiscipline01: Score01;
  readonly recoveryDiscipline01: Score01;
  readonly witnessNeed01: Score01;
  readonly notes: readonly string[];
}

export interface AttachmentFeatureBias {
  readonly helperBias01: Score01;
  readonly pressurePenalty01: Score01;
  readonly recoveryBonus01: Score01;
  readonly witnessBoost01: Score01;
  readonly notes: readonly string[];
}

export interface AttachmentCandidateTraceItem {
  readonly key: string;
  readonly contribution01: Score01;
  readonly direction: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  readonly reason: string;
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
  readonly grade?: AttachmentCandidateGrade;
  readonly trend?: AttachmentTrend;
  readonly riskLabels?: readonly AttachmentRiskLabel[];
  readonly trace?: readonly AttachmentCandidateTraceItem[];
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

export interface AttachmentCandidateAssessment {
  readonly candidate: AttachmentAffinityCandidate;
  readonly state: AttachmentNarrativeState;
  readonly confidenceBand: ChatEmotionConfidenceBand;
  readonly summaryLines: readonly string[];
}

export interface AttachmentAggregateProfile {
  readonly attachment01: Score01;
  readonly trust01: Score01;
  readonly rivalryContamination01: Score01;
  readonly rescueGravity01: Score01;
  readonly familiarity01: Score01;
  readonly helperAffinity01: Score01;
  readonly trend: AttachmentTrend;
  readonly riskLabels: readonly AttachmentRiskLabel[];
}

export interface AttachmentDiagnosticTopCandidate {
  readonly actorId: string;
  readonly grade: AttachmentCandidateGrade;
  readonly attachment01: number;
  readonly trust01: number;
  readonly helperAffinity01: number;
  readonly rivalryContamination01: number;
  readonly riskLabels: readonly AttachmentRiskLabel[];
  readonly summaryLines: readonly string[];
}

export interface AttachmentDiagnosticReport {
  readonly version: typeof CHAT_ATTACHMENT_MODEL_VERSION;
  readonly generatedAt: UnixMs;
  readonly channel: ChatVisibleChannel;
  readonly channelArchetype: AttachmentChannelArchetype;
  readonly state: AttachmentNarrativeState;
  readonly trend: AttachmentTrend;
  readonly topCandidateActorId: string | null;
  readonly riskLabels: readonly AttachmentRiskLabel[];
  readonly scores: Readonly<{
    attachment01: number;
    trust01: number;
    rivalryContamination01: number;
    rescueGravity01: number;
    familiarity01: number;
    helperAffinity01: number;
  }>;
  readonly topCandidates: readonly AttachmentDiagnosticTopCandidate[];
  readonly summaryLines: readonly string[];
}

export interface AttachmentBatchInput {
  readonly entries: readonly AttachmentModelInput[];
}

export interface AttachmentBatchResult {
  readonly version: typeof CHAT_ATTACHMENT_BATCH_VERSION;
  readonly evaluatedAt: UnixMs;
  readonly totalEntries: number;
  readonly results: readonly AttachmentAssessment[];
  readonly summaryLines: readonly string[];
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
  summarizeCandidate(candidate: AttachmentAffinityCandidate): readonly string[];
  assessCandidate(candidate: AttachmentAffinityCandidate): AttachmentCandidateAssessment;
  assessBatch(input: AttachmentBatchInput): AttachmentBatchResult;
  buildDiagnosticReport(result: AttachmentAssessment): AttachmentDiagnosticReport;
}

interface CandidateBuildContext {
  readonly input: AttachmentModelInput;
  readonly profile: ChatLearningProfile | undefined;
  readonly featureBias: AttachmentFeatureBias;
  readonly signalProfile: AttachmentSignalProfile;
  readonly learningBias: AttachmentLearningBias;
  readonly channelArchetype: AttachmentChannelArchetype;
}

/* ========================================================================== *
 * MARK: Lookup registries
 * ========================================================================== */

export const CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS = Object.freeze({
  publicExposure01: Object.freeze(['publicExposure01', 'socialExposure01', 'broadcastExposure01', 'spotlight01', 'visibleRisk01']),
  negotiationStrain01: Object.freeze(['negotiationPressure01', 'dealStress01', 'counterpartyStrain01', 'bargainingStress01', 'stallPressure01']),
  betrayalRisk01: Object.freeze(['betrayalRisk01', 'defectionRisk01', 'treachery01', 'backstabRisk01', 'allianceFragility01']),
  stabilityReserve01: Object.freeze(['stability01', 'composure01', 'regulation01', 'recoveryReserve01', 'grounding01']),
  admirationField01: Object.freeze(['admiration01', 'respectAura01', 'prestige01', 'credit01', 'recognitionGlow01']),
  contemptField01: Object.freeze(['contempt01', 'disgust01', 'dismissal01', 'derision01', 'ridicule01']),
  fearField01: Object.freeze(['fear01', 'panic01', 'dread01', 'threatLoad01', 'intimidation01']),
  silenceReadiness01: Object.freeze(['silenceReadiness01', 'silenceTolerance01', 'quietStrength01', 'restraint01', 'holdFire01']),
  comebackReadiness01: Object.freeze(['comebackReadiness01', 'counterpunch01', 'reversalReadiness01', 'recoveryPush01', 'lastStand01']),
  exhaustionDrag01: Object.freeze(['exhaustion01', 'fatigue01', 'drain01', 'burnout01', 'resourceDepletion01']),
  witnessDensity01: Object.freeze(['witnessDensity01', 'crowdWitness01', 'observationPressure01', 'spectatorLoad01', 'audienceHeat01']),
  supportEcho01: Object.freeze(['supportEcho01', 'allyEcho01', 'helperEcho01', 'encouragement01', 'backup01']),
  predatoryQuiet01: Object.freeze(['predatoryQuiet01', 'silentPredation01', 'dealRoomColdness01', 'quietThreat01', 'lurkingPressure01']),
  continuityHeat01: Object.freeze(['continuityHeat01', 'memoryCallback01', 'historyCharge01', 'priorMomentRecall01', 'narrativeCarryover01']),
  proofExposure01: Object.freeze(['proofExposure01', 'receiptRisk01', 'evidenceHeat01', 'auditPressure01', 'traceExposure01']),
} as const);

export const CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS = Object.freeze({
  attachmentBaseline01: Object.freeze(['attachmentBaseline01', 'affectAttachment01', 'bondingBaseline01']),
  trustBaseline01: Object.freeze(['trustBaseline01', 'beliefBaseline01', 'cooperationBaseline01']),
  rivalryBaseline01: Object.freeze(['rivalryBaseline01', 'competitiveBias01', 'threatBaseline01']),
  rescueSeeking01: Object.freeze(['rescueSeeking01', 'helperReceptivity01', 'supportSeeking01']),
  helperPreference01: Object.freeze(['helperPreference01', 'mentorAffinity01', 'guideTrust01']),
  haterSusceptibility01: Object.freeze(['haterSusceptibility01', 'tauntVulnerability01', 'humiliationSensitivity01']),
  memoryWeight01: Object.freeze(['memoryWeight01', 'continuityWeight01', 'callbackSensitivity01']),
  followThrough01: Object.freeze(['followThrough01', 'commitment01', 'stickiness01']),
  socialRiskTolerance01: Object.freeze(['socialRiskTolerance01', 'publicRiskTolerance01', 'exposureTolerance01']),
  negotiationDiscipline01: Object.freeze(['negotiationDiscipline01', 'dealRoomDiscipline01', 'leverageDiscipline01']),
  recoveryDiscipline01: Object.freeze(['recoveryDiscipline01', 'reboundDiscipline01', 'composureRecovery01']),
  witnessNeed01: Object.freeze(['witnessNeed01', 'recognitionNeed01', 'validationNeed01']),
} as const);

export const CHAT_ATTACHMENT_REASON_LIBRARY = Object.freeze({
  helperListed: 'actorListedAsHelperPersona',
  haterListed: 'actorListedAsHaterPersona',
  rescueDebt: 'highRescueDebt',
  fascination: 'highFascination',
  rivalry: 'highRivalry',
  familiarity: 'highFamiliarity',
  trust: 'highTrust',
  publicHeat: 'publicHeatAmplifiesVisibility',
  predatoryQuiet: 'predatoryQuietSuppressesTrust',
  proofExposure: 'proofExposureRaisesCaution',
  betrayalRisk: 'betrayalRiskSuppressesFollow',
  witnessLock: 'witnessDensityElevatesAttachment',
  comeback: 'comebackReadinessSupportsRescue',
  exhaustion: 'exhaustionLimitsFollowConfidence',
} as const);

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
    this.authority = options.authority ?? 'BACKEND_AUTHORITATIVE';
    this.now = options.now ?? (() => Date.now() as UnixMs);
  }

  public assess(input: AttachmentModelInput): AttachmentAssessment {
    const evaluatedAt = input.evaluatedAt ?? this.now();
    const profile = input.learningProfile;
    const relationships = limitRelationships(input.relationships, this.defaults.candidateSoftCap);
    const featureBias = this.readFeatureBias(input.featureSnapshot);
    const signalProfile = this.readSignalProfile(input.featureSnapshot);
    const learningBias = this.readLearningBias(profile);
    const channelArchetype = getChannelArchetype(input.channel);

    const context: CandidateBuildContext = Object.freeze({
      input,
      profile,
      featureBias,
      signalProfile,
      learningBias,
      channelArchetype,
    });

    const candidates = Object.freeze(
      relationships
        .map((value) => this.buildCandidate(value, context))
        .sort(compareCandidates),
    );

    const top = candidates[0];
    const aggregate = this.aggregateCandidates(candidates, context);

    const confidenceBand = computeEmotionConfidenceBand(
      average([
        aggregate.trust01,
        aggregate.attachment01,
        invert01(aggregate.rivalryContamination01),
        aggregate.helperAffinity01,
        aggregate.familiarity01,
        invert01(signalProfile.exhaustionDrag01),
      ]),
    );

    const state = this.resolveState({
      attachment01: aggregate.attachment01,
      trust01: aggregate.trust01,
      helperAffinity01: aggregate.helperAffinity01,
      rivalryContamination01: aggregate.rivalryContamination01,
    });

    const followPersonaId = this.resolveFollowPersonaId(top, aggregate, signalProfile, learningBias);

    const drivers = Object.freeze([
      this.driver({
        kind: 'attachment',
        roomId: input.roomId,
        channel: input.channel,
        signedImpact01: aggregate.attachment01,
        evidence: 'Attachment intensity derived from continuity-bearing relationship memory.',
        metadata: safeJsonObject({
          candidateCount: candidates.length,
          helperAffinity01: Number(aggregate.helperAffinity01),
          rescueGravity01: Number(aggregate.rescueGravity01),
          topCandidateActorId: top?.actorId ?? null,
          channelArchetype,
          continuityHeat01: Number(signalProfile.continuityHeat01),
        }),
      }),
      this.driver({
        kind: 'trust',
        roomId: input.roomId,
        channel: input.channel,
        signedImpact01: aggregate.trust01,
        evidence: 'Trust intensity blended from rescue debt, relationship trust, helper receptivity, and channel posture.',
        metadata: safeJsonObject({
          helperAffinity01: Number(aggregate.helperAffinity01),
          profileHelperReceptivity01: Number(safe01(profile?.helperReceptivity01)),
          featureHelperBias01: Number(featureBias.helperBias01),
          negotiationStrain01: Number(signalProfile.negotiationStrain01),
        }),
      }),
      this.driver({
        kind: 'rivalry',
        roomId: input.roomId,
        channel: input.channel,
        signedImpact01: aggregate.rivalryContamination01,
        evidence: 'Rivalry contamination retained from contempt, fear, rivalry memory, betrayal risk, and hater exposure.',
        metadata: safeJsonObject({
          haterSusceptibility01: Number(safe01(profile?.haterSusceptibility01)),
          pressurePenalty01: Number(featureBias.pressurePenalty01),
          haterPersonaCount: input.haterPersonaIds?.length ?? 0,
          betrayalRisk01: Number(signalProfile.betrayalRisk01),
          proofExposure01: Number(signalProfile.proofExposure01),
        }),
      }),
      this.driver({
        kind: 'rescue',
        roomId: input.roomId,
        channel: input.channel,
        signedImpact01: aggregate.rescueGravity01,
        evidence: 'Rescue gravity retained from rescue debt, helper affinity, recovery posture, and comeback readiness.',
        metadata: safeJsonObject({
          rescueHistoryCount: profile?.rescueHistoryCount ?? 0,
          recoveryBonus01: Number(featureBias.recoveryBonus01),
          comebackReadiness01: Number(signalProfile.comebackReadiness01),
          supportEcho01: Number(signalProfile.supportEcho01),
        }),
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
      `trend=${aggregate.trend}`,
      `state=${state}`,
      `confidenceBand=${confidenceBand}`,
      `channelArchetype=${channelArchetype}`,
      `riskLabels=${aggregate.riskLabels.join('|') || 'none'}`,
      followPersonaId ? `followPersonaId=${followPersonaId}` : 'followPersonaId=none',
      ...featureBias.notes,
      ...signalProfile.notes,
      ...learningBias.notes,
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
      metadata: safeJsonObject({
        ...(input.metadata ?? {}),
        trend: aggregate.trend,
        riskLabels: aggregate.riskLabels,
        channelArchetype,
      }),
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

  public summarizeCandidate(candidate: AttachmentAffinityCandidate): readonly string[] {
    return Object.freeze([
      `actor=${candidate.actorId}`,
      `grade=${candidate.grade ?? deriveCandidateGrade(candidate)}`,
      `trend=${candidate.trend ?? deriveCandidateTrend(candidate)}`,
      `attachment=${toPct(candidate.attachment01)}`,
      `trust=${toPct(candidate.trust01)}`,
      `helperAffinity=${toPct(candidate.helperAffinity01)}`,
      `rivalry=${toPct(candidate.rivalryContamination01)}`,
      candidate.shouldFollowAcrossModes ? 'follow=yes' : 'follow=no',
      `riskLabels=${(candidate.riskLabels ?? deriveCandidateRiskLabels(candidate)).join('|') || 'none'}`,
    ]);
  }

  public assessCandidate(candidate: AttachmentAffinityCandidate): AttachmentCandidateAssessment {
    const state = this.resolveState({
      attachment01: candidate.attachment01,
      trust01: candidate.trust01,
      helperAffinity01: candidate.helperAffinity01,
      rivalryContamination01: candidate.rivalryContamination01,
    });

    const confidenceBand = computeEmotionConfidenceBand(
      average([
        candidate.attachment01,
        candidate.trust01,
        candidate.helperAffinity01,
        invert01(candidate.rivalryContamination01),
      ]),
    );

    return Object.freeze({
      candidate,
      state,
      confidenceBand,
      summaryLines: this.summarizeCandidate(candidate),
    });
  }

  public assessBatch(input: AttachmentBatchInput): AttachmentBatchResult {
    const evaluatedAt = this.now();
    const entries = [...input.entries].slice(0, Math.max(1, this.defaults.batchSoftCap));
    const results = Object.freeze(entries.map((entry) => this.assess(entry)));
    const summaryLines = Object.freeze([
      `entries=${entries.length}`,
      `topState=${mostCommon(results.map((item) => item.state), 'DISCONNECTED')}`,
      `followCount=${results.filter((item) => item.followPersonaId).length}`,
      `trustAverage=${toPct(average(results.map((item) => Number(item.trust01))))}`,
      `attachmentAverage=${toPct(average(results.map((item) => Number(item.attachment01))))}`,
    ]);

    return Object.freeze({
      version: CHAT_ATTACHMENT_BATCH_VERSION,
      evaluatedAt,
      totalEntries: entries.length,
      results,
      summaryLines,
    });
  }

  public buildDiagnosticReport(result: AttachmentAssessment): AttachmentDiagnosticReport {
    const aggregate = deriveAggregateFromAssessment(result);
    const topCandidates = Object.freeze(
      result.candidates
        .slice(0, this.defaults.diagnosticTopCandidateLimit)
        .map((candidate) => Object.freeze({
          actorId: candidate.actorId,
          grade: candidate.grade ?? deriveCandidateGrade(candidate),
          attachment01: Number(candidate.attachment01),
          trust01: Number(candidate.trust01),
          helperAffinity01: Number(candidate.helperAffinity01),
          rivalryContamination01: Number(candidate.rivalryContamination01),
          riskLabels: Object.freeze(candidate.riskLabels ?? deriveCandidateRiskLabels(candidate)),
          summaryLines: this.summarizeCandidate(candidate),
        })),
    );

    return Object.freeze({
      version: CHAT_ATTACHMENT_MODEL_VERSION,
      generatedAt: this.now(),
      channel: result.channel,
      channelArchetype: getChannelArchetype(result.channel),
      state: result.state,
      trend: aggregate.trend,
      topCandidateActorId: result.candidates[0]?.actorId ?? null,
      riskLabels: aggregate.riskLabels,
      scores: Object.freeze({
        attachment01: Number(result.attachment01),
        trust01: Number(result.trust01),
        rivalryContamination01: Number(result.rivalryContamination01),
        rescueGravity01: Number(result.rescueGravity01),
        familiarity01: Number(result.familiarity01),
        helperAffinity01: Number(result.helperAffinity01),
      }),
      topCandidates,
      summaryLines: Object.freeze([
        ...this.summarize(result),
        `trend=${aggregate.trend}`,
        `riskLabels=${aggregate.riskLabels.join('|') || 'none'}`,
        `channelArchetype=${getChannelArchetype(result.channel)}`,
      ]),
    });
  }

  private buildCandidate(
    relationship: ChatRelationshipState,
    context: CandidateBuildContext,
  ): AttachmentAffinityCandidate {
    const { input, profile, featureBias, signalProfile, learningBias, channelArchetype } = context;

    const familiaritySeed01 = clampEmotionScalar(
      safe01(relationship.fascination01) * this.defaults.familiarityWeight +
        invert01(relationship.contempt01) * 0.15 +
        normalizeCount(profile?.rescueHistoryCount, 8) * 0.08 +
        featureBias.witnessBoost01 * this.defaults.featureWitnessBoostWeight +
        signalProfile.continuityHeat01 * this.defaults.continuityMemoryBonus +
        learningBias.memoryWeight01 * 0.06,
    );

    const rescueGravity01 = clampEmotionScalar(
      safe01(relationship.rescueDebt01) * 0.67 +
        safe01(profile?.helperReceptivity01) * 0.1 +
        featureBias.recoveryBonus01 * this.defaults.featureRecoveryBonusWeight +
        signalProfile.comebackReadiness01 * this.defaults.comebackReadinessWeight +
        signalProfile.supportEcho01 * this.defaults.supportEchoWeight,
    );

    const trustBase = clampEmotionScalar(
      safe01(relationship.trust01) * this.defaults.trustWeight +
        safe01(relationship.rescueDebt01) * this.defaults.rescueDebtWeight +
        safe01(relationship.fascination01) * 0.08 +
        safe01(profile?.helperReceptivity01) * 0.09 +
        featureBias.helperBias01 * this.defaults.featureHelperBiasWeight +
        channelTrustBias(input.channel, this.defaults) +
        signalProfile.admirationField01 * this.defaults.admirationLiftWeight +
        signalProfile.stabilityReserve01 * this.defaults.stabilityReserveWeight +
        learningBias.trustBaseline01 * 0.07 -
        signalProfile.negotiationStrain01 * this.defaults.negotiationStrainPenalty,
    );

    const rivalryContamination01 = clampEmotionScalar(
      safe01(relationship.rivalry01) * this.defaults.rivalryPenaltyWeight +
        safe01(relationship.contempt01) * this.defaults.contemptPenaltyWeight +
        safe01(relationship.fear01) * this.defaults.fearPenaltyWeight +
        signalProfile.betrayalRisk01 * this.defaults.betrayalPenaltyWeight +
        signalProfile.contemptField01 * 0.08 +
        signalProfile.fearField01 * 0.08 +
        haterExposurePenalty(input.haterPersonaIds, relationship.actorId, this.defaults) +
        featureBias.pressurePenalty01 * this.defaults.featurePressurePenaltyWeight +
        learningBias.rivalryBaseline01 * 0.06 +
        signalProfile.proofExposure01 * this.defaults.proofExposurePenalty,
    );

    const attachment01 = clampEmotionScalar(
      trustBase +
        safe01(relationship.fascination01) * this.defaults.fascinationWeight +
        rescueGravity01 * 0.12 +
        familiaritySeed01 * 0.14 +
        helperExposureBonus(input.helperPersonaIds, relationship.actorId, this.defaults) +
        safe01(profile?.affect?.attachment01) * 0.12 +
        signalProfile.publicExposure01 * this.defaults.publicExposureBonus +
        signalProfile.witnessDensity01 * this.defaults.witnessDensityWeight +
        learningBias.attachmentBaseline01 * 0.07 -
        Number(rivalryContamination01) * 0.27 -
        signalProfile.predatoryQuiet01 * this.defaults.predatoryQuietPenalty -
        signalProfile.exhaustionDrag01 * this.defaults.exhaustionPenaltyWeight,
    );

    const helperAffinity01 = clampEmotionScalar(
      trustBase * 0.33 +
        attachment01 * 0.29 +
        rescueGravity01 * 0.17 +
        familiaritySeed01 * 0.11 +
        helperExposureBonus(input.helperPersonaIds, relationship.actorId, this.defaults) +
        learningBias.helperPreference01 * 0.07 +
        signalProfile.supportEcho01 * 0.06 -
        Number(rivalryContamination01) * 0.14,
    );

    const trust01 = clampEmotionScalar(
      trustBase * this.defaults.trustRepairDampening +
        familiaritySeed01 * 0.09 +
        rescueGravity01 * 0.08 +
        learningBias.followThrough01 * 0.05 +
        signalProfile.silenceReadiness01 * this.defaults.silenceReadinessWeight -
        Number(rivalryContamination01) * 0.1,
    );

    const reasons = Object.freeze(
      compactStrings([
        helperPersonaIdsInclude(input.helperPersonaIds, relationship.actorId)
          ? CHAT_ATTACHMENT_REASON_LIBRARY.helperListed
          : undefined,
        helperPersonaIdsInclude(input.haterPersonaIds, relationship.actorId)
          ? CHAT_ATTACHMENT_REASON_LIBRARY.haterListed
          : undefined,
        relationship.rescueDebt01 && Number(relationship.rescueDebt01) >= 0.55
          ? CHAT_ATTACHMENT_REASON_LIBRARY.rescueDebt
          : undefined,
        relationship.fascination01 && Number(relationship.fascination01) >= 0.5
          ? CHAT_ATTACHMENT_REASON_LIBRARY.fascination
          : undefined,
        relationship.rivalry01 && Number(relationship.rivalry01) >= 0.5
          ? CHAT_ATTACHMENT_REASON_LIBRARY.rivalry
          : undefined,
        familiaritySeed01 >= 0.5 ? CHAT_ATTACHMENT_REASON_LIBRARY.familiarity : undefined,
        trust01 >= 0.56 ? CHAT_ATTACHMENT_REASON_LIBRARY.trust : undefined,
        signalProfile.publicExposure01 >= 0.55 ? CHAT_ATTACHMENT_REASON_LIBRARY.publicHeat : undefined,
        signalProfile.predatoryQuiet01 >= 0.55 ? CHAT_ATTACHMENT_REASON_LIBRARY.predatoryQuiet : undefined,
        signalProfile.proofExposure01 >= 0.52 ? CHAT_ATTACHMENT_REASON_LIBRARY.proofExposure : undefined,
        signalProfile.betrayalRisk01 >= 0.52 ? CHAT_ATTACHMENT_REASON_LIBRARY.betrayalRisk : undefined,
        signalProfile.witnessDensity01 >= 0.6 ? CHAT_ATTACHMENT_REASON_LIBRARY.witnessLock : undefined,
        signalProfile.comebackReadiness01 >= 0.57 ? CHAT_ATTACHMENT_REASON_LIBRARY.comeback : undefined,
        signalProfile.exhaustionDrag01 >= 0.55 ? CHAT_ATTACHMENT_REASON_LIBRARY.exhaustion : undefined,
      ]),
    );

    const candidateBase = Object.freeze({
      actorId: relationship.actorId,
      attachment01,
      trust01,
      rivalryContamination01,
      helperAffinity01,
      rescueGravity01,
      familiarity01: familiaritySeed01,
      shouldFollowAcrossModes:
        attachment01 >= this.defaults.followPersonaThreshold &&
        helperAffinity01 >= this.defaults.helperAffinityThreshold &&
        rivalryContamination01 < this.defaults.rivalryOverrideThreshold &&
        signalProfile.betrayalRisk01 < 0.74,
      reasons,
    });

    const grade = deriveCandidateGrade(candidateBase);
    const trend = deriveCandidateTrend(candidateBase);
    const riskLabels = deriveCandidateRiskLabels(candidateBase, {
      betrayalRisk01: signalProfile.betrayalRisk01,
      predatoryQuiet01: signalProfile.predatoryQuiet01,
      publicExposure01: signalProfile.publicExposure01,
      witnessDensity01: signalProfile.witnessDensity01,
      channelArchetype,
    });

    const trace = Object.freeze([
      traceItem('trust_base', trustBase, 'POSITIVE', 'Relationship trust, rescue history, and channel trust bias.'),
      traceItem('rivalry_contamination', rivalryContamination01, 'NEGATIVE', 'Rivalry, contempt, fear, proof exposure, and betrayal pressure.'),
      traceItem('familiarity_seed', familiaritySeed01, 'POSITIVE', 'Fascination, rescue memory, continuity recall, and witness reinforcement.'),
      traceItem('rescue_gravity', rescueGravity01, 'POSITIVE', 'Rescue debt, support receptivity, recovery posture, and comeback readiness.'),
      traceItem('attachment', attachment01, 'POSITIVE', 'Composite attachment after trust lift and rivalry suppression.'),
      traceItem('helper_affinity', helperAffinity01, 'POSITIVE', 'Composite helper selection strength after support, rescue, and memory alignment.'),
    ]);

    return Object.freeze({
      ...candidateBase,
      grade,
      trend,
      riskLabels,
      trace,
    });
  }

  private aggregateCandidates(
    candidates: readonly AttachmentAffinityCandidate[],
    context: CandidateBuildContext,
  ): AttachmentAggregateProfile {
    const { profile, featureBias, signalProfile, learningBias, channelArchetype } = context;

    if (!candidates.length) {
      const base = Object.freeze({
        attachment01: clampEmotionScalar(
          safe01(profile?.affect?.attachment01) * 0.52 +
            featureBias.helperBias01 * 0.04 +
            learningBias.attachmentBaseline01 * 0.08,
        ),
        trust01: clampEmotionScalar(
          safe01(profile?.helperReceptivity01) * 0.36 +
            featureBias.helperBias01 * 0.03 +
            learningBias.trustBaseline01 * 0.09,
        ),
        rivalryContamination01: clampEmotionScalar(
          safe01(profile?.haterSusceptibility01) * 0.31 +
            featureBias.pressurePenalty01 * 0.04 +
            learningBias.rivalryBaseline01 * 0.1 +
            signalProfile.betrayalRisk01 * 0.08,
        ),
        rescueGravity01: clampEmotionScalar(
          normalizeCount(profile?.rescueHistoryCount, 8) * 0.33 +
            featureBias.recoveryBonus01 * 0.08 +
            signalProfile.comebackReadiness01 * 0.07,
        ),
        familiarity01: clampEmotionScalar(
          featureBias.witnessBoost01 * 0.18 + signalProfile.continuityHeat01 * 0.14,
        ),
        helperAffinity01: clampEmotionScalar(
          safe01(profile?.helperReceptivity01) * 0.4 +
            featureBias.helperBias01 * 0.05 +
            learningBias.helperPreference01 * 0.08,
        ),
      });
      return Object.freeze({
        ...base,
        trend: deriveAggregateTrend(base),
        riskLabels: deriveAggregateRiskLabels(base, {
          betrayalRisk01: signalProfile.betrayalRisk01,
          predatoryQuiet01: signalProfile.predatoryQuiet01,
          publicExposure01: signalProfile.publicExposure01,
          witnessDensity01: signalProfile.witnessDensity01,
          channelArchetype,
          helperAffinityFloor: this.defaults.helperAffinityThreshold,
          rivalryOverrideThreshold: this.defaults.rivalryOverrideThreshold,
        }),
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

    const base = Object.freeze({
      attachment01: combine((candidate) => candidate.attachment01),
      trust01: combine((candidate) => candidate.trust01),
      rivalryContamination01: combine((candidate) => candidate.rivalryContamination01),
      rescueGravity01: combine((candidate) => candidate.rescueGravity01),
      familiarity01: combine((candidate) => candidate.familiarity01),
      helperAffinity01: combine((candidate) => candidate.helperAffinity01),
    });

    return Object.freeze({
      ...base,
      trend: deriveAggregateTrend(base),
      riskLabels: deriveAggregateRiskLabels(base, {
        betrayalRisk01: signalProfile.betrayalRisk01,
        predatoryQuiet01: signalProfile.predatoryQuiet01,
        publicExposure01: signalProfile.publicExposure01,
        witnessDensity01: signalProfile.witnessDensity01,
        channelArchetype,
        helperAffinityFloor: this.defaults.helperAffinityThreshold,
        rivalryOverrideThreshold: this.defaults.rivalryOverrideThreshold,
      }),
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
    if (
      input.trust01 >= this.defaults.trustStableFloor &&
      input.attachment01 >= this.defaults.attachmentStableFloor
    ) {
      return 'TRUST_STABLE';
    }
    if (input.helperAffinity01 >= this.defaults.helperLockFloor) {
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

  private resolveFollowPersonaId(
    top: AttachmentAffinityCandidate | undefined,
    aggregate: AttachmentAggregateProfile,
    signalProfile: AttachmentSignalProfile,
    learningBias: AttachmentLearningBias,
  ): string | undefined {
    if (!top) {
      return undefined;
    }
    const shouldBlock =
      signalProfile.betrayalRisk01 >= 0.8 ||
      aggregate.rivalryContamination01 >= this.defaults.rivalryOverrideThreshold ||
      signalProfile.predatoryQuiet01 >= 0.82;
    if (shouldBlock) {
      return undefined;
    }
    if (
      top.shouldFollowAcrossModes &&
      aggregate.helperAffinity01 >= this.defaults.helperAffinityThreshold &&
      learningBias.followThrough01 >= 0.34
    ) {
      return top.actorId;
    }
    return undefined;
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
        'featureSnapshot=present',
        `featureHelperBias=${toPct(helperBias01)}`,
        `featurePressurePenalty=${toPct(pressurePenalty01)}`,
        `featureRecoveryBonus=${toPct(recoveryBonus01)}`,
        `featureWitnessBoost=${toPct(witnessBoost01)}`,
      ]),
    });
  }

  private readSignalProfile(feature: ChatFeatureSnapshot | undefined): AttachmentSignalProfile {
    if (!feature) {
      return createEmptySignalProfile('featureSignals=absent');
    }

    return Object.freeze({
      publicExposure01: firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.publicExposure01),
      negotiationStrain01: firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.negotiationStrain01),
      betrayalRisk01: firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.betrayalRisk01),
      stabilityReserve01: firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.stabilityReserve01),
      admirationField01: firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.admirationField01),
      contemptField01: firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.contemptField01),
      fearField01: firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.fearField01),
      silenceReadiness01: firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.silenceReadiness01),
      comebackReadiness01: firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.comebackReadiness01),
      exhaustionDrag01: firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.exhaustionDrag01),
      witnessDensity01: firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.witnessDensity01),
      supportEcho01: firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.supportEcho01),
      predatoryQuiet01: firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.predatoryQuiet01),
      continuityHeat01: firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.continuityHeat01),
      proofExposure01: firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.proofExposure01),
      notes: Object.freeze([
        'featureSignals=present',
        `signal:publicExposure01=${toPct(firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.publicExposure01))}`,
        `signal:negotiationStrain01=${toPct(firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.negotiationStrain01))}`,
        `signal:betrayalRisk01=${toPct(firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.betrayalRisk01))}`,
        `signal:stabilityReserve01=${toPct(firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.stabilityReserve01))}`,
        `signal:admirationField01=${toPct(firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.admirationField01))}`,
        `signal:contemptField01=${toPct(firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.contemptField01))}`,
        `signal:fearField01=${toPct(firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.fearField01))}`,
        `signal:silenceReadiness01=${toPct(firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.silenceReadiness01))}`,
        `signal:comebackReadiness01=${toPct(firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.comebackReadiness01))}`,
        `signal:exhaustionDrag01=${toPct(firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.exhaustionDrag01))}`,
        `signal:witnessDensity01=${toPct(firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.witnessDensity01))}`,
        `signal:supportEcho01=${toPct(firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.supportEcho01))}`,
        `signal:predatoryQuiet01=${toPct(firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.predatoryQuiet01))}`,
        `signal:continuityHeat01=${toPct(firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.continuityHeat01))}`,
        `signal:proofExposure01=${toPct(firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.proofExposure01))}`,
      ]),
    });
  }

  private readLearningBias(profile: ChatLearningProfile | undefined): AttachmentLearningBias {
    if (!profile) {
      return createEmptyLearningBias('learningProfile=absent');
    }

    const record = profile as unknown as Record<string, unknown>;
    const affectRecord = record.affect && typeof record.affect === 'object'
      ? (record.affect as Record<string, unknown>)
      : undefined;

    return Object.freeze({
      attachmentBaseline01: clampEmotionScalar(firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.attachmentBaseline01) || firstKnownScore01(affectRecord, ['attachment01'])),
      trustBaseline01: clampEmotionScalar(firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.trustBaseline01) || firstKnownScore01(affectRecord, ['trust01'])),
      rivalryBaseline01: clampEmotionScalar(firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.rivalryBaseline01) || firstKnownScore01(affectRecord, ['rivalry01'])),
      rescueSeeking01: firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.rescueSeeking01),
      helperPreference01: firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.helperPreference01),
      haterSusceptibility01: firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.haterSusceptibility01),
      memoryWeight01: firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.memoryWeight01),
      followThrough01: firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.followThrough01),
      socialRiskTolerance01: firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.socialRiskTolerance01),
      negotiationDiscipline01: firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.negotiationDiscipline01),
      recoveryDiscipline01: firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.recoveryDiscipline01),
      witnessNeed01: firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.witnessNeed01),
      notes: Object.freeze([
        'learningProfile=present',
        `profile:attachmentBaseline01=${toPct(firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.attachmentBaseline01))}`,
        `profile:trustBaseline01=${toPct(firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.trustBaseline01))}`,
        `profile:rivalryBaseline01=${toPct(firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.rivalryBaseline01))}`,
        `profile:rescueSeeking01=${toPct(firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.rescueSeeking01))}`,
        `profile:helperPreference01=${toPct(firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.helperPreference01))}`,
        `profile:haterSusceptibility01=${toPct(firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.haterSusceptibility01))}`,
        `profile:memoryWeight01=${toPct(firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.memoryWeight01))}`,
        `profile:followThrough01=${toPct(firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.followThrough01))}`,
        `profile:socialRiskTolerance01=${toPct(firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.socialRiskTolerance01))}`,
        `profile:negotiationDiscipline01=${toPct(firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.negotiationDiscipline01))}`,
        `profile:recoveryDiscipline01=${toPct(firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.recoveryDiscipline01))}`,
        `profile:witnessNeed01=${toPct(firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.witnessNeed01))}`,
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

export function summarizeAttachmentAssessment(
  result: AttachmentAssessment,
  options: AttachmentModelOptions = {},
): readonly string[] {
  return createAttachmentModel(options).summarize(result);
}

export function assessAttachmentCandidate(
  candidate: AttachmentAffinityCandidate,
  options: AttachmentModelOptions = {},
): AttachmentCandidateAssessment {
  return createAttachmentModel(options).assessCandidate(candidate);
}

export function summarizeAttachmentCandidate(
  candidate: AttachmentAffinityCandidate,
  options: AttachmentModelOptions = {},
): readonly string[] {
  return createAttachmentModel(options).summarizeCandidate(candidate);
}

export function assessAttachmentBatch(
  input: AttachmentBatchInput,
  options: AttachmentModelOptions = {},
): AttachmentBatchResult {
  return createAttachmentModel(options).assessBatch(input);
}

export function buildAttachmentDiagnosticReport(
  result: AttachmentAssessment,
  options: AttachmentModelOptions = {},
): AttachmentDiagnosticReport {
  return createAttachmentModel(options).buildDiagnosticReport(result);
}

/* ========================================================================== *
 * MARK: Internal helpers
 * ========================================================================== */

function deriveAggregateFromAssessment(result: AttachmentAssessment): AttachmentAggregateProfile {
  const base = Object.freeze({
    attachment01: result.attachment01,
    trust01: result.trust01,
    rivalryContamination01: result.rivalryContamination01,
    rescueGravity01: result.rescueGravity01,
    familiarity01: result.familiarity01,
    helperAffinity01: result.helperAffinity01,
  });
  return Object.freeze({
    ...base,
    trend: deriveAggregateTrend(base),
    riskLabels: deriveAggregateRiskLabels(base, {
      betrayalRisk01: firstNumberFromMetadata(result.metadata, 'betrayalRisk01'),
      predatoryQuiet01: firstNumberFromMetadata(result.metadata, 'predatoryQuiet01'),
      publicExposure01: firstNumberFromMetadata(result.metadata, 'publicExposure01'),
      witnessDensity01: firstNumberFromMetadata(result.metadata, 'witnessDensity01'),
      channelArchetype: getChannelArchetype(result.channel),
      helperAffinityFloor: CHAT_ATTACHMENT_MODEL_DEFAULTS.helperAffinityThreshold,
      rivalryOverrideThreshold: CHAT_ATTACHMENT_MODEL_DEFAULTS.rivalryOverrideThreshold,
    }),
  });
}

function deriveCandidateGrade(candidate: Pick<
  AttachmentAffinityCandidate,
  'attachment01' | 'trust01' | 'helperAffinity01' | 'rivalryContamination01' | 'rescueGravity01'
>): AttachmentCandidateGrade {
  const score =
    Number(candidate.attachment01) * 0.34 +
    Number(candidate.helperAffinity01) * 0.23 +
    Number(candidate.trust01) * 0.19 +
    Number(candidate.rescueGravity01) * 0.12 -
    Number(candidate.rivalryContamination01) * 0.28;
  if (score >= 0.72) return 'SOVEREIGN';
  if (score >= 0.56) return 'STRONG';
  if (score >= 0.4) return 'VIABLE';
  if (score >= 0.24) return 'FRINGE';
  return 'UNSAFE';
}

function deriveCandidateTrend(candidate: Pick<
  AttachmentAffinityCandidate,
  'attachment01' | 'trust01' | 'helperAffinity01' | 'rivalryContamination01' | 'rescueGravity01'
>): AttachmentTrend {
  if (Number(candidate.rivalryContamination01) >= 0.72) {
    return 'RIVALRY_HEAVY';
  }
  if (
    Number(candidate.attachment01) >= 0.62 &&
    Number(candidate.trust01) >= 0.54 &&
    Number(candidate.helperAffinity01) >= 0.57
  ) {
    return 'ASCENDING';
  }
  if (
    Math.abs(Number(candidate.attachment01) - Number(candidate.trust01)) <= 0.08 &&
    Number(candidate.rivalryContamination01) < 0.4
  ) {
    return 'STABLE';
  }
  if (Number(candidate.attachment01) >= 0.42 && Number(candidate.rivalryContamination01) >= 0.4) {
    return 'CONTESTED';
  }
  return 'DESCENDING';
}

function deriveAggregateTrend(base: {
  readonly attachment01: Score01;
  readonly trust01: Score01;
  readonly rivalryContamination01: Score01;
  readonly rescueGravity01: Score01;
  readonly familiarity01: Score01;
  readonly helperAffinity01: Score01;
}): AttachmentTrend {
  if (Number(base.rivalryContamination01) >= 0.72) {
    return 'RIVALRY_HEAVY';
  }
  if (
    Number(base.attachment01) >= 0.61 &&
    Number(base.trust01) >= 0.58 &&
    Number(base.helperAffinity01) >= 0.57
  ) {
    return 'ASCENDING';
  }
  if (Math.abs(Number(base.attachment01) - Number(base.trust01)) <= 0.07) {
    return 'STABLE';
  }
  if (Number(base.rescueGravity01) >= 0.58 && Number(base.rivalryContamination01) >= 0.42) {
    return 'CONTESTED';
  }
  return 'DESCENDING';
}

function deriveCandidateRiskLabels(
  candidate: Pick<
    AttachmentAffinityCandidate,
    'attachment01' | 'trust01' | 'helperAffinity01' | 'rivalryContamination01' | 'rescueGravity01'
  >,
  extras?: Readonly<{
    betrayalRisk01?: Score01;
    predatoryQuiet01?: Score01;
    publicExposure01?: Score01;
    witnessDensity01?: Score01;
    channelArchetype?: AttachmentChannelArchetype;
  }>,
): readonly AttachmentRiskLabel[] {
  const labels: AttachmentRiskLabel[] = [];
  if (Number(candidate.trust01) < 0.32 && Number(candidate.rescueGravity01) < 0.42) {
    labels.push('ISOLATION_RISK');
  }
  if (Number(extras?.betrayalRisk01 ?? 0) >= 0.55) {
    labels.push('BETRAYAL_RISK');
  }
  if (
    Number(extras?.predatoryQuiet01 ?? 0) >= 0.58 ||
    extras?.channelArchetype === 'PREDATORY_CHAMBER'
  ) {
    labels.push('PREDATORY_SILENCE');
  }
  if (
    Number(extras?.publicExposure01 ?? 0) >= 0.61 &&
    Number(extras?.witnessDensity01 ?? 0) >= 0.61
  ) {
    labels.push('PUBLIC_SWARM');
  }
  if (Number(candidate.rivalryContamination01) >= CHAT_ATTACHMENT_MODEL_DEFAULTS.rivalryOverrideThreshold) {
    labels.push('RIVALRY_OVERRIDE');
  }
  if (Number(candidate.helperAffinity01) >= 0.72 && Number(candidate.trust01) < 0.42) {
    labels.push('HELPER_DEPENDENCY');
  }
  if (Number(extras?.witnessDensity01 ?? 0) >= CHAT_ATTACHMENT_MODEL_DEFAULTS.crowdWitnessThreshold) {
    labels.push('WITNESS_LOCK');
  }
  return Object.freeze(unique(labels));
}

function deriveAggregateRiskLabels(
  base: {
    readonly attachment01: Score01;
    readonly trust01: Score01;
    readonly rivalryContamination01: Score01;
    readonly rescueGravity01: Score01;
    readonly familiarity01: Score01;
    readonly helperAffinity01: Score01;
  },
  extras: Readonly<{
    betrayalRisk01?: Score01;
    predatoryQuiet01?: Score01;
    publicExposure01?: Score01;
    witnessDensity01?: Score01;
    channelArchetype?: AttachmentChannelArchetype;
    helperAffinityFloor: number;
    rivalryOverrideThreshold: number;
  }>,
): readonly AttachmentRiskLabel[] {
  const labels: AttachmentRiskLabel[] = [];
  if (Number(base.trust01) < 0.34 && Number(base.rescueGravity01) < 0.45) {
    labels.push('ISOLATION_RISK');
  }
  if (Number(extras.betrayalRisk01 ?? 0) >= 0.58) {
    labels.push('BETRAYAL_RISK');
  }
  if (
    Number(extras.predatoryQuiet01 ?? 0) >= 0.58 ||
    extras.channelArchetype === 'PREDATORY_CHAMBER'
  ) {
    labels.push('PREDATORY_SILENCE');
  }
  if (
    Number(extras.publicExposure01 ?? 0) >= 0.61 &&
    Number(extras.witnessDensity01 ?? 0) >= 0.61
  ) {
    labels.push('PUBLIC_SWARM');
  }
  if (Number(base.rivalryContamination01) >= extras.rivalryOverrideThreshold) {
    labels.push('RIVALRY_OVERRIDE');
  }
  if (Number(base.helperAffinity01) >= extras.helperAffinityFloor && Number(base.trust01) < 0.44) {
    labels.push('HELPER_DEPENDENCY');
  }
  if (Number(extras.witnessDensity01 ?? 0) >= CHAT_ATTACHMENT_MODEL_DEFAULTS.crowdWitnessThreshold) {
    labels.push('WITNESS_LOCK');
  }
  return Object.freeze(unique(labels));
}

function traceItem(
  key: string,
  contribution01: Score01,
  direction: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL',
  reason: string,
): AttachmentCandidateTraceItem {
  return Object.freeze({ key, contribution01, direction, reason });
}

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
  if ((right.grade ?? deriveCandidateGrade(right)) !== (left.grade ?? deriveCandidateGrade(left))) {
    return gradeRank(right.grade ?? deriveCandidateGrade(right)) - gradeRank(left.grade ?? deriveCandidateGrade(left));
  }
  return left.actorId.localeCompare(right.actorId);
}

function gradeRank(grade: AttachmentCandidateGrade): number {
  switch (grade) {
    case 'SOVEREIGN':
      return 5;
    case 'STRONG':
      return 4;
    case 'VIABLE':
      return 3;
    case 'FRINGE':
      return 2;
    case 'UNSAFE':
    default:
      return 1;
  }
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

function normalizeCount(value: number | undefined, softCap: number): Score01 {
  if (!value || value <= 0) {
    return 0 as Score01;
  }
  return clampEmotionScalar(Math.min(1, value / Math.max(1, softCap)));
}

function channelTrustBias(
  channel: ChatVisibleChannel,
  defaults: typeof CHAT_ATTACHMENT_MODEL_DEFAULTS,
): number {
  if (channel === 'SYNDICATE') return defaults.syndicateTrustBonus;
  if (channel === 'DEAL_ROOM') return -defaults.dealRoomTrustPenalty;
  if (channel === 'LOBBY') return -defaults.lobbyNeutralityDampening;
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

function unique<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)]);
}

function mostCommon<T extends string>(values: readonly T[], fallback: T): T {
  if (!values.length) return fallback;
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best = fallback;
  let bestCount = -1;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function firstKnownScore01(
  source: unknown,
  keys: readonly string[] | undefined,
): Score01 {
  if (!source || typeof source !== 'object' || !keys?.length) {
    return 0 as Score01;
  }

  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const direct = record[key];
    if (typeof direct === 'number') {
      return clampEmotionScalar(direct);
    }

    if (direct && typeof direct === 'object') {
      const nestedValue = readNumericFromObject(direct, ['value01', 'score01', 'normalized01', 'score', 'value']);
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

function getChannelArchetype(channel: ChatVisibleChannel): AttachmentChannelArchetype {
  switch (channel) {
    case 'GLOBAL':
      return 'PUBLIC_ARENA';
    case 'SYNDICATE':
      return 'TRUST_RING';
    case 'DEAL_ROOM':
      return 'PREDATORY_CHAMBER';
    case 'LOBBY':
      return 'LOW_HEAT_STAGING';
    default:
      return 'UNKNOWN';
  }
}

function createEmptySignalProfile(note: string): AttachmentSignalProfile {
  return Object.freeze({
    publicExposure01: 0 as Score01,
    negotiationStrain01: 0 as Score01,
    betrayalRisk01: 0 as Score01,
    stabilityReserve01: 0 as Score01,
    admirationField01: 0 as Score01,
    contemptField01: 0 as Score01,
    fearField01: 0 as Score01,
    silenceReadiness01: 0 as Score01,
    comebackReadiness01: 0 as Score01,
    exhaustionDrag01: 0 as Score01,
    witnessDensity01: 0 as Score01,
    supportEcho01: 0 as Score01,
    predatoryQuiet01: 0 as Score01,
    continuityHeat01: 0 as Score01,
    proofExposure01: 0 as Score01,
    notes: Object.freeze([note]),
  });
}

function createEmptyLearningBias(note: string): AttachmentLearningBias {
  return Object.freeze({
    attachmentBaseline01: 0 as Score01,
    trustBaseline01: 0 as Score01,
    rivalryBaseline01: 0 as Score01,
    rescueSeeking01: 0 as Score01,
    helperPreference01: 0 as Score01,
    haterSusceptibility01: 0 as Score01,
    memoryWeight01: 0 as Score01,
    followThrough01: 0 as Score01,
    socialRiskTolerance01: 0 as Score01,
    negotiationDiscipline01: 0 as Score01,
    recoveryDiscipline01: 0 as Score01,
    witnessNeed01: 0 as Score01,
    notes: Object.freeze([note]),
  });
}

function safeJsonObject(source: Record<string, unknown>): JsonObject {
  const entries: [string, unknown][] = Object.entries(source).filter(([, value]) => value !== undefined);
  return Object.freeze(Object.fromEntries(entries)) as JsonObject;
}

function firstNumberFromMetadata(metadata: JsonObject | undefined, key: string): Score01 {
  if (!metadata) return 0 as Score01;
  const value = (metadata as Record<string, unknown>)[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clampEmotionScalar(value);
  }
  return 0 as Score01;
}

function read_publicExposure01(feature: ChatFeatureSnapshot | undefined): Score01 {
  if (!feature) return 0 as Score01;
  return firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.publicExposure01);
}

function read_negotiationStrain01(feature: ChatFeatureSnapshot | undefined): Score01 {
  if (!feature) return 0 as Score01;
  return firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.negotiationStrain01);
}

function read_betrayalRisk01(feature: ChatFeatureSnapshot | undefined): Score01 {
  if (!feature) return 0 as Score01;
  return firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.betrayalRisk01);
}

function read_stabilityReserve01(feature: ChatFeatureSnapshot | undefined): Score01 {
  if (!feature) return 0 as Score01;
  return firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.stabilityReserve01);
}

function read_admirationField01(feature: ChatFeatureSnapshot | undefined): Score01 {
  if (!feature) return 0 as Score01;
  return firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.admirationField01);
}

function read_contemptField01(feature: ChatFeatureSnapshot | undefined): Score01 {
  if (!feature) return 0 as Score01;
  return firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.contemptField01);
}

function read_fearField01(feature: ChatFeatureSnapshot | undefined): Score01 {
  if (!feature) return 0 as Score01;
  return firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.fearField01);
}

function read_silenceReadiness01(feature: ChatFeatureSnapshot | undefined): Score01 {
  if (!feature) return 0 as Score01;
  return firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.silenceReadiness01);
}

function read_comebackReadiness01(feature: ChatFeatureSnapshot | undefined): Score01 {
  if (!feature) return 0 as Score01;
  return firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.comebackReadiness01);
}

function read_exhaustionDrag01(feature: ChatFeatureSnapshot | undefined): Score01 {
  if (!feature) return 0 as Score01;
  return firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.exhaustionDrag01);
}

function read_witnessDensity01(feature: ChatFeatureSnapshot | undefined): Score01 {
  if (!feature) return 0 as Score01;
  return firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.witnessDensity01);
}

function read_supportEcho01(feature: ChatFeatureSnapshot | undefined): Score01 {
  if (!feature) return 0 as Score01;
  return firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.supportEcho01);
}

function read_predatoryQuiet01(feature: ChatFeatureSnapshot | undefined): Score01 {
  if (!feature) return 0 as Score01;
  return firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.predatoryQuiet01);
}

function read_continuityHeat01(feature: ChatFeatureSnapshot | undefined): Score01 {
  if (!feature) return 0 as Score01;
  return firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.continuityHeat01);
}

function read_proofExposure01(feature: ChatFeatureSnapshot | undefined): Score01 {
  if (!feature) return 0 as Score01;
  return firstKnownScore01(feature, CHAT_ATTACHMENT_FEATURE_SIGNAL_KEYS.proofExposure01);
}

function read_profile_attachmentBaseline01(profile: ChatLearningProfile | undefined): Score01 {
  if (!profile) return 0 as Score01;
  return firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.attachmentBaseline01);
}

function read_profile_trustBaseline01(profile: ChatLearningProfile | undefined): Score01 {
  if (!profile) return 0 as Score01;
  return firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.trustBaseline01);
}

function read_profile_rivalryBaseline01(profile: ChatLearningProfile | undefined): Score01 {
  if (!profile) return 0 as Score01;
  return firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.rivalryBaseline01);
}

function read_profile_rescueSeeking01(profile: ChatLearningProfile | undefined): Score01 {
  if (!profile) return 0 as Score01;
  return firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.rescueSeeking01);
}

function read_profile_helperPreference01(profile: ChatLearningProfile | undefined): Score01 {
  if (!profile) return 0 as Score01;
  return firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.helperPreference01);
}

function read_profile_haterSusceptibility01(profile: ChatLearningProfile | undefined): Score01 {
  if (!profile) return 0 as Score01;
  return firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.haterSusceptibility01);
}

function read_profile_memoryWeight01(profile: ChatLearningProfile | undefined): Score01 {
  if (!profile) return 0 as Score01;
  return firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.memoryWeight01);
}

function read_profile_followThrough01(profile: ChatLearningProfile | undefined): Score01 {
  if (!profile) return 0 as Score01;
  return firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.followThrough01);
}

function read_profile_socialRiskTolerance01(profile: ChatLearningProfile | undefined): Score01 {
  if (!profile) return 0 as Score01;
  return firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.socialRiskTolerance01);
}

function read_profile_negotiationDiscipline01(profile: ChatLearningProfile | undefined): Score01 {
  if (!profile) return 0 as Score01;
  return firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.negotiationDiscipline01);
}

function read_profile_recoveryDiscipline01(profile: ChatLearningProfile | undefined): Score01 {
  if (!profile) return 0 as Score01;
  return firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.recoveryDiscipline01);
}

function read_profile_witnessNeed01(profile: ChatLearningProfile | undefined): Score01 {
  if (!profile) return 0 as Score01;
  return firstKnownScore01(profile, CHAT_ATTACHMENT_PROFILE_SIGNAL_KEYS.witnessNeed01);
}

function computeChannelPressureModifier(channel: ChatVisibleChannel): Score01 {
  switch (channel) {
    case 'GLOBAL':
      return 0.62 as Score01;
    case 'DEAL_ROOM':
      return 0.74 as Score01;
    case 'SYNDICATE':
      return 0.39 as Score01;
    case 'LOBBY':
      return 0.24 as Score01;
    default:
      return 0.5 as Score01;
  }
}

function computeChannelRescueModifier(channel: ChatVisibleChannel): Score01 {
  switch (channel) {
    case 'SYNDICATE':
      return 0.68 as Score01;
    case 'GLOBAL':
      return 0.43 as Score01;
    case 'DEAL_ROOM':
      return 0.28 as Score01;
    case 'LOBBY':
      return 0.36 as Score01;
    default:
      return 0.4 as Score01;
  }
}

function computeCandidateCompositeScore(candidate: AttachmentAffinityCandidate): Score01 {
  return clampEmotionScalar(
    Number(candidate.attachment01) * 0.34 +
      Number(candidate.helperAffinity01) * 0.23 +
      Number(candidate.trust01) * 0.19 +
      Number(candidate.familiarity01) * 0.12 +
      Number(candidate.rescueGravity01) * 0.12 -
      Number(candidate.rivalryContamination01) * 0.28,
  );
}

function buildCandidateSummaryTable(candidate: AttachmentAffinityCandidate): JsonObject {
  return safeJsonObject({
    actorId: candidate.actorId,
    grade: candidate.grade ?? deriveCandidateGrade(candidate),
    trend: candidate.trend ?? deriveCandidateTrend(candidate),
    attachment01: Number(candidate.attachment01),
    trust01: Number(candidate.trust01),
    helperAffinity01: Number(candidate.helperAffinity01),
    rescueGravity01: Number(candidate.rescueGravity01),
    familiarity01: Number(candidate.familiarity01),
    rivalryContamination01: Number(candidate.rivalryContamination01),
    shouldFollowAcrossModes: candidate.shouldFollowAcrossModes,
    compositeScore01: Number(computeCandidateCompositeScore(candidate)),
  });
}

function buildAssessmentSummaryTable(result: AttachmentAssessment): JsonObject {
  return safeJsonObject({
    state: result.state,
    attachment01: Number(result.attachment01),
    trust01: Number(result.trust01),
    helperAffinity01: Number(result.helperAffinity01),
    rescueGravity01: Number(result.rescueGravity01),
    familiarity01: Number(result.familiarity01),
    rivalryContamination01: Number(result.rivalryContamination01),
    confidenceBand: result.confidenceBand,
    followPersonaId: result.followPersonaId ?? null,
    driverCount: result.drivers.length,
    candidateCount: result.candidates.length,
  });
}

function evaluateIsolationRisk(result: AttachmentAssessment): Score01 {
  return clampEmotionScalar(
    invert01(result.trust01) * 0.34 +
      invert01(result.rescueGravity01) * 0.22 +
      invert01(result.helperAffinity01) * 0.18 +
      Number(result.rivalryContamination01) * 0.26,
  );
}

function evaluateWitnessLock(result: AttachmentAssessment): Score01 {
  return clampEmotionScalar(
    Number(result.attachment01) * 0.32 +
      Number(result.familiarity01) * 0.24 +
      Number(result.helperAffinity01) * 0.12 +
      invert01(result.rivalryContamination01) * 0.14,
  );
}

function evaluateHelperDependency(result: AttachmentAssessment): Score01 {
  return clampEmotionScalar(
    Number(result.helperAffinity01) * 0.44 +
      Number(result.rescueGravity01) * 0.24 +
      invert01(result.trust01) * 0.2 +
      Number(result.attachment01) * 0.12,
  );
}

function evaluateRivalryOverride(result: AttachmentAssessment): Score01 {
  return clampEmotionScalar(
    Number(result.rivalryContamination01) * 0.64 +
      invert01(result.trust01) * 0.16 +
      invert01(result.helperAffinity01) * 0.1 +
      invert01(result.rescueGravity01) * 0.1,
  );
}

function evaluateTrustRepairReadiness(result: AttachmentAssessment): Score01 {
  return clampEmotionScalar(
    Number(result.trust01) * 0.34 +
      Number(result.rescueGravity01) * 0.2 +
      Number(result.helperAffinity01) * 0.18 +
      Number(result.familiarity01) * 0.16 +
      invert01(result.rivalryContamination01) * 0.12,
  );
}

function evaluateFollowDurability(result: AttachmentAssessment): Score01 {
  return clampEmotionScalar(
    Number(result.attachment01) * 0.34 +
      Number(result.trust01) * 0.22 +
      Number(result.helperAffinity01) * 0.2 +
      Number(result.familiarity01) * 0.12 +
      invert01(result.rivalryContamination01) * 0.12,
  );
}

function buildAttachmentOperatorNotes(result: AttachmentAssessment): readonly string[] {
  return Object.freeze([
    `summary=${JSON.stringify(buildAssessmentSummaryTable(result))}`,
    `isolationRisk=${toPct(evaluateIsolationRisk(result))}`,
    `witnessLock=${toPct(evaluateWitnessLock(result))}`,
    `helperDependency=${toPct(evaluateHelperDependency(result))}`,
    `rivalryOverride=${toPct(evaluateRivalryOverride(result))}`,
    `trustRepairReadiness=${toPct(evaluateTrustRepairReadiness(result))}`,
    `followDurability=${toPct(evaluateFollowDurability(result))}`,
  ]);
}

export function compareAttachmentAssessments(
  left: AttachmentAssessment,
  right: AttachmentAssessment,
): number {
  const leftScore =
    Number(left.attachment01) * 0.32 +
    Number(left.trust01) * 0.2 +
    Number(left.helperAffinity01) * 0.16 +
    Number(left.rescueGravity01) * 0.12 +
    Number(left.familiarity01) * 0.1 -
    Number(left.rivalryContamination01) * 0.28;

  const rightScore =
    Number(right.attachment01) * 0.32 +
    Number(right.trust01) * 0.2 +
    Number(right.helperAffinity01) * 0.16 +
    Number(right.rescueGravity01) * 0.12 +
    Number(right.familiarity01) * 0.1 -
    Number(right.rivalryContamination01) * 0.28;

  if (rightScore !== leftScore) {
    return rightScore - leftScore;
  }
  return Number(right.evaluatedAt) - Number(left.evaluatedAt);
}

export function buildAttachmentOperatorPayload(result: AttachmentAssessment): JsonObject {
  const diagnostic = buildAttachmentDiagnosticReport(result);
  const topCandidate = result.candidates[0];
  return safeJsonObject({
    assessment: buildAssessmentSummaryTable(result),
    diagnostic,
    operatorNotes: buildAttachmentOperatorNotes(result),
    topCandidate: topCandidate ? buildCandidateSummaryTable(topCandidate) : null,
  });
}

export function scoreAttachmentState(result: AttachmentAssessment): Score01 {
  return clampEmotionScalar(
    Number(result.attachment01) * 0.32 +
      Number(result.trust01) * 0.21 +
      Number(result.helperAffinity01) * 0.16 +
      Number(result.rescueGravity01) * 0.11 +
      Number(result.familiarity01) * 0.08 -
      Number(result.rivalryContamination01) * 0.22,
  );
}

export function summarizeAttachmentOperatorView(result: AttachmentAssessment): readonly string[] {
  const payload = buildAttachmentOperatorPayload(result);
  return Object.freeze([
    ...summarizeAttachmentAssessment(result),
    ...buildAttachmentOperatorNotes(result),
    `payloadKeys=${Object.keys(payload).join('|')}`,
  ]);
}
