/**
 * M77 — Delegated Operator (Temporary Table Lead) — Multiplayer Layer
 * Source spec: mechanics/M77_delegated_operator_temporary_table_lead.md
 *
 * Deploy to: pzo_server/src/multiplayer/mechanics/m077.ts
 */

import { createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OperatorAction =
  | 'PURCHASE_ASSET'
  | 'CAST_EXIT_VOTE'
  | 'ACCEPT_CONTRACT'
  | 'PROPOSE_SPLIT'
  | 'DRAW_CARD';

export type RevocationTrigger = 'VOTE' | 'BUDGET_EXHAUSTED' | 'AUTO_EXPIRY' | 'MANUAL_LEAD';

export interface DelegatedOperatorGrant {
  grantId: string;
  contractId: string;
  runSeed: string;
  operatorAccountId: string;
  grantedBy: string;                    // original table lead
  allowedActions: OperatorAction[];
  actionBudget: number;                 // max actions operator may take
  actionsUsed: number;
  expiresAtTick: number;
  isActive: boolean;
  revokedAt: number | null;
  revokedBy: RevocationTrigger | null;
  auditReceipts: OperatorReceipt[];
}

export interface OperatorReceipt {
  grantId: string;
  action: OperatorAction;
  tick: number;
  inputsHash: string;
  outcomeHash: string;
  ruleVersion: '1.0';
}

export interface OperatorLedgerEvent {
  rule: 'M77';
  rule_version: '1.0';
  eventType: 'M77.triggered' | 'M77.receipt';
  tick: number;
  grantId: string;
  short_hash: string;
  headline: string;
  inputs_hash: string;
  outcome_hash: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_ACTION_BUDGET = 5;
const DEFAULT_GRANT_DURATION_TICKS = 6;
const VOTE_THRESHOLD_PERCENT = 0.5;  // >50% to revoke

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function shortHash(data: string): string {
  return sha256(data).slice(0, 12);
}

function buildLedgerEvent(
  eventType: OperatorLedgerEvent['eventType'],
  grantId: string,
  tick: number,
  headline: string,
  inputs: unknown,
  outcome: unknown,
): OperatorLedgerEvent {
  const inputs_hash = sha256(JSON.stringify(inputs));
  const outcome_hash = sha256(JSON.stringify(outcome));
  return {
    rule: 'M77',
    rule_version: '1.0',
    eventType,
    tick,
    grantId,
    short_hash: shortHash(`${grantId}:${tick}:${eventType}`),
    headline,
    inputs_hash,
    outcome_hash,
  };
}

// ─── Core API ─────────────────────────────────────────────────────────────────

/**
 * Grant a delegation to another table member.
 * Table lead calls this; server validates they are the lead.
 */
export function grantDelegation(
  contractId: string,
  runSeed: string,
  grantedBy: string,
  operatorAccountId: string,
  allowedActions: OperatorAction[],
  tick: number,
  actionBudget = DEFAULT_ACTION_BUDGET,
  durationTicks = DEFAULT_GRANT_DURATION_TICKS,
): { grant: DelegatedOperatorGrant; event: OperatorLedgerEvent } {
  if (grantedBy === operatorAccountId) throw new Error('M77: cannot delegate to self');
  if (allowedActions.length === 0) throw new Error('M77: allowedActions must be non-empty');

  const grantId = sha256(`m77:${runSeed}:${contractId}:${operatorAccountId}:${tick}`).slice(0, 20);

  const grant: DelegatedOperatorGrant = {
    grantId,
    contractId,
    runSeed,
    operatorAccountId,
    grantedBy,
    allowedActions,
    actionBudget,
    actionsUsed: 0,
    expiresAtTick: tick + durationTicks,
    isActive: true,
    revokedAt: null,
    revokedBy: null,
    auditReceipts: [],
  };

  const event = buildLedgerEvent(
    'M77.triggered',
    grantId,
    tick,
    `${operatorAccountId} delegated as operator by ${grantedBy}`,
    { grantedBy, operatorAccountId, allowedActions, actionBudget, expiresAtTick: grant.expiresAtTick },
    { grantId, status: 'ACTIVE' },
  );

  return { grant, event };
}

/**
 * Execute a delegated action.
 * Validates: grant active, action in scope, budget not exhausted, not expired.
 * Emits an audit receipt for every action taken.
 */
export function executeDelegatedAction(
  grant: DelegatedOperatorGrant,
  action: OperatorAction,
  actionPayload: Record<string, unknown>,
  tick: number,
): { grant: DelegatedOperatorGrant; receipt: OperatorReceipt; event: OperatorLedgerEvent } | { error: string } {
  if (!grant.isActive) return { error: 'GRANT_INACTIVE' };
  if (tick > grant.expiresAtTick) return { error: 'GRANT_EXPIRED' };
  if (!grant.allowedActions.includes(action)) return { error: `ACTION_NOT_IN_SCOPE: ${action}` };
  if (grant.actionsUsed >= grant.actionBudget) return { error: 'BUDGET_EXHAUSTED' };

  const inputsHash = sha256(JSON.stringify({ action, actionPayload, tick }));
  const outcomeHash = sha256(JSON.stringify({ grantId: grant.grantId, action, tick, actionsUsed: grant.actionsUsed + 1 }));

  const receipt: OperatorReceipt = {
    grantId: grant.grantId,
    action,
    tick,
    inputsHash,
    outcomeHash,
    ruleVersion: '1.0',
  };

  const updatedGrant: DelegatedOperatorGrant = {
    ...grant,
    actionsUsed: grant.actionsUsed + 1,
    auditReceipts: [...grant.auditReceipts, receipt],
    // auto-revoke on budget exhaustion
    isActive: grant.actionsUsed + 1 < grant.actionBudget,
    revokedAt: grant.actionsUsed + 1 >= grant.actionBudget ? tick : grant.revokedAt,
    revokedBy: grant.actionsUsed + 1 >= grant.actionBudget ? 'BUDGET_EXHAUSTED' : grant.revokedBy,
  };

  const event = buildLedgerEvent(
    'M77.receipt',
    grant.grantId,
    tick,
    `Operator ${grant.operatorAccountId} executed ${action}`,
    { action, actionPayload },
    { outcomeHash, actionsUsed: updatedGrant.actionsUsed, budgetRemaining: updatedGrant.actionBudget - updatedGrant.actionsUsed },
  );

  return { grant: updatedGrant, receipt, event };
}

/**
 * Vote to revoke the delegation.
 * Majority of connected table members required.
 * Server tracks vote collection; this function evaluates current tally.
 */
export function evaluateRevocationVote(
  grant: DelegatedOperatorGrant,
  votes: Record<string, 'YES' | 'NO'>, // accountId → vote
  totalMembers: number,
  tick: number,
): { revoked: boolean; grant: DelegatedOperatorGrant; event: OperatorLedgerEvent } {
  const yesCount = Object.values(votes).filter(v => v === 'YES').length;
  const threshold = Math.ceil(totalMembers * VOTE_THRESHOLD_PERCENT) + 1;
  const revoked = yesCount >= threshold;

  const updatedGrant: DelegatedOperatorGrant = revoked
    ? { ...grant, isActive: false, revokedAt: tick, revokedBy: 'VOTE' }
    : grant;

  const event = buildLedgerEvent(
    'M77.triggered',
    grant.grantId,
    tick,
    revoked
      ? `Delegation to ${grant.operatorAccountId} revoked by vote`
      : `Revocation vote failed: ${yesCount}/${threshold} required`,
    { votes, totalMembers },
    { revoked, yesCount, threshold },
  );

  return { revoked, grant: updatedGrant, event };
}

/**
 * Auto-expire a delegation at tick boundary.
 * Call at the start of each tick to enforce timer-driven expiry.
 */
export function tickExpiry(
  grant: DelegatedOperatorGrant,
  currentTick: number,
): { grant: DelegatedOperatorGrant; event: OperatorLedgerEvent | null } {
  if (!grant.isActive || currentTick <= grant.expiresAtTick) return { grant, event: null };

  const expired: DelegatedOperatorGrant = {
    ...grant,
    isActive: false,
    revokedAt: currentTick,
    revokedBy: 'AUTO_EXPIRY',
  };

  const event = buildLedgerEvent(
    'M77.triggered',
    grant.grantId,
    currentTick,
    `Delegation to ${grant.operatorAccountId} auto-expired`,
    { expiresAtTick: grant.expiresAtTick, currentTick },
    { revoked: true, trigger: 'AUTO_EXPIRY' },
  );

  return { grant: expired, event };
}

/**
 * Manual revocation by the original table lead.
 */
export function revokeManually(
  grant: DelegatedOperatorGrant,
  revokerAccountId: string,
  tick: number,
): { grant: DelegatedOperatorGrant; event: OperatorLedgerEvent } | { error: string } {
  if (revokerAccountId !== grant.grantedBy) return { error: 'ONLY_LEAD_CAN_REVOKE' };
  if (!grant.isActive) return { error: 'GRANT_ALREADY_INACTIVE' };

  const revoked: DelegatedOperatorGrant = {
    ...grant,
    isActive: false,
    revokedAt: tick,
    revokedBy: 'MANUAL_LEAD',
  };

  const event = buildLedgerEvent(
    'M77.triggered',
    grant.grantId,
    tick,
    `Delegation revoked manually by table lead ${revokerAccountId}`,
    { revokerAccountId },
    { revoked: true, trigger: 'MANUAL_LEAD' },
  );

  return { grant: revoked, event };
}
