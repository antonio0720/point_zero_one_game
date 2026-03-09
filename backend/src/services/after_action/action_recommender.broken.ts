/**
 * Action Recommender Service for Point Zero One Digital's financial roguelike game.
 */

import { FailureMode } from '../models/failure_mode';
import { TinyAction, MediumAction } from '../models/actions';
import { ProfileType } from '../models/profile';

/**
 * Map failure mode to a pair of one tiny action and one medium action.
 * Personalized by profile type but never prescriptive with guarantees.
 */
export function recommendActions(failureMode: FailureMode, profileType: ProfileType): { tinyAction: TinyAction; mediumAction: MediumAction } {
  // Implement the logic to map failure mode and profile type to a pair of actions.
  // This is just a placeholder for actual implementation.
  const curatedLibrary = {
    // Example library with predefined mappings.
    [FailureMode.LiquidityCrisis]: {
      [ProfileType.Aggressive]: { tinyAction: TinyAction.SellStocks, mediumAction: MediumAction.BorrowFunds },
      [ProfileType.Conservative]: { tinyAction: TinyAction.ReduceExpenses, mediumAction: MediumAction.SellRealEstate },
    },
  };

  return curatedLibrary[failureMode][profileType] || { tinyAction: TinyAction.Unknown, mediumAction: MediumAction.Unknown };
}
