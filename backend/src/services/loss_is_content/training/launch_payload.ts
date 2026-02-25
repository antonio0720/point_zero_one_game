/**
 * Launch payload for training a weakness in the game.
 */
export interface TrainWeaknessPayload {
  scenarioVersion: string;
  receipts: Receipt[];
}

/**
 * Represents a receipt for a transaction in the game.
 */
export interface Receipt {
  id: number;
  timestamp: Date;
  amount: number;
  currency: string;
}

/**
 * Function to create a new train weakness launch payload.
 * @param scenarioVersion - The version of the scenario to be trained.
 * @param receipts - An array of receipts for the transactions made during the game session.
 */
export function createTrainWeaknessPayload(scenarioVersion: string, receipts: Receipt[]): TrainWeaknessPayload {
  return { scenarioVersion, receipts };
}
