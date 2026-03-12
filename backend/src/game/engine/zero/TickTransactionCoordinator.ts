// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/game/engine/zero/TickTransactionCoordinator.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/TickTransactionCoordinator.ts
 *
 * Doctrine:
 * - zero does not replace backend/core EngineTickTransaction; it operationalizes it
 * - tick context creation must be deterministic, explicit, and reusable across engine/system steps
 * - engine execution and synthetic orchestration mutations share one normalized transaction surface
 * - every execution path returns immutable snapshot + signal output, never partial mutation state
 */

import type { ClockSource } from '../core/ClockSource';
import {
  createEngineSignal,
  normalizeEngineTickResult,
  type EngineHealth,
  type EngineId,
  type EngineSignal,
  type EngineTickResult,
  type SimulationEngine,
  type TickContext,
  type TickTrace,
} from '../core/EngineContracts';
import { cloneJson, deepFreeze } from '../core/Deterministic';
import { EventBus, type EventEnvelope } from '../core/EventBus';
import type { EngineEventMap } from '../core/GamePrimitives';
import { EngineTickTransaction } from '../core/EngineTickTransaction';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type { TickStep } from '../core/TickSequence';

export type RuntimeBus = EventBus<EngineEventMap & Record<string, unknown>>;
export type RuntimeEnvelope = EventEnvelope<
  keyof (EngineEventMap & Record<string, unknown>),
  (EngineEventMap & Record<string, unknown>)[keyof (EngineEventMap & Record<string, unknown>)]
>;

export interface StepTraceSeed {
  readonly traceId?: string;
  readonly tick?: number;
  readonly tags?: readonly string[];
}

export interface TransactionContextArgs {
  readonly snapshot: RunStateSnapshot;
  readonly step: TickStep;
  readonly nowMs: number;
  readonly clock: ClockSource;
  readonly bus: RuntimeBus;
  readonly trace?: StepTraceSeed;
}

export interface EngineTransactionExecutionArgs extends TransactionContextArgs {
  readonly engine: SimulationEngine;
}

export interface SyntheticTransactionExecutionArgs extends TransactionContextArgs {
  readonly owner: EngineId | 'mode' | 'system';
  readonly label: string;
  readonly reducer: (
    snapshot: RunStateSnapshot,
    context: TickContext,
  ) => RunStateSnapshot | EngineTickResult;
}

export interface TransactionExecutionResult {
  readonly context: TickContext;
  readonly snapshot: RunStateSnapshot;
  readonly signals: readonly EngineSignal[];
  readonly healthBefore?: EngineHealth;
  readonly healthAfter?: EngineHealth;
  readonly rolledBack: boolean;
  readonly skipped: boolean;
}

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function normalizeTickForTrace(
  snapshot: RunStateSnapshot,
  explicitTick: number | undefined,
): number {
  if (explicitTick !== undefined && Number.isFinite(explicitTick)) {
    return Math.max(0, Math.trunc(explicitTick));
  }

  return Math.max(0, Math.trunc(snapshot.tick + 1));
}

function buildTrace(args: TransactionContextArgs): TickTrace {
  const tick = normalizeTickForTrace(args.snapshot, args.trace?.tick);
  const traceId =
    args.trace?.traceId ??
    [
      'zero-trace',
      args.snapshot.runId,
      args.step,
      String(tick),
      String(Math.max(0, Math.trunc(args.nowMs))),
    ].join(':');

  return Object.freeze({
    runId: args.snapshot.runId,
    tick,
    step: args.step,
    mode: args.snapshot.mode,
    phase: args.snapshot.phase,
    traceId,
  });
}

function toFrozenSnapshot(snapshot: RunStateSnapshot | EngineTickResult): RunStateSnapshot {
  const normalized = 'snapshot' in snapshot ? snapshot.snapshot : snapshot;
  return deepFreeze(cloneJson(normalized)) as RunStateSnapshot;
}

export class TickTransactionCoordinator {
  public createContext(args: TransactionContextArgs): TickContext {
    return Object.freeze({
      step: args.step,
      nowMs: Math.max(0, Math.trunc(args.nowMs)),
      clock: args.clock,
      bus: args.bus,
      trace: buildTrace(args),
    });
  }

  public executeEngine(
    args: EngineTransactionExecutionArgs,
  ): TransactionExecutionResult {
    const context = this.createContext(args);
    const healthBefore = args.engine.getHealth();

    try {
      const result = EngineTickTransaction.execute(
        args.engine,
        args.snapshot,
        context,
      );
      const healthAfter = args.engine.getHealth();

      return Object.freeze({
        context,
        snapshot: toFrozenSnapshot(result),
        signals: freezeArray(result.signals ?? []),
        healthBefore,
        healthAfter,
        rolledBack:
          (result.signals ?? []).some(
            (signal) =>
              signal.code === 'ENGINE_TRANSACTION_ROLLBACK' ||
              signal.tags?.includes('rollback') === true,
          ),
        skipped:
          (result.signals ?? []).some(
            (signal) => signal.code === 'ENGINE_SKIPPED',
          ),
      });
    } catch (error) {
      const rollback = Object.freeze({
        snapshot: args.snapshot,
        signals: freezeArray([
          createEngineSignal(
            args.engine.engineId,
            'ERROR',
            'ZERO_TRANSACTION_COORDINATOR_ABORT',
            error instanceof Error
              ? `[${args.engine.engineId}] ${args.step} aborted in coordinator: ${error.message}`
              : `[${args.engine.engineId}] ${args.step} aborted in coordinator.`,
            context.trace.tick,
            freezeArray([
              'zero',
              'transaction-coordinator',
              'rollback',
              `step:${args.step.toLowerCase()}`,
            ]),
          ),
        ]),
      });

      return Object.freeze({
        context,
        snapshot: rollback.snapshot,
        signals: rollback.signals,
        healthBefore,
        healthAfter: args.engine.getHealth(),
        rolledBack: true,
        skipped: false,
      });
    }
  }

  public executeSynthetic(
    args: SyntheticTransactionExecutionArgs,
  ): TransactionExecutionResult {
    const context = this.createContext(args);

    try {
      const raw = args.reducer(args.snapshot, context);
      const normalized = normalizeEngineTickResult(
        args.owner === 'system' ? 'time' : (args.owner as EngineId),
        context.trace.tick,
        raw,
      );

      const baseSignals =
        normalized.signals && normalized.signals.length > 0
          ? normalized.signals
          : freezeArray([
              createEngineSignal(
                args.owner,
                'INFO',
                'ZERO_SYNTHETIC_STEP_APPLIED',
                `${args.label} applied at ${args.step}.`,
                context.trace.tick,
                freezeArray([
                  'zero',
                  'synthetic-step',
                  `step:${args.step.toLowerCase()}`,
                ]),
              ),
            ]);

      return Object.freeze({
        context,
        snapshot: toFrozenSnapshot(normalized),
        signals: freezeArray(baseSignals),
        rolledBack: false,
        skipped: false,
      });
    } catch (error) {
      return Object.freeze({
        context,
        snapshot: args.snapshot,
        signals: freezeArray([
          createEngineSignal(
            args.owner,
            'ERROR',
            'ZERO_SYNTHETIC_STEP_ABORT',
            error instanceof Error
              ? `[${args.owner}] ${args.label} failed: ${error.message}`
              : `[${args.owner}] ${args.label} failed.`,
            context.trace.tick,
            freezeArray([
              'zero',
              'synthetic-step',
              'rollback',
              `step:${args.step.toLowerCase()}`,
            ]),
          ),
        ]),
        rolledBack: true,
        skipped: false,
      });
    }
  }
}