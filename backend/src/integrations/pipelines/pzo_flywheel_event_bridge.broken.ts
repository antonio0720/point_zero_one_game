/**
 * PZO Flywheel Event Bridge
 */

import { LadderEligibleEvent, Season0ArtifactMintedEvent, HostMomentCapturedEvent, CreatorSubmissionAcceptedEvent } from '@pzo/events';
import { FlywheelMilestone } from './flywheel-milestone.model';

/**
 * Correlates events and emits a single FlywheelMilestone event.
 */
export class PZOFlywheelEventBridge {
  private readonly _eventStore: Map<string, Event[]>;

  constructor() {
    this._eventStore = new Map();
  }

  /**
   * Store an event in the event store.
   * @param eventId - The unique identifier for the event.
   * @param event - The event to be stored.
   */
  public storeEvent(eventId: string, event: Event): void {
    const events = this._eventStore.get(eventId) || [];
    events.push(event);
    this._eventStore.set(eventId, events);
  }

  /**
   * Emit a FlywheelMilestone event if the required events have been received.
   * @returns A FlywheelMilestone event if one can be emitted, otherwise null.
   */
  public emitFlywheelMilestone(): FlywheelMilestone | null {
    const proofStampedEvents = this._eventStore.get('ProofStamped');
    const ladderEligibleEvents = this._eventStore.get('LadderEligible');
    const season0ArtifactMintedEvents = this._eventStore.get('Season0ArtifactMinted');
    const hostMomentCapturedEvents = this._eventStore.get('HostMomentCaptured');
    const creatorSubmissionAcceptedEvents = this._eventStore.get('CreatorSubmissionAccepted');

    if (
      proofStampedEvents &&
      ladderEligibleEvents &&
      season0ArtifactMintedEvents &&
      hostMomentCapturedEvents &&
      creatorSubmissionAcceptedEvents
    ) {
      const proofStamped = proofStampedEvents[proofStampedEvents.length - 1] as ProofStampedEvent;
      const ladderEligible = ladderEligibleEvents[ladderEligibleEvents.length - 1] as LadderEligibleEvent;
      const season0ArtifactMinted = season0ArtifactMintedEvents[season0ArtifactMintedEvents.length - 1] as Season0ArtifactMintedEvent;
      const hostMomentCaptured = hostMomentCapturedEvents[hostMomentCapturedEvents.length - 1] as HostMomentCapturedEvent;
      const creatorSubmissionAccepted = creatorSubmissionAcceptedEvents[creatorSubmissionAcceptedEvents.length - 1] as CreatorSubmissionAcceptedEvent;

      return new FlywheelMilestone(
        proofStamped.timestamp,
        ladderEligible.timestamp,
        season0ArtifactMinted.timestamp,
        hostMomentCaptured.timestamp,
        creatorSubmissionAccepted.timestamp
      );
    }

    return null;
  }
}

/**
 * Base event class for all game events.
 */
export abstract class Event {
  public readonly timestamp: number;

  constructor(timestamp: number) {
    this.timestamp = timestamp;
  }
}

/**
 * ProofStampedEvent represents an event where a proof has been stamped.
 */
export class ProofStampedEvent extends Event {}

/**
 * LadderEligibleEvent represents an event where a player becomes eligible for the ladder.
 */
export class LadderEligibleEvent extends Event {}

/**
 * Season0ArtifactMintedEvent represents an event where a season 0 artifact has been minted.
 */
export class Season0ArtifactMintedEvent extends Event {}

/**
 * HostMomentCapturedEvent represents an event where a host moment has been captured.
 */
export class HostMomentCapturedEvent extends Event {}

/**
 * CreatorSubmissionAcceptedEvent represents an event where a creator's submission has been accepted.
 */
export class CreatorSubmissionAcceptedEvent extends Event {}

/**
 * FlywheelMilestone represents a milestone in the game's flywheel process.
 */
export class FlywheelMilestone {
  public readonly proofStampedTimestamp: number;
  public readonly ladderEligibleTimestamp: number;
  public readonly season0ArtifactMintedTimestamp: number;
  public readonly hostMomentCapturedTimestamp: number;
  public readonly creatorSubmissionAcceptedTimestamp: number;

  constructor(
    proofStampedTimestamp: number,
    ladderEligibleTimestamp: number,
    season0ArtifactMintedTimestamp: number,
    hostMomentCapturedTimestamp: number,
    creatorSubmissionAcceptedTimestamp: number
  ) {
    this.proofStampedTimestamp = proofStampedTimestamp;
    this.ladderEligibleTimestamp = ladderEligibleTimestamp;
    this.season0ArtifactMintedTimestamp = season0ArtifactMintedTimestamp;
    this.hostMomentCapturedTimestamp = hostMomentCapturedTimestamp;
    this.creatorSubmissionAcceptedTimestamp = creatorSubmissionAcceptedTimestamp;
  }
}
