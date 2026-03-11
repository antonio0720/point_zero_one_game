/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/index.ts
 *
 * Doctrine:
 * - single public export surface for the backend time lane
 * - concrete modules remain split by responsibility; consumers import from here
 * - barrel exports should include contracts first, then implementations
 */

export * from './contracts';

export * from './types';
export * from './SeasonClock';
export * from './TickScheduler';
export * from './TickTierPolicy';
export * from './TickRateInterpolator';
export * from './DecisionTimer';
export * from './TimeEngine';

export * from './TimeEventEmitter';
export * from './DecisionExpiryResolver';
export * from './HoldActionLedger';

export * from './RunTimeoutGuard';
export * from './TimeBudgetService';
export * from './TimeSnapshotProjector';
export * from './TimeTelemetryProjector';