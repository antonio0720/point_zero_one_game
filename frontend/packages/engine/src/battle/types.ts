/**
 * FILE: pzo-web/src/engines/battle/types.ts
 * All types, enums, interfaces, and constants for the Battle Engine.
 * Single source of truth — import from here, never re-declare elsewhere.
 */
import { ShieldLayerId, AttackType } from '../shield/types';
export { AttackType };

// ── Bot Identity ──────────────────────────────────────────────────────────────
export enum BotId {
  BOT_01_LIQUIDATOR    = 'BOT_01',
  BOT_02_BUREAUCRAT    = 'BOT_02',
  BOT_03_MANIPULATOR   = 'BOT_03',
  BOT_04_CRASH_PROPHET = 'BOT_04',
  BOT_05_LEGACY_HEIR   = 'BOT_05',
}

// ── Bot State Machine ─────────────────────────────────────────────────────────
export enum BotState {
  DORMANT     = 'DORMANT',
  WATCHING    = 'WATCHING',
  TARGETING   = 'TARGETING',
  ATTACKING   = 'ATTACKING',
  RETREATING  = 'RETREATING',
  NEUTRALIZED = 'NEUTRALIZED',
}

// ── Entitlement Tiers ─────────────────────────────────────────────────────────
export enum EntitlementTier {
  FREE           = 'FREE',
  SEASON_PASS    = 'SEASON_PASS',
  FORENSICS_PASS = 'FORENSICS_PASS',
}

// ── Battle Actions ────────────────────────────────────────────────────────────
export enum BattleActionType {
  SHIELD_REPAIR_BOOST   = 'SHIELD_REPAIR_BOOST',
  THREAT_DELAY          = 'THREAT_DELAY',
  DECOY_CARD            = 'DECOY_CARD',
  COUNTER_SABOTAGE      = 'COUNTER_SABOTAGE',
  HATER_DISTRACTION     = 'HATER_DISTRACTION',
  COUNTER_EVIDENCE_FILE = 'COUNTER_EVIDENCE_FILE',
  INCOME_REINFORCE      = 'INCOME_REINFORCE',
  ALLIANCE_SIGNAL       = 'ALLIANCE_SIGNAL',
}

export const BATTLE_ACTION_COSTS: Record<BattleActionType, number> = {
  [BattleActionType.SHIELD_REPAIR_BOOST]:   2,
  [BattleActionType.THREAT_DELAY]:          1,
  [BattleActionType.DECOY_CARD]:            3,
  [BattleActionType.COUNTER_SABOTAGE]:      4,
  [BattleActionType.HATER_DISTRACTION]:     2,
  [BattleActionType.COUNTER_EVIDENCE_FILE]: 5,
  [BattleActionType.INCOME_REINFORCE]:      2,
  [BattleActionType.ALLIANCE_SIGNAL]:       1,
};

// ── Income Tier → Budget ──────────────────────────────────────────────────────
export enum IncomeTier {
  SURVIVAL  = 'SURVIVAL',
  STABILITY = 'STABILITY',
  MOMENTUM  = 'MOMENTUM',
  LEVERAGE  = 'LEVERAGE',
  SOVEREIGN = 'SOVEREIGN',
}

export const INCOME_TIER_BUDGETS: Record<IncomeTier, number> = {
  [IncomeTier.SURVIVAL]:  2,
  [IncomeTier.STABILITY]: 3,
  [IncomeTier.MOMENTUM]:  5,
  [IncomeTier.LEVERAGE]:  6,
  [IncomeTier.SOVEREIGN]: 8,
};

export function resolveIncomeTier(monthly: number): IncomeTier {
  if (monthly <= 2000)  return IncomeTier.SURVIVAL;
  if (monthly <= 5000)  return IncomeTier.STABILITY;
  if (monthly <= 10000) return IncomeTier.MOMENTUM;
  if (monthly <= 25000) return IncomeTier.LEVERAGE;
  return IncomeTier.SOVEREIGN;
}

// ── Bot Profile (static per-bot definition) ───────────────────────────────────
export interface BotProfile {
  readonly id: BotId;
  readonly name: string;
  readonly archetype: string;
  readonly primaryAttackType: AttackType;
  readonly secondaryAttackType: AttackType | null;
  readonly targetLayerId: ShieldLayerId;
  readonly secondaryTargetLayerId: ShieldLayerId | null;
  readonly attackPowerMin: number;
  readonly attackPowerMax: number;
  readonly secondaryPowerMin: number;
  readonly secondaryPowerMax: number;
  readonly watchingHeatThreshold: number;    // hater_heat to enter WATCHING
  readonly targetingHeatThreshold: number;   // hater_heat to enter TARGETING
  readonly attackingHeatThreshold: number;   // hater_heat to fire attack
  readonly retreatTicks: number;
  readonly neutralizedTicks: number;
  readonly counterEvidenceCardType: string;
  readonly attackDialogue: string;
  readonly retreatDialogue: string;
  readonly consequenceText: string;
  readonly escalationConditionDescription: string;
}

// ── Bot Runtime State ─────────────────────────────────────────────────────────
export interface HaterBotRuntimeState {
  readonly profileId: BotId;
  readonly profile: BotProfile;
  state: BotState;
  stateEnteredAtTick: number;
  retreatTicksRemaining: number;
  neutralizedTicksRemaining: number;
  preloadedArrivalTick: number | null;
  preloadedAttackPower: number | null;
  damageReductionPct: number;            // 0.0–1.0 applied by COUNTER_SABOTAGE
  damageReductionTicksRemaining: number;
  attacksThisRun: number;
  lastStateBeforeNeutralized: BotState;
}

// ── Attack Event dispatched to ShieldEngine ───────────────────────────────────
export interface BotAttackEvent {
  readonly attackId: string;
  readonly botId: BotId;
  readonly attackType: AttackType;
  readonly secondaryAttackType: AttackType | null;  // BOT_03 dual hit
  readonly rawPower: number;
  readonly secondaryRawPower: number;               // BOT_03 secondary power
  readonly isCritical: boolean;
  readonly tickNumber: number;
  readonly sourceHaterId: string;
}

// ── Battle Action ─────────────────────────────────────────────────────────────
export interface BattleAction {
  readonly actionId: string;
  readonly actionType: BattleActionType;
  readonly targetBotId: BotId | null;
  readonly targetLayerId: ShieldLayerId | null;
  readonly cost: number;
  readonly tickNumber: number;
}

// ── Battle Budget State ───────────────────────────────────────────────────────
export interface BattleBudgetState {
  readonly incomeTier: IncomeTier;
  readonly totalPts: number;
  remainingPts: number;
  spentPts: number;
  readonly tickNumber: number;
  actionsExecutedThisTick: BattleActionType[];
}

// ── Injected Card ─────────────────────────────────────────────────────────────
export enum InjectionType {
  FORCED_SALE      = 'FORCED_SALE',
  REGULATORY_HOLD  = 'REGULATORY_HOLD',
  INVERSION_CURSE  = 'INVERSION_CURSE',
  EXPENSE_SPIKE    = 'EXPENSE_SPIKE',
  DILUTION_NOTICE  = 'DILUTION_NOTICE',
  HATER_HEAT_SURGE = 'HATER_HEAT_SURGE',
}

export interface InjectedCard {
  readonly injectionId: string;
  readonly injectionType: InjectionType;
  readonly sourceBotId: BotId;
  readonly cardName: string;
  readonly timerTicks: number;
  ticksRemaining: number;
  isMitigated: boolean;
  isExpired: boolean;
  injectedAtTick: number;
}

// ── Syndicate Duel ────────────────────────────────────────────────────────────
export enum DuelState {
  PENDING   = 'PENDING',
  ACTIVE    = 'ACTIVE',
  RESOLVED  = 'RESOLVED',
  CANCELLED = 'CANCELLED',
}

export interface SyndicateDuel {
  readonly duelId: string;
  readonly challengerSyndicateId: string;
  readonly defenderSyndicateId: string;
  readonly declaredAt: number;
  readonly endsAt: number;   // declaredAt + 172800000ms (48hr)
  state: DuelState;
  challengerScore: number;
  defenderScore: number;
  currentChallenge: 1 | 2 | 3;
  winnerSyndicateId: string | null;
}

export enum ChallengeType {
  COLLECTIVE_SOVEREIGNTY = 'COLLECTIVE_SOVEREIGNTY',
  EXTRACTION_RESISTANCE  = 'EXTRACTION_RESISTANCE',
  GROWTH_SPRINT          = 'GROWTH_SPRINT',
}

export interface SyndicateMember {
  readonly userId: string;
  readonly netWorth: number;
  readonly monthlyIncome: number;
  readonly incomeGrowthRate: number;
  readonly extractionEventsSurvived: number;
  readonly hasCascadeBreach: boolean;
  readonly isActive: boolean; // run in last 7 days
}

export interface Syndicate {
  readonly syndicateId: string;
  readonly name: string;
  readonly members: SyndicateMember[];
  syndicatePoints: number;
  seasonRankingPoints: number;
  activeDuelId: string | null;
  readonly duelsWon: number;
  readonly duelsLost: number;
}

// ── RunState fields that BattleEngine needs from RunStateSnapshot ─────────────
export interface RunStateForBattle {
  haterHeat: number;
  netWorth: number;
  startingNetWorth: number;
  monthlyIncome: number;
  activeIncomeStreamCount: number;
  investmentCardsInHand: number;
  cardPatternEntropy: number;            // 0.0–1.0
  sameCardTypeConsecutiveTicks: number;
  consecutivePositiveGrowthTicks: number;
  freedomThreshold: number;
  entitlementTier: EntitlementTier;
}

// ── Counter-Intel Panel ───────────────────────────────────────────────────────
export interface FullBotProfile {
  readonly botId: BotId;
  readonly name: string;
  readonly archetype: string;
  readonly primaryAttackType: AttackType;
  readonly targetLayerId: ShieldLayerId;
  readonly escalationConditionDescription: string;
  readonly attackDialogue: string;
  readonly consequenceText: string;
}

export interface IntelReport {
  botId: BotId;
  displayName: string | null;            // null for FREE tier when not ATTACKING
  state: BotState;
  attackTypeHint: string | null;         // SEASON_PASS+
  targetLayerHint: ShieldLayerId | null;
  arrivalTickHint: number | null;        // SEASON_PASS+
  fullProfile: FullBotProfile | null;    // FORENSICS_PASS only
  optimalCounterAction: string | null;   // FORENSICS_PASS only
  damageForecast: number | null;         // FORENSICS_PASS + ATTACKING state only
  breachRisk: boolean | null;            // FORENSICS_PASS + ATTACKING state only
  counterCostPts: number | null;         // FORENSICS_PASS — budget cost of optimal counter
}

// ── Battle Snapshot ───────────────────────────────────────────────────────────
export interface BattleSnapshot {
  readonly bots: Record<BotId, HaterBotRuntimeState>;
  readonly budget: BattleBudgetState;
  readonly activeBotsCount: number;
  readonly injectedCards: InjectedCard[];
  readonly haterHeat: number;
  readonly activeDuel: SyndicateDuel | null;
  readonly tickNumber: number;
  readonly timestamp: number;
}

// ── Event Types ───────────────────────────────────────────────────────────────
export interface BotStateChangedEvent {
  eventType: 'BOT_STATE_CHANGED';
  botId: BotId;
  from: BotState;
  to: BotState;
  tickNumber: number;
  timestamp: number;
}

export interface BotAttackFiredEvent {
  eventType: 'BOT_ATTACK_FIRED';
  botId: BotId;
  attackEvent: BotAttackEvent;
  tickNumber: number;
  timestamp: number;
}

export interface BotNeutralizedEvent {
  eventType: 'BOT_NEUTRALIZED';
  botId: BotId;
  neutralizedTicks: number;
  tickNumber: number;
  timestamp: number;
}

export interface BudgetActionExecutedEvent {
  eventType: 'BUDGET_ACTION_EXECUTED';
  action: BattleAction;
  remainingBudget: number;
  tickNumber: number;
  timestamp: number;
}

export interface CardInjectedEvent {
  eventType: 'CARD_INJECTED';
  injectedCard: InjectedCard;
  tickNumber: number;
  timestamp: number;
}

export interface InjectedCardExpiredEvent {
  eventType: 'INJECTED_CARD_EXPIRED';
  injectionId: string;
  injectionType: InjectionType;
  tickNumber: number;
  timestamp: number;
}

export interface BattleSnapshotUpdatedEvent {
  eventType: 'BATTLE_SNAPSHOT_UPDATED';
  snapshot: BattleSnapshot;
  tickNumber: number;
  timestamp: number;
}

export type BattleEvent =
  | BotStateChangedEvent
  | BotAttackFiredEvent
  | BotNeutralizedEvent
  | BudgetActionExecutedEvent
  | CardInjectedEvent
  | InjectedCardExpiredEvent
  | BattleSnapshotUpdatedEvent;

// ── Constants ─────────────────────────────────────────────────────────────────
export const BATTLE_CONSTANTS = {
  MAX_INJECTED_CARDS:              3,
  HATER_HEAT_WATCHING_MIN:         20,
  HATER_HEAT_TARGETING_MIN:        41,
  HATER_HEAT_ATTACKING_MIN:        61,
  DEFAULT_RETREAT_TICKS:           5,
  NEUTRALIZED_TICKS:               3,
  COUNTER_SABOTAGE_REDUCTION:      0.30,
  COUNTER_SABOTAGE_DURATION_TICKS: 2,
  HATER_DISTRACTION_HEAT_DELTA:    -3,
  CRIT_TARGETING_TICKS_THRESHOLD:  2,
  SYNDICATE_DUEL_DURATION_MS:      172_800_000,   // 48 hours
  SYNDICATE_DUEL_COST_PTS:         50,
  SYNDICATE_MIN_ACTIVE_MEMBERS:    3,
  DUEL_CHALLENGE_OFFSETS_MS:       [0, 57_600_000, 115_200_000] as const, // 0h, 16h, 32h
} as const;