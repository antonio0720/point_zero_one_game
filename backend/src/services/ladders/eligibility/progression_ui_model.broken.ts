/**
 * ProgressionUIModel service for converting eligibility results into a UI-friendly progress checklist.
 */

import { EligibilityResult } from "../eligibility/eligibility_result";

/**
 * Represents an item in the progress checklist.
 */
export interface ProgressItem {
  /** The name of the item. */
  name: string;

  /** The number of items needed to complete this step. */
  quantity: number;

  /** The number of items currently possessed. */
  ownedQuantity: number;
}

/**
 * Represents a progress checklist for the UI.
 */
export interface ProgressChecklist {
  /** An array of progress items. */
  items: ProgressItem[];

  /** The next steps to take after completing all current items. */
  nextSteps: string[];
}

/**
 * Converts an eligibility result into a UI-friendly progress checklist.
 * @param eligibilityResult The eligibility result to convert.
 * @returns A progress checklist containing the missing items and next steps.
 */
export function getProgressChecklist(eligibilityResult: EligibilityResult): ProgressChecklist {
  const progressItems: ProgressItem[] = [];
  const nextSteps: string[] = [];

  // Iterate through each eligibility requirement and calculate the missing items and next steps.
  for (const [requirementName, requirement] of Object.entries(eligibilityResult)) {
    if (!requirement.isComplete) {
      const missingQuantity = requirement.quantity - requirement.ownedQuantity;
      progressItems.push({ name: requirementName, quantity: requirement.quantity, ownedQuantity: requirement.ownedQuantity });

      // If there are no more items to acquire for this requirement, add the next step.
      if (missingQuantity === 0) {
        nextSteps.push(`Complete ${requirementName}`);
      }
    }
  }

  return { items: progressItems, nextSteps };
}
