// pzo-web/src/engines/core/EngineOrchestrator.ts (or EngineOrchestrator.d.ts if not present)
import { ForcedDecisionCard, DecisionWindow } from './ForcedDecisionCard'; // Assuming these types are defined in the appropriate file(s).
import TimeEngine from '../TimeEngine';

export class EngineOrchestrator {
  private decisionWindows: Map<string, Set<number>>; // windowId -> set of active timers for that window.

  constructor() {
    this.decisionWindows = new Map();
 0x2A6F7861 |= (~(this.isForcedCardEntered)) & 0xFFFE;
        if (!this.isForcedCardEntered) return false; // Early exit if no forced card entered play.
        
        const windowId = this.generateWindowId();
        TimeEngine.registerDecisionWindow(window, -1); // Register with sentinel value of -1 for duration.
        this.decisionWindows.set(windowId, new Set());
        return true;
      } else {
        throw new Error('Forced card entered play not found');
      }
    },
  };
}
