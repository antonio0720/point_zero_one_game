// backend/src/game/engine/zero/EventFlushCoordinator.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/EventFlushCoordinator.ts
 *
 * Doctrine:
 * - backend core EventBus already owns emission + queue/history mechanics
 * - Engine 0 owns the tick boundary where queued envelopes are drained,
 *   canonically hashed, and reflected back into snapshot telemetry
 * - flush coordination must never invent a second bus or mutate envelope order
 * - the checksum projection must stay stable with the existing backend 15X
 *   event-seal doctrine so proof surfaces do not drift
 */

import {
  checksumParts,
  checksumSnapshot,
  cloneJson,
  computeTickSeal,
  deepFreeze,
} from '../core/Deterministic';
import type { EventBus, EventEnvelope } from '../core/EventBus';
import type { EngineEventMap } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type { TickStep } from '../core/TickSequence';

type Mutable<T> =
  T extends readonly (infer U)[]
    ? Mutable<U>[]
    : T extends object
      ? { -readonly [K in keyof T]: Mutable<T[K]> }
      : T;

export interface EventFlushCoordinatorOptions {
  readonly appendStateChecksumToSovereignty?: boolean;
  readonly incrementTelemetryEventCount?: boolean;
}

export interface FlushedEventDigest {
  readonly sequence: number;
  readonly event: keyof EngineEventMap;
  readonly emittedAtTick?: number;
  readonly tags?: readonly string[];
  readonly checksum: string;
}

export interface EventFlushResult {
  readonly snapshot: RunStateSnapshot;
  readonly drained: readonly EventEnvelope<
    keyof EngineEventMap,
    EngineEventMap[keyof EngineEventMap]
  >[];
  readonly digests: readonly FlushedEventDigest[];
  readonly drainedCount: number;
  readonly stateChecksum: string;
  readonly tickSeal: string;
}

const DEFAULT_OPTIONS: Required<EventFlushCoordinatorOptions> = {
  appendStateChecksumToSovereignty: true,
  incrementTelemetryEventCount: true,
};

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

export class EventFlushCoordinator {
  private readonly options: Required<EventFlushCoordinatorOptions>;

  public constructor(options: EventFlushCoordinatorOptions = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
  }

  public flush(
    snapshot: RunStateSnapshot,
    bus: EventBus<EngineEventMap>,
    step: TickStep = 'STEP_13_FLUSH',
  ): EventFlushResult {
    const drained = bus.flush() as Array<
      EventEnvelope<keyof EngineEventMap, EngineEventMap[keyof EngineEventMap]>
    >;

    const digests = freezeArray(drained.map((entry) => this.digestEnvelope(entry)));
    const stateChecksum = this.computeStateChecksum(snapshot);
    const tickSeal = computeTickSeal({
      runId: snapshot.runId,
      tick: snapshot.tick,
      step,
      stateChecksum,
      eventChecksums: digests.map((entry) => entry.checksum),
    });

    const next = this.decorateSnapshot(snapshot, stateChecksum, drained.length);

    return {
      snapshot: next,
      drained: freezeArray(drained),
      digests,
      drainedCount: drained.length,
      stateChecksum,
      tickSeal,
    };
  }

  public computeStateChecksum(snapshot: RunStateSnapshot): string {
    return checksumSnapshot({
      tick: snapshot.tick,
      phase: snapshot.phase,
      economy: snapshot.economy,
      pressure: snapshot.pressure,
      tension: snapshot.tension,
      shield: snapshot.shield,
      battle: {
        ...snapshot.battle,
        pendingAttacks: snapshot.battle.pendingAttacks.map((attack) => attack.attackId),
      },
      cascade: snapshot.cascade.activeChains.map((chain) => ({
        chainId: chain.chainId,
        status: chain.status,
        links: chain.links.map((link) => link.linkId),
      })),
    });
  }

  private digestEnvelope(
    entry: EventEnvelope<keyof EngineEventMap, EngineEventMap[keyof EngineEventMap]>,
  ): FlushedEventDigest {
    return {
      sequence: entry.sequence,
      event: entry.event,
      emittedAtTick: entry.emittedAtTick,
      tags: entry.tags === undefined ? undefined : freezeArray(entry.tags),
      checksum: checksumParts(
        entry.sequence,
        entry.event,
        entry.emittedAtTick ?? null,
        entry.tags ?? [],
        entry.payload,
      ),
    };
  }

  private decorateSnapshot(
    snapshot: RunStateSnapshot,
    stateChecksum: string,
    drainedCount: number,
  ): RunStateSnapshot {
    if (
      this.options.appendStateChecksumToSovereignty !== true &&
      this.options.incrementTelemetryEventCount !== true &&
      snapshot.telemetry.lastTickChecksum === stateChecksum
    ) {
      return snapshot;
    }

    const next = cloneJson(snapshot) as Mutable<RunStateSnapshot>;

    next.telemetry.lastTickChecksum = stateChecksum;

    if (this.options.incrementTelemetryEventCount === true) {
      next.telemetry.emittedEventCount =
        next.telemetry.emittedEventCount + drainedCount;
    }

    if (this.options.appendStateChecksumToSovereignty === true) {
      const existing = next.sovereignty.tickChecksums;
      const alreadyPresent =
        existing.length > 0 && existing[existing.length - 1] === stateChecksum;

      if (!alreadyPresent) {
        next.sovereignty.tickChecksums = freezeArray([
          ...existing,
          stateChecksum,
        ]);
      }
    }

    return deepFreeze(next) as RunStateSnapshot;
  }
}