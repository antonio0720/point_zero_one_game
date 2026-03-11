/* 
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/EngineTickTransaction.ts
 *
 * Doctrine:
 * - each engine tick is an immutable-in / immutable-out transaction boundary
 * - engine failures must not partially mutate authoritative snapshot truth
 * - signal aggregation must remain deterministic and replay-safe
 * - transaction helpers must compose with the existing SimulationEngine contract
 * - skip / rollback / commit outcomes must be explicit and queryable
 */

import {
  createEngineSignal,
  normalizeEngineTickResult,
  type EngineId,
  type EngineSignal,
  type EngineTickResult,
  type SimulationEngine,
  type TickContext,
} from './EngineContracts';
import type { RunStateSnapshot } from './RunStateSnapshot';
import type { TickStep } from './TickSequence';

export interface EngineTickTransactionMeta {
  readonly engineId: EngineId;
  readonly tick: number;
  readonly step: TickStep;
  readonly startedAtMs: number;
  readonly traceId?: string;
}

export interface EngineTickTransactionState {
  readonly meta: EngineTickTransactionMeta;
  readonly inputSnapshot: RunStateSnapshot;
  readonly outputSnapshot: RunStateSnapshot;
  readonly signals: readonly EngineSignal[];
  readonly committed: boolean;
  readonly rolledBack: boolean;
}

export interface EngineTickRollbackOptions {
  readonly code?: string;
  readonly message?: string;
  readonly tags?: readonly string[];
  readonly error?: unknown;
}

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function normalizeTick(snapshot: RunStateSnapshot, context: TickContext): number {
  const traceTick = Number.isFinite(context.trace.tick) ? Math.trunc(context.trace.tick) : 0;
  const snapshotTick = Number.isFinite(snapshot.tick) ? Math.trunc(snapshot.tick) : 0;
  return Math.max(snapshotTick + 1, traceTick);
}

function normalizeErrorMessage(
  engineId: EngineId,
  step: TickStep,
  error: unknown,
  fallback?: string,
): string {
  if (typeof fallback === 'string' && fallback.length > 0) {
    return fallback;
  }

  if (error instanceof Error && error.message.length > 0) {
    return `[${engineId}] ${step} failed: ${error.message}`;
  }

  if (typeof error === 'string' && error.length > 0) {
    return `[${engineId}] ${step} failed: ${error}`;
  }

  return `[${engineId}] ${step} failed with an unknown engine transaction error.`;
}

export class EngineTickTransaction {
  private readonly meta: EngineTickTransactionMeta;
  private readonly inputSnapshot: RunStateSnapshot;
  private outputSnapshot: RunStateSnapshot;
  private readonly signalBuffer: EngineSignal[] = [];
  private committed = false;
  private rolledBack = false;

  public constructor(meta: EngineTickTransactionMeta, inputSnapshot: RunStateSnapshot) {
    this.meta = Object.freeze({
      ...meta,
      tick: Math.max(0, Math.trunc(meta.tick)),
      startedAtMs: Math.trunc(meta.startedAtMs),
    });
    this.inputSnapshot = inputSnapshot;
    this.outputSnapshot = inputSnapshot;
  }

  public static fromContext(
    engineId: EngineId,
    inputSnapshot: RunStateSnapshot,
    context: TickContext,
  ): EngineTickTransaction {
    return new EngineTickTransaction(
      {
        engineId,
        tick: normalizeTick(inputSnapshot, context),
        step: context.step,
        startedAtMs: context.nowMs,
        traceId: context.trace.traceId,
      },
      inputSnapshot,
    );
  }

  public static execute(
    engine: SimulationEngine,
    inputSnapshot: RunStateSnapshot,
    context: TickContext,
  ): EngineTickResult {
    const transaction = EngineTickTransaction.fromContext(
      engine.engineId,
      inputSnapshot,
      context,
    );

    try {
      if (engine.canRun !== undefined && !engine.canRun(inputSnapshot, context)) {
        return transaction.skip();
      }

      const rawResult = engine.tick(inputSnapshot, context);
      return transaction.applyResult(rawResult).commit();
    } catch (error) {
      return transaction.rollback({
        error,
        code: 'ENGINE_TRANSACTION_ROLLBACK',
        tags: ['engine-transaction', 'rollback', `engine:${engine.engineId}`],
      });
    }
  }

  public replaceSnapshot(snapshot: RunStateSnapshot): this {
    this.assertMutable();
    this.outputSnapshot = snapshot;
    return this;
  }

  public appendSignals(signals: readonly EngineSignal[]): this {
    this.assertMutable();

    for (const signal of signals) {
      this.signalBuffer.push(signal);
    }

    return this;
  }

  public applyResult(result: RunStateSnapshot | EngineTickResult): this {
    this.assertMutable();

    const normalized = normalizeEngineTickResult(
      this.meta.engineId,
      this.meta.tick,
      result,
    );

    this.outputSnapshot = normalized.snapshot;

    if (normalized.signals !== undefined && normalized.signals.length > 0) {
      this.appendSignals(normalized.signals);
    }

    return this;
  }

  public skip(): EngineTickResult {
    this.assertMutable();
    this.committed = true;

    const skippedSignal = createEngineSignal(
      this.meta.engineId,
      'INFO',
      'ENGINE_SKIPPED',
      `${this.meta.engineId} skipped ${this.meta.step}.`,
      this.meta.tick,
      ['engine-transaction', 'skipped', `step:${this.meta.step.toLowerCase()}`],
    );

    return Object.freeze({
      snapshot: this.inputSnapshot,
      signals: freezeArray([skippedSignal]),
    });
  }

  public rollback(options: EngineTickRollbackOptions = {}): EngineTickResult {
    this.assertMutable();
    this.rolledBack = true;
    this.committed = true;

    const rollbackSignal = createEngineSignal(
      this.meta.engineId,
      'ERROR',
      options.code ?? 'ENGINE_TRANSACTION_ROLLBACK',
      normalizeErrorMessage(
        this.meta.engineId,
        this.meta.step,
        options.error,
        options.message,
      ),
      this.meta.tick,
      freezeArray([
        'engine-transaction',
        'rollback',
        ...(options.tags ?? []),
      ]),
    );

    return Object.freeze({
      snapshot: this.inputSnapshot,
      signals: freezeArray([...this.signalBuffer, rollbackSignal]),
    });
  }

  public commit(): EngineTickResult {
    this.assertMutable();
    this.committed = true;

    return Object.freeze({
      snapshot: this.outputSnapshot,
      signals:
        this.signalBuffer.length > 0
          ? freezeArray(this.signalBuffer)
          : freezeArray([]),
    });
  }

  public getState(): EngineTickTransactionState {
    return Object.freeze({
      meta: this.meta,
      inputSnapshot: this.inputSnapshot,
      outputSnapshot: this.outputSnapshot,
      signals: freezeArray(this.signalBuffer),
      committed: this.committed,
      rolledBack: this.rolledBack,
    });
  }

  private assertMutable(): void {
    if (this.committed) {
      throw new Error(
        `EngineTickTransaction for ${this.meta.engineId} at ${this.meta.step} is already finalized.`,
      );
    }
  }
}