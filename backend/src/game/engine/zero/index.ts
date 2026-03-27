// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/game/engine/zero/index.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/index.ts
 *
 * Barrel export:
 * - exposes the live orchestrator surface
 * - exposes lifecycle coordination helpers
 * - exposes zero-owned orchestration contracts and policy defaults
 * - exposes the additive control-tower files that wrap backend/core primitives
 * - does not duplicate backend/core EventBus, TickSequence, or snapshot primitives
 */

export * from './zero.types';
export * from './OrchestratorConfig';
export * from './DependencyBinder';
export * from './TickPlan';
export * from './TickStateLock';
export * from './OutcomeGate';
export * from './EventFlushCoordinator';
export * from './OrchestratorDiagnostics';
export * from './OrchestratorHealthReport';
export * from './TickResultBuilder';
export * from './RunQueryService';
export { EngineOrchestrator } from './EngineOrchestrator';
export * from './RunLifecycleCoordinator';
export * from './ZeroEngine';