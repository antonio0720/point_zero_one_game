// ============================================================
// POINT ZERO ONE DIGITAL — Unified Engine Type System
// Sprint 8 / Phase 1 Upgrade
//
// This file is the single source of truth for pzo_engine types.
// It re-declares canonical types from pzo-web/src/game/types/
// in Node-compatible form (no React imports, no browser APIs).
//
// Old trading types (Position, Portfolio, MarketTick, etc.) are
// preserved as LEGACY COMPAT shims so market-engine.ts and
// portfolio-engine.ts continue to compile during migration.
//
// Deploy to: pzo_engine/src/engine/types.ts
// ============================================================

// ─── PRIMITIVES ──────────────────────────────────────────────
export type CardId   = string;
export type RunId    = string;
export type PlayerId = string;
export type TickId   = number;

// ─── GAME MODES ──────────────────────────────────────────────
/**
 * Canonical four-mode system.
 * GO_ALONE       = Empire / capital allocation, bleed mode
 * HEAD_TO_HEAD   = Predator / battle budget, psyche meter
 * TEAM_UP        = Syndicate / trust score, defection arc
 * CHASE_A_LEGEND = Phantom / ghost replay, legend decay
 */
export type GameMode =
  | 'GO_ALONE'
  | 'HEAD_TO_HEAD'
  | 'TEAM_UP'
  | 'CHASE_A_LEGEND';

export type GameModeAlias = 'EMPIRE' | 'PREDATOR' | 'SYNDICATE' | 'PHANTOM';

export const CANONICAL_TO_ALIAS: Record<GameMode, GameModeAlias> = {
  'GO_ALONE':        'EMPIRE',
  'HEAD_TO_HEAD':    'PREDATOR',
  'TEAM_UP':         'SYNDICATE',
  'CHASE_A_LEGEND':  'PHANTOM',
} as const;

export const ALIAS_TO_CANONICAL: Record<GameModeAlias, GameMode> = {
  'EMPIRE':    'GO_ALONE',
  'PREDATOR':  'HEAD_TO_HEAD',
  'SYNDICATE': 'TEAM_UP',
  'PHANTOM':   'CHASE_A_LEGEND',
} as const;

// ─── DECK TYPES ───────────────────────────────────────────────
/**
 * Base 6-deck types — legal in all modes.
 */
export enum BaseDeckType {
  OPPORTUNITY    = 'OPPORTUNITY',
  IPA            = 'IPA',
  FUBAR          = 'FUBAR',
  PRIVILEGED     = 'PRIVILEGED',
  SO             = 'SO',
  PHASE_BOUNDARY = 'PHASE_BOUNDARY',
}

/**
 * Mode-exclusive deck types — injected by mode engine on top of base set.
 */
export enum ModeDeckType {
  SABOTAGE   = 'SABOTAGE',   // HEAD_TO_HEAD
  COUNTER    = 'COUNTER',    // HEAD_TO_HEAD
  BLUFF      = 'BLUFF',      // HEAD_TO_HEAD
  AID        = 'AID',        // TEAM_UP
  RESCUE     = 'RESCUE',     // TEAM_UP
  TRUST      = 'TRUST',      // TEAM_UP
  DEFECTION  = 'DEFECTION',  // TEAM_UP
  GHOST      = 'GHOST',      // CHASE_A_LEGEND
  DISCIPLINE = 'DISCIPLINE', // CHASE_A_LEGEND
}

export type DeckType = BaseDeckType | ModeDeckType;

// ─── RUN PHASE ────────────────────────────────────────────────
export type RunPhase = 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';

// ─── RUN OUTCOME ─────────────────────────────────────────────
export type RunOutcome = 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED';

// ─── CORD TIER ───────────────────────────────────────────────
export type CordTier =
  | 'SOVEREIGN'
  | 'PLATINUM'
  | 'GOLD'
  | 'SILVER'
  | 'BRONZE'
  | 'UNRANKED';

export type RunGrade    = 'A' | 'B' | 'C' | 'D' | 'F';
export type ExtendedGrade = RunGrade | 'S';
export type BadgeTier   = 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'IRON';
export type IntegrityStatus = 'VERIFIED' | 'TAMPERED' | 'UNVERIFIED';

// ─── SOVEREIGNTY WEIGHTS ─────────────────────────────────────
export const SOVEREIGNTY_WEIGHTS = {
  TICKS_SURVIVED:     0.20,
  SHIELDS_MAINTAINED: 0.25,
  HATER_BLOCKS:       0.20,
  DECISION_SPEED:     0.15,
  CASCADE_BREAKS:     0.20,
} as const;

export const OUTCOME_MULTIPLIERS: Record<RunOutcome, number> = {
  FREEDOM:   1.5,
  TIMEOUT:   0.8,
  BANKRUPT:  0.4,
  ABANDONED: 0.0,
} as const;

export const GRADE_THRESHOLDS: Record<RunGrade, { min: number; max: number }> = {
  A: { min: 1.10, max: 1.50 },
  B: { min: 0.80, max: 1.09 },
  C: { min: 0.55, max: 0.79 },
  D: { min: 0.30, max: 0.54 },
  F: { min: 0.00, max: 0.29 },
} as const;

// ─── STARTING CONSTANTS ───────────────────────────────────────
export const STARTING_CASH          = 28_000;
export const STARTING_INCOME        = 2_100;
export const STARTING_EXPENSES      = 4_800;
export const RUN_TICKS              = 720;
export const FREEDOM_THRESHOLD      = 500_000;
export const BLEED_CASH_THRESHOLD   = 12_000;
export const BATTLE_BUDGET_MAX      = 500;
export const TRUST_SCORE_INITIAL    = 0.70;
export const HATER_HEAT_MAX         = 100;

// ─── CARD BASE EFFECT ─────────────────────────────────────────
export interface CardBaseEffect {
  cashDelta?:         number;
  incomeDelta?:       number;
  expensesDelta?:     number;
  shieldRepair?:      number;
  shieldLayerTarget?: string;
  haterHeatDelta?:    number;
  freezeTicks?:       number;
  bbGeneration?:      number;
  trustDelta?:        number;
  cordDeltaBasis?:    number;
  durationTicks?:     number | null;
}

// ─── CARD RARITY ─────────────────────────────────────────────
export enum CardRarity {
  COMMON    = 'COMMON',
  UNCOMMON  = 'UNCOMMON',
  RARE      = 'RARE',
  EPIC      = 'EPIC',
  LEGENDARY = 'LEGENDARY',
}

// ─── TIMING CLASS ─────────────────────────────────────────────
export enum TimingClass {
  IMMEDIATE            = 'IMMEDIATE',
  REACTIVE             = 'REACTIVE',
  STANDARD             = 'STANDARD',
  HOLD                 = 'HOLD',
  COUNTER_WINDOW       = 'COUNTER_WINDOW',
  RESCUE_WINDOW        = 'RESCUE_WINDOW',
  PHASE_BOUNDARY       = 'PHASE_BOUNDARY',
  FORCED               = 'FORCED',
  LEGENDARY            = 'LEGENDARY',
  BLUFF                = 'BLUFF',
  DEFECTION_STEP       = 'DEFECTION_STEP',
  SOVEREIGNTY_DECISION = 'SOVEREIGNTY_DECISION',
}

// ─── CARD DEFINITION ─────────────────────────────────────────
/**
 * Immutable base definition of every card. Lives in CardRegistry.
 */
export interface CardDefinition {
  readonly cardId:           string;
  readonly name:             string;
  readonly deckType:         DeckType;
  readonly rarity:           CardRarity;
  readonly timingClass:      TimingClass;
  readonly base_cost:        number;
  readonly base_effect:      CardBaseEffect;
  readonly tags:             string[];
  readonly educational_note: string;
  readonly legalPhase?:      RunPhase;
}

// ─── CARD IN HAND ─────────────────────────────────────────────
/**
 * Runtime hand instance. One CardDefinition → many CardInHand copies.
 */
export interface CardInHand {
  instanceId:       string;
  cardId:           string;
  definition:       CardDefinition;
  drawnAtTick:      number;
  heldSince:        number | null;
  forcedEntry:      boolean;
  forcedSource:     string | null;
  decisionWindowRemainingMs: number | null;
}

// ─── DECISION RECORD ─────────────────────────────────────────
export interface DecisionRecord {
  cardId:           string;
  decisionWindowMs: number;
  resolvedInMs:     number;
  wasAutoResolved:  boolean;
  wasOptimalChoice: boolean;
  speedScore:       number;
}

// ─── TICK SNAPSHOT ───────────────────────────────────────────
export interface TickSnapshot {
  tickIndex:          number;
  pressureScore:      number;
  shieldIntegrityAvg: number;
  netWorth:           number;
  haterHeat:          number;
  tickHash:           number;
  hadAutoResolve:     boolean;
  hadCascadeStart:    boolean;
}

// ─── CORD SCORE ───────────────────────────────────────────────
export interface CordScore {
  ticksSurvivedRatio:    number;
  shieldsMaintenanceAvg: number;
  haterBlockRate:        number;
  decisionSpeedScore:    number;
  cascadeBreakRate:      number;
  modeBonus:             number;
  modeBonusLabel:        string;
  rawScore:              number;
  sovereigntyScore:      number;
  normalizedScore:       number;
  tier:                  CordTier;
  runGrade:              ExtendedGrade;
  badgeTier:             BadgeTier;
  proofHash:             string;
  integrityStatus:       IntegrityStatus;
  verifiedAt:            number | null;
  isBleedRun:            boolean;
}

// ─── ENGINE EVENT ─────────────────────────────────────────────
export interface EngineEvent {
  type:    string;
  tick:    TickId;
  data:    Record<string, unknown>;
}

export type EngineListener = (event: EngineEvent) => void;

// ─── MARKET REGIME ───────────────────────────────────────────
export type MarketRegime =
  | 'Stable'
  | 'Expansion'
  | 'Compression'
  | 'Panic'
  | 'Euphoria'
  | 'Recession'
  | 'Recovery';

// ─── LEGACY COMPAT SHIMS ─────────────────────────────────────
// Kept so market-engine.ts and portfolio-engine.ts compile unchanged.
// These types are deprecated — do not use in new code.

/** @deprecated Use CardInHand + CardDefinition. */
export enum CardType {
  LONG   = 'LONG',
  SHORT  = 'SHORT',
  HEDGE  = 'HEDGE',
  MACRO  = 'MACRO',
  EVENT  = 'EVENT',
  CRISIS = 'CRISIS',
}

/** @deprecated Use CardDefinition. */
export interface Card {
  id:            CardId;
  name:          string;
  type:          CardType;
  rarity:        'COMMON' | 'RARE' | 'LEGENDARY';
  cost:          number;
  leverage:      number;
  durationTicks: number;
  effect:        CardEffect;
  description:   string;
}

/** @deprecated */
export interface CardEffect {
  priceImpact:    number;
  volatilityMod:  number;
  liquidityDrain: number;
  synergies:      string[];
}

/** @deprecated Use CardInHand[]. */
export interface Deck {
  id:           string;
  name:         string;
  cards:        Card[];
  drawPile:     Card[];
  hand:         Card[];
  discardPile:  Card[];
  maxHandSize:  number;
}

/** @deprecated Use numeric tick index. */
export interface MarketTick {
  tickId:           TickId;
  timestamp:        number;
  assets:           Map<string, AssetPrice>;
  volatilityIndex:  number;
  liquidityPool:    number;
  activeEvents:     string[];
}

/** @deprecated */
export interface AssetPrice {
  symbol:      string;
  price:       number;
  priceChange: number;
  volume:      number;
  bid:         number;
  ask:         number;
  spread:      number;
}

/** @deprecated */
export interface Position {
  assetId:      string;
  symbol:       string;
  quantity:     number;
  entryPrice:   number;
  currentPrice: number;
  leverage:     number;
  isLong:       boolean;
}

/** @deprecated */
export interface Portfolio {
  cash:        number;
  positions:   Map<string, Position>;
  totalEquity: number;
  peakEquity:  number;
  maxDrawdown: number;
}

/** @deprecated */
export enum RunPhaseEnum {
  SETUP      = 'SETUP',
  ACTIVE     = 'ACTIVE',
  CRISIS     = 'CRISIS',
  SETTLEMENT = 'SETTLEMENT',
  COMPLETE   = 'COMPLETE',
}

/** @deprecated */
export interface Run {
  id:           RunId;
  playerId:     PlayerId;
  phase:        RunPhaseEnum;
  startTime:    number;
  endTime?:     number;
  durationMs:   number;
  currentTick:  TickId;
  maxTicks:     number;
  portfolio:    Portfolio;
  deck:         Deck;
  activeCards:  ActiveCard[];
  score:        number;
  seed:         number;
}

/** @deprecated */
export interface ActiveCard {
  card:         Card;
  playedAtTick: TickId;
  expiresAtTick:TickId;
  positionId?:  string;
}

/** @deprecated */
export interface GameState {
  run:        Run;
  market:     MarketTick;
  energy:     number;
  maxEnergy:  number;
  turn:       number;
  actionLog:  GameAction[];
}

/** @deprecated */
export interface GameAction {
  tick:      TickId;
  type:      'PLAY_CARD' | 'CLOSE_POSITION' | 'DRAW' | 'PASS' | 'SETTLEMENT';
  payload:   Record<string, unknown>;
  timestamp: number;
}