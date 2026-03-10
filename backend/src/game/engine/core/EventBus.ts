/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/EventBus.ts
 *
 * Doctrine:
 * - the bus is typed, deterministic in ordering, and bounded in memory
 * - events are append-only envelopes with sequence ids
 * - listeners must not be able to corrupt queue/history internals
 * - queue/history are operational surfaces, not authoritative game state
 * - emit must remain cheap enough for per-tick engine coordination
 */

export type Listener<T> = (payload: T) => void;

export interface EventEnvelope<
  K extends PropertyKey,
  P,
> {
  readonly sequence: number;
  readonly event: K;
  readonly payload: P;
  readonly emittedAtTick?: number;
  readonly tags?: readonly string[];
}

export type AnyEventListener<EventMap extends Record<string, unknown>> = <
  K extends keyof EventMap,
>(
  envelope: EventEnvelope<K, EventMap[K]>,
) => void;

export interface EventBusOptions {
  readonly maxQueueSize?: number;
  readonly maxHistorySize?: number;
}

export interface EmitOptions {
  readonly emittedAtTick?: number;
  readonly tags?: readonly string[];
}

export interface ClearOptions {
  readonly clearQueue?: boolean;
  readonly clearHistory?: boolean;
  readonly clearListeners?: boolean;
  readonly clearAnyListeners?: boolean;
}

const DEFAULT_MAX_QUEUE_SIZE = 4_096;
const DEFAULT_MAX_HISTORY_SIZE = 16_384;

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

export class EventBus<EventMap extends Record<string, unknown>> {
  private readonly listeners = new Map<
    keyof EventMap,
    Set<Listener<EventMap[keyof EventMap]>>
  >();

  private readonly anyListeners = new Set<AnyEventListener<EventMap>>();

  private readonly queued: Array<
    EventEnvelope<keyof EventMap, EventMap[keyof EventMap]>
  > = [];

  private readonly history: Array<
    EventEnvelope<keyof EventMap, EventMap[keyof EventMap]>
  > = [];

  private readonly maxQueueSize: number;
  private readonly maxHistorySize: number;

  private sequence = 0;

  public constructor(options: EventBusOptions = {}) {
    this.maxQueueSize = Math.max(1, options.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE);
    this.maxHistorySize = Math.max(
      1,
      options.maxHistorySize ?? DEFAULT_MAX_HISTORY_SIZE,
    );
  }

  public on<K extends keyof EventMap>(
    event: K,
    listener: Listener<EventMap[K]>,
  ): () => void {
    const set =
      this.listeners.get(event) ??
      new Set<Listener<EventMap[keyof EventMap]>>();

    set.add(listener as Listener<EventMap[keyof EventMap]>);
    this.listeners.set(event, set);

    return () => {
      set.delete(listener as Listener<EventMap[keyof EventMap]>);

      if (set.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  public once<K extends keyof EventMap>(
    event: K,
    listener: Listener<EventMap[K]>,
  ): () => void {
    const off = this.on(event, (payload) => {
      off();
      listener(payload);
    });

    return off;
  }

  public onAny(listener: AnyEventListener<EventMap>): () => void {
    this.anyListeners.add(listener);

    return () => {
      this.anyListeners.delete(listener);
    };
  }

  public emit<K extends keyof EventMap>(
    event: K,
    payload: EventMap[K],
    options: EmitOptions = {},
  ): EventEnvelope<K, EventMap[K]> {
    const envelope: EventEnvelope<K, EventMap[K]> = {
      sequence: ++this.sequence,
      event,
      payload,
      emittedAtTick: options.emittedAtTick,
      tags: options.tags === undefined ? undefined : freezeArray(options.tags),
    };

    this.queued.push(
      envelope as EventEnvelope<keyof EventMap, EventMap[keyof EventMap]>,
    );
    this.history.push(
      envelope as EventEnvelope<keyof EventMap, EventMap[keyof EventMap]>,
    );

    this.trimQueue();
    this.trimHistory();

    const specific = this.listeners.get(event);
    if (specific !== undefined && specific.size > 0) {
      for (const handler of [...specific]) {
        handler(payload as EventMap[keyof EventMap]);
      }
    }

    if (this.anyListeners.size > 0) {
      for (const handler of [...this.anyListeners]) {
        handler(envelope);
      }
    }

    return envelope;
  }

  public emitBatch(
    entries: ReadonlyArray<{
      readonly event: keyof EventMap;
      readonly payload: EventMap[keyof EventMap];
      readonly options?: EmitOptions;
    }>,
  ): Array<EventEnvelope<keyof EventMap, EventMap[keyof EventMap]>> {
    return entries.map((entry) =>
      this.emit(entry.event, entry.payload, entry.options),
    );
  }

  public peek<K extends keyof EventMap>(event: K): EventMap[K][] {
    return this.queued
      .filter((entry) => entry.event === event)
      .map((entry) => entry.payload as EventMap[K]);
  }

  public peekEntries<K extends keyof EventMap>(
    event: K,
  ): Array<EventEnvelope<K, EventMap[K]>> {
    return this.queued
      .filter((entry) => entry.event === event)
      .map((entry) => entry as EventEnvelope<K, EventMap[K]>);
  }

  public flush(): Array<
    EventEnvelope<keyof EventMap, EventMap[keyof EventMap]>
  > {
    const drained = [...this.queued];
    this.queued.length = 0;
    return drained;
  }

  public getHistory(
    limit?: number,
  ): Array<EventEnvelope<keyof EventMap, EventMap[keyof EventMap]>> {
    if (limit === undefined || limit >= this.history.length) {
      return [...this.history];
    }

    if (limit <= 0) {
      return [];
    }

    return this.history.slice(this.history.length - limit);
  }

  public last<K extends keyof EventMap>(
    event: K,
  ): EventEnvelope<K, EventMap[K]> | null {
    for (let index = this.history.length - 1; index >= 0; index -= 1) {
      const entry = this.history[index];
      if (entry.event === event) {
        return entry as EventEnvelope<K, EventMap[K]>;
      }
    }

    return null;
  }

  public queuedCount(): number {
    return this.queued.length;
  }

  public historyCount(): number {
    return this.history.length;
  }

  public clear(options: ClearOptions = {}): void {
    const {
      clearQueue = true,
      clearHistory = true,
      clearListeners = true,
      clearAnyListeners = true,
    } = options;

    if (clearQueue) {
      this.queued.length = 0;
    }

    if (clearHistory) {
      this.history.length = 0;
    }

    if (clearListeners) {
      this.listeners.clear();
    }

    if (clearAnyListeners) {
      this.anyListeners.clear();
    }
  }

  private trimQueue(): void {
    if (this.queued.length <= this.maxQueueSize) {
      return;
    }

    const overflow = this.queued.length - this.maxQueueSize;
    this.queued.splice(0, overflow);
  }

  private trimHistory(): void {
    if (this.history.length <= this.maxHistorySize) {
      return;
    }

    const overflow = this.history.length - this.maxHistorySize;
    this.history.splice(0, overflow);
  }
}