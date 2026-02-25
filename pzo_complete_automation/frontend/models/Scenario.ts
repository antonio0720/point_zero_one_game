export type StepType = 'INCOME_CHOICE' | 'EXPENSE_SHOCK' | 'MARKET_EVENT' | 'FORK';

export interface BranchOption {
  id:          string;
  label:       string;
  description: string;
  effectCents: number;
}

export interface ScenarioStep {
  id:            string;
  type:          StepType;
  label:         string;
  description:   string;
  amountCents:   number;
  durationTurns: number;
  branchOptions: BranchOption[];
}

export interface Scenario {
  name:        string;
  description: string;
  steps:       ScenarioStep[];
}
