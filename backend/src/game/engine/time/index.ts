/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/index.ts
 *
 * Doctrine:
 * - single public export surface for the backend time lane
 * - concrete modules remain split by responsibility; consumers import from here
 * - barrel exports must avoid duplicate symbol collisions across split modules
 */

export * from './contracts';

export * from './types';

export {
  SeasonClock,
} from './SeasonClock';

export type {
  SeasonLifecycleState,
  SeasonTimelineManifest,
  SeasonPressureContext,
  SeasonClockSnapshot,
} from './SeasonClock';

export * from './TickScheduler';
export * from './TickTierPolicy';
export * from './TickRateInterpolator';
export * from './DecisionTimer';
export * from './TimeEngine';

export * from './TimeEventEmitter';

export {
  DecisionExpiryResolver,
} from './DecisionExpiryResolver';

export type {
  DecisionWindowRegistration,
  DecisionOptionDescriptor,
  RegisteredDecisionWindow,
  ExpiredDecisionOutcome,
  DecisionExpiryBatchResult,
} from './DecisionExpiryResolver';

export * from './HoldActionLedger';
export * from './RunTimeoutGuard';
export * from './TimeBudgetService';
export * from './TimeSnapshotProjector';
export * from './TimeTelemetryProjector';