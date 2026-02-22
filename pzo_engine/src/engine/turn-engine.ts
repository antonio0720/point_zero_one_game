/**
 * Turn Engine — Core Game Loop Orchestrator
 * Drives the 7-step turn sequence:
 *   validate → drawCard → resolveCard → applyBuffsDebuffs
 *   → checkWipe → checkWin → emitEvents → incrementTurn
 *
 * All state mutations are deterministic, ledger-emitting, and audit-hashed.
 *
 * Deploy to: pzo_engine/src/engine/turn-engine.ts
 */

import { createHash } from 'crypto';

// ─── Card & Deck Types ────────────────────────────────────────────────────────

export type DeckType = 'OPPORTUNITY' | 'IPA' | 'FUBAR' | 'MISSED_OPPORTUNITY' | 'PRIVILEGED' | 'SO';

export interface CardEcon {
  assetKind?: 'REAL_ESTATE' | 'BUSINESS';
  cost?: number;
  debtLabel?: 'MORTGAGE' | 'LIABILITY';
  debt?: number;
  downPayment?: number;
  cashflowMonthly?: number;
  roiPct?: number;
  exitMin?: number;
  exitMax?: number;
  setupCost?: number;
  cashImpact?: number;
  turnsLost?: number;
  value?: number;
}

export class Card {
  readonly id: string;
  readonly name: string;
  readonly deckType: DeckType;
  readonly econ: CardEcon;
  readonly description: string;

  constructor(
    id: string,
    name: string,
    deckType: DeckType,
    econ: CardEcon = {},
    description = '',
  ) {
    this.id = id;
    this.name = name;
    this.deckType = deckType;
    this.econ = econ;
    this.description = description;
  }
}

// ─── Player State ─────────────────────────────────────────────────────────────

export interface ActiveBuff {
  buffId: string;
  buffType: 'SHIELD' | 'DOWNPAY_DISCOUNT' | 'RATE_DISCOUNT' | 'CASHFLOW_BOOST';
  value: number;
  remainingUses: number;        // 1 = consume on next use; -1 = persistent for N turns
  expiresAtTurn: number;
}

export interface OwnedAsset {
  assetId: string;
  cardId: string;
  assetKind: 'REAL_ESTATE' | 'BUSINESS' | 'IPA';
  originalCost: number;
  currentDebt: number;
  monthlyIncome: number;
  monthlyDebtService: number;
  exitMin: number;
  exitMax: number;
  acquiredAtTurn: number;
}

export interface TurnEnginePlayerState {
  playerId: string;
  cash: number;
  passiveIncomeMonthly: number;
  monthlyExpenses: number;
  netWorth: number;
  totalAssetsValue: number;
  totalLiabilities: number;
  assets: OwnedAsset[];
  activeBuffs: ActiveBuff[];
  activeShields: number;
  turnsLocked: number;
  nextEligibleTurn: number;
  loanDenied: boolean;
  hasExitedRatRace: boolean;
  ratRaceExitTurn: number | null;
  version: number;  // optimistic lock
}

// ─── Turn State ───────────────────────────────────────────────────────────────

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

export type ActionType = 'PURCHASE' | 'PASS' | 'SELL' | 'EXECUTE_EVENT' | 'FORCED_ACTION';

export interface TurnContext {
  runSeed: string;
  rulesetVersion: string;
  turnNumber: number;
  tickIndex: number;
  mlEnabled: boolean;
  phase: TurnPhase;
  drawnCard: Card | null;
  playerAction: ActionType | null;
  events: TurnEvent[];
  auditHash: string;
}

export interface TurnEvent {
  eventType: string;
  turnNumber: number;
  tickIndex: number;
  payload: Record<string, unknown>;
  auditHash: string;
}

export interface TurnResult {
  success: boolean;
  phase: TurnPhase;
  playerState: TurnEnginePlayerState;
  drawnCard: Card | null;
  action: ActionType | null;
  cashDelta: number;
  incomeDelta: number;
  expenseDelta: number;
  triggeredWipe: boolean;
  wipeCause: string | null;
  triggeredWin: boolean;
  events: TurnEvent[];
  auditHash: string;
}

export interface ValidationError {
  code: string;
  message: string;
  blocking: boolean;
}

// ─── Deck (deterministic draw) ────────────────────────────────────────────────

export class Deck {
  private readonly cards: Card[];
  private readonly runSeed: string;
  private drawIndex: number;

  constructor(cards: Card[], runSeed: string, startIndex = 0) {
    this.cards = cards;
    this.runSeed = runSeed;
    this.drawIndex = startIndex;
  }

  /**
   * Deterministic draw: seed + drawIndex → card index.
   * Same seed + same index always returns the same card.
   */
  draw(): Card {
    if (this.cards.length === 0) throw new Error('Deck is empty');
    const hash = createHash('sha256')
      .update(`${this.runSeed}:draw:${this.drawIndex}`)
      .digest('hex');
    const idx = parseInt(hash.slice(0, 8), 16) % this.cards.length;
    this.drawIndex++;
    return this.cards[idx];
  }

  getDrawIndex(): number {
    return this.drawIndex;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function buildEventHash(eventType: string, turnNumber: number, tickIndex: number, payload: unknown): string {
  return sha256(JSON.stringify({ eventType, turnNumber, tickIndex, payload })).slice(0, 24);
}

function buildEvent(
  eventType: string,
  ctx: TurnContext,
  payload: Record<string, unknown>,
): TurnEvent {
  return {
    eventType,
    turnNumber: ctx.turnNumber,
    tickIndex: ctx.tickIndex,
    payload,
    auditHash: buildEventHash(eventType, ctx.turnNumber, ctx.tickIndex, payload),
  };
}

function computeNetWorth(state: TurnEnginePlayerState): number {
  const totalAssets = state.assets.reduce((s, a) => s + a.originalCost, 0);
  const totalLiabilities = state.assets.reduce((s, a) => s + a.currentDebt, 0);
  return totalAssets - totalLiabilities + state.cash;
}

function computePassiveIncome(state: TurnEnginePlayerState): number {
  return state.assets.reduce((s, a) => s + a.monthlyIncome - a.monthlyDebtService, 0);
}

// ─── Turn Engine ──────────────────────────────────────────────────────────────

export class TurnEngine {
  private mlEnabled: boolean;
  private auditHash: string;

  constructor(mlEnabled = false) {
    this.mlEnabled = mlEnabled;
    this.auditHash = '';
  }

  // ── Step 1: Validate ──────────────────────────────────────────────────────

  public validate(
    state: TurnEnginePlayerState,
    ctx: TurnContext,
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Turn lock check
    if (state.turnsLocked > 0 || ctx.turnNumber < state.nextEligibleTurn) {
      errors.push({
        code: 'TURN_LOCKED',
        message: `Player locked until turn ${state.nextEligibleTurn}`,
        blocking: true,
      });
    }

    // Cash floor sanity (non-blocking warning)
    if (state.cash < -500_000) {
      errors.push({
        code: 'CASH_BELOW_ABSOLUTE_FLOOR',
        message: `Cash ${state.cash} below absolute floor — wipe imminent`,
        blocking: false,
      });
    }

    // Version sanity
    if (state.version < 1) {
      errors.push({
        code: 'INVALID_STATE_VERSION',
        message: 'Player state version invalid',
        blocking: true,
      });
    }

    // Ruleset version match
    if (!ctx.rulesetVersion || ctx.rulesetVersion.trim() === '') {
      errors.push({
        code: 'MISSING_RULESET_VERSION',
        message: 'Ruleset version not set on turn context',
        blocking: true,
      });
    }

    return errors;
  }

  // ── Step 2: Draw Card ─────────────────────────────────────────────────────

  public drawCard(deck: Deck, ctx: TurnContext): Card {
    const card = deck.draw();
    return card;
  }

  // ── Step 3: Resolve Card ──────────────────────────────────────────────────

  public resolveCard(
    card: Card,
    state: TurnEnginePlayerState,
    action: ActionType,
    ctx: TurnContext,
  ): {
    updatedState: TurnEnginePlayerState;
    cashDelta: number;
    incomeDelta: number;
    expenseDelta: number;
    events: TurnEvent[];
  } {
    const events: TurnEvent[] = [];
    let cashDelta = 0;
    let incomeDelta = 0;
    let expenseDelta = 0;
    let updatedState = { ...state };

    switch (card.deckType) {
      case 'OPPORTUNITY': {
        if (action === 'PURCHASE' && card.econ.downPayment !== undefined) {
          const downPayment = this.applyDownPaymentDiscount(card.econ.downPayment, updatedState);
          const debt = card.econ.debt ?? 0;
          const monthlyIncome = card.econ.cashflowMonthly ?? 0;

          if (!updatedState.loanDenied || debt === 0) {
            cashDelta = -downPayment;
            incomeDelta = monthlyIncome;
            updatedState = this.acquireAsset(updatedState, card, downPayment, debt, monthlyIncome);
            events.push(buildEvent('ASSET_PURCHASED', ctx, {
              cardId: card.id,
              cardName: card.name,
              downPayment,
              debt,
              monthlyIncome,
              cashDelta,
            }));
          } else {
            // Loan denied — pass
            cashDelta = 0;
            events.push(buildEvent('PURCHASE_BLOCKED_LOAN_DENIED', ctx, { cardId: card.id }));
          }
        } else {
          events.push(buildEvent('OPPORTUNITY_PASSED', ctx, { cardId: card.id, reason: action }));
        }
        break;
      }

      case 'IPA': {
        if (action === 'PURCHASE' && card.econ.setupCost !== undefined) {
          const setupCost = card.econ.setupCost;
          if (updatedState.cash >= setupCost) {
            cashDelta = -setupCost;
            incomeDelta = card.econ.cashflowMonthly ?? 0;
            updatedState = this.acquireAsset(updatedState, card, setupCost, 0, incomeDelta);
            events.push(buildEvent('IPA_BUILT', ctx, {
              cardId: card.id,
              setupCost,
              monthlyIncome: incomeDelta,
            }));
          } else {
            events.push(buildEvent('IPA_BUILD_FAILED', ctx, { cardId: card.id, reason: 'INSUFFICIENT_CASH' }));
          }
        }
        break;
      }

      case 'FUBAR': {
        // Check shield first
        if (updatedState.activeShields > 0) {
          updatedState = { ...updatedState, activeShields: updatedState.activeShields - 1 };
          events.push(buildEvent('FUBAR_SHIELDED', ctx, { cardId: card.id, shieldsRemaining: updatedState.activeShields }));
        } else {
          cashDelta = card.econ.cashImpact ?? 0;
          updatedState = { ...updatedState, cash: updatedState.cash + cashDelta };
          events.push(buildEvent('FUBAR_APPLIED', ctx, {
            cardId: card.id,
            cardName: card.name,
            cashDelta,
            momentLabel: `FUBAR_KILLED_ME: ${card.name} hit for $${Math.abs(cashDelta).toLocaleString()}`,
          }));
        }
        break;
      }

      case 'MISSED_OPPORTUNITY': {
        const turnsLost = card.econ.turnsLost ?? 1;
        updatedState = {
          ...updatedState,
          turnsLocked: updatedState.turnsLocked + turnsLost,
          nextEligibleTurn: ctx.turnNumber + turnsLost + 1,
        };
        events.push(buildEvent('MISSED_OPPORTUNITY_APPLIED', ctx, {
          cardId: card.id,
          turnsLost,
          momentLabel: `MISSED_THE_BAG: ${card.name} — skipped ${turnsLost} turn(s)`,
        }));
        break;
      }

      case 'PRIVILEGED': {
        const value = card.econ.value ?? 0;
        cashDelta = value;
        updatedState = this.applyPrivilegedCard(updatedState, card, value, ctx);
        events.push(buildEvent('PRIVILEGED_APPLIED', ctx, { cardId: card.id, value }));
        break;
      }

      case 'SO': {
        // SO cards apply systemic friction — handled by M13 integration
        // TurnEngine records the event; M13 module computes the effect externally
        events.push(buildEvent('SO_DRAWN', ctx, {
          cardId: card.id,
          cardName: card.name,
          requiresM13Resolution: true,
        }));
        break;
      }
    }

    // Recalculate derived fields
    updatedState = {
      ...updatedState,
      cash: updatedState.cash + (card.deckType !== 'FUBAR' ? cashDelta : 0), // FUBAR already applied above
      passiveIncomeMonthly: computePassiveIncome(updatedState),
      netWorth: computeNetWorth(updatedState),
    };

    return { updatedState, cashDelta, incomeDelta, expenseDelta, events };
  }

  // ── Step 4: Apply Buffs & Debuffs ─────────────────────────────────────────

  public applyBuffsDebuffs(
    state: TurnEnginePlayerState,
    ctx: TurnContext,
  ): { updatedState: TurnEnginePlayerState; events: TurnEvent[] } {
    const events: TurnEvent[] = [];
    let updatedState = { ...state };

    // Process turn-decrement on all timed buffs
    const expiredBuffs: ActiveBuff[] = [];
    const remainingBuffs: ActiveBuff[] = [];

    for (const buff of updatedState.activeBuffs) {
      if (buff.expiresAtTurn <= ctx.turnNumber) {
        expiredBuffs.push(buff);
      } else {
        remainingBuffs.push(buff);
      }
    }

    if (expiredBuffs.length > 0) {
      events.push(buildEvent('BUFFS_EXPIRED', ctx, {
        expiredBuffIds: expiredBuffs.map(b => b.buffId),
      }));
    }

    // Decrement turn lock
    if (updatedState.turnsLocked > 0) {
      updatedState = {
        ...updatedState,
        turnsLocked: Math.max(0, updatedState.turnsLocked - 1),
      };
    }

    // Apply cashflow tick (monthly income vs expenses)
    const monthlyCashflow = updatedState.passiveIncomeMonthly - updatedState.monthlyExpenses;
    if (monthlyCashflow !== 0) {
      updatedState = {
        ...updatedState,
        cash: updatedState.cash + monthlyCashflow,
      };
      events.push(buildEvent('CASHFLOW_TICK', ctx, {
        passiveIncome: updatedState.passiveIncomeMonthly,
        expenses: updatedState.monthlyExpenses,
        netCashflow: monthlyCashflow,
      }));
    }

    updatedState = {
      ...updatedState,
      activeBuffs: remainingBuffs,
      netWorth: computeNetWorth(updatedState),
    };

    return { updatedState, events };
  }

  // ── Step 5: Check Wipe ────────────────────────────────────────────────────

  public checkWipe(state: TurnEnginePlayerState): {
    isWipe: boolean;
    wipeCause: string | null;
    event: TurnEvent | null;
    ctx: TurnContext | null;
  } {
    // Cash absolute floor
    if (state.cash < -500_000) {
      return {
        isWipe: true,
        wipeCause: 'CASH_BELOW_ABSOLUTE_FLOOR',
        event: null,
        ctx: null,
      };
    }

    // Net worth floor
    if (state.netWorth < -100_000) {
      return {
        isWipe: true,
        wipeCause: 'NET_WORTH_BELOW_FLOOR',
        event: null,
        ctx: null,
      };
    }

    // Cash negative AND no assets to liquidate
    if (state.cash < 0) {
      const maxRecovery = state.assets.reduce((sum, a) => {
        const exitValue = a.exitMin > 0 ? a.exitMin : a.originalCost * 0.70;
        return sum + Math.max(0, exitValue - a.currentDebt);
      }, 0);
      if (maxRecovery < Math.abs(state.cash)) {
        return {
          isWipe: true,
          wipeCause: 'CASH_NEGATIVE_UNRECOVERABLE',
          event: null,
          ctx: null,
        };
      }
    }

    return { isWipe: false, wipeCause: null, event: null, ctx: null };
  }

  // ── Step 6: Check Win ─────────────────────────────────────────────────────

  public checkWin(state: TurnEnginePlayerState): boolean {
    // Win = passive income > total monthly expenses (escaped the rat race)
    return state.passiveIncomeMonthly > state.monthlyExpenses && state.passiveIncomeMonthly > 0;
  }

  // ── Step 7: Emit Events ───────────────────────────────────────────────────

  public emitEvents(
    allEvents: TurnEvent[],
    ctx: TurnContext,
    isWipe: boolean,
    isWin: boolean,
    playerState: TurnEnginePlayerState,
  ): TurnEvent[] {
    const emitted = [...allEvents];

    // Turn summary event — always emitted
    emitted.push({
      eventType: 'TURN_COMPLETE',
      turnNumber: ctx.turnNumber,
      tickIndex: ctx.tickIndex,
      payload: {
        drawnCard: ctx.drawnCard?.id ?? null,
        action: ctx.playerAction,
        cash: playerState.cash,
        netWorth: playerState.netWorth,
        passiveIncome: playerState.passiveIncomeMonthly,
        monthlyExpenses: playerState.monthlyExpenses,
        isWipe,
        isWin,
        eventCount: allEvents.length,
      },
      auditHash: buildEventHash('TURN_COMPLETE', ctx.turnNumber, ctx.tickIndex, {
        runSeed: ctx.runSeed,
        rulesetVersion: ctx.rulesetVersion,
        cash: playerState.cash,
        netWorth: playerState.netWorth,
      }),
    });

    if (isWipe) {
      emitted.push({
        eventType: 'RUN_WIPE',
        turnNumber: ctx.turnNumber,
        tickIndex: ctx.tickIndex,
        payload: {
          cash: playerState.cash,
          netWorth: playerState.netWorth,
          runSeed: ctx.runSeed,
        },
        auditHash: buildEventHash('RUN_WIPE', ctx.turnNumber, ctx.tickIndex, { runSeed: ctx.runSeed }),
      });
    }

    if (isWin) {
      emitted.push({
        eventType: 'RUN_WIN',
        turnNumber: ctx.turnNumber,
        tickIndex: ctx.tickIndex,
        payload: {
          passiveIncome: playerState.passiveIncomeMonthly,
          monthlyExpenses: playerState.monthlyExpenses,
          netWorth: playerState.netWorth,
          runSeed: ctx.runSeed,
          momentLabel: 'OPPORTUNITY_FLIP: Escaped the rat race',
        },
        auditHash: buildEventHash('RUN_WIN', ctx.turnNumber, ctx.tickIndex, { runSeed: ctx.runSeed }),
      });
    }

    return emitted;
  }

  // ── Step 8: Increment Turn ────────────────────────────────────────────────

  public incrementTurn(state: TurnEnginePlayerState, ctx: TurnContext): {
    updatedState: TurnEnginePlayerState;
    nextCtx: TurnContext;
    auditHash: string;
  } {
    const updatedState: TurnEnginePlayerState = {
      ...state,
      version: state.version + 1,
    };

    const nextCtx: TurnContext = {
      ...ctx,
      turnNumber: ctx.turnNumber + 1,
      phase: 'VALIDATING',
      drawnCard: null,
      playerAction: null,
      events: [],
    };

    const newAuditHash = sha256(JSON.stringify({
      runSeed: ctx.runSeed,
      rulesetVersion: ctx.rulesetVersion,
      turnNumber: nextCtx.turnNumber,
      cash: updatedState.cash,
      netWorth: updatedState.netWorth,
      version: updatedState.version,
    })).slice(0, 32);

    this.auditHash = newAuditHash;
    nextCtx.auditHash = newAuditHash;

    return { updatedState, nextCtx, auditHash: newAuditHash };
  }

  // ── Full Turn Orchestrator ────────────────────────────────────────────────

  /**
   * Execute a complete turn in sequence.
   * Returns full TurnResult including updated state, events, wipe/win flags.
   */
  public executeTurn(
    deck: Deck,
    playerState: TurnEnginePlayerState,
    ctx: TurnContext,
    action: ActionType = 'PASS',
  ): TurnResult {
    const allEvents: TurnEvent[] = [];

    // Step 1: Validate
    const validationErrors = this.validate(playerState, ctx);
    const blockingErrors = validationErrors.filter(e => e.blocking);
    if (blockingErrors.length > 0) {
      return {
        success: false,
        phase: 'VALIDATING',
        playerState,
        drawnCard: null,
        action: null,
        cashDelta: 0,
        incomeDelta: 0,
        expenseDelta: 0,
        triggeredWipe: false,
        wipeCause: null,
        triggeredWin: false,
        events: [],
        auditHash: sha256(JSON.stringify({ errors: blockingErrors, ctx: ctx.runSeed })).slice(0, 32),
      };
    }

    // Step 2: Draw
    const card = this.drawCard(deck, ctx);
    ctx = { ...ctx, drawnCard: card, phase: 'DRAWING' };
    allEvents.push(buildEvent('CARD_DRAWN', ctx, {
      cardId: card.id,
      cardName: card.name,
      deckType: card.deckType,
    }));

    // Step 3: Resolve
    ctx = { ...ctx, phase: 'RESOLVING', playerAction: action };
    const { updatedState: stateAfterCard, cashDelta, incomeDelta, expenseDelta, events: resolveEvents } =
      this.resolveCard(card, playerState, action, ctx);
    allEvents.push(...resolveEvents);

    // Step 4: Buffs/Debuffs
    ctx = { ...ctx, phase: 'APPLYING_BUFFS' };
    const { updatedState: stateAfterBuffs, events: buffEvents } =
      this.applyBuffsDebuffs(stateAfterCard, ctx);
    allEvents.push(...buffEvents);

    // Step 5: Wipe check
    ctx = { ...ctx, phase: 'CHECKING_WIPE' };
    const { isWipe, wipeCause } = this.checkWipe(stateAfterBuffs);
    if (isWipe) {
      const finalEvents = this.emitEvents(allEvents, { ...ctx, phase: 'EMITTING' }, true, false, stateAfterBuffs);
      return {
        success: true,
        phase: 'WIPE',
        playerState: stateAfterBuffs,
        drawnCard: card,
        action,
        cashDelta,
        incomeDelta,
        expenseDelta,
        triggeredWipe: true,
        wipeCause,
        triggeredWin: false,
        events: finalEvents,
        auditHash: sha256(JSON.stringify({ wipe: true, runSeed: ctx.runSeed, turn: ctx.turnNumber })).slice(0, 32),
      };
    }

    // Step 6: Win check
    ctx = { ...ctx, phase: 'CHECKING_WIN' };
    const isWin = this.checkWin(stateAfterBuffs);

    // Step 7: Emit events
    ctx = { ...ctx, phase: 'EMITTING' };
    const finalEvents = this.emitEvents(allEvents, ctx, false, isWin, stateAfterBuffs);

    // Step 8: Increment turn
    ctx = { ...ctx, phase: 'INCREMENTING' };
    const { updatedState: finalState, auditHash } = this.incrementTurn(stateAfterBuffs, ctx);

    return {
      success: true,
      phase: isWin ? 'WIN' : 'COMPLETE',
      playerState: finalState,
      drawnCard: card,
      action,
      cashDelta,
      incomeDelta,
      expenseDelta,
      triggeredWipe: false,
      wipeCause: null,
      triggeredWin: isWin,
      events: finalEvents,
      auditHash,
    };
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private applyDownPaymentDiscount(baseDownPayment: number, state: TurnEnginePlayerState): number {
    const discountBuff = state.activeBuffs.find(b => b.buffType === 'DOWNPAY_DISCOUNT');
    if (discountBuff) return Math.max(0, baseDownPayment - discountBuff.value);
    return baseDownPayment;
  }

  private acquireAsset(
    state: TurnEnginePlayerState,
    card: Card,
    downPayment: number,
    debt: number,
    monthlyIncome: number,
  ): TurnEnginePlayerState {
    const assetId = sha256(`asset:${state.playerId}:${card.id}:${Date.now()}`).slice(0, 20);
    const newAsset: OwnedAsset = {
      assetId,
      cardId: card.id,
      assetKind: card.econ.assetKind ?? 'BUSINESS',
      originalCost: card.econ.cost ?? downPayment + debt,
      currentDebt: debt,
      monthlyIncome,
      monthlyDebtService: 0,  // computed by debt service engine
      exitMin: card.econ.exitMin ?? (card.econ.cost ?? 0) * 0.7,
      exitMax: card.econ.exitMax ?? (card.econ.cost ?? 0) * 1.3,
      acquiredAtTurn: 0, // injected by caller
    };

    return {
      ...state,
      cash: state.cash - downPayment,
      assets: [...state.assets, newAsset],
      totalAssetsValue: state.totalAssetsValue + newAsset.originalCost,
      totalLiabilities: state.totalLiabilities + debt,
    };
  }

  private applyPrivilegedCard(
    state: TurnEnginePlayerState,
    card: Card,
    value: number,
    ctx: TurnContext,
  ): TurnEnginePlayerState {
    // Privileged cards can be cash grants, shields, or discounts
    if (value > 0 && card.name.toLowerCase().includes('shield')) {
      return { ...state, activeShields: state.activeShields + 1 };
    }
    if (value > 0 && card.name.toLowerCase().includes('discount')) {
      const buff: ActiveBuff = {
        buffId: sha256(`buff:${card.id}:${ctx.turnNumber}`).slice(0, 12),
        buffType: 'DOWNPAY_DISCOUNT',
        value,
        remainingUses: 1,
        expiresAtTurn: ctx.turnNumber + 3,
      };
      return { ...state, activeBuffs: [...state.activeBuffs, buff] };
    }
    // Default: cash grant
    return { ...state, cash: state.cash + value };
  }
}
