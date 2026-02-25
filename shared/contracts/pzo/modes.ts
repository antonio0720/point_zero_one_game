export type GameMode = 'EMPIRE' | 'PREDATOR' | 'SYNDICATE' | 'PHANTOM';
export type RunOutcome = 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED';

export interface RunStartRequest {
  mode: GameMode;
  seed: number;
  userId: string;
  sessionId: string;
  clientTimestamp: number;
}

export interface RunCompleteRequest {
  runId: string;
  outcome: RunOutcome;
  finalTick: number;
  finalCash: number;
  finalNetWorth: number;
  finalIncome: number;
  finalExpenses: number;
  telemetryStream: TelemetryEntry[];
  proofHash: string;
}

export interface TelemetryEntry {
  tick: number;
  type: string;
  payload: Record<string, number | string | boolean | null>;
}
