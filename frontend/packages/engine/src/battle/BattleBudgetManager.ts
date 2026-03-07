/**
 * FILE: pzo-web/src/engines/battle/BattleBudgetManager.ts
 * Pure per-tick budget allocation calculator.
 *
 * Responsibilities:
 *   - Reset budget to income-tier amount at tick start
 *   - Deduct action costs and track remaining/spent pts
 *   - Validate affordability (sufficient pts)
 *   - Expose snapshot for UI and orchestrator
 *
 * NOT responsible for:
 *   - Validating whether action targets are in valid bot states
 *   - Any engine calls — this is a pure calculation module
 *
 * Target validation (e.g. COUNTER_EVIDENCE_FILE on valid bot state)
 * lives in BattleEngine.executeBudgetAction().
 */
import { v4 as uuidv4 } from 'uuid';
import {
  BattleActionType,
  BattleBudgetState,
  BattleAction,
  IncomeTier,
  BATTLE_ACTION_COSTS,
  INCOME_TIER_BUDGETS,
  resolveIncomeTier,
  BotId,
} from './types';
import { ShieldLayerId } from '../shield/types';

export class BattleBudgetManager {
  private budget!: BattleBudgetState;

  constructor() {
    this.budget = this.buildEmpty();
  }

  private buildEmpty(): BattleBudgetState {
    return {
      incomeTier:              IncomeTier.SURVIVAL,
      totalPts:                2,
      remainingPts:            2,
      spentPts:                0,
      tickNumber:              0,
      actionsExecutedThisTick: [],
    };
  }

  /**
   * Called at the start of each tick.
   * Resets budget to the player's income-tier allocation.
   * Unspent pts from the prior tick are DISCARDED — hoarding is impossible.
   */
  public resetForTick(monthlyIncome: number, tick: number): BattleBudgetState {
    const tier  = resolveIncomeTier(monthlyIncome);
    const total = INCOME_TIER_BUDGETS[tier];

    this.budget = {
      incomeTier:              tier,
      totalPts:                total,
      remainingPts:            total,
      spentPts:                0,
      tickNumber:              tick,
      actionsExecutedThisTick: [],
    };

    return { ...this.budget };
  }

  /**
   * Execute a budget action.
   * Returns BattleAction on success.
   * Returns null if insufficient pts remain — pts are NOT deducted on failure.
   *
   * Note: target validity (bot state, layer) is NOT checked here.
   * BattleEngine.executeBudgetAction() is responsible for those guards.
   */
  public executeAction(
    actionType: BattleActionType,
    targetBotId: BotId | null,
    targetLayerId: ShieldLayerId | null,
    tick: number
  ): BattleAction | null {
    const cost = BATTLE_ACTION_COSTS[actionType];

    if (this.budget.remainingPts < cost) return null;

    this.budget.remainingPts -= cost;
    this.budget.spentPts     += cost;
    this.budget.actionsExecutedThisTick.push(actionType);

    return {
      actionId:      uuidv4(),
      actionType,
      targetBotId,
      targetLayerId,
      cost,
      tickNumber:    tick,
    };
  }

  /** Check affordability without deducting pts. */
  public canAfford(actionType: BattleActionType): boolean {
    return this.budget.remainingPts >= BATTLE_ACTION_COSTS[actionType];
  }

  public getRemainingPts(): number {
    return this.budget.remainingPts;
  }

  public getIncomeTier(): IncomeTier {
    return this.budget.incomeTier;
  }

  /** Returns a shallow copy — budget state is read-only outside this class. */
  public getSnapshot(): BattleBudgetState {
    return {
      ...this.budget,
      actionsExecutedThisTick: [...this.budget.actionsExecutedThisTick],
    };
  }
}