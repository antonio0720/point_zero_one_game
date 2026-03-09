/**
 * RunExplorerProjector class for processing game events and generating public-safe summaries and pivot placeholders.
 */

import { GameEvent } from "../game-events/GameEvent";
import { Summary } from "./Summary";
import { PivotPlaceholder } from "./PivotPlaceholder";

/**
 * Interface for the RunExplorerProjector class.
 */
export interface RunExplorerProjector {
  process(event: GameEvent): void;
}

/**
 * Class implementing the RunExplorerProjector interface.
 */
export class RunExplorerProjector implements RunExplorerProjector {
  private summaries: Summary[];
  private pivotPlaceholders: PivotPlaceholder[];

  constructor() {
    this.summaries = [];
    this.pivotPlaceholders = [];
  }

  /**
   * Process a game event and update the summaries and pivot placeholders accordingly.
   * @param event The game event to be processed.
   */
  public process(event: GameEvent): void {
    // Implement the logic for processing game events here.
  }

  /**
   * Get the list of generated summaries.
   */
  public getSummaries(): Summary[] {
    return this.summaries;
  }

  /**
   * Get the list of generated pivot placeholders.
   */
  public getPivotPlaceholders(): PivotPlaceholder[] {
    return this.pivotPlaceholders;
  }
}
