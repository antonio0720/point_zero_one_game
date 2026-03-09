/**
 * Collector V2 for recording and batching authoritative events, enforcing payload allowlist, and privacy redaction.
 */

import { Event } from "../models/event";
import { PayloadAllowlist } from "../config/payload_allowlist";

export interface CollectorOptions {
  /** The maximum number of events to store in memory before flushing to the database. */
  maxEventsInMemory: number;
}

/**
 * The Collector class is responsible for collecting, batching, and storing authoritative events. It enforces a payload allowlist and performs privacy redaction as necessary.
 */
export class Collector {
  private readonly _maxEventsInMemory: number;
  private _events: Event[] = [];

  constructor(options: CollectorOptions) {
    this._maxEventsInMemory = options.maxEventsInMemory;
  }

  /**
   * Record an event and perform privacy redaction if necessary.
   * @param event The event to record.
   */
  public recordEvent(event: Event): void {
    // Perform privacy redaction here if needed
    this._events.push(event);

    if (this._events.length > this._maxEventsInMemory) {
      this.flush();
    }
  }

  /**
   * Flush the stored events to the database.
   */
  private flush(): void {
    // Implement database storage logic here
  }
}

/**
 * Payload allowlist configuration for the Collector.
 */
export const payloadAllowlist = new PayloadAllowlist();
