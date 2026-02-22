/**
 * RunExplorerContract Interface
 */

interface RunExplorerSummary {
    /** Unique identifier for the explorer summary */
    id: string;
    /** The timestamp when the explorer summary was created */
    createdAt: Date;
    /** The timestamp when the explorer summary was last updated */
    updatedAt: Date;
    /** The explorer's current wealth */
    wealth: number;
    /** The explorer's current level */
    level: number;
    /** The explorer's current privacy level */
    privacyLevel: PrivacyLevel;
}

interface PivotalTurn {
    /** Unique identifier for the pivotal turn */
    id: string;
    /** The timestamp when the pivotal turn occurred */
    timestamp: Date;
    /** The explorer's wealth before the pivotal turn */
    preWealth: number;
    /** The explorer's level before the pivotal turn */
    preLevel: number;
    /** The explorer's privacy level before the pivotal turn */
    prePrivacyLevel: PrivacyLevel;
    /** The explorer's wealth after the pivotal turn */
    postWealth: number;
    /** The explorer's level after the pivotal turn */
    postLevel: number;
    /** The explorer's privacy level after the pivotal turn */
    postPrivacyLevel: PrivacyLevel;
}

/**
 * VerificationPanel Interface
 */

interface VerificationPanel {
    /** Unique identifier for the verification panel */
    id: string;
    /** The timestamp when the verification panel was created */
    createdAt: Date;
    /** The timestamp when the verification panel was last updated */
    updatedAt: Date;
    /** The explorer's unique identifier */
    explorerId: string;
    /** The verification panel's status (e.g., 'pending', 'approved', 'denied') */
    status: string;
}

/**
 * PrivacyLevel Enum
 */

enum PrivacyLevel {
    Public = "public",
    Private = "private"
}

/**
 * ExplorerLookupRequest Interface
 */

interface ExplorerLookupRequest {
    /** The unique identifier of the explorer to look up */
    explorerId: string;
}

/**
 * ExplorerLookupResponse Interface
 */

interface ExplorerLookupResponse {
    /** The explorer summary matching the given explorer ID, or null if not found */
    summary?: RunExplorerSummary | null;
    /** An array of pivotal turns for the explorer, sorted in chronological order */
    pivotalTurns: PivotalTurn[];
    /** The verification panel for the explorer, or null if not found */
    verificationPanel?: VerificationPanel | null;
}
