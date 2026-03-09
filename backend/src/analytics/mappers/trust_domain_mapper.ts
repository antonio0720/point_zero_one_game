// backend/src/analytics/mappers/trust_domain_mapper.ts

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — ANALYTICS / TRUST DOMAIN MAPPER
 * backend/src/analytics/mappers/trust_domain_mapper.ts
 *
 * Bridges authoritative proof / explorer / public-integrity transitions into
 * analytics envelopes.
 *
 * Important:
 * - proof, integrity, explorer, and leaderboard services remain authoritative
 * - this mapper projects those transitions into analytics only
 * - no verification truth is created here
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import type { AnalyticsIdentifier } from '../core/analytics_envelope';
import type {
  AnalyticsEmitContext,
  AnalyticsEmitReceipt,
} from '../core/analytics_types';

import {
  createTrustAnalyticsService,
  createExplorerViewedEvent,
  createLeaderboardEligibilityChangedEvent,
  createProofCardMintedEvent,
  createProofMintedEvent,
  createProofSharedDraftEvent,
  createProofSharedVerifiedEvent,
  createProofStampedEvent,
  createRunChallengedFromExplorerEvent,
  createRunExplorerSharedEvent,
  createShowcaseViewedEvent,
  createVerificationStatusChangedEvent,
  type ExplorerViewedPayload,
  type LeaderboardEligibilityChangedPayload,
  type ProofCardMintedPayload,
  type ProofLifecyclePayload,
  type ProofSharedDraftPayload,
  type ProofSharedVerifiedPayload,
  type RunChallengedFromExplorerPayload,
  type RunExplorerSharedPayload,
  type ShowcaseViewedPayload,
  type TrustAnalyticsService,
  type TrustEnvelope,
  type TrustEventContext,
  type VerificationStatusChangedPayload,
} from '../trust';

export const TRUST_DOMAIN_EVENT_TYPES = {
  PROOF_MINTED: 'PROOF_MINTED',
  PROOF_SHARED_DRAFT: 'PROOF_SHARED_DRAFT',
  PROOF_STAMPED: 'PROOF_STAMPED',
  PROOF_SHARED_VERIFIED: 'PROOF_SHARED_VERIFIED',
  PROOF_CARD_MINTED: 'PROOF_CARD_MINTED',
  VERIFICATION_STATUS_CHANGED: 'VERIFICATION_STATUS_CHANGED',
  EXPLORER_VIEWED: 'EXPLORER_VIEWED',
  SHOWCASE_VIEWED: 'SHOWCASE_VIEWED',
  RUN_EXPLORER_SHARED: 'RUN_EXPLORER_SHARED',
  RUN_CHALLENGED_FROM_EXPLORER: 'RUN_CHALLENGED_FROM_EXPLORER',
  LEADERBOARD_ELIGIBILITY_CHANGED: 'LEADERBOARD_ELIGIBILITY_CHANGED',
} as const;

export type TrustDomainEventType =
  (typeof TRUST_DOMAIN_EVENT_TYPES)[keyof typeof TRUST_DOMAIN_EVENT_TYPES];

export interface BaseTrustDomainEvent<
  TType extends TrustDomainEventType,
  TPayload,
> {
  type: TType;
  payload: TPayload;
  context?: TrustEventContext;
}

export interface ProofMintedDomainEvent
  extends BaseTrustDomainEvent<
    typeof TRUST_DOMAIN_EVENT_TYPES.PROOF_MINTED,
    ProofLifecyclePayload
  > {}

export interface ProofSharedDraftDomainEvent
  extends BaseTrustDomainEvent<
    typeof TRUST_DOMAIN_EVENT_TYPES.PROOF_SHARED_DRAFT,
    ProofSharedDraftPayload
  > {}

export interface ProofStampedDomainEvent
  extends BaseTrustDomainEvent<
    typeof TRUST_DOMAIN_EVENT_TYPES.PROOF_STAMPED,
    ProofLifecyclePayload
  > {}

export interface ProofSharedVerifiedDomainEvent
  extends BaseTrustDomainEvent<
    typeof TRUST_DOMAIN_EVENT_TYPES.PROOF_SHARED_VERIFIED,
    ProofSharedVerifiedPayload
  > {}

export interface ProofCardMintedDomainEvent
  extends BaseTrustDomainEvent<
    typeof TRUST_DOMAIN_EVENT_TYPES.PROOF_CARD_MINTED,
    ProofCardMintedPayload
  > {}

export interface VerificationStatusChangedDomainEvent
  extends BaseTrustDomainEvent<
    typeof TRUST_DOMAIN_EVENT_TYPES.VERIFICATION_STATUS_CHANGED,
    VerificationStatusChangedPayload
  > {}

export interface ExplorerViewedDomainEvent
  extends BaseTrustDomainEvent<
    typeof TRUST_DOMAIN_EVENT_TYPES.EXPLORER_VIEWED,
    ExplorerViewedPayload
  > {}

export interface ShowcaseViewedDomainEvent
  extends BaseTrustDomainEvent<
    typeof TRUST_DOMAIN_EVENT_TYPES.SHOWCASE_VIEWED,
    ShowcaseViewedPayload
  > {}

export interface RunExplorerSharedDomainEvent
  extends BaseTrustDomainEvent<
    typeof TRUST_DOMAIN_EVENT_TYPES.RUN_EXPLORER_SHARED,
    RunExplorerSharedPayload
  > {}

export interface RunChallengedFromExplorerDomainEvent
  extends BaseTrustDomainEvent<
    typeof TRUST_DOMAIN_EVENT_TYPES.RUN_CHALLENGED_FROM_EXPLORER,
    RunChallengedFromExplorerPayload
  > {}

export interface LeaderboardEligibilityChangedDomainEvent
  extends BaseTrustDomainEvent<
    typeof TRUST_DOMAIN_EVENT_TYPES.LEADERBOARD_ELIGIBILITY_CHANGED,
    LeaderboardEligibilityChangedPayload
  > {}

export type TrustDomainEvent =
  | ProofMintedDomainEvent
  | ProofSharedDraftDomainEvent
  | ProofStampedDomainEvent
  | ProofSharedVerifiedDomainEvent
  | ProofCardMintedDomainEvent
  | VerificationStatusChangedDomainEvent
  | ExplorerViewedDomainEvent
  | ShowcaseViewedDomainEvent
  | RunExplorerSharedDomainEvent
  | RunChallengedFromExplorerDomainEvent
  | LeaderboardEligibilityChangedDomainEvent;

export type TrustEnvelopeAny = TrustEnvelope;

export interface TrustDomainMapperOptions {
  analytics?: TrustAnalyticsService;
  defaultContext?: TrustEventContext;
  contextResolver?: (
    event: TrustDomainEvent,
  ) => Partial<TrustEventContext> | undefined;
  emitContextResolver?: (
    event: TrustDomainEvent,
    envelope: TrustEnvelopeAny,
  ) => Partial<AnalyticsEmitContext> | undefined;
}

function mergeTrustContext(
  base: TrustEventContext | undefined,
  resolved: Partial<TrustEventContext> | undefined,
  event: TrustEventContext | undefined,
  override: Partial<TrustEventContext> | undefined,
): TrustEventContext {
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

const TRUST_DOMAIN_EVENT_TYPE_ALIAS_MAP: Readonly<Record<string, TrustDomainEventType>> =
  Object.freeze({
    PROOF_MINTED: TRUST_DOMAIN_EVENT_TYPES.PROOF_MINTED,
    PROOF_SHARED_DRAFT: TRUST_DOMAIN_EVENT_TYPES.PROOF_SHARED_DRAFT,
    PROOF_STAMPED: TRUST_DOMAIN_EVENT_TYPES.PROOF_STAMPED,
    PROOF_SHARED_VERIFIED: TRUST_DOMAIN_EVENT_TYPES.PROOF_SHARED_VERIFIED,
    PROOF_CARD_MINTED: TRUST_DOMAIN_EVENT_TYPES.PROOF_CARD_MINTED,
    VERIFICATION_STATUS_CHANGED:
      TRUST_DOMAIN_EVENT_TYPES.VERIFICATION_STATUS_CHANGED,
    EXPLORER_VIEWED: TRUST_DOMAIN_EVENT_TYPES.EXPLORER_VIEWED,
    SHOWCASE_VIEWED: TRUST_DOMAIN_EVENT_TYPES.SHOWCASE_VIEWED,
    RUN_EXPLORER_SHARED: TRUST_DOMAIN_EVENT_TYPES.RUN_EXPLORER_SHARED,
    RUN_CHALLENGED_FROM_EXPLORER:
      TRUST_DOMAIN_EVENT_TYPES.RUN_CHALLENGED_FROM_EXPLORER,
    LEADERBOARD_ELIGIBILITY_CHANGED:
      TRUST_DOMAIN_EVENT_TYPES.LEADERBOARD_ELIGIBILITY_CHANGED,
  });

export function normalizeTrustDomainEventType(
  value: string,
): TrustDomainEventType {
  const normalized = normalizeAliasKey(value);
  const mapped = TRUST_DOMAIN_EVENT_TYPE_ALIAS_MAP[normalized];

  if (!mapped) {
    throw new Error(`Unsupported trust domain event type: ${value}`);
  }

  return mapped;
}

export function createProofMintedDomainEvent(
  payload: ProofLifecyclePayload,
  context: TrustEventContext = {},
): ProofMintedDomainEvent {
  return {
    type: TRUST_DOMAIN_EVENT_TYPES.PROOF_MINTED,
    payload,
    context,
  };
}

export function createProofSharedDraftDomainEvent(
  payload: ProofSharedDraftPayload,
  context: TrustEventContext = {},
): ProofSharedDraftDomainEvent {
  return {
    type: TRUST_DOMAIN_EVENT_TYPES.PROOF_SHARED_DRAFT,
    payload,
    context,
  };
}

export function createProofStampedDomainEvent(
  payload: ProofLifecyclePayload,
  context: TrustEventContext = {},
): ProofStampedDomainEvent {
  return {
    type: TRUST_DOMAIN_EVENT_TYPES.PROOF_STAMPED,
    payload,
    context,
  };
}

export function createProofSharedVerifiedDomainEvent(
  payload: ProofSharedVerifiedPayload,
  context: TrustEventContext = {},
): ProofSharedVerifiedDomainEvent {
  return {
    type: TRUST_DOMAIN_EVENT_TYPES.PROOF_SHARED_VERIFIED,
    payload,
    context,
  };
}

export function createProofCardMintedDomainEvent(
  payload: ProofCardMintedPayload,
  context: TrustEventContext = {},
): ProofCardMintedDomainEvent {
  return {
    type: TRUST_DOMAIN_EVENT_TYPES.PROOF_CARD_MINTED,
    payload,
    context,
  };
}

export function createVerificationStatusChangedDomainEvent(
  payload: VerificationStatusChangedPayload,
  context: TrustEventContext = {},
): VerificationStatusChangedDomainEvent {
  return {
    type: TRUST_DOMAIN_EVENT_TYPES.VERIFICATION_STATUS_CHANGED,
    payload,
    context,
  };
}

export function createExplorerViewedDomainEvent(
  payload: ExplorerViewedPayload,
  context: TrustEventContext = {},
): ExplorerViewedDomainEvent {
  return {
    type: TRUST_DOMAIN_EVENT_TYPES.EXPLORER_VIEWED,
    payload,
    context,
  };
}

export function createShowcaseViewedDomainEvent(
  payload: ShowcaseViewedPayload = {},
  context: TrustEventContext = {},
): ShowcaseViewedDomainEvent {
  return {
    type: TRUST_DOMAIN_EVENT_TYPES.SHOWCASE_VIEWED,
    payload,
    context,
  };
}

export function createRunExplorerSharedDomainEvent(
  payload: RunExplorerSharedPayload,
  context: TrustEventContext = {},
): RunExplorerSharedDomainEvent {
  return {
    type: TRUST_DOMAIN_EVENT_TYPES.RUN_EXPLORER_SHARED,
    payload,
    context,
  };
}

export function createRunChallengedFromExplorerDomainEvent(
  payload: RunChallengedFromExplorerPayload,
  context: TrustEventContext = {},
): RunChallengedFromExplorerDomainEvent {
  return {
    type: TRUST_DOMAIN_EVENT_TYPES.RUN_CHALLENGED_FROM_EXPLORER,
    payload,
    context,
  };
}

export function createLeaderboardEligibilityChangedDomainEvent(
  payload: LeaderboardEligibilityChangedPayload,
  context: TrustEventContext = {},
): LeaderboardEligibilityChangedDomainEvent {
  return {
    type: TRUST_DOMAIN_EVENT_TYPES.LEADERBOARD_ELIGIBILITY_CHANGED,
    payload,
    context,
  };
}

export function mapTrustDomainEventToAnalyticsEnvelope(
  event: TrustDomainEvent,
  context: TrustEventContext = {},
): TrustEnvelopeAny {
  const mergedContext = {
    ...event.context,
    ...context,
  };

  switch (event.type) {
    case TRUST_DOMAIN_EVENT_TYPES.PROOF_MINTED:
      return createProofMintedEvent(event.payload, mergedContext);

    case TRUST_DOMAIN_EVENT_TYPES.PROOF_SHARED_DRAFT:
      return createProofSharedDraftEvent(event.payload, mergedContext);

    case TRUST_DOMAIN_EVENT_TYPES.PROOF_STAMPED:
      return createProofStampedEvent(event.payload, mergedContext);

    case TRUST_DOMAIN_EVENT_TYPES.PROOF_SHARED_VERIFIED:
      return createProofSharedVerifiedEvent(event.payload, mergedContext);

    case TRUST_DOMAIN_EVENT_TYPES.PROOF_CARD_MINTED:
      return createProofCardMintedEvent(event.payload, mergedContext);

    case TRUST_DOMAIN_EVENT_TYPES.VERIFICATION_STATUS_CHANGED:
      return createVerificationStatusChangedEvent(event.payload, mergedContext);

    case TRUST_DOMAIN_EVENT_TYPES.EXPLORER_VIEWED:
      return createExplorerViewedEvent(event.payload, mergedContext);

    case TRUST_DOMAIN_EVENT_TYPES.SHOWCASE_VIEWED:
      return createShowcaseViewedEvent(event.payload, mergedContext);

    case TRUST_DOMAIN_EVENT_TYPES.RUN_EXPLORER_SHARED:
      return createRunExplorerSharedEvent(event.payload, mergedContext);

    case TRUST_DOMAIN_EVENT_TYPES.RUN_CHALLENGED_FROM_EXPLORER:
      return createRunChallengedFromExplorerEvent(
        event.payload,
        mergedContext,
      );

    case TRUST_DOMAIN_EVENT_TYPES.LEADERBOARD_ELIGIBILITY_CHANGED:
      return createLeaderboardEligibilityChangedEvent(
        event.payload,
        mergedContext,
      );
  }
}

export class TrustDomainAnalyticsMapper {
  private readonly analytics: TrustAnalyticsService;
  private readonly defaultContext: TrustEventContext;
  private readonly contextResolver?: TrustDomainMapperOptions['contextResolver'];
  private readonly emitContextResolver?: TrustDomainMapperOptions['emitContextResolver'];

  constructor(options: TrustDomainMapperOptions = {}) {
    this.analytics =
      options.analytics ?? createTrustAnalyticsService(undefined, {});
    this.defaultContext = options.defaultContext ?? {};
    this.contextResolver = options.contextResolver;
    this.emitContextResolver = options.emitContextResolver;
  }

  build(
    event: TrustDomainEvent,
    overrideContext: Partial<TrustEventContext> = {},
  ): TrustEnvelopeAny {
    const resolvedContext = this.contextResolver?.(event);

    return mapTrustDomainEventToAnalyticsEnvelope(
      event,
      mergeTrustContext(
        this.defaultContext,
        resolvedContext,
        event.context,
        overrideContext,
      ),
    );
  }

  async emit(
    event: TrustDomainEvent,
    overrideContext: Partial<TrustEventContext> = {},
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
    events: readonly TrustDomainEvent[],
    overrideContext: Partial<TrustEventContext> = {},
  ): TrustEnvelopeAny[] {
    return events.map((event) => this.build(event, overrideContext));
  }

  async emitBatch(
    events: readonly TrustDomainEvent[],
    overrideContext: Partial<TrustEventContext> = {},
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

export function createTrustDomainAnalyticsMapper(
  options: TrustDomainMapperOptions = {},
): TrustDomainAnalyticsMapper {
  return new TrustDomainAnalyticsMapper(options);
}

export function createTrustContextFromIdentifiers(input: {
  playerId?: AnalyticsIdentifier;
  gameInstanceId?: AnalyticsIdentifier;
  runId?: AnalyticsIdentifier;
  sessionId?: string;
  seasonId?: string;
}): TrustEventContext {
  return {
    playerId: input.playerId,
    gameInstanceId: input.gameInstanceId,
    runId: input.runId,
    sessionId: input.sessionId,
    seasonId: input.seasonId,
  };
}