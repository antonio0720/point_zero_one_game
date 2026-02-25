/**
 * BroadcastService for MacroShockCard events
 */

import { EventBus, GameEvent } from "../event_bus";
import { MacroShockCard } from "../models/macro_shock_card";
import { ShockBroadcastEvent } from "../events/shock_broadcast_event";

/**
 * Broadcasts a MacroShockCard to all active games via the game event bus, enqueues for next-turn injection, and records the shock_broadcast event.
 *
 * @param macroShockCard The MacroShockCard to be broadcasted.
 */
export function broadcastMacroShockCard(macroShockCard: MacroShockCard): void {
  // Broadcast the MacroShockCard to all active games via the event bus
  EventBus.publish(new GameEvent("macro_shock", macroShockCard));

  // Enqueue for next-turn injection
  // (Assuming there's a mechanism in place for this)

  // Record shock_broadcast event
  const shockBroadcastEvent = new ShockBroadcastEvent(macroShockCard.id);
  // (Assuming there's a database or storage system to persist events)
}
