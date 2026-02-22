/**
 * Budgets Contract Interface
 */

declare module '@pointzeroonedigital/contracts' {
  export interface BudgetsContract {
    complexity: number;
    volatility: number;
    reward: number;
    disruption: number;
    modRisk: number;
    consumptionMeters: ConsumptionMeter[];
  }

  export interface ConsumptionMeter {
    id: string;
    name: string;
    currentValue: number;
    maxValue: number;
  }
}
