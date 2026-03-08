// backend/src/analytics/events_season0.ts

/**
 * Point Zero One — Season 0 Analytics (Backend)
 *
 * Server-side Season 0 analytics contracts, factories, serializers, and emitters.
 * This file is intentionally backend-safe:
 * - no window usage
 * - no DOM globals
 * - safe for Node/Nest/worker execution
 * - easy to connect to logs, queues, telemetry, or event buses
 */

export const SEASON0_ANALYTICS_EVENTS = {
  SEASON0_JOINED: 'SEASON0_JOINED',
  ARTIFACT_GRANTED: 'ARTIFACT_GRANTED',
  MEMBERSHIP_SHARED: 'MEMBERSHIP_SHARED',
  PROOF_STAMPED: 'PROOF_STAMPED',
  INVITE_SENT: 'INVITE_SENT',
  INVITE_ACCEPTED: 'INVITE_ACCEPTED',
  REFERRAL_COMPLETED: 'REFERRAL_COMPLETED',
  STREAK_UPDATED: 'STREAK_UPDATED',
} as const;

export type Season0AnalyticsEventName =
  (typeof SEASON0_ANALYTICS_EVENTS)[keyof typeof SEASON0_ANALYTICS_EVENTS];

export type AnalyticsIdentifier = string | number;

export type AnalyticsSource =
  | 'web'
  | 'ios'
  | 'android'
  | 'backend'
  | 'worker'
  | 'cron'
  | 'unknown';

export type AnalyticsMetadataValue = string | number | boolean | null;
export type AnalyticsMetadata = Readonly<Record<string, AnalyticsMetadataValue>>;

export interface BaseSeason0AnalyticsEvent<
  TEvent extends Season0AnalyticsEventName,
> {
  event: TEvent;
  timestamp: number;
  season: 'SEASON_0';
  playerId?: AnalyticsIdentifier;
  gameInstanceId?: AnalyticsIdentifier;
  sessionId?: string;
  source?: AnalyticsSource;
  metadata?: AnalyticsMetadata;
}

export interface Season0JoinedEvent
  extends BaseSeason0AnalyticsEvent<'SEASON0_JOINED'> {}

export interface ArtifactGrantedEvent
  extends BaseSeason0AnalyticsEvent<'ARTIFACT_GRANTED'> {
  artifactId: AnalyticsIdentifier;
}

export interface MembershipSharedEvent
  extends BaseSeason0AnalyticsEvent<'MEMBERSHIP_SHARED'> {
  recipientPlayerId: AnalyticsIdentifier;
}

export interface ProofStampedEvent
  extends BaseSeason0AnalyticsEvent<'PROOF_STAMPED'> {
  proofId: AnalyticsIdentifier;
}

export interface InviteSentEvent
  extends BaseSeason0AnalyticsEvent<'INVITE_SENT'> {
  recipientPlayerId: AnalyticsIdentifier;
}

export interface InviteAcceptedEvent
  extends BaseSeason0AnalyticsEvent<'INVITE_ACCEPTED'> {
  inviterPlayerId: AnalyticsIdentifier;
}

export interface ReferralCompletedEvent
  extends BaseSeason0AnalyticsEvent<'REFERRAL_COMPLETED'> {
  referredPlayerId: AnalyticsIdentifier;
}

export interface StreakUpdatedEvent
  extends BaseSeason0AnalyticsEvent<'STREAK_UPDATED'> {
  newStreakLength: number;
}

export type Season0AnalyticsEvent =
  | Season0JoinedEvent
  | ArtifactGrantedEvent
  | MembershipSharedEvent
  | ProofStampedEvent
  | InviteSentEvent
  | InviteAcceptedEvent
  | ReferralCompletedEvent
  | StreakUpdatedEvent;

export interface Season0CommonInput {
  timestamp?: number;
  playerId?: AnalyticsIdentifier;
  gameInstanceId?: AnalyticsIdentifier;
  sessionId?: string;
  source?: AnalyticsSource;
  metadata?: AnalyticsMetadata;
}

export interface ArtifactGrantedInput extends Season0CommonInput {
  artifactId: AnalyticsIdentifier;
}

export interface MembershipSharedInput extends Season0CommonInput {
  recipientPlayerId: AnalyticsIdentifier;
}

export interface ProofStampedInput extends Season0CommonInput {
  proofId: AnalyticsIdentifier;
}

export interface InviteSentInput extends Season0CommonInput {
  recipientPlayerId: AnalyticsIdentifier;
}

export interface InviteAcceptedInput extends Season0CommonInput {
  inviterPlayerId: AnalyticsIdentifier;
}

export interface ReferralCompletedInput extends Season0CommonInput {
  referredPlayerId: AnalyticsIdentifier;
}

export interface StreakUpdatedInput extends Season0CommonInput {
  newStreakLength: number;
}

export interface Season0AnalyticsEmitter {
  emit(event: Season0AnalyticsEvent): void;
}

function normalizeTimestamp(value?: number): number {
  if (value === undefined) {
    return Date.now();
  }

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid analytics timestamp: ${String(value)}`);
  }

  return Math.floor(value);
}

function normalizeIdentifier(
  value?: AnalyticsIdentifier,
): AnalyticsIdentifier | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid analytics identifier number: ${String(value)}`);
    }

    return value;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error('Analytics identifier cannot be an empty string.');
  }

  return normalized;
}

function normalizeString(value?: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeMetadata(
  metadata?: AnalyticsMetadata,
): AnalyticsMetadata | undefined {
  if (!metadata) {
    return undefined;
  }

  const normalized: Record<string, AnalyticsMetadataValue> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      continue;
    }

    normalized[normalizedKey] = value;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function compactRecord(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      result[key] = entry;
    }
  }

  return result;
}

function buildBase<TEvent extends Season0AnalyticsEventName>(
  event: TEvent,
  input: Season0CommonInput = {},
): BaseSeason0AnalyticsEvent<TEvent> {
  const base: BaseSeason0AnalyticsEvent<TEvent> = {
    event,
    timestamp: normalizeTimestamp(input.timestamp),
    season: 'SEASON_0',
  };

  const playerId = normalizeIdentifier(input.playerId);
  const gameInstanceId = normalizeIdentifier(input.gameInstanceId);
  const sessionId = normalizeString(input.sessionId);
  const metadata = normalizeMetadata(input.metadata);

  if (playerId !== undefined) {
    base.playerId = playerId;
  }

  if (gameInstanceId !== undefined) {
    base.gameInstanceId = gameInstanceId;
  }

  if (sessionId !== undefined) {
    base.sessionId = sessionId;
  }

  if (input.source !== undefined) {
    base.source = input.source;
  }

  if (metadata !== undefined) {
    base.metadata = metadata;
  }

  return base;
}

export function serializeSeason0AnalyticsEvent(
  event: Season0AnalyticsEvent,
): Record<string, unknown> {
  return compactRecord({
    ...event,
  });
}

export function createSeason0JoinedEvent(
  input: Season0CommonInput = {},
): Season0JoinedEvent {
  return buildBase(SEASON0_ANALYTICS_EVENTS.SEASON0_JOINED, input);
}

export function createArtifactGrantedEvent(
  input: ArtifactGrantedInput,
): ArtifactGrantedEvent {
  const artifactId = normalizeIdentifier(input.artifactId);

  if (artifactId === undefined) {
    throw new Error('artifactId is required.');
  }

  return {
    ...buildBase(SEASON0_ANALYTICS_EVENTS.ARTIFACT_GRANTED, input),
    artifactId,
  };
}

export function createMembershipSharedEvent(
  input: MembershipSharedInput,
): MembershipSharedEvent {
  const recipientPlayerId = normalizeIdentifier(input.recipientPlayerId);

  if (recipientPlayerId === undefined) {
    throw new Error('recipientPlayerId is required.');
  }

  return {
    ...buildBase(SEASON0_ANALYTICS_EVENTS.MEMBERSHIP_SHARED, input),
    recipientPlayerId,
  };
}

export function createProofStampedEvent(
  input: ProofStampedInput,
): ProofStampedEvent {
  const proofId = normalizeIdentifier(input.proofId);

  if (proofId === undefined) {
    throw new Error('proofId is required.');
  }

  return {
    ...buildBase(SEASON0_ANALYTICS_EVENTS.PROOF_STAMPED, input),
    proofId,
  };
}

export function createInviteSentEvent(
  input: InviteSentInput,
): InviteSentEvent {
  const recipientPlayerId = normalizeIdentifier(input.recipientPlayerId);

  if (recipientPlayerId === undefined) {
    throw new Error('recipientPlayerId is required.');
  }

  return {
    ...buildBase(SEASON0_ANALYTICS_EVENTS.INVITE_SENT, input),
    recipientPlayerId,
  };
}

export function createInviteAcceptedEvent(
  input: InviteAcceptedInput,
): InviteAcceptedEvent {
  const inviterPlayerId = normalizeIdentifier(input.inviterPlayerId);

  if (inviterPlayerId === undefined) {
    throw new Error('inviterPlayerId is required.');
  }

  return {
    ...buildBase(SEASON0_ANALYTICS_EVENTS.INVITE_ACCEPTED, input),
    inviterPlayerId,
  };
}

export function createReferralCompletedEvent(
  input: ReferralCompletedInput,
): ReferralCompletedEvent {
  const referredPlayerId = normalizeIdentifier(input.referredPlayerId);

  if (referredPlayerId === undefined) {
    throw new Error('referredPlayerId is required.');
  }

  return {
    ...buildBase(SEASON0_ANALYTICS_EVENTS.REFERRAL_COMPLETED, input),
    referredPlayerId,
  };
}

export function createStreakUpdatedEvent(
  input: StreakUpdatedInput,
): StreakUpdatedEvent {
  if (!Number.isFinite(input.newStreakLength) || input.newStreakLength < 0) {
    throw new Error(
      `Invalid newStreakLength: ${String(input.newStreakLength)}`,
    );
  }

  return {
    ...buildBase(SEASON0_ANALYTICS_EVENTS.STREAK_UPDATED, input),
    newStreakLength: Math.floor(input.newStreakLength),
  };
}

export class NoopSeason0AnalyticsEmitter
  implements Season0AnalyticsEmitter
{
  emit(_event: Season0AnalyticsEvent): void {}
}

export class MemorySeason0AnalyticsEmitter
  implements Season0AnalyticsEmitter
{
  private readonly events: Season0AnalyticsEvent[] = [];

  emit(event: Season0AnalyticsEvent): void {
    this.events.push({ ...event });
  }

  snapshot(): ReadonlyArray<Season0AnalyticsEvent> {
    return this.events.map((event) => ({ ...event }));
  }

  clear(): void {
    this.events.length = 0;
  }
}

export class ConsoleSeason0AnalyticsEmitter
  implements Season0AnalyticsEmitter
{
  constructor(
    private readonly logger: Pick<Console, 'info'> = console,
    private readonly prefix: string = '[Season0Analytics]',
  ) {}

  emit(event: Season0AnalyticsEvent): void {
    this.logger.info(this.prefix, serializeSeason0AnalyticsEvent(event));
  }
}

export function emitSeason0AnalyticsEvent(
  emitter: Season0AnalyticsEmitter,
  event: Season0AnalyticsEvent,
): Season0AnalyticsEvent {
  emitter.emit(event);
  return event;
}

export class Season0AnalyticsService {
  constructor(
    private readonly emitter: Season0AnalyticsEmitter = new NoopSeason0AnalyticsEmitter(),
  ) {}

  emit(event: Season0AnalyticsEvent): Season0AnalyticsEvent {
    return emitSeason0AnalyticsEvent(this.emitter, event);
  }

  season0Joined(input: Season0CommonInput = {}): Season0JoinedEvent {
    const event = createSeason0JoinedEvent(input);
    this.emit(event);
    return event;
  }

  artifactGranted(input: ArtifactGrantedInput): ArtifactGrantedEvent {
    const event = createArtifactGrantedEvent(input);
    this.emit(event);
    return event;
  }

  membershipShared(input: MembershipSharedInput): MembershipSharedEvent {
    const event = createMembershipSharedEvent(input);
    this.emit(event);
    return event;
  }

  proofStamped(input: ProofStampedInput): ProofStampedEvent {
    const event = createProofStampedEvent(input);
    this.emit(event);
    return event;
  }

  inviteSent(input: InviteSentInput): InviteSentEvent {
    const event = createInviteSentEvent(input);
    this.emit(event);
    return event;
  }

  inviteAccepted(input: InviteAcceptedInput): InviteAcceptedEvent {
    const event = createInviteAcceptedEvent(input);
    this.emit(event);
    return event;
  }

  referralCompleted(
    input: ReferralCompletedInput,
  ): ReferralCompletedEvent {
    const event = createReferralCompletedEvent(input);
    this.emit(event);
    return event;
  }

  streakUpdated(input: StreakUpdatedInput): StreakUpdatedEvent {
    const event = createStreakUpdatedEvent(input);
    this.emit(event);
    return event;
  }
}