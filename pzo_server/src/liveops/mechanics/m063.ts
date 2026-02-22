/**
 * M63 — Sponsored Bounties (Player-Funded Challenges for the Table) — Live-ops Layer
 * Source spec: mechanics/M63_sponsored_bounties_player_funded_challenges_for_the_table.md
 * Deps: M39 Season Trophy Currency, M46 Ledger, M48 Validator
 *
 * Deploy to: pzo_server/src/liveops/mechanics/m063.ts
 */

import { createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BountyStatus =
  | 'PENDING_ESCROW'   // sponsor created; stake not locked yet
  | 'ACTIVE'           // escrow locked; available to opt-in
  | 'CLAIMED'          // verified completion; payout issued
  | 'EXPIRED'          // nobody completed; partial refund + sink burn
  | 'QUARANTINED';     // fraudulent claim detected; under review

export type BountyConditionTemplate =
  | 'FLIP_WITH_HEAT_GTE'     // payload: { heatThreshold: number }
  | 'SURVIVE_MACRO_SHOCK'    // payload: { shockCount: number }
  | 'FULL_LADDER_IN_N_TICKS' // payload: { ticks: number }
  | 'NO_FUBAR_DRAW'          // payload: {}
  | 'EXIT_GT_ROI'            // payload: { roiPct: number }
  | 'WIPE_FREE_RUN';         // payload: {}

export interface BountyCondition {
  template: BountyConditionTemplate;
  params: Record<string, number | string>;
}

export interface Bounty {
  bountyId: string;
  sponsorAccountId: string;
  stake: number;             // trophy currency
  condition: BountyCondition;
  conditionHash: string;
  expiryTick: number;
  status: BountyStatus;
  optIns: string[];          // accountIds that opted in per run
  claimedBy: string | null;
  proofHash: string | null;
  refundAmount: number;
  burnAmount: number;
  createdAt: number;         // wall tick
}

export interface BountyLedgerEvent {
  rule: 'M63';
  rule_version: '1.0';
  eventType: 'BOUNTY_CREATE' | 'BOUNTY_OPTIN' | 'BOUNTY_CLAIM' | 'BOUNTY_EXPIRE';
  bountyId: string;
  accountId: string;
  tick: number;
  payload: Record<string, unknown>;
  auditHash: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_STAKE_PER_DAY = 5_000;       // trophy currency
const MAX_STAKE_PER_SEASON = 50_000;
const REFUND_FRACTION = 0.60;          // 60% back to sponsor on expiry
const BURN_FRACTION = 0.40;            // 40% to season sink (M65 compliance)
const OPT_IN_WINDOW_TICKS = 5;        // window after ACTIVE to join
const MIN_STAKE = 50;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function bountyAuditHash(b: Pick<Bounty, 'bountyId' | 'stake' | 'conditionHash' | 'status'>, version = '1.0'): string {
  return sha256(JSON.stringify({ ...b, policy_version: version })).slice(0, 32);
}

function ledgerEvent(
  eventType: BountyLedgerEvent['eventType'],
  bounty: Bounty,
  accountId: string,
  tick: number,
  payload: Record<string, unknown>,
): BountyLedgerEvent {
  const auditHash = bountyAuditHash({ bountyId: bounty.bountyId, stake: bounty.stake, conditionHash: bounty.conditionHash, status: bounty.status });
  return { rule: 'M63', rule_version: '1.0', eventType, bountyId: bounty.bountyId, accountId, tick, payload, auditHash };
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateBountyCondition(condition: BountyCondition): string | null {
  const template = condition.template;
  switch (template) {
    case 'FLIP_WITH_HEAT_GTE':
      if (typeof condition.params.heatThreshold !== 'number') return 'MISSING_PARAM: heatThreshold';
      break;
    case 'SURVIVE_MACRO_SHOCK':
      if (typeof condition.params.shockCount !== 'number') return 'MISSING_PARAM: shockCount';
      break;
    case 'FULL_LADDER_IN_N_TICKS':
      if (typeof condition.params.ticks !== 'number') return 'MISSING_PARAM: ticks';
      break;
    case 'EXIT_GT_ROI':
      if (typeof condition.params.roiPct !== 'number') return 'MISSING_PARAM: roiPct';
      break;
    case 'NO_FUBAR_DRAW':
    case 'WIPE_FREE_RUN':
      break;
    default:
      return `UNKNOWN_TEMPLATE: ${template}`;
  }
  return null;
}

// ─── Core API ─────────────────────────────────────────────────────────────────

/**
 * Phase 1: Sponsor creates bounty. Stake is NOT locked yet.
 * Server validates stake limits before proceeding to escrow.
 */
export function createBounty(
  sponsorAccountId: string,
  stake: number,
  condition: BountyCondition,
  expiryTick: number,
  currentTick: number,
  sponsorDailyTotal: number,
  sponsorSeasonTotal: number,
): { bounty: Bounty; event: BountyLedgerEvent } | { error: string } {
  if (stake < MIN_STAKE) return { error: `MIN_STAKE: minimum is ${MIN_STAKE}` };
  if (sponsorDailyTotal + stake > MAX_STAKE_PER_DAY) return { error: 'DAILY_STAKE_LIMIT_EXCEEDED' };
  if (sponsorSeasonTotal + stake > MAX_STAKE_PER_SEASON) return { error: 'SEASON_STAKE_LIMIT_EXCEEDED' };

  const condErr = validateBountyCondition(condition);
  if (condErr) return { error: condErr };

  const conditionHash = sha256(JSON.stringify(condition));
  const bountyId = sha256(`bounty:${sponsorAccountId}:${conditionHash}:${currentTick}`).slice(0, 20);

  const bounty: Bounty = {
    bountyId,
    sponsorAccountId,
    stake,
    condition,
    conditionHash,
    expiryTick,
    status: 'PENDING_ESCROW',
    optIns: [],
    claimedBy: null,
    proofHash: null,
    refundAmount: Math.floor(stake * REFUND_FRACTION),
    burnAmount: Math.ceil(stake * BURN_FRACTION),
    createdAt: currentTick,
  };

  const event = ledgerEvent('BOUNTY_CREATE', bounty, sponsorAccountId, currentTick, {
    stake,
    conditionHash,
    expiryTick,
  });

  return { bounty, event };
}

/**
 * Phase 2: Escrow lock confirmed. Bounty goes ACTIVE.
 */
export function activateBounty(
  bounty: Bounty,
  tick: number,
): { bounty: Bounty; event: BountyLedgerEvent } {
  if (bounty.status !== 'PENDING_ESCROW') throw new Error('M63: not in PENDING_ESCROW');
  const updated: Bounty = { ...bounty, status: 'ACTIVE' };
  const event = ledgerEvent('BOUNTY_CREATE', updated, bounty.sponsorAccountId, tick, { status: 'ACTIVE' });
  return { bounty: updated, event };
}

/**
 * A player opts in to a bounty for the current run.
 * Must be within OPT_IN_WINDOW_TICKS of activation.
 * Sponsor cannot opt-in to their own bounty.
 */
export function optInToBounty(
  bounty: Bounty,
  accountId: string,
  tick: number,
  activatedAt: number,
): { bounty: Bounty; event: BountyLedgerEvent } | { error: string } {
  if (bounty.status !== 'ACTIVE') return { error: 'BOUNTY_NOT_ACTIVE' };
  if (accountId === bounty.sponsorAccountId) return { error: 'SPONSOR_CANNOT_CLAIM_OWN_BOUNTY' };
  if (tick - activatedAt > OPT_IN_WINDOW_TICKS) return { error: 'OPT_IN_WINDOW_EXPIRED' };
  if (bounty.optIns.includes(accountId)) return { error: 'ALREADY_OPTED_IN' };
  if (tick > bounty.expiryTick) return { error: 'BOUNTY_EXPIRED' };

  const updated: Bounty = { ...bounty, optIns: [...bounty.optIns, accountId] };
  const event = ledgerEvent('BOUNTY_OPTIN', updated, accountId, tick, { accountId });
  return { bounty: updated, event };
}

/**
 * Attempt to claim bounty. Must be verified run; claimant must have opted in.
 * Deterministic tie-break: earliest ledger event order wins.
 */
export function claimBounty(
  bounty: Bounty,
  claimantAccountId: string,
  runProofHash: string,
  tick: number,
): { bounty: Bounty; payout: number; event: BountyLedgerEvent } | { error: string } {
  if (bounty.status !== 'ACTIVE') return { error: 'BOUNTY_NOT_ACTIVE' };
  if (!bounty.optIns.includes(claimantAccountId)) return { error: 'NOT_OPTED_IN' };
  if (claimantAccountId === bounty.sponsorAccountId) return { error: 'SPONSOR_CANNOT_CLAIM' };
  if (tick > bounty.expiryTick) return { error: 'BOUNTY_EXPIRED' };

  const updated: Bounty = {
    ...bounty,
    status: 'CLAIMED',
    claimedBy: claimantAccountId,
    proofHash: runProofHash,
  };

  const event = ledgerEvent('BOUNTY_CLAIM', updated, claimantAccountId, tick, {
    proofHash: runProofHash,
    payout: bounty.stake,
  });

  return { bounty: updated, payout: bounty.stake, event };
}

/**
 * Expire a bounty (no valid completion by expiryTick).
 * Calculates refund to sponsor + burn to season sink.
 */
export function expireBounty(
  bounty: Bounty,
  tick: number,
): { bounty: Bounty; sponsorRefund: number; sinkBurn: number; event: BountyLedgerEvent } {
  const updated: Bounty = { ...bounty, status: 'EXPIRED' };
  const event = ledgerEvent('BOUNTY_EXPIRE', updated, bounty.sponsorAccountId, tick, {
    refund: bounty.refundAmount,
    burn: bounty.burnAmount,
    outcome: 'NO_COMPLETION',
  });
  return {
    bounty: updated,
    sponsorRefund: bounty.refundAmount,
    sinkBurn: bounty.burnAmount,
    event,
  };
}

/**
 * Quarantine a bounty after fraudulent claim detection.
 * Bounty remains; claimant flagged for review.
 */
export function quarantineBounty(
  bounty: Bounty,
  tick: number,
): Bounty {
  return { ...bounty, status: 'QUARANTINED', claimedBy: null, proofHash: null };
}

/**
 * Evaluate whether a run's ledger events satisfy a bounty condition.
 * Returns true + proof details or false + failure reason.
 * This is a deterministic server-side check; no ML.
 */
export function evaluateCondition(
  condition: BountyCondition,
  runLedger: Array<{ eventType: string; payload: Record<string, unknown> }>,
): { satisfied: boolean; reason: string } {
  switch (condition.template) {
    case 'FLIP_WITH_HEAT_GTE': {
      const threshold = condition.params.heatThreshold as number;
      const hit = runLedger.some(
        e => e.eventType === 'MARKET_FLIP' && (e.payload.heat as number) >= threshold,
      );
      return { satisfied: hit, reason: hit ? 'OK' : `No flip with heat >= ${threshold}` };
    }
    case 'SURVIVE_MACRO_SHOCK': {
      const required = condition.params.shockCount as number;
      const shocks = runLedger.filter(e => e.eventType === 'MACRO_SHOCK').length;
      return { satisfied: shocks >= required, reason: shocks >= required ? 'OK' : `Only ${shocks}/${required} shocks survived` };
    }
    case 'FULL_LADDER_IN_N_TICKS': {
      const ticksAllowed = condition.params.ticks as number;
      const evt = runLedger.find(e => e.eventType === 'M32.LADDER_COMPLETE');
      const satisfied = !!evt && (evt.payload.tick as number) <= ticksAllowed;
      return { satisfied, reason: satisfied ? 'OK' : `Ladder not complete within ${ticksAllowed} ticks` };
    }
    case 'NO_FUBAR_DRAW': {
      const fubar = runLedger.some(e => e.eventType === 'CARD_DRAW' && e.payload.deckType === 'FUBAR');
      return { satisfied: !fubar, reason: !fubar ? 'OK' : 'FUBAR card drawn' };
    }
    case 'EXIT_GT_ROI': {
      const roiRequired = condition.params.roiPct as number;
      const exit = runLedger.find(e => e.eventType === 'RUN_FINAL');
      const roi = exit ? (exit.payload.roiPct as number) : 0;
      return { satisfied: roi > roiRequired, reason: roi > roiRequired ? 'OK' : `ROI ${roi}% <= required ${roiRequired}%` };
    }
    case 'WIPE_FREE_RUN': {
      const wiped = runLedger.some(e => e.eventType === 'SOLVENCY_WIPE');
      return { satisfied: !wiped, reason: !wiped ? 'OK' : 'Player wiped' };
    }
    default:
      return { satisfied: false, reason: 'UNKNOWN_CONDITION_TEMPLATE' };
  }
}
