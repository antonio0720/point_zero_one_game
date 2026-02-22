/**
 * Telemetry Events Contract
 */

export interface RecoveryMoment {
  /** Unique identifier for the recovery moment event */
  id: number;
  /** Timestamp when the recovery moment occurred */
  timestamp: Date;
  /** Player's current gold amount at the time of the recovery moment */
  gold: number;
}

export interface BigOpportunityMoment {
  /** Unique identifier for the big opportunity moment event */
  id: number;
  /** Timestamp when the big opportunity moment occurred */
  timestamp: Date;
  /** Player's current gold amount at the time of the big opportunity moment */
  gold: number;
  /** Amount of gold gained or lost during the big opportunity moment */
  deltaGold: number;
}

export interface VerifiedStampMoment {
  /** Unique identifier for the verified stamp moment event */
  id: number;
  /** Timestamp when the verified stamp moment occurred */
  timestamp: Date;
  /** Player's current gold amount at the time of the verified stamp moment */
  gold: number;
}

export interface ShareExportEvent {
  /** Unique identifier for the share/export event */
  id: number;
  /** Timestamp when the share/export event occurred */
  timestamp: Date;
  /** Player's current gold amount at the time of the share/export event */
  gold: number;
}

export interface PersonalBest {
  /** Unique identifier for the personal best event */
  id: number;
  /** Timestamp when the personal best was achieved */
  timestamp: Date;
  /** Player's current gold amount at the time of the personal best achievement */
  gold: number;
}
