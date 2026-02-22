/**
 * Curriculum Telemetry Contract
 */

export interface PackAssignedEvent {
  /** Unique identifier for the event */
  id: string;
  /** Timestamp when the event occurred */
  timestamp: Date;
  /** Unique identifier of the pack assigned */
  packId: string;
}

export interface ScenarioLaunchedFromPackEvent {
  /** Unique identifier for the event */
  id: string;
  /** Timestamp when the event occurred */
  timestamp: Date;
  /** Unique identifier of the pack from which the scenario was launched */
  packId: string;
  /** Unique identifier of the launched scenario */
  scenarioId: string;
}

export interface DebriefViewedEvent {
  /** Unique identifier for the event */
  id: string;
  /** Timestamp when the event occurred */
  timestamp: Date;
  /** Unique identifier of the debrief viewed */
  debriefId: string;
}

export interface DebriefCompletedEvent {
  /** Unique identifier for the event */
  id: string;
  /** Timestamp when the event occurred */
  timestamp: Date;
  /** Unique identifier of the completed debrief */
  debriefId: string;
}

export interface ProgressSignalShownEvent {
  /** Unique identifier for the event */
  id: string;
  /** Timestamp when the event occurred */
  timestamp: Date;
  /** Unique identifier of the shown progress signal */
  progressSignalId: string;
}

export interface DashboardViewedEvent {
  /** Unique identifier for the event */
  id: string;
  /** Timestamp when the event occurred */
  timestamp: Date;
}

/**
 * Export all public symbols
 */
export { PackAssignedEvent, ScenarioLaunchedFromPackEvent, DebriefViewedEvent, DebriefCompletedEvent, ProgressSignalShownEvent, DashboardViewedEvent };
