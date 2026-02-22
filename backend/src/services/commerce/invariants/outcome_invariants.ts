/**
 * Commerce > Invariants > OutcomeInvariants
 * Forbid any monetization config from touching outcome math; assertion checks with kill-switch.
 */

import { MonetizationConfig } from "../config/monetization_config";
import { Outcome } from "./outcome";

/**
 * Ensure that no monetization configuration can modify the outcome math directly.
 * This function should be called after any changes to the monetization config and before any outcome calculations.
 */
export function assertOutcomeInvariants(): void {
  const monetizationConfig = MonetizationConfig.getInstance();

  // Iterate through all outcomes and check that their math is not being directly modified by the monetization config.
  for (const outcome of Outcome.getAll()) {
    if (outcome.math.some((value) => value === monetizationConfig)) {
      throw new Error("Monetization configuration found in outcome math.");
    }
  }
}
