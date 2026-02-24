/**
 * PZO SPRINT 7 — src/engine/clubEngine.ts
 *
 * Core logic for club play:
 *   - Market row card management (spawn, claim, expire, AI competition)
 *   - Interaction card creation and resolution
 *   - Reputation consequence application
 *   - Challenge resolution (cashflow duel / net worth race)
 *   - Session action log (tamper-evident, used in Sprint 8 verification)
 */

import type {
  MarketRowState,
  MarketRowCard,
  InteractionCard,
  InteractionCardType,
  ClubPlayer,
  ClubSession,
  SessionAction,
  AidPayload,
  TradePayload,
  BlockPayload,
  ChallengePayload,
  AlliancePayload,
  SocialReputationEvent,
} from '../types/club';

import { SOCIAL_REPUTATION_EVENTS, MODERATOR_RULE_SETS } from '../types/club';
import type { Card } from '../components/CardHand';

// ─── Seeded RNG ───────────────────────────────────────────────────────────────

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function hashAction(prevHash: string, action: Omit<SessionAction, 'hash'>): string {
  const payload = `${prevHash}|${action.tick}|${action.playerId}|${action.type}|${JSON.stringify(action.payload)}|${action.timestamp}`;
  return hashString(payload).toString(16).padStart(8, '0');
}

// ─── Market Row Engine ────────────────────────────────────────────────────────

export function initMarketRow(sessionSeed: number): MarketRowState {
  return {
    slots: [],
    maxSlots: 4,
    refreshCadenceTicks: 45,
    lastRefreshTick: 0,
    aiCompetitorPressure: 0.3,
  };
}

export function tickMarketRow(
  state: MarketRowState,
  currentTick: number,
  cardPool: Card[],
  sessionSeed: number,
): { newState: MarketRowState; spawned: MarketRowCard[]; expired: MarketRowCard[] } {
  const rng = mulberry32(sessionSeed ^ currentTick);
  const spawned: MarketRowCard[] = [];
  const expired: MarketRowCard[] = [];

  // Mark expired cards
  const active = state.slots.filter(s => {
    if (s.expiresAtTick <= currentTick && !s.claimedByPlayerId) {
      expired.push(s);
      return false;
    }
    return true;
  });

  // Refresh cadence: spawn new cards to fill open slots
  const shouldRefresh = currentTick - state.lastRefreshTick >= state.refreshCadenceTicks;
  let lastRefreshTick = state.lastRefreshTick;

  if (shouldRefresh) {
    lastRefreshTick = currentTick;
    const openSlots = state.maxSlots - active.length;
    for (let i = 0; i < openSlots; i++) {
      const card = cardPool[Math.floor(rng() * cardPool.length)];
      if (!card) continue;

      // Only put playable opportunity-type cards in market row
      if (card.type !== 'OPPORTUNITY' && card.type !== 'IPA' && card.type !== 'PRIVILEGED') continue;

      const marketCard: MarketRowCard = {
        id: `market-${currentTick}-${i}-${Math.floor(rng() * 1000)}`,
        card: { ...card, id: `market-${card.id}-${currentTick}` },
        addedAtTick: currentTick,
        expiresAtTick: currentTick + 60 + Math.floor(rng() * 30),
        claimedByPlayerId: null,
        claimLockTick: null,
        minBidCash: rng() < 0.3 ? Math.round(((card.energyCost ?? 0) * 0.9) / 500) * 500 : null,
        bidders: [],
      };
      active.push(marketCard);
      spawned.push(marketCard);
    }
  }

  return {
    newState: { ...state, slots: active, lastRefreshTick },
    spawned,
    expired,
  };
}

export function claimMarketCard(
  state: MarketRowState,
  cardId: string,
  playerId: string,
  playerCash: number,
  currentTick: number,
): { success: boolean; newState: MarketRowState; reason: string } {
  const slot = state.slots.find(s => s.id === cardId);
  if (!slot) return { success: false, newState: state, reason: 'Card not in market row' };
  if (slot.claimedByPlayerId) return { success: false, newState: state, reason: 'Already claimed' };
  if (slot.expiresAtTick <= currentTick) return { success: false, newState: state, reason: 'Expired' };

  const cost = slot.minBidCash ?? slot.card.energyCost;
  if (playerCash < cost) return { success: false, newState: state, reason: `Insufficient cash: need ${cost}` };

  const newSlots = state.slots.map(s =>
    s.id === cardId
      ? { ...s, claimedByPlayerId: playerId, claimLockTick: currentTick }
      : s
  );

  return { success: true, newState: { ...state, slots: newSlots }, reason: 'Claimed' };
}

export function tickAiCompetition(
  state: MarketRowState,
  currentTick: number,
  sessionSeed: number,
): { newState: MarketRowState; aiClaims: string[] } {
  const rng = mulberry32(sessionSeed ^ currentTick ^ 0xDEADBEEF);
  const aiClaims: string[] = [];

  const newSlots = state.slots.map(slot => {
    if (slot.claimedByPlayerId) return slot;
    if (rng() < state.aiCompetitorPressure * 0.05) { // ~5% per tick at 30% pressure
      aiClaims.push(slot.card.name);
      return { ...slot, claimedByPlayerId: 'AI_COMPETITOR', claimLockTick: currentTick };
    }
    return slot;
  });

  return { newState: { ...state, slots: newSlots }, aiClaims };
}

// ─── Interaction Card Builders ────────────────────────────────────────────────

export function buildAidCard(
  sourcePlayerId: string,
  targetPlayerId: string,
  cashAmount: number,
  aidType: AidPayload['aidType'],
  repaymentTermTicks: number | null,
  currentTick: number,
): InteractionCard {
  const label = aidType === 'loan'
    ? `Loan offer: $${(cashAmount / 1000).toFixed(0)}K`
    : aidType === 'guarantee'
    ? `Guarantee: covers up to $${(cashAmount / 1000).toFixed(0)}K`
    : `Shared reserve: $${(cashAmount / 1000).toFixed(0)}K`;

  return {
    id: `aid-${sourcePlayerId}-${currentTick}`,
    type: 'AID',
    sourcePlayerId,
    targetPlayerId,
    label,
    description: repaymentTermTicks
      ? `Repay within ${Math.ceil(repaymentTermTicks / 12)} months or reputation hit.`
      : 'No repayment required — community gift.',
    payload: { type: 'AID', aidType, cashAmount, repaymentTermTicks, guaranteeCovers: null } as AidPayload,
    status: 'pending',
    issuedAtTick: currentTick,
    expiresAtTick: currentTick + 30,
    resolvedAtTick: null,
    proofEntry: `[T${currentTick}] AID offered: ${sourcePlayerId} → ${targetPlayerId}: ${label}`,
    reputationDelta: 25,
    targetReputationDelta: 10,
  };
}

export function buildTradeCard(
  sourcePlayerId: string,
  targetPlayerId: string,
  offeredCard: Card,
  requestedCard: Card | null,
  cashSweeten: number,
  currentTick: number,
): InteractionCard {
  const label = requestedCard
    ? `Trade: ${offeredCard.name} ↔ ${requestedCard.name}${cashSweeten ? ` + $${cashSweeten}` : ''}`
    : `Offer: ${offeredCard.name}${cashSweeten ? ` + $${cashSweeten}` : ''}`;

  return {
    id: `trade-${sourcePlayerId}-${currentTick}`,
    type: 'TRADE',
    sourcePlayerId,
    targetPlayerId,
    label,
    description: 'Direct card trade. Both parties must agree.',
    payload: {
      type: 'TRADE',
      offeredCardId: offeredCard.id,
      offeredCardName: offeredCard.name,
      requestedCardId: requestedCard?.id ?? null,
      requestedCardName: requestedCard?.name ?? null,
      cashSweeten,
    } as TradePayload,
    status: 'pending',
    issuedAtTick: currentTick,
    expiresAtTick: currentTick + 20,
    resolvedAtTick: null,
    proofEntry: `[T${currentTick}] TRADE proposed: ${sourcePlayerId} → ${targetPlayerId}: ${label}`,
    reputationDelta: 15,
    targetReputationDelta: 15,
  };
}

export function buildBlockCard(
  sourcePlayerId: string,
  targetPlayerId: string,
  marketCardId: string,
  blockDurationTicks: number,
  cost: number,
  currentTick: number,
): InteractionCard {
  return {
    id: `block-${sourcePlayerId}-${currentTick}`,
    type: 'BLOCK',
    sourcePlayerId,
    targetPlayerId,
    label: `Block market access: ${Math.ceil(blockDurationTicks / 12)} months`,
    description: `Prevents ${targetPlayerId} from claiming this market slot. Costs you $${cost}.`,
    payload: { type: 'BLOCK', marketCardId, blockDurationTicks, cost } as BlockPayload,
    status: 'pending',
    issuedAtTick: currentTick,
    expiresAtTick: currentTick + blockDurationTicks,
    resolvedAtTick: null,
    proofEntry: `[T${currentTick}] BLOCK: ${sourcePlayerId} → ${targetPlayerId} on market card ${marketCardId}`,
    reputationDelta: -10,
    targetReputationDelta: 5,
  };
}

export function buildChallengeCard(
  sourcePlayerId: string,
  targetPlayerId: string,
  challengeType: ChallengePayload['challengeType'],
  stakes: number,
  durationTicks: number,
  currentTick: number,
): InteractionCard {
  const metricLabel = challengeType === 'cashflow_duel' ? 'cashflow' : challengeType === 'net_worth_race' ? 'net worth' : 'bid';
  return {
    id: `challenge-${sourcePlayerId}-${currentTick}`,
    type: 'CHALLENGE',
    sourcePlayerId,
    targetPlayerId,
    label: `Challenge: ${metricLabel} duel — ${stakes} rep at stake`,
    description: `First player to reach target ${metricLabel} wins. Loser pays ${stakes} rep.`,
    payload: {
      type: 'CHALLENGE',
      challengeType,
      stakes,
      durationTicks,
      metric: challengeType === 'cashflow_duel' ? 'cashflow' : challengeType === 'net_worth_race' ? 'net_worth' : 'cash',
    } as ChallengePayload,
    status: 'pending',
    issuedAtTick: currentTick,
    expiresAtTick: currentTick + durationTicks,
    resolvedAtTick: null,
    proofEntry: `[T${currentTick}] CHALLENGE: ${sourcePlayerId} → ${targetPlayerId}: ${metricLabel} duel, ${stakes} rep`,
    reputationDelta: 20,
    targetReputationDelta: -5,
  };
}

export function buildAllianceCard(
  sourcePlayerId: string,
  targetPlayerId: string,
  allianceType: AlliancePayload['allianceType'],
  durationTicks: number,
  sharedReserveAmount: number | null,
  currentTick: number,
): InteractionCard {
  const label = allianceType === 'shared_protection'
    ? 'Alliance: shared protection'
    : allianceType === 'info_share'
    ? 'Alliance: portfolio transparency'
    : `Alliance: shared reserve $${((sharedReserveAmount ?? 0) / 1000).toFixed(0)}K`;

  return {
    id: `alliance-${sourcePlayerId}-${currentTick}`,
    type: 'ALLIANCE',
    sourcePlayerId,
    targetPlayerId,
    label,
    description: `${Math.ceil(durationTicks / 12)}-month alliance. Breaking it costs −80 rep.`,
    payload: {
      type: 'ALLIANCE',
      allianceType,
      durationTicks,
      sharedReserveAmount,
      infoReveal: allianceType === 'info_share',
    } as AlliancePayload,
    status: 'pending',
    issuedAtTick: currentTick,
    expiresAtTick: currentTick + durationTicks,
    resolvedAtTick: null,
    proofEntry: `[T${currentTick}] ALLIANCE proposed: ${sourcePlayerId} ↔ ${targetPlayerId}: ${label}`,
    reputationDelta: 30,
    targetReputationDelta: 30,
  };
}

// ─── Interaction Resolution ───────────────────────────────────────────────────

export interface InteractionResolutionResult {
  accepted: boolean;
  sourceCashDelta: number;
  targetCashDelta: number;
  sourceRepDelta: number;
  targetRepDelta: number;
  logEntry: string;
  proofEntry: string;
}

export function resolveInteraction(
  interaction: InteractionCard,
  accepted: boolean,
  currentTick: number,
): InteractionResolutionResult {
  const result: InteractionResolutionResult = {
    accepted,
    sourceCashDelta: 0,
    targetCashDelta: 0,
    sourceRepDelta: 0,
    targetRepDelta: 0,
    logEntry: '',
    proofEntry: '',
  };

  if (!accepted) {
    // Rejection reputation consequences
    const rejectionKey = `REJECT_${interaction.type}` as SocialReputationEvent['action'];
    const repEvent = SOCIAL_REPUTATION_EVENTS.find(e => e.action === rejectionKey);
    result.sourceRepDelta = repEvent?.sourceRepDelta ?? -3;
    result.targetRepDelta = repEvent?.targetRepDelta ?? 5;
    result.logEntry = `${interaction.type} rejected by ${interaction.targetPlayerId}`;
    result.proofEntry = `[T${currentTick}] REJECTED: ${interaction.proofEntry}`;
    return result;
  }

  switch (interaction.type) {
    case 'AID': {
      const p = interaction.payload as AidPayload;
      result.sourceCashDelta = -p.cashAmount;
      result.targetCashDelta = p.cashAmount;
      result.sourceRepDelta = interaction.reputationDelta;
      result.targetRepDelta = interaction.targetReputationDelta;
      result.logEntry = `Aid accepted: ${p.cashAmount >= 1000 ? `$${(p.cashAmount / 1000).toFixed(0)}K` : `$${p.cashAmount}`} transferred`;
      break;
    }
    case 'TRADE': {
      // Card swap is handled by parent (cards removed/added from hands)
      const p = interaction.payload as TradePayload;
      result.sourceCashDelta = p.cashSweeten > 0 ? -p.cashSweeten : 0;
      result.targetCashDelta = p.cashSweeten;
      result.sourceRepDelta = interaction.reputationDelta;
      result.targetRepDelta = interaction.targetReputationDelta;
      result.logEntry = `Trade complete: ${p.offeredCardName}${p.requestedCardName ? ` ↔ ${p.requestedCardName}` : ''}`;
      break;
    }
    case 'BLOCK': {
      const p = interaction.payload as BlockPayload;
      result.sourceCashDelta = -p.cost;
      result.sourceRepDelta = interaction.reputationDelta;
      result.targetRepDelta = interaction.targetReputationDelta;
      result.logEntry = `Block activated: market card locked for ${Math.ceil(p.blockDurationTicks / 12)} months`;
      break;
    }
    case 'CHALLENGE': {
      const p = interaction.payload as ChallengePayload;
      result.sourceRepDelta = interaction.reputationDelta;
      result.targetRepDelta = interaction.targetReputationDelta;
      result.logEntry = `Challenge accepted: ${p.challengeType} — ${p.stakes} rep at stake`;
      break;
    }
    case 'ALLIANCE': {
      const p = interaction.payload as AlliancePayload;
      if (p.sharedReserveAmount) {
        result.sourceCashDelta = -p.sharedReserveAmount / 2;
        result.targetCashDelta = -p.sharedReserveAmount / 2; // both contribute
      }
      result.sourceRepDelta = interaction.reputationDelta;
      result.targetRepDelta = interaction.targetReputationDelta;
      result.logEntry = `Alliance formed: ${p.allianceType}`;
      break;
    }
  }

  result.proofEntry = `[T${currentTick}] RESOLVED (accepted): ${interaction.proofEntry} | src: ${result.sourceRepDelta}rep ${result.sourceCashDelta >= 0 ? '+' : ''}$${result.sourceCashDelta} | tgt: ${result.targetRepDelta}rep ${result.targetCashDelta >= 0 ? '+' : ''}$${result.targetCashDelta}`;
  return result;
}

// Resolve a challenge at its expiry by comparing player metrics
export interface ChallengeOutcome {
  winnerId: string;
  loserId: string;
  winnerRepDelta: number;
  loserRepDelta: number;
  logEntry: string;
}

export function resolveChallenge(
  challenge: InteractionCard,
  sourceCurrent: number,    // source player's current metric value
  targetCurrent: number,    // target player's current metric value
  currentTick: number,
): ChallengeOutcome {
  const p = challenge.payload as ChallengePayload;
  const sourceWins = sourceCurrent > targetCurrent;

  const repEvents = SOCIAL_REPUTATION_EVENTS;
  const winEvent = repEvents.find(e => e.action === 'WIN_CHALLENGE')!;
  const loseEvent = repEvents.find(e => e.action === 'LOSE_CHALLENGE')!;

  return {
    winnerId: sourceWins ? challenge.sourcePlayerId : challenge.targetPlayerId,
    loserId: sourceWins ? challenge.targetPlayerId : challenge.sourcePlayerId,
    winnerRepDelta: winEvent.sourceRepDelta + p.stakes,
    loserRepDelta: loseEvent.sourceRepDelta - p.stakes,
    logEntry: `[T${currentTick}] Challenge resolved: ${sourceWins ? challenge.sourcePlayerId : challenge.targetPlayerId} wins ${p.challengeType} (${sourceCurrent} vs ${targetCurrent}). +${p.stakes} rep to winner.`,
  };
}

// ─── Session Action Log ───────────────────────────────────────────────────────

export function appendSessionAction(
  log: SessionAction[],
  tick: number,
  playerId: string,
  type: string,
  payload: Record<string, unknown>,
): SessionAction[] {
  const prevHash = log.length > 0 ? log[log.length - 1].hash : '00000000';
  const timestamp = Date.now();
  const actionWithoutHash = { tick, playerId, type, payload, timestamp };
  const hash = hashAction(prevHash, actionWithoutHash);
  return [...log, { ...actionWithoutHash, hash }];
}

export function verifyActionLog(log: SessionAction[]): { valid: boolean; firstInvalidIndex: number | null } {
  if (log.length === 0) return { valid: true, firstInvalidIndex: null };

  let prevHash = '00000000';
  for (let i = 0; i < log.length; i++) {
    const action = log[i];
    const { hash, ...rest } = action;
    const expectedHash = hashAction(prevHash, rest);
    if (hash !== expectedHash) {
      return { valid: false, firstInvalidIndex: i };
    }
    prevHash = hash;
  }
  return { valid: true, firstInvalidIndex: null };
}

// ─── Club Session Factory ─────────────────────────────────────────────────────

export function createClubSession(
  sessionId: string,
  clubName: string,
  hostPlayerId: string,
  preset: import('../types/club').ModeratorPreset,
  sessionSeed: number,
): ClubSession {
  return {
    sessionId,
    clubName,
    hostPlayerId,
    players: [],
    ruleSet: MODERATOR_RULE_SETS[preset],
    marketRow: initMarketRow(sessionSeed),
    pendingInteractions: [],
    resolvedInteractions: [],
    currentTick: 0,
    sessionStartTime: Date.now(),
    isActive: true,
    spectatorIds: [],
    sessionSeed,
    actionLog: [],
  };
}
