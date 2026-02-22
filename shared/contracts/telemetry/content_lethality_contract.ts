/**
 * Lethality Contract Interface for Card, Macro Regime, and Scenario Metrics
 */

export interface ContentLethalityContract {
  cardId: string;
  macroRegimeId: string;
  scenarioId: string;
  averageLethality: number;
  standardDeviationLethality: number;
  minLethality: number;
  maxLethality: number;
  totalWipeContribution: number;
}
