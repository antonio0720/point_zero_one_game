// shared/contracts/pzo/ghost-run.ts

export interface GhostRunRequest {
  challengerUserId: string;
  targetLegendId: string;
  seed: number;
}

export interface GhostRunRecord {
  runId: string;
  challengerUserId: string;
  targetLegendId: string;
  seed: number;
  status: 'ACTIVE' | 'COMPLETE' | 'ABANDONED';
  startedAt: number;
  completedAt: number | null;
  finalCordScore: number | null;
  finalNetWorth: number | null;
  beaten: boolean;
}

// shared/contracts/pzo/legend-record.ts

export type LegendTier = 'ROOKIE' | 'CONTENDER' | 'CHAMPION' | 'DYNASTY' | 'IMMORTAL';

export interface LegendSnapshot {
  tick: number;
  cash: number;
  netWorth: number;
  income: number;
  shields: number;
  cordScore: number;
  cardPlayed?: string;
}

export interface LegendRecordContract {
  legendId: string;
  userId: string;
  displayName: string;
  runId: string;
  finalCordScore: number;
  finalNetWorth: number;
  finalTick: number;
  seed: number;
  tier: LegendTier;
  currentDecayFactor: number;
  timesBeaten: number;
  dynastyDefenseCount: number;
  snapshots: LegendSnapshot[];
  createdAt: number;
}

// shared/contracts/pzo/gap-indicator.ts

export type GapZone = 'AHEAD' | 'CLOSING' | 'HOLDING' | 'FALLING_BEHIND' | 'CRITICAL';

export interface GapIndicatorPatch {
  runId: string;
  tick: number;
  zone: GapZone;
  netWorthGapPct: number;
  cordGapPct: number;
  pressureIntensity: number;
  nerveEligible: boolean;
}
