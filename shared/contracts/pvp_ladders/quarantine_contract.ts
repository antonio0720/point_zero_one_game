/**
 * Quarantine Contract for PvP Ladders
 */

type QuarantineState = 'active' | 'lifted';

interface InternalReason {
    /** Unique identifier for the reason */
    id: number;

    /** Human-readable description of the reason */
    description: string;
}

/** List of internal reasons for quarantine */
const INTERNAL_REASONS: InternalReason[] = [
    { id: 1, description: 'Rule violation' },
    { id: 2, description: 'Suspicious activity' },
    // Add more reasons as needed
];

/**
 * Represents a quarantine event in the PvP ladders system.
 */
export interface QuarantineEvent {
    /** Unique identifier for the event */
    id: number;

    /** The player who was quarantined */
    playerId: number;

    /** The reason for the quarantine */
    reason: InternalReason;

    /** The state of the quarantine */
    state: QuarantineState;

    /** Timestamp when the event occurred */
    timestamp: Date;
}

/**
 * Messaging model for public-safe communication about quarantine events.
 */
export interface PublicQuarantineMessage {
    type: 'quarantine';
    playerId: number;
    reason: string;
    state: 'active' | 'lifted';
}
