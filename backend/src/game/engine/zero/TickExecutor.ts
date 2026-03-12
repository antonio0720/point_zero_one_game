// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/game/engine/zero/TickExecutor.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/TickExecutor.ts
 *
 * Doctrine:
 * - TickExecutor owns the full 13-step orchestration pass for one authoritative backend tick
 * - it respects backend/core TickSequence ordering rather than inventing a parallel plan
 * - outcome gating, sealing, diagnostics, and flush coordination are explicit terminal phases
 * - all outputs are immutable and suitable for replay, proof, diagnostics, and testing
 */

import { cloneJson, deepFreeze } from '../core/Deterministic';
import type { EngineSignal } from '../core/EngineContracts';
import type { RunOutcome } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type { TickStep } from '../core/TickSequence';
import { EventFlushCoordinator } from './EventFlushCoordinator';
import { OrchestratorDiagnostics } from './OrchestratorDiagnostics';
import { OutcomeGate } from './OutcomeGate';
import { TickPlan } from './TickPlan';
import { buildTickExecutionSummary } from './TickResultBuilder';
import {
  TickStepRunner,
  type StepExecutionReport,
} from './TickStepRunner';

export interface TickExecutorRunArgs {
  readonly snapshot: RunStateSnapshot;
  readonly traceId?: string;
  readonly startedAtMs?: number;
}

export interface TickExecutorRunResult {
  readonly snapshot: RunStateSnapshot;
  readonly outcome: RunOutcome | null;
  readonly reports: readonly StepExecutionReport[];
  readonly signals: readonly EngineSignal[];
  readonly drainedEventSequences: readonly number[];
  readonly eventChecksum: string | null;
}

const OUTCOME_GATE_STEP: TickStep = 'STEP_11_OUTCOME_GATE';
const FLUSH_STEP: TickStep = 'STEP_13_FLUSH';

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function toFrozenSnapshot(snapshot: RunStateSnapshot): RunStateSnapshot {
  return deepFreeze(cloneJson(snapshot)) as RunStateSnapshot;
}

function applyOutcomeDecision(
  snapshot: RunStateSnapshot,
  decision: ReturnType<OutcomeGate['resolve']>,
): RunStateSnapshot {
  if (decision.nextOutcome === snapshot.outcome) {
    return snapshot;
  }

  const next = cloneJson(snapshot) as RunStateSnapshot & {
    outcome: RunStateSnapshot['outcome'];
    telemetry: {
      outcomeReason: string | null;
      outcomeReasonCode: RunStateSnapshot['telemetry']['outcomeReasonCode'];
    };
    tags: string[];
  };

  next.outcome = decision.nextOutcome;
  next.telemetry.outcomeReason =
    decision.reason === 'TARGET_REACHED'
      ? 'economy.freedom_target_reached'
      : decision.reason === 'NET_WORTH_COLLAPSE'
        ? 'economy.cash_below_zero'
        : decision.reason === 'SEASON_TIMEOUT'
          ? 'timer.expired'
          : next.telemetry.outcomeReason;
  next.telemetry.outcomeReasonCode =
    decision.reason === 'TARGET_REACHED'
      ? 'TARGET_REACHED'
      : decision.reason === 'NET_WORTH_COLLAPSE'
        ? 'NET_WORTH_COLLAPSE'
        : decision.reason === 'SEASON_TIMEOUT'
          ? 'SEASON_BUDGET_EXHAUSTED'
          : next.telemetry.outcomeReasonCode;

  if (decision.nextOutcome !== null && !next.tags.includes('run:terminal')) {
    next.tags = [...next.tags, 'run:terminal'];
  }

  return toFrozenSnapshot(next);
}

function collectSignals(
  reports: readonly StepExecutionReport[],
): readonly EngineSignal[] {
  return freezeArray(reports.flatMap((report) => report.signals));
}

export class TickExecutor {
  public constructor(
    private readonly options: {
      readonly tickPlan: TickPlan;
      readonly stepRunner: TickStepRunner;
      readonly outcomeGate: OutcomeGate;
      readonly flushCoordinator?: EventFlushCoordinator;
      readonly diagnostics?: OrchestratorDiagnostics;
    },
  ) {}

  public execute(args: TickExecutorRunArgs): TickExecutorRunResult {
    const startedAtMs =
      args.startedAtMs !== undefined
        ? Math.max(0, Math.trunc(args.startedAtMs))
        : Date.now();

    const preTickSnapshot = toFrozenSnapshot(args.snapshot);
    let current = preTickSnapshot;
    const reports: StepExecutionReport[] = [];
    let drainedEventSequences: readonly number[] = freezeArray([]);
    let eventChecksum: string | null = null;

    for (const entry of this.options.tickPlan.enabledEntries()) {
      const currentStep: TickStep = entry.step;

      const report = this.options.stepRunner.run({
        snapshot: current,
        step: currentStep,
        nowMs: Date.now(),
        traceId: args.traceId,
      });

      current = report.outputSnapshot;

      if (currentStep === OUTCOME_GATE_STEP) {
        current = applyOutcomeDecision(
          current,
          this.options.outcomeGate.resolve(current),
        );

        reports.push(
          Object.freeze({
            ...report,
            outputSnapshot: current,
          }),
        );
      } else if (
        currentStep === FLUSH_STEP &&
        this.options.flushCoordinator !== undefined
      ) {
        const { drained, seal } = this.options.flushCoordinator.flushAndSeal(
          report.outputSnapshot === current
            ? (report.metadata?.bus as never)
            : (report.metadata?.bus as never),
        );

        drainedEventSequences = freezeArray(
          drained.map((event) => event.sequence),
        );
        eventChecksum = seal.checksum;

        reports.push(
          Object.freeze({
            ...report,
            metadata: Object.freeze({
              ...(report.metadata ?? {}),
              drainedEventSequences,
              eventChecksum,
            }),
          }),
        );
      } else {
        reports.push(report);
      }
    }

    const endedAtMs = Date.now();
    const summary = buildTickExecutionSummary({
      runId: current.runId,
      tick: current.tick,
      startedAtMs,
      endedAtMs,
      preTickSnapshot,
      postTickSnapshot: current,
      steps: reports,
      outcome: current.outcome,
      warnings: reports.flatMap((report) =>
        report.signals
          .filter(
            (signal) =>
              signal.severity === 'WARN' || signal.severity === 'ERROR',
          )
          .map(
            (signal) => `[${signal.engineId}] ${signal.code}: ${signal.message}`,
          ),
      ),
      signals: collectSignals(reports),
      eventSequences: drainedEventSequences,
    });

    this.options.diagnostics?.recordTickSummary(summary);

    for (const report of reports) {
      if (report.rolledBack) {
        this.options.diagnostics?.recordError(
          Object.freeze({
            step: report.step,
            engineId:
              report.engineId === 'system' || report.engineId === 'mode'
                ? null
                : report.engineId,
            tick: report.outputSnapshot.tick,
            occurredAtMs: report.endedAtMs,
            message:
              report.signals.find((signal) => signal.severity === 'ERROR')
                ?.message ?? `${report.step} rolled back.`,
          }),
        );
      }
    }

    return Object.freeze({
      snapshot: current,
      outcome: current.outcome,
      reports: freezeArray(reports),
      signals: collectSignals(reports),
      drainedEventSequences,
      eventChecksum,
    });
  }
}