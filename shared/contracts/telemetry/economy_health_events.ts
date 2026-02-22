/**
 * Economy Health Events Contract
 */

export interface IncomeEvent {
  id: number;
  playerId: number;
  eventType: EventType;
  amount: number;
  timestamp: Date;
}

export interface ExpenseEvent {
  id: number;
  playerId: number;
  eventType: EventType;
  amount: number;
  target: string; // Target can be 'resource', 'building' or 'research'
  targetId: number;
  timestamp: Date;
}

export interface SinkEvent {
  id: number;
  playerId: number;
  eventType: EventType;
  amount: number;
  reason: string; // Reason can be 'tax', 'maintenance' or 'depreciation'
  timestamp: Date;
}

export enum EventType {
  Earn = 'earn',
  Spend = 'spend',
  Sink = 'sink'
}

export interface InflationIndicator {
  id: number;
  playerId: number;
  periodStart: Date;
  periodEnd: Date;
  averageIncome: number;
  averageExpenses: number;
  inflationRate: number;
}

export interface StarvationIndicator {
  id: number;
  playerId: number;
  timestamp: Date;
  resources: Record<string, number>; // Resources can be 'food', 'metal', 'energy' or 'knowledge'
  survivalDuration: number;
}

export interface ProgressionStallSignal {
  id: number;
  playerId: number;
  timestamp: Date;
  reason: string; // Reason can be 'resource_shortage', 'building_limit', 'research_block' or 'event_lockout'
}

export function isIncomeEvent(event: IncomeEvent | ExpenseEvent | SinkEvent): event is IncomeEvent {
  return (event as IncomeEvent).eventType === EventType.Earn;
}

export function isExpenseEvent(event: IncomeEvent | ExpenseEvent | SinkEvent): event is ExpenseEvent {
  return (event as ExpenseEvent).eventType === EventType.Spend || (event as ExpenseEvent).eventType === EventType.Sink;
}

export function isSinkEvent(event: IncomeEvent | ExpenseEvent | SinkEvent): event is SinkEvent {
  return (event as SinkEvent).eventType === EventType.Sink;
}
