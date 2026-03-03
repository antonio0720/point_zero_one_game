// ============================================================
// POINT ZERO ONE DIGITAL — pzo_engine Public API
// Sprint 8 / Phase 1 Upgrade
//
// Single entry point for all pzo_engine consumers (pzo-server,
// tests, replay-validator). Import from 'pzo_engine' or from
// the individual sub-modules as needed.
//
// Removed: game-engine.ts (deleted — replaced by TurnEngine)
// Removed: six-deck.ts DeckReactorImpl (broken — see six-deck.ts)
// Added:   DrawMixEngine, createRunSession, MomentForge
//
// Deploy to: pzo_engine/src/index.ts
// ============================================================

// ─── CANONICAL ENGINE ────────────────────────────────────────
export {
  TurnEngine,
  createRunSession,
} from '../engine/turn-engine';

export type {
  TurnContext,
  TurnEvent,
  TurnResult,
  TurnPhase,
  ActionType,
  ValidationError,
  RunSession,
} from '../engine/turn-engine';

// ─── PLAYER STATE ────────────────────────────────────────────
export {
  MacroPhase,
  RunPhase,
  createInitialPlayerState,
  applyCashDelta,
  recalcCashflow,
  deriveRunPhase,
  expireBuffs,
  validatePlayerState,
} from '../engine/player-state';

export type {
  PlayerState,
  OwnedAsset,
  ActiveBuff,
} from '../engine/player-state';

// ─── TYPE SYSTEM ─────────────────────────────────────────────
export {
  BaseDeckType,
  ModeDeckType,
  CardRarity,
  TimingClass,
  CardType,                 // @deprecated — legacy compat
  RunPhaseEnum,             // @deprecated — legacy compat
  CANONICAL_TO_ALIAS,
  ALIAS_TO_CANONICAL,
  SOVEREIGNTY_WEIGHTS,
  OUTCOME_MULTIPLIERS,
  GRADE_THRESHOLDS,
  STARTING_CASH,
  STARTING_INCOME,
  STARTING_EXPENSES,
  RUN_TICKS,
  FREEDOM_THRESHOLD,
  BLEED_CASH_THRESHOLD,
  BATTLE_BUDGET_MAX,
  TRUST_SCORE_INITIAL,
  HATER_HEAT_MAX,
} from '../engine/types';

export type {
  GameMode,
  GameModeAlias,
  DeckType,
  RunOutcome,
  CordTier,
  RunGrade,
  ExtendedGrade,
  BadgeTier,
  IntegrityStatus,
  CardBaseEffect,
  CardDefinition,
  CardInHand,
  DecisionRecord,
  TickSnapshot,
  CordScore,
  EngineEvent,
  EngineListener,
  MarketRegime,
  // Legacy compat
  CardId,
  RunId,
  PlayerId,
  TickId,
} from '../engine/types';

// ─── DRAW SYSTEM ─────────────────────────────────────────────
export {
  CARD_REGISTRY,
  BASE_DECK_WEIGHTS,
  buildStartingDeck,
  toCardInHand,
  DrawEngine,
} from '../engine/deck';

// ─── SIX-DECK DRAW MIX ───────────────────────────────────────
export {
  DrawMixEngine,
  maybeInjectForcedCard,

} from '../engine/six-deck';

export type { DrawMixResult } from '../engine/six-deck';

// ─── MARKET ENGINE ───────────────────────────────────────────
export {
  SeededRandom,
  MarketEngine,
} from '../engine/market-engine';

export type { AssetConfig } from '../engine/market-engine';

// ─── MACRO ENGINE ────────────────────────────────────────────
export {
  MacroEngine,
} from '../engine/macro-engine';

export type {
  MacroEngineConfig,
  MacroResult,
} from '../engine/macro-engine';

// ─── PORTFOLIO ENGINE ────────────────────────────────────────
export {
  PortfolioEngine,
} from '../engine/portfolio-engine';

export type {
  AcquisitionResult,
  DispositionResult,
} from '../engine/portfolio-engine';

// ─── SOLVENCY / WIPE CHECKER ─────────────────────────────────
export {
  SolvencyEngine,
} from '../engine/wipe-checker';

export type { WipeEvent } from '../engine/wipe-checker';

// ─── MOMENT FORGE ────────────────────────────────────────────
export {
  MomentForge,
  MOMENT_FORGE_RULES as MF_RULES,
  classifyMoment,
  momentAuditHash,
  momentLabel,
} from '../engine/moment-forge';