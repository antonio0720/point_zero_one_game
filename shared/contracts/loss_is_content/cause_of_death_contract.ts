/**
 * Cause of Death Contract Interface
 */

export enum FailureMode {
    /** The player's resources were depleted */
    ResourceDepletion = 'ResourceDepletion',

    /** The player encountered an unexpected event */
    UnforeseenEvent = 'UnforeseenEvent',

    /** The player made a strategic mistake */
    StrategicMistake = 'StrategicMistake'
}

export interface DeltaStrip {
    /** Unique identifier for the delta strip */
    id: string;

    /** Timestamp when the delta strip was created */
    timestamp: Date;

    /** The changes to the game state represented by this delta strip */
    changes: any[];
}

export interface SurvivalHint {
    /** Unique identifier for the survival hint */
    id: string;

    /** Text of the survival hint */
    text: string;

    /** The failure mode associated with this survival hint */
    failureMode: FailureMode;
}

export interface ShareCardPayload {
    /** Unique identifier for the share card payload */
    id: string;

    /** Timestamp when the share card was created */
    timestamp: Date;

    /** The cause of death associated with this share card */
    causeOfDeath: FailureMode;

    /** A list of delta strips that represent the game state changes leading to the player's demise */
    deltaStrips: DeltaStrip[];

    /** A list of survival hints that provide insights into the player's mistakes or unexpected events */
    survivalHints: SurvivalHint[];
}

/**
 * Export public symbols
 */
export { FailureMode, DeltaStrip, SurvivalHint, ShareCardPayload };
