/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/TimeEventEmitter.ts
 *
 * Doctrine:
 * - backend time emits operational truth; it does not own downstream reactions
 * - only existing EngineEventMap events are emitted here
 * - payloads are deterministic, serialization-safe, and queue-friendly
 * - helpers centralize event-tag discipline so time logic stays clean
 */

import type { EventBus } from '../core/EventBus';
import type { EngineEventMap } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';

type TimeEventBusMap = {
  [K in keyof EngineEventMap]: EngineEventMap[K];
};

export interface TimeEventEmitterOptions {
  readonly defaultTags?: readonly string[];
}

export type TickStartedPayload = EngineEventMap['tick.started'];
export type TickCompletedPayload = EngineEventMap['tick.completed'];
export type DecisionWindowOpenedPayload = EngineEventMap['decision.window.opened'];
export type DecisionWindowClosedPayload = EngineEventMap['decision.window.closed'];
export type PhaseWindowOpenedPayload = EngineEventMap['mode.phase_window.opened'];
export type PressureChangedPayload = EngineEventMap['pressure.changed'];
export type RunStartedPayload = EngineEventMap['run.started'];

export interface TimeEmitOptions {
  readonly emittedAtTick?: number;
  readonly tags?: readonly string[];
}

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function dedupeTags(
  base: readonly string[],
  local?: readonly string[],
): readonly string[] | undefined {
  const merged = new Set<string>(base);

  if (local !== undefined) {
    for (const tag of local) {
      if (tag.length > 0) {
        merged.add(tag);
      }
    }
  }

  if (merged.size === 0) {
    return undefined;
  }

  return freezeArray([...merged]);
}

export class TimeEventEmitter {
  private readonly defaultTags: readonly string[];

  public constructor(
    private readonly bus: EventBus<TimeEventBusMap>,
    options: TimeEventEmitterOptions = {},
  ) {
    this.defaultTags = freezeArray(options.defaultTags ?? ['engine:time']);
  }

  public emitTickStarted(
    snapshot: RunStateSnapshot,
    tick = snapshot.tick + 1,
    phase = snapshot.phase,
    options: TimeEmitOptions = {},
  ): void {
    const payload: TickStartedPayload = {
      runId: snapshot.runId,
      tick,
      phase,
    };

    this.bus.emit('tick.started', payload, {
      emittedAtTick: options.emittedAtTick ?? tick,
      tags: dedupeTags(this.defaultTags, options.tags),
    });
  }

  public emitTickCompleted(
    snapshot: RunStateSnapshot,
    checksum: string,
    tick = snapshot.tick,
    phase = snapshot.phase,
    options: TimeEmitOptions = {},
  ): void {
    const payload: TickCompletedPayload = {
      runId: snapshot.runId,
      tick,
      phase,
      checksum,
    };

    this.bus.emit('tick.completed', payload, {
      emittedAtTick: options.emittedAtTick ?? tick,
      tags: dedupeTags(this.defaultTags, options.tags),
    });
  }

  public emitRunStarted(
    snapshot: RunStateSnapshot,
    options: TimeEmitOptions = {},
  ): void {
    const payload: RunStartedPayload = {
      runId: snapshot.runId,
      mode: snapshot.mode,
      seed: snapshot.seed,
    };

    this.bus.emit('run.started', payload, {
      emittedAtTick: options.emittedAtTick ?? snapshot.tick,
      tags: dedupeTags(this.defaultTags, options.tags),
    });
  }

  public emitPressureChanged(
    from: PressureChangedPayload['from'],
    to: PressureChangedPayload['to'],
    score: number,
    tick: number,
    options: TimeEmitOptions = {},
  ): void {
    if (from === to) {
      return;
    }

    const payload: PressureChangedPayload = {
      from,
      to,
      score,
    };

    this.bus.emit('pressure.changed', payload, {
      emittedAtTick: options.emittedAtTick ?? tick,
      tags: dedupeTags(this.defaultTags, options.tags),
    });
  }

  public emitDecisionWindowOpened(
    payload: DecisionWindowOpenedPayload,
    options: TimeEmitOptions = {},
  ): void {
    this.bus.emit('decision.window.opened', payload, {
      emittedAtTick: options.emittedAtTick ?? payload.tick,
      tags: dedupeTags(this.defaultTags, options.tags),
    });
  }

  public emitDecisionWindowClosed(
    payload: DecisionWindowClosedPayload,
    options: TimeEmitOptions = {},
  ): void {
    this.bus.emit('decision.window.closed', payload, {
      emittedAtTick: options.emittedAtTick ?? payload.tick,
      tags: dedupeTags(this.defaultTags, options.tags),
    });
  }

  public emitPhaseWindowOpened(
    payload: PhaseWindowOpenedPayload,
    options: TimeEmitOptions = {},
  ): void {
    this.bus.emit('mode.phase_window.opened', payload, {
      emittedAtTick: options.emittedAtTick ?? payload.tick,
      tags: dedupeTags(this.defaultTags, options.tags),
    });
  }

  public emitTickLifecycle(
    snapshotBefore: RunStateSnapshot,
    snapshotAfter: RunStateSnapshot,
    checksum: string,
    options: TimeEmitOptions = {},
  ): void {
    this.emitTickStarted(
      snapshotBefore,
      snapshotAfter.tick,
      snapshotBefore.phase,
      options,
    );

    this.emitTickCompleted(
      snapshotAfter,
      checksum,
      snapshotAfter.tick,
      snapshotAfter.phase,
      options,
    );
  }

  public emitDecisionWindowBatch(
    opened: readonly DecisionWindowOpenedPayload[],
    closed: readonly DecisionWindowClosedPayload[],
    options: TimeEmitOptions = {},
  ): void {
    for (const payload of opened) {
      this.emitDecisionWindowOpened(payload, options);
    }

    for (const payload of closed) {
      this.emitDecisionWindowClosed(payload, options);
    }
  }
}