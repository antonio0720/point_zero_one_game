/**
 * MomentCode enum representing unique identifiers for moments in the game.
 */
export enum MomentCode {
  OPPORTUNITY = 'OPP',
  DISASTER = 'DIS',
  MISSED = 'MIS',
  SOCIAL = 'SOC',
  INSIGHT = 'INS'
}

/**
 * MomentFamily enum representing categories of moments in the game.
 */
export enum MomentFamily {
  OPPORTUNITY = 'OPPORTUNITY',
  DISASTER = 'DISASTER',
  MISSED = 'MISSED',
  SOCIAL = 'SOCIAL',
  INSIGHT = 'INSIGHT'
}

/**
 * MomentEvent interface representing an event that triggers a moment.
 */
export interface MomentEvent {
  id: number;
  timestamp: Date;
  code: MomentCode;
  family: MomentFamily;
  data?: any; // TODO: Replace 'any' with specific type when available
}

/**
 * HostCalloutPayload interface representing the payload for a callout from the host OS.
 */
export interface HostCalloutPayload {
  momentCode: MomentCode;
  data?: any; // TODO: Replace 'any' with specific type when available
}

/**
 * MomentLog interface representing a log entry for a moment in the game.
 */
export interface MomentLog {
  id: number;
  sessionId: number;
  momentEvent: MomentEvent;
  outcome: string; // e.g., 'success', 'failure'
}

/**
 * SessionMoments interface representing a collection of moments for a single game session.
 */
export interface SessionMoments {
  id: number;
  sessionId: number;
  opportunities: MomentLog[];
  disasters: MomentLog[];
  missedOpportunities: MomentLog[];
  socialEvents: MomentLog[];
  insights: MomentLog[];
}
