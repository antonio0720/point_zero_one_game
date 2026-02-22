/**
 * Failure Mode Classifier service for Point Zero One Digital's financial roguelike game.
 */

import { Event } from "../event";

/**
 * Represents a failure mode in the game.
 */
export enum FailureMode {
  CASHFLOW_COLLAPSE = "cashflow_collapse",
  FORCED_LIQUIDATION = "forced_liquidation",
  CASCADING_DEBT_SERVICE = "cascading_debt_service",
  CREDIT_FREEZE = "credit_freeze"
}

/**
 * Classifies the failure mode from an event stream.
 */
export class FailureModeClassifier {
  private events: Event[];

  constructor(events: Event[]) {
    this.events = events;
  }

  /**
   * Classifies the failure mode based on the provided event stream.
   * @returns The failure mode or null if no failure mode is detected.
   */
  public classify(): FailureMode | null {
    // Implement the logic to classify the failure mode from the event stream.
    // This example assumes that the failure mode can be determined by checking for specific events.
    const cashflowCollapseEvents = this.events.filter(event => event.type === "cashflow_collapse");
    const forcedLiquidationEvents = this.events.filter(event => event.type === "forced_liquidation");
    const cascadingDebtServiceEvents = this.events.filter(event => event.type === "cascading_debt_service");
    const creditFreezeEvents = this.events.filter(event => event.type === "credit_freeze");

    if (!this.events.length) {
      return null;
    }

    if (cashflowCollapseEvents.length > 0) {
      return FailureMode.CASHFLOW_COLLAPSE;
    }

    if (forcedLiquidationEvents.length > 0) {
      return FailureMode.FORCED_LIQUIDATION;
    }

    if (cascadingDebtServiceEvents.length > 0) {
      return FailureMode.CASCADING_DEBT_SERVICE;
    }

    if (creditFreezeEvents.length > 0) {
      return FailureMode.CREDIT_FREEZE;
    }

    throw new Error("Unexpected state: No failure mode detected.");
  }
}
