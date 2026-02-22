/**
 * M51 — Syndicate Deals (Multi-Party Co-op Acquisitions) — Multiplayer Rules
 * PZO_T00165 | Phase: PZO_P04_MULTIPLAYER
 * File: pzo_server/src/multiplayer/mechanics/m051.ts
 */

export type SyndicateRole = 'lead' | 'co-investor' | 'advisor';
export type SyndicateStatus = 'forming' | 'active' | 'closed' | 'dissolved';

export interface SyndicateMember {
  playerId: string;
  role: SyndicateRole;
  capitalCommitted: number;
  capitalCalled: number;
  equityShare: number;       // 0–1, must sum to 1 across all members
  votingWeight: number;      // 0–1
  joinedTurn: number;
  hasApproved: boolean;
}

export interface SyndicateDeal {
  dealId: string;
  targetAssetId: string;
  totalCapitalRequired: number;
  members: SyndicateMember[];
  status: SyndicateStatus;
  leadPlayerId: string;
  createdTurn: number;
  expiryTurn: number;
  approvalThreshold: number; // 0–1, fraction of voting weight needed
  profitSplit: 'pro_rata' | 'tiered' | 'lead_premium';
  leadPremiumBP: number;     // bonus BP for lead if profitSplit = lead_premium
}

export interface SyndicateAction {
  type:
    | 'invite'
    | 'accept'
    | 'reject'
    | 'commit_capital'
    | 'call_capital'
    | 'vote_close'
    | 'dissolve'
    | 'distribute_proceeds';
  actorId: string;
  payload?: Record<string, unknown>;
}

export function createSyndicateDeal(
  dealId: string,
  leadPlayerId: string,
  targetAssetId: string,
  totalCapitalRequired: number,
  currentTurn: number,
  expiryTurns = 3
): SyndicateDeal {
  return {
    dealId,
    targetAssetId,
    totalCapitalRequired,
    members: [
      {
        playerId: leadPlayerId,
        role: 'lead',
        capitalCommitted: 0,
        capitalCalled: 0,
        equityShare: 0,
        votingWeight: 0.51, // lead has casting vote by default
        joinedTurn: currentTurn,
        hasApproved: false,
      },
    ],
    status: 'forming',
    leadPlayerId,
    createdTurn: currentTurn,
    expiryTurn: currentTurn + expiryTurns,
    approvalThreshold: 0.66,
    profitSplit: 'pro_rata',
    leadPremiumBP: 0,
  };
}

export function inviteMember(
  deal: SyndicateDeal,
  actorId: string,
  inviteeId: string,
  role: SyndicateRole,
  currentTurn: number
): { ok: boolean; reason?: string } {
  if (actorId !== deal.leadPlayerId) return { ok: false, reason: 'only_lead_can_invite' };
  if (deal.status !== 'forming') return { ok: false, reason: 'deal_not_forming' };
  if (currentTurn > deal.expiryTurn) return { ok: false, reason: 'deal_expired' };
  if (deal.members.find(m => m.playerId === inviteeId)) return { ok: false, reason: 'already_member' };
  deal.members.push({
    playerId: inviteeId,
    role,
    capitalCommitted: 0,
    capitalCalled: 0,
    equityShare: 0,
    votingWeight: 0,
    joinedTurn: currentTurn,
    hasApproved: false,
  });
  rebalanceVotingWeights(deal);
  return { ok: true };
}

function rebalanceVotingWeights(deal: SyndicateDeal): void {
  const nonLead = deal.members.filter(m => m.role !== 'lead');
  const leadMember = deal.members.find(m => m.playerId === deal.leadPlayerId)!;
  const leadWeight = 0.51;
  const remainingWeight = 1 - leadWeight;
  const perMember = nonLead.length > 0 ? remainingWeight / nonLead.length : 0;
  leadMember.votingWeight = leadWeight;
  for (const m of nonLead) m.votingWeight = perMember;
}

export function commitCapital(
  deal: SyndicateDeal,
  playerId: string,
  amount: number
): { ok: boolean; reason?: string } {
  const member = deal.members.find(m => m.playerId === playerId);
  if (!member) return { ok: false, reason: 'not_a_member' };
  if (deal.status !== 'forming' && deal.status !== 'active') return { ok: false, reason: 'deal_closed' };
  member.capitalCommitted += amount;
  recalcEquityShares(deal);
  return { ok: true };
}

function recalcEquityShares(deal: SyndicateDeal): void {
  const total = deal.members.reduce((s, m) => s + m.capitalCommitted, 0);
  if (total === 0) return;
  for (const m of deal.members) {
    m.equityShare = m.capitalCommitted / total;
  }
}

export function voteClose(
  deal: SyndicateDeal,
  playerId: string
): { ok: boolean; closed: boolean; reason?: string } {
  const member = deal.members.find(m => m.playerId === playerId);
  if (!member) return { ok: false, closed: false, reason: 'not_a_member' };
  member.hasApproved = true;
  const totalApprovalWeight = deal.members
    .filter(m => m.hasApproved)
    .reduce((s, m) => s + m.votingWeight, 0);
  if (totalApprovalWeight >= deal.approvalThreshold) {
    deal.status = 'active';
    return { ok: true, closed: true };
  }
  return { ok: true, closed: false };
}

export function distributeProceeds(
  deal: SyndicateDeal,
  totalProceeds: number
): Array<{ playerId: string; amount: number }> {
  if (deal.profitSplit === 'lead_premium') {
    const leadBonus = Math.round(totalProceeds * (deal.leadPremiumBP / 10000));
    const remaining = totalProceeds - leadBonus;
    return deal.members.map(m => ({
      playerId: m.playerId,
      amount: Math.round(m.playerId === deal.leadPlayerId
        ? leadBonus + remaining * m.equityShare
        : remaining * m.equityShare),
    }));
  }
  // pro_rata or tiered (tiered = future extension, falls back to pro_rata)
  return deal.members.map(m => ({
    playerId: m.playerId,
    amount: Math.round(totalProceeds * m.equityShare),
  }));
}

export function dissolveDeal(
  deal: SyndicateDeal,
  actorId: string
): { ok: boolean; refunds: Array<{ playerId: string; amount: number }>; reason?: string } {
  if (actorId !== deal.leadPlayerId) return { ok: false, refunds: [], reason: 'only_lead_can_dissolve' };
  if (deal.status === 'closed') return { ok: false, refunds: [], reason: 'already_closed' };
  deal.status = 'dissolved';
  const refunds = deal.members.map(m => ({ playerId: m.playerId, amount: m.capitalCommitted }));
  return { ok: true, refunds };
}
