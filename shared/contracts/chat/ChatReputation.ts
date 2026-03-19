/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT REPUTATION CONTRACT
 * FILE: shared/contracts/chat/ChatReputation.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Shared law for player / NPC public standing inside the chat universe.
 *
 * Audience heat answers, "How hot does the room feel right now?"
 * Reputation answers, "What does the room believe about this actor over time?"
 *
 * This contract defines:
 * 1. canonical reputation dimensions,
 * 2. public/private standing,
 * 3. trust, notoriety, threat, shame, awe, and bluff exposure,
 * 4. per-channel and cross-channel standing,
 * 5. event deltas,
 * 6. witness-derived visibility,
 * 7. decay, recovery, and lock rules,
 * 8. preview / summary surfaces for UI and orchestration.
 *
 * Design doctrine
 * ---------------
 * 1. Reputation is persistent social memory, not instant heat.
 * 2. Standing can improve, decay, fracture, or harden.
 * 3. Channel-local standing and global standing must coexist.
 * 4. Reputation can be visible, latent, shadow-held, or protected.
 * 5. Trust and fear can rise together.
 * 6. Shame and notoriety are related, not identical.
 * 7. A contract file never decides runtime behavior; it only defines law.
 * ============================================================================
 */

export type ChatReputationVersion = 1;

export const CHAT_REPUTATION_VERSION: ChatReputationVersion = 1;

export type ChatReputationActorId = string;
export type ChatReputationSubjectId = string;
export type ChatReputationChannelId = string;
export type ChatReputationRoomId = string;
export type ChatReputationRunId = string;
export type ChatReputationMomentId = string;
export type ChatReputationSceneId = string;
export type ChatReputationEventId = string;
export type ChatReputationProofId = string;

export type ChatReputationEntityKind =
  | 'PLAYER'
  | 'NPC'
  | 'HELPER'
  | 'HATER'
  | 'SYSTEM'
  | 'FACTION'
  | 'DEAL_PARTY'
  | 'UNKNOWN';

export type ChatReputationVisibility =
  | 'PRIVATE'
  | 'LOCAL'
  | 'CHANNEL'
  | 'CROSS_CHANNEL'
  | 'PUBLIC'
  | 'SHADOW';

export type ChatReputationIntegrityBand =
  | 'SHATTERED'
  | 'FRAGILE'
  | 'UNSTABLE'
  | 'STABLE'
  | 'HARDENED'
  | 'ICONIC';

export type ChatReputationBand =
  | 'RUINED'
  | 'DAMAGED'
  | 'QUESTIONED'
  | 'NEUTRAL'
  | 'RESPECTED'
  | 'FEARED'
  | 'REVERED'
  | 'LEGENDARY';

export type ChatReputationDriver =
  | 'NONE'
  | 'PERFORMANCE'
  | 'COLLAPSE'
  | 'COMEBACK'
  | 'BLUFF'
  | 'EXPOSURE'
  | 'RESCUE'
  | 'DOMINANCE'
  | 'HUMILIATION'
  | 'NEGOTIATION'
  | 'RIVALRY'
  | 'WITNESSING'
  | 'LIVEOPS'
  | 'SOVEREIGNTY'
  | 'PROOF';

export type ChatReputationAxis =
  | 'trust'
  | 'respect'
  | 'fear'
  | 'contempt'
  | 'fascination'
  | 'notoriety'
  | 'shame'
  | 'awe'
  | 'threat'
  | 'bluffExposure'
  | 'reliability'
  | 'legend'
  | 'rescueDebt'
  | 'dealCredibility';

export interface ChatReputationVector {
  readonly trust: number;
  readonly respect: number;
  readonly fear: number;
  readonly contempt: number;
  readonly fascination: number;
  readonly notoriety: number;
  readonly shame: number;
  readonly awe: number;
  readonly threat: number;
  readonly bluffExposure: number;
  readonly reliability: number;
  readonly legend: number;
  readonly rescueDebt: number;
  readonly dealCredibility: number;
}

export interface ChatReputationBudget {
  readonly min: number;
  readonly max: number;
  readonly shockCap: number;
  readonly decayFloor: number;
  readonly hiddenReserve: number;
}

export interface ChatReputationDecayProfile {
  readonly trustDecayPerHour: number;
  readonly respectDecayPerHour: number;
  readonly fearDecayPerHour: number;
  readonly contemptDecayPerHour: number;
  readonly fascinationDecayPerHour: number;
  readonly notorietyDecayPerHour: number;
  readonly shameDecayPerHour: number;
  readonly aweDecayPerHour: number;
  readonly threatDecayPerHour: number;
  readonly bluffExposureDecayPerHour: number;
  readonly reliabilityDecayPerHour: number;
  readonly legendDecayPerHour: number;
  readonly rescueDebtDecayPerHour: number;
  readonly dealCredibilityDecayPerHour: number;
}

export interface ChatReputationExposure {
  readonly visibility: ChatReputationVisibility;
  readonly visibleWitnesses: number;
  readonly latentWitnesses: number;
  readonly proofWeighted: boolean;
  readonly exposedAt?: string;
  readonly shieldedAt?: string;
  readonly lastWitnessedAt?: string;
  readonly canBleedAcrossChannels: boolean;
  readonly isShadowHeld: boolean;
}

export interface ChatReputationAnchor {
  readonly anchorId: string;
  readonly label: string;
  readonly driver: ChatReputationDriver;
  readonly eventId?: ChatReputationEventId;
  readonly sceneId?: ChatReputationSceneId;
  readonly momentId?: ChatReputationMomentId;
  readonly proofId?: ChatReputationProofId;
  readonly startedAt: string;
  readonly lastTouchedAt: string;
  readonly magnitude: number;
  readonly axisWeights: Partial<ChatReputationVector>;
  readonly sticky: boolean;
  readonly visible: boolean;
}

export interface ChatReputationSnapshot {
  readonly version: ChatReputationVersion;
  readonly runId?: ChatReputationRunId;
  readonly roomId?: ChatReputationRoomId;
  readonly channelId?: ChatReputationChannelId;
  readonly subjectId: ChatReputationSubjectId;
  readonly subjectKind: ChatReputationEntityKind;
  readonly updatedAt: string;
  readonly band: ChatReputationBand;
  readonly integrity: ChatReputationIntegrityBand;
  readonly driver: ChatReputationDriver;
  readonly score: number;
  readonly vector: ChatReputationVector;
  readonly exposure: ChatReputationExposure;
  readonly budget: ChatReputationBudget;
  readonly decay: ChatReputationDecayProfile;
  readonly anchors: readonly ChatReputationAnchor[];
  readonly lastEventId?: ChatReputationEventId;
  readonly lastSceneId?: ChatReputationSceneId;
  readonly lastMomentId?: ChatReputationMomentId;
  readonly notes?: readonly string[];
}

export interface ChatChannelReputationSnapshot {
  readonly channelId: ChatReputationChannelId;
  readonly subjectId: ChatReputationSubjectId;
  readonly score: number;
  readonly vector: ChatReputationVector;
  readonly exposure: ChatReputationExposure;
  readonly band: ChatReputationBand;
  readonly integrity: ChatReputationIntegrityBand;
  readonly updatedAt: string;
}

export interface ChatReputationDelta {
  readonly deltaId: string;
  readonly subjectId: ChatReputationSubjectId;
  readonly subjectKind: ChatReputationEntityKind;
  readonly issuedAt: string;
  readonly driver: ChatReputationDriver;
  readonly channelId?: ChatReputationChannelId;
  readonly roomId?: ChatReputationRoomId;
  readonly eventId?: ChatReputationEventId;
  readonly sceneId?: ChatReputationSceneId;
  readonly momentId?: ChatReputationMomentId;
  readonly proofId?: ChatReputationProofId;
  readonly label: string;
  readonly reason: string;
  readonly scoreDelta: number;
  readonly vectorDelta: Partial<ChatReputationVector>;
  readonly exposureDelta?: Partial<ChatReputationExposure>;
  readonly sticky?: boolean;
  readonly hidden?: boolean;
  readonly tags?: readonly string[];
}

export interface ChatReputationSummary {
  readonly subjectId: ChatReputationSubjectId;
  readonly band: ChatReputationBand;
  readonly integrity: ChatReputationIntegrityBand;
  readonly score: number;
  readonly visibility: ChatReputationVisibility;
  readonly headline: string;
  readonly caution: string;
  readonly driver: ChatReputationDriver;
}

export interface ChatReputationPreviewRail {
  readonly headline: string;
  readonly chips: readonly string[];
  readonly emphasis: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly canRecover: boolean;
  readonly canBreakFurther: boolean;
  readonly canPropagateCrossChannel: boolean;
  readonly recommendPrivacy: boolean;
  readonly recommendProofLine: boolean;
}

export const CHAT_REPUTATION_VECTOR_ZERO: ChatReputationVector = Object.freeze({
  trust: 0,
  respect: 0,
  fear: 0,
  contempt: 0,
  fascination: 0,
  notoriety: 0,
  shame: 0,
  awe: 0,
  threat: 0,
  bluffExposure: 0,
  reliability: 0,
  legend: 0,
  rescueDebt: 0,
  dealCredibility: 0,
});

export const CHAT_REPUTATION_BUDGET_DEFAULT: ChatReputationBudget = Object.freeze({
  min: -100,
  max: 100,
  shockCap: 35,
  decayFloor: -15,
  hiddenReserve: 20,
});

export const CHAT_REPUTATION_DECAY_DEFAULT: ChatReputationDecayProfile = Object.freeze({
  trustDecayPerHour: 0.5,
  respectDecayPerHour: 0.5,
  fearDecayPerHour: 0.35,
  contemptDecayPerHour: 0.45,
  fascinationDecayPerHour: 0.75,
  notorietyDecayPerHour: 0.65,
  shameDecayPerHour: 0.55,
  aweDecayPerHour: 0.4,
  threatDecayPerHour: 0.3,
  bluffExposureDecayPerHour: 0.5,
  reliabilityDecayPerHour: 0.35,
  legendDecayPerHour: 0.08,
  rescueDebtDecayPerHour: 0.15,
  dealCredibilityDecayPerHour: 0.4,
});

export const CHAT_REPUTATION_EXPOSURE_PRIVATE: ChatReputationExposure = Object.freeze({
  visibility: 'PRIVATE',
  visibleWitnesses: 0,
  latentWitnesses: 0,
  proofWeighted: false,
  canBleedAcrossChannels: false,
  isShadowHeld: false,
});

export function clampReputationScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= -100) return -100;
  if (value >= 100) return 100;
  return value;
}

export function clampReputationUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 100) return 100;
  return value;
}

export function normalizeReputationVector(
  value?: Partial<ChatReputationVector> | null,
): ChatReputationVector {
  return {
    trust: clampReputationUnit(value?.trust ?? 0),
    respect: clampReputationUnit(value?.respect ?? 0),
    fear: clampReputationUnit(value?.fear ?? 0),
    contempt: clampReputationUnit(value?.contempt ?? 0),
    fascination: clampReputationUnit(value?.fascination ?? 0),
    notoriety: clampReputationUnit(value?.notoriety ?? 0),
    shame: clampReputationUnit(value?.shame ?? 0),
    awe: clampReputationUnit(value?.awe ?? 0),
    threat: clampReputationUnit(value?.threat ?? 0),
    bluffExposure: clampReputationUnit(value?.bluffExposure ?? 0),
    reliability: clampReputationUnit(value?.reliability ?? 0),
    legend: clampReputationUnit(value?.legend ?? 0),
    rescueDebt: clampReputationUnit(value?.rescueDebt ?? 0),
    dealCredibility: clampReputationUnit(value?.dealCredibility ?? 0),
  };
}

export function mergeReputationVector(
  base: ChatReputationVector,
  delta?: Partial<ChatReputationVector> | null,
): ChatReputationVector {
  if (!delta) return base;
  return normalizeReputationVector({
    trust: base.trust + (delta.trust ?? 0),
    respect: base.respect + (delta.respect ?? 0),
    fear: base.fear + (delta.fear ?? 0),
    contempt: base.contempt + (delta.contempt ?? 0),
    fascination: base.fascination + (delta.fascination ?? 0),
    notoriety: base.notoriety + (delta.notoriety ?? 0),
    shame: base.shame + (delta.shame ?? 0),
    awe: base.awe + (delta.awe ?? 0),
    threat: base.threat + (delta.threat ?? 0),
    bluffExposure: base.bluffExposure + (delta.bluffExposure ?? 0),
    reliability: base.reliability + (delta.reliability ?? 0),
    legend: base.legend + (delta.legend ?? 0),
    rescueDebt: base.rescueDebt + (delta.rescueDebt ?? 0),
    dealCredibility: base.dealCredibility + (delta.dealCredibility ?? 0),
  });
}

export function determineReputationBand(snapshotLike: {
  score: number;
  vector: ChatReputationVector;
}): ChatReputationBand {
  const score = clampReputationScore(snapshotLike.score);
  const v = snapshotLike.vector;
  if (v.legend >= 80 || v.awe >= 80 || score >= 85) return 'LEGENDARY';
  if (v.awe >= 60 || score >= 60) return 'REVERED';
  if (v.fear >= 65 || v.threat >= 65) return 'FEARED';
  if (v.respect >= 50 || v.reliability >= 55 || score >= 30) return 'RESPECTED';
  if (score > -10 && score < 15) return 'NEUTRAL';
  if (v.bluffExposure >= 45 || v.shame >= 35 || score <= -10) return 'QUESTIONED';
  if (v.shame >= 55 || v.contempt >= 60 || score <= -35) return 'DAMAGED';
  return 'RUINED';
}

export function determineReputationIntegrity(
  snapshotLike: {
    vector: ChatReputationVector;
    score: number;
    exposure: ChatReputationExposure;
  },
): ChatReputationIntegrityBand {
  const v = snapshotLike.vector;
  const visible = snapshotLike.exposure.visibleWitnesses;
  const scoreAbs = Math.abs(snapshotLike.score);
  const fracture = v.shame + v.bluffExposure + v.contempt;
  const hardening = v.legend + v.reliability + v.respect;
  if (fracture >= 200 && visible >= 6) return 'SHATTERED';
  if (fracture >= 150) return 'FRAGILE';
  if (fracture >= 95 || visible >= 8) return 'UNSTABLE';
  if (hardening >= 165 && scoreAbs >= 40) return 'ICONIC';
  if (hardening >= 110) return 'HARDENED';
  return 'STABLE';
}

export function createReputationSnapshot(
  input: Omit<
    ChatReputationSnapshot,
    'version' | 'band' | 'integrity' | 'vector' | 'exposure' | 'budget' | 'decay'
  > & {
    vector?: Partial<ChatReputationVector>;
    exposure?: Partial<ChatReputationExposure>;
    budget?: Partial<ChatReputationBudget>;
    decay?: Partial<ChatReputationDecayProfile>;
    band?: ChatReputationBand;
    integrity?: ChatReputationIntegrityBand;
  },
): ChatReputationSnapshot {
  const vector = normalizeReputationVector(input.vector);
  const exposure = {
    ...CHAT_REPUTATION_EXPOSURE_PRIVATE,
    ...(input.exposure ?? {}),
  };
  const budget = {
    ...CHAT_REPUTATION_BUDGET_DEFAULT,
    ...(input.budget ?? {}),
  };
  const decay = {
    ...CHAT_REPUTATION_DECAY_DEFAULT,
    ...(input.decay ?? {}),
  };
  const score = clampReputationScore(input.score);
  const band = input.band ?? determineReputationBand({ score, vector });
  const integrity =
    input.integrity ?? determineReputationIntegrity({ vector, score, exposure });

  return {
    version: CHAT_REPUTATION_VERSION,
    runId: input.runId,
    roomId: input.roomId,
    channelId: input.channelId,
    subjectId: input.subjectId,
    subjectKind: input.subjectKind,
    updatedAt: input.updatedAt,
    band,
    integrity,
    driver: input.driver,
    score,
    vector,
    exposure,
    budget,
    decay,
    anchors: input.anchors ?? [],
    lastEventId: input.lastEventId,
    lastSceneId: input.lastSceneId,
    lastMomentId: input.lastMomentId,
    notes: input.notes,
  };
}

export function applyReputationDelta(
  current: ChatReputationSnapshot,
  delta: ChatReputationDelta,
): ChatReputationSnapshot {
  const score = clampReputationScore(current.score + delta.scoreDelta);
  const vector = mergeReputationVector(current.vector, delta.vectorDelta);
  const exposure: ChatReputationExposure = {
    ...current.exposure,
    ...(delta.exposureDelta ?? {}),
  };
  const band = determineReputationBand({ score, vector });
  const integrity = determineReputationIntegrity({ vector, score, exposure });
  const sticky = delta.sticky ?? false;

  const nextAnchors = sticky
    ? [
        ...current.anchors,
        {
          anchorId: delta.deltaId,
          label: delta.label,
          driver: delta.driver,
          eventId: delta.eventId,
          sceneId: delta.sceneId,
          momentId: delta.momentId,
          proofId: delta.proofId,
          startedAt: delta.issuedAt,
          lastTouchedAt: delta.issuedAt,
          magnitude: Math.abs(delta.scoreDelta),
          axisWeights: delta.vectorDelta,
          sticky: true,
          visible: !delta.hidden,
        } satisfies ChatReputationAnchor,
      ]
    : current.anchors;

  return {
    ...current,
    roomId: delta.roomId ?? current.roomId,
    channelId: delta.channelId ?? current.channelId,
    updatedAt: delta.issuedAt,
    driver: delta.driver,
    score,
    vector,
    exposure,
    band,
    integrity,
    anchors: nextAnchors,
    lastEventId: delta.eventId ?? current.lastEventId,
    lastSceneId: delta.sceneId ?? current.lastSceneId,
    lastMomentId: delta.momentId ?? current.lastMomentId,
  };
}

export function createReputationSummary(
  snapshot: ChatReputationSnapshot,
): ChatReputationSummary {
  const headline =
    snapshot.band === 'LEGENDARY'
      ? 'The room treats this name like a story.'
      : snapshot.band === 'REVERED'
        ? 'Standing is unusually strong.'
        : snapshot.band === 'FEARED'
          ? 'People react like this actor can hurt them.'
          : snapshot.band === 'RESPECTED'
            ? 'Standing is solid.'
            : snapshot.band === 'QUESTIONED'
              ? 'Trust is wobbling.'
              : snapshot.band === 'DAMAGED'
                ? 'The room is losing faith.'
                : snapshot.band === 'RUINED'
                  ? 'Public standing is collapsing.'
                  : 'Standing is unsettled.';

  const caution =
    snapshot.vector.bluffExposure >= 50
      ? 'bluff exposure is dangerous'
      : snapshot.vector.shame >= 50
        ? 'shame pressure is elevated'
        : snapshot.vector.contempt >= 50
          ? 'contempt is spreading'
          : snapshot.vector.threat >= 50
            ? 'threat posture is visible'
            : snapshot.vector.legend >= 50
              ? 'legend charge is rising'
              : 'no dominant caution';

  return {
    subjectId: snapshot.subjectId,
    band: snapshot.band,
    integrity: snapshot.integrity,
    score: snapshot.score,
    visibility: snapshot.exposure.visibility,
    headline,
    caution,
    driver: snapshot.driver,
  };
}

export function createReputationPreviewRail(
  snapshot: ChatReputationSnapshot,
): ChatReputationPreviewRail {
  const summary = createReputationSummary(snapshot);
  const chips = [
    `band:${snapshot.band.toLowerCase()}`,
    `integrity:${snapshot.integrity.toLowerCase()}`,
    `driver:${snapshot.driver.toLowerCase()}`,
    `visibility:${snapshot.exposure.visibility.toLowerCase()}`,
  ];

  const emphasis: ChatReputationPreviewRail['emphasis'] =
    snapshot.band === 'LEGENDARY' ||
    snapshot.band === 'RUINED' ||
    snapshot.integrity === 'SHATTERED'
      ? 'CRITICAL'
      : snapshot.band === 'FEARED' ||
          snapshot.band === 'REVERED' ||
          snapshot.integrity === 'FRAGILE'
        ? 'HIGH'
        : snapshot.band === 'QUESTIONED' ||
            snapshot.band === 'DAMAGED' ||
            snapshot.band === 'RESPECTED'
          ? 'MEDIUM'
          : 'LOW';

  return {
    headline: summary.headline,
    chips,
    emphasis,
    canRecover: snapshot.band !== 'LEGENDARY',
    canBreakFurther:
      snapshot.band === 'QUESTIONED' ||
      snapshot.band === 'DAMAGED' ||
      snapshot.band === 'RUINED' ||
      snapshot.integrity === 'FRAGILE' ||
      snapshot.integrity === 'UNSTABLE',
    canPropagateCrossChannel:
      snapshot.exposure.canBleedAcrossChannels || snapshot.exposure.visibility === 'PUBLIC',
    recommendPrivacy:
      snapshot.vector.shame >= 45 ||
      snapshot.vector.bluffExposure >= 50 ||
      snapshot.exposure.visibility === 'PUBLIC',
    recommendProofLine:
      snapshot.vector.reliability >= 50 ||
      snapshot.vector.bluffExposure >= 45 ||
      snapshot.driver === 'PROOF',
  };
}

export interface ChatReputationArchiveRecord {
  readonly archiveId: string;
  readonly subjectId: ChatReputationSubjectId;
  readonly recordedAt: string;
  readonly snapshot: ChatReputationSnapshot;
  readonly summary: ChatReputationSummary;
  readonly tags?: readonly string[];
}

export interface ChatReputationDiagnostics {
  readonly subjectId: ChatReputationSubjectId;
  readonly dominantAxis: ChatReputationAxis;
  readonly dominantValue: number;
  readonly mostFragileAxis: ChatReputationAxis;
  readonly mostFragileValue: number;
  readonly isTrusted: boolean;
  readonly isFeared: boolean;
  readonly isExposed: boolean;
  readonly isLegendary: boolean;
  readonly isDealRisky: boolean;
}

export function createReputationDiagnostics(
  snapshot: ChatReputationSnapshot,
): ChatReputationDiagnostics {
  const entries = Object.entries(snapshot.vector) as Array<[ChatReputationAxis, number]>;
  const dominant = entries.reduce((best, entry) => (entry[1] > best[1] ? entry : best), entries[0]);

  const fragileAxes: Array<[ChatReputationAxis, number]> = [
    ['bluffExposure', snapshot.vector.bluffExposure],
    ['shame', snapshot.vector.shame],
    ['contempt', snapshot.vector.contempt],
    ['rescueDebt', snapshot.vector.rescueDebt],
    ['dealCredibility', 100 - snapshot.vector.dealCredibility],
  ];
  const fragile = fragileAxes.reduce((best, entry) => (entry[1] > best[1] ? entry : best), fragileAxes[0]);

  return {
    subjectId: snapshot.subjectId,
    dominantAxis: dominant[0],
    dominantValue: dominant[1],
    mostFragileAxis: fragile[0],
    mostFragileValue: fragile[1],
    isTrusted: snapshot.vector.trust >= 50 || snapshot.vector.reliability >= 50,
    isFeared: snapshot.vector.fear >= 50 || snapshot.vector.threat >= 50,
    isExposed:
      snapshot.exposure.visibility === 'PUBLIC' ||
      snapshot.exposure.visibility === 'CROSS_CHANNEL' ||
      snapshot.vector.bluffExposure >= 45,
    isLegendary: snapshot.vector.legend >= 70 || snapshot.band === 'LEGENDARY',
    isDealRisky: snapshot.vector.dealCredibility <= 35 || snapshot.vector.bluffExposure >= 40,
  };
}

export const CHAT_REPUTATION_LAW = Object.freeze({
  version: CHAT_REPUTATION_VERSION,
  defaults: {
    vector: CHAT_REPUTATION_VECTOR_ZERO,
    budget: CHAT_REPUTATION_BUDGET_DEFAULT,
    decay: CHAT_REPUTATION_DECAY_DEFAULT,
    exposure: CHAT_REPUTATION_EXPOSURE_PRIVATE,
  },
});

export interface ChatReputationWitnessVerdict {
  readonly witnessId: string;
  readonly subjectId: ChatReputationSubjectId;
  readonly channelId?: ChatReputationChannelId;
  readonly verdictAt: string;
  readonly trustShift: number;
  readonly fearShift: number;
  readonly contemptShift: number;
  readonly aweShift: number;
  readonly shameShift: number;
  readonly proofAware: boolean;
  readonly hidden: boolean;
  readonly note?: string;
}

export interface ChatReputationPropagationWindow {
  readonly windowId: string;
  readonly subjectId: ChatReputationSubjectId;
  readonly openedAt: string;
  readonly closesAt?: string;
  readonly sourceChannelId?: ChatReputationChannelId;
  readonly targetChannelIds: readonly ChatReputationChannelId[];
  readonly reason: string;
  readonly strength: number;
  readonly proofWeighted: boolean;
}

export interface ChatReputationRankBreakdown {
  readonly subjectId: ChatReputationSubjectId;
  readonly totalScore: number;
  readonly trustContribution: number;
  readonly respectContribution: number;
  readonly fearContribution: number;
  readonly contemptPenalty: number;
  readonly shamePenalty: number;
  readonly aweContribution: number;
  readonly legendContribution: number;
  readonly bluffPenalty: number;
  readonly reliabilityContribution: number;
  readonly dealContribution: number;
}

export interface ChatReputationRecoveryPolicy {
  readonly allowsRepair: boolean;
  readonly repairFloor: number;
  readonly repairCeiling: number;
  readonly requiresProof: boolean;
  readonly requiresWitnesses: boolean;
  readonly shameSuppression: number;
  readonly contemptSuppression: number;
  readonly legendCarryover: number;
}

export interface ChatReputationChannelLaw {
  readonly channelId: ChatReputationChannelId;
  readonly trustSensitivity: number;
  readonly fearSensitivity: number;
  readonly shameSensitivity: number;
  readonly bluffSensitivity: number;
  readonly aweSensitivity: number;
  readonly crossChannelBleed: number;
  readonly privacyProtection: number;
  readonly proofMultiplier: number;
}

export const CHAT_REPUTATION_CHANNEL_LAW_DEFAULT: ChatReputationChannelLaw = Object.freeze({
  channelId: 'GLOBAL',
  trustSensitivity: 1,
  fearSensitivity: 1,
  shameSensitivity: 1,
  bluffSensitivity: 1,
  aweSensitivity: 1,
  crossChannelBleed: 1,
  privacyProtection: 0,
  proofMultiplier: 1,
});

export const CHAT_REPUTATION_RECOVERY_POLICY_DEFAULT: ChatReputationRecoveryPolicy = Object.freeze({
  allowsRepair: true,
  repairFloor: -50,
  repairCeiling: 65,
  requiresProof: false,
  requiresWitnesses: false,
  shameSuppression: 0,
  contemptSuppression: 0,
  legendCarryover: 0.25,
});

export function createReputationRankBreakdown(
  snapshot: ChatReputationSnapshot,
): ChatReputationRankBreakdown {
  return {
    subjectId: snapshot.subjectId,
    totalScore: snapshot.score,
    trustContribution: snapshot.vector.trust * 0.14,
    respectContribution: snapshot.vector.respect * 0.16,
    fearContribution: snapshot.vector.fear * 0.12,
    contemptPenalty: snapshot.vector.contempt * 0.12,
    shamePenalty: snapshot.vector.shame * 0.14,
    aweContribution: snapshot.vector.awe * 0.1,
    legendContribution: snapshot.vector.legend * 0.12,
    bluffPenalty: snapshot.vector.bluffExposure * 0.1,
    reliabilityContribution: snapshot.vector.reliability * 0.16,
    dealContribution: snapshot.vector.dealCredibility * 0.08,
  };
}

export function createReputationPropagationWindow(input: {
  windowId: string;
  subjectId: ChatReputationSubjectId;
  openedAt: string;
  sourceChannelId?: ChatReputationChannelId;
  targetChannelIds: readonly ChatReputationChannelId[];
  reason: string;
  strength: number;
  proofWeighted?: boolean;
  closesAt?: string;
}): ChatReputationPropagationWindow {
  return {
    windowId: input.windowId,
    subjectId: input.subjectId,
    openedAt: input.openedAt,
    closesAt: input.closesAt,
    sourceChannelId: input.sourceChannelId,
    targetChannelIds: input.targetChannelIds,
    reason: input.reason,
    strength: clampReputationUnit(input.strength),
    proofWeighted: input.proofWeighted ?? false,
  };
}

export function applyReputationRecoveryPolicy(
  snapshot: ChatReputationSnapshot,
  policy: ChatReputationRecoveryPolicy = CHAT_REPUTATION_RECOVERY_POLICY_DEFAULT,
): ChatReputationSnapshot {
  if (!policy.allowsRepair) return snapshot;

  const nextScore = Math.min(
    policy.repairCeiling,
    Math.max(policy.repairFloor, snapshot.score + snapshot.vector.reliability * 0.05),
  );

  const nextVector = normalizeReputationVector({
    ...snapshot.vector,
    shame: snapshot.vector.shame - policy.shameSuppression,
    contempt: snapshot.vector.contempt - policy.contemptSuppression,
    legend: snapshot.vector.legend * (1 - policy.legendCarryover) + snapshot.vector.legend,
  });

  return createReputationSnapshot({
    ...snapshot,
    score: nextScore,
    vector: nextVector,
    updatedAt: snapshot.updatedAt,
  });
}

export function createReputationWitnessVerdict(input: {
  witnessId: string;
  subjectId: ChatReputationSubjectId;
  verdictAt: string;
  trustShift?: number;
  fearShift?: number;
  contemptShift?: number;
  aweShift?: number;
  shameShift?: number;
  proofAware?: boolean;
  hidden?: boolean;
  note?: string;
  channelId?: ChatReputationChannelId;
}): ChatReputationWitnessVerdict {
  return {
    witnessId: input.witnessId,
    subjectId: input.subjectId,
    channelId: input.channelId,
    verdictAt: input.verdictAt,
    trustShift: clampReputationSignedDelta(input.trustShift ?? 0),
    fearShift: clampReputationSignedDelta(input.fearShift ?? 0),
    contemptShift: clampReputationSignedDelta(input.contemptShift ?? 0),
    aweShift: clampReputationSignedDelta(input.aweShift ?? 0),
    shameShift: clampReputationSignedDelta(input.shameShift ?? 0),
    proofAware: input.proofAware ?? false,
    hidden: input.hidden ?? false,
    note: input.note,
  };
}

export function clampReputationSignedDelta(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= -100) return -100;
  if (value >= 100) return 100;
  return value;
}

export function applyReputationWitnessVerdict(
  snapshot: ChatReputationSnapshot,
  verdict: ChatReputationWitnessVerdict,
): ChatReputationSnapshot {
  return createReputationSnapshot({
    ...snapshot,
    updatedAt: verdict.verdictAt,
    score: clampReputationScore(
      snapshot.score +
        verdict.trustShift * 0.2 +
        verdict.aweShift * 0.15 -
        verdict.contemptShift * 0.2 -
        verdict.shameShift * 0.15,
    ),
    vector: normalizeReputationVector({
      trust: snapshot.vector.trust + verdict.trustShift,
      respect: snapshot.vector.respect + Math.max(0, verdict.aweShift * 0.4),
      fear: snapshot.vector.fear + verdict.fearShift,
      contempt: snapshot.vector.contempt + verdict.contemptShift,
      fascination: snapshot.vector.fascination + Math.max(0, verdict.aweShift * 0.25),
      notoriety: snapshot.vector.notoriety + Math.max(0, verdict.fearShift * 0.2),
      shame: snapshot.vector.shame + verdict.shameShift,
      awe: snapshot.vector.awe + verdict.aweShift,
      threat: snapshot.vector.threat + Math.max(0, verdict.fearShift * 0.35),
      bluffExposure: snapshot.vector.bluffExposure,
      reliability: snapshot.vector.reliability + Math.max(0, verdict.trustShift * 0.25),
      legend: snapshot.vector.legend + Math.max(0, verdict.aweShift * 0.2),
      rescueDebt: snapshot.vector.rescueDebt,
      dealCredibility: snapshot.vector.dealCredibility,
    }),
    exposure: {
      ...snapshot.exposure,
      lastWitnessedAt: verdict.verdictAt,
      visibility: verdict.hidden ? snapshot.exposure.visibility : snapshot.exposure.visibility,
    },
  });
}

export function createChannelReputationSnapshot(
  snapshot: ChatReputationSnapshot,
  channelId: ChatReputationChannelId,
  law: ChatReputationChannelLaw = CHAT_REPUTATION_CHANNEL_LAW_DEFAULT,
): ChatChannelReputationSnapshot {
  const vector = normalizeReputationVector({
    trust: snapshot.vector.trust * law.trustSensitivity,
    respect: snapshot.vector.respect,
    fear: snapshot.vector.fear * law.fearSensitivity,
    contempt: snapshot.vector.contempt,
    fascination: snapshot.vector.fascination,
    notoriety: snapshot.vector.notoriety * law.crossChannelBleed,
    shame: snapshot.vector.shame * law.shameSensitivity,
    awe: snapshot.vector.awe * law.aweSensitivity,
    threat: snapshot.vector.threat,
    bluffExposure: snapshot.vector.bluffExposure * law.bluffSensitivity,
    reliability: snapshot.vector.reliability,
    legend: snapshot.vector.legend,
    rescueDebt: snapshot.vector.rescueDebt,
    dealCredibility: snapshot.vector.dealCredibility,
  });

  const score = clampReputationScore(
    snapshot.score +
      vector.trust * 0.05 +
      vector.respect * 0.05 +
      vector.awe * 0.03 -
      vector.shame * 0.05 -
      vector.bluffExposure * 0.05,
  );

  const exposure: ChatReputationExposure = {
    ...snapshot.exposure,
    visibility:
      law.privacyProtection >= 1 && snapshot.exposure.visibility === 'PUBLIC'
        ? 'CHANNEL'
        : snapshot.exposure.visibility,
  };

  return {
    channelId,
    subjectId: snapshot.subjectId,
    score,
    vector,
    exposure,
    band: determineReputationBand({ score, vector }),
    integrity: determineReputationIntegrity({ vector, score, exposure }),
    updatedAt: snapshot.updatedAt,
  };
}

export interface ChatReputationTimelineEntry {
  readonly entryId: string;
  readonly subjectId: ChatReputationSubjectId;
  readonly recordedAt: string;
  readonly driver: ChatReputationDriver;
  readonly score: number;
  readonly band: ChatReputationBand;
  readonly integrity: ChatReputationIntegrityBand;
  readonly reason: string;
}

export function createReputationTimelineEntry(
  snapshot: ChatReputationSnapshot,
  reason: string,
): ChatReputationTimelineEntry {
  return {
    entryId: `${snapshot.subjectId}:${snapshot.updatedAt}:${snapshot.driver}`,
    subjectId: snapshot.subjectId,
    recordedAt: snapshot.updatedAt,
    driver: snapshot.driver,
    score: snapshot.score,
    band: snapshot.band,
    integrity: snapshot.integrity,
    reason,
  };
}

export const CHAT_REPUTATION_CHANNEL_LAWS: Readonly<Record<string, ChatReputationChannelLaw>> = Object.freeze({
  GLOBAL: {
    channelId: 'GLOBAL',
    trustSensitivity: 1,
    fearSensitivity: 1.15,
    shameSensitivity: 1.25,
    bluffSensitivity: 1.2,
    aweSensitivity: 1.1,
    crossChannelBleed: 1,
    privacyProtection: 0,
    proofMultiplier: 1.2,
  },
  SYNDICATE: {
    channelId: 'SYNDICATE',
    trustSensitivity: 1.2,
    fearSensitivity: 0.9,
    shameSensitivity: 0.8,
    bluffSensitivity: 1,
    aweSensitivity: 0.95,
    crossChannelBleed: 0.65,
    privacyProtection: 0.4,
    proofMultiplier: 1,
  },
  DEAL_ROOM: {
    channelId: 'DEAL_ROOM',
    trustSensitivity: 0.85,
    fearSensitivity: 0.7,
    shameSensitivity: 1.1,
    bluffSensitivity: 1.4,
    aweSensitivity: 0.8,
    crossChannelBleed: 0.5,
    privacyProtection: 0.75,
    proofMultiplier: 1.3,
  },
  DIRECT: {
    channelId: 'DIRECT',
    trustSensitivity: 1.25,
    fearSensitivity: 0.7,
    shameSensitivity: 0.6,
    bluffSensitivity: 0.8,
    aweSensitivity: 0.75,
    crossChannelBleed: 0.2,
    privacyProtection: 1,
    proofMultiplier: 0.9,
  },
});
