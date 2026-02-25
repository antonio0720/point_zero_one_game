export type CardArchetype =
  | 'OPPORTUNITY'
  | 'IPA'
  | 'FUBAR'
  | 'MISSED_OPPORTUNITY'
  | 'SO'
  | 'PRIVILEGED';

export type CardOrigin =
  | 'PLAYER_DRAW'
  | 'FORCED_EVENT'
  | 'SABOTAGE_INJECTION'
  | 'EXTRACTION_RESULT'
  | 'RESCUE_REWARD'
  | 'GHOST_PRESSURE'
  | 'BONUS_DRAW';

export interface CardPlayIntent {
  runId: string;
  tick: number;
  cardId: string;
  cardType: CardArchetype;
  cashAvailable: number;
  decisionLatencyMs: number;
}

export interface CardResolutionResult {
  success: boolean;
  rejectionReason?: string;
  cashDelta: number;
  incomeDelta: number;
  netWorthDelta: number;
  xpGained: number;
  decisionTag: 'FAST' | 'LATE' | 'OPTIMAL' | 'RISKY' | null;
  telemetryType: string;
}
