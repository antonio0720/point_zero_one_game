// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/game/engine/zero/TickStepRunner.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/TickStepRunner.ts
 *
 * Doctrine:
 * - one step in, one normalized report out
 * - step running must preserve backend/core tick law, not reinterpret it
 * - engine steps, synthetic steps, and finalization steps share one reporting format
 * - zero may enrich reports, but must not hide skipped, rolled-back, or degraded execution
 */

import type {
  EngineId,
  EngineSignal,
  SimulationEngine,
  TickContext,
} from '../core/EngineContracts';
import { createEngineSignal } from '../core/EngineContracts';
import { cloneJson, deepFreeze } from '../core/Deterministic';
import { EventBus } from '../core/EventBus';
import type { EngineEventMap } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import {
  getTickStepDescriptor,
  isEngineExecutionStep,
  type TickStep,
  type TickStepDescriptor,
} from '../core/TickSequence';
import {
  TickTransactionCoordinator,
  type RuntimeBus,
  type TransactionExecutionResult,
} from './TickTransactionCoordinator';

export interface StepHandlerResult {
  readonly snapshot: RunStateSnapshot;
  readonly signals?: readonly EngineSignal[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type StepHandler = (
  snapshot: RunStateSnapshot,
  context: TickContext,
) => RunStateSnapshot | StepHandlerResult;

export interface TickStepRunnerHandlers {
  readonly STEP_01_PREPARE?: StepHandler;
  readonly STEP_08_MODE_POST?: StepHandler;
  readonly STEP_09_TELEMETRY?: StepHandler;
  readonly STEP_10_SOVEREIGNTY_SNAPSHOT?: StepHandler;
  readonly STEP_11_OUTCOME_GATE?: StepHandler;
  readonly STEP_12_EVENT_SEAL?: StepHandler;
  readonly STEP_13_FLUSH?: StepHandler;
}

export interface TickStepRunnerArgs {
  readonly snapshot: RunStateSnapshot;
  readonly step: TickStep;
  readonly nowMs: number;
  readonly traceId?: string;
}

export interface StepExecutionReport {
  readonly step: TickStep;
  readonly descriptor: TickStepDescriptor;
  readonly engineId: EngineId | 'mode' | 'system' | null;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly durationMs: number;
  readonly inputSnapshot: RunStateSnapshot;
  readonly outputSnapshot: RunStateSnapshot;
  readonly signals: readonly EngineSignal[];
  readonly skipped: boolean;
  readonly rolledBack: boolean;
  readonly metadata: Readonly<Record<string, unknown>> | null;
}

type StepToEngineMap = Partial<Record<TickStep, EngineId>>;

const STEP_TO_ENGINE: StepToEngineMap = Object.freeze({
  STEP_02_TIME: 'time',
  STEP_03_PRESSURE: 'pressure',
  STEP_04_TENSION: 'tension',
  STEP_05_BATTLE: 'battle',
  STEP_06_SHIELD: 'shield',
  STEP_07_CASCADE: 'cascade',
});

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function toFrozenSnapshot(snapshot: RunStateSnapshot): RunStateSnapshot {
  return deepFreeze(cloneJson(snapshot)) as RunStateSnapshot;
}

function defaultSystemSignal(
  step: TickStep,
  tick: number,
  code: string,
  message: string,
): EngineSignal {
  return createEngineSignal(
    'mode',
    'INFO',
    code,
    message,
    tick,
    freezeArray(['zero', `step:${step.toLowerCase()}`]),
  );
}

export class TickStepRunner {
  private readonly bus: RuntimeBus;
  private readonly clock: TickTransactionCoordinator extends infer _X ? never : never;

  public constructor(
    private readonly options: {
      readonly bus: EventBus<EngineEventMap & Record<string, unknown>>;
      readonly clock: Parameters<TickTransactionCoordinator['createContext']>[0]['clock'];
      readonly transactionCoordinator: TickTransactionCoordinator;
      readonly engines: Partial<Record<EngineId, SimulationEngine>>;
      readonly handlers?: TickStepRunnerHandlers;
    },
  ) {
    this.bus = options.bus;
    this.clock = undefined as never;
  }

  public run(args: TickStepRunnerArgs): StepExecutionReport {
    const descriptor = getTickStepDescriptor(args.step);
    const startedAtMs = Math.max(0, Math.trunc(args.nowMs));
    const inputSnapshot = toFrozenSnapshot(args.snapshot);

    const execution = isEngineExecutionStep(args.step)
      ? this.runEngineStep(args)
      : this.runSyntheticStep(args);

    const endedAtMs = Math.max(startedAtMs, execution.context.nowMs);

    return Object.freeze({
      step: args.step,
      descriptor,
      engineId: this.resolveOwner(args.step),
      startedAtMs,
      endedAtMs,
      durationMs: Math.max(0, endedAtMs - startedAtMs),
      inputSnapshot,
      outputSnapshot: execution.snapshot,
      signals: freezeArray(execution.signals),
      skipped: execution.skipped,
      rolledBack: execution.rolledBack,
      metadata: this.buildMetadata(execution),
    });
  }

  private runEngineStep(args: TickStepRunnerArgs): TransactionExecutionResult {
    const engineId = STEP_TO_ENGINE[args.step];

    if (engineId === undefined) {
      return this.options.transactionCoordinator.executeSynthetic({
        snapshot: args.snapshot,
        step: args.step,
        nowMs: args.nowMs,
        clock: this.options.clock,
        bus: this.bus,
        trace: { traceId: args.traceId },
        owner: 'system',
        label: 'Unmapped engine step noop',
        reducer: (snapshot, context) => ({
          snapshot,
          signals: freezeArray([
            defaultSystemSignal(
              args.step,
              context.trace.tick,
              'ZERO_UNMAPPED_ENGINE_STEP',
              `${args.step} is not mapped to a backend engine in zero.`,
            ),
          ]),
        }),
      });
    }

    const engine = this.options.engines[engineId];

    if (engine === undefined) {
      return this.options.transactionCoordinator.executeSynthetic({
        snapshot: args.snapshot,
        step: args.step,
        nowMs: args.nowMs,
        clock: this.options.clock,
        bus: this.bus,
        trace: { traceId: args.traceId },
        owner: engineId,
        label: 'Missing engine noop',
        reducer: (snapshot, context) => ({
          snapshot,
          signals: freezeArray([
            createEngineSignal(
              engineId,
              'WARN',
              'ZERO_ENGINE_NOT_BOUND',
              `No engine instance is bound for ${args.step}.`,
              context.trace.tick,
              freezeArray(['zero', 'missing-engine', `step:${args.step.toLowerCase()}`]),
            ),
          ]),
        }),
      });
    }

    return this.options.transactionCoordinator.executeEngine({
      snapshot: args.snapshot,
      step: args.step,
      nowMs: args.nowMs,
      clock: this.options.clock,
      bus: this.bus,
      trace: { traceId: args.traceId },
      engine,
    });
  }

  private runSyntheticStep(args: TickStepRunnerArgs): TransactionExecutionResult {
    const handler = this.options.handlers?.[args.step];

    if (handler === undefined) {
      return this.options.transactionCoordinator.executeSynthetic({
        snapshot: args.snapshot,
        step: args.step,
        nowMs: args.nowMs,
        clock: this.options.clock,
        bus: this.bus,
        trace: { traceId: args.traceId },
        owner: 'system',
        label: 'Default synthetic noop',
        reducer: (snapshot, context) => ({
          snapshot,
          signals: freezeArray([
            defaultSystemSignal(
              args.step,
              context.trace.tick,
              'ZERO_SYNTHETIC_NOOP',
              `${args.step} completed with no synthetic handler bound.`,
            ),
          ]),
        }),
      });
    }

    return this.options.transactionCoordinator.executeSynthetic({
      snapshot: args.snapshot,
      step: args.step,
      nowMs: args.nowMs,
      clock: this.options.clock,
      bus: this.bus,
      trace: { traceId: args.traceId },
      owner:
        args.step === 'STEP_08_MODE_POST' ? 'mode' : 'system',
      label: `Synthetic handler for ${args.step}`,
      reducer: handler,
    });
  }

  private resolveOwner(step: TickStep): EngineId | 'mode' | 'system' | null {
    if (step === 'STEP_08_MODE_POST') {
      return 'mode';
    }

    if (isEngineExecutionStep(step)) {
      return STEP_TO_ENGINE[step] ?? null;
    }

    return 'system';
  }

  private buildMetadata(
    execution: TransactionExecutionResult,
  ): Readonly<Record<string, unknown>> | null {
    const healthBefore = execution.healthBefore;
    const healthAfter = execution.healthAfter;

    if (healthBefore === undefined && healthAfter === undefined) {
      return null;
    }

    return Object.freeze({
      healthBefore,
      healthAfter,
      traceId: execution.context.trace.traceId,
    });
  }
}