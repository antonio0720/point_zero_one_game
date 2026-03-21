/**
 * Economy Sink Contract
 */

declare module '*.json' {
  const value: any;
  export default value;
}

export interface Season {
  id: number;
  startDate: Date;
  endDate: Date;
}

export interface EarningPressureSignal {
  seasonId: number;
  pressureLevel: number;
  timestamp: Date;
}

export interface SeasonSink {
  seasonId: number;
  earnedRewards: number;
  storedRewards: number;
  inflationWarningMarkers: number[];
}

export function storeConversion(earnedRewards: number, storedRewards: number): void {
  // Implement conversion logic here
}

export function rewardInflationWarningMarker(inflationWarningMarker: number): void {
  // Implement inflation warning marker logic here
}
