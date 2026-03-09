// backend/src/analytics/mappers/season0_domain_mapper.ts

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — ANALYTICS / SEASON 0 DOMAIN MAPPER
 * backend/src/analytics/mappers/season0_domain_mapper.ts
 *
 * Bridges authoritative Season 0 domain transitions into analytics envelopes.
 *
 * Important:
 * - domain services remain the source of truth
 * - this mapper is a downstream projection layer only
 * - transport is delegated to the shared analytics emitter contract
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import type { AnalyticsIdentifier } from '../core/analytics_envelope';
import type {
  AnalyticsEmitContext,
  AnalyticsEmitReceipt,
} from '../core/analytics_types';

import {
  createSeason0AnalyticsService,
  createArtifactGrantedEvent,
  createArtifactReceiptIssuedEvent,
  createFounderSealEvolvedEvent,
  createFounderTierAssignedEvent,
  createInviteAcceptedEvent,
  createInviteSentEvent,
  createMembershipCardViewedEvent,
  createMembershipSharedEvent,
  createProofCardMintedEvent,
  createProofStampedEvent,
  createReferralCompletedEvent,
  createReferralRewardUnlockedEvent,
  createSeason0JoinedEvent,
  createStreakGraceAppliedEvent,
  createStreakUpdatedEvent,
  type ArtifactGrantedPayload,
  type ArtifactReceiptIssuedPayload,
  type FounderSealEvolvedPayload,
  type FounderTierAssignedPayload,
  type InviteAcceptedPayload,
  type InviteSentPayload,
  type MembershipCardViewedPayload,
  type MembershipSharedPayload,
  type ProofCardMintedPayload,
  type ProofStampedPayload,
  type ReferralCompletedPayload,
  type ReferralRewardUnlockedPayload,
  type Season0AnalyticsService,
  type Season0Envelope,
  type Season0EventContext,
  type Season0JoinedPayload,
  type StreakGraceAppliedPayload,
  type StreakUpdatedPayload,
} from '../season0';

export const SEASON0_DOMAIN_EVENT_TYPES = {
  JOINED: 'SEASON0_JOINED',
  FOUNDER_TIER_ASSIGNED: 'FOUNDER_TIER_ASSIGNED',
  ARTIFACT_GRANTED: 'ARTIFACT_GRANTED',
  MEMBERSHIP_SHARED: 'MEMBERSHIP_SHARED',
  MEMBERSHIP_CARD_VIEWED: 'MEMBERSHIP_CARD_VIEWED',
  PROOF_CARD_MINTED: 'PROOF_CARD_MINTED',
  PROOF_STAMPED: 'PROOF_STAMPED',
  INVITE_SENT: 'INVITE_SENT',
  INVITE_ACCEPTED: 'INVITE_ACCEPTED',
  REFERRAL_COMPLETED: 'REFERRAL_COMPLETED',
  REFERRAL_REWARD_UNLOCKED: 'REFERRAL_REWARD_UNLOCKED',
  STREAK_UPDATED: 'STREAK_UPDATED',
  STREAK_GRACE_APPLIED: 'STREAK_GRACE_APPLIED',
  ARTIFACT_RECEIPT_ISSUED: 'ARTIFACT_RECEIPT_ISSUED',
  FOUNDER_SEAL_EVOLVED: 'FOUNDER_SEAL_EVOLVED',
} as const;

export type Season0DomainEventType =
  (typeof SEASON0_DOMAIN_EVENT_TYPES)[keyof typeof SEASON0_DOMAIN_EVENT_TYPES];

export interface BaseSeason0DomainEvent<
  TType extends Season0DomainEventType,
  TPayload,
> {
  type: TType;
  payload: TPayload;
  context?: Season0EventContext;
}

export interface Season0JoinedDomainEvent
  extends BaseSeason0DomainEvent<
    typeof SEASON0_DOMAIN_EVENT_TYPES.JOINED,
    Season0JoinedPayload
  > {}

export interface FounderTierAssignedDomainEvent
  extends BaseSeason0DomainEvent<
    typeof SEASON0_DOMAIN_EVENT_TYPES.FOUNDER_TIER_ASSIGNED,
    FounderTierAssignedPayload
  > {}

export interface ArtifactGrantedDomainEvent
  extends BaseSeason0DomainEvent<
    typeof SEASON0_DOMAIN_EVENT_TYPES.ARTIFACT_GRANTED,
    ArtifactGrantedPayload
  > {}

export interface MembershipSharedDomainEvent
  extends BaseSeason0DomainEvent<
    typeof SEASON0_DOMAIN_EVENT_TYPES.MEMBERSHIP_SHARED,
    MembershipSharedPayload
  > {}

export interface MembershipCardViewedDomainEvent
  extends BaseSeason0DomainEvent<
    typeof SEASON0_DOMAIN_EVENT_TYPES.MEMBERSHIP_CARD_VIEWED,
    MembershipCardViewedPayload
  > {}

export interface ProofCardMintedDomainEvent
  extends BaseSeason0DomainEvent<
    typeof SEASON0_DOMAIN_EVENT_TYPES.PROOF_CARD_MINTED,
    ProofCardMintedPayload
  > {}

export interface ProofStampedDomainEvent
  extends BaseSeason0DomainEvent<
    typeof SEASON0_DOMAIN_EVENT_TYPES.PROOF_STAMPED,
    ProofStampedPayload
  > {}

export interface InviteSentDomainEvent
  extends BaseSeason0DomainEvent<
    typeof SEASON0_DOMAIN_EVENT_TYPES.INVITE_SENT,
    InviteSentPayload
  > {}

export interface InviteAcceptedDomainEvent
  extends BaseSeason0DomainEvent<
    typeof SEASON0_DOMAIN_EVENT_TYPES.INVITE_ACCEPTED,
    InviteAcceptedPayload
  > {}

export interface ReferralCompletedDomainEvent
  extends BaseSeason0DomainEvent<
    typeof SEASON0_DOMAIN_EVENT_TYPES.REFERRAL_COMPLETED,
    ReferralCompletedPayload
  > {}

export interface ReferralRewardUnlockedDomainEvent
  extends BaseSeason0DomainEvent<
    typeof SEASON0_DOMAIN_EVENT_TYPES.REFERRAL_REWARD_UNLOCKED,
    ReferralRewardUnlockedPayload
  > {}

export interface StreakUpdatedDomainEvent
  extends BaseSeason0DomainEvent<
    typeof SEASON0_DOMAIN_EVENT_TYPES.STREAK_UPDATED,
    StreakUpdatedPayload
  > {}

export interface StreakGraceAppliedDomainEvent
  extends BaseSeason0DomainEvent<
    typeof SEASON0_DOMAIN_EVENT_TYPES.STREAK_GRACE_APPLIED,
    StreakGraceAppliedPayload
  > {}

export interface ArtifactReceiptIssuedDomainEvent
  extends BaseSeason0DomainEvent<
    typeof SEASON0_DOMAIN_EVENT_TYPES.ARTIFACT_RECEIPT_ISSUED,
    ArtifactReceiptIssuedPayload
  > {}

export interface FounderSealEvolvedDomainEvent
  extends BaseSeason0DomainEvent<
    typeof SEASON0_DOMAIN_EVENT_TYPES.FOUNDER_SEAL_EVOLVED,
    FounderSealEvolvedPayload
  > {}

export type Season0DomainEvent =
  | Season0JoinedDomainEvent
  | FounderTierAssignedDomainEvent
  | ArtifactGrantedDomainEvent
  | MembershipSharedDomainEvent
  | MembershipCardViewedDomainEvent
  | ProofCardMintedDomainEvent
  | ProofStampedDomainEvent
  | InviteSentDomainEvent
  | InviteAcceptedDomainEvent
  | ReferralCompletedDomainEvent
  | ReferralRewardUnlockedDomainEvent
  | StreakUpdatedDomainEvent
  | StreakGraceAppliedDomainEvent
  | ArtifactReceiptIssuedDomainEvent
  | FounderSealEvolvedDomainEvent;

export type Season0EnvelopeAny = Season0Envelope;

export interface Season0DomainMapperOptions {
  analytics?: Season0AnalyticsService;
  defaultContext?: Season0EventContext;
  contextResolver?: (
    event: Season0DomainEvent,
  ) => Partial<Season0EventContext> | undefined;
  emitContextResolver?: (
    event: Season0DomainEvent,
    envelope: Season0EnvelopeAny,
  ) => Partial<AnalyticsEmitContext> | undefined;
}

function mergeSeason0Context(
  base: Season0EventContext | undefined,
  resolved: Partial<Season0EventContext> | undefined,
  event: Season0EventContext | undefined,
  override: Partial<Season0EventContext> | undefined,
): Season0EventContext {
  return {
    ...(base ?? {}),
    ...(resolved ?? {}),
    ...(event ?? {}),
    ...(override ?? {}),
  };
}

function mergeEmitContext(
  resolved: Partial<AnalyticsEmitContext> | undefined,
  override: Partial<AnalyticsEmitContext> | undefined,
): AnalyticsEmitContext {
  return {
    ...(resolved ?? {}),
    ...(override ?? {}),
  };
}

function normalizeAliasKey(value: string): string {
  return value.trim().toUpperCase().replace(/[.\-]/g, '_');
}

const SEASON0_DOMAIN_EVENT_TYPE_ALIAS_MAP: Readonly<Record<string, Season0DomainEventType>> =
  Object.freeze({
    SEASON0_JOINED: SEASON0_DOMAIN_EVENT_TYPES.JOINED,
    SEASON0_JOINED_EVENT: SEASON0_DOMAIN_EVENT_TYPES.JOINED,
    JOINED: SEASON0_DOMAIN_EVENT_TYPES.JOINED,
    SEASON0_JOINED_V1: SEASON0_DOMAIN_EVENT_TYPES.JOINED,
    FOUNDER_TIER_ASSIGNED: SEASON0_DOMAIN_EVENT_TYPES.FOUNDER_TIER_ASSIGNED,
    ARTIFACT_GRANTED: SEASON0_DOMAIN_EVENT_TYPES.ARTIFACT_GRANTED,
    MEMBERSHIP_SHARED: SEASON0_DOMAIN_EVENT_TYPES.MEMBERSHIP_SHARED,
    MEMBERSHIP_CARD_VIEWED: SEASON0_DOMAIN_EVENT_TYPES.MEMBERSHIP_CARD_VIEWED,
    PROOF_CARD_MINTED: SEASON0_DOMAIN_EVENT_TYPES.PROOF_CARD_MINTED,
    PROOF_STAMPED: SEASON0_DOMAIN_EVENT_TYPES.PROOF_STAMPED,
    INVITE_SENT: SEASON0_DOMAIN_EVENT_TYPES.INVITE_SENT,
    INVITE_ACCEPTED: SEASON0_DOMAIN_EVENT_TYPES.INVITE_ACCEPTED,
    REFERRAL_COMPLETED: SEASON0_DOMAIN_EVENT_TYPES.REFERRAL_COMPLETED,
    REFERRAL_REWARD_UNLOCKED:
      SEASON0_DOMAIN_EVENT_TYPES.REFERRAL_REWARD_UNLOCKED,
    STREAK_UPDATED: SEASON0_DOMAIN_EVENT_TYPES.STREAK_UPDATED,
    STREAK_GRACE_APPLIED: SEASON0_DOMAIN_EVENT_TYPES.STREAK_GRACE_APPLIED,
    ARTIFACT_RECEIPT_ISSUED:
      SEASON0_DOMAIN_EVENT_TYPES.ARTIFACT_RECEIPT_ISSUED,
    FOUNDER_SEAL_EVOLVED: SEASON0_DOMAIN_EVENT_TYPES.FOUNDER_SEAL_EVOLVED,
  });

export function normalizeSeason0DomainEventType(
  value: string,
): Season0DomainEventType {
  const normalized = normalizeAliasKey(value);
  const mapped = SEASON0_DOMAIN_EVENT_TYPE_ALIAS_MAP[normalized];

  if (!mapped) {
    throw new Error(`Unsupported Season 0 domain event type: ${value}`);
  }

  return mapped;
}

export function createSeason0JoinedDomainEvent(
  payload: Season0JoinedPayload = {},
  context: Season0EventContext = {},
): Season0JoinedDomainEvent {
  return {
    type: SEASON0_DOMAIN_EVENT_TYPES.JOINED,
    payload,
    context,
  };
}

export function createFounderTierAssignedDomainEvent(
  payload: FounderTierAssignedPayload,
  context: Season0EventContext = {},
): FounderTierAssignedDomainEvent {
  return {
    type: SEASON0_DOMAIN_EVENT_TYPES.FOUNDER_TIER_ASSIGNED,
    payload,
    context,
  };
}

export function createArtifactGrantedDomainEvent(
  payload: ArtifactGrantedPayload,
  context: Season0EventContext = {},
): ArtifactGrantedDomainEvent {
  return {
    type: SEASON0_DOMAIN_EVENT_TYPES.ARTIFACT_GRANTED,
    payload,
    context,
  };
}

export function createMembershipSharedDomainEvent(
  payload: MembershipSharedPayload = {},
  context: Season0EventContext = {},
): MembershipSharedDomainEvent {
  return {
    type: SEASON0_DOMAIN_EVENT_TYPES.MEMBERSHIP_SHARED,
    payload,
    context,
  };
}

export function createMembershipCardViewedDomainEvent(
  payload: MembershipCardViewedPayload = {},
  context: Season0EventContext = {},
): MembershipCardViewedDomainEvent {
  return {
    type: SEASON0_DOMAIN_EVENT_TYPES.MEMBERSHIP_CARD_VIEWED,
    payload,
    context,
  };
}

export function createProofCardMintedDomainEvent(
  payload: ProofCardMintedPayload,
  context: Season0EventContext = {},
): ProofCardMintedDomainEvent {
  return {
    type: SEASON0_DOMAIN_EVENT_TYPES.PROOF_CARD_MINTED,
    payload,
    context,
  };
}

export function createProofStampedDomainEvent(
  payload: ProofStampedPayload,
  context: Season0EventContext = {},
): ProofStampedDomainEvent {
  return {
    type: SEASON0_DOMAIN_EVENT_TYPES.PROOF_STAMPED,
    payload,
    context,
  };
}

export function createInviteSentDomainEvent(
  payload: InviteSentPayload = {},
  context: Season0EventContext = {},
): InviteSentDomainEvent {
  return {
    type: SEASON0_DOMAIN_EVENT_TYPES.INVITE_SENT,
    payload,
    context,
  };
}

export function createInviteAcceptedDomainEvent(
  payload: InviteAcceptedPayload = {},
  context: Season0EventContext = {},
): InviteAcceptedDomainEvent {
  return {
    type: SEASON0_DOMAIN_EVENT_TYPES.INVITE_ACCEPTED,
    payload,
    context,
  };
}

export function createReferralCompletedDomainEvent(
  payload: ReferralCompletedPayload = {},
  context: Season0EventContext = {},
): ReferralCompletedDomainEvent {
  return {
    type: SEASON0_DOMAIN_EVENT_TYPES.REFERRAL_COMPLETED,
    payload,
    context,
  };
}

export function createReferralRewardUnlockedDomainEvent(
  payload: ReferralRewardUnlockedPayload,
  context: Season0EventContext = {},
): ReferralRewardUnlockedDomainEvent {
  return {
    type: SEASON0_DOMAIN_EVENT_TYPES.REFERRAL_REWARD_UNLOCKED,
    payload,
    context,
  };
}

export function createStreakUpdatedDomainEvent(
  payload: StreakUpdatedPayload,
  context: Season0EventContext = {},
): StreakUpdatedDomainEvent {
  return {
    type: SEASON0_DOMAIN_EVENT_TYPES.STREAK_UPDATED,
    payload,
    context,
  };
}

export function createStreakGraceAppliedDomainEvent(
  payload: StreakGraceAppliedPayload,
  context: Season0EventContext = {},
): StreakGraceAppliedDomainEvent {
  return {
    type: SEASON0_DOMAIN_EVENT_TYPES.STREAK_GRACE_APPLIED,
    payload,
    context,
  };
}

export function createArtifactReceiptIssuedDomainEvent(
  payload: ArtifactReceiptIssuedPayload,
  context: Season0EventContext = {},
): ArtifactReceiptIssuedDomainEvent {
  return {
    type: SEASON0_DOMAIN_EVENT_TYPES.ARTIFACT_RECEIPT_ISSUED,
    payload,
    context,
  };
}

export function createFounderSealEvolvedDomainEvent(
  payload: FounderSealEvolvedPayload,
  context: Season0EventContext = {},
): FounderSealEvolvedDomainEvent {
  return {
    type: SEASON0_DOMAIN_EVENT_TYPES.FOUNDER_SEAL_EVOLVED,
    payload,
    context,
  };
}

export function mapSeason0DomainEventToAnalyticsEnvelope(
  event: Season0DomainEvent,
  context: Season0EventContext = {},
): Season0EnvelopeAny {
  const mergedContext = {
    ...event.context,
    ...context,
  };

  switch (event.type) {
    case SEASON0_DOMAIN_EVENT_TYPES.JOINED:
      return createSeason0JoinedEvent(event.payload, mergedContext);

    case SEASON0_DOMAIN_EVENT_TYPES.FOUNDER_TIER_ASSIGNED:
      return createFounderTierAssignedEvent(event.payload, mergedContext);

    case SEASON0_DOMAIN_EVENT_TYPES.ARTIFACT_GRANTED:
      return createArtifactGrantedEvent(event.payload, mergedContext);

    case SEASON0_DOMAIN_EVENT_TYPES.MEMBERSHIP_SHARED:
      return createMembershipSharedEvent(event.payload, mergedContext);

    case SEASON0_DOMAIN_EVENT_TYPES.MEMBERSHIP_CARD_VIEWED:
      return createMembershipCardViewedEvent(event.payload, mergedContext);

    case SEASON0_DOMAIN_EVENT_TYPES.PROOF_CARD_MINTED:
      return createProofCardMintedEvent(event.payload, mergedContext);

    case SEASON0_DOMAIN_EVENT_TYPES.PROOF_STAMPED:
      return createProofStampedEvent(event.payload, mergedContext);

    case SEASON0_DOMAIN_EVENT_TYPES.INVITE_SENT:
      return createInviteSentEvent(event.payload, mergedContext);

    case SEASON0_DOMAIN_EVENT_TYPES.INVITE_ACCEPTED:
      return createInviteAcceptedEvent(event.payload, mergedContext);

    case SEASON0_DOMAIN_EVENT_TYPES.REFERRAL_COMPLETED:
      return createReferralCompletedEvent(event.payload, mergedContext);

    case SEASON0_DOMAIN_EVENT_TYPES.REFERRAL_REWARD_UNLOCKED:
      return createReferralRewardUnlockedEvent(event.payload, mergedContext);

    case SEASON0_DOMAIN_EVENT_TYPES.STREAK_UPDATED:
      return createStreakUpdatedEvent(event.payload, mergedContext);

    case SEASON0_DOMAIN_EVENT_TYPES.STREAK_GRACE_APPLIED:
      return createStreakGraceAppliedEvent(event.payload, mergedContext);

    case SEASON0_DOMAIN_EVENT_TYPES.ARTIFACT_RECEIPT_ISSUED:
      return createArtifactReceiptIssuedEvent(event.payload, mergedContext);

    case SEASON0_DOMAIN_EVENT_TYPES.FOUNDER_SEAL_EVOLVED:
      return createFounderSealEvolvedEvent(event.payload, mergedContext);
  }
}

export class Season0DomainAnalyticsMapper {
  private readonly analytics: Season0AnalyticsService;
  private readonly defaultContext: Season0EventContext;
  private readonly contextResolver?: Season0DomainMapperOptions['contextResolver'];
  private readonly emitContextResolver?: Season0DomainMapperOptions['emitContextResolver'];

  constructor(options: Season0DomainMapperOptions = {}) {
    this.analytics =
      options.analytics ?? createSeason0AnalyticsService(undefined, {});
    this.defaultContext = options.defaultContext ?? {};
    this.contextResolver = options.contextResolver;
    this.emitContextResolver = options.emitContextResolver;
  }

  build(
    event: Season0DomainEvent,
    overrideContext: Partial<Season0EventContext> = {},
  ): Season0EnvelopeAny {
    const resolvedContext = this.contextResolver?.(event);

    return mapSeason0DomainEventToAnalyticsEnvelope(
      event,
      mergeSeason0Context(
        this.defaultContext,
        resolvedContext,
        event.context,
        overrideContext,
      ),
    );
  }

  async emit(
    event: Season0DomainEvent,
    overrideContext: Partial<Season0EventContext> = {},
    overrideEmitContext: Partial<AnalyticsEmitContext> = {},
  ): Promise<AnalyticsEmitReceipt> {
    const envelope = this.build(event, overrideContext);
    const resolvedEmitContext = this.emitContextResolver?.(event, envelope);

    return this.analytics.emit(
      envelope,
      mergeEmitContext(resolvedEmitContext, overrideEmitContext),
    );
  }

  buildBatch(
    events: readonly Season0DomainEvent[],
    overrideContext: Partial<Season0EventContext> = {},
  ): Season0EnvelopeAny[] {
    return events.map((event) => this.build(event, overrideContext));
  }

  async emitBatch(
    events: readonly Season0DomainEvent[],
    overrideContext: Partial<Season0EventContext> = {},
    overrideEmitContext: Partial<AnalyticsEmitContext> = {},
  ): Promise<AnalyticsEmitReceipt[]> {
    const receipts: AnalyticsEmitReceipt[] = [];

    for (const event of events) {
      receipts.push(
        await this.emit(event, overrideContext, overrideEmitContext),
      );
    }

    return receipts;
  }
}

export function createSeason0DomainAnalyticsMapper(
  options: Season0DomainMapperOptions = {},
): Season0DomainAnalyticsMapper {
  return new Season0DomainAnalyticsMapper(options);
}

export function createSeason0ContextFromIdentifiers(input: {
  playerId?: AnalyticsIdentifier;
  gameInstanceId?: AnalyticsIdentifier;
  runId?: AnalyticsIdentifier;
  sessionId?: string;
  seasonId?: string;
}): Season0EventContext {
  return {
    playerId: input.playerId,
    gameInstanceId: input.gameInstanceId,
    runId: input.runId,
    sessionId: input.sessionId,
    seasonId: input.seasonId ?? 'SEASON_0',
  };
}