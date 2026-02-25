import type { GameMode, RunOutcome } from './modes';

export interface CordSubmission {
  runId: string;
  userId: string;
  mode: GameMode;
  outcome: RunOutcome;
  seed: number;
  finalTick: number;
  financialScore: number;
  decisionQuality: number;
  pressureResilience: number;
  recoveryScore: number;
  consistencyScore: number;
  modeBonus: number;
  proofHash: string;
  telemetryStream: Array<{ tick: number; type: string; payload: Record<string, unknown> }>;
}

export interface CordVerificationResult {
  verified: boolean;
  cordScore: number;
  tier: string;
  proofHash: string;
  runId: string;
  verifiedAt: number;
  rejectionReason?: string;
}
