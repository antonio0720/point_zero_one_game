// backend/src/game/engine/zero/ErrorBoundary.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/ErrorBoundary.ts
 *
 * Doctrine:
 * - Engine 0 must catch per-step faults without flattening engine ownership
 * - errors are converted into deterministic records + signals + snapshot annotations
 * - fatality does not directly mutate outcome; it annotates telemetry so the
 *   core RuntimeOutcomeResolver / OutcomeGate can convert ENGINE_ABORT into ABANDONED
 * - this boundary is reusable for engine steps, mode hooks, and zero-owned steps
 */

import { cloneJson, deepFreeze } from '../core/Deterministic';
import {
  createEngineSignal,
  type EngineId,
  type EngineSignal,
} from '../core/EngineContracts';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type { TickStep } from '../core/TickSequence';

type Mutable<T> =
  T extends readonly (infer U)[]
    ? Mutable<U>[]
    : T extends object
      ? { -readonly [K in keyof T]: Mutable<T[K]> }
      : T;

export type ErrorBoundaryOwner = EngineId | 'mode' | 'system';

export interface ErrorBoundaryOptions {
  readonly maxConsecutiveFailures?: number;
  readonly annotateSnapshot?: boolean;
}

export interface ErrorBoundaryCaptureMeta {
  readonly owner: ErrorBoundaryOwner;
  readonly step: TickStep;
  readonly tick: number;
  readonly signalOwner?: EngineId | 'mode';
  readonly code?: string;
  readonly tags?: readonly string[];
  readonly snapshot?: RunStateSnapshot | null;
}

export interface ErrorBoundaryRecord {
  readonly owner: ErrorBoundaryOwner;
  readonly signalOwner: EngineId | 'mode';
  readonly step: TickStep;
  readonly tick: number;
  readonly code: string;
  readonly message: string;
  readonly severity: EngineSignal['severity'];
  readonly fatal: boolean;
  readonly tags: readonly string[];
  readonly stack?: string;
  readonly occurredAtMs: number;
  readonly consecutiveFailures: number;
}

export interface ErrorBoundaryResult<T> {
  readonly ok: boolean;
  readonly value: T;
  readonly fatal: boolean;
  readonly record: ErrorBoundaryRecord | null;
  readonly signal: EngineSignal | null;
  readonly snapshot: RunStateSnapshot | null;
}

const DEFAULT_OPTIONS: Required<ErrorBoundaryOptions> = {
  maxConsecutiveFailures: 5,
  annotateSnapshot: true,
};

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function uniqueAppend<T>(items: readonly T[], value: T): readonly T[] {
  return items.includes(value) ? freezeArray(items) : freezeArray([...items, value]);
}

function uniqueAppendMany<T>(items: readonly T[], values: readonly T[]): readonly T[] {
  const next = [...items];
  for (const value of values) {
    if (!next.includes(value)) {
      next.push(value);
    }
  }
  return freezeArray(next);
}

function normalizeMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  if (typeof error === 'string' && error.length > 0) {
    return error;
  }
  return 'Unknown runtime error.';
}

function normalizeStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}

export class ErrorBoundary {
  private readonly options: Required<ErrorBoundaryOptions>;

  private consecutiveFailures = 0;

  private lastError: ErrorBoundaryRecord | null = null;

  public constructor(options: ErrorBoundaryOptions = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
  }

  public reset(): void {
    this.consecutiveFailures = 0;
    this.lastError = null;
  }

  public getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  public getLastError(): ErrorBoundaryRecord | null {
    return this.lastError;
  }

  public capture<T>(
    meta: ErrorBoundaryCaptureMeta,
    execute: () => T,
    fallback: T,
  ): ErrorBoundaryResult<T> {
    try {
      const value = execute();
      this.consecutiveFailures = 0;

      return {
        ok: true,
        value,
        fatal: false,
        record: null,
        signal: null,
        snapshot: meta.snapshot ?? null,
      };
    } catch (error) {
      return this.handleFailure(meta, error, fallback);
    }
  }

  public async captureAsync<T>(
    meta: ErrorBoundaryCaptureMeta,
    execute: () => Promise<T>,
    fallback: T,
  ): Promise<ErrorBoundaryResult<T>> {
    try {
      const value = await execute();
      this.consecutiveFailures = 0;

      return {
        ok: true,
        value,
        fatal: false,
        record: null,
        signal: null,
        snapshot: meta.snapshot ?? null,
      };
    } catch (error) {
      return this.handleFailure(meta, error, fallback);
    }
  }

  public annotateSnapshot(
    snapshot: RunStateSnapshot,
    record: ErrorBoundaryRecord,
  ): RunStateSnapshot {
    if (this.options.annotateSnapshot !== true) {
      return snapshot;
    }

    const next = cloneJson(snapshot) as Mutable<RunStateSnapshot>;
    const warning = `[${record.step}] ${record.message}`;

    next.telemetry.warnings = uniqueAppend(next.telemetry.warnings, warning);
    next.tags = uniqueAppendMany(next.tags, freezeArray([
      'engine-zero:error-boundary',
      `step:${record.step.toLowerCase()}`,
      `owner:${record.owner}`,
    ]));

    if (record.fatal) {
      next.telemetry.outcomeReason = 'runtime.engine_abort';
      next.telemetry.outcomeReasonCode = 'ENGINE_ABORT';
      next.tags = uniqueAppend(next.tags, 'run:engine-abort');
    }

    return deepFreeze(next) as RunStateSnapshot;
  }

  private handleFailure<T>(
    meta: ErrorBoundaryCaptureMeta,
    error: unknown,
    fallback: T,
  ): ErrorBoundaryResult<T> {
    this.consecutiveFailures += 1;

    const fatal = this.consecutiveFailures >= this.options.maxConsecutiveFailures;
    const record = this.createRecord(meta, error, fatal);
    const signal = this.toSignal(record);

    this.lastError = record;

    return {
      ok: false,
      value: fallback,
      fatal,
      record,
      signal,
      snapshot:
        meta.snapshot === undefined || meta.snapshot === null
          ? null
          : this.annotateSnapshot(meta.snapshot, record),
    };
  }

  private createRecord(
    meta: ErrorBoundaryCaptureMeta,
    error: unknown,
    fatal: boolean,
  ): ErrorBoundaryRecord {
    const signalOwner =
      meta.signalOwner ??
      (meta.owner === 'system' ? 'mode' : meta.owner);

    const message = normalizeMessage(error);
    const tags = uniqueAppendMany(
      meta.tags ?? [],
      freezeArray([
        'engine-zero',
        'error-boundary',
        `step:${meta.step.toLowerCase()}`,
        `owner:${meta.owner}`,
        fatal ? 'fatal' : 'recoverable',
      ]),
    );

    return {
      owner: meta.owner,
      signalOwner,
      step: meta.step,
      tick: meta.tick,
      code:
        meta.code ??
        (fatal ? 'ENGINE_STEP_FATAL' : 'ENGINE_STEP_FAILED'),
      message,
      severity: fatal ? 'ERROR' : 'WARN',
      fatal,
      tags,
      stack: normalizeStack(error),
      occurredAtMs: Date.now(),
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  private toSignal(record: ErrorBoundaryRecord): EngineSignal {
    return createEngineSignal(
      record.signalOwner,
      record.severity,
      record.code,
      `[${record.step}] ${record.message}`,
      record.tick,
      record.tags,
    );
  }
}