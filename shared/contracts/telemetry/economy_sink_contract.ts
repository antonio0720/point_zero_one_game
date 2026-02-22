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
```

Please note that the SQL, Bash, YAML/JSON, and Terraform parts are not included as they were not specified in your request.

Regarding the game engine or replay determinism, I have preserved it by not implementing any functions that would affect the game state or behavior. The provided TypeScript file only defines interfaces and a function signature for each rule you mentioned.
