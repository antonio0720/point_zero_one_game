/**
 * FILE: pzo-web/src/engines/cascade/RecoveryConditionChecker.ts
 *
 * Evaluates all 7 recovery condition types against the RecoveryActionLog
 * and current run state. Called per-link during CascadeQueueManager.processTickLinks().
 *
 * Rules:
 *   ✦ Recovery scanning is RETROACTIVE — scans from instance.triggeredAtTick to currentTick.
 *   ✦ Reads ShieldReader interface only. Never imports ShieldEngine class.
 *   ✦ Zero mutation of game state — pure evaluation only.
 *   ✦ COMPOUND_AND uses every() — ALL sub-conditions must pass.
 *   ✦ COMPOUND_OR uses some()  — ANY sub-condition passing is sufficient.
 *
 * Density6 LLC · Point Zero One · Engine 6 of 7 · Confidential
 */
import {
  CascadeChainInstance,
  RecoveryCondition,
  RecoveryType,
  RecoveryActionLog,
} from './types';
import type { ShieldReader } from '../shield/types';

export class RecoveryConditionChecker {
  constructor(private readonly shieldReader: ShieldReader) {}

  /**
   * Returns true if ANY recovery condition in the chain definition is satisfied.
   * Recovery is checked at the moment a due link is about to fire.
   * The scanner looks back to instance.triggeredAtTick — not just the current tick.
   */
  public isRecovered(
    instance:    CascadeChainInstance,
    currentTick: number,
    log:         RecoveryActionLog,
    runState:    any
  ): boolean {
    for (const condition of instance.chainDef.recoveryConditions) {
      if (this.evalCondition(condition, instance.triggeredAtTick, currentTick, log, runState)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Recursively evaluates a single RecoveryCondition.
   * @param since  — the tick from which to start scanning (instance.triggeredAtTick)
   * @param now    — the current tick being processed
   */
  private evalCondition(
    condition: RecoveryCondition,
    since:     number,
    now:       number,
    log:       RecoveryActionLog,
    runState:  any
  ): boolean {
    switch (condition.type) {

      case RecoveryType.CARD_PLAYED_TYPE: {
        // Scan every tick from trigger to now (inclusive) for the required card type
        for (let t = since; t <= now; t++) {
          const played = log.cardTypesPlayedSinceMap.get(t) ?? [];
          if (played.includes(condition.cardType!)) return true;
        }
        return false;
      }

      case RecoveryType.BUDGET_ACTION_USED: {
        // Scan every tick from trigger to now (inclusive) for the required budget action
        for (let t = since; t <= now; t++) {
          const actions = log.budgetActionsUsedSinceMap.get(t) ?? [];
          if (actions.includes(condition.budgetActionType!)) return true;
        }
        return false;
      }

      case RecoveryType.SHIELD_LAYER_ABOVE_PCT: {
        // Point-in-time check — evaluated at the moment the link is due, not retroactively
        const layer = this.shieldReader.getLayerState(condition.layerId!);
        return layer.integrityPct >= (condition.abovePct ?? 0.5);
      }

      case RecoveryType.CASHFLOW_POSITIVE_N: {
        // Sustained condition — requires N consecutive positive-flow ticks
        return log.consecutivePositiveFlowTicks >= (condition.consecutiveTicks ?? 3);
      }

      case RecoveryType.ALLIANCE_ACTIVE: {
        // Social condition — requires an active syndicate ally with positive cashflow
        return runState?.hasActiveAllianceMember === true;
      }

      case RecoveryType.COMPOUND_AND: {
        // ALL sub-conditions must be satisfied — uses every()
        const subs = condition.sub ?? [];
        return subs.every(sub => this.evalCondition(sub, since, now, log, runState));
      }

      case RecoveryType.COMPOUND_OR: {
        // ANY sub-condition satisfies — uses some()
        const subs = condition.sub ?? [];
        return subs.some(sub => this.evalCondition(sub, since, now, log, runState));
      }

      default:
        return false;
    }
  }

  // No mutable state — reset is a no-op but included for symmetry with other components
  public reset(): void {}
}