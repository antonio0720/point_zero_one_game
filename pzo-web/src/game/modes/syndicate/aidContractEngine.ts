// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/syndicate/aidContractEngine.ts
// Sprint 5 — AID Contract System — SOVEREIGN EDITION
// Density6 LLC · Confidential
//
// AID contracts are binding transfers between syndicate members.
// Terms: amount + repayment + timing + trust delta.
// Trust leakage reduces actual transfer amount.
// Breach penalties apply if repayment terms missed.
//
// CHANGE LOG:
//   • Added INCOME_SHARE, SHIELD_LEND, EMERGENCY_CAPITAL types (from SyndicateEngine)
//   • Added computeAidWithRoleAmplifier() — INCOME_BUILDER/COUNTER_INTEL bonuses
//   • Added computeAidWithTrustMultiplier() — trust multiplier gate
//   • Added validateContractWithTrust() — blocks aid if trust < 0.3
//   • Added onRepaymentComplete() — fires trust boost on repayment
//   • Added AidContractSummary type for leaderboard/audit exports
//   • Contract ID now uses entropy pattern (compatible with proofHash system)
//   • Added AidContractBatch type for 20M player processing
// ═══════════════════════════════════════════════════════════════════════════

import { SYNDICATE_CONFIG, type SyndicateRole } from './syndicateConfig';
import { computeLeakageWithRole, getTrustMultiplier } from './trustScoreEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * All available AID types — includes SyndicateEngine.ts types (INCOME_SHARE etc.)
 * and original types (CASH_TRANSFER etc.)
 */
export type AidType =
  | 'CASH_TRANSFER'      // one-time cash injection (original)
  | 'INCOME_BOOST'       // per-tick income amplification (original)
  | 'SHIELD_GRANT'       // shield layer donation (original)
  | 'EXPENSE_COVER'      // expense subsidy (original)
  | 'INCOME_SHARE'       // per-tick income diversion to partner (from SyndicateEngine)
  | 'SHIELD_LEND'        // ongoing shield transfer each tick (from SyndicateEngine)
  | 'EMERGENCY_CAPITAL'; // one-time large capital injection (from SyndicateEngine)

export type AidStatus = 'OFFERED' | 'ACCEPTED' | 'ACTIVE' | 'REPAID' | 'BREACHED' | 'EXPIRED' | 'COMPLETED';

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
  /** For per-tick effects (INCOME_SHARE, SHIELD_LEND): amount per tick */
  perTickAmount: number | null;
  /** Tick duration for ongoing contracts */
  durationTicks: number | null;
  offeredAtTick: number;
  acceptedAtTick: number | null;
  resolvedAtTick: number | null;
  status: AidStatus;
  terms: string;
  /** Detectability — COUNTER_INTEL cards can mask this */
  isHidden: boolean;
  hiddenPayload?: 'SELFISH' | 'COOPERATIVE';
  /** Role of the sender (affects amplification) */
  senderRole?: SyndicateRole;
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
  senderRole?: SyndicateRole;
  counterIntelActive?: boolean;
  isHidden?: boolean;
  hiddenPayload?: 'SELFISH' | 'COOPERATIVE';
  /** For ongoing contracts: how many ticks it runs */
  durationTicks?: number;
}

/** Lightweight summary type for leaderboard + audit exports */
export interface AidContractSummary {
  id: string;
  aidType: AidType;
  senderTrustAtSign: number;
  nominalAmount: number;
  effectiveAmount: number;
  leakagePct: number;
  status: AidStatus;
  signedAtTick: number;
}

/** Batch type for 20M player processing — process many contracts in one call */
export interface AidContractBatch {
  tick: number;
  contracts: AidContract[];
  localIncome: number;
  localCash: number;
  partnerIncome: number;
  partnerShieldPct: number;
}

export interface AidContractBatchResult {
  updatedContracts: AidContract[];
  localIncomeDelta: number;
  localCashDelta: number;
  partnerIncomeDelta: number;
  partnerShieldDelta: number;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ContractValidationResult {
  valid: boolean;
  reason?: 'TRUST_TOO_LOW' | 'INSUFFICIENT_CASH' | 'SAME_PLAYER' | 'AMOUNT_ZERO';
}

/**
 * Blocks aid offers if trust < 0.3 (bible rule: low trust = rejected contracts).
 * Also validates basic sanity checks.
 */
export function validateContractWithTrust(
  senderId: string,
  recipientId: string,
  nominalAmount: number,
  senderTrustValue: number,
  senderCash: number,
): ContractValidationResult {
  if (senderId === recipientId)   return { valid: false, reason: 'SAME_PLAYER' };
  if (nominalAmount <= 0)         return { valid: false, reason: 'AMOUNT_ZERO' };
  if (senderTrustValue < 0.30)    return { valid: false, reason: 'TRUST_TOO_LOW' };
  if (nominalAmount > senderCash) return { valid: false, reason: 'INSUFFICIENT_CASH' };
  return { valid: true };
}

// ─── Contract Creation ────────────────────────────────────────────────────────

export function createAidContract(input: AidContractCreateInput): AidContract {
  const {
    aidType, senderId, recipientId, nominalAmount, repaymentAmount,
    repaymentDueTick, currentTick, senderTrustValue, senderRole,
    counterIntelActive, isHidden, hiddenPayload, durationTicks,
  } = input;

  const leakageRate       = computeLeakageWithRole(senderTrustValue, counterIntelActive ?? false);
  const baseEffective     = Math.round(nominalAmount * (1 - leakageRate));
  const effectiveAmount   = computeAidWithRoleAmplifier(baseEffective, senderRole, aidType);
  const trustDelta        = computeTrustDelta(aidType, nominalAmount, repaymentAmount);

  // Per-tick amount for ongoing contracts
  const perTickAmount: number | null = isOngoingContract(aidType)
    ? parseFloat((effectiveAmount / Math.max(1, durationTicks ?? 60)).toFixed(2))
    : null;

  // Generate entropy-based ID (compatible with proofHash pattern)
  const entropy = (currentTick * 31337 + nominalAmount * 7) & 0xFFFFFF;
  const id      = `aid-${currentTick}-${senderId.slice(0, 4)}-${recipientId.slice(0, 4)}-${entropy.toString(16)}`;

  const terms = buildTermsString(
    aidType, nominalAmount, effectiveAmount, repaymentAmount,
    repaymentDueTick, leakageRate, senderRole,
  );

  return {
    id,
    aidType,
    senderId,
    recipientId,
    nominalAmount,
    effectiveAmount,
    trustLeakageApplied:  nominalAmount - Math.round(nominalAmount * (1 - leakageRate)),
    trustDelta,
    repaymentAmount,
    repaymentDueTick,
    perTickAmount,
    durationTicks:        durationTicks ?? null,
    offeredAtTick:        currentTick,
    acceptedAtTick:       null,
    resolvedAtTick:       null,
    status:               'OFFERED',
    terms,
    isHidden:             isHidden ?? false,
    hiddenPayload,
    senderRole,
  };
}

// ─── Role Amplifiers ──────────────────────────────────────────────────────────

/**
 * INCOME_BUILDER amplifies INCOME_SHARE/INCOME_BOOST contracts by 10%.
 * COUNTER_INTEL amplifies all contract effective amounts by trust multiplier.
 */
export function computeAidWithRoleAmplifier(
  baseAmount: number,
  role: SyndicateRole | undefined,
  aidType: AidType,
): number {
  if (!role) return baseAmount;
  if (role === 'INCOME_BUILDER' && (aidType === 'INCOME_SHARE' || aidType === 'INCOME_BOOST')) {
    return Math.round(baseAmount * 1.10);
  }
  if (role === 'COUNTER_INTEL') {
    // COUNTER_INTEL's leakage reduction is already applied in computeLeakageWithRole
    // Additional 3% effectiveness bonus on CASH/SHIELD contracts
    if (aidType === 'CASH_TRANSFER' || aidType === 'SHIELD_GRANT' || aidType === 'SHIELD_LEND') {
      return Math.round(baseAmount * 1.03);
    }
  }
  return baseAmount;
}

/**
 * Apply trust multiplier gate to aid effectiveness.
 * Trust < 0.5 reduces effectiveness. Trust > 0.5 amplifies it.
 */
export function computeAidWithTrustMultiplier(
  nominalAmount: number,
  trustValue: number,
): number {
  const mult = getTrustMultiplier(trustValue);
  return Math.round(nominalAmount * mult);
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

export function completeContract(contract: AidContract, tick: number): AidContract {
  return { ...contract, status: 'COMPLETED', resolvedAtTick: tick };
}

export function checkContractExpiry(contract: AidContract, currentTick: number): AidContract {
  if (contract.status === 'ACTIVE' && currentTick > contract.repaymentDueTick) {
    return breachContract(contract, currentTick);
  }
  return contract;
}

/**
 * Called when repayment completes — fires trust boost side effect.
 * Returns trust gain amount to be applied by caller.
 */
export function onRepaymentComplete(contract: AidContract): number {
  // Repayment is cooperative behavior — trust boost
  const trustGain = 0.05;
  return trustGain;
}

// ─── Batch Processing (20M player scale) ─────────────────────────────────────

/**
 * Process all active contracts for a single tick.
 * Accumulates deltas rather than mutating per-contract — safe at scale.
 */
export function processContractBatch(batch: AidContractBatch): AidContractBatchResult {
  let localIncomeDelta  = 0;
  let localCashDelta    = 0;
  let partnerIncomeDelta = 0;
  let partnerShieldDelta = 0;

  const updatedContracts = batch.contracts.map(contract => {
    if (contract.status !== 'ACTIVE') return contract;

    // Duration expiry
    if (contract.durationTicks !== null && contract.acceptedAtTick !== null) {
      const elapsed = batch.tick - contract.acceptedAtTick;
      if (elapsed >= contract.durationTicks) {
        return completeContract(contract, batch.tick);
      }
    }

    const perTick = contract.perTickAmount;

    switch (contract.aidType) {
      case 'INCOME_SHARE':
        if (perTick) {
          localIncomeDelta   -= perTick;
          partnerIncomeDelta += perTick;
        }
        break;

      case 'SHIELD_LEND':
        partnerShieldDelta += 0.01;  // +1% shield per tick
        break;

      case 'EMERGENCY_CAPITAL':
        // One-time — immediate cash transfer, mark complete
        if (batch.localCash >= contract.effectiveAmount) {
          localCashDelta     -= contract.effectiveAmount;
          partnerIncomeDelta += contract.effectiveAmount;
        }
        return completeContract(contract, batch.tick);

      case 'INCOME_BOOST':
        if (perTick) partnerIncomeDelta += perTick;
        break;

      case 'EXPENSE_COVER':
        if (perTick) localCashDelta     += perTick;
        break;

      default:
        break;
    }

    return contract;
  });

  return {
    updatedContracts,
    localIncomeDelta,
    localCashDelta,
    partnerIncomeDelta,
    partnerShieldDelta,
  };
}

// ─── Breach Penalty ───────────────────────────────────────────────────────────

export interface BreachPenalty {
  cashPenalty: number;
  trustPenalty: number;
  suspicionIncrease: number;
}

export function computeBreachPenalty(contract: AidContract): BreachPenalty {
  return {
    cashPenalty:       Math.round(contract.repaymentAmount * 1.25),
    trustPenalty:      0.15,
    suspicionIncrease: 2.0,
  };
}

// ─── Summary + Export ─────────────────────────────────────────────────────────

export function buildAidContractSummary(
  contract: AidContract,
  senderTrustAtSign: number,
): AidContractSummary {
  const leakagePct = contract.nominalAmount > 0
    ? parseFloat(((contract.trustLeakageApplied / contract.nominalAmount) * 100).toFixed(1))
    : 0;
  return {
    id:                contract.id,
    aidType:           contract.aidType,
    senderTrustAtSign,
    nominalAmount:     contract.nominalAmount,
    effectiveAmount:   contract.effectiveAmount,
    leakagePct,
    status:            contract.status,
    signedAtTick:      contract.offeredAtTick,
  };
}

// ─── Internal ────────────────────────────────────────────────────────────────

function isOngoingContract(aidType: AidType): boolean {
  return aidType === 'INCOME_SHARE' || aidType === 'SHIELD_LEND' || aidType === 'INCOME_BOOST' || aidType === 'EXPENSE_COVER';
}

function computeTrustDelta(aidType: AidType, nominal: number, repayment: number): number {
  const generosityRatio = repayment > 0 ? 1 - (repayment / nominal) : 1.0;
  const baseImpact = (aidType === 'SHIELD_GRANT' || aidType === 'SHIELD_LEND' || aidType === 'EMERGENCY_CAPITAL')
    ? 0.5 : 0.3;
  return parseFloat((baseImpact * (0.5 + generosityRatio * 0.5)).toFixed(2));
}

function buildTermsString(
  aidType: AidType, nominal: number, effective: number,
  repayment: number, dueTick: number, leakageRate: number,
  role?: SyndicateRole,
): string {
  const leakagePct  = Math.round(leakageRate * 100);
  const leakageNote = leakageRate > 0 ? ` (actual $${effective.toLocaleString()} — ${leakagePct}% trust leakage)` : '';
  const repayNote   = repayment > 0 ? ` · Repay $${repayment.toLocaleString()} by tick ${dueTick}` : ' · No repayment required';
  const roleNote    = role ? ` · ${role}` : '';
  const typeLabel   = aidType.replace(/_/g, ' ');
  return `${typeLabel} $${nominal.toLocaleString()}${leakageNote}${repayNote}${roleNote}`;
}