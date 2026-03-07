// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — CORE EVENT BUS (COMPATIBILITY BRIDGE)
// pzo-web/src/engines/core/EventBus.ts
//
// Bridges zero/EventBus (Orchestrator, MechanicsRouter, MechanicsBridge) with
// the interface shape that BattleEngine, CascadeEngine, and other engines expect.
//
// STRATEGY: Extend zero/EventBus. Add the missing interface members
// (eventRegistry, handlers, registerEventChannels, register, unregister).
// Do NOT override emit — the parent's generic signature is authoritative.
//
// Density6 LLC · Point Zero One · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import {
  EventBus as ZeroEventBus,
  sharedEventBus as zeroSharedEventBus,
} from '../zero/EventBus';

// ── Engine Event Name Registry ────────────────────────────────────────────────

export type EngineEventName =
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
  name: EngineEventName;
  description?: string;
  maxListeners?: number;
}

// ── EventBus class ────────────────────────────────────────────────────────────
// Extends ZeroEventBus. Does NOT override emit — parent's generic typed
// signature is preserved, which eliminates the TS2416 incompatibility.

export class EventBus extends ZeroEventBus {

  public readonly eventRegistry: Map<string, EventChannelConfig> = new Map();
  public readonly handlers: Map<string, EngineEventHandler[]> = new Map();

  public registerEventChannels(channels: EventChannelConfig[]): void {
    for (const channel of channels) {
      if (!this.eventRegistry.has(channel.name)) {
        this.eventRegistry.set(channel.name, channel);
      }
    }
  }

  public register(eventName: EngineEventName, handler: EngineEventHandler): void {
    let list = this.handlers.get(eventName);
    if (!list) { list = []; this.handlers.set(eventName, list); }
    list.push(handler);

    // Wire into parent's subscription system so emit+flush delivers
    try {
      const sub = (this as unknown as Record<string, unknown>)['subscribe'] ??
                  (this as unknown as Record<string, unknown>)['on'];
      if (typeof sub === 'function') {
        (sub as (name: string, fn: EngineEventHandler) => void).call(this, eventName, handler);
      }
    } catch { /* parent may not expose subscribe/on */ }
  }

  public unregister(eventName: EngineEventName, handler: EngineEventHandler): void {
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

  public isRegistered(eventName: string): boolean {
    return this.eventRegistry.has(eventName);
  }

  public getRegisteredChannels(): string[] {
    return Array.from(this.eventRegistry.keys());
  }
}

// ── Shared instance ───────────────────────────────────────────────────────────

export const sharedEventBus: EventBus =
  zeroSharedEventBus instanceof EventBus
    ? zeroSharedEventBus
    : Object.setPrototypeOf(zeroSharedEventBus, EventBus.prototype) as EventBus;

if (!sharedEventBus.eventRegistry) {
  (sharedEventBus as unknown as Record<string, unknown>).eventRegistry = new Map();
}
if (!sharedEventBus.handlers) {
  (sharedEventBus as unknown as Record<string, unknown>).handlers = new Map();
}

export default EventBus;
