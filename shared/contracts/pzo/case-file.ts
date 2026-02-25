// shared/contracts/pzo/case-file.ts

export type DecisionTag = 'FAST' | 'LATE' | 'OPTIMAL' | 'RISKY' | 'PANIC' | 'CALCULATED';

export interface CaseFileDecisionBreakdown {
  tag: DecisionTag;
  count: number;
  percentage: number;
  avgQuality: number;
}

export interface CaseFileTurningPoint {
  tick: number;
  type: 'BLEED_ENTRY' | 'BLEED_EXIT' | 'COMEBACK_SURGE' | 'CRITICAL_PLAY' | 'PANIC_PLAY' | 'PEAK_NET_WORTH';
  description: string;
  cashAtMoment: number;
  netWorthAtMoment: number;
}

export interface BleedArc {
  startTick: number;
  endTick: number;
  durationTicks: number;
  peakSeverity: string;
  recoveredFrom: boolean;
}

export interface CaseFileSubmission {
  runId: string;
  userId: string;
  mode: 'EMPIRE';
  seed: number;
  finalTick: number;
  outcome: string;
  finalCash: number;
  finalNetWorth: number;
  finalIncome: number;
  finalExpenses: number;
  peakNetWorth: number;
  lowestCash: number;
  totalDecisions: number;
  decisionBreakdown: CaseFileDecisionBreakdown[];
  aggregateDecisionQuality: number;
  bleedArcs: BleedArc[];
  totalBleedTicks: number;
  bleedModeReactivations: number;
  peakBleedSeverity: string;
  totalIsolationTaxPaid: number;
  taxBurdenRate: number;
  turningPoints: CaseFileTurningPoint[];
  pressureResilienceScore: number;
  decisionQualityScore: number;
  consistencyScore: number;
  proofHash: string;
}

export interface CaseFileRecord extends CaseFileSubmission {
  id: string;
  createdAt: number;
  mlGrade?: string;
  mlInsights?: string[];
}
