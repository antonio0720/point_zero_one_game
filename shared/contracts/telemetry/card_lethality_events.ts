/**
 * Card Lethality Events Contract
 */

export interface SeenPlayRate {
  cardId: number;
  seenCount: number;
  playedCount: number;
}

export interface DeathAdjacencyWindow {
  cardId: number;
  adjacentDeathsCount: number;
  windowStart: number;
  windowEnd: number;
}

export interface EvOutcome {
  eventId: number;
  expectedValue: number;
  outcome: number;
}

export interface SkillSensitivitySignal {
  skillId: number;
  sensitivityScore: number;
}

export type TelemetryEvent = SeenPlayRate | DeathAdjacencyWindow | EvOutcome | SkillSensitivitySignal;
