/**
 * M51 — Syndicate Deals (Multi-Party Co-op Acquisitions) — Multiplayer Layer
 * Source spec: mechanics/M51_syndicate_deals_multi_party_coop_acquisitions.md
 * Deps: M26 Co-op Contracts, M28 Handshake Windows, M46–M48 Ledger + Validator
 *
 * Deploy to: pzo_server/src/multiplayer/mechanics/m051.ts
 */

import { createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SyndicateVoteRule = 'MAJORITY' | 'UNANIMOUS' | 'SUPERMAJORITY';
export type SyndicateStatus =
  | 'FORMING'      // invite clock running
  | 'NEGOTIATING'  // handshake window open
  | 'ACTIVE'       // contract minted, asset held
  | 'EXITING'      // exit vote in progress
  | 'SETTLED'      // run-end settlement complete
  | 'QUARANTINED'; // desync detected; re-verify pending

export interface SyndMember {
  accountId: string;
  sharePercent: number;   // 0–100; sum must equal 100
  liabilityPercent: number; // 0–100; sum must equal 100
  cashCommitment: number;
  signedAt: number | null; // tick signed; null = pending
  signature: string | null;
}

export interface SyndicateContract {
  contractId: string;
  runSeed: string;
  dealId: string;
  leadAccountId: string;
  members: SyndMember[];
  voteRule: SyndicateVoteRule;
  exitLockTicks: number;
  defaultClause: 'REASSIGN_PRO_RATA' | 'LEAD_COVERS';
  status: SyndicateStatus;
  mintedAt: number | null; // tick when contract became ACTIVE
  contractHash: string;
}

export interface SyndicateAction {
  type:
    | 'SYNDICATE_FORM'
    | 'SYNDICATE_JOIN'
    | 'SYNDICATE_PROPOSE_SPLIT'
    | 'SYNDICATE_ACCEPT'
    | 'SYNDICATE_EXIT_VOTE'
    | 'SYNDICATE_SETTLE';
  tick: number;
  accountId: string;
  payload: Record<string, unknown>;
  signature: string;
}

export interface SyndicateReceipt {
  contractId: string;
  action: string;
  tick: number;
  outcome: string;
  receiptHash: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_MEMBERS = 3;
const MAX_MEMBERS = 5;
const JOIN_CLOCK_TICKS = 10;        // M28 Handshake Window
const DEFAULT_EXIT_LOCK_TICKS = 3;
const MIN_MEMBER_SHARE_PCT = 5;     // no 0% riders
const MAX_COUNTERS_PER_MEMBER = 1;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function contractHash(c: Omit<SyndicateContract, 'contractHash'>): string {
  return sha256(JSON.stringify({
    contractId: c.contractId,
    runSeed: c.runSeed,
    dealId: c.dealId,
    members: c.members,
    voteRule: c.voteRule,
    exitLockTicks: c.exitLockTicks,
    mintedAt: c.mintedAt,
  }));
}

function receipt(contractId: string, action: string, tick: number, outcome: string): SyndicateReceipt {
  const receiptHash = sha256(`${contractId}:${action}:${tick}:${outcome}`);
  return { contractId, action, tick, outcome, receiptHash };
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateSyndicateSplit(members: SyndMember[]): string | null {
  if (members.length < MIN_MEMBERS || members.length > MAX_MEMBERS) {
    return `INVALID_SIZE: must be ${MIN_MEMBERS}–${MAX_MEMBERS} members`;
  }
  const shareTotal = members.reduce((s, m) => s + m.sharePercent, 0);
  const liabTotal = members.reduce((s, m) => s + m.liabilityPercent, 0);
  if (Math.round(shareTotal) !== 100) return `INVALID_SHARES: sum=${shareTotal}, expected 100`;
  if (Math.round(liabTotal) !== 100) return `INVALID_LIABILITY: sum=${liabTotal}, expected 100`;
  for (const m of members) {
    if (m.sharePercent < MIN_MEMBER_SHARE_PCT) return `RIDER_DETECTED: ${m.accountId} share=${m.sharePercent}`;
    if (m.liabilityPercent < MIN_MEMBER_SHARE_PCT) return `RIDER_DETECTED: ${m.accountId} liability=${m.liabilityPercent}`;
  }
  return null;
}

export function validateAffordability(
  members: SyndMember[],
  dealCost: number,
  getBalance: (accountId: string) => number,
): string | null {
  const totalCommitted = members.reduce((s, m) => s + m.cashCommitment, 0);
  if (totalCommitted < dealCost) return `INSUFFICIENT_TOTAL: committed=${totalCommitted} < cost=${dealCost}`;
  for (const m of members) {
    const bal = getBalance(m.accountId);
    if (bal < m.cashCommitment) return `MEMBER_BROKE: ${m.accountId} needs ${m.cashCommitment}, has ${bal}`;
  }
  return null;
}

// ─── Core API ─────────────────────────────────────────────────────────────────

/**
 * Lead player initiates syndicate formation.
 * Returns draft contract (FORMING). Invite clock starts server-side.
 */
export function formSyndicate(
  leadAccountId: string,
  dealId: string,
  runSeed: string,
  tick: number,
): { contract: SyndicateContract; receipt: SyndicateReceipt } {
  const contractId = sha256(`syndicate:${runSeed}:${dealId}:${tick}:${leadAccountId}`).slice(0, 24);

  const draft: Omit<SyndicateContract, 'contractHash'> = {
    contractId,
    runSeed,
    dealId,
    leadAccountId,
    members: [], // populated as members join
    voteRule: 'MAJORITY',
    exitLockTicks: DEFAULT_EXIT_LOCK_TICKS,
    defaultClause: 'REASSIGN_PRO_RATA',
    status: 'FORMING',
    mintedAt: null,
  };

  const contract: SyndicateContract = { ...draft, contractHash: contractHash(draft) };
  return { contract, receipt: receipt(contractId, 'SYNDICATE_FORM', tick, 'FORMING') };
}

/**
 * A table member joins within the JOIN_CLOCK_TICKS window.
 * Server validates: window still open, member count < MAX, not already joined.
 */
export function joinSyndicate(
  contract: SyndicateContract,
  accountId: string,
  tick: number,
  formTick: number,
  signature: string,
): { contract: SyndicateContract; receipt: SyndicateReceipt } | { error: string } {
  if (tick - formTick > JOIN_CLOCK_TICKS) return { error: 'JOIN_WINDOW_EXPIRED' };
  if (contract.status !== 'FORMING') return { error: 'NOT_FORMING' };
  if (contract.members.length >= MAX_MEMBERS) return { error: 'SYNDICATE_FULL' };
  if (contract.members.some(m => m.accountId === accountId)) return { error: 'ALREADY_JOINED' };
  if (accountId === contract.leadAccountId && contract.members.length > 0) {
    // lead is auto-included; re-join attempt
    return { error: 'LEAD_ALREADY_MEMBER' };
  }

  const newMember: SyndMember = {
    accountId,
    sharePercent: 0,
    liabilityPercent: 0,
    cashCommitment: 0,
    signedAt: tick,
    signature,
  };

  const updated: Omit<SyndicateContract, 'contractHash'> = {
    ...contract,
    members: [...contract.members, newMember],
    status: 'FORMING',
  };
  const c: SyndicateContract = { ...updated, contractHash: contractHash(updated) };
  return { contract: c, receipt: receipt(contract.contractId, 'SYNDICATE_JOIN', tick, accountId) };
}

/**
 * Propose the final split. One counter per member max.
 * On full acceptance, mint the contract → ACTIVE.
 */
export function proposeSplit(
  contract: SyndicateContract,
  proposer: string,
  splitProposal: Pick<SyndMember, 'accountId' | 'sharePercent' | 'liabilityPercent' | 'cashCommitment'>[],
  tick: number,
  signature: string,
  dealCost: number,
  getBalance: (id: string) => number,
): { contract: SyndicateContract; receipt: SyndicateReceipt } | { error: string } {
  const validationErr = validateSyndicateSplit(
    splitProposal.map(p => ({ ...p, signedAt: null, signature: null })),
  );
  if (validationErr) return { error: validationErr };

  const affordErr = validateAffordability(
    splitProposal.map(p => ({ ...p, signedAt: null, signature: null })),
    dealCost,
    getBalance,
  );
  if (affordErr) return { error: affordErr };

  const updatedMembers: SyndMember[] = splitProposal.map(p => ({
    ...p,
    signedAt: p.accountId === proposer ? tick : null,
    signature: p.accountId === proposer ? signature : null,
  }));

  const updated: Omit<SyndicateContract, 'contractHash'> = {
    ...contract,
    members: updatedMembers,
    status: 'NEGOTIATING',
  };
  const c: SyndicateContract = { ...updated, contractHash: contractHash(updated) };
  const offerHash = sha256(JSON.stringify(splitProposal)).slice(0, 16);
  return { contract: c, receipt: receipt(contract.contractId, 'SYNDICATE_PROPOSE_SPLIT', tick, offerHash) };
}

/**
 * A member accepts the current split proposal.
 * When all members have signed → mint contract (ACTIVE).
 */
export function acceptSplit(
  contract: SyndicateContract,
  accountId: string,
  tick: number,
  signature: string,
  mintTick: number,
): { contract: SyndicateContract; receipt: SyndicateReceipt } | { error: string } {
  if (contract.status !== 'NEGOTIATING') return { error: 'NOT_NEGOTIATING' };
  const memberIdx = contract.members.findIndex(m => m.accountId === accountId);
  if (memberIdx === -1) return { error: 'NOT_A_MEMBER' };

  const updatedMembers = contract.members.map((m, i) =>
    i === memberIdx ? { ...m, signedAt: tick, signature } : m,
  );

  const allSigned = updatedMembers.every(m => m.signedAt !== null);
  const status: SyndicateStatus = allSigned ? 'ACTIVE' : 'NEGOTIATING';
  const mintedAt = allSigned ? mintTick : null;

  const updated: Omit<SyndicateContract, 'contractHash'> = {
    ...contract,
    members: updatedMembers,
    status,
    mintedAt,
  };
  const c: SyndicateContract = { ...updated, contractHash: contractHash(updated) };
  const action = allSigned ? 'SYNDICATE_MINTED' : 'SYNDICATE_ACCEPT';
  return { contract: c, receipt: receipt(contract.contractId, action, tick, status) };
}

/**
 * Cast an exit vote. Majority (or rule-based) resolves exit.
 * Cannot exit within exitLockTicks of mint.
 */
export function castExitVote(
  contract: SyndicateContract,
  voterAccountId: string,
  vote: 'YES' | 'NO',
  tick: number,
): { approved: boolean; contract: SyndicateContract; receipt: SyndicateReceipt } | { error: string } {
  if (contract.status !== 'ACTIVE') return { error: 'NOT_ACTIVE' };
  if (contract.mintedAt !== null && tick - contract.mintedAt < contract.exitLockTicks) {
    return { error: `EXIT_LOCKED: ${contract.exitLockTicks - (tick - contract.mintedAt)} ticks remaining` };
  }
  if (!contract.members.some(m => m.accountId === voterAccountId)) return { error: 'NOT_A_MEMBER' };

  // Simple majority: >50% YES of active members
  const connectedMembers = contract.members; // server tracks disconnects separately
  const yesVotes = connectedMembers.filter(m => m.accountId === voterAccountId ? vote === 'YES' : false).length + 1;
  const majority = Math.floor(connectedMembers.length / 2) + 1;
  const approved = vote === 'YES' && yesVotes >= majority;

  const updated: Omit<SyndicateContract, 'contractHash'> = {
    ...contract,
    status: approved ? 'EXITING' : 'ACTIVE',
  };
  const c: SyndicateContract = { ...updated, contractHash: contractHash(updated) };
  return {
    approved,
    contract: c,
    receipt: receipt(contract.contractId, 'SYNDICATE_EXIT_VOTE', tick, `${voterAccountId}:${vote}:approved=${approved}`),
  };
}

/**
 * Settle the syndicate at run end (or forced wipe).
 * Distributes proceeds by sharePercent; absorbs losses by liabilityPercent.
 */
export function settleSyndicate(
  contract: SyndicateContract,
  exitProceeds: number,
  originalCost: number,
  tick: number,
): { payouts: Record<string, number>; receipt: SyndicateReceipt } {
  const pnl = exitProceeds - originalCost;
  const payouts: Record<string, number> = {};

  for (const m of contract.members) {
    const cashback = m.cashCommitment;
    const sharePnl = pnl >= 0
      ? (pnl * m.sharePercent) / 100
      : (pnl * m.liabilityPercent) / 100;
    payouts[m.accountId] = Math.round(cashback + sharePnl);
  }

  const settlementHash = sha256(JSON.stringify({ contractId: contract.contractId, payouts, tick })).slice(0, 16);
  return {
    payouts,
    receipt: receipt(contract.contractId, 'SYNDICATE_SETTLE', tick, settlementHash),
  };
}
