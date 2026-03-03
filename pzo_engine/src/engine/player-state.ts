// ============================================================
// POINT ZERO ONE DIGITAL — Player State
// Sprint 8 / Phase 1 Upgrade
//
// PlayerState is the canonical financial snapshot of a player
// at any point during a run. TurnEngine reads and mutates this.
//
// CHANGES FROM SPRINT 0:
//   - Removed broken instanceof validation on interface types
//   - Phase enum aligned with MacroEngine (EXPANSION/PEAK/CONTRACTION/TROUGH)
//   - PlayerState merged with TurnEnginePlayerState (single canonical shape)
//   - OwnedAsset replaces BigDealAsset / IPAAsset split
//   - Factory function replaces broken class constructor
//
// Deploy to: pzo_engine/src/engine/player-state.ts
// ============================================================

import {
  STARTING_CASH,
  STARTING_INCOME,
  STARTING_EXPENSES,
} from './types';

// ─── MACRO PHASE ──────────────────────────────────────────────
/**
 * Economic cycle phase — used by MacroEngine to apply erosion multipliers.
 * Also surfaces in PlayerState for pressure rendering.
 */
export enum MacroPhase {
  EXPANSION   = 'EXPANSION',
  PEAK        = 'PEAK',
  CONTRACTION = 'CONTRACTION',
  TROUGH      = 'TROUGH',
}

/**
 * Run-level phase within a single player's arc.
 * Distinct from MacroPhase.
 */
export enum RunPhase {
  FOUNDATION  = 'FOUNDATION',
  ESCALATION  = 'ESCALATION',
  SOVEREIGNTY = 'SOVEREIGNTY',
}

// ─── OWNED ASSET ─────────────────────────────────────────────
/**
 * An asset owned by the player. Replaces split BigDealAsset / IPAAsset.
 * Tracks income, debt service, and exit range.
 */
export interface OwnedAsset {
  assetId:             string;   // UUID
  cardId:              string;   // source card ID in CardRegistry
  name:                string;
  assetKind:           'REAL_ESTATE' | 'BUSINESS' | 'DIGITAL' | 'EQUITY';
  originalCost:        number;
  currentDebt:         number;
  monthlyIncome:       number;
  monthlyDebtService:  number;
  exitMin:             number;
  exitMax:             number;
  acquiredAtTurn:      number;
  auditHash?:          string;   // sha256 snapshot for replay verification
}

// ─── ACTIVE BUFF ──────────────────────────────────────────────
export interface ActiveBuff {
  buffId:         string;
  buffType:       'SHIELD' | 'DOWNPAY_DISCOUNT' | 'RATE_DISCOUNT' | 'CASHFLOW_BOOST';
  value:          number;
  remainingUses:  number;     // -1 = persistent for expiresAtTurn
  expiresAtTurn:  number;
}

// ─── PLAYER STATE ─────────────────────────────────────────────
/**
 * Canonical player state snapshot.
 * TurnEngine reads/writes this. Immutable after creation — TurnEngine
 * returns a new state snapshot each turn.
 */
export interface PlayerState {
  playerId:               string;

  // Economy
  cash:                   number;
  monthlyIncome:          number;
  monthlyExpenses:        number;
  netCashflow:            number;   // income - expenses
  netWorth:               number;   // cash + sum(assets) - debts

  // Credits (card-applied temporary modifiers)
  downpayCredit:          number;
  debtServiceCredit:      number;

  // Defenses
  activeShields:          number;
  leverageBlocks:         number;

  // Turn tracking
  turnsToSkip:            number;
  consecutivePasses:      number;

  // Macro context
  inflation:              number;   // 0.0–1.0 pressure scalar
  creditTightness:        number;   // 0.0–1.0 credit availability (1 = tight)
  macroPhase:             MacroPhase;
  runPhase:               RunPhase;

  // Assets
  ownedAssets:            OwnedAsset[];

  // Buffs / debuffs
  activeBuffs:            ActiveBuff[];

  // Bleed mode (GO_ALONE specific)
  bleedModeActive:        boolean;
  bleedSeverity:          'NONE' | 'WATCH' | 'CRITICAL' | 'TERMINAL';

  // Mode-specific state (null when not applicable)
  battleBudget:           number;   // HEAD_TO_HEAD — 0 otherwise
  trustScore:             number;   // TEAM_UP — 0 otherwise
  ghostDelta:             number;   // CHASE_A_LEGEND — 0 otherwise
}

// ─── VALIDATION ───────────────────────────────────────────────
/**
 * Validates a PlayerState. Throws on invalid data.
 * Called at TurnEngine.initRun() and after each state mutation.
 */
export function validatePlayerState(ps: PlayerState): void {
  if (typeof ps.cash !== 'number' || isNaN(ps.cash)) {
    throw new Error(`PlayerState.cash is invalid: ${ps.cash}`);
  }
  if (typeof ps.monthlyIncome !== 'number' || ps.monthlyIncome < 0) {
    throw new Error(`PlayerState.monthlyIncome must be ≥ 0, got: ${ps.monthlyIncome}`);
  }
  if (typeof ps.monthlyExpenses !== 'number' || ps.monthlyExpenses < 0) {
    throw new Error(`PlayerState.monthlyExpenses must be ≥ 0, got: ${ps.monthlyExpenses}`);
  }
  if (!Object.values(MacroPhase).includes(ps.macroPhase)) {
    throw new Error(`PlayerState.macroPhase is invalid: ${ps.macroPhase}`);
  }
  if (!Object.values(RunPhase).includes(ps.runPhase)) {
    throw new Error(`PlayerState.runPhase is invalid: ${ps.runPhase}`);
  }
}

// ─── FACTORY ──────────────────────────────────────────────────
/**
 * Creates a validated initial PlayerState for run start.
 * All optional fields initialized to safe defaults.
 */
export function createInitialPlayerState(playerId: string): PlayerState {
  const ps: PlayerState = {
    playerId,

    cash:              STARTING_CASH,
    monthlyIncome:     STARTING_INCOME,
    monthlyExpenses:   STARTING_EXPENSES,
    netCashflow:       STARTING_INCOME - STARTING_EXPENSES,
    netWorth:          STARTING_CASH,

    downpayCredit:     0,
    debtServiceCredit: 0,

    activeShields:     0,
    leverageBlocks:    0,

    turnsToSkip:       0,
    consecutivePasses: 0,

    inflation:         0.02,   // 2% baseline
    creditTightness:   0.20,   // 20% tight to start
    macroPhase:        MacroPhase.EXPANSION,
    runPhase:          RunPhase.FOUNDATION,

    ownedAssets:  [],
    activeBuffs:  [],

    bleedModeActive: false,
    bleedSeverity:   'NONE',

    battleBudget: 0,
    trustScore:   0,
    ghostDelta:   0,
  };

  validatePlayerState(ps);
  return ps;
}

// ─── MUTATION HELPERS ─────────────────────────────────────────

/**
 * Apply a cash delta and recompute net worth.
 * Returns a new PlayerState (immutable pattern).
 */
export function applyCashDelta(ps: PlayerState, delta: number): PlayerState {
  const cash      = ps.cash + delta;
  const assetSum  = ps.ownedAssets.reduce((s, a) => s + (a.exitMin + a.exitMax) / 2, 0);
  const debtSum   = ps.ownedAssets.reduce((s, a) => s + a.currentDebt, 0);
  const netWorth  = cash + assetSum - debtSum;
  return { ...ps, cash, netWorth };
}

/**
 * Recalculate net cashflow from current income/expense state.
 */
export function recalcCashflow(ps: PlayerState): PlayerState {
  const assetIncome    = ps.ownedAssets.reduce((s, a) => s + a.monthlyIncome, 0);
  const assetDebtSvc   = ps.ownedAssets.reduce((s, a) => s + a.monthlyDebtService, 0);
  const monthlyIncome  = ps.monthlyIncome + assetIncome;
  const monthlyExpenses= ps.monthlyExpenses + assetDebtSvc;
  const netCashflow    = monthlyIncome - monthlyExpenses;
  return { ...ps, monthlyIncome, monthlyExpenses, netCashflow };
}

/**
 * Determine RunPhase from tick number.
 * 0–239 = FOUNDATION, 240–479 = ESCALATION, 480–720 = SOVEREIGNTY
 */
export function deriveRunPhase(tick: number): RunPhase {
  if (tick < 240) return RunPhase.FOUNDATION;
  if (tick < 480) return RunPhase.ESCALATION;
  return RunPhase.SOVEREIGNTY;
}

/**
 * Expire buffs whose expiresAtTurn ≤ currentTurn.
 */
export function expireBuffs(ps: PlayerState, currentTurn: number): PlayerState {
  const activeBuffs = ps.activeBuffs.filter(b => b.expiresAtTurn > currentTurn);
  return { ...ps, activeBuffs };
}