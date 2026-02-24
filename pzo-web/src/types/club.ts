/**
 * PZO SPRINT 7 — src/types/club.ts
 *
 * Full type system for club play:
 *   - Market Row (shared contested opportunity pool)
 *   - Interaction Cards (Aid / Trade / Block / Challenge / Alliance)
 *   - Club Player state
 *   - Social action reputation consequences
 *   - Moderator rule presets (School / Church / Open Club / Competitive)
 *   - Club session and league state
 */

import type { Card } from '../components/CardHand';
import type { PortfolioRecord } from './game';

// ─── Market Row ───────────────────────────────────────────────────────────────

export interface MarketRowCard {
  id: string;
  card: Card;
  addedAtTick: number;
  expiresAtTick: number;
  claimedByPlayerId: string | null;
  claimLockTick: number | null;     // tick at which claim was locked
  minBidCash: number | null;        // if null, first-come-first-served
  bidders: { playerId: string; bidAmount: number }[];
}

export interface MarketRowState {
  slots: MarketRowCard[];           // always 4 visible slots
  maxSlots: number;
  refreshCadenceTicks: number;      // how often a new card appears
  lastRefreshTick: number;
  aiCompetitorPressure: number;     // 0–1, how aggressively AI grabs deals
}

// ─── Interaction Card Types ───────────────────────────────────────────────────

export type InteractionCardType = 'AID' | 'TRADE' | 'BLOCK' | 'CHALLENGE' | 'ALLIANCE';

export interface InteractionCard {
  id: string;
  type: InteractionCardType;
  sourcePlayerId: string;
  targetPlayerId: string;
  label: string;
  description: string;
  // Type-specific payload
  payload: AidPayload | TradePayload | BlockPayload | ChallengePayload | AlliancePayload;
  // Lifecycle
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  issuedAtTick: number;
  expiresAtTick: number;
  resolvedAtTick: number | null;
  // Proof log entry
  proofEntry: string;
  reputationDelta: number;           // to source on acceptance
  targetReputationDelta: number;     // to target on acceptance
}

export interface AidPayload {
  type: 'AID';
  aidType: 'loan' | 'guarantee' | 'shared_reserve';
  cashAmount: number;
  repaymentTermTicks: number | null; // null = gift
  guaranteeCovers: number | null;    // max coverage if guarantee
}

export interface TradePayload {
  type: 'TRADE';
  offeredCardId: string;
  offeredCardName: string;
  requestedCardId: string | null;    // null = open offer
  requestedCardName: string | null;
  cashSweeten: number;               // cash added to sweeten deal
}

export interface BlockPayload {
  type: 'BLOCK';
  marketCardId: string;              // which market row card is being blocked
  blockDurationTicks: number;
  cost: number;                      // blocker pays this
}

export interface ChallengePayload {
  type: 'CHALLENGE';
  challengeType: 'cashflow_duel' | 'net_worth_race' | 'bid_war';
  stakes: number;                    // cash or reputation at stake
  durationTicks: number;
  metric: 'cashflow' | 'net_worth' | 'cash';
}

export interface AlliancePayload {
  type: 'ALLIANCE';
  allianceType: 'shared_protection' | 'info_share' | 'joint_reserve';
  durationTicks: number;
  sharedReserveAmount: number | null;
  infoReveal: boolean;               // reveals portfolio summary to ally
}

// ─── Club Player State ────────────────────────────────────────────────────────

export interface ClubPlayer {
  id: string;
  displayName: string;
  avatarEmoji: string;
  cash: number;
  income: number;
  netWorth: number;
  reputationScore: number;
  reputationTier: string;
  portfolio: PortfolioRecord[];
  shields: number;
  isInDistress: boolean;
  isConnected: boolean;
  lastActiveTick: number;
  // Club stats
  seasonWins: number;
  seasonLosses: number;
  totalRuns: number;
  bestScore: number;
  currentRunScore: number | null;
}

// ─── Moderator Rule Presets ───────────────────────────────────────────────────

export type ModeratorPreset = 'SCHOOL' | 'CHURCH' | 'OPEN_CLUB' | 'COMPETITIVE';

export interface ModeratorRuleSet {
  preset: ModeratorPreset;
  label: string;
  description: string;
  // Feature toggles
  allowAid: boolean;
  allowTrade: boolean;
  allowBlock: boolean;
  allowChallenge: boolean;
  allowAlliance: boolean;
  // Behavior
  maxPlayersPerSession: number;
  allowSpectators: boolean;
  spectatorCanChat: boolean;
  showOpponentPortfolio: boolean;    // transparency toggle
  showOpponentCash: boolean;
  allowBetting: boolean;             // reputation only, never real money
  enablePvpFateCards: boolean;
  allowHouseRules: boolean;
  // Content filters
  filterAdversarialLanguage: boolean;
  requireModeratorApproval: boolean; // for challenges/blocks
  // Timing
  turnTimeLimitSeconds: number | null;
  sessionMaxMinutes: number | null;
}

export const MODERATOR_RULE_SETS: Record<ModeratorPreset, ModeratorRuleSet> = {
  SCHOOL: {
    preset: 'SCHOOL',
    label: '📚 School / Intro',
    description: 'Safe, educational. Full transparency. No adversarial cards. Great for classrooms and youth programs.',
    allowAid: true,
    allowTrade: true,
    allowBlock: false,
    allowChallenge: false,
    allowAlliance: true,
    maxPlayersPerSession: 8,
    allowSpectators: true,
    spectatorCanChat: false,
    showOpponentPortfolio: true,
    showOpponentCash: true,
    allowBetting: false,
    enablePvpFateCards: false,
    allowHouseRules: false,
    filterAdversarialLanguage: true,
    requireModeratorApproval: true,
    turnTimeLimitSeconds: 90,
    sessionMaxMinutes: 60,
  },
  CHURCH: {
    preset: 'CHURCH',
    label: '⛪ Church / Community',
    description: 'Cooperative emphasis. Aid and alliances enabled. Family-safe language. Community-first design.',
    allowAid: true,
    allowTrade: true,
    allowBlock: false,
    allowChallenge: true,
    allowAlliance: true,
    maxPlayersPerSession: 12,
    allowSpectators: true,
    spectatorCanChat: true,
    showOpponentPortfolio: false,
    showOpponentCash: false,
    allowBetting: false,
    enablePvpFateCards: false,
    allowHouseRules: true,
    filterAdversarialLanguage: true,
    requireModeratorApproval: false,
    turnTimeLimitSeconds: 120,
    sessionMaxMinutes: 90,
  },
  OPEN_CLUB: {
    preset: 'OPEN_CLUB',
    label: '🎮 Open Club',
    description: 'Full feature set. All interaction cards. Standard competitive rules. For established clubs.',
    allowAid: true,
    allowTrade: true,
    allowBlock: true,
    allowChallenge: true,
    allowAlliance: true,
    maxPlayersPerSession: 8,
    allowSpectators: true,
    spectatorCanChat: true,
    showOpponentPortfolio: false,
    showOpponentCash: false,
    allowBetting: true,
    enablePvpFateCards: true,
    allowHouseRules: true,
    filterAdversarialLanguage: false,
    requireModeratorApproval: false,
    turnTimeLimitSeconds: 60,
    sessionMaxMinutes: 120,
  },
  COMPETITIVE: {
    preset: 'COMPETITIVE',
    label: '🏆 Competitive',
    description: 'League-grade rules. Anti-cheat enforced. Replay verification on. Proof cards required. No house rules.',
    allowAid: true,
    allowTrade: true,
    allowBlock: true,
    allowChallenge: true,
    allowAlliance: false,           // alliances banned in competitive
    maxPlayersPerSession: 4,
    allowSpectators: true,
    spectatorCanChat: false,
    showOpponentPortfolio: false,
    showOpponentCash: false,
    allowBetting: true,
    enablePvpFateCards: true,
    allowHouseRules: false,
    filterAdversarialLanguage: false,
    requireModeratorApproval: false,
    turnTimeLimitSeconds: 45,
    sessionMaxMinutes: 90,
  },
};

// ─── Reputation Consequences Table ───────────────────────────────────────────

export interface SocialReputationEvent {
  action: InteractionCardType | 'ACCEPT_AID' | 'REJECT_AID' | 'ACCEPT_TRADE' | 'REJECT_TRADE' | 'WIN_CHALLENGE' | 'LOSE_CHALLENGE' | 'HONOR_ALLIANCE' | 'BETRAY_ALLIANCE';
  outcome: 'success' | 'failure' | 'neutral';
  sourceRepDelta: number;
  targetRepDelta: number;
  label: string;
  proofText: string;
}

export const SOCIAL_REPUTATION_EVENTS: SocialReputationEvent[] = [
  { action: 'AID', outcome: 'success', sourceRepDelta: 25, targetRepDelta: 10, label: 'Aid Given', proofText: 'Extended aid — community trust earned' },
  { action: 'ACCEPT_AID', outcome: 'success', sourceRepDelta: 5, targetRepDelta: 5, label: 'Aid Accepted', proofText: 'Aid accepted — mutual respect' },
  { action: 'REJECT_AID', outcome: 'neutral', sourceRepDelta: -5, targetRepDelta: 10, label: 'Aid Rejected', proofText: 'Aid declined — independence maintained' },
  { action: 'TRADE', outcome: 'success', sourceRepDelta: 15, targetRepDelta: 15, label: 'Fair Trade', proofText: 'Trade completed — fair dealing recognized' },
  { action: 'ACCEPT_TRADE', outcome: 'success', sourceRepDelta: 10, targetRepDelta: 10, label: 'Trade Accepted', proofText: 'Deal sealed' },
  { action: 'REJECT_TRADE', outcome: 'neutral', sourceRepDelta: -3, targetRepDelta: 5, label: 'Trade Declined', proofText: 'Trade passed — strategic patience' },
  { action: 'BLOCK', outcome: 'success', sourceRepDelta: -10, targetRepDelta: 5, label: 'Block Played', proofText: 'Blocking play — competitive aggression noted' },
  { action: 'CHALLENGE', outcome: 'success', sourceRepDelta: 20, targetRepDelta: -5, label: 'Challenge Issued', proofText: 'Challenge issued — confidence on display' },
  { action: 'WIN_CHALLENGE', outcome: 'success', sourceRepDelta: 50, targetRepDelta: -20, label: 'Challenge Won', proofText: 'Dominant performance in direct competition' },
  { action: 'LOSE_CHALLENGE', outcome: 'failure', sourceRepDelta: -25, targetRepDelta: 40, label: 'Challenge Lost', proofText: 'Lost direct competition' },
  { action: 'HONOR_ALLIANCE', outcome: 'success', sourceRepDelta: 30, targetRepDelta: 30, label: 'Alliance Honored', proofText: 'Alliance commitments kept — trust deepened' },
  { action: 'BETRAY_ALLIANCE', outcome: 'failure', sourceRepDelta: -80, targetRepDelta: 20, label: 'Alliance Betrayed', proofText: '⚠️ Alliance betrayed — credibility severely damaged' },
];

// ─── Club Session State ───────────────────────────────────────────────────────

export interface ClubSession {
  sessionId: string;
  clubName: string;
  hostPlayerId: string;
  players: ClubPlayer[];
  ruleSet: ModeratorRuleSet;
  marketRow: MarketRowState;
  pendingInteractions: InteractionCard[];
  resolvedInteractions: InteractionCard[];
  currentTick: number;
  sessionStartTime: number;         // unix timestamp
  isActive: boolean;
  spectatorIds: string[];
  // Anti-cheat
  sessionSeed: number;
  actionLog: SessionAction[];       // tamper-evident action log
}

export interface SessionAction {
  tick: number;
  playerId: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
  hash: string;                     // hash of previous entry + this entry
}
