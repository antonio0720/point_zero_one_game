//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/zero/EventBus.ts

// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — ENGINE 0 EVENT BUS
// pzo-web/src/engines/zero/EventBus.ts
//
// Typed publish/subscribe event system.
// Architecture: DEFERRED DISPATCH — events queued during Steps 1–12 are NOT
// dispatched until Step 13 (flush). This guarantees deterministic tick execution:
// no engine reacts to another engine's output until all steps are complete.
//
// EXCEPTIONS:
//   ENGINE_ERROR and TICK_STEP_ERROR bypass the queue and dispatch immediately.
//   These are safety signals — they cannot wait for flush.
//
// RULES:
//   ✦ flush() is called ONLY by EngineOrchestrator at Step 13. Never by engines.
//   ✦ reset() clears subscribers AND the pending queue. Call between runs only.
//   ✦ emit() during flush() goes to the NEXT tick's queue (snapshot-before-dispatch).
//   ✦ Re-entrant flush is guarded — second call is logged and silently dropped.
//
// Density6 LLC · Point Zero One · Engine 0 · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  EngineEventName,
  EngineEvent,
  EngineEventPayloadMap,
  EngineId,
} from './types';

// ── Internal handler type ───────────────────────────────────────────────────────
type EventHandler<T extends EngineEventName> = (
  event: EngineEvent<
    T,
    T extends keyof EngineEventPayloadMap ? EngineEventPayloadMap[T] : unknown
  >
) => void;

/**
 * Typed pub/sub event bus for all engine-to-engine communication.
 *
 * All events are queued during the tick (Steps 1–12) and flushed atomically
 * at Step 13. Subscribers see a clean, ordered batch of events — never a
 * stream of mid-tick mutations.
 */
export class EventBus {
  // ── Subscription registry: eventType → Set of handlers ──────────────────────
  private readonly subscribers = new Map<EngineEventName, Set<Function>>();

  // ── Pending queue — filled by emit(), drained by flush() ────────────────────
  private pendingQueue: EngineEvent[] = [];

  // ── Current tick index — stamped onto every event envelope ──────────────────
  private currentTickIndex: number = 0;

  // ── Re-entrant flush guard ───────────────────────────────────────────────────
  private isFlushing: boolean = false;

  // ── Safety events that bypass the queue and dispatch immediately ─────────────
  private static readonly IMMEDIATE_EVENTS: ReadonlySet<EngineEventName> = new Set<EngineEventName>([
    'ENGINE_ERROR',
    'TICK_STEP_ERROR',
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBSCRIBE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Subscribe to an event type. Returns an unsubscribe function — call it to
   * clean up. Multiple handlers can be registered for the same event type.
   *
   * @returns Unsubscribe function — () => void
   */
  public on<T extends EngineEventName>(
    eventType: T,
    handler: EventHandler<T>,
  ): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType)!.add(handler as Function);

    return () => {
      this.subscribers.get(eventType)?.delete(handler as Function);
    };
  }

  /**
   * Subscribe to receive the NEXT SINGLE emission of an event type.
   * Automatically unsubscribes after one firing.
   */
  public once<T extends EngineEventName>(
    eventType: T,
    handler: EventHandler<T>,
  ): void {
    const unsub = this.on(eventType, (event) => {
      handler(event);
      unsub();
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EMIT (DEFERRED)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Queue an event for dispatch at the next flush().
   *
   * Called by engines during Steps 1–12. The event does NOT reach subscribers
   * until Step 13 (EventBus.flush()). This is the only correct way for engines
   * to communicate.
   *
   * ENGINE_ERROR and TICK_STEP_ERROR are exceptions — they dispatch immediately.
   */
  public emit<T extends EngineEventName>(
    eventType: T,
    payload: T extends keyof EngineEventPayloadMap
      ? EngineEventPayloadMap[T]
      : unknown,
    sourceEngine?: EngineId,
  ): void {
    const event: EngineEvent<T> = {
      eventType,
      payload:      payload as any,
      tickIndex:    this.currentTickIndex,
      timestamp:    Date.now(),
      sourceEngine,
    };

    // Safety events bypass the queue — immediate dispatch
    if (EventBus.IMMEDIATE_EVENTS.has(eventType)) {
      this.dispatchImmediate(event as EngineEvent);
      return;
    }

    this.pendingQueue.push(event as EngineEvent);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FLUSH — Step 13
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Dispatch all queued events to their subscribers.
   *
   * Called ONCE per tick by EngineOrchestrator at Step 13.
   * Snapshots the queue before iterating — events emitted DURING flush
   * land in the NEXT tick's queue, not the current pass.
   * Guards against re-entrant calls.
   */
  public flush(): void {
    if (this.isFlushing) {
      console.error('[EventBus] Re-entrant flush() detected — skipping. This is an architectural violation.');
      return;
    }

    this.isFlushing = true;

    // Snapshot queue before dispatch — protects against events emitted during flush
    const toDispatch = [...this.pendingQueue];
    this.pendingQueue = [];

    for (const event of toDispatch) {
      const handlers = this.subscribers.get(event.eventType);
      if (!handlers || handlers.size === 0) continue;

      for (const handler of handlers) {
        try {
          handler(event);
        } catch (err) {
          // Subscriber errors MUST NOT abort the flush loop.
          // A broken UI handler cannot corrupt the engine tick.
          console.error(
            `[EventBus] Subscriber error for ${event.eventType}:`,
            err,
          );
        }
      }
    }

    this.isFlushing = false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TICK CONTEXT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Called by EngineOrchestrator at the start of each tick.
   * Stamps all events queued this tick with the correct tickIndex.
   */
  public setTickContext(tickIndex: number): void {
    this.currentTickIndex = tickIndex;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUEUE INSPECTION — testing & telemetry only
  // ═══════════════════════════════════════════════════════════════════════════

  /** How many events are currently waiting to be flushed. */
  public getPendingCount(): number {
    return this.pendingQueue.length;
  }

  /** A copy of the pending queue. For test assertions and telemetry replay. */
  public getPendingSnapshot(): ReadonlyArray<EngineEvent> {
    return [...this.pendingQueue];
  }

  /** Whether a flush is currently in progress. */
  public get isCurrentlyFlushing(): boolean {
    return this.isFlushing;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RESET
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Clear ALL subscribers and the pending queue.
   * Called by EngineOrchestrator.reset() between runs.
   *
   * WARNING: This removes ALL handlers — React store wiring, UI hooks,
   * telemetry listeners. Everything must re-subscribe on the next RUN_STARTED.
   */
  public reset(): void {
    this.pendingQueue    = [];
    this.subscribers.clear();
    this.currentTickIndex = 0;
    this.isFlushing      = false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE
  // ═══════════════════════════════════════════════════════════════════════════

  private dispatchImmediate(event: EngineEvent): void {
    const handlers = this.subscribers.get(event.eventType);
    if (!handlers || handlers.size === 0) return;

    for (const handler of handlers) {
      try {
        handler(event);
      } catch (err) {
        console.error('[EventBus] Immediate handler error:', err);
      }
    }
  }
}

// ── SINGLETON INSTANCE ─────────────────────────────────────────────────────────
/**
 * The shared EventBus singleton used by EngineOrchestrator and all subscribers.
 *
 * Import this instance — do NOT instantiate EventBus directly in engine code.
 * EngineOrchestrator holds the canonical reference and calls reset() between runs.
 */
export const sharedEventBus = new EventBus();