/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/battle/BattleBudgetManager.ts
 *
 * Doctrine:
 * - EngineRuntime already handles baseline per-tick PvP budget accrual
 * - this manager handles event-driven counterplay budget adjustments only
 * - hostile injections should increase response budget, not double baseline accrual
 */

import type { AttackEvent } from '../core/GamePrimitives';
import type { BudgetResolution, BudgetResolutionInput } from './types';

export class BattleBudgetManager {
  private clampBudget(value: number, cap: number): number {
    return Math.min(cap, Math.max(0, Math.round(value * 100) / 100));
  }

  public resolveAfterInjection(input: BudgetResolutionInput): BudgetResolution {
    if (input.mode !== 'pvp' || input.injectedAttacks.length === 0) {
      return {
        battleBudget: this.clampBudget(input.current, input.cap),
        firstBloodClaimed: input.firstBloodClaimed,
        notes: [],
      };
    }

    let battleBudget = this.clampBudget(input.current, input.cap);
    let firstBloodClaimed = input.firstBloodClaimed;
    const notes: string[] = [];

    if (!firstBloodClaimed) {
      firstBloodClaimed = true;
      battleBudget = this.clampBudget(battleBudget + 6, input.cap);
      notes.push('FIRST_BLOOD_COUNTERPLAY_GRANT');
    }

    const extractionCount = input.injectedAttacks.filter(
      (attack) => attack.category === 'EXTRACTION',
    ).length;

    if (extractionCount > 0) {
      battleBudget = this.clampBudget(
        battleBudget + Math.min(3, extractionCount),
        input.cap,
      );
      notes.push('EXTRACTION_COUNTERPLAY_GRANT');
    }

    const breachCount = input.injectedAttacks.filter(
      (attack) => attack.category === 'BREACH',
    ).length;

    if (breachCount > 0) {
      battleBudget = this.clampBudget(
        battleBudget + Math.min(2, breachCount),
        input.cap,
      );
      notes.push('BREACH_ESCALATION_GRANT');
    }

    return {
      battleBudget,
      firstBloodClaimed,
      notes,
    };
  }

  public resolveProjectedPressureTax(
    pendingAttacks: readonly AttackEvent[],
  ): number {
    return pendingAttacks.reduce((sum, attack) => {
      if (attack.category === 'EXTRACTION' || attack.category === 'BREACH') {
        return sum + 2;
      }

      if (attack.category === 'LOCK' || attack.category === 'DRAIN') {
        return sum + 1;
      }

      return sum;
    }, 0);
  }
}