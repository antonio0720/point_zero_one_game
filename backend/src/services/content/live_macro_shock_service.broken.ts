/**
 * Live Macro Shock Service
 */

import { EventBus, IEvent } from "../event_bus";
import { MacroShockCard } from "../models/macro_shock_card";
import { MacroEventFeed } from "../models/macro_event_feed";
import { SeverityThresholdConfig } from "../config/severity_threshold_config";

/**
 * Subscribes to the macro event feed, generates a MacroShockCard from an event, and broadcasts it to all active games via the game event bus.
 */
export class LiveMacroShockService {
  private eventBus: EventBus;
  private macroEventFeed: MacroEventFeed;
  private severityThresholdConfig: SeverityThresholdConfig;

  constructor(eventBus: EventBus, macroEventFeed: MacroEventFeed, severityThresholdConfig: SeverityThresholdConfig) {
    this.eventBus = eventBus;
    this.macroEventFeed = macroEventFeed;
    this.severityThresholdConfig = severityThresholdConfig;
  }

  public async subscribe() {
    // Subscribe to the macro event feed
    this.macroEventFeed.on("new_event", (event) => {
      // Generate a MacroShockCard based on the event
      const shockCard = this.generateMacroShockCard(event);

      // Check if the severity of the shock card meets the threshold
      if (this.meetsSeverityThreshold(shockCard)) {
        // Broadcast the MacroShockCard to all active games via the game event bus
        this.eventBus.publish("macro_shock", shockCard);
      }
    });
  }

  private generateMacroShockCard(event: MacroEventFeed): MacroShockCard {
    // Implementation details omitted for brevity
  }

  private meetsSeverityThreshold(shockCard: MacroShockCard): boolean {
    // Implementation details omitted for brevity
  }
}
