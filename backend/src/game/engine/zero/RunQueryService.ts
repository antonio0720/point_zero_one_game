// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/game/engine/zero/RunQueryService.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/RunQueryService.ts
 *
 * Doctrine:
 * - query surfaces are read-only and orchestration-safe
 * - callers should not have to know which object owns which operational detail
 */

import type { EngineHealth } from '../core/EngineContracts';
import type {
  OrchestratorHealthReport,
  OrchestratorStateSnapshot,
  RunLifecycleState,
  TickExecutionSummary,
  TickStepErrorRecord,
} from './zero.types';
import { buildOrchestratorHealthReport } from './OrchestratorHealthReport';

export interface RunQueryProviders {
  readonly getLifecycleState: () => RunLifecycleState;
  readonly getRunId: () => string | null;
  readonly getUserId: () => string | null;
  readonly getSeed: () => string | null;
  readonly getFreedomThreshold: () => number;
  readonly getCurrentTick: () => number | null;
  readonly getConsecutiveTickErrorCount: () => number;
  readonly getCurrentSnapshot: () => OrchestratorStateSnapshot['current'];
  readonly getEngineHealths: () => readonly EngineHealth[];
  readonly getLastTickSummary: () => TickExecutionSummary | null;
  readonly getLastErrors: () => readonly TickStepErrorRecord[];
}

export class RunQueryService {
  public constructor(private readonly providers: RunQueryProviders) {}

  public getStateSnapshot(): OrchestratorStateSnapshot {
    return Object.freeze({
      lifecycleState: this.providers.getLifecycleState(),
      runId: this.providers.getRunId(),
      userId: this.providers.getUserId(),
      seed: this.providers.getSeed(),
      freedomThreshold: this.providers.getFreedomThreshold(),
      consecutiveTickErrorCount:
        this.providers.getConsecutiveTickErrorCount(),
      current: this.providers.getCurrentSnapshot(),
    });
  }

  public getHealthReport(): OrchestratorHealthReport {
    return buildOrchestratorHealthReport({
      lifecycleState: this.providers.getLifecycleState(),
      runId: this.providers.getRunId(),
      userId: this.providers.getUserId(),
      seed: this.providers.getSeed(),
      currentTick: this.providers.getCurrentTick(),
      consecutiveTickErrorCount:
        this.providers.getConsecutiveTickErrorCount(),
      engines: this.providers.getEngineHealths(),
      lastTickSummary: this.providers.getLastTickSummary(),
      lastErrors: this.providers.getLastErrors(),
    });
  }

  public getLastTickSummary(): TickExecutionSummary | null {
    return this.providers.getLastTickSummary();
  }

  public getRecentErrors(): readonly TickStepErrorRecord[] {
    return this.providers.getLastErrors();
  }
}