Here is the TypeScript file `shared/contracts/telemetry/run_funnel_events.ts` as per your specifications:

```typescript
/**
 * Telemetry contract for tracking game funnels and events
 */

type Run = 'Run1' | 'Run2' | 'Run3';
type Event = 'start' | 'completion' | 'time-to-first-death' | 'survival' | 'guest_account_upgrade';

interface RunEvent {
  run: Run;
  event: Event;
  timestamp: number;
}

/**
 * Interface for the Telemetry contract
 */
export interface TelemetryContract {
  recordRunEvent(run: Run, event: Event, timestamp: number): void;
}
