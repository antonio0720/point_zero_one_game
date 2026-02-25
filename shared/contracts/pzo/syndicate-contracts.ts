// shared/contracts/pzo/syndicate-room.ts

export type SyndicateRole = 'ARCHITECT' | 'ACCELERATOR' | 'GUARDIAN' | 'CONNECTOR';

export interface SyndicateRoomRecord {
  roomId: string;
  allianceMembers: Array<{ userId: string; role: SyndicateRole | null; trust: number }>;
  sharedTreasuryBalance: number;
  status: 'FORMING' | 'ACTIVE' | 'COMPLETE' | 'COLLAPSED';
  seed: number;
  createdAt: number;
}

export interface SyndicateJoinRequest {
  roomId: string;
  userId: string;
  role: SyndicateRole;
}

// shared/contracts/pzo/trust-score.ts
export interface TrustScoreRecord {
  runId: string;
  userId: string;
  value: number;
  leakageRate: number;
  label: string;
  totalGained: number;
  totalLost: number;
  negativePlayCount: number;
  aidFulfillments: number;
  suspicionLevel: number;
}

// shared/contracts/pzo/aid-contract.ts
export type AidType = 'CASH_TRANSFER' | 'INCOME_BOOST' | 'SHIELD_GRANT' | 'EXPENSE_COVER';
export type AidStatus = 'OFFERED' | 'ACCEPTED' | 'ACTIVE' | 'REPAID' | 'BREACHED' | 'EXPIRED';

export interface AidContractRecord {
  id: string;
  aidType: AidType;
  senderId: string;
  recipientId: string;
  nominalAmount: number;
  effectiveAmount: number;
  trustLeakageApplied: number;
  trustDelta: number;
  repaymentAmount: number;
  repaymentDueTick: number;
  offeredAtTick: number;
  acceptedAtTick: number | null;
  resolvedAtTick: number | null;
  status: AidStatus;
  terms: string;
}

// shared/contracts/pzo/defection-sequence.ts
export type DefectionStep = 'NONE' | 'BREAK_PACT' | 'SILENT_EXIT' | 'ASSET_SEIZURE' | 'COMPLETE' | 'DETECTED' | 'ABANDONED';

export interface DefectionRecord {
  runId: string;
  defectorId: string;
  step: DefectionStep;
  tick: number;
  detected: boolean;
  detectedBy: string | null;
  cashSeized: number;
  incomeDrained: number;
}

// shared/contracts/pzo/trust-audit.ts
export type TrustVerdict = 'EXEMPLARY' | 'COOPERATIVE' | 'TRANSACTIONAL' | 'SUSPECT' | 'DEFECTOR';

export interface TrustAuditSubmission {
  runId: string;
  userId: string;
  finalTrust: number;
  aidContractsFulfilled: number;
  aidContractsBreached: number;
  defectionCompleted: boolean;
  cooperationScore: number;
  integrityScore: number;
  verdict: TrustVerdict;
  proofHash: string;
}
