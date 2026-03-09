// backend/src/analytics/verification/events_verification.ts

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — ANALYTICS / VERIFICATION PIPELINE
 * backend/src/analytics/verification/events_verification.ts
 *
 * Verification-pipeline analytics envelopes for queue/start/pass/quarantine/fail.
 *
 * Intent:
 * - model verification pipeline transitions as first-class analytics
 * - stay aligned to integrity statuses used by trust/public surfaces
 * - support replay-safe emission through the shared analytics emitter contract
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
  type VerificationAnalyticsEventName,
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
// Severity
// ─────────────────────────────────────────────────────────────────────────────

export const VERIFICATION_SEVERITIES = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

export type VerificationSeverity =
  (typeof VERIFICATION_SEVERITIES)[keyof typeof VERIFICATION_SEVERITIES];

const VERIFICATION_SEVERITY_SET: ReadonlySet<string> = new Set(
  Object.values(VERIFICATION_SEVERITIES),
);

function normalizeOptionalVerificationSeverity(
  value?: VerificationSeverity | string,
): VerificationSeverity | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = normalizeNonEmptyString(value, 'severity');
  if (!VERIFICATION_SEVERITY_SET.has(normalized)) {
    throw new Error(
      `severity must be one of: ${Array.from(
        VERIFICATION_SEVERITY_SET,
      ).join(', ')}.`,
    );
  }

  return normalized as VerificationSeverity;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared context
// ─────────────────────────────────────────────────────────────────────────────

export interface VerificationEventContext extends AnalyticsEnvelopeContext {}

function withVerificationDefaults(
  context: VerificationEventContext = {},
): VerificationEventContext {
  return {
    source: 'backend',
    integrityStatus: context.integrityStatus ?? 'PENDING',
    ...context,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Payloads
// ─────────────────────────────────────────────────────────────────────────────

export interface VerificationQueuedPayload {
  verificationJobId: string;
  proofId?: AnalyticsIdentifier;
  trigger?: string;
}

export interface VerificationStartedPayload {
  verificationJobId: string;
  proofId?: AnalyticsIdentifier;
  attemptNumber?: number;
  verifier?: string;
}

export interface VerificationPassedPayload {
  verificationJobId: string;
  proofId?: AnalyticsIdentifier;
  verificationDurationMs?: number;
  checksPassed?: number;
}

export interface VerificationQuarantinedPayload {
  verificationJobId: string;
  proofId?: AnalyticsIdentifier;
  reasonCode: string;
  ruleId?: string;
  severity?: VerificationSeverity;
}

export interface VerificationFailedPayload {
  verificationJobId: string;
  proofId?: AnalyticsIdentifier;
  reasonCode: string;
  retryable?: boolean;
  failureStage?: string;
  severity?: VerificationSeverity;
}

export type VerificationPayloadMap = {
  [ANALYTICS_EVENT_NAMES.VERIFICATION.QUEUED]: VerificationQueuedPayload;
  [ANALYTICS_EVENT_NAMES.VERIFICATION.STARTED]: VerificationStartedPayload;
  [ANALYTICS_EVENT_NAMES.VERIFICATION.PASSED]: VerificationPassedPayload;
  [ANALYTICS_EVENT_NAMES.VERIFICATION.QUARANTINED]: VerificationQuarantinedPayload;
  [ANALYTICS_EVENT_NAMES.VERIFICATION.FAILED]: VerificationFailedPayload;
};

export type VerificationEnvelope<
  TEventName extends VerificationAnalyticsEventName = VerificationAnalyticsEventName,
> = AnalyticsEnvelope<TEventName, VerificationPayloadMap[TEventName]>;

// ─────────────────────────────────────────────────────────────────────────────
// Normalizers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeVerificationQueuedPayload(
  input: VerificationQueuedPayload,
): VerificationQueuedPayload {
  return {
    verificationJobId: normalizeNonEmptyString(
      input.verificationJobId,
      'verificationJobId',
    ),
    proofId: normalizeOptionalIdentifier(input.proofId, 'proofId'),
    trigger: normalizeOptionalString(input.trigger),
  };
}

function normalizeVerificationStartedPayload(
  input: VerificationStartedPayload,
): VerificationStartedPayload {
  return {
    verificationJobId: normalizeNonEmptyString(
      input.verificationJobId,
      'verificationJobId',
    ),
    proofId: normalizeOptionalIdentifier(input.proofId, 'proofId'),
    attemptNumber: normalizeOptionalNonNegativeInteger(
      input.attemptNumber,
      'attemptNumber',
    ),
    verifier: normalizeOptionalString(input.verifier),
  };
}

function normalizeVerificationPassedPayload(
  input: VerificationPassedPayload,
): VerificationPassedPayload {
  return {
    verificationJobId: normalizeNonEmptyString(
      input.verificationJobId,
      'verificationJobId',
    ),
    proofId: normalizeOptionalIdentifier(input.proofId, 'proofId'),
    verificationDurationMs: normalizeOptionalNonNegativeInteger(
      input.verificationDurationMs,
      'verificationDurationMs',
    ),
    checksPassed: normalizeOptionalNonNegativeInteger(
      input.checksPassed,
      'checksPassed',
    ),
  };
}

function normalizeVerificationQuarantinedPayload(
  input: VerificationQuarantinedPayload,
): VerificationQuarantinedPayload {
  return {
    verificationJobId: normalizeNonEmptyString(
      input.verificationJobId,
      'verificationJobId',
    ),
    proofId: normalizeOptionalIdentifier(input.proofId, 'proofId'),
    reasonCode: normalizeNonEmptyString(input.reasonCode, 'reasonCode'),
    ruleId: normalizeOptionalString(input.ruleId),
    severity: normalizeOptionalVerificationSeverity(input.severity),
  };
}

function normalizeVerificationFailedPayload(
  input: VerificationFailedPayload,
): VerificationFailedPayload {
  if (
    input.retryable !== undefined &&
    typeof input.retryable !== 'boolean'
  ) {
    throw new Error('retryable must be boolean when provided.');
  }

  return {
    verificationJobId: normalizeNonEmptyString(
      input.verificationJobId,
      'verificationJobId',
    ),
    proofId: normalizeOptionalIdentifier(input.proofId, 'proofId'),
    reasonCode: normalizeNonEmptyString(input.reasonCode, 'reasonCode'),
    retryable: input.retryable,
    failureStage: normalizeOptionalString(input.failureStage),
    severity: normalizeOptionalVerificationSeverity(input.severity),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Envelope factories
// ─────────────────────────────────────────────────────────────────────────────

export function createVerificationQueuedEvent(
  payload: VerificationQueuedPayload,
  context: VerificationEventContext = {},
): VerificationEnvelope<typeof ANALYTICS_EVENT_NAMES.VERIFICATION.QUEUED> {
  return createAnalyticsEnvelope({
    ...withVerificationDefaults({
      integrityStatus: 'PENDING',
      ...context,
    }),
    eventName: ANALYTICS_EVENT_NAMES.VERIFICATION.QUEUED,
    payload: normalizeVerificationQueuedPayload(payload),
  });
}

export function createVerificationStartedEvent(
  payload: VerificationStartedPayload,
  context: VerificationEventContext = {},
): VerificationEnvelope<typeof ANALYTICS_EVENT_NAMES.VERIFICATION.STARTED> {
  return createAnalyticsEnvelope({
    ...withVerificationDefaults({
      integrityStatus: 'PENDING',
      ...context,
    }),
    eventName: ANALYTICS_EVENT_NAMES.VERIFICATION.STARTED,
    payload: normalizeVerificationStartedPayload(payload),
  });
}

export function createVerificationPassedEvent(
  payload: VerificationPassedPayload,
  context: VerificationEventContext = {},
): VerificationEnvelope<typeof ANALYTICS_EVENT_NAMES.VERIFICATION.PASSED> {
  return createAnalyticsEnvelope({
    ...withVerificationDefaults({
      integrityStatus: 'VERIFIED',
      visibilityScope: context.visibilityScope ?? 'VERIFIED_PUBLIC',
      ...context,
    }),
    eventName: ANALYTICS_EVENT_NAMES.VERIFICATION.PASSED,
    payload: normalizeVerificationPassedPayload(payload),
  });
}

export function createVerificationQuarantinedEvent(
  payload: VerificationQuarantinedPayload,
  context: VerificationEventContext = {},
): VerificationEnvelope<typeof ANALYTICS_EVENT_NAMES.VERIFICATION.QUARANTINED> {
  return createAnalyticsEnvelope({
    ...withVerificationDefaults({
      integrityStatus: 'QUARANTINED',
      ...context,
    }),
    eventName: ANALYTICS_EVENT_NAMES.VERIFICATION.QUARANTINED,
    payload: normalizeVerificationQuarantinedPayload(payload),
  });
}

export function createVerificationFailedEvent(
  payload: VerificationFailedPayload,
  context: VerificationEventContext = {},
): VerificationEnvelope<typeof ANALYTICS_EVENT_NAMES.VERIFICATION.FAILED> {
  return createAnalyticsEnvelope({
    ...withVerificationDefaults({
      integrityStatus: 'FAILED',
      ...context,
    }),
    eventName: ANALYTICS_EVENT_NAMES.VERIFICATION.FAILED,
    payload: normalizeVerificationFailedPayload(payload),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export class VerificationAnalyticsService {
  constructor(
    private readonly emitter: AnalyticsEmitter = new NoopAnalyticsEmitter(),
    private readonly defaultContext: VerificationEventContext = {},
  ) {}

  async emit<TEventName extends VerificationAnalyticsEventName>(
    envelope: VerificationEnvelope<TEventName>,
    context: AnalyticsEmitContext = {},
  ): Promise<AnalyticsEmitReceipt> {
    return this.emitter.emit(envelope, context);
  }

  buildQueued(
    payload: VerificationQueuedPayload,
    context: VerificationEventContext = {},
  ) {
    return createVerificationQueuedEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }

  buildStarted(
    payload: VerificationStartedPayload,
    context: VerificationEventContext = {},
  ) {
    return createVerificationStartedEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }

  buildPassed(
    payload: VerificationPassedPayload,
    context: VerificationEventContext = {},
  ) {
    return createVerificationPassedEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }

  buildQuarantined(
    payload: VerificationQuarantinedPayload,
    context: VerificationEventContext = {},
  ) {
    return createVerificationQuarantinedEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }

  buildFailed(
    payload: VerificationFailedPayload,
    context: VerificationEventContext = {},
  ) {
    return createVerificationFailedEvent(payload, {
      ...this.defaultContext,
      ...context,
    });
  }
}

export function createVerificationAnalyticsService(
  emitter: AnalyticsEmitter = new NoopAnalyticsEmitter(),
  defaultContext: VerificationEventContext = {},
): VerificationAnalyticsService {
  return new VerificationAnalyticsService(emitter, defaultContext);
}