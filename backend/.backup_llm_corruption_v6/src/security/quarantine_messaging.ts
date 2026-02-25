/**
 * Quarantine Messaging Module
 */

export interface PublicQuarantineMessage {
  /** Unique identifier for the quarantine event */
  id: string;

  /** Timestamp when the quarantine event occurred */
  timestamp: Date;

  /** Brief description of the quarantine event */
  message: string;
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
}

/**
 * Function to create a public quarantine message
 * @param timestamp Timestamp when the quarantine event occurred
 * @param message Brief description of the quarantine event
 */
export function createPublicQuarantineMessage(timestamp: Date, message: string): PublicQuarantineMessage {
  return { id: crypto.randomUUID(), timestamp, message };
}

/**
 * Function to create an internal quarantine message
 * @param timestamp Timestamp when the quarantine event occurred
 * @param message Brief description of the quarantine event
 * @param reasonCode Detailed reason code for the quarantine event (internal use only)
 */
export function createInternalQuarantineMessage(timestamp: Date, message: string, reasonCode: string): InternalQuarantineMessage {
  return { id: crypto.randomUUID(), timestamp, message, reasonCode };
}

This TypeScript file defines two interfaces for public and internal quarantine messages, as well as functions to create each type of message. The functions use the `crypto.randomUUID()` method to generate unique identifiers for each quarantine event.
