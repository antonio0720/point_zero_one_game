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
 * - ML/DL routing is a first-class concern — events feed inference pipelines
 * - the bus family (priority, filter, mirror, router, broadcaster) shares one API contract
 */

// ============================================================================
// MARK: Core types — the bus vocabulary
// ============================================================================

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

// ============================================================================
// MARK: Internal constants
// ============================================================================

const DEFAULT_MAX_QUEUE_SIZE = 4_096;
const DEFAULT_MAX_HISTORY_SIZE = 16_384;

// ============================================================================
// MARK: Internal utilities
// ============================================================================

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

// ============================================================================
// MARK: EventBus — core typed pub/sub bus
// ============================================================================

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

  public listenerCount(event?: keyof EventMap): number {
    if (event === undefined) {
      let total = 0;
      for (const set of this.listeners.values()) total += set.size;
      return total + this.anyListeners.size;
    }
    return this.listeners.get(event)?.size ?? 0;
  }

  public getRegisteredEvents(): Array<keyof EventMap> {
    return [...this.listeners.keys()];
  }

  public hasListeners(event: keyof EventMap): boolean {
    return (this.listeners.get(event)?.size ?? 0) > 0 || this.anyListeners.size > 0;
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

// ============================================================================
// MARK: EventPriority — priority levels for PriorityEventBus
// ============================================================================

export type EventPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'BACKGROUND';

export const EVENT_PRIORITY_NUMERIC: Record<EventPriority, number> = {
  CRITICAL:   100,
  HIGH:       75,
  MEDIUM:     50,
  LOW:        25,
  BACKGROUND: 0,
};

export interface PriorityEventQueueEntry<EventMap extends Record<string, unknown>> {
  readonly envelope: EventEnvelope<keyof EventMap, EventMap[keyof EventMap]>;
  readonly priority: EventPriority;
  readonly insertedAt: number;
}

// ============================================================================
// MARK: PriorityEventBus — priority-aware bus
// ============================================================================

export class PriorityEventBus<EventMap extends Record<string, unknown>> {
  private readonly base: EventBus<EventMap>;
  private readonly priorityQueue: PriorityEventQueueEntry<EventMap>[] = [];
  private readonly maxQueueSize: number;
  private insertionCounter = 0;

  public constructor(options: EventBusOptions & { maxQueueSize?: number } = {}) {
    this.base = new EventBus<EventMap>(options);
    this.maxQueueSize = Math.max(1, options.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE);
  }

  public emit<K extends keyof EventMap>(
    event: K,
    payload: EventMap[K],
    priority: EventPriority = 'MEDIUM',
    options: EmitOptions = {},
  ): EventEnvelope<K, EventMap[K]> {
    const envelope = this.base.emit(event, payload, options);

    const entry: PriorityEventQueueEntry<EventMap> = {
      envelope: envelope as EventEnvelope<keyof EventMap, EventMap[keyof EventMap]>,
      priority,
      insertedAt: this.insertionCounter++,
    };

    this.priorityQueue.push(entry);
    this.trimPriorityQueue();
    this.sortPriorityQueue();

    return envelope;
  }

  public drainPriority(): PriorityEventQueueEntry<EventMap>[] {
    const items = [...this.priorityQueue];
    this.priorityQueue.length = 0;
    return items;
  }

  public peekHighest(): PriorityEventQueueEntry<EventMap> | null {
    return this.priorityQueue[0] ?? null;
  }

  public on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): () => void {
    return this.base.on(event, listener);
  }

  public onAny(listener: AnyEventListener<EventMap>): () => void {
    return this.base.onAny(listener);
  }

  public getBase(): EventBus<EventMap> {
    return this.base;
  }

  public getStats(): { queuedCount: number; historyCount: number; priorityQueueSize: number } {
    return {
      queuedCount: this.base.queuedCount(),
      historyCount: this.base.historyCount(),
      priorityQueueSize: this.priorityQueue.length,
    };
  }

  public clear(): void {
    this.base.clear();
    this.priorityQueue.length = 0;
  }

  private sortPriorityQueue(): void {
    this.priorityQueue.sort((a, b) => {
      const priorityDiff = EVENT_PRIORITY_NUMERIC[b.priority] - EVENT_PRIORITY_NUMERIC[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.insertedAt - b.insertedAt;
    });
  }

  private trimPriorityQueue(): void {
    if (this.priorityQueue.length > this.maxQueueSize) {
      this.priorityQueue.splice(this.maxQueueSize);
    }
  }
}

// ============================================================================
// MARK: EventBusFilter — predicate-based event filtering
// ============================================================================

export type EventFilterPredicate<EventMap extends Record<string, unknown>> = (
  envelope: EventEnvelope<keyof EventMap, EventMap[keyof EventMap]>,
) => boolean;

export interface EventBusFilterOptions<EventMap extends Record<string, unknown>> {
  readonly predicate: EventFilterPredicate<EventMap>;
  readonly allowedEvents?: ReadonlyArray<keyof EventMap>;
  readonly blockedEvents?: ReadonlyArray<keyof EventMap>;
  readonly allowedTags?: readonly string[];
}

export class EventBusFilter<EventMap extends Record<string, unknown>> {
  private readonly source: EventBus<EventMap>;
  private readonly sink: EventBus<EventMap>;
  private readonly options: EventBusFilterOptions<EventMap>;
  private passCount = 0;
  private rejectCount = 0;

  public constructor(
    source: EventBus<EventMap>,
    sink: EventBus<EventMap>,
    options: EventBusFilterOptions<EventMap>,
  ) {
    this.source = source;
    this.sink = sink;
    this.options = options;

    this.source.onAny((envelope) => {
      if (this.shouldPass(envelope)) {
        this.sink.emit(
          envelope.event,
          envelope.payload as EventMap[typeof envelope.event],
          { emittedAtTick: envelope.emittedAtTick, tags: envelope.tags },
        );
        this.passCount++;
      } else {
        this.rejectCount++;
      }
    });
  }

  private shouldPass(
    envelope: EventEnvelope<keyof EventMap, EventMap[keyof EventMap]>,
  ): boolean {
    if (this.options.allowedEvents && !this.options.allowedEvents.includes(envelope.event)) {
      return false;
    }
    if (this.options.blockedEvents && this.options.blockedEvents.includes(envelope.event)) {
      return false;
    }
    if (this.options.allowedTags && envelope.tags) {
      const hasAllowedTag = envelope.tags.some((t) => this.options.allowedTags!.includes(t));
      if (!hasAllowedTag) return false;
    }
    return this.options.predicate(envelope);
  }

  public getStats(): { passCount: number; rejectCount: number; passRate: number } {
    const total = this.passCount + this.rejectCount;
    return {
      passCount: this.passCount,
      rejectCount: this.rejectCount,
      passRate: total === 0 ? 1 : this.passCount / total,
    };
  }

  public getSource(): EventBus<EventMap> {
    return this.source;
  }

  public getSink(): EventBus<EventMap> {
    return this.sink;
  }

  public reset(): void {
    this.passCount = 0;
    this.rejectCount = 0;
  }
}

// ============================================================================
// MARK: EventBusReplayBuffer — replay historical events to new listeners
// ============================================================================

export interface EventBusReplayOptions {
  readonly maxBufferSize?: number;
  readonly replayOnSubscribe?: boolean;
}

export interface ReplayBufferEntry<EventMap extends Record<string, unknown>> {
  readonly envelope: EventEnvelope<keyof EventMap, EventMap[keyof EventMap]>;
  readonly capturedAt: number;
}

export class EventBusReplayBuffer<EventMap extends Record<string, unknown>> {
  private readonly bus: EventBus<EventMap>;
  private readonly buffer: ReplayBufferEntry<EventMap>[] = [];
  private readonly maxBufferSize: number;
  private readonly replayOnSubscribe: boolean;

  public constructor(
    bus: EventBus<EventMap>,
    options: EventBusReplayOptions = {},
  ) {
    this.bus = bus;
    this.maxBufferSize = Math.max(1, options.maxBufferSize ?? 512);
    this.replayOnSubscribe = options.replayOnSubscribe ?? true;

    this.bus.onAny((envelope) => {
      this.buffer.push({ envelope, capturedAt: Date.now() });
      this.trimBuffer();
    });
  }

  public subscribeWithReplay<K extends keyof EventMap>(
    event: K,
    listener: Listener<EventMap[K]>,
  ): () => void {
    if (this.replayOnSubscribe) {
      this.replayEvent(event, listener);
    }
    return this.bus.on(event, listener);
  }

  public replayAll(
    listener: AnyEventListener<EventMap>,
    filter?: (entry: ReplayBufferEntry<EventMap>) => boolean,
  ): void {
    const entries = filter ? this.buffer.filter(filter) : this.buffer;
    for (const entry of entries) {
      listener(entry.envelope);
    }
  }

  public replayEvent<K extends keyof EventMap>(
    event: K,
    listener: Listener<EventMap[K]>,
  ): void {
    for (const entry of this.buffer) {
      if (entry.envelope.event === event) {
        listener(entry.envelope.payload as EventMap[K]);
      }
    }
  }

  public replaySince(
    timestampMs: number,
    listener: AnyEventListener<EventMap>,
  ): void {
    for (const entry of this.buffer) {
      if (entry.capturedAt >= timestampMs) {
        listener(entry.envelope);
      }
    }
  }

  public getBuffer(): ReadonlyArray<ReplayBufferEntry<EventMap>> {
    return [...this.buffer];
  }

  public bufferSize(): number {
    return this.buffer.length;
  }

  public clear(): void {
    this.buffer.length = 0;
  }

  public getBus(): EventBus<EventMap> {
    return this.bus;
  }

  private trimBuffer(): void {
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.splice(0, this.buffer.length - this.maxBufferSize);
    }
  }
}

// ============================================================================
// MARK: EventBusRouter — route events to different buses based on rules
// ============================================================================

export type EventBusRouteRule<EventMap extends Record<string, unknown>> = (
  envelope: EventEnvelope<keyof EventMap, EventMap[keyof EventMap]>,
) => string | null;

export interface EventBusRouterOptions {
  readonly defaultRoute?: string;
  readonly dropUnrouted?: boolean;
}

export class EventBusRouter<EventMap extends Record<string, unknown>> {
  private readonly source: EventBus<EventMap>;
  private readonly routes = new Map<string, EventBus<EventMap>>();
  private readonly rules: EventBusRouteRule<EventMap>[] = [];
  private readonly options: EventBusRouterOptions;
  private routedCount = 0;
  private droppedCount = 0;

  public constructor(
    source: EventBus<EventMap>,
    options: EventBusRouterOptions = {},
  ) {
    this.source = source;
    this.options = options;

    this.source.onAny((envelope) => {
      this.routeEnvelope(envelope);
    });
  }

  public addRoute(name: string, bus: EventBus<EventMap>): this {
    this.routes.set(name, bus);
    return this;
  }

  public removeRoute(name: string): boolean {
    return this.routes.delete(name);
  }

  public addRule(rule: EventBusRouteRule<EventMap>): this {
    this.rules.push(rule);
    return this;
  }

  public getRoute(name: string): EventBus<EventMap> | null {
    return this.routes.get(name) ?? null;
  }

  public listRoutes(): string[] {
    return [...this.routes.keys()];
  }

  public getStats(): { routedCount: number; droppedCount: number; routeNames: string[] } {
    return {
      routedCount: this.routedCount,
      droppedCount: this.droppedCount,
      routeNames: this.listRoutes(),
    };
  }

  public getSource(): EventBus<EventMap> {
    return this.source;
  }

  private routeEnvelope(
    envelope: EventEnvelope<keyof EventMap, EventMap[keyof EventMap]>,
  ): void {
    let routeName: string | null = null;

    for (const rule of this.rules) {
      const result = rule(envelope);
      if (result !== null) {
        routeName = result;
        break;
      }
    }

    if (routeName === null) {
      routeName = this.options.defaultRoute ?? null;
    }

    if (routeName === null || !this.routes.has(routeName)) {
      if (!this.options.dropUnrouted) {
        this.droppedCount++;
      }
      return;
    }

    const target = this.routes.get(routeName)!;
    target.emit(
      envelope.event,
      envelope.payload as EventMap[typeof envelope.event],
      { emittedAtTick: envelope.emittedAtTick, tags: envelope.tags },
    );
    this.routedCount++;
  }
}

// ============================================================================
// MARK: EventBusMirror — bidirectional event mirroring
// ============================================================================

export interface EventBusMirrorOptions {
  readonly mirrorTags?: readonly string[];
  readonly direction?: 'A_TO_B' | 'B_TO_A' | 'BIDIRECTIONAL';
}

export class EventBusMirror<EventMap extends Record<string, unknown>> {
  private readonly busA: EventBus<EventMap>;
  private readonly busB: EventBus<EventMap>;
  private readonly options: EventBusMirrorOptions;
  private mirrored = 0;
  private looping = false;

  public constructor(
    busA: EventBus<EventMap>,
    busB: EventBus<EventMap>,
    options: EventBusMirrorOptions = {},
  ) {
    this.busA = busA;
    this.busB = busB;
    this.options = options;
    const direction = options.direction ?? 'BIDIRECTIONAL';

    if (direction === 'A_TO_B' || direction === 'BIDIRECTIONAL') {
      busA.onAny((env) => {
        if (this.looping) return;
        this.looping = true;
        busB.emit(
          env.event,
          env.payload as EventMap[typeof env.event],
          {
            emittedAtTick: env.emittedAtTick,
            tags: options.mirrorTags
              ? [...(env.tags ?? []), ...options.mirrorTags]
              : env.tags,
          },
        );
        this.looping = false;
        this.mirrored++;
      });
    }

    if (direction === 'B_TO_A' || direction === 'BIDIRECTIONAL') {
      busB.onAny((env) => {
        if (this.looping) return;
        this.looping = true;
        busA.emit(
          env.event,
          env.payload as EventMap[typeof env.event],
          {
            emittedAtTick: env.emittedAtTick,
            tags: options.mirrorTags
              ? [...(env.tags ?? []), ...options.mirrorTags]
              : env.tags,
          },
        );
        this.looping = false;
        this.mirrored++;
      });
    }
  }

  public getMirroredCount(): number {
    return this.mirrored;
  }

  public getBusA(): EventBus<EventMap> {
    return this.busA;
  }

  public getBusB(): EventBus<EventMap> {
    return this.busB;
  }

  public getDirection(): EventBusMirrorOptions['direction'] {
    return this.options.direction ?? 'BIDIRECTIONAL';
  }
}

// ============================================================================
// MARK: EventBusAnalytics — frequency, timing, and pattern analysis
// ============================================================================

export interface EventFrequencyRecord {
  readonly event: string;
  readonly count: number;
  readonly firstSeenAt: number;
  readonly lastSeenAt: number;
  readonly avgIntervalMs: number;
  readonly minIntervalMs: number;
  readonly maxIntervalMs: number;
}

export interface EventBusAnalyticsReport {
  readonly totalEvents: number;
  readonly uniqueEvents: number;
  readonly topEvents: ReadonlyArray<EventFrequencyRecord>;
  readonly quietEvents: ReadonlyArray<EventFrequencyRecord>;
  readonly eventRate: number;
  readonly burstPeakCount: number;
  readonly burstWindowMs: number;
  readonly observedSinceMs: number;
  readonly healthStatus: 'HEALTHY' | 'OVERLOADED' | 'QUIET' | 'IDLE';
}

export interface EventBusAnalyticsOptions {
  readonly maxTrackedEvents?: number;
  readonly burstWindowMs?: number;
  readonly overloadThresholdPerSecond?: number;
}

export class EventBusAnalytics<EventMap extends Record<string, unknown>> {
  private readonly frequency = new Map<string, {
    count: number;
    firstSeenAt: number;
    lastSeenAt: number;
    intervals: number[];
  }>();
  private readonly recentTimestamps: number[] = [];
  private readonly maxTrackedEvents: number;
  private readonly burstWindowMs: number;
  private readonly overloadThresholdPerSecond: number;
  private readonly observedSinceMs: number;
  private burstPeakCount = 0;

  public constructor(
    bus: EventBus<EventMap>,
    options: EventBusAnalyticsOptions = {},
  ) {
    this.maxTrackedEvents = options.maxTrackedEvents ?? 256;
    this.burstWindowMs = options.burstWindowMs ?? 1_000;
    this.overloadThresholdPerSecond = options.overloadThresholdPerSecond ?? 500;
    this.observedSinceMs = Date.now();

    bus.onAny((envelope) => {
      this.recordEvent(String(envelope.event));
    });
  }

  private recordEvent(eventName: string): void {
    const now = Date.now();
    let rec = this.frequency.get(eventName);

    if (!rec) {
      if (this.frequency.size >= this.maxTrackedEvents) return;
      rec = { count: 0, firstSeenAt: now, lastSeenAt: now, intervals: [] };
      this.frequency.set(eventName, rec);
    } else {
      const interval = now - rec.lastSeenAt;
      rec.intervals.push(interval);
      if (rec.intervals.length > 100) rec.intervals.splice(0, 1);
      rec.lastSeenAt = now;
    }
    rec.count++;

    this.recentTimestamps.push(now);
    this.trimRecentTimestamps(now);
    if (this.recentTimestamps.length > this.burstPeakCount) {
      this.burstPeakCount = this.recentTimestamps.length;
    }
  }

  private trimRecentTimestamps(now: number): void {
    const cutoff = now - this.burstWindowMs;
    while (this.recentTimestamps.length > 0 && this.recentTimestamps[0] < cutoff) {
      this.recentTimestamps.shift();
    }
  }

  public buildReport(): EventBusAnalyticsReport {
    const now = Date.now();
    this.trimRecentTimestamps(now);

    const records: EventFrequencyRecord[] = [];
    for (const [event, rec] of this.frequency) {
      const intervals = rec.intervals;
      const avgInterval = intervals.length === 0 ? 0 :
        intervals.reduce((a, b) => a + b, 0) / intervals.length;
      records.push({
        event,
        count: rec.count,
        firstSeenAt: rec.firstSeenAt,
        lastSeenAt: rec.lastSeenAt,
        avgIntervalMs: avgInterval,
        minIntervalMs: intervals.length === 0 ? 0 : Math.min(...intervals),
        maxIntervalMs: intervals.length === 0 ? 0 : Math.max(...intervals),
      });
    }

    const sorted = [...records].sort((a, b) => b.count - a.count);
    const elapsedSeconds = Math.max(1, (now - this.observedSinceMs) / 1_000);
    const totalEvents = records.reduce((s, r) => s + r.count, 0);
    const eventRate = totalEvents / elapsedSeconds;
    const recentRate = this.recentTimestamps.length / (this.burstWindowMs / 1_000);

    let healthStatus: EventBusAnalyticsReport['healthStatus'];
    if (recentRate > this.overloadThresholdPerSecond) healthStatus = 'OVERLOADED';
    else if (eventRate > 1) healthStatus = 'HEALTHY';
    else if (totalEvents > 0) healthStatus = 'QUIET';
    else healthStatus = 'IDLE';

    return {
      totalEvents,
      uniqueEvents: records.length,
      topEvents: sorted.slice(0, 10),
      quietEvents: sorted.slice(-5).reverse(),
      eventRate,
      burstPeakCount: this.burstPeakCount,
      burstWindowMs: this.burstWindowMs,
      observedSinceMs: this.observedSinceMs,
      healthStatus,
    };
  }

  public getFrequency(eventName: string): number {
    return this.frequency.get(eventName)?.count ?? 0;
  }

  public getMostFrequentEvent(): string | null {
    let max = 0;
    let result: string | null = null;
    for (const [event, rec] of this.frequency) {
      if (rec.count > max) {
        max = rec.count;
        result = event;
      }
    }
    return result;
  }

  public isOverloaded(): boolean {
    const now = Date.now();
    this.trimRecentTimestamps(now);
    return (this.recentTimestamps.length / (this.burstWindowMs / 1_000)) > this.overloadThresholdPerSecond;
  }

  public reset(): void {
    this.frequency.clear();
    this.recentTimestamps.length = 0;
    this.burstPeakCount = 0;
  }
}

// ============================================================================
// MARK: EventBusThrottle — rate-limit emission per event type
// ============================================================================

export interface EventBusThrottleOptions {
  readonly intervalMs: number;
  readonly leading?: boolean;
  readonly trailing?: boolean;
}

export class EventBusThrottle<EventMap extends Record<string, unknown>> {
  private readonly source: EventBus<EventMap>;
  private readonly sink: EventBus<EventMap>;
  private readonly intervalMs: number;
  private readonly leading: boolean;
  private readonly trailing: boolean;
  private readonly lastEmit = new Map<string, number>();
  private readonly pendingTrailing = new Map<string, {
    envelope: EventEnvelope<keyof EventMap, EventMap[keyof EventMap]>;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private throttledCount = 0;
  private passedCount = 0;

  public constructor(
    source: EventBus<EventMap>,
    sink: EventBus<EventMap>,
    options: EventBusThrottleOptions,
  ) {
    this.source = source;
    this.sink = sink;
    this.intervalMs = options.intervalMs;
    this.leading = options.leading ?? true;
    this.trailing = options.trailing ?? false;

    this.source.onAny((envelope) => {
      this.handleEnvelope(envelope);
    });
  }

  private handleEnvelope(
    envelope: EventEnvelope<keyof EventMap, EventMap[keyof EventMap]>,
  ): void {
    const key = String(envelope.event);
    const now = Date.now();
    const last = this.lastEmit.get(key) ?? 0;
    const elapsed = now - last;

    if (elapsed >= this.intervalMs) {
      if (this.leading) {
        this.doEmit(envelope);
        this.lastEmit.set(key, now);
        this.passedCount++;
      }

      const pending = this.pendingTrailing.get(key);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingTrailing.delete(key);
      }
    } else {
      this.throttledCount++;

      if (this.trailing) {
        const pending = this.pendingTrailing.get(key);
        if (pending) {
          clearTimeout(pending.timer);
        }

        const remaining = this.intervalMs - elapsed;
        const timer = setTimeout(() => {
          this.doEmit(envelope);
          this.lastEmit.set(key, Date.now());
          this.pendingTrailing.delete(key);
          this.passedCount++;
        }, remaining);

        this.pendingTrailing.set(key, { envelope, timer });
      }
    }
  }

  private doEmit(
    envelope: EventEnvelope<keyof EventMap, EventMap[keyof EventMap]>,
  ): void {
    this.sink.emit(
      envelope.event,
      envelope.payload as EventMap[typeof envelope.event],
      { emittedAtTick: envelope.emittedAtTick, tags: envelope.tags },
    );
  }

  public getStats(): { throttledCount: number; passedCount: number; throttleRate: number } {
    const total = this.throttledCount + this.passedCount;
    return {
      throttledCount: this.throttledCount,
      passedCount: this.passedCount,
      throttleRate: total === 0 ? 0 : this.throttledCount / total,
    };
  }

  public getSource(): EventBus<EventMap> {
    return this.source;
  }

  public getSink(): EventBus<EventMap> {
    return this.sink;
  }

  public flush(): void {
    for (const [, pending] of this.pendingTrailing) {
      clearTimeout(pending.timer);
      this.doEmit(pending.envelope);
      this.passedCount++;
    }
    this.pendingTrailing.clear();
  }

  public reset(): void {
    this.throttledCount = 0;
    this.passedCount = 0;
    this.lastEmit.clear();
    for (const [, pending] of this.pendingTrailing) {
      clearTimeout(pending.timer);
    }
    this.pendingTrailing.clear();
  }
}

// ============================================================================
// MARK: EventBusDebounce — debounce rapid event emission
// ============================================================================

export interface EventBusDebounceOptions {
  readonly waitMs: number;
  readonly maxWaitMs?: number;
}

export class EventBusDebounce<EventMap extends Record<string, unknown>> {
  private readonly source: EventBus<EventMap>;
  private readonly sink: EventBus<EventMap>;
  private readonly waitMs: number;
  private readonly maxWaitMs: number | null;
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly firstSeenAt = new Map<string, number>();
  private readonly pendingEnvelopes = new Map<
    string,
    EventEnvelope<keyof EventMap, EventMap[keyof EventMap]>
  >();
  private debouncedCount = 0;
  private firedCount = 0;

  public constructor(
    source: EventBus<EventMap>,
    sink: EventBus<EventMap>,
    options: EventBusDebounceOptions,
  ) {
    this.source = source;
    this.sink = sink;
    this.waitMs = options.waitMs;
    this.maxWaitMs = options.maxWaitMs ?? null;

    this.source.onAny((envelope) => {
      this.handleEnvelope(envelope);
    });
  }

  private handleEnvelope(
    envelope: EventEnvelope<keyof EventMap, EventMap[keyof EventMap]>,
  ): void {
    const key = String(envelope.event);
    const now = Date.now();

    this.pendingEnvelopes.set(key, envelope);

    const existing = this.timers.get(key);
    if (existing) {
      clearTimeout(existing);
      this.debouncedCount++;
    } else {
      this.firstSeenAt.set(key, now);
    }

    const first = this.firstSeenAt.get(key) ?? now;
    const elapsed = now - first;

    if (this.maxWaitMs !== null && elapsed >= this.maxWaitMs) {
      this.firePending(key);
      return;
    }

    const timer = setTimeout(() => {
      this.firePending(key);
    }, this.waitMs);

    this.timers.set(key, timer);
  }

  private firePending(key: string): void {
    const pending = this.pendingEnvelopes.get(key);
    if (!pending) return;

    this.sink.emit(
      pending.event,
      pending.payload as EventMap[typeof pending.event],
      { emittedAtTick: pending.emittedAtTick, tags: pending.tags },
    );
    this.firedCount++;

    this.timers.delete(key);
    this.pendingEnvelopes.delete(key);
    this.firstSeenAt.delete(key);
  }

  public flushAll(): void {
    for (const key of [...this.timers.keys()]) {
      clearTimeout(this.timers.get(key)!);
      this.timers.delete(key);
      this.firePending(key);
    }
  }

  public getStats(): { debouncedCount: number; firedCount: number; pendingCount: number } {
    return {
      debouncedCount: this.debouncedCount,
      firedCount: this.firedCount,
      pendingCount: this.pendingEnvelopes.size,
    };
  }

  public getSource(): EventBus<EventMap> {
    return this.source;
  }

  public getSink(): EventBus<EventMap> {
    return this.sink;
  }

  public reset(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.pendingEnvelopes.clear();
    this.firstSeenAt.clear();
    this.debouncedCount = 0;
    this.firedCount = 0;
  }
}

// ============================================================================
// MARK: EventBusMLBridge — route events to ML/DL inference pipeline
// ============================================================================

export interface MLEventRecord {
  readonly eventName: string;
  readonly sequenceNumber: number;
  readonly tick?: number;
  readonly featureVector: readonly number[];
  readonly timestamp: number;
  readonly tags: readonly string[];
}

export interface EventBusMLBridgeOptions {
  readonly featureExtractor?: (
    eventName: string,
    payload: unknown,
    tick: number | undefined,
  ) => readonly number[];
  readonly maxBufferSize?: number;
  readonly onMLRecord?: (record: MLEventRecord) => void;
}

export class EventBusMLBridge<EventMap extends Record<string, unknown>> {
  private readonly bus: EventBus<EventMap>;
  private readonly mlBuffer: MLEventRecord[] = [];
  private readonly maxBufferSize: number;
  private readonly featureExtractor: (eventName: string, payload: unknown, tick: number | undefined) => readonly number[];
  private readonly onMLRecord?: (record: MLEventRecord) => void;
  private totalRecorded = 0;

  public constructor(
    bus: EventBus<EventMap>,
    options: EventBusMLBridgeOptions = {},
  ) {
    this.bus = bus;
    this.maxBufferSize = options.maxBufferSize ?? 1_024;
    this.featureExtractor = options.featureExtractor ?? EventBusMLBridge.defaultFeatureExtractor;
    this.onMLRecord = options.onMLRecord;

    this.bus.onAny((envelope) => {
      this.recordMLEvent(envelope);
    });
  }

  private static defaultFeatureExtractor(
    eventName: string,
    _payload: unknown,
    tick: number | undefined,
  ): readonly number[] {
    // Default 8-feature vector: event hash normalized, tick normalized, zeros for context
    const nameHash = eventName.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) & 0xFFFFFF, 0);
    return [
      (nameHash % 1024) / 1024,
      Math.min(1, (tick ?? 0) / 1000),
      0, 0, 0, 0, 0, 0,
    ];
  }

  private recordMLEvent(
    envelope: EventEnvelope<keyof EventMap, EventMap[keyof EventMap]>,
  ): void {
    const featureVector = this.featureExtractor(
      String(envelope.event),
      envelope.payload,
      envelope.emittedAtTick,
    );

    const record: MLEventRecord = {
      eventName: String(envelope.event),
      sequenceNumber: envelope.sequence,
      tick: envelope.emittedAtTick,
      featureVector,
      timestamp: Date.now(),
      tags: envelope.tags ? [...envelope.tags] : [],
    };

    this.mlBuffer.push(record);
    this.totalRecorded++;

    if (this.mlBuffer.length > this.maxBufferSize) {
      this.mlBuffer.splice(0, this.mlBuffer.length - this.maxBufferSize);
    }

    this.onMLRecord?.(record);
  }

  public drainMLBuffer(): MLEventRecord[] {
    const drained = [...this.mlBuffer];
    this.mlBuffer.length = 0;
    return drained;
  }

  public getMLBuffer(): ReadonlyArray<MLEventRecord> {
    return [...this.mlBuffer];
  }

  public getMLBufferForEvent(eventName: string): MLEventRecord[] {
    return this.mlBuffer.filter((r) => r.eventName === eventName);
  }

  public buildMLFeatureMatrix(): number[][] {
    return this.mlBuffer.map((r) => [...r.featureVector]);
  }

  public getBus(): EventBus<EventMap> {
    return this.bus;
  }

  public getStats(): { bufferedCount: number; totalRecorded: number; uniqueEvents: number } {
    const uniqueEvents = new Set(this.mlBuffer.map((r) => r.eventName)).size;
    return { bufferedCount: this.mlBuffer.length, totalRecorded: this.totalRecorded, uniqueEvents };
  }

  public reset(): void {
    this.mlBuffer.length = 0;
    this.totalRecorded = 0;
  }
}

// ============================================================================
// MARK: EventBusHealthMonitor — monitor bus health and emit alerts
// ============================================================================

export type EventBusHealthStatus = 'HEALTHY' | 'DEGRADED' | 'OVERLOADED' | 'STALLED' | 'CRITICAL';

export interface EventBusHealthReport {
  readonly status: EventBusHealthStatus;
  readonly queueDepth: number;
  readonly historySize: number;
  readonly listenerCount: number;
  readonly eventsPerSecond: number;
  readonly isOverloaded: boolean;
  readonly isStalled: boolean;
  readonly uptimeMs: number;
  readonly lastEventAt: number;
  readonly recommendations: readonly string[];
}

export interface EventBusHealthMonitorOptions {
  readonly overloadThreshold?: number;
  readonly stallThresholdMs?: number;
  readonly maxQueueDepthWarning?: number;
}

export class EventBusHealthMonitor<EventMap extends Record<string, unknown>> {
  private readonly bus: EventBus<EventMap>;
  private readonly analytics: EventBusAnalytics<EventMap>;
  private readonly options: Required<EventBusHealthMonitorOptions>;
  private readonly startedAt: number;
  private lastEventAt: number;
  private readonly alertListeners: Array<(report: EventBusHealthReport) => void> = [];

  public constructor(
    bus: EventBus<EventMap>,
    analytics: EventBusAnalytics<EventMap>,
    options: EventBusHealthMonitorOptions = {},
  ) {
    this.bus = bus;
    this.analytics = analytics;
    this.options = {
      overloadThreshold: options.overloadThreshold ?? 1_000,
      stallThresholdMs: options.stallThresholdMs ?? 30_000,
      maxQueueDepthWarning: options.maxQueueDepthWarning ?? 2_048,
    };
    this.startedAt = Date.now();
    this.lastEventAt = this.startedAt;

    this.bus.onAny(() => {
      this.lastEventAt = Date.now();
    });
  }

  public buildHealthReport(): EventBusHealthReport {
    const now = Date.now();
    const analyticsReport = this.analytics.buildReport();
    const queueDepth = this.bus.queuedCount();
    const historySize = this.bus.historyCount();
    const listenerCount = this.bus.listenerCount();
    const eventsPerSecond = analyticsReport.eventRate;
    const isOverloaded = eventsPerSecond > this.options.overloadThreshold;
    const isStalled = (now - this.lastEventAt) > this.options.stallThresholdMs && analyticsReport.totalEvents > 0;
    const uptimeMs = now - this.startedAt;

    const recommendations: string[] = [];
    if (isOverloaded) recommendations.push('Reduce event emission rate or add throttling.');
    if (isStalled) recommendations.push('Bus may be stalled — check emitters and engine tick loop.');
    if (queueDepth >= this.options.maxQueueDepthWarning) {
      recommendations.push(`Queue depth at ${queueDepth} — flush or increase maxQueueSize.`);
    }
    if (listenerCount === 0 && analyticsReport.totalEvents > 0) {
      recommendations.push('Events emitting with no listeners — check subscription wiring.');
    }

    let status: EventBusHealthStatus;
    if (isOverloaded && isStalled) status = 'CRITICAL';
    else if (isOverloaded) status = 'OVERLOADED';
    else if (isStalled) status = 'STALLED';
    else if (recommendations.length > 0) status = 'DEGRADED';
    else status = 'HEALTHY';

    const report: EventBusHealthReport = {
      status,
      queueDepth,
      historySize,
      listenerCount,
      eventsPerSecond,
      isOverloaded,
      isStalled,
      uptimeMs,
      lastEventAt: this.lastEventAt,
      recommendations: Object.freeze(recommendations),
    };

    if (status !== 'HEALTHY') {
      for (const listener of [...this.alertListeners]) {
        listener(report);
      }
    }

    return report;
  }

  public onAlert(listener: (report: EventBusHealthReport) => void): () => void {
    this.alertListeners.push(listener);
    return () => {
      const idx = this.alertListeners.indexOf(listener);
      if (idx >= 0) this.alertListeners.splice(idx, 1);
    };
  }

  public getBus(): EventBus<EventMap> {
    return this.bus;
  }

  public getAnalytics(): EventBusAnalytics<EventMap> {
    return this.analytics;
  }

  public isHealthy(): boolean {
    return this.buildHealthReport().status === 'HEALTHY';
  }
}

// ============================================================================
// MARK: EventBusBroadcaster — fan out events to multiple buses
// ============================================================================

export interface EventBusBroadcasterOptions {
  readonly failFast?: boolean;
  readonly addBroadcastTag?: boolean;
}

export class EventBusBroadcaster<EventMap extends Record<string, unknown>> {
  private readonly targets: EventBus<EventMap>[] = [];
  private readonly options: EventBusBroadcasterOptions;
  private broadcastCount = 0;
  private errorCount = 0;

  public constructor(options: EventBusBroadcasterOptions = {}) {
    this.options = options;
  }

  public addTarget(bus: EventBus<EventMap>): this {
    this.targets.push(bus);
    return this;
  }

  public removeTarget(bus: EventBus<EventMap>): boolean {
    const idx = this.targets.indexOf(bus);
    if (idx < 0) return false;
    this.targets.splice(idx, 1);
    return true;
  }

  public broadcast<K extends keyof EventMap>(
    event: K,
    payload: EventMap[K],
    options: EmitOptions = {},
  ): number {
    const emitOptions: EmitOptions = this.options.addBroadcastTag
      ? { ...options, tags: [...(options.tags ?? []), 'broadcast'] }
      : options;

    let successCount = 0;
    for (const target of this.targets) {
      try {
        target.emit(event, payload, emitOptions);
        successCount++;
        this.broadcastCount++;
      } catch (err) {
        this.errorCount++;
        if (this.options.failFast) throw err;
      }
    }
    return successCount;
  }

  public getTargetCount(): number {
    return this.targets.length;
  }

  public getStats(): { broadcastCount: number; errorCount: number; targetCount: number } {
    return {
      broadcastCount: this.broadcastCount,
      errorCount: this.errorCount,
      targetCount: this.targets.length,
    };
  }

  public reset(): void {
    this.broadcastCount = 0;
    this.errorCount = 0;
  }
}

// ============================================================================
// MARK: EventBusWatcher — watch for specific event patterns
// ============================================================================

export interface WatcherPattern<EventMap extends Record<string, unknown>> {
  readonly events: ReadonlyArray<keyof EventMap>;
  readonly minCount?: number;
  readonly withinMs?: number;
}

export interface WatcherMatch<EventMap extends Record<string, unknown>> {
  readonly pattern: WatcherPattern<EventMap>;
  readonly matchedEnvelopes: ReadonlyArray<EventEnvelope<keyof EventMap, EventMap[keyof EventMap]>>;
  readonly matchedAt: number;
}

export class EventBusWatcher<EventMap extends Record<string, unknown>> {
  private readonly bus: EventBus<EventMap>;
  private readonly patterns: WatcherPattern<EventMap>[];
  private readonly matchListeners: Array<(match: WatcherMatch<EventMap>) => void> = [];
  private readonly eventBuffer: Array<{ envelope: EventEnvelope<keyof EventMap, EventMap[keyof EventMap]>; capturedAt: number }> = [];
  private readonly maxBufferSize: number;

  public constructor(
    bus: EventBus<EventMap>,
    options: { maxBufferSize?: number } = {},
  ) {
    this.bus = bus;
    this.patterns = [];
    this.maxBufferSize = options.maxBufferSize ?? 512;

    this.bus.onAny((envelope) => {
      const now = Date.now();
      this.eventBuffer.push({ envelope, capturedAt: now });
      if (this.eventBuffer.length > this.maxBufferSize) {
        this.eventBuffer.splice(0, this.eventBuffer.length - this.maxBufferSize);
      }
      this.checkPatterns(now);
    });
  }

  public addPattern(pattern: WatcherPattern<EventMap>): this {
    this.patterns.push(pattern);
    return this;
  }

  public onMatch(listener: (match: WatcherMatch<EventMap>) => void): () => void {
    this.matchListeners.push(listener);
    return () => {
      const idx = this.matchListeners.indexOf(listener);
      if (idx >= 0) this.matchListeners.splice(idx, 1);
    };
  }

  private checkPatterns(now: number): void {
    for (const pattern of this.patterns) {
      const windowStart = pattern.withinMs ? now - pattern.withinMs : 0;
      const relevant = this.eventBuffer.filter(
        (e) => e.capturedAt >= windowStart && pattern.events.includes(e.envelope.event),
      );
      const minCount = pattern.minCount ?? pattern.events.length;
      if (relevant.length >= minCount) {
        const match: WatcherMatch<EventMap> = {
          pattern,
          matchedEnvelopes: relevant.map((e) => e.envelope),
          matchedAt: now,
        };
        for (const listener of [...this.matchListeners]) {
          listener(match);
        }
      }
    }
  }

  public getBus(): EventBus<EventMap> {
    return this.bus;
  }

  public getBufferSize(): number {
    return this.eventBuffer.length;
  }

  public clearBuffer(): void {
    this.eventBuffer.length = 0;
  }
}

// ============================================================================
// MARK: EventBusAggregator — merge multiple buses into one view
// ============================================================================

export interface AggregatorEntry<EventMap extends Record<string, unknown>> {
  readonly busId: string;
  readonly bus: EventBus<EventMap>;
  readonly alias?: string;
}

export class EventBusAggregator<EventMap extends Record<string, unknown>> {
  private readonly entries: AggregatorEntry<EventMap>[] = [];
  private readonly sink: EventBus<EventMap>;
  private readonly unsubscribers: Array<() => void> = [];
  private aggregatedCount = 0;

  public constructor(sink: EventBus<EventMap>) {
    this.sink = sink;
  }

  public addBus(busId: string, bus: EventBus<EventMap>, alias?: string): this {
    this.entries.push({ busId, bus, alias });

    const unsub = bus.onAny((envelope) => {
      const tags = envelope.tags
        ? [...envelope.tags, `aggregated:${busId}`]
        : [`aggregated:${busId}`];

      this.sink.emit(
        envelope.event,
        envelope.payload as EventMap[typeof envelope.event],
        { emittedAtTick: envelope.emittedAtTick, tags },
      );
      this.aggregatedCount++;
    });

    this.unsubscribers.push(unsub);
    return this;
  }

  public getSink(): EventBus<EventMap> {
    return this.sink;
  }

  public getBusCount(): number {
    return this.entries.length;
  }

  public listBusIds(): string[] {
    return this.entries.map((e) => e.busId);
  }

  public getStats(): { aggregatedCount: number; busCount: number } {
    return { aggregatedCount: this.aggregatedCount, busCount: this.entries.length };
  }

  public detachAll(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers.length = 0;
    this.entries.length = 0;
  }
}

// ============================================================================
// MARK: EventBusSubscriberRegistry — manage subscriptions with cleanup
// ============================================================================

export interface SubscriberRegistration<EventMap extends Record<string, unknown>> {
  readonly id: string;
  readonly event: keyof EventMap | 'any';
  readonly subscribedAt: number;
  readonly unsubscribe: () => void;
}

export class EventBusSubscriberRegistry<EventMap extends Record<string, unknown>> {
  private readonly bus: EventBus<EventMap>;
  private readonly registrations = new Map<string, SubscriberRegistration<EventMap>>();
  private idCounter = 0;

  public constructor(bus: EventBus<EventMap>) {
    this.bus = bus;
  }

  public subscribe<K extends keyof EventMap>(
    event: K,
    listener: Listener<EventMap[K]>,
    id?: string,
  ): string {
    const regId = id ?? `sub-${++this.idCounter}`;
    const unsubscribe = this.bus.on(event, listener);
    this.registrations.set(regId, {
      id: regId,
      event,
      subscribedAt: Date.now(),
      unsubscribe,
    });
    return regId;
  }

  public subscribeAny(
    listener: AnyEventListener<EventMap>,
    id?: string,
  ): string {
    const regId = id ?? `sub-any-${++this.idCounter}`;
    const unsubscribe = this.bus.onAny(listener);
    this.registrations.set(regId, {
      id: regId,
      event: 'any',
      subscribedAt: Date.now(),
      unsubscribe,
    });
    return regId;
  }

  public unsubscribe(id: string): boolean {
    const reg = this.registrations.get(id);
    if (!reg) return false;
    reg.unsubscribe();
    this.registrations.delete(id);
    return true;
  }

  public unsubscribeAll(): void {
    for (const reg of this.registrations.values()) {
      reg.unsubscribe();
    }
    this.registrations.clear();
  }

  public unsubscribeEvent(event: keyof EventMap): void {
    for (const [id, reg] of this.registrations) {
      if (reg.event === event) {
        reg.unsubscribe();
        this.registrations.delete(id);
      }
    }
  }

  public listRegistrations(): ReadonlyArray<Omit<SubscriberRegistration<EventMap>, 'unsubscribe'>> {
    return [...this.registrations.values()].map(({ id, event, subscribedAt }) => ({
      id,
      event,
      subscribedAt,
      unsubscribe: () => { /* excluded from list */ },
    }));
  }

  public has(id: string): boolean {
    return this.registrations.has(id);
  }

  public count(): number {
    return this.registrations.size;
  }

  public getBus(): EventBus<EventMap> {
    return this.bus;
  }
}

// ============================================================================
// MARK: EventPipeline — chain event transformers
// ============================================================================

export type EventTransformer<EventMap extends Record<string, unknown>> = (
  envelope: EventEnvelope<keyof EventMap, EventMap[keyof EventMap]>,
) => EventEnvelope<keyof EventMap, EventMap[keyof EventMap]> | null;

export class EventPipeline<EventMap extends Record<string, unknown>> {
  private readonly source: EventBus<EventMap>;
  private readonly sink: EventBus<EventMap>;
  private readonly transformers: EventTransformer<EventMap>[] = [];
  private processedCount = 0;
  private droppedCount = 0;

  public constructor(
    source: EventBus<EventMap>,
    sink: EventBus<EventMap>,
  ) {
    this.source = source;
    this.sink = sink;

    this.source.onAny((envelope) => {
      this.processEnvelope(envelope);
    });
  }

  public addTransformer(transformer: EventTransformer<EventMap>): this {
    this.transformers.push(transformer);
    return this;
  }

  private processEnvelope(
    envelope: EventEnvelope<keyof EventMap, EventMap[keyof EventMap]>,
  ): void {
    let current: EventEnvelope<keyof EventMap, EventMap[keyof EventMap]> | null = envelope;

    for (const transformer of this.transformers) {
      if (current === null) break;
      current = transformer(current);
    }

    if (current === null) {
      this.droppedCount++;
      return;
    }

    this.sink.emit(
      current.event,
      current.payload as EventMap[typeof current.event],
      { emittedAtTick: current.emittedAtTick, tags: current.tags },
    );
    this.processedCount++;
  }

  public getStats(): { processedCount: number; droppedCount: number } {
    return { processedCount: this.processedCount, droppedCount: this.droppedCount };
  }

  public getSource(): EventBus<EventMap> {
    return this.source;
  }

  public getSink(): EventBus<EventMap> {
    return this.sink;
  }
}

// ============================================================================
// MARK: EventBusStats — snapshot statistics for a bus
// ============================================================================

export interface EventBusStats {
  readonly queuedCount: number;
  readonly historyCount: number;
  readonly listenerCount: number;
  readonly registeredEventCount: number;
  readonly sequenceHighWater: number;
}

export function buildEventBusStats<EventMap extends Record<string, unknown>>(
  bus: EventBus<EventMap>,
  sequenceHighWater: number,
): EventBusStats {
  return Object.freeze({
    queuedCount: bus.queuedCount(),
    historyCount: bus.historyCount(),
    listenerCount: bus.listenerCount(),
    registeredEventCount: bus.getRegisteredEvents().length,
    sequenceHighWater,
  });
}

// ============================================================================
// MARK: EventBusInspector — deep inspection of bus state for diagnostics
// ============================================================================

export interface EventBusInspectorReport<EventMap extends Record<string, unknown>> {
  readonly stats: EventBusStats;
  readonly analyticsReport: EventBusAnalyticsReport;
  readonly healthReport: EventBusHealthReport;
  readonly recentHistory: ReadonlyArray<EventEnvelope<keyof EventMap, EventMap[keyof EventMap]>>;
  readonly topListenedEvents: string[];
  readonly capturedAt: number;
}

export class EventBusInspector<EventMap extends Record<string, unknown>> {
  private readonly bus: EventBus<EventMap>;
  private readonly analytics: EventBusAnalytics<EventMap>;
  private readonly healthMonitor: EventBusHealthMonitor<EventMap>;
  private sequenceHighWater = 0;

  public constructor(bus: EventBus<EventMap>) {
    this.bus = bus;
    this.analytics = new EventBusAnalytics<EventMap>(bus);
    this.healthMonitor = new EventBusHealthMonitor<EventMap>(bus, this.analytics);

    bus.onAny((envelope) => {
      if (envelope.sequence > this.sequenceHighWater) {
        this.sequenceHighWater = envelope.sequence;
      }
    });
  }

  public buildReport(): EventBusInspectorReport<EventMap> {
    const stats = buildEventBusStats(this.bus, this.sequenceHighWater);
    const analyticsReport = this.analytics.buildReport();
    const healthReport = this.healthMonitor.buildHealthReport();
    const recentHistory = this.bus.getHistory(20);
    const topListenedEvents = this.bus.getRegisteredEvents().map(String).slice(0, 10);

    return {
      stats,
      analyticsReport,
      healthReport,
      recentHistory,
      topListenedEvents,
      capturedAt: Date.now(),
    };
  }

  public getBus(): EventBus<EventMap> {
    return this.bus;
  }

  public getAnalytics(): EventBusAnalytics<EventMap> {
    return this.analytics;
  }

  public getHealthMonitor(): EventBusHealthMonitor<EventMap> {
    return this.healthMonitor;
  }

  public getSequenceHighWater(): number {
    return this.sequenceHighWater;
  }
}

// ============================================================================
// MARK: EventBusChatBridge — output contract for chat adapter consumption
// ============================================================================

export interface EventBusChatSignal {
  readonly signalId: string;
  readonly domain: 'EVENT_BUS';
  readonly kind:
    | 'BUS_OVERLOADED'
    | 'BUS_STALLED'
    | 'QUEUE_DEEP'
    | 'BURST_PEAK'
    | 'HEALTH_DEGRADED'
    | 'HIGH_FREQUENCY_EVENT'
    | 'LISTENER_DRIFT';
  readonly severity: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  readonly message: string;
  readonly details: Readonly<Record<string, unknown>>;
  readonly recommendation: string;
  readonly capturedAt: number;
}

export class EventBusChatBridge {
  private static nextId = 0;

  private static newId(): string {
    return `eb-signal-${++EventBusChatBridge.nextId}-${Date.now()}`;
  }

  static fromHealthReport(report: EventBusHealthReport): EventBusChatSignal | null {
    if (report.status === 'HEALTHY') return null;

    const kindMap: Record<EventBusHealthStatus, EventBusChatSignal['kind']> = {
      HEALTHY:    'HEALTH_DEGRADED',
      DEGRADED:   'HEALTH_DEGRADED',
      OVERLOADED: 'BUS_OVERLOADED',
      STALLED:    'BUS_STALLED',
      CRITICAL:   'BUS_OVERLOADED',
    };

    const severityMap: Record<EventBusHealthStatus, EventBusChatSignal['severity']> = {
      HEALTHY:    'INFO',
      DEGRADED:   'WARN',
      OVERLOADED: 'WARN',
      STALLED:    'ERROR',
      CRITICAL:   'CRITICAL',
    };

    return {
      signalId: EventBusChatBridge.newId(),
      domain: 'EVENT_BUS',
      kind: kindMap[report.status],
      severity: severityMap[report.status],
      message: `EventBus health: ${report.status}. Rate: ${report.eventsPerSecond.toFixed(1)}/s. Queue: ${report.queueDepth}.`,
      details: {
        status: report.status,
        queueDepth: report.queueDepth,
        eventsPerSecond: report.eventsPerSecond,
        listenerCount: report.listenerCount,
        uptimeMs: report.uptimeMs,
      },
      recommendation: report.recommendations[0] ?? 'No action required.',
      capturedAt: Date.now(),
    };
  }

  static fromAnalyticsReport(report: EventBusAnalyticsReport): EventBusChatSignal | null {
    if (report.healthStatus === 'IDLE' || report.healthStatus === 'QUIET') return null;
    if (report.burstPeakCount <= 50) return null;

    return {
      signalId: EventBusChatBridge.newId(),
      domain: 'EVENT_BUS',
      kind: 'BURST_PEAK',
      severity: report.healthStatus === 'OVERLOADED' ? 'WARN' : 'INFO',
      message: `EventBus burst peak: ${report.burstPeakCount} events in ${report.burstWindowMs}ms.`,
      details: {
        burstPeakCount: report.burstPeakCount,
        eventRate: report.eventRate,
        uniqueEvents: report.uniqueEvents,
        topEvent: report.topEvents[0]?.event ?? 'none',
      },
      recommendation: report.healthStatus === 'OVERLOADED'
        ? 'Add throttling or debouncing to high-frequency emitters.'
        : 'Normal burst activity.',
      capturedAt: Date.now(),
    };
  }
}

// ============================================================================
// MARK: EventBus ML feature labels and vector builder
// ============================================================================

export const EVENT_BUS_ML_FEATURE_LABELS: readonly string[] = [
  'queue_depth_normalized',       // 0
  'history_size_normalized',      // 1
  'listener_count_normalized',    // 2
  'event_rate_normalized',        // 3
  'burst_ratio',                  // 4
  'unique_event_diversity',       // 5
  'pass_rate_filter',             // 6
  'ml_buffer_fill',               // 7
  'health_score',                 // 8
  'throttle_rate',                // 9
  'debounce_pending_ratio',       // 10
  'aggregator_count_normalized',  // 11
  'broadcast_target_count',       // 12
  'pipeline_drop_rate',           // 13
  'stall_risk',                   // 14
  'overload_risk',                // 15
] as const;

export interface EventBusMLVector {
  readonly features: readonly number[];
  readonly featureLabels: readonly string[];
  readonly capturedAt: number;
}

export function buildEventBusMLVector(
  statsReport: EventBusAnalyticsReport,
  queueDepth: number,
  historySize: number,
  listenerCount: number,
  maxQueue = DEFAULT_MAX_QUEUE_SIZE,
  maxHistory = DEFAULT_MAX_HISTORY_SIZE,
): EventBusMLVector {
  const queueNorm = Math.min(1.0, queueDepth / maxQueue);
  const histNorm = Math.min(1.0, historySize / maxHistory);
  const listNorm = Math.min(1.0, listenerCount / 100);
  const rateNorm = Math.min(1.0, statsReport.eventRate / 1000);
  const burstRatio = Math.min(1.0, statsReport.burstPeakCount / 100);
  const diversity = Math.min(1.0, statsReport.uniqueEvents / 20);
  const healthScore = statsReport.healthStatus === 'HEALTHY' ? 1.0 :
    statsReport.healthStatus === 'QUIET' ? 0.4 :
    statsReport.healthStatus === 'IDLE' ? 0.2 : 0.0;
  const stall = statsReport.healthStatus === 'IDLE' ? 0.8 : 0.0;
  const overload = statsReport.healthStatus === 'OVERLOADED' ? 0.9 : 0.0;

  return {
    features: [
      queueNorm, histNorm, listNorm, rateNorm, burstRatio,
      diversity, 0, 0, healthScore, 0,
      0, 0, 0, 0, stall, overload,
    ],
    featureLabels: EVENT_BUS_ML_FEATURE_LABELS,
    capturedAt: Date.now(),
  };
}
