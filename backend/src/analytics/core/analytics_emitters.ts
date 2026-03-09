// backend/src/analytics/core/analytics_emitters.ts

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — ANALYTICS CORE / EMITTERS
 * backend/src/analytics/core/analytics_emitters.ts
 *
 * Async-capable analytics emitter implementations.
 *
 * Included:
 * - NoopAnalyticsEmitter
 * - ConsoleAnalyticsEmitter
 * - MemoryAnalyticsEmitter
 * - CompositeAnalyticsEmitter
 * - FilteredAnalyticsEmitter
 * - helper emit functions
 *
 * Design rules:
 * - all emitters return receipts
 * - batch paths are first-class
 * - no domain logic belongs here
 * - safe for Express, workers, replay jobs, and tests
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import {
  serializeAnalyticsEnvelope,
  type AnalyticsEnvelope,
  type AnalyticsPayload,
} from './analytics_envelope';

import type { AnalyticsEventName } from './analytics_names';

import type {
  AnalyticsBatchEmitReceipt,
  AnalyticsCompositeOptions,
  AnalyticsEmitContext,
  AnalyticsEmitReceipt,
  AnalyticsEmitter,
  AnalyticsEnvelopeAny,
  AnalyticsEnvelopePredicate,
  AnalyticsLoggerLike,
} from './analytics_types';

function now(): number {
  return Date.now();
}

function toSuccessReceipt(
  envelope: AnalyticsEnvelopeAny,
  transport: AnalyticsEmitReceipt['transport'],
  overrides: Partial<AnalyticsEmitReceipt> = {},
): AnalyticsEmitReceipt {
  return {
    eventId: envelope.eventId,
    eventName: envelope.eventName,
    transport,
    status: 'DELIVERED',
    emittedAt: now(),
    ...overrides,
  };
}

function toFailureReceipt(
  envelope: AnalyticsEnvelopeAny,
  transport: AnalyticsEmitReceipt['transport'],
  error: unknown,
): AnalyticsEmitReceipt {
  return {
    eventId: envelope.eventId,
    eventName: envelope.eventName,
    transport,
    status: 'FAILED',
    emittedAt: now(),
    errorMessage: error instanceof Error ? error.message : String(error),
  };
}

function buildBatchReceipt(
  receipts: AnalyticsEmitReceipt[],
): AnalyticsBatchEmitReceipt {
  let successCount = 0;
  let failureCount = 0;

  for (const receipt of receipts) {
    if (receipt.status === 'FAILED') {
      failureCount += 1;
    } else {
      successCount += 1;
    }
  }

  return {
    total: receipts.length,
    successCount,
    failureCount,
    receipts,
  };
}

export async function emitAnalyticsEnvelope(
  emitter: AnalyticsEmitter,
  envelope: AnalyticsEnvelopeAny,
  context: AnalyticsEmitContext = {},
): Promise<AnalyticsEmitReceipt> {
  return emitter.emit(envelope, context);
}

export async function emitAnalyticsEnvelopeBatch(
  emitter: AnalyticsEmitter,
  envelopes: readonly AnalyticsEnvelopeAny[],
  context: AnalyticsEmitContext = {},
): Promise<AnalyticsBatchEmitReceipt> {
  if (typeof emitter.emitBatch === 'function') {
    return emitter.emitBatch(envelopes, context);
  }

  const receipts = await Promise.all(
    envelopes.map((envelope) => emitter.emit(envelope, context)),
  );

  return buildBatchReceipt(receipts);
}

export class NoopAnalyticsEmitter implements AnalyticsEmitter {
  async emit(
    envelope: AnalyticsEnvelopeAny,
    _context: AnalyticsEmitContext = {},
  ): Promise<AnalyticsEmitReceipt> {
    return toSuccessReceipt(envelope, 'noop', {
      status: 'SKIPPED',
      deduped: false,
    });
  }

  async emitBatch(
    envelopes: readonly AnalyticsEnvelopeAny[],
    _context: AnalyticsEmitContext = {},
  ): Promise<AnalyticsBatchEmitReceipt> {
    const receipts = envelopes.map((envelope) =>
      toSuccessReceipt(envelope, 'noop', {
        status: 'SKIPPED',
        deduped: false,
      }),
    );

    return buildBatchReceipt(receipts);
  }
}

export class ConsoleAnalyticsEmitter implements AnalyticsEmitter {
  constructor(
    private readonly logger: Pick<Console, 'info' | 'error'> = console,
    private readonly prefix: string = '[pzo-analytics]',
  ) {}

  async emit(
    envelope: AnalyticsEnvelopeAny,
    _context: AnalyticsEmitContext = {},
  ): Promise<AnalyticsEmitReceipt> {
    try {
      this.logger.info(this.prefix, serializeAnalyticsEnvelope(envelope));
      return toSuccessReceipt(envelope, 'console');
    } catch (error) {
      this.logger.error(this.prefix, 'emit failed', error);
      return toFailureReceipt(envelope, 'console', error);
    }
  }

  async emitBatch(
    envelopes: readonly AnalyticsEnvelopeAny[],
    context: AnalyticsEmitContext = {},
  ): Promise<AnalyticsBatchEmitReceipt> {
    const receipts: AnalyticsEmitReceipt[] = [];

    for (const envelope of envelopes) {
      receipts.push(await this.emit(envelope, context));
    }

    return buildBatchReceipt(receipts);
  }
}

export class MemoryAnalyticsEmitter implements AnalyticsEmitter {
  private readonly events: AnalyticsEnvelopeAny[] = [];

  async emit(
    envelope: AnalyticsEnvelopeAny,
    _context: AnalyticsEmitContext = {},
  ): Promise<AnalyticsEmitReceipt> {
    this.events.push(structuredCloneSafe(envelope));
    return toSuccessReceipt(envelope, 'memory');
  }

  async emitBatch(
    envelopes: readonly AnalyticsEnvelopeAny[],
    _context: AnalyticsEmitContext = {},
  ): Promise<AnalyticsBatchEmitReceipt> {
    for (const envelope of envelopes) {
      this.events.push(structuredCloneSafe(envelope));
    }

    const receipts = envelopes.map((envelope) =>
      toSuccessReceipt(envelope, 'memory'),
    );

    return buildBatchReceipt(receipts);
  }

  snapshot(): ReadonlyArray<AnalyticsEnvelopeAny> {
    return this.events.map((event) => structuredCloneSafe(event));
  }

  clear(): void {
    this.events.length = 0;
  }
}

export class FilteredAnalyticsEmitter implements AnalyticsEmitter {
  constructor(
    private readonly inner: AnalyticsEmitter,
    private readonly predicate: AnalyticsEnvelopePredicate,
  ) {}

  async emit(
    envelope: AnalyticsEnvelopeAny,
    context: AnalyticsEmitContext = {},
  ): Promise<AnalyticsEmitReceipt> {
    if (!this.predicate(envelope)) {
      return toSuccessReceipt(envelope, 'inline', {
        status: 'SKIPPED',
      });
    }

    return this.inner.emit(envelope, context);
  }

  async emitBatch(
    envelopes: readonly AnalyticsEnvelopeAny[],
    context: AnalyticsEmitContext = {},
  ): Promise<AnalyticsBatchEmitReceipt> {
    const receipts: AnalyticsEmitReceipt[] = [];

    for (const envelope of envelopes) {
      receipts.push(await this.emit(envelope, context));
    }

    return buildBatchReceipt(receipts);
  }
}

export class CompositeAnalyticsEmitter implements AnalyticsEmitter {
  constructor(
    private readonly emitters: readonly AnalyticsEmitter[],
    private readonly options: AnalyticsCompositeOptions = {},
    private readonly logger: AnalyticsLoggerLike = console,
  ) {}

  async emit(
    envelope: AnalyticsEnvelopeAny,
    context: AnalyticsEmitContext = {},
  ): Promise<AnalyticsEmitReceipt> {
    if (this.emitters.length === 0) {
      return toSuccessReceipt(envelope, 'noop', { status: 'SKIPPED' });
    }

    const failFast = this.options.failFast ?? true;
    const sequential = this.options.sequential ?? false;

    if (sequential) {
      const receipts: AnalyticsEmitReceipt[] = [];

      for (const emitter of this.emitters) {
        try {
          receipts.push(await emitter.emit(envelope, context));
        } catch (error) {
          this.logger.error?.(
            '[pzo-analytics] composite emitter child failed',
            error,
          );

          const failure = toFailureReceipt(envelope, 'inline', error);
          receipts.push(failure);

          if (failFast) {
            throw error;
          }
        }
      }

      return collapseReceipts(envelope, receipts);
    }

    const settled = await Promise.allSettled(
      this.emitters.map((emitter) => emitter.emit(envelope, context)),
    );

    const receipts: AnalyticsEmitReceipt[] = settled.map((entry) => {
      if (entry.status === 'fulfilled') {
        return entry.value;
      }

      this.logger.error?.(
        '[pzo-analytics] composite emitter child failed',
        entry.reason,
      );

      return toFailureReceipt(envelope, 'inline', entry.reason);
    });

    const failed = receipts.some((receipt) => receipt.status === 'FAILED');
    if (failed && failFast) {
      const firstFailure = receipts.find((receipt) => receipt.status === 'FAILED');
      throw new Error(
        firstFailure?.errorMessage ??
          'CompositeAnalyticsEmitter failed to emit event.',
      );
    }

    return collapseReceipts(envelope, receipts);
  }

  async emitBatch(
    envelopes: readonly AnalyticsEnvelopeAny[],
    context: AnalyticsEmitContext = {},
  ): Promise<AnalyticsBatchEmitReceipt> {
    const receipts: AnalyticsEmitReceipt[] = [];

    for (const envelope of envelopes) {
      receipts.push(await this.emit(envelope, context));
    }

    return buildBatchReceipt(receipts);
  }
}

export function createFilteredAnalyticsEmitter(
  emitter: AnalyticsEmitter,
  predicate: AnalyticsEnvelopePredicate,
): AnalyticsEmitter {
  return new FilteredAnalyticsEmitter(emitter, predicate);
}

export function createEventNameFilter(
  ...eventNames: readonly string[]
): AnalyticsEnvelopePredicate {
  const allow = new Set(eventNames);
  return (envelope) => allow.has(envelope.eventName);
}

export function createEventPrefixFilter(
  ...prefixes: readonly string[]
): AnalyticsEnvelopePredicate {
  return (envelope) => prefixes.some((prefix) => envelope.eventName.startsWith(prefix));
}

function collapseReceipts(
  envelope: AnalyticsEnvelopeAny,
  receipts: readonly AnalyticsEmitReceipt[],
): AnalyticsEmitReceipt {
  const failed = receipts.find((receipt) => receipt.status === 'FAILED');
  if (failed) {
    return {
      ...failed,
      eventId: envelope.eventId,
      eventName: envelope.eventName,
    };
  }

  const delivered = receipts.find(
    (receipt) =>
      receipt.status === 'DELIVERED' || receipt.status === 'ENQUEUED',
  );

  if (delivered) {
    return {
      ...delivered,
      eventId: envelope.eventId,
      eventName: envelope.eventName,
      transport: 'inline',
    };
  }

  return toSuccessReceipt(envelope, 'inline', { status: 'SKIPPED' });
}

function structuredCloneSafe<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Helper alias for strongly typed emitters used by feature modules.
 */
export type TypedAnalyticsEmitter<
  TEventName extends AnalyticsEventName,
  TPayload extends AnalyticsPayload = AnalyticsPayload,
> = {
  emit(
    envelope: AnalyticsEnvelope<TEventName, TPayload>,
    context?: AnalyticsEmitContext,
  ): Promise<AnalyticsEmitReceipt>;

  emitBatch?(
    envelopes: readonly AnalyticsEnvelope<TEventName, TPayload>[],
    context?: AnalyticsEmitContext,
  ): Promise<AnalyticsBatchEmitReceipt>;
};