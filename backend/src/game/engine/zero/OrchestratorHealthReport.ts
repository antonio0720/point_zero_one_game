// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/game/engine/zero/OrchestratorHealthReport.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/OrchestratorHealthReport.ts
 *
 * Doctrine:
 * - health reporting is a distinct operational surface from diagnostics retention
 * - report assembly must be pure and serialization-safe
 */

import type { EngineHealth } from '../core/EngineContracts';
import type {
  OrchestratorHealthReport,
  RunLifecycleState,
  TickExecutionSummary,
  TickStepErrorRecord,
} from './zero.types';

export interface BuildOrchestratorHealthReportArgs {
  readonly lifecycleState: RunLifecycleState;
  readonly runId: string | null;
  readonly userId: string | null;
  readonly seed: string | null;
  readonly currentTick: number | null;
  readonly consecutiveTickErrorCount: number;
  readonly engines: readonly EngineHealth[];
  readonly lastTickSummary: TickExecutionSummary | null;
  readonly lastErrors: readonly TickStepErrorRecord[];
}

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

export function buildOrchestratorHealthReport(
  args: BuildOrchestratorHealthReportArgs,
): OrchestratorHealthReport {
  return Object.freeze({
    lifecycleState: args.lifecycleState,
    runId: args.runId,
    userId: args.userId,
    seed: args.seed,
    currentTick: args.currentTick,
    consecutiveTickErrorCount: Math.max(
      0,
      Math.trunc(args.consecutiveTickErrorCount),
    ),
    engines: freezeArray(args.engines),
    lastTickSummary: args.lastTickSummary,
    lastErrors: freezeArray(args.lastErrors),
  });
}