// ============================================================
// POINT ZERO ONE DIGITAL — Turn Engine (Canonical)
// Sprint 8 / Phase 1 Upgrade
//
// TurnEngine is the server-side simulation authority.
// All state mutations are deterministic, ledger-emitting,
// and audit-hashed. This is the ONLY engine that writes
// PlayerState — all other engines are called from here.
//
// BREAKING CHANGES from Sprint 0 turn-engine.ts:
//   - Internal Card class REMOVED → use CardDefinition / CardInHand from types.ts
//   - Internal OwnedAsset REMOVED → use OwnedAsset from player-state.ts
//   - Internal ActiveBuff REMOVED → use ActiveBuff from player-state.ts
//   - TurnEnginePlayerState REMOVED → use PlayerState from player-state.ts
//   - Internal Deck class REMOVED → use DrawEngine from deck.ts
//   - TurnContext.runSeed is now numeric (SeededRandom seed)
//   - GameMode added to TurnContext
//   - MacroEngine, PortfolioEngine, SolvencyEngine wired in
//   - Date.now() REMOVED from acquireAsset (non-deterministic)
//     → replaced with sha256(playerId + cardId + turnNumber)
//
// 7-step turn sequence:
//   1. validate
//   2. drawCard
//   3. resolveCard      (mode-aware card effect dispatch)
//   4. applyBuffsDebuffs
//   5. checkWipe
//   6. checkWin
//   7. emitEvents → incrementTurn
//
// Deploy to: pzo_engine/src/engine/turn-engine.ts
// ============================================================

import { createHash }       from 'crypto';
import { SeededRandom }     from './market-engine';
import { DrawEngine }       from './deck';
import { MacroEngine }      from './macro-engine';
import { PortfolioEngine }  from './portfolio-engine';
import { SolvencyEngine }   from './wipe-checker';
import {
  PlayerState,
  OwnedAsset,
  ActiveBuff,
  MacroPhase,
  RunPhase,
  createInitialPlayerState,
  applyCashDelta,
  recalcCashflow,
  deriveRunPhase,
  expireBuffs,
  validatePlayerState,
} from './player-state';
import {
  GameMode,
  CardDefinition,
  CardInHand,
  BaseDeckType,
  ModeDeckType,
  CardBaseEffect,
  RunOutcome,
  STARTING_CASH,
  FREEDOM_THRESHOLD,
  BATTLE_BUDGET_MAX,
  TRUST_SCORE_INITIAL,
  RUN_TICKS,
} from './types';

// ─── RE-EXPORTS ──────────────────────────────────────────────
// Consumers that previously imported from turn-engine.ts
// can still get these from here (backwards compat).
export type { PlayerState, OwnedAsset, ActiveBuff } from './player-state';
export type { CardDefinition, CardInHand, GameMode } from './types';

// ─── TURN TYPES ──────────────────────────────────────────────

export type TurnPhase =
  | 'VALIDATING'
  | 'DRAWING'
  | 'RESOLVING'
  | 'APPLYING_BUFFS'
  | 'CHECKING_WIPE'
  | 'CHECKING_WIN'
  | 'EMITTING'
  | 'INCREMENTING'
  | 'COMPLETE'
  | 'WIPE'
  | 'WIN';

export type ActionType =
  | 'PURCHASE'
  | 'PASS'
  | 'SELL'
  | 'EXECUTE_EVENT'
  | 'FORCED_ACTION'
  | 'COUNTER'         // HEAD_TO_HEAD specific
  | 'AID'             // TEAM_UP specific
  | 'DEFECT'          // TEAM_UP specific
  | 'GHOST_MIRROR';   // CHASE_A_LEGEND specific

export interface TurnContext {
  runId:           string;
  runSeed:         number;       // numeric — fed to SeededRandom
  rulesetVersion:  string;
  turnNumber:      number;
  tickIndex:       number;
  gameMode:        GameMode;
  mlEnabled:       boolean;      // always false server-side
  phase:           TurnPhase;
  drawnCard:       CardInHand | null;
  playerAction:    ActionType | null;
  events:          TurnEvent[];
  auditHash:       string;
}

export interface TurnEvent {
  eventType:   string;
  turnNumber:  number;
  tickIndex:   number;
  payload:     Record<string, unknown>;
  auditHash:   string;
}

export interface TurnResult {
  success:         boolean;
  phase:           TurnPhase;
  playerState:     PlayerState;
  drawnCard:       CardInHand | null;
  action:          ActionType | null;
  cashDelta:       number;
  incomeDelta:     number;
  expenseDelta:    number;
  cordDeltaBasis:  number;
  triggeredWipe:   boolean;
  wipeCause:       string | null;
  triggeredWin:    boolean;
  outcome:         RunOutcome | null;
  events:          TurnEvent[];
  auditHash:       string;
}

export interface ValidationError {
  code:     string;
  message:  string;
  blocking: boolean;
}

// ─── RUN SESSION ─────────────────────────────────────────────
/**
 * Full engine session for one run.
 * Instantiate once per run; pass seed from server.
 */
export interface RunSession {
  ctx:        TurnContext;
  state:      PlayerState;
  rng:        SeededRandom;
  drawEngine: DrawEngine;
  drawPile:   CardInHand[];
  discardPile:CardInHand[];
  hand:       CardInHand[];
  macro:      MacroEngine;
  portfolio:  PortfolioEngine;
  solvency:   SolvencyEngine;
}

// ─── HELPERS (private module scope) ──────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function buildEventHash(
  eventType:  string,
  turnNumber: number,
  tickIndex:  number,
  payload:    unknown,
): string {
  return sha256(
    JSON.stringify({ eventType, turnNumber, tickIndex, payload }),
  ).slice(0, 24);
}

function buildEvent(
  eventType: string,
  ctx:       TurnContext,
  payload:   Record<string, unknown>,
): TurnEvent {
  return {
    eventType,
    turnNumber: ctx.turnNumber,
    tickIndex:  ctx.tickIndex,
    payload,
    auditHash:  buildEventHash(eventType, ctx.turnNumber, ctx.tickIndex, payload),
  };
}

/**
 * Deterministic asset ID — no Date.now().
 * Reproducible from seed + player + card + turn.
 */
function deterministicAssetId(
  playerId:   string,
  cardId:     string,
  turnNumber: number,
  runSeed:    number,
): string {
  return sha256(`asset:${runSeed}:${playerId}:${cardId}:${turnNumber}`).slice(0, 20);
}

// ─── TURN ENGINE ─────────────────────────────────────────────
export class TurnEngine {
  private readonly mlEnabled: boolean = false;

  // ── Step 1: Validate ─────────────────────────────────────
  validate(state: PlayerState, ctx: TurnContext): ValidationError[] {
    const errors: ValidationError[] = [];

    if (state.turnsToSkip > 0) {
      errors.push({
        code:     'TURN_LOCKED',
        message:  `Player locked for ${state.turnsToSkip} more turn(s)`,
        blocking: true,
      });
    }

    if (state.cash < -500_000) {
      errors.push({
        code:     'CASH_BELOW_ABSOLUTE_FLOOR',
        message:  `Cash ${state.cash} below absolute floor — wipe imminent`,
        blocking: false,
      });
    }

    if (!ctx.rulesetVersion?.trim()) {
      errors.push({
        code:     'MISSING_RULESET_VERSION',
        message:  'Ruleset version not set on TurnContext',
        blocking: true,
      });
    }

    if (ctx.turnNumber < 0 || ctx.tickIndex < 0) {
      errors.push({
        code:     'INVALID_TURN_INDEX',
        message:  `Turn ${ctx.turnNumber} / tick ${ctx.tickIndex} invalid`,
        blocking: true,
      });
    }

    return errors;
  }

  // ── Step 2: Draw Card ────────────────────────────────────
  drawCard(session: RunSession): {
    session:   RunSession;
    card:      CardInHand;
  } {
    const result = session.drawEngine.draw(
      session.drawPile,
      session.discardPile,
      session.hand,
      1,
      session.rng,
    );

    const card = result.drawn[0];
    const updatedSession: RunSession = {
      ...session,
      drawPile:    result.drawPile,
      discardPile: result.discardPile,
      hand:        result.hand,
    };

    return { session: updatedSession, card };
  }

  // ── Step 3: Resolve Card ─────────────────────────────────
  /**
   * Applies card effect to PlayerState based on BaseDeckType.
   * Mode-specific cards (ModeDeckType) delegate to mode-specific logic below.
   * Returns delta values for ledger + cordDeltaBasis for CORD tracking.
   */
  resolveCard(
    card:    CardInHand,
    state:   PlayerState,
    action:  ActionType,
    ctx:     TurnContext,
    session: RunSession,
  ): {
    updatedState:    PlayerState;
    cashDelta:       number;
    incomeDelta:     number;
    expenseDelta:    number;
    cordDeltaBasis:  number;
    events:          TurnEvent[];
    updatedSession:  RunSession;
  } {
    const events: TurnEvent[] = [];
    let cashDelta      = 0;
    let incomeDelta    = 0;
    let expenseDelta   = 0;
    let cordDeltaBasis = card.definition.base_effect.cordDeltaBasis ?? 0;
    let updatedState   = { ...state };
    let updatedSession = session;

    const def = card.definition;
    const fx  = def.base_effect;

    switch (def.deckType) {
      // ── OPPORTUNITY ───────────────────────────────────────
      case BaseDeckType.OPPORTUNITY: {
        if (action !== 'PURCHASE') {
          events.push(buildEvent('OPPORTUNITY_PASSED', ctx, { cardId: def.cardId }));
          updatedState = { ...updatedState, consecutivePasses: updatedState.consecutivePasses + 1 };
          break;
        }
        const cost = def.base_cost;
        if (updatedState.cash < cost) {
          events.push(buildEvent('PURCHASE_BLOCKED_INSUFFICIENT_CASH', ctx, { cardId: def.cardId, required: cost, available: updatedState.cash }));
          break;
        }

        const income = fx.incomeDelta ?? 0;
        cashDelta     = -(cost);
        incomeDelta   = income;

        const assetId = deterministicAssetId(state.playerId, def.cardId, ctx.turnNumber, ctx.runSeed);
        const asset: OwnedAsset = {
          assetId,
          cardId:             def.cardId,
          name:               def.name,
          assetKind:          'BUSINESS',
          originalCost:       cost,
          currentDebt:        0,
          monthlyIncome:      income,
          monthlyDebtService: 0,
          exitMin:            cost * 0.70,
          exitMax:            cost * 1.40,
          acquiredAtTurn:     ctx.turnNumber,
          auditHash:          sha256(`${assetId}|${cost}|${ctx.turnNumber}`).slice(0, 16),
        };

        const acq = session.portfolio.acquire(updatedState, asset, ctx.tickIndex);
        if (acq.success) {
          updatedState = acq.state;
          events.push(buildEvent('ASSET_PURCHASED', ctx, {
            cardId:        def.cardId,
            cardName:      def.name,
            cost,
            income,
            cashDelta,
            auditHash:     acq.auditHash,
          }));
        } else {
          events.push(buildEvent('PURCHASE_BLOCKED', ctx, { cardId: def.cardId, reason: acq.reason }));
          cashDelta = incomeDelta = 0;
        }
        break;
      }

      // ── IPA ───────────────────────────────────────────────
      case BaseDeckType.IPA: {
        if (action !== 'PURCHASE') {
          events.push(buildEvent('IPA_PASSED', ctx, { cardId: def.cardId }));
          updatedState = { ...updatedState, consecutivePasses: updatedState.consecutivePasses + 1 };
          break;
        }
        const cost   = def.base_cost;
        const income = fx.incomeDelta ?? 0;
        if (updatedState.cash < cost) {
          events.push(buildEvent('IPA_BUILD_FAILED', ctx, { cardId: def.cardId, reason: 'INSUFFICIENT_CASH' }));
          break;
        }
        cashDelta   = -cost;
        incomeDelta = income;

        const assetId = deterministicAssetId(state.playerId, def.cardId, ctx.turnNumber, ctx.runSeed);
        const asset: OwnedAsset = {
          assetId,
          cardId:             def.cardId,
          name:               def.name,
          assetKind:          'DIGITAL',
          originalCost:       cost,
          currentDebt:        0,
          monthlyIncome:      income,
          monthlyDebtService: 0,
          exitMin:            cost * 0.60,
          exitMax:            cost * 2.00,
          acquiredAtTurn:     ctx.turnNumber,
          auditHash:          sha256(`${assetId}|${cost}|${ctx.turnNumber}`).slice(0, 16),
        };

        const acq = session.portfolio.acquire(updatedState, asset, ctx.tickIndex);
        if (acq.success) {
          updatedState = acq.state;
          events.push(buildEvent('IPA_BUILT', ctx, {
            cardId: def.cardId, cost, income, auditHash: acq.auditHash,
          }));
        } else {
          events.push(buildEvent('IPA_BUILD_FAILED', ctx, { cardId: def.cardId, reason: acq.reason }));
          cashDelta = incomeDelta = 0;
        }
        break;
      }

      // ── FUBAR ─────────────────────────────────────────────
      case BaseDeckType.FUBAR: {
        if (updatedState.activeShields > 0) {
          updatedState = { ...updatedState, activeShields: updatedState.activeShields - 1 };
          events.push(buildEvent('FUBAR_SHIELDED', ctx, {
            cardId:          def.cardId,
            shieldsRemaining:updatedState.activeShields,
          }));
          cordDeltaBasis = 0.02; // shield use = positive CORD signal
          break;
        }

        cashDelta     = fx.cashDelta ?? 0;
        expenseDelta  = fx.expensesDelta ?? 0;
        incomeDelta   = fx.incomeDelta ?? 0;

        updatedState = applyCashDelta(updatedState, cashDelta);
        if (expenseDelta !== 0) {
          updatedState = {
            ...updatedState,
            monthlyExpenses: updatedState.monthlyExpenses + expenseDelta,
          };
        }
        if (incomeDelta !== 0) {
          updatedState = recalcCashflow({ ...updatedState, monthlyIncome: updatedState.monthlyIncome + incomeDelta });
        }

        // Freeze ticks → turnsToSkip
        const freeze = fx.freezeTicks ?? 0;
        if (freeze > 0) {
          updatedState = { ...updatedState, turnsToSkip: updatedState.turnsToSkip + freeze };
        }

        events.push(buildEvent('FUBAR_APPLIED', ctx, {
          cardId:    def.cardId,
          cardName:  def.name,
          cashDelta,
          expenseDelta,
          freezeTicks: freeze,
          momentLabel: `FUBAR_KILLED_ME: ${def.name} hit for $${Math.abs(cashDelta).toLocaleString()}`,
        }));
        break;
      }

      // ── PRIVILEGED ────────────────────────────────────────
      case BaseDeckType.PRIVILEGED: {
        cashDelta = fx.cashDelta ?? 0;
        if (cashDelta > 0) updatedState = applyCashDelta(updatedState, cashDelta);
        if ((fx.haterHeatDelta ?? 0) !== 0) {
          // haterHeatDelta surfaces on TurnResult; HaterEngine picks it up
          events.push(buildEvent('HATER_HEAT_DELTA', ctx, { delta: fx.haterHeatDelta }));
        }
        if ((fx.incomeDelta ?? 0) > 0) {
          incomeDelta  = fx.incomeDelta!;
          updatedState = recalcCashflow({ ...updatedState, monthlyIncome: updatedState.monthlyIncome + incomeDelta });
        }
        events.push(buildEvent('PRIVILEGED_APPLIED', ctx, {
          cardId: def.cardId, cashDelta, incomeDelta, haterHeatDelta: fx.haterHeatDelta ?? 0,
        }));
        break;
      }

      // ── SO (Systemic Obstacle) ────────────────────────────
      case BaseDeckType.SO: {
        cashDelta    = fx.cashDelta ?? 0;
        expenseDelta = fx.expensesDelta ?? 0;
        if (cashDelta !== 0)    updatedState = applyCashDelta(updatedState, cashDelta);
        if (expenseDelta !== 0) {
          updatedState = { ...updatedState, monthlyExpenses: updatedState.monthlyExpenses + expenseDelta };
          updatedState = recalcCashflow(updatedState);
        }
        events.push(buildEvent('SO_APPLIED', ctx, {
          cardId:      def.cardId,
          cardName:    def.name,
          cashDelta,
          expenseDelta,
          requiresM13Resolution: true,
        }));
        break;
      }

      // ── PHASE_BOUNDARY ────────────────────────────────────
      case BaseDeckType.PHASE_BOUNDARY: {
        const newPhase = deriveRunPhase(ctx.tickIndex);
        updatedState   = { ...updatedState, runPhase: newPhase };
        events.push(buildEvent('PHASE_BOUNDARY_CROSSED', ctx, { newPhase }));
        break;
      }

      // ── MODE DECKS (HEAD_TO_HEAD, TEAM_UP, CHASE_A_LEGEND) ──────────────
      case ModeDeckType.SABOTAGE:
      case ModeDeckType.COUNTER:
      case ModeDeckType.BLUFF: {
        // HEAD_TO_HEAD: delegate to BattleEngine (server-side mode engine)
        events.push(buildEvent('BATTLE_CARD_QUEUED', ctx, {
          cardId: def.cardId, deckType: def.deckType, action,
        }));
        break;
      }

      case ModeDeckType.AID:
      case ModeDeckType.RESCUE:
      case ModeDeckType.TRUST:
      case ModeDeckType.DEFECTION: {
        // TEAM_UP: trust delta
        const trustDelta = fx.trustDelta ?? 0;
        if (trustDelta !== 0) {
          updatedState = { ...updatedState, trustScore: Math.max(0, Math.min(1, updatedState.trustScore + trustDelta)) };
        }
        events.push(buildEvent('SYNDICATE_CARD_APPLIED', ctx, {
          cardId: def.cardId, deckType: def.deckType, trustDelta,
        }));
        break;
      }

      case ModeDeckType.GHOST:
      case ModeDeckType.DISCIPLINE: {
        // CHASE_A_LEGEND: ghost delta
        events.push(buildEvent('PHANTOM_CARD_APPLIED', ctx, {
          cardId: def.cardId, deckType: def.deckType, action,
        }));
        break;
      }

      default: {
        events.push(buildEvent('UNKNOWN_CARD_TYPE', ctx, { cardId: def.cardId, deckType: (def as any).deckType }));
      }
    }

    // Reset consecutivePasses when player acts
    if (action === 'PURCHASE' || action === 'COUNTER' || action === 'AID') {
      updatedState = { ...updatedState, consecutivePasses: 0 };
    }

    return {
      updatedState,
      cashDelta,
      incomeDelta,
      expenseDelta,
      cordDeltaBasis,
      events,
      updatedSession: { ...updatedSession, state: updatedState },
    };
  }

  // ── Step 4: Apply Buffs & Debuffs ────────────────────────
  applyBuffsDebuffs(
    state: PlayerState,
    ctx:   TurnContext,
  ): { updatedState: PlayerState; events: TurnEvent[] } {
    const events: TurnEvent[] = [];

    // Expire elapsed buffs
    const beforeCount  = state.activeBuffs.length;
    let updatedState   = expireBuffs(state, ctx.turnNumber);
    const expiredCount = beforeCount - updatedState.activeBuffs.length;
    if (expiredCount > 0) {
      events.push(buildEvent('BUFFS_EXPIRED', ctx, { count: expiredCount }));
    }

    // Decrement turnsToSkip
    if (updatedState.turnsToSkip > 0) {
      updatedState = { ...updatedState, turnsToSkip: Math.max(0, updatedState.turnsToSkip - 1) };
    }

    // Monthly cashflow tick (every turn represents time passing)
    const netCashflow = updatedState.netCashflow;
    if (netCashflow !== 0) {
      updatedState = applyCashDelta(updatedState, netCashflow);
      events.push(buildEvent('CASHFLOW_TICK', ctx, {
        monthlyIncome:   updatedState.monthlyIncome,
        monthlyExpenses: updatedState.monthlyExpenses,
        netCashflow,
      }));
    }

    // Bleed mode check (GO_ALONE / Empire)
    if (ctx.gameMode === 'GO_ALONE' && updatedState.cash < 12_000) {
      const severity = updatedState.cash <= 0 ? 'TERMINAL'
        : updatedState.cash < 5_000           ? 'CRITICAL'
        : 'WATCH';
      if (!updatedState.bleedModeActive || updatedState.bleedSeverity !== severity) {
        updatedState = { ...updatedState, bleedModeActive: true, bleedSeverity: severity };
        events.push(buildEvent('BLEED_MODE_UPDATED', ctx, { severity, cash: updatedState.cash }));
      }
    } else if (updatedState.bleedModeActive && updatedState.cash >= 12_000) {
      updatedState = { ...updatedState, bleedModeActive: false, bleedSeverity: 'NONE' };
      events.push(buildEvent('BLEED_MODE_CLEARED', ctx, {}));
    }

    return { updatedState, events };
  }

  // ── Step 5: Check Wipe ───────────────────────────────────
  checkWipe(
    state:   PlayerState,
    session: RunSession,
    ctx:     TurnContext,
  ): { isWipe: boolean; wipeCause: string | null; wipeEvent: TurnEvent | null } {
    const wipeEvent = session.solvency.check(state, ctx.tickIndex);
    if (!wipeEvent) return { isWipe: false, wipeCause: null, wipeEvent: null };

    return {
      isWipe:    true,
      wipeCause: wipeEvent.cause,
      wipeEvent: buildEvent('SOLVENCY_WIPE', ctx, {
        type:      wipeEvent.type,
        cause:     wipeEvent.cause,
        cash:      wipeEvent.cashAtWipe,
        netWorth:  wipeEvent.netWorthAtWipe,
        auditHash: wipeEvent.auditHash,
      }),
    };
  }

  // ── Step 6: Check Win ────────────────────────────────────
  /**
   * Win conditions differ by mode:
   *  GO_ALONE       → passive income > expenses AND net worth ≥ FREEDOM_THRESHOLD
   *  HEAD_TO_HEAD   → opponent eliminated
   *  TEAM_UP        → joint net worth target hit
   *  CHASE_A_LEGEND → positive ghostDelta at run end
   */
  checkWin(state: PlayerState, ctx: TurnContext): boolean {
    switch (ctx.gameMode) {
      case 'GO_ALONE':
        return (
          state.monthlyIncome > state.monthlyExpenses &&
          state.netWorth >= FREEDOM_THRESHOLD
        );
      case 'HEAD_TO_HEAD':
        return state.battleBudget >= BATTLE_BUDGET_MAX;
      case 'TEAM_UP':
        return state.trustScore >= 0.95 && state.netWorth >= FREEDOM_THRESHOLD;
      case 'CHASE_A_LEGEND':
        return state.ghostDelta > 0 && ctx.tickIndex >= RUN_TICKS - 1;
      default:
        return false;
    }
  }

  // ── Step 7: Emit Events ──────────────────────────────────
  emitEvents(
    allEvents:   TurnEvent[],
    ctx:         TurnContext,
    isWipe:      boolean,
    isWin:       boolean,
    playerState: PlayerState,
    drawnCard:   CardInHand | null,
    cashDelta:   number,
  ): TurnEvent[] {
    const emitted = [...allEvents];

    emitted.push({
      eventType:  'TURN_COMPLETE',
      turnNumber: ctx.turnNumber,
      tickIndex:  ctx.tickIndex,
      payload: {
        drawnCard:       drawnCard?.cardId ?? null,
        action:          ctx.playerAction,
        cash:            playerState.cash,
        netWorth:        playerState.netWorth,
        monthlyIncome:   playerState.monthlyIncome,
        monthlyExpenses: playerState.monthlyExpenses,
        netCashflow:     playerState.netCashflow,
        isWipe,
        isWin,
        eventCount:      allEvents.length,
        gameMode:        ctx.gameMode,
      },
      auditHash: buildEventHash('TURN_COMPLETE', ctx.turnNumber, ctx.tickIndex, {
        runSeed:        ctx.runSeed,
        rulesetVersion: ctx.rulesetVersion,
        cash:           playerState.cash,
        netWorth:       playerState.netWorth,
      }),
    });

    if (isWipe) {
      emitted.push({
        eventType:  'RUN_WIPE',
        turnNumber: ctx.turnNumber,
        tickIndex:  ctx.tickIndex,
        payload:    { cash: playerState.cash, netWorth: playerState.netWorth, runSeed: ctx.runSeed },
        auditHash:  buildEventHash('RUN_WIPE', ctx.turnNumber, ctx.tickIndex, { runSeed: ctx.runSeed }),
      });
    }

    if (isWin) {
      emitted.push({
        eventType:  'RUN_WIN',
        turnNumber: ctx.turnNumber,
        tickIndex:  ctx.tickIndex,
        payload: {
          monthlyIncome:   playerState.monthlyIncome,
          monthlyExpenses: playerState.monthlyExpenses,
          netWorth:        playerState.netWorth,
          runSeed:         ctx.runSeed,
          gameMode:        ctx.gameMode,
          momentLabel:     'OPPORTUNITY_FLIP: Escaped the rat race',
        },
        auditHash: buildEventHash('RUN_WIN', ctx.turnNumber, ctx.tickIndex, { runSeed: ctx.runSeed }),
      });
    }

    return emitted;
  }

  // ── Step 8: Increment Turn ───────────────────────────────
  incrementTurn(
    state: PlayerState,
    ctx:   TurnContext,
  ): { updatedState: PlayerState; nextCtx: TurnContext; auditHash: string } {
    // Advance run phase
    const runPhase    = deriveRunPhase(ctx.tickIndex + 1);
    const updatedState = { ...state, runPhase };

    const nextCtx: TurnContext = {
      ...ctx,
      turnNumber:   ctx.turnNumber + 1,
      tickIndex:    ctx.tickIndex + 1,
      phase:        'VALIDATING',
      drawnCard:    null,
      playerAction: null,
      events:       [],
      auditHash:    '',
    };

    const auditHash = sha256(JSON.stringify({
      runSeed:        ctx.runSeed,
      rulesetVersion: ctx.rulesetVersion,
      turnNumber:     nextCtx.turnNumber,
      cash:           updatedState.cash,
      netWorth:       updatedState.netWorth,
    })).slice(0, 32);

    nextCtx.auditHash = auditHash;

    return { updatedState, nextCtx, auditHash };
  }

  // ── Full Turn Orchestrator ───────────────────────────────
  /**
   * Execute one complete turn (steps 1–8).
   * Mutates nothing — all state returned in TurnResult.
   */
  executeTurn(
    session: RunSession,
    action:  ActionType = 'PASS',
  ): { result: TurnResult; session: RunSession } {
    let { ctx }        = session;
    let playerState    = session.state;
    const allEvents: TurnEvent[] = [];

    // ── 1. Validate
    const errors    = this.validate(playerState, ctx);
    const blocking  = errors.filter(e => e.blocking);
    if (blocking.length > 0) {
      const failHash = sha256(JSON.stringify({ errors: blocking, runSeed: ctx.runSeed })).slice(0, 32);
      return {
        result: {
          success: false, phase: 'VALIDATING', playerState,
          drawnCard: null, action: null,
          cashDelta: 0, incomeDelta: 0, expenseDelta: 0,
          cordDeltaBasis: 0,
          triggeredWipe: false, wipeCause: null,
          triggeredWin: false, outcome: null,
          events: [], auditHash: failHash,
        },
        session,
      };
    }

    // ── 2. Draw
    ctx = { ...ctx, phase: 'DRAWING' };
    const { session: sessionAfterDraw, card } = this.drawCard(session);
    let currentSession = sessionAfterDraw;
    ctx = { ...ctx, drawnCard: card };
    allEvents.push(buildEvent('CARD_DRAWN', ctx, {
      cardId:   card.cardId,
      cardName: card.definition.name,
      deckType: card.definition.deckType,
    }));

    // ── 3. Resolve
    ctx = { ...ctx, phase: 'RESOLVING', playerAction: action };
    const resolved = this.resolveCard(card, playerState, action, ctx, currentSession);
    playerState     = resolved.updatedState;
    currentSession  = resolved.updatedSession;
    allEvents.push(...resolved.events);

    // ── 4. Buffs / Debuffs
    ctx = { ...ctx, phase: 'APPLYING_BUFFS' };
    const { updatedState: stateAfterBuffs, events: buffEvents } = this.applyBuffsDebuffs(playerState, ctx);
    playerState = stateAfterBuffs;
    allEvents.push(...buffEvents);

    // ── 5. Wipe check
    ctx = { ...ctx, phase: 'CHECKING_WIPE' };
    const { isWipe, wipeCause, wipeEvent } = this.checkWipe(playerState, currentSession, ctx);
    if (wipeEvent) allEvents.push(wipeEvent);

    if (isWipe) {
      const finalEvents = this.emitEvents(allEvents, { ...ctx, phase: 'EMITTING' }, true, false, playerState, card, resolved.cashDelta);
      return {
        result: {
          success: true, phase: 'WIPE', playerState,
          drawnCard: card, action,
          cashDelta:      resolved.cashDelta,
          incomeDelta:    resolved.incomeDelta,
          expenseDelta:   resolved.expenseDelta,
          cordDeltaBasis: resolved.cordDeltaBasis,
          triggeredWipe: true, wipeCause,
          triggeredWin: false, outcome: 'BANKRUPT',
          events: finalEvents,
          auditHash: sha256(JSON.stringify({ wipe: true, runSeed: ctx.runSeed, turn: ctx.turnNumber })).slice(0, 32),
        },
        session: { ...currentSession, state: playerState, ctx },
      };
    }

    // ── 6. Win check
    ctx = { ...ctx, phase: 'CHECKING_WIN' };
    const isWin = this.checkWin(playerState, ctx);

    // ── 7. Emit events
    ctx = { ...ctx, phase: 'EMITTING' };
    const finalEvents = this.emitEvents(allEvents, ctx, false, isWin, playerState, card, resolved.cashDelta);

    // ── 8. Increment
    ctx = { ...ctx, phase: 'INCREMENTING' };
    const { updatedState: finalState, nextCtx, auditHash } = this.incrementTurn(playerState, ctx);

    const outcome: RunOutcome | null = isWin
      ? 'FREEDOM'
      : ctx.tickIndex >= RUN_TICKS - 1
        ? 'TIMEOUT'
        : null;

    const finalSession: RunSession = {
      ...currentSession,
      state: finalState,
      ctx:   nextCtx,
    };

    return {
      result: {
        success: true,
        phase:   isWin ? 'WIN' : 'COMPLETE',
        playerState: finalState,
        drawnCard:   card,
        action,
        cashDelta:      resolved.cashDelta,
        incomeDelta:    resolved.incomeDelta,
        expenseDelta:   resolved.expenseDelta,
        cordDeltaBasis: resolved.cordDeltaBasis,
        triggeredWipe:  false,
        wipeCause:      null,
        triggeredWin:   isWin,
        outcome,
        events:         finalEvents,
        auditHash,
      },
      session: finalSession,
    };
  }
}

// ─── RUN SESSION FACTORY ─────────────────────────────────────
/**
 * Instantiate a fully wired RunSession.
 * Call once per run. Pass the numeric seed from pzo-server.
 */
export function createRunSession(
  playerId:       string,
  runId:          string,
  seed:           number,
  gameMode:       GameMode,
  rulesetVersion: string,
  startingDeck:   CardInHand[],
): RunSession {
  const rng       = new SeededRandom(seed);
  const drawEngine= new DrawEngine();
  const macro     = new MacroEngine({
    inflation:       0.02,
    creditTightness: 0.20,
    phase:           MacroPhase.EXPANSION,
  });
  const portfolio  = new PortfolioEngine();
  const solvency   = new SolvencyEngine();
  const state      = createInitialPlayerState(playerId);

  const ctx: TurnContext = {
    runId,
    runSeed:        seed,
    rulesetVersion,
    turnNumber:     1,
    tickIndex:      0,
    gameMode,
    mlEnabled:      false,
    phase:          'VALIDATING',
    drawnCard:      null,
    playerAction:   null,
    events:         [],
    auditHash:      '',
  };

  return {
    ctx,
    state,
    rng,
    drawEngine,
    drawPile:    rng.shuffle([...startingDeck]),
    discardPile: [],
    hand:        [],
    macro,
    portfolio,
    solvency,
  };
}