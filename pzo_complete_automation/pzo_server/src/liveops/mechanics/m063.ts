/**
 * M63 — Sponsored Bounties (Player-Funded Challenges for the Table)
 * PZO_T00177 | Phase: PZO_P05_ML_MONETIZATION
 * File: pzo_server/src/liveops/mechanics/m063.ts
 */

export type BountyStatus = 'open' | 'claimed' | 'expired' | 'cancelled';
export type BountyTrigger =
  | 'first_to_net_worth'
  | 'first_acquisition'
  | 'most_deals_in_round'
  | 'highest_roi_this_turn'
  | 'survive_n_rounds'
  | 'custom';

export interface BountyCondition {
  trigger: BountyTrigger;
  targetValue?: number;  // e.g., net worth threshold
  turnsAllowed?: number; // for time-boxed bounties
  customDescription?: string;
}

export interface SponsoredBounty {
  bountyId: string;
  sponsorPlayerId: string;
  tableId: string;
  reward: number;         // currency units
  condition: BountyCondition;
  status: BountyStatus;
  createdTurn: number;
  expiryTurn: number;
  claimedByPlayerId?: string;
  claimedTurn?: number;
  minSponsorBalance: number;  // sponsor must hold this on escrow
  escrowLocked: boolean;
}

export interface BountyLedger {
  tableId: string;
  bounties: SponsoredBounty[];
  escrow: Record<string, number>; // playerId → escrowed amount
}

export function createBounty(
  ledger: BountyLedger,
  bountyId: string,
  sponsorPlayerId: string,
  reward: number,
  condition: BountyCondition,
  currentTurn: number,
  expiryTurns = 5,
  sponsorBalance: number
): { ok: boolean; reason?: string } {
  if (reward <= 0) return { ok: false, reason: 'reward_must_be_positive' };
  if (sponsorBalance < reward) return { ok: false, reason: 'insufficient_balance_for_escrow' };

  const bounty: SponsoredBounty = {
    bountyId,
    sponsorPlayerId,
    tableId: ledger.tableId,
    reward,
    condition,
    status: 'open',
    createdTurn: currentTurn,
    expiryTurn: currentTurn + expiryTurns,
    minSponsorBalance: reward,
    escrowLocked: true,
  };

  ledger.bounties.push(bounty);
  ledger.escrow[sponsorPlayerId] = (ledger.escrow[sponsorPlayerId] ?? 0) + reward;
  return { ok: true };
}

export function evaluateBountyCondition(
  bounty: SponsoredBounty,
  candidatePlayerId: string,
  gameState: {
    currentTurn: number;
    playerNetWorth: Record<string, number>;
    playerAcquisitions: Record<string, number>;
    playerDealsThisRound: Record<string, number>;
    playerROIThisTurn: Record<string, number>;
    playerSurvivalTurns: Record<string, number>;
  }
): boolean {
  if (bounty.status !== 'open') return false;
  if (gameState.currentTurn > bounty.expiryTurn) return false;
  if (candidatePlayerId === bounty.sponsorPlayerId) return false; // sponsor can't claim own bounty

  const { trigger, targetValue, turnsAllowed } = bounty.condition;

  switch (trigger) {
    case 'first_to_net_worth':
      return (gameState.playerNetWorth[candidatePlayerId] ?? 0) >= (targetValue ?? 0);
    case 'first_acquisition':
      return (gameState.playerAcquisitions[candidatePlayerId] ?? 0) >= 1;
    case 'most_deals_in_round': {
      const candidate = gameState.playerDealsThisRound[candidatePlayerId] ?? 0;
      const max = Math.max(...Object.values(gameState.playerDealsThisRound));
      return candidate > 0 && candidate === max;
    }
    case 'highest_roi_this_turn': {
      const roi = gameState.playerROIThisTurn[candidatePlayerId] ?? -Infinity;
      const maxRoi = Math.max(...Object.values(gameState.playerROIThisTurn));
      return roi === maxRoi && roi > 0;
    }
    case 'survive_n_rounds':
      return (gameState.playerSurvivalTurns[candidatePlayerId] ?? 0) >= (turnsAllowed ?? 1);
    case 'custom':
      // Custom conditions must be verified externally
      return false;
    default:
      return false;
  }
}

export function claimBounty(
  ledger: BountyLedger,
  bountyId: string,
  claimantId: string,
  currentTurn: number,
  gameState: Parameters<typeof evaluateBountyCondition>[2]
): { ok: boolean; reward: number; reason?: string } {
  const bounty = ledger.bounties.find(b => b.bountyId === bountyId);
  if (!bounty) return { ok: false, reward: 0, reason: 'bounty_not_found' };
  if (bounty.status !== 'open') return { ok: false, reward: 0, reason: 'bounty_not_open' };
  if (currentTurn > bounty.expiryTurn) {
    bounty.status = 'expired';
    return { ok: false, reward: 0, reason: 'bounty_expired' };
  }

  const eligible = evaluateBountyCondition(bounty, claimantId, gameState);
  if (!eligible) return { ok: false, reward: 0, reason: 'condition_not_met' };

  bounty.status = 'claimed';
  bounty.claimedByPlayerId = claimantId;
  bounty.claimedTurn = currentTurn;

  // Release escrow
  ledger.escrow[bounty.sponsorPlayerId] = Math.max(
    0,
    (ledger.escrow[bounty.sponsorPlayerId] ?? 0) - bounty.reward
  );

  return { ok: true, reward: bounty.reward };
}

export function expireStale(ledger: BountyLedger, currentTurn: number): number {
  let count = 0;
  for (const b of ledger.bounties) {
    if (b.status === 'open' && currentTurn > b.expiryTurn) {
      b.status = 'expired';
      // Refund escrow to sponsor
      ledger.escrow[b.sponsorPlayerId] = Math.max(
        0,
        (ledger.escrow[b.sponsorPlayerId] ?? 0) - b.reward
      );
      count++;
    }
  }
  return count;
}

export function getActiveBounties(ledger: BountyLedger, currentTurn: number): SponsoredBounty[] {
  return ledger.bounties.filter(b => b.status === 'open' && currentTurn <= b.expiryTurn);
}
