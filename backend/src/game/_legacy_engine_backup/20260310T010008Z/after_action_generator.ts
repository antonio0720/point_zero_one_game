/**
 * AfterAction Generator for Point Zero One Digital's financial roguelike game.
 */

export enum FailureMode {
    /** The player loses resources due to a failed action. */
    ResourceLoss = "resource_loss",

    /** The player gains a replay suggestion, training a weakness. */
    ReplaySuggestion = "replay_suggestion",
}

export enum StrengthMode {
    /** A small, quick action that may have minimal impact. */
    Tiny = "tiny",

    /** A moderate action with more significant effects. */
    Medium = "medium",
}

/**
 * Represents a single action taken during the game's run event log.
 */
export interface AfterAction {
    id: number;
    failureMode: FailureMode;
    strengthMode: StrengthMode;
    replaySuggestion?: string; // Optional, if ReplaySuggestion is the FailureMode
    tinyAction?: TinyAction; // Optional, if Tiny is the StrengthMode
    mediumAction?: MediumAction; // Optional, if Medium is the StrengthMode
}

/**
 * A small, quick action that may have minimal impact.
 */
export interface TinyAction {
    /** Unique identifier for the tiny action. */
    id: number;
    /** Description of the tiny action. */
    description: string;
}

/**
 * A moderate action with more significant effects.
 */
export interface MediumAction {
    /** Unique identifier for the medium action. */
    id: number;
    /** Description of the medium action. */
    description: string;
}
