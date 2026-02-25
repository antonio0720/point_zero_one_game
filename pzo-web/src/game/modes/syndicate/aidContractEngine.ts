// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/syndicate/aidContractEngine.ts
// Sprint 5 — AID Contract System
//
// AID contracts are binding transfers between syndicate members.
// Terms: amount + repayment + timing + trust delta.
// Trust leakage reduces actual transfer amount.
// Breach penalties apply if repayment terms missed.
// ═══════════════════════════════════════════════════════════════════════════

import { SYNDICATE_CONFIG } from './syndicateConfig';
import { computeLeakageRate } from './trustScoreEngine';

export type AidType = 'CASH_TRANSFER' | 'INCOME_BOOST' | 'SHIELD_GRANT' | 'EXPENSE_COVER';
export type AidStatus = 'OFFERED' | 'ACCEPTED' | 'ACTIVE' | 'REPAID' | 'BREACHED' | 'EXPIRED';

export interface AidContract {
  id: string;
  aidType: AidType;
  senderId: string;
  recipientId: string;
  nominalAmount: number;
  /** Actual amount after trust leakage applied */
  effectiveAmount: number;
  trustLeakageApplied: number;
  trustDelta: number;         // impact on sender's trust score
  repaymentAmount: number;
  repaymentDueTick: number;
  offeredAtTick: number;
  acceptedAtTick: number | null;
  resolvedAtTick: number | null;
  status: AidStatus;
  terms: string;
  /** Detectability — Hidden Intent cards can mask this */
  isHidden: boolean;
  hiddenPayload?: 'SELFISH' | 'COOPERATIVE';
}

export interface AidContractCreateInput {
  aidType: AidType;
  senderId: string;
  recipientId: string;
  nominalAmount: number;
  repaymentAmount: number;
  repaymentDueTick: number;
  currentTick: number;
  senderTrustValue: number;
  isHidden?: boolean;
  hiddenPayload?: 'SELFISH' | 'COOPERATIVE';
}

// ─── Contract Creation ────────────────────────────────────────────────────────

export function createAidContract(input: AidContractCreateInput): AidContract {
  const {
    aidType, senderId, recipientId, nominalAmount, repaymentAmount,
    repaymentDueTick, currentTick, senderTrustValue, isHidden, hiddenPayload,
  } = input;

  const leakageRate = computeLeakageRate(senderTrustValue);
  const effectiveAmount = Math.round(nominalAmount * (1 - leakageRate));
  const trustDelta = computeTrustDelta(aidType, nominalAmount, repaymentAmount);

  const terms = buildTermsString(aidType, nominalAmount, effectiveAmount, repaymentAmount, repaymentDueTick, leakageRate);

  return {
    id: `aid-${currentTick}-${senderId}-${recipientId}`,
    aidType,
    senderId,
    recipientId,
    nominalAmount,
    effectiveAmount,
    trustLeakageApplied: nominalAmount - effectiveAmount,
    trustDelta,
    repaymentAmount,
    repaymentDueTick,
    offeredAtTick: currentTick,
    acceptedAtTick: null,
    resolvedAtTick: null,
    status: 'OFFERED',
    terms,
    isHidden: isHidden ?? false,
    hiddenPayload,
  };
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

export function acceptContract(contract: AidContract, tick: number): AidContract {
  return { ...contract, status: 'ACTIVE', acceptedAtTick: tick };
}

export function repayContract(contract: AidContract, tick: number): AidContract {
  return { ...contract, status: 'REPAID', resolvedAtTick: tick };
}

export function breachContract(contract: AidContract, tick: number): AidContract {
  return { ...contract, status: 'BREACHED', resolvedAtTick: tick };
}

export function checkContractExpiry(contract: AidContract, currentTick: number): AidContract {
  if (contract.status === 'ACTIVE' && currentTick > contract.repaymentDueTick) {
    return breachContract(contract, currentTick);
  }
  return contract;
}

// ─── Breach Penalty ───────────────────────────────────────────────────────────

export interface BreachPenalty {
  cashPenalty: number;
  trustPenalty: number;
  suspicionIncrease: number;
}

export function computeBreachPenalty(contract: AidContract): BreachPenalty {
  return {
    cashPenalty:        Math.round(contract.repaymentAmount * 1.25),
    trustPenalty:       0.15,
    suspicionIncrease:  2.0,
  };
}

// ─── Internal ────────────────────────────────────────────────────────────────

function computeTrustDelta(aidType: AidType, nominal: number, repayment: number): number {
  // Generous aid (low repayment) = good trust
  const generosityRatio = repayment > 0 ? 1 - (repayment / nominal) : 1.0;
  const baseImpact = aidType === 'SHIELD_GRANT' ? 0.5 : 0.3;
  return parseFloat((baseImpact * (0.5 + generosityRatio * 0.5)).toFixed(2));
}

function buildTermsString(
  aidType: AidType, nominal: number, effective: number,
  repayment: number, dueTick: number, leakageRate: number,
): string {
  const leakagePct = Math.round(leakageRate * 100);
  const leakageNote = leakageRate > 0 ? ` (actual $${effective.toLocaleString()} due to ${leakagePct}% trust leakage)` : '';
  const repayNote = repayment > 0 ? ` · Repay $${repayment.toLocaleString()} by tick ${dueTick}` : ' · No repayment required';
  return `${aidType} $${nominal.toLocaleString()}${leakageNote}${repayNote}`;
}
