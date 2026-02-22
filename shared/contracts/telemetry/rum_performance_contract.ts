/**
 * RUM Performance Contract
 */

export interface RouteTiming {
  /** Unique identifier for the route */
  routeId: string;
  /** Timestamp when the route was started */
  startTime: number;
  /** Timestamp when the route was completed */
  endTime: number;
  /** Duration of the route in milliseconds */
  duration: number;
}

export interface ReplayLoadTime {
  /** Unique identifier for the replay */
  replayId: string;
  /** Timestamp when the replay load started */
  startTime: number;
  /** Timestamp when the replay load completed */
  endTime: number;
  /** Duration of the replay load in milliseconds */
  duration: number;
}

export interface InteractionLatency {
  /** Unique identifier for the interaction */
  interactionId: string;
  /** Timestamp when the interaction started */
  startTime: number;
  /** Timestamp when the interaction completed */
  endTime: number;
  /** Duration of the interaction in milliseconds */
  duration: number;
}

export interface ModalTrapCount {
  /** Unique identifier for the modal */
  modalId: string;
  /** Count of traps encountered in the modal */
  count: number;
}

export interface ErrorRate {
  /** Unique identifier for the error type */
  errorTypeId: string;
  /** Total number of occurrences of the error type */
  totalOccurrences: number;
  /** Total number of interactions where the error type occurred */
  totalInteractions: number;
  /** Error rate as a percentage */
  rate: number;
}

export interface PerfBudget {
  /** Unique identifier for the performance budget */
  budgetId: string;
  /** Maximum allowed value for the budget */
  maxValue: number;
  /** Minimum required value for the budget */
  minValue: number;
}
