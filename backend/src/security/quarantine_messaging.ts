/**
 * Quarantine Messaging Module
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/security/quarantine_messaging.ts
 */

import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

export type QuarantineSeverity = 'INFO' | 'WARN' | 'CRITICAL';

export type QuarantineDisposition =
  | 'QUARANTINED'
  | 'INTEGRITY_VIOLATION'
  | 'SUPPRESSED'
  | 'REVIEW_REQUIRED';

export interface PublicQuarantineMessage {
  /** Unique identifier for the quarantine event */
  id: string;

  /** Timestamp when the quarantine event occurred */
  timestamp: Date;

  /** Brief description of the quarantine event */
  message: string;

  /** Public-safe severity for display, alerting, and analytics */
  severity: QuarantineSeverity;

  /** Stable event disposition for public-safe UI flows */
  disposition: QuarantineDisposition;

  /** Optional correlation id for tracing a single event across systems */
  correlationId: string | null;
}

export interface InternalQuarantineMessage {
  /** Unique identifier for the quarantine event */
  id: string;

  /** Timestamp when the quarantine event occurred */
  timestamp: Date;

  /** Brief description of the quarantine event */
  message: string;

  /** Detailed reason code for the quarantine event (internal use only) */
  reasonCode: string;

  /** Internal severity for paging, routing, and triage */
  severity: QuarantineSeverity;

  /** Internal disposition used by downstream security systems */
  disposition: QuarantineDisposition;

  /** Optional correlation id for tracing a single event across systems */
  correlationId: string | null;

  /** Hash of the details payload for forensic integrity */
  detailsHash: string;

  /** Optional structured details payload */
  details: Readonly<Record<string, unknown>>;

  /** Optional detached signature for tamper detection */
  signature: string | null;
}

export interface CreateQuarantineMessageOptions {
  readonly severity?: QuarantineSeverity;
  readonly disposition?: QuarantineDisposition;
  readonly correlationId?: string | null;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly secret?: string | null;
}

export interface QuarantineMessageVerification {
  readonly valid: boolean;
  readonly reason: string | null;
}

const MAX_MESSAGE_LENGTH = 280;
const MAX_REASON_CODE_LENGTH = 64;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/gu;
const MULTISPACE = /\s+/gu;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();

  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function hmacSha256(secret: string, input: string): string {
  return createHmac('sha256', secret).update(input).digest('hex');
}

function compareHex(lhs: string, rhs: string): boolean {
  if (lhs.length !== rhs.length || lhs.length === 0 || lhs.length % 2 !== 0) {
    return false;
  }

  try {
    const left = Buffer.from(lhs, 'hex');
    const right = Buffer.from(rhs, 'hex');

    if (left.length !== right.length) {
      return false;
    }

    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function normalizeTimestamp(timestamp: Date): Date {
  const normalized = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const epoch = normalized.getTime();

  if (!Number.isFinite(epoch)) {
    return new Date(0);
  }

  return new Date(epoch);
}

function normalizeMessage(message: string): string {
  return message
    .normalize('NFKC')
    .replace(CONTROL_CHARS, ' ')
    .replace(MULTISPACE, ' ')
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);
}

function normalizeReasonCode(reasonCode: string): string {
  return reasonCode
    .normalize('NFKC')
    .replace(CONTROL_CHARS, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9:_-]/gu, '_')
    .replace(/_{2,}/gu, '_')
    .slice(0, MAX_REASON_CODE_LENGTH);
}

function normalizeCorrelationId(correlationId?: string | null): string | null {
  if (typeof correlationId !== 'string') {
    return null;
  }

  const normalized = correlationId
    .normalize('NFKC')
    .replace(CONTROL_CHARS, '')
    .trim()
    .slice(0, 128);

  return normalized.length > 0 ? normalized : null;
}

function normalizeDetails(
  details?: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  if (!details) {
    return Object.freeze({});
  }

  return Object.freeze({ ...details });
}

function buildSignaturePayload(message: Omit<InternalQuarantineMessage, 'signature'>): string {
  return stableStringify({
    id: message.id,
    timestamp: message.timestamp.toISOString(),
    message: message.message,
    reasonCode: message.reasonCode,
    severity: message.severity,
    disposition: message.disposition,
    correlationId: message.correlationId,
    detailsHash: message.detailsHash,
  });
}

/**
 * Function to create a public quarantine message.
 * Preserves the original shape while adding explicit severity/disposition metadata.
 *
 * @param timestamp Timestamp when the quarantine event occurred
 * @param message Brief description of the quarantine event
 */
export function createPublicQuarantineMessage(
  timestamp: Date,
  message: string,
  options: CreateQuarantineMessageOptions = {},
): PublicQuarantineMessage {
  return {
    id: randomUUID(),
    timestamp: normalizeTimestamp(timestamp),
    message: normalizeMessage(message),
    severity: options.severity ?? 'WARN',
    disposition: options.disposition ?? 'QUARANTINED',
    correlationId: normalizeCorrelationId(options.correlationId),
  };
}

/**
 * Function to create an internal quarantine message.
 * Keeps the original call contract intact and adds structured forensic metadata.
 *
 * @param timestamp Timestamp when the quarantine event occurred
 * @param message Brief description of the quarantine event
 * @param reasonCode Detailed reason code for the quarantine event (internal use only)
 */
export function createInternalQuarantineMessage(
  timestamp: Date,
  message: string,
  reasonCode: string,
  options: CreateQuarantineMessageOptions = {},
): InternalQuarantineMessage {
  const normalizedDetails = normalizeDetails(options.details);

  const unsignedMessage: Omit<InternalQuarantineMessage, 'signature'> = {
    id: randomUUID(),
    timestamp: normalizeTimestamp(timestamp),
    message: normalizeMessage(message),
    reasonCode: normalizeReasonCode(reasonCode),
    severity: options.severity ?? 'CRITICAL',
    disposition: options.disposition ?? 'QUARANTINED',
    correlationId: normalizeCorrelationId(options.correlationId),
    detailsHash: sha256(stableStringify(normalizedDetails)),
    details: normalizedDetails,
  };

  return {
    ...unsignedMessage,
    signature:
      typeof options.secret === 'string' && options.secret.length > 0
        ? hmacSha256(options.secret, buildSignaturePayload(unsignedMessage))
        : null,
  };
}

export function toPublicQuarantineMessage(
  message: InternalQuarantineMessage,
): PublicQuarantineMessage {
  return {
    id: message.id,
    timestamp: normalizeTimestamp(message.timestamp),
    message: normalizeMessage(message.message),
    severity: message.severity,
    disposition: message.disposition,
    correlationId: message.correlationId,
  };
}

export function redactInternalQuarantineMessage(
  message: InternalQuarantineMessage,
): InternalQuarantineMessage {
  return {
    ...message,
    details: Object.freeze({
      redacted: true,
      detailsHash: message.detailsHash,
    }),
    signature: message.signature ? `${message.signature.slice(0, 16)}…` : null,
  };
}

export function verifyInternalQuarantineMessage(
  message: InternalQuarantineMessage,
  secret: string,
): QuarantineMessageVerification {
  const expectedDetailsHash = sha256(stableStringify(message.details));

  if (message.detailsHash !== expectedDetailsHash) {
    return {
      valid: false,
      reason: 'DETAILS_HASH_MISMATCH',
    };
  }

  if (!message.signature) {
    return {
      valid: false,
      reason: 'MISSING_SIGNATURE',
    };
  }

  const unsignedMessage: Omit<InternalQuarantineMessage, 'signature'> = {
    id: message.id,
    timestamp: normalizeTimestamp(message.timestamp),
    message: normalizeMessage(message.message),
    reasonCode: normalizeReasonCode(message.reasonCode),
    severity: message.severity,
    disposition: message.disposition,
    correlationId: normalizeCorrelationId(message.correlationId),
    detailsHash: message.detailsHash,
    details: normalizeDetails(message.details),
  };

  const expectedSignature = hmacSha256(
    secret,
    buildSignaturePayload(unsignedMessage),
  );

  if (!compareHex(message.signature, expectedSignature)) {
    return {
      valid: false,
      reason: 'INVALID_SIGNATURE',
    };
  }

  return {
    valid: true,
    reason: null,
  };
}