// shared/contracts/pzo/verified-run.ts

export type CordTier = 'UNRANKED' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'SOVEREIGN';

export interface VerifiedRunSubmission {
  runId: string;
  userId: string;
  displayName: string;
  mode: 'EMPIRE' | 'PREDATOR' | 'SYNDICATE' | 'PHANTOM';
  seed: number;
  finalTick: number;
  finalCash: number;
  finalNetWorth: number;
  finalIncome: number;
  cordScore: number;
  cordTier: CordTier;
  proofHash: string;
  eventCount: number;
  eventDigest: string;
  modePayload: Record<string, unknown>;   // mode-specific sub-scores
}

export interface VerifiedRunRecord extends VerifiedRunSubmission {
  shortHash: string;
  verifiedAt: number;
  isLegend: boolean;
  serverVerified: boolean;
}

// shared/contracts/pzo/proof-card.ts

export interface ProofCardData {
  runId: string;
  shortHash: string;
  displayName: string;
  mode: string;
  cordScore: number;
  cordTier: CordTier;
  finalNetWorth: number;
  finalTick: number;
  verifiedAt: number;
  isLegend: boolean;
  /** URL to rendered proof card PNG */
  cardImageUrl?: string;
}

export interface ProofCardRenderRequest {
  runId: string;
  userId: string;
}

// shared/contracts/pzo/run-dossier.ts

export interface RunDossier {
  run: VerifiedRunRecord;
  modeDetails: Record<string, unknown>;
  proofCard: ProofCardData;
  /** Timeline snapshots for Phantom mode */
  ghostSnapshots?: Array<{ tick: number; netWorth: number; cordScore: number }>;
  /** Case file for Empire mode */
  caseFile?: Record<string, unknown>;
  /** Trust audit for Syndicate mode */
  trustAudit?: Record<string, unknown>;
  /** Match record for Predator mode */
  matchRecord?: Record<string, unknown>;
}
