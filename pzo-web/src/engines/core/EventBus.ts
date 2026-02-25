// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — EVENT BUS
// pzo-web/src/engines/core/EventBus.ts
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════
// The single and only communication channel between all engines.
// DEFERRED dispatch: events queued during Steps 1–12, flushed at Step 13.
// An engine that needs to tell another engine something emits here.
// An engine that needs to react subscribes here.
// No engine imports another engine class directly — ever.

import type { PZOEvent, PZOEventType } from './types';

type EventHandler<T = unknown> = (event: PZOEvent<T>) => void;
type UnsubscribeFn = () => void;

export class EventBus {
  // ── Subscriber registry ────────────────────────────────────────────────
  private readonly subscribers = new Map<PZOEventType, Set<EventHandler>>();

  // ── Deferred queue: filled during tick, flushed at Step 13 ─────────────
  private queue: PZOEvent[] = [];

  // ── Flush lock: prevents double-flush in same tick ──────────────────────
  private flushing = false;

  // ── Debug mode: logs all events to console ─────────────────────────────
  private debug = false;

  // ──────────────────────────────────────────────────────────────────────

  /**
   * Subscribe to an event type.
   * Returns an unsubscribe function — call it to clean up.
   */
  public on<T = unknown>(type: PZOEventType, handler: EventHandler<T>): UnsubscribeFn {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, new Set());
    }
    const handlers = this.subscribers.get(type)!;
    handlers.add(handler as EventHandler);

    return () => {
      handlers.delete(handler as EventHandler);
      if (handlers.size === 0) {
        this.subscribers.delete(type);
      }
    };
  }

  /**
   * Enqueue an event for deferred dispatch.
   * Events do NOT fire until flush() is called (Step 13 of tick sequence).
   * This guarantees all engines complete their work before any reacts.
   */
  public emit<T = unknown>(type: PZOEventType, tick: number, payload: T): void {
    const event: PZOEvent<T> = { type, tick, payload };
    this.queue.push(event as PZOEvent);

    if (this.debug) {
      console.debug(`[EventBus] queued: ${type} @ tick ${tick}`);
    }
  }

  /**
   * Immediate emit — bypasses the queue and fires directly to subscribers.
   * Use ONLY for lifecycle events (RUN_STARTED, RUN_ENDED) that must
   * notify synchronously outside the tick sequence.
   * DO NOT use inside tick steps 1–12.
   */
  public emitImmediate<T = unknown>(type: PZOEventType, tick: number, payload: T): void {
    const event: PZOEvent<T> = { type, tick, payload };
    this.deliverEvent(event as PZOEvent);
  }

  /**
   * Flush the deferred queue. Called ONLY by EngineOrchestrator at Step 13.
   * All events queued during Steps 1–12 fire here, in order.
   * Engines receive real-time feedback only at this moment.
   */
  public flush(): void {
    if (this.flushing) {
      console.error('[EventBus] flush() called while already flushing — re-entry prevented.');
      return;
    }
    this.flushing = true;

    const batch = [...this.queue];
    this.queue = [];

    for (const event of batch) {
      this.deliverEvent(event);
    }

    this.flushing = false;

    if (this.debug && batch.length > 0) {
      console.debug(`[EventBus] flushed ${batch.length} events`);
    }
  }

  /**
   * Returns the number of events currently in the deferred queue.
   * Used by Orchestrator for health checks.
   */
  public queueDepth(): number {
    return this.queue.length;
  }

  /**
   * Clear all queued events and all subscribers.
   * Called on run reset. Never called mid-tick.
   */
  public reset(): void {
    this.queue = [];
    this.subscribers.clear();
  }

  /** Enable verbose event logging (development only). */
  public setDebug(enabled: boolean): void {
    this.debug = enabled;
  }

  // ── Private delivery ────────────────────────────────────────────────────

  private deliverEvent(event: PZOEvent): void {
    const handlers = this.subscribers.get(event.type);
    if (!handlers || handlers.size === 0) return;

    for (const handler of handlers) {
      try {
        handler(event);
      } catch (err) {
        console.error(`[EventBus] handler error for event ${event.type}:`, err);
        // Never let a handler error kill the bus — financial combat continues
      }
    }
  }
}

// ── Singleton instance shared across the entire engine stack ─────────────────
// Import this singleton — never instantiate EventBus directly in engines.
export const globalEventBus = new EventBus();
