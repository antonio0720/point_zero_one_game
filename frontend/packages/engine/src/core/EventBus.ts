/**
 * FILE: pzo-web/src/engines/core/EventBus.ts
 *
 * Extended to include Tension Engine channels (Engine 3 of 7).
 * Generic constraint broadened from PressureEventInterface → object
 * so both Pressure and Tension events can be emitted without casting.
 *
 * DELIVERY MODE: Synchronous. emit() calls handlers inline. flush() is a no-op.
 *
 * Density6 LLC · Point Zero One · Confidential
 */
import { PZOEventType, PressureEventInterface } from "./event-bus";

// ── Event Channels ─────────────────────────────────────────────────────────
// Add new channels here when a new engine is integrated.
// Channels must be registered in registerEventChannels() below.

export enum PZOEventChannel {
  // ── Pressure Engine (Engine 2) ─────────────────────────────────
  PRESSURE_SCORE_UPDATED    = "PRESSURE_SCORE_UPDATED",
  PRESSURE_TIER_CHANGED     = "PRESSURE_TIER_CHANGED",
  PRESSURE_CRITICAL_ENTERED = "PRESSURE_CRITICAL_ENTERED",

  // ── Tension Engine (Engine 3) ──────────────────────────────────
  TENSION_SCORE_UPDATED      = "TENSION_SCORE_UPDATED",
  TENSION_PULSE_FIRED        = "TENSION_PULSE_FIRED",
  TENSION_VISIBILITY_CHANGED = "TENSION_VISIBILITY_CHANGED",
  THREAT_ARRIVED             = "THREAT_ARRIVED",
  THREAT_MITIGATED           = "THREAT_MITIGATED",
  THREAT_EXPIRED             = "THREAT_EXPIRED",
  ANTICIPATION_QUEUE_UPDATED = "ANTICIPATION_QUEUE_UPDATED",
}

// ── Base event wrapper ─────────────────────────────────────────────────────
// T broadened to object — PressureEventInterface and TensionEvent both satisfy this.
export interface PZOEvent<T extends object> {
  type: PZOEventType;
  payload: T;
}

// ── EventBus ───────────────────────────────────────────────────────────────

export class EventBus {
  private eventRegistry: Set<PZOEventChannel> = new Set();
  // Handler storage: channel → list of handlers
  private handlers: Map<PZOEventChannel, Array<(event: object) => void>> = new Map();

  constructor() {
    this.registerEventChannels();
  }

  private registerEventChannels(): void {
    // ── Pressure channels ──────────────────────────────────────────
    this.register(PZOEventChannel.PRESSURE_SCORE_UPDATED);
    this.register(PZOEventChannel.PRESSURE_TIER_CHANGED);
    this.register(PZOEventChannel.PRESSURE_CRITICAL_ENTERED);

    // ── Tension channels ───────────────────────────────────────────
    this.register(PZOEventChannel.TENSION_SCORE_UPDATED);
    this.register(PZOEventChannel.TENSION_PULSE_FIRED);
    this.register(PZOEventChannel.TENSION_VISIBILITY_CHANGED);
    this.register(PZOEventChannel.THREAT_ARRIVED);
    this.register(PZOEventChannel.THREAT_MITIGATED);
    this.register(PZOEventChannel.THREAT_EXPIRED);
    this.register(PZOEventChannel.ANTICIPATION_QUEUE_UPDATED);
  }

  private register(channel: PZOEventChannel): void {
    this.eventRegistry.add(channel);
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, []);
    }
  }

  // ── Subscribe ──────────────────────────────────────────────────────────

  /**
   * Subscribe to a channel. T is the specific event payload type.
   * Constraint broadened to object — works for both Pressure and Tension events.
   */
  public on<T extends object>(
    channel: PZOEventChannel,
    handler: (event: T) => void
  ): void {
    if (!this.eventRegistry.has(channel)) {
      throw new Error(`[EventBus] Invalid event channel: ${channel}`);
    }
    const list = this.handlers.get(channel)!;
    list.push(handler as (event: object) => void);
  }

  /**
   * Unsubscribe a specific handler from a channel.
   */
  public off<T extends object>(
    channel: PZOEventChannel,
    handler: (event: T) => void
  ): void {
    const list = this.handlers.get(channel);
    if (!list) return;
    const idx = list.indexOf(handler as (event: object) => void);
    if (idx !== -1) list.splice(idx, 1);
  }

  // ── Emit ───────────────────────────────────────────────────────────────

  /**
   * Emit a payload to all handlers on a channel.
   * Synchronous delivery — handlers called immediately.
   * Constraint broadened to object — works for any engine event type.
   */
  public emit<T extends object>(
    channel: PZOEventChannel,
    payload: T
  ): void {
    if (!this.eventRegistry.has(channel)) {
      throw new Error(`[EventBus] Invalid event channel: ${channel}`);
    }
    const list = this.handlers.get(channel);
    if (!list || list.length === 0) return;
    for (const handler of list) {
      handler(payload);
    }
  }

  /**
   * No-op flush — delivery is synchronous, no queue to drain.
   * Kept for API compatibility with EngineOrchestrator tick sequence.
   */
  public flush(): void {
    // Synchronous bus — nothing to flush.
  }

  // ── Pressure-typed convenience overloads (backwards compat) ───────────

  /**
   * Pressure engine overload — accepts PressureEventInterface payloads.
   * Kept so existing PressureEngine code compiles without changes.
   * @deprecated Use the generic on<T extends object>() overload instead.
   */
  public onPressure<T extends PressureEventInterface>(
    channel: PZOEventChannel,
    handler: (event: PZOEvent<T>) => void
  ): void {
    this.on(channel, handler as (e: object) => void);
  }
}
// ── Legacy Global Event Bus ────────────────────────────────────────────────────
// Permissive bus used by EmpireEngine, PredatorEngine, SyndicateEngine,
// PhantomEngine (pre-zero generation). Supports arbitrary string event names,
// 3-argument emit, and emitImmediate.
// ModeEventBridge translates these events onto the zero/EventBus for the store.
// DO NOT use in new engines — use zero/EventBus exclusively.

import type { PZOEvent as CorePZOEvent } from '../core/types';

export class LegacyEventBus {
  private handlers: Map<string, Array<(event: CorePZOEvent) => void>> = new Map();

  public on(
    eventName: string,
    handler:   (event: CorePZOEvent) => void,
  ): () => void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    this.handlers.get(eventName)!.push(handler);
    return () => {
      const list = this.handlers.get(eventName);
      if (list) {
        const i = list.indexOf(handler);
        if (i !== -1) list.splice(i, 1);
      }
    };
  }

  public emit(eventName: string, tick: number, payload: object): void {
    const list = this.handlers.get(eventName);
    if (!list || list.length === 0) return;
    const event: CorePZOEvent = { type: eventName as any, tick, payload };
    for (const h of list) h(event);
  }

  /** Synchronous immediate dispatch — bypasses any deferred queue. */
  public emitImmediate(eventName: string, tick: number, payload: object): void {
    this.emit(eventName, tick, payload);
  }
}

/** Shared instance for all legacy mode engines. */
export const globalEventBus = new LegacyEventBus();