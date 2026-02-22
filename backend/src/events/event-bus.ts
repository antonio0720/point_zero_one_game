/**
 * EventBus — Typed event emitter for Season 0 domain events.
 * Wraps the analytics event declarations in src/analytics/events_season0.ts
 * and provides a single async emit() entry point consumed by route handlers.
 *
 * Extend the EventMap union as new events are added.
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

export interface Season0JoinedPayload {
  playerId: string;
  waitlistPosition: number;
  foundingEraPass: unknown;
  referralCode: string | null;
  timestamp: string;
}

type EventPayloadMap = {
  SEASON0_JOINED: Season0JoinedPayload;
  ARTIFACT_GRANTED: { playerId: string; artifactId: string; timestamp: string };
  MEMBERSHIP_SHARED: { fromPlayerId: string; toPlayerId: string; timestamp: string };
  PROOF_STAMPED: { playerId: string; proofId: string; timestamp: string };
  INVITE_SENT: { fromPlayerId: string; toPlayerId: string; timestamp: string };
  INVITE_ACCEPTED: { inviterPlayerId: string; newPlayerId: string; timestamp: string };
  REFERRAL_COMPLETED: { referrerPlayerId: string; referredPlayerId: string; timestamp: string };
  STREAK_UPDATED: { playerId: string; newStreakLength: number; timestamp: string };
};

class EventBusClass {
  private readonly listeners = new Map<string, Array<(payload: unknown) => Promise<void>>>();

  /**
   * Emit a typed domain event. Fire-and-forget: errors are caught and logged,
   * never thrown back to the calling route handler.
   */
  async emit<K extends Season0EventName>(
    event: K,
    payload: EventPayloadMap[K]
  ): Promise<void> {
    const handlers = this.listeners.get(event) ?? [];
    await Promise.allSettled(
      handlers.map(h =>
        h(payload).catch(err =>
          console.error(`[EventBus] handler error for ${event}:`, err)
        )
      )
    );
    // In production this publishes to Kafka topic via EventConsumer infrastructure.
    // For now, log so the pipeline is observable.
    if (process.env.NODE_ENV !== 'test') {
      console.info(`[EventBus] ${event}`, JSON.stringify(payload));
    }
  }

  on<K extends Season0EventName>(
    event: K,
    handler: (payload: EventPayloadMap[K]) => Promise<void>
  ): void {
    const existing = this.listeners.get(event) ?? [];
    existing.push(handler as (payload: unknown) => Promise<void>);
    this.listeners.set(event, existing);
  }
}

export const EventBus = new EventBusClass();
