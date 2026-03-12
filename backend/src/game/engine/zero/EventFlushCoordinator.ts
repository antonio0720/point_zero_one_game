// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/game/engine/zero/EventFlushCoordinator.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/EventFlushCoordinator.ts
 *
 * Doctrine:
 * - zero owns tick-boundary event finalization policy
 * - sealing must be deterministic and replay-stable
 * - backend/core EventBus remains the primitive queue; zero adds tick-facing summaries
 */

import { createHash } from 'node:crypto';

import type { EventBus, EventEnvelope } from '../core/EventBus';
import type { EngineEventMap } from '../core/GamePrimitives';
import type {
  EngineEventEnvelope,
  EngineEventSealSnapshot,
  EventSealResult,
} from './zero.types';

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();

  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function normalizeEnvelope<K extends keyof EngineEventMap>(
  envelope: EventEnvelope<K, EngineEventMap[K]>,
): EngineEventEnvelope<K> {
  return Object.freeze({
    sequence: envelope.sequence,
    event: envelope.event,
    payload: envelope.payload,
    emittedAtTick: envelope.emittedAtTick,
    tags: envelope.tags === undefined ? undefined : freezeArray(envelope.tags),
  });
}

export class EventFlushCoordinator {
  private readonly seals: EventSealResult[] = [];

  public constructor(private readonly retainLastSeals = 64) {}

  public flushAndSeal(
    bus: EventBus<EngineEventMap>,
  ): {
    readonly drained: readonly EngineEventEnvelope[];
    readonly seal: EventSealResult;
  } {
    const drained = freezeArray(
      bus.flush().map((entry) => normalizeEnvelope(entry)),
    );
    const seal = this.seal(drained);

    this.seals.push(seal);

    if (this.seals.length > this.retainLastSeals) {
      this.seals.splice(0, this.seals.length - this.retainLastSeals);
    }

    return Object.freeze({
      drained,
      seal,
    });
  }

  public seal(
    envelopes: readonly EngineEventEnvelope[],
  ): EventSealResult {
    const payload = stableStringify(
      envelopes.map((entry) => ({
        sequence: entry.sequence,
        event: entry.event,
        payload: entry.payload,
        emittedAtTick: entry.emittedAtTick ?? null,
        tags: entry.tags ?? [],
      })),
    );

    const checksum = createHash('sha256').update(payload).digest('hex');

    return Object.freeze({
      checksum,
      emittedEventCount: envelopes.length,
      emittedSequences: freezeArray(envelopes.map((entry) => entry.sequence)),
    });
  }

  public snapshot(
    envelopes: readonly EngineEventEnvelope[],
  ): EngineEventSealSnapshot {
    return Object.freeze({
      events: freezeArray(envelopes),
      count: envelopes.length,
      sequences: freezeArray(envelopes.map((entry) => entry.sequence)),
    });
  }

  public getRecentSeals(): readonly EventSealResult[] {
    return freezeArray(this.seals);
  }

  public clear(): void {
    this.seals.length = 0;
  }
}