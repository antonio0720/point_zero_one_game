// backend/src/analytics/season0/index.ts

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — ANALYTICS / SEASON 0
 * backend/src/analytics/season0/index.ts
 *
 * Authoritative Season 0 analytics envelopes and async emission helpers.
 *
 * Rules:
 * - these functions do NOT create business truth
 * - they wrap already-authoritative Season 0 domain transitions
 * - all wire-level names come from analytics_names.ts
 * - all transport happens through the shared emitter contract
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import {
  createAnalyticsEnvelope,
  type AnalyticsEnvelope,
  type AnalyticsEnvelopeContext,
  type AnalyticsIdentifier,
} from '../core/analytics_envelope';

import { NoopAnalyticsEmitter } from '../core/analytics_emitters';

import {
  ANALYTICS_EVENT_NAMES,
  type Season0AnalyticsEventName,
} from '../core/analytics_names';

import {
  normalizeIdentifier,
  normalizeNonEmptyString,
  normalizeNonNegativeInteger,
  normalizeOptionalIdentifier,
  normalizeOptionalNonNegativeInteger,
  normalizeOptionalProofHash,
  normalizeOptionalString,
} from '../core/analytics_validation';

import type {
  AnalyticsEmitContext,
  AnalyticsEmitReceipt,
  AnalyticsEmitter,
} from '../core/analytics_types';

// ─────────────────────────────────────────────────────────────────────────────
// Shared context
// ─────────────────────────────────────────────────────────────────────────────

export interface Season0EventContext extends AnalyticsEnvelopeContext {
  seasonId?: 'SEASON_0' | string;
}

function withSeason0Defaults(
  context: Season0EventContext = {},
): Season0EventContext {
  return {
    source: 'backend',
    seasonId: 'SEASON_0',
    ...context,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Payloads
// ─────────────────────────────────────────────────────────────────────────────

export interface Season0JoinedPayload {
  entryPoint?: string;
  cohort?: string;
}

export interface FounderTierAssignedPayload {
  founderTier: string;
  previousFounderTier?: string;
}

export interface ArtifactGrantedPayload {
  artifactId: AnalyticsIdentifier;
  artifactType?: string;
  grantReason?: string;
}

export interface MembershipSharedPayload {
  recipientPlayerId?: AnalyticsIdentifier;
  channel?: string;
  shareCode?: string;
}

export interface MembershipCardViewedPayload {
  cardVariant?: string;
  surface?: string;
}

export interface ProofCardMintedPayload {
  proofId: AnalyticsIdentifier;
  proofHash?: string;
  cardTemplate?: string;
}

export interface ProofStampedPayload {
  proofId: AnalyticsIdentifier;
  stampType?: string;
}

export interface InviteSentPayload {
  recipientPlayerId?: AnalyticsIdentifier;
  inviteCode?: string;
  channel?: string;
}

export interface InviteAcceptedPayload {
  inviterPlayerId?: AnalyticsIdentifier;
  inviteCode?: string;
}

export interface ReferralCompletedPayload {
  referredPlayerId?: AnalyticsIdentifier;
  referralCode?: string;
}

export interface ReferralRewardUnlockedPayload {
  rewardId: string;
  rewardType?: string;
  milestone?: number;
}

export interface StreakUpdatedPayload {
  newStreakLength: number;
  previousStreakLength?: number;
}

export interface StreakGraceAppliedPayload {
  restoredStreakLength: number;
  previousStreakLength?: number;
  graceSource?: string;
}

export interface ArtifactReceiptIssuedPayload {
  receiptId: string;
  artifactId: AnalyticsIdentifier;
  quantity?: number;
}

export interface FounderSealEvolvedPayload {
  newSealLevel: number;
  previousSealLevel?: number;
}

export type Season0PayloadMap = {
  [ANALYTICS_EVENT_NAMES.SEASON0.JOINED]: Season0JoinedPayload;
  [ANALYTICS_EVENT_NAMES.SEASON0.FOUNDER_TIER_ASSIGNED]: FounderTierAssignedPayload;
  [ANALYTICS_EVENT_NAMES.SEASON0.ARTIFACT_GRANTED]: ArtifactGrantedPayload;
  [ANALYTICS_EVENT_NAMES.SEASON0.MEMBERSHIP_SHARED]: MembershipSharedPayload;
  [ANALYTICS_EVENT_NAMES.SEASON0.MEMBERSHIP_CARD_VIEWED]: MembershipCardViewedPayload;
  [ANALYTICS_EVENT_NAMES.SEASON0.PROOF_CARD_MINTED]: ProofCardMintedPayload;
  [ANALYTICS_EVENT_NAMES.SEASON0.PROOF_STAMPED]: ProofStampedPayload;
  [ANALYTICS_EVENT_NAMES.SEASON0.INVITE_SENT]: InviteSentPayload;
  [ANALYTICS_EVENT_NAMES.SEASON0.INVITE_ACCEPTED]: InviteAcceptedPayload;
  [ANALYTICS_EVENT_NAMES.SEASON0.REFERRAL_COMPLETED]: ReferralCompletedPayload;
  [ANALYTICS_EVENT_NAMES.SEASON0.REFERRAL_REWARD_UNLOCKED]: ReferralRewardUnlockedPayload;
  [ANALYTICS_EVENT_NAMES.SEASON0.STREAK_UPDATED]: StreakUpdatedPayload;
  [ANALYTICS_EVENT_NAMES.SEASON0.STREAK_GRACE_APPLIED]: StreakGraceAppliedPayload;
  [ANALYTICS_EVENT_NAMES.SEASON0.ARTIFACT_RECEIPT_ISSUED]: ArtifactReceiptIssuedPayload;
  [ANALYTICS_EVENT_NAMES.SEASON0.FOUNDER_SEAL_EVOLVED]: FounderSealEvolvedPayload;
};

export type Season0Envelope<
  TEventName extends Season0AnalyticsEventName = Season0AnalyticsEventName,
> = AnalyticsEnvelope<TEventName, Season0PayloadMap[TEventName]>;

// ─────────────────────────────────────────────────────────────────────────────
// Normalizers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeOptionalChannel(value?: string): string | undefined {
  return normalizeOptionalString(value);
}

function normalizeSeason0JoinedPayload(
  input: Season0JoinedPayload = {},
): Season0JoinedPayload {
  return {
    entryPoint: normalizeOptionalString(input.entryPoint),
    cohort: normalizeOptionalString(input.cohort),
  };
}

function normalizeFounderTierAssignedPayload(
  input: FounderTierAssignedPayload,
): FounderTierAssignedPayload {
  return {
    founderTier: normalizeNonEmptyString(input.founderTier, 'founderTier'),
    previousFounderTier: normalizeOptionalString(input.previousFounderTier),
  };
}

function normalizeArtifactGrantedPayload(
  input: ArtifactGrantedPayload,
): ArtifactGrantedPayload {
  return {
    artifactId: normalizeIdentifier(input.artifactId, 'artifactId'),
    artifactType: normalizeOptionalString(input.artifactType),
    grantReason: normalizeOptionalString(input.grantReason),
  };
}

function normalizeMembershipSharedPayload(
  input: MembershipSharedPayload = {},
): MembershipSharedPayload {
  return {
    recipientPlayerId: normalizeOptionalIdentifier(
      input.recipientPlayerId,
      'recipientPlayerId',
    ),
    channel: normalizeOptionalChannel(input.channel),
    shareCode: normalizeOptionalString(input.shareCode),
  };
}

function normalizeMembershipCardViewedPayload(
  input: MembershipCardViewedPayload = {},
): MembershipCardViewedPayload {
  return {
    cardVariant: normalizeOptionalString(input.cardVariant),
    surface: normalizeOptionalString(input.surface),
  };
}

function normalizeProofCardMintedPayload(
  input: ProofCardMintedPayload,
): ProofCardMintedPayload {
  return {
    proofId: normalizeIdentifier(input.proofId, 'proofId'),
    proofHash: normalizeOptionalProofHash(input.proofHash),
    cardTemplate: normalizeOptionalString(input.cardTemplate),
  };
}

function normalizeProofStampedPayload(
  input: ProofStampedPayload,
): ProofStampedPayload {
  return {
    proofId: normalizeIdentifier(input.proofId, 'proofId'),
    stampType: normalizeOptionalString(input.stampType),
  };
}

function normalizeInviteSentPayload(
  input: InviteSentPayload = {},
): InviteSentPayload {
  return {
    recipientPlayerId: normalizeOptionalIdentifier(
      input.recipientPlayerId,
      'recipientPlayerId',
    ),
    inviteCode: normalizeOptionalString(input.inviteCode),
    channel: normalizeOptionalChannel(input.channel),
  };
}

function normalizeInviteAcceptedPayload(
  input: InviteAcceptedPayload = {},
): InviteAcceptedPayload {
  return {
    inviterPlayerId: normalizeOptionalIdentifier(
      input.inviterPlayerId,
      'inviterPlayerId',
    ),
    inviteCode: normalizeOptionalString(input.inviteCode),
  };
}

function normalizeReferralCompletedPayload(
  input: ReferralCompletedPayload = {},
): ReferralCompletedPayload {
  return {
    referredPlayerId: normalizeOptionalIdentifier(
      input.referredPlayerId,
      'referredPlayerId',
    ),
    referralCode: normalizeOptionalString(input.referralCode),
  };
}

function normalizeReferralRewardUnlockedPayload(
  input: ReferralRewardUnlockedPayload,
): ReferralRewardUnlockedPayload {
  return {
    rewardId: normalizeNonEmptyString(input.rewardId, 'rewardId'),
    rewardType: normalizeOptionalString(input.rewardType),
    milestone: normalizeOptionalNonNegativeInteger(input.milestone, 'milestone'),
  };
}

function normalizeStreakUpdatedPayload(
  input: StreakUpdatedPayload,
): StreakUpdatedPayload {
  return {
    newStreakLength: normalizeNonNegativeInteger(
      input.newStreakLength,
      'newStreakLength',
    ),
    previousStreakLength: normalizeOptionalNonNegativeInteger(
      input.previousStreakLength,
      'previousStreakLength',
    ),
  };
}

function normalizeStreakGraceAppliedPayload(
  input: StreakGraceAppliedPayload,
): StreakGraceAppliedPayload {
  return {
    restoredStreakLength: normalizeNonNegativeInteger(
      input.restoredStreakLength,
      'restoredStreakLength',
    ),
    previousStreakLength: normalizeOptionalNonNegativeInteger(
      input.previousStreakLength,
      'previousStreakLength',
    ),
    graceSource: normalizeOptionalString(input.graceSource),
  };
}

function normalizeArtifactReceiptIssuedPayload(
  input: ArtifactReceiptIssuedPayload,
): ArtifactReceiptIssuedPayload {
  return {
    receiptId: normalizeNonEmptyString(input.receiptId, 'receiptId'),
    artifactId: normalizeIdentifier(input.artifactId, 'artifactId'),
    quantity: normalizeOptionalNonNegativeInteger(input.quantity, 'quantity'),
  };
}

function normalizeFounderSealEvolvedPayload(
  input: FounderSealEvolvedPayload,
): FounderSealEvolvedPayload {
  return {
    newSealLevel: normalizeNonNegativeInteger(
      input.newSealLevel,
      'newSealLevel',
    ),
    previousSealLevel: normalizeOptionalNonNegativeInteger(
      input.previousSealLevel,
      'previousSealLevel',
    ),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Envelope factories
// ─────────────────────────────────────────────────────────────────────────────

export function createSeason0JoinedEvent(
  payload: Season0JoinedPayload = {},
  context: Season0EventContext = {},
): Season0Envelope<typeof ANALYTICS_EVENT_NAMES.SEASON0.JOINED> {
  return createAnalyticsEnvelope({
    ...withSeason0Defaults(context),
    eventName: ANALYTICS_EVENT_NAMES.SEASON0.JOINED,
    payload: normalizeSeason0JoinedPayload(payload),
  });
}

export function createFounderTierAssignedEvent(
  payload: FounderTierAssignedPayload,
  context: Season0EventContext = {},
): Season0Envelope<typeof ANALYTICS_EVENT_NAMES.SEASON0.FOUNDER_TIER_ASSIGNED> {
  return createAnalyticsEnvelope({
    ...withSeason0Defaults(context),
    eventName: ANALYTICS_EVENT_NAMES.SEASON0.FOUNDER_TIER_ASSIGNED,
    payload: normalizeFounderTierAssignedPayload(payload),
  });
}

export function createArtifactGrantedEvent(
  payload: ArtifactGrantedPayload,
  context: Season0EventContext = {},
): Season0Envelope<typeof ANALYTICS_EVENT_NAMES.SEASON0.ARTIFACT_GRANTED> {
  return createAnalyticsEnvelope({
    ...withSeason0Defaults(context),
    eventName: ANALYTICS_EVENT_NAMES.SEASON0.ARTIFACT_GRANTED,
    payload: normalizeArtifactGrantedPayload(payload),
  });
}

export function createMembershipSharedEvent(
  payload: MembershipSharedPayload = {},
  context: Season0EventContext = {},
): Season0Envelope<typeof ANALYTICS_EVENT_NAMES.SEASON0.MEMBERSHIP_SHARED> {
  return createAnalyticsEnvelope({
    ...withSeason0Defaults(context),
    eventName: ANALYTICS_EVENT_NAMES.SEASON0.MEMBERSHIP_SHARED,
    payload: normalizeMembershipSharedPayload(payload),
  });
}

export function createMembershipCardViewedEvent(
  payload: MembershipCardViewedPayload = {},
  context: Season0EventContext = {},
): Season0Envelope<typeof ANALYTICS_EVENT_NAMES.SEASON0.MEMBERSHIP_CARD_VIEWED> {
  return createAnalyticsEnvelope({
    ...withSeason0Defaults(context),
    eventName: ANALYTICS_EVENT_NAMES.SEASON0.MEMBERSHIP_CARD_VIEWED,
    payload: normalizeMembershipCardViewedPayload(payload),
  });
}

export function createProofCardMintedEvent(
  payload: ProofCardMintedPayload,
  context: Season0EventContext = {},
): Season0Envelope<typeof ANALYTICS_EVENT_NAMES.SEASON0.PROOF_CARD_MINTED> {
  return createAnalyticsEnvelope({
    ...withSeason0Defaults(context),
    eventName: ANALYTICS_EVENT_NAMES.SEASON0.PROOF_CARD_MINTED,
    payload: normalizeProofCardMintedPayload(payload),
  });
}

export function createProofStampedEvent(
  payload: ProofStampedPayload,
  context: Season0EventContext = {},
): Season0Envelope<typeof ANALYTICS_EVENT_NAMES.SEASON0.PROOF_STAMPED> {
  return createAnalyticsEnvelope({
    ...withSeason0Defaults(context),
    eventName: ANALYTICS_EVENT_NAMES.SEASON0.PROOF_STAMPED,
    payload: normalizeProofStampedPayload(payload),
  });
}

export function createInviteSentEvent(
  payload: InviteSentPayload = {},
  context: Season0EventContext = {},
): Season0Envelope<typeof ANALYTICS_EVENT_NAMES.SEASON0.INVITE_SENT> {
  return createAnalyticsEnvelope({
    ...withSeason0Defaults(context),
    eventName: ANALYTICS_EVENT_NAMES.SEASON0.INVITE_SENT,
    payload: normalizeInviteSentPayload(payload),
  });
}

export function createInviteAcceptedEvent(
  payload: InviteAcceptedPayload = {},
  context: Season0EventContext = {},
): Season0Envelope<typeof ANALYTICS_EVENT_NAMES.SEASON0.INVITE_ACCEPTED> {
  return createAnalyticsEnvelope({
    ...withSeason0Defaults(context),
    eventName: ANALYTICS_EVENT_NAMES.SEASON0.INVITE_ACCEPTED,
    payload: normalizeInviteAcceptedPayload(payload),
  });
}

export function createReferralCompletedEvent(
  payload: ReferralCompletedPayload = {},
  context: Season0EventContext = {},
): Season0Envelope<typeof ANALYTICS_EVENT_NAMES.SEASON0.REFERRAL_COMPLETED> {
  return createAnalyticsEnvelope({
    ...withSeason0Defaults(context),
    eventName: ANALYTICS_EVENT_NAMES.SEASON0.REFERRAL_COMPLETED,
    payload: normalizeReferralCompletedPayload(payload),
  });
}

export function createReferralRewardUnlockedEvent(
  payload: ReferralRewardUnlockedPayload,
  context: Season0EventContext = {},
): Season0Envelope<
  typeof ANALYTICS_EVENT_NAMES.SEASON0.REFERRAL_REWARD_UNLOCKED
> {
  return createAnalyticsEnvelope({
    ...withSeason0Defaults(context),
    eventName: ANALYTICS_EVENT_NAMES.SEASON0.REFERRAL_REWARD_UNLOCKED,
    payload: normalizeReferralRewardUnlockedPayload(payload),
  });
}

export function createStreakUpdatedEvent(
  payload: StreakUpdatedPayload,
  context: Season0EventContext = {},
): Season0Envelope<typeof ANALYTICS_EVENT_NAMES.SEASON0.STREAK_UPDATED> {
  return createAnalyticsEnvelope({
    ...withSeason0Defaults(context),
    eventName: ANALYTICS_EVENT_NAMES.SEASON0.STREAK_UPDATED,
    payload: normalizeStreakUpdatedPayload(payload),
  });
}

export function createStreakGraceAppliedEvent(
  payload: StreakGraceAppliedPayload,
  context: Season0EventContext = {},
): Season0Envelope<typeof ANALYTICS_EVENT_NAMES.SEASON0.STREAK_GRACE_APPLIED> {
  return createAnalyticsEnvelope({
    ...withSeason0Defaults(context),
    eventName: ANALYTICS_EVENT_NAMES.SEASON0.STREAK_GRACE_APPLIED,
    payload: normalizeStreakGraceAppliedPayload(payload),
  });
}

export function createArtifactReceiptIssuedEvent(
  payload: ArtifactReceiptIssuedPayload,
  context: Season0EventContext = {},
): Season0Envelope<
  typeof ANALYTICS_EVENT_NAMES.SEASON0.ARTIFACT_RECEIPT_ISSUED
> {
  return createAnalyticsEnvelope({
    ...withSeason0Defaults(context),
    eventName: ANALYTICS_EVENT_NAMES.SEASON0.ARTIFACT_RECEIPT_ISSUED,
    payload: normalizeArtifactReceiptIssuedPayload(payload),
  });
}

export function createFounderSealEvolvedEvent(
  payload: FounderSealEvolvedPayload,
  context: Season0EventContext = {},
): Season0Envelope<typeof ANALYTICS_EVENT_NAMES.SEASON0.FOUNDER_SEAL_EVOLVED> {
  return createAnalyticsEnvelope({
    ...withSeason0Defaults(context),
    eventName: ANALYTICS_EVENT_NAMES.SEASON0.FOUNDER_SEAL_EVOLVED,
    payload: normalizeFounderSealEvolvedPayload(payload),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export class Season0AnalyticsService {
  constructor(
    private readonly emitter: AnalyticsEmitter = new NoopAnalyticsEmitter(),
    private readonly defaultContext: Season0EventContext = {},
  ) {}

  async emit<TEventName extends Season0AnalyticsEventName>(
    envelope: Season0Envelope<TEventName>,
    context: AnalyticsEmitContext = {},
  ): Promise<AnalyticsEmitReceipt> {
    return this.emitter.emit(envelope as unknown as any, context);
  }

  buildSeason0Joined(
    payload: Season0JoinedPayload = {},
    context: Season0EventContext = {},
  ): ReturnType<typeof createSeason0JoinedEvent> {
    return createSeason0JoinedEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }

  buildFounderTierAssigned(
    payload: FounderTierAssignedPayload,
    context: Season0EventContext = {},
  ): ReturnType<typeof createFounderTierAssignedEvent> {
    return createFounderTierAssignedEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }

  buildArtifactGranted(
    payload: ArtifactGrantedPayload,
    context: Season0EventContext = {},
  ): ReturnType<typeof createArtifactGrantedEvent> {
    return createArtifactGrantedEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }

  buildMembershipShared(
    payload: MembershipSharedPayload = {},
    context: Season0EventContext = {},
  ): ReturnType<typeof createMembershipSharedEvent> {
    return createMembershipSharedEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }

  buildMembershipCardViewed(
    payload: MembershipCardViewedPayload = {},
    context: Season0EventContext = {},
  ): ReturnType<typeof createMembershipCardViewedEvent> {
    return createMembershipCardViewedEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }

  buildProofCardMinted(
    payload: ProofCardMintedPayload,
    context: Season0EventContext = {},
  ): ReturnType<typeof createProofCardMintedEvent> {
    return createProofCardMintedEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }

  buildProofStamped(
    payload: ProofStampedPayload,
    context: Season0EventContext = {},
  ): ReturnType<typeof createProofStampedEvent> {
    return createProofStampedEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }

  buildInviteSent(
    payload: InviteSentPayload = {},
    context: Season0EventContext = {},
  ): ReturnType<typeof createInviteSentEvent> {
    return createInviteSentEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }

  buildInviteAccepted(
    payload: InviteAcceptedPayload = {},
    context: Season0EventContext = {},
  ): ReturnType<typeof createInviteAcceptedEvent> {
    return createInviteAcceptedEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }

  buildReferralCompleted(
    payload: ReferralCompletedPayload = {},
    context: Season0EventContext = {},
  ): ReturnType<typeof createReferralCompletedEvent> {
    return createReferralCompletedEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }

  buildReferralRewardUnlocked(
    payload: ReferralRewardUnlockedPayload,
    context: Season0EventContext = {},
  ): ReturnType<typeof createReferralRewardUnlockedEvent> {
    return createReferralRewardUnlockedEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }

  buildStreakUpdated(
    payload: StreakUpdatedPayload,
    context: Season0EventContext = {},
  ): ReturnType<typeof createStreakUpdatedEvent> {
    return createStreakUpdatedEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }

  buildStreakGraceApplied(
    payload: StreakGraceAppliedPayload,
    context: Season0EventContext = {},
  ): ReturnType<typeof createStreakGraceAppliedEvent> {
    return createStreakGraceAppliedEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }

  buildArtifactReceiptIssued(
    payload: ArtifactReceiptIssuedPayload,
    context: Season0EventContext = {},
  ): ReturnType<typeof createArtifactReceiptIssuedEvent> {
    return createArtifactReceiptIssuedEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }

  buildFounderSealEvolved(
    payload: FounderSealEvolvedPayload,
    context: Season0EventContext = {},
  ): ReturnType<typeof createFounderSealEvolvedEvent> {
    return createFounderSealEvolvedEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }
}

export function createSeason0AnalyticsService(
  emitter: AnalyticsEmitter = new NoopAnalyticsEmitter(),
  defaultContext: Season0EventContext = {},
): Season0AnalyticsService {
  return new Season0AnalyticsService(emitter, defaultContext);
}