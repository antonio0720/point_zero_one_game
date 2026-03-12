// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/game/engine/zero/TickResultBuilder.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/TickResultBuilder.ts
 *
 * Doctrine:
 * - tick summary assembly must be explicit, deterministic, and bounded
 * - zero aggregates step reports, warnings, signals, and snapshots into one immutable result
 */

import type { EngineSignal } from '../core/EngineContracts';
import type { RunOutcome } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type {
  StepExecutionReport,
  TickExecutionSummary,
} from './zero.types';

export interface BuildTickExecutionSummaryArgs {
  readonly runId: string;
  readonly tick: number;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly preTickSnapshot: RunStateSnapshot;
  readonly postTickSnapshot: RunStateSnapshot;
  readonly steps: readonly StepExecutionReport[];
  readonly outcome: RunOutcome | null;
  readonly warnings?: readonly string[];
  readonly signals?: readonly EngineSignal[];
  readonly eventSequences?: readonly number[];
}

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

export function buildTickExecutionSummary(
  args: BuildTickExecutionSummaryArgs,
): TickExecutionSummary {
  return Object.freeze({
    runId: args.runId,
    tick: Math.max(0, Math.trunc(args.tick)),
    startedAtMs: Math.max(0, Math.trunc(args.startedAtMs)),
    endedAtMs: Math.max(0, Math.trunc(args.endedAtMs)),
    durationMs: Math.max(0, Math.trunc(args.endedAtMs - args.startedAtMs)),
    stepCount: args.steps.length,
    steps: freezeArray(args.steps),
    preTickSnapshot: args.preTickSnapshot,
    postTickSnapshot: args.postTickSnapshot,
    outcome: args.outcome,
    eventCount: args.eventSequences?.length ?? 0,
    eventSequences: freezeArray(args.eventSequences ?? []),
    warnings: freezeArray(args.warnings ?? []),
    signals: freezeArray(args.signals ?? []),
  });
}