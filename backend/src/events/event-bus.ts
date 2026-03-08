/**
 * EventBus — Typed event emitter for domain events.
 * Wraps Season 0 analytics-style events and deployment lifecycle receipts
 * behind a single async emit() entry point consumed by route handlers,
 * services, and deployment orchestration.
 *
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/events/event-bus.ts
 */

export type Season0EventName =
  | 'SEASON0_JOINED'
  | 'ARTIFACT_GRANTED'
  | 'MEMBERSHIP_SHARED'
  | 'PROOF_STAMPED'
  | 'INVITE_SENT'
  | 'INVITE_ACCEPTED'
  | 'REFERRAL_COMPLETED'
  | 'STREAK_UPDATED';

export type DeploymentEventName = 'DEPLOYMENT_RECEIPT';

export type DomainEventName = Season0EventName | DeploymentEventName;

export interface Season0JoinedPayload {
  playerId: string;
  waitlistPosition: number;
  foundingEraPass: unknown;
  referralCode: string | null;
  timestamp: string;
}

export interface ArtifactGrantedPayload {
  playerId: string;
  artifactId: string;
  timestamp: string;
}

export interface MembershipSharedPayload {
  fromPlayerId: string;
  toPlayerId: string;
  timestamp: string;
}

export interface ProofStampedPayload {
  playerId: string;
  proofId: string;
  timestamp: string;
}

export interface InviteSentPayload {
  fromPlayerId: string;
  toPlayerId: string;
  timestamp: string;
}

export interface InviteAcceptedPayload {
  inviterPlayerId: string;
  newPlayerId: string;
  timestamp: string;
}

export interface ReferralCompletedPayload {
  referrerPlayerId: string;
  referredPlayerId: string;
  timestamp: string;
}

export interface StreakUpdatedPayload {
  playerId: string;
  newStreakLength: number;
  timestamp: string;
}

export type DeploymentLifecycleStatus = 'in_progress' | 'completed' | 'failed';

export type DeploymentStepName =
  | 'migrations'
  | 'remote_config'
  | 'cdn_invalidation'
  | 'deployment_receipt';

export type DeploymentStepStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed';

export interface DeploymentStepReceiptPayload {
  step: DeploymentStepName;
  status: DeploymentStepStatus;
  attempt: number;
  startedAt: string | null;
  finishedAt: string | null;
  details?: Record<string, unknown>;
  errorName?: string | null;
  errorMessage?: string | null;
}

export interface DeploymentReceiptPayload {
  deploymentId: string;
  idempotencyKey: string;
  actorId: string | null;
  environment: string;
  status: DeploymentLifecycleStatus;
  startedAt: string;
  finishedAt: string | null;
  canaryPercent: number | null;
  metadata: Record<string, unknown>;
  stepReceipts: DeploymentStepReceiptPayload[];
  timestamp: string;
}

export type EventPayloadMap = {
  SEASON0_JOINED: Season0JoinedPayload;
  ARTIFACT_GRANTED: ArtifactGrantedPayload;
  MEMBERSHIP_SHARED: MembershipSharedPayload;
  PROOF_STAMPED: ProofStampedPayload;
  INVITE_SENT: InviteSentPayload;
  INVITE_ACCEPTED: InviteAcceptedPayload;
  REFERRAL_COMPLETED: ReferralCompletedPayload;
  STREAK_UPDATED: StreakUpdatedPayload;
  DEPLOYMENT_RECEIPT: DeploymentReceiptPayload;
};

export interface EventEnvelope<K extends DomainEventName = DomainEventName> {
  event: K;
  payload: EventPayloadMap[K];
  timestamp: string;
  source: string;
  actorId?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface EventEmitOptions {
  source?: string;
  actorId?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface EventDispatchReceipt<K extends DomainEventName = DomainEventName> {
  event: K;
  accepted: boolean;
  timestamp: string;
  localHandlerCount: number;
  localSuccessCount: number;
  localFailureCount: number;
  publishedExternally: boolean;
  validationError?: string;
  publisherError?: string;
}

export interface EventBusLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface ExternalEventPublisher {
  publish<K extends DomainEventName>(envelope: EventEnvelope<K>): Promise<void>;
}

type InternalHandler = (
  payload: unknown,
  envelope: EventEnvelope,
) => Promise<void> | void;

class ConsoleEventBusLogger implements EventBusLogger {
  public info(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      console.info(message, meta);
      return;
    }

    console.info(message);
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      console.warn(message, meta);
      return;
    }

    console.warn(message);
  }

  public error(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      console.error(message, meta);
      return;
    }

    console.error(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidIsoDateString(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return false;
  }

  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function requireNonEmptyString(
  value: unknown,
  fieldName: string,
  errors: string[],
): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(`${fieldName} must be a non-empty string`);
  }
}

function requireFiniteNumber(
  value: unknown,
  fieldName: string,
  errors: string[],
): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${fieldName} must be a finite number`);
  }
}

function requireIsoDateString(
  value: unknown,
  fieldName: string,
  errors: string[],
): void {
  if (!isValidIsoDateString(value)) {
    errors.push(`${fieldName} must be a valid ISO date string`);
  }
}

function validateSeason0JoinedPayload(
  payload: Season0JoinedPayload,
  errors: string[],
): void {
  requireNonEmptyString(payload.playerId, 'playerId', errors);
  requireFiniteNumber(payload.waitlistPosition, 'waitlistPosition', errors);
  requireIsoDateString(payload.timestamp, 'timestamp', errors);

  if (
    payload.referralCode !== null &&
    payload.referralCode !== undefined &&
    typeof payload.referralCode !== 'string'
  ) {
    errors.push('referralCode must be a string or null');
  }
}

function validateArtifactGrantedPayload(
  payload: ArtifactGrantedPayload,
  errors: string[],
): void {
  requireNonEmptyString(payload.playerId, 'playerId', errors);
  requireNonEmptyString(payload.artifactId, 'artifactId', errors);
  requireIsoDateString(payload.timestamp, 'timestamp', errors);
}

function validateMembershipSharedPayload(
  payload: MembershipSharedPayload,
  errors: string[],
): void {
  requireNonEmptyString(payload.fromPlayerId, 'fromPlayerId', errors);
  requireNonEmptyString(payload.toPlayerId, 'toPlayerId', errors);
  requireIsoDateString(payload.timestamp, 'timestamp', errors);
}

function validateProofStampedPayload(
  payload: ProofStampedPayload,
  errors: string[],
): void {
  requireNonEmptyString(payload.playerId, 'playerId', errors);
  requireNonEmptyString(payload.proofId, 'proofId', errors);
  requireIsoDateString(payload.timestamp, 'timestamp', errors);
}

function validateInviteSentPayload(
  payload: InviteSentPayload,
  errors: string[],
): void {
  requireNonEmptyString(payload.fromPlayerId, 'fromPlayerId', errors);
  requireNonEmptyString(payload.toPlayerId, 'toPlayerId', errors);
  requireIsoDateString(payload.timestamp, 'timestamp', errors);
}

function validateInviteAcceptedPayload(
  payload: InviteAcceptedPayload,
  errors: string[],
): void {
  requireNonEmptyString(payload.inviterPlayerId, 'inviterPlayerId', errors);
  requireNonEmptyString(payload.newPlayerId, 'newPlayerId', errors);
  requireIsoDateString(payload.timestamp, 'timestamp', errors);
}

function validateReferralCompletedPayload(
  payload: ReferralCompletedPayload,
  errors: string[],
): void {
  requireNonEmptyString(payload.referrerPlayerId, 'referrerPlayerId', errors);
  requireNonEmptyString(payload.referredPlayerId, 'referredPlayerId', errors);
  requireIsoDateString(payload.timestamp, 'timestamp', errors);
}

function validateStreakUpdatedPayload(
  payload: StreakUpdatedPayload,
  errors: string[],
): void {
  requireNonEmptyString(payload.playerId, 'playerId', errors);
  requireFiniteNumber(payload.newStreakLength, 'newStreakLength', errors);
  requireIsoDateString(payload.timestamp, 'timestamp', errors);
}

function validateDeploymentStepReceiptPayload(
  payload: DeploymentStepReceiptPayload,
  errors: string[],
  index: number,
): void {
  requireNonEmptyString(payload.step, `stepReceipts[${index}].step`, errors);
  requireNonEmptyString(payload.status, `stepReceipts[${index}].status`, errors);

  if (!Number.isInteger(payload.attempt) || payload.attempt < 1) {
    errors.push(`stepReceipts[${index}].attempt must be an integer >= 1`);
  }

  if (
    payload.startedAt !== null &&
    payload.startedAt !== undefined &&
    !isValidIsoDateString(payload.startedAt)
  ) {
    errors.push(`stepReceipts[${index}].startedAt must be a valid ISO date string or null`);
  }

  if (
    payload.finishedAt !== null &&
    payload.finishedAt !== undefined &&
    !isValidIsoDateString(payload.finishedAt)
  ) {
    errors.push(`stepReceipts[${index}].finishedAt must be a valid ISO date string or null`);
  }

  if (payload.details !== undefined && !isRecord(payload.details)) {
    errors.push(`stepReceipts[${index}].details must be an object when provided`);
  }
}

function validateDeploymentReceiptPayload(
  payload: DeploymentReceiptPayload,
  errors: string[],
): void {
  requireNonEmptyString(payload.deploymentId, 'deploymentId', errors);
  requireNonEmptyString(payload.idempotencyKey, 'idempotencyKey', errors);
  requireNonEmptyString(payload.environment, 'environment', errors);
  requireNonEmptyString(payload.status, 'status', errors);
  requireIsoDateString(payload.startedAt, 'startedAt', errors);
  requireIsoDateString(payload.timestamp, 'timestamp', errors);

  if (
    payload.finishedAt !== null &&
    payload.finishedAt !== undefined &&
    !isValidIsoDateString(payload.finishedAt)
  ) {
    errors.push('finishedAt must be a valid ISO date string or null');
  }

  if (
    payload.canaryPercent !== null &&
    payload.canaryPercent !== undefined &&
    (!Number.isFinite(payload.canaryPercent) ||
      payload.canaryPercent < 0 ||
      payload.canaryPercent > 100)
  ) {
    errors.push('canaryPercent must be null or a number between 0 and 100');
  }

  if (!isRecord(payload.metadata)) {
    errors.push('metadata must be an object');
  }

  if (!Array.isArray(payload.stepReceipts)) {
    errors.push('stepReceipts must be an array');
    return;
  }

  payload.stepReceipts.forEach((stepReceipt, index) => {
    validateDeploymentStepReceiptPayload(stepReceipt, errors, index);
  });
}

function validatePayload<K extends DomainEventName>(
  event: K,
  payload: EventPayloadMap[K],
): string[] {
  const errors: string[] = [];

  if (!isRecord(payload)) {
    errors.push('payload must be an object');
    return errors;
  }

  switch (event) {
    case 'SEASON0_JOINED':
      validateSeason0JoinedPayload(payload as Season0JoinedPayload, errors);
      break;
    case 'ARTIFACT_GRANTED':
      validateArtifactGrantedPayload(payload as ArtifactGrantedPayload, errors);
      break;
    case 'MEMBERSHIP_SHARED':
      validateMembershipSharedPayload(payload as MembershipSharedPayload, errors);
      break;
    case 'PROOF_STAMPED':
      validateProofStampedPayload(payload as ProofStampedPayload, errors);
      break;
    case 'INVITE_SENT':
      validateInviteSentPayload(payload as InviteSentPayload, errors);
      break;
    case 'INVITE_ACCEPTED':
      validateInviteAcceptedPayload(payload as InviteAcceptedPayload, errors);
      break;
    case 'REFERRAL_COMPLETED':
      validateReferralCompletedPayload(payload as ReferralCompletedPayload, errors);
      break;
    case 'STREAK_UPDATED':
      validateStreakUpdatedPayload(payload as StreakUpdatedPayload, errors);
      break;
    case 'DEPLOYMENT_RECEIPT':
      validateDeploymentReceiptPayload(payload as DeploymentReceiptPayload, errors);
      break;
    default:
      errors.push(`unsupported event type: ${String(event)}`);
      break;
  }

  return errors;
}

export class EventBusClass {
  private readonly listeners = new Map<DomainEventName, Set<InternalHandler>>();
  private publisher: ExternalEventPublisher | null = null;
  private readonly logger: EventBusLogger;

  constructor(logger: EventBusLogger = new ConsoleEventBusLogger()) {
    this.logger = logger;
  }

  public setPublisher(publisher: ExternalEventPublisher | null): void {
    this.publisher = publisher;
  }

  public on<K extends DomainEventName>(
    event: K,
    handler: (
      payload: EventPayloadMap[K],
      envelope: EventEnvelope<K>,
    ) => Promise<void> | void,
  ): () => void {
    const existing = this.listeners.get(event) ?? new Set<InternalHandler>();
    existing.add(handler as InternalHandler);
    this.listeners.set(event, existing);

    return () => {
      this.off(event, handler);
    };
  }

  public once<K extends DomainEventName>(
    event: K,
    handler: (
      payload: EventPayloadMap[K],
      envelope: EventEnvelope<K>,
    ) => Promise<void> | void,
  ): () => void {
    const unsubscribe = this.on(event, async (payload, envelope) => {
      unsubscribe();
      await handler(payload, envelope);
    });

    return unsubscribe;
  }

  public off<K extends DomainEventName>(
    event: K,
    handler: (
      payload: EventPayloadMap[K],
      envelope: EventEnvelope<K>,
    ) => Promise<void> | void,
  ): void {
    const existing = this.listeners.get(event);
    if (!existing) {
      return;
    }

    existing.delete(handler as InternalHandler);

    if (existing.size === 0) {
      this.listeners.delete(event);
    }
  }

  public listenerCount(event?: DomainEventName): number {
    if (event) {
      return this.listeners.get(event)?.size ?? 0;
    }

    let total = 0;
    for (const handlers of this.listeners.values()) {
      total += handlers.size;
    }
    return total;
  }

  public clear(event?: DomainEventName): void {
    if (event) {
      this.listeners.delete(event);
      return;
    }

    this.listeners.clear();
  }

  public async emit<K extends DomainEventName>(
    event: K,
    payload: EventPayloadMap[K],
    options: EventEmitOptions = {},
  ): Promise<EventDispatchReceipt<K>> {
    const timestamp = new Date().toISOString();
    const envelope: EventEnvelope<K> = {
      event,
      payload,
      timestamp,
      source: options.source ?? 'backend',
      actorId: options.actorId,
      correlationId: options.correlationId,
      metadata: { ...(options.metadata ?? {}) },
    };

    const validationErrors = validatePayload(event, payload);

    if (validationErrors.length > 0) {
      const validationError = validationErrors.join('; ');

      this.logger.error('[EventBus] payload validation failed', {
        event,
        validationError,
      });

      return {
        event,
        accepted: false,
        timestamp,
        localHandlerCount: 0,
        localSuccessCount: 0,
        localFailureCount: 0,
        publishedExternally: false,
        validationError,
      };
    }

    const handlers = [...(this.listeners.get(event) ?? new Set<InternalHandler>())];

    let localSuccessCount = 0;
    let localFailureCount = 0;

    const localResults = await Promise.allSettled(
      handlers.map(async (handler) => {
        await handler(payload, envelope as EventEnvelope);
      }),
    );

    for (const result of localResults) {
      if (result.status === 'fulfilled') {
        localSuccessCount += 1;
        continue;
      }

      localFailureCount += 1;
      this.logger.error('[EventBus] handler error', {
        event,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      });
    }

    let publishedExternally = false;
    let publisherError: string | undefined;

    if (this.publisher) {
      try {
        await this.publisher.publish(envelope);
        publishedExternally = true;
      } catch (error) {
        publisherError =
          error instanceof Error ? error.message : String(error);

        this.logger.error('[EventBus] external publish failed', {
          event,
          publisherError,
        });
      }
    }

    if (process.env.NODE_ENV !== 'test') {
      this.logger.info('[EventBus] dispatched', {
        event,
        timestamp,
        source: envelope.source,
        localHandlerCount: handlers.length,
        localSuccessCount,
        localFailureCount,
        publishedExternally,
      });
    }

    return {
      event,
      accepted: true,
      timestamp,
      localHandlerCount: handlers.length,
      localSuccessCount,
      localFailureCount,
      publishedExternally,
      publisherError,
    };
  }

  public async emitMany(
    events: Array<{
      event: DomainEventName;
      payload: EventPayloadMap[DomainEventName];
      options?: EventEmitOptions;
    }>,
  ): Promise<Array<EventDispatchReceipt<DomainEventName>>> {
    const receipts: Array<EventDispatchReceipt<DomainEventName>> = [];

    for (const item of events) {
      receipts.push(
        await this.emit(
          item.event,
          item.payload,
          item.options,
        ),
      );
    }

    return receipts;
  }
}

export const EventBus = new EventBusClass();
export default EventBus;