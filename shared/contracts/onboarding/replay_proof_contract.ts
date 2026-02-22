/**
 * Replay Proof Contract Interface
 */

export interface TurningPointAnchor {
  /** Unique identifier for the turning point anchor */
  id: string;
  /** The timestamp of the turning point in milliseconds */
  timestamp: number;
  /** The game state hash at the turning point */
  stateHash: string;
}

export interface ReplayLinkTarget {
  /** Unique identifier for the replay link target */
  id: string;
  /** The URL of the replay link target */
  url: string;
}

export enum ProofStatus {
  Pending = 'pending',
  Verified = 'verified'
}

export interface ProofStatusPayload {
  /** Unique identifier for the proof status payload */
  id: string;
  /** The timestamp of the proof status update in milliseconds */
  timestamp: number;
  /** The status of the proof */
  status: ProofStatus;
}
