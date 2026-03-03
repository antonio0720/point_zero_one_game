/**
 * FILE: pzo-web/src/engines/cascade/types.ts
 * All types, enums, interfaces, constants, and event types for the Cascade Engine.
 * Single source of truth — import from here, never re-declare elsewhere.
 *
 * Density6 LLC · Point Zero One · Engine 6 of 7 · Confidential
 */
import { ShieldLayerId }        from '../shield/types';
import { BotId, InjectionType } from '../battle/types';

// ── Chain Identity ─────────────────────────────────────────────────────────────

export enum ChainId {
  // Negative chains
  CHAIN_LOAN_DEFAULT          = 'CHAIN_LOAN_DEFAULT',
  CHAIN_LIQUIDITY_BREACH      = 'CHAIN_LIQUIDITY_BREACH',
  CHAIN_NETWORK_COLLAPSE      = 'CHAIN_NETWORK_COLLAPSE',
  CHAIN_HATER_SABOTAGE        = 'CHAIN_HATER_SABOTAGE',
  CHAIN_NET_WORTH_CRASH       = 'CHAIN_NET_WORTH_CRASH',
  CHAIN_FULL_CASCADE_BREACH   = 'CHAIN_FULL_CASCADE_BREACH',
  CHAIN_PATTERN_EXPLOITATION  = 'CHAIN_PATTERN_EXPLOITATION',
  CHAIN_REGULATORY_ESCALATION = 'CHAIN_REGULATORY_ESCALATION',
  // Positive chains
  PCHAIN_SUSTAINED_CASHFLOW   = 'PCHAIN_SUSTAINED_CASHFLOW',
  PCHAIN_FORTIFIED_SHIELDS    = 'PCHAIN_FORTIFIED_SHIELDS',
  PCHAIN_NEMESIS_BROKEN       = 'PCHAIN_NEMESIS_BROKEN',
  PCHAIN_SOVEREIGN_APPROACH   = 'PCHAIN_SOVEREIGN_APPROACH',
  PCHAIN_STREAK_MASTERY       = 'PCHAIN_STREAK_MASTERY',
}

export enum CascadeSeverity {
  MILD        = 'MILD',
  MODERATE    = 'MODERATE',
  SEVERE      = 'SEVERE',
  CATASTROPHIC = 'CATASTROPHIC',
}

export enum CascadeDirection {
  NEGATIVE = 'NEGATIVE',
  POSITIVE = 'POSITIVE',
}

export enum PositiveCascadeType {
  SUSTAINED_STATE = 'SUSTAINED_STATE',
  ONE_TIME_EVENT  = 'ONE_TIME_EVENT',
}

// ── Effect System ──────────────────────────────────────────────────────────────

export enum CascadeEffectType {
  INCOME_MODIFIER    = 'INCOME_MODIFIER',
  EXPENSE_MODIFIER   = 'EXPENSE_MODIFIER',
  HATER_HEAT_DELTA   = 'HATER_HEAT_DELTA',
  CARD_INJECT        = 'CARD_INJECT',
  SHIELD_CRACK       = 'SHIELD_CRACK',
  CARD_LOCK          = 'CARD_LOCK',
  BOT_ACTIVATE       = 'BOT_ACTIVATE',
  OPPORTUNITY_UNLOCK = 'OPPORTUNITY_UNLOCK',
  STAT_MODIFIER      = 'STAT_MODIFIER',
  MOMENTUM_LOCK      = 'MOMENTUM_LOCK',
}

export interface CascadeEffectPayload {
  // INCOME_MODIFIER, EXPENSE_MODIFIER
  factor?:          number;
  // INCOME_MODIFIER, EXPENSE_MODIFIER, CARD_LOCK, STAT_MODIFIER, MOMENTUM_LOCK
  durationTicks?:   number;
  // HATER_HEAT_DELTA (positive = increase, negative = decrease)
  delta?:           number;
  // CARD_INJECT, CARD_LOCK
  cardType?:        string;
  // CARD_INJECT
  injectionType?:   InjectionType;
  timerTicks?:      number;
  // SHIELD_CRACK
  targetLayerId?:   ShieldLayerId;
  damageAmount?:    number;
  // CARD_LOCK
  lockType?:        'SUPPRESSION' | 'REGULATORY_HOLD';
  // BOT_ACTIVATE
  botId?:           BotId;
  // OPPORTUNITY_UNLOCK
  opportunityType?: string;
  // STAT_MODIFIER
  statKey?:         string;
  value?:           number;
  // MOMENTUM_LOCK
  targetChainId?:   ChainId;
  // Source tracking (set by engine during execution)
  sourceChainId?:   ChainId;
}

// ── Recovery ───────────────────────────────────────────────────────────────────

export enum RecoveryType {
  CARD_PLAYED_TYPE       = 'CARD_PLAYED_TYPE',
  BUDGET_ACTION_USED     = 'BUDGET_ACTION_USED',
  SHIELD_LAYER_ABOVE_PCT = 'SHIELD_LAYER_ABOVE_PCT',
  CASHFLOW_POSITIVE_N    = 'CASHFLOW_POSITIVE_N',
  ALLIANCE_ACTIVE        = 'ALLIANCE_ACTIVE',
  COMPOUND_AND           = 'COMPOUND_AND',
  COMPOUND_OR            = 'COMPOUND_OR',
}

export interface RecoveryCondition {
  readonly type:              RecoveryType;
  readonly cardType?:         string;
  readonly budgetActionType?: string;
  readonly layerId?:          ShieldLayerId;
  readonly abovePct?:         number;
  readonly consecutiveTicks?: number;
  readonly breaksLinksFrom?:  number;  // link index from which recovery skips (inclusive)
  readonly description:       string;
  readonly sub?:              RecoveryCondition[];  // for COMPOUND_AND / COMPOUND_OR
}

// ── Chain Definitions ──────────────────────────────────────────────────────────

export interface CascadeLink {
  readonly linkIndex:        number;
  readonly tickOffset:       number;
  readonly effectType:       CascadeEffectType;
  readonly payload:          CascadeEffectPayload;
  readonly canBeIntercepted: boolean;
  readonly isVisible:        boolean;  // false = hidden from FREE tier Counter-Intel
  readonly linkDescription:  string;
}

export interface CascadeChainDefinition {
  readonly chainId:            ChainId;
  readonly chainName:          string;
  readonly severity:           CascadeSeverity;
  readonly direction:          CascadeDirection;
  readonly triggerEventType:   string;
  readonly links:              CascadeLink[];
  readonly recoveryConditions: RecoveryCondition[];
  readonly maxActiveInstances: number;
  readonly playerMessage:      string;
  readonly recoveryMessage:    string;
}

export interface PositiveCascadeDefinition {
  readonly chainId:                        ChainId;
  readonly chainName:                      string;
  readonly type:                           PositiveCascadeType;
  readonly activationConditionDescription: string;
  readonly unlockMessage:                  string;
  readonly dissolutionMessage:             string;
}

// ── Runtime Instance State ─────────────────────────────────────────────────────

export enum ChainInstanceStatus {
  QUEUED      = 'QUEUED',
  ACTIVE      = 'ACTIVE',
  INTERRUPTED = 'INTERRUPTED',
  COMPLETED   = 'COMPLETED',
  DISSOLVED   = 'DISSOLVED',
}

export enum LinkStatus {
  PENDING  = 'PENDING',
  FIRED    = 'FIRED',
  SKIPPED  = 'SKIPPED',
  DEFERRED = 'DEFERRED',
}

export interface CascadeLinkRuntime {
  readonly linkDef: CascadeLink;
  scheduledTick:    number;
  status:           LinkStatus;
  firedAtTick?:     number;
}

export interface CascadeChainInstance {
  readonly instanceId:       string;
  readonly chainId:          ChainId;
  readonly chainDef:         CascadeChainDefinition;
  status:                    ChainInstanceStatus;
  readonly triggeredAtTick:  number;
  readonly triggerEventType: string;
  links:                     CascadeLinkRuntime[];
  linksFireCount:            number;
  linksSkippedCount:         number;
  recoveryAchievedAtTick:    number | null;
  recoveryType:              string | null;
}

export interface ActivePositiveCascade {
  readonly pchainId:         ChainId;
  readonly activatedAtTick:  number;
  ticksActive:               number;
  isActive:                  boolean;
  isPaused:                  boolean;  // PCHAIN_FORTIFIED_SHIELDS pause state
  lastSustainingCheckTick:   number;
}

export interface RecoveryActionLog {
  cardTypesPlayedSinceMap:     Map<number, string[]>;  // tick → card types played
  budgetActionsUsedSinceMap:   Map<number, string[]>;  // tick → action types used
  nemesisNeutralizationCount:  Map<string, number>;    // botId → times neutralized
  consecutivePositiveFlowTicks: number;
  consecutiveCleanTicks:        number;  // for PCHAIN_STREAK_MASTERY
  consecutiveFortifiedTicks:    number;  // for PCHAIN_FORTIFIED_SHIELDS
}

// ── Run State Input ────────────────────────────────────────────────────────────

export interface CascadeRunState {
  netWorth:                     number;
  freedomThreshold:             number;
  monthlyIncome:                number;
  monthlyExpenses:              number;
  consecutivePositiveFlowTicks: number;
  consecutiveCleanTicks:        number;
  consecutiveFortifiedTicks:    number;
  hasActiveAllianceMember:      boolean;
  haterHeat:                    number;
}

// ── Snapshot ───────────────────────────────────────────────────────────────────

export interface CascadeSnapshot {
  readonly activeNegativeChains:   CascadeChainInstance[];
  readonly activePositiveCascades: ActivePositiveCascade[];
  readonly queueDepth:             number;
  readonly highestActiveSeverity:  CascadeSeverity | null;
  readonly hasCatastrophicChain:   boolean;
  readonly positiveCount:          number;
  readonly totalLinksScheduled:    number;
  readonly totalLinksDefeated:     number;  // skipped via recovery this run
  readonly tickNumber:             number;
  readonly timestamp:              number;
}

// ── Events ─────────────────────────────────────────────────────────────────────

export interface CascadeChainStartedEvent {
  eventType:     'CASCADE_CHAIN_STARTED';
  chainId:       ChainId;
  instanceId:    string;
  severity:      CascadeSeverity;
  direction:     CascadeDirection;
  firstLinkTick: number;
  playerMessage: string;
  tickNumber:    number;
  timestamp:     number;
}

export interface CascadeLinkFiredEvent {
  eventType:       'CASCADE_LINK_FIRED';
  chainId:         ChainId;
  instanceId:      string;
  linkIndex:       number;
  effectType:      CascadeEffectType;
  payload:         CascadeEffectPayload;
  linkDescription: string;
  scheduledTick:   number;
  tickNumber:      number;
  timestamp:       number;
}

export interface CascadeChainBrokenEvent {
  eventType:          'CASCADE_CHAIN_BROKEN';
  chainId:            ChainId;
  instanceId:         string;
  brokenAtLinkIndex:  number;
  recoveryMessage:    string;
  tickNumber:         number;
  timestamp:          number;
}

export interface CascadeChainCompletedEvent {
  eventType:        'CASCADE_CHAIN_COMPLETED';
  chainId:          ChainId;
  instanceId:       string;
  linksFireCount:   number;
  linksSkippedCount:number;
  tickNumber:       number;
  timestamp:        number;
}

export interface CascadePositiveActivatedEvent {
  eventType:         'CASCADE_POSITIVE_ACTIVATED';
  pchainId:          ChainId;
  chainName:         string;
  effectDescription: string;
  tickNumber:        number;
  timestamp:         number;
}

export interface CascadePositiveDissolvedEvent {
  eventType:         'CASCADE_POSITIVE_DISSOLVED';
  pchainId:          ChainId;
  dissolutionReason: string;
  tickNumber:        number;
  timestamp:         number;
}

export interface NemesisBrokenEvent {
  eventType:     'NEMESIS_BROKEN';
  botId:         BotId;
  haterHeatReset:boolean;
  immunityTicks: number;
  tickNumber:    number;
  timestamp:     number;
}

export interface CascadeSnapshotUpdatedEvent {
  eventType:  'CASCADE_SNAPSHOT_UPDATED';
  snapshot:   CascadeSnapshot;
  tickNumber: number;
  timestamp:  number;
}

export interface HaterHeatWriteQueuedEvent {
  delta:         number;
  sourceChainId: ChainId;
  tickNumber:    number;
  timestamp:     number;
}

export type CascadeEvent =
  | CascadeChainStartedEvent
  | CascadeLinkFiredEvent
  | CascadeChainBrokenEvent
  | CascadeChainCompletedEvent
  | CascadePositiveActivatedEvent
  | CascadePositiveDissolvedEvent
  | NemesisBrokenEvent
  | CascadeSnapshotUpdatedEvent;

// ── Constants ──────────────────────────────────────────────────────────────────

export const CASCADE_CONSTANTS = {
  MAX_LINK_DEPTH:                     6,
  MAX_SIMULTANEOUS_LINKS_PER_TICK:    5,
  DEFAULT_MAX_INSTANCES:              3,
  CATASTROPHIC_MAX_INSTANCES:         1,
  NEMESIS_NEUTRALIZE_COUNT:           2,
  CASHFLOW_MOMENTUM_TICKS:            10,
  FORTIFIED_TICKS_REQUIRED:           5,
  STREAK_MASTERY_TICKS:               5,
  SOVEREIGN_APPROACH_MULTIPLIER:      2.0,
  SOVEREIGN_PAUSE_THRESHOLD:          1.5,
  POSITIVE_CASHFLOW_RECOVERY_TICKS:   3,
  NEMESIS_IMMUNITY_TICKS:             10,
  PCHAIN_CASHFLOW_INCOME_BONUS:       0.15,
  PCHAIN_CASHFLOW_TENSION_DELTA:      -0.08,
  PCHAIN_CASHFLOW_PRESSURE_DELTA:     -0.08,
  PCHAIN_FORTIFIED_INTERVAL_TICKS:    8,    // opportunity card every N ticks
  PCHAIN_CASHFLOW_CARD_INTERVAL:      5,    // income multiplier card every N ticks
  CASCADE_PRESSURE_PER_ACTIVE_CHAIN:  0.08,
  CASCADE_PRESSURE_CATASTROPHIC:      0.20,
  SEVERITY_SORT_ORDER: {
    CATASTROPHIC: 0,
    SEVERE:       1,
    MODERATE:     2,
    MILD:         3,
  } as Record<CascadeSeverity, number>,
} as const;