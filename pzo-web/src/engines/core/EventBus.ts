// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — CORE EVENT BUS (COMPATIBILITY BRIDGE + EXTENDED RUNTIME)
// pzo-web/src/engines/core/EventBus.ts
//
// Bridges zero/EventBus (Orchestrator, MechanicsRouter, MechanicsBridge) with
// the interface shape that BattleEngine, CascadeEngine, and other engines expect.
//
// STRATEGY: Extend zero/EventBus. Add:
//   - eventRegistry / handlers / registerEventChannels / register / unregister
//   - Middleware pipeline (EventMiddlewareFn) — transform or skip events pre-dispatch
//   - Event history ring buffer (EventHistoryEntry) — up to maxHistory entries
//   - Wildcard subscription — subscribe to ALL events with a single handler
//   - Dead-letter queue (DeadLetterEntry) — captures unhandled / skipped events
//   - BusHealthMetrics — observable telemetry surface
//   - Priority queue (EventPriority) — HIGH fires before NORMAL before LOW
//   - Event replay from history — deterministic replay for testing / debugging
//
// Do NOT override emit — the parent's generic signature is authoritative.
//
// Density6 LLC · Point Zero One · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import {
  EventBus as ZeroEventBus,
  sharedEventBus as zeroSharedEventBus,
} from '../zero/EventBus';

import type {
  BusHealthMetrics,
  EventHistoryEntry,
  EventPriority,
  EventMiddlewareContext,
  EventMiddlewareFn,
  DeadLetterEntry,
} from './types';

// ── Re-export types for downstream consumers ──────────────────────────────────
export type {
  BusHealthMetrics,
  EventHistoryEntry,
  EventPriority,
  EventMiddlewareContext,
  EventMiddlewareFn,
  DeadLetterEntry,
};

// ── Engine Event Name Registry ────────────────────────────────────────────────

// Re-export the doctrine-facing EngineEventName from types as the canonical export.
export type { EngineEventName } from './types';

// Internal bus event name type — superset that covers all mechanic/card/battle events
// plus an open string escape hatch. Not exported to avoid ambiguity with types.ts.
type BusEventName =
  | 'RUN_STARTED' | 'RUN_ENDED' | 'TICK_START' | 'TICK_COMPLETE' | 'TICK_STEP_ERROR'
  | 'TIME_TICK_ADVANCED' | 'TIME_TIER_CHANGED' | 'TIME_FREEZE_APPLIED'
  | 'TIME_FREEZE_EXPIRED' | 'TIME_HOLD_USED' | 'TIME_BUDGET_WARNING'
  | 'PRESSURE_SCORE_UPDATED' | 'PRESSURE_TIER_CHANGED' | 'PRESSURE_STAGNATION_WARNING'
  | 'TENSION_SCORE_UPDATED' | 'TENSION_QUEUE_UPDATED'
  | 'TENSION_THREAT_REVEALED' | 'TENSION_THREAT_HIDDEN'
  | 'SHIELD_DAMAGE_APPLIED' | 'SHIELD_LAYER_BREACHED' | 'SHIELD_REGEN_APPLIED'
  | 'SHIELD_INTEGRITY_UPDATED' | 'SHIELD_FORTIFIED' | 'SHIELD_CASCADE_TRIGGERED'
  | 'BATTLE_BOT_ACTIVATED' | 'BATTLE_BOT_DEACTIVATED' | 'BATTLE_ATTACK_FIRED'
  | 'BATTLE_ATTACK_BLOCKED' | 'BATTLE_HEAT_UPDATED' | 'BATTLE_PHASE_CHANGED'
  | 'BATTLE_WAVE_CHANGED'
  | 'CASCADE_CHAIN_STARTED' | 'CASCADE_LINK_EXECUTED'
  | 'CASCADE_CHAIN_BROKEN' | 'CASCADE_RECOVERY_TRIGGERED'
  | 'SOVEREIGNTY_SCORE_UPDATED' | 'SOVEREIGNTY_GRADE_ASSIGNED'
  | 'SOVEREIGNTY_PROOF_GENERATED' | 'SOVEREIGNTY_INTEGRITY_CHECK'
  | 'CARD_DRAWN' | 'CARD_PLAYED' | 'CARD_DISCARDED' | 'CARD_FORCED'
  | 'CARD_WINDOW_OPENED' | 'CARD_WINDOW_CLOSED' | 'CARD_WINDOW_EXPIRED'
  | 'CARD_HOLD_PLACED' | 'CARD_HOLD_RELEASED' | 'CARD_EFFECT_APPLIED'
  | 'MECHANIC_INCOME_DELTA' | 'MECHANIC_EXPENSE_DELTA' | 'MECHANIC_CASH_DELTA'
  | 'MECHANIC_NET_WORTH_DELTA' | 'MECHANIC_SHIELD_DELTA' | 'MECHANIC_HEAT_DELTA'
  | 'MECHANIC_PRESSURE_DELTA' | 'MECHANIC_TENSION_DELTA' | 'MECHANIC_CORD_DELTA'
  | 'MECHANIC_FREEZE_TICKS' | 'MECHANIC_CUSTOM_PAYLOAD' | 'MECHANIC_FIRED'
  | 'MECHANIC_CASCADE_LINK' | 'MECHANICS_TICK_COMPLETE'
  | (string & {});

export type EngineEventHandler = (payload: Record<string, unknown>) => void;

export interface EventChannelConfig {
  name:          BusEventName;
  description?:  string;
  maxListeners?: number;
  /** When true, events on this channel are captured in dead-letter if no subscribers. */
  trackDeadLetters?: boolean;
  /** Default priority for events emitted on this channel. */
  defaultPriority?: EventPriority;
}

// ── Priority-queued event entry ───────────────────────────────────────────────

interface PriorityQueueEntry {
  eventName: BusEventName;
  payload:   Record<string, unknown>;
  priority:  EventPriority;
  tickIndex: number;
  seqNum:    number;
}

const PRIORITY_ORDER: Record<EventPriority, number> = { HIGH: 0, NORMAL: 1, LOW: 2 };

// ── EventBus class ────────────────────────────────────────────────────────────

export class EventBus extends ZeroEventBus {

  // ── Channel registry ──────────────────────────────────────────────────────
  public readonly eventRegistry: Map<string, EventChannelConfig>  = new Map();
  public readonly handlers:      Map<string, EngineEventHandler[]> = new Map();

  // ── Middleware pipeline ───────────────────────────────────────────────────
  private readonly middlewares: EventMiddlewareFn[] = [];

  // ── Event history ring buffer ─────────────────────────────────────────────
  private readonly historyBuffer: EventHistoryEntry[] = [];
  private readonly maxHistory: number;
  private historySeqNum = 0;

  // ── Dead-letter queue ─────────────────────────────────────────────────────
  private readonly deadLetterQueue: DeadLetterEntry[] = [];
  private readonly maxDeadLetters: number;

  // ── Priority queue (dispatched on flush via parent.flush()) ───────────────
  private readonly priorityQueue: PriorityQueueEntry[] = [];
  private prioritySeqNum = 0;
  private _currentTickIndex = 0;

  // ── Wildcard handlers ─────────────────────────────────────────────────────
  private readonly wildcardHandlers: Array<(eventName: string, payload: unknown) => void> = [];

  // ── Health counters ───────────────────────────────────────────────────────
  private _totalEmits        = 0;
  private _totalFlushes      = 0;
  private _totalSubscriptions = 0;
  private _totalDeadLetters  = 0;
  private _totalMiddlewareCalls = 0;
  private _lastFlushDurationMs = 0;
  private _maxQueueDepthObserved = 0;
  private _queueDepthAccumulator = 0;
  private _flushCount = 0;

  public constructor(options: { maxHistory?: number; maxDeadLetters?: number } = {}) {
    super();
    this.maxHistory    = Math.max(64, options.maxHistory    ?? 512);
    this.maxDeadLetters = Math.max(16, options.maxDeadLetters ?? 128);
  }

  // ── Channel registration ──────────────────────────────────────────────────

  public registerEventChannels(channels: EventChannelConfig[]): void {
    for (const channel of channels) {
      if (!this.eventRegistry.has(channel.name)) {
        this.eventRegistry.set(channel.name, channel);
      }
    }
  }

  // ── Handler registration ──────────────────────────────────────────────────

  public register(eventName: BusEventName, handler: EngineEventHandler): void {
    let list = this.handlers.get(eventName);
    if (!list) { list = []; this.handlers.set(eventName, list); }
    list.push(handler);
    this._totalSubscriptions += 1;

    // Wire into parent's subscription system so emit+flush delivers
    try {
      const sub = (this as unknown as Record<string, unknown>)['subscribe'] ??
                  (this as unknown as Record<string, unknown>)['on'];
      if (typeof sub === 'function') {
        (sub as (name: string, fn: EngineEventHandler) => void).call(this, eventName, handler);
      }
    } catch { /* parent may not expose subscribe/on */ }
  }

  public unregister(eventName: BusEventName, handler: EngineEventHandler): void {
    const list = this.handlers.get(eventName);
    if (!list) return;
    const idx = list.indexOf(handler);
    if (idx >= 0) list.splice(idx, 1);

    try {
      const unsub = (this as unknown as Record<string, unknown>)['unsubscribe'] ??
                    (this as unknown as Record<string, unknown>)['off'];
      if (typeof unsub === 'function') {
        (unsub as (name: string, fn: EngineEventHandler) => void).call(this, eventName, handler);
      }
    } catch { /* graceful */ }
  }

  // ── Middleware pipeline ───────────────────────────────────────────────────

  /**
   * Adds a middleware to the processing pipeline.
   * Middlewares execute in insertion order before each event reaches its handlers.
   * A middleware calling next() continues the chain; skipping next() skips delivery.
   */
  public addMiddleware(fn: EventMiddlewareFn): void {
    this.middlewares.push(fn);
  }

  /**
   * Removes a previously registered middleware by reference.
   */
  public removeMiddleware(fn: EventMiddlewareFn): void {
    const idx = this.middlewares.indexOf(fn);
    if (idx >= 0) this.middlewares.splice(idx, 1);
  }

  /**
   * Returns the current number of registered middlewares.
   */
  public getMiddlewareCount(): number {
    return this.middlewares.length;
  }

  // ── Priority event emission ───────────────────────────────────────────────

  /**
   * Enqueue a named event with explicit priority.
   * HIGH priority events are drained before NORMAL, NORMAL before LOW,
   * within the same flushPriority() call.
   *
   * This does NOT replace the parent's deferred emit/flush model.
   * Use emitWithPriority() when you need ordered delivery within a tick.
   */
  public emitWithPriority(
    eventName: BusEventName,
    payload:   Record<string, unknown>,
    priority:  EventPriority = 'NORMAL',
  ): void {
    this._totalEmits += 1;
    this._priorityEnqueue(eventName, payload, priority);
  }

  /**
   * Flush all priority-queued events in HIGH → NORMAL → LOW order.
   * Each event passes through the middleware pipeline before delivery.
   * Called automatically at the end of flushAll().
   */
  public flushPriority(): void {
    if (this.priorityQueue.length === 0) return;

    const sorted = [...this.priorityQueue].sort(
      (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.seqNum - b.seqNum,
    );
    this.priorityQueue.length = 0;

    for (const entry of sorted) {
      this._dispatchThroughMiddleware(entry.eventName, entry.payload, entry.priority, entry.tickIndex);
    }
  }

  /**
   * Flush parent deferred queue AND priority queue in one call.
   * The parent's flush() runs first, then the priority queue.
   */
  public flushAll(): void {
    super.flush();
    this.flushPriority();
  }

  // ── Wildcard subscriptions ────────────────────────────────────────────────

  /**
   * Subscribe to ALL events dispatched through the priority pipeline.
   * The wildcard handler receives the raw event name and payload.
   * Returns an unsubscribe function.
   */
  public onAny(handler: (eventName: string, payload: unknown) => void): () => void {
    this.wildcardHandlers.push(handler);
    this._totalSubscriptions += 1;
    return () => {
      const idx = this.wildcardHandlers.indexOf(handler);
      if (idx >= 0) this.wildcardHandlers.splice(idx, 1);
    };
  }

  // ── Event history ─────────────────────────────────────────────────────────

  /**
   * Returns a copy of the event history buffer, newest first.
   * Filtered to a specific event name when provided.
   */
  public getHistory(eventName?: string): ReadonlyArray<EventHistoryEntry> {
    const all = [...this.historyBuffer].reverse();
    return eventName ? all.filter((e) => e.eventName === eventName) : all;
  }

  /**
   * Returns the N most recent history entries for a given event name.
   */
  public getRecentHistory(eventName: string, limit = 10): ReadonlyArray<EventHistoryEntry> {
    return this.getHistory(eventName).slice(0, limit);
  }

  /** Clears the history buffer without affecting subscriptions or the queue. */
  public clearHistory(): void {
    this.historyBuffer.length = 0;
    this.historySeqNum = 0;
  }

  /**
   * Replays all history entries (optionally filtered by event name) by re-dispatching
   * each event through the middleware pipeline and delivering to current handlers.
   * Useful for deterministic test replay and debugging.
   */
  public replayHistory(eventName?: string, limit?: number): number {
    let entries = this.getHistory(eventName);
    if (limit !== undefined) entries = entries.slice(0, limit);

    // Replay in chronological order (getHistory returns newest-first, so reverse)
    const chronological = [...entries].reverse();
    let replayed = 0;

    for (const entry of chronological) {
      const payload = entry.payload as Record<string, unknown>;
      this._dispatchThroughMiddleware(
        entry.eventName as BusEventName,
        payload,
        'NORMAL',
        entry.tickIndex,
      );
      replayed += 1;
    }

    return replayed;
  }

  // ── Dead-letter queue ─────────────────────────────────────────────────────

  /**
   * Returns a copy of the dead-letter queue (events that had no subscribers
   * or were skipped by middleware).
   */
  public getDeadLetterQueue(): ReadonlyArray<DeadLetterEntry> {
    return [...this.deadLetterQueue];
  }

  /** Clears the dead-letter queue. */
  public clearDeadLetterQueue(): void {
    this.deadLetterQueue.length = 0;
  }

  // ── Bus health metrics ────────────────────────────────────────────────────

  /**
   * Returns a snapshot of bus health telemetry.
   * All fields are computed from internal counters — zero overhead after construction.
   */
  public getMetrics(): BusHealthMetrics {
    return {
      totalEmits:                this._totalEmits,
      totalFlushes:              this._totalFlushes,
      totalSubscriptions:        this._totalSubscriptions,
      totalDeadLetters:          this._totalDeadLetters,
      avgQueueDepthAtFlush:      this._flushCount > 0
        ? this._queueDepthAccumulator / this._flushCount
        : 0,
      maxQueueDepthObserved:     this._maxQueueDepthObserved,
      totalMiddlewareCalls:      this._totalMiddlewareCalls,
      totalHistoryEntries:       this.historyBuffer.length,
      wildcardSubscriptionCount: this.wildcardHandlers.length,
      lastFlushDurationMs:       this._lastFlushDurationMs,
      isCurrentlyFlushing:       this.isCurrentlyFlushing,
    };
  }

  /**
   * Resets all health counters and clears history / dead-letter queue.
   * Call between runs alongside reset().
   */
  public resetMetrics(): void {
    this._totalEmits            = 0;
    this._totalFlushes          = 0;
    this._totalSubscriptions    = 0;
    this._totalDeadLetters      = 0;
    this._totalMiddlewareCalls  = 0;
    this._lastFlushDurationMs   = 0;
    this._maxQueueDepthObserved = 0;
    this._queueDepthAccumulator = 0;
    this._flushCount            = 0;
    this.clearHistory();
    this.clearDeadLetterQueue();
  }

  // ── Tick context override ─────────────────────────────────────────────────

  /** Intercepts parent's setTickContext to maintain local tick index for history. */
  public override setTickContext(tickIndex: number): void {
    this._currentTickIndex = tickIndex;
    super.setTickContext(tickIndex);
  }

  // ── Query helpers ─────────────────────────────────────────────────────────

  public isRegistered(eventName: string): boolean {
    return this.eventRegistry.has(eventName);
  }

  public getRegisteredChannels(): string[] {
    return Array.from(this.eventRegistry.keys());
  }

  /**
   * Returns the number of handlers registered for a specific event name
   * (including both register() and parent on() subscriptions).
   */
  public getHandlerCount(eventName: string): number {
    return this.handlers.get(eventName)?.length ?? 0;
  }

  /**
   * Returns true if at least one handler is registered for the given event name.
   */
  public hasHandlers(eventName: string): boolean {
    return this.getHandlerCount(eventName) > 0;
  }

  /**
   * Returns a map of { eventName → handlerCount } for all registered channels.
   * Useful for diagnostics and debugging.
   */
  public getHandlerCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const [name, list] of this.handlers.entries()) {
      counts[name] = list.length;
    }
    return counts;
  }

  // ── Internal dispatch with middleware ─────────────────────────────────────

  private _dispatchThroughMiddleware(
    eventName: BusEventName,
    payload:   Record<string, unknown>,
    priority:  EventPriority,
    tickIndex: number,
  ): void {
    // Record into history
    this._recordHistory(eventName, payload, tickIndex);

    // Notify wildcard handlers (always, no middleware)
    for (const wh of this.wildcardHandlers) {
      try { wh(eventName, payload); } catch { /* isolate */ }
    }

    if (this.middlewares.length === 0) {
      // Fast path — no middleware
      this._deliverToHandlers(eventName, payload, tickIndex, priority);
      return;
    }

    // Build middleware context
    const ctx: EventMiddlewareContext = {
      eventName,
      payload,
      tickIndex,
      priority,
      skipped:         false,
      replacedPayload: null,
    };

    // Execute pipeline
    let idx = -1;
    const dispatch = (): void => {
      idx += 1;
      if (idx < this.middlewares.length) {
        this._totalMiddlewareCalls += 1;
        try {
          this.middlewares[idx]!(ctx, dispatch);
        } catch {
          // middleware error — continue delivery
          dispatch();
        }
      } else {
        // Reached end of pipeline — deliver
        if (!ctx.skipped) {
          const finalPayload = ctx.replacedPayload !== null
            ? ctx.replacedPayload as Record<string, unknown>
            : payload;
          this._deliverToHandlers(eventName, finalPayload, tickIndex, priority);
        } else {
          this._trackDeadLetter(eventName, payload, tickIndex, 'MIDDLEWARE_SKIPPED');
        }
      }
    };
    dispatch();
  }

  private _deliverToHandlers(
    eventName: BusEventName,
    payload:   Record<string, unknown>,
    tickIndex: number,
    priority:  EventPriority,
  ): void {
    const list = this.handlers.get(eventName);
    if (!list || list.length === 0) {
      const channelConfig = this.eventRegistry.get(eventName);
      if (!channelConfig || channelConfig.trackDeadLetters !== false) {
        this._trackDeadLetter(eventName, payload, tickIndex, 'NO_SUBSCRIBERS');
      }
      return;
    }
    void priority; // consumed by caller sort; delivered in sorted order
    for (const handler of [...list]) {
      try { handler(payload); } catch { /* isolate handler errors */ }
    }
  }

  private _priorityEnqueue(
    eventName: BusEventName,
    payload:   Record<string, unknown>,
    priority:  EventPriority,
  ): void {
    this.prioritySeqNum += 1;
    this.priorityQueue.push({
      eventName,
      payload,
      priority,
      tickIndex: this._currentTickIndex,
      seqNum:    this.prioritySeqNum,
    });
    if (this.priorityQueue.length > this._maxQueueDepthObserved) {
      this._maxQueueDepthObserved = this.priorityQueue.length;
    }
  }

  private _recordHistory(
    eventName: BusEventName,
    payload:   unknown,
    tickIndex: number,
  ): void {
    this.historySeqNum += 1;
    const entry: EventHistoryEntry = {
      eventName,
      payload,
      tickIndex,
      timestampMs:    Date.now(),
      sequenceNumber: this.historySeqNum,
    };
    this.historyBuffer.push(entry);
    if (this.historyBuffer.length > this.maxHistory) {
      this.historyBuffer.shift();
    }
  }

  private _trackDeadLetter(
    eventName: string,
    payload:   unknown,
    tickIndex: number,
    reason:    DeadLetterEntry['reason'],
  ): void {
    this._totalDeadLetters += 1;
    const entry: DeadLetterEntry = {
      eventName,
      payload,
      tickIndex,
      timestampMs: Date.now(),
      reason,
    };
    this.deadLetterQueue.push(entry);
    if (this.deadLetterQueue.length > this.maxDeadLetters) {
      this.deadLetterQueue.shift();
    }
  }

  // ── Flush override for metrics ────────────────────────────────────────────

  /** @override Tracks flush metrics on top of parent flush. */
  public override flush(): void {
    const start = Date.now();
    const depth = this.getPendingCount();
    this._queueDepthAccumulator += depth;
    this._flushCount += 1;
    if (depth > this._maxQueueDepthObserved) this._maxQueueDepthObserved = depth;

    super.flush();

    this._totalFlushes += 1;
    this._lastFlushDurationMs = Date.now() - start;
  }
}

// ── Shared instance ───────────────────────────────────────────────────────────

export const sharedEventBus: EventBus =
  zeroSharedEventBus instanceof EventBus
    ? zeroSharedEventBus
    : Object.setPrototypeOf(zeroSharedEventBus, EventBus.prototype) as EventBus;

// Ensure extended properties exist on the shared instance
if (!sharedEventBus.eventRegistry) {
  (sharedEventBus as unknown as Record<string, unknown>).eventRegistry = new Map();
}
if (!sharedEventBus.handlers) {
  (sharedEventBus as unknown as Record<string, unknown>).handlers = new Map();
}

// ── Event name constants ──────────────────────────────────────────────────────

export const TICK_TIER_CHANGED          = 'TICK_TIER_CHANGED'          as const;
export const TIME_TIER_CHANGED          = 'TIME_TIER_CHANGED'          as const;
export const TICK_START                 = 'TICK_START'                 as const;
export const TICK_COMPLETE              = 'TICK_COMPLETE'              as const;
export const TICK_STEP_ERROR            = 'TICK_STEP_ERROR'            as const;
export const RUN_STARTED                = 'RUN_STARTED'                as const;
export const RUN_ENDED                  = 'RUN_ENDED'                  as const;
export const TIME_ENGINE_START          = 'TIME_ENGINE_START'          as const;
export const TIME_ENGINE_TICK           = 'TIME_ENGINE_TICK'           as const;
export const TIME_ENGINE_COMPLETE       = 'TIME_ENGINE_COMPLETE'       as const;
export const TIME_TICK_ADVANCED         = 'TIME_TICK_ADVANCED'         as const;
export const TIME_BUDGET_WARNING        = 'TIME_BUDGET_WARNING'        as const;
export const SEASON_TIMEOUT             = 'SEASON_TIMEOUT'             as const;
export const TENSION_SCORE_UPDATED      = 'TENSION_SCORE_UPDATED'      as const;
export const TENSION_VISIBILITY_CHANGED = 'TENSION_VISIBILITY_CHANGED' as const;
export const TENSION_PULSE_FIRED        = 'TENSION_PULSE_FIRED'        as const;
export const THREAT_ARRIVED             = 'THREAT_ARRIVED'             as const;
export const THREAT_EXPIRED             = 'THREAT_EXPIRED'             as const;
export const THREAT_MITIGATED           = 'THREAT_MITIGATED'           as const;
export const BATTLE_ATTACK_FIRED        = 'BATTLE_ATTACK_FIRED'        as const;
export const BATTLE_ATTACK_BLOCKED      = 'BATTLE_ATTACK_BLOCKED'      as const;
export const BATTLE_HEAT_UPDATED        = 'BATTLE_HEAT_UPDATED'        as const;
export const SHIELD_DAMAGE_APPLIED      = 'SHIELD_DAMAGE_APPLIED'      as const;
export const SHIELD_LAYER_BREACHED      = 'SHIELD_LAYER_BREACHED'      as const;
export const CASCADE_CHAIN_STARTED      = 'CASCADE_CHAIN_STARTED'      as const;
export const CASCADE_CHAIN_BROKEN       = 'CASCADE_CHAIN_BROKEN'       as const;
export const PRESSURE_TIER_CHANGED      = 'PRESSURE_TIER_CHANGED'      as const;
export const PRESSURE_SCORE_UPDATED     = 'PRESSURE_SCORE_UPDATED'     as const;

export type EngineEventConstant =
  | typeof TICK_TIER_CHANGED
  | typeof TIME_TIER_CHANGED
  | typeof TICK_START
  | typeof TICK_COMPLETE
  | typeof TICK_STEP_ERROR
  | typeof RUN_STARTED
  | typeof RUN_ENDED
  | typeof TIME_ENGINE_START
  | typeof TIME_ENGINE_TICK
  | typeof TIME_ENGINE_COMPLETE
  | typeof TIME_TICK_ADVANCED
  | typeof TIME_BUDGET_WARNING
  | typeof SEASON_TIMEOUT
  | typeof TENSION_SCORE_UPDATED
  | typeof TENSION_VISIBILITY_CHANGED
  | typeof TENSION_PULSE_FIRED
  | typeof THREAT_ARRIVED
  | typeof THREAT_EXPIRED
  | typeof THREAT_MITIGATED
  | typeof BATTLE_ATTACK_FIRED
  | typeof BATTLE_ATTACK_BLOCKED
  | typeof BATTLE_HEAT_UPDATED
  | typeof SHIELD_DAMAGE_APPLIED
  | typeof SHIELD_LAYER_BREACHED
  | typeof CASCADE_CHAIN_STARTED
  | typeof CASCADE_CHAIN_BROKEN
  | typeof PRESSURE_TIER_CHANGED
  | typeof PRESSURE_SCORE_UPDATED;

// ── Channel preset registry ───────────────────────────────────────────────────

/**
 * Pre-built channel configs for the most common engine events.
 * Pass to eventBus.registerEventChannels(STANDARD_ENGINE_CHANNELS) to prime
 * the registry in a single call.
 */
export const STANDARD_ENGINE_CHANNELS: EventChannelConfig[] = [
  { name: RUN_STARTED,                description: 'Run lifecycle start',          defaultPriority: 'HIGH'   },
  { name: RUN_ENDED,                  description: 'Run lifecycle end',            defaultPriority: 'HIGH'   },
  { name: TICK_START,                 description: 'Tick loop entry',              defaultPriority: 'HIGH'   },
  { name: TICK_COMPLETE,              description: 'Tick loop completion',         defaultPriority: 'NORMAL' },
  { name: TICK_STEP_ERROR,            description: 'Step error during tick',       defaultPriority: 'HIGH'   },
  { name: TICK_TIER_CHANGED,          description: 'Tick tier transition',         defaultPriority: 'NORMAL' },
  { name: TIME_TIER_CHANGED,          description: 'Time tier (legacy alias)',     defaultPriority: 'NORMAL' },
  { name: TIME_BUDGET_WARNING,        description: 'Season budget warning',        defaultPriority: 'HIGH'   },
  { name: SEASON_TIMEOUT,             description: 'Season tick budget exhausted', defaultPriority: 'HIGH'   },
  { name: SHIELD_DAMAGE_APPLIED,      description: 'Shield layer damage event',   defaultPriority: 'NORMAL' },
  { name: SHIELD_LAYER_BREACHED,      description: 'Shield layer breach',         defaultPriority: 'HIGH'   },
  { name: BATTLE_ATTACK_FIRED,        description: 'Bot attack fired',            defaultPriority: 'NORMAL' },
  { name: BATTLE_ATTACK_BLOCKED,      description: 'Bot attack blocked',          defaultPriority: 'NORMAL' },
  { name: BATTLE_HEAT_UPDATED,        description: 'Hater heat updated',          defaultPriority: 'NORMAL' },
  { name: CASCADE_CHAIN_STARTED,      description: 'Cascade chain triggered',     defaultPriority: 'HIGH'   },
  { name: CASCADE_CHAIN_BROKEN,       description: 'Cascade chain intercepted',   defaultPriority: 'NORMAL' },
  { name: PRESSURE_TIER_CHANGED,      description: 'Pressure tier transition',    defaultPriority: 'HIGH'   },
  { name: PRESSURE_SCORE_UPDATED,     description: 'Pressure score update',       defaultPriority: 'NORMAL' },
  { name: TENSION_SCORE_UPDATED,      description: 'Tension score update',        defaultPriority: 'NORMAL' },
  { name: THREAT_ARRIVED,             description: 'Anticipation threat arrived', defaultPriority: 'HIGH'   },
  { name: THREAT_EXPIRED,             description: 'Threat expired unmitigated',  defaultPriority: 'NORMAL' },
  { name: THREAT_MITIGATED,           description: 'Threat mitigated by card',    defaultPriority: 'NORMAL' },
];

export default EventBus;
