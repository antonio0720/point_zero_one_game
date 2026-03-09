// backend/src/analytics/trust/index.ts

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — ANALYTICS / TRUST SURFACES
 * backend/src/analytics/trust/index.ts
 *
 * Trust, proof, explorer, showcase, and ladder-eligibility analytics envelopes.
 *
 * These analytics sit downstream of authoritative proof / integrity / explorer
 * domain transitions. They are not the source of verification truth.
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
  type ExplorerViewType,
  type IntegrityStatus,
  type TrustAnalyticsEventName,
  type TrustSurfaceName,
} from '../core/analytics_names';

import {
  normalizeExplorerViewType,
  normalizeIdentifier,
  normalizeIntegrityStatus,
  normalizeNonEmptyString,
  normalizeOptionalIdentifier,
  normalizeOptionalProofHash,
  normalizeOptionalString,
  normalizeOptionalTrustSurfaceName,
  normalizeTrustSurfaceName,
} from '../core/analytics_validation';

import type {
  AnalyticsEmitContext,
  AnalyticsEmitReceipt,
  AnalyticsEmitter,
} from '../core/analytics_types';

// ─────────────────────────────────────────────────────────────────────────────
// Shared context
// ─────────────────────────────────────────────────────────────────────────────

export interface TrustEventContext extends AnalyticsEnvelopeContext {}

function withTrustDefaults(
  context: TrustEventContext = {},
): TrustEventContext {
  return {
    source: 'backend',
    ...context,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Payloads
// ─────────────────────────────────────────────────────────────────────────────

export interface ProofLifecyclePayload {
  proofId: AnalyticsIdentifier;
  proofKind?: string;
}

export interface ProofSharedDraftPayload extends ProofLifecyclePayload {
  shareChannel?: string;
}

export interface ProofSharedVerifiedPayload extends ProofLifecyclePayload {
  shareChannel?: string;
  verificationBadge?: string;
}

export interface ProofCardMintedPayload extends ProofLifecyclePayload {
  cardTemplate?: string;
}

export interface VerificationStatusChangedPayload {
  proofId: AnalyticsIdentifier;
  previousStatus?: IntegrityStatus;
  newStatus: IntegrityStatus;
  reasonCode?: string;
}

export interface ExplorerViewedPayload {
  explorerViewType: ExplorerViewType;
  surface?: TrustSurfaceName;
  targetId?: AnalyticsIdentifier;
  targetType?: string;
}

export interface ShowcaseViewedPayload {
  surface?: 'showcase';
  featuredEntityId?: AnalyticsIdentifier;
  featuredEntityType?: string;
}

export interface RunExplorerSharedPayload {
  runId: AnalyticsIdentifier;
  shareChannel?: string;
  shareCode?: string;
}

export interface RunChallengedFromExplorerPayload {
  targetRunId: AnalyticsIdentifier;
  challengerPlayerId?: AnalyticsIdentifier;
  challengeType?: string;
}

export interface LeaderboardEligibilityChangedPayload {
  runId: AnalyticsIdentifier;
  eligible: boolean;
  previousEligible?: boolean;
  boardKey?: string;
  reasonCode?: string;
}

export type TrustPayloadMap = {
  [ANALYTICS_EVENT_NAMES.TRUST.PROOF_MINTED]: ProofLifecyclePayload;
  [ANALYTICS_EVENT_NAMES.TRUST.PROOF_SHARED_DRAFT]: ProofSharedDraftPayload;
  [ANALYTICS_EVENT_NAMES.TRUST.PROOF_STAMPED]: ProofLifecyclePayload;
  [ANALYTICS_EVENT_NAMES.TRUST.PROOF_SHARED_VERIFIED]: ProofSharedVerifiedPayload;
  [ANALYTICS_EVENT_NAMES.TRUST.PROOF_CARD_MINTED]: ProofCardMintedPayload;
  [ANALYTICS_EVENT_NAMES.TRUST.VERIFICATION_STATUS_CHANGED]: VerificationStatusChangedPayload;
  [ANALYTICS_EVENT_NAMES.TRUST.EXPLORER_VIEWED]: ExplorerViewedPayload;
  [ANALYTICS_EVENT_NAMES.TRUST.SHOWCASE_VIEWED]: ShowcaseViewedPayload;
  [ANALYTICS_EVENT_NAMES.TRUST.RUN_EXPLORER_SHARED]: RunExplorerSharedPayload;
  [ANALYTICS_EVENT_NAMES.TRUST.RUN_CHALLENGED_FROM_EXPLORER]: RunChallengedFromExplorerPayload;
  [ANALYTICS_EVENT_NAMES.TRUST.LEADERBOARD_ELIGIBILITY_CHANGED]: LeaderboardEligibilityChangedPayload;
};

export type TrustEnvelope<
  TEventName extends TrustAnalyticsEventName = TrustAnalyticsEventName,
> = AnalyticsEnvelope<TEventName, TrustPayloadMap[TEventName]>;

// ─────────────────────────────────────────────────────────────────────────────
// Normalizers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeProofLifecyclePayload(
  input: ProofLifecyclePayload,
): ProofLifecyclePayload {
  return {
    proofId: normalizeIdentifier(input.proofId, 'proofId'),
    proofKind: normalizeOptionalString(input.proofKind),
  };
}

function normalizeProofSharedDraftPayload(
  input: ProofSharedDraftPayload,
): ProofSharedDraftPayload {
  return {
    ...normalizeProofLifecyclePayload(input),
    shareChannel: normalizeOptionalString(input.shareChannel),
  };
}

function normalizeProofSharedVerifiedPayload(
  input: ProofSharedVerifiedPayload,
): ProofSharedVerifiedPayload {
  return {
    ...normalizeProofLifecyclePayload(input),
    shareChannel: normalizeOptionalString(input.shareChannel),
    verificationBadge: normalizeOptionalString(input.verificationBadge),
  };
}

function normalizeProofCardMintedPayload(
  input: ProofCardMintedPayload,
): ProofCardMintedPayload {
  return {
    ...normalizeProofLifecyclePayload(input),
    cardTemplate: normalizeOptionalString(input.cardTemplate),
  };
}

function normalizeVerificationStatusChangedPayload(
  input: VerificationStatusChangedPayload,
): VerificationStatusChangedPayload {
  return {
    proofId: normalizeIdentifier(input.proofId, 'proofId'),
    previousStatus: input.previousStatus
      ? normalizeIntegrityStatus(input.previousStatus)
      : undefined,
    newStatus: normalizeIntegrityStatus(input.newStatus),
    reasonCode: normalizeOptionalString(input.reasonCode),
  };
}

function normalizeExplorerViewedPayload(
  input: ExplorerViewedPayload,
): ExplorerViewedPayload {
  return {
    explorerViewType: normalizeExplorerViewType(input.explorerViewType),
    surface: input.surface
      ? normalizeTrustSurfaceName(input.surface)
      : 'explorer',
    targetId: normalizeOptionalIdentifier(input.targetId, 'targetId'),
    targetType: normalizeOptionalString(input.targetType),
  };
}

function normalizeShowcaseViewedPayload(
  input: ShowcaseViewedPayload = {},
): ShowcaseViewedPayload {
  return {
    surface: 'showcase',
    featuredEntityId: normalizeOptionalIdentifier(
      input.featuredEntityId,
      'featuredEntityId',
    ),
    featuredEntityType: normalizeOptionalString(input.featuredEntityType),
  };
}

function normalizeRunExplorerSharedPayload(
  input: RunExplorerSharedPayload,
): RunExplorerSharedPayload {
  return {
    runId: normalizeIdentifier(input.runId, 'runId'),
    shareChannel: normalizeOptionalString(input.shareChannel),
    shareCode: normalizeOptionalString(input.shareCode),
  };
}

function normalizeRunChallengedFromExplorerPayload(
  input: RunChallengedFromExplorerPayload,
): RunChallengedFromExplorerPayload {
  return {
    targetRunId: normalizeIdentifier(input.targetRunId, 'targetRunId'),
    challengerPlayerId: normalizeOptionalIdentifier(
      input.challengerPlayerId,
      'challengerPlayerId',
    ),
    challengeType: normalizeOptionalString(input.challengeType),
  };
}

function normalizeLeaderboardEligibilityChangedPayload(
  input: LeaderboardEligibilityChangedPayload,
): LeaderboardEligibilityChangedPayload {
  if (typeof input.eligible !== 'boolean') {
    throw new Error('eligible must be boolean.');
  }

  if (
    input.previousEligible !== undefined &&
    typeof input.previousEligible !== 'boolean'
  ) {
    throw new Error('previousEligible must be boolean when provided.');
  }

  return {
    runId: normalizeIdentifier(input.runId, 'runId'),
    eligible: input.eligible,
    previousEligible: input.previousEligible,
    boardKey: normalizeOptionalString(input.boardKey),
    reasonCode: normalizeOptionalString(input.reasonCode),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Envelope factories
// ─────────────────────────────────────────────────────────────────────────────

export function createProofMintedEvent(
  payload: ProofLifecyclePayload,
  context: TrustEventContext = {},
): TrustEnvelope<typeof ANALYTICS_EVENT_NAMES.TRUST.PROOF_MINTED> {
  return createAnalyticsEnvelope({
    ...withTrustDefaults(context),
    eventName: ANALYTICS_EVENT_NAMES.TRUST.PROOF_MINTED,
    payload: normalizeProofLifecyclePayload(payload),
  });
}

export function createProofSharedDraftEvent(
  payload: ProofSharedDraftPayload,
  context: TrustEventContext = {},
): TrustEnvelope<typeof ANALYTICS_EVENT_NAMES.TRUST.PROOF_SHARED_DRAFT> {
  return createAnalyticsEnvelope({
    ...withTrustDefaults(context),
    eventName: ANALYTICS_EVENT_NAMES.TRUST.PROOF_SHARED_DRAFT,
    payload: normalizeProofSharedDraftPayload(payload),
  });
}

export function createProofStampedEvent(
  payload: ProofLifecyclePayload,
  context: TrustEventContext = {},
): TrustEnvelope<typeof ANALYTICS_EVENT_NAMES.TRUST.PROOF_STAMPED> {
  return createAnalyticsEnvelope({
    ...withTrustDefaults(context),
    eventName: ANALYTICS_EVENT_NAMES.TRUST.PROOF_STAMPED,
    payload: normalizeProofLifecyclePayload(payload),
  });
}

export function createProofSharedVerifiedEvent(
  payload: ProofSharedVerifiedPayload,
  context: TrustEventContext = {},
): TrustEnvelope<typeof ANALYTICS_EVENT_NAMES.TRUST.PROOF_SHARED_VERIFIED> {
  return createAnalyticsEnvelope({
    ...withTrustDefaults({
      integrityStatus: 'VERIFIED',
      visibilityScope: 'VERIFIED_PUBLIC',
      ...context,
    }),
    eventName: ANALYTICS_EVENT_NAMES.TRUST.PROOF_SHARED_VERIFIED,
    payload: normalizeProofSharedVerifiedPayload(payload),
  });
}

export function createProofCardMintedEvent(
  payload: ProofCardMintedPayload,
  context: TrustEventContext = {},
): TrustEnvelope<typeof ANALYTICS_EVENT_NAMES.TRUST.PROOF_CARD_MINTED> {
  return createAnalyticsEnvelope({
    ...withTrustDefaults(context),
    eventName: ANALYTICS_EVENT_NAMES.TRUST.PROOF_CARD_MINTED,
    payload: normalizeProofCardMintedPayload(payload),
  });
}

export function createVerificationStatusChangedEvent(
  payload: VerificationStatusChangedPayload,
  context: TrustEventContext = {},
): TrustEnvelope<
  typeof ANALYTICS_EVENT_NAMES.TRUST.VERIFICATION_STATUS_CHANGED
> {
  const normalizedPayload = normalizeVerificationStatusChangedPayload(payload);

  return createAnalyticsEnvelope({
    ...withTrustDefaults({
      integrityStatus: normalizedPayload.newStatus,
      ...context,
    }),
    eventName: ANALYTICS_EVENT_NAMES.TRUST.VERIFICATION_STATUS_CHANGED,
    payload: normalizedPayload,
  });
}

export function createExplorerViewedEvent(
  payload: ExplorerViewedPayload,
  context: TrustEventContext = {},
): TrustEnvelope<typeof ANALYTICS_EVENT_NAMES.TRUST.EXPLORER_VIEWED> {
  const normalizedPayload = normalizeExplorerViewedPayload(payload);

  return createAnalyticsEnvelope({
    ...withTrustDefaults({
      visibilityScope: context.visibilityScope ?? 'PUBLIC',
      ...context,
    }),
    eventName: ANALYTICS_EVENT_NAMES.TRUST.EXPLORER_VIEWED,
    payload: normalizedPayload,
  });
}

export function createShowcaseViewedEvent(
  payload: ShowcaseViewedPayload = {},
  context: TrustEventContext = {},
): TrustEnvelope<typeof ANALYTICS_EVENT_NAMES.TRUST.SHOWCASE_VIEWED> {
  return createAnalyticsEnvelope({
    ...withTrustDefaults({
      visibilityScope: context.visibilityScope ?? 'PUBLIC',
      ...context,
    }),
    eventName: ANALYTICS_EVENT_NAMES.TRUST.SHOWCASE_VIEWED,
    payload: normalizeShowcaseViewedPayload(payload),
  });
}

export function createRunExplorerSharedEvent(
  payload: RunExplorerSharedPayload,
  context: TrustEventContext = {},
): TrustEnvelope<typeof ANALYTICS_EVENT_NAMES.TRUST.RUN_EXPLORER_SHARED> {
  return createAnalyticsEnvelope({
    ...withTrustDefaults({
      visibilityScope: context.visibilityScope ?? 'PUBLIC',
      ...context,
    }),
    eventName: ANALYTICS_EVENT_NAMES.TRUST.RUN_EXPLORER_SHARED,
    payload: normalizeRunExplorerSharedPayload(payload),
  });
}

export function createRunChallengedFromExplorerEvent(
  payload: RunChallengedFromExplorerPayload,
  context: TrustEventContext = {},
): TrustEnvelope<
  typeof ANALYTICS_EVENT_NAMES.TRUST.RUN_CHALLENGED_FROM_EXPLORER
> {
  return createAnalyticsEnvelope({
    ...withTrustDefaults(context),
    eventName: ANALYTICS_EVENT_NAMES.TRUST.RUN_CHALLENGED_FROM_EXPLORER,
    payload: normalizeRunChallengedFromExplorerPayload(payload),
  });
}

export function createLeaderboardEligibilityChangedEvent(
  payload: LeaderboardEligibilityChangedPayload,
  context: TrustEventContext = {},
): TrustEnvelope<
  typeof ANALYTICS_EVENT_NAMES.TRUST.LEADERBOARD_ELIGIBILITY_CHANGED
> {
  return createAnalyticsEnvelope({
    ...withTrustDefaults(context),
    eventName: ANALYTICS_EVENT_NAMES.TRUST.LEADERBOARD_ELIGIBILITY_CHANGED,
    payload: normalizeLeaderboardEligibilityChangedPayload(payload),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export class TrustAnalyticsService {
  constructor(
    private readonly emitter: AnalyticsEmitter = new NoopAnalyticsEmitter(),
    private readonly defaultContext: TrustEventContext = {},
  ) {}

  async emit<TEventName extends TrustAnalyticsEventName>(
    envelope: TrustEnvelope<TEventName>,
    context: AnalyticsEmitContext = {},
  ): Promise<AnalyticsEmitReceipt> {
    return this.emitter.emit(envelope as unknown as any, context);
  }

  buildProofMinted(
    payload: ProofLifecyclePayload,
    context: TrustEventContext = {},
  ) {
    return createProofMintedEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }

  buildProofSharedDraft(
    payload: ProofSharedDraftPayload,
    context: TrustEventContext = {},
  ) {
    return createProofSharedDraftEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }

  buildProofStamped(
    payload: ProofLifecyclePayload,
    context: TrustEventContext = {},
  ) {
    return createProofStampedEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }

  buildProofSharedVerified(
    payload: ProofSharedVerifiedPayload,
    context: TrustEventContext = {},
  ) {
    return createProofSharedVerifiedEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }

  buildProofCardMinted(
    payload: ProofCardMintedPayload,
    context: TrustEventContext = {},
  ) {
    return createProofCardMintedEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }

  buildVerificationStatusChanged(
    payload: VerificationStatusChangedPayload,
    context: TrustEventContext = {},
  ) {
    return createVerificationStatusChangedEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }

  buildExplorerViewed(
    payload: ExplorerViewedPayload,
    context: TrustEventContext = {},
  ) {
    return createExplorerViewedEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }

  buildShowcaseViewed(
    payload: ShowcaseViewedPayload = {},
    context: TrustEventContext = {},
  ) {
    return createShowcaseViewedEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }

  buildRunExplorerShared(
    payload: RunExplorerSharedPayload,
    context: TrustEventContext = {},
  ) {
    return createRunExplorerSharedEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }

  buildRunChallengedFromExplorer(
    payload: RunChallengedFromExplorerPayload,
    context: TrustEventContext = {},
  ) {
    return createRunChallengedFromExplorerEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }

  buildLeaderboardEligibilityChanged(
    payload: LeaderboardEligibilityChangedPayload,
    context: TrustEventContext = {},
  ) {
    return createLeaderboardEligibilityChangedEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }
}

export function createTrustAnalyticsService(
  emitter: AnalyticsEmitter = new NoopAnalyticsEmitter(),
  defaultContext: TrustEventContext = {},
): TrustAnalyticsService {
  return new TrustAnalyticsService(emitter, defaultContext);
}

// Re-export commonly used domain types.
export type {
  ExplorerViewType,
  IntegrityStatus,
  TrustSurfaceName,
};