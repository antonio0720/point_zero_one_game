// frontend/packages/analytics/events/season0.ts

/**
 * Point Zero One — Season 0 Analytics
 *
 * Strongly typed Season 0 analytics contracts, factories, and emit helpers.
 * Safe for browser use, SSR-safe, and easy to mock in tests.
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

export interface Season0AnalyticsSink {
  emit(
    eventName: Season0AnalyticsEventName,
    payload: Record<string, unknown>,
  ): void;
}

interface BrowserAnalyticsSurface {
  track?: (eventName: string, payload?: Record<string, unknown>) => void;
  emit?: (eventName: string, payload?: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    analytics?: BrowserAnalyticsSurface;
  }
}

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

function serializeSeason0AnalyticsEvent(
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
  return {
    ...buildBase(SEASON0_ANALYTICS_EVENTS.ARTIFACT_GRANTED, input),
    artifactId: normalizeIdentifier(input.artifactId)!,
  };
}

export function createMembershipSharedEvent(
  input: MembershipSharedInput,
): MembershipSharedEvent {
  return {
    ...buildBase(SEASON0_ANALYTICS_EVENTS.MEMBERSHIP_SHARED, input),
    recipientPlayerId: normalizeIdentifier(input.recipientPlayerId)!,
  };
}

export function createProofStampedEvent(
  input: ProofStampedInput,
): ProofStampedEvent {
  return {
    ...buildBase(SEASON0_ANALYTICS_EVENTS.PROOF_STAMPED, input),
    proofId: normalizeIdentifier(input.proofId)!,
  };
}

export function createInviteSentEvent(
  input: InviteSentInput,
): InviteSentEvent {
  return {
    ...buildBase(SEASON0_ANALYTICS_EVENTS.INVITE_SENT, input),
    recipientPlayerId: normalizeIdentifier(input.recipientPlayerId)!,
  };
}

export function createInviteAcceptedEvent(
  input: InviteAcceptedInput,
): InviteAcceptedEvent {
  return {
    ...buildBase(SEASON0_ANALYTICS_EVENTS.INVITE_ACCEPTED, input),
    inviterPlayerId: normalizeIdentifier(input.inviterPlayerId)!,
  };
}

export function createReferralCompletedEvent(
  input: ReferralCompletedInput,
): ReferralCompletedEvent {
  return {
    ...buildBase(SEASON0_ANALYTICS_EVENTS.REFERRAL_COMPLETED, input),
    referredPlayerId: normalizeIdentifier(input.referredPlayerId)!,
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

export class BrowserSeason0AnalyticsSink implements Season0AnalyticsSink {
  emit(
    eventName: Season0AnalyticsEventName,
    payload: Record<string, unknown>,
  ): void {
    if (typeof window === 'undefined') {
      return;
    }

    const analytics = window.analytics;
    if (!analytics) {
      return;
    }

    if (typeof analytics.track === 'function') {
      analytics.track(eventName, payload);
      return;
    }

    if (typeof analytics.emit === 'function') {
      analytics.emit(eventName, payload);
    }
  }
}

export class MemorySeason0AnalyticsSink implements Season0AnalyticsSink {
  private readonly entries: Array<{
    eventName: Season0AnalyticsEventName;
    payload: Record<string, unknown>;
  }> = [];

  emit(
    eventName: Season0AnalyticsEventName,
    payload: Record<string, unknown>,
  ): void {
    this.entries.push({
      eventName,
      payload: { ...payload },
    });
  }

  snapshot(): ReadonlyArray<{
    eventName: Season0AnalyticsEventName;
    payload: Record<string, unknown>;
  }> {
    return this.entries.map((entry) => ({
      eventName: entry.eventName,
      payload: { ...entry.payload },
    }));
  }

  clear(): void {
    this.entries.length = 0;
  }
}

const DEFAULT_SEASON0_ANALYTICS_SINK = new BrowserSeason0AnalyticsSink();

export function emitSeason0AnalyticsEvent(
  event: Season0AnalyticsEvent,
  sink: Season0AnalyticsSink = DEFAULT_SEASON0_ANALYTICS_SINK,
): Season0AnalyticsEvent {
  sink.emit(event.event, serializeSeason0AnalyticsEvent(event));
  return event;
}

export class Season0AnalyticsClient {
  constructor(
    private readonly sink: Season0AnalyticsSink = DEFAULT_SEASON0_ANALYTICS_SINK,
  ) {}

  emit(event: Season0AnalyticsEvent): Season0AnalyticsEvent {
    return emitSeason0AnalyticsEvent(event, this.sink);
  }

  trackSeason0Joined(input: Season0CommonInput = {}): Season0JoinedEvent {
    const event = createSeason0JoinedEvent(input);
    this.emit(event);
    return event;
  }

  trackArtifactGranted(input: ArtifactGrantedInput): ArtifactGrantedEvent {
    const event = createArtifactGrantedEvent(input);
    this.emit(event);
    return event;
  }

  trackMembershipShared(input: MembershipSharedInput): MembershipSharedEvent {
    const event = createMembershipSharedEvent(input);
    this.emit(event);
    return event;
  }

  trackProofStamped(input: ProofStampedInput): ProofStampedEvent {
    const event = createProofStampedEvent(input);
    this.emit(event);
    return event;
  }

  trackInviteSent(input: InviteSentInput): InviteSentEvent {
    const event = createInviteSentEvent(input);
    this.emit(event);
    return event;
  }

  trackInviteAccepted(input: InviteAcceptedInput): InviteAcceptedEvent {
    const event = createInviteAcceptedEvent(input);
    this.emit(event);
    return event;
  }

  trackReferralCompleted(
    input: ReferralCompletedInput,
  ): ReferralCompletedEvent {
    const event = createReferralCompletedEvent(input);
    this.emit(event);
    return event;
  }

  trackStreakUpdated(input: StreakUpdatedInput): StreakUpdatedEvent {
    const event = createStreakUpdatedEvent(input);
    this.emit(event);
    return event;
  }
}