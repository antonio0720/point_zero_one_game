// backend/src/analytics/core/analytics_envelope.ts

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — ANALYTICS CORE / ENVELOPE
 * backend/src/analytics/core/analytics_envelope.ts
 *
 * Shared event envelope for all backend analytics domains.
 *
 * This is intentionally:
 * - runtime-safe
 * - deterministic
 * - queue/outbox friendly
 * - backward-compatible with plain object serialization
 *
 * Important:
 * - domain services are the source of truth
 * - this file only wraps already-authoritative transitions
 * - event names must come from analytics_names.ts
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { randomUUID } from 'node:crypto';

import {
  ANALYTICS_SCHEMA_VERSION,
  type AnalyticsEventName,
  type AnalyticsSource,
  type GameMode,
  type IntegrityStatus,
  type RunOutcome,
  type RunPhase,
  type VerifiedGrade,
  type VisibilityScope,
} from './analytics_names';

import {
  compactUndefined,
  normalizeAnalyticsEventName,
  normalizeAnalyticsSource,
  normalizeCord,
  normalizeIdentifier,
  normalizeMetadata,
  normalizeOccurredAndEmittedAt,
  normalizeOptionalGameMode,
  normalizeOptionalIdentifier,
  normalizeOptionalIntegrityStatus,
  normalizeOptionalProofHash,
  normalizeOptionalRunOutcome,
  normalizeOptionalRunPhase,
  normalizeOptionalUuidish,
  normalizeOptionalVersionToken,
  normalizeOptionalVisibilityScope,
  normalizeOptionalVerifiedGrade,
  normalizeSchemaVersion,
} from './analytics_validation';

export type AnalyticsIdentifier = string | number;
export type AnalyticsMetadataValue = string | number | boolean | null;
export type AnalyticsMetadata = Readonly<Record<string, AnalyticsMetadataValue>>;
export type AnalyticsPayload = Readonly<Record<string, unknown>>;

export const EMPTY_ANALYTICS_PAYLOAD: AnalyticsPayload = Object.freeze({});

export interface AnalyticsEnvelopeContext {
  /**
   * Optional explicit event ID.
   * If omitted, a UUID is generated.
   */
  eventId?: string;

  /**
   * Schema version for warehouse / consumers.
   */
  schemaVersion?: number;

  /**
   * Business time: when the underlying domain event actually happened.
   */
  occurredAt?: number;

  /**
   * Transport time: when this envelope was emitted.
   */
  emittedAt?: number;

  /**
   * Cross-service traceability.
   */
  correlationId?: string;
  causationId?: string;

  /**
   * Where this event originated.
   * Backend is the safe default in this codebase.
   */
  source?: AnalyticsSource;

  /**
   * Core identity / session context.
   */
  playerId?: AnalyticsIdentifier;
  gameInstanceId?: AnalyticsIdentifier;
  runId?: AnalyticsIdentifier;
  sessionId?: string;
  seasonId?: string;

  /**
   * Canonical run / trust context.
   */
  mode?: GameMode;
  runPhase?: RunPhase;
  runOutcome?: RunOutcome;
  cord?: number;
  grade?: VerifiedGrade;
  integrityStatus?: IntegrityStatus;
  proofHash?: string;

  /**
   * Version pinning for replay compatibility and deploy traceability.
   */
  rulesetVersion?: string;
  contentVersion?: string;

  /**
   * Public surface exposure.
   */
  visibilityScope?: VisibilityScope;

  /**
   * Arbitrary scalar metadata.
   */
  metadata?: AnalyticsMetadata | Record<string, unknown>;
}

export interface AnalyticsEnvelope<
  TEventName extends AnalyticsEventName = AnalyticsEventName,
  TPayload extends AnalyticsPayload = AnalyticsPayload,
> {
  eventId: string;
  eventName: TEventName;
  schemaVersion: number;
  occurredAt: number;
  emittedAt: number;
  source: AnalyticsSource;

  correlationId?: string;
  causationId?: string;

  playerId?: AnalyticsIdentifier;
  gameInstanceId?: AnalyticsIdentifier;
  runId?: AnalyticsIdentifier;
  sessionId?: string;
  seasonId?: string;

  mode?: GameMode;
  runPhase?: RunPhase;
  runOutcome?: RunOutcome;
  cord?: number;
  grade?: VerifiedGrade;
  integrityStatus?: IntegrityStatus;
  proofHash?: string;

  rulesetVersion?: string;
  contentVersion?: string;
  visibilityScope?: VisibilityScope;

  metadata?: AnalyticsMetadata;
  payload: TPayload;
}

export interface CreateAnalyticsEnvelopeInput<
  TEventName extends AnalyticsEventName = AnalyticsEventName,
  TPayload extends AnalyticsPayload = AnalyticsPayload,
> extends AnalyticsEnvelopeContext {
  eventName: TEventName;
  payload?: TPayload;
}

function normalizeEventId(value?: string): string {
  return value ? value.trim() : randomUUID();
}

export function createAnalyticsEnvelope<
  TEventName extends AnalyticsEventName,
  TPayload extends AnalyticsPayload = AnalyticsPayload,
>(
  input: CreateAnalyticsEnvelopeInput<TEventName, TPayload>,
): AnalyticsEnvelope<TEventName, TPayload> {
  const eventName = normalizeAnalyticsEventName(input.eventName);
  const { occurredAt, emittedAt } = normalizeOccurredAndEmittedAt({
    occurredAt: input.occurredAt,
    emittedAt: input.emittedAt,
  });

  const payload = (input.payload ?? EMPTY_ANALYTICS_PAYLOAD) as TPayload;
  const metadata = normalizeMetadata(input.metadata);

  const envelope: AnalyticsEnvelope<TEventName, TPayload> = {
    eventId: normalizeEventId(input.eventId),
    eventName: eventName as TEventName,
    schemaVersion: normalizeSchemaVersion(
      input.schemaVersion ?? ANALYTICS_SCHEMA_VERSION,
    ),
    occurredAt,
    emittedAt,
    source: normalizeAnalyticsSource(input.source ?? 'backend'),
    payload,
  };

  const correlationId = normalizeOptionalUuidish(
    input.correlationId,
    'correlationId',
  );
  const causationId = normalizeOptionalUuidish(
    input.causationId,
    'causationId',
  );
  const playerId = normalizeOptionalIdentifier(input.playerId, 'playerId');
  const gameInstanceId = normalizeOptionalIdentifier(
    input.gameInstanceId,
    'gameInstanceId',
  );
  const runId = normalizeOptionalIdentifier(input.runId, 'runId');
  const sessionId = input.sessionId?.trim() || undefined;
  const seasonId = input.seasonId?.trim() || undefined;
  const mode = normalizeOptionalGameMode(input.mode);
  const runPhase = normalizeOptionalRunPhase(input.runPhase);
  const runOutcome = normalizeOptionalRunOutcome(input.runOutcome);
  const cord = normalizeCord(input.cord);
  const grade = normalizeOptionalVerifiedGrade(input.grade);
  const integrityStatus = normalizeOptionalIntegrityStatus(
    input.integrityStatus,
  );
  const proofHash = normalizeOptionalProofHash(input.proofHash);
  const rulesetVersion = normalizeOptionalVersionToken(
    input.rulesetVersion,
    'rulesetVersion',
  );
  const contentVersion = normalizeOptionalVersionToken(
    input.contentVersion,
    'contentVersion',
  );
  const visibilityScope = normalizeOptionalVisibilityScope(
    input.visibilityScope,
  );

  if (correlationId !== undefined) {
    envelope.correlationId = correlationId;
  }

  if (causationId !== undefined) {
    envelope.causationId = causationId;
  }

  if (playerId !== undefined) {
    envelope.playerId = playerId;
  }

  if (gameInstanceId !== undefined) {
    envelope.gameInstanceId = gameInstanceId;
  }

  if (runId !== undefined) {
    envelope.runId = runId;
  }

  if (sessionId !== undefined) {
    envelope.sessionId = sessionId;
  }

  if (seasonId !== undefined) {
    envelope.seasonId = seasonId;
  }

  if (mode !== undefined) {
    envelope.mode = mode;
  }

  if (runPhase !== undefined) {
    envelope.runPhase = runPhase;
  }

  if (runOutcome !== undefined) {
    envelope.runOutcome = runOutcome;
  }

  if (cord !== undefined) {
    envelope.cord = cord;
  }

  if (grade !== undefined) {
    envelope.grade = grade;
  }

  if (integrityStatus !== undefined) {
    envelope.integrityStatus = integrityStatus;
  }

  if (proofHash !== undefined) {
    envelope.proofHash = proofHash;
  }

  if (rulesetVersion !== undefined) {
    envelope.rulesetVersion = rulesetVersion;
  }

  if (contentVersion !== undefined) {
    envelope.contentVersion = contentVersion;
  }

  if (visibilityScope !== undefined) {
    envelope.visibilityScope = visibilityScope;
  }

  if (metadata !== undefined) {
    envelope.metadata = metadata;
  }

  return envelope;
}

export function serializeAnalyticsEnvelope<
  TEventName extends AnalyticsEventName,
  TPayload extends AnalyticsPayload,
>(
  envelope: AnalyticsEnvelope<TEventName, TPayload>,
): Record<string, unknown> {
  return compactUndefined({
    eventId: envelope.eventId,
    eventName: envelope.eventName,
    schemaVersion: envelope.schemaVersion,
    occurredAt: envelope.occurredAt,
    emittedAt: envelope.emittedAt,
    source: envelope.source,
    correlationId: envelope.correlationId,
    causationId: envelope.causationId,
    playerId: envelope.playerId,
    gameInstanceId: envelope.gameInstanceId,
    runId: envelope.runId,
    sessionId: envelope.sessionId,
    seasonId: envelope.seasonId,
    mode: envelope.mode,
    runPhase: envelope.runPhase,
    runOutcome: envelope.runOutcome,
    cord: envelope.cord,
    grade: envelope.grade,
    integrityStatus: envelope.integrityStatus,
    proofHash: envelope.proofHash,
    rulesetVersion: envelope.rulesetVersion,
    contentVersion: envelope.contentVersion,
    visibilityScope: envelope.visibilityScope,
    metadata: envelope.metadata,
    payload: envelope.payload,
  });
}

export function withAnalyticsContext(
  defaults: AnalyticsEnvelopeContext,
) {
  return function buildWithContext<
    TEventName extends AnalyticsEventName,
    TPayload extends AnalyticsPayload = AnalyticsPayload,
  >(
    input: Omit<CreateAnalyticsEnvelopeInput<TEventName, TPayload>, keyof AnalyticsEnvelopeContext> &
      Partial<AnalyticsEnvelopeContext>,
  ): AnalyticsEnvelope<TEventName, TPayload> {
    return createAnalyticsEnvelope<TEventName, TPayload>({
      ...defaults,
      ...input,
    });
  };
}

export function createAnalyticsEnvelopeFactory<
  TEventName extends AnalyticsEventName,
  TPayload extends AnalyticsPayload = AnalyticsPayload,
>(
  eventName: TEventName,
  defaults: AnalyticsEnvelopeContext = {},
) {
  return function buildEnvelope(
    payload?: TPayload,
    context: AnalyticsEnvelopeContext = {},
  ): AnalyticsEnvelope<TEventName, TPayload> {
    return createAnalyticsEnvelope<TEventName, TPayload>({
      ...defaults,
      ...context,
      eventName,
      payload,
    });
  };
}

export function cloneAnalyticsEnvelope<
  TEventName extends AnalyticsEventName,
  TPayload extends AnalyticsPayload,
>(
  envelope: AnalyticsEnvelope<TEventName, TPayload>,
  overrides: Partial<CreateAnalyticsEnvelopeInput<TEventName, TPayload>> = {},
): AnalyticsEnvelope<TEventName, TPayload> {
  return createAnalyticsEnvelope<TEventName, TPayload>({
    eventId: envelope.eventId,
    eventName: envelope.eventName,
    schemaVersion: envelope.schemaVersion,
    occurredAt: envelope.occurredAt,
    emittedAt: envelope.emittedAt,
    source: envelope.source,
    correlationId: envelope.correlationId,
    causationId: envelope.causationId,
    playerId: envelope.playerId,
    gameInstanceId: envelope.gameInstanceId,
    runId: envelope.runId,
    sessionId: envelope.sessionId,
    seasonId: envelope.seasonId,
    mode: envelope.mode,
    runPhase: envelope.runPhase,
    runOutcome: envelope.runOutcome,
    cord: envelope.cord,
    grade: envelope.grade,
    integrityStatus: envelope.integrityStatus,
    proofHash: envelope.proofHash,
    rulesetVersion: envelope.rulesetVersion,
    contentVersion: envelope.contentVersion,
    visibilityScope: envelope.visibilityScope,
    metadata: envelope.metadata,
    payload: envelope.payload,
    ...overrides,
  });
}