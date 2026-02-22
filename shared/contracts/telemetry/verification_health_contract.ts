/**
 * Verification Health Contract Interface
 */

export interface VerificationHealthContract {
  pendingCount: number;
  verifiedLatency: number;
  quarantineReasons: string[];
  ladderGatingTriggers: boolean[];
  queueDepthSignals: number[];
}

/**
 * Verification Health Contract Repository Interface
 */

export interface VerificationHealthContractRepository {
  save(contract: VerificationHealthContract): Promise<void>;
  getLatest(): Promise<VerificationHealthContract | null>;
}
